import { useNavigate } from 'react-router-dom';
import type { LibraryTemplateProps } from '../CogitaLibraryPage';

export function CogitaKnowledgeMapPage({ library, stats }: LibraryTemplateProps) {
  const navigate = useNavigate();
  const libId = encodeURIComponent(library.libraryId);

  return (
    <section className="cogita-section cogita-lib-template cogita-lib-template--knowledgemap">
      <header className="cogita-lib-template-header">
        <div className="cogita-lib-template-icon-wrap" style={{ '--tmpl-color': '#8b5cf6' } as React.CSSProperties}>
          ◉
        </div>
        <div>
          <p className="cogita-lib-template-kicker">Knowledge map library</p>
          <h1 className="cogita-lib-template-title">{library.name}</h1>
        </div>
      </header>

      <div className="cogita-lib-template-stats">
        <div className="cogita-lib-template-stat">
          <span className="cogita-lib-template-stat-value">{stats?.totalTopics ?? '—'}</span>
          <span className="cogita-lib-template-stat-label">Topics</span>
        </div>
        <div className="cogita-lib-template-stat">
          <span className="cogita-lib-template-stat-value">{stats?.totalConnections ?? '—'}</span>
          <span className="cogita-lib-template-stat-label">Connections</span>
        </div>
        <div className="cogita-lib-template-stat">
          <span className="cogita-lib-template-stat-value">{stats?.totalInfos ?? '—'}</span>
          <span className="cogita-lib-template-stat-label">Concepts</span>
        </div>
        <div className="cogita-lib-template-stat">
          <span className="cogita-lib-template-stat-value">{stats?.totalCollections ?? '—'}</span>
          <span className="cogita-lib-template-stat-label">Collections</span>
        </div>
      </div>

      <div className="cogita-lib-template-actions">
        <button
          type="button"
          className="cogita-lib-template-action cogita-lib-template-action--primary"
          onClick={() => navigate(`/cogita/workspace/libraries/${libId}/dependencies`)}
        >
          <span className="cogita-lib-template-action-icon">◉</span>
          <span>Browse graph</span>
        </button>
        <button
          type="button"
          className="cogita-lib-template-action"
          onClick={() => navigate(`/cogita/revision/solo/${libId}/new`)}
        >
          <span className="cogita-lib-template-action-icon">▶</span>
          <span>Explore concepts</span>
        </button>
        <button
          type="button"
          className="cogita-lib-template-action"
          onClick={() => navigate(`/cogita/workspace/libraries/${libId}`)}
        >
          <span className="cogita-lib-template-action-icon">✎</span>
          <span>Edit library</span>
        </button>
      </div>

      <div className="cogita-lib-template-nav">
        <p className="cogita-lib-template-nav-title">Go to</p>
        <div className="cogita-lib-template-nav-items">
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${libId}/dependencies`)}>
            Dependency graphs
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${libId}/notions`)}>
            Notions
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${libId}/collections`)}>
            Collections
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/revision/solo/${libId}/new`)}>
            Revision run
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate('/cogita/libraries')}>
            ← All libraries
          </button>
        </div>
      </div>
    </section>
  );
}
