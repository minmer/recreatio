/**
 * 2026-11-12 (Eigentümer: „eine Animation, die zeigt, dass diese Statistik genau das auf der Karte bewirkt hat — Punkte, Sterne
 * oder Karten, die zum Turm oder zum Pfad fliegen") — DER FLUG VON DER TAFEL ZUR KARTE: schliesst sich die Tafel des Abschlusses,
 * fliegt von jeder Zeile und Zahl, die etwas gebracht hat, ein Zeichen zu dem Turm oder Pfad, den sie verändert hat:
 * <code>
 *   Fahne    „Erobert: X"           → der Turm X
 *   Stufe    „X: Stufe 1 → 2"       → der Turm X (auch eine Gutschrift der Einstufung: sie hebt seine Stufe)
 *   Karten   „neu gewusst" / „richtig" → die Türme, deren Karten sich bewegten (je Turm höchstens CARDS_PER)
 *   Weg      „Offen: Pfad"          → die Mitte des Pfades
 * </code>
 * Wo es landet, beginnt gleich danach das Abspielen der Karte (`WorldPillars` `hold`/`playAfter`): die Säule wächst, färbt sich,
 * der Pfad öffnet sich. Ohne volle Bewegung („Animacje") fliegt nichts.
 */

import { useEffect, useRef } from 'react';

import { useMotion } from '../../ui/motion';
import type { WorldPlayback } from './wmViews';
import './worldmap.css';

export type FlightKind = 'flag' | 'level' | 'card' | 'way';
export interface Flight {
  readonly kind: FlightKind;
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  readonly delay: number;
}

/** Wie lange ein Zeichen fliegt; der Abstand zwischen zwei Zeichen; wie viele höchstens. */
export const FLY_MS = 680;
const STAGGER_MS = 45;
const MAX_FLIGHTS = 28;
/** Je Turm höchstens so viele Karten (sonst wird es ein Schwarm). */
const CARDS_PER = 3;
/** So lange nach dem Schliessen beginnt das Abspielen der Karte: dann landen die ersten Zeichen. */
export const PLAY_AFTER_MS = 800;

/** Ein Punkt der Tafel: die Mitte des Elements mit `data-fin-src="<key>"`. */
type Source = (key: string) => { x: number; y: number } | null;
type Spot = (kind: 'place' | 'section', id: string) => { readonly x: number; readonly y: number } | null;

/**
 * Was wohin fliegt — rein aus dem Abspielen (was sich auf der Karte ändern wird) und den geöffneten Pfaden des Abschlusses.
 * Quellen, die es auf der Tafel nicht gibt, nehmen die nächstbeste Zahl, zuletzt die Mitte der Tafel.
 */
export function flightsOf(pb: WorldPlayback, opened: readonly string[], src: Source, spot: Spot): Flight[] {
  const out: Flight[] = [];
  const first = (...keys: string[]) => { for (const k of keys) { const p = src(k); if (p !== null) return p; } return null; };
  const add = (kind: FlightKind, from: { x: number; y: number } | null, to: { readonly x: number; readonly y: number } | null) => {
    if (from === null || to === null || out.length >= MAX_FLIGHTS) return;
    out.push({ kind, from, to, delay: out.length * STAGGER_MS });
  };
  const conquered = new Set(pb.conquered);
  for (const id of pb.conquered) add('flag', first(`place:${id}`, 'head', 'card'), spot('place', id));
  for (const id of pb.levelled) if (!conquered.has(id)) add('level', first(`place:${id}`, 'levels', 'known', 'card'), spot('place', id));
  for (const id of opened) add('way', first(`section:${id}`, 'card'), spot('section', id));
  const moved = [...new Set([...pb.reviewed, ...pb.levelled, ...pb.conquered, ...pb.moved])];
  for (let round = 0; round < CARDS_PER; round += 1) {
    for (const id of moved) add('card', first('known', 'right', 'steps', 'card'), spot('place', id));
  }
  return out;
}

/** Ein Zeichen (klein, in den Farben der Seite). */
function Token({ kind }: { kind: FlightKind }) {
  if (kind === 'flag') return <svg viewBox="-8 -8 16 16" aria-hidden><path d="M-4,7 L-4,-7 M-4,-7 L5,-4 L-4,-1" /></svg>;
  if (kind === 'level') return <svg viewBox="-8 -8 16 16" aria-hidden><path d="M-5,2 L0,-4 L5,2 M-5,6 L0,0 L5,6" /></svg>;
  if (kind === 'way') return <svg viewBox="-8 -8 16 16" aria-hidden><circle r="3.2" /></svg>;
  return <span className="cg-wm-flycard" />;
}

/** Die fliegenden Zeichen über allem (fest im Fenster); `onDone`, wenn das letzte gelandet ist. */
export function WorldFlight({ flights, onDone }: { flights: readonly Flight[]; onDone: () => void }) {
  const motion = useMotion();
  const box = useRef<HTMLDivElement | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const el = box.current;
    if (el === null || motion !== 'full' || flights.length === 0) { doneRef.current(); return undefined; }
    const runs: Animation[] = [];
    let last = 0;
    [...el.querySelectorAll<HTMLElement>('[data-fly]')].forEach((node, i) => {
      const f = flights[i];
      if (f === undefined) return;
      /* Ein Bogen nach oben (wie geworfen): die Mitte liegt über der Linie, je weiter, desto höher. */
      const dx = f.to.x - f.from.x, dy = f.to.y - f.from.y;
      const lift = Math.min(180, 40 + Math.hypot(dx, dy) * 0.25);
      const frames: Keyframe[] = [];
      for (let k = 0; k <= 8; k += 1) {
        const u = k / 8;
        const x = f.from.x + dx * u;
        const y = f.from.y + dy * u - lift * 4 * u * (1 - u);
        const s = k === 0 ? 0.4 : k === 8 ? 0.55 : 1.15 - 0.4 * u;
        frames.push({ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${s.toFixed(2)})`, opacity: k === 0 ? 0 : k === 8 ? 0.2 : 1, offset: u });
      }
      runs.push(node.animate(frames, { duration: FLY_MS, delay: f.delay, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' }));
      /* Die Landung: ein Ring geht am Ziel auf. */
      const ring = node.nextElementSibling as HTMLElement | null;
      if (ring !== null) {
        runs.push(ring.animate([
          { transform: `translate(${f.to.x}px, ${f.to.y}px) translate(-50%, -50%) scale(0.2)`, opacity: 0.9 },
          { transform: `translate(${f.to.x}px, ${f.to.y}px) translate(-50%, -50%) scale(1.6)`, opacity: 0 }
        ], { duration: 520, delay: f.delay + FLY_MS - 60, easing: 'ease-out', fill: 'both' }));
      }
      last = Math.max(last, f.delay + FLY_MS + 520);
    });
    const id = window.setTimeout(() => doneRef.current(), last + 40);
    return () => { window.clearTimeout(id); for (const a of runs) a.cancel(); };
  }, [flights, motion]);
  if (motion !== 'full') return null;
  return (
    <div ref={box} className="cg-wm-flights" aria-hidden="true" data-world-flights={flights.length}>
      {flights.map((f, i) => (
        <span key={i} className="cg-wm-flypair">
          <span className={`cg-wm-fly is-${f.kind}`} data-fly={f.kind}><Token kind={f.kind} /></span>
          <span className={`cg-wm-flyland is-${f.kind}`} />
        </span>
      ))}
    </div>
  );
}
