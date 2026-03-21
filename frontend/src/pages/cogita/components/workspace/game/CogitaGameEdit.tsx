type GameEditDetails = {
  name: string;
  mode: string;
  settingsText: string;
};

type CogitaGameEditCreateProps = {
  mode: 'create';
  details: GameEditDetails;
  onDetailsChange: (next: GameEditDetails) => void;
  onCreate: () => void;
  onBack: () => void;
};

type CogitaGameEditUpdateProps = {
  mode: 'edit';
  details: GameEditDetails | null;
  onDetailsChange: (next: GameEditDetails | null) => void;
  onSave: () => void;
  onGoToLiveSessions: () => void;
};

export function CogitaGameEdit(props: CogitaGameEditCreateProps | CogitaGameEditUpdateProps) {
  const details = props.details;
  if (!details) {
    return <p>Loading game details...</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 880 }}>
      <h3 style={{ margin: 0 }}>{props.mode === 'create' ? 'Create Game' : 'Edit Game'}</h3>
      <label>
        Name
        <input
          className="cogita-input"
          value={details.name}
          onChange={(event) => props.onDetailsChange({ ...details, name: event.target.value })}
        />
      </label>
      <label>
        Mode
        <select
          className="cogita-input"
          value={details.mode}
          onChange={(event) => props.onDetailsChange({ ...details, mode: event.target.value })}
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
          onChange={(event) => props.onDetailsChange({ ...details, settingsText: event.target.value })}
        />
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {props.mode === 'create' ? (
          <>
            <button type="button" className="cta" onClick={props.onCreate}>Create Game</button>
            <button type="button" className="ghost" onClick={props.onBack}>Back</button>
          </>
        ) : (
          <>
            <button type="button" className="cta" onClick={props.onSave}>Save Game</button>
            <button type="button" className="ghost" onClick={props.onGoToLiveSessions}>Go To Live Sessions</button>
          </>
        )}
      </div>
    </div>
  );
}
