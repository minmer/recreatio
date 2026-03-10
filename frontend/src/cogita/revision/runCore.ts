export type RevisionRunMode = 'random' | 'random-once' | 'levels' | 'temporal' | 'full-stack';
export type LiveRunStage = 'lobby' | 'active' | 'finished';

export function normalizeRevisionRunMode(raw: string | null | undefined): RevisionRunMode {
  const mode = (raw ?? '').trim().toLowerCase();
  if (mode === 'random' || mode === 'random-once' || mode === 'levels' || mode === 'temporal' || mode === 'full-stack') {
    return mode;
  }
  return 'random';
}

export function computeStreakContribution(payload: {
  growthMode: string;
  streakBaseValue: number;
  streakCount: number;
  streakLimit: number;
}): number {
  const maxValue = Math.max(0, Math.round(Number(payload.streakBaseValue) || 0));
  const extraCount = Math.max(0, Math.round(Number(payload.streakCount) || 0) - 1);
  if (maxValue === 0 || extraCount === 0) {
    return 0;
  }

  const fullAfter = Math.max(1, Math.round(Number(payload.streakLimit) || 1));
  const progress = Math.max(0, Math.min(1, extraCount / fullAfter));
  const growthMode = (payload.growthMode || '').trim().toLowerCase();
  const scaled =
    growthMode === 'exponential' ? progress * progress : growthMode === 'limited' ? Math.min(1, progress * 1.6) : progress;
  return Math.max(0, Math.min(500000, Math.round(maxValue * scaled)));
}

export function orderRemainingIndexes(payload: {
  remainingIndexes: number[];
  seedKey: string;
  mode: string;
  knownessByIndex?: Record<number, number>;
}): number[] {
  const mode = normalizeRevisionRunMode(payload.mode);
  const list = Array.from(new Set(payload.remainingIndexes.filter((value) => Number.isInteger(value) && value >= 0)));

  if (mode === 'levels' || mode === 'temporal') {
    const knowness = payload.knownessByIndex ?? {};
    list.sort((left, right) => {
      const leftKnowness = Number(knowness[left] ?? 0);
      const rightKnowness = Number(knowness[right] ?? 0);
      if (leftKnowness !== rightKnowness) return leftKnowness - rightKnowness;
      return left - right;
    });
    return list;
  }

  let seed = 0;
  for (let i = 0; i < payload.seedKey.length; i += 1) {
    seed = (seed * 31 + payload.seedKey.charCodeAt(i)) >>> 0;
  }
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  for (let i = list.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(random() * (i + 1));
    [list[i], list[swapIndex]] = [list[swapIndex], list[i]];
  }

  return list;
}

export function selectNextCardIndex(payload: {
  mode: string;
  currentIndex: number;
  cardKeys: string[];
  askedCardKeys?: string[] | null;
  knownessByCardKey?: Record<string, number> | null;
  seedKey?: string;
}): number | null {
  const mode = normalizeRevisionRunMode(payload.mode);

  if (mode === 'levels' || mode === 'temporal') {
    const asked = new Set((payload.askedCardKeys ?? []).map((key) => String(key)));
    const candidates = payload.cardKeys
      .map((cardKey, index) => ({ cardKey, index }))
      .filter((item) => !asked.has(item.cardKey));
    if (candidates.length === 0) return null;

    const knownessByIndex: Record<number, number> = {};
    candidates.forEach((candidate) => {
      knownessByIndex[candidate.index] = Number(payload.knownessByCardKey?.[candidate.cardKey] ?? 0);
    });

    const ordered = orderRemainingIndexes({
      remainingIndexes: candidates.map((candidate) => candidate.index),
      seedKey: payload.seedKey ?? `${payload.cardKeys.length}:${mode}`,
      mode,
      knownessByIndex
    });
    return ordered[0] ?? null;
  }

  const candidateIndex = payload.currentIndex + 1;
  return candidateIndex >= 0 && candidateIndex < payload.cardKeys.length ? candidateIndex : null;
}

export function getLinearNextIndex(queueLength: number, currentIndex: number): number {
  const safeLength = Math.max(0, Math.trunc(queueLength));
  const candidateIndex = Math.max(0, Math.trunc(currentIndex) + 1);
  return candidateIndex < safeLength ? candidateIndex : safeLength;
}

export function applyRevisionOutcomeAndPrimeNext<TCard, TMeta, TSettings>(payload: {
  revisionType: {
    applyOutcome: (
      state: { queue: TCard[]; meta: TMeta },
      currentCard: TCard | null,
      limit: number,
      settings: TSettings,
      outcome: { correct: boolean; correctness?: number; createdUtc: string }
    ) => { queue: TCard[]; meta: TMeta };
  };
  queue: TCard[];
  meta: TMeta;
  currentCard: TCard | null;
  currentIndex: number;
  limit: number;
  settings: TSettings;
  correct: boolean;
  correctness?: number;
}): { queue: TCard[]; meta: TMeta; nextIndex: number; nextCard: TCard | null } {
  const nextState = payload.revisionType.applyOutcome(
    { queue: payload.queue, meta: payload.meta },
    payload.currentCard,
    payload.limit,
    payload.settings,
    { correct: payload.correct, correctness: payload.correctness, createdUtc: new Date().toISOString() }
  );
  const nextIndex = getLinearNextIndex(nextState.queue.length, payload.currentIndex);
  return {
    queue: nextState.queue,
    meta: nextState.meta,
    nextIndex,
    nextCard: nextState.queue[nextIndex] ?? null
  };
}

export function resolveDependencyFallback<TCard, TMeta>(payload: {
  currentCard: TCard | null;
  dependenciesEnabled: boolean;
  isInfoCard: (card: TCard) => boolean;
  isEligibleCard: (card: TCard) => boolean;
  queue: TCard[];
  currentIndex: number;
  nextEligibleIndexFrom: (startIndex: number) => number;
  fallbackModeEnabled: boolean;
  findFallbackCard: (excludeKeys: Set<string>) => TCard | null;
  getCardKey: (card: TCard) => string;
  meta: TMeta;
  addQueuedKeyToMeta: (meta: TMeta, key: string) => TMeta;
}): {
  dependencyBlocked: boolean;
  nextIndex: number | null;
  nextQueue: TCard[] | null;
  nextMeta: TMeta | null;
} {
  const currentCard = payload.currentCard;
  if (!currentCard || !payload.dependenciesEnabled) {
    return { dependencyBlocked: false, nextIndex: null, nextQueue: null, nextMeta: null };
  }
  if (!payload.isInfoCard(currentCard) || payload.isEligibleCard(currentCard)) {
    return { dependencyBlocked: false, nextIndex: null, nextQueue: null, nextMeta: null };
  }

  const nextEligibleIndex = payload.nextEligibleIndexFrom(payload.currentIndex + 1);
  if (nextEligibleIndex >= 0) {
    return { dependencyBlocked: false, nextIndex: nextEligibleIndex, nextQueue: null, nextMeta: null };
  }

  if (!payload.fallbackModeEnabled) {
    return { dependencyBlocked: true, nextIndex: null, nextQueue: null, nextMeta: null };
  }

  const preserved = payload.queue.slice(0, payload.currentIndex + 1);
  const futureEligible = payload.queue.slice(payload.currentIndex + 1).filter(payload.isEligibleCard);
  const nextQueue = preserved.concat(futureEligible);
  const existingKeys = new Set(nextQueue.map((card) => payload.getCardKey(card)));
  let nextMeta = payload.meta;
  const fallbackCard = payload.findFallbackCard(existingKeys);
  if (fallbackCard) {
    const fallbackKey = payload.getCardKey(fallbackCard);
    if (!existingKeys.has(fallbackKey)) {
      nextQueue.push(fallbackCard);
      existingKeys.add(fallbackKey);
      nextMeta = payload.addQueuedKeyToMeta(nextMeta, fallbackKey);
    }
  }

  const fallbackIndex = nextQueue.findIndex(
    (card, index) => index !== payload.currentIndex && payload.isEligibleCard(card)
  );
  if (fallbackIndex >= 0) {
    return { dependencyBlocked: false, nextIndex: fallbackIndex, nextQueue, nextMeta };
  }
  return { dependencyBlocked: true, nextIndex: null, nextQueue: null, nextMeta: null };
}

export function resolveLiveRunStage(payload: {
  status: string | null | undefined;
  sessionMode: string | null | undefined;
  hasParticipantToken: boolean;
}): LiveRunStage {
  const normalizedStatus = String(payload.status ?? '').trim().toLowerCase();
  if (normalizedStatus === 'finished' || normalizedStatus === 'closed') {
    return 'finished';
  }
  const isAsync = String(payload.sessionMode ?? '').trim().toLowerCase() === 'asynchronous';
  if (isAsync && payload.hasParticipantToken) {
    return 'active';
  }
  if (normalizedStatus && normalizedStatus !== 'lobby') {
    return 'active';
  }
  return 'lobby';
}
