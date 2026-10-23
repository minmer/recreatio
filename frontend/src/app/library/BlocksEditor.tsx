/**
 * TREŚĆ W BLOKACH, GESCHRIEBEN (2026-10-22; seit 2026-10-23 der Editor des
 * Feldtyps `blocks`, gleich in welchem Rodzaj) — vier Formen: Absatz,
 * nummerierte Liste, Liste, Tabelle.
 *
 * Ein Listenpunkt und eine Tabellenzelle sind Folgen von Stücken: Text (im
 * Zapis, mit Fussnoten) und echte Verweise (ein Eintrag und eine Stelle) —
 * kein Text, der wie ein Verweis aussieht. Welche Einträge ein Verweis wählen
 * kann, sagt der, der den Editor zeigt (`Picker`): in Nauka ein Eintrag der
 * Baza oder eine Quelle der Bibliothek.
 */

import { useState, type ReactNode } from 'react';

import { BLOCK_TYPES, type Cell, type CommentBlock, type Run } from './blocks';

type BlockType = CommentBlock['type'];

/** Was ein Verweis zeigt — sein Name, und ob dieser Leser ihn lesen kann. */
export type RefShown = (ref: string) => { readonly text: string; readonly readable: boolean };

/** Die Wahl eines Verweises — gibt eine Kennung (oder bricht ab). */
export type RefPickerSlot = (props: { readonly onPick: (id: string) => void; readonly onCancel: () => void }) => ReactNode;

/** Was aus einem Baustein wird, wenn man seine Form wechselt — nichts geht verloren. */
function convert(block: CommentBlock, to: BlockType): CommentBlock {
  if (block.type === to) return block;
  const cells: Cell[] = block.type === 'paragraph' ? block.text.split(/\n+/).filter((l) => l.trim() !== '').map((text) => [{ text }])
    : block.type === 'table' ? block.rows.map((row) => row.flat())
    : [...block.items];
  if (to === 'paragraph') {
    return { type: 'paragraph', text: cells.map((cell) => cell.map((run) => ('text' in run ? run.text : '')).join('')).filter(Boolean).join('\n\n') };
  }
  if (to === 'table') return { type: 'table', columns: block.type === 'table' ? block.columns : ['', ''], rows: cells.map((cell) => [cell, []]) };
  return { type: to, items: cells.length > 0 ? cells : [[{ text: '' }]] };
}

const fresh = (type: BlockType): CommentBlock => (type === 'paragraph' ? { type, text: '' }
  : type === 'table' ? { type, columns: ['', ''], rows: [[[], []]] }
  : { type, items: [[{ text: '' }]] });

export function BlocksEditor({ blocks, readOnly, onChange, shown, Picker }: {
  blocks: readonly CommentBlock[];
  readOnly: boolean;
  onChange: (next: CommentBlock[]) => void;
  shown: RefShown;
  Picker: RefPickerSlot;
}) {
  const swap = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };
  return (
    <div className="lib-cm-part" data-blocks-editor="">
      {blocks.map((block, i) => (
        <div key={i} className="lib-cm-block">
          <div className="lib-cm-block-bar">
            <select value={block.type} disabled={readOnly} aria-label="Forma bloku" onChange={(e) => onChange(blocks.map((b, j) => (j === i ? convert(b, e.target.value as BlockType) : b)))}>
              {BLOCK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {!readOnly && (
              <span className="lib-cm-tools">
                <button type="button" className="wk-link-btn" aria-label="W górę" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
                <button type="button" className="wk-link-btn" aria-label="W dół" disabled={i === blocks.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
                <button type="button" className="wk-link-btn" aria-label="Usuń blok" onClick={() => onChange(blocks.filter((_, j) => j !== i))}>×</button>
              </span>
            )}
          </div>
          <BlockEditor block={block} readOnly={readOnly} shown={shown} Picker={Picker} onChange={(next) => onChange(blocks.map((b, j) => (j === i ? next : b)))} />
        </div>
      ))}
      {!readOnly && (
        <div className="wk-actions">
          {BLOCK_TYPES.map((t) => <button key={t.value} type="button" className="wk-btn wk-btn-line" onClick={() => onChange([...blocks, fresh(t.value)])}>+ {t.label}</button>)}
        </div>
      )}
      <p className="lib-cm-lede">Forma coś znaczy: lista numerowana — kolejność (tok myśli), lista punktów — rzeczy równorzędne, tabela — porównanie (każdy wiersz porównuje to samo).</p>
    </div>
  );
}

function BlockEditor({ block, readOnly, onChange, shown, Picker }: {
  block: CommentBlock; readOnly: boolean; onChange: (next: CommentBlock) => void; shown: RefShown; Picker: RefPickerSlot;
}) {
  if (block.type === 'paragraph') {
    return (
      <textarea className="lib-cm-paragraph" rows={4} value={block.text} disabled={readOnly} lang="pl" spellCheck
        placeholder="Proza — **pogrubienie**, *kursywa*, przypis [@klucz, s. 3], wypowiedź osadzona: ![@kennung]"
        onChange={(e) => onChange({ ...block, text: e.target.value })} />
    );
  }

  if (block.type === 'table') {
    const width = Math.max(1, block.columns.length);
    const rows = block.rows.map((row) => Array.from({ length: width }, (_, k) => row[k] ?? []));
    const put = (columns: readonly string[], next: readonly (readonly Cell[])[]) => onChange({ type: 'table', columns, rows: next });
    return (
      <div className="lib-cm-table-wrap">
        <table className="lib-cm-table">
          <thead>
            <tr>
              {block.columns.map((c, k) => (
                <th key={k} scope="col">
                  <input value={c} disabled={readOnly} placeholder={`Kolumna ${k + 1}`} aria-label={`Nazwa kolumny ${k + 1}`}
                    onChange={(e) => put(block.columns.map((one, j) => (j === k ? e.target.value : one)), rows)} />
                  {!readOnly && block.columns.length > 1 && (
                    <button type="button" className="wk-link-btn" aria-label={`Usuń kolumnę ${k + 1}`}
                      onClick={() => put(block.columns.filter((_, j) => j !== k), rows.map((row) => row.filter((_, j) => j !== k)))}>×</button>
                  )}
                </th>
              ))}
              {!readOnly && <th><button type="button" className="wk-link-btn" onClick={() => put([...block.columns, ''], rows.map((row) => [...row, []]))}>+ kolumna</button></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, j) => (
              <tr key={j}>
                {row.map((cell, k) => (
                  <td key={k}><CellEditor cell={cell} readOnly={readOnly} shown={shown} Picker={Picker} onChange={(next) => put(block.columns, rows.map((r, a) => (a === j ? r.map((one, b) => (b === k ? next : one)) : r)))} /></td>
                ))}
                {!readOnly && <td><button type="button" className="wk-link-btn" aria-label={`Usuń wiersz ${j + 1}`} onClick={() => put(block.columns, rows.filter((_, a) => a !== j))}>×</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!readOnly && <button type="button" className="wk-link-btn" onClick={() => put(block.columns, [...rows, Array.from({ length: width }, () => [])])}>+ wiersz</button>}
      </div>
    );
  }

  const items = block.items;
  const List = block.type === 'ordered' ? 'ol' : 'ul';
  return (
    <List className="lib-cm-items">
      {items.map((cell, j) => (
        <li key={j}>
          <CellEditor cell={cell} readOnly={readOnly} shown={shown} Picker={Picker} onChange={(next) => onChange({ ...block, items: items.map((one, a) => (a === j ? next : one)) })} />
          {!readOnly && <button type="button" className="wk-link-btn" aria-label={`Usuń punkt ${j + 1}`} onClick={() => onChange({ ...block, items: items.filter((_, a) => a !== j) })}>×</button>}
        </li>
      ))}
      {!readOnly && <li className="lib-cm-more"><button type="button" className="wk-link-btn" onClick={() => onChange({ ...block, items: [...items, [{ text: '' }]] })}>+ punkt</button></li>}
    </List>
  );
}

/** Eine Zelle: Text und echte Verweise, in ihrer Reihenfolge. */
function CellEditor({ cell, readOnly, onChange, shown, Picker }: { cell: Cell; readOnly: boolean; onChange: (next: Cell) => void; shown: RefShown; Picker: RefPickerSlot }) {
  const [picking, setPicking] = useState(false);
  const put = (at: number, run: Run | null) => onChange(run === null ? cell.filter((_, i) => i !== at) : cell.map((one, i) => (i === at ? run : one)));
  return (
    <span className="lib-cm-cell">
      {cell.map((run, i) => {
        if (!('ref' in run)) {
          return (
            <input key={i} className="lib-cm-text" value={run.text} disabled={readOnly} placeholder="tekst" aria-label="Tekst"
              onChange={(e) => put(i, { text: e.target.value })}
              onBlur={() => { if (run.text === '' && cell.length > 1) put(i, null); }} />
          );
        }
        const label = shown(run.ref);
        return (
          <span key={i} className="lib-cm-ref">
            <span className={label.readable ? 'lib-ref' : 'lib-ref is-unreadable'}>{label.text}</span>
            <input value={run.locator ?? ''} disabled={readOnly} placeholder="miejsce" aria-label="Miejsce odwołania" onChange={(e) => put(i, { ref: run.ref, locator: e.target.value })} />
            {!readOnly && <button type="button" className="lib-chip-x" aria-label="Usuń odwołanie" onClick={() => put(i, null)}>×</button>}
          </span>
        );
      })}
      {!readOnly && !picking && (
        <span className="lib-cm-cell-add">
          {(cell.length === 0 || 'ref' in cell[cell.length - 1]) && <button type="button" className="wk-link-btn" onClick={() => onChange([...cell, { text: '' }])}>+ tekst</button>}
          <button type="button" className="wk-link-btn" onClick={() => setPicking(true)}>+ odwołanie</button>
        </span>
      )}
      {picking && (
        <span className="lib-cm-pick">
          {Picker({
            onPick: (id) => { onChange([...cell.filter((r) => !('text' in r) || r.text !== ''), { ref: id }]); setPicking(false); },
            onCancel: () => setPicking(false)
          })}
          <button type="button" className="wk-link-btn" onClick={() => setPicking(false)}>Anuluj</button>
        </span>
      )}
    </span>
  );
}
