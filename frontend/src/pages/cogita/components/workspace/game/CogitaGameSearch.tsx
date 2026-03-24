import type { CogitaGameSummary } from '../../../../../lib/api';

export function CogitaGameSearch({
  query,
  loadingGames,
  filteredGames,
  onQueryChange,
  onSelectGame
}: {
  query: string;
  loadingGames: boolean;
  filteredGames: CogitaGameSummary[];
  onQueryChange: (value: string) => void;
  onSelectGame: (gameId: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <div className="cogita-search-field">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search games"
          aria-label="Search games"
        />
      </div>

      {loadingGames ? <p>Loading games...</p> : null}
      {filteredGames.length === 0 && !loadingGames ? <p>No games found.</p> : null}

      <div className="cogita-card-list" data-view="list">
        {filteredGames.map((item) => (
          <div key={item.gameId} className="cogita-card-item">
            <div className="cogita-info-result-row">
              <button type="button" className="cogita-info-result-main" onClick={() => onSelectGame(item.gameId)}>
                <h3 className="cogita-card-title">{item.name}</h3>
                <p className="cogita-card-subtitle">{item.gameId}</p>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
