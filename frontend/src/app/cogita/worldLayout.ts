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
  /**
   * 2026-11-04 (Prompt 16) — das Startthema (−1 ohne Themen; das Haus steht auf einem eigenen Feld in der Mitte, 0,0 —
   * kein Thema steht dort, das Startthema im ersten Ring daneben) und das Fundament um das Haus.
   */
  readonly home: number;
  readonly foundation: readonly number[];
  readonly ms: number;
}



const NEIGHBOURS: readonly (readonly [number, number])[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const key = (q: number, r: number): number => (q + 8192) * 16384 + (r + 8192);
const unkey = (k: number): [number, number] => [Math.floor(k / 16384) - 8192, (k % 16384) - 8192];
/** Der Winkel eines Platzes um das Zuhause (Grad, 0–360). */
const angleOf = (q: number, r: number): number => { const c = hexCenter(q, r); const a = (Math.atan2(c.y, c.x) * 180) / Math.PI; return a < 0 ? a + 360 : a; };
const angleGap = (a: number, b: number): number => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
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

  /* -- Gebiete: wer wie viel miteinander verbunden ist (für die Reihenfolge der Keile bei Gleichstand) -------------- */
  const regionTopics = (k: string) => tree?.regions.get(k)?.topics ?? [];
  const regionRank = (k: string) => Math.min(...regionTopics(k).map(rank), Number.POSITIVE_INFINITY);
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
  const dependents: number[][] = g.ids.map(() => []);
  g.needs.forEach((list, t) => { for (const p of list) dependents[p]?.push(t); });

  /*
    -- 2026-11-04 (Prompt 16, 2) — WIE VIEL VON DER BAZA DURCH EIN THEMA GEHT: je Thema, wie viele Themen (direkt oder über
    andere) darauf aufbauen. Bitmengen in der Reihenfolge der Stufen, von aussen nach innen (Kreise: die Kante zurück zählt
    nicht).
  */
  const words = (n + 31) >>> 5;
  const below = new Uint32Array(n * words);
  const byDepthDown = g.ids.map((_, t) => t).sort((a, b) => whole[b] - whole[a] || b - a);
  for (const t of byDepthDown) {
    for (const p of g.needs[t] ?? []) {
      if (whole[p] >= whole[t]) continue;
      const pb = p * words; const tb = t * words;
      for (let w = 0; w < words; w += 1) below[pb + w] |= below[tb + w];
      below[pb + (t >>> 5)] |= 1 << (t & 31);
    }
  }
  const reach = new Int32Array(n);
  for (let t = 0; t < n; t += 1) { let c = 0; const tb = t * words; for (let w = 0; w < words; w += 1) { let x = below[tb + w]; while (x !== 0) { x &= x - 1; c += 1; } } reach[t] = c; }

  /*
    -- Schritt 1: was am Haus liegt. Das Startthema: das Thema ohne Voraussetzungen, auf dem am meisten aufbaut (das
    allgemeinste); der erste Ring: die anderen Themen ohne Voraussetzungen und die, die nur solche brauchen — die
    tragendsten zuerst, höchstens sechs.
  */
  const roots = g.ids.map((_, t) => t).filter((t) => (g.needs[t] ?? []).length === 0);
  const pool = roots.length > 0 ? roots : g.ids.map((_, t) => t);
  const start = n === 0 ? -1 : pool.reduce((b, t) => (reach[t] > reach[b] || (reach[t] === reach[b] && rank(t) < rank(b)) ? t : b), pool[0]);
  const rootSet = new Set(roots);
  const ringOne = g.ids.map((_, t) => t)
    .filter((t) => t !== start && ((g.needs[t] ?? []).length === 0 || (g.needs[t] ?? []).every((p) => rootSet.has(p))) && ((g.needs[t] ?? []).length === 0 || (g.needs[t] ?? []).includes(start)))
    .sort((a, b) => reach[b] - reach[a] || rank(a) - rank(b))
    .slice(0, 12);
  /*
    -- Schritt 2: das Fundament — die Themen nahe dem Start, auf denen der grösste Teil der Baza aufbaut (mindestens ein
    Drittel), mit allem, was sie brauchen; dazu das Haus und der erste Ring. Höchstens ein Viertel der Baza (die tragendsten
    zuerst). Tief: oft ein ganzes Gebiet; flach: nur der Start und was direkt darauf folgt.
  */
  const inFoundation = new Uint8Array(n);
  const foundation: number[] = [];
  const cap = Math.max(7, Math.round(n * 0.25));
  const addWithNeeds = (t: number): boolean => {
    const add: number[] = [];
    const stack = [t];
    const seen = new Set<number>();
    while (stack.length > 0) { const u = stack.pop()!; if (seen.has(u) || inFoundation[u] === 1) continue; seen.add(u); add.push(u); for (const p of g.needs[u] ?? []) if (whole[p] < whole[u]) stack.push(p); }
    if (foundation.length + add.length > cap && foundation.length > 0) return false;
    for (const u of add) { inFoundation[u] = 1; foundation.push(u); }
    return true;
  };
  if (start >= 0) addWithNeeds(start);
  for (const t of ringOne) addWithNeeds(t);
  const carrying = g.ids.map((_, i) => i).filter((i) => reach[i] >= (n - 1) / 2).sort((a, b) => reach[b] - reach[a] || rank(a) - rank(b));
  for (const t of carrying) addWithNeeds(t);
  /* Ein Blatt-Gebiet, das schon zur Hälfte tragend ist, kommt ganz ins Fundament (so ist es eine Fläche, kein halbes Gebiet). */
  {
    const leafKey = (t: number) => chain[t].join('>');
    const tally = new Map<string, number[]>();
    for (let t = 0; t < n; t += 1) { const l = tally.get(leafKey(t)) ?? []; l.push(t); tally.set(leafKey(t), l); }
    for (const [k, ts] of tally) {
      if (k === '' || ts.length < 2) continue;
      const share = ts.filter((t) => inFoundation[t] === 1).length / ts.length;
      if (share >= 0.5 && share < 1) for (const t of [...ts].sort((a, b) => whole[a] - whole[b])) addWithNeeds(t);
    }
  }

  /*
    Gross genug, dass jedes oberste Gebiet an seinem Rand Platz hat: ein Rand von etwa zwei Plätzen je Gebiet (die
    tragendsten Themen, die noch fehlen, kommen dazu).
  */
  {
    const tops = new Set(g.ids.map((_, t) => chain[t][0] ?? '')).size;
    const rMin = Math.ceil(tops / 3);
    /*
      Nur in einer tiefen Baza (ausser dem Start trägt noch etwas die Hälfte) oder einer grossen (über 1000 Themen, breite
      Gebiete brauchen einen längeren Rand); eine kleine flache Baza behält den Start mit seinen Nachfolgern.
    */
    const deep = carrying.filter((t) => t !== start).length > 0 || n > 1000;
    const minF = deep ? Math.min(cap, 3 * rMin * rMin + 3 * rMin + 1) : 0;
    for (const t of g.ids.map((_, i) => i).sort((a, b) => reach[b] - reach[a] || rank(a) - rank(b))) { if (foundation.length >= minF) break; if (inFoundation[t] === 0) addWithNeeds(t); }
  }
  /* -- Plätze ------------------------------------------------------------------------------------------------------ */
  const taken = new Map<number, number>();
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
  /* Die Scheibe: so viele Ringe, wie die Baza braucht (3R² + 3R + 1 ≥ n) — weiter hinaus nur im Notfall. */
  const disk = Math.max(1, Math.ceil((-3 + Math.sqrt(Math.max(0, 9 - 12 * (1 - n)))) / 6));
  const freeIn = new Int32Array(disk + 2);
  for (let r = 1; r <= disk + 1; r += 1) freeIn[r] = 6 * r;
  const rim = new Map<string, Set<number>>();
  const occupied = (k: number) => taken.has(k);
  const neighbourKeys = (q: number, r: number) => NEIGHBOURS.map(([dq, dr]) => key(q + dq, r + dr));
  const put = (t: number, q: number, r: number) => {
    const k = key(q, r);
    taken.set(k, t); place[t * 2] = q; place[t * 2 + 1] = r; ringOf[t] = hexDistance(0, 0, q, r); angle[t] = angleOf(q, r);
    if (ringOf[t] <= disk + 1 && ringOf[t] > 0) freeIn[ringOf[t]] -= 1;
    for (const a of chain[t].length === 0 ? [''] : chain[t]) {
      let s = rim.get(a);
      if (s === undefined) { s = new Set(); rim.set(a, s); }
      s.delete(k);
      for (const nk of neighbourKeys(q, r)) if (!occupied(nk)) s.add(nk);
    }
  };
  const lowestFree = () => { let r = 1; while (r <= disk && freeIn[r] <= 0) r += 1; return r; };
  /*
    2026-11-04 (Prompt 15, 1) — EINMAL GERECHNET, GESPEICHERT, WIEDER BENUTZT: stehen alle Themen schon an gespeicherten,
    verschiedenen Plätzen, gelten genau diese — nichts wird neu gelegt.
  */
  /* Das Haus: ein eigenes Feld in der Mitte, für kein Thema. */
  taken.set(key(0, 0), -1);
  const fixed = previous !== undefined && previous.size >= n && (() => {
    const seen = new Set<number>([key(0, 0)]);
    for (const id of g.ids) { const c = previous.get(id); if (c === undefined || seen.has(key(c[0], c[1]))) return false; seen.add(key(c[0], c[1])); }
    return true;
  })();
  if (fixed) for (let t = 0; t < n; t += 1) { const c = previous!.get(g.ids[t])!; put(t, c[0], c[1]); }
  /* Nach einer Änderung: wer seinen gespeicherten Platz noch hat, steht zuerst dort und bleibt dort (das Haus bleibt in der Mitte). */
  const seeded = new Uint8Array(n);
  if (fixed) seeded.fill(1);
  else if (previous !== undefined) for (let t = 0; t < n; t += 1) { const c = previous.get(g.ids[t]); if (c === undefined || taken.has(key(c[0], c[1])) || (c[0] === 0 && c[1] === 0)) continue; put(t, c[0], c[1]); seeded[t] = 1; }

  /* -- Das Haus und das Fundament: das Startthema in der Mitte, der erste Ring gleichmässig darum, dann rund nach aussen. */

  /*
    Im Fundament bekommt jedes Gebiet, das darin Themen hat, eine Richtung: rund um das Haus in der Reihenfolge ihrer
    Verbindungen, so breit wie seine Themen darin — so liegen die Fundament-Themen eines Gebiets beisammen, und sein Keil
    setzt dort an.
  */
  const outerOf = (t: number) => chain[t][0] ?? '';
  const fCount = new Map<string, number>();
  for (const t of foundation) fCount.set(outerOf(t), (fCount.get(outerOf(t)) ?? 0) + 1);
  const fMid = new Map<string, number>();
  {
    const keys = orderRegions([...fCount.keys()], links, regionRank);
    const total = keys.reduce((a, k) => a + fCount.get(k)!, 0);
    let acc = 0;
    for (const k of keys) { const sp = (360 * fCount.get(k)!) / Math.max(1, total); fMid.set(k, (90 + acc + sp / 2) % 360); acc += sp; }
  }
  /* Der Platz eines Themas: frei, an der Karte, möglichst innen; die Wertung entscheidet unter den Kandidaten. */
  const placeBy = (t: number, score: (q: number, r: number) => number, extra: Iterable<number>) => {
    const cand = new Set<number>(extra);
    for (const p of g.needs[t] ?? []) if (ringOf[p] >= 0) for (const nk of neighbourKeys(place[p * 2], place[p * 2 + 1])) if (!occupied(nk)) cand.add(nk);
    const low = lowestFree();
    for (const r of [low, low + 1]) for (const c of cellsOfRing(r)) { const k = key(c[0], c[1]); if (occupied(k)) continue; if (neighbourKeys(c[0], c[1]).some(occupied)) cand.add(k); }
    let best = -1; let bs = Infinity;
    for (const k of cand) { if (occupied(k)) continue; const [q, r] = unkey(k); const s = score(q, r); if (s < bs - 1e-9) { bs = s; best = k; } }
    if (best < 0) {
      /* Nichts an der Karte (sollte nicht vorkommen): der innerste freie Platz. */
      for (let r = 1; best < 0 && r < disk + 4000; r += 1) for (const c of cellsOfRing(r)) { const k = key(c[0], c[1]); if (!occupied(k)) { best = k; break; } }
    }
    const [q, r] = unkey(best);
    put(t, q, r);
  };
  const occupiedAround = (q: number, r: number) => { let k = 0; for (const nk of neighbourKeys(q, r)) if (occupied(nk)) k += 1; return k; };
  const nearNeeds = (t: number, q: number, r: number) => { let near = Infinity; for (const p of g.needs[t] ?? []) if (ringOf[p] >= 0) near = Math.min(near, hexDistance(q, r, place[p * 2], place[p * 2 + 1])); return near; };
  const grow = (avail: Set<number>, groups: { id: string; need: number; prefer: number | null }[], seedNear: (k: number, id: string) => number, preOwned?: ReadonlyMap<string, readonly number[]>): Map<string, Set<number>> => {
    const out = new Map<string, Set<number>>();
    const ownerOf = new Map<number, string>();
    const frontier = new Map<string, Set<number>>();
    const need = new Map(groups.map((x) => [x.id, x.need] as const));
    const preferOf = new Map(groups.map((x) => [x.id, x.prefer] as const));
    const claim = (id: string, k: number) => {
      ownerOf.set(k, id);
      let mine = out.get(id); if (mine === undefined) { mine = new Set(); out.set(id, mine); } mine.add(k);
      need.set(id, need.get(id)! - 1);
      let f = frontier.get(id); if (f === undefined) { f = new Set(); frontier.set(id, f); }
      f.delete(k);
      const [q, r] = unkey(k);
      for (const nk of neighbourKeys(q, r)) if (avail.has(nk) && !ownerOf.has(nk)) f.add(nk);
    };
    const value = (id: string, k: number) => {
      const [q, r] = unkey(k);
      const ringNow = hexDistance(0, 0, q, r);
      const pref = preferOf.get(id) ?? null;
      const cellDeg = 360 / (6 * Math.max(1, ringNow));
      let own = 0;
      for (const nk of neighbourKeys(q, r)) if (ownerOf.get(nk) === id) own += 1;
      return ringNow * 3 + (pref === null ? 0 : 0.5 * (angleGap(angleOf(q, r), pref) / cellDeg)) - 0.9 * own;
    };
    /* Die Samen: die grössten zuerst, jeder am besten Platz an seinem Anfang (oben: am Rand des Fundaments). */
    /* Was einem Gebiet schon gehört (seine Themen im Fundament): sein Land wächst von dort aus. */
    for (const [id, ks] of preOwned ?? []) {
      if (!need.has(id)) continue;
      let f = frontier.get(id); if (f === undefined) { f = new Set(); frontier.set(id, f); }
      for (const k of ks) { ownerOf.set(k, id); const [q, r] = unkey(k); for (const nk of neighbourKeys(q, r)) if (avail.has(nk)) f.add(nk); }
    }
    /* Wer schon Land hat, fasst zuerst Fuss — der mit dem engsten Rand zuerst (sonst schlössen ihn die anderen ein). */
    for (const id of [...(preOwned?.keys() ?? [])].filter((x) => need.has(x) && need.get(x)! > 0).sort((x, y) => (frontier.get(x)?.size ?? 0) - (frontier.get(y)?.size ?? 0) || (x < y ? -1 : 1))) {
      const f = frontier.get(id);
      if (f === undefined) continue;
      let best = -1; let bs = Infinity;
      for (const k of f) { if (ownerOf.has(k)) continue; const v = value(id, k); if (v < bs) { bs = v; best = k; } }
      if (best >= 0) claim(id, best);
    }
    /* Die Samen auseinander (sonst schliessen sie einander gleich ein): mindestens so weit, wie ein Stück breit wird. */
    const seeds: [number, number][] = [];
    /* Oben sitzen alle Samen am schmalen Rand des Fundaments: dort reicht ein Platz Abstand. */
    const minSep = preOwned !== undefined ? 2 : Math.max(2, Math.floor(Math.sqrt(avail.size / Math.max(1, groups.length)) * 0.8));
    for (const x of [...groups].sort((a, b) => b.need - a.need || (a.id < b.id ? -1 : 1))) {
      if (x.need <= 0 || (frontier.get(x.id)?.size ?? 0) > 0) continue;
      let best = -1; let bs = Infinity;
      for (const k of avail) {
        if (ownerOf.has(k)) continue;
        const [q, r] = unkey(k);
        let close = Infinity;
        for (const [a, b] of seeds) close = Math.min(close, hexDistance(q, r, a, b));
        const s = value(x.id, k) + seedNear(k, x.id) + (close < minSep ? 12 * (minSep - close) : 0);
        if (s < bs) { bs = s; best = k; }
      }
      if (best >= 0) { claim(x.id, best); seeds.push(unkey(best)); }
    }
    /* Reihum: wer im Verhältnis am wenigsten hat, nimmt seinen besten Randplatz. */
    const total = new Map(groups.map((x) => [x.id, Math.max(1, x.need)] as const));
    let guard = 0;
    for (;;) {
      const open = groups.filter((x) => (need.get(x.id) ?? 0) > 0);
      if (open.length === 0 || guard > 8 * avail.size + 64) break;
      guard += 1;
      open.sort((a, b) => (1 - need.get(a.id)! / total.get(a.id)!) - (1 - need.get(b.id)! / total.get(b.id)!) || (a.id < b.id ? -1 : 1));
      const x = open[0];
      const f = frontier.get(x.id) ?? new Set<number>();
      let best = -1; let bs = Infinity;
      for (const k of f) { if (ownerOf.has(k)) { f.delete(k); continue; } const s = value(x.id, k); if (s < bs) { bs = s; best = k; } }
      if (best >= 0) { claim(x.id, best); continue; }
      /* Eingeschlossen: einen Randplatz vom Nachbarn, der dabei ganz bleibt (er wächst dafür weiter). */
      const mine = out.get(x.id) ?? new Set<number>();
      let stole = false;
      for (const k of mine) {
        const [q, r] = unkey(k);
        for (const nk of neighbourKeys(q, r)) {
          const y = ownerOf.get(nk);
          if (y === undefined || y === x.id) continue;
          const theirs = out.get(y)!;
          /* Nur von einem, der anderswo weiterwachsen kann (sonst nähmen sich zwei denselben Platz hin und her). */
          if (theirs.size <= 1 || ![...(frontier.get(y) ?? [])].some((m) => m !== nk && !ownerOf.has(m))) continue;
          theirs.delete(nk);
          const first = theirs.values().next().value as number;
          const seen = new Set([first]); const st = [first];
          while (st.length > 0) { const c = st.pop()!; const [a, b] = unkey(c); for (const m of neighbourKeys(a, b)) if (theirs.has(m) && !seen.has(m)) { seen.add(m); st.push(m); } }
          if (seen.size !== theirs.size) { theirs.add(nk); continue; }
          ownerOf.delete(nk);
          need.set(y, need.get(y)! + 1);
          const fy = frontier.get(y)!; fy.add(nk);
          claim(x.id, nk);
          stole = true;
          break;
        }
        if (stole) break;
      }
      if (stole) continue;
      /* Gar nichts geht: der nächste freie Platz (selten). */
      for (const k of avail) if (!ownerOf.has(k)) { claim(x.id, k); stole = true; break; }
      if (!stole) break;
    }
    return out;
  };

  /*
    Das Fundament als runde Scheibe um das Haus, geteilt in Sektoren je Gebiet (in der Reihenfolge ihrer Richtungen), jeder
    vom Haus bis zum Rand der Scheibe: so liegen die Fundament-Themen eines Gebiets beisammen, und sein Land setzt am Rand
    an. Im Sektor: Ring für Ring nach der Stufe, neben dem, was es braucht.
  */
  const fKeysOrdered = [...fMid.keys()].sort((a, b) => ((fMid.get(a)! - 90 + 360) % 360) - ((fMid.get(b)! - 90 + 360) % 360));
  const restF = fixed ? [] : foundation.filter((t) => ringOf[t] < 0);
  if (restF.length > 0) {
    const want = restF.length;
    const diskF: [number, number, number, number][] = [];
    for (let r = 1; diskF.length < want && r < 4000; r += 1) {
      const free = cellsOfRing(r).filter((c) => !taken.has(key(c[0], c[1])));
      const left = want - diskF.length;
      if (free.length <= left) { for (const c of free) diskF.push([c[0], c[1], c[2], r]); continue; }
      for (let k = 0; k < left; k += 1) { const c = free[Math.floor(((k + 0.5) * free.length) / left)]; diskF.push([c[0], c[1], c[2], r]); }
    }
    const perRegion = new Map<string, number[]>();
    for (const t of restF) { const l = perRegion.get(outerOf(t)) ?? []; l.push(t); perRegion.set(outerOf(t), l); }
    /* Die Sektoren wachsen im Fundament wie das Land draussen: jeder zusammenhängend, von innen in seiner Richtung. */
    const diskSet = new Set(diskF.map((c) => key(c[0], c[1])));
    const keysF = [...fKeysOrdered.filter((x) => perRegion.has(x)), ...[...perRegion.keys()].filter((x) => !fMid.has(x))];
    /* Zwei Wege, die Scheibe zu teilen: Läufe nach dem Winkel (Keile vom Haus zum Rand) oder wachsen; der mit weniger zerrissenen Sektoren gilt. */
    const byRuns = new Map<string, Set<number>>();
    {
      const rel = (a: number) => (a - 90 + 360) % 360;
      const sorted = [...diskF].sort((a, b) => rel(a[2]) - rel(b[2]) || a[3] - b[3]);
      let at0 = 0;
      for (const k of keysF) { const c = perRegion.get(k)!.length; byRuns.set(k, new Set(sorted.slice(at0, at0 + c).map((x) => key(x[0], x[1])))); at0 += c; }
    }
    const grown = grow(diskSet, keysF.map((k) => ({ id: k, need: perRegion.get(k)!.length, prefer: fMid.get(k) ?? null })), (k) => { const [q, r] = unkey(k); return hexDistance(0, 0, q, r) * 4; });
    const brokenIn = (m: ReadonlyMap<string, Set<number>>) => { let b = 0; for (const v of m.values()) { const arr = [...v]; if (arr.length === 0) continue; const seen = new Set([arr[0]]); const st = [arr[0]]; while (st.length > 0) { const c = st.pop()!; const [q, r] = unkey(c); for (const nk of neighbourKeys(q, r)) if (v.has(nk) && !seen.has(nk)) { seen.add(nk); st.push(nk); } } if (seen.size !== v.size) b += 1; } return b; };
    const sectors = brokenIn(grown) < brokenIn(byRuns) ? grown : byRuns;
    for (const k of keysF) {
      const ts = perRegion.get(k)!.sort((a, b) => whole[a] - whole[b] || reach[b] - reach[a] || rank(a) - rank(b));
      const sector = [...(sectors.get(k) ?? [])].map((kk) => { const [q, r] = unkey(kk); return [q, r, angleOf(q, r), hexDistance(0, 0, q, r)] as [number, number, number, number]; });
      for (const t of ts) {
        let best: [number, number, number, number] | null = null; let bs = Infinity;
        for (const c of sector) {
          if (taken.has(key(c[0], c[1]))) continue;
          const near = nearNeeds(t, c[0], c[1]);
          const s = c[3] * 6 + (near <= 1 || near === Infinity ? 0 : 1 + near) - 0.3 * occupiedAround(c[0], c[1]);
          if (s < bs) { bs = s; best = c; }
        }
        if (best !== null) put(t, best[0], best[1]);
        else placeBy(t, (q, r) => hexDistance(0, 0, q, r) * 6 - 0.5 * occupiedAround(q, r), []);
      }
    }
  }

  /*
    -- Schritt 3: die Keile. Jedes oberste Gebiet (ohne seine Themen im Fundament) beginnt am Rand des Fundaments auf der
    Seite, wo seine Voraussetzungen liegen: seine Richtung ist das Mittel der Richtungen der Fundament-Themen, aus denen
    seine Themen (direkt oder über andere) schöpfen. Rund um den Kreis nach dieser Richtung geordnet, die Weite nach der
    Grösse, das Ganze so gedreht, dass jedes Gebiet möglichst in seiner Richtung bleibt.
  */
  const pull = new Float64Array(n * 2);
  for (const t of g.ids.map((_, i) => i).sort((a, b) => whole[a] - whole[b] || a - b)) {
    if (ringOf[t] >= 0 && inFoundation[t] === 1) {
      if (ringOf[t] === 0) continue;
      pull[t * 2] = Math.cos((angle[t] * Math.PI) / 180); pull[t * 2 + 1] = Math.sin((angle[t] * Math.PI) / 180);
      continue;
    }
    let x = 0; let y = 0;
    for (const p of g.needs[t] ?? []) { if (whole[p] >= whole[t]) continue; x += pull[p * 2]; y += pull[p * 2 + 1]; }
    const l = Math.hypot(x, y);
    if (l > 1e-9) { pull[t * 2] = x / l; pull[t * 2 + 1] = y / l; }
  }
  const outerKeys = [...new Set(g.ids.map((_, t) => t).filter((t) => inFoundation[t] === 0).map(outerOf))];
  const size = new Map<string, number>(); const vec = new Map<string, [number, number]>();
  for (let t = 0; t < n; t += 1) { if (inFoundation[t] === 1) continue; const k = outerOf(t); size.set(k, (size.get(k) ?? 0) + 1); const v = vec.get(k) ?? [0, 0]; v[0] += pull[t * 2]; v[1] += pull[t * 2 + 1]; vec.set(k, v); }
  const prefer = new Map<string, number | null>();
  for (const k of outerKeys) { const v = vec.get(k)!; prefer.set(k, Math.hypot(v[0], v[1]) < 1e-6 ? null : ((Math.atan2(v[1], v[0]) * 180) / Math.PI + 360) % 360); }
  /* Ohne eigene Richtung: neben das Gebiet, mit dem es am meisten verbunden ist (sonst die Reihenfolge des Autors). */
  const placedKeys = outerKeys.filter((k) => prefer.get(k) !== null).sort((a, b) => prefer.get(a)! - prefer.get(b)! || regionRank(a) - regionRank(b));
  const loose = orderRegions(outerKeys.filter((k) => prefer.get(k) === null), links, regionRank);
  const ring: string[] = [...placedKeys];
  for (const k of loose) {
    let at = ring.length; let bw = -1;
    ring.forEach((o, i) => { const w = links(o, k); if (w > bw) { bw = w; at = i + 1; } });
    ring.splice(at, 0, k);
  }
  const totalOuter = ring.reduce((s, k) => s + (size.get(k) ?? 0), 0);
  const wedgeOf = new Map<string, Wedge>();
  {
    const mids: { k: string; mid: number; w: number }[] = [];
    let acc = 0;
    for (const k of ring) { const sp = (360 * (size.get(k) ?? 0)) / Math.max(1, totalOuter); mids.push({ k, mid: acc + sp / 2, w: sp }); acc += sp; }
    let sx = 0; let sy = 0;
    for (const m of mids) { const want = prefer.get(m.k); if (want === null || want === undefined) continue; sx += m.w * Math.cos(((want - m.mid) * Math.PI) / 180); sy += m.w * Math.sin(((want - m.mid) * Math.PI) / 180); }
    const turn = Math.hypot(sx, sy) < 1e-9 ? 90 - (mids[0]?.mid ?? 0) : (Math.atan2(sy, sx) * 180) / Math.PI;
    for (const m of mids) wedgeOf.set(m.k, { a0: (((m.mid - m.w / 2 + turn) % 360) + 360) % 360, span: m.w });
  }
  const top: string[] = hasRegions ? [...ring.filter((k) => k !== '' && tree!.regions.has(k)), ...tree!.top.filter((k) => !ring.includes(k))] : [];

  /*
    -- Schritt 4: eine geschlossene Fläche. Erst das Land jedes Gebiets, dann seine Säulen.
    Das Land: alle obersten Gebiete wachsen zugleich vom Rand des Fundaments nach aussen, Ring für Ring, jedes nur an sein
    eigenes Land (ein zusammenhängendes Stück), bis es so viele Plätze hat wie Themen; wer kleiner ist, ist eher fertig,
    die anderen werden breiter statt länger. Wer eingeschlossen wird, bevor er fertig ist, nimmt dem Nachbarn einen
    Randplatz (der wächst dafür anderswo weiter). Im Land eines Gebiets teilen sich seine Teilgebiete ebenso auf, bis zu
    den Blättern. Die Scheibe ist so gross wie nötig — so bleibt kein Loch und kein Arm.
    Die Säulen: Thema für Thema in der Reihenfolge der Stufen über alle Gebiete, jedes auf einen Platz seines Blattes,
    so nah am Haus wie erlaubt (nie näher als das, was es braucht), neben dem, was es braucht.
  */
  /* Haus und Fundament stehen fest (die späteren Runden tauschen sie nicht). */
  if (!fixed) for (const t of foundation) seeded[t] = 1;
  const order = fixed ? [] : g.ids.map((_, t) => t).filter((t) => ringOf[t] < 0).sort((a, b) => whole[a] - whole[b] || rank(a) - rank(b) || a - b);
  const territory = new Map<string, Set<number>>();
  /* Die Gruppe eines Themas auf einer Ebene: der Anfang seiner Kette; wer direkt im Gebiet steht (ohne Teilgebiet): eigene Gruppe „·“. */
  const groupAt = (t: number, depth: number) => (chain[t].length === 0 ? '·' : chain[t].length <= depth ? `${chain[t].join('>')}>·` : chain[t].slice(0, depth + 1).join('>'));
  const landOf = (t: number) => { const c = chain[t].join('>'); return chain[t].length === 0 ? '·' : territory.has(c) ? c : `${c}>·`; };
  if (!fixed) {
    /* Die Plätze der Scheibe ohne das, was schon steht (Haus, Fundament, gespeicherte Plätze). */
    const free = new Set<number>();
    const restCount = order.length;
    let rings = disk;
    const capOf = (r: number) => 3 * r * r + 3 * r + 1;
    while (capOf(rings) - taken.size < restCount) rings += 1;
    for (let r = 1; r <= rings; r += 1) for (const c of cellsOfRing(r)) { const k = key(c[0], c[1]); if (!taken.has(k)) free.add(k); }
    /* Ebene für Ebene: die obersten Gebiete im freien Land, dann in jedem Land seine Teilgebiete. */
    const split = (avail: Set<number>, topics: readonly number[], depth: number, preferBase: number | null, seedNear: (k: number, id: string) => number) => {
      const groups = new Map<string, number[]>();
      for (const t of topics) { const id = groupAt(t, depth); const l = groups.get(id) ?? []; l.push(t); groups.set(id, l); }
      const list = [...groups.entries()].map(([id, ts]) => {
        let x = 0; let y = 0; for (const t of ts) { x += pull[t * 2]; y += pull[t * 2 + 1]; }
        const w = depth === 0 ? wedgeOf.get(id.split('>')[0]) : undefined;
        const pref = w !== undefined ? (w.a0 + w.span / 2) % 360 : Math.hypot(x, y) > 1e-6 ? ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360 : preferBase;
        return { id, need: ts.length, prefer: pref };
      });
      /*
        Oben wachsen die Keile um das Fundament; darunter teilt sich das Land eines Gebiets in Läufe einer Schlange über
        seine Ringe (innen beginnend, jeder Ring hin und zurück): jeder Lauf ist ein zusammenhängendes Stück, breit statt
        lang, und was früher dran ist (die früheste Stufe darin), liegt weiter innen.
      */
      const lands = depth === 0 ? grow(avail, list, seedNear, ownF) : (() => {
        const out = new Map<string, Set<number>>();
        const cellsIn = [...avail].map((k) => { const [q, r] = unkey(k); return { k, ring: hexDistance(0, 0, q, r), a: angleOf(q, r) }; });
        const mid0 = meanAngle(cellsIn.map((c) => c.a)) ?? 0;
        const rel = (a: number) => ((a - mid0 + 540) % 360) - 180;
        const rings = [...new Set(cellsIn.map((c) => c.ring))].sort((a, b) => a - b);
        const snake: number[] = [];
        rings.forEach((rg, i) => { const row = cellsIn.filter((c) => c.ring === rg).sort((a, b) => rel(a.a) - rel(b.a)); if (i % 2 === 1) row.reverse(); for (const c of row) snake.push(c.k); });
        const firstOf = (id: string) => Math.min(...groups.get(id)!.map((t) => whole[t] * 1e6 + rank(t)));
        let at = 0;
        for (const x of [...list].sort((a, b) => firstOf(a.id) - firstOf(b.id) || (a.id < b.id ? -1 : 1))) { out.set(x.id, new Set(snake.slice(at, at + x.need))); at += x.need; }
        return out;
      })();
      for (const { id } of list) {
        const land = lands.get(id) ?? new Set<number>();
        const ts = groups.get(id)!;
        if (depth > 12 || ts.every((t) => chain[t].length <= depth + 1)) { territory.set(id, land); continue; }
        const mid = meanAngle([...land].map((k) => { const [q, r] = unkey(k); return angleOf(q, r); }));
        split(land, ts, depth + 1, mid, () => 0);
      }
    };
    const ownF = new Map<string, number[]>();
    for (const t of foundation) { if (ringOf[t] < 0) continue; const l = ownF.get(outerOf(t)) ?? []; l.push(key(place[t * 2], place[t * 2 + 1])); ownF.set(outerOf(t), l); }
    /* Der Anfang eines Gebiets: neben seinen eigenen Themen im Fundament, sonst irgendwo am Fundament. */
    const placedNear = (k: number, id: string) => {
      const [q, r] = unkey(k);
      let any = false; let own = false;
      for (const nk of neighbourKeys(q, r)) { const u = taken.get(nk); if (u === undefined) continue; any = true; if (outerOf(u) === id) own = true; }
      const hasOwn = foundation.some((u) => outerOf(u) === id);
      return own ? 0 : any ? (hasOwn ? 25 : 0) : 50;
    };
    split(free, order, 0, null, placedNear);
  }
  for (const t of order) {
    if (ringOf[t] >= 0) continue;
    const land = territory.get(landOf(t));
    const needs = (g.needs[t] ?? []).filter((p) => ringOf[p] >= 0);
    const minRing = needs.reduce((m, p) => Math.max(m, ringOf[p]), 1);
    const score = (q: number, r: number): number => {
      const ringNow = hexDistance(0, 0, q, r);
      let s = ringNow * 3 + (ringNow < minRing ? 3 * (minRing - ringNow) : 0);
      const near = nearNeeds(t, q, r);
      if (near !== Infinity && near > 1) s += 1.5 + 0.8 * near;
      return s - 0.5 * occupiedAround(q, r);
    };
    const mine = land === undefined ? [] : [...land].filter((k) => !occupied(k));
    /* Kein Platz mehr im eigenen Land (selten): neben dem eigenen Gebiet, nicht irgendwo. */
    if (mine.length === 0) {
      const ownRim = rim.get(chain[t].length === 0 ? '' : chain[t][chain[t].length - 1]) ?? rim.get(outerOf(t));
      const topRim = rim.get(outerOf(t));
      placeBy(t, (q, r) => score(q, r) + (topRim !== undefined && topRim.has(key(q, r)) ? 0 : 25) + (ownRim !== undefined && ownRim.has(key(q, r)) ? 0 : 6), [...(topRim ?? [])]);
      continue;
    }
    let best = -1; let bs = Infinity;
    for (const k of mine) { const [q, r] = unkey(k); const s = score(q, r); if (s < bs - 1e-9) { bs = s; best = k; } }
    const [q, r] = unkey(best);
    put(t, q, r);
  }

  /* -- Wenige feste Runden: Nachbarn desselben Gebiets tauschen, wenn die Verbindungen kürzer werden --------------- */
  const opens = dependents;
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
              if (u === undefined || u < 0 || seen.has(u) || leafOf(u) === k || seeded[u] === 1 || outerOf(u) !== outerOf(t)) continue;
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
    2026-11-04 (Prompt 16) — dasselbe für die obersten Gebiete: ein abgetrenntes Stück tauscht mit einem Thema eines
    anderen Gebiets am Rand seiner Hauptfläche, wenn dabei kein Gebiet (oben und im Blatt) in mehr Stücke zerfällt.
  */
  {
    const topMembers = new Map<string, number[]>();
    for (let t = 0; t < n; t += 1) { const k = outerOf(t); const l = topMembers.get(k) ?? []; l.push(t); topMembers.set(k, l); }
    const topPieces = (k: string): number[][] => {
      const list = topMembers.get(k) ?? [];
      const seen = new Set<number>(); const out: number[][] = [];
      for (const t0 of list) {
        if (seen.has(t0)) continue;
        const part = [t0]; seen.add(t0);
        for (let i = 0; i < part.length; i += 1) { const u = part[i]; for (const [dq, dr] of NEIGHBOURS) { const v = taken.get(key(place[u * 2] + dq, place[u * 2 + 1] + dr)); if (v !== undefined && v >= 0 && !seen.has(v) && outerOf(v) === k) { seen.add(v); part.push(v); } } }
        out.push(part);
      }
      return out.sort((a, b) => b.length - a.length);
    };
    for (let round = 0; round < (fixed ? 0 : 4); round += 1) {
      let mended = 0;
      for (const k of topMembers.keys()) {
        let parts = topPieces(k);
        for (let guard = 0; parts.length > 1 && guard < 64; guard += 1) {
          const main = parts[0];
          let done = false;
          for (const t of parts[parts.length - 1]) {
            if (seeded[t] === 1) continue;
            const seen = new Set<number>();
            for (const m of main) {
              for (const [dq, dr] of NEIGHBOURS) {
                const u = taken.get(key(place[m * 2] + dq, place[m * 2 + 1] + dr));
                if (u === undefined || u < 0 || seen.has(u) || outerOf(u) === k || seeded[u] === 1) continue;
                seen.add(u);
                if (!okRing(t, ringOf[u], u, ringOf[t]) || !okRing(u, ringOf[t], t, ringOf[u])) continue;
                const o = outerOf(u);
                const b1 = topPieces(o).length; const b2 = pieces(leafOf(t)).length; const b3 = pieces(leafOf(u)).length;
                swap(t, u);
                if (topPieces(o).length <= b1 && topPieces(k).length < parts.length && pieces(leafOf(t)).length <= b2 && pieces(leafOf(u)).length <= b3) { done = true; break; }
                swap(t, u);
              }
              if (done) break;
            }
            if (done) break;
          }
          if (!done) break;
          mended += 1;
          parts = topPieces(k);
        }
      }
      if (mended === 0) break;
    }
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
      /* 2026-11-04 (Prompt 15) — die Weite nach dem umschliessenden Rechteck (ein Keil vom Zuhause zum Rand ist schmal). */
      let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
      for (const t of r.topics) { x0 = Math.min(x0, cells[t].x); x1 = Math.max(x1, cells[t].x); y0 = Math.min(y0, cells[t].y); y1 = Math.max(y1, cells[t].y); }
      const radius = r.topics.length === 0 ? 0 : Math.max(x1 - x0, y1 - y0) / 2;
      let topKey = r.key;
      for (let p = r.parent, k = 0; p !== null && k < 64; p = tree.regions.get(p)?.parent ?? null, k += 1) topKey = p;
      regions.set(r.key, { key: r.key, name: r.name, level: r.level, parent: r.parent, top: topKey, topics: r.topics, x, y, radius: radius + 0.6, shade: shade.get(r.key) ?? 0 });
    }
  }
  /* Der Boden: ein Platz um alles (das Haus steht auf dem Startthema). */
  const ground: WorldCell[] = [];
  const seen = new Set<number>();
  for (const c of cells) {
    for (const [dq, dr] of NEIGHBOURS) {
      const q = c.q + dq; const r = c.r + dr; const k = key(q, r);
      if (at.has(k) || seen.has(k)) continue;
      seen.add(k);
      ground.push({ q, r, ...hexCenter(q, r) });
    }
  }

  const t1 = typeof performance === 'undefined' ? Date.now() : performance.now();
  return { cells, regions, top, chain, ground, home: start, foundation, ms: t1 - t0 };
}
