/**
 * DIE ROLLEN DER MENSCHEN EINES FORMULARS (0091; 0120 mehrere).
 *
 * Wer ein Formular einsendet, bekommt einen Platz (einen Link ohne Konto).
 * Gibt das Formular Rollen („Uczestnicy Rocket 2026", „Ministranci"), gehört
 * der Platz zu jeder von ihnen: was eine Rolle darf — ihre Bereiche, ihre
 * Rozmowy, ihre Kalender —, darf er. Der Dienst weiss das sofort; LESEN kann
 * der Platz erst, wenn er den Schlüssel der Rolle hat.
 *
 * <b>Den gibt ein Mitglied weiter</b> — ein Browser, der die Rolle hält und den
 * Platzschlüssel öffnen kann (die Kanzlei: Annahmeschlüssel oder Epoche des
 * Bereichs). Er versiegelt den Rollenschlüssel unter dem Platzschlüssel; der
 * Dienst legt die Hülle ab und sieht nichts. Das geschieht ohne Klick: beim
 * Öffnen des Formulars und wenn die Glocke sagt, dass jemand wartet.
 *
 * <code>
 *   Platzschlüssel ─► Rollenschlüssel (seatRoleAad) ─► walkBundle ─► Bereiche der Rolle
 * </code>
 */

import { myEpochKeys } from '../areas/area';
import { aad, Field, fromBase64Url, open, seal, toBase64Url } from '../core/crypto';
import { loadIntake, openIntakeKey } from '../forms/intake';
import type { Ring } from '../core/keys';
import type { LinkArea } from '../links/linkAccess';
import { rememberSeatAreaKeys, walkBundle, type RoleBundle } from './roleBundle';
import { openSeatName } from '../core/names';
import { officeSeatKey } from '../seats/seat';
import { call } from '../core/session';

export interface WaitingSeat {
  readonly seatId: string;
  readonly areaId: string;
  readonly epoch: number;
  readonly origin: 'self' | 'office';
  readonly seatKeyForIntake: string | null;
  readonly seatKeyForArea: string | null;
  /** 0097 — geöffnet von `loadFormMembers` (versiegelt unter dem Schlüssel seines Bereichs). */
  readonly recipientName: string | null;
  readonly nameSealed?: string | null;
  readonly nameEpoch?: number | null;
}

/** Der Stand EINER Rolle des Formulars. */
export interface MemberRoleState {
  readonly roleId: string;
  /** Hält dieses Konto die Rolle — nur dann kann es ihren Schlüssel weitergeben. */
  readonly holdsRole: boolean;
  /** Wozu die Rolle führt. */
  readonly areas: readonly LinkArea[];
  /** Menschen, die zu ihr gehören … */
  readonly members: number;
  /** … und schon ihren Schlüssel haben. */
  readonly sealed: number;
  /** Wer noch wartet und von diesem Konto den Schlüssel bekommen kann. */
  readonly waiting: readonly WaitingSeat[];
}

export interface MemberState {
  readonly moduleId: string;
  /** 0120 — alle Rollen, in ihrer Reihenfolge (leer: das Formular gibt keine). */
  readonly roles: readonly MemberRoleState[];
  /** Menschen mit Link, deren Einsendung lebt. */
  readonly seats: number;
}

const base = (partId: string) => `/workspace/part/${encodeURIComponent(partId)}/members`;

interface MemberWire {
  readonly moduleId: string;
  readonly seats: number;
  readonly roles?: readonly MemberRoleState[];
  /* Der Dienst vor 0120: eine Rolle, in diesen Feldern. */
  readonly roleId?: string | null;
  readonly holdsRole?: boolean;
  readonly areas?: readonly LinkArea[];
  readonly members?: number;
  readonly sealed?: number;
  readonly waiting?: readonly WaitingSeat[];
}

/** Die Antwort in EINER Gestalt — auch die eines Dienstes von vor 0120, der genau eine Rolle kannte. */
export function memberStateOf(wire: MemberWire): MemberState {
  const roles = wire.roles ?? (wire.roleId === null || wire.roleId === undefined ? [] : [{
    roleId: wire.roleId,
    holdsRole: wire.holdsRole ?? false,
    areas: wire.areas ?? [],
    members: wire.members ?? 0,
    sealed: wire.sealed ?? 0,
    waiting: wire.waiting ?? []
  }]);
  return { moduleId: wire.moduleId, seats: wire.seats, roles };
}

export async function loadFormMembers(partId: string): Promise<MemberState> {
  const state = memberStateOf(await call<MemberWire>(base(partId)));
  const roles = await Promise.all(state.roles.map(async (role) => ({
    ...role,
    waiting: await Promise.all(role.waiting.map(async (seat) => ({ ...seat, recipientName: await openSeatName(seat) })))
  })));
  return { ...state, roles };
}

/**
 * 0120 — die ganze Liste der Rollen setzen (leer: keine). `roleId` geht mit:
 * ein Dienst von vor 0120 kennt nur das Feld und setzt dann die erste Rolle,
 * statt die Liste zu übersehen und das Formular ohne Rolle zu lassen.
 */
export const setMemberRoles = (partId: string, roleIds: readonly string[]): Promise<{ roleIds?: string[]; roleId: string | null }> =>
  call(`${base(partId)}/role`, { method: 'POST', body: JSON.stringify({ roleId: roleIds[0] ?? null, roleIds }) });

/** Eine Rolle (oder keine) — so, wie vor 0120: ersetzt die ganze Liste. */
export const setMemberRole = (partId: string, roleId: string | null): Promise<{ roleId: string | null }> =>
  call(`${base(partId)}/role`, { method: 'POST', body: JSON.stringify({ roleId }) });

/** „Przenieś obecne zgłoszenia" — wer schon eingesandt hat, gehört ab jetzt auch zu den Rollen. */
export const enrollMembers = (partId: string): Promise<{ added: number }> =>
  call(`${base(partId)}/enroll`, { method: 'POST' });

/** Je Platz UND Rolle ein Etikett — eine Hülle lässt sich nicht an einen anderen Platz oder eine andere Rolle hängen. */
export const seatRoleAad = (seatId: string, roleId: string) => aad('seat', 'access_role', `${seatId}.${roleId}`, Field.SeatRoleKey, 1);

/** Ein Platz, so weit die Kanzlei ihn braucht, um seinen Schlüssel zu öffnen. */
export type SeatEnvelope = Pick<WaitingSeat, 'seatId' | 'areaId' | 'epoch' | 'origin' | 'seatKeyForIntake' | 'seatKeyForArea'>;

/**
 * PLATZSCHLÜSSEL ÖFFNEN, wie die Kanzlei es kann — je Bereich den
 * Annahmeschlüssel (selbst angemeldet) oder die Epoche (vom Amt ausgestellt)
 * nur EINMAL holen. `null`: dieser Bund öffnet den Platz nicht.
 */
export function seatOpener(ring: Ring): (seat: SeatEnvelope) => Promise<Uint8Array | null> {
  const intakes = new Map<string, Promise<Uint8Array | undefined>>();
  const epochs = new Map<string, Promise<Map<number, Uint8Array>>>();
  const intakeOf = (areaId: string) => {
    let found = intakes.get(areaId);
    if (found === undefined) {
      found = loadIntake(areaId).then((one) => openIntakeKey(one, ring)).catch(() => undefined);
      intakes.set(areaId, found);
    }
    return found;
  };
  const epochsOf = (areaId: string) => {
    let found = epochs.get(areaId);
    if (found === undefined) {
      found = myEpochKeys(ring, areaId).catch(() => new Map<number, Uint8Array>());
      epochs.set(areaId, found);
    }
    return found;
  };
  return async (seat) => seat.origin === 'self'
    ? officeSeatKey(seat, new Uint8Array(32), await intakeOf(seat.areaId))
    : officeSeatKey(seat, (await epochsOf(seat.areaId)).get(seat.epoch) ?? new Uint8Array(32));
}

/**
 * DIE SCHLÜSSEL DER ROLLEN WEITERGEBEN — je Rolle, die dieser Bund hält, an
 * jeden, der auf sie wartet und dessen Platzschlüssel er öffnet. Gibt zurück,
 * wie viele Hüllen abgelegt wurden. Ein Platz, der nicht aufgeht, wartet weiter
 * (auf jemand anderen).
 */
export async function handOverRoleKeys(ring: Ring, partId: string, known?: MemberState): Promise<number> {
  const state = known ?? await loadFormMembers(partId);
  const open = seatOpener(ring);

  const keys: { seatId: string; roleId: string; keySealed: string }[] = [];
  for (const role of state.roles) {
    if (!ring.has(role.roleId) || role.waiting.length === 0) continue;
    const roleKey = ring.keyOf(role.roleId);
    for (const seat of role.waiting) {
      const seatKey = await open(seat);
      if (seatKey === null) continue;
      keys.push({
        seatId: seat.seatId,
        roleId: role.roleId,
        keySealed: toBase64Url(await seal(seatKey, seatRoleAad(seat.seatId, role.roleId), roleKey))
      });
    }
  }

  let done = 0;
  for (let at = 0; at < keys.length; at += 200) {
    const { sealedCount } = await call<{ sealedCount: number }>(`${base(partId)}/keys`, {
      method: 'POST', body: JSON.stringify({ keys: keys.slice(at, at + 200) })
    });
    done += sealedCount;
  }
  return done;
}

/* -- Auf der Seite des Platzes ----------------------------------------------------------------- */

export interface SeatRoles {
  readonly held: readonly { readonly roleId: string; readonly keySealed: string | null }[];
  readonly bundle: RoleBundle | null;
}

export interface OpenedSeatRoles {
  /** Bereich → Epoche → Schlüssel, über die Rollen des Platzes. */
  readonly areaKeys: ReadonlyMap<string, ReadonlyMap<number, Uint8Array>>;
  /** Die Bereiche mit Namen und Kalendern — was er damit lesen kann. */
  readonly areas: RoleBundle['areas'];
  /** Rollen, deren Schlüssel noch nicht da ist. */
  readonly waiting: number;
}

/**
 * WAS DIE ROLLEN DES PLATZES AUFSCHLIESSEN — mit dem Platzschlüssel. Die
 * Schlüssel merkt sich dieser Tab (\`rememberSeatAreaKeys\`): ein Kalender oder
 * eine Seite der Rolle findet sie dort wie die eines Links.
 */
export async function openSeatRoles(seatId: string, seatKey: Uint8Array, roles: SeatRoles | null | undefined): Promise<OpenedSeatRoles> {
  if (roles === null || roles === undefined) return { areaKeys: new Map(), areas: [], waiting: 0 };
  const start = new Map<string, Uint8Array>();
  for (const one of roles.held) {
    if (one.keySealed === null) continue;
    try {
      start.set(one.roleId, await open(seatKey, seatRoleAad(seatId, one.roleId), fromBase64Url(one.keySealed)));
    } catch { /* eine Hülle, die nicht aufgeht, nimmt den anderen nichts */ }
  }
  const walked = await walkBundle(start, roles.bundle);
  rememberSeatAreaKeys(walked.areaKeys);
  return {
    areaKeys: walked.areaKeys,
    areas: (roles.bundle?.areas ?? []).filter((a) => walked.areaKeys.has(a.areaId)),
    waiting: roles.held.filter((one) => one.keySealed === null).length
  };
}
