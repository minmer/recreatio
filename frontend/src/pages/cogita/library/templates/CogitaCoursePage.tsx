import { useNavigate } from 'react-router-dom';
import type { LibraryTemplateProps } from '../CogitaLibraryPage';

export function CogitaCoursePage({ library, stats, copy, onNavigate }: LibraryTemplateProps) {
  const navigate = useNavigate();
  const libId = encodeURIComponent(library.libraryId);

  return (
    <section className="cogita-section cogita-lib-template cogita-lib-template--course">
      <header className="cogita-lib-template-header">
        <div className="cogita-lib-template-icon-wrap" style={{ '--tmpl-color': '#f59e0b' } as React.CSSProperties}>
          ▸
        </div>
        <div>
          <p className="cogita-lib-template-kicker">Course library</p>
          <h1 className="cogita-lib-template-title">{library.name}</h1>
        </div>
      </header>

      <div className="cogita-lib-template-stats">
        <div className="cogita-lib-template-stat">
          <span className="cogita-lib-template-stat-value">{stats?.totalInfos ?? '—'}</span>
          <span className="cogita-lib-template-stat-label">Items</span>
        </div>
        <div className="cogita-lib-template-stat">
          <span className="cogita-lib-template-stat-value">{stats?.totalCollections ?? '—'}</span>
          <span className="cogita-lib-template-stat-label">Modules</span>
        </div>
        <div className="cogita-lib-template-stat">
          <span className="cogita-lib-template-stat-value">{stats?.totalTopics ?? '—'}</span>
          <span className="cogita-lib-template-stat-label">Topics</span>
        </div>
      </div>

      <div className="cogita-lib-template-actions">
        <button
          type="button"
          className="cogita-lib-template-action cogita-lib-template-action--primary"
          onClick={() => navigate(`/cogita/workspace/libraries/${libId}/storyboards`)}
        >
          <span className="cogita-lib-template-action-icon">▸</span>
          <span>Open course</span>
        </button>
        <button
          type="button"
          className="cogita-lib-template-action"
          onClick={() => navigate(`/cogita/revision/solo/${libId}/new`)}
        >
          <span className="cogita-lib-template-action-icon">▶</span>
          <span>Practice</span>
        </button>
        <button
          type="button"
          className="cogita-lib-template-action"
          onClick={() => navigate(`/cogita/writing/${libId}`)}
        >
          <span className="cogita-lib-template-action-icon">✎</span>
          <span>Writing mode</span>
        </button>
      </div>

      <div className="cogita-lib-template-nav">
        <p className="cogita-lib-template-nav-title">Go to</p>
        <div className="cogita-lib-template-nav-items">
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${libId}/storyboards`)}>
            Storyboards
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${libId}/revisions`)}>
            Revisions
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${libId}/collections`)}>
            Collections
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/live/sessions/${libId}`)}>
            Live sessions
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
