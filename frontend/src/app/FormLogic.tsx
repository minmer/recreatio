/**
 * Die LOGIK eines Formulars — als Graph (0043).
 *
 * <b>Links, was hereinkommt; in der Mitte, was daraus gerechnet wird; rechts,
 * was es bewirkt.</b>
 *
 * <code>
 *   Eingänge   Odpowiedź (die Antwort auf eine Frage), Wartość (ein fester Wert)
 *   Logik      Porównanie (=, ≠, >, ≥, <, ≤, zawiera, wypełnione, puste),
 *              I, LUB, NIE, ALBO
 *   Ausgänge   Pokaż (eine Frage, einen Text, eine Gruppe — nur wenn wahr),
 *              Komunikat (ein Hinweis unter einer Frage), Nazwa pola (ein
 *              anderer Name), Wymagane (Pflicht, wenn wahr)
 * </code>
 *
 * <b>Nicht jede Frage muss hinein.</b> Worauf kein Ausgang zeigt, bleibt, wie
 * es ist. Mehrere „Pokaż" auf dasselbe Ziel müssen ALLE gelten — wer „oder"
 * meint, hängt ein LUB davor.
 *
 * <b>Was nicht geht, lässt sich nicht ziehen:</b> ein Kreis, eine Kante in
 * einen Eingang, eine zweite Kante in einen Anschluss, der nur eine nimmt (die
 * neue ersetzt dann die alte). Der Editor sagt es mit der Geste, nicht mit
 * einer Absage danach.
 *
 * <b>Die Vorschau rechnet mit, während man baut.</b> Unten tippt man
 * Beispielantworten ein, und jeder Knoten zeigt, was er daraus macht.
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background, Controls, Handle, Position,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { OpenField } from './form';
import {
  COMPARE_LABEL, COMPARE_OPS, evaluate, GROUP_LABEL, NODE_LABEL, portsOf, roleOf, UNARY, wouldCycle,
  type CompareOp, type FormDesign, type LayoutItem, type LogicEdge, type LogicNode, type NodeKind, type Port
} from './formDesign';
import { newId } from './ids';

/* -- Wie ein Knoten aussieht ------------------------------------------------------ */

interface NodeData {
  readonly node: LogicNode;
  readonly summary: string;

  /** Was er in der Vorschau gerade ergibt. */
  readonly preview: string | boolean | undefined;
}

const PORT_LABEL: Record<Port, string> = { a: 'A', b: 'B', in: '' };

function LogicNodeView({ data, selected }: NodeProps<NodeData>) {
  const { node, summary, preview } = data;
  const role = roleOf(node.kind);
  const ports = portsOf(node.kind).filter((p) => !(node.kind === 'compare' && p.port === 'b' && UNARY.includes(node.op ?? 'eq')));

  return (
    <div className={`wk-lnode wk-lnode-${role}${selected ? ' wk-lnode-on' : ''}`}>
      {ports.map((p, i) => (
        <Fragment key={p.port}>
          <Handle
            id={p.port}
            type="target"
            position={Position.Left}
            className="wk-lhandle"
            style={{ top: `${((i + 1) / (ports.length + 1)) * 100}%` }}
            title={p.many ? 'dowolnie wiele wejść' : 'jedno wejście'}
          />
          {PORT_LABEL[p.port] !== '' && (
            <span className="wk-lport" style={{ top: `${((i + 1) / (ports.length + 1)) * 100}%` }}>{PORT_LABEL[p.port]}</span>
          )}
        </Fragment>
      ))}

      <span className="wk-lnode-kind">{NODE_LABEL[node.kind]}</span>
      {summary !== '' && <span className="wk-lnode-sum">{summary}</span>}

      {preview !== undefined && (
        <span className={`wk-lnode-val${preview === true ? ' is-yes' : preview === false ? ' is-no' : ''}`}>
          {preview === true ? 'tak' : preview === false ? 'nie' : preview === '' ? '—' : `„${preview.slice(0, 18)}"`}
        </span>
      )}

      {role !== 'output' && (
        <Handle id="out" type="source" position={Position.Right} className="wk-lhandle" />
      )}
    </div>
  );
}

/* Ausserhalb der Komponente: React Flow vergleicht die Typen mit `===`. */
const NODE_TYPES = { logic: LogicNodeView };

/* -- Die Palette ------------------------------------------------------------------- */

const PALETTE: readonly { title: string; kinds: readonly NodeKind[] }[] = [
  { title: 'Wejścia', kinds: ['answer', 'const'] },
  { title: 'Logika', kinds: ['compare', 'and', 'or', 'not', 'xor'] },
  { title: 'Wyjścia', kinds: ['show', 'message', 'label', 'require'] }
];

const COLUMN: Record<ReturnType<typeof roleOf>, number> = { input: 40, gate: 340, output: 640 };

/* -- Der Editor --------------------------------------------------------------------- */

export function FormLogic({ design, layout, fields, busy, onSave }: {
  design: FormDesign;
  /** Der vollständige Aufbau — daraus die Ziele von „Pokaż". */
  layout: readonly LayoutItem[];
  fields: readonly OpenField[];
  busy: boolean;
  onSave: (nodes: readonly LogicNode[], edges: readonly LogicEdge[]) => void;
}) {
  const [nodes, setNodes] = useState<readonly LogicNode[]>(design.nodes);
  const [edges, setEdges] = useState<readonly LogicEdge[]>(design.edges);
  const [selected, setSelected] = useState<string | null>(null);
  const [sample, setSample] = useState<Record<string, string>>({});

  const saved = JSON.stringify({ n: design.nodes, e: design.edges });
  const dirty = JSON.stringify({ n: nodes, e: edges }) !== saved;

  /*
   * Kommt eine andere gespeicherte Logik herein (jemand anderes hat
   * gespeichert, oder das Formular zog um), beginnt der Entwurf von dort — am
   * INHALT gemessen, damit das eigene Speichern nichts zurücksetzt.
   */
  useEffect(() => {
    setNodes(design.nodes);
    setEdges(design.edges);
  }, [saved]);

  const byField = useMemo(() => new Map(fields.map((f) => [f.fieldId, f])), [fields]);

  /* Alle Ziele: Fragen, Texte, Gruppen — mit einem Namen, den man erkennt. */
  const targets = useMemo(() => {
    const out: { id: string; label: string; field: boolean }[] = [];
    const walk = (items: readonly LayoutItem[], depth: number) => {
      for (const item of items) {
        const pad = '  '.repeat(depth);
        if (item.type === 'field') out.push({ id: item.id, label: pad + (byField.get(item.id)?.label ?? 'zapieczętowane pytanie'), field: true });
        if (item.type === 'text') out.push({ id: item.id, label: `${pad}Tekst: ${item.text.slice(0, 40) || '(pusty)'}`, field: false });
        if (item.type === 'group') {
          out.push({ id: item.id, label: `${pad}${GROUP_LABEL[item.kind]}: ${item.title || '(bez tytułu)'}`, field: false });
          walk(item.items, depth + 1);
        }
      }
    };
    walk(layout, 0);
    return out;
  }, [layout, byField]);

  const nameOf = (id: string | undefined) =>
    id === undefined ? '— wybierz —' : targets.find((t) => t.id === id)?.label.trim() ?? '(usunięte)';

  const summary = (n: LogicNode): string => {
    switch (n.kind) {
      case 'answer': return n.fieldId === undefined ? '— wybierz pytanie —' : byField.get(n.fieldId)?.label ?? '(usunięte pytanie)';
      case 'const': return `„${n.value ?? ''}"`;
      case 'compare': return COMPARE_LABEL[n.op ?? 'eq'];
      case 'show':
      case 'require': return nameOf(n.target);
      case 'message':
      case 'label': return `${nameOf(n.target)}${(n.value ?? '') === '' ? '' : ` — ${n.value!.slice(0, 30)}`}`;
      default: return '';
    }
  };

  /* Die Vorschau: dieselbe Auswertung wie im Formular. */
  const outcome = useMemo(
    () => evaluate({ version: 1, layout, nodes, edges }, sample), [layout, nodes, edges, sample]);

  const rfNodes: Node<NodeData>[] = nodes.map((n) => ({
    id: n.id,
    type: 'logic',
    position: { x: n.x, y: n.y },
    selected: n.id === selected,
    data: { node: n, summary: summary(n), preview: outcome.values.get(n.id) }
  }));

  const rfEdges: Edge[] = edges.map((e) => {
    const on = outcome.values.get(e.from);
    return {
      id: e.id, source: e.from, target: e.to, sourceHandle: 'out', targetHandle: e.port,
      animated: on === true,
      style: { strokeWidth: 2, stroke: on === true ? 'var(--wk-ok)' : 'var(--wk-muted)' }
    };
  });

  /* -- Ziehen, verschieben, löschen ---------------------------------------------- */

  const fits = (c: Connection): boolean => {
    const from = nodes.find((n) => n.id === c.source);
    const to = nodes.find((n) => n.id === c.target);
    if (from === undefined || to === undefined) return false;
    if (roleOf(from.kind) === 'output' || roleOf(to.kind) === 'input') return false;
    if (!portsOf(to.kind).some((p) => p.port === c.targetHandle)) return false;
    return !wouldCycle(edges, from.id, to.id);
  };

  const connect = (c: Connection) => {
    if (!fits(c) || c.source === null || c.target === null) return;
    const port = c.targetHandle as Port;
    const to = nodes.find((n) => n.id === c.target)!;
    const many = portsOf(to.kind).find((p) => p.port === port)?.many ?? false;

    setEdges((was) => [
      /* Ein Anschluss für EINE Kante: die neue ersetzt die alte. */
      ...was.filter((e) => many || !(e.to === c.target && e.port === port)),
      { id: newId(), from: c.source!, to: c.target!, port }
    ]);
  };

  const nodeChanges = (changes: NodeChange[]) => {
    for (const ch of changes) {
      if (ch.type === 'position' && ch.position !== undefined) {
        const { id, position } = ch;
        setNodes((was) => was.map((n) => n.id === id ? { ...n, x: Math.round(position.x), y: Math.round(position.y) } : n));
      }
      if (ch.type === 'select') setSelected((was) => (ch.selected ? ch.id : was === ch.id ? null : was));
      if (ch.type === 'remove') drop(ch.id);
    }
  };

  const edgeChanges = (changes: EdgeChange[]) => {
    for (const ch of changes) {
      if (ch.type === 'remove') setEdges((was) => was.filter((e) => e.id !== ch.id));
    }
  };

  const drop = (id: string) => {
    setNodes((was) => was.filter((n) => n.id !== id));
    setEdges((was) => was.filter((e) => e.from !== id && e.to !== id));
    setSelected((was) => (was === id ? null : was));
  };

  const add = (kind: NodeKind) => {
    const role = roleOf(kind);
    const same = nodes.filter((n) => roleOf(n.kind) === role).length;
    const node: LogicNode = {
      id: newId(), kind, x: COLUMN[role], y: 40 + same * 96,
      ...(kind === 'compare' ? { op: 'eq' as CompareOp } : {}),
      ...(kind === 'const' ? { value: '' } : {})
    };
    setNodes((was) => [...was, node]);
    setSelected(node.id);
  };

  const patch = (id: string, change: Partial<LogicNode>) =>
    setNodes((was) => was.map((n) => n.id === id ? { ...n, ...change } : n));

  const chosen = nodes.find((n) => n.id === selected) ?? null;

  /* Die Fragen, deren Antworten die Logik liest — für die Vorschau. */
  const read = [...new Set(nodes.filter((n) => n.kind === 'answer' && n.fieldId !== undefined).map((n) => n.fieldId!))];

  return (
    <section className="wk-logic">
      <div className="wk-logic-palette">
        {PALETTE.map((group) => (
          <div className="wk-logic-pal-group" key={group.title}>
            <span className="wk-hint">{group.title}</span>
            {group.kinds.map((kind) => (
              <button key={kind} type="button" className={`wk-lpal wk-lpal-${roleOf(kind)}`} onClick={() => add(kind)}>
                + {NODE_LABEL[kind]}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="wk-logic-split">
        <div className="wk-logic-canvas">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={NODE_TYPES}
            onNodesChange={nodeChanges}
            onEdgesChange={edgeChanges}
            onConnect={connect}
            isValidConnection={fits}
            onPaneClick={() => setSelected(null)}
            deleteKeyCode={['Delete', 'Backspace']}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <aside className="wk-side">
          {chosen === null ? (
            <p className="wk-empty">
              Dodaj węzeł z palety, połącz wyjście (prawa kropka) z wejściem (lewa kropka),
              kliknij węzeł, żeby go ustawić. Zaznaczony węzeł albo krawędź usuwa klawisz Delete.
            </p>
          ) : (
            <Inspector
              node={chosen}
              fields={fields}
              targets={targets}
              onPatch={(change) => patch(chosen.id, change)}
              onDrop={() => drop(chosen.id)}
            />
          )}
        </aside>
      </div>

      {/* -- Die Vorschau ------------------------------------------------------ */}
      <details className="wk-fold" open={read.length > 0}>
        <summary>Podgląd — wpisz przykładowe odpowiedzi</summary>

        {read.length === 0 ? (
          <p className="wk-hint">Logika nie czyta jeszcze żadnej odpowiedzi — dodaj węzeł „Odpowiedź".</p>
        ) : (
          <div className="wk-entries-bar">
            {read.map((id) => (
              <label className="wk-field" key={id}>
                <span>{byField.get(id)?.label ?? 'pytanie'}</span>
                <input value={sample[id] ?? ''} onChange={(e) => setSample((was) => ({ ...was, [id]: e.target.value }))} />
              </label>
            ))}
          </div>
        )}

        <ul className="wk-card-lines">
          {targets.filter((t) => outcome.hidden.has(t.id)).map((t) => <li key={`h${t.id}`}>ukryte: {t.label.trim()}</li>)}
          {[...outcome.labels].map(([id, text]) => <li key={`l${id}`}>nazwa: {nameOf(id)} → „{text}"</li>)}
          {[...outcome.messages].flatMap(([id, texts]) => texts.map((text, i) => <li key={`m${id}${i}`}>komunikat przy {nameOf(id)}: {text}</li>))}
          {[...outcome.required].map((id) => <li key={`r${id}`}>wymagane: {nameOf(id)}</li>)}
        </ul>
      </details>

      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={busy || !dirty} onClick={() => onSave(nodes, edges)}>
          Zapisz logikę
        </button>
        {dirty && (
          <button type="button" className="wk-link-btn" disabled={busy}
            onClick={() => { setNodes(design.nodes); setEdges(design.edges); setSelected(null); }}>
            Cofnij zmiany
          </button>
        )}
      </div>
    </section>
  );
}

/** Was sich an EINEM Knoten einstellen lässt — je nach Art. */
function Inspector({ node, fields, targets, onPatch, onDrop }: {
  node: LogicNode;
  fields: readonly OpenField[];
  targets: readonly { id: string; label: string; field: boolean }[];
  onPatch: (change: Partial<LogicNode>) => void;
  onDrop: () => void;
}) {
  const fieldTargets = targets.filter((t) => t.field);

  return (
    <div className="wk-form">
      <h3 className="wk-h2">{NODE_LABEL[node.kind]}</h3>

      {node.kind === 'answer' && (
        <label className="wk-field">
          <span>Odpowiedź na pytanie</span>
          <select value={node.fieldId ?? ''} onChange={(e) => onPatch({ fieldId: e.target.value || undefined })}>
            <option value="">— wybierz —</option>
            {fields.map((f) => <option key={f.fieldId} value={f.fieldId}>{f.label ?? 'zapieczętowane pytanie'}</option>)}
          </select>
        </label>
      )}

      {node.kind === 'const' && (
        <label className="wk-field">
          <span>Wartość</span>
          <input value={node.value ?? ''} placeholder="np. 16, tak, Kraków" onChange={(e) => onPatch({ value: e.target.value })} />
          <span className="wk-hint">Liczby porównuje się jako liczby, resztę jako tekst (bez wielkości liter).</span>
        </label>
      )}

      {node.kind === 'compare' && (
        <label className="wk-field">
          <span>Jak porównać A z B</span>
          <select value={node.op ?? 'eq'} onChange={(e) => onPatch({ op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((op) => <option key={op} value={op}>A {COMPARE_LABEL[op]}{UNARY.includes(op) ? '' : ' B'}</option>)}
          </select>
        </label>
      )}

      {(node.kind === 'and' || node.kind === 'or' || node.kind === 'xor' || node.kind === 'not') && (
        <p className="wk-hint">
          {node.kind === 'and' ? 'Prawda, gdy prawdziwe są wszystkie wejścia.'
            : node.kind === 'or' ? 'Prawda, gdy prawdziwe jest choć jedno wejście.'
            : node.kind === 'xor' ? 'Prawda, gdy prawdziwych wejść jest nieparzyście wiele (przy dwóch: dokładnie jedno).'
            : 'Odwraca: prawda staje się fałszem i odwrotnie.'}
          {' '}Odpowiedź „nie", „0" albo puste pole liczy się jako fałsz.
        </p>
      )}

      {node.kind === 'show' && (
        <label className="wk-field">
          <span>Co pokazać, gdy wejście jest prawdziwe</span>
          <select value={node.target ?? ''} onChange={(e) => onPatch({ target: e.target.value || undefined })}>
            <option value="">— wybierz —</option>
            {targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <span className="wk-hint">Kilka „Pokaż" na jednym celu — muszą być spełnione wszystkie.</span>
        </label>
      )}

      {(node.kind === 'message' || node.kind === 'label' || node.kind === 'require') && (
        <label className="wk-field">
          <span>Przy pytaniu</span>
          <select value={node.target ?? ''} onChange={(e) => onPatch({ target: e.target.value || undefined })}>
            <option value="">— wybierz —</option>
            {fieldTargets.map((t) => <option key={t.id} value={t.id}>{t.label.trim()}</option>)}
          </select>
        </label>
      )}

      {node.kind === 'message' && (
        <label className="wk-field">
          <span>Komunikat pod polem</span>
          <textarea rows={3} value={node.value ?? ''} onChange={(e) => onPatch({ value: e.target.value })} />
        </label>
      )}

      {node.kind === 'label' && (
        <label className="wk-field">
          <span>Nazwa pola, gdy wejście jest prawdziwe</span>
          <input value={node.value ?? ''} onChange={(e) => onPatch({ value: e.target.value })} />
        </label>
      )}

      <div className="wk-actions">
        <button type="button" className="wk-link-btn wk-danger" onClick={onDrop}>Usuń węzeł</button>
      </div>
    </div>
  );
}

export default FormLogic;
