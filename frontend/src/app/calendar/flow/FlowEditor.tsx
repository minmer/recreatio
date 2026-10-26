/**
 * 2026-10-26 — DER EDITOR EINES ABLAUFS (React Flow): ein Plan, der Messen für
 * einen Zeitraum anlegt, oder die Regel einer Liste von Einträgen.
 *
 * <b>Links die Karte, rechts die Tafel</b> des gewählten Knotens (auf dem
 * Telefon darunter). Oben die Knoten, die es für diese Art gibt — ein neuer
 * Knoten kommt neben den gewählten und hängt sich an dessen freien Ausgang.
 * Ein Ausgang hat höchstens eine Kante: wer neu verbindet, ersetzt die alte.
 * Kreise gibt es nicht (der Ablauf liefe sonst nie zu Ende).
 *
 * <b>Gesteuert von aussen</b>: `doc` herein, jede Änderung als ganzes neues
 * `doc` hinaus (`onChange`). Gespeichert wird woanders (im Schema, im Plan).
 *
 * <b>Was nicht stimmt, steht dabei</b>: ein Warunek ohne „tak" oder „nie", ein
 * Knoten, den kein Anfang erreicht, ein fehlender Anfang.
 *
 * Die Vorschau (`preview`) bringt der Aufrufer mit — er kennt den Kalender und
 * rechnet mit `flowRun.ts`.
 */

import { useMemo, useRef, useState, type ReactNode } from 'react';
import ReactFlow, {
  Background, Controls, MarkerType,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type ReactFlowInstance
} from 'reactflow';
import 'reactflow/dist/style.css';

import { newId } from '../../core/ids';
import type { RecordList, SchemeChoice, SchemeField } from '../scheme';
import { FlowPanel } from './FlowPanel';
import {
  NODE_INFO, PLAN_NODES, RULE_NODES,
  type FlowDoc, type FlowEdge, type FlowNode, type FlowNodeType, type FlowOut, type SlotsData
} from './flowModel';
import { defaultData, FLOW_NODE_TYPES, nodeSummary, type FaceData } from './FlowNodes';

/** Die Gruppen der Palette — Anfang, Tag, Logik, Ende. */
const PLAN_GROUPS: readonly { readonly label: string; readonly types: readonly FlowNodeType[] }[] = [
  { label: 'Początek', types: ['day', 'mass'] },
  { label: 'Dzień', types: ['season', 'feasts', 'slots'] },
  { label: 'Logika', types: ['if', 'set', 'record'] },
  { label: 'Koniec', types: ['end', 'skip'] }
];
const RULE_GROUPS: readonly { readonly label: string; readonly types: readonly FlowNodeType[] }[] = [
  { label: 'Początek', types: ['record-start'] },
  { label: 'Logika', types: ['if'] },
  { label: 'Koniec', types: ['allow', 'wait', 'refuse'] }
];

/** Breite und Höhe eines Knotens, ungefähr — zum Platzieren neuer Knoten. */
const STEP_X = 260;
const STEP_Y = 110;

const outOf = (e: FlowEdge): FlowOut => e.out ?? 'out';

/** Erreicht man von `from` aus `to`? (Für die Prüfung auf Kreise.) */
function reaches(edges: readonly FlowEdge[], from: string, to: string): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length > 0) {
    const at = stack.pop()!;
    if (at === to) return true;
    if (seen.has(at)) continue;
    seen.add(at);
    for (const e of edges) if (e.from === at) stack.push(e.to);
  }
  return false;
}

/** Was an der Karte und an ihren Knoten nicht stimmt. */
function problemsOf(doc: FlowDoc, kind: 'plan' | 'rule'): { all: readonly string[]; byNode: ReadonlyMap<string, string> } {
  const all: string[] = [];
  const byNode = new Map<string, string>();
  const entries = (kind === 'plan' ? ['day', 'mass'] : ['record-start']) as FlowNodeType[];

  for (const type of entries) {
    const count = doc.nodes.filter((n) => n.type === type).length;
    if (count === 0) all.push(`Brak węzła „${NODE_INFO[type].label}” — od niego zaczyna się ${type === 'day' ? 'każdy dzień' : type === 'mass' ? 'każda msza' : 'sprawdzanie wpisu'}.`);
    if (count > 1) all.push(`Jest ${count} węzłów „${NODE_INFO[type].label}” — liczy się tylko jeden.`);
  }

  /* Erreichbar von einem Anfang. */
  const reached = new Set<string>();
  const stack = doc.nodes.filter((n) => NODE_INFO[n.type].entry === true).map((n) => n.id);
  while (stack.length > 0) {
    const at = stack.pop()!;
    if (reached.has(at)) continue;
    reached.add(at);
    for (const e of doc.edges) if (e.from === at) stack.push(e.to);
  }

  for (const n of doc.nodes) {
    if (!reached.has(n.id)) { byNode.set(n.id, 'nie łączy się z początkiem'); continue; }
    if (n.type === 'if') {
      const outs = new Set(doc.edges.filter((e) => e.from === n.id).map(outOf));
      if (!outs.has('yes') && !outs.has('no')) byNode.set(n.id, 'brak wyjść „tak” i „nie”');
      else if (!outs.has('yes')) byNode.set(n.id, 'brak wyjścia „tak”');
      else if (!outs.has('no')) byNode.set(n.id, 'brak wyjścia „nie”');
    }
  }

  return { all, byNode };
}

export interface FlowEditorProps {
  kind: 'plan' | 'rule';
  doc: FlowDoc;
  onChange: (doc: FlowDoc) => void;
  /** Plan: die Felder des gewählten Schemas (für „Ustaw pole"). Regel: die Felder eines Eintrags. */
  fields?: readonly SchemeField[];
  /** Plan: die Listen des Schemas (für „Dodaj wpis"). */
  lists?: readonly RecordList[];
  /** Regel: die Arten der Liste (pojedyncza / zbiorowa). */
  modes?: readonly SchemeChoice[];
  /** Was der Aufrufer neben die Karte stellt — eine Vorschau. */
  preview?: ReactNode;
  readOnly?: boolean;
}

export function FlowEditor({ kind, doc, onChange, fields, lists, modes, preview, readOnly = false }: FlowEditorProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  /* Die Karte selbst — um einen neuen Knoten ins Bild zu holen. */
  const rf = useRef<ReactFlowInstance | null>(null);

  const allowed = kind === 'plan' ? PLAN_NODES : RULE_NODES;
  const groups = kind === 'plan' ? PLAN_GROUPS : RULE_GROUPS;
  const problems = useMemo(() => problemsOf(doc, kind), [doc, kind]);

  /* Die Messen aus allen Knoten „Godziny mszy" — zur Wahl in „Która msza". */
  const slotKeys = useMemo(() => doc.nodes.filter((n) => n.type === 'slots').flatMap((n) => {
    const d = n.data as unknown as SlotsData;
    return [...(d.festive ?? []).map((r) => ({ key: r.key, label: `nd ${r.time}` })), ...(d.weekdays ?? []).map((r) => ({ key: r.key, label: `pow. ${r.time}` }))];
  }).filter((s, i, all) => s.key !== '' && all.findIndex((x) => x.key === s.key) === i), [doc.nodes]);

  const ctx = { fields, lists, modes };
  const rfNodes: Node<FaceData>[] = doc.nodes.map((n) => ({
    id: n.id,
    type: 'flow',
    position: { x: n.x, y: n.y },
    selected: n.id === selected,
    draggable: !readOnly,
    deletable: !readOnly,
    data: { node: n, summary: nodeSummary(n, ctx), problem: problems.byNode.get(n.id) ?? null }
  }));

  const rfEdges: Edge[] = doc.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    sourceHandle: outOf(e),
    targetHandle: 'in',
    selected: e.id === selectedEdge,
    deletable: !readOnly,
    /* „tak" grün, „nie" rot — die Wörter stehen am Ausgang des Knotens. */
    className: `wk-fedge wk-fedge-${outOf(e)}`,
    markerEnd: { type: MarkerType.ArrowClosed }
  }));

  /* -- Ändern ------------------------------------------------------------------------- */

  const change = (nodes: readonly FlowNode[], edges: readonly FlowEdge[]) => onChange({ v: 1, nodes, edges });

  const removeNodes = (ids: ReadonlySet<string>, nodes = doc.nodes, edges = doc.edges) => {
    change(nodes.filter((n) => !ids.has(n.id)), edges.filter((e) => !ids.has(e.from) && !ids.has(e.to)));
    if (selected !== null && ids.has(selected)) setSelected(null);
  };

  const onNodesChange = (changes: NodeChange[]) => {
    let nodes = doc.nodes;
    let moved = false;
    const gone = new Set<string>();
    for (const ch of changes) {
      if (ch.type === 'position' && ch.position !== undefined && !readOnly) {
        const { id, position } = ch;
        nodes = nodes.map((n) => (n.id === id ? { ...n, x: Math.round(position.x), y: Math.round(position.y) } : n));
        moved = true;
      }
      if (ch.type === 'select') {
        if (ch.selected) { setSelected(ch.id); setSelectedEdge(null); } else setSelected((was) => (was === ch.id ? null : was));
      }
      if (ch.type === 'remove' && !readOnly) gone.add(ch.id);
    }
    if (gone.size > 0) removeNodes(gone, nodes);
    else if (moved) change(nodes, doc.edges);
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    let edges = doc.edges;
    let dropped = false;
    for (const ch of changes) {
      if (ch.type === 'select') {
        if (ch.selected) { setSelectedEdge(ch.id); setSelected(null); } else setSelectedEdge((was) => (was === ch.id ? null : was));
      }
      if (ch.type === 'remove' && !readOnly) { edges = edges.filter((e) => e.id !== ch.id); dropped = true; }
    }
    if (dropped) change(doc.nodes, edges);
  };

  /* Eine Kante darf sein: von einem Ausgang, den der Knoten hat, zu einem Knoten, der kein Anfang ist, ohne Kreis. */
  const fits = (c: Connection): boolean => {
    const from = doc.nodes.find((n) => n.id === c.source);
    const to = doc.nodes.find((n) => n.id === c.target);
    if (from === undefined || to === undefined || from.id === to.id) return false;
    const handle = (c.sourceHandle ?? 'out') as FlowOut;
    if (!NODE_INFO[from.type].outs.includes(handle)) return false;
    if (NODE_INFO[to.type].entry === true) return false;
    /* Die Kante, die ersetzt würde, zählt nicht mit. */
    const rest = doc.edges.filter((e) => !(e.from === from.id && outOf(e) === handle));
    return !reaches(rest, to.id, from.id);
  };

  const connectFrom = (from: string, handle: FlowOut, to: string, edges = doc.edges): readonly FlowEdge[] => [
    ...edges.filter((e) => !(e.from === from && outOf(e) === handle)),
    { id: newId(), from, to, ...(handle === 'out' ? {} : { out: handle }) }
  ];

  const onConnect = (c: Connection) => {
    if (readOnly || c.source === null || c.target === null || !fits(c)) return;
    change(doc.nodes, connectFrom(c.source, (c.sourceHandle ?? 'out') as FlowOut, c.target));
  };

  /** Ein neuer Knoten: neben den gewählten (oder unter alle), an dessen freien Ausgang gehängt. */
  const add = (type: FlowNodeType) => {
    const base = doc.nodes.find((n) => n.id === selected) ?? null;
    const lowest = doc.nodes.reduce((y, n) => Math.max(y, n.y), -STEP_Y);
    let x = base === null ? 40 : base.x + STEP_X;
    let y = base === null ? lowest + STEP_Y : base.y;
    const taken = (px: number, py: number) => doc.nodes.some((n) => Math.abs(n.x - px) < STEP_X - 40 && Math.abs(n.y - py) < STEP_Y - 30);
    for (let i = 0; i < 40 && taken(x, y); i += 1) y += STEP_Y;
    if (base === null && NODE_INFO[type].entry === true) x = 40;

    const node: FlowNode = { id: newId(), type, x, y, data: defaultData(type, kind, lists) };
    let edges = doc.edges;
    if (base !== null && NODE_INFO[type].entry !== true) {
      const free = NODE_INFO[base.type].outs.find((o) => !doc.edges.some((e) => e.from === base.id && outOf(e) === o));
      if (free !== undefined) edges = connectFrom(base.id, free, node.id, edges);
    }
    change([...doc.nodes, node], edges);
    setSelected(node.id);
    setSelectedEdge(null);
    /* Der neue Knoten kommt ins Bild — er kann unter dem Rand der Karte liegen. */
    window.setTimeout(() => { const at = rf.current; if (at !== null) void at.setCenter(x + 90, y + 30, { zoom: at.getZoom(), duration: 250 }); }, 0);
  };

  const patchData = (id: string, data: Record<string, unknown>) =>
    change(doc.nodes.map((n) => (n.id === id ? { ...n, data } : n)), doc.edges);

  const chosen = doc.nodes.find((n) => n.id === selected) ?? null;
  const has = (type: FlowNodeType) => doc.nodes.some((n) => n.type === type);

  return (
    <section className={`wk-flow is-${kind}`}>
      {!readOnly && (
        <div className="wk-flow-palette" role="group" aria-label="Dodaj węzeł">
          {groups.map((g) => (
            <div key={g.label} className="wk-flow-palgroup">
              <span className="wk-flow-pallabel">{g.label}</span>
              {g.types.filter((t) => (allowed as readonly FlowNodeType[]).includes(t)).map((type) => {
                const once = NODE_INFO[type].entry === true && has(type);
                return (
                  <button key={type} type="button" className={`wk-flow-pal is-${NODE_INFO[type].entry === true ? 'entry' : type === 'if' ? 'test' : NODE_INFO[type].outs.length === 0 ? 'end' : 'act'}`}
                    disabled={once} title={once ? 'Już jest na mapie' : NODE_INFO[type].says} data-node-type={type} onClick={() => add(type)}>
                    + {NODE_INFO[type].label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {problems.all.length > 0 && (
        <ul className="wk-flow-problems">
          {problems.all.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}

      <div className="wk-flow-split">
        <div className="wk-flow-canvas">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={FLOW_NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={fits}
            onPaneClick={() => { setSelected(null); setSelectedEdge(null); }}
            onInit={(instance) => { rf.current = instance; }}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
            fitView
            /* Lesbar bleiben: lieber ein Stück schieben als Knoten, deren Schrift man nicht liest. */
            fitViewOptions={{ padding: 0.12, maxZoom: 1.1, minZoom: 0.6 }}
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <aside className="wk-flow-panel" aria-label="Ustawienia węzła">
          {chosen === null ? (
            <div className="wk-flow-stack">
              <p className="wk-empty">
                Kliknij węzeł, żeby go ustawić. Wyjście (kropka po prawej) połącz z wejściem następnego węzła (kropka po
                lewej). Nowy węzeł dodany przy zaznaczonym podłącza się do jego wolnego wyjścia. Zaznaczony węzeł albo
                krawędź usuwa Delete.
              </p>
              {kind === 'plan' && (
                <p className="wk-flow-note">
                  Dla każdego dnia ścieżka zaczyna się w „Dzień” i kończy w „Godziny mszy”; dla każdej mszy — w „Msza” i
                  kończy w „Utwórz” albo „Bez mszy”.
                </p>
              )}
            </div>
          ) : (
            <FlowPanel
              key={chosen.id}
              node={chosen}
              kind={kind}
              fields={fields}
              lists={lists}
              modes={modes}
              slotKeys={slotKeys}
              readOnly={readOnly}
              onData={(data) => patchData(chosen.id, data)}
              onRemove={() => removeNodes(new Set([chosen.id]))}
            />
          )}
        </aside>
      </div>

      {preview !== undefined && preview !== null && preview !== false && (
        <section className="wk-flow-preview" aria-label="Podgląd">{preview}</section>
      )}
    </section>
  );
}

export default FlowEditor;
