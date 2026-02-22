import { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaShell } from '../CogitaShell';
import {
  createCogitaReviewOutcome,
  getCogitaInfoCheckcardDependencies,
  getCogitaInfoCheckcards,
  getCogitaInfoDetail,
  getCogitaInfoApproachProjection,
  getCogitaReviewers,
  type CogitaCardSearchResult,
  type CogitaItemDependency,
  type CogitaReviewer
} from '../../../lib/api';
import { buildQuoteFragmentContext, buildQuoteFragmentTree } from '../../../cogita/revision/quote';

type CheckcardNodeData = {
  label: string;
  subtitle: string;
  checkType: string;
  direction?: string | null;
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
  infoId
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
}) {
  const [title, setTitle] = useState<string>(infoId);
  const [cards, setCards] = useState<CogitaCardSearchResult[]>([]);
  const [dependencies, setDependencies] = useState<CogitaItemDependency[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [detailPayload, setDetailPayload] = useState<Record<string, unknown> | null>(null);
  const [detailInfoType, setDetailInfoType] = useState<string | null>(null);
  const [vocabProjection, setVocabProjection] = useState<Record<string, unknown> | null>(null);
  const [reviewers, setReviewers] = useState<CogitaReviewer[]>([]);
  const [selectedReviewerRoleId, setSelectedReviewerRoleId] = useState<string>('');
  const [answer, setAnswer] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [clientSequence, setClientSequence] = useState(1);

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
    getCogitaReviewers({ libraryId })
      .then((items) => setReviewers(items))
      .catch(() => setReviewers([]));
  }, [libraryId]);

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
    setReveal(false);
    setSaveStatus(null);
  }, [selectedNodeId]);

  const cardPreview = useMemo(() => {
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
        return { prompt: String(wordA), expected: String(wordB), mode: 'text' as const };
      }
      if (direction === 'b-to-a') {
        return { prompt: String(wordB), expected: String(wordA), mode: 'text' as const };
      }
      return { prompt: `${wordA} ↔ ${wordB}`, expected: `${wordA} ↔ ${wordB}`, mode: 'self' as const };
    }

    if (infoType === 'citation' && checkType === 'quote-fragment' && direction && typeof payload.text === 'string') {
      const fragmentId = direction;
      const tree = buildQuoteFragmentTree(payload.text);
      const node = tree.nodes[fragmentId];
      if (node) {
        const ctx = buildQuoteFragmentContext(payload.text, node);
        const prompt = `${ctx.before} [ ... ] ${ctx.after}`.replace(/\s+/g, ' ').trim();
        const expected = node.text;
        return { prompt, expected, mode: 'text' as const };
      }
    }

    return {
      prompt: selectedCard.description || selectedCard.label,
      expected: selectedCard.label,
      mode: 'self' as const
    };
  }, [detailInfoType, detailPayload, selectedCard, vocabProjection]);

  const saveKnownness = async (correct: boolean) => {
    if (!selectedCard) return;
    if (!selectedReviewerRoleId) {
      setSaveStatus('Select a person to save knowness.');
      return;
    }
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

  const checkAnswerAndSave = async () => {
    if (!selectedCard || !cardPreview) return;
    if (cardPreview.mode !== 'text') {
      setSaveStatus('Automatic check is available only for text answers.');
      return;
    }
    if (!selectedReviewerRoleId) {
      setSaveStatus('Select a person to save knowness.');
      return;
    }
    const isCorrect = normalizeAnswerText(answer) === normalizeAnswerText(cardPreview.expected);
    setReveal(true);
    await saveKnownness(isCorrect);
  };

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
                        <h4>{selectedCard.label}</h4>
                        <p>{formatCheckTarget(selectedCard)}</p>
                        <p className="cogita-card-subtitle">{selectedCard.description}</p>
                        {cardPreview ? (
                          <div className="cogita-info-checkcard-answer">
                            <p className="cogita-user-kicker">Prompt</p>
                            <div className="cogita-info-tree-value">{cardPreview.prompt}</div>
                            <label className="cogita-field">
                              <span>Answer</span>
                              <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} />
                            </label>
                            <div className="cogita-info-selection-actions">
                              {cardPreview.mode === 'text' ? (
                                <button
                                  type="button"
                                  className="ghost"
                                  onClick={() => void checkAnswerAndSave()}
                                  disabled={!selectedReviewerRoleId}
                                >
                                  Check answer
                                </button>
                              ) : null}
                              <button type="button" className="ghost" onClick={() => setReveal((v) => !v)}>
                                {reveal ? 'Hide answer' : 'Show answer'}
                              </button>
                              <button type="button" className="ghost" onClick={() => void saveKnownness(false)} disabled={!selectedReviewerRoleId}>
                                Incorrect
                              </button>
                              <button type="button" className="cta ghost" onClick={() => void saveKnownness(true)} disabled={!selectedReviewerRoleId}>
                                Correct
                              </button>
                            </div>
                            {reveal ? (
                              <div className="cogita-info-tree-value">{cardPreview.expected}</div>
                            ) : null}
                            {!selectedReviewerRoleId ? (
                              <p className="cogita-library-hint">Auto-save knowness is available only after selecting a person.</p>
                            ) : null}
                            {saveStatus ? <p className="cogita-library-hint">{saveStatus}</p> : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="cogita-info-checkcards-selected">
                        <h4>Select a checking card</h4>
                        <p className="cogita-card-subtitle">Choose a node in the dependency tree to preview and answer it.</p>
                      </div>
                    )}
                  </div>
                  <aside className="cogita-info-checkcards-panel">
                    <label className="cogita-field">
                      <span>Person</span>
                      <select value={selectedReviewerRoleId} onChange={(event) => setSelectedReviewerRoleId(event.target.value)}>
                        <option value="">Select person (optional)</option>
                        {reviewers.map((reviewer) => (
                          <option key={reviewer.roleId} value={reviewer.roleId}>
                            {reviewer.label}
                          </option>
                        ))}
                      </select>
                    </label>
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
