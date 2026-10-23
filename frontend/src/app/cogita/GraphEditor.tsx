/**
 * COGITA — DER EINE GRAPH-EDITOR (COGITA.md §4, [N4]).
 *
 * Kartenvorlagen, Wiederholungen und Abläufe zeichnet derselbe Editor; was ein
 * Knoten ist, welche Anschlüsse er hat und was er einstellt, sagt die Palette
 * (`graph.ts`, `nodeFields.ts`). Links zeichnet man, rechts stellt man ein —
 * und wer nicht ziehen will (ein Telefon, eine Tastatur), verbindet in der
 * Leiste über Listen.
 */

import { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background, Controls, Handle, Position, useReactFlow, useStore, useUpdateNodeInternals,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';

import { newId } from '../core/ids';
import { readRule, TEXT_RULE, type TextRule } from './check';
import { uploadFile } from './files';
import { connect, problemsOf, type Graph, type GraphNode, type Palette } from './graph';
import { readAction, readCondition, type Action } from './logic';
import { configFields, configSummary, FORM_OPTIONS, LEVEL_OPTIONS, type ConfigField } from './nodeFields';
import { ActionsEditor, ConditionEditor, EntityPicker, KindSelect, MediaView, entityName, useCtx } from './ui';
import { BOOK_KINDS } from './store';
import { RuleEditor } from './RuleEditor';
import { readRule as readQuery } from './selection';
import { areaKeys, newestKey } from '../chat/chat';
import type { MediaRef } from './schema';
import { resolveKinds } from './statements';

interface NodeData {
  readonly label: string;
  readonly summary: string;
  readonly inputs: readonly { id: string; label: string }[];
  readonly outputs: readonly { id: string; label: string }[];
  readonly error?: string;
  readonly start?: boolean;
}

function GraphNodeView({ data, selected }: NodeProps<NodeData>) {
  return (
    <div className={`cg-node${selected ? ' is-on' : ''}${data.error !== undefined ? ' is-bad' : ''}`}>
      <div className="cg-node-head">{data.start === true ? '▶ ' : ''}{data.label}</div>
      {data.summary !== '' && <div className="cg-node-sub" title={data.summary}>{data.summary}</div>}
      <div className="cg-node-ports">
        <ul>
          {data.inputs.map((p) => (
            <li key={p.id}>
              <Handle id={p.id} type="target" position={Position.Left} className="cg-handle" />
              {p.label}
            </li>
          ))}
        </ul>
        <ul>
          {data.outputs.map((p) => (
            <li key={p.id} className="is-out">
              {p.label}
              <Handle id={p.id} type="source" position={Position.Right} className="cg-handle" />
            </li>
          ))}
        </ul>
      </div>
      {data.error !== undefined && <div className="cg-node-error">{data.error}</div>}
    </div>
  );
}

const NODE_TYPES = { cg: GraphNodeView };

/*
  2026-10-17 — KNOTEN, DIE NIE VERMESSEN WURDEN. React Flow zeigt einen Knoten
  erst, wenn es seine Grösse kennt; gemessen wird, wenn der ResizeObserver
  meldet. Kommt die erste Meldung, bevor die Leinwand bereit ist, verfällt sie
  — und weil sich die Grösse danach nicht mehr ändert, kommt keine zweite: die
  Knoten bleiben unsichtbar und mit ihnen die Kanten (gesehen beim Formularz
  dodawania, gleich nach „Z rodzaju"). Dieses Kind der Leinwand misst nach,
  was ohne Grösse dasteht.
*/
export function Remeasure() {
  const update = useUpdateNodeInternals();
  const pending = useStore((s) => [...s.nodeInternals.values()].filter((n) => !n.width || !n.height).map((n) => n.id).join(','));
  useEffect(() => {
    if (pending === '') return undefined;
    const later = window.setTimeout(() => update(pending.split(',')), 60);
    return () => window.clearTimeout(later);
  }, [pending, update]);
  return null;
}

/*
  Das ganze Bild im Blick: sobald alle Knoten ihre Grösse haben — am Anfang
  und nachdem einer dazukam. `fitView` allein passt nur beim ersten Zeichnen
  an, und da hatten noch nicht alle Knoten ihre Grösse: eine breite Vorlage
  („Słowa między językami", elf Schritte) stand an beiden Rändern abgeschnitten.
*/
export function FitWhenMeasured({ padding = 0.08 }: { padding?: number }) {
  const { fitView } = useReactFlow();
  const measured = useStore((s) => {
    const all = [...s.nodeInternals.values()];
    return all.length > 0 && all.every((n) => !!n.width && !!n.height) ? all.length : 0;
  });
  useEffect(() => {
    if (measured === 0) return undefined;
    const later = window.setTimeout(() => fitView({ padding, duration: 200 }), 30);
    return () => window.clearTimeout(later);
  }, [measured, fitView, padding]);
  return null;
}

export interface FieldKey {
  readonly key: string;
  readonly label: string;
  readonly group?: string;
}

export interface GraphEditorProps<C> {
  readonly graph: Graph;
  readonly palette: Palette<C>;
  readonly onChange: (next: Graph) => void;
  /** Ein Ablauf darf zurückführen. */
  readonly cycles?: boolean;
  /** Die Felder, die ein Knoten „Pole" anbieten kann (aus den Arten der Vorlage). */
  /** Die Felder zur Wahl — ohne `group` die des eigenen Rodzaj, sonst unter dem Namen ihres Rodzaj. */
  readonly fieldKeys?: readonly FieldKey[];
  /** Fehler je Knoten aus der letzten Auswertung. */
  readonly errors?: ReadonlyMap<string, string>;
  readonly start?: string | null;
  readonly onStart?: (id: string) => void;
  readonly readOnly?: boolean;
}

export function GraphEditor<C>({ graph, palette, onChange, cycles = false, fieldKeys = [], errors, start, onStart, readOnly = false }: GraphEditorProps<C>) {
  const { lib } = useCtx();
  const [chosen, setChosen] = useState<string | null>(null);
  const [moving, setMoving] = useState<Readonly<Record<string, { x: number; y: number }>>>({});
  const [said, setSaid] = useState<string | null>(null);
  const name = (kind: 'entity' | 'kind' | 'collection' | 'flow' | 'template' | 'source', id: string): string => {
    if (kind === 'entity') return entityName(lib, id);
    if (kind === 'source') return id === lib.libraryId ? 'ta baza' : lib.sourceList().find((s) => s.store.libraryId === id)?.name ?? id;
    if (kind === 'kind') return lib.kind(id)?.name ?? id;
    if (kind === 'collection') return lib.collections().find((c) => c.id === id)?.name ?? id;
    if (kind === 'template') return lib.templates().find((t) => t.id === id)?.name ?? id;
    const flow = lib.docs('flow').find((e) => e.id === id);
    return typeof flow?.data.name === 'string' ? flow.data.name : id;
  };

  const nodes: Node<NodeData>[] = graph.nodes.map((n) => {
    const kind = palette.kinds.get(n.type);
    const ports = kind?.ports(n.config) ?? { inputs: [], outputs: [] };
    return {
      id: n.id,
      type: 'cg',
      position: moving[n.id] ?? { x: n.x, y: n.y },
      selected: chosen === n.id,
      data: {
        label: kind?.label ?? n.type,
        summary: configSummary(palette.id, n.type, n.config, name),
        inputs: ports.inputs.map((p) => ({ id: p.id, label: p.label })),
        outputs: ports.outputs.map((p) => ({ id: p.id, label: p.label })),
        ...(errors?.get(n.id) === undefined ? {} : { error: errors.get(n.id) }),
        ...(start === n.id ? { start: true } : {})
      }
    };
  });
  const edges: Edge[] = graph.edges.map((e) => ({ id: e.id, source: e.from, sourceHandle: e.out, target: e.to, targetHandle: e.in }));
  const problems = useMemo(() => problemsOf(graph, palette, cycles), [graph, palette, cycles]);

  const add = (type: string) => {
    const at = graph.nodes.length === 0 ? { x: 40, y: 40 } : { x: Math.max(...graph.nodes.map((n) => n.x)) + 220, y: 40 + (graph.nodes.length % 5) * 90 };
    const id = newId().slice(-8);
    onChange({ nodes: [...graph.nodes, { id, type, x: at.x, y: at.y, config: {} }], edges: graph.edges });
    setChosen(id);
  };

  const link = (c: { source: string | null; target: string | null; sourceHandle: string | null; targetHandle: string | null }) => {
    if (readOnly || c.source === null || c.target === null) return;
    const done = connect(graph, palette, { id: newId().slice(-8), from: c.source, out: c.sourceHandle ?? 'out', to: c.target, in: c.targetHandle ?? 'in' }, cycles);
    if ('error' in done) { setSaid(done.error); return; }
    setSaid(null);
    onChange(done.graph);
  };

  const nodeChanges = (changes: NodeChange[]) => {
    for (const ch of changes) {
      if (ch.type === 'position' && ch.position !== undefined) {
        const { id, position } = ch;
        setMoving((was) => ({ ...was, [id]: { x: Math.round(position.x), y: Math.round(position.y) } }));
      }
      if (ch.type === 'select') setChosen((was) => (ch.selected ? ch.id : was === ch.id ? null : was));
      if (ch.type === 'remove' && !readOnly) onChange({ nodes: graph.nodes.filter((n) => n.id !== ch.id), edges: graph.edges.filter((e) => e.from !== ch.id && e.to !== ch.id) });
    }
  };

  const edgeChanges = (changes: EdgeChange[]) => {
    const gone = new Set(changes.filter((c) => c.type === 'remove').map((c) => c.id));
    if (gone.size > 0 && !readOnly) onChange({ nodes: graph.nodes, edges: graph.edges.filter((e) => !gone.has(e.id)) });
  };

  const dropped = (id: string) => {
    const spot = moving[id];
    if (spot === undefined) return;
    onChange({ nodes: graph.nodes.map((n) => (n.id === id ? { ...n, x: spot.x, y: spot.y } : n)), edges: graph.edges });
    setMoving(({ [id]: _gone, ...rest }) => { void _gone; return rest; });
  };

  const node = graph.nodes.find((n) => n.id === chosen);
  const setConfig = (patch: Record<string, unknown>) => {
    if (node === undefined) return;
    const config: Record<string, unknown> = { ...node.config, ...patch };
    for (const [k, v] of Object.entries(patch)) if (v === undefined || v === '') delete config[k];
    onChange({ nodes: graph.nodes.map((n) => (n.id === node.id ? { ...n, config } : n)), edges: graph.edges });
  };

  const groups = new Map<string, { type: string; label: string; says: string }[]>();
  for (const k of palette.kinds.values()) groups.set(k.group, [...(groups.get(k.group) ?? []), { type: k.type, label: k.label, says: k.says }]);

  return (
    <div className="cg-graph">
      <div className="cg-graph-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={nodeChanges}
          onEdgesChange={edgeChanges}
          onConnect={(c: Connection) => link(c)}
          onNodeDragStop={(_, n) => dropped(n.id)}
          onPaneClick={() => setChosen(null)}
          deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
          nodesConnectable={!readOnly}
          nodesDraggable={!readOnly}
          fitView
          /* Eine breite Vorlage (elf Schritte) passt erst unter der Hälfte ganz hinein — sonst steht sie an den Rändern abgeschnitten. */
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
          <Remeasure />
          <FitWhenMeasured />
        </ReactFlow>
      </div>
      <aside className="cg-graph-side">
        {said !== null && <p className="wk-error">{said}</p>}
        {node !== undefined ? (
          <NodePanel
            node={node} palette={palette} fieldKeys={fieldKeys} readOnly={readOnly} graph={graph} cycles={cycles}
            onConfig={setConfig}
            onLink={link}
            onRemove={() => { onChange({ nodes: graph.nodes.filter((n) => n.id !== node.id), edges: graph.edges.filter((e) => e.from !== node.id && e.to !== node.id) }); setChosen(null); }}
            onStart={onStart === undefined ? undefined : () => onStart(node.id)}
            isStart={start === node.id}
          />
        ) : !readOnly && (
          <div className="cg-palette">
            <p className="wk-hint">Kliknij, żeby dodać krok; połącz wyjście (z prawej) z wejściem (z lewej). Usuń zaznaczone klawiszem Delete.</p>
            {[...groups.entries()].map(([group, kinds]) => (
              <div key={group} className="cg">
                <h4>{group}</h4>
                {kinds.map((k) => <button key={k.type} type="button" title={k.says} onClick={() => add(k.type)}>{k.label}</button>)}
              </div>
            ))}
          </div>
        )}
        {problems.length > 0 && (
          <ul className="wk-hint">
            {problems.slice(0, 8).map((p, i) => <li key={i}>{p.text}</li>)}
          </ul>
        )}
      </aside>
    </div>
  );
}

/* -- Der Knoten, eingestellt ------------------------------------------------------------------- */

function NodePanel<C>({ node, palette, fieldKeys, readOnly, graph, cycles, onConfig, onLink, onRemove, onStart, isStart }: {
  node: GraphNode;
  palette: Palette<C>;
  fieldKeys: readonly FieldKey[];
  readOnly: boolean;
  graph: Graph;
  cycles: boolean;
  onConfig: (patch: Record<string, unknown>) => void;
  onLink: (c: { source: string | null; target: string | null; sourceHandle: string | null; targetHandle: string | null }) => void;
  onRemove: () => void;
  onStart?: () => void;
  isStart: boolean;
}) {
  const kind = palette.kinds.get(node.type);
  const fields = configFields(palette.id, node.type);
  const [json, setJson] = useState<string | null>(null);
  const outputs = kind?.ports(node.config).outputs ?? [];
  const others = graph.nodes.filter((n) => n.id !== node.id);

  return (
    <div className="wk-form cg">
      <div className="cg-row-between">
        <strong>{kind?.label ?? node.type}</strong>
        {!readOnly && <button type="button" className="wk-link-btn" onClick={onRemove}>usuń krok</button>}
      </div>
      {kind !== undefined && <p className="wk-hint">{kind.says}</p>}
      {onStart !== undefined && (isStart ? <span className="cg-tag is-ok">początek przebiegu</span> : !readOnly && <button type="button" className="wk-link-btn" onClick={onStart}>Zacznij tutaj</button>)}
      {fields.map((field) => <ConfigInput key={field.key} field={field} value={node.config[field.key]} fieldKeys={fieldKeys} readOnly={readOnly} onSet={(v) => onConfig({ [field.key]: v })} />)}
      {!readOnly && outputs.length > 0 && (
        <details>
          <summary>Połączenia bez przeciągania</summary>
          {outputs.map((out) => {
            const now = graph.edges.find((e) => e.from === node.id && e.out === out.id);
            return (
              <label key={out.id} className="wk-field">
                <span>{out.label} →</span>
                <select value={now?.to ?? ''} onChange={(e) => {
                  const to = e.target.value;
                  if (to === '') return;
                  const target = graph.nodes.find((n) => n.id === to);
                  const into = target === undefined ? undefined : palette.kinds.get(target.type)?.ports(target.config).inputs[0];
                  onLink({ source: node.id, sourceHandle: out.id, target: to, targetHandle: into?.id ?? 'in' });
                }}>
                  <option value="">—</option>
                  {others.map((n) => <option key={n.id} value={n.id}>{palette.kinds.get(n.type)?.label ?? n.type} {n.id.slice(-4)}</option>)}
                </select>
              </label>
            );
          })}
          {cycles && <p className="wk-hint">W przebiegu wolno wracać (np. do wyboru rozdziałów).</p>}
        </details>
      )}
      <details onToggle={(e) => setJson((e.target as HTMLDetailsElement).open ? JSON.stringify(node.config, null, 2) : null)}>
        <summary>Ustawienia jako JSON</summary>
        {json !== null && (
          <>
            <textarea className="cg-code" value={json} readOnly={readOnly} onChange={(e) => setJson(e.target.value)} />
            {!readOnly && <button type="button" className="wk-btn" onClick={() => {
              try {
                const parsed = JSON.parse(json) as Record<string, unknown>;
                const cleared: Record<string, unknown> = Object.fromEntries(Object.keys(node.config).map((k) => [k, undefined] as [string, unknown]));
                onConfig({ ...cleared, ...parsed });
              } catch { /* bleibt */ }
            }}>Zastosuj</button>}
          </>
        )}
      </details>
    </div>
  );
}

const lines = (v: unknown): string => (Array.isArray(v) ? v.map(String).join('\n') : typeof v === 'string' ? v : '');
const toLines = (text: string): string[] => text.split('\n').map((t) => t.trim()).filter((t) => t !== '');

/** Ein Feld eines Knotens — 2026-10-22 (Schritt 9) auch für die Schritte eines Widoku (`ViewSteps.tsx`). */
export function ConfigInput({ field, value, fieldKeys, readOnly, onSet }: {
  field: ConfigField;
  value: unknown;
  fieldKeys: readonly FieldKey[];
  readOnly: boolean;
  onSet: (v: unknown) => void;
}) {
  const { lib } = useCtx();
  const label = <span>{field.label}{field.hint === undefined ? '' : <span className="wk-hint"> — {field.hint}</span>}</span>;
  switch (field.type) {
    case 'text':
      return <label className="wk-field">{label}<input value={typeof value === 'string' ? value : ''} disabled={readOnly} onChange={(e) => onSet(e.target.value)} /></label>;
    case 'longtext':
      return <label className="wk-field">{label}<textarea rows={3} value={typeof value === 'string' ? value : ''} disabled={readOnly} onChange={(e) => onSet(e.target.value)} /></label>;
    case 'code':
      return <label className="wk-field">{label}<textarea className="cg-code" spellCheck={false} value={typeof value === 'string' ? value : ''} disabled={readOnly} onChange={(e) => onSet(e.target.value)} /></label>;
    case 'number':
      return <label className="wk-field">{label}<input type="number" step="any" value={typeof value === 'number' ? value : ''} disabled={readOnly} onChange={(e) => onSet(e.target.value === '' ? undefined : Number(e.target.value))} /></label>;
    case 'bool':
      return <label className="pe-check"><input type="checkbox" checked={value === true} disabled={readOnly} onChange={(e) => onSet(e.target.checked ? true : undefined)} /><span>{field.label}</span></label>;
    case 'select':
      return (
        <label className="wk-field">{label}
          <select value={typeof value === 'string' ? value : ''} disabled={readOnly} onChange={(e) => onSet(e.target.value)}>
            <option value="">—</option>
            {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      );
    case 'lines':
      return <label className="wk-field">{label}<textarea rows={3} value={lines(value)} disabled={readOnly} onChange={(e) => onSet(toLines(e.target.value))} /></label>;
    case 'field':
      return (
        <label className="wk-field">{label}
          <select value={typeof value === 'string' ? value : ''} disabled={readOnly} onChange={(e) => onSet(e.target.value)}>
            <option value="">—</option>
            {fieldKeys.filter((f) => f.group === undefined).map((f) => <option key={f.key} value={f.key}>{f.label} ({f.key})</option>)}
            {[...new Set(fieldKeys.flatMap((f) => (f.group === undefined ? [] : [f.group])))].map((group) => (
              <optgroup key={group} label={group}>
                {fieldKeys.filter((f) => f.group === group).map((f) => <option key={f.key} value={f.key}>{f.label} ({f.key})</option>)}
              </optgroup>
            ))}
            {typeof value === 'string' && value !== '' && !fieldKeys.some((f) => f.key === value) && <option value={value}>{value}</option>}
          </select>
        </label>
      );
    case 'kind':
      return <label className="wk-field">{label}<KindSelect lib={lib} material value={typeof value === 'string' ? value : ''} empty="—" onChange={(v) => onSet(v)} /></label>;
    case 'source':
      return (
        <label className="wk-field">{label}
          <select value={typeof value === 'string' ? value : ''} disabled={readOnly} onChange={(e) => onSet(e.target.value === '' ? undefined : e.target.value)}>
            <option value="">— zewsząd</option>
            <option value={lib.libraryId}>ta baza wiedzy</option>
            {lib.sourceList().map((s) => <option key={s.store.libraryId} value={s.store.libraryId}>{s.name}{s.kind === 'books' ? ' (biblioteka)' : ''}</option>)}
          </select>
        </label>
      );
    case 'kinds':
    case 'templates':
    case 'forms':
    case 'levels': {
      const options = field.type === 'kinds' ? lib.kinds.map((k) => ({ value: k.id, label: k.name }))
        : field.type === 'templates' ? lib.templates().map((t) => ({ value: t.id, label: t.name }))
        : field.type === 'forms' ? FORM_OPTIONS : LEVEL_OPTIONS;
      const chosen = new Set(Array.isArray(value) ? value.map(String) : []);
      return (
        <fieldset className="cg-row"><legend>{field.label}</legend>
          {options.map((o) => (
            <label key={o.value} className="pe-check">
              <input type="checkbox" checked={chosen.has(o.value)} disabled={readOnly} onChange={(e) => {
                const next = new Set(chosen);
                if (e.target.checked) next.add(o.value); else next.delete(o.value);
                onSet([...next]);
              }} />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
      );
    }
    case 'entity':
      /* 2026-10-23 — „@blocks" steht für die Rodzaje mit Feld blocks dieser Baza (Aussagen). */
      return <div className="wk-field">{label}<EntityPicker lib={lib} kinds={resolveKinds(field.kinds, lib.refKinds)} refs={field.kinds?.some((k) => BOOK_KINDS.has(k)) === true} value={typeof value === 'string' && value !== '' ? value : null} onPick={(id) => onSet(id ?? undefined)} /></div>;
    case 'collection':
      return (
        <label className="wk-field">{label}
          <select value={typeof value === 'string' ? value : ''} disabled={readOnly} onChange={(e) => onSet(e.target.value)}>
            <option value="">—</option>
            {lib.collections().map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      );
    case 'template':
      return (
        <label className="wk-field">{label}
          <select value={typeof value === 'string' ? value : ''} disabled={readOnly} onChange={(e) => onSet(e.target.value)}>
            <option value="">—</option>
            {lib.templates().map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      );
    case 'flow':
      return (
        <label className="wk-field">{label}
          <select value={typeof value === 'string' ? value : ''} disabled={readOnly} onChange={(e) => onSet(e.target.value)}>
            <option value="">—</option>
            {lib.docs('flow').map((e) => <option key={e.id} value={e.id}>{typeof e.data.name === 'string' ? e.data.name : 'Przebieg'}</option>)}
          </select>
        </label>
      );
    case 'rule':
      return <RuleInput value={value} readOnly={readOnly} onSet={onSet} label={field.label} />;
    case 'query':
      return <div className="wk-field">{label}<RuleEditor rule={readQuery(value) ?? { op: 'and', items: [] }} onChange={(r) => onSet(r)} /></div>;
    case 'condition':
      return <div className="wk-field">{label}<ConditionEditor value={readCondition(value)} onChange={(c) => onSet(c ?? undefined)} name={(id) => entityName(lib, id)} /></div>;
    case 'actions':
      return <div className="wk-field">{label}<ActionsEditor value={(Array.isArray(value) ? value : []).map(readAction).filter((a): a is Action => a !== null)} onChange={(a) => onSet(a)} /></div>;
    case 'options':
      return <OptionsInput value={value} readOnly={readOnly} onSet={onSet} />;
    case 'chapters':
      return (
        <label className="wk-field">{label}
          <textarea rows={4} value={(Array.isArray(value) ? value : []).map((c) => (typeof c === 'object' && c !== null ? String((c as { title?: unknown }).title ?? '') : String(c))).join('\n')} disabled={readOnly}
            onChange={(e) => onSet(toLines(e.target.value).map((title) => ({ title })))} />
        </label>
      );
    case 'media':
      return <MediaInput value={value} readOnly={readOnly} onSet={onSet} label={field.label} />;
  }
}

function RuleInput({ value, readOnly, onSet, label }: { value: unknown; readOnly: boolean; onSet: (v: unknown) => void; label: string }) {
  const rule: TextRule = readRule(value, TEXT_RULE);
  const set = (patch: Partial<TextRule>) => onSet({ ...rule, ...patch });
  return (
    <fieldset className="cg"><legend>{label}</legend>
      <label className="wk-field"><span>Porównanie</span>
        <select value={rule.algorithm} disabled={readOnly} onChange={(e) => set({ algorithm: e.target.value as TextRule['algorithm'] })}>
          <option value="anchors">dopasowanie (literówki)</option>
          <option value="bidirectional">z obu stron</option>
          <option value="prefix">od początku</option>
        </select>
      </label>
      <label className="wk-field"><span>Próg zaliczenia (0–1)</span><input type="number" min={0} max={1} step={0.05} value={rule.threshold} disabled={readOnly} onChange={(e) => set({ threshold: Number(e.target.value) })} /></label>
      <label className="pe-check"><input type="checkbox" checked={rule.similar} disabled={readOnly} onChange={(e) => set({ similar: e.target.checked })} /><span>podobne litery (ą/a, ł/l) liczą się w połowie</span></label>
      <label className="pe-check"><input type="checkbox" checked={rule.ignorePunctuation} disabled={readOnly} onChange={(e) => set({ ignorePunctuation: e.target.checked })} /><span>bez interpunkcji</span></label>
      <label className="pe-check"><input type="checkbox" checked={rule.caseSensitive} disabled={readOnly} onChange={(e) => set({ caseSensitive: e.target.checked })} /><span>wielkość liter ma znaczenie</span></label>
    </fieldset>
  );
}

function OptionsInput({ value, readOnly, onSet }: { value: unknown; readOnly: boolean; onSet: (v: unknown) => void }) {
  const list = (Array.isArray(value) ? value : []).map((o) => (typeof o === 'object' && o !== null ? o as Record<string, unknown> : { label: String(o) }));
  const set = (i: number, patch: Record<string, unknown>) => onSet(list.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  return (
    <fieldset className="cg"><legend>Możliwości (każda ma swoje wyjście)</legend>
      {list.map((o, i) => (
        <div key={i} className="cg-card">
          <div className="cg-row">
            <input value={typeof o.label === 'string' ? o.label : ''} placeholder={`możliwość ${i + 1}`} disabled={readOnly} onChange={(e) => set(i, { label: e.target.value })} />
            {!readOnly && <button type="button" className="wk-link-btn" onClick={() => onSet(list.filter((_, j) => j !== i))}>×</button>}
          </div>
          <span className="wk-hint">Tylko gdy:</span>
          <ConditionEditor value={readCondition(o.condition)} onChange={(c) => set(i, { condition: c ?? undefined })} />
          <span className="wk-hint">Po wyborze:</span>
          <ActionsEditor value={(Array.isArray(o.actions) ? o.actions : []).map(readAction).filter((a): a is Action => a !== null)} onChange={(a) => set(i, { actions: a })} />
        </div>
      ))}
      {!readOnly && <button type="button" className="wk-link-btn" onClick={() => onSet([...list, { label: '' }])}>+ możliwość</button>}
    </fieldset>
  );
}

function MediaInput({ value, readOnly, onSet, label }: { value: unknown; readOnly: boolean; onSet: (v: unknown) => void; label: string }) {
  const { lib, me } = useCtx();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const media = typeof value === 'object' && value !== null && typeof (value as MediaRef).file === 'string' ? value as MediaRef : null;
  return (
    <div className="wk-field">
      <span>{label}</span>
      {media !== null && <MediaView media={media} />}
      {!readOnly && me !== null && (
        <input type="file" disabled={busy} onChange={(e) => {
          const file = e.target.files?.[0];
          if (file === undefined) return;
          setBusy(true);
          setFailed(null);
          void (async () => {
            try {
              const newest = newestKey(await areaKeys(me.ring, lib.areaId, true));
              if (newest === null) throw new Error('Nie masz klucza tego obszaru.');
              onSet(await uploadFile(lib.libraryId, newest, file));
            } catch (err) {
              setFailed(err instanceof Error ? err.message : 'Nie udało się wgrać pliku.');
            } finally {
              setBusy(false);
            }
          })();
        }} />
      )}
      {media !== null && !readOnly && <button type="button" className="wk-link-btn" onClick={() => onSet(undefined)}>usuń plik</button>}
      {busy && <span className="wk-hint">Wgrywanie…</span>}
      {failed !== null && <span className="wk-error">{failed}</span>}
    </div>
  );
}
