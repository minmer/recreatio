/**
 * OBSZARY WIRTUALNE FORMULARZA (0120) — im Browser.
 *
 * Ein Formular gibt jedem, der es einsendet, zwei Dinge: ROLLEN (Zugang nach
 * aussen — zur Gruppe, zur Pfarrei; `memberRole.ts`) und für jeden
 * virtuellen Bereich einen eigenen KLEINBEREICH. Der virtuelle Bereich ist die
 * Regel: wer jeden Kleinbereich erreicht (die Rollen mit Zertifikat am
 * virtuellen Bereich) und ob der Einsender selbst hineinkommt
 * (`submitterLevel`).
 *
 * <b>Angewandt wird die Regel hier.</b> Der Dienst hat keine Schlüssel und
 * keine Unterschriften; ein Kleinbereich entsteht deshalb im Browser eines
 * Leiters, dessen Rolle am virtuellen Bereich `admin` oder `certify` hält:
 *
 * <code>
 *   Schlüssel (32 Byte, neu) ─┬─► RSA-Hülle je Rolle der Regel     (key_grant)
 *                             └─► AES-Hülle unter dem Platzschlüssel (access_grant), wenn der Einsender dazugehört
 *   Zertifikat je (Rolle, Stufe) der Regel, unterschrieben vom Aussteller
 * </code>
 *
 * Kommt am virtuellen Bereich eine Rolle dazu, trägt `applyVirtualArea` sie in
 * jedem Kleinbereich nach (dafür braucht er dessen Schlüssel — den hat jede
 * Rolle der Regel). Geht eine, nimmt der Dienst sie selbst überall zurück.
 */

import { createArea, epochAad, myEpochKeys, signedCertificate, type Capability } from '../areas/area';
import { KEY_SIZE, fromBase64Url, seal, toBase64Url, wrapKey } from '../core/crypto';
import { newId } from '../core/ids';
import type { Ring, SealedRole } from '../core/keys';
import { call } from '../core/session';
import { seatOpener, type SeatEnvelope } from '../roles/memberRole';

export type SubmitterLevel = 'none' | 'read' | 'write';

export const SUBMITTER_LEVELS: readonly SubmitterLevel[] = ['write', 'read', 'none'];

/** Was der Einsender in seinem Kleinbereich darf — in den Worten, die die Kanzlei liest. */
export const SUBMITTER_WORDS: Readonly<Record<SubmitterLevel, string>> = {
  write: 'osoba pisze',
  read: 'osoba czyta',
  none: 'osoba nie widzi'
};

export interface VirtualAreaRow {
  readonly areaId: string;
  readonly name: string;
  readonly submitterLevel: SubmitterLevel;
  readonly position: number;
  readonly currentEpoch: number;
  /** Wie viele Einsendungen ihren Kleinbereich schon haben … */
  readonly instances: number;
  /** … wie vielen er fehlt … */
  readonly missing: number;
  /** … und wie viele hinter der Regel zurück sind (ein Zertifikat fehlt). */
  readonly behind: number;
  readonly myLevel: 'read' | 'write' | 'admin' | null;
  readonly mayCertify: boolean;
}

export interface VirtualAreas {
  readonly moduleId: string;
  readonly formAreaId: string | null;
  /** Ohne Migration 0120 gibt es keine — dann `false`. */
  readonly ready: boolean;
  /** Einsendungen des Formulars (erste, nicht zurückgezogen, nicht ausgeblendet). */
  readonly registrations: number;
  readonly virtualAreas: readonly VirtualAreaRow[];
}

const part = (partId: string) => `/workspace/part/${encodeURIComponent(partId)}/virtual`;
const virtual = (areaId: string) => `/workspace/virtual/${encodeURIComponent(areaId)}`;

export const loadVirtualAreas = (partId: string): Promise<VirtualAreas> => call<VirtualAreas>(part(partId));

/**
 * Einen virtuellen Bereich anlegen: einen Bereich unter dem des Formulars (die
 * Person, die ihn anlegt, führt ihn), dann seine Bedeutung. Die Rollen der
 * Regel kommen danach dazu, wie in jeden Bereich (`joinArea`).
 */
export async function createVirtualArea(
  ring: Ring, person: SealedRole, partId: string, formAreaId: string, name: string, submitterLevel: SubmitterLevel
): Promise<{ areaId: string }> {
  const made = await createArea(ring, person, name, formAreaId);
  await call(part(partId), { method: 'POST', body: JSON.stringify({ areaId: made.areaId, submitterLevel }) });
  return { areaId: made.areaId };
}

export const changeVirtualArea = (
  areaId: string, change: { submitterLevel?: SubmitterLevel; position?: number }
): Promise<{ areaId: string; submitterLevel: SubmitterLevel; position: number }> =>
  call(virtual(areaId), { method: 'POST', body: JSON.stringify(change) });

export const releaseVirtualArea = (areaId: string): Promise<{ released: boolean }> =>
  call(`${virtual(areaId)}/release`, { method: 'POST' });

/* -- Der Plan ----------------------------------------------------------------------------------- */

export interface PlanMember {
  readonly roleId: string;
  readonly kind: string;
  readonly wrapPublicKey: string;
  readonly capabilities: readonly string[];
}

export interface PlanSeat extends SeatEnvelope {
  /** Kann einer meiner Rollen den Platz öffnen? Sonst fehlen die Hüllen. */
  readonly opens: boolean;
}

export interface PlanMissing {
  readonly registrationId: string;
  readonly seat: PlanSeat | null;
}

export interface PlanBehind {
  readonly areaId: string;
  readonly registrationId: string;
  readonly epoch: number;
  /** Zertifikate, die die Regel verlangt und die fehlen. */
  readonly lacks: readonly { readonly roleId: string; readonly capability: string }[];
  /** Rollen der Regel ohne Schlüsselhülle. */
  readonly keyless: readonly string[];
  /** Der Platz, dem die Hülle fehlt (nur wenn der Einsender dazugehört). */
  readonly seat: PlanSeat | null;
}

export interface VirtualPlan {
  readonly areaId: string;
  readonly name: string;
  readonly moduleId: string;
  readonly submitterLevel: SubmitterLevel;
  readonly members: readonly PlanMember[];
  /** Meine Rollen, die nach der Regel ausstellen dürfen. */
  readonly issuers: readonly string[];
  readonly missing: readonly PlanMissing[];
  readonly behind: readonly PlanBehind[];
}

export const loadVirtualPlan = (areaId: string): Promise<VirtualPlan> => call<VirtualPlan>(`${virtual(areaId)}/plan`);

const LEVELS: readonly Capability[] = ['read', 'write', 'admin', 'certify'];

/** Die Regel als Liste: je Rolle und Stufe ein Zertifikat, das jeder Kleinbereich trägt. */
export function ruleOf(members: readonly PlanMember[]): readonly { readonly roleId: string; readonly capability: Capability }[] {
  return members.flatMap((m) => LEVELS.filter((c) => m.capabilities.includes(c)).map((capability) => ({ roleId: m.roleId, capability })));
}

/** Wer den Schlüssel eines Kleinbereichs bekommt: jede Rolle der Regel, die hineinsieht (`certify` allein sieht nicht hinein). */
export function keyHolders(members: readonly PlanMember[]): readonly PlanMember[] {
  return members.filter((m) => m.capabilities.some((c) => c === 'read' || c === 'write' || c === 'admin'));
}

/**
 * Der Aussteller: eine meiner Rollen, die nach der Regel ausstellen darf UND
 * deren Unterschriftsschlüssel dieser Bund hat. `null`: von hier aus nicht.
 */
export function issuerOf(plan: Pick<VirtualPlan, 'issuers'>, ring: Pick<Ring, 'maySign'>): string | null {
  return plan.issuers.find((roleId) => ring.maySign(roleId)) ?? null;
}

/** Was zu tun ist, in Zahlen — für den Knopf und die Rückmeldung. */
export function planWork(plan: Pick<VirtualPlan, 'missing' | 'behind'>): { readonly create: number; readonly mirror: number } {
  return { create: plan.missing.length, mirror: plan.behind.length };
}

/* -- Die Regel anwenden ----------------------------------------------------------------------- */

export interface ApplyResult {
  readonly created: number;
  readonly mirrored: number;
  /** Einsendungen, deren Platz dieser Bund nicht öffnet — ihr Kleinbereich entsteht ohne Hülle für den Platz. */
  readonly seatless: number;
  /** Kleinbereiche, deren Schlüssel dieser Bund nicht hat — nachtragen kann sie jemand anderes. */
  readonly keyless: number;
  /** Kein Aussteller in diesem Bund. */
  readonly noIssuer: boolean;
}

const BATCH = 50;

/**
 * DIE REGEL ANWENDEN — fehlende Kleinbereiche anlegen, unvollständige
 * nachtragen. Höchstens `only`: nur diese Einsendung (die Kanzlei öffnet eine
 * Person). Was nicht geht (ein Platz, den dieser Bund nicht öffnet; ein
 * Kleinbereich ohne meinen Schlüssel), bleibt für einen anderen Browser.
 */
export async function applyVirtualArea(
  ring: Ring, plan: VirtualPlan, options: { only?: string; onProgress?: (done: number, of: number) => void } = {}
): Promise<ApplyResult> {
  const issuer = issuerOf(plan, ring);
  if (issuer === null) return { created: 0, mirrored: 0, seatless: 0, keyless: 0, noIssuer: true };

  const rule = ruleOf(plan.members);
  const holders = keyHolders(plan.members);
  const openSeat = seatOpener(ring);
  const withSeat = plan.submitterLevel !== 'none';

  const missing = options.only === undefined ? plan.missing : plan.missing.filter((m) => m.registrationId === options.only);
  const behind = options.only === undefined ? plan.behind : plan.behind.filter((b) => b.registrationId === options.only);
  const total = missing.length + behind.length;
  let done = 0;
  let seatless = 0;

  /* 1. Anlegen. */
  let created = 0;
  for (let at = 0; at < missing.length; at += BATCH) {
    const items = [];
    for (const one of missing.slice(at, at + BATCH)) {
      const areaId = newId();
      const key = crypto.getRandomValues(new Uint8Array(KEY_SIZE));
      const label = epochAad(areaId, 1);

      const grants = await Promise.all(holders.map(async (m) => ({
        roleId: m.roleId,
        wrappedKey: toBase64Url(await wrapKey(fromBase64Url(m.wrapPublicKey), label, key))
      })));
      const certificates = [];
      for (const r of rule) {
        certificates.push({
          subjectRoleId: r.roleId,
          ...await signedCertificate(ring, { issuerRoleId: issuer, subjectRoleId: r.roleId, areaId, capability: r.capability })
        });
      }

      let seatKeySealed: string | null = null;
      if (withSeat && one.seat !== null) {
        const seatKey = one.seat.opens ? await openSeat(one.seat) : null;
        if (seatKey === null) seatless++;
        else seatKeySealed = toBase64Url(await seal(seatKey, label, key));
      }

      items.push({ registrationId: one.registrationId, areaId, grants, certificates, seatKeySealed });
      options.onProgress?.(++done, total);
    }

    const result = await call<{ created: number }>(`${virtual(plan.areaId)}/instances`, {
      method: 'POST', body: JSON.stringify({ issuerRoleId: issuer, items })
    });
    created += result.created;
  }

  /* 2. Nachtragen. */
  let mirrored = 0;
  let keyless = 0;
  const wrapOf = new Map(plan.members.map((m) => [m.roleId, m.wrapPublicKey]));
  for (let at = 0; at < behind.length; at += BATCH) {
    const items: Record<string, unknown>[] = [];
    for (const one of behind.slice(at, at + BATCH)) {
      options.onProgress?.(++done, total);
      const key = (await myEpochKeys(ring, one.areaId).catch(() => new Map<number, Uint8Array>())).get(one.epoch);
      const label = epochAad(one.areaId, one.epoch);

      /* Ein Zertifikat braucht keinen Schlüssel — es geht auch ohne ihn. */
      const needsKey = new Set(one.keyless);
      for (const lack of one.lacks) {
        const capability = lack.capability as Capability;
        if (!LEVELS.includes(capability)) continue;
        const certificate = {
          subjectRoleId: lack.roleId,
          ...await signedCertificate(ring, { issuerRoleId: issuer, subjectRoleId: lack.roleId, areaId: one.areaId, capability })
        };
        const wrap = needsKey.has(lack.roleId) && key !== undefined ? wrapOf.get(lack.roleId) : undefined;
        if (wrap !== undefined) needsKey.delete(lack.roleId);
        items.push({
          areaId: one.areaId, roleId: lack.roleId, certificate,
          wrappedKey: wrap === undefined ? null : toBase64Url(await wrapKey(fromBase64Url(wrap), label, key!))
        });
      }

      if (key === undefined) {
        if (needsKey.size > 0 || one.seat !== null) keyless++;
        continue;
      }

      for (const roleId of needsKey) {
        const wrap = wrapOf.get(roleId);
        if (wrap === undefined) continue;
        items.push({ areaId: one.areaId, roleId, wrappedKey: toBase64Url(await wrapKey(fromBase64Url(wrap), label, key)) });
      }

      if (withSeat && one.seat !== null) {
        const seatKey = one.seat.opens ? await openSeat(one.seat) : null;
        if (seatKey === null) seatless++;
        else items.push({ areaId: one.areaId, seatKeySealed: toBase64Url(await seal(seatKey, label, key)) });
      }
    }

    if (items.length === 0) continue;
    const result = await call<{ certificates: number; keys: number; seats: number }>(`${virtual(plan.areaId)}/mirror`, {
      method: 'POST', body: JSON.stringify({ issuerRoleId: issuer, items })
    });
    mirrored += result.certificates + result.keys + result.seats;
  }

  return { created, mirrored, seatless, keyless, noIssuer: false };
}

/**
 * Alle Regeln eines Formulars anwenden, die dieser Bund anwenden darf und
 * denen etwas fehlt — still, wenn die Kanzlei das Formular öffnet. Gibt
 * zurück, wie viel geschah (angelegt + nachgetragen).
 */
export async function applyFormVirtualAreas(ring: Ring, partId: string): Promise<number> {
  const now = await loadVirtualAreas(partId);
  if (!now.ready) return 0;
  let done = 0;
  for (const va of now.virtualAreas) {
    if (!va.mayCertify || va.missing + va.behind === 0) continue;
    const result = await loadVirtualPlan(va.areaId).then((plan) => applyVirtualArea(ring, plan)).catch(() => null);
    if (result !== null) done += result.created + result.mirrored;
  }
  return done;
}

/* -- Die Kleinbereiche einer Einsendung --------------------------------------------------------- */

export interface RegistrationArea {
  readonly virtualAreaId: string;
  readonly name: string;
  readonly submitterLevel: SubmitterLevel;
  readonly position: number;
  /** Der Kleinbereich dieser Einsendung — `null`: noch keiner. */
  readonly areaId: string | null;
  readonly epoch: number | null;
  readonly myLevel: 'read' | 'write' | 'admin' | null;
}

export interface RegistrationAreas {
  readonly registrationId: string;
  readonly moduleId: string;
  readonly ready: boolean;
  /** Der Platz der Person — `null`: ohne Link (von der Kanzlei dopisana). */
  readonly seatId?: string | null;
  readonly areas: readonly RegistrationArea[];
}

export const loadRegistrationAreas = (registrationId: string): Promise<RegistrationAreas> =>
  call<RegistrationAreas>(`/workspace/registration/${encodeURIComponent(registrationId)}/areas`);
