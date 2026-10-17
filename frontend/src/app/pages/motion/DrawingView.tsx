/**
 * 0108 — EINE ZEICHNUNG ZEIGEN UND BEWEGEN (`drawing.ts` sagt, was darin ist).
 *
 * <b>Gezeichnet als SVG</b> in ihrem eigenen Raum (`viewBox`), so breit wie der
 * Platz: ein Pixel einer Bewegung ist eine Einheit der Zeichnung, und sie
 * wächst als Ganzes mit dem Schirm.
 *
 * <b>Jede Bewegung bekommt ihren Rahmen</b> (`<g>`), der äussere zuerst — so
 * setzt sich ein Weg mit einem Schweben zusammen, und Deckkraft multipliziert
 * sich. Was das Aussehen einer Fläche ändert (Farbe, Linie, Zeichnen), liegt
 * auf der Fläche selbst; eine Linie, die gezeichnet wird, misst sich dafür in
 * Anteilen (`pathLength`).
 *
 * <b>Alle Bewegungen einer Zeichnung beginnen zugleich</b> — wenn ihre Szene
 * (ihr Slajd) erreicht ist, und von vorn, wenn man wiederkommt; ist sie fort,
 * stehen sie. Vorher steht jede in ihrem ersten Bild. Ohne Slajd oder Szene:
 * sobald die Zeichnung im Bild ist. Bei „weniger Bewegung" steht sie still —
 * so, wie sie ohne Bewegung beschrieben ist.
 */

import { lazy, Suspense, useEffect, useId, useMemo, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';

import { needsLive, radialOf, type Drawing, type Shape } from './drawing';
import { dashArray, dashOf, keyframesOf, paint, timingOf, touchesPaint, type MotionUse } from './motion';
import { usePhase, useReducedMotion, type Phase } from './MotionBox';
import { imageUrl } from '../slides/slideLook';

interface Planned {
  readonly id: number;
  readonly use: MotionUse;
  readonly shift: number;
}

interface Ctx {
  readonly plan: Planned[];
  readonly gradients: { id: string; inner: string; outer: string; stop: number }[];
  readonly symbols: Drawing['symbols'];
  readonly prefix: string;
  readonly still: boolean;
  shift: number;
  depth: number;
}

const FILLED_BY_DEFAULT = new Set(['line', 'group', 'use', 'text', 'image']);

/** Um welchen Punkt sich ein Teil dreht und wächst. */
export function originStyle(origin: string | null): CSSProperties {
  if (origin === null || origin === 'center') return { transformBox: 'fill-box', transformOrigin: '50% 50%' };
  const [a, b] = origin.split(/\s+/);
  if (a.endsWith('%') || b.endsWith('%')) return { transformBox: 'fill-box', transformOrigin: `${a} ${b}` };
  return { transformBox: 'view-box', transformOrigin: `${a}px ${b}px` };
}

/** Eine Füllung: Farbe — oder ein Schein, dessen Verlauf in den `defs` der Zeichnung liegt. */
function fillOf(value: string | null, ctx: Ctx): string | undefined {
  if (value === null) return undefined;
  if (value.startsWith('radial(')) {
    const r = radialOf(value);
    if (r === null) return undefined;
    const id = `${ctx.prefix}-g${ctx.gradients.length}`;
    ctx.gradients.push({ id, ...r });
    return `url(#${id})`;
  }
  return paint(value);
}

export function filterOf(s: Shape): string | undefined {
  const parts = [s.blur > 0 ? `blur(${s.blur}px)` : '', s.glow === null ? '' : `drop-shadow(${glowPaint(s.glow)})`].filter((p) => p !== '');
  return parts.length === 0 ? undefined : parts.join(' ');
}

const glowPaint = (glow: string): string => {
  const m = /^(\S+\s+\S+\s+\S+)\s+(.+)$/.exec(glow);
  return m === null ? glow : `${m[1]} ${paint(m[2])}`;
};

/** Eine Bewegung vormerken — sie bekommt ihre Nummer; der Rahmen (oder die Fläche) trägt sie. */
function plan(ctx: Ctx, use: MotionUse): number {
  const id = ctx.plan.length;
  ctx.plan.push({ id, use, shift: ctx.shift });
  return id;
}

function renderShape(s: Shape, ctx: Ctx, key: string): ReactNode {
  if (ctx.depth > 8) return null;
  const moving = ctx.still ? [] : s.motion;
  const onSurface = moving.filter(touchesPaint);
  const around = moving.filter((m) => !touchesPaint(m));
  const surfaceIds = onSurface.map((m) => plan(ctx, m));
  const dash = onSurface.map(dashOf).find((l): l is number => l !== null);
  const paintStyle: CSSProperties = {
    /* Ohne Füllung: eine Fläche ist leer (nur ihr Rand), ein Napis in der Farbe der Schrift, eine Gruppe gibt nichts vor. */
    ...(s.fill === null ? (FILLED_BY_DEFAULT.has(s.type) ? {} : { fill: 'none' }) : { fill: fillOf(s.fill, ctx) }),
    ...(s.stroke === null ? {} : { stroke: paint(s.stroke), strokeWidth: s.width, strokeLinecap: s.cap, strokeLinejoin: 'round' }),
    ...(filterOf(s) === undefined ? {} : { filter: filterOf(s) }),
    ...(s.opacity === 1 ? {} : { opacity: s.opacity }),
    ...(dash === undefined ? {} : { strokeDasharray: dashArray(dash) }),
    ...(surfaceIds.length === 0 ? {} : originStyle(s.origin))
  };
  const mark = surfaceIds.length === 0 ? {} : { 'data-mo': surfaceIds.join(' ') };
  const measured = dash === undefined ? {} : { pathLength: dash };

  let body: ReactNode;
  switch (s.type) {
    case 'rect':
      body = <rect key={key} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} style={paintStyle} {...mark} {...measured} />;
      break;
    case 'circle':
      body = <circle key={key} cx={s.x} cy={s.y} r={s.r} style={paintStyle} {...mark} {...measured} />;
      break;
    case 'ellipse':
      body = <ellipse key={key} cx={s.x} cy={s.y} rx={s.w / 2} ry={s.h / 2} style={paintStyle} {...mark} {...measured} />;
      break;
    case 'line':
      body = <line key={key} x1={s.x} y1={s.y} x2={s.x2} y2={s.y2} style={{ stroke: 'currentColor', ...paintStyle }} {...mark} {...measured} />;
      break;
    case 'path':
      if (s.d === null) return null;
      body = <path key={key} d={s.d} style={paintStyle} {...mark} {...measured} />;
      break;
    case 'text':
      body = (
        <text key={key} x={s.x} y={s.y} fontSize={s.size} fontWeight={s.weight} textAnchor={s.anchor} dominantBaseline="central"
          style={{ fill: 'currentColor', ...paintStyle }} {...mark}>{s.text}</text>
      );
      break;
    case 'image':
      if (s.url === null) return null;
      body = <image key={key} href={imageUrl(s.url)} x={s.x} y={s.y} width={s.w} height={s.h} preserveAspectRatio="xMidYMid meet" style={paintStyle} {...mark} />;
      break;
    case 'group':
    case 'use': {
      const inner = s.type === 'use' ? ctx.symbols.get(s.use ?? '') ?? [] : s.children;
      const before = ctx.shift;
      ctx.shift += s.shift;
      ctx.depth += 1;
      const kids = inner.map((child, i) => renderShape(child, ctx, `${key}.${i}`));
      ctx.depth -= 1;
      ctx.shift = before;
      body = <g key={key} style={paintStyle} {...mark}>{kids}</g>;
      break;
    }
    default:
      return null;
  }

  /* Die Rahmen der Bewegungen um die Fläche — der äussere zuerst. */
  for (let i = around.length - 1; i >= 0; i -= 1) {
    const id = plan(ctx, around[i]);
    body = <g key={`${key}~${i}`} data-mo={id} style={originStyle(s.origin)}>{body}</g>;
  }
  /* Eine Gruppe steht an ihrem Platz (und in ihrer festen Grösse) — die Bewegungen rechnen von dort. */
  if ((s.type === 'group' || s.type === 'use') && (s.x !== 0 || s.y !== 0 || s.scale !== 1 || s.rotate !== 0)) {
    body = <g key={`${key}@`} transform={`translate(${s.x} ${s.y})${s.rotate !== 0 ? ` rotate(${s.rotate})` : ''}${s.scale !== 1 ? ` scale(${s.scale})` : ''}`}>{body}</g>;
  }
  return body;
}

/**
 * DIE BEWEGUNGEN EINER ZEICHNUNG ABSPIELEN — geteilt mit dem Bild zum Anfassen
 * (`LiveDrawing`): alle angehalten im ersten Bild, bis die Zeichnung erreicht
 * ist; dann alle zugleich von vorn; fort — alle halten.
 */
export function useMotionPlan(svg: RefObject<SVGSVGElement | null>, plan: readonly { readonly id: number; readonly use: MotionUse; readonly shift: number }[], quiet: boolean, phase: Phase): void {
  const anims = useRef<Animation[]>([]);
  const armed = useRef(true);

  useEffect(() => {
    const root = svg.current;
    if (root === null || quiet || typeof root.animate !== 'function') return undefined;
    const made: Animation[] = [];
    for (const item of plan) {
      const el = root.querySelector(`[data-mo~="${item.id}"]`);
      if (el === null) continue;
      const timing = timingOf(item.use);
      const animation = (el as Element).animate(keyframesOf(item.use, 'svg'), { ...timing, delay: Number(timing.delay ?? 0) + item.shift });
      animation.pause();
      animation.currentTime = 0;
      made.push(animation);
    }
    anims.current = made;
    armed.current = true;
    return () => { for (const a of made) a.cancel(); anims.current = []; };
  }, [svg, plan, quiet]);

  /* Erreicht: alle zugleich von vorn · fort: alle halten · zu sehen, schon gelaufen: weiter. */
  useEffect(() => {
    const list = anims.current;
    if (list.length === 0) return;
    if (phase === 'away') {
      for (const a of list) a.pause();
      armed.current = true;
      return;
    }
    if (armed.current) {
      if (phase !== 'here') return;
      armed.current = false;
      const now = document.timeline.currentTime;
      for (const a of list) { a.currentTime = 0; if (now !== null) a.startTime = now; else a.play(); }
      return;
    }
    for (const a of list) if (a.playState === 'paused') a.play();
  });
}

/** 2026-10-17 — das Bild zum Anfassen kommt erst, wenn eine Seite eines zeigt. */
const LiveLazy = lazy(() => import('./LiveDrawing'));

/**
 * DIE ZEICHNUNG. `still` — ohne Bewegung (im Streifen, zur Vorschau);
 * `identity` — was sich ändern muss, damit die Bewegungen neu aufgebaut werden.
 * Eine Zeichnung zum Anfassen (Werte, Rechnungen, Simulation — `needsLive`)
 * zeichnet `LiveDrawing`; bis es geladen ist, hält ein leerer Rahmen ihre Grösse.
 */
export function DrawingView(props: { drawing: Drawing; identity: string; still?: boolean; className?: string }) {
  if (!needsLive(props.drawing)) return <StillDrawing {...props} />;
  const { drawing } = props;
  return (
    <Suspense fallback={<svg className={props.className ?? 'dr'} viewBox={`0 0 ${drawing.w} ${drawing.h}`} aria-hidden="true" />}>
      <LiveLazy {...props} />
    </Suspense>
  );
}

function StillDrawing({ drawing, identity, still = false, className }: { drawing: Drawing; identity: string; still?: boolean; className?: string }) {
  const svg = useRef<SVGSVGElement | null>(null);
  const phase = usePhase(svg);
  const reduced = useReducedMotion();
  const quiet = still || reduced;
  const prefix = `dr${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const built = useMemo(() => {
    const ctx: Ctx = { plan: [], gradients: [], symbols: drawing.symbols, prefix, still: quiet, shift: 0, depth: 0 };
    const nodes = drawing.elements.map((s, i) => renderShape(s, ctx, String(i)));
    return { nodes, plan: ctx.plan, gradients: ctx.gradients };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, quiet, prefix]);

  useMotionPlan(svg, built.plan, quiet, phase);

  return (
    <svg ref={svg} className={className ?? 'dr'} viewBox={`0 0 ${drawing.w} ${drawing.h}`} role={drawing.alt === '' ? undefined : 'img'}
      aria-label={drawing.alt === '' ? undefined : drawing.alt} aria-hidden={drawing.alt === '' ? true : undefined}>
      {built.gradients.length > 0 && (
        <defs>
          {built.gradients.map((g) => (
            <radialGradient key={g.id} id={g.id} cx="50%" cy="50%" r="50%">
              <stop offset="0" style={{ stopColor: paint(g.inner) }} />
              <stop offset={`${g.stop}%`} style={{ stopColor: paint(g.outer) }} />
            </radialGradient>
          ))}
        </defs>
      )}
      {built.nodes}
    </svg>
  );
}

export default DrawingView;
