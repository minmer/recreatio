/**
 * 2026-11-01 — WZORY: LaTeX IM TEXT.
 *
 * Ein Wzór steht im Text zwischen Dollarzeichen, wie bei Pandoc und in jedem LaTeX-Text:
 * <code>
 *   $x^2$                im Satz
 *   $$\int_0^1 f\,dx$$   für sich, in eigener Zeile (auch mitten im Absatz)
 *   \$                   ein Dollarzeichen, das kein Wzór beginnt
 * </code>
 * Damit „5$ und 10$" kein Wzór wird, gilt Pandocs Regel: nach dem öffnenden `$` kein Leerraum,
 * vor dem schliessenden keiner, und nach ihm keine Ziffer.
 *
 * Hier wird nur gelesen und ausgebessert (ohne Browser prüfbar). Gezeichnet wird mit KaTeX
 * (`ui/tex/`), erst geladen, wenn ein Wzór zu sehen ist.
 *
 * <b>Was beim Import ausgebessert wird</b> (`repairTexText`) — was eine KI beim Schreiben von JSON
 * typischerweise verdirbt: ein einfacher `\` vor `frac` ist in JSON ein Seitenvorschub, vor `theta`
 * ein Tabulator, vor `nabla` ein Zeilenwechsel; `\(…\)` und `\[…\]` statt Dollar; eine nackte
 * Umgebung (`\begin{align}…`) ohne Dollar; jeder Backslash doppelt; `\newcommand` in einem Wzór
 * (gilt dann für den ganzen Text); ein Seitenwechsel mitten im Wzór.
 */

/* -- Lesen ---------------------------------------------------------------------------------------- */

export interface TexAt {
  readonly tex: string;
  readonly display: boolean;
  /** Erstes Zeichen nach dem schliessenden Dollar. */
  readonly end: number;
}

const SPACE = /\s/;
const DIGIT = /[0-9]/;
const WORD = /[\p{L}\p{N}]/u;
/** Befehle, deren Argument Text ist — darin darf ein `$` stehen (`\text{5 $}`). */
const TEXT_ARG = /^\\(?:text|textrm|textit|textbf|textsf|texttt|textup|textnormal|mbox|hbox)\s*\{/;

/** Nach einer öffnenden Klammer `{` bei `from`: das Zeichen nach der passenden `}` (−1: keine). */
export function braceEnd(text: string, from: number): number {
  let depth = 0;
  for (let i = from; i < text.length; i += 1) {
    const c = text[i];
    if (c === '\\') { i += 1; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') { depth -= 1; if (depth === 0) return i + 1; }
  }
  return -1;
}

/**
 * Der Wzór, der bei `i` (einem `$`) beginnt — oder `null`, wenn das Dollarzeichen einfach eines ist. Zu Pandocs
 * Regel kommt eine für das Polnische: der Preis steht vor dem Zeichen („10$, a tamto 20$") — ein `$` direkt nach
 * einer Ziffer oder einem Buchstaben („10$", „US$") beginnt keinen Wzór.
 */
export function mathAt(text: string, i: number): TexAt | null {
  if (text[i] !== '$') return null;
  if (i > 0 && WORD.test(text[i - 1]!)) return null;
  if (text[i + 1] === '$') {
    for (let j = i + 2; j < text.length; j += 1) {
      const c = text[j];
      if (c === '\\') { j += 1; continue; }
      if (c === '$' && text[j + 1] === '$') {
        const tex = text.slice(i + 2, j);
        return tex.trim() === '' ? null : { tex, display: true, end: j + 2 };
      }
    }
    return null;
  }
  const first = text[i + 1];
  if (first === undefined || SPACE.test(first)) return null;
  for (let j = i + 1; j < text.length; j += 1) {
    const c = text[j];
    if (c === '\\') {
      const arg = TEXT_ARG.exec(text.slice(j, j + 14));
      if (arg !== null) { const end = braceEnd(text, j + arg[0].length - 1); if (end > 0) { j = end - 1; continue; } }
      j += 1;
      continue;
    }
    if (c === '\n' && text[j + 1] === '\n') return null;
    if (c === '$') {
      if (SPACE.test(text[j - 1] ?? ' ') || DIGIT.test(text[j + 1] ?? '')) return null;
      return { tex: text.slice(i + 1, j), display: false, end: j + 1 };
    }
  }
  return null;
}

export type TexPiece =
  | { readonly t: 'text'; readonly v: string }
  | { readonly t: 'math'; readonly tex: string; readonly display: boolean };

/** Ein Text, in Text und Wzory zerlegt; `\$` ist ein Dollarzeichen. */
export function texPieces(text: string): TexPiece[] {
  if (!text.includes('$')) return text === '' ? [] : [{ t: 'text', v: text }];
  const out: TexPiece[] = [];
  let buffer = '';
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (c === '\\' && text[i + 1] === '$') { buffer += '$'; i += 1; continue; }
    if (c === '$') {
      const m = mathAt(text, i);
      if (m !== null) {
        if (buffer !== '') { out.push({ t: 'text', v: buffer }); buffer = ''; }
        out.push({ t: 'math', tex: m.tex, display: m.display });
        i = m.end - 1;
        continue;
      }
    }
    buffer += c;
  }
  if (buffer !== '') out.push({ t: 'text', v: buffer });
  return out;
}

/** Steht in dem Text ein Wzór? */
export const hasTex = (text: string): boolean => text.includes('$') && texPieces(text).some((p) => p.t === 'math');

/** Die Wzory eines Textes. */
export const texesOf = (text: string): { tex: string; display: boolean }[] =>
  texPieces(text).flatMap((p) => (p.t === 'math' ? [{ tex: p.tex, display: p.display }] : []));

/** Ein Wzór wieder als Text (mit seinen Dollarzeichen). */
export const texSource = (tex: string, display: boolean): string => (display ? `$$${tex}$$` : `$${tex}$`);

/** Ein Text, in dem ein Dollarzeichen kein Wzór beginnt. */
export const escapeDollars = (text: string): string => text.replace(/\$/g, '\\$');

/* -- Makra ---------------------------------------------------------------------------------------- */

export type TexMacros = Readonly<Record<string, string>>;

/**
 * Was KaTeX nicht kennt, aber in Büchern steht — als Makra, die für jeden Wzór gelten:
 * Verweise (`\label`, `\eqref`, `\ref` — die Nummer steht dann einfach da), das Ende eines Beweises,
 * `\intertext` (eine Zeile Text zwischen den Zeilen einer Umgebung), ein paar Schreibweisen.
 */
export const BASE_MACROS: TexMacros = {
  '\\label': '\\@secondoftwo{#1}{}',
  '\\eqref': '\\text{(#1)}',
  '\\ref': '\\text{#1}',
  '\\qed': '\\square',
  '\\qedhere': '\\quad\\square',
  '\\hdots': '\\ldots',
  '\\mathbbm': '\\mathbb{#1}',
  '\\mathds': '\\mathbb{#1}',
  '\\intertext': '\\\\\\text{#1}\\\\',
  '\\shortintertext': '\\\\\\text{#1}\\\\',
  '\\dif': '\\mathop{}\\!\\mathrm{d}',
  '\\diff': '\\mathop{}\\!\\mathrm{d}'
};

const MACRO_NAME = /^\\[A-Za-z@]+$/;
const MAX_MACROS = 300;
const MAX_MACRO = 2000;

/** Die Makra eines Textes (`edition.macros`) — nur Namen wie `\R` und Text; was nicht passt, fällt weg. */
export function readMacros(raw: unknown): { macros: Record<string, string>; warnings: string[] } {
  const macros: Record<string, string> = {};
  const warnings: string[] = [];
  if (raw === undefined || raw === null) return { macros, warnings };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { macros, warnings: ['"edition.macros" — obiekt {"\\\\R": "\\\\mathbb{R}"}; pominięte.'] };
  for (const [key, raw0] of Object.entries(raw as Record<string, unknown>)) {
    /* Ein Name oder Text, den JSON verdorben hat (`"\rank"` ohne Entwertung: Wagenrücklauf + „ank"): zurück zum Backslash. */
    const name0 = unControl(key);
    const value = typeof raw0 === 'string' ? unControl(raw0) : raw0;
    const name = name0.startsWith('\\') ? name0 : `\\${name0}`;
    if (!MACRO_NAME.test(name)) { warnings.push(`Makro „${name0}” — nazwa to \\ i litery (np. "\\\\R"); pominięte.`); continue; }
    if (typeof value !== 'string' || value.length > MAX_MACRO) { warnings.push(`Makro „${name}” — treść to tekst LaTeX (najwyżej ${MAX_MACRO} znaków); pominięte.`); continue; }
    if (Object.keys(macros).length >= MAX_MACROS) { warnings.push(`Więcej niż ${MAX_MACROS} makr — reszta pominięta.`); break; }
    macros[name] = value;
  }
  return { macros, warnings };
}

/** In LaTeX ist ein Steuerzeichen vor einem Buchstaben immer ein verdorbener Backslash (`\rank` → Wagenrücklauf + „ank"). */
const unControl = (text: string): string => text.replace(/[\b\f\n\r\t](?=[A-Za-z])/g, (c) => `\\${CONTROL[c] ?? ''}`);

/** Ein Argument eines Befehls bei `i`: eine Gruppe `{…}`, ein Befehl `\x` oder ein Zeichen — Inhalt und Ende. */
function argAt(text: string, from: number): { value: string; end: number } | null {
  let i = from;
  while (i < text.length && SPACE.test(text[i]!)) i += 1;
  if (i >= text.length) return null;
  if (text[i] === '{') {
    const end = braceEnd(text, i);
    return end < 0 ? null : { value: text.slice(i + 1, end - 1), end };
  }
  if (text[i] === '\\') {
    const m = /^\\(?:[A-Za-z@]+|.)/.exec(text.slice(i));
    return m === null ? null : { value: m[0], end: i + m[0].length };
  }
  return { value: text[i]!, end: i + 1 };
}

const DEFINITION = /\\(newcommand|renewcommand|providecommand|DeclareMathOperator|def)(\*?)(?![A-Za-z])/g;

/**
 * Die Definitionen in einem Wzór (`\newcommand`, `\renewcommand`, `\providecommand`, `\DeclareMathOperator`,
 * `\def` ohne Muster) herausgenommen — als Makra. KaTeX kennt `\DeclareMathOperator` nicht und erlaubt
 * `\newcommand` nicht für Namen, die es schon gibt (`\N`); als Makra geht beides.
 */
export function hoistDefinitions(tex: string): { tex: string; macros: Record<string, string> } {
  if (!/\\(?:newcommand|renewcommand|providecommand|DeclareMathOperator|def)/.test(tex)) return { tex, macros: {} };
  const macros: Record<string, string> = {};
  let out = '';
  let at = 0;
  DEFINITION.lastIndex = 0;
  for (let m = DEFINITION.exec(tex); m !== null; m = DEFINITION.exec(tex)) {
    const start = m.index;
    if (start < at) continue;
    const kind = m[1]!;
    const name = argAt(tex, start + m[0].length);
    if (name === null || !MACRO_NAME.test(name.value.trim())) continue;
    let i = name.end;
    let args = 0;
    if (kind === 'def') {
      const params = /^((?:#\d)*)\s*\{/.exec(tex.slice(i));
      if (params === null) continue;
      args = params[1]!.length / 2;
      i += params[1]!.length;
    } else if (kind !== 'DeclareMathOperator') {
      const count = /^\s*\[(\d)\]/.exec(tex.slice(i));
      if (count !== null) { args = Number(count[1]); i += count[0].length; }
      /* Ein Vorgabewert für ein erstes Argument (`[x]`) — so bleibt der Befehl, wie er ist, für KaTeX. */
      if (/^\s*\[/.test(tex.slice(i))) continue;
    }
    const body = argAt(tex, i);
    if (body === null) continue;
    const value = kind === 'DeclareMathOperator' ? `\\operatorname${m[2] ?? ''}{${body.value}}` : body.value;
    if (args > 0 && !value.includes(`#${args}`)) continue;
    macros[name.value.trim()] = value;
    out += tex.slice(at, start);
    at = body.end;
  }
  out += tex.slice(at);
  return { tex: out, macros };
}

/* -- Für KaTeX ------------------------------------------------------------------------------------ */

/** Umgebungen, die in LaTeX selbst zählen — die Nummer steht im Buch als `\tag`, KaTeX zählte sonst ab 1. */
const COUNTED = /\\(begin|end)\{(equation|align|gather|alignat|flalign)\}/g;

/**
 * DER WZÓR, WIE KATEX IHN BEKOMMT: zählende Umgebungen ohne eigenes Zählen (die Nummer des Buches steht
 * in `\tag`), `multline` als `gather*`, `eqnarray` als Tabelle mit drei Spalten, Definitionen als Makra.
 */
export function prepareTex(tex: string): { tex: string; macros: Record<string, string> } {
  const hoisted = hoistDefinitions(tex);
  const prepared = hoisted.tex
    .replace(COUNTED, '\\$1{$2*}')
    .replace(/\\(begin|end)\{multline\*?\}/g, '\\$1{gather*}')
    .replace(/\\begin\{eqnarray\*?\}/g, '\\begin{array}{rcl}')
    .replace(/\\end\{eqnarray\*?\}/g, '\\end{array}');
  return { tex: prepared, macros: hoisted.macros };
}

/** Die Nummern eines Wzór, wie sie dastehen: `\tag{2.4}` → „(2.4)", `\tag*{A}` → „A". */
export function texTags(tex: string): string[] {
  const out: string[] = [];
  for (const m of tex.matchAll(/\\tag(\*?)\s*\{/g)) {
    const open = m.index! + m[0].length - 1;
    const end = braceEnd(tex, open);
    if (end < 0) continue;
    const inner = tex.slice(open + 1, end - 1).trim();
    if (inner !== '') out.push(m[1] === '*' ? inner : `(${inner})`);
  }
  return out;
}

/* -- Ausbessern beim Import ---------------------------------------------------------------------- */

/**
 * Die Steuerwörter von KaTeX, die mit einem Buchstaben beginnen, den JSON als Escape liest
 * (`\b \f \n \r \t \u`). Aus KaTeX 0.19 gezogen; was hier steht, ist ein Befehl und kein Zeilenwechsel.
 */
export const JSON_ESCAPE_WORDS: ReadonlySet<string> = new Set([
  'backepsilon', 'backprime', 'backsim', 'backsimeq', 'backslash', 'bar', 'barwedge', 'bcancel', 'because', 'begin', 'begingroup', 'beta', 'beth', 'between', 'bf', 'bgroup', 'big', 'bigcap', 'bigcirc', 'bigcup', 'bigg', 'biggl', 'biggm', 'biggr', 'bigl', 'bigm', 'bigodot', 'bigoplus', 'bigotimes', 'bigr', 'bigsqcup', 'bigstar', 'bigtriangledown', 'bigtriangleup', 'biguplus', 'bigvee', 'bigwedge', 'binom', 'blacklozenge', 'blacksquare', 'blacktriangle', 'blacktriangledown', 'blacktriangleleft', 'blacktriangleright', 'bm', 'bmod', 'bold', 'boldsymbol', 'bot', 'bowtie', 'boxdot', 'boxed', 'boxminus', 'boxplus', 'boxtimes', 'bra', 'brace', 'brack', 'braket', 'breve', 'bull', 'bullet', 'bumpeq',
  'fallingdotseq', 'fbox', 'fcolorbox', 'flat', 'footnotesize', 'forall', 'frac', 'frak', 'frown',
  'nLeftarrow', 'nLeftrightarrow', 'nRightarrow', 'nVDash', 'nVdash', 'nabla', 'natnums', 'natural', 'ncong', 'ne', 'nearrow', 'neg', 'negmedspace', 'negthickspace', 'negthinspace', 'neq', 'newcommand', 'newline', 'nexists', 'ngeq', 'ngeqq', 'ngeqslant', 'ngtr', 'ni', 'nleftarrow', 'nleftrightarrow', 'nleq', 'nleqq', 'nleqslant', 'nless', 'nmid', 'nobreak', 'nolimits', 'nonumber', 'normalsize', 'not', 'notag', 'notin', 'notni', 'nparallel', 'nprec', 'npreceq', 'nrightarrow', 'nshortmid', 'nshortparallel', 'nsim', 'nsubseteq', 'nsubseteqq', 'nsucc', 'nsucceq', 'nsupseteq', 'nsupseteqq', 'ntriangleleft', 'ntrianglelefteq', 'ntriangleright', 'ntrianglerighteq', 'nu', 'nvDash', 'nvdash', 'nwarrow',
  'rVert', 'raisebox', 'rang', 'rangle', 'rarr', 'ratio', 'rbrace', 'rbrack', 'rceil', 'real', 'reals', 'reflectbox', 'relax', 'renewcommand', 'restriction', 'rfloor', 'rgroup', 'rhd', 'rho', 'right', 'rightarrow', 'rightarrowtail', 'rightharpoondown', 'rightharpoonup', 'rightleftarrows', 'rightleftharpoons', 'rightrightarrows', 'rightsquigarrow', 'rightthreetimes', 'risingdotseq', 'rlap', 'rm', 'rmoustache', 'rparen', 'rrbracket', 'rtimes', 'rule', 'rvert',
  'tag', 'tan', 'tanh', 'tau', 'tbinom', 'text', 'textbf', 'textcircled', 'textcolor', 'textit', 'textmd', 'textnormal', 'textrm', 'textsf', 'textstyle', 'texttt', 'textup', 'tfrac', 'tg', 'therefore', 'theta', 'thetasym', 'thickapprox', 'thicksim', 'thickspace', 'thinspace', 'tilde', 'times', 'tiny', 'to', 'top', 'triangle', 'triangledown', 'triangleleft', 'trianglelefteq', 'triangleq', 'triangleright', 'trianglerighteq', 'tt', 'twoheadleftarrow', 'twoheadrightarrow',
  'uArr', 'uarr', 'ulcorner', 'underbar', 'underbrace', 'underbracket', 'undergroup', 'underleftarrow', 'underleftrightarrow', 'underline', 'underrightarrow', 'underset', 'unlhd', 'unrhd', 'uparrow', 'updownarrow', 'upharpoonleft', 'upharpoonright', 'uplus', 'upsilon', 'upuparrows', 'urcorner', 'url', 'utilde'
]);

/** Was JSON aus `\x` gemacht hat — das Zeichen und der Buchstabe, für den es stand. */
const CONTROL: Readonly<Record<string, string>> = { '\b': 'b', '\f': 'f', '\n': 'n', '\r': 'r', '\t': 't' };

const NO_WORDS: ReadonlySet<string> = new Set();

/** Die Namen der Makra ohne Backslash (`\tr` → „tr") — für `repairTexText`. */
export const macroWords = (macros: TexMacros): Set<string> => new Set(Object.keys(macros).map((name) => name.replace(/^\\/, '')));

export type TexFix = 'escape' | 'delimiter' | 'environment' | 'double' | 'definition' | 'display' | 'page';

export interface TexRepair {
  readonly text: string;
  readonly fixes: Readonly<Partial<Record<TexFix, number>>>;
  /** Definitionen aus den Wzory — sie gelten für den ganzen Text (`edition.macros`). */
  readonly macros: Readonly<Record<string, string>>;
}

/** Umgebungen, die für sich stehen — nackt im Text bekommen sie ihre `$$`. */
const DISPLAY_ENV = /\\begin\{(equation\*?|align\*?|gather\*?|alignat\*?|flalign\*?|multline\*?|eqnarray\*?|CD)\}/;

/** Ist das Zeichen bei `i` ein Backslash, der selbst nicht entwertet ist? */
const liveBackslash = (text: string, i: number): boolean => {
  if (text[i] !== '\\') return false;
  let n = 0;
  for (let j = i - 1; j >= 0 && text[j] === '\\'; j -= 1) n += 1;
  return n % 2 === 0;
};

/** `\(…\)` → `$…$`, `\[…\]` → `$$…$$`, eine nackte Umgebung → `$$…$$` (ausserhalb der Wzory). */
function delimiters(text: string, fix: (kind: TexFix) => void, known: (word: string) => boolean): string {
  /* Ein Wzór, der mit einem verdorbenen Befehl beginnt (`$\theta$` → `$` + Tabulator + „heta$"): erst das, sonst ist es kein Wzór. */
  text = text.replace(/(\${1,2})([\t\r\n])([A-Za-z]{1,30})/g, (all, open: string, c: string, run: string) => {
    const word = CONTROL[c]! + run;
    if (!known(word) || (open === '$$' && c === '\n' && word.length < 3)) return all;
    fix('escape');
    return `${open}\\${word}`;
  });
  if (!text.includes('\\(') && !text.includes('\\[') && !text.includes('\\begin')) return text;
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!;
    if (c === '\\' && text[i + 1] === '$') { out += '\\$'; i += 1; continue; }
    if (c === '$') {
      const m = mathAt(text, i);
      if (m !== null) { out += text.slice(i, m.end); i = m.end - 1; continue; }
    }
    if (c === '\\' && liveBackslash(text, i) && (text[i + 1] === '(' || text[i + 1] === '[')) {
      const close = text[i + 1] === '(' ? '\\)' : '\\]';
      let j = text.indexOf(close, i + 2);
      while (j >= 0 && !liveBackslash(text, j)) j = text.indexOf(close, j + 1);
      if (j > i + 2) {
        const inline = text[i + 1] === '(';
        const tex = controls(text.slice(i + 2, j), !inline, fix, known);
        out += inline ? `$${tex.trim()}$` : `$$${tex}$$`;
        fix('delimiter');
        i = j + 1;
        continue;
      }
    }
    if (c === '\\' && text.startsWith('\\begin{', i)) {
      const env = DISPLAY_ENV.exec(text.slice(i, i + 40));
      if (env !== null && env.index === 0) {
        const endTag = `\\end{${env[1]}}`;
        const j = text.indexOf(endTag, i);
        if (j > i) {
          out += `$$${text.slice(i, j + endTag.length)}$$`;
          fix('environment');
          i = j + endTag.length - 1;
          continue;
        }
      }
    }
    out += c;
  }
  return out;
}

/**
 * EIN STEUERZEICHEN STATT EINES BACKSLASH (`\frac` → Seitenvorschub + „rac"). `\b` und `\f` stehen in
 * keinem Text — sie werden immer wieder `\b`, `\f`. Tabulator, Zeilenwechsel, Wagenrücklauf nur, wenn
 * Buchstabe und Folge einen Befehl ergeben (`\t`+„heta", `\n`+„abla") und — bei `\n` in einem Wzór für
 * sich — der Zeilenwechsel nicht dort steht, wo man Zeilen bricht (nach `\\`, `&`, am Anfang).
 */
function controls(tex: string, display: boolean, fix: (kind: TexFix) => void, known: (word: string) => boolean): string {
  if (!/[\b\f\n\r\t]/.test(tex)) return tex;
  let out = '';
  for (let i = 0; i < tex.length; i += 1) {
    const c = tex[i]!;
    const letter = CONTROL[c];
    if (letter === undefined) { out += c; continue; }
    if (c === '\b' || c === '\f') { out += `\\${letter}`; fix('escape'); continue; }
    const run = /^[A-Za-z]+/.exec(tex.slice(i + 1, i + 40))?.[0] ?? '';
    const word = letter + run;
    let take = run !== '' && known(word);
    /* „\nu", „\ne", „\ni" gegen einen echten Zeilenwechsel vor u, e, i: im Wzór für sich nur mitten in einer Zeile. */
    if (take && c === '\n' && display && word.length < 3) {
      const before = out.replace(/[ \t]+$/, '');
      if (before === '' || before.endsWith('\\\\') || before.endsWith('&') || /\\(?:begin|end)\{[^}]*\}$/.test(before)) take = false;
    }
    if (take) { out += `\\${letter}`; fix('escape'); } else out += c;
  }
  return out;
}

/** Jeder Backslash doppelt (`\\frac{a}{b}` — zweimal entwertet): halbiert, wenn KEIN Befehl einfach dasteht. */
function doubled(tex: string, fix: (kind: TexFix) => void): string {
  if (!tex.includes('\\\\')) return tex;
  const words = [...tex.matchAll(/(\\+)([A-Za-z]{2,})/g)];
  if (words.length === 0 || words.some((m) => m[1]!.length % 2 === 1)) return tex;
  fix('double');
  return tex.replace(/\\\\/g, '\\');
}

const MARK_IN_TEX = /\{\{\s*page\s+[^{}]*\}\}/g;

/**
 * Ein Text, wie er gespeichert wird: Begrenzer, Escapes, doppelte Backslashes, Definitionen,
 * ein Seitenwechsel, der im Wzór stand (er kommt hinter ihn), `\tag` in einem Wzór im Satz (er
 * wird ein Wzór für sich). Nichts am Wortlaut, nichts an den Wzory selbst ausser dem Genannten.
 */
export function repairTexText(text: string, words: ReadonlySet<string> = NO_WORDS): TexRepair {
  /* Befehl ist, was KaTeX kennt — und die Makra des Textes (`\tr`, `\norm`): auch ihr `\t`, `\n` verdirbt JSON. */
  const known = (word: string) => JSON_ESCAPE_WORDS.has(word) || words.has(word);
  const fixes: Partial<Record<TexFix, number>> = {};
  const fix = (kind: TexFix) => { fixes[kind] = (fixes[kind] ?? 0) + 1; };
  const macros: Record<string, string> = {};
  let source = text;
  /* `\b`, `\f` ausserhalb eines Wzór — kein Text enthält sie; ein Befehl, dem sein Dollar fehlt. */
  if (/[\b\f]/.test(source)) source = source.replace(/[\b\f]/g, (c) => { fix('escape'); return `\\${CONTROL[c]}`; });
  source = delimiters(source, fix, known);
  if (!source.includes('$')) return { text: source, fixes, macros };
  let out = '';
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i]!;
    if (c === '\\' && source[i + 1] === '$') { out += '\\$'; i += 1; continue; }
    const m = c === '$' ? mathAt(source, i) : null;
    if (m === null) { out += c; continue; }
    let tex = doubled(controls(m.tex, m.display, fix, known), fix);
    const hoisted = hoistDefinitions(tex);
    if (Object.keys(hoisted.macros).length > 0) { Object.assign(macros, hoisted.macros); tex = hoisted.tex; fix('definition'); }
    const marks = tex.match(MARK_IN_TEX) ?? [];
    if (marks.length > 0) { tex = tex.replace(MARK_IN_TEX, ' '); fix('page'); }
    let display = m.display;
    if (!display && (/\\tag\b/.test(tex) || DISPLAY_ENV.test(tex))) { display = true; fix('display'); }
    if (tex.trim() !== '') out += texSource(display ? tex : tex.trim(), display);
    out += marks.join('');
    i = m.end - 1;
  }
  return { text: out, fixes, macros };
}

/** Was ausgebessert wurde, in Worten (für die Hinweise des Imports). */
export const TEX_FIX_SAYS: Readonly<Record<TexFix, string>> = {
  escape: 'pojedynczy \\ zapisany w JSON jako znak sterujący (np. \\f w \\frac) — przywrócony',
  delimiter: '\\( … \\) i \\[ … \\] zamienione na $ … $ i $$ … $$',
  environment: 'samodzielne środowisko (\\begin{align} …) ujęte w $$ … $$',
  double: 'podwójne ukośniki we wzorze (\\\\frac) — zmniejszone do pojedynczych',
  definition: 'definicje (\\newcommand, \\DeclareMathOperator) przeniesione do makr tekstu',
  display: 'wzór z \\tag albo środowiskiem w zdaniu — wyświetlony osobno',
  page: 'granica strony ze środka wzoru — przeniesiona za wzór'
};

/* -- Als Text, ohne KaTeX -------------------------------------------------------------------------- */

const SYMBOLS: Readonly<Record<string, string>> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ',
  chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', iiint: '∭', oint: '∮', partial: '∂', nabla: '∇', infty: '∞', pm: '±', mp: '∓', times: '×', div: '÷',
  cdot: '·', cdots: '⋯', ldots: '…', dots: '…', vdots: '⋮', ddots: '⋱', circ: '∘', bullet: '•', star: '⋆', ast: '∗', oplus: '⊕', otimes: '⊗', odot: '⊙',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', equiv: '≡', sim: '∼', simeq: '≃', cong: '≅', propto: '∝', ll: '≪', gg: '≫', prec: '≺', succ: '≻',
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', subseteq: '⊆', supset: '⊃', supseteq: '⊇', cup: '∪', cap: '∩', setminus: '∖', emptyset: '∅', varnothing: '∅',
  bigcup: '⋃', bigcap: '⋂', to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔', Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', implies: '⇒', iff: '⇔',
  mapsto: '↦', longrightarrow: '⟶', longmapsto: '⟼', uparrow: '↑', downarrow: '↓', forall: '∀', exists: '∃', nexists: '∄', neg: '¬', lnot: '¬', land: '∧', wedge: '∧',
  lor: '∨', vee: '∨', perp: '⊥', parallel: '∥', mid: '∣', angle: '∠', triangle: '△', square: '□', blacksquare: '■', aleph: 'ℵ', hbar: 'ℏ', ell: 'ℓ', wp: '℘', Re: 'ℜ', Im: 'ℑ',
  prime: '′', langle: '⟨', rangle: '⟩', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', vert: '|', lvert: '|', rvert: '|', Vert: '‖', lVert: '‖', rVert: '‖',
  quad: ' ', qquad: ' ', colon: ':', therefore: '∴', because: '∵', top: '⊤', bot: '⊥', vdash: '⊢', models: '⊨', dagger: '†', degree: '°'
};
const DOUBLE_STRUCK: Readonly<Record<string, string>> = { N: 'ℕ', Z: 'ℤ', Q: 'ℚ', R: 'ℝ', C: 'ℂ', P: 'ℙ', H: 'ℍ', F: '𝔽', K: '𝕂', E: '𝔼', '1': '𝟙' };
const SUP: Readonly<Record<string, string>> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', '*': '*', '′': '′' };
const SUB: Readonly<Record<string, string>> = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎' };

/** Was ohne Klammern Zähler oder Nenner sein kann: eine Zahl, ein Wort, ein Befehl (`\pi`). */
const ATOM = /^(?:[\w.]+|\\[A-Za-z]+)$/;

const scripted = (body: string, table: Readonly<Record<string, string>>, mark: string): string =>
  [...body].every((c) => table[c] !== undefined) ? [...body].map((c) => table[c]).join('') : `${mark}${body.length > 1 ? `(${body})` : body}`;

/**
 * EIN WZÓR ALS ZEILE TEXT — für die Suche, für Ausschnitte, für Stellen, an denen kein KaTeX zeichnet:
 * Symbole als Zeichen (α, ∫, ≤, ℝ), Brüche mit Schrägstrich, Hoch- und Tiefzahlen, wo es sie gibt.
 * Kein Satz — eine Annäherung, die man lesen und finden kann.
 */
export function texPlain(tex: string): string {
  /* Geschweifte Klammern, die man sieht (`\{`, `\}`), bis zum Schluss beiseite — die anderen fallen weg. */
  let s = prepareTex(tex).tex.replace(/\\\{/g, '\u0001').replace(/\\\}/g, '\u0002');
  s = s.replace(/(^|[^\\])%[^\n]*/g, '$1 ');
  s = s.replace(/\\(?:begin|end)\{[^}]*\}(?:\{[^}]*\})?/g, ' ');
  s = s.replace(/\\(?:left|right|bigl|bigr|Bigl|Bigr|biggl|biggr|Biggl|Biggr|big|Big|bigg|Bigg|middle)(?![A-Za-z])\s*/g, '');
  s = s.replace(/\\(?:displaystyle|textstyle|scriptstyle|limits|nolimits|notag|nonumber|label\{[^}]*\})(?![A-Za-z])/g, ' ');
  s = s.replace(/\\tag\*?\{([^}]*)\}/g, ' ($1)');
  s = s.replace(/\\(?:,|;|:|!|>| )/g, ' ').replace(/~/g, ' ');
  for (let guard = 0; guard < 6; guard += 1) {
    const before = s;
    s = s.replace(/\\mathbb\{([A-Z1])\}/g, (_, c: string) => DOUBLE_STRUCK[c] ?? c);
    s = s.replace(/\\(?:text|textrm|textit|textbf|textsf|texttt|textup|textnormal|mathrm|mathit|mathbf|mathsf|mathtt|mathcal|mathscr|mathfrak|mathbb|boldsymbol|bm|operatorname\*?|mbox|emph|hat|widehat|bar|overline|tilde|widetilde|vec|dot|ddot|underline|pmb)\{([^{}]*)\}/g, '$1');
    s = s.replace(/\\[dtc]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a: string, b: string) => `${ATOM.test(a.trim()) ? a.trim() : `(${a.trim()})`}/${ATOM.test(b.trim()) ? b.trim() : `(${b.trim()})`}`);
    s = s.replace(/\\binom\{([^{}]*)\}\{([^{}]*)\}/g, '($1 nad $2)');
    s = s.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, (_, n: string, x: string) => `${scripted(n, SUP, '^')}√(${x})`);
    s = s.replace(/\\sqrt\{([^{}]*)\}/g, (_, x: string) => (/^\w$/.test(x) ? `√${x}` : `√(${x})`));
    s = s.replace(/\^\{([^{}]*)\}/g, (_, x: string) => scripted(x, SUP, '^'));
    s = s.replace(/_\{([^{}]*)\}/g, (_, x: string) => scripted(x, SUB, '_'));
    if (s === before) break;
  }
  s = s.replace(/\^([0-9a-zA-Z+\-*′])/g, (_, x: string) => scripted(x, SUP, '^'));
  s = s.replace(/_([0-9a-zA-Z])/g, (_, x: string) => scripted(x, SUB, '_'));
  s = s.replace(/\\([A-Za-z]+)/g, (_, name: string) => SYMBOLS[name] ?? name);
  s = s.replace(/\\\\/g, '; ').replace(/(^|[^\\])&/g, '$1 ').replace(/\\([$%#_&])/g, '$1').replace(/[{}]/g, '').replace(/\\(?=[^A-Za-z]|$)/g, '');
  return s.replace(/\u0001/g, '{').replace(/\u0002/g, '}').replace(/\s+/g, ' ').trim();
}

/** Ein Text mit Wzory als eine Zeile ohne LaTeX (die Wzory über `texPlain`). */
export const plainWithTex = (text: string): string =>
  texPieces(text).map((p) => (p.t === 'text' ? p.v : ` ${texPlain(p.tex)} `)).join('').replace(/[ \t]+/g, ' ').trim();
