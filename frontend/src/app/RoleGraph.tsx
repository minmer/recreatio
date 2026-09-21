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

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background, Controls, Handle, Position, useNodesState,
  type Connection, type Edge, type Node, type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { Ring, SealedRole } from './keys';
import {
  addHolder, createRole, dropHolder, EDGE_KINDS, renameRole, retypeRole, revokeRole,
  type EdgeKind, type NewKind, type RoleEdge, type RoleGraphData
} from './roles';
import { forgetKeys, keysFor } from './ringOf';
import { WorkspaceError, type Who } from './session';
import { Unlock } from './Unlock';

type Kind = 'person' | 'role' | 'group';

/**
 * Drei Arten, und der Unterschied ist keiner der Technik:
 *
 *   Osoba   ein Mensch — das Konto selbst, entsteht mit ihm
 *   Rola    eine Funktion, die jemand ausübt und die übergeben wird
 *   Grupa   die, die dazugehören
 */
const KIND_NAME: Record<Kind, string> = {
  person: 'Osoba',
  role: 'Rola',
  group: 'Grupa'
};

interface NodeData {
  readonly label: string;
  readonly kind: Kind;
  readonly personal: boolean;
  readonly locked: boolean;
}

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
 * Die drei Punkte an jeder Seite eines Knotens — wie im Altbestand
 * (`roleGraphConfig.ts`), und mit derselben Bedeutung.
 *
 * <code>
 *   holds   führen: ändern, weitergeben, aufnehmen   (dort „Owner")
 *   write   eintragen, was der Rolle gehört
 *   read    hineinsehen
 * </code>
 *
 * <b>Warum drei Punkte und nicht ein Punkt mit Auswahl danach.</b> Die Stufe
 * gehört zu der Geste, mit der die Kante entsteht — wer zieht, hat sie schon
 * im Kopf. Ein Dialog hinterher fragt nach etwas, das längst entschieden ist,
 * und verlegt die Antwort an eine Stelle, an der man den Graphen nicht mehr
 * sieht.
 *
 * <b>Die Reihenfolge ist die Ordnung</b> — oben das Stärkste. Sie stimmt mit
 * der Leiter überein (3.5), und `certify` steht bewusst NICHT dabei: das ist
 * eine Sache der Bereiche, nicht der Rollen.
 */
const DOTS = [
  { kind: 'holds' as const, name: 'prowadzi', colour: '#1d4ed8' },
  { kind: 'write' as const, name: 'pisze', colour: '#b3401f' },
  { kind: 'read' as const, name: 'czyta', colour: '#0284c7' }
];

/** Der Abstand zwischen den Punkten — genug, um nicht danebenzugreifen. */
const DOT_GAP = 18;

/** Ausserhalb der Komponente: React Flow vergleicht die Typen mit `===`. */
const NODE_TYPES = { role: RoleNode };

function RoleNode({ data, selected }: NodeProps<NodeData>) {
  return (
    <div
      className={`wk-node${data.personal ? ' wk-node-me' : ''}${data.locked ? ' wk-node-locked' : ''}${selected ? ' wk-node-on' : ''}`}
      style={{ minHeight: `${(DOTS.length - 1) * DOT_GAP + 52}px` }}
    >
      {DOTS.map((dot, at) => {
        /* Mittig um die Zeilenmitte herum, damit der Knoten nicht kopflastig wird. */
        const offset = (at - (DOTS.length - 1) / 2) * DOT_GAP;

        return (
          <Fragment key={dot.kind}>
            <Handle
              id={`in-${dot.kind}`}
              type="target"
              position={Position.Left}
              className="wk-dot"
              style={{ top: `calc(50% + ${offset}px)`, background: dot.colour }}
              title={`${dot.name} — tu przyjmij`}
            />
            <Handle
              id={`out-${dot.kind}`}
              type="source"
              position={Position.Right}
              className="wk-dot"
              style={{ top: `calc(50% + ${offset}px)`, background: dot.colour }}
              title={`${dot.name} — stąd pociągnij`}
            />
          </Fragment>
        );
      })}

      <span className="wk-node-name">{data.label}</span>
      <small className="wk-node-kind">{KIND_NAME[data.kind]}</small>
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
      // Der Bund wird EINMAL gebaut und geteilt (`ringOf.ts`): das
      // Seitenformular unterschreibt damit Zertifikate, diese Ansicht öffnet
      // damit Namen.
      const { ring: bund, graph } = await keysFor(who);

      setData(graph);
      setRing(bund);
      setNames(bund === null ? new Map() : await bund.names());
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
          label: names.get(role.id) ?? (ring?.has(role.id) === true ? 'bez nazwy' : 'zapieczętowane'),
          kind: role.kind,
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
  /*
   * BEIM LOSLASSEN GESPEICHERT, nicht bei jedem Pixel. Ein Zug erzeugt Dutzende
   * Änderungen; jede davon zu schreiben hiesse, für eine einzige Geste
   * hundertmal in den Speicher zu greifen.
   */
  const onDropped = useCallback(
    () => keepSpots(who.accountId, nodes), [who.accountId, nodes]);

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

  return (
    <>
      <p className="wk-lede">
        Rola to nie osoba: to, na co można przepisać odpowiedzialność. Człowiek
        odchodzi, urząd zostaje. Strzałka prowadzi od tego, kto trzyma, do tego,
        co jest trzymane — pociągnij ją, żeby przekazać rolę dalej.
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

      {/*
        WAS DIE STUFEN HEUTE SIND, ehrlich gesagt. Für Rollen, die noch in der
        alten Form liegen (`keyLayout === 0`), öffnet EIN Schlüssel alles —
        dort sind „pisze" und „czyta" Hausregeln und keine Schranke. Das zu
        verschweigen hiesse, eine Sicherheit zu behaupten, die für diese Rollen
        nicht gilt.
      */}
      {data.roles.some((r) => r.keyLayout === 0) && (
        <p className="wk-note">
          Część ról powstała, zanim rozdzielono czytanie od podpisywania. Dla nich
          „pisze" i „czyta" są ustaleniem, nie zamkiem — kto je czyta, może też
          działać w ich imieniu. Nowe role nie mają już tego problemu.
        </p>
      )}

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

/* -- Was man mit einer Rolle tun kann ---------------------------------------
 *
 * Das Entsperren steht nicht mehr hier, sondern in `Unlock.tsx`: es wird an
 * zwei Stellen gebraucht — hier für die Namen, im Seitenformular für die
 * Unterschrift unter einem Zertifikat.
 */

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
  const [newKind, setNewKind] = useState<NewKind>('role');

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
                onClick={() => void onAct('Zmiana rodzaju…',
                  () => retypeRole(role.id, role.kind === 'role' ? 'group' : 'role'))}
              >
                Zmień na {role.kind === 'role' ? 'grupę' : 'rolę'}
              </button>
            </div>
          )}

          <h3 className="wk-h2">Kto trzyma</h3>
          <ul className="wk-list">
            {holders.length === 0 && <li className="wk-empty">Nikt — to korzeń Twojego konta.</li>}
            {holders.map((edge) => {
              const dot = DOTS.find((d) => d.kind === edge.edgeKind) ?? DOTS[0];

              /*
               * NUR DIE FÜHRENDEN sind Halter. Eine Lese- oder Schreibkante
               * abzugeben nimmt niemandem den Schlüssel — die Warnung „das ist
               * der letzte" gilt für sie nicht, und der Knopf darf deshalb auch
               * dann dastehen, wenn es nur eine gibt.
               */
              const holding = holders.filter((e) => e.edgeKind === 'holds');
              const last = edge.edgeKind === 'holds' && holding.length <= 1;

              return (
                <li className="wk-row" key={edge.id}>
                  <span>
                    {label(edge.fromRoleId)}
                    <span className="wk-dot-key" style={{ marginLeft: '.5rem' }}>
                      <i style={{ background: dot.colour }} />
                      {dot.name}
                    </span>
                  </span>

                  {!last && (
                    <button
                      type="button" className="wk-link-btn" disabled={busy}
                      onClick={() => void onAct(`Odbieranie: ${dot.name}…`,
                        () => dropHolder(role.id, edge.fromRoleId, edge.edgeKind as EdgeKind))}
                    >
                      Odbierz
                    </button>
                  )}
                </li>
              );
            })}
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
              <select value={newKind} onChange={(e) => setNewKind(e.target.value as NewKind)}>
                <option value="person">Osoba — konkretny człowiek</option>
                <option value="role">Rola — funkcja, którą ktoś pełni</option>
                <option value="group">Grupa — ci, którzy do niej należą</option>
              </select>
            </label>

            {/*
              Der Unterschied, der später zählt: eine Person geht, ein Amt
              bleibt. Wer beides gleich anlegt, kann die Frage „wer hat das
              damals gemacht" nicht mehr von „wer macht das heute" trennen.
            */}
            {newKind === 'person' && (
              <p className="wk-hint">
                Osoba to człowiek, nie funkcja. Jeśli chodzi Ci o coś, co można
                komuś przekazać — wybierz „Rola".
              </p>
            )}

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
