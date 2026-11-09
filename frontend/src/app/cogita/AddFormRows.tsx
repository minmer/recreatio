/**
 * COGITA — VORHANDENES IN DER GESTALT DES FORMULARS BEARBEITEN (COGITA.md
 * §2.4), 2026-10-17, auf Wunsch: „das Gespeicherte in diesem Schema zeigen —
 * was da ist und was da sein könnte — und alles mit einem Knopf speichern".
 *
 * Je Zeile der Eintrag, der sie hält (eine Übersetzung), in den Spalten seine
 * Einträge (die Wörter je Sprache), leere Stellen, wo eines fehlt. Man ändert
 * Texte, fügt Wörter hinzu (gefunden oder angelegt wie beim Hinzufügen), nimmt
 * sie heraus, löscht Zeilen — gespeichert wird erst mit „Zapisz zmiany".
 * Die Wahl oben (Sprachen, Thema) ist der Filter. Die Rechnung steht in
 * `addFormEdit.ts`.
 */

import { useEffect, useMemo, useState } from 'react';

import { newId } from '../core/ids';
import { toast } from '../ui/dialogs';
import { groupsOf, isLong, type AddForm, type PlanCtx, type TopChoice } from './addForm';
import { existingRows, planEdit, takesMany, type EditRow, type RowDraft } from './addFormEdit';
import type { FieldDef } from './schema';
import type { CogitaLibrary } from './store';
import { useBusy, useCtx } from './ui';
import { useT } from '../core/i18n';

export const planCtx = (lib: CogitaLibrary): PlanCtx => ({
  look: lib.look,
  pool: (kind) => lib.ofKind(kind),
  isOwn: (id) => lib.isOwn(id),
  newId
});

const PAGE = 40;

export function EditRows({ form, choice, onDirty }: { form: AddForm; choice: TopChoice; onDirty: (dirty: boolean) => void }) {
  const t = useT();
  const { lib } = useCtx();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => groupsOf(form, lib.look), [form, lib.revision]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shape = useMemo(() => existingRows(form, lib.look, (k) => lib.ofKind(k), choice), [form, choice, lib.revision]);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const { busy, failed, run } = useBusy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plan = useMemo(() => planEdit(form, planCtx(lib), choice, shape, drafts), [form, choice, shape, drafts, lib.revision]);
  const touched = Object.keys(drafts).length;
  const changes = plan.saves.length + plan.drops.length;

  useEffect(() => { onDirty(touched > 0); }, [touched, onDirty]);
  useEffect(() => {
    if (touched === 0) return undefined;
    const stop = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', stop);
    return () => window.removeEventListener('beforeunload', stop);
  }, [touched]);

  const words = query.trim().toLowerCase();
  const rows = words === '' ? shape.rows : shape.rows.filter((row) =>
    Object.values(drafts[row.key]?.cells ?? row.cells).flat().some((v) => Object.values(v.texts).some((t) => t.toLowerCase().includes(words))));

  const change = (row: EditRow, next: (d: RowDraft) => RowDraft) => setDrafts((all) => ({ ...all, [row.key]: next(all[row.key] ?? { cells: row.cells }) }));
  const setText = (row: EditRow, node: string, i: number, field: string, text: string) => change(row, (d) => {
    const list = [...(d.cells[node] ?? [])];
    list[i] = { ...list[i], texts: { ...list[i].texts, [field]: text } };
    return { ...d, cells: { ...d.cells, [node]: list } };
  });
  const add = (row: EditRow, node: string) => change(row, (d) => ({ ...d, cells: { ...d.cells, [node]: [...(d.cells[node] ?? []), { texts: {} }] } }));
  const takeOut = (row: EditRow, node: string, i: number) => change(row, (d) => ({ ...d, cells: { ...d.cells, [node]: (d.cells[node] ?? []).filter((_, j) => j !== i) } }));
  const drop = (row: EditRow) => change(row, (d) => ({ ...d, dropped: d.dropped !== true }));
  const reset = (row: EditRow) => setDrafts(({ [row.key]: _gone, ...rest }) => { void _gone; return rest; });

  const save = () => run(async () => {
    if (plan.problems.length > 0) throw new Error(plan.problems.join(' '));
    if (plan.saves.length > 0) {
      const done = await lib.saveMany(plan.saves);
      if (done.failed.length > 0) throw new Error(t('cogitaEditForm.rows.saveFailed', { n: done.failed.length, of: plan.saves.length, error: done.failed[0].error }));
    }
    for (const id of plan.drops) await lib.remove(id);
    setDrafts({});
    toast(t('cogitaEditForm.rows.saved', { count: changes }));
  });

  const linked = shape.root !== null;
  return (
    <div className="cg">
      <div className="cg-af-edit-bar">
        <input type="search" value={query} placeholder={t('cogitaEditForm.rows.searchPh')} aria-label={t('cogitaEditForm.rows.search')} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} />
        <span className="cg-muted">{t('cogitaEditForm.rows.count', { count: rows.length })}{touched > 0 ? t('cogitaEditForm.rows.changed', { n: touched }) : ''}</span>
        <span className="cg-row">
          <button type="button" className="wk-link-btn" disabled={busy || touched === 0} onClick={() => setDrafts({})}>{t('cogitaEditForm.rows.discard')}</button>
          <button type="button" className="wk-btn" disabled={busy || changes === 0 || plan.problems.length > 0} onClick={() => void save()}>
            {busy ? t('common.saving') : changes === 0 ? t('cogitaEditForm.rows.save') : t('cogitaEditForm.rows.saveN', { n: changes })}
          </button>
        </span>
      </div>
      {shape.note !== undefined && <p className="wk-note">{shape.note}</p>}
      {plan.problems.length > 0 && <ul className="wk-warn">{plan.problems.slice(0, 8).map((p, i) => <li key={i}>{p}</li>)}</ul>}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {rows.length === 0 ? (
        <p className="wk-empty">{shape.rows.length === 0 ? t('cogitaEditForm.rows.none') : t('cogitaEditForm.rows.noMatch')}</p>
      ) : (
        <div className="cg-table-wrap">
          <table className="cg-table cg-af-edit">
            <thead><tr>{groups.map((g) => <th key={g.node}>{g.label}</th>)}<th aria-label={t('cogitaEditForm.rows.row')} /></tr></thead>
            <tbody>
              {rows.slice(0, shown).map((row) => {
                const draft = drafts[row.key];
                const cells = draft?.cells ?? row.cells;
                const gone = draft?.dropped === true;
                return (
                  <tr key={row.key} className={gone ? 'is-dropped' : draft !== undefined ? 'is-changed' : undefined}>
                    {groups.map((g) => {
                      const own = g.node === shape.root || !linked;
                      const several = takesMany(form, lib.look, shape.root, g.node);
                      const values = cells[g.node] ?? [];
                      return (
                        <td key={g.node}>
                          {values.map((v, i) => (
                            <span key={v.id ?? `nowy-${i}`} className="cg-af-edit-value">
                              {/* Rodzaj zur Wahl: bei einem neuen Wert wählbar, bei einem vorhandenen genannt. */}
                              {g.choices !== undefined && (v.id === undefined
                                ? (
                                  <select className="cg-af-kind" aria-label={t('cogitaEditForm.rows.kindOf', { label: g.label })} value={v.texts._kind ?? g.choices[0].kind.id} disabled={gone || busy}
                                    onChange={(e) => setText(row, g.node, i, '_kind', e.target.value)}>
                                    {g.choices.map((ch) => <option key={ch.kind.id} value={ch.kind.id}>{ch.kind.name}</option>)}
                                  </select>
                                )
                                : <span className="cg-muted">{g.choices.find((ch) => ch.kind.id === v.texts._kind)?.kind.name}</span>)}
                              {g.fields.map((f) => (
                                <CellInput key={f.key} field={f} value={v.texts[f.key] ?? ''} disabled={gone || busy} fresh={v.id === undefined}
                                  label={t('cogitaEditForm.askLabel', { node: g.label, field: f.label })} placeholder={g.fields.length > 1 ? f.label : v.id === undefined ? t('cogitaEditForm.rows.new') : undefined}
                                  onChange={(typed) => setText(row, g.node, i, f.key, typed)} />
                              ))}
                              {!own && !gone && <button type="button" className="wk-link-btn" aria-label={t('cogitaEditForm.rows.takeOut', { text: Object.entries(v.texts).filter(([k]) => k !== '_kind').map(([, x]) => x).join(' ') })} onClick={() => takeOut(row, g.node, i)}>×</button>}
                            </span>
                          ))}
                          {!own && !gone && (several || values.length === 0) && <button type="button" className="wk-link-btn cg-af-edit-add" onClick={() => add(row, g.node)}>{t('cogitaEditForm.rows.add')}</button>}
                        </td>
                      );
                    })}
                    <td className="cg-af-edit-tools">
                      {draft !== undefined && <button type="button" className="wk-link-btn" onClick={() => reset(row)}>{t('cogitaEditForm.rows.restore')}</button>}
                      <button type="button" className="wk-link-btn" onClick={() => drop(row)}>{gone ? t('cogitaEditForm.rows.undrop') : t('cogitaEditForm.rows.drop')}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > shown && <button type="button" className="wk-link-btn" onClick={() => setShown((n) => n + PAGE)}>{t('cogitaEditForm.rows.more', { n: rows.length - shown })}</button>}
    </div>
  );
}

function CellInput({ field, value, disabled, fresh, label, placeholder, onChange }: {
  field: FieldDef;
  value: string;
  disabled: boolean;
  fresh: boolean;
  label: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const t = useT();
  const className = fresh ? 'is-fresh' : undefined;
  if (field.type === 'choice' || field.type === 'bool') {
    return (
      <select className={className} value={value} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {field.type === 'choice'
          ? (field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
          : (['tak', 'nie', 'nie wiadomo'] as const).map((o, i) => <option key={o} value={o}>{t(['common.yes', 'common.no', 'cogitaEditForm.rows.unknown'][i]!)}</option>) /* i18n-ignore: die Werte liest readBool (schema.ts) */}
      </select>
    );
  }
  if (isLong(field)) return <textarea className={className} rows={1} value={value} disabled={disabled} aria-label={label} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
  return <input className={className} value={value} disabled={disabled} aria-label={label} placeholder={placeholder} autoComplete="off" onChange={(e) => onChange(e.target.value)} />;
}
