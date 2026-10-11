import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Grid, OrbitControls } from '@react-three/drei';
import { ErrorBoundary } from 'react-error-boundary';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import TractorModel, { type TractorComponent } from '@/components/TractorModel';
import { useLang } from '@/hooks/useLang';
import { Loader2, Tractor } from 'lucide-react';

export type ExhibitionView = 'overview' | 'top';
const GL_OPTIONS = { alpha: true, antialias: true, powerPreference: 'high-performance' } as const;
const CAMERA = { position: [5.8, 3.3, 5.8] as [number, number, number], fov: 33 };
const DEFAULT_TARGET = [0, 0.3, 0] as const;

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const generator = new THREE.PMREMGenerator(gl);
    generator.compileEquirectangularShader();
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    scene.environment = target.texture;
    const previousEnvironmentIntensity = scene.environmentIntensity;
    scene.environmentIntensity = 0.72;
    return () => {
      scene.environment = null;
      scene.environmentIntensity = previousEnvironmentIntensity;
      target.dispose();
      room.dispose();
      generator.dispose();
    };
  }, [gl, scene]);
  return null;
}

function CameraControl({ view, reset, rotating, onInteraction }: { view: ExhibitionView; reset: number; rotating: boolean; onInteraction: () => void }) {
  const ref = useRef<OrbitControlsImpl>(null);
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  const destination = useRef(new THREE.Vector3(...CAMERA.position));
  const destinationTarget = useRef(new THREE.Vector3(...DEFAULT_TARGET));
  const transitioning = useRef(false);
  useEffect(() => {
    const nextPosition = view === 'top' ? [0.01, 8.5, 0.01] : CAMERA.position;
    destination.current.set(...nextPosition as [number, number, number]);
    destinationTarget.current.set(...DEFAULT_TARGET);
    transitioning.current = true;
    invalidate();
  }, [camera, view, reset, invalidate]);
  useFrame((_, delta) => {
    if (!transitioning.current) return;
    const alpha = 1 - Math.exp(-delta * 7);
    camera.position.lerp(destination.current, alpha);
    const controls = ref.current;
    if (controls) {
      controls.target.lerp(destinationTarget.current, alpha);
      controls.update();
    }
    if (camera.position.distanceToSquared(destination.current) < 0.0004 && controls && controls.target.distanceToSquared(destinationTarget.current) < 0.0004) {
      camera.position.copy(destination.current);
      controls.target.copy(destinationTarget.current);
      controls.update();
      transitioning.current = false;
    } else {
      invalidate();
    }
  });
  const handleStart = () => {
    transitioning.current = false;
    onInteraction();
  };
  return <OrbitControls ref={ref} makeDefault enablePan={false} enableDamping dampingFactor={0.075} minDistance={4} maxDistance={12} minPolarAngle={0.05} maxPolarAngle={Math.PI / 2.05} autoRotate={rotating} autoRotateSpeed={0.4} onStart={handleStart} />;
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
    <Canvas
      camera={CAMERA}
      gl={GL_OPTIONS}
      dpr={[1, 1.75]}
      shadows="soft"
      frameloop={rotating ? 'always' : 'demand'}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      aria-label="原创拖拉机三维结构示意，可拖动旋转或滚轮缩放"
    >
      <ambientLight intensity={0.36} color="#9ec9e8" />
      <hemisphereLight args={['#dff4ff', '#071322', 0.72]} />
      <directionalLight position={[4.5, 7.5, 4]} intensity={3.1} color="#eaf7ff" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.00025} shadow-normalBias={0.025} />
      <directionalLight position={[-4, 3, -3]} intensity={1.4} color="#4caee3" />
      <spotLight position={[-4, 5, 2]} intensity={18} distance={14} angle={0.48} penumbra={0.82} color="#55cfff" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
      <pointLight position={[2.7, 2.4, -2.6]} intensity={11} distance={8} decay={2} color="#7bdcff" />
      <pointLight position={[-2.7, 1.2, 2.6]} intensity={7} distance={7} decay={2} color="#b9a6ff" />
      <Environment />
      <mesh position={[0, -0.48, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.15, 2.25, 0.13, 80]} />
        <meshStandardMaterial color="#0c2d4b" metalness={0.78} roughness={0.24} emissive="#061b31" emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[0, -0.405, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.08, 2.13, 96]} />
        <meshStandardMaterial color="#48c9f3" emissive="#32cfff" emissiveIntensity={2.5} metalness={0.35} roughness={0.18} transparent opacity={0.94} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.399, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.79, 1.82, 96]} />
        <meshBasicMaterial color="#8feaff" transparent opacity={0.52} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.58, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[28, 28]} />
        <shadowMaterial transparent opacity={0.18} />
      </mesh>
      <ContactShadows position={[0, -0.39, 0]} opacity={0.64} scale={5.2} blur={2.5} far={4} resolution={512} color="#020b16" />
      <Grid position={[0, -0.56, 0]} args={[24, 24]} cellSize={0.7} cellThickness={0.5} cellColor="#1d4975" sectionSize={3.5} sectionThickness={0.7} sectionColor="#2b638d" fadeDistance={15} fadeStrength={3} infiniteGrid />
      <Suspense fallback={null}><TractorModel component={component} exploded={exploded} onLoaded={loaded} /></Suspense>
      <CameraControl view={view} reset={reset} rotating={rotating} onInteraction={onInteraction} />
    </Canvas>
    {!ready && <div className="expo-model-loading" role="status"><Loader2 size={18} />加载三维模型 / Loading model…</div>}
  </ErrorBoundary>;
}
