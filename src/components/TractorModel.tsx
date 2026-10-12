import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';

import { TRACTOR_MODEL_URL, type TractorComponent } from './tractor-model-info';
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
  const invalidate = useThree(state => state.invalidate);
  const { scene } = useGLTF(modelUrl);
  const model = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);
    cloned.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      const copies = materials.map(material => {
        const copy = material.clone();
        copy.userData = { ...copy.userData, baseOpacity: material.opacity, baseTransparent: material.transparent, baseDepthWrite: material.depthWrite };
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

  useEffect(() => () => model.traverse(node => {
    if (node instanceof THREE.Mesh) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => material.dispose());
    }
  }), [model]);

  useEffect(() => {
    model.traverse(node => {
      const id = node.userData.component as string | undefined;
      if (modelUrl === TRACTOR_MODEL_URL && id && OFFSETS[id]) node.position.set(...OFFSETS[id].map(n => exploded ? n : 0) as [number, number, number]);
      if (!(node instanceof THREE.Mesh)) return;
      const selected = component === 'all' || node.parent?.userData.component === component;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => {
        material.opacity = selected ? material.userData.baseOpacity : .09;
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
