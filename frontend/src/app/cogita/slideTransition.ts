/**
 * 2026-11-26 — WIE EINE FOLIE KOMMT ("transition" am Schritt, sonst am Ablauf; `slideGraphics.ts`, `FlowPlayer.tsx`). Ohne
 * Abhängigkeiten (der Ablauf liest es, ohne die Bewegungen zu laden).
 * <code>
 *   fade    der Text blendet sich ein (Vorgabe)
 *   slide   der Text kommt von rechts
 *   zoom    der Text wächst aus der Mitte
 *   none    sofort
 * </code>
 * Bei „weniger Bewegung" (Wygląd) immer sofort.
 */

export const SLIDE_TRANSITIONS = ['fade', 'slide', 'zoom', 'none'] as const;
export type SlideTransition = (typeof SLIDE_TRANSITIONS)[number];

const ALIAS: Readonly<Record<string, SlideTransition>> = {
  fade: 'fade', blend: 'fade', przenikanie: 'fade', blende: 'fade', einblenden: 'fade',
  slide: 'slide', przesuniecie: 'slide', 'przesunięcie': 'slide', schieben: 'slide', // i18n-ignore
  zoom: 'zoom', powiekszenie: 'zoom', 'powiększenie': 'zoom', // i18n-ignore
  none: 'none', brak: 'none', keiner: 'none', ohne: 'none'
};

/** Ein Übergang gelesen — `null`: keiner angegeben (oder ein unbekannter; der Import warnt). */
export function readTransition(v: unknown): SlideTransition | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return s === '' ? null : ALIAS[s] ?? null;
}
