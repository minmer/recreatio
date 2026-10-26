/**
 * EIN EINTRAG IM FORMULAR — gespeichert wird von selbst (2026-10-23 aus
 * `LibraryEditor.tsx` herausgelöst: dieselbe Mechanik für die Quellen der
 * Bibliothek und die Texte des Skryptorium).
 *
 * <b>Gespeichert wird von selbst</b>, kurz nachdem das Tippen aufhört — ein
 * Kapitel geht nicht verloren, weil jemand vergass, auf „Zapisz" zu drücken.
 * Wer die Seite verlässt, während noch etwas wartet, verliert es nicht; was
 * ein anderer Tab gespeichert hat, kommt herein, solange hier nichts offen
 * ist; hat jemand anderes inzwischen gespeichert, wird gefragt (`stale`).
 *
 * Im Formular stehen Schlüssel (`shownMarkup`); der Speicher schreibt daraus
 * Kennungen (`storedMarkup`, 2026-10-22).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { newId } from '../core/ids';
import { WorkspaceError } from '../core/session';
import { kindOf, shownMarkup, type EntryData, type LibEntry } from './libraryKinds';
import type { Entry, LibraryStore } from './libraryStore';

export type SaveState = 'new' | 'saved' | 'dirty' | 'saving' | 'failed' | 'stale';

export interface EntryDraft {
  readonly id: string;
  readonly kind: string;
  readonly data: EntryData;
  readonly key: string;
  readonly state: SaveState;
  readonly failed: string | null;
  /** Wie er gespeichert liegt — \`undefined\`, solange er neu ist. */
  readonly saved: Entry | undefined;
  /** Wie er gerade im Formular steht. */
  readonly live: LibEntry;
  /** Der Zustand in Worten, für die Kopfzeile. */
  readonly status: string;
  readonly set: (patch: EntryData) => void;
  /** Ein neuer Schlüssel — gespeichert wird mit dem nächsten Mal. */
  readonly setKey: (next: string) => void;
  /** Jetzt speichern, was im Formular steht (auch über eine neuere Fassung hinweg). */
  readonly saveNow: () => Promise<Entry | null>;
  /**
   * 2026-10-26 — eine Änderung SOFORT speichern, nicht erst nach dem Tippen: die Dateien der Musik liegen
   * schon beim Dienst, der Eintrag muss sie gleich nennen (wer die Karte gleich schliesst, verliert sonst
   * den Verweis und lässt die Datei verwaist zurück). `null`: nicht gespeichert.
   */
  readonly commit: (patch: EntryData) => Promise<Entry | null>;
  /** Einen neuen Eintrag anlegen und dann dorthin (\`go\`). */
  readonly create: (go: (id: string) => void) => Promise<void>;
  /** Die neuere Fassung eines anderen übernehmen. */
  readonly reloadTheirs: () => void;
}

const STATUS: Record<SaveState, string> = {
  new: 'Nowy — zapisz, żeby powstał.',
  saving: 'Zapisywanie…',
  dirty: 'Zmiany…',
  failed: 'Nie zapisano.',
  stale: 'Ktoś zmienił ten wpis w międzyczasie.',
  saved: 'Zapisane.'
};

export function useEntryDraft(store: LibraryStore, existing: Entry | undefined, kind: string, initial: () => EntryData, readOnly: boolean): EntryDraft {
  const [id] = useState(() => existing?.id ?? newId());
  const [data, setData] = useState<EntryData>(() => (existing === undefined ? initial() : shownMarkup(kind, existing.data, store)));
  const [key, setKeyState] = useState(existing?.key ?? '');
  const [state, setState] = useState<SaveState>(existing === undefined ? 'new' : 'saved');
  const [failed, setFailed] = useState<string | null>(null);
  const saved = store.get(id);

  const set = useCallback((patch: EntryData) => {
    setData((was) => ({ ...was, ...patch }));
    setState((was) => (was === 'new' ? 'new' : 'dirty'));
  }, []);

  const setKey = useCallback((next: string) => {
    setKeyState(next);
    setState((was) => (was === 'new' ? 'new' : 'dirty'));
  }, []);

  const save = useCallback(async (next: EntryData, nextKey: string): Promise<Entry | null> => {
    setState('saving');
    setFailed(null);
    try {
      const done = await store.save({ id, kind, ...(nextKey.trim() === '' ? {} : { key: nextKey.trim() }), data: next });
      setKeyState(done.key ?? '');
      setState((was) => (was === 'saving' ? 'saved' : was));
      return done;
    } catch (e) {
      const stale = e instanceof WorkspaceError && e.verdict === 'stale';
      setState(stale ? 'stale' : 'failed');
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
      return null;
    }
  }, [id, kind, store]);

  /* Von selbst speichern — gut eine Sekunde nach dem letzten Tastendruck. */
  useEffect(() => {
    if (state !== 'dirty' || readOnly) return undefined;
    const timer = window.setTimeout(() => { void save(data, key); }, 1200);
    return () => window.clearTimeout(timer);
  }, [state, data, key, save, readOnly]);

  /* Wer die Seite verlässt, während noch etwas wartet, verliert es nicht. */
  const pending = useRef<{ data: EntryData; key: string } | null>(null);
  pending.current = state === 'dirty' ? { data, key } : null;
  useEffect(() => () => { if (pending.current !== null) void save(pending.current.data, pending.current.key); }, [save]);

  /* Was ein anderer Tab gespeichert hat, kommt herein — solange hier nichts offen ist. */
  useEffect(() => {
    const fresh = store.get(id);
    if (fresh !== undefined && state === 'saved') { setData(shownMarkup(kind, fresh.data, store)); setKeyState(fresh.key ?? ''); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.revision]);

  const reloadTheirs = () => {
    const fresh = store.get(id);
    if (fresh !== undefined) { setData(shownMarkup(kind, fresh.data, store)); setKeyState(fresh.key ?? ''); }
    setState('saved');
    setFailed(null);
  };

  const create = async (go: (id: string) => void) => {
    const done = await save(data, key);
    if (done !== null) go(done.id);
  };

  /* Was zuletzt im Formular steht — auch zwischen zwei Bildern (mehrere Dateien nacheinander). */
  const latest = useRef({ data, key });
  latest.current = { data, key };
  const commit = useCallback((patch: EntryData): Promise<Entry | null> => {
    const next = { ...latest.current.data, ...patch };
    latest.current = { data: next, key: latest.current.key };
    setData(next);
    return save(next, latest.current.key);
  }, [save]);

  const live: LibEntry = { id, kind, ...(key === '' ? {} : { key }), data };
  return {
    id, kind, data, key, state, failed, saved, live, status: STATUS[state],
    set, setKey, saveNow: () => save(data, key), commit, create, reloadTheirs
  };
}

/** Der Titel eines Eintrags, wie er im Formular steht. */
export const draftTitle = (draft: EntryDraft, store: LibraryStore): string => kindOf(draft.kind)?.title(draft.data, store) ?? '';
