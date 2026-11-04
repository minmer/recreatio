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
  /** Der erste Platz des Feldes (bei einem Gebiet: wo seine Fläche beginnt, neben dem, worauf es baut). */
  readonly q: number;
  readonly r: number;
  /** Die Mitte des Feldes (bei einem Gebiet: die Mitte seiner Fläche). */
  readonly x: number;
  readonly y: number;
  /** Der Ring des ersten Platzes (Abstand vom Lernenden). */
  readonly ring: number;
  /** Winkel im Fächer: 0 links, 180 rechts (Tore auch darunter: −180 … 360). */
  readonly angle: number;
  /** Die Reihenfolge, in der gelegt wurde — eine gültige Reihenfolge des Lernens auf dieser Karte. */
  readonly order: number;
}

export interface LevelGate extends Omit<LevelPlace, 'order'> {
  /** Das verbundene Gebiet (auf der Ebene, auf der es neben diesem steht). */
  readonly key: string;
  readonly label: string;
  /** Es kommt davor (Voraussetzungen von hier liegen dort) / danach (es baut auf hier). */
  readonly before: boolean;
  readonly after: boolean;
  readonly weight: number;
}

/** Ein Platz auf der Karte, der zu einem Feld gehört (ein Gebiet hat viele: seine Fläche). */
export interface LevelCell {
  readonly q: number;
  readonly r: number;
  readonly x: number;
  readonly y: number;
  /** Das Stück des Feldes (`LevelLayout.units`), zu dem der Platz gehört. */
  readonly unit: number;
}

/**
 * EIN STÜCK EINER FLÄCHE: ein Gebiet ganz — oder eines seiner Teilgebiete, wenn nicht jedes Thema eine eigene Säule
 * bekommt. `topics`: jedes Thema eine Säule (in der Reihenfolge `order`: das Niedrigste zuerst, am Anfang der Fläche);
 * `sketch`: `size` Säulen stehen für das Höchste, das Niedrigste und das Lernbare darin (`sketchOf`).
 */
export interface LevelUnit {
  readonly item: number;
  readonly key: string;
  readonly label: string;
  readonly topics: readonly number[];
  readonly size: number;
  readonly mode: 'topics' | 'sketch';
  readonly order: readonly number[];
}

/** Wie ein Gebiet sein Inneres zeigt: jedes Thema · seine Teilgebiete mit ihrem Relief · eine kleine Skizze. */
export type LevelTier = 'single' | 'topics' | 'parts' | 'sketch';

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
  /** Der äusserste Ring der Plätze. */
  readonly rings: number;
  /** Je Feld seine Plätze (in der Reihenfolge, in der die Fläche wuchs; ein Thema: einer). */
  readonly cells: readonly (readonly LevelCell[])[];
  readonly units: readonly LevelUnit[];
  readonly tiers: readonly LevelTier[];
}

const angleGap = (a: number, b: number): number => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const fanAngle = (x: number, y: number): number => (Math.atan2(y, -x) * 180) / Math.PI;
const cellKey = (q: number, r: number): number => (q + 4096) * 8192 + (r + 4096);
const NEIGHBOURS: readonly (readonly [number, number])[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
/** Im Fächer: vor dem Lernenden nichts (y ≥ 0). */
const inFan = (q: number, r: number): boolean => r + q / 2 >= -1e-9;

/**
 * WIE VIELE PLÄTZE JEDES GEBIET BEKOMMT (`budget`: so viele Säulen passen auf die Karte): passen alle Themen, steht jedes
 * Thema als eigene Säule (Teilgebiete als eigene Stücke darin); sonst je Gebiet sein Anteil — für Teilgebiete, die damit
 * noch je drei Säulen bekommen, ihr eigenes Relief, sonst eine kleine Skizze. Nie eine einzige Säule für ein Gebiet.
 */
export function unitsOf(items: readonly LevelItem[], tree: RegionTree | null, budget: number, tg: TopicGraph): { units: LevelUnit[]; tiers: LevelTier[] } {
  const whole = globalDepth(tg);
  const rank = (t: number) => tg.graph.rank?.[t] ?? t;
  const ordered = (topics: readonly number[]) => [...topics].sort((a, b) => whole[a] - whole[b] || rank(a) - rank(b) || a - b);
  const units: LevelUnit[] = [];
  const tiers: LevelTier[] = [];
  const total = items.reduce((s, it) => s + (it.kind === 'region' ? it.topics.length : 1), 0);
  const all = total <= budget;
  items.forEach((it, i) => {
    if (it.kind === 'topic' || budget <= 0) {
      units.push({ item: i, key: it.key, label: it.label, topics: it.topics, size: 1, mode: 'topics', order: ordered(it.topics) });
      tiers.push('single');
      return;
    }
    const region = tree?.regions.get(it.key);
    const kids = region !== undefined && region.level > 1 ? region.children.map((k) => tree!.regions.get(k)).filter((r): r is NonNullable<typeof r> => r !== undefined && r.topics.length > 0) : [];
    const share = all ? it.topics.length : Math.max(4, Math.round((budget * it.topics.length) / Math.max(1, total)));
    if (all || it.topics.length <= share) {
      if (kids.length > 1) for (const k of kids) units.push({ item: i, key: k.key, label: k.name, topics: k.topics, size: k.topics.length, mode: 'topics', order: ordered(k.topics) });
      else units.push({ item: i, key: it.key, label: it.label, topics: it.topics, size: it.topics.length, mode: 'topics', order: ordered(it.topics) });
      tiers.push('topics');
      return;
    }
    if (kids.length > 1 && share >= 3 * kids.length) {
      for (const k of kids) {
        const b = Math.max(3, Math.round((share * k.topics.length) / it.topics.length));
        const fits = k.topics.length <= b;
        units.push({ item: i, key: k.key, label: k.name, topics: k.topics, size: fits ? k.topics.length : b, mode: fits ? 'topics' : 'sketch', order: ordered(k.topics) });
      }
      tiers.push('parts');
      return;
    }
    units.push({ item: i, key: it.key, label: it.label, topics: it.topics, size: share, mode: 'sketch', order: ordered(it.topics) });
    tiers.push('sketch');
  });
  return { units, tiers };
}

/**
 * DIE SKIZZE EINES STÜCKS: `size` Themen, die für das Ganze stehen — das Niedrigste, das Höchste, was jetzt lernbar ist
 * (bis zu einem Drittel), dazwischen gleichmässig nach der Höhe. In der Reihenfolge der Höhe (die Fläche steigt von ihrem
 * Anfang an).
 */
export function sketchOf(topics: readonly number[], steps: (t: number) => number, ready: (t: number) => boolean, size: number): number[] {
  if (topics.length <= size) return [...topics].sort((a, b) => steps(a) - steps(b) || a - b);
  const byHeight = [...topics].sort((a, b) => steps(a) - steps(b) || a - b);
  const pick = new Set<number>([byHeight[0], byHeight[byHeight.length - 1]]);
  for (const t of byHeight) { if (pick.size >= Math.max(2, Math.ceil(size / 3)) + 1) break; if (ready(t)) pick.add(t); }
  for (let k = 0; pick.size < size && k < size * 4; k += 1) {
    const at = Math.round(((k % size) + 0.5) * (byHeight.length - 1) / size);
    let j = at;
    while (j < byHeight.length && pick.has(byHeight[j])) j += 1;
    if (j < byHeight.length) pick.add(byHeight[j]);
  }
  for (const t of byHeight) { if (pick.size >= size) break; pick.add(t); }
  return [...pick].sort((a, b) => steps(a) - steps(b) || a - b);
}

/**
 * DIE LAGE EINER EBENE — nur aus der Struktur (für jeden Lernenden dieselbe), Stück für Stück in einer gültigen
 * Reihenfolge des Lernens gelegt:
 * <code>
 *   Anfang     das erste Feld beim Lernenden (unten in der Mitte), weitere Anfänge daneben
 *   Nachbarn   jedes Stück beginnt direkt neben dem, worauf es baut (Teilgebiete eines Gebiets nebeneinander), auf dem
 *              niedrigsten freien Ring, nie weiter innen als seine Voraussetzungen — so windet sich eine Kette um den
 *              Anfang (Schlange im Fächer), statt als gerade Treppe davonzulaufen; die Karte bleibt kompakt und rund
 *   Richtungen jeder Zweig bekommt einen Sektor des Fächers nach seiner Grösse (wie ein Baum von der Mitte aus): Zweige
 *              laufen in verschiedene Richtungen, wie Täler in verschiedene Berge
 *   Fläche     ein Gebiet wächst um seinen ersten Platz, das Niedrigste zuerst — das Relief steigt von dort, wo man herkommt
 * </code>
 * `gateAngles`: je verbundenem Gebiet seine Richtung (aus der Karte darüber). `budget`: so viele Säulen passen auf die
 * Karte (0: jedes Feld ein Platz).
 */
export function layoutLevel(items: readonly LevelItem[], tg: TopicGraph, tree: RegionTree | null, open: string | null, gateAngles: ReadonlyMap<string, number> = new Map(), budget = 0): LevelLayout {
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
  for (const [a, b] of edges) prereqs[b].push(a);
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
    Eine Karte von Themen: die Tiefe im GANZEN Graphen (der Rang unter den Tiefen dieser Karte) — ein Thema, das in seinem
    Gebiet vorn steht, aber lange Ketten von draussen braucht, stünde sonst als hoher Berg vor den niedrigen. Die
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
  const gateKeys = [...gateOf.keys()].sort((a, b) => (gateOf.get(b)!.weight - gateOf.get(a)!.weight) || (a < b ? -1 : 1));
  const gateAngle = new Map<string, number>();
  gateKeys.forEach((k, j) => {
    const given = gateAngles.get(k);
    if (given !== undefined && Number.isFinite(given)) { gateAngle.set(k, given); return; }
    const info = gateOf.get(k)!;
    gateAngle.set(k, info.before && !info.after ? -30 - 20 * j : info.after && !info.before ? 210 + 20 * j : 90 + (j % 2 === 0 ? 1 : -1) * 30 * Math.ceil(j / 2));
  });
  const toFan = (a: number): number => { let x = ((a % 360) + 360) % 360; if (x > 270) x -= 360; return Math.max(0, Math.min(180, x)); };
  const pulls: number[][] = Array.from({ length: n }, () => []);
  for (const [item, key] of gateEdgesRaw) pulls[item].push(toFan(gateAngle.get(key) ?? 90));

  /* Die Stücke (ein Thema: eins; ein Gebiet: seine Fläche) und ihre Kanten. */
  const { units, tiers } = unitsOf(items, tree, budget, tg);
  const unitOfTopic = new Map<number, number>();
  units.forEach((u, k) => { for (const t of u.topics) unitOfTopic.set(t, k); });
  const unitNeeds = units.map((u, k) => {
    const w = new Map<number, number>();
    for (const t of u.topics) for (const p of g.needs[t] ?? []) { const v = unitOfTopic.get(p); if (v !== undefined && v !== k) w.set(v, (w.get(v) ?? 0) + 1); }
    return w;
  });
  /* Die Tiefe eines Stücks unter den Stücken seines Feldes (Teilgebiete der Reihe nach). */
  const unitDepth = new Array<number>(units.length).fill(-1);
  const ubusy = new Uint8Array(units.length);
  const unitDepthOf = (k: number): number => {
    if (unitDepth[k] >= 0) return unitDepth[k];
    if (ubusy[k] === 1) return 0;
    ubusy[k] = 1;
    let d = 0;
    for (const v of unitNeeds[k].keys()) if (units[v].item === units[k].item) d = Math.max(d, unitDepthOf(v) + 1);
    ubusy[k] = 0;
    unitDepth[k] = d;
    return d;
  };
  units.forEach((_, k) => unitDepthOf(k));
  const rankOfUnit = (k: number) => Math.min(...units[k].topics.map((t) => g.rank?.[t] ?? t));

  /* Die Sektoren: ein Baum von der Mitte aus (je Feld seine stärkste Voraussetzung), jeder Zweig nach seiner Grösse. */
  const itemSize = items.map((_, i) => units.filter((u) => u.item === i).reduce((s, u) => s + u.size, 0));
  const parent = items.map((_, i) => {
    let best = -1;
    let bw = -1;
    for (const p of prereqs[i]) { const w = weights.get(`${p}>${i}`) ?? 1; if (w > bw || (w === bw && depth[p] > depth[best])) { bw = w; best = p; } }
    return best;
  });
  const kidsOf: number[][] = Array.from({ length: n }, () => []);
  parent.forEach((p, i) => { if (p >= 0) kidsOf[p].push(i); });
  const byRank = (a: number, b: number) => items[a].rank - items[b].rank || a - b;
  const subtree = new Array<number>(n).fill(0);
  const sizeOf = (i: number, guard = 0): number => { if (subtree[i] > 0 || guard > n) return subtree[i]; subtree[i] = itemSize[i] + kidsOf[i].reduce((s, c) => s + sizeOf(c, guard + 1), 0); return subtree[i]; };
  const sector: [number, number][] = items.map(() => [0, 180]);
  const share = (list: number[], a0: number, a1: number, guard: number) => {
    if (guard > n) return;
    const sorted = [...list].sort(byRank);
    const sum = sorted.reduce((s, c) => s + sizeOf(c), 0);
    let at = a0;
    for (const c of sorted) {
      const w = ((a1 - a0) * sizeOf(c)) / Math.max(1, sum);
      sector[c] = [at, at + w];
      share(kidsOf[c], at, at + w, guard + 1);
      at += w;
    }
  };
  share(items.map((_, i) => i).filter((i) => parent[i] < 0), 0, 180, 0);

  /* Die Reihenfolge: Feld für Feld nach der Tiefe (dann der Autor), im Feld seine Stücke nach ihrer Tiefe. */
  const itemOrder = items.map((_, i) => i).sort((a, b) => depth[a] - depth[b] || items[a].rank - items[b].rank || a - b);
  const unitOrder: number[] = [];
  for (const i of itemOrder) {
    const mine = units.map((_, k) => k).filter((k) => units[k].item === i);
    mine.sort((a, b) => unitDepth[a] - unitDepth[b] || rankOfUnit(a) - rankOfUnit(b) || a - b);
    unitOrder.push(...mine);
  }

  /* Legen: Stück für Stück an den besten freien Rand, dann um diesen Platz wachsen. */
  const taken = new Map<number, number>();
  const frontier = new Set<number>();
  const unitCells: { q: number; r: number }[][] = units.map(() => []);
  const ringOf = (q: number, r: number) => hexDistance(0, 0, q, r);
  const angleAt = (q: number, r: number) => { const c = hexCenter(q, r); return fanAngle(c.x, c.y); };
  const sectorPen = (k: number, q: number, r: number) => {
    const ring = ringOf(q, r);
    if (ring <= 1) return 0;
    const [a0, a1] = sector[units[k].item];
    const a = angleAt(q, r);
    return (Math.max(0, a0 - a, a - a1) / 20) * Math.min(1, ring / 3);
  };
  const distTo = (q: number, r: number, cells: readonly { q: number; r: number }[]) => { let d = Number.POSITIVE_INFINITY; for (const c of cells) d = Math.min(d, hexDistance(q, r, c.q, c.r)); return d; };
  const take = (k: number, q: number, r: number) => {
    const key = cellKey(q, r);
    taken.set(key, k);
    frontier.delete(key);
    unitCells[k].push({ q, r });
    for (const [dq, dr] of NEIGHBOURS) { const a = q + dq; const b = r + dr; const nk = cellKey(a, b); if (inFan(a, b) && !taken.has(nk)) frontier.add(nk); }
  };
  const decode = (key: number): [number, number] => [Math.floor(key / 8192) - 4096, (key % 8192) - 4096];
  /** Ob von einem freien Platz aus `need` freie Plätze zusammenhängend zu erreichen sind. */
  const roomAt = (start: number, need: number): boolean => {
    const seen = new Set<number>([start]);
    const stack = [start];
    while (stack.length > 0 && seen.size < need) {
      const [q, r] = decode(stack.pop()!);
      for (const [dq, dr] of NEIGHBOURS) { const a = q + dq; const b = r + dr; const nk = cellKey(a, b); if (!seen.has(nk) && inFan(a, b) && !taken.has(nk)) { seen.add(nk); stack.push(nk); } }
    }
    return seen.size >= need;
  };
  const anchorRing = new Array<number>(units.length).fill(0);
  const itemRing = new Array<number>(n).fill(-1);
  /* Das erste Stück jedes Feldes (sein erster Platz ist der Platz des Feldes). */
  const firstUnit = new Array<number>(n).fill(-1);
  for (const k of unitOrder) if (firstUnit[units[k].item] < 0) firstUnit[units[k].item] = k;
  /** Der erste Platz eines Stücks: neben dem, worauf es baut, auf dem niedrigsten Ring, mit Platz für die ganze Fläche. */
  const anchorOf = (k: number) => {
    const u = units[k];
    const needs = [...unitNeeds[k].entries()].filter(([v]) => unitCells[v].length > 0);
    const siblings = units.map((_, v) => v).filter((v) => v !== k && units[v].item === u.item && unitCells[v].length > 0);
    /* Nie weiter innen als, worauf es baut — das erste Stück eines Feldes auch nicht als die Felder, auf die es baut. */
    const first = siblings.length === 0;
    const lead = firstUnit[u.item] === k;
    let minRing = needs.reduce((m, [v]) => Math.max(m, anchorRing[v]), 0);
    if (lead) for (const p of prereqs[u.item]) if (itemRing[p] >= 0) minRing = Math.max(minRing, itemRing[p]);
    let options = taken.size === 0 ? [cellKey(0, 0)] : [...frontier];
    /* Ein weiteres Stück desselben Gebiets: direkt an seine Geschwister (die Fläche bleibt eins). */
    if (!first) {
      const touching = options.filter((key) => { const [q, r] = decode(key); return siblings.some((v) => distTo(q, r, unitCells[v]) <= 1); });
      if (touching.length > 0) options = touching;
    }
    const outward = options.filter((key) => { const [q, r] = decode(key); return ringOf(q, r) >= minRing; });
    if (outward.length > 0) options = outward;
    /* Nur, wo die ganze Fläche Platz hat (keine Lücke, in der sie stecken bliebe). */
    const need = lead ? itemSize[u.item] : u.size;
    if (need > 1) {
      const roomy = options.filter((key) => roomAt(key, need));
      if (roomy.length > 0) options = roomy;
    }
    let best = options[0];
    let score = Number.POSITIVE_INFINITY;
    for (const key of options) {
      const [q, r] = decode(key);
      let s = ringOf(q, r) + 1.5 * sectorPen(k, q, r) + angleAt(q, r) * 1e-4;
      for (const [v, w] of needs) s += 4 * w * Math.max(0, distTo(q, r, unitCells[v]) - 1);
      for (const v of siblings) s += 6 * Math.max(0, distTo(q, r, unitCells[v]) - 1);
      for (const a of pulls[u.item]) if (ringOf(q, r) >= 2) s += (0.6 * angleGap(angleAt(q, r), a)) / 45;
      /* Nicht dicht neben den ersten Platz eines Nachbarn derselben Runde (jeder braucht Platz, um zu wachsen). */
      for (const v of round) if (v !== k && unitCells[v].length > 0) { const d = distTo(q, r, unitCells[v]); if (d <= 2) s += 1.2 * (3 - d); }
      if (s < score - 1e-9) { score = s; best = key; }
    }
    const [aq, ar] = decode(best);
    anchorRing[k] = ringOf(aq, ar);
    if (lead) itemRing[u.item] = anchorRing[k];
    take(k, aq, ar);
    anchorAt[k] = [aq, ar];
  };
  /** Ein Platz mehr: kompakt um den ersten, im eigenen Sektor. */
  const growOne = (k: number): boolean => {
    const [aq, ar] = anchorAt[k];
    let pick = -1;
    let ps = Number.POSITIVE_INFINITY;
    const seen = new Set<number>();
    for (const c of unitCells[k]) {
      for (const [dq, dr] of NEIGHBOURS) {
        const q = c.q + dq;
        const r = c.r + dr;
        const key = cellKey(q, r);
        if (seen.has(key) || !inFan(q, r) || taken.has(key)) continue;
        seen.add(key);
        const s = hexDistance(q, r, aq, ar) + 0.3 * ringOf(q, r) + 0.8 * sectorPen(k, q, r) + angleAt(q, r) * 1e-4;
        if (s < ps - 1e-9) { ps = s; pick = key; }
      }
    }
    if (pick < 0) return false;
    const [q, r] = decode(pick);
    take(k, q, r);
    return true;
  };
  /*
    Runde für Runde (dieselbe Tiefe, dasselbe Stück im Feld): erst wählt jedes seinen ersten Platz, dann wachsen sie
    abwechselnd — so behält jedes den Rand dessen, worauf es baut, statt dass das erste ihn ganz umschliesst.
  */
  const anchorAt: [number, number][] = units.map(() => [0, 0]);
  let round: number[] = [];
  for (let at = 0; at < unitOrder.length;) {
    const k0 = unitOrder[at];
    const key = (k: number) => `${depth[units[k].item]}:${unitDepth[k]}`;
    round = [];
    const stuck: number[] = [];
    while (at < unitOrder.length && key(unitOrder[at]) === key(k0)) { round.push(unitOrder[at]); at += 1; }
    for (const k of round) anchorOf(k);
    /* Ein weiteres Stück, das seine Geschwister nicht mehr erreicht: das Feld wird unten neu gelegt. */
    for (const k of round) {
      const sibs = unitOrder.filter((v) => v !== k && units[v].item === units[k].item && unitCells[v].length > 0);
      if (firstUnit[units[k].item] !== k && sibs.length > 0 && !sibs.some((v) => distTo(unitCells[k][0].q, unitCells[k][0].r, unitCells[v]) <= 1)) stuck.push(k);
    }
    let growing = round.filter((k) => unitCells[k].length < units[k].size);
    while (growing.length > 0) {
      for (const k of growing) if (!growOne(k) && !stuck.includes(k)) stuck.push(k);
      growing = growing.filter((k) => unitCells[k].length < units[k].size && !stuck.includes(k));
    }
    /* Eingeschlossen, bevor die Fläche voll war: noch einmal legen, allein (wo die ganze Fläche Platz hat). */
    const release = (k: number) => {
      for (const c of unitCells[k]) taken.delete(cellKey(c.q, c.r));
      unitCells[k] = [];
    };
    const refresh = () => {
      frontier.clear();
      for (const key of taken.keys()) { const [q, r] = decode(key); for (const [dq, dr] of NEIGHBOURS) { const nk = cellKey(q + dq, r + dr); if (inFan(q + dq, r + dr) && !taken.has(nk)) frontier.add(nk); } }
      if (taken.size === 0) frontier.add(cellKey(0, 0));
    };
    const placeAlone = (k: number) => { round = [k]; anchorOf(k); while (unitCells[k].length < units[k].size && growOne(k)); };
    for (const k of stuck) {
      release(k);
      refresh();
      placeAlone(k);
      /* Kein Platz neben den Geschwistern mehr: das ganze Feld neu legen (seine Fläche bleibt eins). */
      const item = units[k].item;
      const sibs = unitOrder.filter((v) => v !== k && units[v].item === item && unitCells[v].length > 0);
      const touches = sibs.length === 0 || unitCells[k].some((c) => sibs.some((v) => distTo(c.q, c.r, unitCells[v]) <= 1));
      if (!touches) {
        const mine = unitOrder.filter((v) => units[v].item === item && unitCells[v].length > 0);
        for (const v of mine) release(v);
        refresh();
        for (const v of mine) placeAlone(v);
      }
    }
  }

  /* Die Plätze je Feld, sein erster Platz und seine Mitte. */
  const cells: LevelCell[][] = items.map(() => []);
  for (const k of unitOrder) for (const c of unitCells[k]) { const p = hexCenter(c.q, c.r); cells[units[k].item].push({ q: c.q, r: c.r, x: p.x, y: p.y, unit: k }); }
  const orderOfItem = new Map(itemOrder.map((i, k) => [i, k] as const));
  const place: LevelPlace[] = items.map((_, i) => {
    const list = cells[i];
    const first = list[0] ?? { q: 0, r: 0, x: 0, y: 0 };
    const x = list.reduce((s, c) => s + c.x, 0) / Math.max(1, list.length);
    const y = list.reduce((s, c) => s + c.y, 0) / Math.max(1, list.length);
    return { q: first.q, r: first.r, x, y, ring: ringOf(first.q, first.r), angle: fanAngle(x, y), order: orderOfItem.get(i) ?? i };
  });
  const allCells = cells.flat();
  const rings = allCells.length === 0 ? 0 : Math.max(...allCells.map((c) => ringOf(c.q, c.r)));

  /*
    Die Tore am Rand: dicht um die Felder (zwei, drei Plätze von ihnen weg), in ihrer Richtung von der Mitte der Felder aus.
  */
  const near = distanceField(allCells, 3, () => true);
  const midX = allCells.reduce((s, p) => s + p.x, 0) / Math.max(1, allCells.length);
  const midY = allCells.reduce((s, p) => s + p.y, 0) / Math.max(1, allCells.length);
  const gateSlots: { q: number; r: number; x: number; y: number; angle: number }[] = [];
  for (const [key, d] of near) {
    if (d !== 2 && d !== 3) continue;
    const [q, r] = decode(key);
    const c = hexCenter(q, r);
    let angle = fanAngle(c.x - midX, c.y - midY);
    if (angle < -90) angle += 360;
    gateSlots.push({ q, r, x: c.x, y: c.y, angle });
  }
  gateSlots.sort((a, b) => a.q - b.q || a.r - b.r);
  if (gateSlots.length === 0) gateSlots.push({ q: 0, r: 3, ...hexCenter(0, 3), angle: 90 });
  const gateTaken = new Set<string>();
  const placedGates: { q: number; r: number }[] = [];
  const gates: LevelGate[] = gateKeys.map((key) => {
    const a = gateAngle.get(key)!;
    /* Tore mit Abstand (drei Plätze — Platz für ihre Namen); geht das nicht mehr, ein freier Platz. */
    const pick = (spread: number) => {
      let best: (typeof gateSlots)[number] | null = null;
      let gap = Number.POSITIVE_INFINITY;
      for (const s of gateSlots) {
        if (gateTaken.has(`${s.q},${s.r}`) || placedGates.some((p) => hexDistance(p.q, p.r, s.q, s.r) < spread)) continue;
        const d = angleGap(s.angle, a) + (near.get(cellKey(s.q, s.r)) === 3 ? 4 : 0);
        if (d < gap) { gap = d; best = s; }
      }
      return best;
    };
    const best = pick(3) ?? pick(1) ?? gateSlots[0];
    gateTaken.add(`${best.q},${best.r}`);
    placedGates.push(best);
    const info = gateOf.get(key)!;
    return { key, label: info.label, before: info.before, after: info.after, weight: info.weight, q: best.q, r: best.r, x: best.x, y: best.y, ring: ringOf(best.q, best.r), angle: best.angle };
  });
  const gateIndex = new Map(gates.map((x, j) => [x.key, j] as const));
  const gateEdges = gateEdgesRaw.map(([i, key, before]) => [i, gateIndex.get(key)!, before] as const);
  return { open, items, place, edges, depth, gates, gateEdges, rings, cells, units, tiers };
}

/** Je Platz bis `limit` Schritte von den gegebenen weg sein Abstand (0: sie selbst) — Breitensuche, nur wo `ok`. */
function distanceField(from: readonly { readonly q: number; readonly r: number }[], limit: number, ok: (q: number, r: number) => boolean): Map<number, number> {
  const out = new Map<number, number>();
  let wave: [number, number][] = [];
  for (const c of from) { const k = cellKey(c.q, c.r); if (!out.has(k)) { out.set(k, 0); wave.push([c.q, c.r]); } }
  for (let d = 1; d <= limit; d += 1) {
    const next: [number, number][] = [];
    for (const [q, r] of wave) {
      for (const [dq, dr] of NEIGHBOURS) {
        const a = q + dq;
        const b = r + dr;
        const k = cellKey(a, b);
        if (out.has(k) || !ok(a, b)) continue;
        out.set(k, d);
        next.push([a, b]);
      }
    }
    wave = next;
  }
  return out;
}

/**
 * DER UMRISS EINER FLÄCHE: die Kanten der Plätze, die an keinen anderen Platz derselben Menge stossen, zu geschlossenen
 * Linien verbunden (Bodeneinheiten; die grösste zuerst). Eine Fläche mit Loch hat zwei.
 */
export function outlineOf(cells: readonly { readonly q: number; readonly r: number }[]): [number, number][][] {
  return boundaryOf(cells).loops;
}

/**
 * Der Umriss mit seinen Kanten: je Linie die Punkte und, in derselben Reihenfolge, welche Kante welches Platzes sie ist
 * (`cell`: Index in `cells`, `k`: Kante k von Ecke k zu Ecke k+1).
 */
export function boundaryOf(cells: readonly { readonly q: number; readonly r: number }[]): { loops: [number, number][][]; edges: { cell: number; k: number }[][] } {
  const set = new Set(cells.map((c) => cellKey(c.q, c.r)));
  /* Ecke k einer Kachel liegt bei 60·k Grad; die Kante k (Ecke k → k+1) stösst an den Nachbarn bei 60·k + 30 Grad. */
  const dirOfEdge: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  const pt = (x: number, y: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
  const next = new Map<string, { to: string; x: number; y: number; cell: number; k: number }>();
  const coords = new Map<string, [number, number]>();
  for (const [ci, c] of cells.entries()) {
    const m = hexCenter(c.q, c.r);
    for (let k = 0; k < 6; k += 1) {
      const [dq, dr] = dirOfEdge[k];
      if (set.has(cellKey(c.q + dq, c.r + dr))) continue;
      const a = HEX_CORNERS[k];
      const b = HEX_CORNERS[(k + 1) % 6];
      const ka = pt(m.x + a[0], m.y + a[1]);
      const kb = pt(m.x + b[0], m.y + b[1]);
      coords.set(ka, [m.x + a[0], m.y + a[1]]);
      coords.set(kb, [m.x + b[0], m.y + b[1]]);
      next.set(ka, { to: kb, x: m.x + b[0], y: m.y + b[1], cell: ci, k });
    }
  }
  const found: { loop: [number, number][]; edges: { cell: number; k: number }[] }[] = [];
  const used = new Set<string>();
  for (const start of next.keys()) {
    if (used.has(start)) continue;
    const loop: [number, number][] = [];
    const edges: { cell: number; k: number }[] = [];
    let at = start;
    for (let guard = 0; guard < 100000 && !used.has(at); guard += 1) {
      used.add(at);
      loop.push(coords.get(at)!);
      const e = next.get(at);
      if (e === undefined) break;
      edges.push({ cell: e.cell, k: e.k });
      at = e.to;
    }
    if (loop.length >= 3) found.push({ loop, edges });
  }
  const area = (l: readonly [number, number][]) => Math.abs(l.reduce((s, [x, y], i) => { const [x2, y2] = l[(i + 1) % l.length]; return s + x * y2 - x2 * y; }, 0)) / 2;
  found.sort((a, b) => area(b.loop) - area(a.loop));
  return { loops: found.map((x) => x.loop), edges: found.map((x) => x.edges) };
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
 * unten — auf jeder Ebene in der Reihenfolge, in der ihre Karte gelegt wurde (nach der Tiefe; die Schlange einer Kette
 * entlang), im Gebiet die Themen ebenso. Weil jede Ebene keine Kreise hat, bleibt das eine gültige Reihenfolge des Lernens;
 * die Linie folgt auf jeder Karte den Nachbarn.
 */
export function routeOrder(tree: RegionTree | null, tg: TopicGraph, layoutOf: (open: string | null) => LevelLayout, topics: readonly number[]): number[] {
  const keyOf = (t: number): number[] => {
    const out: number[] = [];
    const chain = tree === null ? [] : tree.assignment[tg.graph.ids[t]] ?? [];
    let open: string | null = null;
    for (const key of [...chain, tg.graph.ids[t]]) {
      const layout = layoutOf(open);
      const i = layout.items.findIndex((it) => it.key === key);
      out.push(i < 0 ? 0 : layout.place[i].order);
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

/**
 * Wie viel der Fläche jedes Feldes zu sehen ist (die Säulen davor decken). Gesucht wird nur unter den Säulen, die nahe
 * genug davor stehen und hoch genug sind, um die Fläche zu erreichen (nach x geordnet) — so bleibt es auch für eine Karte
 * mit Hunderten kleiner Säulen schnell. `floor`: sobald ein Feld darunter fällt, aufhören (`null`).
 */
export function visibility(fields: readonly ViewField[], lifts: readonly number[], fore: number, step: number, floor: number | null = null): number[] | null {
  const n = fields.length;
  const byX = fields.map((_, i) => i).sort((a, b) => fields[a].x - fields[b].x);
  const xs = byX.map((i) => fields[i].x);
  const sil: ([number, number][] | undefined)[] = new Array(n);
  const silOf = (j: number) => sil[j] ?? (sil[j] = silhouette(fields[j], lifts[j], fore, step));
  const out = new Array<number>(n);
  for (let i = 0; i < n; i += 1) {
    const f = fields[i];
    /* Wer davor steht und so hoch reicht. */
    let lo = 0;
    let hi = n;
    while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] < f.x - 1.2) lo = m + 1; else hi = m; }
    const near: number[] = [];
    for (let k = lo; k < n && xs[k] <= f.x + 1.2; k += 1) {
      const j = byX[k];
      if (j === i || fields[j].y >= f.y - 1e-9) continue;
      if ((f.y - fields[j].y) * fore >= (lifts[j] - lifts[i]) * step + fore + 1e-9) continue;
      near.push(j);
    }
    if (near.length === 0) { out[i] = 1; continue; }
    const cx = f.x;
    const cy = -f.y * fore - lifts[i] * step;
    let seen = 0;
    for (const [sx, sy] of SAMPLES) {
      const px = cx + sx;
      const py = cy - sy * fore;
      let covered = false;
      for (let k = 0; k < near.length && !covered; k += 1) if (inside(silOf(near[k]), px, py)) covered = true;
      if (!covered) seen += 1;
    }
    out[i] = seen / SAMPLES.length;
    if (floor !== null && out[i] < floor) return null;
  }
  return out;
}
const seenAll = (fields: readonly ViewField[], lifts: readonly number[], fore: number, step: number) => visibility(fields, lifts, fore, step) ?? fields.map(() => 0);

/**
 * DER EINE SCHRITT EINER ANSICHT: die grösste Schrittweite (höchstens `maxStep`), bei der jede Fläche mindestens zur
 * Hälfte zu sehen ist — für alle Felder dieselbe. Reicht das nicht bis `minStep` (6 px je Schritt bei normalem Zoom), erst
 * steiler von oben (`TILTS`); dann nur die Säulen direkt vor einem verdeckten WICHTIGEN Feld kürzen; nie flacher als
 * `minStep`, nie eine Höhe gestaucht. Viele Felder (eine Karte mit Gebieten und ihrem Relief): halbiert statt gezählt.
 */
export function viewScale(fields: readonly ViewField[], options: { readonly minStep: number; readonly maxStep: number }): ViewScale {
  const lifts = fields.map((f) => Math.max(0, f.steps));
  const minStep = Math.max(1e-3, options.minStep);
  const maxStep = Math.max(minStep, options.maxStep);
  const ok = (fore: number, step: number) => visibility(fields, lifts, fore, step, 0.5 - 1e-9) !== null;
  /* Die Kandidaten von oben nach unten (die Sichtbarkeit fällt nicht streng mit der Höhe — darum gezählt, nicht halbiert). */
  const candidates: number[] = [];
  for (let s = maxStep; s > minStep; s *= 0.9) candidates.push(s);
  candidates.push(minStep);
  for (const fore of TILTS) {
    if (fields.length > 60) {
      if (!ok(fore, minStep)) continue;
      let lo = 0;
      let hi = candidates.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (ok(fore, candidates[m])) hi = m; else lo = m + 1; }
      return finish(fields, lifts, fore, candidates[lo], false);
    }
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
      const vis = seenAll(fields, drawn, fore, step);
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
  return { fore, step, drawn, cut, visible: seenAll(fields, drawn, fore, step) };
}

/**
 * DIE SPANNE DER STUFE einer Ansicht (Bodeneinheiten je Schritt): `footprint` px je Bodeneinheit bei „Ganze Karte".
 * Themen: nie flacher als 6 px je Schritt, die höchste Säule etwa so hoch wie die Karte tief. Gebiete (ein Überblick mit
 * ihrem Relief): flacher — die höchste Säule etwa ein Drittel der Tiefe, damit hinten nichts hinter Türmen verschwindet;
 * dieselbe Stufe für alle, die Höhen bleiben im Verhältnis.
 */
export function stepRange(columns: readonly { readonly y: number; readonly steps: number }[], footprint: number, regional: boolean): { minStep: number; maxStep: number } {
  const tallest = Math.max(1, ...columns.map((c) => c.steps));
  const depthSpan = columns.length === 0 ? 1 : Math.max(...columns.map((c) => c.y)) - Math.min(...columns.map((c) => c.y));
  const maxStep = regional ? Math.min(0.3, (0.8 + depthSpan * 0.32) / tallest) : Math.min(0.3, (2.2 + depthSpan * 0.6) / tallest);
  return { maxStep, minStep: regional ? Math.min(6 / footprint, maxStep * 0.12) : 6 / footprint };
}

/* -- Boden und die Gebiete aus den Daten (verschachtelt, `nest`) --------------------------------------------------- */

/** Der Boden einer Ebene: die freien Plätze des Fächers dicht bei den Feldern und Toren (ein Platz Land um sie) — kein Wissen. */
export function groundOf(layout: LevelLayout): { x: number; y: number }[] {
  const used = [...layout.cells.flat(), ...layout.gates];
  const near = distanceField(used, 1, inFan);
  const out: { x: number; y: number }[] = [];
  for (const [key, d] of near) {
    if (d !== 1) continue;
    const q = Math.floor(key / 8192) - 4096;
    const r = (key % 8192) - 4096;
    out.push(hexCenter(q, r));
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
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
