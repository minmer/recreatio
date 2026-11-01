/**
 * 2026-11-01 — KaTeX: EIN WZÓR ALS HTML (mit MathML für Vorleseprogramme). Ohne CSS — so prüft dieselbe
 * Datei die Wzory auch ohne Browser (`app-library-check.mjs`); das Aussehen bringt `katexStyled.ts`.
 *
 * Was KaTeX nicht kennt, aber in Büchern steht, kommt als Makra dazu (`BASE_MACROS`, `prepareTex` in
 * `core/tex.ts`); die Makra des Buches (`edition.macros`) gehen vor. Nichts, was eine Adresse öffnet
 * (`trust: false`), nichts, was sich ohne Ende ausdehnt (`maxExpand`).
 */

import katex from 'katex';
import 'katex/contrib/mhchem';

import { BASE_MACROS, prepareTex, type TexMacros } from '../../core/tex';

export type TexOut = { readonly html: string } | { readonly error: string };

const cache = new Map<string, TexOut>();
const macroKeys = new WeakMap<object, string>();
const keyOf = (macros: TexMacros): string => {
  if (Object.keys(macros).length === 0) return '';
  let key = macroKeys.get(macros);
  if (key === undefined) { key = JSON.stringify(macros); macroKeys.set(macros, key); }
  return key;
};

/** Die Meldung von KaTeX, ohne die unterstrichenen Zeichen, mit der Stelle im Wzór. */
function describe(e: unknown): string {
  if (e instanceof katex.ParseError) return Number.isFinite(e.position) ? `${e.rawMessage} (znak ${e.position + 1})` : e.rawMessage;
  return e instanceof Error ? e.message : String(e);
}

/** Ein Wzór gesetzt — oder warum nicht. Gemerkt (dieselben Wzory kommen in einem Buch immer wieder). */
export function renderTex(tex: string, display: boolean, macros: TexMacros = {}): TexOut {
  const id = `${display ? 'D' : 'I'}${keyOf(macros)}\u0000${tex}`;
  const known = cache.get(id);
  if (known !== undefined) return known;
  const prepared = prepareTex(tex);
  let out: TexOut;
  try {
    out = {
      html: katex.renderToString(prepared.tex, {
        displayMode: display, throwOnError: true, strict: 'ignore', trust: false, output: 'htmlAndMathml', maxSize: 40, maxExpand: 2000,
        /* Ein neues Objekt je Wzór: KaTeX schreibt `\gdef` hinein, und ein Wzór soll den nächsten nicht ändern. */
        macros: { ...BASE_MACROS, ...macros, ...prepared.macros }
      })
    };
  } catch (e) {
    out = { error: describe(e) };
  }
  if (cache.size >= 5000) cache.clear();
  cache.set(id, out);
  return out;
}

/** Lässt sich der Wzór setzen? Die Meldung, wenn nicht (`TexCheck` des Imports). */
export function checkTex(tex: string, display: boolean, macros: TexMacros = {}): string | null {
  const out = renderTex(tex, display, macros);
  return 'error' in out ? out.error : null;
}
