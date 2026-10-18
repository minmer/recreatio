/**
 * 2026-10-17 — DAS GERÜST DES BILDES ZUM ANFASSEN (`LiveDrawing.tsx` lässt es
 * laufen): jedes Teil wird einmal ein SVG-Element mit `data-k` und eine
 * Rechnung, die es schreibt — nur, was sich geändert hat.
 *
 * <b>In einem Rahmen (`frame`) ist die Welt</b>: Meter statt Pixel, y nach
 * oben. Die Lage jedes Teils wird umgerechnet, seine Grösse (ein Radius, eine
 * Strichstärke, eine Schrift) bleibt in Einheiten der Zeichnung — ein Ball
 * bleibt rund, eine Pfeilspitze gleich gross, ein Text aufrecht. Ein Rahmen
 * mit `camera` lässt sich zoomen und verschieben; sein `view` ist dann, was
 * „Dopasuj" zeigt.
 *
 * <b>2026-10-18 — die Dinge einer Welt</b> (`{ "type": "world" }`): je Ding
 * die Teile seiner Art, gerechnet in seiner Umgebung (`x` ist SEIN `x`), in
 * einer Gruppe mit `data-thing`, die man wählt, zieht, antippt. Eltern vor
 * Kindern — ein Gewicht liegt über der Belke, an der es hängt. Ändert sich
 * der Bau (ein Ding mehr oder weniger), wird das Gerüst neu gebaut; ändern
 * sich nur Werte, schreibt die Schleife.
 */

import type { CSSProperties, ReactNode } from 'react';

import { fmt, toNum, truth, type Env, type Expr } from './expr';
import { DRAWING_LIMITS, radialOf, type Bindable, type Drawing, type Shape } from './drawing';
import { colorValue, dashArray, dashOf, paint, touchesPaint, type MotionUse } from './motion';
import { filterOf, originStyle } from './DrawingView';
import type { Program } from './liveRun';
import type { Num } from './liveModel';
import type { Thing } from './liveThings';
import { imageUrl } from '../slides/slideLook';

/* -- Wo ein Teil steht: frei (Einheiten der Zeichnung) oder in einem Rahmen (Welt) ------------- */

export type View = readonly [number, number, number, number];

export interface Place {
  readonly world: boolean;
  readonly reads: readonly string[];
  readonly at: (env: Env, x: number, y: number) => readonly [number, number];
  readonly back: (env: Env, x: number, y: number) => readonly [number, number];
  /** Wie lang eine Einheit der Welt in der Zeichnung ist (waagrecht, senkrecht). */
  readonly scale: (env: Env) => readonly [number, number];
}

const FREE: Place = { world: false, reads: [], at: (_e, x, y) => [x, y], back: (_e, x, y) => [x, y], scale: () => [1, 1] };

function framePlace(rect: Rect, view: (env: Env) => View, reads: readonly string[]): Place {
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

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/* -- Gerüst und Schreiben ----------------------------------------------------------------------- */

/** Ein Teil, das die Schleife schreibt: seine Nummer (`data-k`), was es liest, seine Wiederholung, und wie es sich schreibt. */
export interface Inst {
  readonly k: number;
  readonly reads: ReadonlySet<string>;
  readonly scope: readonly [number, number] | null;
  readonly write: (el: SVGElement, env: Env) => void;
  /** Ist eine umschliessende Gruppe (ein Rahmen) verborgen, wird das Teil nicht einmal gerechnet. */
  readonly gate: ((env: Env) => boolean) | null;
  /** 2026-10-18 — das Teil eines Dings rechnet in dessen Umgebung (`null`: in der des Bildes). */
  readonly env: Env | null;
}

/** Ein Griff: was er setzt — und wo er steht (für die Tastatur). */
export interface Handle {
  readonly shape: Shape;
  readonly place: Place;
  readonly scope: readonly [number, number] | null;
  readonly set: readonly { readonly name: string; readonly expr: Expr }[];
  readonly anchor: (env: Env) => readonly [number, number];
}

export interface TapTarget {
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
export interface Trace {
  readonly k: number;
  readonly points: number[];
  next: number;
  readonly sample: (env: Env, clock: number) => boolean;
}

/** 2026-10-18 — ein Rahmen, den man zoomt und verschiebt: der Ausschnitt, den `view` sagt, und wie weit man davon weg ist. */
export interface Camera {
  readonly rect: Rect;
  readonly place: Place;
  readonly fit: (env: Env) => View;
  /** Vergrösserung (1: wie `view`) und Verschiebung der Mitte (Welt). */
  readonly at: { z: number; x: number; y: number };
  /**
   * Der Ausschnitt, den `view` beim Bauen (oder „Dopasuj") ergab — er folgt
   * nicht jeder Änderung: wer ein Gewicht zieht, soll das Bild nicht wandern
   * und wachsen sehen. Ein neuer Bau (ein Ding mehr) rechnet ihn neu.
   */
  shown: View | null;
}

export interface Built {
  readonly nodes: ReactNode[];
  readonly defs: ReactNode[];
  readonly insts: Inst[];
  readonly handles: Handle[];
  readonly taps: TapTarget[];
  readonly plan: Planned[];
  readonly traces: Trace[];
  readonly cameras: Camera[];
  /** Wo die Dinge der Welt stehen (der Rahmen um `world`) — `null`: keine Welt im Bild. */
  readonly worldPlace: Place | null;
}

export const round = (n: number): string => String(Math.round(n * 100) / 100);

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

/* Je Element sein Stift — damit nur geschrieben wird, was sich geändert hat. */
const PENS = new WeakMap<Element, Pen>();
export function penOf(el: Element): Pen {
  let pen = PENS.get(el);
  if (pen === undefined) { pen = new Pen(); PENS.set(el, pen); }
  return pen;
}

/** Die Werte eines Teils: gerechnet, wo es einen Ausdruck hat, sonst wie es dasteht. */
interface Values {
  readonly num: (key: Exclude<Bindable, 'text' | 'fill' | 'stroke'>, env: Env) => number;
  readonly color: (key: 'fill' | 'stroke', env: Env) => string | null;
  readonly text: (env: Env) => string;
  readonly show: (env: Env) => boolean;
  readonly reads: ReadonlySet<string>;
  /** Was ein einzelner Wert liest (die Verschiebung einer Gruppe — nicht ihre Drehung). */
  readonly keyReads: (key: Bindable) => readonly string[];
}

export class Builder {
  readonly insts: Inst[] = [];
  readonly handles: Handle[] = [];
  readonly taps: TapTarget[] = [];
  readonly plan: Planned[] = [];
  readonly defs: ReactNode[] = [];
  readonly traces: Trace[] = [];
  readonly cameras: Camera[] = [];
  worldPlace: Place | null = null;
  private shift = 0;
  private depth = 0;
  private gradients = 0;
  private clips = 0;
  private readonly values = new Map<Shape, Values>();
  /** Die `show` der umschliessenden Gruppen — solange eine falsch ist, ruht alles darin. */
  private readonly gates: { readonly show: (env: Env) => boolean; readonly reads: ReadonlySet<string> }[] = [];
  /** Das Ding, dessen Teile gerade gebaut werden (`null`: die Teile des Bildes). */
  private env: Env | null = null;

  constructor(private readonly drawing: Drawing, private readonly program: Program, private readonly prefix: string, private readonly still: boolean) {}

  /** Ein Ausdruck — im Ding mit dessen Namen. */
  private expr(source: string, where: string, extra: readonly string[] = []): Expr | null {
    return this.env === null ? this.program.compile(source, where, extra) : this.program.compileThing(source, where, extra);
  }

  private textExpr(source: string, where: string): Expr | null {
    return this.env === null ? this.program.compileText(source, where) : this.program.compileThing(source, where, [], true);
  }

  /** Eine Zahl oder ein Ausdruck (`Num`) als Rechnung. */
  private numFn(n: Num, where: string, extra: readonly string[] = []): { fn: (env: Env) => number; reads: readonly string[] } {
    if (typeof n === 'number') return { fn: () => n, reads: [] };
    const e = this.expr(n.expr, where, extra);
    return e === null ? { fn: () => 0, reads: [] } : { fn: (env) => toNum(e.run(env)), reads: e.reads };
  }

  private valuesOf(s: Shape): Values {
    const known = this.values.get(s);
    if (known !== undefined) return known;
    const reads = new Set<string>();
    const exprs: Partial<Record<Bindable, Expr>> = {};
    const where = `${s.type}${s.label === '' ? '' : ` „${s.label}"`}`;
    for (const [key, source] of Object.entries(s.bind ?? {})) {
      const e = key === 'text' ? this.textExpr(source, `${where}.text`) : this.expr(source, `${where}.${key}`);
      if (e === null) continue;
      exprs[key as Bindable] = e;
      for (const r of e.reads) reads.add(r);
    }
    const showExpr = s.show === null ? null : this.expr(s.show, `${where}.show`);
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
      reads,
      keyReads: (key) => exprs[key]?.reads ?? []
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
    /* Ein Teil eines Dings liest aus der Welt — ändert sich an ihr etwas, wird es neu geschrieben. */
    if (this.env !== null) all.add('#world');
    this.insts.push({ k, reads: all, scope, write, gate: gates.length === 0 ? null : (env) => gates.every((show) => show(env)), env: this.env });
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

  /** Die Dinge der Welt, Eltern vor Kindern — je Ding die Teile seiner Art, in einer Gruppe, die man wählt und zieht. */
  private worldNodes(place: Place, scope: readonly [number, number] | null, key: string): ReactNode[] {
    const world = this.program.world;
    if (world === null || this.env !== null) return [];
    this.worldPlace = place;
    return world.ordered().map((t) => this.thingNode(t, place, scope, `${key}~${t.id}.`));
  }

  private thingNode(t: Thing, place: Place, scope: readonly [number, number] | null, key: string): ReactNode {
    const before = this.env;
    this.env = t.env;
    try {
      const kids = this.list(t.kind.spec.shapes, place, scope, key);
      if (this.still) return <g key={key} className="lv-thing">{kids}</g>;
      /* Ein Ring um `x`, `y` des Dings (Welt) — mit dem Finger zu treffen, auch wenn die Belke dünn ist. */
      const ring = this.add(['x', 'y', 'hit'], scope, (el, env) => {
        const pen = penOf(el);
        const [X, Y] = place.at(env, toNum(env.x ?? 0), toNum(env.y ?? 0));
        pen.attr(el, 'cx', round(X)); pen.attr(el, 'cy', round(Y));
        pen.attr(el, 'r', round(Math.max(0.5, toNum(env.hit ?? 0) || 0.5)));
      });
      return (
        <g key={key} className="lv-thing" data-thing={t.id} data-pz-hold="" tabIndex={0} role="button" aria-label={`${t.kind.spec.label} ${t.id}`}>
          {kids}
          <circle className="lv-hit" data-k={ring} />
        </g>
      );
    } finally {
      this.env = before;
    }
  }

  private shape(s: Shape, place: Place, scope: readonly [number, number] | null, key: string): ReactNode {
    if (this.depth > DRAWING_LIMITS.depth) return null;
    if (s.type === 'world') return <g key={key} className="lv-world">{this.worldNodes(place, scope, key)}</g>;
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
        const fn = s.fn === null ? null : this.expr(s.fn, 'plot.fn', extra);
        const fx = s.fx === null ? null : this.expr(s.fx, 'plot.fx', extra);
        const fy = s.fy === null ? null : this.expr(s.fy, 'plot.fy', extra);
        const from = this.numFn(s.from, 'plot.from');
        const to = this.numFn(s.to, 'plot.to');
        const own = [...reads, ...from.reads, ...to.reads, ...[fn, fx, fy].flatMap((e) => (e === null ? [] : e.reads))].filter((r) => r !== s.var);
        const k = this.add(own, scope, (el, env) => {
          const pen = penOf(el);
          const a = from.fn(env);
          const b = to.fn(env);
          const had = Object.prototype.hasOwnProperty.call(env, s.var);
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
          if (had) env[s.var] = was; else delete env[s.var];
          pen.attr(el, 'd', d === '' ? null : d);
          this.common(v, pen, el, env, false);
        });
        body = <path key={key} data-k={k} style={lineStyle} {...mo} />;
        break;
      }
      case 'trace': {
        const fx = s.fx === null ? null : this.expr(s.fx, 'trace.fx');
        const fy = s.fy === null ? null : this.expr(s.fy, 'trace.fy');
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
          const own = this.env;
          const trace: Trace = {
            k,
            points,
            next: 0,
            sample: (global, clock) => {
              if (clock + 1e-9 < trace.next) return false;
              trace.next = clock + s.every;
              const env = own ?? global;
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
          const fit = (env: Env): View => [parts[0].fn(env), parts[1].fn(env), parts[2].fn(env), parts[3].fn(env)];
          /* Mit Kamera: um die Mitte vergrössert, um `x`, `y` verschoben — `#cam` meldet, dass sich daran etwas geändert hat. */
          const at = { z: 1, x: 0, y: 0 };
          const live = s.camera && !this.still;
          let shown: View | null = null;
          const view = !live ? fit : (env: Env): View => {
            if (shown === null) shown = fit(env);
            const v0 = shown;
            const cx = (v0[0] + v0[2]) / 2 + at.x;
            const cy = (v0[1] + v0[3]) / 2 + at.y;
            const hw = (v0[2] - v0[0]) / 2 / at.z;
            const hh = (v0[3] - v0[1]) / 2 / at.z;
            return [cx - hw, cy - hh, cx + hw, cy + hh];
          };
          const viewReads = [...parts.flatMap((p) => p.reads), ...(s.camera ? ['#cam'] : [])];
          const inside = framePlace(rect, view, viewReads);
          let cam: number | null = null;
          if (live) {
            cam = this.cameras.length;
            this.cameras.push({ rect, place: inside, fit, at, get shown() { return shown; }, set shown(v) { shown = v; } });
          }
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
              const box = el.querySelector<SVGGElement>(':scope > .lv-axes');
              if (box !== null) drawAxes(box, rect, view(env), axes);
            }
          });
          body = (
            <g key={key} data-k={k} {...mo}>
              {cam !== null && <rect className="lv-cam" data-cam={cam} x={rect.x} y={rect.y} width={rect.w} height={rect.h} />}
              {axes !== null && <g className="lv-axes" aria-hidden="true" />}
              <g {...(clip === null ? {} : { clipPath: `url(#${clip})` })}>{kids}</g>
            </g>
          );
          anchor = () => [rect.x + rect.w / 2, rect.y + rect.h / 2];
        } else if (place.world) {
          /* In der Welt: eine Gruppe verschiebt ihre Teile um x, y (Welt) und dreht sie um diesen Punkt (gegen den Uhrzeiger, wie in der Mathematik). */
          /* Die Teile darin hängen nur an der Verschiebung — dreht sich die Gruppe (ein Zahnrad), wird nur sie neu geschrieben. */
          const inside = offsetPlace(place, (env) => v.num('x', env), (env) => v.num('y', env), [...v.keyReads('x'), ...v.keyReads('y')]);
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

    /* Ein Griff oder ein Knopf im Bild: fokussierbar, mit dem Finger zu treffen (in einem Ding zieht das Ding selbst). */
    if (!this.still && this.env === null && (s.drag !== null || s.tap !== null)) {
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

/** Das Gerüst eines Bildes — einmal je Programm und Bau der Welt. */
export function buildDrawing(drawing: Drawing, program: Program, prefix: string, still: boolean): Built {
  const b = new Builder(drawing, program, prefix, still);
  const nodes = b.build();
  return { nodes, defs: b.defs, insts: b.insts, handles: b.handles, taps: b.taps, plan: b.plan, traces: b.traces, cameras: b.cameras, worldPlace: b.worldPlace };
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
function drawAxes(box: SVGGElement, rect: Rect, v: View, axes: { x: string; y: string; grid: boolean }): void {
  const key = v.map((n) => round(n)).join(',');
  if (box.dataset.view === key) return;
  box.dataset.view = key;
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
