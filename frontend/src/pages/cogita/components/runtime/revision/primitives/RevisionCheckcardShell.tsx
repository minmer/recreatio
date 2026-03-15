import { evaluateCheckcardCitationQuote } from './checkcards/checkcardCitationQuote';
import { evaluateCheckcardComputedInput } from './checkcards/checkcardComputedInput';
import { evaluateCheckcardQuestion } from './checkcards/checkcardQuestion';
import { evaluateCheckcardQuestionText } from './checkcards/checkcardQuestionText';
import { evaluateCheckcardVocabTranslationMatch } from './checkcards/checkcardVocabTranslationMatch';

export type RuntimeCheckcardPromptKind =
  | 'text'
  | 'selection'
  | 'boolean'
  | 'ordering'
  | 'matching'
  | 'citation-fragment';

export type RuntimeCheckcardPromptModel = {
  kind: RuntimeCheckcardPromptKind;
  inputType?: 'text' | 'number' | 'date';
  options?: string[];
  columns?: string[][];
  allowMultiple?: boolean;
};

export type RuntimeCheckcardExpectedModel =
  | string
  | number
  | boolean
  | number[]
  | { paths: number[][] }
  | null
  | undefined;

export type RuntimeCheckcardAnswerModel = {
  text?: string;
  selection?: number[];
  booleanAnswer?: boolean | null;
  ordering?: string[];
  matchingPaths?: number[][];
  matchingSelection?: Array<number | null>;
};

export type RuntimeCheckcardCorrectnessState =
  | 'empty'
  | 'in_progress'
  | 'fulfilled'
  | 'checked_correct'
  | 'checked_incorrect';

export type RuntimeCheckcardCorrectness = {
  value: number;
  percent: number;
  state: RuntimeCheckcardCorrectnessState;
};

export type RuntimeCheckcardEvaluationPayload =
  | {
      type: 'text';
      expectedText: string;
      actualText: string;
      similarityPct: number;
      thresholdPct: number;
    }
  | {
      type: 'number';
      expectedValue: number;
      actualValue: number;
      delta: number;
    }
  | {
      type: 'selection';
      expectedValues: number[];
      actualValues: number[];
      matchedCount: number;
      totalExpected: number;
    }
  | {
      type: 'boolean';
      expectedValue: boolean | null;
      actualValue: boolean | null;
    }
  | {
      type: 'ordering';
      expectedValues: string[];
      actualValues: string[];
      similarityPct: number;
      mismatchCount: number;
    }
  | {
      type: 'matching';
      expectedPaths: string[];
      actualPaths: string[];
      matchedCount: number;
      totalExpected: number;
    };

export type RuntimeCheckcardEvent =
  | {
      type: 'checked';
      isCorrect: boolean;
      correctnessPct: number;
      correctness: RuntimeCheckcardCorrectness;
      details: RuntimeCheckcardEvaluationPayload;
    }
  | {
      type: 'fulfilled';
      correctnessPct: number;
      correctness: RuntimeCheckcardCorrectness;
    }
  | {
      type: 'partial_progress';
      correctnessPct: number;
      correctness: RuntimeCheckcardCorrectness;
      matchedCount: number;
      totalExpected: number;
    };

export type RuntimeCheckcardEvaluation = {
  isCorrect: boolean;
  correctnessPct: number;
  correctness: RuntimeCheckcardCorrectness;
  mask: Uint8Array | null;
  payload: RuntimeCheckcardEvaluationPayload;
  events: RuntimeCheckcardEvent[];
};

export type RuntimeCheckcardRevealState = {
  status: 'correct' | 'incorrect';
  correctnessPct: number;
  correctness: RuntimeCheckcardCorrectness;
  kind: RuntimeCheckcardPromptKind;
  details: RuntimeCheckcardEvaluationPayload;
  events: RuntimeCheckcardEvent[];
};

export function normalizeInts(
  values: unknown[],
  options?: {
    sort?: boolean;
    unique?: boolean;
  }
): number[] {
  const parsed = values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0);
  const uniqueValues = options?.unique ? Array.from(new Set(parsed)) : parsed;
  if (options?.sort) {
    uniqueValues.sort((left, right) => left - right);
  }
  return uniqueValues;
}

export function normalizePath(values: unknown[]): number[] | null {
  const parsed: number[] = [];
  for (const value of values) {
    const next = Number(value);
    if (!Number.isInteger(next) || next < 0) {
      return null;
    }
    parsed.push(next);
  }

  return parsed.length > 0 ? parsed : null;
}

export function normalizePathKey(path: number[]) {
  return path.join('|');
}

export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

export function createRuntimeCheckcardCorrectness(payload: {
  correctnessPct: number;
  isCorrect: boolean;
  hasAnswer: boolean;
  checked: boolean;
}): RuntimeCheckcardCorrectness {
  const percent = clampPercent(payload.correctnessPct);
  const value = percent / 100;

  if (payload.checked) {
    return {
      value,
      percent,
      state: payload.isCorrect ? 'checked_correct' : 'checked_incorrect'
    };
  }

  if (payload.isCorrect) {
    return { value, percent, state: 'fulfilled' };
  }

  if (payload.hasAnswer && percent > 0) {
    return { value, percent, state: 'in_progress' };
  }

  return { value, percent, state: 'empty' };
}

export function buildEvaluationEvents(
  isCorrect: boolean,
  correctnessPct: number,
  payload: RuntimeCheckcardEvaluationPayload,
  correctness: RuntimeCheckcardCorrectness,
  progress?: { matchedCount: number; totalExpected: number }
): RuntimeCheckcardEvent[] {
  const normalized = clampPercent(correctnessPct);
  const events: RuntimeCheckcardEvent[] = [
    {
      type: 'checked',
      isCorrect,
      correctnessPct: normalized,
      correctness,
      details: payload
    }
  ];

  if (isCorrect) {
    events.push({ type: 'fulfilled', correctnessPct: normalized, correctness });
    return events;
  }

  if (progress && progress.totalExpected > 0 && progress.matchedCount > 0) {
    events.push({
      type: 'partial_progress',
      correctnessPct: normalized,
      correctness,
      matchedCount: progress.matchedCount,
      totalExpected: progress.totalExpected
    });
  }

  return events;
}

export function toRuntimeCheckcardRevealState(
  promptKind: RuntimeCheckcardPromptKind,
  evaluation: RuntimeCheckcardEvaluation
): RuntimeCheckcardRevealState {
  return {
    status: evaluation.isCorrect ? 'correct' : 'incorrect',
    correctnessPct: evaluation.correctnessPct,
    correctness: evaluation.correctness,
    kind: promptKind,
    details: evaluation.payload,
    events: evaluation.events
  };
}

export type RuntimeCheckcardNotionType =
  | 'language'
  | 'word'
  | 'sentence'
  | 'topic'
  | 'collection'
  | 'person'
  | 'institution'
  | 'collective'
  | 'orcid'
  | 'address'
  | 'email'
  | 'phone'
  | 'media'
  | 'work'
  | 'geo'
  | 'music_piece'
  | 'music_fragment'
  | 'source'
  | 'question'
  | 'computed'
  | 'citation'
  | 'translation'
  | 'vocab'
  | 'unknown';

export type RuntimeCheckcardContext = {
  notionType?: RuntimeCheckcardNotionType | string | null;
  checkType?: string | null;
  cardType?: string | null;
};

function normalizeNotionType(raw: RuntimeCheckcardContext['notionType']): RuntimeCheckcardNotionType | null {
  const token = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!token) {
    return null;
  }
  if (token === 'vocab') {
    return 'vocab';
  }
  if (token === 'question') {
    return 'question';
  }
  if (token === 'citation') {
    return 'citation';
  }
  if (token === 'translation') {
    return 'translation';
  }
  if (token === 'computed') {
    return 'computed';
  }
  if (
    token === 'language' ||
    token === 'word' ||
    token === 'sentence' ||
    token === 'topic' ||
    token === 'collection' ||
    token === 'person' ||
    token === 'institution' ||
    token === 'collective' ||
    token === 'orcid' ||
    token === 'address' ||
    token === 'email' ||
    token === 'phone' ||
    token === 'media' ||
    token === 'work' ||
    token === 'geo' ||
    token === 'music_piece' ||
    token === 'music_fragment' ||
    token === 'source'
  ) {
    return token;
  }
  return 'unknown';
}

function inferNotionType(payload: {
  prompt: RuntimeCheckcardPromptModel;
  context?: RuntimeCheckcardContext;
}): RuntimeCheckcardNotionType {
  const explicit = normalizeNotionType(payload.context?.notionType);
  if (explicit) {
    return explicit;
  }
  if ((payload.context?.cardType ?? '').toLowerCase() === 'vocab') {
    return 'vocab';
  }
  if (payload.prompt.kind === 'citation-fragment') {
    return 'citation';
  }
  if (
    payload.prompt.kind === 'selection' ||
    payload.prompt.kind === 'boolean' ||
    payload.prompt.kind === 'ordering' ||
    payload.prompt.kind === 'matching'
  ) {
    return 'question';
  }
  return 'unknown';
}

function isQuoteFragmentCheck(payload: {
  prompt: RuntimeCheckcardPromptModel;
  context?: RuntimeCheckcardContext;
}) {
  const checkType = String(payload.context?.checkType ?? '').trim().toLowerCase();
  return payload.prompt.kind === 'citation-fragment' || checkType === 'quote-fragment';
}

export function evaluateRuntimeCheckcard(payload: {
  prompt: RuntimeCheckcardPromptModel;
  expected: RuntimeCheckcardExpectedModel;
  answer: RuntimeCheckcardAnswerModel;
  context?: RuntimeCheckcardContext;
}): RuntimeCheckcardEvaluation {
  const notionType = inferNotionType(payload);

  if (notionType === 'question') {
    return evaluateCheckcardQuestion(payload.prompt, payload.expected, payload.answer);
  }

  if (notionType === 'citation' && isQuoteFragmentCheck(payload)) {
    return evaluateCheckcardCitationQuote(payload.prompt, payload.expected, payload.answer);
  }

  if (notionType === 'computed') {
    return evaluateCheckcardComputedInput(payload.prompt, payload.expected, payload.answer);
  }

  if (notionType === 'vocab') {
    return evaluateCheckcardVocabTranslationMatch(payload.prompt, payload.expected, payload.answer);
  }

  if (
    payload.prompt.kind === 'selection' ||
    payload.prompt.kind === 'boolean' ||
    payload.prompt.kind === 'ordering' ||
    payload.prompt.kind === 'matching'
  ) {
    return evaluateCheckcardQuestion(payload.prompt, payload.expected, payload.answer);
  }

  return evaluateCheckcardQuestionText(
    {
      ...payload.prompt,
      kind: payload.prompt.kind === 'citation-fragment' ? 'text' : payload.prompt.kind
    },
    payload.expected,
    payload.answer
  );
}

export function buildRuntimeCheckcardReveal(payload: {
  prompt: RuntimeCheckcardPromptModel;
  evaluation: RuntimeCheckcardEvaluation;
}): RuntimeCheckcardRevealState {
  return toRuntimeCheckcardRevealState(payload.prompt.kind, payload.evaluation);
}

export type RuntimeCheckcardInteractionAction =
  | { type: 'reset' }
  | { type: 'text_set'; value: string }
  | { type: 'selection_toggle'; index: number; allowMultiple?: boolean }
  | { type: 'boolean_set'; value: boolean | null }
  | { type: 'ordering_move'; index: number; delta: -1 | 1 }
  | { type: 'matching_pick'; columnIndex: number; optionIndex: number }
  | { type: 'matching_remove_path'; pathIndex: number }
  | { type: 'matching_clear_paths' };

export type RuntimeCheckcardInteractionEvent =
  | {
      type: 'answer_changed';
      correctnessPct: number;
      correctness: RuntimeCheckcardCorrectness;
    }
  | {
      type: 'progress';
      fromPct: number;
      toPct: number;
    }
  | {
      type: 'fulfilled_by_card';
      correctnessPct: number;
      correctness: RuntimeCheckcardCorrectness;
    }
  | {
      type: 'matching_path_completed';
      path: number[];
      totalPaths: number;
    }
  | {
      type: 'matching_path_removed';
      path: number[];
      totalPaths: number;
    };

export type RuntimeCheckcardInteractionResult = {
  answer: RuntimeCheckcardAnswerModel;
  evaluation: RuntimeCheckcardEvaluation;
  reveal: RuntimeCheckcardRevealState;
  correctness: RuntimeCheckcardCorrectness;
  events: RuntimeCheckcardInteractionEvent[];
};

type RuntimeCheckcardInteractionReduction = {
  answer: RuntimeCheckcardAnswerModel;
  events: RuntimeCheckcardInteractionEvent[];
};

export function createRuntimeCheckcardInitialAnswer(
  prompt: RuntimeCheckcardPromptModel
): RuntimeCheckcardAnswerModel {
  if (prompt.kind === 'selection') {
    return { selection: [] };
  }

  if (prompt.kind === 'boolean') {
    return { booleanAnswer: null };
  }

  if (prompt.kind === 'ordering') {
    return { ordering: Array.isArray(prompt.options) ? prompt.options.map(String) : [] };
  }

  if (prompt.kind === 'matching') {
    const width = Math.max(2, prompt.columns?.length ?? 0);
    return {
      matchingPaths: [],
      matchingSelection: new Array(width).fill(null)
    };
  }

  return { text: '' };
}

export function ensureRuntimeCheckcardAnswer(
  prompt: RuntimeCheckcardPromptModel,
  answer: RuntimeCheckcardAnswerModel
): RuntimeCheckcardAnswerModel {
  const initial = createRuntimeCheckcardInitialAnswer(prompt);
  if (prompt.kind === 'matching') {
    const width = Math.max(2, prompt.columns?.length ?? 0);
    const selection = Array.from(
      { length: width },
      (_, index) => answer.matchingSelection?.[index] ?? initial.matchingSelection?.[index] ?? null
    );
    return {
      ...initial,
      ...answer,
      matchingSelection: selection
    };
  }
  return { ...initial, ...answer };
}

function hasAnswerValue(prompt: RuntimeCheckcardPromptModel, answer: RuntimeCheckcardAnswerModel) {
  if (prompt.kind === 'selection') {
    return (answer.selection?.length ?? 0) > 0;
  }
  if (prompt.kind === 'boolean') {
    return answer.booleanAnswer !== null && typeof answer.booleanAnswer !== 'undefined';
  }
  if (prompt.kind === 'ordering') {
    return (answer.ordering?.length ?? 0) > 0;
  }
  if (prompt.kind === 'matching') {
    return (answer.matchingPaths?.length ?? 0) > 0;
  }
  return String(answer.text ?? '').trim().length > 0;
}

function reduceRuntimeCheckcardInteraction(
  prompt: RuntimeCheckcardPromptModel,
  answer: RuntimeCheckcardAnswerModel,
  action: RuntimeCheckcardInteractionAction
): RuntimeCheckcardInteractionReduction {
  if (action.type === 'reset') {
    return { answer: createRuntimeCheckcardInitialAnswer(prompt), events: [] };
  }

  if (action.type === 'text_set') {
    return { answer: { ...answer, text: action.value }, events: [] };
  }

  if (action.type === 'selection_toggle') {
    const current = answer.selection ?? [];
    const allowMultiple = action.allowMultiple ?? prompt.allowMultiple ?? true;
    if (!allowMultiple) {
      const selected = current[0] === action.index ? [] : [action.index];
      return { answer: { ...answer, selection: selected }, events: [] };
    }
    const selected = current.includes(action.index)
      ? current.filter((item) => item !== action.index)
      : Array.from(new Set([...current, action.index]));
    return { answer: { ...answer, selection: selected }, events: [] };
  }

  if (action.type === 'boolean_set') {
    return { answer: { ...answer, booleanAnswer: action.value }, events: [] };
  }

  if (action.type === 'ordering_move') {
    const list = Array.isArray(answer.ordering)
      ? [...answer.ordering]
      : Array.isArray(prompt.options)
        ? prompt.options.map(String)
        : [];
    const target = action.index + action.delta;
    if (target < 0 || target >= list.length) {
      return { answer: { ...answer, ordering: list }, events: [] };
    }
    [list[action.index], list[target]] = [list[target], list[action.index]];
    return { answer: { ...answer, ordering: list }, events: [] };
  }

  if (action.type === 'matching_clear_paths') {
    return { answer: { ...answer, matchingPaths: [] }, events: [] };
  }

  if (action.type === 'matching_remove_path') {
    const paths = Array.isArray(answer.matchingPaths) ? [...answer.matchingPaths] : [];
    if (action.pathIndex < 0 || action.pathIndex >= paths.length) {
      return { answer: { ...answer, matchingPaths: paths }, events: [] };
    }
    const [removed] = paths.splice(action.pathIndex, 1);
    const removedPath = normalizePath(Array.isArray(removed) ? removed : []);
    return {
      answer: { ...answer, matchingPaths: paths },
      events:
        removedPath === null
          ? []
          : [
              {
                type: 'matching_path_removed',
                path: removedPath,
                totalPaths: paths.length
              }
            ]
    };
  }

  const width = Math.max(2, prompt.columns?.length ?? 0);
  const currentSelection = Array.from(
    { length: width },
    (_, index) => answer.matchingSelection?.[index] ?? null
  );
  currentSelection[action.columnIndex] =
    currentSelection[action.columnIndex] === action.optionIndex ? null : action.optionIndex;

  if (currentSelection.some((entry) => entry === null)) {
    return {
      answer: { ...answer, matchingSelection: currentSelection },
      events: []
    };
  }

  const completedPath = currentSelection.map((entry) => Number(entry));
  const normalizedPath = normalizePath(completedPath);
  if (!normalizedPath) {
    return { answer: { ...answer, matchingSelection: currentSelection }, events: [] };
  }

  const existingPaths = Array.isArray(answer.matchingPaths) ? [...answer.matchingPaths] : [];
  const existingKeys = new Set(
    existingPaths
      .map((row) => (Array.isArray(row) ? normalizePath(row) : null))
      .filter((row): row is number[] => Array.isArray(row))
      .map(normalizePathKey)
  );
  const completedKey = normalizePathKey(normalizedPath);
  const nextPaths = existingKeys.has(completedKey) ? existingPaths : [...existingPaths, normalizedPath];

  return {
    answer: {
      ...answer,
      matchingPaths: nextPaths,
      matchingSelection: new Array(width).fill(null)
    },
    events: [
      {
        type: 'matching_path_completed',
        path: normalizedPath,
        totalPaths: nextPaths.length
      }
    ]
  };
}

export function applyRuntimeCheckcardInteraction(payload: {
  prompt: RuntimeCheckcardPromptModel;
  expected: RuntimeCheckcardExpectedModel;
  answer: RuntimeCheckcardAnswerModel;
  action: RuntimeCheckcardInteractionAction;
  context?: RuntimeCheckcardContext;
}): RuntimeCheckcardInteractionResult {
  const beforeAnswer = ensureRuntimeCheckcardAnswer(payload.prompt, payload.answer);
  const beforeEvaluation = evaluateRuntimeCheckcard({
    prompt: payload.prompt,
    expected: payload.expected,
    answer: beforeAnswer,
    context: payload.context
  });
  const reduced = reduceRuntimeCheckcardInteraction(payload.prompt, beforeAnswer, payload.action);
  const nextAnswer = ensureRuntimeCheckcardAnswer(payload.prompt, reduced.answer);
  const evaluation = evaluateRuntimeCheckcard({
    prompt: payload.prompt,
    expected: payload.expected,
    answer: nextAnswer,
    context: payload.context
  });
  const correctness = createRuntimeCheckcardCorrectness({
    correctnessPct: evaluation.correctnessPct,
    isCorrect: evaluation.isCorrect,
    hasAnswer: hasAnswerValue(payload.prompt, nextAnswer),
    checked: false
  });
  const events: RuntimeCheckcardInteractionEvent[] = [...reduced.events];
  events.push({
    type: 'answer_changed',
    correctnessPct: evaluation.correctnessPct,
    correctness
  });

  const beforePct = clampPercent(beforeEvaluation.correctnessPct);
  const nextPct = clampPercent(evaluation.correctnessPct);
  if (nextPct > beforePct) {
    events.push({
      type: 'progress',
      fromPct: beforePct,
      toPct: nextPct
    });
  }

  if (!beforeEvaluation.isCorrect && evaluation.isCorrect) {
    events.push({
      type: 'fulfilled_by_card',
      correctnessPct: evaluation.correctnessPct,
      correctness
    });
  }

  return {
    answer: nextAnswer,
    evaluation,
    reveal: buildRuntimeCheckcardReveal({ prompt: payload.prompt, evaluation }),
    correctness,
    events
  };
}

function renderRuntimeCheckcardInterrogateView({
  prompt,
  answer,
  expected,
  readOnly,
  onChange,
  onInteraction
}: {
  prompt: RuntimeCheckcardPromptModel;
  answer: RuntimeCheckcardAnswerModel;
  expected?: RuntimeCheckcardExpectedModel;
  readOnly?: boolean;
  onChange: (next: RuntimeCheckcardAnswerModel) => void;
  onInteraction?: (event: RuntimeCheckcardInteractionResult) => void;
}) {
  const normalizedAnswer = ensureRuntimeCheckcardAnswer(prompt, answer);
  const safeExpected = expected ?? null;

  const commit = (action: Parameters<typeof applyRuntimeCheckcardInteraction>[0]['action']) => {
    if (readOnly) {
      return;
    }
    const event = applyRuntimeCheckcardInteraction({
      prompt,
      expected: safeExpected,
      answer: normalizedAnswer,
      action
    });
    onChange(event.answer);
    onInteraction?.(event);
  };

  if (prompt.kind === 'selection') {
    const allowMultiple =
      prompt.allowMultiple ??
      (Array.isArray(safeExpected) ? safeExpected.length !== 1 : true);
    const selected = normalizedAnswer.selection ?? [];
    const expectedSet = new Set(
      Array.isArray(safeExpected) ? safeExpected.map((value) => Number(value)) : []
    );
    return (
      <div className="cogita-live-selection-grid">
        {(prompt.options ?? []).map((option, index) => {
          const active = selected.includes(index);
          const expectedActive = expectedSet.has(index);
          return (
            <button
              key={`selection:${index}`}
              type="button"
              className="ghost"
              disabled={Boolean(readOnly)}
              data-active={active ? 'true' : undefined}
              style={readOnly && expectedActive ? { borderColor: 'rgba(111, 214, 255, 0.85)' } : undefined}
              onClick={() => commit({ type: 'selection_toggle', index, allowMultiple })}
            >
              {option}
            </button>
          );
        })}
      </div>
    );
  }

  if (prompt.kind === 'boolean') {
    return (
      <div className="cogita-live-selection-grid">
        <button
          type="button"
          className="ghost"
          disabled={Boolean(readOnly)}
          data-active={normalizedAnswer.booleanAnswer === true ? 'true' : undefined}
          onClick={() => commit({ type: 'boolean_set', value: true })}
        >
          True
        </button>
        <button
          type="button"
          className="ghost"
          disabled={Boolean(readOnly)}
          data-active={normalizedAnswer.booleanAnswer === false ? 'true' : undefined}
          onClick={() => commit({ type: 'boolean_set', value: false })}
        >
          False
        </button>
      </div>
    );
  }

  if (prompt.kind === 'ordering') {
    const list = normalizedAnswer.ordering ?? prompt.options ?? [];
    return (
      <div className="cogita-live-ordering-list">
        {list.map((value, index) => (
          <div key={`ordering:${index}:${value}`} className="cogita-live-ordering-row">
            <span>{value}</span>
            {!readOnly ? (
              <div className="cogita-live-ordering-actions">
                <button
                  type="button"
                  className="ghost"
                  disabled={index <= 0}
                  onClick={() => commit({ type: 'ordering_move', index, delta: -1 })}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={index >= list.length - 1}
                  onClick={() => commit({ type: 'ordering_move', index, delta: 1 })}
                >
                  ↓
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  if (prompt.kind === 'matching') {
    const columns = Array.isArray(prompt.columns) ? prompt.columns : [];
    const width = Math.max(2, columns.length);
    const activeSelection = Array.from(
      { length: width },
      (_, index) => normalizedAnswer.matchingSelection?.[index] ?? null
    );
    const paths = (normalizedAnswer.matchingPaths ?? [])
      .map((row) => (Array.isArray(row) ? row.map((entry) => Number(entry)) : []))
      .filter((row) => row.length > 0);
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div
          style={{
            display: 'grid',
            gap: '0.65rem',
            gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
            alignItems: 'start'
          }}
        >
          {columns.map((column, columnIndex) => (
            <div
              key={`runtime-col:${columnIndex}`}
              className="cogita-library-panel"
              style={{ display: 'grid', gap: '0.35rem', padding: '0.6rem' }}
            >
              <p className="cogita-user-kicker">{`Column ${columnIndex + 1}`}</p>
              {column.map((option, optionIndex) => (
                <button
                  key={`runtime-col:${columnIndex}:${optionIndex}`}
                  type="button"
                  className="ghost cogita-checkcard-row"
                  style={{ textAlign: 'left' }}
                  data-active={activeSelection[columnIndex] === optionIndex ? 'true' : undefined}
                  onClick={() => commit({ type: 'matching_pick', columnIndex, optionIndex })}
                  disabled={Boolean(readOnly)}
                >
                  <span>{option}</span>
                  <small>{optionIndex}</small>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gap: '0.4rem' }}>
          <p className="cogita-user-kicker">Selected paths</p>
          {paths.length > 0 ? (
            <div className="cogita-share-list">
              {paths.map((path, pathIndex) => (
                <div key={`runtime-path:${pathIndex}`} className="cogita-share-row">
                  <span>{renderPathLabel(columns, path)}</span>
                  {!readOnly ? (
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => commit({ type: 'matching_remove_path', pathIndex })}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="cogita-library-hint">Pick one option in each column to complete a path.</p>
          )}
          {!readOnly && paths.length > 0 ? (
            <button type="button" className="ghost" onClick={() => commit({ type: 'matching_clear_paths' })}>
              Clear paths
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <label className="cogita-field">
      <span>Your answer</span>
      <input
        type={prompt.inputType === 'number' ? 'number' : prompt.inputType === 'date' ? 'date' : 'text'}
        value={normalizedAnswer.text ?? ''}
        onChange={(event) => commit({ type: 'text_set', value: event.target.value })}
        readOnly={Boolean(readOnly)}
      />
    </label>
  );
}

export type RuntimeCheckcardDisplayMode = 'interrogate' | 'reveal' | 'interrogate_reveal';

export function RuntimeCheckcard({
  prompt,
  answer,
  expected,
  reveal,
  mode = 'interrogate',
  readOnly,
  onChange,
  onInteraction
}: {
  prompt: RuntimeCheckcardPromptModel;
  answer: RuntimeCheckcardAnswerModel;
  expected?: RuntimeCheckcardExpectedModel;
  reveal?: RuntimeCheckcardRevealState;
  mode?: RuntimeCheckcardDisplayMode;
  readOnly?: boolean;
  onChange?: (next: RuntimeCheckcardAnswerModel) => void;
  onInteraction?: (event: RuntimeCheckcardInteractionResult) => void;
}) {
  const showInterrogate = mode === 'interrogate' || mode === 'interrogate_reveal';
  const showReveal = mode === 'reveal' || mode === 'interrogate_reveal';

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {showInterrogate
        ? renderRuntimeCheckcardInterrogateView({
            prompt,
            answer,
            expected,
            readOnly,
            onChange: onChange ?? (() => undefined),
            onInteraction
          })
        : null}
      {showReveal && reveal ? renderRuntimeCheckcardRevealSummary({ reveal }) : null}
    </div>
  );
}

function renderRuntimeCheckcardRevealSummary({
  reveal
}: {
  reveal: RuntimeCheckcardRevealState;
}) {
  return (
    <div className="cogita-library-hint">
      <p>
        {reveal.status === 'correct' ? 'Correct' : 'Incorrect'} · {reveal.correctness.percent.toFixed(1)}%
      </p>
      <p>{describeRevealPayload(reveal.details)}</p>
    </div>
  );
}

function describeRevealPayload(payload: RuntimeCheckcardEvaluationPayload): string {
  if (payload.type === 'text') {
    return `Expected "${payload.expectedText}", received "${payload.actualText}"`;
  }
  if (payload.type === 'number') {
    return `Expected ${payload.expectedValue}, received ${payload.actualValue}`;
  }
  if (payload.type === 'selection') {
    return `Matched ${payload.matchedCount}/${payload.totalExpected} expected selections`;
  }
  if (payload.type === 'boolean') {
    return `Expected ${String(payload.expectedValue)}, received ${String(payload.actualValue)}`;
  }
  if (payload.type === 'ordering') {
    return `Ordering similarity ${payload.similarityPct.toFixed(1)}% (${payload.mismatchCount} mismatches)`;
  }
  return `Matched ${payload.matchedCount}/${payload.totalExpected} expected paths`;
}

function renderPathLabel(columns: string[][], path: number[]) {
  return path
    .map((optionIndex, columnIndex) => {
      const option = columns[columnIndex]?.[optionIndex];
      return option ? `${option} (${optionIndex})` : `#${optionIndex}`;
    })
    .join(' -> ');
}
