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
 */

import { useMemo, useState } from 'react';

import { newId } from '../core/ids';
import { WorkspaceError } from '../core/session';
import { ask } from '../ui/dialogs';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import { Modal } from '../ui/Modal';
import { viewPath } from '../routes';
import { libraryKindOf, type OpenLibrary } from './library';
import { kindOf } from './libraryKinds';
import type { Entry, LibraryStore } from './libraryStore';
import { schemeOf, workScheme } from './locations';
import { finderOf } from './sourceFind';
import {
  documentsOf, exportSourceText, nextManifest, overlapsWith, PART_KIND, pageRangeLabel, partData, planSourceImport, readManifest, readPart,
  samePart, SOURCE_EXAMPLES, sourceTextPrompt, TEXT_KIND, textsOfWork, type TextManifest
} from './sourceText';

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
    const lines: string[] = [];
    const warnings: string[] = [];
    let running = manifest;
    const docs = documentsOf(doc);
    for (const [i, raw] of docs.entries()) {
      const plan = planSourceImport(raw, { work, ...(running === undefined ? {} : { manifest: running }) });
      const label = docs.length > 1 ? `Dokument ${i + 1}: ` : '';
      if ('error' in plan) { if (docs.length === 1) return plan; warnings.push(`${label}${plan.error}`); continue; }
      const s = plan.summary;
      const range = s.first === undefined ? '' : `, miejsca ${s.first}${s.last !== s.first ? ` – ${s.last}` : ''}`;
      const pages = s.pages === undefined ? '' : `, ${pageRangeLabel(s.pages)}`;
      lines.push(`${label}${plan.replaces ? 'Zastąpi' : 'Doda'} część „${plan.portion.label}” (${plan.portion.key}): ${count(s.blocks, 'blok', 'bloki', 'bloków')}, ${count(s.words, 'słowo', 'słowa', 'słów')}${range}${pages}${s.notes > 0 ? `, ${count(s.notes, 'przypis', 'przypisy', 'przypisów')}` : ''}.`);
      if (plan.setScheme !== undefined) lines.push(`${label}Układ miejsc dzieła: ${schemeOf(plan.setScheme).label} („${plan.setScheme}”).`);
      for (const other of overlapsWith(running, plan)) warnings.push(`${label}część „${other}” obejmuje te same miejsca — czy to nie ten sam fragment pod innym kluczem?`);
      warnings.push(...plan.warnings.map((w) => `${label}${w}`));
      running = readManifest(nextManifest(running, work.id, plan, 'preview'));
    }
    if (lines.length === 0) return { error: warnings[0] ?? 'Nic do zaimportowania.' };
    return { lines, warnings };
  };

  const onImport = async (doc: unknown, stage: (what: string) => void): Promise<JsonPreview> => {
    if (!target.writes) throw new WorkspaceError('W tej bibliotece możesz tylko czytać.');
    if (target.areaPublic === true && !(await ask({
      title: 'Tekst w bibliotece publicznej?',
      body: `Biblioteka „${target.name}” jest w obszarze publicznym — pełny tekst przeczyta każdy, także bez konta. Udostępniaj tylko teksty, które wolno publikować (prawa autorskie).`,
      confirm: 'Tak, zapisz publicznie'
    }))) return { lines: ['Nic nie zapisano.'], warnings: [] };
    const lines: string[] = [];
    const warnings: string[] = [];
    let current = targetStore.ownTexts(work.id)[0];
    let read = current === undefined ? undefined : readManifest(current.data);
    const textId = current?.id ?? newId();
    const docs = documentsOf(doc);
    for (const [i, raw] of docs.entries()) {
      const plan = planSourceImport(raw, { work, ...(read === undefined ? {} : { manifest: read }) });
      if ('error' in plan) { warnings.push(`Dokument ${i + 1}: ${plan.error}`); continue; }
      const had = read?.parts.find((p) => p.key === plan.portion.key);
      if (had !== undefined) {
        const before = await targetStore.heavy(had.id);
        if (before !== null && samePart(readPart(before.data), plan)) { lines.push(`„${plan.portion.label}”: bez zmian.`); continue; }
      }
      stage(`Zapisywanie części ${i + 1} z ${docs.length}…`);
      const partId = had?.id ?? newId();
      /* Erst der Teil, dann das Verzeichnis: ein Verzeichnis zeigt nie auf einen Teil, den es nicht gibt. */
      await targetStore.save({ id: partId, kind: PART_KIND, data: partData(textId, work.id, plan) });
      current = await targetStore.save({ id: textId, kind: TEXT_KIND, data: nextManifest(read, work.id, plan, partId) });
      read = readManifest(current.data);
      lines.push(`„${plan.portion.label}”: ${had === undefined ? 'dodana' : 'zastąpiona'}.`);
      warnings.push(...plan.warnings);
      /* Die Regel der Stellen gehört ans Werk — wenn es noch keine hat und man dort schreibt. */
      if (plan.setScheme !== undefined && typeof work.data.scheme !== 'string' && library.writes && store.own(work.id) !== undefined) {
        await store.save({ id: work.id, kind: 'work', ...(work.key === undefined ? {} : { key: work.key }), data: { ...work.data, scheme: plan.setScheme } }).catch(() => {
          warnings.push('Nie udało się zapisać układu miejsc przy dziele — tekst ma go i tak.');
        });
      }
    }
    return { lines: lines.length === 0 ? ['Nic nie zapisano.'] : lines, warnings };
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
      {writable.length > 1 && (
        <label className="wk-field">
          <span>Biblioteka tekstu</span>
          <select value={target.libraryId} onChange={(e) => setTargetId(e.target.value)}>
            {writable.map((l) => <option key={l.libraryId} value={l.libraryId}>{l.name}{l.areaPublic === true ? ' (publiczna)' : ''}</option>)}
          </select>
        </label>
      )}
      {target.libraryId !== library.libraryId && <p className="wk-note">Tekst będzie w bibliotece „{target.name}”, dzieło jest w „{library.name}”. Kto czyta tylko „{library.name}”, widzi dzieło i cytaty, ale nie tekst.</p>}
      {target.areaPublic === true && <p className="wk-note">Biblioteka „{target.name}” jest publiczna — tekst przeczyta każdy, także bez konta.</p>}
      <JsonPanel
        open
        summary={`Tekst: ${title}`}
        lead={<>Jedna część tekstu na dokument (albo lista dokumentów) — np. przepisana przez AI z PDF-u. Część o tym samym kluczu zastępuje poprzednią, inne zostają; ta sama część drugi raz niczego nie zmienia. Obok jest opis formatu i polecenie do skopiowania.</>}
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

