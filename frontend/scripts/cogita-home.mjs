/**
 * DER POKAZ VON COGITA ALS PRÄSENTATION (0108) — als Dokument der Seite
 * ("recreatio/page", "mode": "presentation"), das sich auf jeder Seite
 * importieren lässt (Panel „JSON strony" → Importuj, „Zastąp moduły strony").
 *
 * <b>Nichts darin ist ein fertiges Bild.</b> Jedes bewegte Bild ist eine
 * Zeichnung (Baustein „animation") aus Flächen, Linien, Punkten und Texten,
 * und jede Bewegung ist eines der allgemeinen Wörter (`src/app/motion.ts`):
 * move, size, turn, fade, draw, color, reveal, keys — oder eine Vorlage
 * (rise, assemble, float, breathe, glow, drift, sway). Was der Altbestand mit
 * eigenen Keyframes und Rechnungen tat, ist hier in diese Wörter übersetzt:
 *
 *   Mapa wiedzy   CogitaIntroSlides: createLearningTree (Samen 11) und der Gang des Wanderers —
 *                 vorausgerechnet: ein Weg (move/path), Knoten und Wege, die zu ihrer Zeit
 *                 aufleuchten oder rot blinken (keys: color, stroke, opacity, glow)
 *   Karty         cogita-card-flow / -opacity / -tag-filter: Wurf → Raster → Stapel (keys), drei
 *                 Durchgänge mit je anderem Stapel; die Fiszka ist ein wiederverwendbarer Teil (symbols)
 *   Runda         round-card-lift, round-flow, round-return, round-result, round-ring, round-link-fade,
 *                 round-player-breathe (die Vorlage „breathe"): drei Runden in 30 s
 *   Postęp        chart-seg-*, chart-peer-*, chart-dot-step, chart-orbit-*, chart-loop-fade,
 *                 chart-clip-reveal und die Blende des Bandes (draw, keys, clip) — 24 s
 *   Tarcza        cogita-shield-draw (draw: der Strich 420 war länger als die Linien — sie sind
 *                 vor dem Ende fertig, "to" > 1) und cogita-shield-glow (die Vorlage „glow")
 *
 * Dazu: das Zeichen aus 20 Ebenen (Baustein „layers": float, assemble), das von
 * Szene zu Szene wandert; der Text jeder Szene (Baustein „hero") mit dem
 * Auftritt „rise" (220 ms, auf der Mapa 1000 ms); der Wechsel „dissolve"; das
 * gemeinsame Tuch (Dunst, Nici, Fale) und je Szene ihr Verlauf und Schein.
 *
 * Text aus `src/legacy/content/pl.ts` (cogita.introSlides), Farben und Plätze
 * aus `legacy/styles/cogita-intro.css` und `CogitaPage.tsx`. Ändert sich dort
 * etwas, schreibt dieses Skript das Dokument neu:
 *
 *   node scripts/cogita-home.mjs     → scripts/fixtures/cogita-home.json
 *
 * Geprüft in `app-motion-check.mjs`: importiert ohne Warnung, kommt unverändert heraus.
 */

import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const src = join(root, 'src').replace(/\\/g, '/');
const workspace = await mkdtemp(join(tmpdir(), 'cogita-home-'));
const entry = join(workspace, 'entry.ts');
await writeFile(entry, `
export { pl } from '${src}/legacy/content/pl';
export { pieceJson, readPieceValue, readShow, showJson } from '${src}/app/presentation';
export { partOf } from '${src}/app/parts/registry';
`);
await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(workspace, 'entry.mjs'), logLevel: 'error', jsx: 'automatic',
  nodePaths: [join(root, 'node_modules')],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }, loader: { '.css': 'empty' }
});
globalThis.BroadcastChannel = undefined;
const { pl, pieceJson, readPieceValue, readShow, showJson, partOf } = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
await rm(workspace, { recursive: true, force: true });

/* -- Kleinigkeiten ----------------------------------------------------------------------------- */

const r2 = (n) => Math.round(n * 100) / 100;
const r5 = (n) => Math.round(n * 100000) / 100000;
/** Eine Stelle (ms) in einem Ablauf von `total` ms — als Anteil 0–1. */
const at = (t, total) => r5(Math.min(1, Math.max(0, t / total)));

/** `seed = (seed · 1664525 + 1013904223) mod 2³²` — der Zufall von Mapa und Karty im Altbestand. */
const lcg = (seed) => { let s = seed % 4294967296; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; };
/** Lehmer (48271, wie `deckLayers.seeded`) — wo der Altbestand `Math.random()` nahm: hier mit Samen, jedes Mal dasselbe. */
const seeded = (seed) => { let s = Math.floor(Math.abs(seed)) % 2147483647; if (s <= 0) s += 2147483646; return () => { s = (s * 48271) % 2147483647; return s / 2147483647; }; };

/** Bilder einer Bewegung: sortiert, gleiche Stellen zusammengefasst (die spätere gewinnt). */
function keysOf(list) {
  const out = [];
  for (const k of [...list].sort((a, b) => a.at - b.at)) {
    const last = out[out.length - 1];
    if (last !== undefined && last.at === k.at) Object.assign(last, k); else out.push({ ...k });
  }
  return out;
}

const loop = (duration, keys, extra = {}) => ({ name: 'keys', duration, repeat: 'loop', ease: 'inOut', keys: keysOf(keys), ...extra });

/* == Mapa wiedzy ============================================================================== */

const MAP = { width: 420, height: 320, paddingX: 28, paddingY: 18, levels: [1, 4, 6, 6, 5, 4, 4], seed: 11 };

/** `createLearningTree`: Ebenen von unten nach oben, je Knoten der nächste Elternteil, manchmal zwei, selten drei. */
function learningTree() {
  const rand = lcg(MAP.seed);
  const { width, height, paddingX, paddingY, levels } = MAP;
  const step = (height - paddingY * 2) / (levels.length - 1);
  const nodes = [], links = [], rows = [];
  levels.forEach((count, level) => {
    const y = height - paddingY - level * step;
    const row = [];
    for (let i = 0; i < count; i += 1) {
      const base = paddingX + ((i + 1) * (width - paddingX * 2)) / (count + 1);
      const jitter = (rand() - 0.5) * 18;
      row.push({
        id: level === 0 ? 'root' : `l${level}-${i}`, y, level, role: level === 0 ? 'root' : null,
        x: level === 0 ? width / 2 : Math.max(paddingX, Math.min(width - paddingX, base + jitter)),
        r: level === 0 ? 3 : level < 2 ? 2.1 : 1.4
      });
    }
    rows.push(row);
    nodes.push(...row);
  });
  const top = rows[rows.length - 1];
  const goal = top[Math.floor(top.length / 2)];
  goal.role = 'goal';
  goal.r = 2;
  for (let level = 1; level < rows.length; level += 1) {
    for (const node of rows[level]) {
      const sorted = [...rows[level - 1]].sort((a, b) => Math.abs(a.x - node.x) - Math.abs(b.x - node.x));
      const second = sorted[1] !== undefined && rand() < 0.45 ? sorted[1] : null;
      for (const parent of second === null ? [sorted[0]] : [sorted[0], second]) links.push({ from: parent.id, to: node.id, key: `${parent.id}-${node.id}` });
      if (rand() < 0.2 && sorted[2] !== undefined) links.push({ from: sorted[2].id, to: node.id, key: `${sorted[2].id}-${node.id}` });
    }
  }
  const map = (pairs) => { const m = new Map(); for (const [k, v] of pairs) m.set(k, [...(m.get(k) ?? []), v]); return m; };
  return {
    nodes, links, byId: new Map(nodes.map((n) => [n.id, n])),
    parents: map(links.map((l) => [l.to, l.from])),
    children: map(links.map((l) => [l.from, l.to])),
    neighbours: map(links.flatMap((l) => [[l.from, l.to], [l.to, l.from]]))
  };
}

/** `pickNextTarget`: ein unerreichtes Kind; sonst der erste Schritt zum nächsten Knoten mit unerreichten Kindern. */
function nextStep(tree, from, active, rand) {
  const open = (tree.children.get(from) ?? []).filter((c) => !active.has(c));
  if (open.length > 0) return open[Math.floor(rand() * open.length)];
  if (active.size >= tree.nodes.length) return null;
  const hasOpen = (id) => (tree.children.get(id) ?? []).some((c) => !active.has(c));
  const queue = [from], seen = new Set([from]), prev = new Map();
  let target = null;
  while (queue.length > 0) {
    const id = queue.shift();
    if (id !== from && hasOpen(id)) { target = id; break; }
    for (const near of tree.neighbours.get(id) ?? []) { if (seen.has(near)) continue; seen.add(near); prev.set(near, id); queue.push(near); }
  }
  if (target === null) return null;
  let step = target;
  while (prev.get(step) !== undefined && prev.get(step) !== from) step = prev.get(step);
  return step;
}

/**
 * DER GANG, vorausgerechnet (`scheduleMove`): 900 ms hin, ankommen — erreicht
 * (220 ms innehalten) oder es fehlt eine Grundlage (900 ms rot blinken, dann
 * zu ihr, und danach zurück). Bis alles erreicht ist; dann 3 s stehen, in
 * 1,2 s zurück auf den Anfang — und von vorn.
 */
function mapDrawing() {
  const tree = learningTree();
  const MOVE = 900, PAUSE = 220, ERROR = 900, HOLD = 3000, RESET = 1200;
  const rand = seeded(MAP.seed * 31 + 1);
  const active = new Set(['root']);
  const lit = new Map([['root', 0]]);
  const errors = [];
  const route = [{ t: 0, id: 'root' }];
  let here = 'root', t = PAUSE, recovery = [];
  let next = nextStep(tree, here, active, rand);
  for (let guard = 0; guard < 400 && next !== null; guard += 1) {
    route.push({ t, id: here });
    t += MOVE;
    route.push({ t, id: next });
    const to = next;
    here = to;
    const missing = (tree.parents.get(to) ?? []).filter((p) => !active.has(p));
    if (missing.length === 0) {
      active.add(to);
      lit.set(to, t);
      next = null;
      while (recovery.length > 0) {
        const back = recovery[recovery.length - 1];
        if (!active.has(back)) { if (back !== to) next = back; break; }
        recovery.pop();
      }
      next ??= nextStep(tree, to, active, rand);
      t += PAUSE;
    } else {
      errors.push({ t, nodes: [to, ...missing], links: missing.map((p) => `${p}-${to}`) });
      if (!recovery.includes(to)) recovery.push(to);
      next = missing[Math.floor(rand() * missing.length)];
      t += ERROR;
    }
  }
  const end = t + HOLD;
  const total = end + RESET;
  const base = tree.byId.get('root');

  /*
   * .cogita-workspace-link / .is-active / .is-error (link-error, 1 s). Die
   * Deckkraft des Altbestands ist in die Farbe gerechnet (Farbe .35 × Deckkraft
   * .55 = .19) — dasselbe Bild mit einem Wert weniger in jedem Bild.
   */
  const SOFT_LINK = { stroke: 'rgba(140, 200, 255, 0.19)' };
  const LIT_LINK = { stroke: 'rgba(170, 230, 255, 0.72)' };
  const RED_LINK = [{ stroke: 'rgba(255, 120, 120, 0.14)' }, { stroke: 'rgba(255, 120, 120, 0.86)' }];
  const linkAt = (link, time) => {
    const on = lit.get(link.from);
    return on !== undefined && time >= on ? LIT_LINK : SOFT_LINK;
  };
  const linkEls = tree.links.map((link) => {
    const a = tree.byId.get(link.from), b = tree.byId.get(link.to);
    const on = lit.get(link.from);
    const keys = [{ at: 0, ...linkAt(link, 0) }];
    /* Ein Weg leuchtet, sobald sein Anfang erreicht ist (320 ms). */
    if (on !== undefined && on > 0) keys.push({ at: at(on, total), ...SOFT_LINK }, { at: at(on + 320, total), ...LIT_LINK });
    for (const e of errors.filter((one) => one.links.includes(link.key))) {
      keys.push(
        { at: at(e.t, total), ...linkAt(link, e.t - 1) }, { at: at(e.t + 150, total), ...RED_LINK[0] },
        { at: at(e.t + 500, total), ...RED_LINK[1] }, { at: at(e.t + ERROR, total), ...linkAt(link, e.t + ERROR) }
      );
    }
    keys.push({ at: at(end, total), ...linkAt(link, end) }, { at: 1, ...linkAt(link, 0) });
    const still = keys.every((k) => k.stroke === keys[0].stroke);
    return {
      type: 'line', x: r2(a.x), y: r2(a.y), x2: r2(b.x), y2: r2(b.y), width: 1.6, ...linkAt(link, 0),
      ...(still ? {} : { motion: loop(total, keys) })
    };
  });

  /* .cogita-workspace-node / .is-root / .is-goal / .is-active / .is-error (node-blocked, 1,2 s) — auch hier die Deckkraft in der Farbe. */
  const look = (n, on) => (n.role === 'root'
    ? { color: 'rgba(170, 230, 255, 0.95)', glow: '0 0 8px rgba(170, 230, 255, 0.75)' }
    : on ? { color: 'rgba(170, 230, 255, 0.81)', glow: '0 0 10px rgba(170, 230, 255, 0.75)' }
    : n.role === 'goal' ? { color: 'rgba(170, 230, 255, 0.49)', glow: '0 0 0px rgba(170, 230, 255, 0)' }
    : { color: 'rgba(140, 200, 255, 0.08)', glow: '0 0 0px rgba(170, 230, 255, 0)' });
  const nodeEls = tree.nodes.map((n) => {
    const on = lit.get(n.id);
    const lookAt = (time) => look(n, on !== undefined && time >= on);
    const keys = [{ at: 0, ...lookAt(0) }];
    if (on !== undefined && on > 0) keys.push({ at: at(on, total), ...lookAt(on - 1) }, { at: at(on + 280, total), ...lookAt(on) });
    for (const e of errors.filter((one) => one.nodes.includes(n.id))) {
      keys.push(
        { at: at(e.t, total), ...lookAt(e.t - 1) },
        { at: at(e.t + 150, total), color: 'rgba(255, 120, 120, 0.15)', glow: '0 0 8px rgba(255, 120, 120, 0.7)' },
        { at: at(e.t + 600, total), color: 'rgba(255, 120, 120, 0.95)', glow: '0 0 8px rgba(255, 120, 120, 0.7)' },
        { at: at(e.t + ERROR, total), ...lookAt(e.t + ERROR) }
      );
    }
    keys.push({ at: at(end, total), ...lookAt(end) }, { at: 1, ...lookAt(0) });
    const rest = lookAt(0);
    const still = keys.every((k) => k.color === rest.color);
    return {
      type: 'circle', x: r2(n.x), y: r2(n.y), r: n.r, fill: rest.color, ...(n.role === 'root' ? { glow: rest.glow } : {}),
      ...(still ? {} : { motion: loop(total, keys) })
    };
  });

  /* Der Wanderer: ein Weg durch die Knoten — 900 ms hin, sonst steht er. */
  const path = [], times = [];
  for (const step of route) {
    const n = tree.byId.get(step.id);
    path.push([r2(n.x - base.x), r2(n.y - base.y)]);
    times.push(at(step.t, total));
  }
  const last = tree.byId.get(here);
  path.push([r2(last.x - base.x), r2(last.y - base.y)], [0, 0]);
  times.push(at(end, total), 1);
  if (path.length > 400) throw new Error(`the walk has ${path.length} points (at most 400)`);

  /* 76 s Gang, 50 Wege, 30 Knoten: die Farben knapp als #rrggbbaa, sonst passt die Zeichnung nicht in einen Baustein (64 000 Zeichen). */
  return compact({
    alt: 'Drzewo wiedzy: wędrowiec idzie dalej tylko tam, gdzie stoją podstawy',
    size: [MAP.width, MAP.height],
    elements: [
      ...linkEls,
      ...nodeEls,
      {
        type: 'circle', x: r2(base.x), y: r2(base.y), r: 5.7, fill: 'rgba(170, 230, 255, 0.95)', glow: '0 0 13px rgba(170, 230, 255, 0.9)',
        motion: { name: 'move', path, times, duration: total, repeat: 'loop', ease: 'inOut' }
      }
    ],
    report: `${tree.nodes.length} nodes, ${tree.links.length} links, ${route.length} stops, ${errors.length} errors, ${Math.round(total / 100) / 10} s`
  });
}

/** Jedes `rgba(r, g, b, a)` als `#rrggbbaa` — dieselbe Farbe, ein Drittel so lang; `0px` als `0`. */
function compact(value) {
  if (typeof value === 'string') {
    return value
      .replace(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/g, (_, r, g, b, a) => '#' + [r, g, b, Math.round(Number(a) * 255)].map((n) => Number(n).toString(16).padStart(2, '0')).join(''))
      .replace(/(^|\s)0px(?=\s)/g, '$10');
  }
  if (Array.isArray(value)) return value.map(compact);
  if (typeof value === 'object' && value !== null) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, compact(v)]));
  return value;
}

/* == Karty ===================================================================================== */

/** Wo die sieben Fiszki im Raster liegen (um die Mitte) — vier oben, drei unten; der Stapel links. */
const CARD_GRID = [{ x: -180, y: -70 }, { x: -60, y: -70 }, { x: 60, y: -70 }, { x: 180, y: -70 }, { x: -120, y: 60 }, { x: 0, y: 60 }, { x: 120, y: 60 }];
const CARD_STACK = [{ x: -80, y: -120 }, { x: -80, y: -15 }, { x: -80, y: 90 }, { x: -80, y: 195 }];

/** Eine Fiszka (`.cogita-index-card`, 190 × 130, Rand 14/16 px): Titel, zwei Zeilen, Zitat, Quelle, drei Schlagworte — um ihre Mitte. */
const FISZKA = [
  { type: 'rect', x: -95, y: -65, w: 190, h: 130, r: 14, fill: 'rgba(8, 20, 34, 0.75)', stroke: 'rgba(140, 200, 255, 0.35)', width: 1, glow: '0 18px 28px rgba(4, 10, 18, 0.45)' },
  { type: 'rect', x: -79, y: -51, w: 86.9, h: 10, r: 5, fill: 'rgba(200, 230, 255, 0.85)' },
  { type: 'rect', x: -79, y: -35, w: 158, h: 6, r: 3, fill: 'rgba(160, 210, 255, 0.45)' },
  { type: 'rect', x: -79, y: -23, w: 110.6, h: 6, r: 3, fill: 'rgba(160, 210, 255, 0.35)' },
  {
    type: 'group', opacity: 0.7, children: [
      { type: 'rect', x: -79, y: -9, w: 2, h: 12, fill: 'rgba(160, 210, 255, 0.6)' },
      { type: 'circle', x: -80, y: -4, r: 3, fill: 'rgba(200, 230, 255, 0.7)' }
    ]
  },
  { type: 'rect', x: -79, y: 9, w: 66.4, h: 5, r: 2.5, fill: 'rgba(130, 180, 230, 0.35)' },
  {
    type: 'group', opacity: 0.35,
    children: [
      { type: 'rect', x: -79, y: 24, w: 36, h: 8, r: 4, fill: 'rgba(120, 180, 230, 0.4)' },
      { type: 'rect', x: -37, y: 24, w: 26, h: 8, r: 4, fill: 'rgba(120, 180, 230, 0.4)' },
      { type: 'rect', x: -5, y: 24, w: 18, h: 8, r: 4, fill: 'rgba(120, 180, 230, 0.4)' }
    ],
    /* cogita-tag-filter: die Schlagworte leuchten auf, wenn sortiert wird. */
    motion: loop(10000, [{ at: 0, opacity: 0.35, scale: 1 }, { at: 0.4, opacity: 0.35, scale: 1 }, { at: 0.58, opacity: 0.8, scale: 1.05 }, { at: 0.66, opacity: 0.55, scale: 1.02 }, { at: 1, opacity: 0.35, scale: 1 }])
  }
];

function cardsDrawing() {
  const rand = lcg(17);
  const throws = CARD_GRID.map(() => ({ x: Math.round((rand() - 0.5) * 240), y: Math.round((rand() - 0.5) * 180), rot: Math.round((rand() - 0.5) * 24 * 10) / 10 }));
  const CYCLES = 3, CYCLE = 10000, TOTAL = CYCLES * CYCLE;
  /* Je Durchgang ein anderer Stapel aus vier (im Altbestand alle 10 s neu gemischt). */
  const orders = Array.from({ length: CYCLES }, (_, c) => {
    const pick = seeded(17 * 13 + c * 101 + 5);
    const ids = CARD_GRID.map((_, i) => i);
    for (let i = ids.length - 1; i > 0; i -= 1) { const j = Math.floor(pick() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    return ids.slice(0, CARD_STACK.length);
  });
  const centre = { x: 280, y: 180 };
  const elements = CARD_GRID.map((grid, i) => {
    const t = throws[i];
    const thrown = { x: t.x - grid.x, y: t.y - grid.y, rotate: t.rot };
    const flow = [], fade = [];
    for (let c = 0; c < CYCLES; c += 1) {
      const o = c / CYCLES, k = 1 / CYCLES;
      const slot = orders[c].indexOf(i);
      const stack = slot >= 0 ? CARD_STACK[slot] : { x: 140, y: 140 };
      const stacked = { x: stack.x - grid.x, y: stack.y - grid.y, rotate: 0 };
      /* cogita-card-flow: geworfen (0–24 %), ins Raster (40–60 %), auf den Stapel (70–90 %), zurück. */
      flow.push(
        { at: r5(o), ...thrown, scale: 0.94 }, { at: r5(o + 0.24 * k), ...thrown, scale: 0.98 },
        { at: r5(o + 0.4 * k), x: 0, y: 0, rotate: 0, scale: 1 }, { at: r5(o + 0.6 * k), x: 0, y: 0, rotate: 0, scale: 1.01 },
        { at: r5(o + 0.7 * k), ...stacked, scale: 1.02 }, { at: r5(o + 0.9 * k), ...stacked, scale: 1.02 }
      );
      /* cogita-card-opacity: wer nicht auf den Stapel kommt, vergeht. */
      const shown = slot >= 0 ? 1 : 0;
      fade.push({ at: r5(o), opacity: 0 }, { at: r5(o + 0.12 * k), opacity: 1 }, { at: r5(o + 0.6 * k), opacity: 1 }, { at: r5(o + 0.7 * k), opacity: shown }, { at: r5(o + 0.9 * k), opacity: shown });
    }
    flow.push({ at: 1, ...thrown, scale: 0.94 });
    fade.push({ at: 1, opacity: 0 });
    return {
      type: 'use', use: 'fiszka', x: centre.x + grid.x, y: centre.y + grid.y, shift: i * 120,
      motion: [loop(TOTAL, flow), loop(TOTAL, fade, { delay: i * 120 })]
    };
  });
  return { alt: 'Karty wiedzy: rzucone, ułożone w siatkę, cztery na stos', size: [560, 440], symbols: [{ name: 'fiszka', shapes: FISZKA }], elements };
}

/* == Runda ===================================================================================== */

function roundDrawing() {
  const W = 520, H = 300, LIFT = 96, ROUND = 10000, PLAY = 8600, ROUNDS = 3, TOTAL = ROUNDS * ROUND, SEED = 5;
  const cardsX = [14, 30, 46, 62, 78].map((p) => r2((p / 100) * W));
  const restY = H * 0.8 + LIFT;
  const liftY = H * 0.8;
  /* Die Spieler: zufällig im oberen Drittel, nie näher als 12 % beieinander; ihr Punkt etwas daneben (jitter). */
  const pr = seeded(SEED * 7 + 3);
  const between = (a, b) => a + pr() * (b - a);
  const spots = [];
  for (let i = 0; i < 6; i += 1) {
    let spot = null;
    for (let attempt = 0; attempt < 80 && spot === null; attempt += 1) {
      const x = between(14, 86), y = between(10, 34);
      if (spots.every((p) => Math.hypot(p.x - x, p.y - y) >= 12)) spot = { x, y };
    }
    spots.push(spot ?? { x: between(16, 84), y: between(12, 32) });
  }
  const players = spots.map((p) => {
    const jx = (pr() - 0.5) * 12, jy = (pr() - 0.5) * 10, delay = Math.round(pr() * 120) * 10;
    return { x: r2((p.x / 100) * W), y: r2((p.y / 100) * H), jx, jy, delay };
  });
  const rounds = Array.from({ length: ROUNDS }, (_, r) => {
    const rr = seeded(SEED * 17 + r * 997 + 11);
    const card = Math.floor(rr() * cardsX.length);
    const results = players.map(() => rr() < 0.6);
    const links = [];
    const pairs = new Set();
    for (let attempt = 1; links.length < 3 && attempt <= 30; attempt += 1) {
      const a = Math.floor(rr() * players.length), b = Math.floor(rr() * players.length);
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (a === b || pairs.has(key)) continue;
      pairs.add(key);
      links.push({ a, b, delay: attempt * 350 });
    }
    return { card, results, links };
  });
  /* Eine Stelle in Runde r: f (0–1) des Ablaufs von 8,6 s, ab `delay` ms. */
  const when = (r, f, delay = 0) => at(r * ROUND + delay + f * PLAY, TOTAL);

  const cards = cardsX.map((x, i) => {
    const lift = [{ at: 0, y: 0, scale: 1 }];
    const frame = [{ at: 0, opacity: 0 }];
    const halo = [{ at: 0, opacity: 0 }];
    rounds.forEach((round, r) => {
      if (round.card !== i) return;
      /* round-card-lift, round-card-highlight; die Karte der Runde trägt ihren hellen Rand. */
      lift.push({ at: when(r, 0.18), y: 0, scale: 1 }, { at: when(r, 0.3), y: -LIFT, scale: 1.02 }, { at: when(r, 0.6), y: -LIFT, scale: 1.01 }, { at: when(r, 1), y: 0, scale: 1 });
      frame.push({ at: at(r * ROUND, TOTAL), opacity: 0 }, { at: at(r * ROUND + 1, TOTAL), opacity: 1 }, { at: at((r + 1) * ROUND - 1, TOTAL), opacity: 1 }, { at: at((r + 1) * ROUND, TOTAL), opacity: 0 });
      halo.push({ at: when(r, 0.18), opacity: 0 }, { at: when(r, 0.32), opacity: 1 }, { at: when(r, 0.7), opacity: 1 }, { at: when(r, 1), opacity: 0 });
    });
    lift.push({ at: 1, y: 0, scale: 1 });
    frame.push({ at: 1, opacity: 0 });
    halo.push({ at: 1, opacity: 0 });
    return {
      type: 'group', x, y: restY,
      children: [
        { type: 'use', use: 'karta' },
        { type: 'rect', x: -70, y: -48, w: 140, h: 96, r: 12, fill: 'none', stroke: 'rgba(180, 230, 255, 0.75)', width: 1, opacity: 0, motion: loop(TOTAL, frame) },
        { type: 'rect', x: -74, y: -52, w: 148, h: 104, r: 14, fill: 'none', stroke: 'rgba(190, 235, 255, 0.6)', width: 1, glow: '0 0 14px rgba(170, 220, 255, 0.35)', opacity: 0, motion: loop(TOTAL, halo) }
      ],
      motion: loop(TOTAL, lift)
    };
  });

  /* round-ring über der gehobenen Karte — unsichtbar wandert er zur Karte der nächsten Runde. */
  const ring0 = cardsX[rounds[0].card];
  const ringKeys = [];
  rounds.forEach((round, r) => {
    const dx = r2(cardsX[round.card] - ring0);
    ringKeys.push({ at: at(r * ROUND, TOTAL), x: dx, opacity: 0, scale: 0.6 }, { at: when(r, 0.25), x: dx, opacity: 0, scale: 0.6 }, { at: when(r, 0.4), x: dx, opacity: 0.6, scale: 1 }, { at: when(r, 0.55), x: dx, opacity: 0, scale: 1.2 });
  });
  ringKeys.push({ at: 1, x: 0, opacity: 0, scale: 0.6 });

  /* round-player-breathe: die Vorlage „breathe", jeder mit seiner Verzögerung. */
  const playerEls = players.map((p) => ({
    type: 'circle', x: r2(p.x + p.jx), y: r2(p.y + p.jy), r: 5, fill: 'rgba(170, 220, 255, 0.6)', glow: '0 0 8px rgba(140, 200, 255, 0.55)',
    motion: { name: 'breathe', delay: p.delay }
  }));

  /* round-link-fade (5,8 s): die Spieler, die sich austauschen — kaum ein Strich, nur sein Schein. */
  const linkEls = rounds.flatMap((round, r) => round.links.map((l) => {
    const a = players[l.a], b = players[l.b];
    const t0 = r * ROUND + l.delay;
    return {
      type: 'line', x: a.x, y: a.y, x2: b.x, y2: b.y, stroke: 'rgba(170, 220, 255, 0.03)', width: 4, glow: '0 0 24px rgba(160, 220, 255, 1)', opacity: 0,
      motion: loop(TOTAL, [
        { at: 0, opacity: 0 }, { at: at(t0 + 0.15 * 5800, TOTAL), opacity: 0 }, { at: at(t0 + 0.35 * 5800, TOTAL), opacity: 0.85 },
        { at: at(t0 + 0.65 * 5800, TOTAL), opacity: 0.6 }, { at: at(t0 + 0.85 * 5800, TOTAL), opacity: 0 }, { at: 1, opacity: 0 }
      ])
    };
  }));

  /* round-flow (hin), round-return (zurück, grün oder rot), round-result (+ / −) — jeder Spieler 120 ms nach dem vorigen. */
  const GOOD = { color: 'rgba(120, 230, 170, 0.9)', glow: '0 0 10px rgba(120, 230, 170, 0.6)' };
  const BAD = { color: 'rgba(245, 120, 120, 0.9)', glow: '0 0 10px rgba(245, 120, 120, 0.6)' };
  const flows = players.flatMap((p, i) => {
    const delay = i * 120;
    const out = [{ at: 0, x: 0, y: 0, opacity: 0 }];
    const back = [];
    const plus = [{ at: 0, opacity: 0, y: 0, scale: 0.7 }];
    const minus = [{ at: 0, opacity: 0, y: 0, scale: 0.7 }];
    rounds.forEach((round, r) => {
      const card = { x: r2(cardsX[round.card] - p.x), y: r2(liftY - p.y) };
      out.push(
        { at: when(r, 0, delay), x: 0, y: 0, opacity: 0 }, { at: when(r, 0.25, delay), x: 0, y: 0, opacity: 0 }, { at: when(r, 0.35, delay), opacity: 1 },
        { at: when(r, 0.55, delay), ...card, opacity: 1 }, { at: when(r, 0.62, delay), opacity: 0 }, { at: when(r, 1, delay), ...card, opacity: 0 }
      );
      /* Die Farbe der Antwort steht die ganze Runde — sie wechselt, während der Punkt nicht zu sehen ist. */
      const tone = round.results[i] ? GOOD : BAD;
      back.push(
        { at: when(r, 0, delay), ...card, opacity: 0, ...tone }, { at: when(r, 0.55, delay), ...card, opacity: 0, ...tone }, { at: when(r, 0.68, delay), opacity: 1, ...tone },
        { at: when(r, 0.78, delay), x: 0, y: 0, opacity: 0.2, ...tone }, { at: when(r, 0.86, delay), x: 0, y: 0, opacity: 0, ...tone }
      );
      (round.results[i] ? plus : minus).push(
        { at: when(r, 0.72, delay), opacity: 0, y: 0, scale: 0.7 }, { at: when(r, 0.88, delay), opacity: 1, y: -10, scale: 1 }, { at: when(r, 1, delay), opacity: 0, y: -16, scale: 0.9 }
      );
    });
    out.push({ at: 1, x: 0, y: 0, opacity: 0 });
    const first = rounds[0].results[i] ? GOOD : BAD;
    back.unshift({ at: 0, x: r2(cardsX[rounds[0].card] - p.x), y: r2(liftY - p.y), opacity: 0, ...first });
    back.push({ at: 1, x: r2(cardsX[rounds[0].card] - p.x), y: r2(liftY - p.y), opacity: 0, ...first });
    plus.push({ at: 1, opacity: 0, y: 0, scale: 0.7 });
    minus.push({ at: 1, opacity: 0, y: 0, scale: 0.7 });
    const pop = (text, fill, glow, keys) => ({ type: 'text', x: p.x, y: p.y, text, size: 16, weight: 600, fill, glow, opacity: 0, motion: loop(TOTAL, keys) });
    return [
      { type: 'circle', x: p.x, y: p.y, r: 3, fill: 'rgba(170, 220, 255, 0.85)', opacity: 0, motion: loop(TOTAL, out) },
      { type: 'circle', x: p.x, y: p.y, r: 3, fill: first.color, opacity: 0, motion: loop(TOTAL, back) },
      ...(plus.length > 2 ? [pop('+', 'rgba(120, 230, 170, 0.95)', '0 0 10px rgba(120, 230, 170, 0.8)', plus)] : []),
      ...(minus.length > 2 ? [pop('−', 'rgba(255, 120, 120, 0.95)', '0 0 10px rgba(255, 120, 120, 0.8)', minus)] : [])
    ];
  });

  return {
    alt: 'Wspólna runda: karta pytania unosi się, odpowiedzi graczy lecą do niej i wracają z wynikiem',
    size: [520, 390],
    symbols: [{
      name: 'karta', shapes: [
        { type: 'rect', x: -70, y: -48, w: 140, h: 96, r: 12, fill: 'rgba(10, 24, 38, 0.72)', stroke: 'rgba(140, 200, 255, 0.35)', width: 1, glow: '0 12px 18px rgba(5, 12, 20, 0.35)' },
        { type: 'rect', x: -58, y: -38, w: 63.8, h: 7, r: 3.5, fill: 'rgba(200, 230, 255, 0.8)' },
        { type: 'rect', x: -58, y: -25, w: 116, h: 5, r: 2.5, fill: 'rgba(160, 210, 255, 0.4)' },
        { type: 'rect', x: -58, y: -14, w: 81.2, h: 5, r: 2.5, fill: 'rgba(160, 210, 255, 0.3)' }
      ]
    }],
    elements: [
      ...cards,
      { type: 'circle', x: ring0, y: liftY, r: 23, fill: 'none', stroke: 'rgba(170, 220, 255, 0.6)', width: 1, opacity: 0, motion: loop(TOTAL, ringKeys) },
      ...playerEls,
      ...linkEls,
      ...flows
    ]
  };
}

/* == Postęp ===================================================================================== */

function progressDrawing() {
  const SEED = 3;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  /* Die eigene Linie: von (40, 160) nach (260, 48) in sechs Schritten — erst langsam, dann steil. */
  const rand = seeded(SEED * 5 + 1);
  const start = { x: 40, y: 160 }, finish = { x: 260, y: 48 };
  const weights = [0.3, 0.45, 0.6, 0.65, 1.4, 2.2];
  const sum = weights.reduce((a, b) => a + b, 0);
  const points = [start];
  let x = start.x, y = start.y;
  for (let i = 1; i <= 6; i += 1) {
    const jx = (rand() - 0.5) * 14, jy = (rand() - 0.5) * 28;
    x = Math.max(start.x + i * 14, Math.min(finish.x - (6 - i) * 14, x + (finish.x - start.x) / 6 + jx));
    y = y - ((start.y - finish.y) * weights[i - 1]) / sum + jy;
    points.push({ x: Math.round(x), y: Math.round(Math.max(finish.y, Math.min(start.y - 4, y))) });
  }
  points[6] = finish;
  /* Das Band der Gruppe. */
  const rr = seeded(SEED * 5 + 2);
  const upper = points.map((p) => ({ x: clamp(p.x, 40, 260), y: clamp(p.y - (10 + rr() * 36), 40, 140) }));
  const lower = points.map((p, i) => ({ x: clamp(p.x, 40, 260), y: clamp(Math.max(upper[i].y + 10, p.y + 12 + rr() * 40), 60, 170) }));
  /* Zwei andere: einer darüber, einer darunter — ab dem fünften Schritt nah an der eigenen Linie. */
  const qr = seeded(SEED * 5 + 3);
  const peer = (bias, minOff, maxOff) => points.map((p, i) => {
    const a = clamp(p.y + minOff, upper[i].y + 6, lower[i].y - 6), b = clamp(p.y + maxOff, upper[i].y + 6, lower[i].y - 6);
    return { x: p.x, y: clamp(p.y + bias + (qr() - 0.5) * 70, Math.min(a, b), Math.max(a, b)) };
  });
  const higher = peer(-14 + qr() * 28, -80, 12);
  const below = peer(14 + qr() * 28, -12, 80);
  for (let i = 4; i < 7; i += 1) {
    higher[i] = { x: points[i].x, y: clamp(points[i].y - 12, upper[i].y + 6, lower[i].y - 6) };
    below[i] = { x: points[i].x, y: clamp(points[i].y + 12, upper[i].y + 6, lower[i].y - 6) };
  }
  higher[6] = { x: points[6].x, y: clamp(points[6].y - 14, upper[6].y, lower[6].y) };
  below[6] = { x: points[6].x, y: clamp(points[6].y + 12, upper[6].y, lower[6].y) };
  const mid = Math.max(0, Math.min(240, points[4].x - 40));

  /* Der Wykres des Altbestands: 300 × 200, ohne Seitenverhältnis über 520 × 300 gezogen, rechts in 560 × 430. */
  const X = (px) => r2(40 + px * (520 / 300));
  const Y = (py) => r2(py * 1.5);
  const CYCLE = 24000;
  const linear = (keys, extra = {}) => loop(CYCLE, keys, { ease: 'linear', ...extra });
  /* chart-seg-1…6, chart-peer-seg-1…6: jeder Schritt zeichnet sich in seinem Abschnitt der 24 s. */
  const MAIN = [[0, 0.09], [0.09, 0.14], [0.14, 0.19], [0.19, 0.25], [0.75, 0.83333], [0.83333, 0.91667]];
  const PEER = [[0.33334, 0.38666], [0.38667, 0.42], [0.42001, 0.45333], [0.45334, 0.5], [0.75001, 0.83333], [0.83334, 0.91667]];
  const seg = (a, b, [from, to], isPeer) => ({
    type: 'line', x: X(a.x), y: Y(a.y), x2: X(b.x), y2: Y(b.y),
    stroke: isPeer ? 'rgba(165, 220, 255, 0.85)' : 'rgba(200, 245, 255, 1)', width: isPeer ? 2.6 : 3.8,
    motion: linear(isPeer
      ? [{ at: 0, opacity: 0, draw: 0 }, { at: r5(from - 0.00001), opacity: 0, draw: 0 }, { at: from, opacity: 1, draw: 0 }, { at: to, draw: 1 }, { at: 1, opacity: 1, draw: 1 }]
      : [{ at: 0, draw: 0 }, ...(from > 0 ? [{ at: from, draw: 0 }] : []), { at: to, draw: 1 }, { at: 1, draw: 1 }])
  });

  /* Der Kreis des Vergleichs unter dem Wykres (52 % / 122 % des Kastens, 120 px), die Punkte darauf auf 68 % des Halbmessers. */
  const orbit = { x: r2(40 + 0.52 * 520), y: r2(1.22 * 300), r: 60 };
  const dotR = r2(orbit.r * 0.68);
  const around = (from, to, t0, t1, base) => Array.from({ length: 13 }, (_, k) => {
    const angle = ((from + (to - from) * (k / 12)) * Math.PI) / 180;
    return { at: r5(t0 + (t1 - t0) * (k / 12)), x: r2(orbit.x + dotR * Math.cos(angle) - base.x), y: r2(orbit.y + dotR * Math.sin(angle) - base.y) };
  });
  const rel = (p, base) => ({ x: r2(X(p.x) - base.x), y: r2(Y(p.y) - base.y) });

  /* chart-dot-step: der eigene Punkt läuft die Linie entlang, kreist (0° → 180°), und läuft weiter. */
  const mainBase = { x: X(points[0].x), y: Y(points[0].y) };
  const mainKeys = [
    { at: 0, ...rel(points[0], mainBase) }, { at: 0.09, ...rel(points[1], mainBase) }, { at: 0.14, ...rel(points[2], mainBase) }, { at: 0.19, ...rel(points[3], mainBase) },
    { at: 0.25, ...rel(points[4], mainBase) }, { at: 0.5, ...rel(points[4], mainBase) },
    ...around(0, 180, 0.54167, 0.66667, mainBase),
    { at: 0.70833, ...rel(points[4], mainBase) }, { at: 0.75, ...rel(points[4], mainBase) }, { at: 0.83333, ...rel(points[5], mainBase) },
    { at: 0.91667, ...rel(points[6], mainBase) }, { at: 0.95, ...rel(points[6], mainBase) }, { at: 1, x: 0, y: 0 }
  ];
  /* chart-peer-dot-1/2: die anderen kommen ab einem Drittel, kreisen um 120° und 240° versetzt. */
  const peerDot = (line, from, to) => {
    const base = { x: X(line[0].x), y: Y(line[0].y) };
    return {
      type: 'circle', x: base.x, y: base.y, r: 3.5, fill: 'rgba(175, 230, 255, 0.9)', glow: '0 0 10px rgba(160, 220, 255, 0.7)', opacity: 0,
      motion: linear([
        { at: 0, x: 0, y: 0, opacity: 0 }, { at: 0.33334, x: 0, y: 0, opacity: 0 }, { at: 0.38666, ...rel(line[1], base), opacity: 1 },
        { at: 0.42, ...rel(line[2], base) }, { at: 0.45333, ...rel(line[3], base) }, { at: 0.5, ...rel(line[4], base) },
        ...around(from, to, 0.54167, 0.66667, base),
        { at: 0.70833, ...rel(line[4], base) }, { at: 0.75, ...rel(line[4], base) }, { at: 0.83333, ...rel(line[5], base) },
        { at: 0.91667, ...rel(line[6], base) }, { at: 1, ...rel(line[6], base), opacity: 1 }
      ])
    };
  };
  /* chart-orbit-triangle(-fast, -slow) mit chart-orbit-fill und chart-orbit-glow: ein Dreieck im Kreis (Spitze rechts), um seine Mitte gedreht. */
  const triangle = ({ size, rgb, alpha, srgb, salpha, width, spin, scales, opacity }) => {
    const half = size / 2;
    const p = (u, v) => `${r2(orbit.x - half + (u / 100) * size)} ${r2(orbit.y - half + (v / 100) * size)}`;
    const [before, onset, top, gone] = scales;
    const flash = (fo, so, glow) => ({ color: `rgba(${rgb}, ${r2(alpha * fo)})`, stroke: `rgba(${srgb}, ${r2(salpha * so)})`, glow });
    const dark = '0 0 0px rgba(140, 210, 255, 0)';
    return {
      type: 'path', d: `M${p(100, 50)} L${p(25, 93.3)} L${p(25, 6.7)} Z`, fill: `rgba(${rgb}, 0)`, stroke: `rgba(${srgb}, ${r2(salpha * 0.25)})`, width,
      opacity: 0, origin: `${orbit.x} ${orbit.y}`,
      motion: [
        linear([
          { at: 0, opacity: 0, rotate: 0, scale: before }, { at: 0.54166, opacity: 0, rotate: 0, scale: before }, { at: 0.54167, opacity, rotate: 0, scale: onset },
          { at: 0.66667, opacity, rotate: spin, scale: top }, { at: 0.70833, opacity: 0, rotate: spin, scale: gone }, { at: 1, opacity: 0, rotate: spin, scale: gone }
        ]),
        linear([
          { at: 0, ...flash(0, 0.25, dark) }, { at: 0.54166, ...flash(0, 0.25, dark) },
          { at: 0.58, ...flash(0.45, 1, '0 0 14px rgba(140, 210, 255, 0.7)') }, { at: 0.62, ...flash(0.2, 0.55, '0 0 8px rgba(140, 210, 255, 0.45)') },
          { at: 0.66667, ...flash(0.4, 0.95, '0 0 16px rgba(140, 210, 255, 0.75)') }, { at: 0.70833, ...flash(0, 0.2, dark) }, { at: 1, ...flash(0, 0.2, dark) }
        ])
      ]
    };
  };
  const pathOf = (line) => line.map((q, i) => `${i === 0 ? 'M' : 'L'}${X(q.x)} ${Y(q.y)}`).join(' ');
  /* Die Blende des Bandes: rechts von x = 40 + Breite (Einheiten des Wykres) bleibt zu (0 → bis zum vierten Schritt → 240). */
  const band = (w) => `inset(0px ${r2(560 - X(40 + w))}px 0px 0px)`;
  /* chart-clip-reveal: erst nur die linke untere Ecke des Kastens (inset 30 % 30 % −100 % −100 %), dann der ganze Kasten. */
  const SMALL = 'inset(90px 156px -170px -480px)';
  const FULL = 'inset(0px 0px 130px 40px)';

  const content = {
    type: 'group', origin: '170 225',
    children: [
      ...[40, 75, 110, 145, 180, 215, 250].map((gx) => ({ type: 'line', x: X(gx), y: Y(30), x2: X(gx), y2: Y(170), stroke: 'rgba(130, 190, 245, 0.18)', width: 1.6, opacity: 0.8 })),
      ...[170, 150, 130, 110, 90, 70, 50].map((gy) => ({ type: 'line', x: X(40), y: Y(gy), x2: X(260), y2: Y(gy), stroke: 'rgba(130, 190, 245, 0.18)', width: 1.6, opacity: 0.8 })),
      {
        type: 'group',
        children: [
          { type: 'line', x: X(40), y: Y(170), x2: X(260), y2: Y(170), stroke: 'rgba(170, 220, 255, 0.55)', width: 2.2 },
          { type: 'line', x: X(40), y: Y(170), x2: X(40), y2: Y(30), stroke: 'rgba(170, 220, 255, 0.55)', width: 2.2 }
        ],
        /* chart-axes-in: einmal, 1,2 s nach 0,2 s. */
        motion: { name: 'fade', from: 0, to: 1, duration: 1200, delay: 200, ease: 'linear' }
      },
      ...points.slice(0, -1).map((q, i) => seg(q, points[i + 1], MAIN[i], false)),
      {
        type: 'group',
        children: [
          { type: 'path', d: `${pathOf(upper)} ${lower.slice().reverse().map((q) => `L${X(q.x)} ${Y(q.y)}`).join(' ')} Z`, fill: 'rgba(130, 195, 245, 0.24)', opacity: 0.85 },
          { type: 'path', d: pathOf(upper), fill: 'none', stroke: 'rgba(170, 230, 255, 0.75)', width: 2.6, opacity: 0.8 },
          { type: 'path', d: pathOf(lower), fill: 'none', stroke: 'rgba(170, 230, 255, 0.75)', width: 2.6, opacity: 0.8 }
        ],
        /* chart-range-opacity, die Blende des Bandes, chart-fade-out. */
        opacity: 0,
        motion: [
          linear([{ at: 0, opacity: 0 }, { at: 0.16667, opacity: 0 }, { at: 0.29167, opacity: 0.9 }, { at: 0.6, opacity: 0.7 }, { at: 1, opacity: 0.7 }]),
          linear([{ at: 0, clip: band(0) }, { at: 0.25, clip: band(0) }, { at: 0.3125, clip: band(mid) }, { at: 0.75, clip: band(mid) }, { at: 0.91667, clip: band(240) }, { at: 1, clip: band(240) }]),
          linear([{ at: 0, opacity: 0 }, { at: 0.02, opacity: 1 }, { at: 0.95, opacity: 1 }, { at: 1, opacity: 0 }])
        ]
      },
      ...[higher, below].flatMap((line) => line.slice(0, -1).map((q, i) => seg(q, line[i + 1], PEER[i], true))),
      {
        type: 'circle', x: orbit.x, y: orbit.y, r: orbit.r, fill: 'rgba(10, 22, 36, 0.45)', stroke: 'rgba(170, 220, 255, 0.45)', width: 1.5, glow: '0 0 14px rgba(160, 220, 255, 0.18)', opacity: 0,
        motion: linear([{ at: 0, opacity: 0, scale: 0.92 }, { at: 0.49999, opacity: 0, scale: 0.92 }, { at: 0.54167, opacity: 0.7, scale: 1 }, { at: 0.66667, opacity: 0.7, scale: 1 }, { at: 0.75, opacity: 0, scale: 0.98 }, { at: 1, opacity: 0, scale: 0.98 }])
      },
      triangle({ size: dotR * 2, rgb: '140, 210, 255', alpha: 0.2, srgb: '185, 235, 255', salpha: 0.7, width: 1.8, spin: 180, scales: [1, 1, 1, 1], opacity: 0.7 }),
      triangle({ size: dotR * 2.3, rgb: '120, 200, 255', alpha: 0.08, srgb: '160, 220, 255', salpha: 0.35, width: 1.1, spin: 720, scales: [1.2, 1.1, 0.15, 0.1], opacity: 0.55 }),
      triangle({ size: dotR * 2.3, rgb: '120, 200, 255', alpha: 0.08, srgb: '160, 220, 255', salpha: 0.35, width: 1.1, spin: 360, scales: [1.3, 1.15, 0.25, 0.2], opacity: 0.45 }),
      { type: 'circle', x: mainBase.x, y: mainBase.y, r: 5, fill: 'rgba(210, 245, 255, 0.95)', glow: '0 0 12px rgba(180, 230, 255, 0.75)', motion: linear(mainKeys) },
      peerDot(higher, 120, 300),
      peerDot(below, 240, 420)
    ],
    /* chart-loop-fade (×1,5 heran, dann das Ganze, um 25 % / 75 % des Kastens) und chart-clip-reveal. */
    motion: [
      linear([{ at: 0, opacity: 0, scale: 1.5 }, { at: 0.02, opacity: 1, scale: 1.5 }, { at: 0.70833, opacity: 1, scale: 1.5 }, { at: 0.75, opacity: 1, scale: 1 }, { at: 0.91667, opacity: 1, scale: 1 }, { at: 0.95, opacity: 0.2, scale: 1.2 }, { at: 1, opacity: 0, scale: 1.5 }]),
      linear([{ at: 0, clip: SMALL }, { at: 0.72833, clip: SMALL }, { at: 0.75, clip: FULL }, { at: 0.89, clip: FULL }, { at: 0.98, clip: SMALL }, { at: 1, clip: SMALL }])
    ]
  };

  return {
    alt: 'Postęp: własna linia rośnie krok po kroku, pasmo grupy, dwie inne osoby, krąg porównania',
    size: [560, 430],
    elements: [
      { type: 'rect', x: 40, y: 0, w: 520, h: 300, r: 18, fill: 'rgba(10, 22, 36, 0.28)', stroke: 'rgba(150, 200, 245, 0.22)', width: 1 },
      content
    ]
  };
}

/* == Tarcza ===================================================================================== */

function shieldDrawing() {
  const ink = 'rgba(175, 220, 255, 0.85)';
  return {
    alt: 'Tarcza: otwarte, ale chronione',
    size: [180, 220],
    elements: [
      /* .cogita-shield-glow: inset 10 %, ein runder Schein — cogita-shield-glow ist die Vorlage „glow". */
      { type: 'ellipse', x: 90, y: 110, w: 144, h: 176, fill: 'radial(rgba(120, 190, 255, 0.25), transparent)', opacity: 0.35, motion: { name: 'glow' } },
      {
        /* Das Bild 120 × 140 in 180 × 220 (xMidYMid meet): ×1,5, 5 von oben. */
        type: 'group', y: 5, scale: 1.5,
        children: [
          /* Strich 420 bei einer Länge von 337 (Kontur) und 50 (Haken): beide sind vor dem Ende fertig — der Haken früh. */
          { type: 'path', d: 'M60 10l42 16v44c0 30-19 54-42 62C37 124 18 100 18 70V26z', fill: 'none', stroke: ink, width: 4, motion: { name: 'draw', from: 0, to: 1.245 } },
          { type: 'path', d: 'M44 66l10 12 22-26', fill: 'none', stroke: ink, width: 4, motion: { name: 'draw', from: 0, to: 8.45 } }
        ]
      }
    ]
  };
}

/* == Die Szenen ================================================================================= */

/** CSS `saturate(s)` — dieselbe Matrix wie im Browser, auf eine Farbe angewandt (die Sättigung der Themen des Altbestands). */
function saturate([r, g, b], s) {
  const m = [[0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s], [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s], [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]];
  return m.map((row) => Math.max(0, Math.min(255, Math.round(row[0] * r + row[1] * g + row[2] * b))));
}
const rgbOf = (hex) => { const n = Number.parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hexOf = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const satHex = (hex, s) => hexOf(saturate(rgbOf(hex), s));
const satRgba = (rgba, s) => {
  const [r, g, b, a] = /rgba\(([^)]+)\)/.exec(rgba)[1].split(',').map((v) => Number(v.trim()));
  const [R, G, B] = saturate([r, g, b], s);
  return `rgba(${R}, ${G}, ${B}, ${a})`;
};

/** Die sieben Themen (CogitaPage.tsx: introSlides, theme). */
const THEMES = {
  entry: { bg0: '#06162a', bg1: '#0c2d49', bg2: '#0a1c2f', bloom: 'rgba(120, 170, 220, 0.18)', sat: 1 },
  workspace: { bg0: '#071a2a', bg1: '#0b3b56', bg2: '#081f33', bloom: 'rgba(129, 190, 235, 0.18)', sat: 1.05 },
  library: { bg0: '#071a2f', bg1: '#0c2f4a', bg2: '#081f33', bloom: 'rgba(120, 175, 230, 0.14)', sat: 0.96 },
  live: { bg0: '#07182d', bg1: '#0c2a4a', bg2: '#081f35', bloom: 'rgba(115, 170, 225, 0.15)', sat: 0.98 },
  quiz: { bg0: '#071526', bg1: '#0d2946', bg2: '#081a30', bloom: 'rgba(120, 175, 230, 0.14)', sat: 0.97 },
  protection: { bg0: '#071a2a', bg1: '#0a2742', bg2: '#07192d', bloom: 'rgba(150, 200, 240, 0.16)', sat: 1 },
  register: { bg0: '#081c30', bg1: '#0f3754', bg2: '#0b2239', bloom: 'rgba(160, 210, 245, 0.2)', sat: 1.05 }
};

/** Der Schlüssel einer Szene ist der Anker der Adresse (#mapa-wiedzy) — wie die Buttons dorthin springen. */
const anchor = (label) => label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const SCENES = [
  { legacy: 'entry', label: 'Cogita' },
  { legacy: 'workspace', label: 'Mapa wiedzy', drawing: mapDrawing, max: 27.5 },
  { legacy: 'library', label: 'Biblioteka', drawing: cardsDrawing, max: 35 },
  { legacy: 'live', label: 'Na żywo', drawing: roundDrawing, max: 32.5 },
  { legacy: 'quiz', label: 'Postęp', drawing: progressDrawing, max: 35 },
  { legacy: 'protection', label: 'Ochrona', drawing: shieldDrawing, max: 11.25 },
  { legacy: 'register', label: 'Dołącz' }
].map((one) => ({ ...one, key: anchor(one.label) }));

const scenes = SCENES.map((sc) => {
  const t = THEMES[sc.legacy];
  return {
    key: sc.key, label: sc.label,
    /* .cogita-intro-slide: 480 ms, 12 px, Unschärfe 2 px. */
    change: 'dissolve',
    colors: { ground: satHex(t.bg0, t.sat) },
    /* Das Thema der Szene: der Verlauf bg0 → bg1 → bg2 (180°) und der Schein (closest-side at 58% 42%) — im Tuch gehen sie ineinander über. */
    layers: [
      { kind: 'gradient', speed: 0, angle: 180, from: satHex(t.bg0, t.sat), via: satHex(t.bg1, t.sat), to: satHex(t.bg2, t.sat) },
      { kind: 'glow', speed: 0, color: satRgba(t.bloom, t.sat), x: 58, y: 42, size: 60, opacity: 1, blend: 'normal' }
    ]
  };
});

/* Das gemeinsame Tuch (.cogita-home-bg): Ecken, Dunst (cogita-depth 18 s), Nici (je Schicht 180–400 s), Fale (still wie im Altbestand). */
const backdrop = [
  { kind: 'vignette', speed: 0, strength: 0.35, reach: 55, color: '#000000' },
  { kind: 'haze', speed: 0, color: 'rgba(120, 170, 220, 0.08)', depth: 'rgba(30, 60, 100, 0.1)', blur: 60, opacity: 0.35, motion: { name: 'drift' } },
  { kind: 'mesh', speed: 0, seed: 2026, count: 4, color: 'rgba(143, 208, 255, 0.25)', glow: 'rgba(167, 224, 255, 0.35)', center: 0.82, amplitude: 1, opacity: 0.9, dust: true, motion: { name: 'sway' } },
  { kind: 'waves', speed: 0, seed: 7, count: 6, hue: 188, spread: 32, opacity: 1, blur: 1, motion: [] }
];

/* -- Das Zeichen: zwanzig Ebenen ---------------------------------------------------------------- */

const LOGO = (n) => `/cogita/logo/Cogita${String(n).padStart(2, '0')}.png`;
/** Die Blasen (.cogita-logo-layer.is-bubble:nth-child(n)): Ausschlag und Dauer je Blase. */
const BUBBLES = [[4, 6, 3800], [6, 8, 4200], [-5, 7, 3600], [8, -4, 4600], [-7, 5, 4000], [5, -6, 3400], [-4, 9, 4800], [7, -5, 3900], [-6, 6, 4400], [5, 5, 3700], [-5, -4, 4100], [6, 8, 4200]];
/** Die Buchstaben (nth-child 13–18) und „REcreatio" (19, 20): wann sie sich setzen. */
const LETTERS = [0, 90, 180, 260, 340, 420];
const RECREATIO = [520, 620];
const logoLayers = [
  ...BUBBLES.map(([x, y, duration], i) => ({ url: LOGO(i), z: 3, shadow: '0 26px 60px rgba(8, 20, 38, 0.6)', motion: { name: 'float', x, y, duration } })),
  ...LETTERS.map((delay, i) => ({ url: LOGO(12 + i), z: 2, shadow: '0 30px 70px rgba(8, 20, 38, 0.6)', motion: { name: 'assemble', delay } })),
  ...RECREATIO.map((delay, i) => ({ url: LOGO(18 + i), z: 1, motion: { name: 'assemble', delay } }))
];

/**
 * Wo das Zeichen steht (cogita-intro.css, „layout overrides"): auf der ersten
 * Szene rechts gross (70 %, ×1,08), auf den mittleren links klein (16 %, ×0,5,
 * Deckkraft .82), auf der letzten links (25 %, ×0,95) — Breite min(44 %, 32,5 rem).
 * Hochkant: oben, auf den mittleren klein in der Ecke. Zwischen den Szenen
 * wandert es (ein Baustein mit Plätzen in mehreren Szenen).
 */
const logoPlaces = Object.fromEntries(SCENES.map((sc, i) => {
  const place = i === 0 ? { x: 70, y: 50, w: 44, max: 32.5, scale: 1.08, tall: { x: 50, y: 20, w: 52, scale: 1.05 } }
    : i === SCENES.length - 1 ? { x: 25, y: 50, w: 44, max: 32.5, scale: 0.95, tall: { x: 50, y: 22, w: 50, scale: 1 } }
    : { x: 16, y: 50, w: 44, max: 32.5, scale: 0.5, opacity: 0.82, tall: { x: 11, y: 6, w: 44, scale: 0.32 } };
  return [sc.key, place];
}));

/* -- Die Bausteine ------------------------------------------------------------------------------ */

const copy = new Map(pl.cogita.introSlides.map((one) => [one.id, one]));
const modules = [];
const reports = [];

modules.push({
  id: 'znak', kind: 'layers', size: { colSpan: 3, rowSpan: 3 },
  show: { places: logoPlaces, skin: 'plain', arrive: 'none', hold: true, layer: 12, ease: 'inOut' },
  config: { alt: 'Cogita', layers: logoLayers }
});

SCENES.forEach((sc, i) => {
  const text = copy.get(sc.legacy);
  const first = i === 0, last = i === SCENES.length - 1;
  const body = (text.body ?? text.subtitle ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== '');
  /*
   * Wo der Text steht — die Spalten des Altbestands (1160 px, 0.8fr 1fr 0.8fr; auf der ersten und letzten 1fr 1fr)
   * in der Bühne von 80 rem: links neben dem Zeichen, in der Mitte, rechts. Hochkant: unter dem Bild.
   */
  const place = first ? { x: 26.4, y: 50, w: 43, max: 35, tall: { x: 50, y: 72, w: 88 } }
    : last ? { x: 73.6, y: 50, w: 43, max: 35, tall: { x: 50, y: 74, w: 88 } }
    : { x: 50, y: 50, w: 32, max: 26, tall: { x: 50, y: 67, w: 88 } };
  modules.push({
    id: `${sc.key}-tekst`, kind: 'hero', size: { colSpan: 6, rowSpan: 3 },
    show: {
      places: { [sc.key]: place }, skin: 'plain', arrive: 'none',
      /* cogita-text-delayed: der Text wartet, bis die Szene da ist (220 ms; auf der Mapa 1000 ms — erst geht der Wanderer los). */
      ...(first ? {} : { motion: { name: 'rise', delay: i === 1 ? 1000 : 220 } })
    },
    config: {
      badge: 'Cogita', badgeLook: 'kicker', size: first ? 'display' : 'title',
      headline: text.title, lede: null, paragraphs: body,
      actions: last
        ? [{ label: text.cta, href: '#/workspace', variant: 'cta' }, ...(text.secondary ? [{ label: text.secondary, href: `#${SCENES[0].key}`, variant: 'ghost' }] : [])]
        : [{ label: text.cta, href: `#${SCENES[i + 1].key}`, variant: 'cta' }],
      footnote: text.micro ?? null
    }
  });
  if (sc.drawing !== undefined) {
    const { report, ...drawing } = sc.drawing();
    if (report !== undefined) reports.push(`${sc.key}: ${report}`);
    const shield = sc.legacy === 'protection';
    /* Das Bild in der dritten Spalte (rechts, bis 520 px breit); hochkant über dem Text. */
    modules.push({
      id: `${sc.key}-obraz`, kind: 'animation', size: { colSpan: 3, rowSpan: 3 },
      show: {
        places: { [sc.key]: shield ? { x: 82.5, y: 50, w: 14, max: sc.max, tall: { x: 50, y: 27, w: 42 } } : { x: 82.5, y: 50, w: 26, max: sc.max, tall: { x: 50, y: 27, w: 84 } } },
        skin: 'plain', arrive: 'none'
      },
      config: drawing
    });
  }
});

/* -- Knapp, wie die Seite es selbst schreibt ---------------------------------------------------- */

const canonical = (one) => {
  const def = partOf(one.kind);
  const stored = def.json.fromJson(one.config);
  const size = JSON.stringify(stored).length;
  if (size > 64000) throw new Error(`${one.id}: the stored config has ${size} characters (at most 64000)`);
  return { ...one, show: pieceJson(readPieceValue(one.show)), config: def.json.toJson(stored), stored: size };
};

const canon = modules.map(canonical);
const doc = {
  format: 'recreatio/page',
  version: 1,
  path: 'cogita',
  title: 'Cogita',
  lead: null,
  mode: 'presentation',
  theme: { mode: 'dark', accent: '#7ec8ff', ink: '#f4f7fb', ground: '#06162a', muted: '#bcc8d9' },
  cover: [],
  show: showJson(readShow({ format: 'screen', fonts: 'cormorant', nav: 'dots', width: 80, backdrop, scenes })),
  modules: canon.map(({ stored, ...one }) => one)
};

const out = join(root, 'scripts', 'fixtures', 'cogita-home.json');
const text = JSON.stringify(doc, null, 2) + '\n';
await writeFile(out, text);
console.log(`written ${out} — ${scenes.length} scenes, ${modules.length} modules, ${text.length} bytes`);
console.log(`stored configs: ${canon.map((m) => `${m.id} ${m.stored}`).join(', ')}`);
for (const line of reports) console.log(line);
process.exit(0);
