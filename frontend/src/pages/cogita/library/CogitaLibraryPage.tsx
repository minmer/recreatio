import { useEffect, useMemo, useState } from 'react';
import {
  createCogitaConnection,
  createCogitaGroup,
  createCogitaInfo,
  getCogitaLibraries,
  getCogitaLibraryStats,
  searchCogitaInfos,
  type CogitaInfoSearchResult,
  type CogitaLibraryStats
} from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import type { CogitaLibraryMode, CogitaConnectionType, CogitaGroupType, CogitaInfoType } from './types';

const infoTypeOptions: Array<{ value: CogitaInfoType | 'any'; label: string }> = [
  { value: 'any', label: 'All info types' },
  { value: 'language', label: 'Language' },
  { value: 'word', label: 'Word' },
  { value: 'sentence', label: 'Sentence / citation' },
  { value: 'topic', label: 'Topic' },
  { value: 'person', label: 'Person' },
  { value: 'address', label: 'Address' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'book', label: 'Book' },
  { value: 'media', label: 'Media' },
  { value: 'geo', label: 'Geo' },
  { value: 'music_piece', label: 'Music piece' },
  { value: 'music_fragment', label: 'Music fragment' }
];

const connectionTypeOptions: Array<{ value: CogitaConnectionType; label: string }> = [
  { value: 'word-language', label: 'Word - language' },
  { value: 'language-sentence', label: 'Language - sentence' },
  { value: 'translation', label: 'Translation link' }
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
    languageId: '',
    notes: ''
  });
  const [connectionForm, setConnectionForm] = useState({
    connectionType: 'translation' as CogitaConnectionType,
    infoIds: '',
    note: ''
  });
  const [groupForm, setGroupForm] = useState({
    groupType: 'vocab' as CogitaGroupType,
    languageA: '',
    wordA: '',
    languageB: '',
    wordB: '',
    note: ''
  });
  const [formStatus, setFormStatus] = useState<string | null>(null);

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

  const cardsView = useMemo(() => (mode === 'collection' ? 'grid' : mode === 'list' ? 'list' : 'detail'), [mode]);

  const handleCreateInfo = async () => {
    setFormStatus(null);
    try {
      const payload: Record<string, string> = {
        label: infoForm.label,
        languageId: infoForm.languageId,
        notes: infoForm.notes
      };
      await createCogitaInfo({
        libraryId,
        infoType: infoForm.infoType,
        payload
      });
      setFormStatus('Info saved.');
      setInfoForm({ infoType: infoForm.infoType, label: '', languageId: '', notes: '' });
      setSearchQuery('');
    } catch {
      setFormStatus('Failed to save info.');
    }
  };

  const handleCreateConnection = async () => {
    setFormStatus(null);
    try {
      const infoIds = connectionForm.infoIds
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      await createCogitaConnection({
        libraryId,
        connectionType: connectionForm.connectionType,
        infoIds,
        payload: { note: connectionForm.note }
      });
      setFormStatus('Connection saved.');
      setConnectionForm({ connectionType: connectionForm.connectionType, infoIds: '', note: '' });
    } catch {
      setFormStatus('Failed to save connection.');
    }
  };

  const handleCreateGroup = async () => {
    setFormStatus(null);
    try {
      await createCogitaGroup({
        libraryId,
        groupType: groupForm.groupType,
        infoItems: [
          {
            infoType: 'language',
            payload: { label: groupForm.languageA }
          },
          {
            infoType: 'word',
            payload: { label: groupForm.wordA, language: groupForm.languageA }
          },
          {
            infoType: 'language',
            payload: { label: groupForm.languageB }
          },
          {
            infoType: 'word',
            payload: { label: groupForm.wordB, language: groupForm.languageB }
          }
        ],
        connections: [
          {
            connectionType: 'translation',
            infoIds: []
          }
        ],
        payload: { note: groupForm.note }
      });
      setFormStatus('Vocabulary group saved.');
      setGroupForm({ groupType: groupForm.groupType, languageA: '', wordA: '', languageB: '', wordB: '', note: '' });
    } catch {
      setFormStatus('Failed to save group.');
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
            <span>Groups</span>
            <strong>{stats?.totalGroups ?? 0}</strong>
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
                    <p className="cogita-card-subtitle">{result.infoId}</p>
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
                  <p>ID: {selectedInfo.infoId}</p>
                  <p>Use the editor panel to add connections or groups.</p>
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
                        {tab === 'group' && 'Compose vocab cards with words and translations.'}
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
                    <label className="cogita-field full">
                      <span>Language or context ID</span>
                      <input
                        type="text"
                        value={infoForm.languageId}
                        onChange={(event) => setInfoForm((prev) => ({ ...prev, languageId: event.target.value }))}
                        placeholder="Optional language or context infoId"
                      />
                    </label>
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
                    <label className="cogita-field full">
                      <span>Info IDs</span>
                      <input
                        type="text"
                        value={connectionForm.infoIds}
                        onChange={(event) => setConnectionForm((prev) => ({ ...prev, infoIds: event.target.value }))}
                        placeholder="Comma separated info GUIDs"
                      />
                    </label>
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
                    <label className="cogita-field">
                      <span>Language A</span>
                      <input
                        type="text"
                        value={groupForm.languageA}
                        onChange={(event) => setGroupForm((prev) => ({ ...prev, languageA: event.target.value }))}
                        placeholder="e.g. Latin"
                      />
                    </label>
                    <label className="cogita-field">
                      <span>Word A</span>
                      <input
                        type="text"
                        value={groupForm.wordA}
                        onChange={(event) => setGroupForm((prev) => ({ ...prev, wordA: event.target.value }))}
                        placeholder="e.g. gratia"
                      />
                    </label>
                    <label className="cogita-field">
                      <span>Language B</span>
                      <input
                        type="text"
                        value={groupForm.languageB}
                        onChange={(event) => setGroupForm((prev) => ({ ...prev, languageB: event.target.value }))}
                        placeholder="e.g. English"
                      />
                    </label>
                    <label className="cogita-field">
                      <span>Word B</span>
                      <input
                        type="text"
                        value={groupForm.wordB}
                        onChange={(event) => setGroupForm((prev) => ({ ...prev, wordB: event.target.value }))}
                        placeholder="e.g. grace"
                      />
                    </label>
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
                        Save vocabulary group
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
