/**
 * 2026-10-18 — EIN SCHREIBER: Werte über der Zeit (Höhe, Geschwindigkeit,
 * Energie; Temperatur, pH, Druck, Gasvolumen) — gesammelt in einem Ring und
 * als Kurven gezeichnet, je Grösse eine Farbe, mit eigener Skala.
 */

export interface Series {
  readonly label: string;
  readonly unit: string;
  readonly color: string;
}

export class Recorder {
  readonly t: number[] = [];
  readonly v: number[][];

  constructor(readonly series: readonly Series[], private readonly keep = 900) {
    this.v = series.map(() => []);
  }

  /** Einen Augenblick aufschreiben (nicht öfter als alle 1/30 s). */
  add(t: number, values: readonly number[]): void {
    if (this.t.length > 0 && t - this.t[this.t.length - 1] < 1 / 30 && t >= this.t[this.t.length - 1]) return;
    if (this.t.length > 0 && t < this.t[this.t.length - 1]) this.clear();
    this.t.push(t);
    values.forEach((x, i) => this.v[i]?.push(x));
    if (this.t.length > this.keep) {
      this.t.shift();
      for (const s of this.v) s.shift();
    }
  }

  clear(): void {
    this.t.length = 0;
    for (const s of this.v) s.length = 0;
  }
}

/** Die Kurven in eine Leinwand (CSS-Bildpunkte w × h): Achse der Zeit unten, je Reihe ihre eigene Skala. */
export function drawRecorder(ctx: CanvasRenderingContext2D, rec: Recorder, w: number, h: number, ink: string, muted: string, font: string): void {
  ctx.clearRect(0, 0, w, h);
  const pad = { l: 6, r: 6, t: 16, b: 14 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;
  ctx.strokeStyle = muted;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t + ph + 0.5);
  ctx.lineTo(pad.l + pw, pad.t + ph + 0.5);
  ctx.stroke();
  ctx.globalAlpha = 1;
  const n = rec.t.length;
  ctx.font = font;
  if (n < 2) {
    ctx.fillStyle = muted;
    ctx.fillText('Wykres pojawi się, gdy coś się zacznie dziać.', pad.l, pad.t + ph / 2);
    return;
  }
  const t0 = rec.t[0];
  const t1 = rec.t[n - 1];
  const span = Math.max(1e-6, t1 - t0);
  rec.series.forEach((s, k) => {
    const vals = rec.v[k];
    let lo = Infinity;
    let hi = -Infinity;
    for (const x of vals) { if (Number.isFinite(x)) { if (x < lo) lo = x; if (x > hi) hi = x; } }
    if (!Number.isFinite(lo)) return;
    if (hi - lo < 1e-9) { lo -= 0.5; hi += 0.5; }
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const x = pad.l + ((rec.t[i] - t0) / span) * pw;
      const y = pad.t + ph - ((vals[i] - lo) / (hi - lo)) * ph;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const last = vals[n - 1];
    ctx.fillStyle = s.color;
    const text = `${s.label} ${Number.isFinite(last) ? last.toFixed(Math.abs(last) < 10 ? 2 : 1).replace('.', ',') : '–'}${s.unit === '' ? '' : ` ${s.unit}`}`;
    ctx.fillText(text, pad.l + k * Math.max(80, pw / rec.series.length), 11);
  });
  ctx.fillStyle = muted;
  ctx.fillText(`${span.toFixed(1).replace('.', ',')} s`, pad.l + pw - 30, h - 3);
  void ink;
}
