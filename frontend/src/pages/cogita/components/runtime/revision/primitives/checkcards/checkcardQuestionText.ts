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

function toExpectedTextCandidates(expected: RuntimeCheckcardExpectedModel): string[] {
  const values = Array.isArray(expected) ? expected : [expected];
  const normalized = values
    .map((entry) => (typeof entry === 'string' || typeof entry === 'number' ? String(entry).trim() : ''))
    .filter((entry) => entry.length > 0);
  return Array.from(new Set(normalized.map((entry) => entry.toLowerCase())))
    .map((key) => normalized.find((entry) => entry.toLowerCase() === key)!)
    .filter(Boolean);
}

function toExpectedNumberCandidates(expected: RuntimeCheckcardExpectedModel): number[] {
  const values = Array.isArray(expected) ? expected : [expected];
  const numeric = values
    .map((entry) => {
      if (typeof entry === 'number') return entry;
      if (typeof entry === 'string') return Number(entry.trim());
      return Number.NaN;
    })
    .filter((entry) => Number.isFinite(entry));
  return Array.from(new Set(numeric));
}

function normalizeDateToken(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}$/.test(trimmed)) return `y:${trimmed}`;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `m:${trimmed}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `d:${trimmed}`;
  const parsed = Date.parse(trimmed);
  if (Number.isFinite(parsed)) {
    return `d:${new Date(parsed).toISOString().slice(0, 10)}`;
  }
  return `s:${trimmed.toLowerCase()}`;
}

export function evaluateCheckcardQuestionText(
  prompt: RuntimeCheckcardPromptModel,
  expected: RuntimeCheckcardExpectedModel,
  answer: RuntimeCheckcardAnswerModel
): RuntimeCheckcardEvaluation {
  if (prompt.inputType === 'number') {
    const expectedValues = toExpectedNumberCandidates(expected);
    const actualValue = Number(answer.text ?? '');
    const deltas = expectedValues.map((value) => Math.abs(value - actualValue));
    const delta = deltas.length > 0 ? Math.min(...deltas) : Number.NaN;
    const isCorrect =
      expectedValues.length > 0 &&
      Number.isFinite(actualValue) &&
      delta < 1e-9;
    const payload = {
      type: 'number' as const,
      expectedValue: expectedValues[0] ?? Number.NaN,
      expectedValues,
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

  const actualText = String(answer.text ?? '');
  const expectedTexts = toExpectedTextCandidates(expected);

  if (prompt.inputType === 'date') {
    const actualToken = normalizeDateToken(actualText);
    const expectedTokens = expectedTexts.map(normalizeDateToken).filter((entry): entry is string => entry !== null);
    const isCorrect = !!actualToken && expectedTokens.includes(actualToken);
    const correctnessPct = isCorrect ? 100 : 0;
    const correctness = createRuntimeCheckcardCorrectness({
      correctnessPct,
      isCorrect,
      hasAnswer: actualText.trim().length > 0,
      checked: true
    });
    const payload = {
      type: 'text' as const,
      expectedText: expectedTexts[0] ?? '',
      expectedTexts,
      actualText,
      similarityPct: correctnessPct,
      thresholdPct: 100
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

  const citationMode = prompt.kind === 'citation-fragment';
  const thresholdPct = citationMode ? 90 : 100;
  const evaluations = (expectedTexts.length > 0 ? expectedTexts : ['']).map((expectedText) =>
    evaluateAnchorTextAnswer(expectedText, actualText, {
      thresholdPercent: thresholdPct,
      treatSimilarCharsAsSame: true,
      ignorePunctuationAndSpacing: citationMode
    })
  );
  const bestIndex = evaluations.reduce((best, current, index, list) => {
    if (index === 0) return 0;
    return current.percent > list[best].percent ? index : best;
  }, 0);
  const best = evaluations[bestIndex];
  const correctnessPct = clampPercent(best.percent);
  const correctness = createRuntimeCheckcardCorrectness({
    correctnessPct,
    isCorrect: best.isCorrect,
    hasAnswer: actualText.trim().length > 0,
    checked: true
  });
  const payload = {
    type: 'text' as const,
    expectedText: expectedTexts[bestIndex] ?? '',
    expectedTexts: expectedTexts.length > 1 ? expectedTexts : undefined,
    actualText,
    similarityPct: correctnessPct,
    thresholdPct
  };

  return {
    isCorrect: best.isCorrect,
    correctnessPct,
    correctness,
    mask: best.mask,
    payload,
    events: buildEvaluationEvents(best.isCorrect, correctnessPct, payload, correctness)
  };
}
