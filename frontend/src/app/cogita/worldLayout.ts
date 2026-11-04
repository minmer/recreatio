/**
 * 2026-11-04 (Prompt 13, C1–C3) — EINE LANDSCHAFT: jedes Thema genau ein Sechseck an einem festen Platz, für immer (nichts wird
 * beim Zoomen oder Klicken neu gelegt). Nur aus der Struktur — für jeden Lernenden dieselbe Karte.
 *
 * 2026-11-04 (Prompt 15, 1) — STRAHLENFÖRMIG UM DAS ZUHAUSE (ersetzt den Fächer von Prompt 13/14): das Zuhause in der Mitte,
 * das Land wächst in alle sechs Richtungen. Bestimmt, ohne Probieren:
 * <code>
 *   Ringe     je Thema seine Stufe: die längste Kette dessen, was es braucht; es steht auf dem innersten freien Ring
 *             seines Keils, der hinter allem liegt, was es braucht (ein Thema ohne Voraussetzungen: ab Ring 1) — so füllt
 *             eine flache Baza ihre inneren Ringe dicht, eine tiefe steigt nach aussen
 *   Keile     jedes oberste Gebiet einen Keil um das Zuhause, sein Winkel nach seiner Grösse; die Reihenfolge rund um den
 *             Kreis: Gebiete mit vielen Verbindungen nebeneinander (gierig, beginnend mit dem frühesten des Autors — eine
 *             Baza mit Etappen 1–8 behält ihre Reihenfolge, querliegende Fäden kommen neben das, woraus sie am meisten
 *             schöpfen); die Teilgebiete teilen ihren Keil ebenso
 *   Winkel    im Keil und Ring der Platz, der dem Mittel der Winkel seiner Voraussetzungen am nächsten liegt (es steht hinter
 *             seiner Übersicht, nie auf der anderen Seite)
 *   besser    wenige feste Runden: zwei Nachbarplätze desselben Gebiets tauschen, wenn die Verbindungen zusammen kürzer
 *             werden und kein Thema näher ans Zuhause rückt als etwas, das es braucht
 * </code>
 * Gerechnet in der Zeit der Themen und Kanten (die Runden begrenzt). `previous`: die gespeicherten Plätze — ein Thema, das
 * schon einen Platz hatte und ihn behalten darf, behält ihn (die Karte springt nicht). Rein gerechnet (ohne React);
 * gezeichnet von `WorldMap.tsx`, geprüft in `scripts/app-worldmap-check.mjs`.
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
  /** Das oberste Gebiet, in dem es liegt (es selbst, wenn es oben steht) — sein Farbton. */
  readonly top: string;
  /** Die Themen darin (Indizes in `TopicGraph.graph`). */
  readonly topics: readonly number[];
  /** Die Mitte seiner Fläche und wie weit sie reicht (Bodeneinheiten). */
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  /** 2026-11-04 (Prompt 15, 4d) — unter seinen Geschwistern seine Farbklasse (0–3): benachbarte nie gleich. */
  readonly shade: number;
}

export interface WorldLayout {
  /** Je Thema sein Platz. */
  readonly cells: readonly WorldCell[];
  readonly regions: ReadonlyMap<string, WorldRegion>;
  /** Die Gebiete von oben (in der Reihenfolge ihrer Keile rund um das Zuhause). */
  readonly top: readonly string[];
  /** Je Thema die Kette seiner Gebiete von oben (ohne Gebiete: leer). */
  readonly chain: readonly (readonly string[])[];
  /** Freier Boden um die Flächen (ein Platz breit) — und das Zuhause in der Mitte. */
  readonly ground: readonly WorldCell[];
  readonly ms: number;
}



const NEIGHBOURS: readonly (readonly [number, number])[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const key = (q: number, r: number): number => (q + 8192) * 16384 + (r + 8192);
const unkey = (k: number): [number, number] => [Math.floor(k / 16384) - 8192, (k % 16384) - 8192];
/** Der Winkel eines Platzes um das Zuhause (Grad, 0–360). */
const angleOf = (q: number, r: number): number => { const c = hexCenter(q, r); const a = (Math.atan2(c.y, c.x) * 180) / Math.PI; return a < 0 ? a + 360 : a; };
const angleGap = (a: number, b: number): number => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
/** Ist der Winkel `a` im Keil [a0, a0 + span)? */
const inWedge = (a: number, a0: number, span: number): boolean => (span >= 360 - 1e-9 ? true : ((a - a0 + 720) % 360) < span);
/** Das Mittel von Winkeln (über Einheitsvektoren). */
const meanAngle = (list: readonly number[]): number | null => {
  if (list.length === 0) return null;
  let x = 0; let y = 0;
  for (const a of list) { x += Math.cos((a * Math.PI) / 180); y += Math.sin((a * Math.PI) / 180); }
  if (Math.hypot(x, y) < 1e-9) return list[0];
  const a = (Math.atan2(y, x) * 180) / Math.PI;
  return a < 0 ? a + 360 : a;
};

/** Ein Keil: Anfang und Weite (Grad); die Mitte. */
interface Wedge { readonly a0: number; readonly span: number }

/**
 * DIE REIHENFOLGE DER GEBIETE UM DEN KREIS: gierig — beginnend mit dem frühesten des Autors, dann immer das Gebiet mit den
 * meisten Verbindungen zum zuletzt gelegten (bei Gleichstand das frühere); so bleiben Etappen in ihrer Reihenfolge, und ein
 * querliegender Faden kommt neben das, woraus er am meisten schöpft.
 */
function orderRegions(keys: readonly string[], links: (a: string, b: string) => number, rank: (k: string) => number): string[] {
  const left = new Set(keys);
  const out: string[] = [];
  let at: string | undefined = [...keys].sort((a, b) => rank(a) - rank(b))[0];
  while (at !== undefined) {
    out.push(at);
    left.delete(at);
    let best: string | undefined;
    let bw = -1;
    for (const k of left) {
      const w = links(at, k) + 0.01 * out.reduce((s, o) => s + links(o, k), 0);
      if (w > bw + 1e-9 || (Math.abs(w - bw) <= 1e-9 && best !== undefined && rank(k) < rank(best))) { bw = w; best = k; }
    }
    at = best;
  }
  return out;
}

/**
 * DIE EINE LANDSCHAFT einer Baza: je Thema sein Platz, je Gebiet seine Fläche. Ohne Gebiete (eine kleine Baza): alle Themen
 * in einem Keil rundum.
 */
export function worldLayout(tree: RegionTree | null, tg: TopicGraph, previous?: ReadonlyMap<string, readonly [number, number]>): WorldLayout {
  const t0 = typeof performance === 'undefined' ? Date.now() : performance.now();
  const g = tg.graph;
  const n = g.ids.length;
  const whole = globalDepth(tg);
  const rank = (t: number) => g.rank?.[t] ?? t;
  const hasRegions = tree !== null && tree.levels > 0 && tree.top.length > 0;
  const chain = g.ids.map((id) => (tree === null ? [] : tree.assignment[id] ?? []));

  /* -- Die Keile: oberste Gebiete nach Verbindungen, dann ihre Teilgebiete im Keil ------------------------------- */
  const wedgeOf = new Map<string, Wedge>();
  const regionTopics = (k: string) => tree?.regions.get(k)?.topics ?? [];
  const regionRank = (k: string) => Math.min(...regionTopics(k).map(rank), Number.POSITIVE_INFINITY);
  /* Verbindungen zwischen Gebieten (je Ebene: unter Geschwistern), über die Ketten der Themen. */
  const linkCount = new Map<string, number>();
  g.needs.forEach((list, t) => {
    for (const p of list) {
      const a = chain[t]; const b = chain[p];
      for (let d = 0; d < Math.min(a.length, b.length); d += 1) {
        if (a[d] === b[d]) continue;
        const k = a[d] < b[d] ? `${a[d]}|${b[d]}` : `${b[d]}|${a[d]}`;
        linkCount.set(k, (linkCount.get(k) ?? 0) + 1);
        break;
      }
    }
  });
  const links = (a: string, b: string) => linkCount.get(a < b ? `${a}|${b}` : `${b}|${a}`) ?? 0;
  const top: string[] = hasRegions ? orderRegions(tree!.top, links, regionRank) : [];
  /* Der Keil eines Gebiets: seine Geschwister in der Reihenfolge ihrer Verbindungen, die Weite nach der Grösse. */
  const split = (keys: readonly string[], w: Wedge) => {
    const total = keys.reduce((s, k) => s + regionTopics(k).length, 0);
    let a = w.a0;
    for (const k of keys) {
      const span = (w.span * regionTopics(k).length) / Math.max(1, total);
      wedgeOf.set(k, { a0: a % 360, span });
      a += span;
    }
  };
  if (hasRegions) {
    /* Der erste Keil beginnt so, dass das erste Gebiet oben in der Mitte steht (die Kamera zeigt es zuerst). */
    const firstSpan = (360 * regionTopics(top[0]).length) / Math.max(1, n);
    split(top, { a0: (90 - firstSpan / 2 + 360) % 360, span: 360 });
    /* Teilgebiete: eine Ebene darunter (tiefer würden die Keile zu Strahlen). */
    for (const k of top) {
      const r = tree!.regions.get(k)!;
      if (r.level <= 1 || r.children.length < 2) continue;
      const kids = orderRegions(r.children.filter((c) => tree!.regions.has(c)), links, regionRank);
      split(kids, wedgeOf.get(k)!);
    }
  }
  /* Die Richtung jedes Gebiets bis zu den Blättern (nur als Ziel, keine Grenze): seine Geschwister teilen den Keil darüber. */
  const dirOfRegion = new Map<string, number>();
  if (hasRegions) {
    const walk = (keys: readonly string[], w: Wedge, depth: number) => {
      if (depth > 12) return;
      const ordered = orderRegions(keys.filter((k) => tree!.regions.has(k)), links, regionRank);
      const total = ordered.reduce((s, k) => s + regionTopics(k).length, 0);
      let a = w.a0;
      for (const k of ordered) {
        const span = (w.span * regionTopics(k).length) / Math.max(1, total);
        dirOfRegion.set(k, (a + span / 2) % 360);
        const r = tree!.regions.get(k)!;
        if (r.level > 1) walk(r.children, { a0: a % 360, span }, depth + 1);
        a += span;
      }
    };
    for (const k of top) { const r = tree!.regions.get(k)!; const w = wedgeOf.get(k)!; dirOfRegion.set(k, (w.a0 + w.span / 2) % 360); if (r.level > 1) walk(r.children, w, 0); }
  }
  const leafDir = (t: number): number | null => { const c = chain[t]; return c.length === 0 ? null : dirOfRegion.get(c[c.length - 1]) ?? null; };
  /* Der Keil eines Themas: das tiefste Gebiet mit eigenem Keil in seiner Kette. */
  const topicWedge = (t: number): Wedge => {
    let w: Wedge = { a0: 0, span: 360 };
    for (const k of chain[t]) { const x = wedgeOf.get(k); if (x !== undefined) w = x; }
    return w;
  };

  /*
    -- Plätze: Thema für Thema in der Reihenfolge des Lernens, als wachsende Flächen -----------------------------------
    Jede Stufe hat ihr Band von Ringen: so viele Ringe um das Zuhause, wie die Themen bis zu dieser Stufe brauchen (eine
    flache Baza: mehrere Ringe je Stufe, eine tiefe: ein Ring je Stufe — sie steigt nach aussen). Ein Thema wächst an die
    Fläche seines Gebiets an (noch leer: an die des Gebiets darüber, sonst an den innersten freien Platz seines Keils), am
    liebsten neben das, was es braucht; nie näher am Zuhause als etwas, das es braucht. Bewertet wird jeder freie Platz am
    Rand dieser Flächen: ausserhalb seines Bandes, fern von seinen Voraussetzungen, quer zu seiner Richtung, ausserhalb
    seines Keils kostet; viele belegte Nachbarn sparen (keine Löcher).
  */
  const taken = new Map<number, number>();
  taken.set(key(0, 0), -1);
  const place = new Int32Array(n * 2);
  const ringOf = new Int32Array(n).fill(-1);
  const angle = new Float64Array(n);
  const ringCells = new Map<number, [number, number, number][]>();
  const cellsOfRing = (r: number): [number, number, number][] => {
    let list = ringCells.get(r);
    if (list !== undefined) return list;
    list = [];
    for (let q = -r; q <= r; q += 1) for (let s = -r; s <= r; s += 1) { if (hexDistance(0, 0, q, s) === r) list.push([q, s, angleOf(q, s)]); }
    list.sort((a, b) => a[2] - b[2]);
    ringCells.set(r, list);
    return list;
  };
  /* Die Bänder: bis Stufe d liegen N(≤ d) Themen — so viele Ringe R, dass 3R² + 3R ≥ N(≤ d). */
  const perDepth = new Map<number, number>();
  for (let t = 0; t < n; t += 1) perDepth.set(whole[t], (perDepth.get(whole[t]) ?? 0) + 1);
  const bandTo = new Map<number, number>();
  {
    let sum = 0;
    for (const d of [...perDepth.keys()].sort((a, b) => a - b)) {
      sum += perDepth.get(d)!;
      bandTo.set(d, Math.max(1, Math.ceil((-3 + Math.sqrt(9 + 12 * sum)) / 6)));
    }
  }
  const depths = [...bandTo.keys()].sort((a, b) => a - b);
  const bandFrom = new Map<number, number>();
  depths.forEach((d, i) => bandFrom.set(d, i === 0 ? 1 : Math.min(bandTo.get(d)!, bandTo.get(depths[i - 1])! + 1)));
  /* Der Rand jeder Fläche (je Gebiet, für alle Gebiete der Kette; ohne Gebiete eine Fläche ''): freie Nachbarplätze. */
  const rim = new Map<string, Set<number>>();
  const grown = new Set<string>();
  const occupied = (k: number) => taken.has(k);
  const neighbourKeys = (q: number, r: number) => NEIGHBOURS.map(([dq, dr]) => key(q + dq, r + dr));
  const put = (t: number, q: number, r: number) => {
    const k = key(q, r);
    taken.set(k, t); place[t * 2] = q; place[t * 2 + 1] = r; ringOf[t] = hexDistance(0, 0, q, r); angle[t] = angleOf(q, r);
    const areas = chain[t].length === 0 ? [''] : chain[t];
    for (const a of areas) {
      grown.add(a);
      let s = rim.get(a);
      if (s === undefined) { s = new Set(); rim.set(a, s); }
      s.delete(k);
      for (const nk of neighbourKeys(q, r)) if (!occupied(nk)) s.add(nk);
    }
  };
  /*
    Gebiet für Gebiet (die Blätter, nach ihrer frühesten Stufe), darin Thema für Thema nach Stufe: so wächst jede Fläche
    zusammen, bevor die nächste neben ihr beginnt (sonst schlössen spätere Gebiete eine Fläche ein, die noch wachsen muss).
  */
  const dependents: number[][] = g.ids.map(() => []);
  g.needs.forEach((list, t) => { for (const p of list) dependents[p]?.push(t); });
  const leafKey = (t: number) => chain[t][chain[t].length - 1] ?? '';
  const leafStart = new Map<string, number>();
  for (let t = 0; t < n; t += 1) { const k = leafKey(t); leafStart.set(k, Math.min(leafStart.get(k) ?? Number.POSITIVE_INFINITY, whole[t] * 1e6 + rank(t))); }
  /*
    2026-11-04 (Prompt 15, 1) — EINMAL GERECHNET, GESPEICHERT, WIEDER BENUTZT: stehen alle Themen schon an gespeicherten,
    verschiedenen Plätzen (ausser dem Zuhause), gelten genau diese — nichts wird neu gelegt.
  */
  const fixed = previous !== undefined && previous.size >= n && (() => {
    const seen = new Set<number>([key(0, 0)]);
    for (const id of g.ids) { const c = previous.get(id); if (c === undefined || seen.has(key(c[0], c[1]))) return false; seen.add(key(c[0], c[1])); }
    return true;
  })();
  if (fixed) for (let t = 0; t < n; t += 1) { const c = previous!.get(g.ids[t])!; put(t, c[0], c[1]); }
  /* Nach einer Änderung: wer seinen gespeicherten Platz noch hat (frei, nicht das Zuhause), steht zuerst dort und bleibt dort. */
  const seeded = new Uint8Array(n);
  if (fixed) seeded.fill(1);
  else if (previous !== undefined) for (let t = 0; t < n; t += 1) { const c = previous.get(g.ids[t]); if (c === undefined || taken.has(key(c[0], c[1]))) continue; put(t, c[0], c[1]); seeded[t] = 1; }
  const order = fixed ? [] : g.ids.map((_, t) => t).sort((a, b) => leafStart.get(leafKey(a))! - leafStart.get(leafKey(b))! || (leafKey(a) < leafKey(b) ? -1 : leafKey(a) > leafKey(b) ? 1 : 0) || whole[a] - whole[b] || rank(a) - rank(b) || a - b);
  for (const t of order) {
    if (seeded[t] === 1) continue;
    const w = topicWedge(t);
    const needs = (g.needs[t] ?? []).filter((p) => ringOf[p] >= 0);
    const minRing = needs.reduce((m, p) => Math.max(m, ringOf[p]), 1);
    /* Was es öffnet und schon steht (ein späteres Gebiet greift hierher zurück): nicht weiter aussen als das. */
    const maxRing = dependents[t].reduce((m, c) => (ringOf[c] >= 0 ? Math.min(m, ringOf[c]) : m), Number.POSITIVE_INFINITY);
    const b0 = Math.max(minRing, bandFrom.get(whole[t]) ?? 1);
    const b1 = Math.max(b0, bandTo.get(whole[t]) ?? 1);
    const dir = leafDir(t) ?? (w.a0 + w.span / 2) % 360;
    const pre = meanAngle(needs.map((p) => angle[p]));
    const target = pre === null ? dir : meanAngle([pre, dir]) ?? dir;
    const areas = chain[t].length === 0 ? [''] : chain[t];
    const own = areas[areas.length - 1];
    const ownSet = rim.get(own);
    const score = (q: number, r: number): number => {
      const ring = hexDistance(0, 0, q, r);
      if (ring < minRing) return Number.POSITIVE_INFINITY;
      if (ring > maxRing) return 1e6 + ring;
      const a = angleOf(q, r);
      const cellDeg = 360 / (6 * ring);
      let s = 1.6 * Math.max(0, b0 - ring, ring - b1);
      s += 0.35 * (angleGap(a, target) / cellDeg);
      if (!inWedge(a, w.a0, w.span)) s += 2.5 + Math.min(angleGap(a, w.a0), angleGap(a, (w.a0 + w.span) % 360)) / cellDeg;
      if (needs.length > 0) {
        let near = Number.POSITIVE_INFINITY;
        for (const p of needs) near = Math.min(near, hexDistance(q, r, place[p * 2], place[p * 2 + 1]));
        s += near <= 1 ? 0 : 8 + near;
      }
      if (grown.has(own) && ownSet !== undefined && !ownSet.has(key(q, r))) s += 12;
      let full = 0;
      for (const nk of neighbourKeys(q, r)) if (occupied(nk)) full += 1;
      return s - 0.45 * full;
    };
    /* Die Plätze zur Wahl: der Rand der eigenen Fläche (noch leer: der nächsten Fläche darüber), die Nachbarn der Voraussetzungen. */
    const cand = new Set<number>();
    for (let i = areas.length - 1; i >= 0; i -= 1) {
      const s = rim.get(areas[i]);
      if (s === undefined || s.size === 0) continue;
      for (const k of s) { if (occupied(k)) s.delete(k); else cand.add(k); }
      if (cand.size > 0) break;
    }
    for (const p of needs) for (const nk of neighbourKeys(place[p * 2], place[p * 2 + 1])) if (!occupied(nk)) cand.add(nk);
    let best = -1;
    let bs = Number.POSITIVE_INFINITY;
    /* Am eigenen Rand, solange er einen erlaubten Platz hat (die Fläche bleibt ganz); sonst auch daneben. */
    if (grown.has(own) && ownSet !== undefined) for (const k of ownSet) { if (occupied(k)) continue; const [q, r] = unkey(k); const s = score(q, r); if (s < bs - 1e-9) { bs = s; best = k; } }
    if (bs >= 1e5) { best = -1; bs = Number.POSITIVE_INFINITY; for (const k of cand) { const [q, r] = unkey(k); const s = score(q, r); if (s < bs - 1e-9) { bs = s; best = k; } } }
    /* Noch nichts in der Nähe (das erste Thema eines Keils): die freien Plätze seines Bandes im Keil, Ring für Ring. */
    if (best < 0 || !grown.has(areas[0])) {
      for (let ring = Math.max(1, b0 - 1); ring <= b1 + 6 || (best < 0 && ring < b1 + 4000); ring += 1) {
        for (const c of cellsOfRing(ring)) {
          const k = key(c[0], c[1]);
          if (occupied(k)) continue;
          const s = score(c[0], c[1]);
          if (s < bs - 1e-9) { bs = s; best = k; }
        }
      }
    }
    const [q, r] = unkey(best);
    put(t, q, r);
  }

  /* -- Wenige feste Runden: Nachbarn desselben Gebiets tauschen, wenn die Verbindungen kürzer werden --------------- */
  const opens: number[][] = g.ids.map(() => []);
  g.needs.forEach((list, t) => { for (const p of list) opens[p]?.push(t); });
  const leafOf = (t: number) => chain[t][chain[t].length - 1] ?? '';
  const lengthAt = (t: number, q: number, r: number, other: number, oq: number, or: number): number => {
    let s = 0;
    for (const p of g.needs[t] ?? []) { const [pq, pr] = p === other ? [oq, or] : [place[p * 2], place[p * 2 + 1]]; s += hexDistance(q, r, pq, pr); }
    for (const c of opens[t]) { const [cq, cr] = c === other ? [oq, or] : [place[c * 2], place[c * 2 + 1]]; s += hexDistance(q, r, cq, cr); }
    return s;
  };
  const okRing = (t: number, ring: number, other: number, otherRing: number): boolean => {
    for (const p of g.needs[t] ?? []) if ((p === other ? otherRing : ringOf[p]) > ring) return false;
    for (const c of opens[t]) if ((c === other ? otherRing : ringOf[c]) < ring) return false;
    return true;
  };
  /* Die Plätze bis zwei Schritte weit (Tauschpartner). */
  const REACH: [number, number][] = [];
  for (let dq = -2; dq <= 2; dq += 1) for (let dr = -2; dr <= 2; dr += 1) { const d = hexDistance(0, 0, dq, dr); if (d >= 1 && d <= 2) REACH.push([dq, dr]); }
  for (let round = 0; round < (fixed ? 0 : 6); round += 1) {
    let changed = 0;
    for (let a = 0; a < n; a += 1) {
      const aq = place[a * 2]; const ar = place[a * 2 + 1];
      for (const [dq, dr] of REACH) {
        const b = taken.get(key(aq + dq, ar + dr));
        if (b === undefined || b < 0 || b === a || leafOf(b) !== leafOf(a) || seeded[a] === 1 || seeded[b] === 1) continue;
        const bq = place[b * 2]; const br = place[b * 2 + 1];
        const before = lengthAt(a, aq, ar, -1, 0, 0) + lengthAt(b, bq, br, -1, 0, 0);
        const after = lengthAt(a, bq, br, b, aq, ar) + lengthAt(b, aq, ar, a, bq, br);
        if (after >= before - 1e-9) continue;
        const ra = hexDistance(0, 0, bq, br); const rb = hexDistance(0, 0, aq, ar);
        if (!okRing(a, ra, b, rb) || !okRing(b, rb, a, ra)) continue;
        place[a * 2] = bq; place[a * 2 + 1] = br; place[b * 2] = aq; place[b * 2 + 1] = ar;
        ringOf[a] = ra; ringOf[b] = rb; angle[a] = angleOf(bq, br); angle[b] = angleOf(aq, ar);
        taken.set(key(aq, ar), b); taken.set(key(bq, br), a);
        changed += 1;
        break;
      }
    }
    if (changed === 0) break;
  }

  /*
    -- Zerrissene Gebiete flicken: ein abgetrenntes Stück eines Gebiets tauscht Platz mit einem Thema eines anderen
    Gebiets am Rand seiner Hauptfläche — nur wenn das andere Gebiet dabei nicht zerreisst und kein Thema näher ans Zuhause
    rückt als etwas, das es braucht (ein Gebiet, das beim Wachsen eingeschlossen wurde).
  */
  const members = new Map<string, number[]>();
  for (let t = 0; t < n; t += 1) { const k = leafOf(t); const l = members.get(k) ?? []; l.push(t); members.set(k, l); }
  const pieces = (k: string): number[][] => {
    const list = members.get(k) ?? [];
    const seen = new Set<number>();
    const out: number[][] = [];
    for (const t0 of list) {
      if (seen.has(t0)) continue;
      const part = [t0]; seen.add(t0);
      for (let i = 0; i < part.length; i += 1) {
        const u = part[i];
        for (const [dq, dr] of NEIGHBOURS) {
          const v = taken.get(key(place[u * 2] + dq, place[u * 2 + 1] + dr));
          if (v !== undefined && v >= 0 && !seen.has(v) && leafOf(v) === k) { seen.add(v); part.push(v); }
        }
      }
      out.push(part);
    }
    return out.sort((a, b) => b.length - a.length);
  };
  const swap = (a: number, b: number) => {
    const aq = place[a * 2]; const ar = place[a * 2 + 1]; const bq = place[b * 2]; const br = place[b * 2 + 1];
    place[a * 2] = bq; place[a * 2 + 1] = br; place[b * 2] = aq; place[b * 2 + 1] = ar;
    const ra = ringOf[a]; ringOf[a] = ringOf[b]; ringOf[b] = ra;
    const an = angle[a]; angle[a] = angle[b]; angle[b] = an;
    taken.set(key(aq, ar), b); taken.set(key(bq, br), a);
  };
  for (let round = 0; round < (fixed ? 0 : 3); round += 1) {
    let mended = 0;
    for (const k of members.keys()) {
      let parts = pieces(k);
      for (let guard = 0; parts.length > 1 && guard < 64; guard += 1) {
        const main = new Set(parts[0]);
        const stray = parts[parts.length - 1];
        let done = false;
        for (const t of stray) {
          if (seeded[t] === 1) continue;
          /* Ein Platz am Rand der Hauptfläche, den ein Thema eines anderen Gebiets hält. */
          const seen = new Set<number>();
          for (const m of main) {
            for (const [dq, dr] of NEIGHBOURS) {
              const u = taken.get(key(place[m * 2] + dq, place[m * 2 + 1] + dr));
              if (u === undefined || u < 0 || seen.has(u) || leafOf(u) === k || seeded[u] === 1) continue;
              seen.add(u);
              if (!okRing(t, ringOf[u], u, ringOf[t]) || !okRing(u, ringOf[t], t, ringOf[u])) continue;
              const other = leafOf(u);
              const before = pieces(other).length;
              swap(t, u);
              if (pieces(other).length <= before && pieces(k).length < parts.length) { done = true; break; }
              swap(t, u);
            }
            if (done) break;
          }
          if (done) break;
        }
        if (!done) break;
        mended += 1;
        parts = pieces(k);
      }
    }
    if (mended === 0) break;
  }

  /*
    -- Löcher füllen: ein freier Platz, rings von Land umschlossen, nimmt ein Thema vom äusseren Rand eines angrenzenden
    Gebiets (das Gebiet bleibt ganz, die Ringregel bleibt) — die Karte liegt Kachel an Kachel, das Zuhause bleibt frei.
  */
  {
    const move = (t: number, q: number, r: number) => {
      taken.delete(key(place[t * 2], place[t * 2 + 1]));
      taken.set(key(q, r), t); place[t * 2] = q; place[t * 2 + 1] = r; ringOf[t] = hexDistance(0, 0, q, r); angle[t] = angleOf(q, r);
    };
    for (let round = 0; round < (fixed ? 0 : 12); round += 1) {
      /* Was draussen ist: von einem Platz jenseits des äussersten Rings her geflutet (das Zuhause zählt als Land). */
      let far = 0;
      for (let t = 0; t < n; t += 1) far = Math.max(far, ringOf[t]);
      far += 1;
      const outside = new Set<number>();
      const stack: [number, number][] = [[far, 0]];
      outside.add(key(far, 0));
      while (stack.length > 0) {
        const [q, r] = stack.pop()!;
        for (const [dq, dr] of NEIGHBOURS) {
          const a = q + dq; const b = r + dr; const k = key(a, b);
          if (outside.has(k) || taken.has(k) || hexDistance(0, 0, a, b) > far) continue;
          outside.add(k); stack.push([a, b]);
        }
      }
      const holes: [number, number][] = [];
      for (let ring = 1; ring < far; ring += 1) for (const c of cellsOfRing(ring)) { const k = key(c[0], c[1]); if (!taken.has(k) && !outside.has(k)) holes.push([c[0], c[1]]); }
      if (holes.length === 0) break;
      const atRim = (t: number) => NEIGHBOURS.some(([dq, dr]) => outside.has(key(place[t * 2] + dq, place[t * 2 + 1] + dr)));
      let filled = 0;
      for (const [hq, hr] of holes) {
        const ring = hexDistance(0, 0, hq, hr);
        let best = -1; let bestCost = Number.POSITIVE_INFINITY;
        const tried = new Set<string>();
        for (const [dq, dr] of NEIGHBOURS) {
          const u = taken.get(key(hq + dq, hr + dr));
          if (u === undefined || u < 0 || tried.has(leafOf(u))) continue;
          const k = leafOf(u);
          tried.add(k);
          for (const t of members.get(k) ?? []) {
            if (seeded[t] === 1 || !atRim(t) || !okRing(t, ring, -1, 0)) continue;
            const cost = lengthAt(t, hq, hr, -1, 0, 0) - lengthAt(t, place[t * 2], place[t * 2 + 1], -1, 0, 0) + 0.01 * hexDistance(hq, hr, place[t * 2], place[t * 2 + 1]);
            if (cost >= bestCost) continue;
            const oq = place[t * 2]; const or = place[t * 2 + 1];
            const before = pieces(k).length;
            move(t, hq, hr);
            if (pieces(k).length <= before) { best = t; bestCost = cost; }
            move(t, oq, or);
          }
        }
        if (best >= 0) {
          const oq = place[best * 2]; const or = place[best * 2 + 1];
          move(best, hq, hr);
          outside.add(key(oq, or));
          filled += 1;
          continue;
        }
        /*
          Sonst wandert das Loch nach aussen: ein Nachbar von weiter aussen rückt hinein (er kommt dem, was er braucht,
          nicht zu nah), bis das Loch den Rand erreicht.
        */
        let q0 = hq; let r0 = hr;
        for (let step = 0; step < 96; step += 1) {
          const ring0 = hexDistance(0, 0, q0, r0);
          let pick = -1; let pickCost = Number.POSITIVE_INFINITY;
          for (const [dq, dr] of NEIGHBOURS) {
            const u = taken.get(key(q0 + dq, r0 + dr));
            if (u === undefined || u < 0 || seeded[u] === 1 || ringOf[u] <= ring0 || !okRing(u, ring0, -1, 0)) continue;
            const cost = lengthAt(u, q0, r0, -1, 0, 0) - lengthAt(u, place[u * 2], place[u * 2 + 1], -1, 0, 0);
            if (cost >= pickCost) continue;
            const oq = place[u * 2]; const or = place[u * 2 + 1];
            const before = pieces(leafOf(u)).length;
            move(u, q0, r0);
            if (pieces(leafOf(u)).length <= before) { pick = u; pickCost = cost; }
            move(u, oq, or);
          }
          if (pick < 0) break;
          const oq = place[pick * 2]; const or = place[pick * 2 + 1];
          move(pick, q0, r0);
          q0 = oq; r0 = or;
          if (NEIGHBOURS.some(([dq, dr]) => outside.has(key(q0 + dq, r0 + dr)))) { outside.add(key(q0, r0)); filled += 1; break; }
        }
      }
      if (filled === 0) break;
    }
  }

  const cells: WorldCell[] = [];
  for (let t = 0; t < n; t += 1) { const q = place[t * 2]; const r = place[t * 2 + 1]; const c = hexCenter(q, r); cells.push({ q, r, x: c.x, y: c.y }); }
  const at = new Map<number, number>();
  cells.forEach((c, t) => at.set(key(c.q, c.r), t));

  /* -- Gebiete: Mitte, Weite, Farbklasse unter Geschwistern (Nachbarn nie gleich) --------------------------------- */
  const regions = new Map<string, WorldRegion>();
  if (tree !== null) {
    const shade = new Map<string, number>();
    const siblingsOf = new Map<string | null, string[]>();
    for (const r of tree.regions.values()) { const l = siblingsOf.get(r.parent) ?? []; l.push(r.key); siblingsOf.set(r.parent, l); }
    for (const [, sibs] of siblingsOf) {
      /* Wer grenzt an wen (Plätze Kante an Kante), gierig gefärbt — die grössten zuerst. */
      const set = new Set(sibs);
      const touch = new Map<string, Set<string>>();
      for (const k of sibs) touch.set(k, new Set());
      for (const k of sibs) {
        for (const t of regionTopics(k)) {
          const c = cells[t];
          for (const [dq, dr] of NEIGHBOURS) {
            const u = at.get(key(c.q + dq, c.r + dr));
            if (u === undefined) continue;
            const other = chain[u].find((x) => set.has(x));
            if (other !== undefined && other !== k) touch.get(k)!.add(other);
          }
        }
      }
      for (const k of [...sibs].sort((a, b) => regionTopics(b).length - regionTopics(a).length || (a < b ? -1 : 1))) {
        const used = new Set([...touch.get(k)!].map((o) => shade.get(o)).filter((x): x is number => x !== undefined));
        let c = 0;
        while (used.has(c) && c < 3) c += 1;
        shade.set(k, c);
      }
    }
    for (const r of tree.regions.values()) {
      let x = 0; let y = 0;
      for (const t of r.topics) { x += cells[t].x; y += cells[t].y; }
      x /= Math.max(1, r.topics.length); y /= Math.max(1, r.topics.length);
      let radius = 0;
      for (const t of r.topics) radius = Math.max(radius, Math.hypot(cells[t].x - x, cells[t].y - y));
      let topKey = r.key;
      for (let p = r.parent, k = 0; p !== null && k < 64; p = tree.regions.get(p)?.parent ?? null, k += 1) topKey = p;
      regions.set(r.key, { key: r.key, name: r.name, level: r.level, parent: r.parent, top: topKey, topics: r.topics, x, y, radius: radius + 0.6, shade: shade.get(r.key) ?? 0 });
    }
  }
  /* Der Boden: das Zuhause und ein Platz um alles. */
  const ground: WorldCell[] = [{ q: 0, r: 0, ...hexCenter(0, 0) }];
  const seen = new Set<number>([key(0, 0)]);
  for (const c of cells) {
    for (const [dq, dr] of NEIGHBOURS) {
      const q = c.q + dq; const r = c.r + dr; const k = key(q, r);
      if (at.has(k) || seen.has(k)) continue;
      seen.add(k);
      ground.push({ q, r, ...hexCenter(q, r) });
    }
  }

  const t1 = typeof performance === 'undefined' ? Date.now() : performance.now();
  return { cells, regions, top: hasRegions ? top : [], chain, ground, ms: t1 - t0 };
}
