/**
 * WEJŚCIA Z BIBLIOTEKI — anlegen, ändern, löschen (2026-10-25, Wywód; das Modell in `anchors.ts`).
 *
 * Zwei Orte: unter einem Eintrag („Wejścia z Biblioteki" — die, die bei ihm ankommen, mit dem
 * Werk und der Stelle, die er selbst nennt, als Vorschlag) und die Liste aller Wejścia der Baza
 * („Więcej → Wejścia z Biblioteki"). Was hier gespeichert wird, liegt in der Baza; die Bibliothek
 * zeigt es an ihren Werken, wenn ihr Leser die Baza lesen kann.
 */

import { useState } from 'react';

import { containerPath } from '../library/library';
import { ask } from '../ui/dialogs';
import { anchorData, anchorPath, anchorPlace, anchorProblems, anchorsAt, anchorsOf, type Anchor } from './anchors';
import { placeOf } from './structure';
import { EntityPicker, useBusy, useCtx } from './ui';
import { TexText } from '../ui/tex/Tex';
import { useT } from '../core/i18n';

type Draft = Omit<Anchor, 'id'>;

const EMPTY: Draft = { name: '', work: '', locator: '', entry: '', view: '', note: '' };

/** Ein Wejście bearbeiten — neu (ohne `id`) oder ein vorhandenes. */
function AnchorForm({ id, initial, onDone }: { id: string | null; initial: Draft; onDone: () => void }) {
  const t = useT();
  const { lib } = useCtx();
  const { busy, failed, run } = useBusy();
  const [draft, setDraft] = useState<Draft>(initial);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const problems = anchorProblems(lib, draft);
  const blocking = draft.work === '' || (draft.entry === '' && draft.view === '');
  const views = lib.docs('view');
  const save = () => run(async () => {
    await lib.saveDoc('anchor', anchorData(draft), id ?? undefined);
    onDone();
  });
  return (
    <form className="wk-form cg" data-anchor-form="" onSubmit={(e) => { e.preventDefault(); if (!blocking) void save(); }}>
      <label className="wk-field"><span>{t('cogitaData.anchors.name')}</span>
        <input value={draft.name} placeholder={t('cogitaData.anchors.namePlaceholder')} onChange={(e) => set({ name: e.target.value })} />
      </label>
      <label className="wk-field"><span>{t('cogitaData.anchors.work')}</span>
        <EntityPicker lib={lib} refs kinds={['work']} value={draft.work === '' ? null : draft.work} placeholder={t('cogitaData.anchors.workSearch')} onPick={(w) => set({ work: w ?? '' })} />
      </label>
      <label className="wk-field"><span>{t('cogitaData.anchors.parts')}</span>
        <input value={draft.locator} placeholder={t('cogitaData.anchors.partsPlaceholder')} onChange={(e) => set({ locator: e.target.value })} aria-label={t('cogitaData.anchors.partsLabel')} />
      </label>
      {draft.work !== '' && <p className="cg-muted">{t('cogitaData.anchors.read', { place: anchorPlace(lib, draft) })}</p>}
      <label className="wk-field"><span>{t('cogitaData.anchors.entry')}</span>
        <EntityPicker lib={lib} value={draft.entry === '' ? null : draft.entry} placeholder={t('cogitaData.anchors.entrySearch')} onPick={(x) => set({ entry: x ?? '' })} />
      </label>
      <label className="wk-field"><span>{t('cogitaData.anchors.view')}</span>
        <select value={draft.view} onChange={(e) => set({ view: e.target.value })}>
          <option value="">{t('cogitaData.anchors.entryPage')}</option>
          {views.map((v) => <option key={v.id} value={v.id}>{typeof v.data.name === 'string' ? v.data.name : t('cogitaData.docKind.view')}</option>)}
        </select>
      </label>
      <label className="wk-field"><span>{t('cogitaData.anchors.note')}</span>
        <input value={draft.note} onChange={(e) => set({ note: e.target.value })} />
      </label>
      {problems.map((p) => <p key={p} className="wk-warn">{p}</p>)}
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || blocking}>{id === null ? t('cogitaData.anchors.create') : t('common.save')}</button>
        <button type="button" className="wk-link-btn" onClick={onDone}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}

/** Eine Zeile: Name, Werk und Stelle, wohin; Taten für Autoren. */
function AnchorRow({ anchor, onEdit, showEntry }: { anchor: Anchor; onEdit?: () => void; showEntry: boolean }) {
  const t = useT();
  const { lib, writes } = useCtx();
  const { busy, run } = useBusy();
  const work = lib.entity(anchor.work);
  const workLibrary = lib.origin(anchor.work)?.libraryId;
  const entry = anchor.entry === '' ? undefined : lib.entity(anchor.entry);
  const view = anchor.view === '' ? undefined : lib.docs('view').find((v) => v.id === anchor.view);
  const remove = () => run(async () => {
    if (!(await ask({ title: t('cogitaData.anchors.removeTitle', { name: anchor.name }), body: t('cogitaData.anchors.removeBody'), confirm: t('common.delete'), danger: true }))) return;
    await lib.remove(anchor.id);
  });
  return (
    <li className="cg-anchor" data-anchor={anchor.id}>
      {/* 2026-11-01 — Namen (Wejście, Werk, Eintrag, Widok) mit ihren Wzory. */}
      <a className="cg-anchor-name" href={anchorPath(lib.libraryId, anchor)}><TexText text={anchor.name} /></a>
      <span className="cg-muted">
        {work === undefined ? t('cogitaData.import.preview.workMissing') : workLibrary === undefined ? <TexText text={lib.labelTex(work)} /> : <a href={containerPath(workLibrary, work.id)}><TexText text={lib.labelTex(work)} /></a>}
        {' · '}{anchorPlace(lib, anchor)}
        {showEntry && entry !== undefined && <> · → <TexText text={lib.labelTex(entry)} /></>}
        {view !== undefined && <> · <TexText text={typeof view.data.name === 'string' ? view.data.name : t('cogitaData.docKind.view')} /></>}
      </span>
      {writes && (
        <span className="cg-row">
          {onEdit !== undefined && <button type="button" className="wk-link-btn" disabled={busy} onClick={onEdit}>{t('common.change')}</button>}
          <button type="button" className="wk-link-btn wk-danger-link" disabled={busy} onClick={() => void remove()}>{t('common.delete')}</button>
        </span>
      )}
    </li>
  );
}

/** Unter einem Eintrag: die Wejścia, die bei ihm ankommen — und ein neues, mit seinem Werk und seiner Stelle als Vorschlag. */
export function EntityAnchors({ entityId }: { entityId: string }) {
  const t = useT();
  const { lib, writes } = useCtx();
  const [editing, setEditing] = useState<string | null>(null);
  const anchors = anchorsAt(lib, entityId);
  if (anchors.length === 0 && !writes) return null;
  const entity = lib.entity(entityId);
  const place = entity === undefined ? null : placeOf(entity, lib);
  const fresh: Draft = { ...EMPTY, name: entity === undefined ? '' : lib.label(entity).slice(0, 120), work: place?.work ?? '', locator: place?.locator ?? '', entry: entityId };
  return (
    <section className="cg-card" data-entity-anchors="">
      <h3>{t('cogitaData.anchors.title')}</h3>
      <p className="cg-muted">{t('cogitaData.anchors.lead')}</p>
      {anchors.length > 0 && (
        <ul className="cg-anchors">
          {anchors.map((a) => (writes && editing === a.id
            ? <li key={a.id}><AnchorForm id={a.id} initial={a} onDone={() => setEditing(null)} /></li>
            : <AnchorRow key={a.id} anchor={a} showEntry={false} onEdit={() => setEditing(a.id)} />))}
        </ul>
      )}
      {writes && (editing === 'new'
        ? <AnchorForm id={null} initial={fresh} onDone={() => setEditing(null)} />
        : <button type="button" className="wk-link-btn" onClick={() => setEditing('new')}>{t('cogitaData.anchors.add')}</button>)}
    </section>
  );
}

/** „Więcej → Wejścia z Biblioteki": alle Wejścia dieser Baza. */
export function AnchorsTab({ chosen }: { chosen?: string }) {
  const t = useT();
  const { lib, writes } = useCtx();
  /* 2026-10-25 — geöffnet wird ein Wejście zum Ändern nur für den, der hier schreibt; ein Leser sieht die Liste. */
  const [editing, setEditing] = useState<string | null>(writes ? chosen ?? null : null);
  const anchors = anchorsOf(lib).sort((a, b) => a.name.localeCompare(b.name, t.locale, { numeric: true }));
  return (
    <div className="cg" data-anchors-tab="">
      <p className="wk-hint">{t('cogitaData.anchors.tabHint')}</p>
      {anchors.length === 0 && <p className="wk-empty">{t('cogitaData.anchors.empty')}</p>}
      <ul className="cg-anchors">
        {anchors.map((a) => (editing === a.id
          ? <li key={a.id}><AnchorForm id={a.id} initial={a} onDone={() => setEditing(null)} /></li>
          : <AnchorRow key={a.id} anchor={a} showEntry onEdit={() => setEditing(a.id)} />))}
      </ul>
      {writes && (editing === 'new'
        ? <AnchorForm id={null} initial={EMPTY} onDone={() => setEditing(null)} />
        : <button type="button" className="wk-btn" onClick={() => setEditing('new')}>{t('cogitaData.anchors.new')}</button>)}
    </div>
  );
}
