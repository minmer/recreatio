import type { Copy } from '../../content/types';
import type { CogitaCardSearchResult } from '../../lib/api';

export type RevisionTypeId = 'random' | 'levels';
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

const pickRandom = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const pickNextLevelCard = (
  stack: CogitaCardSearchResult[],
  _levelMap: Record<string, number>,
  currentId?: string | null,
  _asked?: Set<string>,
  queued?: Set<string>
) => {
  if (!stack.length) return null;
  const available = stack.filter((card) => !queued?.has(card.cardId));
  if (available.length === 0) return null;
  const filtered = available.filter((card) => card.cardId !== currentId);
  return pickRandom(filtered.length ? filtered : available);
};

const pickLowestFromPool = (
  pool: CogitaCardSearchResult[],
  levelMap: Record<string, number>,
  exclude: Set<string>,
  asked?: Set<string>,
  currentId?: string | null
) => {
  if (!pool.length) return null;
  let minLevel = Number.POSITIVE_INFINITY;
  for (const card of pool) {
    if (exclude.has(card.cardId)) continue;
    const level = levelMap[card.cardId] ?? 1;
    if (level < minLevel) minLevel = level;
  }
  if (!Number.isFinite(minLevel)) return null;
  const candidates = pool.filter((card) => !exclude.has(card.cardId) && (levelMap[card.cardId] ?? 1) === minLevel);
  const withoutCurrent = candidates.filter((card) => !currentId || card.cardId !== currentId);
  const fresh = asked ? withoutCurrent.filter((card) => !asked.has(card.cardId)) : withoutCurrent;
  if (fresh.length > 0) return pickRandom(fresh);
  if (withoutCurrent.length > 0) return pickRandom(withoutCurrent);
  if (currentId && candidates.some((card) => card.cardId === currentId)) {
    return candidates.find((card) => card.cardId === currentId) ?? null;
  }
  return candidates.length ? pickRandom(candidates) : null;
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
    const ordered = shuffle(cards);
    const unique = ordered.filter((card, index, list) => list.findIndex((c) => c.cardId === card.cardId) === index);
    return { queue: unique.slice(0, Math.min(limit, unique.length)), meta: {} };
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
  const ordered = shuffle(cards);
  const pool = ordered.filter((card, index, list) => list.findIndex((c) => c.cardId === card.cardId) === index);
  const levelMap: Record<string, number> = {};
  const asked = new Set<string>();
  const queued = new Set<string>();
  const wrongSinceCorrect = new Set<string>();
  const maxLevel = Math.max(1, settings.levels ?? 1);
  pool.forEach((card) => {
    const seeded = initialLevels?.[card.cardId];
    const level = typeof seeded === 'number' && Number.isFinite(seeded) ? seeded : 1;
    levelMap[card.cardId] = Math.min(maxLevel, Math.max(1, Math.round(level)));
  });
  const stack: CogitaCardSearchResult[] = [];
  if (pool.length > 0) {
    const byLevel = new Map<number, CogitaCardSearchResult[]>();
    pool.forEach((card) => {
      const level = levelMap[card.cardId] ?? 1;
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
  if (first) queued.add(first.cardId);
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
  getFetchLimit: () => Number.MAX_SAFE_INTEGER,
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
    queued.delete(currentCard.cardId);
    asked.add(currentCard.cardId);
    const currentLevel = levelMap[currentCard.cardId] ?? 1;
    if (outcome.correct) {
      levelMap[currentCard.cardId] = wrongSinceCorrect.has(currentCard.cardId) ? 1 : Math.min(currentLevel + 1, levels);
      wrongSinceCorrect.delete(currentCard.cardId);
    } else {
      levelMap[currentCard.cardId] = 1;
      wrongSinceCorrect.add(currentCard.cardId);
    }
    const nextActive = outcome.correct ? active.filter((card) => card.cardId !== currentCard.cardId) : active.slice();
    if (outcome.correct && nextActive.length < Math.max(1, settings.stackSize ?? 1)) {
      const exclude = new Set(nextActive.map((card) => card.cardId));
      const replacement = pickLowestFromPool(pool, levelMap, exclude, asked, currentCard.cardId);
      if (replacement) {
        nextActive.push(replacement);
      }
    }
    const queue = state.queue.slice();
    if (queue.length < limit) {
      const next = pickNextLevelCard(nextActive, levelMap, currentCard.cardId, asked, queued);
      if (next) {
        queue.push(next);
        queued.add(next.cardId);
      }
    }
    return { queue, meta: { pool, active: nextActive, levelMap, asked, queued, wrongSinceCorrect } };
  }
};

const registry: Record<RevisionTypeId, RevisionTypeDefinition> = {
  random: randomType,
  levels: levelsType
};

export const revisionTypes = Object.values(registry);

export const getRevisionType = (id: string | null | undefined): RevisionTypeDefinition => {
  if (!id) return randomType;
  const normalized = id.trim().toLowerCase();
  if (normalized === 'random' || normalized === 'levels') return registry[normalized];
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
