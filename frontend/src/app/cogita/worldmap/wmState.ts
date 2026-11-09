/**
 * 2026-11-09 — DER STAND EINES LERNENDEN AUF DER WELTKARTE (spec §6), bei jeder Änderung neu gerechnet, nie gespeichert.
 * <code>
 *   Karten     nur ihre Bänder (`inBand`, Korrektur 1): nie gesehen · zu wiederholen · gekonnt
 *   Ort        erobert: die letzte Stufe erreicht; mit 0 Stufen: der Anteil gekonnter Karten (Vorgabe: alle)
 *   Höhe       Σ der fehlenden Karten von Ort und Grundlage; mit Stufen zählt ein nicht eroberter Ort ganz, ohne Stufen nur seine
 *              nicht gekonnten Karten
 *   Fahrkarte  die Bedingungen des Abschnitts ausgewertet (`wmConditions.ts`); die eigenen Karten des Abschnitts verlangt sie nicht
 *   befahren   aus „besucht" und „zu Ende" (Korrektur 2) — monoton entlang eines Zweiges
 *   Weg        Dijkstra vom Haus über Abschnitte: 1 + 4·neu + 1,5·Wiederholung + andere offene Bedingungen − 0,5 (befahren)
 * </code>
 * Und `reviewable` (Korrektur 5): welche Karten in die Wiederholungen dürfen — überall dieselbe Regel.
 */

import type { Facts } from '../logic';
import { bandOf, describeCondition, evaluateCondition, costOf, type CardBand, type ConditionResult, type ConditionView, type LearnerContext, type LockSymbol, type Missing } from './wmConditions';
import { stepOwner } from './wmLines';
import { HOME, type Lines, type Section, type TicketPart, type World } from './wmTypes';

export interface FlowProgress {
  readonly visited: ReadonlySet<string>;
  readonly done: boolean;
}

/** Was über den Lernenden bekannt ist — reine Funktionen über seinem Stand. */
export interface LearnerInput {
  readonly now: number;
  /** Die Kenntnis einer Karte (0: nie gefragt). */
  readonly knowness: (card: string) => number;
  readonly facts: Facts;
  /** Die Stelle in einem Ablauf (besuchte Schritte, zu Ende). */
  readonly progress: (flow: string) => FlowProgress | undefined;
  /** Bestanden (zu Ende mit Zielen, oder jede Pflichtfrage gekonnt) — sonst: zu Ende. */
  readonly storyPassed?: (flow: string) => boolean;
  /** Die erreichte Stufe eines Ortes (aus den Durchgängen). */
  readonly level?: (place: string) => number;
  readonly prepared?: ReadonlyMap<string, unknown>;
  /** Step 3 · 1 — ausgesetzte Karten (der Lernende hat sie angehalten): nie gefragt, also nirgends gezählt. */
  readonly suspended?: (card: string) => boolean;
}

export interface WorldSettings {
  /** 0–5 Stufen. */
  readonly levels: number;
  /** Mit 0 Stufen: welcher Anteil der Karten gekonnt sein muss (0–1). */
  readonly knownShare: number;
}

export const DEFAULT_SETTINGS: WorldSettings = { levels: 0, knownShare: 1 };

export interface PlaceState {
  /** Die Karten des Ortes ohne die ausgesetzten — alle Zahlen unten zählen nur sie (Step 3 · 1). */
  readonly cards: readonly string[];
  readonly total: number;
  readonly unseen: number;
  readonly learning: number;
  readonly known: number;
  /** Jede Karte ist schon erschienen (gelernt oder besser). */
  readonly appeared: boolean;
  readonly level: number;
  readonly conquered: boolean;
  /** Was diesem Ort selbst noch fehlt (Karten). */
  readonly missing: number;
  /** Was bis hierher fehlt: der Ort und seine ganze Grundlage. */
  readonly height: number;
  /** Sättigung der Farbe (§4.2): nie gesehen · teilweise · voll (erste Stufe, ohne Stufen: erfüllt). */
  readonly saturation: 'never' | 'partly' | 'full';
  /** Der Punkt auf der Säule — nur auf eroberten Orten (§4.2): orange heisst „wiederholen". */
  readonly dot: 'green' | 'yellow' | 'orange' | null;
}

export interface TicketState {
  readonly met: boolean;
  /** Nichts Neues fehlt, nur Wiederholungen. */
  readonly reviewOnly: boolean;
  readonly unknown: boolean;
  readonly pending: boolean;
  /** Die Kosten der Bedingungen (ohne die 1 je Abschnitt). */
  readonly cost: number;
  readonly missing: Missing;
  /** Das Schloss: der Typ der ersten fehlenden Bedingung. */
  readonly symbol: LockSymbol | null;
  readonly parts: readonly { readonly part: TicketPart; readonly result: ConditionResult; readonly view: ConditionView }[];
}

export interface SectionState {
  readonly ticket: TicketState;
  readonly travelled: boolean;
  /** Die Kante im Weg (∞: nicht befahrbar). */
  readonly cost: number;
  /** Was der Abschnitt einführt und noch nie gesehen wurde. */
  readonly fresh: readonly string[];
}

export interface RouteSummary {
  readonly sections: number;
  readonly fresh: number;
  readonly review: number;
  readonly slides: number;
}

export interface CardSource {
  readonly section: string;
  readonly met: boolean;
  readonly travelled: boolean;
  readonly cost: number;
}

export interface WorldState {
  readonly world: World;
  readonly lines: Lines;
  readonly settings: WorldSettings;
  readonly ctx: LearnerContext;
  readonly band: (card: string) => CardBand;
  readonly places: ReadonlyMap<string, PlaceState>;
  readonly sections: ReadonlyMap<string, SectionState>;
  /** Der günstigste Weg vom Haus (Abschnitte), `null`: keiner. */
  routeTo(place: string): readonly string[] | null;
  /** Der Weg zusammengefasst, in seiner Reihenfolge: was ein früherer Abschnitt einführt, ist später nicht mehr neu. */
  summary(route: readonly string[]): RouteSummary;
  /** Die Reihenfolge der Eroberung: die nicht eroberte Grundlage, dann der Ort (topologisch). */
  conquestOrder(place: string): string[];
  /** Woher eine Karte kommt: die Abschnitte, die sie einführen, die billigsten zuerst (leer: direkt lernen). */
  sources(card: string): CardSource[];
}

const SOON = 1.5;

/** Die Höhe einer Säule (§6.2): 6 + 3,6·√Karten, höchstens 110; erobert flach. */
export const pillarHeight = (cards: number, conquered: boolean): number => (conquered ? 0 : Math.min(110, 6 + 3.6 * Math.sqrt(Math.max(0, cards))));

export function stateOf(world: World, lines: Lines, learner: LearnerInput, settings: WorldSettings = DEFAULT_SETTINGS): WorldState {
  const levels = Math.max(0, Math.min(5, Math.round(settings.levels)));
  const share = Math.max(0, Math.min(1, settings.knownShare));
  const knowCache = new Map<string, number>();
  const knowness = (card: string): number => { let k = knowCache.get(card); if (k === undefined) { k = learner.knowness(card); knowCache.set(card, k); } return k; };
  const band = (card: string): CardBand => bandOf(knowness(card));
  const storyPassed = learner.storyPassed ?? ((flow: string) => learner.progress(flow)?.done === true);

  /* -- Orte ----------------------------------------------------------------------------------------------------------------- */
  /*
    Step 3 · 1 — eine ausgesetzte Karte wird nie gefragt: sie zählt nirgends (Zahlen, „erschienen", Höhe, Punkt, Freigabe).
    Ein Ort ohne Karte, die noch zählt, hat nichts zu erobern: er gilt als erobert und sperrt nichts, was auf ihm baut.
  */
  const off = learner.suspended;
  const own = new Map<string, Omit<PlaceState, 'height'>>();
  for (const p of world.places.values()) {
    const cards = off === undefined ? p.cards : p.cards.filter((k) => !off(k));
    let unseen = 0;
    let learning = 0;
    let known = 0;
    let weakest = Infinity;
    for (const k of cards) {
      const b = band(k);
      if (b === 'unseen') unseen += 1; else if (b === 'learning') learning += 1; else known += 1;
      weakest = Math.min(weakest, knowness(k));
    }
    const total = cards.length;
    const empty = total === 0;
    const reached = levels === 0 ? 0 : Math.max(0, Math.min(levels, learner.level?.(p.id) ?? 0));
    const level = empty ? levels : reached;
    const conquered = empty || (levels === 0 ? known / total >= share - 1e-9 : level >= levels);
    const missing = conquered ? 0 : levels > 0 ? total : unseen + learning;
    const saturation = (empty || (levels > 0 ? level >= 1 : conquered)) ? 'full' : unseen < total ? 'partly' : 'never';
    const dot = !conquered || empty ? null : unseen + learning > 0 ? 'orange' : weakest < SOON ? 'yellow' : 'green';
    own.set(p.id, { cards, total, unseen, learning, known, appeared: unseen === 0, level, conquered, missing, saturation, dot });
  }
  /* Die Höhe über der Bitmenge der Grundlage (5 000 Orte: keine Mengen je Ort). */
  const miss = new Float64Array(world.bitOrder.length);
  world.bitOrder.forEach((id, i) => { miss[i] = own.get(id)?.missing ?? 0; });
  const places = new Map<string, PlaceState>();
  for (const [id, s] of own) {
    let h = s.missing;
    const bits = world.baseBits(id);
    if (bits !== undefined) for (let w = 0; w < bits.length; w += 1) { let x = bits[w]; while (x !== 0) { const t = x & -x; h += miss[(w << 5) + 31 - Math.clz32(t)]; x ^= t; } }
    places.set(id, { ...s, height: h });
  }

  const ctx: LearnerContext = {
    world, lines, knowness, facts: learner.facts, storyPassed, conquered: (p) => places.get(p)?.conquered === true,
    ...(learner.prepared === undefined ? {} : { prepared: learner.prepared }), ...(off === undefined ? {} : { suspended: off })
  };

  /* -- Fahrkarten ------------------------------------------------------------------------------------------------------------ */
  const ticketOf = (s: Section): TicketState => {
    const sctx: LearnerContext = { ...ctx, subject: s.to, exclude: new Set(s.introduces) };
    const parts = s.ticket.map((part) => {
      const result = evaluateCondition(part.condition, sctx);
      return { part, result, view: describeCondition(part.condition, sctx, result), cost: costOf(part.condition, sctx, result) };
    });
    const unmet = parts.filter((p) => !p.result.met);
    const fresh = [...new Set(unmet.flatMap((p) => p.result.missing?.new ?? []))];
    const review = [...new Set(unmet.flatMap((p) => p.result.missing?.review ?? []))];
    const cost = parts.reduce((sum, p) => sum + p.cost, 0);
    const unknown = unmet.some((p) => p.result.unknown === true);
    return {
      met: unmet.length === 0,
      reviewOnly: unmet.length > 0 && fresh.length === 0 && review.length > 0 && unmet.every((p) => p.view.symbol === 'review' || p.view.symbol === 'knowledge'),
      unknown,
      pending: unmet.some((p) => p.result.pending === true),
      cost,
      missing: { new: fresh, review },
      symbol: unmet.length === 0 ? null : unmet[0].view.symbol,
      parts: parts.map(({ part, result, view }) => ({ part, result, view }))
    };
  };

  /* -- Befahren: aus „besucht" und „zu Ende", monoton entlang eines Zweiges -------------------------------------------------------- */
  const seenStep = (s: Section, step: string): boolean => {
    const owner = stepOwner(lines, s.line, step);
    return learner.progress(owner.flow)?.visited.has(owner.step) === true || learner.progress(s.line)?.visited.has(owner.step) === true;
  };
  /* Befahren: sein letzter Schritt ist besucht — oder ein späterer Abschnitt desselben Zweiges hat schon begonnen. */
  const travelled = new Map<string, boolean>();
  for (const line of lines.lines.values()) {
    const done = learner.progress(line.id)?.done === true;
    for (const b of line.branches) {
      let laterStarted = false;
      for (let i = b.sections.length - 1; i >= 0; i -= 1) {
        const s = lines.sections.get(b.sections[i])!;
        if (s.kind === 'return') { travelled.set(s.id, done); continue; }
        const last = s.steps[s.steps.length - 1];
        const t: boolean = laterStarted || (last !== undefined && seenStep(s, last)) || (done && b.parent === null);
        travelled.set(s.id, t);
        laterStarted = t || s.steps.some((x) => seenStep(s, x));
      }
    }
  }

  const sections = new Map<string, SectionState>();
  for (const s of lines.sections.values()) {
    const ticket = ticketOf(s);
    const was = travelled.get(s.id) === true;
    sections.set(s.id, {
      ticket, travelled: was,
      cost: s.from === s.to || !Number.isFinite(ticket.cost) ? Infinity : 1 + ticket.cost - (was ? 0.5 : 0),
      fresh: s.introduces.filter((k) => band(k) === 'unseen')
    });
  }

  /* -- Der Weg vom Haus ------------------------------------------------------------------------------------------------------- */
  let dist: Map<string, number> | null = null;
  let prev: Map<string, string> | null = null;
  const dijkstra = () => {
    dist = new Map([[HOME, 0]]);
    prev = new Map();
    const outOf = new Map<string, Section[]>();
    for (const s of lines.sections.values()) { if (s.from === s.to) continue; const l = outOf.get(s.from) ?? []; l.push(s); outOf.set(s.from, l); }
    const done = new Set<string>();
    /* Ein kleiner binärer Haufen. */
    const heap: [number, string][] = [[0, HOME]];
    const push = (d: number, id: string) => { heap.push([d, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = (): [number, string] => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        for (;;) { const l = 2 * i + 1; const r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; }
      }
      return top;
    };
    while (heap.length > 0) {
      const [d, u] = pop();
      if (done.has(u)) continue;
      done.add(u);
      for (const s of outOf.get(u) ?? []) {
        const c = sections.get(s.id)!.cost;
        if (!Number.isFinite(c)) continue;
        const nd = d + Math.max(0.01, c);
        if (nd < (dist.get(s.to) ?? Infinity)) { dist.set(s.to, nd); prev.set(s.to, s.id); push(nd, s.to); }
      }
    }
  };
  const routeTo = (place: string): readonly string[] | null => {
    if (dist === null) dijkstra();
    if (place === HOME) return [];
    if (!dist!.has(place)) return null;
    const out: string[] = [];
    let at = place;
    let guard = 0;
    while (at !== HOME && guard < 100000) {
      guard += 1;
      const s = prev!.get(at);
      if (s === undefined) return null;
      out.unshift(s);
      at = lines.sections.get(s)!.from;
    }
    return out;
  };
  const summary = (route: readonly string[]): RouteSummary => {
    const taught = new Set<string>();
    const fresh = new Set<string>();
    const review = new Set<string>();
    let slides = 0;
    let count = 0;
    for (const id of route) {
      const s = lines.sections.get(id);
      const st = sections.get(id);
      if (s === undefined || st === undefined) continue;
      for (const k of st.ticket.missing.new) if (!taught.has(k)) fresh.add(k);
      for (const k of st.ticket.missing.review) review.add(k);
      for (const k of s.introduces) taught.add(k);
      if (!st.travelled) { slides += s.slides; count += 1; }
    }
    return { sections: count, fresh: fresh.size, review: review.size, slides };
  };

  const rank = new Map(world.order.map((id, i) => [id, i] as const));
  const conquestOrder = (place: string): string[] => {
    const all = [place, ...world.base(place)].filter((p) => places.get(p)?.conquered === false);
    return all.sort((a, b) => (world.places.get(a)!.depth - world.places.get(b)!.depth) || (rank.get(a)! - rank.get(b)!));
  };
  const sources = (card: string): CardSource[] => (lines.introducedBy.get(card) ?? [])
    .map((id) => { const st = sections.get(id)!; return { section: id, met: st.ticket.met, travelled: st.travelled, cost: st.cost }; })
    .sort((a, b) => (a.cost - b.cost) || (a.section < b.section ? -1 : 1));

  return { world, lines, settings: { levels, knownShare: share }, ctx, band, places, sections, routeTo, summary, conquestOrder, sources };
}

/**
 * KORREKTUR 5 — DARF DIESE KARTE IN DIE WIEDERHOLUNGEN? Mit 0 Stufen: ja (wie bisher). Mit 1–5 Stufen nur, wenn sie zu keinem
 * Ort gehört oder einer ihrer Orte erobert ist (§7.1: nur eroberte Orte werden wiederholt). Jede Stelle, die eine Wiederholung
 * oder eine Zahl fälliger Karten baut, fragt hier (`scripts/app-wm-review-guard-check.mjs`).
 */
export interface ReviewScope {
  readonly world: { readonly cardPlaces: ReadonlyMap<string, readonly string[]> };
  readonly settings: { readonly levels: number };
  readonly places: ReadonlyMap<string, { readonly conquered: boolean }>;
}

export function reviewable(card: string, state: ReviewScope | null | undefined): boolean {
  if (state === null || state === undefined || state.settings.levels === 0) return true;
  const places = state.world.cardPlaces.get(card);
  if (places === undefined || places.length === 0) return true;
  return places.some((p) => state.places.get(p)?.conquered === true);
}
