/**
 * Bereiche — die Schlüssel, und wer sie hält.
 *
 * <b>Ein Bereich ist ein benannter Schlüssel mit Epochen.</b> Er gehört keiner
 * Organisation und keiner Seite: er steht für sich. Rollen halten ihn, Seiten
 * zeigen, was unter ihm liegt — drei Achsen, von denen keine die andere besitzt.
 *
 * <b>Der Schlüssel entsteht HIER, im Browser.</b> Der Dienst bekommt ihn nur
 * verpackt zu sehen, und was er ablegt, kann er nicht öffnen. Deshalb wird auch
 * die Kennung hier gemacht: die AAD des Epochenschlüssels nennt den Bereich, und
 * ohne die Kennung vorher gäbe es nichts, worauf sie lauten könnte.
 *
 * <b>Zwei Zertifikate, nicht eines.</b> `admin` und `certify` stehen
 * NEBENEINANDER (Kernel 3.5) und nicht übereinander. Ein Bereich mit nur `admin`
 * wäre einer, in den nie jemand hineingelassen werden kann — auch nicht von dem,
 * der ihn angelegt hat.
 *
 * <b>Was der Browser nach einem Neuladen tut.</b> Der Epochenschlüssel lebt im
 * Speicher des Tabs. Ist er fort, wird er aus der eigenen Zuteilung
 * zurückgeholt (`myEpochKeys`) — mit dem RSA-Schlüssel der Rolle, den nur dieser
 * Browser hat. Ohne diesen Weg wäre „Epoche offenlegen" eine Fähigkeit, die nur
 * in der Sitzung besteht, in der der Bereich entstand.
 */

import { certificateValue } from './access';
import {
  aad, Field, fromBase64Url, KEY_SIZE, signCanonical, toBase64Url, unwrapKey, wrapKey
} from './crypto';
import { newId } from './ids';
import type { Ring, SealedRole } from './keys';
import { call, WorkspaceError } from './session';

/**
 * Die AAD des Epochenschlüssels — an EINER Stelle, wie in `keys.ts`.
 *
 * Offen, weil derselbe Schlüssel an mehreren Orten verpackt liegt: an der Rolle
 * (`key_grant`) und am Platz (`access_grant`). Dieselbe Sache, dasselbe
 * Etikett — die AAD sagt, WAS versiegelt ist, nicht unter welchem Schlüssel.
 */
export const epochAad = (areaId: string, epoch: number) =>
  aad('keys', 'area_epoch', areaId, Field.AreaEpochKey, epoch);

/** Was von aussen geht (0035). `none` heisst: nichts. */
export const PUBLIC_LEVELS = ['none', 'read', 'write'] as const;
export type PublicLevel = (typeof PUBLIC_LEVELS)[number];

/** Was jemand sieht, der über ein FORMULAR hereinkommt (0035). */
export const SEAT_LEVELS = ['own', 'read', 'write'] as const;
export type SeatLevel = (typeof SEAT_LEVELS)[number];

export interface AreaRow {
  readonly areaId: string;
  readonly name: string;
  readonly currentEpoch: number;

  /**
   * Wie viele Epochen ich ÖFFNEN kann — und wie viele offenliegen.
   *
   * Zwei verschiedene Dinge, deshalb getrennt. Ein Bereich, den ich lesen darf,
   * dessen Schlüssel ich aber nicht habe, ist kein Fehler: er heisst „vor
   * deiner Zeit".
   */
  readonly heldEpochs: number;
  readonly publishedEpochs: number;

  /**
   * Worin er liegt — `null` heisst: ganz aussen (0035).
   *
   * <b>Eine Ordnung der Bereiche, nicht der Menschen.</b> Jeder Bereich hat
   * seine eigenen Rollen: aussen zu stehen gibt innen nichts, und wer innen
   * steht, muss aussen nicht stehen.
   */
  readonly parentAreaId: string | null;

  readonly publicLevel: PublicLevel;
  readonly seatLevel: SeatLevel;

  /**
   * Was ICH hier darf — damit die Oberfläche keinen Knopf anbietet, der beim
   * Drücken 403 sagt. `null` heisst: gar nichts (dann stünde er aber auch
   * nicht in der Liste).
   */
  readonly myLevel: 'read' | 'write' | 'admin' | null;

  /** `certify` steht NEBEN der Leiter (3.5) — darum eigens. */
  readonly mayCertify: boolean;
}

export interface Member {
  readonly roleId: string;
  readonly kind: 'account' | 'person' | 'role' | 'group';
  readonly wrapPublicKey: string;

  /** Alle Stufen dieser Rolle — `read`/`write`/`admin` und/oder `certify`. */
  readonly capabilities: readonly string[];
}

/* -- Die Ordnung, in der sie liegen ---------------------------------------

   Zwei Fragen an denselben Baum, und beide gehoeren hierher und nicht in die
   Zeichnung: sie rechnen, sie zeichnen nichts. Dort waeren sie nur von dort
   aus zu pruefen — und ein Kreis in einer Elternkette haengt den ganzen Tab
   auf, lange bevor jemand ihn sieht.
   ------------------------------------------------------------------------ */

/**
 * Die Bereiche in der Ordnung, in der sie liegen — `Parafia > Msza > Ofiary`.
 *
 * <b>Flach gezeichnet, mit Einzug.</b> Verschachtelte Listen wären hier eine
 * zweite Struktur neben `parent_area_id`, und zwei Strukturen laufen
 * auseinander. Die Tiefe steht deshalb an der Zeile, nicht im Markup.
 *
 * <b>Wessen Vater nicht dabei ist, steht ganz aussen.</b> Das ist kein Fehler,
 * sondern der Normalfall für jemanden, der den inneren Bereich lesen darf und
 * den äusseren nicht: der äussere kommt in seiner Liste gar nicht vor. Ihn als
 * „fehlt" zu zeigen verriete, dass es ihn gibt.
 */
/**
 * Der Vater, SOWEIT ER ZU SEHEN IST — sonst keiner.
 *
 * <b>Die eine Stelle, an der das entschieden wird.</b> Wer den inneren Bereich
 * lesen darf und den äusseren nicht, bekommt den äusseren gar nicht erst in
 * seine Liste. Für ihn liegt der innere ganz aussen, und das ist die Wahrheit,
 * die er sehen soll.
 *
 * <b>Zweimal entschieden wäre es zweimal anders.</b> Die eingerückte Liste und
 * der Weg im Kopf sind zwei Antworten auf dieselbe Frage; rechnete jede für
 * sich, sähe derselbe Bereich an zwei Stellen verschieden tief aus.
 */
export const parentInSight = (
  areas: readonly AreaRow[], area: AreaRow
): string | null =>
  area.parentAreaId !== null && areas.some((a) => a.areaId === area.parentAreaId)
    ? area.parentAreaId
    : null;

/** Die Bereiche, die neben diesem liegen — unter demselben sichtbaren Vater. */
export const besideIt = (
  areas: readonly AreaRow[], area: AreaRow
): readonly AreaRow[] => {
  const mine = parentInSight(areas, area);

  return areas.filter((other) =>
    other.areaId !== area.areaId && parentInSight(areas, other) === mine);
};

export function inOrder(areas: readonly AreaRow[]): readonly { area: AreaRow; depth: number }[] {
  const out: { area: AreaRow; depth: number }[] = [];

  const under = (parent: string | null, depth: number) => {
    for (const area of areas) {
      if (parentInSight(areas, area) !== parent) continue;

      out.push({ area, depth });
      under(area.areaId, depth + 1);
    }
  };

  under(null, 0);
  return out;
}

/**
 * Die Kette vom äussersten Bereich bis zu diesem.
 *
 * <b>Sie bricht ab, wo der Vater fehlt</b> — und das ist kein Fehler, sondern
 * der Normalfall für jemanden, der den inneren Bereich lesen darf und den
 * äusseren nicht: der äussere kommt in seiner Liste gar nicht vor. Ihn als
 * Lücke zu zeigen verriete, dass es ihn gibt.
 *
 * <b>Und sie hält an, wenn sie sich beisst.</b> Der Dienst verhindert Kreise
 * (`ck_area_not_self`, `WouldLoopAsync`), aber eine Ansicht, die sich darauf
 * verlässt, hängt den ganzen Tab auf, sobald es einmal nicht stimmt.
 */
export function chainTo(areas: readonly AreaRow[], areaId: string): readonly AreaRow[] {
  const byId = new Map(areas.map((a) => [a.areaId, a]));
  const out: AreaRow[] = [];
  const seen = new Set<string>();

  let at: string | null = areaId;

  while (at !== null && !seen.has(at)) {
    seen.add(at);

    const here: AreaRow | undefined = byId.get(at);
    if (here === undefined) break;

    out.unshift(here);
    at = here.parentAreaId;
  }

  return out;
}

export const loadAreas = (): Promise<{ areas: readonly AreaRow[] }> =>
  call<{ areas: readonly AreaRow[] }>('/workspace/areas');

export const loadMembers = (areaId: string): Promise<{ areaId: string; members: readonly Member[] }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/members`);

/**
 * Ein OFFENGELEGTER Epochenschlüssel — ohne Konto.
 *
 * Damit öffnet ein Besucher, was offen sein soll: die Beschriftungen eines
 * Formulars, die Titel im Schaukasten. Wer nichts offengelegt hat, bekommt 404
 * — und das ist dann kein öffentliches Formular.
 */
export const loadPublicKey = (
  areaId: string
): Promise<{ areaId: string; epoch: number; key: string }> =>
  call(`/area/${encodeURIComponent(areaId)}/key`);

/* -- Ein Zertifikat, hier unterschrieben ----------------------------------- */

const YEAR_IN_SECONDS = 365 * 24 * 60 * 60;

export type Capability = 'read' | 'write' | 'admin' | 'certify';

/**
 * Ein Zertifikat auf einen BEREICH.
 *
 * `scopeKind: 'area'` ist nicht beiläufig: der Dienst prüft die Unterschrift
 * über genau diese Bytes. Stünde hier `slug`, wäre die Unterschrift über etwas
 * anderes gerechnet als über das, was geprüft wird — und der Dienst lehnte ab,
 * ohne sagen zu können, warum.
 */
export async function signedCertificate(ring: Ring, what: {
  issuerRoleId: string;
  subjectRoleId: string;
  areaId: string;
  capability: Capability;
}) {
  const id = newId();
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + YEAR_IN_SECONDS;

  const value = certificateValue({
    capability: what.capability,
    expiresAt,
    id,
    issuedAt,
    issuedByRoleId: what.issuerRoleId,
    scopeId: what.areaId,
    scopeKind: 'area',
    subjectRoleId: what.subjectRoleId
  });

  const signature = await signCanonical(await ring.signKey(what.issuerRoleId), value);

  return { id, capability: what.capability, issuedAt, expiresAt, signature: toBase64Url(signature) };
}

/* -- Anlegen ---------------------------------------------------------------- */

/**
 * Einen Bereich anlegen.
 *
 * Gibt den Epochenschlüssel zurück — der Aufrufer braucht ihn, wenn er gleich
 * darauf etwas versiegeln oder ihn offenlegen will. Er ist NICHT vom Dienst zu
 * bekommen; der hat nur die Hülle.
 */
export async function createArea(
  ring: Ring, person: SealedRole, name: string, parentAreaId?: string
): Promise<{ areaId: string; epoch: number; key: Uint8Array }> {
  const areaId = newId();
  const key = crypto.getRandomValues(new Uint8Array(KEY_SIZE));

  const wrapped = await wrapKey(fromBase64Url(person.wrapPublicKey), epochAad(areaId, 1), key);

  await call('/workspace/area', {
    method: 'POST',
    body: JSON.stringify({
      areaId,
      name: name.trim(),
      roleId: person.id,

      /* Worin er liegt — `undefined` heisst: ganz aussen (0035). */
      parentAreaId: parentAreaId ?? null,
      wrappedKey: toBase64Url(wrapped),
      certificates: [
        await signedCertificate(ring, {
          issuerRoleId: person.id, subjectRoleId: person.id, areaId, capability: 'admin'
        }),
        await signedCertificate(ring, {
          issuerRoleId: person.id, subjectRoleId: person.id, areaId, capability: 'certify'
        })
      ]
    })
  });

  return { areaId, epoch: 1, key };
}

/* -- Den eigenen Schlüssel zurückholen ------------------------------------- */

interface SealedEpoch {
  readonly roleId: string;
  readonly epoch: number;
  readonly sealedBlob: string;
}

/**
 * Die Epochenschlüssel, die meine Rollen halten — ausgepackt.
 *
 * <b>Eine Hülle, die nicht aufgeht, beendet nicht den Lauf.</b> Sie wird
 * übergangen, wie im Bund: ein einzelner kaputter Eintrag darf nicht dazu
 * führen, dass ein Bereich aussieht, als hielte man ihn gar nicht.
 */
export async function myEpochKeys(ring: Ring, areaId: string): Promise<Map<number, Uint8Array>> {
  const { keys } = await call<{ keys: readonly SealedEpoch[] }>(
    `/workspace/area/${encodeURIComponent(areaId)}/keys`);

  const out = new Map<number, Uint8Array>();

  // Je Rolle EINMAL auspacken: der RSA-Schlüssel wird sonst je Epoche neu
  // geöffnet, und das ist der teure Teil.
  const privates = new Map<string, Uint8Array>();

  for (const held of keys) {
    if (out.has(held.epoch)) continue;

    try {
      let key = privates.get(held.roleId);
      if (key === undefined) {
        key = await ring.wrapPrivate(held.roleId);
        privates.set(held.roleId, key);
      }

      out.set(held.epoch, await unwrapKey(
        key, epochAad(areaId, held.epoch), fromBase64Url(held.sealedBlob)));
    } catch {
      // Nicht für uns, oder beschädigt. Beides ist ein Befund und kein Absturz.
    }
  }

  return out;
}

/* -- Offenlegen ------------------------------------------------------------- */

/**
 * Eine Epoche offenlegen.
 *
 * <b>Das ist es, was „öffentlich" auf dieser Plattform heisst.</b> Kein
 * Schalter an einem Eintrag, sondern ein Schlüssel, der offenliegt — und damit
 * gilt es für ALLES, was je unter dieser Epoche versiegelt wurde. Es lässt sich
 * nicht zurücknehmen: wer den Schlüssel einmal geholt hat, hat ihn.
 */
export const publishEpoch = (
  areaId: string, epoch: number, key: Uint8Array
): Promise<{ areaId: string; epoch: number; published: boolean }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/publish`, {
    method: 'POST',
    body: JSON.stringify({ epoch, key: toBase64Url(key) })
  });

/* -- Weitergeben ------------------------------------------------------------ */

/**
 * Einem anderen den Schlüssel geben — und das Recht dazu.
 *
 * Beides zusammen, in einem Aufruf. Getrennt entstünde entweder ein Recht ohne
 * Schlüssel („darf, kann nicht") oder ein Schlüssel ohne Recht („kann, darf
 * nicht"), und beides sieht von aussen wie ein Fehler der Plattform aus.
 */
export async function grantTo(
  ring: Ring,
  areaId: string,
  epoch: number,
  key: Uint8Array,
  member: Member,
  issuerRoleId: string,
  capability: Capability = 'write'
): Promise<void> {
  const wrapped = await wrapKey(fromBase64Url(member.wrapPublicKey), epochAad(areaId, epoch), key);

  await call(`/workspace/area/${encodeURIComponent(areaId)}/grant`, {
    method: 'POST',
    body: JSON.stringify({
      roleId: member.roleId,
      epoch,
      wrappedKey: toBase64Url(wrapped),
      issuerRoleId,
      certificate: await signedCertificate(ring, {
        issuerRoleId, subjectRoleId: member.roleId, areaId, capability
      })
    })
  });
}

/**
 * Eine Rolle in den Bereich aufnehmen — mit JEDEM Schlüssel, den ich halte.
 *
 * <b>Alle Epochen, nicht nur die jetzige.</b> Was unter einer früheren
 * versiegelt wurde, bliebe der neuen Rolle sonst verschlossen, obwohl sie
 * im Bereich steht. Der Dienst nimmt je Epoche eine Zuteilung und ein
 * Zertifikat; bei den meisten Bereichen ist es genau eine.
 *
 * <b>Kein Umweg über den äusseren Bereich.</b> Jeder Bereich hat seine
 * eigenen Rollen; wer innen steht, muss aussen nicht stehen.
 */
export async function joinArea(
  ring: Ring,
  areaId: string,
  role: { readonly id: string; readonly kind: Member['kind']; readonly wrapPublicKey: string },
  issuerRoleId: string,
  capability: 'read' | 'write' | 'admin'
): Promise<void> {
  const keys = await myEpochKeys(ring, areaId);

  if (keys.size === 0) {
    throw new WorkspaceError('Nie masz klucza tego obszaru — nie możesz nikogo dodać.');
  }

  const member: Member = { roleId: role.id, kind: role.kind, wrapPublicKey: role.wrapPublicKey, capabilities: [] };

  for (const [epoch, key] of [...keys].sort(([a], [b]) => a - b)) {
    await grantTo(ring, areaId, epoch, key, member, issuerRoleId, capability);
  }
}

/* -- Die Gestalt eines Bereichs (0035) ------------------------------------- */

/**
 * Wie weit der Bereich nach aussen offen steht.
 *
 * <b>Absicht und Schlüssel gehen zusammen hinaus.</b> Lesen von aussen ist
 * keine Erlaubnis, sondern ein SCHLÜSSEL: wer ihn hat, liest. Wer öffnet,
 * schickt ihn deshalb mit; wer schliesst, nimmt ihn zurück.
 *
 * <b>Zurücknehmen macht nichts ungeschehen.</b> Wer den Schlüssel gelesen hat,
 * hat ihn — es endet der Zugriff auf das, was DANACH kommt. Solange es keine
 * Epochenrotation gibt, gilt das ohne Einschränkung, und die Oberfläche sagt es.
 */
export const setPublicLevel = (
  areaId: string, level: PublicLevel, key?: Uint8Array
): Promise<{ areaId: string; publicLevel: PublicLevel }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/public`, {
    method: 'POST',
    body: JSON.stringify({
      level,
      key: key === undefined ? null : toBase64Url(key)
    })
  });

/**
 * Was jemand sieht, der über ein Formular hereinkommt — ausser seinem Eigenen.
 *
 * Das Eigene ist nie die Frage: seine Einsendung gehört ihm. Hier geht es um
 * das Gemeinsame, und es entscheidet der Bereich, nicht das Formular.
 */
export const setSeatLevel = (
  areaId: string, level: SeatLevel
): Promise<{ areaId: string; seatLevel: SeatLevel }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/seat-level`, {
    method: 'POST',
    body: JSON.stringify({ level })
  });

/**
 * Eine Rolle wieder hinausnehmen.
 *
 * Nur aus DIESEM Bereich: in einem inneren bleibt sie stehen, denn jeder
 * Bereich hat seine eigenen Rollen. Was die Rolle schon gelesen hat, bleibt
 * bei ihr; `note` sagt das.
 */
export const dropFromArea = (
  areaId: string, roleId: string
): Promise<{ areaId: string; roleId: string; dropped: boolean; note: string }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/drop`, {
    method: 'POST',
    body: JSON.stringify({ roleId })
  });

/* -- Die Portalseite eines Bereichs (0028) --------------------------------- */

/**
 * Welche Seite das Portal dieses Bereichs zeichnet — und unter welcher Adresse
 * seine Links stehen.
 *
 * <b>Sie gehört zum BEREICH und nicht zum einzelnen Platz.</b> Alle sehen
 * denselben Aufbau; verschieden ist nur, was in den persönlichen Bausteinen
 * steht. Sie bei jedem Ausstellen erneut einzutippen hiesse, dieselbe Angabe
 * zweihundertmal zu wiederholen — und beim zweihundertersten Mal anders.
 */
export const areaPortal = (areaId: string): Promise<{ path: string | null }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/portal`);

export const setAreaPortal = (
  areaId: string, path: string | null
): Promise<{ path: string | null }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/portal`, {
    method: 'POST',
    body: JSON.stringify({ path })
  });
