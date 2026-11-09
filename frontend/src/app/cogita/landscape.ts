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
 * Der Fortschritt ändert nur die Höhen: das Gelernte sinkt ins Tal, was jetzt zu lernen ist, liegt eben, was noch nicht
 * erreichbar ist, steht als Berg (`liftOf`).
 *
 * <b>2026-11-09 (Weltkarte, Entscheidung 2)</b> — die alte feste Karte und ihre Gestalt je Fokus (`fixedLayout`, `layoutOf`,
 * dazu `LandscapeEngine.layout`, `map`, `positionOf`) sind entfernt: niemand fragte sie mehr. Die Plätze legt heute
 * `worldLayout.ts` (eine Landschaft aus den Gebieten), die Weltkarte `worldmap/`. Hier bleiben Graph, Höhen, Stand und Wege.
 */


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
  /** Die Werte der Richtung (eine Achse, ein Feldwert) — leer: ohne Gruppierung. */
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

/* -- Konstanten ---------------------------------------------------------------------------------------------------- */

/** Ab hier „znane" (`knowness.ts` KNOWN), ab hier „poznane" (FORGOTTEN) — dieselben Bänder wie überall. */
export const LS_KNOWN = 1;
export const LS_LEARNED = 0.1;
/** Mehr Speicher für die Bitmengen nicht (Wörter): darüber zählt eine Suche je Eintrag (langsamer, aber begrenzt). */
const MAX_WORDS = 40_000_000;

/** 2026-11-03 — DIE ZEICHNUNG (auch für die Ansicht): halbschräg — die Tiefe des Bodens gestaucht. */
export const LS_FORE = 0.52;
/** Eine Kachel in der Höhe, in Bodeneinheiten (Abstand zweier Nachbarzellen = 1). */
export const LS_TILE = 0.4;
/** So viel ihrer Zelle füllt eine Kachel — 2026-11-03 (E): ganz, Kante an Kante (ein zusammenhängendes Raster). */
export const LS_SHRINK = 1;

export type LsBand = 'known' | 'due' | 'ring' | 'mountain';

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

/* -- Bänder und Stufen eines Standes ---------------------------------------------------------------------------- */

export const BAND_CODE: readonly (LsBand | null)[] = [null, 'known', 'due', 'ring', 'mountain'];

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

/* -- Der Motor: Graph und Stand — getrennt, damit jeder Teil nur rechnet, wenn er sich ändert ----------------------- */

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

/**
 * DER MOTOR EINES KRAJOBRAZ — im Worker oder (ohne Worker) im Hauptfaden. `setInput` baut den Graphen, `setState` die
 * Höhen (nach jeder Antwort), `stand` den Stand je Knoten, `routeTo` den Weg. 2026-11-09 (Weltkarte, Entscheidung 2) — die
 * alte feste Karte und ihre Gestalt je Fokus (`fixedLayout`, `layoutOf`, `layout`, `map`, `positionOf`) sind entfernt: die
 * Landschaft zeichnet `worldLayout.ts`, die Weltkarte `worldmap/`.
 */
export class LandscapeEngine {
  private input: LsInput | null = null;
  private graph: LsGraph | null = null;
  private heights: LsHeights | null = null;
  private heightsMs = 0;

  setInput(input: LsInput, edgeFilter?: (from: number, to: number) => boolean): void {
    this.input = input;
    this.graph = buildGraph(input, edgeFilter);
    this.heights = null;
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
    this.heights = heightsOf(this.graph, state);
    this.heightsMs = now() - t;
  }

  /** Der Weg zu einem Eintrag (Kennungen je Schritt). */
  routeTo(id: string): { readonly steps: readonly (readonly string[])[]; readonly next: readonly string[]; readonly open: boolean } | null {
    if (this.input === null || this.graph === null || this.heights === null) return null;
    const v = this.input.ids.indexOf(id);
    if (v < 0) return null;
    const r = routeOf(this.graph, this.heights, this.input.needs, this.input.labels, v);
    return { steps: r.steps.map((s) => s.map((x) => this.input!.ids[x])), next: r.next.map((x) => this.input!.ids[x]), open: r.goalOpen };
  }

  heightOf(id: string): number | null {
    if (this.input === null || this.heights === null) return null;
    const v = this.input.ids.indexOf(id);
    return v < 0 ? null : this.heights.height[v];
  }
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
