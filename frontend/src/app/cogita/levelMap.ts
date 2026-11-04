/**
 * 2026-11-04 (Prompt 11) — EINE EBENE DES KRAJOBRAZ: was eine Karte zeigt, wo es steht und wie hoch ein Schritt ist.
 * Rein gerechnet (ohne React, ohne Baza); gezeichnet von `RegionMap.tsx`, geprüft in `scripts/app-levels-check.mjs`.
 *
 * <code>
 *   Themen      die Knoten der Gebiete: lernbare Einträge des Widoku, nie Pytania; Kanten „wymaga" durch alles ohne
 *               Karten hindurch (`topicGraphOf`)
 *   Ebene       die Kinder des offenen Gebiets (`regions.ts`): nur Gebiete oder nur Themen, nie gemischt
 *   Lage        nur aus der Struktur, für jeden gleich: ein Fächer vor dem Lernenden (unten in der Mitte); der Abstand
 *               von ihm ist die Tiefe in der Kette der Voraussetzungen IN der Ebene (Tiefe d → Ring d, mit mehreren
 *               Anfängen Ring d + 1); im Ring steht jeder beim Mittel der Winkel seiner Voraussetzungen (gleiche
 *               Abschnitte beieinander), dann tauschen zwei, drei Durchgänge Nachbarn, wenn die Kanten kürzer werden
 *   Tore        die Gebiete, mit denen dieses verbunden ist, am Rand — in der Richtung, in der sie auf der Karte
 *               darüber liegen; wer auf sie baut oder zu ihnen führt, steht zu ihnen hin
 *   Schritt     EINE Höhe je Schritt für die ganze Ansicht: die grösste, bei der jede Fläche mindestens zur Hälfte zu
 *               sehen ist (`viewScale`); reicht sie nicht, erst steiler von oben, dann nur die Säulen vor einem
 *               verdeckten wichtigen Feld kürzen (mit Schnittkante), nie unter die kleinste lesbare Stufe
 * </code>
 * Senkrecht ohne Fluchtpunkt: eine Säule hinten ist so hoch wie dieselbe vorn.
 */

import { hexCenter, hexDistance, type LsInput } from './landscape';
import type { RegionGraphInput, RegionTree } from './regions';

/* -- Die Themen ------------------------------------------------------------------------------------------------- */

export interface TopicGraph {
  readonly graph: RegionGraphInput;
  /** Je Thema sein Knoten in `LsInput`. */
  readonly node: Int32Array;
  /** Je Knoten in `LsInput` sein Thema (−1: keins — ohne Karten, nicht im Widok, ein Pytanie). */
  readonly topicOf: Int32Array;
}

/**
 * DER GRAPH DER THEMEN: was im Widok steht und Karten hat, ohne Pytania; die Voraussetzungen durch alles andere hindurch
 * (ein Eintrag ohne Karten dazwischen ist durchsichtig). `names`: die Werte der Gruppierung (Abschnitte) und worunter ein
 * Thema in der Struktur liegt — Namen für Gebiete.
 */
export function topicGraphOf(input: LsInput, isQuestion: (id: string) => boolean): TopicGraph {
  const n = input.ids.length;
  const topicOf = new Int32Array(n).fill(-1);
  const node: number[] = [];
  for (let v = 0; v < n; v += 1) {
    if (input.inView[v] && input.learnable[v] && !isQuestion(input.ids[v])) { topicOf[v] = node.length; node.push(v); }
  }
  const needs = node.map((v) => {
    const out = new Set<number>();
    const seen = new Set<number>([v]);
    const stack = [...(input.needs[v] ?? [])];
    while (stack.length > 0) {
      const p = stack.pop()!;
      if (seen.has(p) || p < 0 || p >= n) continue;
      seen.add(p);
      const t = topicOf[p];
      if (t >= 0) { out.add(t); continue; }
      for (const q of input.needs[p] ?? []) if (!seen.has(q)) stack.push(q);
    }
    out.delete(topicOf[v]);
    return [...out].sort((a, b) => a - b);
  });
  const valueName = (x: number): string[] => {
    const out: string[] = [];
    for (let at = x, k = 0; at >= 0 && k < 16; at = input.values[at]?.parent ?? -1, k += 1) { const val = input.values[at]; if (val !== undefined) out.push(val.label); }
    return out;
  };
  const names = node.map((v) => {
    const set = new Set<string>();
    for (const x of input.memberOf[v] ?? []) for (const l of valueName(x)) set.add(l);
    for (const p of input.up?.[v] ?? []) { const l = input.labels[p]; if (l !== undefined && l !== '') set.add(l); }
    return [...set];
  });
  return { graph: { ids: node.map((v) => input.ids[v]), labels: node.map((v) => input.labels[v] ?? input.ids[v]), needs, rank: node.map((v) => v), names }, node: Int32Array.from(node), topicOf };
}

/** Je Thema die längste Kette seiner Voraussetzungen im ganzen Graphen (gemerkt je Graph; Kreise zählen einmal). */
const DEPTHS = new WeakMap<TopicGraph, Int32Array>();
export function globalDepth(tg: TopicGraph): Int32Array {
  const had = DEPTHS.get(tg);
  if (had !== undefined) return had;
  const n = tg.graph.ids.length;
  const d = new Int32Array(n).fill(-1);
  const busy = new Uint8Array(n);
  /* Ohne Rekursion (5 000 Themen, lange Ketten): ein eigener Stapel. */
  for (let root = 0; root < n; root += 1) {
    if (d[root] >= 0) continue;
    const stack: number[] = [root];
    while (stack.length > 0) {
      const v = stack[stack.length - 1];
      if (d[v] >= 0) { stack.pop(); continue; }
      busy[v] = 1;
      let ready = true;
      let best = 0;
      for (const p of tg.graph.needs[v] ?? []) {
        if (d[p] >= 0) { best = Math.max(best, d[p] + 1); continue; }
        if (busy[p] === 1) continue;
        ready = false;
        stack.push(p);
      }
      if (ready) { d[v] = best; busy[v] = 0; stack.pop(); }
    }
  }
  DEPTHS.set(tg, d);
  return d;
}

/* -- Die Ebene ------------------------------------------------------------------------------------------------- */

export interface LevelItem {
  /** Ein Gebiet (sein Schlüssel) oder ein Thema (seine Kennung). */
  readonly key: string;
  readonly kind: 'region' | 'topic';
  readonly label: string;
  /** Die Themen darin (Indizes in `TopicGraph.graph`); ein Thema: es selbst. */
  readonly topics: readonly number[];
  /** Die Reihenfolge des Autors (das früheste Thema darin). */
  readonly rank: number;
  /** Der erste Abschnitt (Gleiches steht beieinander). */
  readonly group: string;
}

/** Die Kette eines Gebiets von oben (oben zuerst, es selbst zuletzt). */
export function regionPath(tree: RegionTree, key: string | null): string[] {
  const out: string[] = [];
  for (let at = key, k = 0; at !== null && k < 64; at = tree.regions.get(at)?.parent ?? null, k += 1) {
    if (!tree.regions.has(at)) break;
    out.unshift(at);
  }
  return out;
}

/** Was auf der Karte eines offenen Gebiets steht (`null`: die oberste Ebene). */
export function levelItems(tree: RegionTree, open: string | null, tg: TopicGraph): LevelItem[] {
  const g = tg.graph;
  const index = new Map(g.ids.map((id, i) => [id, i] as const));
  const topicItem = (id: string): LevelItem | null => {
    const t = index.get(id);
    if (t === undefined) return null;
    return { key: id, kind: 'topic', label: g.labels[t], topics: [t], rank: g.rank?.[t] ?? t, group: g.names?.[t]?.[0] ?? '' };
  };
  const regionItem = (key: string): LevelItem | null => {
    const r = tree.regions.get(key);
    if (r === undefined) return null;
    const rank = Math.min(...r.topics.map((t) => g.rank?.[t] ?? t));
    const first = r.topics.map((t) => g.names?.[t]?.[0] ?? '').find((x) => x !== '') ?? '';
    return { key, kind: 'region', label: r.name, topics: r.topics, rank: Number.isFinite(rank) ? rank : 0, group: first };
  };
  const region = open === null ? null : tree.regions.get(open) ?? null;
  const keys = region === null ? tree.top : region.children;
  const childrenAreTopics = region === null ? tree.levels === 0 : region.level === 1;
  return keys.map((k) => (childrenAreTopics ? topicItem(k) : regionItem(k))).filter((x): x is LevelItem => x !== null);
}

export interface LevelPlace {
  readonly q: number;
  readonly r: number;
  readonly x: number;
  readonly y: number;
  readonly ring: number;
  /** Winkel im Fächer: 0 links, 180 rechts (Tore auch darunter: −180 … 360). */
  readonly angle: number;
}

export interface LevelGate extends LevelPlace {
  /** Das verbundene Gebiet (auf der Ebene, auf der es neben diesem steht). */
  readonly key: string;
  readonly label: string;
  /** Es kommt davor (Voraussetzungen von hier liegen dort) / danach (es baut auf hier). */
  readonly before: boolean;
  readonly after: boolean;
  readonly weight: number;
}

export interface LevelLayout {
  readonly open: string | null;
  readonly items: readonly LevelItem[];
  readonly place: readonly LevelPlace[];
  /** Kanten [Voraussetzung, Folgendes] zwischen Feldern dieser Ebene (mit Gewicht: so viele Themenkanten). */
  readonly edges: readonly (readonly [number, number, number])[];
  readonly depth: readonly number[];
  readonly gates: readonly LevelGate[];
  /** Kanten zu Toren: [Feld, Tor, Tor davor?]. */
  readonly gateEdges: readonly (readonly [number, number, boolean])[];
  /** Der äusserste Ring der Felder. */
  readonly rings: number;
}

/** Die Plätze eines Ringes im Fächer (obere Hälfte, y ≥ 0), von links nach rechts. */
function fanSlots(ring: number): { q: number; r: number; x: number; y: number; angle: number }[] {
  if (ring === 0) return [{ q: 0, r: 0, x: 0, y: 0, angle: 90 }];
  const out: { q: number; r: number; x: number; y: number; angle: number }[] = [];
  for (let q = -ring; q <= ring; q += 1) {
    for (let r = -ring; r <= ring; r += 1) {
      if (hexDistance(0, 0, q, r) !== ring) continue;
      const c = hexCenter(q, r);
      if (c.y < -1e-9) continue;
      out.push({ q, r, x: c.x, y: c.y, angle: (Math.atan2(c.y, -c.x) * 180) / Math.PI });
    }
  }
  return out.sort((a, b) => a.angle - b.angle || a.q - b.q);
}

/** Die Plätze eines ganzen Ringes (für Tore, auch vor dem Lernenden). */
function fullRing(ring: number): { q: number; r: number; x: number; y: number; angle: number }[] {
  const out: { q: number; r: number; x: number; y: number; angle: number }[] = [];
  for (let q = -ring; q <= ring; q += 1) {
    for (let r = -ring; r <= ring; r += 1) {
      if (hexDistance(0, 0, q, r) !== ring) continue;
      const c = hexCenter(q, r);
      let angle = (Math.atan2(c.y, -c.x) * 180) / Math.PI;
      if (angle < -90) angle += 360;
      out.push({ q, r, x: c.x, y: c.y, angle });
    }
  }
  return out;
}

const angleGap = (a: number, b: number): number => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/**
 * DIE LAGE EINER EBENE — nur aus der Struktur (für jeden Lernenden dieselbe): Tiefe → Ring, Winkel beim Mittel der
 * Voraussetzungen (und der Tore, mit denen ein Feld verbunden ist), dann Nachbarn tauschen, wenn die Kanten kürzer werden.
 * `gateAngles`: je verbundenem Gebiet seine Richtung (aus der Karte darüber).
 */
export function layoutLevel(items: readonly LevelItem[], tg: TopicGraph, tree: RegionTree | null, open: string | null, gateAngles: ReadonlyMap<string, number> = new Map()): LevelLayout {
  const g = tg.graph;
  const n = items.length;
  /* Wem gehört welches Thema auf dieser Ebene? */
  const owner = new Map<number, number>();
  items.forEach((it, i) => { for (const t of it.topics) owner.set(t, i); });
  const weights = new Map<string, number>();
  const external = new Map<number, { item: number; before: boolean }[]>();
  for (let i = 0; i < n; i += 1) {
    for (const t of items[i].topics) {
      for (const p of g.needs[t] ?? []) {
        const j = owner.get(p);
        if (j === undefined) { const list = external.get(p) ?? []; list.push({ item: i, before: true }); external.set(p, list); continue; }
        if (j === i) continue;
        const k = `${j}>${i}`;
        weights.set(k, (weights.get(k) ?? 0) + 1);
      }
    }
  }
  /* Was von aussen auf Themen hier baut (sie führen zu einem Tor danach). */
  const inside = new Set(owner.keys());
  if (tree !== null && open !== null) {
    g.needs.forEach((list, t) => {
      if (inside.has(t)) return;
      for (const p of list) { const i = owner.get(p); if (i === undefined) continue; const l = external.get(t) ?? []; l.push({ item: i, before: false }); external.set(t, l); }
    });
  }
  const edges = [...weights.entries()].map(([k, w]) => { const [a, b] = k.split('>').map(Number); return [a, b, w] as const; }).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const prereqs: number[][] = Array.from({ length: n }, () => []);
  const builds: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) { prereqs[b].push(a); builds[a].push(b); }
  /* Die Tiefe: die längste Kette darunter (Kreise auf einer Ebene gibt es nicht — sicherheitshalber begrenzt). */
  const depth = new Array<number>(n).fill(-1);
  const busy = new Uint8Array(n);
  const depthOf = (i: number): number => {
    if (depth[i] >= 0) return depth[i];
    if (busy[i] === 1) return 0;
    busy[i] = 1;
    let d = 0;
    for (const p of prereqs[i]) d = Math.max(d, depthOf(p) + 1);
    busy[i] = 0;
    depth[i] = d;
    return d;
  };
  for (let i = 0; i < n; i += 1) depthOf(i);
  /*
    Eine Karte von Themen: der Ring nach der Tiefe im GANZEN Graphen (der Rang unter den Tiefen dieser Karte) — ein Thema, das
    in seinem Gebiet vorn steht, aber lange Ketten von draussen braucht, stünde sonst als hoher Berg vor den niedrigen. Die
    Reihenfolge bleibt: eine Voraussetzung ist im ganzen Graphen immer weniger tief als, was auf ihr baut.
  */
  if (n > 0 && items.every((it) => it.kind === 'topic')) {
    const whole = globalDepth(tg);
    const ranks = [...new Set(items.map((it) => whole[it.topics[0]] ?? 0))].sort((a, b) => a - b);
    const rankOf = new Map(ranks.map((d, k) => [d, k] as const));
    items.forEach((it, i) => { depth[i] = rankOf.get(whole[it.topics[0]] ?? 0) ?? depth[i]; });
  }

  /* Die Tore: je äusserem Thema das Gebiet, das neben diesem steht (Kind des gemeinsamen Gebiets darüber). */
  const gateOf = new Map<string, { label: string; before: boolean; after: boolean; weight: number; items: Set<number> }>();
  const gateEdgesRaw: [number, string, boolean][] = [];
  if (tree !== null && open !== null) {
    const mine = regionPath(tree, open);
    for (const [t, list] of external) {
      const chain = tree.assignment[g.ids[t]];
      if (chain === undefined) continue;
      let common = 0;
      while (common < mine.length && common < chain.length && mine[common] === chain[common]) common += 1;
      const key = chain[common];
      if (key === undefined || key === open) continue;
      const r = tree.regions.get(key);
      if (r === undefined) continue;
      const had = gateOf.get(key) ?? { label: r.name, before: false, after: false, weight: 0, items: new Set<number>() };
      for (const e of list) {
        if (e.before) had.before = true; else had.after = true;
        had.weight += 1;
        had.items.add(e.item);
        gateEdgesRaw.push([e.item, key, e.before]);
      }
      gateOf.set(key, had);
    }
  }

  /* Die Ringe: Tiefe d → Ring d (ein Anfang: in der Mitte), mehrere Anfänge: Ring d + 1; ein voller Ring schiebt weiter. */
  const starts = depth.filter((d) => d === 0).length;
  const order = items.map((_, i) => i).sort((a, b) => depth[a] - depth[b] || items[a].rank - items[b].rank || a - b);
  const ringOf = new Array<number>(n).fill(0);
  {
    let ring = starts > 1 ? 1 : 0;
    let used = 0;
    let lastDepth = 0;
    for (const i of order) {
      if (depth[i] !== lastDepth) { ring += 1; used = 0; lastDepth = depth[i]; }
      while (used >= fanSlots(ring).length) { ring += 1; used = 0; }
      ringOf[i] = ring;
      used += 1;
    }
  }
  const rings = n === 0 ? 0 : Math.max(...ringOf);
  /* Die Richtung jedes Tores: aus der Karte darüber — sonst (ohne sie) gleichmässig, die davor links, die danach rechts. */
  const gateKeys = [...gateOf.keys()].sort((a, b) => (gateOf.get(b)!.weight - gateOf.get(a)!.weight) || (a < b ? -1 : 1));
  const gateAngle = new Map<string, number>();
  gateKeys.forEach((k, j) => {
    const given = gateAngles.get(k);
    if (given !== undefined && Number.isFinite(given)) { gateAngle.set(k, given); return; }
    const info = gateOf.get(k)!;
    gateAngle.set(k, info.before && !info.after ? -30 - 20 * j : info.after && !info.before ? 210 + 20 * j : 90 + (j % 2 === 0 ? 1 : -1) * 30 * Math.ceil(j / 2));
  });
  /* Ein Winkel im Fächer für ein Tor (das Tor selbst darf darunter liegen, ein Feld steht zu ihm hin). */
  const toFan = (a: number): number => {
    let x = ((a % 360) + 360) % 360;
    if (x > 270) x -= 360;
    return Math.max(0, Math.min(180, x));
  };

  const place: (LevelPlace | null)[] = new Array(n).fill(null);
  const taken = new Set<string>();
  const ringItems = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) { const list = ringItems.get(ringOf[i]) ?? []; list.push(i); ringItems.set(ringOf[i], list); }
  const groupAngles = new Map<string, number[]>();
  for (let ring = 0; ring <= rings; ring += 1) {
    const here = ringItems.get(ring) ?? [];
    const slots = fanSlots(ring);
    /* Wer schon viel Platziertes darunter hat, wählt zuerst. */
    const placedPre = (i: number) => prereqs[i].filter((p) => place[p] !== null).length;
    here.sort((a, b) => placedPre(b) - placedPre(a) || items[a].rank - items[b].rank || a - b);
    const free = () => slots.filter((s) => !taken.has(`${s.q},${s.r}`));
    here.forEach((i, k) => {
      const targets: { a: number; w: number }[] = [];
      for (const p of prereqs[i]) { const pl = place[p]; if (pl !== null) targets.push({ a: pl.angle, w: weights.get(`${p}>${i}`) ?? 1 }); }
      for (const [item, key] of gateEdgesRaw) if (item === i) targets.push({ a: toFan(gateAngle.get(key) ?? 90), w: 2 });
      let target: number;
      if (targets.length > 0) {
        const sw = targets.reduce((s, x) => s + x.w, 0);
        target = targets.reduce((s, x) => s + x.a * x.w, 0) / sw;
      } else {
        const same = groupAngles.get(items[i].group);
        target = same !== undefined && same.length > 0 && items[i].group !== '' ? same.reduce((s, x) => s + x, 0) / same.length : here.length <= 1 ? 90 : (180 * (k + 0.5)) / here.length;
      }
      const options = free();
      let best = options[0];
      let gap = Number.POSITIVE_INFINITY;
      for (const s of options) { const d = Math.abs(s.angle - target); if (d < gap - 1e-9) { gap = d; best = s; } }
      if (best === undefined) return;
      taken.add(`${best.q},${best.r}`);
      place[i] = { q: best.q, r: best.r, x: best.x, y: best.y, ring, angle: best.angle };
      if (items[i].group !== '') { const list = groupAngles.get(items[i].group) ?? []; list.push(best.angle); groupAngles.set(items[i].group, list); }
    });
  }
  /*
    Die Tore am Rand: dicht um die Felder (zwei Sechsecke von ihnen weg), in ihrer Richtung von der Mitte der Felder aus —
    nicht auf einem Ring um den Lernenden (das machte eine Ebene mit Toren davor doppelt so hoch).
  */
  const gateRing = rings + 2;
  const placedItems = place.filter((p): p is LevelPlace => p !== null);
  const midX = placedItems.reduce((s, p) => s + p.x, 0) / Math.max(1, placedItems.length);
  const midY = placedItems.reduce((s, p) => s + p.y, 0) / Math.max(1, placedItems.length);
  const around = (away: number): { q: number; r: number; x: number; y: number; angle: number }[] => {
    if (placedItems.length === 0) return fullRing(gateRing);
    const qs = placedItems.map((p) => p.q);
    const rs = placedItems.map((p) => p.r);
    const out: { q: number; r: number; x: number; y: number; angle: number }[] = [];
    for (let q = Math.min(...qs) - away - 1; q <= Math.max(...qs) + away + 1; q += 1) {
      for (let r = Math.min(...rs) - away - 1; r <= Math.max(...rs) + away + 1; r += 1) {
        let near = Number.POSITIVE_INFINITY;
        for (const p of placedItems) near = Math.min(near, hexDistance(p.q, p.r, q, r));
        if (near !== away) continue;
        const c = hexCenter(q, r);
        let angle = (Math.atan2(c.y - midY, -(c.x - midX)) * 180) / Math.PI;
        if (angle < -90) angle += 360;
        out.push({ q, r, x: c.x, y: c.y, angle });
      }
    }
    return out;
  };
  const gateSlots = [...around(2), ...around(3)];
  const gateTaken = new Set<string>();
  const placedGates: { q: number; r: number }[] = [];
  const gates: LevelGate[] = gateKeys.map((key) => {
    const a = gateAngle.get(key)!;
    /* Tore mit Abstand (drei Sechsecke — Platz für ihre Namen); geht das nicht mehr, ein freier Platz. */
    const pick = (spread: number) => {
      let best: (typeof gateSlots)[number] | null = null;
      let gap = Number.POSITIVE_INFINITY;
      for (const s of gateSlots) {
        if (gateTaken.has(`${s.q},${s.r}`) || placedGates.some((p) => hexDistance(p.q, p.r, s.q, s.r) < spread)) continue;
        const d = angleGap(s.angle, a);
        if (d < gap) { gap = d; best = s; }
      }
      return best;
    };
    const best = pick(3) ?? pick(1) ?? gateSlots[0];
    gateTaken.add(`${best.q},${best.r}`);
    placedGates.push(best);
    const info = gateOf.get(key)!;
    return { key, label: info.label, before: info.before, after: info.after, weight: info.weight, q: best.q, r: best.r, x: best.x, y: best.y, ring: gateRing, angle: best.angle };
  });
  const gateIndex = new Map(gates.map((x, j) => [x.key, j] as const));
  const gateEdges = gateEdgesRaw.map(([i, key, before]) => [i, gateIndex.get(key)!, before] as const);

  /* Zwei, drei Durchgänge: Nachbarn im Ring tauschen (oder auf einen freien Nachbarplatz rücken), wenn die Kanten kürzer werden. */
  const pos = place.map((p) => p!);
  const cost = (i: number, at: LevelPlace): number => {
    let s = 0;
    for (const p of prereqs[i]) s += hexDistance(at.q, at.r, pos[p].q, pos[p].r) * (weights.get(`${p}>${i}`) ?? 1);
    for (const c of builds[i]) s += hexDistance(at.q, at.r, pos[c].q, pos[c].r) * (weights.get(`${i}>${c}`) ?? 1);
    for (const [item, gate] of gateEdges) if (item === i) s += hexDistance(at.q, at.r, gates[gate].q, gates[gate].r) * 0.5;
    return s;
  };
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    for (let ring = 0; ring <= rings; ring += 1) {
      const slots = fanSlots(ring);
      const at = new Map<string, number>();
      for (let i = 0; i < n; i += 1) if (pos[i].ring === ring) at.set(`${pos[i].q},${pos[i].r}`, i);
      for (let s = 0; s + 1 < slots.length; s += 1) {
        const ka = `${slots[s].q},${slots[s].r}`;
        const kb = `${slots[s + 1].q},${slots[s + 1].r}`;
        const a = at.get(ka);
        const b = at.get(kb);
        if (a === undefined && b === undefined) continue;
        const pa: LevelPlace = { ...slots[s], ring };
        const pb: LevelPlace = { ...slots[s + 1], ring };
        const before = (a === undefined ? 0 : cost(a, pa)) + (b === undefined ? 0 : cost(b, pb));
        if (a !== undefined) pos[a] = pb;
        if (b !== undefined) pos[b] = pa;
        const after = (a === undefined ? 0 : cost(a, pb)) + (b === undefined ? 0 : cost(b, pa));
        if (after < before - 1e-9) {
          if (a !== undefined) at.set(kb, a); else at.delete(kb);
          if (b !== undefined) at.set(ka, b); else at.delete(ka);
          changed = true;
        } else {
          if (a !== undefined) pos[a] = pa;
          if (b !== undefined) pos[b] = pb;
        }
      }
    }
    if (!changed) break;
  }
  return { open, items, place: pos, edges, depth, gates, gateEdges, rings };
}

/**
 * DIE RICHTUNG DER TORE eines offenen Gebiets: je Gebiet, das neben einem seiner Vorfahren steht, der Winkel von dort zu
 * ihm auf der Karte, auf der beide stehen (die Karte darüber). `layoutOf` rechnet eine Ebene (gemerkt).
 */
export function gateAnglesFor(tree: RegionTree, open: string | null, layoutOf: (open: string | null) => LevelLayout): Map<string, number> {
  const out = new Map<string, number>();
  if (open === null) return out;
  const mine = regionPath(tree, open);
  /* Von unten nach oben: was weiter oben steht, nimmt die Richtung der Karte, auf der es neben dem eigenen Vorfahren steht. */
  for (let level = mine.length - 1; level >= 0; level -= 1) {
    const self = mine[level];
    const parent = level === 0 ? null : mine[level - 1];
    const map = layoutOf(parent);
    const at = map.items.findIndex((it) => it.key === self);
    if (at < 0) continue;
    const me = map.place[at];
    map.items.forEach((it, j) => {
      if (j === at || out.has(it.key)) return;
      const p = map.place[j];
      out.set(it.key, (Math.atan2(p.y - me.y, -(p.x - me.x)) * 180) / Math.PI);
    });
  }
  return out;
}

/* -- Die Reihenfolge eines Weges ---------------------------------------------------------------------------- */

/**
 * DIE REIHENFOLGE EINES WEGES (die Liste Schritt für Schritt und die Linie auf jeder Karte): Gebiet für Gebiet von oben nach
 * unten — auf jeder Ebene nach der Tiefe auf ihrer Karte (ihrem Ring), bei gleicher Tiefe nach dem Winkel (so läuft die Linie
 * im Ring in einer Richtung), im Gebiet die Themen ebenso. Weil jede Ebene keine Kreise hat, bleibt das eine gültige
 * Reihenfolge des Lernens; die Linie läuft auf jeder Karte nach aussen, ohne Zickzack.
 */
export function routeOrder(tree: RegionTree | null, tg: TopicGraph, layoutOf: (open: string | null) => LevelLayout, topics: readonly number[]): number[] {
  const keyOf = (t: number): number[] => {
    const out: number[] = [];
    const chain = tree === null ? [] : tree.assignment[tg.graph.ids[t]] ?? [];
    let open: string | null = null;
    for (const key of [...chain, tg.graph.ids[t]]) {
      const layout = layoutOf(open);
      const i = layout.items.findIndex((it) => it.key === key);
      /* Der Ring (er wächst mit der Tiefe, auch wenn ein voller Ring überläuft), dann der Winkel. */
      if (i < 0) { out.push(0, 0); } else { out.push(layout.place[i].ring, layout.place[i].angle); }
      open = key;
    }
    return out;
  };
  const keys = new Map(topics.map((t) => [t, keyOf(t)] as const));
  return [...topics].sort((a, b) => {
    const ka = keys.get(a)!;
    const kb = keys.get(b)!;
    for (let k = 0; k < Math.max(ka.length, kb.length); k += 1) { const d = (ka[k] ?? 0) - (kb[k] ?? 0); if (Math.abs(d) > 1e-9) return d; }
    return (tg.graph.rank?.[a] ?? a) - (tg.graph.rank?.[b] ?? b);
  });
}

/* -- Wege messen (Prüfung und Bericht) ----------------------------------------------------------------------- */

/** Wie lang Wege sind (Sechsecke) und wie oft sie die Richtung wechseln (mehr als 45° zwischen zwei Stücken), im Mittel. */
export function routeMetrics(at: (id: number) => { readonly q: number; readonly r: number } | null, routes: readonly (readonly number[])[]): { readonly length: number; readonly turns: number; readonly routes: number } {
  let length = 0;
  let turns = 0;
  let count = 0;
  for (const route of routes) {
    const pts = route.map(at).filter((p): p is { q: number; r: number } => p !== null);
    if (pts.length < 2) continue;
    count += 1;
    let prev: number | null = null;
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const d = hexDistance(a.q, a.r, b.q, b.r);
      length += d;
      if (d === 0) continue;
      const ca = hexCenter(a.q, a.r);
      const cb = hexCenter(b.q, b.r);
      const dir = (Math.atan2(cb.y - ca.y, cb.x - ca.x) * 180) / Math.PI;
      if (prev !== null && angleGap(prev, dir) > 45) turns += 1;
      prev = dir;
    }
  }
  return { length: count === 0 ? 0 : length / count, turns: count === 0 ? 0 : turns / count, routes: count };
}

/* -- Ansicht: Drehung, Neigung, ein Schritt ------------------------------------------------------------------ */

/** Von der Mitte bis zur Ecke einer Kachel (Kante an Kante). */
export const HEX_CORNER = 1 / Math.sqrt(3);
export const HEX_CORNERS: readonly (readonly [number, number])[] = [0, 60, 120, 180, 240, 300].map((a) => [Math.cos((a * Math.PI) / 180) * HEX_CORNER, Math.sin((a * Math.PI) / 180) * HEX_CORNER] as const);
/** Wie tief jede Säule unter den Boden reicht (Bodeneinheiten) — die Kante vorn. */
export const HEX_FLOOR = 0.22;
/** Die Neigungen, von der flachsten an: mehr von oben, wenn sonst etwas Wichtiges verdeckt wäre. */
export const TILTS: readonly number[] = [0.52, 0.6, 0.7, 0.8, 0.9, 1];

export interface ViewField {
  readonly x: number;
  readonly y: number;
  /** Stufen (die Höhe in Schritten; 0 im Tal). */
  readonly steps: number;
  /** Wichtig (lernbar, zu wiederholen, gewählt, der nächste Schritt zum Ziel): für dieses Feld wird notfalls gekürzt. */
  readonly important: boolean;
}

export interface ViewScale {
  /** Die Neigung (wie stark die Tiefe des Bodens gestaucht ist: 1 — von oben). */
  readonly fore: number;
  /** Die Höhe eines Schrittes (Bodeneinheiten). */
  readonly step: number;
  /** Je Feld die gezeichnete Höhe (Schritte) — gekürzt nur vor einem verdeckten wichtigen Feld. */
  readonly drawn: readonly number[];
  /** Gekürzte Felder (mit Schnittkante). */
  readonly cut: readonly boolean[];
  /** Je Feld: wie viel seiner Fläche zu sehen ist (0–1). */
  readonly visible: readonly number[];
}

/** Gedreht um k·60° um die Mitte des Fächers. */
export function rotated<T extends { readonly x: number; readonly y: number }>(points: readonly T[], k: number, cx = 0, cy = 0): T[] {
  if (k % 6 === 0) return [...points];
  const a = ((k % 6) * Math.PI) / 3;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return points.map((p) => ({ ...p, x: cx + (p.x - cx) * ca - (p.y - cy) * sa, y: cy + (p.x - cx) * sa + (p.y - cy) * ca }));
}

/** Die Punkte auf einer Fläche, an denen gemessen wird, wie viel zu sehen ist (ein Dreiecksgitter in der Kachel). */
const SAMPLES: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = [];
  const s = HEX_CORNER * 0.92;
  for (let i = -4; i <= 4; i += 1) {
    for (let j = -4; j <= 4; j += 1) {
      const x = (i + j * 0.5) * (s / 4);
      const y = j * (s / 4) * (Math.sqrt(3) / 2);
      /* in der Kachel (flache Oberseite: |y| ≤ √3/2·s, und die schrägen Kanten) */
      if (Math.abs(y) > (Math.sqrt(3) / 2) * s + 1e-9) continue;
      if (Math.abs(x) * Math.sqrt(3) / 2 + Math.abs(y) / 2 > (Math.sqrt(3) / 2) * s + 1e-9) continue;
      out.push([x, y]);
    }
  }
  return out;
})();

/** Der Umriss einer Säule auf dem Schirm (Bodeneinheiten, y nach unten): Fläche oben, Fläche am Boden — konvex. */
function silhouette(f: { x: number; y: number }, lift: number, fore: number, step: number): [number, number][] {
  const cx = f.x;
  const cy = -f.y * fore;
  const top = (i: number): [number, number] => [cx + HEX_CORNERS[i][0], cy - HEX_CORNERS[i][1] * fore - lift * step];
  const bottom = (i: number): [number, number] => [cx + HEX_CORNERS[i][0], cy - HEX_CORNERS[i][1] * fore + HEX_FLOOR];
  return [top(0), top(1), top(2), top(3), bottom(3), bottom(4), bottom(5), bottom(0)];
}

/** Liegt ein Punkt in einem konvexen Vieleck (im Uhrzeigersinn oder dagegen)? */
function inside(poly: readonly (readonly [number, number])[], x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const c = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
    if (Math.abs(c) < 1e-12) continue;
    const s = c > 0 ? 1 : -1;
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
}

/** Wie viel der Fläche jedes Feldes zu sehen ist (die Säulen davor decken). */
export function visibility(fields: readonly ViewField[], lifts: readonly number[], fore: number, step: number): number[] {
  const sil = fields.map((f, i) => silhouette(f, lifts[i], fore, step));
  return fields.map((f, i) => {
    const cx = f.x;
    const cy = -f.y * fore - lifts[i] * step;
    let seen = 0;
    for (const [sx, sy] of SAMPLES) {
      const px = cx + sx;
      const py = cy - sy * fore;
      let covered = false;
      for (let j = 0; j < fields.length && !covered; j += 1) {
        if (j === i || fields[j].y >= f.y - 1e-9) continue;
        if (Math.abs(fields[j].x - f.x) > 1.2) continue;
        if (inside(sil[j], px, py)) covered = true;
      }
      if (!covered) seen += 1;
    }
    return seen / SAMPLES.length;
  });
}

/**
 * DER EINE SCHRITT EINER ANSICHT: die grösste Schrittweite (höchstens `maxStep`), bei der jede Fläche mindestens zur
 * Hälfte zu sehen ist — für alle Felder dieselbe. Reicht das nicht bis `minStep` (6 px je Schritt bei normalem Zoom), erst
 * steiler von oben (`TILTS`); dann nur die Säulen direkt vor einem verdeckten WICHTIGEN Feld kürzen; nie flacher als
 * `minStep`, nie eine Höhe gestaucht.
 */
export function viewScale(fields: readonly ViewField[], options: { readonly minStep: number; readonly maxStep: number }): ViewScale {
  const lifts = fields.map((f) => Math.max(0, f.steps));
  const minStep = Math.max(1e-3, options.minStep);
  const maxStep = Math.max(minStep, options.maxStep);
  const ok = (fore: number, step: number) => visibility(fields, lifts, fore, step).every((v) => v >= 0.5 - 1e-9);
  /* Die Kandidaten von oben nach unten (die Sichtbarkeit fällt nicht streng mit der Höhe — darum gezählt, nicht halbiert). */
  const candidates: number[] = [];
  for (let s = maxStep; s > minStep; s *= 0.9) candidates.push(s);
  candidates.push(minStep);
  for (const fore of TILTS) {
    for (const step of candidates) {
      if (ok(fore, step)) return finish(fields, lifts, fore, step, false);
    }
  }
  return finish(fields, lifts, TILTS[TILTS.length - 1], minStep, true);
}

function finish(fields: readonly ViewField[], lifts: readonly number[], fore: number, step: number, cutting: boolean): ViewScale {
  const drawn = [...lifts];
  const cut = fields.map(() => false);
  if (cutting) {
    /*
      Für jedes wichtige, noch verdeckte Feld die Säulen davor so weit kürzen, bis es zur Hälfte zu sehen ist; erst danach
      (letzter Ausweg, sonst bliebe ein Feld unter der Hälfte) auch vor den übrigen.
    */
    let all = false;
    for (let pass = 0; pass < 40; pass += 1) {
      const vis = visibility(fields, drawn, fore, step);
      let changed = false;
      fields.forEach((f, i) => {
        if ((!f.important && !all) || vis[i] >= 0.5) return;
        const fronts = fields.map((g, j) => ({ g, j })).filter(({ g, j }) => j !== i && g.y < f.y - 1e-9 && Math.abs(g.x - f.x) <= 1.2 && drawn[j] > drawn[i]);
        for (const { j } of fronts) {
          /* So hoch darf die Säule davor höchstens stehen: die Oberkante ihrer Fläche unter der Mitte der verdeckten Fläche. */
          const room = ((f.y - fields[j].y) * fore - HEX_CORNERS[1][1] * fore) / step;
          /* Ein wenig Luft: genau auf der Mitte bliebe die Hälfte nur knapp (gemessen an Punkten). */
          const limit = Math.max(0, Math.floor(drawn[i] + room - 0.35));
          if (drawn[j] > limit) { drawn[j] = limit; cut[j] = true; changed = true; }
        }
      });
      /* Nichts Wichtiges mehr verdeckt: dann die übrigen; ist auch da nichts mehr zu tun, fertig. */
      if (!changed) { if (all) break; all = true; }
    }
  }
  return { fore, step, drawn, cut, visible: visibility(fields, drawn, fore, step) };
}

/* -- Boden und die Gebiete aus den Daten (verschachtelt, `nest`) --------------------------------------------------- */

/** Der Boden einer Ebene: die freien Plätze des Fächers bis einen Ring hinter dem äussersten (Land, kein Wissen). */
export function groundOf(layout: LevelLayout): { x: number; y: number }[] {
  const all = [...layout.place, ...layout.gates];
  const used = new Set(all.map((p) => `${p.q},${p.r}`));
  const out: { x: number; y: number }[] = [];
  /* Nur der Boden nahe bei den Feldern (ein Ring Land um sie, und der Platz des Lernenden) — keine leere Ebene. */
  for (let ring = 0; ring <= layout.rings + 1; ring += 1) {
    for (const s of fanSlots(ring)) {
      if (used.has(`${s.q},${s.r}`)) continue;
      if (ring !== 0 && !all.some((p) => hexDistance(p.q, p.r, s.q, s.r) <= 1)) continue;
      out.push({ x: s.x, y: s.y });
    }
  }
  return out;
}

/** Was ein Baum aus den Daten hergibt (`landscapeNest.ts` readNest). */
export interface NestLike {
  readonly nodes: ReadonlyMap<string, { readonly id: string; readonly label: string; readonly parent: string | null }>;
  readonly home: ReadonlyMap<string, string>;
  readonly children: ReadonlyMap<string | null, readonly string[]>;
}

/**
 * DIE GEBIETE AUS DEN DATEN (der verschachtelte Krajobraz, `"landscape": {"nest": …}`): die Knoten des Besitzers sind die
 * Gebiete. Damit keine Karte Themen und Gebiete mischt, stehen Themen, die direkt in einem Knoten mit Unterknoten liegen,
 * in einem eigenen Gebiet „Weiteres in …" daneben.
 */
export function nestAsRegions(nest: NestLike, tg: TopicGraph, other: (name: string) => string, topName: string): RegionTree {
  const g = tg.graph;
  const direct = new Map<string | null, number[]>();
  g.ids.forEach((id, t) => {
    const home = nest.home.get(id) ?? null;
    const at = home !== null && nest.nodes.has(home) ? home : null;
    const list = direct.get(at) ?? [];
    list.push(t);
    direct.set(at, list);
  });
  const regions = new Map<string, { key: string; level: number; parent: string | null; children: string[]; topics: number[]; name: string; named: 'base' | 'central' | 'owner'; central: number }>();
  const centralOf = (topics: readonly number[]): number => {
    const set = new Set(topics);
    let best = topics[0] ?? 0;
    let most = -1;
    for (const t of topics) {
      let n = 0;
      for (const u of topics) if ((g.needs[u] ?? []).includes(t)) n += 1;
      if (n > most) { most = n; best = t; }
    }
    return set.has(best) ? best : topics[0] ?? 0;
  };
  /* Von unten nach oben: was ein Knoten enthält; leere Knoten fallen weg. */
  const build = (node: string, parent: string | null, depth: number): string | null => {
    const kids = depth > 32 ? [] : (nest.children.get(node) ?? []).map((c) => build(c, node, depth + 1)).filter((x): x is string => x !== null);
    const own = direct.get(node) ?? [];
    const label = nest.nodes.get(node)?.label ?? node;
    if (kids.length === 0 && own.length === 0) return null;
    if (kids.length === 0) {
      regions.set(node, { key: node, level: 1, parent, children: own.map((t) => g.ids[t]), topics: [...own], name: label, named: 'base', central: centralOf(own) });
      return node;
    }
    const children = [...kids];
    if (own.length > 0) {
      const rest = `${node}::rest`;
      regions.set(rest, { key: rest, level: 1, parent: node, children: own.map((t) => g.ids[t]), topics: [...own], name: other(label), named: 'base', central: centralOf(own) });
      children.push(rest);
    }
    for (const k of kids) { const r = regions.get(k); if (r !== undefined) regions.set(k, { ...r, parent: node }); }
    const topics = children.flatMap((k) => regions.get(k)?.topics ?? []);
    const level = 1 + Math.max(...children.map((k) => regions.get(k)?.level ?? 1));
    regions.set(node, { key: node, level, parent, children, topics, name: label, named: 'base', central: centralOf(topics) });
    return node;
  };
  const tops = (nest.children.get(null) ?? []).map((n) => build(n, null, 0)).filter((x): x is string => x !== null);
  const loose = direct.get(null) ?? [];
  let top: string[] = tops;
  if (tops.length === 0) top = loose.map((t) => g.ids[t]);
  else if (loose.length > 0) {
    regions.set('::top', { key: '::top', level: 1, parent: null, children: loose.map((t) => g.ids[t]), topics: [...loose], name: other(topName), named: 'base', central: centralOf(loose) });
    top = [...tops, '::top'];
  }
  const levels = tops.length === 0 ? 0 : Math.max(...top.map((k) => regions.get(k)?.level ?? 1));
  const leafOf: (string | null)[] = g.ids.map(() => null);
  const assignment: Record<string, string[]> = {};
  for (const r of regions.values()) if (r.level === 1) for (const t of r.topics) leafOf[t] = r.key;
  g.ids.forEach((id, t) => {
    const chain: string[] = [];
    for (let at = leafOf[t], k = 0; at !== null && k < 64; at = regions.get(at)?.parent ?? null, k += 1) chain.unshift(at);
    assignment[id] = chain;
  });
  return { levels, regions, top, leafOf, assignment, stats: { sizes: [], inside: [], ms: 0, moved: 0, ignored: [], bounds: [], edges: 0, cycles: 0 } };
}
