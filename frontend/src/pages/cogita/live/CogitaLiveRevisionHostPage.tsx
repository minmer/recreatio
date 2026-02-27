import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  approveCogitaLiveRevisionReloginRequest,
  attachCogitaLiveRevisionSession,
  createCogitaLiveRevisionSession,
  getCogitaCollectionCards,
  getCogitaComputedSample,
  getCogitaInfoDetail,
  getCogitaLiveRevisionSession,
  getCogitaRevision,
  scoreCogitaLiveRevisionRound,
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
import { evaluateAnchorTextAnswer } from '../../../cogita/revision/compare';
import { useLocation } from 'react-router-dom';
import { parseQuestionDefinition, type ParsedQuestionDefinition } from '../library/questions/questionRuntime';
import { CogitaLivePromptCard } from './components/CogitaLivePromptCard';

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

const normalizeText = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase();
const uniqSortedInts = (values: unknown[]) => Array.from(new Set(values.map((x) => Number(x)).filter(Number.isFinite))).sort((a, b) => a - b);
const normalizePathSet = (paths: number[][]) => paths.map((p) => p.join(',')).sort().join('|');

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
      grade: (answer) => {
        const actual = Array.isArray(answer) ? uniqSortedInts(answer) : [];
        return JSON.stringify(actual) === JSON.stringify(remappedExpected);
      }
    };
  }

  if (type === 'truefalse') {
    const expected = Boolean(definition.answer);
    return {
      roundIndex,
      cardKey: `info:${infoId}:question-truefalse`,
      publicPrompt: { kind: 'boolean', title, prompt: question, cardLabel: 'question' },
      reveal: { kind: 'boolean', expected, title },
      grade: (answer) => Boolean(answer) === expected
    };
  }

  if (type === 'text' || type === 'number' || type === 'date') {
    const expected = String(definition.answer ?? '');
    return {
      roundIndex,
      cardKey: `info:${infoId}:question-${type}`,
      publicPrompt: { kind: 'text', title, prompt: question, inputType: type === 'number' ? 'number' : type === 'date' ? 'date' : 'text', cardLabel: 'question' },
      reveal: { kind: 'text', expected, title },
      grade: (answer) => {
        if (type === 'number') {
          const a = Number(answer);
          const b = Number(expected);
          return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9;
        }
        return normalizeText(answer) === normalizeText(expected);
      }
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
      grade: (answer) => JSON.stringify(Array.isArray(answer) ? answer.map(String) : []) === JSON.stringify(options)
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
        return normalizePathSet(paths) === normalizePathSet(expectedPaths);
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
          grade: (answer) => normalizeText(answer) === normalizeText(b)
        });
      } else if (card.checkType === 'translation' && card.direction === 'b-to-a') {
        const [a, b] = pair;
        rounds.push({
          roundIndex: rounds.length,
          cardKey: `connection:${card.cardId}:translation:b-to-a`,
          publicPrompt: { kind: 'text', title: card.label, prompt: b, cardLabel: card.description ?? undefined },
          reveal: { kind: 'text', expected: a, title: card.label },
          grade: (answer) => normalizeText(answer) === normalizeText(a)
        });
      } else if (card.checkType === 'translation-match') {
        const options = Array.from(new Set([card.label, ...vocabLabels.filter((x) => x !== card.label).slice(0, 3)]));
        const correctIndex = options.findIndex((x) => x === card.label);
        rounds.push({
          roundIndex: rounds.length,
          cardKey: `connection:${card.cardId}:translation-match`,
          publicPrompt: { kind: 'selection', title: card.label, prompt: labels.selectMatchingPairPrompt, options, multiple: false, cardLabel: card.description ?? undefined },
          reveal: { kind: 'selection', expected: [correctIndex], title: card.label },
          grade: (answer) => {
            const selected = Array.isArray(answer) ? uniqSortedInts(answer) : uniqSortedInts([answer]);
            return selected.length === 1 && selected[0] === correctIndex;
          }
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
        grade: (answer) => normalizeText(answer) === normalizeText(expected)
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
        grade: (answer) => normalizeText(answer) === normalizeText(sample.expectedAnswer)
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
          grade: (answer) => {
            const result = evaluateAnchorTextAnswer(ctx.fragment, String(answer ?? ''), {
              thresholdPercent: 90,
              treatSimilarCharsAsSame: true,
              ignorePunctuationAndSpacing: true
            });
            return result.isCorrect;
          }
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
  const storageKey = `cogita.live.host.${libraryId}.${revisionId}`;

  const currentRound = session ? rounds[session.currentRoundIndex] ?? null : null;
  const publishedPrompt = (session?.status && session.status !== 'lobby'
    ? ((session.currentPrompt ?? null) as Record<string, unknown> | null)
    : null);
  const publishedReveal = (session?.currentReveal ?? null) as Record<string, unknown> | null;
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
  const sessionStage = session?.status === 'finished' ? 'finished' : session?.status && session.status !== 'lobby' ? 'active' : 'lobby';
  const formatLive = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
  const statusLabelMap: Record<string, string> = {
    lobby: liveCopy.statusLobby,
    running: liveCopy.statusRunning,
    revealed: liveCopy.statusRevealed,
    finished: liveCopy.statusFinished
  };

  const mergeHostSecrets = (
    next: CogitaLiveRevisionSession,
    previous?: CogitaLiveRevisionSession | null,
    fallback?: { hostSecret?: string; code?: string } | null
  ): CogitaLiveRevisionSession => ({
    ...next,
    hostSecret: next.hostSecret || previous?.hostSecret || fallback?.hostSecret || '',
    code: next.code || previous?.code || fallback?.code || ''
  });

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

        const created = await createCogitaLiveRevisionSession({ libraryId, revisionId, title: liveCopy.hostKicker });
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

  const publishRound = async (index: number) => {
    const round = rounds[index];
    if (!round || !session) return;
    await pushState({
      status: 'running',
      currentRoundIndex: index,
      revealVersion: session.revealVersion + 1,
      currentReveal: null,
      currentPrompt: {
        ...round.publicPrompt,
        roundIndex: index,
        cardKey: round.cardKey
      }
    });
  };

  const handleStart = async () => {
    if (!rounds.length) return;
    await publishRound(session?.currentRoundIndex ?? 0);
  };

  const handleReveal = async () => {
    if (!session || !currentRound) return;
    const answerByParticipant = new Map(session.currentRoundAnswers.map((a) => [a.participantId, a.answer]));
    const scores = session.participants.map((participant) => {
      const answer = answerByParticipant.get(participant.participantId);
      const isCorrect = currentRound.grade(answer);
      return { participantId: participant.participantId, isCorrect, pointsAwarded: isCorrect ? 1 : 0 };
    });
    const afterScore = await scoreCogitaLiveRevisionRound({
      libraryId,
      sessionId: session.sessionId,
      hostSecret: session.hostSecret,
      scores
    });
    setSession((prev) => mergeHostSecrets(afterScore, prev));
    await pushState({
      status: 'revealed',
      revealVersion: afterScore.revealVersion + 1,
      currentReveal: currentRound.reveal
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

  return (
    <CogitaShell {...props}>
      <section className="cogita-library-dashboard">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid cogita-live-session-layout" data-stage={sessionStage}>
              <div className="cogita-library-panel">
                <p className="cogita-user-kicker">{liveCopy.hostKicker}</p>
                <h2 className="cogita-detail-title">{liveCopy.hostTitle}</h2>
                {status === 'loading' ? <p>{liveCopy.loading}</p> : null}
                {error ? <p className="cogita-help">{error}</p> : null}
                {session ? (
                  <>
                    <div className="cogita-field"><span>{liveCopy.joinCodeLabel}</span><input readOnly value={session.code} /></div>
                    <div className="cogita-field"><span>{liveCopy.joinUrlLabel}</span><input readOnly value={joinUrl} /></div>
                    <div className="cogita-field"><span>Presenter URL</span><input readOnly value={presenterUrl} /></div>
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
                      <button type="button" className="cta ghost" onClick={handleRefreshCode}>Refresh links</button>
                    </div>
                    <p className="cogita-help">{formatLive(liveCopy.roundsLabel, { count: rounds.length })}</p>
                  </>
                ) : null}
              </div>
              <div className="cogita-library-panel">
                <p className="cogita-user-kicker">{liveCopy.currentRoundTitle}</p>
                <h3 className="cogita-detail-title">
                  {publishedPrompt && typeof publishedPrompt.title === 'string'
                    ? publishedPrompt.title
                    : session?.status === 'lobby'
                      ? liveCopy.sessionNotStarted
                      : liveCopy.waitingForPublishedRound}
                </h3>
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
                        waitingForReveal: 'Waiting for reveal.',
                        selectedPaths: 'Selected paths',
                        removePath: 'Remove',
                        columnPrefix: 'Column'
                      }}
                    />
                  </CogitaCheckcardSurface>
                )}
                {sessionStage !== 'lobby' ? (
                  <div className="cogita-form-actions">
                    <button
                      type="button"
                      className="cta"
                      onClick={handleCheckOrNext}
                      disabled={!rounds.length || !currentRound || session.status === 'finished'}
                    >
                      {session.status === 'revealed' ? revisionCopy.nextQuestion : revisionCopy.checkAnswer}
                    </button>
                  </div>
                ) : null}
                {sessionStage !== 'finished' ? (
                  <>
                    <p className="cogita-user-kicker">{liveCopy.participantsTitle}</p>
                    <div className="cogita-share-list">
                      {session?.participants.map((participant) => {
                        const answer = session.currentRoundAnswers.find((a) => a.participantId === participant.participantId);
                        return (
                          <div className="cogita-share-row" key={participant.participantId}>
                            <div>
                              <strong>{participant.displayName}</strong>
                              <div className="cogita-share-meta">
                                {answer ? liveCopy.answerStatusAnswered : liveCopy.answerStatusWaiting}
                                {answer?.isCorrect === true ? ` · ${liveCopy.answerStatusCorrect}` : ''}
                                {answer?.isCorrect === false ? ` · ${liveCopy.answerStatusIncorrect}` : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {session && session.participants.length === 0 ? <p className="cogita-help">{liveCopy.noParticipants}</p> : null}
                    </div>
                    {session && (session.pendingReloginRequests?.length ?? 0) > 0 ? (
                      <>
                        <p className="cogita-user-kicker">Relogin requests</p>
                        <div className="cogita-share-list">
                          {(session.pendingReloginRequests ?? []).map((request) => (
                            <div className="cogita-share-row" key={request.requestId}>
                              <div>
                                <strong>{request.displayName}</strong>
                                <div className="cogita-share-meta">{new Date(request.requestedUtc).toLocaleTimeString()}</div>
                              </div>
                              <button type="button" className="ghost" onClick={() => handleApproveRelogin(request.requestId)}>
                                Allow relogin
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
              {sessionStage !== 'lobby' ? (
                <div className="cogita-library-panel cogita-live-scoreboard-panel">
                  <p className="cogita-user-kicker">{sessionStage === 'finished' ? liveCopy.finalScoreTitle : liveCopy.pointsTitle}</p>
                  <div className="cogita-share-list">
                    {(session?.scoreboard ?? []).map((row) => (
                      <div className="cogita-share-row" key={`score:${row.participantId}`}>
                        <div><strong>{row.displayName}</strong></div>
                        <div className="cogita-share-meta">{row.score} {liveCopy.scoreUnit}</div>
                      </div>
                    ))}
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
