import { useReducedMotion } from 'framer-motion';
import { Fragment, useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';

import { useLang } from '@/hooks/useLang';
import { TRACTOR_COMPONENTS, TRACTOR_MODEL_URL, type TractorComponent } from './tractor-model-info';
import { getComponentBounds, getComponentOwner, isTractorComponent } from './tractor-component-utils';
const OFFSETS: Record<string, [number, number, number]> = {
  body: [-.1, .75, 0], cab: [.4, .8, 0], engine: [-.8, .05, 0],
  drivetrain: [0, 0, 0], hydraulics: [.6, 0, 0], electrical: [-.2, .65, 0], wheels: [0, -.2, 0],
};

interface TractorModelProps {
  modelUrl?: string;
  onLoaded?: (object: THREE.Object3D) => void;
  component?: TractorComponent;
  exploded?: boolean;
  interactive?: boolean;
  showHotspots?: boolean;
  onComponentSelect?: (component: TractorComponent) => void;
  onLayoutSettled?: (object: THREE.Object3D) => void;
}

/** Original schematic GLB. Cache geometry is shared; all changed materials are cloned. */
export default function TractorModel({ onLoaded, component = 'all', exploded = false, modelUrl = TRACTOR_MODEL_URL, interactive = false, showHotspots = false, onComponentSelect, onLayoutSettled }: TractorModelProps) {
  const lang = useLang();
  const reducedMotion = useReducedMotion();
  const invalidate = useThree(state => state.invalidate);
  const originalModel = modelUrl === TRACTOR_MODEL_URL;
  const callbacks = useRef({ onLoaded, onLayoutSettled });
  const pendingLayout = useRef(false);
  useEffect(() => {
    callbacks.current = { onLoaded, onLayoutSettled };
  }, [onLoaded, onLayoutSettled]);
  const { scene } = useGLTF(modelUrl);
  const model = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);
    cloned.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      const copies = materials.map(material => {
        const copy = material.clone();
        copy.userData = { ...copy.userData, baseOpacity: material.opacity, baseTransparent: material.transparent, baseDepthWrite: material.depthWrite };
        if (copy instanceof THREE.MeshStandardMaterial) {
          copy.envMapIntensity = Math.max(copy.envMapIntensity, 1.25);
          copy.roughness = THREE.MathUtils.clamp(copy.roughness, 0.2, 0.88);
        }
        return copy;
      });
      node.material = Array.isArray(node.material) ? copies : copies[0];
      node.castShadow = true;
      node.receiveShadow = true;
    });
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);
    if (box.isEmpty() || !Number.isFinite(maxDimension) || maxDimension <= 0) {
      throw new Error('GLB contains no visible geometry');
    }
    cloned.scale.setScalar(2.8 / maxDimension);
    cloned.updateMatrixWorld(true);
    const scaled = new THREE.Box3().setFromObject(cloned);
    const center = scaled.getCenter(new THREE.Vector3());
    cloned.position.set(-center.x, -scaled.min.y - .4, -center.z);
    cloned.updateMatrixWorld(true);
    return cloned;
  }, [scene]);

  const componentGroups = useMemo(() => {
    const groups: { id: Exclude<TractorComponent, 'all'>; object: THREE.Object3D; basePosition: THREE.Vector3; target: THREE.Vector3 }[] = [];
    if (originalModel) model.traverse(object => {
      if (isTractorComponent(object.userData.component)) {
        groups.push({ id: object.userData.component, object, basePosition: object.position.clone(), target: object.position.clone() });
      }
    });
    return groups;
  }, [model, originalModel]);

  const hotspots = useMemo(() => componentGroups.map(({ id, object }) => {
    const bounds = getComponentBounds(model, id);
    if (bounds.isEmpty()) return null;
    const size = bounds.getSize(new THREE.Vector3());
    const anchor = bounds.getCenter(new THREE.Vector3());
    // Keep anchors on the visible outer edge of the real component bounds.
    anchor.z = bounds.max.z + Math.max(size.z * .04, .04);
    if (id === 'cab') anchor.y = bounds.max.y + .04;
    else if (id === 'body') anchor.x = bounds.min.x + size.x * .18;
    else if (id === 'electrical') anchor.x = bounds.min.x;
    else if (id === 'wheels') anchor.x = bounds.max.x - size.x * .22;
    return { id, object, position: object.worldToLocal(anchor).toArray() as [number, number, number] };
  }).filter(item => item !== null), [model, componentGroups]);

  // Keep component separation fluid when switching between overview and exploded
  // views. The previous implementation snapped every group to its offset, which
  // made the structure feel disconnected and could briefly occlude the chassis.
  useEffect(() => {
    componentGroups.forEach(group => {
      group.target.copy(group.basePosition);
      if (exploded) group.target.add(new THREE.Vector3(...OFFSETS[group.id]));
    });
    pendingLayout.current = true;
    invalidate();
  }, [componentGroups, exploded, invalidate]);

  useFrame((state, delta) => {
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, .1) * 8);
    let geometryMoving = false;
    let materialMoving = false;
    componentGroups.forEach(({ object, target }) => {
      object.position.lerp(target, alpha);
      if (object.position.distanceToSquared(target) > 0.0004) geometryMoving = true;
      else object.position.copy(target);
    });
    model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => {
        const targetOpacity = material.userData.targetOpacity as number | undefined;
        if (targetOpacity === undefined) return;
        material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, alpha);
        if (Math.abs(material.opacity - targetOpacity) > 0.002) materialMoving = true;
        else {
          material.opacity = targetOpacity;
          if (targetOpacity === material.userData.baseOpacity) {
            if (material.transparent !== material.userData.baseTransparent) material.needsUpdate = true;
            material.transparent = material.userData.baseTransparent;
            material.depthWrite = material.userData.baseDepthWrite;
          }
        }
      });
    });
    if (geometryMoving || materialMoving) state.invalidate();
    if (!geometryMoving && pendingLayout.current) {
      pendingLayout.current = false;
      model.updateWorldMatrix(true, true);
      callbacks.current.onLayoutSettled?.(model);
    }
  });

  useEffect(() => () => model.traverse(node => {
    if (node instanceof THREE.Mesh) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => material.dispose());
    }
  }), [model]);

  useEffect(() => {
    model.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const selected = !originalModel || component === 'all' || getComponentOwner(node)?.userData.component === component;
      node.castShadow = selected;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => {
        const targetOpacity = selected ? material.userData.baseOpacity : .09;
        material.userData.targetOpacity = targetOpacity;
        material.transparent = true;
        material.depthWrite = selected ? material.userData.baseDepthWrite : false;
        material.needsUpdate = true;
      });
    });
    invalidate();
  }, [model, component, originalModel, invalidate]);

  useEffect(() => {
    model.updateWorldMatrix(true, true);
    callbacks.current.onLoaded?.(model);
  }, [model]);

  const handleMeshClick = (event: ThreeEvent<MouseEvent>) => {
    if (!originalModel || !interactive || event.delta > 4) return;
    const owner = getComponentOwner(event.object);
    if (!owner) return;
    event.stopPropagation();
    onComponentSelect?.(owner.userData.component as TractorComponent);
  };

  return <>
    <primitive object={model} onClick={originalModel && interactive ? handleMeshClick : undefined} dispose={null} />
    {originalModel && interactive && showHotspots && hotspots.map(({ id, object, position }, index) => {
      const info = TRACTOR_COMPONENTS.find(item => item.id === id)!;
      const label = lang === 'zh' ? info.zh : info.en;
      const selected = component === id;
      return <Fragment key={id}>{createPortal(
        <Html position={position} center wrapperClass="tractor-hotspot-anchor" zIndexRange={[12, 1]}>
          <button
            type="button"
            className="tractor-hotspot"
            style={{ minWidth: 36, minHeight: 36 }}
            aria-label={lang === 'zh' ? `选择${label}` : `Select ${label}`}
            aria-pressed={selected}
            title={label}
            onPointerDown={event => event.stopPropagation()}
            onClick={event => { event.stopPropagation(); onComponentSelect?.(id); }}
          >
            <span className="tractor-hotspot-dot" aria-hidden="true">{index + 1}</span>
            {selected && <span className="tractor-hotspot-label">{label}</span>}
          </button>
        </Html>, object,
      )}</Fragment>;
    })}
  </>;
}
