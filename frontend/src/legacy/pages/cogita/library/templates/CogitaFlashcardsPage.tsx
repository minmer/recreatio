import { useNavigate } from 'react-router-dom';
import type { LibraryTemplateProps } from '../CogitaLibraryPage';

export function CogitaFlashcardsPage({ library, stats }: LibraryTemplateProps) {
  const navigate = useNavigate();
  const libId = encodeURIComponent(library.libraryId);

  return (
    <section className="cogita-section cogita-lib-template cogita-lib-template--flashcards">
      <header className="cogita-lib-template-header">
        <div className="cogita-lib-template-icon-wrap" style={{ '--tmpl-color': '#f97316' } as React.CSSProperties}>
          ⚡
        </div>
        <div>
          <p className="cogita-lib-template-kicker">Flashcards library</p>
          <h1 className="cogita-lib-template-title">{library.name}</h1>
        </div>
      </header>

      <div className="cogita-lib-template-stats">
        <div className="cogita-lib-template-stat">
          <span className="cogita-lib-template-stat-value">{stats?.totalInfos ?? '—'}</span>
          <span className="cogita-lib-template-stat-label">Cards</span>
        </div>
        <div className="cogita-lib-template-stat">
          <span className="cogita-lib-template-stat-value">{stats?.totalCollections ?? '—'}</span>
          <span className="cogita-lib-template-stat-label">Decks</span>
        </div>
        <div className="cogita-lib-template-stat">
          <span className="cogita-lib-template-stat-value">{stats?.totalLanguages ?? '—'}</span>
          <span className="cogita-lib-template-stat-label">Languages</span>
        </div>
      </div>

      <div className="cogita-lib-template-actions">
        <button
          type="button"
          className="cogita-lib-template-action cogita-lib-template-action--primary"
          onClick={() => navigate(`/cogita/revision/solo/${libId}/new`)}
        >
          <span className="cogita-lib-template-action-icon">⚡</span>
          <span>Start flashcards</span>
        </button>
        <button
          type="button"
          className="cogita-lib-template-action"
          onClick={() => navigate(`/cogita/revision/group-sync/${libId}/new`)}
        >
          <span className="cogita-lib-template-action-icon">⊛</span>
          <span>Group session</span>
        </button>
        <button
          type="button"
          className="cogita-lib-template-action"
          onClick={() => navigate(`/cogita/workspace/libraries/${libId}/revisions`)}
        >
          <span className="cogita-lib-template-action-icon">≡</span>
          <span>All decks</span>
        </button>
      </div>

      <div className="cogita-lib-template-nav">
        <p className="cogita-lib-template-nav-title">Go to</p>
        <div className="cogita-lib-template-nav-items">
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/revision/solo/${libId}/new`)}>
            Solo run
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/revision/shared/${libId}/new`)}>
            Shared run
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/live/sessions/${libId}`)}>
            Live sessions
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${libId}/collections`)}>
            Decks
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
