/**
 * 2026-11-03 — DER KRAJOBRAZ EINER BAZA WIEDZY (documentation/COGITA-WORLD.md, Task 2): jeder Widok als persönliche
 * Landschaft des Betrachters. Rein gerechnet, ohne Oberfläche (gezeichnet von `LandscapeView.tsx`, im Worker
 * `landscape.worker.ts`, geprüft in `scripts/app-landscape-check.mjs`).
 *
 * <b>Eingänge — und nichts sonst</b>: die Einträge des Widoku, die Reihenfolge des Lernens (dieselben Kanten wie
 * `#level`, `learning` und `rel: "before"`: Felder mit `prerequisite`, `needs` der Pytania, die Zależności der
 * Ustawienia — hier ROH, mit Kreisen), die Struktur nach oben (für Bereiche ohne Gruppierung), die Gruppierung des
 * Widoku als Richtung, die Kenntnis des Betrachters (`knowing.ts`, Bänder aus `logic.ts`).
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
 * <b>Die Richtung</b> ist der Winkel: die Werte der Gruppierung teilen die 180° nach der Zahl ihrer Einträge — in der
 * Reihenfolge des Autors, wenn er eine gibt (`sort` der Achse, die Ebenen), sonst so, dass Werte, die oft zusammen
 * vorkommen oder durch Voraussetzungen verbunden sind, Nachbarn werden. Ein Eintrag steht im Mittel seiner Werte; einer
 * ohne Wert in der Mitte beim Lernenden (nie ein erfundener Bereich). Ohne Gruppierung sind die Bereiche die Teilbäume
 * unter den allgemeinsten Einträgen (Struktur nach oben, sonst die Reihenfolge des Lernens), benannt nach ihrem
 * obersten Eintrag (`treeAreas`).
 *
 * <b>Die Gestalt</b>: ein Halbkreis vor dem Lernenden (unten in der Mitte, in seiner eigenen Zelle) — das Tal um ihn,
 * der Ring davor, eine leere Reihe, die Berge dahinter. Gestellt wird in REIHEN eines Sechseckrasters (alle Zellen mit
 * demselben gerundeten Abstand zum Lernenden): das Gelernte im Tal (je verblasster, desto weiter draussen), der Ring auf
 * genau EINER Reihe über den ganzen Halbkreis (zu viele: eine zweite), die Berge nach ihrer Höhe weiter aussen. In
 * jeder Reihe der Reihe nach wie die Winkel — ordnungstreu und so nah wie möglich (`matchInOrder`): die Bereiche
 * bleiben zusammen und in ihrer Folge, nie zwei Felder in einer Zelle. Gezeichnet steht jede Reihe gleich hoch, nach
 * aussen steigend; eine Fläche, die die Zelle dahinter überdecken würde, wird niedriger gezeichnet (`lift`).
 * Deterministisch: derselbe Stand gibt dasselbe Bild.
 *
 * <b>Budget und Fokus</b>: höchstens `budget` einzelne Felder, nach Bändern geteilt (`bands`, Anteile): der Ring
 * höchstens die Hälfte, was zu wiederholen ist und das Tal mindestens ein Stück, die Berge den Rest; was übrig bleibt,
 * geht an das Zu-Wiederholende, den Ring, die Berge, das Tal. Ein Bereich, dessen Ring (oder dessen Tal) nicht mehr
 * passt, wird EIN Feld mit seiner Zahl („Ruch · 23 do nauki", „Ruch · 12 umiem"), seine Berge, die nicht einzeln
 * stehen, ebenso; ein Klick öffnet ihn (Zoom in die Werte, in jeder Tiefe; die Höhen bleiben global). Das Ziel, der
 * nächste Schritt und der Ring auf dem Weg dorthin stehen immer einzeln.
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
}

/**
 * 2026-11-03 — WIE SICH DAS BUDGET AUF DIE BÄNDER TEILT (Anteile 0–1): `ring` höchstens (sonst sammeln sich Bereiche),
 * `due` und `known` mindestens (das Tal bleibt immer sichtbar); die Berge bekommen den Rest. Mehr als 1 zusammen wird
 * verhältnisgleich gekürzt.
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
  /** Der Fokus: Werte (ihre Kennungen) — leer: alles. */
  readonly focus?: readonly string[];
  /** Das Ziel (eine Kennung) — sein Weg wird markiert. */
  readonly goal?: string | null;
  /** 2026-11-03 — für später: fremde Markierungen auf Feldern (Avatare, eine Führung), je Eintrag ein Wort. */
  readonly marks?: Readonly<Record<string, string>>;
  /** Schmal (ein Telefon): weniger Reihen, damit der Halbkreis in die Breite passt. */
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
/** So viel ihrer Zelle füllt eine Kachel (der Rest ist Fuge — auch der Spielraum für die Höhen). */
export const LS_SHRINK = 0.86;

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

export interface Direction {
  /** Je Knoten im Fokus sein Winkel — NaN: ausserhalb des Fokus. */
  readonly angle: Float64Array;
  /** Je Knoten sein Bereich (Index in `sectors`) — −1: ausserhalb oder in der Mitte. */
  readonly area: Int32Array;
  /** 2026-11-03 — im Fokus, aber ohne Wert: steht in der Mitte beim Lernenden (Winkel 90°, kein Bereich). */
  readonly centre: Uint8Array;
  /**
   * 2026-11-03 — je Knoten der Bereich, zu dem er GEHÖRT (von seinen Werten der, dessen Bogen seinem Winkel am nächsten
   * liegt): darin sammelt er sich, wenn er nicht einzeln steht — ein Bereichsfeld hält nur, was beim Öffnen auch da ist.
   * Einzeln steht er nach seinem Winkel (ein Wątek zwischen seinen Bereichen). −1: ausserhalb oder in der Mitte.
   */
  readonly home: Int32Array;
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
 * DIE RICHTUNG: die Werte unter dem Fokus teilen die 180° nach der Zahl ihrer Einträge — in der Reihenfolge des Autors,
 * wenn es eine gibt (`sorted`), sonst nach Gemeinsamem; jeder Wert bekommt rekursiv seinen Bogen im Bogen darüber. Ein
 * Eintrag hängt an seinen TIEFSTEN Werten (ein Wert, der über einem anderen seiner Werte liegt, zählt nicht — eine Idee
 * unter ihrer Lektion steht in ihrem eigenen Bogen, nicht in der Mitte der Lektion) und steht im Mittel ihrer Mitten.
 * Ohne Wert: im Ganzen in der Mitte (`centre`), beim Zoomen nicht im Bild. Ohne Werte überhaupt: die Bereiche aus dem
 * Baum (`treeAreas`), ohne Baum ein Bereich ohne Namen.
 */
export function directionOf(input: LsInput, g: LsGraph, focusIds: readonly string[]): Direction {
  const n = input.ids.length;
  const angle = new Float64Array(n).fill(Number.NaN);
  const area = new Int32Array(n).fill(-1);
  const centre = new Uint8Array(n);
  const home = new Int32Array(n).fill(-1);
  const subject = new Int32Array(n).fill(-1);
  const shown = (v: number) => input.inView[v] === true && input.learnable[v] === true;
  let values = input.values;
  let memberOf = input.memberOf;
  let sorted = input.sorted === true;
  if (values.length === 0) {
    const tree = treeAreas(input, g, shown);
    if (tree === null) return flatDirection(input, g, shown, angle, area, centre, subject, home);
    values = tree.values;
    memberOf = tree.memberOf;
    sorted = true;
  }
  const V = values.length;

  /* Der Baum der Werte (ein Wert, der über sich selbst läge, hängt oben); Kinder in der Reihenfolge des Autors. */
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
  const kids: number[][] = Array.from({ length: V + 1 }, () => []);
  for (let x = 0; x < V; x += 1) kids[parent[x]].push(x);
  for (const list of kids) list.sort((a, b) => rankOf(a) - rankOf(b) || a - b);
  /** Die Kette von oben bis zu x (ohne die Wurzel). */
  const chainTo = (x: number): number[] => { const out: number[] = []; for (let y = x, guard = 0; y !== ROOT && guard < 256; y = parent[y], guard += 1) out.push(y); return out.reverse(); };
  const isAncestor = (a: number, b: number): boolean => { for (let y = parent[b], guard = 0; y !== ROOT && guard < 256; y = parent[y], guard += 1) if (y === a) return true; return false; };

  /* Die tiefsten Werte jedes Eintrags. */
  const deepest: (readonly number[])[] = new Array(n);
  const own: number[][] = Array.from({ length: V + 1 }, () => []);
  for (let v = 0; v < n; v += 1) {
    if (!shown(v)) { deepest[v] = []; continue; }
    const list = [...new Set((memberOf[v] ?? []).filter((x) => x >= 0 && x < V))];
    const deep = list.filter((x) => !list.some((y) => y !== x && isAncestor(x, y)));
    deepest[v] = deep;
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
  /* Die Reihenfolge des Autors gilt (`sort`); nur ohne sie ordnet das Gemeinsame. */
  const orderOf = (items: readonly number[]): number[] => (sorted || items.length > 160 ? [...items].sort((a, b) => rankOf(a) - rankOf(b) || a - b) : seriate(items, affinityAmong(items), rankOf));

  /* Die Farbe: die Werte auf der Ebene, auf der sich das Ganze zuerst teilt — in der Reihenfolge des Autors (stabil beim Zoomen). */
  let top = ROOT;
  for (let guard = 0; guard < 64; guard += 1) { const only = liveKids(top); if (only.length !== 1 || own[top].length > 0) break; top = only[0]; }
  const subjects = liveKids(top);
  const subjectOfValue = new Int32Array(V + 1).fill(-1);
  for (let x = 0; x < V; x += 1) for (const y of chainTo(x)) { const i = subjects.indexOf(y); if (i >= 0) { subjectOfValue[x] = i; break; } }

  /* Der Fokus: die genannten Werte, sonst oben; ein Fokus mit nur einem lebenden Kind (und ohne eigene Einträge) steigt hinab. */
  const byId = new Map(values.map((x, i) => [x.id, i] as const));
  let focus = [...new Set(focusIds.map((id) => byId.get(id)).filter((x): x is number => x !== undefined && live(x)))];
  if (focus.length === 0) focus = [ROOT];
  for (let guard = 0; guard < 64 && focus.length === 1; guard += 1) {
    const only = liveKids(focus[0]);
    if (only.length !== 1 || own[focus[0]].length > 0 || liveKids(only[0]).length === 0) break;
    focus = [only[0]];
  }
  const atRoot = focus.length === 1 && focus[0] === ROOT;
  const path = focus.length === 1 ? (atRoot ? [] : chainTo(focus[0]).map((y) => ({ value: values[y].id, label: values[y].label })))
    : focus.map((x) => ({ value: values[x].id, label: values[x].label }));

  /* Die Bereiche: die lebenden Kinder der Werte im Fokus (ein Blatt im Fokus ist selbst sein Bereich). */
  const items = [...new Set(focus.flatMap((f) => (liveKids(f).length > 0 ? liveKids(f) : f === ROOT ? [] : [f])))];
  const ordered = orderOf(items);
  const weightOf = (x: number) => Math.max(0.35, sub[x]);
  const total = ordered.reduce((s, x) => s + weightOf(x), 0) || 1;
  const span = new Map<number, [number, number]>();
  const lay = (list: readonly number[], from: number, to: number) => {
    if (list.length === 0) return;
    const ord = orderOf(list);
    const sum = ord.reduce((s, x) => s + weightOf(x), 0) || 1;
    let at = from;
    for (const x of ord) {
      const w = ((to - from) * weightOf(x)) / sum;
      span.set(x, [at, at + w]);
      lay(liveKids(x), at, at + w);
      at += w;
    }
  };
  const sectors: LsSector[] = [];
  let at = 0;
  for (const x of ordered) {
    const w = (180 * weightOf(x)) / total;
    span.set(x, [at, at + w]);
    lay(liveKids(x), at, at + w);
    sectors.push({ value: values[x].id, label: values[x].label, from: at, to: at + w, subject: subjectOfValue[x], count: sub[x], deeper: liveKids(x).length > 0 });
    at += w;
  }
  /* Ein Wert im Fokus mit eigenen Einträgen: sein Bogen ist der seiner Bereiche (die Einträge stehen in der Mitte). */
  for (const f of focus) {
    if (f === ROOT || span.has(f)) continue;
    const inner = liveKids(f).map((x) => span.get(x)).filter((s): s is [number, number] => s !== undefined);
    if (inner.length > 0) span.set(f, [Math.min(...inner.map((s) => s[0])), Math.max(...inner.map((s) => s[1]))]);
  }

  /* Der Bereich (Sektor) eines Wertes: er selbst oder der Vorfahr, der im Fokus ein Bereich ist — −1: keiner. */
  const sectorAt = new Map(ordered.map((x, i) => [x, i] as const));
  const sectorOfValue = (x: number): number => {
    for (let y = x, guard = 0; y !== ROOT && guard < 256; y = parent[y], guard += 1) { const i = sectorAt.get(y); if (i !== undefined) return i; }
    return -1;
  };
  /* Je Eintrag: seine tiefsten Werte, die im Fokus liegen → Winkel; ohne Wert in die Mitte; sonst ausserhalb, am Rand. */
  const focusChain = atRoot ? [] : chainTo(focus[0]);
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
    if (deep.length === 0) {
      /* Ohne Wert: im Ganzen in der Mitte, beim Lernenden; in einem Zoom nicht im Bild. */
      if (atRoot) { angle[v] = 90; centre[v] = 1; }
      continue;
    }
    const inside = deep.filter((x) => span.has(x) || focus.some((f) => f !== ROOT && isAncestor(f, x)));
    subject[v] = subjectOfValue[inside[0] ?? deep[0]];
    if (inside.length > 0) {
      let sum = 0;
      let k = 0;
      for (const x of inside) { const s = span.get(x); if (s !== undefined) { sum += (s[0] + s[1]) / 2; k += 1; } }
      angle[v] = k === 0 ? 90 : sum / k;
      const a = angle[v];
      let hit = sectors.findIndex((s) => s.from <= a + 1e-9 && a <= s.to + 1e-9);
      if (hit < 0) hit = sectors.reduce((best, s, i) => (Math.abs((s.from + s.to) / 2 - a) < Math.abs((sectors[best].from + sectors[best].to) / 2 - a) ? i : best), 0);
      area[v] = hit;
      /* Sein Bereich (für das Sammeln): von den Bereichen seiner Werte der nächste. */
      let best = -1;
      let bestD = Infinity;
      for (const x of inside) {
        const sec = sectorOfValue(x);
        if (sec < 0) continue;
        const d = Math.abs((sectors[sec].from + sectors[sec].to) / 2 - a);
        if (d < bestD - 1e-9) { bestD = d; best = sec; }
      }
      home[v] = best >= 0 ? best : hit;
    } else {
      const { group, side } = sideOf(deep[0]);
      const o = outsideMap.get(group);
      if (o === undefined) outsideMap.set(group, { side, ids: [v] }); else o.ids.push(v);
    }
  }
  const outside = [...outsideMap.entries()].map(([x, o]) => ({ value: values[x].id, label: values[x].label, side: o.side, ids: o.ids, subject: subjectOfValue[x] }))
    .sort((a, b) => (a.side === b.side ? 0 : a.side === 'left' ? -1 : 1) || a.label.localeCompare(b.label, 'pl', { numeric: true }));
  return { angle, area, centre, home, sectors, path, outside, subject };
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

/** Weder Werte noch ein Baum: EIN Bereich ohne Namen, die Einträge in der Reihenfolge des Lernens (dann nach dem Namen). */
function flatDirection(input: LsInput, g: LsGraph, shown: (v: number) => boolean, angle: Float64Array, area: Int32Array, centre: Uint8Array, subject: Int32Array, home: Int32Array): Direction {
  const list: number[] = [];
  for (let v = 0; v < input.ids.length; v += 1) if (shown(v)) list.push(v);
  const label = (v: number) => input.labels[v] ?? '';
  list.sort((a, b) => g.rank[g.comp[a]] - g.rank[g.comp[b]] || label(a).localeCompare(label(b), 'pl', { numeric: true }) || a - b);
  const m = list.length;
  list.forEach((v, i) => { angle[v] = (180 * (i + 0.5)) / Math.max(1, m); area[v] = 0; home[v] = 0; });
  return { angle, area, centre, home, sectors: [{ value: '#', label: '', from: 0, to: 180, subject: -1, count: m, deeper: false }], path: [], outside: [], subject };
}

/* -- Die Felder und ihr Platz ------------------------------------------------------------------------------------- */

export interface LsField {
  /** Eintrag: seine Kennung; Bereich: `area:<wert>:<art>`; ausserhalb des Fokus: `edge:<wert>`. */
  readonly key: string;
  readonly kind: 'entry' | 'area';
  /** Der Eintrag (bei `entry`). */
  readonly id?: string;
  /** Der Wert, in den ein Klick zoomt (bei `area`; '' in der Mitte). */
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
  /** Der Bereich (Index in `sectors`), −1 ausserhalb des Fokus oder in der Mitte. */
  readonly area: number;
  /** Das Sechseck (axial, flache Oberseite). */
  readonly q: number;
  readonly r: number;
  /** Der Platz am Boden (Einheiten: Abstand zweier Nachbarn). */
  readonly x: number;
  readonly y: number;
  /** Die Richtung, in die er gehört (Grad; die Zelle kann daneben liegen). */
  readonly angle: number;
  /** 2026-11-03 — die Reihe (gerundeter Abstand der Zelle zum Lernenden). */
  readonly row: number;
  /** 2026-11-03 — wie hoch die Fläche gezeichnet wird (Kacheln; im Tal negativ). */
  readonly lift: number;
  /** Wie viele Schritte des Weges zum Ziel darin liegen. */
  readonly route: number;
  readonly next: boolean;
  readonly goal: boolean;
  /** Bei einem Bereich: wie viele davon zu wiederholen sind. */
  readonly due: number;
  /** Bei einem Bereich: wie viele davon jetzt zu lernen sind. */
  readonly ring: number;
  /** 2026-11-03 — bei einem Bereich: wie viele davon sitzen (znane). */
  readonly known: number;
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
  /** Die Reihe des Rings (für die Zeichnung). */
  readonly ring: number;
  /** 2026-11-03 — die Reihen: das Tal bis `valley`, der Ring (eine oder zwei), die Berge ab `mountain`. */
  readonly rows: { readonly valley: number; readonly ring: readonly number[]; readonly mountain: number };
  /** 2026-11-03 — der Lernende in seiner Zelle (0, 0): wie tief sie gezeichnet wird. */
  readonly me: { readonly lift: number };
  /** Was die Ansicht sagen sollte (keine Reihenfolge des Lernens, Kreise …). */
  readonly notes: readonly string[];
  /** Je Knoten (wie `LsInput.ids`): Höhe, Band (0 ohne Karten, 1 znane, 2 do powtórki, 3 Ring, 4 Berg), Sperre — für Suche, Wege, Listen. */
  readonly heights: Float64Array;
  readonly bands: Uint8Array;
  readonly locked: Uint8Array;
}

export const BAND_CODE: readonly (LsBand | null)[] = [null, 'known', 'due', 'ring', 'mountain'];

const SQ3 = Math.sqrt(3);
/** Die Mitte eines Sechsecks (flache Oberseite, Nachbarn im Abstand 1): x = √3/2·q, y = r + q/2. */
export const hexCenter = (q: number, r: number): { x: number; y: number } => ({ x: (SQ3 / 2) * q, y: r + q / 2 });

interface Cell {
  readonly q: number;
  readonly r: number;
  readonly x: number;
  readonly y: number;
  /** Grad: 0 links, 180 rechts. */
  readonly angle: number;
}

/** So viele Reihen kennt das Raster (mehr braucht kein Bild). */
const ROWS = 48;
let cellRows: Cell[][] | null = null;
/** DIE ZELLEN JE REIHE (gerundeter Abstand zum Lernenden), vor ihm (y ≥ 0,45), nach dem Winkel geordnet — einmal gerechnet. */
function rowCells(k: number): readonly Cell[] {
  if (cellRows === null) {
    const rows: Cell[][] = Array.from({ length: ROWS + 1 }, () => []);
    const R = ROWS + 2;
    for (let q = -R; q <= R; q += 1) {
      for (let r = -2 * R; r <= 2 * R; r += 1) {
        const c = hexCenter(q, r);
        if (c.y < 0.45) continue;
        const k = Math.round(Math.hypot(c.x, c.y));
        if (k < 1 || k > ROWS) continue;
        rows[k].push({ q, r, x: c.x, y: c.y, angle: (Math.atan2(c.y, -c.x) * 180) / Math.PI });
      }
    }
    for (const list of rows) list.sort((a, b) => a.angle - b.angle || a.q - b.q);
    cellRows = rows;
  }
  return cellRows[Math.max(0, Math.min(ROWS, k))];
}

/** Wie viele Zellen eine Reihe hat. */
export const rowSize = (k: number): number => rowCells(k).length;

/**
 * ORDNUNGSTREU IN EINE REIHE: Felder (nach Winkel geordnet) in Zellen (nach Winkel geordnet), die i-ten nie hinter die
 * j-ten — so viele wie möglich, dann so nah an ihren Winkeln wie möglich; wer nicht passt, wartet (−1) und kommt eine
 * Reihe weiter. Bei zu vielen fallen zuerst die mit dem höheren Vorrang-Wert heraus (`prio`, je Stufe wie 20°).
 */
export function matchInOrder(targets: readonly number[], prio: readonly number[], cells: readonly number[], allowed?: (i: number, j: number) => boolean): number[] {
  const n = targets.length;
  const m = cells.length;
  const W = m + 1;
  const BIG = 1e6;
  const best = new Float64Array((n + 1) * W);
  const how = new Uint8Array((n + 1) * W);
  for (let i = 0; i <= n; i += 1) {
    for (let j = 0; j <= m; j += 1) {
      if (i === 0 && j === 0) continue;
      let v = Number.NEGATIVE_INFINITY;
      let w = 0;
      if (i > 0) { const x = best[(i - 1) * W + j]; if (x > v) { v = x; w = 0; } }
      if (j > 0) { const x = best[i * W + j - 1]; if (x > v) { v = x; w = 1; } }
      if (i > 0 && j > 0 && (allowed === undefined || allowed(i - 1, j - 1))) {
        const x = best[(i - 1) * W + j - 1] + BIG - Math.abs(targets[i - 1] - cells[j - 1]) - (prio[i - 1] ?? 0) * 20;
        if (x > v) { v = x; w = 2; }
      }
      best[i * W + j] = v;
      how[i * W + j] = w;
    }
  }
  const out = new Array<number>(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const w = how[i * W + j];
    if (w === 2) { out[i - 1] = j - 1; i -= 1; j -= 1; } else if (w === 0) i -= 1; else j -= 1;
  }
  return out;
}

/* -- Höhen der Zeichnung: nie eine Fläche über die Zelle dahinter ------------------------------------------------ */

/** Die Kachelfläche (flache Oberseite) auf dem Schirm, in Einheiten: Mitte (cx, cy), y nach unten. */
const faceAt = (cx: number, cy: number): [number, number][] => {
  const C = LS_SHRINK / SQ3;
  return [0, 60, 120, 180, 240, 300].map((a) => [cx + Math.cos((a * Math.PI) / 180) * C, cy - Math.sin((a * Math.PI) / 180) * C * LS_FORE] as [number, number]);
};

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

/**
 * Die Zellen dahinter, die eine höhere Fläche überdecken könnte (axial), und wie viel höher sie sein darf (Kacheln):
 * gemessen an den Flächen selbst, mit einem Fünftel Reserve (Rundung auf Pixel).
 */
const BEHIND: readonly (readonly [number, number, number])[] = (() => {
  const out: [number, number, number][] = [];
  for (const [dq, dr] of [[0, 1], [1, 0], [-1, 1], [0, 2], [1, 1], [-1, 2]] as const) {
    const b = hexCenter(dq, dr);
    const back = faceAt(b.x, -b.y * LS_FORE);
    let lo = 0;
    let hi = 6;
    for (let step = 0; step < 40; step += 1) {
      const mid = (lo + hi) / 2;
      if (polygonsOverlap(faceAt(0, -mid * LS_TILE), back)) hi = mid; else lo = mid;
    }
    out.push([dq, dr, lo * 0.8]);
  }
  return out;
})();

/* -- Die Gestalt ---------------------------------------------------------------------------------------------- */

/** Die Anteile der Bänder (0–1), zusammen höchstens 1. */
export function bandShares(raw?: Partial<LsBands>): LsBands {
  const pick = (x: unknown, fallback: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : fallback);
  const s = { ring: pick(raw?.ring, LS_BANDS.ring), due: pick(raw?.due, LS_BANDS.due), known: pick(raw?.known, LS_BANDS.known) };
  const sum = s.ring + s.due + s.known;
  return sum <= 1 ? s : { ring: s.ring / sum, due: s.due / sum, known: s.known / sum };
}

/** Wie weit hinter den ersten Bergen eine Höhe steht (Reihen): 1 → 0, 2 → 1, … ab 5 verdichtet, gedeckelt. */
const mountainSpread = (height: number, narrow: boolean): number => {
  const h = Math.max(1, height);
  const g = h <= 4 ? h - 1 : 3 + Math.log2(h - 3);
  return Math.min(narrow ? 4 : 7, Math.round(g));
};

type Region = 'valley' | 'ring' | 'mountain';

interface Item {
  readonly key: string;
  /** Die Richtung (Grad). */
  readonly angle: number;
  /** Die Reihe, in die es gehört (weiter innen nie). */
  readonly want: number;
  /** Wer zuerst eine Zelle bekommt (kleiner zuerst). */
  readonly prio: number;
  readonly region: Region;
  /** Der Bogen seines Bereichs (Grad) — dort bleibt es, solange Platz ist. */
  readonly arc: readonly [number, number];
}

/** Liegt eine Zelle der Reihe k im Bogen — mit einer halben Zellbreite Spiel und `widen` ganzen Zellen mehr? */
const inArc = (angle: number, arc: readonly [number, number], k: number, widen = 0): boolean => {
  const slack = ((0.5 + widen) * 57.3) / Math.max(1, k);
  return angle >= arc[0] - slack && angle <= arc[1] + slack;
};

/** Die Reihenfolge der Felder in einer Reihe: nach der Richtung, dann dem Vorrang, dann dem Schlüssel. */
const itemOrder = (a: Pick<Item, 'angle' | 'prio' | 'key'>, b: Pick<Item, 'angle' | 'prio' | 'key'>): number =>
  a.angle - b.angle || a.prio - b.prio || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/**
 * DAS STELLEN IN REIHEN (2026-11-03). In jeder Reihe stehen die Felder in der Reihenfolge ihrer Richtung — über ALLE
 * Durchgänge: wer später kommt, kommt zwischen die schon stehenden Felder, zwischen die er gehört. Je Durchgang Reihe für
 * Reihe von innen; wer hier stehen darf (`want` ≤ Reihe, ausser mit `anyRow`), bekommt ordnungstreu eine freie Zelle im
 * Bogen seines Bereichs, `widen` Zellen weiter (∞: wo auch immer zwischen seinen Nachbarn). `loose` lässt die Reihenfolge
 * fallen — der allerletzte Ausweg, damit kein Feld verloren geht. Zurück: wer in diesem Durchgang nicht unterkam.
 */
class RowPlacer {
  private readonly standing = new Map<number, { readonly item: Item; readonly angle: number }[]>();

  constructor(private readonly taken: Set<string>, private readonly out: Map<string, { cell: Cell; row: number }>) {}

  place(items: readonly Item[], rows: readonly number[], opt: { readonly widen?: number; readonly anyRow?: boolean; readonly loose?: boolean } = {}): Item[] {
    const widen = opt.widen ?? 0;
    let pending = [...items];
    for (const k of rows) {
      if (pending.length === 0) break;
      const here = pending.filter((it) => opt.anyRow === true || it.want <= k).sort(itemOrder);
      if (here.length === 0) continue;
      const cells = rowCells(k).filter((c) => !this.taken.has(`${c.q},${c.r}`));
      if (cells.length === 0) continue;
      const row = this.standing.get(k) ?? [];
      /* Das Fenster jedes Feldes: zwischen den Zellen der stehenden Nachbarn davor und danach. */
      const at = (it: Item): number => {
        let a = 0;
        let b = row.length;
        while (a < b) { const m = (a + b) >> 1; if (itemOrder(row[m].item, it) < 0) a = m + 1; else b = m; }
        return a;
      };
      const lo = here.map((it) => { const i = at(it); return opt.loose === true || i === 0 ? -Infinity : row[i - 1].angle; });
      const hi = here.map((it) => { const i = at(it); return opt.loose === true || i === row.length ? Infinity : row[i].angle; });
      const got = matchInOrder(here.map((it) => it.angle), here.map((it) => it.prio), cells.map((c) => c.angle), (i, j) => {
        const angle = cells[j].angle;
        return angle > lo[i] && angle < hi[i] && (widen === Infinity || inArc(angle, here[i].arc, k, widen));
      });
      const placed = new Set<string>();
      got.forEach((ci, i) => {
        if (ci < 0) return;
        const c = cells[ci];
        this.taken.add(`${c.q},${c.r}`);
        this.out.set(here[i].key, { cell: c, row: k });
        placed.add(here[i].key);
        row.splice(at(here[i]), 0, { item: here[i], angle: c.angle });
      });
      this.standing.set(k, row);
      pending = pending.filter((it) => !placed.has(it.key));
    }
    return pending;
  }
}

/**
 * DIE GESTALT EINES STANDES: welche Einträge einzeln stehen (das Budget nach Bändern), was sich zu Bereichsfeldern
 * sammelt, in welcher Reihe und Zelle jedes Feld steht, wie hoch es gezeichnet wird — und der Weg zum Ziel.
 */
export function layoutOf(input: LsInput, g: LsGraph, h: LsHeights, options: LsOptions = {}, known?: Direction): LsLayout {
  const budget = Math.max(6, Math.min(400, Math.round(options.budget ?? LS_BUDGET)));
  const dir = known ?? directionOf(input, g, options.focus ?? []);
  const n = input.ids.length;
  const narrow = options.narrow === true;
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

  /* Wer im Fokus steht — je Band. */
  const inFocus: number[] = [];
  for (let v = 0; v < n; v += 1) if (Number.isFinite(dir.angle[v]) && h.band[v] !== null) inFocus.push(v);
  const counts: Record<LsBand, number> = { known: 0, due: 0, ring: 0, mountain: 0 };
  for (const v of inFocus) counts[h.band[v]!] += 1;
  const ofBand = (b: LsBand) => inFocus.filter((v) => h.band[v] === b);
  const R = ofBand('ring');
  const D = ofBand('due');
  const K = ofBand('known');
  const M = ofBand('mountain');

  /* -- Reihen und Bögen: wie viel Platz jeder Bereich hat — das Budget hängt daran ---------------------------- */
  /* Wo ein Feld steht (sein Winkel) — und wohin es gehört (darin sammelt es sich, wenn es nicht einzeln steht). */
  const areaKey = (v: number): string => (dir.centre[v] === 1 ? 'c' : String(dir.area[v]));
  const homeKey = (v: number): string => (dir.centre[v] === 1 ? 'c' : String(dir.home[v] >= 0 ? dir.home[v] : dir.area[v]));
  const regionOf = (b: LsBand): Region => (b === 'known' || b === 'due' ? 'valley' : b === 'ring' ? 'ring' : 'mountain');
  const rowsFrom = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  const kMin = narrow ? 4 : 5;
  const kMax = narrow ? 9 : 14;
  const keys = [...new Set([...inFocus.map(areaKey), ...inFocus.map(homeKey)])];
  const shares = bandShares(options.bands);
  const quota = {
    ring: Math.round(shares.ring * budget),
    due: Math.round(shares.due * budget),
    known: K.length === 0 ? 0 : Math.max(Math.round(shares.known * budget), Math.min(K.length, budget >= 12 ? 3 : 1)),
    mountain: 0
  };
  quota.mountain = Math.max(0, budget - quota.ring - quota.due - quota.known);
  /* Die Bögen: ein Bereich sein Sektor; die Mitte (ohne Wert) ein schmaler Bogen um 90°; was ausserhalb liegt, die Ränder. */
  const nCentre = inFocus.reduce((s, v) => s + dir.centre[v], 0);
  const centreHalf = Math.min(30, 4 + nCentre * 1.5);
  const arcOfKey = (key: string): readonly [number, number] => {
    if (key === 'c') return [90 - centreHalf, 90 + centreHalf];
    const s = dir.sectors[Number(key)];
    return s === undefined ? [0, 180] : [s.from, s.to];
  };
  /* Immer einzeln: das Ziel, der nächste Schritt, der Ring auf dem Weg dorthin. */
  const byAngle = (a: number, b: number) => dir.angle[a] - dir.angle[b] || a - b;
  const forced = inFocus.filter((v) => v === goalIndex || nextStep[v] === 1 || (onRoute[v] === 1 && h.band[v] === 'ring'))
    .sort((a, b) => (a === goalIndex ? -1 : b === goalIndex ? 1 : 0) || nextStep[b] - nextStep[a] || byAngle(a, b));
  /* Der Ring so weit draussen, dass sein Anteil und je Bereich ein Sammelfeld auf eine Reihe passen (höchstens kMax). */
  const ringWant = Math.min(R.length, Math.max(quota.ring, forced.filter((v) => h.band[v] === 'ring').length)) + (R.length > 0 ? keys.length : 0) + dir.outside.length;
  const valleyWant = Math.min(K.length + D.length, quota.known + quota.due) + (K.length + D.length > 0 ? keys.length : 0);
  /* Zellen im Bogen je Zone (die Berge: so weit, wie ihre Höhen reichen, und zwei Reihen mehr) — eine bleibt fürs Sammelfeld. */
  /* Gezählt wird streng im Bogen: das Spiel am Rand teilen sich die Nachbarn (sonst passte mehr hinein, als Platz ist). */
  const cellsIn = (rows: readonly number[], arc: readonly [number, number]) => rows.reduce((s, k) => s + rowCells(k).filter((c) => c.angle >= arc[0] && c.angle <= arc[1]).length, 0);
  /*
   * Die Reihe des Rings: weit genug für alles auf ihm (und das Tal davor) — und so weit, dass möglichst viele Bereiche
   * ihren Ring einzeln zeigen können (ein schmaler Bogen hält nah am Lernenden nur wenige Zellen); von den Reihen, die
   * das Meiste einzeln zeigen, die innerste.
   */
  const ringOf = new Map<string, number>();
  for (const v of R) ringOf.set(homeKey(v), (ringOf.get(homeKey(v)) ?? 0) + 1);
  const singlyAt = (k: number): number => {
    let rest = quota.ring;
    let shown = 0;
    for (const [key, n] of [...ringOf].sort((a, b) => a[1] - b[1])) {
      const cap = cellsIn([k, k + 1], arcOfKey(key));
      if (n <= rest && n <= cap) { rest -= n; shown += n; } else if (key === 'c' || dir.sectors.length <= 1) { const m = Math.min(rest, cap - 1, n); rest -= m; shown += m; }
    }
    return shown;
  };
  let kR = kMax;
  let bestShown = -1;
  for (let k = kMin; k <= kMax; k += 1) {
    let valley = 0;
    for (let j = 1; j <= k - 2; j += 1) valley += rowSize(j);
    if (rowSize(k) < Math.ceil(ringWant * 1.15) || valley < Math.ceil(valleyWant * 1.6) + 2) continue;
    const shown = singlyAt(k);
    if (shown > bestShown) { bestShown = shown; kR = k; }
  }
  const valleyLast = Math.max(1, kR - 2);
  const spreadMax = narrow ? 4 : 7;
  const room = new Map<string, Record<Region, number>>();
  for (const key of keys) {
    const arc = arcOfKey(key);
    room.set(key, { valley: cellsIn(rowsFrom(1, valleyLast), arc) - 1, ring: cellsIn([kR, kR + 1], arc) - 1, mountain: cellsIn(rowsFrom(kR + 3, kR + 5 + spreadMax), arc) - 1 });
  }

  /* -- Wer einzeln steht: das Budget nach Bändern ------------------------------------------------------------ */
  const single = new Set<number>();
  /* `force`: das Ziel, sein nächster Schritt und der Ring auf seinem Weg — nie in einem Sammelfeld, auch wenn es eng wird. */
  const take = (v: number, force = false): boolean => {
    if (single.has(v)) return true;
    if (!force && single.size >= budget) return false;
    const r = room.get(areaKey(v));
    const z = regionOf(h.band[v]!);
    if (!force && r !== undefined && r[z] <= 0) return false;
    if (r !== undefined) r[z] -= 1;
    single.add(v);
    return true;
  };
  const left = () => budget - single.size;
  const usedOf = (list: readonly number[]) => list.reduce((s, v) => s + (single.has(v) ? 1 : 0), 0);
  const ringOrder = (a: number, b: number) => onRoute[b] - onRoute[a] || byAngle(a, b);
  const dueOrder = (a: number, b: number) => h.height[b] - h.height[a] || byAngle(a, b);
  const knownOrder = (a: number, b: number) => h.height[a] - h.height[b] || byAngle(a, b);
  /* Berge gleicher Höhe reihum aus allen Bereichen (sonst bekäme der erste Bereich alle einzelnen). */
  const inArea = new Map<number, number>();
  {
    const byArea = new Map<string, number[]>();
    for (const v of M) { const key = homeKey(v); const got = byArea.get(key); if (got === undefined) byArea.set(key, [v]); else got.push(v); }
    for (const list of byArea.values()) { list.sort((a, b) => h.missing[a] - h.missing[b] || byAngle(a, b)); list.forEach((v, i) => inArea.set(v, i)); }
  }
  const mountainOrder = (a: number, b: number) => onRoute[b] - onRoute[a] || h.missing[a] - h.missing[b] || (inArea.get(a) ?? 0) - (inArea.get(b) ?? 0) || byAngle(a, b);
  /*
   * Ein Bereich ganz oder gar nicht (sonst EIN Feld mit Zahl) — ganz nur, wenn seine Einträge ins Budget UND in seinen
   * Bogen passen; nur wenn er sich nicht weiter öffnen lässt (die Mitte, der einzige Bereich), auch zum Teil.
   */
  const partial = (key: string) => key === 'c' || dir.sectors.length <= 1;
  const fit = (list: readonly number[], order: (a: number, b: number) => number, budgetRoom: number): void => {
    const groups = new Map<string, number[]>();
    for (const v of list) {
      if (single.has(v)) continue;
      const key = homeKey(v);
      const got = groups.get(key);
      if (got === undefined) groups.set(key, [v]); else got.push(v);
    }
    let rest = Math.min(budgetRoom, left());
    for (const [key, members] of [...groups].sort((a, b) => a[1].length - b[1].length || (a[0] < b[0] ? -1 : 1))) {
      if (rest <= 0) break;
      members.sort(order);
      const r = room.get(key);
      const z = regionOf(h.band[members[0]]!);
      const arcRoom = r === undefined ? Infinity : r[z];
      /* Stehen alle einzeln, braucht der Bereich hier kein Sammelfeld: seine Zelle wird frei. */
      if (members.length <= rest && members.length <= arcRoom + 1) {
        if (r !== undefined) r[z] += 1;
        for (const v of members) if (take(v)) rest -= 1;
        continue;
      }
      if (partial(key)) for (const v of members.slice(0, Math.max(0, Math.min(rest, arcRoom)))) if (take(v)) rest -= 1;
    }
  };
  const fill = (list: readonly number[], order: (a: number, b: number) => number, budgetRoom: number): void => {
    let rest = Math.min(budgetRoom, left());
    for (const v of [...list].filter((x) => !single.has(x)).sort(order)) { if (rest <= 0) break; if (take(v)) rest -= 1; }
  };
  for (const v of forced) take(v, true);
  /* Erst jedes Band in seinem Anteil … */
  fit(R, ringOrder, quota.ring - usedOf(R));
  fill(D, dueOrder, quota.due - usedOf(D));
  fit(K, knownOrder, quota.known - usedOf(K));
  fill(M, mountainOrder, quota.mountain - usedOf(M));
  /* … dann der Rest: was zu wiederholen ist, der Ring, die Berge, das Tal. */
  fill(D, dueOrder, left());
  fit(R, ringOrder, left());
  fill(M, mountainOrder, left());
  fit(K, knownOrder, left());

  /* -- Die Sammelfelder: je Bereich und Art (Tal, Ring, Gebirge) -------------------------------------------- */
  type Agg = { key: string; value: string; label: string; ids: number[]; cls: 'land' | 'ring' | 'range'; area: number; arc: readonly [number, number] };
  const aggs = new Map<string, Agg>();
  for (const v of inFocus) {
    if (single.has(v)) continue;
    const b = h.band[v]!;
    const cls = b === 'known' || b === 'due' ? 'land' : b === 'ring' ? 'ring' : 'range';
    const mid = dir.centre[v] === 1;
    const a = mid ? -1 : dir.home[v] >= 0 ? dir.home[v] : dir.area[v];
    const sector = a >= 0 ? dir.sectors[a] : undefined;
    const value = mid ? '' : sector?.value ?? '';
    const key = `area:${mid ? '' : value}:${cls}`;
    const got = aggs.get(key);
    if (got === undefined) aggs.set(key, { key, value, label: mid ? 'bez obszaru' : sector?.label ?? '', ids: [v], cls, area: a, arc: arcOfKey(homeKey(v)) });
    else got.ids.push(v);
  }
  const aggList = [...aggs.values()];
  const minHeight = (ids: readonly number[]) => Math.min(...ids.map((v) => h.height[v]));
  const meanAngle = (ids: readonly number[]) => ids.reduce((s, v) => s + dir.angle[v], 0) / Math.max(1, ids.length);

  /* -- Die Reihen ---------------------------------------------------------------------------------------- */
  const singles = inFocus.filter((v) => single.has(v));
  const edgeRegion = (ids: readonly number[]): Region => (ids.some((v) => h.band[v] === 'ring') ? 'ring' : ids.some((v) => h.band[v] === 'mountain') ? 'mountain' : 'valley');
  const valleyRow = (height: number) => (height <= -1 ? 1 : Math.max(1, Math.min(valleyLast, 1 + Math.round((kR - 3) * (height + 1)))));
  const taken = new Set<string>(['0,0']);
  const at = new Map<string, { cell: Cell; row: number }>();
  const items: Item[] = [];
  const later: { readonly key: string; readonly angle: number; readonly low: number; readonly prio: number; readonly arc: readonly [number, number] }[] = [];
  for (const v of singles) {
    const b = h.band[v]!;
    const region = regionOf(b);
    const angle = dir.centre[v] === 1 ? 90 : dir.angle[v];
    const arc = arcOfKey(areaKey(v));
    if (region === 'mountain') { later.push({ key: input.ids[v], angle, low: h.height[v], prio: h.missing[v], arc }); continue; }
    const prio = region === 'valley' ? (b === 'known' ? 0 : 1) : (v === goalIndex || nextStep[v] === 1 || onRoute[v] === 1 ? 0 : 1);
    items.push({ key: input.ids[v], angle, want: region === 'valley' ? valleyRow(h.height[v]) : kR, prio, region, arc });
  }
  for (const agg of aggList) {
    const low = minHeight(agg.ids);
    /* In seinem Bogen (ein Wątek darin kann seinen Winkel ausserhalb haben). */
    const angle = agg.area < 0 ? 90 : Math.max(agg.arc[0], Math.min(agg.arc[1], meanAngle(agg.ids)));
    if (agg.cls === 'range') { later.push({ key: agg.key, angle, low, prio: Math.max(1, low), arc: agg.arc }); continue; }
    items.push({ key: agg.key, angle, want: agg.cls === 'land' ? valleyRow(low) : kR, prio: 0, region: agg.cls === 'land' ? 'valley' : 'ring', arc: agg.arc });
  }
  /* Ausserhalb des Fokus: ganz links und ganz rechts in ihrer Zone. */
  const edgeKeys = new Map<string, (typeof dir.outside)[number]>();
  let li = 0;
  let ri = 0;
  for (const o of dir.outside) {
    const key = `edge:${o.value}`;
    edgeKeys.set(key, o);
    const region = edgeRegion(o.ids);
    const angle = o.side === 'left' ? 0.01 * li++ : 180 - 0.01 * ri++;
    const arc: readonly [number, number] = o.side === 'left' ? [0, 8] : [172, 180];
    const low = minHeight(o.ids.filter((v) => h.band[v] !== null));
    if (region === 'mountain') { later.push({ key, angle, low: Math.max(1, low), prio: 0, arc }); continue; }
    items.push({ key, angle, want: region === 'valley' ? valleyLast : kR, prio: 0, region, arc });
  }
  const zone = (r: Region) => items.filter((it) => it.region === r);
  /*
   * Das Tal, der Ring (eine Reihe — braucht ein Bereich mehr, als sein Bogen hält, eine zweite), die Berge — jeder in
   * seinem Bogen; wer dort nicht unterkommt, zuletzt irgendwo in seiner Zone (nie in einer Zelle mit einem anderen).
   */
  /*
   * Jede Zone in Durchgängen: im Bogen in ihren Reihen (das Tal danach auch weiter innen, als es verblasst ist), dann
   * Zelle um Zelle breiter — immer zwischen den Nachbarn in der Reihe; erst ganz zuletzt irgendwo.
   */
  const placer = new RowPlacer(taken, at);
  const valleyRows = rowsFrom(1, valleyLast);
  let valleyLeft = placer.place(zone('valley'), valleyRows);
  valleyLeft = placer.place(valleyLeft, valleyRows, { anyRow: true });
  for (let w = 1; w <= 6 && valleyLeft.length > 0; w += 1) valleyLeft = placer.place(valleyLeft, valleyRows, { anyRow: true, widen: w });
  valleyLeft = placer.place(valleyLeft, [...valleyRows, kR - 1], { anyRow: true, widen: Infinity });
  let ringLeft = placer.place(zone('ring'), [kR, kR + 1]);
  for (let w = 1; w <= 6 && ringLeft.length > 0; w += 1) ringLeft = placer.place(ringLeft, [kR, kR + 1], { widen: w });
  ringLeft = placer.place(ringLeft, [kR, kR + 1, kR + 2], { widen: Infinity });
  let lastRing = kR;
  for (const it of zone('ring')) { const p = at.get(it.key); if (p !== undefined) lastRing = Math.max(lastRing, p.row); }
  const ringRows = rowsFrom(kR, lastRing);
  const kM0 = lastRing + 2;
  const mountains: Item[] = [
    ...later.map((m) => ({ key: m.key, angle: m.angle, want: kM0 + mountainSpread(m.low, narrow), prio: m.prio, region: 'mountain' as const, arc: m.arc })),
    ...[...valleyLeft, ...ringLeft].map((it) => ({ ...it, want: kM0 }))
  ];
  for (const m of mountains) items.push(m);
  const mountainRows = rowsFrom(kM0, kM0 + spreadMax + 4);
  let mountainLeft = placer.place(mountains, mountainRows);
  for (let w = 1; w <= 3 && mountainLeft.length > 0; w += 1) mountainLeft = placer.place(mountainLeft, mountainRows, { widen: w });
  mountainLeft = placer.place(mountainLeft, rowsFrom(kM0, ROWS));
  mountainLeft = placer.place(mountainLeft, rowsFrom(kM0, ROWS), { widen: Infinity });
  placer.place(mountainLeft, rowsFrom(1, ROWS), { anyRow: true, widen: Infinity, loose: true });

  /* -- Wie hoch gezeichnet: je Zone und Reihe; dann nie über die Zelle dahinter (von hinten nach vorn). ----- */
  const regionOfKey = new Map(items.map((it) => [it.key, it.region] as const));
  const wantLift = (region: Region, row: number): number => {
    if (region === 'valley') return -0.55 + 0.45 * Math.max(0, Math.min(1, (row - 1) / Math.max(1, kR - 3)));
    if (region === 'ring') return 0.32;
    return 0.32 + 0.3 * Math.max(1, Math.min(8, row - kM0 + 1));
  };
  const cellsByBack = [...at.entries()].map(([key, p]) => ({ key, q: p.cell.q, r: p.cell.r, y: p.cell.y, x: p.cell.x, want: wantLift(regionOfKey.get(key) ?? 'ring', p.row) }));
  /* Der Lernende steht am Grund des Tals. */
  cellsByBack.push({ key: '', q: 0, r: 0, y: 0, x: 0, want: -0.55 });
  cellsByBack.sort((a, b) => b.y - a.y || a.x - b.x);
  const liftAt = new Map<string, number>();
  const liftOf = new Map<string, number>();
  for (const c of cellsByBack) {
    let z = c.want;
    for (const [dq, dr, tol] of BEHIND) {
      const behind = liftAt.get(`${c.q + dq},${c.r + dr}`);
      if (behind !== undefined) z = Math.min(z, behind + tol);
    }
    liftAt.set(`${c.q},${c.r}`, z);
    liftOf.set(c.key, z);
  }

  /* -- Die Felder ---------------------------------------------------------------------------------------- */
  const fields: LsField[] = [];
  const placeOf = (key: string) => at.get(key);
  for (const v of singles) {
    const p = placeOf(input.ids[v]);
    if (p === undefined) continue;
    const b = h.band[v]!;
    fields.push({
      key: input.ids[v], kind: 'entry', id: input.ids[v], label: label(v), count: 1, height: h.height[v], missing: h.missing[v], band: b,
      locked: h.locked[v] === 1, subject: dir.subject[v], area: dir.centre[v] === 1 ? -1 : dir.area[v], q: p.cell.q, r: p.cell.r, x: p.cell.x, y: p.cell.y,
      angle: dir.centre[v] === 1 ? 90 : dir.angle[v], row: p.row, lift: liftOf.get(input.ids[v]) ?? 0,
      route: onRoute[v], next: nextStep[v] === 1, goal: v === goalIndex, due: b === 'due' ? 1 : 0, ring: b === 'ring' ? 1 : 0, known: b === 'known' ? 1 : 0, edge: false,
      ...(options.marks?.[input.ids[v]] === undefined ? {} : { mark: options.marks[input.ids[v]] })
    });
  }
  for (const agg of aggList) {
    const p = placeOf(agg.key);
    if (p === undefined) continue;
    const low = minHeight(agg.ids);
    const band: LsBand = agg.cls === 'land' ? (agg.ids.some((v) => h.band[v] === 'known') ? 'known' : 'due') : agg.cls === 'ring' ? 'ring' : 'mountain';
    const s = agg.area >= 0 ? dir.sectors[agg.area] : undefined;
    fields.push({
      key: agg.key, kind: 'area', value: agg.value, label: agg.label, count: agg.ids.length, height: band === 'known' || band === 'due' ? Math.max(-1, ...agg.ids.map((v) => h.height[v])) : low, missing: Math.max(0, low), band,
      locked: false, subject: s?.subject ?? -1, area: agg.area, q: p.cell.q, r: p.cell.r, x: p.cell.x, y: p.cell.y, angle: agg.area < 0 ? 90 : Math.max(agg.arc[0], Math.min(agg.arc[1], meanAngle(agg.ids))), row: p.row, lift: liftOf.get(agg.key) ?? 0,
      route: agg.ids.filter((v) => onRoute[v] === 1 || v === goalIndex).length, next: agg.ids.some((v) => nextStep[v] === 1), goal: goalIndex !== undefined && agg.ids.includes(goalIndex),
      due: agg.ids.filter((v) => h.band[v] === 'due').length, ring: agg.ids.filter((v) => h.band[v] === 'ring').length, known: agg.ids.filter((v) => h.band[v] === 'known').length,
      edge: false, ids: agg.ids.map((v) => input.ids[v])
    });
  }
  for (const [key, o] of edgeKeys) {
    const p = placeOf(key);
    if (p === undefined) continue;
    const open = o.ids.filter((v) => h.band[v] === 'ring' || h.band[v] === 'mountain');
    const height = open.length === 0 ? -1 : Math.min(...open.map((v) => h.height[v]));
    fields.push({
      key, kind: 'area', value: o.value, label: o.label, count: o.ids.length, height, missing: Math.max(0, height),
      band: open.length === 0 ? 'known' : height === 0 ? 'ring' : 'mountain', locked: false, subject: o.subject, area: -1, q: p.cell.q, r: p.cell.r, x: p.cell.x, y: p.cell.y,
      angle: o.side === 'left' ? 0 : 180, row: p.row, lift: liftOf.get(key) ?? 0,
      route: o.ids.filter((v) => onRoute[v] === 1 || v === goalIndex).length, next: o.ids.some((v) => nextStep[v] === 1), goal: goalIndex !== undefined && o.ids.includes(goalIndex),
      due: o.ids.filter((v) => h.band[v] === 'due').length, ring: o.ids.filter((v) => h.band[v] === 'ring').length, known: o.ids.filter((v) => h.band[v] === 'known').length,
      edge: true, ids: o.ids.map((v) => input.ids[v])
    });
  }
  const bands = new Uint8Array(n);
  for (let v = 0; v < n; v += 1) bands[v] = h.band[v] === null ? 0 : BAND_CODE.indexOf(h.band[v]);
  return {
    fields, sectors: dir.sectors, path: dir.path, goal, counts, total: inFocus.length, ring: kR,
    rows: { valley: valleyLast, ring: ringRows, mountain: kM0 }, me: { lift: liftOf.get('') ?? 0 },
    notes, heights: h.height.slice(), bands, locked: h.locked.slice()
  };
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
    const f = this.last?.fields.find((x) => x.id === id || (x.ids?.includes(id) ?? false)) ?? null;
    return f === null ? null : { x: f.x, y: f.y, height: f.height, field: f.key };
  }

  heightOf(id: string): number | null {
    if (this.input === null || this.heights === null) return null;
    const v = this.input.ids.indexOf(id);
    return v < 0 ? null : this.heights.height[v];
  }
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
