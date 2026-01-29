import { useEffect, useMemo, useState } from 'react';
import {
  getCogitaComputedSample,
  getCogitaInfoDetail,
  searchCogitaCards,
  updateCogitaInfo,
  type CogitaCardSearchResult,
  type CogitaComputedSample
} from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import type { CogitaInfoOption, CogitaInfoType, CogitaLibraryMode } from './types';
import { getCardSearchOptions } from './libraryOptions';
import { useCogitaLibraryMeta } from './useCogitaLibraryMeta';
import { InfoSearchSelect } from './components/InfoSearchSelect';
import { CogitaLibrarySidebar } from './components/CogitaLibrarySidebar';
import { LatexBlock, LatexInline } from '../../../components/LatexText';
import { ComputedGraphEditor, type ComputedGraphDefinition } from './components/ComputedGraphEditor';

export function CogitaLibraryListPage({
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
  mode
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
  mode: CogitaLibraryMode;
}) {
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const baseHref = `/#/cogita/library/${libraryId}`;
  const [searchType, setSearchType] = useState<CogitaInfoType | 'any' | 'vocab'>('any');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CogitaCardSearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [selectedInfo, setSelectedInfo] = useState<CogitaCardSearchResult | null>(null);
  const [computedSample, setComputedSample] = useState<CogitaComputedSample | null>(null);
  const [computedSampleStatus, setComputedSampleStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [computedEditStatus, setComputedEditStatus] = useState<'idle' | 'loading' | 'ready' | 'saving' | 'error'>(
    'idle'
  );
  const [isEditingComputed, setIsEditingComputed] = useState(false);
  const [computedEditPrompt, setComputedEditPrompt] = useState('');
  const [computedEditGraph, setComputedEditGraph] = useState<ComputedGraphDefinition | null>(null);
  const [computedEditLabel, setComputedEditLabel] = useState('');
  const [computedEditNotes, setComputedEditNotes] = useState('');
  const [computedEditMessage, setComputedEditMessage] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
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

  useEffect(() => {
    setSearchStatus('loading');
    const handle = window.setTimeout(() => {
      searchCogitaCards({
        libraryId,
        type: searchType === 'any' ? undefined : searchType,
        query: searchQuery.trim() || undefined,
        limit: 30,
        languageAId: applyFilters ? filterState.languageAId : undefined,
        languageBId: applyFilters ? filterState.languageBId : undefined,
        topicId: applyFilters ? filterState.topicId : undefined,
        levelId: applyFilters ? filterState.levelId : undefined
      })
        .then((bundle) => {
          setSearchResults(bundle.items);
          setTotalCount(bundle.total);
          setNextCursor(bundle.nextCursor ?? null);
          setSearchStatus('ready');
          setSelectedInfo(bundle.items[0] ?? null);
        })
        .catch(() => {
          setSearchResults([]);
          setTotalCount(0);
          setNextCursor(null);
          setSearchStatus('ready');
        });
    }, 240);

    return () => window.clearTimeout(handle);
  }, [libraryId, searchQuery, searchType, applyFilters, filterState]);

  useEffect(() => {
    if (!selectedInfo || selectedInfo.cardType !== 'info' || selectedInfo.infoType !== 'computed') {
      setComputedSample(null);
      setComputedSampleStatus('idle');
      return;
    }
    setComputedSampleStatus('loading');
    getCogitaComputedSample({ libraryId, infoId: selectedInfo.cardId })
      .then((sample) => {
        setComputedSample(sample);
        setComputedSampleStatus('ready');
      })
      .catch(() => {
        setComputedSample(null);
        setComputedSampleStatus('ready');
      });
  }, [libraryId, selectedInfo]);

  useEffect(() => {
    setIsEditingComputed(false);
    setComputedEditStatus('idle');
    setComputedEditPrompt('');
    setComputedEditGraph(null);
    setComputedEditLabel('');
    setComputedEditNotes('');
    setComputedEditMessage(null);
  }, [selectedInfo?.cardId]);

  const openComputedEditor = async () => {
    if (!selectedInfo) return;
    setComputedEditStatus('loading');
    setComputedEditMessage(null);
    try {
      const detail = await getCogitaInfoDetail({ libraryId, infoId: selectedInfo.cardId });
      const payload = (detail.payload ?? {}) as {
        label?: string;
        notes?: string;
        definition?: { promptTemplate?: string; graph?: ComputedGraphDefinition | null };
      };
      setComputedEditLabel(payload.label ?? selectedInfo.label ?? '');
      setComputedEditNotes(payload.notes ?? '');
      setComputedEditPrompt(payload.definition?.promptTemplate ?? '');
      setComputedEditGraph(payload.definition?.graph ?? null);
      setIsEditingComputed(true);
      setComputedEditStatus('ready');
    } catch {
      setComputedEditStatus('error');
      setComputedEditMessage(copy.cogita.library.list.computedEditLoadFailed);
    }
  };

  const handleSaveComputedEdit = async () => {
    if (!selectedInfo || !computedEditGraph) {
      setComputedEditMessage(copy.cogita.library.list.computedEditSaveFailed);
      return;
    }
    const invalidName = computedEditGraph.nodes.find((node) => node.name && !/^[A-Za-z][A-Za-z0-9_]*$/.test(node.name));
    if (invalidName) {
      setComputedEditMessage(copy.cogita.library.add.info.computedInvalidName);
      return;
    }
    const names = computedEditGraph.nodes.map((node) => node.name?.trim()).filter(Boolean) as string[];
    const nameSet = new Set<string>();
    for (const name of names) {
      const key = name.toLowerCase();
      if (nameSet.has(key)) {
        setComputedEditMessage(copy.cogita.library.add.info.computedDuplicateName);
        return;
      }
      nameSet.add(key);
    }
    setComputedEditStatus('saving');
    setComputedEditMessage(null);
    try {
      await updateCogitaInfo({
        libraryId,
        infoId: selectedInfo.cardId,
        payload: {
          label: computedEditLabel,
          notes: computedEditNotes,
          definition: {
            promptTemplate: computedEditPrompt,
            graph: computedEditGraph
          }
        }
      });
      setComputedEditStatus('ready');
      setComputedEditMessage(copy.cogita.library.list.computedEditSaved);
      setSelectedInfo((prev) => (prev ? { ...prev, label: computedEditLabel || prev.label } : prev));
      setSearchResults((prev) =>
        prev.map((item) =>
          item.cardId === selectedInfo.cardId
            ? { ...item, label: computedEditLabel || item.label }
            : item
        )
      );
      if (selectedInfo.infoType === 'computed') {
        getCogitaComputedSample({ libraryId, infoId: selectedInfo.cardId })
          .then((sample) => {
            setComputedSample(sample);
            setComputedSampleStatus('ready');
          })
          .catch(() => {
            setComputedSample(null);
            setComputedSampleStatus('ready');
          });
      }
    } catch {
      setComputedEditStatus('error');
      setComputedEditMessage(copy.cogita.library.list.computedEditSaveFailed);
    }
  };

  const handleCancelComputedEdit = () => {
    setIsEditingComputed(false);
    setComputedEditMessage(null);
  };

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setSearchStatus('loading');
    try {
      const bundle = await searchCogitaCards({
        libraryId,
        type: searchType === 'any' ? undefined : searchType,
        query: searchQuery.trim() || undefined,
        limit: 30,
        cursor: nextCursor,
        languageAId: applyFilters ? filterState.languageAId : undefined,
        languageBId: applyFilters ? filterState.languageBId : undefined,
        topicId: applyFilters ? filterState.topicId : undefined,
        levelId: applyFilters ? filterState.levelId : undefined
      });
      setSearchResults((prev) => [...prev, ...bundle.items]);
      setNextCursor(bundle.nextCursor ?? null);
      setTotalCount(bundle.total);
      setSearchStatus('ready');
    } catch {
      setSearchStatus('ready');
    }
  };

  const cardsView = useMemo(() => (mode === 'collection' ? 'grid' : mode === 'list' ? 'list' : 'detail'), [mode]);
  const cardSearchOptions = useMemo(() => getCardSearchOptions(copy), [copy]);
  const cardCountLabel = useMemo(() => {
    const total = totalCount || searchResults.length;
    return copy.cogita.library.list.cardCount
      .replace('{shown}', String(searchResults.length))
      .replace('{total}', String(total));
  }, [copy, searchResults.length, totalCount]);

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
      <section className="cogita-library-dashboard" data-mode={cardsView}>
        <header className="cogita-library-dashboard-header">
          <div>
            <p className="cogita-user-kicker">{copy.cogita.library.list.kicker}</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">{copy.cogita.library.list.subtitle}</p>
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
            <a className="cta" href={`${baseHref}/new`}>
              {copy.cogita.library.actions.addInfo}
            </a>
          </div>
        </header>

        <div className="cogita-library-modes">
          {(['detail', 'collection', 'list'] as const).map((item) => (
            <a key={item} className="ghost" data-active={mode === item} href={`${baseHref}/${item}`}>
              {item === 'detail'
                ? copy.cogita.library.list.modes.detail
                : item === 'collection'
                ? copy.cogita.library.list.modes.collection
                : copy.cogita.library.list.modes.list}
            </a>
          ))}
        </div>

        <div className="cogita-library-layout">
          <CogitaLibrarySidebar libraryId={libraryId} labels={copy.cogita.library.sidebar} />
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane">
                <div className="cogita-library-controls">
                  <div className="cogita-library-search">
                    <p className="cogita-user-kicker">{copy.cogita.library.list.searchTitle}</p>
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
                        placeholder={copy.cogita.library.list.searchPlaceholder}
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
                </div>

                <div className="cogita-card-count">
                  <span>{cardCountLabel}</span>
                  <span>{searchStatus === 'loading' ? copy.cogita.library.list.loading : copy.cogita.library.list.ready}</span>
                </div>

                <div className="cogita-card-list" data-view={mode === 'collection' ? 'grid' : 'list'}>
                  {searchResults.length ? (
                    searchResults.map((result) => (
                      <button
                        key={result.cardId}
                        type="button"
                        className="cogita-card-item"
                        data-selected={selectedInfo?.cardId === result.cardId}
                        onClick={() => setSelectedInfo(result)}
                      >
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
                    ))
                  ) : (
                    <div className="cogita-card-empty">
                      <p>{copy.cogita.library.list.noMatch}</p>
                      <a className="ghost" href={`${baseHref}/new`}>
                        {copy.cogita.library.list.addInfo}
                      </a>
                    </div>
                  )}
                </div>
                {nextCursor ? (
                  <div className="cogita-form-actions">
                    <button type="button" className="cta ghost" onClick={handleLoadMore}>
                      {copy.cogita.library.list.loadMore}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="cogita-library-panel">
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.library.list.selectedTitle}</p>
                      <h3 className="cogita-detail-title">{selectedInfo?.label ?? copy.cogita.library.list.selectedEmpty}</h3>
                    </div>
                    <div className="cogita-detail-actions">
                      {selectedInfo?.cardType === 'info' && selectedInfo.infoType === 'computed' ? (
                        <button
                          type="button"
                          className="ghost"
                          onClick={isEditingComputed ? handleCancelComputedEdit : openComputedEditor}
                        >
                          {isEditingComputed
                            ? copy.cogita.library.list.computedEditCancel
                            : copy.cogita.library.list.computedEditAction}
                        </button>
                      ) : null}
                      <a className="ghost" href={`${baseHref}/new`}>
                        {copy.cogita.library.actions.addInfo}
                      </a>
                    </div>
                  </div>
                  {selectedInfo ? (
                    <div className="cogita-detail-body">
                      <p>
                        {selectedInfo.cardType === 'vocab'
                          ? copy.cogita.library.list.cardTypeVocab
                          : selectedInfo.cardType === 'connection'
                          ? copy.cogita.library.list.cardTypeConnection
                          : copy.cogita.library.list.cardTypeInfo}
                      </p>
                      <p>{copy.cogita.library.list.selectedHint}</p>
                      {selectedInfo.cardType === 'info' && selectedInfo.infoType === 'computed' && (
                        <div className="cogita-detail-sample">
                          <p className="cogita-user-kicker">
                            {isEditingComputed
                              ? copy.cogita.library.list.computedEditTitle
                              : copy.cogita.library.list.computedSampleTitle}
                          </p>
                          {isEditingComputed ? (
                            <>
                              {computedEditStatus === 'loading' && <p>{copy.cogita.library.list.computedEditLoading}</p>}
                              {computedEditStatus === 'error' && computedEditMessage ? <p>{computedEditMessage}</p> : null}
                              {computedEditStatus !== 'loading' ? (
                                <>
                                  <label className="cogita-field full">
                                    <span>{copy.cogita.library.add.info.labelLabel}</span>
                                    <input
                                      type="text"
                                      value={computedEditLabel}
                                      onChange={(event) => setComputedEditLabel(event.target.value)}
                                      placeholder={copy.cogita.library.add.info.labelPlaceholder}
                                    />
                                  </label>
                                  <label className="cogita-field full">
                                    <span>{copy.cogita.library.add.info.notesLabel}</span>
                                    <textarea
                                      value={computedEditNotes}
                                      onChange={(event) => setComputedEditNotes(event.target.value)}
                                      placeholder={copy.cogita.library.add.info.notesPlaceholder}
                                    />
                                  </label>
                                  <label className="cogita-field full">
                                    <span>{copy.cogita.library.add.info.computedLabel}</span>
                                    <textarea
                                      value={computedEditPrompt}
                                      onChange={(event) => setComputedEditPrompt(event.target.value)}
                                      placeholder={copy.cogita.library.add.info.computedPlaceholder}
                                    />
                                  </label>
                                  <div className="cogita-field full">
                                    <ComputedGraphEditor
                                      copy={copy}
                                      value={computedEditGraph}
                                      onChange={(definition) => setComputedEditGraph(definition)}
                                    />
                                  </div>
                                  {computedEditMessage ? <p className="cogita-help">{computedEditMessage}</p> : null}
                                  <div className="cogita-form-actions">
                                    <button
                                      type="button"
                                      className="cta"
                                      onClick={handleSaveComputedEdit}
                                      disabled={computedEditStatus === 'saving'}
                                    >
                                      {computedEditStatus === 'saving'
                                        ? copy.cogita.library.list.computedEditSaving
                                        : copy.cogita.library.list.computedEditSaveAction}
                                    </button>
                                    <button type="button" className="ghost" onClick={handleCancelComputedEdit}>
                                      {copy.cogita.library.list.computedEditCancel}
                                    </button>
                                  </div>
                                </>
                              ) : null}
                            </>
                          ) : (
                            <>
                              {computedSampleStatus === 'loading' && <p>{copy.cogita.library.list.computedLoading}</p>}
                              {computedSampleStatus !== 'loading' && computedSample ? (
                                <>
                                  <p>
                                    <strong>{copy.cogita.library.list.computedPromptLabel}</strong>
                                  </p>
                                  <LatexBlock value={computedSample.prompt} mode="auto" />
                                  {computedSample.expectedAnswers && Object.keys(computedSample.expectedAnswers).length > 0 ? (
                                    <div className="cogita-detail-sample-grid">
                                      {Object.entries(computedSample.expectedAnswers).map(([key, value]) => (
                                        <div key={key} className="cogita-detail-sample-item">
                                          <span>{key}</span>
                                          <LatexInline value={value} mode="auto" />
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p>
                                      <strong>{copy.cogita.library.list.computedAnswerLabel}</strong>{' '}
                                      <LatexInline value={computedSample.expectedAnswer} mode="auto" />
                                    </p>
                                  )}
                                </>
                              ) : computedSampleStatus !== 'loading' ? (
                                <p>{copy.cogita.library.list.computedEmpty}</p>
                              ) : null}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="cogita-card-empty">
                      <p>{copy.cogita.library.list.selectedEmpty}</p>
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
