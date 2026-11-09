/**
 * EINE QUELLE DER BIBLIOTHEK, GANZ (0064) — ein Werk, ein Zitat, eine Person:
 * das Formular aus ihrer Art, daneben wer sie liest und was auf sie zeigt.
 *
 * 2026-10-23 — die Bibliothek hält nur Quellen. Texte, Wygłoszenia und
 * Projekte schreibt man im Skryptorium (`scriptorium/WritingEditor.tsx`);
 * gespeichert wird bei beiden auf dieselbe Weise, von selbst
 * (`entryDraft.ts`). Wer einen Eintrag liest, entscheidet der Bereich seiner
 * Bibliothek (2026-10-22) — eine Änderung ist sofort für alle da.
 */

import type { ReactNode } from 'react';

import { IsbnTools, NumberTools, savePersons } from './BookLookup';
import { containerPath, type OpenLibrary } from './library';
import { exportLibrary, libraryDescription, planLibraryImport } from './libraryJson';
import { isLibraryKind, isMusic, kindOf, str, WORK_TYPES, type EntryData } from './libraryKinds';
import { MusicFiles } from './MusicFiles';
import type { Entry, LibraryStore } from './libraryStore';
import { QuoteFigure } from './LibraryText';
import { viewPath } from '../routes';
import { useT } from '../core/i18n';
import { QuoteIntake } from './QuoteIntake';
import { AreaBox } from './LibraryAreaBox';
import { DeleteBox, EntryJson, KeyBox, type EntryFormat } from './LibraryEntryBoxes';
import { PassageBox, Relations } from './LibraryRelations';
import { KnowledgeBox, KnowledgeLine } from './LibraryKnowledge';
import { FieldList } from './LibraryFields';
import { useEntryDraft } from './entryDraft';
import { SourceBox, type SourceTargets } from './SourceBox';

/** Die Liste, zu der eine Art gehört (`#/workspace/library/<id>/<reiter>`). */
export const LIBRARY_TAB: Readonly<Record<string, string>> = { work: 'zrodla', quote: 'cytaty', person: 'osoby' };

function defaults(kind: string, preset: Record<string, unknown>): EntryData {
  const base: EntryData = kind === 'work' ? { workType: 'book' } : kind === 'person' ? { personType: 'person' } : {};
  return { ...base, ...preset };
}

/** Wie die Bibliothek ihre Einträge als JSON nimmt und gibt. */
export const libraryFormat = (store: LibraryStore, name: string): EntryFormat => ({
  plan: (doc) => planLibraryImport(doc, store),
  exportDoc: (entries) => exportLibrary(name, entries, store),
  describe: libraryDescription
});

export function LibraryEditor({ store, library, entryId, kind, preset = {}, sources }: {
  store: LibraryStore;
  library: OpenLibrary;
  entryId: string | null;
  kind: string | null;
  preset?: Record<string, unknown>;
  /** 2026-10-24 — wohin der Text eines Werks gehen kann (`SourceBox.tsx`). */
  sources?: SourceTargets;
}) {
  const t = useT();
  const existing = entryId === null ? undefined : store.own(entryId);
  /* 2026-10-22 — ein Eintrag einer anderen lesbaren Bibliothek wird dort bearbeitet. */
  const home = entryId === null || existing !== undefined ? undefined : store.homeOf(entryId);
  if (entryId !== null && home !== undefined) {
    return <p className="wk-note">{t('library.editor.elsewhere')} <a href={containerPath(home.libraryId, entryId)}>{t('library.editor.openThere')}</a></p>;
  }
  if (entryId !== null && existing === undefined) {
    return <p className="wk-empty">{t('library.editor.missing')} <a href={viewPath('library', library.libraryId)}>{t('librarySource.reader.backToLibrary')}</a></p>;
  }
  /* 2026-10-23 — die Bibliothek hält nur Quellen; was sonst noch liegt, steht unter „Stare wpisy". */
  if (!isLibraryKind(existing?.kind ?? kind ?? '')) {
    return <p className="wk-note">{t('library.editor.oldKind')} <a href={viewPath('library', library.libraryId, 'stare')}>{t('library.home.old')}</a></p>;
  }
  return <Editor key={entryId ?? `new-${kind}`} store={store} library={library} existing={existing} kind={existing?.kind ?? kind!} preset={preset} sources={sources} />;
}

function Editor({ store, library, existing, kind, preset, sources }: {
  store: LibraryStore;
  library: OpenLibrary;
  existing: Entry | undefined;
  kind: string;
  preset: Record<string, unknown>;
  sources: SourceTargets | undefined;
}) {
  const def = kindOf(kind)!;
  const t = useT();
  const readOnly = !library.writes;
  const draft = useEntryDraft(store, existing, kind, () => defaults(kind, preset), readOnly);
  const { id, data, set, saved, live, state } = draft;
  const title = def.title(data, store);
  const here = (...trail: string[]) => viewPath('library', library.libraryId, ...trail);
  /* 2026-10-26 — ein Werk der Musik steht unter „Muzyka", heisst nach seinem Rodzaj und hat seine Dateien. */
  const music = kind === 'work' && isMusic(data);
  const workType = str(data, 'workType');
  const back = music ? 'muzyka' : LIBRARY_TAB[kind] ?? '';
  const files = workType === 'recording' ? 'tracks' : workType === 'score' ? 'files' : null;

  /* Beim Buch: unter der ISBN scannen und aus dem Katalog füllen, unter der eigenen Nummer die nächste freie. */
  const extras: Record<string, ReactNode> = kind !== 'work' ? {} : {
    isbn: (
      <IsbnTools store={store} library={library} entryId={id} data={data} readOnly={readOnly}
        onSet={(isbn) => set({ isbn })}
        onPlan={async (plan) => { await savePersons(store, plan); set(plan.data); }} />
    ),
    libraryNumber: (
      <NumberTools store={store} library={library} entryId={id} value={str(data, 'libraryNumber')} readOnly={readOnly}
        onSet={(libraryNumber) => set({ libraryNumber })} />
    )
  };

  return (
    <div className={`lib-editor lib-editor-${kind}`}>
      <header className="lib-editor-head">
        <a className="wk-link" href={here(back)}>← {music ? t('libraryKinds.group.music') : def.plural}</a>
        <span className="lib-editor-kind">{music ? WORK_TYPES.find((w) => w.value === workType)?.label ?? def.label : def.label}</span>
        <h1 className="wk-h1 lib-editor-title">{kind === 'quote' ? <q>{title}</q> : title}</h1>
        {saved !== undefined && kind === 'work' && <KnowledgeLine store={store} work={saved} />}
        <p className={`lib-state is-${state}`} role="status">{draft.status}</p>
        {state === 'stale' && (
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={draft.reloadTheirs}>{t('library.editor.reload')}</button>
            <button type="button" className="wk-link-btn" onClick={() => void draft.saveNow()}>{t('library.editor.keepMine')}</button>
          </div>
        )}
        {draft.failed !== null && state !== 'stale' && <p className="wk-error">{draft.failed}</p>}
        {readOnly && <p className="wk-note">{t('library.editor.readOnly')}</p>}
      </header>

      <div className="lib-editor-grid">
        <div className="lib-editor-main">
          <FieldList store={store} kind={kind} data={data} set={set} readOnly={readOnly} extras={extras} />
          {music && files !== null && (saved !== undefined
            ? <MusicFiles store={store} data={data} set={set} commit={draft.commit} readOnly={readOnly} which={files} />
            : <p className="lib-music-status">{t(files === 'tracks' ? 'library.editor.tracksLater' : 'library.editor.filesLater')}</p>)}
          {kind === 'work' && !music && saved !== undefined && <QuoteIntake store={store} library={library} work={saved} />}
          {state === 'new' && !readOnly && (
            <div className="wk-actions"><button type="button" className="wk-btn" onClick={() => void draft.create((made) => window.location.replace(here(made)))}>{t('common.save')}</button></div>
          )}
        </div>

        <aside className="lib-editor-side">
          {def.keyed && (
            <KeyBox store={store} id={id} value={draft.key} readOnly={readOnly} onChange={async (next) => {
              /* 2026-10-22 — vor dem neuen Schlüssel: was den Eintrag noch über den alten nennt, nennt ihn über die Kennung. */
              const pinned = saved?.key !== undefined && next !== saved.key ? await store.pinCitations(id) : null;
              draft.setKey(next);
              return pinned;
            }} />
          )}
          {saved !== undefined && <AreaBox store={store} library={library} entry={saved} readOnly={readOnly} />}
          {saved !== undefined && kind === 'work' && !music && <SourceBox store={store} library={library} work={saved} targets={sources} />}
          {saved !== undefined && kind === 'work' && saved.data.workType === 'bible' && <PassageBox store={store} work={saved} />}
          {/* 2026-10-25 (Wywód) — was eine lesbare Baza wiedzy über dieses Werk erklärt (ihre Wejścia), als Knöpfe; nichts davon liegt hier. */}
          {saved !== undefined && kind === 'work' && <KnowledgeBox store={store} work={saved} />}
          {saved !== undefined && <Relations store={store} library={library} entry={saved} />}
          {kind === 'quote' && str(data, 'text') !== '' && <section className="lib-box"><h2 className="lib-box-h">{t('common.preview')}</h2><QuoteFigure entry={live} look={store} /></section>}
          {!readOnly || saved !== undefined ? <EntryJson store={store} entry={saved ?? live} isNew={saved === undefined} format={libraryFormat(store, library.name)} home={(made) => here(made)} /> : null}
          {saved !== undefined && !readOnly && <DeleteBox store={store} entry={saved} back={here(back)} />}
        </aside>
      </div>
    </div>
  );
}
