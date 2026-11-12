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
  /**
   * 2026-11-12 (Eigentümer: „die Punkte fliegen ins Leere") — das ZIEL, nicht ein Punkt: wo es liegt, wird in jedem Bild neu
   * gefragt (die Karte wird nach dem Schliessen der Tafel kleiner, gleitet, die Seite rollt) — das Zeichen landet, wo der Turm
   * oder der Pfad dann wirklich steht.
   */
  readonly target: { readonly kind: 'place' | 'section'; readonly id: string };
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
  /* Nur zu Zielen, die gerade im Bild sind (gefragt, wenn die Tafel noch steht); geflogen wird zu ihrem Ort in jedem Bild. */
  const add = (kind: FlightKind, from: { x: number; y: number } | null, tk: 'place' | 'section', id: string) => {
    if (from === null || out.length >= MAX_FLIGHTS || spot(tk, id) === null) return;
    out.push({ kind, from, target: { kind: tk, id }, delay: out.length * STAGGER_MS });
  };
  const conquered = new Set(pb.conquered);
  for (const id of pb.conquered) add('flag', first(`place:${id}`, 'head', 'card'), 'place', id);
  for (const id of pb.levelled) if (!conquered.has(id)) add('level', first(`place:${id}`, 'levels', 'known', 'card'), 'place', id);
  for (const id of opened) add('way', first(`section:${id}`, 'card'), 'section', id);
  const moved = [...new Set([...pb.reviewed, ...pb.levelled, ...pb.conquered, ...pb.moved])];
  for (let round = 0; round < CARDS_PER; round += 1) {
    for (const id of moved) add('card', first('known', 'right', 'steps', 'card'), 'place', id);
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

const RING_MS = 520;

/** Die fliegenden Zeichen über allem (fest im Fenster); `onDone`, wenn das letzte gelandet ist. `locate`: wo ein Ziel jetzt steht. */
export function WorldFlight({ flights, locate, onDone }: { flights: readonly Flight[]; locate: Spot; onDone: () => void }) {
  const motion = useMotion();
  const box = useRef<HTMLDivElement | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const locateRef = useRef(locate);
  locateRef.current = locate;
  useEffect(() => {
    const el = box.current;
    if (el === null || motion !== 'full' || flights.length === 0) { doneRef.current(); return undefined; }
    /*
      Bild für Bild: der Bogen von der Tafel zum Ziel, wo es JETZT steht (verschwindet es aus dem Bild: zum letzten bekannten Ort,
      dabei verblassend). Gelandet geht am Ziel ein Ring auf.
    */
    const nodes = [...el.querySelectorAll<HTMLElement>('[data-fly]')];
    const rings = nodes.map((n) => n.nextElementSibling as HTMLElement | null);
    const last = flights.map((f) => locateRef.current(f.target.kind, f.target.id) ?? f.from);
    const t0 = performance.now();
    const end = Math.max(...flights.map((f) => f.delay)) + FLY_MS + RING_MS;
    let raf = 0;
    const frame = (now: number) => {
      const tau = now - t0;
      flights.forEach((f, i) => {
        const node = nodes[i], ring = rings[i];
        if (node === undefined) return;
        const seen = locateRef.current(f.target.kind, f.target.id);
        if (seen !== null) last[i] = seen;
        const to = last[i]!;
        const u = Math.max(0, Math.min(1, (tau - f.delay) / FLY_MS));
        const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
        const dx = to.x - f.from.x, dy = to.y - f.from.y;
        const lift = Math.min(180, 40 + Math.hypot(dx, dy) * 0.25);
        const x = f.from.x + dx * e, y = f.from.y + dy * e - lift * 4 * e * (1 - e);
        const s = u <= 0 ? 0.4 : 1.15 - 0.6 * e;
        node.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${s.toFixed(2)})`;
        node.style.opacity = u <= 0 || u >= 1 ? '0' : String(Math.min(1, u * 6) * (seen === null ? 0.5 : 1));
        if (ring !== null) {
          const r = Math.max(0, Math.min(1, (tau - f.delay - FLY_MS + 60) / RING_MS));
          ring.style.transform = `translate(${to.x.toFixed(1)}px, ${to.y.toFixed(1)}px) translate(-50%, -50%) scale(${(0.2 + 1.4 * r).toFixed(2)})`;
          ring.style.opacity = r <= 0 || r >= 1 ? '0' : String(0.9 * (1 - r));
        }
      });
      if (tau < end) raf = requestAnimationFrame(frame); else doneRef.current();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [flights, motion]);
  if (motion !== 'full') return null;
  return (
    <div ref={box} className="cg-wm-flights" aria-hidden="true" data-world-flights={flights.length}>
      {flights.map((f, i) => (
        <span key={i} className="cg-wm-flypair">
          <span className={`cg-wm-fly is-${f.kind}`} data-fly={f.kind} data-fly-to={`${f.target.kind}:${f.target.id}`}><Token kind={f.kind} /></span>
          <span className={`cg-wm-flyland is-${f.kind}`} />
        </span>
      ))}
    </div>
  );
}

