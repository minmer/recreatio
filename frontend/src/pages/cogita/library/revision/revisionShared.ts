import type { CogitaCardSearchResult, CogitaItemDependency } from '../../../../lib/api';
import { buildQuoteFragmentTree } from '../../../../cogita/revision/quote';
import {
  normalizeQuestionType,
  parseQuestionDefinition,
  shuffleQuestionDefinitionForRuntime
} from '../questions/questionRuntime';
import type { CheckcardExpectedModel, CheckcardPromptModel } from '../checkcards/checkcardRuntime';
export { normalizeQuestionType } from '../questions/questionRuntime';

export type RevisionQuestionPrompt = {
  kind: 'text' | 'selection' | 'boolean' | 'ordering' | 'matching';
  prompt: string;
  options?: string[];
  multiple?: boolean;
  inputType?: 'text' | 'number' | 'date';
  columns?: string[][];
};

export type RevisionQuestionAnswers = {
  text: string;
  selection: number[];
  booleanAnswer: boolean | null;
  ordering: string[];
  matchingRows: number[][];
  matchingSelection: Array<number | null>;
};

export type RevisionQuestionRuntime = {
  promptText: string;
  promptModel: CheckcardPromptModel;
  expectedModel: CheckcardExpectedModel;
  promptPayload: RevisionQuestionPrompt;
  initialAnswers: RevisionQuestionAnswers;
};

export const emptyQuestionAnswers = (): RevisionQuestionAnswers => ({
  text: '',
  selection: [],
  booleanAnswer: null,
  ordering: [],
  matchingRows: [],
  matchingSelection: []
});

function shuffleStrings(values: string[]) {
  const next = [...values];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function buildRevisionQuestionRuntime(value: unknown, fallbackPrompt: string): RevisionQuestionRuntime | null {
  const parsed = parseQuestionDefinition(value);
  if (!parsed) return null;
  const def = shuffleQuestionDefinitionForRuntime(parsed);
  const promptText = (def.question || def.title || fallbackPrompt || '').trim();

  if (def.type === 'selection') {
    const options = def.options ?? [];
    const expected = Array.isArray(def.answer) ? def.answer : [];
    return {
      promptText,
      promptModel: { kind: 'selection', options },
      expectedModel: expected,
      promptPayload: { kind: 'selection', prompt: promptText, options, multiple: expected.length !== 1 },
      initialAnswers: emptyQuestionAnswers()
    };
  }

  if (def.type === 'truefalse') {
    const expected = typeof def.answer === 'boolean' ? def.answer : false;
    return {
      promptText,
      promptModel: { kind: 'boolean' },
      expectedModel: expected,
      promptPayload: { kind: 'boolean', prompt: promptText },
      initialAnswers: emptyQuestionAnswers()
    };
  }

  if (def.type === 'ordering') {
    const options = def.options ?? [];
    return {
      promptText,
      promptModel: { kind: 'ordering', options },
      expectedModel: options,
      promptPayload: { kind: 'ordering', prompt: promptText, options },
      initialAnswers: {
        ...emptyQuestionAnswers(),
        ordering: shuffleStrings(options)
      }
    };
  }

  if (def.type === 'matching') {
    const columns = def.columns ?? [];
    const expected =
      def.answer && typeof def.answer === 'object' && 'paths' in def.answer
        ? { paths: Array.isArray(def.answer.paths) ? def.answer.paths : [] }
        : { paths: [] };
    return {
      promptText,
      promptModel: { kind: 'matching', columns },
      expectedModel: expected,
      promptPayload: { kind: 'matching', prompt: promptText, columns },
      initialAnswers: {
        ...emptyQuestionAnswers(),
        matchingSelection: new Array(Math.max(2, columns.length)).fill(null)
      }
    };
  }

  const expected = typeof def.answer === 'string' || typeof def.answer === 'number' ? def.answer : '';
  const inputType = def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text';
  return {
    promptText,
    promptModel: { kind: 'text', inputType },
    expectedModel: expected,
    promptPayload: { kind: 'text', prompt: promptText, inputType },
    initialAnswers: emptyQuestionAnswers()
  };
}

export const normalizeAnswer = (value: string) => value.trim().toLowerCase();

export const parseQuoteFragmentDirection = (direction?: string | null) => {
  const fragmentId = direction?.trim();
  if (!fragmentId) return null;
  return { fragmentId };
};

export const matchesQuoteDirection = (entryDirection: string | null | undefined, currentDirection?: string | null) => {
  const current = parseQuoteFragmentDirection(currentDirection);
  if (!current) return true;
  const entryParsed = parseQuoteFragmentDirection(entryDirection);
  return entryParsed?.fragmentId === current.fragmentId;
};

export const normalizeDependencyToken = (value?: string | null) => {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
};

export const matchesDependencyChild = (dep: CogitaItemDependency, card: CogitaCardSearchResult) => {
  const childType = normalizeDependencyToken(dep.childItemType) ?? 'info';
  if (childType !== (card.cardType ?? '').toLowerCase()) return false;
  if (dep.childItemId !== card.cardId) return false;
  const childCheckType = normalizeDependencyToken(dep.childCheckType);
  const childDirection = normalizeDependencyToken(dep.childDirection);
  const cardCheckType = normalizeDependencyToken(card.checkType);
  const cardDirection = normalizeDependencyToken(card.direction);
  if (childCheckType && childCheckType !== cardCheckType) return false;
  if (childDirection && childDirection !== cardDirection) return false;
  return true;
};

export const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
  i: 'ⁱ'
};

export const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  a: 'ₐ',
  e: 'ₑ',
  h: 'ₕ',
  i: 'ᵢ',
  j: 'ⱼ',
  k: 'ₖ',
  l: 'ₗ',
  m: 'ₘ',
  n: 'ₙ',
  o: 'ₒ',
  p: 'ₚ',
  r: 'ᵣ',
  s: 'ₛ',
  t: 'ₜ',
  u: 'ᵤ',
  v: 'ᵥ',
  x: 'ₓ'
};

export const applyScriptMode = (prev: string, next: string, mode: 'super' | 'sub' | null) => {
  if (!mode) return next;
  if (!next.startsWith(prev)) return next;
  const added = next.slice(prev.length);
  if (!added) return next;
  const map = mode === 'super' ? SUPERSCRIPT_MAP : SUBSCRIPT_MAP;
  const transformed = added
    .split('')
    .map((char) => map[char] ?? char)
    .join('');
  return prev + transformed;
};

export const getFirstComputedInputKey = (
  template: string | null,
  expected: Array<{ key: string; expected: string }>,
  outputVariables: Record<string, string> | null
) => {
  if (!template) return expected[0]?.key ?? null;
  const expectedKeys = new Set(expected.map((entry) => entry.key));
  const pattern = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(template)) !== null) {
    const token = match[1]?.trim() ?? '';
    if (!token) continue;
    if (expectedKeys.has(token)) return token;
    const resolved = outputVariables?.[token];
    if (resolved && expectedKeys.has(resolved)) return resolved;
  }
  return expected[0]?.key ?? null;
};

export const expandQuoteDirectionCards = (cards: CogitaCardSearchResult[]) =>
  (() => {
    const seen = new Set<string>();
    return cards.flatMap((card) => {
      if (card.cardType !== 'info' || card.infoType !== 'citation') return [card];
      const text = card.description ?? '';
      if (!text.trim()) return [card];
      const tree = buildQuoteFragmentTree(text);
      const nodeIds = Object.keys(tree.nodes);
      if (nodeIds.length === 0) return [card];
      return nodeIds
        .map((nodeId) => ({
          ...card,
          checkType: 'quote-fragment',
          direction: nodeId
        }))
        .filter((entry) => {
          const key = [entry.cardId, entry.checkType ?? '', entry.direction ?? ''].join('|');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    });
  })();
