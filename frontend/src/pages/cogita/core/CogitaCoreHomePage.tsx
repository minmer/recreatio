import { useMemo, useState } from 'react';
import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';

const LIBRARY_STORAGE_KEY = 'cogita.core.home.libraryId';
const RUN_STORAGE_KEY = 'cogita.core.home.runId';

function isGuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export function CogitaCoreHomePage({
  copy,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange
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
}) {
  const coreCopy = copy.cogita.core.home;
  const [libraryId, setLibraryId] = useState(() =>
    typeof window === 'undefined' ? '' : localStorage.getItem(LIBRARY_STORAGE_KEY) ?? ''
  );
  const [runId, setRunId] = useState(() =>
    typeof window === 'undefined' ? '' : localStorage.getItem(RUN_STORAGE_KEY) ?? ''
  );

  const trimmedLibraryId = libraryId.trim();
  const trimmedRunId = runId.trim();
  const canStart = useMemo(() => isGuid(trimmedLibraryId), [trimmedLibraryId]);
  const canOpen = useMemo(() => isGuid(trimmedLibraryId) && isGuid(trimmedRunId), [trimmedLibraryId, trimmedRunId]);

  const goToRun = (nextRunId: string) => {
    if (typeof window === 'undefined') {
      return;
    }
    localStorage.setItem(LIBRARY_STORAGE_KEY, trimmedLibraryId);
    localStorage.setItem(RUN_STORAGE_KEY, nextRunId);
    window.location.hash = `#/cogita/core/runs/${encodeURIComponent(trimmedLibraryId)}/${encodeURIComponent(nextRunId)}`;
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
      <section className="glass-card" style={{ maxWidth: 840, margin: '0 auto' }}>
        <h1 style={{ marginTop: 0 }}>{coreCopy.title}</h1>
        <p style={{ marginBottom: '1.25rem' }}>
          {coreCopy.subtitle}
        </p>

        <label className="field-label" htmlFor="cogita-core-library-id">{coreCopy.libraryIdLabel}</label>
        <input
          id="cogita-core-library-id"
          type="text"
          className="field-input"
          placeholder={coreCopy.idPlaceholder}
          value={libraryId}
          onChange={(event) => setLibraryId(event.target.value)}
          autoComplete="off"
        />

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <button type="button" className="btn" onClick={() => goToRun('new')} disabled={!canStart}>
            {coreCopy.startNewRunAction}
          </button>
        </div>

        <hr style={{ margin: '1.5rem 0', borderColor: 'rgba(255, 255, 255, 0.2)' }} />

        <label className="field-label" htmlFor="cogita-core-run-id">{coreCopy.runIdLabel}</label>
        <input
          id="cogita-core-run-id"
          type="text"
          className="field-input"
          placeholder={coreCopy.idPlaceholder}
          value={runId}
          onChange={(event) => setRunId(event.target.value)}
          autoComplete="off"
        />

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <button type="button" className="btn secondary" onClick={() => goToRun(trimmedRunId)} disabled={!canOpen}>
            {coreCopy.openRunAction}
          </button>
        </div>
      </section>
    </CogitaShell>
  );
}
