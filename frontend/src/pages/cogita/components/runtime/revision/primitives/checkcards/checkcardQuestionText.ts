import { evaluateAnchorTextAnswer } from '../../../../../features/revision/compare';
import {
  buildEvaluationEvents,
  clampPercent,
  createRuntimeCheckcardCorrectness,
  type RuntimeCheckcardAnswerModel,
  type RuntimeCheckcardEvaluation,
  type RuntimeCheckcardExpectedModel,
  type RuntimeCheckcardPromptModel
} from '../RevisionCheckcardShell';

export function evaluateCheckcardQuestionText(
  prompt: RuntimeCheckcardPromptModel,
  expected: RuntimeCheckcardExpectedModel,
  answer: RuntimeCheckcardAnswerModel
): RuntimeCheckcardEvaluation {
  if (prompt.inputType === 'number') {
    const expectedValue = Number(expected);
    const actualValue = Number(answer.text ?? '');
    const delta = Math.abs(expectedValue - actualValue);
    const isCorrect =
      Number.isFinite(expectedValue) &&
      Number.isFinite(actualValue) &&
      delta < 1e-9;
    const payload = {
      type: 'number' as const,
      expectedValue,
      actualValue,
      delta
    };
    const correctnessPct = isCorrect ? 100 : 0;
    const correctness = createRuntimeCheckcardCorrectness({
      correctnessPct,
      isCorrect,
      hasAnswer: String(answer.text ?? '').trim().length > 0,
      checked: true
    });

    return {
      isCorrect,
      correctnessPct,
      correctness,
      mask: null,
      payload,
      events: buildEvaluationEvents(isCorrect, correctnessPct, payload, correctness)
    };
  }

  const expectedText = typeof expected === 'string' || typeof expected === 'number' ? String(expected) : '';
  const actualText = String(answer.text ?? '');
  const citationMode = prompt.kind === 'citation-fragment';
  const evaluation = evaluateAnchorTextAnswer(expectedText, actualText, {
    thresholdPercent: citationMode ? 90 : 100,
    treatSimilarCharsAsSame: true,
    ignorePunctuationAndSpacing: citationMode
  });
  const thresholdPct = citationMode ? 90 : 100;
  const correctnessPct = clampPercent(evaluation.similarityPct);
  const correctness = createRuntimeCheckcardCorrectness({
    correctnessPct,
    isCorrect: evaluation.isCorrect,
    hasAnswer: actualText.trim().length > 0,
    checked: true
  });
  const payload = {
    type: 'text' as const,
    expectedText,
    actualText,
    similarityPct: correctnessPct,
    thresholdPct
  };

  return {
    isCorrect: evaluation.isCorrect,
    correctnessPct,
    correctness,
    mask: evaluation.mask,
    payload,
    events: buildEvaluationEvents(evaluation.isCorrect, correctnessPct, payload, correctness)
  };
}
