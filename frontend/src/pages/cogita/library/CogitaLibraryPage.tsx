import { CogitaShell } from '../CogitaShell';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import type { LibraryMode } from './types';
import { CogitaLibrarySection } from './components/CogitaLibrarySection';
import { useIndexCardLibrary } from './useIndexCardLibrary';

export function CogitaLibraryPage({
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
  mode,
  onModeChange,
  onBackToOverview
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
  mode: LibraryMode;
  onModeChange: (mode: LibraryMode) => void;
  onBackToOverview: () => void;
}) {
  const library = useIndexCardLibrary();

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
      <CogitaLibrarySection library={library} mode={mode} onBackToOverview={onBackToOverview} onModeChange={onModeChange} />
    </CogitaShell>
  );
}
