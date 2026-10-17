/**
 * Zugang zu einer Adresse: die kanonische Form eines Zertifikats und das Öffnen einer Unterseite.
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

import { I, O, S, type Canon } from '../core/canonical';
import { call } from '../core/session';

export type Capability = 'read' | 'write' | 'admin' | 'certify';

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

/**
 * Die kanonische Form eines Zertifikats — Feld für Feld wie
 * `CertificateRecord` im Kernel.
 *
 * Auch hier gilt: nichts weglassen, nichts umbenennen, nichts umsortieren. Die
 * Reihenfolge macht `canonical.ts` (nach Schlüsseln), die MENGE der Felder
 * macht diese Stelle — und ein fehlendes ergibt andere Bytes und eine
 * Unterschrift, die der Dienst ablehnt.
 */
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
