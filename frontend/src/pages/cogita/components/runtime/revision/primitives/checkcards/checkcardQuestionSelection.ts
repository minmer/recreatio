import {
  buildEvaluationEvents,
  createRuntimeCheckcardCorrectness,
  normalizeInts,
  type RuntimeCheckcardAnswerModel,
  type RuntimeCheckcardEvaluation,
  type RuntimeCheckcardExpectedModel
} from '../RevisionCheckcardShell';

export function evaluateCheckcardQuestionSelection(
  expected: RuntimeCheckcardExpectedModel,
  answer: RuntimeCheckcardAnswerModel
): RuntimeCheckcardEvaluation {
  const expectedValues = Array.isArray(expected) ? normalizeInts(expected, { sort: true, unique: true }) : [];
  const actualValues = normalizeInts(answer.selection ?? [], { sort: true, unique: true });
  const expectedSet = new Set(expectedValues);
  const matchedCount = actualValues.filter((value) => expectedSet.has(value)).length;
  const sameLength = expectedValues.length === actualValues.length;
  const isCorrect = sameLength && matchedCount === expectedValues.length;
  const comparisonBase = Math.max(expectedValues.length, actualValues.length, 1);
  const correctnessPct = isCorrect ? 100 : (matchedCount / comparisonBase) * 100;
  const correctness = createRuntimeCheckcardCorrectness({
    correctnessPct,
    isCorrect,
    hasAnswer: actualValues.length > 0,
    checked: true
  });
  const payload = {
    type: 'selection' as const,
    expectedValues,
    actualValues,
    matchedCount,
    totalExpected: expectedValues.length
  };

  return {
    isCorrect,
    correctnessPct,
    correctness,
    mask: null,
    payload,
    events: buildEvaluationEvents(isCorrect, correctnessPct, payload, correctness, {
      matchedCount,
      totalExpected: expectedValues.length
    })
  };
}
