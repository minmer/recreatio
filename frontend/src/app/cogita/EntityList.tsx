/**
 * COGITA — DIE EINTRÄGE (COGITA.md §2.3, [F2, F3, F7]): als Tabelle mit
 * Spalten, Filtern und Sortierung, als Baum nach Arten (und Themen), als
 * Leinwand, deren Plätze alle Autoren teilen. Ein Widok merkt sich Filter,
 * Spalten und Sortierung — und lässt sich als Link weitergeben.
 */

import { useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, type Edge, type Node, type NodeChange } from 'reactflow';
import 'reactflow/dist/style.css';

import { fieldsOf, fieldText, valuesOf, type Entity } from './schema';
import { COMPARE_LABEL, readRule, ruleMatches, type Compare, type Condition, type RuleGroup } from './store';
import { OriginTag, useBusy, useCtx } from './ui';

export type ListMode = 'table' | 'tree' | 'canvas';

interface ViewDoc {
  readonly name: string;
  readonly mode: ListMode;
  readonly kind: string;
  readonly query: string;
  readonly rule: RuleGroup | null;
  readonly columns: readonly string[];
  readonly sort: { readonly key: string; readonly dir: 1 | -1 } | null;
  readonly positions: Readonly<Record<string, { x: number; y: number }>>;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function readView(raw: unknown): ViewDoc {
  const d = isObject(raw) ? raw : {};
  const sort = isObject(d.sort) && typeof d.sort.key === 'string' ? { key: d.sort.key, dir: d.sort.dir === -1 ? -1 as const : 1 as const } : null;
  const positions: Record<string, { x: number; y: number }> = {};
  if (isObject(d.positions)) for (const [k, v] of Object.entries(d.positions)) if (isObject(v) && typeof v.x === 'number' && typeof v.y === 'number') positions[k] = { x: v.x, y: v.y };
  return {
    name: typeof d.name === 'string' ? d.name : 'Widok',
    mode: d.mode === 'tree' || d.mode === 'canvas' ? d.mode : 'table',
    kind: typeof d.kind === 'string' ? d.kind : '',
    query: typeof d.query === 'string' ? d.query : '',
    rule: readRule(d.rule),
    columns: Array.isArray(d.columns) ? d.columns.filter((c): c is string => typeof c === 'string') : [],
    sort,
    positions
  };
}

export function EntityList({ viewId, onOpen, onNew, onView }: {
  viewId: string | null;
  onOpen: (id: string) => void;
  onNew: (kind: string) => void;
  onView: (id: string | null) => void;
}) {
  const { lib, writes } = useCtx();
  const saved = viewId === null ? undefined : lib.docs('view').find((e) => e.id === viewId);
  const [view, setView] = useState<ViewDoc>(() => readView(saved?.data ?? { mode: 'table' }));
  const [shownFor, setShownFor] = useState(viewId);
  if (shownFor !== viewId) { setShownFor(viewId); setView(readView(saved?.data ?? { mode: 'table' })); }
  const { busy, failed, run } = useBusy();
  const look = lib.look;

  const list = useMemo(() => {
    let out: Entity[] = view.query.trim() === '' ? [...lib.entities()] : lib.search(view.query);
    if (view.kind !== '') out = out.filter((e) => e.kinds.includes(view.kind));
    if (view.rule !== null && view.rule.items.length > 0) out = out.filter((e) => ruleMatches(e, look, view.rule!));
    const sort = view.sort;
    if (sort !== null) {
      const valueOf = (e: Entity) => {
        if (sort.key === '_label') return lib.label(e);
        const f = fieldsOf(e, look).find((x) => x.key === sort.key);
        if (f === undefined) return '';
        const v = valuesOf(e, f)[0]?.value;
        return typeof v === 'number' ? v : typeof v === 'string' ? v : fieldText(e, f, look);
      };
      out.sort((a, b) => {
        const x = valueOf(a);
        const y = valueOf(b);
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pl', { numeric: true })) * sort.dir;
      });
    } else {
      out.sort((a, b) => lib.label(a).localeCompare(lib.label(b), 'pl'));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, lib.revision, view.query, view.kind, JSON.stringify(view.rule), JSON.stringify(view.sort)]);

  const kind = view.kind === '' ? undefined : lib.kind(view.kind);
  const columns = view.columns.length > 0 ? view.columns : (kind?.fields ?? []).filter((f) => f.type !== 'markup' && f.type !== 'text').slice(0, 4).map((f) => f.key);
  const setV = (patch: Partial<ViewDoc>) => setView((v) => ({ ...v, ...patch }));

  const saveView = (asNew: boolean) => run(async () => {
    const name = asNew ? window.prompt('Nazwa widoku', view.name === 'Widok' ? (kind?.name ?? 'Widok') : view.name) : view.name;
    if (name === null) return;
    const doc = { ...view, name: name.trim() || 'Widok' };
    const done = await lib.saveDoc('view', doc as unknown as Record<string, unknown>, asNew ? undefined : viewId ?? undefined);
    onView(done.id);
  });

  return (
    <div className="cg">
      <div className="cg-row">
        <input type="search" value={view.query} placeholder="Szukaj we wpisach…" onChange={(e) => setV({ query: e.target.value })} aria-label="Szukaj" />
        <select value={view.kind} onChange={(e) => setV({ kind: e.target.value, columns: [] })} aria-label="Rodzaj">
          <option value="">wszystkie rodzaje</option>
          {lib.kinds.map((k) => <option key={k.id} value={k.id}>{k.name} ({lib.ofKind(k.id).length})</option>)}
        </select>
        <span className="cg-subtabs">
          {(['table', 'tree', 'canvas'] as const).map((m) => <button key={m} type="button" className={view.mode === m ? 'is-on' : ''} onClick={() => setV({ mode: m })}>{{ table: 'Tabela', tree: 'Drzewo', canvas: 'Płótno' }[m]}</button>)}
        </span>
        {writes && <button type="button" className="wk-btn" onClick={() => onNew(view.kind === '' ? 'knowledge' : view.kind)}>+ Wpis{kind === undefined ? '' : `: ${kind.name}`}</button>}
      </div>
      <details>
        <summary>Filtr {view.rule !== null && view.rule.items.length > 0 ? `(${view.rule.items.length})` : ''}</summary>
        <RuleEditor rule={view.rule ?? { op: 'and', items: [] }} onChange={(rule) => setV({ rule })} />
      </details>
      <div className="cg-row">
        <span className="cg-muted">{list.length} wpisów</span>
        <select value={viewId ?? ''} onChange={(e) => onView(e.target.value === '' ? null : e.target.value)} aria-label="Zapisane widoki">
          <option value="">— zapisane widoki —</option>
          {lib.docs('view').map((v) => <option key={v.id} value={v.id}>{typeof v.data.name === 'string' ? v.data.name : 'Widok'}</option>)}
        </select>
        {writes && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void saveView(true)}>Zapisz jako widok</button>}
        {writes && viewId !== null && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void saveView(false)}>Zapisz zmiany widoku</button>}
        {viewId !== null && <button type="button" className="wk-link-btn" onClick={() => { void navigator.clipboard?.writeText(window.location.href); }}>Kopiuj link do widoku</button>}
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {view.mode === 'table' && <Table list={list} columns={columns} sort={view.sort} onSort={(key) => setV({ sort: view.sort?.key === key ? { key, dir: view.sort.dir === 1 ? -1 : 1 } : { key, dir: 1 } })} onOpen={onOpen}
        onColumns={kind === undefined ? undefined : (cols) => setV({ columns: cols })} kindFields={kind?.fields.map((f) => ({ key: f.key, label: f.label })) ?? []} />}
      {view.mode === 'tree' && <Tree list={list} onOpen={onOpen} />}
      {view.mode === 'canvas' && <Canvas list={list} positions={view.positions} onOpen={onOpen}
        onMoved={(id, at) => {
          const next = { ...view, positions: { ...view.positions, [id]: at } };
          setView(next);
          if (writes && viewId !== null) void lib.saveDoc('view', next as unknown as Record<string, unknown>, viewId).catch(() => undefined);
        }} />}
      {view.mode === 'canvas' && viewId === null && writes && <p className="wk-hint">Zapisz widok, żeby miejsca na płótnie zostały — widzą je wszyscy autorzy.</p>}
    </div>
  );
}

function RuleEditor({ rule, onChange, depth = 0 }: { rule: RuleGroup; onChange: (r: RuleGroup) => void; depth?: number }) {
  const { lib } = useCtx();
  const keys = [...new Map(lib.kinds.flatMap((k) => k.fields).map((f) => [f.key, f.label])).entries()];
  const set = (i: number, item: Condition | RuleGroup | null) => onChange({ ...rule, items: item === null ? rule.items.filter((_, j) => j !== i) : rule.items.map((x, j) => (j === i ? item : x)) });
  return (
    <div className="cg-cond">
      <div className="cg-cond-row">
        <select value={rule.op} onChange={(e) => onChange({ ...rule, op: e.target.value === 'or' ? 'or' : 'and' })}>
          <option value="and">wszystkie warunki (I)</option>
          <option value="or">którykolwiek (LUB)</option>
        </select>
      </div>
      <div className="cg-cond-items">
        {rule.items.map((item, i) => 'items' in item
          ? <div key={i} className="cg-cond-item"><RuleEditor rule={item} depth={depth + 1} onChange={(r) => set(i, r)} /><button type="button" className="wk-link-btn" onClick={() => set(i, null)}>×</button></div>
          : (
            <div key={i} className="cg-cond-row">
              {item.cmp !== 'kind' && item.cmp !== 'refers' && (
                <select value={item.field ?? ''} onChange={(e) => set(i, { ...item, field: e.target.value })}>
                  <option value="">pole…</option>
                  {keys.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              )}
              <select value={item.cmp} onChange={(e) => set(i, { ...item, cmp: e.target.value as Compare })}>
                {(Object.keys(COMPARE_LABEL) as Compare[]).map((c) => <option key={c} value={c}>{COMPARE_LABEL[c]}</option>)}
              </select>
              {item.cmp === 'kind' ? (
                <select value={item.value ?? ''} onChange={(e) => set(i, { ...item, value: e.target.value })}>
                  {lib.kinds.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              ) : item.cmp !== 'filled' && item.cmp !== 'empty' && <input value={item.value ?? ''} onChange={(e) => set(i, { ...item, value: e.target.value })} />}
              <button type="button" className="wk-link-btn" onClick={() => set(i, null)}>×</button>
            </div>
          ))}
        <span className="cg-row">
          <button type="button" className="wk-link-btn" onClick={() => onChange({ ...rule, items: [...rule.items, { cmp: 'contains', field: keys[0]?.[0], value: '' }] })}>+ warunek</button>
          {depth < 3 && <button type="button" className="wk-link-btn" onClick={() => onChange({ ...rule, items: [...rule.items, { op: rule.op === 'and' ? 'or' : 'and', items: [] }] })}>+ grupa</button>}
        </span>
      </div>
    </div>
  );
}

function Table({ list, columns, sort, onSort, onOpen, onColumns, kindFields }: {
  list: readonly Entity[];
  columns: readonly string[];
  sort: { key: string; dir: 1 | -1 } | null;
  onSort: (key: string) => void;
  onOpen: (id: string) => void;
  onColumns?: (cols: string[]) => void;
  kindFields: readonly { key: string; label: string }[];
}) {
  const { lib } = useCtx();
  const look = lib.look;
  const [page, setPage] = useState(0);
  const per = 100;
  const arrow = (key: string) => (sort?.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : '');
  return (
    <div className="cg">
      {onColumns !== undefined && (
        <details>
          <summary>Kolumny</summary>
          <div className="cg-row">
            {kindFields.map((f) => (
              <label key={f.key} className="pe-check">
                <input type="checkbox" checked={columns.includes(f.key)} onChange={(e) => onColumns(e.target.checked ? [...columns, f.key] : columns.filter((c) => c !== f.key))} />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </details>
      )}
      <div className="cg-table-wrap">
        <table className="cg-table">
          <thead>
            <tr>
              <th><button type="button" onClick={() => onSort('_label')}>Wpis{arrow('_label')}</button></th>
              <th>Rodzaj</th>
              {columns.map((c) => <th key={c}><button type="button" onClick={() => onSort(c)}>{kindFields.find((f) => f.key === c)?.label ?? c}{arrow(c)}</button></th>)}
            </tr>
          </thead>
          <tbody>
            {list.slice(page * per, page * per + per).map((e) => (
              <tr key={e.id} className="is-link" onClick={() => onOpen(e.id)} tabIndex={0} onKeyDown={(k) => { if (k.key === 'Enter') onOpen(e.id); }}>
                <td>{lib.label(e)}{lib.tell(e) !== '' && <span className="cg-muted"> · {lib.tell(e)}</span>} <OriginTag id={e.id} /></td>
                <td className="cg-muted">{e.kinds.map((k) => lib.kind(k)?.name ?? k).join(', ')}</td>
                {columns.map((c) => {
                  const f = fieldsOf(e, look).find((x) => x.key === c);
                  return <td key={c}>{f === undefined ? '' : fieldText(e, f, look).slice(0, 120)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > per && (
        <div className="cg-row">
          <button type="button" className="wk-link-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← wcześniejsze</button>
          <span className="cg-muted">{page * per + 1}–{Math.min(list.length, page * per + per)} z {list.length}</span>
          <button type="button" className="wk-link-btn" disabled={(page + 1) * per >= list.length} onClick={() => setPage((p) => p + 1)}>dalsze →</button>
        </div>
      )}
    </div>
  );
}

function Tree({ list, onOpen }: { list: readonly Entity[]; onOpen: (id: string) => void }) {
  const { lib } = useCtx();
  const look = lib.look;
  const shown = new Set(list.map((e) => e.id));
  /* Themen als Baum (Oberthema → Unterthemen); alles andere nach seiner ersten Art. */
  const parentOf = (e: Entity): string | null => {
    const f = fieldsOf(e, look).find((x) => x.key === 'parent');
    const v = f === undefined ? undefined : valuesOf(e, f)[0]?.value;
    return typeof v === 'string' && shown.has(v) ? v : null;
  };
  const children = new Map<string, Entity[]>();
  for (const e of list) if (e.kinds.includes('topic')) { const p = parentOf(e); if (p !== null) children.set(p, [...(children.get(p) ?? []), e]); }
  const branch = (e: Entity, depth: number): JSX.Element => {
    const kids = children.get(e.id) ?? [];
    return (
      <li key={e.id}>
        {kids.length > 0 && depth < 8
          ? <details open={depth === 0}><summary><button type="button" className="cg-ref" onClick={() => onOpen(e.id)}>{lib.label(e)}</button></summary><ul className="cg-tree">{kids.map((k) => branch(k, depth + 1))}</ul></details>
          : <><button type="button" className="cg-ref" onClick={() => onOpen(e.id)}>{lib.label(e)}</button> <OriginTag id={e.id} /></>}
      </li>
    );
  };
  return (
    <ul className="cg-tree">
      {lib.kinds.map((k) => {
        const of = list.filter((e) => e.kinds[0] === k.id);
        if (of.length === 0) return null;
        const roots = k.id === 'topic' ? of.filter((e) => parentOf(e) === null) : of;
        return (
          <li key={k.id}>
            <details open={of.length < 30}>
              <summary><strong>{k.name}</strong> <span className="cg-muted">({of.length})</span></summary>
              <ul className="cg-tree">{roots.slice(0, 500).map((e) => branch(e, 0))}</ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

function Canvas({ list, positions, onOpen, onMoved }: {
  list: readonly Entity[];
  positions: Readonly<Record<string, { x: number; y: number }>>;
  onOpen: (id: string) => void;
  onMoved: (id: string, at: { x: number; y: number }) => void;
}) {
  const { lib } = useCtx();
  const look = lib.look;
  const [moving, setMoving] = useState<Record<string, { x: number; y: number }>>({});
  const shown = list.slice(0, 400);
  const ids = new Set(shown.map((e) => e.id));
  const nodes: Node[] = shown.map((e, i) => ({
    id: e.id,
    position: moving[e.id] ?? positions[e.id] ?? { x: (i % 8) * 200, y: Math.floor(i / 8) * 90 },
    data: { label: lib.label(e).slice(0, 60) },
    style: { fontSize: 12, width: 170 }
  }));
  const edges: Edge[] = [];
  for (const e of shown) {
    for (const f of fieldsOf(e, look)) {
      if (f.type !== 'ref') continue;
      for (const v of valuesOf(e, f)) if (typeof v.value === 'string' && ids.has(v.value)) edges.push({ id: `${e.id}-${f.key}-${v.value}`, source: e.id, target: v.value, label: f.label, style: { fontSize: 10 } });
    }
  }
  return (
    <div className="cg-graph-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes: NodeChange[]) => {
          for (const ch of changes) if (ch.type === 'position' && ch.position !== undefined) { const { id, position } = ch; setMoving((m) => ({ ...m, [id]: { x: Math.round(position.x), y: Math.round(position.y) } })); }
        }}
        onNodeDragStop={(_, n) => { const at = moving[n.id]; if (at !== undefined) onMoved(n.id, at); }}
        onNodeDoubleClick={(_, n) => onOpen(n.id)}
        nodesConnectable={false}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
