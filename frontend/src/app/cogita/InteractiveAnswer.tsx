/**
 * COGITA — DIE ANTWORT MIT DEN HÄNDEN (`interactive.ts` sagt, wie geprüft
 * wird): das Bild zum Anfassen der Frage, darunter „Sprawdź". Abgegeben werden
 * die Werte, die gerade eingestellt sind. Nach der Antwort läuft dasselbe Bild
 * mit diesen Werten noch einmal ab — man sieht, was geschah —, und wer daneben
 * lag, kann die Lösung ablaufen lassen.
 *
 * Das Bild selbst (`LiveDrawing`) kommt erst, wenn eine solche Karte gezeigt
 * wird.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import type { Card } from './cardBasics';
import { drawingOfText, liveWithGoal, solutionValues, type InteractiveSpec } from './interactive';
import type { Program } from '../pages/motion/liveRun';
import { later } from '../ui/later';

const Live = later(() => import('../pages/motion/LiveDrawing').then((m) => m.LiveDrawing));

const specOf = (card: Card): InteractiveSpec | null => (card.answer.form === 'interactive' ? card.answer : null);

/** Das Bild der Karte, mit dem Ziel der Frage als Regel — so meldet es das Treffen schon beim Ausprobieren. */
function useDrawing(spec: InteractiveSpec | null) {
  return useMemo(() => {
    if (spec === null) return null;
    const d = drawingOfText(spec.drawing);
    return d === null ? null : { ...d, live: liveWithGoal(d.live, spec.goal) };
  }, [spec]);
}

export function InteractiveAnswer({ card, disabled, onSubmit }: { card: Card; disabled?: boolean; onSubmit: (given: unknown) => void }) {
  const spec = specOf(card);
  const drawing = useDrawing(spec);
  const program = useRef<Program | null>(null);
  const onProgram = useCallback((p: Program) => { program.current = p; }, []);
  if (spec === null || drawing === null) return <p className="wk-error">Ten rysunek jest pusty albo nie jest poprawnym JSON.</p>;
  return (
    <div className="cg-answer cg-live">
      <Live drawing={drawing} identity={`${card.key}|${card.fingerprint}|${JSON.stringify(spec.fixed)}`} fixed={spec.fixed} onProgram={onProgram} locked={disabled === true} />
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={disabled} onClick={() => onSubmit({ vars: program.current?.snapshot() ?? {} })}>Sprawdź</button>
      </div>
    </div>
  );
}

/** Nach der Antwort: was mit den eigenen Werten geschah — und auf Wunsch die Lösung. */
export function InteractiveReplay({ card, given }: { card: Card; given: unknown }) {
  const spec = specOf(card);
  const drawing = useDrawing(spec);
  const [showSolution, setShowSolution] = useState(false);
  const mine = typeof given === 'object' && given !== null && typeof (given as { vars?: unknown }).vars === 'object'
    ? (given as { vars: Record<string, number> }).vars : {};
  if (spec === null || drawing === null) return null;
  const solved = spec.solution === null ? null : solutionValues(spec);
  const values = { ...(showSolution && solved !== null ? solved : mine), ...spec.fixed };
  return (
    <div className="cg-live-replay">
      <Live drawing={drawing} identity={`${card.key}|replay|${JSON.stringify(values)}`} fixed={values} start locked />
      {spec.solution !== null && (
        <button type="button" className="wk-link-btn" onClick={() => setShowSolution((was) => !was)}>
          {showSolution ? 'Pokaż moją próbę' : 'Pokaż rozwiązanie'}
        </button>
      )}
    </div>
  );
}
