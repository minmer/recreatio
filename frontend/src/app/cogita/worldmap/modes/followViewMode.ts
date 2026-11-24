/**
 * MODUS „GEFÜHRT" (Tryb prowadzony, Schüler und Leinwand — `follow/FollowScreen.tsx` setzt `FollowViewContext`): die Kamera kommt von
 * der Lehrerin, ebenso Modus, Gewähltes und Tag-Ausschnitt (nichts davon wird hier gemerkt). Nichts lässt sich bedienen
 * (`WorldPillars.following`), keine Einladung, kein Rundgang, kein „Prowadź na żywo" im Menü.
 */

import { useEffect } from 'react';

import { useFollowView } from '../../follow/followView';
import type { FollowMapState } from '../../follow/followModel';
import type { MapMode } from '../mapMode';

export function useFollowViewMode(apply: (map: FollowMapState) => void): MapMode {
  const view = useFollowView();
  const following = view !== null;
  const map = view?.map ?? null;
  /* Was die Lehrerin zeigt, übernimmt die Karte — einmal je Meldung. */
  useEffect(() => { if (map !== null) apply(map); }, [map?.at]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!following) return { id: 'followView', active: false };
  return {
    id: 'followView',
    active: true,
    camera: { follow: map?.cam ?? null },
    menu: { live: null },
    suppress: { tour: true, invite: true },
    hostClass: 'is-follow',
    hostData: { 'data-world-following': '1' }
  };
}

/** Ob die Karte unter diesem Kontext geführt wird (für Anfangswerte, bevor die Modi stehen). */
export const useFollowing = (): boolean => useFollowView() !== null;
