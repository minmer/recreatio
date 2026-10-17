/**
 * Antworten berichtigen: der Mensch selbst mit seinem Link, das Büro, ein Eintrag des Büros.
 */

import { KEY_SIZE, seal, sealText, toBase64Url, wrapKey } from '../core/crypto';
import { call } from '../core/session';
import { valueAad } from './form';
import type { Answer } from './submissions';

/* -- Berichtigen: der Mensch selbst, mit seinem Link ------------------------ */

/**
 * Die eigene Einsendung ändern — ohne Konto.
 *
 * <b>Dieselben drei Hüllen wie beim ersten Mal</b>, und aus demselben Grund:
 * ein frischer Schlüssel je Wert, der Wert darunter, der Schlüssel einmal für
 * das Amt (unter der öffentlichen Annahmehälfte) und einmal für den Menschen
 * selbst (unter seinem Platzschlüssel). Wer nur eines der beiden schriebe,
 * nähme der einen oder der anderen Seite ihre eigenen Angaben.
 *
 * <b>Ein NEUER Wertschlüssel, nicht der alte.</b> Denselben wiederzuverwenden
 * wäre bequem und hiesse: wer je eine Fassung mitgelesen hat, liest auch jede
 * spätere.
 *
 * Geändert wird nur, was genannt wird — ein Feld, das hier fehlt, bleibt stehen.
 */
export async function reviseSubmission(
  token: string, registrationId: string,
  answers: readonly Answer[],
  keys: { readonly intakePublic: Uint8Array; readonly seatKey: Uint8Array }
): Promise<{ revised: number }> {
  const values = await Promise.all(answers.map(async (one) => {
    const key = crypto.getRandomValues(new Uint8Array(KEY_SIZE));
    const label = valueAad(one.fieldId);

    return {
      fieldId: one.fieldId,
      sealed: toBase64Url(await sealText(key, label, one.value.trim())),
      wrappedKey: toBase64Url(await wrapKey(keys.intakePublic, label, key)),
      seatKeySealed: toBase64Url(await seal(keys.seatKey, label, key))
    };
  }));

  return call(`/seat/${encodeURIComponent(token)}/submission`, {
    method: 'POST',
    body: JSON.stringify({ registrationId, values })
  });
}

/**
 * Eine Einsendung von der KANZLEI aus berichtigen.
 *
 * <b>Derselbe Weg wie beim Menschen selbst</b>, nur mit dem anderen Ausweis:
 * ein frischer Schlüssel je Wert, einmal unter der öffentlichen Annahmehälfte
 * (für das Amt) und einmal unter dem Platzschlüssel (für ihn). Fehlte das
 * zweite, nähme eine Korrektur ihm seine eigene Angabe weg.
 */
export async function reviseAsOffice(
  registrationId: string,
  answers: readonly Answer[],
  keys: { readonly intakePublic: Uint8Array; readonly seatKey: Uint8Array | null }
): Promise<{ revised: number }> {
  const values = await Promise.all(answers.map(async (one) => {
    const key = crypto.getRandomValues(new Uint8Array(KEY_SIZE));
    const label = valueAad(one.fieldId);

    return {
      fieldId: one.fieldId,
      sealed: toBase64Url(await sealText(key, label, one.value.trim())),
      wrappedKey: toBase64Url(await wrapKey(keys.intakePublic, label, key)),
      seatKeySealed: keys.seatKey === null
        ? null
        : toBase64Url(await seal(keys.seatKey, label, key))
    };
  }));

  return call(`/workspace/registration/${encodeURIComponent(registrationId)}/values`, {
    method: 'POST',
    body: JSON.stringify({ values })
  });
}

/**
 * Werte versiegeln — jeder unter der Annahme SEINES Bereichs, und, wenn ein
 * Platz im Spiel ist, ein zweites Mal für ihn.
 */
async function sealEach(
  answers: readonly Answer[],
  keys: {
    readonly intakes: ReadonlyMap<string, Uint8Array>;
    readonly areaOf: ReadonlyMap<string, string>;
    readonly seatKey: Uint8Array | null;
  }
): Promise<object[]> {
  return Promise.all(answers.map(async (one) => {
    const areaId = keys.areaOf.get(one.fieldId);
    const intake = areaId === undefined ? undefined : keys.intakes.get(areaId);
    if (intake === undefined) throw new Error(`Pole ${one.fieldId} nie ma klucza przyjmowania.`);

    const key = crypto.getRandomValues(new Uint8Array(KEY_SIZE));
    const label = valueAad(one.fieldId);

    return {
      fieldId: one.fieldId,
      sealed: toBase64Url(await sealText(key, label, one.value.trim())),
      wrappedKey: toBase64Url(await wrapKey(intake, label, key)),
      seatKeySealed: keys.seatKey === null ? null : toBase64Url(await seal(keys.seatKey, label, key))
    };
  }));
}

/**
 * DIE KANZLEI TRÄGT EIN — zwei Fälle, ein Weg.
 *
 * <b>Eine Erweiterung</b> (0047), für einen Menschen, zu seiner Einsendung
 * (`baseRegistrationId`); bei einer, die nur sie sieht, ohne Hülle für den
 * Platz. Bei einer WIEDERKEHRENDEN (0077) für einen Zeitraum (`round`).
 *
 * <b>Einen Menschen selbst</b> (0077), in ein gewöhnliches Formular —
 * `baseRegistrationId` ist `null`. Wer am Telefon zusagt oder auf einem Zettel
 * steht, kommt so auf die Liste; er hat dann keinen Link (keinen Platz).
 */
export async function addOfficeEntry(
  formId: string, baseRegistrationId: string | null, answers: readonly Answer[],
  keys: {
    readonly intakes: ReadonlyMap<string, Uint8Array>;
    readonly areaOf: ReadonlyMap<string, string>;
    readonly seatKey: Uint8Array | null;
  },
  round = ''
): Promise<{ registrationId: string }> {
  const values = await sealEach(answers.filter((a) => a.value.trim() !== ''), keys);

  return call(`/workspace/part/${encodeURIComponent(formId)}/entry`, {
    method: 'POST',
    body: JSON.stringify({ baseRegistrationId, values, round })
  });
}

/**
 * Berichtigen über MEHRERE Antwortbereiche — jede Antwort unter der Annahme
 * ihres eigenen (`reviseAsOffice` kennt nur einen).
 */
export async function reviseAcrossAsOffice(
  registrationId: string, answers: readonly Answer[],
  keys: {
    readonly intakes: ReadonlyMap<string, Uint8Array>;
    readonly areaOf: ReadonlyMap<string, string>;
    readonly seatKey: Uint8Array | null;
  }
): Promise<{ revised: number }> {
  const values = await sealEach(answers, keys);

  return call(`/workspace/registration/${encodeURIComponent(registrationId)}/values`, {
    method: 'POST',
    body: JSON.stringify({ values })
  });
}
