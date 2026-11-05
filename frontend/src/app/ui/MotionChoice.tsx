/**
 * 2026-11-05 (Prompt 17) — „ANIMACJE" AUF DIESEM GERÄT: wie im System (prefers-reduced-motion), voll, reduziert (nur
 * Überblendungen) oder aus (alles sofort). Gilt für die ganze Anwendung (`motion.ts` setzt `data-motion` auf `<html>`);
 * gemerkt in diesem Browser. Die Worte gibt der Aufrufer (die Sprache der Baza oder der Anwendung).
 */

import { setMotionChoice, useMotionChoice, type MotionChoice as Choice } from './motion';

export interface MotionChoiceWords {
  readonly motion: string;
  readonly motionAuto: string;
  readonly motionFull: string;
  readonly motionReduced: string;
  readonly motionOff: string;
  readonly motionSays: string;
}

export function MotionChoice({ words }: { words: MotionChoiceWords }) {
  const choice = useMotionChoice();
  const options: readonly (readonly [Choice, string])[] = [['auto', words.motionAuto], ['full', words.motionFull], ['reduced', words.motionReduced], ['off', words.motionOff]];
  return (
    <div className="wk-field" data-motion-choice={choice}>
      <span className="wk-label">{words.motion}</span>
      <div className="wk-seg" role="group" aria-label={words.motion}>
        {options.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={choice === value} className={choice === value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
            onClick={() => setMotionChoice(value)} data-motion-pick={value}>
            {label}
          </button>
        ))}
      </div>
      <p className="wk-card-muted">{words.motionSays}</p>
    </div>
  );
}
