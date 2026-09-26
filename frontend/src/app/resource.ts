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

import { aad, Field, fromBase64Url, openText, sealText, sha256, toBase64Url } from './crypto';
import { newId } from './ids';
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

  /** Wie viele Termine EINER halten darf — 0: keine Grenze (0045). */
  readonly perPerson: number;

  /**
   * Ab wie vielen Menschen ein Termin nach dem Fenster des Gastgebers NICHT
   * an alle zurückfällt — und ab wann der Gastgeber ihn schliessen darf (0049).
   */
  readonly minPersons: number;
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
 *   closed         geschlossen — von der Kanzlei oder vom Gastgeber (0049)
 * </code>
 */
export type OfferState = 'open' | 'inviteneeded' | 'locked' | 'full' | 'mine' | 'closed';

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

  /** Geschlossen — und von wem (0049). Der Gastgeber öffnet nur, was er selbst geschlossen hat. */
  readonly closedBy?: 'office' | 'host' | null;
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

  /** Der eigene Code, versiegelt unter dem Schlüssel des Halters (0045) — oder `null`. */
  readonly inviteSealed: string | null;
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
 * WER NIMMT (0045) — ein Platz aus einem Link, oder eine eigene Person, wenn
 * jemand angemeldet ist.
 *
 * `key` ist der Schlüssel, unter dem der Code des Gastgebers für ihn
 * versiegelt wird: der Platzschlüssel, oder der Schlüssel der Person. Fehlt
 * er (ein Link ohne Schlüssel), würfelt der Dienst den Code und sagt ihn
 * einmal, wie bisher.
 */
export type Holder =
  | { readonly kind: 'seat'; readonly token: string; readonly key: Uint8Array | null }
  | { readonly kind: 'role'; readonly roleId: string; readonly key: Uint8Array; readonly name: string | null };

/** Wie sich ein Halter dem Dienst ausweist — nie mit seinem Schlüssel. */
const who = (holder: Holder) => holder.kind === 'seat'
  ? { seat: holder.token }
  : { roleId: holder.roleId, name: holder.name };

/** Was an einem Ding frei ist — und, mit einem Halter, was er schon hält. */
export function loadOffers(resource: string, holder?: Holder | null,
  from?: Date, to?: Date): Promise<Offers> {
  const q = new URLSearchParams({ resource });
  if (holder?.kind === 'seat') q.set('seat', holder.token);
  if (holder?.kind === 'role') q.set('role', holder.roleId);
  if (from) q.set('from', from.toISOString());
  if (to) q.set('to', to.toISOString());

  /* Ein Dienst von vor 0049 nennt keine Mindestzahl — 2 ist, was damals galt. */
  return call<Offers>(`/resource/offers?${q.toString()}`)
    .then((got) => ({ ...got, resource: { ...got.resource, minPersons: got.resource.minPersons ?? 2 } }));
}

export interface Taken {
  readonly claimId: string;
  readonly status: Status;
  readonly awaits: 'office' | 'host' | null;

  /** Wurde er Gastgeber? Dann gibt es einen Code. */
  readonly hosting: boolean;

  /**
   * Der Code — der eigene, im Browser gewürfelt, oder der des Dienstes, wenn
   * es keinen Schlüssel gab, unter dem er sich hätte versiegeln lassen.
   */
  readonly inviteCode: string | null;
  readonly inviteUntil: string | null;
}

/* -- Der Code des Gastgebers (0045) --------------------------------------- */

/** Ohne 0, O, 1, I, L — dasselbe Alphabet wie im Dienst (`Bookings.CodeAlphabet`). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const inviteAad = (claimId: string) => aad('claim', 'invite', claimId, Field.ClaimInvite, 1);

/** Sechs Zeichen, gleich verteilt — ohne Modulo-Schieflage. */
export function newInviteCode(): string {
  let out = '';
  while (out.length < 6) {
    const [byte] = crypto.getRandomValues(new Uint8Array(1));
    if (byte < 248) out += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return out;
}

/** Derselbe Abdruck wie im Dienst: SHA-256 über den Code in Grossbuchstaben. */
export const inviteHash = (code: string) => sha256(code.trim().toUpperCase());

/**
 * Den eigenen Code wieder lesen — mit dem Schlüssel des Halters.
 * `null`: keiner da, oder nicht seiner.
 */
export async function openInvite(claim: Pick<MyClaim, 'claimId' | 'inviteSealed'>,
  holder: Holder): Promise<string | null> {
  if (claim.inviteSealed === null || holder.key === null) return null;
  try {
    return await openText(holder.key, inviteAad(claim.claimId), fromBase64Url(claim.inviteSealed));
  } catch {
    return null;
  }
}

/**
 * Einen angebotenen Termin nehmen — oder einen eigenen gegen ihn tauschen.
 *
 * <b>Der Code des Gastgebers entsteht HIER.</b> Wird dieser Anspruch der
 * erste auf dem Termin, nimmt der Dienst seinen Abdruck und das Siegel; der
 * Code selbst geht nie hinaus. Wird er es nicht, wirft der Dienst beides weg.
 */
export async function takeOffer(resourceId: string, offer: Pick<Offer, 'itemId' | 'occurrenceAt'>,
  holder: Holder, code?: string, replaces?: string): Promise<Taken> {
  const claimId = newId();
  const mine = holder.key === null ? null : newInviteCode();

  const done = await call<Taken>('/resource/claim', {
    method: 'POST',
    body: JSON.stringify({
      resourceId, itemId: offer.itemId, occurrenceAt: offer.occurrenceAt,
      ...who(holder),
      code: code?.trim() || null,
      claimId,
      ...(mine === null || holder.key === null ? {} : {
        inviteSha256: toBase64Url(await inviteHash(mine)),
        inviteSealed: toBase64Url(await sealText(holder.key, inviteAad(claimId), mine))
      }),
      replaces: replaces ?? null
    })
  });

  return { ...done, inviteCode: done.inviteCode ?? (done.hosting ? mine : null) };
}

/**
 * Eine frei gewählte Zeit erfragen.
 *
 * `groupId` bündelt mehrere zu EINER Anfrage — das Haus für drei Nächte und
 * die Kapelle für einen Nachmittag. Die Kanzlei sagt zu allen auf einmal ja.
 */
export const takeSpan = (resourceId: string, startsAt: Date, endsAt: Date,
  holder: Holder, groupId?: string): Promise<Taken> =>
  call('/resource/claim', {
    method: 'POST',
    body: JSON.stringify({
      resourceId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
      ...who(holder), groupId: groupId ?? null
    })
  });

export const releaseClaim = (claimId: string, holder: Holder): Promise<{ released: boolean }> =>
  call('/resource/release', { method: 'POST', body: JSON.stringify({ claimId, ...who(holder) }) });

/** Um Mitnahme bitten, wenn der Code fehlt. */
export const askToJoin = (resourceId: string, offer: Pick<Offer, 'itemId' | 'occurrenceAt'>,
  holder: Holder): Promise<Taken> =>
  call('/resource/ask', {
    method: 'POST',
    body: JSON.stringify({ resourceId, itemId: offer.itemId, occurrenceAt: offer.occurrenceAt, ...who(holder) })
  });

/**
 * DAS VORRECHT ABGEBEN — „ich lade niemanden ein". Die freien Plätze gehören
 * sofort allen; wer schon um Mitnahme gebeten hat, wird der Reihe nach
 * aufgenommen, solange Platz ist.
 */
export const resignHost = (claimId: string, holder: Holder) =>
  call<{ hosting: false; accepted: number; declined: number }>('/resource/unhost', {
    method: 'POST', body: JSON.stringify({ claimId, ...who(holder) })
  });

/**
 * Der Gastgeber schliesst seinen Termin — sobald genug darauf sitzen — oder
 * öffnet ihn wieder (0049).
 */
export const hostClose = (claimId: string, closed: boolean, holder: Holder) =>
  call<{ closed: boolean }>('/resource/close', {
    method: 'POST', body: JSON.stringify({ claimId, closed, ...who(holder) })
  });

/** Der Gastgeber sagt ja oder nein. */
export const hostDecides = (claimId: string, accept: boolean, holder: Holder) =>
  call<{ status: Status }>('/resource/decide', {
    method: 'POST', body: JSON.stringify({ claimId, accept, ...who(holder) })
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
  perPerson: number;
  minPersons: number;
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

  /** Welcher Termin (0045) — und bis wann der Gastgeber allein einlädt. */
  readonly itemId: string | null;
  readonly occurrenceAt: string | null;
  readonly inviteUntil: string | null;

  /** Von der Kanzlei eingetragen (0049) — und ob mit Link oder nur mit Namen. */
  readonly byOffice?: boolean;
  readonly withLink?: boolean;
}

/** Ein geschlossener Termin (0049) — und wer ihn geschlossen hat. */
export interface ClosedTerm {
  readonly itemId: string;
  readonly occurrenceAt: string;
  readonly closedBy: 'office' | 'host';
}

export const loadClaims = (resourceId: string): Promise<{
  resource: ResourceRow;
  claims: readonly OfficeClaim[];
  closed?: readonly ClosedTerm[];
}> =>
  call(`/workspace/resource/${encodeURIComponent(resourceId)}/claims`);

/**
 * Die Kanzlei trägt jemanden ein (0049) — auch über die Plätze hinaus. Mit
 * `seatId` einen Menschen mit Link, sonst nur einen Namen.
 */
export const officeAdd = (
  resourceId: string, term: { itemId: string; occurrenceAt: string },
  who: { seatId?: string; name?: string }
) =>
  call<{ claimId: string; name: string | null; taken: number; capacity: number; over: boolean }>(
    `/workspace/resource/${encodeURIComponent(resourceId)}/add`, {
      method: 'POST', body: JSON.stringify({ ...term, seatId: who.seatId ?? null, name: who.name ?? null })
    });

/** Die Kanzlei trägt jemanden aus (0049). */
export const officeRemove = (claimId: string) =>
  call<{ removed: boolean }>(`/workspace/claim/${encodeURIComponent(claimId)}/remove`, { method: 'POST' });

/** Die Kanzlei schliesst einen Termin — auch mit freien Plätzen — oder öffnet ihn (0049). */
export const officeClose = (resourceId: string, term: { itemId: string; occurrenceAt: string }, closed: boolean) =>
  call<{ closed: boolean }>(`/workspace/resource/${encodeURIComponent(resourceId)}/close`, {
    method: 'POST', body: JSON.stringify({ ...term, closed })
  });

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
