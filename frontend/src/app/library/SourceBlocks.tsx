/**
 * 2026-10-24 — DER TEXT EINES WERKS, GEZEICHNET: Blöcke in der Reihenfolge des Originals,
 * jede Stelle am Rand, Seitenwechsel dort, wo sie im Druck stehen (auch mitten im Absatz),
 * Fussnoten mit Sprung, Unsicheres und Fehlendes sichtbar markiert. Der Czytnik
 * (`SourceReader.tsx`) und der aufgeklappte Abschnitt unter einer Fussnote (`SourceJump.tsx`)
 * zeichnen mit denselben Bausteinen.
 *
 * 2026-11-01 — WZORY UND AUSSAGEN: ein Wzór wird gesetzt (KaTeX, `ui/tex/Tex.tsx` — erst geladen, wenn
 * einer zu sehen ist), ein Twierdzenie, eine Definicja, ein Dowód stehen in einem Kasten mit ihrem Kopf
 * („Twierdzenie 2.3 (o trzech ciągach)."), ein Beweis endet mit ∎. Gespeichert sind die Blöcke flach
 * (`in`); `SourceFlow` legt sie für die Zeichnung wieder ineinander — jeder Block behält seine Nummer
 * (`data-block`), so bleiben Auswahl, Treffer und Sprünge, wie sie waren. Ein Verweis `{{ref …}}` wird
 * ein Knopf, wenn der Czytnik sagt, wohin (`TextRefsContext`).
 */

import { createContext, Fragment, useContext, type MouseEvent, type ReactNode } from 'react';

import { Glue, glue, Tex, TexText } from '../ui/tex/Tex';
import { jump } from './markupView';
import { boxesOf, codeAsText, pieces, type Piece, type SourceBlock } from './sourceText';
import { statementKind } from './textLabels';

/** Wohin ein Verweis führt — der Czytnik weiss es (dieser Teil, ein anderer, nirgends). */
export interface TextRefs {
  readonly where: (label: string) => 'here' | 'there' | null;
  readonly open: (label: string) => void;
}
export const TextRefsContext = createContext<TextRefs | null>(null);

function RefLink({ label }: { label: string }) {
  const refs = useContext(TextRefsContext);
  const at = refs?.where(label) ?? null;
  if (refs === null || at === null) {
    return <span className="src-ref is-dead" title={refs === null ? undefined : 'Tego miejsca nie ma w zapisanym tekście'}><TexText text={label} /></span>;
  }
  return (
    <button type="button" className="src-ref" title={at === 'here' ? 'Pokaż w tekście' : 'Pokaż w tekście (w innej części)'} onClick={() => refs.open(label)}>
      <TexText text={label} />
    </button>
  );
}

/** Ein Text mit seinen Zeichen ({{page}}, {{note}}, {{?}}, {{gap}}, {{ref}}) und seinen Wzory. */
export function TextPieces({ text, prefix }: { text: string; prefix: string }) {
  /* Satzzeichen nach einem Wzór im Satz bleiben bei ihm (`glue`). */
  const parts = glue(pieces(text), (p) => p.t === 'math' && !p.display, (p) => (p.t === 'text' ? p.v : null), (p, v) => ({ ...p, v }) as Piece);
  return (
    <>
      {parts.map(({ item: p, punct }, i) => {
        switch (p.t) {
          case 'text': return <span key={i}>{p.v}</span>;
          case 'math': return <Glue key={i} punct={punct}><Tex tex={p.tex} display={p.display} /></Glue>;
          case 'ref': return <RefLink key={i} label={p.label} />;
          /* Zeichen am Rand und im Fluss stehen als `data-label` (CSS `::before`): sie gehören nicht zum markierten Text eines Zitats. */
          case 'page': return <span key={i} className="src-page" data-label={`s. ${p.page}`} role="note" aria-label={p.pdf === undefined ? `Początek strony ${p.page}` : `Początek strony ${p.page} (strona ${p.pdf} pliku PDF)`} title={p.pdf === undefined ? undefined : `PDF ${p.pdf}`} />;
          case 'note': return <sup key={i} className="src-noteref"><a href={`#${prefix}n-${p.id}`} data-label={p.id} aria-label={`Przypis ${p.id}`} onClick={(e: MouseEvent) => jump(e, `${prefix}n-${p.id}`)} /></sup>;
          case 'unsure': return <span key={i} className="src-unsure" title="Niepewny odczyt">{p.v === '' ? '?' : <TexText text={p.v} />}</span>;
          default: return <span key={i} className="src-gap" title="Brak w źródle albo pominięte">[…]</span>;
        }
      })}
    </>
  );
}

/** Kod: Zeichen für Zeichen — nur ein Seitenwechsel darin wird gezeichnet. */
function CodePieces({ text }: { text: string }) {
  return (
    <>
      {pieces(codeAsText(text)).map((p, i) => (p.t === 'page'
        ? <span key={i} className="src-page" data-label={`s. ${p.page}`} role="note" aria-label={`Początek strony ${p.page}`} />
        : <Fragment key={i}>{p.t === 'text' ? p.v.replace(/​/g, '') : ''}</Fragment>))}
    </>
  );
}

/** Der Kopf einer Aussage: „Twierdzenie 2.3 (o trzech ciągach)." */
function StatementHead({ block, prefix }: { block: SourceBlock; prefix: string }) {
  const label = block.label ?? statementKind(block.kind).label;
  const end = /[.:!?]$/.test(block.title ?? label) ? '' : '.';
  return (
    <p className="src-stmt-h">
      <strong>{label}</strong>
      {block.title !== undefined && block.title !== '' && <> <span className="src-stmt-title">(<TextPieces text={block.title} prefix={prefix} />)</span></>}
      {end}
    </p>
  );
}

/** Ein Block — `hit`: von der gesuchten Stelle getroffen. */
export function SourceBlockView({ block, index, prefix, hit = false }: { block: SourceBlock; index: number; prefix: string; hit?: boolean }) {
  const cls = `src-block is-${block.type}${hit ? ' is-hit' : ''}${block.uncertain === true ? ' is-uncertain' : ''}`;
  const loc = block.loc !== undefined && block.loc !== '' ? <span className="src-loc" data-label={block.loc} role="note" aria-label={`Miejsce: ${block.loc}`} /> : null;
  const body = (() => {
    switch (block.type) {
      case 'heading': {
        const H = `h${Math.min(6, (block.level ?? 1) + 2)}` as 'h3';
        return <H className="src-h"><TextPieces text={block.text ?? ''} prefix={prefix} /></H>;
      }
      case 'quote': return <blockquote className="src-text"><TextPieces text={block.text ?? ''} prefix={prefix} /></blockquote>;
      case 'list': {
        const L = block.ordered === true ? 'ol' : 'ul';
        return <L className="src-list">{(block.items ?? []).map((item, i) => <li key={i}><TextPieces text={item} prefix={prefix} /></li>)}</L>;
      }
      case 'table':
        return (
          <div className="src-table-wrap">
            <table className="src-table">
              {(block.label !== undefined || block.text !== undefined) && (
                <caption className="src-caption">
                  {block.label !== undefined && <strong>{block.label}{block.text === undefined ? '' : '.'}</strong>}
                  {block.text !== undefined && <> <TextPieces text={block.text} prefix={prefix} /></>}
                </caption>
              )}
              {(block.columns ?? []).length > 0 && <thead><tr>{block.columns!.map((c, i) => <th key={i}><TextPieces text={c} prefix={prefix} /></th>)}</tr></thead>}
              <tbody>{(block.rows ?? []).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}><TextPieces text={cell} prefix={prefix} /></td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      case 'note':
        return <aside className="src-note" id={`${prefix}n-${block.id ?? ''}`}><span className="src-note-id">{block.id}</span> <TextPieces text={block.text ?? ''} prefix={prefix} /></aside>;
      case 'page':
        return <p className="src-pagebreak">s. {block.page}{block.pdf === undefined ? '' : ` · PDF ${block.pdf}`}</p>;
      case 'statement':
        return <StatementHead block={block} prefix={prefix} />;
      case 'figure':
        return (
          <figure className="src-figure">
            <div className="src-figure-art" role="img" aria-label={block.alt ?? block.text ?? block.label ?? 'Rysunek'}>
              <span className="src-figure-mark">Rysunek w źródle</span>
              {block.alt !== undefined && <span className="src-figure-alt"><TextPieces text={block.alt} prefix={prefix} /></span>}
            </div>
            {(block.label !== undefined || block.text !== undefined) && (
              <figcaption className="src-caption">
                {block.label !== undefined && <strong>{block.label}{block.text === undefined ? '' : '.'}</strong>}
                {block.text !== undefined && <> <TextPieces text={block.text} prefix={prefix} /></>}
              </figcaption>
            )}
          </figure>
        );
      case 'code':
        return <pre className="src-code" data-lang={block.lang}><code><CodePieces text={block.text ?? ''} /></code></pre>;
      default:
        return <p className="src-text"><TextPieces text={block.text ?? ''} prefix={prefix} /></p>;
    }
  })();
  return (
    <div className={cls} data-block={index} id={`${prefix}b-${index}`}>
      {loc}
      {body}
      {block.uncertain === true && <span className="src-flag" data-label="niepewny odczyt" role="note" aria-label="Niepewny odczyt" />}
    </div>
  );
}

/* -- Die Blöcke, in ihre Aussagen gelegt ---------------------------------------------------------- */

type FlowNode = { readonly t: 'block'; readonly i: number } | { readonly t: 'box'; readonly id: string; readonly head: number | undefined; readonly children: FlowNode[] };

/** Die gezeigten Blöcke (in ihrer Reihenfolge) als Baum: jede Aussage ein Kasten um ihren Kopf und ihren Inhalt. */
function flowTree(blocks: readonly SourceBlock[], shown: readonly number[]): FlowNode[] {
  const chains = boxesOf(blocks);
  const heads = new Map<string, number>();
  blocks.forEach((b, i) => { if (b.type === 'statement' && b.id !== undefined) heads.set(b.id, i); });
  const root: FlowNode[] = [];
  const stack: { id: string; children: FlowNode[] }[] = [];
  for (const i of shown) {
    const chain = chains[i] ?? [];
    let k = 0;
    while (k < stack.length && k < chain.length && stack[k]!.id === chain[k]) k += 1;
    stack.length = k;
    for (let j = k; j < chain.length; j += 1) {
      const node: FlowNode = { t: 'box', id: chain[j]!, head: heads.get(chain[j]!), children: [] };
      (stack.length > 0 ? stack[stack.length - 1]!.children : root).push(node);
      stack.push({ id: node.id, children: node.children });
    }
    (stack.length > 0 ? stack[stack.length - 1]!.children : root).push({ t: 'block', i });
  }
  return root;
}

/** Steht am Ende schon ein Zeichen für das Ende eines Beweises (□, ∎, c.n.d., `\qed`)? Dann kein zweites. */
const ENDS_ITSELF = /(?:[□∎■◻◼]|c\.\s?n\.\s?d\.?|c\.\s?b\.\s?d\.\s?u\.?|q\.\s?e\.\s?d\.?|\\(?:qed|qedhere|square|blacksquare|Box)\b[^$]*\$+)\s*$/i;

/**
 * DER TEXT, WIE ER DASTEHT: die Blöcke `shown` (alle, wenn nicht genannt) in ihren Aussagen. `indexOf` —
 * die Nummer, die ein Block im Dokument trägt (die zweite Ausgabe daneben zählt negativ).
 */
export function SourceFlow({ blocks, shown, prefix, hits, indexOf = (i: number) => i }: {
  blocks: readonly SourceBlock[];
  shown?: readonly number[];
  prefix: string;
  hits?: ReadonlySet<number>;
  indexOf?: (i: number) => number;
}) {
  const visible = shown ?? blocks.map((_, i) => i);
  const seen = new Set(visible);
  const lastOf = new Map<string, number>();
  boxesOf(blocks).forEach((chain, i) => { for (const id of chain) lastOf.set(id, i); });
  const draw = (nodes: readonly FlowNode[]): ReactNode[] => nodes.map((node) => {
    if (node.t === 'block') return <SourceBlockView key={node.i} block={blocks[node.i]!} index={indexOf(node.i)} prefix={prefix} hit={hits?.has(node.i) ?? false} />;
    const head = node.head === undefined ? undefined : blocks[node.head];
    const kind = statementKind(head?.kind);
    const last = lastOf.get(node.id);
    const lastText = last === undefined ? '' : (blocks[last]?.text ?? blocks[last]?.items?.slice(-1)[0] ?? '');
    const qed = kind.group === 'proof' && last !== undefined && seen.has(last) && !ENDS_ITSELF.test(lastText.trim());
    return (
      <div key={`box-${node.id}`} className={`src-box is-${kind.group} kind-${kind.id}`} data-box={node.id}>
        {draw(node.children)}
        {qed && <span className="src-qed" role="note" aria-label="Koniec dowodu">∎</span>}
      </div>
    );
  });
  return <>{draw(flowTree(blocks, visible))}</>;
}

