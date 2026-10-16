/**
 * 0107 — DIE BILDER DES POKAZ VON COGITA, als Szenen eines Bausteins
 * („Animacja", `parts/animation.tsx`).
 *
 * <b>Herkunft:</b> `legacy/pages/cogita/components/CogitaIntroSlides.tsx` und
 * `legacy/styles/cogita-intro.css`. Jede Szene ist dort Zeile für Zeile
 * abgelesen: dieselben Ebenen, dieselben Zeitpläne (die Keyframes stehen als
 * `an-*` in `app.css`, mit denselben Prozentstellen), dieselben Zufallsfolgen.
 *
 * <code>
 *   map        Drzewo wiedzy: Ebenen von Knoten, ein Wanderer, der nur weitergeht, wo die Grundlagen stehen
 *              (Schritt 900 ms, Pause 220 ms, Fehler 900 ms — fehlt eine Grundlage, blinkt es rot, und er holt sie nach)
 *   cards      Karty: sieben Fiszki fliegen geworfen herein, legen sich ins Raster, vier gehen auf den Stapel (10 s)
 *   round      Runda: fünf Karten, sechs Spieler; eine Karte hebt sich, Antworten fliegen hin, Ergebnisse zurück (8,6 s, alle 10 s neu)
 *   progress   Postęp: die eigene Linie wächst Schritt für Schritt, das Band der Gruppe, zwei andere, der Kreis des Vergleichs,
 *              dann die ganze Kurve (24 s)
 *   draw       Znak: eine Zeichnung zieht sich (`draw`, 1,8 s), dahinter pulsiert ein Schein (`glow`, 2,2 s) — die Tarcza
 * </code>
 *
 * <b>Grösse:</b> jede Szene rechnet in `em` = Pixel des Altbestands / 16, und
 * die Schrift ihres Kastens ist ein Bruchteil seiner Breite (`cqw`): so ist sie
 * auf dem Telefon und auf dem breiten Schirm dasselbe Bild.
 *
 * <b>Zufall mit Samen:</b> wo der Altbestand `Math.random()` nahm, zieht hier
 * eine Folge aus `seed` (und der Runde) — jedes Mal dasselbe Bild für dieselbe Zahl.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { MotionBox } from './MotionBox';
import { seeded } from './deckLayers';
import { readMotions } from './motion';

/* -- Der Zufall des Altbestands ------------------------------------------------------------ */

/** `seed = (seed · 1664525 + 1013904223) mod 2³²` — die Folge von Mapa und Karty. */
export function lcg(seed: number): () => number {
  let state = Math.floor(Math.abs(seed)) % 4294967296;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const em = (px: number): string => `${Math.round((px / 16) * 10000) / 10000}em`;
const pct = (n: number): string => `${Math.round(n * 1000) / 1000}%`;

/* == Drzewo wiedzy (map) =================================================================== */

export const MAP_SIZE = { width: 420, height: 320, paddingX: 28, paddingY: 18 } as const;
export const MAP_LEVELS: readonly number[] = [1, 4, 6, 6, 5, 4, 4];
export const MAP_TIMING = { move: 900, pause: 220, error: 900 } as const;

interface MapNode { id: string; x: number; y: number; r: number; level: number; role?: 'root' | 'goal' }
interface MapLink { from: string; to: string; key: string }

export interface LearningTree {
  readonly nodes: readonly MapNode[];
  readonly links: readonly MapLink[];
  readonly parents: ReadonlyMap<string, string[]>;
  readonly linksFrom: ReadonlyMap<string, string[]>;
  readonly children: ReadonlyMap<string, string[]>;
  readonly neighbours: ReadonlyMap<string, string[]>;
  readonly byId: ReadonlyMap<string, MapNode>;
}

/** Das Drzewo wiedzy (`createLearningTree`): Ebenen von unten nach oben, je Knoten der nächste Elternteil, manchmal zwei, selten drei. */
export function learningTree(seed: number, levels: readonly number[] = MAP_LEVELS): LearningTree {
  const rand = lcg(seed);
  const { width, height, paddingX, paddingY } = MAP_SIZE;
  const step = (height - paddingY * 2) / Math.max(1, levels.length - 1);
  const nodes: MapNode[] = [];
  const links: MapLink[] = [];
  const rows: MapNode[][] = [];

  levels.forEach((count, level) => {
    const y = height - paddingY - level * step;
    const spread = width - paddingX * 2;
    const row: MapNode[] = [];
    for (let i = 0; i < count; i += 1) {
      const base = paddingX + ((i + 1) * spread) / (count + 1);
      const jitter = (rand() - 0.5) * 18;
      const x = Math.max(paddingX, Math.min(width - paddingX, base + jitter));
      row.push({
        id: level === 0 ? 'root' : `l${level}-${i}`,
        x: level === 0 ? width / 2 : x,
        y,
        r: level === 0 ? 3 : level < 2 ? 2.1 : 1.4,
        level,
        ...(level === 0 ? { role: 'root' as const } : {})
      });
    }
    rows.push(row);
    nodes.push(...row);
  });

  const top = rows[rows.length - 1];
  if (top !== undefined && top.length > 0 && rows.length > 1) {
    const goal = top[Math.floor(top.length / 2)];
    goal.role = 'goal';
    goal.r = 2;
  }

  for (let level = 1; level < rows.length; level += 1) {
    for (const node of rows[level]) {
      const sorted = [...rows[level - 1]].sort((a, b) => Math.abs(a.x - node.x) - Math.abs(b.x - node.x));
      const second = sorted[1] !== undefined && rand() < 0.45 ? sorted[1] : null;
      for (const parent of second === null ? [sorted[0]] : [sorted[0], second]) links.push({ from: parent.id, to: node.id, key: `${parent.id}-${node.id}` });
      if (rand() < 0.2 && sorted[2] !== undefined) links.push({ from: sorted[2].id, to: node.id, key: `${sorted[2].id}-${node.id}` });
    }
  }

  const push = (map: Map<string, string[]>, key: string, value: string) => map.set(key, [...(map.get(key) ?? []), value]);
  const parents = new Map<string, string[]>();
  const linksFrom = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const neighbours = new Map<string, string[]>();
  for (const link of links) {
    push(parents, link.to, link.from);
    push(linksFrom, link.from, link.key);
    push(children, link.from, link.to);
    push(neighbours, link.from, link.to);
    push(neighbours, link.to, link.from);
  }
  return { nodes, links, parents, linksFrom, children, neighbours, byId: new Map(nodes.map((n) => [n.id, n])) };
}

/**
 * WOHIN DER WANDERER ALS NÄCHSTES GEHT (`pickNextTarget`): ein noch nicht
 * erreichtes Kind; sonst der nächste Schritt auf dem kürzesten Weg zu einem
 * Knoten, der noch unerreichte Kinder hat; ist alles erreicht, irgendein Nachbar.
 */
export function nextStep(tree: LearningTree, at: string, active: ReadonlySet<string>, rand: () => number): string | null {
  const open = (tree.children.get(at) ?? []).filter((child) => !active.has(child));
  if (open.length > 0) return open[Math.floor(rand() * open.length)];
  if (active.size >= tree.nodes.length) {
    const near = tree.neighbours.get(at) ?? [];
    return near.length > 0 ? near[Math.floor(rand() * near.length)] : null;
  }
  const hasOpen = (id: string) => (tree.children.get(id) ?? []).some((child) => !active.has(child));
  const queue = [at];
  const seen = new Set([at]);
  const prev = new Map<string, string>();
  let target: string | null = null;
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (id !== at && hasOpen(id)) { target = id; break; }
    for (const near of tree.neighbours.get(id) ?? []) {
      if (seen.has(near)) continue;
      seen.add(near);
      prev.set(near, id);
      queue.push(near);
    }
  }
  if (target === null) return null;
  let step = target;
  while (prev.get(step) !== undefined && prev.get(step) !== at) step = prev.get(step)!;
  return step;
}

/** Wo der Wanderer ist, was er erreicht hat, und wohin er noch zurück muss (Knoten, an denen ihm eine Grundlage fehlte). */
export interface Walk {
  readonly at: string;
  readonly active: ReadonlySet<string>;
  readonly recovery: readonly string[];
}

export const WALK_START: Walk = { at: 'root', active: new Set(['root']), recovery: [] };

/**
 * DER WANDERER KOMMT AN (`scheduleMove` des Altbestands, ohne Uhr): stehen
 * alle Grundlagen des Knotens, ist er erreicht, und es geht zuerst zurück zu
 * dem, woran er vorher scheiterte, sonst weiter (`nextStep`). Fehlt eine, ist
 * das ein Fehler (rot: der Knoten, was fehlt, die Wege dazwischen), der Knoten
 * kommt auf die Liste, und er geht zu einer der fehlenden.
 */
export function arrive(tree: LearningTree, walk: Walk, to: string, rand: () => number): {
  walk: Walk; error: { nodes: string[]; links: string[] } | null; next: string | null;
} {
  const missing = (tree.parents.get(to) ?? []).filter((p) => !walk.active.has(p));
  if (missing.length === 0) {
    const active = new Set(walk.active);
    active.add(to);
    const recovery = [...walk.recovery];
    let next: string | null = null;
    while (recovery.length > 0) {
      const back = recovery[recovery.length - 1];
      if (!active.has(back)) {
        if (back !== to) next = back;
        break;
      }
      recovery.pop();
    }
    return { walk: { at: to, active, recovery }, error: null, next: next ?? nextStep(tree, to, active, rand) };
  }
  return {
    walk: { at: to, active: walk.active, recovery: walk.recovery.includes(to) ? walk.recovery : [...walk.recovery, to] },
    error: { nodes: [to, ...missing], links: missing.map((p) => `${p}-${to}`) },
    next: missing[Math.floor(rand() * missing.length)]
  };
}

export function MapScene({ seed, levels, speed, playing, run }: { seed: number; levels: readonly number[]; speed: number; playing: boolean; run: number }) {
  const tree = useMemo(() => learningTree(seed, levels), [seed, levels]);
  const [active, setActive] = useState<ReadonlySet<string>>(() => new Set(['root']));
  const [errorNodes, setErrorNodes] = useState<ReadonlySet<string>>(() => new Set());
  const [errorLinks, setErrorLinks] = useState<ReadonlySet<string>>(() => new Set());
  const [explorer, setExplorer] = useState('root');
  const move = MAP_TIMING.move / speed;

  useEffect(() => {
    if (!playing) return undefined;
    const rand = seeded(seed * 31 + run * 7 + 1);
    let timer = 0;
    let walk: Walk = WALK_START;
    const later = (fn: () => void, ms: number) => { timer = window.setTimeout(fn, ms); };
    setActive(walk.active);
    setErrorNodes(new Set());
    setErrorLinks(new Set());
    setExplorer('root');

    /* Hin (900 ms), ankommen; erreicht — kurz innehalten (220 ms); gescheitert — rot (900 ms); dann weiter. */
    const go = (to: string): void => {
      setExplorer(to);
      later(() => {
        const done = arrive(tree, walk, to, rand);
        walk = done.walk;
        setActive(walk.active);
        if (done.error !== null) {
          setErrorNodes(new Set(done.error.nodes));
          setErrorLinks(new Set(done.error.links));
        }
        later(() => {
          setErrorNodes(new Set());
          setErrorLinks(new Set());
          if (done.next !== null) go(done.next);
        }, (done.error === null ? MAP_TIMING.pause : MAP_TIMING.error) / speed);
      }, MAP_TIMING.move / speed);
    };

    later(() => {
      const first = nextStep(tree, walk.at, walk.active, rand);
      if (first !== null) go(first);
    }, MAP_TIMING.pause / speed);
    return () => window.clearTimeout(timer);
  }, [playing, tree, seed, run, speed]);

  const lit = new Set<string>();
  for (const id of active) for (const key of tree.linksFrom.get(id) ?? []) lit.add(key);
  const dot = tree.byId.get(explorer) ?? tree.byId.get('root');

  return (
    <div className="an-map-field">
      <svg className="an-map-svg" viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`} preserveAspectRatio="none" aria-hidden="true">
        {tree.links.map((link) => {
          const a = tree.byId.get(link.from);
          const b = tree.byId.get(link.to);
          if (a === undefined || b === undefined) return null;
          return (
            <line key={link.key} className={`an-map-link${lit.has(link.key) ? ' is-active' : ''}${errorLinks.has(link.key) ? ' is-error' : ''}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          );
        })}
        {tree.nodes.map((node) => (
          <circle key={node.id} className={`an-map-node${node.role ? ` is-${node.role}` : ''}${active.has(node.id) ? ' is-active' : ''}${errorNodes.has(node.id) ? ' is-error' : ''}`}
            cx={node.x} cy={node.y} r={node.r} />
        ))}
      </svg>
      {dot !== undefined && (
        <span className="an-map-dot" style={{ left: pct((dot.x / MAP_SIZE.width) * 100), top: pct((dot.y / MAP_SIZE.height) * 100), '--move': `${Math.round(move)}ms` } as CSSProperties} />
      )}
    </div>
  );
}

/* == Karty (cards) ============================================================================ */

/** Wo die sieben Fiszki im Raster liegen (px um die Mitte) — vier oben, drei unten. */
export const CARD_GRID: readonly { x: number; y: number }[] = [
  { x: -180, y: -70 }, { x: -60, y: -70 }, { x: 60, y: -70 }, { x: 180, y: -70 },
  { x: -120, y: 60 }, { x: 0, y: 60 }, { x: 120, y: 60 }
];
/** Der Stapel links: vier übereinander. */
export const CARD_STACK: readonly { x: number; y: number }[] = [{ x: -80, y: -120 }, { x: -80, y: -15 }, { x: -80, y: 90 }, { x: -80, y: 195 }];
export const CARD_CYCLE = 10_000;

/** Wohin jede Karte geworfen wird (Samen 17 im Altbestand), und wann sie kommt (alle 0,12 s eine). */
export function cardThrows(seed: number): { x: number; y: number; rot: number; delay: number }[] {
  const rand = lcg(seed);
  return CARD_GRID.map((_, index) => ({
    x: Math.round((rand() - 0.5) * 240), y: Math.round((rand() - 0.5) * 180), rot: Math.round((rand() - 0.5) * 24 * 10) / 10, delay: index * 0.12
  }));
}

/** Welche vier auf den Stapel gehen — je Durchgang neu, aus dem Samen. */
export function stackOrder(seed: number, cycle: number): number[] {
  const rand = seeded(seed * 13 + cycle * 101 + 5);
  const ids = CARD_GRID.map((_, i) => i);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, CARD_STACK.length);
}

export function CardsScene({ seed, speed, playing }: { seed: number; speed: number; playing: boolean }) {
  const throws = useMemo(() => cardThrows(seed), [seed]);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setCycle((c) => c + 1), CARD_CYCLE / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed]);

  const order = stackOrder(seed, cycle);
  return (
    <div className="an-cards-field">
      {throws.map((t, index) => {
        const at = order.indexOf(index);
        const stack = at >= 0 ? CARD_STACK[at] : { x: 140, y: 140 };
        return (
          <div key={index} className="an-card" style={{
            '--throw-x': em(t.x), '--throw-y': em(t.y), '--throw-rot': `${t.rot}deg`,
            '--grid-x': em(CARD_GRID[index].x), '--grid-y': em(CARD_GRID[index].y),
            '--stack-x': em(stack.x), '--stack-y': em(stack.y), '--stack-opacity': at >= 0 ? 1 : 0,
            '--delay': `${t.delay / speed}s`
          } as CSSProperties}>
            <span className="an-card-title" />
            <span className="an-card-line" />
            <span className="an-card-line is-short" />
            <span className="an-card-quote" />
            <span className="an-card-source" />
            <span className="an-card-tags"><i /><i /><i /></span>
          </div>
        );
      })}
    </div>
  );
}

/* == Runda (round) ============================================================================= */

export const ROUND_CARDS: readonly number[] = [14, 30, 46, 62, 78];
export const ROUND_PLAYERS = 6;
export const ROUND_CYCLE = 8_600;
export const ROUND_EVERY = 10_000;

/** Die Spieler: zufällig im oberen Drittel, nie näher als 12 % beieinander. */
export function roundPlayers(seed: number): { x: number; y: number; jx: number; jy: number; delay: number }[] {
  const rand = seeded(seed * 7 + 3);
  const between = (a: number, b: number) => a + rand() * (b - a);
  const placed: { x: number; y: number }[] = [];
  for (let i = 0; i < ROUND_PLAYERS; i += 1) {
    let spot: { x: number; y: number } | null = null;
    for (let attempt = 0; attempt < 80 && spot === null; attempt += 1) {
      const x = between(14, 86);
      const y = between(10, 34);
      if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= 12)) spot = { x, y };
    }
    placed.push(spot ?? { x: between(16, 84), y: between(12, 32) });
  }
  return placed.map((p) => ({ ...p, jx: (rand() - 0.5) * 12, jy: (rand() - 0.5) * 10, delay: Math.round(rand() * 120) / 100 }));
}

/** Was in einer Runde geschieht: welche Karte, wer richtig liegt (60 %), welche drei Spieler sich austauschen. */
export function roundOf(seed: number, round: number): { card: number; results: boolean[]; links: { a: number; b: number; delay: number }[] } {
  const rand = seeded(seed * 17 + round * 997 + 11);
  const card = Math.floor(rand() * ROUND_CARDS.length);
  const results = Array.from({ length: ROUND_PLAYERS }, () => rand() < 0.6);
  const links: { a: number; b: number; delay: number }[] = [];
  const pairs = new Set<string>();
  for (let attempt = 1; links.length < 3 && attempt <= 30; attempt += 1) {
    const a = Math.floor(rand() * ROUND_PLAYERS);
    const b = Math.floor(rand() * ROUND_PLAYERS);
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || pairs.has(key)) continue;
    pairs.add(key);
    links.push({ a, b, delay: Math.round(attempt * 0.35 * 100) / 100 });
  }
  return { card, results, links };
}

/** Die Bühne der Runde in Pixeln des Altbestands: das Brett ist 520 × 300; die Karten hängen darunter. */
const BOARD = { width: 520, height: 300, cardDrop: 96 } as const;

export function RoundScene({ seed, speed, playing }: { seed: number; speed: number; playing: boolean }) {
  const players = useMemo(() => roundPlayers(seed), [seed]);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setRound((r) => r + 1), ROUND_EVERY / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed]);

  const now = roundOf(seed, round);
  /* Die Karten: auf 80 % der Höhe des Bretts und um ihre Höhe tiefer — eine gehobene steht genau auf 80 %. */
  const cardY = (lifted: boolean) => em(BOARD.height * 0.8 + (lifted ? 0 : BOARD.cardDrop));
  const px = (p: { x: number }) => em((p.x / 100) * BOARD.width);
  const py = (p: { y: number }) => em((p.y / 100) * BOARD.height);
  const target = { x: em((ROUND_CARDS[now.card] / 100) * BOARD.width), y: cardY(true) };

  return (
    <div className="an-round-field" key={round}>
      {ROUND_CARDS.map((x, index) => (
        <div key={index} className={`an-round-card${index === now.card ? ' is-active' : ''}`} style={{ left: em((x / 100) * BOARD.width), top: cardY(false) }}>
          <span className="an-card-title" />
          <span className="an-card-line" />
          <span className="an-card-line is-short" />
        </div>
      ))}
      <span className="an-round-ring" style={{ left: target.x, top: target.y }} />
      {players.map((p, index) => (
        <span key={index} className="an-round-player" style={{
          left: px(p), top: py(p), '--jitter-x': em(p.jx), '--jitter-y': em(p.jy), '--breath-delay': `${p.delay / speed}s`
        } as CSSProperties} />
      ))}
      <svg className="an-round-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {now.links.map((link) => (
          <line key={`${link.a}-${link.b}`} className="an-round-link" x1={players[link.a].x} y1={players[link.a].y} x2={players[link.b].x} y2={players[link.b].y}
            style={{ '--delay': `${link.delay / speed}s` } as CSSProperties} />
        ))}
      </svg>
      {players.map((p, index) => {
        const good = now.results[index];
        const vars = { '--delay': `${(index * 0.12) / speed}s` } as CSSProperties;
        return (
          <span key={`flow-${index}`} className="an-round-flow">
            <span className="an-round-out" style={{ ...vars, '--from-x': px(p), '--from-y': py(p), '--to-x': target.x, '--to-y': target.y } as CSSProperties} />
            <span className={`an-round-back is-${good ? 'good' : 'bad'}`} style={{ ...vars, '--from-x': target.x, '--from-y': target.y, '--to-x': px(p), '--to-y': py(p) } as CSSProperties} />
            <span className={`an-round-result is-${good ? 'good' : 'bad'}`} style={{ ...vars, left: px(p), top: py(p) }} />
          </span>
        );
      })}
    </div>
  );
}

/* == Postęp (progress) ========================================================================= */

export const PROGRESS_CYCLE = 24_000;

interface Pt { x: number; y: number }

/** Die eigene Linie: von (40, 160) nach (260, 48) in sechs Schritten — erst langsam, dann steil (Gewichte des Altbestands). */
export function progressPoints(seed: number): Pt[] {
  const rand = seeded(seed * 5 + 1);
  const start = { x: 40, y: 160 };
  const end = { x: 260, y: 48 };
  const weights = [0.3, 0.45, 0.6, 0.65, 1.4, 2.2];
  const sum = weights.reduce((a, b) => a + b, 0);
  const stepX = (end.x - start.x) / 6;
  const points: Pt[] = [start];
  let x = start.x;
  let y = start.y;
  for (let i = 1; i <= 6; i += 1) {
    const jx = (rand() - 0.5) * 14;
    const jy = (rand() - 0.5) * 28;
    x = Math.max(start.x + i * 14, Math.min(end.x - (6 - i) * 14, x + stepX + jx));
    y = y - ((start.y - end.y) * weights[i - 1]) / sum + jy;
    points.push({ x: Math.round(x), y: Math.round(Math.max(end.y, Math.min(start.y - 4, y))) });
  }
  points[points.length - 1] = end;
  return points;
}

/** Das Band der Gruppe um die eigene Linie: oben und unten, mit Abständen des Altbestands. */
export function progressRange(seed: number, points: readonly Pt[]): { upper: Pt[]; lower: Pt[] } {
  const rand = seeded(seed * 5 + 2);
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const upper = points.map((p) => ({ x: clamp(p.x, 40, 260), y: clamp(p.y - (10 + rand() * 36), 40, 140) }));
  const lower = points.map((p, i) => ({ x: clamp(p.x, 40, 260), y: clamp(Math.max(upper[i].y + 10, p.y + 12 + rand() * 40), 60, 170) }));
  return { upper, lower };
}

/** Zwei andere aus der Gruppe: einer darüber, einer darunter — ab dem fünften Schritt nah an der eigenen Linie. */
export function progressPeers(seed: number, points: readonly Pt[], range: { upper: Pt[]; lower: Pt[] }): { higher: Pt[]; lower: Pt[] } {
  const rand = seeded(seed * 5 + 3);
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  const build = (bias: number, minOff: number, maxOff: number) => points.map((p, i) => {
    const up = range.upper[i].y;
    const low = range.lower[i].y;
    const target = p.y + bias + (rand() - 0.5) * 70;
    const a = clamp(p.y + minOff, up + 6, low - 6);
    const b = clamp(p.y + maxOff, up + 6, low - 6);
    return { x: p.x, y: clamp(target, Math.min(a, b), Math.max(a, b)) };
  });
  const higher = build(-14 + rand() * 28, -80, 12);
  const lower = build(14 + rand() * 28, -12, 80);
  for (let i = 4; i < points.length; i += 1) {
    const p = points[i];
    higher[i] = { x: p.x, y: clamp(p.y - 12, range.upper[i].y + 6, range.lower[i].y - 6) };
    lower[i] = { x: p.x, y: clamp(p.y + 12, range.upper[i].y + 6, range.lower[i].y - 6) };
  }
  const last = points.length - 1;
  higher[last] = { x: points[last].x, y: clamp(points[last].y - 14, range.upper[last].y, range.lower[last].y) };
  lower[last] = { x: points[last].x, y: clamp(points[last].y + 12, range.upper[last].y, range.lower[last].y) };
  return { higher, lower };
}

const pathOf = (points: readonly Pt[]): string => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');

/** Die Stellen der Linien als Prozent des Kastens (300 × 200) — für die Punkte, die darauf wandern. */
const dotVars = (prefix: 'p' | 'q', points: readonly Pt[]): Record<string, string> =>
  Object.fromEntries(points.flatMap((p, i) => [[`--${prefix}${i}x`, pct((p.x / 300) * 100)], [`--${prefix}${i}y`, pct((p.y / 200) * 100)]]));

export function ProgressScene({ seed }: { seed: number }) {
  const points = useMemo(() => progressPoints(seed), [seed]);
  const range = useMemo(() => progressRange(seed, points), [seed, points]);
  const peers = useMemo(() => progressPeers(seed, points, range), [seed, points, range]);
  const mid = Math.max(0, Math.min(240, points[4].x - 40));
  const grid = [40, 75, 110, 145, 180, 215, 250];
  const rows = [170, 150, 130, 110, 90, 70, 50];
  const triangle = <svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="100 50 25 93.3 25 6.7" /></svg>;

  return (
    <div className="an-progress-field">
      <div className="an-progress-chart" style={{ '--range-mid': `${mid}px` } as CSSProperties}>
        <div className="an-progress-content">
          <svg className="an-progress-svg" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true">
            <g className="an-progress-grid">
              {grid.map((x) => <line key={`v${x}`} x1={x} y1={30} x2={x} y2={170} />)}
              {rows.map((y) => <line key={`h${y}`} x1={40} y1={y} x2={260} y2={y} />)}
            </g>
            <g className="an-progress-axes">
              <line x1={40} y1={170} x2={260} y2={170} />
              <line x1={40} y1={170} x2={40} y2={30} />
            </g>
            <g className="an-progress-paths">
              {points.slice(0, -1).map((p, i) => (
                <path key={i} className={`an-progress-seg is-${i + 1}`} d={`M${p.x} ${p.y} L${points[i + 1].x} ${points[i + 1].y}`} pathLength={100} />
              ))}
            </g>
            <defs>
              <clipPath id={`an-range-clip-${seed}`} clipPathUnits="userSpaceOnUse">
                <rect className="an-progress-clip" x={40} y={30} width={0} height={140} />
              </clipPath>
            </defs>
            <g className="an-progress-range" clipPath={`url(#an-range-clip-${seed})`}>
              <path className="an-progress-range-fill" d={`${pathOf(range.upper)} ${range.lower.slice().reverse().map((p) => `L${p.x} ${p.y}`).join(' ')} Z`} />
              <path className="an-progress-range-line" d={pathOf(range.upper)} />
              <path className="an-progress-range-line" d={pathOf(range.lower)} />
            </g>
            <g className="an-progress-peers">
              {[peers.higher, peers.lower].map((line, k) => line.slice(0, -1).map((p, i) => (
                <path key={`${k}-${i}`} className={`an-progress-peer is-${i + 1}`} d={`M${p.x} ${p.y} L${line[i + 1].x} ${line[i + 1].y}`} pathLength={100} />
              )))}
            </g>
          </svg>
          <span className="an-progress-orbit" aria-hidden="true">
            <span className="an-progress-ring" />
            <span className="an-progress-tri">{triangle}</span>
            <span className="an-progress-tri is-accent is-fast">{triangle}</span>
            <span className="an-progress-tri is-accent is-slow">{triangle}</span>
          </span>
          <span className="an-progress-dot" style={dotVars('p', points) as CSSProperties} />
          <span className="an-progress-peer-dot is-1" style={dotVars('q', peers.higher) as CSSProperties} />
          <span className="an-progress-peer-dot is-2" style={dotVars('q', peers.lower) as CSSProperties} />
        </div>
      </div>
    </div>
  );
}

/* == Znak (draw) ================================================================================= */

/** Gezeichnete Zeichen — im Rahmen 120 × 140 wie die Tarcza des Altbestands. */
export const ICONS: Readonly<Record<string, { readonly label: string; readonly paths: readonly string[] }>> = {
  shield: { label: 'Tarcza z ptaszkiem', paths: ['M60 10l42 16v44c0 30-19 54-42 62C37 124 18 100 18 70V26z', 'M44 66l10 12 22-26'] },
  check: { label: 'Ptaszek w kole', paths: ['M60 22a48 48 0 1 0 0.1 0z', 'M38 72l15 16 31-36'] },
  heart: { label: 'Serce', paths: ['M60 118C28 92 14 74 14 54c0-16 12-28 27-28 9 0 15 4 19 11 4-7 10-11 19-11 15 0 27 12 27 28 0 20-14 38-46 64z'] },
  star: { label: 'Gwiazda', paths: ['M60 14l13 30 33 3-25 22 8 32-29-17-29 17 8-32-25-22 33-3z'] },
  cross: { label: 'Krzyż', paths: ['M60 14v112', 'M30 48h60'] },
  book: { label: 'Otwarta księga', paths: ['M60 40c-12-8-28-10-44-8v70c16-2 32 0 44 8 12-8 28-10 44-8V32c-16-2-32 0-44 8z', 'M60 40v70'] }
};

const PATH_OK = /^[MmLlHhVvCcSsQqTtAaZz0-9 .,\-+eE]{1,2000}$/;

/** Eine eigene Zeichnung: nur die Buchstaben eines SVG-Pfads — sonst keine. */
export const safePath = (path: string): string | null => (PATH_OK.test(path.trim()) ? path.trim() : null);

export function DrawScene({ icon, path, viewBox, glow, speed, still = false }: { icon: string; path: string | null; viewBox: string; glow: boolean; speed: number; still?: boolean }) {
  const paths = path !== null ? [path] : (ICONS[icon] ?? ICONS.shield).paths;
  /* Die Tarcza des Altbestands ist zwei Wörter des Wörterbuchs: ein Auftritt (draw) und eine Schleife (glow). Still: gezeichnet. */
  const draw = still ? [] : readMotions({ name: 'draw', duration: Math.round(1800 / speed) });
  const pulse = still ? [] : readMotions({ name: 'glow', duration: Math.round(2200 / speed) });
  return (
    <div className="an-draw-field">
      {glow && <MotionBox motions={pulse} className="an-draw-glow"><span /></MotionBox>}
      <MotionBox motions={draw} className="an-draw-ink">
        <svg viewBox={viewBox} aria-hidden="true">
          {paths.map((d, i) => <path key={i} d={d} fill="none" />)}
        </svg>
      </MotionBox>
    </div>
  );
}
