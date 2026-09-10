import {
  buildEvaluationEvents,
  createRuntimeCheckcardCorrectness,
  type RuntimeCheckcardAnswerModel,
  type RuntimeCheckcardEvaluation,
  type RuntimeCheckcardExpectedModel
} from '../RevisionCheckcardShell';

export function evaluateCheckcardQuestionBoolean(
  expected: RuntimeCheckcardExpectedModel,
  answer: RuntimeCheckcardAnswerModel
): RuntimeCheckcardEvaluation {
  const expectedValue = typeof expected === 'boolean' ? expected : null;
  const actualValue = answer.booleanAnswer ?? null;
  const isCorrect = expectedValue !== null && actualValue !== null && expectedValue === actualValue;
  const correctnessPct = isCorrect ? 100 : 0;
  const correctness = createRuntimeCheckcardCorrectness({
    correctnessPct,
    isCorrect,
    hasAnswer: actualValue !== null,
    checked: true
  });
  const payload = {
    type: 'boolean' as const,
    expectedValue,
    actualValue
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
