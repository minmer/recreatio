/**
 * 2026-11-04 (Prompt 13, C1–C3) — EINE LANDSCHAFT: jedes Thema genau ein Sechseck an einem festen Platz, für immer (nichts wird
 * beim Zoomen oder Klicken neu gelegt). Die Plätze kommen aus der Rangordnung der Gebiete (`regions.ts`):
 * <code>
 *   oben     die obersten Gebiete als Flächen im Fächer vor dem Lernenden (Anfang unten in der Mitte): jedes beginnt neben
 *            dem, worauf es baut, auf dem niedrigsten freien Ring, Zweige in ihren eigenen Richtungen (Sektoren nach Grösse);
 *            zwischen zwei obersten Gebieten ein Streifen Boden, wo es geht
 *   darin    die Teilgebiete als Flächen in der Fläche ihres Gebiets (dieselbe Regel, ohne Streifen), bis hinunter zu den
 *            Themen: jedes Thema auf dem freien Platz seines Gebiets, der am nächsten bei dem liegt, worauf es baut
 * </code>
 * Nur aus der Struktur — für jeden Lernenden dieselbe Karte. Rein gerechnet (ohne React); gezeichnet von `WorldMap.tsx`,
 * geprüft in `scripts/app-worldmap-check.mjs`.
 */

import { hexCenter, hexDistance } from './landscape';
import { globalDepth, type TopicGraph } from './levelMap';
import type { RegionTree } from './regions';

export interface WorldCell {
  readonly q: number;
  readonly r: number;
  readonly x: number;
  readonly y: number;
}

export interface WorldRegion {
  readonly key: string;
  readonly name: string;
  /** 1: die Gebiete direkt über den Themen; die obersten am höchsten. */
  readonly level: number;
  readonly parent: string | null;
  /** Das oberste Gebiet, in dem es liegt (es selbst, wenn es oben steht) — seine Farbe. */
  readonly top: string;
  /** Die Themen darin (Indizes in `TopicGraph.graph`). */
  readonly topics: readonly number[];
  /** Die Mitte seiner Fläche und wie weit sie reicht (Bodeneinheiten). */
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface WorldLayout {
  /** Je Thema sein Platz. */
  readonly cells: readonly WorldCell[];
  readonly regions: ReadonlyMap<string, WorldRegion>;
  /** Die Gebiete von oben (Reihenfolge der Karte). */
  readonly top: readonly string[];
  /** Je Thema die Kette seiner Gebiete von oben (ohne Gebiete: leer). */
  readonly chain: readonly (readonly string[])[];
  /** Freier Boden um die Flächen (ein Platz breit) und in den Streifen zwischen ihnen. */
  readonly ground: readonly WorldCell[];
  readonly ms: number;
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const key = (q: number, r: number): number => (q + 8192) * 16384 + (r + 8192);
const unkey = (k: number): [number, number] => [Math.floor(k / 16384) - 8192, (k % 16384) - 8192];
const inFan = (q: number, r: number): boolean => r + q / 2 >= -1e-9;
const fanAngle = (q: number, r: number): number => { const c = hexCenter(q, r); return (Math.atan2(c.y, -c.x) * 180) / Math.PI; };

interface Piece {
  /** So viele Plätze. */
  readonly size: number;
  readonly rank: number;
  /** Worauf es baut (Index eines anderen Stücks → so viele Kanten). */
  readonly needs: ReadonlyMap<number, number>;
}

/**
 * STÜCKE ALS FLÄCHEN LEGEN: in der Reihenfolge des Lernens (Tiefe, dann der Autor), Runde für Runde (dieselbe Tiefe): erst
 * wählt jedes seinen ersten Platz — neben dem, worauf es baut, nah beim Anfang, nur wo die ganze Fläche Platz hat —, dann
 * wachsen sie abwechselnd, kompakt um diesen Platz. `domain`: wo gelegt werden darf; `gap`: ein Platz Abstand zu anderen
 * Stücken (die obersten Gebiete); `sectors`: Zweige in ihre Richtungen (nur im Fächer oben).
 */
function packPieces(pieces: readonly Piece[], domain: (q: number, r: number) => boolean, origin: readonly [number, number], gap: boolean, sectors: boolean): [number, number][][] {
  const n = pieces.length;
  const out: [number, number][][] = pieces.map(() => []);
  if (n === 0) return out;
  /* Tiefe unter den Stücken. */
  const depth = new Array<number>(n).fill(-1);
  const busy = new Uint8Array(n);
  const depthOf = (i: number): number => {
    if (depth[i] >= 0) return depth[i];
    if (busy[i] === 1) return 0;
    busy[i] = 1;
    let d = 0;
    for (const p of pieces[i].needs.keys()) if (p !== i) d = Math.max(d, depthOf(p) + 1);
    busy[i] = 0;
    depth[i] = d;
    return d;
  };
  for (let i = 0; i < n; i += 1) depthOf(i);
  /* Sektoren: ein Baum über die stärkste Voraussetzung, jeder Zweig nach seiner Grösse. */
  const sector: [number, number][] = pieces.map(() => [0, 180]);
  if (sectors) {
    const parent = pieces.map((p, i) => { let best = -1; let bw = -1; for (const [v, w] of p.needs) if (v !== i && (w > bw || (w === bw && depth[v] > depth[best]))) { bw = w; best = v; } return best; });
    const kids: number[][] = pieces.map(() => []);
    parent.forEach((p, i) => { if (p >= 0) kids[p].push(i); });
    const sub = new Array<number>(n).fill(0);
    const sizeOf = (i: number, g = 0): number => { if (sub[i] > 0 || g > n) return sub[i]; sub[i] = pieces[i].size + kids[i].reduce((s, c) => s + sizeOf(c, g + 1), 0); return sub[i]; };
    const share = (list: number[], a0: number, a1: number, g: number) => {
      if (g > n) return;
      const sorted = [...list].sort((a, b) => pieces[a].rank - pieces[b].rank || a - b);
      const sum = sorted.reduce((s, c) => s + sizeOf(c), 0);
      let at = a0;
      for (const c of sorted) { const w = ((a1 - a0) * sizeOf(c)) / Math.max(1, sum); sector[c] = [at, at + w]; share(kids[c], at, at + w, g + 1); at += w; }
    };
    share(pieces.map((_, i) => i).filter((i) => parent[i] < 0), 0, 180, 0);
  }
  const [oq, or] = origin;
  const ring = (q: number, r: number) => hexDistance(oq, or, q, r);
  const pen = (i: number, q: number, r: number) => {
    if (!sectors) return 0;
    const d = ring(q, r);
    if (d <= 1) return 0;
    const [a0, a1] = sector[i];
    const a = fanAngle(q, r);
    return (Math.max(0, a0 - a, a - a1) / 20) * Math.min(1, d / 3);
  };
  const owner = new Map<number, number>();
  /* Darf Stück i hier liegen (frei, im Gebiet, mit Abstand zu anderen)? */
  const free = (i: number, q: number, r: number, strict: boolean): boolean => {
    const k = key(q, r);
    if (owner.has(k) || !domain(q, r)) return false;
    if (gap && strict) for (const [dq, dr] of NEIGHBOURS) { const o = owner.get(key(q + dq, r + dr)); if (o !== undefined && o !== i) return false; }
    return true;
  };
  const roomAt = (i: number, q0: number, r0: number, need: number, strict: boolean): boolean => {
    const seen = new Set<number>([key(q0, r0)]);
    const stack: [number, number][] = [[q0, r0]];
    while (stack.length > 0 && seen.size < need) {
      const [q, r] = stack.pop()!;
      for (const [dq, dr] of NEIGHBOURS) { const a = q + dq; const b = r + dr; const k = key(a, b); if (!seen.has(k) && free(i, a, b, strict)) { seen.add(k); stack.push([a, b]); } }
    }
    return seen.size >= need;
  };
  const distTo = (q: number, r: number, cells: readonly [number, number][]) => { let d = Number.POSITIVE_INFINITY; for (const [a, b] of cells) { const x = hexDistance(q, r, a, b); if (x < d) d = x; } return d; };
  const anchorOf = new Array<[number, number]>(n);
  /* Mögliche erste Plätze: frei und nah an dem, was schon liegt (oder der Anfang). */
  const options = (i: number, strict: boolean): [number, number][] => {
    if (owner.size === 0) return domain(oq, or) ? [[oq, or]] : [];
    const reach = gap && strict ? 2 : 1;
    const seen = new Set<number>();
    const list: [number, number][] = [];
    for (const k of owner.keys()) {
      const [q, r] = unkey(k);
      for (let dq = -reach; dq <= reach; dq += 1) for (let dr = -reach; dr <= reach; dr += 1) {
        if (hexDistance(0, 0, dq, dr) > reach) continue;
        const a = q + dq; const b = r + dr; const kk = key(a, b);
        if (seen.has(kk)) continue;
        seen.add(kk);
        if (free(i, a, b, strict)) list.push([a, b]);
      }
    }
    return list;
  };
  const anchor = (i: number): boolean => {
    for (const strict of gap ? [true, false] : [false]) {
      let list = options(i, strict);
      const roomy = list.filter(([q, r]) => roomAt(i, q, r, pieces[i].size, strict));
      if (roomy.length > 0) list = roomy;
      let best: [number, number] | null = null;
      let score = Number.POSITIVE_INFINITY;
      for (const [q, r] of list) {
        let s = ring(q, r) + 1.5 * pen(i, q, r) + fanAngle(q, r) * 1e-4;
        for (const [v, w] of pieces[i].needs) if (out[v].length > 0) s += 4 * w * Math.max(0, distTo(q, r, out[v]) - (gap ? 2 : 1));
        if (s < score - 1e-9) { score = s; best = [q, r]; }
      }
      if (best !== null) { anchorOf[i] = best; owner.set(key(best[0], best[1]), i); out[i].push(best); return true; }
    }
    return false;
  };
  const grow = (i: number, strict: boolean): boolean => {
    const [aq, ar] = anchorOf[i];
    let pick: [number, number] | null = null;
    let ps = Number.POSITIVE_INFINITY;
    const seen = new Set<number>();
    for (const [q0, r0] of out[i]) {
      for (const [dq, dr] of NEIGHBOURS) {
        const q = q0 + dq; const r = r0 + dr; const k = key(q, r);
        if (seen.has(k)) continue;
        seen.add(k);
        if (!free(i, q, r, strict)) continue;
        const s = hexDistance(q, r, aq, ar) + 0.3 * ring(q, r) + 0.8 * pen(i, q, r) + fanAngle(q, r) * 1e-4;
        if (s < ps - 1e-9) { ps = s; pick = [q, r]; }
      }
    }
    if (pick === null) return false;
    owner.set(key(pick[0], pick[1]), i);
    out[i].push(pick);
    return true;
  };
  const order = pieces.map((_, i) => i).sort((a, b) => depth[a] - depth[b] || pieces[a].rank - pieces[b].rank || a - b);
  for (let at = 0; at < order.length;) {
    const d0 = depth[order[at]];
    const round: number[] = [];
    while (at < order.length && depth[order[at]] === d0) { round.push(order[at]); at += 1; }
    const placed = round.filter((i) => anchor(i));
    for (const strict of gap ? [true, false] : [false]) {
      let growing = placed.filter((i) => out[i].length < pieces[i].size);
      while (growing.length > 0) {
        for (const i of growing) if (!grow(i, strict)) growing = growing.filter((x) => x !== i);
        growing = growing.filter((i) => out[i].length < pieces[i].size);
      }
    }
    for (const i of round) if (out[i].length === 0) anchor(i);
  }
  return out;
}

/** Ein Gebiet füllen: seine Teilgebiete als Flächen auf seinen Plätzen, bis zu den Themen (die Plätze sind genau so viele). */
function fill(tree: RegionTree, tg: TopicGraph, children: readonly string[], cells: readonly [number, number][], origin: readonly [number, number], topicsChildren: boolean, place: Map<number, [number, number]>, whole: Int32Array): void {
  const g = tg.graph;
  const allowed = new Set(cells.map(([q, r]) => key(q, r)));
  const domain = (q: number, r: number) => allowed.has(key(q, r));
  if (topicsChildren) {
    /* Die Themen: in der Reihenfolge des Lernens, jedes auf den freien Platz nächst dem, worauf es baut (sonst beim Anfang). */
    const index = new Map(g.ids.map((id, t) => [id, t] as const));
    const topics = children.map((id) => index.get(id)).filter((t): t is number => t !== undefined)
      .sort((a, b) => whole[a] - whole[b] || (g.rank?.[a] ?? a) - (g.rank?.[b] ?? b) || a - b);
    const freeCells = new Set(allowed);
    for (const t of topics) {
      const near = (g.needs[t] ?? []).map((p) => place.get(p)).filter((c): c is [number, number] => c !== undefined);
      let best = -1;
      let score = Number.POSITIVE_INFINITY;
      for (const k of freeCells) {
        const [q, r] = unkey(k);
        let s = hexDistance(q, r, origin[0], origin[1]) * (near.length > 0 ? 0.35 : 1);
        for (const [a, b] of near) s += hexDistance(q, r, a, b);
        s += q * 1e-6 + r * 1e-7;
        if (s < score - 1e-12) { score = s; best = k; }
      }
      if (best < 0) break;
      freeCells.delete(best);
      place.set(t, unkey(best));
    }
    return;
  }
  const regions = children.map((k) => tree.regions.get(k)).filter((r): r is NonNullable<typeof r> => r !== undefined);
  const pieceOfTopic = new Map<number, number>();
  regions.forEach((r, i) => { for (const t of r.topics) pieceOfTopic.set(t, i); });
  const pieces: Piece[] = regions.map((r, i) => {
    const needs = new Map<number, number>();
    for (const t of r.topics) for (const p of g.needs[t] ?? []) { const v = pieceOfTopic.get(p); if (v !== undefined && v !== i) needs.set(v, (needs.get(v) ?? 0) + 1); }
    return { size: r.topics.length, rank: Math.min(...r.topics.map((t) => g.rank?.[t] ?? t)), needs };
  });
  const packed = packPieces(pieces, domain, origin, false, false);
  /* Was noch frei ist (eine Fläche ging nicht ganz auf): der Reihe nach an die, denen noch Plätze fehlen. */
  const used = new Set(packed.flat().map(([q, r]) => key(q, r)));
  const left = [...allowed].filter((k) => !used.has(k));
  regions.forEach((r, i) => { while (packed[i].length < r.topics.length && left.length > 0) packed[i].push(unkey(left.shift()!)); });
  regions.forEach((r, i) => fill(tree, tg, r.children, packed[i], packed[i][0] ?? origin, r.level === 1, place, whole));
}

/**
 * DIE EINE LANDSCHAFT einer Baza: je Thema sein Platz, je Gebiet seine Fläche. Ohne Gebiete (eine kleine Baza): alle Themen
 * als eine Fläche.
 */
export function worldLayout(tree: RegionTree | null, tg: TopicGraph): WorldLayout {
  const t0 = typeof performance === 'undefined' ? Date.now() : performance.now();
  const g = tg.graph;
  const n = g.ids.length;
  const whole = globalDepth(tg);
  const place = new Map<number, [number, number]>();
  const regions = new Map<string, WorldRegion>();
  const top = tree === null || tree.levels === 0 ? [] : [...tree.top];
  if (top.length === 0) {
    /* Eine Fläche aus allen Themen, im Fächer. */
    const cells = packPieces([{ size: n, rank: 0, needs: new Map() }], inFan, [0, 0], false, false)[0];
    fill({ levels: 0, regions: new Map(), top: [], leafOf: [], assignment: {}, stats: { sizes: [], inside: [], ms: 0, moved: 0, ignored: [], bounds: [], edges: 0, cycles: 0 } } as unknown as RegionTree, tg, g.ids, cells, [0, 0], true, place, whole);
  } else {
    const rs = top.map((k) => tree!.regions.get(k)!);
    const pieceOfTopic = new Map<number, number>();
    rs.forEach((r, i) => { for (const t of r.topics) pieceOfTopic.set(t, i); });
    const pieces: Piece[] = rs.map((r, i) => {
      const needs = new Map<number, number>();
      for (const t of r.topics) for (const p of g.needs[t] ?? []) { const v = pieceOfTopic.get(p); if (v !== undefined && v !== i) needs.set(v, (needs.get(v) ?? 0) + 1); }
      return { size: r.topics.length, rank: Math.min(...r.topics.map((t) => g.rank?.[t] ?? t)), needs };
    });
    /* 2026-11-04 (Prompt 14, 4): Gebiete liegen Kachel an Kachel (kein Streifen Boden) — unterschieden nur durch die Farbe. */
    const packed = packPieces(pieces, inFan, [0, 0], false, true);
    rs.forEach((r, i) => fill(tree!, tg, r.children, packed[i], packed[i][0] ?? [0, 0], r.level === 1, place, whole));
  }
  /* Themen ohne Platz (sollte nicht vorkommen): am Rand angefügt. */
  let spare = 0;
  const used = new Set([...place.values()].map(([q, r]) => key(q, r)));
  for (let t = 0; t < n; t += 1) {
    if (place.has(t)) continue;
    for (; ; spare += 1) { const q = spare % 40 - 20; const r = 60 + Math.floor(spare / 40); if (!used.has(key(q, r))) { place.set(t, [q, r]); used.add(key(q, r)); break; } }
  }
  const cells: WorldCell[] = [];
  for (let t = 0; t < n; t += 1) { const [q, r] = place.get(t)!; const c = hexCenter(q, r); cells.push({ q, r, x: c.x, y: c.y }); }
  if (tree !== null) {
    for (const r of tree.regions.values()) {
      let x = 0; let y = 0;
      for (const t of r.topics) { x += cells[t].x; y += cells[t].y; }
      x /= Math.max(1, r.topics.length); y /= Math.max(1, r.topics.length);
      let radius = 0;
      for (const t of r.topics) radius = Math.max(radius, Math.hypot(cells[t].x - x, cells[t].y - y));
      let topKey = r.key;
      for (let at = r.parent, k = 0; at !== null && k < 64; at = tree.regions.get(at)?.parent ?? null, k += 1) topKey = at;
      regions.set(r.key, { key: r.key, name: r.name, level: r.level, parent: r.parent, top: topKey, topics: r.topics, x, y, radius: radius + 0.6 });
    }
  }
  const chain = g.ids.map((id) => (tree === null ? [] : tree.assignment[id] ?? []));
  /* Der Boden: ein Platz um alles, und die Streifen dazwischen. */
  const ground: WorldCell[] = [];
  const seen = new Set<number>();
  for (const c of cells) {
    for (const [dq, dr] of NEIGHBOURS) {
      const q = c.q + dq; const r = c.r + dr; const k = key(q, r);
      if (used.has(k) || seen.has(k)) continue;
      seen.add(k);
      const p = hexCenter(q, r);
      ground.push({ q, r, x: p.x, y: p.y });
    }
  }
  const t1 = typeof performance === 'undefined' ? Date.now() : performance.now();
  return { cells, regions, top, chain, ground, ms: t1 - t0 };
}
