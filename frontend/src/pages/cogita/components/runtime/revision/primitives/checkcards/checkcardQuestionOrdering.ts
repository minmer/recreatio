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

export function evaluateCheckcardQuestionOrdering(
  prompt: RuntimeCheckcardPromptModel,
  expected: RuntimeCheckcardExpectedModel,
  answer: RuntimeCheckcardAnswerModel
): RuntimeCheckcardEvaluation {
  const expectedValues = Array.isArray(expected)
    ? expected.map(String)
    : Array.isArray(prompt.options)
      ? prompt.options.map(String)
      : [];
  const actualValues = Array.isArray(answer.ordering) ? answer.ordering.map(String) : [];
  const expectedText = expectedValues.join('\n');
  const actualText = actualValues.join('\n');
  const evaluation = evaluateAnchorTextAnswer(expectedText, actualText, {
    thresholdPercent: 100,
    treatSimilarCharsAsSame: true,
    ignorePunctuationAndSpacing: false
  });
  const isCorrect = evaluation.isCorrect;
  const correctnessPct = clampPercent(evaluation.percent);
  const correctness = createRuntimeCheckcardCorrectness({
    correctnessPct,
    isCorrect,
    hasAnswer: actualValues.length > 0,
    checked: true
  });
  const sharedLength = Math.min(expectedValues.length, actualValues.length);
  let mismatchCount = Math.abs(expectedValues.length - actualValues.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (expectedValues[index] !== actualValues[index]) {
      mismatchCount += 1;
    }
  }
  const payload = {
    type: 'ordering' as const,
    expectedValues,
    actualValues,
    similarityPct: correctnessPct,
    mismatchCount
  };

  return {
    isCorrect,
    correctnessPct,
    correctness,
    mask: evaluation.mask,
    payload,
    events: buildEvaluationEvents(isCorrect, correctnessPct, payload, correctness)
  };
}
