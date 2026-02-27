import { evaluateAnchorTextAnswer } from '../../../../cogita/revision/compare';

export type CheckcardPromptKind = 'text' | 'selection' | 'boolean' | 'ordering' | 'matching' | 'citation-fragment';

export type CheckcardPromptModel = {
  kind: CheckcardPromptKind;
  inputType?: 'text' | 'number' | 'date';
  options?: string[];
  columns?: string[][];
};

export type CheckcardExpectedModel =
  | string
  | number
  | boolean
  | number[]
  | { paths: number[][] }
  | null
  | undefined;

export type CheckcardAnswerModel = {
  text?: string;
  selection?: number[];
  booleanAnswer?: boolean | null;
  ordering?: string[];
  matchingPaths?: number[][];
};

function normalizeInts(values: unknown[]): number[] {
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0)
    .sort((a, b) => a - b);
}

function normalizePathKey(path: number[]) {
  return path.join('|');
}

export function evaluateCheckcardAnswer(payload: {
  prompt: CheckcardPromptModel;
  expected: CheckcardExpectedModel;
  answer: CheckcardAnswerModel;
}): { correct: boolean; mask: Uint8Array | null } {
  const { prompt, expected, answer } = payload;

  if (prompt.kind === 'selection') {
    const expectedValues = Array.isArray(expected) ? normalizeInts(expected) : [];
    const actualValues = normalizeInts(answer.selection ?? []);
    const correct =
      expectedValues.length === actualValues.length &&
      expectedValues.every((value, index) => value === actualValues[index]);
    return { correct, mask: null };
  }

  if (prompt.kind === 'boolean') {
    const correct = typeof expected === 'boolean' && answer.booleanAnswer != null && expected === answer.booleanAnswer;
    return { correct, mask: null };
  }

  if (prompt.kind === 'ordering') {
    const expectedText = Array.isArray(expected)
      ? expected.map(String).join('\n')
      : Array.isArray(prompt.options)
        ? prompt.options.map(String).join('\n')
        : '';
    const actualText = Array.isArray(answer.ordering) ? answer.ordering.map(String).join('\n') : '';
    const evaluation = evaluateAnchorTextAnswer(expectedText, actualText, {
      thresholdPercent: 100,
      treatSimilarCharsAsSame: true,
      ignorePunctuationAndSpacing: false
    });
    return { correct: evaluation.isCorrect, mask: evaluation.mask };
  }

  if (prompt.kind === 'matching') {
    const expectedPaths =
      expected && typeof expected === 'object' && 'paths' in expected && Array.isArray(expected.paths)
        ? expected.paths
            .map((row) => (Array.isArray(row) ? normalizeInts(row) : []))
            .filter((row) => row.length > 0)
            .map(normalizePathKey)
        : [];
    const actualPaths = (answer.matchingPaths ?? [])
      .map((row) => (Array.isArray(row) ? normalizeInts(row) : []))
      .filter((row) => row.length > 0)
      .map(normalizePathKey);
    const expectedSet = Array.from(new Set(expectedPaths)).sort();
    const actualSet = Array.from(new Set(actualPaths)).sort();
    const correct =
      expectedSet.length === actualSet.length &&
      expectedSet.every((value, index) => value === actualSet[index]);
    return { correct, mask: null };
  }

  if (prompt.kind === 'text' && prompt.inputType === 'number') {
    const expectedNumber = Number(expected);
    const actualNumber = Number(answer.text ?? '');
    const correct =
      Number.isFinite(expectedNumber) &&
      Number.isFinite(actualNumber) &&
      Math.abs(expectedNumber - actualNumber) < 1e-9;
    return { correct, mask: null };
  }

  const expectedText = typeof expected === 'string' || typeof expected === 'number' ? String(expected) : '';
  const actualText = String(answer.text ?? '');
  const citationMode = prompt.kind === 'citation-fragment';
  const evaluation = evaluateAnchorTextAnswer(expectedText, actualText, {
    thresholdPercent: citationMode ? 90 : 100,
    treatSimilarCharsAsSame: true,
    ignorePunctuationAndSpacing: citationMode
  });
  return { correct: evaluation.isCorrect, mask: evaluation.mask };
}
