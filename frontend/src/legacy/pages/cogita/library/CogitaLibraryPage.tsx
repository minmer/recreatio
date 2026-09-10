import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCogitaLibraries,
  getCogitaLibraryStats,
  getRoles,
  type CogitaLibrary,
  type CogitaLibraryStats
} from '../../../lib/api';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaShell } from '../CogitaShell';
import {
  TEMPLATE_FIELD_TYPE,
  type CogitaTemplateId
} from '../components/CogitaLibraryTemplates';
import { CogitaVocabularyPage } from './templates/CogitaVocabularyPage';
import { CogitaKnowledgeMapPage } from './templates/CogitaKnowledgeMapPage';
import { CogitaCoursePage } from './templates/CogitaCoursePage';
import { CogitaResearchPage } from './templates/CogitaResearchPage';
import { CogitaFlashcardsPage } from './templates/CogitaFlashcardsPage';
import { CogitaCustomPage } from './templates/CogitaCustomPage';

export type LibraryTemplateProps = {
  library: CogitaLibrary;
  stats: CogitaLibraryStats | null;
  copy: Copy;
  onNavigate: (route: RouteKey) => void;
};

const VALID_TEMPLATES = new Set<string>(['vocabulary', 'knowledgeMap', 'course', 'research', 'flashcards', 'custom']);

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
  const navigate = useNavigate();
  const [library, setLibrary] = useState<CogitaLibrary | null>(null);
  const [stats, setStats] = useState<CogitaLibraryStats | null>(null);
  const [template, setTemplate] = useState<CogitaTemplateId>('custom');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getCogitaLibraries(),
      getCogitaLibraryStats(libraryId).catch(() => null),
      getRoles()
    ]).then(([libraries, libStats, roles]) => {
      if (cancelled) return;
      const lib = libraries.find((l) => l.libraryId === libraryId);
      if (!lib) { setNotFound(true); setLoading(false); return; }

      const libRole = roles.find((r) => r.roleId === lib.roleId);
      const templateField = libRole?.fields.find((f) => f.fieldType === TEMPLATE_FIELD_TYPE);
      const raw = templateField?.plainValue ?? '';
      setLibrary(lib);
      setStats(libStats);
      setTemplate(VALID_TEMPLATES.has(raw) ? (raw as CogitaTemplateId) : 'custom');
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [libraryId]);

  const templateProps: LibraryTemplateProps = {
    library: library!,
    stats,
    copy,
    onNavigate
  };

  const renderTemplate = () => {
    switch (template) {
      case 'vocabulary':   return <CogitaVocabularyPage   {...templateProps} />;
      case 'knowledgeMap': return <CogitaKnowledgeMapPage {...templateProps} />;
      case 'course':       return <CogitaCoursePage       {...templateProps} />;
      case 'research':     return <CogitaResearchPage     {...templateProps} />;
      case 'flashcards':   return <CogitaFlashcardsPage   {...templateProps} />;
      default:             return <CogitaCustomPage       {...templateProps} />;
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
      {loading ? (
        <section className="cogita-section">
          <p className="cogita-library-subtitle">Loading library…</p>
        </section>
      ) : notFound ? (
        <section className="cogita-section">
          <p className="cogita-library-subtitle">Library not found.</p>
          <button type="button" className="ghost" onClick={() => navigate('/cogita/libraries')}>
            Back to libraries
          </button>
        </section>
      ) : (
        renderTemplate()
      )}
    </CogitaShell>
  );
}
