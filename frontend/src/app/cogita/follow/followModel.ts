/**
 * 2026-11-24 (Eigentümer: „Tryb prowadzony") — DIE KLASSE FOLGT DER LEHRERIN: eine dauernde Stunde (Sitzung `lesson` im Bereich der
 * Klasse, config `{ follow: true }`), bis die Lehrerin sie beendet. Ihr Gerät schickt NUR Inhalt — die Karte (Widok, Kamera, das
 * Gewählte, der Modus, der Tag-Ausschnitt), eine Folie, eine Frage (eine Abstimmung wie in jeder Stunde), einen Schritt einer
 * Erzählung — nie ihre eigenen Werkzeuge (QR-Code, Konsole, Menüs). Darum behalten die Schüler das zuletzt Geschickte, solange sie
 * etwas anderes zeigt („angeheftet"). Rein: dieselbe Rechnung für Schüler, Leinwand und Prüfung (`scripts/app-follow-check.mjs`).
 *
 * <code>
 *   follow-map    { view, cam: SharedCam | null, chosen: { kind, id } | null, mode, slice: [tag…], at }   die Karte (nur bei Änderung,
 *                 nach dem Stillstand der Kamera)
 *   follow-show   { kind: 'map', at }                                                                      zurück zur Karte
 *   step          wie jede Stunde (`LessonStepEvent`): eine Folie (show) mit ihrem Eintrag, das Ende, …
 *   question      wie jede Stunde: eine Frage öffnet die Abstimmung; `answer` (versiegelt für die Przyjęcia), `reveal`
 * </code>
 * Was gezeigt wird: das jüngere von `follow-show` und `step` (nach seq). Die Kamera wird als Ausschnitt geschickt (Mitte, Drehung,
 * Neigung, wie viel Boden in Breite und Höhe zu sehen ist) — jedes Gerät rechnet daraus seinen Zoom.
 */

import type { Opened } from '../sessionEvents';

export const FOLLOW_MAP = 'follow-map';
export const FOLLOW_SHOW = 'follow-show';

/** Die Kamera als Ausschnitt des Bodens — unabhängig von der Grösse des Bildschirms. */
export interface SharedCam {
  readonly cx: number;
  readonly cy: number;
  readonly rot: number;
  readonly fore: number;
  /** Wie viele Bodeneinheiten in der Breite und Höhe zu sehen sind. */
  readonly spanW: number;
  readonly spanH: number;
}

export interface FollowChosen { readonly kind: string; readonly id: string }

export interface FollowMapState {
  readonly view: string;
  readonly cam: SharedCam | null;
  readonly chosen: FollowChosen | null;
  readonly mode: string;
  readonly slice: readonly string[];
  readonly at: number;
}

export interface FollowConfig {
  readonly title: string;
  readonly follow: true;
  readonly classArea: string;
  readonly library: string;
}

export const isFollowConfig = (c: unknown): c is FollowConfig =>
  typeof c === 'object' && c !== null && (c as { follow?: unknown }).follow === true;

/** Was die Schüler gerade sehen. */
export type FollowContent = 'none' | 'map' | 'slide' | 'question' | 'choice';

export interface FollowNow {
  readonly config: FollowConfig | null;
  readonly map: FollowMapState | null;
  readonly content: FollowContent;
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Eine Kamera aus einem Ereignis — duldsam (was nicht stimmt, gilt nicht). */
export function readCam(v: unknown): SharedCam | null {
  if (typeof v !== 'object' || v === null) return null;
  const c = v as Record<string, unknown>;
  if (![c.cx, c.cy, c.rot, c.fore, c.spanW, c.spanH].every(num) || (c.spanW as number) <= 0 || (c.spanH as number) <= 0) return null;
  return { cx: c.cx as number, cy: c.cy as number, rot: c.rot as number, fore: c.fore as number, spanW: c.spanW as number, spanH: c.spanH as number };
}

export function readMapState(v: unknown): FollowMapState | null {
  if (typeof v !== 'object' || v === null) return null;
  const m = v as Record<string, unknown>;
  if (typeof m.view !== 'string' || m.view === '') return null;
  const ch = m.chosen as Record<string, unknown> | null | undefined;
  return {
    view: m.view,
    cam: readCam(m.cam),
    chosen: ch !== null && typeof ch === 'object' && typeof ch.kind === 'string' && typeof ch.id === 'string' ? { kind: ch.kind, id: ch.id } : null,
    mode: typeof m.mode === 'string' ? m.mode : 'all',
    slice: Array.isArray(m.slice) ? m.slice.filter((x): x is string => typeof x === 'string') : [],
    at: num(m.at) ? m.at : 0
  };
}

/** Der Zoom eines Geräts aus dem Ausschnitt: so viel Boden wie bei der Lehrerin — ganz zu sehen. */
export const zoomFor = (cam: SharedCam, w: number, h: number): number => Math.max(0.01, Math.min(w / cam.spanW, h / cam.spanH));

/** Zwei Kameras gleich (für „nur bei Änderung")? */
export function sameCam(a: SharedCam | null, b: SharedCam | null): boolean {
  if (a === null || b === null) return a === b;
  const near = (x: number, y: number, eps: number) => Math.abs(x - y) <= eps;
  const span = Math.max(a.spanW, a.spanH);
  return near(a.cx, b.cx, span * 0.005) && near(a.cy, b.cy, span * 0.005) && near(a.rot, b.rot, 0.5) && near(a.fore, b.fore, 0.005)
    && near(a.spanW, b.spanW, a.spanW * 0.01) && near(a.spanH, b.spanH, a.spanH * 0.01);
}

/** Zwei Zustände der Karte gleich (die Zeit zählt nicht)? */
export const sameMap = (a: FollowMapState | null, b: FollowMapState | null): boolean =>
  a === null || b === null ? a === b
    : a.view === b.view && a.mode === b.mode && a.slice.join('|') === b.slice.join('|')
      && (a.chosen?.kind ?? '') === (b.chosen?.kind ?? '') && (a.chosen?.id ?? '') === (b.chosen?.id ?? '') && sameCam(a.cam, b.cam);

/**
 * WAS GERADE GILT — aus den Ereignissen der Sitzung (geöffnet). Die Karte: der letzte `follow-map`. Der Inhalt: das jüngere von
 * `follow-show` (zurück zur Karte) und `step` (eine Folie, eine Frage, eine Wahl; das Ende einer Erzählung → Karte).
 */
export function followNow(opened: readonly Opened[], closed = false): FollowNow {
  let config: FollowConfig | null = null;
  let map: FollowMapState | null = null;
  let lastShowSeq = -1;
  let lastStep: { seq: number; kind: string } | null = null;
  for (const o of opened) {
    const body = o.body;
    switch (o.event.kind) {
      case 'config': if (isFollowConfig(body)) config = body; break;
      case FOLLOW_MAP: { const m = readMapState(body); if (m !== null) map = m; break; }
      case FOLLOW_SHOW: lastShowSeq = Math.max(lastShowSeq, o.event.seq); break;
      case 'step': if (typeof body === 'object' && body !== null && typeof (body as { kind?: unknown }).kind === 'string') lastStep = { seq: o.event.seq, kind: (body as { kind: string }).kind }; break;
      default: break;
    }
  }
  if (closed || config === null) return { config, map, content: 'none' };
  let content: FollowContent = map === null ? 'none' : 'map';
  if (lastStep !== null && lastStep.seq > lastShowSeq) {
    content = lastStep.kind === 'show' ? 'slide' : lastStep.kind === 'question' ? 'question' : lastStep.kind === 'choice' || lastStep.kind === 'chapters' ? 'choice' : content;
  }
  return { config, map, content };
}

/**
 * DAS VERÖFFENTLICHEN der Lehrerin (rein): was sie gerade zeigt (`current`) und was die Klasse zuletzt bekam (`sent`). Ist das Bild
 * angehalten, geht nichts hinaus; „Pokaż uczniom" (`force`) schickt trotzdem. Nur Änderungen gehen hinaus.
 */
export interface PublishState {
  readonly frozen: boolean;
  readonly currentMap: FollowMapState | null;
  readonly sentMap: FollowMapState | null;
}

export function mapToSend(s: PublishState, force = false): FollowMapState | null {
  if (s.currentMap === null) return null;
  if (s.frozen && !force) return null;
  if (!force && sameMap(s.currentMap, s.sentMap)) return null;
  return s.currentMap;
}
