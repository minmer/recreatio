import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { useNavigate } from 'react-router-dom';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaShell } from '../CogitaShell';
import { CogitaCheckcardSurface } from './collections/components/CogitaCheckcardSurface';
import { CogitaRevisionCard } from './collections/components/CogitaRevisionCard';
import { getInfoTypeLabel } from './libraryOptions';
import {
  createCogitaReviewOutcome,
  getCogitaInfoCheckcardDependencies,
  getCogitaInfoCheckcards,
  getCogitaInfoDetail,
  getCogitaInfoApproachProjection,
  type CogitaCardSearchResult,
  type CogitaItemDependency
} from '../../../lib/api';
import { evaluateAnchorTextAnswer } from '../../../cogita/revision/compare';
import { buildQuoteFragmentContext, buildQuoteFragmentTree } from '../../../cogita/revision/quote';

type CheckcardNodeData = {
  label: string;
  subtitle: string;
  checkType: string;
  direction?: string | null;
};

type DirectCardPreview =
  | {
      kind: 'vocab';
      prompt: string;
      expected: string;
    }
  | {
      kind: 'citation-fragment';
      expected: string;
      quoteContext: {
        title: string;
        before: string;
        after: string;
        total: number;
        completed: number;
      };
      quotePlaceholder: string;
    }
  | {
      kind: 'question';
      definition: {
        type: 'selection' | 'truefalse' | 'text' | 'number' | 'date' | 'ordering' | 'matching';
        title?: string;
        question: string;
        options?: string[];
        answer?: number[] | string | number | boolean | { paths: number[][] };
        columns?: string[][];
      };
    }
  | {
      kind: 'generic';
      prompt: string;
      expected: string;
    };

type QuestionRuntimeState = {
  selection: number[];
  booleanAnswer: boolean | null;
  ordering: string[];
  matchingRows: number[][];
  matchingSelection: Array<number | null>;
};

type ParsedQuestionDefinition = Extract<DirectCardPreview, { kind: 'question' }>['definition'];

function parseQuestionDefinition(value: unknown): ParsedQuestionDefinition | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const rawDef = data.definition;
  if (!rawDef || typeof rawDef !== 'object') return null;
  const def = rawDef as Record<string, unknown>;
  const rawType = typeof def.type === 'string' ? def.type : typeof def.kind === 'string' ? def.kind : 'selection';
  const type =
    rawType === 'multi_select' || rawType === 'single_select'
      ? 'selection'
      : rawType === 'boolean'
        ? 'truefalse'
        : rawType === 'order'
          ? 'ordering'
          : rawType;
  if (!['selection', 'truefalse', 'text', 'number', 'date', 'ordering', 'matching'].includes(type)) return null;
  const normalizedType = type as ParsedQuestionDefinition['type'];
  const title = typeof def.title === 'string' ? def.title : undefined;
  const question = typeof def.question === 'string' ? def.question : '';
  const options = Array.isArray(def.options) ? def.options.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean) : undefined;
  const columns = Array.isArray(def.columns)
    ? def.columns.map((col) => (Array.isArray(col) ? col.map((x) => (typeof x === 'string' ? x : '')).filter(Boolean) : [])).filter((c) => c.length > 0)
    : undefined;
  const answer = (() => {
    if (type === 'selection') {
      const raw = Array.isArray(def.answer) ? def.answer : Array.isArray(def.correct) ? def.correct : [];
      return raw.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x >= 0);
    }
    if (type === 'truefalse') {
      if (typeof def.answer === 'boolean') return def.answer;
      if (typeof def.expected === 'boolean') return def.expected;
      return false;
    }
    if (type === 'matching') {
      const answerNode = def.answer && typeof def.answer === 'object' ? (def.answer as Record<string, unknown>) : null;
      const source = Array.isArray(answerNode?.paths) ? answerNode?.paths : Array.isArray(def.correctPairs) ? def.correctPairs : [];
      const paths = source
        .map((row) => (Array.isArray(row) ? row.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x >= 0) : []))
        .filter((row) => row.length > 0);
      return { paths };
    }
    if (typeof def.answer === 'string' || typeof def.answer === 'number') return def.answer;
    if (typeof def.expected === 'string' || typeof def.expected === 'number') return def.expected;
    return undefined;
  })();
  return { type: normalizedType, title, question, options, columns, answer };
}

function questionPathRowsFromDefinition(def: ParsedQuestionDefinition): string[][] {
  if (def.type !== 'matching') return [[]];
  const width = Math.max(2, def.columns?.length ?? 2);
  const paths = def.answer && typeof def.answer === 'object' && 'paths' in def.answer ? def.answer.paths : [];
  const rows = (paths ?? []).map((row) => Array.from({ length: width }, (_, i) => String(row[i] ?? '')));
  return [...rows, new Array(width).fill('')];
}

function shuffleStrings(items: string[]): string[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function shuffleWithIndexMap<T>(items: T[]) {
  const indexed = items.map((value, oldIndex) => ({ value, oldIndex }));
  for (let i = indexed.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }
  const values = indexed.map((entry) => entry.value);
  const oldToNew = new Map<number, number>();
  indexed.forEach((entry, newIndex) => oldToNew.set(entry.oldIndex, newIndex));
  return { values, oldToNew };
}

function shuffleQuestionDefinitionForRuntime(def: ParsedQuestionDefinition): ParsedQuestionDefinition {
  if (def.type === 'selection') {
    const options = def.options ?? [];
    const shuffled = shuffleWithIndexMap(options);
    const expected = Array.isArray(def.answer) ? def.answer : [];
    return {
      ...def,
      options: shuffled.values,
      answer: expected
        .map((index) => shuffled.oldToNew.get(index))
        .filter((index): index is number => Number.isInteger(index))
        .sort((a, b) => a - b)
    };
  }

  if (def.type === 'matching') {
    const columns = def.columns ?? [];
    const shuffledColumns = columns.map((column) => shuffleWithIndexMap(column ?? []));
    const originalPaths =
      def.answer && typeof def.answer === 'object' && 'paths' in def.answer ? def.answer.paths : [];
    const remappedPaths = originalPaths.map((path) =>
      path.map((oldIndex, columnIndex) => shuffledColumns[columnIndex]?.oldToNew.get(oldIndex) ?? oldIndex)
    );
    return {
      ...def,
      columns: shuffledColumns.map((entry) => entry.values),
      answer: { paths: remappedPaths }
    };
  }

  return def;
}

function cardKey(card: Pick<CogitaCardSearchResult, 'cardId' | 'checkType' | 'direction'>) {
  return [card.cardId, card.checkType ?? '', card.direction ?? ''].join('|');
}

function dependencyKey(dep: Pick<CogitaItemDependency, 'parentItemId' | 'parentCheckType' | 'parentDirection'>) {
  return [dep.parentItemId, dep.parentCheckType ?? '', dep.parentDirection ?? ''].join('|');
}

function formatCheckTarget(card: CogitaCardSearchResult) {
  const raw = card.checkType ?? 'info';
  const main = raw.startsWith('question-') ? `question / ${raw.slice('question-'.length)}` : raw;
  return card.direction ? `${main} / ${card.direction}` : main;
}

export function CogitaInfoCheckcardsPage({
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
  infoId,
  selectedReviewerRoleId
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
  infoId: string;
  selectedReviewerRoleId?: string | null;
}) {
  const [title, setTitle] = useState<string>(infoId);
  const [cards, setCards] = useState<CogitaCardSearchResult[]>([]);
  const [dependencies, setDependencies] = useState<CogitaItemDependency[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [detailPayload, setDetailPayload] = useState<Record<string, unknown> | null>(null);
  const [detailInfoType, setDetailInfoType] = useState<string | null>(null);
  const [vocabProjection, setVocabProjection] = useState<Record<string, unknown> | null>(null);
  const [answer, setAnswer] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [clientSequence, setClientSequence] = useState(1);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [flashTick, setFlashTick] = useState(0);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [answerMask, setAnswerMask] = useState<Uint8Array | null>(null);
  const [checkedCardKeys, setCheckedCardKeys] = useState<Record<string, true>>({});
  const [computedAnswers, setComputedAnswers] = useState<Record<string, string>>({});
  const [computedFieldFeedback] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const [scriptMode, setScriptMode] = useState<'super' | 'sub' | null>(null);
  const [questionState, setQuestionState] = useState<QuestionRuntimeState>({
    selection: [],
    booleanAnswer: null,
    ordering: [],
    matchingRows: [],
    matchingSelection: []
  });
  const answerInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const computedInputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    Promise.all([
      getCogitaInfoDetail({ libraryId, infoId }).catch(() => null),
      getCogitaInfoCheckcards({ libraryId, infoId }),
      getCogitaInfoCheckcardDependencies({ libraryId, infoId })
    ])
      .then(([detail, cardBundle, depBundle]) => {
        if (cancelled) return;
        const payload = (detail?.payload ?? {}) as Record<string, unknown>;
        const resolvedTitle =
          (typeof payload.title === 'string' && payload.title) ||
          (typeof payload.label === 'string' && payload.label) ||
          (typeof payload.name === 'string' && payload.name) ||
          infoId;
        setTitle(resolvedTitle);
        setDetailPayload(payload);
        setDetailInfoType(detail?.infoType ?? null);
        setCards(cardBundle.items);
        setDependencies(depBundle.items);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setDetailPayload(null);
        setDetailInfoType(null);
        setCards([]);
        setDependencies([]);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [libraryId, infoId]);

  useEffect(() => {
    if (detailInfoType !== 'translation') {
      setVocabProjection(null);
      return;
    }
    getCogitaInfoApproachProjection({ libraryId, infoId, approachKey: 'vocab-card' })
      .then((response) => setVocabProjection((response.projection ?? null) as Record<string, unknown> | null))
      .catch(() => setVocabProjection(null));
  }, [detailInfoType, infoId, libraryId]);

  const graphNodes = useMemo<Node<CheckcardNodeData>[]>(() => {
    const cardMap = new Map(cards.map((card) => [cardKey(card), card]));
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, string[]>();
    for (const card of cards) {
      incoming.set(cardKey(card), 0);
      outgoing.set(cardKey(card), []);
    }
    for (const dep of dependencies) {
      const source = dependencyKey({
        parentItemId: dep.parentItemId,
        parentCheckType: dep.parentCheckType,
        parentDirection: dep.parentDirection
      });
      const target = [dep.childItemId, dep.childCheckType ?? '', dep.childDirection ?? ''].join('|');
      if (!cardMap.has(source) || !cardMap.has(target)) continue;
      outgoing.get(source)?.push(target);
      incoming.set(target, (incoming.get(target) ?? 0) + 1);
    }
    const queue = Array.from(incoming.entries()).filter(([, count]) => count === 0).map(([id]) => id);
    const levelById = new Map<string, number>();
    for (const key of queue) levelById.set(key, 0);
    while (queue.length) {
      const current = queue.shift()!;
      const currentLevel = levelById.get(current) ?? 0;
      for (const next of outgoing.get(current) ?? []) {
        const nextLevel = Math.max(levelById.get(next) ?? 0, currentLevel + 1);
        levelById.set(next, nextLevel);
        incoming.set(next, (incoming.get(next) ?? 1) - 1);
        if ((incoming.get(next) ?? 0) <= 0) queue.push(next);
      }
    }
    const grouped = new Map<number, string[]>();
    for (const card of cards) {
      const key = cardKey(card);
      const level = levelById.get(key) ?? 0;
      const bucket = grouped.get(level) ?? [];
      bucket.push(key);
      grouped.set(level, bucket);
    }

    return cards.map((card) => {
      const key = cardKey(card);
      const level = levelById.get(key) ?? 0;
      const idsInLevel = grouped.get(level) ?? [key];
      const row = Math.max(0, idsInLevel.indexOf(key));
      return {
        id: key,
        position: { x: 40 + row * 290 + (level % 2 ? 18 : 0), y: 30 + level * 120 },
        draggable: false,
        selectable: true,
        data: {
          label: card.label,
          subtitle: formatCheckTarget(card),
          checkType: card.checkType ?? 'info',
          direction: card.direction ?? null
        },
        style: {
          width: 250,
          borderRadius: 10,
          border: '1px solid rgba(120,170,220,0.22)',
          background: 'rgba(8,20,34,0.88)',
          color: '#e8f2ff',
          padding: 8
        }
      };
    });
  }, [cards, dependencies]);

  const cardByKey = useMemo(() => new Map(cards.map((card) => [cardKey(card), card])), [cards]);

  const graphEdges = useMemo<Edge[]>(() => {
    const edges: Edge[] = [];
    for (const dep of dependencies) {
      const source = dependencyKey({
        parentItemId: dep.parentItemId,
        parentCheckType: dep.parentCheckType,
        parentDirection: dep.parentDirection
      });
      const target = [dep.childItemId, dep.childCheckType ?? '', dep.childDirection ?? ''].join('|');
      if (!cardByKey.has(source) || !cardByKey.has(target)) continue;
      edges.push({
        id: `${source}->${target}`,
        source,
        target,
        selectable: false,
        animated: false,
        style: { stroke: 'rgba(148, 202, 248, 0.7)' }
      });
    }
    return edges;
  }, [cardByKey, dependencies]);

  const selectedCard = useMemo(
    () => (selectedNodeId ? cardByKey.get(selectedNodeId) ?? null : null),
    [cardByKey, selectedNodeId]
  );

  useEffect(() => {
    setAnswer('');
    setFeedback(null);
    setFlashTick(0);
    setShowCorrectAnswer(false);
    setAnswerMask(null);
    setSaveStatus(null);
    setComputedAnswers({});
    setQuestionState({ selection: [], booleanAnswer: null, ordering: [], matchingRows: [], matchingSelection: [] });
  }, [selectedNodeId]);

  const cardPreview = useMemo<DirectCardPreview | null>(() => {
    if (!selectedCard) return null;
    const infoType = detailInfoType ?? selectedCard.infoType ?? null;
    const checkType = selectedCard.checkType ?? 'info';
    const direction = selectedCard.direction ?? null;
    const payload = detailPayload ?? {};

    if (selectedCard.cardType === 'vocab' && vocabProjection && Array.isArray(vocabProjection.words)) {
      const words = vocabProjection.words as Array<any>;
      const wordA = words[0]?.label ?? '?';
      const wordB = words[1]?.label ?? '?';
      if (direction === 'a-to-b') {
        return { kind: 'vocab', prompt: String(wordA), expected: String(wordB) };
      }
      if (direction === 'b-to-a') {
        return { kind: 'vocab', prompt: String(wordB), expected: String(wordA) };
      }
      return { kind: 'generic', prompt: `${wordA} ↔ ${wordB}`, expected: `${wordA} ↔ ${wordB}` };
    }

    if (infoType === 'citation' && checkType === 'quote-fragment' && direction && typeof payload.text === 'string') {
      const fragmentId = direction;
      const tree = buildQuoteFragmentTree(payload.text);
      const node = tree.nodes[fragmentId];
      if (node) {
        const ctx = buildQuoteFragmentContext(payload.text, node);
        return {
          kind: 'citation-fragment',
          expected: node.text,
          quoteContext: {
            title,
            before: ctx.before,
            after: ctx.after,
            total: Object.keys(tree.nodes).length,
            completed: 0
          },
          quotePlaceholder: node.text.length > 0 ? '.'.repeat(Math.max(4, Math.min(18, node.text.length))) : '...'
        };
      }
    }

    if (infoType === 'question') {
      const definition = parseQuestionDefinition(payload);
      if (definition) {
        return { kind: 'question', definition: shuffleQuestionDefinitionForRuntime(definition) };
      }
    }

    return {
      kind: 'generic',
      prompt: selectedCard.description || selectedCard.label,
      expected: selectedCard.label
    };
  }, [detailInfoType, detailPayload, selectedCard, title, vocabProjection]);

  useEffect(() => {
    if (!cardPreview || cardPreview.kind !== 'question') return;
    const def = cardPreview.definition;
    setQuestionState({
      selection: [],
      booleanAnswer: null,
      ordering: def.type === 'ordering' ? shuffleStrings(def.options ?? []) : [],
      matchingRows: [],
      matchingSelection: def.type === 'matching' ? new Array(Math.max(2, def.columns?.length ?? 2)).fill(null) : []
    });
  }, [cardPreview, selectedNodeId]);

  const saveKnownness = async (correct: boolean) => {
    if (!selectedCard) return;
    if (!selectedReviewerRoleId) return;
    try {
      await createCogitaReviewOutcome({
        libraryId,
        outcome: {
          itemType: 'info',
          itemId: selectedCard.cardId,
          checkType: selectedCard.checkType ?? 'info',
          direction: selectedCard.direction ?? null,
          revisionType: 'direct',
          evalType: 'direct-check',
          correct,
          clientId: 'cogita-info-checkcards',
          clientSequence,
          personRoleId: selectedReviewerRoleId
        }
      });
      setClientSequence((prev) => prev + 1);
      setSaveStatus(correct ? 'Saved as correct.' : 'Saved as incorrect.');
    } catch {
      setSaveStatus('Failed to save answer.');
    }
  };

  const selectedCardKey = selectedCard ? cardKey(selectedCard) : null;
  const selectedCardAlreadyChecked = selectedCardKey ? !!checkedCardKeys[selectedCardKey] : false;

  const checkAnswerAndSave = async () => {
    if (!selectedCard || !cardPreview) return;
    const key = cardKey(selectedCard);
    if (checkedCardKeys[key]) {
      setSaveStatus('This card was already checked.');
      return;
    }
    let isCorrect = false;
    let nextMask: Uint8Array | null = null;
    if (cardPreview.kind === 'question') {
      const def = cardPreview.definition;
      if (def.type === 'selection') {
        const expected = Array.isArray(def.answer) ? [...def.answer].sort((a, b) => a - b) : [];
        const actual = [...questionState.selection].sort((a, b) => a - b);
        isCorrect = expected.length === actual.length && expected.every((value, index) => value === actual[index]);
      } else if (def.type === 'truefalse') {
        isCorrect = typeof def.answer === 'boolean' && questionState.booleanAnswer !== null && def.answer === questionState.booleanAnswer;
      } else if (def.type === 'ordering') {
        const expected = (def.options ?? []).join('\n');
        const actual = questionState.ordering.join('\n');
        const evaluation = evaluateAnchorTextAnswer(expected, actual, {
          thresholdPercent: 100,
          treatSimilarCharsAsSame: true,
          ignorePunctuationAndSpacing: false
        });
        isCorrect = evaluation.isCorrect;
        nextMask = evaluation.mask;
      } else if (def.type === 'matching') {
        const width = Math.max(2, def.columns?.length ?? 2);
        const actualPaths = questionState.matchingRows
          .map((row) => row.slice(0, width))
          .filter((row) => row.length === width && row.every((cell) => Number.isInteger(cell) && cell >= 0))
          .map((row) => JSON.stringify(row));
        const expectedPaths = (
          def.answer && typeof def.answer === 'object' && 'paths' in def.answer ? def.answer.paths : []
        )
          .map((row) => JSON.stringify(row));
        const actualSet = Array.from(new Set(actualPaths)).sort();
        const expectedSet = Array.from(new Set(expectedPaths)).sort();
        isCorrect = actualSet.length === expectedSet.length && actualSet.every((value, index) => value === expectedSet[index]);
      } else {
        const expectedText = String(def.answer ?? '');
        const evaluation = evaluateAnchorTextAnswer(expectedText, answer, {
          thresholdPercent: 100,
          treatSimilarCharsAsSame: true,
          ignorePunctuationAndSpacing: false
        });
        isCorrect = evaluation.isCorrect;
        nextMask = evaluation.mask;
      }
      setAnswerMask(nextMask);
      setShowCorrectAnswer(true);
    } else {
      const expected = cardPreview.expected;
      const citationMode = cardPreview.kind === 'citation-fragment';
      const evaluation = evaluateAnchorTextAnswer(expected, answer, {
        thresholdPercent: citationMode ? 90 : 100,
        treatSimilarCharsAsSame: true,
        ignorePunctuationAndSpacing: citationMode
      });
      isCorrect = evaluation.isCorrect;
      setAnswerMask(evaluation.mask);
      setShowCorrectAnswer(true);
    }
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    setFlashTick((prev) => prev + 1);
    setSaveStatus(selectedReviewerRoleId ? null : 'Answer checked locally (not saved: no person selected).');
    setCheckedCardKeys((prev) => ({ ...prev, [key]: true }));
    if (selectedReviewerRoleId) {
      await saveKnownness(isCorrect);
    }
  };

  const handleRevealCorrectAnswer = () => {
    if (!selectedCard || !cardPreview) return;
    const key = cardKey(selectedCard);
    if (!checkedCardKeys[key]) {
      setCheckedCardKeys((prev) => ({ ...prev, [key]: true }));
      setSaveStatus('Answer revealed (not saved).');
    }
    if (cardPreview.kind === 'question') {
      setAnswerMask(null);
      return;
    }
    const fullMask = evaluateAnchorTextAnswer(cardPreview.expected, cardPreview.expected, {
      thresholdPercent: 100,
      treatSimilarCharsAsSame: true,
      ignorePunctuationAndSpacing: cardPreview.kind === 'citation-fragment'
    });
    setAnswerMask(fullMask.mask);
  };

  const currentRevisionCard = useMemo(() => {
    if (!selectedCard) return null;
    if (selectedCard.infoType === 'question') {
      return { ...selectedCard, description: selectedCard.label };
    }
    if (selectedCard.infoType === 'citation') {
      return { ...selectedCard, description: title };
    }
    return { ...selectedCard, description: selectedCard.label };
  }, [selectedCard, title]);

  const renderQuestionCard = (preview: Extract<DirectCardPreview, { kind: 'question' }>) => {
    const def = preview.definition;
    const checked = selectedCardAlreadyChecked || showCorrectAnswer;
    const expectedSelection = Array.isArray(def.answer) ? def.answer : [];
    const expectedMatchingPaths =
      def.answer && typeof def.answer === 'object' && 'paths' in def.answer ? def.answer.paths : [];
    const matchingWidth = Math.max(2, def.columns?.length ?? 2);
    const chosenMatchingPaths =
      def.type === 'matching'
        ? questionState.matchingRows.filter((row): row is number[] => row.length === matchingWidth && row.every((v) => Number.isInteger(v) && v >= 0))
        : [];
    const matchingSelection = Array.from({ length: matchingWidth }, (_, i) => questionState.matchingSelection[i] ?? null);
    const toPathKey = (path: number[]) => path.join('|');
    const expectedCounts = new Map<string, number>();
    for (const path of expectedMatchingPaths) {
      const key = toPathKey(path);
      expectedCounts.set(key, (expectedCounts.get(key) ?? 0) + 1);
    }
    const chosenCounts = new Map<string, number>();
    for (const path of chosenMatchingPaths) {
      const key = toPathKey(path);
      chosenCounts.set(key, (chosenCounts.get(key) ?? 0) + 1);
    }
    const remainingPaths = expectedMatchingPaths.filter((path) => {
      const key = toPathKey(path);
      const used = chosenCounts.get(key) ?? 0;
      if (used > 0) {
        chosenCounts.set(key, used - 1);
        return false;
      }
      return true;
    });
    // restore chosenCounts after temporary subtraction
    chosenCounts.clear();
    for (const path of chosenMatchingPaths) {
      const key = toPathKey(path);
      chosenCounts.set(key, (chosenCounts.get(key) ?? 0) + 1);
    }
    const isMatchingOptionEnabled = (columnIndex: number, optionIndex: number) => {
      if (checked) return false;
      if (matchingSelection[columnIndex] === optionIndex) return true;
      return remainingPaths.some((path) => {
        if ((path[columnIndex] ?? -1) !== optionIndex) return false;
        return matchingSelection.every((selected, idx) => selected == null || idx === columnIndex || path[idx] === selected);
      });
    };
    const handleMatchingPick = (columnIndex: number, optionIndex: number) => {
      if (checked) return;
      setQuestionState((prev) => {
        const width = Math.max(2, def.columns?.length ?? 2);
        const nextSelection = Array.from({ length: width }, (_, i) => prev.matchingSelection[i] ?? null);
        nextSelection[columnIndex] = nextSelection[columnIndex] === optionIndex ? null : optionIndex;
        if (nextSelection.some((value) => value == null)) {
          return { ...prev, matchingSelection: nextSelection };
        }
        const completed = nextSelection.map((value) => Number(value));
        const completedKey = toPathKey(completed);
        const usedCount = prev.matchingRows.filter((row) => toPathKey(row) === completedKey).length;
        const totalCount = expectedCounts.get(completedKey) ?? 0;
        if (totalCount > usedCount) {
          setFeedback('correct');
          setFlashTick((tick) => tick + 1);
          setSaveStatus(null);
          return {
            ...prev,
            matchingRows: [...prev.matchingRows, completed],
            matchingSelection: new Array(width).fill(null)
          };
        }
        setFeedback('incorrect');
        setFlashTick((tick) => tick + 1);
        setSaveStatus('This path is not valid or has already been used.');
        return {
          ...prev,
          matchingSelection: new Array(width).fill(null)
        };
      });
    };

    return (
      <div className="cogita-revision-body">
        <h2>{def.question || selectedCard?.label}</h2>
        {def.title ? <p className="cogita-revision-hint">{def.title}</p> : null}

        {def.type === 'selection' ? (
          <div className="cogita-choice-grid" style={{ gridTemplateColumns: '1fr' }}>
            {(def.options ?? []).map((option, index) => (
              <label key={`q-opt:${index}`} className="cogita-field" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <input
                  type="checkbox"
                  checked={questionState.selection.includes(index)}
                  disabled={checked}
                  onChange={(event) =>
                    setQuestionState((prev) => ({
                      ...prev,
                      selection: event.target.checked
                        ? Array.from(new Set([...prev.selection, index]))
                        : prev.selection.filter((value) => value !== index)
                    }))
                  }
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        ) : null}

        {def.type === 'truefalse' ? (
          <div className="cogita-form-actions" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="ghost" data-active={questionState.booleanAnswer === true} disabled={checked} onClick={() => setQuestionState((prev) => ({ ...prev, booleanAnswer: true }))}>True</button>
            <button type="button" className="ghost" data-active={questionState.booleanAnswer === false} disabled={checked} onClick={() => setQuestionState((prev) => ({ ...prev, booleanAnswer: false }))}>False</button>
          </div>
        ) : null}

        {(def.type === 'text' || def.type === 'number' || def.type === 'date') ? (
          <label className="cogita-field">
            <span>{copy.cogita.library.revision.answerLabel}</span>
            <input
              ref={answerInputRef}
              type={def.type === 'date' ? 'date' : 'text'}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={checked}
              data-state={feedback === 'correct' ? 'correct' : feedback === 'incorrect' ? 'incorrect' : undefined}
            />
          </label>
        ) : null}

        {def.type === 'ordering' ? (
          <div style={{ display: 'grid', gap: '0.45rem' }}>
            {questionState.ordering.map((item, index) => (
              <div key={`q-order:${index}:${item}`} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ color: 'rgba(184,209,234,0.75)' }}>{index + 1}.</span>
                <span>{item}</span>
                <button type="button" className="ghost" disabled={checked || index === 0} onClick={() => setQuestionState((prev) => {
                  const next = [...prev.ordering];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  return { ...prev, ordering: next };
                })}>Up</button>
                <button type="button" className="ghost" disabled={checked || index >= questionState.ordering.length - 1} onClick={() => setQuestionState((prev) => {
                  const next = [...prev.ordering];
                  [next[index + 1], next[index]] = [next[index], next[index + 1]];
                  return { ...prev, ordering: next };
                })}>Down</button>
              </div>
            ))}
          </div>
        ) : null}

        {def.type === 'matching' ? (
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {(def.columns ?? []).map((column, columnIndex) => (
              <div key={`q-col:${columnIndex}`} className="cogita-library-panel" style={{ display: 'grid', gap: '0.35rem', padding: '0.6rem' }}>
                <p className="cogita-user-kicker">{`Column ${columnIndex + 1}`}</p>
                {column.map((option, optionIndex) => (
                  <button
                    key={`q-col:${columnIndex}:${optionIndex}`}
                    type="button"
                    className="ghost cogita-checkcard-row"
                    style={{ textAlign: 'left' }}
                    disabled={!isMatchingOptionEnabled(columnIndex, optionIndex)}
                    data-active={matchingSelection[columnIndex] === optionIndex ? 'true' : undefined}
                    onClick={() => handleMatchingPick(columnIndex, optionIndex)}
                  >
                    <span>{option}</span>
                    <small>{optionIndex}</small>
                  </button>
                ))}
              </div>
            ))}
            <div style={{ display: 'grid', gap: '0.4rem' }}>
              <p className="cogita-user-kicker">Selected paths</p>
              {chosenMatchingPaths.length ? (
                chosenMatchingPaths.map((path, rowIndex) => (
                  <div key={`q-path:${rowIndex}`} className="cogita-share-row" style={{ alignItems: 'center' }}>
                    <span>
                      {path.map((selectedIndex, columnIndex) => {
                        const label = String(def.columns?.[columnIndex]?.[selectedIndex] ?? selectedIndex);
                        return `${columnIndex > 0 ? ' -> ' : ''}${label}`;
                      })}
                    </span>
                    {!checked ? (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() =>
                          setQuestionState((prev) => ({
                            ...prev,
                            matchingRows: prev.matchingRows.filter((_, idx) => idx !== rowIndex)
                          }))
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="cogita-library-hint">Choose one option in each column. After the last column is selected, the path is checked automatically.</p>
              )}
            </div>
          </div>
        ) : null}

        <div className="cogita-form-actions">
          <button type="button" className="cta" onClick={() => void checkAnswerAndSave()} disabled={checked}>
            {copy.cogita.library.revision.checkAnswer}
          </button>
        </div>

        {showCorrectAnswer ? (
          <div className="cogita-revision-answer">
            <p className="cogita-user-kicker">{copy.cogita.library.revision.correctAnswerLabel}</p>
            {def.type === 'selection' ? (
              <p>{expectedSelection.length ? expectedSelection.map((i) => `${i}${def.options?.[i] ? `: ${def.options[i]}` : ''}`).join(', ') : '-'}</p>
            ) : def.type === 'truefalse' ? (
              <p>{String(Boolean(def.answer))}</p>
            ) : def.type === 'ordering' ? (
              <ol>{(def.options ?? []).map((opt, i) => <li key={`ans-order:${i}`}>{opt}</li>)}</ol>
            ) : def.type === 'matching' ? (
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                {expectedMatchingPaths.length ? expectedMatchingPaths.map((path, idx) => (
                  <p key={`ans-path:${idx}`}>{path.join(' → ')}</p>
                )) : <p>-</p>}
              </div>
            ) : (
              <p>{String(def.answer ?? '')}</p>
            )}
          </div>
        ) : (
          <div className="cogita-revision-reveal">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setShowCorrectAnswer(true);
                handleRevealCorrectAnswer();
              }}
            >
              {copy.cogita.library.revision.showAnswer}
            </button>
          </div>
        )}
      </div>
    );
  };

  const infoTypeLabel = useMemo(() => {
    if (!detailInfoType) return copy.cogita.library.infoTypes.any;
    return getInfoTypeLabel(copy, detailInfoType as any);
  }, [copy, detailInfoType]);

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
      <section className="cogita-library-dashboard" data-mode="detail">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <section className="cogita-info-checkcards-page">
              <header className="cogita-info-checkcards-header">
                <div>
                  <p className="cogita-user-kicker">{infoTypeLabel}</p>
                  <h2 className="cogita-card-title">{title}</h2>
                  <p className="cogita-card-subtitle">{infoId}</p>
                </div>
                <div className="cogita-selection-overview">
                  <span className="cogita-tag-chip">{`Cards: ${cards.length}`}</span>
                  <span className="cogita-tag-chip">{`Dependencies: ${dependencies.length}`}</span>
                  <button
                    type="button"
                    className="cta"
                    disabled={cards.length === 0}
                    onClick={() =>
                      navigate(
                        `/cogita/library/${libraryId}/revision/run?libraryTarget=revisions&scope=info&infoId=${encodeURIComponent(infoId)}`
                      )
                    }
                  >
                    Start revision
                  </button>
                </div>
              </header>

              {status === 'loading' ? (
                <div className="cogita-card-empty"><p>Loading checkcards...</p></div>
              ) : status === 'error' ? (
                <div className="cogita-card-empty"><p>Failed to load checkcards.</p></div>
              ) : (
                <div className="cogita-info-checkcards-layout">
                  <div className="cogita-info-checkcards-main">
                    <div className="cogita-info-checkcards-graph">
                      <ReactFlow
                        nodes={graphNodes}
                        edges={graphEdges}
                        fitView
                        nodesDraggable={false}
                        nodesConnectable={false}
                        elementsSelectable
                        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                        panOnDrag
                      >
                        <Background />
                        <Controls showInteractive={false} />
                      </ReactFlow>
                    </div>
                    {selectedCard ? (
                      <div className="cogita-info-checkcards-selected">
                        {cardPreview && currentRevisionCard ? (
                          <CogitaCheckcardSurface flashState={feedback} flashTick={flashTick}>
                            {cardPreview.kind === 'question' ? (
                              renderQuestionCard(cardPreview)
                            ) : (
                              <CogitaRevisionCard
                                copy={copy}
                                currentCard={currentRevisionCard}
                                currentTypeLabel=""
                                prompt={cardPreview.kind === 'citation-fragment' ? null : cardPreview.prompt}
                                languages={[]}
                                answer={answer}
                                onAnswerChange={setAnswer}
                                computedExpected={[]}
                                computedAnswers={computedAnswers}
                                onComputedAnswerChange={(key, value) => setComputedAnswers((prev) => ({ ...prev, [key]: value }))}
                                answerTemplate={null}
                                outputVariables={null}
                                variableValues={null}
                                computedFieldFeedback={computedFieldFeedback}
                                feedback={feedback}
                                canAdvance={false}
                                quoteContext={cardPreview.kind === 'citation-fragment' ? cardPreview.quoteContext : null}
                                quotePlaceholder={cardPreview.kind === 'citation-fragment' ? cardPreview.quotePlaceholder : null}
                                onCheckAnswer={() => void checkAnswerAndSave()}
                                onSkip={() => setSelectedNodeId(null)}
                                onLanguageSelect={() => {}}
                                onMarkReviewed={() => {}}
                                onAdvance={() => {}}
                                showCorrectAnswer={showCorrectAnswer}
                                setShowCorrectAnswer={setShowCorrectAnswer}
                                onRevealCorrect={handleRevealCorrectAnswer}
                                answerMask={answerMask}
                                expectedAnswer={cardPreview.expected}
                                hasExpectedAnswer={true}
                                handleComputedKeyDown={() => {}}
                                answerInputRef={answerInputRef}
                                computedInputRefs={computedInputRefs}
                                scriptMode={scriptMode}
                                setScriptMode={setScriptMode}
                                matchPairs={undefined}
                                matchLeftOrder={undefined}
                                matchRightOrder={undefined}
                                matchSelection={undefined}
                                matchActiveLeft={null}
                                matchActiveRight={null}
                                matchFeedback={undefined}
                                onMatchLeftSelect={undefined}
                                onMatchRightSelect={undefined}
                                disableCheckAnswer={selectedCardAlreadyChecked || showCorrectAnswer}
                                hideSkipAction
                                allowRevealBeforeCheck
                                autoRevealAfterAnswer
                                disableCheckAfterAnswer
                              />
                            )}
                          </CogitaCheckcardSurface>
                        ) : null}
                        {!selectedReviewerRoleId ? (
                          <p className="cogita-library-hint">Result can be checked without a person; saving knowness requires a selected person in the header.</p>
                        ) : null}
                        {saveStatus ? <p className="cogita-library-hint">{saveStatus}</p> : null}
                      </div>
                    ) : (
                      <div className="cogita-info-checkcards-selected">
                        <h4>Select a checking card</h4>
                        <p className="cogita-card-subtitle">Choose a node in the dependency tree to preview and answer it.</p>
                      </div>
                    )}
                  </div>
                  <aside className="cogita-info-checkcards-panel">
                    <h3>Checking cards</h3>
                    <div className="cogita-info-tree">
                      {cards.map((card) => {
                        const key = cardKey(card);
                        const active = selectedNodeId === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`ghost cogita-checkcard-row ${active ? 'active' : ''}`}
                            onClick={() => setSelectedNodeId(key)}
                          >
                            <span>{card.label}</span>
                            <small>{formatCheckTarget(card)}</small>
                          </button>
                        );
                      })}
                    </div>
                  </aside>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
