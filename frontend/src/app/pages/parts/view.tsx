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

import { definePart, flag, text, type RawConfig } from '../part';
import { later } from '../../ui/later';

export interface ViewConfig {
  readonly title: string;
  readonly library: string;
  readonly view: string;
  /** `tabela` / `drzewo` / `macierz` / `mapa` / 2026-11-01 `postepy` (Mapa postępów; auch englisch: `quilt`) / 2026-11-03 `krajobraz` — leer: wie gespeichert. */
  readonly mode: string;
  /** 2026-11-03 — wohin die Antworten aus dem Krajobraz gehen (wie in „Powtórka"; leer: wie die Baza). */
  readonly answers: string;
  /** 2026-11-03 — Punkte und Serie beim Lernen aus dem Krajobraz (leer: wie ein Baustein „Punkty i seria" der Seite, sonst keine). */
  readonly rewards: string;
  /**
   * 2026-11-05 (Prompt 17, §5) — darf der Leser die Gestalt wechseln und im Widok suchen? Vorgabe NEIN: ein eingebetteter
   * Widok zeigt, was der Besitzer wählte (ohne Reiter, ohne Suche); die eigenen Knöpfe eines Krajobraz bleiben.
   */
  readonly switching: boolean;
}

const ViewView = later(() => import('./viewViews').then((m) => m.ViewView));

export const viewPart = definePart<ViewConfig>({
  kind: 'view',
  example: { title: 'Tajemnice i okresy', library: '<id-bazy-wiedzy>', view: '<id-widoku>', mode: 'macierz', answers: '<id-obszaru-kursu>', rewards: '<id-nagród albo puste>', switch: 'nie' },
  label: 'Widok',
  use: 'Zapisany widok bazy wiedzy (Nauka → baza → Wpisy → „Zapisz jako widok"): wybrane wpisy — także kazania i komentarze z bibliotek, z których baza korzysta — jako tabela, drzewo z grupami, macierz (np. 20 tajemnic × 12 okresów; pole otwiera swoje wpisy), mapa nauki, mapa postępów (kafelki w kolorze tego, jak dobrze odwiedzający zna każdy wpis — klik pokazuje tekst, pytania i „Ćwicz to") albo krajobraz (przed odwiedzającym pierścień tego, czego może się uczyć teraz, dalej góry — tym wyższe, im więcej kroków brakuje, za nim dolina tego, co umie; klik: czytać, uczyć się, powtórzyć, ustawić cel); kliknięty wpis otwiera się pod spodem (komentarz, całe kazanie), droga zostaje w adresie. „Ucz się tego" pyta o pokazane wpisy. Widzi go ten, kto może czytać bazę.',
  box: { colSpan: 6, rowSpan: 4 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'puste: nazwa widoku' },
    { key: 'library', label: 'Z której bazy wiedzy', kind: 'knowledge' },
    { key: 'view', label: 'Który widok', kind: 'libraryEntry', of: 'library', entryKinds: ['view'] },
    { key: 'mode', label: 'Jak pokazać', kind: 'line', hint: 'tabela, drzewo, macierz, mapa, postępy albo krajobraz — puste: jak zapisano' },
    /* 2026-11-03 — wie in „Powtórka": wohin die Antworten gehen, und Punkte beim Lernen (Krajobraz, Mapa postępów). */
    { key: 'answers', label: 'Odpowiedzi uczących się do', kind: 'area', hint: 'puste: jak w bazie wiedzy; bez tego zostają u uczącego się' },
    { key: 'rewards', label: 'Punkty i seria w trakcie nauki', kind: 'libraryEntry', of: 'library', entryKinds: ['reward'], optional: true, none: 'jak moduł „Punkty i seria” na tej stronie' },
    { key: 'switch', label: 'Przełączanie i szukanie', kind: 'line', hint: '„tak” — odwiedzający może zmienić sposób pokazania i szukać w widoku; puste albo „nie” — widzi tylko to, co tu wybrano' }
  ],
  read: (raw: RawConfig): ViewConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), view: text(raw, 'view'), mode: text(raw, 'mode'), answers: text(raw, 'answers'), rewards: text(raw, 'rewards'), switching: flag(raw, 'switch', false) }),
  hasContent: (c) => c.library !== '' && c.view !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bazę wiedzy.' : c.view === '' ? 'Wybierz widok (zapisany w „Wpisach” tej bazy).' : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? 'Jedna linia: nazwa, ile wpisów, przycisk „Zobacz".'
    : size.height === 'tall' ? 'Cały widok: wyszukiwanie, tabela, drzewo, macierz, mapa, mapa postępów albo krajobraz; pole macierzy, kafelek i kliknięty wpis otwierają się pod spodem.'
    : 'Pierwsze wpisy widoku — reszta w pełnym ekranie; mapa postępów — do 60 kafelków; krajobraz — do 24 pól.',
  View: ViewView
});
