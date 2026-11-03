/**
 * 2026-11-01 — FRAGEN MIT PARAMETERN: jede Frage bekommt bei jedem Versuch neue Zahlen.
 *
 * <code>
 *   "params":  [{ "name": "a", "random": [20, 99] }, { "name": "n", "random": [3, 9], "step": 1 }, { "name": "f", "values": ["sin", "cos"] }]
 *   "let":     [{ "name": "r", "value": "mod(a, n)" }]           gerechnet in der Sprache der Rysunki (`pages/motion/expr.ts`)
 *   "require": ["a > 2*n", "r != 0"]                              gezogen wird neu, bis jede Bedingung gilt (höchstens 60-mal)
 *   im Text:   "Bestimmen Sie $r$ mit $0\le r<{n}$ und ${a} = q\cdot {n} + r$."   "answers": ["{r}"]   "{fmt(x, 2)}"
 * </code>
 *
 * <b>Was ein Platzhalter ist</b>: `{…}` mit einem Ausdruck, der wenigstens einen Namen aus `params`/`let` liest und sonst
 * nur bekannte Funktionen. Alles andere bleibt, wie es steht — `\mathbb{N}`, `x^{2}`, `\{1,2\}` sind LaTeX. Wer einen
 * Buchstaben, der ein Parameter ist, als LaTeX-Gruppe meint, schreibt ihn mit Leerzeichen: `\frac{ a }{2}`.
 *
 * <b>Zahlen</b> stehen mit Komma (3,5) und einfachem Minus, damit eine getippte Antwort sie liest; in einem Wzór mit
 * `{,}` (setzt ohne Abstand). Rein, ohne Oberfläche — geprüft in `app-lemma-check`.
 *
 * 2026-11-03 — DAS IST JETZT DER EINE GENERATOR (`generator.ts`): dazu Einträge aus der Baza (`entry`, `entries`),
 * Listen, Datensätze, Texte mit `{…}` auch in `correct`, `value`, `tolerance`. Diese Datei bleibt der alte Name.
 */

export {
  drawParams, fillParams, numberText, PARAM_KEYS, PARAM_TRIES, paramsProblems, readParamsSpec, withParams,
  type LetSpec, type ParamSpec, type ParamsSpec
} from './generator';
