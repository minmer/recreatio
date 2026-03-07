import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  controlCogitaLiveRevisionTimer,
  getCogitaLiveRevisionPublicState,
  joinCogitaLiveRevision,
  leaveCogitaLiveRevision,
  submitCogitaLiveRevisionAnswer,
  type CogitaLiveRevisionPublicState
} from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import { CogitaCheckcardSurface } from '../library/collections/components/CogitaCheckcardSurface';
import { CogitaStatisticsPanel } from '../library/components/CogitaStatisticsPanel';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaLivePromptCard, type LivePrompt } from './components/CogitaLivePromptCard';
import { evaluateCheckcardAnswer } from '../library/checkcards/checkcardRuntime';
import { clampInt, parseLiveRules } from './liveSessionRules';
import { buildLiveSessionSummaryLines } from './liveSessionDescription';
import { useScreenWakeLock } from './useScreenWakeLock';
import { buildLiveStatisticsResponse } from './liveStatistics';

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

function pauseTimerLabel(language: 'pl' | 'en' | 'de') {
  if (language === 'pl') return 'Wstrzymaj timer';
  if (language === 'de') return 'Timer pausieren';
  return 'Pause timer';
}

function resumeTimerLabel(language: 'pl' | 'en' | 'de') {
  if (language === 'pl') return 'Wznów timer';
  if (language === 'de') return 'Timer fortsetzen';
  return 'Resume timer';
}

function bonusListTitle(language: 'pl' | 'en' | 'de') {
  if (language === 'pl') return 'Konfiguracja punktów i bonusów';
  if (language === 'de') return 'Punkte- und Bonuskonfiguration';
  return 'Configured points and bonuses';
}

function switchParticipantActionLabel(language: 'pl' | 'en' | 'de') {
  if (language === 'pl') return 'Zmień uczestnika';
  if (language === 'de') return 'Teilnehmer wechseln';
  return 'Switch participant';
}

function duplicateNameQuestionLabel(language: 'pl' | 'en' | 'de', name: string) {
  if (language === 'pl') return `Nazwa „${name}” jest już używana. Czy chcesz dołączyć jako ten uczestnik?`;
  if (language === 'de') return `Der Name „${name}” wird bereits verwendet. Möchtest du als dieser Teilnehmer beitreten?`;
  return `The name "${name}" is already used. Do you want to join as that participant?`;
}

function useExistingParticipantLabel(language: 'pl' | 'en' | 'de') {
  if (language === 'pl') return 'Użyj istniejącego uczestnika';
  if (language === 'de') return 'Bestehenden Teilnehmer verwenden';
  return 'Use existing participant';
}

function chooseDifferentNameLabel(language: 'pl' | 'en' | 'de') {
  if (language === 'pl') return 'Wybierz inną nazwę';
  if (language === 'de') return 'Anderen Namen wählen';
  return 'Choose different name';
}

type DisplayScoreRow = {
  participantId: string;
  displayName: string;
  score: number;
  answeredCount: number;
  comparedAnsweredCount: number;
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
  const apiBase = import.meta.env.VITE_API_BASE ?? 'https://api.recreatio.pl';
  const revisionCopy = props.copy.cogita.library.revision;
  const liveCopy = revisionCopy.live;
  const factorIcon = (factor: string) => (factor === 'first' ? '⚡' : factor === 'streak' ? '🔥' : factor === 'speed' ? '⏱' : factor === 'wrong' ? '✖' : factor === 'first-wrong' ? '⚠' : '✓');
  const [joinName, setJoinName] = useState(() => readJoinNameFromHash());
  const [duplicateJoinName, setDuplicateJoinName] = useState<string | null>(null);
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
  const [localTimerPauseHold, setLocalTimerPauseHold] = useState(false);
  const [pausedTimerSnapshot, setPausedTimerSnapshot] = useState<{
    questionRemainingMs?: number | null;
    nextRemainingMs?: number | null;
    sessionRemainingMs?: number | null;
  } | null>(null);
  const [scoreFxByParticipant, setScoreFxByParticipant] = useState<Record<string, { delta: number; rankShift: number; token: number }>>({});
  const prevScoresRef = useRef<Map<string, number>>(new Map());
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const timeoutSubmitKeyRef = useRef<string | null>(null);
  const timeoutNextKeyRef = useRef<string | null>(null);
  const introTimerSyncRef = useRef<'idle' | 'pause' | 'resume'>('idle');

  const prompt = (state?.currentPrompt as LivePrompt | undefined) ?? null;
  const reveal = (state?.currentReveal as Record<string, unknown> | undefined) ?? null;
  const revealExpected = reveal?.expected;
  const isAsyncSession = state?.sessionMode === 'asynchronous';
  const liveRules = useMemo(() => parseLiveRules(state?.sessionSettings), [state?.sessionSettings]);
  const sessionStage =
    state?.status === 'finished' || state?.status === 'closed'
      ? 'finished'
      : state?.status && state.status !== 'lobby'
        ? 'active'
        : 'lobby';
  const showJoinPanel = sessionStage === 'lobby' || !participantToken;
  const showIntroPanel = !showJoinPanel && sessionStage === 'active' && !introAcknowledged;
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
  const serverTimerPaused = isAsyncSession && Boolean((prompt as Record<string, unknown> | null)?.timerPaused);
  const timerPauseSource = typeof (prompt as Record<string, unknown> | null)?.timerPauseSource === 'string'
    ? String((prompt as Record<string, unknown>).timerPauseSource).toLowerCase()
    : '';
  const timersPaused = serverTimerPaused || (isAsyncSession && localTimerPauseHold);
  const roundsLabelResolved = useMemo(() => {
    const count = Math.max(0, Number(state?.currentRoundIndex ?? 0)) + 1;
    return String(liveCopy.roundsLabel ?? '').replace('{count}', String(count));
  }, [liveCopy.roundsLabel, state?.currentRoundIndex]);
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

  const nextQuestionTimer = useMemo(() => {
    if (state?.status !== 'running' || !reveal || !prompt) return null;
    if (prompt.nextQuestionMode !== 'timer') return null;
    if (typeof prompt.autoNextEndsUtc !== 'string') return null;
    const endsMs = Date.parse(prompt.autoNextEndsUtc);
    if (!Number.isFinite(endsMs)) return null;
    const secondsRaw = Number(prompt.nextQuestionSeconds ?? liveRules.nextQuestion.seconds ?? 0);
    const totalSeconds = Number.isFinite(secondsRaw) && secondsRaw > 0 ? Math.max(1, Math.min(1200, Math.round(secondsRaw))) : 0;
    if (totalSeconds <= 0) return null;
    const remainingMs = Math.max(0, endsMs - nowTick);
    return {
      totalSeconds,
      remainingMs,
      progress: Math.max(0, Math.min(1, remainingMs / (totalSeconds * 1000)))
    };
  }, [liveRules.nextQuestion.seconds, nowTick, prompt, reveal, state?.status]);

  const fullSessionTimer = useMemo(() => {
    if (state?.status !== 'running' || !prompt || !prompt.sessionTimerEnabled || typeof prompt.sessionTimerEndsUtc !== 'string') {
      return null;
    }
    const endsMs = Date.parse(prompt.sessionTimerEndsUtc);
    if (!Number.isFinite(endsMs)) return null;
    const secondsRaw = Number(prompt.sessionTimerSeconds ?? 0);
    const totalSeconds = Number.isFinite(secondsRaw) && secondsRaw > 0 ? Math.max(1, Math.min(86400, Math.round(secondsRaw))) : 0;
    if (totalSeconds <= 0) return null;
    const remainingMs = Math.max(0, endsMs - nowTick);
    return {
      totalSeconds,
      remainingMs,
      progress: Math.max(0, Math.min(1, remainingMs / (totalSeconds * 1000)))
    };
  }, [nowTick, prompt, state?.status]);

  useEffect(() => {
    if (timersPaused) {
      setPausedTimerSnapshot((previous) =>
        previous ?? {
          questionRemainingMs: timerRemainingMs,
          nextRemainingMs: nextQuestionTimer?.remainingMs ?? null,
          sessionRemainingMs: fullSessionTimer?.remainingMs ?? null
        }
      );
      return;
    }
    if (pausedTimerSnapshot) {
      setPausedTimerSnapshot(null);
    }
  }, [fullSessionTimer?.remainingMs, nextQuestionTimer?.remainingMs, pausedTimerSnapshot, timerRemainingMs, timersPaused]);

  const visibleTimerRemainingMs = timersPaused
    ? (pausedTimerSnapshot?.questionRemainingMs ?? timerRemainingMs)
    : timerRemainingMs;
  const visibleNextRemainingMs = timersPaused
    ? (pausedTimerSnapshot?.nextRemainingMs ?? nextQuestionTimer?.remainingMs ?? null)
    : (nextQuestionTimer?.remainingMs ?? null);
  const visibleSessionRemainingMs = timersPaused
    ? (pausedTimerSnapshot?.sessionRemainingMs ?? fullSessionTimer?.remainingMs ?? null)
    : (fullSessionTimer?.remainingMs ?? null);
  const visibleTimerProgress =
    visibleTimerRemainingMs == null || effectiveQuestionTimer == null || effectiveQuestionTimer.totalSeconds <= 0
      ? 0
      : Math.max(0, Math.min(1, visibleTimerRemainingMs / (effectiveQuestionTimer.totalSeconds * 1000)));
  const visibleNextProgress =
    visibleNextRemainingMs == null || !nextQuestionTimer || nextQuestionTimer.totalSeconds <= 0
      ? 0
      : Math.max(0, Math.min(1, visibleNextRemainingMs / (nextQuestionTimer.totalSeconds * 1000)));
  const visibleSessionProgress =
    visibleSessionRemainingMs == null || !fullSessionTimer || fullSessionTimer.totalSeconds <= 0
      ? 0
      : Math.max(0, Math.min(1, visibleSessionRemainingMs / (fullSessionTimer.totalSeconds * 1000)));

  useEffect(() => {
    if (!serverTimerPaused && localTimerPauseHold) {
      setLocalTimerPauseHold(false);
    }
  }, [localTimerPauseHold, serverTimerPaused]);

  useEffect(() => {
    if (sessionStage !== 'active') return;
    if (effectiveQuestionTimer == null && nextQuestionTimer == null && fullSessionTimer == null) return;
    if (timersPaused) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [effectiveQuestionTimer, fullSessionTimer, nextQuestionTimer, sessionStage, timersPaused]);

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
    timeoutSubmitKeyRef.current = null;
    timeoutNextKeyRef.current = null;
  }, [promptKey]);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const next = await getCogitaLiveRevisionPublicState({ code, participantToken });
        if (!mounted) return;
        setState(next);
        if (!participantToken && typeof next.participantToken === 'string' && next.participantToken.trim()) {
          setParticipantToken(next.participantToken);
          localStorage.setItem(tokenStorageKey(code), next.participantToken);
        }
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

  const handleJoin = async (useExistingName = false) => {
    setStatus('joining');
    try {
      const joined = await joinCogitaLiveRevision({ code, name: joinName, useExistingName });
      setParticipantToken(joined.participantToken);
      localStorage.setItem(tokenStorageKey(code), joined.participantToken);
      const meta = { participantId: joined.participantId, name: joined.name };
      setParticipantMeta(meta);
      localStorage.setItem(participantMetaStorageKey(code), JSON.stringify(meta));
      setDuplicateJoinName(null);
      setStatus('ready');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        let takenName = joinName.trim();
        try {
          const parsed = JSON.parse(error.message) as { participantName?: string };
          if (typeof parsed.participantName === 'string' && parsed.participantName.trim()) {
            takenName = parsed.participantName.trim();
          }
        } catch {
          // Keep fallback value from typed input.
        }
        setDuplicateJoinName(takenName);
        setStatus('ready');
        return;
      }
      try {
        const refreshed = await getCogitaLiveRevisionPublicState({ code, participantToken });
        setState(refreshed);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    }
  };

  const clearStoredParticipantData = async () => {
    const currentParticipantRef = participantRef;
    if (participantToken && isAsyncSession) {
      try {
        await leaveCogitaLiveRevision({
          code,
          participantToken,
          roundIndex: Number(prompt?.roundIndex ?? state?.currentRoundIndex ?? 0)
        });
      } catch {
        // Keep local cleanup even if leave call fails.
      }
    }
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

  const pauseTimersNow = async () => {
    if (timersPaused) return;
    setLocalTimerPauseHold(true);
    if (participantToken && isAsyncSession && prompt) {
      try {
        await controlCogitaLiveRevisionTimer({
          code,
          participantToken,
          action: 'pause',
          roundIndex: Number(prompt.roundIndex ?? state?.currentRoundIndex ?? 0),
          source: 'score'
        });
      } catch {
        // Keep UI stable even when pause sync fails.
      }
    }
    try {
      const refreshed = await getCogitaLiveRevisionPublicState({ code, participantToken });
      setState(refreshed);
    } catch {
      // ignore refresh errors
    }
  };

  const toggleTimersPaused = async () => {
    if (participantToken && isAsyncSession && prompt) {
      const action = timersPaused ? 'resume' : 'pause';
      setLocalTimerPauseHold(action === 'pause');
      try {
        await controlCogitaLiveRevisionTimer({
          code,
          participantToken,
          action,
          roundIndex: Number(prompt.roundIndex ?? state?.currentRoundIndex ?? 0),
          source: 'manual'
        });
      } catch {
        // Keep UI stable even when pause sync fails.
      }
    }
    try {
      const refreshed = await getCogitaLiveRevisionPublicState({ code, participantToken });
      setState(refreshed);
    } catch {
      // ignore refresh errors
    }
  };

  useEffect(() => {
    if (!showScoreOverlay) return;
    if (!isAsyncSession) return;
    if (!reveal) return;
    void pauseTimersNow();
  }, [isAsyncSession, reveal, showScoreOverlay]);

  useEffect(() => {
    if (showScoreOverlay) return;
    if (!isAsyncSession || !participantToken || !prompt) return;
    if (!timersPaused) return;
    if (timerPauseSource !== 'score') return;

    setLocalTimerPauseHold(false);
    void (async () => {
      try {
        await controlCogitaLiveRevisionTimer({
          code,
          participantToken,
          action: 'resume',
          roundIndex: Number(prompt.roundIndex ?? state?.currentRoundIndex ?? 0),
          source: 'score'
        });
        const refreshed = await getCogitaLiveRevisionPublicState({ code, participantToken });
        setState(refreshed);
      } catch {
        // Ignore resume errors on overlay close.
      }
    })();
  }, [code, isAsyncSession, participantToken, prompt, showScoreOverlay, state?.currentRoundIndex, timerPauseSource, timersPaused]);

  useEffect(() => {
    if (!participantToken || !isAsyncSession || !prompt || sessionStage !== 'active') return;
    const roundIndex = Number(prompt.roundIndex ?? state?.currentRoundIndex ?? 0);

    if (showIntroPanel) {
      if (timersPaused || introTimerSyncRef.current === 'pause') return;
      setLocalTimerPauseHold(true);
      introTimerSyncRef.current = 'pause';
      void (async () => {
        try {
          await controlCogitaLiveRevisionTimer({
            code,
            participantToken,
            action: 'pause',
            roundIndex,
            source: 'intro'
          });
          const refreshed = await getCogitaLiveRevisionPublicState({ code, participantToken });
          setState(refreshed);
        } catch {
          // Keep UI responsive if intro pause fails.
        } finally {
          introTimerSyncRef.current = 'idle';
        }
      })();
      return;
    }

    if (!showIntroPanel && timersPaused && timerPauseSource === 'intro' && introTimerSyncRef.current !== 'resume' && !reveal) {
      setLocalTimerPauseHold(false);
      introTimerSyncRef.current = 'resume';
      void (async () => {
        try {
          await controlCogitaLiveRevisionTimer({
            code,
            participantToken,
            action: 'resume',
            roundIndex,
            source: 'intro'
          });
          const refreshed = await getCogitaLiveRevisionPublicState({ code, participantToken });
          setState(refreshed);
        } catch {
          // Keep UI responsive if intro resume fails.
        } finally {
          introTimerSyncRef.current = 'idle';
        }
      })();
    }
  }, [code, isAsyncSession, participantToken, prompt, reveal, sessionStage, showIntroPanel, state?.currentRoundIndex, timerPauseSource, timersPaused]);

  useEffect(() => {
    if (!isAsyncSession || !participantToken || !prompt) return;
    if (!reveal || !timersPaused) return;
    if (timerPauseSource !== 'intro' && timerPauseSource !== 'score') return;

    setLocalTimerPauseHold(false);
    void (async () => {
      try {
        await controlCogitaLiveRevisionTimer({
          code,
          participantToken,
          action: 'resume',
          roundIndex: Number(prompt.roundIndex ?? state?.currentRoundIndex ?? 0),
          source: 'reveal'
        });
        const refreshed = await getCogitaLiveRevisionPublicState({ code, participantToken });
        setState(refreshed);
      } catch {
        // Ignore reveal resume errors.
      }
    })();
  }, [code, isAsyncSession, participantToken, prompt, reveal, state?.currentRoundIndex, timerPauseSource, timersPaused]);

  useEffect(() => {
    if (!participantToken || !isAsyncSession) return;

    const notifyLeave = () => {
      try {
        const payload = JSON.stringify({
          participantToken,
          roundIndex: Number(prompt?.roundIndex ?? state?.currentRoundIndex ?? 0)
        });
        navigator.sendBeacon(
          `${apiBase}/cogita/public/live-revision/${encodeURIComponent(code)}/leave`,
          new Blob([payload], { type: 'application/json' })
        );
      } catch {
        // Ignore unload transport errors.
      }
    };

    window.addEventListener('pagehide', notifyLeave);
    return () => {
      window.removeEventListener('pagehide', notifyLeave);
    };
  }, [apiBase, code, isAsyncSession, participantToken, prompt?.roundIndex, state?.currentRoundIndex]);

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

  const submitAnswer = async (options?: { force?: boolean; answerOverride?: unknown; acknowledgeOnly?: boolean }) => {
    if (!participantToken || !prompt || typeof prompt.cardKey !== 'string') return;
    const manualNextStep = isAsyncSession && Boolean(reveal) && prompt.nextQuestionMode === 'manual';
    if (!options?.force && timerExpired && effectiveQuestionTimer != null && !manualNextStep) return;
    if (state?.answerSubmitted && !manualNextStep && !options?.force) return;

    let answer: unknown = null;
    let includeAnswer = !Boolean(options?.acknowledgeOnly);
    const hasAnswerOverride = options && Object.prototype.hasOwnProperty.call(options, 'answerOverride');
    if (includeAnswer) {
      if (hasAnswerOverride) {
        answer = options?.answerOverride;
      } else {
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
      }
    }

    try {
      await submitCogitaLiveRevisionAnswer({
        code,
        participantToken,
        roundIndex: Number(prompt.roundIndex ?? state?.currentRoundIndex ?? 0),
        cardKey: prompt.cardKey,
        ...(includeAnswer ? { answer } : {})
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

  useEffect(() => {
    if (!participantToken || !prompt || !effectiveQuestionTimer) return;
    if (!timerExpired || state?.answerSubmitted) return;
    if (timersPaused) return;
    if (Boolean(reveal)) return;
    const timeoutKey = `${code}:${promptKey}:${state?.revealVersion ?? 0}`;
    if (timeoutSubmitKeyRef.current === timeoutKey) return;
    timeoutSubmitKeyRef.current = timeoutKey;
    void submitAnswer({ force: true });
  }, [code, effectiveQuestionTimer, participantToken, prompt, promptKey, reveal, state?.answerSubmitted, state?.revealVersion, timerExpired, timersPaused]);

  useEffect(() => {
    if (!participantToken || !prompt || !isAsyncSession || !reveal) return;
    if (prompt.nextQuestionMode !== 'timer') return;
    if (!nextQuestionTimer || nextQuestionTimer.remainingMs > 0) return;
    if (timersPaused) return;
    const timeoutKey = `${code}:${promptKey}:${state?.revealVersion ?? 0}:next`;
    if (timeoutNextKeyRef.current === timeoutKey) return;
    timeoutNextKeyRef.current = timeoutKey;
    void submitAnswer({ force: true, acknowledgeOnly: true });
  }, [
    code,
    isAsyncSession,
    nextQuestionTimer,
    participantToken,
    prompt,
    promptKey,
    reveal,
    state?.revealVersion,
    timersPaused
  ]);

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
  const asyncProgressByParticipant = useMemo(() => {
    const result = new Map<string, { answeredCount: number; cumulativeScores: number[]; roundsAnswered: number[] }>();
    const history = [...(state?.correctnessHistory ?? [])].sort((left, right) => {
      if ((left.roundIndex ?? 0) !== (right.roundIndex ?? 0)) {
        return (left.roundIndex ?? 0) - (right.roundIndex ?? 0);
      }
      return Date.parse(left.recordedUtc ?? '') - Date.parse(right.recordedUtc ?? '');
    });
    const latestByParticipantRound = new Map<string, { roundIndex: number; pointsAwarded: number; submittedUtcMs: number }>();
    history.forEach((round) => {
      const roundIndex = Number(round.roundIndex ?? 0);
      const entries = [...(round.entries ?? [])].sort(
        (left, right) => Date.parse(left.submittedUtc ?? '') - Date.parse(right.submittedUtc ?? '')
      );
      entries.forEach((entry) => {
        const participantId = String(entry.participantId ?? '').trim();
        if (!participantId) return;
        const key = `${participantId}::${roundIndex}`;
        const submittedUtcMs = Date.parse(entry.submittedUtc ?? '');
        const previous = latestByParticipantRound.get(key);
        if (!previous || submittedUtcMs >= previous.submittedUtcMs) {
          latestByParticipantRound.set(key, {
            roundIndex,
            pointsAwarded: Number.isFinite(entry.pointsAwarded) ? Math.round(Number(entry.pointsAwarded)) : 0,
            submittedUtcMs: Number.isFinite(submittedUtcMs) ? submittedUtcMs : 0
          });
        }
      });
    });
    const rowsByParticipant = new Map<string, Array<{ roundIndex: number; pointsAwarded: number }>>();
    latestByParticipantRound.forEach((row, key) => {
      const participantId = key.split('::')[0];
      const bucket = rowsByParticipant.get(participantId) ?? [];
      bucket.push({ roundIndex: row.roundIndex, pointsAwarded: row.pointsAwarded });
      rowsByParticipant.set(participantId, bucket);
    });
    rowsByParticipant.forEach((rows, participantId) => {
      rows.sort((left, right) => left.roundIndex - right.roundIndex);
      const cumulativeScores: number[] = [];
      const roundsAnswered: number[] = [];
      let running = 0;
      rows.forEach((row) => {
        running += row.pointsAwarded;
        cumulativeScores.push(running);
        roundsAnswered.push(row.roundIndex);
      });
      result.set(participantId, {
        answeredCount: rows.length,
        cumulativeScores,
        roundsAnswered
      });
    });
    return result;
  }, [state?.correctnessHistory]);
  const selfProgressCount = useMemo(() => {
    if (!isAsyncSession) return 0;
    const byParticipant = selfParticipantId ? asyncProgressByParticipant.get(selfParticipantId)?.answeredCount ?? 0 : 0;
    const fallbackByPosition =
      Math.max(0, Number(state?.currentRoundIndex ?? 0)) + (state?.answerSubmitted ? 1 : 0);
    return Math.max(byParticipant, fallbackByPosition);
  }, [asyncProgressByParticipant, isAsyncSession, selfParticipantId, state?.answerSubmitted, state?.currentRoundIndex]);
  const displayedScoreboard = useMemo<DisplayScoreRow[]>(() => {
    const rows = state?.scoreboard ?? [];
    const normalizedRows = rows.map((row) => {
      const sourceScore = Math.round(Number(row.score ?? 0));
      const progress = asyncProgressByParticipant.get(row.participantId);
      const answeredCount = progress?.answeredCount ?? 0;
      if (!isAsyncSession || selfProgressCount <= 0 || !progress || progress.cumulativeScores.length === 0) {
        return {
          participantId: row.participantId,
          displayName: row.displayName,
          score: sourceScore,
          answeredCount,
          comparedAnsweredCount: answeredCount
        };
      }
      const comparedAnsweredCount = Math.max(0, Math.min(selfProgressCount, answeredCount));
      const score =
        comparedAnsweredCount > 0
          ? progress.cumulativeScores[comparedAnsweredCount - 1] ?? 0
          : 0;
      return {
        participantId: row.participantId,
        displayName: row.displayName,
        score: Math.round(score),
        answeredCount,
        comparedAnsweredCount
      };
    });
    return normalizedRows.sort((left, right) => right.score - left.score || left.displayName.localeCompare(right.displayName));
  }, [asyncProgressByParticipant, isAsyncSession, selfProgressCount, state?.scoreboard]);
  const isSessionFinished = sessionStage === 'finished';
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
  const selfParticipantName = (state?.participantName ?? participantMeta?.name ?? joinName).trim();
  const isParticipantOnPodium = useMemo(() => {
    if (!isSessionFinished || podiumRows.length === 0) return false;
    if (selfParticipantId && podiumRows.some((row) => row.participantId === selfParticipantId)) {
      return true;
    }
    if (!selfParticipantName) return false;
    const needle = selfParticipantName.toLocaleLowerCase();
    return podiumRows.some((row) => row.displayName.trim().toLocaleLowerCase() === needle);
  }, [isSessionFinished, podiumRows, selfParticipantId, selfParticipantName]);
  const participantColorById = useMemo(() => {
    const mapping = new Map<string, string>();
    (state?.scoreboard ?? []).forEach((row, index) => {
      mapping.set(row.participantId, CHART_COLORS[index % CHART_COLORS.length]);
    });
    return mapping;
  }, [state?.scoreboard]);
  const liveStatisticsData = useMemo(() => buildLiveStatisticsResponse(state), [state]);
  const asyncScoreContextHelp = useMemo(() => {
    if (!isAsyncSession || selfProgressCount <= 0) return null;
    if (props.language === 'pl') {
      return `Porównanie pokazuje wyniki po ${selfProgressCount} odpowiedziach dla każdego uczestnika (Twój aktualny etap).`;
    }
    if (props.language === 'de') {
      return `Der Vergleich zeigt die Punkte jedes Teilnehmenden nach ${selfProgressCount} beantworteten Fragen (dein aktueller Stand).`;
    }
    return `The comparison shows each participant's score after ${selfProgressCount} answered questions (your current progress).`;
  }, [isAsyncSession, props.language, selfProgressCount]);
  const bonusExplanation = useMemo(() => {
    if (props.language === 'pl') {
      return '✓ punkty bazowe za poprawną odpowiedź, ⚡ bonus za pierwszą poprawną odpowiedź, ⏱ bonus szybkości zależny od pozostałego czasu, 🔥 bonus za serię poprawnych odpowiedzi, ✖ kara za złą odpowiedź.';
    }
    if (props.language === 'de') {
      return '✓ Basispunkte für richtige Antwort, ⚡ Bonus für die erste richtige Antwort, ⏱ Tempobonus abhängig von Restzeit, 🔥 Bonus für eine richtige Serie, ✖ Abzug für falsche Antwort.';
    }
    return '✓ base points for a correct answer, ⚡ first-correct bonus, ⏱ speed bonus based on remaining time, 🔥 streak bonus for consecutive correct answers, ✖ penalty for a wrong answer.';
  }, [props.language]);
  const configuredBonusRows = useMemo(() => {
    return [
      { key: 'base', label: liveCopy.factorBaseLabel, points: liveRules.scoring.baseCorrect },
      { key: 'first', label: liveCopy.factorFirstLabel, points: liveRules.scoring.firstCorrectBonus },
      {
        key: 'speed',
        label: liveCopy.factorSpeedLabel,
        points: liveRules.speedBonus.enabled ? liveRules.speedBonus.maxPoints : 0
      },
      { key: 'streak', label: liveCopy.factorStreakLabel, points: liveRules.scoring.streakBaseBonus },
      { key: 'wrong', label: liveCopy.factorWrongLabel, points: -liveRules.scoring.wrongAnswerPenalty },
      { key: 'first-wrong', label: liveCopy.factorFirstWrongLabel, points: -liveRules.scoring.firstWrongPenalty }
    ].filter((row) => row.points !== 0);
  }, [
    liveCopy.factorBaseLabel,
    liveCopy.factorFirstLabel,
    liveCopy.factorFirstWrongLabel,
    liveCopy.factorSpeedLabel,
    liveCopy.factorStreakLabel,
    liveCopy.factorWrongLabel,
    liveRules.scoring.baseCorrect,
    liveRules.scoring.firstCorrectBonus,
    liveRules.scoring.firstWrongPenalty,
    liveRules.scoring.streakBaseBonus,
    liveRules.scoring.wrongAnswerPenalty,
    liveRules.speedBonus.enabled,
    liveRules.speedBonus.maxPoints
  ]);

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
    const rows = displayedScoreboard;
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
  }, [displayedScoreboard, state?.revealVersion]);

  const timerBlocks = useMemo(() => {
    const blocks: Array<{ id: string; label: string; remainingMs: number; progress: number }> = [];
    if (effectiveQuestionTimer && visibleTimerRemainingMs != null) {
      blocks.push({
        id: 'question',
        label: liveCopy.timerLabel,
        remainingMs: visibleTimerRemainingMs,
        progress: visibleTimerProgress
      });
    }
    if (nextQuestionTimer && visibleNextRemainingMs != null) {
      blocks.push({
        id: 'next',
        label: liveCopy.nextQuestionTimerLabel,
        remainingMs: visibleNextRemainingMs,
        progress: visibleNextProgress
      });
    }
    if (fullSessionTimer && visibleSessionRemainingMs != null) {
      blocks.push({
        id: 'session',
        label: `${roundsLabelResolved} • ${liveCopy.timerLabel}`,
        remainingMs: visibleSessionRemainingMs,
        progress: visibleSessionProgress
      });
    }
    return blocks;
  }, [
    effectiveQuestionTimer,
    fullSessionTimer,
    liveCopy.nextQuestionTimerLabel,
    liveCopy.timerLabel,
    nextQuestionTimer,
    roundsLabelResolved,
    visibleNextProgress,
    visibleNextRemainingMs,
    visibleSessionProgress,
    visibleSessionRemainingMs,
    visibleTimerProgress,
    visibleTimerRemainingMs
  ]);

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
                    <input
                      value={joinName}
                      onChange={(event) => {
                        if (duplicateJoinName) setDuplicateJoinName(null);
                        setJoinName(event.target.value);
                      }}
                    />
                  </label>
                  <div className="cogita-form-actions">
                    <button type="button" className="cta" onClick={handleJoin} disabled={!joinName.trim() || status === 'joining'}>
                      {status === 'joining' ? liveCopy.joiningAction : liveCopy.joinAction}
                    </button>
                  </div>
                  {duplicateJoinName ? (
                    <>
                      <p className="cogita-help">{duplicateNameQuestionLabel(props.language, duplicateJoinName)}</p>
                      <div className="cogita-form-actions">
                        <button type="button" className="ghost" onClick={() => void handleJoin(true)} disabled={status === 'joining'}>
                          {useExistingParticipantLabel(props.language)}
                        </button>
                        <button type="button" className="ghost" onClick={() => setDuplicateJoinName(null)}>
                          {chooseDifferentNameLabel(props.language)}
                        </button>
                      </div>
                    </>
                  ) : null}
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
                      <input
                        value={joinName}
                        onChange={(event) => {
                          if (duplicateJoinName) setDuplicateJoinName(null);
                          setJoinName(event.target.value);
                        }}
                      />
                    </label>
                    <div className="cogita-form-actions">
                      <button type="button" className="cta" onClick={handleJoin} disabled={!joinName.trim() || status === 'joining'}>
                        {status === 'joining' ? liveCopy.joiningAction : liveCopy.joinAction}
                      </button>
                    </div>
                    {duplicateJoinName ? (
                      <>
                        <p className="cogita-help">{duplicateNameQuestionLabel(props.language, duplicateJoinName)}</p>
                        <div className="cogita-form-actions">
                          <button type="button" className="ghost" onClick={() => void handleJoin(true)} disabled={status === 'joining'}>
                            {useExistingParticipantLabel(props.language)}
                          </button>
                          <button type="button" className="ghost" onClick={() => setDuplicateJoinName(null)}>
                            {chooseDifferentNameLabel(props.language)}
                          </button>
                        </div>
                      </>
                    ) : null}
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
                      {displayedScoreboard.map((row) => {
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
                              {isAsyncSession && selfProgressCount > 0 ? (
                                <span>{` · ${row.comparedAnsweredCount}/${selfProgressCount}`}</span>
                              ) : null}
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
                      {state && displayedScoreboard.length === 0 ? <p className="cogita-help">{liveCopy.noParticipants}</p> : null}
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
                    {isSessionFinished ? (
                      <div className="cogita-live-finished-layout">
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
                        <section className="cogita-library-panel cogita-live-podium-wrap">
                          {isParticipantOnPodium ? (
                            <div className="cogita-live-podium-celebration-layer" aria-hidden="true">
                              <PodiumFireworksLayer active={status === 'ready' && isSessionFinished && isParticipantOnPodium} />
                            </div>
                          ) : null}
                          <p className="cogita-user-kicker">{liveCopy.podiumTitle}</p>
                          {podiumRows.length > 0 ? (
                            <div className="cogita-live-podium" role="presentation">
                              {podiumDisplayRows.map((row) => {
                                const order = podiumRows.findIndex((entry) => entry.participantId === row.participantId) + 1;
                                const color = participantColorById.get(row.participantId) ?? CHART_COLORS[Math.max(0, order - 1) % CHART_COLORS.length];
                                const heightByRank: Record<number, number> = { 1: 100, 2: 74, 3: 58 };
                                const height = heightByRank[order] ?? 52;
                                return (
                                  <div key={`participant-podium:${row.participantId}`} className="cogita-live-podium-slot" data-rank={order}>
                                    <div className="cogita-live-podium-name" title={row.displayName}>{row.displayName}</div>
                                    <div className="cogita-live-podium-pillar" style={{ height: `${height}%`, borderColor: color, boxShadow: `inset 0 0 0 1px ${color}55, 0 0 18px ${color}33` }}>
                                      <span className="cogita-live-podium-medal" style={{ background: color }}>{order}</span>
                                      <strong>{`${row.score} ${liveCopy.scoreUnit}`}</strong>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="cogita-help">{liveCopy.noParticipants}</p>
                          )}
                        </section>
                      </div>
                    ) : (
                      <>
                        <p className="cogita-user-kicker">{liveCopy.questionTitle}</p>
                        <h3 className="cogita-detail-title">{typeof prompt?.title === 'string' ? prompt.title : liveCopy.waitingForPublishedRound}</h3>
                        {isAsyncSession && participantToken ? (
                          <div className="cogita-form-actions">
                            <button type="button" className="ghost" onClick={clearStoredParticipantData}>
                              {switchParticipantActionLabel(props.language)}
                            </button>
                          </div>
                        ) : null}
                        {sessionStage === 'active' && prompt
                          ? timerBlocks.map((timer) => (
                              <div className="cogita-live-timer" key={`timer:${timer.id}`}>
                                <div className="cogita-live-timer-head">
                                  <span>{timer.label}</span>
                                  <strong>{`${Math.max(0, Math.ceil(timer.remainingMs / 1000))}s`}</strong>
                                </div>
                                <div className="cogita-live-timer-track">
                                  <span style={{ width: `${Math.round(timer.progress * 100)}%` }} />
                                </div>
                              </div>
                            ))
                          : null}
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
                        <div className="cogita-live-round-gain-list">
                          <div className="cogita-live-round-gain-row">
                            <span>{liveCopy.factorBaseLabel}</span>
                            <strong>
                              {`${formatPoints(selfRoundBreakdown.rows.find((row) => row.key === 'base')?.points ?? 0)} ${liveCopy.scoreUnit}`}
                            </strong>
                          </div>
                          <div className="cogita-live-round-gain-row">
                            <span>{`${liveCopy.factorFirstLabel} + ${liveCopy.factorSpeedLabel} + ${liveCopy.factorStreakLabel}`}</span>
                            <strong>{`${formatPoints(selfRoundBreakdown.bonusTotal)} ${liveCopy.scoreUnit}`}</strong>
                          </div>
                          <div className="cogita-live-round-gain-row">
                            <span>{`${liveCopy.factorWrongLabel} + ${liveCopy.factorFirstWrongLabel}`}</span>
                            <strong>{`${formatPoints(-selfRoundBreakdown.penaltyTotal)} ${liveCopy.scoreUnit}`}</strong>
                          </div>
                        </div>
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
                    {(() => {
                      const revealStep = isAsyncSession && Boolean(reveal);
                      const showSubmitButton = !reveal || revealStep;
                      if (!showSubmitButton) return null;
                      return (
                        <div className="cogita-form-actions">
                          <button
                            type="button"
                            className="cta"
                            onClick={() => {
                              if (revealStep) {
                                void submitAnswer({ force: true, acknowledgeOnly: true });
                                return;
                              }
                              void submitAnswer();
                            }}
                            disabled={!participantToken || !prompt.cardKey || (!revealStep && (Boolean(state?.answerSubmitted) || timerExpired))}
                          >
                            {revealStep
                              ? liveCopy.nextQuestionAction
                              : state?.answerSubmitted
                                ? liveCopy.submitted
                                : liveCopy.submitAnswer}
                          </button>
                          {revealStep && prompt.nextQuestionMode === 'timer' && nextQuestionTimer ? (
                            <button type="button" className="ghost" onClick={toggleTimersPaused}>
                              {timersPaused ? resumeTimerLabel(props.language) : pauseTimerLabel(props.language)}
                            </button>
                          ) : null}
                        </div>
                      );
                    })()}
                    {timerExpired ? <p className="cogita-help">{liveCopy.timeExpired}</p> : null}
                  </>
                ) : (
                  <p className="cogita-help">
                    {sessionStage === 'finished' ? liveCopy.finalScoreTitle : liveCopy.waitingForHostQuestion}
                  </p>
                )}
                      </>
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
                  <p className="cogita-help">{bonusExplanation}</p>
                  {asyncScoreContextHelp ? <p className="cogita-help">{asyncScoreContextHelp}</p> : null}
                  {configuredBonusRows.length > 0 ? (
                    <div className="cogita-live-round-gain">
                      <p className="cogita-user-kicker">{bonusListTitle(props.language)}</p>
                      <div className="cogita-live-round-gain-list">
                        {configuredBonusRows.map((row) => (
                          <div className="cogita-live-round-gain-row" key={`bonus-config:${row.key}`}>
                            <span>{row.label}</span>
                            <strong>{`${formatPoints(Math.round(row.points))} ${liveCopy.scoreUnit}`}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {!isAsyncSession && podiumRows.length > 0 ? (
                    <section className="cogita-live-podium-wrap">
                      {isParticipantOnPodium ? (
                        <div className="cogita-live-podium-celebration-layer" aria-hidden="true">
                          <PodiumFireworksLayer active={status === 'ready' && isSessionFinished && isParticipantOnPodium} />
                        </div>
                      ) : null}
                      <p className="cogita-user-kicker">{liveCopy.podiumTitle}</p>
                      <div className="cogita-live-podium" role="presentation">
                        {podiumDisplayRows.map((row) => {
                          const order = podiumRows.findIndex((entry) => entry.participantId === row.participantId) + 1;
                          const color = participantColorById.get(row.participantId) ?? CHART_COLORS[Math.max(0, order - 1) % CHART_COLORS.length];
                          const heightByRank: Record<number, number> = { 1: 100, 2: 74, 3: 58 };
                          const height = heightByRank[order] ?? 52;
                          return (
                            <div key={`overlay-podium:${row.participantId}`} className="cogita-live-podium-slot" data-rank={order}>
                              <div className="cogita-live-podium-name" title={row.displayName}>{row.displayName}</div>
                              <div className="cogita-live-podium-pillar" style={{ height: `${height}%`, borderColor: color, boxShadow: `inset 0 0 0 1px ${color}55, 0 0 18px ${color}33` }}>
                                <span className="cogita-live-podium-medal" style={{ background: color }}>{order}</span>
                                <strong>{`${row.score} ${liveCopy.scoreUnit}`}</strong>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}
                  <div className="cogita-share-list">
                    {displayedScoreboard.map((row) => {
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
                            {isAsyncSession && selfProgressCount > 0 ? ` · ${row.comparedAnsweredCount}/${selfProgressCount}` : ''}
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
                    {state && displayedScoreboard.length === 0 ? <p className="cogita-help">{liveCopy.noParticipants}</p> : null}
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
