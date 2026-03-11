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

function parseStoryboardScript(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!content || typeof content !== 'object') {
    return '';
  }
  const root = content as Record<string, unknown>;
  if (typeof root.script === 'string') {
    return root.script;
  }
  if (Array.isArray(root.steps)) {
    const lines = root.steps.map((item) => String(item ?? '').trim()).filter((item) => item.length > 0);
    return lines.join('\n\n');
  }
  if (typeof root.body === 'string') {
    return root.body;
  }
  return '';
}

function parseStoryboardSteps(script: string): string[] {
  const normalized = script.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const chunks = normalized
    .split(/\n{2,}|\n---+\n/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return chunks.length > 0 ? chunks : [normalized];
}

function buildStoryboardContent(script: string) {
  const cleanScript = script.trim();
  const steps = parseStoryboardSteps(cleanScript);
  const references = Array.from(new Set((cleanScript.match(/\[\[[^\]]+\]\]/g) ?? []).map((entry) => entry.slice(2, -2).trim())));
  return {
    script: cleanScript,
    steps,
    references
  };
}

export function CogitaStoryboardRuntimePage({
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
  const [script, setScript] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
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
          navigate(`/cogita/storyboard/${encodeURIComponent(first)}`, { replace: true });
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
        const list = await getCogitaCreationProjects({ libraryId: selectedLibraryId, projectType: 'storyboard' });
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
        setStatus(err instanceof Error ? err.message : 'Failed to load storyboard projects.');
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
      setScript('');
      setStepIndex(0);
      return;
    }
    setProjectName(selectedProject.name);
    setScript(parseStoryboardScript(selectedProject.content));
    setStepIndex(0);
  }, [selectedProject]);

  const steps = useMemo(() => parseStoryboardSteps(script), [script]);
  const currentStep = steps[stepIndex] ?? '';
  const canGoPrev = stepIndex > 0;
  const canGoNext = stepIndex < steps.length - 1;

  const selectLibrary = (nextLibraryId: string) => {
    setSelectedLibraryId(nextLibraryId);
    setSelectedProjectId('');
    setStatus(null);
    navigate(`/cogita/storyboard/${encodeURIComponent(nextLibraryId)}`);
  };

  const selectProject = (nextProjectId: string) => {
    setSelectedProjectId(nextProjectId);
    setStatus(null);
    navigate(`/cogita/storyboard/${encodeURIComponent(selectedLibraryId)}/${encodeURIComponent(nextProjectId)}`);
  };

  const createProject = async () => {
    if (!selectedLibraryId || saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const created = await createCogitaCreationProject({
        libraryId: selectedLibraryId,
        projectType: 'storyboard',
        name: 'Storyboard draft',
        content: { script: '', steps: [] }
      });
      setProjects((current) => [created, ...current]);
      setSelectedProjectId(created.projectId);
      navigate(`/cogita/storyboard/${encodeURIComponent(selectedLibraryId)}/${encodeURIComponent(created.projectId)}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to create storyboard project.');
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
        name: projectName.trim() || 'Storyboard draft',
        content: buildStoryboardContent(script)
      });
      setProjects((current) =>
        current.map((item) => (item.projectId === updated.projectId ? updated : item))
      );
      setStatus('Storyboard saved.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to save storyboard.');
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
    setScript((current) => (current.trim().length > 0 ? `${current}\n${token}` : token));
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
            onClick={() => navigate(`/cogita/workspace/libraries/${encodeURIComponent(selectedLibraryId)}/storyboards`)}
          >
            Show in workspace
          </button>
        ) : null
      }
    >
      <section className="cogita-section" style={{ maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        <header className="cogita-library-header" style={{ marginBottom: '1rem' }}>
          <div>
            <p className="cogita-user-kicker">Storyboard Mode</p>
            <h1 className="cogita-library-title" style={{ marginBottom: '0.35rem' }}>Storyboard Playback + Editor</h1>
            <p className="cogita-library-subtitle">Standalone runtime and authoring surface with knowledge-item reference insertion.</p>
          </div>
        </header>

        {status ? <p className="cogita-form-error">{status}</p> : null}
        {loading ? <p className="cogita-library-subtitle">Loading storyboard surface...</p> : null}

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
              <h3 style={{ marginBottom: '0.45rem' }}>Storyboard projects</h3>
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
                {projects.length === 0 ? <p className="cogita-library-subtitle">No storyboard projects yet.</p> : null}
              </div>
              <button type="button" className="ghost" style={{ marginTop: '0.5rem' }} onClick={() => void createProject()} disabled={!selectedLibraryId || saving}>
                New storyboard project
              </button>
            </div>
          </aside>

          <div style={{ display: 'grid', gap: '1rem' }}>
            <article className="cogita-pane">
              <p className="cogita-user-kicker">Playback</p>
              <h2 style={{ marginTop: 0 }}>{projectName || 'Select a storyboard project'}</h2>
              {steps.length === 0 ? (
                <p className="cogita-library-subtitle">No storyboard steps yet. Add script blocks below.</p>
              ) : (
                <>
                  <p className="cogita-card-type">Step {stepIndex + 1} / {steps.length}</p>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{currentStep}</p>
                  <div className="cogita-card-actions" style={{ marginTop: '0.75rem' }}>
                    <button type="button" className="ghost" onClick={() => setStepIndex((current) => Math.max(0, current - 1))} disabled={!canGoPrev}>Previous</button>
                    <button type="button" className="ghost" onClick={() => setStepIndex((current) => Math.min(steps.length - 1, current + 1))} disabled={!canGoNext}>Next</button>
                  </div>
                </>
              )}
            </article>

            <article className="cogita-pane">
              <p className="cogita-user-kicker">Authoring</p>
              <label className="cogita-field full">
                <span>Storyboard name</span>
                <input type="text" value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Storyboard title" />
              </label>
              <label className="cogita-field full" style={{ marginTop: '0.5rem' }}>
                <span>Script blocks (separate steps with empty lines or ---)</span>
                <textarea
                  value={script}
                  onChange={(event) => setScript(event.target.value)}
                  rows={11}
                  placeholder={'Step 1...\n\nStep 2...\n\n---\n\nStep 3...'}
                />
              </label>
              <div className="cogita-form-actions" style={{ marginTop: '0.7rem' }}>
                <button type="button" className="ghost" onClick={() => void saveProject()} disabled={!selectedLibraryId || !selectedProjectId || saving}>
                  {saving ? 'Saving...' : 'Save storyboard'}
                </button>
              </div>
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
