export function CogitaGameEdit({
  details,
  onDetailsChange,
  onSave,
  onGoToLiveSessions
}: {
  details: { name: string; mode: string; settingsText: string } | null;
  onDetailsChange: (next: { name: string; mode: string; settingsText: string } | null) => void;
  onSave: () => void;
  onGoToLiveSessions: () => void;
}) {
  if (!details) {
    return <p>Loading game details...</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 880 }}>
      <label>
        Name
        <input
          className="cogita-input"
          value={details.name}
          onChange={(event) => onDetailsChange({ ...details, name: event.target.value })}
        />
      </label>
      <label>
        Mode
        <select
          className="cogita-input"
          value={details.mode}
          onChange={(event) => onDetailsChange({ ...details, mode: event.target.value })}
        >
          <option value="mixed">Mixed</option>
          <option value="group">Group</option>
          <option value="solo">Solo</option>
        </select>
      </label>
      <label>
        Settings JSON
        <textarea
          className="cogita-input"
          style={{ minHeight: 180, fontFamily: 'monospace' }}
          value={details.settingsText}
          onChange={(event) => onDetailsChange({ ...details, settingsText: event.target.value })}
        />
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="cta" onClick={onSave}>Save Game</button>
        <button type="button" className="ghost" onClick={onGoToLiveSessions}>Go To Live Sessions</button>
      </div>
    </div>
  );
}
