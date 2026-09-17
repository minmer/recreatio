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
  aad, Field, fromBase64Url, KEY_SIZE, open, openText, seal, sealText,
  toBase64Url, unwrapKey, wrapKey
} from './crypto';
import { newId } from './ids';
import { newLink, seatAad, type Link, type SubmittedValue } from './seat';
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

  /**
   * SELBST ANMELDEN: der Browser würfelt sich hier einen eigenen Platz, und die
   * Einsendung bekommt einen Link zurück (0027).
   *
   * <b>Der Firmling ist der Fall.</b> Er hat kein Konto, niemand hat ihm etwas
   * geschickt — und trotzdem soll er seine Angaben wiederlesen können. Also
   * entsteht sein Platz in demselben Augenblick wie seine Einsendung.
   *
   * `underPath` sagt, wohin der Platz gehört: damit liest sich seine Adresse
   * als <code>…/confirmation/portal/…</code> und nicht als loses `#/seat/…`.
   *
   * <b>Ein PFAD und keine Kennung</b>, und der Dienst prüft ihn: `access_slug`
   * ist einer der drei Wege in eine interne Unterseite (0026). Nähme er eine
   * Kennung, wie sie kommt, schriebe sich ein Fremder mit einer Anmeldung den
   * Zutritt zu `lo13/anna`. Erlaubt ist die Seite mit diesem Formular oder eine
   * darüber.
   */
  readonly selfSeat?: {
    readonly areaId: string;
    readonly epoch: number;
    readonly recipientName?: string;
    readonly underPath?: string;
  };
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
): Promise<{
  registrationId: string;
  claim: string | null;
  link: Link | null;
  under: string | null;
}> {
  const areaOf = new Map(to.fields.map((f) => [f.fieldId, f.areaId]));
  const publicKeys = new Map(to.areas.map((a) => [a.areaId, fromBase64Url(a.publicKey)]));

  /*
   * DER EIGENE PLATZ, falls dieses Formular einen vergibt. Er entsteht VOR den
   * Werten, weil jeder Wertschlüssel ein zweites Mal unter ihm versiegelt wird
   * — das ist der Weg, auf dem der Mensch später seine eigenen Angaben
   * wiederliest.
   */
  let mine: { seatId: string; link: Link; linkKey: Uint8Array; seatKey: Uint8Array } | null = null;

  if (to.selfSeat !== undefined && to.seat === undefined) {
    const { link, key: linkKey } = newLink();
    mine = {
      seatId: newId(), link, linkKey,
      seatKey: crypto.getRandomValues(new Uint8Array(KEY_SIZE))
    };
  }

  /* Ein Platz, den ich mitbringe, oder einer, den ich gerade gewürfelt habe. */
  const seatKey = to.seat?.key ?? mine?.seatKey;

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
      seatKeySealed: seatKey === undefined
        ? null
        : toBase64Url(await seal(seatKey, label, key))
    });
  }

  /*
   * Die Quittung nur dann, wenn es sonst KEINE Spur gäbe. Wer einen Platz hat —
   * mitgebracht oder eben gewürfelt — findet über ihn zurück; ein zweites
   * Geheimnis daneben wäre ein zweites, das man verlieren kann.
   */
  const claim = to.seat === undefined && to.roleId === undefined && mine === null
    ? toBase64Url(crypto.getRandomValues(new Uint8Array(24)))
    : null;

  let seat: object | null = null;

  if (mine !== null && to.selfSeat !== undefined) {
    const publicKey = publicKeys.get(to.selfSeat.areaId);
    if (publicKey === undefined) throw new Error('Ten obszar nie przyjmuje zgłoszeń.');

    const label = seatAad(mine.seatId);

    seat = {
      seatId: mine.seatId,
      tokenSha256: toBase64Url(await sha256Of(mine.link.token)),
      seatKeySealed: toBase64Url(await seal(mine.linkKey, label, mine.seatKey)),

      /*
       * DER WEG DER KANZLEI — unter der Annahme und NICHT unter der Epoche.
       * Der Epochenschlüssel liegt bei einem öffentlichen Formular offen; unter
       * ihm zu versiegeln schützte nichts (0027).
       */
      seatKeyForIntake: toBase64Url(await wrapKey(publicKey, label, mine.seatKey)),

      areaId: to.selfSeat.areaId,
      epoch: to.selfSeat.epoch,
      recipientName: to.selfSeat.recipientName ?? null,
      underPath: to.selfSeat.underPath ?? null
    };
  }

  const done = await call<{ registrationId: string; portalUnder: string | null }>(
    `/form/${encodeURIComponent(partId)}/submit`,
    {
      method: 'POST',
      body: JSON.stringify({
        values,
        claimSha256: claim === null ? null : toBase64Url(await sha256Of(claim)),
        seatToken: to.seat?.token ?? null,
        roleId: to.roleId ?? null,
        seat
      })
    });

  return {
    registrationId: done.registrationId,
    claim,
    link: mine?.link ?? null,

    /* Wohin der Platz gehört — vom Dienst, der es entschieden hat. */
    under: done.portalUnder ?? null
  };
}

/**
 * Die EIGENEN Antworten aufmachen — was das Portal eines Firmlings zeigt.
 *
 * <b>Zwei Schlüssel, und sie kommen von verschiedenen Seiten.</b> Der Wert
 * hängt am Platz (mein Link), die Frage an der Epoche des Bereichs (öffentlich,
 * sonst wäre das Formular nie lesbar gewesen).
 *
 * <b>Die Frage darf zubleiben, die Antwort nicht.</b> Wer später ohne den
 * Epochenschlüssel wiederkommt, sieht trotzdem, was er geschrieben hat — nur
 * ohne Beschriftung. Das ist besser als eine leere Seite und ehrlicher als eine
 * erfundene Frage.
 */
export async function openSubmitted(
  values: readonly SubmittedValue[], seatKey: Uint8Array,
  epochKeys: ReadonlyMap<string, Uint8Array>
): Promise<readonly { fieldId: string; label: string | null; value: string | null }[]> {
  const out: { fieldId: string; label: string | null; value: string | null }[] = [];

  for (const one of values) {
    const valueKey = await quiet(() =>
      open(seatKey, valueAad(one.fieldId), fromBase64Url(one.valueKeySealed)));

    const epochKey = epochKeys.get(one.areaId);

    out.push({
      fieldId: one.fieldId,
      label: epochKey === undefined ? null : await quietly(() =>
        openText(epochKey, labelAad(one.fieldId), fromBase64Url(one.labelSealed))),
      value: valueKey === null ? null : await quietly(() =>
        openText(valueKey, valueAad(one.fieldId), fromBase64Url(one.valueSealed)))
    });
  }

  return out;
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

  /** Aus der Liste genommen — die Hüllen liegen weiter da. */
  readonly hidden: boolean;

  readonly values: readonly SealedAnswer[];
}

export const loadRegistrations = (
  partId: string, withHidden = false
): Promise<{ registrations: readonly Submission[] }> =>
  call(`/workspace/part/${encodeURIComponent(partId)}/registrations${withHidden ? '?hidden=1' : ''}`);

/**
 * Aus der Liste nehmen — oder zurückholen.
 *
 * <b>Das löscht nichts.</b> Die versiegelten Antworten bleiben liegen; es
 * ändert sich, was die Kanzlei vor sich sieht. Für eine Doppeleinsendung oder
 * einen Probelauf ist das richtig — für jemanden, der um Löschung bittet,
 * falsch. Dafür steht `removeSubmission` daneben.
 */
export const hideSubmission = (
  registrationId: string, hidden: boolean
): Promise<{ registrationId: string; hidden: boolean }> =>
  call(`/workspace/registration/${encodeURIComponent(registrationId)}/hide`, {
    method: 'POST',
    body: JSON.stringify({ hidden })
  });

/**
 * LÖSCHEN — die Antworten mit.
 *
 * <b>Danach gibt es sie nicht mehr.</b> Kein Papierkorb: die einzigen Bytes, in
 * denen die Angaben je standen, verschwinden. Auch der Dienst bekommt sie nicht
 * zurück — er konnte sie ohnehin nie lesen.
 *
 * <b>Der Platz bleibt.</b> Er ist der Zugang eines Menschen und nicht seine
 * Einsendung; sein Portal zeigt danach nur kein „Twoje zgłoszenie" mehr.
 */
export const removeSubmission = (
  registrationId: string
): Promise<{ registrationId: string; removed: boolean; values: number }> =>
  call(`/workspace/registration/${encodeURIComponent(registrationId)}/remove`, { method: 'POST' });

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

/**
 * Wie es einer Einsendung ERGANGEN ist — und nicht nur, was aufging.
 *
 * <b>Ein leerer Kasten ist keine Auskunft.</b> `openSubmission` verschluckt
 * jeden Fehlschlag, und das ist für die Anzeige einer einzelnen Zeile richtig:
 * eine beschädigte Antwort darf die übrigen nicht mitnehmen. Für die Kanzlei
 * ist es falsch — sie sieht Zeitstempel ohne Inhalt und erfährt nicht, woran
 * es liegt. Die drei Fälle sind völlig verschieden:
 *
 * <code>
 *   nichts geschickt   der Dienst gab keine Werte heraus (fremder Bereich)
 *   nichts aufgegangen der Annahmeschlüssel passt nicht zu diesen Hüllen
 *   teils              einzelne Hüllen sind beschädigt
 * </code>
 */
export interface Reading {
  readonly values: Map<string, string>;
  readonly sent: number;
  readonly opened: number;
}

export async function readSubmission(
  submission: Submission, intakePrivate: Uint8Array
): Promise<Reading> {
  const values = await openSubmission(submission, intakePrivate);

  return { values, sent: submission.values.length, opened: values.size };
}

/* -- Kleinkram -------------------------------------------------------------- */

async function sha256Of(text: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

async function quietly(todo: () => Promise<string>): Promise<string | null> {
  try { return await todo(); } catch { return null; }
}

/** Wie `quietly`, aber für Bytes: eine Hülle, die nicht aufgeht, ist `null`. */
async function quiet<T>(todo: () => Promise<T>): Promise<T | null> {
  try { return await todo(); } catch { return null; }
}
