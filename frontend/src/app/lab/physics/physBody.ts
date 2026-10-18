/**
 * 2026-10-18 — EIN KÖRPER DER FIZYKA 2D: Form, Stoff, Lage (Schwerpunkt und
 * Winkel), Geschwindigkeit, Masse und Trägheitsmoment, und die Kräfte, die in
 * diesem Schritt an ihm ziehen. Ein fester Körper (`static`) hat unendliche
 * Masse: der Boden, eine Wand, eine Rampe.
 */

import type { Shape } from './physShapes';

/** Ein Stoff: Dichte (kg/m³), Reibung, wie stark er zurückprallt, wie er aussieht. */
export interface Material {
  readonly key: string;
  readonly name: string;
  readonly density: number;
  readonly friction: number;
  readonly bounce: number;
  readonly color: string;
  /** Wie er gezeichnet wird: Maserung, Glanz, Körner … */
  readonly look: 'wood' | 'metal' | 'rubber' | 'ice' | 'stone' | 'plastic' | 'cork' | 'glass' | 'plain' | 'paper';
}

export const MATERIALS: Readonly<Record<string, Material>> = {
  wood: { key: 'wood', name: 'drewno', density: 600, friction: 0.5, bounce: 0.25, color: '#c8955a', look: 'wood' },
  oak: { key: 'oak', name: 'dąb', density: 750, friction: 0.55, bounce: 0.2, color: '#a87442', look: 'wood' },
  cork: { key: 'cork', name: 'korek', density: 240, friction: 0.6, bounce: 0.3, color: '#d9b27c', look: 'cork' },
  steel: { key: 'steel', name: 'stal', density: 7850, friction: 0.4, bounce: 0.35, color: '#9aa4ad', look: 'metal' },
  aluminium: { key: 'aluminium', name: 'aluminium', density: 2700, friction: 0.4, bounce: 0.35, color: '#c7ccd1', look: 'metal' },
  lead: { key: 'lead', name: 'ołów', density: 11340, friction: 0.5, bounce: 0.05, color: '#6f7479', look: 'metal' },
  gold: { key: 'gold', name: 'złoto', density: 19300, friction: 0.4, bounce: 0.2, color: '#d4af37', look: 'metal' },
  rubber: { key: 'rubber', name: 'guma', density: 1100, friction: 0.9, bounce: 0.8, color: '#3b3b3f', look: 'rubber' },
  ice: { key: 'ice', name: 'lód', density: 917, friction: 0.03, bounce: 0.1, color: '#cfe9f7', look: 'ice' },
  stone: { key: 'stone', name: 'kamień', density: 2600, friction: 0.6, bounce: 0.15, color: '#8c8478', look: 'stone' },
  plastic: { key: 'plastic', name: 'plastik', density: 950, friction: 0.35, bounce: 0.45, color: '#e0584f', look: 'plastic' },
  glass: { key: 'glass', name: 'szkło', density: 2500, friction: 0.3, bounce: 0.3, color: '#bfe3e8', look: 'glass' },
  /* Ein Blatt Papier ist im Bild viel dicker als in Wirklichkeit — seine Dichte ist darum die eines Blatts von 0,1 mm, auf die gezeichnete Dicke verteilt. */
  paper: { key: 'paper', name: 'kartka papieru', density: 60, friction: 0.5, bounce: 0.05, color: '#f3efe2', look: 'paper' },
  foam: { key: 'foam', name: 'styropian', density: 30, friction: 0.5, bounce: 0.2, color: '#f6f6f2', look: 'plain' },
  ball: { key: 'ball', name: 'piłka', density: 120, friction: 0.7, bounce: 0.85, color: '#e8823a', look: 'rubber' },
  egg: { key: 'egg', name: 'jajko', density: 1035, friction: 0.4, bounce: 0.1, color: '#f1e3c8', look: 'plain' }
};

export type BodyType = 'dynamic' | 'static';

export class Body {
  label: string;
  x = 0;
  y = 0;
  a = 0;
  vx = 0;
  vy = 0;
  w = 0;
  fx = 0;
  fy = 0;
  tq = 0;
  m = 0;
  invM = 0;
  I = 0;
  invI = 0;
  /** Die Ecken in der Welt (bei einem Vieleck) und die Umgrenzung — nach jeder Bewegung neu. */
  readonly wx: Float64Array;
  readonly wy: Float64Array;
  readonly wnx: Float64Array;
  readonly wny: Float64Array;
  minX = 0;
  minY = 0;
  maxX = 0;
  maxY = 0;
  /** Hat das Dokument ihm einen Namen gegeben (sonst steht an ihm nur seine Masse)? */
  named = false;
  /** Darf man ihn fassen und ziehen? Gewählt? Seine Spur zeichnen? */
  draggable = true;
  trace = false;
  /** Eine eigene Farbe (sonst die des Stoffs). */
  color: string | null = null;
  /** Wie viel von ihm gerade in einer Flüssigkeit steckt (Fläche, m²) — fürs Zeichnen und die Anzeige. */
  wet = 0;
  /** Kräfte dieses Schritts, zum Zeigen (Pfeile): Auftrieb. */
  lift = 0;

  constructor(readonly id: string, readonly shape: Shape, public material: Material, public type: BodyType, readonly depth: number) {
    const n = shape.kind === 'poly' ? shape.n : 0;
    this.wx = new Float64Array(n);
    this.wy = new Float64Array(n);
    this.wnx = new Float64Array(n);
    this.wny = new Float64Array(n);
    this.label = id;
    this.setMass();
  }

  /** Masse und Trägheitsmoment aus Form, Stoff und Tiefe der Szene. */
  setMass(): void {
    if (this.type === 'static') { this.m = 0; this.invM = 0; this.I = 0; this.invI = 0; return; }
    const rho = this.material.density * this.depth;
    if (this.shape.kind === 'circle') {
      this.m = rho * Math.PI * this.shape.r * this.shape.r;
      this.I = this.m * this.shape.r * this.shape.r / 2;
    } else {
      const s = this.shape;
      let area = 0;
      let inertia = 0;
      for (let i = 0; i < s.n; i += 1) {
        const x1 = s.xs[i]; const y1 = s.ys[i];
        const x2 = s.xs[(i + 1) % s.n]; const y2 = s.ys[(i + 1) % s.n];
        const c = x1 * y2 - x2 * y1;
        area += c / 2;
        inertia += c * (x1 * x1 + x1 * x2 + x2 * x2 + y1 * y1 + y1 * y2 + y2 * y2) / 12;
      }
      this.m = rho * area;
      this.I = rho * inertia;
    }
    this.m = Math.max(this.m, 1e-6);
    this.I = Math.max(this.I, 1e-9);
    this.invM = 1 / this.m;
    this.invI = 1 / this.I;
  }

  get fixed(): boolean {
    return this.type === 'static';
  }

  /** Die Ecken in der Welt und die Umgrenzung (nach jeder Bewegung). */
  update(): void {
    const s = this.shape;
    if (s.kind === 'circle') {
      this.minX = this.x - s.r; this.maxX = this.x + s.r;
      this.minY = this.y - s.r; this.maxY = this.y + s.r;
      return;
    }
    const c = Math.cos(this.a);
    const si = Math.sin(this.a);
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (let i = 0; i < s.n; i += 1) {
      const x = this.x + c * s.xs[i] - si * s.ys[i];
      const y = this.y + si * s.xs[i] + c * s.ys[i];
      this.wx[i] = x; this.wy[i] = y;
      this.wnx[i] = c * s.nx[i] - si * s.ny[i];
      this.wny[i] = si * s.nx[i] + c * s.ny[i];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    this.minX = minX; this.minY = minY; this.maxX = maxX; this.maxY = maxY;
  }

  /** Liegt ein Punkt der Welt in ihm (mit etwas Spielraum für den Finger)? */
  contains(px: number, py: number, slop = 0): boolean {
    const s = this.shape;
    if (s.kind === 'circle') return Math.hypot(px - this.x, py - this.y) <= s.r + slop;
    for (let i = 0; i < s.n; i += 1) {
      if ((px - this.wx[i]) * this.wnx[i] + (py - this.wy[i]) * this.wny[i] > slop) return false;
    }
    return true;
  }

  /** Ein Punkt in seinen eigenen Koordinaten → Welt, und zurück. */
  toWorld(lx: number, ly: number): [number, number] {
    const c = Math.cos(this.a);
    const s = Math.sin(this.a);
    return [this.x + c * lx - s * ly, this.y + s * lx + c * ly];
  }

  toLocal(wx: number, wy: number): [number, number] {
    const c = Math.cos(this.a);
    const s = Math.sin(this.a);
    const dx = wx - this.x;
    const dy = wy - this.y;
    return [c * dx + s * dy, -s * dx + c * dy];
  }

  /** Eine Kraft an einem Punkt der Welt (mit dem Drehmoment, das sie dort hat). */
  force(fx: number, fy: number, px: number, py: number): void {
    this.fx += fx;
    this.fy += fy;
    this.tq += (px - this.x) * fy - (py - this.y) * fx;
  }

  /** Bewegungsenergie (J): Verschiebung und Drehung. */
  kinetic(): number {
    return 0.5 * this.m * (this.vx * this.vx + this.vy * this.vy) + 0.5 * this.I * this.w * this.w;
  }
}
