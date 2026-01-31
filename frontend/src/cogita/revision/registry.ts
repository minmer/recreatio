import type { Copy } from '../../content/types';
import type { CogitaCardSearchResult } from '../../lib/api';

export type RevisionTypeId = 'random' | 'levels';
export type RevisionSettings = Record<string, number>;

export type RevisionSettingsField = {
  key: string;
  labelKey: keyof Copy['cogita']['library']['revision'];
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
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
};

const shuffle = <T,>(items: T[]) => {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
};

const pickNextLevelCard = (stack: CogitaCardSearchResult[], levelMap: Record<string, number>, currentId?: string | null) => {
  if (!stack.length) return null;
  let minLevel = Number.POSITIVE_INFINITY;
  for (const card of stack) {
    const level = levelMap[card.cardId] ?? 1;
    if (level < minLevel) minLevel = level;
  }
  const candidates = stack.filter((card) => (levelMap[card.cardId] ?? 1) === minLevel);
  if (candidates.length === 0) return stack[0] ?? null;
  return candidates.find((card) => card.cardId !== currentId) ?? candidates[0] ?? null;
};

const randomType: RevisionTypeDefinition = {
  id: 'random',
  labelKey: 'modeValue',
  defaultSettings: {},
  settingsFields: [],
  getFetchLimit: (limit) => limit,
  prepare: (cards, limit) => {
    const ordered = shuffle(cards);
    let expanded: CogitaCardSearchResult[] = [];
    if (ordered.length > 0) {
      while (expanded.length < limit) {
        const nextBatch = shuffle(ordered);
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
    return { queue: expanded, meta: {} };
  },
  applyOutcome: (state) => state
};

const levelsType: RevisionTypeDefinition = {
  id: 'levels',
  labelKey: 'modeValueLevels',
  defaultSettings: { levels: 5, stackSize: 20 },
  settingsFields: [
    { key: 'levels', labelKey: 'levelsLabel', type: 'number', min: 1, max: 20, step: 1 },
    { key: 'stackSize', labelKey: 'stackLabel', type: 'number', min: 1, max: 200, step: 1 }
  ],
  getFetchLimit: (limit, settings) => Math.max(1, settings.stackSize ?? limit),
  prepare: (cards, limit, settings) => {
    const stackSize = Math.max(1, settings.stackSize ?? limit);
    const stack = cards.slice(0, stackSize);
    const levelMap: Record<string, number> = {};
    stack.forEach((card) => {
      levelMap[card.cardId] = 1;
    });
    const first = pickNextLevelCard(stack, levelMap, null);
    return {
      queue: first ? [first] : [],
      meta: {
        stack,
        levelMap
      }
    };
  },
  applyOutcome: (state, currentCard, limit, settings, outcome) => {
    if (!currentCard) return state;
    const levels = Math.max(1, settings.levels ?? 1);
    const stack = (state.meta.stack as CogitaCardSearchResult[]) ?? [];
    const levelMap = { ...(state.meta.levelMap as Record<string, number> ?? {}) };
    const currentLevel = levelMap[currentCard.cardId] ?? 1;
    levelMap[currentCard.cardId] = outcome.correct ? Math.min(currentLevel + 1, levels) : 1;
    const queue = state.queue.slice();
    if (queue.length < limit) {
      const next = pickNextLevelCard(stack, levelMap, currentCard.cardId);
      if (next) {
        queue.push(next);
      }
    }
    return { queue, meta: { stack, levelMap } };
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
    });
  }
  type.settingsFields.forEach((field) => {
    const value = merged[field.key];
    if (typeof value !== 'number' || Number.isNaN(value)) {
      merged[field.key] = type.defaultSettings[field.key] ?? 0;
      return;
    }
    if (field.min !== undefined) merged[field.key] = Math.max(field.min, merged[field.key]);
    if (field.max !== undefined) merged[field.key] = Math.min(field.max, merged[field.key]);
  });
  return merged;
};

export const parseRevisionSettingsFromParams = (type: RevisionTypeDefinition, params: URLSearchParams) => {
  const settings: RevisionSettings = {};
  type.settingsFields.forEach((field) => {
    const raw = params.get(field.key);
    if (!raw) return;
    const value = Number(raw);
    if (!Number.isNaN(value)) {
      settings[field.key] = value;
    }
  });
  return normalizeRevisionSettings(type, settings);
};

export const settingsToQueryParams = (type: RevisionTypeDefinition, settings: RevisionSettings) => {
  const params = new URLSearchParams();
  type.settingsFields.forEach((field) => {
    const value = settings[field.key];
    if (typeof value === 'number') {
      params.set(field.key, String(value));
    }
  });
  return params;
};
