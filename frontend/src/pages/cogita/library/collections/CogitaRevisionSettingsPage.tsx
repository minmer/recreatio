import { useEffect, useState } from 'react';
import { getCogitaCollection } from '../../../../lib/api';
import { CogitaShell } from '../../CogitaShell';
import type { Copy } from '../../../../content/types';
import type { RouteKey } from '../../../../types/navigation';
import { useCogitaLibraryMeta } from '../useCogitaLibraryMeta';

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
  const [collectionName, setCollectionName] = useState('Collection');
  const [limit, setLimit] = useState(20);
  const [mode] = useState('random');
  const [check] = useState('exact');

  useEffect(() => {
    getCogitaCollection(libraryId, collectionId)
      .then((detail) => setCollectionName(detail.name))
      .catch(() => setCollectionName('Collection'));
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
            <p className="cogita-user-kicker">Revision settings</p>
            <h1 className="cogita-library-title">{collectionName}</h1>
            <p className="cogita-library-subtitle">{libraryName}</p>
          </div>
          <div className="cogita-library-actions">
            <a className="cta ghost" href="/#/cogita">
              Back to Cogita
            </a>
            <a className="cta ghost" href={baseHref}>
              Library overview
            </a>
            <a className="cta ghost" href={`${baseHref}/collections`}>
              Collections list
            </a>
            <a className="cta ghost" href={`${baseHref}/collections/${collectionId}`}>
              Collection detail
            </a>
            <a
              className="cta"
              href={`${baseHref}/collections/${collectionId}/revision/run?mode=${encodeURIComponent(mode)}&check=${encodeURIComponent(check)}&limit=${limit}`}
            >
              Start revision
            </a>
          </div>
        </header>

        <div className="cogita-library-grid">
          <div className="cogita-library-pane">
            <div className="cogita-library-controls">
              <div className="cogita-library-search">
                <p className="cogita-user-kicker">Revision mode</p>
                <label className="cogita-field">
                  <span>Mode</span>
                  <input value="Random" disabled />
                </label>
                <label className="cogita-field">
                  <span>Check</span>
                  <input value="Exact match" disabled />
                </label>
                <label className="cogita-field">
                  <span>Cards per session</span>
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
                  <p className="cogita-user-kicker">Preview</p>
                  <h3 className="cogita-detail-title">Random order, strict answers</h3>
                </div>
              </div>
              <div className="cogita-detail-body">
                <p>Vocabulary cards will prompt a translation.</p>
                <p>Word cards will ask you to select the correct language.</p>
              </div>
              <div className="cogita-form-actions">
                <a
                  className="cta"
                  href={`${baseHref}/collections/${collectionId}/revision/run?mode=${encodeURIComponent(mode)}&check=${encodeURIComponent(check)}&limit=${limit}`}
                >
                  Start revision
                </a>
              </div>
            </section>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
