/**
 * 2026-10-17 — DAS BILD ZUM ANFASSEN, GEZEICHNET (`liveModel.ts` sagt, was
 * darin ist, `liveRun.ts` rechnet es).
 *
 * <b>React baut, die Schleife malt</b> — wie die Bühne der Präsentation: das
 * SVG entsteht einmal als Gerüst (jedes Teil ein Element mit `data-k`), und
 * jedes Bild schreibt die Schleife nur, was sich geändert hat, unmittelbar in
 * die Elemente. Ein Teil, dessen Namen sich nicht geändert haben, wird nicht
 * einmal gerechnet. Steht alles still (keine Simulation läuft, niemand zieht,
 * keine Uhr), läuft auch keine Schleife: ein Bild, das wartet, kostet nichts.
 *
 * <b>Leicht genug fürs Telefon</b>: keine Bibliothek, kein Canvas, kein
 * WebGL — SVG und ein paar hundert Zeilen. Die Schleife hält an, sobald das
 * Bild nicht zu sehen ist (seine Szene ist fort, es ist aus dem Bild gerollt).
 * Ein Griff ist mit dem Finger zu treffen (ein unsichtbarer Ring von 44 px),
 * und während er gezogen wird, rollt weder die Seite noch die Präsentation.
 *
 * <b>In einem Rahmen (`frame`) ist die Welt</b>: Meter statt Pixel, y nach
 * oben. Die Lage jedes Teils wird umgerechnet, seine Grösse (ein Radius, eine
 * Strichstärke, eine Schrift) bleibt in Einheiten der Zeichnung — ein Ball
 * bleibt rund, eine Pfeilspitze gleich gross, ein Text aufrecht.
 *
 * <b>Weniger Bewegung</b> (System): nichts läuft von selbst; was man selbst
 * startet, läuft.
 */

import { useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';

import { fmt, toNum, truth, type Env, type Expr } from './expr';
import { DRAWING_LIMITS, radialOf, type Bindable, type Drawing, type Shape } from './drawing';
import { colorValue, dashArray, dashOf, paint, touchesPaint, type MotionUse } from './motion';
import { usePhase, useReducedMotion } from './MotionBox';
import { filterOf, originStyle, useMotionPlan } from './DrawingView';
import { Program, type Said } from './liveRun';
import type { ControlSpec, Num, VarSpec } from './liveModel';
import { ShowClock } from '../presentation/showContext';
import { imageUrl } from '../slides/slideLook';

/* -- Wo ein Teil steht: frei (Einheiten der Zeichnung) oder in einem Rahmen (Welt) ------------- */

type View = readonly [number, number, number, number];

interface Place {
  readonly world: boolean;
  readonly reads: readonly string[];
  readonly at: (env: Env, x: number, y: number) => readonly [number, number];
  readonly back: (env: Env, x: number, y: number) => readonly [number, number];
  /** Wie lang eine Einheit der Welt in der Zeichnung ist (waagrecht, senkrecht). */
  readonly scale: (env: Env) => readonly [number, number];
}

const FREE: Place = { world: false, reads: [], at: (_e, x, y) => [x, y], back: (_e, x, y) => [x, y], scale: () => [1, 1] };

function framePlace(rect: { x: number; y: number; w: number; h: number }, view: (env: Env) => View, reads: readonly string[]): Place {
  const sx = (v: View) => rect.w / (v[2] - v[0] || 1);
  const sy = (v: View) => rect.h / (v[3] - v[1] || 1);
  return {
    world: true,
    reads,
    at: (env, x, y) => { const v = view(env); return [rect.x + (x - v[0]) * sx(v), rect.y + rect.h - (y - v[1]) * sy(v)]; },
    back: (env, x, y) => { const v = view(env); return [v[0] + (x - rect.x) / sx(v), v[1] + (rect.y + rect.h - y) / sy(v)]; },
    scale: (env) => { const v = view(env); return [Math.abs(sx(v)), Math.abs(sy(v))]; }
  };
}

function offsetPlace(parent: Place, dx: (env: Env) => number, dy: (env: Env) => number, reads: readonly string[]): Place {
  return {
    world: true,
    reads: [...parent.reads, ...reads],
    at: (env, x, y) => parent.at(env, x + dx(env), y + dy(env)),
    back: (env, x, y) => { const [a, b] = parent.back(env, x, y); return [a - dx(env), b - dy(env)]; },
    scale: parent.scale
  };
}

/* -- Gerüst und Schreiben ----------------------------------------------------------------------- */

/** Ein Teil, das die Schleife schreibt: seine Nummer (`data-k`), was es liest, seine Wiederholung, und wie es sich schreibt. */
interface Inst {
  readonly k: number;
  readonly reads: ReadonlySet<string>;
  readonly scope: readonly [number, number] | null;
  readonly write: (el: SVGElement, env: Env) => void;
  /** Ist eine umschliessende Gruppe (ein Rahmen) verborgen, wird das Teil nicht einmal gerechnet. */
  readonly gate: ((env: Env) => boolean) | null;
}

/** Ein Griff: was er setzt — und wo er steht (für die Tastatur). */
interface Handle {
  readonly shape: Shape;
  readonly place: Place;
  readonly scope: readonly [number, number] | null;
  readonly set: readonly { readonly name: string; readonly expr: Expr }[];
  readonly anchor: (env: Env) => readonly [number, number];
}

interface TapTarget {
  readonly set: readonly { readonly name: string; readonly expr: Expr }[];
  readonly shape: Shape;
  readonly scope: readonly [number, number] | null;
}

interface Planned {
  readonly id: number;
  readonly use: MotionUse;
  readonly shift: number;
}

/** Eine Spur: ihre Punkte (Welt), wann sie den nächsten nimmt, und wie. */
interface Trace {
  readonly k: number;
  readonly points: number[];
  next: number;
  readonly sample: (env: Env, clock: number) => boolean;
}

interface Built {
  readonly nodes: ReactNode[];
  readonly defs: ReactNode[];
  readonly insts: Inst[];
  readonly handles: Handle[];
  readonly taps: TapTarget[];
  readonly plan: Planned[];
  readonly traces: Trace[];
}

const round = (n: number): string => String(Math.round(n * 100) / 100);

/**
 * Ein Element schreiben — nur, was anders ist als beim letzten Mal. `null`
 * nimmt nur weg, was der Stift selbst gesetzt hat: was das Gerüst mitbringt
 * (`currentColor` einer Linie, eines Textes), bleibt.
 */
class Pen {
  private readonly last = new Map<string, string | null>();

  attr(el: Element, name: string, value: string | null): void {
    if (this.last.get(name) === value || (value === null && !this.last.has(name))) return;
    this.last.set(name, value);
    if (value === null) el.removeAttribute(name); else el.setAttribute(name, value);
  }

  style(el: SVGElement, name: string, value: string | null): void {
    const key = `s:${name}`;
    if (this.last.get(key) === value || (value === null && !this.last.has(key))) return;
    this.last.set(key, value);
    if (value === null) el.style.removeProperty(name); else el.style.setProperty(name, value);
  }

  text(el: Element, value: string): void {
    if (this.last.get('#text') === value) return;
    this.last.set('#text', value);
    el.textContent = value;
  }
}

/** Die Werte eines Teils: gerechnet, wo es einen Ausdruck hat, sonst wie es dasteht. */
interface Values {
  readonly num: (key: Exclude<Bindable, 'text' | 'fill' | 'stroke'>, env: Env) => number;
  readonly color: (key: 'fill' | 'stroke', env: Env) => string | null;
  readonly text: (env: Env) => string;
  readonly show: (env: Env) => boolean;
  readonly reads: ReadonlySet<string>;
}

class Builder {
  readonly insts: Inst[] = [];
  readonly handles: Handle[] = [];
  readonly taps: TapTarget[] = [];
  readonly plan: Planned[] = [];
  readonly defs: ReactNode[] = [];
  readonly traces: Trace[] = [];
  private shift = 0;
  private depth = 0;
  private gradients = 0;
  private clips = 0;
  private readonly values = new Map<Shape, Values>();
  /** Die `show` der umschliessenden Gruppen — solange eine falsch ist, ruht alles darin. */
  private readonly gates: { readonly show: (env: Env) => boolean; readonly reads: ReadonlySet<string> }[] = [];

  constructor(private readonly drawing: Drawing, private readonly program: Program, private readonly prefix: string, private readonly still: boolean) {}

  /** Eine Zahl oder ein Ausdruck (`Num`) als Rechnung. */
  private numFn(n: Num, where: string, extra: readonly string[] = []): { fn: (env: Env) => number; reads: readonly string[] } {
    if (typeof n === 'number') return { fn: () => n, reads: [] };
    const e = this.program.compile(n.expr, where, extra);
    return e === null ? { fn: () => 0, reads: [] } : { fn: (env) => toNum(e.run(env)), reads: e.reads };
  }

  private valuesOf(s: Shape): Values {
    const known = this.values.get(s);
    if (known !== undefined) return known;
    const reads = new Set<string>();
    const exprs: Partial<Record<Bindable, Expr>> = {};
    const where = `${s.type}${s.label === '' ? '' : ` „${s.label}"`}`;
    for (const [key, source] of Object.entries(s.bind ?? {})) {
      const e = key === 'text' ? this.program.compileText(source, `${where}.text`) : this.program.compile(source, `${where}.${key}`);
      if (e === null) continue;
      exprs[key as Bindable] = e;
      for (const r of e.reads) reads.add(r);
    }
    const showExpr = s.show === null ? null : this.program.compile(s.show, `${where}.show`);
    for (const r of showExpr?.reads ?? []) reads.add(r);
    const made: Values = {
      num: (key, env) => {
        const e = exprs[key];
        if (e === undefined) return s[key];
        const v = toNum(e.run(env));
        return Number.isFinite(v) ? v : NaN;
      },
      color: (key, env) => {
        const e = exprs[key];
        if (e === undefined) return s[key];
        return colorValue(String(e.run(env)));
      },
      text: (env) => (exprs.text === undefined ? s.text : String(exprs.text.run(env))),
      show: (env) => (showExpr === null ? true : truth(showExpr.run(env))),
      reads
    };
    this.values.set(s, made);
    return made;
  }

  private paintStyle(v: Values, pen: Pen, el: SVGElement, env: Env, filledByDefault: boolean): void {
    const fill = v.color('fill', env);
    if (fill !== null && fill.startsWith('radial(')) {
      /* Ein Schein steht fest (in `defs`) — er wird nicht gerechnet. */
    } else {
      pen.style(el, 'fill', fill === null ? (filledByDefault ? null : 'none') : paint(fill));
    }
    const stroke = v.color('stroke', env);
    pen.style(el, 'stroke', stroke === null ? null : paint(stroke));
    pen.attr(el, 'stroke-width', stroke === null ? null : round(Math.max(0, v.num('width', env))));
    const opacity = v.num('opacity', env);
    pen.attr(el, 'opacity', !Number.isFinite(opacity) || opacity >= 1 ? null : round(Math.max(0, opacity)));
  }

  /** Ein Schein als Füllung — in die `defs`, einmal. */
  private gradientFill(s: Shape): string | null {
    if (s.fill === null || !s.fill.startsWith('radial(') || (s.bind?.fill !== undefined)) return null;
    const r = radialOf(s.fill);
    if (r === null) return null;
    const id = `${this.prefix}-g${this.gradients}`;
    this.gradients += 1;
    const inner = { stopColor: paint(r.inner) } as CSSProperties;
    const outer = { stopColor: paint(r.outer) } as CSSProperties;
    this.defs.push(
      <radialGradient key={id} id={id} cx="50%" cy="50%" r="50%">
        <stop offset="0" style={inner} />
        <stop offset={`${r.stop}%`} style={outer} />
      </radialGradient>
    );
    return `url(#${id})`;
  }

  private add(reads: Iterable<string>, scope: readonly [number, number] | null, write: (el: SVGElement, env: Env) => void): number {
    const k = this.insts.length;
    const gates = this.gates.map((g) => g.show);
    const all = new Set(reads);
    for (const g of this.gates) for (const r of g.reads) all.add(r);
    this.insts.push({ k, reads: all, scope, write, gate: gates.length === 0 ? null : (env) => gates.every((show) => show(env)) });
    return k;
  }

  /** Die Teile einer Gruppe bauen — hinter ihrem `show`. */
  private inside(s: Shape, v: Values, build: () => ReactNode[]): ReactNode[] {
    if (s.show === null) return build();
    this.gates.push({ show: v.show, reads: v.reads });
    try { return build(); } finally { this.gates.pop(); }
  }

  build(): ReactNode[] {
    return this.list(this.drawing.elements, FREE, null, '');
  }

  private list(shapes: readonly Shape[], place: Place, scope: readonly [number, number] | null, key: string): ReactNode[] {
    const out: ReactNode[] = [];
    shapes.forEach((s, i) => {
      for (let r = 0; r < s.repeat; r += 1) {
        const own = s.repeat > 1 ? [r, s.repeat] as const : scope;
        out.push(this.shape(s, place, own, `${key}${i}${s.repeat > 1 ? `r${r}` : ''}`));
      }
    });
    return out;
  }

  private shape(s: Shape, place: Place, scope: readonly [number, number] | null, key: string): ReactNode {
    if (this.depth > DRAWING_LIMITS.depth) return null;
    const v = this.valuesOf(s);
    const reads = [...v.reads, ...place.reads];
    const moving = this.still ? [] : s.motion;
    const onSurface = moving.filter(touchesPaint);
    const around = moving.filter((m) => !touchesPaint(m));
    const surface = onSurface.map((use) => { const id = this.plan.length; this.plan.push({ id, use, shift: this.shift }); return id; });
    const dash = onSurface.map(dashOf).find((l): l is number => l !== null);
    const mo = surface.length === 0 ? {} : { 'data-mo': surface.join(' ') };
    const gradient = this.gradientFill(s);
    const filter = filterOf(s);
    /* Was an einem Teil fest bleibt (Ende einer Linie, Schein, Schatten, Strich zum Zeichnen) — einmal, im Gerüst. */
    const fixedStyle: CSSProperties = {
      ...(gradient === null ? {} : { fill: gradient }),
      ...(filter === undefined ? {} : { filter }),
      ...(dash === undefined ? {} : { strokeDasharray: dashArray(dash) }),
      ...(surface.length === 0 ? {} : originStyle(s.origin))
    };
    const lineEnds = { strokeLinecap: s.cap, strokeLinejoin: 'round' } as const;
    const lineStyle = { ...lineEnds, ...fixedStyle } as CSSProperties;
    let body: ReactNode;
    let anchor: (env: Env) => readonly [number, number] = (env) => place.at(env, v.num('x', env), v.num('y', env));
    let reach: (env: Env) => number = () => 0;

    switch (s.type) {
      case 'rect':
      case 'image': {
        const geo = (env: Env) => {
          const [X, Y] = place.at(env, v.num('x', env), v.num('y', env));
          const [sx, sy] = place.scale(env);
          const w = Math.max(0, v.num('w', env)) * sx;
          const h = Math.max(0, v.num('h', env)) * sy;
          return { x: X, y: place.world ? Y - h : Y, w, h };
        };
        const k = this.add(reads, scope, (el, env) => {
          const pen = penOf(el);
          const g = geo(env);
          pen.attr(el, 'x', round(g.x)); pen.attr(el, 'y', round(g.y));
          pen.attr(el, 'width', round(g.w)); pen.attr(el, 'height', round(g.h));
          if (s.type === 'rect') pen.attr(el, 'rx', s.r > 0 || s.bind?.r !== undefined ? round(Math.max(0, v.num('r', env))) : null);
          this.common(v, pen, el, env, false);
        });
        body = s.type === 'rect'
          ? <rect key={key} data-k={k} style={fixedStyle} {...mo} {...(dash === undefined ? {} : { pathLength: dash })} />
          : (s.url === null ? null : <image key={key} data-k={k} href={imageUrl(s.url)} preserveAspectRatio="xMidYMid meet" style={fixedStyle} {...mo} />);
        anchor = (env) => { const g = geo(env); return [g.x + g.w / 2, g.y + g.h / 2]; };
        reach = (env) => { const g = geo(env); return Math.min(g.w, g.h) / 2; };
        break;
      }
      case 'circle':
      case 'ellipse': {
        const k = this.add(reads, scope, (el, env) => {
          const pen = penOf(el);
          const [X, Y] = place.at(env, v.num('x', env), v.num('y', env));
          pen.attr(el, 'cx', round(X)); pen.attr(el, 'cy', round(Y));
          if (s.type === 'circle') pen.attr(el, 'r', round(Math.max(0, v.num('r', env))));
          else {
            const [sx, sy] = place.scale(env);
            pen.attr(el, 'rx', round(Math.max(0, v.num('w', env) / 2) * sx));
            pen.attr(el, 'ry', round(Math.max(0, v.num('h', env) / 2) * sy));
          }
          this.common(v, pen, el, env, false);
        });
        body = s.type === 'circle'
          ? <circle key={key} data-k={k} style={fixedStyle} {...mo} {...(dash === undefined ? {} : { pathLength: dash })} />
          : <ellipse key={key} data-k={k} style={fixedStyle} {...mo} {...(dash === undefined ? {} : { pathLength: dash })} />;
        reach = (env) => (s.type === 'circle' ? Math.max(0, v.num('r', env)) : Math.min(v.num('w', env), v.num('h', env)) / 2);
        break;
      }
      case 'line':
      case 'arrow': {
        const ends = (env: Env) => [place.at(env, v.num('x', env), v.num('y', env)), place.at(env, v.num('x2', env), v.num('y2', env))] as const;
        const inkLine = { stroke: 'currentColor', ...lineStyle } as CSSProperties;
        if (s.type === 'line') {
          const k = this.add(reads, scope, (el, env) => {
            const pen = penOf(el);
            const [[x1, y1], [x2, y2]] = ends(env);
            pen.attr(el, 'x1', round(x1)); pen.attr(el, 'y1', round(y1)); pen.attr(el, 'x2', round(x2)); pen.attr(el, 'y2', round(y2));
            this.common(v, pen, el, env, true);
          });
          body = <line key={key} data-k={k} style={inkLine} {...mo} {...(dash === undefined ? {} : { pathLength: dash })} />;
        } else {
          const k = this.add(reads, scope, (el, env) => {
            const pen = penOf(el);
            const shaft = el.firstElementChild as SVGElement | null;
            const tip = el.lastElementChild as SVGElement | null;
            if (shaft === null || tip === null) return;
            const [[x1, y1], [x2, y2]] = ends(env);
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.hypot(dx, dy);
            const head = Math.min(s.head, len * 0.6);
            const ux = len === 0 ? 0 : dx / len;
            const uy = len === 0 ? 0 : dy / len;
            const bx = x2 - ux * head;
            const by = y2 - uy * head;
            const visible = v.show(env) && len > 0.5 && Number.isFinite(len);
            pen.attr(el, 'display', visible ? null : 'none');
            const sp = penOf(shaft);
            sp.attr(shaft, 'x1', round(x1)); sp.attr(shaft, 'y1', round(y1));
            sp.attr(shaft, 'x2', round(x2 - ux * head * 0.7)); sp.attr(shaft, 'y2', round(y2 - uy * head * 0.7));
            const tp = penOf(tip);
            tp.attr(tip, 'd', `M${round(x2)} ${round(y2)} L${round(bx - uy * head * 0.45)} ${round(by + ux * head * 0.45)} L${round(bx + uy * head * 0.45)} ${round(by - ux * head * 0.45)} Z`);
            const stroke = v.color('stroke', env) ?? 'ink';
            sp.style(shaft, 'stroke', paint(stroke));
            sp.attr(shaft, 'stroke-width', round(Math.max(0, v.num('width', env))));
            tp.style(tip, 'fill', paint(stroke));
            const opacity = v.num('opacity', env);
            pen.attr(el, 'opacity', !Number.isFinite(opacity) || opacity >= 1 ? null : round(Math.max(0, opacity)));
          });
          body = (
            <g key={key} data-k={k} {...mo}>
              <line style={inkLine} />
              <path />
            </g>
          );
        }
        anchor = (env) => ends(env)[1];
        break;
      }
      case 'path': {
        if (s.d === null) return null;
        const k = this.add(reads, scope, (el, env) => this.common(v, penOf(el), el, env, false));
        body = <path key={key} data-k={k} d={s.d} style={lineStyle} {...mo} {...(dash === undefined ? {} : { pathLength: dash })} />;
        break;
      }
      case 'poly': {
        const pts = s.points.map(([a, b], i) => [this.numFn(a, `poly.points[${i}][0]`), this.numFn(b, `poly.points[${i}][1]`)] as const);
        const own = [...reads, ...pts.flatMap(([a, b]) => [...a.reads, ...b.reads])];
        const k = this.add(own, scope, (el, env) => {
          const pen = penOf(el);
          pen.attr(el, 'points', pts.map(([a, b]) => { const [X, Y] = place.at(env, a.fn(env), b.fn(env)); return `${round(X)},${round(Y)}`; }).join(' '));
          this.common(v, pen, el, env, false);
        });
        body = s.closed
          ? <polygon key={key} data-k={k} style={lineStyle} {...mo} />
          : <polyline key={key} data-k={k} style={lineStyle} {...mo} />;
        anchor = (env) => (pts.length === 0 ? place.at(env, 0, 0) : place.at(env, pts[0][0].fn(env), pts[0][1].fn(env)));
        break;
      }
      case 'plot': {
        const extra = [s.var];
        const fn = s.fn === null ? null : this.program.compile(s.fn, 'plot.fn', extra);
        const fx = s.fx === null ? null : this.program.compile(s.fx, 'plot.fx', extra);
        const fy = s.fy === null ? null : this.program.compile(s.fy, 'plot.fy', extra);
        const from = this.numFn(s.from, 'plot.from');
        const to = this.numFn(s.to, 'plot.to');
        const own = [...reads, ...from.reads, ...to.reads, ...[fn, fx, fy].flatMap((e) => (e === null ? [] : e.reads))].filter((r) => r !== s.var);
        const k = this.add(own, scope, (el, env) => {
          const pen = penOf(el);
          const a = from.fn(env);
          const b = to.fn(env);
          const was = env[s.var];
          let d = '';
          let open = false;
          for (let i = 0; i < s.samples; i += 1) {
            const u = a + ((b - a) * i) / (s.samples - 1);
            env[s.var] = u;
            const x = fx === null ? u : toNum(fx.run(env));
            const y = fn !== null ? toNum(fn.run(env)) : fy === null ? 0 : toNum(fy.run(env));
            if (!Number.isFinite(x) || !Number.isFinite(y)) { open = false; continue; }
            const [X, Y] = place.at(env, x, y);
            d += `${open ? 'L' : 'M'}${round(X)} ${round(Y)}`;
            open = true;
          }
          if (was === undefined) delete env[s.var]; else env[s.var] = was;
          pen.attr(el, 'd', d === '' ? null : d);
          this.common(v, pen, el, env, false);
        });
        body = <path key={key} data-k={k} style={lineStyle} {...mo} />;
        break;
      }
      case 'trace': {
        const fx = s.fx === null ? null : this.program.compile(s.fx, 'trace.fx');
        const fy = s.fy === null ? null : this.program.compile(s.fy, 'trace.fy');
        const points: number[] = [];
        const k = this.add([...reads, '#trace'], scope, (el, env) => {
          const pen = penOf(el);
          let d = '';
          for (let i = 0; i + 1 < points.length; i += 2) {
            const [X, Y] = place.at(env, points[i], points[i + 1]);
            d += `${i === 0 ? 'M' : 'L'}${round(X)} ${round(Y)}`;
          }
          pen.attr(el, 'd', d === '' ? null : d);
          this.common(v, pen, el, env, false);
        });
        if (fx !== null && fy !== null) {
          const trace: Trace = {
            k,
            points,
            next: 0,
            sample: (env, clock) => {
              if (clock + 1e-9 < trace.next) return false;
              trace.next = clock + s.every;
              const was = scope === null ? null : [env.i, env.n] as const;
              if (scope !== null) { env.i = scope[0]; env.n = scope[1]; }
              const x = toNum(fx.run(env));
              const y = toNum(fy.run(env));
              if (was !== null) { env.i = was[0]; env.n = was[1]; }
              if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
              points.push(x, y);
              /* Zu lang: das älteste Viertel auf einmal weg — nicht bei jedem Punkt einer. */
              if (points.length > s.keep * 2) points.splice(0, Math.max(2, Math.floor(s.keep / 4) * 2));
              return true;
            }
          };
          this.traces.push(trace);
        }
        body = <path key={key} data-k={k} style={lineStyle} {...mo} />;
        break;
      }
      case 'text': {
        const k = this.add(reads, scope, (el, env) => {
          const pen = penOf(el);
          const [X, Y] = place.at(env, v.num('x', env), v.num('y', env));
          pen.attr(el, 'x', round(X)); pen.attr(el, 'y', round(Y));
          pen.attr(el, 'font-size', round(Math.max(1, v.num('size', env))));
          pen.text(el, v.text(env));
          this.common(v, pen, el, env, true);
        });
        const inkText = { fill: 'currentColor', ...fixedStyle } as CSSProperties;
        body = <text key={key} data-k={k} fontWeight={s.weight} textAnchor={s.anchor} dominantBaseline="central" style={inkText} {...mo} />;
        reach = (env) => Math.max(1, v.num('size', env)) * 0.6;
        break;
      }
      case 'group':
      case 'use':
      case 'frame': {
        const inner = s.type === 'use' ? this.drawing.symbols.get(s.use ?? '') ?? [] : s.children;
        const before = this.shift;
        this.shift += s.shift;
        this.depth += 1;
        let kids: ReactNode[];
        if (s.type === 'frame' && !place.world && s.view !== null) {
          /* Ein Rahmen: das Rechteck x, y, w, h in der Zeichnung zeigt den Ausschnitt `view` der Welt. */
          const rect = { x: s.x, y: s.y, w: Math.max(1, s.w), h: Math.max(1, s.h) };
          const parts = s.view.map((n, i) => this.numFn(n, `frame.view[${i}]`));
          const viewReads = parts.flatMap((p) => p.reads);
          const view = (env: Env): View => [parts[0].fn(env), parts[1].fn(env), parts[2].fn(env), parts[3].fn(env)];
          const inside = framePlace(rect, view, viewReads);
          kids = this.inside(s, v, () => this.list(inner, inside, scope, `${key}.`));
          let clip: string | null = null;
          if (s.clip) {
            clip = `${this.prefix}-c${this.clips}`;
            this.clips += 1;
            this.defs.push(<clipPath key={clip} id={clip}><rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} /></clipPath>);
          }
          const axes = s.axes;
          const k = this.add([...reads, ...viewReads], scope, (el, env) => {
            const pen = penOf(el);
            pen.attr(el, 'display', v.show(env) ? null : 'none');
            if (axes !== null) {
              const box = el.firstElementChild as SVGGElement | null;
              if (box !== null) drawAxes(box, rect, view(env), axes, pen);
            }
          });
          body = (
            <g key={key} data-k={k} {...mo}>
              {axes !== null && <g className="lv-axes" aria-hidden="true" />}
              <g {...(clip === null ? {} : { clipPath: `url(#${clip})` })}>{kids}</g>
            </g>
          );
          anchor = () => [rect.x + rect.w / 2, rect.y + rect.h / 2];
        } else if (place.world) {
          /* In der Welt: eine Gruppe verschiebt ihre Teile um x, y (Welt) und dreht sie um diesen Punkt (gegen den Uhrzeiger, wie in der Mathematik). */
          const inside = offsetPlace(place, (env) => v.num('x', env), (env) => v.num('y', env), [...v.reads]);
          kids = this.inside(s, v, () => this.list(inner, inside, scope, `${key}.`));
          const k = this.add(reads, scope, (el, env) => {
            const pen = penOf(el);
            const [X, Y] = place.at(env, v.num('x', env), v.num('y', env));
            const turn = v.num('rotate', env);
            const scale = v.num('scale', env);
            pen.attr(el, 'transform', turn === 0 && scale === 1 ? null
              : `translate(${round(X)} ${round(Y)})${turn === 0 ? '' : ` rotate(${round(-turn)})`}${scale === 1 ? '' : ` scale(${round(scale)})`} translate(${round(-X)} ${round(-Y)})`);
            this.common(v, pen, el, env, true);
          });
          body = <g key={key} data-k={k} style={fixedStyle} {...mo}>{kids}</g>;
        } else {
          kids = this.inside(s, v, () => this.list(inner, place, scope, `${key}.`));
          const k = this.add(reads, scope, (el, env) => {
            const pen = penOf(el);
            const x = v.num('x', env);
            const y = v.num('y', env);
            const turn = v.num('rotate', env);
            const scale = v.num('scale', env);
            pen.attr(el, 'transform', x === 0 && y === 0 && turn === 0 && scale === 1 ? null
              : `translate(${round(x)} ${round(y)})${turn === 0 ? '' : ` rotate(${round(turn)})`}${scale === 1 ? '' : ` scale(${round(scale)})`}`);
            this.common(v, pen, el, env, true);
          });
          body = <g key={key} data-k={k} style={fixedStyle} {...mo}>{kids}</g>;
        }
        this.depth -= 1;
        this.shift = before;
        break;
      }
      default:
        return null;
    }

    /* Die Rahmen der Bewegungen um das Teil — der äussere zuerst. */
    for (let i = around.length - 1; i >= 0; i -= 1) {
      const id = this.plan.length;
      this.plan.push({ id, use: around[i], shift: this.shift });
      body = <g key={`${key}~${i}`} data-mo={id} style={originStyle(s.origin)}>{body}</g>;
    }

    /* Ein Griff oder ein Knopf im Bild: fokussierbar, mit dem Finger zu treffen. */
    if (!this.still && (s.drag !== null || s.tap !== null)) {
      const label = s.label || s.drag?.label || s.tap?.label || (s.drag !== null ? 'Uchwyt — przeciągnij' : 'Przycisk');
      const ring = this.add([...reads, ...v.reads], scope, (el, env) => {
        const pen = penOf(el);
        const [X, Y] = anchor(env);
        pen.attr(el, 'cx', round(X)); pen.attr(el, 'cy', round(Y));
        /* Ein Kreis mit r = 0 wird nicht gezeichnet — und sein Ring von 44 px fängt dann keinen Finger: mindestens ein halbes Mass. */
        pen.attr(el, 'r', round(Math.max(0.5, reach(env))));
        pen.attr(el, 'display', v.show(env) ? null : 'none');
      });
      if (s.drag !== null) {
        const set = this.program.prepare({
          ...(s.drag.x === null ? {} : { [s.drag.x]: 'px' }),
          ...(s.drag.y === null ? {} : { [s.drag.y]: 'py' }),
          ...s.drag.set
        }, 'drag');
        const h = this.handles.length;
        const at = anchor;
        this.handles.push({ shape: s, place, scope, set, anchor: (env) => { const [X, Y] = at(env); return place.back(env, X, Y); } });
        const single = s.drag.x !== null && s.drag.y === null ? s.drag.x : s.drag.y !== null && s.drag.x === null ? s.drag.y : null;
        return (
          <g key={`${key}#`} className="lv-grab" data-drag={h} data-pz-hold="" tabIndex={0} role={single === null ? 'application' : 'slider'} aria-label={label}
            {...(single === null ? {} : { 'data-var': single })}>
            {body}
            <circle className="lv-hit" data-k={ring} />
          </g>
        );
      }
      const t = this.taps.length;
      this.taps.push({ set: this.program.prepare(s.tap!.set, 'tap.set'), shape: s, scope });
      return (
        <g key={`${key}#`} className="lv-tap" data-tap={t} tabIndex={0} role="button" aria-label={label}>
          {body}
          <circle className="lv-hit" data-k={ring} />
        </g>
      );
    }
    return body;
  }

  /** Was jedes Teil hat: zu sehen oder nicht, Farbe, Linie, Deckkraft. */
  private common(v: Values, pen: Pen, el: SVGElement, env: Env, filledByDefault: boolean): void {
    pen.attr(el, 'display', v.show(env) ? null : 'none');
    this.paintStyle(v, pen, el, env, filledByDefault);
  }
}

/* Je Element sein Stift — damit nur geschrieben wird, was sich geändert hat. */
const PENS = new WeakMap<Element, Pen>();
function penOf(el: Element): Pen {
  let pen = PENS.get(el);
  if (pen === undefined) { pen = new Pen(); PENS.set(el, pen); }
  return pen;
}

/* -- Achsen eines Rahmens ---------------------------------------------------------------------- */

/** Ein schöner Abstand der Striche: 1, 2 oder 5 mal eine Zehnerpotenz, etwa fünf bis acht auf der Achse. */
function niceStep(span: number): number {
  const raw = Math.abs(span) / 6 || 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

const SVG = 'http://www.w3.org/2000/svg';

function svgEl(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG, tag);
  for (const [k, value] of Object.entries(attrs)) el.setAttribute(k, value);
  return el;
}

/** Die Achsen neu zeichnen — nur, wenn sich der Ausschnitt geändert hat. */
function drawAxes(box: SVGGElement, rect: { x: number; y: number; w: number; h: number }, v: View, axes: { x: string; y: string; grid: boolean }, pen: Pen): void {
  const key = v.map((n) => round(n)).join(',');
  if ((box as unknown as { dataset: DOMStringMap }).dataset.view === key) return;
  (box as unknown as { dataset: DOMStringMap }).dataset.view = key;
  void pen;
  while (box.firstChild !== null) box.removeChild(box.firstChild);
  const sx = rect.w / (v[2] - v[0] || 1);
  const sy = rect.h / (v[3] - v[1] || 1);
  const X = (x: number) => rect.x + (x - v[0]) * sx;
  const Y = (y: number) => rect.y + rect.h - (y - v[1]) * sy;
  const x0 = v[0] <= 0 && v[2] >= 0 ? 0 : v[0];
  const y0 = v[1] <= 0 && v[3] >= 0 ? 0 : v[1];
  const fontSize = String(Math.max(8, Math.min(14, rect.h / 22)));
  const sxStep = niceStep(v[2] - v[0]);
  const syStep = niceStep(v[3] - v[1]);
  const digits = (step: number) => Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  for (let x = Math.ceil(v[0] / sxStep) * sxStep; x <= v[2] + 1e-9; x += sxStep) {
    if (axes.grid) box.appendChild(svgEl('line', { x1: round(X(x)), y1: round(rect.y), x2: round(X(x)), y2: round(rect.y + rect.h), class: 'lv-grid' }));
    box.appendChild(svgEl('line', { x1: round(X(x)), y1: round(Y(y0)), x2: round(X(x)), y2: round(Y(y0) + 4), class: 'lv-tick' }));
    if (Math.abs(x) > sxStep / 1e6 || x0 !== 0) {
      const label = svgEl('text', { x: round(X(x)), y: round(Y(y0) + 6), 'font-size': fontSize, 'text-anchor': 'middle', 'dominant-baseline': 'hanging', class: 'lv-label' });
      label.textContent = fmt(x, digits(sxStep));
      box.appendChild(label);
    }
  }
  for (let y = Math.ceil(v[1] / syStep) * syStep; y <= v[3] + 1e-9; y += syStep) {
    if (axes.grid) box.appendChild(svgEl('line', { x1: round(rect.x), y1: round(Y(y)), x2: round(rect.x + rect.w), y2: round(Y(y)), class: 'lv-grid' }));
    box.appendChild(svgEl('line', { x1: round(X(x0) - 4), y1: round(Y(y)), x2: round(X(x0)), y2: round(Y(y)), class: 'lv-tick' }));
    if (Math.abs(y) > syStep / 1e6 || y0 !== 0) {
      const label = svgEl('text', { x: round(X(x0) - 6), y: round(Y(y)), 'font-size': fontSize, 'text-anchor': 'end', 'dominant-baseline': 'central', class: 'lv-label' });
      label.textContent = fmt(y, digits(syStep));
      box.appendChild(label);
    }
  }
  box.appendChild(svgEl('line', { x1: round(rect.x), y1: round(Y(y0)), x2: round(rect.x + rect.w), y2: round(Y(y0)), class: 'lv-axis' }));
  box.appendChild(svgEl('line', { x1: round(X(x0)), y1: round(rect.y), x2: round(X(x0)), y2: round(rect.y + rect.h), class: 'lv-axis' }));
  if (axes.x !== '') {
    const t = svgEl('text', { x: round(rect.x + rect.w), y: round(Y(y0) - 6), 'font-size': fontSize, 'text-anchor': 'end', class: 'lv-label is-title' });
    t.textContent = axes.x;
    box.appendChild(t);
  }
  if (axes.y !== '') {
    const t = svgEl('text', { x: round(X(x0) + 6), y: round(rect.y + 2), 'font-size': fontSize, 'text-anchor': 'start', 'dominant-baseline': 'hanging', class: 'lv-label is-title' });
    t.textContent = axes.y;
    box.appendChild(t);
  }
}

/* -- Die Bedienung ------------------------------------------------------------------------------- */

/** Wie viele Stellen eine Zahl braucht — aus dem Schritt ihres Werts. */
function digitsOf(spec: VarSpec | undefined, given: number | null): number {
  if (given !== null) return given;
  const step = spec?.step ?? null;
  if (step === null) return 2;
  return Math.max(0, Math.min(4, Math.ceil(-Math.log10(step) - 1e-9)));
}

/** Eine Zahl mit ihrer Einheit — Grad und Prozent ohne Abstand, wie im Polnischen. */
export function withUnit(value: number, digits: number, unit: string): string {
  const n = fmt(value, digits);
  if (unit === '') return n;
  return /^[°%′″]/.test(unit) ? `${n}${unit}` : `${n} ${unit}`;
}

function rangeOf(spec: VarSpec | undefined): { min: number; max: number; step: number } {
  const value = spec?.value ?? 0;
  const min = spec?.min ?? Math.min(0, value - Math.max(1, Math.abs(value)));
  const max = spec?.max ?? Math.max(min + 1, value + Math.max(1, Math.abs(value)));
  return { min, max, step: spec?.step ?? (max - min) / 100 };
}

function ControlView({ c, i, program, onSet, onPress, locked }: {
  c: ControlSpec;
  i: number;
  program: Program;
  onSet: (name: string, value: number) => void;
  onPress: (index: number) => void;
  locked: boolean;
}) {
  switch (c.type) {
    case 'slider': {
      const spec = program.varOf(c.var);
      const r = rangeOf(spec);
      const label = c.label || spec?.label || c.var;
      return (
        <label className="lv-control lv-slider" data-c={i}>
          <span className="lv-name">{label}</span>
          <output className="lv-value" />
          <input type="range" min={r.min} max={r.max} step={r.step} defaultValue={program.value(c.var)} disabled={locked}
            onInput={(e) => onSet(c.var, e.currentTarget.valueAsNumber)} onChange={(e) => onSet(c.var, e.currentTarget.valueAsNumber)} />
        </label>
      );
    }
    case 'number': {
      const spec = program.varOf(c.var);
      const r = rangeOf(spec);
      return (
        <label className="lv-control lv-number" data-c={i}>
          <span className="lv-name">{c.label || spec?.label || c.var}</span>
          <span className="lv-number-row">
            <input type="number" inputMode="decimal" min={spec?.min ?? undefined} max={spec?.max ?? undefined} step={r.step} defaultValue={program.value(c.var)} disabled={locked}
              onChange={(e) => { const n = toNum(e.currentTarget.value); if (Number.isFinite(n)) onSet(c.var, n); }} />
            {(c.unit || spec?.unit) && <span className="lv-unit">{c.unit || spec?.unit}</span>}
          </span>
        </label>
      );
    }
    case 'toggle': {
      const spec = program.varOf(c.var);
      return (
        <label className="lv-control lv-toggle" data-c={i}>
          <input type="checkbox" defaultChecked={truth(program.value(c.var))} disabled={locked} onChange={(e) => onSet(c.var, e.currentTarget.checked ? 1 : 0)} />
          <span>{c.label || spec?.label || c.var}</span>
        </label>
      );
    }
    case 'choice': {
      const spec = program.varOf(c.var);
      const label = c.label || spec?.label || c.var;
      return (
        <div className="lv-control lv-choice" data-c={i} role="group" aria-label={label}>
          <span className="lv-name">{label}</span>
          <span className="lv-choice-row">
            {c.options.map((o, n) => (
              <button key={n} type="button" aria-pressed={program.value(c.var) === o.value} disabled={locked} onClick={() => onSet(c.var, o.value)}>{o.label}</button>
            ))}
          </span>
        </div>
      );
    }
    case 'button':
      return (
        <button type="button" className={`wk-btn${c.do === 'reset' ? ' wk-btn-line' : ''} lv-control lv-button`} data-c={i} disabled={locked} onClick={() => onPress(i)}>
          {c.label}
        </button>
      );
    case 'readout':
      return (
        <div className="lv-control lv-readout" data-c={i}>
          <span className="lv-name">{c.label}</span>
          <output className="lv-value" />
        </div>
      );
  }
}

/* -- Das Bild ---------------------------------------------------------------------------------------- */

/** Ein Zufall aus einem Samen (mulberry32) — dasselbe Bild für denselben Samen. */
export function seeded(seed: string): () => number {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i += 1) a = Math.imul(a ^ seed.charCodeAt(i), 16777619) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LiveDrawingProps {
  readonly drawing: Drawing;
  readonly identity: string;
  /** Ohne Bewegung, ohne Bedienung (im Streifen, als Vorschau). */
  readonly still?: boolean;
  readonly className?: string;
  /** Werte, die feststehen (Cogita: der gezogene Zufall; die Antwort, die gezeigt wird). */
  readonly fixed?: Readonly<Record<string, number>> | null;
  /** Der Same für `random` — sonst jedes Mal anders. */
  readonly seed?: string | null;
  /** Das Programm für den, der es braucht (Cogita liest daraus die Antwort). */
  readonly onProgram?: (program: Program) => void;
  /** Fehler in den Ausdrücken — für den Editor. */
  readonly onProblems?: (problems: Program['problems']) => void;
  /** Gleich loslaufen (Cogita zeigt nach der Antwort, was geschah). */
  readonly start?: boolean;
  /** Nur ansehen: die Bedienung steht still. */
  readonly locked?: boolean;
}

export function LiveDrawing({ drawing, identity, still = false, className, fixed = null, seed = null, onProgram, onProblems, start = false, locked = false }: LiveDrawingProps) {
  const svg = useRef<SVGSVGElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);
  const say = useRef<HTMLParagraphElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const phase = usePhase(svg);
  const reduced = useReducedMotion();
  const clock = useContext(ShowClock);
  const prefix = `lv${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const fixedKey = fixed === null ? '' : JSON.stringify(fixed);

  const program = useMemo(
    () => new Program(drawing.live, { fixed: fixed ?? undefined, random: seed === null ? undefined : seeded(seed) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [identity, fixedKey, seed]
  );
  const built = useMemo<Built>(() => {
    const b = new Builder(drawing, program, prefix, still);
    const nodes = b.build();
    return { nodes, defs: b.defs, insts: b.insts, handles: b.handles, taps: b.taps, plan: b.plan, traces: b.traces };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, prefix, still]);

  useMotionPlan(svg, built.plan, still || reduced, phase);

  /** Die Schleife und ihre Hebel — gebaut nach dem Gerüst, gehalten über die Bilder. */
  const engine = useRef<{ wake: () => void; visible: (on: boolean) => void; input: (name: string, value: number) => void; press: (i: number) => void } | null>(null);

  useLayoutEffect(() => {
    const root = svg.current;
    if (root === null) return undefined;
    const els = new Map<number, SVGElement>();
    root.querySelectorAll<SVGElement>('[data-k]').forEach((el) => els.set(Number(el.dataset.k), el));
    const env = program.env;
    const controls = panel.current;
    const ctrlEls = new Map<number, HTMLElement>();
    controls?.querySelectorAll<HTMLElement>('[data-c]').forEach((el) => ctrlEls.set(Number(el.dataset.c), el));
    const readouts = program.controlValues;
    const buttons = program.controlSets;

    const writeInst = (inst: Inst) => {
      const el = els.get(inst.k);
      if (el === undefined) return;
      if (inst.gate !== null && !inst.gate(env)) return;
      if (inst.scope === null) { inst.write(el, env); return; }
      const was = [env.i, env.n] as const;
      env.i = inst.scope[0];
      env.n = inst.scope[1];
      inst.write(el, env);
      env.i = was[0];
      env.n = was[1];
    };

    let lastStatus: string | null = null;
    let lastSaid: Said | null = null;
    let lastGoal = false;

    const syncControls = (changed: ReadonlySet<string> | null) => {
      const statusChanged = program.status !== lastStatus;
      lastStatus = program.status;
      program.controls.forEach((c, i) => {
        const el = ctrlEls.get(i);
        if (el === undefined) return;
        if ('var' in c && changed !== null && !changed.has(c.var) && c.type !== 'choice') return;
        switch (c.type) {
          case 'slider': {
            const spec = program.varOf(c.var);
            const value = program.value(c.var);
            const input = el.querySelector('input');
            if (input !== null && input.valueAsNumber !== value && document.activeElement !== input) input.value = String(value);
            const out = el.querySelector('output');
            const text = withUnit(value, digitsOf(spec, c.digits), c.unit || spec?.unit || '');
            if (out !== null && out.textContent !== text) out.textContent = text;
            if (input !== null) input.setAttribute('aria-valuetext', text);
            return;
          }
          case 'number': {
            const input = el.querySelector('input');
            const value = program.value(c.var);
            if (input !== null && document.activeElement !== input && toNum(input.value) !== value) input.value = String(value);
            return;
          }
          case 'toggle': {
            const input = el.querySelector('input');
            if (input !== null) input.checked = truth(program.value(c.var));
            return;
          }
          case 'choice': {
            if (changed !== null && !changed.has(c.var)) return;
            const value = program.value(c.var);
            el.querySelectorAll('button').forEach((b, n) => b.setAttribute('aria-pressed', String(c.options[n]?.value === value)));
            return;
          }
          case 'button': {
            if (!statusChanged && changed !== null) return;
            const running = program.status === 'running';
            if (c.do === 'toggle') {
              el.textContent = running ? 'Pauza' : (program.status === 'paused' ? 'Dalej' : c.label);
              el.setAttribute('aria-pressed', String(running));
            }
            if (c.do === 'run') el.toggleAttribute('data-on', running);
            return;
          }
          case 'readout': {
            const e = readouts[i];
            if (e === null) return;
            if (changed !== null && !e.reads.some((r) => changed.has(r))) return;
            const raw = e.run(env);
            const text = typeof raw === 'string' ? raw : withUnit(raw, c.digits ?? 2, c.unit);
            const out = el.querySelector('output');
            if (out !== null && out.textContent !== text) out.textContent = text;
            return;
          }
        }
      });
    };

    const singles = [...root.querySelectorAll<SVGGElement>('[data-var]')];
    const syncHandles = (changed: ReadonlySet<string> | null) => {
      singles.forEach((g) => {
        const name = g.dataset.var ?? '';
        if (changed !== null && !changed.has(name)) return;
        const spec = program.varOf(name);
        const value = program.value(name);
        g.setAttribute('aria-valuenow', String(Math.round(value * 1000) / 1000));
        g.setAttribute('aria-valuetext', withUnit(value, digitsOf(spec, null), spec?.unit ?? ''));
        if (spec?.min != null) g.setAttribute('aria-valuemin', String(spec.min));
        if (spec?.max != null) g.setAttribute('aria-valuemax', String(spec.max));
      });
    };

    const syncSaid = () => {
      const now = program.said();
      if (now !== lastSaid) {
        lastSaid = now;
        const p = say.current;
        if (p !== null) {
          p.textContent = now?.text ?? '';
          p.hidden = now === null || now.text === '';
          p.dataset.mood = now?.mood ?? 'info';
        }
      }
      const goal = program.goalReached();
      if (goal !== lastGoal) {
        lastGoal = goal;
        box.current?.classList.toggle('is-solved', goal);
      }
      for (const target of program.takeGos()) clock?.go(target);
    };

    /* Die Spuren: nach jedem Schritt der Simulation (oder ohne sie: nach der Uhr) ein Punkt. */
    let traced = false;
    const offs = built.traces.map((trace) => program.onSample(
      (e) => { if (trace.sample(e, toNum(e.t))) traced = true; },
      () => { trace.points.length = 0; trace.next = 0; traced = true; }
    ));

    /* Alles einmal schreiben — vor dem ersten Bild (Layout-Effekt). */
    program.settle();
    for (const inst of built.insts) writeInst(inst);
    program.takeChanged();
    syncControls(null);
    syncHandles(null);
    syncSaid();
    onProgram?.(program);

    let raf = 0;
    let last = 0;
    let visible = true;
    let dragging: { readonly h: number; readonly pointer: number } | null = null;
    const ticking = !still && !reduced;

    const frame = (now: number) => {
      raf = 0;
      if (!visible) { last = 0; return; }
      /* Höchstens 60 Bilder in der Sekunde — ein Schirm mit 120 Hz zeichnet dasselbe Bild zweimal, statt doppelt zu rechnen. */
      if (last !== 0 && now - last < 15 && dragging === null) { raf = requestAnimationFrame(frame); return; }
      const dt = last === 0 ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      program.advance(dt, ticking);
      if (built.traces.length > 0 && program.sim === null && program.usesTime) {
        for (const trace of built.traces) if (trace.sample(env, toNum(env.time))) traced = true;
      }
      program.settle();
      paint();
      if (program.busy(ticking) || dragging !== null) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    const paint = () => {
      const changed = program.takeChanged();
      if (traced) { changed.add('#trace'); traced = false; }
      if (changed.size > 0) {
        for (const inst of built.insts) {
          for (const r of inst.reads) {
            if (changed.has(r)) { writeInst(inst); break; }
          }
        }
      }
      syncControls(changed);
      syncHandles(changed);
      syncSaid();
    };

    const wake = () => {
      if (still) { program.settle(); paint(); return; }
      if (raf === 0) raf = requestAnimationFrame(frame);
    };

    const input = (name: string, value: number) => {
      if (program.set(name, value)) { program.settle(); paint(); wake(); }
    };

    const press = (i: number) => {
      const c = program.controls[i];
      if (c === undefined || c.type !== 'button') return;
      program.press(buttons[i], c.do, c.go);
      paint();
      wake();
    };

    /* -- Ziehen und Antippen --------------------------------------------------------------------- */

    const toLocal = (el: Element, x: number, y: number): readonly [number, number] | null => {
      const parent = (el.parentNode ?? el) as SVGGraphicsElement;
      const m = typeof parent.getScreenCTM === 'function' ? parent.getScreenCTM() : null;
      if (m === null) return null;
      const p = new DOMPoint(x, y).matrixTransform(m.inverse());
      return [p.x, p.y];
    };

    const dragTo = (h: number, local: readonly [number, number]) => {
      const handle = built.handles[h];
      if (handle === undefined) return;
      const was = handle.scope === null ? null : [env.i, env.n] as const;
      if (handle.scope !== null) { env.i = handle.scope[0]; env.n = handle.scope[1]; }
      const [wx, wy] = handle.place.back(env, local[0], local[1]);
      program.set('px', wx);
      program.set('py', wy);
      const values = handle.set.map((a) => toNum(a.expr.run(env)));
      if (was !== null) { env.i = was[0]; env.n = was[1]; }
      handle.set.forEach((a, i) => program.set(a.name, values[i]));
      program.settle();
      paint();
    };

    const grabOf = (target: EventTarget | null): SVGGElement | null =>
      target instanceof Element ? target.closest<SVGGElement>('[data-drag]') : null;

    const onDown = (event: PointerEvent) => {
      if (locked || event.button > 0) return;
      const grab = grabOf(event.target);
      if (grab === null) return;
      event.preventDefault();
      const h = Number(grab.dataset.drag);
      dragging = { h, pointer: event.pointerId };
      root.setPointerCapture?.(event.pointerId);
      grab.classList.add('is-held');
      const local = toLocal(grab.firstElementChild ?? grab, event.clientX, event.clientY);
      if (local !== null) dragTo(h, local);
      wake();
    };

    const onMove = (event: PointerEvent) => {
      if (dragging === null || event.pointerId !== dragging.pointer) return;
      event.preventDefault();
      const grab = root.querySelector(`[data-drag="${dragging.h}"]`);
      if (grab === null) return;
      const local = toLocal(grab.firstElementChild ?? grab, event.clientX, event.clientY);
      if (local !== null) dragTo(dragging.h, local);
    };

    const onUp = (event: PointerEvent) => {
      if (dragging === null || event.pointerId !== dragging.pointer) return;
      root.querySelector(`[data-drag="${dragging.h}"]`)?.classList.remove('is-held');
      dragging = null;
      root.releasePointerCapture?.(event.pointerId);
      wake();
    };

    const tapOf = (target: EventTarget | null): SVGGElement | null =>
      target instanceof Element ? target.closest<SVGGElement>('[data-tap]') : null;

    const runTap = (el: SVGGElement) => {
      const tap = built.taps[Number(el.dataset.tap)];
      if (tap === undefined || tap.shape.tap === null) return;
      const was = tap.scope === null ? null : [env.i, env.n] as const;
      if (tap.scope !== null) { env.i = tap.scope[0]; env.n = tap.scope[1]; }
      program.press(tap.set, tap.shape.tap.do, tap.shape.tap.go);
      if (was !== null) { env.i = was[0]; env.n = was[1]; }
      paint();
      wake();
    };

    const onClick = (event: MouseEvent) => {
      if (locked) return;
      const el = tapOf(event.target);
      if (el !== null) { event.preventDefault(); runTap(el); }
    };

    /** Mit der Tastatur: Pfeile bewegen einen Griff, Eingabe und Leertaste drücken einen Knopf im Bild. */
    const onKey = (event: KeyboardEvent) => {
      if (locked) return;
      const tap = tapOf(event.target);
      if (tap !== null && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        event.stopPropagation();
        runTap(tap);
        return;
      }
      const grab = grabOf(event.target);
      if (grab === null || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      const handle = built.handles[Number(grab.dataset.drag)];
      if (handle === undefined) return;
      const single = grab.dataset.var;
      if (single !== undefined) {
        const spec = program.varOf(single);
        const r = rangeOf(spec);
        const up = event.key === 'ArrowRight' || event.key === 'ArrowUp';
        const next = event.key === 'Home' ? r.min : event.key === 'End' ? r.max : program.value(single) + (up ? 1 : -1) * r.step * (event.shiftKey ? 10 : 1);
        input(single, next);
        return;
      }
      /* Ein Griff mit Rechnungen: der Finger einen kleinen Schritt weiter, von dort, wo der Griff steht. */
      const [wx, wy] = handle.anchor(env);
      const [sx, sy] = handle.place.scale(env);
      const unitX = handle.place.world ? 12 / sx : 4;
      const unitY = handle.place.world ? 12 / sy : 4;
      const dx = event.key === 'ArrowRight' ? unitX : event.key === 'ArrowLeft' ? -unitX : 0;
      const dy = event.key === 'ArrowUp' ? (handle.place.world ? unitY : -unitY) : event.key === 'ArrowDown' ? (handle.place.world ? -unitY : unitY) : 0;
      dragTo(Number(grab.dataset.drag), handle.place.at(env, wx + dx, wy + dy));
      wake();
    };

    if (!still) {
      root.addEventListener('pointerdown', onDown);
      root.addEventListener('pointermove', onMove);
      root.addEventListener('pointerup', onUp);
      root.addEventListener('pointercancel', onUp);
      root.addEventListener('click', onClick);
      root.addEventListener('keydown', onKey);
    }

    /* In einer Präsentation: die Stelle in der Szene als `step`. */
    const offClock = clock === null ? () => undefined : clock.subscribe(() => {
      if (program.set('step', clock.step())) { program.settle(); paint(); wake(); }
    });
    if (clock !== null) program.set('step', clock.step());

    engine.current = {
      wake,
      visible: (on) => {
        visible = on;
        if (on) {
          if (ticking && program.sim?.auto === true && program.status === 'ready') program.act('run');
          if (start && program.status === 'ready') program.act('run');
          last = 0;
          wake();
        }
      },
      input,
      press
    };
    if (start && program.status === 'ready' && program.sim !== null) { program.act('run'); }
    wake();

    return () => {
      if (raf !== 0) cancelAnimationFrame(raf);
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      offClock();
      for (const off of offs) off();
      engine.current = null;
    };
  }, [built, program, still, reduced, clock, locked, start, onProgram]);

  useEffect(() => { engine.current?.visible(phase !== 'away'); }, [phase, built]);

  useEffect(() => { onProblems?.(program.problems); }, [program, built, onProblems]);

  const sized = (drawing.max === null ? undefined : { '--an-max': `${drawing.max}rem` }) as CSSProperties | undefined;
  const showPanel = !still && (program.controls.length > 0 || program.hasGoal() || drawing.live?.rules.some((r) => r.say !== '') === true || drawing.live?.sim?.events.some((e) => e.say !== '') === true);

  return (
    <div ref={box} className={`lv${program.panel === 'side' ? ' is-side' : ''}${className === undefined ? '' : ` ${className}`}`} style={sized}>
      <div className="lv-in">
        <svg ref={svg} className="lv-stage" viewBox={`0 0 ${drawing.w} ${drawing.h}`} role={drawing.alt === '' ? 'group' : 'img'}
          aria-label={drawing.alt === '' ? undefined : drawing.alt}>
          {built.defs.length > 0 && <defs>{built.defs}</defs>}
          {built.nodes}
        </svg>
        {showPanel && (
          <div ref={panel} className="lv-panel" data-pz-hold="">
            {program.controls.length > 0 && (
              <div className="lv-controls">
                {program.controls.map((c, i) => (
                  <ControlView key={i} c={c} i={i} program={program} locked={locked}
                    onSet={(name, value) => engine.current?.input(name, value)} onPress={(n) => engine.current?.press(n)} />
                ))}
              </div>
            )}
            <p ref={say} className="lv-say" role="status" aria-live="polite" hidden />
          </div>
        )}
      </div>
    </div>
  );
}

export default LiveDrawing;
