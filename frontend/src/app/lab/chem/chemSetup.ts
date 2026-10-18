/**
 * 2026-10-18 — DER VERSUCH ALS DOKUMENT (Chemia): eine Szene sagt nur, WAS
 * WO STEHT — Glas, Brenner, Dreifuss, Kerze, Thermometer, Stäbe, Stücke —,
 * was darin ist, was im Regal und unter den Werkzeugen ist, was man sieht,
 * und die Schritte mit „Pokaż”. Alles andere tut der Motor (`chemWorld.ts`):
 * dieselbe Piaskownica für jeden Versuch, ein Versuch ist eine Piaskownica
 * mit weniger erlaubt.
 *
 * <b>Für Folien</b>: `before` sind Schritte, die beim Aufbau schon geschehen
 * (ohne Bewegung, sofort), `warm` Sekunden, die danach schon vergangen sind —
 * so beginnt jede Folie dort, wo die vorige aufhörte.
 *
 * <b>Duldsam</b>: was fehlt, hat einen Standard; was nicht passt, fällt weg.
 * <b>Zufall</b>: `vars` ziehen Zahlen und Texte (`"reagent": "{sol}"`), Zahlen
 * dürfen Rechnungen sein (`"=10 + k"`).
 */

import { NO_DRAW, drawVars, num, readVars, seeded, str, type Drawn, type LabVar } from '../labRandom';
import { GASES, REAGENTS, reagentOf, type GasId } from './chemData';
import { AQ, NC, aqVolume, specOf, formHeat, type Bottle } from './chemAq';
import { AIR_X, CELL, F, GASI, L, NG, SOLI } from './chemGrid';
import { CONTAINERS, isContainer, mouthOf, nozzleOf, toWorld, wickOf, type Thing, type ThingKind } from './chemThings';
import { World } from './chemWorld';

export type ToolKey = 'match' | 'splint' | 'glow' | 'loop' | 'stir' | 'stopper' | 'paper' | 'thermometer' | 'probe' | 'empty' | 'delete';
export const TOOLS: readonly ToolKey[] = ['match', 'splint', 'glow', 'loop', 'stir', 'stopper', 'paper', 'thermometer', 'probe', 'empty', 'delete'];

export type GraphOf = 'T' | 'pH' | 'p';

type XY = readonly [unknown, unknown];

export type Action =
  | { readonly kind: 'add'; readonly reagent: unknown; readonly to: string | null; readonly at: XY | null; readonly amount: unknown }
  | { readonly kind: 'pour'; readonly from: string; readonly to: string; readonly ml: number }
  | { readonly kind: 'move'; readonly id: string; readonly to: XY | null; readonly on: string | null; readonly into: string | null }
  | { readonly kind: 'burner'; readonly id: string; readonly on: boolean; readonly air: number | null; readonly gas: number | null }
  | { readonly kind: 'heat'; readonly id: string; readonly on: boolean; readonly power: number | null; readonly stir: boolean | null }
  | { readonly kind: 'ignite'; readonly id: string | null; readonly at: XY | null }
  | { readonly kind: 'use'; readonly tool: ToolKey; readonly at: string }
  | { readonly kind: 'flame'; readonly burner: string }
  | { readonly kind: 'tap'; readonly id: string; readonly rate: number }
  | { readonly kind: 'tilt'; readonly id: string; readonly angle: number }
  | { readonly kind: 'speed'; readonly value: number };

export interface Ask {
  readonly q: string;
  readonly options: readonly string[];
  /** Die richtige Antwort: Text einer Option (darf `{name}` enthalten), ihre Nummer oder `"=Rechnung"` — `null`: nur Meinung. */
  readonly answer: unknown;
  readonly why: string;
}

export interface Step {
  readonly say: string;
  readonly do: readonly Action[];
  readonly wait: number;
  readonly ask: Ask | null;
}

export interface ThingSpec {
  readonly id: string;
  readonly kind: ThingKind;
  readonly size: number | null;
  readonly x: unknown;
  readonly y: unknown;
  readonly on: string | null;
  readonly into: string | null;
  readonly of: string | null;
  readonly angle: number;
  readonly label: unknown;
  readonly hidden: boolean;
  readonly held: boolean | null;
  readonly fill: readonly { readonly reagent: unknown; readonly amount: unknown }[];
  readonly T: unknown;
  readonly gas: Readonly<Partial<Record<GasId, number>>> | null;
  readonly closed: boolean;
  /** Brenner, Heizplatte: an; Kerze: brennt. */
  readonly lit: boolean;
  readonly air: number | null;
  readonly flow: number | null;
  readonly power: number | null;
  /** Heizplatte: Magnetrührer an. */
  readonly stir: boolean;
  readonly height: number | null;
  /** Gespeicherter Inhalt (aus „Zapisz” / JSON der Piaskownica). */
  readonly content: unknown;
}

export interface ChemScene {
  readonly room: { readonly T: number; readonly p: number };
  readonly world: { readonly width: number | null; readonly height: number | null; readonly depth: number };
  readonly vars: readonly LabVar[];
  readonly things: readonly ThingSpec[];
  /** Was im Regal steht (Kennungen oder Gruppen) — `null`: alles. */
  readonly shelf: readonly string[] | null;
  readonly tools: readonly ToolKey[] | null;
  readonly allow: { readonly shelf: boolean; readonly things: boolean; readonly move: boolean };
  readonly show: { readonly values: boolean; readonly composition: boolean; readonly micro: boolean; readonly equations: boolean; readonly heat: boolean };
  readonly graph: { readonly things: readonly string[]; readonly of: readonly GraphOf[] } | null;
  readonly before: readonly Action[];
  readonly warm: number;
  readonly steps: readonly Step[];
  readonly speed: number;
  readonly view: readonly [number, number, number, number] | null;
  readonly raw: Readonly<Record<string, unknown>>;
}

export const KINDS: readonly ThingKind[] = [
  ...CONTAINERS, 'burner', 'hotplate', 'tripod', 'stand', 'candle', 'thermometer', 'rod', 'piece', 'splint', 'loop', 'spoon', 'stopper', 'plate'
];

const ID = /^[\p{L}\p{N}_-]{1,24}$/u;
const record = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v.trim() : fallback);
const finite = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const maybe = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const idOf = (v: unknown): string | null => { const s = text(v); return ID.test(s) ? s : null; };
const xy = (v: unknown): XY | null => (Array.isArray(v) && v.length === 2 ? [v[0], v[1]] : null);

/* -- Lesen ------------------------------------------------------------------------------------------- */

function readAction(raw: unknown): Action | null {
  const a = record(raw);
  if (a.add !== undefined) { const to = idOf(a.to); const at = xy(a.at); return to === null && at === null ? null : { kind: 'add', reagent: a.add, to, at, amount: a.amount ?? null }; }
  if (a.pour !== undefined) { const from = idOf(a.pour); const to = idOf(a.to); return from === null || to === null ? null : { kind: 'pour', from, to, ml: Math.max(0.5, finite(a.ml, 10)) }; }
  if (a.move !== undefined) { const id = idOf(a.move); return id === null ? null : { kind: 'move', id, to: xy(a.to), on: idOf(a.on), into: idOf(a.into) }; }
  if (a.burner !== undefined) { const id = idOf(a.burner); return id === null ? null : { kind: 'burner', id, on: a.on !== false, air: maybe(a.air), gas: maybe(a.gas) }; }
  if (a.heat !== undefined) { const id = idOf(a.heat); return id === null ? null : { kind: 'heat', id, on: a.on !== false, power: maybe(a.power), stir: typeof a.stir === 'boolean' ? a.stir : null }; }
  if (a.ignite !== undefined) { const id = idOf(a.ignite); const at = xy(a.at); return id === null && at === null ? null : { kind: 'ignite', id, at }; }
  if (a.use !== undefined) { const at = idOf(a.at); const tool = text(a.use) as ToolKey; return at === null || !TOOLS.includes(tool) ? null : { kind: 'use', tool, at }; }
  if (a.flame !== undefined) { const id = idOf(a.flame); return id === null ? null : { kind: 'flame', burner: id }; }
  if (a.tap !== undefined) { const id = idOf(a.tap); return id === null ? null : { kind: 'tap', id, rate: Math.max(0, Math.min(5, finite(a.rate, 0.5))) }; }
  if (a.tilt !== undefined) { const id = idOf(a.tilt); return id === null ? null : { kind: 'tilt', id, angle: Math.max(-135, Math.min(135, finite(a.angle, 0))) }; }
  if (a.speed !== undefined) return { kind: 'speed', value: Math.min(300, Math.max(0.25, finite(a.speed, 1))) };
  return null;
}

const actionsOf = (v: unknown): Action[] => (Array.isArray(v) ? v : v === undefined ? [] : [v]).map(readAction).filter((a): a is Action => a !== null);

function readThing(raw: unknown, seen: ReadonlySet<string>): ThingSpec | null {
  const t = record(raw);
  const id = idOf(t.id);
  const kind = text(t.kind ?? t.type) as ThingKind;
  if (id === null || seen.has(id) || !KINDS.includes(kind)) return null;
  const gas = record(t.gas);
  const mix: Partial<Record<GasId, number>> = {};
  for (const g of GASES) { const x = gas[g]; if (typeof x === 'number' && x > 0) mix[g] = x; }
  const size = maybe(t.size) ?? maybe(t.length) ?? maybe(t.mass);
  return {
    id, kind, size: size === null ? null : Math.min(5000, Math.max(0.01, size)),
    x: t.x ?? null, y: t.y ?? null, on: idOf(t.on), into: idOf(t.in ?? t.into), of: text(t.of) || null,
    angle: finite(t.angle, 0), label: t.label ?? '', hidden: t.hidden === true, held: typeof t.held === 'boolean' ? t.held : null,
    fill: list(t.fill).slice(0, 12).map((f) => { const r = record(f); return { reagent: r.reagent, amount: r.amount ?? null }; }),
    T: t.T ?? null, gas: Object.keys(mix).length > 0 ? mix : null, closed: t.closed === true,
    lit: t.lit === true || (kind === 'burner' || kind === 'hotplate' ? t.on === true : false),
    air: maybe(t.air), flow: maybe(t.gas) ?? maybe(t.rate), power: maybe(t.power), stir: t.stir === true, height: maybe(t.height), content: t.content ?? null
  };
}

/** Das Dokument lesen — was nicht passt, fällt weg. */
export function readChemScene(doc: unknown): ChemScene {
  const d = record(doc);
  const room = record(d.room);
  const world = record(d.world);
  const things: ThingSpec[] = [];
  const seen = new Set<string>();
  for (const raw of list(d.things).slice(0, 40)) {
    const t = readThing(raw, seen);
    if (t === null) continue;
    things.push(t);
    seen.add(t.id);
  }
  const allow = record(d.allow);
  const show = record(d.show);
  const graph = record(d.graph);
  const of = list(graph.of).filter((q): q is GraphOf => q === 'T' || q === 'pH' || q === 'p');
  const gThings = [...list(graph.things).map(idOf), idOf(graph.thing)].filter((x): x is string => x !== null);
  const steps = list(d.steps).slice(0, 40).map((raw): Step => {
    const s = record(raw);
    const ask = record(s.ask);
    const options = list(ask.options).filter((o): o is string => typeof o === 'string').slice(0, 6);
    return {
      say: text(s.say),
      do: actionsOf(s.do),
      wait: Math.min(600, Math.max(0, finite(s.wait, 4))),
      ask: text(ask.q) !== '' && options.length > 1 ? { q: text(ask.q), options, answer: ask.answer ?? null, why: text(ask.why) } : null
    };
  });
  const view = list(d.view).map((x) => finite(x, Number.NaN));
  return {
    room: { T: finite(room.T, 20) + 273.15, p: finite(room.p, 101.325) },
    world: { width: maybe(world.width), height: maybe(world.height), depth: Math.min(10, Math.max(1, finite(world.depth, 3))) },
    vars: readVars(d.vars),
    things,
    shelf: Array.isArray(d.shelf) ? d.shelf.filter((x): x is string => typeof x === 'string') : null,
    tools: Array.isArray(d.tools) ? d.tools.filter((x): x is ToolKey => TOOLS.includes(x as ToolKey)) : null,
    allow: { shelf: allow.shelf !== false, things: allow.things === true, move: allow.move !== false },
    show: { values: show.values !== false, composition: show.composition !== false, micro: show.micro !== false, equations: show.equations !== false, heat: show.heat === true },
    graph: of.length > 0 && gThings.length > 0 ? { things: gThings.slice(0, 3), of } : null,
    before: actionsOf(d.before),
    warm: Math.min(600, Math.max(0, finite(d.warm, 0))),
    steps,
    speed: Math.min(300, Math.max(0.25, finite(d.speed, 1))),
    view: view.length === 4 && view.every(Number.isFinite) ? [view[0], view[1], view[2], view[3]] : null,
    raw: d
  };
}

/** Welche Option richtig ist (−1: keine, nur Meinung). */
export function answerIndex(ask: Ask, drawn: Drawn): number {
  const a = ask.answer;
  if (typeof a === 'number') return Number.isInteger(a) && a >= 0 && a < ask.options.length ? a : -1;
  if (typeof a !== 'string') return -1;
  if (a.trim().startsWith('=')) { const i = Math.round(num(a, drawn, -1)); return i >= 0 && i < ask.options.length ? i : -1; }
  const want = str(a, drawn);
  return ask.options.findIndex((o) => str(o, drawn) === want);
}

/** Die gezogenen Werte (ein Same: wiederholbar). */
export function drawChem(scene: ChemScene, seed: string | null): Drawn {
  if (scene.vars.length === 0) return NO_DRAW;
  return drawVars(scene.vars, seed === null ? Math.random : seeded(seed));
}

/** Ein Reagenz aus dem Dokument (mit gezogenem Text) — nur, wenn es das gibt. */
export const reagentIn = (value: unknown, drawn: Drawn): string | null => {
  const id = str(value, drawn);
  return reagentOf(id) === undefined ? null : id;
};

/* -- Bauen -------------------------------------------------------------------------------------------- */

/** Wie hoch und breit ein Ding ungefähr ist (cm) — für die Grösse der Welt. */
function extent(s: ThingSpec): [number, number] {
  const k = s.kind;
  if (isContainer(k)) {
    const v = s.size ?? 250;
    if (k === 'tube') return [2.4, 16];
    if (k === 'burette') return [2, 40];
    if (k === 'cylinder') return [Math.cbrt(v) * 1.1, Math.cbrt(v) * 5];
    if (k === 'trough') return [Math.sqrt(v / 18) * 2 + 1, Math.sqrt(v / 18)];
    return [Math.cbrt(v) * 2, Math.cbrt(v) * 2.2];
  }
  if (k === 'tripod') return [11, s.height ?? 17];
  if (k === 'stand') return [20, 46];
  if (k === 'burner') return [6, 13];
  if (k === 'hotplate') return [12, 3];
  if (k === 'thermometer' || k === 'rod' || k === 'splint' || k === 'loop' || k === 'spoon') return [2, s.size ?? 20];
  return [4, 7];
}

/**
 * DIE WELT AUS DEM DOKUMENT: die Dinge in ihrer Reihenfolge (was auf oder in
 * einem anderen steht, nach ihm), gefüllt und im Gleichgewicht, Brenner an,
 * Kerzen angezündet; dann `before` (sofort) und `warm` (schnell vorgespult).
 * Beobachtungen und Zeit beginnen danach bei null.
 */
export function buildWorld(scene: ChemScene, drawn: Drawn, rand: () => number = Math.random): World {
  let x0 = Infinity;
  let x1 = -Infinity;
  let top = 30;
  for (const s of scene.things) {
    const [w, h] = extent(s);
    const x = num(s.x ?? 0, drawn, 0);
    x0 = Math.min(x0, x - w / 2);
    x1 = Math.max(x1, x + w / 2);
    top = Math.max(top, num(s.y ?? 0, drawn, 0) + h + 22);
  }
  if (!Number.isFinite(x0)) { x0 = -15; x1 = 15; }
  const width = scene.world.width ?? Math.max(30, x1 - x0 + 24);
  const mid = (x0 + x1) / 2;
  const height = Math.min(90, scene.world.height ?? top);
  const world = new World(mid - width / 2, mid + width / 2, height, scene.world.depth, scene.room, rand);
  const placed = new Map<string, Thing>();
  const pending = [...scene.things];
  for (let pass = 0; pass < 4 && pending.length > 0; pass += 1) {
    for (let k = 0; k < pending.length; k += 1) {
      const s = pending[k];
      if ((s.on !== null && !placed.has(s.on) && scene.things.some((u) => u.id === s.on)) || (s.into !== null && !placed.has(s.into) && scene.things.some((u) => u.id === s.into))) continue;
      pending.splice(k, 1);
      k -= 1;
      const t = placeSpec(world, s, drawn, placed);
      if (t !== null) placed.set(s.id, t);
    }
  }
  for (const a of scene.before) perform(world, a, drawn, true);
  const steps = Math.round(scene.warm * 15);
  for (let k = 0; k < steps; k += 1) world.step(1 / 15);
  world.log.length = 0;
  world.forget('');
  world.time = 0;
  return world;
}

function placeSpec(world: World, s: ThingSpec, drawn: Drawn, placed: ReadonlyMap<string, Thing>): Thing | null {
  const on = s.on === null ? undefined : placed.get(s.on);
  const into = s.into === null ? undefined : placed.get(s.into);
  const yv = s.y === null ? undefined : num(s.y, drawn, 0);
  const t = world.place(s.kind, s.id, {
    x: on !== undefined ? on.x : s.x !== null ? num(s.x, drawn, 0) : into?.x ?? 0,
    ...(yv === undefined ? {} : { y: yv }),
    ...(on === undefined ? {} : { on }),
    ...(into === undefined ? {} : { into }),
    ...(s.size === null ? {} : { size: s.size }),
    ...(s.of === null ? {} : { of: s.of }),
    ...(s.held === null ? {} : { held: s.held }),
    ...(s.height === null ? {} : { height: s.height }),
    angle: (s.angle * Math.PI) / 180,
    label: str(s.label, drawn)
  });
  t.hidden = s.hidden;
  if (s.kind === 'piece' && into === undefined && yv === undefined) world.drop(t);
  if (t.kind === 'burner') { t.air = s.air ?? 1; t.flow = s.flow ?? 0.6; if (s.lit) world.burner(t, true); }
  if (t.kind === 'hotplate') { t.air = s.power ?? 300; t.on = s.lit; t.stir = s.stir; }
  if (t.kind === 'burette' && s.flow !== null) t.flow = s.flow;
  if (s.content !== null) restore(world, t, s.content);
  if (s.gas !== null) {
    const sum = Object.values(s.gas).reduce((a, b) => a + (b ?? 0), 0) || 1;
    const x = new Array<number>(NG).fill(0);
    for (const [g, v] of Object.entries(s.gas)) { const gi = GASI[g]; if (gi !== undefined) x[gi] = (v ?? 0) / sum; }
    world.fillGasMix(t, x);
  }
  for (const f of s.fill) {
    const id = reagentIn(f.reagent, drawn);
    if (id === null) continue;
    const r = reagentOf(id);
    world.add(id, num(f.amount, drawn, r?.amounts[Math.min(1, (r?.amounts.length ?? 1) - 1)] ?? 10), t, null, true);
  }
  if (s.fill.length > 1) world.blend(t);
  if (s.T !== null) world.warmTo(t, num(s.T, drawn, 20) + 273.15);
  if (s.closed) world.stopper(t);
  if (t.kind === 'candle' && s.lit) world.ignite(...wickOf(t));
  return t;
}

/* -- Handeln ----------------------------------------------------------------------------------------- */

const at2 = (p: XY, drawn: Drawn): [number, number] => [num(p[0], drawn, 0), num(p[1], drawn, 0)];

/**
 * EINE HANDLUNG: was ein Schritt tut, was „vorher” schon geschah. `instant`:
 * ohne Bewegung (Umgiessen sofort, Verschieben ohne Weg) — die Bühne spielt
 * Giessen und Verschieben sonst vor (`ChemLab.tsx`).
 */
export function perform(world: World, a: Action, drawn: Drawn, instant: boolean): void {
  const thing = (id: string | null) => (id === null ? undefined : world.thing(id));
  switch (a.kind) {
    case 'add': {
      const id = reagentIn(a.reagent, drawn);
      const r = id === null ? undefined : reagentOf(id);
      if (id === null || r === undefined) return;
      const to = thing(a.to) ?? null;
      world.add(id, num(a.amount, drawn, r.amounts[0] ?? 1), to, a.at === null ? null : at2(a.at, drawn), instant && to !== null);
      return;
    }
    case 'pour': {
      const from = thing(a.from);
      const to = thing(a.to);
      if (from !== undefined && to !== undefined && instant) world.transfer(from, to, a.ml);
      return;
    }
    case 'move': {
      const t = thing(a.id);
      if (t === undefined) return;
      const on = thing(a.on);
      const into = thing(a.into);
      if (into !== undefined && into.prof !== null) { world.move(t, into.x, into.y + into.prof.t + 0.05); if (!t.held) world.drop(t); return; }
      if (on !== undefined) { const seat = on.kind === 'tripod' || on.kind === 'stand' ? on.y + on.height : on.kind === 'hotplate' ? on.y + 2.4 : on.y; world.move(t, on.x, seat); return; }
      if (a.to !== null) { const [x, y] = at2(a.to, drawn); world.move(t, x, y); }
      return;
    }
    case 'burner': {
      const t = thing(a.id);
      if (t === undefined || t.kind !== 'burner') return;
      if (a.air !== null) t.air = Math.max(0, Math.min(1, a.air));
      if (a.gas !== null) t.flow = Math.max(0.05, Math.min(1, a.gas));
      world.burner(t, a.on);
      return;
    }
    case 'heat': {
      const t = thing(a.id);
      if (t === undefined || t.kind !== 'hotplate') return;
      if (a.power !== null) t.air = Math.max(0, Math.min(1500, a.power));
      if (a.stir !== null) t.stir = a.stir;
      t.on = a.on;
      world.poke();
      return;
    }
    case 'ignite': {
      const t = thing(a.id);
      if (t?.kind === 'candle') world.ignite(...wickOf(t));
      else if (t?.kind === 'burner') world.burner(t, true);
      else if (t !== undefined) world.ignite(...mouthOf(t));
      else if (a.at !== null) world.ignite(...at2(a.at, drawn));
      return;
    }
    case 'use': {
      const t = thing(a.at);
      if (t !== undefined) useTool(world, a.tool, t);
      return;
    }
    case 'flame': {
      const b = thing(a.burner);
      const loop = world.things.find((u) => u.kind === 'loop');
      if (b === undefined || loop === undefined) return;
      const [x, y] = nozzleOf(b);
      world.move(loop, x, y + 2.5);
      return;
    }
    case 'tap': { const t = thing(a.id); if (t?.kind === 'burette') world.tap(t, a.rate); return; }
    case 'tilt': { const t = thing(a.id); if (t !== undefined) world.tilt(t, (a.angle * Math.PI) / 180); return; }
    case 'speed': return;
  }
}

/** Ein Werkzeug an einem Ding (aus einem Schritt — auf der Bühne nimmt man es in die Hand). */
export function useTool(world: World, tool: ToolKey, t: Thing): void {
  const [mx, my] = mouthOf(t);
  switch (tool) {
    case 'match': if (t.kind === 'burner') world.burner(t, true); else if (t.kind === 'candle') world.ignite(...wickOf(t)); else world.ignite(mx, my + CELL); return;
    case 'splint': case 'glow': {
      /* Den Span mit der Spitze in die Öffnung halten — von oben in ein Glas, von unten in ein umgedrehtes. */
      const depth = t.prof !== null ? Math.min(2.5, t.prof.H * 0.25) : 1;
      const [tx, ty] = t.prof !== null ? toWorld(t, 0, t.prof.top - depth) : [mx, my - 1];
      const s = world.splint(tx, ty + (Math.cos(t.angle) >= 0 ? 6 : -6), tool === 'glow');
      if (Math.cos(t.angle) < 0) world.tilt(s, Math.PI);
      world.move(s, tx, ty);
      return;
    }
    case 'loop': {
      const loop = world.things.find((u) => u.kind === 'loop') ?? world.place('loop', 'drucik', { x: mx, y: my + 2, held: true });
      const low = lowestLiquid(world, t);
      world.move(loop, mx, low ?? my - 1);
      return;
    }
    case 'stir': world.stir(t); return;
    case 'stopper': world.stopper(t); return;
    case 'paper': {
      const pH = world.phAt(mx, (lowestLiquid(world, t) ?? my) + 0.2);
      world.say(`paper:${world.time.toFixed(1)}`, pH === null ? 'Papierek pozostaje suchy — w naczyniu nie ma cieczy.' : `Papierek wskaźnikowy barwi się: pH ≈ ${Math.round(pH)} (${pH < 6.5 ? 'odczyn kwasowy' : pH > 7.5 ? 'odczyn zasadowy' : 'odczyn obojętny'}).`, world.g.at(mx, my));
      return;
    }
    case 'thermometer': world.place('thermometer', `termometr-${world.things.length + 1}`, { x: t.x + (t.prof !== null ? t.prof.R * 0.4 : 0), into: t }); return;
    case 'empty': world.empty(t); return;
    case 'delete': world.remove(t); return;
    case 'probe': return;
  }
}

/** Die Höhe (Mitte) der obersten Zelle mit Flüssigkeit in einem Glas — `null`: leer. */
function lowestLiquid(world: World, t: Thing): number | null {
  const g = world.g;
  let top: number | null = null;
  for (const i of t.cells) if (g.lq[i] === L.aq && g.own[i] === t.num && (top === null || g.cy(i) > top)) top = g.cy(i);
  return top === null ? null : top - CELL;
}

/* -- Speichern ----------------------------------------------------------------------------------------- */

const r4 = (x: number) => Number(x.toPrecision(5));

/** Der Inhalt eines Glases als Daten: das Gelöste (mol), Feststoffe, Schmelzen, Gas (Anteile), Temperatur. */
function contentOf(world: World, t: Thing): Record<string, unknown> | null {
  if (t.prof === null) return null;
  const s = world.summary(t, false);
  const liquid: Record<string, number> = {};
  for (let k = 0; k < NC; k += 1) if (s.comp[k] > 1e-12) liquid[AQ[k]] = r4(s.comp[k]);
  const gas: Record<string, number> = {};
  const total = s.gas.reduce((a, b) => a + b, 0);
  if (total > 0) GASES.forEach((g, k) => { const x = s.gas[k] / total; if (x > 1e-4 && Math.abs(x - (g === 'N2' ? 0.7714 : g === 'O2' ? 0.207 : -1)) > 0.003) gas[g] = r4(x); });
  return {
    T: r4(s.T - 273.15),
    ...(Object.keys(liquid).length > 0 ? { liquid } : {}),
    ...(s.solids.size > 0 ? { solids: Object.fromEntries([...s.solids].map(([k, v]) => [k, r4(v)])) } : {}),
    ...(s.melts.size > 0 ? { melts: Object.fromEntries([...s.melts].map(([k, v]) => [k, r4(v)])) } : {}),
    ...(Object.keys(gas).length > 0 ? { gas } : {})
  };
}

/** Einen gespeicherten Inhalt zurück in ein Glas. */
function restore(world: World, t: Thing, raw: unknown): void {
  const c = record(raw);
  const liquid = record(c.liquid);
  const comp = new Float64Array(NC);
  AQ.forEach((id, k) => { const v = liquid[id]; if (typeof v === 'number' && v > 0) comp[k] = v; });
  const ml = aqVolume(comp, 0);
  if (ml > 0.01) {
    const T = world.room.T;
    const spec = specOf(comp, 0, T, null);
    const per = new Float64Array(NC);
    for (let k = 0; k < NC; k += 1) per[k] = comp[k] / ml;
    const b: Bottle = { comp: per, spec, hf: formHeat(comp, 0, spec) / ml };
    world.fillSettled(t, b, ml, T);
  }
  for (const [sp, n] of Object.entries(record(c.solids))) {
    const s = SOLI[sp];
    if (s === undefined || typeof n !== 'number' || !(n > 0)) continue;
    world.sprinkle(s, n, sp === 'ice' ? F.cast : F.powder, world.room.T, ...mouthOf(t), t);
  }
  for (const [sp, n] of Object.entries(record(c.melts))) {
    const s = SOLI[sp];
    if (s === undefined || typeof n !== 'number' || !(n > 0)) continue;
    world.sprinkle(s, n, F.cast, world.room.T, ...mouthOf(t), t);
  }
  /* Die Anteile, die gespeichert sind (was wie Luft war, fehlt) — der Rest ist Luft. */
  const x = new Array<number>(NG).fill(0);
  let sum = 0;
  for (const [g, v] of Object.entries(record(c.gas))) {
    const gi = GASI[g];
    if (gi === undefined || typeof v !== 'number' || !(v > 0)) continue;
    x[gi] = v;
    sum += v;
  }
  if (sum > 0) {
    const rest = Math.max(0, 1 - sum);
    for (let k = 0; k < NG; k += 1) x[k] = x[k] / Math.max(1, sum) + rest * AIR_X[k];
    world.fillGasMix(t, x);
  }
  world.settleSolids();
  if (typeof c.T === 'number') world.warmTo(t, c.T + 273.15);
}

/** Der Tisch, wie er jetzt steht — mit dem, was das Dokument über Regal, Werkzeuge, Sicht und Schritte sagte. */
export function sceneOfWorld(world: World, scene: ChemScene): Record<string, unknown> {
  const raw = scene.raw;
  const things = world.things.filter((t) => t.kind !== 'stopper').map((t) => {
    const content = contentOf(world, t);
    const closed = world.things.some((u) => u.kind === 'stopper' && u.onto === t.id);
    return {
      id: t.id, kind: t.kind, x: r4(t.x), y: r4(t.y),
      ...(t.prof !== null || t.kind === 'piece' || t.kind === 'rod' || t.kind === 'thermometer' ? { size: r4(t.size) } : {}),
      ...(t.kind === 'piece' || t.kind === 'rod' ? { of: t.of } : {}),
      ...(Math.abs(t.angle) > 1e-3 ? { angle: r4((t.angle * 180) / Math.PI) } : {}),
      ...(t.label === '' ? {} : { label: t.label }),
      ...(t.hidden ? { hidden: true } : {}),
      ...(t.held ? { held: true } : {}),
      ...(closed ? { closed: true } : {}),
      ...(t.kind === 'burner' ? { lit: t.on && t.lit, air: t.air, gas: t.flow } : {}),
      ...(t.kind === 'hotplate' ? { lit: t.on, power: t.air, ...(t.stir ? { stir: true } : {}) } : {}),
      ...(t.kind === 'candle' && t.on ? { lit: true } : {}),
      ...(t.kind === 'tripod' || t.kind === 'stand' ? { height: t.height } : {}),
      ...(content === null ? {} : { content })
    };
  });
  return {
    room: { T: r4(world.room.T - 273.15), p: r4(world.room.p) },
    ...(raw.world === undefined ? {} : { world: raw.world }),
    ...(raw.vars === undefined ? {} : { vars: raw.vars }),
    things,
    ...Object.fromEntries(['shelf', 'tools', 'allow', 'show', 'graph', 'steps', 'speed', 'view'].filter((k) => raw[k] !== undefined).map((k) => [k, raw[k]]))
  };
}

/** Was im Regal steht (Kennungen und Gruppen aufgelöst). */
export function shelfOf(scene: ChemScene): readonly string[] {
  if (scene.shelf === null) return REAGENTS.map((r) => r.id);
  const out: string[] = [];
  for (const s of scene.shelf) {
    if (reagentOf(s) !== undefined) { if (!out.includes(s)) out.push(s); continue; }
    for (const r of REAGENTS) if (r.group === s && !out.includes(r.id)) out.push(r.id);
  }
  return out;
}

/** Ein Wert eines Dings für den Schreiber: Thermometer (°C), Glas (Temperatur, pH, Druck des Gases darin). */
export function quantity(world: World, id: string, q: GraphOf): number {
  const t = world.thing(id);
  if (t === undefined) return Number.NaN;
  if (t.kind === 'thermometer') return q === 'T' ? t.readout : Number.NaN;
  if (t.prof === null) return Number.NaN;
  if (q === 'pH') return world.phOf(t) ?? Number.NaN;
  const s = world.summary(t, false);
  return q === 'T' ? s.T - 273.15 : s.P;
}


