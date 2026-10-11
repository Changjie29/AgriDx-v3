import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';

export const TRACTOR_MODEL_URL = '/models/tractor-detailed-v1.glb';
export type TractorComponent = 'all' | 'body' | 'engine' | 'drivetrain' | 'hydraulics' | 'electrical' | 'wheels' | 'cab';
const OFFSETS: Record<string, [number, number, number]> = {
  body: [-.1, .75, 0], cab: [.4, .8, 0], engine: [-.8, .05, 0],
  drivetrain: [0, 0, 0], hydraulics: [.6, 0, 0], electrical: [-.2, .65, 0], wheels: [0, -.2, 0],
};

interface TractorModelProps {
  modelUrl?: string;
  onLoaded?: (object: THREE.Object3D) => void;
  component?: TractorComponent;
  exploded?: boolean;
}

/** Original schematic GLB. Cache geometry is shared; all changed materials are cloned. */
export default function TractorModel({ onLoaded, component = 'all', exploded = false, modelUrl = TRACTOR_MODEL_URL }: TractorModelProps) {
  const { scene } = useGLTF(modelUrl);
  const invalidate = useThree(state => state.invalidate);
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

  // Keep component separation fluid when switching between overview and exploded
  // views. The previous implementation snapped every group to its offset, which
  // made the structure feel disconnected and could briefly occlude the chassis.
  useEffect(() => {
    model.traverse(node => {
      const id = node.userData.component as string | undefined;
      if (modelUrl === TRACTOR_MODEL_URL && id && OFFSETS[id]) {
        node.userData.explosionTarget = new THREE.Vector3(...OFFSETS[id].map(n => exploded ? n : 0));
      }
    });
    invalidate();
  }, [model, exploded, modelUrl, invalidate]);

  useFrame((state, delta) => {
    const alpha = 1 - Math.exp(-delta * 8);
    let moving = false;
    model.traverse(node => {
      const target = node.userData.explosionTarget as THREE.Vector3 | undefined;
      if (target) {
        node.position.lerp(target, alpha);
        if (node.position.distanceToSquared(target) > 0.0004) moving = true;
      }
      if (!(node instanceof THREE.Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => {
        const targetOpacity = material.userData.targetOpacity as number | undefined;
        if (targetOpacity === undefined) return;
        material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, alpha);
        if (Math.abs(material.opacity - targetOpacity) > 0.002) moving = true;
      });
    });
    if (moving) state.invalidate();
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
      let owner = node.parent;
      while (owner && !owner.userData.component) owner = owner.parent;
      const selected = component === 'all' || owner?.userData.component === component;
      node.castShadow = selected;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => {
        const targetOpacity = selected ? material.userData.baseOpacity : .09;
        material.userData.targetOpacity = targetOpacity;
        material.transparent = selected ? material.userData.baseTransparent : true;
        material.depthWrite = selected ? material.userData.baseDepthWrite : false;
        material.needsUpdate = true;
      });
    });
    model.updateMatrixWorld(true);
    onLoaded?.(model);
    invalidate();
  }, [model, component, exploded, modelUrl, onLoaded, invalidate]);

  return <primitive object={model} />;
}
