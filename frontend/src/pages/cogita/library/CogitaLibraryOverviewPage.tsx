import { useState } from 'react';
import { createCogitaMockData } from '../../../lib/api';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { useCogitaLibraryMeta } from './useCogitaLibraryMeta';

export function CogitaLibraryOverviewPage({
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
  const { libraryName, stats } = useCogitaLibraryMeta(libraryId);
  const [mockStatus, setMockStatus] = useState<string | null>(null);
  const baseHref = `/#/cogita/library/${libraryId}`;

  const handleMockData = async () => {
    setMockStatus(null);
    try {
      const result = await createCogitaMockData(libraryId);
      setMockStatus(`Mock data ready: ${result.languages} languages, ${result.translations} vocab cards.`);
    } catch {
      setMockStatus('Failed to create mock data.');
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
            <p className="cogita-user-kicker">Library</p>
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">Overview of your encrypted index card library.</p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href="/#/cogita">
              Back to Cogita
            </a>
            <a className="cta ghost" href={`${baseHref}/list`}>
              Open list
            </a>
            <a className="cta ghost" href={`${baseHref}/collections`}>
              Collections
            </a>
            <a className="cta" href={`${baseHref}/new`}>
              Add new info
            </a>
          </div>
        </header>

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
          <div className="cogita-stat-card">
            <span>Collections</span>
            <strong>{stats?.totalCollections ?? 0}</strong>
          </div>
        </div>

        <div className="cogita-library-grid">
          <div className="cogita-library-pane">
            <div className="cogita-library-controls">
              <div className="cogita-library-search">
                <p className="cogita-user-kicker">Quick actions</p>
                <div className="cogita-card-empty">
                  <p>Jump into the list to browse cards or add a new entry.</p>
                  <div className="cogita-form-actions">
                    <a className="cta ghost" href={`${baseHref}/list`}>
                      Browse list
                    </a>
                    <a className="cta ghost" href={`${baseHref}/collections`}>
                      View collections
                    </a>
                    <a className="cta" href={`${baseHref}/new`}>
                      Add info
                    </a>
                  </div>
                  <div className="cogita-form-actions">
                    <button type="button" className="cta ghost" onClick={handleMockData}>
                      Seed mock data
                    </button>
                    {mockStatus ? <p className="cogita-help">{mockStatus}</p> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="cogita-library-panel">
            <section className="cogita-library-detail">
              <div className="cogita-detail-header">
                <div>
                  <p className="cogita-user-kicker">Library focus</p>
                  <h3 className="cogita-detail-title">What is inside?</h3>
                </div>
              </div>
              <div className="cogita-detail-body">
                <p>Every info card is encrypted and linked through relationships.</p>
                <p>Use the list to explore, then add or connect new knowledge nodes.</p>
              </div>
            </section>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
