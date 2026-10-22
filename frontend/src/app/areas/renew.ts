/**
 * MITGLIEDSCHAFTEN ERNEUERN (2026-10-22).
 *
 * Ein Zertifikat gilt zwei Jahre (`signedCertificate`). Ist es ein Jahr alt,
 * schreibt es der Browser eines Menschen, der im Bereich aufnehmen darf, neu
 * — dieselbe Rolle, dieselbe Stufe, ein neues Ablaufdatum; Schlüssel gehen
 * dabei keine hinaus. Die Glocke nennt die Bereiche, in denen etwas fällig
 * ist (`renewals.waiting`); dieser Schritt läuft dann von selbst, ohne dass
 * jemand etwas tun muss. Was der Dienst prüft: `backend/Api/Areas/Area.Renew.cs`.
 */

import type { Ring } from '../core/keys';
import { call } from '../core/session';
import { signedCertificate, type Capability } from './area';

interface Due {
  readonly roleId: string;
  readonly capability: Capability;
}

/** Was in diesem Bereich fällig ist — und mit welcher meiner Rollen ich unterschreibe. */
const loadRenewals = (areaId: string): Promise<{ issuerRoleId: string; due: readonly Due[] }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/renewals`);

/* -- Was zuletzt nicht ging ---------------------------------------------------------------- */

const FAILED_KEY = 'areas.renewFailed';

type Failures = Record<string, { readonly at: string; readonly message: string }>;

function readFailures(): Failures {
  try {
    const raw = localStorage.getItem(FAILED_KEY);
    const parsed: unknown = raw === null ? {} : JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed as Failures : {};
  } catch {
    return {};
  }
}

/** Ein Fehlschlag (oder `null`: es ging) — damit die Seite des Bereichs warnen kann. */
export function noteRenewal(areaId: string, error: string | null): void {
  try {
    const all = readFailures();
    if (error === null) delete all[areaId];
    else all[areaId] = { at: new Date().toISOString(), message: error };
    localStorage.setItem(FAILED_KEY, JSON.stringify(all));
  } catch {
    /* Ohne Speicher keine Warnung über Neuladen hinweg — die Seite prüft beim Öffnen ohnehin selbst. */
  }
}

/** Was beim letzten Versuch in diesem Bereich schiefging — oder `null`. */
export function renewalFailure(areaId: string): { readonly at: string; readonly message: string } | null {
  return readFailures()[areaId] ?? null;
}

/** Bis wann eine Mitgliedschaft gilt: die früheste der Stufen (ISO) — `null`, wenn der Dienst es nicht sagt. */
export function memberUntil(expires: Readonly<Record<string, string>> | undefined): string | null {
  const all = Object.values(expires ?? {}).filter((v) => typeof v === 'string').sort();
  return all[0] ?? null;
}

/** Ab wann erneuert wird: weniger als ein Jahr übrig (wie der Dienst, `Area.RenewBefore`). */
export const RENEW_BEFORE_DAYS = 365;

/** Ab wann die Seite warnt, auch wer nicht erneuern kann: weniger als 60 Tage übrig. */
export const WARN_BEFORE_DAYS = 60;

export const daysLeft = (iso: string): number => Math.floor((Date.parse(iso) - Date.now()) / 86_400_000);

/** Die fälligen Zertifikate eines Bereichs neu unterschreiben. Gibt zurück, wie viele es waren. */
export async function renewArea(ring: Ring, areaId: string): Promise<number> {
  const { issuerRoleId, due } = await loadRenewals(areaId);
  if (due.length === 0) return 0;
  const renewals = [];
  for (const one of due.slice(0, 200)) {
    renewals.push({
      roleId: one.roleId,
      certificate: await signedCertificate(ring, { issuerRoleId, subjectRoleId: one.roleId, areaId, capability: one.capability })
    });
  }
  const done = await call<{ renewed: number }>(`/workspace/area/${encodeURIComponent(areaId)}/renew`, {
    method: 'POST',
    body: JSON.stringify({ issuerRoleId, renewals })
  });
  return done.renewed;
}
