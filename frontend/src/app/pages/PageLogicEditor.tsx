/**
 * DIE KARTE EINER SEITE — im Editor (0048).
 *
 * <b>Die Bausteine der Seite stehen von selbst darauf</b>, rechts, jeder mit
 * seinem Eingang „pokaż, gdy". Wer einen Baustein auf die Seite legt, hat
 * seinen Knoten; wer ihn wegnimmt, verliert ihn samt Kanten.
 *
 * <b>Links, was über den Menschen bekannt ist</b> — aus der Palette gezogen
 * und eingestellt (welches Formular, welche Frage, welcher Znacznik). In der
 * Mitte I, LUB, NIE. <b>Die Schritte</b> legt man ebenfalls an: jeder Knoten
 * „Krok" ist eine Zeile im Baustein „Kroki osoby", in der Reihenfolge, in der
 * sie von oben nach unten auf der Karte stehen.
 *
 * <b>Die Vorschau rechnet mit</b>: unten schaltet man an, was für einen
 * gedachten Menschen gilt, und sieht, was von der Seite übrig bleibt und wie
 * seine Liste aussieht.
 */

import { useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background, Controls, Handle, Position,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';

import { loadPublicKey, myEpochKeys } from '../areas/area';
import { fromBase64Url } from '../core/crypto';
import type { OpenField } from '../forms/form';
import { questionsOf } from '../forms/FormPick';
import { newId } from '../core/ids';
import { loadModules, type ModuleRow } from '../modules/module';
import { savePageLogic, type DraftPart } from './page';
import {
  ANSWER_OP_LABEL, answerHash, EMPTY_LOGIC, evaluatePage, GATE_KINDS, INPUT_KINDS, PAGE_NODE_LABEL, PORT_LABEL,
  pagePortsOf, readLogic, roleOfKind, wouldLoop,
  type AnswerOp, type PageEdge, type PageLogic, type PageNode, type PageNodeKind, type PagePort, type Role
} from './pageLogic';
import { partLabel } from './parts/registry';
import { keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { loadSteps, openSteps, type StepKind } from '../steps/steps';
import { Loading } from '../ui/Loading';
import { t, useT, type T } from '../core/i18n';

/* -- Was der Editor über Formulare weiss ----------------------------------------------- */

/** 0098 — `kind`: ein Znacznik, oder eine Aufgabe (zählt, sobald sie erfüllt ist). */
interface Mark { readonly stepId: string; readonly label: string; readonly doneBy: 'office' | 'person'; readonly kind: StepKind }

/** Die Znaczniki eines Formulars, lesbar — mit dem offenen Schlüssel, sonst dem eigenen. */
async function marksOf(formId: string, who: Who): Promise<readonly Mark[]> {
  const { steps } = await loadSteps(formId);
  const keys = new Map<string, Map<number, Uint8Array>>();

  for (const areaId of new Set(steps.map((s) => s.areaId))) {
    const held = new Map<number, Uint8Array>();
    try {
      const open = await loadPublicKey(areaId);
      held.set(open.epoch, fromBase64Url(open.key));
    } catch { /* nicht offen */ }
    try {
      const { ring } = await keysFor(who);
      if (ring !== null) for (const [epoch, key] of await myEpochKeys(ring, areaId)) held.set(epoch, key);
    } catch { /* keine Zuteilung */ }
    keys.set(areaId, held);
  }

  return (await openSteps(steps, (areaId, epoch) => keys.get(areaId)?.get(epoch)))
    .map((s) => ({ stepId: s.stepId, label: s.label ?? t('pages.logicEd.sealedMark'), doneBy: s.doneBy, kind: s.kind ?? 'mark' }));
}

/* -- Ein Knoten ------------------------------------------------------------------------- */

/** Was ein Znacznik verlangt, in Worten. */
const markWord = (m: Mark, t: T): string => t(m.kind === 'task' ? 'pages.logicEd.mark.task' : m.kind === 'booking' ? 'pages.logicEd.mark.booking' : m.kind === 'chat' ? 'pages.logicEd.mark.chat'
  : m.kind === 'learn' ? 'pages.logicEd.mark.learn' : m.doneBy === 'person' ? 'pages.logicEd.mark.person' : 'pages.logicEd.mark.office');

interface NodeData {
  readonly node: PageNode;
  readonly summary: string;
  readonly preview: boolean | undefined;
}

function PageNodeView({ data, selected }: NodeProps<NodeData>) {
  const t = useT();
  const { node, summary, preview } = data;
  const role = roleOfKind(node.kind);
  const ports = pagePortsOf(node.kind);
  const wordy = role === 'output';

  return (
    <div className={`wk-lnode wk-lnode-${role}${node.kind === 'step' ? ' wk-lnode-step' : ''}${selected ? ' wk-lnode-on' : ''}`}>
      {!wordy && ports.map((p, i) => (
        <Handle
          key={p.port} id={p.port} type="target" position={Position.Left} className="wk-lhandle"
          style={{ top: `${((i + 1) / (ports.length + 1)) * 100}%` }}
        />
      ))}

      <span className="wk-lnode-kind">{PAGE_NODE_LABEL[node.kind]}</span>
      {summary !== '' && <span className="wk-lnode-sum">{summary}</span>}

      {/* Die Eingänge eines Bausteins und eines Schritts tragen ihr Wort — „pokaż, gdy". */}
      {wordy && ports.map((p) => (
        <span className="wk-pport" key={p.port}>
          <Handle id={p.port} type="target" position={Position.Left} className="wk-lhandle" title={PORT_LABEL[p.port]} />
          {PORT_LABEL[p.port]}
        </span>
      ))}

      {preview !== undefined && (
        <span className={`wk-lnode-val${preview ? ' is-yes' : ''}`}>
          {t(node.kind === 'part' ? (preview ? 'pages.logicEd.visible' : 'pages.logicEd.hidden')
            : node.kind === 'step' ? (preview ? 'pages.steps.done' : 'pages.steps.todo')
            : preview ? 'pages.logicEd.yes' : 'pages.logicEd.no')}
        </span>
      )}

      {role !== 'output' && <Handle id="out" type="source" position={Position.Right} className="wk-lhandle" />}
    </div>
  );
}

const NODE_TYPES = { page: PageNodeView };

const COLUMN: Record<Role, number> = { input: 40, gate: 360, output: 680 };

/* -- Der Editor ---------------------------------------------------------------------------- */

const partNodeId = (partId: string) => `p:${partId}`;

/** Die Karte, wie sie zu DIESEN Bausteinen passt: jeder hat seinen Knoten, keiner einen fremden. */
function withParts(logic: PageLogic, parts: readonly DraftPart[]): PageLogic {
  const ids = new Set(parts.map((p) => p.id));
  const kept = logic.nodes.filter((n) => n.kind !== 'part' || (n.partId !== undefined && ids.has(n.partId)));
  const have = new Set(kept.filter((n) => n.kind === 'part').map((n) => n.partId));

  const outputs = kept.filter((n) => roleOfKind(n.kind) === 'output').length;
  const added: PageNode[] = parts.filter((p) => !have.has(p.id)).map((p, i) => ({
    id: partNodeId(p.id), kind: 'part', partId: p.id, x: COLUMN.output, y: 40 + (outputs + i) * 110
  }));

  const nodes = [...kept, ...added];
  const alive = new Set(nodes.map((n) => n.id));
  return { version: 1, nodes, edges: logic.edges.filter((e) => alive.has(e.from) && alive.has(e.to)) };
}

/** Neu anfangen, wenn sich die gespeicherte Karte oder die Bausteine der Seite ändern. */
export const logicKey = (logic: string | null, parts: readonly DraftPart[]): string =>
  `${parts.map((p) => p.id).join(',')}|${logic ?? ''}`;

export function PageLogicEditor({ path, parts, logic: saved, who, onSaved }: {
  path: string;
  parts: readonly DraftPart[];
  logic: string | null;
  who: Who;
  onSaved: (logic: string | null) => void;
}) {
  const t = useT();
  const start = useMemo(() => withParts(readLogic(saved) ?? EMPTY_LOGIC, parts), [saved, parts]);
  const startText = JSON.stringify(start);

  const [nodes, setNodes] = useState<readonly PageNode[]>(start.nodes);
  const [edges, setEdges] = useState<readonly PageEdge[]>(start.edges);
  const [selected, setSelected] = useState<string | null>(null);
  const [sample, setSample] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* Neue Bausteine oder eine andere gespeicherte Karte: der Aufrufer schlüsselt nach beidem (`logicKey`). */
  const dirty = JSON.stringify({ version: 1, nodes, edges }) !== startText;

  /* -- Was die Knoten nennen: Formulare, Fragen, Znaczniki ------------------------- */

  const [forms, setForms] = useState<readonly ModuleRow[]>([]);
  const [questions, setQuestions] = useState<ReadonlyMap<string, readonly OpenField[]>>(new Map());
  const [marks, setMarks] = useState<ReadonlyMap<string, readonly Mark[]>>(new Map());

  useEffect(() => {
    let alive = true;
    void loadModules().then(({ modules }) => { if (alive) setForms(modules.filter((m) => m.kind === 'form')); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const wanted = [...new Set(nodes.flatMap((n) => (n.formId === undefined ? [] : [`${n.kind === 'mark' ? 'm' : 'q'}:${n.formId}`])))].sort().join(',');

  useEffect(() => {
    let alive = true;

    void (async () => {
      for (const one of wanted === '' ? [] : wanted.split(',')) {
        const [what, formId] = one.split(':');
        try {
          if (what === 'q') {
            const found = await questionsOf(formId);
            if (alive) setQuestions((was) => new Map(was).set(formId, found));
          } else {
            const found = await marksOf(formId, who);
            if (alive) setMarks((was) => new Map(was).set(formId, found));
          }
        } catch {
          // Nicht lesbar — der Knoten sagt es.
        }
      }
    })();

    return () => { alive = false; };
  }, [wanted, who]);

  const formName = (id?: string) => (id === undefined ? t('pages.logicEd.chooseForm') : forms.find((f) => f.moduleId === id)?.name ?? t('pages.logicEd.form'));
  const partName = (partId?: string) => {
    const part = parts.find((p) => p.id === partId);
    if (part === undefined) return t('pages.logicEd.removedPart');
    const own = part.config.title?.trim() || (part.moduleId === null ? '' : forms.find((f) => f.moduleId === part.moduleId)?.name ?? '');
    return own === '' ? partLabel(part.kind) : `${partLabel(part.kind)}: ${own}`;
  };

  const summary = (n: PageNode): string => {
    switch (n.kind) {
      case 'part': return partName(n.partId) + ((n.message ?? '').trim() === '' ? '' : t('${K}withMessage'));
      case 'step': return `${(n.label ?? '').trim() || t('${K}unnamed')}${n.dueAt ? t('${K}dueTag', { date: n.dueAt }) : ''}`;
      case 'registered':
      case 'confirmed': return formName(n.formId);
      case 'answer': {
        const q = questions.get(n.formId ?? '')?.find((f) => f.fieldId === n.fieldId);
        return `${q?.label ?? (n.fieldId === undefined ? t('${K}chooseQuestion') : t('${K}question'))} · ${ANSWER_OP_LABEL[n.op ?? 'filled']}${n.op === 'eq' || n.op === 'ne' ? (n.valueHash ? ' ●●●' : t('${K}noValue')) : ''}`;
      }
      case 'mark': {
        const m = marks.get(n.formId ?? '')?.find((one) => one.stepId === n.stepId);
        return m === undefined ? (n.stepId === undefined ? t('${K}chooseMark') : t('${K}markWord')) : `${m.label} · ${markWord(m, t)}`;
      }
      case 'date': return n.date ? t(n.when === 'before' ? '${K}before' : '${K}from', { date: n.date }) : t('${K}chooseDate');
      default: return '';
    }
  };

  /* -- Die Vorschau: dieselbe Auswertung wie auf der Seite ------------------------------ */

  const outcome = useMemo(
    () => evaluatePage({ version: 1, nodes, edges }, (n) => sample[n.id] === true), [nodes, edges, sample]);

  const rfNodes: Node<NodeData>[] = nodes.map((n) => ({
    id: n.id,
    type: 'page',
    position: { x: n.x, y: n.y },
    selected: n.id === selected,
    deletable: n.kind !== 'part',
    data: {
      node: n,
      summary: summary(n),
      preview: n.kind === 'part' ? !outcome.hidden.has(n.partId ?? '')
        : n.kind === 'step' ? outcome.steps.find((s) => s.nodeId === n.id)?.status === 'done'
        : outcome.values.get(n.id)
    }
  }));

  const rfEdges: Edge[] = edges.map((e) => {
    const on = outcome.values.get(e.from);
    return {
      id: e.id, source: e.from, target: e.to, sourceHandle: 'out', targetHandle: e.port,
      animated: on === true,
      style: { strokeWidth: 2, stroke: on === true ? 'var(--wk-ok)' : 'var(--wk-muted)' }
    };
  });

  const fits = (c: Connection): boolean => {
    const from = nodes.find((n) => n.id === c.source);
    const to = nodes.find((n) => n.id === c.target);
    if (from === undefined || to === undefined) return false;
    if (roleOfKind(from.kind) === 'output' || roleOfKind(to.kind) === 'input') return false;
    if (!pagePortsOf(to.kind).some((p) => p.port === c.targetHandle)) return false;
    return !wouldLoop(edges, from.id, to.id);
  };

  const connect = (c: Connection) => {
    if (!fits(c) || c.source === null || c.target === null) return;
    const port = c.targetHandle as PagePort;
    const to = nodes.find((n) => n.id === c.target)!;
    const many = pagePortsOf(to.kind).find((p) => p.port === port)?.many ?? false;

    setEdges((was) => [
      ...was.filter((e) => many || !(e.to === c.target && e.port === port)),
      { id: newId(), from: c.source!, to: c.target!, port }
    ]);
  };

  const drop = (id: string) => {
    if (nodes.find((n) => n.id === id)?.kind === 'part') return;
    setNodes((was) => was.filter((n) => n.id !== id));
    setEdges((was) => was.filter((e) => e.from !== id && e.to !== id));
    setSelected((was) => (was === id ? null : was));
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
    for (const ch of changes) if (ch.type === 'remove') setEdges((was) => was.filter((e) => e.id !== ch.id));
  };

  const add = (kind: PageNodeKind) => {
    const role = roleOfKind(kind);
    const lowest = Math.max(0, ...nodes.filter((n) => roleOfKind(n.kind) === role).map((n) => n.y + 110));
    const node: PageNode = {
      id: newId(), kind, x: COLUMN[role], y: lowest === 0 ? 40 : lowest,
      ...(kind === 'answer' ? { op: 'filled' as AnswerOp } : {}),
      ...(kind === 'date' ? { when: 'after' as const } : {}),
      ...(kind === 'step' ? { label: '' } : {})
    };
    setNodes((was) => [...was, node]);
    setSelected(node.id);
  };

  const patch = (id: string, change: Partial<PageNode>) =>
    setNodes((was) => was.map((n) => n.id === id ? { ...n, ...change } : n));

  const save = async () => {
    setBusy(true);
    setFailed(null);

    try {
      /* Eine Karte, auf der nur die Bausteine stehen und nichts verbunden ist, ist keine. */
      const empty = edges.length === 0 && nodes.every((n) => n.kind === 'part' && (n.message ?? '') === '');
      const text = empty ? null : JSON.stringify({ version: 1, nodes, edges });
      await savePageLogic(path, text);
      onSaved(text);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('pages.logicEd.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const chosen = nodes.find((n) => n.id === selected) ?? null;
  const inputs = nodes.filter((n) => roleOfKind(n.kind) === 'input');

  return (
    <section className="wk-logic">
      <p className="wk-hint">{t('pages.logicEd.intro')}</p>

      <div className="wk-logic-palette">
        <div className="wk-logic-pal-group">
          <span className="wk-hint">{t('pages.logicEd.person')}</span>
          {INPUT_KINDS.map((kind) => (
            <button key={kind} type="button" className="wk-lpal wk-lpal-input" onClick={() => add(kind)}>+ {PAGE_NODE_LABEL[kind]}</button>
          ))}
        </div>
        <div className="wk-logic-pal-group">
          <span className="wk-hint">{t('pages.logicEd.logic')}</span>
          {GATE_KINDS.map((kind) => (
            <button key={kind} type="button" className="wk-lpal" onClick={() => add(kind)}>+ {PAGE_NODE_LABEL[kind]}</button>
          ))}
        </div>
        <div className="wk-logic-pal-group">
          <span className="wk-hint">{t('pages.logicEd.onPage')}</span>
          <button type="button" className="wk-lpal wk-lpal-output" onClick={() => add('step')}>+ {PAGE_NODE_LABEL.step}</button>
        </div>
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
            <p className="wk-empty">{t('pages.logicEd.help')}</p>
          ) : (
            <Inspector
              node={chosen}
              parts={parts}
              partName={partName}
              forms={forms}
              questions={questions.get(chosen.formId ?? '') ?? null}
              marks={marks.get(chosen.formId ?? '') ?? null}
              onPatch={(change) => patch(chosen.id, change)}
              onDrop={() => drop(chosen.id)}
            />
          )}
        </aside>
      </div>

      <details className="wk-fold" open={inputs.length > 0}>
        <summary>{t('pages.logicEd.preview')}</summary>

        {inputs.length === 0 ? (
          <p className="wk-hint">{t('pages.logicEd.noInputs')}</p>
        ) : (
          <div className="wk-checks">
            {inputs.map((n) => (
              <label key={n.id}>
                <input type="checkbox" checked={sample[n.id] === true}
                  onChange={(e) => setSample((was) => ({ ...was, [n.id]: e.target.checked }))} />
                {' '}{PAGE_NODE_LABEL[n.kind]}: {summary(n)}
              </label>
            ))}
          </div>
        )}

        <ul className="wk-card-lines">
          {parts.filter((p) => outcome.hidden.has(p.id)).map((p) => (
            <li key={p.id}>{outcome.messages.has(p.id) ? t('${K}hiddenWith', { name: partName(p.id), message: outcome.messages.get(p.id) ?? '' }) : t('${K}hiddenLine', { name: partName(p.id) })}</li>
          ))}
          {outcome.steps.map((s) => (
            <li key={s.nodeId}>{s.status === 'done' ? '✓' : s.status === 'overdue' ? '!' : '○'} {s.label}</li>
          ))}
        </ul>
      </details>

      {failed !== null && <p className="wk-error">{failed}</p>}

      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? t('pages.editor.saving') : t('pages.logicEd.save')}
        </button>
        {dirty && (
          <button type="button" className="wk-link-btn" disabled={busy}
            onClick={() => { setNodes(start.nodes); setEdges(start.edges); setSelected(null); }}>
            {t('pages.logicEd.revert')}
          </button>
        )}
      </div>
    </section>
  );
}

/* -- Was sich an einem Knoten einstellen lässt ---------------------------------------------- */

function Inspector({ node, parts, partName, forms, questions, marks, onPatch, onDrop }: {
  node: PageNode;
  parts: readonly DraftPart[];
  partName: (partId?: string) => string;
  forms: readonly ModuleRow[];
  questions: readonly OpenField[] | null;
  marks: readonly Mark[] | null;
  onPatch: (change: Partial<PageNode>) => void;
  onDrop: () => void;
}) {
  const t = useT();
  const needsForm = node.kind === 'registered' || node.kind === 'confirmed' || node.kind === 'answer' || node.kind === 'mark';

  return (
    <div className="wk-form">
      <h3 className="wk-h2">{PAGE_NODE_LABEL[node.kind]}</h3>

      {node.kind === 'part' && (
        <>
          <p className="wk-hint">{partName(node.partId)}</p>
          <p className="wk-hint">{t('pages.logicEd.partHint')}</p>
          <label className="wk-field">
            <span>{t('pages.logicEd.message')}</span>
            <textarea rows={2} value={node.message ?? ''} placeholder={t('pages.logicEd.messagePlaceholder')}
              onChange={(e) => onPatch({ message: e.target.value })} />
          </label>
        </>
      )}

      {node.kind === 'step' && (
        <>
          <label className="wk-field">
            <span>{PAGE_NODE_LABEL.step}</span>
            <input value={node.label ?? ''} placeholder={t('pages.logicEd.stepPlaceholder')} onChange={(e) => onPatch({ label: e.target.value })} />
          </label>
          <label className="wk-field">
            <span>{t('pages.logicEd.stepHelp')}</span>
            <input value={node.help ?? ''} onChange={(e) => onPatch({ help: e.target.value })} />
          </label>
          <label className="wk-field">
            <span>{t('pages.logicEd.stepDue')}</span>
            <input type="date" value={node.dueAt ?? ''} onChange={(e) => onPatch({ dueAt: e.target.value || undefined })} />
          </label>
          <label className="wk-field">
            <span>{t('pages.logicEd.stepGoto')}</span>
            <select value={node.goto ?? ''} onChange={(e) => onPatch({ goto: e.target.value || undefined })}>
              <option value="">{t('pages.logicEd.noButton')}</option>
              {parts.map((p) => <option key={p.id} value={p.id}>{partName(p.id)}</option>)}
            </select>
          </label>
          <p className="wk-hint">{t('pages.logicEd.stepHint')}</p>
        </>
      )}

      {needsForm && (
        <label className="wk-field">
          <span>{t('pages.logicEd.formLabel')}</span>
          <select value={node.formId ?? ''}
            onChange={(e) => onPatch({ formId: e.target.value || undefined, fieldId: undefined, stepId: undefined, valueHash: undefined })}>
            <option value="">{t('pages.logicEd.choose')}</option>
            {forms.filter((f) => node.kind !== 'mark' || f.extendsId === null).map((f) => (
              <option key={f.moduleId} value={f.moduleId}>
                {f.name}{f.extendsId !== null ? t('pages.logicEd.extension') : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {node.kind === 'answer' && node.formId !== undefined && (
        <AnswerSettings node={node} questions={questions} onPatch={onPatch} />
      )}

      {node.kind === 'mark' && node.formId !== undefined && (
        marks === null ? <Loading label={t('pages.logicEd.loadingMarks')} />
        : marks.length === 0 ? <p className="wk-hint">{t('pages.logicEd.noMarks')}</p>
        : (
          <label className="wk-field">
            <span>{t('pages.logicEd.markLabel')}</span>
            <select value={node.stepId ?? ''} onChange={(e) => {
              const m = marks.find((one) => one.stepId === e.target.value);
              /* 0098 — eine Aufgabe zählt, sobald sie erfüllt ist; sie hat keinen Haken zum Anklicken. */
              onPatch({ stepId: m?.stepId, markBy: m?.kind === 'mark' ? m.doneBy : undefined });
            }}>
              <option value="">{t('pages.logicEd.choose')}</option>
              {marks.map((m) => <option key={m.stepId} value={m.stepId}>{m.label} · {markWord(m, t)}</option>)}
            </select>
          </label>
        )
      )}

      {node.kind === 'date' && (
        <>
          <label className="wk-field">
            <span>{t('pages.logicEd.true')}</span>
            <select value={node.when ?? 'after'} onChange={(e) => onPatch({ when: e.target.value === 'before' ? 'before' : 'after' })}>
              <option value="after">{t('pages.logicEd.fromDay')}</option>
              <option value="before">{t('pages.logicEd.beforeDay')}</option>
            </select>
          </label>
          <label className="wk-field">
            <span>{t('pages.logicEd.day')}</span>
            <input type="date" value={node.date ?? ''} onChange={(e) => onPatch({ date: e.target.value || undefined })} />
          </label>
        </>
      )}

      {(node.kind === 'chosen' || node.kind === 'link' || node.kind === 'loggedIn') && (
        <p className="wk-hint">
          {t(node.kind === 'chosen' ? 'pages.logicEd.is.chosen' : node.kind === 'link' ? 'pages.logicEd.is.link' : 'pages.logicEd.is.loggedIn')}
        </p>
      )}

      {node.kind === 'registered' && <p className="wk-hint">{t('pages.logicEd.is.registered')}</p>}
      {node.kind === 'confirmed' && <p className="wk-hint">{t('pages.logicEd.is.confirmed')}</p>}

      {(GATE_KINDS as readonly string[]).includes(node.kind) && (
        <p className="wk-hint">
          {t(node.kind === 'and' ? 'pages.logicEd.is.and' : node.kind === 'or' ? 'pages.logicEd.is.or' : 'pages.logicEd.is.not')}
        </p>
      )}

      {node.kind !== 'part' && (
        <div className="wk-actions">
          <button type="button" className="wk-link-btn wk-danger" onClick={onDrop}>{t('pages.logicEd.removeNode')}</button>
        </div>
      )}
    </div>
  );
}

/**
 * Eine Antwort — gefüllt, leer, oder gleich einem Wert. Der Wert selbst wird
 * NICHT gespeichert, nur sein Abdruck (`pageLogic.answerHash`): die Karte
 * liegt offen, eine Antwort gehört nicht hinein.
 */
function AnswerSettings({ node, questions, onPatch }: {
  node: PageNode;
  questions: readonly OpenField[] | null;
  onPatch: (change: Partial<PageNode>) => void;
}) {
  const t = useT();
  const field = questions?.find((f) => f.fieldId === node.fieldId) ?? null;
  const [draft, setDraft] = useState('');
  const [known, setKnown] = useState<string | null>(null);

  /* Welche Auswahl der Abdruck meint — bei einer Auswahlfrage lässt sie sich wiederfinden. */
  useEffect(() => {
    let alive = true;
    setKnown(null);
    if (field === null || node.valueHash === undefined) return;

    void (async () => {
      for (const option of field.options) {
        if ((await answerHash(field.fieldId, option)) === node.valueHash) { if (alive) setKnown(option); return; }
      }
    })();

    return () => { alive = false; };
  }, [field, node.valueHash]);

  const setValue = async (value: string) => {
    if (node.fieldId === undefined) return;
    onPatch({ valueHash: value.trim() === '' ? undefined : await answerHash(node.fieldId, value) });
  };

  return (
    <>
      {questions === null ? <Loading label={t('pages.logicEd.loadingQuestions')} /> : (
        <label className="wk-field">
          <span>{t('pages.logicEd.questionLabel')}</span>
          <select value={node.fieldId ?? ''} onChange={(e) => onPatch({ fieldId: e.target.value || undefined, valueHash: undefined })}>
            <option value="">{t('pages.logicEd.choose')}</option>
            {questions.map((f) => <option key={f.fieldId} value={f.fieldId}>{f.label ?? t('pages.logicEd.sealedQuestion')}</option>)}
          </select>
        </label>
      )}

      <label className="wk-field">
        <span>{t('pages.logicEd.answerIs')}</span>
        <select value={node.op ?? 'filled'} onChange={(e) => onPatch({ op: e.target.value as AnswerOp })}>
          {(Object.keys(ANSWER_OP_LABEL) as AnswerOp[]).map((op) => <option key={op} value={op}>{ANSWER_OP_LABEL[op]}</option>)}
        </select>
      </label>

      {(node.op === 'eq' || node.op === 'ne') && field !== null && (
        field.options.length > 0 ? (
          <label className="wk-field">
            <span>{t('pages.logicEd.value')}</span>
            <select value={known ?? ''} onChange={(e) => void setValue(e.target.value)}>
              <option value="">{t('pages.logicEd.choose')}</option>
              {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        ) : (
          <div className="wk-field">
            <span>{node.valueHash !== undefined ? t('pages.logicEd.valueSet') : t('pages.logicEd.value')}</span>
            <div className="wk-inline">
              <input value={draft} placeholder={node.valueHash !== undefined ? t('pages.logicEd.typeToChange') : t('pages.logicEd.valuePlaceholder')}
                onChange={(e) => setDraft(e.target.value)} />
              <button type="button" className="wk-link-btn" disabled={draft.trim() === ''}
                onClick={() => { void setValue(draft); setDraft(''); }}>
                {t('pages.logicEd.set')}
              </button>
            </div>
          </div>
        )
      )}

      {(node.op === 'eq' || node.op === 'ne') && (
        <p className="wk-hint">{t('pages.logicEd.hashHint')}</p>
      )}
    </>
  );
}

export default PageLogicEditor;
