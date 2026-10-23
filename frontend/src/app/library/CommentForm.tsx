/**
 * EIN KOMENTARZ, GESCHRIEBEN (2026-10-22) — worüber (Einträge mit Stelle,
 * bei einem Text der Punkt seines Plans) und was er sagt, in vier Formen:
 * Absatz, nummerierte Liste, Liste, Tabelle.
 *
 * Ein Listenpunkt und eine Tabellenzelle sind Folgen von Stücken: Text (im
 * Zapis, mit Fussnoten) und echte Verweise (ein Eintrag und eine Stelle) —
 * kein Text, der wie ein Verweis aussieht. So bleibt „Łk 1,35 neben Dz 1,8"
 * eine Aussage, die sich später befragen lässt (`pairedWith`).
 */

import { useState } from 'react';

import { BLOCK_TYPES, blockData, blocksOf, type Cell, type CommentBlock, isQuestion, type Run, type Subject, subjectData, subjectsOf, THESIS_LIMIT, thesisOf, thesisProblem } from './comment';
import { refLabel } from './libraryCite';
import { KINDS, type EntryData, type LibEntry } from './libraryKinds';
import { RefPicker } from './LibraryPick';
import type { LibraryStore } from './libraryStore';
import { FieldList } from './LibraryFields';
import { CommentCard, StatementMarks } from './markupView';
import { planOf, pointLine, pointNumbers } from '../scriptorium/sermon';

const ANY = KINDS.map((k) => k.kind);
type BlockType = CommentBlock['type'];

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

export function CommentForm({ store, entry, data, set, readOnly }: {
  store: LibraryStore;
  entry: LibEntry;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
}) {
  const subjects = subjectsOf(data);
  const blocks = blocksOf(data, 'blocks', true);
  const setSubjects = (next: readonly Subject[]) => set({ subjects: next.map(subjectData) });
  const setBlocks = (next: readonly CommentBlock[]) => set({ blocks: next.map(blockData) });
  const swap = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    [next[from], next[to]] = [next[to], next[from]];
    setBlocks(next);
  };

  return (
    <>
      <section className="lib-cm-part">
        <h2 className="lib-box-h">O czym</h2>
        {subjects.length === 0 && <p className="lib-cm-lede">Wpisy, o których jest ten komentarz — źródło z miejscem (np. Pismo Święte, Łk 1,35), cytat, tekst i punkt jego planu, inny komentarz.</p>}
        <ul className="lib-cm-subjects">
          {subjects.map((s, i) => (
            <SubjectRow key={`${s.ref}-${i}`} store={store} subject={s} readOnly={readOnly}
              onChange={(next) => setSubjects(next === null ? subjects.filter((_, j) => j !== i) : subjects.map((one, j) => (j === i ? next : one)))} />
          ))}
        </ul>
        {!readOnly && (
          <div className="lib-cm-add">
            <RefPicker store={store} kinds={ANY} value={[]} multiple={false} canMake={false} placeholder="+ O czym: szukaj wpisu…"
              onChange={(next) => { if (next[0] !== undefined) setSubjects([...subjects, { ref: next[0], locator: '', point: '' }]); }} />
          </div>
        )}
      </section>

      <section className="lib-cm-part">
        <h2 className="lib-box-h">Treść</h2>
        {blocks.map((block, i) => (
          <div key={i} className="lib-cm-block">
            <div className="lib-cm-block-bar">
              <select value={block.type} disabled={readOnly} aria-label="Forma bloku" onChange={(e) => setBlocks(blocks.map((b, j) => (j === i ? convert(b, e.target.value as BlockType) : b)))}>
                {BLOCK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {!readOnly && (
                <span className="lib-cm-tools">
                  <button type="button" className="wk-link-btn" aria-label="W górę" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
                  <button type="button" className="wk-link-btn" aria-label="W dół" disabled={i === blocks.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
                  <button type="button" className="wk-link-btn" aria-label="Usuń blok" onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}>×</button>
                </span>
              )}
            </div>
            <BlockEditor store={store} block={block} readOnly={readOnly} onChange={(next) => setBlocks(blocks.map((b, j) => (j === i ? next : b)))} />
          </div>
        ))}
        {!readOnly && (
          <div className="wk-actions">
            {BLOCK_TYPES.map((t) => <button key={t.value} type="button" className="wk-btn wk-btn-line" onClick={() => setBlocks([...blocks, fresh(t.value)])}>+ {t.label}</button>)}
          </div>
        )}
        <p className="lib-cm-lede">Forma coś znaczy: lista numerowana — kolejność (tok myśli), lista punktów — rzeczy równorzędne, tabela — porównanie (każdy wiersz porównuje to samo).</p>
        {/* 2026-10-22 — die Teza ist der erste Satz (Entscheidung 1); eine Frage als erster Satz macht den Komentarz zur Frage (Entscheidung 2). */}
        <p className="lib-cm-lede">Teza (pierwsze zdanie): {thesisOf(data) === '' ? '—' : `„${thesisOf(data)}”`}{isQuestion(data) ? ' — to pytanie; odpowiedzią będzie komentarz, który się do niego odwoła.' : ''}</p>
        {thesisProblem(data) === 'missing' && <p className="wk-warn">Zacznij od zdania, które mówi najważniejsze — to teza komentarza (jego nazwa, pierwsza strona karty w nauce).</p>}
        {thesisProblem(data) === 'long' && <p className="wk-warn">Pierwsze zdanie ma ponad {THESIS_LIMIT} znaków — skróć tezę, rozwinięcie zostaw na dalsze zdania.</p>}
      </section>

      <FieldList store={store} kind="comment" data={data} set={set} readOnly={readOnly} only={['topics']} />

      {blocks.length > 0 && (
        <section className="lib-box">
          <h2 className="lib-box-h">Podgląd</h2>
          <StatementMarks comment={{ ...entry, data }} look={store} author />
          <CommentCard comment={entry} look={store} prefix="cm-preview-" about />
        </section>
      )}
    </>
  );
}

function SubjectRow({ store, subject, readOnly, onChange }: {
  store: LibraryStore; subject: Subject; readOnly: boolean; onChange: (next: Subject | null) => void;
}) {
  const target = store.get(subject.ref);
  const plan = target?.kind === 'text' ? planOf(target.data) : [];
  const numbers = pointNumbers(plan);
  return (
    <li className="lib-cm-subject">
      <RefPicker store={store} kinds={ANY} value={[subject.ref]} multiple={false} busy={readOnly} canMake={false}
        onChange={(next) => onChange(next[0] === undefined ? null : { ...subject, ref: next[0], point: '' })} />
      {target === undefined && <span className="lib-ref is-unreadable">{refLabel(subject.ref, '', store)}</span>}
      <input className="lib-cm-locator" value={subject.locator} disabled={readOnly} placeholder="Miejsce: Łk 1,35 · s. 23" aria-label="Miejsce"
        onChange={(e) => onChange({ ...subject, locator: e.target.value })} />
      {plan.length > 0 && (
        <select value={subject.point} disabled={readOnly} aria-label="Punkt planu" onChange={(e) => onChange({ ...subject, point: e.target.value })}>
          <option value="">cały tekst</option>
          {plan.map((p) => <option key={p.id} value={p.id}>{numbers.get(p.id)} {pointLine(p.text, store, 60)}</option>)}
        </select>
      )}
    </li>
  );
}

function BlockEditor({ store, block, readOnly, onChange }: {
  store: LibraryStore; block: CommentBlock; readOnly: boolean; onChange: (next: CommentBlock) => void;
}) {
  if (block.type === 'paragraph') {
    return (
      <textarea className="lib-cm-paragraph" rows={4} value={block.text} disabled={readOnly} lang="pl" spellCheck
        placeholder="Proza — **pogrubienie**, *kursywa*, przypis [@klucz, s. 3], komentarz osadzony: ![@klucz]"
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
                  <td key={k}><CellEditor store={store} cell={cell} readOnly={readOnly} onChange={(next) => put(block.columns, rows.map((r, a) => (a === j ? r.map((one, b) => (b === k ? next : one)) : r)))} /></td>
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
          <CellEditor store={store} cell={cell} readOnly={readOnly} onChange={(next) => onChange({ ...block, items: items.map((one, a) => (a === j ? next : one)) })} />
          {!readOnly && <button type="button" className="wk-link-btn" aria-label={`Usuń punkt ${j + 1}`} onClick={() => onChange({ ...block, items: items.filter((_, a) => a !== j) })}>×</button>}
        </li>
      ))}
      {!readOnly && <li className="lib-cm-more"><button type="button" className="wk-link-btn" onClick={() => onChange({ ...block, items: [...items, [{ text: '' }]] })}>+ punkt</button></li>}
    </List>
  );
}

/** Eine Zelle: Text und echte Verweise, in ihrer Reihenfolge. */
function CellEditor({ store, cell, readOnly, onChange }: { store: LibraryStore; cell: Cell; readOnly: boolean; onChange: (next: Cell) => void }) {
  const [picking, setPicking] = useState(false);
  const put = (at: number, run: Run | null) => onChange(run === null ? cell.filter((_, i) => i !== at) : cell.map((one, i) => (i === at ? run : one)));
  return (
    <span className="lib-cm-cell">
      {cell.map((run, i) => ('ref' in run ? (
        <span key={i} className="lib-cm-ref">
          <span className={store.get(run.ref) === undefined ? 'lib-ref is-unreadable' : 'lib-ref'}>{refLabel(run.ref, '', store)}</span>
          <input value={run.locator ?? ''} disabled={readOnly} placeholder="miejsce" aria-label="Miejsce odwołania" onChange={(e) => put(i, { ref: run.ref, locator: e.target.value })} />
          {!readOnly && <button type="button" className="lib-chip-x" aria-label="Usuń odwołanie" onClick={() => put(i, null)}>×</button>}
        </span>
      ) : (
        <input key={i} className="lib-cm-text" value={run.text} disabled={readOnly} placeholder="tekst" aria-label="Tekst"
          onChange={(e) => put(i, { text: e.target.value })}
          onBlur={() => { if (run.text === '' && cell.length > 1) put(i, null); }} />
      )))}
      {!readOnly && !picking && (
        <span className="lib-cm-cell-add">
          {(cell.length === 0 || 'ref' in cell[cell.length - 1]) && <button type="button" className="wk-link-btn" onClick={() => onChange([...cell, { text: '' }])}>+ tekst</button>}
          <button type="button" className="wk-link-btn" onClick={() => setPicking(true)}>+ odwołanie</button>
        </span>
      )}
      {picking && (
        <span className="lib-cm-pick">
          <RefPicker store={store} kinds={ANY} value={[]} multiple={false} canMake={false} placeholder="Szukaj wpisu (Pismo, cytat, komentarz…)"
            onChange={(next) => { if (next[0] !== undefined) onChange([...cell.filter((r) => !('text' in r) || r.text !== ''), { ref: next[0] }]); setPicking(false); }} />
          <button type="button" className="wk-link-btn" onClick={() => setPicking(false)}>Anuluj</button>
        </span>
      )}
    </span>
  );
}
