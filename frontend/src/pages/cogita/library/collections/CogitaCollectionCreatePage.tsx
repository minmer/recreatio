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
import type { CogitaInfoOption, CogitaInfoType } from '../types';
import { getCardSearchOptions } from '../libraryOptions';
import { useCogitaLibraryMeta } from '../useCogitaLibraryMeta';
import { InfoSearchSelect } from '../components/InfoSearchSelect';
import { CogitaLibrarySidebar } from '../components/CogitaLibrarySidebar';

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
  onCreated: (collectionId: string) => void;
}) {
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const baseHref = `/#/cogita/library/${libraryId}`;
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [searchType, setSearchType] = useState<CogitaInfoType | 'any' | 'vocab'>('any');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CogitaCardSearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [selected, setSelected] = useState<CogitaCardSearchResult[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const cardSearchOptions = useMemo(() => getCardSearchOptions(copy), [copy]);
  const resultCountLabel = useMemo(
    () =>
      copy.cogita.library.list.cardCount
        .replace('{shown}', String(searchResults.length))
        .replace('{total}', String(searchResults.length)),
    [copy, searchResults.length]
  );
  const [filterLanguageA, setFilterLanguageA] = useState<CogitaInfoOption | null>(null);
  const [filterLanguageB, setFilterLanguageB] = useState<CogitaInfoOption | null>(null);
  const [filterTopic, setFilterTopic] = useState<CogitaInfoOption | null>(null);
  const [filterLevel, setFilterLevel] = useState<CogitaInfoOption | null>(null);

  const filterState = useMemo(
    () => ({
      languageAId: filterLanguageA?.id ?? undefined,
      languageBId: filterLanguageB?.id ?? undefined,
      topicId: filterTopic?.id ?? undefined,
      levelId: filterLevel?.id ?? undefined
    }),
    [filterLanguageA, filterLanguageB, filterTopic, filterLevel]
  );
  const applyFilters = useMemo(() => searchType === 'vocab' || searchType === 'any', [searchType]);

  const selectedLookup = useMemo(() => new Set(selected.map((item) => `${mapItemType(item)}:${item.cardId}`)), [selected]);

  useEffect(() => {
    setSearchStatus('loading');
    const handle = window.setTimeout(() => {
      searchCogitaCards({
        libraryId,
        type: searchType === 'any' ? undefined : searchType,
        query: searchQuery.trim() || undefined,
        limit: 40,
        languageAId: applyFilters ? filterState.languageAId : undefined,
        languageBId: applyFilters ? filterState.languageBId : undefined,
        topicId: applyFilters ? filterState.topicId : undefined,
        levelId: applyFilters ? filterState.levelId : undefined
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
  }, [libraryId, searchQuery, searchType, applyFilters, filterState]);

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
      setStatusMessage(copy.cogita.library.collections.saveRequiredName);
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
      setStatusMessage(copy.cogita.library.collections.saveSuccess);
      onCreated(created.collectionId);
    } catch {
      setStatusMessage(copy.cogita.library.collections.saveFail);
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
            <p className="cogita-user-kicker">{copy.cogita.library.collections.createKicker}</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">{copy.cogita.library.collections.createSubtitle}</p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href="/#/cogita">
              {copy.cogita.library.actions.backToCogita}
            </a>
            <a className="cta ghost" href={baseHref}>
              {copy.cogita.library.actions.libraryOverview}
            </a>
            <a className="cta ghost" href={`${baseHref}/collections`}>
              {copy.cogita.library.actions.collections}
            </a>
            <button type="button" className="cta" onClick={handleCreate}>
              {copy.cogita.library.actions.saveCollection}
            </button>
          </div>
        </header>

        <div className="cogita-library-layout">
          <CogitaLibrarySidebar libraryId={libraryId} labels={copy.cogita.library.sidebar} />
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane">
                <div className="cogita-library-controls">
                  <div className="cogita-library-search">
                    <p className="cogita-user-kicker">{copy.cogita.library.collections.collectionInfoTitle}</p>
                    <label className="cogita-field">
                      <span>{copy.cogita.library.collections.nameLabel}</span>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder={copy.cogita.library.collections.namePlaceholder}
                      />
                    </label>
                    <label className="cogita-field">
                      <span>{copy.cogita.library.collections.notesLabel}</span>
                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder={copy.cogita.library.collections.notesPlaceholder}
                      />
                    </label>
                    {statusMessage ? <p className="cogita-help">{statusMessage}</p> : null}
                  </div>
                </div>

                <div className="cogita-library-search">
                  <p className="cogita-user-kicker">{copy.cogita.library.collections.findCardsTitle}</p>
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
                      placeholder={copy.cogita.library.collections.searchCardsPlaceholder}
                    />
                  </div>
                </div>

                {(searchType === 'vocab' || searchType === 'any') && (
                  <div className="cogita-library-filters">
                    <p className="cogita-user-kicker">{copy.cogita.library.filters.title}</p>
                    <div className="cogita-filter-grid">
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="language"
                        label={copy.cogita.library.filters.languageA}
                        placeholder={copy.cogita.library.filters.placeholderLanguageA}
                        value={filterLanguageA}
                        onChange={setFilterLanguageA}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="language"
                        label={copy.cogita.library.filters.languageB}
                        placeholder={copy.cogita.library.filters.placeholderLanguageB}
                        value={filterLanguageB}
                        onChange={setFilterLanguageB}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="topic"
                        label={copy.cogita.library.filters.topic}
                        placeholder={copy.cogita.library.filters.placeholderTopic}
                        value={filterTopic}
                        onChange={setFilterTopic}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.topic)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="topic"
                        label={copy.cogita.library.filters.level}
                        placeholder={copy.cogita.library.filters.placeholderLevel}
                        value={filterLevel}
                        onChange={setFilterLevel}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.filters.level)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                    </div>
                    {(filterLanguageA || filterLanguageB || filterTopic || filterLevel) && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setFilterLanguageA(null);
                          setFilterLanguageB(null);
                          setFilterTopic(null);
                          setFilterLevel(null);
                        }}
                      >
                        {copy.cogita.library.filters.clear}
                      </button>
                    )}
                  </div>
                )}

                <div className="cogita-card-count">
                  <span>{resultCountLabel}</span>
                  <span>{searchStatus === 'loading' ? copy.cogita.library.collections.loading : copy.cogita.library.collections.ready}</span>
                </div>

                <div className="cogita-card-list" data-view="list">
                  {searchResults.length ? (
                    searchResults.map((result) => (
                      <div key={result.cardId} className="cogita-card-item">
                        <button type="button" className="cogita-card-select" onClick={() => handleAdd(result)}>
                          <div className="cogita-card-type">
                            {result.cardType === 'vocab'
                              ? copy.cogita.library.list.cardTypeVocab
                              : result.cardType === 'connection'
                              ? copy.cogita.library.list.cardTypeConnection
                              : copy.cogita.library.list.cardTypeInfo}
                          </div>
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
                            {selectedLookup.has(`${mapItemType(result)}:${result.cardId}`)
                              ? copy.cogita.library.collections.added
                              : copy.cogita.library.collections.addToCollection}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="cogita-card-empty">
                      <p>{copy.cogita.library.list.noMatch}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="cogita-library-panel">
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.library.collections.selectedCardsTitle}</p>
                      <h3 className="cogita-detail-title">
                        {copy.cogita.library.collections.selectedCountLabel.replace('{count}', String(selected.length))}
                      </h3>
                    </div>
                  </div>
                  {selected.length ? (
                    <div className="cogita-card-list" data-view="list">
                      {selected.map((item) => (
                        <div key={`${mapItemType(item)}-${item.cardId}`} className="cogita-card-item">
                          <button type="button" className="cogita-card-select" onClick={() => handleRemove(item.cardId, mapItemType(item))}>
                            <div className="cogita-card-type">
                              {item.cardType === 'vocab'
                                ? copy.cogita.library.list.cardTypeVocab
                                : item.cardType === 'connection'
                                ? copy.cogita.library.list.cardTypeConnection
                                : copy.cogita.library.list.cardTypeInfo}
                            </div>
                            <h3 className="cogita-card-title">{item.label}</h3>
                            <p className="cogita-card-subtitle">{item.description}</p>
                          </button>
                          <button
                            type="button"
                            className="cogita-card-remove"
                            onClick={() => handleRemove(item.cardId, mapItemType(item))}
                          >
                            {copy.cogita.library.collections.remove}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="cogita-card-empty">
                      <p>{copy.cogita.library.collections.noSelected}</p>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
