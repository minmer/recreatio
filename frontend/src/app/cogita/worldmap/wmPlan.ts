/**
 * 2026-11-09 — „PROWADŹ MNIE TUTAJ": DER PLAN (spec §8.1, Entscheidung 14). Nur für die Sitzung, nie ein gespeichertes Ziel
 * („Ustaw jako cel" bleibt, wie es ist).
 * <code>
 *   Reihenfolge  jeder nicht eroberte Ort der Grundlage des Ziels, topologisch, dann das Ziel; verlangt eine Fahrkarte einen Ort
 *                ausserhalb, kommt er davor
 *   je Ort       1. seine Karten einführen: der billigste Abschnitt, der sie einführt (eine gewählte Abzweigung gilt), sonst
 *                   „direkt lernen"
 *                2. Durchgänge bis zur letzten Stufe — eine Stufe, die auf ihren Abstand wartet, steht als „ab <Datum>" da, und
 *                   der Plan geht mit dem nächsten Ort weiter, der nicht wartet; ohne Stufen: die Karten lernen, bis sie sitzen
 *   je Schritt   `at`: ab wann er geht (Step 3 · 7). Der jetzige Schritt ist der erste mit at ≤ jetzt; ein wartender bleibt mit
 *                seinem Datum in der Liste und IST der Durchgang seiner Stufe (kein zweiter Schritt später) — kommt sein Tag,
 *                wird er (neu gerechnet: ein Durchgang mit demselben Schlüssel) der jetzige
 *   Abzweigung   je Fahrt die anderen Abschnitte, die dieselben Karten einführen (Folien, neue Karten, Wirkung auf die Summe)
 * </code>
 * Nach jeder Änderung des Lernstands neu gerechnet.
 */

import { COST_NEW, COST_REVIEW } from './wmConditions';
import type { WorldState } from './wmState';
import type { Section } from './wmTypes';

export const DAY = 24 * 60 * 60 * 1000;

export interface Alternative {
  readonly section: string;
  readonly slides: number;
  /** Wie viele der Karten des Ortes er einführt. */
  readonly covers: number;
  /** Andere Orte, deren neue Karten er dazu einführt (ein Abstecher, der mehr öffnet). */
  readonly opens: readonly string[];
  /** Wirkung auf die Summe (Kosten gegenüber der gewählten Fahrt). */
  readonly delta: number;
}

/** Step 3 · 7 — `at`: ab wann der Schritt geht (≤ `Plan.now`: jetzt; ein wartender: sein Datum; später: wenn der Plan dort ist). */
export type PlanStep = { readonly at: number } & (
  | { readonly kind: 'travel'; readonly place: string; readonly section: string; readonly cards: readonly string[]; readonly locked: boolean; readonly alternatives: readonly Alternative[] }
  | { readonly kind: 'learn'; readonly place: string; readonly cards: readonly string[] }
  | { readonly kind: 'run'; readonly place: string; readonly level: number }
  | { readonly kind: 'wait'; readonly place: string; readonly level: number; readonly from: number }
  | { readonly kind: 'know'; readonly place: string; readonly cards: readonly string[] });

export interface Plan {
  readonly target: string;
  /** Wann gerechnet (der Massstab für `PlanStep.at`). */
  readonly now: number;
  readonly places: readonly string[];
  readonly steps: readonly PlanStep[];
  /** Karten, die bis zum Ziel fehlen. */
  readonly cards: number;
}

export interface PlanOptions {
  /** Gewählte Abzweigungen dieser Sitzung: Ort → Abschnitt. */
  readonly choices?: ReadonlyMap<string, string>;
  /** Der Mindestabstand vor jeder Stufe (Tage; Index 0 = Stufe 1). */
  readonly gaps?: readonly number[];
  /** Wann eine Stufe eines Ortes erreicht wurde (aus den Durchgängen). */
  readonly reachedAt?: (place: string, level: number) => number | undefined;
}

export function plan(state: WorldState, target: string, opts: PlanOptions = {}): Plan {
  const { world, lines } = state;
  const levels = state.settings.levels;
  const now = state.ctx.facts.now.getTime();
  const introduced = new Set<string>();
  const known = (k: string) => state.band(k) !== 'unseen' || introduced.has(k);

  const simCost = (s: Section): number => {
    const st = state.sections.get(s.id)!;
    if (!Number.isFinite(st.ticket.cost)) return Infinity;
    const fresh = st.ticket.missing.new.filter((k) => !introduced.has(k)).length;
    const other = st.ticket.parts.filter((p) => !p.result.met && p.result.missing === undefined).reduce((sum, p) => sum + (p.view.symbol === 'unknown' ? Infinity : 4), 0);
    return 1 + COST_NEW * fresh + COST_REVIEW * st.ticket.missing.review.length + other - (st.travelled ? 0.5 : 0);
  };
  const candidates = (cards: readonly string[]): Section[] => {
    const ids = new Set(cards.flatMap((k) => lines.introducedBy.get(k) ?? []));
    return [...ids].map((id) => lines.sections.get(id)!).filter((s) => Number.isFinite(state.sections.get(s.id)!.ticket.cost));
  };
  const best = (place: string, cards: readonly string[], list: Section[]): Section | null => {
    if (list.length === 0) return null;
    const chosen = opts.choices?.get(place);
    const pinned = list.find((s) => s.id === chosen);
    if (pinned !== undefined) return pinned;
    const covers = (s: Section) => s.introduces.filter((k) => cards.includes(k)).length;
    return list.slice().sort((a, b) => (simCost(a) - simCost(b)) || (covers(b) - covers(a)) || (a.slides - b.slides) || (a.id < b.id ? -1 : 1))[0];
  };

  /* -- Die Reihenfolge, mit Orten, die eine Fahrkarte ausserhalb der Grundlage verlangt ------------------------------------- */
  const order: string[] = [];
  const placed = new Set<string>();
  const add = (place: string, guard: number) => {
    for (const p of state.conquestOrder(place)) {
      if (placed.has(p) || guard > 6) continue;
      /* Step 3 · 1 — nur Karten, die zählen (ohne ausgesetzte). */
      const cards = (state.places.get(p)?.cards ?? []).filter((k) => state.band(k) === 'unseen');
      const s = best(p, cards, candidates(cards));
      if (s !== null) {
        for (const part of state.sections.get(s.id)!.ticket.parts) {
          const of = part.part.condition.of;
          if (part.result.met || typeof of !== 'string' || !world.places.has(of) || placed.has(of) || of === p) continue;
          add(of, guard + 1);
        }
      }
      if (!placed.has(p)) { placed.add(p); order.push(p); }
    }
  };
  add(target, 0);

  /* -- Die Schritte, mit Wartezeiten zwischen den Stufen ------------------------------------------------------------------- */
  const steps: PlanStep[] = [];
  const level = new Map(order.map((p) => [p, state.places.get(p)?.level ?? 0] as const));
  const lastAt = new Map<string, number>();
  for (const p of order) { const l = level.get(p)!; const at = l > 0 ? opts.reachedAt?.(p, l) : undefined; if (at !== undefined) lastAt.set(p, at); }
  const conquered = (p: string) => state.places.get(p)?.conquered === true || (levels > 0 ? (level.get(p) ?? 0) >= levels : false);
  const introDone = new Set<string>();
  const waiting = new Set<string>();
  const gapOf = (lv: number) => Math.max(0, opts.gaps?.[lv - 1] ?? 0) * DAY;
  /* Die Zeit, bei der der Plan gerade ist (er rückt nur vor, wenn nichts anderes mehr geht). */
  let t = now;

  const introduce = (p: string) => {
    let open = (state.places.get(p)?.cards ?? []).filter((k) => !known(k));
    let guard = 0;
    const from = steps.length;
    /* Was der Plan für diesen Ort ohnehin fährt, ist eine Ergänzung, keine Abzweigung (zwei Linien bringen je andere Karten). */
    const settle = () => {
      const used = new Set(steps.slice(from).flatMap((x) => (x.kind === 'travel' ? [x.section] : [])));
      for (let i = from; i < steps.length; i += 1) {
        const x = steps[i];
        if (x.kind === 'travel' && x.alternatives.some((a) => used.has(a.section))) steps[i] = { ...x, alternatives: x.alternatives.filter((a) => !used.has(a.section)) };
      }
    };
    while (open.length > 0 && guard < 64) {
      guard += 1;
      const list = candidates(open);
      const s = best(p, open, list);
      if (s === null) { steps.push({ kind: 'learn', place: p, cards: open, at: t }); for (const k of open) introduced.add(k); break; }
      const covered = s.introduces.filter((k) => open.includes(k));
      const base = simCost(s);
      const alternatives: Alternative[] = list.filter((x) => x.id !== s.id && x.introduces.some((k) => open.includes(k))).map((x) => ({
        section: x.id,
        slides: x.slides,
        covers: x.introduces.filter((k) => open.includes(k)).length,
        opens: [...new Set(x.introduces.filter((k) => !known(k)).flatMap((k) => world.cardPlaces.get(k) ?? []).filter((q) => q !== p))],
        delta: simCost(x) - base
      })).sort((a, b) => a.delta - b.delta || (a.section < b.section ? -1 : 1));
      const st = state.sections.get(s.id)!;
      const locked = st.ticket.missing.new.some((k) => !introduced.has(k)) || st.ticket.unknown;
      steps.push({ kind: 'travel', place: p, section: s.id, cards: covered, locked, alternatives, at: t });
      for (const k of s.introduces) introduced.add(k);
      if (covered.length === 0) break;
      open = open.filter((k) => !introduced.has(k));
    }
    settle();
  };

  for (let round = 0; round < 400; round += 1) {
    let progressed = false;
    let nextTime = Infinity;
    for (const p of order) {
      if (!introDone.has(p)) { introduce(p); introDone.add(p); progressed = true; }
      if (levels === 0) {
        if (!conquered(p) && !waiting.has(p)) {
          const cards = (state.places.get(p)?.cards ?? []).filter((k) => state.band(k) !== 'known');
          steps.push({ kind: 'know', place: p, cards, at: t });
          waiting.add(p);
          progressed = true;
        }
        continue;
      }
      while ((level.get(p) ?? 0) < levels) {
        const needs = world.places.get(p)?.needs ?? [];
        if (needs.some((n) => placed.has(n) && !conquered(n))) break;
        const next = (level.get(p) ?? 0) + 1;
        const prevAt = lastAt.get(p);
        const earliest = next > 1 && prevAt !== undefined ? prevAt + gapOf(next) : t;
        const key = `${p}#${next}`;
        if (earliest > t) {
          if (!waiting.has(key)) { steps.push({ kind: 'wait', place: p, level: next, from: earliest, at: earliest }); waiting.add(key); }
          nextTime = Math.min(nextTime, earliest);
          break;
        }
        /* Step 3 · 7 — eine Stufe, die als „ab <Datum>" dasteht, ist dieser Durchgang: kein zweiter Schritt dafür. */
        if (!waiting.has(key)) steps.push({ kind: 'run', place: p, level: next, at: t });
        level.set(p, next);
        lastAt.set(p, t);
        progressed = true;
      }
    }
    if (order.every((p) => conquered(p) || (levels === 0 && waiting.has(p)))) break;
    if (!progressed) {
      if (!Number.isFinite(nextTime)) break;
      t = nextTime;
    }
  }

  const cards = order.reduce((sum, p) => sum + (state.places.get(p)?.missing ?? 0), 0);
  return { target, now, places: order, steps, cards };
}

/**
 * Das Fenster des Fahrplans (§8.2): 2 erledigte darüber, der jetzige, 4 kommende. Step 3 · 7 — der jetzige ist der erste, der
 * jetzt geht (`current`, ein Index in `upcoming`; -1: nichts geht jetzt); wartende davor bleiben mit ihrem Datum stehen.
 */
export function timetableWindow<T>(done: readonly T[], upcoming: readonly T[], current = 0, before = 2, after = 4): { readonly done: readonly T[]; readonly waiting: readonly T[]; readonly current: T | null; readonly next: readonly T[]; readonly hiddenAbove: number; readonly hiddenBelow: number } {
  const shown = done.slice(Math.max(0, done.length - before));
  const at = current < 0 ? upcoming.length : Math.min(current, upcoming.length);
  return {
    done: shown,
    waiting: upcoming.slice(0, at),
    current: upcoming[at] ?? null,
    next: upcoming.slice(at + 1, at + 1 + after),
    hiddenAbove: done.length - shown.length,
    hiddenBelow: Math.max(0, upcoming.length - at - 1 - after)
  };
}
