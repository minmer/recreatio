/**
 * Etwas, das man sich für eine Zeit nehmen kann — die Browserseite (0039).
 *
 * <b>Zwei Fälle, ein Weg.</b> Ein Firmling nimmt sich einen Platz bei einem
 * Treffen mit dem Priester; eine Gruppe fragt nach einem Haus. Beides ist ein
 * DING (`Resource`) mit Regeln und ein ANSPRUCH darauf (`claim`). Welche Regeln
 * gelten, sagt das Ding selbst — der Browser zeigt nur, was daraus folgt.
 *
 * <b>Der Dienst entscheidet, nicht diese Datei.</b> Ob etwas passt, steht in
 * `Bookings.JudgeOffer` und `Bookings.Busiest` und dort genau einmal. Es hier
 * noch einmal zu rechnen hiesse, zwei Meinungen zu haben — und die im Browser
 * wäre die, der man nicht trauen darf.
 */

import { call } from './session';

/** Wer die Zeit wählt: die Kanzlei (`offered`) oder wer fragt (`open`). */
export type Mode = 'offered' | 'open';

export type Kind = 'person' | 'room' | 'house' | 'place' | 'other';

export const KIND_LABEL: Record<Kind, string> = {
  person: 'Osoba',
  room: 'Pomieszczenie',
  house: 'Dom',
  place: 'Miejsce',
  other: 'Inne'
};

/** Die Regeln eines Dings — so, wie jeder sie sehen darf. */
export interface Rules {
  readonly resourceId: string;
  readonly name: string;
  readonly kind: Kind;
  readonly mode: Mode;
  readonly byNight: boolean;
  readonly checkInMin: number;
  readonly checkOutMin: number;
  readonly capacity: number;
  readonly bufferBefore: number;
  readonly bufferAfter: number;
  readonly approval: 'none' | 'office';
  readonly inviteHours: number;
  readonly leadDays: number;
}

/**
 * Was dieser Mensch mit einem angebotenen Termin tun kann.
 *
 * <code>
 *   open           frei — nimm ihn
 *   inviteneeded   jemand hält ihn; es braucht seinen Code oder sein Ja
 *   locked         das Fenster ist zu und es sitzen schon zwei darauf
 *   full           voll
 *   mine           er gehört schon dir
 * </code>
 */
export type OfferState = 'open' | 'inviteneeded' | 'locked' | 'full' | 'mine';

export interface Offer {
  readonly itemId: string;
  readonly occurrenceAt: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly taken: number;
  readonly capacity: number;
  readonly state: OfferState;
  readonly inviteUntil: string | null;
  readonly myClaimId: string | null;
  readonly myStatus: Status | null;
  readonly hosting: boolean;

  /** Wer um Mitnahme bittet — nur für den Gastgeber, und nur der Name des Platzes. */
  readonly asks: readonly { claimId: string; name: string | null }[];
}

export type Status = 'pending' | 'confirmed' | 'declined' | 'released';

export interface MyClaim {
  readonly claimId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly itemId: string | null;
  readonly occurrenceAt: string | null;
  readonly groupId: string;
  readonly status: Status;
  readonly awaits: 'office' | 'host' | null;
  readonly hosting: boolean;
  readonly inviteUntil: string | null;
}

/** Belegt — ohne Namen. `whole`: ein Teil des Baums darüber oder darunter. */
export interface Busy {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly whole: boolean;
  readonly tentative: boolean;
}

export interface Offers {
  readonly resource: Rules;
  readonly offers?: readonly Offer[];
  readonly busy?: readonly Busy[];
  readonly mine: readonly MyClaim[];
}

/**
 * Was an einem Ding frei ist.
 */
export function loadOffers(resource: string, seat?: string | null,
  from?: Date, to?: Date): Promise<Offers> {
  const q = new URLSearchParams({ resource });
  if (seat) q.set('seat', seat);
  if (from) q.set('from', from.toISOString());
  if (to) q.set('to', to.toISOString());

  return call(`/resource/offers?${q.toString()}`);
}

export interface Taken {
  readonly claimId: string;
  readonly status: Status;
  readonly awaits: 'office' | 'host' | null;

  /** Genau einmal — gespeichert ist nur sein Abdruck. */
  readonly inviteCode: string | null;
  readonly inviteUntil: string | null;
}

/** Einen angebotenen Termin nehmen. */
export const takeOffer = (resourceId: string, offer: Pick<Offer, 'itemId' | 'occurrenceAt'>,
  seat: string, code?: string): Promise<Taken> =>
  call('/resource/claim', {
    method: 'POST',
    body: JSON.stringify({
      resourceId, itemId: offer.itemId, occurrenceAt: offer.occurrenceAt,
      seat, code: code?.trim() || null
    })
  });

/**
 * Eine frei gewählte Zeit erfragen.
 *
 * `groupId` bündelt mehrere zu EINER Anfrage — das Haus für drei Nächte und
 * die Kapelle für einen Nachmittag. Die Kanzlei sagt zu allen auf einmal ja.
 */
export const takeSpan = (resourceId: string, startsAt: Date, endsAt: Date,
  seat: string, groupId?: string): Promise<Taken> =>
  call('/resource/claim', {
    method: 'POST',
    body: JSON.stringify({
      resourceId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
      seat, groupId: groupId ?? null
    })
  });

export const releaseClaim = (claimId: string, seat: string): Promise<{ released: boolean }> =>
  call('/resource/release', { method: 'POST', body: JSON.stringify({ claimId, seat }) });

/** Um Mitnahme bitten, wenn der Code fehlt. */
export const askToJoin = (resourceId: string, offer: Pick<Offer, 'itemId' | 'occurrenceAt'>,
  seat: string): Promise<Taken> =>
  call('/resource/ask', {
    method: 'POST',
    body: JSON.stringify({ resourceId, itemId: offer.itemId, occurrenceAt: offer.occurrenceAt, seat })
  });

/** Der Gastgeber sagt ja oder nein. */
export const hostDecides = (claimId: string, accept: boolean, seat: string) =>
  call<{ status: Status }>('/resource/decide', {
    method: 'POST', body: JSON.stringify({ claimId, accept, seat })
  });

/* -- die Kanzlei ---------------------------------------------------------- */

export interface ResourceRow extends Omit<Rules, 'resourceId'> {
  readonly resourceId: string;
  readonly areaId: string;
  readonly parentId: string | null;
  readonly calendarId: string | null;

  /** Was auf ein Ja der Kanzlei wartet. */
  readonly pending: number;
}

export const loadResources = (): Promise<{ resources: readonly ResourceRow[] }> =>
  call('/workspace/resources');

export type ResourceChange = Partial<{
  parentId: string;
  calendarId: string;
  name: string;
  kind: Kind;
  mode: Mode;
  byNight: boolean;
  checkInMin: number;
  checkOutMin: number;
  capacity: number;
  bufferBefore: number;
  bufferAfter: number;
  approval: 'none' | 'office';
  inviteHours: number;
  leadDays: number;
}>;

export const createResource = (resourceId: string, areaId: string, change: ResourceChange) =>
  call<ResourceRow>('/workspace/resource', {
    method: 'POST', body: JSON.stringify({ resourceId, areaId, ...change })
  });

export const updateResource = (resourceId: string, change: ResourceChange) =>
  call<ResourceRow>(`/workspace/resource/${encodeURIComponent(resourceId)}`, {
    method: 'POST', body: JSON.stringify(change)
  });

export interface OfficeClaim {
  readonly claimId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly status: Status;
  readonly awaits: 'office' | 'host' | null;
  readonly groupId: string;
  readonly hosting: boolean;
  readonly name: string | null;
  readonly roleId: string | null;
  readonly createdAt: string;
}

export const loadClaims = (resourceId: string): Promise<{ resource: ResourceRow; claims: readonly OfficeClaim[] }> =>
  call(`/workspace/resource/${encodeURIComponent(resourceId)}/claims`);

/** Ja oder nein zur ganzen Anfrage — alle Teile auf einmal. */
export const officeDecides = (claimId: string, accept: boolean) =>
  call<{ decided: number; status: Status }>(`/workspace/claim/${encodeURIComponent(claimId)}/decide`, {
    method: 'POST', body: JSON.stringify({ accept })
  });

/* -- Zeiten ---------------------------------------------------------------- */

/**
 * Nächte in Zeitpunkte — mit den Zeiten des Dings.
 *
 * <b>Im Browser, weil nur er die Ortszeit sicher kennt.</b> Der Dienst prüft die
 * Zeitpunkte; wann „Anreise am Freitag" beginnt, weiss der Ort (16:00), und
 * diese Rechnung gehört dorthin, wo man den Tag auswählt.
 */
export function nightsToSpan(arrive: string, depart: string, rules: Rules): { starts: Date; ends: Date } {
  const at = (day: string, minutes: number) => {
    const d = new Date(`${day}T00:00:00`);
    d.setMinutes(minutes);
    return d;
  };

  return { starts: at(arrive, rules.checkInMin), ends: at(depart, rules.checkOutMin) };
}

export const minutesToTime = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
