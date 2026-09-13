/**
 * Der Schlüsselbund dieses Tabs.
 *
 * <b>Die ganze Kette an einer Stelle.</b> Wer sie an zwei Stellen nachbaut,
 * bekommt zwei Meinungen darüber, welche AAD wohin gehört — und Hüllen, die
 * sich an einem Platz öffnen und am anderen nicht.
 *
 *   PasswordKey ──► master_key_sealed ──► MasterKey
 *                                          │ HKDF(role-read:<persönliche Rolle>)
 *                                          ▼
 *                                    Rollenschlüssel ──► display_name
 *                                          │ öffnet wrap_private_sealed
 *                                          ▼
 *                                  RSA-Privatschlüssel ──► key_grant auspacken
 *                                          │
 *                                          ▼
 *                                Schlüssel der Unterrolle …
 *
 * <b>Erreichbarkeit im Graphen IST Schlüsselerreichbarkeit.</b> Der Bund wird
 * deshalb nicht „geladen", sondern GELAUFEN: von der persönlichen Rolle aus, so
 * weit die Zuteilungen reichen. Was hier fehlt, fehlt zu Recht.
 */

import {
  aad, deriveRoleReadKey, Field, fromBase64Url, open, openText, sealText, toBase64Url, unwrapKey
} from './crypto';

/** Eine Rolle, so wie der Dienst sie herausgibt — alles Geheime versiegelt. */
export interface SealedRole {
  readonly id: string;
  readonly kind: 'person' | 'office' | 'member';
  readonly isPersonal: boolean;
  readonly createdAt: string;
  readonly displayNameSealed: string | null;
  readonly wrapPublicKey: string;
  readonly signPublicKey: string;
  readonly wrapPrivateSealed: string | null;
  readonly signPrivateSealed: string | null;
}

export interface SealedGrant {
  readonly holderRoleId: string;
  readonly roleId: string;
  readonly sealedBlob: string;
}

/* -- Die Etiketten (3.13) ---------------------------------------------------
 *
 * Sie stehen hier EINMAL. Jede Stelle, die eine davon selbst zusammensetzt, ist
 * eine Stelle, an der sie später abweichen kann.
 */

const masterAad = (accountId: string) =>
  aad('kernel', 'account', accountId, Field.AccountMasterKey, 1);

const nameAad = (roleId: string) => aad('kernel', 'role', roleId, Field.RoleDisplayName, 1);
const wrapAad = (roleId: string) => aad('kernel', 'role', roleId, Field.RoleWrapPrivate, 1);
const signAad = (roleId: string) => aad('kernel', 'role', roleId, Field.RoleSignPrivate, 1);

/**
 * Die Zuteilung klebt an der Rolle, die sie ÖFFNET — nicht an der, die sie
 * hält. Sonst liesse sich eine Hülle von einer Rolle auf eine andere umhängen,
 * und der Halter bekäme Schlüssel, die ihm nie zugeteilt wurden.
 */
const grantAad = (grantedRoleId: string) =>
  aad('kernel', 'role_grant', grantedRoleId, Field.RoleWrapPrivate, 1);

/* -- Der Hauptschlüssel ----------------------------------------------------- */

export const openMasterKey = (accountId: string, passwordKey: Uint8Array, masterKeySealed: string) =>
  open(passwordKey, masterAad(accountId), fromBase64Url(masterKeySealed));

/* -- Der Bund --------------------------------------------------------------- */

export class Ring {
  private constructor(
    private readonly keys: Map<string, Uint8Array>,
    private readonly roles: Map<string, SealedRole>
  ) {}

  /**
   * Vom persönlichen Rollenschlüssel aus so weit laufen, wie die Zuteilungen
   * reichen.
   *
   * Eine Zuteilung, die sich nicht öffnen lässt, beendet nicht den Lauf: sie
   * wird übergangen. Ein einzelner kaputter Eintrag darf nicht den ganzen
   * Arbeitsplatz leer aussehen lassen.
   */
  static async walk(
    personRoleId: string,
    masterKey: Uint8Array,
    roles: readonly SealedRole[],
    grants: readonly SealedGrant[]
  ): Promise<Ring> {
    const byId = new Map(roles.map((r) => [r.id, r]));
    const keys = new Map<string, Uint8Array>();

    // Der einzige Schlüssel, der ABGELEITET wird. Jeder andere wird ausgepackt.
    if (byId.has(personRoleId)) {
      keys.set(personRoleId, await deriveRoleReadKey(masterKey, personRoleId));
    }

    // Von jeder Rolle, deren Schlüssel schon offen ist, zu allem, was sie hält.
    let frontier = [...keys.keys()];

    while (frontier.length > 0) {
      const next: string[] = [];

      for (const holderId of frontier) {
        const holder = byId.get(holderId);
        const holderKey = keys.get(holderId);
        if (holder === undefined || holderKey === undefined) continue;
        if (holder.wrapPrivateSealed === null) continue;

        let wrapPrivate: Uint8Array;
        try {
          wrapPrivate = await open(holderKey, wrapAad(holderId), fromBase64Url(holder.wrapPrivateSealed));
        } catch {
          continue;
        }

        for (const grant of grants) {
          if (grant.holderRoleId !== holderId) continue;
          if (keys.has(grant.roleId)) continue;

          try {
            const key = await unwrapKey(wrapPrivate, grantAad(grant.roleId), fromBase64Url(grant.sealedBlob));
            keys.set(grant.roleId, key);
            next.push(grant.roleId);
          } catch {
            // Eine Zuteilung, die nicht aufgeht, ist ein Befund — aber keiner,
            // der die übrigen Rollen unsichtbar machen darf.
          }
        }
      }

      frontier = next;
    }

    return new Ring(keys, byId);
  }

  /** Hält dieser Bund den Schlüssel dieser Rolle? */
  has = (roleId: string): boolean => this.keys.has(roleId);

  get size(): number { return this.keys.size; }

  /**
   * Der Name einer Rolle — oder `null`, wenn er verschlossen bleibt.
   *
   * `null` heisst hier ausdrücklich NICHT „namenlos": es heisst „nicht für
   * dich". Die Oberfläche muss das unterscheiden, sonst sieht eine fremde
   * Rolle aus wie eine unbenannte.
   */
  async name(roleId: string): Promise<string | null> {
    const role = this.roles.get(roleId);
    const key = this.keys.get(roleId);
    if (role === undefined || key === undefined || role.displayNameSealed === null) return null;

    try {
      return await openText(key, nameAad(roleId), fromBase64Url(role.displayNameSealed));
    } catch {
      return null;
    }
  }

  /** Alle lesbaren Namen auf einmal — für die Anzeige des ganzen Graphen. */
  async names(): Promise<Map<string, string>> {
    const out = new Map<string, string>();

    for (const roleId of this.keys.keys()) {
      const name = await this.name(roleId);
      if (name !== null) out.set(roleId, name);
    }

    return out;
  }

  /** Einen Namen versiegeln — der Dienst bekommt nur die Hülle zu sehen. */
  async sealName(roleId: string, name: string): Promise<string> {
    const key = this.keyOf(roleId);
    return toBase64Url(await sealText(key, nameAad(roleId), name.trim()));
  }

  /** Der private Signierschlüssel einer Rolle, für das Unterschreiben einer Kante. */
  async signKey(roleId: string): Promise<Uint8Array> {
    const role = this.roles.get(roleId);
    if (role?.signPrivateSealed == null) throw new Error(`Rolle ${roleId} hat keinen Signierschlüssel.`);

    return open(this.keyOf(roleId), signAad(roleId), fromBase64Url(role.signPrivateSealed));
  }

  /** Der Rollenschlüssel selbst — zum Weiterverpacken an einen neuen Halter. */
  keyOf(roleId: string): Uint8Array {
    const key = this.keys.get(roleId);
    if (key === undefined) throw new Error(`Kein Schlüssel für Rolle ${roleId}.`);
    return key;
  }
}
