/**
 * COGITA — WER LERNT, und wohin seine Antworten gehen (COGITA.md §7).
 *
 * <code>
 *   ein Konto      eine seiner Personen (mehrere Personen, je ein Fortschritt [E11])
 *   ein Platz      ein Mensch aus einem Formular, ohne Konto (P-256)
 *   niemand        im Browser behalten, nach der Anmeldung mitnehmen [L6]
 * </code>
 */

import { useEffect, useMemo, useState } from 'react';

import { loadAreas } from '../areas/area';
import { fromBase64Url } from '../core/crypto';
import type { Me } from '../core/me';
import { loadSeatChats, seatIdentity } from '../seats/seatChat';
import type { SeatView } from '../seats/seatContext';
import { answersArea, placeFor } from './answersTo';
import { Learner, targetOf, type Holder, type Target } from './learn';
import type { CogitaLibrary } from './store';

export function holderOfMe(me: Me, roleId?: string | null): Holder {
  const role = (roleId == null ? undefined : me.roles.find((r) => r.id === roleId && r.kind === 'person')) ?? me.person;
  return { kind: 'role', roleId: role.id, wrapPublicKey: fromBase64Url(role.wrapPublicKey), wrapPrivate: () => me.ring.wrapPrivate(role.id) };
}

/** Der Platz als Lernender — seine Identität wird angelegt, wenn er noch keine hat (wie für die Rozmowa). */
export async function holderOfSeat(seat: SeatView): Promise<Holder | null> {
  if (seat.seatKey === null) return null;
  let found = (await loadSeatChats(seat.token)).identity;
  const opened = await seatIdentity(seat.token, seat.seatId, seat.seatKey, found);
  if (found === null) found = (await loadSeatChats(seat.token)).identity;
  if (found === null) return null;
  return { kind: 'seat', token: seat.token, seatId: seat.seatId, wrapPublicKey: fromBase64Url(found.wrapPublicKey), wrapPrivate: opened.wrapPrivateKey };
}

const LOCAL = 'recreatio:cogita:local';

/** Wer ohne Konto lernt: eine Kennung je Browser — sie bleibt, bis die Daten der Seite gelöscht werden. */
export function localHolder(): Holder {
  let id = '';
  try {
    id = localStorage.getItem(LOCAL) ?? '';
    if (id === '') { id = crypto.randomUUID(); localStorage.setItem(LOCAL, id); }
  } catch {
    id = 'tab';
  }
  return { kind: 'local', id };
}

let personal: Promise<string | null> | null = null;

/** Der eigene private Bereich — dorthin gehen die Antworten, wenn der Kurs keinen nennt. */
export function personalArea(): Promise<string | null> {
  personal ??= loadAreas().then((r) => r.areas.find((a) => a.personal === true)?.areaId ?? null, () => null);
  return personal;
}

let readable: { readonly at: number; readonly ids: Promise<ReadonlySet<string> | null> } | null = null;

/** Die Bereiche, die dieses Konto liest — eine halbe Minute gemerkt; `null`: unbekannt (ohne Netz). */
function readableAreas(): Promise<ReadonlySet<string> | null> {
  if (readable === null || Date.now() - readable.at > 30_000) {
    const ids = loadAreas().then((r) => new Set(r.areas.map((a) => a.areaId.toLowerCase())), () => null);
    readable = { at: Date.now(), ids };
  }
  return readable.ids;
}

/**
 * Wohin (`answersTo.ts`): was der Ort sagt — ein Baustein auf einer Seite, eine Powtórka, ein Schritt (`override`) —,
 * sonst die Baza (Ustawienia), sonst der eigene Bereich. 2026-11-01: eine Person schickt nur in einen Bereich, den sie
 * liest; sonst bleiben die Antworten bei ihr.
 */
export async function targetFor(lib: CogitaLibrary, holder: Holder, override?: string | null): Promise<Target | null> {
  if (holder.kind === 'local') return null;
  const said = answersArea(override, lib.settings().storageAreaId);
  if (holder.kind === 'seat') return targetOf(placeFor('seat', said, null, null, lib.areaId).areaId);
  const reads = said === null ? null : await readableAreas();
  const may = reads === null ? null : (id: string) => reads.has(id.toLowerCase());
  const allowed = said !== null && (may === null || may(said));
  const place = placeFor('role', said, may, allowed ? null : await personalArea(), lib.areaId);
  const target = await targetOf(place.areaId);
  return place.own ? { ...target, own: true } : target;
}

/**
 * Ein Lernender in dieser Bibliothek — geladen, und neu gezeichnet, wenn sich sein Fortschritt ändert.
 * 2026-10-27 — nur der des JETZIGEN Halters: wechselt er (jemand stellt sich vor, eine andere Person wird
 * gewählt), ist es `null`, bis der neue geladen ist. Vorher galt so lange der alte weiter, und die ersten
 * Antworten gingen an ihn (im Browser statt an den Kurs).
 */
export function useLearner(lib: CogitaLibrary | null, holder: Holder | null, override?: string | null): { learner: Learner | null; tick: number; failed: string | null } {
  const [held, setHeld] = useState<{ key: string; learner: Learner } | null>(null);
  const [tick, setTick] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const key = holder === null ? '' : holder.kind === 'role' ? holder.roleId : holder.kind === 'seat' ? holder.seatId : holder.id;
  const whose = `${lib?.libraryId ?? ''}|${key}|${override ?? ''}`;
  useEffect(() => {
    if (lib === null || holder === null) { setHeld(null); return undefined; }
    let alive = true;
    let off = () => undefined as void;
    void (async () => {
      try {
        const target = await targetFor(lib, holder, override);
        const made = new Learner(lib.libraryId, holder, target);
        off = made.subscribe(() => setTick((n) => n + 1));
        await made.load();
        if (alive) { setHeld({ key: whose, learner: made }); setFailed(null); }
      } catch (e) {
        if (alive) setFailed(e instanceof Error ? e.message : 'Nie udało się wczytać postępów.');
      }
    })();
    return () => { alive = false; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib?.libraryId, key, override]);
  const learner = held !== null && held.key === whose ? held.learner : null;
  useEffect(() => {
    if (learner === null) return undefined;
    const online = () => { void learner.flush().catch(() => undefined); };
    window.addEventListener('online', online);
    const leave = () => { void learner.flush().catch(() => undefined); };
    window.addEventListener('pagehide', leave);
    return () => { window.removeEventListener('online', online); window.removeEventListener('pagehide', leave); void learner.flush().catch(() => undefined); };
  }, [learner]);
  return useMemo(() => ({ learner, tick, failed }), [learner, tick, failed]);
}
