import type { CogitaGameSessionSummary, CogitaGameSummary } from '../../../../../lib/api';

export function CogitaGameOverview({
  selectedGame,
  details,
  sessions,
  onOpenEdit,
  onOpenParticipants,
  onOpenValues,
  onOpenActions,
  onOpenLayout,
  onOpenLiveSessions
}: {
  selectedGame: CogitaGameSummary;
  details: { name: string; mode: string; settingsText: string } | null;
  sessions: CogitaGameSessionSummary[];
  onOpenEdit: () => void;
  onOpenParticipants: () => void;
  onOpenValues: () => void;
  onOpenActions: () => void;
  onOpenLayout: () => void;
  onOpenLiveSessions: () => void;
}) {
  if (!details) {
    return <p>Loading game details...</p>;
  }

  const activeSessions = sessions.filter((item) => item.status !== 'finished').length;

  return (
    <div style={{ display: 'grid', gap: '0.8rem', maxWidth: 980 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
        <div className="cogita-panel" style={{ padding: '0.75rem' }}>
          <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>Live Sessions</p>
          <strong>{sessions.length}</strong>
        </div>
        <div className="cogita-panel" style={{ padding: '0.75rem' }}>
          <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>Active Sessions</p>
          <strong>{activeSessions}</strong>
        </div>
      </div>

      <div className="cogita-panel" style={{ display: 'grid', gap: '0.5rem' }}>
        <p style={{ margin: 0 }}><strong>{details.name}</strong></p>
        <p className="cogita-help" style={{ margin: 0 }}>Game ID: {selectedGame.gameId}</p>
        <p className="cogita-help" style={{ margin: 0 }}>Mode: {details.mode}</p>
        <p className="cogita-help" style={{ margin: 0 }}>
          Configure participants, values, action graph, and layouts from the workspace sections below.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="cta" onClick={onOpenEdit}>Edit Game</button>
          <button type="button" className="ghost" onClick={onOpenParticipants}>Participants</button>
          <button type="button" className="ghost" onClick={onOpenValues}>Values</button>
          <button type="button" className="ghost" onClick={onOpenActions}>Actions</button>
          <button type="button" className="ghost" onClick={onOpenLayout}>Layout</button>
          <button type="button" className="ghost" onClick={onOpenLiveSessions}>Live Sessions</button>
        </div>
      </div>
    </div>
  );
}
