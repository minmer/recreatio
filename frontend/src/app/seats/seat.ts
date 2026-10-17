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

import { aad, Field, fromBase64Url, KEY_SIZE, open, seal, sha256, toBase64Url, unwrapKey, wrapKey } from '../core/crypto';
import { epochAad } from '../areas/area';
import type { Ring, SealedRole } from '../core/keys';
import { checkFor, sealLink, type CheckAnswer, type SeatChallenge } from './seatCheck';
import type { SeatFormSealed } from '../steps/steps';
import { pageLink } from './seatKeep';
import { loadIntake, openIntakeKey } from '../forms/intake';
import { nameKey, openSeatName, openWith, ringOrNull, seatOwnNameAad } from '../core/names';
import { call } from '../core/session';

/* -- Die Etiketten, an EINER Stelle ---------------------------------------- */

export const seatAad = (seatId: string) => aad('seat', 'access', seatId, Field.SeatKey, 1);

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
export const seatPath = (link: Link, under?: string | null, at?: string | null): string => {
  const tail = `${encodeURIComponent(link.token)}/${encodeURIComponent(link.key)}`;

  /*
   * DIE SEITE SELBST, mit dem Platz daran (`seatKeep.pageLink`) — nicht eine
   * eingebaute Portalansicht unter ihr. Der Link öffnet, was die Kanzlei als
   * Seite nach dem Absenden gewählt hat; die persönlichen Bausteine dort
   * zeigen, was diesem Menschen gehört. Ohne Seite bleibt die eigene Ansicht.
   */
  return under === undefined || under === null || under === ''
    ? `#/seat/${tail}`
    : pageLink(under, link.token, link.key, at);
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

  /** Wie der Mensch heisst — 0097: geöffnet von `loadSeats` (versiegelt unter dem Schlüssel dieses Bereichs, `nameSealed`). */
  readonly recipientName: string | null;
  readonly nameSealed?: string | null;
  readonly nameEpoch?: number | null;
  /** 0097 — seine eigene Kopie: in einem jawny Bereich die einzige (die Kanzlei öffnet sie über den Platzschlüssel). */
  readonly ownNameSealed?: string | null;

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

/**
 * Die Plätze eines Bereichs — mit geöffneten Namen (0097): die Kopie unter dem
 * Schlüssel des Bereichs, sonst (in einem jawny Bereich) die eigene des Platzes,
 * an die die Kanzlei über ihre Annahme kommt.
 */
export async function loadSeats(areaId: string): Promise<{ seats: readonly SeatRow[] }> {
  const got = await call<{ seats: readonly SeatRow[] }>(`/workspace/area/${encodeURIComponent(areaId)}/seats`);
  let intake: Promise<Uint8Array | null> | null = null;
  const intakeKey = () => (intake ??= (async () => {
    const ring = await ringOrNull();
    return ring === null ? null : openIntakeKey(await loadIntake(areaId), ring);
  })().catch(() => null));

  return {
    seats: await Promise.all(got.seats.map(async (row) => {
      let name = await openSeatName({ ...row, areaId });
      if (name === null && row.ownNameSealed != null) {
        const areaKey = row.origin === 'self' ? undefined : await nameKey(areaId, row.epoch).catch(() => undefined);
        const intakePrivate = row.origin === 'self' ? await intakeKey() : null;
        const seatKey = row.origin === 'self'
          ? (intakePrivate === null ? null : await officeSeatKey(row, new Uint8Array(0), intakePrivate))
          : (areaKey === undefined ? null : await officeSeatKey(row, areaKey));
        if (seatKey !== null) name = await openWith(seatKey, seatOwnNameAad(row.seatId), row.ownNameSealed);
      }
      return { ...row, recipientName: name };
    }))
  };
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
  row: Pick<SeatRow, 'seatId' | 'origin' | 'seatKeyForIntake' | 'seatKeyForArea'>, areaKey: Uint8Array, intakePrivate?: Uint8Array
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

/* 0097 — den vollen Namen an die Plätze schreiben: `seatNames.ts` `sealSeatNames` (versiegelt). */

export const revokeSeat = (seatId: string): Promise<{ revoked: boolean }> =>
  call(`/workspace/seat/${encodeURIComponent(seatId)}/revoke`, { method: 'POST' });

/* -- Was der Link öffnet ---------------------------------------------------- */

export interface Portal {
  readonly seatId: string;
  readonly areaId: string;
  readonly seatKeySealed: string;
  readonly epoch: number;

  /** 0097 — wie er heisst: unter dem Platzschlüssel (seine Kopie) und unter dem des Bereichs. */
  readonly ownNameSealed?: string | null;
  readonly nameSealed?: string | null;
  readonly nameEpoch?: number | null;
  /** 0095 — eine Person aus einem Link: der Name des Links (in einer Rozmowa in Klammern hinter ihrem). */
  readonly via?: string | null;
  readonly expiresAt: string | null;

  /** Was dieser Platz ausserdem aufschliesst — beim Schüler die Klasse. */
  readonly grants: readonly SeatGrant[];

  /** Was über diesen Platz eingesandt wurde — beim Firmling sein Formular. */
  readonly submitted: readonly SubmittedValue[];

  /** Was dieser Mensch noch tun muss (0047): Ergänzungen, die er ausfüllt, und Schritte. */
  readonly forms: readonly SeatFormSealed[];

  /**
   * 0091 — die Rollen, zu denen dieser Mensch gehört (die seines Formulars):
   * ihr Schlüssel unter dem Platzschlüssel (`null`: wartet noch) und der Weg
   * zu ihren Bereichen.
   */
  readonly roles: import('../roles/memberRole').SeatRoles;

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

/** Und aufmachen: der Platzschlüssel. Der Schlüssel dazu kommt aus dem Link, nicht vom Dienst. */
export const openPortal = (portal: Portal, linkKey: Uint8Array): Promise<Uint8Array> =>
  open(linkKey, seatAad(portal.seatId), fromBase64Url(portal.seatKeySealed));

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
  /** 0097 — geöffnet aus seiner eigenen Kopie (`loadMySeats` mit Bund). */
  readonly recipientName: string | null;
  readonly ownNameSealed?: string | null;
  readonly roleId: string;
  readonly seatKeySealed: string;
  readonly epoch: number;
  readonly status: string;
  readonly expiresAt: string | null;
  readonly grants: readonly SeatGrant[];
}

/** Meine Plätze — mit dem Bund auch ihre Namen (die eigene Kopie, unter dem Platzschlüssel, 0097). */
export async function loadMySeats(ring?: Ring | null): Promise<{ seats: readonly MySeat[] }> {
  const got = await call<{ seats: readonly Omit<MySeat, 'recipientName'>[] }>('/workspace/seats');
  return {
    seats: await Promise.all(got.seats.map(async (seat) => {
      if (ring == null || seat.ownNameSealed == null) return { ...seat, recipientName: null };
      /* Die dritte Verpackung: der RSA-Schlüssel der Rolle packt den Platzschlüssel aus — ohne den Link. */
      const seatKey = await quietly(async () => unwrapKey(await ring.wrapPrivate(seat.roleId), seatAad(seat.seatId), fromBase64Url(seat.seatKeySealed)));
      return { ...seat, recipientName: seatKey === null ? null : await openWith(seatKey, seatOwnNameAad(seat.seatId), seat.ownNameSealed) };
    }))
  };
}

/* -- Kleinkram -------------------------------------------------------------- */

/** Eine Hülle, die nicht aufgeht, ist ein Befund — kein Absturz. */
async function quietly<T>(todo: () => Promise<T>): Promise<T | null> {
  try { return await todo(); } catch { return null; }
}
