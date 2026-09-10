export type QuoteFragmentNode = {
  id: string;
  start: number;
  end: number;
  text: string;
  depth: number;
  index: number;
  parentId?: string;
  leftId?: string;
  rightId?: string;
};

export type QuoteFragmentTree = {
  text: string;
  rootId: string;
  nodes: Record<string, QuoteFragmentNode>;
  order: string[];
};

const isWhitespace = (char: string) => /\s/.test(char);
const isWordChar = (char: string) => /[\p{L}\p{N}]/u.test(char);

const boundaryScore = (text: string, splitIndex: number) => {
  const left = splitIndex > 0 ? text[splitIndex - 1] : '';
  const right = splitIndex < text.length ? text[splitIndex] : '';
  if (!left || !right) return 0;

  const leftWhitespace = isWhitespace(left);
  const rightWhitespace = isWhitespace(right);
  if (leftWhitespace || rightWhitespace) return 3;

  const leftWord = isWordChar(left);
  const rightWord = isWordChar(right);
  if (leftWord !== rightWord) return 2;
  if (!leftWord && !rightWord) return 1;
  return 0;
};

const findBestBoundary = (text: string, minIndex: number, maxIndex: number, target: number, minScore: number) => {
  const maxOffset = Math.max(target - minIndex, maxIndex - target);
  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const left = target - offset;
    if (left >= minIndex && left <= maxIndex && boundaryScore(text, left) >= minScore) {
      return left;
    }
    const right = target + offset;
    if (right >= minIndex && right <= maxIndex && boundaryScore(text, right) >= minScore) {
      return right;
    }
  }
  return null;
};

const isWordBoundary = (text: string, splitIndex: number) => {
  const left = splitIndex > 0 ? text[splitIndex - 1] : '';
  const right = splitIndex < text.length ? text[splitIndex] : '';
  if (!left || !right) return true;
  return isWordChar(left) !== isWordChar(right);
};

const findSplitIndex = (text: string, start: number, end: number, minLen: number) => {
  const length = end - start;
  const minIndex = start + minLen;
  const maxIndex = end - minLen;
  if (length <= minLen * 2 || maxIndex <= minIndex) {
    return null;
  }
  const target = Math.floor((start + end) / 2);
  // Prefer boundaries around spaces, then around punctuation/word edges, then punctuation groups.
  const whitespaceBoundary = findBestBoundary(text, minIndex, maxIndex, target, 3);
  if (whitespaceBoundary !== null && isWordBoundary(text, whitespaceBoundary)) return whitespaceBoundary;
  const wordBoundary = findBestBoundary(text, minIndex, maxIndex, target, 2);
  if (wordBoundary !== null && isWordBoundary(text, wordBoundary)) return wordBoundary;
  const punctuationBoundary = findBestBoundary(text, minIndex, maxIndex, target, 1);
  if (punctuationBoundary !== null && isWordBoundary(text, punctuationBoundary)) return punctuationBoundary;
  return null;
};

export const buildQuoteFragmentTree = (
  text: string,
  options?: { minLen?: number; maxLen?: number }
): QuoteFragmentTree => {
  const minLen = Math.max(1, options?.minLen ?? 7);
  const maxLen = Math.max(minLen, options?.maxLen ?? 13);
  const nodes: Record<string, QuoteFragmentNode> = {};

  const buildNode = (start: number, end: number, depth: number, index: number, parentId?: string): QuoteFragmentNode => {
    const id = String(index);
    const node: QuoteFragmentNode = {
      id,
      start,
      end,
      text: text.slice(start, end),
      depth,
      index,
      parentId
    };
    nodes[id] = node;
    const length = end - start;
    if (length > maxLen) {
      let splitIndex = findSplitIndex(text, start, end, minLen);
      if (splitIndex !== null && splitIndex > start && splitIndex < end) {
        const left = buildNode(start, splitIndex, depth + 1, index * 2 + 1, id);
        const right = buildNode(splitIndex, end, depth + 1, index * 2 + 2, id);
        node.leftId = left.id;
        node.rightId = right.id;
      }
    }
    return node;
  };

  const root = buildNode(0, text.length, 0, 0);
  const order = Object.values(nodes)
    .sort((a, b) => (b.depth - a.depth) || (a.start - b.start))
    .map((node) => node.id);

  return { text, rootId: root.id, nodes, order };
};

export const pickQuoteFragment = (
  tree: QuoteFragmentTree,
  known: Set<string>,
  knownessMap: Record<string, number>,
  threshold: number,
  considerDependencies: boolean,
  direction?: string | null,
  excludeId?: string | null
) => {
  const order = direction === 'reverse'
    ? tree.order.slice().sort((a, b) => tree.nodes[b].start - tree.nodes[a].start || tree.nodes[b].depth - tree.nodes[a].depth)
    : tree.order;
  for (const id of order) {
    if (excludeId && id === excludeId) continue;
    if (known.has(id)) continue;
    const node = tree.nodes[id];
    if (!node) continue;
    if (considerDependencies && (node.leftId || node.rightId)) {
      const leftScore = node.leftId ? (knownessMap[node.leftId] ?? 0) : threshold;
      const rightScore = node.rightId ? (knownessMap[node.rightId] ?? 0) : threshold;
      const mean = (leftScore + rightScore) / 2;
      if (mean < threshold) continue;
    }
    return node;
  }
  return null;
};

export const buildQuoteFragmentContext = (text: string, node: QuoteFragmentNode) => {
  return {
    before: text.slice(0, node.start),
    fragment: text.slice(node.start, node.end),
    after: text.slice(node.end)
  };
};
