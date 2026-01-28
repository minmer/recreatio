import { useEffect, useState } from 'react';
import { getCogitaCollection } from '../../../../lib/api';
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

  useEffect(() => {
    getCogitaCollection(libraryId, collectionId)
      .then((detail) => setCollectionName(detail.name))
      .catch(() => setCollectionName(copy.cogita.library.collections.defaultName));
  }, [libraryId, collectionId]);

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
              href={`${baseHref}/collections/${collectionId}/revision/run?mode=${encodeURIComponent(mode)}&check=${encodeURIComponent(check)}&limit=${limit}`}
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
                      href={`${baseHref}/collections/${collectionId}/revision/run?mode=${encodeURIComponent(mode)}&check=${encodeURIComponent(check)}&limit=${limit}`}
                    >
                      {copy.cogita.library.actions.startRevision}
                    </a>
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
