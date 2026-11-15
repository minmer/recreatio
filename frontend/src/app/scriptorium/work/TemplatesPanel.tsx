/**
 * VORLAGEN UND ZYKLEN (2026-11-15) — die Vorlagen der Einheiten (sie gehören dem Skryptorium, jedes Projekt nutzt
 * sie) und der Zyklus: N Einheiten aus einer Vorlage an ihren Stellen, auf Wunsch jede zehnte eine Zusammenfassung,
 * geteilt nach einer Dimension (mit gemeinsamem Kern), gleich mit Texten — gespeichert in EINEM Zapis.
 * `PartsEditor`: die Teile einer Vorlage (das Feld `parts`, das die einfachen Felder nicht zeichnen).
 */

import { useState } from 'react';

import { useT } from '../../core/i18n';
import { WorkspaceError } from '../../core/session';
import { itemsOf, POINT_KINDS, str, type EntryData } from '../../library/libraryKinds';
import { viewPath } from '../../routes';
import { toast } from '../../ui/dialogs';
import { allNodes } from './workModel';
import { cycleFrom, templateSig } from './workTemplates';
import type { WorkCtx } from './WorkView';

export function TemplatesPanel({ ctx }: { ctx: WorkCtx }) {
  const t = useT();
  const { templates, model } = ctx.work;
  const lib = ctx.library.libraryId;
  const list = [...templates.values()];
  const [template, setTemplate] = useState(list[0]?.id ?? '');
  const [parent, setParent] = useState('');
  const [count, setCount] = useState('10');
  const [title, setTitle] = useState(t('workUi.templates.titlePattern'));
  const [recap, setRecap] = useState('');
  const [splitBy, setSplitBy] = useState('');
  const [core, setCore] = useState(true);
  const [withTexts, setWithTexts] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const chosen = templates.get(template) ?? list[0];
  const outdated = allNodes(model).filter((n) => n.template !== null && n.templateSig !== '' && templates.get(n.template) !== undefined && templateSig(templates.get(n.template)!) !== n.templateSig);

  const generate = async () => {
    if (chosen === undefined) return;
    const inputs = cycleFrom(model, {
      template: chosen, parent: parent === '' ? null : model.nodes.get(parent) ?? null, count: Number(count) || 1, title,
      recapEvery: Number(recap) || 0, ...(splitBy === '' ? {} : { splitBy, core }), withTexts
    });
    setBusy(t('workUi.templates.saving', { done: 0, total: inputs.length }));
    try {
      await ctx.store.saveAll(inputs, (done, total) => setBusy(t('workUi.templates.saving', { done, total })));
      toast(t('workUi.templates.made', { count: inputs.filter((i) => i.kind === 'node').length }));
      window.location.hash = ctx.href('struktura');
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : t('workUi.tree.saveFailed'), { kind: 'error' });
    } finally { setBusy(null); }
  };

  return (
    <div className="work-templates">
      <section>
        <h2 className="wk-h2">{t('workUi.templates.title')} <span className="lib-count">{list.length}</span></h2>
        <p className="lib-meta">{t('workUi.templates.lead')}</p>
        {list.length === 0 ? <p className="wk-empty">{t('workUi.templates.none')}</p> : (
          <ul className="lib-list">
            {list.map((tpl) => (
              <li key={tpl.id}>
                <a className="lib-row" href={viewPath('scriptorium', lib, tpl.id)}>
                  <span className="lib-row-title">{tpl.name || t('work.untitled')}</span>
                  <span className="lib-row-meta">{tpl.parts.map((p) => p.title || p.id).join(' · ')}{tpl.targetWords !== null ? ` · ${t('workUi.tree.words', { count: tpl.targetWords })}` : ''}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {!ctx.readOnly && <div className="wk-actions"><a className="wk-btn wk-btn-small wk-btn-line" href={viewPath('scriptorium', lib, 'nowy', 'unittemplate')}>{t('workUi.templates.add')}</a></div>}
      </section>

      {outdated.length > 0 && (
        <section>
          <h2 className="wk-h2">{t('workUi.templates.outdated')} <span className="lib-count">{outdated.length}</span></h2>
          <ul className="work-plain">
            {outdated.slice(0, 50).map((n) => <li key={n.id}><a className="wk-link" href={ctx.href('struktura', n.id)}>{n.title || t('work.untitled')}</a></li>)}
          </ul>
        </section>
      )}

      {list.length > 0 && !ctx.readOnly && !model.fromOutline && (
        <form className="wk-form work-cycle" onSubmit={(e) => { e.preventDefault(); void generate(); }}>
          <h2 className="wk-h2">{t('workUi.templates.cycle')}</h2>
          <p className="lib-meta">{t('workUi.templates.cycleLead')}</p>
          <div className="lib-fields">
            <label className="wk-field">
              <span>{t('workUi.templates.template')}</span>
              <select value={chosen?.id ?? ''} onChange={(e) => setTemplate(e.target.value)}>
                {list.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name || t('work.untitled')}</option>)}
              </select>
            </label>
            <label className="wk-field">
              <span>{t('workUi.templates.under')}</span>
              <select value={parent} onChange={(e) => setParent(e.target.value)}>
                <option value="">{t('workUi.templates.top')}</option>
                {allNodes(model).map((n) => <option key={n.id} value={n.id}>{'· '.repeat(n.depth)}{n.title || t('work.untitled')}</option>)}
              </select>
            </label>
            <label className="wk-field">
              <span>{t('workUi.templates.count')}</span>
              <input type="number" min={1} max={1000} value={count} onChange={(e) => setCount(e.target.value)} />
            </label>
            <label className="wk-field">
              <span>{t('workUi.templates.titleLabel')}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="wk-field">
              <span>{t('workUi.templates.recap')}</span>
              <input type="number" min={0} value={recap} placeholder="0" onChange={(e) => setRecap(e.target.value)} />
            </label>
            {model.dimensions.length > 0 && (
              <label className="wk-field">
                <span>{t('workUi.templates.splitBy')}</span>
                <select value={splitBy} onChange={(e) => setSplitBy(e.target.value)}>
                  <option value="">{t('workUi.node.noSplit')}</option>
                  {model.dimensions.map((d) => <option key={d.key} value={d.key}>{d.name}</option>)}
                </select>
              </label>
            )}
          </div>
          {splitBy !== '' && (
            <label className="pe-check"><input type="checkbox" checked={core} onChange={(e) => setCore(e.target.checked)} /><span>{t('workUi.templates.core')}</span></label>
          )}
          <label className="pe-check"><input type="checkbox" checked={withTexts} onChange={(e) => setWithTexts(e.target.checked)} /><span>{t('workUi.templates.withTexts')}</span></label>
          <div className="wk-actions">
            <button type="submit" className="wk-btn" disabled={busy !== null}>{busy ?? t('workUi.templates.generate')}</button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Die Teile einer Vorlage: Kennung, Titel, Art, Wörter, Minuten, Notiz — in ihrer Reihenfolge. */
export function PartsEditor({ data, set, readOnly }: { data: EntryData; set: (patch: EntryData) => void; readOnly: boolean }) {
  const t = useT();
  const parts = itemsOf(data, 'parts');
  const put = (next: Record<string, unknown>[]) => set({ parts: next });
  const change = (i: number, key: string, value: unknown) => put(parts.map((p, j) => (j === i ? { ...p, [key]: value } : p)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= parts.length) return;
    const next = [...parts];
    [next[i], next[j]] = [next[j], next[i]];
    put(next);
  };
  const numberOr = (v: string): number | '' => (v.trim() === '' ? '' : Number(v.replace(',', '.')));
  return (
    <section className="work-parts">
      <h2 className="wk-h2">{t('libraryKinds.unitTemplate.fields.parts.label')}</h2>
      {parts.length === 0 && <p className="wk-empty">{t('workUi.templates.noParts')}</p>}
      <ol className="work-part-list">
        {parts.map((p, i) => (
          <li key={i} className="work-part">
            <input value={str(p, 'title')} disabled={readOnly} placeholder={t('libraryKinds.partItem.title.label')} aria-label={t('libraryKinds.partItem.title.label')} onChange={(e) => change(i, 'title', e.target.value)} />
            <input className="work-part-id" value={str(p, 'id')} disabled={readOnly} placeholder={t('libraryKinds.partItem.id.label')} aria-label={t('libraryKinds.partItem.id.label')} onChange={(e) => change(i, 'id', e.target.value.replace(/[^A-Za-z0-9_-]/g, ''))} />
            <select value={str(p, 'kind') || 'thought'} disabled={readOnly} aria-label={t('libraryKinds.partItem.kind.label')} onChange={(e) => change(i, 'kind', e.target.value)}>
              {POINT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <input type="number" min={0} value={str(p, 'words')} disabled={readOnly} placeholder={t('libraryKinds.partItem.words.label')} aria-label={t('libraryKinds.partItem.words.label')} onChange={(e) => change(i, 'words', numberOr(e.target.value))} />
            <input type="number" min={0} step="0.5" value={str(p, 'minutes')} disabled={readOnly} placeholder={t('libraryKinds.partItem.minutes.label')} aria-label={t('libraryKinds.partItem.minutes.label')} onChange={(e) => change(i, 'minutes', numberOr(e.target.value))} />
            <input className="work-part-note" value={str(p, 'note')} disabled={readOnly} placeholder={t('libraryKinds.partItem.note.label')} aria-label={t('libraryKinds.partItem.note.label')} onChange={(e) => change(i, 'note', e.target.value)} />
            {!readOnly && (
              <span className="work-part-tools">
                <button type="button" className="wk-link-btn" aria-label={t('workUi.tree.up')} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="wk-link-btn" aria-label={t('workUi.tree.down')} onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="wk-link-btn wk-danger" aria-label={t('common.delete')} onClick={() => put(parts.filter((_, j) => j !== i))}>×</button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {!readOnly && <div className="wk-actions"><button type="button" className="wk-btn wk-btn-small wk-btn-line" onClick={() => put([...parts, { id: `t${parts.length + 1}`, title: '', kind: 'thought' }])}>{t('workUi.templates.addPart')}</button></div>}
    </section>
  );
}
