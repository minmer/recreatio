/**
 * IMIĘ I NAZWISKO AN DEN PLATZ — versiegelt (0097).
 *
 * Die Kanzlei öffnet die Einsendungen, und der volle Name aus den Antworten
 * kommt an den Platz: unter dem Schlüssel seines Bereichs (für die Kanzlei)
 * und unter dem Platzschlüssel (seine eigene Kopie — in einem jawny Bereich
 * die einzige, an die die Kanzlei über die Annahme kommt). Der Dienst sieht
 * keinen Namen; er nimmt nur die Hüllen (`/workspace/seats/names`).
 */

import { loadIntake, openIntakeKey } from '../forms/intake';
import type { Ring } from '../core/keys';
import { nameKey, nameText, openSeatName, openWith, sealName, seatNameAad, seatOwnNameAad, writeKey } from '../core/names';
import { call } from '../core/session';
import { loadSeats, officeSeatKey, type SeatRow } from './seat';

/** Ein Schlüssel je Bereich — einmal geholt, oder `null`. */
function keyed<T>(get: (areaId: string) => Promise<T>): (areaId: string) => Promise<T | null> {
  const found = new Map<string, Promise<T | null>>();
  return (areaId) => {
    let one = found.get(areaId);
    if (one === undefined) {
      one = get(areaId).catch(() => null);
      found.set(areaId, one);
    }
    return one;
  };
}

/** Ein Name, versiegelt und gleich wieder geöffnet — was nicht wieder aufgeht, geht nicht hinaus. */
async function sealChecked(key: Uint8Array, a: Parameters<typeof sealName>[1], text: string): Promise<string | null> {
  const sealed = await sealName(key, a, text);
  return (await openWith(key, a, sealed)) === text.trim() ? sealed : null;
}

/**
 * DER PLATZSCHLÜSSEL, wie die Kanzlei an ihn kommt: über die Annahme (wer
 * sich selbst angemeldet hat) oder über den Bereich (von der Kanzlei, aus einem Link).
 */
function seatKeys(ring: Ring) {
  const intake = keyed(async (areaId) => openIntakeKey(await loadIntake(areaId), ring));
  return async (seat: Pick<SeatRow, 'seatId' | 'origin' | 'seatKeyForArea' | 'seatKeyForIntake' | 'epoch'> & { areaId: string }): Promise<Uint8Array | null> => {
    if (seat.origin === 'self') {
      const intakePrivate = await intake(seat.areaId);
      return intakePrivate === null ? null : officeSeatKey(seat, new Uint8Array(0), intakePrivate).catch(() => null);
    }
    const areaKey = await nameKey(seat.areaId, seat.epoch).catch(() => undefined);
    return areaKey === undefined ? null : officeSeatKey(seat, areaKey).catch(() => null);
  };
}

/**
 * Aus den Antworten, die die Kanzlei gerade geöffnet hat. Nur ERGÄNZT, nie
 * überschrieben: ein leerer Name, oder einer, der im neuen steckt
 * („Węglowski" → „Jan Węglowski"); einen von Hand gesetzten lässt es stehen.
 */
export async function sealSeatNames(
  want: readonly { readonly seatId: string; readonly name: string }[], ring: Ring, areas: readonly string[]
): Promise<number> {
  if (want.length === 0) return 0;

  const rows = new Map<string, SeatRow & { areaId: string }>();
  for (const areaId of areas) {
    for (const row of (await loadSeats(areaId).catch(() => ({ seats: [] as SeatRow[] }))).seats) rows.set(row.seatId, { ...row, areaId });
  }

  const personKey = keyed((areaId) => writeKey(areaId, { ring, person: true }));
  const seatKeyOf = seatKeys(ring);
  const out: { seatId: string; nameSealed?: string; nameEpoch?: number; ownNameSealed?: string }[] = [];

  for (const one of want) {
    const row = rows.get(one.seatId);
    const name = nameText(one.name);
    if (row === undefined || name === '') continue;

    const now = (await openSeatName(row))?.trim() ?? '';
    /* Ergänzt, nie ersetzt — und derselbe Name, wenn die Kopie für die Kanzlei noch fehlt (er hat sich selbst angemeldet, ohne Bereichsschlüssel). */
    const better = now === '' || (name.length > now.length && name.includes(now)) || (now === name && row.nameSealed == null);
    if (!better) continue;

    const key = await personKey(row.areaId);
    const sealed = key === null ? null : await sealChecked(key.key, seatNameAad(row.seatId), name);
    const own = await seatKeyOf(row);
    const ownSealed = own === null ? null : await sealChecked(own, seatOwnNameAad(row.seatId), name);
    if (sealed !== null && key !== null) out.push({ seatId: row.seatId, nameSealed: sealed, nameEpoch: key.epoch, ...(ownSealed === null ? {} : { ownNameSealed: ownSealed }) });
    /* Ein jawny Bereich: nur die eigene Kopie (die Kanzlei öffnet sie über den Platzschlüssel). */
    else if (ownSealed !== null) out.push({ seatId: row.seatId, ownNameSealed: ownSealed });
  }

  if (out.length === 0) return 0;
  const { updated } = await call<{ updated: number }>('/workspace/seats/names', {
    method: 'POST', body: JSON.stringify({ names: out })
  });
  return updated;
}
