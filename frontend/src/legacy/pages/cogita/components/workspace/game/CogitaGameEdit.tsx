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
  onDetailsChange: (next: GameEditDetails) => void;
  onSave: () => void;
  onGoToLiveSessions: () => void;
};

export function CogitaGameEdit(props: CogitaGameEditCreateProps | CogitaGameEditUpdateProps) {
  const details = props.details;
  if (!details) {
    return <p>Loading game details...</p>;
  }

  return (
    <div style={{ display: 'grid', gap: '0.8rem' }}>
      <h3 className="cogita-detail-title" style={{ marginTop: 0 }}>
        {props.mode === 'create' ? 'Create Game' : 'Edit Game'}
      </h3>
      <div className="cogita-form-grid">
        <label className="cogita-field full">
          <span>Name</span>
          <input
            value={details.name}
            onChange={(event) => props.onDetailsChange({ ...details, name: event.target.value })}
            placeholder="Game name"
          />
        </label>
        <label className="cogita-field full">
          <span>Mode</span>
          <select
            value={details.mode}
            onChange={(event) => props.onDetailsChange({ ...details, mode: event.target.value })}
          >
            <option value="solo">Solo</option>
            <option value="group">Group</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
        <label className="cogita-field full">
          <span>Settings JSON</span>
          <textarea
            value={details.settingsText}
            onChange={(event) => props.onDetailsChange({ ...details, settingsText: event.target.value })}
            placeholder='{"participants":{"mode":"groups"}}'
            rows={8}
            style={{ fontFamily: 'monospace' }}
          />
        </label>
      </div>
      <div className="cogita-card-actions">
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
