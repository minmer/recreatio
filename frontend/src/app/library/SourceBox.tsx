/**
 * 2026-10-24 — DER TEXT AM WERK: das Kästchen „Tekst źródła" auf der Seite eines Werks.
 *
 * Ein Werk ist ohne Text vollständig. Hier sieht man, ob es Texte dazu gibt (in welcher
 * Bibliothek, wie viel), öffnet den Czytnik, und trägt Teile ein: als JSON
 * (`recreatio/source-text`, `sourceText.ts`) — mit der eigenen KI geschrieben (das Polecenie
 * steht neben dem Import), erst gelesen und gezeigt, dann gespeichert. Ein Teil mit demselben
 * Schlüssel ersetzt sich selbst; derselbe Teil ein zweites Mal ändert nichts.
 *
 * <b>Wo der Text liegt, wählt man</b>: in der Bibliothek des Werks oder in einer anderen, in
 * die man schreiben darf. So bleibt ein Text privat, auch wenn das Werk öffentlich steht —
 * wer nur die Bibliothek des Werks liest, sieht das Werk und seine Zitate, nicht den Text.
 *
 * 2026-10-24 — und ohne Werk vorher: „Dzieło z tekstem" (`WorkWithTextButton`, in den Źródła)
 * nimmt EIN Dokument mit dem Werk (Buch, Artykuł …), seinen Autoren und seinem ganzen Text
 * (`sourceImport.ts`). Ein Dokument trägt einen Teil oder alle (`portions`).
 */

import { useMemo, useState } from 'react';

import { WorkspaceError } from '../core/session';
import { ask } from '../ui/dialogs';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import { Modal } from '../ui/Modal';
import { viewPath } from '../routes';
import { libraryKindOf, type OpenLibrary } from './library';
import { kindOf } from './libraryKinds';
import type { Entry, LibraryStore } from './libraryStore';
import { workScheme } from './locations';
import { finderOf } from './sourceFind';
import { planWorkWithText, previewPortions, WORK_WITH_TEXT_EXAMPLE, workWithTextPrompt, writePortions } from './sourceImport';
import { exportSourceText, portionDocs, readManifest, readPart, SOURCE_EXAMPLES, sourceTextPrompt, textsOfWork, type TextManifest } from './sourceText';

/** Wohin ein Text gehen kann: Bibliotheken (keine Bazy wiedzy, keine Skryptoria), in die man schreibt. */
export interface SourceTargets {
  readonly libraries: readonly OpenLibrary[];
  readonly storeFor: (row: OpenLibrary) => LibraryStore;
}

const count = (n: number, one: string, few: string, many: string) =>
  `${n} ${n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many}`;

export function SourceBox({ store, library, work, targets }: { store: LibraryStore; library: OpenLibrary; work: Entry; targets?: SourceTargets }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const texts = useMemo(() => textsOfWork(finderOf(store), work.id), [store, store.revision, work.id]);
  const writable = (targets?.libraries ?? [library]).filter((l) => l.writes && libraryKindOf(l) === 'books');
  const [open, setOpen] = useState(false);
  const nameOf = (libraryId: string) => (targets?.libraries ?? [library]).find((l) => l.libraryId === libraryId)?.name ?? 'inna biblioteka';

  return (
    <section className="lib-box" data-source-box="">
      <h2 className="lib-box-h">Tekst źródła</h2>
      {texts.length === 0
        ? <p className="lib-box-sub">Brak pełnego tekstu — dzieło działa i bez niego. Gdy tekst się pojawi, cytaty i przypisy z miejscem same do niego poprowadzą.</p>
        : (
          <ul className="src-texts">
            {texts.map(({ entry, manifest }) => {
              const lib = (entry as Entry).libraryId;
              const words = manifest.parts.reduce((n, p) => n + p.words, 0);
              return (
                <li key={entry.id}>
                  <a className="wk-btn" href={viewPath('library', lib, work.id, 'tekst')}>Czytaj</a>{' '}
                  <span>{count(manifest.parts.length, 'część', 'części', 'części')}, {count(words, 'słowo', 'słowa', 'słów')}</span>
                  <span className="lib-row-meta"> · w bibliotece „{nameOf(lib)}”{lib !== library.libraryId ? ' (osobno od dzieła)' : ''}</span>
                </li>
              );
            })}
          </ul>
        )}
      {writable.length > 0 && <div className="wk-actions"><button type="button" className="wk-btn wk-btn-quiet" onClick={() => setOpen(true)}>{texts.length === 0 ? 'Dodaj tekst (JSON)' : 'Dodaj lub zmień części (JSON)'}</button></div>}
      {open && (
        <Modal title="Tekst źródła — import JSON" wide onClose={() => setOpen(false)}>
          <SourceImport store={store} library={library} work={work} writable={writable} storeFor={targets?.storeFor ?? (() => store)} />
        </Modal>
      )}
    </section>
  );
}

/** Wohin der Text geht — und was das für die heisst, die lesen. */
function TextLibraryPick({ writable, target, workLibrary, onPick }: { writable: readonly OpenLibrary[]; target: OpenLibrary; workLibrary: OpenLibrary; onPick: (id: string) => void }) {
  return (
    <>
      {writable.length > 1 && (
        <label className="wk-field">
          <span>Biblioteka tekstu</span>
          <select value={target.libraryId} onChange={(e) => onPick(e.target.value)}>
            {writable.map((l) => <option key={l.libraryId} value={l.libraryId}>{l.name}{l.areaPublic === true ? ' (publiczna)' : ''}</option>)}
          </select>
        </label>
      )}
      {target.libraryId !== workLibrary.libraryId && <p className="wk-note">Tekst będzie w bibliotece „{target.name}”, dzieło jest w „{workLibrary.name}”. Kto czyta tylko „{workLibrary.name}”, widzi dzieło i cytaty, ale nie tekst.</p>}
      {target.areaPublic === true && <p className="wk-note">Biblioteka „{target.name}” jest publiczna — tekst przeczyta każdy, także bez konta.</p>}
    </>
  );
}

/** Ein öffentlicher Text: erst fragen (Urheberrecht). `false`: nicht speichern. */
const publicOk = async (target: OpenLibrary): Promise<boolean> => target.areaPublic !== true || ask({
  title: 'Tekst w bibliotece publicznej?',
  body: `Biblioteka „${target.name}” jest w obszarze publicznym — pełny tekst przeczyta każdy, także bez konta. Udostępniaj tylko teksty, które wolno publikować (prawa autorskie).`,
  confirm: 'Tak, zapisz publicznie'
});

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Dane dzieła w dokumencie dla TEGO dzieła: jego klucz musi się zgadzać; pola zostają (zmienia się je na stronie dzieła). */
function metaOf(doc: unknown, work: Entry): { error?: string; warning?: string } {
  const one = Array.isArray(doc) ? doc.find(isObject) : doc;
  if (!isObject(one) || !isObject(one.work)) return {};
  const key = typeof one.work.key === 'string' ? one.work.key.replace(/^@/, '') : '';
  if (key !== '' && key.toLowerCase() !== (work.key ?? '').toLowerCase()) return { error: `Ten tekst jest dla innego dzieła („${key}”) — zaimportuj go w Źródłach jako „Dzieło z tekstem” albo otwórz właściwe dzieło.` };
  return { warning: 'Dane dzieła z dokumentu pominięte — to dzieło już jest; jego pola zmienisz na tej stronie.' };
}

function SourceImport({ store, library, work, writable, storeFor }: {
  store: LibraryStore;
  library: OpenLibrary;
  work: Entry;
  writable: readonly OpenLibrary[];
  storeFor: (row: OpenLibrary) => LibraryStore;
}) {
  /* Wo schon ein Text dieses Werks liegt, dorthin; sonst in die Bibliothek des Werks. */
  const existingHome = writable.find((l) => storeFor(l).ownTexts(work.id).length > 0);
  const [targetId, setTargetId] = useState((existingHome ?? writable.find((l) => l.libraryId === library.libraryId) ?? writable[0]!).libraryId);
  const target = writable.find((l) => l.libraryId === targetId) ?? writable[0]!;
  const targetStore = target.libraryId === library.libraryId ? store : storeFor(target);
  const manifestEntry: Entry | undefined = targetStore.ownTexts(work.id)[0];
  const manifest: TextManifest | undefined = manifestEntry === undefined ? undefined : readManifest(manifestEntry.data);
  const title = kindOf('work')!.title(work.data, store);
  const scheme = manifest?.scheme ?? workScheme(work.data);

  const preview = (doc: unknown): JsonPreview | { error: string } => {
    const meta = metaOf(doc, work);
    if (meta.error !== undefined) return { error: meta.error };
    const said = previewPortions(work, manifest, portionDocs(doc));
    if ('error' in said) return said;
    return { lines: said.lines, warnings: [...(meta.warning === undefined ? [] : [meta.warning]), ...said.warnings] };
  };

  const onImport = async (doc: unknown, stage: (what: string) => void): Promise<JsonPreview> => {
    if (!target.writes) throw new WorkspaceError('W tej bibliotece możesz tylko czytać.');
    const meta = metaOf(doc, work);
    if (meta.error !== undefined) throw new WorkspaceError(meta.error);
    if (!(await publicOk(target))) return { lines: ['Nic nie zapisano.'], warnings: [] };
    return writePortions({ target: targetStore, work, docs: portionDocs(doc), stage, ...(library.writes ? { workStore: store } : {}) });
  };

  const exportDoc = async (): Promise<unknown> => {
    if (manifest === undefined || manifestEntry === undefined) return SOURCE_EXAMPLES[scheme];
    const parts = await targetStore.heavyMany(manifest.parts.map((p) => p.id));
    return exportSourceText(work, manifest, parts.filter((p): p is Entry => p !== null).map((p) => readPart(p.data)));
  };

  const remove = async () => {
    if (manifestEntry === undefined || manifest === undefined) return;
    if (!(await ask({
      title: 'Usunąć tekst tego dzieła?',
      body: `Usuwa pełny tekst z biblioteki „${target.name}” (${count(manifest.parts.length, 'część', 'części', 'części')}). Dzieło, cytaty i przypisy zostają — przestaną tylko prowadzić do tekstu.`,
      confirm: 'Usuń tekst',
      danger: true
    }))) return;
    await targetStore.removeMany([...manifest.parts.map((p) => p.id), manifestEntry.id]);
  };

  return (
    <div className="src-import">
      <TextLibraryPick writable={writable} target={target} workLibrary={library} onPick={setTargetId} />
      <JsonPanel
        open
        summary={`Tekst: ${title}`}
        lead={<>Jedna część tekstu, kilka albo cały tekst („portions”) — np. przepisany przez AI z PDF-u. Część o tym samym kluczu zastępuje poprzednią, inne zostają; ta sama część drugi raz niczego nie zmienia. Obok jest opis formatu i polecenie do skopiowania.</>}
        fileName={`tekst-${(work.key ?? work.id).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`}
        exportDoc={exportDoc}
        description={() => sourceTextPrompt(work, title, scheme)}
        preview={preview}
        importLabel="Importuj tekst"
        onImport={onImport}
      />
      {manifest !== undefined && (
        <section className="lib-danger">
          <button type="button" className="wk-btn lib-btn-danger" onClick={() => void remove()}>Usuń tekst z „{target.name}”</button>
        </section>
      )}
    </div>
  );
}

/* -- 2026-10-24: ein Werk mit seinem Text, in einem Import ------------------------------------------------------ */

/** „Dzieło z tekstem (JSON)" — in den Źródła einer Bibliothek, in der man schreibt. */
export function WorkWithTextButton({ store, library, targets }: { store: LibraryStore; library: OpenLibrary; targets?: SourceTargets }) {
  const [open, setOpen] = useState(false);
  const writable = (targets?.libraries ?? [library]).filter((l) => l.writes && libraryKindOf(l) === 'books');
  if (!library.writes) return null;
  return (
    <>
      <button type="button" className="wk-btn wk-btn-line" onClick={() => setOpen(true)}>Dzieło z tekstem (JSON)</button>
      {open && (
        <Modal title="Dzieło z pełnym tekstem — import JSON" wide onClose={() => setOpen(false)}>
          <WorkWithTextImport store={store} library={library} writable={writable.length === 0 ? [library] : writable} storeFor={targets?.storeFor ?? (() => store)} />
        </Modal>
      )}
    </>
  );
}

/**
 * EIN WERK UND SEIN TEXT AUS EINEM DOKUMENT: das Werk (und wen es nennt) in DIESE Bibliothek,
 * der Text in die gewählte. Danach öffnet sich das Werk — mit „Czytaj".
 */
function WorkWithTextImport({ store, library, writable, storeFor }: {
  store: LibraryStore;
  library: OpenLibrary;
  writable: readonly OpenLibrary[];
  storeFor: (row: OpenLibrary) => LibraryStore;
}) {
  const [targetId, setTargetId] = useState(library.libraryId);
  const target = writable.find((l) => l.libraryId === targetId) ?? writable[0]!;
  const targetStore = target.libraryId === library.libraryId ? store : storeFor(target);
  const manifestOf = (workId: string): TextManifest | undefined => {
    const one = targetStore.ownTexts(workId)[0];
    return one === undefined ? undefined : readManifest(one.data);
  };

  const preview = (doc: unknown): JsonPreview | { error: string } => {
    const plan = planWorkWithText(doc, store, manifestOf);
    return 'error' in plan ? plan : { lines: [...plan.lines], warnings: [...plan.warnings] };
  };

  const onImport = async (doc: unknown, stage: (what: string) => void): Promise<JsonPreview> => {
    const plan = planWorkWithText(doc, store, manifestOf);
    if ('error' in plan) throw new WorkspaceError(plan.error);
    if (plan.docs.length > 0 && !(await publicOk(target))) return { lines: ['Nic nie zapisano.'], warnings: [] };
    /* Erst das Werk und wen es nennt (wie der Import der Bibliothek), dann sein Text. */
    let work: Entry | undefined = store.own(plan.work.id);
    for (const [i, draft] of plan.library.drafts.entries()) {
      stage(`Zapisywanie wpisu ${i + 1} z ${plan.library.drafts.length}…`);
      const saved = await store.save({ id: draft.id, kind: draft.kind, ...(draft.key === undefined ? {} : { key: draft.key }), data: draft.data });
      if (saved.id === plan.work.id) work = saved;
    }
    work ??= store.get(plan.work.id);
    if (work === undefined) throw new WorkspaceError('Dzieło jest w innej bibliotece — tekst dodasz na jego stronie.');
    const text = plan.docs.length === 0 ? { lines: [], warnings: [] } : await writePortions({ target: targetStore, work, docs: plan.docs, stage, workStore: store });
    const opened = work.id;
    window.setTimeout(() => { window.location.hash = viewPath('library', library.libraryId, opened); }, 1200);
    return { lines: [...plan.lines.slice(0, 1), ...text.lines, 'Otwieram stronę dzieła…'], warnings: [...plan.library.warnings, ...text.warnings] };
  };

  return (
    <div className="src-import">
      <TextLibraryPick writable={writable} target={target} workLibrary={library} onPick={setTargetId} />
      <JsonPanel
        open
        summary="Dzieło z pełnym tekstem"
        lead={<>Jeden dokument: opis dzieła (książki, artykułu, rozdziału, dokumentu), jego autorzy i — gdy trzeba — czasopismo albo książka, w której jest, oraz jego tekst w częściach. Dzieło trafia do „{library.name}”; o istniejącym kluczu zostaje uzupełnione, nie zdublowane. Obok opis formatu i polecenie dla AI.</>}
        fileName="dzielo-z-tekstem.json"
        exportDoc={() => WORK_WITH_TEXT_EXAMPLE}
        description={workWithTextPrompt}
        preview={preview}
        importLabel="Importuj dzieło z tekstem"
        onImport={onImport}
      />
    </div>
  );
}
