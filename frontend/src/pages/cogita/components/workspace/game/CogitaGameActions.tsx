import type { CogitaGameActionGraph } from '../../../../../lib/api';

export function CogitaGameActions({
  actionNodesText,
  actionEdgesText,
  actionGraph,
  onActionNodesTextChange,
  onActionEdgesTextChange,
  onSaveDraft,
  onPublish
}: {
  actionNodesText: string;
  actionEdgesText: string;
  actionGraph: CogitaGameActionGraph | null;
  onActionNodesTextChange: (value: string) => void;
  onActionEdgesTextChange: (value: string) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}) {
  return (
    <div style={{ display: 'grid', gap: '0.6rem', maxWidth: 980 }}>
      <p>Nodes JSON</p>
      <textarea
        className="cogita-input"
        style={{ minHeight: 220, fontFamily: 'monospace' }}
        value={actionNodesText}
        onChange={(event) => onActionNodesTextChange(event.target.value)}
      />
      <p>Edges JSON</p>
      <textarea
        className="cogita-input"
        style={{ minHeight: 220, fontFamily: 'monospace' }}
        value={actionEdgesText}
        onChange={(event) => onActionEdgesTextChange(event.target.value)}
      />
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" className="ghost" onClick={onSaveDraft}>Save Draft</button>
        <button type="button" className="cta" onClick={onPublish}>Publish Graph</button>
      </div>
      {actionGraph ? <p>Current graph version: {actionGraph.version} ({actionGraph.status})</p> : null}
    </div>
  );
}
