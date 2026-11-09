/**
 * 2026-11-01 — TWIERDZENIA, WZORY, RYSUNKI: WAS EIN LEHRBUCH NUMMERIERT.
 *
 * Neben den Stellen der Struktur (`locations.ts`: Seiten, Kapitel, Paragraphen) zählt ein Lehrbuch
 * seine Aussagen („Twierdzenie 2.3", „Lemat 4.1"), seine Wzory („(2.4)"), Rysunki und Tabele — und
 * verweist im Text darauf („z twierdzenia 2.3", „wzór (2.4)"). Ein Verweis wird hier zu einem Schlüssel
 * `art nummer` („theorem 2.3", „eq 2.4"), unabhängig von der Beugung: „twierdzenia", „tw.", „Theorem"
 * meinen dasselbe. So findet der Czytnik das Ziel, „Przejdź" nimmt „Twierdzenie 2.3", und eine Stelle
 * „Twierdzenie 2.3" in einem Zitat oder Wpis führt in den Text.
 */

import { t } from '../core/i18n';

export interface StatementKind {
  readonly id: string;
  /** Wie es im Buch heisst — so steht es, wenn das Label fehlt. */
  readonly label: string;
  /** Die Aussage selbst (kursiv im Druck, hier ein Kasten): Twierdzenie, Lemat … — sonst Beispiel, Bemerkung, Beweis. */
  readonly group: 'claim' | 'definition' | 'example' | 'proof';
}

/** 2026-11-09 — der Name einer Art in der Sprache der App (`librarySource.statement.<id>`). */
const kind = (id: string, group: StatementKind['group']): StatementKind => ({ id, group, get label() { return t(`librarySource.statement.${id}`); } });

export const STATEMENT_KINDS: readonly StatementKind[] = [
  kind('definition', 'definition'),
  kind('theorem', 'claim'),
  kind('lemma', 'claim'),
  kind('proposition', 'claim'),
  kind('corollary', 'claim'),
  kind('axiom', 'definition'),
  kind('conjecture', 'claim'),
  kind('fact', 'claim'),
  kind('property', 'claim'),
  kind('example', 'example'),
  kind('remark', 'example'),
  kind('exercise', 'example'),
  kind('problem', 'example'),
  kind('solution', 'proof'),
  kind('answer', 'proof'),
  kind('proof', 'proof'),
  kind('notation', 'definition'),
  kind('algorithm', 'example'),
  { id: 'other', label: '', group: 'example' }
];

export const statementKind = (id: string | undefined): StatementKind =>
  STATEMENT_KINDS.find((k) => k.id === id) ?? STATEMENT_KINDS[STATEMENT_KINDS.length - 1]!;

/** Was kein Ziel eines Verweises ist: ein Beweis, eine Lösung gehören zu dem, was sie beweisen. */
export const NOT_A_TARGET: ReadonlySet<string> = new Set(['proof', 'solution', 'answer']);

const fold = (text: string): string => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l'); // i18n-ignore

/** Wortanfänge (gefaltet) → Art; längere zuerst. Polnisch, dazu das Englische, das in Büchern steht. */
const STEMS: readonly (readonly [string, string])[] = ([
  ['twierdz', 'theorem'], ['tw', 'theorem'], ['theorem', 'theorem'], ['thm', 'theorem'], ['satz', 'theorem'],
  ['lemat', 'lemma'], ['lemma', 'lemma'], ['lem', 'lemma'],
  ['definic', 'definition'], ['definition', 'definition'], ['def', 'definition'],
  ['stwierdz', 'proposition'], ['stw', 'proposition'], ['propozyc', 'proposition'], ['proposition', 'proposition'], ['prop', 'proposition'],
  ['wnios', 'corollary'], ['wn', 'corollary'], ['corollary', 'corollary'], ['cor', 'corollary'],
  ['aksjomat', 'axiom'], ['aks', 'axiom'], ['axiom', 'axiom'],
  ['hipotez', 'conjecture'], ['hip', 'conjecture'], ['conjecture', 'conjecture'],
  ['fakt', 'fact'], ['fact', 'fact'],
  ['wlasnos', 'property'], ['wlasn', 'property'], ['property', 'property'],
  ['przyklad', 'example'], ['przykl', 'example'], ['przyk', 'example'], ['example', 'example'],
  ['uwag', 'remark'], ['uw', 'remark'], ['remark', 'remark'], ['rem', 'remark'],
  ['cwiczen', 'exercise'], ['cw', 'exercise'], ['exercise', 'exercise'], ['exerc', 'exercise'],
  ['zadani', 'problem'], ['zad', 'problem'], ['problem', 'problem'],
  ['rozwiaz', 'solution'], ['solution', 'solution'],
  ['odpowiedz', 'answer'], ['odp', 'answer'], ['answer', 'answer'],
  ['dowod', 'proof'], ['dow', 'proof'], ['proof', 'proof'],
  ['oznaczen', 'notation'], ['ozn', 'notation'], ['notation', 'notation'],
  ['algorytm', 'algorithm'], ['alg', 'algorithm'], ['algorithm', 'algorithm'],
  ['rysun', 'figure'], ['rys', 'figure'], ['rycin', 'figure'], ['ryc', 'figure'], ['figure', 'figure'], ['fig', 'figure'],
  ['tabel', 'table'], ['tablic', 'table'], ['tab', 'table'], ['table', 'table'],
  ['wzor', 'eq'], ['wz', 'eq'], ['rownan', 'eq'], ['rown', 'eq'], ['equation', 'eq'], ['eq', 'eq'], ['formula', 'eq']
] as const).slice().sort((a, b) => b[0].length - a[0].length);

/** Die Art eines Wortes am Anfang („twierdzenia" → theorem, „Rys." → figure) — `null`: keines. */
export function kindOfWord(text: string): string | null {
  const word = /^[\p{L}]+/u.exec(fold(text.trim()))?.[0];
  if (word === undefined) return null;
  for (const [stem, kind] of STEMS) {
    if (!word.startsWith(stem)) continue;
    /* Ein kurzer Stamm nur als ganzes (abgekürztes) Wort: „tw." ja, „twarz" nein. */
    if (stem.length <= 3 && word.length > stem.length + 2 && !STEMS.some(([s, k]) => k === kind && s.length > 3 && word.startsWith(s))) continue;
    return kind;
  }
  return null;
}

const NUMBER = /\(\s*([^()]{1,24}?)\s*\)|((?:[0-9]+|[IVXLC]+|[A-Z])(?:[.\-–][0-9A-Za-z]+)*[a-z]?\*?)/u;

export interface LabelKey {
  /** `theorem`, `eq`, `figure` … — `null`: nur eine Nummer („2.3"). */
  readonly kind: string | null;
  readonly num: string;
}

const tidyNum = (num: string): string => num.trim().replace(/[–—]/g, '-').replace(/\s+/g, '').toLowerCase();

/**
 * DER SCHLÜSSEL EINES LABELS ODER VERWEISES: „Twierdzenie 2.3" → theorem 2.3, „(2.4)" → eq 2.4,
 * „wzoru (2.4)" → eq 2.4, „Rys. 1.2" → figure 1.2, „2.3" → nur die Nummer. `fallback`: die Art, wenn
 * das Wort fehlt oder unbekannt ist (das `kind` einer Aussage).
 */
export function labelKey(text: string, fallback: string | null = null): LabelKey | null {
  const t = text.trim();
  if (t === '') return null;
  const word = kindOfWord(t);
  const rest = word === null ? t : t.replace(/^[\p{L}]+\.?\s*/u, '');
  const m = NUMBER.exec(rest);
  if (m === null) return null;
  if (m[1] !== undefined) return { kind: word ?? (fallback === null || fallback === 'eq' ? 'eq' : fallback), num: tidyNum(m[1]) };
  return { kind: word ?? fallback, num: tidyNum(m[2]!) };
}

/** Als Text, wie er im Verzeichnis eines Textes steht (`ManifestPart.labels`). */
export const keyText = (key: LabelKey): string => `${key.kind ?? '?'} ${key.num}`;

export const readKeyText = (text: string): LabelKey | null => {
  const at = text.indexOf(' ');
  return at <= 0 ? null : { kind: text.slice(0, at) === '?' ? null : text.slice(0, at), num: text.slice(at + 1) };
};

/** Trifft der Verweis das Ziel? Gleiche Nummer; die Art, wenn der Verweis eine nennt. */
export const labelMatches = (ref: LabelKey, target: LabelKey): boolean =>
  ref.num === target.num && (ref.kind === null || target.kind === null || ref.kind === target.kind);

/** Sieht der Text wie ein Label aus (ein Wort einer Art und eine Nummer, oder eine Nummer in Klammern)? */
export const looksLikeLabel = (text: string): boolean => {
  const t = text.trim();
  return /^\(\s*[^()]{1,24}\s*\)$/.test(t) || (kindOfWord(t) !== null && labelKey(t) !== null);
};
