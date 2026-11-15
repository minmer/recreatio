/**
 * DIE EINSTELLUNGEN EINES WERKS (2026-11-15) — Sprache und Druck, die Namen der Ebenen (und wie sie gedruckt werden),
 * die Dimensionen mit ihren Werten, die Wege (Ausgaben: ein Wert je Dimension), eigene Rollen und die Bazy wiedzy,
 * die das Wissen dieses Werks halten. Eine Baza, in der man schreibt, kann dieses Skryptorium als Quelle bekommen —
 * dann zeigen ihre Einträge zurück auf Knoten und Texte („gilt ab Kapitel 5").
 */

import { useEffect, useState } from 'react';

import { CogitaLibrary, readSettings } from '../../cogita/store';
import { useT } from '../../core/i18n';
import { WorkspaceError } from '../../core/session';
import { libraryKindOf, loadLibraries, openLibraries, type OpenLibrary } from '../../library/library';
import { CITATION_STYLES, itemsOf, LATEX_CLASSES, LATEX_LEVELS, ROLE_BRINGS, str, WORK_LANGS } from '../../library/libraryKinds';
import { storeOf } from '../../library/libraryStore';
import { toast } from '../../ui/dialogs';
import type { WorkCtx } from './WorkView';

type Item = Record<string, unknown>;
const keyOf = (v: string): string => v.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

export function WorkSettings({ ctx }: { ctx: WorkCtx }) {
  const t = useT();
  const d = ctx.project.data;
  const ro = ctx.readOnly;
  const set = ctx.setProject;
  const levels = itemsOf(d, 'levels');
  const dims = itemsOf(d, 'dimensions');
  const paths = itemsOf(d, 'paths');
  const roles = itemsOf(d, 'roles');
  const select = (key: string, options: readonly { value: string; label: string }[], empty: string) => (
    <label className="wk-field">
      <span>{t(`libraryKinds.project.fields.${key}.label`)}</span>
      <select value={str(d, key)} disabled={ro} onChange={(e) => set({ [key]: e.target.value })}>
        <option value="">{empty}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
  const change = (key: string, list: Item[], i: number, patch: Item) => set({ [key]: list.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const drop = (key: string, list: Item[], i: number) => set({ [key]: list.filter((_, j) => j !== i) });
  const dimsRead = ctx.work.model.dimensions;

  return (
    <div className="work-settings">
      <section className="wk-form">
        <h2 className="wk-h2">{t('workUi.settings.print')}</h2>
        <div className="lib-fields">
          {select('lang', WORK_LANGS, t('workUi.settings.appLang'))}
          {select('latexClass', LATEX_CLASSES, t('workUi.settings.defaultValue'))}
          {select('citationStyle', CITATION_STYLES, t('workUi.settings.defaultValue'))}
        </div>
      </section>

      <section className="wk-form">
        <h2 className="wk-h2">{t('libraryKinds.project.fields.levels.label')}</h2>
        <p className="lib-meta">{t('workUi.settings.levelsLead')}</p>
        <ol className="work-edit-list">
          {levels.map((l, i) => (
            <li key={i} className="work-edit-row">
              <input value={str(l, 'name')} disabled={ro} placeholder={t('libraryKinds.levelItem.name.label')} aria-label={t('libraryKinds.levelItem.name.label')} onChange={(e) => change('levels', levels, i, { name: e.target.value })} />
              <select value={str(l, 'latex')} disabled={ro} aria-label={t('libraryKinds.levelItem.latex.label')} onChange={(e) => change('levels', levels, i, { latex: e.target.value })}>
                <option value="">{t('workUi.settings.defaultValue')}</option>
                {LATEX_LEVELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {!ro && <button type="button" className="wk-link-btn wk-danger" aria-label={t('common.delete')} onClick={() => drop('levels', levels, i)}>×</button>}
            </li>
          ))}
        </ol>
        {!ro && <div className="wk-actions"><button type="button" className="wk-btn wk-btn-small wk-btn-line" onClick={() => set({ levels: [...levels, { name: '' }] })}>{t('workUi.settings.addLevel')}</button></div>}
      </section>

      <section className="wk-form">
        <h2 className="wk-h2">{t('libraryKinds.project.fields.dimensions.label')}</h2>
        <p className="lib-meta">{t('workUi.settings.dimensionsLead')}</p>
        {dims.map((dim, i) => {
          const values = itemsOf(dim, 'values');
          const setValues = (next: Item[]) => change('dimensions', dims, i, { values: next });
          return (
            <fieldset key={i} className="work-dim">
              <legend>{str(dim, 'name') || str(dim, 'key') || t('workUi.settings.newDimension')}</legend>
              <div className="work-edit-row">
                <input value={str(dim, 'key')} disabled={ro} placeholder={t('libraryKinds.dimensionItem.key.label')} aria-label={t('libraryKinds.dimensionItem.key.label')} onChange={(e) => change('dimensions', dims, i, { key: keyOf(e.target.value) })} />
                <input value={str(dim, 'name')} disabled={ro} placeholder={t('libraryKinds.dimensionItem.name.label')} aria-label={t('libraryKinds.dimensionItem.name.label')} onChange={(e) => change('dimensions', dims, i, { name: e.target.value })} />
                <label className="pe-check"><input type="checkbox" checked={str(dim, 'ordered') === 'yes'} disabled={ro} onChange={(e) => change('dimensions', dims, i, { ordered: e.target.checked ? 'yes' : 'no' })} /><span>{t('libraryKinds.dimensionItem.ordered.label')}</span></label>
                {!ro && <button type="button" className="wk-link-btn wk-danger" onClick={() => drop('dimensions', dims, i)}>{t('common.delete')}</button>}
              </div>
              <ol className="work-edit-list">
                {values.map((v, j) => (
                  <li key={j} className="work-edit-row">
                    <input value={str(v, 'key')} disabled={ro} placeholder={t('libraryKinds.valueItem.key.label')} aria-label={t('libraryKinds.valueItem.key.label')} onChange={(e) => setValues(values.map((x, k) => (k === j ? { ...x, key: keyOf(e.target.value) } : x)))} />
                    <input value={str(v, 'name')} disabled={ro} placeholder={t('libraryKinds.valueItem.name.label')} aria-label={t('libraryKinds.valueItem.name.label')} onChange={(e) => setValues(values.map((x, k) => (k === j ? { ...x, name: e.target.value } : x)))} />
                    {!ro && <button type="button" className="wk-link-btn wk-danger" aria-label={t('common.delete')} onClick={() => setValues(values.filter((_, k) => k !== j))}>×</button>}
                  </li>
                ))}
              </ol>
              {!ro && <div className="wk-actions"><button type="button" className="wk-btn wk-btn-small wk-btn-line" onClick={() => setValues([...values, { key: '', name: '' }])}>{t('workUi.settings.addValue')}</button></div>}
            </fieldset>
          );
        })}
        {!ro && <div className="wk-actions"><button type="button" className="wk-btn wk-btn-small wk-btn-line" onClick={() => set({ dimensions: [...dims, { key: '', name: '', ordered: 'no', values: [] }] })}>{t('workUi.settings.addDimension')}</button></div>}
      </section>

      {dimsRead.length > 0 && (
        <section className="wk-form">
          <h2 className="wk-h2">{t('libraryKinds.project.fields.paths.label')}</h2>
          <p className="lib-meta">{t('workUi.settings.pathsLead')}</p>
          {paths.map((p, i) => {
            const choose = itemsOf(p, 'choose');
            const valueOf = (dim: string) => str(choose.find((c) => str(c, 'dimension') === dim) ?? {}, 'value');
            const setChoice = (dim: string, value: string) => change('paths', paths, i, {
              choose: [...choose.filter((c) => str(c, 'dimension') !== dim), ...(value === '' ? [] : [{ dimension: dim, value }])]
            });
            return (
              <div key={i} className="work-edit-row work-path-row">
                <input value={str(p, 'key')} disabled={ro} placeholder={t('libraryKinds.pathItem.key.label')} aria-label={t('libraryKinds.pathItem.key.label')} onChange={(e) => change('paths', paths, i, { key: keyOf(e.target.value) })} />
                <input value={str(p, 'name')} disabled={ro} placeholder={t('libraryKinds.pathItem.name.label')} aria-label={t('libraryKinds.pathItem.name.label')} onChange={(e) => change('paths', paths, i, { name: e.target.value })} />
                {dimsRead.map((dim) => (
                  <select key={dim.key} value={valueOf(dim.key)} disabled={ro} aria-label={dim.name} onChange={(e) => setChoice(dim.key, e.target.value)}>
                    <option value="">{t('workUi.settings.firstValue', { dimension: dim.name })}</option>
                    {dim.values.map((v) => <option key={v.key} value={v.key}>{dim.name}: {v.name}</option>)}
                  </select>
                ))}
                {!ro && <button type="button" className="wk-link-btn wk-danger" aria-label={t('common.delete')} onClick={() => drop('paths', paths, i)}>×</button>}
              </div>
            );
          })}
          {!ro && (
            <div className="wk-actions">
              <button type="button" className="wk-btn wk-btn-small wk-btn-line" onClick={() => set({ paths: [...paths, { key: `p${paths.length + 1}`, name: '', choose: [] }] })}>{t('workUi.settings.addPath')}</button>
              {dimsRead.length === 1 && paths.length === 0 && (
                <button type="button" className="wk-link-btn" onClick={() => set({ paths: dimsRead[0].values.map((v) => ({ key: v.key, name: v.name, choose: [{ dimension: dimsRead[0].key, value: v.key }] })) })}>
                  {t('workUi.settings.pathPerValue', { dimension: dimsRead[0].name })}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      <section className="wk-form">
        <h2 className="wk-h2">{t('libraryKinds.project.fields.roles.label')}</h2>
        <p className="lib-meta">{t('workUi.settings.rolesLead', { list: ctx.work.model.roles.filter((r) => !r.own).map((r) => r.label).join(', ') })}</p>
        <ol className="work-edit-list">
          {roles.map((r, i) => (
            <li key={i} className="work-edit-row">
              <input value={str(r, 'value')} disabled={ro} placeholder={t('libraryKinds.roleItem.value.label')} aria-label={t('libraryKinds.roleItem.value.label')} onChange={(e) => change('roles', roles, i, { value: keyOf(e.target.value) })} />
              <input value={str(r, 'label')} disabled={ro} placeholder={t('libraryKinds.roleItem.label.label')} aria-label={t('libraryKinds.roleItem.label.label')} onChange={(e) => change('roles', roles, i, { label: e.target.value })} />
              <select value={str(r, 'brings') || 'any'} disabled={ro} aria-label={t('libraryKinds.roleItem.brings.label')} onChange={(e) => change('roles', roles, i, { brings: e.target.value })}>
                {ROLE_BRINGS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {!ro && <button type="button" className="wk-link-btn wk-danger" aria-label={t('common.delete')} onClick={() => drop('roles', roles, i)}>×</button>}
            </li>
          ))}
        </ol>
        {!ro && <div className="wk-actions"><button type="button" className="wk-btn wk-btn-small wk-btn-line" onClick={() => set({ roles: [...roles, { value: '', label: '', brings: 'any' }] })}>{t('workUi.settings.addRole')}</button></div>}
      </section>

      <Knowledge ctx={ctx} />
    </div>
  );
}

/** Die Bazy wiedzy des Werks — wählen, und ihnen dieses Skryptorium als Quelle geben. */
function Knowledge({ ctx }: { ctx: WorkCtx }) {
  const t = useT();
  const [bases, setBases] = useState<readonly OpenLibrary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const chosen = itemsOf(ctx.project.data, 'knowledge');
  const ids = chosen.map((b) => str(b, 'base'));

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const rows = await openLibraries(ctx.me.ring, (await loadLibraries()).libraries);
        if (alive) setBases(rows.filter((r) => libraryKindOf(r) === 'knowledge'));
      } catch { if (alive) setBases([]); }
    })();
    return () => { alive = false; };
  }, [ctx.me.ring, tick]);

  const linked = (base: OpenLibrary): boolean | null => {
    const store = storeOf(ctx.me.ring, base);
    if (!store.loaded) return null;
    return readSettings(store.all().find((e) => e.kind === 'settings')?.data).sources.some((s) => s.id === ctx.library.libraryId);
  };
  const link = (base: OpenLibrary) => void (async () => {
    setBusy(true);
    try {
      const store = storeOf(ctx.me.ring, base);
      await store.sync();
      const lib = new CogitaLibrary(store, true);
      const had = lib.settings().sources;
      if (!had.some((s) => s.id === ctx.library.libraryId)) {
        await lib.saveSettings({ sources: [...had, { id: ctx.library.libraryId, kind: 'writing', name: ctx.library.name }] });
      }
      toast(t('workUi.settings.linked', { base: base.name }));
      setTick((n) => n + 1);
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : t('workUi.tree.saveFailed'), { kind: 'error' });
    } finally { setBusy(false); }
  })();
  useEffect(() => {
    if (bases === null) return;
    for (const b of bases) if (ids.includes(b.libraryId)) void storeOf(ctx.me.ring, b).sync().then(() => setTick((n) => n + 1), () => undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bases]);

  return (
    <section className="wk-form">
      <h2 className="wk-h2">{t('libraryKinds.project.fields.knowledge.label')}</h2>
      <p className="lib-meta">{t('workUi.settings.knowledgeLead')}</p>
      {bases === null ? <p className="wk-empty">{t('common.loading')}</p> : bases.length === 0 ? <p className="wk-empty">{t('workUi.settings.noBases')}</p> : (
        <ul className="work-plain work-bases">
          {bases.map((b) => {
            const on = ids.includes(b.libraryId);
            const back = on ? linked(b) : null;
            return (
              <li key={b.libraryId} className="work-base">
                <label className="pe-check">
                  <input type="checkbox" checked={on} disabled={ctx.readOnly}
                    onChange={(e) => ctx.setProject({ knowledge: e.target.checked ? [...chosen, { base: b.libraryId }] : chosen.filter((c) => str(c, 'base') !== b.libraryId) })} />
                  <span>{b.name}</span>
                </label>
                {on && back === false && b.writes && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => link(b)}>{t('workUi.settings.linkBack')}</button>}
                {on && back === false && !b.writes && <span className="lib-meta">{t('workUi.settings.linkBackNoWrite')}</span>}
                {on && back === true && <span className="lib-meta">{t('workUi.settings.linkedBack')}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
