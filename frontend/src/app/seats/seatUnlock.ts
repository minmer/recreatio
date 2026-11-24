/**
 * 2026-11-24 (Eigentümer: „der Schüler braucht kein Konto; verliert er den Zugang, bekommt er von der Lehrerin einen Link")
 * — EIN BEHALTENER PLATZ SCHLIESST AUF, WAS ER LESEN DARF, auch ausserhalb einer Seite mit Plätzen (`PublicPage` öffnet sie
 * mit `useSeat`): der Platzschlüssel aus dem Link, die Bereiche seiner Freigaben und seiner Rollen (bei einer Person einer
 * Klasse: die Rolle des Links → die Uczniowie → die Klasse und die Baza). Die Schlüssel bleiben nur im Speicher dieses Tabs
 * (`rememberSeatAreaKeys`), wie bei `useSeat`. Gebraucht von `library/libraryOpen.ts`: eine Baza, die dieser Browser weder
 * öffentlich noch als Mitglied noch über einen Link liest, öffnet sich über den Weg des Platzes (`/seat/{token}/library`).
 */

import { rememberSeatAreaKeys } from '../roles/roleBundle';
import { openSeatRoles } from '../roles/memberRole';
import { isChallenge, loadPortal, openGrants, openPortal } from './seat';
import { heldSeats, recall, seatsFor } from './seatKeep';

const unlocked = new Map<string, Promise<boolean>>();

/** Den Platz aufschliessen (einmal je Tab) — `false`: er geht nicht auf (zurückgenommen, neuer Link, Bestätigung offen). */
export function unlockSeat(token: string): Promise<boolean> {
  let found = unlocked.get(token);
  if (found === undefined) {
    found = (async () => {
      const held = recall(token);
      if (held === null) return false;
      const reply = await loadPortal(token);
      if (isChallenge(reply)) return false;
      const seatKey = await openPortal(reply, held);
      const grants = await openGrants(reply.grants, seatKey);
      rememberSeatAreaKeys(new Map([...grants].map(([areaId, one]) => [areaId, new Map([[one.epoch, one.key]])])));
      await openSeatRoles(reply.seatId, seatKey, reply.roles).catch(() => null);
      return true;
    })().catch(() => false);
    unlocked.set(token, found);
  }
  return found;
}

/** Der Pfad der Seite, die gerade offen ist (hinter `#/`, ohne `?…`). */
const pathHere = (): string => (typeof window === 'undefined' ? '' : window.location.hash.replace(/^#\/?/, '').split('?')[0] ?? '');

/** Die Plätze, die dieser Browser hält — die dieser Seite zuerst (wie `PersonProvider` wählt), dann die übrigen. */
export function seatsToTry(path: string = pathHere()): readonly string[] {
  const here = seatsFor(path);
  return [...here, ...heldSeats().filter((token) => !here.includes(token))];
}
