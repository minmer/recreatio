/**
 * COGITA — DIE EINTRÄGE (COGITA.md §2.3, [F2, F3, F7]): als Tabelle mit
 * Spalten, Filtern und Sortierung, als Baum nach Arten (und Themen), als
 * Leinwand, deren Plätze alle Autoren teilen. Ein Widok merkt sich Filter,
 * Spalten und Sortierung — und lässt sich als Link weitergeben.
 *
 * 2026-10-22 (Schritt 9) — der Widok ist das Dokument aus `views.ts`: eine
 * Auswahl in Schritten (dieselben wie in der Powtórka, `selection.ts`),
 * Gruppen für das Drzewo; derselbe Widok steht als Baustein „Widok" auf einer
 * Seite. „Rodzaj" und „Filtr" oben sind Abkürzungen in seine Schritte.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import ReactFlow, { Background, Controls, type Edge, type Node, type NodeChange } from 'reactflow';
import 'reactflow/dist/style.css';

import { MenuButton } from '../ui/Menu';
import { fieldsOf, fieldText, valuesOf, type Entity } from './schema';
import { SelectionBar } from './EntitySelection';
import { RuleEditor } from './RuleEditor';
import { OriginTag, useBusy, useCtx } from './ui';
import { ViewSteps } from './ViewSteps';
import { readView, ruleOf, sourceKind, viewColumns, viewGroups, viewJson, viewList, withRule, withSourceKind, type ViewDoc } from './views';
import type { Group } from './selection';

export type { ListMode } from './views';

export function EntityList({ viewId, onOpen, onNew, onView, onForm, onForms }: {
  viewId: string | null;
  onOpen: (id: string) => void;
  onNew: (kind: string) => void;
  onView: (id: string | null) => void;
  /** 2026-10-17 — viele auf einmal: ein Formularz dodawania ausfüllen — oder einen bauen. */
  onForm: (id: string) => void;
  onForms: () => void;
}) {
  const { lib, writes } = useCtx();
  const saved = viewId === null ? undefined : lib.docs('view').find((e) => e.id === viewId);
  const [view, setView] = useState<ViewDoc>(() => readView(saved?.data ?? { mode: 'table' }));
  const [shownFor, setShownFor] = useState(viewId);
  if (shownFor !== viewId) { setShownFor(viewId); setView(readView(saved?.data ?? { mode: 'table' })); }
  const { busy, failed, run } = useBusy();
  const look = lib.look;
  /* 2026-10-18 — zaznaczone wpisy: bleiben über Seiten und Filter hinweg gewählt, bis man sie abwählt. */
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    if (picked.size === 0) return undefined;
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setPicked(new Set()); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [picked.size]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => viewList(lib, view), [lib, lib.revision, view.query, JSON.stringify(view.steps), JSON.stringify(view.sort)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => (view.mode === 'tree' && view.group !== null ? viewGroups(lib, view, list) : null), [list, view.mode, JSON.stringify(view.group)]);

  const quickKind = sourceKind(view);
  const kind = quickKind === null || quickKind === '' ? undefined : lib.kind(quickKind);
  const shownColumns = viewColumns(lib, view, list);
  const columns = view.columns.length > 0 ? view.columns : kind !== undefined ? kind.fields.filter((f) => f.type !== 'markup' && f.type !== 'text').slice(0, 4).map((f) => f.key) : shownColumns.map((f) => f.key);
  const chooserFields = kind !== undefined ? kind.fields.map((f) => ({ key: f.key, label: f.label }))
    : [...new Map(list.slice(0, 200).flatMap((e) => fieldsOf(e, look)).filter((f) => f.type !== 'markup' && f.type !== 'blocks').map((f) => [f.key, { key: f.key, label: f.label }])).values()];
  const setV = (patch: Partial<ViewDoc>) => setView((v) => ({ ...v, ...patch }));
  const rule = ruleOf(view);

  const saveView = (asNew: boolean) => run(async () => {
    const name = asNew ? window.prompt('Nazwa widoku', view.name === 'Widok' ? (kind?.name ?? 'Widok') : view.name) : view.name;
    if (name === null) return;
    const doc = viewJson({ ...view, name: name.trim() || 'Widok' });
    const done = await lib.saveDoc('view', doc, asNew ? undefined : viewId ?? undefined);
    onView(done.id);
  });

  return (
    <div className="cg">
      <div className="cg-row">
        <input type="search" value={view.query} placeholder="Szukaj we wpisach…" onChange={(e) => setV({ query: e.target.value })} aria-label="Szukaj" />
        <select value={quickKind ?? '#inne'} onChange={(e) => { if (e.target.value !== '#inne') setView(withSourceKind(view, e.target.value)); }} aria-label="Rodzaj">
          <option value="">wszystkie rodzaje</option>
          {lib.kinds.map((k) => <option key={k.id} value={k.id}>{k.name} ({lib.ofKind(k.id).length})</option>)}
          {quickKind === null && <option value="#inne">inne źródło (zob. „Wybór")</option>}
        </select>
        <span className="cg-subtabs">
          {(['table', 'tree', 'canvas'] as const).map((m) => <button key={m} type="button" className={view.mode === m ? 'is-on' : ''} onClick={() => setV({ mode: m })}>{{ table: 'Tabela', tree: 'Drzewo', canvas: 'Płótno' }[m]}</button>)}
        </span>
        {writes && <button type="button" className="wk-btn" disabled={lib.kinds.length === 0} title={lib.kinds.length === 0 ? 'Najpierw dodaj rodzaj w Schemacie' : undefined} onClick={() => onNew(kind?.id ?? lib.kinds[0]?.id ?? 'knowledge')}>+ Wpis{kind === undefined ? '' : `: ${kind.name}`}</button>}
        {writes && (
          <MenuButton label="Dodaj wiele naraz — formularzem" text="Wiele naraz" icon="list"
            items={[
              ...lib.docs('addform').map((e) => ({ label: typeof e.data.name === 'string' ? e.data.name : 'Formularz', onSelect: () => onForm(e.id) })),
              { label: lib.docs('addform').length === 0 ? 'Zbuduj formularz dodawania…' : 'Formularze dodawania…', icon: 'settings' as const, onSelect: onForms }
            ]} />
        )}
      </div>
      <details>
        <summary>Filtr {rule !== null && rule.items.length > 0 ? `(${rule.items.length})` : ''}</summary>
        <RuleEditor rule={rule ?? { op: 'and', items: [] }} onChange={(next) => setView(withRule(view, next))} />
      </details>
      <details>
        <summary>Wybór i grupy {view.steps.length > 1 || quickKind === null ? `(${view.steps.length} ${view.steps.length === 1 ? 'krok' : 'kroki'})` : ''}</summary>
        <ViewSteps view={view} onChange={setView} />
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
      {picked.size > 0 && <SelectionBar ids={picked} total={list.length} onAll={() => setPicked(new Set(list.map((e) => e.id)))} onClear={() => setPicked(new Set())} onKept={setPicked} />}
      {view.mode === 'table' && <Table list={list} picked={picked} onPick={setPicked} columns={columns} sort={view.sort} onSort={(key) => setV({ sort: view.sort?.key === key ? { key, dir: view.sort.dir === 1 ? -1 : 1 } : { key, dir: 1 } })} onOpen={onOpen}
        onColumns={(cols) => setV({ columns: cols })} kindFields={chooserFields} />}
      {view.mode === 'tree' && (groups === null ? <Tree list={list} onOpen={onOpen} /> : <GroupTree groups={groups} onOpen={onOpen} />)}
      {view.mode === 'canvas' && <Canvas list={list} positions={view.positions} onOpen={onOpen}
        onMoved={(id, at) => {
          const next = { ...view, positions: { ...view.positions, [id]: at } };
          setView(next);
          if (writes && viewId !== null) void lib.saveDoc('view', viewJson(next), viewId).catch(() => undefined);
        }} />}
      {view.mode === 'canvas' && viewId === null && writes && <p className="wk-hint">Zapisz widok, żeby miejsca na płótnie zostały — widzą je wszyscy autorzy.</p>}
      {picked.size > 0 && <div className="cg-select-room" aria-hidden />}
    </div>
  );
}

function Table({ list, picked, onPick, columns, sort, onSort, onOpen, onColumns, kindFields }: {
  list: readonly Entity[];
  picked: ReadonlySet<string>;
  onPick: (next: ReadonlySet<string>) => void;
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

  /*
    2026-10-18 — WÄHLEN MIT DER MAUS: das Kästchen, Strg+Klick (eins dazu),
    Umschalt+Klick (alles dazwischen), Ziehen über die Kästchen (viele auf
    einmal); auf dem Telefon langes Drücken. Ist schon etwas gewählt, wählt
    ein Klick auf eine Zeile — statt sie zu öffnen.
  */
  const [anchor, setAnchor] = useState<string | null>(null);
  const painting = useRef<boolean | null>(null);
  const holding = useRef<number | null>(null);
  const held = useRef(false);
  useEffect(() => {
    const up = () => { painting.current = null; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);
  const choosing = picked.size > 0;
  const mark = (ids: readonly string[], on: boolean) => {
    const next = new Set(picked);
    for (const id of ids) if (on) next.add(id); else next.delete(id);
    onPick(next);
  };
  const between = (to: string): string[] => {
    const a = list.findIndex((e) => e.id === (anchor ?? to));
    const b = list.findIndex((e) => e.id === to);
    const [x, y] = a <= b ? [a, b] : [b, a];
    return list.slice(Math.max(0, x), y + 1).map((e) => e.id);
  };
  const rowClick = (ev: MouseEvent, id: string) => {
    if (held.current) { held.current = false; return; }
    if (ev.shiftKey) { mark(between(id), true); return; }
    if (ev.ctrlKey || ev.metaKey || choosing) { mark([id], !picked.has(id)); setAnchor(id); return; }
    onOpen(id);
  };
  const rowKey = (k: KeyboardEvent, id: string) => {
    if (k.key === ' ') { k.preventDefault(); mark([id], !picked.has(id)); setAnchor(id); }
    else if (k.key === 'Enter') { if (choosing) mark([id], !picked.has(id)); else onOpen(id); }
  };
  const stopHold = () => { if (holding.current !== null) { window.clearTimeout(holding.current); holding.current = null; } };
  const pageIds = list.slice(page * per, page * per + per).map((e) => e.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => picked.has(id));

  return (
    <div className="cg">
      <p className="cg-muted cg-select-hint">Zaznaczanie: pole wyboru, Ctrl+klik, Shift+klik albo przeciągnięcie po polach wyboru; na telefonie przytrzymaj wpis.</p>
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
              <th className="cg-pick-cell"><input type="checkbox" checked={allOnPage} aria-label="Zaznacz wszystkie na tej stronie" onChange={() => mark(pageIds, !allOnPage)} /></th>
              <th><button type="button" onClick={() => onSort('_label')}>Wpis{arrow('_label')}</button></th>
              <th>Rodzaj</th>
              {columns.map((c) => <th key={c}><button type="button" onClick={() => onSort(c)}>{kindFields.find((f) => f.key === c)?.label ?? c}{arrow(c)}</button></th>)}
            </tr>
          </thead>
          <tbody>
            {list.slice(page * per, page * per + per).map((e) => (
              <tr key={e.id} className={`is-link${picked.has(e.id) ? ' is-picked' : ''}`} aria-selected={picked.has(e.id)} tabIndex={0}
                onClick={(ev) => rowClick(ev, e.id)} onKeyDown={(k) => rowKey(k, e.id)}
                onMouseDown={(ev) => { if (ev.shiftKey) ev.preventDefault(); }}
                onMouseEnter={() => { if (painting.current !== null) mark([e.id], painting.current); }}
                onPointerDown={(ev) => {
                  if (ev.pointerType !== 'touch') return;
                  stopHold();
                  holding.current = window.setTimeout(() => { held.current = true; mark([e.id], true); setAnchor(e.id); navigator.vibrate?.(15); }, 500);
                }}
                onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}
                onContextMenu={(ev) => { if (held.current) ev.preventDefault(); }}>
                <td className="cg-pick-cell"
                  onMouseDown={(ev) => { ev.preventDefault(); const on = !picked.has(e.id); painting.current = on; mark([e.id], on); setAnchor(e.id); }}
                  onClick={(ev) => ev.stopPropagation()}>
                  <input type="checkbox" checked={picked.has(e.id)} tabIndex={-1} aria-label={`Zaznacz: ${lib.label(e)}`}
                    onClick={(ev) => ev.preventDefault()} onChange={() => undefined} />
                </td>
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

/** 2026-10-22 (Schritt 9) — das Drzewo nach den Gruppen des Widoku: nach einem Feld oder einer Achse von Tematy. */
function GroupTree({ groups, onOpen }: { groups: readonly Group[]; onOpen: (id: string) => void }) {
  const { lib } = useCtx();
  return (
    <ul className="cg-tree">
      {groups.map((g) => (
        <li key={g.key || '#reszta'}>
          <details open={groups.length < 8}>
            <summary><strong>{g.label}</strong> <span className="cg-muted">({g.ids.length})</span></summary>
            <ul className="cg-tree">
              {g.ids.slice(0, 500).map((id) => {
                const e = lib.entity(id);
                return e === undefined ? null : <li key={id}><button type="button" className="cg-ref" onClick={() => onOpen(id)}>{lib.label(e)}</button> <OriginTag id={id} /></li>;
              })}
            </ul>
          </details>
        </li>
      ))}
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
