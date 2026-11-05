/**
 * EIN RODZAJ TEKSTU BEARBEITEN (2026-10-23) — mit DEMSELBEN Editor wie ein
 * Rodzaj in Nauka (`cogita/KindForm.tsx`): Name, Felder, ihr Typ, wohin ein
 * Verweis zeigt. Was hier anders ist, sagt der Editor selbst: die Typen ohne
 * Medien, Karte, Bereich und Zapis, kein „Niepewne", kein Muster des
 * Etiketts (ein Text hat seinen Titel) — und die Schlüssel der festen Felder
 * eines Textes sind belegt. Die Ziele eines Verweises sind die Rodzaje aller
 * lesbaren Bazy wiedzy und die Quellen der Bibliothek (`lens.ts`).
 *
 * Gespeichert wird hier mit „Zapisz rodzaj tekstu" (wie in Nauka): ein
 * halb getippter Schlüssel soll kein Feld verschwinden lassen.
 */

import { useMemo, useState } from 'react';

import { KindForm } from '../cogita/KindForm';
import { t as tApp, useT } from '../core/i18n';
import { newId } from '../core/ids';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { kindDoc } from '../cogita/kinds';
import type { KindDef } from '../cogita/schema';
import type { OpenLibrary } from '../library/library';
import { AreaBox } from '../library/LibraryAreaBox';
import { DeleteBox, EntryJson, KeyBox } from '../library/LibraryEntryBoxes';
import { ids, str, type EntryData } from '../library/libraryKinds';
import type { Entry, LibraryStore } from '../library/libraryStore';
import { viewPath } from '../routes';
import { Loading } from '../ui/Loading';
import { lensTargets, useLens } from './lens';
import { CORE_KEYS, TEXT_TYPE_FIELD_TYPES } from './textTypes';
import { typeFieldDefs } from './TypeFields';
import { scriptoriumFormat, SCRIPTORIUM_TAB } from './format';

/** Ein Rodzaj zum Speichern: Name, Beschreibung, Felder — in der Gestalt, in der Nauka einen Rodzaj schreibt. */
export function textTypeData(name: string, description: string, kind: KindDef): EntryData {
  const doc = kindDoc({ ...kind, id: '', label: '{title}', fields: kind.fields.map((f) => ({ ...f, uncertain: false })) });
  return { name: name.trim() || tApp('scriptorium.type.name'), ...(description.trim() === '' ? {} : { description: description.trim() }), fields: doc.fields };
}

export function TextTypeEditor({ me, store, library, existing }: { me: Me; store: LibraryStore; library: OpenLibrary; existing: Entry | undefined }) {
  const t = useT();
  const [id] = useState(() => existing?.id ?? newId());
  const readOnly = !library.writes;
  const lens = useLens(me, store);
  const [draft, setDraft] = useState<KindDef>(() => ({
    id,
    name: existing === undefined ? t('scriptorium.type.newName') : str(existing.data, 'name'),
    label: '{title}',
    fields: existing === undefined ? [] : typeFieldDefs(existing)
  }));
  const [description, setDescription] = useState(existing === undefined ? '' : str(existing.data, 'description'));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const saved = store.get(id);
  const here = (...trail: string[]) => viewPath('scriptorium', library.libraryId, ...trail);
  const targets = useMemo(() => [...(lens === null ? [] : lensTargets(lens)), { id: 'text', name: t('scriptorium.type.textTarget') }], [lens, lens?.revision, t]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Die Texte dieses Rodzaju — hier und in den anderen lesbaren Skryptoria. */
  const texts = store.readable().filter((e) => e.kind === 'text' && ids(e.data, 'textType').includes(id));

  const save = async () => {
    setBusy(true);
    setFailed(null);
    setSaid(null);
    try {
      const done = await store.save({ id, kind: 'texttype', ...(saved?.key === undefined ? {} : { key: saved.key }), data: textTypeData(draft.name, description, draft) });
      if (existing === undefined) window.location.replace(here(done.id));
      else setSaid(t('scriptorium.type.saved'));
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('scriptorium.type.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lib-editor lib-editor-textType">
      <header className="lib-editor-head">
        <a className="wk-link" href={here(SCRIPTORIUM_TAB.texttype)}>{t('scriptorium.type.back')}</a>
        <span className="lib-editor-kind">{t('scriptorium.type.name')}</span>
        <h1 className="wk-h1 lib-editor-title">{draft.name || t('scriptorium.type.name')}</h1>
        {readOnly && <p className="wk-note">{t('scriptorium.type.readOnly')}</p>}
      </header>
      <div className="lib-editor-grid">
        <div className="lib-editor-main">
          <p className="wk-lede">{t('scriptorium.type.lede')}</p>
          <label className="wk-field">
            <span>{t('common.description')}</span>
            <textarea rows={2} value={description} disabled={readOnly} placeholder={t('scriptorium.type.descriptionPlaceholder')} onChange={(e) => setDescription(e.target.value)} />
          </label>
          {lens === null ? <Loading label={t('scriptorium.type.loadingKinds')} /> : (
            <KindForm draft={draft} writes={!readOnly} busy={busy} targets={targets}
              options={{ types: TEXT_TYPE_FIELD_TYPES, uncertain: false, pattern: false, reserved: CORE_KEYS, nameLabel: t('scriptorium.type.nameLabel'), saveLabel: t('scriptorium.type.save'), roles: false }}
              onChange={setDraft} onSave={() => void save()} />
          )}
          {failed !== null && <p className="wk-error">{failed}</p>}
          {said !== null && <p className="wk-done" role="status">{said}</p>}

          {saved !== undefined && (
            <section className="wk-form" aria-label={t('scriptorium.type.texts')}>
              <h2 className="wk-h2">{t('scriptorium.type.textsCount', { count: texts.length })}</h2>
              {texts.length === 0 ? <p className="wk-empty">{t('scriptorium.type.noTexts')}</p> : (
                <ul className="lib-list">
                  {texts.map((one) => <li key={one.id}><a className="lib-row" href={viewPath('scriptorium', one.libraryId, one.id)}><span className="lib-row-title">{store.title(one)}</span><span className="lib-row-meta">{str(one.data, 'date')}</span></a></li>)}
                </ul>
              )}
              {!readOnly && <div className="wk-actions"><a className="wk-btn" href={here('nowy', 'text', `textType=${id}`)}>{t('scriptorium.type.addText')}</a></div>}
            </section>
          )}
        </div>
        <aside className="lib-editor-side">
          {saved !== undefined && (
            <KeyBox store={store} id={id} value={saved.key ?? ''} readOnly={readOnly} onChange={async (next) => {
              const pinned = saved.key !== undefined && next !== saved.key ? await store.pinCitations(id) : null;
              await store.save({ id, kind: 'texttype', ...(next.trim() === '' ? {} : { key: next.trim() }), data: saved.data });
              return pinned;
            }} />
          )}
          {saved !== undefined && <AreaBox store={store} library={library} entry={saved} readOnly={readOnly} />}
          {saved !== undefined && <EntryJson store={store} entry={saved} isNew={false} format={scriptoriumFormat(store, library.name, lens)} home={(made) => here(made)} />}
          {saved !== undefined && !readOnly && <DeleteBox store={store} entry={saved} back={here(SCRIPTORIUM_TAB.texttype)} />}
        </aside>
      </div>
    </div>
  );
}
