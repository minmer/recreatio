/**
 * 2026-11-03 — DER KRAJOBRAZ EINER BAZA WIEDZY (documentation/COGITA.md „The knowledge landscape"): jeder Widok als
 * persönliche Landschaft des Betrachters. Rein gerechnet, ohne Oberfläche (gezeichnet von `LandscapeView.tsx`, im Worker
 * `landscape.worker.ts`, geprüft in `scripts/app-landscape-check.mjs`).
 *
 * <b>Eingänge — und nichts sonst</b>: die Einträge des Widoku, die Reihenfolge des Lernens (dieselben Kanten wie
 * `#level`, `learning` und `rel: "before"`: Felder mit `prerequisite`, `needs` der Pytania, die Zależności der
 * Ustawienia — hier ROH, mit Kreisen), die Struktur nach oben (für Bereiche ohne Gruppierung), die Gruppierung des
 * Widoku als Richtung, die Kenntnis des Betrachters (`knowing.ts`, Bänder aus `logic.ts`).
 *
 * <code>
 *   Höhe   −1            Kenntnis ≥ 1 (znane): Talgrund
 *          −1 … 0        0,1 ≤ k < 1 (do powtórki): −(k − 0,1)/0,9 — gelernt, mit einem Zeichen
 *           0            nicht gelernt, nichts fehlt davor: jetzt zu lernen (ebener Boden)
 *           n ≥ 1        nicht gelernt: n verschiedene nicht gelernte Einträge in der ganzen Kette davor (Vereinigung)
 * </code>
 * „Gelernt" ist das Band `learned` (k ≥ 0,1). Gezählt werden nur Einträge mit Karten; die ohne sind durchsichtig. Ein
 * Kreis ist EIN Schritt. Die Vereinigung rechnen Bitmengen über dem verdichteten Graphen in topologischer Reihenfolge.
 *
 * <b>2026-11-03 (E) — EINE FESTE KARTE, NUR DIE HÖHEN ÄNDERN SICH.</b> Jeder Eintrag hat EINE Zelle, gerechnet nur aus der
 * Struktur (`fixedLayout`): sein Bereich ist ein gleich breiter Bogen vom Lernenden aus (in der Reihenfolge des Autors),
 * sein Abstand die Tiefe in der Kette „wymaga", sein Winkel der seiner Voraussetzung im Bereich; vergeben wird in der
 * Reihenfolge des Entstehens — ein neuer Eintrag nimmt eine freie Zelle und schiebt keinen anderen. Dazwischen liegt
 * Boden: EIN zusammenhängendes Sechseckraster, Kante an Kante. Der Fortschritt ändert nur die Höhen: das Gelernte sinkt
 * ins Tal, was jetzt zu lernen ist, liegt eben, was noch nicht erreichbar ist, steht als Berg (`liftOf`). Zoom ist eine
 * Kamera auf dieselbe Karte; das Budget entscheidet nur, welche festen Gebiete zu einem Feld verschmelzen (`layoutOf`).
 *
 * <b>Für später</b> (Avatare, Führungen): `LandscapeEngine` — Graph, Karte, Stand und Gestalt getrennt; `positionOf`,
 * `routeTo`, `marks` (fremde Markierungen auf Feldern) sind der Weg hinein.
 */

import { t, texts } from '../core/i18n';

/* -- Eingänge ---------------------------------------------------------------------------------------------------- */

/** Ein Wert der Richtung (eine Achse, ein Feldwert, ein Rodzaj, eine Ebene). */
export interface LsValue {
  readonly id: string;
  readonly label: string;
  /** Der Wert darüber (Struktur der Achse) — −1: oben. */
  readonly parent: number;
  /** Die Reihenfolge des Autors (Sortierung der Achse). */
  readonly rank: number;
}

export interface LsInput {
  /** Alle Knoten: die Einträge des Widoku und alles, was in der Reihenfolge des Lernens steht. */
  readonly ids: readonly string[];
  readonly labels: readonly string[];
  /** Je Knoten die direkten Voraussetzungen (Indizes) — roh, Kreise erlaubt. */
  readonly needs: readonly (readonly number[])[];
  /** Hat Karten (ein Eintrag ohne ist durchsichtig). */
  readonly learnable: readonly boolean[];
  /** Gehört zum Widok. */
  readonly inView: readonly boolean[];
  /** Die Werte der Richtung — leer: die Bereiche kommen aus dem Baum (`treeAreas`). */
  readonly values: readonly LsValue[];
  /** Je Knoten die Werte, zu denen er gehört (Indizes in `values`). */
  readonly memberOf: readonly (readonly number[])[];
  /** 2026-11-03 — die Werte stehen in der Reihenfolge des Autors (`sort` einer Achse, die Ebenen): nie umordnen. */
  readonly sorted?: boolean;
  /** 2026-11-03 — je Knoten, worunter er in der Struktur liegt (Indizes) — für Bereiche ohne Gruppierung. */
  readonly up?: readonly (readonly number[])[];
}

/** Der Stand des Betrachters je Knoten. */
export interface LsState {
  /** Die Kenntnis des Eintrags (`itemKnowness`); 0 ohne Antwort. */
  readonly knowness: ArrayLike<number>;
  /** Hat eine beantwortete Karte mit Kenntnis unter 1 (do powtórki, oder zuletzt falsch, vergessen). */
  readonly weak: ArrayLike<number | boolean>;
  /** 2026-11-03 (C) — je Knoten: wie viele seiner Karten sitzen (Kenntnis ≥ 1), von wie vielen — der Ring des Fortschritts. */
  readonly cardsKnown?: ArrayLike<number>;
  readonly cardsTotal?: ArrayLike<number>;
  /** 2026-11-04 (Prompt 15, 4b) — je Knoten die mittlere Kenntnis seiner Karten (je Karte höchstens 1; dasselbe Mass wie „gekonnt") — der Ring in der Kachel. */
  readonly cardsMean?: ArrayLike<number>;
}

/**
 * 2026-11-03 — WIE SICH DAS BUDGET AUF DIE BÄNDER TEILT (Anteile 0–1): jedes Band bekommt zuerst seinen Anteil (`ring`:
 * was jetzt zu lernen ist, `due`: was zu wiederholen ist, `known`: das Tal); was ein Band nicht braucht, geht in dieser
 * Reihenfolge weiter (Ring, Wiederholung, Tal, Berge) — Berge stehen nie einzeln, solange ein Ring-Eintrag verborgen ist.
 * Mehr als 1 zusammen wird verhältnisgleich gekürzt.
 */
export interface LsBands {
  readonly ring: number;
  readonly due: number;
  readonly known: number;
}

export const LS_BANDS: LsBands = { ring: 0.5, due: 0.2, known: 0.1 };

export interface LsOptions {
  /** Höchstens so viele einzelne Felder (Vorgabe 60). */
  readonly budget?: number;
  /** 2026-11-03 — die Anteile der Bänder am Budget (fehlende: `LS_BANDS`). */
  readonly bands?: Partial<LsBands>;
  /** Der Fokus: Werte (ihre Kennungen) — leer: alles. Nur die Kamera und was einzeln steht; die Karte bleibt. */
  readonly focus?: readonly string[];
  /** Das Ziel (eine Kennung) — sein Weg wird markiert. */
  readonly goal?: string | null;
  /** 2026-11-03 — für später: fremde Markierungen auf Feldern (Avatare, eine Führung), je Eintrag ein Wort. */
  readonly marks?: Readonly<Record<string, string>>;
  /** (Bis 2026-11-03: ein schmaleres Bild. Die Karte ist fest — die Breite skaliert sie nur.) */
  readonly narrow?: boolean;
}

/* -- Konstanten ---------------------------------------------------------------------------------------------------- */

/** Ab hier „znane" (`knowness.ts` KNOWN), ab hier „poznane" (FORGOTTEN) — dieselben Bänder wie überall. */
export const LS_KNOWN = 1;
export const LS_LEARNED = 0.1;
export const LS_BUDGET = 60;
/** Mehr Speicher für die Bitmengen nicht (Wörter): darüber zählt eine Suche je Eintrag (langsamer, aber begrenzt). */
const MAX_WORDS = 40_000_000;

/** 2026-11-03 — DIE ZEICHNUNG (auch für die Ansicht): halbschräg — die Tiefe des Bodens gestaucht. */
export const LS_FORE = 0.52;
/** Eine Kachel in der Höhe, in Bodeneinheiten (Abstand zweier Nachbarzellen = 1). */
export const LS_TILE = 0.4;
/** So viel ihrer Zelle füllt eine Kachel — 2026-11-03 (E): ganz, Kante an Kante (ein zusammenhängendes Raster). */
export const LS_SHRINK = 1;

export type LsBand = 'known' | 'due' | 'ring' | 'mountain';

export const LS_BAND_LABEL: Readonly<Record<LsBand, string>> = texts({
  known: 'cogitaLearnLogic.band.known', due: 'cogitaLearnLogic.band.due', ring: 'cogitaLearnLogic.band.ring', mountain: 'cogitaLearnLogic.band.mountain'
});

/** Das Zeichen jedes Bandes — nie nur die Farbe. */
export const LS_BAND_MARK: Readonly<Record<LsBand, string>> = { known: '●', due: '◑', ring: '○', mountain: '▲' };

/** Die Höhe eines gelernten Eintrags aus seiner Kenntnis. */
export const valleyHeight = (k: number): number => (k >= LS_KNOWN ? -1 : -Math.max(0, Math.min(1, (k - LS_LEARNED) / (LS_KNOWN - LS_LEARNED))));

export const isLearned = (k: number): boolean => Number.isFinite(k) && k >= LS_LEARNED - 1e-12;

/* -- Bits ----------------------------------------------------------------------------------------------------------- */

function pop32(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24);
}

/* -- Der verdichtete Graph ----------------------------------------------------------------------------------------- */

export interface LsGraph {
  readonly n: number;
  /** Je Knoten seine Komponente. */
  readonly comp: Int32Array;
  /** Die Komponenten in topologischer Reihenfolge (Voraussetzungen zuerst). */
  readonly order: Int32Array;
  /** Je Komponente ihre Stelle in `order`. */
  readonly rank: Int32Array;
  readonly members: readonly (readonly number[])[];
  /** Je Komponente die Komponenten direkt davor (ohne sich selbst). */
  readonly parents: readonly (readonly number[])[];
  readonly children: readonly (readonly number[])[];
  /** Je Komponente ihr Bit (−1: ohne Karten). */
  readonly bit: Int32Array;
  readonly words: number;
  /** Die Vereinigung aller Bits davor, je Komponente `words` Wörter — `null`, wenn zu gross. */
  readonly closure: Uint32Array | null;
  /** Die Knoten in Kreisen (mehr als einer in der Komponente). */
  readonly cycles: readonly (readonly number[])[];
  readonly learnable: Uint8Array;
}

/** Tarjan ohne Rekursion: die stark zusammenhängenden Komponenten über `needs` (Kante Voraussetzung → Eintrag). */
function components(n: number, needs: readonly (readonly number[])[]): { comp: Int32Array; count: number } {
  /* Die Nachfolger: wer auf diesem aufbaut. */
  const succStart = new Int32Array(n + 1);
  for (let v = 0; v < n; v += 1) for (const p of needs[v] ?? []) if (p >= 0 && p < n && p !== v) succStart[p + 1] += 1;
  for (let i = 0; i < n; i += 1) succStart[i + 1] += succStart[i];
  const succ = new Int32Array(succStart[n]);
  const fill = succStart.slice(0, n);
  for (let v = 0; v < n; v += 1) for (const p of needs[v] ?? []) if (p >= 0 && p < n && p !== v) succ[fill[p]++] = v;

  const index = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const comp = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let sp = 0;
  const callV = new Int32Array(n);
  const callI = new Int32Array(n);
  let next = 0;
  let count = 0;
  for (let root = 0; root < n; root += 1) {
    if (index[root] >= 0) continue;
    let depth = 0;
    callV[0] = root;
    callI[0] = succStart[root];
    index[root] = low[root] = next++;
    stack[sp++] = root;
    onStack[root] = 1;
    while (depth >= 0) {
      const v = callV[depth];
      if (callI[depth] < succStart[v + 1]) {
        const w = succ[callI[depth]++];
        if (index[w] < 0) {
          index[w] = low[w] = next++;
          stack[sp++] = w;
          onStack[w] = 1;
          depth += 1;
          callV[depth] = w;
          callI[depth] = succStart[w];
        } else if (onStack[w] === 1 && index[w] < low[v]) low[v] = index[w];
        continue;
      }
      if (low[v] === index[v]) {
        let w: number;
        do { w = stack[--sp]; onStack[w] = 0; comp[w] = count; } while (w !== v);
        count += 1;
      }
      depth -= 1;
      if (depth >= 0) { const u = callV[depth]; if (low[v] < low[u]) low[u] = low[v]; }
    }
  }
  return { comp, count };
}

/**
 * DER GRAPH EINES KRAJOBRAZ — einmal je Baza und Widok: Komponenten, ihre Reihenfolge, die Bits der lernbaren und je
 * Komponente die Vereinigung aller Bits davor. Hängt nicht vom Stand ab.
 */
export function buildGraph(input: Pick<LsInput, 'needs' | 'learnable'> & { readonly ids: readonly string[] }, edgeFilter?: (from: number, to: number) => boolean): LsGraph {
  const n = input.ids.length;
  const needs = edgeFilter === undefined ? input.needs : input.needs.map((list, v) => list.filter((p) => edgeFilter(p, v)));
  const { comp, count } = components(n, needs);
  const members: number[][] = Array.from({ length: count }, () => []);
  for (let v = 0; v < n; v += 1) members[comp[v]].push(v);
  const learnable = new Uint8Array(n);
  for (let v = 0; v < n; v += 1) learnable[v] = input.learnable[v] === true ? 1 : 0;
  const parentSets: Set<number>[] = Array.from({ length: count }, () => new Set());
  for (let v = 0; v < n; v += 1) {
    const c = comp[v];
    for (const p of needs[v] ?? []) {
      if (p < 0 || p >= n) continue;
      const pc = comp[p];
      if (pc !== c) parentSets[c].add(pc);
    }
  }
  const parents = parentSets.map((s) => [...s].sort((a, b) => a - b));
  const children: number[][] = Array.from({ length: count }, () => []);
  for (let c = 0; c < count; c += 1) for (const p of parents[c]) children[p].push(c);
  /* Kahn: die Voraussetzungen zuerst; bei Gleichstand die kleinste Kennung des ersten Mitglieds (stabil). */
  const indeg = new Int32Array(count);
  for (let c = 0; c < count; c += 1) indeg[c] = parents[c].length;
  const first = (c: number) => members[c][0] ?? 0;
  const ready: number[] = [];
  for (let c = 0; c < count; c += 1) if (indeg[c] === 0) ready.push(c);
  ready.sort((a, b) => first(a) - first(b));
  const order = new Int32Array(count);
  let at = 0;
  let head = 0;
  while (head < ready.length) {
    const c = ready[head++];
    order[at++] = c;
    for (const k of children[c]) { indeg[k] -= 1; if (indeg[k] === 0) ready.push(k); }
  }
  const rank = new Int32Array(count);
  for (let i = 0; i < count; i += 1) rank[order[i]] = i;
  const bit = new Int32Array(count).fill(-1);
  let bits = 0;
  for (let i = 0; i < count; i += 1) {
    const c = order[i];
    if (members[c].some((v) => learnable[v] === 1)) bit[c] = bits++;
  }
  const words = Math.max(1, Math.ceil(bits / 32));
  let closure: Uint32Array | null = null;
  if (count * words <= MAX_WORDS) {
    closure = new Uint32Array(count * words);
    for (let i = 0; i < count; i += 1) {
      const c = order[i];
      const base = c * words;
      for (const p of parents[c]) {
        const pb = p * words;
        for (let w = 0; w < words; w += 1) closure[base + w] |= closure[pb + w];
        const b = bit[p];
        if (b >= 0) closure[base + (b >>> 5)] |= 1 << (b & 31);
      }
    }
  }
  const cycles = members.filter((m) => m.length > 1);
  return { n, comp, order, rank, members, parents, children, bit, words, closure, cycles, learnable };
}

/* -- Höhen ------------------------------------------------------------------------------------------------------- */

export interface LsHeights {
  /** Je Knoten die Höhe (NaN: ohne Karten — kein Feld). */
  readonly height: Float64Array;
  /**
   * Je Knoten: wie viele Schritte fehlen (0 im Tal und auf dem Ring) — 2026-11-04: die LÄNGSTE Kette noch nicht
   * gelernter Voraussetzungen davor (jeder Schritt gleich hoch).
   */
  readonly missing: Int32Array;
  /** 2026-11-04 — je Knoten: wie viele verschiedene, noch nicht gelernte Einträge davor liegen (alles, was zu lernen ist). */
  readonly topics: Int32Array;
  readonly band: readonly (LsBand | null)[];
  /** Je Knoten: ein Ring-Eintrag, dessen Kette davor beantwortete, schwache Karten hat. */
  readonly locked: Uint8Array;
  /** Je Komponente: nicht gelernt (Bit in der Maske). */
  readonly open: Uint8Array;
}

/** Ein Eintrag ohne Bitmengen zählen (sehr grosse Graphen): die Komponenten davor, einmal je Komponente. */
function missingBySearch(g: LsGraph, c: number, open: Uint8Array): number {
  const seen = new Set<number>([c]);
  const stack = [...g.parents[c]];
  let count = 0;
  while (stack.length > 0) {
    const p = stack.pop()!;
    if (seen.has(p)) continue;
    seen.add(p);
    if (g.bit[p] >= 0 && open[p] === 1) count += 1;
    for (const q of g.parents[p]) if (!seen.has(q)) stack.push(q);
  }
  return count;
}

/** DIE HÖHEN EINES STANDES — die Bitmengen bleiben; neu ist nur die Maske dessen, was fehlt. */
export function heightsOf(g: LsGraph, state: LsState): LsHeights {
  const n = g.n;
  const count = g.members.length;
  const k = (v: number): number => { const x = Number(state.knowness[v]); return Number.isFinite(x) ? x : 0; };
  const open = new Uint8Array(count);
  const mask = new Uint32Array(g.words);
  for (let c = 0; c < count; c += 1) {
    if (g.bit[c] < 0) continue;
    if (g.members[c].some((v) => g.learnable[v] === 1 && !isLearned(k(v)))) {
      open[c] = 1;
      mask[g.bit[c] >>> 5] |= 1 << (g.bit[c] & 31);
    }
  }
  /* Schwache Karten davor (für die Sperre): ODER über die Vorgänger, in topologischer Reihenfolge. */
  const weakComp = new Uint8Array(count);
  for (let v = 0; v < n; v += 1) if (state.weak[v] === true || state.weak[v] === 1) weakComp[g.comp[v]] = 1;
  const weakBefore = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    const c = g.order[i];
    for (const p of g.parents[c]) if (weakComp[p] === 1 || weakBefore[p] === 1) { weakBefore[c] = 1; break; }
  }
  const missingComp = new Int32Array(count);
  for (let c = 0; c < count; c += 1) {
    if (g.closure === null) { missingComp[c] = missingBySearch(g, c, open); continue; }
    let sum = 0;
    const base = c * g.words;
    for (let w = 0; w < g.words; w += 1) { const x = g.closure[base + w] & mask[w]; if (x !== 0) sum += pop32(x); }
    missingComp[c] = sum;
  }
  /* 2026-11-04 — die längste Kette noch offener Komponenten davor (in topologischer Reihenfolge; ohne Karten durchsichtig). */
  const chainComp = new Int32Array(count);
  for (let i = 0; i < count; i += 1) {
    const c = g.order[i];
    let d = 0;
    for (const p of g.parents[c]) d = Math.max(d, chainComp[p] + (open[p] === 1 ? 1 : 0));
    chainComp[c] = d;
  }
  const height = new Float64Array(n);
  const missing = new Int32Array(n);
  const topics = new Int32Array(n);
  const band: (LsBand | null)[] = new Array(n).fill(null);
  const locked = new Uint8Array(n);
  for (let v = 0; v < n; v += 1) {
    if (g.learnable[v] !== 1) { height[v] = Number.NaN; continue; }
    const kv = k(v);
    if (isLearned(kv)) {
      height[v] = valleyHeight(kv);
      band[v] = kv >= LS_KNOWN ? 'known' : 'due';
      continue;
    }
    const c = g.comp[v];
    const m = missingComp[c] === 0 ? 0 : Math.max(1, chainComp[c]);
    topics[v] = missingComp[c];
    missing[v] = m;
    height[v] = m;
    band[v] = m === 0 ? 'ring' : 'mountain';
    if (m === 0) {
      const own = g.members[c].length > 1 && g.members[c].some((u) => u !== v && (state.weak[u] === true || state.weak[u] === 1));
      if (weakBefore[c] === 1 || own) locked[v] = 1;
    }
  }
  return { height, missing, topics, band, locked, open };
}

/* -- Wege --------------------------------------------------------------------------------------------------------- */

/** Alles davor (roh, mit Kreisen; nie in einer Schleife) — ohne den Knoten selbst. */
export function chainOf(needs: readonly (readonly number[])[], v: number): number[] {
  const seen = new Set<number>([v]);
  const out: number[] = [];
  const stack = [...(needs[v] ?? [])];
  while (stack.length > 0) {
    const p = stack.pop()!;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    for (const q of needs[p] ?? []) if (!seen.has(q)) stack.push(q);
  }
  return out;
}

export interface LsRoute {
  /** Die Schritte in gültiger Reihenfolge, die Grundlagen zuerst — je Schritt (eine Komponente) ihre Einträge. */
  readonly steps: readonly (readonly number[])[];
  /** Was davon jetzt auf dem Ring liegt (der nächste Schritt). */
  readonly next: readonly number[];
  /** Das Ziel selbst ist noch nicht gelernt (es kommt nach den Schritten). */
  readonly goalOpen: boolean;
}

/** DER WEG ZU EINEM ZIEL: die nicht gelernten, lernbaren Einträge davor, Komponente für Komponente in topologischer Reihenfolge. */
export function routeOf(g: LsGraph, h: LsHeights, needs: readonly (readonly number[])[], labels: readonly string[], goal: number): LsRoute {
  const own = g.comp[goal];
  const byComp = new Map<number, number[]>();
  for (const v of chainOf(needs, goal)) {
    if (g.learnable[v] !== 1 || h.band[v] === 'known' || h.band[v] === 'due') continue;
    const c = g.comp[v];
    if (c === own) continue;
    const list = byComp.get(c);
    if (list === undefined) byComp.set(c, [v]); else list.push(v);
  }
  const steps = [...byComp.entries()].sort((a, b) => g.rank[a[0]] - g.rank[b[0]])
    .map(([, list]) => list.sort((a, b) => (labels[a] ?? '').localeCompare(labels[b] ?? '', 'pl', { numeric: true }) || a - b));
  const next = steps.flat().filter((v) => h.band[v] === 'ring');
  const goalOpen = g.learnable[goal] === 1 && (h.band[goal] === 'ring' || h.band[goal] === 'mountain');
  return { steps, next, goalOpen };
}



/* -- Richtung ---------------------------------------------------------------------------------------------------- */

/** Eine Reihenfolge der Geschwister, in der Werte mit viel Gemeinsamem Nachbarn sind (zweiseitig gierig; Gleichstand: Reihenfolge des Autors). */
export function seriate(items: readonly number[], affinity: (a: number, b: number) => number, rankOf: (a: number) => number): number[] {
  const left = [...items].sort((a, b) => rankOf(a) - rankOf(b) || a - b);
  if (left.length <= 2) return left;
  let total = 0;
  for (let i = 0; i < left.length; i += 1) for (let j = i + 1; j < left.length; j += 1) total += affinity(left[i], left[j]);
  if (total <= 0) return left;
  const chain = [left.shift()!];
  while (left.length > 0) {
    let best = -1;
    let bestScore = -1;
    let front = false;
    for (let i = 0; i < left.length; i += 1) {
      const a = affinity(left[i], chain[0]);
      const b = affinity(left[i], chain[chain.length - 1]);
      /* Gleichstand: hinten anfügen, in der Reihenfolge des Autors. */
      if (b > bestScore || (b === bestScore && front)) { best = i; bestScore = b; front = false; }
      if (a > bestScore) { best = i; bestScore = a; front = true; }
    }
    const [x] = left.splice(best, 1);
    if (front) chain.unshift(x); else chain.push(x);
  }
  return chain;
}


/**
 * 2026-11-03 — BEREICHE OHNE GRUPPIERUNG, entlang des Baums: der Struktur nach oben (`up`), sonst der Reihenfolge des
 * Lernens. Jeder Eintrag hängt an seinem flachsten Vorgänger (der Baum der kürzesten Wege von den allgemeinsten
 * Einträgen); die Bereiche sind die Teilbäume unter ihnen. Gibt es nur einen, geht es hinab, bis sich der Baum teilt;
 * sind es weniger als drei, teilt sich der grösste, der sich teilen kann; mehr als acht: die grössten acht. Ein Bereich
 * heisst wie sein oberster Eintrag; was darüber liegt (oder in keinem Bereich), steht in der Mitte. Zu einem Bereich
 * gehört ein Eintrag über ALLE Wege nach oben: der nächste Bereich je Weg (ein Wątek zwischen zwei Etappen steht
 * zwischen ihnen). Kein sinnvoller Baum (nichts geteilt, die Bereiche deckten nicht die Hälfte): `null`.
 */
export function treeAreas(input: LsInput, g: LsGraph, shown: (v: number) => boolean): { values: LsValue[]; memberOf: number[][] } | null {
  const n = input.ids.length;
  const useUp = input.up !== undefined && input.up.some((l) => l.length > 0);
  const parentsOf = (v: number): number[] => ((useUp ? input.up![v] : input.needs[v]) ?? []).filter((p) => p >= 0 && p < n && p !== v);
  const rankOf = (v: number) => g.rank[g.comp[v]];
  const byRank = (a: number, b: number) => rankOf(a) - rankOf(b) || a - b;
  const down: number[][] = Array.from({ length: n }, () => []);
  for (let v = 0; v < n; v += 1) for (const p of parentsOf(v)) down[p].push(v);
  /* Die Tiefe: Breitensuche von den Wurzeln (was nur in Kreisen hängt, wird selbst eine). */
  const depth = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  const roots: number[] = [];
  const bfs = (starts: readonly number[]) => {
    let head = 0;
    let tail = 0;
    for (const s of starts) if (depth[s] < 0) { depth[s] = 0; queue[tail++] = s; }
    while (head < tail) { const x = queue[head++]; for (const c of down[x]) if (depth[c] < 0) { depth[c] = depth[x] + 1; queue[tail++] = c; } }
  };
  for (let v = 0; v < n; v += 1) if (parentsOf(v).length === 0) roots.push(v);
  roots.sort(byRank);
  bfs(roots);
  for (let v = 0; v < n; v += 1) if (depth[v] < 0) { roots.push(v); bfs([v]); }
  /* Der flachste Vorgänger hält den Eintrag (Gleichstand: der in der Reihenfolge des Lernens frühere). */
  const kids: number[][] = Array.from({ length: n }, () => []);
  const primary = new Int32Array(n).fill(-1);
  for (let v = 0; v < n; v += 1) {
    let best = -1;
    for (const p of parentsOf(v)) if (depth[p] >= 0 && depth[p] < depth[v] && (best < 0 || depth[p] < depth[best] || (depth[p] === depth[best] && byRank(p, best) < 0))) best = p;
    primary[v] = best;
    if (best >= 0) kids[best].push(v);
  }
  for (const list of kids) list.sort(byRank);
  const size = new Int32Array(n);
  const byDepth = Array.from({ length: n }, (_, v) => v).sort((a, b) => depth[b] - depth[a]);
  for (const v of byDepth) { if (shown(v)) size[v] += 1; if (primary[v] >= 0) size[primary[v]] += size[v]; }
  const total = size.reduce((s, x, v) => s + (primary[v] < 0 ? x : 0), 0);
  const branches = (v: number) => kids[v].filter((k) => size[k] > 0);
  let areas = roots.filter((r) => size[r] > 0);
  for (let guard = 0; guard < 256 && areas.length < 3; guard += 1) {
    let pick = -1;
    for (const a of areas) {
      const b = branches(a).length;
      if (b === 0 || (b < 2 && areas.length > 1)) continue;
      if (pick < 0 || size[a] > size[pick]) pick = a;
    }
    if (pick < 0) break;
    const at = areas.indexOf(pick);
    areas = [...areas.slice(0, at), ...branches(pick), ...areas.slice(at + 1)];
  }
  if (areas.length > 8) {
    const keep = new Set([...areas].sort((a, b) => size[b] - size[a] || byRank(a, b)).slice(0, 8));
    areas = areas.filter((a) => keep.has(a));
  }
  areas.sort(byRank);
  const covered = areas.reduce((s, a) => s + size[a], 0);
  if (areas.length < 2 || areas.every((a) => size[a] < 2) || covered * 2 < total) return null;

  /* Zugehörigkeit: je Weg nach oben der nächste Bereich (Bitmasken, ohne Rekursion; ein Kreis bricht ab). */
  const isArea = new Int32Array(n).fill(-1);
  areas.forEach((a, i) => { isArea[a] = i; });
  const mask = new Int32Array(n).fill(-1);
  const open = new Uint8Array(n);
  const resolve = (s: number): number => {
    if (mask[s] >= 0) return mask[s];
    const stack = [s];
    while (stack.length > 0) {
      const v = stack[stack.length - 1];
      if (mask[v] >= 0) { stack.pop(); continue; }
      if (isArea[v] >= 0) { mask[v] = 1 << isArea[v]; stack.pop(); continue; }
      const ps = parentsOf(v);
      if (open[v] === 0) {
        open[v] = 1;
        for (const p of ps) if (mask[p] < 0 && open[p] === 0) stack.push(p);
        continue;
      }
      let m = 0;
      for (const p of ps) if (mask[p] > 0) m |= mask[p];
      mask[v] = m;
      open[v] = 0;
      stack.pop();
    }
    return mask[s];
  };
  const memberOf: number[][] = Array.from({ length: n }, () => []);
  for (let v = 0; v < n; v += 1) {
    if (!shown(v)) continue;
    const m = resolve(v);
    for (let i = 0; i < areas.length; i += 1) if ((m & (1 << i)) !== 0) memberOf[v].push(i);
  }
  const values = areas.map((a, i) => ({ id: `~${input.ids[a]}`, label: input.labels[a] ?? input.ids[a], parent: -1, rank: i }));
  return { values, memberOf };
}


/* -- Richtung: Werte und ihre Bögen (nur aus der Struktur) -------------------------------------------------------- */

export interface LsSector {
  /** Der Wert (seine Kennung) — `~…` ein Bereich aus dem Baum, `#` der eine Bereich ohne Namen. */
  readonly value: string;
  readonly label: string;
  /** Winkel in Grad (0 links, 180 rechts). */
  readonly from: number;
  readonly to: number;
  /** Die Farbe (der oberste Wert darüber; −1: grau). */
  readonly subject: number;
  readonly count: number;
  /** Hat Werte darunter (ein Klick zoomt hinein). */
  readonly deeper: boolean;
}

/**
 * 2026-11-03 (E) — DIE RICHTUNG ALS FESTER BAUM: die Werte der Gruppierung teilen den Halbkreis GLEICH (je Ebene, in der
 * Reihenfolge des Autors — `sort` —, sonst nach Gemeinsamem); ein Wert teilt seinen Bogen gleich unter seinen Kindern.
 * Gleich, nicht nach der Zahl der Einträge: kommt ein Eintrag dazu, rückt kein Bereich. Ein Eintrag steht im Mittel der
 * Bögen seiner tiefsten Werte; ohne Wert in der Mitte beim Lernenden. Hängt nie vom Fortschritt, Budget, Fokus oder der
 * Breite ab.
 */
export interface DirTree {
  readonly values: readonly LsValue[];
  /** Je Wert sein Oberer (`root`: oben). */
  readonly parent: Int32Array;
  readonly root: number;
  /** Je Wert (und `root`) die lebenden Kinder in Reihenfolge. */
  readonly kids: readonly (readonly number[])[];
  /** Je Wert sein Bogen (Grad, NaN: ohne Einträge). */
  readonly from: Float64Array;
  readonly to: Float64Array;
  /** Je Wert: wie viele Einträge darunter. */
  readonly count: Int32Array;
  /** Die Werte, die den Halbkreis oben teilen (die Bereiche des Ganzen). */
  readonly topLevel: readonly number[];
  /** Je Knoten: seine tiefsten Werte, sein Winkel (NaN: nicht im Bild), Mitte, sein Heim-Wert, sein Bereich oben (Index in `topLevel`). */
  readonly deepest: readonly (readonly number[])[];
  readonly angle: Float64Array;
  readonly centre: Uint8Array;
  readonly home: Int32Array;
  readonly top: Int32Array;
  /** Die Farbe je Knoten und je Wert. */
  readonly subject: Int32Array;
  readonly subjectOfValue: Int32Array;
}

export function directionTree(input: LsInput, g: LsGraph): DirTree {
  const n = input.ids.length;
  const shown = (v: number) => input.inView[v] === true && input.learnable[v] === true;
  let values = input.values;
  let memberOf = input.memberOf;
  let sorted = input.sorted === true;
  if (values.length === 0) {
    const tree = treeAreas(input, g, shown);
    if (tree !== null) { values = tree.values; memberOf = tree.memberOf; sorted = true; } else {
      /* Weder Werte noch ein Baum: EIN Bereich ohne Namen. */
      values = [{ id: '#', label: '', parent: -1, rank: 0 }];
      memberOf = Array.from({ length: n }, (_, v) => (shown(v) ? [0] : []));
      sorted = true;
    }
  }
  const V = values.length;
  const ROOT = V;
  const rawParent = (x: number): number => { const p = values[x]?.parent ?? -1; return p >= 0 && p < V && p !== x ? p : ROOT; };
  const parent = new Int32Array(V + 1).fill(ROOT);
  for (let x = 0; x < V; x += 1) {
    let p = rawParent(x);
    const seen = new Set<number>([x]);
    for (let y = p, guard = 0; y !== ROOT && guard < 256; y = rawParent(y), guard += 1) { if (seen.has(y)) { p = ROOT; break; } seen.add(y); }
    parent[x] = p;
  }
  const rankOf = (x: number) => (x === ROOT ? -1 : values[x].rank);
  const allKids: number[][] = Array.from({ length: V + 1 }, () => []);
  for (let x = 0; x < V; x += 1) allKids[parent[x]].push(x);
  for (const list of allKids) list.sort((a, b) => rankOf(a) - rankOf(b) || a - b);
  const chainTo = (x: number): number[] => { const out: number[] = []; for (let y = x, guard = 0; y !== ROOT && guard < 256; y = parent[y], guard += 1) out.push(y); return out.reverse(); };
  const isAncestor = (a: number, b: number): boolean => { for (let y = parent[b], guard = 0; y !== ROOT && guard < 256; y = parent[y], guard += 1) if (y === a) return true; return false; };

  const deepest: (readonly number[])[] = new Array(n);
  const own: number[][] = Array.from({ length: V + 1 }, () => []);
  for (let v = 0; v < n; v += 1) {
    if (!shown(v)) { deepest[v] = []; continue; }
    const list = [...new Set((memberOf[v] ?? []).filter((x) => x >= 0 && x < V))];
    const deep = list.filter((x) => !list.some((y) => y !== x && isAncestor(x, y)));
    deepest[v] = deep;
    for (const x of deep) own[x].push(v);
  }
  const count = new Int32Array(V + 1);
  const walk: number[] = [];
  for (const st = [ROOT]; st.length > 0;) { const x = st.pop()!; walk.push(x); for (const k of allKids[x]) st.push(k); }
  for (let i = walk.length - 1; i >= 0; i -= 1) { const x = walk[i]; count[x] += own[x].length; if (x !== ROOT) count[parent[x]] += count[x]; }
  const live = (x: number) => count[x] > 0;

  /* Gemeinsames zweier Geschwister (nur ohne Reihenfolge des Autors): Einträge in beiden, Voraussetzungen dazwischen. */
  const under = new Map<number, Set<number>>();
  const entriesUnder = (x: number): Set<number> => {
    let set = under.get(x);
    if (set !== undefined) return set;
    set = new Set<number>();
    for (const st = [x]; st.length > 0;) { const y = st.pop()!; for (const v of own[y]) set.add(v); for (const k of allKids[y]) if (live(k)) st.push(k); }
    under.set(x, set);
    return set;
  };
  const affinityAmong = (siblings: readonly number[]): ((a: number, b: number) => number) => {
    const m = siblings.length;
    const table = new Float64Array(m * m);
    const index = new Map<number, number[]>();
    siblings.forEach((s, i) => { for (const v of entriesUnder(s)) { const l = index.get(v); if (l === undefined) index.set(v, [i]); else if (!l.includes(i)) l.push(i); } });
    for (const list of index.values()) for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) { table[list[i] * m + list[j]] += 1; table[list[j] * m + list[i]] += 1; }
    for (const [v, list] of index) {
      for (const p of input.needs[v] ?? []) {
        const other = index.get(p);
        if (other === undefined) continue;
        for (const a of list) for (const b of other) if (a !== b) { table[a * m + b] += 1; table[b * m + a] += 1; }
      }
    }
    const pos = new Map(siblings.map((s, i) => [s, i] as const));
    return (a, b) => table[(pos.get(a) ?? 0) * m + (pos.get(b) ?? 0)];
  };
  const orderOf = (items: readonly number[]): number[] => (sorted || items.length > 160 ? [...items].sort((a, b) => rankOf(a) - rankOf(b) || a - b) : seriate(items, affinityAmong(items), rankOf));
  const kids: number[][] = allKids.map((list) => orderOf(list.filter(live)));

  /* Oben: hinab, solange sich das Ganze nicht teilt (ein einziger lebender Wert ohne eigene Einträge). */
  let topNode = ROOT;
  for (let guard = 0; guard < 64; guard += 1) { const only = kids[topNode]; if (only.length !== 1 || own[topNode].length > 0 || kids[only[0]].length === 0) break; topNode = only[0]; }
  const topLevel = kids[topNode].length > 0 ? kids[topNode] : topNode === ROOT ? [] : [topNode];
  const from = new Float64Array(V + 1).fill(Number.NaN);
  const to = new Float64Array(V + 1).fill(Number.NaN);
  const lay = (list: readonly number[], a: number, b: number) => {
    const w = list.length === 0 ? 0 : (b - a) / list.length;
    list.forEach((x, i) => { from[x] = a + i * w; to[x] = a + (i + 1) * w; lay(kids[x], from[x], to[x]); });
  };
  lay(topLevel, 0, 180);
  /* Die Farbe: die Werte oben, in der Reihenfolge des Autors. */
  const subjectOfValue = new Int32Array(V + 1).fill(-1);
  for (let x = 0; x < V; x += 1) for (const y of chainTo(x)) { const i = topLevel.indexOf(y); if (i >= 0) { subjectOfValue[x] = i; break; } }
  const topOfValue = (x: number): number => { for (const y of chainTo(x)) { const i = topLevel.indexOf(y); if (i >= 0) return i; } return -1; };

  const angle = new Float64Array(n).fill(Number.NaN);
  const centre = new Uint8Array(n);
  const home = new Int32Array(n).fill(-1);
  const top = new Int32Array(n).fill(-1);
  const subject = new Int32Array(n).fill(-1);
  for (let v = 0; v < n; v += 1) {
    if (!shown(v)) continue;
    const deep = deepest[v].filter((x) => Number.isFinite(from[x]));
    if (deep.length === 0) { angle[v] = 90; centre[v] = 1; continue; }
    let sum = 0;
    for (const x of deep) sum += (from[x] + to[x]) / 2;
    angle[v] = sum / deep.length;
    let best = deep[0];
    for (const x of deep) if (Math.abs((from[x] + to[x]) / 2 - angle[v]) < Math.abs((from[best] + to[best]) / 2 - angle[v]) - 1e-9) best = x;
    home[v] = best;
    top[v] = topOfValue(best);
    subject[v] = subjectOfValue[best];
  }
  return { values, parent, root: ROOT, kids, from, to, count, topLevel, deepest, angle, centre, home, top, subject, subjectOfValue };
}

/** Ein Wert als Bereich (für Namen, Zoom und Liste). */
const sectorOf = (dir: DirTree, x: number): LsSector => ({
  value: dir.values[x].id, label: dir.values[x].label, from: dir.from[x], to: dir.to[x], subject: dir.subjectOfValue[x], count: dir.count[x], deeper: dir.kids[x].length > 0
});

/* -- Das Raster ----------------------------------------------------------------------------------------------- */

const SQ3 = Math.sqrt(3);
/** Die Mitte eines Sechsecks (flache Oberseite, Nachbarn im Abstand 1): x = √3/2·q, y = r + q/2. */
export const hexCenter = (q: number, r: number): { x: number; y: number } => ({ x: (SQ3 / 2) * q, y: r + q / 2 });
/** Das Sechseck unter einem Punkt (Würfelrundung). */
export function hexAt(x: number, y: number): { q: number; r: number } {
  const qf = x / (SQ3 / 2);
  const rf = y - qf / 2;
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return { q, r };
}
export const hexDistance = (aq: number, ar: number, bq: number, br: number): number => (Math.abs(aq - bq) + Math.abs(ar - br) + Math.abs(aq + ar - bq - br)) / 2;
/** Die sechs Nachbarn (axial). */
export const HEX_DIRS: readonly (readonly [number, number])[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
/** Wo ein Punkt liegt: Abstand zum Lernenden und Winkel (0 links, 180 rechts). */
const polar = (x: number, y: number): { rho: number; angle: number } => ({ rho: Math.hypot(x, y), angle: (Math.atan2(y, -x) * 180) / Math.PI });
/** Wie viele Grad eine Zelle im Abstand rho breit ist. */
const cellDeg = (rho: number): number => 57.29577951308232 / Math.max(1, rho);
/** 0, +1, −1, +2, −2, … */
const alternate = (i: number): number => (i === 0 ? 0 : i % 2 === 1 ? (i + 1) / 2 : -i / 2);

/** Überschneiden sich zwei konvexe Vielecke (mehr als eine Berührung)? — Trennachsen. */
export function polygonsOverlap(a: readonly (readonly [number, number])[], b: readonly (readonly [number, number])[], eps = 1e-9): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i += 1) {
      const [x1, y1] = poly[i];
      const [x2, y2] = poly[(i + 1) % poly.length];
      const nx = y2 - y1;
      const ny = x1 - x2;
      let aMin = Infinity; let aMax = -Infinity; let bMin = Infinity; let bMax = -Infinity;
      for (const [x, y] of a) { const p = x * nx + y * ny; aMin = Math.min(aMin, p); aMax = Math.max(aMax, p); }
      for (const [x, y] of b) { const p = x * nx + y * ny; bMin = Math.min(bMin, p); bMax = Math.max(bMax, p); }
      const len = Math.hypot(nx, ny) || 1;
      if (aMax <= bMin + eps * len || bMax <= aMin + eps * len) return false;
    }
  }
  return true;
}

/* -- 2026-11-03 (E): DIE FESTE KARTE ---------------------------------------------------------------------------- */

/** Eine Zelle des Landes: ein Eintrag (`node` ≥ 0) oder Boden dazwischen (−1). */
export interface LsCell {
  readonly q: number;
  readonly r: number;
  readonly x: number;
  readonly y: number;
  readonly node: number;
  /** Der Bereich oben (Index in `topLevel`), in dessen Bogen die Zelle liegt — −1: die Mitte. */
  readonly region: number;
}

export interface LsFixed {
  readonly dir: DirTree;
  /** Alle Zellen des Landes, von hinten nach vorn (zuerst gezeichnet, was weiter weg ist). */
  readonly cells: readonly LsCell[];
  /** Je Knoten seine Zelle (Index in `cells`; −1: nicht im Bild). */
  readonly cellOf: Int32Array;
  /** Je Knoten sein Oberer im Baum seines Bereichs (die tiefste direkte Voraussetzung darin; −1: eine Wurzel). */
  readonly treeParent: Int32Array;
  /** Je Knoten: wie viele lernbare Schritte die längste Kette davor hat. */
  readonly depth: Int32Array;
  /** Die Voraussetzungen zwischen Feldern (durch Einträge ohne Karten hindurch), als Paare [Eintrag, Voraussetzung]. */
  readonly links: Int32Array;
}

/** Wo die Mitte endet (Einträge ohne Wert) und wo die Bereiche beginnen. */
const HUB = 1.9;
const AREA_START = 2.5;

/**
 * DIE FESTE KARTE (E) — nur aus der Struktur, nie aus dem Fortschritt, dem Budget, dem Fokus oder der Breite:
 * <code>
 *   Bogen     der Bereich (sein Wert), gleich breit, in der Reihenfolge des Autors
 *   Abstand   die Tiefe in der Kette „wymaga" (lernbare Schritte davor) als Stufe im Bereich: seine allgemeinsten
 *             Einträge beim Lernenden, Stufe für Stufe nach aussen (je Stufe ein Band mit einem Viertel Reserve)
 *   Winkel    die Wurzel eines Bereichs in seiner Mitte, ein Eintrag bei seiner Voraussetzung (Geschwister abwechselnd
 *             links und rechts, in der Reihenfolge ihres Entstehens) — ein Weg „wymaga" läuft nach aussen
 *   Zelle     im Band die freie Zelle, die dieser Richtung am nächsten liegt, vergeben in der Reihenfolge des Entstehens
 *             (die Kennungen) — ein neuer Eintrag nimmt eine freie Zelle seines Bandes und schiebt keinen anderen
 *   Land      die Zellen dazwischen sind Boden: ein zusammenhängendes Raster bis zum Rand jedes Bereichs
 * </code>
 * Deterministisch: dieselben Daten geben dieselbe Karte.
 */
export function fixedLayout(input: LsInput, g: LsGraph, dir: DirTree = directionTree(input, g)): LsFixed {
  const n = input.ids.length;
  const shown = (v: number) => input.inView[v] === true && input.learnable[v] === true && Number.isFinite(dir.angle[v]);
  const idOf = (v: number) => input.ids[v] ?? '';
  const byId = (a: number, b: number) => (idOf(a) < idOf(b) ? -1 : idOf(a) > idOf(b) ? 1 : a - b);

  /* Die Tiefe: lernbare Schritte der längsten Kette davor (Einträge ohne Karten durchsichtig; ein Kreis ein Schritt). */
  const count = g.members.length;
  const level = new Int32Array(count);
  for (let i = 0; i < count; i += 1) {
    const c = g.order[i];
    let m = 0;
    for (const p of g.parents[c]) m = Math.max(m, level[p] + (g.bit[p] >= 0 ? 1 : 0));
    level[c] = m;
  }
  const depth = new Int32Array(n);
  for (let v = 0; v < n; v += 1) depth[v] = level[g.comp[v]];

  /* Die Voraussetzungen unter den Feldern — durch Einträge ohne Feld hindurch. */
  const effective: number[][] = Array.from({ length: n }, () => []);
  const links: number[] = [];
  for (let v = 0; v < n; v += 1) {
    if (!shown(v)) continue;
    const seen = new Set<number>([v]);
    const stack = [...(input.needs[v] ?? [])];
    while (stack.length > 0) {
      const p = stack.pop()!;
      if (p < 0 || p >= n || seen.has(p)) continue;
      seen.add(p);
      if (shown(p)) { effective[v].push(p); links.push(v, p); continue; }
      for (const q of input.needs[p] ?? []) if (!seen.has(q)) stack.push(q);
    }
  }
  /* Der Baum je Bereich: die tiefste Voraussetzung im selben Bereich ist der Obere (Gleichstand: die ältere Kennung). */
  const treeParent = new Int32Array(n).fill(-1);
  for (let v = 0; v < n; v += 1) {
    if (!shown(v) || dir.centre[v] === 1) continue;
    let best = -1;
    for (const p of effective[v]) {
      if (dir.top[p] !== dir.top[v] || dir.centre[p] === 1 || p === v) continue;
      if (best < 0 || depth[p] > depth[best] || (depth[p] === depth[best] && byId(p, best) < 0)) best = p;
    }
    /* Nie ein Kreis im Baum: der Obere liegt tiefer — oder gleich tief (ein Kreis) und älter. */
    if (best >= 0 && (depth[best] < depth[v] || byId(best, v) < 0)) treeParent[v] = best;
  }

  /*
    -- Wohin: je Bereich Bänder nach der Tiefe (fest), darin die nächste freie Zelle ------------------------------
    Die Zellen eines Bereichs (in seinem Bogen, nach dem Abstand zum Lernenden geordnet) werden in Bänder geteilt: das
    erste für seine allgemeinsten Einträge, dann Stufe für Stufe nach aussen — je Band so viele Zellen, wie es Einträge
    hat, und ein Viertel mehr (Platz für Neues). Im Band nimmt jeder Eintrag, in der Reihenfolge des Entstehens, die
    freie Zelle, die seiner gewünschten Richtung am nächsten liegt: der Richtung seiner Voraussetzung (Geschwister
    abwechselnd links und rechts) — so läuft ein Weg „wymaga" nach aussen. Ein neuer Eintrag nimmt eine freie Zelle
    seines Bandes; nur wenn ein Band überläuft, rückt, was weiter aussen liegt.
  */
  const inFront = (y: number) => y >= 0.45;
  const regionOfAngle = (angle: number): number => {
    for (let i = 0; i < dir.topLevel.length; i += 1) {
      const x = dir.topLevel[i];
      if (angle >= dir.from[x] - 1e-9 && angle < dir.to[x] - 1e-9) return i;
    }
    return dir.topLevel.length > 0 && angle >= 180 - 1e-6 ? dir.topLevel.length - 1 : -1;
  };
  const regionOf = (v: number): number => (dir.centre[v] === 1 ? -1 : dir.top[v]);
  /* Die Grösse eines Bandes: was darin steht, gut ein Siebtel mehr — auf einer groben Leiter, damit ein neuer Eintrag die Grenze selten verschiebt. */
  const bucket = (c: number): number => { const want = Math.ceil(c * 1.15) + 1; let b = 3; while (b < want) b = b < 5 ? 5 : b < 8 ? 8 : Math.ceil(b * 1.32); return b; };
  const levels = new Map<number, Map<number, number[]>>();
  for (let v = 0; v < n; v += 1) {
    if (!shown(v)) continue;
    const region = regionOf(v);
    let byDepth = levels.get(region);
    if (byDepth === undefined) { byDepth = new Map(); levels.set(region, byDepth); }
    const list = byDepth.get(depth[v]) ?? [];
    list.push(v);
    byDepth.set(depth[v], list);
  }
  const needed = new Map<number, number>();
  for (const [region, byDepth] of levels) needed.set(region, [...byDepth.values()].reduce((s, l) => s + bucket(l.length), 0));
  type Spot = { readonly q: number; readonly r: number; readonly x: number; readonly y: number; readonly rho: number; readonly angle: number };
  const spotOrder = (a: Spot, b: Spot) => a.rho - b.rho || a.angle - b.angle || a.q - b.q || a.r - b.r;
  let regionCells = new Map<number, Spot[]>();
  for (let R = 8; ; R += 6) {
    regionCells = new Map();
    /* Alle Zellen bis zum Abstand R — auch die mit |q| > R (bis R/(√3/2)): sonst wäre die Liste bei grösserem R vorn eine andere. */
    const Q = Math.ceil(R / (SQ3 / 2)) + 1;
    for (let q = -Q; q <= Q; q += 1) {
      for (let r = -2 * Q; r <= 2 * Q; r += 1) {
        if (q === 0 && r === 0) continue;
        const c = hexCenter(q, r);
        if (!inFront(c.y)) continue;
        const { rho, angle } = polar(c.x, c.y);
        if (rho > R) continue;
        const region = rho < HUB ? -1 : regionOfAngle(angle);
        const list = regionCells.get(region) ?? [];
        list.push({ q, r, x: c.x, y: c.y, rho, angle });
        regionCells.set(region, list);
      }
    }
    const enough = [...needed].every(([region, k]) => region === -1 || (regionCells.get(region)?.length ?? 0) >= k);
    if (enough || R > 400) break;
  }
  for (const list of regionCells.values()) list.sort(spotOrder);
  /* Die Mitte (ohne Wert): die Zellen um den Lernenden; reichen sie nicht, die nächsten um 90° (vor den Bereichen). */
  const hubNeed = needed.get(-1) ?? 0;
  const hubCells = [...(regionCells.get(-1) ?? [])];
  if (hubCells.length < hubNeed) {
    const extra = [...regionCells.entries()].filter(([region]) => region >= 0).flatMap(([, list]) => list)
      .sort((a, b) => a.rho + Math.abs(a.angle - 90) / 40 - (b.rho + Math.abs(b.angle - 90) / 40) || spotOrder(a, b))
      .slice(0, hubNeed - hubCells.length);
    const gone = new Set(extra.map((s) => `${s.q},${s.r}`));
    for (const [region, list] of regionCells) if (region >= 0) regionCells.set(region, list.filter((s) => !gone.has(`${s.q},${s.r}`)));
    hubCells.push(...extra);
    hubCells.sort(spotOrder);
  }
  regionCells.set(-1, hubCells);

  const cellQ = new Int32Array(n);
  const cellR = new Int32Array(n);
  const placed = new Uint8Array(n);
  const spotOf = new Map<number, Spot>();
  const children: number[][] = Array.from({ length: n }, () => []);
  for (let v = 0; v < n; v += 1) if (shown(v) && treeParent[v] >= 0) children[treeParent[v]].push(v);
  for (const list of children) list.sort(byId);
  const used = new Map<number, number>();
  const regionSpan = (region: number): [number, number] => {
    if (region < 0) return [30, 150];
    const x = dir.topLevel[region];
    return [dir.from[x], dir.to[x]];
  };
  for (const region of [...levels.keys()].sort((a, b) => a - b)) {
    const list = regionCells.get(region) ?? [];
    const free = new Set<number>(list.map((_, i) => i));
    const byDepth = levels.get(region)!;
    let at = 0;
    const span = regionSpan(region);
    for (const d of [...byDepth.keys()].sort((a, b) => a - b)) {
      const nodes = [...byDepth.get(d)!].sort(byId);
      const band = Array.from({ length: Math.min(bucket(nodes.length), Math.max(0, list.length - at)) }, (_, i) => at + i);
      at += band.length;
      const bandRho = band.length === 0 ? AREA_START : list[band[0]].rho;
      const meanRho = band.length === 0 ? AREA_START : band.reduce((s, i) => s + list[i].rho, 0) / band.length;
      const roots = nodes.filter((v) => treeParent[v] < 0 || !placed[treeParent[v]]);
      for (const v of nodes) {
        /* Die gewünschte Richtung: die der Voraussetzung (Geschwister abwechselnd daneben) — eine Wurzel die Mitte des Bogens. */
        const p = treeParent[v];
        let want: number;
        if (dir.deepest[v].length > 1) {
          /* In zwei Bereichen: zum anderen hin (das Mittel ihrer Bögen — im eigenen Bogen gehalten: an seinem Rand). */
          want = dir.angle[v];
        } else if (p >= 0 && placed[p] === 1) {
          const k = children[p].indexOf(v);
          want = spotOf.get(p)!.angle + alternate(Math.max(0, k)) * cellDeg(meanRho);
        } else {
          const k = roots.indexOf(v);
          want = (span[0] + span[1]) / 2 + alternate(Math.max(0, k)) * cellDeg(meanRho);
        }
        const slack = 0.5 * cellDeg(meanRho);
        want = Math.max(span[0] + slack, Math.min(span[1] - slack, want));
        /* Im Band die nächste freie Zelle; ist es voll (es hat ein Viertel Reserve), die nächste dahinter. */
        const pick = (candidates: readonly number[]): number => {
          let best = -1;
          let cost = Infinity;
          for (const i of candidates) {
            if (!free.has(i)) continue;
            const s = list[i];
            const c = Math.abs(s.angle - want) / cellDeg(s.rho) + 0.35 * (s.rho - bandRho);
            if (c < cost - 1e-9) { cost = c; best = i; }
          }
          return best;
        };
        let got = pick(band);
        if (got < 0) got = pick(Array.from({ length: Math.max(0, list.length - at) }, (_, i) => at + i));
        if (got < 0) continue;
        free.delete(got);
        const s = list[got];
        spotOf.set(v, s);
        cellQ[v] = s.q;
        cellR[v] = s.r;
        placed[v] = 1;
      }
    }
    used.set(region, at);
  }

  /* Das Land: die Zellen der Bänder jedes Bereichs (auch die freien) und ein Saum; die Mitte; leere Bereiche bis kurz vor den Lernenden. */
  const nodeAt = new Map<string, number>();
  for (let v = 0; v < n; v += 1) if (placed[v] === 1) nodeAt.set(`${cellQ[v]},${cellR[v]}`, v);
  const cells: LsCell[] = [];
  for (const [region, list] of regionCells) {
    const end = used.get(region) ?? 0;
    const reach = region < 0 ? HUB + 0.2 : end === 0 ? AREA_START + 1.2 : list[Math.min(list.length, end) - 1].rho + 0.6;
    for (const s of list) {
      if (s.rho > reach) continue;
      cells.push({ q: s.q, r: s.r, x: s.x, y: s.y, node: nodeAt.get(`${s.q},${s.r}`) ?? -1, region });
    }
  }
  cells.sort((a, b) => b.y - a.y || a.x - b.x);
  const cellOf = new Int32Array(n).fill(-1);
  cells.forEach((c, i) => { if (c.node >= 0) cellOf[c.node] = i; });
  return { dir, cells, cellOf, treeParent, depth, links: Int32Array.from(links) };
}

/* -- Die Felder eines Standes -------------------------------------------------------------------------------- */

export interface LsField {
  /** Ein Eintrag: seine Kennung; ein Feld „+N": `grp:<wert>:<band>` (der Rest eines Bereichs in einem Band; `all`: der ganze Rest, `~mitte`: ohne Wert). */
  readonly key: string;
  readonly kind: 'entry' | 'area';
  readonly id?: string;
  /** Wohin ein Klick zoomt: der Wert seines Bereichs (leer: die Mitte). */
  readonly value?: string;
  readonly label: string;
  readonly count: number;
  readonly height: number;
  readonly missing: number;
  /** 2026-11-04 — ein Eintrag: wie viele verschiedene Themen davor noch zu lernen sind (die Schritte zählt `missing`). */
  readonly topics?: number;
  readonly band: LsBand;
  readonly locked: boolean;
  readonly subject: number;
  /** Der Bereich oben (Index in `areas`), −1 in der Mitte. */
  readonly area: number;
  /** Die Zelle, auf der Zeichen und Name stehen (axial) und ihr Platz. */
  readonly q: number;
  readonly r: number;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  /** Der gerundete Abstand zum Lernenden. */
  readonly row: number;
  readonly lift: number;
  readonly route: number;
  readonly next: boolean;
  readonly goal: boolean;
  readonly due: number;
  readonly ring: number;
  readonly known: number;
  readonly mountain: number;
  readonly edge: boolean;
  readonly mark?: string;
  /** Eine Gruppe: ihre Einträge. */
  readonly ids?: readonly string[];
  /** Die Zellen des Feldes (Indizes in `land`) — eine Gruppe nimmt die Zellen ihrer Einträge ein. */
  readonly cells: readonly number[];
  /** 2026-11-03 (C) — wie viele Karten sitzen, von wie vielen (Einheiten: ein Feld mit vielen Karten). */
  readonly progress?: { readonly known: number; readonly total: number };
  /** 2026-11-03 (D) — was das Lernen dieses Eintrags frei macht (Kennungen). */
  readonly unlocks?: readonly string[];
}

/** Eine Zelle des Landes in einem Stand: wie hoch, welches Band, zu welchem Feld, im Fokus oder nur Umgebung. */
export interface LsLand {
  readonly q: number;
  readonly r: number;
  readonly x: number;
  readonly y: number;
  readonly lift: number;
  /** Das Band des Eintrags (null: Boden). */
  readonly band: LsBand | null;
  /** 2026-11-03 — wie der Boden aussieht: das Band der meisten Nachbarn (das Tal breitet sich aus, Berge laufen aus); bei einem Eintrag sein Band. */
  readonly tone: LsBand | null;
  /** Wie hoch in Schritten (Berg: wie viele fehlen) — für die Schattierung. */
  readonly steps: number;
  readonly node: number;
  readonly field: string | null;
  readonly region: number;
  readonly subject: number;
  readonly inScope: boolean;
  readonly due: boolean;
  /** 2026-11-03 — die Zelle eines Knotens (verschachtelter Krajobraz) und wie viel seines Teilbaums sitzt (gewusste / alle Karten). */
  readonly group?: boolean;
  readonly share?: number;
}

export interface LsLayout {
  readonly fields: readonly LsField[];
  readonly land: readonly LsLand[];
  /** Die Bereiche, die das Bild jetzt teilt (oben die des Ganzen; im Zoom die darunter) — für Namen und Liste. */
  readonly sectors: readonly LsSector[];
  /** Die Bereiche des Ganzen (immer dieselben) — für die Farbe und den Rand im Zoom. */
  readonly areas: readonly LsSector[];
  readonly path: readonly { readonly value: string; readonly label: string }[];
  /** Im Zoom: die anderen Bereiche — am Rand in ihrer Richtung. */
  readonly outside: readonly { readonly value: string; readonly label: string; readonly angle: number; readonly subject: number }[];
  /** Was die Kamera zeigt (Bodeneinheiten) — im Ganzen das ganze Land, im Zoom der Fokus. */
  readonly camera: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number };
  readonly goal: { readonly id: string; readonly steps: number; readonly next: readonly string[]; readonly route: readonly string[]; readonly open: boolean } | null;
  readonly counts: Readonly<Record<LsBand, number>>;
  readonly total: number;
  readonly me: { readonly lift: number };
  readonly notes: readonly string[];
  readonly heights: Float64Array;
  readonly bands: Uint8Array;
  readonly locked: Uint8Array;
  /** Die Voraussetzungen zwischen Einträgen (Paare: Eintrag, Voraussetzung — Indizes wie `LsInput.ids`) — für die Wege. */
  readonly links: Int32Array;
  /** Je Knoten seine Zelle in `land` (−1: keine). */
  readonly cellOf: Int32Array;
}

export const BAND_CODE: readonly (LsBand | null)[] = [null, 'known', 'due', 'ring', 'mountain'];

/** Die Anteile der Bänder (0–1), zusammen höchstens 1. */
export function bandShares(raw?: Partial<LsBands>): LsBands {
  const pick = (x: unknown, fallback: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : fallback);
  const s = { ring: pick(raw?.ring, LS_BANDS.ring), due: pick(raw?.due, LS_BANDS.due), known: pick(raw?.known, LS_BANDS.known) };
  const sum = s.ring + s.due + s.known;
  return sum <= 1 ? s : { ring: s.ring / sum, due: s.due / sum, known: s.known / sum };
}

/** Wie hoch eine Zelle gezeichnet wird (Kacheln): das Tal versenkt und flach, der Ring eben, ein Berg nach seinen Schritten. */
export function liftOf(band: LsBand | null, missing: number): number {
  /*
    2026-11-04 — DIE HÖHE IN GLEICHEN SCHRITTEN, ohne Deckel: im Tal 0, was jetzt lernbar ist, einen Schritt darüber, ein
    Feld n Schritte weiter n Schritte über dem Lernbaren. Damit es ins Bild passt, wird die Schrittweite verkleinert,
    nie die Berge gestaucht (`LandscapeView`: geometryOf).
  */
  if (band === 'known' || band === 'due') return 0;
  if (band === 'ring') return 1;
  if (band === 'mountain') return 1 + Math.max(1, missing);
  return 0;
}

/** Die drei Nachbarn dahinter (axial) und wie viel höher eine Fläche davor sein darf, ohne mehr als ein Drittel dahinter zu decken. */
const BACK: readonly (readonly [number, number, number])[] = [[0, 1, 0.45], [1, 0, 0.9], [-1, 1, 0.9]];

/**
 * DIE GESTALT EINES STANDES (E): die Karte bleibt (`LsFixed`); hier entsteht nur, was sich mit dem Wissen ändert —
 * die Höhen jeder Zelle und welche Einträge einzeln stehen (B.1: je Bereich und Band die Besten, der Rest ein Feld „+N"
 * auf den Zellen seiner Einträge). Der Zoom ist eine Kamera auf dieselbe Karte.
 */
export function layoutOf(input: LsInput, g: LsGraph, h: LsHeights, options: LsOptions = {}, fixedIn?: LsFixed, state?: LsState): LsLayout {
  const fixed = fixedIn ?? fixedLayout(input, g);
  const dir = fixed.dir;
  /* 2026-11-03 — das Budget fasst nichts mehr zusammen (die Ansicht gibt „alles einzeln"); was zusammengehört, sagen Knoten (`landscapeNest.ts`). */
  const budget = Math.max(6, Math.min(1_000_000, Math.round(options.budget ?? LS_BUDGET)));
  const n = input.ids.length;
  const label = (v: number) => input.labels[v] ?? input.ids[v] ?? '';
  const notes: string[] = [];
  /* 2026-11-05 — im Worker ohne Wörterbücher: dort stehen die Schlüssel (`landscapeClient.ts` übersetzt sie). */
  if (input.needs.every((l) => l.length === 0)) notes.push(t('cogitaLearnLogic.landscape.noOrder'));
  if (g.cycles.length > 0) notes.push(t('cogitaLearnLogic.landscape.cycles', { n: g.cycles.length }));
  const shown = (v: number) => fixed.cellOf[v] >= 0 && h.band[v] !== null;

  /* -- Der Fokus: Werte (Bereiche) — nur die Kamera und was einzeln steht; die Karte bleibt ---------------------- */
  const valueAt = new Map(dir.values.map((x, i) => [x.id, i] as const));
  const isUnder = (x: number, f: number): boolean => { for (let y = x, guard = 0; y !== dir.root && guard < 256; y = dir.parent[y], guard += 1) if (y === f) return true; return false; };
  const chainTo = (x: number): number[] => { const out: number[] = []; for (let y = x, guard = 0; y !== dir.root && guard < 256; y = dir.parent[y], guard += 1) out.push(y); return out.reverse(); };
  const indexOf = new Map(input.ids.map((id, i) => [id, i] as const));
  let focus = (options.focus ?? []).map((id) => valueAt.get(id)).filter((x): x is number => x !== undefined && Number.isFinite(dir.from[x]));
  /* Ein Fokus mit nur einem Bereich darunter (und ohne eigene Einträge) steigt hinab. */
  for (let guard = 0; guard < 64 && focus.length === 1; guard += 1) {
    const only = dir.kids[focus[0]];
    if (only.length !== 1 || dir.kids[only[0]].length === 0) break;
    focus = [only[0]];
  }
  const inScope = new Uint8Array(n);
  for (let v = 0; v < n; v += 1) {
    if (!shown(v)) continue;
    inScope[v] = focus.length === 0 || dir.deepest[v].some((x) => focus.some((f) => x === f || isUnder(x, f))) ? 1 : 0;
  }
  const areas = dir.topLevel.map((x) => sectorOf(dir, x));
  const sectors = focus.length === 0 ? areas : focus.flatMap((f) => (dir.kids[f].length > 0 ? dir.kids[f] : [f]).map((x) => sectorOf(dir, x)));
  const path = focus.length === 1 ? chainTo(focus[0]).map((y) => ({ value: dir.values[y].id, label: dir.values[y].label })) : focus.map((x) => ({ value: dir.values[x].id, label: dir.values[x].label }));
  const focusTop = new Set<number>();
  for (let v = 0; v < n; v += 1) if (inScope[v] === 1 && dir.top[v] >= 0) focusTop.add(dir.top[v]);
  const outside = focus.length === 0 ? [] : areas
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => !focusTop.has(i))
    .map(({ s }) => ({ value: s.value, label: s.label, angle: (s.from + s.to) / 2, subject: s.subject }));

  /* -- Das Ziel und sein Weg ------------------------------------------------------------------------------------ */
  const goalIndex = options.goal === undefined || options.goal === null ? undefined : indexOf.get(options.goal);
  let goal: LsLayout['goal'] = null;
  const onRoute = new Uint8Array(n);
  const nextStep = new Uint8Array(n);
  if (goalIndex !== undefined) {
    const route = routeOf(g, h, input.needs, input.labels, goalIndex);
    for (const step of route.steps) for (const v of step) onRoute[v] = 1;
    for (const v of route.next) nextStep[v] = 1;
    if (route.next.length === 0 && route.goalOpen && h.band[goalIndex] === 'ring') nextStep[goalIndex] = 1;
    goal = { id: input.ids[goalIndex], steps: route.steps.length, next: route.next.map((v) => input.ids[v]).concat(route.next.length === 0 && route.goalOpen && h.band[goalIndex] === 'ring' ? [input.ids[goalIndex]] : []), route: route.steps.flat().map((v) => input.ids[v]), open: route.goalOpen };
  }

  /* -- Zählen ---------------------------------------------------------------------------------------------------- */
  const counts: Record<LsBand, number> = { known: 0, due: 0, ring: 0, mountain: 0 };
  const scope: number[] = [];
  for (let v = 0; v < n; v += 1) if (inScope[v] === 1) { scope.push(v); counts[h.band[v]!] += 1; }

  /* Was das Lernen eines Eintrags frei macht: die direkt Folgenden, denen danach nichts mehr fehlt. */
  const dependents: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < fixed.links.length; i += 2) dependents[fixed.links[i + 1]].push(fixed.links[i]);
  const unlocksOf = (v: number): number[] => {
    if (h.band[v] !== 'ring' && h.band[v] !== 'mountain') return [];
    const out: number[] = [];
    for (const d of dependents[v]) {
      if (h.band[d] !== 'mountain') continue;
      /* Fehlt d nur, was vor v fehlt, und v selbst? (Kette mit Bitmengen, sonst geschätzt über die Zahl.) */
      if (g.closure !== null) {
        const cd = g.comp[d] * g.words;
        const cv = g.comp[v] * g.words;
        const bv = g.bit[g.comp[v]];
        let inside = true;
        for (let w = 0; w < g.words && inside; w += 1) {
          let allowed = g.closure[cv + w];
          if (bv >= 0 && (bv >>> 5) === w) allowed |= 1 << (bv & 31);
          /* Nur, was noch offen ist, zählt. */
          if ((g.closure[cd + w] & openBits(g, h, w) & ~allowed) !== 0) inside = false;
        }
        if (inside) out.push(d);
      } else if (h.missing[d] <= h.missing[v] + 1) out.push(d);
    }
    return out.sort((a, b) => (input.ids[a] < input.ids[b] ? -1 : 1));
  };

  /*
    -- Das Budget (B.1): je Bereich und Band die Besten einzeln, der Rest EIN Feld „+N" ----------------------------
    Ein Bereich ist, was das Bild jetzt teilt (im Ganzen die Bereiche oben, im Zoom die darunter). Am Anfang ist jedes
    Band jedes Bereichs ein Feld; ein Eintrag wird einzeln, indem er aus seinem Feld tritt (ein Feld mit einem Rest von
    einem wird selbst einzeln). Reihenfolge: das Ziel und sein Weg; dann je Band bis zu seinem Anteil — der Ring (zuerst,
    was am meisten frei macht, dann die Reihenfolge des Autors), was zu wiederholen ist, das Tal —, und zwar reihum: der
    Beste jedes Bereichs, dann der Zweite …; was übrig bleibt, in der Reihenfolge Ring, Wiederholung, Tal, Berge — Berge
    nur, wenn kein Ring-Eintrag mehr verborgen ist. Nähmen die Felder schon mehr als die Hälfte des Budgets, wird das Tal
    eines Bereichs ein Feld (gelernt und zu wiederholen zusammen), bei noch mehr der ganze Bereich. Ein Feld nimmt die
    Zellen seiner Einträge ein; nichts rückt.
  */
  const sectorValues = new Set<number>();
  for (const s of sectors) { const x = valueAt.get(s.value); if (x !== undefined) sectorValues.add(x); }
  const focusValues = new Set(focus);
  /* Je Eintrag sein Bereich im Bild (Wert; −1: die Mitte). */
  const groupValue = new Int32Array(n).fill(-1);
  for (const v of scope) {
    if (dir.centre[v] === 1 || dir.home[v] < 0) continue;
    let pick = -1;
    for (let y = dir.home[v], guard = 0; y >= 0 && y !== dir.root && guard < 256; y = dir.parent[y], guard += 1) {
      if (sectorValues.has(y)) { pick = y; break; }
      if (pick < 0 && focusValues.has(y)) pick = y;
    }
    groupValue[v] = pick >= 0 ? pick : dir.topLevel[dir.top[v]] ?? -1;
  }
  const bandKey = (b: LsBand, level: number): string => (level >= 2 ? b : level === 1 ? (b === 'due' ? 'known' : b) : 'all');
  const keyOf = (v: number, level: number): string => `grp:${groupValue[v] < 0 ? '~mitte' : dir.values[groupValue[v]].id}:${bandKey(h.band[v]!, level)}`;
  const forced = scope.filter((v) => v === goalIndex || nextStep[v] === 1 || (onRoute[v] === 1 && h.band[v] === 'ring'));
  const forcedSet = new Set(forced);
  let level = 2;
  const groupsAt = (lv: number): number => new Set(scope.filter((v) => !forcedSet.has(v)).map((v) => keyOf(v, lv))).size;
  while (level > 0 && groupsAt(level) > Math.max(1, Math.floor(budget / 2))) level -= 1;
  const groupOf = new Map<number, string>();
  const members = new Map<string, Set<number>>();
  const groupBand = new Map<string, string>();
  const groupVal = new Map<string, number>();
  for (const v of scope) {
    const key = keyOf(v, level);
    groupOf.set(v, key);
    let set = members.get(key);
    if (set === undefined) { set = new Set(); members.set(key, set); groupBand.set(key, bandKey(h.band[v]!, level)); groupVal.set(key, groupValue[v]); }
    set.add(v);
  }
  const single = new Set<number>();
  const take = (v: number): void => {
    if (single.has(v)) return;
    single.add(v);
    const key = groupOf.get(v);
    groupOf.delete(v);
    if (key === undefined) return;
    const set = members.get(key)!;
    set.delete(v);
    /* Ein Rest von einem ist kein Feld „+1": er steht selbst. */
    if (set.size === 1) { const [last] = set; single.add(last); groupOf.delete(last); set.clear(); }
    if (set.size === 0) members.delete(key);
  };
  for (const set of [...members.values()]) if (set.size === 1) take([...set][0]);
  const fieldCount = () => single.size + members.size;
  const costOf = (v: number): number => (single.has(v) ? 0 : 1);
  const order = (a: number, b: number) => a - b;
  const unlockCount = new Int32Array(n);
  for (const v of scope) if (h.band[v] === 'ring') unlockCount[v] = unlocksOf(v).length;
  /* B.1 — reihum je Bereich: der Beste jedes Bereichs, dann der Zweite jedes Bereichs … */
  const fair = (list: readonly number[]): number[] => {
    const seen = new Map<number, number>();
    const rank = new Map<number, number>();
    for (const v of list) { const a = groupValue[v]; const k = seen.get(a) ?? 0; rank.set(v, k); seen.set(a, k + 1); }
    return list.map((v, i) => ({ v, i })).sort((a, b) => onRoute[b.v] - onRoute[a.v] || rank.get(a.v)! - rank.get(b.v)! || a.i - b.i).map((x) => x.v);
  };
  const ofBand = (b: LsBand) => scope.filter((v) => h.band[v] === b);
  const ringList = fair(ofBand('ring').sort((a, b) => onRoute[b] - onRoute[a] || unlockCount[b] - unlockCount[a] || order(a, b)));
  const kOf = (v: number) => { const x = Number(state?.knowness[v]); return Number.isFinite(x) ? x : 0; };
  const dueList = fair(ofBand('due').sort((a, b) => kOf(a) - kOf(b) || order(a, b)));
  const knownList = fair(ofBand('known').sort((a, b) => fixed.depth[a] - fixed.depth[b] || order(a, b)));
  const mountainList = fair(ofBand('mountain').sort((a, b) => onRoute[b] - onRoute[a] || h.missing[a] - h.missing[b] || order(a, b)));
  /* Immer einzeln: das Ziel, sein nächster Schritt, der Ring auf seinem Weg. */
  for (const v of forced) take(v);
  const shares = bandShares(options.bands);
  const quota = { ring: Math.round(shares.ring * budget), due: Math.round(shares.due * budget), known: Math.round(shares.known * budget) };
  /* Was jedes Band schon an Feldern hat: seine Einzelnen und seine Felder „+N" (das Tal eines Bereichs zählt als Tal). */
  const spent = { ring: 0, due: 0, known: 0 };
  const count = (b: string) => { if (b === 'ring' || b === 'due' || b === 'known') spent[b] += 1; };
  for (const v of single) count(h.band[v]!);
  for (const key of members.keys()) count(groupBand.get(key) ?? '');
  const pass = (list: readonly number[], band: 'ring' | 'due' | 'known' | null, limit: () => number) => {
    for (const v of list) {
      if (single.has(v)) continue;
      const cost = costOf(v);
      if (fieldCount() + cost > budget) continue;
      if (band !== null && spent[band] + cost > limit()) continue;
      take(v);
      if (band !== null) spent[band] += cost;
    }
  };
  pass(ringList, 'ring', () => quota.ring);
  pass(dueList, 'due', () => quota.due);
  pass(knownList, 'known', () => quota.known);
  pass(ringList, null, () => Infinity);
  pass(dueList, null, () => Infinity);
  pass(knownList, null, () => Infinity);
  if (ringList.every((v) => single.has(v))) pass(mountainList, null, () => Infinity);

  /* -- Die Höhen jeder Zelle (die Karte bleibt) --------------------------------------------------------------------- */
  const cells = fixed.cells;
  const want = new Float64Array(cells.length);
  const at = new Map<string, number>();
  cells.forEach((c, i) => at.set(`${c.q},${c.r}`, i));
  for (let i = 0; i < cells.length; i += 1) {
    const v = cells[i].node;
    want[i] = v >= 0 ? liftOf(h.band[v], h.missing[v]) : Number.NaN;
  }
  /* Der Boden zwischen den Einträgen folgt ihnen gedämpft: Täler breiten sich aus, Berge laufen aus. */
  for (let i = 0; i < cells.length; i += 1) {
    if (cells[i].node >= 0) continue;
    let sum = 0;
    let k = 0;
    for (const [dq, dr] of HEX_DIRS) {
      const j = at.get(`${cells[i].q + dq},${cells[i].r + dr}`);
      if (j !== undefined && cells[j].node >= 0) { sum += want[j]; k += 1; }
    }
    want[i] = k === 0 ? 0 : Math.max(-0.45, Math.min(1, (sum / k) * 0.55));
  }
  const lift = new Float64Array(cells.length);
  const liftAt = new Map<string, number>();
  /* Von hinten nach vorn: eine Fläche davor deckt höchstens ein Drittel der Fläche dahinter. */
  for (let i = 0; i < cells.length; i += 1) {
    let z = want[i];
    for (const [dq, dr, tol] of BACK) {
      const behind = liftAt.get(`${cells[i].q + dq},${cells[i].r + dr}`);
      if (behind !== undefined) z = Math.min(z, behind + tol);
    }
    lift[i] = z;
    liftAt.set(`${cells[i].q},${cells[i].r}`, z);
  }
  let meLift = -0.55;
  for (const [dq, dr, tol] of BACK) { const behind = liftAt.get(`${dq},${dr}`); if (behind !== undefined) meLift = Math.min(meLift, behind + tol); }

  /* -- Die Felder ------------------------------------------------------------------------------------------------ */
  const fieldOfNode = new Map<number, string>();
  for (const v of scope) fieldOfNode.set(v, single.has(v) ? input.ids[v] : groupOf.get(v) ?? '');
  const cardsKnown = state?.cardsKnown;
  const cardsTotal = state?.cardsTotal;
  const progressOf = (list: readonly number[]): { known: number; total: number } | undefined => {
    if (cardsTotal === undefined || cardsKnown === undefined) return undefined;
    let known = 0;
    let total = 0;
    for (const v of list) { known += Number(cardsKnown[v]) || 0; total += Number(cardsTotal[v]) || 0; }
    return total > 1 ? { known, total } : undefined;
  };
  const fields: LsField[] = [];
  const cellIndex = fixed.cellOf;
  const polarOf = (i: number) => polar(cells[i].x, cells[i].y);
  for (const v of scope) {
    if (!single.has(v)) continue;
    const ci = cellIndex[v];
    const c = cells[ci];
    const b = h.band[v]!;
    const unlocks = unlocksOf(v);
    const progress = progressOf([v]);
    fields.push({
      key: input.ids[v], kind: 'entry', id: input.ids[v], label: label(v), count: 1, height: h.height[v], missing: h.missing[v], topics: h.topics[v], band: b,
      locked: h.locked[v] === 1, subject: dir.subject[v], area: dir.centre[v] === 1 ? -1 : dir.top[v], q: c.q, r: c.r, x: c.x, y: c.y,
      angle: polarOf(ci).angle, row: Math.round(polarOf(ci).rho), lift: lift[ci], route: onRoute[v], next: nextStep[v] === 1, goal: v === goalIndex,
      due: b === 'due' ? 1 : 0, ring: b === 'ring' ? 1 : 0, known: b === 'known' ? 1 : 0, mountain: b === 'mountain' ? 1 : 0, edge: false, cells: [ci],
      ...(progress === undefined ? {} : { progress }), ...(unlocks.length === 0 ? {} : { unlocks: unlocks.map((d) => input.ids[d]) }),
      ...(options.marks?.[input.ids[v]] === undefined ? {} : { mark: options.marks[input.ids[v]] })
    });
  }
  for (const [key, set] of members) {
    const list = [...set].sort((a, b) => order(a, b));
    const x = groupVal.get(key) ?? -1;
    /* Das Zeichen steht auf der Zelle, die der Mitte des Feldes am nächsten liegt (bei Gleichstand die ältere Kennung). */
    let mx = 0;
    let my = 0;
    for (const v of list) { const c = cells[cellIndex[v]]; mx += c.x; my += c.y; }
    mx /= list.length;
    my /= list.length;
    let anchor = list[0];
    let best = Infinity;
    for (const v of list) {
      const c = cells[cellIndex[v]];
      const d = (c.x - mx) ** 2 + (c.y - my) ** 2;
      if (d < best - 1e-9 || (Math.abs(d - best) <= 1e-9 && input.ids[v] < input.ids[anchor])) { best = d; anchor = v; }
    }
    const ac = cellIndex[anchor];
    const c = cells[ac];
    const ring = list.filter((v) => h.band[v] === 'ring').length;
    const due = list.filter((v) => h.band[v] === 'due').length;
    const known = list.filter((v) => h.band[v] === 'known').length;
    const mountain = list.length - ring - due - known;
    const key0 = groupBand.get(key);
    /* Das Band des Feldes: sein Band; das Tal (gelernt und zu wiederholen zusammen) ist Tal; der ganze Bereich nach dem Wichtigsten darin. */
    const band: LsBand = key0 === 'ring' || key0 === 'due' || key0 === 'known' || key0 === 'mountain' ? key0 : ring > 0 ? 'ring' : due > 0 ? 'due' : mountain > 0 ? 'mountain' : 'known';
    const low = Math.min(...list.map((v) => (h.band[v] === 'mountain' ? h.missing[v] : Infinity)));
    const area = dir.centre[list[0]] === 1 ? -1 : dir.top[list[0]];
    const progress = progressOf(list);
    fields.push({
      key, kind: 'area', value: x >= 0 ? dir.values[x].id : '', label: x >= 0 ? dir.values[x].label : t('cogitaLearnLogic.landscape.noArea'), count: list.length,
      height: band === 'mountain' ? low : band === 'ring' ? 0 : -1, missing: Number.isFinite(low) ? low : 0, band, locked: false,
      subject: x >= 0 ? dir.subjectOfValue[x] : -1, area, q: c.q, r: c.r, x: c.x, y: c.y, angle: polarOf(ac).angle, row: Math.round(polarOf(ac).rho), lift: lift[ac],
      route: list.filter((v) => onRoute[v] === 1 || v === goalIndex).length, next: list.some((v) => nextStep[v] === 1), goal: goalIndex !== undefined && list.includes(goalIndex),
      due, ring, known, mountain, edge: false, ids: list.map((v) => input.ids[v]), cells: list.map((v) => cellIndex[v]),
      ...(progress === undefined ? {} : { progress })
    });
  }
  const toneOf = (i: number): LsBand | null => {
    const tally = new Map<LsBand, number>();
    for (const [dq, dr] of HEX_DIRS) {
      const j = at.get(`${cells[i].q + dq},${cells[i].r + dr}`);
      const v = j === undefined ? -1 : cells[j].node;
      const b = v >= 0 ? h.band[v] : null;
      if (b !== null) tally.set(b === 'due' ? 'known' : b, (tally.get(b === 'due' ? 'known' : b) ?? 0) + 1);
    }
    let best: LsBand | null = null;
    for (const [b, k] of tally) if (best === null || k > tally.get(best)!) best = b;
    return best;
  };
  /* Im Zoom gehört Boden zum Fokus, wenn er in dessen Bögen liegt (die Mitte beim Lernenden ist dann Umgebung). */
  const inArcs = (x: number, y: number): boolean => {
    if (focus.length === 0) return true;
    const p = polar(x, y);
    return p.rho >= HUB && focus.some((fv) => p.angle >= dir.from[fv] - 1e-9 && p.angle <= dir.to[fv] + 1e-9);
  };
  const land: LsLand[] = cells.map((c, i) => {
    const v = c.node;
    const band = v >= 0 ? h.band[v] : null;
    return {
      q: c.q, r: c.r, x: c.x, y: c.y, lift: lift[i], band, tone: v >= 0 ? band : toneOf(i), steps: v >= 0 && band === 'mountain' ? h.missing[v] : 0, node: v, field: v >= 0 ? fieldOfNode.get(v) ?? null : null,
      region: c.region, subject: v >= 0 ? dir.subject[v] : c.region >= 0 ? areas[c.region]?.subject ?? -1 : -1, inScope: v >= 0 ? inScope[v] === 1 : inArcs(c.x, c.y), due: band === 'due'
    };
  });
  /* Die Kamera: im Ganzen das ganze Land, im Zoom die Zellen des Fokus — immer mit dem Lernenden (der Bereich läuft von ihm aus). */
  const camCells = focus.length === 0 ? land : land.filter((c) => c.inScope);
  const xs = camCells.map((c) => c.x);
  const ys = camCells.map((c) => c.y);
  const camera = camCells.length === 0
    ? { x0: -3, x1: 3, y0: -0.6, y1: 3 }
    : { x0: Math.min(...xs, 0) - 1, x1: Math.max(...xs, 0) + 1, y0: -0.6, y1: Math.max(...ys) + 1 };
  const bands = new Uint8Array(n);
  for (let v = 0; v < n; v += 1) bands[v] = h.band[v] === null ? 0 : BAND_CODE.indexOf(h.band[v]);
  return {
    fields, land, sectors, areas, path, outside, camera, goal, counts, total: scope.length, me: { lift: meLift }, notes,
    heights: h.height.slice(), bands, locked: h.locked.slice(), links: fixed.links, cellOf: fixed.cellOf
  };
}

/** Die Bits der offenen (nicht gelernten) Komponenten in Wort `w` — einmal je Stand gemerkt. */
const openCache = new WeakMap<LsHeights, Uint32Array>();
function openBits(g: LsGraph, h: LsHeights, w: number): number {
  let mask = openCache.get(h);
  if (mask === undefined) {
    mask = new Uint32Array(g.words);
    for (let c = 0; c < g.members.length; c += 1) if (h.open[c] === 1 && g.bit[c] >= 0) mask[g.bit[c] >>> 5] |= 1 << (g.bit[c] & 31);
    openCache.set(h, mask);
  }
  return mask[w] | 0;
}


/* -- Der Motor: Graph, Karte, Stand, Gestalt — getrennt, damit jeder Teil nur rechnet, wenn er sich ändert --------- */

/**
 * 2026-11-04 (Prompt 11) — DER STAND JE KNOTEN, ohne Gestalt (der Krajobraz der Gebiete zeichnet selbst): das Band
 * (Index in `BAND_CODE`), wie viele Schritte davor fehlen (`missing`: die längste Kette; die Stufen sind `liftOf`), wie
 * viele verschiedene Themen davor fehlen (`topics`) und ob ein Ring-Feld erst eine Powtórka braucht (`locked`).
 */
export interface LsStand {
  readonly band: Uint8Array;
  readonly missing: Int32Array;
  readonly topics: Int32Array;
  readonly locked: Uint8Array;
  readonly ms: number;
}

export interface LsRun {
  readonly layout: LsLayout;
  /** Millisekunden: Graph und Karte (nur beim ersten Mal oder nach einer Änderung), Höhen, Gestalt. */
  readonly ms: { readonly graph: number; readonly heights: number; readonly layout: number };
}

/**
 * DER MOTOR EINES KRAJOBRAZ — im Worker oder (ohne Worker) im Hauptfaden. `setInput` baut den Graphen und die feste
 * Karte, `setState` die Höhen (nach jeder Antwort), `layout` die Felder.
 */
export class LandscapeEngine {
  private input: LsInput | null = null;
  private graph: LsGraph | null = null;
  private fixed: LsFixed | null = null;
  private state: LsState | null = null;
  private heights: LsHeights | null = null;
  private last: LsLayout | null = null;
  private graphMs = 0;
  private heightsMs = 0;

  setInput(input: LsInput, edgeFilter?: (from: number, to: number) => boolean): void {
    const t = now();
    this.input = input;
    this.graph = buildGraph(input, edgeFilter);
    /* 2026-11-04 (Prompt 11) — die feste flache Karte erst, wenn jemand sie braucht (die Gebiete brauchen sie nicht). */
    this.fixed = null;
    this.heights = null;
    this.graphMs = now() - t;
  }

  private fixedNow(): LsFixed | null {
    if (this.fixed === null && this.input !== null && this.graph !== null) this.fixed = fixedLayout(this.input, this.graph);
    return this.fixed;
  }

  /** 2026-11-04 (Prompt 11) — der Stand je Knoten (Band, Schritte, Themen, Sperre) — ohne Gestalt. */
  stand(): LsStand {
    if (this.heights === null) throw new Error('Krajobraz: brak stanu.');
    const t = now();
    const h = this.heights;
    const band = new Uint8Array(h.band.length);
    for (let v = 0; v < h.band.length; v += 1) { const b = h.band[v]; band[v] = b === null ? 0 : BAND_CODE.indexOf(b); }
    return { band, missing: h.missing, topics: h.topics, locked: h.locked, ms: this.heightsMs + (now() - t) };
  }

  setState(state: LsState): void {
    if (this.graph === null) throw new Error('Krajobraz: najpierw graf.');
    const t = now();
    this.state = state;
    this.heights = heightsOf(this.graph, state);
    this.heightsMs = now() - t;
  }

  layout(options: LsOptions = {}): LsRun {
    const fixed = this.fixedNow();
    if (this.input === null || this.graph === null || fixed === null || this.heights === null) throw new Error('Krajobraz: brak grafu albo stanu.');
    const t = now();
    const layout = layoutOf(this.input, this.graph, this.heights, options, fixed, this.state ?? undefined);
    this.last = layout;
    const ms = { graph: this.graphMs, heights: this.heightsMs, layout: now() - t };
    this.graphMs = 0;
    return { layout, ms };
  }

  /** Die feste Karte (Zellen, Bereiche) — ohne Höhen: für die Abschrift für AI und für Prüfungen. */
  map(): LsFixed | null { return this.fixedNow(); }

  /** Der Weg zu einem Eintrag (Kennungen je Schritt). */
  routeTo(id: string): { readonly steps: readonly (readonly string[])[]; readonly next: readonly string[]; readonly open: boolean } | null {
    if (this.input === null || this.graph === null || this.heights === null) return null;
    const v = this.input.ids.indexOf(id);
    if (v < 0) return null;
    const r = routeOf(this.graph, this.heights, this.input.needs, this.input.labels, v);
    return { steps: r.steps.map((s) => s.map((x) => this.input!.ids[x])), next: r.next.map((x) => this.input!.ids[x]), open: r.goalOpen };
  }

  /** Wo ein Eintrag steht (fest) — für Avatare und Führungen. */
  positionOf(id: string): { readonly x: number; readonly y: number; readonly height: number; readonly field: string | null } | null {
    const fixed = this.fixedNow();
    if (this.input === null || fixed === null) return null;
    const v = this.input.ids.indexOf(id);
    const i = v < 0 ? -1 : fixed.cellOf[v];
    if (i < 0) return null;
    const c = fixed.cells[i];
    const f = this.last?.fields.find((x) => x.id === id || (x.ids?.includes(id) ?? false)) ?? null;
    return { x: c.x, y: c.y, height: this.heights?.height[v] ?? Number.NaN, field: f?.key ?? null };
  }

  heightOf(id: string): number | null {
    if (this.input === null || this.heights === null) return null;
    const v = this.input.ids.indexOf(id);
    return v < 0 ? null : this.heights.height[v];
  }
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
