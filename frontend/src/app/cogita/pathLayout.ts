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
  /** 2026-11-04 — bei einer Erzählung: was dieser Knoten ist und was darin ist (`storyPath.ts`). */
  readonly kind?: PartKind;
  readonly slides?: number;
  readonly questions?: number;
}

/** Woher die Reihenfolge kam: die des Lernens; die der Erzählung (wo das Lernen nichts sagt); eine Kette in der gegebenen Reihenfolge. */
export type PathSource = 'learning' | 'story' | 'chain' | 'none';

export interface PathModel {
  readonly nodes: readonly PathNode[];
  readonly index: ReadonlyMap<string, number>;
  /** Die Wege: [davor, danach]. */
  readonly edges: readonly (readonly [number, number])[];
  /** 2026-11-04 — je Weg seine Punkte [Spalte, Stufe] (über die Stufen, die er überspringt — ohne durch Knoten zu laufen). */
  readonly routes: readonly (readonly (readonly [number, number])[])[];
  readonly levels: number;
  readonly x0: number;
  readonly x1: number;
  readonly source: PathSource;
  /** Wie viele Kreuzungen die Zeichnung noch hat (0: keine). */
  readonly crossings: number;
}

export const EMPTY_PATH: PathModel = { nodes: [], index: new Map(), edges: [], routes: [], levels: 0, x0: 0, x1: 0, source: 'none', crossings: 0 };

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
 * Eine Stufe setzen: jeder möchte an seine Stelle (in der gegebenen Reihenfolge); wer seinem Nachbarn näher käme als
 * `gap`, bildet mit ihm einen Block, der als Ganzes an das Mittel seiner Wünsche rückt — so rückt die Stufe so wenig wie
 * möglich und keiner überholt einen anderen. `gap[i]`: der Abstand zwischen i und i+1.
 */
function placeRow(wanted: readonly number[], gap: readonly number[] = []): number[] {
  const g = (i: number) => gap[i] ?? 1;
  /* Die Lage im Block relativ zu seinem ersten: die Summe der Abstände davor. */
  const offset: number[] = [0];
  for (let i = 1; i < wanted.length; i += 1) offset.push(offset[i - 1] + g(i - 1));
  type Block = { start: number; n: number; sum: number };
  const blocks: Block[] = [];
  const first = (b: Block) => b.sum / b.n;
  const span = (b: Block) => offset[b.start + b.n - 1] - offset[b.start];
  wanted.forEach((w, i) => {
    blocks.push({ start: i, n: 1, sum: w });
    while (blocks.length > 1) {
      const cur = blocks[blocks.length - 1];
      const prev = blocks[blocks.length - 2];
      if (first(prev) + span(prev) + g(prev.start + prev.n - 1) <= first(cur) + 1e-9) break;
      /* Zusammen: der Wunsch jedes Gliedes, auf den Anfang des Blocks zurückgerechnet, gemittelt. */
      const shift = offset[cur.start] - offset[prev.start];
      blocks.splice(blocks.length - 2, 2, { start: prev.start, n: prev.n + cur.n, sum: prev.sum + cur.sum - cur.n * shift });
    }
  });
  const out: number[] = new Array(wanted.length);
  for (const b of blocks) { const x0 = snap(first(b)); for (let k = 0; k < b.n; k += 1) out[b.start + k] = x0 + offset[b.start + k] - offset[b.start]; }
  for (let i = 1; i < out.length; i += 1) if (out[i] < out[i - 1] + g(i - 1) - 1e-9) out[i] = out[i - 1] + g(i - 1);
  return out;
}

/**
 * 2026-11-04 — DIE GESCHICHTETE ZEICHNUNG (Sugiyama): Stufen von unten (die längste Kette davor), lange Wege bekommen
 * Zwischenpunkte auf jeder Stufe, die sie überspringen; dann wird jede Stufe so geordnet, dass sich Wege so wenig wie
 * möglich kreuzen (Schwerpunkte, abwechselnd von unten und von oben, das beste Ergebnis bleibt); zuletzt die Spalten —
 * jeder Knoten über dem Mittel dessen, womit er verbunden ist, Ketten gerade. Nur aus der Struktur.
 */
interface Layered {
  readonly x: Float64Array;
  /** Je Weg die Punkte [x, Stufe] von unten nach oben, Anfang und Ende eingeschlossen. */
  readonly routes: (readonly (readonly [number, number])[])[];
  readonly crossings: number;
}

function layered(n: number, level: Int32Array, edges: readonly (readonly [number, number])[]): Layered {
  const levels = n === 0 ? 0 : Math.max(...level) + 1;
  /* Die Punkte: 0..n-1 die Knoten, danach die Zwischenpunkte. */
  const lv: number[] = [...level];
  const up: number[][] = Array.from({ length: n }, () => []);
  const down: number[][] = Array.from({ length: n }, () => []);
  const chain: number[][] = [];
  for (const [p, c] of edges) {
    const pts = [p];
    let at = p;
    for (let L = level[p] + 1; L < level[c]; L += 1) {
      const d = lv.length;
      lv.push(L);
      up.push([]);
      down.push([]);
      up[at].push(d);
      down[d].push(at);
      pts.push(d);
      at = d;
    }
    up[at].push(c);
    down[c].push(at);
    pts.push(c);
    chain.push(pts);
  }
  const total = lv.length;
  const rows: number[][] = Array.from({ length: levels }, () => []);
  /* Die Reihenfolge zuerst: die des Autors (Knoten), Zwischenpunkte hinter dem, von dem sie kommen. */
  const key = new Float64Array(total);
  for (let v = 0; v < n; v += 1) key[v] = v;
  for (let v = n; v < total; v += 1) key[v] = key[down[v][0]] + 0.5;
  for (let v = 0; v < total; v += 1) rows[lv[v]].push(v);
  for (const r of rows) r.sort((a, b) => key[a] - key[b] || a - b);
  const pos = new Float64Array(total);
  const index = () => { for (const r of rows) r.forEach((v, i) => { pos[v] = i; }); };
  index();
  const crossingsOf = (): number => {
    let sum = 0;
    for (let L = 0; L + 1 < levels; L += 1) {
      const segs: [number, number][] = [];
      for (const v of rows[L]) for (const w of up[v]) segs.push([pos[v], pos[w]]);
      for (let i = 0; i < segs.length; i += 1) for (let j = i + 1; j < segs.length; j += 1) {
        const [a1, b1] = segs[i];
        const [a2, b2] = segs[j];
        if ((a1 - a2) * (b1 - b2) < 0) sum += 1;
      }
    }
    return sum;
  };
  let best = rows.map((r) => [...r]);
  let bestCount = crossingsOf();
  const bary = (from: readonly number[]): number | null => (from.length === 0 ? null : from.reduce((s, w) => s + pos[w], 0) / from.length);
  for (let iter = 0; iter < 24 && bestCount > 0; iter += 1) {
    const downward = iter % 2 === 0;
    const order = downward ? [...Array(levels).keys()].slice(1) : [...Array(levels).keys()].reverse().slice(1);
    for (const L of order) {
      const r = rows[L];
      const wish = new Map(r.map((v) => [v, bary(downward ? down[v] : up[v]) ?? pos[v]] as const));
      r.sort((a, b) => wish.get(a)! - wish.get(b)! || pos[a] - pos[b]);
      r.forEach((v, i) => { pos[v] = i; });
    }
    const count = crossingsOf();
    if (count < bestCount) { bestCount = count; best = rows.map((r) => [...r]); }
  }
  for (let L = 0; L < levels; L += 1) rows[L] = best[L];
  index();

  /* Die Spalten: Knoten 1 auseinander, Zwischenpunkte ½; jeder über dem Mittel seiner Nachbarn, in Durchgängen. */
  const x = new Float64Array(total);
  const gapsOf = (r: readonly number[]) => r.slice(1).map((v, i) => (v < n && r[i] < n ? 1 : 0.5));
  for (const r of rows) { const placed = placeRow(r.map((_, i) => i - (r.length - 1) / 2), gapsOf(r)); r.forEach((v, i) => { x[v] = placed[i]; }); }
  const mean = (list: readonly number[]): number | null => (list.length === 0 ? null : list.reduce((s, w) => s + x[w], 0) / list.length);
  const pass = (L: number, from: (v: number) => readonly number[]) => {
    const r = rows[L];
    const placed = placeRow(r.map((v) => mean(from(v)) ?? x[v]), gapsOf(r));
    r.forEach((v, i) => { x[v] = placed[i]; });
  };
  for (let k = 0; k < 4; k += 1) {
    for (let L = 1; L < levels; L += 1) pass(L, (v) => down[v]);
    for (let L = levels - 2; L >= 0; L -= 1) pass(L, (v) => up[v]);
  }
  /* Zuletzt von unten: was auf einem einzigen Weg liegt, steht genau über ihm (Ketten gerade, Gabeln mittig). */
  for (let L = 1; L < levels; L += 1) pass(L, (v) => down[v]);
  /* Das Ganze um 0. */
  const xs = [...x];
  const mid = xs.length === 0 ? 0 : snap((Math.min(...xs) + Math.max(...xs)) / 2);
  for (let v = 0; v < total; v += 1) x[v] -= mid;
  const routes = chain.map((pts) => pts.map((v) => [x[v], lv[v]] as const));
  return { x: x.slice(0, n), routes, crossings: bestCount };
}

/** Was ein Knoten einer Erzählung ist (`storyPath.ts`): Anfang, Lesen, Fragen, beides, Przegląd, Gabel, Ende. */
export type PartKind = 'start' | 'read' | 'learn' | 'mixed' | 'review' | 'fork' | 'end';

/** Was ein Knoten über sich weiss (bei einer Erzählung: seine Art und was darin ist). */
export interface PathNodeInfo {
  readonly kind?: PartKind;
  readonly slides?: number;
  readonly questions?: number;
}

/**
 * DIE KARTE DER ŚCIEŻKA: Einträge (in der Reihenfolge des Autors) und was direkt vor jedem kommt. Ohne eine einzige
 * Kante (keine Reihenfolge) und mit `chainIfFlat`: eine Kette in der gegebenen Reihenfolge. `info`: je Knoten seine Art
 * (eine Erzählung); `reduced`: die Wege sind schon ohne Umwege (eine Erzählung — ihre Gabeln und Zusammenführungen bleiben).
 */
export function pathModel(items: readonly PathItem[], needsIn: readonly (readonly number[])[], options: { readonly source?: PathSource; readonly chainIfFlat?: boolean; readonly info?: readonly PathNodeInfo[]; readonly reduced?: boolean } = {}): PathModel {
  const n = items.length;
  if (n === 0) return EMPTY_PATH;
  const clean = needsIn.map((l, v) => [...new Set(l.filter((p) => p >= 0 && p < n && p !== v))]);
  let needs = options.reduced === true ? dropBack(clean) : reduce(clean);
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
  const levels = Math.max(...level) + 1;
  const edges: [number, number][] = [];
  for (let v = 0; v < n; v += 1) for (const p of needs[v]) edges.push([p, v]);
  const lay = layered(n, level, edges);
  const nodes: PathNode[] = items.map((it, v) => ({ id: it.id, label: it.label, level: level[v], x: lay.x[v], needs: needs[v], builds: builds[v], ...(options.info?.[v] ?? {}) }));
  const all = [...lay.x, ...lay.routes.flatMap((r) => r.map(([x]) => x))];
  return { nodes, index: new Map(items.map((it, i) => [it.id, i] as const)), edges, routes: lay.routes, levels, x0: Math.min(...all) - 0.5, x1: Math.max(...all) + 0.5, source, crossings: lay.crossings };
}

/** Ohne Kreise, aber MIT allen Wegen (eine Erzählung: eine Gabel, die wieder zusammenkommt, bleibt sichtbar). */
function dropBack(needs: readonly (readonly number[])[]): number[][] {
  const { rank } = topo(needs);
  return needs.map((l, v) => l.filter((p) => rank[p] < rank[v]));
}

/* -- Der Stand ------------------------------------------------------------------------------------------------------- */

/** Wie ein Knoten steht. `current` ist der eine, an dem der Lernende gerade ist. */
export type PathState = 'done' | 'available' | 'locked';

/** Eine Gabel einer Erzählung: eine Wahl (`choose`: eine von n) oder Kapitel (`all`: alle, in beliebiger Reihenfolge). */
export interface PathFork {
  readonly mode: 'choose' | 'all';
  /** Gewählt (`choose`) oder ukończone (`all`). */
  readonly done: number;
  readonly total: number;
  /** 2026-11-04 — eine Wahl: wie viele ihrer Wege zu Ende gegangen sind. */
  readonly finished?: number;
}

export interface PathMarks {
  readonly state: readonly PathState[];
  /** Gelernt, aber zu wiederholen (ein Zeichen am Knoten). */
  readonly due: readonly boolean[];
  /** Wo der Lernende ist (−1: nirgends). */
  readonly current: number;
  /** Je Weg (wie `edges`): leuchtet er (sein Anfang ist durch)? */
  readonly lit: readonly boolean[];
  /** Je Weg: der gewählte Weg einer Gabel (hervorgehoben). */
  readonly taken: readonly boolean[];
  /** Je Gabel (Index des Knotens): wie viel davon gewählt oder durch ist. */
  readonly forks: ReadonlyMap<number, PathFork>;
  /** 2026-11-04 (Prompt 10) — je Knoten: wie viele seiner Fragen wirklich gefragt würden (fehlt: alle). */
  readonly ask?: readonly number[];
  /** Wie viele der gezählten Knoten durch sind — gezählt wird jedes Sechseck (nicht Anfang und Ende). */
  readonly done: number;
  readonly total: number;
}

/** Was gezählt wird: jedes Sechseck — Anfang und Ende sind Zeichen, keine Teile. */
export const countsAsStep = (nd: Pick<PathNode, 'kind'>): boolean => nd.kind !== 'start' && nd.kind !== 'end';

/**
 * DER STAND auf einer Karte von Einträgen: gelernt (`learned`: ab 10 % — was blednie, bleibt gelernt, mit Zeichen `due`),
 * frei (alles davor gelernt), sonst gesperrt. „Jetzt dran": der vom Gastgeber genannte, sonst der erste freie von unten.
 * Ein Eintrag mit zwei Voraussetzungen ist keine Wahl — keine Zähler (Gabeln gibt es nur in Erzählungen).
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
  return {
    state, due: learned.map((k) => k.learned && k.due), current: at, lit: model.edges.map(([p]) => state[p] === 'done'), taken: model.edges.map(() => false),
    forks: new Map(), done: state.filter((s, v) => s === 'done' && countsAsStep(model.nodes[v])).length, total: model.nodes.filter(countsAsStep).length
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

const plural = (n: number, one: string, few: string, many: string): string => {
  if (n === 1) return one;
  const t = n % 10;
  const h = n % 100;
  return t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
};

/** Die Zahl in Worten: „2 z 3 ścieżek". */
export const mergeWords = (done: number, total: number): string => `${done} z ${total} ${total === 1 ? 'ścieżki' : 'ścieżek'}`;

/** Was eine Gabel zählt, in Worten: „wybierz 1 z 3", „wybrano 1 z 3", „ukończono 2 z 3 ścieżek". */
export const forkWords = (f: PathFork): string => (f.mode === 'choose' ? (f.done === 0 ? `wybierz 1 z ${f.total}` : `wybrano ${f.done} z ${f.total}${(f.finished ?? 0) > 0 ? ` · ukończono ${f.finished}` : ''}`) : `ukończono ${mergeWords(f.done, f.total)}`);

/** Was in einem Teil wartet, in Worten: „3 slajdy do przeczytania · 5 pytań do odpowiedzi". */
export function partWords(nd: Pick<PathNode, 'kind' | 'slides' | 'questions'>, ask?: number): string {
  const s = nd.slides ?? 0;
  const q = nd.questions ?? 0;
  const slides = s > 0 ? `${s} ${plural(s, 'slajd', 'slajdy', 'slajdów')} do przeczytania` : '';
  /* 2026-11-04 (Prompt 10) — gezählt wird, was wirklich gefragt wird: „2 z 5 pytań"; alles gekonnt — nur zum Lesen. */
  const questions = q === 0 ? '' : ask === undefined || ask >= q ? `${q} ${plural(q, 'pytanie', 'pytania', 'pytań')} do odpowiedzi`
    : ask === 0 ? 'wszystkie pytania już umiesz — tylko do przeczytania' : `${ask} z ${q} ${plural(q, 'pytania', 'pytań', 'pytań')} do odpowiedzi`;
  switch (nd.kind) {
    case 'start': return 'Początek ścieżki';
    case 'end': return 'Koniec ścieżki';
    case 'fork': return 'Tu wybierasz drogę';
    case 'review':
      if (q > 0 && ask === 0) return 'Przegląd — wszystkie pytania już umiesz';
      return `Przegląd${q > 0 ? `: ${ask === undefined || ask >= q ? `${q} ${plural(q, 'pytanie', 'pytania', 'pytań')}` : `${ask} z ${q} ${plural(q, 'pytania', 'pytań', 'pytań')}`}` : ''} — powtarzasz, aż wszystkie umiesz${s > 0 ? ` (i ${slides})` : ''}`;
    default: return [slides, questions].filter(Boolean).join(' · ');
  }
}
