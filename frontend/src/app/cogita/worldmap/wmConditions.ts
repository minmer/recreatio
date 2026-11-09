/**
 * 2026-11-09 — BEDINGUNGEN ALS BAUSTEINE (spec §10): Fahrkarten und die Freigabe eines Durchgangs sind Bedingungen in
 * derselben Form wie in den Abläufen (`logic.ts`: and, or, not, xor, knowness, value, flow …). Jeder Typ hat einen
 * Auswerter mit derselben Schnittstelle — neue Typen (Gruppe, Ort, Code, QR, Zeit) kommen über `register` hinzu, ohne
 * Umbau.
 * <code>
 *   prepare    asynchron (Gerät, Code, Gruppe): einmal vorbereitet, dann gelesen; noch nicht vorbereitet = „pending"
 *   evaluate   synchron über dem Vorbereiteten — der Weg (Dijkstra) und der Plan rechnen damit
 *   cost       für Weg und Plan; Wissen: 4 je neue Karte, 1,5 je Wiederholung
 *   describe   Symbol, Textschlüssel (`cogitaWorld.condition.*`), Handlung für das Panel
 * </code>
 * <b>Geschlossen bei Unbekanntem</b> (Entscheidung 10): ein unbekannter Typ ist „nicht erfüllt, unbekannter Typ" — nur hier,
 * für Fahrkarten und Freigaben; die Abläufe selbst bleiben, wie sie sind. <b>Nur Bänder der Karten</b> (Korrektur 1): nie
 * der Durchschnitt eines Themas.
 */

import { compare, CONDITION_TYPES, holds, inBand, readCondition, KNOWNESS_BANDS, type CompareOp, type Condition, type Facts, type KnownessBand } from '../logic';
import type { Lines, WmCondition, World } from './wmTypes';

/** Das Schloss an einem Abschnitt hängt vom Typ der fehlenden Bedingung ab (§4.4, §10.3). */
export type LockSymbol = 'knowledge' | 'review' | 'story' | 'value' | 'time' | 'place' | 'unknown';

/** Was über den Lernenden bekannt ist — dazu der Ort, um den es geht, und was der Abschnitt selbst einführt. */
export interface LearnerContext {
  readonly world: World;
  readonly lines: Lines;
  /** Die Kenntnis einer Karte (0: nie gefragt). */
  readonly knowness: (card: string) => number;
  readonly facts: Facts;
  /** Ist diese Erzählung bestanden (zu Ende mit ihren Zielen, oder jede Pflichtfrage gekonnt)? */
  readonly storyPassed: (flow: string) => boolean;
  /** Der Ort, auf den sich eine relative Bedingung bezieht (`rel`): das Ziel des Abschnitts, der Ort des Durchgangs. */
  readonly subject?: string;
  /** Karten, die der Abschnitt selbst einführt — seine eigene Fahrkarte verlangt sie nicht. */
  readonly exclude?: ReadonlySet<string>;
  /** Ist ein Ort erobert (die Freigabe eines Durchgangs, `wmRuns.ts`)? */
  readonly conquered?: (place: string) => boolean;
  /** Was `prepare` geliefert hat, je Bedingung (`conditionKey`). */
  readonly prepared?: ReadonlyMap<string, unknown>;
}

export interface Missing {
  readonly new: readonly string[];
  readonly review: readonly string[];
}

export interface ConditionResult {
  readonly met: boolean;
  /** 0–1: wie viel schon erfüllt ist. */
  readonly progress?: number;
  readonly missing?: Missing;
  /** Noch nicht vorbereitet (eine asynchrone Bedingung): gilt als nicht erfüllt. */
  readonly pending?: boolean;
  readonly unknown?: boolean;
}

export interface ConditionView {
  readonly symbol: LockSymbol;
  /** Ein Schlüssel in `cogitaWorld.json`. */
  readonly key: string;
  readonly params?: Readonly<Record<string, string | number>>;
  readonly action?: 'learn' | 'review' | 'story' | 'none';
}

export interface ConditionEvaluator {
  readonly type: string;
  readonly symbol: LockSymbol;
  /** Aus dem JSON lesen (sonst bleibt das Objekt, wie es ist). */
  read?(raw: Readonly<Record<string, unknown>>): WmCondition | null;
  prepare?(c: WmCondition, ctx: LearnerContext): Promise<unknown>;
  evaluate(c: WmCondition, ctx: LearnerContext): ConditionResult;
  cost(c: WmCondition, ctx: LearnerContext, r: ConditionResult): number;
  describe(c: WmCondition, ctx: LearnerContext, r: ConditionResult): ConditionView;
}

/** Die Kosten (§6.3). */
export const COST_NEW = 4;
export const COST_REVIEW = 1.5;

const GATES = new Set(['and', 'or', 'not', 'xor']);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const asCondition = (c: WmCondition): Condition => c as unknown as Condition;
const sv = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/** Eine Bedingung als Schlüssel (für Vorbereitetes). */
export const conditionKey = (c: WmCondition): string => JSON.stringify(c);

/* -- Die Kartenbänder ------------------------------------------------------------------------------------------------------ */

export type CardBand = 'unseen' | 'learning' | 'known';

/** Das Band einer Karte — immer über `inBand` (Korrektur 1). `learning` heisst „do powtórki" (due). */
export function bandOf(knowness: number): CardBand {
  if (inBand(knowness, 'known')) return 'known';
  if (inBand(knowness, 'due')) return 'learning';
  return 'unseen';
}

/** Die Karten, auf die eine Kennung zeigt: ein Ort, ein Block, eine Frage, eine Karte, eine Einheit mit Linie, sonst was über sie fragt. */
export function cardsOfId(id: string, world: World, lines: Lines): string[] {
  const block = world.blocks.get(id);
  if (block !== undefined) return [...new Set(block.parts.flatMap((p) => world.places.get(p)?.cards ?? []))];
  const place = world.places.get(id);
  if (place !== undefined) return [...place.cards];
  const q = world.questionCards.get(id);
  if (q !== undefined) return [...q];
  if (world.cards.has(id)) return [id];
  for (const line of lines.lines.values()) if (line.unit === id || line.id === id) return lineCards(line.id, lines);
  return [...(world.aboutCards.get(id) ?? [])];
}

/** Was eine Linie einführt (alle ihre Abschnitte). */
export function lineCards(line: string, lines: Lines): string[] {
  const l = lines.lines.get(line);
  if (l === undefined) return [];
  const out = new Set<string>();
  for (const s of l.sections) for (const k of lines.sections.get(s)?.introduces ?? []) out.add(k);
  return [...out];
}

/** Die Karten einer relativen Bedingung (`rel`), gesehen vom Ort `subject`. */
function relCards(rel: string, subject: string | undefined, world: World, lines: Lines): string[] {
  if (subject === undefined) return [];
  const place = world.places.get(subject);
  const of = (ids: Iterable<string>) => [...new Set([...ids].flatMap((x) => cardsOfId(x, world, lines)))];
  switch (rel) {
    case 'self':
    case 'cards': return of([subject]);
    case 'core': return of([subject]).filter((k) => world.cards.get(k)?.core === true);
    case 'before': return of(place?.needs ?? []);
    case 'chain': return of(world.base(subject));
    case 'up': return of((world.entries.get(subject)?.refs ?? []).filter((r) => r.structure === 'up').map((r) => r.to));
    default: return of((world.entries.get(subject)?.refs ?? []).filter((r) => r.field === rel).map((r) => r.to));
  }
}

/** Eine Menge Karten gegen einen Test: was fehlt, neu (nie gesehen) oder zu wiederholen. */
function cardTest(cards: readonly string[], test: (k: number) => boolean, each: 'all' | 'any', ctx: LearnerContext): ConditionResult {
  const fresh: string[] = [];
  const review: string[] = [];
  let ok = 0;
  for (const card of cards) {
    const k = ctx.knowness(card);
    if (test(k)) { ok += 1; continue; }
    if (bandOf(k) === 'unseen') fresh.push(card); else review.push(card);
  }
  const total = cards.length;
  if (each === 'any') {
    if (ok > 0) return { met: true, progress: 1, missing: { new: [], review: [] } };
    if (total === 0) return { met: false, progress: 0, missing: { new: [], review: [] } };
    /* Einer genügt: der billigste fehlende. */
    return { met: false, progress: 0, missing: review.length > 0 ? { new: [], review: [review[0]] } : { new: [fresh[0]], review: [] } };
  }
  return { met: fresh.length === 0 && review.length === 0, progress: total === 0 ? 1 : ok / total, missing: { new: fresh, review } };
}

const knowledgeCost = (r: ConditionResult): number => (r.met ? 0 : COST_NEW * (r.missing?.new.length ?? 0) + COST_REVIEW * (r.missing?.review.length ?? 0) + ((r.missing?.new.length ?? 0) + (r.missing?.review.length ?? 0) === 0 ? 8 : 0));

const knowledgeView = (r: ConditionResult, key: string, extra: Record<string, string | number> = {}): ConditionView => {
  const fresh = r.missing?.new.length ?? 0;
  const review = r.missing?.review.length ?? 0;
  return {
    symbol: !r.met && fresh === 0 && review > 0 ? 'review' : 'knowledge',
    key, params: { new: fresh, review, ...extra },
    action: r.met ? 'none' : fresh > 0 ? 'learn' : review > 0 ? 'review' : 'none'
  };
};

/* -- Die eingebauten Auswerter ---------------------------------------------------------------------------------------------- */

const KNOWNESS: ConditionEvaluator = {
  type: 'knowness',
  symbol: 'knowledge',
  evaluate(c, ctx) {
    const ex = ctx.exclude;
    const rel = sv(c.rel);
    const of = sv(c.of);
    const cards = (rel !== undefined ? relCards(rel, ctx.subject, ctx.world, ctx.lines) : of !== undefined ? cardsOfId(of, ctx.world, ctx.lines) : [])
      .filter((k) => ex === undefined || !ex.has(k));
    const band = (KNOWNESS_BANDS as readonly string[]).includes(String(c.band)) ? (c.band as KnownessBand) : undefined;
    const op = (sv(c.op) ?? 'ge') as CompareOp;
    const than = String(typeof c.than === 'number' ? c.than : 1);
    const test = band !== undefined ? (k: number) => inBand(k, band) : (k: number) => compare(op, String(k), than);
    return cardTest(cards, test, c.each === 'any' ? 'any' : 'all', ctx);
  },
  cost: (_c, _ctx, r) => knowledgeCost(r),
  describe(c, ctx, r) {
    const of = sv(c.of);
    const name = of === undefined ? '' : ctx.world.places.get(of)?.label ?? ctx.world.blocks.get(of)?.label ?? ctx.world.entries.get(of)?.label ?? of;
    return knowledgeView(r, of === undefined ? 'cogitaWorld.condition.knowledgeRel' : 'cogitaWorld.condition.knowledge', { name, rel: sv(c.rel) ?? '' });
  }
};

/** „Diese Erzählung bestanden" — so liest die Weltkarte eine Einheit in „Wymaga" (Korrektur 4). */
const STORY: ConditionEvaluator = {
  type: 'story',
  symbol: 'story',
  evaluate(c, ctx) {
    const flow = sv(c.flow) ?? '';
    if (ctx.storyPassed(flow)) return { met: true, progress: 1, missing: { new: [], review: [] } };
    const r = cardTest(lineCards(flow, ctx.lines), (k) => inBand(k, 'known'), 'all', ctx);
    return { ...r, met: false };
  },
  /* Eine Erzählung zu bestehen kostet einen Schritt und die Karten ihrer Themen. */
  cost: (_c, _ctx, r) => (r.met ? 0 : 1 + COST_NEW * (r.missing?.new.length ?? 0) + COST_REVIEW * (r.missing?.review.length ?? 0)),
  describe(c, ctx, r) {
    const flow = sv(c.flow) ?? '';
    return { symbol: 'story', key: 'cogitaWorld.condition.story', params: { name: ctx.lines.lines.get(flow)?.name ?? flow, new: r.missing?.new.length ?? 0 }, action: r.met ? 'none' : 'story' };
  }
};

/** Eine Bedingung der einen Logik, die nur `holds` kennt (Werte, Antworten, Besuchtes, Zeit, Ort). */
const plain = (type: string, symbol: LockSymbol, unmet: number): ConditionEvaluator => ({
  type,
  symbol,
  evaluate: (c, ctx) => { const met = holds(asCondition(c), ctx.facts); return { met, progress: met ? 1 : 0 }; },
  cost: (_c, _ctx, r) => (r.met ? 0 : unmet),
  describe: (c) => ({ symbol, key: `cogitaWorld.condition.${type}`, params: { value: sv(c.value) ?? sv(c.of) ?? '' }, action: 'none' })
});

const FLOW: ConditionEvaluator = {
  type: 'flow',
  symbol: 'story',
  evaluate: (c, ctx) => { const met = holds(asCondition(c), ctx.facts); return { met, progress: met ? 1 : 0 }; },
  cost(c, ctx, r) {
    if (r.met) return 0;
    const cards = lineCards(sv(c.flow) ?? '', ctx.lines).filter((k) => !inBand(ctx.knowness(k), 'known'));
    return 1 + COST_NEW * cards.length;
  },
  describe: (c, ctx, r) => ({ symbol: 'story', key: 'cogitaWorld.condition.flow', params: { name: ctx.lines.lines.get(sv(c.flow) ?? '')?.name ?? sv(c.flow) ?? '' }, action: r.met ? 'none' : 'story' })
};

const UNKNOWN: ConditionEvaluator = {
  type: 'unknown',
  symbol: 'unknown',
  evaluate: () => ({ met: false, progress: 0, unknown: true }),
  cost: () => Infinity,
  describe: (c) => ({ symbol: 'unknown', key: 'cogitaWorld.condition.unknown', params: { type: sv(c.name) ?? '?' }, action: 'none' })
};

/** Die Tore: über ihren Teilen. */
const gate = (type: 'and' | 'or' | 'not' | 'xor'): ConditionEvaluator => ({
  type,
  symbol: 'knowledge',
  evaluate(c, ctx) {
    const parts = (c.items ?? []).map((i) => ({ c: i, r: evaluateCondition(i, ctx) }));
    const metCount = parts.filter((p) => p.r.met).length;
    const unknown = parts.some((p) => p.r.unknown === true);
    const pending = parts.some((p) => p.r.pending === true);
    const merge = (list: readonly { r: ConditionResult }[]): Missing => ({
      new: [...new Set(list.flatMap((p) => p.r.missing?.new ?? []))],
      review: [...new Set(list.flatMap((p) => p.r.missing?.review ?? []))]
    });
    switch (type) {
      case 'and': {
        const met = parts.length > 0 && metCount === parts.length;
        return { met, progress: parts.length === 0 ? 0 : parts.reduce((s, p) => s + (p.r.progress ?? (p.r.met ? 1 : 0)), 0) / parts.length, missing: merge(parts.filter((p) => !p.r.met)), ...(unknown ? { unknown } : {}), ...(pending ? { pending } : {}) };
      }
      case 'or': {
        if (metCount > 0) return { met: true, progress: 1, missing: { new: [], review: [] } };
        const best = parts.slice().sort((a, b) => costOf(a.c, ctx, a.r) - costOf(b.c, ctx, b.r))[0];
        return { met: false, progress: Math.max(0, ...parts.map((p) => p.r.progress ?? 0)), missing: best === undefined ? { new: [], review: [] } : merge([best]), ...(parts.every((p) => p.r.unknown === true) && parts.length > 0 ? { unknown: true } : {}) };
      }
      case 'xor': return { met: metCount % 2 === 1, progress: metCount % 2 === 1 ? 1 : 0, ...(unknown ? { unknown } : {}) };
      default: {
        const inner = parts[0];
        if (inner === undefined) return { met: false, progress: 0 };
        if (inner.r.unknown === true) return { met: false, progress: 0, unknown: true };
        return { met: !inner.r.met, progress: inner.r.met ? 0 : 1 };
      }
    }
  },
  cost(c, ctx, r) {
    if (r.met) return 0;
    if (r.unknown === true && type !== 'or') return Infinity;
    const parts = (c.items ?? []).map((i) => { const ir = evaluateCondition(i, ctx); return costOf(i, ctx, ir); });
    if (type === 'and') return parts.reduce((s, x) => s + x, 0);
    if (type === 'or') return parts.length === 0 ? Infinity : Math.min(...parts);
    /* Etwas zu vergessen oder eine Parität zu treffen ist kein Lernschritt: teuer, aber nicht unmöglich. */
    return 8;
  },
  describe(c, ctx, r) {
    const first = (c.items ?? []).map((i) => ({ i, ir: evaluateCondition(i, ctx) })).find((x) => !x.ir.met);
    if (type === 'and' && first !== undefined) return describeCondition(first.i, ctx, first.ir);
    return { symbol: r.unknown === true ? 'unknown' : 'value', key: `cogitaWorld.condition.${type}`, params: { count: (c.items ?? []).length }, action: 'none' };
  }
});

/* -- Die Registratur ------------------------------------------------------------------------------------------------------------ */

const REGISTRY = new Map<string, ConditionEvaluator>();

/** Einen Typ anmelden (ein neuer überschreibt einen gleichnamigen). */
export function register(ev: ConditionEvaluator): void { REGISTRY.set(ev.type, ev); }
export function unregister(type: string): void { if (!BUILT_IN.has(type)) REGISTRY.delete(type); }
export const evaluatorOf = (type: string): ConditionEvaluator => REGISTRY.get(type) ?? UNKNOWN;
export const knownType = (type: string): boolean => REGISTRY.has(type) && type !== 'unknown';

for (const ev of [KNOWNESS, STORY, FLOW, UNKNOWN, gate('and'), gate('or'), gate('not'), gate('xor'),
  plain('value', 'value', 4), plain('answered', 'value', 4), plain('visited', 'value', 4),
  plain('time', 'time', 6), plain('place', 'place', 8), plain('zone', 'place', 8)]) register(ev);
const BUILT_IN = new Set(REGISTRY.keys());

/**
 * EINE BEDINGUNG DER FAHRKARTE LESEN — wie `readCondition`, aber geschlossen: ein unbekannter Typ bleibt als
 * `{type: "unknown"}` stehen (auch tief in einem Tor), statt wegzufallen und das Tor zu öffnen.
 */
export function readTicketCondition(raw: unknown, depth = 0): WmCondition {
  if (!isObject(raw) || depth > 12) return { type: 'unknown', name: '', raw };
  const type = typeof raw.type === 'string' ? raw.type : '';
  if (GATES.has(type)) {
    const items = (Array.isArray(raw.items) ? raw.items : []).map((i) => readTicketCondition(i, depth + 1));
    return { type, items: type === 'not' ? items.slice(0, 1) : items };
  }
  const ev = REGISTRY.get(type);
  if (ev?.read !== undefined) { const c = ev.read(raw); if (c !== null) return c; }
  if ((CONDITION_TYPES as readonly string[]).includes(type)) {
    const c = readCondition(raw);
    if (c !== null) return c as unknown as WmCondition;
  }
  if (ev !== undefined && type !== 'unknown') return { ...raw, type } as WmCondition;
  return { type: 'unknown', name: type, raw };
}

/** Die unbekannten Typen in einer Bedingung (für die Liste der Autoren). */
export function unknownTypes(c: WmCondition): string[] {
  if (c.type === 'unknown') return [sv(c.name) ?? ''];
  return (c.items ?? []).flatMap(unknownTypes);
}

export function evaluateCondition(c: WmCondition, ctx: LearnerContext): ConditionResult {
  const ev = evaluatorOf(c.type);
  if (ev.prepare !== undefined && ctx.prepared?.has(conditionKey(c)) !== true) return { met: false, progress: 0, pending: true };
  return ev.evaluate(c, ctx);
}

export function costOf(c: WmCondition, ctx: LearnerContext, r: ConditionResult = evaluateCondition(c, ctx)): number {
  return evaluatorOf(c.type).cost(c, ctx, r);
}

export function describeCondition(c: WmCondition, ctx: LearnerContext, r: ConditionResult = evaluateCondition(c, ctx)): ConditionView {
  return evaluatorOf(c.type).describe(c, ctx, r);
}

/** Alles Asynchrone vorbereiten (Gerät, Code …); was fertig ist, kommt in `prepared` (Schlüssel: `conditionKey`). */
export async function prepareConditions(list: readonly WmCondition[], ctx: LearnerContext): Promise<Map<string, unknown>> {
  const out = new Map<string, unknown>(ctx.prepared ?? []);
  const walk = (c: WmCondition): WmCondition[] => [c, ...(c.items ?? []).flatMap(walk)];
  for (const c of list.flatMap(walk)) {
    const ev = evaluatorOf(c.type);
    if (ev.prepare === undefined || out.has(conditionKey(c))) continue;
    try { out.set(conditionKey(c), await ev.prepare(c, ctx)); } catch { /* bleibt „pending" */ }
  }
  return out;
}
