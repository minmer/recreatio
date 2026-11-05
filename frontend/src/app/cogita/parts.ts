/**
 * 2026-10-24 — COGITA IN ZWEI TEILEN: WIEDZA UND NAUKA.
 *
 * Dieselben Bazy wiedzy, derselbe Speicher — zwei Orte im Arbeitsbereich, nach dem, was man
 * dort tut:
 * <code>
 *   #/workspace/knowledge/&lt;baza&gt;/…   WIEDZA — sammeln, ordnen, verbinden, erkunden
 *       wpisy                         die Einträge: finden, öffnen, den Verweisen folgen, ändern; zeigen nach einem Sposób wyświetlania
 *       dodaj                         hinzufügen: ein einzelner Eintrag oder ein Sposób dodawania (mehrere verbundene auf einmal)
 *       schematy/rodzaje              Rodzaje wpisów — was es gibt, welche Felder und Verweise
 *       schematy/dodawanie            Sposoby dodawania — die Formularze dodawania
 *       schematy/wyswietlanie         Sposoby wyświetlania — was gezeigt wird und wie (die Widoki)
 *       (Więcej) ustawienia, json, do-zrobienia, propozycje, wejscia (Wejścia z Biblioteki), stare; wer nur liest: zaproponuj
 *   #/workspace/learn/&lt;baza&gt;/…       NAUKA — aus diesem Wissen lernen
 *       nauka                         was jetzt dran ist: Powtórki, Przebiegi
 *       sciezka                       (2026-10-27) die Reihenfolge des Lernens: Ebenen von den Grundlagen her (`LearningPath.tsx`)
 *       powtorki, przebiegi, sesje, postepy
 *       (Więcej) karty (Szablony kart), mapa, nagrody (2026-11-02: punkty, seria, odznaki), ustawienia
 * </code>
 *
 * Die drei Kategorien der Schematy sind unabhängig: ein Sposób dodawania darf Einträge
 * mehrerer Rodzaje anlegen, ein Sposób wyświetlania mehrere Rodzaje über ihre Verweise
 * zusammen zeigen, und kein Rodzaj braucht einen eigenen. Jeder Eintrag bleibt ohne beides
 * zu öffnen und zu ändern (Wpisy, Dodaj → pojedynczy wpis).
 *
 * <b>Alte Adressen</b> (`learn/<baza>/wpisy`, `…/schemat`, `…/schemat/formularz/<id>`,
 * `…/wpisy/dodaj/<id>`) führen auf die neuen (`cogitaTrail`): Links in Texten, Seiten,
 * Benachrichtigungen und der MCP-Schnittstelle bleiben gültig.
 */

import { t } from '../core/i18n';
import { viewPath } from '../routes';

export type CogitaPart = 'knowledge' | 'learn';

/** Die Schlüssel der Namen je Reiter — gezeichnet in der Sprache der Stelle (`tabLabel`). */
const TAB_KEY: Readonly<Record<string, string>> = {
  'wpisy': 'cogitaViews.tabs.entries',
  'dodaj': 'cogitaViews.tabs.add',
  'schematy': 'cogitaViews.tabs.schemes',
  'ustawienia': 'cogitaViews.tabs.settings',
  'json': 'cogitaViews.tabs.json',
  'do-zrobienia': 'cogitaViews.tabs.todo',
  'propozycje': 'cogitaViews.tabs.proposals',
  'wejscia': 'cogitaViews.tabs.anchors',
  'nauka': 'cogitaViews.tabs.learn',
  'sciezka': 'cogitaViews.tabs.path',
  'powtorki': 'cogitaViews.tabs.revisions',
  'przebiegi': 'cogitaViews.tabs.flows',
  'sesje': 'cogitaViews.tabs.sessions',
  'postepy': 'cogitaViews.tabs.progress',
  'karty': 'cogitaViews.tabs.templates',
  'mapa': 'cogitaViews.tabs.map',
  'nagrody': 'cogitaViews.tabs.rewards',
  'zaproponuj': 'cogitaViews.tabs.propose'
};

/** Der Name eines Reiters in der Sprache von `tr` (sonst der gelesene Name). */
export const tabLabel = (slug: string, label: string, tr: (key: string) => string = t): string => {
  const key = TAB_KEY[slug];
  return key === undefined ? label : tr(key);
};

/**
 * Ein Reiter: [Wort in der Adresse, Name] — der Name wird erst beim Lesen übersetzt (in der Sprache der Anwendung),
 * die Gestalt bleibt ein Paar (`[slug, label]`).
 */
const tab = <S extends string>(slug: S): readonly [S, string] => {
  const out = [slug] as unknown as [S, string];
  Object.defineProperty(out, 1, { get: () => tabLabel(slug, slug), enumerable: true });
  return out;
};

/** Die Reiter der Wiedza — die drei Tätigkeiten zuerst. */
export const KNOWLEDGE_TABS = [
  tab('wpisy'), tab('dodaj'), tab('schematy')
] as const;
/** Was die Wiedza ausserdem hat — unter „Więcej", nicht neben den drei. */
export const KNOWLEDGE_MORE = [
  tab('ustawienia'), tab('json'), tab('do-zrobienia'), tab('propozycje'),
  /* 2026-10-25 (Wywód) — die Wege aus der Bibliothek (`anchors.ts`). */
  tab('wejscia')
] as const;
/** Die Reiter der Nauka. */
export const LEARN_TABS = [
  tab('nauka'), tab('sciezka'), tab('powtorki'), tab('przebiegi'), tab('sesje'), tab('postepy')
] as const;
/** 2026-11-02 — „Nagrody": punkty, seria, cel dnia, poziomy, odznaki (`RewardsEditor.tsx`); auch für wer nur liest. */
export const LEARN_MORE = [tab('karty'), tab('mapa'), tab('nagrody'), tab('ustawienia')] as const;

/** Wer nur liest (ein Lernender): Wiedza zum Nachlesen und Vorschlagen, Nauka zum Lernen. */
export const KNOWLEDGE_READER_TABS = [tab('wpisy'), tab('zaproponuj')] as const;
export const LEARN_READER_TABS = [tab('nauka'), tab('sciezka'), tab('przebiegi'), tab('sesje'), tab('postepy'), tab('mapa'), tab('nagrody')] as const;

/** Die drei Kategorien der Schematy — Wort in der Adresse, Name, ein Satz (übersetzt beim Lesen). */
export const SCHEMA_PARTS = [
  { slug: 'rodzaje' as const, labelKey: 'cogitaViews.tabs.schemaKinds', saysKey: 'cogitaViews.tabs.schemaKindsSays', get label() { return t(this.labelKey); }, get says() { return t(this.saysKey); } },
  { slug: 'dodawanie' as const, labelKey: 'cogitaViews.tabs.schemaAdd', saysKey: 'cogitaViews.tabs.schemaAddSays', get label() { return t(this.labelKey); }, get says() { return t(this.saysKey); } },
  { slug: 'wyswietlanie' as const, labelKey: 'cogitaViews.tabs.schemaViews', saysKey: 'cogitaViews.tabs.schemaViewsSays', get label() { return t(this.labelKey); }, get says() { return t(this.saysKey); } }
] as const;
export type SchemaPart = (typeof SCHEMA_PARTS)[number]['slug'];

const KNOWLEDGE: ReadonlySet<string> = new Set(['wpisy', 'dodaj', 'schematy', 'schemat', 'json', 'do-zrobienia', 'propozycje', 'zaproponuj', 'stare', 'ustawienia', 'wejscia']);
const LEARN: ReadonlySet<string> = new Set(['nauka', 'sciezka', 'powtorki', 'przebiegi', 'sesje', 'postepy', 'mapa', 'karty', 'nagrody']);

/** Zu welchem Teil ein Reiter gehört — `ustawienia` zu beiden (die Wiedza zuerst). */
export const partOfTab = (tab: string | undefined): CogitaPart | null =>
  tab === undefined ? null : KNOWLEDGE.has(tab) ? 'knowledge' : LEARN.has(tab) ? 'learn' : null;

/**
 * Ein Weg in einer Baza — alt oder neu — als Teil und Weg der neuen Ordnung.
 * <code>
 *   schemat                     → knowledge  schematy/rodzaje
 *   schemat/&lt;rodzaj&gt;            → knowledge  schematy/rodzaje/&lt;rodzaj&gt;
 *   schemat/formularz[/&lt;id&gt;]    → knowledge  schematy/dodawanie[/&lt;id&gt;]
 *   wpisy/dodaj/&lt;formularz&gt;     → knowledge  dodaj/&lt;formularz&gt;
 *   wpisy/nowy/&lt;rodzaj&gt;         → knowledge  dodaj/nowy/&lt;rodzaj&gt;
 *   karty, nauka, powtorki, …   → learn      (wie sie sind)
 * </code>
 */
export function cogitaTrail(tail: readonly string[], prefer: CogitaPart = 'knowledge'): { part: CogitaPart; tail: string[] } {
  const [first, second, ...rest] = tail;
  if (first === 'schemat') {
    if (second === 'formularz') return { part: 'knowledge', tail: ['schematy', 'dodawanie', ...rest] };
    return { part: 'knowledge', tail: ['schematy', 'rodzaje', ...(second === undefined ? [] : [second, ...rest])] };
  }
  if (first === 'wpisy' && second === 'dodaj') return { part: 'knowledge', tail: ['dodaj', ...rest] };
  if (first === 'wpisy' && second === 'nowy') return { part: 'knowledge', tail: ['dodaj', 'nowy', ...rest] };
  if (first === 'ustawienia') return { part: prefer, tail: [...tail] };
  return { part: partOfTab(first) ?? prefer, tail: [...tail] };
}

/** Die Adresse eines Ortes in einer Baza — im richtigen Teil, auch aus einem alten Weg. */
export function cogitaPath(libraryId: string, ...tail: readonly string[]): string {
  const { part, tail: next } = cogitaTrail(tail);
  return viewPath(part, libraryId, ...next);
}
