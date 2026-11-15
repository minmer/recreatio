/**
 * EIN EINTRAG DES SKRYPTORIUM, GANZ (2026-10-23; vorher in der Bibliothek):
 * ein Text mit Plan, Treść und Dalsze informacje, ein Wygłoszenie, ein
 * Projekt — und ein Rodzaj tekstu (`TextTypeEditor.tsx`).
 *
 * Gespeichert wird von selbst (`library/entryDraft.ts`, wie in der
 * Bibliothek). Ein Text eines Rodzaju trägt dessen Felder unter den Daten des
 * Textes (`TypeFields.tsx`) — ein Verweis darin wählt einen Eintrag aus Nauka
 * durch die Linse (`lens.ts`). Wer ihn liest, entscheidet der Bereich des
 * Skryptorium; öffentlich wird ein Text, indem er in das Skryptorium eines
 * öffentlichen Bereichs zieht („Kto widzi").
 */

import { useEffect } from 'react';

import { useT } from '../core/i18n';
import { FieldList } from '../library/LibraryFields';
import { containerPath, type OpenLibrary } from '../library/library';
import { AreaBox } from '../library/LibraryAreaBox';
import { DeleteBox, EntryJson, KeyBox } from '../library/LibraryEntryBoxes';
import { Relations } from '../library/LibraryRelations';
import { useEntryDraft } from '../library/entryDraft';
import { ids, isWritingKind, kindOf, outline, type EntryData } from '../library/libraryKinds';
import type { Entry, LibraryStore } from '../library/libraryStore';
import type { Me } from '../core/me';
import type { Who } from '../core/session';
import { viewPath } from '../routes';
import { Loading } from '../ui/Loading';
import { DeliveriesBox, DeliveryForm } from './DeliveryForm';
import { scriptoriumFormat, SCRIPTORIUM_TAB } from './format';
import { useLens } from './lens';
import { OutlineEditor, TextForm } from './TextForm';
import { TextTypeEditor } from './TextTypeEditor';
import { TypeFields } from './TypeFields';
import { LatexBox, LearnBox } from './WritingBoxes';
import { EntityPick, entityLabel } from './work/EntityPick';
import { PartsEditor } from './work/TemplatesPanel';
import { TextWorkBox } from './work/UnitContext';
import { WorkView } from './work/WorkView';
import { EMPTY_KNOWLEDGE } from './work/workKnowledge';

/** Heute, als RRRR-MM-DD — der Tag eines neuen Wygłoszenia. */
const today = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

function defaults(kind: string, preset: Record<string, unknown>): EntryData {
  const base: EntryData = kind === 'text' ? { status: 'draft' }
    : kind === 'project' ? { projectType: 'book', status: 'writing' }
    /* 2026-10-21 — ein Wygłoszenie: heute, und der Text, von dem man kommt (`nowy/delivery/texts=<id>`). */
    : kind === 'delivery' ? { date: today() }
    : {};
  const out: EntryData = { ...base, ...preset };
  if (kind === 'delivery' && typeof out.texts === 'string') out.texts = out.texts.split(',').filter(Boolean);
  return out;
}

export function WritingEditor({ me, who, store, library, entryId, kind, preset = {}, trail = [] }: {
  me: Me;
  who: Who | null;
  store: LibraryStore;
  library: OpenLibrary;
  entryId: string | null;
  kind: string | null;
  preset?: Record<string, unknown>;
  /** 2026-11-15 — was nach dem Eintrag in der Adresse steht (ein Projekt: Reiter und Knoten seines Werks). */
  trail?: readonly string[];
}) {
  const t = useT();
  const existing = entryId === null ? undefined : store.own(entryId);
  const home = entryId === null || existing !== undefined ? undefined : store.homeOf(entryId);
  if (entryId !== null && home !== undefined) {
    return <p className="wk-note">{t('scriptorium.editor.elsewhere')} <a href={containerPath(home.libraryId, entryId)}>{t('scriptorium.editor.openThere')}</a></p>;
  }
  if (entryId !== null && existing === undefined) {
    return <p className="wk-empty">{t('scriptorium.editor.missing')} <a href={viewPath('scriptorium', library.libraryId)}>{t('scriptorium.editor.back')}</a></p>;
  }
  const shownKind = existing?.kind ?? kind ?? '';
  if (!isWritingKind(shownKind)) {
    return <p className="wk-note">{t('scriptorium.editor.foreignKind')} <a href={viewPath('scriptorium', library.libraryId, 'stare')}>{t('scriptorium.view.tabOld')}</a></p>;
  }
  /* 2026-11-15 — ein Knoten steht im Werk seines Projekts, nicht für sich. */
  if (shownKind === 'node' && existing !== undefined) {
    const project = ids(existing.data, 'project')[0];
    if (project !== undefined) return <NodeRedirect to={viewPath('scriptorium', library.libraryId, project, 'struktura', existing.id)} />;
  }
  if (shownKind === 'texttype') return <TextTypeEditor key={entryId ?? 'new-type'} me={me} store={store} library={library} existing={existing} />;
  return <Editor key={entryId ?? `new-${kind}`} me={me} who={who} store={store} library={library} existing={existing} kind={shownKind} preset={preset} trail={trail} />;
}

/** Ein Knoten öffnet sich in der Struktur seines Werks. */
function NodeRedirect({ to }: { to: string }) {
  const t = useT();
  useEffect(() => { window.location.replace(to); }, [to]);
  return <p className="wk-note"><a href={to}>{t('workUi.node.openInWork')}</a></p>;
}

function Editor({ me, who, store, library, existing, kind, preset, trail }: {
  me: Me;
  who: Who | null;
  store: LibraryStore;
  library: OpenLibrary;
  existing: Entry | undefined;
  kind: string;
  preset: Record<string, unknown>;
  trail: readonly string[];
}) {
  const t = useT();
  const def = kindOf(kind)!;
  const readOnly = !library.writes;
  const draft = useEntryDraft(store, existing, kind, () => defaults(kind, preset), readOnly);
  const { id, data, set, saved, live, state } = draft;
  const lens = useLens(me, store);
  const here = (...trail: string[]) => viewPath('scriptorium', library.libraryId, ...trail);
  const title = def.title(data, store);
  /* Der Rodzaj dieses Textes — er kann in einem anderen Skryptorium liegen (wenn der Text umgezogen ist). */
  const typeEntry = kind === 'text' ? store.get(ids(data, 'textType')[0] ?? '') : undefined;
  const type = typeEntry?.kind === 'texttype' ? typeEntry : undefined;

  const side = (
    <>
      {def.keyed && (
        <KeyBox store={store} id={id} value={draft.key} readOnly={readOnly} onChange={async (next) => {
          const pinned = saved?.key !== undefined && next !== saved.key ? await store.pinCitations(id) : null;
          draft.setKey(next);
          return pinned;
        }} />
      )}
      {saved !== undefined && <AreaBox store={store} library={library} entry={saved} readOnly={readOnly} />}
      {saved !== undefined && kind === 'text' && <TextWorkBox me={me} store={store} library={library} textId={saved.id} />}
      {saved !== undefined && kind === 'text' && <DeliveriesBox store={store} library={library} text={saved} readOnly={readOnly} />}
      {saved !== undefined && <Relations store={store} library={library} entry={saved} />}
      {saved !== undefined && (kind === 'text' || kind === 'project') && <LatexBox store={store} entry={live} />}
      {saved !== undefined && kind === 'text' && <LearnBox library={library} entry={saved} />}
      {!readOnly || saved !== undefined ? <EntryJson store={store} entry={saved ?? live} isNew={saved === undefined} format={scriptoriumFormat(store, library.name, lens)} home={(made) => here(made)} /> : null}
      {saved !== undefined && !readOnly && <DeleteBox store={store} entry={saved} back={here(SCRIPTORIUM_TAB[kind] ?? '')} />}
    </>
  );
  const head = (
    <header className="lib-editor-head">
      <a className="wk-link" href={here(SCRIPTORIUM_TAB[kind] ?? '')}>← {def.plural}</a>
      <span className="lib-editor-kind">{type === undefined ? def.label : `${def.label} · ${String(type.data.name ?? '')}`}</span>
      <h1 className="wk-h1 lib-editor-title">{title}</h1>
      <p className={`lib-state is-${state}`} role="status">{draft.status}</p>
      {state === 'stale' && (
        <div className="wk-actions">
          <button type="button" className="wk-btn" onClick={draft.reloadTheirs}>{t('scriptorium.editor.loadTheirs')}</button>
          <button type="button" className="wk-link-btn" onClick={() => void draft.saveNow()}>{t('scriptorium.editor.keepMine')}</button>
        </div>
      )}
      {draft.failed !== null && state !== 'stale' && <p className="wk-error">{draft.failed}</p>}
      {readOnly && <p className="wk-note">{t('scriptorium.type.readOnly')}</p>}
    </header>
  );

  /* 2026-11-15 — EIN PROJEKT IST EIN WERK: seine Reiter (Struktur, Tabelle, Begriffe …); die alten Felder unter „Dane". */
  if (kind === 'project' && saved !== undefined) {
    return (
      <div className="lib-editor lib-editor-project work-editor">
        {head}
        <WorkView me={me} store={store} library={library} project={live} lens={lens} readOnly={readOnly} setProject={set} trail={trail}
          data={(
            <div className="lib-editor-grid">
              <div className="lib-editor-main">
                <FieldList store={store} kind={kind} data={data} set={set} readOnly={readOnly} skip={['lang', 'latexClass', 'citationStyle']} />
                <OutlineEditor store={store} library={library} project={saved} value={outline(data)} readOnly={readOnly} onChange={(next) => set({ outline: next })} />
              </div>
              <aside className="lib-editor-side">{side}</aside>
            </div>
          )} />
      </div>
    );
  }

  return (
    <div className={`lib-editor lib-editor-${kind}`}>
      {head}

      <div className="lib-editor-grid">
        <div className="lib-editor-main">
          {kind === 'text' ? (
            <TextForm store={store} entry={live} data={data} set={set} readOnly={readOnly}
              typeFields={type === undefined ? undefined : lens === null ? <Loading lines={2} /> : <TypeFields lens={lens} me={me} who={who} type={type} data={data} set={set} readOnly={readOnly} />} />
          ) : kind === 'delivery' ? (
            <DeliveryForm store={store} library={library} entry={live} data={data} set={set} readOnly={readOnly} />
          ) : (
            <FieldList store={store} kind={kind} data={data} set={set} readOnly={readOnly} skip={kind === 'rule' ? ['entity'] : []} />
          )}
          {kind === 'rule' && <RuleEntity lens={lens} value={ids(data, 'entity')[0]} readOnly={readOnly} onChange={(entity) => set({ entity })} />}
          {kind === 'unittemplate' && <PartsEditor data={data} set={set} readOnly={readOnly} />}
          {state === 'new' && !readOnly && (
            <div className="wk-actions"><button type="button" className="wk-btn" onClick={() => void draft.create((made) => window.location.replace(here(made)))}>{t('common.save')}</button></div>
          )}
        </div>

        <aside className="lib-editor-side">
          {side}
        </aside>
      </div>
    </div>
  );
}

/** 2026-11-15 — eine Regel zu einem Eintrag des Wissens (wie eine Person spricht, wie ein Begriff eingeführt wird). */
function RuleEntity({ lens, value, readOnly, onChange }: { lens: ReturnType<typeof useLens>; value: string | undefined; readOnly: boolean; onChange: (id: string) => void }) {
  const t = useT();
  return (
    <div className="wk-field lib-field is-wide">
      <span>{t('libraryKinds.rule.fields.entity.label')}</span>
      {value !== undefined && (
        <p>
          {entityLabel(value, EMPTY_KNOWLEDGE, lens) ?? t('work.check.someEntry')}{' '}
          {!readOnly && <button type="button" className="wk-link-btn wk-danger" onClick={() => onChange('')}>{t('common.delete')}</button>}
        </p>
      )}
      {!readOnly && <EntityPick lens={lens} knowledge={EMPTY_KNOWLEDGE} onPick={onChange} />}
    </div>
  );
}
