/**
 * Was ein Baustein weiss, wenn er in einem PORTAL gezeichnet wird.
 *
 * <b>Warum ein Kontext und kein Durchreichen.</b> `PageParts` zeichnet, was in
 * `slug_part` steht, und weiss nichts über Plätze — das ist richtig so: ein
 * Baustein ist dasselbe, gleich wo er hängt (0020). Die persönlichen Bausteine
 * eines Portals brauchen aber die geöffneten Plätze. Sie durch jede Ebene zu
 * reichen hiesse, jeden Baustein etwas tragen zu lassen, was nur drei brauchen.
 *
 * <b>Eine Liste, nicht ein Platz.</b> Wer mehrere Links geöffnet hat, hält
 * mehrere Schlüssel — und eine Seite, die nur einen davon benutzte, zeigte
 * die übrigen Menschen nicht, obwohl ihr Schlüssel im Browser lag.
 *
 * <b>Leer ist der Normalfall.</b> Dieselben Bausteine stehen auf einer
 * öffentlichen Seite im Editor — dort gibt es keinen Platz, und sie sagen das,
 * statt leer zu bleiben.
 */

import { createContext, useContext } from 'react';

import type { OwnAnswer } from './form';
import type { SubmittedValue } from './seat';
import type { SeatChallenge } from './seatCheck';

export interface SeatView {
  readonly token: string;

  /** Die Kennung des Platzes — zum Binden an eine eigene Person. */
  readonly seatId: string;

  /** `null`, wenn der Schlüssel im Link fehlt — dann bleibt alles zu. */
  readonly seatKey: Uint8Array | null;

  readonly recipientName: string | null;

  /** Die Nachricht des Amtes, schon aufgemacht. */
  readonly note: string | null;

  /** Die eigene Einsendung, roh — zum Berichtigen braucht es die Hüllen. */
  readonly submitted: readonly SubmittedValue[];

  /** Dieselbe Einsendung, aufgemacht: Frage und Antwort — je Einsendung und Formular. */
  readonly opened: readonly OwnAnswer[];

  /** Was dieser Platz ausserdem aufschliesst — Termine der Gruppe. */
  readonly shared: readonly { name: string; when: string; what: string | null }[];
  readonly sharedNames: readonly string[];

  readonly expiresAt: string | null;

  /** Nach einer Berichtigung: alles noch einmal holen. */
  readonly reload: () => void;
}

export const SeatContext = createContext<readonly SeatView[]>([]);

/**
 * WIE ES UM JEDEN PLATZ STEHT, den diese Seite aufzumachen versucht — auch um
 * die, die nicht aufgingen.
 *
 * `SeatContext` trägt nur die offenen; eine Seite, auf die gerade ein Link
 * geführt hat, muss aber sagen können, warum ER nicht aufging: zurückgenommen,
 * abgelaufen, oder ein Schlüssel, der beim Kopieren abgeschnitten wurde.
 */
export interface SeatState {
  readonly token: string;
  readonly state: 'loading' | 'open' | 'gone' | 'locked' | 'verify';
  readonly failed: string | null;

  /** Der Link wartet auf seine erste Bestätigung (0046) — die Fragen dazu. */
  readonly challenge: SeatChallenge | null;

  /** Nach der richtigen Antwort: alles noch einmal holen. */
  readonly reload: () => void;
}

export const SeatStateContext = createContext<readonly SeatState[]>([]);

export const useSeatStates = (): readonly SeatState[] => useContext(SeatStateContext);

/** Alle geöffneten Plätze — der für diese Seite zuerst. */
export const useSeats = (): readonly SeatView[] => useContext(SeatContext);

/** Wie ein Platz in einer Liste heisst: der Name, den er trägt, sonst seine Stelle. */
export const seatName = (seat: SeatView, at: number): string =>
  seat.recipientName?.trim() || `Zgłoszenie ${at + 1}`;
