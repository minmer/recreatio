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
  readonly kind: 'person' | 'role' | 'group';
  readonly isPersonal: boolean;
  readonly createdAt: string;
  readonly displayNameSealed: string | null;
  readonly wrapPublicKey: string;
  readonly signPublicKey: string;
  readonly wrapPrivateSealed: string | null;
  readonly signPrivateSealed: string | null;

  /**
   * 0 = ein Schlüssel öffnet Name, Lesen UND Unterschreiben (vor 0034).
   * 1 = das Unterschreiben hängt an einem eigenen Schlüssel.
   */
  readonly keyLayout: 0 | 1;
}

export interface SealedGrant {
  readonly holderRoleId: string;
  readonly roleId: string;
  readonly sealedBlob: string;

  /** `role` öffnet Name und Lesen, `role_sign` das Unterschreiben (0034). */
  readonly keyKind: 'role' | 'role_sign';
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

/**
 * EIGENE AAD fuer den Signierschluessel (0034). Dieselbe zu nehmen hiesse:
 * zwei Huellen, die sich verwechseln lassen — und eine davon oeffnet das
 * Unterschreiben.
 */
const signGrantAad = (grantedRoleId: string) =>
  aad('kernel', 'role_grant', grantedRoleId, Field.RoleSignPrivate, 1);

/* -- Der Hauptschlüssel ----------------------------------------------------- */

export const openMasterKey = (accountId: string, passwordKey: Uint8Array, masterKeySealed: string) =>
  open(passwordKey, masterAad(accountId), fromBase64Url(masterKeySealed));

/* -- Der Bund --------------------------------------------------------------- */

/**
 * Diese Rolle lässt sich lesen, aber nicht in ihrem Namen unterschreiben
 * (0034) — der Signierschlüssel liegt nicht im Bund.
 *
 * <b>Ein eigener Fehler und keine Meldung</b>, damit die Oberfläche ihn von
 * „geht nicht" unterscheiden kann: das hier ist kein Defekt, sondern die Stufe.
 */
export class WriteOnlyRole extends Error {
  constructor(readonly roleId: string) {
    super(`Rolle ${roleId} darf gelesen, aber nicht unterschrieben werden.`);
    this.name = 'WriteOnlyRole';
  }
}

export class Ring {
  private constructor(
    private readonly keys: Map<string, Uint8Array>,
    private readonly roles: Map<string, SealedRole>,

    /*
     * GETRENNT GEHALTEN, nicht zusammengeworfen. Läge der Signierschlüssel im
     * selben Beutel wie der Rollenschlüssel, wäre die Trennung genau eine
     * Verwechslung weit von ihrem Ende entfernt.
     */
    private readonly signKeys: Map<string, Uint8Array> = new Map()
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
    const signKeys = new Map<string, Uint8Array>();

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

          /*
           * ZWEI ARTEN, ZWEI BEUTEL (0034).
           *
           * `role` öffnet Name und Lesen und trägt den Lauf weiter — von einer
           * Rolle, deren Schlüssel offen ist, geht es zu allem, was sie hält.
           *
           * `role_sign` öffnet nur das Unterschreiben. Es trägt den Lauf NICHT
           * weiter: wer unterschreiben darf, kommt damit nicht an die
           * Zuteilungen der Rolle — dafür braucht er ohnehin den anderen.
           */
          const into = grant.keyKind === 'role_sign' ? signKeys : keys;
          if (into.has(grant.roleId)) continue;

          try {
            const key = await unwrapKey(
              wrapPrivate,
              grant.keyKind === 'role_sign' ? signGrantAad(grant.roleId) : grantAad(grant.roleId),
              fromBase64Url(grant.sealedBlob));

            into.set(grant.roleId, key);
            if (grant.keyKind !== 'role_sign') next.push(grant.roleId);
          } catch {
            // Eine Zuteilung, die nicht aufgeht, ist ein Befund — aber keiner,
            // der die übrigen Rollen unsichtbar machen darf.
          }
        }
      }

      frontier = next;
    }

    return new Ring(keys, byId, signKeys);
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

  /**
   * Der private VERPACKUNGSschlüssel einer Rolle — zum Auspacken einer
   * Zuteilung, die auf diese Rolle ausgestellt ist.
   *
   * Der Bund benutzt ihn beim Laufen schon selbst, behält ihn aber nicht: dort
   * ist er ein Zwischenschritt. Für den Epochenschlüssel eines Bereichs wird er
   * später noch einmal gebraucht, und ihn dann ein zweites Mal von Hand
   * aufzumachen hiesse, die AAD ein zweites Mal zu tippen.
   */
  async wrapPrivate(roleId: string): Promise<Uint8Array> {
    const role = this.roles.get(roleId);
    if (role?.wrapPrivateSealed == null) throw new Error(`Rolle ${roleId} hat keinen Verpackungsschlüssel.`);

    return open(this.keyOf(roleId), wrapAad(roleId), fromBase64Url(role.wrapPrivateSealed));
  }

  /**
   * Der private Signierschlüssel einer Rolle — zum Unterschreiben einer Kante
   * oder eines Zertifikats.
   *
   * <b>Hier entscheidet sich, was die drei Stufen wert sind</b> (0034). Eine
   * Rolle in getrennter Form (`keyLayout === 1`) hält ihren Signierschlüssel
   * unter einem EIGENEN Schlüssel, und den bekommt nur, wer sie führt. Wer sie
   * liest, hat den Rollenschlüssel und kommt damit an Namen und Lesen — aber
   * nicht hierher.
   *
   * <b>Und das ist keine Anzeigeregel.</b> Ohne diesen Schlüssel lässt sich
   * keine Kante und kein Zertifikat herstellen, das der Dienst annimmt: er
   * prüft die Unterschrift gegen den öffentlichen Teil. Schreiben kann ein
   * Leser weiterhin — aber nicht so, dass es wie eine befugte Zusage aussieht.
   *
   * <b>`keyLayout === 0` ist die alte Form</b>, in der ein Schlüssel beides
   * öffnete. Dort gibt es die Trennung nicht, und wer das nicht sagt, behauptet
   * eine Schranke, die für diese Rolle nicht gilt.
   */
  async signKey(roleId: string): Promise<Uint8Array> {
    const role = this.roles.get(roleId);
    if (role?.signPrivateSealed == null) throw new Error(`Rolle ${roleId} hat keinen Signierschlüssel.`);

    const opener = role.keyLayout === 1 ? this.signKeys.get(roleId) : this.keys.get(roleId);

    if (opener === undefined) {
      throw new WriteOnlyRole(roleId);
    }

    return open(opener, signAad(roleId), fromBase64Url(role.signPrivateSealed));
  }

  /** Ob diese Rolle im Namen ihrer selbst unterschreiben kann — ohne es zu versuchen. */
  maySign(roleId: string): boolean {
    const role = this.roles.get(roleId);
    if (role?.signPrivateSealed == null) return false;

    return role.keyLayout === 1 ? this.signKeys.has(roleId) : this.keys.has(roleId);
  }

  /**
   * Der Signierschlüssel einer Rolle — zum Weiterverpacken an einen neuen
   * FÜHRENDEN Halter (0034).
   *
   * `null` heisst zweierlei, und beides ist kein Fehler: die Rolle ist noch in
   * der alten Form (dann gibt es keinen eigenen), oder dieser Bund führt sie
   * nicht. Wer weitergeben will, was er selbst nicht hat, bekommt hier die
   * ehrliche Antwort statt einer Ausnahme.
   */
  signKeyOf(roleId: string): Uint8Array | null {
    return this.signKeys.get(roleId) ?? null;
  }

  /** Der Rollenschlüssel selbst — zum Weiterverpacken an einen neuen Halter. */
  keyOf(roleId: string): Uint8Array {
    const key = this.keys.get(roleId);
    if (key === undefined) throw new Error(`Kein Schlüssel für Rolle ${roleId}.`);
    return key;
  }
}
