import type { Copy } from '../../../../../../content/types';

export type QuestionKind = 'selection' | 'truefalse' | 'text' | 'number' | 'date' | 'matching' | 'ordering';

export type QuestionDefinition = {
  type: QuestionKind;
  title?: string;
  question: string;
  options?: string[];
  answer?: number[] | string | number | boolean | { paths: number[][] };
  columns?: string[][];
  matchingPaths?: string[][];
};

export const QUESTION_DEFINITION_TEMPLATE = JSON.stringify(
  {
    type: 'selection',
    title: 'Question title',
    question: 'Question text',
    options: ['Option A', 'Option B', 'Option C'],
    answer: [0]
  },
  null,
  2
);

export function createDefaultQuestionDefinition(kind: QuestionKind = 'selection'): QuestionDefinition {
  if (kind === 'matching') {
    return { type: kind, title: '', question: '', columns: [[''], ['']], answer: { paths: [] }, matchingPaths: [['', '']] };
  }
  if (kind === 'ordering') {
    return { type: kind, title: '', question: '', options: [''] };
  }
  if (kind === 'truefalse') {
    return { type: kind, title: '', question: '', answer: true };
  }
  if (kind === 'text' || kind === 'date') {
    return { type: kind, title: '', question: '', answer: '' };
  }
  if (kind === 'number') {
    return { type: kind, title: '', question: '', answer: '' };
  }
  return { type: kind, title: '', question: '', options: [''], answer: [] };
}

export function isQuestionKind(value: string): value is QuestionKind {
  return ['selection', 'truefalse', 'text', 'number', 'date', 'matching', 'ordering'].includes(value);
}

export function normalizeQuestionDefinition(value: unknown): QuestionDefinition | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const rawTypeValue =
    typeof raw.type === 'string'
      ? raw.type
      : typeof raw.kind === 'string'
        ? raw.kind
        : 'selection';
  const kindAlias =
    rawTypeValue === 'multi_select' ||
    rawTypeValue === 'single_select' ||
    rawTypeValue === 'selection_single' ||
    rawTypeValue === 'selection_multiple'
      ? 'selection'
      : rawTypeValue === 'boolean'
        ? 'truefalse'
        : rawTypeValue === 'order'
          ? 'ordering'
          : rawTypeValue === 'short' || rawTypeValue === 'open' || rawTypeValue === 'short_text'
            ? 'text'
            : rawTypeValue;
  const kind = isQuestionKind(kindAlias) ? kindAlias : 'selection';
  const title = typeof raw.title === 'string' ? raw.title : '';
  const question = typeof raw.question === 'string' ? raw.question : '';
  if (kind === 'matching') {
    let columns: string[][] = [];
    if (Array.isArray(raw.columns)) {
      columns = raw.columns.map((column) =>
        Array.isArray(column) ? column.map((item) => (typeof item === 'string' ? item : '')) : ['']
      );
    } else if (Array.isArray(raw.left) && Array.isArray(raw.right)) {
      columns = [
        raw.left.map((item) => (typeof item === 'string' ? item : '')),
        raw.right.map((item) => (typeof item === 'string' ? item : ''))
      ];
    }
    if (columns.length < 2) {
      columns = [[''], ['']];
    }
    const answerRaw = raw.answer && typeof raw.answer === 'object' ? (raw.answer as Record<string, unknown>) : null;
    const pathSource = Array.isArray(answerRaw?.paths)
      ? answerRaw?.paths
      : Array.isArray(raw.correctPairs)
        ? raw.correctPairs
        : [];
    const paths = pathSource
      .map((path) => (Array.isArray(path) ? path.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0) : []))
      .filter((path) => path.length > 0);
    const rawMatchingPaths = Array.isArray(raw.matchingPaths)
      ? raw.matchingPaths.map((row) =>
          Array.isArray(row) ? Array.from({ length: columns.length }, (_, index) => String(row[index] ?? '')) : new Array(columns.length).fill('')
        )
      : null;
    const matchingPaths =
      rawMatchingPaths && rawMatchingPaths.length > 0
        ? rawMatchingPaths
        : [...paths.map((path) => path.map(String)), new Array(columns.length).fill('')];
    return { type: kind, title, question, columns, answer: { paths }, matchingPaths };
  }
  if (kind === 'ordering') {
    const items = Array.isArray(raw.options)
      ? raw.options.map((item) => (typeof item === 'string' ? item : ''))
      : Array.isArray(raw.items)
        ? raw.items.map((item) => (typeof item === 'string' ? item : ''))
        : [''];
    return { type: kind, title, question, options: items.length ? items : [''] };
  }
  if (kind === 'truefalse') {
    const answer = typeof raw.answer === 'boolean' ? raw.answer : typeof raw.expected === 'boolean' ? raw.expected : true;
    return { type: kind, title, question, answer };
  }
  if (kind === 'number') {
    if (typeof raw.answer === 'number') return { type: kind, title, question, answer: raw.answer };
    if (typeof raw.answer === 'string') return { type: kind, title, question, answer: raw.answer };
    if (typeof raw.expected === 'number') return { type: kind, title, question, answer: raw.expected };
    return { type: kind, title, question, answer: '' };
  }
  if (kind === 'text' || kind === 'date') {
    const answer = typeof raw.answer === 'string' ? raw.answer : typeof raw.expected === 'string' ? raw.expected : '';
    return { type: kind, title, question, answer };
  }
  const options = Array.isArray(raw.options)
    ? raw.options.map((item) => (typeof item === 'string' ? item : ''))
    : Array.isArray(raw.answers)
      ? raw.answers.map((item) => (typeof item === 'string' ? item : ''))
      : [''];
  let answer = Array.isArray(raw.answer)
    ? raw.answer.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0)
    : Array.isArray(raw.correct)
      ? raw.correct.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0)
      : [];
  if (answer.length === 0 && Array.isArray(raw.correctAnswers)) {
    const expectedValues = raw.correctAnswers
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
    if (expectedValues.length > 0) {
      const expectedSet = new Set(expectedValues.map((item) => item.toLowerCase()));
      answer = options
        .map((option, index) => ({ option: option.trim().toLowerCase(), index }))
        .filter((entry) => entry.option.length > 0 && expectedSet.has(entry.option))
        .map((entry) => entry.index);
    }
  }
  return { type: kind, title, question, options: options.length ? options : [''], answer };
}

export function parseQuestionDefinitionFromPayload(rawValue: unknown): QuestionDefinition | null {
  const isMeaningfulQuestionDefinition = (definition: QuestionDefinition | null): definition is QuestionDefinition => {
    if (!definition) return false;
    if (definition.question.trim().length > 0) return true;
    if (definition.type === 'selection') {
      return (definition.options ?? []).map((item) => item.trim()).filter(Boolean).length > 0;
    }
    if (definition.type === 'ordering') {
      return (definition.options ?? []).map((item) => item.trim()).filter(Boolean).length > 0;
    }
    if (definition.type === 'matching') {
      return (definition.columns ?? []).some((column) => column.some((item) => item.trim().length > 0));
    }
    return definition.answer !== undefined;
  };

  const parseFromObject = (value: Record<string, unknown>): QuestionDefinition | null => {
    const direct = normalizeQuestionDefinition(value);
    if (isMeaningfulQuestionDefinition(direct)) return direct;

    const definitionRaw = value.definition;
    if (definitionRaw && typeof definitionRaw === 'object' && !Array.isArray(definitionRaw)) {
      const nested = normalizeQuestionDefinition(definitionRaw as Record<string, unknown>);
      if (isMeaningfulQuestionDefinition(nested)) return nested;
    }
    if (typeof definitionRaw === 'string') {
      const trimmed = definitionRaw.trim();
      if (trimmed.length > 0) {
        try {
          const parsed = JSON.parse(trimmed) as unknown;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const nested = normalizeQuestionDefinition(parsed as Record<string, unknown>);
            if (isMeaningfulQuestionDefinition(nested)) return nested;
          }
        } catch {
          // ignore invalid nested definition JSON
        }
      }
    }

    if (Array.isArray(value.questionTypes)) {
      for (const item of value.questionTypes) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const nested = normalizeQuestionDefinition(item as Record<string, unknown>);
          if (isMeaningfulQuestionDefinition(nested)) return nested;
        }
        if (typeof item === 'string') {
          const trimmed = item.trim();
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed) as unknown;
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              const nested = normalizeQuestionDefinition(parsed as Record<string, unknown>);
              if (isMeaningfulQuestionDefinition(nested)) return nested;
            }
          } catch {
            // ignore malformed questionType entry
          }
        }
      }
    }

    return isMeaningfulQuestionDefinition(direct) ? direct : null;
  };

  if (rawValue === null || rawValue === undefined) return null;
  if (typeof rawValue === 'object') {
    return parseFromObject(rawValue as Record<string, unknown>);
  }
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const normalized = parseFromObject(parsed as Record<string, unknown>);
      if (normalized) return normalized;
    }
    if (typeof parsed === 'string') {
      const nested = JSON.parse(parsed) as unknown;
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        return parseFromObject(nested as Record<string, unknown>);
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function serializeQuestionDefinition(definition: QuestionDefinition): string {
  const title = (definition.title ?? '').trim();
  const question = (definition.question ?? '').trim();
  switch (definition.type) {
    case 'matching': {
      const columns = (definition.columns ?? [[''], ['']])
        .map((column) => column.map((item) => item.trim()).filter(Boolean))
        .filter((column) => column.length > 0);
      const normalizedColumns = columns.length >= 2 ? columns : [[''], ['']];
      const rawPaths = definition.answer && typeof definition.answer === 'object' && 'paths' in definition.answer ? definition.answer.paths : [];
      const editableRows = (definition.matchingPaths ?? []).map((row) => row.map((value) => String(value ?? '')));
      const width = normalizedColumns.length;
      const fromRows = editableRows
        .map((row) => row.slice(0, width).map((value) => value.trim()))
        .filter((row) => row.some(Boolean))
        .map((row) => row.map((value) => Number(value)))
        .filter((row) => row.length === width && row.every((value) => Number.isInteger(value) && value >= 0)) as number[][];
      const paths = (Array.isArray(rawPaths) ? rawPaths : [])
        .map((path) =>
          Array.isArray(path)
            ? path.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0)
            : []
        )
        .filter((path) => path.length === width);
      const unique = Array.from(new Set([...paths, ...fromRows].map((path) => JSON.stringify(path)))).map((encoded) => JSON.parse(encoded) as number[]);
      return JSON.stringify(
        {
          type: definition.type,
          ...(title ? { title } : {}),
          question,
          columns: normalizedColumns,
          answer: { paths: unique }
        },
        null,
        2
      );
    }
    case 'ordering': {
      const items = (definition.options ?? []).map((item) => item.trim()).filter(Boolean);
      return JSON.stringify(
        {
          type: definition.type,
          ...(title ? { title } : {}),
          question,
          options: items
        },
        null,
        2
      );
    }
    case 'truefalse':
      return JSON.stringify(
        { type: definition.type, ...(title ? { title } : {}), question, answer: Boolean(definition.answer) },
        null,
        2
      );
    case 'number':
      return JSON.stringify(
        {
          type: definition.type,
          ...(title ? { title } : {}),
          question,
          answer:
            typeof definition.answer === 'number'
              ? definition.answer
              : typeof definition.answer === 'string'
                ? definition.answer
                : ''
        },
        null,
        2
      );
    case 'date':
    case 'text':
      return JSON.stringify(
        { type: definition.type, ...(title ? { title } : {}), question, answer: String(definition.answer ?? '') },
        null,
        2
      );
    case 'selection':
    default: {
      const options = (definition.options ?? []).map((option) => option.trim()).filter(Boolean);
      const answerRaw = Array.isArray(definition.answer) ? definition.answer : [];
      const correct = Array.from(
        new Set(answerRaw.filter((index) => Number.isInteger(index) && index >= 0 && index < options.length))
      ).sort((a, b) => a - b);
      return JSON.stringify(
        { type: definition.type, ...(title ? { title } : {}), question, options, answer: correct },
        null,
        2
      );
    }
  }
}

export type NotionQuestionEditorProps = {
  copy: Copy;
  definition: QuestionDefinition;
  onDefinitionChange: (next: QuestionDefinition) => void;
  importJson: string;
  onImportJsonChange: (value: string) => void;
  onInterpretJson: () => void;
  importQueueLength: number;
  importQueueIndex: number;
};

export function NotionQuestionEditor({
  copy,
  definition,
  onDefinitionChange,
  importJson,
  onImportJsonChange,
  onInterpretJson,
  importQueueLength,
  importQueueIndex
}: NotionQuestionEditorProps) {
  const kind = definition.type;
  const setKind = (nextKind: QuestionKind) => {
    if (!isQuestionKind(nextKind)) return;
    const currentTitle = definition.title ?? '';
    const currentQuestion = definition.question ?? '';
    const next = normalizeQuestionDefinition({
      ...createDefaultQuestionDefinition(nextKind),
      title: currentTitle,
      question: currentQuestion
    });
    onDefinitionChange(next ?? createDefaultQuestionDefinition(nextKind));
  };
  const ensureTrailing = (items: string[]) => {
    if (items.length === 0) return [''];
    return items[items.length - 1].trim() ? [...items, ''] : items;
  };
  const ensureTrailingColumns = (columns: string[][]) => {
    const normalized = (columns.length ? columns : [[''], ['']]).map((column) => ensureTrailing(column));
    return normalized.length >= 2 ? normalized : [...normalized, ['']];
  };
  const ensureTrailingPathRows = (rows: string[][], width: number) => {
    const normalized = rows
      .map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''))
      .filter((row) => row.some((value) => value.trim()) || row === rows[rows.length - 1]);
    if (normalized.length === 0) return [new Array(width).fill('')];
    const last = normalized[normalized.length - 1];
    return last.some((value) => value.trim()) ? [...normalized, new Array(width).fill('')] : normalized;
  };
  const selectionAnswer = Array.isArray(definition.answer) ? definition.answer : [];
  const matchingColumns = ensureTrailingColumns(definition.columns ?? [[''], ['']]);
  const matchingPathRows = ensureTrailingPathRows(definition.matchingPaths ?? [[]], matchingColumns.length);

  return (
    <div className="cogita-library-panel" style={{ display: 'grid', gap: '0.8rem' }}>
      <label className="cogita-field">
        <span>Question type</span>
        <select value={kind} onChange={(event) => setKind(event.target.value as QuestionKind)}>
          <option value="selection">Selection</option>
          <option value="truefalse">{copy.cogita.library.revision.live.trueLabel} / {copy.cogita.library.revision.live.falseLabel}</option>
          <option value="text">Text answer</option>
          <option value="number">Number answer</option>
          <option value="date">Date answer</option>
          <option value="matching">Matching</option>
          <option value="ordering">Right order</option>
        </select>
      </label>
      <label className="cogita-field">
        <span>Title</span>
        <input
          type="text"
          value={definition.title ?? ''}
          onChange={(event) => onDefinitionChange({ ...definition, title: event.target.value })}
          placeholder="Optional title"
        />
      </label>
      <label className="cogita-field">
        <span>Question</span>
        <textarea
          rows={3}
          value={definition.question ?? ''}
          onChange={(event) => onDefinitionChange({ ...definition, question: event.target.value })}
          placeholder="Question text"
        />
      </label>

      {kind === 'selection' ? (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'rgba(184,209,234,0.8)' }}>Options / correct indices</span>
          {ensureTrailing(definition.options ?? ['']).map((option, index, all) => {
            const selected = new Set(selectionAnswer.filter((item): item is number => Number.isInteger(item)));
            const isLast = index === all.length - 1;
            return (
              <div key={`question-option:${index}`} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={selected.has(index)}
                  disabled={!option.trim()}
                  onChange={(event) => {
                    const nextSelected =
                      event.target.checked ? [...selected, index] : [...selected].filter((item) => item !== index);
                    onDefinitionChange({ ...definition, answer: nextSelected });
                  }}
                />
                <input
                  type="text"
                  value={option}
                  placeholder={`Answer ${index + 1}`}
                  onChange={(event) => {
                    const next = [...(definition.options ?? [''])];
                    next[index] = event.target.value;
                    const withTail = ensureTrailing(next);
                    const maxIndex = withTail.length - 1;
                    const nextCorrect = selectionAnswer.filter((item) => item >= 0 && item < maxIndex);
                    onDefinitionChange({ ...definition, options: withTail, answer: nextCorrect });
                  }}
                />
                {!isLast ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      const source = definition.options ?? [''];
                      const next = source.filter((_, itemIndex) => itemIndex !== index);
                      const reindexed = selectionAnswer
                        .filter((item) => item !== index)
                        .map((item) => (item > index ? item - 1 : item));
                      onDefinitionChange({
                        ...definition,
                        options: ensureTrailing(next),
                        answer: reindexed
                      });
                    }}
                  >
                    Remove
                  </button>
                ) : <span />}
              </div>
            );
          })}
        </div>
      ) : null}

      {(kind === 'text' || kind === 'date' || kind === 'number') ? (
        <label className="cogita-field">
          <span>Answer</span>
          <input
            type={kind === 'date' ? 'date' : 'text'}
            value={typeof definition.answer === 'string' || typeof definition.answer === 'number' ? String(definition.answer) : ''}
            onChange={(event) => onDefinitionChange({ ...definition, answer: event.target.value })}
          />
        </label>
      ) : null}

      {kind === 'truefalse' ? (
        <label className="cogita-field">
          <span>Answer</span>
          <select
            value={String(Boolean(definition.answer))}
            onChange={(event) => onDefinitionChange({ ...definition, answer: event.target.value === 'true' })}
          >
            <option value="true">{copy.cogita.library.revision.live.trueLabel}</option>
            <option value="false">{copy.cogita.library.revision.live.falseLabel}</option>
          </select>
        </label>
      ) : null}

      {kind === 'matching' ? (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'rgba(184,209,234,0.8)' }}>Columns</span>
          {matchingColumns.map((column, columnIndex) => (
            <div key={`question-column:${columnIndex}`} style={{ display: 'grid', gap: '0.35rem', border: '1px solid rgba(120,170,220,0.22)', borderRadius: '0.6rem', padding: '0.55rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'rgba(184,209,234,0.85)' }}>Column {columnIndex + 1}</span>
                {matchingColumns.length > 2 ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      const nextColumns = matchingColumns.filter((_, idx) => idx !== columnIndex);
                      const nextRows = matchingPathRows.map((row) => row.filter((_, idx) => idx !== columnIndex));
                      onDefinitionChange({ ...definition, columns: ensureTrailingColumns(nextColumns), matchingPaths: ensureTrailingPathRows(nextRows, Math.max(2, nextColumns.length)) });
                    }}
                  >
                    Remove column
                  </button>
                ) : null}
              </div>
              {column.map((cell, rowIndex) => {
                const isLast = rowIndex === column.length - 1;
                return (
                  <div key={`question-column:${columnIndex}:row:${rowIndex}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.4rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={cell}
                      placeholder={`Option ${rowIndex + 1}`}
                      onChange={(event) => {
                        const nextColumns = matchingColumns.map((items) => [...items]);
                        nextColumns[columnIndex][rowIndex] = event.target.value;
                        onDefinitionChange({ ...definition, columns: ensureTrailingColumns(nextColumns), matchingPaths: ensureTrailingPathRows(matchingPathRows, matchingColumns.length) });
                      }}
                    />
                    {!isLast ? (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          const nextColumns = matchingColumns.map((items) => [...items]);
                          nextColumns[columnIndex] = nextColumns[columnIndex].filter((_, idx) => idx !== rowIndex);
                          onDefinitionChange({ ...definition, columns: ensureTrailingColumns(nextColumns), matchingPaths: ensureTrailingPathRows(matchingPathRows, matchingColumns.length) });
                        }}
                      >
                        Remove
                      </button>
                    ) : <span />}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="cogita-form-actions" style={{ justifyContent: 'flex-start' }}>
            <button
              type="button"
              className="cta ghost"
              onClick={() => {
                const nextColumns = [...matchingColumns.map((column) => [...column]), ['']];
                const nextRows = matchingPathRows.map((row) => [...row, '']);
                onDefinitionChange({ ...definition, columns: ensureTrailingColumns(nextColumns), matchingPaths: ensureTrailingPathRows(nextRows, nextColumns.length) });
              }}
            >
              Add column
            </button>
          </div>

          <span style={{ fontSize: '0.82rem', color: 'rgba(184,209,234,0.8)' }}>Correct paths (0-based indices)</span>
          {matchingPathRows.map((row, rowIndex) => {
            const isLast = rowIndex === matchingPathRows.length - 1;
            return (
              <div key={`question-path:${rowIndex}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${matchingColumns.length}, minmax(0,1fr)) auto`, gap: '0.35rem', alignItems: 'center' }}>
                {row.map((value, columnIndex) => (
                  <input
                    key={`question-path:${rowIndex}:${columnIndex}`}
                    type="number"
                    min={0}
                    step={1}
                    value={value}
                    placeholder={`${columnIndex}`}
                    onChange={(event) => {
                      const nextRows = matchingPathRows.map((items) => [...items]);
                      nextRows[rowIndex][columnIndex] = event.target.value;
                      const normalizedRows = ensureTrailingPathRows(nextRows, matchingColumns.length);
                      const parsedPaths = normalizedRows
                        .map((r) => r.map((cell) => cell.trim()))
                        .filter((r) => r.every((cell) => cell !== ''))
                        .map((r) => r.map((cell) => Number(cell)))
                        .filter((r) => r.every((cell) => Number.isInteger(cell) && cell >= 0));
                      onDefinitionChange({ ...definition, matchingPaths: normalizedRows, answer: { paths: parsedPaths } });
                    }}
                  />
                ))}
                {!isLast ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      const nextRows = matchingPathRows.filter((_, idx) => idx !== rowIndex);
                      const normalizedRows = ensureTrailingPathRows(nextRows, matchingColumns.length);
                      const parsedPaths = normalizedRows
                        .map((r) => r.map((cell) => cell.trim()))
                        .filter((r) => r.every((cell) => cell !== ''))
                        .map((r) => r.map((cell) => Number(cell)))
                        .filter((r) => r.every((cell) => Number.isInteger(cell) && cell >= 0));
                      onDefinitionChange({ ...definition, matchingPaths: normalizedRows, answer: { paths: parsedPaths } });
                    }}
                  >
                    Remove
                  </button>
                ) : <span />}
              </div>
            );
          })}
        </div>
      ) : null}

      {kind === 'ordering' ? (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'rgba(184,209,234,0.8)' }}>Ordered options (correct order = listed order)</span>
          {ensureTrailing(definition.options ?? ['']).map((item, index, all) => {
            const isLast = index === all.length - 1;
            return (
              <div key={`question-order:${index}`} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ color: 'rgba(184,209,234,0.75)', minWidth: '1.5rem' }}>{index + 1}.</span>
                <input
                  type="text"
                  value={item}
                  placeholder={`Step ${index + 1}`}
                  onChange={(event) => {
                    const next = [...(definition.options ?? [''])];
                    next[index] = event.target.value;
                    onDefinitionChange({ ...definition, options: ensureTrailing(next) });
                  }}
                />
                {!isLast ? (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() =>
                      onDefinitionChange({
                        ...definition,
                        options: ensureTrailing((definition.options ?? []).filter((_, itemIndex) => itemIndex !== index))
                      })
                    }
                  >
                    Remove
                  </button>
                ) : <span />}
              </div>
            );
          })}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.82rem', color: 'rgba(184,209,234,0.8)' }}>JSON import</span>
        <textarea
          rows={8}
          value={importJson}
          onChange={(event) => onImportJsonChange(event.target.value)}
          placeholder="Paste question JSON"
        />
        <div className="cogita-form-actions" style={{ justifyContent: 'flex-start' }}>
          <button type="button" className="cta ghost" onClick={onInterpretJson}>
            Interpret JSON
          </button>
          {importQueueLength > 0 ? (
            <span className="cogita-library-hint">
              Queue: {Math.min(importQueueIndex + 1, importQueueLength)} / {importQueueLength}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
