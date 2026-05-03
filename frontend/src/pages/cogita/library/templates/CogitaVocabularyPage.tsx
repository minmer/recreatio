import { useNavigate } from 'react-router-dom';
import type { LibraryTemplateProps } from '../CogitaLibraryPage';

export function CogitaVocabularyPage({ library, stats, copy, onNavigate }: LibraryTemplateProps) {
  const navigate = useNavigate();
  const libId = encodeURIComponent(library.libraryId);

  return (
    <section className="cogita-section cogita-lib-template cogita-lib-template--vocabulary">
      <header className="cogita-lib-template-header">
        <div className="cogita-lib-template-icon-wrap" style={{ '--tmpl-color': '#3a9bd5' } as React.CSSProperties}>
          Aa
        </div>
        <div>
          <p className="cogita-lib-template-kicker">Vocabulary library</p>
          <h1 className="cogita-lib-template-title">{library.name}</h1>
        </div>
      </header>

      <div className="cogita-lib-template-stats">
        <div className="cogita-lib-template-stat">
          <span className="cogita-lib-template-stat-value">{stats?.totalWords ?? '—'}</span>
          <span className="cogita-lib-template-stat-label">Words</span>
        </div>
        <div className="cogita-lib-template-stat">
          <span className="cogita-lib-template-stat-value">{stats?.totalSentences ?? '—'}</span>
          <span className="cogita-lib-template-stat-label">Sentences</span>
        </div>
        <div className="cogita-lib-template-stat">
          <span className="cogita-lib-template-stat-value">{stats?.totalLanguages ?? '—'}</span>
          <span className="cogita-lib-template-stat-label">Languages</span>
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
          onClick={() => navigate(`/cogita/revision/solo/${libId}/new`)}
        >
          <span className="cogita-lib-template-action-icon">▶</span>
          <span>Start revision</span>
        </button>
        <button
          type="button"
          className="cogita-lib-template-action"
          onClick={() => navigate(`/cogita/live/sessions/${libId}`)}
        >
          <span className="cogita-lib-template-action-icon">⊛</span>
          <span>Live session</span>
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
            onClick={() => navigate(`/cogita/workspace/libraries/${libId}/collections`)}>
            Collections
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/workspace/libraries/${libId}/revisions`)}>
            Revisions
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/revision/solo/${libId}/new`)}>
            Solo run
          </button>
          <button type="button" className="cogita-lib-template-nav-item ghost"
            onClick={() => navigate(`/cogita/revision/group-sync/${libId}/new`)}>
            Group run
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
