import { useEffect, useMemo, useRef, useState } from 'react';
import { getCogitaLiveRevisionPublicState, type CogitaLiveRevisionPublicState } from '../../../lib/api';
import { CogitaCheckcardSurface } from '../library/collections/components/CogitaCheckcardSurface';
import { CogitaLivePromptCard, type LivePrompt } from './components/CogitaLivePromptCard';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaLiveWallLayout } from './components/CogitaLiveWallLayout';

type ScoreHistoryPoint = {
  timestamp: number;
  scores: Record<string, number>;
};

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

function FireworksOverlay({
  active,
  zone = 'full',
  focusX,
  focusY
}: {
  active: boolean;
  zone?: 'full' | 'right';
  focusX?: number;
  focusY?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let width = 0;
    let height = 0;
    let animationId = 0;
    let running = true;
    let particles: FireworkParticle[] = [];
    let lastBurstAt = 0;

    const resize = () => {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const addBurst = (x: number, y: number) => {
      const hue = Math.floor(Math.random() * 360);
      const count = 60 + Math.floor(Math.random() * 50);
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.12;
        const speed = 1.2 + Math.random() * 4.8;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 48 + Math.random() * 38,
          maxLife: 48 + Math.random() * 38,
          size: 1.3 + Math.random() * 2.6,
          hue: (hue + Math.random() * 50 - 25 + 360) % 360,
          alpha: 1,
          trail: []
        });
      }
      for (let i = 0; i < 24; i += 1) {
        particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 2.4,
          vy: (Math.random() - 0.7) * 2.2,
          life: 24 + Math.random() * 18,
          maxLife: 24 + Math.random() * 18,
          size: 0.8 + Math.random() * 1.6,
          hue: (hue + Math.random() * 80 - 40 + 360) % 360,
          alpha: 0.85,
          trail: []
        });
      }
    };

    const frame = (time: number) => {
      if (!running) return;
      if (time - lastBurstAt > 420) {
        lastBurstAt = time;
        const centerX =
          typeof focusX === 'number'
            ? width * Math.max(0.05, Math.min(0.95, focusX))
            : zone === 'right'
              ? width * (0.56 + Math.random() * 0.4)
              : width * (0.18 + Math.random() * 0.64);
        const centerY =
          typeof focusY === 'number'
            ? height * Math.max(0.05, Math.min(0.95, focusY))
            : height * (0.12 + Math.random() * 0.45);
        const burstX = centerX + (Math.random() - 0.5) * width * 0.16;
        const burstY = centerY + (Math.random() - 0.5) * height * 0.12;
        addBurst(burstX, burstY);
        if (Math.random() > 0.66) {
          const secondX = centerX + (Math.random() - 0.5) * width * 0.2;
          const secondY = centerY + (Math.random() - 0.5) * height * 0.16;
          addBurst(secondX, secondY);
        }
      }

      context.clearRect(0, 0, width, height);
      context.fillStyle = 'rgba(3, 10, 18, 0.18)';
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
        particle.alpha = Math.max(0, particle.life / particle.maxLife);
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
          context.strokeStyle = `hsla(${particle.hue} 100% 72% / ${Math.max(0, particle.alpha * 0.35)})`;
          context.lineWidth = Math.max(0.8, particle.size * 0.75);
          context.stroke();
        }

        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fillStyle = `hsla(${particle.hue} 100% 68% / ${Math.max(0, particle.alpha)})`;
        context.fill();
      }
      particles = nextParticles;
      animationId = window.requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener('resize', resize);
    animationId = window.requestAnimationFrame(frame);

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationId);
      context.clearRect(0, 0, width, height);
    };
  }, [active, zone, focusX, focusY]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="cogita-live-fireworks" aria-hidden="true" />;
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
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [scoreFxByParticipant, setScoreFxByParticipant] = useState<Record<string, { delta: number; rankShift: number; token: number }>>({});
  const prevScoresRef = useRef<Map<string, number>>(new Map());
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const prompt = (state?.currentPrompt as LivePrompt | undefined) ?? null;
  const reveal = (state?.currentReveal as Record<string, unknown> | undefined) ?? null;
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
  const scoringByParticipant = useMemo(
    () =>
      reveal && typeof reveal === 'object'
        ? ((reveal.roundScoring as Record<string, { points?: number; factors?: string[]; streak?: number }> | undefined) ?? null)
        : null,
    [reveal]
  );
  const isSessionFinished = state?.status === 'finished' || state?.status === 'closed';
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
  const scoreHistory = useMemo<ScoreHistoryPoint[]>(() => {
    const rows = state?.scoreboard ?? [];
    const fromServer = (state?.scoreHistory ?? [])
      .map((point) => {
        const scores: Record<string, number> = {};
        (point.scoreboard ?? []).forEach((entry) => {
          scores[entry.participantId] = Number(entry.score ?? 0);
        });
        return {
          timestamp: Date.parse(point.recordedUtc ?? '') || Date.now(),
          scores
        };
      })
      .filter((point) => Object.keys(point.scores).length > 0);

    const currentScores: Record<string, number> = {};
    rows.forEach((row) => {
      currentScores[row.participantId] = row.score;
    });
    if (Object.keys(currentScores).length === 0) {
      return fromServer;
    }
    if (fromServer.length === 0) {
      return [{ timestamp: Date.now(), scores: currentScores }];
    }
    const last = fromServer[fromServer.length - 1];
    const sameLength = Object.keys(last.scores).length === Object.keys(currentScores).length;
    const unchanged = sameLength && rows.every((row) => Number(last.scores[row.participantId] ?? 0) === row.score);
    if (unchanged) return fromServer;
    return [...fromServer, { timestamp: Date.now(), scores: currentScores }];
  }, [state?.scoreHistory, state?.scoreboard]);
  const chartLines = useMemo(() => {
    const rows = state?.scoreboard ?? [];
    if (rows.length === 0 || scoreHistory.length < 2) {
      return [] as Array<{
        participantId: string;
        name: string;
        color: string;
        path: string;
        lastScore: number;
        endX: number;
        endY: number;
      }>;
    }
    const chartWidth = 100;
    const chartHeight = 100;
    const chartPadding = { left: 4, right: 2, top: 4, bottom: 6 };
    const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
    const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
    const values = scoreHistory.flatMap((point) => Object.values(point.scores).map((value) => Number(value ?? 0)));
    const minData = values.length > 0 ? Math.min(...values) : 0;
    const maxData = values.length > 0 ? Math.max(...values) : 0;
    const rawSpan = maxData - minData;
    const safeSpan = rawSpan <= 0 ? Math.max(1, Math.abs(maxData) * 0.1 + 1) : rawSpan;
    const pad = Math.max(1, safeSpan * 0.08);
    const minScore = minData - pad;
    const maxScore = maxData + pad;
    const scoreSpan = Math.max(1, maxScore - minScore);
    const length = Math.max(1, scoreHistory.length - 1);
    return rows.map((row) => {
      let path = '';
      scoreHistory.forEach((point, index) => {
        const x = chartPadding.left + (index / length) * plotWidth;
        const score = Number(point.scores[row.participantId] ?? 0);
        const ratio = (score - minScore) / scoreSpan;
        const y = chartPadding.top + (1 - ratio) * plotHeight;
        path += index === 0 ? `M ${x.toFixed(3)} ${y.toFixed(3)}` : ` L ${x.toFixed(3)} ${y.toFixed(3)}`;
      });
      return {
        participantId: row.participantId,
        name: row.displayName,
        color: participantColorById.get(row.participantId) ?? '#78d7ff',
        path,
        lastScore: row.score,
        endX: chartPadding.left + plotWidth,
        endY:
          chartPadding.top +
          (1 - (Number(scoreHistory[scoreHistory.length - 1]?.scores[row.participantId] ?? 0) - minScore) / scoreSpan) * plotHeight
      };
    });
  }, [participantColorById, scoreHistory, state?.scoreboard]);

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

  return (
    <>
      <CogitaLiveWallLayout
        title={liveCopy.hostTitle}
        subtitle={liveCopy.hostKicker}
        left={
          <div className="cogita-live-wall-stack">
            {isSessionFinished ? (
              <div className="cogita-live-history-chart">
                <p className="cogita-user-kicker">{liveCopy.finalScoreTitle}</p>
                {chartLines.length > 0 ? (
                  <>
                    <svg
                      viewBox="0 0 100 100"
                      preserveAspectRatio="xMidYMid meet"
                      className="cogita-live-history-chart-svg"
                      aria-label={liveCopy.scoreHistoryChartAria}
                    >
                      <defs>
                        <linearGradient id="cogita-live-history-grid" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="rgba(120, 215, 255, 0.22)" />
                          <stop offset="100%" stopColor="rgba(120, 215, 255, 0.06)" />
                        </linearGradient>
                      </defs>
                      <rect x="0" y="0" width="100" height="100" fill="url(#cogita-live-history-grid)" />
                      {[20, 40, 60, 80].map((y) => (
                        <line key={`grid-y-${y}`} x1="0" y1={y} x2="100" y2={y} stroke="rgba(160,205,245,0.16)" strokeWidth="0.35" />
                      ))}
                      {[20, 40, 60, 80].map((x) => (
                        <line key={`grid-x-${x}`} x1={x} y1="0" x2={x} y2="100" stroke="rgba(160,205,245,0.12)" strokeWidth="0.35" />
                      ))}
                      {chartLines.map((line) => (
                        <g key={`history:${line.participantId}`}>
                          <path
                            d={line.path}
                            fill="none"
                            stroke={line.color}
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <circle cx={line.endX} cy={line.endY} r="1.3" fill={line.color} stroke="rgba(3,14,28,0.95)" strokeWidth="0.5" />
                          <text
                            x={Math.max(2, line.endX - 1.8)}
                            y={Math.max(5, line.endY - 2.1)}
                            textAnchor="end"
                            className="cogita-live-history-line-label"
                            style={{ fill: line.color }}
                          >
                            {line.name}
                          </text>
                        </g>
                      ))}
                    </svg>
                    <div className="cogita-live-history-legend">
                      {chartLines.map((line) => (
                        <div key={`legend:${line.participantId}`} className="cogita-live-history-legend-item">
                          <span className="cogita-live-history-legend-color" style={{ backgroundColor: line.color }} />
                          <strong>{line.name}</strong>
                          <span>{`${line.lastScore} ${liveCopy.scoreUnit}`}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p>{liveCopy.noParticipants}</p>
                )}
              </div>
            ) : (
              <>
                {prompt && prompt.actionTimerEnabled && promptTimerEndMs != null ? (
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
            <p className="cogita-user-kicker">{liveCopy.pointsTitle}</p>
            {isSessionFinished && podiumRows.length > 0 ? (
              <div className="cogita-live-podium-wrap">
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
          </div>
        }
      />
      <FireworksOverlay active={status === 'ready' && isSessionFinished} zone="right" focusX={0.75} focusY={0.24} />
    </>
  );
}
