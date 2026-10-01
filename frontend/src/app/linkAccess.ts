/**
 * LINKI DOSTĘPU (0065) — ein Link, der einem Konto Zugang zu einem oder
 * mehreren Bereichen gibt: czyta, pisze oder prowadzi.
 *
 * <b>Der Link ist eine Rolle.</b> Hier entsteht sie („Link: Rada parafialna"),
 * bekommt die Bereiche wie jede andere Rolle (`joinArea`), und ihre beiden
 * Schlüssel werden unter einem Schlüssel versiegelt, der aus dem Geheimnis im
 * Link abgeleitet ist. Der Dienst sieht weder das Geheimnis noch einen
 * Schlüssel — nur den Abdruck eines Beweises:
 *
 * <code>
 *   T          32 Zufallsbytes, nur im Link (#/dolacz/T)
 *   proof      HKDF(T, "recreatio:v1:invite:proof") — geht beim Einlösen hinaus
 *   lookup     SHA-256(proof) — darunter liegt der Link beim Dienst
 *   sealKey    HKDF(T, "recreatio:v1:invite:seal") — bleibt im Browser
 * </code>
 *
 * <b>Einlösen</b> heisst: die eigene Person an die Linkrolle hängen — eine
 * Kante, die DIESE Person unterschreibt, und eine Zuteilung, die DIESER
 * Browser verpackt. Den Signierschlüssel bekommt nur, wer „prowadzi" — wer
 * liest oder schreibt, braucht ihn nicht und kann den Zugang so nicht
 * weitergeben.
 */

import { joinArea, loadMembers } from './area';
import {
  aad, derive, Field, fromBase64Url, open, seal, sha256Bytes, toBase64Url, wrapKey, KEY_SIZE
} from './crypto';
import { newId } from './ids';
import type { Ring, SealedRole } from './keys';
import { createRoleWithKeys, signEdge } from './roles';
import { call, WorkspaceError } from './session';

export type LinkLevel = 'read' | 'write' | 'admin';

export const LINK_LEVELS: readonly { value: LinkLevel; label: string; says: string }[] = [
  { value: 'read', label: 'Czyta', says: 'widzi, co jest w obszarze' },
  { value: 'write', label: 'Pisze', says: 'widzi i dopisuje' },
  { value: 'admin', label: 'Prowadzi', says: 'może też wpuszczać innych' }
];

export interface LinkArea {
  readonly areaId: string;
  readonly name: string;
  readonly capability: string;
}

export interface LinkRow {
  readonly invitationId: string;
  readonly roleId: string;
  readonly label: string | null;
  readonly capability: LinkLevel | null;
  /** `null`: bez limitu. */
  readonly maxUses: number | null;
  readonly used: number;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly areas: readonly LinkArea[];
  readonly redeemed: readonly { roleId: string; at: string; active: boolean }[];
  /** 0072 — das Geheimnis, versiegelt unter dem Schlüssel der Linkrolle (`null`: älter als 0072). */
  readonly tokenSealed: string | null;
}

export interface LinkInfo {
  readonly invitationId: string;
  readonly roleId: string;
  readonly label: string | null;
  readonly capability: LinkLevel | null;
  readonly edgeKind: string;
  /** `null`: gilt; sonst `revoked`, `expired`, `used`. */
  readonly state: 'revoked' | 'expired' | 'used' | null;
  readonly once: boolean;
  readonly expiresAt: string;
  readonly sealedRoleKey: string;
  readonly areas: readonly LinkArea[];
}

const PROOF_INFO = 'recreatio:v1:invite:proof';
const SEAL_INFO = 'recreatio:v1:invite:seal';

/** Was aus dem Geheimnis im Link folgt. */
export async function linkSecrets(token: string): Promise<{ proof: Uint8Array; lookup: string; sealKey: Uint8Array }> {
  let raw: Uint8Array;
  try { raw = fromBase64Url(token); } catch { throw new WorkspaceError('Ten link jest niepełny — skopiuj go jeszcze raz w całości.'); }
  if (raw.length !== KEY_SIZE) throw new WorkspaceError('Ten link jest niepełny — skopiuj go jeszcze raz w całości.');

  const proof = await derive(raw, PROOF_INFO, 32);
  const sealKey = await derive(raw, SEAL_INFO, 32);
  return { proof, lookup: toBase64Url(await sha256Bytes(proof)), sealKey };
}

const keysAad = (invitationId: string) => aad('kernel', 'invitation', invitationId, Field.InvitationRoleKey, 1);
const tokenAad = (invitationId: string) => aad('kernel', 'invitation_token', invitationId, Field.InvitationRoleKey, 1);

/** Den Link noch einmal zeigen — wer die Linkrolle hält, öffnet ihn. `null`: geht nicht (mehr). */
export async function linkUrlOf(ring: Ring, row: LinkRow): Promise<string | null> {
  if (row.tokenSealed === null || !ring.has(row.roleId)) return null;
  try {
    return linkUrl(new TextDecoder().decode(await open(ring.keyOf(row.roleId), tokenAad(row.invitationId), fromBase64Url(row.tokenSealed))));
  } catch {
    return null;
  }
}

/** Die Adresse, die verschickt wird — das Geheimnis steht hinter der Raute und geht nie an einen Server. */
export function linkUrl(token: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/dolacz/${token}`;
}

export const loadLinks = (): Promise<{ invites: readonly LinkRow[] }> => call('/workspace/invites');

export const showLink = (lookup: string): Promise<LinkInfo> => call(`/invite/${encodeURIComponent(lookup)}`);

export const revokeLink = (invitationId: string, dropMembers: boolean): Promise<{ revoked: boolean; dropped: boolean }> =>
  call(`/workspace/invite/${encodeURIComponent(invitationId)}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ dropMembers })
  });

/**
 * Wer in einem Bereich hineinlassen darf — eine meiner Rollen mit `admin`
 * oder `certify`, deren Signierschlüssel ich halte. `null`: keine.
 */
export async function issuerIn(ring: Ring, areaId: string): Promise<string | null> {
  const { members } = await loadMembers(areaId);
  return members.find((m) =>
    (m.capabilities.includes('admin') || m.capabilities.includes('certify')) && ring.maySign(m.roleId))?.roleId ?? null;
}

/**
 * EINEN LINK ANLEGEN. Das dauert: die Linkrolle braucht zwei RSA-4096-Paare
 * (wie jede Rolle), und jeder Bereich je Epoche eine Zuteilung.
 */
export async function createLink(
  ring: Ring,
  holder: SealedRole,
  what: {
    label: string;
    areaIds: readonly string[];
    capability: LinkLevel;
    /** Nach dem ersten Einlösen gilt er nicht mehr. */
    once: boolean;
    maxUses?: number | null;
    expiresDays: number;
  },
  progress: (step: string) => void = () => undefined
): Promise<{ url: string; invitationId: string }> {
  if (what.areaIds.length === 0) throw new WorkspaceError('Wybierz co najmniej jeden obszar.');

  /* Erst prüfen, ob ich überall hineinlassen darf — bevor eine Rolle entsteht, die dann nirgends hinein kann. */
  const issuers = new Map<string, string>();
  for (const areaId of what.areaIds) {
    const issuer = await issuerIn(ring, areaId);
    if (issuer === null) throw new WorkspaceError('W jednym z wybranych obszarów nie możesz nikogo wpuścić.');
    issuers.set(areaId, issuer);
  }

  progress('Liczenie kluczy linku…');
  const label = what.label.trim() === '' ? 'Link' : what.label.trim();
  const role = await createRoleWithKeys(ring, holder, { kind: 'role', name: `Link: ${label}` });

  for (const areaId of what.areaIds) {
    progress('Otwieranie obszarów dla linku…');
    await joinArea(ring, areaId, { id: role.id, kind: 'role', wrapPublicKey: role.wrapPublicKey },
      issuers.get(areaId)!, what.capability);
  }

  progress('Pieczętowanie linku…');
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(KEY_SIZE)));
  const { lookup, sealKey } = await linkSecrets(token);
  const invitationId = newId();
  const sealed = await seal(sealKey, keysAad(invitationId), new TextEncoder().encode(JSON.stringify({
    roleKey: toBase64Url(role.roleKey),
    /* Den Signierschlüssel nur, wenn der Link „prowadzi" — sonst verlässt er diesen Browser nicht. */
    signKey: what.capability === 'admin' ? toBase64Url(role.signKey) : null
  })));

  const tokenSealed = await seal(role.roleKey, tokenAad(invitationId), new TextEncoder().encode(token));

  await call('/workspace/invites', {
    method: 'POST',
    body: JSON.stringify({
      invitationId,
      roleId: role.id,
      tokenSha256: lookup,
      sealedRoleKey: toBase64Url(sealed),
      tokenSealed: toBase64Url(tokenSealed),
      label,
      maxUses: what.once ? 1 : what.maxUses ?? null,
      expiresDays: what.expiresDays,
      capability: what.capability
    })
  });

  return { url: linkUrl(token), invitationId };
}

/**
 * DEN LINK EINLÖSEN — als diese Person. Die Schlüssel der Linkrolle gehen
 * hier auf, werden für die Person verpackt, und die Kante unterschreibt sie.
 */
export async function redeemLink(ring: Ring, person: SealedRole, token: string, info: LinkInfo): Promise<{ areas: readonly LinkArea[] }> {
  const { proof, sealKey } = await linkSecrets(token);

  let keys: { roleKey: string; signKey: string | null };
  try {
    keys = JSON.parse(new TextDecoder().decode(await open(sealKey, keysAad(info.invitationId), fromBase64Url(info.sealedRoleKey))));
  } catch {
    throw new WorkspaceError('Ten link nie pasuje do zaproszenia — skopiuj go jeszcze raz w całości.');
  }

  const holderKey = fromBase64Url(person.wrapPublicKey);
  const grant = await wrapKey(holderKey, aad('kernel', 'role_grant', info.roleId, Field.RoleWrapPrivate, 1), fromBase64Url(keys.roleKey));
  const signGrant = keys.signKey === null ? null
    : await wrapKey(holderKey, aad('kernel', 'role_grant', info.roleId, Field.RoleSignPrivate, 1), fromBase64Url(keys.signKey));
  const edge = await signEdge(ring, person.id, info.roleId, 'holds');

  return call('/workspace/invite/redeem', {
    method: 'POST',
    body: JSON.stringify({
      proof: toBase64Url(proof),
      holderRoleId: person.id,
      edge,
      grantSealedBlob: toBase64Url(grant),
      signGrantSealedBlob: signGrant === null ? null : toBase64Url(signGrant)
    })
  });
}

/** Wie der Zustand eines Links in einem Wort heisst. */
export function linkState(row: Pick<LinkRow, 'revokedAt' | 'expiresAt' | 'maxUses' | 'used'>, now: number = Date.now()): string {
  if (row.revokedAt !== null) return 'wycofany';
  if (Date.parse(row.expiresAt) <= now) return 'wygasł';
  if (row.maxUses !== null && row.used >= row.maxUses) return 'wykorzystany';
  return 'działa';
}

export const LEVEL_WORD: Record<string, string> = { read: 'czyta', write: 'pisze', admin: 'prowadzi' };
