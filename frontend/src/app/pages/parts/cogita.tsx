/**
 * COGITA AUF EINER SEITE (0109, COGITA.md §14) — eine Baza wiedzy auf einer
 * Seite. 2026-10-22 (Schritt 8): keine Abschriften mehr; jeder Baustein liest
 * die Baza selbst, so wie ihr Bereich sie dem Leser zeigt — ein öffentlicher
 * (und geöffneter) jedem, ohne Konto; sonst Mitgliedern, Links, Plätzen:
 *
 * <code>
 *   cogita-revision   eine Powtórka — ihre Karten, im Browser gerechnet
 *   cogita-flow       ein Przebieg: Kurs, Erzählung, Gespräch, Karte zum Entdecken
 *   cogita-live       an einer Sitzung teilnehmen — mit dem Code oder dem Link
 *   entity-card       die Karte eines Eintrags
 *   entity-table      die Einträge als Tabelle
 *   topic-explorer    (ausgemustert; seit 2026-10-23 ohne Themen: nur noch ein Hinweis)
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

import { definePart, text, type FieldDef, type PartContext, type RawConfig } from '../part';
import { Loading } from '../../ui/Loading';

/** Eine Ansicht, die erst geladen wird, wenn sie gezeigt wird — bis dahin der Platzhalter. */
function later<C>(load: () => Promise<{ default: ComponentType<{ config: C; ctx: PartContext }> }>): ComponentType<{ config: C; ctx: PartContext }> {
  const Lazy = lazy(load);
  const View = (props: { config: C; ctx: PartContext }) =>
    createElement(Suspense, { fallback: createElement(Loading, {}) }, createElement(Lazy, props));
  return View;
}

/**
 * 2026-11-01 — WOHIN DIE ANTWORTEN GEHEN (`cogita/answersTo.ts`): der Baustein nennt den Bereich seiner Uczący się —
 * einen Kurs, eine Gruppe, eine Klasse. Eine Baza kann so auf vielen Seiten stehen, und jeder Ort sieht seine Leute.
 * Leer: wie die Powtórka oder die Baza es sagt (Ustawienia), sonst bleiben sie beim Uczący się.
 */
const ANSWERS: FieldDef = { key: 'answers', label: 'Odpowiedzi uczących się do', kind: 'area', hint: 'puste: jak w bazie wiedzy; bez tego zostają u uczącego się' };

/**
 * 2026-11-02 — NAGRODY (`cogita/rewards.ts`): welche Regel ein Ort nimmt — ein Dokument „Nagrody" der Baza. In einem
 * Lernbaustein: Punkte und Serie im Lauf; leer — wie ein Baustein „Punkty i seria" auf derselben Seite, sonst keine.
 */
const REWARDS_IN_RUN: FieldDef = { key: 'rewards', label: 'Punkty i seria w trakcie nauki', kind: 'libraryEntry', of: 'library', entryKinds: ['reward'], optional: true, none: 'jak moduł „Punkty i seria” na tej stronie' };
const REWARDS_RULES: FieldDef = { key: 'rewards', label: 'Zasady nagród', kind: 'libraryEntry', of: 'library', entryKinds: ['reward'], optional: true, none: 'wybrane w bazie wiedzy (albo wbudowane)' };
const SCOPE: FieldDef = { key: 'revision', label: 'Liczy tylko karty powtórki', kind: 'libraryEntry', of: 'library', entryKinds: ['revision'], optional: true, none: 'cała baza wiedzy' };

/* == Powtórka ==================================================================================== */

export interface RevisionConfig {
  readonly title: string;
  readonly library: string;
  readonly revision: string;
  /** 2026-11-01 — der Bereich für die Antworten (leer: wie die Powtórka oder die Baza). */
  readonly answers: string;
  /** 2026-11-02 — die Nagrody im Lauf (leer: wie ein Baustein „Punkty i seria" der Seite, sonst keine). */
  readonly rewards: string;
}

export const cogitaRevisionPart = definePart<RevisionConfig>({
  kind: 'cogita-revision',
  example: { title: 'Powtórka przed bierzmowaniem', library: '<id-biblioteki>', revision: '<id-powtórki>', answers: '<id-obszaru-kursu>', rewards: '<id-nagród albo puste>' },
  label: 'Powtórka',
  use: 'Powtórka z bazy wiedzy (Cogita). Widzą ją ci, którzy mogą czytać bazę — w jawnym obszarze (baza otwarta) każdy, bez konta; postępy bez konta zostają w przeglądarce. Odpowiedzi idą do obszaru, który wskażesz (np. kursu) — jego prowadzący widzi postępy.',
  box: { colSpan: 4, rowSpan: 3 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'puste: nazwa powtórki' },
    { key: 'library', label: 'Z której bazy wiedzy', kind: 'knowledge' },
    { key: 'revision', label: 'Która powtórka', kind: 'libraryEntry', of: 'library', entryKinds: ['revision'] },
    ANSWERS,
    REWARDS_IN_RUN
  ],
  read: (raw: RawConfig): RevisionConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), revision: text(raw, 'revision'), answers: text(raw, 'answers'), rewards: text(raw, 'rewards') }),
  hasContent: (c) => c.library !== '' && c.revision !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bazę wiedzy.' : c.revision === '' ? 'Wybierz powtórkę z tej bazy wiedzy.' : null),
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
  readonly answers: string;
}

export const cogitaFlowPart = definePart<FlowConfig>({
  kind: 'cogita-flow',
  example: { title: 'Droga przez Ewangelię Marka', library: '<id-biblioteki>', flow: '<id-przebiegu>', answers: '<id-obszaru-kursu>' },
  label: 'Kurs / opowieść',
  use: 'Przebieg z bazy wiedzy (Cogita): kurs, opowieść, rozmowa w dymkach, mapa do odkrywania. Widzą go ci, którzy mogą czytać bazę — w jawnym obszarze każdy, bez konta.',
  box: { colSpan: 6, rowSpan: 5 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'puste: nazwa przebiegu' },
    { key: 'library', label: 'Z której bazy wiedzy', kind: 'knowledge' },
    { key: 'flow', label: 'Który przebieg', kind: 'libraryEntry', of: 'library', entryKinds: ['flow'] },
    ANSWERS
  ],
  read: (raw: RawConfig): FlowConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), flow: text(raw, 'flow'), answers: text(raw, 'answers') }),
  hasContent: (c) => c.library !== '' && c.flow !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bazę wiedzy.' : c.flow === '' ? 'Wybierz przebieg z tej bazy wiedzy.' : null),
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
  example: { title: 'Św. Józef', library: '<id-biblioteki>', entry: '<id-wpisu>' },
  label: 'Karta wpisu',
  use: 'Jeden wpis bazy wiedzy — postać, miejsce, pojęcie, wiedza — z polami i zdjęciem. Widzą go ci, którzy mogą czytać bazę.',
  box: { colSpan: 3, rowSpan: 3 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'puste: nazwa wpisu' },
    { key: 'library', label: 'Z której bazy wiedzy', kind: 'knowledge' },
    { key: 'entry', label: 'Który wpis', kind: 'libraryEntry', of: 'library', entryKinds: ['entity', 'person', 'work'], optional: true }
  ],
  read: (raw: RawConfig): EntityConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), entry: text(raw, 'entry') }),
  /* Ohne Eintrag zeigt sie den, den die Seite oben wählt (Wybór na stronie: „Wpis z biblioteki"). */
  hasContent: () => true,
  missing: (c) => (c.library === '' && c.entry === '' ? null : c.library === '' ? 'Wybierz bazę wiedzy.' : null),
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
  /* 2026-10-22 (Schritt 10) — ein Widok als Tabela kann alles, was sie konnte (und mehr). */
  retired: 'zastąpił go moduł „Widok” (tabela). na stronie dodaj moduł „Widok” i usuń ten',
  example: { title: 'Postacie Starego Testamentu', library: '<id-biblioteki>', kind: 'Postać', columns: 'Kiedy żył, Księga' },
  label: 'Tabela wpisów',
  use: 'Wpisy bazy wiedzy jako tabela — z wyszukiwaniem; mały kafelek pokazuje listę. Widzą je ci, którzy mogą czytać bazę.',
  box: { colSpan: 6, rowSpan: 3 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Postacie' },
    { key: 'library', label: 'Z której bazy wiedzy', kind: 'knowledge' },
    { key: 'kind', label: 'Tylko rodzaj', kind: 'line', hint: 'nazwa rodzaju, np. Postać — puste: wszystkie' },
    { key: 'columns', label: 'Kolumny', kind: 'line', hint: 'nazwy pól po przecinku — puste: cztery pierwsze' }
  ],
  read: (raw: RawConfig): TableConfig => ({
    title: text(raw, 'title'), library: text(raw, 'library'), kind: text(raw, 'kind'),
    columns: text(raw, 'columns').split(',').map((c) => c.trim()).filter((c) => c !== '')
  }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bazę wiedzy.' : null),
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
}

export const topicExplorerPart = definePart<TopicsConfig>({
  kind: 'topic-explorer',
  /* 2026-10-22 (Schritt 10) — ein Widok als Drzewo; 2026-10-23 (Schritt 5): Themen gibt es nicht mehr — der Baustein sagt es nur noch. */
  retired: 'tematów już nie ma — zastąpił go moduł „Widok” (drzewo albo macierz według osi: własnych rodzajów, np. Tajemnica × Obszar). na stronie dodaj moduł „Widok” i usuń ten',
  example: { title: 'Tematy katechezy', library: '<id-bazy-wiedzy>' },
  label: 'Tematy',
  use: 'Dawniej: tematy bazy wiedzy. Tematów już nie ma — moduł pokazuje tylko informację; porządek daje moduł „Widok” z osiami (rodzajami).',
  box: { colSpan: 4, rowSpan: 3 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Tematy' },
    { key: 'library', label: 'Z której bazy wiedzy', kind: 'knowledge' }
  ],
  read: (raw: RawConfig): TopicsConfig => ({ title: text(raw, 'title'), library: text(raw, 'library') }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bazę wiedzy.' : null),
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
  /* 2026-10-22 (Schritt 10) — die Mapa ist jetzt eine Gestalt jedes Widoku. */
  retired: 'zastąpił go moduł „Widok” (mapa). na stronie dodaj moduł „Widok” i usuń ten',
  example: { title: 'Mapa: Dzieje Apostolskie', library: '<id-biblioteki>', revision: '<id-powtórki>' },
  label: 'Mapa wiedzy',
  use: 'Wpisy powtórki jako mapa: co już umiesz, jest jasne; granica do odkrycia; reszta we mgle. Widzą ją ci, którzy mogą czytać bazę (jawny obszar: każdy, bez konta).',
  box: { colSpan: 6, rowSpan: 5 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Mapa wiedzy' },
    { key: 'library', label: 'Z której bazy wiedzy', kind: 'knowledge' },
    { key: 'revision', label: 'Z której powtórki', kind: 'libraryEntry', of: 'library', entryKinds: ['revision'] }
  ],
  read: (raw: RawConfig): MapConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), revision: text(raw, 'revision') }),
  hasContent: (c) => c.library !== '' && c.revision !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bazę wiedzy.' : c.revision === '' ? 'Wybierz powtórkę.' : null),
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
  readonly answers: string;
  readonly rewards: string;
}

export const seatLearnPart = definePart<SeatLearnConfig>({
  kind: 'seat-learn',
  example: { title: 'Twoja nauka', library: '<id-biblioteki>', revision: '<id-powtórki albo puste>', answers: '<id-obszaru-kursu>', rewards: '<id-nagród albo puste>' },
  label: 'Nauka (osoba z linkiem)',
  use: 'Powtórki z bazy wiedzy kursu dla osoby z linkiem — jej postępy idą do kursu (prowadzący widzą je w Postępach).',
  box: { colSpan: 3, rowSpan: 3 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Twoja nauka' },
    { key: 'library', label: 'Z której bazy wiedzy', kind: 'knowledge' },
    { key: 'revision', label: 'Tylko powtórka', kind: 'line', hint: 'identyfikator powtórki — puste: wszystkie powtórki bazy wiedzy' },
    ANSWERS,
    REWARDS_IN_RUN
  ],
  read: (raw: RawConfig): SeatLearnConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), revision: text(raw, 'revision'), answers: text(raw, 'answers'), rewards: text(raw, 'rewards') }),
  hasContent: () => true,
  missing: (c) => (c.library === '' ? 'Wybierz bazę wiedzy kursu — osoba z linkiem musi czytać jej obszar (rola formularza albo udostępnienie).' : null),
  strip: { title: 'Twoja nauka', open: 'Otwórz' },
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? 'Nagłówek i przycisk — nauka rozwija się po kliknięciu.'
    : size.height === 'tall' ? 'Ile czeka, ile już umie, i powtórki do wyboru.'
    : 'Ile czeka na teraz i powtórki do wyboru.',
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.SeatLearnView })))
});

/* == 2026-11-02: Nagrody — punkty, seria, cel dnia, poziomy, odznaki ============================= */

/** „Co pokazuje" — was die Tafel weglassen darf (dieselben Wörter wie `REWARD_PIECES` in `cogita/RewardViews.tsx`). */
const REWARD_BITS = [
  { value: 'points', label: 'Punkty' }, { value: 'level', label: 'Poziom' }, { value: 'streak', label: 'Seria dni' },
  { value: 'goal', label: 'Cel dnia' }, { value: 'badges', label: 'Odznaki' }, { value: 'feed', label: 'Ostatnie nagrody' }
] as const;

export interface RewardsConfig {
  readonly title: string;
  readonly library: string;
  /** Welche Nagrody (leer: die der Ustawienia der Baza, sonst die erste, sonst die eingebauten). */
  readonly rewards: string;
  /** Nur die Karten dieser Powtórka zählen (leer: die ganze Baza). */
  readonly revision: string;
  readonly hidden: ReadonlySet<string>;
}

const hiddenSet = (raw: RawConfig): ReadonlySet<string> => new Set(text(raw, 'hide').split(',').map((one) => one.trim()).filter((one) => one !== ''));

export const cogitaRewardsPart = definePart<RewardsConfig>({
  kind: 'cogita-rewards',
  example: { title: 'Twoje punkty', library: '<id-bazy-wiedzy>', rewards: '<id-nagród albo puste>', revision: '<id-powtórki albo puste>', hide: 'feed' },
  label: 'Punkty i seria',
  use: 'Punkty, seria dni nauki, cel dnia, poziom i odznaki osoby, która się tu uczy — na żywo: każda odpowiedź w module nauki na tej stronie od razu dodaje punkty („+10”), zapala płomień serii, wypełnia cel dnia. Zasady (ile punktów za co, cel, poziomy, odznaki) to „Nagrody” w bazie wiedzy (Nauka → Nagrody) — każda strona wybiera swoje.',
  box: { colSpan: 2, rowSpan: 3 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Twoje punkty' },
    { key: 'library', label: 'Z której bazy wiedzy', kind: 'knowledge' },
    REWARDS_RULES,
    SCOPE,
    { key: 'hide', label: 'Co pokazuje', kind: 'hide', options: REWARD_BITS }
  ],
  read: (raw: RawConfig): RewardsConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), rewards: text(raw, 'rewards'), revision: text(raw, 'revision'), hidden: hiddenSet(raw) }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bazę wiedzy — tę samą, z której uczy się moduł nauki na stronie.' : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? 'Jedna linia: punkty, poziom, seria, cel dnia, odznaki — po każdej odpowiedzi „+10” nad nią.'
    : size.height === 'tall' ? 'Wszystko: punkty z poziomem, płomień serii z ostatnimi 28 dniami, pierścień celu dnia, wszystkie odznaki i ostatnie nagrody.'
    : 'Punkty z poziomem, płomień serii z tygodniem, pierścień celu dnia (co zaznaczone); jeden wybrany element — duży.',
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.RewardsView })))
});

const STATS_BITS = [
  { value: 'tiles', label: 'Liczby dnia' }, { value: 'today', label: 'Punkty dziś — wykres' }, { value: 'days', label: 'Punkty dzień po dniu' },
  { value: 'goal', label: 'Cel dnia dzień po dniu' }, { value: 'knowledge', label: 'Gdzie są karty (w pełnym widoku)' }
] as const;

export type LiveStatsConfig = RewardsConfig;

export const cogitaLiveStatsPart = definePart<LiveStatsConfig>({
  kind: 'cogita-stats',
  example: { title: 'Na żywo', library: '<id-bazy-wiedzy>', rewards: '<id-nagród albo puste>', revision: '<id-powtórki albo puste>', hide: 'knowledge' },
  label: 'Statystyki na żywo',
  use: 'Wykresy i liczby nauki osoby, która się tu uczy — rosną z każdą odpowiedzią w module nauki na tej stronie: punkty dziś odpowiedź po odpowiedzi, punkty i cel dnia dzień po dniu, trafność, seria; w pełnym widoku także gdzie są karty (co umie, co zanika).',
  box: { colSpan: 4, rowSpan: 3 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Na żywo' },
    { key: 'library', label: 'Z której bazy wiedzy', kind: 'knowledge' },
    REWARDS_RULES,
    SCOPE,
    { key: 'hide', label: 'Co pokazuje', kind: 'hide', options: STATS_BITS }
  ],
  read: (raw: RawConfig): LiveStatsConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), rewards: text(raw, 'rewards'), revision: text(raw, 'revision'), hidden: hiddenSet(raw) }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bazę wiedzy — tę samą, z której uczy się moduł nauki na stronie.' : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? 'Jedna linia: dziś punkty, odpowiedzi, trafność i cel dnia — na żywo.'
    : size.height === 'tall' ? 'Liczby dnia, wykres punktów dziś, punkty i cel dnia dzień po dniu (7/14/30 dni), gdzie są karty.'
    : 'Liczby dnia i wykres punktów dziś — rośnie z każdą odpowiedzią.',
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.LiveStatsView })))
});

/* == 2026-11-05: Krajobraz — die Landschaft des Wissens als eigener Baustein ===================== */

/** „Co pokazuje" — was der Baustein weglassen darf. */
const LANDSCAPE_BITS = [
  { value: 'spacing', label: 'Wybór „Jak często pytać” (gdy uczący się może go zmienić)' },
  { value: 'learner', label: 'Kto się uczy i gdzie zostają postępy' },
  { value: 'search', label: 'Szukaj (w pełnym widoku)' }
] as const;

export interface LandscapeConfig {
  readonly title: string;
  readonly library: string;
  /** Ein gespeicherter Widok (leer: die ganze Baza — wie der Krajobraz in „Wpisy"). */
  readonly view: string;
  readonly answers: string;
  readonly rewards: string;
  readonly hidden: ReadonlySet<string>;
}

export const cogitaLandscapePart = definePart<LandscapeConfig>({
  kind: 'cogita-landscape',
  example: { title: 'Krajobraz wiedzy', library: '<id-bazy-wiedzy>', view: '<id-widoku albo puste>', answers: '<id-obszaru-kursu>', rewards: '<id-nagród albo puste>', hide: 'search' },
  label: 'Krajobraz wiedzy',
  use: 'Krajobraz wiedzy z bazy (Cogita): w środku „Ty”, wokół pola tego, czego możesz się uczyć teraz, dalej góry — tym wyższe, im więcej brakuje; to, co umiesz, staje się lądem. Klik w pole: czytać, uczyć się, powtórzyć, ustawić cel. Uczący się wybiera tu, jak często wracają pytania — częściej, standardowo, rzadziej albo „Raz i gotowe” (raz dobrze i koniec) — o ile prowadzący nie ustalił tego dla wszystkich w ustawieniach bazy. Bez widoku — cała baza; z widokiem — tylko jego wpisy. Widzi go ten, kto może czytać bazę.',
  box: { colSpan: 6, rowSpan: 5 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'puste: nazwa widoku albo „Krajobraz wiedzy”' },
    { key: 'library', label: 'Z której bazy wiedzy', kind: 'knowledge' },
    { key: 'view', label: 'Który widok', kind: 'libraryEntry', of: 'library', entryKinds: ['view'], optional: true, none: 'cała baza wiedzy' },
    ANSWERS,
    REWARDS_IN_RUN,
    { key: 'hide', label: 'Co pokazuje', kind: 'hide', options: LANDSCAPE_BITS }
  ],
  read: (raw: RawConfig): LandscapeConfig => ({
    title: text(raw, 'title'), library: text(raw, 'library'), view: text(raw, 'view'), answers: text(raw, 'answers'), rewards: text(raw, 'rewards'), hidden: hiddenSet(raw)
  }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bazę wiedzy.' : null),
  strip: { title: 'Krajobraz wiedzy', open: 'Otwórz' },
  fullscreen: true,
  shows: (c, size) => {
    const ask = c.hidden.has('spacing') ? '' : ' Nad nim wybór, jak często pytać (jeśli wolno).';
    return size.height === 'strip' ? 'Nagłówek i przycisk — krajobraz rozwija się po kliknięciu.'
      : size.height === 'tall' ? `Cały krajobraz: przybliżanie, obracanie, pola z „Ucz się”, cel i drogi${c.hidden.has('search') ? '' : ', wyszukiwanie'}.${ask}`
        : `Mały krajobraz — do 24 pól; reszta na pełnym ekranie.${ask}`;
  },
  View: later(() => import('./landscapeViews').then((m) => ({ default: m.LandscapeModuleView })))
});

/* == 2026-11-05: Ustawienia nauki — die eigenen Einstellungen des Lernenden als Baustein ======== */

export interface LearnSettingsConfig {
  readonly title: string;
  readonly library: string;
  /** Wie im Lernbaustein derselben Seite — sonst landet die Einstellung bei einem anderen Lernenden (anderer Bereich). */
  readonly answers: string;
  readonly hidden: ReadonlySet<string>;
}

export const cogitaSettingsPart = definePart<LearnSettingsConfig>({
  kind: 'cogita-settings',
  example: { title: 'Jak często pytać', library: '<id-bazy-wiedzy>', answers: '<id-obszaru-kursu>', hide: 'learner' },
  label: 'Ustawienia nauki',
  use: 'Ustawienia osoby, która się tu uczy: jak często wracają pytania — częściej, standardowo, rzadziej, „Raz i gotowe” (raz dobrze i koniec) albo własne odstępy. Działa dla całej nauki z tej bazy (krajobraz, powtórki, kursy) — także na innych stronach. Jeśli prowadzący ustalił odstępy dla wszystkich (ustawienia bazy), moduł tylko pokazuje, co obowiązuje. Wskaż ten sam obszar odpowiedzi co w module nauki na stronie.',
  box: { colSpan: 3, rowSpan: 3 },
  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'puste: „Ustawienia nauki”' },
    { key: 'library', label: 'Z której bazy wiedzy', kind: 'knowledge' },
    { ...ANSWERS, hint: 'ten sam co w module nauki na tej stronie — puste: jak w bazie wiedzy' },
    { key: 'hide', label: 'Co pokazuje', kind: 'hide', options: [{ value: 'learner', label: 'Kto się uczy i gdzie zostają postępy' }] }
  ],
  read: (raw: RawConfig): LearnSettingsConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), answers: text(raw, 'answers'), hidden: hiddenSet(raw) }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? 'Wybierz bazę wiedzy — tę samą, z której uczy się moduł nauki na stronie.' : null),
  shows: (_c, size) => size.height === 'strip' ? 'Jedna linia: jak często pytać teraz i „Zmień”.'
    : 'Jak często pytać — do wyboru jednym kliknięciem, z opisem; „Inne…” ustawia odstępy dokładnie.',
  View: later(() => import('./landscapeViews').then((m) => ({ default: m.LearnSettingsView })))
});
