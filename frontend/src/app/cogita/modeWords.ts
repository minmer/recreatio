/**
 * 2026-11-22 — DIE WÖRTER DER MODI (`modes.ts`, die Bedingung „mode" in `logic.ts`): wie Autoren "use" und "is" schreiben —
 * auch auf Polnisch und Deutsch. Ohne Abhängigkeiten (beide lesen sie, ohne einander zu laden).
 */

export type PlayMode = 'self' | 'lesson';
export type StepUse = 'self' | 'lesson' | 'both';

const USE_WORDS: Readonly<Record<string, StepUse>> = {
  both: 'both', all: 'both', oba: 'both', obie: 'both', zawsze: 'both', beide: 'both', immer: 'both',
  self: 'self', 'self-study': 'self', selfstudy: 'self', study: 'self', samodzielnie: 'self', sam: 'self', samemu: 'self', selbst: 'self', allein: 'self', selbststudium: 'self',
  lesson: 'lesson', lekcja: 'lesson', lekcji: 'lesson', klasa: 'lesson', class: 'lesson', teacher: 'lesson', unterricht: 'lesson', stunde: 'lesson', lektion: 'lesson'
};

/** Ein Wert "use" gelesen — `null`: keiner (oder einer, den es nicht gibt; der Import warnt). */
export function readUse(v: unknown): StepUse | null {
  const key = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return key === '' ? null : USE_WORDS[key] ?? null;
}

/** Ein Modus gelesen (die Bedingung „mode", `is`) — `null`: keiner. */
export function readMode(v: unknown): PlayMode | null {
  const use = readUse(v);
  return use === 'self' || use === 'lesson' ? use : null;
}
