import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getCogitaCollection,
  getCogitaCollectionCards,
  getCogitaRevision,
  getCogitaComputedSample,
  getCogitaInfoDetail,
  getCogitaInfoCheckcards,
  getCogitaInfoCheckcardDependencies,
  getCogitaItemDependencies,
  searchCogitaInfos,
  type CogitaCardSearchResult,
  type CogitaComputedSample,
  type CogitaInfoSearchResult,
  type CogitaItemDependency
} from '../../../../lib/api';
import { toBase64 } from '../../../../lib/crypto';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import type { CogitaInfoType } from '../types';
import { getInfoTypeLabel } from '../libraryOptions';
import { buildComputedSampleFromGraph, toComputedSample } from '../utils/computedGraph';
import type { ComputedGraphDefinition } from '../components/ComputedGraphEditor';
import { CogitaRevisionCard } from './components/CogitaRevisionCard';
import { CogitaCheckcardSurface } from './components/CogitaCheckcardSurface';
import { CogitaCardKnownessPanel } from './components/CogitaCardKnownessPanel';
import { buildTemporalEntries, computeKnowness, computeTemporalKnowness } from '../../../../cogita/revision/knowness';
import { getCardKey, getOutcomeKey } from '../../../../cogita/revision/cards';
import {
  getAllOutcomes,
  getOutcomesForItem,
  recordOutcome,
  syncPendingOutcomes,
  type RevisionOutcomePayload
} from '../../../../cogita/revision/outcomes';
import {
  getRevisionType,
  normalizeRevisionSettings,
  parseRevisionSettingsFromParams,
  prepareLevelsState,
  prepareTemporalState
} from '../../../../cogita/revision/registry';
import {
  compareStrings,
  evaluateAnchorTextAnswer,
  maskAveragePercent,
  type CompareAlgorithmId
} from '../../../../cogita/revision/compare';
import { loadInfoSelectionRevisionSeed } from '../../../../cogita/revision/scope';
import { buildQuoteFragmentContext, buildQuoteFragmentTree, pickQuoteFragment, type QuoteFragmentTree } from '../../../../cogita/revision/quote';
import {
  applyScriptMode,
  expandQuoteDirectionCards,
  getFirstComputedInputKey,
  matchesDependencyChild,
  matchesQuoteDirection,
  normalizeAnswer,
  normalizeDependencyToken,
  normalizeQuestionType,
  parseQuoteFragmentDirection
} from './revisionShared';

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
  collectionId,
  revisionId
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
  collectionId?: string;
  revisionId?: string;
}) {
  const location = useLocation();
  const baseHref = `/#/cogita/library/${libraryId}`;
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const limit = Math.max(1, Number(params.get('limit') ?? 20));
  const mode = params.get('mode') ?? 'random';
  const revisionType = useMemo(() => getRevisionType(mode), [mode]);
  const revisionSettings = useMemo(
    () => normalizeRevisionSettings(revisionType, parseRevisionSettingsFromParams(revisionType, params)),
    [revisionType, params]
  );
  const check = params.get('check') ?? 'exact';
  const reviewer = params.get('reviewer');
  const scopeParam = (params.get('scope') ?? '').trim();
  const revisionScope = scopeParam === 'info' || scopeParam === 'info-selection' ? scopeParam : 'collection';
  const scopedInfoId = revisionScope === 'info' ? (params.get('infoId') ?? '').trim() : '';
  const scopedSeedId = revisionScope === 'info-selection' ? (params.get('seed') ?? '').trim() : '';
  const [resolvedRevisionCollectionId, setResolvedRevisionCollectionId] = useState<string | null>(null);
  const effectiveCollectionId = collectionId ?? resolvedRevisionCollectionId ?? undefined;
  const isCollectionScope = revisionScope === 'collection' && Boolean(effectiveCollectionId);
  const modeLabel = useMemo(
    () => copy.cogita.library.revision[revisionType.labelKey] ?? mode,
    [copy, mode, revisionType]
  );
  const checkLabel = useMemo(() => (check === 'exact' ? copy.cogita.library.revision.checkValue : check), [copy, check]);

  const [collectionName, setCollectionName] = useState(copy.cogita.library.collections.defaultName);
  const [queue, setQueue] = useState<CogitaCardSearchResult[]>([]);
  const [languages, setLanguages] = useState<CogitaInfoSearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [loadProgress, setLoadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [expectedAnswer, setExpectedAnswer] = useState<string | null>(null);
  const [quoteContext, setQuoteContext] = useState<{
    title: string;
    before: string;
    after: string;
    fragmentId: string | null;
    total: number;
    completed: number;
  } | null>(null);
  const [computedExpected, setComputedExpected] = useState<Array<{ key: string; expected: string }>>([]);
  const [computedAnswers, setComputedAnswers] = useState<Record<string, string>>({});
  const [computedFieldFeedback, setComputedFieldFeedback] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const [computedValues, setComputedValues] = useState<Record<string, number | string> | null>(null);
  const [computedAnswerTemplate, setComputedAnswerTemplate] = useState<string | null>(null);
  const [computedOutputVariables, setComputedOutputVariables] = useState<Record<string, string> | null>(null);
  const [computedVariableValues, setComputedVariableValues] = useState<Record<string, string> | null>(null);
  const [matchState, setMatchState] = useState<{
    pairs: Array<{
      cardId: string;
      leftId: string;
      rightId: string;
      leftLabel: string;
      rightLabel: string;
    }>;
    leftOrder: string[];
    rightOrder: string[];
    selection: Record<string, string>;
    activeLeft: string | null;
    activeRight: string | null;
    locked: Record<string, boolean>;
  } | null>(null);
  const [matchFeedback, setMatchFeedback] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const matchFlashTickRef = useRef(0);
  const [matchFlash, setMatchFlash] = useState<{ kind: 'correct' | 'incorrect'; tick: number } | null>(null);
  const matchFlashRef = useRef<number | null>(null);
  const matchFlashResetRef = useRef<number | null>(null);
  const [scriptMode, setScriptMode] = useState<'super' | 'sub' | null>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [reviewSummary, setReviewSummary] = useState<{ score: number; total: number; correct: number; lastReviewedUtc?: string | null } | null>(null);
  const [reviewOutcomes, setReviewOutcomes] = useState<RevisionOutcomePayload[]>([]);
  const [availabilityNotice, setAvailabilityNotice] = useState<string | null>(null);
  const previousEligibleCountRef = useRef<number | null>(null);
  const availabilityNoticeTimerRef = useRef<number | null>(null);
  const [answerMask, setAnswerMask] = useState<Uint8Array | null>(null);
  const [attempts, setAttempts] = useState(0);
  const answerInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const computedInputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const [canAdvance, setCanAdvance] = useState(false);
  const [revisionMeta, setRevisionMeta] = useState<Record<string, unknown>>({});
  const [itemDependencies, setItemDependencies] = useState<CogitaItemDependency[]>([]);
  const collectionKnownessCache = useRef(new Map<string, number>());
  const [eligibleKeys, setEligibleKeys] = useState<Set<string>>(new Set());
  const [dependencyBlocked, setDependencyBlocked] = useState(false);
  const quoteTreeRef = useRef<QuoteFragmentTree | null>(null);
  const quoteKnownRef = useRef<Set<string>>(new Set());
  const quoteKnownessRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!revisionId || collectionId) {
      setResolvedRevisionCollectionId(null);
      return;
    }
    getCogitaRevision({ libraryId, revisionId })
      .then((revision) => setResolvedRevisionCollectionId(revision.collectionId))
      .catch(() => setResolvedRevisionCollectionId(null));
  }, [collectionId, libraryId, revisionId]);

  const currentCard = queue[currentIndex] ?? null;
  const isMatchMode = currentCard?.checkType === 'translation-match' && matchState;
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
  const poolCount = useMemo(() => {
    if (revisionType.id !== 'levels') return queue.length;
    const meta = revisionMeta as { pool?: CogitaCardSearchResult[] };
    return meta.pool?.length ?? revisionType.getFetchLimit(limit, revisionSettings);
  }, [revisionMeta, revisionSettings, revisionType, queue.length, limit]);
  const progressTotal = revisionType.getProgressTotal
    ? revisionType.getProgressTotal(queue, revisionMeta, limit, revisionSettings)
    : revisionType.id === 'levels'
      ? Math.min(limit, poolCount)
      : queue.length;
  const progressCurrent = progressTotal ? Math.min(currentIndex + 1, progressTotal) : 0;
  const maxTries = Math.max(1, Number(revisionSettings.tries ?? 1));
  const compareMode = (revisionSettings.compare as CompareAlgorithmId | undefined) ?? 'anchors';
  const minCorrectness = Math.max(0, Math.min(100, Number(revisionSettings.minCorrectness ?? 0)));
  const considerDependencies = (revisionSettings.considerDependencies ?? 'on') === 'on';
  const dependencyThreshold = Math.max(0, Math.min(100, Number(revisionSettings.dependencyThreshold ?? 85)));

  const shuffleList = <T,>(items: T[]) => {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const isMaskCorrect = (mask: Uint8Array) => maskAveragePercent(mask, { treatSimilarCharsAsSame: true }) >= minCorrectness;
  const buildKnownessMaps = async () => {
    const outcomes = await getAllOutcomes();
    const itemGroups = new Map<string, typeof outcomes>();
    const cardGroups = new Map<string, typeof outcomes>();
    const fragmentGroups = new Map<string, typeof outcomes>();
    outcomes.forEach((entry) => {
      const itemKey = `${entry.itemType}:${entry.itemId}`;
      const cardKey = getOutcomeKey(entry.itemType, entry.itemId, entry.checkType, entry.direction);
      if (!itemGroups.has(itemKey)) itemGroups.set(itemKey, []);
      itemGroups.get(itemKey)!.push(entry);
      if (!cardGroups.has(cardKey)) cardGroups.set(cardKey, []);
      cardGroups.get(cardKey)!.push(entry);
      if (entry.itemType === 'info' && entry.checkType === 'quote-fragment' && entry.direction) {
        const fragKey = `${entry.itemId}:${entry.direction}`;
        if (!fragmentGroups.has(fragKey)) fragmentGroups.set(fragKey, []);
        fragmentGroups.get(fragKey)!.push(entry);
      }
    });
    const itemKnowness = new Map<string, number>();
    const cardKnowness = new Map<string, number>();
    const fragmentKnowness = new Map<string, number>();
    itemGroups.forEach((group, key) => itemKnowness.set(key, computeKnowness(group).score));
    cardGroups.forEach((group, key) => cardKnowness.set(key, computeKnowness(group).score));
    fragmentGroups.forEach((group, key) => fragmentKnowness.set(key, computeKnowness(group).score));
    return { itemKnowness, cardKnowness, fragmentKnowness };
  };

  const fetchAllCollectionCards = async (collectionId: string) => {
    const items: CogitaCardSearchResult[] = [];
    let cursor: string | null = null;
    while (true) {
      const bundle = await getCogitaCollectionCards({ libraryId, collectionId, limit: 200, cursor });
      items.push(...bundle.items);
      if (!bundle.nextCursor) break;
      cursor = bundle.nextCursor;
    }
    return expandQuoteDirectionCards(items);
  };

  const getCollectionKnowness = async (collectionId: string, cardKnowness: Map<string, number>) => {
    if (collectionKnownessCache.current.has(collectionId)) {
      return collectionKnownessCache.current.get(collectionId) ?? 0;
    }
    const cards = await fetchAllCollectionCards(collectionId);
    if (cards.length === 0) {
      collectionKnownessCache.current.set(collectionId, 0);
      return 0;
    }
    const total = cards.reduce((sum, card) => {
      const key = getCardKey(card);
      return sum + (cardKnowness.get(key) ?? 0);
    }, 0);
    const mean = total / cards.length;
    collectionKnownessCache.current.set(collectionId, mean);
    return mean;
  };

  const isInternalCardDependencySatisfied = (
    card: CogitaCardSearchResult,
    cardKnowness: Map<string, number>
  ) => {
    if (!considerDependencies) return true;
    if (card.cardType !== 'info' || card.infoType !== 'citation' || card.checkType !== 'quote-fragment') return true;
    const parsed = parseQuoteFragmentDirection(card.direction);
    if (!parsed?.fragmentId) return true;
    const quoteText = card.description ?? '';
    if (!quoteText.trim()) return true;
    const tree = buildQuoteFragmentTree(quoteText);
    const node = tree.nodes[parsed.fragmentId];
    if (!node) return true;
    if (!node.leftId && !node.rightId) return true;
    const childIds = [node.leftId, node.rightId].filter((id): id is string => Boolean(id));
    if (childIds.length === 0) return true;
    const scores = childIds.map((childId) => {
      const key = getOutcomeKey('info', card.cardId, 'quote-fragment', childId);
      return cardKnowness.get(key) ?? 0;
    });
    const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    return mean >= dependencyThreshold;
  };

  const recomputeEligibility = async (cards: CogitaCardSearchResult[]) => {
    const meta = revisionMeta as { pool?: CogitaCardSearchResult[]; active?: CogitaCardSearchResult[] };
    const evaluationCards = cards
      .concat(meta.active ?? [])
      .concat(meta.pool ?? [])
      .filter((card, index, list) => list.findIndex((c) => getCardKey(c) === getCardKey(card)) === index);
    if (!considerDependencies) {
      setEligibleKeys(new Set(evaluationCards.map(getCardKey)));
      return;
    }
    const { itemKnowness, cardKnowness } = await buildKnownessMaps();
    const collectionDeps = itemDependencies.filter(
      (dep) =>
        normalizeDependencyToken(dep.childItemType) === 'collection' &&
        dep.childItemId === collectionId &&
        !normalizeDependencyToken(dep.childCheckType) &&
        !normalizeDependencyToken(dep.childDirection)
    );
    const eligible = new Set<string>();
    for (const card of evaluationCards) {
      if (card.cardType !== 'info') {
        eligible.add(getCardKey(card));
        continue;
      }
      if (!isInternalCardDependencySatisfied(card, cardKnowness)) {
        continue;
      }
      const deps = itemDependencies.filter((dep) => matchesDependencyChild(dep, card)).concat(collectionDeps);
      if (deps.length === 0) {
        eligible.add(getCardKey(card));
        continue;
      }
      let total = 0;
      for (const dep of deps) {
        if (normalizeDependencyToken(dep.parentItemType) === 'collection') {
          total += await getCollectionKnowness(dep.parentItemId, cardKnowness);
        } else if (normalizeDependencyToken(dep.parentCheckType) || normalizeDependencyToken(dep.parentDirection)) {
          const parentCheckType = normalizeDependencyToken(dep.parentCheckType);
          const parentDirection = normalizeDependencyToken(dep.parentDirection);
          const key = getOutcomeKey(
            dep.parentItemType,
            dep.parentItemId,
            parentCheckType,
            parentDirection
          );
          total += cardKnowness.get(key) ?? 0;
        } else {
          const key = `${dep.parentItemType}:${dep.parentItemId}`;
          total += itemKnowness.get(key) ?? 0;
        }
      }
      const mean = total / deps.length;
      if (mean >= dependencyThreshold) {
        eligible.add(getCardKey(card));
      }
    }
    setEligibleKeys(eligible);
  };

  const getNextEligibleIndex = (startIndex: number) => {
    for (let i = startIndex; i < queue.length; i += 1) {
      const card = queue[i];
      if (!card) continue;
      if (!considerDependencies || card.cardType !== 'info') {
        return i;
      }
      if (eligibleKeys.has(getCardKey(card))) {
        return i;
      }
    }
    return -1;
  };

  const isCardEligibleForRevision = (card: CogitaCardSearchResult) =>
    !considerDependencies || card.cardType !== 'info' || eligibleKeys.has(getCardKey(card));

  const findEligibleFallbackCard = (excludeKeys: Set<string>) => {
    if (revisionType.id !== 'temporal' && revisionType.id !== 'levels') return null;
    const meta = revisionMeta as { active?: CogitaCardSearchResult[]; pool?: CogitaCardSearchResult[] };
    const source = (meta.active ?? []).concat(meta.pool ?? []);
    const seen = new Set<string>();
    for (const card of source) {
      const key = getCardKey(card);
      if (seen.has(key) || excludeKeys.has(key)) continue;
      seen.add(key);
      if (isCardEligibleForRevision(card)) return card;
    }
    return null;
  };
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
    const activeSet = new Set(active.map((card) => getCardKey(card)));
    pool.forEach((card) => {
      const level = Math.min(levelsCount, Math.max(1, levelMap[getCardKey(card)] ?? 1));
      counts[level - 1] += 1;
    });
    const total = pool.length || 1;
    const percentages = counts.map((count) => (count / total) * 100);
    const currentLevel = currentCard ? (levelMap[getCardKey(currentCard)] ?? 1) : null;
    return {
      counts,
      percentages,
      currentLevel,
      levelsCount,
      activeCount: active.length,
      poolCount: pool.length,
      activeSet
    };
  }, [revisionMeta, revisionSettings, revisionType, currentCard]);
  const temporalStats = useMemo(() => {
    if (revisionType.id !== 'temporal') return null;
    const meta = revisionMeta as {
      pool?: CogitaCardSearchResult[];
      active?: CogitaCardSearchResult[];
      knownessMap?: Record<string, number>;
      unknownSet?: Set<string>;
    };
    const pool = meta.pool ?? [];
    const active = meta.active ?? [];
    const knownessMap = meta.knownessMap ?? {};
    const unknownSet = new Set<string>(meta.unknownSet ?? []);
    let knownCount = 0;
    pool.forEach((card) => {
      const value = knownessMap[getCardKey(card)] ?? 0;
      if (value > 1) knownCount += 1;
    });
    const unknownCount = unknownSet.size;
    const dots = active.map((card) => ({
      id: getCardKey(card),
      value: unknownSet.has(getCardKey(card)) ? 0 : Math.max(0, Math.min(1, knownessMap[getCardKey(card)] ?? 0))
    }));
    return { knownCount, unknownCount, dots };
  }, [revisionMeta, revisionType]);
  const blockedCount = useMemo(() => {
    if (!considerDependencies) return 0;
    const meta = revisionMeta as { pool?: CogitaCardSearchResult[]; active?: CogitaCardSearchResult[] };
    const cards = queue
      .concat(meta.active ?? [])
      .concat(meta.pool ?? [])
      .filter((card, index, list) => list.findIndex((c) => getCardKey(c) === getCardKey(card)) === index);
    return cards.filter((card) => card.cardType === 'info' && !eligibleKeys.has(getCardKey(card))).length;
  }, [considerDependencies, revisionMeta, queue, eligibleKeys]);

  useEffect(() => {
    if (!considerDependencies || status !== 'ready') return;
    const meta = revisionMeta as { pool?: CogitaCardSearchResult[]; active?: CogitaCardSearchResult[] };
    const cards = queue
      .concat(meta.active ?? [])
      .concat(meta.pool ?? [])
      .filter((card, index, list) => list.findIndex((c) => getCardKey(c) === getCardKey(card)) === index);
    const eligibleCount = cards.filter((card) => card.cardType !== 'info' || eligibleKeys.has(getCardKey(card))).length;
    const previous = previousEligibleCountRef.current;
    previousEligibleCountRef.current = eligibleCount;
    if (previous === null || eligibleCount <= previous) return;
    const delta = eligibleCount - previous;
    setAvailabilityNotice(`New card available (+${delta})`);
    if (availabilityNoticeTimerRef.current) window.clearTimeout(availabilityNoticeTimerRef.current);
    availabilityNoticeTimerRef.current = window.setTimeout(() => setAvailabilityNotice(null), 2200);
  }, [considerDependencies, status, revisionMeta, queue, eligibleKeys]);

  useEffect(
    () => () => {
      if (availabilityNoticeTimerRef.current) window.clearTimeout(availabilityNoticeTimerRef.current);
    },
    []
  );
  const applyOutcomeToSession = (correct: boolean, correctness?: number) => {
    const nextState = revisionType.applyOutcome(
      { queue, meta: revisionMeta },
      currentCard,
      limit,
      revisionSettings,
      { correct, correctness, createdUtc: new Date().toISOString() }
    );
    setQueue(nextState.queue);
    setRevisionMeta(nextState.meta);
    const next = nextState.queue[currentIndex + 1];
    if (next) {
      void resolveCard(next, currentIndex + 1);
    }
  };

  useEffect(() => {
    if (isCollectionScope && effectiveCollectionId) {
      getCogitaCollection(libraryId, effectiveCollectionId)
        .then((detail) => setCollectionName(detail.name))
        .catch(() => setCollectionName(copy.cogita.library.collections.defaultName));
      return;
    }
    if (revisionScope === 'info' && scopedInfoId) {
      getCogitaInfoDetail({ libraryId, infoId: scopedInfoId })
        .then((detail) => {
          const payload = (detail.payload ?? {}) as { title?: string; label?: string; name?: string };
          setCollectionName(payload.title || payload.label || payload.name || scopedInfoId);
        })
        .catch(() => setCollectionName(scopedInfoId || copy.cogita.library.revision.runKicker));
      return;
    }
    if (revisionScope === 'info-selection') {
      const seed = scopedSeedId ? loadInfoSelectionRevisionSeed(libraryId, scopedSeedId) : null;
      const count = seed?.infoIds.length ?? 0;
      setCollectionName(count > 0 ? `Selected infos (${count})` : 'Selected infos');
      return;
    }
    setCollectionName(copy.cogita.library.collections.defaultName);
  }, [copy, effectiveCollectionId, isCollectionScope, libraryId, revisionScope, scopedInfoId, scopedSeedId]);

  useEffect(() => {
    searchCogitaInfos({ libraryId, type: 'language' })
      .then((results) => setLanguages(results))
      .catch(() => setLanguages([]));
  }, [libraryId]);

  useEffect(() => {
    if (!isCollectionScope) {
      return;
    }
    getCogitaItemDependencies({ libraryId })
      .then((bundle) => setItemDependencies(bundle.items ?? []))
      .catch(() => setItemDependencies([]));
  }, [isCollectionScope, libraryId]);

  useEffect(() => {
    void syncPendingOutcomes(libraryId, reviewer);
  }, [libraryId, reviewer]);

  useEffect(() => {
    void recomputeEligibility(queue);
  }, [queue, itemDependencies, considerDependencies, dependencyThreshold, effectiveCollectionId]);

  useEffect(() => {
    if (!currentCard || !considerDependencies) {
      setDependencyBlocked(false);
      return;
    }
    if (currentCard.cardType !== 'info' || eligibleKeys.has(getCardKey(currentCard))) {
      setDependencyBlocked(false);
      return;
    }
    const nextIndex = getNextEligibleIndex(currentIndex + 1);
    if (nextIndex >= 0) {
      setDependencyBlocked(false);
      setCurrentIndex(nextIndex);
      return;
    }
    if (revisionType.id === 'temporal' || revisionType.id === 'levels') {
      const preserved = queue.slice(0, currentIndex + 1);
      const futureEligible = queue.slice(currentIndex + 1).filter(isCardEligibleForRevision);
      const nextQueue = preserved.concat(futureEligible);
      const existingKeys = new Set(nextQueue.map(getCardKey));
      const fallback = findEligibleFallbackCard(existingKeys);
      if (fallback) {
        const fallbackKey = getCardKey(fallback);
        if (!existingKeys.has(fallbackKey)) {
          nextQueue.push(fallback);
          existingKeys.add(fallbackKey);
          setRevisionMeta((prev) => {
            const typed = prev as { queued?: Set<string> };
            const queued = new Set<string>(typed.queued ?? []);
            queued.add(fallbackKey);
            return { ...typed, queued };
          });
        }
      }
      const fallbackIndex = nextQueue.findIndex(
        (card, index) => index !== currentIndex && isCardEligibleForRevision(card)
      );
      if (fallbackIndex >= 0) {
        setQueue(nextQueue);
        setCurrentIndex(fallbackIndex);
        setDependencyBlocked(false);
        return;
      }
    }
    setDependencyBlocked(true);
  }, [currentCard, eligibleKeys, considerDependencies, currentIndex, queue, revisionMeta, revisionType.id]);

  useEffect(() => {
    let mounted = true;
    const fetchCards = async () => {
      setStatus('loading');
      setLoadProgress({
        current: 0,
        total: revisionType.id === 'levels' ? 0 : revisionType.getFetchLimit(limit, revisionSettings)
      });
      try {
        if (!isCollectionScope) {
          setItemDependencies([]);
          if (revisionScope === 'info') {
            if (!scopedInfoId) {
              if (mounted) {
                setQueue([]);
                setItemDependencies([]);
                setRevisionMeta({});
                setCurrentIndex(0);
                setStatus('ready');
              }
              return;
            }
            const [cardBundle, depBundle] = await Promise.all([
              getCogitaInfoCheckcards({ libraryId, infoId: scopedInfoId }),
              getCogitaInfoCheckcardDependencies({ libraryId, infoId: scopedInfoId })
            ]);
            if (!mounted) return;
            const preparedCards = expandQuoteDirectionCards(cardBundle.items ?? []);
            setItemDependencies(depBundle.items ?? []);
            const initial = revisionType.prepare(preparedCards, limit, revisionSettings);
            setQueue(initial.queue);
            setRevisionMeta(initial.meta);
            setCurrentIndex(0);
            setStatus('ready');
            setLoadProgress({ current: preparedCards.length, total: preparedCards.length });
            return;
          }

          if (revisionScope === 'info-selection') {
            const seed = scopedSeedId ? loadInfoSelectionRevisionSeed(libraryId, scopedSeedId) : null;
            const infoIds = seed?.infoIds ?? [];
            if (!infoIds.length) {
              if (mounted) {
                setQueue([]);
                setItemDependencies([]);
                setRevisionMeta({});
                setCurrentIndex(0);
                setStatus('ready');
              }
              return;
            }
            const bundles = await Promise.all(
              infoIds.map(async (id) => {
                const [cardBundle, depBundle] = await Promise.all([
                  getCogitaInfoCheckcards({ libraryId, infoId: id }),
                  getCogitaInfoCheckcardDependencies({ libraryId, infoId: id })
                ]);
                return { cards: cardBundle.items ?? [], deps: depBundle.items ?? [] };
              })
            );
            if (!mounted) return;
            const cardMap = new Map<string, CogitaCardSearchResult>();
            bundles.forEach((bundle) => {
              expandQuoteDirectionCards(bundle.cards).forEach((card) => {
                cardMap.set(getCardKey(card), card);
              });
            });
            const mergedCards = Array.from(cardMap.values());
            const loadedKeys = new Set(mergedCards.map(getCardKey));
            const mergedDepsMap = new Map<string, CogitaItemDependency>();
            bundles.forEach((bundle) => {
              (bundle.deps ?? []).forEach((dep) => {
                const parentKey = getOutcomeKey(
                  dep.parentItemType,
                  dep.parentItemId,
                  normalizeDependencyToken(dep.parentCheckType),
                  normalizeDependencyToken(dep.parentDirection)
                );
                const childKey = getOutcomeKey(
                  dep.childItemType,
                  dep.childItemId,
                  normalizeDependencyToken(dep.childCheckType),
                  normalizeDependencyToken(dep.childDirection)
                );
                if (!loadedKeys.has(parentKey) || !loadedKeys.has(childKey)) return;
                const key = `${parentKey}->${childKey}`;
                if (!mergedDepsMap.has(key)) mergedDepsMap.set(key, dep);
              });
            });
            setItemDependencies(Array.from(mergedDepsMap.values()));
            const initial = revisionType.prepare(mergedCards, limit, revisionSettings);
            setQueue(initial.queue);
            setRevisionMeta(initial.meta);
            setCurrentIndex(0);
            setStatus('ready');
            setLoadProgress({ current: mergedCards.length, total: mergedCards.length });
            return;
          }
        }

        const gathered: CogitaCardSearchResult[] = [];
        let cursor: string | null | undefined = null;
        let targetTotal: number | null = null;
        do {
          const bundle = await getCogitaCollectionCards({
            libraryId,
              collectionId: effectiveCollectionId!,
            limit: 300,
            cursor
          });
          gathered.push(...bundle.items);
          if ((revisionType.id === 'levels' || revisionType.id === 'temporal') && bundle.total) {
            targetTotal = bundle.total;
          }
          setLoadProgress((prev) => ({
            current: gathered.length,
            total: prev.total || bundle.total || revisionType.getFetchLimit(limit, revisionSettings)
          }));
          cursor = bundle.nextCursor ?? null;
          if (targetTotal !== null && gathered.length >= targetTotal) break;
          if (revisionType.id !== 'levels' && revisionType.id !== 'temporal') {
            if (gathered.length >= revisionType.getFetchLimit(limit, revisionSettings)) break;
          }
        } while (cursor);

        if (!mounted) return;
        const preparedCards = expandQuoteDirectionCards(gathered);
        let initialLevels: Record<string, number> | undefined;
        if (revisionType.id === 'levels') {
          const levelsCount = Math.max(1, Number(revisionSettings.levels ?? 1));
          const outcomes = await getAllOutcomes();
          const grouped = outcomes.reduce<Record<string, typeof outcomes>>((acc, outcome) => {
            const key = getOutcomeKey(outcome.itemType, outcome.itemId, outcome.checkType, outcome.direction);
            if (!acc[key]) acc[key] = [];
            acc[key].push(outcome);
            return acc;
          }, {});
          initialLevels = {};
          preparedCards.forEach((card) => {
            const key = getCardKey(card);
            const entries = grouped[key] ?? [];
            const score = entries.length > 0 ? computeKnowness(entries).score : 0;
            const level = Math.max(1, Math.min(levelsCount, Math.ceil((score / 100) * levelsCount)));
            initialLevels![key] = level;
          });
        }
        let temporalKnowness: Record<string, number> | null = null;
        let temporalUnknown: Set<string> | null = null;
        let temporalOutcomes: Record<string, ReturnType<typeof buildTemporalEntries>> | null = null;
        if (revisionType.id === 'temporal') {
          const outcomes = await getAllOutcomes();
          const cardIds = new Set(preparedCards.map((card) => getCardKey(card)));
          const grouped = outcomes.reduce<Record<string, typeof outcomes>>((acc, outcome) => {
            const key = getOutcomeKey(outcome.itemType, outcome.itemId, outcome.checkType, outcome.direction);
            if (!cardIds.has(key)) return acc;
            if (!acc[key]) acc[key] = [];
            acc[key].push(outcome);
            return acc;
          }, {});
          temporalKnowness = {};
          temporalUnknown = new Set<string>();
          temporalOutcomes = {};
          const nowMs = Date.now();
          preparedCards.forEach((card) => {
            const cardKey = getCardKey(card);
            const entries = grouped[cardKey] ?? [];
            if (entries.length === 0) {
              temporalKnowness![cardKey] = 0;
              temporalUnknown!.add(cardKey);
              temporalOutcomes![cardKey] = [];
              return;
            }
            const temporalEntries = buildTemporalEntries(entries);
            temporalOutcomes![cardKey] = temporalEntries;
            const summary = computeTemporalKnowness(temporalEntries, nowMs);
            temporalKnowness![cardKey] = summary.knowness;
          });
        }
        const initial =
          revisionType.id === 'levels'
            ? prepareLevelsState(preparedCards, limit, revisionSettings, initialLevels)
            : revisionType.id === 'temporal'
              ? prepareTemporalState(
                  preparedCards,
                  limit,
                  revisionSettings,
                  temporalKnowness ?? {},
                  temporalUnknown ?? new Set<string>(),
                  temporalOutcomes ?? {}
                )
            : revisionType.prepare(preparedCards, limit, revisionSettings);
        setQueue(initial.queue);
        setRevisionMeta(initial.meta);
        setCurrentIndex(0);
        setStatus('ready');
        setLoadProgress((prev) => ({
          current: Math.min(prev.current, prev.total),
          total: prev.total
        }));
      } catch {
        if (mounted) setStatus('error');
      }
    };

    fetchCards();
    return () => {
      mounted = false;
    };
  }, [effectiveCollectionId, isCollectionScope, libraryId, limit, revisionScope, revisionSettings, revisionType, reviewer, scopedInfoId, scopedSeedId]);

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
    setMatchState(null);
    setMatchFeedback({});
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

  useEffect(() => {
    if (!currentCard || currentCard.cardType !== 'info' || currentCard.infoType !== 'citation') {
      quoteTreeRef.current = null;
      quoteKnownRef.current = new Set();
      setQuoteContext(null);
      return;
    }
    const quoteText = currentCard.description ?? '';
    const cardLabel = (currentCard.label ?? '').trim();
    const normalizedLabel = cardLabel.replace(/\s+/g, ' ').trim();
    const normalizedQuote = quoteText.replace(/\s+/g, ' ').trim();
    const title =
      normalizedLabel && normalizedLabel !== normalizedQuote
        ? cardLabel
        : copy.cogita.library.infoTypes.citation;
    if (!quoteText) {
      setQuoteContext(null);
      setExpectedAnswer(null);
      return;
    }
    const tree = buildQuoteFragmentTree(quoteText);
    quoteTreeRef.current = tree;
    setPrompt(title);
    let mounted = true;
    buildKnownessMaps()
      .then(({ fragmentKnowness }) => {
        if (!mounted) return;
        const known = new Set<string>();
        const fragmentScores: Record<string, number> = {};
        fragmentKnowness.forEach((score, key) => {
          const [itemId, rawDirection] = key.split(':', 2);
          if (itemId !== currentCard.cardId) return;
          const parsed = parseQuoteFragmentDirection(rawDirection);
          if (!parsed) return;
          const { fragmentId } = parsed;
          fragmentScores[fragmentId] = score;
          if (score >= dependencyThreshold) {
            known.add(fragmentId);
          }
        });
        quoteKnownRef.current = known;
        quoteKnownessRef.current = fragmentScores;
        const parsedDirection = parseQuoteFragmentDirection(currentCard.direction);
        if (parsedDirection?.fragmentId && tree.nodes[parsedDirection.fragmentId]) {
          applyQuoteFragment(tree, parsedDirection.fragmentId, title);
          return;
        }
        const next = pickQuoteFragment(tree, known, fragmentScores, dependencyThreshold, considerDependencies, currentCard.direction);
        applyQuoteFragment(tree, next?.id ?? null, title);
      })
      .catch(() => {
        quoteKnownRef.current = new Set();
        quoteKnownessRef.current = {};
        const parsedDirection = parseQuoteFragmentDirection(currentCard.direction);
        if (parsedDirection?.fragmentId && tree.nodes[parsedDirection.fragmentId]) {
          applyQuoteFragment(tree, parsedDirection.fragmentId, title);
          return;
        }
        const next = pickQuoteFragment(tree, quoteKnownRef.current, {}, dependencyThreshold, considerDependencies, currentCard.direction);
        applyQuoteFragment(tree, next?.id ?? null, title);
      });
    return () => {
      mounted = false;
    };
  }, [currentCard, copy, considerDependencies, dependencyThreshold]);

  useEffect(() => {
    if (!currentCard || currentCard.cardType !== 'vocab' || currentCard.checkType !== 'translation-match') {
      setMatchState(null);
      setMatchFeedback({});
      return;
    }
    const source =
      ((revisionMeta as { pool?: CogitaCardSearchResult[] }).pool) ??
      ((revisionMeta as { active?: CogitaCardSearchResult[] }).active) ??
      queue;
    const candidates = source.filter(
      (card) => card.cardType === 'vocab' && card.checkType === 'translation-match'
    );
    const unique = candidates.filter(
      (card, index, list) => list.findIndex((c) => c.cardId === card.cardId) === index
    );
    if (!unique.some((card) => card.cardId === currentCard.cardId)) {
      unique.unshift(currentCard);
    }
    const picked = shuffleList(unique).slice(0, 6);
    const pairs = picked
      .map((card) => {
        const parts = card.label.split('↔').map((part) => part.trim()).filter(Boolean);
        if (parts.length < 2) return null;
        const leftId = `${card.cardId}:L`;
        const rightId = `${card.cardId}:R`;
        return {
          cardId: card.cardId,
          leftId,
          rightId,
          leftLabel: parts[0],
          rightLabel: parts[1]
        };
      })
      .filter(Boolean) as Array<{
      cardId: string;
      leftId: string;
      rightId: string;
      leftLabel: string;
      rightLabel: string;
    }>;
    const leftOrder = pairs.map((pair) => pair.leftId);
    const rightOrder = shuffleList(pairs.map((pair) => pair.rightId));
    setMatchState({
      pairs,
      leftOrder,
      rightOrder,
      selection: {},
      activeLeft: null,
      activeRight: null,
      locked: {}
    });
  }, [currentCard, queue, revisionMeta]);

  useEffect(() => {
    return () => {
      if (matchFlashRef.current) window.clearTimeout(matchFlashRef.current);
      if (matchFlashResetRef.current) window.clearTimeout(matchFlashResetRef.current);
    };
  }, []);


  const lastFocusCardRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentCard) return;
    const focusKey = getCardKey(currentCard);
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (
      lastFocusCardRef.current === focusKey &&
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
              lastFocusCardRef.current = focusKey;
              return;
            }
          }
        }
        if (answerInputRef.current) {
          answerInputRef.current.focus();
          if (document.activeElement === answerInputRef.current) {
            lastFocusCardRef.current = focusKey;
            return;
          }
        }
      } else if (currentCard.cardType === 'vocab') {
        if (answerInputRef.current) {
          answerInputRef.current.focus();
          if (document.activeElement === answerInputRef.current) {
            lastFocusCardRef.current = focusKey;
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

  const setKnownessFromOutcomes = (outcomes: RevisionOutcomePayload[]) => {
    setReviewOutcomes(outcomes);
    setReviewSummary(computeKnowness(outcomes));
  };

  useEffect(() => {
    if (!currentCard) {
      setReviewSummary(null);
      setReviewOutcomes([]);
      return;
    }
    const itemType = currentCard.cardType === 'info' ? 'info' : 'connection';
    if (currentCard.cardType === 'info' && currentCard.infoType === 'citation') {
      getAllOutcomes()
        .then((outcomes) => {
          const filtered = outcomes.filter(
            (entry) =>
              entry.itemType === 'info' &&
              entry.itemId === currentCard.cardId &&
              entry.checkType === 'quote-fragment' &&
              matchesQuoteDirection(entry.direction, currentCard.direction)
          );
          setKnownessFromOutcomes(filtered);
        })
        .catch(() => {
          setReviewSummary(null);
          setReviewOutcomes([]);
        });
      return;
    }
    getOutcomesForItem(itemType, currentCard.cardId, currentCard.checkType, currentCard.direction)
      .then((outcomes) => setKnownessFromOutcomes(outcomes))
      .catch(() => {
        setReviewSummary(null);
        setReviewOutcomes([]);
      });
  }, [libraryId, currentCard, reviewer]);

  const refreshKnowness = (
    itemType: 'info' | 'connection',
    itemId: string,
    checkType?: string | null,
    direction?: string | null
  ) => {
    if (itemType === 'info' && checkType === 'quote-fragment') {
      void getAllOutcomes()
        .then((outcomes) => {
          const filtered = outcomes.filter(
            (entry) =>
              entry.itemType === 'info' &&
              entry.itemId === itemId &&
              entry.checkType === 'quote-fragment' &&
              matchesQuoteDirection(entry.direction, direction)
          );
          setKnownessFromOutcomes(filtered);
        })
        .catch(() => {
          setReviewSummary(null);
          setReviewOutcomes([]);
        });
      return;
    }
    void getOutcomesForItem(itemType, itemId, checkType, direction)
      .then((outcomes) => setKnownessFromOutcomes(outcomes))
      .catch(() => {
        setReviewSummary(null);
        setReviewOutcomes([]);
      });
  };

  const applyMatchSelection = (leftId: string, rightId: string, prev: NonNullable<typeof matchState>) => {
    const expected = prev.pairs.find((pair) => pair.leftId === leftId)?.rightId ?? null;
    if (!expected) return prev;
    const isCorrect = expected === rightId;
    setMatchFeedback((current) => ({
      ...current,
      [leftId]: isCorrect ? 'correct' : 'incorrect'
    }));
    if (matchFlashRef.current) window.clearTimeout(matchFlashRef.current);
    if (matchFlashResetRef.current) window.clearTimeout(matchFlashResetRef.current);
    matchFlashTickRef.current += 1;
    const nextFlash = { kind: isCorrect ? 'correct' : 'incorrect', tick: matchFlashTickRef.current };
    setMatchFlash(null);
    matchFlashRef.current = window.setTimeout(() => setMatchFlash(nextFlash), 0);
    matchFlashResetRef.current = window.setTimeout(() => setMatchFlash(null), 420);
    if (isCorrect) {
      const nextLocked = { ...prev.locked, [leftId]: true };
      if (Object.keys(nextLocked).length >= prev.pairs.length) {
        setFeedback('correct');
        setCanAdvance(true);
      } else {
        setFeedback('correct');
      }
      return {
        ...prev,
        selection: { ...prev.selection, [leftId]: rightId },
        activeLeft: null,
        activeRight: null,
        locked: nextLocked
      };
    }
    setFeedback('incorrect');
    return { ...prev, activeLeft: null, activeRight: null };
  };

  const handleMatchLeftSelect = (leftId: string) => {
    setMatchState((prev) => {
      if (!prev || prev.locked[leftId]) return prev;
      if (prev.activeRight) {
        return applyMatchSelection(leftId, prev.activeRight, prev);
      }
      return { ...prev, activeLeft: prev.activeLeft === leftId ? null : leftId };
    });
  };

  const handleMatchRightSelect = (rightId: string) => {
    setMatchState((prev) => {
      if (!prev) return prev;
      if (prev.activeLeft) {
        return applyMatchSelection(prev.activeLeft, rightId, prev);
      }
      return { ...prev, activeRight: prev.activeRight === rightId ? null : rightId };
    });
  };

  const advanceCard = () => {
    if (
      currentCard &&
      currentCard.cardType === 'info' &&
      currentCard.infoType === 'citation' &&
      quoteTreeRef.current &&
      quoteContext &&
      !parseQuoteFragmentDirection(currentCard.direction)?.fragmentId
    ) {
      const next = pickQuoteFragment(
        quoteTreeRef.current,
        quoteKnownRef.current,
        quoteKnownessRef.current,
        dependencyThreshold,
        considerDependencies,
        currentCard.direction,
        quoteContext.fragmentId
      );
      if (next) {
        setFeedback(null);
        setAnswer('');
        setShowCorrectAnswer(false);
        setComputedFieldFeedback({});
        setCanAdvance(false);
        setAnswerMask(null);
        setAttempts(0);
        applyQuoteFragment(quoteTreeRef.current, next.id, quoteContext.title);
        return;
      }
    }
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
    overrideCheckType?: string | null;
    overrideDirection?: string | null;
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
      values: computedValues ?? null,
      checkMode: check,
      compareMode,
      minCorrectness
    };
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const itemType = currentCard.cardType === 'info' ? 'info' : 'connection';
    const checkType = options.overrideCheckType ?? currentCard.checkType ?? null;
    const direction = options.overrideDirection ?? currentCard.direction ?? null;
    void recordOutcome({
      itemType,
      itemId: currentCard.cardId,
      checkType,
      direction,
      revisionType: revisionType.id,
      evalType: options.evalType,
      correct: options.correct,
      maskBase64: mask.length ? toBase64(mask) : null,
      payloadBase64: toBase64(payloadBytes),
      personRoleId: reviewer ?? null
    })
      .then(() => {
        refreshKnowness(itemType, currentCard.cardId, checkType, direction);
        void recomputeEligibility(queue);
        void syncPendingOutcomes(libraryId, reviewer);
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
    const promise = getCogitaInfoDetail({ libraryId, infoId })
      .then((detail) => {
        const payload = detail.payload as {
          definition?: { promptTemplate?: string; answerTemplate?: string; graph?: ComputedGraphDefinition | null };
        };
        const graph = payload.definition?.graph ?? null;
        const promptTemplate = '';
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
    const cacheKey = `${getCardKey(card)}:${index}`;
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
      if (card.checkType === 'translation-match') {
        promise = Promise.resolve(
          finalize({
            prompt: card.description || copy.cogita.library.revision.matchLabel,
            expectedAnswer: null,
            computedExpected: [],
            computedAnswers: {},
            computedValues: null,
            answerTemplate: null,
            outputVariables: null,
            variableValues: null
          })
        );
        return promise;
      }
      const parts = card.label.split('↔').map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const direction = card.direction ?? (Math.random() >= 0.5 ? 'a-to-b' : 'b-to-a');
        const pickFirst = direction !== 'b-to-a';
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
    } else if (card.cardType === 'info' && card.infoType === 'question') {
      promise = getCogitaInfoDetail({ libraryId, infoId: card.cardId })
        .then((detail) => {
          const root = (detail.payload ?? {}) as Record<string, unknown>;
          const rawDef = ((root.definition ?? root) as Record<string, unknown>) ?? {};
          const type = normalizeQuestionType(rawDef.type ?? rawDef.kind);
          const question =
            (typeof rawDef.question === 'string' && rawDef.question.trim() ? rawDef.question.trim() : null) ??
            (typeof rawDef.title === 'string' && rawDef.title.trim() ? rawDef.title.trim() : null) ??
            card.label;
          const answerValue = rawDef.answer;
          if (type === 'text' || type === 'number' || type === 'date') {
            return finalize({
              prompt: question,
              expectedAnswer: typeof answerValue === 'string' || typeof answerValue === 'number' ? String(answerValue) : null,
              computedExpected: [],
              computedAnswers: {},
              computedValues: null,
              answerTemplate: null,
              outputVariables: null,
              variableValues: null
            });
          }
          return finalize({
            prompt: question,
            expectedAnswer: null,
            computedExpected: [],
            computedAnswers: {},
            computedValues: null,
            answerTemplate: null,
            outputVariables: null,
            variableValues: null
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

  const applyQuoteFragment = (tree: QuoteFragmentTree, fragmentId: string | null, title: string) => {
    const total = Object.keys(tree.nodes).length;
    const completed = quoteKnownRef.current.size;
    if (!fragmentId) {
      setQuoteContext({
        title,
        before: tree.text,
        after: '',
        fragmentId: null,
        total,
        completed
      });
      setExpectedAnswer(null);
      setCanAdvance(true);
      return;
    }
    const fragment = tree.nodes[fragmentId];
    if (!fragment) return;
    const context = buildQuoteFragmentContext(tree.text, fragment);
    setQuoteContext({
      title,
      before: context.before,
      after: context.after,
      fragmentId: fragment.id,
      total,
      completed
    });
    setExpectedAnswer(context.fragment);
    setCanAdvance(false);
  };

  const refreshQuoteProgress = () => {
    const tree = quoteTreeRef.current;
    if (!tree) return;
    setQuoteContext((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        total: Object.keys(tree.nodes).length,
        completed: quoteKnownRef.current.size
      };
    });
  };

  const preloadNextCard = () => {
    const next = queue[currentIndex + 1];
    if (!next) return;
    void resolveCard(next, currentIndex + 1);
  };

  const handleCheckAnswer = () => {
    preloadNextCard();
    if (
      currentCard &&
      currentCard.cardType === 'vocab' &&
      currentCard.checkType === 'translation-match' &&
      matchState
    ) {
      if (matchState.pairs.length === 0) {
        setFeedback('incorrect');
        setCanAdvance(true);
        return;
      }
      const rightLabelById = matchState.pairs.reduce<Record<string, string>>((acc, pair) => {
        acc[pair.rightId] = pair.rightLabel;
        return acc;
      }, {});
      let correctCount = 0;
      const feedbackMap: Record<string, 'correct' | 'incorrect'> = {};
      matchState.pairs.forEach((pair) => {
        const selected = matchState.selection[pair.leftId];
        const isCorrect = selected === pair.rightId;
        feedbackMap[pair.leftId] = isCorrect ? 'correct' : 'incorrect';
        if (isCorrect) correctCount += 1;
      });
      const totalPairs = matchState.pairs.length || 1;
      const correctness = correctCount / totalPairs;
      const allCorrect = correctCount === matchState.pairs.length;
      setMatchFeedback((prev) => ({ ...prev, ...feedbackMap }));
      if (allCorrect) {
        setFeedback('correct');
        setCanAdvance(true);
        setAttempts(0);
      } else {
        setFeedback('incorrect');
        setCanAdvance(false);
        setAttempts((prev) => {
          const next = prev + 1;
          if (next >= maxTries) {
            setShowCorrectAnswer(true);
            setCanAdvance(true);
            setMatchState((prevState) => {
              if (!prevState) return prevState;
              const corrected = prevState.pairs.reduce<Record<string, string>>((acc, pair) => {
                acc[pair.leftId] = pair.rightId;
                return acc;
              }, {});
              return { ...prevState, selection: corrected };
            });
          }
          return next;
        });
      }
      applyOutcomeToSession(allCorrect, correctness);
      const itemType = 'connection';
      Promise.all(
        matchState.pairs.map((pair) => {
          const selected = matchState.selection[pair.leftId] ?? null;
          const answerLabel = selected ? rightLabelById[selected] : '';
          const payload = {
            left: pair.leftLabel,
            expected: pair.rightLabel,
            answer: answerLabel,
            checkType: 'translation-match'
          };
          const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
          return recordOutcome({
            itemType,
            itemId: pair.cardId,
            checkType: 'translation-match',
            direction: null,
            revisionType: revisionType.id,
            evalType: 'translation-match',
            correct: selected === pair.rightId,
            maskBase64: null,
            payloadBase64: toBase64(payloadBytes),
            personRoleId: reviewer ?? null
          });
        })
      )
        .then(() => {
          refreshKnowness(itemType, currentCard.cardId, currentCard.checkType, currentCard.direction);
          void syncPendingOutcomes(libraryId, reviewer);
        })
        .catch(() => {
          // local store may be unavailable
        });
      return;
    }
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
        applyOutcomeToSession(true, 1);
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
        applyOutcomeToSession(false, 0);
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
    if (currentCard && currentCard.cardType === 'info' && currentCard.infoType === 'citation' && quoteContext?.fragmentId) {
      if (!expectedAnswer) return;
      const parsedDirection = parseQuoteFragmentDirection(currentCard.direction);
      const outcomeDirection = parsedDirection?.fragmentId ?? quoteContext.fragmentId;
      const evaluated = evaluateAnchorTextAnswer(expectedAnswer, answer, {
        thresholdPercent: 90,
        treatSimilarCharsAsSame: true,
        ignorePunctuationAndSpacing: true
      });
      const mask = evaluated.mask;
      const isCorrect = evaluated.isCorrect;
      const maskPercent = evaluated.percent;
      if (isCorrect) {
        quoteKnownessRef.current[quoteContext.fragmentId] = Math.max(
          quoteKnownessRef.current[quoteContext.fragmentId] ?? 0,
          maskPercent
        );
        if ((quoteKnownessRef.current[quoteContext.fragmentId] ?? 0) >= dependencyThreshold) {
          quoteKnownRef.current.add(quoteContext.fragmentId);
        }
        refreshQuoteProgress();
        setFeedback('correct');
        setComputedFieldFeedback({});
        setCanAdvance(true);
        setAnswerMask(mask);
        setAttempts(0);
        if (maskPercent < 100 && maxTries <= 1) {
          setShowCorrectAnswer(true);
        }
        applyOutcomeToSession(true, maskPercent / 100);
        submitReview({
          correct: true,
          direction: `quote:${quoteContext.fragmentId}`,
          expected: expectedAnswer,
          answer,
          evalType: 'quote-fragment',
          overrideCheckType: 'quote-fragment',
          overrideDirection: outcomeDirection
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
        applyOutcomeToSession(false, maskPercent / 100);
        window.setTimeout(() => answerInputRef.current?.focus(), 40);
        submitReview({
          correct: false,
          direction: `quote:${quoteContext.fragmentId}`,
          expected: expectedAnswer,
          answer,
          evalType: 'quote-fragment',
          overrideCheckType: 'quote-fragment',
          overrideDirection: outcomeDirection
        });
      }
      return;
    }
    if (!expectedAnswer) return;
    const mask = compareStrings(expectedAnswer, answer, compareMode);
    const exactCorrect = check === 'exact' && normalizeAnswer(answer) === normalizeAnswer(expectedAnswer);
    const thresholdCorrect = isMaskCorrect(mask);
    const isCorrect = exactCorrect || thresholdCorrect;
    const maskPercent = maskAveragePercent(mask);
    if (isCorrect) {
      setFeedback('correct');
      setComputedFieldFeedback({});
      setCanAdvance(true);
      setAnswerMask(mask);
      setAttempts(0);
      if (maskPercent < 100 && maxTries <= 1) {
        setShowCorrectAnswer(true);
      }
      applyOutcomeToSession(true, maskPercent / 100);
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
      applyOutcomeToSession(false, maskPercent / 100);
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
    const maskPercent = maskAveragePercent(mask);
    if (isCorrect) {
      setFeedback('correct');
      setComputedFieldFeedback({});
      setCanAdvance(true);
      setAnswerMask(mask);
      setAttempts(0);
      if (maskPercent < 100 && maxTries <= 1) {
        setShowCorrectAnswer(true);
      }
      applyOutcomeToSession(true, maskPercent / 100);
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
      applyOutcomeToSession(false, maskPercent / 100);
      submitReview({ correct: false, direction: `word->language`, expected: expectedAnswer, answer: label, evalType: 'language-select' });
    }
  };

  const handleMarkReviewed = () => {
    preloadNextCard();
    setFeedback('correct');
    setCanAdvance(true);
    setAttempts(0);
    applyOutcomeToSession(true, 1);
    if (expectedAnswer) {
      submitReview({ correct: true, direction: 'manual', expected: expectedAnswer, answer, evalType: 'manual' });
    }
  };

  const handleSkip = () => {
    applyOutcomeToSession(false, 0);
    if (currentCard && currentCard.cardType === 'info' && currentCard.infoType === 'citation') {
      setFeedback(null);
      setAnswer('');
      setShowCorrectAnswer(false);
      setComputedFieldFeedback({});
      setCanAdvance(false);
      setAnswerMask(null);
      setAttempts(0);
      setCurrentIndex((prev) => Math.min(prev + 1, queue.length));
      return;
    }
    advanceCard();
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
      {(status === 'loading') && (
        <div className="cogita-revision-loading">
          <div className="cogita-revision-loading-card">
            <p className="cogita-user-kicker">{copy.cogita.library.revision.loading}</p>
            <div className="cogita-revision-loading-bar">
              <span
                style={{
                  width: `${
                    loadProgress.total
                      ? Math.min(100, Math.max(0, (loadProgress.current / loadProgress.total) * 100))
                      : 0
                  }%`
                }}
              />
            </div>
            <p className="cogita-revision-loading-meta">
              {loadProgress.total
                ? `${Math.min(loadProgress.current, loadProgress.total)} / ${loadProgress.total}`
                : copy.cogita.library.revision.loading}
            </p>
          </div>
        </div>
      )}
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
            {isCollectionScope ? (
              <>
                <a className="cta ghost" href={`${baseHref}/collections`}>
                  {copy.cogita.library.actions.collections}
                </a>
                <a className="cta ghost" href={`${baseHref}/collections/${effectiveCollectionId}`}>
                  {copy.cogita.library.actions.collectionDetail}
                </a>
              </>
            ) : (
              <a className="cta ghost" href={`${baseHref}/list`}>
                {copy.cogita.library.actions.allCards}
              </a>
            )}
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
                    <CogitaCardKnownessPanel outcomes={reviewOutcomes} />
                  </div>
                </section>
              </div>

              <div className="cogita-library-panel">
            {availabilityNotice ? (
              <div className="cogita-revision-body">
                <p className="cogita-revision-hint">{availabilityNotice}</p>
              </div>
            ) : null}
            <CogitaCheckcardSurface
              feedbackToken={
                matchFlash
                  ? `${matchFlash.kind}-${matchFlash.tick}`
                  : isMatchMode
                    ? 'idle'
                    : feedback
                      ? `${feedback}-${currentIndex}-${attempts}`
                      : 'idle'
              }
            >
              {currentCard ? (
                <>
                  {dependencyBlocked ? (
                    <div className="cogita-revision-body">
                      <p className="cogita-revision-hint">{copy.cogita.library.revision.dependenciesBlocked}</p>
                    </div>
                  ) : (
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
                      quoteContext={quoteContext}
                      quotePlaceholder={copy.cogita.library.revision.quoteMissingPlaceholder}
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
                      matchPairs={matchState?.pairs}
                      matchLeftOrder={matchState?.leftOrder}
                      matchRightOrder={matchState?.rightOrder}
                      matchSelection={matchState?.selection}
                      matchActiveLeft={matchState?.activeLeft}
                      matchActiveRight={matchState?.activeRight}
                      matchFeedback={matchFeedback}
                      onMatchLeftSelect={handleMatchLeftSelect}
                      onMatchRightSelect={handleMatchRightSelect}
                    />
                  )}
                </>
              ) : (
                <div className="cogita-card-empty">
                  <p>{copy.cogita.library.revision.completed}</p>
                  <div className="cogita-form-actions">
                    <a className="cta" href={isCollectionScope ? `${baseHref}/collections/${effectiveCollectionId}` : `${baseHref}/list`}>
                      {isCollectionScope ? copy.cogita.library.actions.collectionDetail : copy.cogita.library.actions.allCards}
                    </a>
                  </div>
                </div>
              )}
            </CogitaCheckcardSurface>
            <section className="cogita-revision-insights">
              <div className="cogita-revision-insight-grid">
                <div className="cogita-revision-insight-card">
                  <p className="cogita-user-kicker">{copy.cogita.library.revision.progressTitle}</p>
                  <h3 className="cogita-detail-title">
                    {progressTotal ? `${progressCurrent} / ${progressTotal}` : copy.cogita.library.revision.progressUnlimited}
                  </h3>
                  {status === 'loading' && <p>{copy.cogita.library.revision.loading}</p>}
                  {status === 'error' && <p>{copy.cogita.library.revision.error}</p>}
                  {status === 'ready' && queue.length === 0 && <p>{copy.cogita.library.revision.empty}</p>}
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
                    {levelStats.counts.map((count, index) => {
                      const levelNumber = index + 1;
                      const isActive = levelStats.currentLevel === levelNumber;
                      const percent = levelStats.percentages[index] ?? 0;
                      return (
                        <div key={`level-${levelNumber}`} className="cogita-revision-level-column" data-active={isActive}>
                          <div className="cogita-revision-level-head">
                            <span>{levelNumber}</span>
                            <strong>{count}</strong>
                          </div>
                          <div className="cogita-revision-level-bar">
                            <span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
                          </div>
                          <div className="cogita-revision-level-meta">{percent.toFixed(1)}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {temporalStats ? (
                <div className="cogita-revision-temporal">
                  <div className="cogita-revision-temporal-count">
                    <span>{copy.cogita.library.revision.temporalUnknownLabel}</span>
                    <strong>{temporalStats.unknownCount}</strong>
                  </div>
                  <div className="cogita-revision-temporal-dots">
                    {temporalStats.dots.map((dot) => (
                      <span
                        key={dot.id}
                        style={{
                          left: `${Math.min(100, Math.max(0, dot.value * 100))}%`,
                          background: `rgba(${Math.round(255 * (1 - dot.value))}, ${Math.round(200 * dot.value)}, 80, 0.9)`
                        }}
                      />
                    ))}
                  </div>
                  <div className="cogita-revision-temporal-count">
                    <span>{copy.cogita.library.revision.temporalKnownLabel}</span>
                    <strong>{temporalStats.knownCount}</strong>
                  </div>
                </div>
              ) : null}
              {considerDependencies ? (
                <div className="cogita-revision-temporal">
                  <div className="cogita-revision-temporal-count">
                    <span>Blocked cards</span>
                    <strong>{blockedCount}</strong>
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
