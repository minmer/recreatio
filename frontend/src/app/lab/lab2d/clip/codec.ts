/**
 * LABOR 2D (v2) — DAS FORMAT EINES NACHWEISES, Bild für Bild (B, Backen):
 * die Ebenen eines Bildes (render/layers.ts) als Bytes, zwei Sekunden Bilder
 * zu einem Stück, jedes Bild als Unterschied zum vorigen (Byte für Byte,
 * modulo 256: was sich nicht ändert, wird Null) und das Stück mit dem
 * deflate des Browsers (CompressionStream) gepackt. Verlustfrei: die
 * Wiedergabe setzt aus genau den Ebenen zusammen, die beim Backen entstanden.
 *
 * Ein Stück liegt nach Ebenen geordnet (erst die Arten aller Bilder, dann
 * der Nebel aller Bilder …): gleichartige Unterschiede stehen beieinander,
 * deflate packt sie um ein Viertel besser als Bild für Bild. Was das Bild
 * ohne Einblendung braucht (Art, Kruste, Glühen, Nebel, die Flüssigkeit mit
 * Temperatur und Salz, Blasen), steht in jedem Bild; was nur die
 * Einblendungen im Gas zeigen (Temperatur, Druck, Geschwindigkeit, Feuchte,
 * Dampf, Blasen in der Mapa stanów, Pfeile), in jedem dritten (10 je
 * Sekunde) — dazwischen gilt das letzte. Das halbiert einen Nachweis
 * (MILESTONES.md §B).
 *
 *   u32 Bilder F · je Bild: u32 Blasen, f64 t, pmax, vmax, vGas, vLiq,
 *   (ab Fassung 2) u32 Vierecke, u32 Rechtecke der Körper ·
 *   je Ebene: ihre Einträge (der erste roh, dann Unterschiede) ·
 *   je Bild: die Blasen (je 8 Bytes, roh) ·
 *   (ab Fassung 2) je Bild die Vierecke der Körper (je 16 Bytes), dann je
 *   Bild ihre Rechtecke (je 10 Bytes) — als Unterschied zum vorigen Bild,
 *   wenn es gleich viele sind, sonst roh.
 */

import { allocLayers, arrowPoints, QUAD, RECT, type Layers } from '../render/layers';

/** Bytes je Bild im Kopf: Fassung 1 (ohne Körper) und ab Fassung 2. */
const HEAD_V1 = 44;
const HEAD_BYTES = 52;
/** Jedes wievielte Bild die Ebenen der Einblendungen trägt. */
export const OVERLAY_EVERY = 3;

const bytesOf = (a: ArrayBufferView): Uint8Array => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);

/** Eine Ebene im Stück: Grösse je Eintrag, jedes wievielte Bild, Lesen und Schreiben an den Ebenen. */
interface Plane {
  readonly size: number;
  readonly every: number;
  get(L: Layers, out: Uint8Array): void;
  set(L: Layers, src: Uint8Array): void;
}

/** Eine ganze Ebene der Bildebenen. */
const whole = (size: number, every: number, pick: (L: Layers) => ArrayBufferView): Plane => ({
  size, every,
  get: (L, out) => out.set(bytesOf(pick(L)).subarray(0, size)),
  set: (L, src) => bytesOf(pick(L)).set(src.subarray(0, size))
});

/** Ein Kanal der Flüssigkeitstextur (RGBA, verschränkt) als eigene Ebene. */
const channel = (texels: number, ch: number, every: number): Plane => ({
  size: texels, every,
  get: (L, out) => { const q = L.liquid; for (let i = 0; i < texels; i += 1) out[i] = q[4 * i + ch]; },
  set: (L, src) => { const q = L.liquid; for (let i = 0; i < texels; i += 1) q[4 * i + ch] = src[i]; }
});

function planes(nx: number, ny: number, dx: number): Plane[] {
  const n = nx * ny;
  const t = 4 * n;
  const o = OVERLAY_EVERY;
  return [
    whole(n, 1, (L) => L.code), whole(n, 1, (L) => L.crust), whole(n, 1, (L) => L.glow), whole(n, 1, (L) => L.fog),
    channel(t, 0, 1), channel(t, 1, 1), channel(t, 2, 1), channel(t, 3, 1),
    whole(n, o, (L) => L.flags), whole(2 * n, o, (L) => L.temp), whole(n, o, (L) => L.pres), whole(n, o, (L) => L.speed),
    whole(n, o, (L) => L.hum), whole(n, o, (L) => L.vap), whole(2 * arrowPoints(nx, ny, dx), o, (L) => L.arrows)
  ];
}

/** Ein Stück Bilder schreiben: Bild um Bild hinzufügen, dann die Bytes holen. */
export class ChunkWriter {
  private readonly planes: Plane[];
  /** Je Ebene ihre Einträge (Kopien). */
  private readonly entries: Uint8Array[][];
  private readonly heads: { nb: number; t: number; pmax: number; vmax: number; vGas: number; vLiq: number; nq: number; nr: number }[] = [];
  private readonly bubbles: Uint8Array[] = [];
  private readonly quads: Uint8Array[] = [];
  private readonly rects: Uint8Array[] = [];

  constructor(nx: number, ny: number, dx: number) {
    this.planes = planes(nx, ny, dx);
    this.entries = this.planes.map(() => []);
  }

  get count(): number { return this.heads.length; }

  add(L: Layers): void {
    const k = this.heads.length;
    this.planes.forEach((p, j) => {
      if (k % p.every !== 0) return;
      const out = new Uint8Array(p.size);
      p.get(L, out);
      this.entries[j].push(out);
    });
    this.heads.push({ nb: L.nb, t: L.t, pmax: L.pmax, vmax: L.vmax, vGas: L.vGas, vLiq: L.vLiq, nq: L.nq, nr: L.nr });
    this.bubbles.push(bytesOf(L.bubbles).slice(0, 8 * L.nb));
    this.quads.push(bytesOf(L.quads).slice(0, 2 * QUAD * L.nq));
    this.rects.push(bytesOf(L.rects).slice(0, 2 * RECT * L.nr));
  }

  /** Die Bytes des Stücks (ungepackt). */
  finish(): Uint8Array {
    const F = this.heads.length;
    let total = 4 + HEAD_BYTES * F;
    for (const list of this.entries) for (const e of list) total += e.length;
    for (const b of this.bubbles) total += b.length;
    for (const b of this.quads) total += b.length;
    for (const b of this.rects) total += b.length;
    const out = new Uint8Array(total);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, F, true);
    let o = 4;
    for (const h of this.heads) {
      dv.setUint32(o, h.nb, true);
      dv.setFloat64(o + 4, h.t, true);
      dv.setFloat64(o + 12, h.pmax, true);
      dv.setFloat64(o + 20, h.vmax, true);
      dv.setFloat64(o + 28, h.vGas, true);
      dv.setFloat64(o + 36, h.vLiq, true);
      dv.setUint32(o + 44, h.nq, true);
      dv.setUint32(o + 48, h.nr, true);
      o += HEAD_BYTES;
    }
    for (const list of this.entries) {
      list.forEach((cur, k) => {
        if (k === 0) out.set(cur, o);
        else {
          const prev = list[k - 1];
          for (let i = 0; i < cur.length; i += 1) out[o + i] = (cur[i] - prev[i]) & 255;
        }
        o += cur.length;
      });
    }
    for (const b of this.bubbles) { out.set(b, o); o += b.length; }
    /* Die Körper: ändert sich die Zahl nicht, der Unterschied zum vorigen Bild (ein angehefteter Körper wird Null). */
    for (const list of [this.quads, this.rects]) {
      list.forEach((cur, k) => {
        const prev = k > 0 ? list[k - 1] : null;
        if (prev !== null && prev.length === cur.length) for (let i = 0; i < cur.length; i += 1) out[o + i] = (cur[i] - prev[i]) & 255;
        else out.set(cur, o);
        o += cur.length;
      });
    }
    return out;
  }
}

/** Ein Block je Bild (Vierecke oder Rechtecke der Körper): bei gleicher Grösse wie im Bild davor ein Unterschied, sonst roh. */
class BlockSeq {
  private at = -1;
  private buf = new Uint8Array(0);

  constructor(private readonly bytes: Uint8Array, private readonly start: number[], private readonly size: number[]) {}

  /** Der Block von Bild k (eine Ansicht in einen wiederverwendeten Puffer). */
  get(k: number): Uint8Array {
    const { bytes, start, size } = this;
    let r = k;
    while (r > 0 && size[r - 1] === size[r]) r -= 1;
    if (this.at < r || this.at > k || this.buf.length < size[k]) {
      if (this.buf.length < size[k]) this.buf = new Uint8Array(Math.max(size[k], 2 * this.buf.length));
      this.buf.set(bytes.subarray(start[r], start[r] + size[r]));
      this.at = r;
    }
    while (this.at < k) {
      this.at += 1;
      const o = start[this.at];
      for (let i = 0; i < size[k]; i += 1) this.buf[i] = (this.buf[i] + bytes[o + i]) & 255;
    }
    return this.buf.subarray(0, size[k]);
  }
}

/** Ein Stück lesen: Bild k in Ebenen (der Reihe nach billig, rückwärts ab dem Anfang des Stücks). */
export class ChunkReader {
  readonly frames: number;
  private readonly bytes: Uint8Array;
  private readonly planes: Plane[];
  /** Je Ebene: Anfang ihres ersten Eintrags, der gerade aufgebaute Eintrag und seine Nummer. */
  private readonly planeAt: number[] = [];
  private readonly cur: Uint8Array[];
  private readonly at: number[];
  private readonly bubbleAt: number[] = [];
  /** Bytes je Bild im Kopf (Fassung 1 ohne Körper). */
  private readonly head: number;
  private readonly quadSeq: BlockSeq | null = null;
  private readonly rectSeq: BlockSeq | null = null;

  constructor(bytes: Uint8Array, nx: number, ny: number, dx: number, version = 2) {
    this.bytes = bytes;
    this.head = version >= 2 ? HEAD_BYTES : HEAD_V1;
    this.planes = planes(nx, ny, dx);
    this.cur = this.planes.map((p) => new Uint8Array(p.size));
    this.at = this.planes.map(() => -1);
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.frames = dv.getUint32(0, true);
    let o = 4 + this.head * this.frames;
    for (const p of this.planes) { this.planeAt.push(o); o += p.size * Math.ceil(this.frames / p.every); }
    for (let k = 0; k < this.frames; k += 1) {
      this.bubbleAt.push(o);
      o += 8 * dv.getUint32(4 + this.head * k, true);
    }
    if (this.head === HEAD_BYTES) {
      const qs: number[] = [];
      const qz: number[] = [];
      for (let k = 0; k < this.frames; k += 1) { qs.push(o); qz.push(2 * QUAD * dv.getUint32(4 + this.head * k + 44, true)); o += qz[k]; }
      const rs: number[] = [];
      const rz: number[] = [];
      for (let k = 0; k < this.frames; k += 1) { rs.push(o); rz.push(2 * RECT * dv.getUint32(4 + this.head * k + 48, true)); o += rz[k]; }
      this.quadSeq = new BlockSeq(bytes, qs, qz);
      this.rectSeq = new BlockSeq(bytes, rs, rz);
    }
  }

  /** Bild k (0 … frames − 1) in L schreiben (L wächst, wenn es mehr Blasen braucht); liefert L. */
  read(k: number, L: Layers): Layers {
    const { bytes } = this;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const h = 4 + this.head * k;
    const nb = dv.getUint32(h, true);
    let target = L;
    if (target.bubbles.length < 4 * nb) {
      const grown = allocLayers(L.nx, L.ny, L.dx, Math.ceil(nb * 1.5));
      grown.depth = L.depth;
      grown.boxW = L.boxW;
      grown.boxH = L.boxH;
      target = grown;
    }
    this.planes.forEach((p, j) => {
      const e = Math.floor(k / p.every);
      const cur = this.cur[j];
      if (e < this.at[j] || this.at[j] < 0) {
        cur.set(bytes.subarray(this.planeAt[j], this.planeAt[j] + p.size));
        this.at[j] = 0;
      }
      while (this.at[j] < e) {
        this.at[j] += 1;
        const o = this.planeAt[j] + this.at[j] * p.size;
        for (let i = 0; i < p.size; i += 1) cur[i] = (cur[i] + bytes[o + i]) & 255;
      }
      p.set(target, cur);
    });
    /* Die Skalen der Einblendungen gehören zum Bild, das ihre Ebenen trägt. */
    const ho = 4 + this.head * (OVERLAY_EVERY * Math.floor(k / OVERLAY_EVERY));
    target.t = dv.getFloat64(h + 4, true);
    target.pmax = dv.getFloat64(ho + 12, true);
    target.vmax = dv.getFloat64(ho + 20, true);
    target.vGas = dv.getFloat64(ho + 28, true);
    target.vLiq = dv.getFloat64(ho + 36, true);
    target.nb = nb;
    bytesOf(target.bubbles).set(bytes.subarray(this.bubbleAt[k], this.bubbleAt[k] + 8 * nb));
    /* Die Körper (Fassung 1: keine — dort zeichnete die Zelltextur sie). */
    target.nq = 0;
    target.nr = 0;
    if (this.quadSeq !== null && this.rectSeq !== null) {
      const q = this.quadSeq.get(k);
      const r = this.rectSeq.get(k);
      if (target.quads.length * 2 < q.length) target.quads = new Uint16Array(Math.ceil((q.length / 2) * 1.25) + QUAD * 16);
      if (target.rects.length * 2 < r.length) target.rects = new Uint16Array(Math.ceil((r.length / 2) * 1.25) + RECT * 4);
      bytesOf(target.quads).set(q);
      bytesOf(target.rects).set(r);
      target.nq = q.length / (2 * QUAD);
      target.nr = r.length / (2 * RECT);
    }
    return target;
  }
}

/* -- Packen mit dem deflate des Browsers ---------------------------------------------------------------- */

async function through(bytes: Uint8Array, stream: TransformStream<Uint8Array, Uint8Array>): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export const pack = (bytes: Uint8Array): Promise<Uint8Array> => through(bytes, new CompressionStream('deflate') as unknown as TransformStream<Uint8Array, Uint8Array>);
export const unpack = (bytes: Uint8Array): Promise<Uint8Array> => through(bytes, new DecompressionStream('deflate') as unknown as TransformStream<Uint8Array, Uint8Array>);
