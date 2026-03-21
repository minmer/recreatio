import type { CogitaGameSummary } from '../../../../../lib/api';

export function CogitaGameSearch({
  query,
  loadingGames,
  filteredGames,
  onQueryChange,
  onCreate,
  onSelectGame
}: {
  query: string;
  loadingGames: boolean;
  filteredGames: CogitaGameSummary[];
  onQueryChange: (value: string) => void;
  onCreate: () => void;
  onSelectGame: (gameId: string) => void;
}) {
  return (
    <section className="cogita-section" style={{ display: 'grid', gap: '1rem' }}>
      <div className="cogita-panel" style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            className="cogita-input"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search games"
            style={{ maxWidth: 360 }}
          />
          <button type="button" className="cta" onClick={onCreate}>
            Create Game
          </button>
        </div>
        {loadingGames ? <p>Loading games...</p> : null}
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {filteredGames.map((item) => (
            <button
              key={item.gameId}
              type="button"
              className="ghost"
              style={{ textAlign: 'left', padding: '0.65rem 0.8rem', border: '1px solid #d5d5d5', borderRadius: 8 }}
              onClick={() => onSelectGame(item.gameId)}
            >
              <strong>{item.name}</strong>
              <span style={{ marginLeft: 8, opacity: 0.7 }}>{item.mode}</span>
            </button>
          ))}
          {filteredGames.length === 0 && !loadingGames ? <p>No games found.</p> : null}
        </div>
      </div>
    </section>
  );
}
