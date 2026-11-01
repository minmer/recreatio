/**
 * 2026-11-01 — JSON, WIE EINE KI ES SCHREIBT.
 *
 * Ein Dokument, das `JSON.parse` liest, bleibt, wie es ist. Liest er es nicht, wird ausgebessert, was
 * beim Abschreiben von Wzory fast immer der Grund ist — und nur, wenn es danach gelesen wird:
 * <code>
 *   "$\alpha$"        ein einfacher Backslash vor einem Buchstaben, den JSON nicht kennt → "\\alpha"
 *   "$\frac{a}{b}$"   … und in solchen Dokumenten auch vor einem, den JSON kennt (\f, \b, \n, \r, \t),
 *                     wenn die Buchstaben danach einen Befehl ergeben → "\\frac"
 *   ```json … ```     der Zaun um eine Antwort, ein Satz davor oder danach
 *   Zeilenwechsel und Tabulatoren mitten in einer Zeichenkette
 * </code>
 * Wie viel ausgebessert wurde, sagt `repaired` — der Import nennt es.
 */

import { JSON_ESCAPE_WORDS } from './tex';

export type JsonRead = { readonly value: unknown; readonly repaired: number } | { readonly error: string } | null;

/** Ein Dokument lesen — erst streng, dann ausgebessert. `null`: leer. */
export function readJsonText(text: string): JsonRead {
  if (text.trim() === '') return null;
  try {
    return { value: JSON.parse(text) as unknown, repaired: 0 };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Nieprawidłowy JSON.';
    const body = unwrap(text);
    for (const candidate of body === text ? [text] : [body, text]) {
      const fixed = repairJsonText(candidate);
      const count = fixed.count + (candidate === text ? 0 : 1);
      if (count === 0) continue;
      try { return { value: JSON.parse(fixed.text) as unknown, repaired: count }; } catch { /* weiter — am Ende zählt der erste Fehler */ }
    }
    return { error: message };
  }
}

/** Das Dokument ohne Zaun und ohne Sätze davor und danach: vom ersten `{`/`[` bis zum letzten `}`/`]`. */
function unwrap(text: string): string {
  const fenced = /^\s*```[a-zA-Z]*\s*\n([\s\S]*?)\n\s*```\s*$/.exec(text);
  const inner = fenced === null ? text : fenced[1]!;
  const start = inner.search(/[{[]/);
  const end = Math.max(inner.lastIndexOf('}'), inner.lastIndexOf(']'));
  return start >= 0 && end > start ? inner.slice(start, end + 1) : inner;
}

const VALID = '"\\/bfnrtu';
const LETTER = /[A-Za-z]/;

/**
 * HAT DIE KI GAR NICHT ENTWERTET? Dann stehen Befehle mit einem Backslash da (`\frac`, `\alpha`) und kaum
 * welche mit zweien (`\\frac`) — und `\\` ist dann der Zeilenumbruch von LaTeX (in Macierze, `aligned`),
 * kein entwerteter Backslash. Gezählt werden Befehle aus mindestens zwei Buchstaben.
 */
function unescaped(text: string): boolean {
  const single = text.match(/(?<!\\)\\[A-Za-z]{2,}/g)?.length ?? 0;
  const double = text.match(/(?<!\\)\\\\[A-Za-z]{2,}/g)?.length ?? 0;
  return single > 0 && single > double * 2;
}

/**
 * Backslashes in Zeichenketten, die JSON nicht als Escape liest, verdoppeln; ebenso `\b \f \n \r \t`,
 * wenn sie in einem Dokument voller einfacher Backslashes einen Befehl beginnen. Rohe Zeilenwechsel
 * und Tabulatoren in einer Zeichenkette werden zu `\n`, `\t`. Hat die KI gar nicht entwertet, bleibt
 * `\\` der Zeilenumbruch von LaTeX.
 */
export function repairJsonText(text: string): { text: string; count: number } {
  const raw = unescaped(text);
  let out = '';
  let count = 0;
  let inString = false;
  /* Mitten in einem Wzór dieser Zeichenkette (`$…$`, `$$…$$`)? Dort ist auch `\nu` ein Befehl, sonst nur längere. */
  let inline = false;
  let display = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (!inString) {
      if (c === '"') { inString = true; inline = false; display = false; }
      out += c;
      continue;
    }
    if (c === '\\') {
      const n = text[i + 1];
      if (n === undefined) { out += '\\\\'; count += 1; continue; }
      /* Nicht entwertet: `\\` ist der Zeilenumbruch von LaTeX — zwei Backslashes, in JSON vier. */
      if (raw && n === '\\') { out += '\\\\\\\\'; count += 1; i += 1; continue; }
      if (n === 'u') {
        if (/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) { out += text.slice(i, i + 6); i += 5; continue; }
        out += '\\\\'; count += 1; continue;
      }
      if (VALID.includes(n)) {
        if ('bfnrt'.includes(n) && LETTER.test(text[i + 2] ?? '')) {
          const word = n + (/^[A-Za-z]+/.exec(text.slice(i + 2, i + 40))?.[0] ?? '');
          /* Nicht entwertet und mitten in einem Wzór: jeder Backslash vor Buchstaben ist ein Befehl — auch ein eigenes Makro (`\tr`, `\norm`). */
          if ((raw && (inline || display)) || (JSON_ESCAPE_WORDS.has(word) && (inline || display || word.length >= 3))) { out += '\\\\'; count += 1; continue; }
        }
        out += c + n;
        i += 1;
        continue;
      }
      out += '\\\\';
      count += 1;
      continue;
    }
    if (c === '"') { inString = false; out += c; continue; }
    if (c === '$') {
      if (text[i + 1] === '$') { display = !display; out += '$$'; i += 1; continue; }
      if (!display) inline = !inline;
    }
    if (c === '\n') { out += '\\n'; count += 1; continue; }
    if (c === '\r') { out += '\\r'; count += 1; continue; }
    if (c === '\t') { out += '\\t'; count += 1; continue; }
    out += c;
  }
  return { text: out, count };
}
