/**
 * DIE MACIERZ EINES WIDOKU (2026-10-22, Schritt 10) — Zeilen × Spalten, in
 * jedem Feld die Zahl dessen, was zu beiden gehört; ein Klick öffnet das Feld.
 * Dieselbe Zeichnung in „Wpisy" und im Baustein „Widok". Ein leeres Feld zeigt,
 * wo man anlegen darf, ein „+" (`onEmpty`).
 *
 * 2026-10-23 (Schritt 5) — eine Achse mit Überschriften (Tajemnica nach
 * „część", Obszar nach „grupa"): über den Spalten eine Zeile mit den
 * Überschriften, je über so viele Spalten, wie darunter stehen; zwischen den
 * Zeilen eine Zeile mit der Überschrift, wo eine neue beginnt.
 */

import { Fragment } from 'react';

import { cellKey, type Matrix } from './views';
import type { Group } from './selection';

/** Die Überschriften der Spalten — aufeinanderfolgende mit derselben zusammen. */
function spans(cols: readonly Group[]): { key: string; label: string; span: number }[] {
  const out: { key: string; label: string; span: number }[] = [];
  for (const c of cols) {
    const key = c.head?.key ?? '#';
    const last = out[out.length - 1];
    if (last !== undefined && last.key === key) last.span += 1;
    else out.push({ key, label: c.head?.label ?? '', span: 1 });
  }
  return out;
}

export function MatrixGrid({ matrix, chosen, onCell, onEmpty, caption }: {
  matrix: Matrix;
  /** Das offene Feld (`cellKey`). */
  chosen: string | null;
  onCell: (row: string, col: string) => void;
  /** Ein leeres Feld anklicken (anlegen) — fehlt es, ist ein leeres Feld still. */
  onEmpty?: (row: string, col: string) => void;
  caption?: string;
}) {
  const heads = matrix.cols.some((c) => c.head !== undefined) ? spans(matrix.cols) : null;
  return (
    <div className="cg-table-wrap">
      <table className="cg-table cg-matrix">
        {caption !== undefined && <caption className="cg-muted">{caption}</caption>}
        <thead>
          {heads !== null && (
            <tr className="cg-matrix-heads">
              <th aria-hidden />
              {heads.map((h, i) => <th key={`${h.key}-${i}`} scope="colgroup" colSpan={h.span}>{h.label}</th>)}
            </tr>
          )}
          <tr>
            <th aria-hidden />
            {matrix.cols.map((c) => <th key={c.key || '#reszta'} scope="col">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r, i) => (
            <Fragment key={r.key || '#reszta'}>
              {r.head !== undefined && r.head.key !== matrix.rows[i - 1]?.head?.key && (
                <tr className="cg-matrix-heads"><th scope="rowgroup" colSpan={matrix.cols.length + 1}>{r.head.label}</th></tr>
              )}
              <tr>
                <th scope="row">{r.label}</th>
                {matrix.cols.map((c) => {
                  const n = matrix.cell(r.key, c.key).length;
                  const on = chosen === cellKey(r.key, c.key);
                  return (
                    <td key={c.key || '#reszta'} className={on ? 'is-on' : undefined}>
                      {n > 0
                        ? <button type="button" className="cg-ref" aria-label={`${r.label} × ${c.label}: ${n}`} aria-pressed={on} onClick={() => onCell(r.key, c.key)}>{n}</button>
                        : onEmpty !== undefined && r.key !== '' && c.key !== ''
                          ? <button type="button" className="wk-link-btn" aria-label={`${r.label} × ${c.label}: dodaj`} title="Dodaj tutaj" onClick={() => onEmpty(r.key, c.key)}>+</button>
                          : <span className="cg-muted" aria-label="pusto">·</span>}
                    </td>
                  );
                })}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
