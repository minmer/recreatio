/**
 * 2026-10-18 — DIE DINGE EINER WELT UND IHRE ARTEN, ÜBERSETZT (die Welt
 * selbst: `liveWorld.ts`): wie ein Ding gespeichert und als Antwort
 * abgegeben wird, wie eine Art übersetzt wird, was von der Zeit abhängt, und
 * in welcher Reihenfolge die Rechnungen aller Dinge laufen.
 *
 * <b>Die Reihenfolge folgt aus dem, was jede Rechnung liest</b>
 * (`Expr.links`): die ganze Masse einer Belke braucht die ganze Masse jedes
 * Kindes, die Lage eines Gewichts die Lage der Belke, an der es hängt. Nach
 * jeder Änderung des Baus werden die Rechnungen aller Dinge einmal
 * topologisch sortiert — danach läuft jede genau einmal, nach allem, was sie
 * braucht. Niemand muss eine Reihenfolge angeben; ein Kreis wird gemeldet.
 */

import type { Env, Expr } from './expr';
import { RELATIONS, SETS, type KindSpec, type Mood, type PropSpec } from './liveModel';

/** Ein Ding, wie es gespeichert, rückgängig gemacht und als Antwort abgegeben wird. */
export interface ThingShot {
  readonly id: string;
  readonly kind: string;
  readonly parent: string | null;
  readonly props: Readonly<Record<string, number>>;
}

export interface WorldShot {
  readonly things: readonly ThingShot[];
}

/**
 * Ein Bau aus fremden Daten (eine Antwort, ein eingefügter Text) — nur, was
 * wie Dinge aussieht; der Rest fällt weg. Ob die Dinge erlaubt sind, sagt
 * erst die Welt, wenn sie ihn nachspielt.
 */
export function readShot(value: unknown): WorldShot | null {
  const list = Array.isArray(value) ? value : typeof value === 'object' && value !== null ? (value as { things?: unknown }).things : null;
  if (!Array.isArray(list)) return null;
  const things = list.slice(0, 200).flatMap((raw): ThingShot[] => {
    if (typeof raw !== 'object' || raw === null) return [];
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.kind !== 'string') return [];
    const props: Record<string, number> = {};
    for (const [k, v] of Object.entries(typeof r.props === 'object' && r.props !== null ? r.props as Record<string, unknown> : {}).slice(0, 40)) {
      if (typeof v === 'number' && Number.isFinite(v)) props[k] = v;
    }
    return [{ id: r.id.slice(0, 32), kind: r.kind.slice(0, 32), parent: typeof r.parent === 'string' ? r.parent.slice(0, 32) : null, props }];
  });
  return things.length === 0 ? null : { things };
}

/** Was eine Welt melden kann — wie die Fehler des Programms. */
export interface WorldProblem {
  readonly where: string;
  readonly error: string;
  readonly source: string;
  readonly at: number;
}

export interface Assign {
  readonly name: string;
  readonly expr: Expr;
}

export interface PropRun {
  readonly spec: PropSpec;
  readonly min: Expr | null;
  readonly max: Expr | null;
  readonly made: Expr | null;
  readonly when: Expr | null;
}

/** Eine Rechnung einer Art: ob sie von der Zeit abhängt, und ob die Raten sie brauchen (dann läuft sie in jedem Zwischenschritt). */
export interface LetRun {
  readonly name: string;
  readonly expr: Expr;
  dynamic: boolean;
  stage: boolean;
}

export interface KindRun {
  readonly spec: KindSpec;
  readonly props: ReadonlyMap<string, PropRun>;
  readonly lets: readonly LetRun[];
  readonly state: readonly { readonly name: string; readonly init: Expr; readonly rate: Expr }[];
  readonly events: readonly { readonly when: Expr; readonly set: readonly Assign[]; readonly say: Expr | null; readonly mood: Mood }[];
  readonly drag: readonly Assign[];
  readonly tap: readonly Assign[];
  readonly readouts: readonly (Expr | null)[];
  /** Wann jede Anzeige zu sehen ist (`null`: immer). */
  readonly readoutShows: readonly (Expr | null)[];
  /** 2026-10-18 — wie ein Ding in der Bedienung heisst (`null`: nur die Art). */
  readonly brief: Expr | null;
}

export interface Thing {
  readonly id: string;
  readonly kind: KindRun;
  parent: Thing | null;
  children: Thing[];
  readonly env: Env;
  lock: true | ReadonlySet<string>;
  /** Je Ereignis der Art: scharf (wartet darauf, wahr zu werden)? */
  armed: boolean[];
}

/** Eine Rechnung eines Dings, an ihrer Stelle in der Reihenfolge. */
export interface Step {
  readonly t: Thing;
  readonly l: LetRun;
}

export const ZERO: Expr = { source: '0', run: () => 0, reads: [], constant: true, links: [] };

/** Womit eine Art übersetzt wird — die Namen eines Dings, und wohin ein Fehler geht. */
interface Compiler {
  readonly compile: (source: string, where: string) => Expr | null;
  readonly compileText: (source: string, where: string) => Expr | null;
  readonly report: (problem: WorldProblem) => void;
  readonly kindNames: ReadonlySet<string>;
}

/** Zuweisungen einer Art (Ziehen, Antippen, Ereignis) — nur an ihre eigenen Eigenschaften und Grössen. */
function assigns(c: Compiler, set: Readonly<Record<string, string>>, kind: KindSpec, where: string): Assign[] {
  const own = new Set([...kind.props.map((p) => p.name), ...kind.state.map((s) => s.name)]);
  const out: Assign[] = [];
  for (const [name, source] of Object.entries(set)) {
    if (!own.has(name)) { c.report({ where, error: `„${name}" nie jest własnością ani stanem rodzaju „${kind.name}"`, source: name, at: 0 }); continue; }
    const expr = c.compile(source, `${where} „${name}"`);
    if (expr !== null) out.push({ name, expr });
  }
  return out;
}

/** Eine Art übersetzen — einmal, wenn das Bild gebaut wird. */
export function compileKind(k: KindSpec, c: Compiler): KindRun {
  const where = `world.kinds „${k.name}"`;
  const props = new Map<string, PropRun>(k.props.map((p) => [p.name, {
    spec: p,
    min: p.min === null ? null : c.compile(p.min, `${where}.props „${p.name}".min`),
    max: p.max === null ? null : c.compile(p.max, `${where}.props „${p.name}".max`),
    made: p.new === null ? null : c.compile(p.new, `${where}.props „${p.name}".new`),
    when: p.when === null ? null : c.compile(p.when, `${where}.props „${p.name}".when`)
  }]));
  for (const name of [...k.edit, ...Object.keys(k.drag ?? {})]) {
    if (!props.has(name) && !k.state.some((s) => s.name === name)) c.report({ where, error: `„${name}" nie jest własnością tego rodzaju`, source: name, at: 0 });
  }
  for (const name of k.add) if (!c.kindNames.has(name)) c.report({ where: `${where}.can.add`, error: `nie ma rodzaju „${name}"`, source: name, at: 0 });
  return {
    spec: k,
    props,
    lets: k.lets.map((l) => ({ name: l.name, expr: c.compile(l.value, `${where}.let „${l.name}"`) ?? ZERO, dynamic: false, stage: false })),
    state: k.state.map((s) => ({ name: s.name, init: c.compile(s.value, `${where}.state „${s.name}".value`) ?? ZERO, rate: c.compile(s.rate, `${where}.state „${s.name}".rate`) ?? ZERO })),
    events: k.events.map((e, i) => ({
      when: c.compile(e.when, `${where}.events[${i}].when`) ?? ZERO,
      set: assigns(c, e.set, k, `${where}.events[${i}].set`),
      say: e.say === '' ? null : c.compileText(e.say, `${where}.events[${i}].say`),
      mood: e.mood
    })),
    drag: k.drag === null ? [] : assigns(c, k.drag, k, `${where}.drag`),
    tap: k.tap === null ? [] : assigns(c, k.tap.set, k, `${where}.tap`),
    readouts: k.readouts.map((r, i) => c.compile(r.value, `${where}.readouts[${i}]`)),
    readoutShows: k.readouts.map((r, i) => (r.show === null ? null : c.compile(r.show, `${where}.readouts[${i}].show`))),
    brief: k.brief === '' ? null : c.compileText(k.brief, `${where}.brief`)
  };
}

/**
 * WAS VON DER ZEIT ABHÄNGT (einer Grösse der Simulation — eines Dings oder
 * des Bildes —, durch die Rechnungen hindurch) und was davon die Raten
 * brauchen: nur das läuft in den Zwischenschritten von Runge-Kutta.
 */
export function classify(kinds: readonly KindRun[], globalDynamic: ReadonlySet<string>): void {
  const dynamic = new Set<string>([...globalDynamic, 't']);
  for (const k of kinds) for (const s of k.state) dynamic.add(s.name);
  let grew = true;
  while (grew) {
    grew = false;
    for (const k of kinds) {
      for (const l of k.lets) {
        if (!l.dynamic && l.expr.reads.some((r) => dynamic.has(r))) { l.dynamic = true; grew = true; }
        if (l.dynamic && !dynamic.has(l.name)) { dynamic.add(l.name); grew = true; }
      }
    }
  }
  const byName = new Map<string, LetRun[]>();
  for (const k of kinds) for (const l of k.lets) byName.set(l.name, [...(byName.get(l.name) ?? []), l]);
  const needed = new Set<string>();
  const queue = kinds.flatMap((k) => k.state.flatMap((s) => s.rate.reads));
  while (queue.length > 0) {
    const name = queue.pop()!;
    if (needed.has(name)) continue;
    needed.add(name);
    for (const l of byName.get(name) ?? []) queue.push(...l.expr.reads);
  }
  for (const k of kinds) for (const l of k.lets) l.stage = l.dynamic && needed.has(l.name);
}

const SET_STEPS: ReadonlySet<string> = new Set<string>(SETS);
const RELATION_STEPS: ReadonlySet<string> = new Set<string>(RELATIONS);

/** Der Bau, über den ein Weg geht: alle Dinge (Eltern vor Kindern), die obersten, je Kennung. */
interface Tree {
  readonly preorder: readonly Thing[];
  readonly roots: readonly Thing[];
  readonly byId: ReadonlyMap<string, Thing>;
}

function below(t: Thing): Thing[] {
  const out: Thing[] = [];
  const walk = (x: Thing) => { for (const c of x.children) { out.push(c); walk(c); } };
  walk(t);
  return out;
}

/** Die Dinge, die ein Weg (`children>parent`) von einem Ding aus erreicht — `outer` ist, wer die innerste Menge gefragt hat. */
function walk(tree: Tree, t: Thing, path: readonly string[]): readonly Thing[] {
  let set: readonly Thing[] = [t];
  const askers: (readonly Thing[])[] = [];
  for (const step of path) {
    const before = set;
    if (step === 'self') continue;
    if (step === 'parent') set = set.flatMap((x) => (x.parent === null ? [] : [x.parent]));
    else if (step === 'root') set = set.map((x) => { let r = x; while (r.parent !== null) r = r.parent; return r; });
    else if (step === 'outer') set = askers.length === 0 ? [] : askers[askers.length - 1];
    else if (step === 'children') set = set.flatMap((x) => x.children);
    else if (step === 'descendants') set = set.flatMap((x) => below(x));
    else if (step === 'siblings') set = set.flatMap((x) => (x.parent?.children ?? tree.roots).filter((y) => y !== x));
    else if (step === 'others') set = set.flatMap((x) => tree.preorder.filter((y) => y !== x && y.kind === x.kind));
    else if (step === 'things') set = tree.preorder;
    else if (step.startsWith('@')) { const u = tree.byId.get(step.slice(1)); set = u === undefined ? [] : [u]; }
    else set = tree.preorder.filter((x) => x.kind.spec.name === step);
    if (SET_STEPS.has(step) || (!RELATION_STEPS.has(step) && !step.startsWith('@'))) askers.push(before);
    if (set.length > 1) set = [...new Set(set)];
  }
  return set;
}

/**
 * DIE REIHENFOLGE DER RECHNUNGEN: jede Rechnung jedes Dings nach allem, was
 * sie liest (die eigenen, die der Kinder, des Elternteils, eines Dings beim
 * Namen). Ein Kreis (zwei Rechnungen, die einander brauchen) wird gemeldet
 * und in der Reihenfolge der Liste gerechnet.
 */
export function sortLets(tree: Tree, report: (problem: WorldProblem) => void): { order: Step[]; dynOrder: Step[]; stageOrder: Step[] } {
  const steps: Step[] = [];
  const at = new Map<Thing, Map<string, number>>();
  for (const t of tree.preorder) {
    const own = new Map<string, number>();
    for (const l of t.kind.lets) { own.set(l.name, steps.length); steps.push({ t, l }); }
    at.set(t, own);
  }
  const next: number[][] = steps.map(() => []);
  const need = steps.map(() => 0);
  steps.forEach(({ t, l }, i) => {
    for (const link of l.expr.links) {
      const path = link.split('>');
      const name = path.pop()!;
      for (const u of walk(tree, t, path)) {
        const j = at.get(u)?.get(name);
        if (j === undefined || j === i) continue;
        next[j].push(i);
        need[i] += 1;
      }
    }
  });
  const order: number[] = [];
  need.forEach((n, i) => { if (n === 0) order.push(i); });
  for (let q = 0; q < order.length; q += 1) {
    for (const k of next[order[q]]) { need[k] -= 1; if (need[k] === 0) order.push(k); }
  }
  if (order.length < steps.length) {
    const done = new Set(order);
    const stuck = steps.find((_, i) => !done.has(i))!;
    report({ where: `world.kinds „${stuck.t.kind.spec.name}".let „${stuck.l.name}"`, error: 'wartości liczone zależą od siebie w kółko — liczę je w kolejności z listy', source: stuck.l.name, at: 0 });
    steps.forEach((_, i) => { if (!done.has(i)) order.push(i); });
  }
  const sorted = order.map((i) => steps[i]);
  return { order: sorted, dynOrder: sorted.filter((s) => s.l.dynamic), stageOrder: sorted.filter((s) => s.l.stage) };
}
