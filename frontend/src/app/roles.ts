/**
 * Rollen — was der Browser rechnet, bevor der Dienst etwas zu sehen bekommt.
 *
 * <b>Der Dienst hält keine Schlüssel.</b> Also entsteht hier alles Geheime:
 * die Schlüssel einer neuen Rolle, ihre versiegelten Hälften, die Zuteilung an
 * den Halter, der versiegelte Name — und die Unterschrift unter der Kante. Der
 * Dienst prüft nur, und genau das kann er ohne Schlüssel.
 */

import { I, NIL, O, S, type Canon } from './canonical';
import {
  aad, Field, fromBase64Url, newRolePair, seal, signCanonical, toBase64Url, wrapKey, KEY_SIZE
} from './crypto';
import { newId } from './ids';
import type { Ring, SealedGrant, SealedRole } from './keys';
import { call } from './session';

export interface RoleEdge {
  readonly id: string;
  readonly fromRoleId: string;
  readonly toRoleId: string;
  readonly signerRoleId: string;
  readonly edgeKind: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
}

export interface RoleGraphData {
  readonly personRoleId: string | null;
  readonly roles: readonly SealedRole[];
  readonly edges: readonly RoleEdge[];
  readonly grants: readonly SealedGrant[];
}

export const loadRoles = (): Promise<RoleGraphData> => call<RoleGraphData>('/workspace/roles');

/* -- Das Konto und seine Personen (0040) ------------------------------------
 *
 * `personRoleId` heisst im Draht noch so, wie die Spalte heisst — es ist das
 * KONTO: die Wurzel, deren Schlüssel aus dem Hauptschlüssel abgeleitet wird.
 * Es hält nur Personen, und ihm wird nichts gegeben. Wer handelt, ist eine
 * dieser Personen oder eine Rolle darunter.
 */

/** Die Personen, die das Konto selbst hält — die älteste zuerst. */
export function personsOf(graph: RoleGraphData): readonly SealedRole[] {
  const held = new Set(graph.edges
    .filter((e) => e.fromRoleId === graph.personRoleId && e.edgeKind === 'holds')
    .map((e) => e.toRoleId));

  return graph.roles
    .filter((r) => r.kind === 'person' && held.has(r.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Die Person, als die man handelt, wo niemand gefragt wird: ein neuer
 * Bereich, ein Kalendereintrag, das Postfach eines Formulars. `null`, solange
 * das Konto noch keine hält — dann ist das erste, was zu tun ist, eine
 * anzulegen.
 */
export const selfOf = (graph: RoleGraphData): SealedRole | null => personsOf(graph)[0] ?? null;

/**
 * Die kanonische Form einer Kante — Feld für Feld wie `RoleEdgeRecord` im
 * Kernel.
 *
 * <b>Hier wird nichts weggelassen, was dort steht.</b> Auch `expiresAt` und
 * `fromAccountCommitment` gehören hinein, obwohl sie heute immer leer sind:
 * die Reihenfolge und die Menge der Felder sind Teil der Unterschrift. Ein
 * fehlendes Feld ergibt andere Bytes, und der Dienst lehnt ab — ohne dass man
 * ihm ansieht, warum.
 */
/**
 * Die drei Arten, eine Rolle weiterzugeben (0032) — die drei Punkte des
 * Altbestands an jedem Knoten.
 *
 * <code>
 *   holds   führen: ändern, weitergeben, aufnehmen   (dort „Owner")
 *   write   eintragen, was der Rolle gehört
 *   read    hineinsehen
 * </code>
 *
 * <b>Die Art wird UNTERSCHRIEBEN</b> (siehe `edgeValue`), nicht bloss
 * gespeichert. Eine Kante, deren Art sich nachträglich ändern liesse, ohne die
 * Unterschrift zu brechen, wäre keine Zusage, sondern eine Behauptung.
 */
export const EDGE_KINDS = ['holds', 'write', 'read'] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const edgeValue = (edge: {
  id: string;
  fromRoleId: string;
  toRoleId: string;
  signerRoleId: string;
  createdAt: number;
  edgeKind?: EdgeKind;
}): Canon => O({
  createdAt: I(edge.createdAt),
  edgeKind: S(edge.edgeKind ?? 'holds'),
  expiresAt: NIL,
  fromAccountCommitment: NIL,
  fromRoleId: S(edge.fromRoleId),
  id: S(edge.id),
  signerRoleId: S(edge.signerRoleId),
  toRoleId: S(edge.toRoleId)
});

/** Sekunden, nicht Millisekunden: der Kernel unterschreibt Unix-Sekunden. */
const nowSeconds = (): number => Math.floor(Date.now() / 1000);

interface SignedEdge {
  readonly id: string;
  readonly createdAt: number;
  readonly signature: string;
}

async function signEdge(
  ring: Ring, holderRoleId: string, toRoleId: string, edgeKind: EdgeKind = 'holds'
): Promise<SignedEdge> {
  const id = newId();
  const createdAt = nowSeconds();

  const signature = await signCanonical(
    await ring.signKey(holderRoleId),
    edgeValue({ id, fromRoleId: holderRoleId, toRoleId, signerRoleId: holderRoleId, createdAt, edgeKind })
  );

  return { id, createdAt, signature: toBase64Url(signature) };
}

/**
 * Eine Rolle anlegen.
 *
 * <b>Das dauert.</b> Zwei RSA-4096-Paare entstehen hier im Browser; auf einem
 * Telefon sind das mehrere Sekunden. Wer das aufruft, sagt es vorher an.
 *
 * Schlüssel, Zuteilung und Kante gehen in EINEM Aufruf hinaus. Drei Aufrufe
 * daraus zu machen hiesse, dass es Rollen gäbe, die niemand hält — und die
 * wären unlöschbar nutzlos, weil niemand ihren Schlüssel hat.
 */
/** Was sich anlegen lässt. `person` ist ein MENSCH — nicht „das eigene Konto". */
export type NewKind = 'role' | 'group' | 'person';

export async function createRole(
  ring: Ring,
  holder: SealedRole,
  options: { kind: NewKind; name: string }
): Promise<{ id: string }> {
  const id = newId();
  const pair = await newRolePair();
  const roleKey = crypto.getRandomValues(new Uint8Array(KEY_SIZE));

  /*
   * ZWEI SCHLÜSSEL, NICHT EINER (0034).
   *
   *   roleKey   öffnet Namen und Verpackungsschlüssel — jede Stufe bekommt ihn
   *   signKey   öffnet den Signierschlüssel — nur wer die Rolle FÜHRT
   *
   * Vorher öffnete einer beides, und damit konnte jeder, der lesen durfte,
   * auch in ihrem Namen aufnehmen und weitergeben. Die drei Stufen wären
   * Etiketten geblieben: der Dienst hätte sie geachtet, der Schlüssel nicht.
   */
  const signKey = crypto.getRandomValues(new Uint8Array(KEY_SIZE));

  const [wrapPrivateSealed, signPrivateSealed, displayNameSealed,
         grantSealedBlob, signGrantSealedBlob] = await Promise.all([
    seal(roleKey, aad('kernel', 'role', id, Field.RoleWrapPrivate, 1), pair.wrapPrivateKey),
    seal(signKey, aad('kernel', 'role', id, Field.RoleSignPrivate, 1), pair.signPrivateKey),
    seal(roleKey, aad('kernel', 'role', id, Field.RoleDisplayName, 1),
      new TextEncoder().encode(options.name.trim())),

    // Für den Halter verpackt — dafür reicht sein ÖFFENTLICHER Schlüssel. So
    // nimmt ein Verwalter jemanden auf, ohne dessen Geheimnisse zu kennen.
    wrapKey(fromBase64Url(holder.wrapPublicKey),
      aad('kernel', 'role_grant', id, Field.RoleWrapPrivate, 1), roleKey),

    // Wer sie anlegt, führt sie — er bekommt beide.
    wrapKey(fromBase64Url(holder.wrapPublicKey),
      aad('kernel', 'role_grant', id, Field.RoleSignPrivate, 1), signKey)
  ]);

  const edge = await signEdge(ring, holder.id, id);

  return call<{ id: string }>('/workspace/roles', {
    method: 'POST',
    body: JSON.stringify({
      id,
      kind: options.kind,
      holderRoleId: holder.id,
      wrapPublicKey: toBase64Url(pair.wrapPublicKey),
      signPublicKey: toBase64Url(pair.signPublicKey),
      wrapPrivateSealed: toBase64Url(wrapPrivateSealed),
      signPrivateSealed: toBase64Url(signPrivateSealed),
      displayNameSealed: toBase64Url(displayNameSealed),
      grantSealedBlob: toBase64Url(grantSealedBlob),
      signGrantSealedBlob: toBase64Url(signGrantSealedBlob),
      edge
    })
  });
}

/**
 * Eine bestehende Rolle einem weiteren Halter geben.
 *
 * Die einzige Stelle, an der ein Kreis entstehen kann (3.14) — der Dienst
 * lehnt ihn ab, und das ist kein Formfehler: zwei Rollen, die einander
 * aufschliessen, hat niemand je entschieden.
 */
/**
 * Jemanden an eine Rolle hängen — auf einer der drei Stufen (0032).
 *
 * <b>Der Rollenschlüssel geht in JEDEM Fall mit.</b> Lesen heisst hier
 * entschlüsseln können; eine Lesekante ohne Schlüssel gäbe nichts zu lesen.
 * Was die Stufen (noch) NICHT auseinanderhält, ist das Handeln IM NAMEN der
 * Rolle: derselbe Schlüssel öffnet heute auch ihren Signierschlüssel. Bis das
 * getrennt ist, sind `write` und `read` Hausregeln — und die Oberfläche sagt
 * das, statt eine Schranke zu behaupten.
 */
export async function addHolder(
  ring: Ring, roleId: string, holder: SealedRole, edgeKind: EdgeKind = 'holds'
): Promise<{ id: string }> {
  const grantSealedBlob = await wrapKey(
    fromBase64Url(holder.wrapPublicKey),
    aad('kernel', 'role_grant', roleId, Field.RoleWrapPrivate, 1),
    ring.keyOf(roleId)
  );

  /*
   * DER SIGNIERSCHLÜSSEL NUR BEIM FÜHREN (0034).
   *
   * Das ist die Stelle, an der `read` und `write` aufhören, Etiketten zu sein.
   * Ein Leser bekommt ihn nicht, und ohne ihn kann er keine Kante und kein
   * Zertifikat herstellen, das der Dienst annimmt — der prüft die Unterschrift.
   * Schreiben kann er weiterhin; nur sieht es dann nicht wie eine befugte
   * Zusage aus, und genau das ist der Unterschied, den wir wollten.
   *
   * `null` heisst: die Rolle ist noch in der alten Form, in der ein Schlüssel
   * beides öffnete. Dann gibt es nichts gesondert weiterzugeben.
   */
  const mine = edgeKind === 'holds' ? ring.signKeyOf(roleId) : null;

  const signGrantSealedBlob = mine === null ? undefined : toBase64Url(await wrapKey(
    fromBase64Url(holder.wrapPublicKey),
    aad('kernel', 'role_grant', roleId, Field.RoleSignPrivate, 1), mine));

  const edge = await signEdge(ring, holder.id, roleId, edgeKind);

  return call<{ id: string }>(`/workspace/roles/${encodeURIComponent(roleId)}/holders`, {
    method: 'POST',
    body: JSON.stringify({
      holderRoleId: holder.id,
      grantSealedBlob: toBase64Url(grantSealedBlob),
      edge,
      edgeKind,
      signGrantSealedBlob
    })
  });
}

/** Ohne `edgeKind` fällt jede Verbindung; mit ihm genau dieser eine Punkt. */
export const dropHolder = (
  roleId: string, holderRoleId: string, edgeKind?: EdgeKind
): Promise<{ ok: boolean }> =>
  call<{ ok: boolean }>(
    `/workspace/roles/${encodeURIComponent(roleId)}/holders/${encodeURIComponent(holderRoleId)}`
      + (edgeKind === undefined ? '' : `?kind=${encodeURIComponent(edgeKind)}`),
    { method: 'DELETE' });

/** Umbenennen. Der Name geht fertig versiegelt hinaus — der Dienst liest ihn nie. */
export async function renameRole(ring: Ring, roleId: string, name: string): Promise<{ ok: boolean }> {
  return call<{ ok: boolean }>(`/workspace/roles/${encodeURIComponent(roleId)}/name`, {
    method: 'POST',
    body: JSON.stringify({ displayNameSealed: await ring.sealName(roleId, name) })
  });
}

export const retypeRole = (roleId: string, kind: 'role' | 'group'): Promise<{ ok: boolean }> =>
  call<{ ok: boolean }>(`/workspace/roles/${encodeURIComponent(roleId)}/kind`, {
    method: 'POST',
    body: JSON.stringify({ kind })
  });

export const revokeRole = (roleId: string): Promise<{ ok: boolean }> =>
  call<{ ok: boolean }>(`/workspace/roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' });
