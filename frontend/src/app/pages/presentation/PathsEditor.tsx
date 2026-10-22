/**
 * 0089 — DIE KARTE DER WEGE einer Präsentation (React Flow).
 *
 * Jede Szene ist ein Knoten mit EINEM Eingang (links) und ihren Ausgängen
 * (rechts): „dalej" — die Pfeile, das Rad, der Finger — und je Knopf auf der
 * Szene einer. Ein Ausgang wird mit einer Szene verbunden, mit dem Ende oder
 * mit einem Weg hinaus (einer Seite im Netz oder hier). Unverbunden führt
 * „dalej" zur nächsten Szene der Liste — gestrichelt gezeichnet; ein
 * unverbundener Knopf führt nirgends hin.
 *
 * Dieselben Ziele lassen sich rechts in der Leiste wählen — wer nicht ziehen
 * will (oder kann: ein Telefon, eine Tastatur), wählt aus einer Liste.
 */

import { useMemo, useState } from 'react';
import ReactFlow, {
  Background, Controls, Handle, Position,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps
} from 'reactflow';
import 'reactflow/dist/style.css';

import { newId } from '../../core/ids';
import type { DraftPart } from '../page';
import { pieceLabelOf } from './PagePresentation';
import { readPiece, textLink, withPiece, type Show, type ShowLink } from './presentation';
import {
  autoMap, END, GATE, LINK, NEXT, reachable, resolveTarget, routeOf, targetLabel, targetOptions, withGo, withNext
} from './showPaths';
import { GateSettings, StoryPanel } from './StoryPanel';
import { GATE_LABEL, NO_STORY, outcomeKey, type Gate, type Outcome } from './story';

/* -- Die Knoten ------------------------------------------------------------------------- */

interface Exit {
  readonly id: string;
  readonly label: string;
}

type PathData =
  | { readonly kind: 'scene'; readonly index: number; readonly label: string; readonly start: boolean; readonly reached: boolean; readonly onRoute: boolean; readonly exits: readonly Exit[] }
  | { readonly kind: 'link'; readonly label: string; readonly href: string }
  /* 2026-10-21 — ein Tor des Przebiegs: eine Bedingung (tak / nie) oder ein Wert (dalej). */
  | { readonly kind: 'gate'; readonly label: string; readonly exits: readonly Exit[] }
  | { readonly kind: 'end' };

function PathNode({ data, selected }: NodeProps<PathData>) {
  if (data.kind === 'end') {
    return (
      <div className={`pm-node is-end${selected ? ' is-on' : ''}`}>
        <Handle id="in" type="target" position={Position.Left} className="pm-handle" />
        <strong>Koniec</strong>
      </div>
    );
  }
  if (data.kind === 'gate') {
    return (
      <div className={`pm-node is-gate${selected ? ' is-on' : ''}`}>
        <Handle id="in" type="target" position={Position.Left} className="pm-handle" />
        <strong>⑂ {data.label}</strong>
        <ul className="pm-exits">
          {data.exits.map((exit) => (
            <li key={exit.id} className="is-button">
              <span>{exit.label}</span>
              <Handle id={exit.id} type="source" position={Position.Right} className="pm-handle" title={exit.label} />
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (data.kind === 'link') {
    return (
      <div className={`pm-node is-link${selected ? ' is-on' : ''}`}>
        <Handle id="in" type="target" position={Position.Left} className="pm-handle" />
        <strong>↗ {data.label || 'Link'}</strong>
        <span className="pm-href">{data.href}</span>
      </div>
    );
  }
  return (
    <div className={`pm-node is-scene${selected ? ' is-on' : ''}${data.reached ? '' : ' is-unreached'}${data.onRoute ? ' is-route' : ''}`}>
      <Handle id="in" type="target" position={Position.Left} className="pm-handle" title="Wejście sceny" />
      <div className="pm-head">
        <span className="pm-num">{data.index + 1}</span>
        <strong>{data.label || 'Scena'}</strong>
        {data.start && <span className="pm-tag">początek</span>}
      </div>
      {!data.reached && <span className="pm-warn">nie da się tu dojść</span>}
      <ul className="pm-exits">
        {data.exits.map((exit) => (
          <li key={exit.id} className={exit.id === NEXT ? 'is-next' : 'is-button'}>
            <span>{exit.label}</span>
            <Handle id={exit.id} type="source" position={Position.Right} className="pm-handle" title={exit.label} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Ausserhalb der Komponente: React Flow vergleicht die Typen mit `===`. */
const NODE_TYPES = { path: PathNode };

/* -- Die Karte ---------------------------------------------------------------------------- */

export function PathsEditor({ show, parts, busy, onShow, onParts, onOpenScene }: {
  show: Show;
  parts: readonly DraftPart[];
  busy: boolean;
  onShow: (next: Show) => void;
  onParts: (next: readonly DraftPart[]) => void;
  /** Eine Szene zum Bearbeiten öffnen (Doppelklick, „Otwórz scenę"). */
  onOpenScene: (index: number) => void;
}) {
  const pieces = useMemo(() => parts.map((part) => ({ part, piece: readPiece(part.layout) })), [parts]);
  const reached = useMemo(() => reachable(show, pieces.map((p) => p.piece)), [show, pieces]);
  const route = useMemo(() => new Set(routeOf(show)), [show]);
  const auto = useMemo(() => autoMap(show, pieces.map((p) => p.piece)), [show, pieces]);
  const [moving, setMoving] = useState<Readonly<Record<string, { x: number; y: number }>>>({});
  const [chosen, setChosen] = useState<string | null>(null);
  const at = (id: string) => moving[id] ?? show.map[id] ?? auto[id] ?? { x: 0, y: 0 };

  /** Die Knöpfe einer Szene — Bausteine, die dort stehen und dort ein Ausgang sind. */
  const buttonsOf = (key: string) => pieces.filter((p) => p.part.kind !== 'question' && p.piece.places[key] !== undefined && p.piece.go[key] !== undefined);
  /** 2026-10-21 — die Fragen einer Szene: je eine für „dobrze" und eine für „źle". */
  const questionsOn = (key: string) => pieces.filter((p) => p.part.kind === 'question' && p.piece.places[key] !== undefined);
  const story = show.story ?? NO_STORY;
  const gateExits = (gate: Gate): Exit[] => (gate.type === 'condition'
    ? [{ id: 'yes', label: 'tak' }, { id: 'no', label: 'nie' }]
    : [{ id: NEXT, label: 'dalej' }]);

  const nodes: Node<PathData>[] = [
    ...show.scenes.map((sc, index): Node<PathData> => ({
      id: sc.key,
      type: 'path',
      position: at(sc.key),
      selected: chosen === sc.key,
      data: {
        kind: 'scene', index, label: sc.label, start: index === 0, reached: reached.has(sc.key), onRoute: route.has(sc.key),
        exits: [
          { id: NEXT, label: 'Dalej — strzałki, przewijanie' },
          ...buttonsOf(sc.key).map((p) => ({ id: p.part.id, label: `Przycisk: ${pieceLabelOf(p.part)}` })),
          ...questionsOn(sc.key).flatMap((p) => [
            { id: `${p.part.id}:right`, label: `Dobrze: ${pieceLabelOf(p.part)}` },
            { id: `${p.part.id}:wrong`, label: `Źle: ${pieceLabelOf(p.part)}` }
          ])
        ]
      }
    })),
    ...story.gates.map((gate): Node<PathData> => ({
      id: `${GATE}${gate.key}`, type: 'path', position: at(`${GATE}${gate.key}`), selected: chosen === `${GATE}${gate.key}`,
      data: { kind: 'gate', label: gate.label || GATE_LABEL[gate.type], exits: gateExits(gate) }
    })),
    ...show.links.map((link): Node<PathData> => ({
      id: `${LINK}${link.id}`, type: 'path', position: at(`${LINK}${link.id}`), selected: chosen === `${LINK}${link.id}`,
      data: { kind: 'link', label: link.label, href: link.href }
    })),
    { id: END, type: 'path', position: at(END), selected: chosen === END, data: { kind: 'end' } }
  ];

  /** Wohin ein Ziel in der Karte zeigt — der Knoten. */
  const nodeOf = (said: string): string | null => {
    const t = resolveTarget(show, said);
    return t.kind === 'scene' ? t.key : t.kind === 'link' ? `${LINK}${t.link.id}` : t.kind === 'gate' ? `${GATE}${t.key}` : t.kind === 'end' ? END : null;
  };

  const edges: Edge[] = show.scenes.flatMap((sc, i): Edge[] => {
    const out: Edge[] = [];
    const own = sc.next === null ? null : nodeOf(sc.next);
    if (own !== null) {
      out.push({ id: `n|${sc.key}`, source: sc.key, sourceHandle: NEXT, target: own, targetHandle: 'in', className: 'pm-edge is-next' });
    } else {
      /* Unverbunden: die nächste der Liste (oder das Ende) — gestrichelt; wer die Linie löscht, macht hier Schluss. */
      const after = show.scenes[i + 1];
      out.push({ id: `d|${sc.key}`, source: sc.key, sourceHandle: NEXT, target: after?.key ?? END, targetHandle: 'in', className: 'pm-edge is-default', animated: false });
    }
    for (const p of buttonsOf(sc.key)) {
      const target = nodeOf(p.piece.go[sc.key] ?? '');
      if (target !== null) out.push({ id: `b|${sc.key}|${p.part.id}`, source: sc.key, sourceHandle: p.part.id, target, targetHandle: 'in', className: 'pm-edge is-button' });
    }
    for (const p of questionsOn(sc.key)) {
      for (const outcome of ['right', 'wrong'] as const) {
        const target = nodeOf(p.piece.go[outcomeKey(sc.key, outcome)] ?? '');
        if (target !== null) out.push({ id: `o|${sc.key}|${p.part.id}|${outcome}`, source: sc.key, sourceHandle: `${p.part.id}:${outcome}`, target, targetHandle: 'in', className: `pm-edge is-${outcome}` });
      }
    }
    return out;
  }).concat(story.gates.flatMap((gate): Edge[] => {
    const from = `${GATE}${gate.key}`;
    const exits: [string, string | null][] = gate.type === 'condition' ? [['yes', gate.yes], ['no', gate.no]] : [[NEXT, gate.next]];
    return exits.flatMap(([exit, said]) => {
      const target = said === null ? null : nodeOf(said);
      return target === null ? [] : [{ id: `g|${gate.key}|${exit}`, source: from, sourceHandle: exit, target, targetHandle: 'in', className: `pm-edge is-gate is-${exit}` }];
    });
  }));

  /* -- Ziele setzen --------------------------------------------------------------------- */

  const setNext = (key: string, target: string | null) =>
    onShow({ ...show, scenes: show.scenes.map((sc) => (sc.key === key ? withNext(sc, target) : sc)) });

  const setButton = (sceneKey: string, partId: string, target: string | undefined) =>
    onParts(parts.map((part) => (part.id === partId ? { ...part, layout: withPiece(part.layout, withGo(readPiece(part.layout), sceneKey, target)) } : part)));

  /** 2026-10-21 — der Ausgang einer Frage für ein Ergebnis auf dieser Szene. */
  const setOutcome = (sceneKey: string, partId: string, outcome: Outcome, target: string | undefined) =>
    onParts(parts.map((part) => (part.id === partId ? { ...part, layout: withPiece(part.layout, withGo(readPiece(part.layout), outcomeKey(sceneKey, outcome), target)) } : part)));

  /** 2026-10-21 — ein Tor ändern (oder weg damit, samt allem, was auf es zeigt). */
  const setGate = (key: string, next: Gate | null) => {
    const ref = `${GATE}${key}`;
    const clear = (t: string | null) => (t === ref ? null : t);
    onShow({
      ...show,
      scenes: next !== null ? show.scenes : show.scenes.map((sc) => (sc.next === ref ? withNext(sc, null) : sc)),
      story: {
        ...story,
        gates: next !== null
          ? story.gates.map((g) => (g.key === key ? next : g))
          : story.gates.filter((g) => g.key !== key).map((g) => (g.type === 'set' ? { ...g, next: clear(g.next) } : { ...g, yes: clear(g.yes), no: clear(g.no) }))
      }
    });
    if (next === null) {
      onParts(parts.map((part) => {
        const piece = readPiece(part.layout);
        if (!Object.values(piece.go).includes(ref)) return part;
        const go = Object.fromEntries(Object.entries(piece.go).map(([k, t]) => [k, t === ref ? '' : t]));
        return { ...part, layout: withPiece(part.layout, { ...piece, go }) };
      }));
      setChosen(null);
    }
  };
  const setGateExit = (key: string, exit: string, target: string | null) => {
    const gate = story.gates.find((g) => g.key === key);
    if (gate === undefined) return;
    setGate(key, gate.type === 'set' ? { ...gate, next: target } : exit === 'yes' ? { ...gate, yes: target } : { ...gate, no: target });
  };

  const connect = (c: Connection) => {
    if (busy || c.source === null || c.target === null || c.sourceHandle === null) return;
    const target = c.target;
    if (c.source.startsWith(GATE)) { setGateExit(c.source.slice(GATE.length), c.sourceHandle, target); return; }
    const outcome = /^(.+):(right|wrong)$/.exec(c.sourceHandle);
    if (outcome !== null) { setOutcome(c.source, outcome[1], outcome[2] === 'right' ? 'right' : 'wrong', target); return; }
    if (c.sourceHandle === NEXT) setNext(c.source, target);
    else setButton(c.source, c.sourceHandle, target);
  };

  const edgeChanges = (changes: EdgeChange[]) => {
    for (const ch of changes) {
      if (ch.type !== 'remove' || busy) continue;
      const [kind, scene, part, outcome] = ch.id.split('|');
      if (kind === 'n') setNext(scene, null);
      else if (kind === 'd') setNext(scene, END);
      else if (kind === 'b') setButton(scene, part, '');
      else if (kind === 'o') setOutcome(scene, part, outcome === 'right' ? 'right' : 'wrong', undefined);
      else if (kind === 'g') setGateExit(scene, part, null);
    }
  };

  const nodeChanges = (changes: NodeChange[]) => {
    for (const ch of changes) {
      if (ch.type === 'position' && ch.position !== undefined) {
        const { id, position } = ch;
        setMoving((was) => ({ ...was, [id]: { x: Math.round(position.x), y: Math.round(position.y) } }));
      }
      if (ch.type === 'select') setChosen((was) => (ch.selected ? ch.id : was === ch.id ? null : was));
    }
  };

  /** Losgelassen: der Platz gilt — gespeichert mit der Präsentation. */
  const dropped = (id: string) => {
    const spot = moving[id];
    if (spot === undefined) return;
    onShow({ ...show, map: { ...show.map, [id]: spot } });
    setMoving(({ [id]: _gone, ...rest }) => { void _gone; return rest; });
  };

  /* -- Wege hinaus ---------------------------------------------------------------------- */

  const [label, setLabel] = useState('');
  const [href, setHref] = useState('');
  const linkOk = textLink(href) !== null;

  const addLink = () => {
    const made = textLink(href);
    if (made === null) return;
    const link: ShowLink = { id: newId().replace(/-/g, '').slice(0, 8), label: label.trim(), href: made };
    onShow({ ...show, links: [...show.links, link] });
    setLabel('');
    setHref('');
    setChosen(`${LINK}${link.id}`);
  };

  const dropLink = (id: string) => {
    const ref = `${LINK}${id}`;
    onShow({
      ...show,
      links: show.links.filter((one) => one.id !== id),
      scenes: show.scenes.map((sc) => (sc.next === ref ? withNext(sc, null) : sc))
    });
    onParts(parts.map((part) => {
      const piece = readPiece(part.layout);
      if (!Object.values(piece.go).includes(ref)) return part;
      const go = Object.fromEntries(Object.entries(piece.go).map(([k, t]) => [k, t === ref ? '' : t]));
      return { ...part, layout: withPiece(part.layout, { ...piece, go }) };
    }));
    setChosen(null);
  };

  const setLink = (id: string, patch: Partial<ShowLink>) =>
    onShow({ ...show, links: show.links.map((one) => (one.id === id ? { ...one, ...patch } : one)) });

  /* -- Zeichnen ------------------------------------------------------------------------- */

  const options = targetOptions(show);
  const scene = show.scenes.find((sc) => sc.key === chosen);
  const sceneIndex = scene === undefined ? -1 : show.scenes.indexOf(scene);
  const link = show.links.find((one) => `${LINK}${one.id}` === chosen);
  const gate = chosen !== null && chosen.startsWith(GATE) ? story.gates.find((g) => g.key === chosen.slice(GATE.length)) : undefined;

  return (
    <section className="pm" aria-label="Przejścia między scenami">
      <div className="pm-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={nodeChanges}
          onEdgesChange={edgeChanges}
          onConnect={connect}
          onNodeDragStop={(_, node) => dropped(node.id)}
          onNodeDoubleClick={(_, node) => { const i = show.scenes.findIndex((sc) => sc.key === node.id); if (i >= 0) onOpenScene(i); }}
          onPaneClick={() => setChosen(null)}
          deleteKeyCode={['Delete', 'Backspace']}
          nodesConnectable={!busy}
          fitView
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <aside className="pm-side">
        {scene !== undefined ? (
          <div className="wk-form">
            <h3 className="wk-h2">{sceneIndex + 1}. {scene.label || 'Scena'}</h3>
            {!reached.has(scene.key) && <p className="wk-warn">Do tej sceny nie prowadzi żaden przycisk ani „dalej” — nikt jej nie zobaczy.</p>}
            <label className="wk-field">
              <span>„Dalej” — strzałki, przewijanie, spacja — prowadzi do</span>
              <select value={scene.next ?? ''} disabled={busy} data-pm-next={scene.key} onChange={(e) => setNext(scene.key, e.target.value === '' ? null : e.target.value)}>
                <option value="">następnej na liście ({targetLabel(show, show.scenes[sceneIndex + 1]?.key ?? END, 'Koniec')})</option>
                {options.filter((o) => o.value !== scene.key).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            <h4 className="pb-h">Przyciski na tej scenie</h4>
            {pieces.filter((p) => p.piece.places[scene.key] !== undefined).length === 0 && <p className="wk-hint">Na tej scenie nie ma modułów.</p>}
            <ul className="pm-buttons">
              {pieces.filter((p) => p.piece.places[scene.key] !== undefined).map((p) => {
                const on = p.piece.go[scene.key] !== undefined;
                return (
                  <li key={p.part.id}>
                    <label className="wk-check">
                      <input type="checkbox" checked={on} disabled={busy} data-pm-button={p.part.id}
                        onChange={(e) => setButton(scene.key, p.part.id, e.target.checked ? '' : undefined)} />
                      <span>{pieceLabelOf(p.part)}</span>
                    </label>
                    {on && (
                      <select value={p.piece.go[scene.key] ?? ''} disabled={busy} aria-label={`${pieceLabelOf(p.part)} prowadzi do`} data-pm-go={p.part.id}
                        onChange={(e) => setButton(scene.key, p.part.id, e.target.value)}>
                        <option value="">— nigdzie (jeszcze) —</option>
                        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )}
                  </li>
                );
              })}
            </ul>
            {questionsOn(scene.key).length > 0 && (
              <>
                <h4 className="pb-h">Pytania na tej scenie</h4>
                {questionsOn(scene.key).map((p) => (
                  <div key={p.part.id} className="pm-question">
                    <strong>{pieceLabelOf(p.part)}</strong>
                    {(['right', 'wrong'] as const).map((outcome) => (
                      <label key={outcome} className="wk-field">
                        <span>{outcome === 'right' ? 'Po dobrej odpowiedzi' : 'Po złej odpowiedzi'}</span>
                        <select value={p.piece.go[outcomeKey(scene.key, outcome)] ?? ''} disabled={busy} data-pm-outcome={`${p.part.id}:${outcome}`}
                          onChange={(e) => setOutcome(scene.key, p.part.id, outcome, e.target.value === '' ? undefined : e.target.value)}>
                          <option value="">tak jak „dalej” tej sceny</option>
                          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                ))}
              </>
            )}
            <div className="wk-actions">
              <button type="button" className="wk-link-btn" onClick={() => onOpenScene(sceneIndex)}>Otwórz scenę</button>
            </div>
          </div>
        ) : gate !== undefined ? (
          <GateSettings gate={gate} show={show} parts={parts} busy={busy}
            onGate={(next) => setGate(gate.key, next)} onDelete={() => setGate(gate.key, null)} />
        ) : link !== undefined ? (
          <div className="wk-form">
            <h3 className="wk-h2">Link zewnętrzny</h3>
            <label className="wk-field">
              <span>Napis (na przycisku „dalej” na końcu)</span>
              <input value={link.label} disabled={busy} maxLength={80} onChange={(e) => setLink(link.id, { label: e.target.value })} />
            </label>
            <label className="wk-field">
              <span>Adres</span>
              <input defaultValue={link.href} disabled={busy}
                onBlur={(e) => { const made = textLink(e.target.value); if (made !== null) setLink(link.id, { href: made }); else e.target.value = link.href; }} />
              <span className="wk-hint">https://…, www.…, #/strona tutaj, mailto:…, tel:…</span>
            </label>
            <div className="wk-actions">
              <button type="button" className="wk-link-btn se-drop" disabled={busy} onClick={() => dropLink(link.id)}>Usuń link</button>
            </div>
          </div>
        ) : (
          <div className="wk-form">
            <p className="wk-hint">
              Każda scena ma jedno wejście (z lewej) i wyjścia (z prawej): „dalej” — strzałki i przewijanie — oraz po jednym
              na każdy przycisk. Przeciągnij od wyjścia do sceny, końca albo linku. Linia przerywana — „dalej” prowadzi do
              następnej na liście; usuń ją (Delete), żeby tu był koniec. Kliknij scenę, żeby wybrać cele z listy i zrobić
              przyciski; dwuklik — otwiera scenę.
            </p>
          </div>
        )}

        <details className="wk-fold pm-add" open={show.links.length === 0}>
          <summary>+ Link zewnętrzny</summary>
          <label className="wk-field">
            <span>Napis</span>
            <input value={label} disabled={busy} maxLength={80} placeholder="np. Zapisz się" onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="wk-field">
            <span>Adres</span>
            <input value={href} disabled={busy} placeholder="https://… albo #/parafia/zapisy" onChange={(e) => setHref(e.target.value)} />
          </label>
          {href.trim() !== '' && !linkOk && <p className="wk-blocker">To nie jest adres, który może być linkiem.</p>}
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || !linkOk} onClick={addLink}>Dodaj link</button>
          </div>
        </details>

        <StoryPanel show={show} busy={busy} onShow={onShow} onChoose={setChosen} />

        <div className="wk-actions">
          <button type="button" className="wk-link-btn" disabled={busy || Object.keys(show.map).length === 0}
            onClick={() => onShow({ ...show, map: {} })}>
            Ułóż mapę od nowa
          </button>
        </div>
        <p className="wk-hint">
          Bez połączeń prezentacja idzie po kolei. Droga bez naciskania przycisków: {routeOf(show).length} z {show.scenes.length} scen.
        </p>
      </aside>
    </section>
  );
}

export default PathsEditor;
