/**
 * 2026-11-03 (G) — WAS ÜBER DIE ERZÄHLUNGEN EINES LERNENDEN BEKANNT IST, für die Bedingung „Przebieg" der einen Logik
 * (`{"type": "flow", "flow": "@ref", "state": "done"}` in Widoki, Powtórki, Krajobraz): je Ablauf der Baza begonnen,
 * zu Ende (ein Ende erreicht), welche Ziele — aus seinen Stellen (`FlowPosition`). Eine Präsentation, auf die ein
 * Ablauf zeigt, merkt sich ihre Stelle unter `page:<seite>` mit ihrem Pfad: gefunden wird sie über ihn.
 */

import type { FlowState } from './flow';
import type { FlowPosition } from './learn';
import type { FlowFacts } from './logic';

/** Ein Pfad ohne „#/" und gross/klein. */
const bare = (path: string): string => path.trim().replace(/^#?\/?/, '').replace(/\/+$/, '').toLowerCase();

/** Ein Ablauf, wie die Bedingung ihn braucht: seine Kennung, und die Präsentation, auf die er zeigt. */
export interface FlowRef {
  readonly id: string;
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
    const found = [positions.get(f.id), f.presentation === undefined ? undefined : byPath.get(bare(f.presentation))].filter((p): p is FlowPosition => p !== undefined);
    if (found.length === 0) continue;
    out.set(f.id, { started: true, done: found.some((p) => p.done === true), goals: [...new Set(found.flatMap((p) => p.goals ?? []))] });
  }
  return out;
}

/** Die Abläufe einer Baza (Kennung, Präsentation). */
export const flowRefsOf = (lib: { docs(kind: 'flow'): readonly { readonly id: string; readonly data: Readonly<Record<string, unknown>> }[] }): FlowRef[] =>
  lib.docs('flow').map((d) => ({ id: d.id, ...(typeof d.data.presentation === 'string' && d.data.presentation.trim() !== '' ? { presentation: d.data.presentation } : {}) }));

/** Was über die Erzählungen dieses Lernenden in dieser Baza bekannt ist. */
export const learnerFlows = (lib: Parameters<typeof flowRefsOf>[0], positions: ReadonlyMap<string, FlowPosition> | undefined): Map<string, FlowFacts> =>
  flowFactsOf(positions, flowRefsOf(lib));

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
