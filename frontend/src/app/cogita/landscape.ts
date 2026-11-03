/**
 * 2026-11-03 — DER KRAJOBRAZ EINER BAZA WIEDZY (documentation/COGITA-WORLD.md, Task 2): jeder Widok als persönliche
 * Landschaft des Betrachters. Rein gerechnet, ohne Oberfläche (gezeichnet von `LandscapeView.tsx`, im Worker
 * `landscape.worker.ts`, geprüft in `scripts/app-landscape-check.mjs`).
 *
 * <b>Eingänge — und nichts sonst</b>: die Einträge des Widoku, die Reihenfolge des Lernens (dieselben Kanten wie
 * `#level`, `learning` und `rel: "before"`: Felder mit `prerequisite`, `needs` der Pytania, die Zależności der
 * Ustawienia — hier ROH, mit Kreisen), die Gruppierung des Widoku als Richtung, die Kenntnis des Betrachters
 * (`knowing.ts`, Bänder aus `logic.ts`).
 *
 * <code>
 *   Höhe   −1            Kenntnis ≥ 1 (znane): Talgrund
 *          −1 … 0        0,1 ≤ k < 1 (do powtórki): −(k − 0,1)/0,9 — steigt aus dem Tal, während sie verblasst
 *           0            nicht gelernt, nichts fehlt davor: der Ring, jetzt zu lernen
 *           n ≥ 1        nicht gelernt: n verschiedene nicht gelernte Einträge in der ganzen Kette davor (Vereinigung)
 * </code>
 * „Gelernt" ist das Band `learned` (k ≥ 0,1): was verblasst, bleibt gelernt — die Berge dahinter wachsen nicht nach;
 * erst unter 10 % fehlt es wieder. Das ist strenger als `rel: "before"` (nur die nächsten Einträge); beide gelten.
 * Gezählt werden nur Einträge mit Karten; die ohne sind durchsichtig (was vor ihnen kommt, zählt). Ein Kreis
 * (stark zusammenhängende Komponente) ist EIN Schritt. Die Vereinigung rechnen Bitmengen über dem verdichteten Graphen
 * in topologischer Reihenfolge — die Mengen hängen nur vom Graphen ab; ein neuer Stand zählt nur neu.
 *
 * <b>Die Gestalt</b>: ein Halbkreis vor dem Lernenden (unten in der Mitte) — das Tal um ihn, der Ring davor, die Berge
 * dahinter; die Entfernung wächst mit der Höhe. Die Richtung ist der Winkel: die Werte der Gruppierung teilen die 180°
 * nach der Zahl ihrer Einträge, geordnet so, dass Werte, die oft zusammen vorkommen oder durch Voraussetzungen
 * verbunden sind, Nachbarn werden; ein Eintrag steht im Mittel seiner Werte. Platziert auf einem Sechseckraster,
 * deterministisch: derselbe Stand gibt dasselbe Bild.
 *
 * <b>Budget und Fokus</b>: höchstens `budget` einzelne Felder (der Ring zuerst, dann was im Tal zu wiederholen ist,
 * dann die nahen Berge); der Rest eines Bereichs wird ein Feld („II wojna · 340 tematów"), das sich beim Fokus
 * öffnet. Fokus ist Zoom in die Werte, in jeder Tiefe; die Höhen bleiben global.
 *
 * <b>Für später</b> (Avatare, Führungen, Altersvarianten): `LandscapeEngine` — Graph, Stand und Gestalt getrennt;
 * `positionOf`, `routeOf`, `marks` (fremde Markierungen auf Feldern) und `edgeFilter` sind der Weg hinein, ohne die
 * Ansicht neu zu schreiben.
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
  /** Die Werte der Richtung — leer: der Winkel kommt aus der Nähe im Graphen. */
  readonly values: readonly LsValue[];
  /** Je Knoten die Werte, zu denen er gehört (Indizes in `values`). */
  readonly memberOf: readonly (readonly number[])[];
}

/** Der Stand des Betrachters je Knoten. */
export interface LsState {
  /** Die Kenntnis des Eintrags (`itemKnowness`); 0 ohne Antwort. */
  readonly knowness: ArrayLike<number>;
  /** Hat eine beantwortete Karte mit Kenntnis unter 1 (do powtórki, oder zuletzt falsch, vergessen). */
  readonly weak: ArrayLike<number | boolean>;
}

export interface LsOptions {
  /** Höchstens so viele einzelne Felder (Vorgabe 60). */
  readonly budget?: number;
  /** Der Fokus: Werte (ihre Kennungen) — leer: alles. */
  readonly focus?: readonly string[];
  /** Das Ziel (eine Kennung) — sein Weg wird markiert. */
  readonly goal?: string | null;
  /** 2026-11-03 — für später: fremde Markierungen auf Feldern (Avatare, eine Führung), je Eintrag ein Wort. */
  readonly marks?: Readonly<Record<string, string>>;
  /** Schmal (ein Telefon): die Berge rücken näher, damit der Halbkreis in die Breite passt. */
  readonly narrow?: boolean;
}

/* -- Konstanten ---------------------------------------------------------------------------------------------------- */

/** Ab hier „znane" (`knowness.ts` KNOWN), ab hier „poznane" (FORGOTTEN) — dieselben Bänder wie überall. */
export const LS_KNOWN = 1;
export const LS_LEARNED = 0.1;
export const LS_BUDGET = 60;
/** Mehr Speicher für die Bitmengen nicht (Wörter): darüber zählt eine Suche je Eintrag (langsamer, aber begrenzt). */
const MAX_WORDS = 40_000_000;

export type LsBand = 'known' | 'due' | 'ring' | 'mountain';

export const LS_BAND_LABEL: Readonly<Record<LsBand, string>> = {
  known: 'umiem', due: 'do powtórki', ring: 'do nauki teraz', mountain: 'jeszcze za górami'
};

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
  /** Je Knoten: wie viele Schritte fehlen (0 im Tal und auf dem Ring). */
  readonly missing: Int32Array;
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
  const height = new Float64Array(n);
  const missing = new Int32Array(n);
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
    const m = missingComp[c];
    missing[v] = m;
    height[v] = m;
    band[v] = m === 0 ? 'ring' : 'mountain';
    if (m === 0) {
      const own = g.members[c].length > 1 && g.members[c].some((u) => u !== v && (state.weak[u] === true || state.weak[u] === 1));
      if (weakBefore[c] === 1 || own) locked[v] = 1;
    }
  }
  return { height, missing, band, locked, open };
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

/* -- Richtung: Werte, Sektoren, Winkel ------------------------------------------------------------------------------ */

export interface LsSector {
  /** Der Wert (seine Kennung) — '' für „bez wartości" und für die Bereiche aus der Nähe im Graphen (`#1` …). */
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

export interface Direction {
  /** Je Knoten im Fokus sein Winkel — NaN: ausserhalb des Fokus. */
  readonly angle: Float64Array;
  /** Je Knoten sein Bereich (Index in `sectors`) — −1: ausserhalb. */
  readonly area: Int32Array;
  readonly sectors: readonly LsSector[];
  /** Der Fokus, wie er nach dem Hinabsteigen gilt (die Kette von oben). */
  readonly path: readonly { readonly value: string; readonly label: string }[];
  /** Was ausserhalb des Fokus liegt, je oberster Wert: links oder rechts davon. */
  readonly outside: readonly { readonly value: string; readonly label: string; readonly side: 'left' | 'right'; readonly ids: readonly number[]; readonly subject: number }[];
  /** Je Knoten die Farbe (oberster Wert). */
  readonly subject: Int32Array;
}

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
 * DIE RICHTUNG: die Werte unter dem Fokus teilen die 180° nach der Zahl ihrer Einträge (geordnet nach Gemeinsamem);
 * jeder Wert bekommt rekursiv seinen Bogen im Bogen darüber. Ein Eintrag hängt an seinen TIEFSTEN Werten (ein Wert,
 * der über einem anderen seiner Werte liegt, zählt nicht — eine Idee unter ihrer Lektion steht in ihrem eigenen Bogen,
 * nicht in der Mitte der Lektion) und steht im Mittel ihrer Mitten. Ohne Werte: die Reihenfolge eines Gangs durch den
 * Graphen (Nachbarn im Graphen — Nachbarn im Bogen), in Bereichen zu etwa gleich vielen.
 */
export function directionOf(input: LsInput, g: LsGraph, focusIds: readonly string[]): Direction {
  const n = input.ids.length;
  const angle = new Float64Array(n).fill(Number.NaN);
  const area = new Int32Array(n).fill(-1);
  const subject = new Int32Array(n).fill(-1);
  const shown = (v: number) => input.inView[v] === true && input.learnable[v] === true;
  const V = input.values.length;
  if (V === 0) return proximityDirection(input, g, shown, angle, area, subject);

  /* Der Baum der Werte (ein Wert, der über sich selbst läge, hängt oben); Kinder in der Reihenfolge des Autors. */
  const ROOT = V;
  const rawParent = (x: number): number => { const p = input.values[x]?.parent ?? -1; return p >= 0 && p < V && p !== x ? p : ROOT; };
  const parent = new Int32Array(V + 1).fill(ROOT);
  for (let x = 0; x < V; x += 1) {
    let p = rawParent(x);
    const seen = new Set<number>([x]);
    for (let y = p, guard = 0; y !== ROOT && guard < 256; y = rawParent(y), guard += 1) { if (seen.has(y)) { p = ROOT; break; } seen.add(y); }
    parent[x] = p;
  }
  const rankOf = (x: number) => (x === ROOT ? -1 : input.values[x].rank);
  const kids: number[][] = Array.from({ length: V + 1 }, () => []);
  for (let x = 0; x < V; x += 1) kids[parent[x]].push(x);
  for (const list of kids) list.sort((a, b) => rankOf(a) - rankOf(b) || a - b);
  /** Die Kette von oben bis zu x (ohne die Wurzel). */
  const chainTo = (x: number): number[] => { const out: number[] = []; for (let y = x, guard = 0; y !== ROOT && guard < 256; y = parent[y], guard += 1) out.push(y); return out.reverse(); };
  const isAncestor = (a: number, b: number): boolean => { for (let y = parent[b], guard = 0; y !== ROOT && guard < 256; y = parent[y], guard += 1) if (y === a) return true; return false; };

  /* Die tiefsten Werte jedes Eintrags. */
  const deepest: (readonly number[])[] = new Array(n);
  const own: number[][] = Array.from({ length: V + 1 }, () => []);
  const noValue: number[] = [];
  for (let v = 0; v < n; v += 1) {
    if (!shown(v)) { deepest[v] = []; continue; }
    const list = [...new Set((input.memberOf[v] ?? []).filter((x) => x >= 0 && x < V))];
    const deep = list.filter((x) => !list.some((y) => y !== x && isAncestor(x, y)));
    deepest[v] = deep;
    if (deep.length === 0) noValue.push(v);
    for (const x of deep) own[x].push(v);
  }
  const sub = new Int32Array(V + 1);
  const walk: number[] = [];
  for (const st = [ROOT]; st.length > 0;) { const x = st.pop()!; walk.push(x); for (const k of kids[x]) st.push(k); }
  for (let i = walk.length - 1; i >= 0; i -= 1) { const x = walk[i]; sub[x] += own[x].length; if (x !== ROOT) sub[parent[x]] += sub[x]; }
  const live = (x: number) => sub[x] > 0;
  const liveKids = (x: number) => kids[x].filter(live);

  /* Gemeinsames zweier Geschwister: Einträge in beiden, Voraussetzungen zwischen ihren Einträgen. */
  const under = new Map<number, Set<number>>();
  const entriesUnder = (x: number): Set<number> => {
    let set = under.get(x);
    if (set !== undefined) return set;
    set = new Set<number>();
    for (const st = [x]; st.length > 0;) { const y = st.pop()!; for (const v of own[y]) set.add(v); for (const k of kids[y]) if (live(k)) st.push(k); }
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
  const orderOf = (items: readonly number[]): number[] => (items.length > 160 ? [...items].sort((a, b) => rankOf(a) - rankOf(b) || a - b) : seriate(items, affinityAmong(items), rankOf));

  /* Die Farbe: die Werte auf der Ebene, auf der sich das Ganze zuerst teilt — in der Reihenfolge des Autors (stabil beim Zoomen). */
  let top = ROOT;
  for (let guard = 0; guard < 64; guard += 1) { const only = liveKids(top); if (only.length !== 1 || own[top].length > 0) break; top = only[0]; }
  const subjects = liveKids(top);
  const subjectOfValue = new Int32Array(V + 1).fill(-1);
  for (let x = 0; x < V; x += 1) for (const y of chainTo(x)) { const i = subjects.indexOf(y); if (i >= 0) { subjectOfValue[x] = i; break; } }

  /* Der Fokus: die genannten Werte, sonst oben; ein Fokus mit nur einem lebenden Kind (und ohne eigene Einträge) steigt hinab. */
  const byId = new Map(input.values.map((x, i) => [x.id, i] as const));
  let focus = [...new Set(focusIds.map((id) => byId.get(id)).filter((x): x is number => x !== undefined && live(x)))];
  if (focus.length === 0) focus = [ROOT];
  for (let guard = 0; guard < 64 && focus.length === 1; guard += 1) {
    const only = liveKids(focus[0]);
    if (only.length !== 1 || own[focus[0]].length > 0 || liveKids(only[0]).length === 0) break;
    focus = [only[0]];
  }
  const path = focus.length === 1 ? (focus[0] === ROOT ? [] : chainTo(focus[0]).map((y) => ({ value: input.values[y].id, label: input.values[y].label })))
    : focus.map((x) => ({ value: input.values[x].id, label: input.values[x].label }));

  /* Die Bereiche: die lebenden Kinder der Werte im Fokus (ein Blatt im Fokus ist selbst sein Bereich). */
  const items = [...new Set(focus.flatMap((f) => (liveKids(f).length > 0 ? liveKids(f) : f === ROOT ? [] : [f])))];
  const ordered = orderOf(items);
  const withNone = focus[0] === ROOT && noValue.length > 0;
  const weightOf = (x: number) => Math.max(0.35, x < 0 ? noValue.length : sub[x]);
  const sectorList = withNone ? [...ordered, -1] : ordered;
  const total = sectorList.reduce((s, x) => s + weightOf(x), 0) || 1;
  const span = new Map<number, [number, number]>();
  const lay = (list: readonly number[], from: number, to: number) => {
    if (list.length === 0) return;
    const ord = orderOf(list);
    const sum = ord.reduce((s, x) => s + Math.max(0.35, sub[x]), 0) || 1;
    let at = from;
    for (const x of ord) {
      const w = ((to - from) * Math.max(0.35, sub[x])) / sum;
      span.set(x, [at, at + w]);
      lay(liveKids(x), at, at + w);
      at += w;
    }
  };
  const sectors: LsSector[] = [];
  let at = 0;
  for (const x of sectorList) {
    const w = (180 * weightOf(x)) / total;
    if (x < 0) {
      sectors.push({ value: '', label: 'bez wartości', from: at, to: at + w, subject: -1, count: noValue.length, deeper: false });
    } else {
      span.set(x, [at, at + w]);
      lay(liveKids(x), at, at + w);
      sectors.push({ value: input.values[x].id, label: input.values[x].label, from: at, to: at + w, subject: subjectOfValue[x], count: sub[x], deeper: liveKids(x).length > 0 });
    }
    at += w;
  }
  /* Ein Wert im Fokus mit eigenen Einträgen: sein Bogen ist der seiner Bereiche (die Einträge stehen in der Mitte). */
  for (const f of focus) {
    if (f === ROOT || span.has(f)) continue;
    const inner = liveKids(f).map((x) => span.get(x)).filter((s): s is [number, number] => s !== undefined);
    if (inner.length > 0) span.set(f, [Math.min(...inner.map((s) => s[0])), Math.max(...inner.map((s) => s[1]))]);
  }

  /* Je Eintrag: seine tiefsten Werte, die im Fokus liegen → Winkel; sonst ausserhalb, gesammelt am Rand. */
  const noneSector = withNone ? sectors.length - 1 : -1;
  const focusChain = focus[0] === ROOT ? [] : chainTo(focus[0]);
  const siblingsAt = new Map<number, number[]>();
  const sideOf = (x: number): { group: number; side: 'left' | 'right' } => {
    const chain = chainTo(x);
    let i = 0;
    while (i < chain.length && i < focusChain.length && chain[i] === focusChain[i]) i += 1;
    const group = chain[Math.min(i, chain.length - 1)] ?? x;
    const parentOfGroup = parent[group];
    let order = siblingsAt.get(parentOfGroup);
    if (order === undefined) { order = orderOf(liveKids(parentOfGroup)); siblingsAt.set(parentOfGroup, order); }
    const mine = order.indexOf(group);
    const theirs = focusChain[i] === undefined ? -1 : order.indexOf(focusChain[i]);
    return { group, side: theirs >= 0 && mine < theirs ? 'left' : 'right' };
  };
  const outsideMap = new Map<number, { side: 'left' | 'right'; ids: number[] }>();
  for (let v = 0; v < n; v += 1) {
    if (!shown(v)) continue;
    const deep = deepest[v];
    const inside = deep.filter((x) => span.has(x) || focus.some((f) => f !== ROOT && isAncestor(f, x)));
    if (deep.length > 0) subject[v] = subjectOfValue[inside[0] ?? deep[0]];
    if (inside.length > 0) {
      let sum = 0;
      let k = 0;
      for (const x of inside) { const s = span.get(x); if (s !== undefined) { sum += (s[0] + s[1]) / 2; k += 1; } }
      angle[v] = k === 0 ? 90 : sum / k;
      const a = angle[v];
      let hit = sectors.findIndex((s) => s.value !== '' && s.from <= a + 1e-9 && a <= s.to + 1e-9);
      if (hit < 0) hit = sectors.reduce((best, s, i) => (Math.abs((s.from + s.to) / 2 - a) < Math.abs((sectors[best].from + sectors[best].to) / 2 - a) ? i : best), 0);
      area[v] = hit;
    } else if (deep.length === 0 && noneSector >= 0) {
      const s = sectors[noneSector];
      const i = noValue.indexOf(v);
      angle[v] = s.from + ((i + 0.5) / Math.max(1, noValue.length)) * (s.to - s.from);
      area[v] = noneSector;
    } else {
      const { group, side } = deep.length === 0 ? { group: -1, side: 'right' as const } : sideOf(deep[0]);
      const o = outsideMap.get(group);
      if (o === undefined) outsideMap.set(group, { side, ids: [v] }); else o.ids.push(v);
    }
  }
  const outside = [...outsideMap.entries()].map(([x, o]) => ({
    value: x < 0 ? '' : input.values[x].id, label: x < 0 ? 'bez wartości' : input.values[x].label, side: o.side, ids: o.ids, subject: x < 0 ? -1 : subjectOfValue[x]
  })).sort((a, b) => (a.side === b.side ? 0 : a.side === 'left' ? -1 : 1) || a.label.localeCompare(b.label, 'pl', { numeric: true }));
  return { angle, area, sectors, path, outside, subject };
}

/** Ohne Werte: ein Gang durch den Graphen (Grundlagen zuerst, Nachbarn hintereinander), in Bereiche zu je etwa gleich vielen. */
function proximityDirection(input: LsInput, g: LsGraph, shown: (v: number) => boolean, angle: Float64Array, area: Int32Array, subject: Int32Array): Direction {
  const n = input.ids.length;
  const view: number[] = [];
  for (let v = 0; v < n; v += 1) if (shown(v)) view.push(v);
  const inView = new Uint8Array(n);
  for (const v of view) inView[v] = 1;
  /* Nachbarn im Graphen, ungerichtet; über Einträge ausserhalb des Widoku hinweg (einen Schritt). */
  const builds: number[][] = Array.from({ length: n }, () => []);
  for (let v = 0; v < n; v += 1) for (const p of input.needs[v] ?? []) if (p >= 0 && p < n && p !== v) builds[p].push(v);
  const label = (v: number) => input.labels[v] ?? '';
  const byName = (a: number, b: number) => label(a).localeCompare(label(b), 'pl', { numeric: true }) || a - b;
  const order: number[] = [];
  const seen = new Uint8Array(n);
  const roots = view.filter((v) => (input.needs[v] ?? []).every((p) => inView[p] !== 1)).sort((a, b) => g.rank[g.comp[a]] - g.rank[g.comp[b]] || byName(a, b));
  const visit = (start: number) => {
    const stack = [start];
    while (stack.length > 0) {
      const v = stack.pop()!;
      if (seen[v] === 1) continue;
      seen[v] = 1;
      if (inView[v] === 1) order.push(v);
      const next = [...builds[v], ...(input.needs[v] ?? [])].filter((x) => x >= 0 && x < n && seen[x] === 0).sort(byName).reverse();
      for (const x of next) stack.push(x);
    }
  };
  for (const r of roots) visit(r);
  for (const v of [...view].sort(byName)) if (seen[v] === 0) visit(v);
  const m = order.length;
  const parts = Math.max(1, Math.min(8, Math.ceil(m / 12)));
  const sectors: LsSector[] = [];
  for (let i = 0; i < parts; i += 1) {
    const from = Math.floor((i * m) / parts);
    const to = Math.floor(((i + 1) * m) / parts);
    const lead = order[from];
    sectors.push({ value: `#${i + 1}`, label: lead === undefined ? `Obszar ${i + 1}` : `okolice: ${label(lead)}`, from: (180 * from) / Math.max(1, m), to: (180 * to) / Math.max(1, m), subject: i, count: to - from, deeper: false });
    for (let j = from; j < to; j += 1) { const v = order[j]; angle[v] = (180 * (j + 0.5)) / m; area[v] = i; subject[v] = i; }
  }
  return { angle, area, sectors, path: [], outside: [], subject };
}

/* -- Die Felder und ihr Platz ------------------------------------------------------------------------------------- */

export interface LsField {
  /** Eintrag: seine Kennung; Bereich: `area:<wert>:<art>`. */
  readonly key: string;
  readonly kind: 'entry' | 'area';
  /** Der Eintrag (bei `entry`). */
  readonly id?: string;
  /** Der Wert, in den ein Klick zoomt (bei `area`). */
  readonly value?: string;
  readonly label: string;
  /** Wie viele Einträge (1 bei einem Eintrag). */
  readonly count: number;
  readonly height: number;
  readonly missing: number;
  readonly band: LsBand;
  readonly locked: boolean;
  /** Farbe (oberster Wert), −1 grau. */
  readonly subject: number;
  /** Der Bereich (Index in `sectors`), −1 ausserhalb des Fokus. */
  readonly area: number;
  /** Das Sechseck (axial, flache Oberseite). */
  readonly q: number;
  readonly r: number;
  /** Der Platz am Boden (Einheiten: Abstand zweier Nachbarn). */
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  /** Wie viele Schritte des Weges zum Ziel darin liegen. */
  readonly route: number;
  readonly next: boolean;
  readonly goal: boolean;
  /** Bei einem Bereich: wie viele davon zu wiederholen sind. */
  readonly due: number;
  /** Bei einem Bereich: wie viele davon jetzt zu lernen sind. */
  readonly ring: number;
  /** Ausserhalb des Fokus (am Rand). */
  readonly edge: boolean;
  /** Für später: fremde Markierungen (Avatare, Führung). */
  readonly mark?: string;
  /** Bei einem Bereich: seine Einträge (Kennungen). */
  readonly ids?: readonly string[];
}

export interface LsLayout {
  readonly fields: readonly LsField[];
  readonly sectors: readonly LsSector[];
  readonly path: readonly { readonly value: string; readonly label: string }[];
  /** Das Ziel: wie viele Schritte fehlen, die nächsten auf dem Ring, der ganze Weg (Kennungen). */
  readonly goal: { readonly id: string; readonly steps: number; readonly next: readonly string[]; readonly route: readonly string[]; readonly open: boolean } | null;
  readonly counts: Readonly<Record<LsBand, number>>;
  /** Wie viele Einträge mit Karten der Widok hat (im Fokus). */
  readonly total: number;
  /** Der Radius des Rings (für die Zeichnung). */
  readonly ring: number;
  /** Was die Ansicht sagen sollte (keine Reihenfolge des Lernens, Kreise …). */
  readonly notes: readonly string[];
  /** Je Knoten (wie `LsInput.ids`): Höhe, Band (0 ohne Karten, 1 znane, 2 do powtórki, 3 Ring, 4 Berg), Sperre — für Suche, Wege, Listen. */
  readonly heights: Float64Array;
  readonly bands: Uint8Array;
  readonly locked: Uint8Array;
}

export const BAND_CODE: readonly (LsBand | null)[] = [null, 'known', 'due', 'ring', 'mountain'];

const SQ3 = Math.sqrt(3);
/** Vom Boden zum Sechseck (flache Oberseite, Nachbarn im Abstand 1): x = √3/2·q, y = r + q/2. */
export function hexAt(x: number, y: number): { q: number; r: number } {
  const qf = (2 * x) / SQ3;
  const rf = y - qf / 2;
  /* Würfel runden. */
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}
export const hexCenter = (q: number, r: number): { x: number; y: number } => ({ x: (SQ3 / 2) * q, y: r + q / 2 });

/** Die Sechsecke im Abstand `d` um (q, r), in fester Reihenfolge. */
function hexRing(q: number, r: number, d: number): { q: number; r: number }[] {
  if (d === 0) return [{ q, r }];
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]] as const;
  const out: { q: number; r: number }[] = [];
  let cq = q + dirs[4][0] * d;
  let cr = r + dirs[4][1] * d;
  for (let side = 0; side < 6; side += 1) {
    for (let i = 0; i < d; i += 1) {
      out.push({ q: cq, r: cr });
      cq += dirs[side][0];
      cr += dirs[side][1];
    }
  }
  return out;
}

/** Die Entfernung zum Lernenden aus der Höhe: Tal innen, Ring, Berge dahinter (zusammengedrückt, gedeckelt). */
export function radiusOf(height: number, ring: number, narrow = false): number {
  if (height < 0) return 2 + (ring - 3) * (height + 1);
  if (height === 0) return ring;
  const n = height;
  const g = n <= 4 ? n - 1 : 3 + Math.log2(n - 3);
  return narrow ? Math.min(ring + 4.6, ring + 1.15 + 0.75 * g) : Math.min(ring + 7.5, ring + 1.35 + 0.95 * g);
}

/** Die Stelle am Boden zu Winkel (0 links … 180 rechts) und Entfernung. */
export const groundAt = (angle: number, radius: number): { x: number; y: number } => {
  const t = (angle * Math.PI) / 180;
  return { x: -radius * Math.cos(t), y: radius * Math.sin(t) };
};

interface Placing {
  readonly key: string;
  readonly angle: number;
  readonly radius: number;
}

/**
 * DER PLATZ AUF DEM RASTER — der Reihe nach (wer zuerst kommt, steht genau): das nächste freie Sechseck, das die
 * Entfernung (die Höhe) besser hält als den Winkel; nie hinter dem Lernenden, nie auf ihm.
 */
export function placeAll(items: readonly Placing[]): Map<string, { q: number; r: number; x: number; y: number }> {
  const taken = new Set<string>(['0,0']);
  const out = new Map<string, { q: number; r: number; x: number; y: number }>();
  for (const it of items) {
    const want = groundAt(it.angle, it.radius);
    const start = hexAt(want.x, want.y);
    let best: { q: number; r: number; cost: number } | null = null;
    for (let d = 0; d <= 12; d += 1) {
      for (const c of hexRing(start.q, start.r, d)) {
        const key = `${c.q},${c.r}`;
        if (taken.has(key)) continue;
        const at = hexCenter(c.q, c.r);
        if (at.y < 0.45) continue;
        const rad = Math.hypot(at.x, at.y);
        const ang = (Math.atan2(at.y, -at.x) * 180) / Math.PI;
        const cost = Math.abs(rad - it.radius) * 2.2 + (Math.abs(ang - it.angle) * Math.PI / 180) * Math.max(1, it.radius);
        if (best === null || cost < best.cost - 1e-9) best = { q: c.q, r: c.r, cost };
      }
      /* Ein Ring weiter kann nur teurer sein, sobald schon ein freies gefunden ist und der Abstand den Preis übersteigt. */
      if (best !== null && d >= 2 && best.cost < d * 0.9) break;
    }
    if (best === null) continue;
    taken.add(`${best.q},${best.r}`);
    const c = hexCenter(best.q, best.r);
    out.set(it.key, { q: best.q, r: best.r, x: c.x, y: c.y });
  }
  return out;
}

const CLASS_RANK: Readonly<Record<LsBand, number>> = { ring: 0, due: 1, mountain: 2, known: 3 };

/**
 * EINE REIHE AUSEINANDERZIEHEN, so wenig wie nötig: Winkel (aufsteigend) mit mindestens `gap` Grad Abstand, die Summe der
 * Verschiebungen im Quadrat klein (Pool-Adjacent-Violators auf t_i − i·gap), innerhalb [lo, hi]. Wo Platz ist, bleibt
 * jeder bei seinem Winkel; nur Gedränge rückt auseinander — die Reihenfolge der Richtung bleibt.
 */
export function spreadAngles(targets: readonly number[], gap: number, lo: number, hi: number): number[] {
  const n = targets.length;
  if (n === 0) return [];
  const g = n > 1 && (n - 1) * gap > hi - lo ? (hi - lo) / (n - 1) : gap;
  const blocks: { sum: number; n: number }[] = [];
  targets.forEach((t, i) => {
    blocks.push({ sum: t - i * g, n: 1 });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1];
      const a = blocks[blocks.length - 2];
      if (a.sum / a.n <= b.sum / b.n) break;
      a.sum += b.sum; a.n += b.n; blocks.pop();
    }
  });
  const x: number[] = [];
  for (const b of blocks) for (let k = 0; k < b.n; k += 1) x.push(b.sum / b.n + x.length * g);
  const under = lo - x[0];
  if (under > 0) for (let i = 0; i < n; i += 1) x[i] += under;
  const over = x[n - 1] - hi;
  if (over > 0) for (let i = 0; i < n; i += 1) x[i] -= over;
  return x.map((v) => Math.max(lo, Math.min(hi, v)));
}

/**
 * DIE GESTALT EINES STANDES: welche Einträge einzeln stehen (das Budget), was sich zu Bereichen sammelt, wo jedes Feld
 * steht — und der Weg zum Ziel.
 */
export function layoutOf(input: LsInput, g: LsGraph, h: LsHeights, options: LsOptions = {}, known?: Direction): LsLayout {
  const budget = Math.max(6, Math.min(400, Math.round(options.budget ?? LS_BUDGET)));
  const dir = known ?? directionOf(input, g, options.focus ?? []);
  const n = input.ids.length;
  const label = (v: number) => input.labels[v] ?? input.ids[v] ?? '';
  const notes: string[] = [];
  if (input.needs.every((l) => l.length === 0)) notes.push('Ta baza nie ma kolejności nauki („Najpierw trzeba znać”) — wszystko, czego jeszcze nie umiesz, leży na pierścieniu.');
  if (g.cycles.length > 0) notes.push(`W kolejności nauki są koła (${g.cycles.length}) — każde liczy się jako jeden krok; popraw je w „Do zrobienia”.`);

  /* Das Ziel und sein Weg. */
  const indexOf = new Map(input.ids.map((id, i) => [id, i] as const));
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

  /* Wer im Fokus steht, nach Vorrang: das Ziel und der Ring zuerst, dann was zu wiederholen ist, dann die nahen Berge. */
  const inFocus: number[] = [];
  for (let v = 0; v < n; v += 1) if (Number.isFinite(dir.angle[v]) && h.band[v] !== null) inFocus.push(v);
  const prio = (v: number): number[] => {
    const b = h.band[v]!;
    const boost = v === goalIndex ? -2 : nextStep[v] === 1 ? -1 : 0;
    const within = b === 'due' ? -h.height[v] : b === 'mountain' ? h.missing[v] : 0;
    return [boost, CLASS_RANK[b], onRoute[v] === 1 ? 0 : 1, within, dir.angle[v]];
  };
  const keyed = inFocus.map((v) => ({ v, p: prio(v) }));
  keyed.sort((a, b) => {
    for (let i = 0; i < a.p.length; i += 1) if (a.p[i] !== b.p[i]) return a.p[i] - b.p[i];
    return a.v - b.v;
  });
  const single = keyed.slice(0, budget).map((k) => k.v);
  const rest = keyed.slice(budget).map((k) => k.v);
  const counts: Record<LsBand, number> = { known: 0, due: 0, ring: 0, mountain: 0 };
  for (const v of inFocus) counts[h.band[v]!] += 1;
  const ringCount = single.filter((v) => h.band[v] === 'ring').length;
  const narrow = options.narrow === true;
  const ring = Math.max(narrow ? 4 : 5, Math.min(narrow ? 9 : 14, ringCount / 2.6 + 1.2));

  /* Bereiche: je Bereich und Art (Land: gelernt; Ring: jetzt zu lernen; Gebirge: noch nicht erreichbar). */
  type Agg = { key: string; value: string; label: string; ids: number[]; cls: 'land' | 'ring' | 'range'; area: number };
  const aggs = new Map<string, Agg>();
  for (const v of rest) {
    const b = h.band[v]!;
    const cls = b === 'known' || b === 'due' ? 'land' : b === 'ring' ? 'ring' : 'range';
    const a = dir.area[v];
    const sector = dir.sectors[a];
    const key = `area:${sector?.value ?? ''}:${cls}`;
    const got = aggs.get(key);
    if (got === undefined) aggs.set(key, { key, value: sector?.value ?? '', label: sector?.label ?? '', ids: [v], cls, area: a });
    else got.ids.push(v);
  }

  const fields: LsField[] = [];
  /*
   * Reihen nach der Höhe (der Ring, jede Bergstufe, das Tal in Streifen): in jeder Reihe rücken nur Gedrängte auseinander
   * (`spreadAngles`); eine Reihe, die nicht passt, wird zwei versetzte (Bienenwabe). Dann das Raster.
   */
  const rows = new Map<string, number[]>();
  const radiusFor = new Map<number, number>();
  for (const v of single) {
    const r = radiusOf(h.height[v], ring, narrow);
    radiusFor.set(v, r);
    const b = h.band[v]!;
    const key = b === 'ring' ? 'ring' : b === 'mountain' ? `m${h.height[v]}` : `v${Math.round(r)}`;
    const list = rows.get(key);
    if (list === undefined) rows.set(key, [v]); else list.push(v);
  }
  const target = new Map<number, { angle: number; radius: number }>();
  for (const list of rows.values()) {
    list.sort((a, b) => dir.angle[a] - dir.angle[b] || a - b);
    const base = list.reduce((sum, v) => sum + radiusFor.get(v)!, 0) / list.length;
    const capacity = Math.max(1, Math.floor(0.86 * Math.PI * base));
    const parts = Math.max(1, Math.ceil(list.length / capacity));
    for (let part = 0; part < parts; part += 1) {
      const mine = list.filter((_, i) => i % parts === part);
      const radius = base + part * 0.95;
      const gap = (1.04 / radius) * (180 / Math.PI);
      const angles = spreadAngles(mine.map((v) => dir.angle[v]), gap, 3, 177);
      mine.forEach((v, i) => target.set(v, { angle: angles[i], radius: part === 0 ? radiusFor.get(v)! : radius }));
    }
  }
  const placing: Placing[] = [];
  for (const v of single) {
    const t = target.get(v)!;
    placing.push({ key: input.ids[v], angle: t.angle, radius: t.radius });
  }
  const aggFields = [...aggs.values()].sort((a, b) => a.area - b.area || a.cls.localeCompare(b.cls));
  const aggHeight = (agg: Agg): number => {
    const open = agg.ids.filter((v) => h.band[v] === 'ring' || h.band[v] === 'mountain');
    if (open.length === 0) return Math.max(-1, ...agg.ids.map((v) => h.height[v]));
    return Math.min(...open.map((v) => h.height[v]));
  };
  for (const agg of aggFields) {
    const s = dir.sectors[agg.area];
    const mid = s === undefined ? 90 : (s.from + s.to) / 2;
    const height = aggHeight(agg);
    const radius = agg.cls === 'land' ? Math.max(2, ring - 1.4) : agg.cls === 'ring' ? ring + 0.9 : Math.min(ring + (narrow ? 3.6 : 5.5), radiusOf(Math.max(1, height), ring, narrow) + 0.9);
    placing.push({ key: agg.key, angle: mid, radius });
  }
  /* Ausserhalb des Fokus: an den Rändern des Halbkreises. */
  const edgeItems = dir.outside.map((o, i, all) => {
    const left = all.filter((x) => x.side === 'left');
    const right = all.filter((x) => x.side === 'right');
    const list = o.side === 'left' ? left : right;
    const at = list.indexOf(o);
    return { o, key: `edge:${o.value}`, angle: o.side === 'left' ? 4 + at * 7 : 176 - at * 7, radius: ring + 0.8, i };
  });
  for (const e of edgeItems) placing.push({ key: e.key, angle: e.angle, radius: e.radius });
  const placed = placeAll(placing);

  for (const v of single) {
    const at = placed.get(input.ids[v]);
    if (at === undefined) continue;
    fields.push({
      key: input.ids[v], kind: 'entry', id: input.ids[v], label: label(v), count: 1, height: h.height[v], missing: h.missing[v], band: h.band[v]!,
      locked: h.locked[v] === 1, subject: dir.subject[v], area: dir.area[v], q: at.q, r: at.r, x: at.x, y: at.y, angle: dir.angle[v],
      route: onRoute[v], next: nextStep[v] === 1, goal: v === goalIndex, due: h.band[v] === 'due' ? 1 : 0, ring: h.band[v] === 'ring' ? 1 : 0, edge: false,
      ...(options.marks?.[input.ids[v]] === undefined ? {} : { mark: options.marks[input.ids[v]] })
    });
  }
  for (const agg of aggFields) {
    const at = placed.get(agg.key);
    if (at === undefined) continue;
    const height = aggHeight(agg);
    const band: LsBand = agg.cls === 'land' ? (agg.ids.some((v) => h.band[v] === 'due') ? 'due' : 'known') : agg.cls === 'ring' ? 'ring' : 'mountain';
    const s = dir.sectors[agg.area];
    fields.push({
      key: agg.key, kind: 'area', value: agg.value, label: agg.label, count: agg.ids.length, height, missing: Math.max(0, height), band,
      locked: false, subject: s?.subject ?? -1, area: agg.area, q: at.q, r: at.r, x: at.x, y: at.y, angle: s === undefined ? 90 : (s.from + s.to) / 2,
      route: agg.ids.filter((v) => onRoute[v] === 1 || v === goalIndex).length, next: agg.ids.some((v) => nextStep[v] === 1), goal: goalIndex !== undefined && agg.ids.includes(goalIndex),
      due: agg.ids.filter((v) => h.band[v] === 'due').length, ring: agg.ids.filter((v) => h.band[v] === 'ring').length, edge: false, ids: agg.ids.map((v) => input.ids[v])
    });
  }
  for (const e of edgeItems) {
    const at = placed.get(e.key);
    if (at === undefined) continue;
    const open = e.o.ids.filter((v) => h.band[v] === 'ring' || h.band[v] === 'mountain');
    const height = open.length === 0 ? -1 : Math.min(...open.map((v) => h.height[v]));
    fields.push({
      key: e.key, kind: 'area', value: e.o.value, label: e.o.label, count: e.o.ids.length, height, missing: Math.max(0, height),
      band: open.length === 0 ? 'known' : height === 0 ? 'ring' : 'mountain', locked: false, subject: e.o.subject, area: -1, q: at.q, r: at.r, x: at.x, y: at.y, angle: e.angle,
      route: e.o.ids.filter((v) => onRoute[v] === 1 || v === goalIndex).length, next: e.o.ids.some((v) => nextStep[v] === 1), goal: goalIndex !== undefined && e.o.ids.includes(goalIndex),
      due: e.o.ids.filter((v) => h.band[v] === 'due').length, ring: e.o.ids.filter((v) => h.band[v] === 'ring').length, edge: true, ids: e.o.ids.map((v) => input.ids[v])
    });
  }
  const bands = new Uint8Array(n);
  for (let v = 0; v < n; v += 1) bands[v] = h.band[v] === null ? 0 : BAND_CODE.indexOf(h.band[v]);
  return { fields, sectors: dir.sectors, path: dir.path, goal, counts, total: inFocus.length, ring, notes, heights: h.height.slice(), bands, locked: h.locked.slice() };
}

/* -- Der Motor: Graph, Stand, Gestalt — getrennt, damit jeder Teil nur rechnet, wenn er sich ändert ---------------- */

export interface LsRun {
  readonly layout: LsLayout;
  /** Millisekunden: Graph (nur beim ersten Mal oder nach einer Änderung), Höhen, Gestalt. */
  readonly ms: { readonly graph: number; readonly heights: number; readonly layout: number };
}

/**
 * DER MOTOR EINES KRAJOBRAZ — im Worker oder (ohne Worker) im Hauptfaden. `setInput` baut den Graphen, `setState` die
 * Höhen (nach jeder Antwort — die Bitmengen bleiben), `layout` die Felder. Für spätere Teile: `positionOf`, `routeTo`,
 * `heightOf`.
 */
export class LandscapeEngine {
  private input: LsInput | null = null;
  private graph: LsGraph | null = null;
  private heights: LsHeights | null = null;
  private last: LsLayout | null = null;
  private graphMs = 0;
  private heightsMs = 0;
  /** Die Richtung hängt nur vom Graphen und vom Fokus ab — einmal je Fokus. */
  private directions = new Map<string, Direction>();

  setInput(input: LsInput, edgeFilter?: (from: number, to: number) => boolean): void {
    const t = now();
    this.input = input;
    this.graph = buildGraph(input, edgeFilter);
    this.heights = null;
    this.directions.clear();
    this.graphMs = now() - t;
  }

  setState(state: LsState): void {
    if (this.graph === null) throw new Error('Krajobraz: najpierw graf.');
    const t = now();
    this.heights = heightsOf(this.graph, state);
    this.heightsMs = now() - t;
  }

  layout(options: LsOptions = {}): LsRun {
    if (this.input === null || this.graph === null || this.heights === null) throw new Error('Krajobraz: brak grafu albo stanu.');
    const t = now();
    const focusKey = JSON.stringify(options.focus ?? []);
    let dir = this.directions.get(focusKey);
    if (dir === undefined) {
      dir = directionOf(this.input, this.graph, options.focus ?? []);
      if (this.directions.size > 24) this.directions.clear();
      this.directions.set(focusKey, dir);
    }
    const layout = layoutOf(this.input, this.graph, this.heights, options, dir);
    this.last = layout;
    const ms = { graph: this.graphMs, heights: this.heightsMs, layout: now() - t };
    this.graphMs = 0;
    return { layout, ms };
  }

  /** Der Weg zu einem Eintrag (Kennungen je Schritt). */
  routeTo(id: string): { readonly steps: readonly (readonly string[])[]; readonly next: readonly string[]; readonly open: boolean } | null {
    if (this.input === null || this.graph === null || this.heights === null) return null;
    const v = this.input.ids.indexOf(id);
    if (v < 0) return null;
    const r = routeOf(this.graph, this.heights, this.input.needs, this.input.labels, v);
    return { steps: r.steps.map((s) => s.map((x) => this.input!.ids[x])), next: r.next.map((x) => this.input!.ids[x]), open: r.goalOpen };
  }

  /** Wo ein Eintrag (oder sein Bereich) gerade steht — für Avatare und Führungen. */
  positionOf(id: string): { readonly x: number; readonly y: number; readonly height: number; readonly field: string } | null {
    const f = this.last?.fields.find((x) => x.id === id) ?? null;
    return f === null ? null : { x: f.x, y: f.y, height: f.height, field: f.key };
  }

  heightOf(id: string): number | null {
    if (this.input === null || this.heights === null) return null;
    const v = this.input.ids.indexOf(id);
    return v < 0 ? null : this.heights.height[v];
  }
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
