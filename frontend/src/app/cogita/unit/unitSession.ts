/**
 * 2026-11-22 (Homer) — DIE KLASSENSITZUNG EINER EINHEIT: eine Cogita-Sitzung der Art `lesson` im Bereich der Klasse (keine neue
 * Ablage), die über alle Stunden lebt — `running` in einer Stunde, `paused` dazwischen (mit Code: so verwechselt sie keiner mit
 * einer gespeicherten Planung), `finished` am Ende. Derselbe Code und QR die ganze Einheit.
 *
 * <code>
 *   config         {title, unit: <Einheit>, unitId, parts: [], showVotes, thresholds}   (die Einheit zum Start, versiegelt)
 *   Lehrer (Sitzungsschlüssel):
 *     unit-stage   {stage, lesson, at}            ein Etap öffnet (die Telefone zeigen nur ihn)
 *     unit-item    {stage, index, at}             im gemeinsamen Etap: das Item, das gerade dran ist
 *     unit-look    {on, at}                       „Wszyscy patrzą na ekran"
 *     unit-results {stage, item, at}              „Pokaż wyniki" (offene Frage, Umfrage)
 *     unit-end     {lesson, at}                   „Zakończ lekcję" — der Abschluss beginnt
 *     unit-pause   {lesson, at}                   die Stunde ist vorbei — Hausaufgaben
 *     unit-resume  {lesson, recap: [Frage], at}   „Wznów": die neue Stunde, mit der Wiederholung
 *     unit-plan    {order, skipped, added, extend, at}   umgestellt, ausgelassen, ergänzt, verlängert
 *     unit-wall    {stage, item, texts}           die Antworten, die der Lehrer zeigt — ohne Namen
 *     unit-poll    {stage, item, counts, votes, before?}  die Balken einer Umfrage (vorher/nachher)
 *   Schüler (versiegelt für die Przyjęcia — nur der Lehrer öffnet):
 *     progress     {participant, stage, item, what start|answer|done, step?, result?, tag?, lines?, predict?, at}
 *     help         {participant, stage, on, at}
 *     prompt       {participant, stage, item, text? | choice?, at}
 *   Abstimmungen gemeinsamer Etapy bleiben `question`/`answer`/`reveal` (LessonHost).
 * </code>
 */

import type { Me } from '../../core/me';
import type { CogitaLibrary } from '../store';
import { newSession } from '../lesson/lessonApi';
import { DEFAULT_THRESHOLDS } from '../lesson/lessonTally';
import { bodies, type Opened } from '../sessionEvents';
import { readUnit, type HelpSignal, type HostEvent, type Progress, type PromptAnswer, type Unit } from './unitModel';

export const HOST_KINDS = {
  stage: 'unit-stage', item: 'unit-item', look: 'unit-look', results: 'unit-results', end: 'unit-end', pause: 'unit-pause',
  resume: 'unit-resume', plan: 'unit-plan', wall: 'unit-wall', poll: 'unit-poll'
} as const;

export interface UnitConfig {
  readonly title: string;
  readonly unitId: string;
  readonly unit: Unit;
}

/** Die Einheit aus der Einstellung der Sitzung — `null`: keine Klassensitzung einer Einheit. */
export function unitConfigOf(opened: readonly Opened[]): UnitConfig | null {
  const last = bodies<Record<string, unknown>>(opened, 'config').pop()?.body;
  if (last === undefined || typeof last.unit !== 'object' || last.unit === null) return null;
  const unitId = typeof last.unitId === 'string' ? last.unitId : '';
  const unit = readUnit(unitId, last.unit as Record<string, unknown>);
  return unit.stages.length === 0 ? null : { title: typeof last.title === 'string' ? last.title : unit.name, unitId, unit };
}

/** Ist diese Einstellung die einer Einheit (ohne sie ganz zu lesen)? */
export const isUnitConfig = (config: unknown): boolean => typeof config === 'object' && config !== null && typeof (config as { unit?: unknown }).unit === 'object';

const kindOf: Readonly<Record<string, HostEvent['kind']>> = {
  'unit-stage': 'stage', 'unit-look': 'look', 'unit-results': 'results', 'unit-end': 'end', 'unit-pause': 'pause', 'unit-resume': 'resume', 'unit-plan': 'plan'
};

/** Was der Lehrer sagte, in der Reihenfolge der Sitzung. */
export function hostEvents(opened: readonly Opened[]): HostEvent[] {
  return opened.flatMap((o) => {
    const kind = kindOf[o.event.kind];
    if (kind === undefined || typeof o.body !== 'object' || o.body === null) return [];
    return [{ ...(o.body as object), kind } as HostEvent];
  });
}

export interface ItemNow { readonly stage: string; readonly index: number; readonly at: number }
export const itemNow = (opened: readonly Opened[]): ItemNow | null => bodies<ItemNow>(opened, HOST_KINDS.item).pop()?.body ?? null;

export interface WallEvent { readonly stage: string; readonly item: string; readonly texts: readonly string[] }
export interface PollEvent { readonly stage: string; readonly item: string; readonly counts: readonly number[]; readonly votes: number; readonly before?: { readonly counts: readonly number[]; readonly votes: number } }

export const wallOf = (opened: readonly Opened[], stage: string, item: string): WallEvent | null =>
  bodies<WallEvent>(opened, HOST_KINDS.wall).map((x) => x.body).filter((w) => w.stage === stage && w.item === item).pop() ?? null;
export const pollOf = (opened: readonly Opened[], stage: string, item: string): PollEvent | null =>
  bodies<PollEvent>(opened, HOST_KINDS.poll).map((x) => x.body).filter((w) => w.stage === stage && w.item === item).pop() ?? null;

/** Die Meldungen der Schüler (nur der Lehrer kann sie öffnen). */
export const progressOf = (opened: readonly Opened[]): Progress[] => bodies<Progress>(opened, 'progress').map((x) => x.body).filter((p) => typeof p.participant === 'string' && typeof p.stage === 'string');
export const helpOf = (opened: readonly Opened[]): HelpSignal[] => bodies<HelpSignal>(opened, 'help').map((x) => x.body).filter((p) => typeof p.participant === 'string');
export const promptsOf = (opened: readonly Opened[]): PromptAnswer[] => bodies<PromptAnswer>(opened, 'prompt').map((x) => x.body).filter((p) => typeof p.participant === 'string');

/** Wer beigetreten ist, mit Namen (der letzte Name gilt). */
export function participantsOf(opened: readonly Opened[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const j of bodies<{ participant: string; name?: string }>(opened, 'join')) if (typeof j.body.participant === 'string') out.set(j.body.participant, j.body.name ?? '');
  for (const p of progressOf(opened)) if (!out.has(p.participant)) out.set(p.participant, '');
  return out;
}

/** Eine Klassensitzung aus einer Einheit anlegen (mit Code und Link, wie jede Stunde). */
export async function createUnitSession(lib: CogitaLibrary, me: Me, input: { areaId: string; unitId: string; title: string }): Promise<string> {
  const doc = lib.docs('unit').find((d) => d.id === input.unitId);
  if (doc === undefined) throw new Error('unit');
  const config = { title: input.title, unitId: input.unitId, unit: doc.data, parts: [], showVotes: 'after', thresholds: DEFAULT_THRESHOLDS };
  const session = await newSession(lib, me, { areaId: input.areaId, kind: 'lesson', title: input.title, join: true }, config,
    { library: lib.libraryId, lesson: true, unit: input.unitId });
  return session.sessionId;
}
