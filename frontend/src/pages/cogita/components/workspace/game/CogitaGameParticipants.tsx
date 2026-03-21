export function CogitaGameParticipants({
  sessionGroupsText,
  sessionZonesText,
  onSessionGroupsTextChange,
  onSessionZonesTextChange
}: {
  sessionGroupsText: string;
  sessionZonesText: string;
  onSessionGroupsTextChange: (value: string) => void;
  onSessionZonesTextChange: (value: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 880 }}>
      <p>Session participants/group template JSON</p>
      <textarea
        className="cogita-input"
        style={{ minHeight: 180, fontFamily: 'monospace' }}
        value={sessionGroupsText}
        onChange={(event) => onSessionGroupsTextChange(event.target.value)}
      />
      <p>Session zone template JSON</p>
      <textarea
        className="cogita-input"
        style={{ minHeight: 180, fontFamily: 'monospace' }}
        value={sessionZonesText}
        onChange={(event) => onSessionZonesTextChange(event.target.value)}
      />
      <p>These templates are used when creating a new live session for this game.</p>
    </div>
  );
}
