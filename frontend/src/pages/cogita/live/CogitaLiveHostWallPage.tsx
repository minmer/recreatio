import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  attachCogitaLiveRevisionSession,
  getCogitaCollectionCards,
  getCogitaComputedSample,
  getCogitaInfoDetail,
  getCogitaLiveRevisionSession,
  removeCogitaLiveRevisionParticipant,
  getCogitaRevision,
  scoreCogitaLiveRevisionRound,
  updateCogitaLiveRevisionHostState,
  type CogitaLiveRevisionAnswer,
  type CogitaLiveRevisionParticipant,
  type CogitaLiveRevisionSession,
  type CogitaComputedSample
} from '../../../lib/api';
import { clampInt, parseLiveRules } from './liveSessionRules';
import { evaluateCheckcardAnswer } from '../library/checkcards/checkcardRuntime';
import { CogitaCheckcardSurface } from '../library/collections/components/CogitaCheckcardSurface';
import { CogitaLivePromptCard, type LivePrompt } from './components/CogitaLivePromptCard';
import { buildQuoteFragmentContext, buildQuoteFragmentTree } from '../../../cogita/revision/quote';
import { selectNextCardIndexByMode } from '../../../cogita/revision/nextCardRoutine';
import { getRevisionType, normalizeRevisionSettings } from '../../../cogita/revision/registry';
import { buildRevisionQuestionRuntime } from '../library/collections/revisionShared';
import { collectCardsWithSharedLoader, normalizeLoadedCards } from '../../../cogita/revision/cardLoader';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaLiveWallLayout } from './components/CogitaLiveWallLayout';

function parseBooleanLike(value: unknown): boolean | null {
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
    return parseBooleanLike(root.booleanAnswer) ?? parseBooleanLike(root.expected) ?? parseBooleanLike(root.value);
  }
  return null;
}

function normalizeAnswer(answer: unknown, prompt: LivePrompt | null) {
  if (!prompt) return {};
  const kind = String(prompt.kind ?? '');
  if (kind === 'selection') return { selection: Array.isArray(answer) ? answer.map((x) => Number(x)).filter(Number.isFinite) : [] };
  if (kind === 'boolean') return { booleanAnswer: parseBooleanLike(answer) };
  if (kind === 'ordering') return { ordering: Array.isArray(answer) ? answer.map(String) : [] };
  if (kind === 'matching') {
    const root = answer && typeof answer === 'object' ? (answer as Record<string, unknown>) : {};
    const paths = Array.isArray(root.paths) ? root.paths.map((row) => (Array.isArray(row) ? row.map((x) => Number(x)).filter(Number.isFinite) : [])) : [];
    return { matchingPaths: paths };
  }
  return { text: String(answer ?? '') };
}

function formatAnswer(answer: unknown) {
  if (answer == null) return '-';
  if (typeof answer === 'string') return answer;
  if (typeof answer === 'number' || typeof answer === 'boolean') return String(answer);
  try {
    return JSON.stringify(answer);
  } catch {
    return String(answer);
  }
}

type HostTimer = {
  key: 'action' | 'bonus' | 'round' | 'next';
  label: string;
  totalSeconds: number;
  remainingMs: number;
  progress: number;
};

type LiveReveal = {
  kind: LivePrompt['kind'];
  expected: unknown;
  title: string;
};

type LiveRound = {
  roundIndex: number;
  cardKey: string;
  publicPrompt: LivePrompt;
  reveal: LiveReveal;
  grade: (answer: unknown) => boolean;
};

type RoundGain = {
  points: number;
  factors: string[];
  streak: number;
  rankDelta: number;
  basePoints?: number;
  firstBonusPoints?: number;
  speedPoints?: number;
  streakPoints?: number;
  wrongPenaltyPoints?: number;
  firstWrongPenaltyPoints?: number;
  wrongStreakPenaltyPoints?: number;
};

function parseWordPair(label: string) {
  const parts = label.split('↔').map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 2) return [parts[0], parts[1]] as const;
  return null;
}

function parseLanguageDescription(description?: string | null) {
  if (!description) return null;
  const idx = description.indexOf(':');
  if (idx >= 0) return description.slice(idx + 1).trim();
  return description.trim();
}

function shuffleStrings(values: string[]) {
  const next = [...values];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function growthRatio(mode: string, ratio: number) {
  const clamped = Math.max(0, Math.min(1, ratio));
  if (mode === 'exponential') return clamped * clamped;
  if (mode === 'limited') return Math.min(1, clamped * 1.6);
  return clamped;
}

function streakBonus(mode: string, base: number, streak: number, limit: number) {
  const maxBonus = Math.max(0, base);
  const extraCount = Math.max(0, streak - 1);
  if (maxBonus === 0 || extraCount === 0) return 0;
  const fullAfter = Math.max(1, limit);
  const progress = Math.max(0, Math.min(1, extraCount / fullAfter));
  return clampInt(growthRatio(mode, progress) * maxBonus, 0, 100000);
}

function buildRankMap(
  participants: Array<{ participantId: string; score: number; joinedUtc?: string }>
) {
  const ordered = [...participants].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.joinedUtc ?? '').localeCompare(String(b.joinedUtc ?? ''));
  });
  const map = new Map<string, number>();
  ordered.forEach((entry, index) => map.set(entry.participantId, index + 1));
  return map;
}

function buildQuestionRound(
  infoId: string,
  titleFallback: string,
  sourcePayload: unknown,
  roundIndex: number
): LiveRound | null {
  const runtime = buildRevisionQuestionRuntime(sourcePayload, titleFallback);
  if (!runtime) return null;
  const title = runtime.promptText || titleFallback;

  if (runtime.promptPayload.kind === 'selection') {
    const options = runtime.promptPayload.options ?? [];
    const expected = Array.isArray(runtime.expectedModel) ? runtime.expectedModel.map((x) => Number(x)).filter(Number.isFinite) : [];
    return {
      roundIndex,
      cardKey: `info:${infoId}:question-selection`,
      publicPrompt: { kind: 'selection', title, prompt: runtime.promptText, options, multiple: runtime.promptPayload.multiple, cardLabel: 'question' },
      reveal: { kind: 'selection', expected, title },
      grade: (answer) =>
        evaluateCheckcardAnswer({
          prompt: runtime.promptModel,
          expected: runtime.expectedModel,
          answer: { selection: Array.isArray(answer) ? answer.map((entry) => Number(entry)).filter(Number.isFinite) : [] }
        }).correct
    };
  }

  if (runtime.promptPayload.kind === 'boolean') {
    return {
      roundIndex,
      cardKey: `info:${infoId}:question-truefalse`,
      publicPrompt: { kind: 'boolean', title, prompt: runtime.promptText, cardLabel: 'question' },
      reveal: { kind: 'boolean', expected: runtime.expectedModel, title },
      grade: (answer) =>
        evaluateCheckcardAnswer({
          prompt: runtime.promptModel,
          expected: runtime.expectedModel,
          answer: { booleanAnswer: parseBooleanLike(answer) }
        }).correct
    };
  }

  if (runtime.promptPayload.kind === 'ordering') {
    const options = runtime.promptPayload.options ?? [];
    const randomizedOptions = options.length > 1 ? shuffleStrings(options) : [...options];
    return {
      roundIndex,
      cardKey: `info:${infoId}:question-ordering`,
      publicPrompt: { kind: 'ordering', title, prompt: runtime.promptText, options: randomizedOptions, cardLabel: 'question' },
      reveal: { kind: 'ordering', expected: runtime.expectedModel, title },
      grade: (answer) =>
        evaluateCheckcardAnswer({
          prompt: runtime.promptModel,
          expected: runtime.expectedModel,
          answer: { ordering: Array.isArray(answer) ? answer.map(String) : [] }
        }).correct
    };
  }

  if (runtime.promptPayload.kind === 'matching') {
    const columns = runtime.promptPayload.columns ?? [];
    return {
      roundIndex,
      cardKey: `info:${infoId}:question-matching`,
      publicPrompt: { kind: 'matching', title, prompt: runtime.promptText, columns, cardLabel: 'question' },
      reveal: { kind: 'matching', expected: runtime.expectedModel, title },
      grade: (answer) =>
        evaluateCheckcardAnswer({
          prompt: runtime.promptModel,
          expected: runtime.expectedModel,
          answer: {
            matchingPaths:
              answer && typeof answer === 'object' && Array.isArray((answer as { paths?: unknown[] }).paths)
                ? ((answer as { paths?: unknown[] }).paths as unknown[])
                    .map((row) => (Array.isArray(row) ? row.map((entry) => Number(entry)).filter(Number.isFinite) : []))
                    .filter((row) => row.length > 0)
                : []
          }
        }).correct
    };
  }

  return {
    roundIndex,
    cardKey: `info:${infoId}:question-text`,
    publicPrompt: {
      kind: 'text',
      title,
      prompt: runtime.promptText,
      inputType: runtime.promptPayload.inputType ?? 'text',
      cardLabel: 'question'
    },
    reveal: { kind: 'text', expected: runtime.expectedModel, title },
    grade: (answer) =>
      evaluateCheckcardAnswer({
        prompt: runtime.promptModel,
        expected: runtime.expectedModel,
        answer: { text: String(answer ?? '') }
      }).correct
  };
}

async function buildLiveRounds(payload: {
  libraryId: string;
  revisionId: string;
  labels?: {
    selectMatchingPairPrompt?: string;
    wordLanguagePromptPrefix?: string;
  };
  onPreparedCount?: (count: number) => void;
}): Promise<{ rounds: LiveRound[]; revisionMode: string }> {
  const revision = await getCogitaRevision({ libraryId: payload.libraryId, revisionId: payload.revisionId });
  const revisionType = getRevisionType(revision.revisionType ?? revision.mode);
  const revisionLimit = Math.max(1, Number(revision.limit ?? 20));
  const revisionSettings = normalizeRevisionSettings(
    revisionType,
    (revision.revisionSettings as Record<string, number | string> | null | undefined) ?? null
  );
  const fetchLimit = revisionType.getFetchLimit(revisionLimit, revisionSettings);
  const gatheredCards = await collectCardsWithSharedLoader({
    fetchPage: ({ limit, cursor }) =>
      getCogitaCollectionCards({
        libraryId: payload.libraryId,
        collectionId: revision.collectionId,
        limit,
        cursor
      }),
    mode: revisionType.id,
    fetchLimit,
    pageSize: 300
  });
  const normalizedCards = normalizeLoadedCards(gatheredCards);
  const prepared = revisionType.prepare(normalizedCards, revisionLimit, revisionSettings);
  const preparedPool = (prepared.meta as { pool?: typeof normalizedCards } | null)?.pool;
  const cards =
    Array.isArray(preparedPool) && preparedPool.length > 0
      ? preparedPool
      : prepared.queue.length > 0
        ? prepared.queue
        : normalizedCards;
  const infoIds = Array.from(new Set(cards.filter((c) => c.cardType === 'info').map((c) => c.cardId)));

  const infoDetails = new Map<string, { infoType: string; payload: unknown }>();
  await Promise.all(
    infoIds.map(async (id) => {
      try {
        const detail = await getCogitaInfoDetail({ libraryId: payload.libraryId, infoId: id });
        infoDetails.set(id, { infoType: detail.infoType, payload: detail.payload });
      } catch {
        // skip
      }
    })
  );

  const computedSamples = new Map<string, CogitaComputedSample>();
  await Promise.all(
    Array.from(infoDetails.entries())
      .filter(([, d]) => d.infoType === 'computed')
      .map(async ([infoId]) => {
        try {
          const sample = await getCogitaComputedSample({ libraryId: payload.libraryId, infoId });
          computedSamples.set(infoId, sample);
        } catch {
          // skip
        }
      })
  );

  const vocabLabels = Array.from(new Set(cards.filter((c) => c.cardType === 'vocab').map((c) => c.label))).filter(Boolean);
  const labels = {
    selectMatchingPairPrompt: payload.labels?.selectMatchingPairPrompt ?? 'Select the matching pair',
    wordLanguagePromptPrefix: payload.labels?.wordLanguagePromptPrefix ?? 'Language of'
  };

  const rounds: LiveRound[] = [];
  const notifyPreparedCount = () => {
    payload.onPreparedCount?.(rounds.length);
  };
  const citationProcessed = new Set<string>();
  for (const card of cards) {
    if (card.cardType === 'vocab') {
      const pair = parseWordPair(card.label);
      if (!pair) continue;
      if (card.checkType === 'translation' && card.direction === 'a-to-b') {
        const [a, b] = pair;
        rounds.push({
          roundIndex: rounds.length,
          cardKey: `connection:${card.cardId}:translation:a-to-b`,
          publicPrompt: { kind: 'text', title: card.label, prompt: a, cardLabel: card.description ?? undefined },
          reveal: { kind: 'text', expected: b, title: card.label },
          grade: (answer) =>
            evaluateCheckcardAnswer({
              prompt: { kind: 'text', inputType: 'text' },
              expected: b,
              answer: { text: String(answer ?? '') }
            }).correct
        });
        if (rounds.length % 5 === 0) notifyPreparedCount();
      } else if (card.checkType === 'translation' && card.direction === 'b-to-a') {
        const [a, b] = pair;
        rounds.push({
          roundIndex: rounds.length,
          cardKey: `connection:${card.cardId}:translation:b-to-a`,
          publicPrompt: { kind: 'text', title: card.label, prompt: b, cardLabel: card.description ?? undefined },
          reveal: { kind: 'text', expected: a, title: card.label },
          grade: (answer) =>
            evaluateCheckcardAnswer({
              prompt: { kind: 'text', inputType: 'text' },
              expected: a,
              answer: { text: String(answer ?? '') }
            }).correct
        });
        if (rounds.length % 5 === 0) notifyPreparedCount();
      } else if (card.checkType === 'translation-match') {
        const options = Array.from(new Set([card.label, ...vocabLabels.filter((x) => x !== card.label).slice(0, 3)]));
        const correctIndex = options.findIndex((x) => x === card.label);
        rounds.push({
          roundIndex: rounds.length,
          cardKey: `connection:${card.cardId}:translation-match`,
          publicPrompt: {
            kind: 'selection',
            title: card.label,
            prompt: labels.selectMatchingPairPrompt,
            options,
            multiple: false,
            cardLabel: card.description ?? undefined
          },
          reveal: { kind: 'selection', expected: [correctIndex], title: card.label },
          grade: (answer) =>
            evaluateCheckcardAnswer({
              prompt: { kind: 'selection', options },
              expected: [correctIndex],
              answer: {
                selection: Array.isArray(answer)
                  ? answer.map((entry) => Number(entry)).filter(Number.isFinite)
                  : [Number(answer)].filter(Number.isFinite)
              }
            }).correct
        });
        if (rounds.length % 5 === 0) notifyPreparedCount();
      }
      continue;
    }

    if (card.cardType !== 'info') continue;
    const detail = infoDetails.get(card.cardId);
    const normalizedInfoType = String(detail?.infoType ?? card.infoType ?? '').toLowerCase();
    const sourcePayload = detail?.payload ?? card.payload;
    const normalizedCheckType = String(card.checkType ?? '').toLowerCase();

    const directQuestionRound = buildQuestionRound(card.cardId, card.label, sourcePayload, rounds.length);
    if (directQuestionRound) {
      const round = directQuestionRound;
      if (round) {
        round.roundIndex = rounds.length;
        rounds.push(round);
        if (rounds.length % 5 === 0) notifyPreparedCount();
      }
      continue;
    }

    if ((normalizedInfoType === 'word' || normalizedCheckType === 'word-language') && normalizedCheckType === 'word-language') {
      const expected = parseLanguageDescription(card.description);
      if (!expected) continue;
      rounds.push({
        roundIndex: rounds.length,
        cardKey: `info:${card.cardId}:word-language:${card.direction ?? ''}`,
        publicPrompt: { kind: 'text', title: card.label, prompt: `${labels.wordLanguagePromptPrefix}: ${card.label}`, cardLabel: 'word-language' },
        reveal: { kind: 'text', expected, title: card.label },
        grade: (answer) =>
          evaluateCheckcardAnswer({
            prompt: { kind: 'text', inputType: 'text' },
            expected,
            answer: { text: String(answer ?? '') }
          }).correct
      });
      if (rounds.length % 5 === 0) notifyPreparedCount();
      continue;
    }

    if ((normalizedInfoType === 'computed' || normalizedCheckType === 'computed') && normalizedCheckType === 'computed') {
      const sample = computedSamples.get(card.cardId);
      if (!sample) continue;
      rounds.push({
        roundIndex: rounds.length,
        cardKey: `info:${card.cardId}:computed`,
        publicPrompt: { kind: 'text', title: card.label, prompt: sample.prompt, multiLine: false, cardLabel: 'computed' },
        reveal: { kind: 'text', expected: sample.expectedAnswer, title: card.label },
        grade: (answer) =>
          evaluateCheckcardAnswer({
            prompt: { kind: 'text', inputType: 'text' },
            expected: sample.expectedAnswer,
            answer: { text: String(answer ?? '') }
          }).correct
      });
      if (rounds.length % 5 === 0) notifyPreparedCount();
      continue;
    }

    if (normalizedInfoType === 'question' || normalizedCheckType.startsWith('question')) {
      const def = parseQuestionDefinition(sourcePayload);
      const round = def ? buildQuestionRound(card.cardId, card.label, def, rounds.length) : null;
      if (round) {
        round.roundIndex = rounds.length;
        rounds.push(round);
        if (rounds.length % 5 === 0) notifyPreparedCount();
      }
      continue;
    }

    if (normalizedInfoType === 'citation' && !citationProcessed.has(card.cardId)) {
      citationProcessed.add(card.cardId);
      const root = (sourcePayload ?? {}) as Record<string, unknown>;
      const text = typeof root.text === 'string' ? root.text : '';
      const title = typeof root.title === 'string' && root.title.trim() ? root.title.trim() : card.label;
      if (!text.trim()) continue;
      const tree = buildQuoteFragmentTree(text, { minLen: 7, maxLen: 13 });
      for (const fragmentId of tree.order) {
        const node = tree.nodes[fragmentId];
        if (!node) continue;
        const ctx = buildQuoteFragmentContext(text, node);
        rounds.push({
          roundIndex: rounds.length,
          cardKey: `info:${card.cardId}:quote-fragment:${fragmentId}`,
          publicPrompt: {
            kind: 'citation-fragment',
            title,
            before: ctx.before,
            after: ctx.after,
            fragmentId,
            cardLabel: 'quote-fragment'
          },
          reveal: { kind: 'citation-fragment', expected: ctx.fragment, title },
          grade: (answer) =>
            evaluateCheckcardAnswer({
              prompt: { kind: 'citation-fragment' },
              expected: ctx.fragment,
              answer: { text: String(answer ?? '') }
            }).correct
        });
        if (rounds.length % 5 === 0) notifyPreparedCount();
      }
    }
  }

  const preparedRounds = rounds.map((round, index) => ({ ...round, roundIndex: index }));
  notifyPreparedCount();
  return {
    rounds: preparedRounds,
    revisionMode: String(revision.revisionType ?? revision.mode ?? 'random').toLowerCase()
  };
}

export function CogitaLiveHostWallPage({
  copy,
  libraryId,
  revisionId,
  sessionId,
  hostSecret,
  language
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
  libraryId: string;
  revisionId: string;
  sessionId: string;
  hostSecret: string;
}) {
  const liveCopy = copy.cogita.library.revision.live;
  const [session, setSession] = useState<CogitaLiveRevisionSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState<'none' | 'reveal' | 'score' | 'next' | 'finish' | 'remove'>('none');
  const [roundsStatus, setRoundsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [preparedCount, setPreparedCount] = useState(0);
  const [effectiveHostSecret, setEffectiveHostSecret] = useState(hostSecret);
  const [rounds, setRounds] = useState<LiveRound[]>([]);
  const [revisionMode, setRevisionMode] = useState('random');
  const [roundLoadError, setRoundLoadError] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [scoreFxByParticipant, setScoreFxByParticipant] = useState<Record<string, { delta: number; rankShift: number; token: number }>>({});
  const prevScoresRef = useRef<Map<string, number>>(new Map());
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const reattachPromiseRef = useRef<Promise<string | null> | null>(null);
  const initialAttachKeyRef = useRef<string>('');
  const roundsLoadPromiseRef = useRef<Promise<{ rounds: LiveRound[]; revisionMode: string } | null> | null>(null);
  const startInFlightRef = useRef(false);
  const mutationInFlightRef = useRef(false);
  const sessionRef = useRef<CogitaLiveRevisionSession | null>(null);
  const autoActionLockRef = useRef<string | null>(null);
  const streakByParticipantRef = useRef<Record<string, number>>({});
  const wrongStreakByParticipantRef = useRef<Record<string, number>>({});
  const scoredRoundKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setEffectiveHostSecret(hostSecret);
  }, [hostSecret]);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  const currentRound = session ? rounds[session.currentRoundIndex] ?? null : null;
  const isAsyncSession = session?.sessionMode === 'asynchronous';
  const prompt = isAsyncSession
    ? null
    : ((session?.currentPrompt as LivePrompt | undefined) ??
        (session?.status && session.status !== 'lobby' ? currentRound?.publicPrompt : null)) ??
      null;
  const promptRoot = (prompt && typeof prompt === 'object' ? (prompt as Record<string, unknown>) : null);
  const reveal = (session?.currentReveal as Record<string, unknown> | undefined) ?? null;
  const rules = useMemo(() => parseLiveRules(session?.sessionSettings), [session?.sessionSettings]);
  const participantById = useMemo(() => new Map((session?.participants ?? []).map((p) => [p.participantId, p])), [session?.participants]);
  const scoresById = useMemo(() => new Map((session?.scoreboard ?? []).map((row) => [row.participantId, row.score])), [session?.scoreboard]);
  const roundAnswers = useMemo(() => {
    const currentRound = session?.currentRoundIndex ?? 0;
    const cardKey = String(currentRound != null ? (rounds[currentRound]?.cardKey ?? '') : '');
    return (session?.currentRoundAnswers ?? []).filter((row) => row.roundIndex === currentRound && (!cardKey || String(row.cardKey ?? '') === cardKey));
  }, [rounds, session?.currentRoundAnswers, session?.currentRoundIndex]);
  const revealExpected = reveal?.expected ?? currentRound?.reveal.expected;
  const currentRoundKey = useMemo(
    () => (session && currentRound ? `${session.sessionId}:${session.currentRoundIndex}:${currentRound.cardKey}` : ''),
    [currentRound, session]
  );
  const hasPublishedRound = Boolean(
    (prompt && typeof prompt === 'object' && typeof (prompt as { cardKey?: unknown }).cardKey === 'string' && String((prompt as { cardKey?: unknown }).cardKey).length > 0) ||
      (session?.currentPrompt && typeof session.currentPrompt === 'object' && typeof (session.currentPrompt as { cardKey?: unknown }).cardKey === 'string')
  );
  const hasRevealRoundScoring =
    reveal && typeof reveal === 'object' && reveal.roundScoring && typeof reveal.roundScoring === 'object';
  const isCurrentRoundScored = Boolean(
    currentRoundKey &&
      (scoredRoundKeysRef.current.has(currentRoundKey) ||
        (session?.status === 'revealed' && hasRevealRoundScoring))
  );
  const isLobbyStage = session?.status === 'lobby' && !hasPublishedRound;
  const isRunningStage = !isLobbyStage && session?.status !== 'closed' && session?.status !== 'finished';
  const roundPhase = useMemo(() => {
    if (!session) return 'lobby' as const;
    if (session.status === 'closed' || session.status === 'finished') return 'closed' as const;
    if (isLobbyStage) return 'lobby' as const;
    if (!hasPublishedRound) return 'lobby' as const;
    if (isCurrentRoundScored) return 'scored' as const;
    if (session.status === 'revealed' || Boolean(reveal)) return 'revealed' as const;
    return 'question' as const;
  }, [hasPublishedRound, isCurrentRoundScored, isLobbyStage, reveal, session]);
  const hidePreRevealTimers = roundPhase === 'revealed' || roundPhase === 'scored';
  const actionTimerStarted =
    typeof promptRoot?.actionTimerStartedUtc === 'string' && promptRoot.actionTimerStartedUtc.length > 0;
  const mutationInFlight = mutationInFlightRef.current || busy !== 'none';
  const canStartSession = Boolean(
    session?.status === 'lobby' &&
      !hasPublishedRound &&
      !mutationInFlight &&
      roundsStatus === 'ready' &&
      rounds.length > 0
  );
  const canStartTimer = Boolean(
    !isAsyncSession &&
      isRunningStage &&
      rules.firstAnswerAction === 'start_timer' &&
      rules.actionTimer.enabled &&
      !actionTimerStarted &&
      !mutationInFlight
  );
  const canCheckReveal = Boolean(
    !isAsyncSession &&
    isRunningStage &&
      (roundPhase === 'question' || roundPhase === 'revealed') &&
      !isCurrentRoundScored &&
      !mutationInFlight
  );
  const canScore = Boolean(
    !isAsyncSession &&
    isRunningStage &&
      (roundPhase === 'question' || roundPhase === 'revealed') &&
      !isCurrentRoundScored &&
      !mutationInFlight
  );
  const canNextQuestion = Boolean(
    !isAsyncSession &&
    isRunningStage &&
      hasPublishedRound &&
      (roundPhase === 'question' || roundPhase === 'revealed' || roundPhase === 'scored') &&
      !mutationInFlight
  );
  const canEndGame = Boolean(
    session &&
      session.status !== 'finished' &&
      session.status !== 'closed' &&
      !isLobbyStage &&
      !mutationInFlight
  );
  const canStopAutoNextTimer = Boolean(
    !isAsyncSession &&
    isRunningStage &&
      roundPhase === 'scored' &&
      promptRoot?.nextQuestionMode === 'timer' &&
      typeof promptRoot?.autoNextEndsUtc === 'string' &&
      promptRoot.autoNextEndsUtc.length > 0 &&
      !mutationInFlight
  );
  const answeredCount = roundAnswers.length;
  const participantCount = session?.participants.length ?? 0;
  const cardsLeftCount = useMemo(() => {
    if (rounds.length === 0) return 0;
    if (!hasPublishedRound) return rounds.length;
    const askedRaw = Array.isArray(promptRoot?.askedCardKeys) ? (promptRoot.askedCardKeys as unknown[]) : [];
    const askedSet = new Set(askedRaw.map((key) => String(key)).filter((key) => key.length > 0));
    if (askedSet.size === 0 && currentRound?.cardKey) {
      askedSet.add(currentRound.cardKey);
    }
    return Math.max(0, rounds.length - askedSet.size);
  }, [currentRound?.cardKey, hasPublishedRound, promptRoot?.askedCardKeys, rounds.length]);
  const cardsLeftLabel =
    String(liveCopy.cardsLeftLabel ?? 'Cards left: {count}').replace('{count}', String(cardsLeftCount));

  useEffect(() => {
    const promptState =
      session?.currentPrompt && typeof session.currentPrompt === 'object'
        ? ((session.currentPrompt as Record<string, unknown>).streakState as Record<string, unknown> | undefined)
        : undefined;
    const revealState =
      session?.currentReveal && typeof session.currentReveal === 'object'
        ? ((session.currentReveal as Record<string, unknown>).streakState as Record<string, unknown> | undefined)
        : undefined;
    const source = promptState ?? revealState;
    if (source && typeof source === 'object') {
      const next: Record<string, number> = {};
      Object.entries(source).forEach(([key, value]) => {
        next[key] = clampInt(Number(value), 0, 100000);
      });
      streakByParticipantRef.current = next;
    }
    const wrongPromptState =
      session?.currentPrompt && typeof session.currentPrompt === 'object'
        ? ((session.currentPrompt as Record<string, unknown>).wrongStreakState as Record<string, unknown> | undefined)
        : undefined;
    const wrongRevealState =
      session?.currentReveal && typeof session.currentReveal === 'object'
        ? ((session.currentReveal as Record<string, unknown>).wrongStreakState as Record<string, unknown> | undefined)
        : undefined;
    const wrongSource = wrongPromptState ?? wrongRevealState;
    if (wrongSource && typeof wrongSource === 'object') {
      const nextWrong: Record<string, number> = {};
      Object.entries(wrongSource).forEach(([key, value]) => {
        nextWrong[key] = clampInt(Number(value), 0, 100000);
      });
      wrongStreakByParticipantRef.current = nextWrong;
    }
  }, [session?.currentPrompt, session?.currentReveal, session?.sessionId]);

  const buildTimer = (config: {
    key: HostTimer['key'];
    label: string;
    enabled: unknown;
    endsUtc: unknown;
    totalSeconds: unknown;
  }): HostTimer | null => {
    if (!Boolean(config.enabled)) return null;
    const endsMs = typeof config.endsUtc === 'string' ? Date.parse(config.endsUtc) : NaN;
    const total = Number(config.totalSeconds);
    if (!Number.isFinite(endsMs) || !Number.isFinite(total) || total <= 0) return null;
    const safeTotal = Math.max(1, Math.min(600, Math.round(total)));
    const remainingMs = Math.max(0, endsMs - nowTick);
    const progress = Math.max(0, Math.min(1, remainingMs / (safeTotal * 1000)));
    return { key: config.key, label: config.label, totalSeconds: safeTotal, remainingMs, progress };
  };

  const timers = useMemo(() => {
    if (!promptRoot) return [] as HostTimer[];
    const next: HostTimer[] = [];
    const actionTimer = buildTimer({
      key: 'action',
      label: liveCopy.actionTimerLabel,
      enabled: !hidePreRevealTimers && promptRoot.actionTimerEnabled,
      endsUtc: promptRoot.actionTimerEndsUtc,
      totalSeconds: promptRoot.actionTimerSeconds
    });
    const roundTimer = buildTimer({
      key: 'round',
      label: liveCopy.roundTimerLabel,
      enabled: !hidePreRevealTimers && promptRoot.roundTimerEnabled,
      endsUtc: promptRoot.roundTimerEndsUtc,
      totalSeconds: promptRoot.roundTimerSeconds
    });
    const bonusTimer = buildTimer({
      key: 'bonus',
      label: liveCopy.bonusTimerLabel,
      enabled: !hidePreRevealTimers && promptRoot.bonusTimerEnabled,
      endsUtc: promptRoot.bonusTimerEndsUtc,
      totalSeconds: promptRoot.bonusTimerSeconds
    });
    const nextQuestionTimer = buildTimer({
      key: 'next',
      label: liveCopy.nextQuestionTimerLabel,
      enabled:
        promptRoot.nextQuestionMode === 'timer' &&
        typeof promptRoot.autoNextCancelledUtc !== 'string',
      endsUtc: promptRoot.autoNextEndsUtc,
      totalSeconds: promptRoot.nextQuestionSeconds
    });
    if (actionTimer) next.push(actionTimer);
    if (roundTimer) next.push(roundTimer);
    if (bonusTimer) next.push(bonusTimer);
    if (nextQuestionTimer) next.push(nextQuestionTimer);
    return next;
  }, [hidePreRevealTimers, liveCopy.actionTimerLabel, liveCopy.bonusTimerLabel, liveCopy.nextQuestionTimerLabel, liveCopy.roundTimerLabel, nowTick, promptRoot]);

  const syncHostSecretInUrl = (nextSecret: string) => {
    if (typeof window === 'undefined' || !nextSecret) return;
    const current = new URL(window.location.href);
    if (current.searchParams.get('hostSecret') === nextSecret) return;
    current.searchParams.set('hostSecret', nextSecret);
    window.history.replaceState(null, '', `${current.pathname}${current.search}${current.hash}`);
  };

  const reattachHostSession = async (): Promise<string | null> => {
    if (reattachPromiseRef.current) return reattachPromiseRef.current;
    const op = (async () => {
      try {
        const attached = await attachCogitaLiveRevisionSession({ libraryId, sessionId });
        const nextSecret = attached.hostSecret ?? '';
        if (!nextSecret) return null;
        setEffectiveHostSecret(nextSecret);
        setSession(attached);
        setStatus('ready');
        syncHostSecretInUrl(nextSecret);
        return nextSecret;
      } catch {
        return null;
      } finally {
        reattachPromiseRef.current = null;
      }
    })();
    reattachPromiseRef.current = op;
    return op;
  };

  const withFreshHostSecret = async <T,>(operation: (secret: string) => Promise<T>): Promise<T> => {
    try {
      return await operation(effectiveHostSecret);
    } catch (error) {
      const statusCode =
        typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: unknown }).status)
          : NaN;
      if (statusCode === 403 || (error instanceof ApiError && error.status === 403)) {
        const refreshed = await reattachHostSession();
        if (refreshed) {
          return operation(refreshed);
        }
      }
      throw error;
    }
  };

  const pollSession = async () => {
    try {
      const next = await withFreshHostSecret((secret) =>
        getCogitaLiveRevisionSession({ libraryId, sessionId, hostSecret: secret })
      );
      setSession(next);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    const attachKey = `${libraryId}:${sessionId}`;
    if (initialAttachKeyRef.current !== attachKey) {
      initialAttachKeyRef.current = attachKey;
      void reattachHostSession().then((secret) => {
        if (!secret) {
          void pollSession();
        }
      });
    } else {
      void pollSession();
    }
    const id = window.setInterval(pollSession, 1200);
    return () => window.clearInterval(id);
  }, [libraryId, sessionId, effectiveHostSecret]);

  useEffect(() => {
    roundsLoadPromiseRef.current = null;
    setRoundsStatus('idle');
    setRoundLoadError(false);
    setPreparedCount(0);
    setRounds([]);
    setRevisionMode('random');
  }, [libraryId, liveCopy.selectMatchingPairPrompt, liveCopy.wordLanguagePromptPrefix, revisionId]);

  const ensureRoundsLoaded = async () => {
    if (rounds.length > 0) return { rounds, revisionMode };
    if (roundsLoadPromiseRef.current) {
      const pending = await roundsLoadPromiseRef.current;
      if (!pending) throw new Error('rounds-load-failed');
      return pending;
    }
    setRoundsStatus('loading');
    setRoundLoadError(false);
    setPreparedCount(0);
    const op = buildLiveRounds({
      libraryId,
      revisionId,
      labels: {
        selectMatchingPairPrompt: liveCopy.selectMatchingPairPrompt,
        wordLanguagePromptPrefix: liveCopy.wordLanguagePromptPrefix
      },
      onPreparedCount: (count) => setPreparedCount(count)
    })
      .then((built) => {
        setRounds(built.rounds);
        setRevisionMode(built.revisionMode || 'random');
        setRoundsStatus('ready');
        setRoundLoadError(false);
        setPreparedCount(built.rounds.length);
        return built;
      })
      .catch(() => {
        setRounds([]);
        setRevisionMode('random');
        setRoundsStatus('error');
        setRoundLoadError(true);
        return null;
      })
      .finally(() => {
        roundsLoadPromiseRef.current = null;
      });
    roundsLoadPromiseRef.current = op;
    const result = await op;
    if (!result) throw new Error('rounds-load-failed');
    return result;
  };

  useEffect(() => {
    void ensureRoundsLoaded().catch(() => {
      // handled by ensureRoundsLoaded state updates
    });
  }, [libraryId, liveCopy.selectMatchingPairPrompt, liveCopy.wordLanguagePromptPrefix, revisionId]);

  const preparingLabel =
    String(liveCopy.preparingCardsLabel ?? 'Preparing cards: {count}').replace('{count}', String(preparedCount));
  const preparedLabel =
    String(liveCopy.preparedCardsLabel ?? 'Prepared cards: {count}').replace(
      '{count}',
      String(Math.max(preparedCount, rounds.length))
    );

  useEffect(() => {
    if (timers.length === 0) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [timers.length]);

  const projected = useMemo(() => {
    if (isCurrentRoundScored) return [] as Array<{ participant: CogitaLiveRevisionParticipant; current: number; predicted: number; correct: boolean }>;
    if (!prompt || !revealExpected) return [] as Array<{ participant: CogitaLiveRevisionParticipant; current: number; predicted: number; correct: boolean }>;
    const promptState = prompt && typeof prompt === 'object' ? (prompt as Record<string, unknown>) : null;
    const timerStartedMs = typeof promptState?.bonusTimerStartedUtc === 'string' ? Date.parse(promptState.bonusTimerStartedUtc) : NaN;
    const timerEndsMs = typeof promptState?.bonusTimerEndsUtc === 'string' ? Date.parse(promptState.bonusTimerEndsUtc) : NaN;
    const firstAnsweredParticipantId = roundAnswers[0]?.participantId ?? null;
    const firstCorrectParticipantId =
      roundAnswers
        .filter((row) =>
          evaluateCheckcardAnswer({
            prompt: prompt as unknown as Record<string, unknown>,
            expected: revealExpected,
            answer: normalizeAnswer(row.answer, prompt)
          }).correct
        )[0]?.participantId ?? null;
    const firstWrongParticipantId =
      roundAnswers
        .filter((row) =>
          !evaluateCheckcardAnswer({
            prompt: prompt as unknown as Record<string, unknown>,
            expected: revealExpected,
            answer: normalizeAnswer(row.answer, prompt)
          }).correct
        )[0]?.participantId ?? null;
    const processed = roundAnswers
      .map((row) => {
        const participant = participantById.get(row.participantId);
        if (!participant) return null;
        const check = evaluateCheckcardAnswer({
          prompt: prompt as unknown as Record<string, unknown>,
          expected: revealExpected,
          answer: normalizeAnswer(row.answer, prompt)
        }).correct;
        const isFirstOverall = Boolean(firstAnsweredParticipantId && row.participantId === firstAnsweredParticipantId);
        const isFirstCorrect = Boolean(firstCorrectParticipantId && row.participantId === firstCorrectParticipantId);
        const firstBonusApplies =
          rules.scoring.firstCorrectBonus > 0 &&
          (
            (rules.scoring.firstBonusMode === 'first_answer' && isFirstOverall) ||
            (rules.scoring.firstBonusMode === 'first_correct' && check && isFirstCorrect)
          );
        const firstBonusPoints = firstBonusApplies ? clampInt(rules.scoring.firstCorrectBonus, 0, 500000) : 0;
        const wrongPenalty = !check ? clampInt(rules.scoring.wrongAnswerPenalty, 0, 500000) : 0;
        const firstWrongPenaltyApplies =
          !check &&
          (
            (rules.scoring.firstWrongPenaltyMode === 'first_overall_answer' && isFirstOverall) ||
            (rules.scoring.firstWrongPenaltyMode === 'first_wrong' && firstWrongParticipantId && row.participantId === firstWrongParticipantId)
          );
        const firstWrongPenalty = firstWrongPenaltyApplies ? clampInt(rules.scoring.firstWrongPenalty, 0, 500000) : 0;
        let points = check ? clampInt(rules.scoring.baseCorrect, 0, 500000) : -(wrongPenalty + firstWrongPenalty);
        points += firstBonusPoints;
        if (firstBonusPoints > 0 && !check) {
          points = clampInt(points, -500000, 500000);
        }
        if (
          check &&
          rules.bonusTimer.enabled &&
          rules.speedBonus.enabled &&
          rules.speedBonus.maxPoints > 0 &&
          Number.isFinite(timerStartedMs) &&
          Number.isFinite(timerEndsMs)
        ) {
          const submittedMs = Date.parse(row.submittedUtc);
          if (Number.isFinite(submittedMs) && submittedMs <= timerEndsMs) {
            const ratio = Math.max(0, Math.min(1, (timerEndsMs - submittedMs) / Math.max(1, timerEndsMs - timerStartedMs)));
            points += clampInt(growthRatio(rules.speedBonus.growth, ratio) * rules.speedBonus.maxPoints, 0, 500000);
          }
        }
        if (check) {
          const previousStreak = streakByParticipantRef.current[row.participantId] ?? 0;
          const nextStreak = previousStreak + 1;
          points += streakBonus(rules.scoring.streakGrowth, rules.scoring.streakBaseBonus, nextStreak, rules.scoring.streakLimit);
        } else {
          const previousWrongStreak = wrongStreakByParticipantRef.current[row.participantId] ?? 0;
          const nextWrongStreak = previousWrongStreak + 1;
          points -= streakBonus(
            rules.scoring.wrongStreakGrowth,
            rules.scoring.wrongStreakBasePenalty,
            nextWrongStreak,
            rules.scoring.wrongStreakLimit
          );
        }
        const current = scoresById.get(row.participantId) ?? participant.score ?? 0;
        return {
          participant,
          current,
          predicted: current + points,
          correct: check
        };
      })
      .filter((row): row is { participant: CogitaLiveRevisionParticipant; current: number; predicted: number; correct: boolean } => Boolean(row));
    return processed.sort((a, b) => b.predicted - a.predicted);
  }, [isCurrentRoundScored, participantById, prompt, revealExpected, roundAnswers, rules.bonusTimer.enabled, rules.scoring.baseCorrect, rules.scoring.firstBonusMode, rules.scoring.firstCorrectBonus, rules.scoring.firstWrongPenalty, rules.scoring.firstWrongPenaltyMode, rules.scoring.streakBaseBonus, rules.scoring.streakGrowth, rules.scoring.streakLimit, rules.scoring.wrongAnswerPenalty, rules.scoring.wrongStreakBasePenalty, rules.scoring.wrongStreakGrowth, rules.scoring.wrongStreakLimit, rules.speedBonus.enabled, rules.speedBonus.growth, rules.speedBonus.maxPoints, scoresById]);

  const projectionByParticipant = useMemo(() => new Map(projected.map((x) => [x.participant.participantId, x])), [projected]);
  const latestAnswerByParticipant = useMemo(() => {
    const map = new Map<string, CogitaLiveRevisionAnswer>();
    const sorted = [...roundAnswers].sort((a, b) => Date.parse(a.submittedUtc) - Date.parse(b.submittedUtc));
    sorted.forEach((row) => map.set(row.participantId, row));
    return map;
  }, [roundAnswers]);
  const correctnessByParticipant = useMemo(() => {
    const map = new Map<string, boolean>();
    if (!prompt || typeof revealExpected === 'undefined') return map;
    roundAnswers.forEach((row) => {
      const correct = evaluateCheckcardAnswer({
        prompt: prompt as unknown as Record<string, unknown>,
        expected: revealExpected,
        answer: normalizeAnswer(row.answer, prompt)
      }).correct;
      map.set(row.participantId, correct);
    });
    return map;
  }, [prompt, revealExpected, roundAnswers]);

  useEffect(() => {
    const rows = session?.scoreboard ?? [];
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
  }, [session?.revealVersion, session?.scoreboard]);

  const pushState = async (next: {
    status?: string;
    currentRoundIndex?: number;
    revealVersion?: number;
    currentPrompt?: unknown | null;
    currentReveal?: unknown | null;
  }) => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;
    const hasPrompt = Object.prototype.hasOwnProperty.call(next, 'currentPrompt');
    const hasReveal = Object.prototype.hasOwnProperty.call(next, 'currentReveal');
    const updated = await withFreshHostSecret((secret) =>
      updateCogitaLiveRevisionHostState({
        libraryId,
        sessionId: currentSession.sessionId,
        hostSecret: secret,
        status: next.status ?? currentSession.status,
        currentRoundIndex: next.currentRoundIndex ?? currentSession.currentRoundIndex,
        revealVersion: next.revealVersion ?? currentSession.revealVersion,
        currentPrompt: hasPrompt ? (next.currentPrompt ?? null) : (currentSession.currentPrompt ?? null),
        currentReveal: hasReveal ? (next.currentReveal ?? null) : (currentSession.currentReveal ?? null)
      })
    );
    setSession(updated);
  };

  const runHostMutation = async (kind: 'reveal' | 'score' | 'next' | 'finish' | 'remove', action: () => Promise<void>) => {
    if (mutationInFlightRef.current) return;
    mutationInFlightRef.current = true;
    setBusy(kind);
    try {
      await action();
    } finally {
      mutationInFlightRef.current = false;
      setBusy('none');
    }
  };

  const publishRound = async (
    index: number,
    options?: { knownessByCardKey?: Record<string, number>; askedCardKeys?: string[] }
  ) => {
    const round = rounds[index];
    if (!round || !session) return;
    const activeParticipants = session.participants.filter((participant) => participant.isConnected);
    const participantCount = activeParticipants.length > 0 ? activeParticipants.length : session.participants.length;
    const actionTimerRelevant =
      session.sessionMode === 'simultaneous' &&
      rules.firstAnswerAction === 'start_timer' &&
      rules.actionTimer.enabled;
    const startActionTimerImmediately =
      session.sessionMode === 'simultaneous' &&
      actionTimerRelevant &&
      participantCount <= 1;
    const actionTimerStartedUtc = startActionTimerImmediately ? new Date().toISOString() : null;
    const actionTimerEndsUtc = actionTimerStartedUtc
      ? new Date(Date.parse(actionTimerStartedUtc) + clampInt(rules.actionTimer.seconds, 3, 600) * 1000).toISOString()
      : null;
    const startBonusTimerImmediately = rules.bonusTimer.enabled && rules.bonusTimer.startMode === 'round_start';
    const bonusTimerStartedUtc = startBonusTimerImmediately ? new Date().toISOString() : null;
    const bonusTimerEndsUtc = bonusTimerStartedUtc
      ? new Date(Date.parse(bonusTimerStartedUtc) + clampInt(rules.bonusTimer.seconds, 1, 600) * 1000).toISOString()
      : null;
    const roundTimerEnabled = Boolean(rules.roundTimer.enabled);
    const roundTimerSeconds = clampInt(Number(rules.roundTimer.seconds ?? 60), 3, 1200);
    const roundTimerStartedUtc = roundTimerEnabled ? new Date().toISOString() : null;
    const roundTimerEndsUtc = roundTimerStartedUtc
      ? new Date(Date.parse(roundTimerStartedUtc) + roundTimerSeconds * 1000).toISOString()
      : null;

    await pushState({
      status: 'running',
      currentRoundIndex: index,
      revealVersion: session.revealVersion + 1,
      currentReveal: null,
      currentPrompt: {
        ...round.publicPrompt,
        roundIndex: index,
        cardKey: round.cardKey,
        firstAnswerAction: rules.firstAnswerAction,
        allAnsweredAction: rules.allAnsweredAction,
        actionTimerEnabled: actionTimerRelevant,
        actionTimerSeconds: clampInt(rules.actionTimer.seconds, 3, 600),
        actionTimerStartedUtc,
        actionTimerEndsUtc,
        nextQuestionMode: rules.nextQuestion.mode,
        nextQuestionSeconds: clampInt(rules.nextQuestion.seconds, 1, 120),
        autoNextStartedUtc: null,
        autoNextEndsUtc: null,
        autoNextCancelledUtc: null,
        bonusTimerEnabled: rules.bonusTimer.enabled,
        bonusTimerSeconds: clampInt(rules.bonusTimer.seconds, 1, 600),
        bonusTimerStartMode: rules.bonusTimer.startMode,
        bonusTimerStartedUtc,
        bonusTimerEndsUtc,
        roundTimerEnabled,
        roundTimerSeconds,
        roundTimerStartedUtc,
        roundTimerEndsUtc,
        streakState: { ...streakByParticipantRef.current },
        wrongStreakState: { ...wrongStreakByParticipantRef.current },
        knownessByCardKey: options?.knownessByCardKey ?? {},
        askedCardKeys: options?.askedCardKeys ?? [round.cardKey]
      }
    });
  };

  const scoreRound = async () => {
    if (!session || !currentRound) return;
    if (!canScore) return;
    const currentRevealState =
      session.currentReveal && typeof session.currentReveal === 'object'
        ? (session.currentReveal as Record<string, unknown>)
        : null;
    if (currentRevealState && currentRevealState.roundScoring && session.status === 'revealed') return;
    await runHostMutation('score', async () => {
      const promptState =
        session.currentPrompt && typeof session.currentPrompt === 'object'
          ? (session.currentPrompt as Record<string, unknown>)
          : null;
      const timerStartedMs = typeof promptState?.bonusTimerStartedUtc === 'string' ? Date.parse(promptState.bonusTimerStartedUtc) : NaN;
      const timerEndsMs = typeof promptState?.bonusTimerEndsUtc === 'string' ? Date.parse(promptState.bonusTimerEndsUtc) : NaN;
      const answersForRound = [...roundAnswers].sort((a, b) => Date.parse(a.submittedUtc) - Date.parse(b.submittedUtc));
      const answersByParticipant = new Map(answersForRound.map((row) => [row.participantId, row]));
      const correctness = session.participants.map((participant) => {
        const row = answersByParticipant.get(participant.participantId);
        return {
          participantId: participant.participantId,
          isCorrect: row ? currentRound.grade(row.answer) : false,
          submittedUtc: row?.submittedUtc ?? null
        };
      });
      const knownessSampleSize = Math.max(0, correctness.length);
      const knownessCorrectCount = correctness.reduce((sum, row) => sum + (row.isCorrect ? 1 : 0), 0);
      const knownessAveragePercent =
        knownessSampleSize > 0
          ? Math.round((knownessCorrectCount / knownessSampleSize) * 10000) / 100
          : 0;
      const isCorrectByParticipant = new Map(correctness.map((row) => [row.participantId, row.isCorrect]));
      const knownessByCardKeyRaw =
        promptState && typeof promptState.knownessByCardKey === 'object' && promptState.knownessByCardKey
          ? (promptState.knownessByCardKey as Record<string, number>)
          : {};
      const knownessByCardKey = { ...knownessByCardKeyRaw, [currentRound.cardKey]: knownessAveragePercent };
      const firstCorrectParticipantId =
        answersForRound.find((answer) => isCorrectByParticipant.get(answer.participantId) === true)?.participantId ?? null;
      const firstAnsweredParticipantId = answersForRound[0]?.participantId ?? null;
      const firstWrongParticipantId =
        answersForRound.find((answer) => isCorrectByParticipant.get(answer.participantId) === false)?.participantId ?? null;
      const previousStreaks = streakByParticipantRef.current;
      const previousWrongStreaks = wrongStreakByParticipantRef.current;
      const nextStreaks: Record<string, number> = { ...previousStreaks };
      const nextWrongStreaks: Record<string, number> = { ...previousWrongStreaks };
      const roundGain: Record<string, RoundGain> = {};

      const payload = correctness.map((row) => {
        const previousStreak = nextStreaks[row.participantId] ?? 0;
        if (!row.isCorrect) {
          nextStreaks[row.participantId] = 0;
          const previousWrongStreak = nextWrongStreaks[row.participantId] ?? 0;
          const nextWrongStreak = previousWrongStreak + 1;
          nextWrongStreaks[row.participantId] = nextWrongStreak;
          const answered = Boolean(row.submittedUtc);
          const wrongPenalty = answered ? clampInt(rules.scoring.wrongAnswerPenalty, 0, 500000) : 0;
          const firstWrongPenalty =
            answered && (
              (rules.scoring.firstWrongPenaltyMode === 'first_overall_answer' && firstAnsweredParticipantId && row.participantId === firstAnsweredParticipantId) ||
              (rules.scoring.firstWrongPenaltyMode === 'first_wrong' && firstWrongParticipantId && row.participantId === firstWrongParticipantId)
            )
              ? clampInt(rules.scoring.firstWrongPenalty, 0, 500000)
              : 0;
          const wrongStreakPenalty = answered
            ? streakBonus(rules.scoring.wrongStreakGrowth, rules.scoring.wrongStreakBasePenalty, nextWrongStreak, rules.scoring.wrongStreakLimit)
            : 0;
          const firstBonusPoints =
            answered &&
            rules.scoring.firstCorrectBonus > 0 &&
            (
              (rules.scoring.firstBonusMode === 'first_answer' && firstAnsweredParticipantId && row.participantId === firstAnsweredParticipantId) ||
              (rules.scoring.firstBonusMode === 'first_correct' && firstCorrectParticipantId && row.participantId === firstCorrectParticipantId)
            )
              ? clampInt(rules.scoring.firstCorrectBonus, 0, 500000)
              : 0;
          const pointsAwarded = firstBonusPoints - (wrongPenalty + firstWrongPenalty + wrongStreakPenalty);
          const factors: string[] = [];
          if (firstBonusPoints > 0) factors.push('first');
          if (wrongPenalty > 0) factors.push('wrong');
          if (firstWrongPenalty > 0) factors.push('first-wrong');
          if (wrongStreakPenalty > 0) factors.push('wrong-streak');
          roundGain[row.participantId] = {
            points: pointsAwarded,
            factors,
            streak: 0,
            rankDelta: 0,
            basePoints: 0,
            firstBonusPoints,
            speedPoints: 0,
            streakPoints: 0,
            wrongPenaltyPoints: wrongPenalty,
            firstWrongPenaltyPoints: firstWrongPenalty,
            wrongStreakPenaltyPoints: wrongStreakPenalty
          };
          return { participantId: row.participantId, isCorrect: false, pointsAwarded };
        }

        const factors: string[] = [];
        const basePoints = clampInt(rules.scoring.baseCorrect, 0, 500000);
        let firstBonusPoints = 0;
        let speedPoints = 0;
        let streakPoints = 0;
        let points = basePoints;
        if (basePoints > 0) factors.push('base');
        nextWrongStreaks[row.participantId] = 0;
        if (
          rules.scoring.firstCorrectBonus > 0 &&
          (
            (rules.scoring.firstBonusMode === 'first_answer' && firstAnsweredParticipantId && row.participantId === firstAnsweredParticipantId) ||
            (rules.scoring.firstBonusMode === 'first_correct' && firstCorrectParticipantId && row.participantId === firstCorrectParticipantId)
          )
        ) {
          firstBonusPoints = clampInt(rules.scoring.firstCorrectBonus, 0, 500000);
          points += firstBonusPoints;
          factors.push('first');
        }

        if (
          rules.bonusTimer.enabled &&
          rules.speedBonus.enabled &&
          rules.speedBonus.maxPoints > 0 &&
          Number.isFinite(timerStartedMs) &&
          Number.isFinite(timerEndsMs) &&
          row.submittedUtc
        ) {
          const submittedMs = Date.parse(row.submittedUtc);
          if (Number.isFinite(submittedMs) && submittedMs <= timerEndsMs) {
            const ratio = Math.max(0, Math.min(1, (timerEndsMs - submittedMs) / Math.max(1, timerEndsMs - timerStartedMs)));
            speedPoints = clampInt(growthRatio(rules.speedBonus.growth, ratio) * rules.speedBonus.maxPoints, 0, 500000);
            if (speedPoints > 0) {
              points += speedPoints;
              factors.push('speed');
            }
          }
        }

        const nextStreak = previousStreak + 1;
        nextStreaks[row.participantId] = nextStreak;
        streakPoints = streakBonus(rules.scoring.streakGrowth, rules.scoring.streakBaseBonus, nextStreak, rules.scoring.streakLimit);
        if (streakPoints > 0) {
          points += streakPoints;
          factors.push('streak');
        }

        const safePoints = clampInt(points, -500000, 500000);
        roundGain[row.participantId] = {
          points: safePoints,
          factors,
          streak: nextStreak,
          rankDelta: 0,
          basePoints,
          firstBonusPoints,
          speedPoints,
          streakPoints,
          wrongPenaltyPoints: 0,
          firstWrongPenaltyPoints: 0,
          wrongStreakPenaltyPoints: 0
        };
        return { participantId: row.participantId, isCorrect: true, pointsAwarded: safePoints };
      });

      const beforeRank = buildRankMap(session.participants);
      const next = await withFreshHostSecret((secret) =>
        scoreCogitaLiveRevisionRound({
          libraryId,
          sessionId: session.sessionId,
          hostSecret: secret,
          scores: payload
        })
      );
      const sourcePrompt =
        next.currentPrompt && typeof next.currentPrompt === 'object'
          ? (next.currentPrompt as Record<string, unknown>)
          : (promptState ?? {});
      const nextQuestionMode = sourcePrompt.nextQuestionMode === 'timer' ? 'timer' : 'manual';
      const nextQuestionSeconds = clampInt(Number(sourcePrompt.nextQuestionSeconds ?? rules.nextQuestion.seconds), 1, 120);
      const autoNextStartedUtc = nextQuestionMode === 'timer' ? new Date().toISOString() : null;
      const autoNextEndsUtc =
        autoNextStartedUtc != null
          ? new Date(Date.parse(autoNextStartedUtc) + nextQuestionSeconds * 1000).toISOString()
          : null;
      const afterRank = buildRankMap(next.participants);
      Object.keys(roundGain).forEach((participantId) => {
        const before = beforeRank.get(participantId) ?? 0;
        const after = afterRank.get(participantId) ?? before;
        roundGain[participantId] = {
          ...roundGain[participantId],
          rankDelta: before > 0 && after > 0 ? before - after : 0
        };
      });
      streakByParticipantRef.current = nextStreaks;
      wrongStreakByParticipantRef.current = nextWrongStreaks;
      const afterReveal = await withFreshHostSecret((secret) =>
        updateCogitaLiveRevisionHostState({
          libraryId,
          sessionId: next.sessionId,
          hostSecret: secret,
          status: 'revealed',
          currentRoundIndex: next.currentRoundIndex,
          revealVersion: next.revealVersion + 1,
          currentPrompt: {
            ...sourcePrompt,
            nextQuestionMode,
            nextQuestionSeconds,
            autoNextStartedUtc,
            autoNextEndsUtc,
            autoNextCancelledUtc: null
          },
          currentReveal: {
            ...currentRound.reveal,
            roundScoring: roundGain,
            streakState: nextStreaks,
            wrongStreakState: nextWrongStreaks,
            knownessAveragePercent,
            knownessCorrectCount,
            knownessSampleSize,
            knownessByCardKey
          }
        })
      );
      setSession(afterReveal);
      if (currentRoundKey) {
        scoredRoundKeysRef.current.add(currentRoundKey);
      }
    });
  };

  const ensureRoundScored = async () => {
    if (roundPhase === 'scored' || isCurrentRoundScored) return;
    await scoreRound();
  };

  const transitionRound = async (action: 'reveal' | 'next') => {
    if (action === 'reveal') {
      await ensureRoundScored();
      return;
    }
    await ensureRoundScored();
    await nextRound();
  };

  const nextRound = async () => {
    if (!session) return;
    if (!canNextQuestion) return;
    await runHostMutation('next', async () => {
      const promptState =
        session.currentPrompt && typeof session.currentPrompt === 'object'
          ? (session.currentPrompt as Record<string, unknown>)
          : null;
      const revealState =
        session.currentReveal && typeof session.currentReveal === 'object'
          ? (session.currentReveal as Record<string, unknown>)
          : null;
      const knownessByCardKey =
        (revealState?.knownessByCardKey as Record<string, number> | undefined) ??
        (promptState?.knownessByCardKey as Record<string, number> | undefined) ??
        {};
      const askedCardKeysRaw =
        Array.isArray(promptState?.askedCardKeys) ? (promptState?.askedCardKeys as unknown[]) : [];
      const askedCardKeys = askedCardKeysRaw.map((key) => String(key)).concat(currentRound?.cardKey ?? []);
      const nextIndex = selectNextCardIndexByMode({
        mode: revisionMode,
        currentIndex: session.currentRoundIndex,
        cardKeys: rounds.map((round) => round.cardKey),
        askedCardKeys,
        knownessByCardKey
      });
      if (nextIndex == null) {
        await pushState({ status: 'finished', currentReveal: null });
      } else {
        await publishRound(nextIndex, {
          knownessByCardKey,
          askedCardKeys
        });
      }
    });
  };

  const startSession = async () => {
    if (!session || session.status !== 'lobby' || hasPublishedRound) return;
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    await runHostMutation('next', async () => {
      const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
        new Promise<T>((resolve, reject) => {
          const id = window.setTimeout(() => reject(new Error('rounds-load-timeout')), ms);
          promise
            .then((value) => {
              window.clearTimeout(id);
              resolve(value);
            })
            .catch((error) => {
              window.clearTimeout(id);
              reject(error);
            });
        });
      const prepared = await withTimeout(ensureRoundsLoaded(), 20000);
      const localRounds = prepared.rounds;
      if (localRounds.length === 0) {
        setRoundLoadError(true);
        return;
      }
      if (session.sessionMode === 'asynchronous') {
        const asyncBundle = {
          kind: 'async-session',
          revisionMode: prepared.revisionMode || revisionMode,
          publishedUtc: new Date().toISOString(),
          rounds: localRounds.map((round, index) => ({
            roundIndex: index,
            cardKey: round.cardKey,
            prompt: round.publicPrompt,
            reveal: round.reveal
          }))
        };
        await pushState({
          status: 'running',
          currentRoundIndex: 0,
          revealVersion: session.revealVersion + 1,
          currentPrompt: asyncBundle,
          currentReveal: null
        });
        setStatus('ready');
        return;
      }
      const targetRoundIndex = Math.max(0, Math.min(localRounds.length - 1, session.currentRoundIndex));
      await publishRound(targetRoundIndex);
      setStatus('ready');
    }).catch(() => {
      setRoundLoadError(true);
      setStatus('error');
    }).finally(() => {
      startInFlightRef.current = false;
    });
  };

  const startActionTimerManual = async () => {
    if (!session || !isRunningStage || !hasPublishedRound) return;
    if (!canStartTimer) return;
    const promptState =
      session.currentPrompt && typeof session.currentPrompt === 'object'
        ? (session.currentPrompt as Record<string, unknown>)
        : null;
    if (!promptState) return;
    if (!rules.actionTimer.enabled) return;
    if (typeof promptState.actionTimerStartedUtc === 'string' && promptState.actionTimerStartedUtc.length > 0) return;
    const timerStartedUtc = new Date().toISOString();
    const seconds = clampInt(rules.actionTimer.seconds, 3, 600);
    const timerEndsUtc = new Date(Date.parse(timerStartedUtc) + seconds * 1000).toISOString();
    await runHostMutation('reveal', async () => {
      await pushState({
        currentPrompt: {
          ...promptState,
          actionTimerEnabled: true,
          actionTimerSeconds: seconds,
          actionTimerStartedUtc: timerStartedUtc,
          actionTimerEndsUtc: timerEndsUtc
        }
      });
    });
  };

  const stopAutoNextTimer = async () => {
    if (!session || !isRunningStage || !hasPublishedRound) return;
    if (!canStopAutoNextTimer) return;
    const promptState =
      session.currentPrompt && typeof session.currentPrompt === 'object'
        ? (session.currentPrompt as Record<string, unknown>)
        : null;
    if (!promptState) return;
    await runHostMutation('next', async () => {
      await pushState({
        currentPrompt: {
          ...promptState,
          autoNextStartedUtc: null,
          autoNextEndsUtc: null,
          autoNextCancelledUtc: new Date().toISOString()
        }
      });
    });
  };

  const endGameEarly = async () => {
    if (!session) return;
    if (!canEndGame) return;
    await runHostMutation('finish', async () => {
      await pushState({
        status: 'finished'
      });
    });
  };

  const removeParticipant = async (participantId: string) => {
    if (!session) return;
    const participant = session.participants.find((item) => item.participantId === participantId);
    if (!participant) return;
    const confirmMessage = String(
      liveCopy.removeParticipantConfirmLabel ?? 'Remove participant "{name}" from this session?'
    ).replace('{name}', participant.displayName);
    if (!window.confirm(confirmMessage)) return;

    await runHostMutation('remove', async () => {
      const next = await withFreshHostSecret((secret) =>
        removeCogitaLiveRevisionParticipant({
          libraryId,
          sessionId: session.sessionId,
          hostSecret: secret,
          participantId
        })
      );
      setSession(next);
    });
  };

  useEffect(() => {
    if (!session || !currentRound) return;
    if (isAsyncSession) return;
    if (!hasPublishedRound) return;
    if (session.status === 'closed' || session.status === 'finished') return;
    const promptState =
      session.currentPrompt && typeof session.currentPrompt === 'object'
        ? (session.currentPrompt as Record<string, unknown>)
        : null;
    if (!promptState) return;

    const connectedParticipants = session.participants.filter((participant) => participant.isConnected);
    const effectiveParticipants = connectedParticipants.length > 0 ? connectedParticipants : session.participants;
    const answeredRows = session.currentRoundAnswers
      .filter(
        (answer) =>
          answer.roundIndex === session.currentRoundIndex &&
          (answer.cardKey ?? '') === currentRound.cardKey
      )
      .sort((a, b) => Date.parse(a.submittedUtc) - Date.parse(b.submittedUtc));
    const answeredParticipants = new Set(answeredRows.map((answer) => answer.participantId));
    const firstAnswered = answeredRows.length > 0;
    const allAnswered =
      effectiveParticipants.length > 0 &&
      effectiveParticipants.every((participant) => answeredParticipants.has(participant.participantId));

    const actionTimerStarted = typeof promptState.actionTimerStartedUtc === 'string' && promptState.actionTimerStartedUtc.length > 0;
    const actionTimerEndsMs = typeof promptState.actionTimerEndsUtc === 'string' ? Date.parse(promptState.actionTimerEndsUtc) : NaN;
    const actionTimerExpired = actionTimerStarted && Number.isFinite(actionTimerEndsMs) && Date.now() >= actionTimerEndsMs;
    const bonusTimerStarted = typeof promptState.bonusTimerStartedUtc === 'string' && promptState.bonusTimerStartedUtc.length > 0;

    const roundTimerStarted = typeof promptState.roundTimerStartedUtc === 'string' && promptState.roundTimerStartedUtc.length > 0;
    const roundTimerEndsMs = typeof promptState.roundTimerEndsUtc === 'string' ? Date.parse(promptState.roundTimerEndsUtc) : NaN;
    const roundTimerExpired = roundTimerStarted && Number.isFinite(roundTimerEndsMs) && Date.now() >= roundTimerEndsMs;
    const autoNextCancelled = typeof promptState.autoNextCancelledUtc === 'string' && promptState.autoNextCancelledUtc.length > 0;
    const autoNextEndsMs = typeof promptState.autoNextEndsUtc === 'string' ? Date.parse(promptState.autoNextEndsUtc) : NaN;
    const autoNextExpired =
      promptState.nextQuestionMode === 'timer' &&
      !autoNextCancelled &&
      isCurrentRoundScored &&
      Number.isFinite(autoNextEndsMs) &&
      Date.now() >= autoNextEndsMs;

    const baseKey = `${session.sessionId}:${session.currentRoundIndex}:${currentRound.cardKey}:${session.revealVersion}:${answeredRows.length}:${String(promptState.actionTimerStartedUtc ?? '')}:${String(promptState.actionTimerEndsUtc ?? '')}:${String(promptState.roundTimerStartedUtc ?? '')}:${String(promptState.roundTimerEndsUtc ?? '')}:${String(promptState.autoNextEndsUtc ?? '')}:${String(promptState.autoNextCancelledUtc ?? '')}`;
    const executeOnce = (suffix: string, action: () => Promise<void>) => {
      const key = `${baseKey}:${suffix}`;
      if (autoActionLockRef.current === key) return;
      autoActionLockRef.current = key;
      void action().catch(() => {
        autoActionLockRef.current = null;
      });
    };

    const startActionTimerNow = async () => {
      const timerStartedUtc = new Date().toISOString();
      const seconds = clampInt(rules.actionTimer.seconds, 3, 600);
      const timerEndsUtc = new Date(Date.parse(timerStartedUtc) + seconds * 1000).toISOString();
      await runHostMutation('reveal', async () => {
        await pushState({
          currentPrompt: {
            ...promptState,
            actionTimerEnabled: true,
            actionTimerSeconds: seconds,
            actionTimerStartedUtc: timerStartedUtc,
            actionTimerEndsUtc: timerEndsUtc
          }
        });
      });
    };

    const startBonusTimerNow = async () => {
      const timerStartedUtc = new Date().toISOString();
      const seconds = clampInt(rules.bonusTimer.seconds, 1, 600);
      const timerEndsUtc = new Date(Date.parse(timerStartedUtc) + seconds * 1000).toISOString();
      await runHostMutation('reveal', async () => {
        await pushState({
          currentPrompt: {
            ...promptState,
            bonusTimerEnabled: true,
            bonusTimerSeconds: seconds,
            bonusTimerStartedUtc: timerStartedUtc,
            bonusTimerEndsUtc: timerEndsUtc
          }
        });
      });
    };

    const revealAndScore = async () => {
      await transitionRound('reveal');
    };

    const revealScoreAndNext = async () => {
      await transitionRound('next');
    };

    if (!isCurrentRoundScored) {
      if (rules.bonusTimer.enabled && rules.bonusTimer.startMode === 'first_answer' && firstAnswered && !bonusTimerStarted) {
        executeOnce('first-start-bonus-timer', startBonusTimerNow);
        return;
      }
      if (rules.firstAnswerAction === 'start_timer' && rules.actionTimer.enabled && firstAnswered && !actionTimerStarted) {
        executeOnce('first-start-timer', startActionTimerNow);
        return;
      }
      if (rules.firstAnswerAction === 'reveal' && firstAnswered) {
        executeOnce('first-reveal', revealAndScore);
        return;
      }
      if (rules.firstAnswerAction === 'next' && firstAnswered) {
        executeOnce('first-next', revealScoreAndNext);
        return;
      }

      if (allAnswered) {
        if (rules.allAnsweredAction === 'reveal') {
          executeOnce('all-reveal', revealAndScore);
          return;
        }
        if (rules.allAnsweredAction === 'next') {
          executeOnce('all-next', revealScoreAndNext);
          return;
        }
      }

      if (actionTimerExpired) {
        if (rules.actionTimer.onExpire === 'reveal') {
          executeOnce('action-expire-reveal', revealAndScore);
          return;
        }
        if (rules.actionTimer.onExpire === 'next') {
          executeOnce('action-expire-next', revealScoreAndNext);
          return;
        }
      }

      if (roundTimerExpired) {
        if (rules.roundTimer.onExpire === 'reveal') {
          executeOnce('round-expire-reveal', revealAndScore);
          return;
        }
        if (rules.roundTimer.onExpire === 'next') {
          executeOnce('round-expire-next', revealScoreAndNext);
          return;
        }
      }
    }

    if (autoNextExpired) {
      executeOnce('auto-next-expire', async () => {
        await transitionRound('next');
      });
    }
  }, [currentRound, hasPublishedRound, isAsyncSession, rules, session, roundPhase, isCurrentRoundScored, nowTick]);

  useEffect(() => {
    autoActionLockRef.current = null;
  }, [session?.currentRoundIndex, session?.revealVersion, session?.status, session?.sessionId]);

  useEffect(() => {
    if (!currentRoundKey) return;
    if (hasRevealRoundScoring && session?.status === 'revealed') {
      scoredRoundKeysRef.current.add(currentRoundKey);
    }
  }, [currentRoundKey, hasRevealRoundScoring, session?.status]);

  return (
    <CogitaLiveWallLayout
      title={liveCopy.hostTitle}
      subtitle={liveCopy.hostKicker}
      left={
        <div className="cogita-live-wall-stack">
          <div className="cogita-live-timer-head">
            <span>{liveCopy.currentRoundTitle}</span>
            <strong>{`${answeredCount}/${participantCount}`}</strong>
          </div>
          <p className="cogita-help">{cardsLeftLabel}</p>
          {timers.map((timer) => (
            <div className="cogita-live-timer" key={`host-timer:${timer.key}`}>
              <div className="cogita-live-timer-head">
                <span>{timer.label}</span>
                <strong>{`${Math.max(0, Math.ceil(timer.remainingMs / 1000))}s`}</strong>
              </div>
              <div className="cogita-live-timer-track">
                <span style={{ width: `${Math.round(timer.progress * 100)}%` }} />
              </div>
            </div>
          ))}
            <div className="cogita-form-actions">
              {isLobbyStage ? (
                <button type="button" className="cta" onClick={() => void startSession()} disabled={!canStartSession}>
                  {liveCopy.publishCurrentRound}
                </button>
              ) : isAsyncSession ? (
                <button type="button" className="cta ghost" onClick={() => void endGameEarly()} disabled={!canEndGame}>
                  {liveCopy.closeSessionAction}
                </button>
              ) : (
                <>
                {rules.firstAnswerAction === 'start_timer' &&
                rules.actionTimer.enabled &&
                isRunningStage &&
                !(typeof promptRoot?.actionTimerStartedUtc === 'string' && promptRoot.actionTimerStartedUtc.length > 0) ? (
                  <button type="button" className="cta ghost" onClick={() => void startActionTimerManual()} disabled={!canStartTimer}>
                    {liveCopy.startTimerAction}
                  </button>
                ) : null}
                <button type="button" className="cta" onClick={() => void transitionRound('reveal')} disabled={!canCheckReveal}>
                  {liveCopy.checkAndReveal}
                </button>
                <button type="button" className="cta ghost" onClick={() => void scoreRound()} disabled={!canScore}>
                  {liveCopy.optionRevealScore}
                </button>
                <button type="button" className="cta ghost" onClick={() => void transitionRound('next')} disabled={!canNextQuestion}>
                  {liveCopy.nextQuestionAction}
                </button>
                <button type="button" className="cta ghost" onClick={() => void endGameEarly()} disabled={!canEndGame}>
                  {liveCopy.closeSessionAction}
                </button>
                {canStopAutoNextTimer ? (
                  <button type="button" className="cta ghost" onClick={() => void stopAutoNextTimer()}>
                    {liveCopy.stopNextQuestionTimerAction}
                  </button>
                ) : null}
              </>
            )}
          </div>
          {roundsStatus === 'loading' ? <p className="cogita-help">{preparingLabel}</p> : null}
          {roundsStatus === 'ready' && rounds.length > 0 ? <p className="cogita-help">{preparedLabel}</p> : null}
          {roundLoadError ? <p className="cogita-help">{liveCopy.loadRoundsError}</p> : null}
          {!roundLoadError && rounds.length === 0 ? <p className="cogita-help">{liveCopy.waitingForPublishedRound}</p> : null}
          {!isAsyncSession ? (
            <>
              <CogitaCheckcardSurface className="cogita-live-card-container" feedbackToken={reveal ? `correct-${session?.revealVersion ?? 0}` : 'idle'}>
                <CogitaLivePromptCard
                  prompt={prompt}
                  revealExpected={revealExpected}
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
              <div className="cogita-share-list">
                {roundAnswers.map((row: CogitaLiveRevisionAnswer) => {
                  const participant = participantById.get(row.participantId);
                  const isCorrect =
                    prompt && revealExpected
                      ? evaluateCheckcardAnswer({
                          prompt: prompt as unknown as Record<string, unknown>,
                          expected: revealExpected,
                          answer: normalizeAnswer(row.answer, prompt)
                        }).correct
                      : false;
                  return (
                    <div className="cogita-share-row" data-state={isCorrect ? 'correct' : 'incorrect'} key={`${row.participantId}:${row.submittedUtc}`}>
                      <div>
                        <strong>{participant?.displayName ?? row.participantId}</strong>
                        <div className="cogita-share-meta">{formatAnswer(row.answer)}</div>
                      </div>
                    </div>
                  );
                })}
                {status === 'error' ? <p>{liveCopy.connectionError}</p> : null}
              </div>
            </>
          ) : (
            <p className="cogita-help">{liveCopy.modeAsynchronous}</p>
          )}
        </div>
      }
      right={
        <div className="cogita-live-wall-stack">
          <p className="cogita-user-kicker">{liveCopy.pointsTitle}</p>
          <div className="cogita-share-list">
            {(session?.scoreboard ?? []).map((row) => {
              const pred = projectionByParticipant.get(row.participantId);
              const correctness = correctnessByParticipant.get(row.participantId);
              const latestAnswer = latestAnswerByParticipant.get(row.participantId);
              const scoreFx = scoreFxByParticipant[row.participantId];
              const rankState = scoreFx?.rankShift
                ? scoreFx.rankShift > 0
                  ? 'up'
                  : 'down'
                : undefined;
              const flashState = correctness == null ? undefined : correctness ? 'correct' : 'incorrect';
              return (
                <div
                  className="cogita-share-row"
                  key={row.participantId}
                  data-state={pred?.correct ? 'correct' : pred ? 'incorrect' : undefined}
                  data-flash={flashState}
                  data-rank-change={rankState}
                >
                  <div>
                    <strong>{row.displayName}</strong>
                    <div className="cogita-share-meta">{`${row.score} ${liveCopy.scoreUnit}`}</div>
                    {latestAnswer ? (
                      <div className="cogita-share-meta">{`${copy.cogita.library.revision.answerLabel}: ${formatAnswer(latestAnswer.answer)}`}</div>
                    ) : null}
                  </div>
                  <div className="cogita-share-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <div className="cogita-share-meta">
                      {pred ? `→ ${pred.predicted} ${liveCopy.scoreUnit}` : null}
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
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => void removeParticipant(row.participantId)}
                      disabled={mutationInFlight}
                    >
                      {liveCopy.removeParticipantAction}
                    </button>
                  </div>
                </div>
              );
            })}
            {status === 'ready' && (session?.scoreboard.length ?? 0) === 0 ? <p>{liveCopy.noParticipants}</p> : null}
          </div>
        </div>
      }
    />
  );
}
