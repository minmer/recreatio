export type CompareAlgorithmId = 'bidirectional' | 'prefix' | 'anchors';
export type SimilarCharMap = Record<string, string[]>;
export type AnchorTextCompareOptions = {
  thresholdPercent?: number;
  treatSimilarCharsAsSame?: boolean;
  ignorePunctuationAndSpacing?: boolean;
};

const similarChars: SimilarCharMap = {
  a: ['ą', 'à', 'á', 'â', 'ä', 'ã', 'å'],
  c: ['ć', 'č'],
  e: ['ę', 'è', 'é', 'ê', 'ë'],
  i: ['ì', 'í', 'î', 'ï'],
  l: ['ł'],
  n: ['ń'],
  o: ['ò', 'ó', 'ô', 'ö', 'õ'],
  s: ['ś', 'š'],
  u: ['ù', 'ú', 'û', 'ü'],
  y: ['ý', 'ÿ'],
  z: ['ź', 'ż', 'ž']
};

const lengthFactor = (expected: string, answer: string) => {
  const maxLen = Math.max(expected.length, answer.length, 1);
  const diff = Math.abs(expected.length - answer.length);
  return Math.max(0, 1 - diff / maxLen);
};

export const compareBidirectional = (expected: string, answer: string) => {
  const buffer = new Uint8Array(expected.length);
  const factor = lengthFactor(expected, answer);
  for (let i = 0; i < expected.length; i += 1) {
    const startMatch = expected[i] === (answer[i] ?? '') ? 128 : 0;
    const endIndex = expected.length - 1 - i;
    const answerIndex = answer.length - 1 - i;
    const endMatch = expected[endIndex] === (answer[answerIndex] ?? '') ? 127 : 0;
    const score = Math.round((startMatch + endMatch) * factor);
    buffer[i] = Math.max(0, Math.min(255, score));
  }
  return buffer;
};

export const comparePrefix = (expected: string, answer: string) => {
  const buffer = new Uint8Array(expected.length);
  const factor = lengthFactor(expected, answer);
  for (let i = 0; i < expected.length; i += 1) {
    const match = expected[i] === (answer[i] ?? '') ? 255 : 0;
    const score = Math.round(match * factor);
    buffer[i] = Math.max(0, Math.min(255, score));
  }
  return buffer;
};

const isSimilarChar = (a: string, b: string) => {
  if (a === b) return true;
  const group = similarChars[a] ?? [];
  if (group.includes(b)) return true;
  const reverse = similarChars[b] ?? [];
  return reverse.includes(a);
};

const charsEquivalent = (a: string, b: string, allowSimilar: boolean) =>
  allowSimilar ? isSimilarChar(a, b) : a === b;

const anchorCompare = (expected: string, answer: string, options?: { allowSimilarChars?: boolean }) => {
  const buffer = new Uint8Array(expected.length);
  if (!expected.length) return buffer;
  const allowSimilarChars = options?.allowSimilarChars ?? true;
  const anchors: Array<{ index: number; text: string }> = [];
  for (let i = 0; i <= expected.length - 3; i += 1) {
    anchors.push({ index: i, text: expected.slice(i, i + 3) });
  }
  let scored = false;
  anchors.forEach((anchor) => {
    for (let j = 0; j <= answer.length - 3; j += 1) {
      const chunk = answer.slice(j, j + 3);
      let matches = 0;
      for (let k = 0; k < 3; k += 1) {
        if (charsEquivalent(anchor.text[k], chunk[k], allowSimilarChars)) matches += 1;
      }
      if (matches < 2) continue;
      // expand from anchor
      let leftExp = anchor.index - 1;
      let leftAns = j - 1;
      while (leftExp >= 0 && leftAns >= 0) {
        const expChar = expected[leftExp];
        const ansChar = answer[leftAns];
        if (expChar === ansChar) {
          buffer[leftExp] = Math.max(buffer[leftExp], 255);
          leftExp -= 1;
          leftAns -= 1;
          scored = true;
          continue;
        }
        if (charsEquivalent(expChar, ansChar, allowSimilarChars) && expChar !== ansChar) {
          buffer[leftExp] = Math.max(buffer[leftExp], 127);
          leftExp -= 1;
          leftAns -= 1;
          scored = true;
          continue;
        }
        if (leftExp > 0 && expected[leftExp - 1] === ansChar) {
          buffer[leftExp] = Math.max(buffer[leftExp], 0);
          leftExp -= 1;
          scored = true;
          continue;
        }
        if (leftAns > 0 && expected[leftExp] === answer[leftAns - 1]) {
          leftAns -= 1;
          scored = true;
          continue;
        }
        break;
      }

      for (let k = 0; k < 3; k += 1) {
        const idx = anchor.index + k;
        const expChar = anchor.text[k];
        const ansChar = chunk[k];
        const score = expChar === ansChar ? 255 : charsEquivalent(expChar, ansChar, allowSimilarChars) ? 127 : 0;
        buffer[idx] = Math.max(buffer[idx], score);
        scored = true;
      }

      let rightExp = anchor.index + 3;
      let rightAns = j + 3;
      while (rightExp < expected.length && rightAns < answer.length) {
        const expChar = expected[rightExp];
        const ansChar = answer[rightAns];
        if (expChar === ansChar) {
          buffer[rightExp] = Math.max(buffer[rightExp], 255);
          rightExp += 1;
          rightAns += 1;
          scored = true;
          continue;
        }
        if (charsEquivalent(expChar, ansChar, allowSimilarChars) && expChar !== ansChar) {
          buffer[rightExp] = Math.max(buffer[rightExp], 127);
          rightExp += 1;
          rightAns += 1;
          scored = true;
          continue;
        }
        if (rightExp + 1 < expected.length && expected[rightExp + 1] === ansChar) {
          buffer[rightExp] = Math.max(buffer[rightExp], 0);
          rightExp += 1;
          scored = true;
          continue;
        }
        if (rightAns + 1 < answer.length && expected[rightExp] === answer[rightAns + 1]) {
          rightAns += 1;
          scored = true;
          continue;
        }
        break;
      }
    }
  });

  if (!scored) {
    return compareBidirectional(expected, answer);
  }
  return buffer;
};

const isComparableChar = (char: string) => /[\p{L}\p{N}]/u.test(char);

const normalizeComparable = (value: string) => value.trim().toLowerCase();

export const maskAveragePercent = (mask: Uint8Array, options?: { treatSimilarCharsAsSame?: boolean }) => {
  if (mask.length === 0) return 100;
  const treatSimilarCharsAsSame = options?.treatSimilarCharsAsSame ?? false;
  const total = Array.from(mask).reduce((sum, value) => {
    if (treatSimilarCharsAsSame && value === 127) return sum + 255;
    return sum + value;
  }, 0);
  return Math.round((total / (mask.length * 255)) * 100);
};

export const evaluateAnchorTextAnswer = (
  expected: string,
  answer: string,
  options?: AnchorTextCompareOptions
) => {
  const thresholdPercent = Math.max(0, Math.min(100, options?.thresholdPercent ?? 100));
  const treatSimilarCharsAsSame = options?.treatSimilarCharsAsSame ?? true;
  const ignorePunctuationAndSpacing = options?.ignorePunctuationAndSpacing ?? false;

  const originalExpected = normalizeComparable(expected);
  const originalAnswer = normalizeComparable(answer);

  if (!ignorePunctuationAndSpacing) {
    const mask = anchorCompare(originalExpected, originalAnswer, { allowSimilarChars: treatSimilarCharsAsSame });
    const percent = maskAveragePercent(mask, { treatSimilarCharsAsSame });
    return {
      mask,
      percent,
      isCorrect: percent >= thresholdPercent,
      normalizedExpected: originalExpected,
      normalizedAnswer: originalAnswer
    };
  }

  const expectedChars = Array.from(originalExpected);
  const answerChars = Array.from(originalAnswer);
  const expectedFiltered: string[] = [];
  const expectedIndexMap: number[] = [];
  const answerFiltered: string[] = [];

  expectedChars.forEach((char, index) => {
    if (isComparableChar(char)) {
      expectedFiltered.push(char);
      expectedIndexMap.push(index);
    }
  });
  answerChars.forEach((char) => {
    if (isComparableChar(char)) {
      answerFiltered.push(char);
    }
  });

  const filteredExpected = expectedFiltered.join('');
  const filteredAnswer = answerFiltered.join('');
  const filteredMask = anchorCompare(filteredExpected, filteredAnswer, { allowSimilarChars: treatSimilarCharsAsSame });
  const mask = new Uint8Array(expectedChars.length);
  for (let i = 0; i < mask.length; i += 1) {
    mask[i] = isComparableChar(expectedChars[i] ?? '') ? 0 : 255;
  }
  for (let i = 0; i < filteredMask.length; i += 1) {
    const originalIndex = expectedIndexMap[i];
    if (originalIndex !== undefined) {
      mask[originalIndex] = filteredMask[i];
    }
  }
  const percent = maskAveragePercent(filteredMask, { treatSimilarCharsAsSame });

  return {
    mask,
    percent,
    isCorrect: percent >= thresholdPercent,
    normalizedExpected: filteredExpected,
    normalizedAnswer: filteredAnswer
  };
};

export const compareStrings = (expected: string, answer: string, algorithmId: CompareAlgorithmId) => {
  const normalizedExpected = expected.trim().toLowerCase();
  const normalizedAnswer = answer.trim().toLowerCase();
  if (algorithmId === 'prefix' || algorithmId === 'bidirectional') {
    // Text checks are intentionally unified to anchors.
    return anchorCompare(normalizedExpected, normalizedAnswer, { allowSimilarChars: true });
  }
  return anchorCompare(normalizedExpected, normalizedAnswer, { allowSimilarChars: true });
};

export const normalizeIgnoringSpacingAndPunctuation = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');

export const compareStringsIgnoringSpacingAndPunctuation = (
  expected: string,
  answer: string,
  algorithmId: CompareAlgorithmId
) => {
  const normalizedExpected = normalizeIgnoringSpacingAndPunctuation(expected);
  const normalizedAnswer = normalizeIgnoringSpacingAndPunctuation(answer);
  if (algorithmId === 'prefix' || algorithmId === 'bidirectional') {
    return anchorCompare(normalizedExpected, normalizedAnswer, { allowSimilarChars: true });
  }
  return anchorCompare(normalizedExpected, normalizedAnswer, { allowSimilarChars: true });
};
