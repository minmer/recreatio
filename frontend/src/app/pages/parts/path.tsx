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

import { definePart, text, type RawConfig } from '../part';
import { later } from '../../ui/later';

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

export const pathPart = definePart<PathConfig>({
  kind: 'path',
  example: { title: 'Twoja droga przez kurs', library: '<id-bazy-wiedzy>', flow: '<id-przebiegu albo puste>', entry: '<id albo @nazwa jednostki albo puste>', view: '<id-widoku albo puste>', answers: '<id-obszaru-kursu albo puste>' },
  label: 'Ścieżka',
  use: 'Ścieżka nauki jako mapa (jak ścieżka kursu): od dołu — od podstaw — w górę, z rozwidleniami i miejscami, gdzie drogi się schodzą („2 z 3 ścieżek”); każdy krok to sześciokąt: umiem (zapadnięty, ✓), teraz (wyróżniony), gotowe do nauki (uniesiony, świeci), zablokowane (blade, kłódka), do powtórki (znacznik). Z kolejności nauki bazy („Najpierw trzeba znać”) — dla opowieści (jej wpisy; „teraz” to miejsce w opowieści), jednej jednostki (jej części), widoku albo całej bazy. Klik w krok: „Ucz się” z tym, co trzeba znać wcześniej. Obok opowieści stoi sama — w module „Kurs / opowieść” jest już wbudowana.',
  box: { colSpan: 3, rowSpan: 4 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'puste: „Ścieżka”' },
    { key: 'library', label: 'Z której bazy wiedzy', kind: 'knowledge' },
    { key: 'flow', label: 'Dla opowieści (przebiegu)', kind: 'libraryEntry', of: 'library', entryKinds: ['flow'], optional: true, none: 'bez opowieści' },
    { key: 'entry', label: 'Albo dla jednej jednostki (wpis)', kind: 'line', hint: 'id albo @nazwa wpisu — jego części; puste: nic' },
    { key: 'view', label: 'Albo dla widoku', kind: 'libraryEntry', of: 'library', entryKinds: ['view'], optional: true, none: 'cała baza' },
    { key: 'answers', label: 'Odpowiedzi uczących się do', kind: 'area', hint: 'puste: jak w bazie wiedzy; bez tego zostają u uczącego się' }
  ],
  read: (raw: RawConfig): PathConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), flow: text(raw, 'flow'), entry: text(raw, 'entry'), view: text(raw, 'view'), answers: text(raw, 'answers') }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bazę wiedzy.' : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? 'Jedna linia: ile kroków przerobione i co teraz — przycisk „Zobacz”.'
    : size.height === 'tall' ? 'Cała mapa z nazwami kroków; klik w krok: stan i „Ucz się”.'
    : 'Mała mapa (zwijana) — idzie za miejscem, w którym jest uczący się; klik w krok: stan i „Ucz się”.',
  View: later(() => import('./pathViews').then((m) => m.PathView))
});
