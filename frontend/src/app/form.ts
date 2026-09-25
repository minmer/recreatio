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
import type { SealedDesign } from './formDesign';
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

/**
 * WELCHE genormte Angabe eine Frage abfragt (0038).
 *
 * <b>Die Frage steht in Worten, die Angabe braucht einen Namen.</b> „Imię i
 * nazwisko", „Jak się do Ciebie zwracać?", „Twój numer" — daran erkennt kein
 * Programm, dass zweimal dasselbe gemeint ist. Steht es hier, dann schon: dann
 * füllt der Bogen sich aus dem, was der Mensch EINMAL angelegt hat, und eine
 * Änderung dort ist eine Änderung überall.
 *
 * <b>`name` und `contact` bleiben.</b> Sie stehen in vorhandenen Zeilen. Sie zu
 * verbieten hiesse zu raten, was gemeint war — und „Name" ist nicht dasselbe
 * wie „Vorname".
 */
export const IDENTITY_ROLES = [
  'none',
  'given_name', 'surname', 'nickname', 'born', 'phone', 'email', 'address',
  'name', 'contact'
] as const;

export type IdentityRole = (typeof IDENTITY_ROLES)[number];

export const IDENTITY_LABEL: Record<IdentityRole, string> = {
  none: '— zwykłe pytanie —',
  given_name: 'Imię',
  surname: 'Nazwisko',
  nickname: 'Przezwisko',
  born: 'Data urodzenia',
  phone: 'Telefon',
  email: 'E-mail',
  address: 'Adres',

  /* Was vor 0038 dastand — auswählbar bleibt es nicht, lesbar schon. */
  name: 'Nazwisko (dawne „name")',
  contact: 'Kontakt (dawne „contact")'
};

/** Was man heute WÄHLEN kann — die beiden alten stehen nur noch in Zeilen. */
export const CHOOSABLE_IDENTITY: readonly IdentityRole[] =
  IDENTITY_ROLES.filter((r) => r !== 'name' && r !== 'contact');

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
  /** Wohin die Antworten gehen. */
  readonly areaId: string;
  /** Der Epochenschlüssel dieses Bereichs — ohne `labelArea` liegt die Frage darunter. */
  readonly areaKey: Uint8Array;
  readonly epoch: number;

  /**
   * Der Bereich des FORMULARS (0042) — die Frage liegt unter SEINEM Schlüssel,
   * damit sie lesen kann, wer das Formular sieht, und nicht nur, wer die
   * Antworten liest.
   */
  readonly labelArea?: { readonly areaId: string; readonly key: Uint8Array; readonly epoch: number };

  readonly kind: FieldKind;
  readonly position: number;
  readonly label: string;
  readonly help?: string;
  /** Eine Zeile je Möglichkeit. */
  readonly options?: readonly string[];
  readonly isRequired?: boolean;
  readonly isHalfWidth?: boolean;
  readonly identityRole?: IdentityRole;

  /** Darf der Mensch die Antwort später über seinen Link berichtigen (0044)? Vorgabe: ja. */
  readonly selfEdit?: boolean;
}

export async function addField(partId: string, what: NewField): Promise<{ fieldId: string }> {
  const fieldId = newId();
  const key = what.labelArea?.key ?? what.areaKey;

  return call(`/workspace/part/${encodeURIComponent(partId)}/field`, {
    method: 'POST',
    body: JSON.stringify({
      fieldId,
      areaId: what.areaId,
      epoch: what.epoch,
      kind: what.kind,
      position: what.position,
      ...(await sealQuestion(key, fieldId, { label: what.label, help: what.help, options: what.options })),
      labelAreaId: what.labelArea?.areaId ?? null,
      labelEpoch: what.labelArea?.epoch ?? null,
      isRequired: what.isRequired ?? false,
      isHalfWidth: what.isHalfWidth ?? false,
      identityRole: what.identityRole ?? 'none',
      selfEdit: what.selfEdit ?? true
    })
  });
}

/**
 * Eine Frage versiegeln — Text, Hilfe, Auswahl — unter EINEM Schlüssel.
 *
 * Die Etiketten nennen die Frage, nicht den Bereich: dieselbe Frage lässt
 * sich deshalb unter einem anderen Schlüssel neu versiegeln (0042), ohne
 * dass sich an ihr sonst etwas ändert.
 */
export async function sealQuestion(
  key: Uint8Array, fieldId: string,
  q: { readonly label: string; readonly help?: string | null; readonly options?: readonly string[] }
): Promise<{ labelSealed: string; helpSealed: string | null; optionsSealed: string | null }> {
  const options = (q.options ?? []).map((o) => o.trim()).filter((o) => o !== '');
  const help = (q.help ?? '').trim();

  return {
    labelSealed: toBase64Url(await sealText(key, labelAad(fieldId), q.label.trim())),
    helpSealed: help === '' ? null : toBase64Url(await sealText(key, helpAad(fieldId), help)),
    optionsSealed: options.length === 0
      ? null
      : toBase64Url(await sealText(key, optionsAad(fieldId), options.join('\n')))
  };
}

/* -- Eine Frage ändern (0042) ------------------------------------------------ */

export interface FieldEdit {
  /** Der Schlüssel, unter dem die Frage NEU versiegelt wird — der des Formulars. */
  readonly key: Uint8Array;
  readonly labelArea: { readonly areaId: string; readonly epoch: number } | null;

  readonly label: string;
  readonly help?: string | null;
  readonly options?: readonly string[];
  readonly kind: FieldKind;
  readonly isRequired: boolean;
  readonly isHalfWidth: boolean;
  readonly identityRole: IdentityRole;

  /** Darf der Mensch sie selbst berichtigen (0044)? Fehlt es, bleibt es, wie es war. */
  readonly selfEdit?: boolean;

  /** Wohin die Antworten ab jetzt gehen — mit JEDER vorhandenen neu verpackt (`moveAnswers`). */
  readonly moveTo?: { readonly areaId: string; readonly moved: readonly MovedValue[] };
}

export async function editField(fieldId: string, e: FieldEdit): Promise<{ areaId: string; moved: number }> {
  return call(`/workspace/field/${encodeURIComponent(fieldId)}`, {
    method: 'POST',
    body: JSON.stringify({
      ...(await sealQuestion(e.key, fieldId, { label: e.label, help: e.help, options: e.options })),
      labelAreaId: e.labelArea?.areaId ?? null,
      labelEpoch: e.labelArea?.epoch ?? null,
      kind: e.kind,
      isRequired: e.isRequired,
      isHalfWidth: e.isHalfWidth,
      identityRole: e.identityRole,
      selfEdit: e.selfEdit ?? null,
      moveTo: e.moveTo?.areaId ?? null,
      moved: e.moveTo?.moved ?? null
    })
  });
}

/** Ein Wertschlüssel, für die Annahme eines anderen Bereichs neu verpackt. */
export interface MovedValue {
  readonly registrationId: string;
  readonly wrappedKey: string;
  readonly officeKeySealed: string | null;
}

/**
 * Die Antworten EINER Frage in einen anderen Bereich — ohne sie anzufassen.
 *
 * Jede Antwort hat ihren eigenen Schlüssel. Er wird hier aufgemacht (mit der
 * Annahme des alten Bereichs, oder dem Amtsschlüssel, wo er schon so liegt)
 * und unter der öffentlichen Hälfte der NEUEN Annahme verpackt. Der Wert
 * bleibt, wie er ist, und die Hülle des Menschen (`seat_key_sealed`) auch —
 * er liest seine Antwort danach wie vorher.
 *
 * Die symmetrische Amtshülle fällt dabei weg; beim nächsten Öffnen durch das
 * Amt des neuen Bereichs entsteht sie wieder (0037).
 */
export async function moveAnswers(
  fieldId: string,
  submissions: readonly Submission[],
  from: { readonly intakePrivate: Uint8Array; readonly officeKey?: Uint8Array },
  to: { readonly intakePublic: Uint8Array }
): Promise<readonly MovedValue[]> {
  const out: MovedValue[] = [];
  const label = valueAad(fieldId);

  for (const one of submissions) {
    const value = one.values.find((v) => v.fieldId === fieldId);
    if (value === undefined) continue;

    const key = value.officeKeySealed !== null && value.officeKeySealed !== undefined && from.officeKey !== undefined
      ? await open(from.officeKey, officeValueAad(fieldId), fromBase64Url(value.officeKeySealed))
      : await unwrapKey(from.intakePrivate, label, fromBase64Url(value.wrappedKey!));

    out.push({
      registrationId: one.registrationId,
      wrappedKey: toBase64Url(await wrapKey(to.intakePublic, label, key)),
      officeKeySealed: null
    });
  }

  return out;
}

export interface SealedField {
  readonly fieldId: string;

  /** Wohin die ANTWORTEN gehen. */
  readonly areaId: string;

  /**
   * Unter welchem Schlüssel die FRAGE liegt (0042) — der Bereich des
   * Formulars. Bei einer Frage von davor derselbe wie `areaId`; der Dienst
   * setzt beides immer.
   */
  readonly labelAreaId: string;
  readonly labelEpoch: number;
  readonly kind: FieldKind;
  readonly position: number;
  readonly labelSealed: string;
  readonly helpSealed: string | null;
  readonly optionsSealed: string | null;
  readonly epoch: number;
  readonly isRequired: boolean;
  readonly isHalfWidth: boolean;
  readonly identityRole: IdentityRole;

  /** Darf der Mensch die Antwort über seinen Link berichtigen (0044)? */
  readonly selfEdit: boolean;
}

export const loadFields = (partId: string): Promise<{
  fields: readonly SealedField[];

  /** Aufbau und Logik (0043) — versiegelt, oder `null`, wenn das Formular eine Liste ist. */
  design: SealedDesign | null;
}> =>
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

  /**
   * WOVON der Bogen handelt (0038) — und woran der Platz hängen wird, den er
   * erzeugt. `'none'` heisst: von nichts Benanntem.
   */
  readonly forKind: 'none' | 'person' | 'group' | 'role';
  readonly fields: readonly SealedField[];
  readonly areas: readonly FormArea[];

  /** Geschlossen: das Formular steht da, nimmt aber nichts an (0042). */
  readonly closed: boolean;

  /** EINE Klausel für das ganze Formular (0042) — ohne sie sammelt es nichts. */
  readonly controller: Controller | null;

  /** Aufbau und Logik (0043) — versiegelt unter dem Schlüssel des Formularbereichs. */
  readonly design: SealedDesign | null;
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
    /* Die Frage liegt unter dem Schlüssel des FORMULARS (0042), nicht der Antworten. */
    const key = keys.get(f.labelAreaId ?? f.areaId);

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
   * Zutritt zu `lo13/anna`. Erlaubt ist die Seite mit diesem Formular, eine
   * darüber oder darunter — und die Seite, die die Kanzlei in den Einstellungen
   * gewählt hat, wenn sie öffentlich ist und demselben Träger gehört.
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

  /**
   * Der Platz, den dieser Browser sich gewürfelt hat — samt Schlüssel.
   *
   * <b>Damit lässt er sich an eine Rolle binden</b> (`bindSeat`), und das
   * geht nur JETZT: der Schlüssel liegt im Speicher dieses Tabs und sonst
   * nirgends. Wer ihn hier nicht mitnimmt, müsste den Platz später über
   * seinen Link wieder aufmachen — und der ist gerade einmal sichtbar.
   */
  seat: { seatId: string; key: Uint8Array } | null;
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
    seat: mine === null ? null : { seatId: mine.seatId, key: mine.seatKey },

    /* Wohin der Platz gehört — vom Dienst, der es entschieden hat. */
    under: done.portalUnder ?? null
  };
}

/**
 * Die EIGENEN Antworten aufmachen — was das Portal eines Firmlings zeigt.
 *
 * <b>Zwei Schlüssel, und sie kommen von verschiedenen Seiten.</b> Der Wert
 * hängt am Platz (mein Link), die Frage am Schlüssel des FORMULARbereichs
 * (0042; öffentlich, sonst wäre das Formular nie lesbar gewesen). Vorher wurde
 * sie mit dem Schlüssel der ANTWORTEN aufgemacht — und blieb zu, sobald die
 * Antworten in einem nicht jawnen Bereich lagen.
 *
 * <b>Die Frage darf zubleiben, die Antwort nicht.</b> Wer später ohne den
 * Epochenschlüssel wiederkommt, sieht trotzdem, was er geschrieben hat — nur
 * ohne Beschriftung. Das ist besser als eine leere Seite und ehrlicher als eine
 * erfundene Frage.
 */
export async function openSubmitted(
  values: readonly SubmittedValue[], seatKey: Uint8Array,
  labelKeys: ReadonlyMap<string, Uint8Array>
): Promise<readonly OwnAnswer[]> {
  const out: OwnAnswer[] = [];

  for (const one of values) {
    const valueKey = await quiet(() =>
      open(seatKey, valueAad(one.fieldId), fromBase64Url(one.valueKeySealed)));

    /* Die Frage liegt unter dem Schlüssel des FORMULARS (0042), nicht der Antworten. */
    const labelKey = labelKeys.get(one.labelAreaId ?? one.areaId);

    out.push({
      registrationId: one.registrationId,
      formId: one.formId,
      fieldId: one.fieldId,
      label: labelKey === undefined ? null : await quietly(() =>
        openText(labelKey, labelAad(one.fieldId), fromBase64Url(one.labelSealed))),
      options: labelKey === undefined || one.optionsSealed === null ? [] : ((await quietly(() =>
        openText(labelKey, optionsAad(one.fieldId), fromBase64Url(one.optionsSealed!)))) ?? '')
        .split('\n').filter((o) => o !== ''),
      value: valueKey === null ? null : await quietly(() =>
        openText(valueKey, valueAad(one.fieldId), fromBase64Url(one.valueSealed)))
    });
  }

  return out;
}

/** Eine eigene Antwort, aufgemacht — mit der Einsendung und dem Formular, zu denen sie gehört. */
export interface OwnAnswer {
  readonly registrationId: string;
  readonly formId: string;
  readonly fieldId: string;

  /** `null`: der Schlüssel der Frage liegt nicht offen. Die Antwort bleibt trotzdem lesbar. */
  readonly label: string | null;
  readonly options: readonly string[];
  readonly value: string | null;
}

/* -- Was die Kanzlei sieht -------------------------------------------------- */

export interface SealedAnswer {
  readonly fieldId: string;
  readonly sealed: string;
  /** Der alte RSA-Umschlag der Annahme. `null`, sobald er abgelöst ist (0037). */
  readonly wrappedKey: string | null;

  /** Derselbe Schlüssel, symmetrisch unter dem Schlüssel der Amtsrolle (0037). */
  readonly officeKeySealed: string | null;
}

export interface Submission {
  readonly registrationId: string;
  readonly seatId: string | null;
  readonly submittedAt: string;
  readonly withdrawnAt: string | null;

  /** Aus der Liste genommen — die Hüllen liegen weiter da. */
  readonly hidden: boolean;

  readonly values: readonly SealedAnswer[];

  /** Was an einzelnen Werten bestätigt wurde (0030) — die Stelle, nicht der Inhalt. */
  readonly checks: readonly ValueCheck[];
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
 * Eine Einsendung aufmachen — auf dem Weg, der dasteht.
 *
 * <b>Zwei Wege zum selben Schlüssel</b> (0037), und der symmetrische hat
 * Vorrang: `officeKeySealed` liegt unter dem Schlüssel der Amtsrolle,
 * `wrappedKey` ist der alte RSA-Umschlag der Annahme. Genau einer von beiden
 * steht da — die Prüfbedingung der Tabelle lässt nichts anderes zu.
 *
 * <b>Was hier zusätzlich herauskommt, ist die Umstellung selbst.</b> Wer einen
 * RSA-Umschlag geöffnet hat, hält den Schlüssel gerade offen und kann ihn
 * symmetrisch neu versiegeln — genau jetzt und nur jetzt. `toRewrap` sammelt
 * diese Hüllen; wer sie abschickt, löst den RSA-Umschlag ab.
 *
 * <b>Ohne Amtsschlüssel wird nichts umgestellt</b>, und das ist kein Fehler:
 * dann fehlt der Schlüssel, unter dem die neue Hülle liegen müsste. Gelesen
 * wird trotzdem.
 */
export async function openSubmission(
  submission: Submission, intakePrivate: Uint8Array, officeKey?: Uint8Array
): Promise<Map<string, string>> {
  return (await openAndRewrap(submission, intakePrivate, officeKey)).values;
}

/**
 * Dasselbe, aber mit den Hüllen, die den RSA-Umschlag ablösen (0037).
 *
 * <b>Eine eigene Funktion, damit `openSubmission` ihren Vertrag behält.</b>
 * Wer nur lesen will — das Portal, die Prüfungen — bekommt weiterhin eine Map
 * und merkt von der Umstellung nichts.
 */
export async function openAndRewrap(
  submission: Submission,
  intakePrivate: Uint8Array,
  officeKey?: Uint8Array
): Promise<{
  readonly values: Map<string, string>;
  readonly toRewrap: readonly { fieldId: string; officeKeySealed: string }[];
}> {
  const out = new Map<string, string>();
  const toRewrap: { fieldId: string; officeKeySealed: string }[] = [];

  for (const value of submission.values) {
    try {
      const label = valueAad(value.fieldId);

      /* Der symmetrische Weg zuerst — er ist der, der bleiben soll. */
      const key = value.officeKeySealed !== null && value.officeKeySealed !== undefined
        ? await open(officeKeyOf(officeKey), officeValueAad(value.fieldId),
            fromBase64Url(value.officeKeySealed))
        : await unwrapKey(intakePrivate, label, fromBase64Url(value.wrappedKey!));

      out.set(value.fieldId, await openText(key, label, fromBase64Url(value.sealed)));

      /* Noch in RSA? Dann jetzt die Hülle, die ihn ablöst. */
      if (value.officeKeySealed == null && officeKey !== undefined) {
        toRewrap.push({
          fieldId: value.fieldId,
          officeKeySealed: toBase64Url(
            await seal(officeKey, officeValueAad(value.fieldId), key))
        });
      }
    } catch {
      // Aus einer anderen Annahme, oder beschädigt. Die übrigen bleiben lesbar.
    }
  }

  return { values: out, toRewrap };
}

/** Ohne Amtsschlüssel lässt sich eine symmetrische Hülle nicht öffnen. */
function officeKeyOf(key: Uint8Array | undefined): Uint8Array {
  if (key === undefined) {
    throw new Error('Bez klucza roli kancelarii tej koperty się nie otworzy.');
  }
  return key;
}

/** Die AAD der symmetrischen Wertschlüsselhülle — eigen, siehe `Field`. */
const officeValueAad = (fieldId: string) =>
  aad('form', 'value', fieldId, Field.OfficeValueKey, 1);

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

  /**
   * Hüllen, die den RSA-Umschlag ablösen (0037) — für die Werte, die noch in
   * ihm lagen. Leer heisst: schon umgestellt, oder kein Amtsschlüssel da.
   */
  readonly toRewrap: readonly { fieldId: string; officeKeySealed: string }[];
}

export async function readSubmission(
  submission: Submission, intakePrivate: Uint8Array, officeKey?: Uint8Array
): Promise<Reading> {
  const { values, toRewrap } = await openAndRewrap(submission, intakePrivate, officeKey);

  return { values, sent: submission.values.length, opened: values.size, toRewrap };
}

/** Der Schlüssel EINES Antwortbereichs — seine private Annahmehälfte und, wenn gehalten, der der Amtsrolle. */
export interface IntakeKey {
  readonly areaId: string;
  readonly privateKey: Uint8Array;
  readonly officeKey?: Uint8Array;
}

/**
 * EINE Einsendung über ALLE Antwortbereiche aufmachen, deren Schlüssel man hält.
 *
 * <b>Jede Antwort mit dem Schlüssel IHRES Bereichs</b> — nicht jede mit jedem:
 * ein RSA-Umschlag, der nicht aufgeht, kostet so viel wie einer, der aufgeht.
 * Nur eine Antwort, deren Frage es nicht mehr gibt, probiert alle.
 *
 * Vorher las die Kanzlei einen Bereich nach dem anderen, und die Tabelle
 * zeigte immer nur die Antworten des zuletzt gewählten — die Hälfte eines
 * Menschen.
 */
export async function readAcross(
  submission: Submission, keys: readonly IntakeKey[], areaOf: ReadonlyMap<string, string>
): Promise<{
  readonly values: Map<string, string>;
  readonly toRewrap: readonly { fieldId: string; officeKeySealed: string }[];
}> {
  const values = new Map<string, string>();
  const toRewrap: { fieldId: string; officeKeySealed: string }[] = [];

  for (const key of keys) {
    const mine = submission.values.filter((v) => (areaOf.get(v.fieldId) ?? key.areaId) === key.areaId
      && !values.has(v.fieldId));
    if (mine.length === 0) continue;

    const reading = await openAndRewrap({ ...submission, values: mine }, key.privateKey, key.officeKey);
    for (const [fieldId, value] of reading.values) values.set(fieldId, value);
    toRewrap.push(...reading.toRewrap);
  }

  return { values, toRewrap };
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

/* -- Eine Nummer bestätigen (0030) ----------------------------------------- */

/** Was an EINEM Wert an Bestätigung hängt. */
export interface ValueCheck {
  readonly fieldId: string;
  readonly sentAt: string;
  readonly expiresAt: string;
  readonly verifiedAt: string | null;

  /**
   * WIE bestätigt wurde (0031) — und die beiden sagen nicht dasselbe.
   *
   * `sms` heisst: jemand hat den Link geöffnet, der an diese Nummer ging —
   * unter ihr war also jemand erreichbar. `self` heisst: der Mensch hat in
   * seinem Portal bestätigt, dass die Angabe stimmt. Das zweite ist weniger,
   * und es als dasselbe anzuzeigen wäre eine Auskunft, die nicht stimmt.
   */
  readonly origin: 'sms' | 'self';
}

/**
 * Eine Bestätigung scharfstellen — und das Geheimnis behalten.
 *
 * <b>Der Dienst bekommt nur den Abdruck.</b> Das Geheimnis entsteht hier, geht
 * in die SMS und steht nirgends sonst; wer die Datenbank liest, sieht, DASS
 * eine Bestätigung aussteht, und kann sie nicht auslösen.
 *
 * Zurück kommt der Token — die Oberfläche baut daraus die Adresse.
 */
export async function armCheck(
  registrationId: string, fieldId: string, days?: number
): Promise<{ token: string; expiresAt: string }> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));

  const done = await call<{ expiresAt: string }>(
    `/workspace/registration/${encodeURIComponent(registrationId)}/check`,
    {
      method: 'POST',
      body: JSON.stringify({
        fieldId,
        tokenSha256: toBase64Url(await sha256Of(token)),
        days: days ?? null
      })
    });

  return { token, expiresAt: done.expiresAt };
}

/**
 * Den Link einlösen — ohne Konto.
 *
 * <b>Zweimal klicken ist kein Fehler.</b> Wer denselben Link noch einmal
 * öffnet, sieht dasselbe wie beim ersten Mal; alles andere wäre eine Absage für
 * etwas, das schon geklappt hat.
 */
export const redeemCheck = (
  token: string
): Promise<{ verified: boolean; at: string; again: boolean }> =>
  call(`/verify/${encodeURIComponent(token)}`, { method: 'POST' });

/**
 * „To mój numer" — aus dem eigenen Portal bestätigen (0031).
 *
 * <b>Es beweist etwas anderes als der Link aus der SMS.</b> Wer hier drückt,
 * sagt: diese Angabe stimmt noch. Wer auf einen Link tippt, den die Kanzlei an
 * die Nummer geschickt hat, zeigt ausserdem, dass unter DIESER Nummer jemand
 * erreichbar war. Deshalb steht in der Zeile, auf welchem Weg es geschah, und
 * deshalb macht dieser Knopf aus einer bestehenden SMS-Bestätigung keine
 * schwächere — `again` sagt dann, dass es sie schon gab.
 */
export const selfCheck = (
  token: string, registrationId: string, fieldId: string
): Promise<{ verified: boolean; again: boolean; origin: 'sms' | 'self'; at: string }> =>
  call(`/seat/${encodeURIComponent(token)}/check`, {
    method: 'POST',
    body: JSON.stringify({ registrationId, fieldId })
  });

/**
 * Einzelne Einstellungen eines Bausteins ändern — ohne die ganze Seite.
 *
 * Der Rasterentwurf speichert `config` mitsamt der Seite; das ist dort richtig.
 * Hier geht es um EINEN Schlüssel, den jemand vor den Einsendungen tippt —
 * dafür die Seite zu verlassen wäre der Umweg, der dazu führt, dass niemand es
 * tut. Ein leerer Wert löscht den Schlüssel.
 */
export const setPartConfig = (
  partId: string, set: Record<string, string>
): Promise<{ partId: string; config: Record<string, string> }> =>
  call(`/workspace/part/${encodeURIComponent(partId)}/config`, {
    method: 'POST',
    body: JSON.stringify({ set })
  });

/**
 * Den RSA-Umschlag ablösen (0037).
 *
 * <b>Nur, wer gerade geöffnet hat, kann das.</b> Die Hüllen entstehen im
 * selben Augenblick, in dem das Amt eine Einsendung aufmacht — dann liegt der
 * Wertschlüssel offen und lässt sich unter dem Schlüssel der Amtsrolle neu
 * versiegeln. Der Dienst setzt die neue und löscht die alte in einer
 * Anweisung; dazwischen gibt es keinen Zustand, in dem beide gelten.
 */
export const rewrapToOffice = (
  partId: string,
  values: readonly { fieldId: string; registrationId: string; officeKeySealed: string }[],
  seats: readonly { seatId: string; seatKeyForOffice: string }[] = []
): Promise<{ rewrapped: number }> =>
  call(`/workspace/part/${encodeURIComponent(partId)}/rewrap`, {
    method: 'POST',
    body: JSON.stringify({ values, seats })
  });
