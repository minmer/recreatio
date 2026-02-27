import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  createCogitaLiveRevisionReloginRequest,
  getCogitaLiveRevisionPublicState,
  getCogitaLiveRevisionReloginRequest,
  joinCogitaLiveRevision,
  submitCogitaLiveRevisionAnswer,
  type CogitaLiveRevisionPublicState
} from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import { CogitaCheckcardSurface } from '../library/collections/components/CogitaCheckcardSurface';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';

type LivePrompt = Record<string, unknown> & {
  kind?: string;
  title?: string;
  prompt?: string;
  options?: string[];
  multiple?: boolean;
  inputType?: string;
  columns?: string[][];
  before?: string;
  after?: string;
  fragmentId?: string;
  roundIndex?: number;
  cardKey?: string;
};

function tokenStorageKey(code: string) {
  return `cogita.live.join.${code}`;
}

export function CogitaLiveRevisionJoinPage(props: {
  copy: Copy;
  authLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  code: string;
}) {
  const { code } = props;
  const revisionCopy = props.copy.cogita.library.revision;
  const liveCopy = revisionCopy.live;
  const [joinName, setJoinName] = useState('');
  const [participantToken, setParticipantToken] = useState<string | null>(() =>
    typeof localStorage === 'undefined' ? null : localStorage.getItem(tokenStorageKey(code))
  );
  const [state, setState] = useState<CogitaLiveRevisionPublicState | null>(null);
  const [status, setStatus] = useState<'idle' | 'joining' | 'ready' | 'error'>('idle');
  const [textAnswer, setTextAnswer] = useState('');
  const [selectionAnswer, setSelectionAnswer] = useState<number[]>([]);
  const [boolAnswer, setBoolAnswer] = useState<boolean | null>(null);
  const [orderingAnswer, setOrderingAnswer] = useState<string[]>([]);
  const [matchingPaths, setMatchingPaths] = useState<number[][]>([]);
  const [reloginRequestId, setReloginRequestId] = useState<string | null>(null);
  const [reloginPending, setReloginPending] = useState(false);

  const prompt = (state?.currentPrompt as LivePrompt | undefined) ?? null;
  const reveal = (state?.currentReveal as Record<string, unknown> | undefined) ?? null;
  const revealExpected = reveal?.expected;
  const sessionStage = state?.status === 'finished' ? 'finished' : state?.status && state.status !== 'lobby' ? 'active' : 'lobby';
  const promptKey = useMemo(
    () => `${state?.currentRoundIndex ?? 0}:${state?.revealVersion ?? 0}:${String(prompt?.cardKey ?? '')}`,
    [prompt?.cardKey, state?.currentRoundIndex, state?.revealVersion]
  );

  useEffect(() => {
    setTextAnswer('');
    setSelectionAnswer([]);
    setBoolAnswer(null);
    setOrderingAnswer(Array.isArray(prompt?.options) ? [...(prompt.options ?? [])] : []);
    setMatchingPaths([]);
  }, [promptKey]);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const next = await getCogitaLiveRevisionPublicState({ code, participantToken });
        if (!mounted) return;
        setState(next);
        if (participantToken) setStatus('ready');
      } catch {
        if (mounted && status !== 'joining') setStatus('error');
      }
    };
    poll();
    const id = window.setInterval(poll, 1200);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [code, participantToken, status]);

  useEffect(() => {
    if (!reloginRequestId || !reloginPending || participantToken) return;
    let canceled = false;
    const id = window.setInterval(async () => {
      try {
        const request = await getCogitaLiveRevisionReloginRequest({ code, requestId: reloginRequestId });
        if (canceled) return;
        if (request.status === 'approved') {
          setReloginPending(false);
          setStatus('idle');
        }
      } catch {
        // keep polling until approved
      }
    }, 1200);
    return () => {
      canceled = true;
      window.clearInterval(id);
    };
  }, [code, participantToken, reloginPending, reloginRequestId]);

  const handleJoin = async () => {
    setStatus('joining');
    try {
      const joined = await joinCogitaLiveRevision({ code, name: joinName });
      setParticipantToken(joined.participantToken);
      localStorage.setItem(tokenStorageKey(code), joined.participantToken);
      setReloginPending(false);
      setReloginRequestId(null);
      setStatus('ready');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          const relogin = await createCogitaLiveRevisionReloginRequest({ code, name: joinName });
          setReloginRequestId(relogin.requestId);
          setReloginPending(true);
          setStatus('ready');
          return;
        } catch {
          setStatus('error');
          return;
        }
      }
      setStatus('error');
    }
  };

  const toggleSelection = (index: number) => {
    const multiple = Boolean(prompt?.multiple);
    if (multiple) {
      setSelectionAnswer((prev) => (prev.includes(index) ? prev.filter((x) => x !== index) : [...prev, index].sort((a, b) => a - b)));
      return;
    }
    setSelectionAnswer([index]);
  };

  const moveOrdering = (index: number, delta: -1 | 1) => {
    setOrderingAnswer((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addMatchingPath = () => {
    const columns = Array.isArray(prompt?.columns) ? prompt.columns : [];
    setMatchingPaths((prev) => [...prev, columns.map(() => 0)]);
  };

  const updateMatchingPath = (rowIndex: number, columnIndex: number, value: number) => {
    setMatchingPaths((prev) =>
      prev.map((row, ri) => (ri !== rowIndex ? row : row.map((current, ci) => (ci === columnIndex ? value : current))))
    );
  };

  const submitAnswer = async () => {
    if (!participantToken || !prompt || typeof prompt.cardKey !== 'string') return;

    let answer: unknown = null;
    switch (prompt.kind) {
      case 'selection':
        answer = selectionAnswer;
        break;
      case 'boolean':
        answer = boolAnswer;
        break;
      case 'ordering':
        answer = orderingAnswer;
        break;
      case 'matching':
        answer = { paths: matchingPaths };
        break;
      case 'citation-fragment':
      case 'text':
      default:
        answer = textAnswer;
        break;
    }

    try {
      await submitCogitaLiveRevisionAnswer({
        code,
        participantToken,
        roundIndex: Number(prompt.roundIndex ?? state?.currentRoundIndex ?? 0),
        cardKey: prompt.cardKey,
        answer
      });
      const refreshed = await getCogitaLiveRevisionPublicState({ code, participantToken });
      setState(refreshed);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  const renderPromptCard = () => {
    if (!prompt) {
      return <p className="cogita-help">{liveCopy.waitingForHostQuestion}</p>;
    }
    const isRevealed = Boolean(reveal);
    const selectionExpected = Array.isArray(revealExpected)
      ? revealExpected.map((x) => Number(x)).filter(Number.isFinite)
      : [];

    if (prompt.kind === 'citation-fragment') {
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>
            <span style={{ opacity: 0.7 }}>{String(prompt.before ?? '')}</span>
            <strong> [ ... ] </strong>
            <span style={{ opacity: 0.7 }}>{String(prompt.after ?? '')}</span>
          </p>
          <label className="cogita-field">
            <span>{isRevealed ? liveCopy.correctFragmentLabel : liveCopy.fragmentLabel}</span>
            <input
              value={isRevealed ? String(revealExpected ?? '') : textAnswer}
              onChange={(event) => setTextAnswer(event.target.value)}
              readOnly={isRevealed}
            />
          </label>
        </div>
      );
    }

    if (prompt.kind === 'text') {
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          <label className="cogita-field">
            <span>{isRevealed ? revisionCopy.correctAnswerLabel : revisionCopy.answerLabel}</span>
            <input
              type={prompt.inputType === 'number' ? 'number' : prompt.inputType === 'date' ? 'date' : 'text'}
              value={isRevealed ? String(revealExpected ?? '') : textAnswer}
              onChange={(event) => setTextAnswer(event.target.value)}
              readOnly={isRevealed}
            />
          </label>
        </div>
      );
    }

    if (prompt.kind === 'boolean') {
      const expected = Boolean(revealExpected);
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          <div className="cogita-form-actions">
            <button type="button" className={`cta ghost ${isRevealed && expected ? 'live-correct-answer' : ''}`} onClick={() => setBoolAnswer(true)} disabled={isRevealed}>{liveCopy.trueLabel}</button>
            <button type="button" className={`cta ghost ${isRevealed && !expected ? 'live-correct-answer' : ''}`} onClick={() => setBoolAnswer(false)} disabled={isRevealed}>{liveCopy.falseLabel}</button>
          </div>
        </div>
      );
    }

    if (prompt.kind === 'selection') {
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          <div className="cogita-share-list">
            {(Array.isArray(prompt.options) ? prompt.options : []).map((option, index) => (
              <label
                className="cogita-share-row"
                data-state={isRevealed && selectionExpected.includes(index) ? 'correct' : undefined}
                key={`${index}-${option}`}
              >
                <span>{option}</span>
                <input
                  type={prompt.multiple ? 'checkbox' : 'radio'}
                  name="live-selection"
                  checked={isRevealed ? selectionExpected.includes(index) : selectionAnswer.includes(index)}
                  onChange={() => toggleSelection(index)}
                  disabled={isRevealed}
                />
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (prompt.kind === 'ordering') {
      const shown = Array.isArray(isRevealed ? revealExpected : orderingAnswer)
        ? (isRevealed ? (revealExpected as unknown[]) : orderingAnswer).map(String)
        : [];
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          <div className="cogita-share-list">
            {shown.map((option, index) => (
              <div className="cogita-share-row" data-state={isRevealed ? 'correct' : undefined} key={`${index}-${option}`}>
                <span>{option}</span>
                <div className="cogita-form-actions">
                  <button type="button" className="ghost" onClick={() => moveOrdering(index, -1)} disabled={isRevealed}>↑</button>
                  <button type="button" className="ghost" onClick={() => moveOrdering(index, 1)} disabled={isRevealed}>↓</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (prompt.kind === 'matching') {
      const columns = Array.isArray(prompt.columns) ? prompt.columns : [];
      const revealPaths = (revealExpected as { paths?: number[][] } | undefined)?.paths ?? [];
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          {isRevealed ? (
            <div className="cogita-share-list">
              {revealPaths.map((path, pathIndex) => (
                <div key={`path-${pathIndex}`} className="cogita-share-row" data-state="correct">
                  <span>
                    {path.map((selectedIndex, columnIndex) => {
                      const col = Array.isArray(columns[columnIndex]) ? columns[columnIndex] : [];
                      return `${columnIndex > 0 ? ' → ' : ''}${String(col[selectedIndex] ?? selectedIndex)}`;
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="cogita-form-actions">
                <button type="button" className="cta ghost" onClick={addMatchingPath}>{liveCopy.addPathAction}</button>
              </div>
              {matchingPaths.map((row, rowIndex) => (
                <div className="cogita-form-actions" key={`path-${rowIndex}`}>
                  {columns.map((column, columnIndex) => (
                    <select
                      key={`path-${rowIndex}-col-${columnIndex}`}
                      value={row[columnIndex] ?? 0}
                      onChange={(event) => updateMatchingPath(rowIndex, columnIndex, Number(event.target.value))}
                    >
                      {column.map((option, optionIndex) => (
                        <option key={`${columnIndex}-${optionIndex}`} value={optionIndex}>
                          {optionIndex}: {option}
                        </option>
                      ))}
                    </select>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      );
    }

    return <p className="cogita-help">{liveCopy.unsupportedPromptType}</p>;
  };

  return (
    <CogitaShell {...props}>
      <section className="cogita-library-dashboard">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid cogita-live-session-layout" data-stage={sessionStage}>
              <div className="cogita-library-panel">
                <p className="cogita-user-kicker">{liveCopy.joinKicker}</p>
                <h2 className="cogita-detail-title">{liveCopy.joinTitle}</h2>
                {!participantToken ? (
                  <>
                    <label className="cogita-field">
                      <span>{liveCopy.participantNameLabel}</span>
                      <input value={joinName} onChange={(event) => setJoinName(event.target.value)} />
                    </label>
                    <div className="cogita-form-actions">
                      <button type="button" className="cta" onClick={handleJoin} disabled={!joinName.trim() || status === 'joining'}>
                        {status === 'joining' ? liveCopy.joiningAction : liveCopy.joinAction}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="cogita-help">{liveCopy.joinedWaiting}</p>
                )}
                {reloginPending ? (
                  <p className="cogita-help">Relogin request sent. Wait for host approval and join again.</p>
                ) : null}
                {status === 'error' ? <p className="cogita-help">{liveCopy.connectionError}</p> : null}
                {sessionStage === 'lobby' ? (
                  <>
                    <p className="cogita-user-kicker">{liveCopy.scoreboardTitle}</p>
                    <div className="cogita-share-list">
                      {state?.scoreboard.map((row) => (
                        <div className="cogita-share-row" key={row.participantId}>
                          <div><strong>{row.displayName}</strong></div>
                          <div className="cogita-share-meta">{row.score} {liveCopy.scoreUnit}</div>
                        </div>
                      ))}
                      {state && state.scoreboard.length === 0 ? <p className="cogita-help">{liveCopy.noParticipants}</p> : null}
                    </div>
                  </>
                ) : null}
              </div>
              <div className="cogita-library-panel">
                <p className="cogita-user-kicker">{liveCopy.questionTitle}</p>
                <h3 className="cogita-detail-title">{typeof prompt?.title === 'string' ? prompt.title : liveCopy.waitingForPublishedRound}</h3>
                {prompt ? (
                  <>
                    <CogitaCheckcardSurface
                      className="cogita-live-card-container"
                      feedbackToken={reveal ? `correct-${state?.revealVersion ?? 0}` : 'idle'}
                    >
                      {renderPromptCard()}
                    </CogitaCheckcardSurface>
                    <div className="cogita-form-actions">
                      <button
                        type="button"
                        className="cta"
                        onClick={submitAnswer}
                        disabled={!participantToken || !prompt.cardKey || state?.answerSubmitted}
                      >
                        {state?.answerSubmitted ? liveCopy.submitted : liveCopy.submitAnswer}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="cogita-help">{liveCopy.waitingForHostQuestion}</p>
                )}
              </div>
              {sessionStage !== 'lobby' ? (
                <div className="cogita-library-panel cogita-live-scoreboard-panel">
                  <p className="cogita-user-kicker">{sessionStage === 'finished' ? liveCopy.finalScoreTitle : liveCopy.pointsTitle}</p>
                  <div className="cogita-share-list">
                    {state?.scoreboard.map((row) => (
                      <div className="cogita-share-row" key={`score:${row.participantId}`}>
                        <div><strong>{row.displayName}</strong></div>
                        <div className="cogita-share-meta">{row.score} {liveCopy.scoreUnit}</div>
                      </div>
                    ))}
                    {state && state.scoreboard.length === 0 ? <p className="cogita-help">{liveCopy.noParticipants}</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
