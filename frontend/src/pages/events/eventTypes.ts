import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';

export type EventInnerPage = {
  slug: string;
  title: string;
};

export type EventDefinition = {
  slug: 'warsztaty26' | 'kal26' | 'edk26' | 'limanowa' | 'teatr26';
  title: string;
  summary: string;
  date: string;
  location: string;
  pages: EventInnerPage[];
};

export type SharedEventPageProps = {
  copy: Copy;
  authLabel: string;
  showProfileMenu: boolean;
  onAuthAction: () => void;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
  onNavigate: (route: RouteKey) => void;
};
