import type { Copy } from '../../content/types';
import type { CogitaCardSearchResult } from '../../lib/api';
import { computeTemporalKnowness, type TemporalEntry } from './knowness';
import { getCardKey } from './cards';

export type RevisionTypeId = 'random' | 'levels' | 'temporal';
export type RevisionSettings = Record<string, number | string>;

export type RevisionSettingsField = {
  key: string;
  labelKey: keyof Copy['cogita']['library']['revision'];
  type: 'number' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; labelKey: keyof Copy['cogita']['library']['revision'] }>;
};

export type RevisionState = {
  queue: CogitaCardSearchResult[];
  meta: Record<string, unknown>;
};

export type RevisionOutcome = {
  correct: boolean;
  correctness?: number;
  createdUtc?: string;
};

export type RevisionTypeDefinition = {
  id: RevisionTypeId;
  labelKey: keyof Copy['cogita']['library']['revision'];
  defaultSettings: RevisionSettings;
  settingsFields: RevisionSettingsField[];
  getFetchLimit: (limit: number, settings: RevisionSettings) => number;
  prepare: (cards: CogitaCardSearchResult[], limit: number, settings: RevisionSettings) => RevisionState;
  applyOutcome: (
    state: RevisionState,
    currentCard: CogitaCardSearchResult | null,
    limit: number,
    settings: RevisionSettings,
    outcome: RevisionOutcome
  ) => RevisionState;
  getProgressTotal?: (
    queue: CogitaCardSearchResult[],
    meta: Record<string, unknown>,
    limit: number,
    settings: RevisionSettings
  ) => number | null;
};

const shuffle = <T,>(items: T[]) => {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
};

const expandComputedCards = (cards: CogitaCardSearchResult[]) =>
  cards.flatMap((card) => {
    if (card.infoType !== 'computed') return [card];
    const count = Math.max(1, Math.round(card.count ?? 1));
    if (count <= 1) return [card];
    return Array.from({ length: count }, () => ({ ...card }));
  });

const pickRandom = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const randomTie = <T,>(items: T[], score: (item: T) => number) => {
  const weights = new Map<T, number>();
  items.forEach((item) => weights.set(item, Math.random()));
  return items.sort((a, b) => {
    const diff = score(a) - score(b);
    if (diff !== 0) return diff;
    return (weights.get(a) ?? 0) - (weights.get(b) ?? 0);
  });
};

const pickNextLevelCard = (
  stack: CogitaCardSearchResult[],
  _levelMap: Record<string, number>,
  currentKey?: string | null,
  _asked?: Set<string>,
  queued?: Set<string>
) => {
  if (!stack.length) return null;
  const available = stack.filter((card) => !queued?.has(getCardKey(card)));
  if (available.length === 0) return null;
  const filtered = available.filter((card) => getCardKey(card) !== currentKey);
  return pickRandom(filtered.length ? filtered : available);
};

const pickLowestFromPool = (
  pool: CogitaCardSearchResult[],
  levelMap: Record<string, number>,
  exclude: Set<string>,
  asked?: Set<string>,
  currentKey?: string | null
) => {
  if (!pool.length) return null;
  let minLevel = Number.POSITIVE_INFINITY;
  for (const card of pool) {
    const cardKey = getCardKey(card);
    if (exclude.has(cardKey)) continue;
    const level = levelMap[cardKey] ?? 1;
    if (level < minLevel) minLevel = level;
  }
  if (!Number.isFinite(minLevel)) return null;
  const candidates = pool.filter((card) => {
    const cardKey = getCardKey(card);
    return !exclude.has(cardKey) && (levelMap[cardKey] ?? 1) === minLevel;
  });
  const withoutCurrent = candidates.filter((card) => !currentKey || getCardKey(card) !== currentKey);
  const fresh = asked ? withoutCurrent.filter((card) => !asked.has(getCardKey(card))) : withoutCurrent;
  if (fresh.length > 0) return pickRandom(fresh);
  if (withoutCurrent.length > 0) return pickRandom(withoutCurrent);
  if (currentKey && candidates.some((card) => getCardKey(card) === currentKey)) {
    return candidates.find((card) => getCardKey(card) === currentKey) ?? null;
  }
  return candidates.length ? pickRandom(candidates) : null;
};

const fillTemporalActiveStack = (
  pool: CogitaCardSearchResult[],
  knownessMap: Record<string, number>,
  unknownSet: Set<string>,
  stackSize: number,
  excludeIds: Set<string>
) => {
  const active: CogitaCardSearchResult[] = [];
  const underOne = pool.filter(
    (card) =>
      !excludeIds.has(getCardKey(card)) &&
      !unknownSet.has(getCardKey(card)) &&
      (knownessMap[getCardKey(card)] ?? 0) < 1
  );
  const sortedUnderOne = randomTie(underOne, (card) => knownessMap[getCardKey(card)] ?? 0);
  for (const card of sortedUnderOne) {
    if (active.length >= stackSize) break;
    active.push(card);
    excludeIds.add(getCardKey(card));
  }
  if (active.length < stackSize) {
    const unknownCards = shuffle(
      pool.filter((card) => !excludeIds.has(getCardKey(card)) && unknownSet.has(getCardKey(card)))
    );
    for (const card of unknownCards) {
      if (active.length >= stackSize) break;
      active.push(card);
      excludeIds.add(getCardKey(card));
    }
  }
  return active;
};

const buildTemporalActiveStack = (
  pool: CogitaCardSearchResult[],
  knownessMap: Record<string, number>,
  unknownSet: Set<string>,
  stackSize: number
) => {
  return fillTemporalActiveStack(pool, knownessMap, unknownSet, stackSize, new Set<string>());
};

export const prepareTemporalState = (
  cards: CogitaCardSearchResult[],
  limit: number,
  settings: RevisionSettings,
  knownessMap: Record<string, number>,
  unknownSet: Set<string>,
  outcomesById: Record<string, TemporalEntry[]>
): RevisionState => {
  const stackSize = Math.max(1, settings.stackSize ?? limit);
  const ordered = shuffle(expandComputedCards(cards));
  const pool = ordered;
  const active = buildTemporalActiveStack(pool, knownessMap, unknownSet, stackSize);
  const asked = new Set<string>();
  const queued = new Set<string>();
  const first = pickNextLevelCard(active, {}, null, asked, queued);
  const queue = first ? [first] : [];
  if (first) queued.add(getCardKey(first));
  return {
    queue,
    meta: {
      pool,
      active,
      knownessMap,
      unknownSet,
      outcomesById,
      asked,
      queued
    }
  };
};

const randomType: RevisionTypeDefinition = {
  id: 'random',
  labelKey: 'modeValue',
  defaultSettings: { tries: 2, compare: 'bidirectional', minCorrectness: 70 },
  settingsFields: [
    { key: 'tries', labelKey: 'triesLabel', type: 'number', min: 1, max: 10, step: 1 },
    { key: 'minCorrectness', labelKey: 'minCorrectnessLabel', type: 'number', min: 0, max: 100, step: 1 },
    {
      key: 'compare',
      labelKey: 'compareLabel',
      type: 'select',
      options: [
        { value: 'bidirectional', labelKey: 'compareBidirectional' },
        { value: 'prefix', labelKey: 'comparePrefix' },
        { value: 'anchors', labelKey: 'compareAnchors' }
      ]
    }
  ],
  getFetchLimit: (limit) => limit,
  prepare: (cards, limit) => {
    const expanded = shuffle(expandComputedCards(cards));
    return { queue: expanded.slice(0, Math.min(limit, expanded.length)), meta: {} };
  },
  applyOutcome: (state) => state
};

export const prepareLevelsState = (
  cards: CogitaCardSearchResult[],
  limit: number,
  settings: RevisionSettings,
  initialLevels?: Record<string, number>
): RevisionState => {
  const stackSize = Math.max(1, settings.stackSize ?? limit);
  const ordered = shuffle(expandComputedCards(cards));
  const pool = ordered;
  const levelMap: Record<string, number> = {};
  const asked = new Set<string>();
  const queued = new Set<string>();
  const wrongSinceCorrect = new Set<string>();
  const maxLevel = Math.max(1, settings.levels ?? 1);
  pool.forEach((card) => {
    const cardKey = getCardKey(card);
    const seeded = initialLevels?.[cardKey];
    const level = typeof seeded === 'number' && Number.isFinite(seeded) ? seeded : 1;
    levelMap[cardKey] = Math.min(maxLevel, Math.max(1, Math.round(level)));
  });
  const stack: CogitaCardSearchResult[] = [];
  if (pool.length > 0) {
    const byLevel = new Map<number, CogitaCardSearchResult[]>();
    pool.forEach((card) => {
      const level = levelMap[getCardKey(card)] ?? 1;
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level)?.push(card);
    });
    const levels = Array.from(byLevel.keys()).sort((a, b) => a - b);
    for (const level of levels) {
      if (stack.length >= stackSize) break;
      const candidates = shuffle(byLevel.get(level) ?? []);
      for (const card of candidates) {
        if (stack.length >= stackSize) break;
        stack.push(card);
      }
    }
  }
  const first = pickNextLevelCard(stack, levelMap, null, asked, queued);
  const queue = first ? [first] : [];
  if (first) queued.add(getCardKey(first));
  return {
    queue,
    meta: {
      pool,
      active: stack,
      levelMap,
      asked,
      queued,
      wrongSinceCorrect
    }
  };
};

const levelsType: RevisionTypeDefinition = {
  id: 'levels',
  labelKey: 'modeValueLevels',
  defaultSettings: { levels: 5, stackSize: 20, tries: 2, compare: 'bidirectional', minCorrectness: 70 },
  settingsFields: [
    { key: 'levels', labelKey: 'levelsLabel', type: 'number', min: 1, max: 20, step: 1 },
    { key: 'stackSize', labelKey: 'stackLabel', type: 'number', min: 1, max: 200, step: 1 },
    { key: 'tries', labelKey: 'triesLabel', type: 'number', min: 1, max: 10, step: 1 },
    { key: 'minCorrectness', labelKey: 'minCorrectnessLabel', type: 'number', min: 0, max: 100, step: 1 },
    {
      key: 'compare',
      labelKey: 'compareLabel',
      type: 'select',
      options: [
        { value: 'bidirectional', labelKey: 'compareBidirectional' },
        { value: 'prefix', labelKey: 'comparePrefix' },
        { value: 'anchors', labelKey: 'compareAnchors' }
      ]
    }
  ],
  getFetchLimit: (limit, settings) => Math.max(1, settings.stackSize ?? limit),
  getProgressTotal: () => null,
  prepare: (cards, limit, settings) => prepareLevelsState(cards, limit, settings),
  applyOutcome: (state, currentCard, limit, settings, outcome) => {
    if (!currentCard) return state;
    const levels = Math.max(1, settings.levels ?? 1);
    const pool = (state.meta.pool as CogitaCardSearchResult[]) ?? [];
    const active = (state.meta.active as CogitaCardSearchResult[]) ?? [];
    const levelMap = { ...(state.meta.levelMap as Record<string, number> ?? {}) };
    const asked = new Set<string>(state.meta.asked as Set<string> ?? []);
    const queued = new Set<string>(state.meta.queued as Set<string> ?? []);
    const wrongSinceCorrect = new Set<string>(state.meta.wrongSinceCorrect as Set<string> ?? []);
    const currentKey = getCardKey(currentCard);
    queued.delete(currentKey);
    asked.add(currentKey);
    const currentLevel = levelMap[currentKey] ?? 1;
    if (outcome.correct) {
      levelMap[currentKey] = wrongSinceCorrect.has(currentKey) ? 1 : Math.min(currentLevel + 1, levels);
      wrongSinceCorrect.delete(currentKey);
    } else {
      levelMap[currentKey] = 1;
      wrongSinceCorrect.add(currentKey);
    }
    const nextActive = outcome.correct ? active.filter((card) => getCardKey(card) !== currentKey) : active.slice();
    if (outcome.correct && nextActive.length < Math.max(1, settings.stackSize ?? 1)) {
      const exclude = new Set(nextActive.map((card) => getCardKey(card)));
      const replacement = pickLowestFromPool(pool, levelMap, exclude, asked, currentKey);
      if (replacement) {
        nextActive.push(replacement);
      }
    }
    const queue = state.queue.slice();
    if (queue.length < limit) {
      const next = pickNextLevelCard(nextActive, levelMap, currentKey, asked, queued);
      if (next) {
        queue.push(next);
        queued.add(getCardKey(next));
      }
    }
    return { queue, meta: { pool, active: nextActive, levelMap, asked, queued, wrongSinceCorrect } };
  }
};

const temporalType: RevisionTypeDefinition = {
  id: 'temporal',
  labelKey: 'modeValueTemporal',
  defaultSettings: { stackSize: 20, tries: 2, compare: 'bidirectional', minCorrectness: 70 },
  settingsFields: [
    { key: 'stackSize', labelKey: 'stackLabel', type: 'number', min: 1, max: 200, step: 1 },
    { key: 'tries', labelKey: 'triesLabel', type: 'number', min: 1, max: 10, step: 1 },
    {
      key: 'compare',
      labelKey: 'compareLabel',
      type: 'select',
      options: [
        { value: 'bidirectional', labelKey: 'compareBidirectional' },
        { value: 'prefix', labelKey: 'comparePrefix' },
        { value: 'anchors', labelKey: 'compareAnchors' }
      ]
    }
  ],
  getFetchLimit: (limit, settings) => Math.max(1, settings.stackSize ?? limit),
  getProgressTotal: () => null,
  prepare: (cards, limit, settings) =>
    prepareTemporalState(cards, limit, settings, {}, new Set<string>(), {}),
  applyOutcome: (state, currentCard, limit, settings, outcome) => {
    if (!currentCard) return state;
    const pool = (state.meta.pool as CogitaCardSearchResult[]) ?? [];
    const active = (state.meta.active as CogitaCardSearchResult[]) ?? [];
    const knownessMap = { ...(state.meta.knownessMap as Record<string, number> ?? {}) };
    const unknownSet = new Set<string>(state.meta.unknownSet as Set<string> ?? []);
    const outcomesById = { ...(state.meta.outcomesById as Record<string, TemporalEntry[]> ?? {}) };
    const asked = new Set<string>(state.meta.asked as Set<string> ?? []);
    const queued = new Set<string>(state.meta.queued as Set<string> ?? []);
    const currentKey = getCardKey(currentCard);
    queued.delete(currentKey);
    asked.add(currentKey);

    const entry: TemporalEntry = {
      correctness: Math.max(0, Math.min(1, outcome.correctness ?? (outcome.correct ? 1 : 0))),
      createdUtc: outcome.createdUtc ?? new Date().toISOString()
    };
    const existing = outcomesById[currentKey] ?? [];
    const nextEntries = existing.concat(entry).sort((a, b) => a.createdUtc.localeCompare(b.createdUtc)).slice(-5);
    outcomesById[currentKey] = nextEntries;
    unknownSet.delete(currentKey);

    const nowMs = Date.now();
    pool.forEach((card) => {
      const cardKey = getCardKey(card);
      const entries = outcomesById[cardKey] ?? [];
      if (entries.length === 0) {
        knownessMap[cardKey] = 0;
        unknownSet.add(cardKey);
        return;
      }
      const summary = computeTemporalKnowness(entries, nowMs);
      knownessMap[cardKey] = summary.knowness;
    });

    const nextActive = active.slice();
    const currentKnowness = knownessMap[currentKey] ?? 0;
    if (currentKnowness >= 1) {
      const filtered = nextActive.filter((card) => getCardKey(card) !== currentKey);
      nextActive.length = 0;
      nextActive.push(...filtered);
    }
    const stackSize = Math.max(1, settings.stackSize ?? limit);
    if (nextActive.length < stackSize) {
      const activeIds = new Set(nextActive.map((card) => getCardKey(card)));
      const fill = fillTemporalActiveStack(pool, knownessMap, unknownSet, stackSize - nextActive.length, activeIds);
      nextActive.push(...fill);
    }

    const queue = state.queue.slice();
    if (queue.length === 0 || getCardKey(queue[queue.length - 1]) === currentKey) {
      const next = pickNextLevelCard(nextActive, {}, currentKey, asked, queued);
      if (next) {
        queue.push(next);
        queued.add(getCardKey(next));
      }
    }

    return { queue, meta: { pool, active: nextActive, knownessMap, unknownSet, outcomesById, asked, queued } };
  }
};

const registry: Record<RevisionTypeId, RevisionTypeDefinition> = {
  random: randomType,
  levels: levelsType,
  temporal: temporalType
};

export const revisionTypes = Object.values(registry);

export const getRevisionType = (id: string | null | undefined): RevisionTypeDefinition => {
  if (!id) return randomType;
  const normalized = id.trim().toLowerCase();
  if (normalized === 'random' || normalized === 'levels' || normalized === 'temporal') return registry[normalized];
  return randomType;
};

export const normalizeRevisionSettings = (type: RevisionTypeDefinition, settings: RevisionSettings | null | undefined) => {
  const merged: RevisionSettings = { ...type.defaultSettings };
  if (settings) {
    Object.entries(settings).forEach(([key, value]) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        merged[key] = value;
      }
      if (typeof value === 'string') {
        merged[key] = value;
      }
    });
  }
  type.settingsFields.forEach((field) => {
    const value = merged[field.key];
    if (field.type === 'number') {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        merged[field.key] = type.defaultSettings[field.key] ?? 0;
        return;
      }
      if (field.min !== undefined) merged[field.key] = Math.max(field.min, merged[field.key] as number);
      if (field.max !== undefined) merged[field.key] = Math.min(field.max, merged[field.key] as number);
      return;
    }
    if (field.type === 'select') {
      const options = field.options?.map((opt) => opt.value) ?? [];
      if (typeof value !== 'string' || (options.length > 0 && !options.includes(value))) {
        merged[field.key] = type.defaultSettings[field.key] ?? options[0] ?? '';
      }
    }
  });
  return merged;
};

export const parseRevisionSettingsFromParams = (type: RevisionTypeDefinition, params: URLSearchParams) => {
  const settings: RevisionSettings = {};
  type.settingsFields.forEach((field) => {
    const raw = params.get(field.key);
    if (!raw) return;
    if (field.type === 'number') {
      const value = Number(raw);
      if (!Number.isNaN(value)) {
        settings[field.key] = value;
      }
      return;
    }
    settings[field.key] = raw;
  });
  return normalizeRevisionSettings(type, settings);
};

export const settingsToQueryParams = (type: RevisionTypeDefinition, settings: RevisionSettings) => {
  const params = new URLSearchParams();
  type.settingsFields.forEach((field) => {
    const value = settings[field.key];
    if (typeof value === 'number' || typeof value === 'string') {
      params.set(field.key, String(value));
    }
  });
  return params;
};
