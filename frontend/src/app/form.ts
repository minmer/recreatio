/**
 * Das Formular — Felder als ZEILEN, und was von aussen hereinkommt.
 *
 * <b>Warum Felder Zeilen sind und keine Einstellung.</b> Eine Antwort zeigt auf
 * ein Feld. Läge die Feldliste als JSON im Baustein, hätte sie keinen Anker:
 * man änderte die Reihenfolge, und alle bisherigen Antworten meinten etwas
 * anderes.
 *
 * <b>Jeder Wert bringt seinen EIGENEN Schlüssel mit.</b> Ein gemeinsamer für
 * alle Felder wäre kürzer und hiesse: wer eines öffnet, öffnet alle.
 *
 * <b>Auch die Beschriftung ist versiegelt</b>, und die Auswahlliste erst recht —
 * eine Liste möglicher Antworten sagt oft mehr als die Frage. Ein öffentliches
 * Formular ist deshalb eines, dessen Bereich seine Epoche offengelegt hat:
 * dasselbe Verfahren wie beim Kalender, und kein zweites.
 */

import {
  aad, Field, fromBase64Url, KEY_SIZE, openText, seal, sealText,
  toBase64Url, unwrapKey, wrapKey
} from './crypto';
import { newId } from './ids';
import { call } from './session';
import type { Controller } from './intake';

export const FIELD_KINDS = ['line', 'text', 'choice', 'date', 'number', 'checkbox', 'email', 'phone'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export const KIND_LABEL: Record<FieldKind, string> = {
  line: 'Jedna linia',
  text: 'Dłuższy tekst',
  choice: 'Wybór z listy',
  date: 'Data',
  number: 'Liczba',
  checkbox: 'Tak / nie',
  email: 'E-mail',
  phone: 'Telefon'
};

/** Woraus Name und Kontakt zu lesen sind — sonst müsste die Kanzlei raten. */
export type IdentityRole = 'none' | 'name' | 'contact';

const labelAad = (fieldId: string) => aad('form', 'field', fieldId, Field.EventFieldLabel, 1);
const helpAad = (fieldId: string) => aad('form', 'field', fieldId, Field.EventFieldHelp, 1);
const optionsAad = (fieldId: string) => aad('form', 'field', fieldId, Field.EventFieldOptions, 1);

/*
 * Der Wert trägt eine andere Objektart als die Frage. Sonst liesse sich eine
 * Antwort an den Platz einer Beschriftung schieben — beide nennen dasselbe Feld.
 */
const valueAad = (fieldId: string) => aad('form', 'value', fieldId, Field.EventAnswer, 1);

/* -- Felder pflegen --------------------------------------------------------- */

export interface NewField {
  readonly areaId: string;
  /** Der Epochenschlüssel des Bereichs, unter dem die Frage liegen soll. */
  readonly areaKey: Uint8Array;
  readonly epoch: number;

  readonly kind: FieldKind;
  readonly position: number;
  readonly label: string;
  readonly help?: string;
  /** Eine Zeile je Möglichkeit. */
  readonly options?: readonly string[];
  readonly isRequired?: boolean;
  readonly isHalfWidth?: boolean;
  readonly identityRole?: IdentityRole;
}

export async function addField(partId: string, what: NewField): Promise<{ fieldId: string }> {
  const fieldId = newId();
  const options = (what.options ?? []).filter((o) => o.trim() !== '');

  return call(`/workspace/part/${encodeURIComponent(partId)}/field`, {
    method: 'POST',
    body: JSON.stringify({
      fieldId,
      areaId: what.areaId,
      epoch: what.epoch,
      kind: what.kind,
      position: what.position,
      labelSealed: toBase64Url(await sealText(what.areaKey, labelAad(fieldId), what.label.trim())),
      helpSealed: (what.help ?? '').trim() === ''
        ? null
        : toBase64Url(await sealText(what.areaKey, helpAad(fieldId), what.help!.trim())),
      optionsSealed: options.length === 0
        ? null
        : toBase64Url(await sealText(what.areaKey, optionsAad(fieldId), options.join('\n'))),
      isRequired: what.isRequired ?? false,
      isHalfWidth: what.isHalfWidth ?? false,
      identityRole: what.identityRole ?? 'none'
    })
  });
}

export interface SealedField {
  readonly fieldId: string;
  readonly areaId: string;
  readonly kind: FieldKind;
  readonly position: number;
  readonly labelSealed: string;
  readonly helpSealed: string | null;
  readonly optionsSealed: string | null;
  readonly epoch: number;
  readonly isRequired: boolean;
  readonly isHalfWidth: boolean;
  readonly identityRole: IdentityRole;
}

export const loadFields = (partId: string): Promise<{ fields: readonly SealedField[] }> =>
  call(`/workspace/part/${encodeURIComponent(partId)}/fields`);

export const removeField = (fieldId: string): Promise<{ removed: boolean }> =>
  call(`/workspace/field/${encodeURIComponent(fieldId)}/remove`, { method: 'POST' });

/* -- Das öffentliche Formular ----------------------------------------------- */

export interface FormArea {
  readonly areaId: string;
  readonly publicKey: string;
  readonly controller: Controller | null;
}

export interface PublicForm {
  readonly partId: string;
  readonly fields: readonly SealedField[];
  readonly areas: readonly FormArea[];
}

export const loadForm = (partId: string): Promise<PublicForm> =>
  call(`/form/${encodeURIComponent(partId)}`);

export interface OpenField extends SealedField {
  /** `null` heisst: der Schlüssel dieses Bereichs liegt nicht offen. */
  readonly label: string | null;
  readonly help: string | null;
  readonly options: readonly string[];
}

/**
 * Die Fragen aufmachen — mit den Epochenschlüsseln, die offen liegen.
 *
 * Ein Feld, dessen Bereich nichts offengelegt hat, bleibt zu. Es verschwindet
 * NICHT: dass dort eine Frage steht, die man nicht lesen kann, ist eine
 * Auskunft, die der Mensch davor braucht — sonst füllt er ein Formular aus, das
 * er für vollständig hält.
 */
export async function openFields(
  fields: readonly SealedField[], keys: ReadonlyMap<string, Uint8Array>
): Promise<readonly OpenField[]> {
  const out: OpenField[] = [];

  for (const f of fields) {
    const key = keys.get(f.areaId);

    if (key === undefined) {
      out.push({ ...f, label: null, help: null, options: [] });
      continue;
    }

    out.push({
      ...f,
      label: await quietly(() => openText(key, labelAad(f.fieldId), fromBase64Url(f.labelSealed))),
      help: f.helpSealed === null
        ? null
        : await quietly(() => openText(key, helpAad(f.fieldId), fromBase64Url(f.helpSealed!))),
      options: f.optionsSealed === null
        ? []
        : ((await quietly(() => openText(key, optionsAad(f.fieldId), fromBase64Url(f.optionsSealed!))))
            ?? '').split('\n').filter((o) => o !== '')
    });
  }

  return out;
}

/* -- Einsenden -------------------------------------------------------------- */

export interface Answer {
  readonly fieldId: string;
  readonly value: string;
}

export interface SubmitTo {
  /** Öffentliche Annahmehälfte je Bereich — aus `loadForm`. */
  readonly areas: readonly FormArea[];
  readonly fields: readonly SealedField[];

  /** Wenn über einen Platz eingesandt wird: sein Schlüssel und sein Token. */
  readonly seat?: { readonly token: string; readonly key: Uint8Array };

  /** Angemeldet und ausdrücklich benannt — nie geraten. */
  readonly roleId?: string;
}

/**
 * Eine Einsendung verschliessen und abschicken.
 *
 * <b>Die Quittung ist der einzige Weg zurück</b>, wenn niemand angemeldet ist
 * und kein Platz im Spiel: sie wird hier gewürfelt, ihr Abdruck geht mit, und
 * sie selbst kommt an den Aufrufer zurück. Wer sie verliert, kommt an seine
 * Einsendung nicht mehr heran — und das ist besser, als wenn jeder andere es
 * könnte.
 */
export async function submitForm(
  partId: string, answers: readonly Answer[], to: SubmitTo
): Promise<{ registrationId: string; claim: string | null }> {
  const areaOf = new Map(to.fields.map((f) => [f.fieldId, f.areaId]));
  const publicKeys = new Map(to.areas.map((a) => [a.areaId, fromBase64Url(a.publicKey)]));

  const values: object[] = [];

  for (const one of answers) {
    if (one.value.trim() === '') continue;

    const areaId = areaOf.get(one.fieldId);
    const publicKey = areaId === undefined ? undefined : publicKeys.get(areaId);

    if (publicKey === undefined) {
      throw new Error(`Pole ${one.fieldId} nie ma klucza przyjmowania.`);
    }

    // Je Wert ein eigener Schlüssel.
    const key = crypto.getRandomValues(new Uint8Array(KEY_SIZE));
    const label = valueAad(one.fieldId);

    values.push({
      fieldId: one.fieldId,
      sealed: toBase64Url(await sealText(key, label, one.value.trim())),
      wrappedKey: toBase64Url(await wrapKey(publicKey, label, key)),

      // Damit der Mensch seine eigene Einsendung wiederlesen kann.
      seatKeySealed: to.seat === undefined
        ? null
        : toBase64Url(await seal(to.seat.key, label, key))
    });
  }

  const claim = to.seat === undefined && to.roleId === undefined
    ? toBase64Url(crypto.getRandomValues(new Uint8Array(24)))
    : null;

  const done = await call<{ registrationId: string }>(
    `/form/${encodeURIComponent(partId)}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({
        values,
        claimSha256: claim === null ? null : toBase64Url(await sha256Of(claim)),
        seatToken: to.seat?.token ?? null,
        roleId: to.roleId ?? null
      })
    });

  return { registrationId: done.registrationId, claim };
}

/* -- Was die Kanzlei sieht -------------------------------------------------- */

export interface SealedAnswer {
  readonly fieldId: string;
  readonly sealed: string;
  readonly wrappedKey: string;
}

export interface Submission {
  readonly registrationId: string;
  readonly seatId: string | null;
  readonly submittedAt: string;
  readonly withdrawnAt: string | null;
  readonly values: readonly SealedAnswer[];
}

export const loadRegistrations = (partId: string): Promise<{ registrations: readonly Submission[] }> =>
  call(`/workspace/part/${encodeURIComponent(partId)}/registrations`);

/**
 * Eine Einsendung aufmachen — mit dem PRIVATEN Annahmeschlüssel.
 *
 * Zwei Schritte je Wert: den Feldschlüssel auspacken, damit den Wert öffnen.
 * Genau deshalb kann der Dienst nichts davon lesen — er hat den ersten nie.
 */
export async function openSubmission(
  submission: Submission, intakePrivate: Uint8Array
): Promise<Map<string, string>> {
  const out = new Map<string, string>();

  for (const value of submission.values) {
    try {
      const label = valueAad(value.fieldId);
      const key = await unwrapKey(intakePrivate, label, fromBase64Url(value.wrappedKey));

      out.set(value.fieldId, await openText(key, label, fromBase64Url(value.sealed)));
    } catch {
      // Aus einer anderen Annahme, oder beschädigt. Die übrigen bleiben lesbar.
    }
  }

  return out;
}

/* -- Kleinkram -------------------------------------------------------------- */

async function sha256Of(text: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

async function quietly(todo: () => Promise<string>): Promise<string | null> {
  try { return await todo(); } catch { return null; }
}
