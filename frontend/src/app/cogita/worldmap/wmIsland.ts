/**
 * 2026-11-09 — DIE WELT ALS INSEL (Wunsch des Eigentümers): ein wenig Gelände, damit die Karte wie eine Landschaft wirkt.
 * <code>
 *   Insel    die Vereinigung von Scheiben um jede Säule, das Haus und die Gleise — so folgt die Küste der Gestalt der Welt;
 *            der Strand liegt AUSSEN um das Land (BEACH breiter), ringsum Wasser
 *   Bäume    deterministisch gestreut (derselbe Stand, dieselben Bäume), nur auf festem Land, nie auf einer Säule, ihrem Ring
 *            oder einem Gleis; höchstens MAX_TREES
 * </code>
 * Rein (ohne Canvas): der Zeichner (`WorldPillars.tsx`) malt es einmal je Stand in den Boden.
 */

/** Eine Scheibe der Insel: Mitte und Halbmesser (Weltkoordinaten). */
export type Disc = readonly [number, number, number];
/** Ein Baum: Mitte und Grösse. */
export type Tree = readonly [number, number, number];

export interface IslandInput {
  readonly places: readonly { readonly x: number; readonly y: number; readonly r: number }[];
  readonly home: { readonly x: number; readonly y: number; readonly r: number } | null;
  readonly tracks: readonly { readonly points: readonly number[] }[];
}

export interface Island {
  /** Das Land (der Strand: dieselben Scheiben, um BEACH grösser, darunter gemalt). */
  readonly land: readonly Disc[];
  readonly trees: readonly Tree[];
}

/** Wie weit das Land über eine Säule hinausreicht, wie breit der Strand ist (Einheiten). */
export const SHORE = 105;
export const BEACH = 14;
/** Abstand der Bäume von Säulen und Gleisen (Einheiten). */
export const TREE_CLEAR = 20;
export const MAX_TREES = 1800;
const STEP = 36;

const hash = (x: number, y: number, k: number): number => {
  let h = (Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(k, 83492791)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

/** Abstand eines Punktes zu einer Strecke. */
const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const l2 = (bx - ax) ** 2 + (by - ay) ** 2;
  const k = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2));
  return Math.hypot(px - (ax + (bx - ax) * k), py - (ay + (by - ay) * k));
};

export function islandOf(input: IslandInput): Island {
  const land: Disc[] = [];
  for (const p of input.places) land.push([p.x, p.y, p.r + SHORE]);
  if (input.home !== null) land.push([input.home.x, input.home.y, input.home.r + SHORE]);
  /* Die Gleise: Scheiben in Abständen entlang (eine Strecke zwischen fernen Säulen bleibt Land). */
  for (const t of input.tracks) {
    const p = t.points;
    for (let i = 2; i < p.length; i += 2) {
      const len = Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
      const n = Math.max(1, Math.ceil(len / 40));
      for (let j = 0; j <= n; j += 1) land.push([p[i - 2] + ((p[i] - p[i - 2]) * j) / n, p[i - 1] + ((p[i + 1] - p[i - 1]) * j) / n, 72]);
    }
  }
  if (land.length === 0) return { land, trees: [] };

  /* Ein Raster für die Prüfungen (Land, Säulen, Gleise). */
  const cell = 120;
  const key = (x: number, y: number) => `${Math.floor(x / cell)}:${Math.floor(y / cell)}`;
  const put = <T>(grid: Map<string, T[]>, x0: number, y0: number, x1: number, y1: number, v: T) => {
    for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx += 1) for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy += 1) {
      const k = `${gx}:${gy}`; const l = grid.get(k) ?? []; l.push(v); grid.set(k, l);
    }
  };
  const landGrid = new Map<string, Disc[]>();
  for (const d of land) put(landGrid, d[0] - d[2], d[1] - d[2], d[0] + d[2], d[1] + d[2], d);
  const solidGrid = new Map<string, Disc[]>();
  for (const p of input.places) { const r = p.r * 1.25 + 9 + TREE_CLEAR; put(solidGrid, p.x - r, p.y - r, p.x + r, p.y + r, [p.x, p.y, r] as Disc); }
  if (input.home !== null) { const h = input.home; const r = h.r + TREE_CLEAR + 10; put(solidGrid, h.x - r, h.y - r, h.x + r, h.y + r, [h.x, h.y, r] as Disc); }
  const segGrid = new Map<string, (readonly [number, number, number, number])[]>();
  for (const t of input.tracks) {
    const p = t.points;
    for (let i = 2; i < p.length; i += 2) {
      const s = [p[i - 2], p[i - 1], p[i], p[i + 1]] as const;
      put(segGrid, Math.min(s[0], s[2]) - TREE_CLEAR, Math.min(s[1], s[3]) - TREE_CLEAR, Math.max(s[0], s[2]) + TREE_CLEAR, Math.max(s[1], s[3]) + TREE_CLEAR, s);
    }
  }
  /* Festes Land: innerhalb einer Scheibe, mindestens den Strand und etwas vom Rand entfernt. */
  const onLand = (x: number, y: number) => (landGrid.get(key(x, y)) ?? []).some((d) => Math.hypot(x - d[0], y - d[1]) < d[2] - 10);
  const clear = (x: number, y: number) => !(solidGrid.get(key(x, y)) ?? []).some((d) => Math.hypot(x - d[0], y - d[1]) < d[2])
    && !(segGrid.get(key(x, y)) ?? []).some((s) => segDist(x, y, s[0], s[1], s[2], s[3]) < TREE_CLEAR);

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const d of land) { x0 = Math.min(x0, d[0] - d[2]); y0 = Math.min(y0, d[1] - d[2]); x1 = Math.max(x1, d[0] + d[2]); y1 = Math.max(y1, d[1] + d[2]); }
  const trees: Tree[] = [];
  for (let gx = Math.floor(x0 / STEP); gx <= Math.ceil(x1 / STEP) && trees.length < MAX_TREES; gx += 1) {
    for (let gy = Math.floor(y0 / STEP); gy <= Math.ceil(y1 / STEP) && trees.length < MAX_TREES; gy += 1) {
      /* Nicht überall: Haine und Lichtungen (eine grobe Dichte je Feld), dazu der Zufall des Punktes. */
      const grove = hash(Math.floor(gx / 4), Math.floor(gy / 4), 7);
      if (hash(gx, gy, 1) > 0.15 + grove * 0.55) continue;
      const x = (gx + 0.15 + hash(gx, gy, 2) * 0.7) * STEP, y = (gy + 0.15 + hash(gx, gy, 3) * 0.7) * STEP;
      if (!onLand(x, y) || !clear(x, y)) continue;
      trees.push([x, y, 9 + hash(gx, gy, 4) * 6]);
    }
  }
  return { land, trees };
}
