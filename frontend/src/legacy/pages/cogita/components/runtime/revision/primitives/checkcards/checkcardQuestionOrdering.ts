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
  const normalizeToken = (value: string) => value.trim().toLowerCase();
  const expectedValues = Array.isArray(expected)
    ? expected.map(String)
    : Array.isArray(prompt.options)
      ? prompt.options.map(String)
      : [];
  const actualValues = Array.isArray(answer.ordering) ? answer.ordering.map(String) : [];
  const normalizedExpected = expectedValues.map(normalizeToken);
  const normalizedActual = actualValues.map(normalizeToken);
  const sharedLength = Math.min(normalizedExpected.length, normalizedActual.length);
  let matchedPositions = 0;
  let mismatchCount = Math.abs(normalizedExpected.length - normalizedActual.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (normalizedExpected[index] === normalizedActual[index]) {
      matchedPositions += 1;
    } else {
      mismatchCount += 1;
    }
  }
  const denominator = Math.max(normalizedExpected.length, normalizedActual.length, 1);
  const correctnessPct = clampPercent((matchedPositions / denominator) * 100);
  const isCorrect = mismatchCount === 0 && normalizedExpected.length > 0;
  const correctness = createRuntimeCheckcardCorrectness({
    correctnessPct,
    isCorrect,
    hasAnswer: actualValues.length > 0,
    checked: true
  });
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
    mask: null,
    payload,
    events: buildEvaluationEvents(isCorrect, correctnessPct, payload, correctness)
  };
}
