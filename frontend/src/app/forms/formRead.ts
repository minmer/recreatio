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
  asked, loadFields, loadRegistrations, openFields, readAcross, rewrapToOffice, takenOff,
  type IntakeKey, type OpenField, type Submission
} from './form';
import { openDesign, type FormDesign } from './formDesign';
import { loadIntake, loadPublicIntake, openIntakeKey } from './intake';
import type { Ring } from './keys';

export interface ReadForm {
  /** Die Fragen, die das Formular stellt. */
  readonly fields: readonly OpenField[];

  /**
   * 0086 — die vom Formular genommenen: gefragt wird nicht mehr, ihre
   * Antworten stehen aber in `opened` — wer Antworten ZEIGT, nimmt sie dazu.
   */
  readonly removed: readonly OpenField[];
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

/**
 * @param options.range 0077 — nur ein Abschnitt der Zeit einer wiederkehrenden
 *   Erweiterung (ein Jahr, ein Monat): sie hat je Mensch und Zeitraum eine
 *   Einsendung, und alle auf einmal wären nach Jahren tausende.
 * @param options.hidden 0082 — auch die ausgeblendeten (die Liste der Menschen, „Pokaż też ukryte").
 */
export async function readForm(
  partId: string, ring: Ring,
  options: { readonly range?: { readonly from: string; readonly to: string }; readonly hidden?: boolean } = {}
): Promise<ReadForm> {
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
  const { registrations } = await loadRegistrations(partId, options.hidden === true, options.range);
  const opened = new Map<string, ReadonlyMap<string, string>>();
  const pending: { fieldId: string; registrationId: string; officeKeySealed: string }[] = [];

  for (const one of registrations) {
    const read = await readAcross(one, keys, areaOf);
    opened.set(one.registrationId, read.values);
    for (const again of read.toRewrap) pending.push({ ...again, registrationId: one.registrationId });
  }

  /*
   * RSA IST DER UMSCHLAG, NICHT DER TRESOR (0037) — auch hier. Was eben unter
   * dem RSA-Umschlag der Annahme aufging, wird unter dem Schlüssel der
   * Amtsrolle neu versiegelt; das nächste Öffnen kostet dann je Wert kein RSA
   * mehr. Bei einer wiederkehrenden Erweiterung (0077) ist das der Unterschied
   * zwischen einer Liste, die sofort dasteht, und einer, auf die man am
   * Telefon wartet. Still: es ändert nicht, wer lesen darf.
   */
  if (pending.length > 0) void rewrapToOffice(partId, pending).catch(() => undefined);

  return { fields: asked(fields), removed: takenOff(fields), design, registrations, opened, intakes, areaOf };
}
