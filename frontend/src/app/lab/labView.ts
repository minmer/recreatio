/**
 * 2026-10-18 — DIE BÜHNE EINES LABORS: eine Leinwand (Canvas 2D, scharf auf
 * jedem Bildschirm), eine Kamera (Meter ↔ Bildpunkte, y nach oben) und eine
 * Schleife, die nur läuft, wenn sich etwas tut.
 *
 * <b>Canvas statt SVG</b>: Bläschen, Flammen, Dampf, Tropfen und Hunderte
 * Teilchen der Lupe sind in einem Canvas billig — als Elemente eines SVG
 * würde jedes einzelne zum DOM. Gezeichnet wird in Welt-Koordinaten (die
 * Kamera setzt die Transformation), Schrift in Bildpunkten (sie soll nicht
 * mitwachsen und nicht auf dem Kopf stehen).
 *
 * <b>Leicht fürs Telefon</b>: die Schleife steht, wenn das Labor ruht (alles
 * liegt still, keine Reaktion läuft), wenn es nicht zu sehen ist oder der Tab
 * verborgen ist — eine Berührung weckt sie.
 */

/* -- Die Kamera ------------------------------------------------------------------------------- */

export class Camera {
  /** Welcher Punkt der Welt in der Mitte steht, und wie viele Bildpunkte ein Meter ist. */
  cx = 0;
  cy = 0;
  scale = 60;
  /** Die Grösse der Bühne in CSS-Bildpunkten. */
  w = 300;
  h = 200;
  /** Wie weit man hinein- und herauszoomen darf (Bildpunkte je Meter). */
  min = 4;
  max = 2400;

  toScreenX(x: number): number { return this.w / 2 + (x - this.cx) * this.scale; }
  toScreenY(y: number): number { return this.h / 2 - (y - this.cy) * this.scale; }
  toWorldX(sx: number): number { return this.cx + (sx - this.w / 2) / this.scale; }
  toWorldY(sy: number): number { return this.cy - (sy - this.h / 2) / this.scale; }

  /** Ein Rechteck der Welt ganz zeigen (mit Rand in Bildpunkten). */
  fit(x0: number, y0: number, x1: number, y1: number, margin = 24): void {
    const w = Math.max(0.05, x1 - x0);
    const h = Math.max(0.05, y1 - y0);
    this.scale = Math.max(this.min, Math.min(this.max, Math.min((this.w - 2 * margin) / w, (this.h - 2 * margin) / h)));
    this.cx = (x0 + x1) / 2;
    this.cy = (y0 + y1) / 2;
  }

  /** Um einen Bildpunkt zoomen: was dort steht, bleibt dort. */
  zoomAt(sx: number, sy: number, factor: number): void {
    const wx = this.toWorldX(sx);
    const wy = this.toWorldY(sy);
    this.scale = Math.max(this.min, Math.min(this.max, this.scale * factor));
    this.cx = wx - (sx - this.w / 2) / this.scale;
    this.cy = wy + (sy - this.h / 2) / this.scale;
  }

  pan(dx: number, dy: number): void {
    this.cx -= dx / this.scale;
    this.cy += dy / this.scale;
  }

  /** Die Transformation in Welt-Koordinaten (y nach oben) — `dpr`: Bildpunkte des Geräts je CSS-Bildpunkt. */
  apply(ctx: CanvasRenderingContext2D, dpr: number): void {
    ctx.setTransform(dpr * this.scale, 0, 0, -dpr * this.scale, dpr * (this.w / 2 - this.cx * this.scale), dpr * (this.h / 2 + this.cy * this.scale));
  }

  /** Zurück in Bildpunkte (für Schrift und Bedienelemente). */
  screen(ctx: CanvasRenderingContext2D, dpr: number): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

/* -- Die Leinwand ----------------------------------------------------------------------------- */

/** Die Leinwand auf ihre Grösse bringen (scharf: so viele Bildpunkte, wie das Gerät hat) — gibt `dpr` zurück. */
export function fitCanvas(canvas: HTMLCanvasElement, cssW: number, cssH: number): number {
  const dpr = Math.min(2.5, Math.max(1, window.devicePixelRatio || 1));
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  return dpr;
}

/* -- Die Schleife ----------------------------------------------------------------------------- */

/**
 * EIN BILD NACH DEM ANDEREN, solange etwas geschieht: `tick(dt)` rechnet
 * (und sagt, ob noch etwas läuft), `draw()` zeichnet. Höchstens 60 Bilder in
 * der Sekunde; nach einer Pause beginnt die Zeit nicht mit einem Sprung.
 * Gibt `tick` eine Zahl zurück, läuft es gemächlich weiter (so viele
 * Millisekunden bis zum nächsten Bild) — ein Becher, der nur noch abkühlt.
 */
export class Loop {
  private raf = 0;
  private timer = 0;
  private last = 0;
  private slow = false;
  private visible = true;
  private stopped = false;

  constructor(private readonly tick: (dt: number) => boolean | number, private readonly draw: () => void) {
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) this.halt(); else this.wake();
  };

  private readonly frame = (now: number): void => {
    this.raf = 0;
    if (this.stopped || !this.visible || document.hidden) { this.last = 0; return; }
    if (this.last !== 0 && now - this.last < 14) { this.raf = requestAnimationFrame(this.frame); return; }
    const dt = this.last === 0 ? 1 / 60 : Math.min(this.slow ? 0.4 : 0.05, (now - this.last) / 1000);
    this.last = now;
    const busy = this.tick(dt);
    this.draw();
    if (busy === true) { this.slow = false; this.raf = requestAnimationFrame(this.frame); }
    else if (typeof busy === 'number' && busy > 0) {
      this.slow = true;
      this.timer = window.setTimeout(() => { this.timer = 0; if (!this.stopped && this.raf === 0) this.raf = requestAnimationFrame(this.frame); }, busy);
    } else { this.last = 0; this.slow = false; }
  };

  /** Etwas hat sich geändert: weiterlaufen (oder einmal zeichnen). */
  wake(): void {
    if (this.stopped) return;
    if (this.timer !== 0) { window.clearTimeout(this.timer); this.timer = 0; }
    if (this.raf !== 0) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Zu sehen oder nicht (aus dem Bild gerollt, Szene fort). */
  show(on: boolean): void {
    this.visible = on;
    if (on) this.wake(); else this.halt();
  }

  private halt(): void {
    if (this.raf !== 0) cancelAnimationFrame(this.raf);
    if (this.timer !== 0) window.clearTimeout(this.timer);
    this.timer = 0;
    this.raf = 0;
    this.last = 0;
  }

  dispose(): void {
    this.stopped = true;
    this.halt();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}

/* -- Gesten ----------------------------------------------------------------------------------- */

export interface Gestures {
  /** Ein Finger (oder die Maus) setzt auf — `true`: diese Geste gehört dem Labor (ein Ding), sonst wird verschoben. */
  readonly down: (sx: number, sy: number, event: PointerEvent) => boolean;
  readonly move: (sx: number, sy: number, event: PointerEvent) => void;
  readonly up: (sx: number, sy: number, event: PointerEvent, tap: boolean) => void;
  /** Ohne Ding: verschieben (Bildpunkte), zwei Finger oder Strg+Rad: zoomen. */
  readonly pan: (dx: number, dy: number) => void;
  readonly zoom: (sx: number, sy: number, factor: number) => void;
  /** Ob ein Finger die Seite rollen darf (ausserhalb des Vollbilds, über leerem Grund). */
  readonly scrolls: () => boolean;
  /** Liegt unter diesem Punkt etwas, das der Finger fassen kann? (Dann rollt die Seite nicht.) */
  readonly grabs: (sx: number, sy: number) => boolean;
}

/**
 * DIE GESTEN EINER LEINWAND: fassen, ziehen, tippen, verschieben, zwei
 * Finger zum Zoomen, Strg+Rad (im Vollbild auch ohne Strg). Ein Finger auf
 * einem Ding hält die Seite an (`touchstart` wird dort abgefangen); auf
 * leerem Grund rollt die Seite weiter, solange das Labor nicht im Vollbild ist.
 */
export function attachGestures(canvas: HTMLCanvasElement, g: Gestures): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let owner: number | null = null;
  let panning: number | null = null;
  let start: { x: number; y: number; t: number } | null = null;
  let moved = false;
  let pinch: { d: number; mx: number; my: number } | null = null;

  const local = (event: PointerEvent | WheelEvent | Touch): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  };

  const onDown = (event: PointerEvent) => {
    if (event.button > 0) return;
    const p = local(event);
    pointers.set(event.pointerId, p);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      if (owner !== null) { g.up(p.x, p.y, event, false); owner = null; }
      panning = null;
      return;
    }
    start = { x: p.x, y: p.y, t: performance.now() };
    moved = false;
    canvas.setPointerCapture?.(event.pointerId);
    if (g.down(p.x, p.y, event)) { owner = event.pointerId; event.preventDefault(); return; }
    panning = event.pointerId;
  };

  const onMove = (event: PointerEvent) => {
    const p = local(event);
    const was = pointers.get(event.pointerId);
    if (was === undefined) return;
    pointers.set(event.pointerId, p);
    if (pinch !== null && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      g.pan(mx - pinch.mx, my - pinch.my);
      g.zoom(mx, my, d / pinch.d);
      pinch = { d, mx, my };
      event.preventDefault();
      return;
    }
    if (start !== null && Math.hypot(p.x - start.x, p.y - start.y) > 5) moved = true;
    if (owner === event.pointerId) { g.move(p.x, p.y, event); event.preventDefault(); return; }
    if (panning === event.pointerId && moved && !(event.pointerType === 'touch' && g.scrolls())) {
      g.pan(p.x - was.x, p.y - was.y);
      event.preventDefault();
    }
  };

  const onUp = (event: PointerEvent) => {
    const p = local(event);
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    const tap = !moved && start !== null && performance.now() - start.t < 450 && event.type === 'pointerup';
    if (owner === event.pointerId) { owner = null; g.up(p.x, p.y, event, tap); return; }
    if (panning === event.pointerId) {
      panning = null;
      if (tap) g.up(p.x, p.y, event, true);
    }
  };

  const onWheel = (event: WheelEvent) => {
    if (!(event.ctrlKey || event.metaKey) && g.scrolls()) return;
    event.preventDefault();
    const p = local(event);
    g.zoom(p.x, p.y, Math.exp(-event.deltaY * 0.0022));
  };

  /* Ein Finger auf einem Ding: die Seite rollt nicht (Chrome fragt `touch-action` nur beim Aufsetzen). */
  const onTouchStart = (event: TouchEvent) => {
    if (!event.cancelable) return;
    if (event.touches.length > 1 && !g.scrolls()) { event.preventDefault(); return; }
    const t = event.touches[0];
    if (t === undefined) return;
    const p = local(t);
    if (g.grabs(p.x, p.y) || !g.scrolls()) event.preventDefault();
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  return () => {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('touchstart', onTouchStart);
  };
}
