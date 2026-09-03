/**
 * Die Übersicht über das eigene Konto: welche Rollen es trägt und wie sie
 * zusammenhängen.
 *
 * <b>Warum eine Zeichnung und keine Liste.</b> Eine Liste beantwortet „was
 * habe ich" und verschweigt „worüber". Genau das ist aber die Frage, die
 * jemand hat, der wissen will, warum er etwas sehen darf: eine Rolle hängt an
 * einer anderen, und diese am Konto. Der Weg IST die Begründung — eine Liste
 * schneidet ihn weg und lässt nur das Ergebnis stehen.
 *
 * <b>Das Konto ist die Wurzel, nicht die Person.</b> Kanten mit
 * `from_account_id` gehen wirklich vom Konto aus (3.4). Zeichnete man die
 * persönliche Rolle als Wurzel, verschwände der Unterschied zwischen „das
 * Konto hält diese Rolle" und „diese Rolle trägt jene" — zwei Dinge mit zwei
 * verschiedenen Folgen beim Entzug.
 *
 * <b>Die Anordnung wird gerechnet, nicht gespeichert.</b> Der Graph kommt ohne
 * Koordinaten vom Server, und das ist richtig so: eine Position ist eine
 * Ansichtssache und gehört nicht in die Kette. Gerechnet wird nach Tiefe —
 * Spalte je Ebene, Zeile je Geschwister.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, MarkerType, type Edge, type Node } from 'reactflow';
import 'reactflow/dist/style.css';

import { rcAccountMap, type RcMapEdge, type RcMapNode } from './lib/rcPerson';
import { RcRequestError } from './lib/rcApi';
import { rcPath } from './lib/rcRoute';
import { rcCopy, rcFormat, type RcLang } from './i18n';

/** Ein Kasten. Breit genug für einen Namen, schmal genug für eine Reihe. */
const NODE_W = 190;
const NODE_H = 58;
const GAP_X = 90;
const GAP_Y = 26;

/**
 * Anordnung nach Tiefe.
 *
 * Der Server nennt zu jedem Knoten die Tiefe — die Länge des KÜRZESTEN Weges
 * vom Konto. Das ist genau die richtige Größe für eine Spalte: eine Rolle, die
 * auf zwei Wegen erreichbar ist, erscheint einmal, und zwar dort, wo sie am
 * schnellsten zu erreichen ist. Beide Kanten werden trotzdem gezeichnet, und
 * damit bleibt die zweite Erreichbarkeit sichtbar, ohne den Knoten zu doppeln.
 */
function place(nodes: readonly RcMapNode[]): Map<string, { x: number; y: number }> {
  const byDepth = new Map<number, RcMapNode[]>();
  for (const n of nodes) {
    const d = n.depth ?? 0;
    const row = byDepth.get(d);
    if (row) row.push(n); else byDepth.set(d, [n]);
  }

  const tallest = Math.max(1, ...[...byDepth.values()].map((r) => r.length));
  const out = new Map<string, { x: number; y: number }>();

  for (const [depth, row] of byDepth) {
    // Jede Spalte wird für sich zentriert: sonst kleben kurze Spalten oben und
    // die Zeichnung liest sich als Treppe statt als Baum.
    const span = row.length * NODE_H + (row.length - 1) * GAP_Y;
    const full = tallest * NODE_H + (tallest - 1) * GAP_Y;
    const top = (full - span) / 2;

    row.forEach((n, i) => {
      out.set(n.id, {
        x: (depth + 1) * (NODE_W + GAP_X),
        y: top + i * (NODE_H + GAP_Y)
      });
    });
  }
  return out;
}

export function RcAccountSection({
  lang, unlocked, onError
}: {
  lang: RcLang;
  unlocked: boolean;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].account;
  const tr = rcCopy[lang].roles;

  const [nodes, setNodes] = useState<readonly RcMapNode[]>([]);
  const [edges, setEdges] = useState<readonly RcMapEdge[]>([]);
  const [loaded, setLoaded] = useState(false);

  const describe = useCallback(
    (e: unknown): string =>
      e instanceof RcRequestError
        ? (rcCopy[lang].auth.errors[e.code] ?? rcCopy[lang].auth.unknownError)
        : rcCopy[lang].auth.unknownError,
    [lang]
  );

  useEffect(() => {
    if (!unlocked) return;
    let alive = true;
    void (async () => {
      try {
        const map = await rcAccountMap();
        if (!alive) return;
        setNodes(map.nodes ?? []);
        setEdges(map.edges ?? []);
        setLoaded(true);
      } catch (e) { if (alive) onError(describe(e)); }
    })();
    return () => { alive = false; };
  }, [unlocked, describe, onError]);

  const flowNodes: Node[] = useMemo(() => {
    const at = place(nodes);
    return nodes.map((n) => ({
      id: n.id,
      position: at.get(n.id) ?? { x: 0, y: 0 },
      data: { label: <NodeBody node={n} lang={lang} /> },
      // Ein Kasten, den man nicht verschieben kann, ist eine Zeichnung; einer,
      // den man verschieben kann, ist ein Werkzeug. Hier genügt die Zeichnung.
      draggable: false,
      connectable: false,
      type: n.isAccount ? 'input' : 'default',
      className: `rc-node rc-node-${n.kind}${n.hasKey ? '' : ' rc-node-nokey'}`,
      style: { width: NODE_W }
    }));
  }, [nodes, lang]);

  const flowEdges: Edge[] = useMemo(
    () => edges.map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      // Die Art der Kante ist die Begründung dafür, dass sie da ist — sie
      // gehört an die Kante und nicht in eine Legende, die niemand liest.
      label: tr.relations[e.relation as keyof typeof tr.relations] ?? e.relation,
      className: `rc-edge rc-edge-${e.relation}`,
      markerEnd: { type: MarkerType.ArrowClosed }
    })),
    [edges, tr]
  );

  if (!unlocked) return <p className="rc-note">{t.locked}</p>;
  if (!loaded) return <p className="rc-note">{t.loading}</p>;

  const persons = nodes.filter((n) => n.kind === 'person');

  return (
    <div className="rc-panel">
      <p className="rc-note">{rcFormat(t.lead, { roles: String(Math.max(0, nodes.length - 1)) })}</p>

      <div className="rc-flow">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/*
        DIE ZEICHNUNG IST NICHT DER EINZIGE WEG HINEIN.

        Ein Graph ist schön und mit der Tastatur kaum zu bedienen. Die Personen
        stehen deshalb noch einmal als Verweise darunter — dieselbe Auskunft,
        anders erreichbar. Das ist keine Doppelung aus Verlegenheit: wer mit
        einer Tastatur oder einem Vorleseprogramm arbeitet, kommt hier hinein
        und dort nicht.
      */}
      <h5 className="rc-sub">{t.personsHeading}</h5>
      {persons.length === 0 && <p className="rc-note">{t.noPersons}</p>}
      <ul className="rc-person-list">
        {persons.map((p) => (
          <li key={p.id}>
            <a className="rc-person-link" href={rcPath('person', p.id)}>
              <span className="rc-person-name">{p.name ?? t.unnamed}</span>
              <span className="rc-person-kind">{tr.kinds.person}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Der Inhalt eines Kastens: Art, Name, und ob der Schlüssel da ist. */
function NodeBody({ node, lang }: { node: RcMapNode; lang: RcLang }) {
  const t = rcCopy[lang].account;
  const tr = rcCopy[lang].roles;

  if (node.isAccount) {
    return (
      <div className="rc-node-in">
        <span className="rc-node-kind">{t.accountNode}</span>
        <strong className="rc-node-name">{t.accountYou}</strong>
      </div>
    );
  }

  return (
    <div className="rc-node-in">
      <span className="rc-node-kind">
        {tr.kinds[node.kind as keyof typeof tr.kinds] ?? node.kind}
      </span>
      <strong className="rc-node-name">{node.name ?? t.unnamed}</strong>

      {/* Ohne Schlüssel ist die Rolle erreichbar, aber nicht lesbar. Das ist
          ein Zustand, den man sehen muss — sonst wirkt ein leerer Name wie ein
          Fehler und nicht wie eine Grenze. */}
      {node.hasKey === false && <span className="rc-node-nokey-mark">{t.noKey}</span>}
    </div>
  );
}

export default RcAccountSection;

/** Derselbe Zuschnitt wie die uebrigen Teile: der Fehler steht unter der Ansicht. */
export function RcAccountOutlet({ lang, unlocked }: { lang: RcLang; unlocked: boolean }) {
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <RcAccountSection lang={lang} unlocked={unlocked} onError={setError} />
      {error !== null && <p className="rc-auth-error rc-chat-error">{error}</p>}
    </>
  );
}
