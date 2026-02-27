import { useEffect, useMemo, useState } from 'react';
import {
  createCogitaRevisionShare,
  getCogitaCollection,
  getCogitaCollections,
  getCogitaLiveRevisionSessionsByRevision,
  getCogitaRevision,
  getCogitaRevisions,
  getCogitaRevisionShares,
  getCogitaReviewers,
  revokeCogitaRevisionShare,
  updateCogitaRevision,
  type CogitaRevision,
  type CogitaLiveRevisionSessionListItem,
  type CogitaReviewer,
  type CogitaRevisionShare
} from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import { useCogitaLibraryMeta } from '../useCogitaLibraryMeta';
import { getRevisionType, normalizeRevisionSettings, revisionTypes, settingsToQueryParams } from '../../../../cogita/revision/registry';
import { useNavigate } from 'react-router-dom';

export function CogitaRevisionSettingsPage({
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
  collectionId,
  revisionId
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
  collectionId?: string;
  revisionId?: string;
}) {
  const navigate = useNavigate();
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const baseHref = `/#/cogita/library/${libraryId}`;
  const [collectionName, setCollectionName] = useState(copy.cogita.library.collections.defaultName);
  const [availableCollections, setAvailableCollections] = useState<{ collectionId: string; name: string }[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(collectionId ?? '');
  const [revisionName, setRevisionName] = useState('');
  const [limit, setLimit] = useState(20);
  const [mode, setMode] = useState('random');
  const [revisionSettings, setRevisionSettings] = useState<Record<string, number>>({});
  const [check, setCheck] = useState('exact');
  const [reviewers, setReviewers] = useState<CogitaReviewer[]>([]);
  const [reviewerRoleId, setReviewerRoleId] = useState<string | null>(null);
  const [shares, setShares] = useState<CogitaRevisionShare[]>([]);
  const [revisions, setRevisions] = useState<CogitaRevision[]>([]);
  const [revisionQuery, setRevisionQuery] = useState('');
  const [shareStatus, setShareStatus] = useState<'idle' | 'working' | 'ready' | 'error'>('idle');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareCopyStatus, setShareCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [shareListStatus, setShareListStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [liveSessions, setLiveSessions] = useState<CogitaLiveRevisionSessionListItem[]>([]);
  const shareBase = useMemo(() => {
    if (typeof window === 'undefined') return '/#/cogita/public/revision';
    return `${window.location.origin}/#/cogita/public/revision`;
  }, []);
  const revisionType = useMemo(() => getRevisionType(mode), [mode]);
  const normalizedSettings = useMemo(
    () => normalizeRevisionSettings(revisionType, revisionSettings),
    [revisionType, revisionSettings]
  );
  const settingsQuery = useMemo(() => settingsToQueryParams(revisionType, normalizedSettings).toString(), [revisionType, normalizedSettings]);
  const filteredRevisions = useMemo(() => {
    const needle = revisionQuery.trim().toLocaleLowerCase();
    if (!needle) return revisions;
    return revisions.filter((revision) => revision.name.toLocaleLowerCase().includes(needle));
  }, [revisionQuery, revisions]);

  useEffect(() => {
    setSelectedCollectionId(collectionId ?? '');
  }, [collectionId]);

  useEffect(() => {
    if (!selectedCollectionId) {
      setCollectionName(copy.cogita.library.collections.defaultName);
      return;
    }
    getCogitaCollection(libraryId, selectedCollectionId)
      .then((detail) => setCollectionName(detail.name))
      .catch(() => setCollectionName(copy.cogita.library.collections.defaultName));
  }, [copy.cogita.library.collections.defaultName, libraryId, selectedCollectionId]);

  useEffect(() => {
    getCogitaCollections({ libraryId, limit: 200 })
      .then((bundle) => setAvailableCollections(bundle.items.map((item) => ({ collectionId: item.collectionId, name: item.name }))))
      .catch(() => setAvailableCollections([]));
  }, [libraryId]);

  useEffect(() => {
    getCogitaRevisions({ libraryId })
      .then((items) => setRevisions(items))
      .catch(() => setRevisions([]));
  }, [libraryId]);

  useEffect(() => {
    if (!revisionId) return;
    getCogitaRevision({ libraryId, revisionId })
      .then((revision) => {
        setSelectedCollectionId(revision.collectionId);
        setRevisionName(revision.name);
        setMode(revision.mode || 'random');
        setCheck(revision.check || 'exact');
        setLimit(revision.limit || 20);
        setRevisionSettings((revision.revisionSettings as Record<string, number> | null | undefined) ?? {});
      })
      .catch(() => {
        setRevisionName('');
      });
  }, [libraryId, revisionId]);

  useEffect(() => {
    getCogitaReviewers({ libraryId })
      .then((list) => {
        setReviewers(list);
        if (!reviewerRoleId && list.length > 0) {
          setReviewerRoleId(list[0].roleId);
        }
      })
      .catch(() => {
        setReviewers([]);
      });
  }, [libraryId]);

  const loadShares = () => {
    setShareListStatus('loading');
    getCogitaRevisionShares({ libraryId })
      .then((list) => {
        setShares(list);
        setShareListStatus('idle');
      })
      .catch(() => {
        setShares([]);
        setShareListStatus('error');
      });
  };

  useEffect(() => {
    loadShares();
  }, [libraryId]);

  useEffect(() => {
    if (!revisionId) {
      setLiveSessions([]);
      return;
    }
    getCogitaLiveRevisionSessionsByRevision({ libraryId, revisionId })
      .then((items) => setLiveSessions(items))
      .catch(() => setLiveSessions([]));
  }, [libraryId, revisionId]);

  const handleCreateShare = async () => {
    setShareStatus('working');
    setShareCopyStatus('idle');
    try {
      if (!revisionId) {
        setShareStatus('error');
        return;
      }
      const response = await createCogitaRevisionShare({
        libraryId,
        revisionId
      });
      setShareLink(`${shareBase}/${response.shareCode}${settingsQuery ? `?${settingsQuery}` : ''}`);
      setShareStatus('ready');
      loadShares();
    } catch {
      setShareStatus('error');
    }
  };

  const handleSaveRevision = async () => {
    if (!revisionId) return;
    setSaveStatus('saving');
    try {
      await updateCogitaRevision({
        libraryId,
        collectionId: collectionId ?? selectedCollectionId,
        revisionId,
        targetCollectionId: selectedCollectionId,
        name: revisionName || collectionName,
        revisionType: revisionType.id,
        revisionSettings: normalizedSettings,
        mode,
        check,
        limit
      });
      setSaveStatus('saved');
      if (selectedCollectionId) {
        navigate(`/cogita/library/${libraryId}/revisions/${encodeURIComponent(revisionId)}`, {
          replace: true
        });
      }
    } catch {
      setSaveStatus('error');
    }
  };

  const handleCopyShare = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareCopyStatus('copied');
    } catch {
      setShareCopyStatus('failed');
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    try {
      await revokeCogitaRevisionShare({ libraryId, shareId });
      loadShares();
    } catch {
      loadShares();
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
            <p className="cogita-user-kicker">{copy.cogita.library.revision.settingsKicker}</p>
            <h1 className="cogita-library-title">{collectionName}</h1>
            <p className="cogita-library-subtitle">{libraryName}</p>
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
            <a className="cta ghost" href={selectedCollectionId ? `${baseHref}/collections/${selectedCollectionId}` : `${baseHref}/collections`}>
              {copy.cogita.library.actions.collectionDetail}
            </a>
            <a
              className="cta"
              href={`${baseHref}${
                revisionId
                  ? `/revisions/${encodeURIComponent(revisionId)}/run`
                  : selectedCollectionId
                    ? `/collections/${selectedCollectionId}/revision/run`
                    : '/revision/run'
              }?mode=${encodeURIComponent(mode)}&check=${encodeURIComponent(check)}&limit=${limit}${
                settingsQuery ? `&${settingsQuery}` : ''
              }${
                reviewerRoleId ? `&reviewer=${encodeURIComponent(reviewerRoleId)}` : ''
              }${
                revisionId ? `&revisionId=${encodeURIComponent(revisionId)}` : ''
              }`}
            >
              {copy.cogita.library.actions.startRevision}
            </a>
          </div>
        </header>

        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane">
                <div className="cogita-library-controls">
	                  <div className="cogita-library-search">
	                    <p className="cogita-user-kicker">{copy.cogita.library.revision.settingsKicker}</p>
                      <div className="cogita-search-field">
                        <input
                          type="text"
                          value={revisionQuery}
                          onChange={(event) => setRevisionQuery(event.target.value)}
                          placeholder={copy.cogita.workspace.revisionForm.namePlaceholder}
                        />
                      </div>
                      <div className="cogita-card-list" data-view="list">
                        <a className="cogita-card-select" href={`${baseHref}/revisions/new`} style={{ display: 'block' }}>
                          <div className="cogita-card-type">{copy.cogita.workspace.layers.revision}</div>
                          <h3 className="cogita-card-title">{copy.cogita.workspace.revisionForm.createAction}</h3>
                        </a>
                        {filteredRevisions.map((revision) => (
                          <a
                            key={revision.revisionId}
                            className="cogita-card-select"
                            href={`${baseHref}/revisions/${encodeURIComponent(revision.revisionId)}`}
                            style={{ display: 'block' }}
                          >
                            <div className="cogita-card-type">{copy.cogita.workspace.layers.revision}</div>
                            <h3 className="cogita-card-title">{revision.name}</h3>
                          </a>
                        ))}
                      </div>
	                    <label className="cogita-field">
	                      <span>{copy.cogita.library.actions.collections}</span>
	                      <select value={selectedCollectionId} onChange={(event) => setSelectedCollectionId(event.target.value)}>
	                        {availableCollections.map((collectionOption) => (
	                          <option key={collectionOption.collectionId} value={collectionOption.collectionId}>
	                            {collectionOption.name}
	                          </option>
	                        ))}
	                      </select>
	                    </label>
	                    <label className="cogita-field">
	                      <span>{copy.cogita.workspace.revisionForm.nameLabel}</span>
	                      <input value={revisionName} onChange={(event) => setRevisionName(event.target.value)} />
	                    </label>
                    <label className="cogita-field">
                      <span>{copy.cogita.library.revision.modeLabel}</span>
                      <select value={mode} onChange={(event) => setMode(event.target.value)}>
                        {revisionTypes.map((type) => (
                          <option key={type.id} value={type.id}>
                            {copy.cogita.library.revision[type.labelKey]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {revisionType.settingsFields.map((field) => (
                      <label key={field.key} className="cogita-field">
                        <span>{copy.cogita.library.revision[field.labelKey]}</span>
                        {field.type === 'select' ? (
                          <select
                            value={String(normalizedSettings[field.key] ?? '')}
                            onChange={(event) =>
                              setRevisionSettings((prev) => ({
                                ...prev,
                                [field.key]: event.target.value
                              }))
                            }
                          >
                            {(field.options ?? []).map((option) => (
                              <option key={option.value} value={option.value}>
                                {copy.cogita.library.revision[option.labelKey]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="number"
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            value={normalizedSettings[field.key] ?? 0}
                            onChange={(event) =>
                              setRevisionSettings((prev) => ({
                                ...prev,
                                [field.key]: Number(event.target.value || 0)
                              }))
                            }
                          />
                        )}
                      </label>
                    ))}
                    <label className="cogita-field">
                      <span>{copy.cogita.library.revision.checkLabel}</span>
                      <input value={copy.cogita.library.revision.checkValue} disabled />
                    </label>
                    {revisionType.id !== 'levels' && revisionType.id !== 'temporal' ? (
                      <label className="cogita-field">
                        <span>{copy.cogita.library.revision.cardsPerSessionLabel}</span>
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={limit}
                          onChange={(event) => setLimit(Number(event.target.value || 1))}
                        />
                      </label>
                    ) : null}
                    <label className="cogita-field">
                      <span>{copy.cogita.library.revision.reviewerLabel}</span>
                      <select
                        value={reviewerRoleId ?? ''}
                        onChange={(event) => setReviewerRoleId(event.target.value || null)}
                      >
                        {reviewers.map((reviewer) => (
                          <option key={reviewer.roleId} value={reviewer.roleId}>
                            {reviewer.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="cogita-library-panel">
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.library.revision.settingsKicker}</p>
                      <h3 className="cogita-detail-title">{copy.cogita.library.revision.previewTitle}</h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    <p>{copy.cogita.library.revision.previewBody1}</p>
                    <p>{copy.cogita.library.revision.previewBody2}</p>
                  </div>
                  <div className="cogita-form-actions">
                    {revisionId ? (
                      <button type="button" className="cta ghost" onClick={handleSaveRevision} disabled={saveStatus === 'saving'}>
                        {saveStatus === 'saving' ? '...' : copy.cogita.workspace.revisionForm.createAction}
                      </button>
                    ) : null}
                    <a
                      className="cta"
                      href={`${baseHref}${
                        revisionId
                          ? `/revisions/${encodeURIComponent(revisionId)}/run`
                          : selectedCollectionId
                            ? `/collections/${selectedCollectionId}/revision/run`
                            : '/revision/run'
                      }?mode=${encodeURIComponent(mode)}&check=${encodeURIComponent(check)}&limit=${limit}${
                        settingsQuery ? `&${settingsQuery}` : ''
                      }${
                        reviewerRoleId ? `&reviewer=${encodeURIComponent(reviewerRoleId)}` : ''
                      }${
                        revisionId ? `&revisionId=${encodeURIComponent(revisionId)}` : ''
                      }`}
                    >
                      {copy.cogita.library.actions.startRevision}
                    </a>
                    {revisionId ? (
                      <a
                        className="cta ghost"
                        href={`/#/cogita/live-revision-host/${encodeURIComponent(libraryId)}/${encodeURIComponent(revisionId)}`}
                      >
                        Live session
                      </a>
                    ) : null}
                    <a
                      className="cta ghost"
                      href={`/#/cogita/live-sessions/${encodeURIComponent(libraryId)}`}
                    >
                      Active live sessions
                    </a>
                  </div>
                  {saveStatus === 'error' ? <p className="cogita-help">Failed to save revision.</p> : null}
                </section>

                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.library.revision.shareKicker}</p>
                      <h3 className="cogita-detail-title">{copy.cogita.library.revision.shareTitle}</h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    <p>{copy.cogita.library.revision.shareBody}</p>
                    {shareLink ? (
                      <div className="cogita-field">
                        <span>{copy.cogita.library.revision.shareLinkLabel}</span>
                        <input value={shareLink} readOnly />
                      </div>
                    ) : null}
                    {shareStatus === 'error' ? (
                      <p className="cogita-help">{copy.cogita.library.revision.shareError}</p>
                    ) : null}
                    {shareCopyStatus === 'copied' ? (
                      <p className="cogita-help">{copy.cogita.library.revision.shareCopied}</p>
                    ) : shareCopyStatus === 'failed' ? (
                      <p className="cogita-help">{copy.cogita.library.revision.shareCopyError}</p>
                    ) : null}
                  </div>
                  <div className="cogita-form-actions">
                    <button type="button" className="cta" onClick={handleCreateShare} disabled={shareStatus === 'working'}>
                      {shareStatus === 'working'
                        ? copy.cogita.library.revision.shareWorking
                        : copy.cogita.library.revision.shareAction}
                    </button>
                    {shareLink ? (
                      <button type="button" className="cta ghost" onClick={handleCopyShare}>
                        {copy.cogita.library.revision.shareCopyAction}
                      </button>
                    ) : null}
                  </div>
                  <div className="cogita-detail-body">
                    <p className="cogita-user-kicker">{copy.cogita.library.revision.shareListTitle}</p>
                    {shareListStatus === 'loading' ? (
                      <p>{copy.cogita.library.revision.shareListLoading}</p>
                    ) : shares.filter((share) => !revisionId || share.revisionId === revisionId).length === 0 ? (
                      <p>{copy.cogita.library.revision.shareListEmpty}</p>
                    ) : (
                      <div className="cogita-share-list">
                        {shares.filter((share) => !revisionId || share.revisionId === revisionId).map((share) => (
                          <div className="cogita-share-row" key={share.shareId} data-state={share.revokedUtc ? 'revoked' : 'active'}>
                            <div>
                              <strong>{share.revisionName}</strong>
                              <div className="cogita-share-meta">{share.collectionName}</div>
                              <div className="cogita-share-meta">
                                {new Date(share.createdUtc).toLocaleString()}
                                {share.revokedUtc ? ` · ${copy.cogita.library.revision.shareRevoked}` : ''}
                              </div>
                            </div>
                            {!share.revokedUtc ? (
                              <button type="button" className="ghost" onClick={() => handleRevokeShare(share.shareId)}>
                                {copy.cogita.library.revision.shareRevokeAction}
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
                {revisionId ? (
                  <section className="cogita-library-detail">
                    <div className="cogita-detail-header">
                      <div>
                        <p className="cogita-user-kicker">Live sessions</p>
                        <h3 className="cogita-detail-title">Active sessions for this revision</h3>
                      </div>
                    </div>
                    <div className="cogita-detail-body">
                      {liveSessions.length === 0 ? (
                        <p className="cogita-help">No active sessions.</p>
                      ) : (
                        <div className="cogita-share-list">
                          {liveSessions.map((item) => (
                            <div className="cogita-share-row" key={`revision-live:${item.sessionId}`}>
                              <div>
                                <strong>{item.title || item.sessionId}</strong>
                                <div className="cogita-share-meta">
                                  {item.status} · participants: {item.participantCount}
                                </div>
                              </div>
                              <a className="ghost" href={`/#/cogita/live-sessions/${encodeURIComponent(libraryId)}`}>
                                Open sessions
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
