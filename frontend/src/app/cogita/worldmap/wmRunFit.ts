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

/** So klein darf ein Teil höchstens werden, damit eine lange Frage (eine Reihenfolge mit vielen Teilen) ganz zu sehen ist. */
const MIN_ZOOM = 0.7;
/** Der Abstand über der Frage: höchstens so viel (Teil der Höhe), weniger, wenn die Frage den Platz braucht. */
const PAD_SHARE = 0.09;
const PAD_MAX = 96;

/*
  2026-11-12 (Eigentümer: „solche Situationen sind beim Skalieren zu vermeiden" — eine Reihenfolge mit sechs Teilen, „Sprawdź"
  unter dem Rand) — JE FRAGE EINMAL EINGEPASST: zuerst der Abstand über der Frage weniger, dann der ganze Teil kleiner, bis die
  linke Spalte (Frage, Antworten, „Sprawdź") ganz zu sehen ist. Danach (die Antwort) bleibt alles, wie es ist — nichts bewegt
  sich; nur bei einer neuen Frage oder einer anderen Fenstergrösse wird neu eingepasst.
*/
export function useRunFit(ref: RefObject<HTMLElement | null>, on: boolean): void {
  useEffect(() => {
    const el = ref.current;
    if (!on || el === null) return undefined;
    let raf = 0;
    let fitted = '';
    let zoom = 1, pad = 0;
    /* Die Höhe der Karte bei diesem Zoom (vom oberen Rand der Karte bis unten, ohne was darunter steht). */
    const faceHeight = (face: HTMLElement, h: number) => {
      const box = el.getBoundingClientRect(), fr = face.getBoundingClientRect();
      const top = fr.top - box.top;
      const bottomPad = parseFloat(getComputedStyle(el).paddingBottom) || 0;
      /* Was unter der Karte steht (z. B. „Zacznij od nowa"), bleibt mit im Bild. */
      const content = face.closest('.cg-wm-runzoom') ?? face;
      const trailing = Math.max(0, content.getBoundingClientRect().bottom - fr.bottom);
      const avail = Math.max(240, (h - bottomPad - top - trailing) / zoom - BOTTOM);
      const next = `${Math.floor(avail)}px`;
      if (face.style.getPropertyValue('--face-h') !== next) face.style.setProperty('--face-h', next);
    };
    const apply = (face: HTMLElement | null, h: number) => {
      el.style.setProperty('--run-zoom', zoom.toFixed(3));
      if (face === null) return;
      face.style.setProperty('--main-pad', `${Math.round(pad)}px`);
      faceHeight(face, h);
    };
    const fit = () => {
      raf = 0;
      const w = el.clientWidth, h = el.clientHeight;
      if (w === 0 || h === 0) return;
      const base = runFit(w, h);
      if (base.wide) el.setAttribute('data-run-wide', ''); else el.removeAttribute('data-run-wide');
      const face = el.querySelector<HTMLElement>('.cg-face');
      if (face === null || !base.wide) {
        zoom = base.zoom;
        el.style.setProperty('--run-zoom', zoom.toFixed(3));
        face?.style.removeProperty('--face-h');
        fitted = '';
        return;
      }
      const key = `${face.dataset.card ?? ''}|${w}x${h}`;
      /* Dieselbe Frage: nur die Höhe nachführen (etwas darüber oder darunter änderte sich), Zoom und Abstand bleiben. */
      if (key === fitted) { faceHeight(face, h); return; }
      fitted = key;
      zoom = base.zoom;
      pad = Math.min(PAD_MAX, h * PAD_SHARE) / zoom;
      apply(face, h);
      for (let i = 0; i < 6; i += 1) {
        const main = face.querySelector<HTMLElement>('.cg-face-main');
        if (main === null) break;
        const over = main.scrollHeight - main.clientHeight;
        if (over <= 1) break;
        if (pad > 0) { pad = Math.max(0, pad - over - 2); apply(face, h); continue; }
        if (zoom <= MIN_ZOOM) break;
        zoom = Math.max(MIN_ZOOM, zoom * (main.clientHeight / main.scrollHeight) * 0.98);
        apply(face, h);
      }
      face.dataset.runZoom = zoom.toFixed(2);
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
