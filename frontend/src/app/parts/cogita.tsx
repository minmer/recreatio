/**
 * COGITA AUF EINER SEITE (0109, COGITA.md §14) — was eine Bibliothek
 * veröffentlicht hat, läuft hier ohne Schlüssel und ohne Konto:
 *
 * <code>
 *   cogita-revision   eine Powtórka — die Abschrift ihrer Karten
 *   cogita-flow       ein Przebieg: Kurs, Erzählung, Gespräch, Karte zum Entdecken
 *   cogita-live       an einer Sitzung teilnehmen — mit dem Code oder dem Link
 *   entity-card       die Karte eines Eintrags
 *   entity-table      die veröffentlichten Einträge als Tabelle
 *   topic-explorer    die Themen, eins im anderen, mit dem, was zu ihnen gehört
 *   knowledge-map     die Karte des Wissens einer Powtórka, im eigenen Nebel
 *   seat-learn        hinter einem persönlichen Link: das Lernen dieses Menschen
 * </code>
 *
 * Wer ohne Konto lernt, lernt im Browser [L6]: sein Fortschritt bleibt dort
 * und lässt sich nach der Anmeldung mitnehmen. Ein Platz lernt als er selbst —
 * seine Antworten gehen versiegelt in den Bereich des Kurses.
 *
 * <b>Je Grösse eine eigene Zusage:</b> im Streifen ein Satz (oder ein Knopf),
 * als Block die Übersicht mit „Zacznij", hoch und im Vollbild das Ganze.
 *
 * <b>Hier nur, was der Editor und das Verzeichnis brauchen</b> — Felder,
 * Beispiel, was in welcher Grösse steht. Die Ansichten (`cogitaViews.tsx`)
 * mit Karten, Abläufen und Sitzungen kommen erst, wenn eine Seite sie zeigt:
 * eine Pfarrseite ohne Cogita lädt davon nichts.
 */

import { createElement, lazy, Suspense, type ComponentType } from 'react';

import { definePart, text, type PartContext, type RawConfig } from '../part';

/** Eine Ansicht, die erst geladen wird, wenn sie gezeigt wird — bis dahin ein Satz. */
function later<C>(load: () => Promise<{ default: ComponentType<{ config: C; ctx: PartContext }> }>): ComponentType<{ config: C; ctx: PartContext }> {
  const Lazy = lazy(load);
  const View = (props: { config: C; ctx: PartContext }) =>
    createElement(Suspense, { fallback: createElement('p', { className: 'wk-card-muted' }, 'Wczytywanie…') }, createElement(Lazy, props));
  return View;
}

/* == Powtórka ==================================================================================== */

export interface RevisionConfig {
  readonly title: string;
  readonly library: string;
  readonly revision: string;
}

export const cogitaRevisionPart = definePart<RevisionConfig>({
  kind: 'cogita-revision',
  example: { title: 'Powtórka przed bierzmowaniem', library: '<id-biblioteki>', revision: '<id-opublikowanej-powtórki>' },
  label: 'Powtórka',
  use: 'Opublikowana powtórka z Biblioteki (Cogita) — każdy powtarza bez konta, postępy zostają w jego przeglądarce.',
  box: { colSpan: 4, rowSpan: 3 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'puste: nazwa powtórki' },
    { key: 'library', label: 'Z której biblioteki', kind: 'library' },
    { key: 'revision', label: 'Która powtórka', kind: 'libraryEntry', of: 'library', entryKinds: ['revision'] }
  ],
  read: (raw: RawConfig): RevisionConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), revision: text(raw, 'revision') }),
  hasContent: (c) => c.library !== '' && c.revision !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bibliotekę.' : c.revision === '' ? 'Wybierz opublikowaną powtórkę (Biblioteka → Nauka i kursy → Powtórki → Udostępnij).' : null),
  strip: { title: 'Powtórka', open: 'Zacznij' },
  fullscreen: true,
  shows: (_c, size) => size.height === 'tall' ? 'Cała powtórka od razu — karta po karcie.'
    : size.height === 'strip' ? 'Nagłówek i przycisk — powtórka rozwija się po kliknięciu.'
    : 'Ile kart i ile już umiesz — przycisk „Zacznij".',
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.RevisionView })))
});

/* == Przebieg ==================================================================================== */

export interface FlowConfig {
  readonly title: string;
  readonly library: string;
  readonly flow: string;
}

export const cogitaFlowPart = definePart<FlowConfig>({
  kind: 'cogita-flow',
  example: { title: 'Droga przez Ewangelię Marka', library: '<id-biblioteki>', flow: '<id-opublikowanego-przebiegu>' },
  label: 'Kurs / opowieść',
  use: 'Opublikowany przebieg z Biblioteki (Cogita): kurs, opowieść, rozmowa w dymkach, mapa do odkrywania — bez konta.',
  box: { colSpan: 6, rowSpan: 5 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'puste: nazwa przebiegu' },
    { key: 'library', label: 'Z której biblioteki', kind: 'library' },
    { key: 'flow', label: 'Który przebieg', kind: 'libraryEntry', of: 'library', entryKinds: ['flow'] }
  ],
  read: (raw: RawConfig): FlowConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), flow: text(raw, 'flow') }),
  hasContent: (c) => c.library !== '' && c.flow !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bibliotekę.' : c.flow === '' ? 'Wybierz opublikowany przebieg (Biblioteka → Nauka i kursy → Przebiegi → Opublikuj).' : null),
  strip: { title: 'Kurs', open: 'Zacznij' },
  fullscreen: true,
  shows: (_c, size) => size.height === 'tall' ? 'Cały przebieg od razu, krok po kroku.'
    : size.height === 'strip' ? 'Nagłówek i przycisk — przebieg rozwija się po kliknięciu.'
    : 'Jaki to przebieg, ile kroków i celów — przycisk „Zacznij" (albo „Wróć tam, gdzie skończyłeś").',
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.FlowView })))
});

/* == Sesja na żywo =============================================================================== */

export interface LiveConfig {
  readonly title: string;
}

export const cogitaLivePart = definePart<LiveConfig>({
  kind: 'cogita-live',
  example: { title: 'Dołącz do quizu' },
  label: 'Dołącz do sesji',
  use: 'Pole na kod sesji Cogity (quiz na żywo, powtórka w grupie, gra) — link z kodem QR otwiera sesję na tej stronie od razu.',
  box: { colSpan: 3, rowSpan: 3 },
  fields: [{ key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Dołącz do quizu' }],
  read: (raw: RawConfig): LiveConfig => ({ title: text(raw, 'title') }),
  hasContent: () => true,
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? 'Jedna linia: pole na kod i „Dołącz".'
    : size.height === 'tall' ? 'Pole na kod z wyjaśnieniem — po dołączeniu cała sesja w kafelku.'
    : 'Pole na kod i „Dołącz" — po dołączeniu pytania i odpowiedzi w kafelku.',
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.LiveView })))
});

/* == Karta wpisu ================================================================================= */

export interface EntityConfig {
  readonly title: string;
  readonly library: string;
  readonly entry: string;
}

export const entityCardPart = definePart<EntityConfig>({
  kind: 'entity-card',
  example: { title: 'Św. Józef', library: '<id-biblioteki>', entry: '<id-opublikowanego-wpisu>' },
  label: 'Karta wpisu',
  use: 'Jeden opublikowany wpis Biblioteki — postać, miejsce, pojęcie, wiedza — z polami i zdjęciem.',
  box: { colSpan: 3, rowSpan: 3 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'puste: nazwa wpisu' },
    { key: 'library', label: 'Z której biblioteki', kind: 'library' },
    { key: 'entry', label: 'Który wpis', kind: 'libraryEntry', of: 'library', entryKinds: ['entity', 'person', 'work', 'topic'], optional: true }
  ],
  read: (raw: RawConfig): EntityConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), entry: text(raw, 'entry') }),
  /* Ohne Eintrag zeigt sie den, den die Seite oben wählt (Wybór na stronie: „Wpis z biblioteki"). */
  hasContent: () => true,
  missing: (c) => (c.library === '' && c.entry === '' ? null : c.library === '' ? 'Wybierz bibliotekę.' : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? 'Jedna linia: nazwa wpisu i jego rodzaj.'
    : size.height === 'tall' ? 'Cały wpis: wszystkie pola i pliki.'
    : 'Nazwa, zdjęcie i cztery pierwsze pola.',
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.EntityCardView })))
});

/* == Tabela wpisów =============================================================================== */

export interface TableConfig {
  readonly title: string;
  readonly library: string;
  readonly kind: string;
  readonly columns: readonly string[];
}

export const entityTablePart = definePart<TableConfig>({
  kind: 'entity-table',
  example: { title: 'Postacie Starego Testamentu', library: '<id-biblioteki>', kind: 'Postać', columns: 'Kiedy żył, Księga' },
  label: 'Tabela wpisów',
  use: 'Opublikowane wpisy Biblioteki (Cogita) jako tabela — z wyszukiwaniem; mały kafelek pokazuje listę.',
  box: { colSpan: 6, rowSpan: 3 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Postacie' },
    { key: 'library', label: 'Z której biblioteki', kind: 'library' },
    { key: 'kind', label: 'Tylko rodzaj', kind: 'line', hint: 'nazwa rodzaju, np. Postać — puste: wszystkie' },
    { key: 'columns', label: 'Kolumny', kind: 'line', hint: 'nazwy pól po przecinku — puste: cztery pierwsze' }
  ],
  read: (raw: RawConfig): TableConfig => ({
    title: text(raw, 'title'), library: text(raw, 'library'), kind: text(raw, 'kind'),
    columns: text(raw, 'columns').split(',').map((c) => c.trim()).filter((c) => c !== '')
  }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bibliotekę.' : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? 'Jedna linia: ile wpisów, przycisk „Zobacz".'
    : size.height === 'tall' ? 'Cała tabela z wyszukiwaniem; kliknięty wpis rozwija się pod nią.'
    : 'Osiem pierwszych nazw — reszta w pełnym ekranie.',
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.EntityTableView })))
});

/* == Tematy ====================================================================================== */

export interface TopicsConfig {
  readonly title: string;
  readonly library: string;
  readonly topic: string;
}

export const topicExplorerPart = definePart<TopicsConfig>({
  kind: 'topic-explorer',
  example: { title: 'Tematy katechezy', library: '<id-biblioteki>', topic: '<id-tematu albo puste>' },
  label: 'Tematy',
  use: 'Opublikowane tematy Biblioteki, jeden w drugim — i to, co do nich należy (teksty, cytaty, wpisy).',
  box: { colSpan: 4, rowSpan: 3 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Tematy' },
    { key: 'library', label: 'Z której biblioteki', kind: 'library' },
    { key: 'topic', label: 'Zacznij od tematu', kind: 'libraryEntry', of: 'library', entryKinds: ['topic'], optional: true }
  ],
  read: (raw: RawConfig): TopicsConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), topic: text(raw, 'topic') }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bibliotekę.' : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? 'Jedna linia: ile tematów, przycisk „Przeglądaj".'
    : size.height === 'tall' ? 'Tematy do przechodzenia w głąb i wpisy wybranego tematu.'
    : 'Tematy jako przyciski — w głąb po kliknięciu.',
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.TopicExplorerView })))
});

/* == Mapa wiedzy ================================================================================= */

export interface MapConfig {
  readonly title: string;
  readonly library: string;
  readonly revision: string;
}

export const knowledgeMapPart = definePart<MapConfig>({
  kind: 'knowledge-map',
  example: { title: 'Mapa: Dzieje Apostolskie', library: '<id-biblioteki>', revision: '<id-opublikowanej-powtórki>' },
  label: 'Mapa wiedzy',
  use: 'Wpisy opublikowanej powtórki jako mapa: co już umiesz, jest jasne; granica do odkrycia; reszta we mgle — bez konta.',
  box: { colSpan: 6, rowSpan: 5 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Mapa wiedzy' },
    { key: 'library', label: 'Z której biblioteki', kind: 'library' },
    { key: 'revision', label: 'Z której powtórki', kind: 'libraryEntry', of: 'library', entryKinds: ['revision'] }
  ],
  read: (raw: RawConfig): MapConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), revision: text(raw, 'revision') }),
  hasContent: (c) => c.library !== '' && c.revision !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bibliotekę.' : c.revision === '' ? 'Wybierz opublikowaną powtórkę.' : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? 'Jedna linia: ile już umiesz, przycisk „Mapa".'
    : size.height === 'tall' ? 'Cała mapa z nazwami; kliknięty wpis i „Ucz się tego".'
    : 'Mała mapa — nazwy po najechaniu; kliknięty wpis w skrócie.',
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.KnowledgeMapView })))
});

/* == Nauka osoby z linkiem ======================================================================= */

export interface SeatLearnConfig {
  readonly title: string;
  readonly library: string;
  readonly revision: string;
}

export const seatLearnPart = definePart<SeatLearnConfig>({
  kind: 'seat-learn',
  example: { title: 'Twoja nauka', library: '<id-biblioteki>', revision: '<id-powtórki albo puste>' },
  label: 'Nauka (osoba z linkiem)',
  use: 'Powtórki z biblioteki kursu dla osoby z linkiem — jej postępy idą do kursu (prowadzący widzą je w Postępach).',
  box: { colSpan: 3, rowSpan: 3 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Twoja nauka' },
    { key: 'library', label: 'Z której biblioteki', kind: 'library' },
    { key: 'revision', label: 'Tylko powtórka', kind: 'line', hint: 'identyfikator powtórki — puste: wszystkie powtórki biblioteki' }
  ],
  read: (raw: RawConfig): SeatLearnConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), revision: text(raw, 'revision') }),
  hasContent: () => true,
  missing: (c) => (c.library === '' ? 'Wybierz bibliotekę kursu — osoba z linkiem musi czytać jej obszar (rola formularza albo udostępnienie).' : null),
  strip: { title: 'Twoja nauka', open: 'Otwórz' },
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? 'Nagłówek i przycisk — nauka rozwija się po kliknięciu.'
    : size.height === 'tall' ? 'Ile czeka, ile już umie, i powtórki do wyboru.'
    : 'Ile czeka na teraz i powtórki do wyboru.',
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.SeatLearnView })))
});
