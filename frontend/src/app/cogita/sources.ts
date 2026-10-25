/**
 * 0110 — DIE QUELLEN EINER BAZA WIEDZY ÖFFNEN (COGITA.md §2.1).
 *
 * Was ihre Einstellungen nennen (`sources`) — und was deren Einstellungen
 * nennen: eine wiederverwendete Baza wiedzy bringt ihre eigenen Quellen mit,
 * damit ihre Verweise auch hier aufgehen. Höchstens zwölf, jede einmal, ohne
 * Kreis; wie eine Quelle gebraucht wird (nur verweisen oder wiederverwenden),
 * sagt die, die sie nennt.
 *
 * <b>Jede wird mit dem Zugang zu ihrem eigenen Bereich gelesen</b> — ein Konto
 * mit seinem Schlüsselbund, ein Platz über seinen Weg. Was dieser Browser
 * nicht lesen kann, fehlt und steht in den Einstellungen als „niedostępne".
 * Nichts wird kopiert, und der Dienst gibt durch einen Verweis nichts frei.
 */

import { useEffect, useMemo, useState } from 'react';

import { loadLibraries, openLibraries, type OpenLibrary } from '../library/library';
import { storeOf, type LibraryStore } from '../library/libraryStore';
import type { Me } from '../core/me';
import { readSettings, type CogitaLibrary, type Source, type SourceRef } from './store';

/** Eine Quelle öffnen — ihr Speicher, abgeglichen; \`null\`: nicht lesbar (oder nicht mehr da). */
export type OpenSource = (ref: SourceRef) => Promise<LibraryStore | null>;

export const MAX_SOURCES = 12;

/** Eine Baza wiedzy kam dazu, heisst anders oder ist weg — die Liste in Nauka holt sich neu. */
export const BASES_CHANGED = 'recreatio:cogita-bases';

export interface SourceState {
  /** Genannt, aber nicht lesbar. */
  readonly missing: readonly SourceRef[];
  readonly loading: boolean;
}

/** Breit zuerst: erst die eigenen Quellen, dann deren. */
export async function loadSources(lib: CogitaLibrary, open: OpenSource): Promise<{ loaded: Source[]; missing: SourceRef[] }> {
  const loaded: Source[] = [];
  const missing: SourceRef[] = [];
  const seen = new Set<string>([lib.libraryId]);
  const queue: SourceRef[] = [...lib.settings().sources];
  while (queue.length > 0 && loaded.length < MAX_SOURCES) {
    const ref = queue.shift()!;
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);
    const store = await open(ref).catch(() => null);
    if (store === null) { missing.push(ref); continue; }
    loaded.push({ store, kind: ref.kind, name: ref.name });
    if (ref.kind === 'knowledge') queue.push(...readSettings(store.all().find((e) => e.kind === 'settings')?.data).sources);
  }
  return { loaded, missing };
}

/** Mit dem Konto: was in der Liste meiner Bibliotheken steht (die Bereiche, deren Schlüssel ich halte), im Speicher des Tabs. */
export function accountSources(me: Me): OpenSource {
  let rows: Promise<readonly OpenLibrary[]> | null = null;
  return async (ref) => {
    rows ??= loadLibraries().then((r) => openLibraries(me.ring, r.libraries));
    const row = (await rows).find((one) => one.libraryId === ref.id);
    if (row === undefined) return null;
    const store = storeOf(me.ring, row);
    await store.sync();
    return store;
  };
}

/**
 * Die Quellen laden und mitzeichnen — neu, wenn die eigenen Einstellungen andere nennen; abgeglichen, wenn die Karte wieder sichtbar wird.
 * 2026-10-25 — `loading` gilt schon im ersten Bild, solange die genannten Quellen dieser Baza noch nicht geladen sind
 * (vorher hiess ein Eintrag aus einer Quelle einen Augenblick lang „nie ma").
 */
export function useSources(lib: CogitaLibrary | null, open: OpenSource | null): SourceState {
  const key = lib === null ? '' : JSON.stringify(lib.settings().sources.map((s) => [s.id, s.kind]));
  /* Ein Zeichen je Baza, Öffner und Liste der Quellen — geladen ist, was für dieses Zeichen fertig wurde. */
  const ticket = useMemo(() => ({ lib, open, key }), [lib, open, key]);
  const [state, setState] = useState<SourceState & { readonly for?: object }>({ missing: [], loading: false });
  const [, setTick] = useState(0);
  useEffect(() => {
    if (lib === null || open === null) return undefined;
    let alive = true;
    const offs: (() => void)[] = [];
    let stores: readonly LibraryStore[] = [];
    setState((was) => ({ ...was, loading: true }));
    void loadSources(lib, open).then(({ loaded, missing }) => {
      if (!alive) return;
      lib.setSources(loaded);
      stores = loaded.map((s) => s.store);
      for (const s of loaded) offs.push(s.store.subscribe(() => setTick((n) => n + 1)));
      setState({ missing, loading: false, for: ticket });
      setTick((n) => n + 1);
    }, () => { if (alive) setState({ missing: [], loading: false, for: ticket }); });
    const again = () => {
      if (document.visibilityState === 'visible') for (const store of stores) void store.sync().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', again);
    return () => { alive = false; offs.forEach((off) => off()); document.removeEventListener('visibilitychange', again); };
    // Die Quellen hängen an dem, was die Einstellungen nennen (\`key\`), nicht an jeder Änderung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, open, key]);
  const loading = state.loading || (lib !== null && open !== null && key !== '[]' && state.for !== ticket);
  /* Dasselbe Objekt, solange sich nichts ändert — es steht in Kontexten und Abhängigkeiten. */
  return useMemo(() => ({ missing: state.missing, loading }), [state.missing, loading]);
}
