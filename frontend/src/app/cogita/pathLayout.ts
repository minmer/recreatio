/**
 * 2026-11-03 (F) — DIE ŚCIEŻKA ALS KARTE: wie der Kurs-Pfad von Brilliant (Knoten von unten nach oben, verbunden durch
 * sichtbare Wege), aber die Wege gabeln sich und kommen wieder zusammen. Gebaut aus der EINEN Reihenfolge des Lernens
 * (`prerequisites.ts`: die Felder „Najpierw trzeba znać", das „Najpierw" der Pytania, die Zależności der Ustawienia) —
 * keine eigene Struktur.
 * <code>
 *   Stufe       die längste Kette davor im gezeigten Satz (Einträge ausserhalb sind durchsichtig, Umwege fallen weg)
 *   Gabel       was mehrere direkt nach sich hat: sie stehen nebeneinander, mittig darüber, in der Reihenfolge des Autors
 *   Zusammen    was mehrere vor sich hat: mittig über ihnen — frei erst, wenn jede Spur durch ist („2 z 3 ścieżek")
 *   Spalte      halbe Schritte, Abstand mindestens 1; eine Stufe rückt so wenig wie möglich (Ausgleich in Blöcken)
 * </code>
 * Nur aus der Struktur, nie aus dem Fortschritt: dieselben Daten geben dieselbe Karte. Der Stand färbt nur — gelernt
 * (versenkt), jetzt dran (hervorgehoben), frei (erhaben, leuchtend), gesperrt (blass, Schloss), zu wiederholen
 * (Zeichen) —, und ein Weg leuchtet, sobald sein Anfang gelernt ist.
 */

export interface PathItem {
  readonly id: string;
  readonly label: string;
}

export interface PathNode {
  readonly id: string;
  readonly label: string;
  /** Die Stufe von unten (0: ein Anfang). */
  readonly level: number;
  /** Die Spalte (halbe Schritte; Nachbarn auf einer Stufe mindestens 1 auseinander). */
  readonly x: number;
  /** Direkt davor und direkt danach (Indizes in `nodes`). */
  readonly needs: readonly number[];
  readonly builds: readonly number[];
}

/** Woher die Reihenfolge kam: die des Lernens; die der Erzählung (wo das Lernen nichts sagt); eine Kette in der gegebenen Reihenfolge. */
export type PathSource = 'learning' | 'story' | 'chain' | 'none';

export interface PathModel {
  readonly nodes: readonly PathNode[];
  readonly index: ReadonlyMap<string, number>;
  /** Die Wege: [davor, danach]. */
  readonly edges: readonly (readonly [number, number])[];
  readonly levels: number;
  readonly x0: number;
  readonly x1: number;
  readonly source: PathSource;
}

export const EMPTY_PATH: PathModel = { nodes: [], index: new Map(), edges: [], levels: 0, x0: 0, x1: 0, source: 'none' };

/**
 * Was direkt vor jedem Eintrag des Satzes kommt — durch Einträge ausserhalb hindurch (sie sind durchsichtig), ohne
 * Umwege: steht p schon vor einer anderen Voraussetzung q, ist der Weg p → v keiner (er liefe neben p → q → v).
 */
export function effectiveNeeds(ids: readonly string[], needsOf: (id: string) => readonly string[]): number[][] {
  const at = new Map(ids.map((id, i) => [id, i] as const));
  const direct: number[][] = ids.map((id, v) => {
    const out: number[] = [];
    const seen = new Set<string>([id]);
    const stack = [...needsOf(id)];
    while (stack.length > 0) {
      const p = stack.pop()!;
      if (seen.has(p)) continue;
      seen.add(p);
      const i = at.get(p);
      if (i !== undefined) { if (i !== v && !out.includes(i)) out.push(i); continue; }
      for (const q of needsOf(p)) if (!seen.has(q)) stack.push(q);
    }
    return out.sort((a, b) => a - b);
  });
  return reduce(direct);
}

/** Ohne Umwege (transitive Reduktion) — und ohne Kreise (eine Kante, die einen schlösse, fällt weg; die frühere bleibt). */
function reduce(needs: readonly (readonly number[])[]): number[][] {
  const n = needs.length;
  const order = topo(needs);
  /* Was vor jedem liegt (alle Stufen), in der Reihenfolge von unten nach oben. */
  const before: Set<number>[] = Array.from({ length: n }, () => new Set<number>());
  const kept: number[][] = Array.from({ length: n }, () => []);
  for (const v of order.list) {
    const own = needs[v].filter((p) => order.rank[p] < order.rank[v]);
    for (const p of own) { before[v].add(p); for (const q of before[p]) before[v].add(q); }
    kept[v] = own.filter((p) => !own.some((q) => q !== p && before[q].has(p)));
  }
  return kept;
}

/** Eine Reihenfolge von unten nach oben (Kahn; was in einem Kreis steht, kommt in der gegebenen Reihenfolge dazu). */
function topo(needs: readonly (readonly number[])[]): { list: number[]; rank: Int32Array } {
  const n = needs.length;
  const waiting = new Int32Array(n);
  const builds: number[][] = Array.from({ length: n }, () => []);
  for (let v = 0; v < n; v += 1) for (const p of needs[v]) { waiting[v] += 1; builds[p].push(v); }
  const list: number[] = [];
  const done = new Uint8Array(n);
  let queue = [...Array(n).keys()].filter((v) => waiting[v] === 0);
  while (list.length < n) {
    if (queue.length === 0) {
      /* Ein Kreis: der erste, der noch wartet, beginnt (seine Kanten nach hinten fallen weg). */
      const v = [...Array(n).keys()].find((x) => done[x] === 0)!;
      queue = [v];
      waiting[v] = 0;
    }
    queue.sort((a, b) => a - b);
    const next: number[] = [];
    for (const v of queue) {
      if (done[v] === 1) continue;
      done[v] = 1;
      list.push(v);
      for (const c of builds[v]) { waiting[c] -= 1; if (waiting[c] === 0 && done[c] === 0) next.push(c); }
    }
    queue = next;
  }
  const rank = new Int32Array(n);
  list.forEach((v, i) => { rank[v] = i; });
  return { list, rank };
}

const snap = (x: number): number => Math.round(x * 2) / 2;

/**
 * Eine Stufe setzen: jeder möchte an seine Stelle (sortiert); wer einem anderen näher als 1 käme, bildet mit ihm einen
 * Block, der als Ganzes an das Mittel seiner Wünsche rückt (Ausgleich benachbarter Verletzungen) — so rückt die Stufe
 * so wenig wie möglich und keiner überholt einen anderen.
 */
function placeRow(wanted: readonly number[]): number[] {
  type Block = { start: number; n: number; sum: number };
  const blocks: Block[] = [];
  const first = (b: Block) => b.sum / b.n;
  wanted.forEach((w, i) => {
    blocks.push({ start: i, n: 1, sum: w });
    while (blocks.length > 1) {
      const cur = blocks[blocks.length - 1];
      const prev = blocks[blocks.length - 2];
      if (first(prev) + prev.n <= first(cur) + 1e-9) break;
      /* Zusammen: der neue Block beginnt, wo das Mittel aller Wünsche (je um ihren Platz im Block verschoben) liegt. */
      blocks.splice(blocks.length - 2, 2, { start: prev.start, n: prev.n + cur.n, sum: prev.sum + cur.sum - cur.n * prev.n });
    }
  });
  const out: number[] = new Array(wanted.length);
  for (const b of blocks) { const x0 = snap(first(b)); for (let k = 0; k < b.n; k += 1) out[b.start + k] = x0 + k; }
  for (let i = 1; i < out.length; i += 1) if (out[i] < out[i - 1] + 1) out[i] = out[i - 1] + 1;
  return out;
}

/**
 * DIE KARTE DER ŚCIEŻKA: Einträge (in der Reihenfolge des Autors) und was direkt vor jedem kommt. Ohne eine einzige
 * Kante (keine Reihenfolge) und mit `chainIfFlat`: eine Kette in der gegebenen Reihenfolge.
 */
export function pathModel(items: readonly PathItem[], needsIn: readonly (readonly number[])[], options: { readonly source?: PathSource; readonly chainIfFlat?: boolean } = {}): PathModel {
  const n = items.length;
  if (n === 0) return EMPTY_PATH;
  let needs = reduce(needsIn.map((l) => [...new Set(l.filter((p) => p >= 0 && p < n))]));
  let source: PathSource = options.source ?? 'learning';
  if (needs.every((l) => l.length === 0)) {
    if (options.chainIfFlat === true && n > 1) { needs = items.map((_, i) => (i === 0 ? [] : [i - 1])); source = 'chain'; } else source = n > 1 ? 'none' : source;
  }
  const builds: number[][] = Array.from({ length: n }, () => []);
  for (let v = 0; v < n; v += 1) for (const p of needs[v]) builds[p].push(v);
  for (const list of builds) list.sort((a, b) => a - b);
  const { list: order } = topo(needs);
  const level = new Int32Array(n);
  for (const v of order) for (const p of needs[v]) level[v] = Math.max(level[v], level[p] + 1);
  const levels = n === 0 ? 0 : Math.max(...level) + 1;

  const x = new Float64Array(n);
  const roots = [...Array(n).keys()].filter((v) => needs[v].length === 0);
  for (let L = 0; L < levels; L += 1) {
    const row = [...Array(n).keys()].filter((v) => level[v] === L);
    const want = new Map<number, number>();
    for (const v of row) {
      if (needs[v].length === 0) {
        const i = roots.indexOf(v);
        want.set(v, snap(i - (roots.length - 1) / 2));
      } else if (needs[v].length === 1) {
        /* Eine Gabel: die Geschwister mit nur diesem Davor nebeneinander, mittig darüber, in der Reihenfolge des Autors. */
        const p = needs[v][0];
        const siblings = builds[p].filter((c) => needs[c].length === 1 && level[c] === L);
        const j = siblings.indexOf(v);
        want.set(v, snap(x[p] + j - (siblings.length - 1) / 2));
      } else {
        /* Zusammen: mittig über allem, was davor kommt. */
        want.set(v, snap(needs[v].reduce((s, p) => s + x[p], 0) / needs[v].length));
      }
    }
    row.sort((a, b) => want.get(a)! - want.get(b)! || a - b);
    const placed = placeRow(row.map((v) => want.get(v)!));
    row.forEach((v, i) => { x[v] = placed[i]; });
  }
  const nodes: PathNode[] = items.map((it, v) => ({ id: it.id, label: it.label, level: level[v], x: x[v], needs: needs[v], builds: builds[v] }));
  const edges: [number, number][] = [];
  for (let v = 0; v < n; v += 1) for (const p of needs[v]) edges.push([p, v]);
  return { nodes, index: new Map(items.map((it, i) => [it.id, i] as const)), edges, levels, x0: Math.min(...x) - 0.5, x1: Math.max(...x) + 0.5, source };
}

/* -- Der Stand ------------------------------------------------------------------------------------------------------- */

/** Wie ein Knoten steht. `current` ist der eine, an dem der Lernende gerade ist. */
export type PathState = 'done' | 'available' | 'locked';

export interface PathMarks {
  readonly state: readonly PathState[];
  /** Gelernt, aber zu wiederholen (ein Zeichen am Knoten). */
  readonly due: readonly boolean[];
  /** Wo der Lernende ist (−1: nirgends). */
  readonly current: number;
  /** Je Weg (wie `edges`): leuchtet er (sein Anfang ist gelernt)? */
  readonly lit: readonly boolean[];
  /** Je Zusammenführung: wie viele Spuren davor durch sind. */
  readonly merges: ReadonlyMap<number, { readonly done: number; readonly total: number }>;
  readonly done: number;
}

/**
 * DER STAND auf der Karte: gelernt (`learned`: ab 10 % — was blednie, bleibt gelernt, mit Zeichen `due`), frei (alles
 * davor gelernt), sonst gesperrt. „Jetzt dran": der vom Gastgeber genannte (die Stelle der Erzählung), sonst der erste
 * freie von unten.
 */
export function pathMarks(model: PathModel, know: (id: string) => { readonly learned: boolean; readonly due: boolean }, current?: string | null): PathMarks {
  const n = model.nodes.length;
  const learned = model.nodes.map((nd) => know(nd.id));
  const state: PathState[] = model.nodes.map((nd, v) => (learned[v].learned ? 'done' : nd.needs.every((p) => learned[p].learned) ? 'available' : 'locked'));
  const given = current === undefined || current === null ? undefined : model.index.get(current);
  let at = given ?? -1;
  if (given === undefined) {
    for (let v = 0; v < n; v += 1) {
      if (state[v] !== 'available') continue;
      if (at < 0 || model.nodes[v].level < model.nodes[at].level) at = v;
    }
  }
  const merges = new Map<number, { done: number; total: number }>();
  for (let v = 0; v < n; v += 1) {
    const nd = model.nodes[v];
    if (nd.needs.length >= 2) merges.set(v, { done: nd.needs.filter((p) => state[p] === 'done').length, total: nd.needs.length });
  }
  return {
    state, due: learned.map((k) => k.learned && k.due), current: at, lit: model.edges.map(([p]) => state[p] === 'done'), merges,
    done: state.filter((s) => s === 'done').length
  };
}

/** Eine Spur ab diesen Knoten: was von ihnen aus weitergeht, bis zur nächsten Zusammenführung (sie nicht mehr). */
export function branchOf(model: PathModel, starts: readonly string[]): Set<string> {
  const out = new Set<string>();
  const stack = starts.map((id) => model.index.get(id)).filter((v): v is number => v !== undefined);
  while (stack.length > 0) {
    const v = stack.pop()!;
    const nd = model.nodes[v];
    if (out.has(nd.id)) continue;
    out.add(nd.id);
    for (const c of nd.builds) if (model.nodes[c].needs.length < 2) stack.push(c);
  }
  return out;
}

/** Die Zahl in Worten: „2 z 3 ścieżek". */
export const mergeWords = (done: number, total: number): string => `${done} z ${total} ${total === 1 ? 'ścieżki' : 'ścieżek'}`;
