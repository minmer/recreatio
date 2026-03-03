import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getCogitaCollectionCards,
  getCogitaComputedSample,
  getCogitaInfoDetail,
  getCogitaLiveRevisionSession,
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
import { parseQuestionDefinition, type ParsedQuestionDefinition } from '../library/questions/questionRuntime';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaLiveWallLayout } from './components/CogitaLiveWallLayout';

function normalizeAnswer(answer: unknown, prompt: LivePrompt | null) {
  if (!prompt) return {};
  const kind = String(prompt.kind ?? '');
  if (kind === 'selection') return { selection: Array.isArray(answer) ? answer.map((x) => Number(x)).filter(Number.isFinite) : [] };
  if (kind === 'boolean') return { booleanAnswer: typeof answer === 'boolean' ? answer : null };
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
  key: 'action' | 'bonus' | 'round';
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
      publicPrompt: {
        kind: 'text',
        title,
        prompt: question,
        inputType: type === 'number' ? 'number' : type === 'date' ? 'date' : 'text',
        cardLabel: 'question'
      },
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
      }
      continue;
    }

    if (card.cardType !== 'info') continue;
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
    }
  }

  return rounds.map((round, index) => ({ ...round, roundIndex: index }));
}

export function CogitaLiveHostWallPage({
  copy,
  libraryId,
  revisionId,
  sessionId,
  hostSecret
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
  const [busy, setBusy] = useState<'none' | 'reveal' | 'score' | 'next'>('none');
  const [rounds, setRounds] = useState<LiveRound[]>([]);
  const [roundLoadError, setRoundLoadError] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [scoreFxByParticipant, setScoreFxByParticipant] = useState<Record<string, { delta: number; rankShift: number; token: number }>>({});
  const prevScoresRef = useRef<Map<string, number>>(new Map());
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const currentRound = session ? rounds[session.currentRoundIndex] ?? null : null;
  const prompt =
    ((session?.currentPrompt as LivePrompt | undefined) ??
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
  const answeredCount = roundAnswers.length;
  const participantCount = session?.participants.length ?? 0;

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
      enabled: promptRoot.actionTimerEnabled,
      endsUtc: promptRoot.actionTimerEndsUtc,
      totalSeconds: promptRoot.actionTimerSeconds
    });
    const roundTimer = buildTimer({
      key: 'round',
      label: liveCopy.roundTimerLabel,
      enabled: promptRoot.roundTimerEnabled,
      endsUtc: promptRoot.roundTimerEndsUtc,
      totalSeconds: promptRoot.roundTimerSeconds
    });
    const bonusTimer = buildTimer({
      key: 'bonus',
      label: liveCopy.bonusTimerLabel,
      enabled: promptRoot.bonusTimerEnabled,
      endsUtc: promptRoot.bonusTimerEndsUtc,
      totalSeconds: promptRoot.bonusTimerSeconds
    });
    if (actionTimer) next.push(actionTimer);
    if (roundTimer) next.push(roundTimer);
    if (bonusTimer) next.push(bonusTimer);
    return next;
  }, [liveCopy.actionTimerLabel, liveCopy.bonusTimerLabel, liveCopy.roundTimerLabel, nowTick, promptRoot]);

  const pollSession = async () => {
    try {
      const next = await getCogitaLiveRevisionSession({ libraryId, sessionId, hostSecret });
      setSession(next);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    void pollSession();
    const id = window.setInterval(pollSession, 1200);
    return () => window.clearInterval(id);
  }, [libraryId, sessionId, hostSecret]);

  useEffect(() => {
    let canceled = false;
    setRoundLoadError(false);
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
        setRoundLoadError(true);
      });
    return () => {
      canceled = true;
    };
  }, [libraryId, liveCopy.selectMatchingPairPrompt, liveCopy.wordLanguagePromptPrefix, revisionId]);

  useEffect(() => {
    if (timers.length === 0) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [timers.length]);

  const projected = useMemo(() => {
    if (!prompt || !revealExpected) return [] as Array<{ participant: CogitaLiveRevisionParticipant; current: number; predicted: number; correct: boolean }>;
    const firstAnsweredParticipantId = roundAnswers[0]?.participantId ?? null;
    const processed = roundAnswers
      .map((row) => {
        const participant = participantById.get(row.participantId);
        if (!participant) return null;
        const check = evaluateCheckcardAnswer({
          prompt: prompt as unknown as Record<string, unknown>,
          expected: revealExpected,
          answer: normalizeAnswer(row.answer, prompt)
        }).correct;
        const wrongPenalty = !check ? clampInt(rules.scoring.wrongAnswerPenalty, 0, 500000) : 0;
        const firstWrongPenalty =
          !check && firstAnsweredParticipantId && row.participantId === firstAnsweredParticipantId
            ? clampInt(rules.scoring.firstWrongPenalty, 0, 500000)
            : 0;
        const base = check ? rules.scoring.baseCorrect : -(wrongPenalty + firstWrongPenalty);
        const current = scoresById.get(row.participantId) ?? participant.score ?? 0;
        return {
          participant,
          current,
          predicted: current + base,
          correct: check
        };
      })
      .filter((row): row is { participant: CogitaLiveRevisionParticipant; current: number; predicted: number; correct: boolean } => Boolean(row));
    return processed.sort((a, b) => b.predicted - a.predicted);
  }, [participantById, prompt, revealExpected, roundAnswers, rules.scoring.baseCorrect, rules.scoring.firstWrongPenalty, rules.scoring.wrongAnswerPenalty, scoresById]);

  const projectionByParticipant = useMemo(() => new Map(projected.map((x) => [x.participant.participantId, x])), [projected]);
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
    if (!session) return;
    const hasPrompt = Object.prototype.hasOwnProperty.call(next, 'currentPrompt');
    const hasReveal = Object.prototype.hasOwnProperty.call(next, 'currentReveal');
    const updated = await updateCogitaLiveRevisionHostState({
      libraryId,
      sessionId: session.sessionId,
      hostSecret,
      status: next.status ?? session.status,
      currentRoundIndex: next.currentRoundIndex ?? session.currentRoundIndex,
      revealVersion: next.revealVersion ?? session.revealVersion,
      currentPrompt: hasPrompt ? (next.currentPrompt ?? null) : (session.currentPrompt ?? null),
      currentReveal: hasReveal ? (next.currentReveal ?? null) : (session.currentReveal ?? null)
    });
    setSession(updated);
  };

  const publishRound = async (index: number) => {
    const round = rounds[index];
    if (!round || !session) return;
    const activeParticipants = session.participants.filter((participant) => participant.isConnected);
    const participantCount = activeParticipants.length > 0 ? activeParticipants.length : session.participants.length;
    const startActionTimerImmediately =
      session.sessionMode === 'simultaneous' &&
      rules.actionTimer.enabled &&
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
    const roundTimerEnabled = Boolean(rules.questionTimer?.enabled);
    const roundTimerSeconds = clampInt(Number(rules.questionTimer?.seconds ?? 60), 3, 1200);
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
        actionTimerEnabled: rules.actionTimer.enabled,
        actionTimerSeconds: clampInt(rules.actionTimer.seconds, 3, 600),
        actionTimerStartedUtc,
        actionTimerEndsUtc,
        bonusTimerEnabled: rules.bonusTimer.enabled,
        bonusTimerSeconds: clampInt(rules.bonusTimer.seconds, 1, 600),
        bonusTimerStartMode: rules.bonusTimer.startMode,
        bonusTimerStartedUtc,
        bonusTimerEndsUtc,
        roundTimerEnabled,
        roundTimerSeconds,
        roundTimerStartedUtc,
        roundTimerEndsUtc
      }
    });
  };

  const revealRound = async () => {
    if (!session || !currentRound) return;
    setBusy('reveal');
    try {
      await pushState({
        status: 'revealed',
        currentRoundIndex: session.currentRoundIndex,
        revealVersion: session.revealVersion + 1,
        currentPrompt: session.currentPrompt,
        currentReveal: { ...currentRound.reveal }
      });
    } finally {
      setBusy('none');
    }
  };

  const scoreRound = async () => {
    if (!session || !currentRound) return;
    setBusy('score');
    try {
      const firstAnsweredParticipantId = roundAnswers[0]?.participantId ?? null;
      const answersByParticipant = new Map(roundAnswers.map((row) => [row.participantId, row]));
      const payload = session.participants.map((participant) => {
        const row = answersByParticipant.get(participant.participantId);
        const correct = row ? currentRound.grade(row.answer) : false;
        const wrongPenalty = !correct ? clampInt(rules.scoring.wrongAnswerPenalty, 0, 500000) : 0;
        const firstWrongPenalty =
          !correct && firstAnsweredParticipantId && participant.participantId === firstAnsweredParticipantId
            ? clampInt(rules.scoring.firstWrongPenalty, 0, 500000)
            : 0;
        return {
          participantId: participant.participantId,
          isCorrect: correct,
          pointsAwarded: correct ? rules.scoring.baseCorrect : -(wrongPenalty + firstWrongPenalty)
        };
      });
      const next = await scoreCogitaLiveRevisionRound({
        libraryId,
        sessionId: session.sessionId,
        hostSecret,
        scores: payload
      });
      setSession(next);
    } finally {
      setBusy('none');
    }
  };

  const nextRound = async () => {
    if (!session) return;
    setBusy('next');
    try {
      const nextIndex = session.currentRoundIndex + 1;
      if (nextIndex >= rounds.length) {
        await pushState({ status: 'finished', currentReveal: null });
      } else {
        await publishRound(nextIndex);
      }
    } finally {
      setBusy('none');
    }
  };

  const startSession = async () => {
    if (!session || rounds.length === 0) return;
    setBusy('next');
    try {
      await publishRound(Math.max(0, Math.min(rounds.length - 1, session.currentRoundIndex)));
    } finally {
      setBusy('none');
    }
  };

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
            {session?.status === 'lobby' ? (
              <button type="button" className="cta" onClick={() => void startSession()} disabled={busy !== 'none' || rounds.length === 0}>
                {liveCopy.publishCurrentRound}
              </button>
            ) : (
              <>
                <button type="button" className="cta" onClick={() => void revealRound()} disabled={busy !== 'none'}>
                  {liveCopy.checkAndReveal}
                </button>
                <button type="button" className="ghost" onClick={() => void scoreRound()} disabled={busy !== 'none'}>
                  {liveCopy.optionRevealScore}
                </button>
                <button type="button" className="ghost" onClick={() => void nextRound()} disabled={busy !== 'none'}>
                  {liveCopy.nextQuestionAction}
                </button>
              </>
            )}
          </div>
          {roundLoadError ? <p className="cogita-help">{liveCopy.loadRoundsError}</p> : null}
          {!roundLoadError && rounds.length === 0 ? <p className="cogita-help">{liveCopy.waitingForPublishedRound}</p> : null}
          <CogitaCheckcardSurface className="cogita-live-card-container" feedbackToken={reveal ? `correct-${session?.revealVersion ?? 0}` : 'idle'}>
            <CogitaLivePromptCard
              prompt={prompt}
              revealExpected={revealExpected}
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
        </div>
      }
      right={
        <div className="cogita-live-wall-stack">
          <p className="cogita-user-kicker">{liveCopy.pointsTitle}</p>
          <div className="cogita-share-list">
            {(session?.scoreboard ?? []).map((row) => {
              const pred = projectionByParticipant.get(row.participantId);
              const correctness = correctnessByParticipant.get(row.participantId);
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
                  </div>
                  <div className="cogita-share-meta">
                    {`→ ${(pred?.predicted ?? row.score)} ${liveCopy.scoreUnit}`}
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
            {status === 'ready' && (session?.scoreboard.length ?? 0) === 0 ? <p>{liveCopy.noParticipants}</p> : null}
          </div>
        </div>
      }
    />
  );
}
