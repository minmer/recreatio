import { useEffect, useMemo, useState } from 'react';
import {
  createCogitaConnection,
  createCogitaInfo,
  checkCogitaWordLanguage,
  getCogitaLibraries,
  getCogitaLibraryStats,
  searchCogitaInfos,
  type CogitaInfoSearchResult,
  type CogitaLibraryStats
} from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import type { CogitaInfoOption, CogitaLibraryMode, CogitaConnectionType, CogitaGroupType, CogitaInfoType } from './types';
import { InfoSearchSelect } from './components/InfoSearchSelect';

const infoTypeOptions: Array<{ value: CogitaInfoType | 'any'; label: string }> = [
  { value: 'any', label: 'All info types' },
  { value: 'language', label: 'Language' },
  { value: 'word', label: 'Word' },
  { value: 'sentence', label: 'Sentence / citation' },
  { value: 'topic', label: 'Topic' },
  { value: 'person', label: 'Person' },
  { value: 'institution', label: 'Institution' },
  { value: 'collective', label: 'Collective' },
  { value: 'orcid', label: 'ORCID' },
  { value: 'address', label: 'Address' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'media', label: 'Media' },
  { value: 'work', label: 'Work' },
  { value: 'geo', label: 'Geo' },
  { value: 'music_piece', label: 'Music piece' },
  { value: 'music_fragment', label: 'Music fragment' },
  { value: 'source', label: 'Source' },
  { value: 'quote', label: 'Quote' }
];

const connectionTypeOptions: Array<{ value: CogitaConnectionType; label: string }> = [
  { value: 'word-language', label: 'Word - language' },
  { value: 'language-sentence', label: 'Language - sentence' },
  { value: 'translation', label: 'Translation link' },
  { value: 'reference', label: 'Info - source' },
  { value: 'source-resource', label: 'Source - resource' },
  { value: 'quote-language', label: 'Quote - language' },
  { value: 'work-contributor', label: 'Work - contributor' },
  { value: 'work-medium', label: 'Work - medium' },
  { value: 'orcid-link', label: 'ORCID link' }
];

const groupTypeOptions: Array<{ value: CogitaGroupType; label: string }> = [{ value: 'vocab', label: 'Vocabulary card' }];

export function CogitaLibraryPage({
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
  mode,
  onModeChange,
  onBackToOverview
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
  onModeChange: (mode: CogitaLibraryMode) => void;
  onBackToOverview: () => void;
}) {
  const [libraryName, setLibraryName] = useState('Cogita library');
  const [stats, setStats] = useState<CogitaLibraryStats | null>(null);
  const [searchType, setSearchType] = useState<CogitaInfoType | 'any'>('any');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CogitaInfoSearchResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [selectedInfo, setSelectedInfo] = useState<CogitaInfoSearchResult | null>(null);
  const [activePanel, setActivePanel] = useState<'none' | 'create'>('none');
  const [activeTab, setActiveTab] = useState<'info' | 'connection' | 'group'>('info');
  const [infoForm, setInfoForm] = useState({
    infoType: 'word' as CogitaInfoType,
    label: '',
    language: null as CogitaInfoOption | null,
    notes: ''
  });
  const [connectionForm, setConnectionForm] = useState({
    connectionType: 'translation' as CogitaConnectionType,
    language: null as CogitaInfoOption | null,
    word: null as CogitaInfoOption | null,
    wordA: null as CogitaInfoOption | null,
    wordB: null as CogitaInfoOption | null,
    sentence: null as CogitaInfoOption | null,
    note: ''
  });
  const [groupForm, setGroupForm] = useState({
    groupType: 'vocab' as CogitaGroupType,
    languageA: null as CogitaInfoOption | null,
    wordA: null as CogitaInfoOption | null,
    languageB: null as CogitaInfoOption | null,
    wordB: null as CogitaInfoOption | null,
    note: ''
  });
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [pairStatus, setPairStatus] = useState<string | null>(null);
  const [groupPairStatusA, setGroupPairStatusA] = useState<string | null>(null);
  const [groupPairStatusB, setGroupPairStatusB] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCogitaLibraries()
      .then((libraries) => {
        if (cancelled) return;
        const match = libraries.find((library) => library.libraryId === libraryId);
        if (match) setLibraryName(match.name);
      })
      .catch(() => {
        if (!cancelled) setLibraryName('Cogita library');
      });
    return () => {
      cancelled = true;
    };
  }, [libraryId]);

  useEffect(() => {
    let cancelled = false;
    getCogitaLibraryStats(libraryId)
      .then((next) => {
        if (cancelled) return;
        setStats(next);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [libraryId]);

  useEffect(() => {
    setSearchStatus('loading');
    const handle = window.setTimeout(() => {
      searchCogitaInfos({
        libraryId,
        type: searchType === 'any' ? undefined : searchType,
        query: searchQuery.trim() || undefined
      })
        .then((results) => {
          setSearchResults(results);
          setSearchStatus('ready');
          setSelectedInfo(results[0] ?? null);
        })
        .catch(() => {
          setSearchResults([]);
          setSearchStatus('ready');
        });
    }, 240);

    return () => window.clearTimeout(handle);
  }, [libraryId, searchQuery, searchType]);

  useEffect(() => {
    if (!connectionForm.language || !connectionForm.word) {
      setPairStatus(null);
      return;
    }
    const handle = window.setTimeout(() => {
      checkCogitaWordLanguage({
        libraryId,
        languageId: connectionForm.language!.id,
        wordId: connectionForm.word!.id
      })
        .then((result) => {
          setPairStatus(result.exists ? 'This word already belongs to that language.' : null);
        })
        .catch(() => {
          setPairStatus(null);
        });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [libraryId, connectionForm.language, connectionForm.word]);

  useEffect(() => {
    if (!groupForm.languageA || !groupForm.wordA) {
      setGroupPairStatusA(null);
      return;
    }
    const handle = window.setTimeout(() => {
      checkCogitaWordLanguage({
        libraryId,
        languageId: groupForm.languageA!.id,
        wordId: groupForm.wordA!.id
      })
        .then((result) => {
          setGroupPairStatusA(result.exists ? 'Word A already belongs to Language A.' : null);
        })
        .catch(() => {
          setGroupPairStatusA(null);
        });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [libraryId, groupForm.languageA, groupForm.wordA]);

  useEffect(() => {
    if (!groupForm.languageB || !groupForm.wordB) {
      setGroupPairStatusB(null);
      return;
    }
    const handle = window.setTimeout(() => {
      checkCogitaWordLanguage({
        libraryId,
        languageId: groupForm.languageB!.id,
        wordId: groupForm.wordB!.id
      })
        .then((result) => {
          setGroupPairStatusB(result.exists ? 'Word B already belongs to Language B.' : null);
        })
        .catch(() => {
          setGroupPairStatusB(null);
        });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [libraryId, groupForm.languageB, groupForm.wordB]);

  const cardsView = useMemo(() => (mode === 'collection' ? 'grid' : mode === 'list' ? 'list' : 'detail'), [mode]);

  const handleCreateInfo = async () => {
    setFormStatus(null);
    try {
      const payload: Record<string, string> = {
        label: infoForm.label,
        notes: infoForm.notes
      };
      if (infoForm.language) {
        payload.languageId = infoForm.language.id;
      }
      await createCogitaInfo({
        libraryId,
        infoType: infoForm.infoType,
        payload
      });
      setFormStatus('Info saved.');
      setInfoForm({ infoType: infoForm.infoType, label: '', language: null, notes: '' });
      setSearchQuery('');
    } catch {
      setFormStatus('Failed to save info.');
    }
  };

  const handleCreateConnection = async () => {
    setFormStatus(null);
    try {
      if (connectionForm.connectionType === 'word-language') {
        if (!connectionForm.language || !connectionForm.word) {
          setFormStatus('Select a language and a word.');
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.language.id, connectionForm.word.id],
          payload: { note: connectionForm.note }
        });
      } else if (connectionForm.connectionType === 'translation') {
        if (!connectionForm.wordA || !connectionForm.wordB) {
          setFormStatus('Select two words to link.');
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.wordA.id, connectionForm.wordB.id],
          payload: { note: connectionForm.note }
        });
      } else if (connectionForm.connectionType === 'language-sentence') {
        if (!connectionForm.language || !connectionForm.sentence) {
          setFormStatus('Select a language and a sentence.');
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.language.id, connectionForm.sentence.id],
          payload: { note: connectionForm.note }
        });
      }
      setFormStatus('Connection saved.');
      setConnectionForm({
        connectionType: connectionForm.connectionType,
        language: null,
        word: null,
        wordA: null,
        wordB: null,
        sentence: null,
        note: ''
      });
    } catch {
      setFormStatus('Failed to save connection.');
    }
  };

  const handleCreateGroup = async () => {
    setFormStatus(null);
    try {
      if (!groupForm.languageA || !groupForm.wordA || !groupForm.languageB || !groupForm.wordB) {
        setFormStatus('Select both languages and both words.');
        return;
      }

      if (!groupPairStatusA) {
        await createCogitaConnection({
          libraryId,
          connectionType: 'word-language',
          infoIds: [groupForm.languageA.id, groupForm.wordA.id],
          payload: { note: groupForm.note }
        });
      }

      if (!groupPairStatusB) {
        await createCogitaConnection({
          libraryId,
          connectionType: 'word-language',
          infoIds: [groupForm.languageB.id, groupForm.wordB.id],
          payload: { note: groupForm.note }
        });
      }

      await createCogitaConnection({
        libraryId,
        connectionType: 'translation',
        infoIds: [groupForm.wordA.id, groupForm.wordB.id],
        payload: { note: groupForm.note }
      });

      setFormStatus('Vocabulary connections saved.');
      setGroupForm({
        groupType: groupForm.groupType,
        languageA: null,
        wordA: null,
        languageB: null,
        wordB: null,
        note: ''
      });
    } catch {
      setFormStatus('Failed to save vocabulary connections.');
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
      <section className="cogita-library-dashboard" data-mode={cardsView}>
        <header className="cogita-library-dashboard-header">
          <div>
            <p className="cogita-user-kicker">Library</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">A knowledge library with encrypted index cards.</p>
          </div>
          <div className="cogita-library-actions">
            <button type="button" className="cta ghost" onClick={onBackToOverview}>
              Back to Cogita
            </button>
            <button type="button" className="cta" onClick={() => setActivePanel(activePanel === 'create' ? 'none' : 'create')}>
              {activePanel === 'create' ? 'Close editor' : 'Add new info'}
            </button>
          </div>
        </header>

        <div className="cogita-library-modes">
          {(['detail', 'collection', 'list'] as const).map((item) => (
            <button
              key={item}
              type="button"
              className="ghost"
              data-active={mode === item}
              onClick={() => onModeChange(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="cogita-library-stats">
          <div className="cogita-stat-card">
            <span>Total infos</span>
            <strong>{stats?.totalInfos ?? 0}</strong>
          </div>
          <div className="cogita-stat-card">
            <span>Connections</span>
            <strong>{stats?.totalConnections ?? 0}</strong>
          </div>
          <div className="cogita-stat-card">
            <span>Words</span>
            <strong>{stats?.totalWords ?? 0}</strong>
          </div>
          <div className="cogita-stat-card">
            <span>Sentences</span>
            <strong>{stats?.totalSentences ?? 0}</strong>
          </div>
          <div className="cogita-stat-card">
            <span>Languages</span>
            <strong>{stats?.totalLanguages ?? 0}</strong>
          </div>
        </div>

        <div className="cogita-library-grid">
          <div className="cogita-library-pane">
            <div className="cogita-library-controls">
              <div className="cogita-library-search">
                <p className="cogita-user-kicker">Search</p>
                <div className="cogita-search-field">
                  <select
                    value={searchType}
                    onChange={(event) => setSearchType(event.target.value as CogitaInfoType | 'any')}
                  >
                    {infoTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search text, name, or label"
                  />
                </div>
              </div>
            </div>

            <div className="cogita-card-count">
              <span>{searchResults.length} infos</span>
              <span>{searchStatus === 'loading' ? 'Searching...' : 'Ready'}</span>
            </div>

            <div className="cogita-card-list" data-view={mode === 'collection' ? 'grid' : 'list'}>
              {searchResults.length ? (
                searchResults.map((result) => (
                  <button
                    key={result.infoId}
                    type="button"
                    className="cogita-card-item"
                    data-selected={selectedInfo?.infoId === result.infoId}
                    onClick={() => setSelectedInfo(result)}
                  >
                    <div className="cogita-card-type">{result.infoType}</div>
                    <h3 className="cogita-card-title">{result.label}</h3>
                    <p className="cogita-card-subtitle">Encrypted info</p>
                  </button>
                ))
              ) : (
                <div className="cogita-card-empty">
                  <p>No matching info found.</p>
                  <button type="button" className="ghost" onClick={() => setActivePanel('create')}>
                    Add information
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="cogita-library-panel">
            <section className="cogita-library-detail">
              <div className="cogita-detail-header">
                <div>
                  <p className="cogita-user-kicker">Selected info</p>
                  <h3 className="cogita-detail-title">{selectedInfo?.label ?? 'Pick an info card'}</h3>
                </div>
                <div className="cogita-detail-actions">
                  <button type="button" className="ghost" onClick={() => setActivePanel('create')}>
                    Add info
                  </button>
                </div>
              </div>
              {selectedInfo ? (
                <div className="cogita-detail-body">
                  <p>Type: {selectedInfo.infoType}</p>
                  <p>Use the editor panel to add connections or vocab links.</p>
                </div>
              ) : (
                <div className="cogita-card-empty">
                  <p>No info selected yet.</p>
                </div>
              )}
            </section>

            {activePanel === 'create' ? (
              <section className="cogita-library-create">
                <div className="cogita-detail-header">
                  <div>
                    <p className="cogita-user-kicker">Create</p>
                    <h3 className="cogita-detail-title">Add information</h3>
                  </div>
                </div>

                <div className="cogita-type-grid">
                  {(['info', 'connection', 'group'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className="cogita-type-card"
                      data-active={activeTab === tab}
                      onClick={() => setActiveTab(tab)}
                    >
                      <span className="cogita-type-label">{tab}</span>
                      <span className="cogita-type-desc">
                        {tab === 'info' && 'Add a language, word, sentence, topic, person, or data item.'}
                        {tab === 'connection' && 'Connect two or more infos with a typed relation.'}
                        {tab === 'group' && 'Create vocab links using words, languages, and translations.'}
                      </span>
                    </button>
                  ))}
                </div>

                {activeTab === 'info' ? (
                  <div className="cogita-form-grid">
                    <label className="cogita-field full">
                      <span>Info type</span>
                      <select
                        value={infoForm.infoType}
                        onChange={(event) =>
                          setInfoForm((prev) => ({ ...prev, infoType: event.target.value as CogitaInfoType }))
                        }
                      >
                        {infoTypeOptions
                          .filter((option) => option.value !== 'any')
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="cogita-field full">
                      <span>Label</span>
                      <input
                        type="text"
                        value={infoForm.label}
                        onChange={(event) => setInfoForm((prev) => ({ ...prev, label: event.target.value }))}
                        placeholder="Title, name, or main text"
                      />
                    </label>
                    {(infoForm.infoType === 'word' || infoForm.infoType === 'sentence') && (
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="language"
                        label="Language"
                        placeholder="Search or create a language"
                        value={infoForm.language}
                        onChange={(value) => setInfoForm((prev) => ({ ...prev, language: value }))}
                      />
                    )}
                    <label className="cogita-field full">
                      <span>Notes</span>
                      <textarea
                        value={infoForm.notes}
                        onChange={(event) => setInfoForm((prev) => ({ ...prev, notes: event.target.value }))}
                        placeholder="Description, citation source, or extra metadata"
                      />
                    </label>
                    <div className="cogita-form-actions full">
                      <button type="button" className="cta" onClick={handleCreateInfo}>
                        Save info
                      </button>
                    </div>
                  </div>
                ) : null}

                {activeTab === 'connection' ? (
                  <div className="cogita-form-grid">
                    <label className="cogita-field full">
                      <span>Connection type</span>
                      <select
                        value={connectionForm.connectionType}
                        onChange={(event) =>
                          setConnectionForm((prev) => ({
                            ...prev,
                            connectionType: event.target.value as CogitaConnectionType
                          }))
                        }
                      >
                        {connectionTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {connectionForm.connectionType === 'word-language' && (
                      <>
                        <InfoSearchSelect
                          libraryId={libraryId}
                          infoType="language"
                          label="Language"
                          placeholder="Search or create a language"
                          value={connectionForm.language}
                          onChange={(value) => setConnectionForm((prev) => ({ ...prev, language: value }))}
                        />
                        <InfoSearchSelect
                          libraryId={libraryId}
                          infoType="word"
                          label="Word"
                          placeholder="Search or create a word"
                          value={connectionForm.word}
                          onChange={(value) => setConnectionForm((prev) => ({ ...prev, word: value }))}
                        />
                        {pairStatus && <p className="cogita-help">{pairStatus}</p>}
                      </>
                    )}
                    {connectionForm.connectionType === 'translation' && (
                      <>
                        <InfoSearchSelect
                          libraryId={libraryId}
                          infoType="word"
                          label="Word A"
                          placeholder="Search or create word A"
                          value={connectionForm.wordA}
                          onChange={(value) => setConnectionForm((prev) => ({ ...prev, wordA: value }))}
                        />
                        <InfoSearchSelect
                          libraryId={libraryId}
                          infoType="word"
                          label="Word B"
                          placeholder="Search or create word B"
                          value={connectionForm.wordB}
                          onChange={(value) => setConnectionForm((prev) => ({ ...prev, wordB: value }))}
                        />
                      </>
                    )}
                    {connectionForm.connectionType === 'language-sentence' && (
                      <>
                        <InfoSearchSelect
                          libraryId={libraryId}
                          infoType="language"
                          label="Language"
                          placeholder="Search or create a language"
                          value={connectionForm.language}
                          onChange={(value) => setConnectionForm((prev) => ({ ...prev, language: value }))}
                        />
                        <InfoSearchSelect
                          libraryId={libraryId}
                          infoType="sentence"
                          label="Sentence"
                          placeholder="Search or create a sentence"
                          value={connectionForm.sentence}
                          onChange={(value) => setConnectionForm((prev) => ({ ...prev, sentence: value }))}
                        />
                      </>
                    )}
                    <label className="cogita-field full">
                      <span>Note</span>
                      <textarea
                        value={connectionForm.note}
                        onChange={(event) => setConnectionForm((prev) => ({ ...prev, note: event.target.value }))}
                        placeholder="Optional context for the connection"
                      />
                    </label>
                    <div className="cogita-form-actions full">
                      <button type="button" className="cta" onClick={handleCreateConnection}>
                        Save connection
                      </button>
                    </div>
                  </div>
                ) : null}

                {activeTab === 'group' ? (
                  <div className="cogita-form-grid">
                    <label className="cogita-field full">
                      <span>Group type</span>
                      <select
                        value={groupForm.groupType}
                        onChange={(event) =>
                          setGroupForm((prev) => ({ ...prev, groupType: event.target.value as CogitaGroupType }))
                        }
                      >
                        {groupTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <InfoSearchSelect
                      libraryId={libraryId}
                      infoType="language"
                      label="Language A"
                      placeholder="Search or create Language A"
                      value={groupForm.languageA}
                      onChange={(value) => setGroupForm((prev) => ({ ...prev, languageA: value }))}
                    />
                    <InfoSearchSelect
                      libraryId={libraryId}
                      infoType="word"
                      label="Word A"
                      placeholder="Search or create Word A"
                      value={groupForm.wordA}
                      onChange={(value) => setGroupForm((prev) => ({ ...prev, wordA: value }))}
                    />
                    {groupPairStatusA && <p className="cogita-help">{groupPairStatusA}</p>}
                    <InfoSearchSelect
                      libraryId={libraryId}
                      infoType="language"
                      label="Language B"
                      placeholder="Search or create Language B"
                      value={groupForm.languageB}
                      onChange={(value) => setGroupForm((prev) => ({ ...prev, languageB: value }))}
                    />
                    <InfoSearchSelect
                      libraryId={libraryId}
                      infoType="word"
                      label="Word B"
                      placeholder="Search or create Word B"
                      value={groupForm.wordB}
                      onChange={(value) => setGroupForm((prev) => ({ ...prev, wordB: value }))}
                    />
                    {groupPairStatusB && <p className="cogita-help">{groupPairStatusB}</p>}
                    <label className="cogita-field full">
                      <span>Notes</span>
                      <textarea
                        value={groupForm.note}
                        onChange={(event) => setGroupForm((prev) => ({ ...prev, note: event.target.value }))}
                        placeholder="Optional context for the vocabulary card"
                      />
                    </label>
                    <div className="cogita-form-actions full">
                      <button type="button" className="cta" onClick={handleCreateGroup}>
                        Save vocabulary links
                      </button>
                    </div>
                  </div>
                ) : null}

                {formStatus ? <p className="cogita-form-error">{formStatus}</p> : null}
              </section>
            ) : null}
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
