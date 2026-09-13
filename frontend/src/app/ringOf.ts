/**
 * Der Schlüsselbund, EINMAL gebaut.
 *
 * <b>Zwei Ansichten brauchen ihn.</b> Der Rollengraph öffnet damit Namen, und
 * das Seitenformular unterschreibt damit Zertifikate. Ihn an beiden Stellen zu
 * bauen hiesse: zweimal durch die Zuteilungen laufen, zweimal RSA auspacken —
 * und zwei Meinungen darüber, welche AAD wohin gehört.
 *
 * <b>Der Zwischenspeicher hält, bis sich etwas ändert.</b> Wer eine Rolle
 * anlegt oder zurücknimmt, ruft <see cref="forgetKeys"/>: der nächste Zugriff
 * läuft neu. Ohne das zeigte der Graph eine Rolle, deren Schlüssel der Bund
 * nicht kennt — sichtbar, aber verschlossen, ohne Grund.
 *
 * Er liegt im Speicher dieses Tabs und geht beim Neuladen verloren, wie der
 * PasswordKey selbst (`session.ts`).
 */

import { openMasterKey, Ring } from './keys';
import { loadRoles, type RoleGraphData } from './roles';
import { heldPasswordKey, type Who } from './session';

export interface Keys {
  /** `null` heisst: dieser Tab hat den PasswordKey nicht (mehr). */
  readonly ring: Ring | null;
  readonly graph: RoleGraphData;
}

let cached: { readonly accountId: string; readonly keys: Keys } | null = null;

export async function keysFor(who: Who): Promise<Keys> {
  if (cached !== null && cached.accountId === who.accountId) return cached.keys;

  const graph = await loadRoles();
  const passwordKey = heldPasswordKey();

  if (passwordKey === null || graph.personRoleId === null) {
    // Der Graph steht trotzdem: eine Rolle ohne lesbaren Namen ist besser als
    // eine leere Seite, und der Unterschied ist sichtbar.
    return { ring: null, graph };
  }

  try {
    const master = await openMasterKey(who.accountId, passwordKey, who.masterKeySealed);
    const ring = await Ring.walk(graph.personRoleId, master, graph.roles, graph.grants);

    const keys: Keys = { ring, graph };
    cached = { accountId: who.accountId, keys };
    return keys;
  } catch {
    // Eine Hülle ging nicht auf: fast immer ein PasswordKey aus einer anderen
    // Anmeldung. Kein Grund, den Graphen zu verstecken.
    return { ring: null, graph };
  }
}

/** Nach jeder Änderung an Rollen oder Zuteilungen. */
export const forgetKeys = (): void => { cached = null; };
