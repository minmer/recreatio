/**
 * DIE ROLLE DER MENSCHEN EINES FORMULARS (0091).
 *
 * Wer ein Formular einsendet, bekommt einen Platz (einen Link ohne Konto).
 * Hat das Formular eine Rolle („Uczestnicy Rocket 2026"), gehört der Platz zu
 * ihr: was die Rolle darf — ihre Bereiche, ihre Rozmowy, ihre Kalender —,
 * darf er. Der Dienst weiss das sofort; LESEN kann der Platz erst, wenn er den
 * Schlüssel der Rolle hat.
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

import { myEpochKeys } from './area';
import { aad, Field, fromBase64Url, open, seal, toBase64Url } from './crypto';
import { loadIntake, openIntakeKey } from './intake';
import type { Ring } from './keys';
import type { LinkArea } from './linkAccess';
import { rememberSeatAreaKeys, walkBundle, type RoleBundle } from './roleBundle';
import { officeSeatKey } from './seat';
import { call } from './session';

export interface WaitingSeat {
  readonly seatId: string;
  readonly areaId: string;
  readonly epoch: number;
  readonly origin: 'self' | 'office';
  readonly seatKeyForIntake: string | null;
  readonly seatKeyForArea: string | null;
  readonly recipientName: string | null;
}

export interface MemberState {
  readonly moduleId: string;
  readonly roleId: string | null;
  /** Hält dieses Konto die Rolle — nur dann kann es ihren Schlüssel weitergeben. */
  readonly holdsRole: boolean;
  /** Wozu die Rolle führt. */
  readonly areas: readonly LinkArea[];
  /** Menschen mit Link, deren Einsendung lebt. */
  readonly seats: number;
  /** Davon: die zur Rolle gehören … */
  readonly members: number;
  /** … und schon ihren Schlüssel haben. */
  readonly sealed: number;
  /** Wer noch wartet und von diesem Konto den Schlüssel bekommen kann. */
  readonly waiting: readonly WaitingSeat[];
}

const base = (partId: string) => `/workspace/part/${encodeURIComponent(partId)}/members`;

export const loadFormMembers = (partId: string): Promise<MemberState> => call(base(partId));

export const setMemberRole = (partId: string, roleId: string | null): Promise<{ roleId: string | null }> =>
  call(`${base(partId)}/role`, { method: 'POST', body: JSON.stringify({ roleId }) });

/** „Przenieś obecne zgłoszenia" — wer schon eingesandt hat, gehört ab jetzt auch zur Rolle. */
export const enrollMembers = (partId: string): Promise<{ added: number }> =>
  call(`${base(partId)}/enroll`, { method: 'POST' });

/** Je Platz UND Rolle ein Etikett — eine Hülle lässt sich nicht an einen anderen Platz oder eine andere Rolle hängen. */
export const seatRoleAad = (seatId: string, roleId: string) => aad('seat', 'access_role', `${seatId}.${roleId}`, Field.SeatRoleKey, 1);

/**
 * DEN SCHLÜSSEL DER ROLLE WEITERGEBEN — an jeden, der wartet und dessen
 * Platzschlüssel dieser Bund öffnet. Gibt zurück, wie viele es bekamen. Ein
 * Platz, der nicht aufgeht, wartet weiter (auf jemand anderen).
 */
export async function handOverRoleKeys(ring: Ring, partId: string, known?: MemberState): Promise<number> {
  const state = known ?? await loadFormMembers(partId);
  if (state.roleId === null || !ring.has(state.roleId) || state.waiting.length === 0) return 0;
  const roleKey = ring.keyOf(state.roleId);

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

  const keys: { seatId: string; keySealed: string }[] = [];
  for (const seat of state.waiting) {
    const seatKey = seat.origin === 'self'
      ? await officeSeatKey(seat, new Uint8Array(32), await intakeOf(seat.areaId))
      : await officeSeatKey(seat, (await epochsOf(seat.areaId)).get(seat.epoch) ?? new Uint8Array(32));
    if (seatKey === null) continue;
    keys.push({ seatId: seat.seatId, keySealed: toBase64Url(await seal(seatKey, seatRoleAad(seat.seatId, state.roleId), roleKey)) });
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
