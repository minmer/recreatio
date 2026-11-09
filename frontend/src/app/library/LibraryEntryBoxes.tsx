/**
 * Die Kästen neben einem Eintrag — in der Bibliothek und im Skryptorium
 * (2026-10-23): Schlüssel, JSON, Löschen. Die Beziehungen stehen in
 * `LibraryRelations.tsx`, wer ihn liest in `LibraryAreaBox.tsx`; LaTeX und
 * die Powtórka eines Textes im Skryptorium (`scriptorium/WritingBoxes.tsx`).
 *
 * Welches Format ein Eintrag hat, sagt sein Teil (`EntryFormat`): die
 * Bibliothek `recreatio/library`, das Skryptorium `recreatio/scriptorium`.
 */

import { useEffect, useState } from 'react';

import { WorkspaceError } from '../core/session';
import { rich, useT } from '../core/i18n';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import type { LibraryImportPlan } from './libraryJson';
import { type LibEntry, isKey, kindOf } from './libraryKinds';
import type { Entry, LibraryStore } from './libraryStore';

/** 2026-10-23 — wie ein Teil seine Einträge als JSON nimmt und gibt. */
export interface EntryFormat {
  readonly plan: (doc: unknown) => LibraryImportPlan | { error: string };
  readonly exportDoc: (entries: readonly LibEntry[]) => Record<string, unknown>;
  readonly describe: () => string;
}

/* -- Der Schlüssel ------------------------------------------------------------------------------ */

/**
 * DER ZITIERSCHLÜSSEL — eine Schreibhilfe (2026-10-22): Texte speichern die
 * Kennung, nicht den Schlüssel. Übernommen wird er erst beim Verlassen des
 * Feldes oder mit Enter — nicht jedes halb getippte Zwischenstück; der alte
 * bleibt als zweiter Schlüssel am Eintrag (`_aliases`).
 */
export function KeyBox({ store, id, value, readOnly, onChange }: {
  store: LibraryStore; id: string; value: string; readOnly: boolean;
  onChange: (next: string) => Promise<{ pinned: number; failed: number } | null>;
}) {
  const [draft, setDraft] = useState(value);
  const [note, setNote] = useState<string | null>(null);
  const t = useT();
  useEffect(() => { setDraft(value); }, [value]);
  const taken = draft !== '' && store.keyTaken(draft, id);
  const elsewhere = draft !== '' && !taken ? store.keyTakenElsewhere(draft, id) : undefined;
  const wrong = draft !== '' && !isKey(draft);
  const commit = () => {
    if (draft === value || wrong) return;
    void onChange(draft).then((r) => setNote(r === null || r.pinned + r.failed === 0 ? null
      : r.failed > 0 ? t('library.key.pinnedSome', { n: r.pinned, failed: r.failed }) : t('library.key.pinned', { n: r.pinned })));
  };
  return (
    <section className="lib-box">
      <h2 className="lib-box-h">{t('library.key.title')}</h2>
      <input value={draft} disabled={readOnly} placeholder={t('library.key.placeholder')} aria-label={t('library.key.title')}
        onChange={(e) => setDraft(e.target.value.replace(/\s+/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
      {draft !== '' && !taken && !wrong && <p className="lib-key-hint">{rich(t('library.key.hint', { key: draft }), { a: (s, k) => <code key={k}>{s}</code>, b: (s, k) => <code key={k}>{s}</code> })}</p>}
      {taken && <p className="wk-warn">{t('library.key.taken')}</p>}
      {elsewhere !== undefined && <p className="wk-warn">{t('library.key.elsewhere', { key: draft })}</p>}
      {wrong && <p className="wk-warn">{t('library.key.wrong')}</p>}
      {note !== null && <p className="wk-note">{note}</p>}
    </section>
  );
}

/* -- JSON und Löschen ------------------------------------------------------------------------------ */

/**
 * Ein NEUER Wpis nimmt das Dokument auf sich: der eine Eintrag seiner Art
 * darin, der noch keine bekannte Kennung hat, wird zu diesem — wer ein Buch
 * als JSON (von einer KI, aus einem anderen Programm) einfügt, ist danach auf
 * seiner Seite. Personen und Themen daneben entstehen wie beim Import der
 * Bibliothek.
 */
function intoThis(doc: unknown, id: string, kind: string, store: LibraryStore): unknown {
  const root = typeof doc === 'object' && doc !== null && !Array.isArray(doc) ? doc as Record<string, unknown> : null;
  const list: unknown[] | null = Array.isArray(doc) ? doc : Array.isArray(root?.entries) ? root!.entries as unknown[] : root !== null && typeof root.kind === 'string' ? [root] : null;
  if (list === null) return doc;
  const known = (one: Record<string, unknown>) => (typeof one.id === 'string' && store.get(one.id) !== undefined)
    || (typeof one.key === 'string' && store.byKey(one.key.replace(/^@/, ''))?.kind === kind);
  const mine = list.filter((one): one is Record<string, unknown> => typeof one === 'object' && one !== null && (one as Record<string, unknown>).kind === kind && !known(one as Record<string, unknown>));
  if (mine.length !== 1) return doc;
  const next = list.map((one) => (one === mine[0] ? { ...mine[0], id } : one));
  return Array.isArray(doc) ? next : root!.entries !== undefined ? { ...root, entries: next } : next[0];
}

export function EntryJson({ store, entry, isNew, format, home }: {
  store: LibraryStore;
  entry: LibEntry;
  isNew: boolean;
  format: EntryFormat;
  /** Wohin ein neuer Eintrag nach dem Import führt. */
  home: (id: string) => string;
}) {
  const t = useT();
  const label = kindOf(entry.kind)?.label.toLowerCase() ?? t('library.doc.entry').toLowerCase();
  const shaped = (doc: unknown) => (isNew ? intoThis(doc, entry.id, entry.kind, store) : doc);
  const preview = (doc: unknown): JsonPreview | { error: string } => {
    const planned = format.plan(shaped(doc));
    return 'error' in planned ? planned : { lines: planned.lines, warnings: planned.warnings };
  };
  return (
    <JsonPanel
      summary={isNew ? t('library.entryJson.importOnly') : t('library.entryJson.summary')}
      lead={isNew
        ? <>{t('library.entryJson.leadNew', { kind: label })}</>
        : <>{t('library.entryJson.lead')}</>}
      fileName={`${t('library.entryJson.fileName')}-${entry.key ?? entry.id.slice(0, 8)}.json`}
      exportDoc={() => format.exportDoc([entry])}
      description={format.describe}
      preview={preview}
      importLabel={t('library.json.import')}
      onImport={async (doc) => {
        const planned = format.plan(shaped(doc));
        if ('error' in planned) throw new WorkspaceError(planned.error);
        for (const draft of planned.drafts) await store.save({ id: draft.id, kind: draft.kind, ...(draft.key === undefined ? {} : { key: draft.key }), data: draft.data });
        if (isNew && planned.drafts.some((d) => d.id === entry.id)) window.location.replace(home(entry.id));
        return { lines: planned.lines, warnings: planned.warnings };
      }}
    />
  );
}

/** `back`: wohin es nach dem Löschen geht (die Liste seiner Art). */
export function DeleteBox({ store, entry, back: backTo }: { store: LibraryStore; entry: Entry; back: string }) {
  const [sure, setSure] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const back = store.backlinks(entry.id);
  const t = useT();
  return (
    <section className="lib-box">
      {!sure ? (
        <button type="button" className="wk-link-btn lib-danger-link" onClick={() => setSure(true)}>{t('library.remove.open')}</button>
      ) : (
        <>
          <p>{t('library.remove.ask', { title: store.title(entry) })}{back.length > 0 ? ` ${t('library.remove.backlinks', { count: back.length })}` : ''}</p>
          <div className="wk-actions">
            <button type="button" className="wk-btn lib-btn-danger" onClick={() => void store.remove(entry.id).then(
              () => { window.location.hash = backTo; },
              (e: unknown) => setFailed(e instanceof WorkspaceError ? e.message : t('libraryData.music.removeFailed')))}>{t('common.delete')}</button>
            <button type="button" className="wk-link-btn" onClick={() => setSure(false)}>{t('common.cancel')}</button>
          </div>
          {failed !== null && <p className="wk-error">{failed}</p>}
        </>
      )}
    </section>
  );
}
