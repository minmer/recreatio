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
import { isChallenge, loadPortal, openGrants } from '../seats/seat';
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
  return { kind: 'seat', token: seat.token, seatId: seat.seatId, wrapPublicKey: fromBase64Url(found.wrapPublicKey), wrapPrivate: opened.wrapPrivateKey, seatKey: seat.seatKey };
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

/**
 * Wohin (`answersTo.ts`): was der Ort sagt — ein Baustein auf einer Seite, eine Powtórka, ein Schritt (`override`) —,
 * sonst die Baza (Ustawienia), sonst der eigene Bereich. 2026-11-01: dazu der Ausweichort — nimmt der Dienst den
 * genannten Bereich nicht (der Lernende gehört nicht dazu), gehen die Antworten dorthin (`Learner.retarget`).
 */
export async function targetFor(lib: CogitaLibrary, holder: Holder, override?: string | null): Promise<{ readonly target: Target | null; readonly fallback: Target | null }> {
  if (holder.kind === 'local') return { target: null, fallback: null };
  const said = answersArea(override, lib.settings().storageAreaId);
  /*
   * 2026-11-01 — NENNT DER ORT DIE „OBSZARY OSÓB" EINES FORMULARS (einen virtuellen Bereich, 0120), schickt eine
   * Person ihre Antworten in IHREN Bereich darin — versiegelt unter seinem Schlüssel (0136): sie selbst liest ihn, und
   * wer ihn nach der Regel liest (die Prowadzący), sieht ihre Antworten. Die Lesbarkeit ist der Zugang.
   */
  if (holder.kind === 'seat' && said !== null && holder.seatKey !== undefined) {
    const own = await ownAreaIn(holder.token, holder.seatKey, said).catch(() => null);
    if (own !== null) {
      const fallback = await targetOf(lib.areaId);
      return { target: { areaId: own.areaId, intake: null, areaKey: { epoch: own.epoch, key: own.key } }, fallback: own.areaId === lib.areaId ? null : fallback };
    }
  }
  const personal = holder.kind === 'role' ? await personalArea() : null;
  const { place, fallback } = placeFor(holder.kind, said, personal, lib.areaId);
  const as = async (where: { readonly areaId: string; readonly own: boolean }): Promise<Target> => {
    const target = await targetOf(where.areaId);
    return where.own ? { ...target, own: true } : target;
  };
  return { target: await as(place), fallback: fallback === null ? null : await as(fallback) };
}

/** Der eigene Bereich eines Platzes in einem virtuellen Bereich seines Formulars — mit seinem Schlüssel; `null`: keiner. */
async function ownAreaIn(token: string, seatKey: Uint8Array, virtualAreaId: string): Promise<{ readonly areaId: string; readonly epoch: number; readonly key: Uint8Array } | null> {
  const portal = await loadPortal(token);
  if (isChallenge(portal)) return null;
  const grant = portal.grants.find((g) => (g.virtualAreaId ?? '').toLowerCase() === virtualAreaId.toLowerCase());
  if (grant === undefined) return null;
  const opened = (await openGrants([grant], seatKey)).get(grant.areaId);
  return opened === undefined ? null : { areaId: grant.areaId, epoch: opened.epoch, key: opened.key };
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
        const { target, fallback } = await targetFor(lib, holder, override);
        const made = new Learner(lib.libraryId, holder, target, fallback);
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
