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
export const edgeValue = (edge: {
  id: string;
  fromRoleId: string;
  toRoleId: string;
  signerRoleId: string;
  createdAt: number;
}): Canon => O({
  createdAt: I(edge.createdAt),
  edgeKind: S('holds'),
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
  ring: Ring, holderRoleId: string, toRoleId: string
): Promise<SignedEdge> {
  const id = newId();
  const createdAt = nowSeconds();

  const signature = await signCanonical(
    await ring.signKey(holderRoleId),
    edgeValue({ id, fromRoleId: holderRoleId, toRoleId, signerRoleId: holderRoleId, createdAt })
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
export async function createRole(
  ring: Ring,
  holder: SealedRole,
  options: { kind: 'office' | 'member'; name: string }
): Promise<{ id: string }> {
  const id = newId();
  const pair = await newRolePair();
  const roleKey = crypto.getRandomValues(new Uint8Array(KEY_SIZE));

  const [wrapPrivateSealed, signPrivateSealed, displayNameSealed, grantSealedBlob] = await Promise.all([
    seal(roleKey, aad('kernel', 'role', id, Field.RoleWrapPrivate, 1), pair.wrapPrivateKey),
    seal(roleKey, aad('kernel', 'role', id, Field.RoleSignPrivate, 1), pair.signPrivateKey),
    seal(roleKey, aad('kernel', 'role', id, Field.RoleDisplayName, 1),
      new TextEncoder().encode(options.name.trim())),

    // Für den Halter verpackt — dafür reicht sein ÖFFENTLICHER Schlüssel. So
    // nimmt ein Verwalter jemanden auf, ohne dessen Geheimnisse zu kennen.
    wrapKey(fromBase64Url(holder.wrapPublicKey),
      aad('kernel', 'role_grant', id, Field.RoleWrapPrivate, 1), roleKey)
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
export async function addHolder(
  ring: Ring, roleId: string, holder: SealedRole
): Promise<{ id: string }> {
  const grantSealedBlob = await wrapKey(
    fromBase64Url(holder.wrapPublicKey),
    aad('kernel', 'role_grant', roleId, Field.RoleWrapPrivate, 1),
    ring.keyOf(roleId)
  );

  const edge = await signEdge(ring, holder.id, roleId);

  return call<{ id: string }>(`/workspace/roles/${encodeURIComponent(roleId)}/holders`, {
    method: 'POST',
    body: JSON.stringify({
      holderRoleId: holder.id,
      grantSealedBlob: toBase64Url(grantSealedBlob),
      edge
    })
  });
}

export const dropHolder = (roleId: string, holderRoleId: string): Promise<{ ok: boolean }> =>
  call<{ ok: boolean }>(
    `/workspace/roles/${encodeURIComponent(roleId)}/holders/${encodeURIComponent(holderRoleId)}`,
    { method: 'DELETE' });

/** Umbenennen. Der Name geht fertig versiegelt hinaus — der Dienst liest ihn nie. */
export async function renameRole(ring: Ring, roleId: string, name: string): Promise<{ ok: boolean }> {
  return call<{ ok: boolean }>(`/workspace/roles/${encodeURIComponent(roleId)}/name`, {
    method: 'POST',
    body: JSON.stringify({ displayNameSealed: await ring.sealName(roleId, name) })
  });
}

export const retypeRole = (roleId: string, kind: 'office' | 'member'): Promise<{ ok: boolean }> =>
  call<{ ok: boolean }>(`/workspace/roles/${encodeURIComponent(roleId)}/kind`, {
    method: 'POST',
    body: JSON.stringify({ kind })
  });

export const revokeRole = (roleId: string): Promise<{ ok: boolean }> =>
  call<{ ok: boolean }>(`/workspace/roles/${encodeURIComponent(roleId)}`, { method: 'DELETE' });
