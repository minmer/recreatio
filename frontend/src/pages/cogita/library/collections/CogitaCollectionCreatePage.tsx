import { useEffect, useMemo, useState } from 'react';
import {
  createCogitaCollection,
  searchCogitaCards,
  type CogitaCardSearchResult,
  type CogitaCollectionItemRequest
} from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import type { CogitaInfoType } from '../types';
import { cardSearchOptions } from '../libraryOptions';
import { useCogitaLibraryMeta } from '../useCogitaLibraryMeta';

const mapItemType = (card: CogitaCardSearchResult): CogitaCollectionItemRequest['itemType'] =>
  card.cardType === 'vocab' || card.cardType === 'connection' ? 'connection' : 'info';

export function CogitaCollectionCreatePage({
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
  onBackToCollections,
  onBackToOverview,
  onBackToCogita,
  onCreated
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
  onBackToCollections: () => void;
  onBackToOverview: () => void;
  onBackToCogita: () => void;
  onCreated: (collectionId: string) => void;
}) {
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [searchType, setSearchType] = useState<CogitaInfoType | 'any' | 'vocab'>('any');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CogitaCardSearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [selected, setSelected] = useState<CogitaCardSearchResult[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const selectedLookup = useMemo(() => new Set(selected.map((item) => `${mapItemType(item)}:${item.cardId}`)), [selected]);

  useEffect(() => {
    setSearchStatus('loading');
    const handle = window.setTimeout(() => {
      searchCogitaCards({
        libraryId,
        type: searchType === 'any' ? undefined : searchType,
        query: searchQuery.trim() || undefined,
        limit: 40
      })
        .then((bundle) => {
          setSearchResults(bundle.items);
          setSearchStatus('ready');
        })
        .catch(() => {
          setSearchResults([]);
          setSearchStatus('ready');
        });
    }, 240);
    return () => window.clearTimeout(handle);
  }, [libraryId, searchQuery, searchType]);

  const handleAdd = (card: CogitaCardSearchResult) => {
    const key = `${mapItemType(card)}:${card.cardId}`;
    if (selectedLookup.has(key)) return;
    setSelected((prev) => [...prev, card]);
  };

  const handleRemove = (cardId: string, itemType: CogitaCollectionItemRequest['itemType']) => {
    setSelected((prev) => prev.filter((item) => !(item.cardId === cardId && mapItemType(item) === itemType)));
  };

  const handleCreate = async () => {
    setStatusMessage(null);
    if (!name.trim()) {
      setStatusMessage('Collection name is required.');
      return;
    }

    const items: CogitaCollectionItemRequest[] = selected.map((item) => ({
      itemType: mapItemType(item),
      itemId: item.cardId
    }));

    try {
      const created = await createCogitaCollection({
        libraryId,
        name: name.trim(),
        notes: notes.trim() || undefined,
        items
      });
      setStatusMessage('Collection saved.');
      onCreated(created.collectionId);
    } catch {
      setStatusMessage('Failed to save collection.');
    }
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
        <header className="cogita-library-dashboard-header">
          <div>
            <p className="cogita-user-kicker">New collection</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">Bundle cards for focused revision.</p>
          </div>
          <div className="cogita-library-actions">
            <button type="button" className="cta ghost" onClick={onBackToCogita}>
              Back to Cogita
            </button>
            <button type="button" className="cta ghost" onClick={onBackToOverview}>
              Library overview
            </button>
            <button type="button" className="cta ghost" onClick={onBackToCollections}>
              Collections list
            </button>
            <button type="button" className="cta" onClick={handleCreate}>
              Save collection
            </button>
          </div>
        </header>

        <div className="cogita-library-grid">
          <div className="cogita-library-pane">
            <div className="cogita-library-controls">
              <div className="cogita-library-search">
                <p className="cogita-user-kicker">Collection info</p>
                <label className="cogita-field">
                  <span>Name</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. German basics" />
                </label>
                <label className="cogita-field">
                  <span>Notes</span>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Focus, schedule, or notes" />
                </label>
                {statusMessage ? <p className="cogita-help">{statusMessage}</p> : null}
              </div>
            </div>

            <div className="cogita-library-search">
              <p className="cogita-user-kicker">Find cards</p>
              <div className="cogita-search-field">
                <select value={searchType} onChange={(event) => setSearchType(event.target.value as CogitaInfoType | 'any' | 'vocab')}>
                  {cardSearchOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search cards"
                />
              </div>
            </div>

            <div className="cogita-card-count">
              <span>{searchResults.length} results</span>
              <span>{searchStatus === 'loading' ? 'Loading...' : 'Ready'}</span>
            </div>

            <div className="cogita-card-list" data-view="list">
              {searchResults.length ? (
                searchResults.map((result) => (
                  <div key={result.cardId} className="cogita-card-item">
                    <button type="button" className="cogita-card-select" onClick={() => handleAdd(result)}>
                      <div className="cogita-card-type">{result.cardType}</div>
                      <h3 className="cogita-card-title">{result.label}</h3>
                      <p className="cogita-card-subtitle">{result.description}</p>
                    </button>
                    <div className="cogita-card-actions">
                      <button
                        type="button"
                        className="ghost"
                        disabled={selectedLookup.has(`${mapItemType(result)}:${result.cardId}`)}
                        onClick={() => handleAdd(result)}
                      >
                        {selectedLookup.has(`${mapItemType(result)}:${result.cardId}`) ? 'Added' : 'Add to collection'}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="cogita-card-empty">
                  <p>No matching cards.</p>
                </div>
              )}
            </div>
          </div>

          <div className="cogita-library-panel">
            <section className="cogita-library-detail">
              <div className="cogita-detail-header">
                <div>
                  <p className="cogita-user-kicker">Selected cards</p>
                  <h3 className="cogita-detail-title">{selected.length} items</h3>
                </div>
              </div>
              {selected.length ? (
                <div className="cogita-card-list" data-view="list">
                  {selected.map((item) => (
                    <div key={`${mapItemType(item)}-${item.cardId}`} className="cogita-card-item">
                      <button type="button" className="cogita-card-select" onClick={() => handleRemove(item.cardId, mapItemType(item))}>
                        <div className="cogita-card-type">{item.cardType}</div>
                        <h3 className="cogita-card-title">{item.label}</h3>
                        <p className="cogita-card-subtitle">{item.description}</p>
                      </button>
                      <button
                        type="button"
                        className="cogita-card-remove"
                        onClick={() => handleRemove(item.cardId, mapItemType(item))}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cogita-card-empty">
                  <p>No cards selected yet. Add cards from the list to build the collection.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
