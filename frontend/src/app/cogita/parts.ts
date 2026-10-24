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
 *       (Więcej) ustawienia, json, do-zrobienia, propozycje, stare; wer nur liest: zaproponuj
 *   #/workspace/learn/&lt;baza&gt;/…       NAUKA — aus diesem Wissen lernen
 *       nauka                         was jetzt dran ist: Powtórki, Przebiegi
 *       powtorki, przebiegi, sesje, postepy
 *       (Więcej) karty (Szablony kart), mapa, ustawienia
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

import { viewPath } from '../routes';

export type CogitaPart = 'knowledge' | 'learn';

/** Die Reiter der Wiedza — die drei Tätigkeiten zuerst. */
export const KNOWLEDGE_TABS = [
  ['wpisy', 'Wpisy'], ['dodaj', 'Dodaj'], ['schematy', 'Schematy']
] as const;
/** Was die Wiedza ausserdem hat — unter „Więcej", nicht neben den drei. */
export const KNOWLEDGE_MORE = [
  ['ustawienia', 'Ustawienia'], ['json', 'Import i eksport (JSON)'], ['do-zrobienia', 'Do zrobienia'], ['propozycje', 'Propozycje']
] as const;
/** Die Reiter der Nauka. */
export const LEARN_TABS = [
  ['nauka', 'Ucz się'], ['powtorki', 'Powtórki'], ['przebiegi', 'Przebiegi'], ['sesje', 'Sesje'], ['postepy', 'Postępy']
] as const;
export const LEARN_MORE = [['karty', 'Szablony kart'], ['mapa', 'Mapa'], ['ustawienia', 'Ustawienia']] as const;

/** Wer nur liest (ein Lernender): Wiedza zum Nachlesen und Vorschlagen, Nauka zum Lernen. */
export const KNOWLEDGE_READER_TABS = [['wpisy', 'Wpisy'], ['zaproponuj', 'Zaproponuj']] as const;
export const LEARN_READER_TABS = [['nauka', 'Ucz się'], ['przebiegi', 'Przebiegi'], ['sesje', 'Sesje'], ['postepy', 'Postępy'], ['mapa', 'Mapa']] as const;

/** Die drei Kategorien der Schematy — Wort in der Adresse, Name, ein Satz. */
export const SCHEMA_PARTS = [
  { slug: 'rodzaje', label: 'Rodzaje wpisów', says: 'Jakie wpisy istnieją: ich pola i odwołania do innych wpisów.' },
  { slug: 'dodawanie', label: 'Sposoby dodawania', says: 'Jak się wpisuje wiedzę — także kilka połączonych wpisów naraz, różnych rodzajów.' },
  { slug: 'wyswietlanie', label: 'Sposoby wyświetlania', says: 'Co pokazać i jak — także informacje z wpisów, do których prowadzą odwołania.' }
] as const;
export type SchemaPart = (typeof SCHEMA_PARTS)[number]['slug'];

const KNOWLEDGE: ReadonlySet<string> = new Set(['wpisy', 'dodaj', 'schematy', 'schemat', 'json', 'do-zrobienia', 'propozycje', 'zaproponuj', 'stare', 'ustawienia']);
const LEARN: ReadonlySet<string> = new Set(['nauka', 'powtorki', 'przebiegi', 'sesje', 'postepy', 'mapa', 'karty']);

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
