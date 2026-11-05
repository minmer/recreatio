/**
 * 2026-11-04 (Prompt 11) — WAS NACH DEM ENDE EINER ERZÄHLUNG KOMMT, aus der einen Reihenfolge des Lernens (nie aus Links,
 * die eine Erzählung selbst setzt): was auf ihrer Einheit aufbaut (Einträge ohne Karten sind durchsichtig); hat die
 * Einheit nichts danach, was auf dem aufbaut, was die Erzählung lehrt und aus ihr hinausführt.
 * <code>
 *   Nachfolger   eine Erzählung (ihre Einheit) oder ein Thema mit Karten, noch nicht gelernt
 *   bereit       nichts davor fehlt und nichts davor ist zu wiederholen (dieselbe Sperre wie vor einer Erzählung)
 *   sonst        was fehlt (beim Namen) und was zuerst zu wiederholen ist
 *   keiner       das nächste lernbare Feld der Karte (die wenigsten Schritte im Graphen des Lernens), sonst nichts
 *                (der Gastgeber zeigt dann „Wróć do mapy")
 * </code>
 * Rein; `storyLock.ts` (`nextForStory`) holt die Eingaben aus der Baza und dem Lernenden.
 */

import { askCounts, type StoryPath } from './storyPath';

export interface NextInput {
  /** Die Einheit der Erzählung — `null`: sie hat keine. */
  readonly unit: string | null;
  /** Was die Erzählung zeigt und fragt (ihre Einträge). */
  readonly taught: readonly string[];
  readonly needs: (id: string) => readonly string[];
  readonly builds: (id: string) => readonly string[];
  /** Eine Erzählung (die Einheit eines Ablaufs) / ein Thema mit Karten — nur sie sind Ziele. */
  readonly story: (id: string) => boolean;
  readonly topic: (id: string) => boolean;
  /** Gelernt (eine Erzählung: ihr Przegląd bestanden). */
  readonly learned: (id: string) => boolean;
  /** Die Sperre davor: was noch fehlt, was zuerst zu wiederholen ist (Einträge, in der Reihenfolge des Weges). */
  readonly lock: (id: string) => { readonly missing: readonly string[]; readonly due: readonly string[] };
  /** Die Reihenfolge, wenn mehrere gleich nah sind (Stufe, Autor). */
  readonly order?: (a: string, b: string) => number;
}

export interface NextStep {
  readonly id: string;
  readonly kind: 'story' | 'topic';
  readonly ready: boolean;
  readonly missing: readonly string[];
  readonly due: readonly string[];
}

export interface StoryNext {
  /** Die Nachfolger: die bereiten zuerst, dann die anderen (je in der Reihenfolge des Lernens). */
  readonly next: readonly NextStep[];
  /** Ist keiner bereit: das nächste lernbare Feld der Karte (`null`: keins — zurück zur Karte). */
  readonly nearest: NextStep | null;
  /** 2026-11-05 — die Nachfolger, die der Lernende schon kann (gelernt / zu Ende): „Co dalej" zeigt sie danach, als erledigt. */
  readonly done?: readonly string[];
}

/** Was auf diesen Einträgen aufbaut: die ersten lernbaren dahinter (durch Einträge ohne Karten hindurch, bis 4 Schritte). */
function successorsOf(from: readonly string[], input: NextInput, inside: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>(from);
  let wave = [...from];
  for (let depth = 0; depth < 4 && wave.length > 0; depth += 1) {
    const next: string[] = [];
    for (const id of wave) {
      for (const b of input.builds(id)) {
        if (seen.has(b)) continue;
        seen.add(b);
        if (inside.has(b)) continue;
        if (input.story(b) || input.topic(b)) { if (!out.includes(b)) out.push(b); continue; }
        next.push(b);
      }
    }
    wave = next;
  }
  return out;
}

export function storyNext(input: NextInput, limit = 6): StoryNext {
  const order = input.order ?? ((a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0));
  const inside = new Set<string>([...input.taught, ...(input.unit === null ? [] : [input.unit])]);
  const learnable = (id: string) => input.story(id) || input.topic(id);
  let found = input.unit === null ? [] : successorsOf([input.unit], input, inside);
  if (found.length === 0) found = successorsOf(input.taught, input, inside);
  const stepOf = (id: string): NextStep => {
    const lock = input.lock(id);
    const missing = lock.missing.filter((x) => x !== id);
    return { id, kind: input.story(id) ? 'story' : 'topic', ready: missing.length === 0 && lock.due.length === 0, missing, due: lock.due };
  };
  const steps = found.filter((id) => !input.learned(id)).sort(order).map(stepOf);
  const next = [...steps.filter((s) => s.ready), ...steps.filter((s) => !s.ready)].slice(0, limit);
  const done = found.filter((id) => input.learned(id)).sort(order).slice(0, limit);
  if (next.some((s) => s.ready)) return { next, nearest: null, done };
  /* Keiner bereit: das nächste lernbare Feld — Schritt für Schritt durch den Graphen des Lernens (beide Richtungen). */
  const starts = input.unit === null ? [...input.taught] : [input.unit];
  const seen = new Set<string>(starts);
  let wave = starts;
  for (let depth = 0; depth < 12 && wave.length > 0; depth += 1) {
    const ring: string[] = [];
    for (const id of wave) for (const v of [...input.needs(id), ...input.builds(id)]) if (!seen.has(v)) { seen.add(v); ring.push(v); }
    const hits = ring.filter((v) => learnable(v) && !inside.has(v) && !input.learned(v)).sort(order).map(stepOf).filter((s) => s.ready);
    if (hits.length > 0) return { next, nearest: hits[0], done };
    wave = ring;
    if (seen.size > 5000) break;
  }
  return { next, nearest: null, done };
}

/** Was eine Erzählung bringt (ohne ihren Przegląd — er wiederholt): Bilder und die Fragen, die wirklich gefragt würden. */
export function storyWork(sp: StoryPath, knownStep?: (step: string) => boolean): { readonly slides: number; readonly questions: number; readonly ask: number } {
  const ask = askCounts(sp, knownStep);
  let slides = 0;
  let questions = 0;
  let asked = 0;
  sp.parts.forEach((p, i) => {
    if (p.kind === 'review') return;
    slides += p.slides;
    questions += p.questions;
    asked += ask[i];
  });
  return { slides, questions, ask: asked };
}
