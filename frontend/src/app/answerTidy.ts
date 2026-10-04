/**
 * DIE ANTWORTEN IN IHRER EINEN FORM (0082) — was in einer Antwort anders
 * steht, als es heute gespeichert würde: Telefonnummern (wie bisher in der
 * Kanzlei: „Normalizuj numery") und Adressen (`normalizeAddressLines`, die
 * eine Schreibweise aller Adressen der Datenbank).
 *
 * <b>Eine Stelle für alle, die aufräumen</b>: die Kanzlei eines Formulars
 * (`FormOffice`) und der Durchgang über alle Formulare (`TidyEverything` in
 * der Kartoteka). Die Antworten liegen versiegelt; aufräumen kann nur, wer sie
 * öffnet — und neu versiegelt wird wie bei jeder Berichtigung durch die
 * Kanzlei (`reviseAsOffice`): für das Amt UND für den Menschen selbst.
 */

import { loadAreas, myEpochKeys } from './area';
import type { OpenField, Submission } from './form';
import { reviseAsOffice } from './form';
import { loadIntake, loadPublicIntake, openIntakeKey } from './intake';
import type { Ring } from './keys';
import { tidyPhones } from './phone';
import { normalizeAddressLines } from './postal';
import { loadSeats, officeSeatKey, type SeatRow } from './seat';
import { fromBase64Url } from './crypto';
import { WorkspaceError } from './session';

export type TidyKind = 'phone' | 'address';

/** Eine Antwort, die anders dastünde. `doubt`: nicht ohne Blick übernehmen (der Zerleger war unsicher). */
export interface Crooked {
  readonly registrationId: string;
  readonly fieldId: string;
  readonly kind: TidyKind;
  readonly value: string;
  readonly tidy: string;
  readonly doubt: boolean;
}

/** Was aufgeräumt wird — eine Frage nach ihrer Art: Telefon nach dem Feld, Adresse nach ihrer Rolle. */
export const tidyKindOf = (field: Pick<OpenField, 'kind' | 'identityRole'>): TidyKind | null =>
  field.kind === 'phone' ? 'phone' : field.identityRole === 'address' && field.kind !== 'choice' ? 'address' : null;

/**
 * WAS KRUMM STEHT — gerechnet auf dem, was AUFGEGANGEN ist (eine Hülle, die
 * niemand öffnen kann, lässt sich auch nicht geraderücken). `register`: die
 * Teile der Adressen kommen ins gemeinsame Verzeichnis (nur angemeldet).
 */
export async function crookedOf(form: {
  readonly fields: readonly Pick<OpenField, 'fieldId' | 'kind' | 'identityRole'>[];
  readonly registrations: readonly Pick<Submission, 'registrationId'>[];
  readonly opened: ReadonlyMap<string, ReadonlyMap<string, string>>;
}, register = false): Promise<Crooked[]> {
  const out: Crooked[] = [];
  const addresses: { registrationId: string; fieldId: string; value: string }[] = [];

  for (const s of form.registrations) {
    const values = form.opened.get(s.registrationId);
    if (values === undefined) continue;
    for (const f of form.fields) {
      const kind = tidyKindOf(f);
      const raw = values.get(f.fieldId);
      if (kind === null || raw === undefined || raw.trim() === '') continue;
      if (kind === 'phone') {
        const tidy = tidyPhones(raw);
        if (tidy !== raw) out.push({ registrationId: s.registrationId, fieldId: f.fieldId, kind, value: raw, tidy, doubt: false });
      } else {
        addresses.push({ registrationId: s.registrationId, fieldId: f.fieldId, value: raw });
      }
    }
  }

  const tidied = await normalizeAddressLines(addresses.map((a) => a.value), register);
  addresses.forEach((a, i) => {
    const t = tidied[i];
    if (t.tidy !== a.value) out.push({ ...a, kind: 'address', tidy: t.tidy, doubt: t.doubt });
  });

  return out;
}

/**
 * DER PLATZSCHLÜSSEL ZU EINEM PLATZ — aus der Liste der Plätze meiner
 * Bereiche, einmal geholt. Ohne ihn nähme eine Korrektur dem Menschen seine
 * eigene Angabe weg: in seinem Portal stünde danach nichts mehr.
 */
export function seatKeyFinder(ring: Ring): (seatId: string) => Promise<{ key: Uint8Array; under: string | null }> {
  let rows: Promise<{ row: SeatRow; areaId: string; epoch: number }[]> | null = null;
  const all = () => rows ??= (async () => {
    const found: { row: SeatRow; areaId: string; epoch: number }[] = [];
    for (const area of (await loadAreas()).areas) {
      const { seats } = await loadSeats(area.areaId).catch(() => ({ seats: [] as readonly SeatRow[] }));
      for (const row of seats) found.push({ row, areaId: area.areaId, epoch: area.currentEpoch });
    }
    return found;
  })();

  return async (seatId) => {
    const hit = (await all()).find((one) => one.row.seatId === seatId);
    if (hit === undefined) throw new WorkspaceError('Tego miejsca nie ma wśród Twoich obszarów.');
    const areaKey = (await myEpochKeys(ring, hit.areaId)).get(hit.epoch);
    const intake = hit.row.origin === 'self' ? await openIntakeKey(await loadIntake(hit.areaId), ring) : undefined;
    const key = await officeSeatKey(hit.row, areaKey ?? new Uint8Array(32), intake);
    if (key === null) throw new WorkspaceError('Do tego miejsca nie ma klucza.');
    return { key, under: hit.row.under };
  };
}

/**
 * RÄUMT AUF, was ausgewählt ist — je Einsendung UND Bereich: ein Wert wird
 * unter der Annahme SEINES Bereichs neu verpackt. Gibt zurück, wie viele
 * Werte und Menschen es waren.
 */
export async function straighten(ring: Ring, form: {
  readonly registrations: readonly Pick<Submission, 'registrationId' | 'seatId'>[];
  readonly areaOf: ReadonlyMap<string, string>;
}, chosen: readonly Crooked[], seats = seatKeyFinder(ring)): Promise<{ values: number; people: number }> {
  const groups = new Map<string, { registrationId: string; areaId: string; answers: { fieldId: string; value: string }[] }>();
  for (const one of chosen) {
    const areaId = form.areaOf.get(one.fieldId);
    if (areaId === undefined) continue;
    const slot = `${one.registrationId}|${areaId}`;
    const entry = groups.get(slot) ?? { registrationId: one.registrationId, areaId, answers: [] };
    entry.answers.push({ fieldId: one.fieldId, value: one.tidy });
    groups.set(slot, entry);
  }

  const intakes = new Map<string, Uint8Array>();
  let values = 0;
  for (const { registrationId, areaId, answers } of groups.values()) {
    const seatId = form.registrations.find((s) => s.registrationId === registrationId)?.seatId ?? null;
    const seatKey = seatId === null ? null : await seats(seatId).then((r) => r.key).catch(() => null);
    if (!intakes.has(areaId)) intakes.set(areaId, fromBase64Url((await loadPublicIntake(areaId)).publicKey));
    await reviseAsOffice(registrationId, answers, { intakePublic: intakes.get(areaId)!, seatKey });
    values += answers.length;
  }

  return { values, people: new Set(chosen.map((one) => one.registrationId)).size };
}
