import {
  buildEvaluationEvents,
  createRuntimeCheckcardCorrectness,
  normalizePath,
  normalizePathKey,
  type RuntimeCheckcardAnswerModel,
  type RuntimeCheckcardEvaluation,
  type RuntimeCheckcardExpectedModel
} from '../RevisionCheckcardShell';

export function evaluateCheckcardQuestionMatching(
  expected: RuntimeCheckcardExpectedModel,
  answer: RuntimeCheckcardAnswerModel
): RuntimeCheckcardEvaluation {
  const expectedPaths =
    expected && typeof expected === 'object' && 'paths' in expected && Array.isArray(expected.paths)
      ? expected.paths
          .map((row) => (Array.isArray(row) ? normalizePath(row) : null))
          .filter((row): row is number[] => Array.isArray(row) && row.length > 0)
          .map(normalizePathKey)
      : [];
  const actualPaths = (answer.matchingPaths ?? [])
    .map((row) => (Array.isArray(row) ? normalizePath(row) : null))
    .filter((row): row is number[] => Array.isArray(row) && row.length > 0)
    .map(normalizePathKey);

  const expectedSet = Array.from(new Set(expectedPaths)).sort();
  const actualSet = Array.from(new Set(actualPaths)).sort();
  const matchedCount = expectedSet.filter((value) => actualSet.includes(value)).length;
  const isCorrect =
    expectedSet.length === actualSet.length &&
    expectedSet.every((value, index) => value === actualSet[index]);
  const comparisonBase = Math.max(expectedSet.length, actualSet.length, 1);
  const correctnessPct = isCorrect ? 100 : (matchedCount / comparisonBase) * 100;
  const correctness = createRuntimeCheckcardCorrectness({
    correctnessPct,
    isCorrect,
    hasAnswer: actualSet.length > 0,
    checked: true
  });
  const payload = {
    type: 'matching' as const,
    expectedPaths: expectedSet,
    actualPaths: actualSet,
    matchedCount,
    totalExpected: expectedSet.length
  };

  return {
    isCorrect,
    correctnessPct,
    correctness,
    mask: null,
    payload,
    events: buildEvaluationEvents(isCorrect, correctnessPct, payload, correctness, {
      matchedCount,
      totalExpected: expectedSet.length
    })
  };
}
