/**
 * COGITA — EINEN FORMULARZ DODAWANIA BAUEN (COGITA.md §2.4), 2026-10-17.
 *
 * Links die Leinwand: welche Einträge aus einer Zeile werden und wie sie
 * aufeinander zeigen (Język → Słowo → Tłumaczenie) — dasselbe Modell wie
 * jeder Graph in Cogita (`graph.ts`), aber mit eigenen Knoten, weil ein
 * Knoten hier die Felder seines Rodzaj zeigt: was getippt, was oben gewählt,
 * was fest ist, und an jedem Verweisfeld einen Eingang. Rechts der gewählte
 * Knoten — dort geht alles auch ohne Ziehen, über Listen (Telefon, Tastatur).
 * Darunter die Tasten, das Einfügen und was das Formular tut, in Worten.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ReactFlow, {
  Background, Controls, Handle, Position,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';

import { newId } from '../core/ids';
import { viewPath } from '../routes';
import { askText, toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { MenuButton } from '../ui/Menu';
import {
  addFormDoc, COLUMN_SEPARATOR_LABEL, COLUMN_SEPARATORS, DEFAULT_KEYS, DEFAULT_PASTE, entryConfig,
  fieldsSet, formPalette, groupsOf, identityOf, isTypeable, KEY_ACTION_LABEL, KEY_ACTIONS, KEY_NAMES, nodeLabel,
  pickConfig, readAddForm, refFields, SOURCE_LABEL, typedFields, VALUE_SEPARATOR_LABEL, VALUE_SEPARATORS,
  type AddForm, type FieldSource, type SourceMode
} from './addForm';
import { COLUMN, defaultTyped, designOrder, duplicateEntry, formFromKind } from './addFormBuild';
import { describeForm, formProblems } from './addFormText';
import { ValueInput } from './AddFormRun';
import { connect, problemsOf as graphProblems, wouldCycle, type Graph, type GraphNode } from './graph';
import { FitWhenMeasured, Remeasure } from './GraphEditor';
import { FIELD_TYPE_LABEL, type FieldDef, type KindDef, type Lookup } from './schema';
import { creatorFor, EntityPicker, entityName, useBusy, useCtx } from './ui';

/* -- Die Liste und ein neues Formular ------------------------------------------------------------- */

/** „+ Formularz": leer, oder als Anfang aus einem Rodzaj (`formFromKind`). */
export function NewFormMenu({ onMade }: { onMade: (id: string) => void }) {
  const { lib } = useCtx();
  const make = async (kind: KindDef | null) => {
    try {
      const made = kind === null ? { name: 'Nowy formularz', graph: { nodes: [], edges: [] } } : formFromKind(kind, lib.look, () => newId().slice(-8));
      const saved = await lib.saveDoc('addform', addFormDoc({ id: '', name: made.name, graph: made.graph, keys: DEFAULT_KEYS, paste: DEFAULT_PASTE }));
      onMade(saved.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się utworzyć formularza.', { kind: 'error' });
    }
  };
  return (
    <MenuButton label="Nowy formularz dodawania" text="Formularz" icon="plus"
      items={[
        ...lib.kinds.map((k) => ({ label: `Z rodzaju: ${k.name}`, onSelect: () => void make(k) })),
        { label: 'Pusty', onSelect: () => void make(null) }
      ]} />
  );
}

export function AddFormEditor({ formId, onChoose, onBack, onRun }: {
  formId: string | null;
  onChoose: (id: string | null) => void;
  onBack: () => void;
  onRun: (id: string) => void;
}) {
  const { lib, writes } = useCtx();
  const forms = lib.docs('addform');
  const entry = formId === null ? undefined : forms.find((e) => e.id === formId);
  const from = entry === undefined || lib.isOwn(entry.id) ? undefined : lib.origin(entry.id);
  return (
    <div className="cg">
      <div className="cg-row-between">
        <div className="cg-row">
          <button type="button" className="wk-link-btn" onClick={onBack}>← Schemat</button>
          <select value={formId ?? ''} onChange={(e) => onChoose(e.target.value === '' ? null : e.target.value)} aria-label="Formularz dodawania">
            <option value="">— formularze dodawania ({forms.length}) —</option>
            {forms.map((e) => <option key={e.id} value={e.id}>{typeof e.data.name === 'string' ? e.data.name : 'Formularz'}{lib.isOwn(e.id) ? '' : ` · z: ${lib.origin(e.id)?.name ?? '?'}`}</option>)}
          </select>
        </div>
        {writes && <NewFormMenu onMade={(id) => onChoose(id)} />}
      </div>
      {entry === undefined ? (
        <p className="wk-empty">Formularz dodawania mówi, co powstaje z jednego wiersza — np. dwa słowa i tłumaczenie między nimi — i co wybierasz raz na początek (języki, temat). Zacznij od rodzaju, który chcesz dodawać.</p>
      ) : (
        <>
          {from !== undefined && <p className="wk-note">Z „{from.name}” — tu tylko do odczytu (wypełniać można). <a href={viewPath('learn', from.libraryId, 'schemat', 'formularz', entry.id)}>Zmień tam</a></p>}
          <FormDesigner key={entry.id} entryId={entry.id} version={entry.version} data={entry.data} writes={writes && from === undefined} onRun={() => onRun(entry.id)} onGone={() => onChoose(null)} />
        </>
      )}
    </div>
  );
}

/* -- Das Formular ------------------------------------------------------------------------------- */

const cleanConfig = (config: Readonly<Record<string, unknown>>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(config).filter(([, v]) => v !== undefined));

const withConfig = (graph: Graph, id: string, patch: Record<string, unknown>): Graph => ({
  nodes: graph.nodes.map((n) => (n.id === id ? { ...n, config: cleanConfig({ ...n.config, ...patch }) } : n)),
  edges: graph.edges
});

const without = (graph: Graph, id: string): Graph => ({
  nodes: graph.nodes.filter((n) => n.id !== id),
  edges: graph.edges.filter((e) => e.from !== id && e.to !== id)
});

/** Ein Eintrag je Zeile mit den Feldern, die man von seinem Rodzaj tippt. */
const entryNode = (kind: KindDef, x: number, y: number, label?: string): GraphNode => ({
  id: newId().slice(-8), type: 'entry', x, y,
  config: cleanConfig({ kind: kind.id, label, many: false, reuse: 'same', fields: Object.fromEntries(defaultTyped(kind).map((f) => [f.key, { from: 'type' }])) })
});

const pickNode = (x: number, y: number, label: string | undefined, kinds: readonly string[], many: boolean): GraphNode => ({
  id: newId().slice(-8), type: 'pick', x, y, config: cleanConfig({ label, kinds: [...kinds], many, optional: many, value: [] })
});

function FormDesigner({ entryId, version, data, writes, onRun, onGone }: {
  entryId: string;
  version: number;
  data: Readonly<Record<string, unknown>>;
  writes: boolean;
  onRun: () => void;
  onGone: () => void;
}) {
  const { lib } = useCtx();
  const [draft, setDraft] = useState<AddForm>(() => readAddForm(entryId, data));
  const [dirty, setDirty] = useState(false);
  /* Gleich etwas zu sehen: der erste Eintrag der Zeile ist gewählt, sein Modul offen. */
  const [chosen, setChosen] = useState<string | null>(() => {
    const first = readAddForm(entryId, data);
    return (designOrder(first).entries[0] ?? first.graph.nodes[0])?.id ?? null;
  });
  const [said, setSaid] = useState<string | null>(null);
  const { busy, failed, run } = useBusy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!dirty) setDraft(readAddForm(entryId, data)); }, [entryId, version, dirty]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const palette = useMemo(() => formPalette(lib.look), [lib, lib.revision]);

  const set = (patch: Partial<AddForm>) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); };
  const setGraph = (graph: Graph) => set({ graph });
  /* Eine Kante ziehen — oder sagen, warum nicht (falscher Rodzaj, ein Kreis). */
  const wire = (graph: Graph, from: string, to: string, field: string): Graph | null => {
    const done = connect(graph, palette, { id: newId().slice(-8), from, out: 'out', to, in: field });
    if ('error' in done) { setSaid(done.error); return null; }
    setSaid(null);
    return done.graph;
  };

  const save = () => run(async () => {
    await lib.saveDoc('addform', addFormDoc(draft), draft.id);
    setDirty(false);
    toast('Zapisano formularz.');
  });

  const problems = [...new Set([...formProblems(draft, lib.look), ...graphProblems(draft.graph, palette).map((p) => p.text)])];
  const node = draft.graph.nodes.find((n) => n.id === chosen);
  /* „Kolejny taki": die nächste Sprache — mit eigener Wahl der Sprache, denselben gemeinsamen Wahlen und dorthin verbunden, wohin der erste zeigt. */
  const duplicate = (id: string) => {
    const done = duplicateEntry(draft.graph, id, lib.look, () => newId().slice(-8));
    if (done === null) return;
    /* Steht eine Reihenfolge fest, kommt der neue gleich hinter den, den er abschreibt. */
    const order = draft.order === undefined ? undefined : draft.order.flatMap((x) => (x === id ? [x, done.id] : [x]));
    set({ graph: done.graph, ...(order === undefined ? {} : { order }) });
    setChosen(done.id);
  };
  const remove = (id: string) => {
    set({ graph: without(draft.graph, id), ...(draft.order === undefined ? {} : { order: draft.order.filter((x) => x !== id) }) });
    if (chosen === id) setChosen(null);
  };
  /*
    2026-10-17 — LINKS DIE LEINWAND, RECHTS DIE KNOTEN (auf Wunsch): je Knoten
    ein Modul, der gewählte offen — man sieht den Knoten und seine Einstellungen
    nebeneinander. Oben, was man tut (speichern, ausfüllen) und was man
    hinzufügt; unten die Reihenfolge der Zeile, die Tasten, das Einfügen.
  */
  return (
    <div className="cg">
      <div className="cg-af-top-row">
        <label className="wk-field"><span>Nazwa formularza</span><input value={draft.name} disabled={!writes} onChange={(e) => set({ name: e.target.value })} /></label>
        <div className="cg-row">
          {writes && <button type="button" className="wk-btn" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Zapisywanie…' : dirty ? 'Zapisz formularz' : 'Zapisano'}</button>}
          <button type="button" className={writes ? 'wk-btn wk-btn-quiet' : 'wk-btn'} disabled={dirty} title={dirty ? 'Najpierw zapisz zmiany' : undefined} onClick={onRun}>Wypełniaj →</button>
          {writes && (
            <MenuButton label={`Więcej: ${draft.name}`} items={[{
              label: 'Usuń formularz', danger: true,
              onSelect: () => void (async () => { if (await askText(`Usunąć formularz „${draft.name}"? Wpisy, które nim dodano, zostają.`)) void run(async () => { await lib.remove(draft.id); onGone(); }); })()
            }]} />
          )}
        </div>
      </div>
      {writes && <FormTools form={draft} chosen={node} onAdd={(n) => { setGraph({ nodes: [...draft.graph.nodes, n], edges: draft.graph.edges }); setChosen(n.id); }} onDuplicate={duplicate} />}
      {said !== null && <p className="wk-error">{said}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {problems.map((p, i) => <p key={i} className="wk-warn">{p}</p>)}
      <div className="cg-af-design">
        <FormCanvas form={draft} readOnly={!writes} chosen={chosen} onChoose={setChosen} onGraph={setGraph}
          onWire={(from, to, field) => { const g = wire(draft.graph, from, to, field); if (g !== null) setGraph(g); }} />
        <aside className="cg-af-side" aria-label="Węzły formularza">
          <FormModules form={draft} chosen={chosen} readOnly={!writes} onChoose={setChosen} onGraph={setGraph} wire={wire} onDuplicate={duplicate} onRemove={remove} />
        </aside>
      </div>

      <section className="cg-card">
        <h3>Kolejność pól w wierszu</h3>
        <RowOrder form={draft} readOnly={!writes} onOrder={(order) => set({ order })} />
        <h3>Klawisze przy wpisywaniu</h3>
        <div className="cg-row">
          {KEY_NAMES.map(([key, name]) => (
            <label key={key} className="wk-field"><span>{name}</span>
              <select value={draft.keys[key]} disabled={!writes} onChange={(e) => set({ keys: { ...draft.keys, [key]: e.target.value } })}>
                {KEY_ACTIONS.map((a) => <option key={a} value={a}>{KEY_ACTION_LABEL[a]}</option>)}
              </select>
            </label>
          ))}
        </div>
        <h3>Wklejanie listy</h3>
        <div className="cg-row">
          <label className="wk-field"><span>Kolumny oddziela</span>
            <select value={draft.paste.columns} disabled={!writes} onChange={(e) => set({ paste: { ...draft.paste, columns: e.target.value as AddForm['paste']['columns'] } })}>
              {COLUMN_SEPARATORS.map((s) => <option key={s} value={s}>{COLUMN_SEPARATOR_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="wk-field"><span>Kilka wartości w komórce oddziela</span>
            <select value={draft.paste.values} disabled={!writes} onChange={(e) => set({ paste: { ...draft.paste, values: e.target.value as AddForm['paste']['values'] } })}>
              {VALUE_SEPARATORS.map((s) => <option key={s} value={s}>{VALUE_SEPARATOR_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="pe-check"><input type="checkbox" checked={draft.paste.header} disabled={!writes} onChange={(e) => set({ paste: { ...draft.paste, header: e.target.checked } })} /><span>pierwsza linia to nagłówki</span></label>
        </div>
        <label className="wk-field"><span>Słowo dla wypełniających (nieobowiązkowo)</span>
          <textarea rows={2} value={draft.says ?? ''} disabled={!writes} onChange={(e) => set({ says: e.target.value.trim() === '' ? undefined : e.target.value })} />
        </label>
      </section>

      <section className="cg-card">
        <h3>Jak działa ten formularz</h3>
        <ul className="cg-af-desc">{describeForm(draft, lib.look).map((line, i) => <li key={i}>{line}</li>)}</ul>
      </section>
    </div>
  );
}

/** Die Reihenfolge der Zeile — was Enter nacheinander ansteuert und wie die Spalten einer eingefügten Liste stehen. */
function RowOrder({ form, readOnly, onOrder }: { form: AddForm; readOnly: boolean; onOrder: (order: string[]) => void }) {
  const { lib } = useCtx();
  const groups = groupsOf(form, lib.look);
  if (groups.length === 0) return <p className="cg-muted">Nic jeszcze nie jest wpisywane w wierszu.</p>;
  const move = (i: number, by: -1 | 1) => {
    const ids = groups.map((g) => g.node);
    [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
    onOrder(ids);
  };
  return (
    <ol className="cg-af-order">
      {groups.map((g, i) => (
        <li key={g.node}>
          <span><strong>{g.label}</strong> <span className="cg-muted">{g.fields.map((f) => f.label).join(', ')}{g.many ? ' · kilka' : ''}</span></span>
          {!readOnly && (
            <span className="cg-row">
              <button type="button" className="wk-link-btn" aria-label={`${g.label}: wcześniej`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="wk-link-btn" aria-label={`${g.label}: później`} disabled={i === groups.length - 1} onClick={() => move(i, 1)}>↓</button>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/* -- Die Leinwand -------------------------------------------------------------------------------- */

interface NodeRow {
  readonly key: string;
  readonly text: string;
  readonly tone: 'type' | 'ask' | 'fixed' | 'port' | 'value';
  readonly port?: boolean;
}

interface FormNodeData {
  readonly title: string;
  readonly sub: string;
  readonly rows: readonly NodeRow[];
  readonly pick: boolean;
}

function FormNodeView({ data, selected }: NodeProps<FormNodeData>) {
  return (
    <div className={`cg-node cg-af-node${data.pick ? ' is-pick' : ''}${selected ? ' is-on' : ''}`}>
      <div className="cg-node-head cg-af-head">
        <span>{data.title}</span>
        <Handle id="out" type="source" position={Position.Right} className="cg-handle" />
      </div>
      {data.sub !== '' && <div className="cg-node-sub">{data.sub}</div>}
      {data.rows.length > 0 && (
        <ul className="cg-af-rows">
          {data.rows.map((r) => (
            <li key={r.key} className={`is-${r.tone}`}>
              {r.port === true && <Handle id={r.key} type="target" position={Position.Left} className="cg-handle" />}
              {r.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const NODE_TYPES = { af: FormNodeView };

function FormCanvas({ form, readOnly, chosen, onChoose, onGraph, onWire }: {
  form: AddForm;
  readOnly: boolean;
  chosen: string | null;
  onChoose: (id: string | null) => void;
  onGraph: (graph: Graph) => void;
  onWire: (from: string, to: string, field: string) => void;
}) {
  const { lib } = useCtx();
  const [moving, setMoving] = useState<Readonly<Record<string, { x: number; y: number }>>>({});
  /* Die gemessene Grösse bleibt am Knoten: sonst vergisst React Flow sie bei jedem Zeichnen (jedem Buchstaben in einem Modul darunter) und blendet ihn kurz aus. */
  const [sizes, setSizes] = useState<Readonly<Record<string, { width: number; height: number }>>>({});
  const graph = form.graph;

  const nodes: Node<FormNodeData>[] = graph.nodes.map((n) => {
    const position = moving[n.id] ?? { x: n.x, y: n.y };
    if (n.type === 'pick') {
      const c = pickConfig(n.config);
      const kinds = c.kinds.map((k) => lib.kind(k)?.name ?? k).join(' / ') || 'dowolny rodzaj';
      return {
        id: n.id, type: 'af', position, selected: chosen === n.id, ...sizes[n.id],
        data: {
          title: `Na początek: ${nodeLabel(n, lib.look, graph)}`,
          sub: [kinds, c.many ? 'kilka' : '', c.optional ? 'można pominąć' : 'trzeba wybrać'].filter(Boolean).join(' · '),
          rows: c.value.length > 0 ? c.value.map((id) => ({ key: id, text: entityName(lib, id), tone: 'value' as const })) : [{ key: '_', text: 'wybierasz przy dodawaniu', tone: 'value' as const }],
          pick: true
        }
      };
    }
    const c = entryConfig(n.config);
    const kind = lib.kind(c.kind);
    const rows: NodeRow[] = [];
    let empty = 0;
    for (const f of kind?.fields ?? []) {
      const source = c.fields[f.key];
      if (f.type === 'ref') { rows.push({ key: f.key, text: `← ${f.label}${f.multi ? ' (kilka)' : ''}`, tone: 'port', port: true }); continue; }
      if (source === undefined || !isTypeable(f)) { empty += 1; continue; }
      rows.push(source.from === 'type' ? { key: f.key, text: `✎ ${f.label}`, tone: 'type' }
        : source.from === 'ask' ? { key: f.key, text: `▣ ${f.label} — na początek`, tone: 'ask' }
        : { key: f.key, text: `= ${f.label}: ${source.value ?? ''}`, tone: 'fixed' });
    }
    return {
      id: n.id, type: 'af', position, selected: chosen === n.id, ...sizes[n.id],
      data: {
        title: nodeLabel(n, lib.look, graph),
        sub: [kind?.name ?? 'wybierz rodzaj', c.many ? 'kilka w wierszu' : '', c.reuse === 'never' ? 'zawsze nowy' : '', empty > 0 ? `${empty} pól pustych` : ''].filter(Boolean).join(' · '),
        rows,
        pick: false
      }
    };
  });
  const edges: Edge[] = graph.edges.map((e) => ({ id: e.id, source: e.from, sourceHandle: e.out, target: e.to, targetHandle: e.in }));

  const nodeChanges = (changes: NodeChange[]) => {
    for (const ch of changes) {
      if (ch.type === 'position' && ch.position !== undefined) {
        const { id, position } = ch;
        setMoving((was) => ({ ...was, [id]: { x: Math.round(position.x), y: Math.round(position.y) } }));
      }
      if (ch.type === 'remove' && !readOnly) onGraph(without(graph, ch.id));
      if (ch.type === 'dimensions' && ch.dimensions !== undefined) {
        const { id, dimensions } = ch;
        setSizes((was) => (was[id]?.width === dimensions.width && was[id]?.height === dimensions.height ? was : { ...was, [id]: { width: dimensions.width, height: dimensions.height } }));
      }
    }
    /* Wählen: ein neuer Knoten gewinnt, gleich in welcher Reihenfolge das Abwählen des alten kommt. */
    const selecting = changes.filter((ch) => ch.type === 'select');
    if (selecting.length > 0) {
      const on = selecting.find((ch) => ch.type === 'select' && ch.selected);
      onChoose(on !== undefined ? on.id : selecting.some((ch) => ch.id === chosen) ? null : chosen);
    }
  };
  const edgeChanges = (changes: EdgeChange[]) => {
    const gone = new Set(changes.filter((c) => c.type === 'remove').map((c) => c.id));
    if (gone.size > 0 && !readOnly) onGraph({ nodes: graph.nodes, edges: graph.edges.filter((e) => !gone.has(e.id)) });
  };
  const dropped = (id: string) => {
    const spot = moving[id];
    if (spot === undefined) return;
    onGraph({ nodes: graph.nodes.map((n) => (n.id === id ? { ...n, x: spot.x, y: spot.y } : n)), edges: graph.edges });
    setMoving(({ [id]: _gone, ...rest }) => { void _gone; return rest; });
  };

  return (
    <div className="cg-graph-canvas cg-af-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={nodeChanges}
        onEdgesChange={edgeChanges}
        onConnect={(c: Connection) => { if (!readOnly && c.source !== null && c.target !== null && c.targetHandle !== null) onWire(c.source, c.target, c.targetHandle); }}
        onNodeDragStop={(_, n) => dropped(n.id)}
        onPaneClick={() => onChoose(null)}
        deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
        nodesConnectable={!readOnly}
        nodesDraggable={!readOnly}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        /* Ein Formular ist breit (Wahlen, Zeilen, Verbindendes): auf dem Telefon passt es erst kleiner ganz hinein. */
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
        <Remeasure />
        <FitWhenMeasured />
      </ReactFlow>
    </div>
  );
}

/* -- Die Werkzeuge über der Leinwand ------------------------------------------------------------------ */

/** Ein Eintrag, den man tippt (ein Wort) — nur von ihm gibt es „noch einen", und nur er nimmt mehrere in einer Zeile. */
const typedIn = (node: GraphNode, look: Pick<Lookup, 'kind'>): boolean => {
  if (node.type !== 'entry') return false;
  const c = entryConfig(node.config);
  return typedFields(look.kind(c.kind), c).length > 0;
};

function FormTools({ form, chosen, onAdd, onDuplicate }: { form: AddForm; chosen: GraphNode | undefined; onAdd: (node: GraphNode) => void; onDuplicate: (id: string) => void }) {
  const { lib } = useCtx();
  const typedHere = (n: GraphNode) => typedIn(n, lib.look);
  const low = (x: number) => Math.max(0, ...form.graph.nodes.filter((n) => Math.abs(n.x - x) < 150).map((n) => n.y + 160));
  /* Ein neuer Eintrag kommt in die Spalte der getippten (dort, wo die Wörter stehen) — sonst in die Mitte. */
  const typedXs = form.graph.nodes.filter(typedHere).map((n) => n.x);
  const column = typedXs.length > 0 ? Math.min(...typedXs) : COLUMN;
  return (
    <div className="cg-af-tools">
      <button type="button" className="wk-btn wk-btn-quiet" onClick={() => onAdd(pickNode(0, low(0), undefined, [], false))}><Icon name="plus" />Na początek</button>
      <MenuButton label="Dodaj wpis, który powstaje z każdego wiersza" text="W każdym wierszu" icon="plus"
        items={lib.kinds.map((k) => ({ label: k.name, onSelect: () => onAdd(entryNode(k, column, low(column))) }))} />
      {chosen !== undefined && typedHere(chosen) && (
        <button type="button" className="wk-btn wk-btn-quiet" onClick={() => onDuplicate(chosen.id)}><Icon name="copy" />Kolejny taki jak „{nodeLabel(chosen, lib.look, form.graph)}”</button>
      )}
      <span className="cg-muted">Połącz kropkę wpisu (z prawej) z kropką pola (z lewej) — albo wybierz „skąd” przy polu w ustawieniach węzła.</span>
    </div>
  );
}

/* -- Unter der Leinwand: ein Modul je Knoten ------------------------------------------------------------- */

function FormModules({ form, chosen, readOnly, onChoose, onGraph, wire, onDuplicate, onRemove }: {
  form: AddForm;
  chosen: string | null;
  readOnly: boolean;
  onChoose: (id: string) => void;
  onGraph: (graph: Graph) => void;
  wire: (graph: Graph, from: string, to: string, field: string) => Graph | null;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { lib } = useCtx();
  const typedHere = (n: GraphNode) => typedIn(n, lib.look);
  const { picks, entries } = designOrder(form);
  /* Wer auf der Leinwand einen Knoten wählt, sieht sein Modul — ohne dass die Seite springt, wenn es schon zu sehen ist; beim Öffnen springt sie nie. */
  const shownFor = useRef(chosen);
  useEffect(() => {
    if (chosen === null || chosen === shownFor.current) return;
    shownFor.current = chosen;
    document.querySelector(`[data-af-node="${chosen}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [chosen]);
  return (
    <div className="cg">
      {entries.length > 0 && (
        <section className="cg" aria-label="W każdym wierszu">
          <h3>W każdym wierszu</h3>
          <div className="cg-af-modules">
            {entries.map((n) => (
              <ModuleCard key={n.id} form={form} node={n} on={chosen === n.id} readOnly={readOnly} onChoose={onChoose} onRemove={onRemove} onDuplicate={typedHere(n) ? () => onDuplicate(n.id) : undefined}>
                <EntryPanel form={form} node={n} readOnly={readOnly} onGraph={onGraph} wire={wire} onChoose={onChoose} />
              </ModuleCard>
            ))}
          </div>
        </section>
      )}
      {picks.length > 0 && (
        <section className="cg" aria-label="Na początek">
          <h3>Na początek</h3>
          <div className="cg-af-modules">
            {picks.map((n) => (
              <ModuleCard key={n.id} form={form} node={n} on={chosen === n.id} readOnly={readOnly} onChoose={onChoose} onRemove={onRemove}>
                <PickPanel form={form} node={n} readOnly={readOnly} onConfig={(patch) => onGraph(withConfig(form.graph, n.id, patch))} />
              </ModuleCard>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ModuleCard({ form, node, on, readOnly, onChoose, onRemove, onDuplicate, children }: {
  form: AddForm;
  node: GraphNode;
  on: boolean;
  readOnly: boolean;
  onChoose: (id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate?: () => void;
  children: ReactNode;
}) {
  const { lib } = useCtx();
  const sub = node.type === 'pick' ? 'wybór na początek' : lib.kind(entryConfig(node.config).kind)?.name ?? 'wybierz rodzaj';
  return (
    <section className={`cg-card cg-af-module${on ? ' is-on' : ''}${node.type === 'pick' ? ' is-pick' : ''}`} data-af-node={node.id} onFocusCapture={() => { if (!on) onChoose(node.id); }}>
      <div className="cg-row-between">
        <button type="button" className="cg-af-module-title" aria-expanded={on} onClick={() => onChoose(node.id)}>
          <Icon name={on ? 'chevron' : 'next'} />
          <strong>{nodeLabel(node, lib.look, form.graph)}</strong>
          <span className="cg-muted">{sub}</span>
        </button>
        {!readOnly && (
          <span className="cg-row">
            {onDuplicate !== undefined && <button type="button" className="wk-link-btn" onClick={onDuplicate}>+ kolejny taki</button>}
            <button type="button" className="wk-link-btn" onClick={() => onRemove(node.id)}>usuń</button>
          </span>
        )}
      </div>
      {on && children}
    </section>
  );
}

/* -- Ein Eintrag je Zeile ------------------------------------------------------------------------- */

function EntryPanel({ form, node, readOnly, onGraph, wire, onChoose }: {
  form: AddForm;
  node: GraphNode;
  readOnly: boolean;
  onGraph: (graph: Graph) => void;
  wire: (graph: Graph, from: string, to: string, field: string) => Graph | null;
  onChoose: (id: string) => void;
}) {
  const { lib } = useCtx();
  const c = entryConfig(node.config);
  const kind = lib.kind(c.kind);
  const graph = form.graph;
  const setConfig = (patch: Record<string, unknown>) => onGraph(withConfig(graph, node.id, patch));
  const setSource = (key: string, source: FieldSource | undefined) => {
    const fields: Record<string, FieldSource> = { ...c.fields };
    if (source === undefined) delete fields[key]; else fields[key] = source;
    setConfig({ fields });
  };
  const changeKind = (id: string) => {
    const next = lib.kind(id);
    if (next === undefined) return;
    /* Ein anderer Rodzaj hat andere Felder: was hierher führte, passt nicht mehr. */
    const kept = { nodes: graph.nodes, edges: graph.edges.filter((e) => e.to !== node.id) };
    onGraph(withConfig(kept, node.id, { kind: id, fields: Object.fromEntries(defaultTyped(next).map((f) => [f.key, { from: 'type' }])), identity: undefined }));
  };

  const set = kind === undefined ? [] : fieldsSet(form, node, kind);
  const identity = kind === undefined ? [] : identityOf(form, node, kind);

  return (
    <div className="wk-form cg cg-af-panel">
      <label className="wk-field"><span>Rodzaj</span>
        <select value={c.kind} disabled={readOnly} onChange={(e) => changeKind(e.target.value)}>
          {kind === undefined && <option value={c.kind}>— wybierz —</option>}
          {lib.kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
      </label>
      <label className="wk-field"><span>Nazwa w formularzu</span>
        <input value={c.label ?? ''} disabled={readOnly} placeholder={kind?.name ?? ''} onChange={(e) => setConfig({ label: e.target.value.trim() === '' ? undefined : e.target.value })} />
      </label>
      {typedFields(kind, c).length > 0 && <label className="pe-check"><input type="checkbox" checked={c.many} disabled={readOnly} onChange={(e) => setConfig({ many: e.target.checked })} /><span>Kilka w jednym wierszu (np. dwa słowa o tym samym znaczeniu)</span></label>}

      {kind !== undefined && (
        <fieldset className="cg-af-fields"><legend>Pola</legend>
          {kind.fields.map((f) => (f.type === 'ref'
            ? <RefSource key={f.key} form={form} node={node} field={f} readOnly={readOnly} onGraph={onGraph} wire={wire} onChoose={onChoose} />
            : <FieldSourceRow key={f.key} field={f} source={c.fields[f.key]} readOnly={readOnly} onChange={(s) => setSource(f.key, s)} />))}
        </fieldset>
      )}

      <label className="wk-field"><span>Gdy taki wpis już jest</span>
        <select value={c.reuse} disabled={readOnly} onChange={(e) => setConfig({ reuse: e.target.value })}>
          <option value="same">użyj go (i dopisz, czego mu brakuje)</option>
          <option value="never">dodaj nowy mimo to</option>
        </select>
      </label>
      {c.reuse === 'same' && set.length > 0 && (
        <details>
          <summary>Rozpoznawany po: {identity.map((f) => f.label).join(', ') || '—'}</summary>
          <div className="cg">
            {set.map((f) => (
              <label key={f.key} className="pe-check">
                <input type="checkbox" checked={identity.some((x) => x.key === f.key)} disabled={readOnly} onChange={(e) => {
                  const now = identity.map((x) => x.key);
                  setConfig({ identity: e.target.checked ? [...now, f.key] : now.filter((k) => k !== f.key) });
                }} />
                <span>{f.label}</span>
              </label>
            ))}
            {c.identity !== undefined && !readOnly && <button type="button" className="wk-link-btn" onClick={() => setConfig({ identity: undefined })}>jak domyślnie</button>}
          </div>
        </details>
      )}
    </div>
  );
}

function FieldSourceRow({ field, source, readOnly, onChange }: { field: FieldDef; source: FieldSource | undefined; readOnly: boolean; onChange: (s: FieldSource | undefined) => void }) {
  const typeable = isTypeable(field);
  return (
    <div className="cg-af-field">
      <span className="cg-af-field-name">{field.label} <span className="cg-muted">{FIELD_TYPE_LABEL[field.type]}{field.multi ? ', kilka' : ''}</span></span>
      <select value={typeable ? source?.from ?? '' : ''} disabled={readOnly || !typeable} aria-label={`${field.label}: skąd wartość`}
        onChange={(e) => onChange(e.target.value === '' ? undefined : { from: e.target.value as SourceMode, ...(source?.value === undefined ? {} : { value: source.value }) })}>
        <option value="">{typeable ? '— puste —' : '— nie z formularza —'}</option>
        {typeable && (Object.keys(SOURCE_LABEL) as SourceMode[]).map((m) => <option key={m} value={m}>{SOURCE_LABEL[m]}</option>)}
      </select>
      {(source?.from === 'ask' || source?.from === 'fixed') && (
        <ValueInput field={field} value={source.value ?? ''} disabled={readOnly} placeholder={source.from === 'ask' ? 'domyślnie (nieobowiązkowo)' : 'wartość'}
          label={`${field.label}: ${source.from === 'ask' ? 'domyślnie' : 'wartość'}`}
          onChange={(v) => onChange({ from: source.from, ...(v === '' ? {} : { value: v }) })} />
      )}
    </div>
  );
}

/** Woher ein Verweisfeld seinen Eintrag bekommt: eine Wahl oben, ein Eintrag derselben Zeile — oder ein neuer davon. */
function RefSource({ form, node, field, readOnly, onGraph, wire, onChoose }: {
  form: AddForm;
  node: GraphNode;
  field: FieldDef;
  readOnly: boolean;
  onGraph: (graph: Graph) => void;
  wire: (graph: Graph, from: string, to: string, field: string) => Graph | null;
  onChoose: (id: string) => void;
}) {
  const { lib } = useCtx();
  const graph = form.graph;
  const to = field.to ?? [];
  const fits = (kinds: readonly string[]) => to.length === 0 || kinds.length === 0 || kinds.some((k) => to.includes(k));
  const incoming = graph.edges.filter((e) => e.to === node.id && e.in === field.key);
  const picks = graph.nodes.filter((n) => n.type === 'pick' && fits(pickConfig(n.config).kinds) && !incoming.some((e) => e.from === n.id));
  const rows = graph.nodes.filter((n) => n.type === 'entry' && n.id !== node.id && fits([entryConfig(n.config).kind]) && !incoming.some((e) => e.from === n.id) && !wouldCycle(graph, n.id, node.id));
  const targets = (to.length === 0 ? lib.kinds : to.map((k) => lib.kinds.find((x) => x.id === k)).filter((k): k is KindDef => k !== undefined));
  const slot = refFields(lib.kind(entryConfig(node.config).kind)).findIndex((f) => f.key === field.key);

  const choose = (value: string) => {
    if (value === '') return;
    let next: Graph = graph;
    let from = value.slice(value.indexOf(':') + 1);
    if (value === 'new-pick') {
      const made = pickNode(Math.max(0, node.x - 320), Math.max(0, node.y + slot * 110 - 40), field.label, to, field.multi);
      next = { nodes: [...graph.nodes, made], edges: graph.edges };
      from = made.id;
    } else if (value.startsWith('new-entry:')) {
      const kind = lib.kind(from);
      if (kind === undefined) return;
      const made = entryNode(kind, Math.max(0, node.x - 320), Math.max(0, node.y + slot * 180 - 60), field.label);
      next = { nodes: [...graph.nodes, made], edges: graph.edges };
      from = made.id;
    }
    const wired = wire(next, from, node.id, field.key);
    if (wired !== null) onGraph(wired);
  };

  return (
    <div className="cg-af-field">
      <span className="cg-af-field-name">{field.label} <span className="cg-muted">odwołanie{field.multi ? ', kilka' : ''}{to.length > 0 ? ` do: ${to.map((k) => lib.kind(k)?.name ?? k).join(', ')}` : ''}</span></span>
      {incoming.map((e) => {
        const from = graph.nodes.find((n) => n.id === e.from);
        return (
          <span key={e.id} className="cg-row">
            <button type="button" className="cg-ref" onClick={() => from !== undefined && onChoose(from.id)}>← {from === undefined ? '?' : nodeLabel(from, lib.look, graph)}</button>
            {!readOnly && <button type="button" className="wk-link-btn" aria-label="Odłącz" onClick={() => onGraph({ nodes: graph.nodes, edges: graph.edges.filter((x) => x.id !== e.id) })}>×</button>}
          </span>
        );
      })}
      {!readOnly && (field.multi || incoming.length === 0) && (
        <select value="" aria-label={`${field.label}: skąd`} onChange={(e) => choose(e.target.value)}>
          <option value="">{incoming.length === 0 ? '— puste — (skąd?)' : '+ jeszcze skąd…'}</option>
          <optgroup label="Na początek">
            {picks.map((n) => <option key={n.id} value={`node:${n.id}`}>{nodeLabel(n, lib.look, graph)}</option>)}
            <option value="new-pick">nowy wybór na początek</option>
          </optgroup>
          <optgroup label="Z tego samego wiersza">
            {rows.map((n) => <option key={n.id} value={`node:${n.id}`}>{nodeLabel(n, lib.look, graph)}</option>)}
            {targets.map((k) => <option key={k.id} value={`new-entry:${k.id}`}>nowy wpis: {k.name}</option>)}
          </optgroup>
        </select>
      )}
    </div>
  );
}

/* -- Eine Wahl oben ------------------------------------------------------------------------------- */

function PickPanel({ form, node, readOnly, onConfig }: {
  form: AddForm;
  node: GraphNode;
  readOnly: boolean;
  onConfig: (patch: Record<string, unknown>) => void;
}) {
  const { lib } = useCtx();
  const c = pickConfig(node.config);
  return (
    <div className="wk-form cg cg-af-panel">
      <label className="wk-field"><span>Nazwa</span>
        <input value={c.label ?? ''} disabled={readOnly} placeholder={nodeLabel(node, lib.look, form.graph)} onChange={(e) => onConfig({ label: e.target.value.trim() === '' ? undefined : e.target.value })} />
      </label>
      <div className="wk-field">
        <span>Jakie wpisy można wybrać</span>
        <span className="cg-row">
          {c.kinds.length === 0 && <span className="cg-muted">dowolne</span>}
          {c.kinds.map((k) => (
            <span key={k} className="cg-tag">{lib.kind(k)?.name ?? k}{!readOnly && <button type="button" className="wk-link-btn" aria-label={`Usuń: ${lib.kind(k)?.name ?? k}`} onClick={() => onConfig({ kinds: c.kinds.filter((x) => x !== k) })}>×</button>}</span>
          ))}
          {!readOnly && (
            <select value="" aria-label="Dodaj rodzaj do wyboru" onChange={(e) => { if (e.target.value !== '') onConfig({ kinds: [...c.kinds, e.target.value] }); }}>
              <option value="">+ rodzaj</option>
              {lib.refKinds.filter((k) => !c.kinds.includes(k.id)).map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          )}
        </span>
      </div>
      <label className="pe-check"><input type="checkbox" checked={c.many} disabled={readOnly} onChange={(e) => onConfig({ many: e.target.checked })} /><span>Kilka wpisów (np. kilka tematów)</span></label>
      <label className="pe-check"><input type="checkbox" checked={c.optional} disabled={readOnly} onChange={(e) => onConfig({ optional: e.target.checked })} /><span>Można zostawić puste</span></label>
      <div className="wk-field">
        <span>Wybrane od razu</span>
        {c.value.map((id) => (
          <span key={id} className="cg-row">
            <span>{entityName(lib, id)}</span>
            {!readOnly && <button type="button" className="wk-link-btn" aria-label="Usuń" onClick={() => onConfig({ value: c.value.filter((x) => x !== id) })}>×</button>}
          </span>
        ))}
        {!readOnly && (c.many || c.value.length === 0) && (
          <EntityPicker lib={lib} kinds={c.kinds.length > 0 ? c.kinds : undefined} refs {...creatorFor(lib, c.kinds, !readOnly)} value={null} placeholder="szukaj…" onPick={(id) => id !== null && onConfig({ value: [...c.value.filter((x) => x !== id), id] })} />
        )}
      </div>
    </div>
  );
}
