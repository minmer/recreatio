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
import { clampInt, parseLiveRules } from './liveSessionRules';

function readJoinNameFromHash() {
  if (typeof window === 'undefined') return '';
  const hash = window.location.hash ?? '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex < 0) return '';
  const params = new URLSearchParams(hash.slice(queryIndex + 1));
  return params.get('name')?.trim() ?? '';
}

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
  const factorIcon = (factor: string) => (factor === 'first' ? '⚡' : factor === 'streak' ? '🔥' : factor === 'speed' ? '⏱' : factor === 'wrong' ? '✖' : factor === 'first-wrong' ? '⚠' : '✓');
  const [joinName, setJoinName] = useState(() => readJoinNameFromHash());
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
  const [showScoreOverlay, setShowScoreOverlay] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const prompt = (state?.currentPrompt as LivePrompt | undefined) ?? null;
  const reveal = (state?.currentReveal as Record<string, unknown> | undefined) ?? null;
  const revealExpected = reveal?.expected;
  const liveRules = useMemo(() => parseLiveRules(state?.sessionSettings), [state?.sessionSettings]);
  const sessionStage =
    state?.status === 'finished' || state?.status === 'closed'
      ? 'finished'
      : state?.status && state.status !== 'lobby'
        ? 'active'
        : 'lobby';
  const showJoinPanel = sessionStage === 'lobby' || !participantToken;
  const isFirstLogin = !participantToken;
  const sessionTitle = useMemo(() => {
    const rawTitle = (state as { title?: unknown } | null)?.title;
    if (typeof rawTitle === 'string' && rawTitle.trim()) return rawTitle.trim();
    return liveCopy.joinTitle;
  }, [liveCopy.joinTitle, state]);
  const promptKey = useMemo(
    () => `${state?.currentRoundIndex ?? 0}:${String(prompt?.cardKey ?? '')}`,
    [prompt?.cardKey, state?.currentRoundIndex]
  );
  const promptTimerEndMs = useMemo(() => {
    const raw = typeof prompt?.actionTimerEndsUtc === 'string' ? Date.parse(prompt.actionTimerEndsUtc) : NaN;
    return Number.isFinite(raw) ? raw : null;
  }, [prompt?.actionTimerEndsUtc]);
  const promptTimerTotalSeconds = useMemo(() => {
    const raw = Number(prompt?.actionTimerSeconds ?? 0);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.max(1, Math.min(600, Math.round(raw)));
  }, [prompt?.actionTimerSeconds]);
  const timerRemainingMs = promptTimerEndMs == null ? null : Math.max(0, promptTimerEndMs - nowTick);
  const timerExpired = promptTimerEndMs != null && timerRemainingMs === 0;
  const timerProgress =
    timerRemainingMs == null || promptTimerTotalSeconds <= 0
      ? 0
      : Math.max(0, Math.min(1, timerRemainingMs / (promptTimerTotalSeconds * 1000)));

  useEffect(() => {
    if (sessionStage !== 'active' || promptTimerEndMs == null) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [promptTimerEndMs, sessionStage]);

  useEffect(() => {
    if (showJoinPanel) {
      setShowScoreOverlay(false);
    }
  }, [showJoinPanel]);

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

  const submittedEvaluation = useMemo(() => {
    if (!prompt || typeof revealExpected === 'undefined') return null;
    if (!state?.answerSubmitted) return null;
    const promptKind = String(prompt.kind ?? '');
    if (promptKind === 'selection') {
      return evaluateCheckcardAnswer({
        prompt: { kind: 'selection', options: Array.isArray(prompt.options) ? prompt.options : [] },
        expected: revealExpected,
        answer: { selection: Array.isArray(submittedAnswer) ? submittedAnswer.map((value) => Number(value)).filter(Number.isFinite) : [] }
      });
    }
    if (promptKind === 'boolean') {
      return evaluateCheckcardAnswer({
        prompt: { kind: 'boolean' },
        expected: revealExpected,
        answer: { booleanAnswer: submittedAnswer == null ? null : Boolean(submittedAnswer) }
      });
    }
    if (promptKind === 'ordering') {
      return evaluateCheckcardAnswer({
        prompt: { kind: 'ordering', options: Array.isArray(prompt.options) ? prompt.options : [] },
        expected: revealExpected,
        answer: { ordering: Array.isArray(submittedAnswer) ? submittedAnswer.map(String) : [] }
      });
    }
    if (promptKind === 'matching') {
      const root = (submittedAnswer ?? {}) as { paths?: number[][] };
      return evaluateCheckcardAnswer({
        prompt: { kind: 'matching', columns: Array.isArray(prompt.columns) ? prompt.columns : [] },
        expected: revealExpected,
        answer: { matchingPaths: Array.isArray(root.paths) ? root.paths : [] }
      });
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
    });
  }, [prompt, revealExpected, state?.answerSubmitted, submittedAnswer]);
  const feedbackState = submittedEvaluation ? (submittedEvaluation.correct ? 'correct' : 'incorrect') : null;
  const scoringByParticipant = useMemo(
    () =>
      reveal && typeof reveal === 'object'
        ? ((reveal.roundScoring as Record<string, { points?: number; factors?: string[]; streak?: number }> | undefined) ?? null)
        : null,
    [reveal]
  );
  const selfParticipantId = state?.participantId ?? participantMeta?.participantId ?? null;
  const selfRoundScoring = selfParticipantId && scoringByParticipant ? scoringByParticipant[selfParticipantId] : null;
  const scoreOverlayTitle = sessionStage === 'finished' ? liveCopy.finalScoreTitle : liveCopy.pointsTitle;
  const growthRatio = (mode: string, ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    if (mode === 'exponential') return clamped * clamped;
    if (mode === 'limited') return Math.min(1, clamped * 1.6);
    return clamped;
  };
  const streakBonus = (base: number, streak: number, limit: number, growth: string) => {
    const maxBonus = Math.max(0, base);
    const extraCount = Math.max(0, streak - 1);
    if (maxBonus === 0 || extraCount === 0) return 0;
    const fullAfter = Math.max(1, limit);
    const progress = Math.max(0, Math.min(1, extraCount / fullAfter));
    return clampInt(growthRatio(growth, progress) * maxBonus, 0, 500000);
  };
  const selfRoundBreakdown = useMemo(() => {
    if (!selfRoundScoring) return null;
    const total = Math.round(Number(selfRoundScoring.points ?? 0));
    const factors = new Set((Array.isArray(selfRoundScoring.factors) ? selfRoundScoring.factors : []).map(String));
    const rows: Array<{ key: string; label: string; points: number }> = [];
    if (factors.has('base')) rows.push({ key: 'base', label: liveCopy.factorBaseLabel, points: liveRules.scoring.baseCorrect });
    if (factors.has('first')) rows.push({ key: 'first', label: liveCopy.factorFirstLabel, points: liveRules.scoring.firstCorrectBonus });
    if (factors.has('wrong')) rows.push({ key: 'wrong', label: liveCopy.factorWrongLabel, points: -liveRules.scoring.wrongAnswerPenalty });
    if (factors.has('first-wrong')) rows.push({ key: 'first-wrong', label: liveCopy.factorFirstWrongLabel, points: -liveRules.scoring.firstWrongPenalty });
    if (factors.has('streak')) {
      const streakCount = Math.max(0, Math.round(Number(selfRoundScoring.streak ?? 0)));
      rows.push({
        key: 'streak',
        label: liveCopy.factorStreakLabel,
        points: streakBonus(liveRules.scoring.streakBaseBonus, streakCount, liveRules.scoring.streakLimit, liveRules.scoring.streakGrowth)
      });
    }
    const known = rows.reduce((sum, row) => sum + row.points, 0);
    const speedValue = total - known;
    if (factors.has('speed')) {
      rows.push({ key: 'speed', label: liveCopy.factorSpeedLabel, points: speedValue });
    }
    return { total, rows };
  }, [liveCopy.factorBaseLabel, liveCopy.factorFirstLabel, liveCopy.factorFirstWrongLabel, liveCopy.factorSpeedLabel, liveCopy.factorStreakLabel, liveCopy.factorWrongLabel, liveRules.scoring.baseCorrect, liveRules.scoring.firstCorrectBonus, liveRules.scoring.firstWrongPenalty, liveRules.scoring.streakBaseBonus, liveRules.scoring.streakGrowth, liveRules.scoring.streakLimit, liveRules.scoring.wrongAnswerPenalty, selfRoundScoring]);
  const formatPoints = (value: number) => (value > 0 ? `+${value}` : `${value}`);

  return (
    <CogitaShell {...props}>
      <section className="cogita-library-dashboard cogita-live-layout-shell" data-layout="fullscreen">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div
              className="cogita-library-grid cogita-live-session-layout"
              data-stage={sessionStage}
              data-participant-view={isFirstLogin ? 'login' : 'question'}
            >
              {isFirstLogin ? (
              <div className="cogita-library-panel cogita-live-join-only-panel">
                <h2 className="cogita-detail-title cogita-live-join-only-title">{sessionTitle}</h2>
                <div className="cogita-live-join-only-card">
                  <label className="cogita-field">
                    <span>{liveCopy.participantNameLabel}</span>
                    <input value={joinName} onChange={(event) => setJoinName(event.target.value)} />
                  </label>
                  <div className="cogita-form-actions">
                    <button type="button" className="cta" onClick={handleJoin} disabled={!joinName.trim() || status === 'joining'}>
                      {status === 'joining' ? liveCopy.joiningAction : liveCopy.joinAction}
                    </button>
                  </div>
                  {reloginPending ? <p className="cogita-help">{liveCopy.reloginPendingMessage}</p> : null}
                  {status === 'error' ? <p className="cogita-help">{liveCopy.connectionError}</p> : null}
                </div>
              </div>
              ) : showJoinPanel ? (
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
              {!isFirstLogin ? (
              <div className="cogita-library-panel cogita-live-fullscreen-panel">
                <p className="cogita-user-kicker">{liveCopy.questionTitle}</p>
                <h3 className="cogita-detail-title">{typeof prompt?.title === 'string' ? prompt.title : liveCopy.waitingForPublishedRound}</h3>
                {sessionStage === 'active' && prompt && prompt.actionTimerEnabled && promptTimerEndMs != null ? (
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
                        answerMask={submittedEvaluation?.mask}
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
                    {selfRoundBreakdown ? (
                      <div className="cogita-live-round-gain">
                        <p className="cogita-user-kicker">{liveCopy.roundGainTitle}</p>
                        <p className="cogita-detail-title">{`${formatPoints(selfRoundBreakdown.total)} ${liveCopy.scoreUnit}`}</p>
                        <p className="cogita-help">{liveCopy.roundGainDetailsTitle}</p>
                        <div className="cogita-live-round-gain-list">
                          {selfRoundBreakdown.rows.map((row) => (
                            <div className="cogita-live-round-gain-row" key={`gain:${row.key}`}>
                              <span>{row.label}</span>
                              <strong>{`${formatPoints(row.points)} ${liveCopy.scoreUnit}`}</strong>
                            </div>
                          ))}
                        </div>
                        <div className="cogita-live-factor-badges">
                          {(Array.isArray(selfRoundScoring.factors) ? selfRoundScoring.factors : []).map((factor) => (
                            <span key={`self-factor:${factor}`} className="cogita-live-factor-badge">
                              {factorIcon(factor)}
                            </span>
                          ))}
                        </div>
                        {Number(selfRoundScoring.streak ?? 0) > 1 ? (
                          <p className="cogita-help">{`${liveCopy.streakLabel} ${Math.round(Number(selfRoundScoring.streak ?? 0))}`}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="cogita-help">{liveCopy.waitingForHostQuestion}</p>
                )}
              </div>
              ) : null}
            </div>
            {!showJoinPanel && sessionStage !== 'lobby' ? (
              <div className="cogita-live-score-overlay-toggle">
                <button type="button" className="ghost" onClick={() => setShowScoreOverlay(true)}>
                  {liveCopy.showScoreOverlayAction}
                </button>
              </div>
            ) : null}
            {showScoreOverlay && sessionStage !== 'lobby' ? (
              <div className="cogita-live-score-overlay" onClick={() => setShowScoreOverlay(false)}>
                <div className="cogita-live-score-overlay-card" onClick={(event) => event.stopPropagation()}>
                  <div className="cogita-form-actions" style={{ justifyContent: 'space-between' }}>
                    <p className="cogita-user-kicker">{scoreOverlayTitle}</p>
                    <button type="button" className="ghost" onClick={() => setShowScoreOverlay(false)}>
                      {liveCopy.hideScoreOverlayAction}
                    </button>
                  </div>
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
                            ? ` (${formatPoints(Math.round(Number(scoringByParticipant[row.participantId]?.points ?? 0)))})`
                            : ''}
                        </div>
                      </div>
                    ))}
                    {state && state.scoreboard.length === 0 ? <p className="cogita-help">{liveCopy.noParticipants}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
