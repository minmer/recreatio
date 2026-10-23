/**
 * DIE KARTE IM NEBEL (aus „Mapa wiedzy", 2026-10-22 Schritt 10 geteilt): Einträge
 * auf Ringen, Linien für Voraussetzungen, jeder Eintrag in seinem Zustand —
 * bekannt, an der Grenze (man darf hinein), im Nebel. Gezeichnet für den alten
 * Baustein „Mapa wiedzy" und für den Widok als Mapa.
 */

export interface FogNode {
  readonly id: string;
  readonly label: string;
  readonly state: string;
  /** Was beim Darüberfahren steht. */
  readonly title: string;
}

export function FogMap({ nodes, edges, place, tall, onOpen }: {
  nodes: readonly FogNode[];
  edges: readonly { readonly from: string; readonly to: string }[];
  place: ReadonlyMap<string, { readonly x: number; readonly y: number }>;
  tall: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <div className={`cg-explore${tall ? '' : ' is-small'}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {edges.map((e, i) => {
          const a = place.get(e.from);
          const b = place.get(e.to);
          return a === undefined || b === undefined ? null : <line key={i} x1={a.x * 100} y1={a.y * 100} x2={b.x * 100} y2={b.y * 100} />;
        })}
      </svg>
      {nodes.map((n) => {
        const at = place.get(n.id) ?? { x: 0.5, y: 0.5 };
        return (
          <button key={n.id} type="button" className={`cg-explore-node is-${n.state}`} style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
            disabled={n.state === 'fog'} title={n.title} onClick={() => onOpen(n.id)}>
            {tall ? n.label : n.label.slice(0, 14)}
          </button>
        );
      })}
    </div>
  );
}
