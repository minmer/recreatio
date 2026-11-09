import { useMemo, useState } from 'react';
import { useT } from '../../core/i18n';
import type { OpenLibrary } from '../library';
import type { LibraryStore } from '../libraryStore';
import { entitiesOf, planImport, type ImportPlan } from './resources';
import { effectiveEntities } from './defaults';
import { commitImport, exportEntities, storeStamp } from './persistence';
import { jsonSchema, type LitEntity } from './schema';
import { download } from './export';
import { liturgyDescription } from './description';
import example from '../../../../../templates/liturgy/complete-example.json';

export function ImportPanel({ store, library, initial }: { store: LibraryStore; library: OpenLibrary; initial?: LitEntity }) {
  const t = useT();
  const [text, setText] = useState(initial ? JSON.stringify(exportEntities([{ ...initial, revision: initial.revision + 1 }]), null, 2) : '');
  const [mode, setMode] = useState<'add' | 'update'>(initial ? 'update' : 'add');
  const [provenance, setProvenance] = useState('');
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [failed, setFailed] = useState('');
  const stamp = storeStamp(store);
  const preview = useMemo<{ raw?: unknown; plan?: ImportPlan; error?: string }>(() => {
    if (!text.trim()) return {};
    try {
      const parsed = JSON.parse(text);
      const raw = parsed?.format === 'recreatio.liturgy' ? { ...parsed, provenance: provenance || parsed.provenance } : exportEntities([parsed], provenance);
      return { raw, plan: planImport(raw, effectiveEntities(entitiesOf(store.all())), mode, approved, entitiesOf(store.all())) };
    } catch (e) { return { error: e instanceof Error ? e.message : t('common.failed') }; }
  }, [text, mode, provenance, approved, stamp, store, t]);
  const count = (preview.plan?.create.length ?? 0) + (preview.plan?.update.length ?? 0) + (preview.plan?.remove.length ?? 0) + (preview.plan?.reset.length ?? 0);
  const effectiveMode = preview.plan?.mode ?? mode;
  return <section className="lit-import">
    <h2 className="wk-h2">{t('liturgy.importTitle')}</h2><p>{t('liturgy.importHint')}</p>
    <div className="wk-actions">
      <button className="wk-btn wk-btn-quiet" onClick={() => download('liturgy-import.md', liturgyDescription(), 'text/markdown')}>{t('liturgy.fullGuide')}</button>
      <button className="wk-btn wk-btn-quiet" onClick={() => download('liturgy.schema.json', JSON.stringify(jsonSchema(), null, 2))}>{t('liturgy.schema')}</button>
      <button className="wk-btn wk-btn-quiet" onClick={() => download('liturgy.json', JSON.stringify(exportEntities(entitiesOf(store.all())), null, 2))}>{t('liturgy.exportJson')}</button>
      {library.writes && <button className="wk-btn wk-btn-quiet" disabled={busy} onClick={async () => {
        setBusy(true); setFailed(''); setMessage('');
        try { const result = await store.refreshAiNow(true); if (result?.failed) setFailed(t('liturgy.snapshotFailed')); else setMessage(t('liturgy.snapshotRefreshed', { count: result?.refreshed ?? 0 })); }
        catch { setFailed(t('liturgy.snapshotFailed')); } finally { setBusy(false); }
      }}>{t('liturgy.refreshSnapshot')}</button>}
    </div>
    <p className="lit-meta">{t('liturgy.exampleHint')}</p>
    {library.writes && <button className="wk-btn wk-btn-quiet" disabled={busy || text.trim().length > 0} onClick={() => setText(JSON.stringify(example, null, 2))}>{t('liturgy.loadExample')}</button>}
    {!library.writes ? <p className="lit-meta">{t('liturgy.readOnly')}</p> : <>
      <label className="wk-field"><span>{t('liturgy.jsonFile')}</span><input type="file" accept="application/json,.json" disabled={busy} onChange={async e => {
        const file = e.target.files?.[0]; if (!file) return;
        if (file.size > 16 * 1024 * 1024) { setFailed(t('liturgy.errors.file_size')); return; }
        try { setText(await file.text()); setFailed(''); } catch { setFailed(t('common.failed')); }
      }} /></label>
      <label className="wk-field"><span>{t('liturgy.json')}</span><textarea className="lit-json" value={text} onChange={e => { setText(e.target.value); setMessage(''); }} disabled={busy} spellCheck={false} rows={14} /></label>
      <div className="lit-controls">
        <label className="wk-field"><span>{t('liturgy.mode')}</span><select value={effectiveMode} onChange={e => {
          const next = e.target.value as 'add' | 'update'; setMode(next);
          try { const parsed = JSON.parse(text); if (parsed?.format === 'recreatio.liturgy') setText(JSON.stringify({ ...parsed, mode: next }, null, 2)); } catch { /* Keep incomplete JSON editable. */ }
        }} disabled={busy}><option value="add">{t('liturgy.additive')}</option><option value="update">{t('liturgy.controlled')}</option></select></label>
        <label className="wk-field"><span>{t('liturgy.provenance')}</span><input value={provenance} onChange={e => setProvenance(e.target.value)} disabled={busy} /></label>
      </div>
      {effectiveMode === 'update' && <label className="lit-check"><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} disabled={busy} />{t('liturgy.allowApproved')}</label>}
      {preview.error && <p className="wk-error">{preview.error}</p>}
      {preview.plan && <div className="lit-preview" aria-live="polite">
        <h3>{t('liturgy.preview')}</h3><p>{t('liturgy.importCounts', { created: preview.plan.create.length, updated: preview.plan.update.length, removed: preview.plan.remove.length, reset: preview.plan.reset.length, unchanged: preview.plan.unchanged })}</p>
        {preview.plan.create.length > 0 && <ul>{preview.plan.create.map(e => <li key={e.id}>{e.title} <code>{e.id}</code> · {t(`liturgy.types.${e.entity_type}`)}</li>)}</ul>}
        {preview.plan.update.map(change => <details key={change.after.id}><summary>{change.after.title} · {change.before.revision} → {change.after.revision}</summary><div className="lit-diff"><pre>{JSON.stringify(change.before, null, 2)}</pre><pre>{JSON.stringify(change.after, null, 2)}</pre></div></details>)}
        {preview.plan.remove.length > 0 && <><h3>{t('liturgy.removeTitle')}</h3><p>{t('liturgy.removeHint')}</p><ul>{preview.plan.remove.map(e => <li key={e.id}>{e.title} · <code>{e.id}</code> · {t('liturgy.revision', { revision: e.revision })}</li>)}</ul></>}
        {preview.plan.reset.length > 0 && <><h3>{t('liturgy.resetTitle')}</h3>{preview.plan.reset.map(change => <details key={change.before.id}><summary>{change.before.title}</summary><div className="lit-diff"><pre>{JSON.stringify(change.before, null, 2)}</pre><pre>{JSON.stringify(change.after, null, 2)}</pre></div></details>)}</>}
        {preview.plan.problems.length > 0 && <ul className="wk-error">{preview.plan.problems.map((p, i) => <li key={i}><strong>{p.id}</strong>: {t(`liturgy.errors.${p.code}`)} · {p.detail}</li>)}</ul>}
      </div>}
      <button className="wk-btn" disabled={busy || !preview.plan || preview.plan.problems.length > 0 || count === 0} onClick={async () => {
        if (!preview.plan) return; setBusy(true); setFailed(''); setMessage('');
        try { const count = await commitImport(store, preview.raw, preview.plan, mode, approved, stamp, library.areaPublic); setMessage(t('liturgy.saved', { count })); setText(''); setApproved(false); const refreshed = await store.refreshAiNow().catch(() => ({ failed: 1 })); if (refreshed?.failed) setFailed(t('liturgy.savedSnapshotFailed')); }
        catch (e) { const message = e instanceof Error ? e.message : 'common.failed'; setFailed(message.startsWith('liturgy.') ? t(message) : message); }
        finally { setBusy(false); }
      }}>{busy ? t('common.saving') : t('liturgy.confirmImport')}</button>
    </>}
    {message && <p className="wk-note" role="status">{message}</p>}{failed && <p className="wk-error" role="alert">{failed}</p>}
  </section>;
}
