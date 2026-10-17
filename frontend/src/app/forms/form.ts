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

import { aad, Field, fromBase64Url, open, openText, sealText, toBase64Url, unwrapKey, wrapKey } from '../core/crypto';
import { newId } from '../core/ids';
import { call } from '../core/session';
import type { SealedDesign } from './formDesign';
import type { Controller } from './intake';
import type { Repeat } from './rounds';
import type { Submission } from './submissions';

export const FIELD_KINDS = ['line', 'text', 'choice', 'date', 'number', 'checkbox', 'email', 'phone', 'consent', 'pesel'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/**
 * „TAK" — was eine angekreuzte Frage der Art „Tak / nie" trägt (0077). Nicht
 * angekreuzt ist leer. Gelesen wird duldsam: bis 0077 war diese Frage ein
 * Textfeld, und in alten Einsendungen steht, was jemand tippte.
 */
export const YES = 'tak';

export const isYes = (value: string | undefined | null): boolean =>
  /^(tak|t|yes|y|true|1|x|✓|✔)$/i.test((value ?? '').trim());

/*
 * 0083 — EINE ZUSTIMMUNG (Art „consent") trägt den WORTLAUT, dem zugestimmt
 * wurde: „tak: Jako rodzic albo opiekun prawny wyrażam zgodę …". RODO Art. 7
 * Abs. 1 verlangt, zeigen zu können, WOZU jemand ja gesagt hat — und der Text
 * einer Frage lässt sich später ändern. Die Antwort behält den alten.
 * Nicht zugestimmt ist leer.
 */
export const consentValue = (statement: string): string => `${YES}: ${statement.trim()}`;

/** Zugestimmt? Auch ein blosses „tak" (eine Frage, die vorher „Tak / nie" war). */
export const consentGiven = (value: string | undefined | null): boolean =>
  /^tak(:|$)/i.test((value ?? '').trim()) || isYes(value);

/** Der Wortlaut, dem zugestimmt wurde — ohne das „tak:" davor. */
export const consentText = (value: string | undefined | null): string =>
  (value ?? '').trim().replace(/^tak:\s*/i, '');

/**
 * Wie eine Antwort in einer Liste oder Tabelle dasteht: eine Zustimmung als
 * „tak" (der Wortlaut steht in der Antwort selbst und auf dem Ausdruck), ein
 * „Tak / nie" als „tak", alles andere, wie es ist.
 */
export const shownAnswer = (kind: string | undefined, value: string): string =>
  kind === 'consent' ? (consentGiven(value) ? 'tak' : '')
  : kind === 'checkbox' ? (isYes(value) ? 'tak' : value.trim() === '' ? '' : value)
  : value;

export const KIND_LABEL: Record<FieldKind, string> = {
  line: 'Jedna linia',
  text: 'Dłuższy tekst',
  choice: 'Wybór z listy',
  date: 'Data',
  number: 'Liczba',
  checkbox: 'Tak / nie',
  email: 'E-mail',
  phone: 'Telefon',
  consent: 'Zgoda / oświadczenie',
  pesel: 'PESEL'
};

/**
 * WELCHE genormte Angabe eine Frage abfragt (0038).
 *
 * <b>Die Frage steht in Worten, die Angabe braucht einen Namen.</b> „Imię i
 * nazwisko", „Jak się do Ciebie zwracać?", „Twój numer" — daran erkennt kein
 * Programm, dass zweimal dasselbe gemeint ist. Steht es hier, dann schon: dann
 * füllt der Bogen sich aus dem, was der Mensch EINMAL angelegt hat, und eine
 * Änderung dort ist eine Änderung überall.
 */
export const IDENTITY_ROLES = [
  'none',
  'given_name', 'surname', 'nickname', 'born', 'phone', 'email', 'address'
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
  address: 'Adres'
};

/**
 * DER VOLLE NAME eines Menschen aus seinen Antworten — Imię i nazwisko.
 *
 * <b>Überall derselbe</b>: in der Liste der Kanzlei, am Platz, im Kalender, an
 * einer Bitte um Mitnahme. Vorher nahm jede Stelle das ERSTE Namensfeld, und
 * bei getrennten Feldern war das der Nachname allein.
 *
 * Reihenfolge: Vor- und Nachname, sonst der Spitzname.
 * `null`, wenn der Bogen nach keinem fragt.
 */
export function fullNameOf(
  fields: readonly { readonly fieldId: string; readonly identityRole: IdentityRole }[],
  valueOf: (fieldId: string) => string | undefined
): string | null {
  const of = (role: IdentityRole) => {
    const field = fields.find((f) => f.identityRole === role);
    return field === undefined ? null : valueOf(field.fieldId)?.trim() || null;
  };

  return [of('given_name'), of('surname')].filter((part) => part !== null).join(' ') || of('nickname');
}

export const labelAad = (fieldId: string) => aad('form', 'field', fieldId, Field.EventFieldLabel, 1);
const helpAad = (fieldId: string) => aad('form', 'field', fieldId, Field.EventFieldHelp, 1);
export const optionsAad = (fieldId: string) => aad('form', 'field', fieldId, Field.EventFieldOptions, 1);

/*
 * Der Wert trägt eine andere Objektart als die Frage. Sonst liesse sich eine
 * Antwort an den Platz einer Beschriftung schieben — beide nennen dasselbe Feld.
 */
export const valueAad = (fieldId: string) => aad('form', 'value', fieldId, Field.EventAnswer, 1);

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

  /** 0093 — schreibt und berichtigt NUR der Mensch (die Kanzlei liest, ändert nie)? Vorgabe: nein. */
  readonly personOnly?: boolean;
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
      selfEdit: what.selfEdit ?? true,
      personOnly: what.personOnly ?? false
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

  /** 0093 — nur der Mensch schreibt und berichtigt. Fehlt es, bleibt es, wie es war. */
  readonly personOnly?: boolean;

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
      personOnly: e.personOnly ?? null,
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

  /**
   * 0093 — WPISUJE TYLKO OSOBA: die Kanzlei liest die Antwort, ändert sie aber
   * nie — weder berichtigen noch an ihrer Stelle eintragen (der Dienst lehnt es
   * ab).
   */
  readonly personOnly: boolean;

  /** Fragt der Link beim ersten Öffnen nach dieser Angabe (0046)? */
  readonly linkCheck: boolean;

  /**
   * 0086 — VOM FORMULAR GENOMMEN (wann): gefragt wird sie nicht mehr, ihre
   * Antworten bleiben. Nur die Kanzlei bekommt solche Fragen (`loadFields`).
   */
  readonly removedAt?: string | null;
}

/** 0086 — die Fragen, die das Formular stellt (ohne die vom Formular genommenen). */
export const asked = <F extends { readonly removedAt?: string | null }>(fields: readonly F[]): F[] =>
  fields.filter((f) => f.removedAt == null);

/** 0086 — die vom Formular genommenen: ihre Antworten stehen noch in den Zgłoszenia. */
export const takenOff = <F extends { readonly removedAt?: string | null }>(fields: readonly F[]): F[] =>
  fields.filter((f) => f.removedAt != null);

export const loadFields = (partId: string): Promise<{
  fields: readonly SealedField[];

  /** Aufbau und Logik (0043) — versiegelt, oder `null`, wenn das Formular eine Liste ist. */
  design: SealedDesign | null;
}> =>
  call(`/workspace/part/${encodeURIComponent(partId)}/fields`);

/**
 * WELCHE ANGABEN ein Link beim ersten Öffnen abfragt (0046) — für das ganze
 * Formular auf einmal. Leer: er fragt nichts. Gilt für Links, die ab jetzt
 * entstehen.
 */
export const setLinkCheck = (
  partId: string, fieldIds: readonly string[]
): Promise<{ partId: string; fieldIds: readonly string[] }> =>
  call(`/workspace/part/${encodeURIComponent(partId)}/linkcheck`, {
    method: 'POST',
    body: JSON.stringify({ fieldIds })
  });

/** Eine einzelne Frage aufmachen — für die Prüfung beim ersten Öffnen eines Links. */
export const openLabel = (fieldId: string, labelSealed: string, key: Uint8Array): Promise<string | null> =>
  quietly(() => openText(key, labelAad(fieldId), fromBase64Url(labelSealed)));

/**
 * Eine Frage entfernen. 0086 — hat schon jemand geantwortet, wird sie vom
 * Formular GENOMMEN (`kept`): niemand bekommt sie mehr, ihre Antworten bleiben
 * in den Zgłoszenia, und sie lässt sich zurückholen. Ohne Antworten ist sie weg.
 * Eine Frage eines eingeschalteten Wymaganie lehnt der Dienst ab.
 */
export const removeField = (fieldId: string): Promise<{ removed: boolean; kept?: boolean }> =>
  call(`/workspace/field/${encodeURIComponent(fieldId)}/remove`, { method: 'POST' });

/** 0086 — eine vom Formular genommene Frage zurückholen; sie wird wieder gestellt. */
export const restoreField = (fieldId: string): Promise<{ restored: boolean }> =>
  call(`/workspace/field/${encodeURIComponent(fieldId)}/restore`, { method: 'POST' });

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

  /**
   * WER ES AUSFÜLLT (0047): jeder (`public`), der Mensch über seinen Link als
   * Ergänzung seiner Einsendung (`person`), oder nur die Kanzlei (`office`) —
   * dann kommen weder Fragen noch Annahme heraus.
   */
  readonly audience: Audience;

  /** Welches Formular dieses ergänzt — `null` bei einem gewöhnlichen. */
  readonly extendsId: string | null;

  /** 0077 — wie oft eine Erweiterung je Mensch ausgefüllt wird (`rounds.ts`). Fehlt es: einmal. */
  readonly repeat?: Repeat;

  /** 0083 — wie es heisst (die Überschrift auf der Seite) — für den Ausdruck. */
  readonly title?: string | null;

  /** 0097 — sein Name: versiegelt unter dem Schlüssel seines Bereichs (dort liegen auch seine Fragen). */
  readonly nameAreaId?: string | null;
  readonly nameSealed?: string | null;
  readonly nameEpoch?: number | null;

  /** 0083 — was nach dem Absenden dasteht, und ob ein Ausdruck unterschrieben werden muss. */
  readonly after?: AfterSend | null;
}

/**
 * 0083 — NACH DEM ABSENDEN, eingestellt am Formular (Ustawienia):
 *
 * <code>
 *   title    statt „Zgłoszenie przyjęte."
 *   text     ein eigener Text darunter (mehrere Zeilen)
 *   paper    "always" — immer auf Papier unterschreiben; die Kennung einer
 *            Frage (Zgoda, Tak / nie) — dann, wenn sie angekreuzt ist
 *   signer   wer unterschreibt — unter der Linie auf dem Ausdruck
 * </code>
 */
export interface AfterSend {
  readonly title: string | null;
  readonly text: string | null;
  readonly paper: string | null;
  readonly signer: string | null;

  /** 0086 — was an die Adresse der Seite gehängt wird (`portalAt`): `?s=3`, `#zapisy`, `?part=<kennung>`. */
  readonly at?: string | null;
}

/** Wer ein Formular ausfüllt (0047). */
export type Audience = 'public' | 'person' | 'office';

export const AUDIENCE_LABEL: Record<Audience, string> = {
  public: 'każdy, kto je zobaczy',
  person: 'osoba — przez swój link, jako uzupełnienie zgłoszenia',
  office: 'tylko koordynator — osoba tego nie widzi'
};

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

/** Die AAD der symmetrischen Wertschlüsselhülle — eigen, siehe `Field`. */
export const officeValueAad = (fieldId: string) =>
  aad('form', 'value', fieldId, Field.OfficeValueKey, 1);

export async function quietly(todo: () => Promise<string>): Promise<string | null> {
  try { return await todo(); } catch { return null; }
}

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
