/**
 * Die drei Sprachen der öffentlichen Seite.
 *
 * Der Schlüssel im Speicher ist derselbe wie im Altbestand
 * (`recreatio.lang`) — wer dort auf Deutsch gestellt hat und hierher wechselt,
 * soll nicht wieder Polnisch bekommen. Zwei Schlüssel für dieselbe Frage wären
 * zwei Antworten, die auseinanderlaufen.
 *
 * Polnisch ist die Vorgabe und die Hauptsprache (Abschnitt 8).
 */

import { pl } from './pl';
import { de } from './de';
import { en } from './en';
import type { PublicCopy } from './types';

export type { PublicCopy } from './types';
export * from './types';

export const PUBLIC_LANGS = ['pl', 'de', 'en'] as const;
export type PublicLang = (typeof PUBLIC_LANGS)[number];

export const publicCopy: Readonly<Record<PublicLang, PublicCopy>> = { pl, de, en };

/** Der Name der Sprache in ihrer eigenen Sprache — nie übersetzt. */
export const PUBLIC_LANG_NAMES: Readonly<Record<PublicLang, string>> = {
  pl: 'Polski',
  de: 'Deutsch',
  en: 'English'
};

const LANG_KEY = 'recreatio.lang';

const isLang = (value: unknown): value is PublicLang =>
  typeof value === 'string' && (PUBLIC_LANGS as readonly string[]).includes(value);

/**
 * Die Sprache beim Aufschlagen der Seite.
 *
 * Reihenfolge: die frühere Wahl schlägt die Browsereinstellung, und die
 * Browsereinstellung schlägt die Vorgabe. Wer einmal umgestellt hat, hat damit
 * eine Entscheidung getroffen; sie bei jedem Besuch neu zu erraten wäre keine
 * Hilfe, sondern eine Bevormundung.
 */
export function detectPublicLang(): PublicLang {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // Privates Fenster oder gesperrter Speicher. Kein Grund für einen Absturz.
  }

  if (typeof navigator !== 'undefined') {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const short = tag?.slice(0, 2).toLowerCase();
      if (isLang(short)) return short;
    }
  }

  return 'pl';
}

export function storePublicLang(lang: PublicLang): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Siehe oben. Die Sprache gilt dann nur für diesen Besuch.
  }
}
