/**
 * Einsendungen: absenden, laden, öffnen (und dabei den RSA-Umschlag ablösen), über Bereiche hinweg lesen.
 */

import { KEY_SIZE, fromBase64Url, open, openText, seal, sealText, toBase64Url, unwrapKey, wrapKey } from '../core/crypto';
import { newId } from '../core/ids';
import { nameKey, nameText, sealName, seatNameAad, seatOwnNameAad } from '../core/names';
import { call } from '../core/session';
import { type Link, type SubmittedValue, newLink, seatAad } from '../seats/seat';
import { sealLink } from '../seats/seatCheck';
import { type FormArea, type SealedField, labelAad, officeValueAad, optionsAad, quietly, valueAad } from './form';
import { type ValueCheck, sha256Of } from './valueCheck';

/* -- Einsenden -------------------------------------------------------------- */

/** 0097 — der Name an einem neuen Platz: seine Kopie (Platzschlüssel), und die der Kanzlei, wenn der Schlüssel da ist. */
async function sealedSeatName(
  seatId: string, seatKey: Uint8Array, at: { readonly areaId: string; readonly epoch: number; readonly recipientName?: string }
): Promise<{ ownNameSealed?: string; nameSealed?: string; nameEpoch?: number }> {
  const name = nameText(at.recipientName ?? '');
  if (name === '') return {};
  const own = await sealName(seatKey, seatOwnNameAad(seatId), name);
  const areaKey = await nameKey(at.areaId, at.epoch).catch(() => undefined);
  return areaKey === undefined
    ? { ownNameSealed: own }
    : { ownNameSealed: own, nameSealed: await sealName(areaKey, seatNameAad(seatId), name), nameEpoch: at.epoch };
}

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

  /**
   * DIE ERGÄNZUNG (0047): welche Einsendung dieses Formular erweitert. Nur mit
   * `seat` — der Mensch ergänzt über SEINEN Link seine eigene Einsendung.
   */
  readonly baseRegistrationId?: string;

  /** 0077 — bei einer WIEDERKEHRENDEN Ergänzung: der laufende Zeitraum (`roundOf`). */
  readonly round?: string;
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
       * DER LINK, für die Kanzlei wieder lesbar (0046). Er fragt beim ersten
       * Öffnen NICHTS: wer sich hier anmeldet, hat die Angaben eben selbst
       * getippt. Einen fragenden Link stellt die Kanzlei aus, wenn sie ihn
       * verschickt (`relinkSeat`) — erst dort kann er bei der falschen
       * Nummer landen.
       */
      linkSealed: await sealLink(mine.seatId, mine.seatKey, mine.link),

      /*
       * DER WEG DER KANZLEI — unter der Annahme und NICHT unter der Epoche.
       * Der Epochenschlüssel liegt bei einem öffentlichen Formular offen; unter
       * ihm zu versiegeln schützte nichts (0027).
       */
      seatKeyForIntake: toBase64Url(await wrapKey(publicKey, label, mine.seatKey)),

      areaId: to.selfSeat.areaId,
      epoch: to.selfSeat.epoch,

      /*
       * 0097 — WIE ER HEISST, NIE OFFEN: unter dem eigenen Platzschlüssel (er
       * liest ihn in seinem Portal), und — nur wenn dieser Browser den Schlüssel
       * des Bereichs hat — unter diesem; sonst versiegelt die Kanzlei ihn, sobald
       * sie die Einsendung aufmacht. Ein offener Schlüssel nimmt der Dienst nicht.
       */
      ...await sealedSeatName(mine.seatId, mine.seatKey, to.selfSeat),
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
        seat,
        baseRegistrationId: to.baseRegistrationId ?? null,
        round: to.round ?? null
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

  /** Der Mensch hat seine GANZE Einsendung durchgesehen und bestätigt (0046). */
  readonly confirmedAt: string | null;

  /** Bei einer Ergänzung (0047): die Einsendung, die sie erweitert. */
  readonly baseId: string | null;

  /** 0077 — bei einer wiederkehrenden Erweiterung: für welchen Zeitraum (`''` sonst). */
  readonly round?: string;

  /** 0077 — die Kanzlei hat eingetragen (jemanden auf die Liste, oder eine Erweiterung für ihn). */
  readonly byOffice?: boolean;

  /**
   * Was diese Einsendung ergänzt — je Erweiterung EINE Zeile: bei einer
   * wiederkehrenden (0077) die JÜNGSTE, mit ihrem Zeitraum (`round`) und der
   * Zahl aller (`rounds`).
   */
  readonly extensions: readonly {
    readonly moduleId: string;
    readonly registrationId: string;
    readonly submittedAt: string;
    readonly confirmedAt: string | null;
    readonly round?: string;
    readonly rounds?: number;
  }[];

  /** Welche von Hand angelegten Schritte abgehakt sind (0047). */
  readonly marks: readonly StepMark[];

  /** 0098 — was er zu den Aufgaben gesagt hat, und an welchen Tagen er sie getan hat. */
  readonly tasks?: readonly import('../steps/steps').TaskState[];
}

/** Ein abgehakter Schritt (0047). */
export interface StepMark {
  readonly stepId: string;
  readonly doneAt: string;
  readonly byPerson: boolean;

  /** 0100 — bei „Wybierz termin": der Termin, den der Platz hält (wartend: `pending`). */
  readonly booking?: { readonly status: 'pending' | 'confirmed'; readonly startsAt: string; readonly endsAt: string };

  /** 0102 — bei „Przeczytaj wiadomości": der Haken steht nur, solange nichts Ungelesenes liegt. */
  readonly chat?: { readonly unread: number };
}

export const loadRegistrations = (
  partId: string, withHidden = false,

  /** 0077 — nur ein Abschnitt der Zeit einer wiederkehrenden Erweiterung (beide einschliesslich). */
  range?: { readonly from: string; readonly to: string }
): Promise<{ registrations: readonly Submission[] }> => {
  const q = new URLSearchParams();
  if (withHidden) q.set('hidden', '1');
  if (range !== undefined) { q.set('from', range.from); q.set('to', range.to); }
  const tail = q.toString();
  return call(`/workspace/part/${encodeURIComponent(partId)}/registrations${tail === '' ? '' : `?${tail}`}`);
};

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
  submission: Submission, keys: readonly IntakeKey[], areaOf: ReadonlyMap<string, string>,

  /**
   * 2026-10-17 — Annahmen ANDERER Bereiche, die dieser Bund öffnet. Eine
   * Berichtigung über den Link wurde eine Zeit lang für die Annahme des
   * Bereichs des PLATZES verpackt, nicht für die ihrer Frage; mit dem Schlüssel
   * ihres Bereichs geht sie nicht auf. Probiert wird nur, was sonst zu bliebe —
   * und umgestellt unter den Amtsschlüssel des Bereichs der Frage.
   */
  spare: readonly IntakeKey[] = []
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

  for (const value of submission.values) {
    if (values.has(value.fieldId) || value.wrappedKey == null || spare.length === 0) continue;
    const label = valueAad(value.fieldId);
    const own = keys.find((k) => k.areaId === areaOf.get(value.fieldId));

    for (const other of spare) {
      const key = await quiet(() => unwrapKey(other.privateKey, label, fromBase64Url(value.wrappedKey!)));
      if (key === null) continue;
      const text = await quiet(() => openText(key, label, fromBase64Url(value.sealed)));
      if (text === null) continue;

      values.set(value.fieldId, text);
      if (value.officeKeySealed == null && own?.officeKey !== undefined) {
        toRewrap.push({
          fieldId: value.fieldId,
          officeKeySealed: toBase64Url(await seal(own.officeKey, officeValueAad(value.fieldId), key))
        });
      }
      break;
    }
  }

  return { values, toRewrap };
}

/** Wie `quietly`, aber für Bytes: eine Hülle, die nicht aufgeht, ist `null`. */
async function quiet<T>(todo: () => Promise<T>): Promise<T | null> {
  try { return await todo(); } catch { return null; }
}

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
