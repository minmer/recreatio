/**
 * 2026-11-12 (Eigentümer: „im Vollbild den ganzen freien Platz nehmen und so skalieren, dass sich nach einer Antwort nichts
 * bewegt — alles bleibt sichtbar an seiner Stelle; nicht oben etwas Kleines und darunter alles leer") — EIN TEIL IM VOLLBILD
 * PASST SICH EIN:
 * <code>
 *   --run-zoom   der ganze Teil wächst mit dem Fenster (Basis BASE_W × BASE_H, höchstens MAX_ZOOM; nie kleiner als 1)
 *   wide         ist genug Platz (WIDE_MIN breit, WIDE_MIN_H hoch, nach dem Zoom), steht eine Frage in zwei festen Spalten:
 *                links Frage und Antwort (sie bleiben, wo sie sind), rechts, was nach der Antwort kommt (Urteil, Erklärung,
 *                die Statistik der Karte) — rollt in sich, statt die Seite zu verlängern
 *   --face-h     die Höhe der Karte: vom oberen Rand der Karte bis zum unteren Rand des Teils (beides gemessen)
 * </code>
 * Gemessen mit ResizeObserver (Fenster) und MutationObserver (eine neue Frage, ein neues Thema darüber) — einmal je Bild.
 */

import { useEffect, type RefObject } from 'react';

const BASE_W = 1000;
const BASE_H = 700;
const MAX_ZOOM = 1.5;
const WIDE_MIN = 860;
const WIDE_MIN_H = 460;
/** Unten frei (CSS-Pixel im gezoomten Teil). */
const BOTTOM = 20;

export function runFit(w: number, h: number): { zoom: number; wide: boolean } {
  const zoom = Math.max(1, Math.min(MAX_ZOOM, w / BASE_W, h / BASE_H));
  return { zoom, wide: w / zoom >= WIDE_MIN && h / zoom >= WIDE_MIN_H };
}

export function useRunFit(ref: RefObject<HTMLElement | null>, on: boolean): void {
  useEffect(() => {
    const el = ref.current;
    if (!on || el === null) return undefined;
    let raf = 0;
    const fit = () => {
      raf = 0;
      const w = el.clientWidth, h = el.clientHeight;
      if (w === 0 || h === 0) return;
      const { zoom, wide } = runFit(w, h);
      el.style.setProperty('--run-zoom', zoom.toFixed(3));
      if (wide) el.setAttribute('data-run-wide', ''); else el.removeAttribute('data-run-wide');
      const face = el.querySelector<HTMLElement>('.cg-face');
      if (face === null) return;
      if (!wide) { face.style.removeProperty('--face-h'); return; }
      /* getBoundingClientRect misst im Fenster (gezoomt); die Höhe gilt im Teil (ungezoomt). */
      const box = el.getBoundingClientRect(), fr = face.getBoundingClientRect();
      const top = fr.top - box.top;
      const pad = parseFloat(getComputedStyle(el).paddingBottom) || 0;
      /* Was unter der Karte steht (z. B. „Zacznij od nowa"), bleibt mit im Bild. */
      const content = face.closest('.cg-wm-runzoom') ?? face;
      const trailing = Math.max(0, content.getBoundingClientRect().bottom - fr.bottom);
      const avail = Math.max(320, (h - pad - top - trailing) / zoom - BOTTOM);
      const now = face.style.getPropertyValue('--face-h');
      const next = `${Math.floor(avail)}px`;
      if (now !== next) face.style.setProperty('--face-h', next);
    };
    const ask = () => { if (raf === 0) raf = requestAnimationFrame(fit); };
    const ro = new ResizeObserver(ask);
    ro.observe(el);
    const mo = new MutationObserver(ask);
    mo.observe(el, { childList: true, subtree: true });
    ask();
    return () => { ro.disconnect(); mo.disconnect(); cancelAnimationFrame(raf); };
  }, [ref, on]);
}
