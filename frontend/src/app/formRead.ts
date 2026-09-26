/**
 * EIN FORMULAR AUS SICHT DER KANZLEI LESEN — Fragen, Einsendungen, Antworten.
 *
 * <b>Es stand nur in `FormOffice`</b>, verwoben mit seinen Reitern. Für die
 * Erweiterungen (0047) braucht es denselben Weg an zwei weiteren Stellen: beim
 * Koordinator, der je Kandidat seine Notizen einträgt, und in der Zeile eines
 * Menschen, wo stehen soll, was er ergänzt hat. Hier steht es einmal, ohne
 * Zustand und ohne Oberfläche.
 *
 * <b>Jeder Schritt für sich</b> — ein Bereich, der seinen Schlüssel nicht
 * hergibt, lässt nur seine eigenen Fragen und Antworten zu.
 */

import { loadPublicKey, myEpochKeys } from './area';
import { fromBase64Url } from './crypto';
import {
  loadFields, loadRegistrations, openFields, readAcross,
  type IntakeKey, type OpenField, type Submission
} from './form';
import { openDesign, type FormDesign } from './formDesign';
import { loadIntake, loadPublicIntake, openIntakeKey } from './intake';
import type { Ring } from './keys';

export interface ReadForm {
  readonly fields: readonly OpenField[];
  readonly design: FormDesign | null;
  readonly registrations: readonly Submission[];

  /** Je Einsendung: Frage → Antwort, soweit sie aufging. */
  readonly opened: ReadonlyMap<string, ReadonlyMap<string, string>>;

  /** Zum Schreiben: die öffentliche Annahmehälfte je Antwortbereich, und wohin jede Frage schreibt. */
  readonly intakes: ReadonlyMap<string, Uint8Array>;
  readonly areaOf: ReadonlyMap<string, string>;
}

/** Ein Epochenschlüssel — aus der Zuteilung, sonst der veröffentlichte, wenn die Epoche stimmt. */
async function epochKey(ring: Ring, areaId: string, epoch: number): Promise<Uint8Array | undefined> {
  try {
    const held = (await myEpochKeys(ring, areaId)).get(epoch);
    if (held !== undefined) return held;
  } catch {
    // Keine Zuteilung — dann vielleicht offen.
  }

  try {
    const open = await loadPublicKey(areaId);
    if (open.epoch === epoch) return fromBase64Url(open.key);
  } catch {
    // Nicht offengelegt.
  }

  return undefined;
}

export async function readForm(partId: string, ring: Ring): Promise<ReadForm> {
  const { fields: sealed, design: shut } = await loadFields(partId);

  /* Die Fragen — unter dem Schlüssel des Formulars (0042). */
  const labelKeys = new Map<string, Uint8Array>();
  for (const f of sealed) {
    const areaId = f.labelAreaId ?? f.areaId;
    if (labelKeys.has(areaId)) continue;

    const key = await epochKey(ring, areaId, f.labelEpoch ?? f.epoch);
    if (key !== undefined) labelKeys.set(areaId, key);
  }

  const fields = await openFields(sealed, labelKeys);
  const design = shut === null ? null
    : await openDesign(shut, await epochKey(ring, shut.areaId, shut.epoch), partId);

  /* Die Antworten — unter der Annahme ihres Bereichs, geöffnet mit dem Schlüssel des Amtes. */
  const keys: IntakeKey[] = [];
  const intakes = new Map<string, Uint8Array>();

  for (const areaId of new Set(sealed.map((f) => f.areaId))) {
    try {
      intakes.set(areaId, fromBase64Url((await loadPublicIntake(areaId)).publicKey));
    } catch {
      // Keine Annahme — dorthin lässt sich nichts schreiben.
    }

    try {
      const intake = await loadIntake(areaId);
      keys.push({
        areaId,
        privateKey: await openIntakeKey(intake, ring),
        officeKey: ring.has(intake.sealedForRoleId) ? ring.keyOf(intake.sealedForRoleId) : undefined
      });
    } catch {
      // Diesen Bereich liest dieser Browser nicht.
    }
  }

  const areaOf = new Map(sealed.map((f) => [f.fieldId, f.areaId]));
  const { registrations } = await loadRegistrations(partId, false);
  const opened = new Map<string, ReadonlyMap<string, string>>();

  for (const one of registrations) {
    opened.set(one.registrationId, (await readAcross(one, keys, areaOf)).values);
  }

  return { fields, design, registrations, opened, intakes, areaOf };
}
