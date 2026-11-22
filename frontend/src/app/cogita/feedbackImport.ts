/**
 * 2026-11-22 (Eigentümer, „Gute Welten", I6) — UWAGI ERLEDIGEN MIT DEM IMPORT: wer eine Welt nach den Rückmeldungen verbessert
 * (MCP `get_feedback`), schreibt in dieselbe Datei, welche er erledigt hat:
 * <code>
 *   "feedback": [{ "id": "<Kennung der Uwaga>", "state": "done", "note": "was geändert wurde" }]
 * </code>
 * Die Vorschau nennt jede (vorgeschlagen angenommen, abwählbar — `importReview.ts` `resolves`); gespeichert wird sie mit dem
 * Import in DEMSELBEN Zapis (alle oder keiner): Zustand, Notiz, Zeitpunkt. Eine unbekannte Kennung ist eine Warnung, kein
 * Fehler. MCP bleibt nur lesend — erledigt wird erst, wenn der Eigentümer den Import bestätigt. `"state": "open"` öffnet eine
 * erledigte wieder (selten). Nur in einem Kurs (`recreatio.cogita.course`).
 */

import { t } from '../core/i18n';
import { FEEDBACK_LABEL, FEEDBACK_TEXT_MAX, readFeedback } from './feedback';
import type { ImportPlan } from './json';
import type { CogitaLibrary } from './store';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export interface FeedbackPlan {
  readonly docs: ImportPlan['docs'];
  readonly warnings: readonly string[];
  /** Eine Zeile der Vorschau (leer: nichts zu erledigen). */
  readonly line: string;
}

export const EMPTY_FEEDBACK_PLAN: FeedbackPlan = { docs: [], warnings: [], line: '' };

/** Was ein Dokument an Uwagi erledigt — als geänderte Dokumente `feedback` des Plans. `now`: der Zeitpunkt (ISO). */
export function feedbackResolutions(lib: CogitaLibrary, doc: Readonly<Record<string, unknown>>, course: boolean, now: string = new Date().toISOString()): FeedbackPlan {
  const raw = doc.feedback;
  if (raw === undefined) return EMPTY_FEEDBACK_PLAN;
  if (!course) return { docs: [], warnings: [t('cogitaData.feedbackImport.onlyCourse')], line: '' };
  if (!Array.isArray(raw)) return { docs: [], warnings: [t('cogitaData.feedbackImport.notList')], line: '' };
  const docs: ImportPlan['docs'][number][] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  let reopened = 0;
  for (const one of raw) {
    const id = isObject(one) ? str(one.id).replace(/^@/, '') : '';
    if (id === '') { warnings.push(t('cogitaData.feedbackImport.noId')); continue; }
    if (seen.has(id.toLowerCase())) continue;
    seen.add(id.toLowerCase());
    const before = lib.docs('feedback').find((d) => d.id.toLowerCase() === id.toLowerCase());
    const read = before === undefined ? null : readFeedback(before.id, before.data);
    if (before === undefined || read === null) { warnings.push(t('cogitaData.feedbackImport.unknown', { id })); continue; }
    const state = str((one as Record<string, unknown>).state) === 'open' ? 'open' : 'done';
    const note = str((one as Record<string, unknown>).note).slice(0, FEEDBACK_TEXT_MAX);
    if (read.state === state && (note === '' || note === (read.note ?? ''))) continue;
    if (state === 'open') reopened += 1;
    const data: Record<string, unknown> = { ...before.data, state };
    if (note !== '') data.note = note;
    if (state === 'done') data.doneAt = now; else delete data.doneAt;
    docs.push({ id: before.id, kind: 'feedback', data, isNew: false });
  }
  const done = docs.length - reopened;
  const line = docs.length === 0 ? '' : t('cogitaData.feedbackImport.line', { count: done, reopened });
  return { docs, warnings, line };
}

/** Wie eine Uwaga in der Durchsicht heisst: ihre Art und worauf sie zeigt. */
export function feedbackTitle(data: Readonly<Record<string, unknown>>): string {
  const read = readFeedback('', data);
  if (read === null) return t('cogitaData.feedbackImport.titlePlain');
  return t('cogitaData.feedbackImport.title', { category: FEEDBACK_LABEL[read.category], label: read.target.label || '—' });
}
