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
  return { name: name.trim() || 'Rodzaj tekstu', ...(description.trim() === '' ? {} : { description: description.trim() }), fields: doc.fields };
}

export function TextTypeEditor({ me, store, library, existing }: { me: Me; store: LibraryStore; library: OpenLibrary; existing: Entry | undefined }) {
  const [id] = useState(() => existing?.id ?? newId());
  const readOnly = !library.writes;
  const lens = useLens(me, store);
  const [draft, setDraft] = useState<KindDef>(() => ({
    id,
    name: existing === undefined ? 'Nowy rodzaj tekstu' : str(existing.data, 'name'),
    label: '{title}',
    fields: existing === undefined ? [] : typeFieldDefs(existing)
  }));
  const [description, setDescription] = useState(existing === undefined ? '' : str(existing.data, 'description'));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const saved = store.get(id);
  const here = (...trail: string[]) => viewPath('scriptorium', library.libraryId, ...trail);
  const targets = useMemo(() => [...(lens === null ? [] : lensTargets(lens)), { id: 'text', name: 'Tekst (Skryptorium)' }], [lens, lens?.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Die Texte dieses Rodzaju — hier und in den anderen lesbaren Skryptoria. */
  const texts = store.readable().filter((e) => e.kind === 'text' && ids(e.data, 'textType').includes(id));

  const save = async () => {
    setBusy(true);
    setFailed(null);
    setSaid(null);
    try {
      const done = await store.save({ id, kind: 'texttype', ...(saved?.key === undefined ? {} : { key: saved.key }), data: textTypeData(draft.name, description, draft) });
      if (existing === undefined) window.location.replace(here(done.id));
      else setSaid('Zapisano.');
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lib-editor lib-editor-textType">
      <header className="lib-editor-head">
        <a className="wk-link" href={here(SCRIPTORIUM_TAB.texttype)}>← Rodzaje tekstów</a>
        <span className="lib-editor-kind">Rodzaj tekstu</span>
        <h1 className="wk-h1 lib-editor-title">{draft.name || 'Rodzaj tekstu'}</h1>
        {readOnly && <p className="wk-note">To skryptorium możesz tylko czytać.</p>}
      </header>
      <div className="lib-editor-grid">
        <div className="lib-editor-main">
          <p className="wk-lede">Rodzaj tekstu to nazwa i pola, które ma każdy tekst tego rodzaju — obok stałych pól (tytuł, data, plan, treść …). Pole-odwołanie może wskazywać wpisy z Nauki (np. tajemnicę, obszar) albo źródła z Biblioteki. Tekst bez rodzaju to zwykły tekst.</p>
          <label className="wk-field">
            <span>Opis</span>
            <textarea rows={2} value={description} disabled={readOnly} placeholder="Do czego służy ten rodzaj" onChange={(e) => setDescription(e.target.value)} />
          </label>
          {lens === null ? <Loading label="Wczytywanie rodzajów z Nauki…" /> : (
            <KindForm draft={draft} writes={!readOnly} busy={busy} targets={targets}
              options={{ types: TEXT_TYPE_FIELD_TYPES, uncertain: false, pattern: false, reserved: CORE_KEYS, nameLabel: 'Nazwa rodzaju tekstu', saveLabel: 'Zapisz rodzaj tekstu', roles: false }}
              onChange={setDraft} onSave={() => void save()} />
          )}
          {failed !== null && <p className="wk-error">{failed}</p>}
          {said !== null && <p className="wk-done" role="status">{said}</p>}

          {saved !== undefined && (
            <section className="wk-form" aria-label="Teksty tego rodzaju">
              <h2 className="wk-h2">Teksty tego rodzaju ({texts.length})</h2>
              {texts.length === 0 ? <p className="wk-empty">Nie ma jeszcze tekstów tego rodzaju.</p> : (
                <ul className="lib-list">
                  {texts.map((t) => <li key={t.id}><a className="lib-row" href={viewPath('scriptorium', t.libraryId, t.id)}><span className="lib-row-title">{store.title(t)}</span><span className="lib-row-meta">{str(t.data, 'date')}</span></a></li>)}
                </ul>
              )}
              {!readOnly && <div className="wk-actions"><a className="wk-btn" href={here('nowy', 'text', `textType=${id}`)}>+ Tekst tego rodzaju</a></div>}
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
