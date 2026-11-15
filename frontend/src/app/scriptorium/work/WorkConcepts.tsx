/**
 * DAS REGISTER DER BEGRIFFE (2026-11-15) — je Person, Ort, Begriff, Idee auf einen Blick: hier eingeführt, hier
 * definiert, hier ein Beispiel, hier gebraucht, hier aufgenommen — jedes ein Link an die Stelle, je Weg. Darunter
 * die Matrix Einträge × Knoten einer Ebene in Lesereihenfolge, mit den Rollen als Buchstaben.
 */

import { useState } from 'react';

import { useT } from '../../core/i18n';
import { MARK_ROLES } from '../../library/libraryKinds';
import { cogitaPath } from '../../cogita/parts';
import { MARK_ORDER, type MarkRole } from './workModel';
import type { Placement } from './workMarks';
import { PathPick, pathKeyOf, type WorkCtx } from './WorkView';


export function WorkConcepts({ ctx }: { ctx: WorkCtx }) {
  const t = useT();
  const { model, knowledge } = ctx.work;
  const report = ctx.work.report(pathKeyOf(ctx));
  const [kind, setKind] = useState('');
  const [query, setQuery] = useState('');
  const placed = report?.register.placed ?? [];
  const deepest = Math.max(0, ...placed.map((p) => p.node.depth));
  const counts = Array.from({ length: deepest + 1 }, (_, d) => placed.filter((p) => p.node.depth === d).length);
  const fallback = counts.reduce((best, n, d) => (n <= 40 && n > 0 ? d : best), 0);
  const [levelChoice, setLevel] = useState<number | null>(null);
  const level = levelChoice ?? fallback;
  if (report === undefined) return null;

  const ids = new Set([...report.register.byEntity.keys(), ...knowledge.all().filter((e) => e.phaseOf === undefined).map((e) => e.id)]);
  const kinds = [...new Set([...ids].map((id) => knowledge.get(id)?.kind ?? '').filter((k) => k !== ''))].sort();
  const label = (id: string) => knowledge.get(id)?.label ?? t('work.check.someEntry');
  const low = query.trim().toLowerCase();
  const list = [...ids].filter((id) => (kind === '' || knowledge.get(id)?.kind === kind) && (low === '' || label(id).toLowerCase().includes(low)))
    .sort((a, b) => (report.register.byEntity.get(a)?.firstIntro ?? 1e9) - (report.register.byEntity.get(b)?.firstIntro ?? 1e9) || label(a).localeCompare(label(b)));
  const roleLabel = (r: MarkRole) => MARK_ROLES.find((m) => m.value === r)?.label ?? r;
  const numberOf = (pos: number) => placed[pos]?.number ?? '';
  const where = (o: Placement) => (
    <a key={`${o.node}-${o.where}-${o.point ?? ''}`} className={o.where === 'implicit' ? 'work-occ is-implicit' : 'work-occ'} href={ctx.href('struktura', o.node)}
      title={placed[o.pos]?.node.title}>
      {numberOf(o.pos)} {placed[o.pos]?.node.title || t('work.untitled')}
    </a>
  );
  /* Spalten der Matrix: die Knoten der Ebene; was darunter vorkommt, zählt zu ihnen. */
  const columns = placed.filter((p) => p.node.depth === level);
  const columnOf = (pos: number): number => {
    for (let i = columns.length - 1; i >= 0; i -= 1) if (columns[i].pos <= pos) return i;
    return -1;
  };

  return (
    <div className="work-concepts">
      <div className="work-toolbar">
        <PathPick ctx={ctx} all={false} />
        <label className="wk-field">
          <span>{t('workUi.concepts.kind')}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">{t('workUi.concepts.allKinds')}</option>
            {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label className="wk-field">
          <span>{t('workUi.concepts.search')}</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      {model.bases.length === 0 && <p className="wk-note">{t('workUi.concepts.noBases')} <a className="wk-link" href={ctx.href('ustawienia')}>{t('workUi.tabs.ustawienia')}</a></p>}
      {list.length === 0 ? <p className="wk-empty">{t('workUi.concepts.empty')}</p> : (
        <ul className="work-concept-list">
          {list.map((id) => {
            const reg = report.register.byEntity.get(id);
            const e = knowledge.get(id);
            return (
              <li key={id} className="work-concept">
                <div className="work-concept-head">
                  <strong>{label(id)}</strong>
                  {e !== undefined && <span className="lib-meta">{e.kind}</span>}
                  {e?.base !== undefined && <a className="wk-link-btn" href={cogitaPath(e.base, 'wpisy', id)}>{t('workUi.concepts.openInBase')}</a>}
                </div>
                {e?.definition !== undefined && e.definition !== '' && <p className="lib-meta">{e.definition}</p>}
                {reg === undefined ? <p className="wk-empty">{t('workUi.concepts.notOnPath')}</p> : (
                  <dl className="work-dl">
                    {MARK_ORDER.map((r) => reg.roles[r].length === 0 ? null : (
                      <div key={r} className="work-dl-row">
                        <dt>{roleLabel(r)}</dt>
                        <dd>{reg.roles[r].map(where)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {columns.length > 0 && list.length > 0 && (
        <section className="work-matrix-section">
          <div className="work-toolbar">
            <h2 className="wk-h2">{t('workUi.concepts.matrix')}</h2>
            <label className="wk-field">
              <span>{t('workUi.concepts.level')}</span>
              <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
                {counts.map((n, d) => <option key={d} value={d}>{model.levels[d]?.name || t('workUi.progress.depth', { depth: d + 1 })} ({n})</option>)}
              </select>
            </label>
          </div>
          <p className="lib-meta">{t('workUi.concepts.legend')}</p>
          <div className="work-table-wrap">
            <table className="work-matrix">
              <thead>
                <tr>
                  <th scope="col">{t('workUi.concepts.entry')}</th>
                  {columns.map((c) => <th key={c.node.id} scope="col" title={c.node.title}><a href={ctx.href('struktura', c.node.id)}>{c.number}</a></th>)}
                </tr>
              </thead>
              <tbody>
                {list.map((id) => {
                  const cells: Set<MarkRole>[] = columns.map(() => new Set());
                  for (const o of report.register.byEntity.get(id)?.occ ?? []) { const c = columnOf(o.pos); if (c >= 0) cells[c].add(o.role); }
                  return (
                    <tr key={id}>
                      <th scope="row">{label(id)}</th>
                      {cells.map((set, i) => (
                        <td key={columns[i].node.id} className={set.has('intro') ? 'is-intro' : set.size > 0 ? 'is-on' : ''}>
                          {MARK_ORDER.filter((r) => set.has(r)).map((r) => t(`workUi.concepts.letter.${r}`)).join('')}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
