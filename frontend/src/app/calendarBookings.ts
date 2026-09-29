/**
 * DIE RESERVIERUNGEN IM EIGENEN KALENDER (0057).
 *
 * An einem angebotenen Termin („Spotkanie z księdzem, sobota 9:40") hängt,
 * wer darauf sitzt — die Kandidaten —, wie viel noch frei ist und wer auf
 * ein Ja wartet. Der Kalender zeigt es am Termin selbst; wer den Bereich des
 * Dings führt, entscheidet dort auch gleich.
 *
 * <code>
 *   offers     angebotene Vorkommen im Zeitraum, mit Plätzen und Namen
 *   bookings   frei gewählte Zeiten (ein Haus, ein Saal) im Zeitraum
 *   waiting    was auf ein Ja der Kanzlei wartet — ohne Zeitraum
 * </code>
 *
 * Die Regeln stehen im Dienst (`Bookings.Agenda.cs`) und sind dieselben wie
 * unter „Rezerwacje": Namen sieht, wer den Bereich liest; entscheiden darf,
 * wer darin schreibt (`mayDecide`).
 */

import type { Status } from './resource';
import { call } from './session';

export interface BookingResource {
  readonly resourceId: string;
  readonly areaId: string;
  readonly calendarId: string | null;
  readonly name: string;
  readonly kind: string;
  readonly mode: 'offered' | 'open';
  readonly capacity: number;
  readonly approval: 'none' | 'office';
  readonly minPersons: number;
  readonly mayDecide: boolean;
}

export interface HeldClaim {
  readonly claimId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: Status;
  readonly awaits: 'office' | 'host' | null;
  readonly groupId: string;
  /** Der Name, den die Kanzlei dem Platz gab — oder den die Person beim Nehmen mitschickte. */
  readonly name: string | null;
  readonly registeredAt: string | null;
  readonly roleId: string | null;
  readonly createdAt: string;
  readonly hosting: boolean;
  readonly hostPending: boolean;
  readonly byOffice: boolean;
  readonly withLink: boolean;
  readonly itemId: string | null;
  readonly occurrenceAt: string | null;
}

export interface AgendaOffer {
  readonly resourceId: string;
  readonly itemId: string;
  readonly occurrenceAt: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly capacity: number;
  readonly taken: number;
  readonly closedBy: 'office' | 'host' | null;
  readonly claims: readonly HeldClaim[];
}

export interface ResourceClaim {
  readonly resourceId: string;
  readonly claim: HeldClaim;
}

export interface AgendaBookings {
  readonly resources: readonly BookingResource[];
  readonly offers: readonly AgendaOffer[];
  readonly bookings: readonly ResourceClaim[];
  readonly waiting: readonly ResourceClaim[];
}

export const NO_BOOKINGS: AgendaBookings = { resources: [], offers: [], bookings: [], waiting: [] };

export const loadBookings = (from: Date, to: Date): Promise<AgendaBookings> =>
  call(`/workspace/agenda/bookings?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);

/** Dieselbe Zeit — die Zeichenketten des Dienstes tragen ihre Zone, verglichen wird der Augenblick. */
export const sameInstant = (a: string, b: string): boolean => new Date(a).getTime() === new Date(b).getTime();

/** Wartet auf ein Ja der Kanzlei — das sind die, um die es hier geht. */
export const waitsForOffice = (claim: HeldClaim): boolean => claim.status === 'pending' && claim.awaits === 'office';

/** Wer darauf sitzt, in Worten — auch ohne Namen findet die Kanzlei ihn. */
export function holderName(claim: HeldClaim): string {
  if (claim.name !== null && claim.name.trim() !== '') return claim.name;
  if (claim.withLink && claim.registeredAt !== null) {
    return `osoba z linku (zapisana ${new Date(claim.registeredAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })})`;
  }
  return claim.withLink ? 'osoba z linku' : 'bez nazwy';
}

/** Der Stand eines Anspruchs, kurz. */
export function claimWord(claim: HeldClaim): string {
  if (waitsForOffice(claim)) return 'czeka na potwierdzenie';
  if (claim.status === 'pending' && claim.awaits === 'host') return 'prosi gospodarza o miejsce';
  if (claim.hostPending) return 'pierwszy — decyduje, czy zaprasza';
  if (claim.hosting) return 'gospodarz terminu';
  return claim.byOffice ? 'wpisany przez kancelarię' : 'potwierdzony';
}

/** Wie viele am Termin auf ein Ja der Kanzlei warten. */
export const waitingOn = (offer: AgendaOffer): number => offer.claims.filter(waitsForOffice).length;
