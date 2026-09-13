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
import { call } from './session';

/** Die AAD des Epochenschlüssels — an EINER Stelle, wie in `keys.ts`. */
const epochAad = (areaId: string, epoch: number) =>
  aad('keys', 'area_epoch', areaId, Field.AreaEpochKey, epoch);

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
}

export interface Member {
  readonly roleId: string;
  readonly kind: 'person' | 'role' | 'group';
  readonly wrapPublicKey: string;
}

export const loadAreas = (): Promise<{ areas: readonly AreaRow[] }> =>
  call<{ areas: readonly AreaRow[] }>('/workspace/areas');

export const loadMembers = (areaId: string): Promise<{ areaId: string; members: readonly Member[] }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/members`);

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
async function signedCertificate(ring: Ring, what: {
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
  ring: Ring, person: SealedRole, name: string
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
