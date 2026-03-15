export function RevisionRuntimeHost({
  isHost,
  runScope,
  runStatus,
  interactionLocked,
  onRefresh,
  onSetStatus,
  onSelectNext
}: {
  isHost: boolean;
  runScope?: string;
  runStatus?: string;
  interactionLocked: boolean;
  onRefresh: () => void;
  onSetStatus: (status: 'lobby' | 'active' | 'paused' | 'finished') => void;
  onSelectNext: () => void;
}) {
  if (!isHost) {
    return (
      <article className="cogita-core-run-card">
        <p className="cogita-core-run-kicker">Host</p>
        <p>Only host can manage runtime status.</p>
      </article>
    );
  }

  return (
    <article className="cogita-core-run-card">
      <p className="cogita-core-run-kicker">Host</p>
      <p>
        Scope: <strong>{runScope ?? '-'}</strong> · Status: <strong>{runStatus ?? '-'}</strong>
      </p>
      <div className="cogita-core-run-outcomes">
        <button type="button" className="ghost" disabled={interactionLocked} onClick={() => onSetStatus('lobby')}>
          Lobby
        </button>
        <button type="button" className="ghost" disabled={interactionLocked} onClick={() => onSetStatus('active')}>
          Active
        </button>
        <button type="button" className="ghost" disabled={interactionLocked} onClick={() => onSetStatus('paused')}>
          Paused
        </button>
        <button type="button" className="ghost" disabled={interactionLocked} onClick={() => onSetStatus('finished')}>
          Finished
        </button>
      </div>
      <div className="cogita-core-run-outcomes">
        <button type="button" className="ghost" disabled={interactionLocked} onClick={onSelectNext}>
          Select next card
        </button>
        <button type="button" className="ghost" disabled={interactionLocked} onClick={onRefresh}>
          Refresh data
        </button>
      </div>
    </article>
  );
}
