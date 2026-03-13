import { CogitaNotionSearch } from './CogitaNotionSearch';
import type { Copy } from '../../../../../content/types';
import type { RouteKey } from '../../../../../types/navigation';

export type CogitaNotionOverviewProps = {
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
  filterCollectionId?: string;
  filterCollectionLabel?: string;
};

export function CogitaNotionOverview(props: CogitaNotionOverviewProps) {
  return <CogitaNotionSearch {...props} mode="list" />;
}
