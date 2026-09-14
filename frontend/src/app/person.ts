/**
 * Die Angaben eines Menschen — und wie EINE davon herausgeht.
 *
 * <b>Das Einzige auf dieser Plattform, was einem MENSCHEN gehört und keinem
 * Bereich.</b> Sie liegen an seiner Rolle, einzeln versiegelt unter seinem
 * Rollenschlüssel. Keine Pfarrei, keine Schule und kein Verein besitzt sie.
 *
 * <b>Freigeben heisst: neu versiegeln, unter dem Schlüssel des Empfängers.</b>
 * Nicht verweisen — ein Verweis hiesse, dass der Bereich beim Lesen an den
 * Schlüssel des Menschen müsste, und dann wäre die Freigabe ein Versprechen
 * statt einer Massnahme.
 *
 * <b>Jedes Feld ein eigenes Etikett.</b> Trügen zwei dasselbe, ginge der
 * Geheimtext der Telefonnummer am Platz des Geburtstags auf — und eine Freigabe
 * wäre nicht mehr die Freigabe EINER Angabe.
 */

import { aad, Field, fromBase64Url, openText, sealText, toBase64Url, type FieldName } from './crypto';
import type { Ring } from './keys';
import { call } from './session';

/** Dieselben sechs wie `ck_person_value_field` und `Person.Fields`. */
export const PERSON_FIELDS = ['given_name', 'surname', 'phone', 'born', 'address', 'email'] as const;
export type PersonField = (typeof PERSON_FIELDS)[number];

export const FIELD_LABEL: Record<PersonField, string> = {
  given_name: 'Imię',
  surname: 'Nazwisko',
  phone: 'Telefon',
  born: 'Data urodzenia',
  address: 'Adres',
  email: 'E-mail'
};

/**
 * Die Zuordnung Spaltenname → Etikett.
 *
 * Zwei Namensordnungen für dieselbe Angabe: `app.person_value.field` heisst
 * `given_name`, das Etikett im Kernel heisst auch so — aber `phone` heisst dort
 * `person_phone`. Diese Tabelle ist die einzige Stelle, an der beide
 * zusammenkommen; sie zu umgehen hiesse, sie an einer zweiten Stelle zu raten.
 */
const LABELS: Record<PersonField, FieldName> = {
  given_name: Field.PersonGivenName,
  surname: Field.PersonSurname,
  phone: Field.PersonPhone,
  born: Field.PersonBorn,
  address: Field.PersonAddress,
  email: Field.PersonEmail
};

/*
 * Das ORIGINAL und die ABSCHRIFT tragen verschiedene Objektarten.
 *
 * Sonst liesse sich eine freigegebene Abschrift an den Platz des Originals
 * schieben: beide nennen dieselbe Rolle und dasselbe Feld, und die Hülle ginge
 * auf. Ein Wort Unterschied schliesst das aus.
 */
export const valueAad = (roleId: string, field: PersonField) =>
  aad('person', 'value', roleId, LABELS[field], 1);

export const releaseAad = (roleId: string, field: PersonField) =>
  aad('person', 'release', roleId, LABELS[field], 1);

/* -- Lesen ------------------------------------------------------------------ */

export interface SealedValue {
  readonly field: PersonField;
  readonly sealed: string;
  readonly updatedAt: string;
}

export interface Release {
  readonly field: PersonField;
  readonly areaId: string;
  readonly areaName: string;
  readonly epoch: number;
  readonly releasedAt: string;
}

export interface Mine {
  readonly roleId: string;
  readonly values: readonly SealedValue[];
  readonly releases: readonly Release[];
}

export const loadPerson = (roleId: string): Promise<Mine> =>
  call(`/workspace/person/${encodeURIComponent(roleId)}/values`);

/**
 * Die eigenen Angaben aufmachen.
 *
 * Eine Hülle, die nicht aufgeht, wird übergangen: ein beschädigtes Feld darf
 * nicht die übrigen verstecken.
 */
export async function openMine(
  roleId: string, ring: Ring, values: readonly SealedValue[]
): Promise<Map<PersonField, string>> {
  const key = ring.keyOf(roleId);
  const out = new Map<PersonField, string>();

  for (const one of values) {
    try {
      out.set(one.field, await openText(key, valueAad(roleId, one.field), fromBase64Url(one.sealed)));
    } catch {
      // Nicht lesbar — aber die anderen schon.
    }
  }

  return out;
}

/* -- Schreiben -------------------------------------------------------------- */

export async function setValue(
  roleId: string, ring: Ring, field: PersonField, value: string
): Promise<void> {
  const sealed = await sealText(ring.keyOf(roleId), valueAad(roleId, field), value.trim());

  await call(`/workspace/person/${encodeURIComponent(roleId)}/value`, {
    method: 'POST',
    body: JSON.stringify({ field, sealed: toBase64Url(sealed) })
  });
}

/** Löschen — mitsamt allen Freigaben, denn sie hängen daran. */
export const forgetValue = (
  roleId: string, field: PersonField
): Promise<{ forgotten: boolean; withdrawn: number }> =>
  call(`/workspace/person/${encodeURIComponent(roleId)}/forget`, {
    method: 'POST',
    body: JSON.stringify({ field })
  });

/* -- Freigeben -------------------------------------------------------------- */

/**
 * EINE Angabe an EINEN Bereich.
 *
 * Der Wert wird hier neu versiegelt — unter dem Epochenschlüssel des
 * Empfängers. Wer eine Telefonnummer bekommen soll, bekommt genau die und nicht
 * den Geburtstag dazu.
 */
export async function releaseValue(
  roleId: string, field: PersonField, value: string,
  to: { areaId: string; areaKey: Uint8Array; epoch: number }
): Promise<void> {
  const sealed = await sealText(to.areaKey, releaseAad(roleId, field), value.trim());

  await call(`/workspace/person/${encodeURIComponent(roleId)}/release`, {
    method: 'POST',
    body: JSON.stringify({
      field, areaId: to.areaId, epoch: to.epoch, sealed: toBase64Url(sealed)
    })
  });
}

/**
 * Zurücknehmen.
 *
 * Die Zeile fällt. Was jemand gelesen hat, hat er gelesen — der Dienst sagt das
 * selbst mit, und die Oberfläche gibt es weiter, statt mehr zu versprechen, als
 * die Sache hergibt.
 */
export const withdrawValue = (
  roleId: string, field: PersonField, areaId: string
): Promise<{ withdrawn: boolean; note: string }> =>
  call(`/workspace/person/${encodeURIComponent(roleId)}/withdraw`, {
    method: 'POST',
    body: JSON.stringify({ field, areaId })
  });

/* -- Was ein Bereich bekommen hat ------------------------------------------- */

export interface Given {
  readonly roleId: string;
  readonly field: PersonField;
  readonly epoch: number;
  readonly sealed: string;
  readonly releasedAt: string;
}

export const loadGiven = (areaId: string): Promise<{ given: readonly Given[] }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/people`);

/** Und aufmachen — mit dem Epochenschlüssel des Bereichs. */
export async function openGiven(
  given: readonly Given[], areaKey: Uint8Array
): Promise<Map<string, Map<PersonField, string>>> {
  const out = new Map<string, Map<PersonField, string>>();

  for (const one of given) {
    try {
      const text = await openText(
        areaKey, releaseAad(one.roleId, one.field), fromBase64Url(one.sealed));

      const row = out.get(one.roleId) ?? new Map<PersonField, string>();
      row.set(one.field, text);
      out.set(one.roleId, row);
    } catch {
      // Aus einer anderen Epoche, oder beschädigt. Die übrigen bleiben lesbar.
    }
  }

  return out;
}
