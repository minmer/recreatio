/**
 * NUMMERN VERGLEICHEN UND ZEIGEN — „600 100 200", „+48600100200" und
 * „0048 600-100-200" sind dieselbe Nummer; „mBank" und „8080" sind Absender,
 * die keine Rufnummer sind, und bleiben, wie sie sind.
 */

import { normalisePhone } from '../forms/phone';

/** Die Form zum Vergleichen: „+48600100200" — Absender ohne Rufnummer klein geschrieben. */
export function phoneKey(raw: string | null | undefined): string {
  const text = (raw ?? '').trim();
  if (text === '') return '';
  if (/\p{L}/u.test(text)) return text.toLowerCase();
  const normal = normalisePhone(text);
  if (normal !== null) return normal.replace(/\s+/g, '');
  return text.replace(/[^\d+]/g, '');
}

/** Wie eine Nummer dasteht: die eigene gegliedert („+48 600 100 200"), alles andere unverändert. */
export function phoneShown(raw: string | null | undefined): string {
  const text = (raw ?? '').trim();
  if (text === '' || /\p{L}/u.test(text)) return text;
  return normalisePhone(text) ?? text;
}

/** Dieselbe Nummer? */
export const samePhone = (a: string | null | undefined, b: string | null | undefined): boolean => {
  const x = phoneKey(a);
  return x !== '' && x === phoneKey(b);
};

/** Die Buchstaben im Kreis vor einem Namen — oder „#" für eine Nummer. */
export function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || /^[+\d]/.test(name.trim())) return '#';
  return (words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[words.length - 1][0]}`).toUpperCase();
}

/**
 * Wie viele SMS ein Text braucht: 160 Zeichen in GSM-7, 70 mit einem polnischen
 * Buchstaben (UCS-2); geteilt 153 bzw. 67 je Stück.
 */
export function smsParts(text: string): { readonly parts: number; readonly left: number; readonly unicode: boolean } {
  const gsm = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\[~\]|€]*$/.test(text);
  const extended = gsm ? (text.match(/[\^{}\\[~\]|€]/g) ?? []).length : 0;
  const length = gsm ? text.length + extended : [...text].reduce((n, ch) => n + (ch.length > 1 ? 2 : 1), 0);
  const single = gsm ? 160 : 70;
  const piece = gsm ? 153 : 67;
  if (length <= single) return { parts: length === 0 ? 0 : 1, left: single - length, unicode: !gsm };
  const parts = Math.ceil(length / piece);
  return { parts, left: parts * piece - length, unicode: !gsm };
}
