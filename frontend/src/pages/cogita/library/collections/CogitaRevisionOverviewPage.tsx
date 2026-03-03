import { useEffect, useMemo, useState } from 'react';
import {
  createCogitaRevisionShare,
  deleteCogitaRevision,
  getCogitaRevision,
  getCogitaRevisionShares,
  revokeCogitaRevisionShare,
  type CogitaRevision,
  type CogitaRevisionShare
} from '../../../../lib/api';
import { useNavigate } from 'react-router-dom';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';

export function CogitaRevisionOverviewPage({
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
  revisionId: string;
}) {
  const navigate = useNavigate();
  const [revision, setRevision] = useState<CogitaRevision | null>(null);
  const [activeShare, setActiveShare] = useState<CogitaRevisionShare | null>(null);
  const [shareStatus, setShareStatus] = useState<'idle' | 'working' | 'ready' | 'error'>('idle');
  const [shareCopyStatus, setShareCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  useEffect(() => {
    getCogitaRevision({ libraryId, revisionId })
      .then((item) => setRevision(item))
      .catch(() => setRevision(null));

    getCogitaRevisionShares({ libraryId })
      .then((shares) => {
        const current = shares.find((share) => share.revisionId === revisionId && !share.revokedUtc) ?? null;
        setActiveShare(current);
      })
      .catch(() => setActiveShare(null));
  }, [libraryId, revisionId]);

  const activeShareLink = useMemo(() => {
    if (!activeShare?.shareCode) return null;
    if (typeof window === 'undefined') return `/#/cogita/public/revision/${activeShare.shareCode}`;
    return `${window.location.origin}/#/cogita/public/revision/${activeShare.shareCode}`;
  }, [activeShare?.shareCode]);

  const revisionRunHref = useMemo(() => {
    const base = `/#/cogita/library/${encodeURIComponent(libraryId)}/revisions/${encodeURIComponent(revisionId)}/run`;
    if (!revision) return base;
    const params = new URLSearchParams();
    const mode = String(revision.revisionType ?? revision.mode ?? 'random').trim().toLowerCase();
    params.set('mode', mode || 'random');
    params.set('check', String(revision.check ?? 'exact'));
    params.set('limit', String(Math.max(1, Number(revision.limit ?? 20))));
    if (revision.revisionSettings && typeof revision.revisionSettings === 'object') {
      Object.entries(revision.revisionSettings as Record<string, unknown>).forEach(([key, value]) => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          params.set(key, String(value));
        } else if (typeof value === 'string') {
          params.set(key, value);
        }
      });
    }
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }, [libraryId, revision, revisionId]);

  const handleCreateShare = async () => {
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

  const handleDeleteRevision = async () => {
    if (!window.confirm('Delete this revision? This cannot be undone.')) return;
    setDeleteStatus(null);
    try {
      await deleteCogitaRevision({ libraryId, revisionId });
      navigate(`/cogita/library/${libraryId}/revisions`, { replace: true });
    } catch {
      setDeleteStatus('Failed to delete revision. Remove live sessions and shares first.');
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
      <section className="cogita-library-dashboard cogita-revision-overview" data-mode="detail">
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-pane">
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.workspace.infoActions.overview}</p>
                      <h3 className="cogita-detail-title">{revision?.name ?? copy.cogita.workspace.status.noRevisions}</h3>
                    </div>
                  </div>
                  <div className="cogita-form-actions">
                    <a className="cta" href={revisionRunHref}>
                      {copy.cogita.library.revision.start}
                    </a>
                    <button type="button" className="ghost" onClick={() => void handleDeleteRevision()}>
                      Delete
                    </button>
                  </div>
                  {deleteStatus ? <p className="cogita-form-error">{deleteStatus}</p> : null}
                </section>
              </div>

              <div className="cogita-library-panel">
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
                      {shareStatus === 'working' ? copy.cogita.library.revision.shareWorking : copy.cogita.library.revision.shareAction}
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
              </div>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
