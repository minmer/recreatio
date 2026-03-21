export function CogitaGameLayout({
  selectedLayoutRole,
  layoutText,
  onSelectedLayoutRoleChange,
  onLayoutTextChange,
  onSaveLayout
}: {
  selectedLayoutRole: 'host' | 'groupLeader' | 'participant';
  layoutText: string;
  onSelectedLayoutRoleChange: (value: 'host' | 'groupLeader' | 'participant') => void;
  onLayoutTextChange: (value: string) => void;
  onSaveLayout: () => void;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 980 }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className={selectedLayoutRole === 'host' ? 'cta' : 'ghost'} onClick={() => onSelectedLayoutRoleChange('host')}>Host</button>
        <button type="button" className={selectedLayoutRole === 'groupLeader' ? 'cta' : 'ghost'} onClick={() => onSelectedLayoutRoleChange('groupLeader')}>Group Leader</button>
        <button type="button" className={selectedLayoutRole === 'participant' ? 'cta' : 'ghost'} onClick={() => onSelectedLayoutRoleChange('participant')}>Participant</button>
      </div>
      <textarea
        className="cogita-input"
        style={{ minHeight: 260, fontFamily: 'monospace' }}
        value={layoutText}
        onChange={(event) => onLayoutTextChange(event.target.value)}
      />
      <button type="button" className="cta" onClick={onSaveLayout}>Save Layout</button>
    </div>
  );
}
