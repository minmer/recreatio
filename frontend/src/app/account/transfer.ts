/**
 * DIE ÜBERTRAGUNG — was nach Schritt 3 noch übrig ist (documentation/TRANSFER.md).
 *
 * <code>
 *   Koperty RSA   Antworten, die der gewöhnliche Weg der Kanzlei (0037) nicht
 *                 umstellt: sie liegen unter der Annahme eines ANDEREN Bereichs
 *                 (`rewrap.ts`, `spare`). Das braucht die Schlüssel des Kontos,
 *                 das beide Annahmen hält — dieser Browser, nach der Anmeldung.
 *   Der Server    Skripte ohne Eintrag, leere Schemata des alten Systems, Rollen
 *                 ohne Halter — nur Zahlen; aufgeräumt wird mit `migrate`.
 * </code>
 *
 * Steht alles auf null, geht diese Datei mit der Seite und `Transfer.cs`.
 */

import type { Ring } from '../core/keys';
import { call } from '../core/session';
import { rewrapForm } from '../forms/rewrap';

export interface TransferStatus {
  /** Antworten in RSA-Umschlägen — in der ganzen Datenbank. */
  readonly rsa: number;
  /** Formulare mit RSA-Umschlägen, deren Bereich ich lese. */
  readonly rsaForms: readonly { readonly moduleId: string; readonly values: number }[];
  /** Skripte ohne Eintrag in `schema_version` — die Sache des Servers, nicht des Browsers. */
  readonly migrations: readonly string[];
  readonly legacySchemas: readonly string[];
  /** Rollen ohne Halter: niemand öffnet sie mehr. */
  readonly unheld: number;
}

export const loadTransfer = (): Promise<TransferStatus> => call<TransferStatus>('/workspace/transfer');

export async function rewrapForms(
  ring: Ring, forms: readonly { readonly moduleId: string }[]
): Promise<{ rewrapped: number; failed: number }> {
  let rewrapped = 0;
  let failed = 0;
  for (const form of forms) {
    try {
      rewrapped += (await rewrapForm(form.moduleId, ring)).rewrapped;
    } catch {
      failed += 1;
    }
  }
  return { rewrapped, failed };
}
