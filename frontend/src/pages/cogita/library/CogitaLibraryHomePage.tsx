import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getCogitaLibraries,
  getRoles,
  type CogitaLibrary,
  type RoleResponse
} from '../../../lib/api';
import type { Copy } from '../../../content/types';
import type { RouteKey } from '../../../types/navigation';
import { CogitaShell } from '../CogitaShell';
import { usePersonContext } from '../../../lib/personContext';
import {
  PREFS_FIELD_TYPE,
  parsePersonPrefs,
  type CogitaLibraryStatus
} from '../components/CogitaLibraryPicker';
import {
  TEMPLATE_FIELD_TYPE,
  type CogitaTemplateId
} from '../components/CogitaLibraryTemplates';

const TEMPLATE_META: Record<CogitaTemplateId, { icon: string; color: string; label: string }> = {
  vocabulary:   { icon: 'Aa', color: '#3a9bd5', label: 'Vocabulary' },
  knowledgeMap: { icon: '◉',  color: '#8b5cf6', label: 'Knowledge Map' },
  course:       { icon: '▸',  color: '#f59e0b', label: 'Course' },
  research:     { icon: '◎',  color: '#10b981', label: 'Research' },
  flashcards:   { icon: '⚡', color: '#f97316', label: 'Flashcards' },
  custom:       { icon: '✦',  color: '#6b7280', label: 'Custom' }
};

function getTemplate(roles: RoleResponse[], roleId: string): CogitaTemplateId {
  const role = roles.find((r) => r.roleId === roleId);
  const field = role?.fields.find((f) => f.fieldType === TEMPLATE_FIELD_TYPE);
  const val = field?.plainValue;
  if (val && val in TEMPLATE_META) return val as CogitaTemplateId;
  return 'custom';
}

type LibraryCard = {
  library: CogitaLibrary;
  status: CogitaLibraryStatus;
  template: CogitaTemplateId;
};

export function CogitaLibraryHomePage({
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
  const navigate = useNavigate();
  const { activePerson } = usePersonContext();
  const [cards, setCards] = useState<LibraryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCogitaLibraries(), getRoles()])
      .then(([libraries, roles]) => {
        if (cancelled) return;
        const personRole = roles.find((r) => activePerson && r.roleId === activePerson.roleId);
        const prefsField = personRole?.fields.find((f) => f.fieldType === PREFS_FIELD_TYPE);
        const prefs = parsePersonPrefs(prefsField?.plainValue);
        const statusMap: Record<string, CogitaLibraryStatus> = {};
        for (const entry of prefs.libraries) statusMap[entry.libraryId] = entry.status;

        const result: LibraryCard[] = libraries.map((lib) => ({
          library: lib,
          status: statusMap[lib.libraryId] ?? 'open',
          template: getTemplate(roles, lib.roleId)
        }));
        setCards(result);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activePerson]);

  const visible = cards.filter((c) =>
    c.status !== 'removed' && (showHidden || c.status !== 'hidden')
  );
  const hiddenCount = cards.filter((c) => c.status === 'hidden').length;

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
      <section className="cogita-section cogita-lib-home">
        <header className="cogita-lib-home-header">
          <div>
            <p className="cogita-user-kicker">Cogita</p>
            <h1 className="cogita-lib-home-title">Libraries</h1>
          </div>
          <div className="cogita-lib-home-header-actions">
            {hiddenCount > 0 && (
              <button
                type="button"
                className="ghost cogita-lib-home-toggle"
                onClick={() => setShowHidden((v) => !v)}
              >
                {showHidden ? 'Hide hidden' : `Show hidden (${hiddenCount})`}
              </button>
            )}
          </div>
        </header>

        {loading ? (
          <p className="cogita-lib-home-empty">Loading libraries…</p>
        ) : visible.length === 0 ? (
          <p className="cogita-lib-home-empty">No libraries yet. Select a role with libraries to get started.</p>
        ) : (
          <div className="cogita-lib-home-grid">
            {visible.map(({ library, status, template }) => {
              const meta = TEMPLATE_META[template];
              return (
                <button
                  key={library.libraryId}
                  type="button"
                  className={`cogita-lib-home-card${status === 'hidden' ? ' is-hidden' : ''}`}
                  style={{ '--lib-color': meta.color } as React.CSSProperties}
                  onClick={() => navigate(`/cogita/libraries/${encodeURIComponent(library.libraryId)}`)}
                >
                  <div className="cogita-lib-home-card-icon">{meta.icon}</div>
                  <div className="cogita-lib-home-card-body">
                    <span className="cogita-lib-home-card-template">{meta.label}</span>
                    <span className="cogita-lib-home-card-name">{library.name}</span>
                  </div>
                  {status === 'hidden' && (
                    <span className="cogita-lib-home-card-badge">hidden</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </CogitaShell>
  );
}
