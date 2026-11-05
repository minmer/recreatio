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

import { t } from '../../core/i18n';
import { text, type FieldDef, type PartContext, type RawConfig } from '../part';
import { Loading } from '../../ui/Loading';
import { defineTextPart, field, option, texts, withTexts } from './partTexts';

/** Eine Ansicht, die erst geladen wird, wenn sie gezeigt wird — bis dahin der Platzhalter. */
function later<C>(load: () => Promise<{ default: ComponentType<{ config: C; ctx: PartContext }> }>): ComponentType<{ config: C; ctx: PartContext }> {
  const Lazy = lazy(load);
  const View = (props: { config: C; ctx: PartContext }) =>
    createElement(Suspense, { fallback: createElement(Loading, {}) }, createElement(Lazy, props));
  return View;
}

/* Die Felder, die viele Arten teilen — Texte erst beim Lesen (partTexts.ts). */
const TITLE = { key: 'title', kind: 'line' } as const;
const FROM_BASE: FieldDef = field({ key: 'library', kind: 'knowledge' }, texts({ label: 'moduleDataCogita.f.fromBase' }));

/**
 * 2026-11-01 — WOHIN DIE ANTWORTEN GEHEN (`cogita/answersTo.ts`): der Baustein nennt den Bereich seiner Uczący się —
 * einen Kurs, eine Gruppe, eine Klasse. Eine Baza kann so auf vielen Seiten stehen, und jeder Ort sieht seine Leute.
 * Leer: wie die Powtórka oder die Baza es sagt (Ustawienia), sonst bleiben sie beim Uczący się.
 */
const ANSWERS: FieldDef = field({ key: 'answers', kind: 'area' }, texts({ label: 'moduleDataCogita.f.answers', hint: 'moduleDataCogita.f.answersHint' }));

/**
 * 2026-11-02 — NAGRODY (`cogita/rewards.ts`): welche Regel ein Ort nimmt — ein Dokument „Nagrody" der Baza. In einem
 * Lernbaustein: Punkte und Serie im Lauf; leer — wie ein Baustein „Punkty i seria" auf derselben Seite, sonst keine.
 */
const REWARDS_IN_RUN: FieldDef = field({ key: 'rewards', kind: 'libraryEntry', of: 'library', entryKinds: ['reward'], optional: true }, texts({ label: 'moduleDataCogita.f.rewardsInRun', none: 'moduleDataCogita.f.rewardsInRunNone' }));
const REWARDS_RULES: FieldDef = field({ key: 'rewards', kind: 'libraryEntry', of: 'library', entryKinds: ['reward'], optional: true }, texts({ label: 'moduleDataCogita.f.rewardsRules', none: 'moduleDataCogita.f.rewardsRulesNone' }));
const SCOPE: FieldDef = field({ key: 'revision', kind: 'libraryEntry', of: 'library', entryKinds: ['revision'], optional: true }, texts({ label: 'moduleDataCogita.f.scope', none: 'moduleDataCogita.f.scopeNone' }));
const WHAT_SHOWS = texts({ label: 'moduleDataCogita.f.whatShows' });

/** Beispiel-Kennungen im JSON (Platzhalter, in der Sprache der Beschreibung). */
const EX = texts({
  library: 'moduleDataCogita.ex.library', base: 'moduleDataCogita.ex.base', revision: 'moduleDataCogita.ex.revision', revisionOrEmpty: 'moduleDataCogita.ex.revisionOrEmpty',
  area: 'moduleDataCogita.ex.area', rewardsOrEmpty: 'moduleDataCogita.ex.rewardsOrEmpty', flow: 'moduleDataCogita.ex.flow', entry: 'moduleDataCogita.ex.entry', views: 'moduleDataCogita.ex.views'
});

/** Ein Beispiel, dessen Wörter (`texts()`) und Platzhalter (`EX`) erst beim Lesen übersetzt werden. */
type ExIds = Readonly<Record<string, keyof typeof EX>>;
type Words = Readonly<Record<string, string>>;
const example = (fixed: RawConfig, ids: ExIds, words: Words): RawConfig => {
  const out: Record<string, string> = withTexts(fixed, words);
  for (const [key, id] of Object.entries(ids)) Object.defineProperty(out, key, { get: () => EX[id], enumerable: true });
  return out;
};

const pickBase = (): string => t('moduleDataCogita.m.pickBase');
const pickBaseSame = (): string => t('moduleDataCogita.m.pickBaseSame');

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

export const cogitaRevisionPart = defineTextPart<RevisionConfig>({
  kind: 'cogita-revision',
  example: example({}, { library: 'library', revision: 'revision', answers: 'area', rewards: 'rewardsOrEmpty' }, texts({ title: 'moduleDataCogita.revision.exTitle' })),
  box: { colSpan: 4, rowSpan: 3 },
  fields: [
    field(TITLE, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleDataCogita.revision.titleHint' })),
    FROM_BASE,
    field({ key: 'revision', kind: 'libraryEntry', of: 'library', entryKinds: ['revision'] }, texts({ label: 'moduleDataCogita.revision.which' })),
    ANSWERS,
    REWARDS_IN_RUN
  ],
  read: (raw: RawConfig): RevisionConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), revision: text(raw, 'revision'), answers: text(raw, 'answers'), rewards: text(raw, 'rewards') }),
  hasContent: (c) => c.library !== '' && c.revision !== '',
  missing: (c) => (c.library === '' ? pickBase() : c.revision === '' ? t('moduleDataCogita.revision.missingRevision') : null),
  strip: texts({ title: 'moduleDataCogita.revision.label', open: 'moduleDataCogita.s.start' }),
  fullscreen: true,
  shows: (_c, size) => size.height === 'tall' ? t('moduleDataCogita.revision.showsTall')
    : size.height === 'strip' ? t('moduleDataCogita.revision.showsStrip')
    : t('moduleDataCogita.revision.showsBlock'),
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.RevisionView })))
}, texts({ label: 'moduleDataCogita.revision.label', use: 'moduleDataCogita.revision.use' }));

/* == Przebieg ==================================================================================== */

export interface FlowConfig {
  readonly title: string;
  readonly library: string;
  readonly flow: string;
  readonly answers: string;
}

export const cogitaFlowPart = defineTextPart<FlowConfig>({
  kind: 'cogita-flow',
  example: example({}, { library: 'library', flow: 'flow', answers: 'area' }, texts({ title: 'moduleDataCogita.flow.exTitle' })),
  box: { colSpan: 6, rowSpan: 5 },
  fields: [
    field(TITLE, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleDataCogita.flow.titleHint' })),
    FROM_BASE,
    field({ key: 'flow', kind: 'libraryEntry', of: 'library', entryKinds: ['flow'] }, texts({ label: 'moduleDataCogita.flow.which' })),
    ANSWERS
  ],
  read: (raw: RawConfig): FlowConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), flow: text(raw, 'flow'), answers: text(raw, 'answers') }),
  hasContent: (c) => c.library !== '' && c.flow !== '',
  missing: (c) => (c.library === '' ? pickBase() : c.flow === '' ? t('moduleDataCogita.flow.missingFlow') : null),
  strip: texts({ title: 'moduleDataCogita.flow.stripTitle', open: 'moduleDataCogita.s.start' }),
  fullscreen: true,
  shows: (_c, size) => size.height === 'tall' ? t('moduleDataCogita.flow.showsTall')
    : size.height === 'strip' ? t('moduleDataCogita.flow.showsStrip')
    : t('moduleDataCogita.flow.showsBlock'),
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.FlowView })))
}, texts({ label: 'moduleDataCogita.flow.label', use: 'moduleDataCogita.flow.use' }));

/* == Sesja na żywo =============================================================================== */

export interface LiveConfig {
  readonly title: string;
}

export const cogitaLivePart = defineTextPart<LiveConfig>({
  kind: 'cogita-live',
  example: example({}, {}, texts({ title: 'moduleDataCogita.live.exTitle' })),
  box: { colSpan: 3, rowSpan: 3 },
  fields: [field(TITLE, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleDataCogita.live.titleHint' }))],
  read: (raw: RawConfig): LiveConfig => ({ title: text(raw, 'title') }),
  hasContent: () => true,
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? t('moduleDataCogita.live.showsStrip')
    : size.height === 'tall' ? t('moduleDataCogita.live.showsTall')
    : t('moduleDataCogita.live.showsBlock'),
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.LiveView })))
}, texts({ label: 'moduleDataCogita.live.label', use: 'moduleDataCogita.live.use' }));

/* == Karta wpisu ================================================================================= */

export interface EntityConfig {
  readonly title: string;
  readonly library: string;
  readonly entry: string;
}

export const entityCardPart = defineTextPart<EntityConfig>({
  kind: 'entity-card',
  example: example({}, { library: 'library', entry: 'entry' }, texts({ title: 'moduleDataCogita.card.exTitle' })),
  box: { colSpan: 3, rowSpan: 3 },
  fields: [
    field(TITLE, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleDataCogita.card.titleHint' })),
    FROM_BASE,
    field({ key: 'entry', kind: 'libraryEntry', of: 'library', entryKinds: ['entity', 'person', 'work'], optional: true }, texts({ label: 'moduleDataCogita.card.which' }))
  ],
  read: (raw: RawConfig): EntityConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), entry: text(raw, 'entry') }),
  /* Ohne Eintrag zeigt sie den, den die Seite oben wählt (Wybór na stronie: „Wpis z biblioteki"). */
  hasContent: () => true,
  missing: (c) => (c.library === '' && c.entry === '' ? null : c.library === '' ? pickBase() : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? t('moduleDataCogita.card.showsStrip')
    : size.height === 'tall' ? t('moduleDataCogita.card.showsTall')
    : t('moduleDataCogita.card.showsBlock'),
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.EntityCardView })))
}, texts({ label: 'moduleDataCogita.card.label', use: 'moduleDataCogita.card.use' }));

/* == Tabela wpisów =============================================================================== */

export interface TableConfig {
  readonly title: string;
  readonly library: string;
  readonly kind: string;
  readonly columns: readonly string[];
}

/* 2026-10-22 (Schritt 10) — ein Widok als Tabela kann alles, was sie konnte (und mehr): `retired`. */
export const entityTablePart = defineTextPart<TableConfig>({
  kind: 'entity-table',
  example: example({}, { library: 'library' }, texts({ title: 'moduleDataCogita.table.exTitle', kind: 'moduleDataCogita.table.exKind', columns: 'moduleDataCogita.table.exColumns' })),
  box: { colSpan: 6, rowSpan: 3 },
  fields: [
    field(TITLE, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleDataCogita.table.titleHint' })),
    FROM_BASE,
    field({ key: 'kind', kind: 'line' }, texts({ label: 'moduleDataCogita.table.kind', hint: 'moduleDataCogita.table.kindHint' })),
    field({ key: 'columns', kind: 'line' }, texts({ label: 'moduleDataCogita.table.columns', hint: 'moduleDataCogita.table.columnsHint' }))
  ],
  read: (raw: RawConfig): TableConfig => ({
    title: text(raw, 'title'), library: text(raw, 'library'), kind: text(raw, 'kind'),
    columns: text(raw, 'columns').split(',').map((c) => c.trim()).filter((c) => c !== '')
  }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? pickBase() : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? t('moduleDataCogita.table.showsStrip')
    : size.height === 'tall' ? t('moduleDataCogita.table.showsTall')
    : t('moduleDataCogita.table.showsBlock'),
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.EntityTableView })))
}, texts({ label: 'moduleDataCogita.table.label', use: 'moduleDataCogita.table.use', retired: 'moduleDataCogita.table.retired' }));

/* == Tematy ====================================================================================== */

export interface TopicsConfig {
  readonly title: string;
  readonly library: string;
}

/* 2026-10-22 (Schritt 10) — ein Widok als Drzewo; 2026-10-23 (Schritt 5): Themen gibt es nicht mehr — der Baustein sagt es nur noch. */
export const topicExplorerPart = defineTextPart<TopicsConfig>({
  kind: 'topic-explorer',
  example: example({}, { library: 'base' }, texts({ title: 'moduleDataCogita.topics.exTitle' })),
  box: { colSpan: 4, rowSpan: 3 },
  fields: [
    field(TITLE, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleDataCogita.topics.titleHint' })),
    FROM_BASE
  ],
  read: (raw: RawConfig): TopicsConfig => ({ title: text(raw, 'title'), library: text(raw, 'library') }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? pickBase() : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? t('moduleDataCogita.topics.showsStrip')
    : size.height === 'tall' ? t('moduleDataCogita.topics.showsTall')
    : t('moduleDataCogita.topics.showsBlock'),
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.TopicExplorerView })))
}, texts({ label: 'moduleDataCogita.topics.label', use: 'moduleDataCogita.topics.use', retired: 'moduleDataCogita.topics.retired' }));

/* == Mapa wiedzy ================================================================================= */

export interface MapConfig {
  readonly title: string;
  readonly library: string;
  readonly revision: string;
}

/* 2026-10-22 (Schritt 10) — die Mapa ist jetzt eine Gestalt jedes Widoku: `retired`. */
export const knowledgeMapPart = defineTextPart<MapConfig>({
  kind: 'knowledge-map',
  example: example({}, { library: 'library', revision: 'revision' }, texts({ title: 'moduleDataCogita.map.exTitle' })),
  box: { colSpan: 6, rowSpan: 5 },
  fields: [
    field(TITLE, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleDataCogita.map.titleHint' })),
    FROM_BASE,
    field({ key: 'revision', kind: 'libraryEntry', of: 'library', entryKinds: ['revision'] }, texts({ label: 'moduleDataCogita.map.which' }))
  ],
  read: (raw: RawConfig): MapConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), revision: text(raw, 'revision') }),
  hasContent: (c) => c.library !== '' && c.revision !== '',
  missing: (c) => (c.library === '' ? pickBase() : c.revision === '' ? t('moduleDataCogita.map.missingRevision') : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? t('moduleDataCogita.map.showsStrip')
    : size.height === 'tall' ? t('moduleDataCogita.map.showsTall')
    : t('moduleDataCogita.map.showsBlock'),
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.KnowledgeMapView })))
}, texts({ label: 'moduleDataCogita.map.label', use: 'moduleDataCogita.map.use', retired: 'moduleDataCogita.map.retired' }));

/* == Nauka osoby z linkiem ======================================================================= */

export interface SeatLearnConfig {
  readonly title: string;
  readonly library: string;
  readonly revision: string;
  readonly answers: string;
  readonly rewards: string;
}

export const seatLearnPart = defineTextPart<SeatLearnConfig>({
  kind: 'seat-learn',
  example: example({}, { library: 'library', revision: 'revisionOrEmpty', answers: 'area', rewards: 'rewardsOrEmpty' }, texts({ title: 'moduleDataCogita.seat.exTitle' })),
  box: { colSpan: 3, rowSpan: 3 },
  fields: [
    field(TITLE, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleDataCogita.seat.titleHint' })),
    FROM_BASE,
    field({ key: 'revision', kind: 'line' }, texts({ label: 'moduleDataCogita.seat.revision', hint: 'moduleDataCogita.seat.revisionHint' })),
    ANSWERS,
    REWARDS_IN_RUN
  ],
  read: (raw: RawConfig): SeatLearnConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), revision: text(raw, 'revision'), answers: text(raw, 'answers'), rewards: text(raw, 'rewards') }),
  hasContent: () => true,
  missing: (c) => (c.library === '' ? t('moduleDataCogita.seat.missingBase') : null),
  strip: texts({ title: 'moduleDataCogita.seat.exTitle', open: 'moduleDataCogita.s.open' }),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? t('moduleDataCogita.seat.showsStrip')
    : size.height === 'tall' ? t('moduleDataCogita.seat.showsTall')
    : t('moduleDataCogita.seat.showsBlock'),
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.SeatLearnView })))
}, texts({ label: 'moduleDataCogita.seat.label', use: 'moduleDataCogita.seat.use' }));

/* == 2026-11-02: Nagrody — punkty, seria, cel dnia, poziomy, odznaki ============================= */

/** „Co pokazuje" — was die Tafel weglassen darf (dieselben Wörter wie `REWARD_PIECES` in `cogita/RewardViews.tsx`). */
const REWARD_BITS = [
  option('points', texts({ label: 'moduleDataCogita.rewards.bitPoints' })), option('level', texts({ label: 'moduleDataCogita.rewards.bitLevel' })),
  option('streak', texts({ label: 'moduleDataCogita.rewards.bitStreak' })), option('goal', texts({ label: 'moduleDataCogita.rewards.bitGoal' })),
  option('badges', texts({ label: 'moduleDataCogita.rewards.bitBadges' })), option('feed', texts({ label: 'moduleDataCogita.rewards.bitFeed' }))
];

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

export const cogitaRewardsPart = defineTextPart<RewardsConfig>({
  kind: 'cogita-rewards',
  example: example({ hide: 'feed' }, { library: 'base', rewards: 'rewardsOrEmpty', revision: 'revisionOrEmpty' }, texts({ title: 'moduleDataCogita.rewards.exTitle' })),
  box: { colSpan: 2, rowSpan: 3 },
  fields: [
    field(TITLE, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleDataCogita.rewards.titleHint' })),
    FROM_BASE,
    REWARDS_RULES,
    SCOPE,
    field({ key: 'hide', kind: 'hide', options: REWARD_BITS }, WHAT_SHOWS)
  ],
  read: (raw: RawConfig): RewardsConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), rewards: text(raw, 'rewards'), revision: text(raw, 'revision'), hidden: hiddenSet(raw) }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? pickBaseSame() : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? t('moduleDataCogita.rewards.showsStrip')
    : size.height === 'tall' ? t('moduleDataCogita.rewards.showsTall')
    : t('moduleDataCogita.rewards.showsBlock'),
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.RewardsView })))
}, texts({ label: 'moduleDataCogita.rewards.label', use: 'moduleDataCogita.rewards.use' }));

const STATS_BITS = [
  option('tiles', texts({ label: 'moduleDataCogita.stats.bitTiles' })), option('today', texts({ label: 'moduleDataCogita.stats.bitToday' })),
  option('days', texts({ label: 'moduleDataCogita.stats.bitDays' })), option('goal', texts({ label: 'moduleDataCogita.stats.bitGoal' })),
  option('knowledge', texts({ label: 'moduleDataCogita.stats.bitKnowledge' }))
];

export type LiveStatsConfig = RewardsConfig;

export const cogitaLiveStatsPart = defineTextPart<LiveStatsConfig>({
  kind: 'cogita-stats',
  example: example({ hide: 'knowledge' }, { library: 'base', rewards: 'rewardsOrEmpty', revision: 'revisionOrEmpty' }, texts({ title: 'moduleDataCogita.stats.exTitle' })),
  box: { colSpan: 4, rowSpan: 3 },
  fields: [
    field(TITLE, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleDataCogita.stats.titleHint' })),
    FROM_BASE,
    REWARDS_RULES,
    SCOPE,
    field({ key: 'hide', kind: 'hide', options: STATS_BITS }, WHAT_SHOWS)
  ],
  read: (raw: RawConfig): LiveStatsConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), rewards: text(raw, 'rewards'), revision: text(raw, 'revision'), hidden: hiddenSet(raw) }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? pickBaseSame() : null),
  fullscreen: true,
  shows: (_c, size) => size.height === 'strip' ? t('moduleDataCogita.stats.showsStrip')
    : size.height === 'tall' ? t('moduleDataCogita.stats.showsTall')
    : t('moduleDataCogita.stats.showsBlock'),
  View: later(() => import('./cogitaViews').then((m) => ({ default: m.LiveStatsView })))
}, texts({ label: 'moduleDataCogita.stats.label', use: 'moduleDataCogita.stats.use' }));

/* == 2026-11-05: Krajobraz — die Landschaft des Wissens als eigener Baustein ===================== */

/** „Co pokazuje" — was der Baustein weglassen darf. */
const LEARNER_BIT = option('learner', texts({ label: 'moduleDataCogita.landscape.bitLearner' }));
const LANDSCAPE_BITS = [
  option('spacing', texts({ label: 'moduleDataCogita.landscape.bitSpacing' })),
  LEARNER_BIT,
  option('search', texts({ label: 'moduleDataCogita.landscape.bitSearch' }))
];

export interface LandscapeConfig {
  readonly title: string;
  readonly library: string;
  /** Ein gespeicherter Widok (leer: die ganze Baza — wie der Krajobraz in „Wpisy"). */
  /** 2026-11-05 — ein oder mehrere gespeicherte Widoki (Feld `view`, mit Komma); mehrere: der Besucher wählt oben. Leer: die ganze Baza. */
  readonly views: readonly string[];
  readonly answers: string;
  readonly rewards: string;
  readonly hidden: ReadonlySet<string>;
}

export const cogitaLandscapePart = defineTextPart<LandscapeConfig>({
  kind: 'cogita-landscape',
  example: example({ hide: 'search' }, { library: 'base', view: 'views', answers: 'area', rewards: 'rewardsOrEmpty' }, texts({ title: 'moduleDataCogita.landscape.label' })),
  box: { colSpan: 6, rowSpan: 5 },
  fields: [
    field(TITLE, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleDataCogita.landscape.titleHint' })),
    FROM_BASE,
    field({ key: 'view', kind: 'libraryEntry', of: 'library', entryKinds: ['view'], optional: true, multi: true }, texts({ label: 'moduleDataCogita.landscape.views', none: 'moduleDataCogita.f.scopeNone', hint: 'moduleDataCogita.landscape.viewsHint' })),
    ANSWERS,
    REWARDS_IN_RUN,
    field({ key: 'hide', kind: 'hide', options: LANDSCAPE_BITS }, WHAT_SHOWS)
  ],
  read: (raw: RawConfig): LandscapeConfig => ({
    title: text(raw, 'title'), library: text(raw, 'library'), views: text(raw, 'view').split(',').map((x) => x.trim()).filter((x) => x !== ''), answers: text(raw, 'answers'), rewards: text(raw, 'rewards'), hidden: hiddenSet(raw)
  }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? pickBase() : null),
  strip: texts({ title: 'moduleDataCogita.landscape.label', open: 'moduleDataCogita.s.open' }),
  fullscreen: true,
  shows: (c, size) => {
    const ask = c.hidden.has('spacing') ? '' : t('moduleDataCogita.landscape.showsAsk');
    return size.height === 'strip' ? t('moduleDataCogita.landscape.showsStrip')
      : size.height === 'tall' ? (c.hidden.has('search') ? t('moduleDataCogita.landscape.showsTall', { ask }) : t('moduleDataCogita.landscape.showsTallSearch', { ask }))
        : t('moduleDataCogita.landscape.showsBlock', { ask });
  },
  View: later(() => import('./landscapeViews').then((m) => ({ default: m.LandscapeModuleView })))
}, texts({ label: 'moduleDataCogita.landscape.label', use: 'moduleDataCogita.landscape.use' }));

/* == 2026-11-05: Ustawienia nauki — die eigenen Einstellungen des Lernenden als Baustein ======== */

export interface LearnSettingsConfig {
  readonly title: string;
  readonly library: string;
  /** Wie im Lernbaustein derselben Seite — sonst landet die Einstellung bei einem anderen Lernenden (anderer Bereich). */
  readonly answers: string;
  readonly hidden: ReadonlySet<string>;
}

export const cogitaSettingsPart = defineTextPart<LearnSettingsConfig>({
  kind: 'cogita-settings',
  example: example({ hide: 'learner' }, { library: 'base', answers: 'area' }, texts({ title: 'moduleDataCogita.settings.exTitle' })),
  box: { colSpan: 3, rowSpan: 3 },
  fields: [
    field(TITLE, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleDataCogita.settings.titleHint' })),
    FROM_BASE,
    field({ key: 'answers', kind: 'area' }, texts({ label: 'moduleDataCogita.f.answers', hint: 'moduleDataCogita.settings.answersHint' })),
    field({ key: 'hide', kind: 'hide', options: [LEARNER_BIT] }, WHAT_SHOWS)
  ],
  read: (raw: RawConfig): LearnSettingsConfig => ({ title: text(raw, 'title'), library: text(raw, 'library'), answers: text(raw, 'answers'), hidden: hiddenSet(raw) }),
  hasContent: (c) => c.library !== '',
  missing: (c) => (c.library === '' ? pickBaseSame() : null),
  shows: (_c, size) => size.height === 'strip' ? t('moduleDataCogita.settings.showsStrip')
    : t('moduleDataCogita.settings.showsBlock'),
  View: later(() => import('./landscapeViews').then((m) => ({ default: m.LearnSettingsView })))
}, texts({ label: 'moduleDataCogita.settings.label', use: 'moduleDataCogita.settings.use' }));
