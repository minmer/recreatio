/**
 * 2026-11-05 (Prompt 17) — WAS ZWISCHEN EINER ANTWORT UND IHREN NAGRODY LÄUFT, ohne dass die Teile einander kennen:
 * <code>
 *   noteAnswerSource   die Karte sagt, woher die eben gegebene Antwort kam (der Knopf, das Feld) — von dort steigt „+N" auf
 *   flyPoints          „+N" fliegt von einer Stelle zum Zähler der Punkte (Web Animations; ohne Bewegung: nur am Zähler)
 *   celebrateKnown     eine Karte ist eben utrwalona — ihre Karte zeigt einmal „Utrwalone"
 * </code>
 * Bewegung nach `ui/motion.ts`: „ograniczone" — nur Überblendung am Ziel, „wyłączone" — nichts (der Zähler springt).
 */

import { motionLevel } from '../ui/motion';

/* -- Woher eine Antwort kam ------------------------------------------------------------------------------------------- */

interface Source { readonly x: number; readonly y: number; readonly key: string; readonly at: number }
let source: Source | null = null;

/** Die Karte `key` wurde eben beantwortet, an dieser Stelle (der Knopf, das Feld). */
export function noteAnswerSource(el: Element | null, key: string): void {
  if (el === null || typeof el.getBoundingClientRect !== 'function') { source = null; return; }
  const r = el.getBoundingClientRect();
  source = { x: r.left + r.width / 2, y: r.top + r.height / 2, key, at: Date.now() };
}

/** Woher die letzte Antwort kam — nur, wenn sie eben erst war. */
export function answerSource(maxAgeMs = 2500): Source | null {
  return source !== null && Date.now() - source.at <= maxAgeMs ? source : null;
}

/* -- Punkte fliegen zum Zähler ---------------------------------------------------------------------------------------- */

const NUM = new Intl.NumberFormat('pl-PL');

/**
 * „+N" je Stelle (`x`, `y` im Fenster) — höchstens fünf einzeln, sie fliegen nacheinander zum Zähler `to`; `onArrive`, wenn
 * die erste ankommt (der Zähler zählt dann hoch). Ohne Zähler steigen sie nur auf und vergehen.
 */
export function flyPoints(items: readonly { readonly n: number; readonly x: number; readonly y: number }[], to: Element | null, onArrive?: () => void): void {
  const level = motionLevel();
  const shown = items.filter((it) => it.n > 0);
  if (shown.length === 0 || typeof document === 'undefined') { onArrive?.(); return; }
  if (level === 'off') { onArrive?.(); return; }
  const target = to?.getBoundingClientRect() ?? null;
  const tx = target === null ? null : target.left + target.width / 2;
  const ty = target === null ? null : target.top + target.height / 2;
  let arrived = false;
  const arrive = () => { if (!arrived) { arrived = true; onArrive?.(); } };
  shown.forEach((it, k) => {
    const el = document.createElement('span');
    el.className = 'cg-rw-fly';
    el.setAttribute('aria-hidden', 'true');
    el.dataset.rwFly = String(it.n);
    el.textContent = `+${NUM.format(it.n)}`;
    /* „ograniczone": am Ziel erscheinen und vergehen — keine Bahn durch das Bild. */
    const fromX = level === 'reduced' && tx !== null ? tx : it.x;
    const fromY = level === 'reduced' && ty !== null ? ty : it.y;
    el.style.left = `${fromX.toFixed(1)}px`;
    el.style.top = `${fromY.toFixed(1)}px`;
    document.body.appendChild(el);
    const dx = tx === null || level === 'reduced' ? 0 : tx - fromX;
    const dy = ty === null || level === 'reduced' ? -36 : ty - fromY;
    const frames: Keyframe[] = level === 'reduced'
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }]
      : [
        { opacity: 0, transform: 'translate(-50%, -50%) scale(0.8)' },
        { opacity: 1, transform: 'translate(-50%, calc(-50% - 1.6rem)) scale(1.05)', offset: 0.28 },
        { opacity: 0.25, transform: `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px)) scale(0.6)` }
      ];
    const run = typeof el.animate === 'function' ? el.animate(frames, { duration: level === 'reduced' ? 700 : 950, delay: k * 110, easing: 'cubic-bezier(.4,.1,.3,1)', fill: 'both' }) : null;
    const done = () => { el.remove(); arrive(); };
    if (run === null) { window.setTimeout(done, 300); return; }
    run.onfinish = done;
    run.oncancel = done;
  });
}

/* -- Eine Karte ist eben utrwalona ------------------------------------------------------------------------------------ */

const knownListeners = new Set<(key: string) => void>();

/** Die Karte `key` ist eben utrwalona: ihre Karte (falls sie zu sehen ist) zeigt es einmal. */
export function celebrateKnown(key: string): void {
  for (const f of knownListeners) f(key);
}

/** Hören, welche Karte eben utrwalona wurde. */
export function onKnown(f: (key: string) => void): () => void {
  knownListeners.add(f);
  return () => { knownListeners.delete(f); };
}
