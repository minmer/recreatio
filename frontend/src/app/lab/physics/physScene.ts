/**
 * 2026-10-18 — EINE SZENE DER FIZYKA 2D ALS DOKUMENT: was auf der Seite
 * gespeichert liegt (`scene` in der Tafel des Bausteins) — die Welt, ihre
 * Körper, Verbindungen, Becken und Rohre, was zu sehen ist, was man darf,
 * ein Ziel und die Schritte eines Versuchs. Der Motor ist Code, die Szene
 * ist Daten: jede Zahl darf eine Rechnung mit gezogenen Werten sein
 * (`labRandom.ts`), damit derselbe Versuch jedes Mal etwas anders ist.
 *
 * Gelesen wird duldsam (was nicht passt, fällt weg, nie ein Fehler) und mit
 * Grenzen, damit eine Seite nie ein Telefon in die Knie zwingt.
 */

import { LIQUIDS } from '../fluid';
import { drawVars, num, readVars, seeded, str, type Drawn, type LabVar } from '../labRandom';
import { Body, MATERIALS, type Material } from './physBody';
import { PinJoint, PulleyJoint, RodJoint, SpringJoint, type Joint } from './physJoints';
import { Basin, levels, liquidOf, type Pipe } from './physFluid';
import { boxPoints, polyOf, type Pt, type Shape } from './physShapes';
import { World } from './physWorld';

export const PHYS_LIMITS = { bodies: 160, joints: 80, basins: 8, pipes: 8, holes: 6, steps: 20, label: 60, say: 300 } as const;

export type VectorKind = 'v' | 'g' | 'lift' | 'net';
export const VECTOR_KINDS: readonly VectorKind[] = ['v', 'g', 'lift', 'net'];

export type GraphOf = 'h' | 'x' | 'v' | 'vx' | 'vy' | 'ek' | 'ep' | 'e' | 'a';
export const GRAPH_OF: readonly GraphOf[] = ['h', 'x', 'v', 'vx', 'vy', 'ek', 'ep', 'e', 'a'];

export const PALETTE = ['ball', 'box', 'plank', 'wedge', 'ramp', 'wall', 'pendulum', 'spring', 'pulley', 'seesaw', 'basin'] as const;
export type PaletteKey = (typeof PALETTE)[number];
export const TOOLS = ['pin', 'rope', 'rod', 'link', 'ruler', 'probe', 'delete'] as const;
export type ToolKey = (typeof TOOLS)[number];

export interface StepSpec {
  readonly say: string;
  /** Was „Pokaż” an diesem Schritt tut: laufen lassen, anhalten, ein Loch öffnen, einen Körper anstossen. */
  readonly do: { readonly kind: 'play' | 'pause' } | { readonly kind: 'open'; readonly basin: string; readonly hole: number } | { readonly kind: 'push'; readonly body: string; readonly vx: number; readonly vy: number } | null;
  /** Wie lange „Pokaż” auf diesem Schritt bleibt (s). */
  readonly wait: number;
}

export interface GoalSpec {
  readonly body: string;
  /** Das Rechteck [x0, y0, x1, y1] — Zahlen oder Rechnungen mit den gezogenen Werten (`goalArea`). */
  readonly area: readonly unknown[];
  readonly for: number;
  readonly say: string;
}

/** Die Regler der Welt, die die Bedienung zeigt: Luftwiderstand an/aus, Schwerkraft (Erde, Mond …). */
export const WORLD_CONTROLS = ['air', 'gravity'] as const;
export type WorldControl = (typeof WORLD_CONTROLS)[number];

export interface PhysScene {
  readonly gravity: number;
  readonly air: number;
  readonly depth: number;
  readonly ground: boolean;
  readonly speed: number;
  readonly view: readonly [number, number, number, number] | null;
  readonly vars: readonly LabVar[];
  readonly show: { readonly vectors: readonly VectorKind[]; readonly trace: readonly string[]; readonly grid: boolean; readonly pressure: boolean; readonly values: boolean };
  readonly graph: { readonly body: string; readonly of: readonly GraphOf[] } | null;
  readonly allow: { readonly add: boolean; readonly palette: readonly PaletteKey[]; readonly tools: readonly ToolKey[]; readonly edit: boolean; readonly drag: boolean };
  readonly goal: GoalSpec | null;
  readonly steps: readonly StepSpec[];
  readonly controls: readonly WorldControl[];
  /** Das Dokument selbst (gebaut wird bei jedem „Od nowa” neu — mit neuen Zufallswerten nur bei „Nowe losowanie”). */
  readonly raw: Readonly<Record<string, unknown>>;
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const finite = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const line = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const ID = /^[\p{L}_][\p{L}\p{N}_-]{0,31}$/u;

function readStep(value: unknown): StepSpec | null {
  const one = record(value);
  const say = line(one.say, PHYS_LIMITS.say);
  if (say === '') return null;
  const d = one.do;
  let action: StepSpec['do'] = null;
  if (d === 'play' || d === 'pause') action = { kind: d };
  else if (typeof d === 'object' && d !== null) {
    const r = record(d);
    if (typeof r.open === 'string') action = { kind: 'open', basin: r.open, hole: Math.round(finite(r.hole) ?? 0) };
    else if (typeof r.push === 'string') action = { kind: 'push', body: r.push, vx: finite(r.vx) ?? 0, vy: finite(r.vy) ?? 0 };
  }
  return { say, do: action, wait: clamp(finite(one.wait) ?? 3, 0.5, 60) };
}

/** Die Szene aus dem Dokument — `null`: keines (dann eine leere Piaskownica). */
export function readPhysScene(value: unknown): PhysScene {
  const one = record(value);
  const world = record(one.world);
  const show = record(one.show);
  const allow = record(one.allow);
  const graph = record(one.graph);
  const goal = record(one.goal);
  const view = list(one.view).map(finite);
  const palette = Array.isArray(allow.palette) ? allow.palette.filter((p): p is PaletteKey => (PALETTE as readonly string[]).includes(String(p))) : [...PALETTE];
  const tools = Array.isArray(allow.tools) ? allow.tools.filter((p): p is ToolKey => (TOOLS as readonly string[]).includes(String(p))) : [...TOOLS];
  const area = list(goal.area).slice(0, 4);
  return {
    gravity: clamp(finite(world.gravity) ?? 9.81, 0, 50),
    air: clamp(finite(world.air) ?? 1, 0, 50),
    depth: clamp(finite(world.depth) ?? 0.1, 0.01, 2),
    ground: world.ground !== false,
    speed: clamp(finite(world.speed) ?? 1, 0.05, 4),
    view: view.length === 4 && view.every((v) => v !== null) ? [view[0]!, view[1]!, view[2]!, view[3]!] : null,
    vars: readVars(one.vars),
    show: {
      vectors: list(show.vectors).filter((v): v is VectorKind => (VECTOR_KINDS as readonly string[]).includes(String(v))),
      trace: list(show.trace).filter((v): v is string => typeof v === 'string'),
      grid: show.grid === true,
      pressure: show.pressure === true,
      values: show.values !== false
    },
    graph: typeof graph.body === 'string' ? { body: graph.body, of: list(graph.of).filter((v): v is GraphOf => (GRAPH_OF as readonly string[]).includes(String(v))).slice(0, 3) } : null,
    allow: {
      add: allow.add !== false,
      palette: allow.add === false ? [] : palette,
      tools: allow.add === false && !Array.isArray(allow.tools) ? [] : tools,
      edit: allow.edit !== false,
      drag: allow.drag !== false
    },
    goal: typeof goal.body === 'string' && area.length === 4
      ? { body: goal.body, area, for: clamp(finite(goal.for) ?? 0.5, 0, 30), say: line(goal.say, PHYS_LIMITS.say) || 'Udało się!' }
      : null,
    steps: list(one.steps).slice(0, PHYS_LIMITS.steps).map(readStep).filter((s): s is StepSpec => s !== null),
    controls: Array.isArray(one.controls) ? one.controls.filter((c): c is WorldControl => (WORLD_CONTROLS as readonly string[]).includes(String(c))) : [],
    raw: one
  };
}

/** Der Stoff eines Körpers — mit eigener Dichte, wo das Dokument eine nennt. */
function materialOf(spec: Record<string, unknown>, d: Drawn): Material {
  const key = str(spec.material, d, 'wood');
  const base = MATERIALS[key] ?? MATERIALS.wood;
  const density = spec.density === undefined ? null : num(spec.density, d, base.density);
  const friction = spec.friction === undefined ? null : num(spec.friction, d, base.friction);
  const bounce = spec.bounce === undefined ? null : num(spec.bounce, d, base.bounce);
  if (density === null && friction === null && bounce === null) return base;
  return { ...base, density: clamp(density ?? base.density, 1, 30000), friction: clamp(friction ?? base.friction, 0, 2), bounce: clamp(bounce ?? base.bounce, 0, 1) };
}

/** Eine Form aus dem Dokument — und wo ihr Schwerpunkt in ihren eigenen Koordinaten liegt. */
function shapeOf(spec: Record<string, unknown>, d: Drawn): { shape: Shape; ox: number; oy: number } | null {
  const kind = str(spec.shape, d, 'box');
  if (kind === 'circle' || kind === 'ball') {
    return { shape: { kind: 'circle', r: clamp(num(spec.r, d, 0.25), 0.01, 50) }, ox: 0, oy: 0 };
  }
  let pts: Pt[];
  if (kind === 'poly' || kind === 'polygon') {
    pts = list(spec.points).slice(0, 16).map((p) => { const q = list(p); return [num(q[0], d, NaN), num(q[1], d, NaN)] as const; }).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  } else {
    pts = boxPoints(clamp(num(spec.w, d, 0.5), 0.01, 200), clamp(num(spec.h, d, 0.5), 0.01, 200));
  }
  const p = polyOf(pts);
  return p === null ? null : { shape: p.shape, ox: p.cx, oy: p.cy };
}

/** Ein Körper aus dem Dokument. `x`, `y`: wo sein Bezugspunkt steht (beim Vieleck der Ursprung seiner Punkte, sonst die Mitte). */
export function bodyOf(spec: Record<string, unknown>, d: Drawn, depth: number, fallbackId: string): Body | null {
  const made = shapeOf(spec, d);
  if (made === null) return null;
  const id = typeof spec.id === 'string' && ID.test(spec.id.trim()) ? spec.id.trim() : fallbackId;
  const b = new Body(id, made.shape, materialOf(spec, d), spec.static === true ? 'static' : 'dynamic', depth);
  const angle = (num(spec.angle, d, 0) * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  b.x = num(spec.x, d, 0) + c * made.ox - s * made.oy;
  b.y = num(spec.y, d, 0) + s * made.ox + c * made.oy;
  b.a = angle;
  b.vx = num(spec.vx, d, 0);
  b.vy = num(spec.vy, d, 0);
  b.w = num(spec.spin, d, 0);
  b.label = str(spec.label, d, '').slice(0, PHYS_LIMITS.label) || id;
  b.named = typeof spec.label === 'string' && spec.label.trim() !== '';
  b.draggable = spec.drag !== false;
  b.trace = spec.trace === true;
  b.color = typeof spec.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(spec.color.trim()) ? spec.color.trim() : null;
  b.update();
  return b;
}

/** Ein Becken: Innenmasse, Wände als feste Körper, Schichten, Löcher. */
export function basinOf(spec: Record<string, unknown>, d: Drawn, depth: number, fallbackId: string): Basin {
  const id = typeof spec.id === 'string' && ID.test(spec.id.trim()) ? spec.id.trim() : fallbackId;
  const x0 = num(spec.x, d, 0);
  const y0 = num(spec.y, d, 0);
  const w = clamp(num(spec.w, d, 2), 0.1, 60);
  const h = clamp(num(spec.h, d, 1.5), 0.1, 40);
  const wall = clamp(num(spec.wall, d, 0.06), 0.01, 1);
  const basin = new Basin(id, x0, x0 + w, y0, y0 + h, wall);
  const glass = MATERIALS.glass;
  const mk = (suffix: string, cx: number, cy: number, bw: number, bh: number) => {
    const p = polyOf(boxPoints(bw, bh));
    if (p === null) return;
    const body = new Body(`${id}~${suffix}`, p.shape, glass, 'static', depth);
    body.x = cx; body.y = cy;
    body.label = 'ścianka';
    body.update();
    basin.walls.push(body);
  };
  mk('l', x0 - wall / 2, y0 + h / 2 - wall / 2, wall, h + wall);
  mk('r', x0 + w + wall / 2, y0 + h / 2 - wall / 2, wall, h + wall);
  mk('f', x0 + w / 2, y0 - wall / 2, w + 2 * wall, wall);
  const layers = Array.isArray(spec.layers) ? list(spec.layers) : spec.liquid !== undefined || spec.level !== undefined ? [{ liquid: spec.liquid, height: spec.level }] : [];
  for (const raw of layers.slice(0, 4)) {
    const l = record(raw);
    const height = clamp(num(l.height, d, 0), 0, h * 1.5);
    if (height > 0) basin.add(liquidOf(str(l.liquid, d, 'water')), height * w);
  }
  for (const raw of list(spec.holes).slice(0, PHYS_LIMITS.holes)) {
    const o = record(raw);
    const side = o.side === 'left' || o.side === 'bottom' ? o.side : 'right';
    basin.holes.push({ side, at: clamp(num(o.at, d, 0.2), 0, side === 'bottom' ? w : h), size: clamp(num(o.size, d, 0.03), 0.004, 0.5), open: o.open === true, flow: 0, speed: 0 });
  }
  return basin;
}

/** Ein Punkt `[x, y]` aus dem Dokument. */
const pointOf = (value: unknown, d: Drawn, fx: number, fy: number): [number, number] => {
  const p = list(value);
  return [num(p[0], d, fx), num(p[1], d, fy)];
};

/** Eine Verbindung aus dem Dokument — an Körpern der Welt (oder an der Welt selbst). */
export function jointOf(spec: Record<string, unknown>, d: Drawn, world: World, fallbackId: string): Joint | null {
  const byId = (id: unknown) => (typeof id === 'string' ? world.bodies.find((b) => b.id === id) ?? null : null);
  const a = byId(spec.a);
  if (a === null) return null;
  const b = byId(spec.b) ?? world.ground;
  const id = typeof spec.id === 'string' ? spec.id.slice(0, 32) : fallbackId;
  const type = String(spec.type ?? '');
  if (type === 'pin' || type === 'motor') {
    const [wx, wy] = pointOf(spec.at, d, a.x, a.y);
    return new PinJoint(id, a, b, a.toLocal(wx, wy), b.toLocal(wx, wy), num(spec.speed, d, 0), type === 'motor' ? clamp(num(spec.torque, d, 50), 0, 1e6) : clamp(num(spec.torque, d, 0), 0, 1e6));
  }
  const on = pointOf(spec.on, d, 0, 0);
  const [wbx, wby] = b === world.ground ? pointOf(spec.at, d, a.x, a.y + 1) : b.toWorld(...pointOf(spec.at, d, 0, 0));
  const lb = b.toLocal(wbx, wby);
  const [wax, way] = a.toWorld(on[0], on[1]);
  const span = Math.hypot(wbx - wax, wby - way);
  if (type === 'rod' || type === 'rope') return new RodJoint(id, a, b, on, lb, clamp(num(spec.length, d, span), 0.01, 500), type === 'rope');
  if (type === 'spring') return new SpringJoint(id, a, b, on, lb, clamp(num(spec.length, d, span), 0.01, 500), clamp(num(spec.k, d, 40), 0.1, 1e6), clamp(num(spec.damping, d, 0.3), 0, 1e5));
  if (type === 'pulley') {
    const b2 = byId(spec.b);
    if (b2 === null) return null;
    const [gax, gay] = pointOf(spec.at, d, a.x, a.y + 2);
    const [gbx, gby] = pointOf(spec.at2, d, b2.x, b2.y + 2);
    const onB = pointOf(spec.onB, d, 0, 0);
    const [pbx, pby] = b2.toWorld(onB[0], onB[1]);
    const total = num(spec.length, d, Math.hypot(wax - gax, way - gay) + Math.hypot(pbx - gbx, pby - gby));
    return new PulleyJoint(id, a, b2, on, onB, gax, gay, gbx, gby, total);
  }
  return null;
}

/** Die Welt aus der Szene — mit gezogenen Werten (`drawn`). */
export function buildWorld(scene: PhysScene, drawn: Drawn): World {
  const groundBody = new Body('~welt', { kind: 'circle', r: 0.01 }, MATERIALS.stone, 'static', scene.depth);
  groundBody.update();
  const world = new World(scene.gravity, scene.air, scene.depth, groundBody);
  const raw = scene.raw;
  if (scene.ground) {
    const p = polyOf(boxPoints(400, 2));
    if (p !== null) {
      const floor = new Body('~ziemia', p.shape, MATERIALS.stone, 'static', scene.depth);
      floor.x = 0; floor.y = -1;
      floor.label = 'podłoże';
      floor.draggable = false;
      world.add(floor);
    }
  }
  list(raw.fluids).slice(0, PHYS_LIMITS.basins).forEach((one, i) => {
    const basin = basinOf(record(one), drawn, scene.depth, `zb${i + 1}`);
    world.basins.push(basin);
    for (const w of basin.walls) world.add(w);
  });
  list(raw.bodies).slice(0, PHYS_LIMITS.bodies).forEach((one, i) => {
    const b = bodyOf(record(one), drawn, scene.depth, `c${i + 1}`);
    if (b !== null && !world.bodies.some((x) => x.id === b.id)) {
      if (scene.show.trace.includes(b.id)) b.trace = true;
      world.add(b);
    }
  });
  list(raw.joints).slice(0, PHYS_LIMITS.joints).forEach((one, i) => {
    const j = jointOf(record(one), drawn, world, `j${i + 1}`);
    if (j !== null) world.join(j);
  });
  for (const one of list(raw.pipes).slice(0, PHYS_LIMITS.pipes)) {
    const p = record(one);
    const a = world.basins.find((x) => x.id === p.a);
    const b = world.basins.find((x) => x.id === p.b);
    if (a === undefined || b === undefined || a === b) continue;
    const pipe: Pipe = { a, b, y: num(p.y, drawn, Math.max(a.y0, b.y0) + 0.03), size: clamp(num(p.size, drawn, 0.05), 0.005, 1), open: p.open !== false, flow: 0 };
    world.pipes.push(pipe);
  }
  /* Der Spiegel steht schon vor dem ersten Schritt (sonst zeigte ein angehaltenes Labor ein leeres Becken). */
  for (const basin of world.basins) levels(basin, world.bodies);
  return world;
}

/** Das Rechteck des Ziels mit den gezogenen Werten — `null`: keines. */
export function goalArea(goal: GoalSpec | null, drawn: Drawn): readonly [number, number, number, number] | null {
  if (goal === null) return null;
  const v = goal.area.map((x) => num(x, drawn, NaN));
  if (!v.every(Number.isFinite)) return null;
  return [Math.min(v[0], v[2]), Math.min(v[1], v[3]), Math.max(v[0], v[2]), Math.max(v[1], v[3])];
}

/** Die Werte dieser Szene ziehen (mit einem Samen: wiederholbar). */
export const drawScene = (scene: PhysScene, seed: string | null): Drawn => drawVars(scene.vars, seed === null ? Math.random : seeded(seed));

export { LIQUIDS };
