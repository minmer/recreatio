export function CogitaGameCreate({
  name,
  mode,
  onNameChange,
  onModeChange,
  onCreate,
  onBack
}: {
  name: string;
  mode: 'solo' | 'group' | 'mixed';
  onNameChange: (value: string) => void;
  onModeChange: (value: 'solo' | 'group' | 'mixed') => void;
  onCreate: () => void;
  onBack: () => void;
}) {
  return (
    <section className="cogita-section" style={{ maxWidth: 720 }}>
      <div className="cogita-panel" style={{ display: 'grid', gap: '0.75rem' }}>
        <h3>Create Game</h3>
        <label>
          Name
          <input className="cogita-input" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="City Hunt" />
        </label>
        <label>
          Mode
          <select className="cogita-input" value={mode} onChange={(event) => onModeChange(event.target.value as 'solo' | 'group' | 'mixed')}>
            <option value="mixed">Mixed</option>
            <option value="group">Group</option>
            <option value="solo">Solo</option>
          </select>
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="cta" onClick={onCreate}>Create</button>
          <button type="button" className="ghost" onClick={onBack}>Back</button>
        </div>
      </div>
    </section>
  );
}
