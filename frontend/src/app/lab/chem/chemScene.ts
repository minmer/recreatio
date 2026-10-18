/**
 * 2026-10-18 — DER VERSUCH ALS DOKUMENT (Chemia): was auf dem Tisch steht
 * (Gefässe mit Inhalt, Brenner, Schläuche, Bürette, Gasspritze), was im Regal
 * ist, welche Werkzeuge es gibt, was man sieht (Werte, Zusammensetzung, Lupe),
 * ein Schreiber und die Schritte mit „Pokaż” — gespeichert im Baustein, der
 * Motor (`chemBench.ts`) ist Code.
 *
 * <b>Duldsam</b>: was fehlt, hat einen Standard; was nicht passt, fällt weg.
 * <b>Zufall</b>: `vars` ziehen Zahlen und Texte (eine unbekannte Salzlösung
 * „X”: `"reagent": "{sol}"`), Zahlen dürfen Rechnungen sein (`"=10 + k"`).
 */

import { NO_DRAW, drawVars, num, readVars, seeded, str, type Drawn, type LabVar } from '../labRandom';
import { GASES, REAGENTS, SPECIES, VESSELS, reagentOf, type GasId, type VesselKind } from './chemData';
import { Lab, SEAT, type ToolKey } from './chemBench';
import { Lump, Vessel, type LumpForm } from './chemVessel';

export type GraphOf = 'T' | 'pH' | 'p' | 'gas';

export type Action =
  | { readonly kind: 'add'; readonly reagent: unknown; readonly to: string; readonly amount: unknown }
  | { readonly kind: 'pour'; readonly from: string; readonly to: string; readonly ml: number }
  | { readonly kind: 'burner'; readonly id: string; readonly on: boolean }
  | { readonly kind: 'use'; readonly tool: ToolKey; readonly at: string }
  | { readonly kind: 'flame'; readonly burner: string; readonly with: 'loop' | 'spoon' }
  | { readonly kind: 'link'; readonly from: string; readonly to: string }
  | { readonly kind: 'seat'; readonly at: string; readonly burner: string | null }
  | { readonly kind: 'drip'; readonly at: string; readonly rate: number }
  | { readonly kind: 'speed'; readonly value: number };

export interface Ask {
  readonly q: string;
  readonly options: readonly string[];
  /** Die richtige Antwort: Text einer Option (darf `{name}` enthalten), ihre Nummer oder `"=Rechnung"` (die Nummer) — `null`: nur Meinung. */
  readonly answer: unknown;
  readonly why: string;
}

export interface Step {
  readonly say: string;
  readonly do: readonly Action[];
  readonly wait: number;
  readonly ask: Ask | null;
}

interface VesselSpec {
  readonly id: string;
  readonly type: VesselKind;
  readonly size: number;
  readonly x: unknown;
  readonly label: unknown;
  readonly hidden: boolean;
  readonly on: string | null;
  readonly closed: boolean;
  readonly gauge: boolean;
  readonly T: unknown;
  readonly fill: readonly { readonly reagent: unknown; readonly amount: unknown }[];
  readonly gas: Readonly<Partial<Record<GasId, number>>> | null;
  readonly over: string | null;
  readonly drip: number;
  readonly content: unknown;
}

export interface ChemScene {
  readonly room: { readonly T: number; readonly p: number };
  readonly vars: readonly LabVar[];
  readonly vessels: readonly VesselSpec[];
  readonly burners: readonly { readonly id: string; readonly x: unknown; readonly on: boolean; readonly air: boolean }[];
  readonly links: readonly { readonly from: string; readonly to: string }[];
  /** Was im Regal steht (Kennungen oder Gruppen) — `null`: alles. */
  readonly shelf: readonly string[] | null;
  readonly tools: readonly ToolKey[] | null;
  readonly allow: { readonly shelf: boolean; readonly vessels: boolean; readonly move: boolean; readonly burner: boolean };
  readonly show: { readonly values: boolean; readonly composition: boolean; readonly micro: boolean; readonly equations: boolean };
  readonly graph: { readonly vessels: readonly string[]; readonly of: readonly GraphOf[] } | null;
  readonly steps: readonly Step[];
  readonly speed: number;
  readonly view: readonly [number, number, number, number] | null;
  readonly raw: Readonly<Record<string, unknown>>;
}

export const TOOLS: readonly ToolKey[] = ['glow', 'splint', 'match', 'paper', 'wetpaper', 'loop', 'stir', 'stopper', 'gauge', 'tube', 'spoon', 'probe', 'empty', 'delete'];
const ID = /^[\p{L}\p{N}_-]{1,24}$/u;
const record = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v.trim() : fallback);
const finite = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const idOf = (v: unknown): string | null => { const s = text(v); return ID.test(s) ? s : null; };

function readAction(raw: unknown): Action | null {
  const a = record(raw);
  if (a.add !== undefined) { const to = idOf(a.to); return to === null ? null : { kind: 'add', reagent: a.add, to, amount: a.amount ?? null }; }
  if (a.pour !== undefined) { const from = idOf(a.pour); const to = idOf(a.to); return from === null || to === null ? null : { kind: 'pour', from, to, ml: Math.max(0.5, finite(a.ml, 10)) }; }
  if (a.burner !== undefined) { const id = idOf(a.burner); return id === null ? null : { kind: 'burner', id, on: a.on !== false }; }
  if (a.use !== undefined) { const at = idOf(a.at); const tool = text(a.use) as ToolKey; return at === null || !TOOLS.includes(tool) ? null : { kind: 'use', tool, at }; }
  if (a.flame !== undefined) { const id = idOf(a.flame); return id === null ? null : { kind: 'flame', burner: id, with: a.with === 'spoon' ? 'spoon' : 'loop' }; }
  if (a.link !== undefined) { const pair = list(a.link).map(idOf); return pair[0] && pair[1] ? { kind: 'link', from: pair[0], to: pair[1] } : null; }
  if (a.seat !== undefined) { const at = idOf(a.seat); return at === null ? null : { kind: 'seat', at, burner: idOf(a.on) }; }
  if (a.drip !== undefined) { const at = idOf(a.drip); return at === null ? null : { kind: 'drip', at, rate: Math.max(0, finite(a.rate, 0.5)) }; }
  if (a.speed !== undefined) return { kind: 'speed', value: Math.min(50, Math.max(0.25, finite(a.speed, 1))) };
  return null;
}

/** Das Dokument lesen — was nicht passt, fällt weg. */
export function readChemScene(doc: unknown): ChemScene {
  const d = record(doc);
  const room = record(d.room);
  const vessels: VesselSpec[] = [];
  for (const raw of list(d.vessels).slice(0, 16)) {
    const v = record(raw);
    const id = idOf(v.id);
    const type = text(v.type, 'beaker') as VesselKind;
    if (id === null || VESSELS[type] === undefined || vessels.some((x) => x.id === id)) continue;
    const sizes = VESSELS[type].sizes;
    const size = finite(v.size, sizes[Math.min(1, sizes.length - 1)]);
    const gas = record(v.gas);
    const gasMix: Partial<Record<GasId, number>> = {};
    for (const g of GASES) { const x = gas[g]; if (typeof x === 'number' && x > 0) gasMix[g] = x; }
    vessels.push({
      id, type, size: Math.min(2000, Math.max(5, size)), x: v.x ?? vessels.length * 14, label: v.label ?? '', hidden: v.hidden === true,
      on: idOf(v.on), closed: v.closed === true, gauge: v.gauge === true, T: v.T ?? null,
      fill: list(v.fill).slice(0, 12).map((f) => { const r = record(f); return { reagent: r.reagent, amount: r.amount ?? null }; }),
      gas: Object.keys(gasMix).length > 0 ? gasMix : null, over: idOf(v.over), drip: Math.max(0, finite(v.drip, 0)), content: v.content ?? null
    });
  }
  const burners = list(d.burners).slice(0, 4).map((raw) => record(raw)).flatMap((b) => {
    const id = idOf(b.id);
    return id === null ? [] : [{ id, x: b.x ?? 0, on: b.on === true, air: b.air !== false }];
  });
  const links = list(d.links).slice(0, 8).map((raw) => record(raw)).flatMap((k) => {
    const from = idOf(k.from);
    const to = idOf(k.to);
    return from === null || to === null ? [] : [{ from, to }];
  });
  const allow = record(d.allow);
  const show = record(d.show);
  const graph = record(d.graph);
  const of = list(graph.of).filter((q): q is GraphOf => q === 'T' || q === 'pH' || q === 'p' || q === 'gas');
  const gv = [...list(graph.vessels).map(idOf), idOf(graph.vessel)].filter((x): x is string => x !== null);
  const steps = list(d.steps).slice(0, 30).map((raw): Step => {
    const s = record(raw);
    const actions = Array.isArray(s.do) ? s.do : s.do === undefined ? [] : [s.do];
    const ask = record(s.ask);
    const options = list(ask.options).filter((o): o is string => typeof o === 'string').slice(0, 6);
    return {
      say: text(s.say),
      do: actions.map(readAction).filter((a): a is Action => a !== null),
      wait: Math.min(120, Math.max(0, finite(s.wait, 3))),
      ask: text(ask.q) !== '' && options.length > 1 ? { q: text(ask.q), options, answer: ask.answer ?? null, why: text(ask.why) } : null
    };
  });
  const view = list(d.view).map((x) => finite(x, Number.NaN));
  return {
    room: { T: finite(room.T, 20) + 273.15, p: finite(room.p, 101.325) },
    vars: readVars(d.vars),
    vessels,
    burners,
    links,
    shelf: Array.isArray(d.shelf) ? d.shelf.filter((x): x is string => typeof x === 'string') : null,
    tools: Array.isArray(d.tools) ? d.tools.filter((x): x is ToolKey => TOOLS.includes(x as ToolKey)) : null,
    allow: { shelf: allow.shelf !== false, vessels: allow.vessels === true, move: allow.move !== false, burner: allow.burner !== false },
    show: { values: show.values !== false, composition: show.composition !== false, micro: show.micro !== false, equations: show.equations !== false },
    graph: of.length > 0 && gv.length > 0 ? { vessels: gv.slice(0, 3), of } : null,
    steps,
    speed: Math.min(50, Math.max(0.25, finite(d.speed, 1))),
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

/** Die Welt aus dem Dokument: Gefässe gefüllt und im Gleichgewicht (ohne Meldungen), Brenner, Schläuche. */
export function buildLab(scene: ChemScene, drawn: Drawn): Lab {
  const lab = new Lab({ T: scene.room.T, p: scene.room.p });
  for (const b of scene.burners) lab.burners.push({ id: b.id, x: num(b.x, drawn, 0), on: b.on, air: b.air, tint: null, tintLeft: 0 });
  for (const s of scene.vessels) {
    const T = s.T === null ? scene.room.T : num(s.T, drawn, scene.room.T - 273.15) + 273.15;
    const v = new Vessel(s.id, s.type, s.size, num(s.x, drawn, 0), T, str(s.label, drawn));
    v.hidden = s.hidden;
    if (s.gas !== null) {
      v.gas.clear();
      const sum = Object.values(s.gas).reduce((a, b) => a + (b ?? 0), 0) || 1;
      const n = (scene.room.p * (v.gasMl() / 1000)) / (8.314 * T);
      for (const [g, x] of Object.entries(s.gas)) v.addGas(g as GasId, (n * (x ?? 0)) / sum);
    }
    lab.vessels.push(v);
    if (s.content !== null) restore(v, s.content);
    for (const f of s.fill) {
      const id = reagentIn(f.reagent, drawn);
      if (id === null) continue;
      const r = reagentOf(id);
      lab.add(v, id, num(f.amount, drawn, r?.amounts[Math.min(1, (r?.amounts.length ?? 1) - 1)] ?? 10));
    }
    v.equalize(scene.room.p);
    v.closed = s.closed || s.gauge;
    v.gauge = s.gauge;
    v.over = s.over;
    v.drip = s.drip;
    if (s.on !== null && lab.burners.some((b) => b.id === s.on)) {
      const b = lab.burners.find((x) => x.id === s.on);
      if (b !== undefined) { v.x = b.x; v.y = SEAT; }
    }
    for (const l of v.lumps) { l.y = l.form === 'candle' ? 0 : 0; l.vy = 0; }
  }
  for (const v of lab.vessels) {
    if (v.kind !== 'burette' || v.over === null) continue;
    const t = lab.vessel(v.over);
    if (t !== undefined) { v.x = t.x; v.y = t.y + t.shape.H + 3; }
  }
  for (const k of scene.links) {
    const a = lab.vessel(k.from);
    const b = lab.vessel(k.to);
    if (a !== undefined && b !== undefined) lab.connect(a, b);
  }
  /* Was beim Füllen schon reagieren kann, soll vor dem Start nicht als Beobachtung erscheinen. */
  for (const v of lab.vessels) { lab.settle(v); v.seen.clear(); v.events.length = 0; }
  lab.log.length = 0;
  lab.time = 0;
  return lab;
}

/* -- Speichern ------------------------------------------------------------------------------------ */

const r4 = (x: number) => Number(x.toPrecision(5));

/** Der Inhalt eines Gefässes als Daten (für „Zapisz” und das JSON der Piaskownica). */
function contentOf(v: Vessel): Record<string, unknown> {
  return {
    T: r4(v.T - 273.15),
    water: r4(v.water),
    aq: Object.fromEntries([...v.aq].map(([k, n]) => [k, r4(n)])),
    lumps: v.lumps.map((l) => ({ sp: l.sp, n: r4(l.n), form: l.form, ...(l.where === 'spoon' ? { spoon: true } : {}), ...(l.burning ? { burning: true } : {}) })),
    gas: Object.fromEntries([...v.gas].map(([k, n]) => [k, r4(n)]))
  };
}

const FORMS: readonly LumpForm[] = ['piece', 'granules', 'powder', 'ribbon', 'crystals', 'precipitate', 'candle'];

/** Einen gespeicherten Inhalt zurück in ein Gefäss. */
function restore(v: Vessel, raw: unknown): void {
  const c = record(raw);
  if (typeof c.T === 'number') v.T = c.T + 273.15;
  v.water = Math.max(0, finite(c.water, 0));
  v.aq.clear();
  for (const [k, n] of Object.entries(record(c.aq))) if (typeof n === 'number' && n > 0 && (SPECIES[k] !== undefined || ['C', 'Ac', 'N', 'S'].includes(k) || k.startsWith('ind:'))) v.aq.set(k, n);
  v.lumps = list(c.lumps).flatMap((raw2) => {
    const l = record(raw2);
    const sp = text(l.sp);
    const n = finite(l.n, 0);
    const form = text(l.form) as LumpForm;
    if (SPECIES[sp] === undefined || !(n > 0) || !FORMS.includes(form)) return [];
    const lump = new Lump(sp, n, form, (Math.random() * 2 - 1) * 0.5, 0);
    if (l.spoon === true) lump.where = 'spoon';
    lump.burning = l.burning === true;
    if (form === 'precipitate') lump.suspended = 0;
    return [lump];
  });
  const gas = record(c.gas);
  if (Object.keys(gas).length > 0) {
    v.gas.clear();
    for (const g of GASES) { const n = gas[g]; if (typeof n === 'number' && n > 0) v.addGas(g, n); }
  }
}

/** Der Tisch, wie er jetzt steht — mit dem, was das Dokument über Regal, Werkzeuge, Sicht und Schritte sagte. */
export function sceneOfLab(lab: Lab, scene: ChemScene): Record<string, unknown> {
  const raw = scene.raw;
  return {
    room: { T: r4(lab.room.T - 273.15), p: r4(lab.room.p) },
    ...(raw.vars === undefined ? {} : { vars: raw.vars }),
    vessels: lab.vessels.map((v) => ({
      id: v.id, type: v.kind, size: v.size, x: Math.round(v.x * 10) / 10,
      ...(v.label === '' ? {} : { label: v.label }),
      ...(v.hidden ? { hidden: true } : {}),
      ...(lab.burnerOf(v) === null ? {} : { on: lab.burnerOf(v)?.id }),
      ...(v.closed ? { closed: true } : {}),
      ...(v.gauge ? { gauge: true } : {}),
      ...(v.over === null ? {} : { over: v.over, drip: v.drip }),
      content: contentOf(v)
    })),
    ...(lab.burners.length > 0 ? { burners: lab.burners.map((b) => ({ id: b.id, x: Math.round(b.x * 10) / 10, on: b.on, air: b.air })) } : {}),
    ...(lab.links.length > 0 ? { links: lab.links.map((k) => ({ from: k.from, to: k.to })) } : {}),
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

/** Die Grenzen dessen, was auf dem Tisch steht (cm) — für „Dopasuj widok”: eng um das Glas, mit Platz für die Beschriftung. */
export function boundsOf(lab: Lab): [number, number, number, number] {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y1 = 8;
  for (const v of lab.vessels) {
    const w = v.kind === 'syringe' ? v.shape.H / 2 + 4 : v.shape.R + 2.5;
    x0 = Math.min(x0, v.x - w);
    x1 = Math.max(x1, v.x + w + (v.gauge ? 9 : 0) + (v.kind === 'syringe' ? v.shape.H * 1.2 : 0));
    y1 = Math.max(y1, v.y + v.shape.H + (v.closed ? 3 : 2.5) + (lab.links.some((k) => k.from === v.id || k.to === v.id) ? 5 : 0));
  }
  for (const b of lab.burners) { x0 = Math.min(x0, b.x - 7); x1 = Math.max(x1, b.x + 9); y1 = Math.max(y1, 20); }
  if (!Number.isFinite(x0)) { x0 = -20; x1 = 20; }
  return [x0, -5, x1, y1];
}
