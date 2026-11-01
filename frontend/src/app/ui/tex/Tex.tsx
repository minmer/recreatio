/**
 * 2026-11-01 — EIN WZÓR AUF DEM SCHIRM.
 *
 * <code>
 *   &lt;Tex tex="x^2" /&gt;                      ein Wzór im Satz
 *   &lt;Tex tex="\int f" display /&gt;           für sich, in eigener Zeile (zu breit: er rollt seitwärts, die Seite nicht)
 *   &lt;TexText text="Gdy $x &gt; 0$ …" /&gt;      ein Text, dessen Wzory gesetzt werden
 *   &lt;TexMacrosContext.Provider value={…}&gt; die Makra eines Buches für alles darunter
 * </code>
 *
 * KaTeX (300 kB) kommt erst, wenn ein Wzór zu sehen ist — eine Seite ohne Wzór lädt es nie. Bis dahin,
 * und wenn es nicht kommt (ohne Netz) oder ein Wzór sich nicht setzen lässt, steht sein LaTeX da: nichts
 * geht verloren, und ein Fehler sagt im Titel, was KaTeX meint.
 *
 * <b>Auswählen und Kopieren:</b> ein Wzór trägt sein LaTeX (`data-tex`). Wer Text mit Wzory kopiert,
 * bekommt sie als `$…$` (`selectedText`, beim Kopieren für die ganze App) — nicht die Glyphen von KaTeX.
 */

import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from 'react';

import { texPieces, texSource, type TexMacros, type TexPiece } from '../../core/tex';
import './tex.css';

type Api = typeof import('./katexStyled');

let api: Api | null = null;
let failed = false;
let loading: Promise<Api | null> | null = null;
const waiting = new Set<() => void>();

/** KaTeX holen (einmal); `null`, wenn es nicht geht — der nächste Versuch kommt beim nächsten Wzór. */
export function loadTex(): Promise<Api | null> {
  if (api !== null) return Promise.resolve(api);
  loading ??= import('./katexStyled')
    .then((m) => {
      api = m;
      failed = false;
      if (typeof document !== 'undefined') document.addEventListener('copy', copyWithTex);
      return m;
    }, () => {
      failed = true;
      loading = null;
      return null;
    })
    .finally(() => { for (const wake of [...waiting]) wake(); });
  return loading;
}

/** KaTeX, sobald es da ist: `undefined` — es lädt; `null` — es geht nicht. `want = false`: nicht laden. */
export function useTexApi(want = true): Api | null | undefined {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!want || api !== null) return undefined;
    const wake = () => setTick((n) => n + 1);
    waiting.add(wake);
    void loadTex();
    return () => { waiting.delete(wake); };
  }, [want]);
  return api ?? (failed ? null : undefined);
}

/** Die Makra eines Buches (`edition.macros`) für jeden Wzór darunter. */
export const TexMacrosContext = createContext<TexMacros>({});

export function Tex({ tex, display = false }: { tex: string; display?: boolean }) {
  const macros = useContext(TexMacrosContext);
  const katex = useTexApi();
  const cls = display ? 'tex is-display' : 'tex';
  const mark = display ? '1' : undefined;
  if (katex === undefined || katex === null) return <code className={`${cls} tex-src`} data-tex={tex} data-display={mark}>{texSource(tex, display)}</code>;
  const out = katex.renderTex(tex, display, macros);
  if ('error' in out) return <code className={`${cls} tex-src is-error`} data-tex={tex} data-display={mark} title={`Tego wzoru nie da się złożyć: ${out.error}`}>{texSource(tex, display)}</code>;
  return <span className={cls} data-tex={tex} data-display={mark} dangerouslySetInnerHTML={{ __html: out.html }} />;
}

/** Satzzeichen, die an einem Wzór im Satz hängen bleiben (kein Zeilenumbruch zwischen „ℝⁿ" und „,"). */
const PUNCT = /^[,.;:!?…)\]}”’»"'%]+/;

export interface Glued<T> {
  readonly item: T;
  /** Die Satzzeichen, die mit dem Wzór `item` zusammen stehen ('' — keine). */
  readonly punct: string;
}

/**
 * Die Stücke eines Textes, ein Wzór im Satz mit den Satzzeichen, die ihm folgen. `math`: ist das Stück ein
 * Wzór im Satz? `text`: sein Text (oder `null`); `rest`: dasselbe Stück mit weniger Text.
 */
export function glue<T>(list: readonly T[], math: (x: T) => boolean, text: (x: T) => string | null, rest: (x: T, v: string) => T): Glued<T>[] {
  const out: Glued<T>[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const x = list[i]!;
    const next = list[i + 1];
    const t = next === undefined || !math(x) ? null : text(next);
    const m = t === null ? null : PUNCT.exec(t);
    if (m !== null && t !== null) {
      out.push({ item: x, punct: m[0] });
      if (t.length > m[0].length) out.push({ item: rest(next!, t.slice(m[0].length)), punct: '' });
      i += 1;
      continue;
    }
    out.push({ item: x, punct: '' });
  }
  return out;
}

/** Ein Wzór mit seinen Satzzeichen — oder er allein. */
export const Glue = ({ punct, children }: { punct: string; children: ReactNode }) =>
  punct === '' ? <>{children}</> : <span className="tex-glue">{children}{punct}</span>;

/** Ein Text, dessen Wzory gesetzt werden; der Rest bleibt Text. */
export function TexText({ text }: { text: string }) {
  const parts = glue(texPieces(text), (p) => p.t === 'math' && !p.display, (p) => (p.t === 'text' ? p.v : null), (p, v) => ({ ...p, v }) as TexPiece);
  return <>{parts.map(({ item: p, punct }, i) => (p.t === 'text' ? <Fragment key={i}>{p.v}</Fragment> : <Glue key={i} punct={punct}><Tex tex={p.tex} display={p.display} /></Glue>))}</>;
}

/* -- Auswählen, kopieren ---------------------------------------------------------------------------- */

const closestTex = (node: Node | null): Element | null => {
  const el = node === null ? null : node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return el?.closest('[data-tex]') ?? null;
};

const BLOCKS = new Set(['P', 'DIV', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'PRE', 'ASIDE', 'FIGURE', 'FIGCAPTION', 'SECTION', 'TABLE', 'UL', 'OL', 'HEADER']);

function textOf(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return '';
  const el = node.nodeType === Node.ELEMENT_NODE ? node as Element : null;
  if (el !== null) {
    const tex = el.getAttribute('data-tex');
    if (tex !== null) return texSource(tex, el.getAttribute('data-display') === '1');
    if (el.getAttribute('aria-hidden') === 'true') return '';
  }
  let out = '';
  node.childNodes.forEach((child) => { out += textOf(child); });
  if (el !== null && el.tagName === 'TD') return `${out}\t`;
  return el !== null && BLOCKS.has(el.tagName) ? `${out}\n` : out;
}

/** Steht ein Wzór in der Auswahl (oder beginnt, endet sie in einem)? */
export function selectionHasTex(sel: Selection | null): boolean {
  if (sel === null || sel.isCollapsed || sel.rangeCount === 0) return false;
  for (let r = 0; r < sel.rangeCount; r += 1) {
    const range = sel.getRangeAt(r);
    if (closestTex(range.startContainer) !== null || closestTex(range.endContainer) !== null) return true;
    if (range.cloneContents().querySelector('[data-tex]') !== null) return true;
  }
  return false;
}

/** Was in der Auswahl steht — ein Wzór als sein LaTeX ($…$), ganz, auch wenn die Auswahl in ihm beginnt oder endet. */
export function selectedText(sel: Selection | null): string {
  if (sel === null || sel.isCollapsed || sel.rangeCount === 0) return '';
  const out: string[] = [];
  for (let r = 0; r < sel.rangeCount; r += 1) {
    const range = sel.getRangeAt(r).cloneRange();
    const start = closestTex(range.startContainer);
    if (start !== null) range.setStartBefore(start);
    const end = closestTex(range.endContainer);
    if (end !== null) range.setEndAfter(end);
    out.push(textOf(range.cloneContents()));
  }
  return out.join(' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Beim Kopieren: steht ein Wzór in der Auswahl, kommt der Text mit LaTeX in die Zwischenablage. */
function copyWithTex(event: ClipboardEvent): void {
  const sel = window.getSelection();
  if (event.clipboardData === null || !selectionHasTex(sel)) return;
  const text = selectedText(sel);
  if (text === '') return;
  event.clipboardData.setData('text/plain', text);
  event.preventDefault();
}
