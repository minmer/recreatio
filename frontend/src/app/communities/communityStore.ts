/**
 * 0137 — DAS DOKUMENT EINER WSPÓLNOTA beim Dienst: je Bereich versiegelt unter seinem neuesten
 * Epochenschlüssel (`area_setup`), dazu der Verlauf der Wurzel und das Umhängen eines Bereichs.
 * Öffnen kann es ein Konto (Schlüsselbund) oder ein Link in diesem Browser (`heldAreaKey`).
 */

import { aad, Field, fromBase64Url, open, seal, toBase64Url } from '../core/crypto';
import type { Ring } from '../core/keys';
import { call } from '../core/session';
import { myEpochKeys } from '../areas/area';
import { heldAreaKey } from '../links/linkAccess';
import type { Stored } from './communityJson';

export const setupAad = (areaId: string) => aad('area', 'setup', areaId, Field.AreaSetup, 1);

interface SealedSetup { readonly epoch: number; readonly sealed: string; readonly version: number; readonly updatedAt: string }

export interface SetupRow { readonly stored: Stored | null; readonly version: number; readonly updatedAt: string | null; readonly missing: boolean; readonly unreadable: boolean }

const loadRaw = (areaId: string): Promise<{ setup: SealedSetup | null; missing?: boolean }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/setup`);

async function keyFor(ring: Ring | null, areaId: string, epoch: number): Promise<Uint8Array | null> {
  if (ring !== null) {
    try {
      const keys = await myEpochKeys(ring, areaId);
      const k = keys.get(epoch);
      if (k !== undefined) return k;
    } catch { /* weiter mit den Links */ }
  }
  return heldAreaKey(areaId, epoch);
}

async function openSealed(ring: Ring | null, areaId: string, s: SealedSetup): Promise<Stored | null> {
  const key = await keyFor(ring, areaId, s.epoch);
  if (key === null) return null;
  try {
    return JSON.parse(new TextDecoder().decode(await open(key, setupAad(areaId), fromBase64Url(s.sealed)))) as Stored;
  } catch {
    return null;
  }
}

/** Das Dokument eines Bereichs — `stored: null`, wenn es keines gibt (oder es nicht aufgeht: `unreadable`). */
export async function loadSetup(ring: Ring | null, areaId: string): Promise<SetupRow> {
  const { setup, missing } = await loadRaw(areaId);
  if (setup === null) return { stored: null, version: 0, updatedAt: null, missing: missing === true, unreadable: false };
  const stored = await openSealed(ring, areaId, setup);
  return { stored, version: setup.version, updatedAt: setup.updatedAt, missing: false, unreadable: stored === null };
}

/** Versiegeln und speichern — `version`: die gelesene (sonst 409). */
export async function saveSetup(ring: Ring, areaId: string, stored: Stored, version: number, roleId: string | null): Promise<number> {
  const keys = await myEpochKeys(ring, areaId);
  if (keys.size === 0) throw new Error('Brak klucza obszaru — nie można zapisać ustawień wspólnoty.');
  const epoch = Math.max(...keys.keys());
  const sealed = await seal(keys.get(epoch)!, setupAad(areaId), new TextEncoder().encode(JSON.stringify(stored)));
  const answer = await call<{ version: number }>(`/workspace/area/${encodeURIComponent(areaId)}/setup`, {
    method: 'POST', body: JSON.stringify({ epoch, sealed: toBase64Url(sealed), version, roleId })
  });
  return answer.version;
}

export interface HistoryEntry { readonly id: string; readonly at: string; readonly version: number; readonly stored: Stored | null }

export async function loadHistory(ring: Ring | null, areaId: string): Promise<HistoryEntry[]> {
  const { history } = await call<{ history: readonly (SealedSetup & { id: string; at: string })[] }>(`/workspace/area/${encodeURIComponent(areaId)}/setup/history`);
  const out: HistoryEntry[] = [];
  for (const h of history) out.push({ id: h.id, at: h.at, version: h.version, stored: await openSealed(ring, areaId, h) });
  return out;
}

/** Umhängen: unter `parentAreaId` (oder ganz nach aussen). */
export const setParent = (areaId: string, parentAreaId: string | null): Promise<{ parentAreaId: string | null }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/parent`, { method: 'POST', body: JSON.stringify({ parentAreaId }) });
