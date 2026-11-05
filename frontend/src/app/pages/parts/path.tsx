/**
 * BAUSTEIN „ŚCIEŻKA" (2026-11-03, F) — die Ścieżka einer Baza wiedzy als Karte (`cogita/PathMap.tsx`): Knoten von unten
 * nach oben, Wege, die sich gabeln und wieder zusammenkommen, der Stand des Besuchers wie im Krajobraz. Gebaut aus der
 * einen Reihenfolge des Lernens — keine eigene Struktur.
 *
 * <b>Welche Einträge:</b> eine Erzählung (`flow` — ihre Einträge; „jetzt dran" ist, wo der Besucher in ihr steht), eine
 * Einheit (`entry` — ihre Teile, sonst die Pytania über sie), ein Widok (`view`), sonst die ganze Baza. Ein Knoten
 * bietet „Ucz się" (mit dem, was davor kommt) — im Baustein selbst, wie „Powtórka".
 *
 * <b>Je Grösse:</b> im Streifen eine Zeile (wie viel durch ist, was jetzt dran ist); als Block die kleine Karte; hoch und
 * im Vollbild die grosse mit Namen.
 */

import { t } from '../../core/i18n';
import { text, type RawConfig } from '../part';
import { later } from '../../ui/later';
import { defineTextPart, field, texts, withTexts } from './partTexts';

export interface PathConfig {
  readonly title: string;
  readonly library: string;
  /** Eine Erzählung der Baza: ihre Einträge, und wo der Besucher in ihr steht. */
  readonly flow: string;
  /** Eine Einheit: ihre Teile (oder die Pytania über sie). */
  readonly entry: string;
  /** Ein Widok: seine Einträge. Alles leer: die ganze Baza. */
  readonly view: string;
  /** Wohin die Antworten gehen (wie in „Powtórka"; leer: wie die Baza). */
  readonly answers: string;
}

export const pathPart = defineTextPart<PathConfig>({
  kind: 'path',
  example: withTexts({}, texts({ title: 'moduleDataLearn.path.exTitle', library: 'moduleDataCogita.ex.base', flow: 'moduleDataLearn.path.exFlow', entry: 'moduleDataLearn.path.exEntry', view: 'moduleDataLearn.path.exView', answers: 'moduleDataLearn.path.exAnswers' })),
  box: { colSpan: 3, rowSpan: 4 },
  fields: [
    field({ key: 'title', kind: 'line' }, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleDataLearn.path.titleHint' })),
    field({ key: 'library', kind: 'knowledge' }, texts({ label: 'moduleDataCogita.f.fromBase' })),
    field({ key: 'flow', kind: 'libraryEntry', of: 'library', entryKinds: ['flow'], optional: true }, texts({ label: 'moduleDataLearn.path.flow', none: 'moduleDataLearn.path.flowNone' })),
    field({ key: 'entry', kind: 'line' }, texts({ label: 'moduleDataLearn.path.entry', hint: 'moduleDataLearn.path.entryHint' })),
    field({ key: 'view', kind: 'libraryEntry', of: 'library', entryKinds: ['view'], optional: true }, texts({ label: 'moduleDataLearn.path.view', none: 'moduleDataLearn.path.viewNone' })),
    field({ key: 'answers', kind: 'area' }, texts({ label: 'moduleDataCogita.f.answers', hint: 'moduleDataCogita.f.answersHint' }))
  ],
  read: (raw: RawConfig): PathConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), flow: text(raw, 'flow'), entry: text(raw, 'entry'), view: text(raw, 'view'), answers: text(raw, 'answers') }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? t('moduleDataCogita.m.pickBase') : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? t('moduleDataLearn.path.showsStrip')
    : size.height === 'tall' ? t('moduleDataLearn.path.showsTall')
    : t('moduleDataLearn.path.showsBlock'),
  View: later(() => import('./pathViews').then((m) => m.PathView))
}, texts({ label: 'moduleDataLearn.path.label', use: 'moduleDataLearn.path.use' }));
