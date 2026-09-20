/**
 * Der individuelle Zugang — die Browserseite.
 *
 * <b>Jeder Platz hat SEINEN EIGENEN Schlüssel</b>, und der liegt dreifach
 * verpackt. Das ist der ganze Unterschied zum Altbestand, wo der Link den
 * Epochenschlüssel des Bereichs trug — damit hätte jeder Schüler jeden anderen
 * Platz geöffnet.
 *
 * <code>
 *   unter dem Linkschlüssel    der Mensch auf dem Platz
 *   unter der Epoche           die Kanzlei, auch später und als jemand anderes
 *   unter der Rolle (RSA)      derselbe Mensch, nachdem er gebunden hat
 * </code>
 *
 * <b>Der Link trägt ZWEI Geheimnisse, und sie tun Verschiedenes.</b>
 *
 * <code>
 *   token   geht an den Dienst und sagt, WELCHER Platz gemeint ist
 *   key     geht NIE an den Dienst; er öffnet den Platzschlüssel
 * </code>
 *
 * Eines aus dem anderen abzuleiten wäre kürzer und falsch: der Dienst bekäme
 * das Ableitungsgeheimnis zu sehen und könnte den Platz selbst öffnen. Beide
 * stehen hinter der Raute, also schickt sie der Browser ohnehin nur, wenn er
 * sie ausdrücklich schickt — und den zweiten schickt er nie.
 */

import {
  aad, Field, fromBase64Url, KEY_SIZE, open, openText, seal, sealText,
  sha256, toBase64Url, unwrapKey, wrapKey
} from './crypto';
import { epochAad } from './area';
import { newId } from './ids';
import type { Ring, SealedRole } from './keys';
import { call } from './session';

/* -- Die Etiketten, an EINER Stelle ---------------------------------------- */

export const seatAad = (seatId: string) => aad('seat', 'access', seatId, Field.SeatKey, 1);
export const personalAad = (seatId: string) => aad('seat', 'access', seatId, Field.SeatPersonalNote, 1);
export const internalAad = (seatId: string) => aad('seat', 'access', seatId, Field.SeatInternalNote, 1);

/* -- Der Link --------------------------------------------------------------- */

export interface Link {
  readonly token: string;
  readonly key: string;
}

/**
 * Was in den Link kommt.
 *
 * Beides zufällig und unabhängig. Der Abdruck des Tokens geht an den Dienst,
 * der Schlüssel nirgendwohin.
 */
export function newLink(): { link: Link; key: Uint8Array } {
  const key = crypto.getRandomValues(new Uint8Array(KEY_SIZE));

  return {
    link: {
      token: toBase64Url(crypto.getRandomValues(new Uint8Array(16))),
      key: toBase64Url(key)
    },
    key
  };
}

/**
 * Die Adresse, die verschickt wird.
 *
 * Beide Teile hinter der Raute: der Server einer statischen Seite sieht davon
 * nichts, und in seinem Protokoll steht nur, dass jemand die Startseite geholt
 * hat.
 */
export const seatPath = (link: Link, under?: string | null): string => {
  const tail = `${encodeURIComponent(link.token)}/${encodeURIComponent(link.key)}`;

  /*
   * Unter einer Seite liest sich die Adresse so, wie der Mensch sie erwartet:
   * erst seine Schule, dann sein Platz. Ohne Seite bleibt die allgemeine Form.
   */
  return under === undefined || under === null || under === ''
    ? `#/seat/${tail}`
    : `#/${under.split('/').map(encodeURIComponent).join('/')}/portal/${tail}`;
};

/* -- Was ein Platz AUSSERDEM aufschliesst ---------------------------------- */

export interface SeatGrant {
  readonly areaId: string;
  readonly areaName: string;
  readonly epoch: number;
  /** Der Epochenschlüssel jenes Bereichs, versiegelt unter dem PLATZSCHLÜSSEL. */
  readonly sealed: string;

  /**
   * Was dieser Schlüssel aufschliesst.
   *
   * Der Schlüssel allein nützt nichts: ohne die Kennung wüsste ein Schüler ohne
   * Konto nicht, WAS er damit öffnen kann — und fragen kann er nicht.
   */
  readonly calendars: readonly { calendarId: string; title: string; timeZone: string }[];
}

/**
 * Die gemeinsamen Schlüssel aufmachen.
 *
 * Der Weg ist immer derselbe — Link (oder Rolle) → Platzschlüssel → hier. Ein
 * zweiter Weg für denselben Zweck wäre eine zweite Gelegenheit, ihn falsch zu
 * bauen.
 */
export async function openGrants(
  grants: readonly SeatGrant[], seatKey: Uint8Array
): Promise<Map<string, { key: Uint8Array; epoch: number; name: string }>> {
  const out = new Map<string, { key: Uint8Array; epoch: number; name: string }>();

  for (const one of grants) {
    try {
      out.set(one.areaId, {
        key: await open(seatKey, epochAad(one.areaId, one.epoch), fromBase64Url(one.sealed)),
        epoch: one.epoch,
        name: one.areaName
      });
    } catch {
      // Aus einer anderen Epoche, oder beschädigt. Die übrigen bleiben lesbar.
    }
  }

  return out;
}

/* -- Ausstellen ------------------------------------------------------------- */

export interface NewSeat {
  readonly areaId: string;
  /** Der Epochenschlüssel dieses Bereichs — die Kanzlei hält ihn. */
  readonly areaKey: Uint8Array;
  readonly epoch: number;
  readonly ownerRoleId: string;

  /** Offen, damit der Ausstellende den Link zuordnen kann, BEVOR er ihn schickt. */
  readonly recipientName?: string;

  /** Was der Mensch auf dem Platz sieht. */
  readonly personalNote?: string;

  /** Was die Kanzlei über ihn führt. Er liest es nicht. */
  readonly internalNote?: string;

  readonly slugIds?: readonly string[];
  readonly days?: number;

  /**
   * Weitere Schlüssel, die dieser Platz tragen soll — beim Schüler der
   * KLASSENSCHLÜSSEL.
   *
   * Dadurch liest er das Gemeinsame, ohne den Schlüssel der Kanzlei zu
   * bekommen: die Notizen über ihn liegen im anderen Bereich und bleiben zu.
   */
  readonly shared?: readonly { areaId: string; areaKey: Uint8Array; epoch: number }[];
}

/**
 * Einen Platz ausstellen — der Fall des Lehrers und der Kanzlei.
 *
 * Gibt den LINK zurück. Er steht genau einmal hier: gespeichert ist nur sein
 * Abdruck, und wer ihn verliert, muss einen neuen ausstellen.
 */
export async function issueSeat(what: NewSeat): Promise<{ seatId: string; link: Link }> {
  const seatId = newId();
  const { link, key: linkKey } = newLink();

  // Der Platzschlüssel selbst. Er verlässt diesen Browser nur verpackt.
  const seatKey = crypto.getRandomValues(new Uint8Array(KEY_SIZE));

  const label = seatAad(seatId);

  const [forLink, forArea] = await Promise.all([
    seal(linkKey, label, seatKey),
    seal(what.areaKey, label, seatKey)
  ]);

  const personal = (what.personalNote ?? '').trim();
  const internal = (what.internalNote ?? '').trim();

  await call('/workspace/area/' + encodeURIComponent(what.areaId) + '/seat', {
    method: 'POST',
    body: JSON.stringify({
      seatId,
      tokenSha256: toBase64Url(await sha256(link.token)),
      seatKeySealed: toBase64Url(forLink),
      seatKeyForArea: toBase64Url(forArea),
      epoch: what.epoch,
      ownerRoleId: what.ownerRoleId,
      recipientName: what.recipientName ?? null,

      // Die persönliche Notiz unter dem PLATZ-, die interne unter dem
      // EPOCHENSCHLÜSSEL. Daran hängt, dass er die eine liest und die andere nicht.
      personalNoteSealed: personal === ''
        ? null
        : toBase64Url(await sealText(seatKey, personalAad(seatId), personal)),
      internalNoteSealed: internal === ''
        ? null
        : toBase64Url(await sealText(what.areaKey, internalAad(seatId), internal)),

      slugIds: what.slugIds ?? [],

      /* Der Klassenschlüssel, versiegelt unter dem Platzschlüssel. */
      grants: await Promise.all((what.shared ?? []).map(async (one) => ({
        areaId: one.areaId,
        epoch: one.epoch,
        sealed: toBase64Url(await seal(seatKey, epochAad(one.areaId, one.epoch), one.areaKey))
      }))),

      days: what.days ?? null
    })
  });

  return { seatId, link };
}

/* -- Die Kanzleisicht ------------------------------------------------------- */

export interface SeatRow {
  readonly seatId: string;
  readonly recipientName: string | null;

  /**
   * Der Weg der Kanzlei zum Platzschlüssel — GENAU EINER je Zeile (0027).
   *
   * <code>
   *   origin 'office'   seat_key_for_area     unter dem Epochenschlüssel
   *   origin 'self'     seat_key_for_intake   unter dem Annahmeschlüssel
   * </code>
   *
   * Der zweite Fall ist die Selbstanmeldung: dort liegt der Epochenschlüssel
   * offen (sonst wäre das Formular nicht lesbar gewesen), und unter ihm zu
   * versiegeln schützte nichts.
   */
  readonly seatKeyForArea: string | null;
  readonly seatKeyForIntake: string | null;
  readonly origin: 'office' | 'self';

  /** Die Seite, unter der dieser Platz hängt — für die Adresse eines neuen Links. */
  readonly under: string | null;

  readonly epoch: number;
  readonly personalNoteSealed: string | null;
  readonly internalNoteSealed: string | null;
  readonly status: string;
  readonly viewCount: number;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly holders: number;
}

export const loadSeats = (areaId: string): Promise<{ seats: readonly SeatRow[] }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/seats`);

export interface OpenedSeat {
  readonly personal: string | null;
  readonly internal: string | null;
}

/**
 * Einen Platz mit dem EPOCHENSCHLÜSSEL öffnen — die Kanzlei.
 *
 * Eine Hülle, die nicht aufgeht, ergibt `null` und keinen Absturz: ein
 * einzelner beschädigter Platz darf die Liste nicht leeren.
 */
export async function openAsOffice(
  row: SeatRow, areaKey: Uint8Array, intakePrivate?: Uint8Array
): Promise<OpenedSeat> {
  const seatKey = await officeSeatKey(row, areaKey, intakePrivate);
  if (seatKey === null) return { personal: null, internal: null };

  return {
    personal: await quietly(() => row.personalNoteSealed === null
      ? Promise.resolve(null)
      : openText(seatKey!, personalAad(row.seatId), fromBase64Url(row.personalNoteSealed))),

    internal: await quietly(() => row.internalNoteSealed === null
      ? Promise.resolve(null)
      : openText(areaKey, internalAad(row.seatId), fromBase64Url(row.internalNoteSealed)))
  };
}

/** Die Notizen setzen. Nur was genannt wird — siehe `Seat.NoteAsync`. */
export async function setNotes(
  seatId: string, areaKey: Uint8Array, seatKey: Uint8Array,
  what: { personal?: string; internal?: string }
): Promise<void> {
  await call(`/workspace/seat/${encodeURIComponent(seatId)}/note`, {
    method: 'POST',
    body: JSON.stringify({
      personalNoteSealed: what.personal === undefined
        ? null
        : toBase64Url(await sealText(seatKey, personalAad(seatId), what.personal)),
      internalNoteSealed: what.internal === undefined
        ? null
        : toBase64Url(await sealText(areaKey, internalAad(seatId), what.internal))
    })
  });
}

/**
 * Den Platzschlüssel aus der Kanzleihülle holen — der EINE Weg, den diese Zeile
 * hat.
 *
 * <b>Die Zeile sagt, welcher.</b> Aus „welches Feld ist gefüllt" darauf zu
 * schliessen ginge auch und wäre der Schluss statt der Angabe: wer eine dritte
 * Art Platz baut, müsste den Schluss mitpflegen.
 *
 * `null` statt eines Fehlers: ein einzelner Platz, der nicht aufgeht — eine
 * alte Epoche, ein fehlender Annahmeschlüssel — darf die Liste nicht leeren.
 */
export async function officeSeatKey(
  row: SeatRow, areaKey: Uint8Array, intakePrivate?: Uint8Array
): Promise<Uint8Array | null> {
  const label = seatAad(row.seatId);

  if (row.origin === 'self') {
    if (intakePrivate === undefined || row.seatKeyForIntake === null) return null;
    return quietly(() => unwrapKey(intakePrivate, label, fromBase64Url(row.seatKeyForIntake!)));
  }

  if (row.seatKeyForArea === null) return null;
  return quietly(() => open(areaKey, label, fromBase64Url(row.seatKeyForArea!)));
}

/**
 * Einen NEUEN Link auf denselben Platz — zum Verschicken.
 *
 * <b>Der alte ist nicht wiederzubekommen.</b> Gespeichert war nur sein Abdruck.
 * Wer sich selbst angemeldet hat, sah seinen Link genau einmal; ist er fort,
 * gibt es nur diesen Weg.
 *
 * <b>Der Platzschlüssel bleibt.</b> Er wird bloss neu verpackt — deshalb
 * behält der Mensch alles, was unter ihm liegt: seine eigenen Angaben, die
 * Notiz, die gemeinsamen Schlüssel. Ein neuer Platz wäre kürzer und falsch.
 *
 * <b>Der alte Link gilt danach nicht mehr.</b> Das ist der Zweck.
 */
export async function relinkSeat(
  seatId: string, seatKey: Uint8Array
): Promise<Link> {
  const { link, key: linkKey } = newLink();

  await call(`/workspace/seat/${encodeURIComponent(seatId)}/relink`, {
    method: 'POST',
    body: JSON.stringify({
      tokenSha256: toBase64Url(await sha256(link.token)),
      seatKeySealed: toBase64Url(await seal(linkKey, seatAad(seatId), seatKey))
    })
  });

  return link;
}

export const revokeSeat = (seatId: string): Promise<{ revoked: boolean }> =>
  call(`/workspace/seat/${encodeURIComponent(seatId)}/revoke`, { method: 'POST' });

/* -- Was der Link öffnet ---------------------------------------------------- */

export interface Portal {
  readonly seatId: string;
  readonly areaId: string;
  readonly seatKeySealed: string;
  readonly epoch: number;
  readonly recipientName: string | null;
  readonly personalNoteSealed: string | null;
  readonly expiresAt: string | null;

  /** Was dieser Platz ausserdem aufschliesst — beim Schüler die Klasse. */
  readonly grants: readonly SeatGrant[];

  /** Was über diesen Platz eingesandt wurde — beim Firmling sein Formular. */
  readonly submitted: readonly SubmittedValue[];

  /**
   * Die VORLAGE, aus der sich dieses Portal zeichnet (0028) — oder `null`.
   *
   * <b>Eine ganz gewöhnliche Seite.</b> Ihre Bausteine kommen über diesen Weg
   * und nicht über ihre Adresse: sie ist in der Regel intern (0026), und hier
   * ist der Link der Ausweis. Gezeichnet wird sie mit `PageParts`, wie jede
   * andere — dieselben Module, dasselbe Raster, derselbe Editor.
   *
   * `null` heisst: der Bereich hat keine eingerichtet. Dann zeigt das Portal
   * seine eingebaute Gestalt, und das ist kein Übergangszustand — ein Platz
   * ohne Vorlage soll trotzdem etwas zeigen.
   */
  readonly template: {
    readonly path: string;
    readonly title: string | null;
    readonly lead: string | null;
    readonly parts: readonly {
      readonly id: string;
      readonly kind: string;
      readonly layout: string;
      readonly config: string | null;
    }[];
  } | null;
}

/**
 * Eine eigene Antwort, wie der Platz sie zurückbekommt.
 *
 * <b>Drei Hüllen und drei verschiedene Schlüssel</b>, und das ist kein Zufall:
 *
 * <code>
 *   labelSealed      Epochenschlüssel des Bereichs   (die Frage — öffentlich)
 *   valueKeySealed   PLATZSCHLÜSSEL                  (mein Weg zum Wert)
 *   valueSealed      der Wertschlüssel darin         (die Antwort)
 * </code>
 *
 * Der Dienst hat keinen davon.
 */
export interface SubmittedValue {
  readonly fieldId: string;
  readonly kind: string;
  readonly position: number;
  readonly areaId: string;
  readonly epoch: number;
  readonly labelSealed: string;
  readonly valueSealed: string;
  readonly valueKeySealed: string;
  readonly submittedAt: string;

  /** Welche Einsendung — eine Berichtigung muss sagen, welche sie meint. */
  readonly registrationId: string;

  /** `null` heisst: noch nicht bestätigt. Ein echter Zustand (0030/0031). */
  readonly verifiedAt: string | null;
  readonly verifiedWay: 'sms' | 'self' | null;
}

/*
 * Aufgemacht werden sie in `form.ts` — dort liegen die Etiketten der Fragen
 * und Antworten. Hier steht nur, WAS der Platz zurückgibt; ein zweiter Satz
 * Etiketten wäre ein zweiter, der driften kann.
 */

/**
 * Den Platz holen — OHNE Konto.
 *
 * Nur das Token geht hinaus. Der Schlüssel bleibt hier.
 */
export const loadPortal = (token: string): Promise<Portal> =>
  call(`/seat/${encodeURIComponent(token)}`);

/** Und aufmachen. Der Schlüssel kommt aus dem Link, nicht vom Dienst. */
export async function openPortal(
  portal: Portal, linkKey: Uint8Array
): Promise<{ seatKey: Uint8Array; personal: string | null }> {
  const seatKey = await open(linkKey, seatAad(portal.seatId), fromBase64Url(portal.seatKeySealed));

  const personal = portal.personalNoteSealed === null
    ? null
    : await quietly(() => openText(seatKey, personalAad(portal.seatId),
        fromBase64Url(portal.personalNoteSealed!)));

  return { seatKey, personal };
}

/* -- Binden ----------------------------------------------------------------- */

/**
 * Den Platz an eine PERSON binden.
 *
 * <b>Welche Person, wird gefragt und nicht geraten.</b> Ein Elternteil mit zwei
 * Kindern öffnet zwei Links; ohne diese Frage landeten beide bei derselben
 * Person — und weil die Angaben trotzdem aufgingen, fände es niemand heraus.
 *
 * Verpackt wird unter dem ÖFFENTLICHEN Schlüssel der Rolle: wer bindet, braucht
 * dafür kein Geheimnis des Gebundenen, und der Dienst könnte die Hülle nicht
 * herstellen.
 */
export async function bindSeat(
  token: string, seatId: string, seatKey: Uint8Array, person: SealedRole
): Promise<void> {
  const wrapped = await wrapKey(fromBase64Url(person.wrapPublicKey), seatAad(seatId), seatKey);

  await call(`/seat/${encodeURIComponent(token)}/bind`, {
    method: 'POST',
    body: JSON.stringify({ roleId: person.id, seatKeySealed: toBase64Url(wrapped) })
  });
}

export interface MySeat {
  readonly seatId: string;
  readonly areaId: string;
  readonly areaName: string;
  readonly recipientName: string | null;
  readonly roleId: string;
  readonly seatKeySealed: string;
  readonly epoch: number;
  readonly personalNoteSealed: string | null;
  readonly status: string;
  readonly expiresAt: string | null;
  readonly grants: readonly SeatGrant[];
}

export const loadMySeats = (): Promise<{ seats: readonly MySeat[] }> =>
  call('/workspace/seats');

/**
 * Einen gebundenen Platz öffnen — OHNE den Link.
 *
 * Genau dafür gibt es die dritte Verpackung: der RSA-Schlüssel der Rolle packt
 * den Platzschlüssel aus. Ohne sie wäre das Binden ein Eintrag in einer Liste
 * und sonst nichts.
 */
export async function openMine(seat: MySeat, ring: Ring): Promise<string | null> {
  const seatKey = await unwrapKey(
    await ring.wrapPrivate(seat.roleId),
    seatAad(seat.seatId),
    fromBase64Url(seat.seatKeySealed)
  );

  if (seat.personalNoteSealed === null) return null;

  return quietly(() => openText(seatKey, personalAad(seat.seatId),
    fromBase64Url(seat.personalNoteSealed!)));
}

/* -- Kleinkram -------------------------------------------------------------- */

/** Eine Hülle, die nicht aufgeht, ist ein Befund — kein Absturz. */
async function quietly<T>(todo: () => Promise<T>): Promise<T | null> {
  try { return await todo(); } catch { return null; }
}
