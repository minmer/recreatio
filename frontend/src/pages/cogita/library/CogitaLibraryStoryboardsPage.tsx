import { useState } from 'react';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { useCogitaLibraryMeta } from './useCogitaLibraryMeta';

export function CogitaLibraryStoryboardsPage({
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
  const [name, setName] = useState('');
  const [items, setItems] = useState<Array<{ id: string; name: string }>>([]);
  const createLocalId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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
            <h1 className="cogita-library-title">{libraryName}</h1>
            <p className="cogita-library-subtitle">{copy.cogita.library.modules.storyboardsSubtitle}</p>
          </div>
        </header>
        <div className="cogita-library-layout">
          <div className="cogita-library-content">
            <div className="cogita-library-grid">
              <section className="cogita-library-detail">
                <div className="cogita-detail-header">
                  <h3 className="cogita-detail-title">{copy.cogita.library.modules.storyboardsTitle}</h3>
                </div>
                <div className="cogita-detail-body">
                  <label className="cogita-field full">
                    <span>{copy.cogita.library.modules.storyboardsNewLabel}</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={copy.cogita.library.modules.storyboardsNewPlaceholder}
                    />
                  </label>
                  <div className="cogita-form-actions">
                    <button
                      type="button"
                      className="cta"
                      onClick={() => {
                        const trimmed = name.trim();
                        if (!trimmed) return;
                        setItems((current) => [{ id: createLocalId(), name: trimmed }, ...current]);
                        setName('');
                      }}
                    >
                      {copy.cogita.library.modules.storyboardsCreate}
                    </button>
                  </div>
                  <p className="cogita-help">{copy.cogita.library.modules.draftInfo}</p>
                </div>
              </section>
              <section className="cogita-library-detail">
                <div className="cogita-detail-header">
                  <h3 className="cogita-detail-title">{copy.cogita.library.modules.storyboardsExisting}</h3>
                </div>
                <div className="cogita-detail-body">
                  {items.length === 0 ? <p>{copy.cogita.library.modules.storyboardsEmpty}</p> : null}
                  {items.map((item) => (
                    <button key={item.id} type="button" className="ghost">
                      {item.name}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
