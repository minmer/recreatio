/**
 * 2026-11-03 (G) — WAS ÜBER DIE ERZÄHLUNGEN EINES LERNENDEN BEKANNT IST, für die Bedingung „Przebieg" der einen Logik
 * (`{"type": "flow", "flow": "@ref", "state": "done"}` in Widoki, Powtórki, Krajobraz): je Ablauf der Baza begonnen,
 * zu Ende (ein Ende erreicht), welche Ziele — aus seinen Stellen (`FlowPosition`). Eine Präsentation, auf die ein
 * Ablauf zeigt, merkt sich ihre Stelle unter `page:<seite>` mit ihrem Pfad: gefunden wird sie über ihn.
 */

import { goalsReached, readFlow, type Flow, type FlowState } from './flow';
import { positionFor, type FlowPosition } from './learn';
import type { Facts, FlowFacts } from './logic';

/** Ein Pfad ohne „#/" und gross/klein. */
const bare = (path: string): string => path.trim().replace(/^#?\/?/, '').replace(/\/+$/, '').toLowerCase();

/** Ein Ablauf, wie die Bedingung ihn braucht: seine Kennung, und die Präsentation, auf die er zeigt. */
export interface FlowRef {
  readonly id: string;
  /** Der bleibende Name (2026-11-04, Prompt 13): die Stelle eines neu eingespielten Ablaufs. */
  readonly ref?: string;
  readonly presentation?: string;
}

export function flowFactsOf(positions: ReadonlyMap<string, FlowPosition> | undefined, flows: readonly FlowRef[]): Map<string, FlowFacts> {
  const out = new Map<string, FlowFacts>();
  if (positions === undefined || positions.size === 0) return out;
  const byPath = new Map<string, FlowPosition>();
  for (const p of positions.values()) {
    if (typeof p.path !== 'string' || p.path === '') continue;
    const k = bare(p.path);
    const had = byPath.get(k);
    if (had === undefined || had.at <= p.at) byPath.set(k, p);
  }
  for (const f of flows) {
    const found = [positionFor(positions, f), f.presentation === undefined ? undefined : byPath.get(bare(f.presentation))].filter((p): p is FlowPosition => p !== undefined);
    if (found.length === 0) continue;
    out.set(f.id, { started: true, done: found.some((p) => p.done === true), goals: [...new Set(found.flatMap((p) => p.goals ?? []))] });
  }
  return out;
}

/** Die Abläufe einer Baza (Kennung, Präsentation). */
export const flowRefsOf = (lib: { docs(kind: 'flow'): readonly { readonly id: string; readonly data: Readonly<Record<string, unknown>> }[] }): FlowRef[] =>
  lib.docs('flow').map((d) => ({ id: d.id, ...(typeof d.data._ref === 'string' && d.data._ref !== '' ? { ref: d.data._ref } : {}), ...(typeof d.data.presentation === 'string' && d.data.presentation.trim() !== '' ? { presentation: d.data.presentation } : {}) }));

/** Was über die Erzählungen dieses Lernenden in dieser Baza bekannt ist. */
export const learnerFlows = (lib: Parameters<typeof flowRefsOf>[0], positions: ReadonlyMap<string, FlowPosition> | undefined): Map<string, FlowFacts> =>
  flowFactsOf(positions, flowRefsOf(lib));

/**
 * 2026-11-03 (Prompt 5) — WO EIN LERNENDER IN EINER ERZÄHLUNG STEHT: neu, begonnen, zu Ende mit offenen Zielen (der
 * Przegląd ist noch nicht bestanden), bestanden (zu Ende und jedes Ziel erreicht; ein Ablauf ohne Ziele: zu Ende). Nur
 * „bestanden" senkt die Einheit der Erzählung ins Tal.
 */
export type StoryStage = 'new' | 'started' | 'review' | 'passed';
export function storyStage(flow: { readonly goals: readonly { readonly id: string }[] }, facts: FlowFacts | undefined): StoryStage {
  if (facts === undefined || !facts.started) return 'new';
  if (!facts.done) return 'started';
  return flow.goals.every((g) => facts.goals.includes(g.id)) ? 'passed' : 'review';
}

/** Der eine Knopf einer Erzählung, nach ihrem Stand (er öffnet den Spieler: an der Stelle des Lernenden; „Powtórz przegląd" am Przegląd). */
export const STORY_BUTTON: Readonly<Record<StoryStage, string>> = {
  new: 'Zacznij opowieść', started: 'Kontynuuj opowieść', review: 'Powtórz przegląd', passed: 'Otwórz opowieść'
};

/** Wohin „Powtórz przegląd" springt: der Teil des Przeglądu (`review`), sonst der Anfang (eine Präsentation: ihre erste Szene, leer). */
export const reviewStart = (flow: Pick<Flow, 'review' | 'presentation' | 'start'>): string => flow.review ?? (flow.presentation !== undefined ? '' : flow.start ?? '');

/** Die Einheiten, die Erzählungen sind (ein Ablauf zeigt auf sie, eigene Karten haben sie keine) — Einheit → Ablauf. */
export function storyUnitsOf(lib: { docs(kind: 'flow'): readonly { readonly id: string; readonly data: Readonly<Record<string, unknown>> }[] }, hasCards: (id: string) => boolean): Map<string, Flow> {
  const out = new Map<string, Flow>();
  for (const d of lib.docs('flow')) {
    const flow = readFlow(d.id, d.data);
    if (flow.unit !== undefined && !hasCards(flow.unit) && !out.has(flow.unit)) out.set(flow.unit, flow);
  }
  return out;
}

/**
 * 2026-11-03 (Prompt 5) — DIE ZIELE EINER PRÄSENTATION: der Ablauf der Baza, der auf diese Seite zeigt, und welche seiner
 * Ziele jetzt gelten (mit den Werten, Antworten und Szenen des Laufs) — die Seite merkt sie an ihrer Stelle.
 */
export function pageGoals(lib: Parameters<typeof flowRefsOf>[0], pagePath: string | null, facts: Facts): string[] {
  if (pagePath === null || pagePath.trim() === '') return [];
  const at = bare(pagePath);
  for (const d of lib.docs('flow')) {
    const p = typeof d.data.presentation === 'string' ? d.data.presentation : '';
    if (p.trim() === '' || bare(p) !== at) continue;
    return goalsReached(readFlow(d.id, d.data), facts);
  }
  return [];
}

/** Die Ziele, die ein Ablauf gerade erreicht — vereint mit denen, die er schon hatte (einmal erreicht bleibt erreicht). */
export const mergeGoals = (had: readonly string[] | undefined, now: readonly string[]): string[] => [...new Set([...(had ?? []), ...now])];

/** 2026-11-03 (G) — die Kapitel, die durch sind, wie sie gemerkt werden: `<auswahl>:<index>`. */
export const chaptersKept = (chapters: FlowState['chapters']): string[] => Object.entries(chapters).flatMap(([hub, list]) => list.map((i) => `${hub}:${i}`));

/** … und zurück in den Stand (wer wiederkommt, hat sie weiter durch). */
export function withChapters<S extends Pick<FlowState, 'chapters'>>(state: S, kept: readonly string[] | undefined): S {
  if (kept === undefined || kept.length === 0) return state;
  const chapters: Record<string, number[]> = {};
  for (const one of kept) {
    const at = one.lastIndexOf(':');
    const i = Number(one.slice(at + 1));
    if (at <= 0 || !Number.isInteger(i) || i < 0) continue;
    (chapters[one.slice(0, at)] ??= []).push(i);
  }
  return { ...state, chapters };
}
