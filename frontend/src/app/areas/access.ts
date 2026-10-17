/**
 * Zugang zu einer Adresse — geben, sehen, zurücknehmen.
 *
 * <b>Ein Zertifikat wird HIER unterschrieben.</b> Der Dienst prüft nur: die
 * Unterschrift stammt aus dem privaten Schlüssel der ausstellenden Rolle, und
 * den hält er nicht. Ohne das wäre „darf schreiben" eine Zeile, die herstellt,
 * wer die Datenbank hält.
 *
 * <b>Die Stufen kommen aus dem Kernel</b> (3.5) und sind hier nicht neu
 * erfunden: `write` darf ändern, `certify` darf weitergeben und Unterseiten
 * öffnen — und deckt ausdrücklich NICHT das Ändern ab. Wer beides soll, bekommt
 * zwei Zertifikate.
 */

import { I, O, S, type Canon } from './canonical';
import { signCanonical, toBase64Url } from './crypto';
import { newId } from './ids';
import type { Ring } from './keys';
import { call } from './session';

export type Capability = 'read' | 'write' | 'admin' | 'certify';

export const CAPABILITY_NAME: Record<Capability, string> = {
  read: 'Podgląd',
  write: 'Może zmieniać',
  admin: 'Może zmieniać i zarządzać',
  certify: 'Może dopuszczać i otwierać podstrony'
};

export interface Grant {
  readonly id: string;
  readonly path: string;
  /** Von weiter oben geerbt: hier sichtbar, aber nur dort zurückzunehmen. */
  readonly inherited: boolean;
  readonly subjectRoleId: string;
  readonly capability: Capability;
  readonly issuedByRoleId: string;
  readonly expiresAt: string;
}

export interface AccessView {
  readonly path: string;
  /** Die Kennung der Registerzeile — sie geht in die Unterschrift ein. */
  readonly slugId: string | null;
  readonly ownerRoleId: string | null;
  readonly ownerPath: string | null;
  readonly mayWrite: boolean;
  readonly mayCertify: boolean;
  readonly grants: readonly Grant[];
}

export const loadAccess = (path: string): Promise<AccessView> =>
  call<AccessView>(`/workspace/grants?path=${encodeURIComponent(path)}`);

/**
 * Die kanonische Form eines Zertifikats — Feld für Feld wie
 * `CertificateRecord` im Kernel.
 *
 * Auch hier gilt: nichts weglassen, nichts umbenennen, nichts umsortieren. Die
 * Reihenfolge macht `canonical.ts` (nach Schlüsseln), die MENGE der Felder
 * macht diese Stelle — und ein fehlendes ergibt andere Bytes und eine
 * Unterschrift, die der Dienst ablehnt.
 */
/**
 * Worauf ein Zertifikat gilt — dieselben Wörter wie `Capabilities.ScopeText`
 * im Kernel.
 *
 * Als Aufzählung und nicht als Zeichenkette: ein Tippfehler wäre sonst eine
 * Unterschrift über andere Bytes, und die fällt nicht beim Schreiben auf,
 * sondern beim Prüfen — mit „Podpis się nie zgadza" und ohne jeden Hinweis
 * darauf, dass ein Wort schuld ist.
 */
export type ScopeKind = 'area' | 'body' | 'slug';

export const certificateValue = (c: {
  capability: Capability;
  expiresAt: number;
  id: string;
  issuedAt: number;
  issuedByRoleId: string;
  scopeId: string;

  /*
   * DER GELTUNGSBEREICH GEHT MIT IN DIE UNTERSCHRIFT (Kernel:
   * CertificateRecord.ToCanonicalValue). Hier stand `'slug'` fest — damit liess
   * sich ein Zertifikat auf einen BEREICH gar nicht unterschreiben: der Browser
   * hashte „slug", der Dienst prüfte gegen „area", und die Unterschrift stimmte
   * nie. Was fest dasteht, muss auch fest gelten; hier galt es nicht.
   */
  scopeKind: ScopeKind;
  subjectRoleId: string;
}): Canon => O({
  capability: S(c.capability),
  expiresAt: I(c.expiresAt),
  id: S(c.id),
  issuedAt: I(c.issuedAt),
  issuedByRoleId: S(c.issuedByRoleId),
  scopeId: S(c.scopeId),
  scopeKind: S(c.scopeKind),
  subjectRoleId: S(c.subjectRoleId)
});

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/**
 * Zugang geben.
 *
 * <b>Unterschrieben wird mit der AUSSTELLENDEN Rolle</b> — nicht mit
 * irgendeiner erreichbaren. Wer im Namen einer Rolle jemanden hereinlässt, muss
 * ihren Schlüssel halten; genau das beweist die Unterschrift.
 */
export async function grantAccess(
  ring: Ring,
  options: {
    view: AccessView;
    subjectRoleId: string;
    issuerRoleId: string;
    capability: Capability;
    days: number;
  }
): Promise<Grant> {
  const { view, subjectRoleId, issuerRoleId, capability, days } = options;

  if (view.slugId === null) throw new Error('Tego adresu nie ma w rejestrze.');

  const id = newId();
  const issuedAt = nowSeconds();
  const expiresAt = issuedAt + days * 24 * 60 * 60;

  const signature = await signCanonical(
    await ring.signKey(issuerRoleId),
    certificateValue({
      capability, expiresAt, id, issuedAt,
      issuedByRoleId: issuerRoleId,
      scopeId: view.slugId,

      // Eine Adresse. Bisher stillschweigend angenommen, jetzt gesagt.
      scopeKind: 'slug',
      subjectRoleId
    })
  );

  return call<Grant>('/workspace/grants', {
    method: 'POST',
    body: JSON.stringify({
      path: view.path,
      subjectRoleId,
      issuerRoleId,
      capability,
      certificate: { id, issuedAt, expiresAt, signature: toBase64Url(signature) }
    })
  });
}

export const revokeGrant = (id: string): Promise<{ ok: boolean }> =>
  call<{ ok: boolean }>(`/workspace/grants/${encodeURIComponent(id)}/revoke`, { method: 'POST' });

/**
 * Eine Unterseite öffnen.
 *
 * Ohne Code: wer die Adresse darüber führt, erreicht sich selbst — ein
 * Geheimnis, das man sich selbst schickt, ist Umstand ohne Gewinn. Die Rolle
 * muss eine eigene sein; fremden Rollen gibt man Zugang mit einem Zertifikat.
 */
export const openSubpage = (
  path: string, roleId: string, note?: string
): Promise<{ path: string; roleId: string; claimedAt: string }> =>
  call<{ path: string; roleId: string; claimedAt: string }>('/workspace/subpage', {
    method: 'POST',
    body: JSON.stringify({ path, roleId, note: note ?? null })
  });
