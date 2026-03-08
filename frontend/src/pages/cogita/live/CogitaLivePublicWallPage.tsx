import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getCogitaLiveRevisionReview,
  getCogitaLiveRevisionPublicState,
  type CogitaLiveRevisionPublicState,
  type CogitaLiveRevisionReviewRound
} from '../../../lib/api';
import { CogitaCheckcardSurface } from '../library/collections/components/CogitaCheckcardSurface';
import { CogitaLivePromptCard, type LivePrompt } from './components/CogitaLivePromptCard';
import { CogitaStatisticsPanel } from '../library/components/CogitaStatisticsPanel';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaLiveWallLayout } from './components/CogitaLiveWallLayout';
import { buildLiveStatisticsResponse } from './liveStatistics';
import { buildLiveSessionSummaryLines } from './liveSessionDescription';
import { parseLiveRules } from './liveSessionRules';

type FireworkParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  alpha: number;
  trail: Array<{ x: number; y: number }>;
  color: string;
};

const CHART_COLORS = [
  '#78d7ff',
  '#8ef0b8',
  '#f8c36c',
  '#f78ab4',
  '#b79dff',
  '#6cf0f0',
  '#ff8f7a',
  '#d4f47d'
];

const CELEBRATION_COLORS = ['#78d7ff', '#6cf0f0', '#8ef0b8', '#f6d28a', '#9ac8ff'];

function PodiumFireworksLayer({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const TOTAL_MS = 6000;
  const SPAWN_MS = 3000;

  useEffect(() => {
    if (!active) {
      setIsVisible(false);
      return;
    }
    setIsVisible(true);
    const id = window.setTimeout(() => setIsVisible(false), TOTAL_MS);
    return () => window.clearTimeout(id);
  }, [active, TOTAL_MS]);

  useEffect(() => {
    if (!isVisible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let animationId = 0;
    let running = true;
    let particles: FireworkParticle[] = [];
    let lastCenterBurstAt = 0;
    let lastSideBurstAt = 0;
    const hexToRgba = (hex: string, alpha: number) => {
      const sanitized = hex.replace('#', '');
      const full = sanitized.length === 3
        ? `${sanitized[0]}${sanitized[0]}${sanitized[1]}${sanitized[1]}${sanitized[2]}${sanitized[2]}`
        : sanitized;
      const r = parseInt(full.slice(0, 2), 16);
      const g = parseInt(full.slice(2, 4), 16);
      const b = parseInt(full.slice(4, 6), 16);
      const safeAlpha = Math.max(0, Math.min(1, alpha));
      return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
    };

    const resize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const bounds = canvas.parentElement?.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds?.width ?? 0));
      height = Math.max(1, Math.round(bounds?.height ?? 0));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const addBurst = (x: number, y: number, size: 'large' | 'small') => {
      const count = size === 'large' ? 110 + Math.floor(Math.random() * 40) : 48 + Math.floor(Math.random() * 26);
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.12;
        const speed = (size === 'large' ? 2.2 : 1.2) + Math.random() * (size === 'large' ? 5.4 : 3.2);
        const color = CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)];
        const life = (size === 'large' ? 120 : 96) + Math.random() * (size === 'large' ? 90 : 70);
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life,
          maxLife: life,
          size: (size === 'large' ? 1.6 : 1.1) + Math.random() * (size === 'large' ? 2.8 : 1.7),
          hue: 0,
          alpha: 1,
          trail: [],
          color
        });
      }
      for (let i = 0; i < (size === 'large' ? 34 : 16); i += 1) {
        const color = CELEBRATION_COLORS[Math.floor(Math.random() * CELEBRATION_COLORS.length)];
        const life = (size === 'large' ? 90 : 72) + Math.random() * (size === 'large' ? 55 : 44);
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * (size === 'large' ? 2.8 : 1.9),
          vy: (Math.random() - 0.7) * (size === 'large' ? 2.5 : 1.7),
          life,
          maxLife: life,
          size: 0.8 + Math.random() * 1.6,
          hue: 0,
          alpha: 0.85,
          trail: [],
          color
        });
      }
    };

    const frame = (time: number) => {
      if (!running) return;
      const elapsedMs = time - effectStartAt;
      if (elapsedMs >= TOTAL_MS) {
        running = false;
        context.clearRect(0, 0, width, height);
        return;
      }
      const canSpawn = elapsedMs < SPAWN_MS;
      const fadeRatio = elapsedMs <= SPAWN_MS ? 1 : Math.max(0, 1 - (elapsedMs - SPAWN_MS) / (TOTAL_MS - SPAWN_MS));
      if (canSpawn && time - lastCenterBurstAt > 620) {
        lastCenterBurstAt = time;
        addBurst(width * (0.5 + (Math.random() - 0.5) * 0.08), height * (0.24 + (Math.random() - 0.5) * 0.08), 'large');
      }
      if (canSpawn && time - lastSideBurstAt > 980) {
        lastSideBurstAt = time;
        addBurst(width * (0.24 + (Math.random() - 0.5) * 0.06), height * (0.3 + (Math.random() - 0.5) * 0.1), 'small');
        addBurst(width * (0.76 + (Math.random() - 0.5) * 0.06), height * (0.3 + (Math.random() - 0.5) * 0.1), 'small');
      }

      context.clearRect(0, 0, width, height);
      const hazeTop = context.createRadialGradient(width * 0.5, height * 0.1, 0, width * 0.5, height * 0.1, width * 0.72);
      hazeTop.addColorStop(0, `rgba(94, 214, 255, ${0.16 * fadeRatio})`);
      hazeTop.addColorStop(0.52, `rgba(84, 236, 220, ${0.08 * fadeRatio})`);
      hazeTop.addColorStop(1, 'rgba(12, 26, 44, 0)');
      context.fillStyle = hazeTop;
      context.fillRect(0, 0, width, height);

      const nextParticles: FireworkParticle[] = [];
      for (const particle of particles) {
        const drag = 0.986;
        const gravity = 0.05;
        particle.vx *= drag;
        particle.vy = particle.vy * drag + gravity;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 1;
        particle.alpha = Math.max(0, (particle.life / particle.maxLife) * fadeRatio);
        particle.trail.push({ x: particle.x, y: particle.y });
        if (particle.trail.length > 7) {
          particle.trail.shift();
        }

        if (particle.life > 0 && particle.y <= height + 40) {
          nextParticles.push(particle);
        }

        if (particle.trail.length > 1) {
          context.beginPath();
          for (let i = 0; i < particle.trail.length; i += 1) {
            const point = particle.trail[i];
            if (i === 0) context.moveTo(point.x, point.y);
            else context.lineTo(point.x, point.y);
          }
          context.strokeStyle = hexToRgba(particle.color, Math.max(0, particle.alpha * 0.4));
          context.lineWidth = Math.max(0.8, particle.size * 0.75);
          context.stroke();
        }

        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fillStyle = hexToRgba(particle.color, Math.max(0, particle.alpha));
        context.fill();
      }
      particles = nextParticles;
      animationId = window.requestAnimationFrame(frame);
    };

    const effectStartAt = performance.now();
    resize();
    window.addEventListener('resize', resize);
    animationId = window.requestAnimationFrame(frame);

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationId);
      context.clearRect(0, 0, width, height);
    };
  }, [isVisible]);

  if (!isVisible) return null;
  return <canvas ref={canvasRef} className="cogita-live-podium-fireworks" aria-hidden="true" />;
}

export function CogitaLivePublicWallPage({
  copy,
  code
}: {
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
  const liveCopy = copy.cogita.library.revision.live;
  const [state, setState] = useState<CogitaLiveRevisionPublicState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reviewRounds, setReviewRounds] = useState<CogitaLiveRevisionReviewRound[]>([]);
  const [reviewStatus, setReviewStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [scoreFxByParticipant, setScoreFxByParticipant] = useState<Record<string, { delta: number; rankShift: number; token: number }>>({});
  const prevScoresRef = useRef<Map<string, number>>(new Map());
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const prompt = (state?.currentPrompt as LivePrompt | undefined) ?? null;
  const reveal = (state?.currentReveal as Record<string, unknown> | undefined) ?? null;
  const liveRules = useMemo(() => parseLiveRules(state?.sessionSettings), [state?.sessionSettings]);
  const sessionDescriptionLines = useMemo(
    () =>
      buildLiveSessionSummaryLines({
        liveCopy,
        rules: liveRules,
        sessionMode: state?.sessionMode === 'asynchronous' ? 'asynchronous' : 'simultaneous'
      }),
    [liveCopy, liveRules, state?.sessionMode]
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
  const timerProgress =
    timerRemainingMs == null || promptTimerTotalSeconds <= 0
      ? 0
      : Math.max(0, Math.min(1, timerRemainingMs / (promptTimerTotalSeconds * 1000)));
  const isAsyncSession = state?.sessionMode === 'asynchronous';
  const showPromptTimer = Boolean(
    isAsyncSession &&
      prompt &&
      (typeof prompt.firstAnswerAction === 'string' ? prompt.firstAnswerAction === 'start_timer' : true) &&
      prompt.actionTimerEnabled &&
      promptTimerEndMs != null &&
      state?.status === 'running' &&
      !reveal
  );
  const scoringByParticipant = useMemo(
    () =>
      reveal && typeof reveal === 'object'
        ? ((reveal.roundScoring as Record<string, { points?: number; factors?: string[]; streak?: number }> | undefined) ?? null)
        : null,
    [reveal]
  );
  const isSessionFinished = state?.status === 'finished' || state?.status === 'closed';
  const showSessionDescription = isAsyncSession || state?.status === 'lobby';
  const showStatisticsWindow = isSessionFinished || isAsyncSession;
  const showPodiumOnPublicScreen = !isAsyncSession && isSessionFinished;
  const showRightScoreboard = !isAsyncSession && !isSessionFinished;
  const podiumRows = useMemo(
    () =>
      [...(state?.scoreboard ?? [])]
        .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
        .slice(0, 3),
    [state?.scoreboard]
  );
  const podiumDisplayRows = useMemo(() => {
    if (podiumRows.length <= 1) return podiumRows;
    if (podiumRows.length === 2) return [podiumRows[1], podiumRows[0]];
    return [podiumRows[1], podiumRows[0], podiumRows[2]];
  }, [podiumRows]);
  const participantColorById = useMemo(() => {
    const mapping = new Map<string, string>();
    (state?.scoreboard ?? []).forEach((row, index) => {
      mapping.set(row.participantId, CHART_COLORS[index % CHART_COLORS.length]);
    });
    return mapping;
  }, [state?.scoreboard]);
  const liveStatisticsData = useMemo(() => buildLiveStatisticsResponse(state), [state]);
  const questionAverageRows = useMemo(() => {
    const rounds = [...(state?.correctnessHistory ?? [])].sort((left, right) => left.roundIndex - right.roundIndex);
    return rounds.map((round) => {
      const scoredEntries = round.entries.filter((entry) => typeof entry.isCorrect === 'boolean');
      const answerCount = scoredEntries.length;
      const correctCount = scoredEntries.filter((entry) => entry.isCorrect).length;
      const averageCorrectness = answerCount > 0 ? (correctCount / answerCount) * 100 : 0;
      return {
        roundIndex: round.roundIndex,
        answerCount,
        averageCorrectness
      };
    });
  }, [state?.correctnessHistory]);
  const usedReviewRounds = useMemo(
    () => [...reviewRounds].sort((left, right) => left.roundIndex - right.roundIndex),
    [reviewRounds]
  );

  useEffect(() => {
    if (promptTimerEndMs == null) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [promptTimerEndMs]);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const next = await getCogitaLiveRevisionPublicState({ code });
        if (!mounted) return;
        setState(next);
        setStatus('ready');
      } catch {
        if (!mounted) return;
        setStatus('error');
      }
    };
    void poll();
    const id = window.setInterval(poll, 1200);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [code]);

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

  useEffect(() => {
    if (!isSessionFinished || isAsyncSession) {
      setReviewRounds([]);
      setReviewStatus('idle');
      return;
    }
    let cancelled = false;
    setReviewStatus('loading');
    void getCogitaLiveRevisionReview({ code, participantToken: null })
      .then((rows) => {
        if (cancelled) return;
        setReviewRounds(Array.isArray(rows) ? rows : []);
        setReviewStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setReviewRounds([]);
        setReviewStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [code, isAsyncSession, isSessionFinished, state?.revealVersion]);

  return (
    <>
      <CogitaLiveWallLayout
        title={liveCopy.hostTitle}
        subtitle={liveCopy.hostKicker}
        left={
          <div className="cogita-live-wall-stack">
            {sessionDescriptionLines.length > 0 && showSessionDescription ? (
              <section className="cogita-library-panel">
                <p className="cogita-user-kicker">{liveCopy.sessionSettingsLabel}</p>
                <div className="cogita-detail-body">
                  {sessionDescriptionLines.map((line) => (
                    <p key={`public-session-line:${line}`}>{line}</p>
                  ))}
                </div>
              </section>
            ) : null}
            {showStatisticsWindow ? (
              <>
                {isAsyncSession ? (
                  <section className="cogita-library-panel">
                    <p className="cogita-user-kicker">{liveCopy.pointsTitle}</p>
                    <div className="cogita-share-list">
                      {(state?.scoreboard ?? []).map((row) => {
                        const scoreFx = scoreFxByParticipant[row.participantId];
                        const scoring = scoringByParticipant?.[row.participantId];
                        const factors = Array.isArray(scoring?.factors) ? scoring?.factors.map(String) : [];
                        const isIncorrect = factors.includes('wrong') || factors.includes('first-wrong');
                        const isCorrect =
                          !isIncorrect &&
                          factors.some((factor) => factor === 'base' || factor === 'first' || factor === 'speed' || factor === 'streak');
                        const rankState = scoreFx?.rankShift ? (scoreFx.rankShift > 0 ? 'up' : 'down') : undefined;
                        const flashState = isCorrect ? 'correct' : isIncorrect ? 'incorrect' : undefined;
                        return (
                          <div className="cogita-share-row" key={`async-score:${row.participantId}`} data-flash={flashState} data-rank-change={rankState}>
                            <div className="cogita-live-score-name">
                              <span
                                className="cogita-live-history-legend-color"
                                style={{ backgroundColor: participantColorById.get(row.participantId) ?? '#78d7ff' }}
                              />
                              <strong>{row.displayName}</strong>
                            </div>
                            <div className="cogita-share-meta">
                              {`${row.score} ${liveCopy.scoreUnit}`}
                              {scoreFx?.delta ? (
                                <span key={`async-delta:${row.participantId}:${scoreFx.token}`} className="cogita-score-delta" data-sign={scoreFx.delta > 0 ? 'plus' : 'minus'}>
                                  {scoreFx.delta > 0 ? ` +${scoreFx.delta}` : ` ${scoreFx.delta}`}
                                </span>
                              ) : null}
                              {rankState ? (
                                <span key={`async-rank:${row.participantId}:${scoreFx?.token ?? 0}`} className="cogita-score-rank" data-rank={rankState}>
                                  {rankState === 'up' ? ' ↑' : ' ↓'}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                      {status === 'error' ? <p>{liveCopy.connectionError}</p> : null}
                      {status === 'ready' && (state?.scoreboard.length ?? 0) === 0 ? <p>{liveCopy.noParticipants}</p> : null}
                    </div>
                  </section>
                ) : null}
                <CogitaStatisticsPanel
                  libraryId={`live:${state?.sessionId ?? code}`}
                  scopeType="live-session"
                  scopeId={state?.sessionId ?? code}
                  title={liveCopy.finalScoreTitle}
                  data={liveStatisticsData}
                  loading={status === 'loading'}
                  error={status === 'error'}
                  initialModuleId="score-line"
                />
                {isAsyncSession ? (
                  <section className="cogita-library-panel">
                    <div className="cogita-detail-header">
                      <div>
                        <p className="cogita-user-kicker">{liveCopy.reviewQuestionsTitle}</p>
                        <h3 className="cogita-detail-title">{`${questionAverageRows.length}`}</h3>
                      </div>
                    </div>
                    <div className="cogita-share-list">
                      {questionAverageRows.map((row) => (
                        <div className="cogita-share-row" key={`avg-round:${row.roundIndex}`}>
                          <div className="cogita-live-score-name">
                            <strong>{`${liveCopy.questionTitle} ${row.roundIndex + 1}`}</strong>
                          </div>
                          <div className="cogita-share-meta">
                            {`${Math.round(row.averageCorrectness)}% · ${row.answerCount}`}
                          </div>
                        </div>
                      ))}
                      {questionAverageRows.length === 0 ? <p>{liveCopy.noParticipants}</p> : null}
                    </div>
                  </section>
                ) : null}
              </>
            ) : (
              <>
                {showPromptTimer ? (
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
                <CogitaCheckcardSurface className="cogita-live-card-container" feedbackToken={reveal ? `correct-${state?.revealVersion ?? 0}` : 'idle'}>
                  <CogitaLivePromptCard
                    prompt={prompt}
                    revealExpected={reveal?.expected}
                    answerDistribution={reveal?.answerDistribution}
                    mode="readonly"
                    labels={{
                      answerLabel: copy.cogita.library.revision.answerLabel,
                      correctAnswerLabel: copy.cogita.library.revision.correctAnswerLabel,
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
                  />
                </CogitaCheckcardSurface>
              </>
            )}
          </div>
        }
        right={
          <div className="cogita-live-wall-stack">
            {showRightScoreboard ? <p className="cogita-user-kicker">{liveCopy.pointsTitle}</p> : null}
            {showPodiumOnPublicScreen && podiumRows.length > 0 ? (
              <div className="cogita-live-podium-wrap">
                <div className="cogita-live-podium-celebration-layer" aria-hidden="true">
                  <PodiumFireworksLayer active={status === 'ready' && isSessionFinished} />
                </div>
                <p className="cogita-user-kicker">{liveCopy.podiumTitle}</p>
                <div className="cogita-live-podium" role="presentation">
                  {podiumDisplayRows.map((row) => {
                    const order = podiumRows.findIndex((entry) => entry.participantId === row.participantId) + 1;
                    const color = participantColorById.get(row.participantId) ?? CHART_COLORS[Math.max(0, order - 1) % CHART_COLORS.length];
                    const heightByRank: Record<number, number> = { 1: 100, 2: 74, 3: 58 };
                    const height = heightByRank[order] ?? 52;
                    return (
                      <div key={`podium:${row.participantId}`} className="cogita-live-podium-slot" data-rank={order}>
                        <div className="cogita-live-podium-name" title={row.displayName}>
                          {row.displayName}
                        </div>
                        <div className="cogita-live-podium-pillar" style={{ height: `${height}%`, borderColor: color, boxShadow: `inset 0 0 0 1px ${color}55, 0 0 18px ${color}33` }}>
                          <span className="cogita-live-podium-medal" style={{ background: color }}>{order}</span>
                          <strong>{`${row.score} ${liveCopy.scoreUnit}`}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {showPodiumOnPublicScreen ? (
              <section className="cogita-library-panel">
                <div className="cogita-detail-header">
                  <div>
                    <p className="cogita-user-kicker">{liveCopy.reviewQuestionsTitle}</p>
                    <h3 className="cogita-detail-title">{usedReviewRounds.length}</h3>
                  </div>
                </div>
                {reviewStatus === 'loading' ? <p className="cogita-help">{liveCopy.loading}</p> : null}
                {reviewStatus === 'error' ? <p className="cogita-help">{liveCopy.connectionError}</p> : null}
                {reviewStatus !== 'loading' && usedReviewRounds.length === 0 ? (
                  <p className="cogita-help">{liveCopy.noParticipants}</p>
                ) : null}
                {usedReviewRounds.length > 0 ? (
                  <div className="cogita-live-wall-stack">
                    {usedReviewRounds.map((round) => {
                      const reviewPrompt = (round.prompt as LivePrompt | undefined) ?? null;
                      const reviewReveal = (round.reveal as Record<string, unknown> | undefined) ?? null;
                      if (!reviewPrompt) return null;
                      return (
                        <CogitaCheckcardSurface
                          key={`public-review-round:${round.roundIndex}:${round.cardKey}`}
                          className="cogita-live-card-container"
                          feedbackToken={`public-review:${round.roundIndex}`}
                        >
                          <CogitaLivePromptCard
                            prompt={reviewPrompt}
                            revealExpected={reviewReveal?.expected}
                            answerDistribution={reviewReveal?.answerDistribution}
                            mode="readonly"
                            labels={{
                              answerLabel: copy.cogita.library.revision.answerLabel,
                              correctAnswerLabel: copy.cogita.library.revision.correctAnswerLabel,
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
                          />
                        </CogitaCheckcardSurface>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            ) : null}
            {showRightScoreboard ? (
              <div className="cogita-share-list">
                {(state?.scoreboard ?? []).map((row) => {
                  const scoreFx = scoreFxByParticipant[row.participantId];
                  const scoring = scoringByParticipant?.[row.participantId];
                  const factors = Array.isArray(scoring?.factors) ? scoring?.factors.map(String) : [];
                  const isIncorrect = factors.includes('wrong') || factors.includes('first-wrong');
                  const isCorrect = !isIncorrect && factors.some((factor) => factor === 'base' || factor === 'first' || factor === 'speed' || factor === 'streak');
                  const rankState = scoreFx?.rankShift ? (scoreFx.rankShift > 0 ? 'up' : 'down') : undefined;
                  const flashState = isCorrect ? 'correct' : isIncorrect ? 'incorrect' : undefined;
                  return (
                    <div className="cogita-share-row" key={row.participantId} data-flash={flashState} data-rank-change={rankState}>
                      <div className="cogita-live-score-name">
                        <span className="cogita-live-history-legend-color" style={{ backgroundColor: participantColorById.get(row.participantId) ?? '#78d7ff' }} />
                        <strong>{row.displayName}</strong>
                      </div>
                      <div className="cogita-share-meta">
                        {`${row.score} ${liveCopy.scoreUnit}`}
                        {scoreFx?.delta ? (
                          <span key={`delta:${row.participantId}:${scoreFx.token}`} className="cogita-score-delta" data-sign={scoreFx.delta > 0 ? 'plus' : 'minus'}>
                            {scoreFx.delta > 0 ? ` +${scoreFx.delta}` : ` ${scoreFx.delta}`}
                          </span>
                        ) : null}
                        {rankState ? (
                          <span key={`rank:${row.participantId}:${scoreFx?.token ?? 0}`} className="cogita-score-rank" data-rank={rankState}>
                            {rankState === 'up' ? ' ↑' : ' ↓'}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {status === 'error' ? <p>{liveCopy.connectionError}</p> : null}
                {status === 'ready' && (state?.scoreboard.length ?? 0) === 0 ? <p>{liveCopy.noParticipants}</p> : null}
              </div>
            ) : null}
          </div>
        }
      />
    </>
  );
}
