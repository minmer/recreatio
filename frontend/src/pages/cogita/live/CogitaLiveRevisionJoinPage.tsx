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
import { CogitaLivePromptCard, type LivePrompt } from './components/CogitaLivePromptCard';
import { evaluateCheckcardAnswer } from '../library/checkcards/checkcardRuntime';

function tokenStorageKey(code: string) {
  return `cogita.live.join.${code}`;
}

function participantMetaStorageKey(code: string) {
  return `cogita.live.join.meta.${code}`;
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
  const factorIcon = (factor: string) => (factor === 'first' ? '⚡' : factor === 'streak' ? '🔥' : factor === 'speed' ? '⏱' : '✓');
  const [joinName, setJoinName] = useState('');
  const [participantToken, setParticipantToken] = useState<string | null>(() =>
    typeof localStorage === 'undefined' ? null : localStorage.getItem(tokenStorageKey(code))
  );
  const [participantMeta, setParticipantMeta] = useState<{ participantId?: string; name?: string } | null>(() => {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(participantMetaStorageKey(code));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { participantId?: string; name?: string };
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  });
  const [state, setState] = useState<CogitaLiveRevisionPublicState | null>(null);
  const [status, setStatus] = useState<'idle' | 'joining' | 'ready' | 'error'>('idle');
  const [textAnswer, setTextAnswer] = useState('');
  const [selectionAnswer, setSelectionAnswer] = useState<number[]>([]);
  const [boolAnswer, setBoolAnswer] = useState<boolean | null>(null);
  const [orderingAnswer, setOrderingAnswer] = useState<string[]>([]);
  const [matchingRows, setMatchingRows] = useState<number[][]>([]);
  const [matchingSelection, setMatchingSelection] = useState<Array<number | null>>([]);
  const [reloginRequestId, setReloginRequestId] = useState<string | null>(null);
  const [reloginPending, setReloginPending] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'window' | 'fullscreen'>('fullscreen');
  const [localViewMode, setLocalViewMode] = useState<'follow-host' | 'question' | 'score'>('follow-host');
  const [nowTick, setNowTick] = useState(() => Date.now());

  const prompt = (state?.currentPrompt as LivePrompt | undefined) ?? null;
  const reveal = (state?.currentReveal as Record<string, unknown> | undefined) ?? null;
  const revealExpected = reveal?.expected;
  const sessionStage =
    state?.status === 'finished' || state?.status === 'closed'
      ? 'finished'
      : state?.status && state.status !== 'lobby'
        ? 'active'
        : 'lobby';
  const participantViewMode = state?.participantViewMode ?? 'question';
  const effectiveViewMode =
    localViewMode === 'follow-host'
      ? (participantViewMode === 'score' ? 'score' : 'question')
      : localViewMode;
  const showJoinPanel = sessionStage === 'lobby' || !participantToken;
  const showQuestionPanel = effectiveViewMode !== 'score';
  const showScorePanel = effectiveViewMode !== 'question' || sessionStage === 'finished';
  const promptKey = useMemo(
    () => `${state?.currentRoundIndex ?? 0}:${String(prompt?.cardKey ?? '')}`,
    [prompt?.cardKey, state?.currentRoundIndex]
  );
  const promptTimerEndMs = useMemo(() => {
    const raw = typeof prompt?.timerEndsUtc === 'string' ? Date.parse(prompt.timerEndsUtc) : NaN;
    return Number.isFinite(raw) ? raw : null;
  }, [prompt?.timerEndsUtc]);
  const promptTimerTotalSeconds = useMemo(() => {
    const raw = Number(prompt?.timerSeconds ?? 0);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.max(1, Math.min(600, Math.round(raw)));
  }, [prompt?.timerSeconds]);
  const timerRemainingMs = promptTimerEndMs == null ? null : Math.max(0, promptTimerEndMs - nowTick);
  const timerExpired = promptTimerEndMs != null && timerRemainingMs === 0;
  const timerProgress =
    timerRemainingMs == null || promptTimerTotalSeconds <= 0
      ? 0
      : Math.max(0, Math.min(1, timerRemainingMs / (promptTimerTotalSeconds * 1000)));

  useEffect(() => {
    if (participantViewMode === 'fullscreen' && sessionStage !== 'lobby') {
      setLayoutMode('fullscreen');
    }
  }, [participantViewMode, sessionStage]);

  useEffect(() => {
    if (sessionStage !== 'active' || promptTimerEndMs == null) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [promptTimerEndMs, sessionStage]);

  useEffect(() => {
    setTextAnswer('');
    setSelectionAnswer([]);
    setBoolAnswer(null);
    setOrderingAnswer(Array.isArray(prompt?.options) ? [...(prompt.options ?? [])] : []);
    const matchingWidth = Array.isArray(prompt?.columns) ? Math.max(2, prompt.columns.length) : 0;
    setMatchingRows([]);
    setMatchingSelection(matchingWidth > 0 ? new Array(matchingWidth).fill(null) : []);
  }, [promptKey]);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const next = await getCogitaLiveRevisionPublicState({ code, participantToken });
        if (!mounted) return;
        setState(next);
        if (next.participantId || next.participantName) {
          const meta = {
            participantId: next.participantId ?? undefined,
            name: next.participantName ?? undefined
          };
          setParticipantMeta(meta);
          localStorage.setItem(participantMetaStorageKey(code), JSON.stringify(meta));
        }
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
      const meta = { participantId: joined.participantId, name: joined.name };
      setParticipantMeta(meta);
      localStorage.setItem(participantMetaStorageKey(code), JSON.stringify(meta));
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

  const handleMatchingPick = (columnIndex: number, optionIndex: number) => {
    const columns = Array.isArray(prompt?.columns) ? prompt.columns : [];
    const width = Math.max(2, columns.length);
    setMatchingSelection((prev) => {
      const next = Array.from({ length: width }, (_, index) => prev[index] ?? null);
      next[columnIndex] = next[columnIndex] === optionIndex ? null : optionIndex;
      if (next.some((value) => value == null)) {
        return next;
      }
      const completed = next.map((value) => Number(value));
      setMatchingRows((existing) => [...existing, completed]);
      return new Array(width).fill(null);
    });
  };

  const submitAnswer = async () => {
    if (!participantToken || !prompt || typeof prompt.cardKey !== 'string') return;
    if (timerExpired && promptTimerEndMs != null) return;

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
        answer = { paths: matchingRows };
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

  const submittedAnswer = useMemo(() => {
    if (!prompt) return null;
    switch (prompt.kind) {
      case 'selection':
        return selectionAnswer;
      case 'boolean':
        return boolAnswer;
      case 'ordering':
        return orderingAnswer;
      case 'matching':
        return { paths: matchingRows };
      case 'citation-fragment':
      case 'text':
      default:
        return textAnswer;
    }
  }, [boolAnswer, matchingRows, orderingAnswer, prompt, selectionAnswer, textAnswer]);

  const feedbackState = useMemo<'correct' | 'incorrect' | null>(() => {
    if (!prompt || typeof revealExpected === 'undefined') return null;
    if (!state?.answerSubmitted) return null;
    const promptKind = String(prompt.kind ?? '');
    if (promptKind === 'selection') {
      return evaluateCheckcardAnswer({
        prompt: { kind: 'selection', options: Array.isArray(prompt.options) ? prompt.options : [] },
        expected: revealExpected,
        answer: { selection: Array.isArray(submittedAnswer) ? submittedAnswer.map((value) => Number(value)).filter(Number.isFinite) : [] }
      }).correct ? 'correct' : 'incorrect';
    }
    if (promptKind === 'boolean') {
      return evaluateCheckcardAnswer({
        prompt: { kind: 'boolean' },
        expected: revealExpected,
        answer: { booleanAnswer: submittedAnswer == null ? null : Boolean(submittedAnswer) }
      }).correct ? 'correct' : 'incorrect';
    }
    if (promptKind === 'ordering') {
      return evaluateCheckcardAnswer({
        prompt: { kind: 'ordering', options: Array.isArray(prompt.options) ? prompt.options : [] },
        expected: revealExpected,
        answer: { ordering: Array.isArray(submittedAnswer) ? submittedAnswer.map(String) : [] }
      }).correct ? 'correct' : 'incorrect';
    }
    if (promptKind === 'matching') {
      const root = (submittedAnswer ?? {}) as { paths?: number[][] };
      return evaluateCheckcardAnswer({
        prompt: { kind: 'matching', columns: Array.isArray(prompt.columns) ? prompt.columns : [] },
        expected: revealExpected,
        answer: { matchingPaths: Array.isArray(root.paths) ? root.paths : [] }
      }).correct ? 'correct' : 'incorrect';
    }
    return evaluateCheckcardAnswer({
      prompt: {
        kind: promptKind === 'citation-fragment' ? 'citation-fragment' : 'text',
        inputType:
          promptKind === 'text' && prompt.inputType === 'number'
            ? 'number'
            : promptKind === 'text' && prompt.inputType === 'date'
              ? 'date'
              : 'text'
      },
      expected: revealExpected,
      answer: { text: String(submittedAnswer ?? '') }
    }).correct ? 'correct' : 'incorrect';
  }, [prompt, revealExpected, state?.answerSubmitted, submittedAnswer]);
  const scoringByParticipant = useMemo(
    () =>
      reveal && typeof reveal === 'object'
        ? ((reveal.roundScoring as Record<string, { points?: number; factors?: string[]; streak?: number }> | undefined) ?? null)
        : null,
    [reveal]
  );
  const selfParticipantId = state?.participantId ?? participantMeta?.participantId ?? null;
  const selfRoundScoring = selfParticipantId && scoringByParticipant ? scoringByParticipant[selfParticipantId] : null;

  return (
    <CogitaShell {...props}>
      <section className="cogita-library-dashboard cogita-live-layout-shell" data-layout={layoutMode}>
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            {(participantToken || sessionStage !== 'lobby') ? (
              <div className="cogita-live-layout-controls cogita-live-layout-controls--global">
                <label className="cogita-field">
                  <span>{liveCopy.participantViewModeLabel}</span>
                  <select value={localViewMode} onChange={(event) => setLocalViewMode(event.target.value as 'follow-host' | 'question' | 'score')}>
                    <option value="follow-host">{liveCopy.participantViewFollowHost}</option>
                    <option value="question">{liveCopy.participantViewQuestion}</option>
                    <option value="score">{liveCopy.participantViewScore}</option>
                  </select>
                </label>
                <label className="cogita-field">
                  <span>{liveCopy.viewModeLabel}</span>
                  <select value={layoutMode} onChange={(event) => setLayoutMode(event.target.value as 'window' | 'fullscreen')}>
                    <option value="fullscreen">{liveCopy.viewModeFullscreen}</option>
                    <option value="window">{liveCopy.viewModeWindow}</option>
                  </select>
                </label>
              </div>
            ) : null}
            <div
              className="cogita-library-grid cogita-live-session-layout"
              data-stage={sessionStage}
              data-participant-view={effectiveViewMode}
            >
              {showJoinPanel ? (
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
                  <p className="cogita-help">{liveCopy.reloginPendingMessage}</p>
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
              ) : null}
              {showQuestionPanel ? (
              <div className={`cogita-library-panel ${participantViewMode === 'fullscreen' ? 'cogita-live-fullscreen-panel' : ''}`}>
                <p className="cogita-user-kicker">{liveCopy.questionTitle}</p>
                <h3 className="cogita-detail-title">{typeof prompt?.title === 'string' ? prompt.title : liveCopy.waitingForPublishedRound}</h3>
                {sessionStage === 'active' && prompt && prompt.timerEnabled && promptTimerEndMs != null ? (
                  <div className="cogita-live-timer">
                    <div className="cogita-live-timer-head">
                      <span>{liveCopy.timerLabel}</span>
                      <strong>{`${Math.max(0, Math.ceil((timerRemainingMs ?? 0) / 1000))}s`}</strong>
                    </div>
                    <div className="cogita-live-timer-track">
                      <span style={{ width: `${Math.round(timerProgress * 100)}%` }} />
                    </div>
                  </div>
                ) : null}
                {prompt ? (
                  <>
                    <CogitaCheckcardSurface
                      className="cogita-live-card-container"
                      feedbackToken={
                        reveal
                          ? feedbackState
                            ? `${feedbackState}-${state?.revealVersion ?? 0}`
                            : `idle-${state?.revealVersion ?? 0}`
                          : 'idle'
                      }
                    >
                      <CogitaLivePromptCard
                        prompt={prompt}
                        revealExpected={revealExpected}
                        revealedAnswer={state?.answerSubmitted ? submittedAnswer : undefined}
                        surfaceState={feedbackState ?? undefined}
                        mode={state?.answerSubmitted || !participantToken ? 'readonly' : 'interactive'}
                        labels={{
                          answerLabel: revisionCopy.answerLabel,
                          correctAnswerLabel: revisionCopy.correctAnswerLabel,
                          trueLabel: liveCopy.trueLabel,
                          falseLabel: liveCopy.falseLabel,
                          fragmentLabel: liveCopy.fragmentLabel,
                          correctFragmentLabel: liveCopy.correctFragmentLabel,
                          participantAnswerPlaceholder: liveCopy.participantAnswerPlaceholder,
                          unsupportedPromptType: liveCopy.unsupportedPromptType,
                          waitingForReveal: liveCopy.waitingForRevealLabel,
                          selectedPaths: liveCopy.selectedPathsLabel,
                          removePath: liveCopy.removePathAction,
                          columnPrefix: liveCopy.columnPrefixLabel
                        }}
                        answers={{
                          text: textAnswer,
                          selection: selectionAnswer,
                          booleanAnswer: boolAnswer,
                          ordering: orderingAnswer,
                          matchingRows,
                          matchingSelection
                        }}
                        onTextChange={setTextAnswer}
                        onSelectionToggle={toggleSelection}
                        onBooleanChange={setBoolAnswer}
                        onOrderingMove={moveOrdering}
                        onMatchingPick={handleMatchingPick}
                        onMatchingRemovePath={(pathIndex) =>
                          setMatchingRows((prev) => prev.filter((_, idx) => idx !== pathIndex))
                        }
                      />
                    </CogitaCheckcardSurface>
                    <div className="cogita-form-actions">
                      <button
                        type="button"
                        className="cta"
                        onClick={submitAnswer}
                        disabled={!participantToken || !prompt.cardKey || state?.answerSubmitted || timerExpired}
                      >
                        {state?.answerSubmitted ? liveCopy.submitted : liveCopy.submitAnswer}
                      </button>
                    </div>
                    {timerExpired ? <p className="cogita-help">{liveCopy.timeExpired}</p> : null}
                    {selfRoundScoring ? (
                      <div className="cogita-live-round-gain">
                        <p className="cogita-user-kicker">{liveCopy.roundGainTitle}</p>
                        <p className="cogita-detail-title">{`+${Math.max(0, Number(selfRoundScoring.points ?? 0))} ${liveCopy.scoreUnit}`}</p>
                        <div className="cogita-live-factor-badges">
                          {(Array.isArray(selfRoundScoring.factors) ? selfRoundScoring.factors : []).map((factor) => (
                            <span key={`self-factor:${factor}`} className="cogita-live-factor-badge">
                              {factorIcon(factor)}
                            </span>
                          ))}
                        </div>
                        {Number(selfRoundScoring.streak ?? 0) > 1 ? (
                          <p className="cogita-help">{`${liveCopy.streakLabel}: ${Math.round(Number(selfRoundScoring.streak ?? 0))}`}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="cogita-help">{liveCopy.waitingForHostQuestion}</p>
                )}
              </div>
              ) : null}
              {sessionStage !== 'lobby' && showScorePanel ? (
                <div className="cogita-library-panel cogita-live-scoreboard-panel">
                  <p className="cogita-user-kicker">{sessionStage === 'finished' ? liveCopy.finalScoreTitle : liveCopy.pointsTitle}</p>
                  <p className="cogita-help">{liveCopy.symbolsLegend}</p>
                  <div className="cogita-share-list">
                    {state?.scoreboard.map((row) => (
                      <div className="cogita-share-row" key={`score:${row.participantId}`}>
                        <div>
                          <strong>{row.displayName}</strong>
                          {(scoringByParticipant?.[row.participantId]?.factors ?? []).length > 0 ? (
                            <div className="cogita-live-factor-badges">
                              {(scoringByParticipant?.[row.participantId]?.factors ?? []).map((factor) => (
                                <span key={`score-factor:${row.participantId}:${factor}`} className="cogita-live-factor-badge">
                                  {factorIcon(factor)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="cogita-share-meta">
                          {row.score} {liveCopy.scoreUnit}
                          {scoringByParticipant?.[row.participantId]?.points
                            ? ` (+${Math.max(0, Number(scoringByParticipant[row.participantId]?.points ?? 0))})`
                            : ''}
                        </div>
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
