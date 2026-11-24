/**
 * Die Plätze eines Pfades öffnen (`SeatContext`) — vorher nur in `PublicPage.tsx`; seit 2026-11-25 auch auf der Seite einer
 * Klasse (`ClassPage.tsx`): wer mit dem eigenen Link eines Schülers kommt, lernt als dieser Schüler.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { SeatContext, SeatStateContext, useSeats, useSeatStates, type SeatState } from './seatContext';
import { freshSeat, SEATS_EVENT, seatsFor } from './seatKeep';
import { useSeat } from './seatView';

/**
 * Hält dieser Browser Plätze, die auf diese Seite gehören? Dann gelten sie —
 * ALLE, nicht bloss der zuletzt geöffnete.
 *
 * <b>Ohne Platz ändert sich nichts.</b> `SeatContext` bleibt dann leer, und
 * die persönlichen Bausteine sagen, was hier erscheinen wird.
 *
 * <b>Und es wird nichts geholt, wenn nichts zu holen ist.</b> Wer keinen
 * Platz hält — also fast jeder Besucher — löst keinen einzigen Aufruf aus:
 * welcher Platz zu welcher Seite gehört, steht im Browser neben dem
 * Schlüssel und muss nicht erfragt werden.
 */
export function WithSeat({ path, children }: { path: string; children: ReactNode }) {
  /*
   * EINMAL JE SEITE gelesen. Jeder geöffnete Platz frischt seinen Zeitstempel
   * auf, und die Reihenfolge hängt daran — neu gelesen bei jedem Zeichnen,
   * wanderten die Plätze zwischen den Bauteilen und jeder würde neu geholt.
   */
  /* Ein neuer Link auf DIESELBE Seite bringt einen neuen Platz — also auch nach ihm neu lesen. */
  const arrived = freshSeat()?.token ?? null;
  /* 0095 — und nach einer Person, die sich hier über einen Link vorgestellt hat. */
  const [added, setAdded] = useState(0);
  useEffect(() => {
    const again = () => setAdded((n) => n + 1);
    window.addEventListener(SEATS_EVENT, again);
    return () => window.removeEventListener(SEATS_EVENT, again);
  }, []);
  const tokens = useMemo(() => seatsFor(path), [path, arrived, added]);

  return <OpenAll tokens={tokens}>{children}</OpenAll>;
}

/*
 * JE PLATZ EIN BAUTEIL, ineinander. Ein Haken darf nicht in einer Schleife
 * stehen — React zählt Haken, und eine Liste, die wächst, zählte anders.
 * Verschachtelt hat jedes Bauteil genau einen, und jedes legt seinen Platz
 * zu denen, die es von aussen bekommt.
 */
function OpenAll({ tokens, children }: { tokens: readonly string[]; children: ReactNode }) {
  if (tokens.length === 0) return <>{children}</>;

  return (
    <Opened token={tokens[0]}>
      <OpenAll tokens={tokens.slice(1)}>{children}</OpenAll>
    </Opened>
  );
}

function Opened({ token, children }: { token: string; children: ReactNode }) {
  const { portal, failed, seat, challenge, reload } = useSeat(token, null);
  const outer = useSeats();
  const outerStates = useSeatStates();

  const all = useMemo(() => (seat === null ? outer : [...outer, seat]), [outer, seat]);

  /* Wie es um DIESEN Platz steht — auch wenn er nicht aufging. */
  const state: SeatState['state'] = challenge !== null ? 'verify'
    : portal === undefined ? 'loading'
    : portal === null ? 'gone'
    : seat?.seatKey === null ? 'locked'
    : 'open';
  const states = useMemo(
    () => [...outerStates, { token, state, failed, challenge, reload }],
    [outerStates, token, state, failed, challenge, reload]);

  return (
    <SeatStateContext.Provider value={states}>
      <SeatContext.Provider value={all}>{children}</SeatContext.Provider>
    </SeatStateContext.Provider>
  );
}
