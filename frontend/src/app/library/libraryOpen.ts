/**
 * BIBLIOTHEKEN AUF EINER SEITE LESEN (2026-10-22).
 *
 * Wer eine Bibliothek liest, entscheidet ihr Bereich. Eine Seite holt darum
 * keine „veröffentlichten Fassungen" mehr, sondern dieselben Hüllen wie ein
 * Mitglied und öffnet sie hier, im Browser:
 *
 * <code>
 *   öffentlicher Bereich   /library/{id}/open  + /area/{id}/key?epoch=   (ohne Konto)
 *   sonst, als Mitglied    /workspace/library/{id}/entries + die eigenen Schlüssel
 *   sonst                  nichts — die Seite sagt, dass sie die Bibliothek nicht lesen kann
 * </code>
 *
 * Verweise reichen über die Bibliothek hinaus. Was hier fehlt, sucht
 * `/library/where`: liegt es in einer Bibliothek, die dieser Browser lesen
 * darf, wird sie dazugeholt; sonst bleibt der Verweis ein Verweis ohne Ziel —
 * man sieht, dass es ihn gibt, aber nichts über das, worauf er zeigt
 * (`UNREADABLE` in `comment.ts`).
 */

import { useEffect, useState } from 'react';

import { areaReader, type AreaReader } from '../areas/areaRead';
import { fromBase64Url } from '../core/crypto';
import { blockRefs, blocksOf } from './comment';
import { libraryWhere, loadEntries, loadLibraries, loadOpen, loadPublicKeyAt, type OpenRead } from './library';
import { fieldRefs, type LibEntry } from './libraryKinds';
import { readOnlyStore, type LibraryStore } from './libraryStore';

let reader: AreaReader | null = null;
const readerOf = (): AreaReader => (reader ??= areaReader());

const publicKeys = new Map<string, Promise<Uint8Array | undefined>>();

/** Die Schlüssel der Epochen — zuerst die offengelegten, dann was dieser Browser sonst hält (Link, Platz, Konto). */
async function keysOf(areaId: string, epochs: readonly number[]): Promise<ReadonlyMap<number, Uint8Array>> {
  const out = new Map<number, Uint8Array>();
  for (const epoch of new Set(epochs)) {
    const at = `${areaId}:${epoch}`;
    let shown = publicKeys.get(at);
    if (shown === undefined) {
      shown = loadPublicKeyAt(areaId, epoch).then((k) => (k.epoch === epoch ? fromBase64Url(k.key) : undefined), () => undefined);
      publicKeys.set(at, shown);
    }
    const key = (await shown) ?? (await readerOf().key(areaId, epoch).catch(() => undefined));
    if (key !== undefined) out.set(epoch, key);
  }
  return out;
}

/* -- Die Speicher der Seite ------------------------------------------------------------- */

const opened = new Map<string, Promise<LibraryStore | null>>();
const ready = new Map<string, LibraryStore>();
const pagePeers = (): LibraryStore[] => [...ready.values()];

/** Eine Bibliothek für die Seite öffnen — `null`: dieser Browser darf sie nicht lesen. */
export function pageLibrary(libraryId: string): Promise<LibraryStore | null> {
  let found = opened.get(libraryId);
  if (found === undefined) {
    found = openOne(libraryId).catch(() => null);
    opened.set(libraryId, found);
  }
  return found;
}

async function openOne(libraryId: string): Promise<LibraryStore | null> {
  let store: LibraryStore | null = null;

  /* Der öffentliche Weg: die erste Antwort dient gleich als erster Abgleich. */
  const first = await loadOpen(libraryId, null).catch(() => null);
  if (first !== null) {
    let pending: OpenRead | null = first;
    store = readOnlyStore({ libraryId, areaId: first.areaId }, async (since) => {
      if (pending !== null && since === null) { const r = pending; pending = null; return r; }
      return loadOpen(libraryId, since);
    }, keysOf);
  } else {
    /* Der Weg eines Mitglieds (oder eines Links): die Liste der Bibliotheken nennt den Bereich. */
    const row = await loadLibraries().then((r) => r.libraries.find((l) => l.libraryId === libraryId), () => undefined);
    if (row === undefined || row.kind === 'knowledge') return null;
    store = readOnlyStore(row, (since) => loadEntries(libraryId, since), keysOf);
  }

  store.setPeers(pagePeers);
  ready.set(libraryId, store);
  try {
    await store.sync();
  } catch {
    ready.delete(libraryId);
    return null;
  }
  void reach(store);
  return store;
}

/** Ziele, die schon gefragt wurden — eine Kennung wird nur einmal gesucht. */
const asked = new Set<string>();

/** Die Verweise eines Speichers, die nirgends liegen: suchen und, wo erlaubt, ihre Bibliotheken dazuholen. */
async function reach(store: LibraryStore): Promise<void> {
  const missing = new Set<string>();
  for (const entry of store.all()) {
    for (const ref of [...fieldRefs(entry), ...blockRefs(blocksOf(entry.data)).map((r) => r.ref)]) {
      if (!asked.has(ref) && store.get(ref) === undefined) missing.add(ref);
    }
  }
  const ids = [...missing];
  for (const id of ids) asked.add(id);
  const libraries = new Set<string>();
  for (let i = 0; i < ids.length; i += 400) {
    const found = await libraryWhere(ids.slice(i, i + 400)).catch(() => ({ found: [] }));
    for (const one of found.found) if (!opened.has(one.libraryId)) libraries.add(one.libraryId);
  }
  await Promise.all([...libraries].map((id) => pageLibrary(id)));
}

/**
 * Einen Eintrag für die Seite finden: in der genannten Bibliothek, bei ihren
 * Nachbarn — oder, ist er umgezogen (ein Text, der öffentlich wurde), dort,
 * wo `/library/where` ihn findet. `null`: dieser Leser darf ihn nicht lesen.
 */
export async function findOnPage(libraryId: string, entryId: string): Promise<{ store: LibraryStore; entry: LibEntry } | null> {
  const store = await pageLibrary(libraryId);
  const here = store?.get(entryId);
  if (store !== null && here !== undefined) return { store, entry: here };
  const where = await libraryWhere([entryId]).catch(() => ({ found: [] }));
  const home = where.found[0]?.libraryId;
  if (home === undefined) return null;
  const there = await pageLibrary(home);
  const entry = there?.get(entryId);
  return there === null || entry === undefined ? null : { store: there, entry };
}

/** Eine Bibliothek auf der Seite — mit allem, was sie erreicht; zeichnet neu, wenn etwas dazukommt. */
export function usePageLibrary(libraryId: string | null): {
  readonly store: LibraryStore | null;
  readonly revision: number;
  readonly state: 'loading' | 'ready' | 'closed';
} {
  const [store, setStore] = useState<LibraryStore | null>(libraryId === null ? null : ready.get(libraryId) ?? null);
  const [state, setState] = useState<'loading' | 'ready' | 'closed'>(store === null ? 'loading' : 'ready');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (libraryId === null) { setStore(null); setState('closed'); return undefined; }
    let alive = true;
    let off: (() => void) | null = null;
    setState(ready.has(libraryId) ? 'ready' : 'loading');
    void pageLibrary(libraryId).then((found) => {
      if (!alive) return;
      setStore(found);
      setState(found === null ? 'closed' : 'ready');
      if (found !== null) off = found.subscribe(() => setRevision(found.revision));
    });
    return () => { alive = false; off?.(); };
  }, [libraryId]);

  return { store, revision, state };
}
