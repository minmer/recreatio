/**
 * 2026-10-22 (Schritt 8) — EINE BAZA WIEDZY AUF EINER SEITE, ohne Bündel.
 *
 * Wer eine Baza wiedzy liest, entscheidet ihr Bereich — wie bei einer
 * Bibliothek (`library/libraryOpen.ts`): ein öffentlicher Bereich über
 * `/library/{id}/open` mit den offengelegten Schlüsseln, sonst als Mitglied,
 * über einen Link oder einen Platz, den dieser Browser hält. Ihre Quellen
 * ebenso, jede mit dem Zugang dieses Lesers zu ihrem Bereich; was er nicht
 * lesen darf, fehlt. Dann rechnet die Seite, was der Arbeitsbereich rechnet:
 * Karten, Powtórki, Przebiegi, Themen — aus den Einträgen selbst.
 *
 * Gebraucht von den Cogita-Bausteinen einer Seite, vom Mitmachen an einer
 * Sitzung ohne Konto, von „Wybór: wpis z bazy wiedzy" und von der Wahl im
 * Seiteneditor (`LibraryPick.tsx`) — die beiden letzten laden diese Datei
 * erst, wenn sie gebraucht wird.
 */

import { useEffect, useMemo, useState } from 'react';

import { pageKey, pageLibrary } from '../library/libraryOpen';
import { runPython } from './python';
import { loadSources, useSources, type OpenSource } from './sources';
import { labelOf, type Entity } from './schema';
import { CogitaLibrary } from './store';
import { DOC_KINDS, type DocKind } from './kinds';
import type { CogitaCtx } from './ui';

export interface PageBase {
  /** `undefined`: wird geöffnet; `null`: dieser Leser darf sie nicht lesen (nicht öffentlich, kein Zugang). */
  readonly lib: CogitaLibrary | null | undefined;
  /** Was die Bausteine von Cogita brauchen (Dateien, Quellen) — nur lesend. */
  readonly ctx: CogitaCtx | null;
}

/** Jede Quelle mit dem Zugang dieses Lesers zu ihrem Bereich. */
const openForPage: OpenSource = (ref) => pageLibrary(ref.id);

/**
 * Eine Baza wiedzy so öffnen, wie dieser Leser sie lesen darf — `null`: gar
 * nicht. Mit `withSources` auch ihre Quellen (einmal, ohne Mitzeichnen).
 */
export async function openPageBase(libraryId: string, withSources = true): Promise<CogitaLibrary | null> {
  if (libraryId === '') return null;
  const store = await pageLibrary(libraryId).catch(() => null);
  if (store === null) return null;
  const lib = new CogitaLibrary(store, false);
  lib.python = runPython;
  if (withSources) {
    const { loaded } = await loadSources(lib, openForPage).catch(() => ({ loaded: [] }));
    lib.setSources(loaded);
  }
  return lib;
}

export function usePageBase(libraryId: string): PageBase {
  const [lib, setLib] = useState<CogitaLibrary | null | undefined>(undefined);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (libraryId === '') { setLib(null); return undefined; }
    let alive = true;
    let off = () => undefined as void;
    setLib(undefined);
    void openPageBase(libraryId, false).then((made) => {
      if (!alive) return;
      if (made === null) { setLib(null); return; }
      off = made.store.subscribe(() => setTick((n) => n + 1));
      setLib(made);
    }, () => { if (alive) setLib(null); });
    return () => { alive = false; off(); };
  }, [libraryId]);

  const sources = useSources(lib ?? null, openForPage);
  const keyOf = useMemo(() => (epoch: number) => (lib == null ? Promise.resolve(undefined) : pageKey(lib.areaId, epoch)), [lib]);
  const keyIn = useMemo(() => (areaId: string, epoch: number) => pageKey(areaId, epoch), []);
  const ctx = useMemo<CogitaCtx | null>(() => (lib == null ? null : {
    lib, name: '', writes: false, keyOf, keyIn, sources, me: null, who: null, href: () => '#'
  }), [lib, keyOf, keyIn, sources]);
  return { lib, ctx };
}

export interface BaseChoice {
  readonly id: string;
  readonly label: string;
  /** Die Namen seiner Arten (nur bei Einträgen). */
  readonly kinds: readonly string[];
}

const isDoc = (kind: string): kind is DocKind => (DOC_KINDS as readonly string[]).includes(kind);
const docName = (data: Readonly<Record<string, unknown>>, kind: string): string =>
  typeof data.name === 'string' && data.name.trim() !== '' ? data.name : kind;

/**
 * Was ein Seitenbaustein aus einer Baza wiedzy wählen kann — nach den Arten
 * des Feldes (`entryKinds`): Powtórki und Przebiegi (auch aus Quellen),
 * Einträge (`entity`: alle, die die Baza kennt), und Werke, Personen, Texte …
 * aus den Bibliotheken und Skryptoria, aus denen sie schöpft (Tematy gibt es
 * seit 2026-10-23 nicht mehr).
 */
export function baseChoices(lib: CogitaLibrary, kinds: readonly string[]): BaseChoice[] {
  const out = new Map<string, BaseChoice>();
  const entity = (e: Entity) => {
    if (!out.has(e.id)) out.set(e.id, { id: e.id, label: labelOf(e, lib.look), kinds: e.kinds.map((k) => lib.kind(k)?.name ?? k) });
  };
  for (const kind of kinds) {
    if (isDoc(kind)) {
      for (const e of lib.docs(kind)) if (!out.has(e.id)) out.set(e.id, { id: e.id, label: docName(e.data, kind), kinds: [] });
    } else if (kind === 'entity') lib.entities().forEach(entity);
    else lib.material(kind).forEach(entity);
  }
  return [...out.values()].sort((a, b) => a.label.localeCompare(b.label, 'pl'));
}

/** „Wybór: wpis z bazy wiedzy": die eigenen Einträge der Baza — mit `of` nur die einer Art (ihr Name, ohne Gross/klein). */
export function entityChoices(lib: CogitaLibrary, of: string): BaseChoice[] {
  const wanted = of.trim().toLocaleLowerCase('pl-PL');
  return baseChoices(lib, ['entity'])
    .filter((c) => lib.isOwn(c.id))
    .filter((c) => wanted === '' || c.kinds.some((k) => k.toLocaleLowerCase('pl-PL') === wanted));
}
