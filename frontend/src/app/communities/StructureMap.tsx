/**
 * 0137 — DIE STRUKTUR ALS KARTE (React Flow): Einheiten als Knoten, „gehört zu" als Kanten, auf Wunsch
 * Positionen und Personen daneben („besetzt"). Teilbäume auf- und zuklappen, eine Einheit auf eine
 * andere ziehen = umhängen (mit Rückfrage), Klick = ihre Einstellungen. Das Layout rechnet ein
 * einfacher Baum (Tiefe → Spalte, Blätter → Zeilen) — für Bäume genügt das, und es braucht kein
 * weiteres Paket (dagre/elkjs). Auf dem Telefon: `StructureList.tsx`.
 */

import { useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, Handle, Position, type Edge, type Node, type NodeProps } from 'reactflow';
import 'reactflow/dist/style.css';

import { ask } from '../ui/dialogs';
import { flatten, holdersOf, kindOf, positionsOf, staffing, type CommunityDoc } from './community';
import { mayMove } from './communityEdit';

interface UnitData {
  readonly key: string;
  readonly name: string;
  readonly kind: string;
  readonly lines: readonly string[];
  readonly warn: readonly string[];
  readonly hidden: number;
  readonly selected: boolean;
  readonly removed: boolean;
  readonly onToggle: (key: string) => void;
}

interface SmallData { readonly label: string; readonly kind: 'position' | 'person' }

function UnitBox({ data }: NodeProps<UnitData>) {
  return (
    <div className={`wk-cm-node${data.selected ? ' is-on' : ''}${data.removed ? ' is-removed' : ''}`} data-cm-node={data.key}>
      <Handle type="target" position={Position.Left} />
      <span className="wk-dep-kind">{data.kind}</span>
      <strong>{data.name}</strong>
      {data.lines.map((l) => <span key={l} className="wk-dep-sub">{l}</span>)}
      {data.warn.map((l) => <span key={l} className="wk-fmap-warn">⚠ {l}</span>)}
      {data.hidden >= 0 && (
        <button type="button" className="wk-link-btn nodrag" onClick={(e) => { e.stopPropagation(); data.onToggle(data.key); }}>
          {data.hidden > 0 ? `+ ${data.hidden} niżej` : '− zwiń'}
        </button>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function SmallBox({ data }: NodeProps<SmallData>) {
  return (
    <div className={`wk-cm-small is-${data.kind}`}>
      <Handle type="target" position={Position.Left} />
      {data.label}
    </div>
  );
}

const NODE_TYPES = { unit: UnitBox, small: SmallBox };
const COL = 300;
const ROW = 110;

export function StructureMap({ doc, selected, onPick, onMove }: {
  doc: CommunityDoc;
  selected: string | null;
  onPick: (key: string) => void;
  onMove: (key: string, target: string) => void;
}) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set());
  const [people, setPeople] = useState(false);
  const toggle = (key: string) => setClosed((was) => { const next = new Set(was); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  const { nodes, edges } = useMemo(() => {
    const flat = flatten(doc.unit);
    const gaps = staffing(doc);
    const visible = flat.filter((f) => !f.path.slice(0, -1).some((k) => closed.has(k)));
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let row = 0;
    const place = (key: string): number => {
      const kids = visible.filter((f) => f.parent === key);
      const f = visible.find((x) => x.unit.key === key)!;
      const extra = people ? positionsOf(doc, f.unit).length : 0;
      let y: number;
      if (kids.length === 0) { y = row * ROW; row += 1 + Math.ceil(extra / 2); }
      else { const ys = kids.map((k) => place(k.unit.key)); y = (ys[0] + ys[ys.length - 1]) / 2; }
      const below = flat.filter((x) => x.path.includes(key) && x.unit.key !== key).length;
      nodes.push({
        id: key, type: 'unit', position: { x: f.depth * COL, y },
        data: {
          key, name: f.unit.name, kind: kindOf(doc, f.unit),
          lines: [`${positionsOf(doc, f.unit).length} poz. · ${doc.persons.filter((p) => p.remove !== true && p.places.some((pl) => pl.unit === key)).length} os.`],
          warn: gaps.filter((g) => g.unit === key && g.have < g.want).map((g) => `${g.positionName}: brakuje ${g.want - g.have}`),
          hidden: f.unit.units === undefined || f.unit.units.length === 0 ? -1 : closed.has(key) ? below : 0,
          selected: key === selected, removed: f.unit.remove === true, onToggle: toggle
        } satisfies UnitData
      });
      if (f.parent !== null) edges.push({ id: `e-${key}`, source: f.parent, target: key, className: 'is-belongs' });
      if (people) {
        positionsOf(doc, f.unit).forEach((p, i) => {
          const id = `${key}::${p.key}`;
          const who = holdersOf(doc, key, p.key).map((h) => h.name);
          nodes.push({ id, type: 'small', draggable: false, position: { x: f.depth * COL + 40 + (i % 2) * 130, y: y + 80 + Math.floor(i / 2) * 44 }, data: { label: `${p.name}: ${who.join(', ') || '—'}`, kind: 'position' } satisfies SmallData });
          edges.push({ id: `p-${id}`, source: key, target: id, className: 'is-holds' });
        });
      }
      return y;
    };
    place(doc.unit.key);
    return { nodes, edges };
  }, [doc, closed, people, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const drop = async (_e: unknown, node: Node) => {
    if (node.type !== 'unit') return;
    const target = nodes.find((n) => n.type === 'unit' && n.id !== node.id
      && Math.abs(n.position.x - node.position.x) < 160 && Math.abs(n.position.y - node.position.y) < 60);
    if (target === undefined) return;
    if (!mayMove(doc, node.id, target.id)) return;
    const what = flatten(doc.unit).find((f) => f.unit.key === node.id)?.unit.name ?? node.id;
    const where = flatten(doc.unit).find((f) => f.unit.key === target.id)?.unit.name ?? target.id;
    if (await ask({ title: `Przenieść „${what}” pod „${where}”?`, body: 'Zmiana trafi do planu — zapisze się dopiero po „Zapisz zmiany”.', confirm: 'Przenieś' })) onMove(node.id, target.id);
  };

  return (
    <div className="wk-cm-map" data-cm-map="">
      <div className="wk-actions">
        <label className="wk-check"><input type="checkbox" checked={people} onChange={(e) => setPeople(e.target.checked)} /> Pokaż pozycje i osoby</label>
        <span className="wk-note">Przeciągnij jednostkę na inną, żeby ją tam przenieść.</span>
      </div>
      <div className="wk-cm-canvas">
        <ReactFlow key={`${closed.size}-${people}`} nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} fitView minZoom={0.2}
          nodesConnectable={false} onNodeClick={(_e, n) => { if (n.type === 'unit') onPick(n.id); }} onNodeDragStop={(e, n) => void drop(e, n)}>
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
