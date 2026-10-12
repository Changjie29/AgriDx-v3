import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useGlassMode } from '@/hooks/useGlassMode';
import './liquid-glass.css';

interface LiquidGlassProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  variant?: 'regular' | 'clear';
  lens?: boolean;
  displacementScale?: number;
}

const STILL_POINTER = { x: 0, y: 0 };
const ReactLiquidGlass = lazy(() => import('liquid-glass-react'));

/** Keep content in normal flow. The upstream engine renders only the decorative backdrop. */
export function LiquidGlass({ children, className = '', contentClassName = '', variant = 'regular', lens = false, displacementScale = 36 }: LiquidGlassProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mode = useGlassMode();
  const [visible, setVisible] = useState(true);
  const [size, setSize] = useState({ width: 0, height: 0, radius: 22, blur: 12 });
  const refract = lens && mode === 'refract' && visible;

  useEffect(() => {
    const element = ref.current;
    if (!element || !lens || mode !== 'refract' || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '80px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [lens, mode]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !refract) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const width = element.clientWidth, height = element.clientHeight;
      const computed = getComputedStyle(element);
      const next = {
        width: Math.round(width), height: Math.round(height),
        radius: Math.min(parseFloat(computed.borderRadius) || 22, width / 2, height / 2),
        blur: parseFloat(computed.getPropertyValue('--lg-blur')) || 12,
      };
      setSize(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    window.addEventListener('resize', schedule, { passive: true });
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      cancelAnimationFrame(frame);
    };
  }, [refract]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !lens || mode !== 'refract') return;
    let frame = 0;
    let point: PointerEvent | null = null;
    const touched = new Set<HTMLElement>();
    const clear = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      point = null;
      element.removeAttribute('data-glass-active');
      for (const target of touched) {
        for (const name of ['--mx', '--my', '--lg-light-angle']) target.style.removeProperty(name);
      }
      touched.clear();
    };
    const flush = () => {
      frame = 0;
      if (!point) return;
      const control = point.target instanceof Element ? point.target.closest<HTMLElement>('button, a') : null;
      for (const target of [element, control]) {
        if (!target || !element.contains(target)) continue;
        const rect = target.getBoundingClientRect();
        const x = point.clientX - rect.left, y = point.clientY - rect.top;
        target.style.setProperty('--mx', `${x.toFixed(1)}px`);
        target.style.setProperty('--my', `${y.toFixed(1)}px`);
        target.style.setProperty('--lg-light-angle', `${Math.atan2(x - rect.width / 2, -(y - rect.height / 2)) * 180 / Math.PI}deg`);
        touched.add(target);
      }
      element.setAttribute('data-glass-active', 'true');
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      point = event;
      if (!frame) frame = requestAnimationFrame(flush);
    };
    element.addEventListener('pointermove', move, { passive: true });
    element.addEventListener('pointerleave', clear);
    return () => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerleave', clear);
      clear();
    };
  }, [lens, mode]);

  return <div ref={ref} className={`liquid-glass agri-liquid-glass lg-${variant} ${className}`} data-glass-mode={mode}>
    {refract && size.width > 0 && size.height > 0 ? <div className="liquid-glass-effect agri-glass-lens" aria-hidden="true">
      <Suspense fallback={<div className="agri-glass-frost" />}><ReactLiquidGlass
        key={`${size.width}x${size.height}`}
        className="agri-glass-engine"
        style={{ position: 'absolute', top: '0px', left: '0px', width: '100%', height: '100%' }}
        displacementScale={displacementScale} blurAmount={Math.max(0, (size.blur - 4) / 32)} saturation={135}
        aberrationIntensity={0.8} elasticity={0} cornerRadius={size.radius} padding="0" mode="standard"
        globalMousePos={STILL_POINTER} mouseOffset={STILL_POINTER}
      ><div style={{ width: size.width, height: size.height }} /></ReactLiquidGlass></Suspense>
    </div> : <div className="liquid-glass-effect agri-glass-frost" aria-hidden="true" />}
    <div className="liquid-glass-tint" aria-hidden="true" />
    <div className="liquid-glass-shine" aria-hidden="true" />
    <div className={`liquid-glass-content ${contentClassName}`}>{children}</div>
  </div>;
}
