import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getCogitaPublicComputedSample,
  getCogitaPublicInfoDetail,
  getCogitaPublicRevisionCards,
  getCogitaPublicRevisionInfos,
  getCogitaPublicRevisionShare,
  type CogitaCardSearchResult,
  type CogitaComputedSample,
  type CogitaInfoSearchResult,
  type CogitaPublicRevisionShare
} from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import type { CogitaInfoType } from '../types';
import { getInfoTypeLabel } from '../libraryOptions';
import { CogitaRevisionCard } from './components/CogitaRevisionCard';
import { buildComputedSampleFromGraph, toComputedSample } from '../utils/computedGraph';
import type { ComputedGraphDefinition } from '../components/ComputedGraphEditor';
import { toBase64 } from '../../../../lib/crypto';
import { computeKnowness } from '../../../../cogita/revision/knowness';
import { getOutcomesForItem, recordOutcome } from '../../../../cogita/revision/outcomes';
import {
  getRevisionType,
  normalizeRevisionSettings,
  parseRevisionSettingsFromParams,
  prepareLevelsState
} from '../../../../cogita/revision/registry';
import { compareStrings, type CompareAlgorithmId } from '../../../../cogita/revision/compare';

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

export function CogitaRevisionShareRunPage({
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
  shareId
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
  shareId: string;
}) {
  const [shareInfo, setShareInfo] = useState<CogitaPublicRevisionShare | null>(null);
  const [shareStatus, setShareStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [collectionName, setCollectionName] = useState(copy.cogita.library.collections.defaultName);
  const [libraryName, setLibraryName] = useState('Cogita Library');
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
  const [computedAnswerTemplate, setComputedAnswerTemplate] = useState<string | null>(null);
  const [computedOutputVariables, setComputedOutputVariables] = useState<Record<string, string> | null>(null);
  const [computedVariableValues, setComputedVariableValues] = useState<Record<string, string> | null>(null);
  const [scriptMode, setScriptMode] = useState<'super' | 'sub' | null>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<{ score: number; total: number; correct: number; lastReviewedUtc?: string | null } | null>(null);
  const [answerMask, setAnswerMask] = useState<Uint8Array | null>(null);
  const [attempts, setAttempts] = useState(0);
  const answerInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const computedInputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const [canAdvance, setCanAdvance] = useState(false);
  const [revisionMeta, setRevisionMeta] = useState<Record<string, unknown>>({});

  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const shareKey = useMemo(() => params.get('key') ?? '', [params]);
  const mode = shareInfo?.mode ?? 'random';
  const check = shareInfo?.check ?? 'exact';
  const limit = shareInfo?.limit ?? 20;
  const revisionType = useMemo(() => getRevisionType(shareInfo?.revisionType ?? mode), [shareInfo, mode]);
  const revisionSettings = useMemo(() => {
    const shareSettings = shareInfo?.revisionSettings as Record<string, number> | null | undefined;
    const paramSettings = parseRevisionSettingsFromParams(revisionType, params);
    return normalizeRevisionSettings(revisionType, shareSettings ?? paramSettings);
  }, [shareInfo, params, revisionType]);
  const modeLabel = useMemo(
    () => copy.cogita.library.revision[revisionType.labelKey] ?? mode,
    [copy, mode, revisionType]
  );
  const checkLabel = useMemo(() => (check === 'exact' ? copy.cogita.library.revision.checkValue : check), [copy, check]);

  const canRenderCards = shareStatus === 'ready';
  const currentCard = canRenderCards ? queue[currentIndex] ?? null : null;
  const computedSampleCache = useRef(new Map<string, { sample: CogitaComputedSample; answerTemplate: string | null }>());
  const computedSamplePromises = useRef(new Map<string, Promise<{ sample: CogitaComputedSample | null; answerTemplate: string | null }>>());
  const resolvedCardCache = useRef(new Map<string, {
    prompt: string | null;
    expectedAnswer: string | null;
    computedExpected: Array<{ key: string; expected: string }>;
    computedAnswers: Record<string, string>;
    answerTemplate: string | null;
    outputVariables: Record<string, string> | null;
    variableValues: Record<string, string> | null;
  }>());
  const resolvedCardPromises = useRef(new Map<string, Promise<{
    prompt: string | null;
    expectedAnswer: string | null;
    computedExpected: Array<{ key: string; expected: string }>;
    computedAnswers: Record<string, string>;
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
  const poolCount = useMemo(() => {
    if (revisionType.id !== 'levels') return queue.length;
    const meta = revisionMeta as { pool?: CogitaCardSearchResult[] };
    return meta.pool?.length ?? revisionType.getFetchLimit(limit, revisionSettings);
  }, [revisionMeta, revisionSettings, revisionType, queue.length, limit]);
  const progressTotal = revisionType.id === 'levels' ? Math.min(limit, poolCount) : queue.length;
  const progressCurrent = progressTotal ? Math.min(currentIndex + 1, progressTotal) : 0;
  const maxTries = Math.max(1, Number(revisionSettings.tries ?? 1));
  const compareMode = (revisionSettings.compare as CompareAlgorithmId | undefined) ?? 'bidirectional';
  const minCorrectness = Math.max(0, Math.min(100, Number(revisionSettings.minCorrectness ?? 0)));

  const maskAveragePercent = (mask: Uint8Array) => {
    if (!mask.length) return 0;
    const sum = mask.reduce((acc, value) => acc + value, 0);
    return (sum / mask.length / 255) * 100;
  };
  const isMaskCorrect = (mask: Uint8Array) => maskAveragePercent(mask) >= minCorrectness;
  const levelStats = useMemo(() => {
    if (revisionType.id !== 'levels') return null;
    const meta = revisionMeta as {
      pool?: CogitaCardSearchResult[];
      active?: CogitaCardSearchResult[];
      levelMap?: Record<string, number>;
    };
    const pool = meta.pool ?? [];
    const active = meta.active ?? [];
    const levelMap = meta.levelMap ?? {};
    const levelsCount = Math.max(1, Number(revisionSettings.levels ?? 1));
    const counts = Array.from({ length: levelsCount }, () => 0);
    const buckets = Array.from({ length: levelsCount }, () => [] as CogitaCardSearchResult[]);
    const activeSet = new Set(active.map((card) => card.cardId));
    pool.forEach((card) => {
      const level = Math.min(levelsCount, Math.max(1, levelMap[card.cardId] ?? 1));
      counts[level - 1] += 1;
      buckets[level - 1].push(card);
    });
    const currentLevel = currentCard ? (levelMap[currentCard.cardId] ?? 1) : null;
    return {
      counts,
      buckets,
      currentLevel,
      levelsCount,
      activeCount: active.length,
      poolCount: pool.length,
      activeSet
    };
  }, [revisionMeta, revisionSettings, revisionType, currentCard]);
  const applyOutcomeToSession = (correct: boolean) => {
    const nextState = revisionType.applyOutcome(
      { queue, meta: revisionMeta },
      currentCard,
      limit,
      revisionSettings,
      { correct }
    );
    setQueue(nextState.queue);
    setRevisionMeta(nextState.meta);
    const next = nextState.queue[currentIndex + 1];
    if (next) {
      void resolveCard(next, currentIndex + 1);
    }
  };

  useEffect(() => {
    if (!shareId) {
      setShareStatus('error');
      return;
    }
    setShareStatus('loading');
    getCogitaPublicRevisionShare({ shareId, key: shareKey })
      .then((info) => {
        setShareInfo(info);
        setCollectionName(info.collectionName);
        setLibraryName(info.libraryName);
        setShareStatus('ready');
      })
      .catch(() => {
        setShareStatus('error');
      });
  }, [shareId, shareKey]);

  useEffect(() => {
    if (!shareId) return;
    getCogitaPublicRevisionInfos({ shareId, key: shareKey, type: 'language' })
      .then((results) => setLanguages(results))
      .catch(() => setLanguages([]));
  }, [shareId, shareKey]);

  useEffect(() => {
    if (!shareId || shareStatus !== 'ready') return;
    let mounted = true;
    const fetchCards = async () => {
      setStatus('loading');
      try {
        const gathered: CogitaCardSearchResult[] = [];
        let cursor: string | null | undefined = null;
        do {
          const bundle = await getCogitaPublicRevisionCards({
            shareId,
            key: shareKey,
            limit: 100,
            cursor
          });
          gathered.push(...bundle.items);
          cursor = bundle.nextCursor ?? null;
          if (gathered.length >= revisionType.getFetchLimit(limit, revisionSettings)) break;
        } while (cursor);

        if (!mounted) return;
        let initialLevels: Record<string, number> | undefined;
        if (revisionType.id === 'levels') {
          const levelsCount = Math.max(1, Number(revisionSettings.levels ?? 1));
          const scores = await Promise.all(
            gathered.map(async (card) => {
              const itemType = card.cardType === 'info' ? 'info' : 'connection';
              try {
                const outcomes = await getOutcomesForItem(itemType, card.cardId);
                if (outcomes.length > 0) return computeKnowness(outcomes).score;
              } catch {
                return 0;
              }
              return 0;
            })
          );
          initialLevels = {};
          gathered.forEach((card, index) => {
            const score = scores[index] ?? 0;
            const level = Math.max(1, Math.min(levelsCount, Math.ceil((score / 100) * levelsCount)));
            initialLevels![card.cardId] = level;
          });
        }
        const initial =
          revisionType.id === 'levels'
            ? prepareLevelsState(gathered, limit, revisionSettings, initialLevels)
            : revisionType.prepare(gathered, limit, revisionSettings);
        setQueue(initial.queue);
        setRevisionMeta(initial.meta);
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
  }, [shareId, shareKey, limit, revisionType, revisionSettings, shareStatus]);

  useEffect(() => {
    setAnswer('');
    setFeedback(null);
    setAnswerMask(null);
    setAttempts(0);
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
      setComputedAnswerTemplate(resolved.answerTemplate);
      setComputedOutputVariables(resolved.outputVariables);
      setComputedVariableValues(resolved.variableValues);
    });
    return () => {
      mounted = false;
    };
  }, [currentCard, shareId, copy]);


  const lastFocusCardRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentCard) return;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (
      lastFocusCardRef.current === currentCard.cardId &&
      active &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
    ) {
      return;
    }
    let tries = 0;
    const focusInput = () => {
      if (!currentCard) return;
      if (currentCard.cardType === 'info' && currentCard.infoType === 'computed') {
        if (computedExpected.length > 0) {
          const firstKey = getFirstComputedInputKey(
            computedAnswerTemplate,
            computedExpected,
            computedOutputVariables
          );
          const target = firstKey ? computedInputRefs.current[firstKey] : null;
          if (target) {
            target.focus();
            if (document.activeElement === target) {
              lastFocusCardRef.current = currentCard.cardId;
              return;
            }
          }
        }
        if (answerInputRef.current) {
          answerInputRef.current.focus();
          if (document.activeElement === answerInputRef.current) {
            lastFocusCardRef.current = currentCard.cardId;
            return;
          }
        }
      } else if (currentCard.cardType === 'vocab') {
        if (answerInputRef.current) {
          answerInputRef.current.focus();
          if (document.activeElement === answerInputRef.current) {
            lastFocusCardRef.current = currentCard.cardId;
            return;
          }
        }
      }
      if (tries < 6) {
        tries += 1;
        window.setTimeout(focusInput, 40);
      }
    };
    const handle = window.setTimeout(focusInput, 40);
    return () => window.clearTimeout(handle);
  }, [currentCard, computedExpected, computedAnswerTemplate, computedOutputVariables]);

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
    const itemType = currentCard.cardType === 'info' ? 'info' : 'connection';
    getOutcomesForItem(itemType, currentCard.cardId)
      .then((outcomes) => setReviewSummary(computeKnowness(outcomes)))
      .catch(() => setReviewSummary(null));
  }, [currentCard]);

  const refreshKnowness = (itemType: 'info' | 'connection', itemId: string) => {
    void getOutcomesForItem(itemType, itemId)
      .then((outcomes) => setReviewSummary(computeKnowness(outcomes)))
      .catch(() => setReviewSummary(null));
  };

  const advanceCard = () => {
    setFeedback(null);
    setAnswer('');
    setShowCorrectAnswer(false);
    setComputedFieldFeedback({});
    setCanAdvance(false);
    setAnswerMask(null);
    setAttempts(0);
    setCurrentIndex((prev) => Math.min(prev + 1, queue.length));
  };

  const submitReview = (options: {
    correct: boolean;
    direction: string | null;
    expected?: string | null;
    answer?: string;
    expectedMap?: Record<string, string>;
    answerMap?: Record<string, string>;
    evalType: string;
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
    const mask = maskValue ? compareStrings(maskValue, maskAnswer, compareMode) : new Uint8Array();
    const payload = {
      revisionType: revisionType.id,
      evalType: options.evalType,
      direction: options.direction,
      prompt: prompt ?? '',
      expected: expectedValue,
      answer: answerValue,
      expectedAnswers: options.expectedMap ?? null,
      answers: options.answerMap ?? null,
      correct: options.correct,
      maskBase64: mask.length ? toBase64(mask) : null,
      checkMode: check,
      compareMode,
      minCorrectness
    };
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const itemType = currentCard.cardType === 'info' ? 'info' : 'connection';
    void recordOutcome({
      itemType,
      itemId: currentCard.cardId,
      revisionType: revisionType.id,
      evalType: options.evalType,
      correct: options.correct,
      maskBase64: mask.length ? toBase64(mask) : null,
      payloadBase64: toBase64(payloadBytes)
    })
      .then(() => {
        refreshKnowness(itemType, currentCard.cardId);
      })
      .catch(() => {
        // local store may be unavailable
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
    const promise = getCogitaPublicInfoDetail({ shareCode: shareId, infoId, key: shareKey })
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
        return getCogitaPublicComputedSample({ shareId, infoId, key: shareKey }).then((sample) => {
          const result = { sample, answerTemplate: null };
          computedSampleCache.current.set(cacheKey, result);
          return result;
        });
      })
      .catch(() =>
        getCogitaPublicComputedSample({ shareId, infoId, key: shareKey })
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
        setAttempts(0);
        applyOutcomeToSession(true);
        submitReview({
          correct: true,
          direction: prompt ? `${prompt} -> computed` : 'computed',
          expectedMap: computedExpected.reduce<Record<string, string>>((acc, entry) => {
            acc[entry.key] = entry.expected;
            return acc;
          }, {}),
          answerMap: computedAnswers,
          evalType: 'computed'
        });
      } else {
        setFeedback('incorrect');
        setComputedFieldFeedback(fieldFeedback);
        setCanAdvance(false);
        setAttempts((prev) => {
          const next = prev + 1;
          if (next >= maxTries && hasExpectedAnswer) {
            setShowCorrectAnswer(true);
            setCanAdvance(true);
          }
          return next;
        });
        applyOutcomeToSession(false);
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
          answerMap: computedAnswers,
          evalType: 'computed'
        });
      }
      return;
    }
    if (!expectedAnswer) return;
    const mask = compareStrings(expectedAnswer, answer, compareMode);
    const exactCorrect = check === 'exact' && normalizeAnswer(answer) === normalizeAnswer(expectedAnswer);
    const thresholdCorrect = isMaskCorrect(mask);
    const isCorrect = exactCorrect || thresholdCorrect;
    if (isCorrect) {
      setFeedback('correct');
      setComputedFieldFeedback({});
      setCanAdvance(true);
      setAnswerMask(mask);
      setAttempts(0);
      applyOutcomeToSession(true);
      submitReview({
        correct: true,
        direction: prompt ? `${prompt} -> ${expectedAnswer}` : null,
        expected: expectedAnswer,
        answer,
        evalType: 'text'
      });
    } else {
      setFeedback('incorrect');
      setComputedFieldFeedback({});
      setCanAdvance(false);
      setAnswerMask(mask);
      setAttempts((prev) => {
        const next = prev + 1;
        if (next >= maxTries && hasExpectedAnswer) {
          setShowCorrectAnswer(true);
          setCanAdvance(true);
        }
        return next;
      });
      applyOutcomeToSession(false);
      window.setTimeout(() => answerInputRef.current?.focus(), 40);
      submitReview({
        correct: false,
        direction: prompt ? `${prompt} -> ${expectedAnswer}` : null,
        expected: expectedAnswer,
        answer,
        evalType: 'text'
      });
    }
  };

  const handleLanguageSelect = (label: string) => {
    preloadNextCard();
    if (!expectedAnswer) return;
    const mask = compareStrings(expectedAnswer, label, compareMode);
    const exactCorrect = normalizeAnswer(label) === normalizeAnswer(expectedAnswer);
    const thresholdCorrect = isMaskCorrect(mask);
    const isCorrect = exactCorrect || thresholdCorrect;
    if (isCorrect) {
      setFeedback('correct');
      setComputedFieldFeedback({});
      setCanAdvance(true);
      setAnswerMask(mask);
      setAttempts(0);
      applyOutcomeToSession(true);
      submitReview({ correct: true, direction: `word->language`, expected: expectedAnswer, answer: label, evalType: 'language-select' });
    } else {
      setFeedback('incorrect');
      setComputedFieldFeedback({});
      setCanAdvance(false);
      setAnswerMask(mask);
      setAttempts((prev) => {
        const next = prev + 1;
        if (next >= maxTries && hasExpectedAnswer) {
          setShowCorrectAnswer(true);
          setCanAdvance(true);
        }
        return next;
      });
      applyOutcomeToSession(false);
      submitReview({ correct: false, direction: `word->language`, expected: expectedAnswer, answer: label, evalType: 'language-select' });
    }
  };

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

  const handleMarkReviewed = () => {
    preloadNextCard();
    setFeedback('correct');
    setCanAdvance(true);
    setAttempts(0);
    applyOutcomeToSession(true);
    if (expectedAnswer) {
      submitReview({ correct: true, direction: 'manual', expected: expectedAnswer, answer, evalType: 'manual' });
    }
  };

  const handleSkip = () => {
    applyOutcomeToSession(false);
    advanceCard();
  };

  useEffect(() => {
    preloadNextCard();
  }, [currentIndex, queue]);

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
            <p className="cogita-user-kicker">{copy.cogita.library.revision.shareRunKicker}</p>
            <h1 className="cogita-library-title">{collectionName}</h1>
            <p className="cogita-library-subtitle">{libraryName}</p>
            <p className="cogita-library-subtitle">
              {copy.cogita.library.revision.modeSummary.replace('{mode}', modeLabel).replace('{check}', checkLabel)}
            </p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href="/#/cogita">
              {copy.cogita.library.actions.backToCogita}
            </a>
          </div>
        </header>

        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane cogita-revision-stats">
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
                    {levelStats ? (
                      <p>
                        <strong>{copy.cogita.library.revision.levelsCurrentLabel}</strong>{' '}
                        {levelStats.currentLevel ?? '-'} / {levelStats.levelsCount}
                      </p>
                    ) : null}
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
                {shareStatus !== 'ready' ? (
                    <div className="cogita-card-empty">
                      <p>
                        {shareStatus === 'loading'
                          ? copy.cogita.library.revision.shareLoading
                          : copy.cogita.library.revision.shareInvalid}
                      </p>
                      <div className="cogita-form-actions">
                        <a className="cta" href="/#/cogita">
                          {copy.cogita.library.actions.backToCogita}
                        </a>
                      </div>
                    </div>
                  ) : currentCard ? (
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
                        onSkip={handleSkip}
                        onLanguageSelect={handleLanguageSelect}
                        onMarkReviewed={handleMarkReviewed}
                        onAdvance={advanceCard}
                        showCorrectAnswer={showCorrectAnswer}
                        setShowCorrectAnswer={setShowCorrectAnswer}
                        onRevealCorrect={() => setCanAdvance(true)}
                        answerMask={answerMask}
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
                        <a className="cta" href="/#/cogita">
                          {copy.cogita.library.actions.backToCogita}
                        </a>
                      </div>
                    </div>
                  )}
                </section>
                <section className="cogita-revision-insights">
                  <div className="cogita-revision-insight-grid">
                    <div className="cogita-revision-insight-card">
                      <p className="cogita-user-kicker">{copy.cogita.library.revision.progressTitle}</p>
                      <h3 className="cogita-detail-title">
                        {progressTotal ? `${progressCurrent} / ${progressTotal}` : '0 / 0'}
                      </h3>
                      {shareStatus === 'error' && <p>{copy.cogita.library.revision.shareInvalid}</p>}
                      {shareStatus === 'loading' && <p>{copy.cogita.library.revision.shareLoading}</p>}
                      {shareStatus === 'ready' && status === 'loading' && <p>{copy.cogita.library.revision.loading}</p>}
                      {shareStatus === 'ready' && status === 'error' && <p>{copy.cogita.library.revision.error}</p>}
                      {shareStatus === 'ready' && status === 'ready' && queue.length === 0 && <p>{copy.cogita.library.revision.empty}</p>}
                    </div>
                    <div className="cogita-revision-insight-card">
                      <p className="cogita-user-kicker">{copy.cogita.library.revision.revealModeLabel}</p>
                      <h3 className="cogita-detail-title">{revealPolicy}</h3>
                      <p>
                        <strong>{copy.cogita.library.revision.triesLabel}</strong> {maxTries}
                      </p>
                    </div>
                  </div>
                  {levelStats ? (
                    <div className="cogita-revision-levels">
                      <div className="cogita-revision-levels-header">
                        <div>
                          <p className="cogita-user-kicker">{copy.cogita.library.revision.levelsCountsLabel}</p>
                          <h3 className="cogita-detail-title">
                            {copy.cogita.library.revision.levelsStackLabel} {levelStats.activeCount} / {levelStats.poolCount}
                          </h3>
                        </div>
                      </div>
                      <div className="cogita-revision-level-grid">
                        {levelStats.buckets.map((cards, index) => {
                          const levelNumber = index + 1;
                          const isActive = levelStats.currentLevel === levelNumber;
                          return (
                            <div key={`level-${levelNumber}`} className="cogita-revision-level-column" data-active={isActive}>
                              <div className="cogita-revision-level-head">
                                <span>{levelNumber}</span>
                                <strong>{cards.length}</strong>
                              </div>
                              <div className="cogita-revision-level-cards">
                                {cards.map((card) => (
                                  <span
                                    key={card.cardId}
                                    className="cogita-revision-level-dot"
                                    data-current={card.cardId === currentCard?.cardId}
                                    data-active={levelStats.activeSet.has(card.cardId)}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
