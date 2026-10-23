/**
 * NAUKA, VOM SKRYPTORIUM AUS GESEHEN (2026-10-23).
 *
 * Ein Rodzaj tekstu kann auf Einträge in Nauka zeigen („Kazanie maryjne":
 * Tajemnica, Obszar). Damit der Editor eines Rodzaju die Rodzaje von Nauka
 * anbieten und der Text einen ihrer Einträge wählen kann, sieht das
 * Skryptorium alle Bazy wiedzy und Bibliotheken, die dieses Konto lesen
 * kann — durch eine Linse: eine `CogitaLibrary` über dem Speicher des
 * Skryptorium, mit ihnen als Quellen. Sie liest nur; einen Eintrag in Nauka
 * legt sie nie an (`kinds` ist leer, `saveEntity` sagt nein) — dafür ist
 * Nauka da. Verweise gehen nur in eine Richtung: vom Skryptorium hinaus.
 */

import { useEffect, useState } from 'react';

import { CogitaLibrary, type Source } from '../cogita/store';
import type { KindDef } from '../cogita/schema';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { libraryKindOf, loadLibraries, openLibraries } from '../library/library';
import { storeOf, type Entry, type LibraryStore } from '../library/libraryStore';

/** Die Linse: liest Nauka und die Bibliotheken, legt nichts an. */
export class ScriptoriumLens extends CogitaLibrary {
  /* Keine „eigenen" Rodzaje — so bietet kein Wähler an, hier einen Eintrag von Nauka anzulegen (`creatorFor`). */
  override get kinds(): readonly KindDef[] { return []; }

  override async saveEntity(): Promise<Entry> {
    throw new WorkspaceError('Wpisy Nauki dodaje się w Nauce — tu można je tylko wskazać.');
  }
}

/** Die Linse eines Skryptorium — alle lesbaren Bazy wiedzy und Bibliotheken als Quellen; \`null\`, solange sie lädt. */
export function useLens(me: Me, store: LibraryStore): ScriptoriumLens | null {
  const [lens, setLens] = useState<ScriptoriumLens | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const offs: (() => void)[] = [];
    void (async () => {
      const rows = await openLibraries(me.ring, (await loadLibraries()).libraries);
      const sources: Source[] = [];
      for (const row of rows) {
        const kind = libraryKindOf(row);
        if (row.libraryId === store.libraryId || kind === 'writing') continue;
        const one = storeOf(me.ring, row);
        await one.sync().catch(() => undefined);
        if (!one.loaded) continue;
        sources.push({ store: one, kind, name: row.name });
        offs.push(one.subscribe(() => setTick((n) => n + 1)));
      }
      if (!alive) return;
      const made = new ScriptoriumLens(store, false);
      made.setSources(sources);
      setLens(made);
    })().catch(() => { if (alive) setLens(new ScriptoriumLens(store, false)); });
    return () => { alive = false; offs.forEach((off) => off()); };
  }, [me.ring, store]);
  return lens;
}

/** Die Ziele eines Verweisfeldes in einem Rodzaj tekstu: die Rodzaje von Nauka (mit ihrer Baza) und die Quellen der Bibliothek. */
export function lensTargets(lens: CogitaLibrary): { id: string; name: string }[] {
  const bases = new Map(lens.sourceList().filter((s) => s.kind === 'knowledge').map((s) => [s.store.libraryId, s.name]));
  const out: { id: string; name: string }[] = [];
  for (const kind of lens.refKinds) {
    if (['work', 'quote', 'person'].includes(kind.id)) { out.push({ id: kind.id, name: `${kind.name} (Biblioteka)` }); continue; }
    if (kind.system !== undefined || ['text', 'delivery', 'project'].includes(kind.id)) continue;
    const from = lens.origin(kind.id);
    const base = from === undefined ? undefined : bases.get(from.libraryId);
    out.push({ id: kind.id, name: base === undefined ? kind.name : `${kind.name} (${base})` });
  }
  return out;
}

/** Ein Rodzaj von Nauka beim Namen (ohne Rücksicht auf Gross/klein) oder bei der Kennung — für den Import. */
export function kindRefIn(lens: CogitaLibrary | null): ((token: string) => string | null) | undefined {
  if (lens === null) return undefined;
  return (token) => {
    const wanted = token.trim().toLowerCase();
    const found = lens.refKinds.filter((k) => k.id === token || k.name.trim().toLowerCase() === wanted);
    return found.length === 1 ? found[0].id : null;
  };
}

/** Ein Eintrag von Nauka beim Namen, unter den Einträgen dieser Rodzaje — eindeutig, sonst keiner. */
export function entryByNameIn(lens: CogitaLibrary | null): ((name: string, kinds: readonly string[]) => string | null) | undefined {
  if (lens === null) return undefined;
  return (name, kinds) => {
    const wanted = name.trim().toLowerCase();
    const found = lens.search(name, kinds.length === 0 ? undefined : kinds, true).filter((e) => lens.label(e).trim().toLowerCase() === wanted);
    return found.length === 1 ? found[0].id : null;
  };
}
