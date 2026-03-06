import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getCogitaLiveRevisionPublicState,
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
import { buildLiveSessionSummaryLines } from './liveSessionDescription';
import { useScreenWakeLock } from './useScreenWakeLock';

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

function introSeenStorageKey(code: string, participantRef: string) {
  return `cogita.live.join.intro.${code}.${participantRef}`;
}

function participantResetLabel(language: 'pl' | 'en' | 'de') {
  if (language === 'pl') return 'Wyczyść zapisane dane uczestnika';
  if (language === 'de') return 'Gespeicherte Teilnehmerdaten löschen';
  return 'Clear saved participant data';
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
  useScreenWakeLock(true);

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
  const [showScoreOverlay, setShowScoreOverlay] = useState(false);
  const [introAcknowledged, setIntroAcknowledged] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [scoreFxByParticipant, setScoreFxByParticipant] = useState<Record<string, { delta: number; rankShift: number; token: number }>>({});
  const prevScoresRef = useRef<Map<string, number>>(new Map());
  const prevRanksRef = useRef<Map<string, number>>(new Map());

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
  const hasStoredTokenMismatch = Boolean(participantToken && state && !state.participantId);
  const sessionTitle = useMemo(() => {
    const rawTitle = (state as { title?: unknown } | null)?.title;
    if (typeof rawTitle === 'string' && rawTitle.trim()) return rawTitle.trim();
    return liveCopy.joinTitle;
  }, [liveCopy.joinTitle, state]);
  const participantRef = state?.participantId ?? participantMeta?.participantId ?? participantToken ?? '';
  const sessionDescriptionLines = useMemo(
    () =>
      buildLiveSessionSummaryLines({
        liveCopy,
        rules: liveRules,
        sessionMode: state?.sessionMode === 'asynchronous' ? 'asynchronous' : 'simultaneous'
      }),
    [liveCopy, liveRules, state?.sessionMode]
  );
  const promptKey = useMemo(
    () => `${state?.currentRoundIndex ?? 0}:${String(prompt?.cardKey ?? '')}`,
    [prompt?.cardKey, state?.currentRoundIndex]
  );
  const effectiveQuestionTimer = useMemo(() => {
    if (state?.status !== 'running') return null;
    if (reveal) return null;
    const actionTimerRelevant =
      typeof prompt?.firstAnswerAction === 'string'
        ? prompt.firstAnswerAction === 'start_timer'
        : true;
    const timers: Array<{ endsMs: number; totalSeconds: number }> = [];
    if (prompt?.roundTimerEnabled && typeof prompt.roundTimerEndsUtc === 'string') {
      const endsMs = Date.parse(prompt.roundTimerEndsUtc);
      const rawSeconds = Number(prompt.roundTimerSeconds ?? 0);
      const totalSeconds = Number.isFinite(rawSeconds) && rawSeconds > 0 ? Math.max(1, Math.min(1200, Math.round(rawSeconds))) : 0;
      if (Number.isFinite(endsMs) && totalSeconds > 0) {
        timers.push({ endsMs, totalSeconds });
      }
    }
    if (actionTimerRelevant && prompt?.actionTimerEnabled && typeof prompt.actionTimerEndsUtc === 'string') {
      const endsMs = Date.parse(prompt.actionTimerEndsUtc);
      const rawSeconds = Number(prompt.actionTimerSeconds ?? 0);
      const totalSeconds = Number.isFinite(rawSeconds) && rawSeconds > 0 ? Math.max(1, Math.min(600, Math.round(rawSeconds))) : 0;
      if (Number.isFinite(endsMs) && totalSeconds > 0) {
        timers.push({ endsMs, totalSeconds });
      }
    }
    if (timers.length === 0) return null;
    return timers.sort((a, b) => a.endsMs - b.endsMs)[0];
  }, [
    reveal,
    prompt?.firstAnswerAction,
    prompt?.actionTimerEnabled,
    prompt?.actionTimerEndsUtc,
    prompt?.actionTimerSeconds,
    prompt?.roundTimerEnabled,
    prompt?.roundTimerEndsUtc,
    prompt?.roundTimerSeconds,
    state?.status
  ]);
  const timerRemainingMs =
    effectiveQuestionTimer == null ? null : Math.max(0, effectiveQuestionTimer.endsMs - nowTick);
  const timerExpired = effectiveQuestionTimer != null && timerRemainingMs === 0;
  const timerProgress =
    timerRemainingMs == null || effectiveQuestionTimer == null || effectiveQuestionTimer.totalSeconds <= 0
      ? 0
      : Math.max(0, Math.min(1, timerRemainingMs / (effectiveQuestionTimer.totalSeconds * 1000)));

  useEffect(() => {
    if (sessionStage !== 'active' || effectiveQuestionTimer == null) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [effectiveQuestionTimer, sessionStage]);

  useEffect(() => {
    if (showJoinPanel) {
      setShowScoreOverlay(false);
    }
  }, [showJoinPanel]);

  useEffect(() => {
    if (!participantRef) {
      setIntroAcknowledged(false);
      return;
    }
    try {
      const seen = typeof localStorage !== 'undefined' && localStorage.getItem(introSeenStorageKey(code, participantRef)) === '1';
      setIntroAcknowledged(Boolean(seen));
    } catch {
      setIntroAcknowledged(false);
    }
  }, [code, participantRef]);

  useEffect(() => {
    if (!hasStoredTokenMismatch) return;
    const fallbackName = participantMeta?.name?.trim() ?? '';
    if (fallbackName) {
      setJoinName((previous) => (previous.trim() ? previous : fallbackName));
    }
  }, [hasStoredTokenMismatch, participantMeta?.name]);

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

  const handleJoin = async () => {
    setStatus('joining');
    try {
      const joined = await joinCogitaLiveRevision({ code, name: joinName });
      setParticipantToken(joined.participantToken);
      localStorage.setItem(tokenStorageKey(code), joined.participantToken);
      const meta = { participantId: joined.participantId, name: joined.name };
      setParticipantMeta(meta);
      localStorage.setItem(participantMetaStorageKey(code), JSON.stringify(meta));
      setStatus('ready');
    } catch {
      try {
        const refreshed = await getCogitaLiveRevisionPublicState({ code, participantToken });
        setState(refreshed);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    }
  };

  const clearStoredParticipantData = () => {
    const currentParticipantRef = participantRef;
    setParticipantToken(null);
    setParticipantMeta(null);
    setIntroAcknowledged(false);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(tokenStorageKey(code));
      localStorage.removeItem(participantMetaStorageKey(code));
      if (currentParticipantRef) {
        localStorage.removeItem(introSeenStorageKey(code, currentParticipantRef));
      }
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
    if (timerExpired && effectiveQuestionTimer != null) return;

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
      try {
        const refreshed = await getCogitaLiveRevisionPublicState({ code, participantToken });
        setState(refreshed);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
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
    const bonusTotal = rows
      .filter((row) => row.key === 'first' || row.key === 'speed' || row.key === 'streak')
      .reduce((sum, row) => sum + Math.max(0, row.points), 0);
    const penaltyTotal = rows
      .filter((row) => row.key === 'wrong' || row.key === 'first-wrong')
      .reduce((sum, row) => sum + Math.abs(Math.min(0, row.points)), 0);
    return { total, rows, bonusTotal, penaltyTotal };
  }, [liveCopy.factorBaseLabel, liveCopy.factorFirstLabel, liveCopy.factorFirstWrongLabel, liveCopy.factorSpeedLabel, liveCopy.factorStreakLabel, liveCopy.factorWrongLabel, liveRules.scoring.baseCorrect, liveRules.scoring.firstCorrectBonus, liveRules.scoring.firstWrongPenalty, liveRules.scoring.streakBaseBonus, liveRules.scoring.streakGrowth, liveRules.scoring.streakLimit, liveRules.scoring.wrongAnswerPenalty, selfRoundScoring]);
  const formatPoints = (value: number) => (value > 0 ? `+${value}` : `${value}`);
  const showIntroPanel = !showJoinPanel && sessionStage === 'active' && !introAcknowledged;

  const acknowledgeIntro = () => {
    setIntroAcknowledged(true);
    if (!participantRef) return;
    try {
      localStorage.setItem(introSeenStorageKey(code, participantRef), '1');
    } catch {
      // Ignore storage quota or private mode errors.
    }
  };

  useEffect(() => {
    const rows = state?.scoreboard ?? [];
    if (rows.length === 0) {
      prevScoresRef.current = new Map();
      prevRanksRef.current = new Map();
      setScoreFxByParticipant({});
      return;
    }
    const currentScores = new Map<string, number>();
    const currentRanks = new Map<string, number>();
    rows.forEach((row, index) => {
      currentScores.set(row.participantId, row.score);
      currentRanks.set(row.participantId, index);
    });
    const prevScores = prevScoresRef.current;
    const prevRanks = prevRanksRef.current;
    const nextFx: Record<string, { delta: number; rankShift: number; token: number }> = {};
    rows.forEach((row, index) => {
      const previousScore = prevScores.get(row.participantId);
      const previousRank = prevRanks.get(row.participantId);
      if (typeof previousScore !== 'number' || typeof previousRank !== 'number') return;
      const delta = row.score - previousScore;
      const rankShift = previousRank - index;
      if (delta !== 0 || rankShift !== 0) {
        nextFx[row.participantId] = { delta, rankShift, token: Date.now() + index };
      }
    });
    if (Object.keys(nextFx).length > 0) {
      setScoreFxByParticipant(nextFx);
      window.setTimeout(() => setScoreFxByParticipant({}), 1400);
    }
    prevScoresRef.current = currentScores;
    prevRanksRef.current = currentRanks;
  }, [state?.revealVersion, state?.scoreboard]);

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
                  <>
                    <p className="cogita-help">
                      {hasStoredTokenMismatch ? liveCopy.joinTitle : liveCopy.joinedWaiting}
                    </p>
                    <div className="cogita-form-actions">
                      <button type="button" className="cta ghost" onClick={clearStoredParticipantData}>
                        {participantResetLabel(props.language)}
                      </button>
                    </div>
                  </>
                )}
                {status === 'error' ? <p className="cogita-help">{liveCopy.connectionError}</p> : null}
                {sessionStage === 'lobby' ? (
                  <>
                    <p className="cogita-user-kicker">{liveCopy.scoreboardTitle}</p>
                    <div className="cogita-share-list">
                      {state?.scoreboard.map((row) => {
                        const scoreFx = scoreFxByParticipant[row.participantId];
                        const rowScoring = scoringByParticipant?.[row.participantId];
                        const factors = Array.isArray(rowScoring?.factors) ? rowScoring.factors.map(String) : [];
                        const isIncorrect = factors.includes('wrong') || factors.includes('first-wrong');
                        const isCorrect = !isIncorrect && factors.some((factor) => factor === 'base' || factor === 'first' || factor === 'speed' || factor === 'streak');
                        const rankState = scoreFx?.rankShift ? (scoreFx.rankShift > 0 ? 'up' : 'down') : undefined;
                        const flashState = isCorrect ? 'correct' : isIncorrect ? 'incorrect' : undefined;
                        return (
                          <div className="cogita-share-row" key={row.participantId} data-flash={flashState} data-rank-change={rankState}>
                            <div><strong>{row.displayName}</strong></div>
                            <div className="cogita-share-meta">
                              {row.score} {liveCopy.scoreUnit}
                              {scoreFx?.delta ? (
                                <span key={`delta:lobby:${row.participantId}:${scoreFx.token}`} className="cogita-score-delta" data-sign={scoreFx.delta > 0 ? 'plus' : 'minus'}>
                                  {scoreFx.delta > 0 ? ` +${scoreFx.delta}` : ` ${scoreFx.delta}`}
                                </span>
                              ) : null}
                              {rankState ? (
                                <span key={`rank:lobby:${row.participantId}:${scoreFx?.token ?? 0}`} className="cogita-score-rank" data-rank={rankState}>
                                  {rankState === 'up' ? ' ↑' : ' ↓'}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                      {state && state.scoreboard.length === 0 ? <p className="cogita-help">{liveCopy.noParticipants}</p> : null}
                    </div>
                  </>
                ) : null}
              </div>
              ) : null}
              {!isFirstLogin ? (
              <div className="cogita-library-panel cogita-live-fullscreen-panel">
                {showIntroPanel ? (
                  <>
                    <p className="cogita-user-kicker">{liveCopy.sessionSettingsLabel}</p>
                    <h3 className="cogita-detail-title">{sessionTitle}</h3>
                    <div className="cogita-detail-body">
                      {sessionDescriptionLines.map((line) => (
                        <p key={`intro:${line}`}>{line}</p>
                      ))}
                    </div>
                    <div className="cogita-form-actions">
                      <button type="button" className="cta" onClick={acknowledgeIntro}>
                        {revisionCopy.start}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="cogita-user-kicker">{liveCopy.questionTitle}</p>
                    <h3 className="cogita-detail-title">{typeof prompt?.title === 'string' ? prompt.title : liveCopy.waitingForPublishedRound}</h3>
                {sessionStage === 'active' && prompt && effectiveQuestionTimer != null ? (
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
                    {selfRoundBreakdown && reveal ? (
                      <div className="cogita-live-round-gain">
                        <p className="cogita-user-kicker">{liveCopy.roundGainTitle}</p>
                        <p className="cogita-detail-title">{`${formatPoints(selfRoundBreakdown.total)} ${liveCopy.scoreUnit}`}</p>
                        <p className="cogita-help">
                          {`${liveCopy.factorBaseLabel}: ${formatPoints(
                            selfRoundBreakdown.rows.find((row) => row.key === 'base')?.points ?? 0
                          )} · ${liveCopy.factorFirstLabel}/${liveCopy.factorSpeedLabel}/${liveCopy.factorStreakLabel}: ${formatPoints(
                            selfRoundBreakdown.bonusTotal
                          )} · ${liveCopy.factorWrongLabel}/${liveCopy.factorFirstWrongLabel}: -${selfRoundBreakdown.penaltyTotal}`}
                        </p>
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
                  </>
                ) : (
                  <p className="cogita-help">
                    {sessionStage === 'finished' ? liveCopy.finalScoreTitle : liveCopy.waitingForHostQuestion}
                  </p>
                )}
                  </>
                )}
              </div>
              ) : null}
            </div>
            {!showJoinPanel && sessionStage !== 'lobby' && !showIntroPanel ? (
              <div className="cogita-live-score-overlay-toggle">
                <button type="button" className="ghost" onClick={() => setShowScoreOverlay(true)}>
                  {liveCopy.showScoreOverlayAction}
                </button>
              </div>
            ) : null}
            {showScoreOverlay && sessionStage !== 'lobby' && !showIntroPanel ? (
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
                    {state?.scoreboard.map((row) => {
                      const scoreFx = scoreFxByParticipant[row.participantId];
                      const rowScoring = scoringByParticipant?.[row.participantId];
                      const factors = Array.isArray(rowScoring?.factors) ? rowScoring.factors.map(String) : [];
                      const isIncorrect = factors.includes('wrong') || factors.includes('first-wrong');
                      const isCorrect = !isIncorrect && factors.some((factor) => factor === 'base' || factor === 'first' || factor === 'speed' || factor === 'streak');
                      const rankState = scoreFx?.rankShift ? (scoreFx.rankShift > 0 ? 'up' : 'down') : undefined;
                      const flashState = isCorrect ? 'correct' : isIncorrect ? 'incorrect' : undefined;
                      return (
                        <div className="cogita-share-row" key={`score:${row.participantId}`} data-flash={flashState} data-rank-change={rankState}>
                          <div>
                            <strong>{row.displayName}</strong>
                            {(rowScoring?.factors ?? []).length > 0 ? (
                              <div className="cogita-live-factor-badges">
                                {(rowScoring?.factors ?? []).map((factor) => (
                                  <span key={`score-factor:${row.participantId}:${factor}`} className="cogita-live-factor-badge">
                                    {factorIcon(factor)}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div className="cogita-share-meta">
                            {row.score} {liveCopy.scoreUnit}
                            {rowScoring?.points
                              ? ` (${formatPoints(Math.round(Number(rowScoring?.points ?? 0)))})`
                              : ''}
                            {scoreFx?.delta ? (
                              <span key={`delta:overlay:${row.participantId}:${scoreFx.token}`} className="cogita-score-delta" data-sign={scoreFx.delta > 0 ? 'plus' : 'minus'}>
                                {scoreFx.delta > 0 ? ` +${scoreFx.delta}` : ` ${scoreFx.delta}`}
                              </span>
                            ) : null}
                            {rankState ? (
                              <span key={`rank:overlay:${row.participantId}:${scoreFx?.token ?? 0}`} className="cogita-score-rank" data-rank={rankState}>
                                {rankState === 'up' ? ' ↑' : ' ↓'}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
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
