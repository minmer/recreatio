import { useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  addCogitaLiveRevisionParticipant,
  approveCogitaLiveRevisionReloginRequest,
  attachCogitaLiveRevisionSession,
  closeCogitaLiveRevisionSession,
  createCogitaLiveRevisionSession,
  getCogitaCollectionCards,
  getCogitaComputedSample,
  getCogitaInfoDetail,
  getCogitaLiveRevisionSession,
  getCogitaRevision,
  removeCogitaLiveRevisionParticipant,
  scoreCogitaLiveRevisionRound,
  updateCogitaLiveRevisionSession,
  updateCogitaLiveRevisionHostState,
  type CogitaCardSearchResult,
  type CogitaComputedSample,
  type CogitaLiveRevisionSession
} from '../../../lib/api';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaShell } from '../CogitaShell';
import { CogitaCheckcardSurface } from '../library/collections/components/CogitaCheckcardSurface';
import { buildQuoteFragmentContext, buildQuoteFragmentTree } from '../../../cogita/revision/quote';
import { useLocation } from 'react-router-dom';
import { parseQuestionDefinition, type ParsedQuestionDefinition } from '../library/questions/questionRuntime';
import { CogitaLivePromptCard } from './components/CogitaLivePromptCard';
import { evaluateCheckcardAnswer } from '../library/checkcards/checkcardRuntime';

type LivePrompt =
  | { kind: 'text'; title: string; prompt: string; inputType?: 'text' | 'number' | 'date'; multiLine?: boolean; cardLabel?: string }
  | { kind: 'selection'; title: string; prompt: string; options: string[]; multiple: boolean; cardLabel?: string }
  | { kind: 'boolean'; title: string; prompt: string; cardLabel?: string }
  | { kind: 'ordering'; title: string; prompt: string; options: string[]; cardLabel?: string }
  | { kind: 'matching'; title: string; prompt: string; columns: string[][]; cardLabel?: string }
  | { kind: 'citation-fragment'; title: string; before: string; after: string; fragmentId: string; cardLabel?: string };

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

const uniqSortedInts = (values: unknown[]) => Array.from(new Set(values.map((x) => Number(x)).filter(Number.isFinite))).sort((a, b) => a - b);

function shuffleList<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function shuffleWithIndexMap<T>(items: T[]) {
  const indexed = items.map((value, oldIndex) => ({ value, oldIndex }));
  for (let i = indexed.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }
  const values = indexed.map((entry) => entry.value);
  const oldToNew = new Map<number, number>();
  indexed.forEach((entry, newIndex) => oldToNew.set(entry.oldIndex, newIndex));
  return { values, oldToNew };
}

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

type BonusGrowthMode = 'linear' | 'exponential' | 'limited';
type FirstAnswerAction = 'none' | 'start_timer' | 'reveal';
type AllAnsweredAction = 'none' | 'reveal' | 'next';
type TimerExpireAction = 'none' | 'reveal' | 'next';

type LiveRules = {
  firstAnswerAction: FirstAnswerAction;
  allAnsweredAction: AllAnsweredAction;
  timer: {
    enabled: boolean;
    seconds: number;
    triggerMode: 'first_or_single';
    onExpire: TimerExpireAction;
    speedBonusMax: number;
    speedBonusGrowth: BonusGrowthMode;
  };
  scoring: {
    baseCorrect: number;
    firstCorrectBonus: number;
    streakBaseBonus: number;
    streakGrowth: BonusGrowthMode;
    streakLimit: number;
  };
};

type RoundGain = {
  points: number;
  factors: string[];
  streak: number;
  rankDelta: number;
};

const DEFAULT_LIVE_RULES: LiveRules = {
  firstAnswerAction: 'start_timer',
  allAnsweredAction: 'reveal',
  timer: {
    enabled: true,
    seconds: 25,
    triggerMode: 'first_or_single',
    onExpire: 'reveal',
    speedBonusMax: 2,
    speedBonusGrowth: 'linear'
  },
  scoring: {
    baseCorrect: 1,
    firstCorrectBonus: 1,
    streakBaseBonus: 1,
    streakGrowth: 'limited',
    streakLimit: 5
  }
};

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function normalizeGrowthMode(value: unknown): BonusGrowthMode {
  return value === 'exponential' || value === 'limited' ? value : 'linear';
}

function parseLiveRules(settings: unknown): LiveRules {
  const root = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
  const liveRulesRoot =
    root.liveRules && typeof root.liveRules === 'object'
      ? (root.liveRules as Record<string, unknown>)
      : root;

  const timerRoot =
    liveRulesRoot.timer && typeof liveRulesRoot.timer === 'object'
      ? (liveRulesRoot.timer as Record<string, unknown>)
      : {};
  const scoringRoot =
    liveRulesRoot.scoring && typeof liveRulesRoot.scoring === 'object'
      ? (liveRulesRoot.scoring as Record<string, unknown>)
      : {};

  const firstAnswerAction: FirstAnswerAction =
    liveRulesRoot.firstAnswerAction === 'reveal' || liveRulesRoot.firstAnswerAction === 'none'
      ? liveRulesRoot.firstAnswerAction
      : 'start_timer';
  const allAnsweredAction: AllAnsweredAction =
    liveRulesRoot.allAnsweredAction === 'none' || liveRulesRoot.allAnsweredAction === 'next'
      ? liveRulesRoot.allAnsweredAction
      : 'reveal';
  const onExpire: TimerExpireAction =
    timerRoot.onExpire === 'none' || timerRoot.onExpire === 'next'
      ? timerRoot.onExpire
      : 'reveal';

  return {
    firstAnswerAction,
    allAnsweredAction,
    timer: {
      enabled: timerRoot.enabled == null ? DEFAULT_LIVE_RULES.timer.enabled : Boolean(timerRoot.enabled),
      seconds: clampInt(Number(timerRoot.seconds ?? DEFAULT_LIVE_RULES.timer.seconds), 3, 600),
      triggerMode: 'first_or_single',
      onExpire,
      speedBonusMax: clampInt(Number(timerRoot.speedBonusMax ?? DEFAULT_LIVE_RULES.timer.speedBonusMax), 0, 25),
      speedBonusGrowth: normalizeGrowthMode(timerRoot.speedBonusGrowth)
    },
    scoring: {
      baseCorrect: clampInt(Number(scoringRoot.baseCorrect ?? DEFAULT_LIVE_RULES.scoring.baseCorrect), 0, 100),
      firstCorrectBonus: clampInt(Number(scoringRoot.firstCorrectBonus ?? DEFAULT_LIVE_RULES.scoring.firstCorrectBonus), 0, 100),
      streakBaseBonus: clampInt(Number(scoringRoot.streakBaseBonus ?? DEFAULT_LIVE_RULES.scoring.streakBaseBonus), 0, 100),
      streakGrowth: normalizeGrowthMode(scoringRoot.streakGrowth),
      streakLimit: clampInt(Number(scoringRoot.streakLimit ?? DEFAULT_LIVE_RULES.scoring.streakLimit), 1, 200)
    }
  };
}

function growthRatio(mode: BonusGrowthMode, ratio: number) {
  const clamped = Math.max(0, Math.min(1, ratio));
  if (mode === 'exponential') return clamped * clamped;
  if (mode === 'limited') return Math.min(1, clamped * 1.6);
  return clamped;
}

function streakBonus(mode: BonusGrowthMode, base: number, streak: number, limit: number) {
  const normalizedBase = Math.max(0, base);
  const extraCount = Math.max(0, streak - 1);
  if (normalizedBase === 0 || extraCount === 0) return 0;
  if (mode === 'exponential') {
    return clampInt(normalizedBase * (Math.pow(2, extraCount) - 1), 0, 10000);
  }
  if (mode === 'limited') {
    return clampInt(normalizedBase * Math.min(extraCount, Math.max(1, limit)), 0, 10000);
  }
  return clampInt(normalizedBase * extraCount, 0, 10000);
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
  definition: ParsedQuestionDefinition,
  roundIndex: number
): LiveRound | null {
  const title = typeof definition.title === 'string' && definition.title.trim() ? definition.title.trim() : titleFallback;
  const question = typeof definition.question === 'string' ? definition.question : titleFallback;
  const type = definition.type;
  if (!question) return null;

  if (type === 'selection') {
    const options = Array.isArray(definition.options) ? definition.options.filter((x): x is string => typeof x === 'string') : [];
    const expected = Array.isArray(definition.answer) ? uniqSortedInts(definition.answer as unknown[]) : [];
    const multiple = expected.length !== 1;
    const shuffled = shuffleWithIndexMap(options);
    const remappedExpected = expected
      .map((index) => shuffled.oldToNew.get(index))
      .filter((index): index is number => Number.isInteger(index))
      .sort((a, b) => a - b);
    return {
      roundIndex,
      cardKey: `info:${infoId}:question-selection`,
      publicPrompt: { kind: 'selection', title, prompt: question, options: shuffled.values, multiple, cardLabel: 'question' },
      reveal: { kind: 'selection', expected: remappedExpected, title },
      grade: (answer) =>
        evaluateCheckcardAnswer({
          prompt: { kind: 'selection', options: shuffled.values },
          expected: remappedExpected,
          answer: { selection: Array.isArray(answer) ? (answer as number[]) : [] }
        }).correct
    };
  }

  if (type === 'truefalse') {
    const expected = Boolean(definition.answer);
    return {
      roundIndex,
      cardKey: `info:${infoId}:question-truefalse`,
      publicPrompt: { kind: 'boolean', title, prompt: question, cardLabel: 'question' },
      reveal: { kind: 'boolean', expected, title },
      grade: (answer) =>
        evaluateCheckcardAnswer({
          prompt: { kind: 'boolean' },
          expected,
          answer: { booleanAnswer: answer == null ? null : Boolean(answer) }
        }).correct
    };
  }

  if (type === 'text' || type === 'number' || type === 'date') {
    const expected = String(definition.answer ?? '');
    return {
      roundIndex,
      cardKey: `info:${infoId}:question-${type}`,
      publicPrompt: { kind: 'text', title, prompt: question, inputType: type === 'number' ? 'number' : type === 'date' ? 'date' : 'text', cardLabel: 'question' },
      reveal: { kind: 'text', expected, title },
      grade: (answer) =>
        evaluateCheckcardAnswer({
          prompt: { kind: 'text', inputType: type === 'number' ? 'number' : type === 'date' ? 'date' : 'text' },
          expected,
          answer: { text: String(answer ?? '') }
        }).correct
    };
  }

  if (type === 'ordering') {
    const options = Array.isArray(definition.options) ? definition.options.filter((x): x is string => typeof x === 'string') : [];
    const shuffledOptions = shuffleList(options);
    return {
      roundIndex,
      cardKey: `info:${infoId}:question-ordering`,
      publicPrompt: { kind: 'ordering', title, prompt: question, options: shuffledOptions, cardLabel: 'question' },
      reveal: { kind: 'ordering', expected: options, title },
      grade: (answer) =>
        evaluateCheckcardAnswer({
          prompt: { kind: 'ordering', options },
          expected: options,
          answer: { ordering: Array.isArray(answer) ? answer.map(String) : [] }
        }).correct
    };
  }

  if (type === 'matching') {
    const columns = Array.isArray(definition.columns)
      ? definition.columns.map((col) => (Array.isArray(col) ? col.filter((x): x is string => typeof x === 'string') : []))
      : [];
    const shuffledColumns = columns.map((column) => shuffleWithIndexMap(column));
    const answerObj = (definition.answer ?? {}) as Record<string, unknown>;
    const expectedPathsRaw = Array.isArray(answerObj.paths)
      ? answerObj.paths
          .map((row) => (Array.isArray(row) ? row.map((x) => Number(x)).filter(Number.isFinite) : null))
          .filter((row): row is number[] => Array.isArray(row))
      : [];
    const expectedPaths = expectedPathsRaw.map((path) =>
      path.map((oldIndex, columnIndex) => shuffledColumns[columnIndex]?.oldToNew.get(oldIndex) ?? oldIndex)
    );
    return {
      roundIndex,
      cardKey: `info:${infoId}:question-matching`,
      publicPrompt: { kind: 'matching', title, prompt: question, columns: shuffledColumns.map((entry) => entry.values), cardLabel: 'question' },
      reveal: { kind: 'matching', expected: { paths: expectedPaths }, title },
      grade: (answer) => {
        const root = (answer ?? {}) as Record<string, unknown>;
        const paths = Array.isArray(root.paths)
          ? root.paths
              .map((row) => (Array.isArray(row) ? row.map((x) => Number(x)).filter(Number.isFinite) : null))
              .filter((row): row is number[] => Array.isArray(row))
          : [];
        return evaluateCheckcardAnswer({
          prompt: { kind: 'matching', columns: shuffledColumns.map((entry) => entry.values) },
          expected: { paths: expectedPaths },
          answer: { matchingPaths: paths }
        }).correct;
      }
    };
  }

  return null;
}

type InfoDetailMap = Map<string, { infoType: string; payload: unknown }>;

async function buildLiveRounds(payload: {
  libraryId: string;
  revisionId: string;
  labels?: {
    selectMatchingPairPrompt?: string;
    wordLanguagePromptPrefix?: string;
  };
}): Promise<LiveRound[]> {
  const revision = await getCogitaRevision({ libraryId: payload.libraryId, revisionId: payload.revisionId });
  const cardBundle = await getCogitaCollectionCards({ libraryId: payload.libraryId, collectionId: revision.collectionId, limit: 1000 });
  const cards = cardBundle.items;
  const infoIds = Array.from(new Set(cards.filter((c) => c.cardType === 'info').map((c) => c.cardId)));

  const infoDetails = new Map<string, { infoType: string; payload: unknown }>() as InfoDetailMap;
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
    wordLanguagePromptPrefix: payload.labels?.wordLanguagePromptPrefix ?? 'Language of',
  };
  const rounds: LiveRound[] = [];
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
      } else if (card.checkType === 'translation-match') {
        const options = Array.from(new Set([card.label, ...vocabLabels.filter((x) => x !== card.label).slice(0, 3)]));
        const correctIndex = options.findIndex((x) => x === card.label);
        rounds.push({
          roundIndex: rounds.length,
          cardKey: `connection:${card.cardId}:translation-match`,
          publicPrompt: { kind: 'selection', title: card.label, prompt: labels.selectMatchingPairPrompt, options, multiple: false, cardLabel: card.description ?? undefined },
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
      }
      continue;
    }

    if (card.cardType !== 'info') {
      continue;
    }

    const detail = infoDetails.get(card.cardId);
    if (!detail) continue;

    if (detail.infoType === 'word' && card.checkType === 'word-language') {
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
      continue;
    }

    if (detail.infoType === 'computed' && card.checkType === 'computed') {
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
      continue;
    }

    if (detail.infoType === 'question') {
      const def = parseQuestionDefinition(detail.payload);
      const round = def ? buildQuestionRound(card.cardId, card.label, def, rounds.length) : null;
      if (round) {
        round.roundIndex = rounds.length;
        rounds.push(round);
      }
      continue;
    }

    if (detail.infoType === 'citation' && !citationProcessed.has(card.cardId)) {
      citationProcessed.add(card.cardId);
      const root = detail.payload as Record<string, unknown>;
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
      }
      continue;
    }
  }

  return rounds.map((round, index) => ({ ...round, roundIndex: index }));
}

export function CogitaLiveRevisionHostPage(props: {
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
}) {
  const { libraryId, revisionId } = props;
  const location = useLocation();
  const revisionCopy = props.copy.cogita.library.revision;
  const liveCopy = revisionCopy.live;
  const [session, setSession] = useState<CogitaLiveRevisionSession | null>(null);
  const [rounds, setRounds] = useState<LiveRound[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<'simultaneous' | 'asynchronous'>('simultaneous');
  const [hostViewMode, setHostViewMode] = useState<'panel' | 'question' | 'score'>('panel');
  const [participantViewMode, setParticipantViewMode] = useState<'question' | 'score' | 'fullscreen'>('question');
  const [layoutMode, setLayoutMode] = useState<'window' | 'fullscreen'>('fullscreen');
  const [liveRules, setLiveRules] = useState<LiveRules>(DEFAULT_LIVE_RULES);
  const [newParticipantName, setNewParticipantName] = useState('');
  const [roundGainByParticipant, setRoundGainByParticipant] = useState<Record<string, RoundGain>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [participantBusy, setParticipantBusy] = useState<string | null>(null);
  const storageKey = `cogita.live.host.${libraryId}.${revisionId}`;
  const streakByParticipantRef = useRef<Record<string, number>>({});

  const currentRound = session ? rounds[session.currentRoundIndex] ?? null : null;
  const publishedPrompt = (session?.status && session.status !== 'lobby'
    ? ((session.currentPrompt ?? null) as Record<string, unknown> | null)
    : null);
  const publishedReveal = (session?.currentReveal ?? null) as Record<string, unknown> | null;
  const publishedRoundScoring = (publishedReveal?.roundScoring ?? null) as Record<
    string,
    { points?: number; factors?: string[]; streak?: number; rankDelta?: number }
  > | null;
  const promptTimerEndMs = useMemo(() => {
    const raw = typeof publishedPrompt?.timerEndsUtc === 'string' ? Date.parse(publishedPrompt.timerEndsUtc) : NaN;
    return Number.isFinite(raw) ? raw : null;
  }, [publishedPrompt?.timerEndsUtc]);
  const promptTimerTotalSeconds = useMemo(
    () => clampInt(Number(publishedPrompt?.timerSeconds ?? liveRules.timer.seconds), 1, 600),
    [liveRules.timer.seconds, publishedPrompt?.timerSeconds]
  );
  const timerRemainingMs = promptTimerEndMs == null ? null : Math.max(0, promptTimerEndMs - nowTick);
  const timerProgress = timerRemainingMs == null
    ? 0
    : Math.max(0, Math.min(1, timerRemainingMs / Math.max(1, promptTimerTotalSeconds * 1000)));
  const joinUrl = useMemo(
    () => (session?.code && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/public/live-revision/${encodeURIComponent(session.code)}`
      : ''),
    [session?.code]
  );
  const presenterUrl = useMemo(
    () => (session?.code && typeof window !== 'undefined'
      ? `${window.location.origin}/#/cogita/public/live-revision-screen/${encodeURIComponent(session.code)}`
      : ''),
    [session?.code]
  );
  const hostUrl = useMemo(() => {
    if (!session?.sessionId || !session?.hostSecret || typeof window === 'undefined') return '';
    const base = `${window.location.origin}/#/cogita/live-revision-host/${encodeURIComponent(libraryId)}/${encodeURIComponent(revisionId)}`;
    const params = new URLSearchParams({
      sessionId: session.sessionId,
      hostSecret: session.hostSecret,
      code: session.code
    });
    return `${base}?${params.toString()}`;
  }, [libraryId, revisionId, session?.code, session?.hostSecret, session?.sessionId]);
  const sessionStage =
    session?.status === 'finished' || session?.status === 'closed'
      ? 'finished'
      : session?.status && session.status !== 'lobby'
        ? 'active'
        : 'lobby';
  const showHostPanel = hostViewMode === 'panel';
  const showQuestionPanel = hostViewMode === 'panel' || hostViewMode === 'question';
  const showScorePanel = hostViewMode === 'panel' || hostViewMode === 'score';
  const formatLive = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
  const statusLabelMap: Record<string, string> = {
    lobby: liveCopy.statusLobby,
    running: liveCopy.statusRunning,
    revealed: liveCopy.statusRevealed,
    finished: liveCopy.statusFinished,
    closed: 'Closed'
  };
  const factorIcon = (factor: string) => (factor === 'first' ? '⚡' : factor === 'streak' ? '🔥' : factor === 'speed' ? '⏱' : '✓');

  const mergeHostSecrets = (
    next: CogitaLiveRevisionSession,
    previous?: CogitaLiveRevisionSession | null,
    fallback?: { hostSecret?: string; code?: string } | null
  ): CogitaLiveRevisionSession => ({
    ...next,
    hostSecret: next.hostSecret || previous?.hostSecret || fallback?.hostSecret || '',
    code: next.code || previous?.code || fallback?.code || ''
  });
  const autoRevealLockRef = useRef<string | null>(null);

  const createSessionWithCurrentSettings = async () => {
    const created = await createCogitaLiveRevisionSession({
      libraryId,
      revisionId,
      title: liveCopy.hostKicker,
      sessionMode,
      hostViewMode,
      participantViewMode,
      sessionSettings: {
        mode: sessionMode,
        hostViewMode,
        participantViewMode,
        liveRules
      }
    });
    setSession(created);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ sessionId: created.sessionId, hostSecret: created.hostSecret, code: created.code })
      );
    }
  };

  useEffect(() => {
    if (!session?.sessionId) return;
    setSessionMode(session.sessionMode === 'asynchronous' ? 'asynchronous' : 'simultaneous');
    setHostViewMode(
      session.hostViewMode === 'question' || session.hostViewMode === 'score' ? session.hostViewMode : 'panel'
    );
    setParticipantViewMode(
      session.participantViewMode === 'score' || session.participantViewMode === 'fullscreen'
        ? session.participantViewMode
        : 'question'
    );
    setLiveRules(parseLiveRules(session.sessionSettings));
    const promptState =
      session.currentPrompt && typeof session.currentPrompt === 'object'
        ? ((session.currentPrompt as Record<string, unknown>).streakState as Record<string, unknown> | undefined)
        : undefined;
    const revealState =
      session.currentReveal && typeof session.currentReveal === 'object'
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
  }, [session?.currentPrompt, session?.currentReveal, session?.hostViewMode, session?.participantViewMode, session?.sessionId, session?.sessionMode, session?.sessionSettings]);

  useEffect(() => {
    if (session?.status !== 'running' || promptTimerEndMs == null) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [promptTimerEndMs, session?.status]);

  useEffect(() => {
    if (sessionStage !== 'lobby') {
      setLayoutMode('fullscreen');
    }
  }, [sessionStage]);

  useEffect(() => {
    let canceled = false;
    buildLiveRounds({
      libraryId,
      revisionId,
      labels: {
        selectMatchingPairPrompt: liveCopy.selectMatchingPairPrompt,
        wordLanguagePromptPrefix: liveCopy.wordLanguagePromptPrefix
      }
    })
      .then((built) => {
        if (canceled) return;
        setRounds(built);
      })
      .catch(() => {
        if (canceled) return;
        setError(liveCopy.loadRoundsError);
        setStatus('error');
      });
    return () => {
      canceled = true;
    };
  }, [libraryId, liveCopy.selectMatchingPairPrompt, liveCopy.wordLanguagePromptPrefix, revisionId]);

  useEffect(() => {
    let canceled = false;
    async function ensureSession() {
      try {
        const params = new URLSearchParams(location.search);
        const sessionIdFromQuery = params.get('sessionId');
        const hostSecretFromQuery = params.get('hostSecret');
        const codeFromQuery = params.get('code');
        const hasAttachPayload = Boolean(sessionIdFromQuery && hostSecretFromQuery);
        if (hasAttachPayload && sessionIdFromQuery && hostSecretFromQuery) {
          const attached = await getCogitaLiveRevisionSession({
            libraryId,
            sessionId: sessionIdFromQuery,
            hostSecret: hostSecretFromQuery
          });
          if (canceled) return;
          const merged = mergeHostSecrets(attached, null, {
            hostSecret: hostSecretFromQuery,
            code: codeFromQuery ?? undefined
          });
          setSession(merged);
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(
              storageKey,
              JSON.stringify({ sessionId: merged.sessionId, hostSecret: merged.hostSecret, code: merged.code })
            );
          }
          setStatus('ready');
          return;
        }

        const created = await createCogitaLiveRevisionSession({
          libraryId,
          revisionId,
          title: liveCopy.hostKicker,
          sessionMode,
          hostViewMode,
          participantViewMode,
          sessionSettings: {
            mode: sessionMode,
            hostViewMode,
            participantViewMode,
            liveRules
          }
        });
        if (canceled) return;
        setSession(created);
        localStorage.setItem(
          storageKey,
          JSON.stringify({ sessionId: created.sessionId, hostSecret: created.hostSecret, code: created.code })
        );
        setStatus('ready');
      } catch {
        if (canceled) return;
        setError(liveCopy.createSessionError);
        setStatus('error');
      }
    }
    ensureSession();
    return () => {
      canceled = true;
    };
  }, [libraryId, liveCopy.hostKicker, location.search, revisionId, storageKey]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(async () => {
      try {
        const fresh = await getCogitaLiveRevisionSession({ libraryId, sessionId: session.sessionId, hostSecret: session.hostSecret });
        setSession((prev) => mergeHostSecrets(fresh, prev));
      } catch {
        // ignore poll errors
      }
    }, 1200);
    return () => window.clearInterval(timer);
  }, [libraryId, session]);

  useEffect(() => {
    if (!session || !currentRound) return;
    if (session.status !== 'running') return;
    if (session.sessionMode !== 'simultaneous') return;

    const prompt = (session.currentPrompt ?? null) as Record<string, unknown> | null;
    const connectedParticipants = session.participants.filter((participant) => participant.isConnected);
    const effectiveParticipants = connectedParticipants.length > 0 ? connectedParticipants : session.participants;
    const answeredRows = session.currentRoundAnswers
      .filter(
        (answer) =>
          answer.roundIndex === session.currentRoundIndex &&
          (answer.cardKey ?? '') === currentRound.cardKey
      )
      .sort((a, b) => Date.parse(a.submittedUtc) - Date.parse(b.submittedUtc));
    const answeredParticipants = new Set(
      answeredRows.map((answer) => answer.participantId)
    );
    const firstAnswered = answeredRows.length > 0;
    const allAnswered = effectiveParticipants.length > 0 && effectiveParticipants.every((participant) =>
      answeredParticipants.has(participant.participantId)
    );

    const timerStarted = typeof prompt?.timerStartedUtc === 'string' && prompt.timerStartedUtc.length > 0;
    const timerEndsMs = typeof prompt?.timerEndsUtc === 'string' ? Date.parse(prompt.timerEndsUtc) : NaN;
    const timerExpired = timerStarted && Number.isFinite(timerEndsMs) && Date.now() >= timerEndsMs;
    const baseKey = `${session.sessionId}:${session.currentRoundIndex}:${currentRound.cardKey}:${session.revealVersion}:${answeredRows.length}:${String(prompt?.timerStartedUtc ?? '')}:${String(prompt?.timerEndsUtc ?? '')}`;

    const executeOnce = (suffix: string, action: () => Promise<void>) => {
      const key = `${baseKey}:${suffix}`;
      if (autoRevealLockRef.current === key) return;
      autoRevealLockRef.current = key;
      void action().catch(() => {
        autoRevealLockRef.current = null;
      });
    };

    const startTimerNow = async () => {
      if (!prompt) return;
      const timerStartedUtc = new Date().toISOString();
      const seconds = clampInt(liveRules.timer.seconds, 3, 600);
      const timerEndsUtc = new Date(Date.parse(timerStartedUtc) + seconds * 1000).toISOString();
      await pushState({
        currentPrompt: {
          ...prompt,
          timerEnabled: true,
          timerSeconds: seconds,
          timerStartedUtc,
          timerEndsUtc
        }
      });
    };

    if (liveRules.firstAnswerAction === 'start_timer' && liveRules.timer.enabled && firstAnswered && !timerStarted) {
      executeOnce('first-start-timer', startTimerNow);
      return;
    }
    if (liveRules.firstAnswerAction === 'reveal' && firstAnswered) {
      executeOnce('first-reveal', async () => {
        await handleReveal();
      });
      return;
    }

    if (allAnswered) {
      if (liveRules.allAnsweredAction === 'reveal') {
        executeOnce('all-reveal', async () => {
          await handleReveal();
        });
        return;
      }
      if (liveRules.allAnsweredAction === 'next') {
        executeOnce('all-next', async () => {
          await handleReveal();
          await handleNext();
        });
        return;
      }
    }

    if (timerExpired) {
      if (liveRules.timer.onExpire === 'reveal') {
        executeOnce('timer-reveal', async () => {
          await handleReveal();
        });
        return;
      }
      if (liveRules.timer.onExpire === 'next') {
        executeOnce('timer-next', async () => {
          await handleReveal();
          await handleNext();
        });
      }
    }
  }, [currentRound, liveRules, session]);

  useEffect(() => {
    autoRevealLockRef.current = null;
  }, [session?.currentRoundIndex, session?.revealVersion, session?.status, session?.sessionId]);

  useEffect(() => {
    if (!session || !currentRound) return;
    if (session.status !== 'running') return;

    const answersForRound = new Set(
      session.currentRoundAnswers
        .filter(
          (answer) =>
            answer.roundIndex === session.currentRoundIndex &&
            (answer.cardKey ?? '') === currentRound.cardKey
        )
        .map((answer) => answer.participantId)
    );
    if (session.participants.length === 0) {
      setRoundGainByParticipant({});
      return;
    }
    const info: Record<string, RoundGain> = {};
    session.participants.forEach((participant) => {
      const revealInfo = publishedRoundScoring?.[participant.participantId];
      const points = clampInt(Number(revealInfo?.points ?? 0), 0, 100000);
      const factors = Array.isArray(revealInfo?.factors) ? revealInfo.factors.map(String) : [];
      const streak = clampInt(Number(revealInfo?.streak ?? 0), 0, 100000);
      const rankDelta = clampInt(Number(revealInfo?.rankDelta ?? 0), -100000, 100000);
      info[participant.participantId] = { points, factors, streak, rankDelta };
      if (!answersForRound.has(participant.participantId) && session.status === 'running') {
        info[participant.participantId] = { points: 0, factors: [], streak: streakByParticipantRef.current[participant.participantId] ?? 0, rankDelta: 0 };
      }
    });
    setRoundGainByParticipant(info);
  }, [currentRound, publishedRoundScoring, session]);

  const pushState = async (next: {
    status?: string;
    currentRoundIndex?: number;
    revealVersion?: number;
    currentPrompt?: unknown | null;
    currentReveal?: unknown | null;
  }) => {
    if (!session) return;
    const hasPrompt = Object.prototype.hasOwnProperty.call(next, 'currentPrompt');
    const hasReveal = Object.prototype.hasOwnProperty.call(next, 'currentReveal');
    const updated = await updateCogitaLiveRevisionHostState({
      libraryId,
      sessionId: session.sessionId,
      hostSecret: session.hostSecret,
      status: next.status ?? session.status,
      currentRoundIndex: next.currentRoundIndex ?? session.currentRoundIndex,
      revealVersion: next.revealVersion ?? session.revealVersion,
      currentPrompt: hasPrompt ? (next.currentPrompt ?? null) : (session.currentPrompt ?? null),
      currentReveal: hasReveal ? (next.currentReveal ?? null) : (session.currentReveal ?? null)
    });
    setSession((prev) => mergeHostSecrets(updated, prev));
  };

  const persistSessionModes = async (next: {
    sessionMode?: 'simultaneous' | 'asynchronous';
    hostViewMode?: 'panel' | 'question' | 'score';
    participantViewMode?: 'question' | 'score' | 'fullscreen';
    liveRules?: LiveRules;
  }) => {
    if (!session) return;
    try {
      const effectiveRules = next.liveRules ?? liveRules;
      const updated = await updateCogitaLiveRevisionSession({
        libraryId,
        revisionId,
        sessionId: session.sessionId,
        sessionMode: next.sessionMode ?? sessionMode,
        hostViewMode: next.hostViewMode ?? hostViewMode,
        participantViewMode: next.participantViewMode ?? participantViewMode,
        sessionSettings: {
          mode: next.sessionMode ?? sessionMode,
          hostViewMode: next.hostViewMode ?? hostViewMode,
          participantViewMode: next.participantViewMode ?? participantViewMode,
          liveRules: effectiveRules
        }
      });
      setSession((prev) =>
        prev
          ? {
              ...prev,
              sessionMode: updated.sessionMode,
              hostViewMode: updated.hostViewMode,
              participantViewMode: updated.participantViewMode,
              sessionSettings: updated.sessionSettings
            }
          : prev
      );
    } catch {
      // keep local controls usable even if sync fails
    }
  };

  const applyLiveRules = (updater: (previous: LiveRules) => LiveRules) => {
    setLiveRules((previous) => {
      const next = updater(previous);
      void persistSessionModes({ liveRules: next });
      return next;
    });
  };

  const publishRound = async (index: number) => {
    const round = rounds[index];
    if (!round || !session) return;
    setRoundGainByParticipant({});
    const activeParticipants = session.participants.filter((participant) => participant.isConnected);
    const participantCount = activeParticipants.length > 0 ? activeParticipants.length : session.participants.length;
    const startTimerImmediately =
      session.sessionMode === 'simultaneous' &&
      liveRules.timer.enabled &&
      liveRules.timer.triggerMode === 'first_or_single' &&
      participantCount <= 1;
    const timerStartedUtc = startTimerImmediately ? new Date().toISOString() : null;
    const timerEndsUtc = timerStartedUtc
      ? new Date(Date.parse(timerStartedUtc) + clampInt(liveRules.timer.seconds, 3, 600) * 1000).toISOString()
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
        timerEnabled: liveRules.timer.enabled,
        timerSeconds: clampInt(liveRules.timer.seconds, 3, 600),
        timerStartedUtc,
        timerEndsUtc,
        streakState: streakByParticipantRef.current
      }
    });
  };

  const handleStart = async () => {
    if (!rounds.length) return;
    await publishRound(session?.currentRoundIndex ?? 0);
  };

  const handleReveal = async () => {
    if (!session || !currentRound) return;
    const timerStartedMs = typeof publishedPrompt?.timerStartedUtc === 'string' ? Date.parse(publishedPrompt.timerStartedUtc) : NaN;
    const timerEndsMs = typeof publishedPrompt?.timerEndsUtc === 'string' ? Date.parse(publishedPrompt.timerEndsUtc) : NaN;
    const answerByParticipant = new Map(
      session.currentRoundAnswers
        .filter(
          (answer) =>
            answer.roundIndex === session.currentRoundIndex &&
            (answer.cardKey ?? '') === currentRound.cardKey
        )
        .map((answer) => [answer.participantId, { answer: answer.answer, submittedUtc: answer.submittedUtc }])
    );
    const answerOrder = session.currentRoundAnswers
      .filter(
        (answer) =>
          answer.roundIndex === session.currentRoundIndex &&
          (answer.cardKey ?? '') === currentRound.cardKey
      )
      .sort((a, b) => Date.parse(a.submittedUtc) - Date.parse(b.submittedUtc));
    const beforeRank = buildRankMap(session.participants);
    const previousStreaks = streakByParticipantRef.current;

    const correctness = session.participants.map((participant) => {
      const row = answerByParticipant.get(participant.participantId);
      const isCorrect = currentRound.grade(row?.answer);
      return {
        participantId: participant.participantId,
        isCorrect,
        submittedUtc: row?.submittedUtc ?? null
      };
    });
    const isCorrectByParticipant = new Map(correctness.map((row) => [row.participantId, row.isCorrect]));

    const firstCorrectParticipantId =
      answerOrder.find((answer) => isCorrectByParticipant.get(answer.participantId) === true)?.participantId ?? null;

    const nextStreaks: Record<string, number> = { ...previousStreaks };
    const roundGain: Record<string, RoundGain> = {};
    const scores = correctness.map((row) => {
      const previousStreak = nextStreaks[row.participantId] ?? 0;
      if (!row.isCorrect) {
        nextStreaks[row.participantId] = 0;
        roundGain[row.participantId] = { points: 0, factors: [], streak: 0, rankDelta: 0 };
        return { participantId: row.participantId, isCorrect: false, pointsAwarded: 0 };
      }

      const factors: string[] = [];
      let points = clampInt(liveRules.scoring.baseCorrect, 0, 10000);
      if (points > 0) factors.push('base');
      if (firstCorrectParticipantId && row.participantId === firstCorrectParticipantId && liveRules.scoring.firstCorrectBonus > 0) {
        points += clampInt(liveRules.scoring.firstCorrectBonus, 0, 10000);
        factors.push('first');
      }

      if (
        liveRules.timer.enabled &&
        liveRules.timer.speedBonusMax > 0 &&
        Number.isFinite(timerStartedMs) &&
        Number.isFinite(timerEndsMs) &&
        row.submittedUtc
      ) {
        const submittedMs = Date.parse(row.submittedUtc);
        if (Number.isFinite(submittedMs) && submittedMs <= timerEndsMs) {
          const ratio = Math.max(0, Math.min(1, (timerEndsMs - submittedMs) / Math.max(1, timerEndsMs - timerStartedMs)));
          const speedBonus = clampInt(
            growthRatio(liveRules.timer.speedBonusGrowth, ratio) * liveRules.timer.speedBonusMax,
            0,
            10000
          );
          if (speedBonus > 0) {
            points += speedBonus;
            factors.push('speed');
          }
        }
      }

      const nextStreak = previousStreak + 1;
      nextStreaks[row.participantId] = nextStreak;
      const extraStreak = streakBonus(
        liveRules.scoring.streakGrowth,
        liveRules.scoring.streakBaseBonus,
        nextStreak,
        liveRules.scoring.streakLimit
      );
      if (extraStreak > 0) {
        points += extraStreak;
        factors.push('streak');
      }

      const safePoints = clampInt(points, 0, 100000);
      roundGain[row.participantId] = { points: safePoints, factors, streak: nextStreak, rankDelta: 0 };
      return { participantId: row.participantId, isCorrect: true, pointsAwarded: safePoints };
    });

    const afterScore = await scoreCogitaLiveRevisionRound({
      libraryId,
      sessionId: session.sessionId,
      hostSecret: session.hostSecret,
      scores
    });
    const afterRank = buildRankMap(afterScore.participants);
    Object.keys(roundGain).forEach((participantId) => {
      const before = beforeRank.get(participantId) ?? 0;
      const after = afterRank.get(participantId) ?? before;
      roundGain[participantId] = {
        ...roundGain[participantId],
        rankDelta: before > 0 && after > 0 ? before - after : 0
      };
    });
    streakByParticipantRef.current = nextStreaks;
    setRoundGainByParticipant(roundGain);
    setSession((prev) => mergeHostSecrets(afterScore, prev));
    await pushState({
      status: 'revealed',
      revealVersion: afterScore.revealVersion + 1,
      currentReveal: {
        ...currentRound.reveal,
        roundScoring: roundGain,
        streakState: nextStreaks
      }
    });
  };

  const handleNext = async () => {
    if (!session) return;
    const nextIndex = session.currentRoundIndex + 1;
    if (nextIndex >= rounds.length) {
      await pushState({ status: 'finished', currentReveal: null });
      return;
    }
    await publishRound(nextIndex);
  };

  const handleCheckOrNext = async () => {
    if (!session) return;
    if (session.status === 'running') {
      await handleReveal();
      return;
    }
    if (session.status === 'revealed') {
      await handleNext();
      return;
    }
    if (session.status === 'lobby') {
      await handleStart();
    }
  };

  const handleApproveRelogin = async (requestId: string) => {
    if (!session?.hostSecret) return;
    try {
      const updated = await approveCogitaLiveRevisionReloginRequest({
        libraryId,
        sessionId: session.sessionId,
        hostSecret: session.hostSecret,
        requestId
      });
      setSession((prev) => mergeHostSecrets(updated, prev));
    } catch {
      // keep page usable even on temporary approval errors
    }
  };

  const handleAddParticipant = async () => {
    if (!session?.hostSecret || !newParticipantName.trim()) return;
    try {
      setParticipantBusy('add');
      const updated = await addCogitaLiveRevisionParticipant({
        libraryId,
        sessionId: session.sessionId,
        hostSecret: session.hostSecret,
        name: newParticipantName.trim()
      });
      setSession((prev) => mergeHostSecrets(updated, prev));
      setNewParticipantName('');
    } catch {
      // keep panel usable on temporary add failures
    } finally {
      setParticipantBusy(null);
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if (!session?.hostSecret) return;
    try {
      setParticipantBusy(participantId);
      const updated = await removeCogitaLiveRevisionParticipant({
        libraryId,
        sessionId: session.sessionId,
        hostSecret: session.hostSecret,
        participantId
      });
      setSession((prev) => mergeHostSecrets(updated, prev));
    } catch {
      // keep panel usable on temporary remove failures
    } finally {
      setParticipantBusy(null);
    }
  };

  const handleRefreshCode = async () => {
    if (!session) return;
    try {
      const attached = await attachCogitaLiveRevisionSession({ libraryId, sessionId: session.sessionId });
      setSession(attached);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ sessionId: attached.sessionId, hostSecret: attached.hostSecret, code: attached.code })
        );
      }
    } catch {
      // ignore refresh errors
    }
  };

  const handleCreateNewSession = async () => {
    try {
      setStatus('loading');
      await createSessionWithCurrentSettings();
      setStatus('ready');
    } catch {
      setError(liveCopy.createSessionError);
      setStatus('error');
    }
  };

  const handleCloseSession = async () => {
    if (!session) return;
    try {
      const updated = await closeCogitaLiveRevisionSession({
        libraryId,
        sessionId: session.sessionId,
        hostSecret: session.hostSecret
      });
      setSession((prev) => mergeHostSecrets(updated, prev));
    } catch {
      // keep UI state as-is on temporary close failures
    }
  };

  return (
    <CogitaShell {...props}>
      <section className="cogita-library-dashboard cogita-live-layout-shell" data-layout={layoutMode}>
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            {session ? (
              <div className="cogita-live-layout-controls cogita-live-layout-controls--global">
                <label className="cogita-field">
                  <span>{liveCopy.viewModeLabel}</span>
                  <select value={layoutMode} onChange={(event) => setLayoutMode(event.target.value as 'window' | 'fullscreen')}>
                    <option value="fullscreen">{liveCopy.viewModeFullscreen}</option>
                    <option value="window">{liveCopy.viewModeWindow}</option>
                  </select>
                </label>
                <label className="cogita-field">
                  <span>{liveCopy.hostViewModeLabel}</span>
                  <select
                    value={hostViewMode}
                    onChange={(event) => {
                      const value = event.target.value as 'panel' | 'question' | 'score';
                      setHostViewMode(value);
                      void persistSessionModes({ hostViewMode: value });
                    }}
                  >
                    <option value="panel">{liveCopy.hostViewPanel}</option>
                    <option value="question">{liveCopy.hostViewQuestion}</option>
                    <option value="score">{liveCopy.hostViewScore}</option>
                  </select>
                </label>
                <label className="cogita-field">
                  <span>{liveCopy.participantViewModeLabel}</span>
                  <select
                    value={participantViewMode}
                    onChange={(event) => {
                      const value = event.target.value as 'question' | 'score' | 'fullscreen';
                      setParticipantViewMode(value);
                      void persistSessionModes({ participantViewMode: value });
                    }}
                  >
                    <option value="question">{liveCopy.participantViewQuestion}</option>
                    <option value="score">{liveCopy.participantViewScore}</option>
                    <option value="fullscreen">{liveCopy.participantViewFullscreen}</option>
                  </select>
                </label>
              </div>
            ) : null}
            <div className="cogita-library-grid cogita-live-session-layout" data-stage={sessionStage}>
              {showHostPanel ? (
              <div className="cogita-library-panel">
                <p className="cogita-user-kicker">{liveCopy.hostKicker}</p>
                <h2 className="cogita-detail-title">{liveCopy.hostTitle}</h2>
                {status === 'loading' ? <p>{liveCopy.loading}</p> : null}
                {error ? <p className="cogita-help">{error}</p> : null}
                {session ? (
                  <>
                    <label className="cogita-field">
                      <span>{liveCopy.sessionModeLabel}</span>
                      <select
                        value={sessionMode}
                        onChange={(event) => {
                          const value = event.target.value as 'simultaneous' | 'asynchronous';
                          setSessionMode(value);
                          void persistSessionModes({ sessionMode: value });
                        }}
                      >
                        <option value="simultaneous">{liveCopy.modeSimultaneous}</option>
                        <option value="asynchronous">{liveCopy.modeAsynchronous}</option>
                      </select>
                    </label>
                    <div className="cogita-live-rules-grid">
                      <label className="cogita-field">
                        <span>{liveCopy.onFirstAnswerLabel}</span>
                        <select
                          value={liveRules.firstAnswerAction}
                          onChange={(event) =>
                            applyLiveRules((previous) => ({ ...previous, firstAnswerAction: event.target.value as FirstAnswerAction }))
                          }
                        >
                          <option value="none">{liveCopy.optionDoNothing}</option>
                          <option value="start_timer">{liveCopy.optionStartTimer}</option>
                          <option value="reveal">{liveCopy.optionRevealScore}</option>
                        </select>
                      </label>
                      <label className="cogita-field">
                        <span>{liveCopy.onAllAnsweredLabel}</span>
                        <select
                          value={liveRules.allAnsweredAction}
                          onChange={(event) =>
                            applyLiveRules((previous) => ({ ...previous, allAnsweredAction: event.target.value as AllAnsweredAction }))
                          }
                        >
                          <option value="none">{liveCopy.optionDoNothing}</option>
                          <option value="reveal">{liveCopy.optionRevealScore}</option>
                          <option value="next">{liveCopy.optionRevealNext}</option>
                        </select>
                      </label>
                      <label className="cogita-field">
                        <span>{liveCopy.timerEnabledLabel}</span>
                        <select
                          value={liveRules.timer.enabled ? 'yes' : 'no'}
                          onChange={(event) =>
                            applyLiveRules((previous) => ({
                              ...previous,
                              timer: { ...previous.timer, enabled: event.target.value === 'yes' }
                            }))
                          }
                        >
                          <option value="yes">{liveCopy.optionYes}</option>
                          <option value="no">{liveCopy.optionNo}</option>
                        </select>
                      </label>
                      <label className="cogita-field">
                        <span>{liveCopy.timerSecondsLabel}</span>
                        <input
                          type="number"
                          min={3}
                          max={600}
                          value={liveRules.timer.seconds}
                          onChange={(event) =>
                            applyLiveRules((previous) => ({
                              ...previous,
                              timer: { ...previous.timer, seconds: clampInt(Number(event.target.value), 3, 600) }
                            }))
                          }
                        />
                      </label>
                      <label className="cogita-field">
                        <span>{liveCopy.onTimerExpiredLabel}</span>
                        <select
                          value={liveRules.timer.onExpire}
                          onChange={(event) =>
                            applyLiveRules((previous) => ({
                              ...previous,
                              timer: { ...previous.timer, onExpire: event.target.value as TimerExpireAction }
                            }))
                          }
                        >
                          <option value="none">{liveCopy.optionDoNothing}</option>
                          <option value="reveal">{liveCopy.optionRevealScore}</option>
                          <option value="next">{liveCopy.optionRevealNext}</option>
                        </select>
                      </label>
                      <label className="cogita-field">
                        <span>{liveCopy.basePointsLabel}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={liveRules.scoring.baseCorrect}
                          onChange={(event) =>
                            applyLiveRules((previous) => ({
                              ...previous,
                              scoring: { ...previous.scoring, baseCorrect: clampInt(Number(event.target.value), 0, 100) }
                            }))
                          }
                        />
                      </label>
                      <label className="cogita-field">
                        <span>{liveCopy.firstCorrectBonusLabel}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={liveRules.scoring.firstCorrectBonus}
                          onChange={(event) =>
                            applyLiveRules((previous) => ({
                              ...previous,
                              scoring: { ...previous.scoring, firstCorrectBonus: clampInt(Number(event.target.value), 0, 100) }
                            }))
                          }
                        />
                      </label>
                      <label className="cogita-field">
                        <span>{liveCopy.speedBonusMaxLabel}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={liveRules.timer.speedBonusMax}
                          onChange={(event) =>
                            applyLiveRules((previous) => ({
                              ...previous,
                              timer: { ...previous.timer, speedBonusMax: clampInt(Number(event.target.value), 0, 100) }
                            }))
                          }
                        />
                      </label>
                      <label className="cogita-field">
                        <span>{liveCopy.speedGrowthLabel}</span>
                        <select
                          value={liveRules.timer.speedBonusGrowth}
                          onChange={(event) =>
                            applyLiveRules((previous) => ({
                              ...previous,
                              timer: { ...previous.timer, speedBonusGrowth: event.target.value as BonusGrowthMode }
                            }))
                          }
                        >
                          <option value="linear">{liveCopy.optionLinear}</option>
                          <option value="exponential">{liveCopy.optionExponential}</option>
                          <option value="limited">{liveCopy.optionLimited}</option>
                        </select>
                      </label>
                      <label className="cogita-field">
                        <span>{liveCopy.streakBaseBonusLabel}</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={liveRules.scoring.streakBaseBonus}
                          onChange={(event) =>
                            applyLiveRules((previous) => ({
                              ...previous,
                              scoring: { ...previous.scoring, streakBaseBonus: clampInt(Number(event.target.value), 0, 100) }
                            }))
                          }
                        />
                      </label>
                      <label className="cogita-field">
                        <span>{liveCopy.streakGrowthLabel}</span>
                        <select
                          value={liveRules.scoring.streakGrowth}
                          onChange={(event) =>
                            applyLiveRules((previous) => ({
                              ...previous,
                              scoring: { ...previous.scoring, streakGrowth: event.target.value as BonusGrowthMode }
                            }))
                          }
                        >
                          <option value="linear">{liveCopy.optionLinear}</option>
                          <option value="exponential">{liveCopy.optionExponential}</option>
                          <option value="limited">{liveCopy.optionLimited}</option>
                        </select>
                      </label>
                      <label className="cogita-field">
                        <span>{liveCopy.streakLimitLabel}</span>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={liveRules.scoring.streakLimit}
                          onChange={(event) =>
                            applyLiveRules((previous) => ({
                              ...previous,
                              scoring: { ...previous.scoring, streakLimit: clampInt(Number(event.target.value), 1, 200) }
                            }))
                          }
                        />
                      </label>
                    </div>
                    <div className="cogita-field"><span>{liveCopy.joinCodeLabel}</span><input readOnly value={session.code} /></div>
                    <div className="cogita-field"><span>{liveCopy.joinUrlLabel}</span><input readOnly value={joinUrl} /></div>
                    <div className="cogita-field"><span>{liveCopy.hostUrlLabel}</span><input readOnly value={hostUrl} /></div>
                    <div className="cogita-field"><span>{liveCopy.presenterUrlLabel}</span><input readOnly value={presenterUrl} /></div>
                    {joinUrl ? (
                      <div className="cogita-field">
                        <span>{liveCopy.qrLabel}</span>
                        <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '12px', background: '#fff' }}>
                          <QRCodeSVG value={joinUrl} size={176} marginSize={2} />
                        </div>
                      </div>
                    ) : null}
                    <div className="cogita-field"><span>{liveCopy.statusLabel}</span><input readOnly value={statusLabelMap[session.status] ?? session.status} /></div>
                    <div className="cogita-form-actions">
                      <button type="button" className="cta" onClick={handleStart} disabled={!rounds.length}>{liveCopy.publishCurrentRound}</button>
                      <button type="button" className="cta ghost" onClick={handleCreateNewSession}>{liveCopy.newSessionAction}</button>
                      <button type="button" className="cta ghost" onClick={handleRefreshCode}>{liveCopy.refreshLinksAction}</button>
                      <button type="button" className="cta ghost" onClick={handleCloseSession} disabled={session.status === 'closed'}>
                        {liveCopy.closeSessionAction}
                      </button>
                    </div>
                    <p className="cogita-help">{formatLive(liveCopy.roundsLabel, { count: rounds.length })}</p>
                  </>
                ) : null}
              </div>
              ) : null}
              {showQuestionPanel ? (
              <div className="cogita-library-panel">
                <p className="cogita-user-kicker">{liveCopy.currentRoundTitle}</p>
                <h3 className="cogita-detail-title">
                  {publishedPrompt && typeof publishedPrompt.title === 'string'
                    ? publishedPrompt.title
                    : session?.status === 'lobby'
                      ? liveCopy.sessionNotStarted
                      : liveCopy.waitingForPublishedRound}
                </h3>
                {session?.status === 'running' && publishedPrompt && Boolean(publishedPrompt.timerEnabled) ? (
                  <div className="cogita-live-timer">
                    <div className="cogita-live-timer-head">
                      <span>{liveCopy.timerLabel}</span>
                      <strong>{timerRemainingMs == null ? '--' : `${Math.max(0, Math.ceil(timerRemainingMs / 1000))}s`}</strong>
                    </div>
                    <div className="cogita-live-timer-track">
                      <span style={{ width: `${Math.round(timerProgress * 100)}%` }} />
                    </div>
                  </div>
                ) : null}
                {session?.status === 'lobby' ? (
                  <p className="cogita-help">{liveCopy.hiddenBeforeStart}</p>
                ) : (
                  <CogitaCheckcardSurface
                    className="cogita-live-card-container"
                    feedbackToken={publishedReveal ? `correct-${session?.revealVersion ?? 0}` : 'idle'}
                  >
                    <CogitaLivePromptCard
                      prompt={publishedPrompt}
                      revealExpected={publishedReveal?.expected}
                      mode="readonly"
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
                    />
                  </CogitaCheckcardSurface>
                )}
                {sessionStage !== 'lobby' ? (
                  <div className="cogita-form-actions">
                    {session?.status === 'running' && publishedPrompt && liveRules.timer.enabled && !publishedPrompt.timerStartedUtc ? (
                      <button
                        type="button"
                        className="cta ghost"
                        onClick={() => {
                          const timerStartedUtc = new Date().toISOString();
                          const seconds = clampInt(liveRules.timer.seconds, 3, 600);
                          const timerEndsUtc = new Date(Date.parse(timerStartedUtc) + seconds * 1000).toISOString();
                          void pushState({
                            currentPrompt: {
                              ...(publishedPrompt ?? {}),
                              timerEnabled: true,
                              timerSeconds: seconds,
                              timerStartedUtc,
                              timerEndsUtc
                            }
                          });
                        }}
                      >
                        {liveCopy.startTimerAction}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="cta"
                      onClick={handleCheckOrNext}
                      disabled={!rounds.length || !currentRound || session.status === 'finished' || session.status === 'closed'}
                    >
                      {session.status === 'revealed' ? revisionCopy.nextQuestion : revisionCopy.checkAnswer}
                    </button>
                  </div>
                ) : null}
                {sessionStage !== 'finished' ? (
                  <>
                    <p className="cogita-user-kicker">{liveCopy.participantsTitle}</p>
                    <div className="cogita-live-participant-add">
                      <input
                        value={newParticipantName}
                        onChange={(event) => setNewParticipantName(event.target.value)}
                        placeholder={liveCopy.addParticipantPlaceholder}
                      />
                      <button
                        type="button"
                        className="cta ghost"
                        onClick={handleAddParticipant}
                        disabled={!newParticipantName.trim() || participantBusy === 'add'}
                      >
                        {liveCopy.addParticipantAction}
                      </button>
                    </div>
                    <div className="cogita-share-list">
                      {session?.participants.map((participant) => {
                        const answer = session.currentRoundAnswers.find((a) => a.participantId === participant.participantId);
                        const gain = roundGainByParticipant[participant.participantId];
                        const symbols = gain?.factors ?? [];
                        return (
                          <div className="cogita-share-row" key={participant.participantId}>
                            <div>
                              <strong>{participant.displayName}</strong>
                              <div className="cogita-share-meta">
                                {answer ? liveCopy.answerStatusAnswered : liveCopy.answerStatusWaiting}
                                {answer?.isCorrect === true ? ` · ${liveCopy.answerStatusCorrect}` : ''}
                                {answer?.isCorrect === false ? ` · ${liveCopy.answerStatusIncorrect}` : ''}
                                {gain && gain.points > 0 ? ` · +${gain.points} ${liveCopy.scoreUnit}` : ''}
                                {gain && gain.streak > 1 ? ` · ${liveCopy.streakLabel.toLowerCase()} ${gain.streak}` : ''}
                              </div>
                              {symbols.length > 0 ? (
                                <div className="cogita-live-factor-badges">
                                  {symbols.map((factor) => (
                                    <span key={`${participant.participantId}:${factor}`} className="cogita-live-factor-badge">
                                      {factorIcon(factor)}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => handleRemoveParticipant(participant.participantId)}
                              disabled={participantBusy === participant.participantId}
                            >
                              {liveCopy.removeParticipantAction}
                            </button>
                          </div>
                        );
                      })}
                      {session && session.participants.length === 0 ? <p className="cogita-help">{liveCopy.noParticipants}</p> : null}
                    </div>
                    {session && (session.pendingReloginRequests?.length ?? 0) > 0 ? (
                      <>
                        <p className="cogita-user-kicker">{liveCopy.reloginRequestsTitle}</p>
                        <div className="cogita-share-list">
                          {(session.pendingReloginRequests ?? []).map((request) => (
                            <div className="cogita-share-row" key={request.requestId}>
                              <div>
                                <strong>{request.displayName}</strong>
                                <div className="cogita-share-meta">{new Date(request.requestedUtc).toLocaleTimeString()}</div>
                              </div>
                              <button type="button" className="ghost" onClick={() => handleApproveRelogin(request.requestId)}>
                                {liveCopy.allowReloginAction}
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
              ) : null}
              {sessionStage !== 'lobby' && showScorePanel ? (
                <div className="cogita-library-panel cogita-live-scoreboard-panel">
                  <p className="cogita-user-kicker">{sessionStage === 'finished' ? liveCopy.finalScoreTitle : liveCopy.pointsTitle}</p>
                  <p className="cogita-help">{liveCopy.symbolsLegend}</p>
                  <div className="cogita-share-list">
                    {(session?.scoreboard ?? []).map((row, index) => {
                      const gain = roundGainByParticipant[row.participantId];
                      const rankDelta = gain?.rankDelta ?? 0;
                      const symbols = gain?.factors ?? [];
                      return (
                        <div
                          className={`cogita-share-row cogita-live-rank-row ${rankDelta > 0 ? 'is-up' : rankDelta < 0 ? 'is-down' : ''}`}
                          key={`score:${row.participantId}`}
                        >
                          <div>
                            <strong>{index + 1}. {row.displayName}</strong>
                            {symbols.length > 0 ? (
                              <div className="cogita-live-factor-badges">
                                {symbols.map((factor) => (
                                  <span key={`score:${row.participantId}:${factor}`} className="cogita-live-factor-badge">
                                    {factorIcon(factor)}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <div className="cogita-share-meta">
                            {row.score} {liveCopy.scoreUnit}
                            {gain && gain.points > 0 ? ` (+${gain.points})` : ''}
                            {rankDelta > 0 ? ` ↑${rankDelta}` : rankDelta < 0 ? ` ↓${Math.abs(rankDelta)}` : ''}
                          </div>
                        </div>
                      );
                    })}
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
