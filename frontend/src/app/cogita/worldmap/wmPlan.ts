/**
 * 2026-11-09 — „PROWADŹ MNIE TUTAJ": DER PLAN (spec §8.1, Entscheidung 14). Nur für die Sitzung, nie ein gespeichertes Ziel
 * („Ustaw jako cel" bleibt, wie es ist).
 * <code>
 *   Reihenfolge  jeder nicht eroberte Ort der Grundlage des Ziels, topologisch, dann das Ziel; verlangt eine Fahrkarte einen Ort
 *                ausserhalb, kommt er davor
 *   je Ort       1. seine Karten einführen: der billigste Abschnitt, der sie einführt (eine gewählte Abzweigung gilt), sonst
 *                   „direkt lernen"
 *                   (verlangt die Fahrkarte Wiederholungen, steht davor ein eigener Teil „Powtórka" — 2026-11-10)
 *                2. EIN Durchgang bis zur letzten Stufe (er hebt um jede Stufe, deren Regel er erfüllt; ohne Abstand zwischen
 *                   den Stufen wartet nichts — 2026-11-09); ohne Stufen: die Karten lernen, bis sie sitzen
 *   Abzweigung   je Fahrt die anderen Abschnitte, die dieselben Karten einführen (Folien, neue Karten, Wirkung auf die Summe)
 *   Turm zuerst  ein Abschnitt fährt nur vom Haus oder von einem eroberten Turm (2026-11-10): beginnt der beste an einem nicht
 *                eroberten Turm, wird dieser Turm vorher erobert
 * </code>
 * Nach jeder Änderung des Lernstands neu gerechnet.
 */

import { COST_NEW, COST_REVIEW } from './wmConditions';
import type { WorldState } from './wmState';
import type { Section } from './wmTypes';

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

export type PlanStep =
  | { readonly kind: 'travel'; readonly place: string; readonly section: string; readonly cards: readonly string[]; readonly locked: boolean; readonly alternatives: readonly Alternative[] }
  | { readonly kind: 'learn'; readonly place: string; readonly cards: readonly string[] }
  /** Die Wiederholungen, die die Fahrkarte eines Abschnitts verlangt — ein eigener Teil des Weges vor der Fahrt. */
  | { readonly kind: 'review'; readonly place: string; readonly section: string; readonly cards: readonly string[] }
  /** Ein Durchgang ab Stufe `level`; gelingt er ganz, reicht er bis `upTo`. */
  | { readonly kind: 'run'; readonly place: string; readonly level: number; readonly upTo: number }
  | { readonly kind: 'know'; readonly place: string; readonly cards: readonly string[] };

export interface Plan {
  readonly target: string;
  readonly places: readonly string[];
  readonly steps: readonly PlanStep[];
  /** Karten, die bis zum Ziel fehlen. */
  readonly cards: number;
}

export interface PlanOptions {
  /** Gewählte Abzweigungen dieser Sitzung: Ort → Abschnitt. */
  readonly choices?: ReadonlyMap<string, string>;
}

export function plan(state: WorldState, target: string, opts: PlanOptions = {}): Plan {
  const { world, lines } = state;
  const levels = state.settings.levels;
  const introduced = new Set<string>();
  const reviewed = new Set<string>();
  const known = (k: string) => state.band(k) !== 'unseen' || introduced.has(k);

  const simCost = (s: Section): number => {
    const st = state.sections.get(s.id)!;
    if (!Number.isFinite(st.ticket.cost)) return Infinity;
    const fresh = st.ticket.missing.new.filter((k) => !introduced.has(k)).length;
    const other = st.ticket.parts.filter((p) => !p.result.met && p.result.missing === undefined).reduce((sum, p) => sum + (p.view.symbol === 'unknown' ? Infinity : 4), 0);
    return 1 + COST_NEW * fresh + COST_REVIEW * st.ticket.missing.review.length + other - (st.travelled ? 0.5 : 0);
  };
  /* Türme, die der Plan vor dem jetzigen Schritt erobert (ihr Durchgang steht schon in den Schritten). */
  const soon = new Set<string>();
  const startsOpen = (s: Section): boolean => state.sections.get(s.id)!.open || soon.has(s.from);
  const candidates = (cards: readonly string[], gate = true): Section[] => {
    const ids = new Set(cards.flatMap((k) => lines.introducedBy.get(k) ?? []));
    /*
      2026-11-10 (Eigentümer: „nur ein Schritt wird gemacht") — ein schon befahrener Abschnitt wird nicht noch einmal angeboten:
      wer die Erzählung gelesen hat, ohne ihre Karten zu beantworten, lernt sie als nächsten Teil direkt (sonst stünde dieselbe
      Fahrt immer wieder als nächster Schritt da).
    */
    return [...ids].map((id) => lines.sections.get(id)!).filter((s) => { const st = state.sections.get(s.id)!; return Number.isFinite(st.ticket.cost) && !st.travelled && (!gate || startsOpen(s)); });
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
      const s = best(p, cards, candidates(cards, false));
      /* Beginnt die beste Fahrt an einem nicht eroberten Turm, kommt dieser Turm davor (ausser er hängt selbst von hier ab). */
      if (s !== null && !state.sections.get(s.id)!.open && world.places.has(s.from) && !placed.has(s.from) && s.from !== p && !state.conquestOrder(s.from).includes(p)) add(s.from, guard + 1);
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

  /* -- Die Schritte: einführen, dann ein Durchgang je Ort (sobald seine Grundlage erobert ist) ------------------------------- */
  const steps: PlanStep[] = [];
  const conquered = (p: string) => state.places.get(p)?.conquered === true;
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
      if (s === null) { steps.push({ kind: 'learn', place: p, cards: open }); for (const k of open) introduced.add(k); break; }
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
      const again = st.ticket.missing.review.filter((k) => !introduced.has(k) && !reviewed.has(k));
      if (again.length > 0) { steps.push({ kind: 'review', place: p, section: s.id, cards: again }); for (const k of again) reviewed.add(k); }
      steps.push({ kind: 'travel', place: p, section: s.id, cards: covered, locked, alternatives });
      for (const k of s.introduces) introduced.add(k);
      if (covered.length === 0) break;
      open = open.filter((k) => !introduced.has(k));
    }
    settle();
  };

  /* Je Ort in der Reihenfolge (die Grundlage zuerst): seine Karten einführen, dann sein Durchgang. */
  for (const p of order) {
    introduce(p);
    soon.add(p);
    if (conquered(p)) continue;
    if (levels === 0) {
      steps.push({ kind: 'know', place: p, cards: (state.places.get(p)?.cards ?? []).filter((k) => state.band(k) !== 'known') });
    } else {
      const level = (state.places.get(p)?.level ?? 0) + 1;
      steps.push({ kind: 'run', place: p, level, upTo: levels });
    }
  }

  const cards = order.reduce((sum, p) => sum + (state.places.get(p)?.missing ?? 0), 0);
  return { target, places: order, steps, cards };
}

/** Das Fenster des Fahrplans (§8.2): 2 erledigte darüber, der jetzige, 4 kommende. */
export function timetableWindow<T>(done: readonly T[], upcoming: readonly T[], before = 2, after = 4): { readonly done: readonly T[]; readonly current: T | null; readonly next: readonly T[]; readonly hiddenAbove: number; readonly hiddenBelow: number } {
  const shown = done.slice(Math.max(0, done.length - before));
  return {
    done: shown,
    current: upcoming[0] ?? null,
    next: upcoming.slice(1, 1 + after),
    hiddenAbove: done.length - shown.length,
    hiddenBelow: Math.max(0, upcoming.length - 1 - after)
  };
}
