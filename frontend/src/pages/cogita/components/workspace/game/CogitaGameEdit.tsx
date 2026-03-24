type GameEditDetails = {
  name: string;
  description: string;
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
        Description
        <textarea
          className="cogita-input"
          style={{ minHeight: 140 }}
          value={details.description}
          onChange={(event) => props.onDetailsChange({ ...details, description: event.target.value })}
          placeholder="Short game description"
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
