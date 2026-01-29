import { useEffect, useMemo, useRef, useState } from 'react';
import { checkCogitaWordLanguage, createCogitaConnection, createCogitaInfo, getCogitaInfoDetail, updateCogitaInfo } from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import type { CogitaConnectionType, CogitaGroupType, CogitaInfoOption, CogitaInfoType } from './types';
import { InfoSearchSelect } from './components/InfoSearchSelect';
import { ComputedGraphEditor, type ComputedGraphDefinition } from './components/ComputedGraphEditor';
import { buildComputedSampleFromGraph } from './utils/computedGraph';
import { LatexBlock, LatexInline } from '../../../components/LatexText';
import { getConnectionTypeOptions, getGroupTypeOptions, getInfoTypeOptions } from './libraryOptions';
import { useCogitaLibraryMeta } from './useCogitaLibraryMeta';
import { CogitaLibrarySidebar } from './components/CogitaLibrarySidebar';

export function CogitaLibraryAddPage({
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
  editInfoId
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
  editInfoId?: string;
}) {
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const isEditMode = Boolean(editInfoId);
  const baseHref = `/#/cogita/library/${libraryId}`;
  const [activeTab, setActiveTab] = useState<'info' | 'connection' | 'group'>('info');
  const [infoForm, setInfoForm] = useState({
    infoType: 'word' as CogitaInfoType,
    label: '',
    language: null as CogitaInfoOption | null,
    notes: ''
  });
  const [computedPrompt, setComputedPrompt] = useState('');
  const [computedGraph, setComputedGraph] = useState<ComputedGraphDefinition | null>(null);
  const [computedPreview, setComputedPreview] = useState<{ prompt: string; answers: Record<string, string> } | null>(null);
  const [computedPreviewStatus, setComputedPreviewStatus] = useState<'idle' | 'ready' | 'error'>('idle');
  const [connectionForm, setConnectionForm] = useState({
    connectionType: 'translation' as CogitaConnectionType,
    language: null as CogitaInfoOption | null,
    word: null as CogitaInfoOption | null,
    wordA: null as CogitaInfoOption | null,
    wordB: null as CogitaInfoOption | null,
    sentence: null as CogitaInfoOption | null,
    topic: null as CogitaInfoOption | null,
    note: ''
  });
  const [groupForm, setGroupForm] = useState({
    groupType: 'vocab' as CogitaGroupType,
    languageA: null as CogitaInfoOption | null,
    wordA: null as CogitaInfoOption | null,
    languageB: null as CogitaInfoOption | null,
    wordB: null as CogitaInfoOption | null,
    wordATags: [] as CogitaInfoOption[],
    wordBTags: [] as CogitaInfoOption[],
    translationTags: [] as CogitaInfoOption[]
  });
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<'idle' | 'loading' | 'saving'>('idle');
  const [pairStatus, setPairStatus] = useState<string | null>(null);
  const [groupPairStatusA, setGroupPairStatusA] = useState<string | null>(null);
  const [groupPairStatusB, setGroupPairStatusB] = useState<string | null>(null);
  const wordARef = useRef<HTMLInputElement | null>(null);
  const wordBRef = useRef<HTMLInputElement | null>(null);
  const groupConfirmRef = useRef<HTMLButtonElement | null>(null);
  const infoTypeOptions = useMemo(() => getInfoTypeOptions(copy), [copy]);
  const connectionTypeOptions = useMemo(() => getConnectionTypeOptions(copy), [copy]);
  const groupTypeOptions = useMemo(() => getGroupTypeOptions(copy), [copy]);

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
          setPairStatus(result.exists ? copy.cogita.library.add.connection.pairExists : null);
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
          setGroupPairStatusA(result.exists ? copy.cogita.library.add.group.pairExistsA : null);
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
          setGroupPairStatusB(result.exists ? copy.cogita.library.add.group.pairExistsB : null);
        })
        .catch(() => {
          setGroupPairStatusB(null);
        });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [libraryId, groupForm.languageB, groupForm.wordB]);

  useEffect(() => {
    if (!isEditMode || !editInfoId) return;
    let cancelled = false;
    setEditStatus('loading');
    setFormStatus(null);
    getCogitaInfoDetail({ libraryId, infoId: editInfoId })
      .then(async (detail) => {
        if (cancelled) return;
        const payload = (detail.payload ?? {}) as {
          label?: string;
          notes?: string;
          languageId?: string;
          definition?: { promptTemplate?: string; graph?: ComputedGraphDefinition | null };
        };
        setInfoForm((prev) => ({
          ...prev,
          infoType: detail.infoType as CogitaInfoType,
          label: payload.label ?? '',
          notes: payload.notes ?? '',
          language: payload.languageId
            ? { id: payload.languageId, label: payload.languageId, infoType: 'language' }
            : null
        }));
        if (payload.languageId) {
          try {
            const languageDetail = await getCogitaInfoDetail({ libraryId, infoId: payload.languageId });
            if (cancelled) return;
            setInfoForm((prev) => ({
              ...prev,
              language: {
                id: payload.languageId!,
                label: (languageDetail.payload as { label?: string })?.label ?? payload.languageId!,
                infoType: 'language'
              }
            }));
          } catch {
            // Ignore language label lookup failure
          }
        }
        if (detail.infoType === 'computed') {
          setComputedPrompt(payload.definition?.promptTemplate ?? '');
          setComputedGraph(payload.definition?.graph ?? null);
          setComputedPreview(null);
          setComputedPreviewStatus('idle');
        } else {
          setComputedPrompt('');
          setComputedGraph(null);
          setComputedPreview(null);
          setComputedPreviewStatus('idle');
        }
        setActiveTab('info');
      })
      .catch(() => {
        if (cancelled) return;
        setFormStatus(copy.cogita.library.add.info.failed);
      })
      .finally(() => {
        if (!cancelled) setEditStatus('idle');
      });
    return () => {
      cancelled = true;
    };
  }, [copy, editInfoId, isEditMode, libraryId]);

  const handleSaveInfo = async () => {
    setFormStatus(null);
    try {
      const payload: Record<string, unknown> = {
        label: infoForm.label,
        notes: infoForm.notes
      };
      if (infoForm.language) {
        payload.languageId = infoForm.language.id;
      }
      if (infoForm.infoType === 'computed') {
        if (!computedGraph) {
          setFormStatus(copy.cogita.library.add.info.computedRequired);
          return;
        }
        const invalidName = computedGraph.nodes.find((node) => node.name && !/^[A-Za-z][A-Za-z0-9_]*$/.test(node.name));
        if (invalidName) {
          setFormStatus(copy.cogita.library.add.info.computedInvalidName);
          return;
        }
        const names = computedGraph.nodes.map((node) => node.name?.trim()).filter(Boolean) as string[];
        const nameSet = new Set<string>();
        for (const name of names) {
          const key = name.toLowerCase();
          if (nameSet.has(key)) {
            setFormStatus(copy.cogita.library.add.info.computedDuplicateName);
            return;
          }
          nameSet.add(key);
        }
        payload.definition = {
          promptTemplate: computedPrompt,
          graph: computedGraph
        };
      }
      if (isEditMode && editInfoId) {
        setEditStatus('saving');
        await updateCogitaInfo({
          libraryId,
          infoId: editInfoId,
          payload
        });
        setFormStatus(copy.cogita.library.add.info.updated);
        setEditStatus('idle');
      } else {
        await createCogitaInfo({
          libraryId,
          infoType: infoForm.infoType,
          payload
        });
        setFormStatus(copy.cogita.library.add.info.saved);
        const keepLanguage = infoForm.infoType === 'word' || infoForm.infoType === 'sentence';
        setInfoForm({
          infoType: infoForm.infoType,
          label: '',
          language: keepLanguage ? infoForm.language : null,
          notes: ''
        });
        if (infoForm.infoType === 'computed') {
          setComputedPrompt('');
          setComputedGraph(null);
          setComputedPreview(null);
          setComputedPreviewStatus('idle');
        }
      }
    } catch {
      setFormStatus(copy.cogita.library.add.info.failed);
    }
  };

  const handleComputedPreview = () => {
    setComputedPreviewStatus('idle');
    if (!computedGraph) {
      setComputedPreview(null);
      setComputedPreviewStatus('error');
      return;
    }
    const preview = buildComputedSampleFromGraph(computedGraph, computedPrompt);
    if (!preview) {
      setComputedPreview(null);
      setComputedPreviewStatus('error');
      return;
    }
    setComputedPreview({ prompt: preview.prompt, answers: preview.answers });
    setComputedPreviewStatus('ready');
  };

  const handleCreateConnection = async () => {
    setFormStatus(null);
    try {
      if (connectionForm.connectionType === 'word-language') {
        if (!connectionForm.language || !connectionForm.word) {
          setFormStatus(copy.cogita.library.add.connection.selectWordLanguage);
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.language.id, connectionForm.word.id],
          payload: { note: connectionForm.note }
        });
      } else if (connectionForm.connectionType === 'word-topic') {
        if (!connectionForm.word || !connectionForm.topic) {
          setFormStatus(copy.cogita.library.add.connection.selectWordTopic);
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.word.id, connectionForm.topic.id],
          payload: { note: connectionForm.note }
        });
      } else if (connectionForm.connectionType === 'translation') {
        if (!connectionForm.wordA || !connectionForm.wordB) {
          setFormStatus(copy.cogita.library.add.connection.selectTwoWords);
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
          setFormStatus(copy.cogita.library.add.connection.selectLanguageSentence);
          return;
        }
        await createCogitaConnection({
          libraryId,
          connectionType: connectionForm.connectionType,
          infoIds: [connectionForm.language.id, connectionForm.sentence.id],
          payload: { note: connectionForm.note }
        });
      }
      setFormStatus(copy.cogita.library.add.connection.saved);
      setConnectionForm((prev) => ({
        connectionType: prev.connectionType,
        language: prev.connectionType === 'word-language' || prev.connectionType === 'language-sentence' ? prev.language : null,
        word: null,
        wordA: null,
        wordB: null,
        sentence: null,
        topic: prev.connectionType === 'word-topic' ? prev.topic : null,
        note: ''
      }));
    } catch {
      setFormStatus(copy.cogita.library.add.connection.failed);
    }
  };

  const handleCreateGroup = async () => {
    setFormStatus(null);
    try {
      if (!groupForm.languageA || !groupForm.wordA || !groupForm.languageB || !groupForm.wordB) {
        setFormStatus(copy.cogita.library.add.group.selectBoth);
        return;
      }
      const uniqueTagIds = (tags: CogitaInfoOption[]) =>
        Array.from(new Map(tags.map((tag) => [tag.id, tag])).values());

      if (!groupPairStatusA) {
        await createCogitaConnection({
          libraryId,
          connectionType: 'word-language',
          infoIds: [groupForm.languageA.id, groupForm.wordA.id]
        });
      }

      if (!groupPairStatusB) {
        await createCogitaConnection({
          libraryId,
          connectionType: 'word-language',
          infoIds: [groupForm.languageB.id, groupForm.wordB.id]
        });
      }

      for (const tag of uniqueTagIds(groupForm.wordATags)) {
        await createCogitaConnection({
          libraryId,
          connectionType: 'word-topic',
          infoIds: [groupForm.wordA.id, tag.id]
        });
      }

      for (const tag of uniqueTagIds(groupForm.wordBTags)) {
        await createCogitaConnection({
          libraryId,
          connectionType: 'word-topic',
          infoIds: [groupForm.wordB.id, tag.id]
        });
      }

      await createCogitaConnection({
        libraryId,
        connectionType: 'translation',
        infoIds: [groupForm.wordA.id, groupForm.wordB.id],
        payload: { tagIds: uniqueTagIds(groupForm.translationTags).map((tag) => tag.id) }
      });

      setFormStatus(copy.cogita.library.add.group.saved);
      setGroupForm({
        groupType: groupForm.groupType,
        languageA: groupForm.languageA,
        wordA: null,
        languageB: groupForm.languageB,
        wordB: null,
        wordATags: groupForm.wordATags,
        wordBTags: groupForm.wordBTags,
        translationTags: groupForm.translationTags
      });
      requestAnimationFrame(() => wordARef.current?.focus());
    } catch {
      setFormStatus(copy.cogita.library.add.group.failed);
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
            <p className="cogita-user-kicker">{copy.cogita.library.add.kicker}</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">{copy.cogita.library.add.subtitle}</p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href="/#/cogita">
              {copy.cogita.library.actions.backToCogita}
            </a>
            <a className="cta ghost" href={baseHref}>
              {copy.cogita.library.actions.libraryOverview}
            </a>
            <a className="cta ghost" href={`${baseHref}/list`}>
              {copy.cogita.library.actions.openList}
            </a>
          </div>
        </header>

        <div className="cogita-add-tabs">
          {(['info', 'connection', 'group'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className="cogita-type-card"
              data-active={activeTab === tab}
              onClick={() => {
                if (isEditMode) return;
                setActiveTab(tab);
              }}
              disabled={isEditMode && tab !== 'info'}
            >
              <span className="cogita-type-label">{copy.cogita.library.add.tabs[tab]}</span>
              <span className="cogita-type-desc">
                {tab === 'info' && copy.cogita.library.add.tabDesc.info}
                {tab === 'connection' && copy.cogita.library.add.tabDesc.connection}
                {tab === 'group' && copy.cogita.library.add.tabDesc.group}
              </span>
            </button>
          ))}
        </div>

        <div className="cogita-library-layout">
          <CogitaLibrarySidebar libraryId={libraryId} labels={copy.cogita.library.sidebar} />
          <div className="cogita-library-content">
            <div className="cogita-add-center">
              <div className="cogita-library-panel">
                <section className="cogita-library-create">
                  {activeTab === 'info' ? (
                <div className="cogita-form-grid">
                  <label className="cogita-field full">
                    <span>{copy.cogita.library.add.info.typeLabel}</span>
                    <select
                      value={infoForm.infoType}
                      onChange={(event) => {
                        if (isEditMode) return;
                        setInfoForm((prev) => ({ ...prev, infoType: event.target.value as CogitaInfoType }));
                      }}
                      disabled={isEditMode}
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
                    <span>{copy.cogita.library.add.info.labelLabel}</span>
                    <input
                      type="text"
                      value={infoForm.label}
                      onChange={(event) => setInfoForm((prev) => ({ ...prev, label: event.target.value }))}
                      placeholder={copy.cogita.library.add.info.labelPlaceholder}
                    />
                  </label>
                  {(infoForm.infoType === 'word' || infoForm.infoType === 'sentence') && (
                    <InfoSearchSelect
                      libraryId={libraryId}
                      infoType="language"
                      label={copy.cogita.library.add.info.languageLabel}
                      placeholder={copy.cogita.library.add.info.languagePlaceholder}
                      value={infoForm.language}
                      onChange={(value) => setInfoForm((prev) => ({ ...prev, language: value }))}
                      searchFailedText={copy.cogita.library.lookup.searchFailed}
                      createFailedText={copy.cogita.library.lookup.createFailed}
                      createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                      savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                    />
                  )}
                  <label className="cogita-field full">
                    <span>{copy.cogita.library.add.info.notesLabel}</span>
                    <textarea
                      value={infoForm.notes}
                      onChange={(event) => setInfoForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder={copy.cogita.library.add.info.notesPlaceholder}
                    />
                  </label>
                  {infoForm.infoType === 'computed' && (
                    <>
                      <label className="cogita-field full">
                        <span>{copy.cogita.library.add.info.computedLabel}</span>
                        <textarea
                          value={computedPrompt}
                          onChange={(event) => setComputedPrompt(event.target.value)}
                          placeholder={copy.cogita.library.add.info.computedPlaceholder}
                        />
                      </label>
                      <div className="cogita-field full">
                        <ComputedGraphEditor
                          copy={copy}
                          value={computedGraph}
                          onChange={(definition) => setComputedGraph(definition)}
                        />
                      </div>
                      <div className="cogita-form-actions full">
                        <button type="button" className="cta ghost" onClick={handleComputedPreview}>
                          {copy.cogita.library.add.info.computedPreview}
                        </button>
                      </div>
                      {computedPreview && computedPreviewStatus === 'ready' ? (
                        <div className="cogita-detail-sample">
                          <p className="cogita-user-kicker">{copy.cogita.library.add.info.computedPreviewTitle}</p>
                          <LatexBlock value={computedPreview.prompt} mode="auto" />
                          <div className="cogita-detail-sample-grid">
                            {Object.entries(computedPreview.answers).map(([key, value]) => (
                              <div key={key} className="cogita-detail-sample-item">
                                <span>{key}</span>
                                <LatexInline value={value} mode="auto" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : computedPreviewStatus === 'error' ? (
                        <p className="cogita-help">{copy.cogita.library.add.info.computedPreviewFail}</p>
                      ) : null}
                    </>
                  )}
                <div className="cogita-form-actions full">
                  <button
                    type="button"
                    className="cta"
                    onClick={handleSaveInfo}
                    disabled={editStatus === 'saving' || editStatus === 'loading'}
                  >
                    {isEditMode ? copy.cogita.library.add.info.update : copy.cogita.library.add.info.save}
                  </button>
                </div>
              </div>
              ) : null}

              {activeTab === 'connection' ? (
                <div className="cogita-form-grid">
                  <label className="cogita-field full">
                    <span>{copy.cogita.library.add.connection.typeLabel}</span>
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
                        label={copy.cogita.library.add.connection.languageLabel}
                        placeholder={copy.cogita.library.add.connection.languagePlaceholder}
                        value={connectionForm.language}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, language: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="word"
                        label={copy.cogita.library.add.connection.wordLabel}
                        placeholder={copy.cogita.library.add.connection.wordPlaceholder}
                        value={connectionForm.word}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, word: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.word)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      {pairStatus && <p className="cogita-help">{pairStatus}</p>}
                    </>
                  )}
                  {connectionForm.connectionType === 'word-topic' && (
                    <>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="word"
                        label={copy.cogita.library.add.connection.wordLabel}
                        placeholder={copy.cogita.library.add.connection.wordPlaceholder}
                        value={connectionForm.word}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, word: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.word)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="topic"
                        label={copy.cogita.library.add.connection.topicLabel}
                        placeholder={copy.cogita.library.add.connection.topicPlaceholder}
                        value={connectionForm.topic}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, topic: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.topic)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                    </>
                  )}
                  {connectionForm.connectionType === 'translation' && (
                    <>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="word"
                        label={copy.cogita.library.add.connection.wordALabel}
                        placeholder={copy.cogita.library.add.connection.wordAPlaceholder}
                        value={connectionForm.wordA}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, wordA: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.word)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="word"
                        label={copy.cogita.library.add.connection.wordBLabel}
                        placeholder={copy.cogita.library.add.connection.wordBPlaceholder}
                        value={connectionForm.wordB}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, wordB: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.word)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                    </>
                  )}
                  {connectionForm.connectionType === 'language-sentence' && (
                    <>
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="language"
                        label={copy.cogita.library.add.connection.languageLabel}
                        placeholder={copy.cogita.library.add.connection.languagePlaceholder}
                        value={connectionForm.language}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, language: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                      <InfoSearchSelect
                        libraryId={libraryId}
                        infoType="sentence"
                        label={copy.cogita.library.add.connection.sentenceLabel}
                        placeholder={copy.cogita.library.add.connection.sentencePlaceholder}
                        value={connectionForm.sentence}
                        onChange={(value) => setConnectionForm((prev) => ({ ...prev, sentence: value }))}
                        searchFailedText={copy.cogita.library.lookup.searchFailed}
                        createFailedText={copy.cogita.library.lookup.createFailed}
                        createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.sentence)}
                        savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                      />
                    </>
                  )}
                  <label className="cogita-field full">
                    <span>{copy.cogita.library.add.connection.noteLabel}</span>
                    <textarea
                      value={connectionForm.note}
                      onChange={(event) => setConnectionForm((prev) => ({ ...prev, note: event.target.value }))}
                      placeholder={copy.cogita.library.add.connection.notePlaceholder}
                    />
                  </label>
                <div className="cogita-form-actions full">
                  <button type="button" className="cta" onClick={handleCreateConnection}>
                    {copy.cogita.library.add.connection.save}
                  </button>
                </div>
              </div>
              ) : null}

              {activeTab === 'group' ? (
                <div className="cogita-form-grid">
                  <label className="cogita-field full">
                    <span>{copy.cogita.library.add.group.typeLabel}</span>
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
                    label={copy.cogita.library.add.group.languageALabel}
                    placeholder={copy.cogita.library.add.group.languageAPlaceholder}
                    value={groupForm.languageA}
                    onChange={(value) => setGroupForm((prev) => ({ ...prev, languageA: value }))}
                    searchFailedText={copy.cogita.library.lookup.searchFailed}
                    createFailedText={copy.cogita.library.lookup.createFailed}
                    createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                    savingLabel={copy.cogita.library.lookup.saving}
                        loadMoreLabel={copy.cogita.library.lookup.loadMore}
                  />
                  <InfoSearchSelect
                    libraryId={libraryId}
                    infoType="language"
                    label={copy.cogita.library.add.group.languageBLabel}
                    placeholder={copy.cogita.library.add.group.languageBPlaceholder}
                    value={groupForm.languageB}
                    onChange={(value) => setGroupForm((prev) => ({ ...prev, languageB: value }))}
                    searchFailedText={copy.cogita.library.lookup.searchFailed}
                    createFailedText={copy.cogita.library.lookup.createFailed}
                    createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.language)}
                    savingLabel={copy.cogita.library.lookup.saving}
                    loadMoreLabel={copy.cogita.library.lookup.loadMore}
                  />
                  <InfoSearchSelect
                    libraryId={libraryId}
                    infoType="word"
                    label={copy.cogita.library.add.group.wordALabel}
                    placeholder={copy.cogita.library.add.group.wordAPlaceholder}
                    value={groupForm.wordA}
                    onChange={(value) => setGroupForm((prev) => ({ ...prev, wordA: value }))}
                    searchFailedText={copy.cogita.library.lookup.searchFailed}
                    createFailedText={copy.cogita.library.lookup.createFailed}
                    createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.word)}
                    savingLabel={copy.cogita.library.lookup.saving}
                    loadMoreLabel={copy.cogita.library.lookup.loadMore}
                    inputRef={wordARef}
                    autoAdvance
                    onCommit={() => wordBRef.current?.focus()}
                  />
                  <InfoSearchSelect
                    libraryId={libraryId}
                    infoType="word"
                    label={copy.cogita.library.add.group.wordBLabel}
                    placeholder={copy.cogita.library.add.group.wordBPlaceholder}
                    value={groupForm.wordB}
                    onChange={(value) => setGroupForm((prev) => ({ ...prev, wordB: value }))}
                    searchFailedText={copy.cogita.library.lookup.searchFailed}
                    createFailedText={copy.cogita.library.lookup.createFailed}
                    createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.word)}
                    savingLabel={copy.cogita.library.lookup.saving}
                    loadMoreLabel={copy.cogita.library.lookup.loadMore}
                    inputRef={wordBRef}
                    autoAdvance
                    onCommit={() => groupConfirmRef.current?.focus()}
                  />
                  <div className="cogita-lookup full">
                    <InfoSearchSelect
                      libraryId={libraryId}
                      infoType="topic"
                      label={copy.cogita.library.add.group.translationTagsLabel}
                      placeholder={copy.cogita.library.add.group.translationTagsPlaceholder}
                      multiple
                      values={groupForm.translationTags}
                      onChangeMultiple={(values) => setGroupForm((prev) => ({ ...prev, translationTags: values }))}
                      searchFailedText={copy.cogita.library.lookup.searchFailed}
                      createFailedText={copy.cogita.library.lookup.createFailed}
                      createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.topic)}
                      savingLabel={copy.cogita.library.lookup.saving}
                      loadMoreLabel={copy.cogita.library.lookup.loadMore}
                    />
                  </div>
                  <InfoSearchSelect
                    libraryId={libraryId}
                    infoType="topic"
                    label={copy.cogita.library.add.group.wordATagsLabel}
                    placeholder={copy.cogita.library.add.group.wordATagsPlaceholder}
                    multiple
                    values={groupForm.wordATags}
                    onChangeMultiple={(values) => setGroupForm((prev) => ({ ...prev, wordATags: values }))}
                    searchFailedText={copy.cogita.library.lookup.searchFailed}
                    createFailedText={copy.cogita.library.lookup.createFailed}
                    createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.topic)}
                    savingLabel={copy.cogita.library.lookup.saving}
                    loadMoreLabel={copy.cogita.library.lookup.loadMore}
                  />
                  <InfoSearchSelect
                    libraryId={libraryId}
                    infoType="topic"
                    label={copy.cogita.library.add.group.wordBTagsLabel}
                    placeholder={copy.cogita.library.add.group.wordBTagsPlaceholder}
                    multiple
                    values={groupForm.wordBTags}
                    onChangeMultiple={(values) => setGroupForm((prev) => ({ ...prev, wordBTags: values }))}
                    searchFailedText={copy.cogita.library.lookup.searchFailed}
                    createFailedText={copy.cogita.library.lookup.createFailed}
                    createLabel={copy.cogita.library.lookup.createNew.replace('{type}', copy.cogita.library.infoTypes.topic)}
                    savingLabel={copy.cogita.library.lookup.saving}
                    loadMoreLabel={copy.cogita.library.lookup.loadMore}
                  />
                  {groupPairStatusA && <p className="cogita-help">{groupPairStatusA}</p>}
                  {groupPairStatusB && <p className="cogita-help">{groupPairStatusB}</p>}
                <div className="cogita-form-actions full">
                  <button type="button" className="cta" onClick={handleCreateGroup} ref={groupConfirmRef}>
                    {copy.cogita.library.add.group.save}
                  </button>
                </div>
              </div>
              ) : null}

                  {formStatus ? <p className="cogita-form-error">{formStatus}</p> : null}
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
