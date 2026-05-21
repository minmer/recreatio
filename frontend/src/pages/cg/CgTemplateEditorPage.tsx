import React, { useCallback, useEffect, useRef, useState, useId } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  Background,
  Controls,
  Handle,
  Position,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { CgEntityListItem, CgFieldDefResponse, CgTypeDefDetailResponse } from './cgApi';
import { getCgEntities, getCgTypeDefDetail, getCgTypeDefs } from './cgApi';
import {
  createCgTemplate,
  deleteCgTemplate,
  generateCgQuiz,
  getCgTemplate,
  getCgTemplates,
  saveCgTemplate,
  type CgQuizQuestion,
  type CgTemplateEdgeSaveItem,
  type CgTemplateListItem,
  type CgTemplateNodeSaveItem
} from './cgTemplateApi';

// ── Config types ──────────────────────────────────────────────────────────────

type FieldConfig = { fieldDefId: number; fieldLabel: string; inputType: string; multiple: boolean };
type PromptConfig = { label: string };
type AnswerTextConfig = { fuzzy: boolean; thresholdPct: number };
type AnswerSelectConfig = { multiSelect: boolean; shuffle: boolean };
type AnswerBoolConfig = { trueLabel: string; falseLabel: string };
type DistractorConfig = { count: number; fieldDefId: number; fieldLabel: string };
type MaskConfig = { strategy: 'prefix' | 'suffix' | 'random'; keepPct: number };
type PickConfig = { position: 'random' | 'first' | 'last' };
type EntityFieldConfig = { targetTypeDefId: number; targetTypeName: string; targetFieldDefId: number; targetFieldLabel: string };
type TextConcatConfig = { template: string; inputCount: number; arraySeparator: string };

// ── Custom nodes ──────────────────────────────────────────────────────────────

function FieldNode({ data }: { data: FieldConfig }) {
  const isRef = data.inputType === 'reference';
  return (
    <div className={`cgt-node cgt-node-field${isRef ? ' cgt-node-field-ref' : ''}`}>
      <div className="cgt-node-type">Field</div>
      <div className="cgt-node-label">{data.fieldLabel || '(select field)'}</div>
      <div className="cgt-node-sub">
        {isRef ? '→ entity' : data.inputType}
        {data.multiple ? '[ ]' : ''}
      </div>
      <Handle type="source" position={Position.Right} id="value" />
    </div>
  );
}

function PromptNode({ data }: { data: PromptConfig }) {
  return (
    <div className="cgt-node cgt-node-prompt">
      <Handle type="target" position={Position.Left} id="content" />
      <div className="cgt-node-type">Prompt</div>
      <div className="cgt-node-label">{data.label || 'Stimulus'}</div>
    </div>
  );
}

function AnswerTextNode({ data }: { data: AnswerTextConfig }) {
  return (
    <div className="cgt-node cgt-node-answer">
      <Handle type="target" position={Position.Left} id="expected" />
      <div className="cgt-node-type">Text Answer</div>
      <div className="cgt-node-sub">{data.fuzzy ? `fuzzy ${data.thresholdPct}%` : 'exact'}</div>
    </div>
  );
}

function AnswerSelectNode({ data }: { data: AnswerSelectConfig }) {
  return (
    <div className="cgt-node cgt-node-answer" style={{ minHeight: 80 }}>
      <Handle type="target" position={Position.Left} id="expected" style={{ top: '35%' }} />
      <Handle type="target" position={Position.Left} id="distractor" style={{ top: '65%' }} />
      <div className="cgt-node-type">Select Answer</div>
      <div className="cgt-node-sub">{data.multiSelect ? 'multi' : 'single'}{data.shuffle ? ' · shuffle' : ''}</div>
      <div className="cgt-node-port-labels">
        <span style={{ top: '35%' }}>expected</span>
        <span style={{ top: '65%' }}>distractor</span>
      </div>
    </div>
  );
}

function AnswerOrderNode() {
  return (
    <div className="cgt-node cgt-node-answer">
      <Handle type="target" position={Position.Left} id="items" />
      <div className="cgt-node-type">Order Answer</div>
      <div className="cgt-node-sub">arrange items</div>
    </div>
  );
}

function AnswerBoolNode({ data }: { data: AnswerBoolConfig }) {
  return (
    <div className="cgt-node cgt-node-answer">
      <Handle type="target" position={Position.Left} id="expected" />
      <div className="cgt-node-type">True/False</div>
      <div className="cgt-node-sub">{data.trueLabel || 'True'} / {data.falseLabel || 'False'}</div>
    </div>
  );
}

function DistractorNode({ data }: { data: DistractorConfig }) {
  return (
    <div className="cgt-node cgt-node-distractor">
      <div className="cgt-node-type">Distractors</div>
      <div className="cgt-node-label">{data.fieldLabel || '(select field)'}</div>
      <div className="cgt-node-sub">count: {data.count}</div>
      <Handle type="source" position={Position.Right} id="distractor" />
    </div>
  );
}

function PickNode({ data }: { data: PickConfig }) {
  return (
    <div className="cgt-node cgt-node-pick" style={{ minHeight: 80 }}>
      <Handle type="target" position={Position.Left} id="items" />
      <div className="cgt-node-type">Pick</div>
      <div className="cgt-node-sub">hide {data.position} item</div>
      <Handle type="source" position={Position.Right} id="chosen" style={{ top: '35%' }} />
      <Handle type="source" position={Position.Right} id="rest" style={{ top: '65%' }} />
      <div className="cgt-node-port-labels cgt-node-port-labels-right">
        <span style={{ top: '35%' }}>chosen</span>
        <span style={{ top: '65%' }}>rest</span>
      </div>
    </div>
  );
}

function TextConcatNode({ data }: { data: TextConcatConfig }) {
  const count = Math.max(1, Math.min(10, data.inputCount || 1));
  return (
    <div className="cgt-node cgt-node-text-concat" style={{ minHeight: count * 26 + 48 }}>
      {Array.from({ length: count }, (_, i) => (
        <Handle
          key={i}
          type="target"
          position={Position.Left}
          id={String(i)}
          style={{ top: `${((i + 0.5) / count) * 100}%` }}
        />
      ))}
      <div className="cgt-node-port-labels">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} style={{ top: `${((i + 0.5) / count) * 100}%` }}>{i}</span>
        ))}
      </div>
      <div className="cgt-node-type">Text Concat</div>
      <div className="cgt-node-sub cgt-tc-template">{data.template || '{0}'}</div>
      <Handle type="source" position={Position.Right} id="value" />
    </div>
  );
}

function EntityFieldNode({ data }: { data: EntityFieldConfig }) {
  return (
    <div className="cgt-node cgt-node-entity-field" style={{ minHeight: 70 }}>
      <Handle type="target" position={Position.Left} id="in" />
      <div className="cgt-node-type">Entity Field</div>
      <div className="cgt-node-label">{data.targetTypeName || '(select type)'}</div>
      {data.targetFieldLabel && <div className="cgt-node-sub">→ {data.targetFieldLabel}</div>}
      <Handle type="source" position={Position.Right} id="value" />
    </div>
  );
}

function MaskNode({ data }: { data: MaskConfig }) {
  return (
    <div className="cgt-node cgt-node-mask" style={{ minHeight: 80 }}>
      <Handle type="target" position={Position.Left} id="text" />
      <div className="cgt-node-type">Mask</div>
      <div className="cgt-node-sub">{data.strategy} · keep {data.keepPct}%</div>
      <Handle type="source" position={Position.Right} id="masked" style={{ top: '35%' }} />
      <Handle type="source" position={Position.Right} id="full" style={{ top: '65%' }} />
      <div className="cgt-node-port-labels cgt-node-port-labels-right">
        <span style={{ top: '35%' }}>masked</span>
        <span style={{ top: '65%' }}>full</span>
      </div>
    </div>
  );
}

const NODE_TYPES = {
  field: FieldNode,
  prompt: PromptNode,
  'answer-text': AnswerTextNode,
  'answer-select': AnswerSelectNode,
  'answer-order': AnswerOrderNode,
  'answer-bool': AnswerBoolNode,
  distractor: DistractorNode,
  pick: PickNode,
  mask: MaskNode,
  'entity-field': EntityFieldNode,
  'text-concat': TextConcatNode
};

// ── Default configs ───────────────────────────────────────────────────────────

function defaultConfig(nodeType: string): object {
  switch (nodeType) {
    case 'field':         return { fieldDefId: 0, fieldLabel: '', inputType: 'text', multiple: false };
    case 'prompt':        return { label: 'Prompt' };
    case 'answer-text':   return { fuzzy: true, thresholdPct: 85 };
    case 'answer-select': return { multiSelect: false, shuffle: true };
    case 'answer-order':  return {};
    case 'answer-bool':   return { trueLabel: 'True', falseLabel: 'False' };
    case 'distractor':    return { count: 3, fieldDefId: 0, fieldLabel: '' };
    case 'pick':          return { position: 'random' };
    case 'mask':          return { strategy: 'suffix', keepPct: 30 };
    case 'entity-field':  return { targetTypeDefId: 0, targetTypeName: '', targetFieldDefId: 0, targetFieldLabel: '' };
    case 'text-concat':   return { template: '{0}', inputCount: 1, arraySeparator: ', ' };
    default:              return {};
  }
}

// ── Config panel ──────────────────────────────────────────────────────────────

function ConfigPanel({
  node,
  fields,
  allTypes,
  libId,
  onChange
}: {
  node: Node;
  fields: CgFieldDefResponse[];
  allTypes: import('./cgApi').CgTypeDefResponse[];
  libId: number;
  onChange: (id: string, config: object) => void;
}) {
  const cfg = node.data as Record<string, unknown>;
  const type = node.type ?? '';

  const [subTypeFields, setSubTypeFields] = useState<CgFieldDefResponse[]>([]);
  useEffect(() => {
    const targetId = (cfg.targetTypeDefId as number) ?? 0;
    if (!targetId || type !== 'entity-field') {
      setSubTypeFields([]);
      return;
    }
    getCgTypeDefDetail(libId, targetId)
      .then(d => setSubTypeFields(d.fields))
      .catch(() => setSubTypeFields([]));
  }, [cfg.targetTypeDefId, type, libId]);

  function set(key: string, value: unknown) {
    onChange(node.id, { ...cfg, [key]: value });
  }

  const fieldSelect = (defKey: string, labelKey: string) => (
    <div className="cgt-cfg-row">
      <label className="cgt-cfg-label">Field</label>
      <select
        className="cg-select"
        value={(cfg[defKey] as number) ?? 0}
        onChange={e => {
          const id = Number(e.target.value);
          const f = fields.find(x => x.id === id);
          onChange(node.id, {
            ...cfg,
            [defKey]: id,
            [labelKey]: f?.label ?? '',
            ...(type === 'field' ? { inputType: f?.inputType ?? 'text', multiple: f?.multiple ?? false } : {})
          });
        }}
      >
        <option value={0}>— select field —</option>
        {fields.map(f => (
          <option key={f.id} value={f.id}>{f.label} ({f.inputType})</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="cgt-config-panel">
      <div className="cgt-cfg-title">{type}</div>

      {(type === 'field') && fieldSelect('fieldDefId', 'fieldLabel')}

      {type === 'prompt' && (
        <div className="cgt-cfg-row">
          <label className="cgt-cfg-label">Label</label>
          <input className="cg-input" value={(cfg.label as string) ?? ''} onChange={e => set('label', e.target.value)} />
        </div>
      )}

      {type === 'answer-text' && (
        <>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label cgt-cfg-check">
              <input type="checkbox" checked={(cfg.fuzzy as boolean) ?? true} onChange={e => set('fuzzy', e.target.checked)} />
              Fuzzy match
            </label>
          </div>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">Threshold %</label>
            <input type="number" className="cg-input cgt-num" min={50} max={100} value={(cfg.thresholdPct as number) ?? 85} onChange={e => set('thresholdPct', Number(e.target.value))} />
          </div>
        </>
      )}

      {type === 'answer-select' && (
        <>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label cgt-cfg-check">
              <input type="checkbox" checked={(cfg.multiSelect as boolean) ?? false} onChange={e => set('multiSelect', e.target.checked)} />
              Multi-select
            </label>
          </div>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label cgt-cfg-check">
              <input type="checkbox" checked={(cfg.shuffle as boolean) ?? true} onChange={e => set('shuffle', e.target.checked)} />
              Shuffle options
            </label>
          </div>
        </>
      )}

      {type === 'answer-bool' && (
        <>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">True label</label>
            <input className="cg-input" value={(cfg.trueLabel as string) ?? 'True'} onChange={e => set('trueLabel', e.target.value)} />
          </div>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">False label</label>
            <input className="cg-input" value={(cfg.falseLabel as string) ?? 'False'} onChange={e => set('falseLabel', e.target.value)} />
          </div>
        </>
      )}

      {type === 'distractor' && (
        <>
          {fieldSelect('fieldDefId', 'fieldLabel')}
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">Count</label>
            <input type="number" className="cg-input cgt-num" min={1} max={10} value={(cfg.count as number) ?? 3} onChange={e => set('count', Number(e.target.value))} />
          </div>
        </>
      )}

      {type === 'pick' && (
        <div className="cgt-cfg-row">
          <label className="cgt-cfg-label">Hide which item</label>
          <select className="cg-select" value={(cfg.position as string) ?? 'random'} onChange={e => set('position', e.target.value)}>
            <option value="random">Random</option>
            <option value="first">First</option>
            <option value="last">Last</option>
          </select>
        </div>
      )}

      {type === 'entity-field' && (
        <>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">Type</label>
            <select
              className="cg-select"
              value={(cfg.targetTypeDefId as number) ?? 0}
              onChange={e => {
                const id = Number(e.target.value);
                const t = allTypes.find(x => x.id === id);
                onChange(node.id, {
                  ...cfg,
                  targetTypeDefId: id,
                  targetTypeName: t?.name ?? '',
                  targetFieldDefId: 0,
                  targetFieldLabel: ''
                });
              }}
            >
              <option value={0}>— select type —</option>
              {allTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">Field</label>
            <select
              className="cg-select"
              value={(cfg.targetFieldDefId as number) ?? 0}
              disabled={subTypeFields.length === 0}
              onChange={e => {
                const id = Number(e.target.value);
                const f = subTypeFields.find(x => x.id === id);
                onChange(node.id, { ...cfg, targetFieldDefId: id, targetFieldLabel: f?.label ?? '' });
              }}
            >
              <option value={0}>— first / display field —</option>
              {subTypeFields.map(f => (
                <option key={f.id} value={f.id}>{f.label} ({f.inputType})</option>
              ))}
            </select>
          </div>
        </>
      )}

      {type === 'text-concat' && (
        <>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">Inputs</label>
            <input
              type="number"
              className="cg-input cgt-num"
              min={1} max={10}
              value={(cfg.inputCount as number) ?? 1}
              onChange={e => {
                const n = Math.max(1, Math.min(10, Number(e.target.value)));
                set('inputCount', n);
              }}
            />
          </div>
          <div className="cgt-cfg-row cgt-cfg-hint">
            Use {'{0}'}, {'{1}'}, … as placeholders. Each maps to the matching input handle.
          </div>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">Template</label>
            <textarea
              className="cg-input cgt-textarea"
              rows={3}
              value={(cfg.template as string) ?? '{0}'}
              onChange={e => set('template', e.target.value)}
            />
          </div>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">Array join</label>
            <input
              className="cg-input"
              placeholder=", "
              value={(cfg.arraySeparator as string) ?? ', '}
              onChange={e => set('arraySeparator', e.target.value)}
            />
          </div>
        </>
      )}

      {type === 'mask' && (
        <>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">Strategy</label>
            <select className="cg-select" value={(cfg.strategy as string) ?? 'suffix'} onChange={e => set('strategy', e.target.value)}>
              <option value="prefix">Prefix (keep start)</option>
              <option value="suffix">Suffix (keep end)</option>
              <option value="random">Random</option>
            </select>
          </div>
          <div className="cgt-cfg-row">
            <label className="cgt-cfg-label">Keep %</label>
            <input type="number" className="cg-input cgt-num" min={5} max={90} value={(cfg.keepPct as number) ?? 30} onChange={e => set('keepPct', Number(e.target.value))} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Palette ───────────────────────────────────────────────────────────────────

const PALETTE = [
  { type: 'field',         label: 'Field',        hint: 'reads entity field' },
  { type: 'prompt',        label: 'Prompt',       hint: 'shows stimulus' },
  { type: 'answer-text',   label: 'Text Answer',  hint: 'type the answer' },
  { type: 'answer-select', label: 'Select',       hint: 'pick from options' },
  { type: 'answer-order',  label: 'Order',        hint: 'arrange items' },
  { type: 'answer-bool',   label: 'True/False',   hint: 'boolean answer' },
  { type: 'distractor',    label: 'Distractors',  hint: 'wrong options source' },
  { type: 'pick',          label: 'Pick',         hint: 'hide one from list' },
  { type: 'mask',          label: 'Mask',         hint: 'hide part of text' },
  { type: 'entity-field',  label: 'Entity Field', hint: 'read field from entities' },
  { type: 'text-concat',   label: 'Text Concat',  hint: 'template with {0} {1} …' }
];

// ── Question preview modal ────────────────────────────────────────────────────

function QuestionPreview({ question }: { question: CgQuizQuestion }) {
  const answerLabel: Record<string, string> = {
    text: 'Type answer',
    select: 'Pick from options',
    order: 'Arrange in order',
    bool: 'True / False'
  };

  let answerConfig: Record<string, unknown> = {};
  try { answerConfig = JSON.parse(question.answerConfigJson); } catch { /* ignore */ }

  return (
    <div className="cgt-preview-question">
      {question.warnings.length > 0 && (
        <div className="cgt-preview-warnings">
          {question.warnings.map((w, i) => (
            <div key={i} className="cgt-preview-warning">{w}</div>
          ))}
        </div>
      )}

      <div className="cgt-preview-section-title">Stimulus</div>
      {question.stimulus.length === 0 ? (
        <p className="cgt-preview-empty">No prompt nodes produced content.</p>
      ) : (
        question.stimulus.map((s, i) => (
          <div key={i} className="cgt-preview-stimulus">
            <span className="cgt-preview-stim-label">{s.label}</span>
            <div className="cgt-preview-stim-values">
              {s.values.map((v, j) => <span key={j} className="cgt-preview-stim-val">{v}</span>)}
            </div>
          </div>
        ))
      )}

      <div className="cgt-preview-section-title" style={{ marginTop: '1rem' }}>Answer</div>
      <div className="cgt-preview-answer-type">
        {answerLabel[question.answerType] ?? question.answerType}
        {question.answerType === 'text' && Boolean(answerConfig.fuzzy) && (
          <span className="cgt-preview-badge">fuzzy {String(answerConfig.thresholdPct ?? 85)}%</span>
        )}
        {question.answerType === 'select' && Boolean(answerConfig.multiSelect) && (
          <span className="cgt-preview-badge">multi-select</span>
        )}
      </div>

      {question.expected.length > 0 && (
        <div className="cgt-preview-expected">
          <span className="cgt-preview-field-label">Expected:</span>
          {question.expected.map((v, i) => <span key={i} className="cgt-preview-chip cgt-preview-chip-correct">{v}</span>)}
        </div>
      )}

      {question.distractors.length > 0 && (
        <div className="cgt-preview-distractors">
          <span className="cgt-preview-field-label">Distractors:</span>
          {question.distractors.map((v, i) => <span key={i} className="cgt-preview-chip cgt-preview-chip-wrong">{v}</span>)}
        </div>
      )}
    </div>
  );
}

function PreviewModal({
  libId,
  typeId,
  graphId,
  onClose
}: {
  libId: number;
  typeId: number;
  graphId: number;
  onClose: () => void;
}) {
  const selectId = useId();
  const [entities, setEntities] = useState<CgEntityListItem[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [question, setQuestion] = useState<CgQuizQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCgEntities(libId, typeId, 0, 100)
      .then(list => {
        setEntities(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch(() => setError('Failed to load entities.'))
      .finally(() => setLoadingEntities(false));
  }, [libId, typeId]);

  async function handleGenerate() {
    if (!selectedId) return;
    setGenerating(true);
    setQuestion(null);
    setError(null);
    try {
      const q = await generateCgQuiz(libId, typeId, graphId, selectedId);
      setQuestion(q);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || 'Failed to generate question.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="cgt-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cgt-modal">
        <div className="cgt-modal-header">
          <h2 className="cgt-modal-title">Preview Question</h2>
          <button className="cgt-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="cgt-modal-body">
          {loadingEntities ? (
            <div className="cg-loading">Loading entities…</div>
          ) : entities.length === 0 ? (
            <p className="cg-empty">No entities found. Add some entities first.</p>
          ) : (
            <div className="cgt-preview-controls">
              <label className="cgt-cfg-label" htmlFor={selectId}>Entity</label>
              <select
                id={selectId}
                className="cg-select cgt-preview-select"
                value={selectedId ?? ''}
                onChange={e => setSelectedId(Number(e.target.value))}
              >
                {entities.map(en => (
                  <option key={en.id} value={en.id}>{en.displayValue || `#${en.id}`}</option>
                ))}
              </select>
              <button
                className="cg-btn cg-btn-primary"
                onClick={handleGenerate}
                disabled={generating || !selectedId}
              >
                {generating ? 'Generating…' : 'Generate'}
              </button>
            </div>
          )}

          {error && (
            <div className="cg-error" onClick={() => setError(null)}>{error}</div>
          )}

          {question && <QuestionPreview question={question} />}
        </div>
      </div>
    </div>
  );
}

// ── Inner editor (must be inside ReactFlowProvider) ───────────────────────────

let _seq = 1;
function uid() { return `n${_seq++}`; }

function advanceSeqPast(nodes: Node[]) {
  for (const n of nodes) {
    const m = n.id.match(/^n(\d+)$/);
    if (m) _seq = Math.max(_seq, Number(m[1]) + 1);
  }
}

function EditorCanvas({
  libId,
  typeId,
  graphId,
  graphName,
  initialNodes,
  initialEdges,
  typeDef,
  allTypes,
  onBack
}: {
  libId: number;
  typeId: number;
  graphId: number;
  graphName: string;
  initialNodes: Node[];
  initialEdges: Edge[];
  typeDef: CgTypeDefDetailResponse;
  allTypes: import('./cgApi').CgTypeDefResponse[];
  onBack: () => void;
}) {
  const [name, setName] = useState(graphName);
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selected, setSelected] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { project } = useReactFlow();

  useEffect(() => { advanceSeqPast(initialNodes); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
    setDirty(true);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds));
    setDirty(true);
  }, []);

  const onConnect = useCallback((conn: Connection) => {
    setEdges(eds => addEdge({ ...conn, id: `e-${uid()}` }, eds));
    setDirty(true);
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => setSelected(node), []);
  const onPaneClick = useCallback(() => setSelected(null), []);

  function addNode(type: string) {
    const bounds = wrapRef.current?.getBoundingClientRect();
    const cx = bounds ? bounds.left + bounds.width / 2 : 200;
    const cy = bounds ? bounds.top + bounds.height / 2 : 200;
    const pos = project({ x: cx + (Math.random() * 40 - 20), y: cy + (Math.random() * 40 - 20) });
    setNodes(nds => [...nds, { id: uid(), type, position: pos, data: defaultConfig(type) }]);
    setDirty(true);
  }

  function updateConfig(id: string, cfg: object) {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: cfg } : n));
    setSelected(prev => prev?.id === id ? { ...prev, data: cfg } : prev);
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const nodeItems: CgTemplateNodeSaveItem[] = nodes.map(n => ({
        nodeKey: n.id,
        nodeType: n.type ?? 'field',
        configJson: JSON.stringify(n.data),
        positionX: n.position.x,
        positionY: n.position.y
      }));
      const edgeItems: CgTemplateEdgeSaveItem[] = edges.map(e => ({
        edgeKey: e.id,
        sourceKey: e.source,
        targetKey: e.target,
        sourceHandle: e.sourceHandle ?? null,
        targetHandle: e.targetHandle ?? null
      }));
      await saveCgTemplate(libId, typeId, graphId, name, nodeItems, edgeItems);
      setDirty(false);
    } catch {
      setError('Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cgt-layout">
      <div className="cg-header">
        <button className="cg-back" onClick={onBack}>← Templates</button>
        <input
          className="cg-input cgt-name-input"
          value={name}
          onChange={e => { setName(e.target.value); setDirty(true); }}
        />
        <div className="cg-header-actions">
          {error && <span className="cg-error-inline" onClick={() => setError(null)}>{error}</span>}
          <button className="cg-btn cg-btn-ghost" onClick={() => setShowPreview(true)}>Preview</button>
          <button className="cg-btn" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="cgt-body">
        <aside className="cgt-palette">
          <div className="cgt-palette-title">Add Node</div>
          {PALETTE.map(p => (
            <button key={p.type} className="cgt-palette-btn" onClick={() => addNode(p.type)}>
              <span className="cgt-palette-label">{p.label}</span>
              <span className="cgt-palette-hint">{p.hint}</span>
            </button>
          ))}
        </aside>

        <div className="cgt-canvas" ref={wrapRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            deleteKeyCode="Delete"
          >
            <Background color="#1e2330" gap={20} />
            <Controls />
          </ReactFlow>
        </div>

        {selected && (
          <ConfigPanel
            node={selected}
            fields={typeDef.fields}
            allTypes={allTypes}
            libId={libId}
            onChange={updateConfig}
          />
        )}
      </div>

      {showPreview && (
        <PreviewModal
          libId={libId}
          typeId={typeId}
          graphId={graphId}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

// ── Template list ─────────────────────────────────────────────────────────────

function TemplateList({
  libId,
  typeId,
  typeName,
  onEdit,
  onBack
}: {
  libId: number;
  typeId: number;
  typeName: string;
  onEdit: (id: number) => void;
  onBack: () => void;
}) {
  const [templates, setTemplates] = useState<CgTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    getCgTemplates(libId, typeId)
      .then(setTemplates)
      .catch(() => setError('Failed to load templates.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [libId, typeId]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      const t = await createCgTemplate(libId, typeId, name);
      setNewName('');
      setShowNew(false);
      onEdit(t.id);
    } catch {
      setError('Failed to create.');
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this template?')) return;
    try {
      await deleteCgTemplate(libId, typeId, id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch {
      setError('Failed to delete.');
    }
  }

  return (
    <div className="cg-page">
      <div className="cg-header">
        <button className="cg-back" onClick={onBack}>← {typeName}</button>
        <h1 className="cg-title">Question Templates</h1>
        <div className="cg-header-actions">
          <button className="cg-btn" onClick={() => setShowNew(true)}>+ New Template</button>
        </div>
      </div>

      {error && <div className="cg-error" onClick={() => setError(null)}>{error}</div>}

      <div className="cg-section">
        {showNew && (
          <div className="cgt-new-form">
            <input
              className="cg-input"
              placeholder="Template name…"
              value={newName}
              autoFocus
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setShowNew(false);
              }}
            />
            <button className="cg-btn cg-btn-primary" onClick={handleCreate}>Create</button>
            <button className="cg-btn" onClick={() => setShowNew(false)}>Cancel</button>
          </div>
        )}

        {loading ? (
          <div className="cg-loading">Loading…</div>
        ) : templates.length === 0 ? (
          <p className="cg-empty">No templates yet. Create one to define how quiz questions are generated from this entity type.</p>
        ) : (
          <div className="cg-list">
            {templates.map(t => (
              <div key={t.id} className="cg-list-item">
                <span className="cg-list-item-label">{t.name}</span>
                <span className="cg-muted">{t.nodeCount} nodes</span>
                <div className="cg-list-item-actions">
                  <button className="cg-btn cg-btn-sm" onClick={() => onEdit(t.id)}>Edit</button>
                  <button className="cg-btn cg-btn-sm cg-btn-danger" onClick={() => handleDelete(t.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────

export function CgTemplateEditorPage({
  libId,
  typeId,
  onBack
}: {
  libId: number;
  typeId: number;
  onBack: () => void;
}) {
  const [activeGraphId, setActiveGraphId] = useState<number | null>(null);
  const [typeDef, setTypeDef] = useState<CgTypeDefDetailResponse | null>(null);
  const [allTypes, setAllTypes] = useState<import('./cgApi').CgTypeDefResponse[]>([]);
  const [graphData, setGraphData] = useState<{ name: string; nodes: Node[]; edges: Edge[] } | null>(null);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCgTypeDefDetail(libId, typeId), getCgTypeDefs(libId)])
      .then(([detail, types]) => { setTypeDef(detail); setAllTypes(types); })
      .catch(() => setError('Failed to load type definition.'));
  }, [libId, typeId]);

  useEffect(() => {
    if (!activeGraphId) { setGraphData(null); return; }
    setLoadingGraph(true);
    getCgTemplate(libId, typeId, activeGraphId)
      .then(g => {
        const nodes: Node[] = g.nodes.map(n => ({
          id: n.nodeKey,
          type: n.nodeType,
          position: { x: Number(n.positionX), y: Number(n.positionY) },
          data: JSON.parse(n.configJson) as object
        }));
        const edges: Edge[] = g.edges.map(e => ({
          id: e.edgeKey,
          source: e.sourceKey,
          target: e.targetKey,
          sourceHandle: e.sourceHandle ?? undefined,
          targetHandle: e.targetHandle ?? undefined
        }));
        setGraphData({ name: g.name, nodes, edges });
      })
      .catch(() => setError('Failed to load template.'))
      .finally(() => setLoadingGraph(false));
  }, [libId, typeId, activeGraphId]);

  if (error) {
    return (
      <div className="cg-page">
        <div className="cg-header">
          <button className="cg-back" onClick={onBack}>← Back</button>
        </div>
        <div className="cg-section">
          <div className="cg-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!typeDef) {
    return <div className="cg-page"><div className="cg-loading">Loading…</div></div>;
  }

  if (activeGraphId && loadingGraph) {
    return <div className="cg-page"><div className="cg-loading">Loading template…</div></div>;
  }

  if (activeGraphId && graphData) {
    return (
      <ReactFlowProvider>
        <EditorCanvas
          libId={libId}
          typeId={typeId}
          graphId={activeGraphId}
          graphName={graphData.name}
          initialNodes={graphData.nodes}
          initialEdges={graphData.edges}
          typeDef={typeDef}
          allTypes={allTypes}
          onBack={() => { setActiveGraphId(null); setGraphData(null); }}
        />
      </ReactFlowProvider>
    );
  }

  return (
    <TemplateList
      libId={libId}
      typeId={typeId}
      typeName={typeDef.name}
      onEdit={id => setActiveGraphId(id)}
      onBack={onBack}
    />
  );
}
