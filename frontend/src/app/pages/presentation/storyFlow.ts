/**
 * DAS STORYBOARD ALS ABLAUF (2026-10-22, Schritt 12; COGITA.md §8 „One
 * narrative") — rein und ohne React.
 *
 * Gespeichert bleibt das Storyboard in der Seite (offen wie sie: eine
 * öffentliche Präsentation läuft für jeden). Hier wird es als Ablauf von Cogita
 * gelesen, im Aussehen `scenes`:
 *
 * <code>
 *   Szene                    Schritt `scene` { page, scene, title } — Ausgang `next` = „dalej"
 *   Frage auf der Szene      Ausgänge `right` / `wrong` (ihr eigenes Ziel, sonst „dalej")
 *   Knopf auf der Szene      Ausgang `b0`, `b1` … zu seinem Ziel (Schritte derselben Szene zählen nicht)
 *   Tor „Warunek"            Schritt `condition` (yes / no)
 *   Tor „Zmień wartość"      Schritt `set` (next)
 *   `end`, `link:<id>`       Schritt `end` (ein Weg hinaus behält sein Ziel)
 * </code>
 *
 * Der Motor der Abläufe (`cogita/flow.ts`) geht diesen Graphen zu denselben
 * Szenen wie die Präsentation selbst (`story.ts`) — geprüft in
 * `app-presentation-check`. In Nauka spielt die Präsentation durch ihren
 * eigenen Motor (`PresentationInNauka.tsx`); der Graph ist die Karte des
 * Ablaufs im Editor und der Beweis, dass es EINE Erzählung ist.
 */

import type { Graph, GraphEdge, GraphNode } from '../../cogita/graph';
import type { Piece, Show } from './presentation';
import { nextOf, resolveTarget, type Target } from './showPaths';
import { outcomeTarget } from './story';

/** Was der Graph von einem Baustein braucht. */
export interface StoryPiece {
  readonly key: string;
  readonly kind: string;
  readonly label: string;
  readonly piece: Pick<Piece, 'places' | 'go'>;
}

export const sceneNode = (key: string): string => `s:${key}`;
export const gateNode = (key: string): string => `g:${key}`;

export interface StoryFlow {
  readonly start: string | null;
  readonly graph: Graph;
}

/** Das Storyboard als Ablauf: Szenen, Tore, die Wege hinaus — und von wo es beginnt (die erste Szene). */
export function storyToFlow(show: Show, pieces: readonly StoryPiece[], path: string): StoryFlow {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const ends = new Set<string>();

  const nodeFor = (target: Target): string | null => {
    switch (target.kind) {
      case 'scene': return sceneNode(target.key);
      case 'gate': return gateNode(target.key);
      case 'end':
        if (!ends.has('end')) { ends.add('end'); nodes.push({ id: 'end', type: 'end', x: 0, y: 400, config: {} }); }
        return 'end';
      case 'link': {
        const id = `l:${target.link.id}`;
        if (!ends.has(id)) { ends.add(id); nodes.push({ id, type: 'end', x: 260 * ends.size, y: 400, config: { link: target.link.id, title: target.link.label } }); }
        return id;
      }
      default: return null;
    }
  };
  const edge = (from: string, out: string, target: Target) => {
    const to = nodeFor(target);
    if (to !== null) edges.push({ id: `${from}>${out}`, from, out, to, in: 'in' });
  };

  show.scenes.forEach((scene, i) => {
    const id = sceneNode(scene.key);
    const here = pieces.filter((p) => p.piece.places[scene.key] !== undefined);
    const question = here.find((p) => p.kind === 'question');
    /* Knöpfe: je Ziel ein Ausgang; ein Schritt derselben Szene verlässt sie nicht. */
    const buttons: { exit: string; label: string; target: string }[] = [];
    for (const p of here) {
      if (p.kind === 'question') continue;
      const said = p.piece.go[scene.key] ?? p.piece.go['*'];
      if (said === undefined) continue;
      const target = resolveTarget(show, said);
      if (target.kind === 'none' || target.kind === 'step' || buttons.some((b) => b.target === said)) continue;
      buttons.push({ exit: `b${buttons.length}`, label: p.label, target: said });
    }
    nodes.push({
      id, type: 'scene', x: i * 260, y: 0,
      config: { page: path, scene: scene.key, title: scene.label, ...(question === undefined ? {} : { question: true }), ...(buttons.length === 0 ? {} : { buttons }) }
    });
    edge(id, 'next', nextOf(show, scene.key));
    if (question !== undefined) {
      for (const outcome of ['right', 'wrong'] as const) {
        const own = outcomeTarget(question.piece as Piece, scene.key, outcome);
        edge(id, outcome, own === null ? nextOf(show, scene.key) : resolveTarget(show, own));
      }
    }
    for (const b of buttons) edge(id, b.exit, resolveTarget(show, b.target));
  });

  (show.story?.gates ?? []).forEach((gate, i) => {
    const id = gateNode(gate.key);
    if (gate.type === 'condition') {
      nodes.push({ id, type: 'condition', x: i * 260, y: 200, config: { condition: gate.when, title: gate.label } });
      edge(id, 'yes', resolveTarget(show, gate.yes));
      edge(id, 'no', resolveTarget(show, gate.no));
    } else {
      nodes.push({ id, type: 'set', x: i * 260, y: 200, config: { actions: gate.actions, title: gate.label } });
      edge(id, 'next', resolveTarget(show, gate.next));
    }
  });

  return { start: show.scenes[0] === undefined ? null : sceneNode(show.scenes[0].key), graph: { nodes, edges } };
}
