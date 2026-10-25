/**
 * LABOR 2D (v2) — DER WEG DER TEILCHEN (aus liquid.ts): RK2 im Gitterfeld,
 * Entweichen durch offene Seiten, Stoss an Feststoffen. Ein Teilchen, das in
 * einem Feststoff landet, wird längs des Abstandsfelds hinausgeschoben (die
 * Normalgeschwindigkeit fällt weg). An einem wachen Körper (M3a) entscheidet
 * dessen eigene Form: das Teilchen geht im Rahmen des Körpers auf seinem Weg
 * zurück vor die Seite, durch die es kam (bodyRaster.ts) — so dringt es auch
 * durch eine schräge Wand von einer Zelle Dicke nicht; seine Geschwindigkeit
 * in den Körper hinein (relativ zu ihm) fällt weg. Auch der Schub längs des
 * Abstandsfelds endet vor einem Körper (seit 2026-10-25): das Feld kennt nur
 * ganze feste Zellen und schob Wasser aus einer zugeklappten Zelle zwischen
 * einem schwimmenden Körper und einer Becherwand quer durch die Wand hinaus.
 * Tropfen fern der Flüssigkeit fliegen ballistisch und bleiben liegen, wo sie
 * landen.
 */

import type { Grid } from './grid';
import { WATER } from './materials';
import type { Particles } from './particles';

/**
 * Was die Körper zum Weg eines Teilchens sagen (von (x0, y0) nach (x, y)):
 * 0 — kein wacher Körper in der Nähe (das Abstandsfeld entscheidet);
 * 1 — es lag in einem Körper und wurde zurückgesetzt (out: x, y, Normale nx, ny, Geschwindigkeit des Körpers dort vx, vy);
 * 2 — es liegt in einer Zelle eines wachen Körpers, aber nicht in ihm (nichts zu tun).
 */
export type BodyHit = (x0: number, y0: number, x: number, y: number, out: Float64Array) => number;

/** Entwichenes dieses Schritts: Wasser (ohne Salz), andere Flüssigkeiten, Salz (kg), Energie (J). */
export interface Escaped { m: number; o: number; s: number; e: number }

/**
 * Alle Teilchen einen Schritt weiter. `stranded`: fliegt das Teilchen für
 * sich; `drift`: zusätzlicher Weg unaufgelöster Tröpfchen (oder null).
 */
export function moveParticles(
  P: Particles, g: Grid, dt: number, stranded: Uint8Array, drift: Float64Array | null,
  velocityAt: (x: number, y: number, out: Float64Array) => void, remove: (p: number) => void,
  bodyHit: BodyHit | null, vel: Float64Array, hit: Float64Array, out: Escaped
): void {
  const W = g.w;
  const H = g.h;
  const dx = g.dx;
  let escM = 0;
  let escO = 0;
  let escS = 0;
  let escE = 0;
  const st = stranded;
  for (let p = 0; p < P.count; p += 1) {
    const x0 = P.x[p];
    const y0 = P.y[p];
    const fly = st[p] !== 0;
    let x: number;
    let y: number;
    if (fly) {
      x = x0 + dt * P.vx[p];
      y = y0 + dt * P.vy[p];
    } else {
      velocityAt(x0, y0, vel);
      const xm = x0 + 0.5 * dt * vel[0];
      const ym = y0 + 0.5 * dt * vel[1];
      velocityAt(xm, ym, vel);
      x = x0 + dt * vel[0];
      y = y0 + dt * vel[1] + (drift !== null ? drift[p] : 0);
    }
    /* Offene Seiten: hinaus ist hinaus. */
    if ((x < 0 && g.openL) || (x > W && g.openR) || (y < 0 && g.openB) || (y > H && g.openT)) {
      const s = P.smass[2 * p];
      if (P.mat[p] === WATER) escM += P.mass[p] - s; else escO += P.mass[p] - s;
      escS += s;
      escE += P.mass[p] * P.h[p];
      /* Das letzte Teilchen rückt an p: seine Drift und sein Flug mit. */
      if (drift !== null) drift[p] = drift[P.count - 1];
      st[p] = st[P.count - 1];
      remove(p);
      p -= 1;
      continue;
    }
    const m = 1e-4 * dx;
    /* Ein fliegender Tropfen an einer Wand der Kiste bleibt dort (seine Geschwindigkeit in die Wand fällt weg). */
    if (fly && (x < m || x > W - m)) P.vx[p] = 0;
    if (fly && (y < m || y > H - m)) P.vy[p] = 0;
    x = Math.min(W - m, Math.max(m, x));
    y = Math.min(H - m, Math.max(m, y));
    /* Ein wacher Körper: seine eigene Form entscheidet (M3a). */
    const near = bodyHit !== null ? bodyHit(x0, y0, x, y, hit) : 0;
    if (near === 1) {
      x = hit[0];
      y = hit[1];
      const nx = hit[2];
      const ny = hit[3];
      if (fly) { P.vx[p] = hit[4]; P.vy[p] = hit[5]; }
      else {
        const vn = (P.vx[p] - hit[4]) * nx + (P.vy[p] - hit[5]) * ny;
        if (vn < 0) { P.vx[p] -= vn * nx; P.vy[p] -= vn * ny; }
      }
    } else if (near === 0) {
      /* Feststoffe: längs des Abstandsfelds hinaus, die Normalgeschwindigkeit fällt weg (ein fliegender Tropfen bleibt liegen). */
      let d = g.sdfAt(x, y);
      if (d < 0.05 * dx) {
        const xs = x;
        const ys = y;
        for (let it = 0; it < 3 && d < 0.05 * dx; it += 1) {
          const e = 0.25 * dx;
          let nxv = g.sdfAt(x + e, y) - g.sdfAt(x - e, y);
          let nyv = g.sdfAt(x, y + e) - g.sdfAt(x, y - e);
          const len = Math.hypot(nxv, nyv);
          if (len < 1e-12) break;
          nxv /= len;
          nyv /= len;
          const push = 0.05 * dx - d;
          x += push * nxv;
          y += push * nyv;
          const vn = P.vx[p] * nxv + P.vy[p] * nyv;
          if (fly) { P.vx[p] = 0; P.vy[p] = 0; }
          else if (vn < 0) { P.vx[p] -= vn * nxv; P.vy[p] -= vn * nyv; }
          x = Math.min(W - m, Math.max(m, x));
          y = Math.min(H - m, Math.max(m, y));
          d = g.sdfAt(x, y);
        }
        /* Der Schub endet vor dem ersten Körper auf seinem Weg (er lag ausserhalb aller: near === 0); ein Teilchen in einer zugeklappten Zelle neben einer dünnen Wand ginge sonst durch sie hindurch. */
        if (bodyHit !== null && (x !== xs || y !== ys) && bodyHit(xs, ys, x, y, hit) === 1) {
          x = hit[0];
          y = hit[1];
          if (fly) { P.vx[p] = hit[4]; P.vy[p] = hit[5]; }
          else {
            const vn = (P.vx[p] - hit[4]) * hit[2] + (P.vy[p] - hit[5]) * hit[3];
            if (vn < 0) { P.vx[p] -= vn * hit[2]; P.vy[p] -= vn * hit[3]; }
          }
        }
      }
    }
    P.x[p] = x;
    P.y[p] = y;
  }
  out.m = escM;
  out.o = escO;
  out.s = escS;
  out.e = escE;
}
