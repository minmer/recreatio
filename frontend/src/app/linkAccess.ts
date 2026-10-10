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
 *
 * <b>Mit Ziel, auch ohne Konto (0073).</b> Ein Link kann eine Adresse öffnen
 * (`#/<ziel>?dostep=T`). Der Browser behält ihn (`linkKeep.ts`), schickt bei
 * Seiten und Kalendern den Beweis mit (`heldProofs`) und öffnet mit den
 * Schlüsseln der Linkrolle (`heldLinkKeys`), was sie lesen darf. Einem
 * Konto hinzugefügt (`redeemLink`) gilt er überall und zum Schreiben.
 *
 * <b>Ein Link gibt eine ROLLE (0091)</b>, nicht Bereiche: die Linkrolle hält
 * die gewählten Rollen („Rada parafialna"), und was die Rolle darf, darf wer
 * den Link hat. Ändert sich die Rolle, ändert sich jeder Link mit, der sie
 * gibt. Ältere Links, die Bereiche direkt geben, gelten weiter.
 */

import { epochAad, joinArea, loadMembers } from './area';
import { walkBundle, type RoleBundle } from './roleBundle';
import {
  aad, derive, Field, fromBase64Url, open, seal, sha256Bytes, toBase64Url, unwrapKey, wrapKey, KEY_SIZE
} from './crypto';
import { heldLinks, linkGeneration, linkHref, nameLink } from './linkKeep';
import { newId } from './ids';
import type { Ring, SealedRole } from './keys';
import { addHolder, createRoleWithKeys, signEdge } from './roles';
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
  /** 0073 — wo er aufgeht (der Weg hinter `#/`), `null`: auf der Seite „Dołącz". */
  readonly aim: string | null;
  /** 0091 — die Rollen, die er gibt (leer: ein Link der alten Art, direkt zu Bereichen; fehlt beim alten Dienst). */
  readonly roles?: readonly string[];
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
  readonly aim: string | null;
  /** 0091 — die Rollen, die er gibt (ihre Namen liegen verschlossen). */
  readonly roles?: readonly string[];
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
    return linkUrl(new TextDecoder().decode(await open(ring.keyOf(row.roleId), tokenAad(row.invitationId), fromBase64Url(row.tokenSealed))), row.aim);
  } catch {
    return null;
  }
}

/**
 * Die Adresse, die verschickt wird — das Geheimnis steht hinter der Raute und
 * geht nie an einen Server. Mit Ziel: `#/<ziel>?dostep=T`, sonst `#/dolacz/T`.
 */
export function linkUrl(token: string, aim: string | null = null): string {
  return linkHref(`${window.location.origin}${window.location.pathname}`, token, aim);
}

/**
 * Das Ziel aus dem, was jemand eingibt — ein Weg (`parish/x`), `#/parish/x`
 * oder die ganze Adresse. Dieselbe Regel wie `HeldLinks.NormaliseAim`.
 */
export function aimOf(text: string, here: string = typeof window === 'undefined' ? '' : window.location.hostname): { aim: string | null } | { error: string } {
  let t = text.trim();
  if (t === '') return { aim: null };
  const hash = t.indexOf('#');
  if (t.includes('://')) {
    let host = '';
    try { host = new URL(t).hostname.toLowerCase(); } catch { return { error: 'To nie jest adres.' }; }
    if (!['recreatio.pl', 'www.recreatio.pl', 'localhost', '127.0.0.1', here].includes(host)) {
      return { error: 'Cel musi być adresem na recreatio.pl.' };
    }
    if (hash < 0) return { aim: null };
  }
  if (hash >= 0) t = t.slice(hash + 1);
  t = t.replace(/^\/+/, '');
  if (t === '' || t === 'dolacz' || t.startsWith('dolacz/')) return { aim: null };
  if (t.length > 400) return { error: 'Cel: najwyżej 400 znaków.' };
  if (/[\s#<>"\\`]/.test(t)) return { error: 'W adresie celu są niedozwolone znaki.' };
  return { aim: t };
}

export const setLinkAim = (invitationId: string, aim: string | null): Promise<{ aim: string | null }> =>
  call(`/workspace/invite/${encodeURIComponent(invitationId)}/aim`, { method: 'POST', body: JSON.stringify({ aim }) });

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
    /** 0074 — je Bereich seine eigene Stufe: in der Rada lesen, in der Oaza schreiben. Die alte Art; neu: `roles`. */
    areas?: readonly { readonly areaId: string; readonly capability: LinkLevel }[];
    /**
     * 0091 — DIE ROLLEN, DIE DER LINK GIBT. `lead`: wer ihn einlöst, führt die
     * Rolle (nimmt in ihrem Namen auf); sonst gehört er nur dazu.
     */
    roles?: readonly { readonly roleId: string; readonly lead: boolean }[];
    /** Nach dem ersten Einlösen gilt er nicht mehr. */
    once: boolean;
    maxUses?: number | null;
    expiresDays: number;
    /** 0073 — wo der Link aufgeht. */
    aim?: string | null;
  },
  progress: (step: string) => void = () => undefined
): Promise<{ url: string; invitationId: string; token: string }> {
  const areas = what.areas ?? [];
  const roles = what.roles ?? [];
  if (areas.length === 0 && roles.length === 0) throw new WorkspaceError('Wybierz rolę, którą daje link.');
  /*
   * Die stärkste Stufe steht am Link selbst — sie entscheidet, ob der
   * Signierschlüssel der Linkrolle mitgeht. Bei Rollen: „prowadzi", wenn er
   * eine davon führen lässt, sonst nur dabei sein („czyta" — was die Rolle
   * darf, sagen ihre Bereiche, nicht der Link).
   */
  const strongest = roles.length > 0
    ? (roles.some((r) => r.lead) ? 'admin' : 'read')
    : highestLevel(areas.map((a) => a.capability));

  /* Erst prüfen, ob ich überall hineinlassen darf — bevor eine Rolle entsteht, die dann nirgends hinein kann. */
  const issuers = new Map<string, string>();
  for (const { areaId } of areas) {
    const issuer = await issuerIn(ring, areaId);
    if (issuer === null) throw new WorkspaceError('W jednym z wybranych obszarów nie możesz nikogo wpuścić.');
    issuers.set(areaId, issuer);
  }
  for (const { roleId, lead } of roles) {
    if (!ring.has(roleId)) throw new WorkspaceError('Link może dawać tylko rolę, którą masz.');
    if (lead && !ring.maySign(roleId)) throw new WorkspaceError('Prowadzenie roli może dać tylko ten, kto ją prowadzi.');
  }

  progress('Liczenie kluczy linku…');
  const label = what.label.trim() === '' ? 'Link' : what.label.trim();
  const role = await createRoleWithKeys(ring, holder, { kind: 'role', name: `Link: ${label}` });

  for (const { areaId, capability } of areas) {
    progress('Otwieranie obszarów dla linku…');
    await joinArea(ring, areaId, { id: role.id, kind: 'role', wrapPublicKey: role.wrapPublicKey },
      issuers.get(areaId)!, capability);
  }

  /* 0091 — die Linkrolle HÄLT die gewählten Rollen: unterschrieben in ihrem Namen, mit dem eben entstandenen Schlüssel. */
  if (roles.length > 0) {
    const withLink = ring.withRole(role.role, role.roleKey, role.signKey);
    for (const { roleId, lead } of roles) {
      progress('Łączenie linku z rolą…');
      await addHolder(withLink, roleId, role.role, 'holds', lead);
    }
  }

  progress('Pieczętowanie linku…');
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(KEY_SIZE)));
  const { lookup, sealKey } = await linkSecrets(token);
  const invitationId = newId();
  const sealed = await seal(sealKey, keysAad(invitationId), new TextEncoder().encode(JSON.stringify({
    roleKey: toBase64Url(role.roleKey),
    /* Den Signierschlüssel nur, wenn der Link „prowadzi" — sonst verlässt er diesen Browser nicht. */
    signKey: strongest === 'admin' ? toBase64Url(role.signKey) : null
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
      capability: strongest,
      aim: what.aim ?? null
    })
  });

  return { url: linkUrl(token, what.aim ?? null), invitationId, token };
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

const RANK: Record<LinkLevel, number> = { read: 1, write: 2, admin: 3 };

export const highestLevel = (levels: readonly LinkLevel[]): LinkLevel =>
  levels.reduce<LinkLevel>((best, one) => (RANK[one] > RANK[best] ? one : best), 'read');

/** 0074 — was ein Link gibt, je Bereich: „Oaza — pisze · Rada — czyta". */
export const accessWords = (areas: readonly LinkArea[]): string =>
  areas.length === 0 ? 'bez obszarów' : areas.map((a) => `${a.name} — ${LEVEL_WORD[a.capability] ?? a.capability}`).join(' · ');

/* -- Links in diesem Browser (0073) ------------------------------------------------------- */

const proofCache = new Map<string, Promise<string>>();

/** Der Beweis zu einem Geheimnis — einmal je Tab gerechnet. */
const proofOf = (token: string): Promise<string> => {
  let found = proofCache.get(token);
  if (found === undefined) {
    found = linkSecrets(token).then((s) => toBase64Url(s.proof));
    proofCache.set(token, found);
  }
  return found;
};

/** Die Beweise aller Links, die dieser Browser hält — für `links=` an Seite und Kalender. */
export async function heldProofs(): Promise<string[]> {
  const out: string[] = [];
  for (const one of heldLinks()) {
    try { out.push(await proofOf(one.token)); } catch { /* unlesbar: übergehen */ }
  }
  return out;
}

/** Ein Link in diesem Browser, wie der Dienst ihn sieht — `info: null`: gilt nicht (mehr). */
export interface HeldInfo {
  readonly token: string;
  readonly aim: string | null;
  readonly label: string | null;
  readonly info: {
    readonly invitationId: string;
    readonly roleId: string;
    readonly label: string | null;
    readonly capability: LinkLevel | null;
    readonly expiresAt: string;
    readonly areas: readonly LinkArea[];
  } | null;
}

/**
 * Die Rolle eines Links, offen — ihr Schlüssel kommt aus dem Geheimnis des
 * Links, nicht aus einem Konto. Daraus baut `linkMe.ts` den Bund, mit dem
 * dieser Browser als Link HANDELT (nicht nur liest).
 */
export interface HeldRole {
  readonly token: string;
  readonly roleId: string;
  readonly label: string | null;
  readonly roleKey: Uint8Array;
  readonly wrapPrivateSealed: string;
  /** Was diese Rolle SELBST darf — daran wählt `linkMe`, als wer geschrieben wird. */
  readonly areas: readonly LinkArea[];
  /** 0091 — nicht die Linkrolle selbst, sondern eine, die sie hält (die Rolle, die der Link gibt). */
  readonly via?: string;
}

export interface HeldKeys {
  readonly links: readonly HeldInfo[];
  /** Bereich → Epoche → Schlüssel: was die Linkrollen lesen. */
  readonly areaKeys: ReadonlyMap<string, ReadonlyMap<number, Uint8Array>>;
  /** Die Linkrollen selbst, mit offenem Schlüssel — nur im Speicher dieses Tabs. */
  readonly roles: readonly HeldRole[];
}

interface HeldAnswer {
  readonly links: readonly {
    readonly lookup: string;
    readonly invitationId: string;
    readonly roleId: string;
    readonly label: string | null;
    readonly capability: LinkLevel | null;
    readonly aim: string | null;
    readonly expiresAt: string;
    readonly sealedRoleKey: string;
    readonly wrapPrivateSealed: string | null;
    readonly areas: readonly LinkArea[];
    readonly grants: readonly { areaId: string; epoch: number; sealedBlob: string }[];
    /** 0091 — der Weg zu den Rollen, die der Link gibt (fehlt beim alten Dienst). */
    readonly bundle?: RoleBundle;
  }[];
}

const roleWrapAad = (roleId: string) => aad('kernel', 'role', roleId, Field.RoleWrapPrivate, 1);

let keysCache: { stamp: string; keys: Promise<HeldKeys> } | null = null;

/**
 * DIE SCHLÜSSEL DER LINKS IN DIESEM BROWSER — ohne Konto. Je Link: aus T der
 * Siegelschlüssel, daraus der Rollenschlüssel, daraus der private
 * Verpackungsschlüssel der Linkrolle, daraus die Epochen ihrer Bereiche.
 * Einmal je Tab und Stand der Links.
 */
export function heldLinkKeys(): Promise<HeldKeys> {
  const held = heldLinks();
  const stamp = `${linkGeneration()}:${held.map((h) => h.token).sort().join(',')}`;
  if (keysCache !== null && keysCache.stamp === stamp) return keysCache.keys;
  const keys = (async (): Promise<HeldKeys> => {
    if (held.length === 0) return { links: [], areaKeys: new Map(), roles: [] };
    const secrets = new Map<string, { token: string; sealKey: Uint8Array; proof: string }>();
    for (const one of held) {
      try {
        const s = await linkSecrets(one.token);
        secrets.set(s.lookup, { token: one.token, sealKey: s.sealKey, proof: toBase64Url(s.proof) });
      } catch { /* unlesbar */ }
    }
    const answer = await call<HeldAnswer>('/links/keys', {
      method: 'POST',
      credentials: 'omit',
      body: JSON.stringify({ proofs: [...secrets.values()].map((s) => s.proof) })
    });
    const areaKeys = new Map<string, Map<number, Uint8Array>>();
    const roles: HeldRole[] = [];
    const valid = new Map<string, HeldInfo['info']>();
    for (const link of answer.links) {
      const mine = secrets.get(link.lookup);
      if (mine === undefined) continue;
      valid.set(mine.token, {
        invitationId: link.invitationId, roleId: link.roleId, label: link.label,
        capability: link.capability, expiresAt: link.expiresAt, areas: link.areas
      });
      nameLink(mine.token, link.label);
      if (link.wrapPrivateSealed === null) continue;
      try {
        const sealed = JSON.parse(new TextDecoder().decode(
          await open(mine.sealKey, keysAad(link.invitationId), fromBase64Url(link.sealedRoleKey)))) as { roleKey: string };
        const roleKey = fromBase64Url(sealed.roleKey);
        const wrapPrivate = await open(roleKey, roleWrapAad(link.roleId), fromBase64Url(link.wrapPrivateSealed));
        const names = new Map(link.areas.map((a) => [a.areaId, a.name]));
        const own = link.bundle?.roles.find((r) => r.roleId === link.roleId)?.rights;
        roles.push({
          token: mine.token, roleId: link.roleId, label: link.label, roleKey, wrapPrivateSealed: link.wrapPrivateSealed,
          /* Was die Linkrolle selbst darf; ein alter Dienst sagt das nicht — dann, was der Link gibt. */
          areas: own === undefined ? link.areas : own.map((r) => ({ areaId: r.areaId, name: names.get(r.areaId) ?? '', capability: r.capability }))
        });
        for (const grant of link.grants) {
          try {
            const key = await unwrapKey(wrapPrivate, epochAad(grant.areaId, grant.epoch), fromBase64Url(grant.sealedBlob));
            const epochs = areaKeys.get(grant.areaId) ?? new Map<number, Uint8Array>();
            epochs.set(grant.epoch, key);
            areaKeys.set(grant.areaId, epochs);
          } catch { /* eine Zuteilung, die nicht aufgeht, nimmt den anderen nichts */ }
        }

        /*
         * 0091 — DIE ROLLEN, DIE DER LINK GIBT: von der Linkrolle aus, so weit die
         * Hüllen reichen. Jede wird eine Rolle dieses Browsers (`linkMe`), mit
         * dem, was sie selbst darf.
         */
        if (link.bundle !== undefined) {
          const walked = await walkBundle(new Map([[link.roleId, roleKey]]), link.bundle);
          for (const [areaId, epochs] of walked.areaKeys) {
            const had = areaKeys.get(areaId) ?? new Map<number, Uint8Array>();
            for (const [epoch, key] of epochs) had.set(epoch, key);
            areaKeys.set(areaId, had);
          }
          for (const [roleId, key] of walked.roleKeys) {
            const held = link.bundle.roles.find((r) => r.roleId === roleId);
            if (roleId === link.roleId || held?.wrapPrivateSealed == null || roles.some((r) => r.roleId === roleId)) continue;
            roles.push({
              token: mine.token, roleId, label: link.label, roleKey: key, wrapPrivateSealed: held.wrapPrivateSealed, via: link.roleId,
              areas: (held.rights ?? []).map((r) => ({ areaId: r.areaId, name: names.get(r.areaId) ?? '', capability: r.capability }))
            });
          }
        }
      } catch { /* der Link passt nicht zu seinen Schlüsseln — dann nur, was der Dienst ohnehin zeigt */ }
    }
    return {
      links: held.map((one) => ({ token: one.token, aim: one.aim, label: valid.get(one.token)?.label ?? one.label, info: valid.get(one.token) ?? null })),
      areaKeys,
      roles
    };
  })();
  keysCache = { stamp, keys };
  keys.catch(() => { if (keysCache?.keys === keys) keysCache = null; });
  return keys;
}

/** Ein Schlüssel einer Bereichsepoche aus den Links dieses Browsers — oder `null`. */
export async function heldAreaKey(areaId: string, epoch: number): Promise<Uint8Array | null> {
  if (heldLinks().length === 0) return null;
  try {
    return (await heldLinkKeys()).areaKeys.get(areaId)?.get(epoch) ?? null;
  } catch {
    return null;
  }
}
