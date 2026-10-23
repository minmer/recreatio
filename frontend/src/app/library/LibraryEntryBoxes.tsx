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
  useEffect(() => { setDraft(value); }, [value]);
  const taken = draft !== '' && store.keyTaken(draft, id);
  const elsewhere = draft !== '' && !taken ? store.keyTakenElsewhere(draft, id) : undefined;
  const wrong = draft !== '' && !isKey(draft);
  const commit = () => {
    if (draft === value || wrong) return;
    void onChange(draft).then((r) => setNote(r === null || r.pinned + r.failed === 0 ? null
      : `Teksty, które nazywały wpis starym kluczem (${r.pinned}), wskazują go teraz na stałe${r.failed > 0 ? `; ${r.failed} w bibliotekach, których nie możesz zmieniać — tam działa stary klucz, zachowany przy wpisie` : ''}.`));
  };
  return (
    <section className="lib-box">
      <h2 className="lib-box-h">Klucz cytowania</h2>
      <input value={draft} disabled={readOnly} placeholder="zostanie zaproponowany" aria-label="Klucz cytowania"
        onChange={(e) => setDraft(e.target.value.replace(/\s+/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
      {draft !== '' && !taken && !wrong && <p className="lib-key-hint">W tekście: <code>[@{draft}]</code> albo <code>[@{draft}, s. 12]</code> — zapisze się stały odnośnik, więc zmiana klucza niczego nie zepsuje.</p>}
      {taken && <p className="wk-warn">Ten klucz ma już inny wpis w tej bibliotece — zostanie uzupełniony literą.</p>}
      {elsewhere !== undefined && <p className="wk-warn">Ten klucz ma już wpis w innej bibliotece, którą widzisz. Pisząc [@{draft}] w tej bibliotece wybierasz ten wpis; w tekstach zapisze się stały odnośnik, więc nic się nie pomyli.</p>}
      {wrong && <p className="wk-warn">Tylko litery, cyfry i znaki . _ : -</p>}
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
  const label = kindOf(entry.kind)?.label.toLowerCase() ?? 'wpis';
  const shaped = (doc: unknown) => (isNew ? intoThis(doc, entry.id, entry.kind, store) : doc);
  const preview = (doc: unknown): JsonPreview | { error: string } => {
    const planned = format.plan(shaped(doc));
    return 'error' in planned ? planned : { lines: planned.lines, warnings: planned.warnings };
  };
  return (
    <JsonPanel
      summary={isNew ? 'Import z JSON' : 'Import / eksport JSON'}
      lead={isNew
        ? <>Wklej opis ({label}) jako JSON — np. przygotowany przez AI. Powstanie ten wpis (i to, na co w nim wskazujesz, jeśli opiszesz to w tym samym dokumencie).</>
        : <>Ten wpis jako JSON — do poprawienia ręcznie albo przez AI. Import zmienia go w miejscu (pola, których nie podasz, zostają).</>}
      fileName={`wpis-${entry.key ?? entry.id.slice(0, 8)}.json`}
      exportDoc={() => format.exportDoc([entry])}
      description={format.describe}
      preview={preview}
      importLabel="Importuj i zapisz"
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
  return (
    <section className="lib-box">
      {!sure ? (
        <button type="button" className="wk-link-btn lib-danger-link" onClick={() => setSure(true)}>Usuń ten wpis…</button>
      ) : (
        <>
          <p>Usunąć „{store.title(entry)}”?{back.length > 0 ? ` Odwołuje się do niego ${back.length} wpisów — te odwołania zostaną puste.` : ''}</p>
          <div className="wk-actions">
            <button type="button" className="wk-btn lib-btn-danger" onClick={() => void store.remove(entry.id).then(
              () => { window.location.hash = backTo; },
              (e: unknown) => setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć.'))}>Usuń</button>
            <button type="button" className="wk-link-btn" onClick={() => setSure(false)}>Anuluj</button>
          </div>
          {failed !== null && <p className="wk-error">{failed}</p>}
        </>
      )}
    </section>
  );
}
