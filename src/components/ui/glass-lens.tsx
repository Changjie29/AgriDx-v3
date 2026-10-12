import { useEffect, useImperativeHandle, useRef, useState, type Ref, type RefObject } from 'react';
import ReactLiquidGlass from 'liquid-glass-react';
import { createGlassMaps, stepGlassSpring, type GlassInteraction, type GlassOpticsHandle } from '@/lib/glass-optics';

interface GlassLensProps {
  width: number;
  height: number;
  radius: number;
  blur: number;
  displacementScale: number;
  interaction: RefObject<GlassInteraction>;
  surface: RefObject<HTMLDivElement | null>;
  ref?: Ref<GlassOpticsHandle>;
}

const STILL_POINTER = { x: 0, y: 0 };
const SVG_NS = 'http://www.w3.org/2000/svg';

function encodeMap(width: number, height: number, pixels: Uint8ClampedArray) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return '';
  const image = context.createImageData(width, height);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Adapt the locked upstream SVG to our geometry. Native backdrop sampling stays live, including WebGL. */
export default function GlassLens({ width, height, radius, blur, displacementScale, interaction, surface, ref }: GlassLensProps) {
  const engine = useRef<HTMLDivElement>(null);
  const controller = useRef<GlassOpticsHandle>({ update: () => {} });
  const [maps, setMaps] = useState<{ normal: string; rim: string } | null>(null);
  useImperativeHandle(ref, () => ({ update: state => controller.current.update(state) }), []);

  useEffect(() => {
    const map = createGlassMaps(width, height, radius, matchMedia('(pointer: coarse)').matches ? 49_152 : 98_304);
    const normal = encodeMap(map.width, map.height, map.normal);
    const rim = encodeMap(map.width, map.height, map.rim);
    setMaps(normal && rim ? { normal, rim } : null);
  }, [width, height, radius]);

  useEffect(() => {
    const element = surface.current;
    const filter = engine.current?.querySelector<SVGFilterElement>('.agri-glass-engine filter');
    const normal = filter?.querySelector('feImage');
    const channels = filter?.querySelectorAll('feDisplacementMap');
    if (!maps || !element || !filter || !normal || !channels || channels.length !== 3) return;
    const originals = [filter, normal, ...channels].map(node => ({ node, attributes: [...node.attributes].map(({ name, value }) => [name, value]) }));
    // Use the public surface as the backdrop boundary. Nested overflow clips can isolate
    // Chromium's backdrop sampling from sibling DOM/WebGL layers.
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    for (const [name, value] of Object.entries({ x: -32, y: -32, width: width + 64, height: height + 64 })) filter.setAttribute(name, String(value));
    for (const [name, value] of Object.entries({ x: 0, y: 0, width, height, preserveAspectRatio: 'none', href: maps.normal })) normal.setAttribute(name, String(value));
    const intensity = filter.querySelector('[result="EDGE_INTENSITY"]');
    const oldMask = filter.querySelector('[result="EDGE_MASK"]');
    const rim = document.createElementNS(SVG_NS, 'feImage');
    for (const [name, value] of Object.entries({ x: 0, y: 0, width, height, preserveAspectRatio: 'none', href: maps.rim, result: 'EDGE_MASK' })) rim.setAttribute(name, String(value));
    intensity?.remove();
    oldMask?.replaceWith(rim);
    const offset = document.createElementNS(SVG_NS, 'feOffset');
    offset.setAttribute('in', 'DISPLACEMENT_MAP');
    offset.setAttribute('result', 'LIVE_LENS');
    filter.insertBefore(offset, channels[0]);
    channels.forEach(channel => channel.setAttribute('in2', 'LIVE_LENS'));
    const opticalFilter = `blur(${Math.max(.7, blur / 3)}px) saturate(135%) url("#${filter.id}")`;
    element.style.setProperty('--lg-live-filter', opticalFilter);
    element.setAttribute('data-glass-renderer', 'live');

    let frame = 0, previous = 0;
    const values = [1, 0, 0], velocities = [0, 0, 0], targets = [1, 0, 0];
    const paint = () => {
      channels.forEach((channel, i) => channel.setAttribute('scale', (-displacementScale * values[0] * (1 + i * .025)).toFixed(3)));
      offset.setAttribute('dx', values[1].toFixed(3));
      offset.setAttribute('dy', values[2].toFixed(3));
    };
    const tick = (time: number) => {
      frame = 0;
      const dt = previous ? (time - previous) / 1000 : 1 / 60;
      previous = time;
      let settled = true;
      for (let i = 0; i < values.length; i++) {
        const next = stepGlassSpring(values[i], velocities[i], targets[i], dt);
        values[i] = next.position;
        velocities[i] = next.velocity;
        settled &&= next.settled;
      }
      paint();
      if (!settled) frame = requestAnimationFrame(tick);
      else previous = 0;
    };
    const update = (state: GlassInteraction) => {
      const next = [
        1 + (state.active ? Math.min(1, Math.hypot(state.x, state.y)) * .12 : 0) + (state.pressed ? .28 : 0),
        state.active ? Math.max(-1, Math.min(1, state.x)) * 1.5 : 0,
        state.active ? Math.max(-1, Math.min(1, state.y)) * 1.5 : 0,
      ];
      if (next.every((value, i) => value === targets[i] && value === values[i])) return;
      targets.splice(0, 3, ...next);
      if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      frame = previous = 0;
      if (document.hidden) {
        values.splice(0, 3, 1, 0, 0);
        velocities.fill(0);
        paint();
      } else update(interaction.current);
    };
    controller.current = { update };
    document.addEventListener('visibilitychange', visibility);
    paint();
    update(interaction.current);
    return () => {
      cancelAnimationFrame(frame);
      controller.current = { update: () => {} };
      document.removeEventListener('visibilitychange', visibility);
      offset.remove();
      if (oldMask) rim.replaceWith(oldMask);
      if (intensity && oldMask) filter.insertBefore(intensity, oldMask);
      for (const { node, attributes } of originals) {
        for (const { name } of [...node.attributes]) node.removeAttribute(name);
        for (const [name, value] of attributes) node.setAttribute(name, value);
      }
      element.style.removeProperty('--lg-live-filter');
      element.removeAttribute('data-glass-renderer');
    };
  }, [maps, width, height, blur, displacementScale, interaction, surface]);

  return <div ref={engine} className="agri-live-optics" data-glass-optics={maps ? 'live' : undefined}>
    <ReactLiquidGlass
      className="agri-glass-engine"
      style={{ position: 'absolute', top: '0px', left: '0px', width: '100%', height: '100%' }}
      displacementScale={displacementScale} blurAmount={0} saturation={135} aberrationIntensity={.8}
      elasticity={0} cornerRadius={radius} padding="0" globalMousePos={STILL_POINTER} mouseOffset={STILL_POINTER}
    ><div style={{ width, height }} /></ReactLiquidGlass>
  </div>;
}
