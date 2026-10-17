/**
 * DER WEG VON EINER ROLLE ZU IHREN BEREICHEN — ohne Konto (0091).
 *
 * Ein Konto läuft ihn mit dem ganzen Rollengraphen (`Ring.walk`). Ein Link
 * mit Zugang und ein Platz (ein Mensch, der ein Formular eingesandt hat)
 * haben keinen Graphen, aber einen Ausgangsschlüssel: der Link den seiner
 * Linkrolle (aus seinem Geheimnis), der Platz den der Rolle seines Formulars
 * (unter dem Platzschlüssel). Den Rest gibt der Dienst als Hüllen heraus
 * (`RoleBundle.cs`), und hier gehen sie auf:
 *
 * <code>
 *   Ausgangsschlüssel ─► privater Verpackungsschlüssel der Rolle
 *                     ─► Rollen, die sie hält (ihr Schlüssel, für sie verpackt) ─► …
 *                     ─► Epochen ihrer Bereiche
 * </code>
 *
 * Eine Hülle, die nicht aufgeht, nimmt den anderen nichts — sie wird übergangen.
 */

import { epochAad } from './area';
import { aad, Field, fromBase64Url, open, unwrapKey } from './crypto';

export interface BundleRole {
  readonly roleId: string;
  readonly kind: string;
  readonly wrapPrivateSealed: string | null;
  /** Was die Rolle selbst darf — ihre Zertifikate, je Bereich. */
  readonly rights?: readonly { readonly areaId: string; readonly capability: string }[];
}

export interface BundleArea {
  readonly areaId: string;
  readonly name: string;
  readonly calendars: readonly { readonly calendarId: string; readonly title: string; readonly timeZone: string }[];
}

export interface RoleBundle {
  readonly roles: readonly BundleRole[];
  readonly roleGrants: readonly { readonly holderRoleId: string; readonly roleId: string; readonly sealedBlob: string }[];
  readonly epochGrants: readonly { readonly roleId: string; readonly areaId: string; readonly epoch: number; readonly sealedBlob: string }[];
  readonly areas: readonly BundleArea[];
}

export interface Walked {
  /** Jede Rolle, deren Schlüssel aufging — die Ausgangsrollen eingeschlossen. */
  readonly roleKeys: ReadonlyMap<string, Uint8Array>;
  /** Bereich → Epoche → Schlüssel. */
  readonly areaKeys: ReadonlyMap<string, ReadonlyMap<number, Uint8Array>>;
}

const wrapAad = (roleId: string) => aad('kernel', 'role', roleId, Field.RoleWrapPrivate, 1);
const grantAad = (roleId: string) => aad('kernel', 'role_grant', roleId, Field.RoleWrapPrivate, 1);

/** Den Weg gehen — von den Ausgangsschlüsseln, so weit die Hüllen reichen. */
export async function walkBundle(start: ReadonlyMap<string, Uint8Array>, bundle: RoleBundle | null | undefined): Promise<Walked> {
  const roleKeys = new Map(start);
  const areaKeys = new Map<string, Map<number, Uint8Array>>();
  if (bundle === null || bundle === undefined) return { roleKeys, areaKeys };

  const byId = new Map(bundle.roles.map((r) => [r.roleId, r]));
  const wraps = new Map<string, Uint8Array>();
  let frontier = [...roleKeys.keys()];

  while (frontier.length > 0) {
    const next: string[] = [];
    for (const roleId of frontier) {
      const sealed = byId.get(roleId)?.wrapPrivateSealed ?? null;
      const key = roleKeys.get(roleId);
      if (sealed === null || key === undefined || wraps.has(roleId)) continue;

      let wrapPrivate: Uint8Array;
      try { wrapPrivate = await open(key, wrapAad(roleId), fromBase64Url(sealed)); } catch { continue; }
      wraps.set(roleId, wrapPrivate);

      for (const grant of bundle.roleGrants) {
        if (grant.holderRoleId !== roleId || roleKeys.has(grant.roleId)) continue;
        try {
          roleKeys.set(grant.roleId, await unwrapKey(wrapPrivate, grantAad(grant.roleId), fromBase64Url(grant.sealedBlob)));
          next.push(grant.roleId);
        } catch { /* übergangen */ }
      }
    }
    frontier = next;
  }

  for (const grant of bundle.epochGrants) {
    const wrapPrivate = wraps.get(grant.roleId);
    if (wrapPrivate === undefined || areaKeys.get(grant.areaId)?.has(grant.epoch) === true) continue;
    try {
      const key = await unwrapKey(wrapPrivate, epochAad(grant.areaId, grant.epoch), fromBase64Url(grant.sealedBlob));
      const epochs = areaKeys.get(grant.areaId) ?? new Map<number, Uint8Array>();
      epochs.set(grant.epoch, key);
      areaKeys.set(grant.areaId, epochs);
    } catch { /* übergangen */ }
  }

  return { roleKeys, areaKeys };
}

/** Zwei Schlüsselsammlungen in eine (Bereich → Epoche → Schlüssel). */
export function mergeAreaKeys(into: Map<string, Map<number, Uint8Array>>, from: ReadonlyMap<string, ReadonlyMap<number, Uint8Array>>): void {
  for (const [areaId, epochs] of from) {
    const had = into.get(areaId) ?? new Map<number, Uint8Array>();
    for (const [epoch, key] of epochs) had.set(epoch, key);
    into.set(areaId, had);
  }
}

/* -- Was Plätze in diesem Tab aufgeschlossen haben (0091) ---------------------------------------- */

/**
 * Die Bereichsschlüssel, die die Rollen der Plätze in diesem Tab geöffnet
 * haben — damit ein Kalender oder eine Seite sie findet wie die eines Links
 * (`areaReader`). Nur im Speicher; ein neuer Tab öffnet sie neu.
 */
const seatAreaKeys = new Map<string, Map<number, Uint8Array>>();

export const rememberSeatAreaKeys = (keys: ReadonlyMap<string, ReadonlyMap<number, Uint8Array>>): void => mergeAreaKeys(seatAreaKeys, keys);

export const seatAreaKey = (areaId: string, epoch: number): Uint8Array | null => seatAreaKeys.get(areaId)?.get(epoch) ?? null;
