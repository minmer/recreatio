/**
 * 2026-11-24 (Tryb prowadzony) — GEFÜHRT: eine Karte unter diesem Kontext folgt der Lehrerin (Kamera, Gewähltes, Modus, Tag-Ausschnitt)
 * und lässt sich nicht bedienen (`WorldLandscape`). `null`: nicht geführt (die eigene Karte).
 */

import { createContext, useContext } from 'react';

import type { FollowMapState } from './followModel';

export interface FollowView { readonly map: FollowMapState | null }

export const FollowViewContext = createContext<FollowView | null>(null);
export const useFollowView = (): FollowView | null => useContext(FollowViewContext);
