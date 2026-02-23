import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
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
import { buildQuoteFragmentContext, buildQuoteFragmentTree } from '../../../cogita/revision/quote';
import { evaluateAnchorTextAnswer } from '../../../cogita/revision/compare';

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

type QuestionDefinition = Record<string, unknown> & {
  type?: string;
  title?: string;
  question?: string;
  options?: string[];
  columns?: string[][];
  answer?: unknown;
};

const normalizeText = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase();
const uniqSortedInts = (values: unknown[]) => Array.from(new Set(values.map((x) => Number(x)).filter(Number.isFinite))).sort((a, b) => a - b);
const normalizePathSet = (paths: number[][]) => paths.map((p) => p.join(',')).sort().join('|');

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
  definition: QuestionDefinition,
  roundIndex: number
): LiveRound | null {
  const type = typeof definition.type === 'string' ? definition.type : '';
  const title = typeof definition.title === 'string' && definition.title.trim() ? definition.title.trim() : titleFallback;
  const question = typeof definition.question === 'string' ? definition.question : titleFallback;
  if (!type || !question) return null;

  if (type === 'selection') {
    const options = Array.isArray(definition.options) ? definition.options.filter((x): x is string => typeof x === 'string') : [];
    const expected = Array.isArray(definition.answer) ? uniqSortedInts(definition.answer as unknown[]) : [];
    return {
      roundIndex,
      cardKey: `info:${infoId}:question-selection`,
      publicPrompt: { kind: 'selection', title, prompt: question, options, multiple: true, cardLabel: 'question' },
      reveal: { kind: 'selection', expected, title },
      grade: (answer) => {
        const actual = Array.isArray(answer) ? uniqSortedInts(answer) : [];
        return JSON.stringify(actual) === JSON.stringify(expected);
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
    return {
      roundIndex,
      cardKey: `info:${infoId}:question-ordering`,
      publicPrompt: { kind: 'ordering', title, prompt: question, options, cardLabel: 'question' },
      reveal: { kind: 'ordering', expected: options, title },
      grade: (answer) => JSON.stringify(Array.isArray(answer) ? answer.map(String) : []) === JSON.stringify(options)
    };
  }

  if (type === 'matching') {
    const columns = Array.isArray(definition.columns)
      ? definition.columns.map((col) => (Array.isArray(col) ? col.filter((x): x is string => typeof x === 'string') : []))
      : [];
    const answerObj = (definition.answer ?? {}) as Record<string, unknown>;
    const expectedPaths = Array.isArray(answerObj.paths)
      ? answerObj.paths
          .map((row) => (Array.isArray(row) ? row.map((x) => Number(x)).filter(Number.isFinite) : null))
          .filter((row): row is number[] => Array.isArray(row))
      : [];
    return {
      roundIndex,
      cardKey: `info:${infoId}:question-matching`,
      publicPrompt: { kind: 'matching', title, prompt: question, columns, cardLabel: 'question' },
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
          publicPrompt: { kind: 'selection', title: card.label, prompt: 'Select the matching pair', options, multiple: false, cardLabel: card.description ?? undefined },
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
        publicPrompt: { kind: 'text', title: card.label, prompt: `Language of: ${card.label}`, cardLabel: 'word-language' },
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
      const payloadRoot = detail.payload as Record<string, unknown>;
      const def = ((payloadRoot.definition ?? payloadRoot) as Record<string, unknown>) as QuestionDefinition;
      const round = buildQuestionRound(card.cardId, card.label, def, rounds.length);
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
  const sessionStage = session?.status === 'finished' ? 'finished' : session?.status && session.status !== 'lobby' ? 'active' : 'lobby';

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
    buildLiveRounds({ libraryId, revisionId })
      .then((built) => {
        if (canceled) return;
        setRounds(built);
      })
      .catch(() => {
        if (canceled) return;
        setError('Failed to load revision cards for live session.');
        setStatus('error');
      });
    return () => {
      canceled = true;
    };
  }, [libraryId, revisionId]);

  useEffect(() => {
    let canceled = false;
    async function ensureSession() {
      try {
        if (typeof localStorage !== 'undefined') {
          // Starting the host live page always creates a fresh public session code.
          localStorage.removeItem(storageKey);
        }
        const created = await createCogitaLiveRevisionSession({ libraryId, revisionId, title: 'Live revision' });
        if (canceled) return;
        setSession(created);
        localStorage.setItem(
          storageKey,
          JSON.stringify({ sessionId: created.sessionId, hostSecret: created.hostSecret, code: created.code })
        );
        setStatus('ready');
      } catch {
        if (canceled) return;
        setError('Failed to create live session.');
        setStatus('error');
      }
    }
    ensureSession();
    return () => {
      canceled = true;
    };
  }, [libraryId, revisionId, storageKey]);

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
    const updated = await updateCogitaLiveRevisionHostState({
      libraryId,
      sessionId: session.sessionId,
      hostSecret: session.hostSecret,
      status: next.status ?? session.status,
      currentRoundIndex: next.currentRoundIndex ?? session.currentRoundIndex,
      revealVersion: next.revealVersion ?? session.revealVersion,
      currentPrompt: next.currentPrompt ?? session.currentPrompt ?? null,
      currentReveal: next.currentReveal ?? session.currentReveal ?? null
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

  const renderPromptLikeParticipant = (prompt: Record<string, unknown> | null, revealExpected?: unknown) => {
    if (!prompt) {
      return <p className="cogita-help">Waiting for host to publish a question.</p>;
    }
    const kind = String(prompt.kind ?? '');
    const isRevealed = typeof revealExpected !== 'undefined';
    const selectionExpected = Array.isArray(revealExpected)
      ? revealExpected.map((x) => Number(x)).filter(Number.isFinite)
      : [];
    if (kind === 'citation-fragment') {
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>
            <span style={{ opacity: 0.7 }}>{String(prompt.before ?? '')}</span>
            <strong> [ ... ] </strong>
            <span style={{ opacity: 0.7 }}>{String(prompt.after ?? '')}</span>
          </p>
          <label className="cogita-field">
            <span>{isRevealed ? 'Correct fragment' : 'Fragment'}</span>
            <input readOnly value={isRevealed ? String(revealExpected ?? '') : ''} placeholder="Participant answer here" />
          </label>
        </div>
      );
    }
    if (kind === 'text') {
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          <label className="cogita-field">
            <span>{isRevealed ? 'Correct answer' : 'Answer'}</span>
            <input readOnly value={isRevealed ? String(revealExpected ?? '') : ''} placeholder="Participant answer here" />
          </label>
        </div>
      );
    }
    if (kind === 'boolean') {
      const expected = Boolean(revealExpected);
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          <div className="cogita-form-actions">
            <button type="button" className={`cta ghost ${isRevealed && expected ? 'live-correct-answer' : ''}`} disabled>True</button>
            <button type="button" className={`cta ghost ${isRevealed && !expected ? 'live-correct-answer' : ''}`} disabled>False</button>
          </div>
        </div>
      );
    }
    if (kind === 'selection') {
      const options = Array.isArray(prompt.options) ? prompt.options.map(String) : [];
      const multiple = Boolean(prompt.multiple);
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          <div className="cogita-share-list">
            {options.map((option, index) => (
              <label
                className="cogita-share-row"
                data-state={isRevealed && selectionExpected.includes(index) ? 'correct' : undefined}
                key={`${index}-${option}`}
              >
                <span>{option}</span>
                <input type={multiple ? 'checkbox' : 'radio'} disabled checked={isRevealed ? selectionExpected.includes(index) : false} readOnly />
              </label>
            ))}
          </div>
        </div>
      );
    }
    if (kind === 'ordering') {
      const options = Array.isArray((isRevealed ? revealExpected : prompt.options)) ? (isRevealed ? (revealExpected as unknown[]) : (prompt.options as unknown[])).map(String) : [];
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          <div className="cogita-share-list">
            {options.map((option, index) => (
              <div className="cogita-share-row" data-state={isRevealed ? 'correct' : undefined} key={`${index}-${option}`}>
                <span>{option}</span>
                <div className="cogita-form-actions">
                  <button type="button" className="ghost" disabled>↑</button>
                  <button type="button" className="ghost" disabled>↓</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (kind === 'matching') {
      const columns = Array.isArray(prompt.columns) ? (prompt.columns as unknown[][]) : [];
      const revealPaths = (revealExpected as { paths?: number[][] } | undefined)?.paths ?? [];
      return (
        <div className="cogita-live-card-surface" data-state={isRevealed ? 'correct' : 'idle'}>
          <p>{String(prompt.prompt ?? '')}</p>
          {isRevealed ? (
            <div className="cogita-share-list">
              {revealPaths.map((path, pathIndex) => (
                <div key={`path-${pathIndex}`} className="cogita-share-row" data-state="correct">
                  <span>
                    {path.map((selectedIndex, columnIndex) => {
                      const col = Array.isArray(columns[columnIndex]) ? columns[columnIndex] : [];
                      const label = String(col[selectedIndex] ?? selectedIndex);
                      return `${columnIndex > 0 ? ' → ' : ''}${label}`;
                    })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="cogita-form-actions">
              {columns.map((column, columnIndex) => (
                <select key={`host-col-${columnIndex}`} disabled>
                  {(Array.isArray(column) ? column : []).map((option, optionIndex) => (
                    <option key={`${columnIndex}-${optionIndex}`}>{String(option)}</option>
                  ))}
                </select>
              ))}
            </div>
          )}
        </div>
      );
    }
    return <pre className="cogita-json-preview">{JSON.stringify(prompt, null, 2)}</pre>;
  };

  return (
    <CogitaShell {...props}>
      <section className="cogita-library-dashboard">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid cogita-live-session-layout" data-stage={sessionStage}>
              <div className="cogita-library-panel">
                <p className="cogita-user-kicker">Live Revision Host</p>
                <h2 className="cogita-detail-title">Host session</h2>
                {status === 'loading' ? <p>Loading…</p> : null}
                {error ? <p className="cogita-help">{error}</p> : null}
                {session ? (
                  <>
                    <div className="cogita-field"><span>Join code</span><input readOnly value={session.code} /></div>
                    <div className="cogita-field"><span>Join URL</span><input readOnly value={joinUrl} /></div>
                    {joinUrl ? (
                      <div className="cogita-field">
                        <span>QR</span>
                        <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: '12px', background: '#fff' }}>
                          <QRCodeSVG value={joinUrl} size={176} marginSize={2} />
                        </div>
                      </div>
                    ) : null}
                    <div className="cogita-field"><span>Status</span><input readOnly value={session.status} /></div>
                    <div className="cogita-form-actions">
                      <button type="button" className="cta" onClick={handleStart} disabled={!rounds.length}>Publish current round</button>
                      <button
                        type="button"
                        className="cta ghost"
                        onClick={handleCheckOrNext}
                        disabled={!rounds.length || !currentRound || session.status === 'finished'}
                      >
                        {session.status === 'revealed' ? 'Next question' : 'Check answer'}
                      </button>
                    </div>
                    <p className="cogita-help">Rounds: {rounds.length}</p>
                  </>
                ) : null}
              </div>
              <div className="cogita-library-panel">
                <p className="cogita-user-kicker">Current round</p>
                <h3 className="cogita-detail-title">
                  {publishedPrompt && typeof publishedPrompt.title === 'string'
                    ? publishedPrompt.title
                    : session?.status === 'lobby'
                      ? 'Session not started'
                      : 'Waiting for published round'}
                </h3>
                {session?.status === 'lobby' ? (
                  <p className="cogita-help">No question is shown before the host starts the session.</p>
                ) : (
                  renderPromptLikeParticipant(publishedPrompt, publishedReveal?.expected)
                )}
                {sessionStage !== 'finished' ? (
                  <>
                    <p className="cogita-user-kicker">Participants</p>
                    <div className="cogita-share-list">
                      {session?.participants.map((participant) => {
                        const answer = session.currentRoundAnswers.find((a) => a.participantId === participant.participantId);
                        return (
                          <div className="cogita-share-row" key={participant.participantId}>
                            <div>
                              <strong>{participant.displayName}</strong>
                              <div className="cogita-share-meta">
                                {answer ? 'answered' : 'waiting'}
                                {answer?.isCorrect === true ? ' · correct' : ''}
                                {answer?.isCorrect === false ? ' · incorrect' : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {session && session.participants.length === 0 ? <p className="cogita-help">No participants yet.</p> : null}
                    </div>
                  </>
                ) : null}
              </div>
              {sessionStage !== 'lobby' ? (
                <div className="cogita-library-panel cogita-live-scoreboard-panel">
                  <p className="cogita-user-kicker">{sessionStage === 'finished' ? 'Final score' : 'Points'}</p>
                  <div className="cogita-share-list">
                    {(session?.scoreboard ?? []).map((row) => (
                      <div className="cogita-share-row" key={`score:${row.participantId}`}>
                        <div><strong>{row.displayName}</strong></div>
                        <div className="cogita-share-meta">{row.score} pt</div>
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
