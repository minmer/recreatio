/**
 * MAPA BIBLIOTEKI (0072) — wer woran hängt: Texte an Projekten und Themen,
 * Zitate an Werken, Werke an Autoren, und was ein Text zitiert.
 *
 * <b>Bearbeiten durch Ziehen</b> — so weit die Verweise FELDER sind (Projekt,
 * Themen, Werk eines Zitats, Autoren eines Werks …): eine Linie setzt den
 * Verweis, wenn das Feld auf diese Art zeigen darf (`LibField.to`); eine
 * gelöschte nimmt ihn weg. Zitate IM TEXT (`[@schlüssel]`) sind grau: sie
 * stehen im Text und werden dort geändert.
 */

import { useMemo, useState } from 'react';
import ReactFlow, {
  Background, Controls, Handle, MiniMap, Position,
  type Connection, type Edge, type Node, type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';

import { ids, kindOf, str, type EntryData } from './libraryKinds';
import { citedKeys } from './libraryMarkup';
import type { Entry, LibraryStore } from './libraryStore';
import { viewPath } from './routes';
import { WorkspaceError } from './session';

const COLUMN: Record<string, number> = { project: 0, text: 1, topic: 1, quote: 2, work: 3, person: 4 };

interface Data { readonly label: string; readonly kind: string; readonly id: string }

function Box({ data }: NodeProps<Data>) {
  return (
    <div className={`wk-dep-node is-lib-${data.kind}`}>
      <Handle type="target" position={Position.Left} />
      <span className="wk-dep-kind">{kindOf(data.kind)?.label ?? data.kind}</span>
      <strong>{data.label}</strong>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const NODE_TYPES = { box: Box };

/** Das Feld eines Eintrags, das auf diese Art zeigen darf — das erste. */
function fieldFor(kind: string, target: string): { key: string; many: boolean; label: string } | null {
  const field = kindOf(kind)?.fields.find((f) => (f.type === 'ref' || f.type === 'refs') && (f.to ?? []).includes(target));
  return field === undefined ? null : { key: field.key, many: field.type === 'refs', label: field.label };
}

export function LibraryMap({ store, libraryId }: { store: LibraryStore; libraryId: string }) {
  const [kinds, setKinds] = useState<ReadonlySet<string>>(new Set(['project', 'text', 'topic', 'quote', 'work', 'person']));
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const revision = store.revision;

  const { nodes, edges } = useMemo(() => {
    const entries = store.all().filter((e) => kinds.has(e.kind));
    const shown = new Set(entries.map((e) => e.id));
    const rows = new Map<number, number>();
    const out: Node<Data>[] = entries.sort((a, b) => store.title(a).localeCompare(store.title(b), 'pl')).map((e) => {
      const col = COLUMN[e.kind] ?? 2;
      const row = rows.get(col) ?? 0;
      rows.set(col, row + 1);
      return { id: e.id, type: 'box', position: { x: col * 300, y: row * 70 + (e.kind === 'topic' ? 4000 : 0) }, data: { label: store.title(e), kind: e.kind, id: e.id } };
    });

    /* Themen unter die Texte, nicht dazwischen. */
    const textRows = rows.get(1) ?? 0;
    for (const n of out) if (n.data.kind === 'topic') n.position = { x: n.position.x, y: n.position.y - 4000 + textRows * 70 + 80 };

    const lines: Edge[] = [];
    for (const e of entries) {
      const def = kindOf(e.kind);
      for (const field of def?.fields ?? []) {
        if (field.type !== 'ref' && field.type !== 'refs') continue;
        for (const target of ids(e.data, field.key)) {
          if (!shown.has(target)) continue;
          lines.push({ id: `f:${e.id}:${field.key}:${target}`, source: e.id, target, label: field.label, data: { field: field.key, many: field.type === 'refs' } });
        }
      }
      if (e.kind === 'text') {
        for (const key of citedKeys(str(e.data, 'body'), str(e.data, 'further'))) {
          const target = store.byKey(key);
          if (target === undefined || !shown.has(target.id)) continue;
          lines.push({ id: `c:${e.id}:${target.id}`, source: e.id, target: target.id, label: 'cytuje', deletable: false, className: 'is-fixed', animated: false });
        }
      }
    }
    return { nodes: out, edges: lines };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, revision, kinds]);

  const update = async (entry: Entry, patch: EntryData) => {
    setBusy(true);
    setFailed(null);
    try {
      await store.save({ id: entry.id, kind: entry.kind, ...(entry.key === undefined ? {} : { key: entry.key }), data: { ...entry.data, ...patch } });
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  const onConnect = (c: Connection) => {
    const from = c.source === null ? undefined : store.get(c.source);
    const to = c.target === null ? undefined : store.get(c.target);
    if (from === undefined || to === undefined) return;
    const field = fieldFor(from.kind, to.kind);
    if (field === null) {
      setFailed(`${kindOf(from.kind)?.label ?? from.kind} nie odwołuje się do: ${kindOf(to.kind)?.label ?? to.kind}. (Cytat w tekście wstawiasz w treści: [@${to.key ?? 'klucz'}].)`);
      return;
    }
    const next = field.many ? [...new Set([...ids(from.data, field.key), to.id])] : [to.id];
    void update(from, { [field.key]: next });
  };

  const onEdgesDelete = (gone: readonly Edge[]) => {
    for (const edge of gone) {
      const info = edge.data as { field?: string; many?: boolean } | undefined;
      const from = store.get(edge.source);
      if (info?.field === undefined || from === undefined) continue;
      void update(from, { [info.field]: info.many === true ? ids(from.data, info.field).filter((x) => x !== edge.target) : [] });
    }
  };

  return (
    <div className="wk-dep">
      <p className="wk-hint">
        Przeciągnij linię, żeby ustawić odwołanie (tekst → projekt lub temat, cytat → źródło, źródło → autor). Zaznacz linię i naciśnij Delete,
        żeby je usunąć. Szare linie „cytuje" pochodzą z treści tekstu. Dwuklik otwiera wpis.
      </p>
      <div className="lib-map-kinds">
        {['project', 'text', 'topic', 'quote', 'work', 'person'].map((k) => (
          <label key={k} className="wk-check">
            <input type="checkbox" checked={kinds.has(k)} onChange={(e) => setKinds((was) => {
              const next = new Set(was); if (e.target.checked) next.add(k); else next.delete(k); return next;
            })} /> <span>{kindOf(k)?.plural}</span>
          </label>
        ))}
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy && <p className="wk-working">Zapisywanie…</p>}
      <div className="wk-dep-canvas">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={NODE_TYPES} onConnect={onConnect} onEdgesDelete={onEdgesDelete}
          onNodeDoubleClick={(_, node) => { window.location.hash = viewPath('library', libraryId, (node.data as Data).id); }}
          fitView minZoom={0.15} proOptions={{ hideAttribution: true }}>
          <Background />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default LibraryMap;
