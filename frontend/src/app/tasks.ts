/**
 * AUFGABEN (0054) — die Browserseite.
 *
 * <code>
 *   window   ein Zeitfenster, das wiederkehren kann — ein Gebet zwischen 21:00
 *            und 21:15, jeden Tag. Erledigt wird ein Vorkommen; ist das
 *            Fenster vorbei, ohne dass es erledigt wurde, ist es versäumt.
 *   after    ein Abstand nach dem letzten Erledigen — Blumen gießen alle drei
 *            Tage. Wer sie erledigt, stellt die Uhr neu; bis dahin läuft sie
 *            (`progress`: 1 heisst fällig, darüber zu spät).
 * </code>
 *
 * Titel und Notiz werden HIER versiegelt, unter dem Schlüssel des Bereichs,
 * der die Aufgabe sieht („Tylko ja" oder eine Gruppe). Wann was fällig ist,
 * rechnet der Dienst — diese Datei sagt nur, was das für den Menschen heisst.
 */

import { areaKeys, newestKey } from './chat';
import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from './crypto';
import { newId } from './ids';
import type { Ring } from './keys';
import type { RepeatKind } from './agenda';
import { call, WorkspaceError } from './session';
import { levelOf, urgency, type UrgencyLevel } from './urgency';

export type TaskKind = 'window' | 'after';

export interface TaskOccurrence {
  readonly at: string;
  readonly endsAt: string;
  readonly doneAt: string | null;
  readonly doneBy: string | null;
  /** Abgesagt: entschieden, aber nicht getan. */
  readonly skippedAt: string | null;
  readonly skippedBy: string | null;
}

export interface TaskRow {
  readonly taskId: string;
  readonly areaId: string;
  readonly ownerRoleId: string;
  readonly kind: TaskKind;
  readonly timeZone: string;
  readonly startsAt: string;
  readonly windowMinutes: number;
  readonly everyMinutes: number | null;
  readonly repeatKind: RepeatKind;
  readonly repeatEvery: number;
  readonly repeatWeekdays: number | null;
  readonly repeatUntil: string | null;
  readonly repeatCount: number | null;
  readonly epoch: number;
  readonly titleSealed: string;
  readonly notesSealed: string | null;
  readonly createdAt: string;
  readonly occurrences: readonly TaskOccurrence[];
  readonly lastDoneAt: string | null;
  readonly lastDoneBy: string | null;
  readonly dueAt: string | null;
  /** after: die letzte Entscheidung war eine Absage — die Uhr läuft trotzdem neu. */
  readonly skippedAt: string | null;
  /** Das Vorkommen der letzten Entscheidung — das, was ein „Cofnij" loescht. */
  readonly lastSettledAt: string | null;
  readonly history: readonly { doneAt: string; doneBy: string }[];
}

export interface OpenTask extends TaskRow {
  readonly title: string;
  readonly notes: string | null;
}

export const loadTasks = (from: Date, to: Date): Promise<{ now: string; tasks: readonly TaskRow[] }> =>
  call(`/workspace/tasks?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);

const titleAad = (taskId: string) => aad('task', 'task', taskId, Field.TaskTitle, 1);
const notesAad = (taskId: string) => aad('task', 'task', taskId, Field.TaskNotes, 1);

export async function openTasks(ring: Ring, rows: readonly TaskRow[]): Promise<OpenTask[]> {
  const out: OpenTask[] = [];
  for (const row of rows) {
    let title = 'Zadanie';
    let notes: string | null = null;
    try {
      const key = (await areaKeys(ring, row.areaId)).get(row.epoch);
      if (key !== undefined) {
        title = await openText(key, titleAad(row.taskId), fromBase64Url(row.titleSealed));
        if (row.notesSealed !== null) notes = await openText(key, notesAad(row.taskId), fromBase64Url(row.notesSealed));
      }
    } catch {
      // Nicht lesbar — dann steht nur „Zadanie" da, aber die Zeit stimmt.
    }
    out.push({ ...row, title, notes });
  }
  return out;
}

export interface TaskDraft {
  readonly title: string;
  readonly notes: string;
  readonly areaId: string;
  readonly ownerRoleId: string;
  readonly kind: TaskKind;
  /** window: Tag und Beginn des (ersten) Fensters. after: wann sie das erste Mal fällig ist. */
  readonly date: string;
  readonly time: string;
  readonly windowMinutes: number;
  readonly everyMinutes: number | null;
  readonly repeat: RepeatKind;
  readonly every: number;
  readonly weekdays: number;
  readonly until: string | null;
}

/** Anlegen (ohne `taskId`) oder ändern — versiegelt unter dem jüngsten Schlüssel des gewählten Bereichs. */
export async function saveTask(ring: Ring, draft: TaskDraft, taskId?: string): Promise<string> {
  const id = taskId ?? newId();
  const newest = newestKey(await areaKeys(ring, draft.areaId, true));
  if (newest === null) throw new WorkspaceError('Nie masz klucza tego obszaru — nie da się tu zapisać.');

  const body = {
    taskId: id,
    areaId: draft.areaId,
    ownerRoleId: draft.ownerRoleId,
    kind: draft.kind,
    date: draft.date,
    time: draft.time,
    windowMinutes: draft.kind === 'window' ? draft.windowMinutes : 0,
    everyMinutes: draft.kind === 'after' ? draft.everyMinutes : null,
    repeat: draft.kind === 'window' ? draft.repeat : 'none',
    every: draft.every,
    weekdays: draft.repeat === 'weekly' ? draft.weekdays : null,
    until: draft.until,
    count: null,
    epoch: newest.epoch,
    titleSealed: toBase64Url(await sealText(newest.key, titleAad(id), draft.title.trim() || 'Zadanie')),
    notesSealed: draft.notes.trim() === '' ? null : toBase64Url(await sealText(newest.key, notesAad(id), draft.notes.trim())),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };

  await call(taskId === undefined ? '/workspace/tasks' : `/workspace/task/${encodeURIComponent(taskId)}`, {
    method: 'POST', body: JSON.stringify(body)
  });
  return id;
}

export const archiveTask = (taskId: string): Promise<{ archived: boolean }> =>
  call(`/workspace/task/${encodeURIComponent(taskId)}/archive`, { method: 'POST' });

export const markDone = (taskId: string, byRoleId: string, occurrenceAt?: string): Promise<{ occurrenceAt: string; doneAt: string }> =>
  call(`/workspace/task/${encodeURIComponent(taskId)}/done`, {
    method: 'POST', body: JSON.stringify({ byRoleId, occurrenceAt: occurrenceAt ?? null })
  });

/** „Dieses eine Mal nicht" — entschieden, aber nicht getan. */
export const markSkipped = (taskId: string, byRoleId: string, occurrenceAt?: string): Promise<{ occurrenceAt: string; doneAt: string }> =>
  call(`/workspace/task/${encodeURIComponent(taskId)}/skip`, {
    method: 'POST', body: JSON.stringify({ byRoleId, occurrenceAt: occurrenceAt ?? null })
  });

export const markUndone = (taskId: string, occurrenceAt: string): Promise<{ undone: boolean }> =>
  call(`/workspace/task/${encodeURIComponent(taskId)}/undone`, {
    method: 'POST', body: JSON.stringify({ occurrenceAt })
  });


/* -- Wie dringend ------------------------------------------------------------------ */

/**
 * Die Dringlichkeit einer Aufgabe, gleich welcher Art.
 *
 * Beide Arten haben in Wahrheit dieselbe Gestalt — eine Zeit, ab der etwas
 * getan werden kann, und eine, bis zu der es getan sein soll:
 *
 * <code>
 *   window   Anfang und Ende des Fensters
 *   after    seit dem letzten Mal → wann es wieder dran ist
 * </code>
 *
 * Was entschieden ist, drängt nicht mehr: erledigt und abgesagt sind beide 0.
 * Der Unterschied zwischen ihnen gehört in die Geschichte, nicht in die Liste.
 */
export function taskUrgency(task: TaskRow, occurrence: TaskOccurrence | null, now: Date): number {
  if (occurrence !== null) {
    if (occurrence.doneAt !== null || occurrence.skippedAt !== null) return 0;
    return urgency(new Date(occurrence.at).getTime(), new Date(occurrence.endsAt).getTime(), now.getTime());
  }

  const due = new Date(task.dueAt ?? task.startsAt).getTime();
  const every = Math.max(1, task.everyMinutes ?? 1) * 60_000;

  /*
   * Ohne ein „zuletzt" beginnt das Fenster ein Intervall vor dem ersten Mal:
   * sonst wäre eine eben angelegte Aufgabe, die morgen fällig ist, schon
   * heute halb dringend — oder gar nicht, je nachdem, wo man anfängt zu
   * messen.
   */
  const from = task.lastDoneAt !== null || task.skippedAt !== null
    ? new Date(task.skippedAt ?? task.lastDoneAt ?? task.startsAt).getTime()
    : due - every;

  return urgency(from, due, now.getTime());
}

/** Dieselbe Zahl in Worten — für Farbe und Reihenfolge. */
export const taskLevel = (value: number): UrgencyLevel => levelOf(value);

/* -- Was das für den Menschen heisst ------------------------------------------------ */

export type WindowState = 'done' | 'skipped' | 'open' | 'missed' | 'upcoming';

/** Ein Vorkommen mit Fenster: erledigt, abgesagt, jetzt offen, versäumt oder noch nicht dran. */
export function windowState(one: TaskOccurrence, now: Date): WindowState {
  if (one.doneAt !== null) return 'done';
  if (one.skippedAt !== null) return 'skipped';
  const start = new Date(one.at).getTime();
  const end = Math.max(new Date(one.endsAt).getTime(), start + 60_000);
  const at = now.getTime();
  if (at < start) return 'upcoming';
  return at <= end ? 'open' : 'missed';
}

/**
 * Eine Aufgabe mit Abstand: wie weit die Uhr ist. `progress` 0 heisst eben
 * erledigt, 1 fällig, darüber zu spät.
 */
export function afterState(task: TaskRow, now: Date): { due: Date; progress: number; late: boolean } {
  const due = new Date(task.dueAt ?? task.startsAt);
  const every = Math.max(1, task.everyMinutes ?? 1) * 60_000;
  const from = task.lastDoneAt !== null ? new Date(task.lastDoneAt).getTime() : due.getTime() - every;
  const progress = (now.getTime() - from) / every;
  return { due, progress, late: now.getTime() > due.getTime() };
}

/** „za 25 min", „za 3 godz.", „za 2 dni", „2 dni temu" — grob, wie man es sagt. */
export function howLong(target: Date, now: Date): string {
  const minutes = Math.round((target.getTime() - now.getTime()) / 60_000);
  const size = Math.abs(minutes);
  const word = size < 60 ? `${size} min`
    : size < 36 * 60 ? `${Math.round(size / 60)} godz.`
    : `${Math.round(size / 1440)} dni`;
  if (size < 1) return 'teraz';
  return minutes > 0 ? `za ${word}` : `${word} temu`;
}

/** Ein Abstand in Worten — „co 3 dni", „co 2 godz.", „co tydzień". */
export function everyWords(minutes: number): string {
  if (minutes % 10080 === 0) return minutes === 10080 ? 'co tydzień' : `co ${minutes / 10080} tyg.`;
  if (minutes % 1440 === 0) return minutes === 1440 ? 'codziennie' : `co ${minutes / 1440} dni`;
  if (minutes % 60 === 0) return minutes === 60 ? 'co godzinę' : `co ${minutes / 60} godz.`;
  return `co ${minutes} min`;
}
