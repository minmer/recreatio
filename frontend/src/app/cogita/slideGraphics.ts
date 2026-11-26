/**
 * 2026-11-26 (Eigentümer: „dieselbe Grafik auf mehr als einer Folie — wiederverwenden, etwas dazufügen; einfache Übergänge, die ihre
 * Animationen einbinden") — GRAFIKEN DER BAZA UND IHR WEG VON FOLIE ZU FOLIE. Rein, ohne Oberfläche (geprüft in
 * `scripts/app-slide-graphics-check.mjs`).
 *
 * <code>
 *   Grafika (Dokument "graphic", im JSON "graphics")   { "ref": "atom", "name": "Atom", "drawing": { size, elements, vars … } }
 *                                                        — dasselbe JSON wie ein Rysunek am Schritt (Animacja, Frage "interactive")
 *   am Schritt "show" / "choice":
 *     "drawing": "@atom"                                 die Grafik, wie sie ist
 *     "drawing": { "graphic": "@atom",                   die Grafik und dazu, NUR für diese Folie:
 *                  "add":    [ {Teil}, … ],                neue Teile (oben drauf)
 *                  "change": { "kern": { "fill": "ok" } }, Teile mit "id" ändern (Werte ersetzen, "motion" auch)
 *                  "hide":   [ "elektron2" ],              Teile mit "id" weglassen
 *                  "set":    { "vars": { "n": 3 } } }      oben ersetzen ("vars" werden zusammengeführt)
 *     "drawing": { … ein ganzes Bild … } | "<Feld>"      wie bisher: ein eigenes Bild, ohne Übergang
 *   "transition" (am Schritt, sonst am Ablauf):         "fade" (Vorgabe) | "slide" | "zoom" | "none" — wie der TEXT der Folie kommt
 * </code>
 *
 * <b>Von Folie zu Folie mit derselben Grafik</b> (`morphGraphic`) bleibt das Bild stehen; nur was sich ändert, bewegt sich — in
 * denselben Wörtern wie jede Animation (`pages/motion/motion.ts`, ein Bewegung "keys" vor den eigenen):
 * <code>
 *   ein Teil (gleiche "id", sonst gleicher Inhalt) bleibt    seine einmaligen Bewegungen ("once") spielen nicht noch einmal;
 *                                                            Schleifen laufen weiter
 *   … an anderer Stelle, in anderer Grösse, Drehung, Farbe  gleitet vom alten Stand in den neuen (700 ms)
 *   ein neuer Teil                                          spielt seine eigene Bewegung — ohne eigene blendet er sich ein
 *   ein Teil, der fehlt                                     blendet sich aus
 * </code>
 * Ausdrücke ("=x0 + v*t") bewegen sich selbst — sie gleiten nicht. Ein Bild mit Werten (vars) beginnt mit den Werten der neuen Folie.
 */

import { readMotions, timingOf } from '../pages/motion/motion';

export { readTransition, SLIDE_TRANSITIONS, type SlideTransition } from './slideTransition';

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export const MORPH_MS = 700;
/** Die Grafik einer Folie: welche geteilte Grafik (null: ein eigenes Bild) und das ganze Bild als JSON. */
export interface SlideGraphic {
  readonly graphic: string | null;
  readonly raw: Raw;
}

/** Welche geteilte Grafik ein Wert "drawing" nennt (`"@atom"`, eine Kennung, `{ "graphic": … }`) — `null`: keine. */
export function graphicRefOf(value: unknown): string | null {
  if (isObject(value)) return str(value.graphic) || null;
  const s = str(value);
  return s === '' || s.startsWith('{') ? null : s;
}

const elementsOf = (raw: Raw): Raw[] => (Array.isArray(raw.elements) ? raw.elements.filter(isObject) : []);
const listOf = (v: unknown): Raw[] => (Array.isArray(v) ? v.filter(isObject) : isObject(v) ? [v] : []);

/** Die Grafik und was diese Folie dazutut (`add`, `change`, `hide`, `set`). */
export function composeGraphic(base: Raw, over: Raw): Raw {
  const hide = new Set((Array.isArray(over.hide) ? over.hide : [over.hide]).map(str).filter((s) => s !== ''));
  const change = isObject(over.change) ? over.change : {};
  const elements = elementsOf(base)
    .filter((e) => !hide.has(str(e.id)))
    .map((e) => { const c = change[str(e.id)]; return str(e.id) !== '' && isObject(c) ? { ...e, ...c } : e; });
  const set = isObject(over.set) ? over.set : {};
  const out: Raw = { ...base };
  for (const [k, v] of Object.entries(set)) out[k] = k === 'vars' && isObject(base.vars) && isObject(v) ? { ...base.vars, ...v } : v;
  out.elements = [...elements, ...listOf(over.add)];
  return out;
}

/**
 * Die Grafik eines Schrittes. `lookup`: eine Grafik der Baza beim Namen oder der Kennung → ihre Kennung und ihr Bild.
 * `own`: wie bisher ein eigenes Bild (JSON-Text — auch aus einem Feld des Eintrags), wenn keine Grafik genannt ist.
 */
export function slideGraphicOf(value: unknown, lookup: (ref: string) => { readonly id: string; readonly drawing: Raw } | null, own: () => string | null): SlideGraphic | null {
  const ref = graphicRefOf(value);
  if (ref !== null) {
    const hit = lookup(ref);
    if (hit !== null) return { graphic: hit.id, raw: isObject(value) ? composeGraphic(hit.drawing, value) : hit.drawing };
    /* Ein Objekt mit "graphic", das es nicht gibt: kein Bild (der Import warnt). Ein Name ohne Grafik: vielleicht ein Feld. */
    if (isObject(value)) return null;
  }
  const text = own();
  if (text === null) return null;
  try { const raw = JSON.parse(text) as unknown; return isObject(raw) ? { graphic: null, raw } : null; } catch { return null; }
}

/* -- Von Folie zu Folie ------------------------------------------------------------------------------------------------- */

/** Ein stabiler Schlüssel eines Teils: seine "id", sonst sein Inhalt (ohne Bewegungen). */
function keyOf(e: Raw): string {
  const id = str(e.id);
  if (id !== '') return `#${id}`;
  const { motion: _m, ...rest } = e;
  return `=${stable(rest)}`;
}
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (isObject(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}

const motionList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
/** Nur die Bewegungen, die laufen, solange das Teil zu sehen ist (Schleifen) — ein Auftritt spielt nicht noch einmal. */
const loopsOnly = (v: unknown): unknown[] => motionList(v).filter((m) => { const u = readMotions([m])[0]; return u !== undefined && timingOf(u).iterations !== 1; });
const hasOwnMotion = (e: Raw): boolean => motionList(e.motion).length > 0;
const num = (v: unknown, fallback: number): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : v === undefined ? fallback : null);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/** Wo ein Teil seine Mitte hat und wie gross es ist — `null`: nicht in Zahlen (ein Ausdruck). */
function placeOf(e: Raw): { cx: number; cy: number; w: number; h: number; rotate: number; scale: number } | null {
  const type = str(e.type);
  const x = num(e.x, 0), y = num(e.y, 0), rotate = num(e.rotate, 0), scale = num(e.scale, 1);
  if (x === null || y === null || rotate === null || scale === null) return null;
  if (type === 'rect' || type === 'image') {
    const w = num(e.w, 0), h = num(e.h, 0);
    return w === null || h === null ? null : { cx: x + w / 2, cy: y + h / 2, w, h, rotate, scale };
  }
  if (type === 'circle') { const r = num(e.r, 0); return r === null ? null : { cx: x, cy: y, w: 2 * r, h: 2 * r, rotate, scale }; }
  if (type === 'ellipse') { const w = num(e.w, 0), h = num(e.h, 0); return w === null || h === null ? null : { cx: x, cy: y, w, h, rotate, scale }; }
  if (type === 'line' || type === 'arrow') {
    const x2 = num(e.x2, 0), y2 = num(e.y2, 0);
    return x2 === null || y2 === null ? null : { cx: (x + x2) / 2, cy: (y + y2) / 2, w: x2 - x, h: y2 - y, rotate, scale };
  }
  /* text, group, use, path, poly …: der Anker als Ort, ohne eigene Grösse. */
  return { cx: x, cy: y, w: 1, h: 1, rotate, scale };
}

/** Die Bewegung vom alten Stand eines Teils in den neuen — `null`: nichts zu bewegen. */
function glide(prev: Raw, next: Raw, ms: number): Raw[] {
  const a = placeOf(prev), b = placeOf(next);
  const out: Raw[] = [];
  if (a !== null && b !== null) {
    const type = str(next.type);
    const lineLike = type === 'line' || type === 'arrow';
    /* Eine Linie, deren Richtung sich ändert, gleitet nicht (sie würde sich verbiegen) — sie verschiebt sich nur, wenn sie gleich bleibt. */
    const sameShape = !lineLike || (near(a.w, b.w) && near(a.h, b.h));
    const dx = a.cx - b.cx, dy = a.cy - b.cy;
    const sx = lineLike || b.w === 0 ? 1 : a.w / b.w, sy = lineLike || b.h === 0 ? 1 : a.h / b.h;
    const s = b.scale === 0 ? 1 : a.scale / b.scale;
    const turn = a.rotate - b.rotate;
    const opA = num(prev.opacity, 1), opB = num(next.opacity, 1);
    const fadeFrom = opA !== null && opB !== null && opB > 0 && opA < opB ? opA / opB : null;
    const moved = sameShape && (!near(dx, 0) || !near(dy, 0));
    const sized = !near(sx * s, 1) || !near(sy * s, 1);
    if (moved || sized || !near(turn, 0) || fadeFrom !== null) {
      out.push({
        name: 'keys', duration: ms, ease: 'inOut', repeat: 'once',
        keys: [
          { at: 0, ...(moved ? { x: dx, y: dy } : {}), ...(sized ? { sx: sx * s, sy: sy * s } : {}), ...(near(turn, 0) ? {} : { rotate: turn }), ...(fadeFrom === null ? {} : { opacity: fadeFrom }) },
          { at: 1, ...(moved ? { x: 0, y: 0 } : {}), ...(sized ? { sx: 1, sy: 1 } : {}), ...(near(turn, 0) ? {} : { rotate: 0 }), ...(fadeFrom === null ? {} : { opacity: 1 }) }
        ]
      });
    }
  }
  const fa = str(prev.fill), fb = str(next.fill);
  if (fa !== '' && fb !== '' && fa !== fb && !fa.startsWith('=') && !fb.startsWith('=') && !fa.startsWith('radial(') && !fb.startsWith('radial(')) {
    out.push({ name: 'color', duration: ms, ease: 'inOut', repeat: 'once', from: fa, to: fb });
  }
  return out;
}

/**
 * DAS BILD DER NEUEN FOLIE, WENN DIE VORIGE DIESELBE GRAFIK ZEIGTE: was bleibt, bleibt; was sich ändert, gleitet; Neues kommt,
 * Fehlendes geht. Eine andere oder keine vorige Grafik: das Bild, wie es ist (es tritt mit seinen eigenen Bewegungen auf).
 */
export function morphGraphic(prev: SlideGraphic | null, next: SlideGraphic, ms = MORPH_MS): Raw {
  if (prev === null || next.graphic === null || prev.graphic !== next.graphic) return next.raw;
  const before = new Map(elementsOf(prev.raw).map((e) => [keyOf(e), e] as const));
  const seen = new Set<string>();
  const elements = elementsOf(next.raw).map((e): Raw => {
    const key = keyOf(e);
    const old = before.get(key);
    if (old === undefined) {
      /* Neu: die eigene Bewegung — sonst einblenden, nachdem das Bleibende sich gesetzt hat. */
      return hasOwnMotion(e) ? e : { ...e, motion: [{ name: 'keys', duration: Math.round(ms * 0.6), delay: Math.round(ms * 0.3), repeat: 'once', keys: [{ at: 0, opacity: 0 }, { at: 1, opacity: 1 }] }] };
    }
    seen.add(key);
    const motion = [...glide(old, e, ms), ...loopsOnly(e.motion)].slice(0, 3);
    const { motion: _m, ...rest } = e;
    return motion.length === 0 ? rest : { ...rest, motion };
  });
  /* Was fehlt, geht: es steht noch einen Augenblick da und blendet sich aus (oben, damit man es gehen sieht). */
  for (const [key, old] of before) {
    if (seen.has(key)) continue;
    const { motion: _m, ...rest } = old;
    elements.push({ ...rest, motion: [{ name: 'keys', duration: Math.round(ms * 0.6), repeat: 'once', keys: [{ at: 0, opacity: 1 }, { at: 1, opacity: 0 }] }] });
  }
  return { ...next.raw, elements };
}
