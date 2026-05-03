import { useNavigate } from 'react-router-dom';
import type { LibraryTemplateProps } from '../CogitaLibraryPage';

export function CogitaCustomPage({ library, stats, copy, onNavigate }: LibraryTemplateProps) {
  const navigate = useNavigate();
  const libId = encodeURIComponent(library.libraryId);

  return (
    <section className="cogita-section cogita-lib-template cogita-lib-template--custom">
      <header className="cogita-lib-template-header">
        <div className="cogita-lib-template-icon-wrap" style={{ '--tmpl-color': '#6b7280' } as React.CSSProperties}>
          ✦
        </div>
        <div>
          <p className="cogita-lib-template-kicker">Library</p>
          <h1 className="cogita-lib-template-title">{library.name}</h1>
        </div>
      </header>

      {stats && (
        <div className="cogita-lib-template-stats">
          <div className="cogita-lib-template-stat">
            <span className="cogita-lib-template-stat-value">{stats.totalInfos}</span>
            <span className="cogita-lib-template-stat-label">Items</span>
          </div>
          <div className="cogita-lib-template-stat">
            <span className="cogita-lib-template-stat-value">{stats.totalCollections}</span>
            <span className="cogita-lib-template-stat-label">Collections</span>
          </div>
          <div className="cogita-lib-template-stat">
            <span className="cogita-lib-template-stat-value">{stats.totalLanguages}</span>
            <span className="cogita-lib-template-stat-label">Languages</span>
          </div>
          <div className="cogita-lib-template-stat">
            <span className="cogita-lib-template-stat-value">{stats.totalTopics}</span>
            <span className="cogita-lib-template-stat-label">Topics</span>
          </div>
        </div>
      )}

      <div className="cogita-lib-template-actions">
        <button
          type="button"
          className="cogita-lib-template-action cogita-lib-template-action--primary"
          onClick={() => navigate(`/cogita/revision/solo/${libId}/new`)}
        >
          <span className="cogita-lib-template-action-icon">▶</span>
          <span>Start revision</span>
        </button>
        <button
          type="button"
          className="cogita-lib-template-action"
          onClick={() => navigate(`/cogita/workspace/libraries/${libId}`)}
        >
          <span className="cogita-lib-template-action-icon">✎</span>
          <span>Workspace</span>
        </button>
        <button
          type="button"
          className="cogita-lib-template-action"
          onClick={() => navigate(`/cogita/writing/${libId}`)}
        >
          <span className="cogita-lib-template-action-icon">✍</span>
          <span>Writing mode</span>
        </button>
      </div>

      <div className="cogita-lib-template-nav">
        <p className="cogita-lib-template-nav-title">Go to</p>
        <div className="cogita-lib-template-nav-items">
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${libId}`)}>
            Workspace
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${libId}/collections`)}>
            Collections
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${libId}/revisions`)}>
            Revisions
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${libId}/storyboards`)}>
            Storyboards
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${libId}/notions`)}>
            Notions
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/live/sessions/${libId}`)}>
            Live sessions
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/writing/${libId}`)}>
            Writing mode
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
