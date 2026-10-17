/**
 * Ein Kästchen im Bild der Rollen: Art, Name, die Punkte der Stufen.
 */

import { Fragment } from 'react';
import { Handle, type NodeProps, Position } from 'reactflow';

type Kind = 'account' | 'person' | 'role' | 'group';

/**
 * Vier Arten, und der Unterschied ist keiner der Technik:
 *
 *   Konto   der Schlüsselbund — entsteht mit der Anmeldung, hält nur Personen
 *   Osoba   ein Mensch
 *   Rola    eine Funktion, die jemand ausübt und die übergeben wird
 *   Grupa   die, die dazugehören
 *
 * <b>Das Konto heisst immer „Konto".</b> Es hat keinen eigenen Namen: es ist
 * kein Mensch, und ein Name darüber würde genau das behaupten.
 */
export const KIND_NAME: Record<Kind, string> = {
  account: 'Konto',
  person: 'Osoba',
  role: 'Rola',
  group: 'Grupa'
};

export interface NodeData {
  readonly label: string;
  readonly kind: Kind;
  readonly personal: boolean;
  readonly locked: boolean;
}

/**
 * Die drei Punkte an jeder Seite eines Knotens — wie im Altbestand
 * (`roleGraphConfig.ts`), und mit derselben Bedeutung.
 *
 * <code>
 *   holds   führen: ändern, weitergeben, aufnehmen   (dort „Owner")
 *   write   eintragen, was der Rolle gehört
 *   read    hineinsehen
 * </code>
 *
 * <b>Warum drei Punkte und nicht ein Punkt mit Auswahl danach.</b> Die Stufe
 * gehört zu der Geste, mit der die Kante entsteht — wer zieht, hat sie schon
 * im Kopf. Ein Dialog hinterher fragt nach etwas, das längst entschieden ist,
 * und verlegt die Antwort an eine Stelle, an der man den Graphen nicht mehr
 * sieht.
 *
 * <b>Die Reihenfolge ist die Ordnung</b> — oben das Stärkste. Sie stimmt mit
 * der Leiter überein (3.5), und `certify` steht bewusst NICHT dabei: das ist
 * eine Sache der Bereiche, nicht der Rollen.
 */
export const DOTS = [
  { kind: 'holds' as const, name: 'prowadzi', colour: '#1d4ed8' },
  { kind: 'write' as const, name: 'pisze', colour: '#b3401f' },
  { kind: 'read' as const, name: 'czyta', colour: '#0284c7' }
];

/** Der Abstand zwischen den Punkten — genug, um nicht danebenzugreifen. */
const DOT_GAP = 18;

/** Ausserhalb der Komponente: React Flow vergleicht die Typen mit `===`. */
export const NODE_TYPES = { role: RoleNode };

function RoleNode({ data, selected }: NodeProps<NodeData>) {
  /*
   * DAS KONTO HAT KEINE EINGÄNGE und nur EINEN Ausgang (0040): niemand hält
   * es, und es führt Personen — ganz, nicht lesend. Punkte, an denen jede
   * Kante abgelehnt würde, wären Einladungen zu einem Fehler.
   */
  const dots = data.personal ? DOTS.filter((d) => d.kind === 'holds') : DOTS;

  return (
    <div
      className={`wk-node${data.personal ? ' wk-node-me' : ''}${data.locked ? ' wk-node-locked' : ''}${selected ? ' wk-node-on' : ''}`}
      style={{ minHeight: `${(DOTS.length - 1) * DOT_GAP + 52}px` }}
    >
      {dots.map((dot, at) => {
        /* Mittig um die Zeilenmitte herum, damit der Knoten nicht kopflastig wird. */
        const offset = (at - (dots.length - 1) / 2) * DOT_GAP;

        return (
          <Fragment key={dot.kind}>
            {!data.personal && (
              <Handle
                id={`in-${dot.kind}`}
                type="target"
                position={Position.Left}
                className="wk-dot"
                style={{ top: `calc(50% + ${offset}px)`, background: dot.colour }}
                title={`${dot.name} — tu przyjmij`}
              />
            )}
            <Handle
              id={`out-${dot.kind}`}
              type="source"
              position={Position.Right}
              className="wk-dot"
              style={{ top: `calc(50% + ${offset}px)`, background: dot.colour }}
              title={`${dot.name} — stąd pociągnij`}
            />
          </Fragment>
        );
      })}

      <span className="wk-node-name">{data.label}</span>
      <small className="wk-node-kind">{KIND_NAME[data.kind]}</small>
    </div>
  );
}
