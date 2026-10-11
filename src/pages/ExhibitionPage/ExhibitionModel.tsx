import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { ErrorBoundary } from 'react-error-boundary';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import TractorModel, { type TractorComponent } from '@/components/TractorModel';
import { useLang } from '@/hooks/useLang';
import { Loader2, Tractor } from 'lucide-react';

export type ExhibitionView = 'overview' | 'top';
const GL_OPTIONS = { alpha: true, antialias: true } as const;
const CAMERA = { position: [5.8, 3.3, 5.8] as [number, number, number], fov: 33 };

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    scene.environment = target.texture;
    return () => { scene.environment = null; target.dispose(); room.dispose(); generator.dispose(); };
  }, [gl, scene]);
  return null;
}

function CameraControl({ view, reset, rotating, onInteraction }: { view: ExhibitionView; reset: number; rotating: boolean; onInteraction: () => void }) {
  const ref = useRef<OrbitControlsImpl>(null);
  const camera = useThree(state => state.camera);
  useEffect(() => {
    camera.position.set(...(view === 'top' ? [0.01, 8.5, 0.01] : CAMERA.position) as [number, number, number]);
    ref.current?.target.set(0, 0.3, 0);
    ref.current?.update();
  }, [camera, view, reset]);
  return <OrbitControls ref={ref} makeDefault enablePan={false} minDistance={4} maxDistance={12} maxPolarAngle={Math.PI / 2.05} autoRotate={rotating} autoRotateSpeed={0.65} onStart={onInteraction} />;
}

function ModelFallback() {
  const lang = useLang();
  return <div className="expo-model-fallback"><Tractor size={90} strokeWidth={1} /><p>{lang === 'zh' ? '三维预览暂不可用' : '3D preview unavailable'}</p><span>{lang === 'zh' ? '可继续浏览资料与使用诊断功能' : 'Knowledge and diagnosis remain available'}</span></div>;
}

export default function ExhibitionModel({ component, exploded, view, rotating, reset, onInteraction }: { component: TractorComponent; exploded: boolean; view: ExhibitionView; rotating: boolean; reset: number; onInteraction: () => void }) {
  const [ready, setReady] = useState(false);
  const [supported] = useState(() => {
    try { const canvas = document.createElement('canvas'); return !!(canvas.getContext('webgl2') || canvas.getContext('webgl')); } catch { return false; }
  });
  const loaded = useCallback(() => setReady(true), []);
  if (!supported) return <ModelFallback />;
  return <ErrorBoundary FallbackComponent={ModelFallback}>
    <Canvas camera={CAMERA} gl={GL_OPTIONS} dpr={[1, 1.5]} frameloop={rotating ? 'always' : 'demand'} aria-label="原创拖拉机三维结构示意，可拖动旋转或滚轮缩放">
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 7, 4]} intensity={2.2} color="#daeaff" />
      <directionalLight position={[-4, 2, -3]} intensity={1.3} color="#7dd6ff" />
      <Environment />
      <mesh position={[0, -0.48, 0]}><cylinderGeometry args={[2.15, 2.25, 0.13, 80]} /><meshStandardMaterial color="#123656" metalness={0.65} roughness={0.35} /></mesh>
      <mesh position={[0, -0.41, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[2.08, 2.12, 80]} /><meshBasicMaterial color="#66dcff" transparent opacity={0.75} side={THREE.DoubleSide} /></mesh>
      <Grid position={[0, -0.56, 0]} args={[24, 24]} cellSize={0.7} cellThickness={0.5} cellColor="#1d4975" sectionSize={3.5} sectionThickness={0.7} sectionColor="#2b638d" fadeDistance={15} fadeStrength={3} infiniteGrid />
      <Suspense fallback={null}><TractorModel component={component} exploded={exploded} onLoaded={loaded} /></Suspense>
      <CameraControl view={view} reset={reset} rotating={rotating} onInteraction={onInteraction} />
    </Canvas>
    {!ready && <div className="expo-model-loading" role="status"><Loader2 size={18} />加载三维模型 / Loading model…</div>}
  </ErrorBoundary>;
}
