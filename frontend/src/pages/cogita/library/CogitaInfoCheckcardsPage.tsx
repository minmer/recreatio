import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaShell } from '../CogitaShell';
import { CogitaRevisionCard } from './collections/components/CogitaRevisionCard';
import {
  createCogitaReviewOutcome,
  getCogitaInfoCheckcardDependencies,
  getCogitaInfoCheckcards,
  getCogitaInfoDetail,
  getCogitaInfoApproachProjection,
  type CogitaCardSearchResult,
  type CogitaItemDependency
} from '../../../lib/api';
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
      kind: 'generic';
      prompt: string;
      expected: string;
    };

function cardKey(card: Pick<CogitaCardSearchResult, 'cardId' | 'checkType' | 'direction'>) {
  return [card.cardId, card.checkType ?? '', card.direction ?? ''].join('|');
}

function dependencyKey(dep: Pick<CogitaItemDependency, 'parentItemId' | 'parentCheckType' | 'parentDirection'>) {
  return [dep.parentItemId, dep.parentCheckType ?? '', dep.parentDirection ?? ''].join('|');
}

function formatCheckTarget(card: CogitaCardSearchResult) {
  const main = card.checkType ?? 'info';
  return card.direction ? `${main} / ${card.direction}` : main;
}

function normalizeAnswerText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
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
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [checkedCardKeys, setCheckedCardKeys] = useState<Record<string, true>>({});
  const [computedAnswers, setComputedAnswers] = useState<Record<string, string>>({});
  const [computedFieldFeedback] = useState<Record<string, 'correct' | 'incorrect'>>({});
  const [scriptMode, setScriptMode] = useState<'super' | 'sub' | null>(null);
  const answerInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const computedInputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

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
    setShowCorrectAnswer(false);
    setSaveStatus(null);
    setComputedAnswers({});
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

    return {
      kind: 'generic',
      prompt: selectedCard.description || selectedCard.label,
      expected: selectedCard.label
    };
  }, [detailInfoType, detailPayload, selectedCard, title, vocabProjection]);

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
    const expected = cardPreview.expected;
    const isCorrect = normalizeAnswerText(answer) === normalizeAnswerText(expected);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    setSaveStatus(selectedReviewerRoleId ? null : 'Answer checked locally (not saved: no person selected).');
    setCheckedCardKeys((prev) => ({ ...prev, [key]: true }));
    if (selectedReviewerRoleId) {
      await saveKnownness(isCorrect);
    }
  };

  const currentRevisionCard = useMemo(() => {
    if (!selectedCard) return null;
    if (selectedCard.infoType === 'citation') {
      return { ...selectedCard, description: title };
    }
    return { ...selectedCard, description: selectedCard.label };
  }, [selectedCard, title]);

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
                  <p className="cogita-user-kicker">{copy.cogita.library.infoTypes.citation}</p>
                  <h2 className="cogita-card-title">{title}</h2>
                  <p className="cogita-card-subtitle">{infoId}</p>
                </div>
                <div className="cogita-selection-overview">
                  <span className="cogita-tag-chip">{`Cards: ${cards.length}`}</span>
                  <span className="cogita-tag-chip">{`Dependencies: ${dependencies.length}`}</span>
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
                            onRevealCorrect={() => {}}
                            answerMask={null}
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
                            disableCheckAnswer={selectedCardAlreadyChecked}
                            hideSkipAction
                          />
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
