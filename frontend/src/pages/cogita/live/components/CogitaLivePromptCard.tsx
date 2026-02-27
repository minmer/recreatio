import type { ReactNode } from 'react';

export type LivePrompt = Record<string, unknown> & {
  kind?: string;
  title?: string;
  prompt?: string;
  options?: string[];
  multiple?: boolean;
  inputType?: string;
  columns?: string[][];
  before?: string;
  after?: string;
  cardKey?: string;
  roundIndex?: number;
};

export type LivePromptAnswers = {
  text: string;
  selection: number[];
  booleanAnswer: boolean | null;
  ordering: string[];
  matchingRows: number[][];
  matchingSelection: Array<number | null>;
};

export type LivePromptLabels = {
  answerLabel: string;
  correctAnswerLabel: string;
  trueLabel: string;
  falseLabel: string;
  fragmentLabel: string;
  correctFragmentLabel: string;
  participantAnswerPlaceholder: string;
  unsupportedPromptType: string;
  waitingForReveal: string;
  selectedPaths: string;
  removePath: string;
  columnPrefix: string;
};

const defaultLabels: LivePromptLabels = {
  answerLabel: 'Answer',
  correctAnswerLabel: 'Correct answer',
  trueLabel: 'True',
  falseLabel: 'False',
  fragmentLabel: 'Fragment',
  correctFragmentLabel: 'Correct fragment',
  participantAnswerPlaceholder: '',
  unsupportedPromptType: 'Unsupported prompt type',
  waitingForReveal: 'Waiting for reveal.',
  selectedPaths: 'Selected paths',
  removePath: 'Remove',
  columnPrefix: 'Column'
};

export function CogitaLivePromptCard({
  prompt,
  revealExpected,
  mode,
  labels,
  answers,
  onTextChange,
  onSelectionToggle,
  onBooleanChange,
  onOrderingMove,
  onMatchingPick,
  onMatchingRemovePath
}: {
  prompt: LivePrompt | null;
  revealExpected?: unknown;
  mode: 'interactive' | 'readonly';
  labels?: Partial<LivePromptLabels>;
  answers?: LivePromptAnswers;
  onTextChange?: (value: string) => void;
  onSelectionToggle?: (index: number) => void;
  onBooleanChange?: (value: boolean) => void;
  onOrderingMove?: (index: number, delta: -1 | 1) => void;
  onMatchingPick?: (columnIndex: number, optionIndex: number) => void;
  onMatchingRemovePath?: (pathIndex: number) => void;
}) {
  if (!prompt) return null;

  const copy = { ...defaultLabels, ...(labels ?? {}) };
  const isRevealed = typeof revealExpected !== 'undefined';
  const kind = String(prompt.kind ?? '');
  const expectedSelection = Array.isArray(revealExpected)
    ? revealExpected.map((x) => Number(x)).filter(Number.isFinite)
    : [];

  const sharedInput = (
    inputType?: string,
    value?: string,
    onChange?: (next: string) => void
  ) => (
    <label className="cogita-field">
      <span>{isRevealed ? copy.correctAnswerLabel : copy.answerLabel}</span>
      <input
        type={inputType === 'number' ? 'number' : inputType === 'date' ? 'date' : 'text'}
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={mode === 'readonly' || isRevealed}
        placeholder={copy.participantAnswerPlaceholder}
      />
    </label>
  );

  const renderPathLabel = (columns: string[][], path: number[]) =>
    path
      .map((selectedIndex, columnIndex) => {
        const col = Array.isArray(columns[columnIndex]) ? columns[columnIndex] : [];
        return `${columnIndex > 0 ? ' -> ' : ''}${String(col[selectedIndex] ?? selectedIndex)}`;
      })
      .join('');

  const wrap = (content: ReactNode) => (
    <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
      {content}
    </div>
  );

  if (kind === 'citation-fragment') {
    return wrap(
      <>
        <p>
          <span style={{ opacity: 0.7 }}>{String(prompt.before ?? '')}</span>
          <strong> [ ... ] </strong>
          <span style={{ opacity: 0.7 }}>{String(prompt.after ?? '')}</span>
        </p>
        {sharedInput('text', isRevealed ? String(revealExpected ?? '') : answers?.text ?? '', onTextChange)}
      </>
    );
  }

  if (kind === 'text') {
    return wrap(
      <>
        <p>{String(prompt.prompt ?? '')}</p>
        {sharedInput(String(prompt.inputType ?? 'text'), isRevealed ? String(revealExpected ?? '') : answers?.text ?? '', onTextChange)}
      </>
    );
  }

  if (kind === 'boolean') {
    const expected = Boolean(revealExpected);
    const selected = answers?.booleanAnswer;
    return wrap(
      <>
        <p>{String(prompt.prompt ?? '')}</p>
        <div className="cogita-form-actions">
          <button
            type="button"
            className={`cta ghost ${isRevealed && expected ? 'live-correct-answer' : ''}`}
            data-active={!isRevealed && selected === true ? 'true' : undefined}
            onClick={() => onBooleanChange?.(true)}
            disabled={mode === 'readonly' || isRevealed}
          >
            {copy.trueLabel}
          </button>
          <button
            type="button"
            className={`cta ghost ${isRevealed && !expected ? 'live-correct-answer' : ''}`}
            data-active={!isRevealed && selected === false ? 'true' : undefined}
            onClick={() => onBooleanChange?.(false)}
            disabled={mode === 'readonly' || isRevealed}
          >
            {copy.falseLabel}
          </button>
        </div>
      </>
    );
  }

  if (kind === 'selection') {
    const options = Array.isArray(prompt.options) ? prompt.options : [];
    const multiple = Boolean(prompt.multiple);
    const selected = answers?.selection ?? [];
    return wrap(
      <>
        <p>{String(prompt.prompt ?? '')}</p>
        <div className="cogita-share-list">
          {options.map((option, index) => (
            <label
              className="cogita-share-row"
              data-state={isRevealed && expectedSelection.includes(index) ? 'correct' : undefined}
              key={`${index}-${option}`}
            >
              <span>{option}</span>
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name="live-selection"
                checked={isRevealed ? expectedSelection.includes(index) : selected.includes(index)}
                onChange={() => onSelectionToggle?.(index)}
                disabled={mode === 'readonly' || isRevealed}
              />
            </label>
          ))}
        </div>
      </>
    );
  }

  if (kind === 'ordering') {
    const shown = Array.isArray(isRevealed ? revealExpected : answers?.ordering)
      ? (isRevealed ? (revealExpected as unknown[]) : (answers?.ordering ?? [])).map(String)
      : [];
    return wrap(
      <>
        <p>{String(prompt.prompt ?? '')}</p>
        <div className="cogita-share-list">
          {shown.map((option, index) => (
            <div className="cogita-share-row" data-state={isRevealed ? 'correct' : undefined} key={`${index}-${option}`}>
              <span>{option}</span>
              <div className="cogita-form-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onOrderingMove?.(index, -1)}
                  disabled={mode === 'readonly' || isRevealed}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onOrderingMove?.(index, 1)}
                  disabled={mode === 'readonly' || isRevealed}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (kind === 'matching') {
    const columns = Array.isArray(prompt.columns) ? prompt.columns : [];
    const revealPaths = (revealExpected as { paths?: number[][] } | undefined)?.paths ?? [];
    const width = Math.max(2, columns.length);
    const activeSelection = Array.from({ length: width }, (_, index) => answers?.matchingSelection[index] ?? null);
    return wrap(
      <>
        <p>{String(prompt.prompt ?? '')}</p>
        <div
          style={{
            display: 'grid',
            gap: '0.65rem',
            gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
            alignItems: 'start'
          }}
        >
          {columns.map((column, columnIndex) => (
            <div key={`live-col:${columnIndex}`} className="cogita-library-panel" style={{ display: 'grid', gap: '0.35rem', padding: '0.6rem' }}>
              <p className="cogita-user-kicker">{`${copy.columnPrefix} ${columnIndex + 1}`}</p>
              {column.map((option, optionIndex) => (
                <button
                  key={`live-col:${columnIndex}:${optionIndex}`}
                  type="button"
                  className="ghost cogita-checkcard-row"
                  style={{ textAlign: 'left' }}
                  data-active={!isRevealed && activeSelection[columnIndex] === optionIndex ? 'true' : undefined}
                  onClick={() => onMatchingPick?.(columnIndex, optionIndex)}
                  disabled={mode === 'readonly' || isRevealed}
                >
                  <span>{option}</span>
                  <small>{optionIndex}</small>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.65rem' }}>
          <p className="cogita-user-kicker">{copy.selectedPaths}</p>
          {isRevealed ? (
            <div className="cogita-share-list">
              {revealPaths.map((path, pathIndex) => (
                <div key={`path-${pathIndex}`} className="cogita-share-row" data-state="correct">
                  <span>{renderPathLabel(columns, path)}</span>
                </div>
              ))}
            </div>
          ) : (answers?.matchingRows?.length ?? 0) > 0 ? (
            <div className="cogita-share-list">
              {(answers?.matchingRows ?? []).map((path, pathIndex) => (
                <div key={`path-${pathIndex}`} className="cogita-share-row">
                  <span>{renderPathLabel(columns, path)}</span>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => onMatchingRemovePath?.(pathIndex)}
                    disabled={mode === 'readonly'}
                  >
                    {copy.removePath}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="cogita-library-hint">{copy.waitingForReveal}</p>
          )}
        </div>
      </>
    );
  }

  return <p className="cogita-help">{copy.unsupportedPromptType}</p>;
}
