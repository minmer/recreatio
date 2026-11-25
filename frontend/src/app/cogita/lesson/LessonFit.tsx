/**
 * 2026-11-25 (Eigentümer: „wenn möglich auf einem Bildschirm, ohne Scrollen — Frage und Antworten gleich gross") — EIN BILD, DAS
 * PASST: der Inhalt einer Stunde (Folie, Frage, Wahl — auf dem Gerät des Schülers und auf der Leinwand) steht in einer Karte, deren
 * Schrift von EINER Grösse ausgeht (`--fit`, in em: Frage und Möglichkeiten gleich). Ist sie höher als der Platz, wird sie in
 * Schritten kleiner, bis sie passt (höchstens auf 60 %) — sonst darf gescrollt werden.
 */

import { useLayoutEffect, useRef, type ReactNode } from 'react';

const scrollerOf = (el: HTMLElement): HTMLElement | null => {
  for (let p = el.parentElement; p !== null; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') return p;
  }
  return null;
};

export function LessonFit({ className, data, watch, children }: {
  className: string;
  data?: Readonly<Record<string, string | number | undefined>>;
  /** Was neu gemessen werden soll, wenn es sich ändert (der Schritt, die Frage, ob abgeschickt …). */
  watch: string;
  children: ReactNode;
}) {
  const outer = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const box = outer.current;
    const el = inner.current;
    if (box === null || el === null) return undefined;
    const scroller = scrollerOf(box);
    const fit = () => {
      const avail = scroller === null ? window.innerHeight : scroller.clientHeight;
      const cs = getComputedStyle(box);
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      let f = 1;
      el.style.setProperty('--fit', '1');
      while (el.offsetHeight + pad > avail && f > 0.6) {
        f = Math.round((f - 0.05) * 100) / 100;
        el.style.setProperty('--fit', String(f));
      }
      box.dataset.lessonFit = String(f);
    };
    fit();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => fit());
    ro?.observe(scroller ?? document.documentElement);
    /* Bilder und Formeln kommen später — einmal nachmessen. */
    const late = window.setTimeout(fit, 400);
    window.addEventListener('resize', fit);
    return () => { ro?.disconnect(); window.clearTimeout(late); window.removeEventListener('resize', fit); };
  }, [watch]);
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(data ?? {})) if (v !== undefined) attrs[k] = String(v);
  return (
    <div ref={outer} className={className} {...attrs}>
      <div ref={inner} className="cg-fit">{children}</div>
    </div>
  );
}
