import type { CogitaCardSearchResult, CogitaItemDependency } from '../../../../lib/api';
import { buildQuoteFragmentTree } from '../../../../cogita/revision/quote';

export const normalizeAnswer = (value: string) => value.trim().toLowerCase();
export const getQuoteMode = (direction?: string | null) => (direction === 'reverse' ? 'reverse' : 'forward');
export const buildQuoteFragmentDirection = (mode: 'forward' | 'reverse', fragmentId: string) => `${mode}|${fragmentId}`;

export const parseQuoteFragmentDirection = (direction?: string | null) => {
  if (!direction) return null;
  const [mode, fragmentId] = direction.split('|', 2);
  if ((mode === 'forward' || mode === 'reverse') && fragmentId) {
    return { mode, fragmentId };
  }
  return { mode: 'forward' as const, fragmentId: direction };
};

export const matchesQuoteDirection = (entryDirection: string | null | undefined, currentDirection?: string | null) => {
  const current = parseQuoteFragmentDirection(currentDirection);
  if (!current) return true;
  if (current.fragmentId && currentDirection) {
    return (entryDirection ?? null) === currentDirection;
  }
  return (parseQuoteFragmentDirection(entryDirection)?.mode ?? 'forward') === current.mode;
};

export const normalizeDependencyToken = (value?: string | null) => {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
};

export const matchesDependencyChild = (dep: CogitaItemDependency, card: CogitaCardSearchResult) => {
  const childType = normalizeDependencyToken(dep.childItemType) ?? 'info';
  if (childType !== (card.cardType ?? '').toLowerCase()) return false;
  if (dep.childItemId !== card.cardId) return false;
  const childCheckType = normalizeDependencyToken(dep.childCheckType);
  const childDirection = normalizeDependencyToken(dep.childDirection);
  const cardCheckType = normalizeDependencyToken(card.checkType);
  const cardDirection = normalizeDependencyToken(card.direction);
  if (childCheckType && childCheckType !== cardCheckType) return false;
  if (childDirection && childDirection !== cardDirection) return false;
  return true;
};

export const SUPERSCRIPT_MAP: Record<string, string> = {
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

export const SUBSCRIPT_MAP: Record<string, string> = {
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

export const applyScriptMode = (prev: string, next: string, mode: 'super' | 'sub' | null) => {
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

export const getFirstComputedInputKey = (
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

export const expandQuoteDirectionCards = (cards: CogitaCardSearchResult[]) =>
  cards.flatMap((card) => {
    if (card.cardType !== 'info' || card.infoType !== 'citation') return [card];
    const text = card.description ?? '';
    if (!text.trim()) return [card];
    const parsed = parseQuoteFragmentDirection(card.direction);
    const mode = parsed?.mode ?? getQuoteMode(card.direction);
    const tree = buildQuoteFragmentTree(text);
    const nodeIds = Object.keys(tree.nodes);
    if (nodeIds.length === 0) return [card];
    return nodeIds.map((nodeId) => ({
      ...card,
      checkType: 'quote-fragment',
      direction: buildQuoteFragmentDirection(mode, nodeId)
    }));
  });
