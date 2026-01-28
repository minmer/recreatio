import { useEffect, useMemo, useState } from 'react';
import {
  createCogitaRevisionShare,
  getCogitaCollection,
  getCogitaRevisionShares,
  getCogitaReviewers,
  revokeCogitaRevisionShare,
  type CogitaReviewer,
  type CogitaRevisionShare
} from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import { useCogitaLibraryMeta } from '../useCogitaLibraryMeta';
import { CogitaLibrarySidebar } from '../components/CogitaLibrarySidebar';

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
  collectionId
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
  collectionId: string;
}) {
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const baseHref = `/#/cogita/library/${libraryId}`;
  const [collectionName, setCollectionName] = useState(copy.cogita.library.collections.defaultName);
  const [limit, setLimit] = useState(20);
  const [mode] = useState('random');
  const [check] = useState('exact');
  const [reviewers, setReviewers] = useState<CogitaReviewer[]>([]);
  const [reviewerRoleId, setReviewerRoleId] = useState<string | null>(null);
  const [shares, setShares] = useState<CogitaRevisionShare[]>([]);
  const [shareStatus, setShareStatus] = useState<'idle' | 'working' | 'ready' | 'error'>('idle');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareCopyStatus, setShareCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [shareListStatus, setShareListStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const shareBase = useMemo(() => {
    if (typeof window === 'undefined') return '/#/cogita/shared/revision';
    return `${window.location.origin}/#/cogita/shared/revision`;
  }, []);

  useEffect(() => {
    getCogitaCollection(libraryId, collectionId)
      .then((detail) => setCollectionName(detail.name))
      .catch(() => setCollectionName(copy.cogita.library.collections.defaultName));
  }, [libraryId, collectionId]);

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

  const handleCreateShare = async () => {
    setShareStatus('working');
    setShareCopyStatus('idle');
    try {
      const response = await createCogitaRevisionShare({
        libraryId,
        collectionId,
        mode,
        check,
        limit
      });
      setShareLink(`${shareBase}/${response.shareId}?key=${response.shareKey}`);
      setShareStatus('ready');
      loadShares();
    } catch {
      setShareStatus('error');
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
            <a className="cta ghost" href={`${baseHref}/collections/${collectionId}`}>
              {copy.cogita.library.actions.collectionDetail}
            </a>
            <a
              className="cta"
              href={`${baseHref}/collections/${collectionId}/revision/run?mode=${encodeURIComponent(mode)}&check=${encodeURIComponent(check)}&limit=${limit}${
                reviewerRoleId ? `&reviewer=${encodeURIComponent(reviewerRoleId)}` : ''
              }`}
            >
              {copy.cogita.library.actions.startRevision}
            </a>
          </div>
        </header>

        <div className="cogita-library-layout">
          <CogitaLibrarySidebar libraryId={libraryId} collectionId={collectionId} labels={copy.cogita.library.sidebar} />
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane">
                <div className="cogita-library-controls">
                  <div className="cogita-library-search">
                    <p className="cogita-user-kicker">{copy.cogita.library.revision.settingsKicker}</p>
                    <label className="cogita-field">
                      <span>{copy.cogita.library.revision.modeLabel}</span>
                      <input value={copy.cogita.library.revision.modeValue} disabled />
                    </label>
                    <label className="cogita-field">
                      <span>{copy.cogita.library.revision.checkLabel}</span>
                      <input value={copy.cogita.library.revision.checkValue} disabled />
                    </label>
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
                    <a
                      className="cta"
                      href={`${baseHref}/collections/${collectionId}/revision/run?mode=${encodeURIComponent(mode)}&check=${encodeURIComponent(check)}&limit=${limit}${
                        reviewerRoleId ? `&reviewer=${encodeURIComponent(reviewerRoleId)}` : ''
                      }`}
                    >
                      {copy.cogita.library.actions.startRevision}
                    </a>
                  </div>
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
                    ) : shares.length === 0 ? (
                      <p>{copy.cogita.library.revision.shareListEmpty}</p>
                    ) : (
                      <div className="cogita-share-list">
                        {shares.map((share) => (
                          <div className="cogita-share-row" key={share.shareId} data-state={share.revokedUtc ? 'revoked' : 'active'}>
                            <div>
                              <strong>{share.collectionName}</strong>
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
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
