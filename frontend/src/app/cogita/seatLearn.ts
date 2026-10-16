/**
 * COGITA HINTER EINEM PERSÖNLICHEN LINK (0109, COGITA.md §7): ein Platz liest
 * die Bibliothek seines Kurses über seinen eigenen Weg (`/seat/…/library`)
 * mit den Schlüsseln, die er hält (Freigabe oder die Rolle seines
 * Formulars, `areaReader`), und lernt als er selbst — seine Antworten gehen
 * versiegelt in den Bereich des Kurses.
 *
 * Gebraucht vom Baustein „Nauka (osoba z linkiem)" und vom Schritt „Naucz się".
 */

import { useEffect, useMemo, useState } from 'react';

import { areaReader } from '../areaRead';
import { libraryNameWith, loadSeatEntries, loadSeatLibrary } from '../library';
import { readOnlyStore } from '../libraryStore';
import type { SeatView } from '../seatContext';
import type { Card } from './cards';
import { holderOfSeat, useLearner } from './holders';
import { average, knownessOf, shareOf } from './knowness';
import type { Holder, Learner } from './learn';
import { runPython } from './python';
import { planFor } from './RevisionRun';
import { CogitaLibrary } from './store';
import type { CogitaCtx } from './ui';

export interface SeatLibrary {
  /** `undefined`: wird geöffnet; `null`: dieser Platz liest sie nicht. */
  readonly lib: CogitaLibrary | null | undefined;
  readonly name: string;
  readonly keyOf: (epoch: number) => Promise<Uint8Array | undefined>;
}

/** Die Bibliothek, wie dieser Platz sie liest — über seinen Weg, mit den Schlüsseln, die er hält. */
export function useSeatLibrary(seat: SeatView, libraryId: string): SeatLibrary {
  const reader = useMemo(() => areaReader(null), []);
  const [lib, setLib] = useState<CogitaLibrary | null | undefined>(undefined);
  const [name, setName] = useState('Biblioteka');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (libraryId === '') { setLib(null); return undefined; }
    let alive = true;
    let off = () => undefined as void;
    setLib(undefined);
    void (async () => {
      try {
        const row = await loadSeatLibrary(seat.token, libraryId);
        const keys = async (area: string, epochs: readonly number[]) => {
          const out = new Map<number, Uint8Array>();
          for (const epoch of epochs) {
            const key = await reader.key(area, epoch);
            if (key !== undefined) out.set(epoch, key);
          }
          return out;
        };
        const store = readOnlyStore(row, (since) => loadSeatEntries(seat.token, row.libraryId, since), keys);
        off = store.subscribe(() => setTick((n) => n + 1));
        await store.sync();
        const nameKey = await reader.key(row.areaId, row.epoch);
        const made = new CogitaLibrary(store, false);
        made.python = runPython;
        const named = nameKey === undefined ? 'Biblioteka' : await libraryNameWith(nameKey, row);
        if (!alive) return;
        setName(named);
        setAreaId(row.areaId);
        setLib(made);
      } catch {
        if (alive) setLib(null);
      }
    })();
    return () => { alive = false; off(); };
  }, [seat.token, libraryId, reader]);
  const keyOf = useMemo(() => (epoch: number) => (areaId === null ? Promise.resolve(undefined) : reader.key(areaId, epoch)), [areaId, reader]);
  return { lib, name, keyOf };
}

/** Der Platz als Lernender dieser Bibliothek — seine Identität entsteht beim ersten Mal (wie für die Rozmowa). */
export function useSeatLearner(seat: SeatView, lib: CogitaLibrary | null | undefined): { learner: Learner | null; failed: string | null } {
  const [holder, setHolder] = useState<Holder | null>(null);
  useEffect(() => {
    let alive = true;
    void holderOfSeat(seat).then((h) => { if (alive) setHolder(h); }, () => { if (alive) setHolder(null); });
    return () => { alive = false; };
  }, [seat]);
  const { learner, failed } = useLearner(lib ?? null, holder);
  return { learner, failed };
}

/** Was die Bausteine von Cogita brauchen, für einen Platz (Dateien über seinen Weg, Hinweise über ihn). */
export const seatCtx = (lib: CogitaLibrary, name: string, keyOf: SeatLibrary['keyOf'], token: string): CogitaCtx => ({
  lib, name, writes: false, keyOf, seat: token, me: null, who: null, href: () => '#'
});

/**
 * WIE GUT ER ES KANN — die mittlere Kenntnis über die Karten der
 * Wiederholung (ohne eine: über alle Karten der Bibliothek), 0..1. Gerechnet
 * im Browser; der Dienst sieht nur den Haken, wenn die Schwelle erreicht ist.
 */
export async function learnedShare(lib: CogitaLibrary, learner: Learner, revisionId: string | null, now = Date.now()): Promise<{ share: number; cards: readonly Card[] }> {
  let cards: readonly Card[] = [];
  if (revisionId !== null && lib.docs('revision').some((r) => r.id === revisionId)) {
    const made = await planFor(lib, revisionId, null, 'step', now);
    cards = made.plan?.cards ?? [];
  }
  if (cards.length === 0) cards = (await lib.cards('step')).cards;
  if (cards.length === 0) return { share: 0, cards };
  return { share: average(cards.map((c) => shareOf(knownessOf(learner.marks(c.key, c.fingerprint), now)))), cards };
}
