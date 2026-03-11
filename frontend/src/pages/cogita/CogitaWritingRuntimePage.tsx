import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createCogitaCreationProject,
  getCogitaCreationProjects,
  getCogitaLibraries,
  searchCogitaInfos,
  updateCogitaCreationProject,
  type CogitaCreationProject,
  type CogitaInfoSearchResult,
  type CogitaLibrary
} from '../../lib/api';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { CogitaShell } from './CogitaShell';

function parseWritingBody(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!content || typeof content !== 'object') {
    return '';
  }
  const root = content as Record<string, unknown>;
  if (typeof root.text === 'string') {
    return root.text;
  }
  if (typeof root.body === 'string') {
    return root.body;
  }
  return '';
}

function buildWritingContent(body: string) {
  const cleanBody = body.trim();
  const references = Array.from(new Set((cleanBody.match(/\[\[[^\]]+\]\]/g) ?? []).map((entry) => entry.slice(2, -2).trim())));
  return {
    text: cleanBody,
    references
  };
}

export function CogitaWritingRuntimePage({
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
  projectId
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
  libraryId?: string;
  projectId?: string;
}) {
  const navigate = useNavigate();
  const [libraries, setLibraries] = useState<CogitaLibrary[]>([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState(libraryId ?? '');
  const [projects, setProjects] = useState<CogitaCreationProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? '');
  const [projectName, setProjectName] = useState('');
  const [body, setBody] = useState('');
  const [referenceQuery, setReferenceQuery] = useState('');
  const [referenceResults, setReferenceResults] = useState<CogitaInfoSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingReferences, setSearchingReferences] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setSelectedLibraryId(libraryId ?? '');
  }, [libraryId]);

  useEffect(() => {
    setSelectedProjectId(projectId ?? '');
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    const loadLibraries = async () => {
      setLoading(true);
      setStatus(null);
      try {
        const list = await getCogitaLibraries();
        if (cancelled) return;
        setLibraries(list);
        if (!selectedLibraryId && list.length > 0) {
          const first = list[0].libraryId;
          setSelectedLibraryId(first);
          navigate(`/cogita/writing/${encodeURIComponent(first)}`, { replace: true });
        }
      } catch (err) {
        if (cancelled) return;
        setStatus(err instanceof Error ? err.message : 'Failed to load libraries.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadLibraries();
    return () => {
      cancelled = true;
    };
  }, [navigate, selectedLibraryId]);

  useEffect(() => {
    if (!selectedLibraryId) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    const loadProjects = async () => {
      setLoading(true);
      setStatus(null);
      try {
        const list = await getCogitaCreationProjects({ libraryId: selectedLibraryId, projectType: 'text' });
        if (cancelled) return;
        setProjects(list);
        if (list.length === 0) {
          setSelectedProjectId('');
          return;
        }
        const fromRoute = projectId && list.some((item) => item.projectId === projectId) ? projectId : null;
        const nextId = fromRoute ?? selectedProjectId;
        const exists = nextId && list.some((item) => item.projectId === nextId);
        if (exists && nextId) {
          setSelectedProjectId(nextId);
          return;
        }
        setSelectedProjectId(list[0].projectId);
      } catch (err) {
        if (cancelled) return;
        setProjects([]);
        setStatus(err instanceof Error ? err.message : 'Failed to load writing projects.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, [projectId, selectedLibraryId, selectedProjectId]);

  const selectedProject = useMemo(
    () => projects.find((item) => item.projectId === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  useEffect(() => {
    if (!selectedProject) {
      setProjectName('');
      setBody('');
      return;
    }
    setProjectName(selectedProject.name);
    setBody(parseWritingBody(selectedProject.content));
  }, [selectedProject]);

  const selectLibrary = (nextLibraryId: string) => {
    setSelectedLibraryId(nextLibraryId);
    setSelectedProjectId('');
    setStatus(null);
    navigate(`/cogita/writing/${encodeURIComponent(nextLibraryId)}`);
  };

  const selectProject = (nextProjectId: string) => {
    setSelectedProjectId(nextProjectId);
    setStatus(null);
    navigate(`/cogita/writing/${encodeURIComponent(selectedLibraryId)}/${encodeURIComponent(nextProjectId)}`);
  };

  const createProject = async () => {
    if (!selectedLibraryId || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const created = await createCogitaCreationProject({
        libraryId: selectedLibraryId,
        projectType: 'text',
        name: 'Writing draft',
        content: { text: '' }
      });
      setProjects((current) => [created, ...current]);
      setSelectedProjectId(created.projectId);
      navigate(`/cogita/writing/${encodeURIComponent(selectedLibraryId)}/${encodeURIComponent(created.projectId)}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to create writing project.');
    } finally {
      setSaving(false);
    }
  };

  const saveProject = async () => {
    if (!selectedLibraryId || !selectedProjectId || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const updated = await updateCogitaCreationProject({
        libraryId: selectedLibraryId,
        projectId: selectedProjectId,
        name: projectName.trim() || 'Writing draft',
        content: buildWritingContent(body)
      });
      setProjects((current) =>
        current.map((item) => (item.projectId === updated.projectId ? updated : item))
      );
      setStatus('Writing project saved.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save writing project.');
    } finally {
      setSaving(false);
    }
  };

  const searchReferences = async () => {
    if (!selectedLibraryId || !referenceQuery.trim()) {
      setReferenceResults([]);
      return;
    }
    setSearchingReferences(true);
    setStatus(null);
    try {
      const list = await searchCogitaInfos({
        libraryId: selectedLibraryId,
        query: referenceQuery.trim(),
        limit: 8
      });
      setReferenceResults(list);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to search knowledge items.');
    } finally {
      setSearchingReferences(false);
    }
  };

  const insertReference = (item: CogitaInfoSearchResult) => {
    const token = `[[${item.label}]]`;
    setBody((current) => (current.trim().length > 0 ? `${current}\n${token}` : token));
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
      headerExtra={
        selectedLibraryId ? (
          <button
            type="button"
            className="ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${encodeURIComponent(selectedLibraryId)}/writings`)}
          >
            Show in workspace
          </button>
        ) : null
      }
    >
      <section className="cogita-section" style={{ maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        <header className="cogita-library-header" style={{ marginBottom: '1rem' }}>
          <div>
            <p className="cogita-user-kicker">Writing Mode</p>
            <h1 className="cogita-library-title" style={{ marginBottom: '0.35rem' }}>Writing Editor Runtime</h1>
            <p className="cogita-library-subtitle">Focused writing surface with inline knowledge references.</p>
          </div>
        </header>

        {status ? <p className="cogita-form-error">{status}</p> : null}
        {loading ? <p className="cogita-library-subtitle">Loading writing surface...</p> : null}

        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(240px, 320px) minmax(0, 1fr)' }}>
          <aside className="cogita-pane" style={{ alignSelf: 'start' }}>
            <h2 style={{ marginTop: 0 }}>Libraries</h2>
            <div className="cogita-card-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              {libraries.map((library) => (
                <button
                  key={library.libraryId}
                  type="button"
                  className="ghost"
                  onClick={() => selectLibrary(library.libraryId)}
                  style={selectedLibraryId === library.libraryId ? { borderColor: 'rgba(111, 214, 255, 0.75)' } : undefined}
                >
                  {library.name}
                </button>
              ))}
            </div>

            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ marginBottom: '0.45rem' }}>Writing projects</h3>
              <div className="cogita-card-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                {projects.map((item) => (
                  <button
                    key={item.projectId}
                    type="button"
                    className="ghost"
                    onClick={() => selectProject(item.projectId)}
                    style={selectedProjectId === item.projectId ? { borderColor: 'rgba(111, 214, 255, 0.75)' } : undefined}
                  >
                    {item.name}
                  </button>
                ))}
                {projects.length === 0 ? <p className="cogita-library-subtitle">No writing projects yet.</p> : null}
              </div>
              <button type="button" className="ghost" style={{ marginTop: '0.5rem' }} onClick={() => void createProject()} disabled={!selectedLibraryId || saving}>
                New writing project
              </button>
            </div>
          </aside>

          <div style={{ display: 'grid', gap: '1rem' }}>
            <article className="cogita-pane">
              <p className="cogita-user-kicker">Editor</p>
              <label className="cogita-field full">
                <span>Document name</span>
                <input type="text" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Writing title" />
              </label>
              <label className="cogita-field full" style={{ marginTop: '0.5rem' }}>
                <span>Body (supports citations and LaTeX snippets)</span>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  rows={14}
                  placeholder={'Write your text here...\nUse [[Knowledge Item]] references and LaTeX like $E=mc^2$.'}
                />
              </label>
              <div className="cogita-form-actions" style={{ marginTop: '0.7rem' }}>
                <button type="button" className="ghost" onClick={() => void saveProject()} disabled={!selectedLibraryId || !selectedProjectId || saving}>
                  {saving ? 'Saving...' : 'Save writing'}
                </button>
              </div>
            </article>

            <article className="cogita-pane">
              <p className="cogita-user-kicker">Preview</p>
              <h2 style={{ marginTop: 0 }}>{projectName || 'Untitled writing'}</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{body || 'Nothing written yet.'}</p>
            </article>

            <article className="cogita-pane">
              <p className="cogita-user-kicker">Knowledge references</p>
              <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr auto' }}>
                <input
                  type="text"
                  value={referenceQuery}
                  onChange={(event) => setReferenceQuery(event.target.value)}
                  placeholder="Search knowledge items"
                />
                <button type="button" className="ghost" onClick={() => void searchReferences()} disabled={searchingReferences || !selectedLibraryId}>
                  {searchingReferences ? 'Searching...' : 'Search'}
                </button>
              </div>
              <div className="cogita-card-list" data-view="list" style={{ marginTop: '0.75rem' }}>
                {referenceResults.map((item) => (
                  <div className="cogita-card-item" key={item.infoId}>
                    <div>
                      <p className="cogita-card-type">{item.infoType}</p>
                      <h3 className="cogita-card-title">{item.label}</h3>
                    </div>
                    <div className="cogita-card-actions">
                      <button type="button" className="ghost" onClick={() => insertReference(item)}>
                        Insert reference
                      </button>
                    </div>
                  </div>
                ))}
                {referenceResults.length === 0 ? <p className="cogita-library-subtitle">No reference results loaded.</p> : null}
              </div>
            </article>
          </div>
        </div>
      </section>
    </CogitaShell>
  );
}
