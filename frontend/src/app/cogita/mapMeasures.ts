/**
 * 2026-11-05 (Prompt 17) — DIE MASSE DER KARTE, ZULETZT GEMESSEN — je Baza und Lernendem in diesem Browser:
 * <code>
 *   regions   wie viele Gebiete der obersten Ebene ganz gekonnt sind
 *   map       wie viel Prozent der Themen der Karte gekonnt sind (0–100)
 *   clean     wie viele Tage hintereinander nichts überfällig war (`rewards.ts` `cleanDays`)
 * </code>
 * Der Krajobraz misst sie (er kennt die Karte), die Nagrody lesen sie (`rewardState` … `extra`). Eine Bequemlichkeit
 * dieses Browsers, kein Zustand: WANN ein Abzeichen davon kam, hält der Lernende in seinen Werten fest
 * (`Learner.keepAwards`, `freshAwards`) — über Geräte hinweg, und die Lehrerin sieht es.
 *
 * `holder`: `holderKey(learner.holder)` (`r:<rolle>`, `s:<platz>`, `l:<browser>` — dieselbe Form wie
 * `LearnerProgress.holder`) oder der Halter selbst.
 */

import { holderKey, type Holder } from './learn';
import type { ExtraMeasures } from './rewards';

export interface MapMeasures {
  readonly regions: number;
  readonly map: number;
  readonly clean: number;
  /** Wann gemessen (Millisekunden seit 1970). */
  readonly at: number;
}

const keyOf = (libraryId: string, holder: string | Holder): string => `cg-rw-map:${libraryId}:${typeof holder === 'string' ? holder : holderKey(holder)}`;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Die eben gemessenen Masse merken (ungültige Zahlen: nichts). */
export function keepMapMeasures(libraryId: string, holder: string | Holder, m: { readonly regions: number; readonly map: number; readonly clean: number }): void {
  if (!finite(m.regions) || !finite(m.map) || !finite(m.clean)) return;
  const kept: MapMeasures = { regions: Math.max(0, m.regions), map: Math.max(0, Math.min(100, m.map)), clean: Math.max(0, m.clean), at: Date.now() };
  try { localStorage.setItem(keyOf(libraryId, holder), JSON.stringify(kept)); } catch { /* ohne Speicher: nicht gemerkt */ }
}

/** Die zuletzt gemessenen Masse — `null`: hier noch nie gemessen (oder ohne Speicher). */
export function mapMeasuresOf(libraryId: string, holder: string | Holder): MapMeasures | null {
  try {
    const raw = localStorage.getItem(keyOf(libraryId, holder));
    if (raw === null) return null;
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== 'object' || v === null) return null;
    const { regions, map, clean, at } = v as Record<string, unknown>;
    if (!finite(regions) || !finite(map) || !finite(clean)) return null;
    return { regions, map, clean, at: finite(at) ? at : 0 };
  } catch {
    return null;
  }
}

/** Als `extra` für `rewardState` (ohne Messung: keine). */
export const mapExtra = (m: MapMeasures | null): ExtraMeasures | undefined => (m === null ? undefined : { regions: m.regions, map: m.map, clean: m.clean });
