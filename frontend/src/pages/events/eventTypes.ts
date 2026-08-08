import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';

export type EventInnerPage = {
  slug: string;
  title: string;
};

export type EventDefinition = {
  slug: 'warsztaty26' | 'kal26' | 'edk26' | 'limanowa' | 'teatr26' | 'formularze' | 'rowerowa26' | 'event2';
  title: string;
  summary: string;
  /** Display label. `startDate`/`endDate` are what the overview sorts on. */
  date: string;
  location: string;
  pages: EventInnerPage[];

  // Catalogue fields, so hand-coded events filter and sort alongside the
  // database-driven ones. ISO yyyy-mm-dd for the dates.
  category?: string;
  audience?: string;
  places?: string[];
  startDate?: string;
  endDate?: string;
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
