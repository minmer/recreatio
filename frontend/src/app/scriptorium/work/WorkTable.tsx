/**
 * DIE TABELLE DER DIMENSIONEN (2026-11-15) — meist zwei: Kapitel × Zielgruppen. Zeilen sind die Knoten einer Ebene
 * (oder die Werte einer zweiten Dimension), Spalten die Werte einer Dimension; die übrigen Dimensionen sind Filter.
 * Eine Zelle zeigt, was nur für diesen Wert steht, mit Stand; daneben der gemeinsame Kern. Eine Lücke ist sichtbar
 * (und lässt sich füllen), „absichtlich nicht nötig" steht mit seiner Notiz.
 */

import { useState } from 'react';

import { useT } from '../../core/i18n';
import { WorkspaceError } from '../../core/session';
import { NODE_STATUS } from '../../library/libraryKinds';
import { toast } from '../../ui/dialogs';
import { allNodes, dimensionTable, newNode, type WorkNode } from './workModel';
import type { WorkCtx } from './WorkView';

export function WorkTable({ ctx }: { ctx: WorkCtx }) {
  const t = useT();
  const { model } = ctx.work;
  const dims = model.dimensions;
  const [columns, setColumns] = useState(dims[0]?.key ?? '');
  const deepest = Math.max(0, ...allNodes(model).map((n) => n.depth));
  const [rows, setRows] = useState('level:0');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (dims.length === 0) return <p className="wk-empty">{t('workUi.table.noDimensions')} <a className="wk-link" href={ctx.href('ustawienia')}>{t('workUi.tabs.ustawienia')}</a></p>;
  const col = dims.find((d) => d.key === columns) ?? dims[0];
  const spec = rows.startsWith('dim:') ? { rows: rows.slice(4), columns: col.key, filters } : { level: Number(rows.slice(6)) || 0, columns: col.key, filters };
  const table = dimensionTable(model, spec);
  const others = dims.filter((d) => d.key !== col.key && d.key !== (rows.startsWith('dim:') ? rows.slice(4) : ''));
  const status = (n: WorkNode) => NODE_STATUS.find((s) => s.value === n.status)?.label ?? '';
  const nodeLink = (n: WorkNode) => (
    <a key={n.id} className={`work-cell-node is-${n.status || 'none'}`} href={ctx.href('struktura', n.id)}>
      <span>{n.title || t('work.untitled')}</span>{status(n) !== '' && <span className="lib-meta"> · {status(n)}</span>}
    </a>
  );
  const fill = (row: WorkNode, value: string, name: string) => void (async () => {
    setBusy(true);
    try {
      const made = newNode(model, row, row.children[row.children.length - 1] ?? null, { variant: value, title: t('workUi.table.variantTitle', { title: row.title, value: name }) });
      await ctx.store.save(made);
      window.location.hash = ctx.href('struktura', made.id!);
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : t('workUi.tree.saveFailed'), { kind: 'error' });
    } finally { setBusy(false); }
  })();

  return (
    <div className="work-table-view">
      <div className="work-toolbar">
        <label className="wk-field">
          <span>{t('workUi.table.columns')}</span>
          <select value={col.key} onChange={(e) => setColumns(e.target.value)}>
            {dims.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
          </select>
        </label>
        <label className="wk-field">
          <span>{t('workUi.table.rows')}</span>
          <select value={rows} onChange={(e) => setRows(e.target.value)}>
            {Array.from({ length: deepest + 1 }, (_, depth) => (
              <option key={depth} value={`level:${depth}`}>{model.levels[depth]?.name || t('workUi.progress.depth', { depth: depth + 1 })}</option>
            ))}
            {dims.filter((d) => d.key !== col.key).map((d) => <option key={d.key} value={`dim:${d.key}`}>{t('workUi.table.byDimension', { dimension: d.name })}</option>)}
          </select>
        </label>
        {others.map((d) => (
          <label key={d.key} className="wk-field">
            <span>{d.name}</span>
            <select value={filters[d.key] ?? ''} onChange={(e) => setFilters({ ...filters, [d.key]: e.target.value })}>
              <option value="">{t('workUi.table.anyValue')}</option>
              {d.values.map((v) => <option key={v.key} value={v.key}>{v.name}</option>)}
            </select>
          </label>
        ))}
      </div>

      {table.length === 0 ? <p className="wk-empty">{t('workUi.table.empty')}</p> : (
        <div className="work-table-wrap">
          <table className="work-table">
            <thead>
              <tr>
                <th scope="col">{rows.startsWith('dim:') ? dims.find((d) => d.key === rows.slice(4))?.name : model.levels[spec.level ?? 0]?.name || t('workUi.table.row')}</th>
                {!rows.startsWith('dim:') && <th scope="col">{t('workUi.table.shared')}</th>}
                {col.values.map((v) => <th key={v.key} scope="col">{v.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {table.map((row, i) => (
                <tr key={row.node?.id ?? row.value?.key ?? i} className={row.single ? 'is-single' : ''}>
                  <th scope="row">{row.node !== null ? <a className="wk-link" href={ctx.href('struktura', row.node.id)}>{row.node.title || t('work.untitled')}</a> : row.value?.name}</th>
                  {!rows.startsWith('dim:') && (
                    row.single
                      ? <td colSpan={col.values.length + 1} className="work-cell is-line">{t('workUi.table.singleLine')}</td>
                      : <td className="work-cell is-shared">{row.shared.length === 0 ? <span className="wk-empty">—</span> : row.shared.map(nodeLink)}</td>
                  )}
                  {!row.single && col.values.map((v) => {
                    const cell = row.cells[v.key];
                    return (
                      <td key={v.key} className={`work-cell${cell.gap ? ' is-gap' : ''}${cell.skipped !== null ? ' is-skipped' : ''}`}>
                        {cell.specific.map(nodeLink)}
                        {cell.skipped !== null && <span className="work-skipped">{t('workUi.table.notNeeded')}{cell.skipped === '' ? '' : `: ${cell.skipped}`}</span>}
                        {cell.gap && (
                          <span className="work-gap">
                            {t('workUi.table.gap')}
                            {row.node !== null && row.node.split === col.key && !ctx.readOnly && (
                              <button type="button" className="wk-link-btn" disabled={busy} onClick={() => fill(row.node!, v.key, v.name)}>{t('workUi.table.fill')}</button>
                            )}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
