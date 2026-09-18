/**
 * Termine, die man sich nehmen kann — die Browserseite (0029).
 *
 * <b>Kein zweiter Kalender.</b> Ein Termin ist ein Kalendereintrag; buchbar ist
 * ein VORKOMMEN davon. Was hier dazukommt, ist allein die Frage, ob man sich
 * daraufsetzen darf und wer schon daraufsitzt.
 *
 * <b>Der Dienst entscheidet, nicht diese Datei.</b> `state` kommt fertig
 * heraus — die Regel steht in `Slot.Judge` und dort genau einmal. Sie hier noch
 * einmal zu rechnen hiesse, zwei Meinungen darüber zu haben, wer mitdarf; und
 * die im Browser wäre die, der man nicht trauen darf.
 */

import { call } from './session';

/**
 * Was dieser Mensch mit diesem Termin tun kann.
 *
 * <code>
 *   open           frei — nimm ihn
 *   invite-needed  jemand hält ihn; es braucht seinen Code oder sein Ja
 *   locked         das Fenster ist zu und es sitzen schon zwei darauf
 *   full           voll
 *   mine           er gehört schon dir
 * </code>
 */
export type SlotState = 'open' | 'inviteneeded' | 'locked' | 'full' | 'mine';

export interface PublicSlot {
  readonly itemId: string;
  readonly occurrenceAt: string;
  readonly minutes: number;
  readonly titlePublic: string | null;
  readonly capacity: number;
  readonly taken: number;
  readonly mine: boolean;
  readonly state: SlotState;

  /** Ob überhaupt noch jemand einladen darf — nicht, WER. */
  readonly inviteOpen: boolean;

  /** Ob ICH der Gastgeber bin; nur dann gibt es etwas zu entscheiden. */
  readonly iAmHost: boolean;
}

export const loadSlots = (
  calendarId: string, seat?: string
): Promise<{ slots: readonly PublicSlot[] }> =>
  call(`/slots?calendar=${encodeURIComponent(calendarId)}`
    + (seat === undefined ? '' : `&seat=${encodeURIComponent(seat)}`));

/**
 * Sich einen Termin nehmen.
 *
 * <b>Der Code kommt genau einmal zurück</b> — und nur, wenn dieser Mensch der
 * Erste war. Gespeichert ist beim Dienst nur sein Abdruck; wer ihn verliert,
 * gibt den Termin zurück und nimmt ihn neu.
 */
export const bookSlot = (
  itemId: string, occurrenceAt: string, seat: string, code?: string
): Promise<{ booked: boolean; inviteCode: string | null; inviteUntil: string | null }> =>
  call('/slots/book', {
    method: 'POST',
    body: JSON.stringify({ itemId, occurrenceAt, seat, code: code ?? null })
  });

export const releaseSlot = (
  itemId: string, occurrenceAt: string, seat: string
): Promise<{ released: boolean }> =>
  call('/slots/release', {
    method: 'POST',
    body: JSON.stringify({ itemId, occurrenceAt, seat })
  });

/** Den Gastgeber um Mitnahme bitten — der Weg ohne Code. */
export const askSlot = (
  itemId: string, occurrenceAt: string, seat: string
): Promise<{ asked: boolean }> =>
  call('/slots/ask', {
    method: 'POST',
    body: JSON.stringify({ itemId, occurrenceAt, seat })
  });

export const decideSlot = (
  requestId: string, accept: boolean, seat: string
): Promise<{ accepted: boolean }> =>
  call('/slots/decide', {
    method: 'POST',
    body: JSON.stringify({ requestId, accept, seat })
  });

/* -- Die Kanzlei ----------------------------------------------------------- */

export interface OfficeSlot {
  readonly itemId: string;
  readonly occurrenceAt: string;
  readonly minutes: number;
  readonly titlePublic: string | null;
  readonly capacity: number;
  readonly taken: number;

  /** Die Namen, die die Kanzlei selbst vergeben hat — nichts Versiegeltes. */
  readonly who: readonly string[];
  readonly inviteUntil: string | null;
}

export const loadOfficeSlots = (calendarId: string): Promise<{ slots: readonly OfficeSlot[] }> =>
  call(`/workspace/calendar/${encodeURIComponent(calendarId)}/slots`);

/**
 * Ein Vorkommen zur Buchung freigeben — der „Vorschlag".
 *
 * Je VORKOMMEN und nicht je Eintrag: „samstags 10:00" ist eine Reihe,
 * angeboten wird der 14. November.
 */
export const openSlot = (
  itemId: string, occurrenceAt: string, capacity: number
): Promise<{ capacity: number }> =>
  call(`/workspace/item/${encodeURIComponent(itemId)}/slot`, {
    method: 'POST',
    body: JSON.stringify({ occurrenceAt, capacity })
  });

export const closeSlot = (
  itemId: string, occurrenceAt: string
): Promise<{ closed: boolean }> =>
  call(`/workspace/item/${encodeURIComponent(itemId)}/slot/close`, {
    method: 'POST',
    body: JSON.stringify({ occurrenceAt })
  });
