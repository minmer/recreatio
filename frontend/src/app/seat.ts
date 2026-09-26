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
import type { Ring, SealedRole } from './keys';
import type { PagePart } from './page';
import { checkFor, sealLink, type CheckAnswer, type SeatChallenge } from './seatCheck';
import type { SeatFormSealed } from './steps';
import { pageLink } from './seatKeep';
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
   * DIE SEITE SELBST, mit dem Platz daran (`seatKeep.pageLink`) — nicht eine
   * eingebaute Portalansicht unter ihr. Der Link öffnet, was die Kanzlei als
   * Seite nach dem Absenden gewählt hat; die persönlichen Bausteine dort
   * zeigen, was diesem Menschen gehört. Ohne Seite bleibt die eigene Ansicht.
   */
  return under === undefined || under === null || under === ''
    ? `#/seat/${tail}`
    : pageLink(under, link.token, link.key);
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

/*
   AUSSTELLEN VON HAND — FORT.

   Ein Platz entstand auf zwei Wegen: aus einer Einsendung, und weil die
   Kanzlei einen ausstellte. Der zweite war eine Verdopplung des ersten — wer
   ein Formular führt, sieht ohnehin jede Einsendung mitsamt Namen, Antworten
   und Link an EINER Stelle. Der Knopf daneben erzeugte einen Platz ohne
   Einsendung, den danach nur eine zweite Liste wiederfand.

   `openAsOffice` ist mitgegangen: es machte die Notizen EINER Zeile jener
   Liste auf. `officeSeatKey` darunter bleibt — die Kanzlei braucht es, um
   einen Link neu auszustellen.
*/

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

  /**
   * DER LINK, für die Kanzlei wieder lesbar (0046) — versiegelt unter dem
   * Platzschlüssel. `null` bei einem Platz von davor: dort gibt es nur einen
   * neuen (`relinkSeat`), und der alte hört dabei auf.
   */
  readonly linkSealed: string | null;

  /** Fragt der Link beim ersten Öffnen — und hat schon jemand richtig geantwortet? */
  readonly asks: boolean;
  readonly verifiedAt: string | null;

  /** Wonach er fragt — die Fragen, durch Kommas getrennt, in der Reihenfolge des Nachweises. */
  readonly verifyFields: string | null;

  /** Zu viele falsche Antworten — der Link ist zu; nur ein neuer hilft. */
  readonly locked: boolean;
}

export const loadSeats = (areaId: string): Promise<{ seats: readonly SeatRow[] }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/seats`);

export interface OpenedSeat {
  readonly personal: string | null;
  readonly internal: string | null;
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
  seatId: string, seatKey: Uint8Array,

  /**
   * Was der Link beim ersten Öffnen fragt (0046) — die Antworten, die die
   * Kanzlei gerade offen vor sich hat. Leer: er fragt nichts.
   */
  check: readonly CheckAnswer[] = []
): Promise<Link> {
  const { link, key: linkKey } = newLink();
  const asks = await checkFor(linkKey, seatId, check);

  await call(`/workspace/seat/${encodeURIComponent(seatId)}/relink`, {
    method: 'POST',
    body: JSON.stringify({
      tokenSha256: toBase64Url(await sha256(link.token)),
      seatKeySealed: toBase64Url(await seal(linkKey, seatAad(seatId), seatKey)),

      /* Der Link selbst, für die Kanzlei — damit sie ihn morgen noch einmal schicken kann. */
      linkSealed: await sealLink(seatId, seatKey, link),
      verifySha256: asks?.verifySha256 ?? null,
      verifyFields: asks?.verifyFields ?? null
    })
  });

  return link;
}

/**
 * EIN NEUER LINK, weil der Mensch seine Angaben geändert hat (0046) — von ihm
 * selbst, mit dem alten Link als Ausweis.
 *
 * <b>Warum überhaupt.</b> Der alte ist vielleicht an eine Nummer gegangen, die
 * gerade berichtigt wurde. Wer ihn dort findet, soll damit nicht mehr
 * hineinkommen. Der Platzschlüssel bleibt — nur die Hülle darum ist neu —,
 * und der neue Link liegt versiegelt für die Kanzlei bereit.
 */
export async function rotateSeat(token: string, seatId: string, seatKey: Uint8Array): Promise<Link> {
  const { link, key: linkKey } = newLink();

  await call(`/seat/${encodeURIComponent(token)}/rotate`, {
    method: 'POST',
    body: JSON.stringify({
      tokenSha256: toBase64Url(await sha256(link.token)),
      seatKeySealed: toBase64Url(await seal(linkKey, seatAad(seatId), seatKey)),
      linkSealed: await sealLink(seatId, seatKey, link)
    })
  });

  return link;
}

/**
 * Den vollen Namen an die Plätze schreiben — aus den Antworten, die die
 * Kanzlei gerade geöffnet hat. Der Dienst ERGÄNZT nur (ein leerer Name, oder
 * „Węglowski" → „Jan Węglowski"); einen von Hand gesetzten lässt er stehen.
 */
export const nameSeats = (names: readonly { seatId: string; name: string }[]): Promise<{ updated: number }> =>
  call('/workspace/seats/names', { method: 'POST', body: JSON.stringify({ names }) });

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

  /** Was dieser Mensch noch tun muss (0047): Ergänzungen, die er ausfüllt, und Schritte. */
  readonly forms: readonly SeatFormSealed[];

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
    /* Dieselben Zeilen wie eine Seite — samt `moduleId`, an dem die Fragen
       eines Bogens hängen. Sie hier ohne ihn zu beschreiben hiesse, ihn auf
       dem Weg durch das Portal zu verlieren. */
    readonly parts: readonly PagePart[];
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

  /** Aus welchem Formular (dem Baustein) — ein Platz kann mehrere tragen. */
  readonly formId: string;

  /** Unter welchem Schlüssel die FRAGE liegt (0042) — der des Formulars. */
  readonly labelAreaId: string;
  readonly labelEpoch: number;

  /** Die Auswahl, versiegelt wie die Frage — für eine Berichtigung. */
  readonly optionsSealed: string | null;

  /** Darf er die Antwort selbst berichtigen (0044)? Der Dienst prüft es ohnehin. */
  readonly selfEdit: boolean;

  /** Hat er die GANZE Einsendung durchgesehen und bestätigt (0046)? Je Einsendung derselbe Wert. */
  readonly confirmedAt: string | null;
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
export const loadPortal = (token: string): Promise<Portal | SeatChallenge> =>
  call(`/seat/${encodeURIComponent(token)}`);

/**
 * Wartet der Platz auf seine erste Bestätigung (0046)? Dann kam NICHTS, was
 * etwas aufschliesst — nur die Fragen.
 */
export const isChallenge = (reply: Portal | SeatChallenge): reply is SeatChallenge =>
  (reply as SeatChallenge).verify !== undefined;

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
