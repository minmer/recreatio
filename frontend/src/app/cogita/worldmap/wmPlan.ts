/**
 * 2026-11-09 — „PROWADŹ MNIE TUTAJ": DER PLAN (spec §8.1, Entscheidung 14). Nur für die Sitzung, nie ein gespeichertes Ziel
 * („Ustaw jako cel" bleibt, wie es ist).
 *
 * 2026-11-10 (Eigentümer: „der Weg hat Lücken und lässt gefahrene Pfade fallen" — „plane eine Kette") — DER PLAN IST EIN
 * ZUSAMMENHÄNGENDER WEG:
 * <code>
 *   Reihenfolge  jeder nicht eroberte verlangte Turm (auch mittelbar), nach den Voraussetzungen, zuletzt das Ziel; Eroberte
 *                fallen weg. Verlangt ein Tor auf dem Weg einen Turm (eine Möglichkeit, eine Einheit) oder beginnt der Weg an
 *                einem nicht eroberten Turm, kommt dieser Turm (mit seiner Grundlage) davor
 *   je Turm      der Weg von hier (zuerst das Haus, dann der zuletzt eroberte Turm) zu ihm, entlang der Spuren: jede Gabelung
 *                liegt auf ihm, kein Sprung. Gefahrene Spuren bleiben im Weg (billiger) und dürfen auch rückwärts gegangen
 *                werden (zurück zu einer Gabelung)
 *   Teile        jede nicht gefahrene Spur mit Inhalt (die Erzählung dort), davor die Wiederholungen ihres Tores; am Turm die
 *                Eroberung — mit Stufen ein Durchgang (gleich, oder nachdem man wiederholt hat, was man noch nicht kann),
 *                ohne Stufen: lernen, bis es sitzt
 *   direkt       Karten ohne Erzählung lernen nur, wenn keine Erzählung sie erreicht — nie statt einer Erzählung, die es gibt
 * </code>
 * Nach jeder Änderung des Lernstands neu gerechnet.
 */

import type { WorldState } from './wmState';
import { HOME, isJunction, type Section, type WmCondition } from './wmTypes';

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
  /** Karten, die keine Erzählung erreicht (nur dann direkt). */
  | { readonly kind: 'learn'; readonly place: string; readonly cards: readonly string[] }
  /** Die Wiederholungen, die die Fahrkarte eines Abschnitts verlangt — ein eigener Teil des Weges vor der Fahrt. */
  | { readonly kind: 'review'; readonly place: string; readonly section: string; readonly cards: readonly string[] }
  /**
   * Ein Durchgang ab Stufe `level`; gelingt er ganz, reicht er bis `upTo`. 2026-11-10 (Eigentümer) — am Turm zwei Wege: gleich
   * erobern (alle `cards` Karten, `unseen` davon nie gefragt) oder erst wiederholen, was man noch nicht kann (`prepare`).
   */
  | { readonly kind: 'run'; readonly place: string; readonly level: number; readonly upTo: number; readonly cards: number; readonly unseen: readonly string[]; readonly prepare: readonly string[] }
  | { readonly kind: 'know'; readonly place: string; readonly cards: readonly string[] };

export interface Plan {
  readonly target: string;
  readonly places: readonly string[];
  readonly steps: readonly PlanStep[];
  /** Karten, die bis zum Ziel fehlen. */
  readonly cards: number;
  /** 2026-11-10 — der ganze Weg auf der Karte, in der Reihenfolge des Gehens (auch gefahrene Spuren, auch zurück). */
  readonly route: readonly string[];
}

export interface PlanOptions {
  /** Gewählte Abzweigungen dieser Sitzung: Ort → Abschnitt. */
  readonly choices?: ReadonlyMap<string, string>;
}

/** Was es kostet, eine Spur zu gehen: gefahren, neu (je Schritt etwas mehr), zurück. */
const COST_TRAVELLED = 0.2;
const COST_BACK = 0.3;
const COST_NEW = 1;
const COST_STEP = 0.02;
/** Eine Spur, die an einem nicht eroberten Turm beginnt (er wird vorher erobert), und je fehlendem Turm eines Tores. */
const COST_TOWER = 4;

interface Edge { readonly s: Section; readonly back: boolean }

export function plan(state: WorldState, target: string, opts: PlanOptions = {}): Plan {
  const { world, lines } = state;
  const levels = state.settings.levels;
  const conquered = (p: string) => state.places.get(p)?.conquered === true;
  /* Türme, die der Plan vor dem jetzigen Schritt erobert; Spuren, die er geht; Karten, die seine Fahrten einführen. */
  const soon = new Set<string>();
  const walked = new Set<string>();
  const introduced = new Set<string>();
  const reviewed = new Set<string>();
  const steps: PlanStep[] = [];
  const route: string[] = [];
  const order: string[] = [];

  const outOf = new Map<string, Section[]>();
  const intoOf = new Map<string, Section[]>();
  for (const s of lines.sections.values()) {
    if (s.from === s.to) continue;
    const o = outOf.get(s.from) ?? []; o.push(s); outOf.set(s.from, o);
    const i = intoOf.get(s.to) ?? []; i.push(s); intoOf.set(s.to, i);
  }
  /* Darf eine Spur hier beginnen? Am Haus, an einer Gabelung (man ist dort), an einem eroberten (oder bald eroberten) Turm, oder wo `openAt` sie öffnet. */
  const openFrom = (p: string, s: Section): boolean => p === HOME || isJunction(p) || conquered(p) || soon.has(p) || state.sections.get(s.id)?.open === true;
  /*
    Bekannt ist eine Spur, die gefahren ist, die der Plan schon geht, oder die zu einem eroberten Turm führt (wer ihn erobert hat,
    muss seine Erzählung nicht noch einmal fahren, um von ihm aus weiterzugehen) — auch über eine Gabelung zu lauter eroberten.
  */
  const conqueredNode = (id: string): boolean => conquered(id) || soon.has(id) || (isJunction(id) && (outOf.get(id) ?? []).length > 0 && (outOf.get(id) ?? []).every((x) => conquered(x.to) || soon.has(x.to)));
  /* … und eine, die nichts Neues mehr bringt (jede Karte, die sie einführt, hat man schon gesehen). */
  const nothingNew = (s: Section | undefined): boolean => s !== undefined && s.introduces.length > 0 && s.introduces.every((k) => state.band(k) !== 'unseen');
  const travelled = (id: string) => { const s = lines.sections.get(id); return state.sections.get(id)?.travelled === true || walked.has(id) || conqueredNode(s?.to ?? '') || nothingNew(s); };

  /* Die Türme, die ein nicht erfülltes Tor verlangt (ein Block: seine Teile). */
  const placesOf = (c: WmCondition): string[] => {
    if (c.type === 'not') return [];
    const out: string[] = [];
    const of = typeof c.of === 'string' ? c.of : '';
    if (world.places.has(of)) out.push(of);
    else for (const p of world.blocks.get(of)?.parts ?? []) out.push(p);
    for (const x of c.items ?? []) out.push(...placesOf(x));
    return out;
  };
  const ticketTowers = (s: Section): string[] => (state.sections.get(s.id)?.ticket.parts ?? []).filter((p) => !p.result.met).flatMap((p) => placesOf(p.part.condition));

  const forwardCost = (s: Section, pin: string | null): number => {
    const st = state.sections.get(s.id);
    if (st === undefined) return Infinity;
    let c = travelled(s.id) ? COST_TRAVELLED : COST_NEW + COST_STEP * s.steps.length;
    if (!st.ticket.met) {
      if (st.ticket.unknown) return Infinity;
      const towers = ticketTowers(s).filter((p) => !conquered(p) && !soon.has(p));
      const other = st.ticket.parts.some((p) => !p.result.met && placesOf(p.part.condition).length === 0);
      c += COST_TOWER * new Set(towers).size + (other ? 1 + 0.5 * st.ticket.missing.new.length + 0.3 * st.ticket.missing.review.length : 0);
    }
    if (!openFrom(s.from, s)) c += COST_TOWER;
    return pin !== null && s.id === pin ? c * 0.01 : c;
  };

  /** Der kürzeste Weg über die Spuren (vorwärts; gefahrene und geplante auch zurück). */
  const shortest = (from: string, to: string, pin: string | null): Edge[] | null => {
    if (from === to) return [];
    const dist = new Map<string, number>([[from, 0]]);
    const prev = new Map<string, { node: string; edge: Edge }>();
    const done = new Set<string>();
    const heap: [number, string][] = [[0, from]];
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
    const relax = (u: string, d: number, v: string, cost: number, edge: Edge) => {
      if (!Number.isFinite(cost)) return;
      const nd = d + Math.max(0.01, cost);
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, { node: u, edge }); push(nd, v); }
    };
    while (heap.length > 0) {
      const [d, u] = pop();
      if (done.has(u)) continue;
      done.add(u);
      if (u === to) break;
      /* Durch einen nicht eroberten Turm (nicht das Ziel) geht es nur weiter, wenn man ihn vorher erobert — das kostet. */
      for (const s of outOf.get(u) ?? []) relax(u, d, s.to, forwardCost(s, pin), { s, back: false });
      /* Zurück nur auf bekannten Spuren — und nie zurück in einen Turm, den man nicht kennt (in ihn führt eine Erzählung). */
      for (const s of intoOf.get(u) ?? []) if (travelled(s.id) && (s.from === HOME || isJunction(s.from) || conquered(s.from) || soon.has(s.from) || state.sections.get(s.id)?.travelled === true || walked.has(s.id))) relax(u, d, s.from, COST_BACK, { s, back: true });
    }
    if (!dist.has(to)) return null;
    const path: Edge[] = [];
    let at = to;
    let guard = 0;
    while (at !== from && guard < 100000) {
      guard += 1;
      const p = prev.get(at);
      if (p === undefined) return null;
      path.unshift(p.edge);
      at = p.node;
    }
    return path;
  };

  const alternativesOf = (s: Section, place: string): Alternative[] => {
    const own = (state.places.get(place)?.cards ?? []).filter((k) => state.band(k) === 'unseen');
    const base = forwardCost(s, null);
    return (intoOf.get(s.to) ?? [])
      .filter((x) => x.id !== s.id && x.kind !== 'return' && x.steps.length > 0 && !travelled(x.id) && Number.isFinite(forwardCost(x, null)))
      .map((x) => ({
        section: x.id,
        slides: x.slides,
        covers: x.introduces.filter((k) => own.includes(k)).length,
        opens: [...new Set(x.introduces.filter((k) => state.band(k) === 'unseen' && !introduced.has(k)).flatMap((k) => world.cardPlaces.get(k) ?? []).filter((q) => q !== place))],
        delta: forwardCost(x, null) - base
      }))
      .sort((a, b) => a.delta - b.delta || (a.section < b.section ? -1 : 1));
  };

  /** Die Spuren eines Weges gehen: jede neue mit Inhalt ist ein Teil (davor die Wiederholungen ihres Tores). */
  const walk = (path: readonly Edge[], place: string) => {
    for (const e of path) {
      route.push(e.s.id);
      if (e.back) continue;
      const had = travelled(e.s.id);
      walked.add(e.s.id);
      const fresh = e.s.introduces.filter((k) => state.band(k) === 'unseen' && !introduced.has(k));
      /* Wer den Weg geht (oder schon ging), bekommt seine Karten erklärt. */
      if (had || e.s.steps.length === 0) { for (const k of e.s.introduces) introduced.add(k); continue; }
      const st = state.sections.get(e.s.id)!;
      const again = st.ticket.missing.review.filter((k) => !introduced.has(k) && !reviewed.has(k));
      if (again.length > 0) { steps.push({ kind: 'review', place, section: e.s.id, cards: again }); for (const k of again) reviewed.add(k); }
      steps.push({
        kind: 'travel', place, section: e.s.id, cards: fresh,
        locked: st.ticket.missing.new.some((k) => !introduced.has(k)) || st.ticket.unknown,
        alternatives: alternativesOf(e.s, place)
      });
      for (const k of e.s.introduces) introduced.add(k);
    }
  };

  /* -- Die Kette ---------------------------------------------------------------------------------------------------------------- */
  const reach = (k: string) => (lines.introducedBy.get(k) ?? []).length > 0;
  const queue = state.conquestOrder(target).slice();
  const tries = new Map<string, number>();
  let pos = HOME;
  let guard = 0;
  while (queue.length > 0 && guard < 2000) {
    guard += 1;
    const T = queue[0];
    if (conquered(T) || soon.has(T)) { queue.shift(); continue; }
    const pin = opts.choices?.get(T) ?? null;
    /* Eine gewählte Abzweigung: der Weg führt über sie (zu ihrem Anfang, sie selbst, von ihrem Ende zum Turm). */
    const pinned = pin === null ? undefined : lines.sections.get(pin);
    const head = pinned === undefined ? null : shortest(pos, pinned.from, null);
    const tail = pinned === undefined || head === null ? null : shortest(pinned.to, T, null);
    const path = pinned !== undefined && head !== null && tail !== null ? [...head, { s: pinned, back: false }, ...tail] : shortest(pos, T, pin);
    /* Was der Weg verlangt: ein Turm, an dem eine Spur beginnt, und jeder Turm, den ein Tor auf ihm verlangt — vorher. */
    const need: string[] = [];
    for (const e of path ?? []) {
      if (e.back) continue;
      if (world.places.has(e.s.from) && e.s.from !== T && !openFrom(e.s.from, e.s)) need.push(e.s.from);
      for (const p of ticketTowers(e.s)) if (p !== T && !conquered(p) && !soon.has(p)) need.push(p);
    }
    const first = [...new Set(need)].flatMap((p) => state.conquestOrder(p)).filter((p, i, all) => all.indexOf(p) === i && p !== T && !soon.has(p) && !conquered(p));
    const n = tries.get(T) ?? 0;
    if (first.length > 0 && n < 6) {
      tries.set(T, n + 1);
      /* Was schon später in der Reihe stand, kommt nun davor (einmal). */
      const rest = queue.filter((p) => !first.includes(p));
      queue.length = 0;
      queue.push(...first, ...rest);
      continue;
    }
    queue.shift();
    if (path !== null) walk(path, T);
    const ps = state.places.get(T);
    const cards = ps?.cards ?? [];
    if (levels === 0) {
      /* Ohne Stufen: erobert, wenn die Karten sitzen — was eine Erzählung noch einführt, wird vorher gefahren (vom Turm aus). */
      for (const k of cards) {
        if (state.band(k) !== 'unseen' || introduced.has(k) || !reach(k)) continue;
        const by = (lines.introducedBy.get(k) ?? []).map((id) => lines.sections.get(id)!).filter((s) => s !== undefined && !travelled(s.id));
        let best: Edge[] | null = null;
        for (const s of by) {
          const to = shortest(T, s.from, null);
          if (to === null) continue;
          const full = [...to, { s, back: false }];
          if (best === null || full.length < best.length) best = full;
        }
        if (best !== null) walk(best, T);
      }
      const direct = cards.filter((k) => state.band(k) === 'unseen' && !introduced.has(k) && !reach(k));
      if (direct.length > 0) steps.push({ kind: 'learn', place: T, cards: direct });
      steps.push({ kind: 'know', place: T, cards: cards.filter((k) => state.band(k) !== 'known' && (state.band(k) !== 'unseen' || introduced.has(k) || !reach(k))) });
    } else {
      const unseen = cards.filter((k) => state.band(k) === 'unseen' && !introduced.has(k));
      /* Erst wiederholen: was man gesehen hat und noch nicht kann — und was keine Erzählung erreicht (nur das direkt). */
      const prepare = cards.filter((k) => state.band(k) !== 'known' && (state.band(k) !== 'unseen' || introduced.has(k) || !reach(k)));
      steps.push({ kind: 'run', place: T, level: (ps?.level ?? 0) + 1, upTo: levels, cards: cards.length, unseen, prepare });
    }
    soon.add(T);
    order.push(T);
    pos = T;
  }

  const cardsLeft = order.reduce((sum, p) => sum + (state.places.get(p)?.missing ?? 0), 0);
  return { target, places: order, steps, cards: cardsLeft, route };
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
