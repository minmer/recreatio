import type { CogitaGameSessionSummary } from '../../../../../lib/api';

export function CogitaGameLiveSessions({
  libraryId,
  sessionTitle,
  sessionGroupsText,
  sessionZonesText,
  sessions,
  onSessionTitleChange,
  onSessionGroupsTextChange,
  onSessionZonesTextChange,
  onCreateSession
}: {
  libraryId: string;
  sessionTitle: string;
  sessionGroupsText: string;
  sessionZonesText: string;
  sessions: CogitaGameSessionSummary[];
  onSessionTitleChange: (value: string) => void;
  onSessionGroupsTextChange: (value: string) => void;
  onSessionZonesTextChange: (value: string) => void;
  onCreateSession: () => void;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.8rem', maxWidth: 980 }}>
      <label>
        Session title
        <input className="cogita-input" value={sessionTitle} onChange={(event) => onSessionTitleChange(event.target.value)} placeholder="Saturday city run" />
      </label>
      <details>
        <summary>Groups JSON</summary>
        <textarea
          className="cogita-input"
          style={{ minHeight: 140, fontFamily: 'monospace', marginTop: 8 }}
          value={sessionGroupsText}
          onChange={(event) => onSessionGroupsTextChange(event.target.value)}
        />
      </details>
      <details>
        <summary>Zones JSON</summary>
        <textarea
          className="cogita-input"
          style={{ minHeight: 140, fontFamily: 'monospace', marginTop: 8 }}
          value={sessionZonesText}
          onChange={(event) => onSessionZonesTextChange(event.target.value)}
        />
      </details>
      <button type="button" className="cta" onClick={onCreateSession}>Create Live Session</button>

      <div style={{ display: 'grid', gap: '0.45rem' }}>
        {sessions.map((item) => {
          const storageKey = `cogita.game.host.${item.sessionId}`;
          const hostSecret = window.localStorage.getItem(storageKey);
          const hostLink = hostSecret
            ? `/#/cogita/game/host/${encodeURIComponent(libraryId)}/${encodeURIComponent(item.sessionId)}?hostSecret=${encodeURIComponent(hostSecret)}`
            : null;
          return (
            <div key={item.sessionId} style={{ border: '1px solid #e4e4e4', borderRadius: 8, padding: '0.7rem' }}>
              <div><strong>{item.sessionId}</strong></div>
              <div>Status: {item.status} | Phase: {item.phase} | Round: {item.roundIndex}</div>
              {hostLink ? (
                <a href={hostLink}>Open host console</a>
              ) : (
                <span style={{ opacity: 0.7 }}>Host secret not available locally for this session.</span>
              )}
            </div>
          );
        })}
        {sessions.length === 0 ? <p>No sessions yet.</p> : null}
      </div>
    </div>
  );
}
