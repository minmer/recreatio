/**
 * PARTIKEL-LABOR — DER SPEICHER DER FELDER: jedes Feld, über das die
 * Teilschritte rechnen, entsteht hier — auf einem SharedArrayBuffer, wenn
 * Helfer mitrechnen (die Seite ist „cross-origin isolated“, ARCHITECTURE.md
 * §8), sonst auf einem gewöhnlichen ArrayBuffer. Jedes Feld hat einen Namen;
 * ein Helfer baut aus der Liste (`blocks`) dieselben Sichten auf denselben
 * Speicher.
 */

export type Kind = 'f64' | 'f32' | 'i32' | 'u32' | 'u16' | 'u8';

export interface Block {
  readonly name: string;
  readonly kind: Kind;
  readonly length: number;
  readonly buffer: ArrayBuffer | SharedArrayBuffer;
}

const BYTES: Readonly<Record<Kind, number>> = { f64: 8, f32: 4, i32: 4, u32: 4, u16: 2, u8: 1 };

/** Ob dieser Ort gemeinsamen Speicher anlegen darf (im Browser nur isoliert, in Node immer). */
export const canShare = (): boolean =>
  typeof SharedArrayBuffer !== 'undefined' && (typeof crossOriginIsolated === 'undefined' || crossOriginIsolated);

export class Mem {
  readonly shared: boolean;
  readonly blocks: Block[] = [];

  constructor(shared: boolean) {
    this.shared = shared && canShare();
  }

  private buffer(name: string, kind: Kind, length: number): ArrayBuffer | SharedArrayBuffer {
    const bytes = Math.max(8, BYTES[kind] * length);
    const buffer = this.shared ? new SharedArrayBuffer(bytes) : new ArrayBuffer(bytes);
    this.blocks.push({ name, kind, length, buffer });
    return buffer;
  }

  f64(name: string, n: number): Float64Array { return new Float64Array(this.buffer(name, 'f64', n), 0, n); }
  f32(name: string, n: number): Float32Array { return new Float32Array(this.buffer(name, 'f32', n), 0, n); }
  i32(name: string, n: number): Int32Array { return new Int32Array(this.buffer(name, 'i32', n), 0, n); }
  u32(name: string, n: number): Uint32Array { return new Uint32Array(this.buffer(name, 'u32', n), 0, n); }
  u16(name: string, n: number): Uint16Array { return new Uint16Array(this.buffer(name, 'u16', n), 0, n); }
  u8(name: string, n: number): Uint8Array { return new Uint8Array(this.buffer(name, 'u8', n), 0, n); }
}

/** Die Sichten eines Helfers: nach Namen, aus den Blöcken des Rechners, der die Felder angelegt hat. */
export class Attached {
  private readonly byName = new Map<string, Block>();

  constructor(blocks: readonly Block[]) {
    for (const b of blocks) this.byName.set(b.name, b);
  }

  private get(name: string, kind: Kind): Block {
    const b = this.byName.get(name);
    if (b === undefined || b.kind !== kind) throw new Error(`Feld ${name} (${kind}) fehlt`);
    return b;
  }

  f64(name: string): Float64Array { const b = this.get(name, 'f64'); return new Float64Array(b.buffer, 0, b.length); }
  f32(name: string): Float32Array { const b = this.get(name, 'f32'); return new Float32Array(b.buffer, 0, b.length); }
  i32(name: string): Int32Array { const b = this.get(name, 'i32'); return new Int32Array(b.buffer, 0, b.length); }
  u32(name: string): Uint32Array { const b = this.get(name, 'u32'); return new Uint32Array(b.buffer, 0, b.length); }
  u16(name: string): Uint16Array { const b = this.get(name, 'u16'); return new Uint16Array(b.buffer, 0, b.length); }
  u8(name: string): Uint8Array { const b = this.get(name, 'u8'); return new Uint8Array(b.buffer, 0, b.length); }
}
