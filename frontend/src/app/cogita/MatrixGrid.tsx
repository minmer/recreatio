/**
 * DIE MACIERZ EINES WIDOKU (2026-10-22, Schritt 10) — Zeilen × Spalten, in
 * jedem Feld die Zahl dessen, was zu beiden gehört; ein Klick öffnet das Feld.
 * Dieselbe Zeichnung in „Wpisy" und im Baustein „Widok". Ein leeres Feld zeigt,
 * wo man anlegen darf, ein „+" (`onEmpty`).
 */

import { cellKey, type Matrix } from './views';

export function MatrixGrid({ matrix, chosen, onCell, onEmpty, caption }: {
  matrix: Matrix;
  /** Das offene Feld (`cellKey`). */
  chosen: string | null;
  onCell: (row: string, col: string) => void;
  /** Ein leeres Feld anklicken (anlegen) — fehlt es, ist ein leeres Feld still. */
  onEmpty?: (row: string, col: string) => void;
  caption?: string;
}) {
  return (
    <div className="cg-table-wrap">
      <table className="cg-table cg-matrix">
        {caption !== undefined && <caption className="cg-muted">{caption}</caption>}
        <thead>
          <tr>
            <th aria-hidden />
            {matrix.cols.map((c) => <th key={c.key || '#reszta'} scope="col">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => (
            <tr key={r.key || '#reszta'}>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
