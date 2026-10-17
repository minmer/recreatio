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
import ReactFlow, { Background, Controls, useNodesState, type Connection, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';

import type { Ring, SealedRole } from '../core/keys';
import { addHolder, EDGE_KINDS, type EdgeKind, type RoleEdge, type RoleGraphData } from './roles';
import { forgetKeys, keysFor } from '../core/ringOf';
import { WorkspaceError, type Who } from '../core/session';
import { Unlock } from '../shell/Unlock';
import { Loading } from '../ui/Loading';
import { DOTS, NODE_TYPES, type NodeData } from './RoleNode';
import { AccountPanel, Panel } from './RolePanels';

/**
 * Wohin jemand die Knoten geschoben hat — je Konto, in DIESEM Browser.
 *
 * <b>Warum das hier liegen darf und nicht am Dienst.</b> Eine Anordnung ist
 * kein Teil der Rollenordnung: sie sagt nichts darüber, wer was hält, und zwei
 * Menschen dürfen dasselbe Haus verschieden anordnen. Sie am Dienst zu führen
 * hiesse, eine Ansichtssache zu gemeinsamer Wahrheit zu machen.
 *
 * <b>Es darf fehlschlagen.</b> Ein privates Fenster, gesperrte Website-Daten,
 * ein voller Speicher — alles davon endet hier in `catch`, und die Ansicht
 * rechnet dann einfach wieder von vorn. Eine Anordnung, die verlorengeht, ist
 * ärgerlich; eine Ansicht, die deswegen weiss bleibt, wäre kaputt.
 */
const SPOTS = 'rc.graph.spots';

type Spot = { x: number; y: number };

function savedSpots(accountId: string): Map<string, Spot> {
  try {
    const all = JSON.parse(localStorage.getItem(SPOTS) ?? '{}') as Record<string, Record<string, Spot>>;
    return new Map(Object.entries(all[accountId] ?? {}));
  } catch {
    return new Map();
  }
}

function forgetSpots(accountId: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(SPOTS) ?? '{}') as Record<string, unknown>;
    delete all[accountId];
    localStorage.setItem(SPOTS, JSON.stringify(all));
  } catch {
    // Nichts zu vergessen ist auch ein Ergebnis.
  }
}

function keepSpots(accountId: string, nodes: readonly Node<NodeData>[]): void {
  try {
    const all = JSON.parse(localStorage.getItem(SPOTS) ?? '{}') as Record<string, Record<string, Spot>>;

    all[accountId] = Object.fromEntries(
      nodes.map((n) => [n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) }]));

    localStorage.setItem(SPOTS, JSON.stringify(all));
  } catch {
    // Siehe oben: eine verlorene Anordnung ist kein Grund, irgendetwas abzubrechen.
  }
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
      // Der Bund wird EINMAL gebaut und geteilt (`ringOf.ts`): das
      // Seitenformular unterschreibt damit Zertifikate, diese Ansicht öffnet
      // damit Namen.
      const { ring: bund, graph } = await keysFor(who);

      /* Das Konto heisst „Konto" — auch dort, wo es als Halter einer Person genannt wird. */
      const opened = new Map(bund === null ? [] : await bund.names());
      if (graph.personRoleId !== null) opened.set(graph.personRoleId, 'Konto');

      setData(graph);
      setRing(bund);
      setNames(opened);
      setFailed(null);
    } catch (e) {
      setData(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać ról.');
    }
  }, [who]);

  useEffect(() => { void look(); }, [look]);

  const act = async (what: string, todo: () => Promise<unknown>) => {
    setBusy(what);
    setFailed(null);

    try {
      await todo();

      // Rollen oder Zuteilungen haben sich geändert: der zwischengespeicherte
      // Bund kennt den neuen Schlüssel sonst nicht.
      forgetKeys();
      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  /*
   * DIE KNOTEN LIEGEN IM ZUSTAND, nicht in einem `useMemo`.
   *
   * Aus einem Memo gerechnet sprängen sie bei jedem Neuladen der Daten an
   * ihren errechneten Platz zurück — man schöbe sie, und beim nächsten
   * Umbenennen stünden sie wieder in der Reihe. Was jemand angeordnet hat,
   * gehört ihm.
   */
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);

  useEffect(() => {
    if (data == null) { setNodes([]); return; }

    const computed = place(data.roles, data.edges);
    const kept = savedSpots(who.accountId);

    setNodes((before) => {
      const standing = new Map(before.map((n) => [n.id, n.position]));

      return data.roles.map((role) => ({
        id: role.id,
        type: 'role',

        /*
         * DREI QUELLEN, in dieser Reihenfolge: wo der Knoten gerade steht,
         * wo ihn jemand zuletzt abgelegt hat, und erst zuletzt der errechnete
         * Platz. So bleibt eine Anordnung über das Umbenennen hinweg stehen,
         * und eine NEUE Rolle bekommt trotzdem einen sinnvollen Platz statt
         * der linken oberen Ecke.
         */
        position: standing.get(role.id) ?? kept.get(role.id) ?? computed.get(role.id) ?? { x: 40, y: 30 },

        data: {
          label: role.isPersonal ? 'Konto'
            : names.get(role.id) ?? (ring?.has(role.id) === true ? 'bez nazwy' : 'zapieczętowane'),
          /* Am Zeiger erkannt: die Wurzel des Kontos (0040). */
          kind: role.isPersonal ? 'account' : role.kind,
          personal: role.isPersonal,
          locked: ring?.has(role.id) !== true
        }
      }));
    });
  }, [data, names, ring, who.accountId, setNodes]);

  /*
   * Ausgewählt wird über die Eigenschaft und nicht über einen Neuaufbau: sonst
   * liefe jeder Klick durch dieselbe Stelle, die die Plätze setzt, und ein
   * Klick verschöbe den Graphen.
   */
  const shown: Node<NodeData>[] = useMemo(
    () => nodes.map((n) => ({ ...n, selected: n.id === selected })),
    [nodes, selected]);

  const edges: Edge[] = useMemo(() => {
    if (data == null) return [];

    return data.edges.map((edge) => {
      const dot = DOTS.find((d) => d.kind === edge.edgeKind) ?? DOTS[0];

      /*
       * AN DIE PUNKTE GEHÄNGT, aus denen sie stammt — sonst liefen alle drei
       * Arten durch dieselbe Stelle und man sähe am Bild nicht mehr, was gilt.
       */
      return {
        id: edge.id,
        source: edge.fromRoleId,
        target: edge.toRoleId,
        sourceHandle: `out-${dot.kind}`,
        targetHandle: `in-${dot.kind}`,
        animated: false,
        style: { stroke: dot.colour, strokeWidth: 2 },
        label: dot.kind === 'holds' ? undefined : dot.name
      };
    });
  }, [data]);

  /*
   * BEIM LOSLASSEN GESPEICHERT, nicht bei jedem Pixel. Ein Zug erzeugt Dutzende
   * Änderungen; jede davon zu schreiben hiesse, für eine einzige Geste
   * hundertmal in den Speicher zu greifen.
   *
   * <b>Über den frühen Rückgaben, nicht darunter.</b> Stand er unter
   * „Wczytywanie…", lief der erste Aufruf ohne ihn und der nächste mit ihm —
   * React zählt die Haken je Aufruf und brach die Seite mit #310 ab.
   */
  const onDropped = useCallback(
    () => keepSpots(who.accountId, nodes), [who.accountId, nodes]);

  if (data === undefined) return <Loading label="Wczytywanie…" />;

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

  /**
   * Eine Kante entsteht — auf der Stufe des Punktes, aus dem gezogen wurde.
   *
   * <b>Die Stufe steckt im Anschluss</b> (`out-read`), nicht in einer Frage
   * hinterher: wer zieht, hat sie schon entschieden, und ein Dialog danach
   * verlegte die Antwort an eine Stelle ohne den Graphen davor.
   *
   * Wird ohne Punkt gezogen — was React Flow bei einem Klick ins Leere liefert —
   * gilt `holds`: das ist, was „przekazać" immer hiess.
   */
  const onConnect = (c: Connection) => {
    if (ring === null || c.source === null || c.target === null) return;

    const holder = data.roles.find((r) => r.id === c.source);
    if (holder === undefined) return;

    const from = (c.sourceHandle ?? '').replace(/^out-/, '');
    const kind = (EDGE_KINDS as readonly string[]).includes(from)
      ? (from as EdgeKind)
      : 'holds';

    const named = DOTS.find((d) => d.kind === kind)?.name ?? kind;

    void act(`Nadawanie: ${named}…`, () => addHolder(ring, c.target as string, holder, kind));
  };

  /*
   * WAS DER DIENST ABLEHNEN WÜRDE, lässt sich gar nicht erst ziehen (0040):
   * in das Konto hinein, und aus dem Konto zu etwas anderem als einer Person.
   */
  const fits = (c: Connection): boolean => {
    const from = data.roles.find((r) => r.id === c.source);
    const to = data.roles.find((r) => r.id === c.target);
    if (from === undefined || to === undefined || to.isPersonal) return false;

    return !from.isPersonal || (to.kind === 'person' && c.sourceHandle === 'out-holds');
  };

  return (
    <>
      <p className="wk-lede">
        Na górze jest konto — trzyma tylko osoby. Pod osobami wiszą role:
        to, na co można przepisać odpowiedzialność. Człowiek odchodzi, urząd
        zostaje. Strzałka prowadzi od tego, kto trzyma, do tego, co jest
        trzymane — pociągnij ją, żeby przekazać rolę dalej.
      </p>

      {/*
        DIE LEGENDE GEHÖRT NEBEN DEN GRAPHEN, nicht in eine Hilfe. Drei Farben
        ohne Erklärung sind drei Rätsel, und wer gerade ziehen will, schlägt
        nichts nach.
      */}
      <p className="wk-hint">
        {DOTS.map((dot) => (
          <span className="wk-dot-key" key={dot.kind}>
            <i style={{ background: dot.colour }} />
            {dot.name}
          </span>
        ))}
        {'— pociągnij z kropki tej wysokości, którą chcesz nadać.'}
      </p>

      {/*
        UMSTELLEN DARF MAN RÜCKGÄNGIG MACHEN. Wer die Knoten verschoben hat und
        den Überblick verliert, braucht einen Weg zurück — sonst ist die
        Beweglichkeit eine Falle statt einer Hilfe.
      */}
      <p className="wk-hint">
        Węzły można przesuwać — układ zostaje w tej przeglądarce.
        {' '}
        <button
          type="button"
          className="wk-link-btn"
          onClick={() => {
            forgetSpots(who.accountId);
            setNodes((was) => {
              if (data == null) return was;
              const fresh = place(data.roles, data.edges);
              return was.map((n) => ({ ...n, position: fresh.get(n.id) ?? n.position }));
            });
          }}
        >
          Ułóż od nowa
        </button>
      </p>

      {ring === null && (
        <Unlock
          who={who}
          why="Nazwy ról są zapieczętowane."
          onDone={() => void look()}
        />
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-hint">{busy}</p>}

      <div className="wk-graph-split">
        <div className="wk-graph">
          <ReactFlow
            nodes={shown}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            isValidConnection={fits}
            onNodeClick={(_, node) => setSelected(node.id)}
            onPaneClick={() => setSelected(null)}

            onNodeDragStop={onDropped}

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
          ) : role.isPersonal ? (
            <AccountPanel who={who} ring={ring} account={role} busy={busy !== null} onAct={act} />
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

export default RoleGraph;
