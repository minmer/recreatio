/**
 * Was ein Baustein weiss, wenn er in einem PORTAL gezeichnet wird.
 *
 * <b>Warum ein Kontext und kein Durchreichen.</b> `PageParts` zeichnet, was in
 * `slug_part` steht, und weiss nichts über Plätze — das ist richtig so: ein
 * Baustein ist dasselbe, gleich wo er hängt (0020). Die persönlichen Bausteine
 * eines Portals brauchen aber den geöffneten Platz. Ihn durch jede Ebene zu
 * reichen hiesse, jeden Baustein etwas tragen zu lassen, was nur drei brauchen.
 *
 * <b>`null` ist der Normalfall.</b> Dieselben Bausteine stehen auf einer
 * öffentlichen Seite im Editor — dort gibt es keinen Platz, und sie sagen das,
 * statt leer zu bleiben.
 */

import { createContext, useContext } from 'react';

import type { SubmittedValue } from './seat';

export interface SeatView {
  readonly token: string;

  /** `null`, wenn der Schlüssel im Link fehlt — dann bleibt alles zu. */
  readonly seatKey: Uint8Array | null;

  readonly recipientName: string | null;

  /** Die Nachricht des Amtes, schon aufgemacht. */
  readonly note: string | null;

  /** Die eigene Einsendung, roh — zum Berichtigen braucht es die Hüllen. */
  readonly submitted: readonly SubmittedValue[];

  /** Dieselbe Einsendung, aufgemacht: Frage und Antwort. */
  readonly opened: readonly { fieldId: string; label: string | null; value: string | null }[];

  /** Was dieser Platz ausserdem aufschliesst — Termine der Gruppe. */
  readonly shared: readonly { name: string; when: string; what: string | null }[];
  readonly sharedNames: readonly string[];

  readonly expiresAt: string | null;

  /** Nach einer Berichtigung: alles noch einmal holen. */
  readonly reload: () => void;
}

export const SeatContext = createContext<SeatView | null>(null);

export const useSeat = (): SeatView | null => useContext(SeatContext);
