import type { ReactNode } from 'react';
import { LatexBlock, LatexInline } from '../../../../components/LatexText';
import { anchorMaskValueToRgb } from '../../features/revision/compare';

export type LivePrompt = Record<string, unknown> & {
  kind?: string;
  title?: string;
  prompt?: string;
  options?: string[];
  multiple?: boolean;
  inputType?: string;
  multiLine?: boolean;
  columns?: string[][];
  before?: string;
  after?: string;
  cardKey?: string;
  roundIndex?: number;
  firstAnswerAction?: string;
  allAnsweredAction?: string;
  roundTimerEnabled?: boolean;
  roundTimerSeconds?: number;
  roundTimerStartedUtc?: string;
  roundTimerEndsUtc?: string;
  actionTimerEnabled?: boolean;
  actionTimerSeconds?: number;
  actionTimerStartedUtc?: string;
  actionTimerEndsUtc?: string;
  nextQuestionMode?: string;
  nextQuestionSeconds?: number;
  autoNextStartedUtc?: string;
  autoNextEndsUtc?: string;
  sessionTimerEnabled?: boolean;
  sessionTimerSeconds?: number;
  sessionTimerStartedUtc?: string;
  sessionTimerEndsUtc?: string;
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
  answerLabel: '',
  correctAnswerLabel: '',
  trueLabel: '',
  falseLabel: '',
  fragmentLabel: '',
  correctFragmentLabel: '',
  participantAnswerPlaceholder: '',
  unsupportedPromptType: '',
  waitingForReveal: '',
  selectedPaths: '',
  removePath: '',
  columnPrefix: ''
};

export function CogitaLivePromptCard({
  prompt,
  revealExpected,
  revealedAnswer,
  answerDistribution,
  answerMask,
  surfaceState,
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
  revealedAnswer?: unknown;
  answerDistribution?: unknown;
  answerMask?: Uint8Array | null;
  surfaceState?: 'idle' | 'correct' | 'incorrect';
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
  const selectedOnReveal = Array.isArray(revealedAnswer)
    ? revealedAnswer.map((x) => Number(x)).filter(Number.isFinite)
    : answers?.selection ?? [];
  const selectionDistributionByIndex = (() => {
    const result = new Map<number, number>();
    if (!isRevealed || !answerDistribution || typeof answerDistribution !== 'object') return result;
    const root = answerDistribution as Record<string, unknown>;
    if (String(root.kind ?? '') !== 'selection' || !Array.isArray(root.options)) return result;
    root.options.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const option = entry as Record<string, unknown>;
      const index = Number(option.index);
      const percent = Number(option.percent);
      if (Number.isFinite(index) && Number.isFinite(percent)) {
        result.set(index, Math.max(0, Math.min(100, percent)));
      }
    });
    return result;
  })();
  const booleanDistribution = (() => {
    if (!isRevealed || !answerDistribution || typeof answerDistribution !== 'object') return null;
    const root = answerDistribution as Record<string, unknown>;
    if (String(root.kind ?? '') !== 'boolean') return null;
    const truePercent = Number(root.truePercent);
    const falsePercent = Number(root.falsePercent);
    if (!Number.isFinite(truePercent) || !Number.isFinite(falsePercent)) return null;
    return {
      truePercent: Math.max(0, Math.min(100, truePercent)),
      falsePercent: Math.max(0, Math.min(100, falsePercent))
    };
  })();

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

  const renderPromptText = (value: unknown) => <LatexBlock value={String(value ?? '')} mode="auto" />;
  const renderInlineText = (value: unknown) => <LatexInline value={String(value ?? '')} mode="auto" />;

  const wrap = (content: ReactNode) => (
    <div className="cogita-live-card-surface" data-state={surfaceState ?? (isRevealed ? 'correct' : 'idle')}>
      {content}
    </div>
  );

  const parseBooleanValue = (value: unknown): boolean | null => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
      return null;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
      return null;
    }
    if (value && typeof value === 'object') {
      const root = value as Record<string, unknown>;
      return parseBooleanValue(root.booleanAnswer) ?? parseBooleanValue(root.expected) ?? parseBooleanValue(root.value);
    }
    return null;
  };

  const renderMaskedExpected = (expectedText: string) => {
    if (!expectedText) return expectedText;
    if (!answerMask || answerMask.length === 0) return expectedText;
    const chars = expectedText.split('');
    const maskValues = Array.from(answerMask);
    const avg = Math.round(maskValues.reduce((sum, value) => sum + value, 0) / maskValues.length);
    return chars.map((char, index) => {
      const value = Math.max(0, Math.min(255, Math.round(maskValues[index] ?? avg)));
      return (
        <span key={`mask:${index}`} style={{ color: anchorMaskValueToRgb(value) }}>
          {char}
        </span>
      );
    });
  };

  if (kind === 'citation-fragment') {
    const revealedText = typeof revealedAnswer === 'string' ? revealedAnswer : '';
    const expectedText = String(revealExpected ?? '');
    const isSame = revealedText.trim().toLocaleLowerCase() === expectedText.trim().toLocaleLowerCase();
    return wrap(
      <>
        <p>
          <span style={{ opacity: 0.7 }}>{renderInlineText(prompt.before)}</span>
          <strong> [ ... ] </strong>
          <span style={{ opacity: 0.7 }}>{renderInlineText(prompt.after)}</span>
        </p>
        {isRevealed ? (
          <div className="cogita-share-list">
            {typeof revealedAnswer !== 'undefined' ? (
              <div className="cogita-share-row" data-state={isSame ? 'correct' : 'incorrect'}>
                <span>{copy.answerLabel}</span>
                <strong>{revealedText ? renderInlineText(revealedText) : '—'}</strong>
              </div>
            ) : null}
            <div className="cogita-share-row" data-state="correct">
              <span>{copy.correctAnswerLabel}</span>
              <strong>{renderMaskedExpected(expectedText)}</strong>
            </div>
          </div>
        ) : (
          sharedInput('text', answers?.text ?? '', onTextChange)
        )}
      </>
    );
  }

  if (kind === 'text') {
    const revealedText = typeof revealedAnswer === 'string' ? revealedAnswer : '';
    const expectedText = String(revealExpected ?? '');
    const isSame = revealedText.trim().toLocaleLowerCase() === expectedText.trim().toLocaleLowerCase();
    return wrap(
      <>
        {renderPromptText(prompt.prompt)}
        {isRevealed ? (
          <div className="cogita-share-list">
            {typeof revealedAnswer !== 'undefined' ? (
              <div className="cogita-share-row" data-state={isSame ? 'correct' : 'incorrect'}>
                <span>{copy.answerLabel}</span>
                <strong>{revealedText ? renderInlineText(revealedText) : '—'}</strong>
              </div>
            ) : null}
            <div className="cogita-share-row" data-state="correct">
              <span>{copy.correctAnswerLabel}</span>
              <strong>{renderMaskedExpected(expectedText)}</strong>
            </div>
          </div>
        ) : (
          prompt.multiLine ? (
            <label className="cogita-field">
              <span>{copy.answerLabel}</span>
              <textarea
                rows={10}
                value={answers?.text ?? ''}
                onChange={(event) => onTextChange?.(event.target.value)}
                readOnly={mode === 'readonly' || isRevealed}
                placeholder={copy.participantAnswerPlaceholder}
                spellCheck={false}
              />
            </label>
          ) : (
            sharedInput(String(prompt.inputType ?? 'text'), answers?.text ?? '', onTextChange)
          )
        )}
      </>
    );
  }

  if (kind === 'boolean') {
    const expected = parseBooleanValue(revealExpected) ?? false;
    const selected = isRevealed
      ? parseBooleanValue(revealedAnswer)
      : (typeof answers?.booleanAnswer === 'boolean' ? answers.booleanAnswer : null);
    const trueShare = Number(booleanDistribution?.truePercent ?? Number.NaN);
    const falseShare = Number(booleanDistribution?.falsePercent ?? Number.NaN);
    const trueShareAlpha = Number.isFinite(trueShare) ? (0.12 + (Math.max(0, Math.min(100, trueShare)) / 100) * 0.3) : 0;
    const falseShareAlpha = Number.isFinite(falseShare) ? (0.12 + (Math.max(0, Math.min(100, falseShare)) / 100) * 0.3) : 0;
    return wrap(
      <>
        {renderPromptText(prompt.prompt)}
        <div className="cogita-form-actions">
          <button
            type="button"
            className={`cta ghost ${isRevealed && expected ? 'live-correct-answer' : ''} ${isRevealed && selected === true && !expected ? 'live-incorrect-answer' : ''}`}
            data-active={!isRevealed && selected === true ? 'true' : undefined}
            style={isRevealed && Number.isFinite(trueShare)
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(108,194,255,${trueShareAlpha}) 0%, rgba(108,194,255,${trueShareAlpha}) ${Math.max(0, Math.min(100, trueShare))}%, transparent ${Math.max(0, Math.min(100, trueShare))}%, transparent 100%)`
                }
              : undefined}
            onClick={() => onBooleanChange?.(true)}
            disabled={mode === 'readonly' || isRevealed}
          >
            {isRevealed && booleanDistribution ? `${copy.trueLabel} (${booleanDistribution.truePercent.toFixed(1)}%)` : copy.trueLabel}
          </button>
          <button
            type="button"
            className={`cta ghost ${isRevealed && !expected ? 'live-correct-answer' : ''} ${isRevealed && selected === false && expected ? 'live-incorrect-answer' : ''}`}
            data-active={!isRevealed && selected === false ? 'true' : undefined}
            style={isRevealed && Number.isFinite(falseShare)
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(108,194,255,${falseShareAlpha}) 0%, rgba(108,194,255,${falseShareAlpha}) ${Math.max(0, Math.min(100, falseShare))}%, transparent ${Math.max(0, Math.min(100, falseShare))}%, transparent 100%)`
                }
              : undefined}
            onClick={() => onBooleanChange?.(false)}
            disabled={mode === 'readonly' || isRevealed}
          >
            {isRevealed && booleanDistribution ? `${copy.falseLabel} (${booleanDistribution.falsePercent.toFixed(1)}%)` : copy.falseLabel}
          </button>
        </div>
        {isRevealed ? (
          <div className="cogita-share-list">
            {selected != null ? (
              <div className="cogita-share-row" data-state={selected === expected ? 'correct' : 'incorrect'}>
                <span>{copy.answerLabel}</span>
                <strong>{selected ? copy.trueLabel : copy.falseLabel}</strong>
              </div>
            ) : null}
            <div className="cogita-share-row" data-state="correct">
              <span>{copy.correctAnswerLabel}</span>
              <strong>{expected ? copy.trueLabel : copy.falseLabel}</strong>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (kind === 'selection') {
    const options = Array.isArray(prompt.options) ? prompt.options : [];
    const multiple = Boolean(prompt.multiple);
    const selected = answers?.selection ?? [];
    return wrap(
      <>
        {renderPromptText(prompt.prompt)}
        <div className="cogita-share-list">
          {options.map((option, index) => (
            (() => {
              const selectedPercent = isRevealed ? Number(selectionDistributionByIndex.get(index) ?? Number.NaN) : Number.NaN;
              const share = Number.isFinite(selectedPercent) ? Math.max(0, Math.min(100, selectedPercent)) : null;
              const alpha = share == null ? 0 : (0.1 + (share / 100) * 0.28);
              return (
            <label
              className="cogita-share-row"
              data-state={
                isRevealed
                  ? expectedSelection.includes(index)
                    ? 'correct'
                    : selectedOnReveal.includes(index)
                      ? 'incorrect'
                      : undefined
                  : undefined
              }
              key={`${index}-${option}`}
              style={share == null
                ? undefined
                : {
                    backgroundImage: `linear-gradient(90deg, rgba(108,194,255,${alpha}) 0%, rgba(108,194,255,${alpha}) ${share}%, transparent ${share}%, transparent 100%)`
                  }}
            >
              <span>{renderInlineText(option)}</span>
              {isRevealed && selectionDistributionByIndex.has(index) ? (
                <small>{`${selectionDistributionByIndex.get(index)?.toFixed(1)}%`}</small>
              ) : null}
              <input
                type={isRevealed ? 'checkbox' : multiple ? 'checkbox' : 'radio'}
                name="live-selection"
                checked={isRevealed ? expectedSelection.includes(index) || selectedOnReveal.includes(index) : selected.includes(index)}
                onChange={() => onSelectionToggle?.(index)}
                disabled={mode === 'readonly' || isRevealed}
              />
            </label>
              );
            })()
          ))}
        </div>
      </>
    );
  }

  if (kind === 'ordering') {
    const shown = (() => {
      if (isRevealed) {
        if (Array.isArray(revealExpected)) return revealExpected.map(String);
        if (Array.isArray(prompt.options)) return prompt.options.map(String);
        return [];
      }
      if (mode === 'readonly') {
        return Array.isArray(prompt.options) ? prompt.options.map(String) : [];
      }
      return Array.isArray(answers?.ordering) ? answers.ordering.map(String) : [];
    })();
    return wrap(
      <>
        {renderPromptText(prompt.prompt)}
        <div className="cogita-share-list">
          {shown.map((option, index) => (
            <div className="cogita-share-row" data-state={isRevealed ? 'correct' : undefined} key={`${index}-${option}`}>
              <span>{renderInlineText(option)}</span>
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
    const answerPaths = ((revealedAnswer as { paths?: number[][] } | undefined)?.paths ?? answers?.matchingRows ?? [])
      .map((path) => (Array.isArray(path) ? path.map((value) => Number(value)).filter(Number.isFinite) : []))
      .filter((path) => path.length > 0);
    const revealKeySet = new Set(revealPaths.map((path) => path.join('|')));
    const width = Math.max(2, columns.length);
    const activeSelection = Array.from({ length: width }, (_, index) => answers?.matchingSelection[index] ?? null);
    return wrap(
      <>
        {renderPromptText(prompt.prompt)}
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
                  <span>{renderInlineText(option)}</span>
                  <small>{optionIndex}</small>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.65rem' }}>
          <p className="cogita-user-kicker">{copy.selectedPaths}</p>
          {isRevealed ? (
            <>
              {answerPaths.length > 0 ? (
                <div className="cogita-share-list">
                  {answerPaths.map((path, pathIndex) => {
                    const key = path.join('|');
                    return (
                      <div key={`selected-path-${pathIndex}`} className="cogita-share-row" data-state={revealKeySet.has(key) ? 'correct' : 'incorrect'}>
                        <span>{renderInlineText(renderPathLabel(columns, path))}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <div className="cogita-share-list">
                {revealPaths.map((path, pathIndex) => (
                  <div key={`path-${pathIndex}`} className="cogita-share-row" data-state="correct">
                    <span>{renderInlineText(renderPathLabel(columns, path))}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (answers?.matchingRows?.length ?? 0) > 0 ? (
            <div className="cogita-share-list">
              {(answers?.matchingRows ?? []).map((path, pathIndex) => (
                <div key={`path-${pathIndex}`} className="cogita-share-row">
                  <span>{renderInlineText(renderPathLabel(columns, path))}</span>
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
