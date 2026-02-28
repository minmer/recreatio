import { useEffect, useMemo, useState } from 'react';
import {
  createCogitaRevision,
  createCogitaRevisionShare,
  getCogitaCollections,
  getCogitaRevision,
  getCogitaRevisionShares,
  getCogitaReviewers,
  revokeCogitaRevisionShare,
  updateCogitaRevision,
  type CogitaRevisionShare,
  type CogitaReviewer
} from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
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
  const baseHref = `/#/cogita/library/${libraryId}`;
  const [availableCollections, setAvailableCollections] = useState<{ collectionId: string; name: string }[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(collectionId ?? '');
  const [revisionName, setRevisionName] = useState('');
  const [limit, setLimit] = useState(20);
  const [mode, setMode] = useState('random');
  const [revisionSettings, setRevisionSettings] = useState<Record<string, number | string>>({});
  const [check] = useState('exact');
  const [reviewers, setReviewers] = useState<CogitaReviewer[]>([]);
  const [reviewerRoleId, setReviewerRoleId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [activeShare, setActiveShare] = useState<CogitaRevisionShare | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'working' | 'ready' | 'error'>('idle');
  const [shareCopyStatus, setShareCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const isCreateMode = !revisionId;
  const revisionType = useMemo(() => getRevisionType(mode), [mode]);
  const normalizedSettings = useMemo(
    () => normalizeRevisionSettings(revisionType, revisionSettings),
    [revisionType, revisionSettings]
  );
  const settingsQuery = useMemo(() => settingsToQueryParams(revisionType, normalizedSettings).toString(), [revisionType, normalizedSettings]);
  const shareBase = useMemo(() => {
    if (typeof window === 'undefined') return '/#/cogita/public/revision';
    return `${window.location.origin}/#/cogita/public/revision`;
  }, []);

  useEffect(() => {
    setSelectedCollectionId(collectionId ?? '');
  }, [collectionId]);

  useEffect(() => {
    getCogitaCollections({ libraryId, limit: 200 })
      .then((bundle) => {
        setAvailableCollections(bundle.items.map((item) => ({ collectionId: item.collectionId, name: item.name })));
        if (!selectedCollectionId && bundle.items.length > 0) {
          setSelectedCollectionId(bundle.items[0].collectionId);
        }
      })
      .catch(() => setAvailableCollections([]));
  }, [libraryId, selectedCollectionId]);

  useEffect(() => {
    getCogitaReviewers({ libraryId })
      .then((list) => {
        setReviewers(list);
        if (!reviewerRoleId && list.length > 0) {
          setReviewerRoleId(list[0].roleId);
        }
      })
      .catch(() => setReviewers([]));
  }, [libraryId, reviewerRoleId]);

  useEffect(() => {
    if (!revisionId) {
      setRevisionName('');
      setMode('random');
      setLimit(20);
      setRevisionSettings({});
      setActiveShare(null);
      return;
    }

    getCogitaRevision({ libraryId, revisionId })
      .then((revision) => {
        setSelectedCollectionId(revision.collectionId);
        setRevisionName(revision.name);
        setMode(revision.mode || 'random');
        setLimit(revision.limit || 20);
        setRevisionSettings((revision.revisionSettings as Record<string, number | string> | null | undefined) ?? {});
      })
      .catch(() => {
        setRevisionName('');
      });

    getCogitaRevisionShares({ libraryId })
      .then((shares) => {
        const current = shares.find((share) => share.revisionId === revisionId && !share.revokedUtc) ?? null;
        setActiveShare(current);
      })
      .catch(() => setActiveShare(null));
  }, [libraryId, revisionId]);

  const activeShareLink = useMemo(() => {
    if (!activeShare?.shareCode) return null;
    return `${shareBase}/${activeShare.shareCode}${settingsQuery ? `?${settingsQuery}` : ''}`;
  }, [activeShare?.shareCode, settingsQuery, shareBase]);

  const handleSaveRevision = async () => {
    if (!selectedCollectionId) {
      setSaveStatus('error');
      return;
    }
    if (!revisionName.trim()) {
      setSaveStatus('error');
      return;
    }

    setSaveStatus('saving');
    try {
      if (revisionId) {
        await updateCogitaRevision({
          libraryId,
          collectionId: selectedCollectionId,
          revisionId,
          targetCollectionId: selectedCollectionId,
          name: revisionName.trim(),
          revisionType: revisionType.id,
          revisionSettings: normalizedSettings,
          mode,
          check,
          limit
        });
        setSaveStatus('saved');
        return;
      }

      const created = await createCogitaRevision({
        libraryId,
        collectionId: selectedCollectionId,
        name: revisionName.trim(),
        revisionType: revisionType.id,
        revisionSettings: normalizedSettings,
        mode,
        check,
        limit
      });
      setSaveStatus('saved');
      navigate(`/cogita/library/${libraryId}/revisions/${encodeURIComponent(created.revisionId)}`, { replace: true });
    } catch {
      setSaveStatus('error');
    }
  };

  const handleCreateShare = async () => {
    if (!revisionId) return;
    setShareStatus('working');
    setShareCopyStatus('idle');
    try {
      const response = await createCogitaRevisionShare({ libraryId, revisionId });
      setActiveShare({
        shareId: response.shareId,
        revisionId: response.revisionId,
        revisionName: response.revisionName,
        collectionId: response.collectionId,
        collectionName: response.collectionName,
        shareCode: response.shareCode,
        revisionType: response.revisionType ?? null,
        revisionSettings: response.revisionSettings ?? null,
        mode: response.mode,
        check: response.check,
        limit: response.limit,
        createdUtc: response.createdUtc,
        revokedUtc: null
      });
      setShareStatus('ready');
    } catch {
      setShareStatus('error');
    }
  };

  const handleRevokeShare = async () => {
    if (!activeShare) return;
    try {
      await revokeCogitaRevisionShare({ libraryId, shareId: activeShare.shareId });
      setActiveShare(null);
      setShareStatus('idle');
      setShareCopyStatus('idle');
    } catch {
      setShareStatus('error');
    }
  };

  const handleCopyShare = async () => {
    if (!activeShareLink) return;
    try {
      await navigator.clipboard.writeText(activeShareLink);
      setShareCopyStatus('copied');
    } catch {
      setShareCopyStatus('failed');
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
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane">
                <div className="cogita-library-controls">
                  <div className="cogita-library-search">
                    <p className="cogita-user-kicker">{isCreateMode ? copy.cogita.workspace.revisionForm.createAction : copy.cogita.workspace.infoActions.edit}</p>
                    <label className="cogita-field">
                      <span>{copy.cogita.library.actions.collections}</span>
                      <select value={selectedCollectionId} onChange={(event) => setSelectedCollectionId(event.target.value)}>
                        <option value="">{copy.cogita.workspace.selectCollectionOption}</option>
                        {availableCollections.map((collectionOption) => (
                          <option key={collectionOption.collectionId} value={collectionOption.collectionId}>
                            {collectionOption.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="cogita-field">
                      <span>{copy.cogita.workspace.revisionForm.nameLabel}</span>
                      <input
                        value={revisionName}
                        onChange={(event) => setRevisionName(event.target.value)}
                        placeholder={copy.cogita.workspace.revisionForm.namePlaceholder}
                      />
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
                            value={Number(normalizedSettings[field.key] ?? 0)}
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
                    {revisionType.id === 'random' ? (
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
                    <div className="cogita-form-actions">
                      <button type="button" className="cta" onClick={handleSaveRevision} disabled={saveStatus === 'saving'}>
                        {saveStatus === 'saving'
                          ? '...'
                          : isCreateMode
                            ? copy.cogita.workspace.revisionForm.createAction
                            : copy.cogita.workspace.infoActions.edit}
                      </button>
                    </div>
                    {saveStatus === 'error' ? <p className="cogita-help">{copy.cogita.library.revision.error}</p> : null}
                  </div>
                </div>
              </div>

              <div className="cogita-library-panel">
                {!isCreateMode && revisionId ? (
                  <section className="cogita-library-detail">
                    <div className="cogita-detail-header">
                      <div>
                        <p className="cogita-user-kicker">{copy.cogita.library.revision.shareKicker}</p>
                        <h3 className="cogita-detail-title">{copy.cogita.library.revision.shareTitle}</h3>
                      </div>
                    </div>
                    <div className="cogita-detail-body">
                      <p>{copy.cogita.library.revision.shareBody}</p>
                      {activeShareLink ? (
                        <div className="cogita-field">
                          <span>{copy.cogita.library.revision.shareLinkLabel}</span>
                          <input value={activeShareLink} readOnly />
                        </div>
                      ) : (
                        <p>{copy.cogita.library.revision.shareListEmpty}</p>
                      )}
                      {shareStatus === 'error' ? <p className="cogita-help">{copy.cogita.library.revision.shareError}</p> : null}
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
                          : activeShare
                            ? copy.cogita.library.revision.shareAction
                            : copy.cogita.library.revision.shareAction}
                      </button>
                      {activeShareLink ? (
                        <button type="button" className="cta ghost" onClick={handleCopyShare}>
                          {copy.cogita.library.revision.shareCopyAction}
                        </button>
                      ) : null}
                      {activeShare ? (
                        <button type="button" className="cta ghost" onClick={handleRevokeShare}>
                          {copy.cogita.library.revision.shareRevokeAction}
                        </button>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {!isCreateMode && revisionId ? (
                  <section className="cogita-library-detail">
                    <div className="cogita-detail-header">
                      <div>
                        <p className="cogita-user-kicker">{copy.cogita.workspace.revisions.live}</p>
                        <h3 className="cogita-detail-title">{copy.cogita.workspace.infoMode.search}</h3>
                      </div>
                    </div>
                    <div className="cogita-detail-body">
                      <p>{copy.cogita.library.revision.live.hostTitle}</p>
                    </div>
                    <div className="cogita-form-actions">
                      <a className="cta ghost" href={`${baseHref}/revisions/${encodeURIComponent(revisionId)}/live-sessions`}>
                        {copy.cogita.workspace.revisions.live}
                      </a>
                      <a
                        className="cta ghost"
                        href={`/#/cogita/live-revision-host/${encodeURIComponent(libraryId)}/${encodeURIComponent(revisionId)}`}
                      >
                        {copy.cogita.library.revision.live.hostTitle}
                      </a>
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
