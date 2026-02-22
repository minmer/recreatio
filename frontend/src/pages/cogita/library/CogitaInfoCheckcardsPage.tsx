import { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaShell } from '../CogitaShell';
import {
  getCogitaInfoCheckcardDependencies,
  getCogitaInfoCheckcards,
  getCogitaInfoDetail,
  type CogitaCardSearchResult,
  type CogitaItemDependency
} from '../../../lib/api';

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
        setCards(cardBundle.items);
        setDependencies(depBundle.items);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setCards([]);
        setDependencies([]);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [libraryId, infoId]);

  const graphNodes = useMemo<Node<CheckcardNodeData>[]>(() => {
    return cards.map((card, index) => {
      const key = cardKey(card);
      const col = index % 3;
      const row = Math.floor(index / 3);
      return {
        id: key,
        position: { x: 40 + col * 280, y: 40 + row * 120 },
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
  }, [cards]);

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
                    {selectedCard ? (
                      <div className="cogita-info-checkcards-selected">
                        <h4>{selectedCard.label}</h4>
                        <p>{formatCheckTarget(selectedCard)}</p>
                        <p className="cogita-card-subtitle">{selectedCard.description}</p>
                      </div>
                    ) : null}
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

