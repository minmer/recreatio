import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  createCogitaReviewEvent,
  getCogitaCollection,
  getCogitaCollectionCards,
  getCogitaComputedSample,
  getCogitaInfoDetail,
  getCogitaReviewSummary,
  searchCogitaInfos,
  type CogitaCardSearchResult,
  type CogitaComputedSample,
  type CogitaInfoSearchResult
} from '../../../../lib/api';
import { toBase64 } from '../../../../lib/crypto';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import type { CogitaInfoType } from '../types';
import { getInfoTypeLabel } from '../libraryOptions';
import { CogitaLibrarySidebar } from '../components/CogitaLibrarySidebar';
import { buildComputedSampleFromGraph, toComputedSample } from '../utils/computedGraph';
import type { ComputedGraphDefinition } from '../components/ComputedGraphEditor';
import { CogitaRevisionCard } from './components/CogitaRevisionCard';

const normalizeAnswer = (value: string) => value.trim().toLowerCase();
const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
  i: 'ⁱ'
};
const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  a: 'ₐ',
  e: 'ₑ',
  h: 'ₕ',
  i: 'ᵢ',
  j: 'ⱼ',
  k: 'ₖ',
  l: 'ₗ',
  m: 'ₘ',
  n: 'ₙ',
  o: 'ₒ',
  p: 'ₚ',
  r: 'ᵣ',
  s: 'ₛ',
  t: 'ₜ',
  u: 'ᵤ',
  v: 'ᵥ',
  x: 'ₓ'
};

const applyScriptMode = (prev: string, next: string, mode: 'super' | 'sub' | null) => {
  if (!mode) return next;
  if (!next.startsWith(prev)) return next;
  const added = next.slice(prev.length);
  if (!added) return next;
  const map = mode === 'super' ? SUPERSCRIPT_MAP : SUBSCRIPT_MAP;
  const transformed = added
    .split('')
    .map((char) => map[char] ?? char)
    .join('');
  return prev + transformed;
};

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const getFirstComputedInputKey = (
  template: string | null,
  expected: Array<{ key: string; expected: string }>,
  outputVariables: Record<string, string> | null
) => {
  if (!template) return expected[0]?.key ?? null;
  const expectedKeys = new Set(expected.map((entry) => entry.key));
  const pattern = /\{([^}]+)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(template)) !== null) {
    const token = match[1]?.trim() ?? '';
    if (!token) continue;
    if (expectedKeys.has(token)) return token;
    const resolved = outputVariables?.[token];
    if (resolved && expectedKeys.has(resolved)) return resolved;
  }
  return expected[0]?.key ?? null;
};

export function CogitaRevisionRunPage({
  copy,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange,
  libraryId,
  collectionId
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
  collectionId: string;
}) {
  const location = useLocation();
  const baseHref = `/#/cogita/library/${libraryId}`;
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const limit = Math.max(1, Number(params.get('limit') ?? 20));
  const mode = params.get('mode') ?? 'random';
  const check = params.get('check') ?? 'exact';
  const reviewer = params.get('reviewer');
  const modeLabel = useMemo(() => (mode === 'random' ? copy.cogita.library.revision.modeValue : mode), [copy, mode]);
  const checkLabel = useMemo(() => (check === 'exact' ? copy.cogita.library.revision.checkValue : check), [copy, check]);

  const [collectionName, setCollectionName] = useState(copy.cogita.library.collections.defaultName);
  const [queue, setQueue] = useState<CogitaCardSearchResult[]>([]);
  const [languages, setLanguages] = useState<CogitaInfoSearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [expectedAnswer, setExpectedAnswer] = useState<string | null>(null);
  const [computedExpected, setComputedExpected] = useState<Array<{ key: string; expected: string }>>([]);
  const [computedAnswers, setComputedAnswers] = useState<Record<string, string>>({});
  const [computedFieldFeedback, setComputedFieldFeedback] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const [computedValues, setComputedValues] = useState<Record<string, number | string> | null>(null);
  const [computedAnswerTemplate, setComputedAnswerTemplate] = useState<string | null>(null);
  const [computedOutputVariables, setComputedOutputVariables] = useState<Record<string, string> | null>(null);
  const [computedVariableValues, setComputedVariableValues] = useState<Record<string, string> | null>(null);
  const [scriptMode, setScriptMode] = useState<'super' | 'sub' | null>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<{ score: number; total: number; correct: number; lastReviewedUtc?: string | null } | null>(null);
  const answerInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const computedInputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const [canAdvance, setCanAdvance] = useState(false);

  const currentCard = queue[currentIndex] ?? null;
  const computedSampleCache = useRef(new Map<string, { sample: CogitaComputedSample; answerTemplate: string | null }>());
  const computedSamplePromises = useRef(new Map<string, Promise<{ sample: CogitaComputedSample | null; answerTemplate: string | null }>>());
  const resolvedCardCache = useRef(new Map<string, {
    prompt: string | null;
    expectedAnswer: string | null;
    computedExpected: Array<{ key: string; expected: string }>;
    computedAnswers: Record<string, string>;
    computedValues: Record<string, number | string> | null;
    answerTemplate: string | null;
    outputVariables: Record<string, string> | null;
    variableValues: Record<string, string> | null;
  }>());
  const resolvedCardPromises = useRef(new Map<string, Promise<{
    prompt: string | null;
    expectedAnswer: string | null;
    computedExpected: Array<{ key: string; expected: string }>;
    computedAnswers: Record<string, string>;
    computedValues: Record<string, number | string> | null;
    answerTemplate: string | null;
    outputVariables: Record<string, string> | null;
    variableValues: Record<string, string> | null;
  } | null>>());
  const currentTypeLabel = useMemo(() => {
    if (!currentCard) return '';
    if (currentCard.cardType === 'vocab') return copy.cogita.library.revision.vocabLabel;
    if (currentCard.infoType) return getInfoTypeLabel(copy, currentCard.infoType as CogitaInfoType);
    return copy.cogita.library.revision.infoLabel;
  }, [copy, currentCard]);

  useEffect(() => {
    getCogitaCollection(libraryId, collectionId)
      .then((detail) => setCollectionName(detail.name))
      .catch(() => setCollectionName(copy.cogita.library.collections.defaultName));
  }, [libraryId, collectionId]);

  useEffect(() => {
    searchCogitaInfos({ libraryId, type: 'language' })
      .then((results) => setLanguages(results))
      .catch(() => setLanguages([]));
  }, [libraryId]);

  useEffect(() => {
    let mounted = true;
    const fetchCards = async () => {
      setStatus('loading');
      try {
        const gathered: CogitaCardSearchResult[] = [];
        let cursor: string | null | undefined = null;
        do {
          const bundle = await getCogitaCollectionCards({
            libraryId,
            collectionId,
            limit: 100,
            cursor
          });
          gathered.push(...bundle.items);
          cursor = bundle.nextCursor ?? null;
          if (gathered.length >= limit) break;
        } while (cursor);

        if (!mounted) return;
        const ordered = mode === 'random' ? shuffle(gathered) : gathered;
        let expanded: CogitaCardSearchResult[] = [];
        if (ordered.length > 0) {
          while (expanded.length < limit) {
            const nextBatch = mode === 'random' ? shuffle(ordered) : ordered;
            let added = false;
            for (const candidate of nextBatch) {
              if (expanded.length >= limit) break;
              const last = expanded[expanded.length - 1];
              if (last && candidate.cardId === last.cardId && ordered.length > 1) {
                continue;
              }
              expanded.push(candidate);
              added = true;
            }
            if (!added) {
              const fallback = nextBatch[0];
              if (!fallback) break;
              expanded.push(fallback);
            }
          }
        }
        setQueue(expanded);
        setCurrentIndex(0);
        setStatus('ready');
      } catch {
        if (mounted) setStatus('error');
      }
    };

    fetchCards();
    return () => {
      mounted = false;
    };
  }, [libraryId, collectionId, limit, mode]);

  useEffect(() => {
    setAnswer('');
    setFeedback(null);
    setComputedExpected([]);
    setComputedAnswers({});
    setComputedFieldFeedback({});
    setComputedAnswerTemplate(null);
    setComputedOutputVariables(null);
    setComputedVariableValues(null);
    setShowCorrectAnswer(false);
    setCanAdvance(false);
    setScriptMode(null);
    if (!currentCard) {
      setPrompt(null);
      setExpectedAnswer(null);
      setComputedValues(null);
      setReviewSummary(null);
      return;
    }
    if (currentCard.cardType === 'info' && currentCard.infoType === 'computed') {
      setPrompt(copy.cogita.library.revision.loadingComputed);
    }

    let mounted = true;
    resolveCard(currentCard, currentIndex).then((resolved) => {
      if (!mounted || !resolved) return;
      setPrompt(resolved.prompt);
      setExpectedAnswer(resolved.expectedAnswer);
      setComputedExpected(resolved.computedExpected);
      setComputedAnswers(resolved.computedAnswers);
      setComputedValues(resolved.computedValues);
      setComputedAnswerTemplate(resolved.answerTemplate);
      setComputedOutputVariables(resolved.outputVariables);
      setComputedVariableValues(resolved.variableValues);
    });
    return () => {
      mounted = false;
    };
  }, [currentCard, copy]);


  const lastFocusCardRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentCard) return;
    if (lastFocusCardRef.current === currentCard.cardId) return;
    lastFocusCardRef.current = currentCard.cardId;
    const focusInput = () => {
      if (currentCard.cardType === 'info' && currentCard.infoType === 'computed') {
        if (computedExpected.length > 0) {
          const firstKey = getFirstComputedInputKey(
            computedAnswerTemplate,
            computedExpected,
            computedOutputVariables
          );
          if (firstKey && computedInputRefs.current[firstKey]) {
            computedInputRefs.current[firstKey]?.focus();
            return;
          }
        }
        answerInputRef.current?.focus();
        return;
      }
      if (currentCard.cardType === 'vocab') {
        answerInputRef.current?.focus();
      }
    };
    const handle = window.setTimeout(focusInput, 40);
    return () => window.clearTimeout(handle);
  }, [currentCard, computedExpected]);

  useEffect(() => {
    if (!canAdvance) return;
    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      advanceCard();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canAdvance]);

  useEffect(() => {
    if (!currentCard) {
      setReviewSummary(null);
      return;
    }
    getCogitaReviewSummary({
      libraryId,
      itemType: currentCard.cardType === 'info' ? 'info' : 'connection',
      itemId: currentCard.cardId,
      personRoleId: reviewer
    })
      .then((summary) => {
        setReviewSummary({
          score: summary.score,
          total: summary.totalReviews,
          correct: summary.correctReviews,
          lastReviewedUtc: summary.lastReviewedUtc ?? null
        });
      })
      .catch(() => setReviewSummary(null));
  }, [libraryId, currentCard, reviewer]);

  const advanceCard = () => {
    setFeedback(null);
    setAnswer('');
    setShowCorrectAnswer(false);
    setComputedFieldFeedback({});
    setCanAdvance(false);
    setCurrentIndex((prev) => Math.min(prev + 1, queue.length));
  };

  const buildMask = (expected: string, answerValue: string) => {
    const expectedChars = expected.split('');
    const answerChars = answerValue.split('');
    const buffer = new Uint8Array(expectedChars.length);
    expectedChars.forEach((char, index) => {
      const match = answerChars[index] ?? '';
      buffer[index] = char.toLowerCase() === match.toLowerCase() ? 1 : 0;
    });
    return buffer;
  };

  const submitReview = (options: {
    correct: boolean;
    direction: string | null;
    expected?: string | null;
    answer?: string;
    expectedMap?: Record<string, string>;
    answerMap?: Record<string, string>;
  }) => {
    if (!currentCard) return;
    const expectedValue = options.expected ?? null;
    const answerValue = options.answer ?? '';
    let maskValue = expectedValue ?? '';
    let maskAnswer = answerValue;
    if (!expectedValue && options.expectedMap && options.answerMap) {
      const keys = Object.keys(options.expectedMap).sort((a, b) => a.localeCompare(b));
      maskValue = keys.map((key) => options.expectedMap?.[key] ?? '').join('|');
      maskAnswer = keys.map((key) => options.answerMap?.[key] ?? '').join('|');
    }
    const mask = maskValue ? buildMask(maskValue, maskAnswer) : new Uint8Array();
    const payload = {
      direction: options.direction,
      prompt: prompt ?? '',
      expected: expectedValue,
      answer: answerValue,
      expectedAnswers: options.expectedMap ?? null,
      answers: options.answerMap ?? null,
      correct: options.correct,
      maskBase64: mask.length ? toBase64(mask) : null,
      values: computedValues ?? null
    };
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    void createCogitaReviewEvent({
      libraryId,
      itemType: currentCard.cardType === 'info' ? 'info' : 'connection',
      itemId: currentCard.cardId,
      direction: options.direction,
      payloadBase64: toBase64(payloadBytes),
      personRoleId: reviewer
    });
  };

  const fetchComputedSample = (
    infoId: string,
    cacheKey: string
  ): Promise<{ sample: CogitaComputedSample | null; answerTemplate: string | null }> => {
    const cached = computedSampleCache.current.get(cacheKey);
    if (cached) return Promise.resolve(cached);
    const existing = computedSamplePromises.current.get(cacheKey);
    if (existing) return existing;
    const promise = getCogitaInfoDetail({ libraryId, infoId })
      .then((detail) => {
        const payload = detail.payload as {
          definition?: { promptTemplate?: string; answerTemplate?: string; graph?: ComputedGraphDefinition | null };
        };
        const graph = payload.definition?.graph ?? null;
        const promptTemplate = payload.definition?.promptTemplate ?? '';
        const answerTemplate = payload.definition?.answerTemplate ?? '';
        const computed = buildComputedSampleFromGraph(graph, promptTemplate, answerTemplate);
        if (computed) {
          const sample = toComputedSample(computed);
          const result = { sample, answerTemplate: answerTemplate || null };
          computedSampleCache.current.set(cacheKey, result);
          return result;
        }
        return getCogitaComputedSample({ libraryId, infoId }).then((sample) => {
          const result = { sample, answerTemplate: null };
          computedSampleCache.current.set(cacheKey, result);
          return result;
        });
      })
      .catch(() =>
        getCogitaComputedSample({ libraryId, infoId })
          .then((sample) => {
            const result = { sample, answerTemplate: null };
            computedSampleCache.current.set(cacheKey, result);
            return result;
          })
          .catch(() => ({ sample: null, answerTemplate: null }))
      )
      .finally(() => {
        computedSamplePromises.current.delete(cacheKey);
      });
    computedSamplePromises.current.set(cacheKey, promise);
    return promise;
  };

  const resolveCard = (card: CogitaCardSearchResult, index: number): Promise<{
    prompt: string | null;
    expectedAnswer: string | null;
    computedExpected: Array<{ key: string; expected: string }>;
    computedAnswers: Record<string, string>;
    computedValues: Record<string, number | string> | null;
    answerTemplate: string | null;
    outputVariables: Record<string, string> | null;
    variableValues: Record<string, string> | null;
  } | null> => {
    const cacheKey = `${card.cardId}:${index}`;
    const cached = resolvedCardCache.current.get(cacheKey);
    if (cached) return Promise.resolve(cached);
    const existing = resolvedCardPromises.current.get(cacheKey);
    if (existing) return existing;

    const finalize = (resolved: {
      prompt: string | null;
      expectedAnswer: string | null;
      computedExpected: Array<{ key: string; expected: string }>;
      computedAnswers: Record<string, string>;
      computedValues: Record<string, number | string> | null;
      answerTemplate: string | null;
      outputVariables: Record<string, string> | null;
      variableValues: Record<string, string> | null;
    }) => {
      resolvedCardCache.current.set(cacheKey, resolved);
      return resolved;
    };

    let promise: Promise<{
      prompt: string | null;
      expectedAnswer: string | null;
      computedExpected: Array<{ key: string; expected: string }>;
      computedAnswers: Record<string, string>;
      computedValues: Record<string, number | string> | null;
      answerTemplate: string | null;
      outputVariables: Record<string, string> | null;
      variableValues: Record<string, string> | null;
    } | null>;

    if (card.cardType === 'vocab') {
      const parts = card.label.split('↔').map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const pickFirst = Math.random() >= 0.5;
        const promptValue = pickFirst ? parts[0] : parts[1];
        const expected = pickFirst ? parts[1] : parts[0];
        promise = Promise.resolve(
          finalize({
            prompt: promptValue,
            expectedAnswer: expected,
            computedExpected: [],
            computedAnswers: {},
            computedValues: null,
            answerTemplate: null,
            outputVariables: null,
            variableValues: null
          })
        );
      } else {
        promise = Promise.resolve(
          finalize({
            prompt: card.label,
            expectedAnswer: null,
            computedExpected: [],
            computedAnswers: {},
            computedValues: null,
            answerTemplate: null,
            outputVariables: null,
            variableValues: null
          })
        );
      }
    } else if (card.cardType === 'info' && card.infoType === 'word') {
      const match = card.description?.startsWith('Language: ')
        ? card.description.replace('Language: ', '')
        : null;
      promise = Promise.resolve(
        finalize({
          prompt: card.label,
          expectedAnswer: match,
          computedExpected: [],
          computedAnswers: {},
          computedValues: null,
          answerTemplate: null,
          outputVariables: null,
          variableValues: null
        })
      );
    } else if (card.cardType === 'info' && card.infoType === 'computed') {
      promise = fetchComputedSample(card.cardId, cacheKey)
        .then((result) => {
          if (!result.sample) {
            return finalize({
              prompt: card.label,
              expectedAnswer: null,
              computedExpected: [],
              computedAnswers: {},
              computedValues: null,
              answerTemplate: null,
              outputVariables: null,
              variableValues: null
            });
          }
          const sample = result.sample;
          const expectedEntries = sample.expectedAnswers
            ? Object.entries(sample.expectedAnswers).map(([key, value]) => ({ key, expected: value }))
            : [];
          const computedAnswers = expectedEntries.reduce<Record<string, string>>((acc, entry) => {
            acc[entry.key] = '';
            return acc;
          }, {});
          const sentenceExpected = sample.expectedAnswerIsSentence
            ? sample.expectedAnswer?.trim() || null
            : null;
          return finalize({
            prompt: sample.prompt,
            expectedAnswer: expectedEntries.length > 0 ? sentenceExpected : sample.expectedAnswer?.trim() || null,
            computedExpected: expectedEntries,
            computedAnswers,
            computedValues: sample.values ?? null,
            answerTemplate: result.answerTemplate,
            outputVariables: sample.outputVariables ?? null,
            variableValues: sample.variableValues ?? null
          });
        })
        .catch(() =>
          finalize({
            prompt: card.label,
            expectedAnswer: null,
            computedExpected: [],
            computedAnswers: {},
            computedValues: null,
            answerTemplate: null,
            outputVariables: null,
            variableValues: null
          })
        )
        .finally(() => {
          resolvedCardPromises.current.delete(cacheKey);
        });
    } else {
      promise = Promise.resolve(
        finalize({
          prompt: card.label,
          expectedAnswer: null,
          computedExpected: [],
          computedAnswers: {},
          computedValues: null,
          answerTemplate: null,
          outputVariables: null,
          variableValues: null
        })
      );
    }

    resolvedCardPromises.current.set(cacheKey, promise);
    return promise;
  };

  const preloadNextCard = () => {
    const next = queue[currentIndex + 1];
    if (!next) return;
    void resolveCard(next, currentIndex + 1);
  };

  const handleCheckAnswer = () => {
    preloadNextCard();
    if (computedExpected.length > 0) {
      const fieldFeedback = computedExpected.reduce<Record<string, 'correct' | 'incorrect'>>((acc, entry) => {
        const actual = computedAnswers[entry.key] ?? '';
        acc[entry.key] = normalizeAnswer(actual) === normalizeAnswer(entry.expected) ? 'correct' : 'incorrect';
        return acc;
      }, {});
      const allCorrect = computedExpected.every(({ key, expected }) => {
        const actual = computedAnswers[key] ?? '';
        return check === 'exact' && normalizeAnswer(actual) === normalizeAnswer(expected);
      });
      if (allCorrect) {
        setFeedback('correct');
        setComputedFieldFeedback(fieldFeedback);
        setCanAdvance(true);
        submitReview({
          correct: true,
          direction: prompt ? `${prompt} -> computed` : 'computed',
          expectedMap: computedExpected.reduce<Record<string, string>>((acc, entry) => {
            acc[entry.key] = entry.expected;
            return acc;
          }, {}),
          answerMap: computedAnswers
        });
      } else {
        setFeedback('incorrect');
        setComputedFieldFeedback(fieldFeedback);
        setCanAdvance(false);
        window.setTimeout(() => {
          const first = getFirstComputedInputKey(
            computedAnswerTemplate,
            computedExpected,
            computedOutputVariables
          );
          if (first && computedInputRefs.current[first]) {
            computedInputRefs.current[first]?.focus();
          }
        }, 40);
        submitReview({
          correct: false,
          direction: prompt ? `${prompt} -> computed` : 'computed',
          expectedMap: computedExpected.reduce<Record<string, string>>((acc, entry) => {
            acc[entry.key] = entry.expected;
            return acc;
          }, {}),
          answerMap: computedAnswers
        });
      }
      return;
    }
    if (!expectedAnswer) return;
    const isCorrect = check === 'exact' && normalizeAnswer(answer) === normalizeAnswer(expectedAnswer);
    if (isCorrect) {
      setFeedback('correct');
      setComputedFieldFeedback({});
      setCanAdvance(true);
      submitReview({
        correct: true,
        direction: prompt ? `${prompt} -> ${expectedAnswer}` : null,
        expected: expectedAnswer,
        answer
      });
    } else {
      setFeedback('incorrect');
      setComputedFieldFeedback({});
      setCanAdvance(false);
      window.setTimeout(() => answerInputRef.current?.focus(), 40);
      submitReview({
        correct: false,
        direction: prompt ? `${prompt} -> ${expectedAnswer}` : null,
        expected: expectedAnswer,
        answer
      });
    }
  };

  const handleLanguageSelect = (label: string) => {
    preloadNextCard();
    if (!expectedAnswer) return;
    const isCorrect = normalizeAnswer(label) === normalizeAnswer(expectedAnswer);
    if (isCorrect) {
      setFeedback('correct');
      setComputedFieldFeedback({});
      setCanAdvance(true);
      submitReview({ correct: true, direction: `word->language`, expected: expectedAnswer, answer: label });
    } else {
      setFeedback('incorrect');
      setComputedFieldFeedback({});
      setCanAdvance(false);
      submitReview({ correct: false, direction: `word->language`, expected: expectedAnswer, answer: label });
    }
  };

  const handleMarkReviewed = () => {
    preloadNextCard();
    setFeedback('correct');
    setCanAdvance(true);
    if (expectedAnswer) {
      submitReview({ correct: true, direction: 'manual', expected: expectedAnswer, answer });
    }
  };

  useEffect(() => {
    preloadNextCard();
  }, [currentIndex, queue]);

  const handleComputedKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    if (canAdvance) {
      advanceCard();
      return;
    }
    const emptyEntry = computedExpected.find((entry) => !(computedAnswers[entry.key] ?? '').trim());
    if (emptyEntry) {
      computedInputRefs.current[emptyEntry.key]?.focus();
      return;
    }
    handleCheckAnswer();
  };

  const revealPolicy = copy.cogita.library.revision.revealModeAfterIncorrect;
  const hasExpectedAnswer = computedExpected.length > 0 || !!expectedAnswer;

  return (
    <CogitaShell
      copy={copy}
      authLabel={authLabel}
      showProfileMenu={showProfileMenu}
      onProfileNavigate={onProfileNavigate}
      onToggleSecureMode={onToggleSecureMode}
      onLogout={onLogout}
      secureMode={secureMode}
      onNavigate={onNavigate}
      language={language}
      onLanguageChange={onLanguageChange}
    >
      <section className="cogita-library-dashboard cogita-revision-run" data-mode="detail">
        <header className="cogita-library-dashboard-header">
          <div>
            <p className="cogita-user-kicker">{copy.cogita.library.revision.runKicker}</p>
            <h1 className="cogita-library-title">{collectionName}</h1>
            <p className="cogita-library-subtitle">
              {copy.cogita.library.revision.modeSummary.replace('{mode}', modeLabel).replace('{check}', checkLabel)}
            </p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href="/#/cogita">
              {copy.cogita.library.actions.backToCogita}
            </a>
            <a className="cta ghost" href={baseHref}>
              {copy.cogita.library.actions.libraryOverview}
            </a>
            <a className="cta ghost" href={`${baseHref}/collections`}>
              {copy.cogita.library.actions.collections}
            </a>
            <a className="cta ghost" href={`${baseHref}/collections/${collectionId}`}>
              {copy.cogita.library.actions.collectionDetail}
            </a>
          </div>
        </header>

        <div className="cogita-library-layout">
          <CogitaLibrarySidebar libraryId={libraryId} collectionId={collectionId} labels={copy.cogita.library.sidebar} />
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane cogita-revision-stats">
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.library.revision.progressTitle}</p>
                      <h3 className="cogita-detail-title">
                        {queue.length ? `${Math.min(currentIndex + 1, queue.length)} / ${queue.length}` : '0 / 0'}
                      </h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    {status === 'loading' && <p>{copy.cogita.library.revision.loading}</p>}
                    {status === 'error' && <p>{copy.cogita.library.revision.error}</p>}
                    {status === 'ready' && queue.length === 0 && <p>{copy.cogita.library.revision.empty}</p>}
                    <p>
                      <strong>{copy.cogita.library.revision.revealModeLabel}</strong> {revealPolicy}
                    </p>
                  </div>
                </section>
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.library.revision.knownessTitle}</p>
                      <h3 className="cogita-detail-title">
                        {reviewSummary ? `${reviewSummary.score.toFixed(1)} / 100` : copy.cogita.library.revision.knownessEmpty}
                      </h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    {reviewSummary ? (
                      <>
                        <p>
                          {copy.cogita.library.revision.knownessStats
                            .replace('{correct}', String(reviewSummary.correct))
                            .replace('{total}', String(reviewSummary.total))}
                        </p>
                        {reviewSummary.lastReviewedUtc && (
                          <p>
                            {copy.cogita.library.revision.knownessLast.replace(
                              '{date}',
                              new Date(reviewSummary.lastReviewedUtc).toLocaleString()
                            )}
                          </p>
                        )}
                      </>
                    ) : (
                      <p>{copy.cogita.library.revision.knownessHint}</p>
                    )}
                  </div>
                </section>
              </div>

              <div className="cogita-library-panel">
            <section className="cogita-revision-card" data-feedback={feedback ?? 'idle'}>
              {currentCard ? (
                <>
                  <CogitaRevisionCard
                    copy={copy}
                    currentCard={currentCard}
                    currentTypeLabel={currentTypeLabel}
                    prompt={prompt}
                    languages={languages}
                    answer={answer}
                    onAnswerChange={(value) => setAnswer((prev) => applyScriptMode(prev, value, scriptMode))}
                    computedExpected={computedExpected}
                    computedAnswers={computedAnswers}
                    onComputedAnswerChange={(key, value) =>
                      setComputedAnswers((prev) => ({
                        ...prev,
                        [key]: applyScriptMode(prev[key] ?? '', value, scriptMode)
                      }))
                    }
                    answerTemplate={computedAnswerTemplate}
                    outputVariables={computedOutputVariables}
                    variableValues={computedVariableValues}
                    computedFieldFeedback={computedFieldFeedback}
                    feedback={feedback}
                    canAdvance={canAdvance}
                    onCheckAnswer={handleCheckAnswer}
                    onSkip={advanceCard}
                    onLanguageSelect={handleLanguageSelect}
                    onMarkReviewed={handleMarkReviewed}
                    onAdvance={advanceCard}
                    showCorrectAnswer={showCorrectAnswer}
                    setShowCorrectAnswer={setShowCorrectAnswer}
                    onRevealCorrect={() => setCanAdvance(true)}
                    expectedAnswer={expectedAnswer}
                    hasExpectedAnswer={hasExpectedAnswer}
                    handleComputedKeyDown={handleComputedKeyDown}
                    answerInputRef={answerInputRef}
                    computedInputRefs={computedInputRefs}
                    scriptMode={scriptMode}
                    setScriptMode={setScriptMode}
                  />
                </>
              ) : (
                <div className="cogita-card-empty">
                  <p>{copy.cogita.library.revision.completed}</p>
                  <div className="cogita-form-actions">
                    <a className="cta" href={`${baseHref}/collections/${collectionId}`}>
                      {copy.cogita.library.actions.collectionDetail}
                    </a>
                  </div>
                </div>
              )}
            </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
