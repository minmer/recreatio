/**
 * EIN KNOTEN DER STRUKTUR, OFFEN (2026-11-15) — Titel, Zweck, Kernsatz, Rolle, was er bringt, Ziele, Stand, Notizen;
 * die Teilung nach einer Dimension (und welche Werte absichtlich fehlen), seine Fassung unter einem geteilten
 * Knoten, die Vorlage, die Begriffe hier (Marken mit Rolle) und sein Text: „Schreiben" legt ihn an. Gespeichert wird
 * von selbst (`useEntryDraft`, wie jeder Eintrag). Darunter der Kontext dieser Stelle (`UnitContext`).
 */

import { useState } from 'react';

import { useT } from '../../core/i18n';
import { WorkspaceError } from '../../core/session';
import { useEntryDraft } from '../../library/entryDraft';
import { ids, itemsOf, MARK_ROLES, NODE_STATUS, num, str, wordCount, type EntryData } from '../../library/libraryKinds';
import { viewPath } from '../../routes';
import { toast } from '../../ui/dialogs';
import { EntityPick, entityLabel } from './EntityPick';
import { UnitContext } from './UnitContext';
import { applyTemplate, planFromTemplate, templateSig } from './workTemplates';
import type { WorkNode } from './workModel';
import { pathKeyOf, type WorkCtx } from './WorkView';

export function NodePanel({ ctx, node }: { ctx: WorkCtx; node: WorkNode }) {
  const t = useT();
  const { store, work, lens } = ctx;
  const { model, knowledge, templates } = work;
  const readOnly = ctx.readOnly;
  const draft = useEntryDraft(store, store.get(node.id), 'node', () => ({ project: ctx.project.id }), readOnly);
  const { data, set } = draft;
  const [busy, setBusy] = useState(false);
  const parent = node.parent === null ? undefined : model.nodes.get(node.parent);
  const parentDim = parent === undefined || parent.split === '' ? undefined : model.dimensions.find((d) => d.key === parent.split);
  const split = str(data, 'split');
  const splitDim = model.dimensions.find((d) => d.key === split);
  const skip = itemsOf(data, 'skip');
  const marks = itemsOf(data, 'marks');
  const textId = ids(data, 'text')[0];
  const text = textId === undefined ? undefined : store.get(textId);
  const templateId = ids(data, 'template')[0];
  const template = templateId === undefined ? undefined : templates.get(templateId);
  const numberOr = (v: string): number | '' => (v.trim() === '' ? '' : Number(v.replace(',', '.')));
  const field = (key: string, area = false) => (
    <label className={`wk-field${area ? ' is-wide' : ''}`}>
      <span>{t(`libraryKinds.node.fields.${key}.label`)}</span>
      {area
        ? <textarea rows={key === 'notes' ? 3 : 2} value={str(data, key)} disabled={readOnly} onChange={(e) => set({ [key]: e.target.value })} />
        : <input value={str(data, key)} disabled={readOnly} onChange={(e) => set({ [key]: e.target.value })} />}
    </label>
  );

  const run = async (todo: () => Promise<unknown>) => {
    setBusy(true);
    try { await todo(); } catch (e) { toast(e instanceof WorkspaceError ? e.message : t('workUi.tree.saveFailed'), { kind: 'error' }); } finally { setBusy(false); }
  };
  const write = () => void run(async () => {
    const made = await store.save({
      kind: 'text',
      data: {
        title: str(data, 'title') || t('work.untitled'), project: ctx.project.id, status: 'idea',
        ...(template === undefined ? {} : { plan: planFromTemplate(template), ...(template.targetWords === null ? {} : { targetWords: template.targetWords }) }),
        ...(str(data, 'synopsis') === '' ? {} : { summary: str(data, 'synopsis') })
      }
    });
    await draft.commit({ text: made.id, ...(template === undefined ? {} : { templateSig: templateSig(template) }) });
    window.location.hash = viewPath('scriptorium', ctx.library.libraryId, made.id);
  });
  const apply = () => void run(async () => {
    if (template === undefined) return;
    if (text !== undefined && text.kind === 'text') {
      await store.save({ id: text.id, kind: 'text', ...(text.key === undefined ? {} : { key: text.key }), data: { ...text.data, plan: applyTemplate(text.data, template) } });
    }
    await draft.commit({
      templateSig: templateSig(template),
      ...(num(data, 'targetWords') === null && template.targetWords !== null ? { targetWords: template.targetWords } : {}),
      ...(num(data, 'targetMinutes') === null && template.targetMinutes !== null ? { targetMinutes: template.targetMinutes } : {})
    });
    toast(t('workUi.node.applied'));
  });
  const setMarks = (next: Record<string, unknown>[]) => set({ marks: next });
  const setSkip = (next: Record<string, unknown>[]) => set({ skip: next });

  return (
    <section className="work-node lib-box" aria-label={t('workUi.node.label')}>
      <header className="work-node-head">
        <h2 className="lib-box-h">{t('workUi.node.label')}</h2>
        <p className={`lib-state is-${draft.state}`} role="status">{draft.status}</p>
        <a className="wk-link-btn" href={ctx.href('struktura')} aria-label={t('common.close')}>×</a>
      </header>
      {draft.failed !== null && <p className="wk-error">{draft.failed}</p>}
      {draft.state === 'stale' && (
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-small" onClick={draft.reloadTheirs}>{t('scriptorium.editor.loadTheirs')}</button>
          <button type="button" className="wk-link-btn" onClick={() => void draft.saveNow()}>{t('scriptorium.editor.keepMine')}</button>
        </div>
      )}

      <div className="lib-fields">
        {field('title')}
        {field('purpose', true)}
        {field('synopsis', true)}
        <label className="wk-field">
          <span>{t('libraryKinds.node.fields.role.label')}</span>
          <select value={str(data, 'role')} disabled={readOnly} onChange={(e) => set({ role: e.target.value })}>
            <option value="">{t('workUi.node.none')}</option>
            {model.roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <label className="wk-field">
          <span>{t('libraryKinds.node.fields.status.label')}</span>
          <select value={str(data, 'status')} disabled={readOnly} onChange={(e) => set({ status: e.target.value })}>
            <option value="">{t('workUi.node.none')}</option>
            {NODE_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        {field('brings', true)}
        <label className="wk-field">
          <span>{t('libraryKinds.node.fields.targetWords.label')}</span>
          <input type="number" min={0} value={str(data, 'targetWords')} disabled={readOnly} onChange={(e) => set({ targetWords: numberOr(e.target.value) })} />
        </label>
        <label className="wk-field">
          <span>{t('libraryKinds.node.fields.targetMinutes.label')}</span>
          <input type="number" min={0} step="0.5" value={str(data, 'targetMinutes')} disabled={readOnly} onChange={(e) => set({ targetMinutes: numberOr(e.target.value) })} />
        </label>
        {parentDim !== undefined && (
          <label className="wk-field">
            <span>{t('workUi.node.variant', { dimension: parentDim.name })}</span>
            <select value={str(data, 'variant')} disabled={readOnly} onChange={(e) => set({ variant: e.target.value })}>
              <option value="">{t('workUi.tree.core')}</option>
              {parentDim.values.map((v) => <option key={v.key} value={v.key}>{v.name}</option>)}
            </select>
          </label>
        )}
        {model.dimensions.length > 0 && (
          <label className="wk-field">
            <span>{t('libraryKinds.node.fields.split.label')}</span>
            <select value={split} disabled={readOnly} onChange={(e) => set({ split: e.target.value })}>
              <option value="">{t('workUi.node.noSplit')}</option>
              {model.dimensions.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
            </select>
          </label>
        )}
        {templates.size > 0 && (
          <label className="wk-field">
            <span>{t('libraryKinds.node.fields.template.label')}</span>
            <select value={templateId ?? ''} disabled={readOnly} onChange={(e) => set({ template: e.target.value })}>
              <option value="">{t('workUi.node.none')}</option>
              {[...templates.values()].map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name || t('work.untitled')}</option>)}
            </select>
          </label>
        )}
        {field('notes', true)}
      </div>

      {splitDim !== undefined && (
        <fieldset className="work-skip">
          <legend>{t('workUi.node.skipLegend', { dimension: splitDim.name })}</legend>
          {splitDim.values.map((v) => {
            const at = skip.findIndex((s) => str(s, 'value') === v.key);
            const has = node.children.some((c) => c.variant === v.key);
            return (
              <div key={v.key} className="work-skip-row">
                <label className="pe-check">
                  <input type="checkbox" checked={at >= 0} disabled={readOnly} onChange={(e) => setSkip(e.target.checked ? [...skip, { value: v.key }] : skip.filter((_, i) => i !== at))} />
                  <span>{t('workUi.node.notNeeded', { value: v.name })}{has ? ` ${t('workUi.node.hasVersion')}` : ''}</span>
                </label>
                {at >= 0 && <input value={str(skip[at], 'note')} disabled={readOnly} placeholder={t('workUi.node.skipWhy')} aria-label={t('workUi.node.skipWhy')} onChange={(e) => setSkip(skip.map((s, i) => (i === at ? { ...s, note: e.target.value } : s)))} />}
              </div>
            );
          })}
        </fieldset>
      )}

      <section className="work-marks">
        <h3 className="lib-box-sub">{t('libraryKinds.node.fields.marks.label')}</h3>
        {marks.length === 0 && <p className="wk-empty">{t('workUi.node.noMarks')}</p>}
        <ul className="work-mark-list">
          {marks.map((m, i) => {
            const id = str(m, 'entry');
            return (
              <li key={`${id}-${i}`} className="work-mark">
                <span className="work-mark-name">{entityLabel(id, knowledge, lens) ?? t('work.check.someEntry')}</span>
                <select value={str(m, 'role') || 'use'} disabled={readOnly} aria-label={t('libraryKinds.markItem.role.label')}
                  onChange={(e) => setMarks(marks.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}>
                  {MARK_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <input value={str(m, 'note')} disabled={readOnly} placeholder={t('libraryKinds.markItem.note.label')} aria-label={t('libraryKinds.markItem.note.label')}
                  onChange={(e) => setMarks(marks.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
                {!readOnly && <button type="button" className="wk-link-btn wk-danger" aria-label={t('common.delete')} onClick={() => setMarks(marks.filter((_, j) => j !== i))}>×</button>}
              </li>
            );
          })}
        </ul>
        {!readOnly && (
          <EntityPick lens={lens} knowledge={knowledge} onPick={(entry) => setMarks([...marks, { entry, role: marks.some((m) => str(m, 'entry') === entry) ? 'use' : 'intro' }])} />
        )}
      </section>

      <section className="work-text">
        <h3 className="lib-box-sub">{t('libraryKinds.node.fields.text.label')}</h3>
        {text !== undefined && text.kind === 'text' ? (
          <p>
            <a className="wk-link" href={viewPath('scriptorium', ctx.library.libraryId, text.id)}>{str(text.data, 'title') || t('work.untitled')}</a>
            {' '}<span className="lib-meta">{t('workUi.tree.words', { count: wordCount(str(text.data, 'body')) })}</span>
          </p>
        ) : textId !== undefined ? <p className="wk-note">{t('workUi.node.textMissing')}</p> : null}
        <div className="wk-actions">
          {(text === undefined || text.kind !== 'text') && !readOnly && <button type="button" className="wk-btn wk-btn-small" disabled={busy || draft.state === 'new'} onClick={write}>{t('workUi.node.write')}</button>}
          {template !== undefined && !readOnly && <button type="button" className="wk-btn wk-btn-small wk-btn-line" disabled={busy} onClick={apply}>{t('workUi.node.applyTemplate')}</button>}
        </div>
      </section>

      <UnitContext work={work} store={store} lens={lens} node={node} pathKey={pathKeyOf(ctx)} href={ctx.href} />
    </section>
  );
}

/** Ein Patch nur mit den Feldern, die nicht leer sind (für neue Knoten). */
export const compact = (data: EntryData): EntryData => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '' && v !== undefined && v !== null));
