/**
 * Der Rollengraph — sehen, anlegen, benennen, weitergeben, zurücknehmen.
 *
 * <b>Was hier zu sehen ist, ist das, wozu dieser Mensch die Schlüssel hat.</b>
 * Der Dienst gibt nur erreichbare Rollen heraus, und lesbar werden ihre Namen
 * erst hier: der Bund (`keys.ts`) läuft vom persönlichen Rollenschlüssel aus
 * durch die Zuteilungen. Eine Rolle ohne lesbaren Namen ist deshalb NICHT
 * namenlos — sie ist verschlossen, und die Oberfläche sagt das auch so.
 *
 * <b>Nach einem Neuladen ist der Bund leer.</b> Der PasswordKey liegt nur im
 * Speicher des Tabs (`session.ts`), also fragt diese Ansicht dann nach dem
 * Passwort. Angemeldet bleibt man dabei; es geht allein um die Schlüssel.
 *
 * <b>Eine Kante ziehen heisst weitergeben.</b> Von der haltenden Rolle zur
 * gehaltenen — dieselbe Richtung wie die Pfeile. Der Dienst lehnt ab, was einen
 * Kreis schlösse (3.14): zwei Rollen, die einander aufschliessen, hat niemand
 * je entschieden.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background, Controls, Handle, Position,
  type Connection, type Edge, type Node, type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';

import { openMasterKey, Ring, type SealedRole } from './keys';
import {
  addHolder, createRole, dropHolder, loadRoles, renameRole, retypeRole, revokeRole,
  type RoleEdge, type RoleGraphData
} from './roles';
import { heldPasswordKey, unlock, WorkspaceError, type Who } from './session';

type Kind = 'person' | 'office' | 'member';

const KIND_NAME: Record<Kind, string> = {
  person: 'Rola osobista',
  office: 'Urząd',
  member: 'Członkostwo'
};

interface NodeData {
  readonly label: string;
  readonly kind: Kind;
  readonly personal: boolean;
  readonly locked: boolean;
}

/** Ausserhalb der Komponente: React Flow vergleicht die Typen mit `===`. */
const NODE_TYPES = { role: RoleNode };

function RoleNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`wk-node${data.personal ? ' wk-node-me' : ''}${data.locked ? ' wk-node-locked' : ''}${selected ? ' wk-node-on' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="wk-handle" />
      <span className="wk-node-name">{data.label}</span>
      <small className="wk-node-kind">{KIND_NAME[data.kind]}</small>
      <Handle type="source" position={Position.Right} className="wk-handle" />
    </div>
  );
}

/**
 * Die Ebenen nach der längsten Kette: was hält, steht links von dem, was
 * gehalten wird. Kein Kräftemodell — bei einem Graphen ohne Kreise ist die
 * Tiefe die Aussage, und sie springt nicht bei jedem Neuladen herum.
 */
function place(roles: readonly SealedRole[], edges: readonly RoleEdge[]): Map<string, { x: number; y: number }> {
  const depth = new Map<string, number>(roles.map((r) => [r.id, 0]));
  const waiting = new Map<string, number>(roles.map((r) => [r.id, 0]));

  for (const edge of edges) {
    if (waiting.has(edge.toRoleId)) waiting.set(edge.toRoleId, (waiting.get(edge.toRoleId) ?? 0) + 1);
  }

  const queue = roles.filter((r) => (waiting.get(r.id) ?? 0) === 0).map((r) => r.id);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) continue;

    for (const edge of edges.filter((e) => e.fromRoleId === current)) {
      const next = (depth.get(current) ?? 0) + 1;
      if (next > (depth.get(edge.toRoleId) ?? 0)) depth.set(edge.toRoleId, next);

      const left = (waiting.get(edge.toRoleId) ?? 0) - 1;
      waiting.set(edge.toRoleId, left);
      if (left === 0) queue.push(edge.toRoleId);
    }
  }

  const rows = new Map<number, number>();
  const spots = new Map<string, { x: number; y: number }>();

  for (const role of roles) {
    const level = depth.get(role.id) ?? 0;
    const row = rows.get(level) ?? 0;
    rows.set(level, row + 1);
    spots.set(role.id, { x: 40 + level * 260, y: 30 + row * 110 });
  }

  return spots;
}

export function RoleGraph({ who }: { who: Who }) {
  const [data, setData] = useState<RoleGraphData | null | undefined>(undefined);
  const [ring, setRing] = useState<Ring | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const look = useCallback(async () => {
    try {
      const graph = await loadRoles();
      setData(graph);

      const passwordKey = heldPasswordKey();
      if (passwordKey === null || graph.personRoleId === null) { setRing(null); return; }

      const master = await openMasterKey(who.accountId, passwordKey, who.masterKeySealed);
      const bund = await Ring.walk(graph.personRoleId, master, graph.roles, graph.grants);

      setRing(bund);
      setNames(await bund.names());
      setFailed(null);
    } catch (e) {
      if (e instanceof WorkspaceError) { setData(null); setFailed(e.message); return; }

      // Der Dienst hat geantwortet, aber eine Hülle ging nicht auf: fast immer
      // ein PasswordKey aus einer anderen Anmeldung. Der Graph bleibt sichtbar.
      setRing(null);
    }
  }, [who]);

  useEffect(() => { void look(); }, [look]);

  const act = async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);

    try {
      await todo();
      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  const nodes: Node<NodeData>[] = useMemo(() => {
    if (data == null) return [];
    const spots = place(data.roles, data.edges);

    return data.roles.map((role) => ({
      id: role.id,
      type: 'role',
      position: spots.get(role.id) ?? { x: 40, y: 30 },
      selected: role.id === selected,
      data: {
        label: names.get(role.id) ?? (ring?.has(role.id) === true ? 'bez nazwy' : 'zapieczętowane'),
        kind: role.kind,
        personal: role.isPersonal,
        locked: ring?.has(role.id) !== true
      }
    }));
  }, [data, names, ring, selected]);

  const edges: Edge[] = useMemo(() => {
    if (data == null) return [];

    return data.edges.map((edge) => ({
      id: edge.id,
      source: edge.fromRoleId,
      target: edge.toRoleId,
      animated: false
    }));
  }, [data]);

  if (data === undefined) return <p className="wk-lede">Wczytywanie…</p>;

  if (data === null) {
    return (
      <>
        <p className="wk-error">{failed}</p>
        <p><button type="button" className="wk-btn" onClick={() => void look()}>Spróbuj ponownie</button></p>
      </>
    );
  }

  const role = data.roles.find((r) => r.id === selected) ?? null;
  const holders = selected === null ? [] : data.edges.filter((e) => e.toRoleId === selected);

  const onConnect = (c: Connection) => {
    if (ring === null || c.source === null || c.target === null) return;

    const holder = data.roles.find((r) => r.id === c.source);
    if (holder === undefined) return;

    void act('Przekazywanie…', () => addHolder(ring, c.target as string, holder));
  };

  return (
    <>
      <p className="wk-lede">
        Rola to nie osoba: to, na co można przepisać odpowiedzialność. Człowiek
        odchodzi, urząd zostaje. Strzałka prowadzi od tego, kto trzyma, do tego,
        co jest trzymane — pociągnij ją, żeby przekazać rolę dalej.
      </p>

      {ring === null && <Unlock who={who} onDone={() => void look()} />}

      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-hint">{busy}</p>}

      <div className="wk-graph-split">
        <div className="wk-graph">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelected(node.id)}
            onPaneClick={() => setSelected(null)}
            nodesDraggable={false}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <aside className="wk-side">
          {role === null ? (
            <p className="wk-empty">Kliknij rolę, żeby zobaczyć, co można z nią zrobić.</p>
          ) : (
            <Panel
              role={role}
              ring={ring}
              name={names.get(role.id) ?? null}
              holders={holders}
              names={names}
              busy={busy !== null}
              onAct={act}
            />
          )}
        </aside>
      </div>
    </>
  );
}

/* -- Die Schlüssel zurückholen ---------------------------------------------- */

function Unlock({ who, onDone }: { who: Who; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setFailed(null);

    try {
      await unlock(who.loginId, password);
      setPassword('');
      onDone();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć kluczy.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wk-note" onSubmit={(e) => { e.preventDefault(); if (!busy) void go(); }}>
      <p className="wk-hint">
        Nazwy ról są zapieczętowane. Klucz liczy się z hasła i zostaje tylko w
        tej karcie — po odświeżeniu strony trzeba go policzyć jeszcze raz.
      </p>

      <div className="wk-actions">
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          placeholder="Hasło"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="wk-btn" disabled={busy || password === ''}>
          {busy ? 'Liczenie klucza…' : 'Otwórz klucze'}
        </button>
      </div>

      {failed !== null && <p className="wk-error">{failed}</p>}
    </form>
  );
}

/* -- Was man mit einer Rolle tun kann --------------------------------------- */

function Panel({ role, ring, name, holders, names, busy, onAct }: {
  role: SealedRole;
  ring: Ring | null;
  name: string | null;
  holders: readonly RoleEdge[];
  names: ReadonlyMap<string, string>;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<'office' | 'member'>('office');

  const mine = ring !== null && ring.has(role.id);
  const label = (id: string) => names.get(id) ?? 'zapieczętowane';

  return (
    <>
      <h2 className="wk-h2">{name ?? (mine ? 'bez nazwy' : 'zapieczętowane')}</h2>
      <p className="wk-row-side">{KIND_NAME[role.kind]} · <code>{role.id.slice(0, 8)}</code></p>

      {!mine && (
        <p className="wk-empty">
          Tej roli nie masz otwartej — widzisz, że istnieje, ale nie jej nazwę
          ani jej wnętrza.
        </p>
      )}

      {mine && (
        <>
          {/* Umbenennen wirkt rückwirkend: der Name liegt an der Rolle, nicht
              als Kopie in allem, was sie je getan hat. */}
          <form
            className="wk-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim() !== '' && ring !== null) {
                void onAct('Zmiana nazwy…', () => renameRole(ring, role.id, draft)).then(() => setDraft(''));
              }
            }}
          >
            <label className="wk-field">
              <span>Nazwa</span>
              <input value={draft} placeholder={name ?? ''} onChange={(e) => setDraft(e.target.value)} />
            </label>
            <div className="wk-actions">
              <button type="submit" className="wk-btn" disabled={busy || draft.trim() === ''}>Zmień nazwę</button>
            </div>
            <p className="wk-hint">Nazwa działa wstecz — także nad tym, co ta rola zrobiła wcześniej.</p>
          </form>

          {role.kind !== 'person' && (
            <div className="wk-actions">
              <button
                type="button" className="wk-btn" disabled={busy}
                onClick={() => void onAct('Zmiana typu…',
                  () => retypeRole(role.id, role.kind === 'office' ? 'member' : 'office'))}
              >
                Zmień na {role.kind === 'office' ? 'członkostwo' : 'urząd'}
              </button>
            </div>
          )}

          <h3 className="wk-h2">Kto trzyma</h3>
          <ul className="wk-list">
            {holders.length === 0 && <li className="wk-empty">Nikt — to korzeń Twojego konta.</li>}
            {holders.map((edge) => (
              <li className="wk-row" key={edge.id}>
                <span>{label(edge.fromRoleId)}</span>
                {holders.length > 1 && (
                  <button
                    type="button" className="wk-link-btn" disabled={busy}
                    onClick={() => void onAct('Odbieranie…', () => dropHolder(role.id, edge.fromRoleId))}
                  >
                    Odbierz
                  </button>
                )}
              </li>
            ))}
          </ul>

          {/* Anlegen: die gewählte Rolle HÄLT die neue. Ohne Halter gäbe es eine
              Rolle, deren Schlüssel niemand hat. */}
          <h3 className="wk-h2">Nowa rola pod tą</h3>
          <form
            className="wk-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim() !== '' && ring !== null) {
                void onAct('Liczenie kluczy nowej roli…',
                  () => createRole(ring, role, { kind: newKind, name: newName }))
                  .then(() => setNewName(''));
              }
            }}
          >
            <label className="wk-field">
              <span>Nazwa</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </label>

            <label className="wk-field">
              <span>Rodzaj</span>
              <select value={newKind} onChange={(e) => setNewKind(e.target.value as 'office' | 'member')}>
                <option value="office">Urząd — przekazywalny</option>
                <option value="member">Członkostwo — przynależność</option>
              </select>
            </label>

            <div className="wk-actions">
              <button type="submit" className="wk-btn" disabled={busy || newName.trim() === ''}>Załóż rolę</button>
            </div>
            <p className="wk-hint">
              Powstają dwa klucze RSA-4096 — to potrwa kilka sekund.
            </p>
          </form>

          {!role.isPersonal && (
            <div className="wk-actions">
              <button
                type="button" className="wk-link-btn" disabled={busy}
                onClick={() => void onAct('Usuwanie…', () => revokeRole(role.id))}
              >
                Usuń tę rolę
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default RoleGraph;
