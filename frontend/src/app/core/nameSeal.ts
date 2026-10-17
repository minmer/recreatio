/**
 * WAS NOCH OFFEN DASTEHT, VERSIEGELN (0097).
 *
 * Der Dienst kann einen alten, offenen Namen nicht versiegeln — er hat keinen
 * Schlüssel. Das tut der Browser dessen, der ihn hat: er holt, was dieses
 * Konto versiegeln darf (`/workspace/names/unsealed` — Formulare und Plätze und
 * Termine in Bereichen, in denen es schreibt), versiegelt jeden Namen unter dem
 * Schlüssel seines Bereichs, prüft, dass er wieder aufgeht, und schickt die
 * Hüllen. In derselben Anweisung löscht der Dienst den Klartext.
 *
 * <b>Ein Platz bekommt dabei auch seine eigene Kopie</b> (unter dem
 * Platzschlüssel), wo der Browser ihn öffnen kann (Annahme oder Bereich) —
 * sonst sähe der Mensch in seinem Portal seinen Namen nicht mehr.
 *
 * <b>Dieselbe Stelle für die Namen aus den Antworten</b> (`sealSeatNames`):
 * die Kanzlei öffnet die Einsendungen, und der volle Name kommt an den Platz —
 * versiegelt.
 */

import { loadIntake, openIntakeKey } from './intake';
import type { Ring } from './keys';
import {
  claimHolderAad, moduleNameAad, nameKey, nameText, openSeatName, openWith, sealName, seatNameAad, seatOwnNameAad, writeKey
} from './names';
import { loadSeats, officeSeatKey, type SeatRow } from './seat';
import { call } from './session';

interface Unsealed {
  readonly forms: readonly { moduleId: string; areaId: string; name: string }[];
  readonly seats: readonly {
    seatId: string; areaId: string; name: string; epoch: number;
    seatKeyForArea: string | null; seatKeyForIntake: string | null; origin: string; hasOwn: boolean;
  }[];
  readonly claims: readonly { claimId: string; areaId: string; name: string }[];
}

interface SealOut {
  forms: { moduleId: string; nameSealed: string; nameEpoch: number }[];
  seats: { seatId: string; nameSealed?: string; nameEpoch?: number; ownNameSealed?: string }[];
  claims: { claimId: string; nameSealed: string; nameEpoch: number }[];
}

export interface Sealed {
  readonly forms: number;
  readonly seats: number;
  readonly claims: number;
  /** Was offen blieb: kein Schlüssel in diesem Browser, ein jawny Bereich, eine Hülle, die nicht aufging. */
  readonly left: number;
}

/** Was dieses Konto noch versiegeln kann — nur die Zahlen. */
export async function unsealedCount(): Promise<number> {
  const got = await call<Unsealed>('/workspace/names/unsealed');
  return got.forms.length + got.seats.length + got.claims.length;
}

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

async function send(out: SealOut): Promise<{ forms: number; seats: number; claims: number; skipped: number }> {
  let forms = 0, seats = 0, claims = 0, skipped = 0;
  const CHUNK = 200;
  const all = [
    ...out.forms.map((f) => ({ forms: [f] })), ...out.seats.map((s) => ({ seats: [s] })), ...out.claims.map((c) => ({ claims: [c] }))
  ];
  for (let at = 0; at < all.length; at += CHUNK) {
    const part = all.slice(at, at + CHUNK);
    const body = {
      forms: part.flatMap((p) => ('forms' in p ? p.forms : [])),
      seats: part.flatMap((p) => ('seats' in p ? p.seats : [])),
      claims: part.flatMap((p) => ('claims' in p ? p.claims : []))
    };
    const done = await call<{ forms: number; seats: number; claims: number; skipped: number }>('/workspace/names/seal', {
      method: 'POST', body: JSON.stringify(body)
    });
    forms += done.forms; seats += done.seats; claims += done.claims; skipped += done.skipped;
  }
  return { forms, seats, claims, skipped };
}

/**
 * ALLES, WAS DIESES KONTO VERSIEGELN KANN — versiegeln. Still und ohne
 * Abbruch: was nicht geht (kein Schlüssel hier, ein jawny Bereich), bleibt
 * offen und wird gezählt; beim nächsten Mal wieder.
 */
export async function sealLegacyNames(ring: Ring): Promise<Sealed> {
  const got = await call<Unsealed>('/workspace/names/unsealed');
  const total = got.forms.length + got.seats.length + got.claims.length;
  if (total === 0) return { forms: 0, seats: 0, claims: 0, left: 0 };

  const formKey = keyed((areaId) => writeKey(areaId, { ring }));
  const personKey = keyed((areaId) => writeKey(areaId, { ring, person: true }));
  const seatKeyOf = seatKeys(ring);
  const out: SealOut = { forms: [], seats: [], claims: [] };

  for (const form of got.forms) {
    const key = await formKey(form.areaId);
    const name = nameText(form.name);
    const sealed = key === null || name === '' ? null : await sealChecked(key.key, moduleNameAad(form.moduleId), name);
    if (key !== null && sealed !== null) out.forms.push({ moduleId: form.moduleId, nameSealed: sealed, nameEpoch: key.epoch });
  }

  for (const seat of got.seats) {
    const name = nameText(seat.name);
    if (name === '') continue;
    const key = await personKey(seat.areaId);
    const sealed = key === null ? null : await sealChecked(key.key, seatNameAad(seat.seatId), name);
    /* Die eigene Kopie — in einem jawny Bereich (kein Name unter einem offenen Schlüssel) die einzige, an die die Kanzlei über die Annahme kommt. */
    const own = seat.hasOwn && sealed !== null ? null : await seatKeyOf({ ...seat, origin: seat.origin as SeatRow['origin'] });
    const ownSealed = own === null ? null : await sealChecked(own, seatOwnNameAad(seat.seatId), name);
    if (sealed !== null && key !== null) {
      out.seats.push({ seatId: seat.seatId, nameSealed: sealed, nameEpoch: key.epoch, ...(ownSealed === null ? {} : { ownNameSealed: ownSealed }) });
    } else if (ownSealed !== null) {
      out.seats.push({ seatId: seat.seatId, ownNameSealed: ownSealed });
    }
  }

  for (const claim of got.claims) {
    const key = await personKey(claim.areaId);
    const name = nameText(claim.name);
    const sealed = key === null || name === '' ? null : await sealChecked(key.key, claimHolderAad(claim.claimId), name);
    if (key !== null && sealed !== null) out.claims.push({ claimId: claim.claimId, nameSealed: sealed, nameEpoch: key.epoch });
  }

  const done = await send(out);
  return { forms: done.forms, seats: done.seats, claims: done.claims, left: total - done.forms - done.seats - done.claims };
}

/* -- Einmal je Sitzung, still -------------------------------------------------------------------------- */

const tried = new Map<string, number>();

/** Beim Öffnen des Warsztat: höchstens alle zehn Minuten einmal, und nur, wenn etwas offen dasteht. */
export async function sealLegacyNamesQuietly(accountId: string, ring: Ring): Promise<Sealed | null> {
  if (Date.now() - (tried.get(accountId) ?? 0) < 10 * 60_000) return null;
  tried.set(accountId, Date.now());
  return sealLegacyNames(ring).catch(() => null);
}

/* -- Der volle Name aus den Antworten ---------------------------------------------------------------------- */

/**
 * IMIĘ I NAZWISKO AN DEN PLATZ — aus den Antworten, die die Kanzlei gerade
 * geöffnet hat. Nur ERGÄNZT, nie überschrieben: ein leerer Name, oder einer,
 * der im neuen steckt („Węglowski" → „Jan Węglowski"); einen von Hand gesetzten
 * lässt es stehen. Das entscheidet hier der Browser — der Dienst sieht keinen
 * Namen mehr.
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
  const out: SealOut = { forms: [], seats: [], claims: [] };

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
    if (sealed !== null && key !== null) out.seats.push({ seatId: row.seatId, nameSealed: sealed, nameEpoch: key.epoch, ...(ownSealed === null ? {} : { ownNameSealed: ownSealed }) });
    /* Ein jawny Bereich: nur die eigene Kopie (die Kanzlei öffnet sie über den Platzschlüssel). */
    else if (ownSealed !== null) out.seats.push({ seatId: row.seatId, ownNameSealed: ownSealed });
  }

  if (out.seats.length === 0) return 0;
  const { updated } = await call<{ updated: number }>('/workspace/seats/names', {
    method: 'POST', body: JSON.stringify({ names: out.seats })
  });
  return updated;
}
