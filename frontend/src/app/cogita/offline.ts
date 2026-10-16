/**
 * COGITA — LERNEN OHNE NETZ (COGITA.md §7, [E9, F21]).
 *
 * <b>Was das Gerät behält</b>: Abschriften der Fragen einer Wiederholung
 * (die Karten, wie sie gerechnet wurden, mit dem Plan) — versiegelt unter dem
 * Schlüssel DIESES Geräts (`kept.ts`: im Browser die Ablage, in der App der
 * Android Keystore). Antworten ohne Netz brauchen dagegen kein Geheimnis: sie
 * werden für öffentliche Schlüssel versiegelt (`learn.ts`) und warten in der
 * Ablage, bis sie hinaus können.
 *
 * <b>Der Browser behält von selbst ein paar</b> (die zuletzt geübten), die App
 * so viele, wie man ihr sagt. Im strengen Betrieb (`tab`) behält das Gerät
 * nichts — dort lebt nicht einmal der Schlüssel länger als der Tab.
 */

import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from '../crypto';
import { idbDelete, idbGet, idbKeys, idbPut } from '../idb';
import { device } from '../kept';
import type { Card } from './cards';
import type { Dependency } from './knowness';

export interface OfflineRevision {
  readonly libraryId: string;
  readonly revisionId: string;
  readonly name: string;
  /** Der Plan, wie ihn der Graph ergab — ohne die Karten (die stehen daneben). */
  readonly plan: Readonly<Record<string, unknown>>;
  readonly cards: readonly Card[];
  readonly deps: readonly Dependency[];
  /** Wohin die Antworten gehen, wenn das Netz wieder da ist. */
  readonly target: { readonly areaId: string; readonly intake: string | null } | null;
  readonly savedAt: number;
}

/** Wie viele Wiederholungen der Browser von selbst behält; die App so viele, wie gewählt. */
export const BROWSER_KEEPS = 3;

const slot = (libraryId: string, revisionId: string) => `${libraryId}:${revisionId}`;
const offlineAad = (libraryId: string, revisionId: string) => aad('cogita', 'offline', slot(libraryId, revisionId), Field.CogitaOffline, 1);

/** Eine Wiederholung für die Zeit ohne Netz ablegen. `keep`: das Konto behält seinen Schlüssel (`kept`). */
export async function keepOffline(revision: OfflineRevision, keep: boolean, limit = BROWSER_KEEPS): Promise<boolean> {
  if (!keep) return false;
  const on = await device().catch(() => null);
  if (on === null) return false;
  const sealed = toBase64Url(await sealText(on.key, offlineAad(revision.libraryId, revision.revisionId), JSON.stringify(revision)));
  const ok = await idbPut('offline', slot(revision.libraryId, revision.revisionId), { sealed, savedAt: revision.savedAt, libraryId: revision.libraryId, revisionId: revision.revisionId });
  if (ok) await trim(limit);
  return ok;
}

/** Die ältesten fallen weg, wenn es mehr sind als erlaubt. */
async function trim(limit: number): Promise<void> {
  const rows: { key: string; savedAt: number }[] = [];
  for (const key of await idbKeys('offline')) {
    const one = await idbGet<{ savedAt: number }>('offline', key);
    if (one !== null) rows.push({ key, savedAt: one.savedAt });
  }
  rows.sort((a, b) => b.savedAt - a.savedAt);
  for (const old of rows.slice(Math.max(1, limit))) await idbDelete('offline', old.key);
}

/** Eine abgelegte Wiederholung öffnen — `null`: keine, oder nicht von diesem Gerät. */
export async function openOffline(libraryId: string, revisionId: string): Promise<OfflineRevision | null> {
  const stored = await idbGet<{ sealed: string }>('offline', slot(libraryId, revisionId));
  if (stored === null) return null;
  const on = await device().catch(() => null);
  if (on === null) return null;
  try {
    return JSON.parse(await openText(on.key, offlineAad(libraryId, revisionId), fromBase64Url(stored.sealed))) as OfflineRevision;
  } catch {
    return null;
  }
}

/** Was abgelegt ist — für die Liste „bez internetu". */
export async function offlineList(): Promise<{ libraryId: string; revisionId: string; savedAt: number }[]> {
  const out: { libraryId: string; revisionId: string; savedAt: number }[] = [];
  for (const key of await idbKeys('offline')) {
    const one = await idbGet<{ libraryId: string; revisionId: string; savedAt: number }>('offline', key);
    if (one !== null) out.push({ libraryId: one.libraryId, revisionId: one.revisionId, savedAt: one.savedAt });
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export const dropOffline = (libraryId: string, revisionId: string): Promise<void> => idbDelete('offline', slot(libraryId, revisionId));

/** Gibt es gerade Netz? Der Browser weiss es nur ungefähr — ein Fehlschlag beim Laden sagt es genauer. */
export const online = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;
