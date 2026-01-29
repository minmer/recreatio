import { useEffect, useMemo, useState } from 'react';
import { getCogitaRevisionShares, revokeCogitaRevisionShare, type CogitaRevisionShare } from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { useCogitaLibraryMeta } from './useCogitaLibraryMeta';
import { CogitaLibrarySidebar } from './components/CogitaLibrarySidebar';

export function CogitaLibrarySharedRevisionsPage({
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
  libraryId
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
}) {
  const { libraryName } = useCogitaLibraryMeta(libraryId);
  const [shares, setShares] = useState<CogitaRevisionShare[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const shareBase = useMemo(() => {
    if (typeof window === 'undefined') return '/#/cogita/public/revision';
    return `${window.location.origin}/#/cogita/public/revision`;
  }, []);
  const baseHref = `/#/cogita/library/${libraryId}`;

  const loadShares = () => {
    setStatus('loading');
    getCogitaRevisionShares({ libraryId })
      .then((list) => {
        setShares(list);
        setStatus('idle');
      })
      .catch(() => {
        setShares([]);
        setStatus('error');
      });
  };

  useEffect(() => {
    loadShares();
  }, [libraryId]);

  const handleRevoke = async (shareId: string) => {
    try {
      await revokeCogitaRevisionShare({ libraryId, shareId });
      loadShares();
    } catch {
      loadShares();
    }
  };

  const handleCopy = async (code: string) => {
    const link = `${shareBase}/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
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
            <p className="cogita-user-kicker">{copy.cogita.library.revision.shareKicker}</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">{copy.cogita.library.revision.shareTitle}</p>
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
          </div>
        </header>

        <div className="cogita-library-layout">
          <CogitaLibrarySidebar libraryId={libraryId} labels={copy.cogita.library.sidebar} />
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <div className="cogita-library-panel">
                <section className="cogita-library-detail">
                  <div className="cogita-detail-header">
                    <div>
                      <p className="cogita-user-kicker">{copy.cogita.library.revision.shareListTitle}</p>
                      <h3 className="cogita-detail-title">{copy.cogita.library.revision.shareTitle}</h3>
                    </div>
                  </div>
                  <div className="cogita-detail-body">
                    {status === 'loading' ? (
                      <p>{copy.cogita.library.revision.shareListLoading}</p>
                    ) : status === 'error' ? (
                      <p>{copy.cogita.library.revision.shareError}</p>
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
                              {share.shareCode ? (
                                <div className="cogita-share-meta">{`${shareBase}/${share.shareCode}`}</div>
                              ) : null}
                            </div>
                            {!share.revokedUtc ? (
                              <div className="cogita-detail-actions">
                                {share.shareCode ? (
                                  <button type="button" className="ghost" onClick={() => handleCopy(share.shareCode)}>
                                    {copy.cogita.library.revision.shareCopyAction}
                                  </button>
                                ) : null}
                                <button type="button" className="ghost" onClick={() => handleRevoke(share.shareId)}>
                                  {copy.cogita.library.revision.shareRevokeAction}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                    {copyStatus === 'copied' ? (
                      <p className="cogita-help">{copy.cogita.library.revision.shareCopied}</p>
                    ) : copyStatus === 'failed' ? (
                      <p className="cogita-help">{copy.cogita.library.revision.shareCopyError}</p>
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
