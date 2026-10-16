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

import { loadAreas } from '../area';
import { fromBase64Url } from '../crypto';
import type { Me } from '../me';
import { loadSeatChats, seatIdentity } from '../seatChat';
import type { SeatView } from '../seatContext';
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

/** Wohin: was die Wiederholung (oder Sitzung, oder der Schritt) sagt, sonst der Kurs, sonst der eigene Bereich. */
export async function targetFor(lib: CogitaLibrary, holder: Holder, override?: string | null): Promise<Target | null> {
  if (holder.kind === 'local') return null;
  const declared = override ?? lib.settings().storageAreaId ?? null;
  if (declared !== null) return targetOf(declared);
  if (holder.kind === 'role') return targetOf((await personalArea()) ?? lib.areaId);
  return targetOf(lib.areaId);
}

/** Ein Lernender in dieser Bibliothek — geladen, und neu gezeichnet, wenn sich sein Fortschritt ändert. */
export function useLearner(lib: CogitaLibrary | null, holder: Holder | null, override?: string | null): { learner: Learner | null; tick: number; failed: string | null } {
  const [learner, setLearner] = useState<Learner | null>(null);
  const [tick, setTick] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);
  const key = holder === null ? '' : holder.kind === 'role' ? holder.roleId : holder.kind === 'seat' ? holder.seatId : holder.id;
  useEffect(() => {
    if (lib === null || holder === null) { setLearner(null); return undefined; }
    let alive = true;
    let off = () => undefined as void;
    void (async () => {
      try {
        const target = await targetFor(lib, holder, override);
        const made = new Learner(lib.libraryId, holder, target);
        off = made.subscribe(() => setTick((n) => n + 1));
        await made.load();
        if (alive) { setLearner(made); setFailed(null); }
      } catch (e) {
        if (alive) setFailed(e instanceof Error ? e.message : 'Nie udało się wczytać postępów.');
      }
    })();
    return () => { alive = false; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib?.libraryId, key, override]);
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
