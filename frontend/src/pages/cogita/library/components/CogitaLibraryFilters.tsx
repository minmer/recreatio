import type { ViewMode } from '../types';

export function CogitaLibraryFilters({
  tagQuery,
  onTagQueryChange,
  activeTags,
  visibleTagCounts,
  onToggleTag,
  onClearFilters,
  viewMode,
  onViewModeChange,
  showViewToggle
}: {
  tagQuery: string;
  onTagQueryChange: (value: string) => void;
  activeTags: string[];
  visibleTagCounts: Array<[string, number]>;
  onToggleTag: (tag: string) => void;
  onClearFilters: () => void;
  viewMode: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  showViewToggle?: boolean;
}) {
  return (
    <div className="cogita-library-controls">
      <div className="cogita-library-search">
        <p className="cogita-user-kicker">Search by tag</p>
        <div className="cogita-search-field">
          <input
            type="text"
            value={tagQuery}
            onChange={(event) => onTagQueryChange(event.target.value)}
            placeholder="latin, creed, greeting"
          />
          {tagQuery ? (
            <button type="button" onClick={() => onTagQueryChange('')}>
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="cogita-library-tags">
        <div className="cogita-library-tag-header">
          <p className="cogita-user-kicker">Tags</p>
          {activeTags.length ? (
            <button type="button" className="ghost" onClick={onClearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
        <div className="cogita-tag-list">
          {visibleTagCounts.length ? (
            visibleTagCounts.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                className="cogita-tag-chip"
                data-active={activeTags.includes(tag)}
                onClick={() => onToggleTag(tag)}
              >
                <span>{tag}</span>
                <span className="cogita-tag-count">{count}</span>
              </button>
            ))
          ) : (
            <span className="cogita-tag-empty">No tags match this search.</span>
          )}
        </div>
        {activeTags.length ? (
          <p className="cogita-library-hint">Active filters: {activeTags.join(', ')}</p>
        ) : null}
      </div>

      {showViewToggle ? (
        <div className="cogita-library-view">
          <p className="cogita-user-kicker">View</p>
          <div className="cogita-view-toggle">
            <button
              type="button"
              aria-pressed={viewMode === 'grid'}
              data-active={viewMode === 'grid'}
              onClick={() => onViewModeChange?.('grid')}
            >
              Grid
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'list'}
              data-active={viewMode === 'list'}
              onClick={() => onViewModeChange?.('list')}
            >
              List
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
