import { type ReactNode } from 'react';
import type { CogitaCardSearchResult, CogitaItemDependency } from '../../../../../lib/api';
import { buildQuoteFragmentTree } from '../../../features/revision/quote';
import {
  type CheckcardExpectedModel,
  type CheckcardPromptModel
} from './primitives/RevisionCheckcardShell';

export type RevisionRuntimeView = 'lobby' | 'question' | 'scoreboard' | 'host';

export type RevisionRuntimeViewOption = {
  key: RevisionRuntimeView;
  label: string;
  enabled: boolean;
};

export function RevisionRuntimeShell({
  title,
  subtitle,
  meta,
  participantLabel,
  actions,
  views,
  activeView,
  onViewChange,
  children
}: {
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  participantLabel?: string | null;
  actions?: ReactNode;
  views: RevisionRuntimeViewOption[];
  activeView: RevisionRuntimeView;
  onViewChange: (view: RevisionRuntimeView) => void;
  children: ReactNode;
}) {
  return (
    <>
      <header className="cogita-core-run-header">
        <div>
          {subtitle ? <p className="cogita-core-run-kicker">{subtitle}</p> : null}
          <h1>{title}</h1>
          {meta ? <p>{meta}</p> : null}
          {participantLabel ? <p>{participantLabel}</p> : null}
        </div>
        <div className="cogita-core-run-actions">{actions}</div>
      </header>

      <nav className="cogita-core-run-outcomes" aria-label="Revision runtime views">
        {views
          .filter((view) => view.enabled)
          .map((view) => (
            <button
              key={view.key}
              type="button"
              className="ghost"
              onClick={() => onViewChange(view.key)}
              style={activeView === view.key ? { borderColor: 'rgba(111, 214, 255, 0.85)' } : undefined}
            >
              {view.label}
            </button>
          ))}
      </nav>

      {children}
    </>
  );
}

export type QuestionType = 'selection' | 'truefalse' | 'text' | 'number' | 'date' | 'ordering' | 'matching';

export type ParsedQuestionDefinition = {
  type: QuestionType;
  title?: string;
  question: string;
  options?: string[];
  answer?: number[] | string | number | boolean | { paths: number[][] };
  columns?: string[][];
};

export const normalizeQuestionType = (rawType: unknown): QuestionType | '' => {
  if (typeof rawType !== 'string') return '';
  const value = rawType.trim().toLowerCase();
  if (value === 'selection' || value === 'truefalse' || value === 'text' || value === 'number' || value === 'date' || value === 'ordering' || value === 'matching') {
    return value;
  }
  return '';
};

const tryParseJsonObject = (raw: unknown): Record<string, unknown> | null => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    if (typeof parsed === 'string') {
      const nested = JSON.parse(parsed) as unknown;
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        return nested as Record<string, unknown>;
      }
    }
  } catch {
    return null;
  }
  return null;
};

export function parseQuestionDefinition(value: unknown): ParsedQuestionDefinition | null {
  const data = tryParseJsonObject(value);
  if (!data) return null;
  let root: Record<string, unknown> = data;
  const parsedDefinition = tryParseJsonObject(data.definition);
  if (parsedDefinition) {
    root = parsedDefinition;
  } else if (Array.isArray(data.questionTypes) && data.questionTypes.length > 0) {
    const first = tryParseJsonObject(data.questionTypes[0]);
    if (first) {
      root = first;
    }
  }
  const type = normalizeQuestionType(root.type);
  if (!type) return null;

  const title = typeof root.title === 'string' ? root.title : undefined;
  const question = typeof root.question === 'string' ? root.question : '';
  if (!question.trim()) return null;

  const options = Array.isArray(root.options)
    ? root.options.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean)
    : undefined;

  const columns = Array.isArray(root.columns)
    ? root.columns
        .map((col) =>
          Array.isArray(col)
            ? col.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean)
            : []
        )
        .filter((col) => col.length > 0)
    : undefined;

  const answer = (() => {
    if (type === 'selection') {
      const source = Array.isArray(root.answer) ? root.answer : [];
      return source
        .map((x) => Number(x))
        .filter((x) => Number.isInteger(x) && x >= 0)
        .sort((a, b) => a - b);
    }

    if (type === 'truefalse') {
      if (typeof root.answer === 'boolean') return root.answer;
      return false;
    }

    if (type === 'matching') {
      const answerNode = root.answer && typeof root.answer === 'object'
        ? (root.answer as Record<string, unknown>)
        : null;
      const source = Array.isArray(answerNode?.paths) ? answerNode.paths : [];
      const paths = source
        .map((row) =>
          Array.isArray(row)
            ? row
                .map((x) => Number(x))
                .filter((x) => Number.isInteger(x) && x >= 0)
            : []
        )
        .filter((row) => row.length > 0);
      return { paths };
    }

    if (typeof root.answer === 'string' || typeof root.answer === 'number') return root.answer;
    return undefined;
  })();

  return {
    type,
    title,
    question,
    options,
    answer,
    columns
  };
}

function shuffleWithIndexMap<T>(items: T[]) {
  const indexed = items.map((value, oldIndex) => ({ value, oldIndex }));
  for (let i = indexed.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }
  const values = indexed.map((entry) => entry.value);
  const oldToNew = new Map<number, number>();
  indexed.forEach((entry, newIndex) => oldToNew.set(entry.oldIndex, newIndex));
  return { values, oldToNew };
}

export function shuffleQuestionDefinitionForRuntime(def: ParsedQuestionDefinition): ParsedQuestionDefinition {
  if (def.type === 'selection') {
    const options = def.options ?? [];
    const shuffled = shuffleWithIndexMap(options);
    const expected = Array.isArray(def.answer) ? def.answer : [];
    return {
      ...def,
      options: shuffled.values,
      answer: expected
        .map((index) => shuffled.oldToNew.get(index))
        .filter((index): index is number => Number.isInteger(index))
        .sort((a, b) => a - b)
    };
  }

  if (def.type === 'matching') {
    const columns = def.columns ?? [];
    const shuffledColumns = columns.map((column) => shuffleWithIndexMap(column));
    const paths =
      def.answer && typeof def.answer === 'object' && 'paths' in def.answer
        ? def.answer.paths
        : [];
    const remappedPaths = paths.map((path) =>
      path.map((oldIndex, columnIndex) => shuffledColumns[columnIndex]?.oldToNew.get(oldIndex) ?? oldIndex)
    );
    return {
      ...def,
      columns: shuffledColumns.map((entry) => entry.values),
      answer: { paths: remappedPaths }
    };
  }

  return def;
}

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
      promptModel: { kind: 'selection', options, allowMultiple: expected.length !== 1 },
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
