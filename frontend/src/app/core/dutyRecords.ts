/**
 * 0129/0130 — DIE ZWEI SÄTZE, DIE DER BROWSER FÜR PFLICHTEN UNTERSCHREIBT.
 *
 * Byte für Byte wie `Kernel/DutyRecords.cs` (die Vektoren stehen in
 * `Kernel.Tests` und in `scripts/app-duty-check.mjs`):
 *
 *   - die ZUSAGE, für die Daten eines Bereichs geradezustehen
 *     (`controller-attachment`) — unterschrieben von einer Rolle, die den
 *     Heimatbereich des Administrators führt;
 *   - ein SCHRITT DES BETREIBERS an einer gemeldeten Sache (`takedown`) —
 *     unterschrieben von der Rolle des Betreibers, am Hash des vorigen
 *     Schritts hängend.
 *
 * Kennungen klein geschrieben (wie `Guid.ToString("D")`), Zeiten in ganzen
 * Sekunden, Hashes als kleines Hex.
 */

import { I, NIL, O, S, serialize, type Canon } from './canonical';

const id = (value: string): Canon => S(value.toLowerCase());

export interface AttachmentFacts {
  readonly attachmentId: string;
  readonly controllerId: string;
  readonly areaId: string;
  readonly homeAreaId: string;
  readonly signerRoleId: string;
  /** Sekunden seit 1970. */
  readonly signedAt: number;
}

export const attachmentCanon = (f: AttachmentFacts): Canon => O({
  areaId: id(f.areaId),
  attachmentId: id(f.attachmentId),
  controllerId: id(f.controllerId),
  homeAreaId: id(f.homeAreaId),
  kind: S('controller-attachment'),
  signedAt: I(f.signedAt),
  signerRoleId: id(f.signerRoleId)
});

export type TakedownAction = 'block' | 'restore' | 'delete' | 'reject';

export interface TakedownFacts {
  readonly sequence: number;
  /** Der Hash des vorigen Schritts, 64 Zeichen Hex — der erste hängt an 32 Nullbytes. */
  readonly previousHash: string;
  readonly entryId: string;
  readonly reportId: string;
  readonly itemKind: string;
  readonly itemId: string;
  /** Eine Fassung (Sekunden) — oder `null`: die Sache selbst. */
  readonly itemAt: number | null;
  readonly action: TakedownAction;
  readonly signerRoleId: string;
  readonly signedAt: number;
}

export const GENESIS_HASH = '0'.repeat(64);

export const takedownCanon = (f: TakedownFacts): Canon => O({
  action: S(f.action),
  entryId: id(f.entryId),
  itemAt: f.itemAt === null ? NIL : I(f.itemAt),
  itemId: id(f.itemId),
  itemKind: S(f.itemKind),
  kind: S('takedown'),
  previousHash: S(f.previousHash.toLowerCase()),
  reportId: id(f.reportId),
  sequence: I(f.sequence),
  signedAt: I(f.signedAt),
  signerRoleId: id(f.signerRoleId)
});

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** Der Hash eines Schritts — der `previousHash` des nächsten. */
export async function takedownHash(f: TakedownFacts): Promise<string> {
  const bytes = new TextEncoder().encode(serialize(takedownCanon(f)));
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

/** Jetzt, in ganzen Sekunden. */
export const nowSeconds = (): number => Math.floor(Date.now() / 1000);
