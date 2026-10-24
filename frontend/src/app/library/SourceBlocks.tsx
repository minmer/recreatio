/**
 * 2026-10-24 — DER TEXT EINES WERKS, GEZEICHNET: Blöcke in der Reihenfolge des Originals,
 * jede Stelle am Rand, Seitenwechsel dort, wo sie im Druck stehen (auch mitten im Absatz),
 * Fussnoten mit Sprung, Unsicheres und Fehlendes sichtbar markiert. Der Czytnik
 * (`SourceReader.tsx`) und der aufgeklappte Abschnitt unter einer Fussnote (`SourceJump.tsx`)
 * zeichnen mit denselben Bausteinen.
 */

import type { MouseEvent } from 'react';

import { jump } from './markupView';
import { pieces, type SourceBlock } from './sourceText';

/** Ein Text mit seinen Zeichen ({{page}}, {{note}}, {{?}}, {{gap}}). */
export function TextPieces({ text, prefix }: { text: string; prefix: string }) {
  return (
    <>
      {pieces(text).map((p, i) => {
        switch (p.t) {
          case 'text': return <span key={i}>{p.v}</span>;
          /* Zeichen am Rand und im Fluss stehen als `data-label` (CSS `::before`): sie gehören nicht zum markierten Text eines Zitats. */
          case 'page': return <span key={i} className="src-page" data-label={`s. ${p.page}`} role="note" aria-label={p.pdf === undefined ? `Początek strony ${p.page}` : `Początek strony ${p.page} (strona ${p.pdf} pliku PDF)`} title={p.pdf === undefined ? undefined : `PDF ${p.pdf}`} />;
          case 'note': return <sup key={i} className="src-noteref"><a href={`#${prefix}n-${p.id}`} data-label={p.id} aria-label={`Przypis ${p.id}`} onClick={(e: MouseEvent) => jump(e, `${prefix}n-${p.id}`)} /></sup>;
          case 'unsure': return <span key={i} className="src-unsure" title="Niepewny odczyt">{p.v === '' ? '?' : p.v}</span>;
          default: return <span key={i} className="src-gap" title="Brak w źródle albo pominięte">[…]</span>;
        }
      })}
    </>
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
              {(block.columns ?? []).length > 0 && <thead><tr>{block.columns!.map((c, i) => <th key={i}><TextPieces text={c} prefix={prefix} /></th>)}</tr></thead>}
              <tbody>{(block.rows ?? []).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}><TextPieces text={cell} prefix={prefix} /></td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      case 'note':
        return <aside className="src-note" id={`${prefix}n-${block.id ?? ''}`}><span className="src-note-id">{block.id}</span> <TextPieces text={block.text ?? ''} prefix={prefix} /></aside>;
      case 'page':
        return <p className="src-pagebreak">s. {block.page}{block.pdf === undefined ? '' : ` · PDF ${block.pdf}`}</p>;
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
