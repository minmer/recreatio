/**
 * BAUSTEIN „WIDOK" (2026-10-22, Schritt 9) — ein gespeicherter Widok einer
 * Baza wiedzy auf einer Seite: dieselbe Auswahl wie in „Wpisy" (Schritte aus
 * `cogita/selection.ts`, die auch eine Powtórka benutzt), als Tabela oder
 * Drzewo mit Gruppen, mit einer Suche; ein Klick klappt den Eintrag unter dem
 * Widok auf (oder wählt ihn oben, wenn die Seite einen Wpis wählt).
 *
 * <b>Sein Zustand steht in der Adresse unter seinem eigenen Zakres</b>
 * (`partQuery.ts`): `?<zakres>.q=` die Suche, `.e=` der offene Eintrag, `.u=`
 * Tabela/Drzewo, `.s=` die Reihenfolge. Zwei Widoki auf einer Seite stören
 * einander nicht.
 *
 * <b>Wer ihn sieht:</b> wer die Baza lesen darf (`cogita/pageBase.ts`) — eine
 * öffentliche, geöffnete jeder, sonst Mitglieder, Links, Plätze.
 *
 * <b>Je Grösse:</b> im Streifen eine Zeile mit „Zobacz"; als Block die ersten
 * Einträge; hoch und im Vollbild das Ganze.
 */

import { definePart, text, type RawConfig } from '../part';
import { later } from '../../ui/later';

export interface ViewConfig {
  readonly title: string;
  readonly library: string;
  readonly view: string;
  /** `tabela` / `drzewo` (auch `table` / `tree`) — leer: wie gespeichert. */
  readonly mode: string;
}

const ViewView = later(() => import('./viewViews').then((m) => m.ViewView));

export const viewPart = definePart<ViewConfig>({
  kind: 'view',
  example: { title: 'Postacie Starego Testamentu', library: '<id-bazy-wiedzy>', view: '<id-widoku>', mode: 'drzewo' },
  label: 'Widok',
  use: 'Zapisany widok bazy wiedzy (Nauka → baza → Wpisy → „Zapisz jako widok"): wybrane wpisy jako tabela albo drzewo z grupami, z wyszukiwaniem; kliknięty wpis rozwija się pod spodem. Widzi go ten, kto może czytać bazę.',
  box: { colSpan: 6, rowSpan: 4 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'puste: nazwa widoku' },
    { key: 'library', label: 'Z której bazy wiedzy', kind: 'knowledge' },
    { key: 'view', label: 'Który widok', kind: 'libraryEntry', of: 'library', entryKinds: ['view'] },
    { key: 'mode', label: 'Jak pokazać', kind: 'line', hint: 'tabela albo drzewo — puste: jak zapisano' }
  ],
  read: (raw: RawConfig): ViewConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), view: text(raw, 'view'), mode: text(raw, 'mode') }),
  hasContent: (c) => c.library !== '' && c.view !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bazę wiedzy.' : c.view === '' ? 'Wybierz widok (zapisany w „Wpisach” tej bazy).' : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? 'Jedna linia: nazwa, ile wpisów, przycisk „Zobacz".'
    : size.height === 'tall' ? 'Cały widok: wyszukiwanie, tabela albo drzewo; kliknięty wpis rozwija się pod spodem.'
    : 'Pierwsze wpisy widoku — reszta w pełnym ekranie.',
  View: ViewView
});
