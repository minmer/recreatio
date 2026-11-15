/**
 * 2026-11-14 (Eigentümer: „beim ersten Mal eine Einführung, die jeden Teil der Karte erklärt — auf der echten Karte des Lernenden;
 * erfunden ist nur der Fortschritt; so kurz wie möglich, aber mit allen Möglichkeiten; vom Haus aus jederzeit neu") — DER RUNDGANG:
 * <code>
 *   Schritte   je ein kurzer Text zu einem ECHTEN Teil dieser Karte (das Haus, ein Turm, seine Erzählung, ein Turm, der wartet, eine
 *              Gabelung, ein Wegweiser); die Kamera gleitet hin, der Teil leuchtet
 *   Fortschritt erfunden (`tourInput`): derselbe Turm erst unberührt, dann begonnen, mit Stufe, erobert, fällig — die Karte zeichnet
 *              ihn so, wie er bei echtem Fortschritt aussähe; der eigene Stand ändert sich nicht (nur das Bild, nie gespeichert)
 *   gesehen    je Baza und Widok auf diesem Gerät (`cg-wm-tour:`) — danach nur noch vom Haus aus
 * </code>
 */

import type { T } from '../../core/i18n';
import type { Facts } from '../logic';
import { onwardRoads } from './wmFocus';
import { stepOwner } from './wmLines';
import type { LearnerInput, WorldState } from './wmState';
import { HOME, type Lines, type World } from './wmTypes';
import './worldmap.css';

/** Ein erfundener Stand: je Turm die Kenntnis seiner Karten, Stufen, „Mistrzowsko", gegangene und halb gegangene Pfade. */
export interface TourSim {
  readonly cards?: ReadonlyMap<string, number>;
  /** Türme, deren Karten zur Hälfte gesehen sind. */
  readonly half?: ReadonlySet<string>;
  readonly levels?: ReadonlyMap<string, number>;
  readonly perfect?: ReadonlySet<string>;
  readonly travelled?: ReadonlySet<string>;
  /** Pfade, deren erste Hälfte gesehen ist. */
  readonly halfway?: ReadonlySet<string>;
}

export interface TourStep {
  readonly key: 'welcome' | 'home' | 'tower' | 'path' | 'started' | 'level' | 'conquered' | 'due' | 'onward' | 'locked' | 'fork' | 'sign' | 'way' | 'views';
  /** Wohin die Kamera gleitet (all: die ganze Welt). */
  readonly focus: { readonly kind: 'all' | 'place' | 'section'; readonly id: string };
  readonly sim: TourSim;
  /** Was leuchtet: ein Turm (Ring), Pfade (kräftig). */
  readonly chosen?: string;
  readonly route?: readonly string[];
  /** So nah (statt gleitend in üblicher Nähe): die Scheiben eines wartenden Turms. */
  readonly zoom?: number;
  /** Ein Wegweiser, der leuchtet. */
  readonly sign?: string;
}

/** Kenntnis in den Bändern: frisch gekonnt, gekonnt (bald fällig), fällig, nie gesehen. */
const FRESH = 3, SOON = 1.2, DUE = 0.6;

/** Der erfundene Stand als Eingabe der Welt (dieselbe Rechnung wie für den echten Lernenden). */
export function tourInput(world: World, lines: Lines, sim: TourSim, now: number): LearnerInput {
  const placeOf = (card: string) => world.cardPlaces.get(card) ?? [];
  const knowness = (card: string): number => {
    let best = 0;
    for (const p of placeOf(card)) {
      const k = sim.cards?.get(p);
      if (k !== undefined) best = Math.max(best, k);
      else if (sim.half?.has(p) === true) {
        const cards = world.places.get(p)?.cards ?? [];
        if (cards.indexOf(card) < Math.ceil(cards.length / 2)) best = Math.max(best, FRESH);
      }
    }
    return best;
  };
  const visited = new Map<string, Set<string>>();
  const visit = (flow: string, step: string) => { const v = visited.get(flow) ?? new Set<string>(); v.add(step); visited.set(flow, v); };
  for (const [ids, share] of [[sim.travelled, 1], [sim.halfway, 0.5]] as const) {
    for (const id of ids ?? []) {
      const s = lines.sections.get(id);
      if (s === undefined) continue;
      for (const step of s.steps.slice(0, Math.max(1, Math.ceil(s.steps.length * share)))) {
        const owner = stepOwner(lines, s.line, step);
        visit(owner.flow, owner.step);
        visit(s.line, owner.step);
      }
    }
  }
  const facts: Facts = { values: {}, knowness: (id) => knowness(id), answered: () => null, visited: new Set(), now: new Date(now) };
  return {
    now, facts, knowness,
    progress: (flow) => { const v = visited.get(flow); return v === undefined ? undefined : { visited: v, done: false }; },
    storyPassed: () => false,
    level: (place) => sim.levels?.get(place) ?? 0,
    perfect: (place) => sim.perfect?.has(place) === true,
    suspended: () => false,
    placed: () => 0
  };
}

/**
 * DIE SCHRITTE AUF DIESER KARTE: der erste Turm, zu dem eine Erzählung vom Haus führt (A, mit seinem Pfad), ein Turm, der auf andere
 * wartet (C), eine Gabelung und ein Wegweiser, wenn es sie gibt. Was es nicht gibt, fällt weg.
 */
export function tourSteps(state: WorldState, lines: Lines, world: World, levels: number, signKey: string | null): TourStep[] {
  const fromHome = onwardRoads(state, lines, HOME);
  const road = fromHome[0];
  const a = road?.to ?? world.order[0];
  if (a === undefined) return [];
  const lane = road === undefined ? undefined : road.sections.find((id) => (lines.sections.get(id)?.steps.length ?? 0) > 0) ?? road.sections[road.sections.length - 1];
  const all = (p: string, k: number) => new Map([[p, k]]);
  const conquered: TourSim = { cards: all(a, FRESH), levels: all(a, levels), perfect: new Set([a]), travelled: new Set(road?.sections ?? []) };
  const onward = onwardRoads(state, lines, a);
  /* Der Turm, der am meisten verlangt (seine Scheiben zeigen alles, was davor fehlt) — unter den ersten 400 Orten. */
  const c = world.order.slice(0, 400).filter((id) => id !== a && (world.places.get(id)?.needs.length ?? 0) > 0)
    .map((id) => ({ id, n: state.conquestOrder(id).length })).sort((x, y) => y.n - x.n)[0]?.id;
  const fork = [...lines.junctions.values()].find((j) => j.kind === 'fork' && j.out.length >= 2);
  const out: TourStep[] = [
    { key: 'welcome', focus: { kind: 'all', id: '' }, sim: {} },
    { key: 'home', focus: lane === undefined ? { kind: 'all', id: '' } : { kind: 'section', id: lane }, sim: {}, ...(road === undefined ? {} : { route: road.sections }) },
    { key: 'tower', focus: { kind: 'place', id: a }, sim: {}, chosen: a }
  ];
  if (lane !== undefined) {
    out.push({ key: 'path', focus: { kind: 'section', id: lane }, sim: {}, route: road?.sections ?? [lane] });
    out.push({ key: 'started', focus: { kind: 'section', id: lane }, sim: { half: new Set([a]), halfway: new Set(road?.sections ?? [lane]) }, chosen: a });
  }
  if (levels > 1) out.push({ key: 'level', focus: { kind: 'place', id: a }, sim: { cards: all(a, FRESH), levels: all(a, 1), travelled: new Set(road?.sections ?? []) }, chosen: a });
  out.push({ key: 'conquered', focus: { kind: 'place', id: a }, sim: conquered, chosen: a });
  /* Ohne Stufen ist „erobert“ dasselbe wie „gekonnt“ — verblasstes Wissen ist dann nicht erobert: der Schritt fällt weg (der Text davor sagt es). */
  if (levels > 0) out.push({ key: 'due', focus: { kind: 'place', id: a }, sim: { ...conquered, cards: all(a, DUE), perfect: new Set() }, chosen: a });
  if (onward.length > 0) out.push({ key: 'onward', focus: { kind: 'place', id: a }, sim: { ...conquered, cards: all(a, SOON) }, chosen: a, route: onward.flatMap((r) => r.sections) });
  if (c !== undefined) out.push({ key: 'locked', focus: { kind: 'place', id: c }, sim: {}, chosen: c, zoom: 1.4 });
  if (fork !== undefined && fork.out[0] !== undefined) out.push({ key: 'fork', focus: { kind: 'section', id: fork.out[0] }, sim: conquered, route: fork.out });
  if (signKey !== null) out.push({ key: 'sign', focus: signKey.startsWith('p:') ? { kind: 'place', id: signKey.slice(2) } : lane === undefined ? { kind: 'all', id: '' } : { kind: 'section', id: lane }, sim: {}, sign: signKey });
  out.push({ key: 'way', focus: { kind: 'place', id: c ?? a }, sim: conquered, chosen: c ?? a });
  out.push({ key: 'views', focus: { kind: 'all', id: '' }, sim: {} });
  return out;
}

const SEEN = 'cg-wm-tour:';
/** In der Vorschau (Prüfungen, Agenten) beginnt der Rundgang nur mit `?tour=1` von selbst — wie die Frage beim Laden (`inviteWanted`). */
export function tourWanted(): boolean {
  if (typeof window === 'undefined') return false;
  const preview = (window as { recreatioPreview?: unknown }).recreatioPreview !== undefined || window.location.pathname.endsWith('/preview.html');
  return !preview || new URLSearchParams(window.location.search).get('tour') === '1';
}
export const tourSeen = (scope: string): boolean => { try { return localStorage.getItem(SEEN + scope) === '1'; } catch { return true; } };
export const keepTourSeen = (scope: string): void => { try { localStorage.setItem(SEEN + scope, '1'); } catch { /* ohne Speicher: jedes Mal */ } };

/** Das Feld des Rundgangs: wo man ist, ein kurzer Text, Wstecz / Dalej / Zakończ. */
export function TourCard({ steps, at, levels, t, onAt, onClose }: {
  steps: readonly TourStep[];
  at: number;
  levels: number;
  t: T;
  onAt: (n: number) => void;
  onClose: () => void;
}) {
  const step = steps[at];
  if (step === undefined) return null;
  const last = at === steps.length - 1;
  return (
    <section key={step.key} className="cg-wm-tour" role="dialog" aria-label={t('cogitaWorld.tour.start')} data-world-tour={step.key} data-world-tour-at={at}>
      <p className="cg-wm-tourn">{t('cogitaWorld.tour.of', { n: at + 1, all: steps.length })}</p>
      <h3 className="cg-wm-tourh">{t(`cogitaWorld.tour.${step.key}.title`)}</h3>
      <p className="cg-wm-tourt">{t(levels === 0 && step.key === 'conquered' ? 'cogitaWorld.tour.conquered.text0' : `cogitaWorld.tour.${step.key}.text`, { levels })}</p>
      {at === 0 && <p className="cg-wm-meta">{t('cogitaWorld.tour.sample')}</p>}
      <div className="cg-wm-tourbtns">
        {at > 0 && <button type="button" className="wk-btn wk-btn-line" onClick={() => onAt(at - 1)} data-world-tour-back="">‹ {t('cogitaWorld.tour.back')}</button>}
        {last
          ? <button type="button" className="wk-btn" autoFocus onClick={onClose} data-world-tour-done="">{t('cogitaWorld.tour.done')}</button>
          : <button type="button" className="wk-btn" autoFocus onClick={() => onAt(at + 1)} data-world-tour-next="">{t('cogitaWorld.tour.next')} ›</button>}
        {!last && <button type="button" className="wk-link-btn" onClick={onClose} data-world-tour-close="">{t('cogitaWorld.tour.close')}</button>}
      </div>
    </section>
  );
}
