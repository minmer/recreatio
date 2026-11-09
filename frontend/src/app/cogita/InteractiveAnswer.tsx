/**
 * COGITA — DIE ANTWORT MIT DEN HÄNDEN (`interactive.ts` sagt, wie geprüft
 * wird): das Bild zum Anfassen der Frage, darunter „Sprawdź". Abgegeben werden
 * die Werte, die gerade eingestellt sind — und, 2026-10-18, der Bau einer
 * Welt, wie er gerade steht. Nach der Antwort läuft dasselbe Bild mit diesen
 * Werten noch einmal ab (der Bau so, wie die Prüfung ihn nachgespielt hat) —
 * man sieht, was geschah —, und wer daneben lag, kann die Lösung ablaufen
 * lassen.
 *
 * Ein Bild zum Vermuten (`predict`) steht beim Antworten still — nichts verrät
 * das Ergebnis, bis die Karte geprüft ist; danach wird es losgelassen.
 *
 * Das Bild selbst (`LiveDrawing`) kommt erst, wenn eine solche Karte gezeigt
 * wird.
 */

import { useCallback, useMemo, useRef, useState } from 'react';

import type { Card } from './cardBasics';
import { answerWorld, drawingOfText, liveWithGoals, liveWithoutGoals, solutionValues, solutionWorld, type InteractiveSpec } from './interactive';
import type { Program } from '../pages/motion/liveRun';
import { later } from '../ui/later';
import { useT } from '../core/i18n';

const Live = later(() => import('../pages/motion/LiveDrawing').then((m) => m.LiveDrawing));

const specOf = (card: Card): InteractiveSpec | null => (card.answer.form === 'interactive' ? card.answer : null);

/** Das Bild der Karte, mit dem Ziel der Frage als Regel — so meldet es das Treffen schon beim Ausprobieren. */
function useDrawing(spec: InteractiveSpec | null, answering = false) {
  return useMemo(() => {
    if (spec === null) return null;
    const d = drawingOfText(spec.drawing);
    if (d === null) return null;
    /* 2026-11-05 (Prompt 23, D2) — "check": "submit": beim Ausprobieren verrät nichts das Ziel (gewertet wird bei „Sprawdź“). */
    if (answering && spec.check === 'submit') return { ...d, live: liveWithoutGoals(d.live) };
    return { ...d, live: liveWithGoals(d.live, spec) };
  }, [spec, answering]);
}

export function InteractiveAnswer({ card, disabled, onSubmit }: { card: Card; disabled?: boolean; onSubmit: (given: unknown) => void }) {
  const t = useT();
  const spec = specOf(card);
  const drawing = useDrawing(spec, true);
  const program = useRef<Program | null>(null);
  const onProgram = useCallback((p: Program) => { program.current = p; }, []);
  if (spec === null || drawing === null) return <p className="wk-error">{t('cogitaLearnRun.interactive.broken')}</p>;
  const submit = () => {
    const world = program.current?.worldSnapshot() ?? null;
    onSubmit({ vars: program.current?.snapshot() ?? {}, ...(world === null ? {} : { world }) });
  };
  return (
    <div className="cg-answer cg-live">
      {/* Ein Bild zum Vermuten steht still, bis die Karte geprüft wird — „Sprawdź" ist hier der Knopf der Karte. */}
      <Live drawing={drawing} identity={`${card.key}|${card.fingerprint}|${JSON.stringify(spec.fixed)}`} fixed={spec.fixed} onProgram={onProgram} locked={disabled === true} checkOutside />
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={disabled} onClick={submit}>{t('cogitaLearnRun.card.check')}</button>
      </div>
    </div>
  );
}

/** Nach der Antwort: was mit den eigenen Werten geschah — und auf Wunsch die Lösung. */
export function InteractiveReplay({ card, given }: { card: Card; given: unknown }) {
  const t = useT();
  const spec = specOf(card);
  const drawing = useDrawing(spec);
  const [showSolution, setShowSolution] = useState(false);
  const mine = typeof given === 'object' && given !== null && typeof (given as { vars?: unknown }).vars === 'object'
    ? (given as { vars: Record<string, number> }).vars : {};
  if (spec === null || drawing === null) return null;
  const solvedVars = spec.solution === null ? null : solutionValues(spec);
  const solvedWorld = spec.solution === null ? null : solutionWorld(spec);
  const values = { ...(showSolution && solvedVars !== null ? solvedVars : mine), ...spec.fixed };
  const world = showSolution && solvedWorld !== null ? solvedWorld : answerWorld(given);
  return (
    <div className="cg-live-replay">
      <Live drawing={drawing} identity={`${card.key}|replay|${JSON.stringify(values)}`} fixed={values} replay={world} start locked />
      {spec.solution !== null && (
        <button type="button" className="wk-link-btn" onClick={() => setShowSolution((was) => !was)}>
          {showSolution ? t('cogitaLearnRun.interactive.showMine') : t('cogitaLearnRun.build.showSolution')}
        </button>
      )}
    </div>
  );
}
