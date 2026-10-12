/**
 * 0102 — „3 NOWE WIADOMOŚCI" an einer zugeklappten Rozmowa auf einer Seite.
 *
 * <b>Wer schaut, dessen Ungelesenes.</b> Auf einer Seite mit Personenauswahl
 * gilt die gewählte: ein Platz (sein Link) liest über `/seat/…/chats`, eine
 * eigene Rolle über die Benachrichtigungen des Kontos. Ohne Auswahl (die
 * Ansicht eines Platzes) alle offenen Plätze dieses Browsers.
 */

import { useSyncExternalStore } from 'react';

import { current, subscribe } from './notify';
import { usePerson } from './pagePerson';
import { useSeats, type SeatView } from './seatContext';
import { newMessages, useSeatChatRows } from './seatUnread';
import { unreadIn, type ChatTargetKind } from './steps';

/** Die Plätze, für die diese Seite gerade spricht — wie die Bausteine der Plätze (`OnSeat`) sie wählen. */
function useShownSeats(): readonly SeatView[] {
  const seats = useSeats();
  const person = usePerson();
  const shown = person === null
    ? seats
    : person.chosen?.kind === 'seat' ? [person.chosen.seat]
    : person.chosen === null ? person.options.flatMap((one) => (one.kind === 'seat' ? [one.seat] : []))
    : [];
  return shown.filter((seat) => seat.seatKey !== null);
}

function Badge({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className="wk-card-peek" data-unread={n}>{newMessages(n)}</span>;
}

/** An „Rozmowa grupy" (alle seine Rozmowy) und „Napisz do nas" (die mit den Prowadzący). */
export function SeatChatPeek({ kind }: { kind: ChatTargetKind }) {
  const seats = useShownSeats();
  const rows = useSeatChatRows(seats.map((seat) => seat.token));
  return <Badge n={rows === undefined ? 0 : unreadIn({ kind, areaId: null }, rows)} />;
}

/** An „Rozmowa" (eine genannte): über einen Platz dieses Browsers oder über das Konto. */
export function PageChatPeek({ chatId }: { chatId: string }) {
  const seats = useShownSeats();
  const rows = useSeatChatRows(chatId === '' ? [] : seats.map((seat) => seat.token));
  const { digest } = useSyncExternalStore(subscribe, current);
  const person = usePerson();
  const asAccount = person?.chosen?.kind !== 'seat';

  const bySeat = rows?.filter((row) => row.chatId === chatId).reduce((sum, row) => sum + (row.unread ?? 0), 0) ?? 0;
  const byAccount = asAccount ? digest?.chats.list.find((one) => one.chatId === chatId)?.unread ?? 0 : 0;
  return <Badge n={Math.max(bySeat, byAccount)} />;
}
