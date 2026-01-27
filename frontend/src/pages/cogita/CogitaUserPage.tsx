import { useEffect, useState } from 'react';
import { createCogitaLibrary, getCogitaLibraries, type CogitaLibrary } from '../../lib/api';
import { CogitaShell } from './CogitaShell';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';

export function CogitaUserPage({
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
  onOpenLibrary,
  onOpenLibraryList
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
  onOpenLibrary: (libraryId: string) => void;
  onOpenLibraryList: (libraryId: string) => void;
}) {
  const [libraries, setLibraries] = useState<CogitaLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCogitaLibraries()
      .then((data) => {
        if (cancelled) return;
        setLibraries(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateLibrary = async () => {
    const name = newLibraryName.trim();
    if (!name) {
      setStatus('Library name is required.');
      return;
    }
    setStatus(null);
    try {
      const library = await createCogitaLibrary({ name });
      setLibraries((prev) => [library, ...prev]);
      setNewLibraryName('');
      onOpenLibrary(library.libraryId);
    } catch {
      setStatus('Could not create the library yet.');
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
      <section className="cogita-section cogita-user">
        <div className="cogita-user-panel">
          <p className="cogita-user-kicker">Cogita</p>
          <h1 className="cogita-user-title">{copy.cogita.title}</h1>
          <p className="cogita-user-subtitle">{copy.cogita.subtitle}</p>
          <ul className="cogita-user-list">
            {copy.cogita.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="cogita-user-note">{copy.cogita.note}</p>
          <div className="cogita-user-actions">
            <button type="button" className="cta" onClick={() => onNavigate('account')}>
              {copy.nav.account}
            </button>
          </div>
        </div>
      </section>

      <section className="cogita-library-home">
        <div className="cogita-library-home-inner">
          <header className="cogita-library-header">
            <div>
              <p className="cogita-user-kicker">Libraries</p>
              <h2 className="cogita-library-title">Your knowledge libraries</h2>
              <p className="cogita-library-subtitle">
                Create a library role, then enter it to manage encrypted index cards and connections.
              </p>
            </div>
          </header>

          <div className="cogita-library-grid">
            <div className="cogita-library-pane">
              <p className="cogita-user-kicker">Create new library</p>
              <div className="cogita-form-grid">
                <label className="cogita-field full">
                  <span>Library name</span>
                  <input
                    type="text"
                    value={newLibraryName}
                    onChange={(event) => setNewLibraryName(event.target.value)}
                    placeholder="e.g. Medieval theology"
                  />
                </label>
                <div className="cogita-form-actions full">
                  <button type="button" className="cta" onClick={handleCreateLibrary}>
                    Create library
                  </button>
                </div>
                {status ? <p className="cogita-form-error">{status}</p> : null}
              </div>
            </div>

            <div className="cogita-library-panel">
              <p className="cogita-user-kicker">Available libraries</p>
              {loading ? <p className="cogita-library-subtitle">Loading libraries...</p> : null}
              {libraries.length ? (
                <div className="cogita-card-list" data-view="list">
                  {libraries.map((library) => (
                    <div key={library.libraryId} className="cogita-card-item">
                      <button
                        type="button"
                        className="cogita-card-select"
                        onClick={() => onOpenLibrary(library.libraryId)}
                      >
                        <div className="cogita-card-type">Library role</div>
                        <h3 className="cogita-card-title">{library.name}</h3>
                        <p className="cogita-card-subtitle">{library.libraryId}</p>
                      </button>
                      <div className="cogita-card-actions">
                        <button type="button" className="ghost" onClick={() => onOpenLibrary(library.libraryId)}>
                          Open overview
                        </button>
                        <button type="button" className="ghost" onClick={() => onOpenLibraryList(library.libraryId)}>
                          Open cards
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="cogita-library-subtitle">No libraries yet. Create one to begin.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
