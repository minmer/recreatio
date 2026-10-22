/**
 * LABOR 2D (v2) — EIN SCHLÜSSELBILD (B, Backen): der ganze Zustand einer
 * Engine (und ihrer Schreiber) als Bytes, um später genau dort weiterzurechnen
 * („Na żywo od tej chwili“). Die CPU-Engine ist deterministisch: aus einem
 * Schlüsselbild weitergerechnet entsteht Bit für Bit derselbe Lauf wie ohne
 * Halt (Test 33).
 *
 * Statt einer Liste je Modul geht ein Gang durch den Objektgraphen: jede
 * Zahl, jeder Text, jedes typisierte Feld unter der Wurzel, in der
 * Reihenfolge der Felder; dasselbe Objekt nur einmal (die Module teilen sich
 * Felder). Was neu dazukommt, ist so von selbst dabei. Ausgelassen wird nur:
 *
 * - Arbeitsspeicher, der in jedem Schritt neu geschrieben wird, bevor ihn
 *   jemand liest (SCRATCH — ausgemessen: ihn mit Unsinn zu füllen ändert den
 *   Lauf nicht, MILESTONES.md §B; was das Bild liest, bleibt dabei, etwa die
 *   Geschwindigkeit des Wassers für seine Pfeile);
 * - bei Feldern je Teilchen oder je Blase (Länge ein Vielfaches der
 *   Kapazität) alles hinter der Anzahl.
 *
 * Jeder Eintrag trägt seinen Pfad; zurückgeschrieben wird nach Pfad in eine
 * frisch aus derselben Szene gebaute Engine (ein Feld, das dort noch fehlt
 * oder kürzer ist, wird angelegt). Passt die Menge der Pfade nicht (eine
 * andere Fassung der Engine), sagt layout es vorher.
 */

/** Pfade (ab der Wurzel), die nur Arbeitsspeicher halten — siehe oben und MILESTONES.md §B. */
export const SCRATCH: ReadonlySet<string> = new Set<string>([
  '.e.bubbleModel.Fm', '.e.bubbleModel.alphaTarget', '.e.bubbleModel.budget', '.e.bubbleModel.cells',
  '.e.bubbleModel.dTb', '.e.bubbleModel.head', '.e.bubbleModel.next', '.e.bubbleModel.tsatCell',
  '.e.bubbleModel.wts',
  '.e.exchange.cap', '.e.exchange.capA', '.e.exchange.capT', '.e.exchange.cell', '.e.exchange.cpp', '.e.exchange.ds',
  '.e.exchange.fH', '.e.exchange.fS', '.e.exchange.hs', '.e.exchange.inH', '.e.exchange.inS', '.e.exchange.outH',
  '.e.exchange.outS', '.e.exchange.salt', '.e.exchange.water',
  '.e.gas.R.stack', '.e.gas.gasU', '.e.gas.gasV', '.e.gas.lim', '.e.gas.mover.conc', '.e.gas.mover.fu',
  '.e.gas.mover.fv', '.e.gas.mover.outM', '.e.gas.mover.scale', '.e.gas.mu', '.e.gas.nmol', '.e.gas.u0', '.e.gas.u1',
  '.e.gas.v0', '.e.gas.v1', '.e.gas.veos', '.e.gas.veosMid',
  '.e.grid.Cl', '.e.grid.Sg', '.e.grid.Sl', '.e.grid.Tl', '.e.grid.phi', '.e.grid.region',
  '.e.heat.C', '.e.heat.CKo', '.e.heat.CTl', '.e.heat.Cg', '.e.heat.Co', '.e.heat.Cs', '.e.heat.Tnew',
  '.e.heat.Tstar', '.e.heat.dE', '.e.heat.gx', '.e.heat.gy', '.e.heat.k', '.e.heat.q',
  '.e.liquid.knownU', '.e.liquid.knownV', '.e.liquid.markU', '.e.liquid.markV', '.e.liquid.mu', '.e.liquid.mv',
  '.e.liquid.pGas', '.e.liquid.pu', '.e.liquid.pv', '.e.liquid.rv', '.e.liquid.solver.bs',
  '.e.liquid.solver.levels.0.act', '.e.liquid.solver.levels.0.area', '.e.liquid.solver.levels.0.ax',
  '.e.liquid.solver.levels.0.ay', '.e.liquid.solver.levels.0.b', '.e.liquid.solver.levels.0.band',
  '.e.liquid.solver.levels.0.dDx', '.e.liquid.solver.levels.0.dDy', '.e.liquid.solver.levels.0.dH',
  '.e.liquid.solver.levels.0.diag', '.e.liquid.solver.levels.0.eDx', '.e.liquid.solver.levels.0.eDy',
  '.e.liquid.solver.levels.0.gDx', '.e.liquid.solver.levels.0.gDy', '.e.liquid.solver.levels.0.gx',
  '.e.liquid.solver.levels.0.gy', '.e.liquid.solver.levels.0.ox', '.e.liquid.solver.levels.0.oy',
  '.e.liquid.solver.levels.0.r', '.e.liquid.solver.levels.0.x', '.e.liquid.solver.levels.1.pIdx',
  '.e.liquid.solver.levels.1.pW', '.e.liquid.solver.levels.2.pIdx', '.e.liquid.solver.levels.2.pW',
  '.e.liquid.solver.nullId', '.e.liquid.solver.p', '.e.liquid.solver.q', '.e.liquid.solver.rj',
  '.e.liquid.solver.stack', '.e.liquid.solver.xs', '.e.liquid.solver.zj', '.e.liquid.tmpU', '.e.liquid.tmpV',
  '.e.liquid.vsolver', '.e.liquid.wt',
  '.e.phase.Cl', '.e.phase.Fe', '.e.phase.Fm', '.e.phase.Tl', '.e.phase.Y0', '.e.phase.acc', '.e.phase.accAll',
  '.e.phase.accH', '.e.phase.accMat', '.e.phase.accS', '.e.phase.aw', '.e.phase.bG', '.e.phase.bY', '.e.phase.dm',
  '.e.phase.edge', '.e.phase.hnC', '.e.phase.hoC', '.e.phase.host', '.e.phase.hvC', '.e.phase.mol', '.e.phase.mtot',
  '.e.phase.rd',
  '.e.prevKind'
]);

/** Nur zur Anzeige und zum Messen der Zeit je Stufe: gehört nicht zum Lauf. */
const DIAGNOSTIC: ReadonlySet<string> = new Set(['.e.timings', '.e.stamp', '.e.stepMs', '.e.warnings']);

type Typed = Float64Array | Float32Array | Int32Array | Uint32Array | Int16Array | Uint16Array | Int8Array | Uint8Array | Uint8ClampedArray;
const MAKERS: Readonly<Record<string, (n: number) => Typed>> = {
  Float64Array: (n) => new Float64Array(n), Float32Array: (n) => new Float32Array(n), Int32Array: (n) => new Int32Array(n),
  Uint32Array: (n) => new Uint32Array(n), Int16Array: (n) => new Int16Array(n), Uint16Array: (n) => new Uint16Array(n),
  Int8Array: (n) => new Int8Array(n), Uint8Array: (n) => new Uint8Array(n), Uint8ClampedArray: (n) => new Uint8ClampedArray(n)
};

type Owner = Record<string, unknown>;

interface Visitor {
  /** Ein typisiertes Feld (beim Zurückschreiben auch null: dort steht noch keines). */
  typed(owner: Owner, key: string, path: string, value: Typed): void;
  prim(owner: Owner, key: string, path: string, value: unknown): void;
  map(owner: Owner, key: string, path: string, value: Map<unknown, unknown>): void;
}

const isTyped = (v: unknown): v is Typed => ArrayBuffer.isView(v) && !(v instanceof DataView);

/** Reine Daten (Objektliteral, Liste) ohne Felder, Maps oder Klassen darin: als ein Wert gespeichert (so ändert null ↔ Objekt den Bau nicht). */
function plainData(v: unknown): boolean {
  if (v === null || typeof v !== 'object') return typeof v !== 'function';
  if (Array.isArray(v)) return v.every(plainData);
  if (Object.getPrototypeOf(v) !== Object.prototype) return false;
  return Object.values(v as Owner).every(plainData);
}

/** JSON mit den Zahlen, die JSON nicht kennt (NaN, ±Unendlich, −0). */
const encode = (v: unknown): string => JSON.stringify(v, (_k, x: unknown) => (typeof x === 'number' && (!Number.isFinite(x) || Object.is(x, -0)) ? { $n: String(Object.is(x, -0) ? '-0' : x) } : x));
const decode = (t: string): unknown => JSON.parse(t, (_k, x: unknown) => {
  if (x !== null && typeof x === 'object' && typeof (x as { $n?: unknown }).$n === 'string') { const n = (x as { $n: string }).$n; return n === '-0' ? -0 : Number(n); }
  return x;
});

/** Der Gang durch den Graphen — beim Aufnehmen und beim Zurückschreiben derselbe. */
function walk(o: object, path: string, seen: Set<object>, v: Visitor, skip: ReadonlySet<string>): void {
  if (seen.has(o)) return;
  seen.add(o);
  const rec = o as Owner;
  for (const key of Object.keys(rec)) {
    /* Abgeleitete Werte (Getter) gehören nicht zum Zustand — und liessen sich nicht zurückschreiben. */
    if (Object.getOwnPropertyDescriptor(rec, key)?.get !== undefined) continue;
    const p = `${path}.${key}`;
    const value = rec[key];
    if (skip.has(p) || DIAGNOSTIC.has(p)) {
      /* Arbeitsspeicher bleibt aussen vor — auch unter einem anderen Pfad (dasselbe Feld, z. B. solver.system.x = solver.xs). */
      if (value !== null && typeof value === 'object') seen.add(value);
      continue;
    }
    if (typeof value === 'function') continue;
    if (isTyped(value)) {
      if (seen.has(value)) continue;
      seen.add(value);
      v.typed(rec, key, p, value);
    } else if (value instanceof Map) v.map(rec, key, p, value);
    else if (value !== null && typeof value === 'object' && !plainData(value)) walk(value, p, seen, v, skip);
    else v.prim(rec, key, p, value);
  }
}

export interface SnapshotRoot {
  readonly e: { particles: { cap: number; count: number }; bubbles: { cap: number; count: number } };
  readonly [k: string]: unknown;
}

/** Wie viele Elemente eines Feldes zählen: je Teilchen/Blase nur bis zur Anzahl. */
function keepOf(a: Typed, root: SnapshotRoot): number {
  const n = a.length;
  const { particles: P, bubbles: B } = root.e;
  if (n > 0 && n % P.cap === 0 && n / P.cap <= 9) return (n / P.cap) * P.count;
  if (n > 0 && n % B.cap === 0 && n / B.cap <= 8) return (n / B.cap) * B.count;
  return n;
}

/** FNV-1a über den Text (64 bit als zwei Hälften) — nur zum Vergleichen. */
function hashText(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ (c + 0x9e37), 0x01000193) >>> 0;
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

/** Die Pfade eines Graphen in ihrer Reihenfolge (ohne Inhalt). */
function pathsOf(root: SnapshotRoot, skip: ReadonlySet<string>): string[] {
  const out: string[] = [];
  walk(root, '', new Set(), { typed: (_o, _k, p) => out.push(p), prim: (_o, _k, p) => out.push(p), map: (_o, _k, p) => out.push(p) }, skip);
  return out;
}

/** Der Bau eines Graphen: die Menge seiner Pfade — passt sie, lässt sich zurückschreiben. */
export function layoutOf(root: SnapshotRoot, skip: ReadonlySet<string> = SCRATCH): string {
  return hashText([...pathsOf(root, skip)].sort().join('\n'));
}

/** Kopf eines Schlüsselbilds: je Eintrag Pfad und Art (t Feld, n Zahl, j anderes, m Map); Felder mit Typ, Länge, gespeicherter Länge. */
interface Head {
  v: 1;
  layout: string;
  paths: string[];
  kinds: string;
  typed: [string, number, number][];
  json: unknown[];
  maps: [unknown, unknown][][];
  nums: number;
}

const bytesOf = (a: ArrayBufferView): Uint8Array => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);

/** Den Zustand aufnehmen (ungepackt). */
export function takeSnapshot(root: SnapshotRoot, skip: ReadonlySet<string> = SCRATCH): Uint8Array {
  const paths: string[] = [];
  const typed: [string, number, number][] = [];
  const data: Uint8Array[] = [];
  const nums: number[] = [];
  const json: unknown[] = [];
  const maps: [unknown, unknown][][] = [];
  let kinds = '';
  walk(root, '', new Set(), {
    typed: (_o, _k, p, a) => {
      const keep = keepOf(a, root);
      paths.push(p);
      kinds += 't';
      typed.push([a.constructor.name, a.length, keep]);
      data.push(bytesOf(a).subarray(0, keep * a.BYTES_PER_ELEMENT));
    },
    prim: (_o, _k, p, value) => {
      paths.push(p);
      if (typeof value === 'number') { kinds += 'n'; nums.push(value); }
      else { kinds += 'j'; json.push(value === undefined ? { u: 1 } : value); }
    },
    map: (_o, _k, p, m) => { paths.push(p); kinds += 'm'; maps.push([...m.entries()]); }
  }, skip);
  const head: Head = { v: 1, layout: hashText([...paths].sort().join('\n')), paths, kinds, typed, json, maps, nums: nums.length };
  const headBytes = new TextEncoder().encode(encode(head));
  const pad = (8 - ((4 + headBytes.length) % 8)) % 8;
  const total = 4 + headBytes.length + pad + 8 * nums.length + data.reduce((s, d) => s + d.length, 0);
  const out = new Uint8Array(total);
  new DataView(out.buffer).setUint32(0, headBytes.length, true);
  out.set(headBytes, 4);
  let o = 4 + headBytes.length + pad;
  out.set(bytesOf(new Float64Array(nums)), o);
  o += 8 * nums.length;
  for (const d of data) { out.set(d, o); o += d.length; }
  return out;
}

function readHead(bytes: Uint8Array): { head: Head; at: number } {
  const n = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
  const head = decode(new TextDecoder().decode(bytes.subarray(4, 4 + n))) as Head;
  return { head, at: 4 + n + ((8 - ((4 + n) % 8)) % 8) };
}

/** Der Bau eines Schlüsselbilds, ohne zurückzuschreiben. */
export function snapshotLayout(bytes: Uint8Array): string {
  return readHead(bytes).head.layout;
}

/**
 * Den Zustand in eine Engine aus derselben Szene zurückschreiben. Wirft, wenn
 * der Bau nicht passt — dann ist das Schlüsselbild von einer anderen Fassung
 * der Engine.
 */
export function restoreSnapshot(root: SnapshotRoot, bytes: Uint8Array, skip: ReadonlySet<string> = SCRATCH): void {
  const { head, at } = readHead(bytes);
  const here = layoutOf(root, skip);
  if (here !== head.layout) throw new Error('snapshot: the engine is built differently');
  const nums = new Float64Array(bytes.slice(at, at + 8 * head.nums).buffer);
  /* Wo jeder Eintrag steht: Index in seiner Liste und (Felder) Anfang in den Bytes. */
  const where = new Map<string, { kind: string; index: number; offset: number }>();
  let offset = at + 8 * head.nums;
  const count = { t: 0, n: 0, j: 0, m: 0 };
  head.paths.forEach((p, k) => {
    const kind = head.kinds[k] as 't' | 'n' | 'j' | 'm';
    const index = count[kind];
    count[kind] += 1;
    where.set(p, { kind, index, offset });
    if (kind === 't') {
      const [type, , keep] = head.typed[index];
      offset += keep * (MAKERS[type]?.(0).BYTES_PER_ELEMENT ?? 1);
    }
  });
  const fill = (owner: Owner, key: string, path: string, current: unknown): void => {
    const w = where.get(path);
    if (w === undefined) throw new Error(`snapshot: nothing stored for ${path}`);
    if (w.kind === 't') {
      const [type, len, keep] = head.typed[w.index];
      let target = isTyped(current) ? current : null;
      if (target === null || target.length !== len || target.constructor.name !== type) {
        const make = MAKERS[type];
        if (make === undefined) throw new Error(`snapshot: unknown array ${type} at ${path}`);
        target = make(len);
        owner[key] = target;
      }
      bytesOf(target).set(bytes.subarray(w.offset, w.offset + keep * target.BYTES_PER_ELEMENT));
    } else if (w.kind === 'n') owner[key] = nums[w.index];
    else if (w.kind === 'j') {
      const value = head.json[w.index];
      owner[key] = value !== null && typeof value === 'object' && (value as { u?: number }).u === 1 ? undefined : structuredClone(value);
    } else {
      const m = owner[key];
      if (!(m instanceof Map)) throw new Error(`snapshot: no map at ${path}`);
      m.clear();
      for (const [k, v] of head.maps[w.index] ?? []) m.set(k, v);
    }
  };
  walk(root, '', new Set(), {
    typed: (o, k, p, a) => fill(o, k, p, a),
    prim: (o, k, p, value) => fill(o, k, p, value),
    map: (o, k, p, m) => fill(o, k, p, m)
  }, skip);
}
