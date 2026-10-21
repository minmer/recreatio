/**
 * LABOR 2D (v2) — DIE BLASEN ALS MODELL (ARCHITECTURE.md §8): Keimbildung an
 * Kavitäten, Wachsen und Kondensieren, Ablösen, Bewegung, Verschmelzen,
 * Platzen. Nichts davon ist ein Skript: jede Blase entsteht, wächst, löst
 * sich und vergeht, weil die örtlichen Bedingungen es verlangen.
 *
 * - <b>Kavitäten</b>: jede feste Oberflächenfläche trägt bis zu acht
 *   Kavitäten; ihre Mündungsradien folgen aus einer Potenzverteilung, die für
 *   Stahl die aktive Keimstellendichte von Lemmert & Chawla (1977),
 *   N = (210 ΔT_w)^1,805 m⁻², wiedergibt (ΔT_act ∝ 1/r_c, kalibriert bei
 *   1 atm); Glas hat wenige und kleine (bis 3 µm), Siedesteine viele und
 *   grosse (bis 150 µm) — Werte in materials.json. Gezogen einmal je Fläche
 *   mit einem Hash des Samens (unabhängig von der Reihenfolge der Wände).
 * - <b>Aktiv</b> ist eine Kavität, wenn T_f − T_sat(p_l) ≥ ΔT_act =
 *   T_sat(p_l + 2σ/r_c) − T_sat(p_l), mit der Kontakttemperatur
 *   T_f = (k_s T_s + k_l T_l)/(k_s + k_l). Nach dem Ablösen startet sie erst,
 *   wenn T_f die Schwelle wieder erreicht — die Wartezeit ergibt sich.
 * - <b>Wachsen und Kondensieren</b>: dm_v/dt = h A (T_l − T_sat(p_v)) /
 *   (h_v(T_b) − h_l(T_l)), h = max(k_l √(3/(π α_l t_b)), (k_l/d)(2 + 0,6
 *   Re^½ Pr^⅓)) — der erste Term ist genau das Wachstumsgesetz von Plesset
 *   & Zwick (1954), über jeden Teilschritt geschlossen integriert, der zweite
 *   Ranz & Marshall (1952). Eine hängende Blase nimmt T_f und die Wärme aus der
 *   Wandzelle. Je Schritt wird begrenzt, damit keine Zelle durch diesen
 *   Austausch über T_sat hinaus (oder darunter) gerät.
 * - <b>Ablösen</b> beim Fritz-Durchmesser D_d = 0,0208 θ √(σ/(g Δρ)) (θ in Grad,
 *   je Werkstoff — Demirkır et al. 2024 zu seinen Grenzen).
 * - <b>Bewegung</b>: (ρ_v + C_A ρ_l) V dv/dt = −V∇p_l + ρ_v V g + C_A ρ_l V Du/Dt
 *   − C_A ρ_l V̇ (v − u) − ½ C_D ρ_l A⊥ |v − u| (v − u), C_A = ½, C_D nach
 *   Tomiyama et al. (1998) für verunreinigtes Wasser (wie OpenFOAM
 *   TomiyamaKataokaZunSakaguchi): max(24/Re (1 + 0,15 Re^0,687), 8/3 Eo/(Eo + 4)).
 *   u und ∇p werden ausserhalb der eigenen Spur gelesen (sonst ritte die Blase
 *   auf ihrem Nachlauf); Widerstand und virtuelle Masse wirken umgekehrt auf
 *   die Flüssigkeit (Delnoij et al. 1997) — Blasen treiben die Strömung.
 * - <b>Verschmelzen</b>, wenn sich zwei Blasen in 3D überlappen (mit ihrer
 *   Tiefe z): Masse, Impuls und Energie bleiben. <b>Platzen</b> an der freien
 *   Oberfläche: Inhalt und Enthalpie gehen in die Gaszelle darüber.
 * - Volumen in den Zellen: α_b; seine Änderung (Wachsen, Bewegen, Platzen) ist
 *   eine Quelle der Divergenz der Flüssigkeit.
 */

import { Bubbles, FORCE_SLOTS } from './bubbles';
import { ALPHA_RATE, bubbleEnthalpy, footprint, solveBubble, type BubbleShape } from './bubbleState';
import { BubbleMotion } from './bubbleMotion';
import { activation, Cavities } from './cavities';
import type { Engine, ProbeInfo } from './engine';
import { rhoVapourSatFast, tSat } from './if97';
import { cpLiq, hGas, hL, hV, kLiq, MOLAR, muLiq, rhoLiq, sigmaLiq, SOLIDS } from './materials';
import { GAS, H2O, LIQUID, N2, O2, SOLID, SPECIES_SLOTS } from './units';

/** Fritz (1935): 0,0208 je Grad Kontaktwinkel. */
const FRITZ = 0.0208;
/**
 * Teilschritt des Wachstums höchstens dieser Bruchteil des Alters: der Radius
 * ändert sich je Teilschritt um höchstens etwa die Hälfte (Plesset–Zwick: r ∝ √t,
 * Δr/r ≈ h/(2t)). Das Wachstum selbst ist über jeden Teilschritt geschlossen
 * integriert; der Schritt folgt nur der Laplace-Überhitzung 2σ/r, die sich mit r
 * ändert. (0,25 kostete je neuer Blase rund 50 Teilschritte im ersten Schritt.)
 */
const AGE_STEP = 1;

export class BubbleModel {
  private readonly e: Engine;
  /** Dampf, der mit platzenden Blasen ins Gas ging (kg, seit dem Start). */
  burstVapour = 0;
  /** Zähler seit dem Start. */
  nucleated = 0;
  departed = 0;
  merged = 0;
  burst = 0;
  collapsed = 0;
  /** Schicksal der Blasen, getrennt danach, ob das Wasser im Mittel mindestens 5 K unter T_sat war (Test 10). */
  burstCold = 0;
  collapsedCold = 0;
  burstWarm = 0;
  collapsedWarm = 0;
  /** Überhitzung der Wand T_f − T_sat bei der ersten Keimbildung und ihr Werkstoff (Test 12). */
  firstSuperheat: number | null = null;
  firstMaterial: string | null = null;
  /** Die letzten Abreissdurchmesser (m) (Test 8). */
  readonly departures = new Float64Array(256);
  departureCount = 0;
  /** Prüfstand: ein anderer Kontaktwinkel für alle Werkstoffe (Grad). */
  contactAngleOverride: number | null = null;
  /** Die gewählte Blase (Kennung, −1: keine). Verschmilzt sie, zeigt watch auf die überlebende; wird sie entfernt, wird watch −1. */
  watch = -1;
  /** Was aus der gewählten Blase wurde: 0 lebt, 1 an der Oberfläche geplatzt, 2 vergangen (kondensiert), 3 in eine andere aufgegangen. */
  watchFate = 0;
  /** Die Kavitäten der festen Oberflächen (cavities.ts). */
  private readonly sites = new Cavities();
  /** Die Bewegung freier Blasen (bubbleMotion.ts); hält auch die zuletzt gesehene Flüssigkeitsgeschwindigkeit je Blase. */
  private readonly motion: BubbleMotion;
  /* Arbeitsfelder. */
  private readonly shape: BubbleShape = { r: 0, V: 0, pb: 0, pv: 0, Tb: 0, area: 0, front: 0 };
  private readonly cells = new Int32Array(1024);
  private readonly wts = new Float64Array(1024);
  /** Die Spur der Blasen (Σ w V_b/V_Zelle); grid.alpha folgt ihr höchstens mit ALPHA_RATE. */
  private readonly alphaTarget: Float32Array;
  private readonly budget: Float64Array;
  private readonly tsatCell: Float64Array;
  private readonly Fm: Float64Array;
  private readonly vel = new Float64Array(2);
  private readonly head: Int32Array;
  private readonly next: Int32Array;
  private bulkCold = false;

  constructor(engine: Engine) {
    this.e = engine;
    const n = engine.grid.n;
    this.alphaTarget = new Float32Array(n);
    this.budget = new Float64Array(n);
    this.tsatCell = new Float64Array(n);
    this.Fm = new Float64Array(n);
    const cap = engine.bubbles.cap;
    this.motion = new BubbleMotion(engine);
    this.head = new Int32Array(n);
    this.next = new Int32Array(cap);
  }

  private get B(): Bubbles { return this.e.bubbles; }

  /* -- Kavitäten (cavities.ts) ------------------------------------------------------------------------ */

  /** Die Kavitäten aller festen Oberflächenflächen neu auslegen (nach jeder Änderung der Feststoffe); hängende Blasen verlieren ihre. */
  rebuildSites(): void {
    this.sites.rebuild(this.e.grid, this.e.scene.seed);
    const B = this.B;
    for (let b = 0; b < B.count; b += 1) B.site[b] = -1;
  }

  /** Grösster Mündungsradius einer Kavität aus Werkstoff `id` (m) — für Anzeigen und Test 12. */
  largestCavity(id: string): number {
    return this.sites.largest(this.e.grid, id);
  }

  /** ΔT_act einer Kavität des Radius r beim Druck p. */
  activation(r: number, p: number): number {
    return activation(r, p);
  }

  get siteCount(): number { return this.sites.count; }

  /** Für den beschleunigten Weg (gpu/): die Kavitäten und die zuletzt gesehenen Flüssigkeitsgeschwindigkeiten der Blasen. */
  get cavities(): Cavities { return this.sites; }
  get motionState(): BubbleMotion { return this.motion; }

  /* -- Hilfen ---------------------------------------------------------------------------------------- */

  /** Absoluter Druck der Flüssigkeit an (x, y): bilinear über die nicht festen Zellmitten. */
  private pressure(x: number, y: number): number {
    const e = this.e;
    const g = e.grid;
    const { nx, ny, dx } = g;
    const fx = Math.min(nx - 1.0001, Math.max(0, x / dx - 0.5));
    const fy = Math.min(ny - 1.0001, Math.max(0, y / dx - 0.5));
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    let s = 0;
    let w = 0;
    for (let b = 0; b < 2; b += 1) for (let a = 0; a < 2; a += 1) {
      const c = i + a + (j + b) * nx;
      if (g.solid[c] !== 0) continue;
      const ww = (a === 0 ? 1 - tx : tx) * (b === 0 ? 1 - ty : ty);
      s += ww * g.pl[c];
      w += ww;
    }
    return e.pRef + (w > 0 ? s / w : 0);
  }

  /** Die Spur einer Blase in cells/wts (nur flüssige Zellen, auf Summe 1); Rückgabe: Anzahl (0: keine Flüssigkeit). */
  private liquidFootprint(b: number): number {
    const e = this.e;
    const g = e.grid;
    const B = this.B;
    const k = footprint(B.x[b], B.y[b], B.r[b], B.V[b], g.depth, g.dx, g.nx, g.ny, this.cells, this.wts);
    let sum = 0;
    let m = 0;
    for (let q = 0; q < k; q += 1) {
      const c = this.cells[q];
      if (g.kind[c] !== LIQUID) continue;
      this.cells[m] = c;
      this.wts[m] = this.wts[q];
      sum += this.wts[q];
      m += 1;
    }
    for (let q = 0; q < m; q += 1) this.wts[q] /= sum;
    return sum > 0 ? m : 0;
  }

  /** Den Zustand der Blase b lösen (Druck der Flüssigkeit an ihrer Mitte, die Oberflächenspannung der Flüssigkeit um sie). */
  private solve(b: number, Tl: number): void {
    const B = this.B;
    const g = this.e.grid;
    const s = this.shape;
    solveBubble(B.m, b * SPECIES_SLOTS, this.pressure(B.x[b], B.y[b]), Tl, g.depth, B.r[b], s, this.e.phase.hostAt(B.x[b], B.y[b]));
    B.r[b] = s.r;
    B.V[b] = s.V;
    B.pb[b] = s.pb;
    B.pv[b] = s.pv;
    B.Tb[b] = s.Tb;
  }

  /* -- Ein Schritt ----------------------------------------------------------------------------------- */

  step(dt: number): void {
    const e = this.e;
    const g = e.grid;
    const B = this.B;
    const phase = e.phase;
    phase.gatherLiquid();
    const { n, kind } = g;
    /* Wieviel Wärme jede flüssige Zelle bis T_sat hergeben (positiv) oder aufnehmen (negativ) kann. */
    for (let c = 0; c < n; c += 1) {
      if (kind[c] !== LIQUID) { this.budget[c] = 0; this.tsatCell[c] = 0; continue; }
      const Ts = tSat(e.pRef + g.pl[c]);
      this.tsatCell[c] = Ts;
      this.budget[c] = phase.Cl[c] * (phase.Tl[c] - Ts);
    }
    this.Fm.fill(0);
    const wt = e.waterTemperature();
    this.bulkCold = wt.mass > 0 && wt.mean <= tSat(e.regions.pAmb) - 5;
    if (B.count > 0 || this.sites.count > 0) {
      this.nucleate(dt);
      for (let b = 0; b < B.count; b += 1) this.advance(b, dt);
      this.coalesce();
      for (let b = B.count - 1; b >= 0; b -= 1) this.finish(b, dt);
    }
    phase.applyMass(this.Fm, dt);
    this.updateAlpha(dt);
  }

  /** Neue Blasen an aktiven Kavitäten (ohne hängende Blase, die Zelle davor flüssig). */
  private nucleate(dt: number): void {
    const e = this.e;
    const g = e.grid;
    const B = this.B;
    const phase = e.phase;
    for (let s = 0; s < this.sites.count; s += 1) {
      if (this.sites.bubble[s] !== 0) continue;
      const fc = this.sites.fluid[s];
      /* Keime nur im Wasser (der einzigen flüchtigen Flüssigkeit): die Zelle vor der Kavität muss vor allem Wasser sein. */
      if (g.kind[fc] !== LIQUID || phase.acc[fc] <= 0 || phase.waterShare(fc) < 0.5) continue;
      const sc = this.sites.cell[s];
      const mat = SOLIDS[g.solid[sc] - 1];
      const Tl = phase.Tl[fc];
      const kl = kLiq(phase.host[fc], Tl);
      const Tf = (mat.k * g.T[sc] + kl * Tl) / (mat.k + kl);
      const pl = e.pRef + g.pl[fc];
      const Ts = this.tsatCell[fc] > 0 ? this.tsatCell[fc] : tSat(pl);
      if (Tf - Ts < 0) continue;
      const rc = this.sites.r[s];
      if (Tf - Ts < activation(rc, pl)) continue;
      /* Keim: reiner Dampf, gesättigt beim Druck in der Kavitätenmündung. */
      const pb = pl + (2 * sigmaLiq(phase.host[fc], Tf)) / rc;
      const Tb = tSat(pb);
      const V = (4 / 3) * Math.PI * rc * rc * rc;
      const mv = rhoVapourSatFast(Tb) * V;
      if (mv * 4 > phase.acc[fc]) continue;
      const pos = this.sites.position(this.e.grid, s, rc);
      const b = B.add(pos[0], pos[1], Math.min(g.depth - rc, Math.max(rc, this.sites.z[s] * g.depth)));
      if (b < 0) return;
      B.m[b * SPECIES_SLOTS + H2O] = mv;
      B.r[b] = rc;
      B.V[b] = V;
      B.Tb[b] = Tb;
      B.pb[b] = pb;
      B.pv[b] = pb;
      B.H[b] = mv * hV(Tb);
      B.site[b] = s;
      B.age[b] = 0;
      this.sites.bubble[s] = B.id[b];
      this.motion.ux0[b] = 0;
      this.motion.uy0[b] = 0;
      /* Die Masse aus den Teilchen vor der Kavität, die Wärme aus der Wand. */
      const hbar = phase.waterH(fc);
      this.Fm[fc] -= mv;
      e.heat.src[sc] -= (mv * (hV(Tb) - hbar)) / dt;
      this.nucleated += 1;
      if (this.firstSuperheat === null) {
        this.firstSuperheat = Tf - Ts;
        this.firstMaterial = mat.id;
      }
    }
  }

  /** Wachsen und Bewegen der Blase b über Δt, in eigenen Teilschritten. */
  private advance(b: number, dt: number): void {
    const e = this.e;
    const g = e.grid;
    const B = this.B;
    const phase = e.phase;
    const o = b * SPECIES_SLOTS;
    let site = B.site[b];
    let t = 0;
    const V0 = B.V[b];
    let grew = 0;
    let Vprev = V0;
    while (t < dt - 1e-12) {
      Vprev = B.V[b];
      const r = B.r[b];
      const vmag = Math.hypot(B.vx[b], B.vy[b]);
      let h = Math.min(dt - t, Math.max(1e-7, AGE_STEP * B.age[b]), (0.25 * g.dx) / (vmag + 1e-9));
      if (h < 1e-7) h = Math.min(dt - t, 1e-7);
      /* Die treibende Temperatur: hängend die Kontakttemperatur, frei die Flüssigkeit der Spur. */
      let Tl: number;
      let srcCell = -1;
      let k = 0;
      if (site >= 0) {
        const fc = this.sites.fluid[site];
        const sc = this.sites.cell[site];
        const mat = SOLIDS[g.solid[sc] - 1];
        const Tw = phase.Tl[fc];
        const kl = kLiq(phase.host[fc], Tw);
        Tl = (mat.k * g.T[sc] + kl * Tw) / (mat.k + kl);
        srcCell = sc;
      } else {
        k = this.liquidFootprint(b);
        if (k === 0) break;
        Tl = 0;
        for (let q = 0; q < k; q += 1) Tl += this.wts[q] * phase.Tl[this.cells[q]];
      }
      const Tb = B.Tb[b];
      /* Stoffwerte der Flüssigkeit um die Blase (Wasser, oder Öl über einer Wasserschicht). */
      const hm = site >= 0 ? phase.host[this.sites.fluid[site]] : phase.hostAt(B.x[b], B.y[b]);
      const kl = kLiq(hm, Tl);
      const rhol = rhoLiq(hm, Tl);
      const cpl = cpLiq(hm, Tl);
      const mul = muLiq(hm, Tl);
      const alpha = kl / (rhol * cpl);
      const d = 2 * r;
      /* Plesset–Zwick über den Teilschritt geschlossen integriert: ∫ k √(3/(π α t)) dt = k √(3/(π α)) · 2(√t₁ − √t₀). */
      const age = B.age[b];
      const pzk = kl * Math.sqrt(3 / (Math.PI * alpha));
      const slip = site >= 0 ? 0 : Math.hypot(B.vx[b] - this.motion.ux0[b], B.vy[b] - this.motion.uy0[b]);
      const Re = (rhol * slip * d) / mul;
      const Pr = (mul * cpl) / kl;
      const hRM = (kl / d) * (2 + 0.6 * Math.sqrt(Re) * Math.cbrt(Pr));
      const L = hV(Tb) - hL(Tl);
      /* ∫ h dt über den Teilschritt: der grössere der beiden Übergänge. */
      let hInt = Math.max(pzk * 2 * (Math.sqrt(age + h) - Math.sqrt(age)), hRM * h);
      /* Eine hängende Blase, die in diesem Teilschritt den Abreissdurchmesser erreichte: den Teilschritt genau dort enden lassen. */
      if (site >= 0 && Tl > Tb) {
        const rdep = 0.5 * this.fritz(b, Tl);
        const rv = B.m[o + H2O] > 0 ? B.m[o + H2O] / B.V[b] : rhoVapourSatFast(Tb);
        const drPlan = (hInt * (Tl - Tb)) / (rv * L);
        if (r < rdep && r + drPlan > rdep && drPlan > 0) {
          /* Der Bruchteil des Radiuszuwachses, der bis zum Abriss fehlt — h so verkleinern, dass ∫h dt genau dazu passt. */
          const want = (hInt * (rdep - r)) / drPlan;
          if (hRM * h >= pzk * 2 * (Math.sqrt(age + h) - Math.sqrt(age))) h = want / hRM;
          else { const sq = Math.sqrt(age) + want / (2 * pzk); h = sq * sq - age; }
          h = Math.max(1e-9, Math.min(dt - t, h * (1 + 1e-6)));
          hInt = Math.max(pzk * 2 * (Math.sqrt(age + h) - Math.sqrt(age)), hRM * h);
        }
      }
      /*
       * Für Kugel und Scheibe folgt aus der Energiebilanz dr/dt = h ΔT/(ρ_v L),
       * unabhängig von r: der Radius wächst genau um ∫h dt · ΔT/(ρ_v L), und die
       * Masse ist die Volumenänderung mal ρ_v (mit der Fläche vom Anfang des
       * Teilschritts wüchse die Blase zu langsam). Im Übergang Kugel → Scheibe
       * (r = D/2 fest, Fläche π D²) wächst das Volumen linear.
       */
      const D = g.depth;
      const V = B.V[b];
      const rhov = B.m[o + H2O] > 0 ? B.m[o + H2O] / V : rhoVapourSatFast(Tb);
      const dr = (hInt * (Tl - Tb)) / (rhov * L);
      const r1 = Math.max(0, r + dr);
      let dV: number;
      if (V <= (Math.PI * D * D * D) / 6) dV = (4 / 3) * Math.PI * (r1 * r1 * r1 - r * r * r);
      else if (V >= (Math.PI * D * D * D) / 4) dV = Math.PI * D * (r1 * r1 - r * r);
      else dV = (Math.PI * D * D * hInt * (Tl - Tb)) / (rhov * L);
      let Q = rhov * dV * L;
      /* Begrenzen: keine Zelle durch diesen Austausch über T_sat hinaus (oder darunter). */
      if (site >= 0) {
        const sc = srcCell;
        const mat = SOLIDS[g.solid[sc] - 1];
        const cap = mat.rho * mat.cp * g.vCell * Math.max(0, g.T[sc] - Tb);
        if (Q > 0) Q = Math.min(Q, Math.max(0, cap - this.used(sc)));
      } else {
        let avail = 0;
        for (let q = 0; q < k; q += 1) avail += this.wts[q] * this.budget[this.cells[q]];
        if (Q > 0) Q = Math.min(Q, Math.max(0, avail));
        else Q = Math.max(Q, Math.min(0, avail));
      }
      let dm = Q / L;
      if (dm < 0) dm = Math.max(dm, -B.m[o + H2O]);
      /*
       * Nur Wasser verdampft in die Blase und nimmt ihr Kondensat auf: frei
       * zählt jede Zelle der Spur mit dem Anteil des Wassers an ihrer
       * Flüssigkeit (reines Wasser: 1, wie vor M2a). In reinem Öl tauscht eine
       * Dampfblase keine Masse (SIMPLIFICATIONS.md) — sie steigt und platzt.
       */
      let fwSum = 1;
      if (site < 0 && dm !== 0 && phase.mixed) {
        fwSum = 0;
        for (let q = 0; q < k; q += 1) fwSum += this.wts[q] * phase.waterShare(this.cells[q]);
        dm *= fwSum;
      }
      if (dm !== 0) {
        if (site >= 0) {
          const fc = this.sites.fluid[site];
          if (dm > 0 && phase.acc[fc] + this.Fm[fc] - dm < 0) dm = Math.max(0, phase.acc[fc] + this.Fm[fc]);
          const hbar = phase.waterH(fc);
          this.Fm[fc] -= dm;
          e.heat.src[srcCell] -= (dm * (hV(Tb) - hbar)) / dt;
          this.budgetSolid(srcCell, dm * (hV(Tb) - hbar));
        } else {
          for (let q = 0; q < k; q += 1) {
            const c = this.cells[q];
            const w = phase.mixed ? (this.wts[q] * phase.waterShare(c)) / fwSum : this.wts[q];
            const hbar = phase.waterH(c);
            this.Fm[c] -= dm * w;
            e.heat.src[c] -= (dm * w * (hV(Tb) - hbar)) / dt;
            this.budget[c] -= dm * w * (hV(Tb) - hbar);
          }
        }
        B.m[o + H2O] += dm;
        B.H[b] += dm * hV(Tb);
        grew += dm;
      }
      /* Neuer Zustand; die Enthalpie folgt T_b, die Differenz tauscht die Blase mit ihrer Umgebung. */
      this.solve(b, Tl);
      this.restoreEnthalpy(b, site, k, dt);
      /* Fast vergangen: nicht mehr bewegen, finish() lässt den Rest kondensieren. */
      if (B.r[b] < 1e-6 || (B.m[o + H2O] <= 1e-18 && B.m[o + N2] + B.m[o + O2] <= 0)) { B.age[b] += h; break; }
      /* Bewegung (frei) oder Ablösen (hängend). */
      if (site >= 0) {
        const pos = this.sites.position(this.e.grid, site, B.r[b]);
        B.x[b] = pos[0];
        B.y[b] = pos[1];
        this.departure(b, Tl);
        site = B.site[b];
      } else {
        this.motion.move(b, h, (B.V[b] - Vprev) / h);
      }
      B.age[b] += h;
      t += h;
      if (B.m[o + H2O] <= 0 && B.m[o + N2] + B.m[o + O2] <= 0) break;
    }
    B.dmdt[b] = grew / dt;
  }

  /** Angerechnete Wärme einer Wandzelle in diesem Schritt (im Budget als negative Werte geführt). */
  private used(sc: number): number {
    return -this.budget[sc];
  }

  private budgetSolid(sc: number, Q: number): void {
    this.budget[sc] -= Q;
  }

  /** H_b auf Σ m_k h_k(T_b) setzen; die Differenz geht als Wärme an die Spur (frei) oder die Wand (hängend). */
  private restoreEnthalpy(b: number, site: number, k: number, dt: number): void {
    const e = this.e;
    const B = this.B;
    const H = bubbleEnthalpy(B.m, b * SPECIES_SLOTS, B.Tb[b], hGas);
    const dH = H - B.H[b];
    if (dH === 0) return;
    B.H[b] = H;
    if (site >= 0) { e.heat.src[this.sites.cell[site]] -= dH / dt; return; }
    if (k === 0) return;
    for (let q = 0; q < k; q += 1) e.heat.src[this.cells[q]] -= (dH * this.wts[q]) / dt;
  }

  /** Der Fritz-Durchmesser D_d = 0,0208 θ √(σ/(g Δρ)) einer hängenden Blase (m); ohne Schwerkraft unendlich. */
  private fritz(b: number, Tl: number): number {
    const e = this.e;
    const g = e.grid;
    const B = this.B;
    const s = B.site[b];
    if (s < 0 || e.gy <= 0) return Infinity;
    const mat = SOLIDS[g.solid[this.sites.cell[s]] - 1];
    const theta = this.contactAngleOverride ?? mat.contactAngle;
    const rhov = B.totalMass(b) / Math.max(1e-30, B.V[b]);
    const hm = e.phase.host[this.sites.fluid[s]];
    return FRITZ * theta * Math.sqrt(sigmaLiq(hm, B.Tb[b]) / (e.gy * (rhoLiq(hm, Tl) - rhov)));
  }

  /** Abreissen beim Fritz-Durchmesser. */
  private departure(b: number, Tl: number): void {
    const e = this.e;
    const B = this.B;
    const s = B.site[b];
    if (s < 0 || e.gy <= 0) return;
    const Dd = this.fritz(b, Tl);
    const deq = 2 * Math.cbrt((3 * B.V[b]) / (4 * Math.PI));
    if (deq < Dd * (1 - 1e-4)) return;
    this.sites.bubble[s] = 0;
    B.site[b] = -1;
    this.departed += 1;
    this.departures[this.departureCount % this.departures.length] = deq;
    this.departureCount += 1;
    /* Die Flüssigkeit an ihrem Ort als Ausgang für ihren Nachlauf. */
    const vel = this.vel;
    e.liquid.velocityAt(B.x[b], B.y[b], vel);
    this.motion.ux0[b] = vel[0];
    this.motion.uy0[b] = vel[1];
    B.vx[b] = vel[0];
    B.vy[b] = vel[1];
  }

  /** Blasen, die sich in 3D überlappen, verschmelzen (Masse, Impuls, Energie bleiben). */
  private coalesce(): void {
    const e = this.e;
    const g = e.grid;
    const B = this.B;
    const { nx, ny, dx } = g;
    if (B.count < 2) return;
    this.head.fill(-1);
    let rmax = 0;
    for (let b = 0; b < B.count; b += 1) {
      const c = g.cellAt(B.x[b], B.y[b]);
      if (c < 0) { this.next[b] = -1; continue; }
      this.next[b] = this.head[c];
      this.head[c] = b;
      if (B.r[b] > rmax) rmax = B.r[b];
    }
    const reach = Math.ceil((2 * rmax) / dx);
    for (let b = 0; b < B.count; b += 1) {
      if (B.V[b] <= 0) continue;
      const i0 = Math.floor(B.x[b] / dx);
      const j0 = Math.floor(B.y[b] / dx);
      for (let j = Math.max(0, j0 - reach); j <= Math.min(ny - 1, j0 + reach); j += 1) {
        for (let i = Math.max(0, i0 - reach); i <= Math.min(nx - 1, i0 + reach); i += 1) {
          for (let q = this.head[i + j * nx]; q >= 0; q = this.next[q]) {
            if (q <= b || B.V[q] <= 0) continue;
            const ddx = B.x[q] - B.x[b];
            const ddy = B.y[q] - B.y[b];
            const D = g.depth;
            const flat = 2 * B.r[b] >= D || 2 * B.r[q] >= D;
            const ddz = flat ? 0 : B.z[q] - B.z[b];
            const rr = B.r[b] + B.r[q];
            if (ddx * ddx + ddy * ddy + ddz * ddz >= rr * rr) continue;
            this.merge(b, q);
          }
        }
      }
    }
  }

  /** q in b aufgehen lassen (q wird leer und in finish() entfernt). */
  private merge(b: number, q: number): void {
    const B = this.B;
    const Vb = B.V[b];
    const Vq = B.V[q];
    const V = Vb + Vq;
    B.x[b] = (B.x[b] * Vb + B.x[q] * Vq) / V;
    B.y[b] = (B.y[b] * Vb + B.y[q] * Vq) / V;
    B.z[b] = (B.z[b] * Vb + B.z[q] * Vq) / V;
    B.vx[b] = (B.vx[b] * Vb + B.vx[q] * Vq) / V;
    B.vy[b] = (B.vy[b] * Vb + B.vy[q] * Vq) / V;
    for (let k = 0; k < SPECIES_SLOTS; k += 1) {
      B.m[b * SPECIES_SLOTS + k] += B.m[q * SPECIES_SLOTS + k];
      B.m[q * SPECIES_SLOTS + k] = 0;
    }
    B.H[b] += B.H[q];
    B.H[q] = 0;
    B.age[b] = Math.max(B.age[b], B.age[q]);
    /* Frei bleibt frei: ein neuer Keim, der eine eben abgerissene Blase berührt, geht in ihr auf (die Dampfsäule), die Kavität wird frei. Hängen beide, bleibt b an seiner Kavität. */
    if (B.site[q] >= 0) this.sites.bubble[B.site[q]] = 0;
    if ((B.site[b] >= 0) !== (B.site[q] >= 0) && B.site[b] >= 0) { this.sites.bubble[B.site[b]] = 0; B.site[b] = -1; }
    B.site[q] = -1;
    B.V[q] = 0;
    if (B.id[q] === this.watch) { this.watch = B.id[b]; this.watchFate = 3; }
    B.r[b] = Math.cbrt((3 * V) / (4 * Math.PI));
    this.merged += 1;
  }

  /** Platzen an der freien Oberfläche, Vergehen, Aufräumen. */
  private finish(b: number, dt: number): void {
    const e = this.e;
    const g = e.grid;
    const B = this.B;
    const o = b * SPECIES_SLOTS;
    const total = B.totalMass(b);
    if (B.V[b] <= 0 || total <= 0) { this.drop(b, false, dt); return; }
    /* Kollaps: ohne Gas, oder kleiner als ein Mikrometer. */
    if (B.r[b] < 1e-6 || (B.m[o + H2O] <= 1e-18 && B.m[o + N2] + B.m[o + O2] <= 0)) { this.drop(b, false, dt); return; }
    if (B.site[b] >= 0) return;
    /* Oben angekommen: die Zelle am Scheitel der Blase (oder ihre Mitte) ist Gas oder ausserhalb. */
    const top = g.cellAt(B.x[b], B.y[b] + B.r[b]);
    const mid = g.cellAt(B.x[b], B.y[b]);
    if (top < 0 || g.kind[top] === GAS || mid < 0 || g.kind[mid] === GAS) this.drop(b, true, dt);
  }

  /** Eine Blase entfernen: geplatzt (Inhalt ins Gas darüber) oder vergangen (Rest kondensiert in die Flüssigkeit). */
  private drop(b: number, burst: boolean, dt: number): void {
    const e = this.e;
    const g = e.grid;
    const B = this.B;
    const o = b * SPECIES_SLOTS;
    const n = g.n;
    const mv = B.m[o + H2O];
    const mAir = B.m[o + N2] + B.m[o + O2];
    if (burst || mAir > 0) {
      /* Die Gaszellen über der Blase: so viele, wie ihr Volumen braucht (eine Reihe Zellen über ihrer Breite), sonst die erste darüber. */
      let c = g.cellAt(B.x[b], Math.min(g.h - 1e-9, B.y[b] + B.r[b]));
      while (c >= 0 && g.kind[c] !== GAS) c = c + g.nx < n ? c + g.nx : -1;
      if (c < 0) c = this.anyGasAbove(B.x[b]);
      if (c >= 0) {
        const k = this.gasCellsAround(c, B.V[b]);
        for (let q = 0; q < k; q += 1) {
          const cq = this.cells[q];
          const w = this.wts[q];
          for (let s2 = 0; s2 < SPECIES_SLOTS; s2 += 1) g.mg[s2 * n + cq] += w * B.m[o + s2];
          g.Hg[cq] += w * B.H[b];
          e.gas.deriveCell(cq);
        }
        this.burstVapour += mv;
        if (burst) {
          this.burst += 1;
          if (this.bulkCold) this.burstCold += 1; else this.burstWarm += 1;
        }
      } else {
        /* Kein Gas erreichbar: die Blase bleibt (sie platzt, sobald Gas da ist). */
        return;
      }
    } else if (mv > 0) {
      /* Der Rest Dampf kondensiert in das Wasser der Spur (latente Wärme dort); ohne Wasser in der Spur wird er dort ein neues Wasserteilchen. */
      const k = this.liquidFootprint(b);
      if (k > 0) {
        const phase = e.phase;
        let fs = 1;
        if (phase.mixed) {
          fs = 0;
          for (let q = 0; q < k; q += 1) fs += this.wts[q] * phase.waterShare(this.cells[q]);
        }
        for (let q = 0; q < k; q += 1) {
          const c = this.cells[q];
          const w = phase.mixed && fs > 0 ? (this.wts[q] * phase.waterShare(c)) / fs : this.wts[q];
          if (w === 0) continue;
          const hbar = phase.waterH(c);
          this.Fm[c] += mv * w;
          e.heat.src[c] += (w * (B.H[b] - mv * hbar)) / dt;
        }
      } else {
        const c = g.cellAt(B.x[b], B.y[b]);
        if (c >= 0) { g.mg[H2O * n + c] += mv; g.Hg[c] += B.H[b]; e.gas.deriveCell(c); }
      }
      this.collapsed += 1;
      if (this.bulkCold) this.collapsedCold += 1; else this.collapsedWarm += 1;
    }
    const s = B.site[b];
    if (s >= 0) this.sites.bubble[s] = 0;
    if (B.id[b] === this.watch) { this.watch = -1; this.watchFate = burst ? 1 : 2; }
    /* Gepackt: die letzte Blase rückt an b — ihre Zwischenspeicher wandern mit. */
    const last = B.count - 1;
    if (b !== last) {
      this.motion.ux0[b] = this.motion.ux0[last];
      this.motion.uy0[b] = this.motion.uy0[last];
      const ls = B.site[last];
      if (ls >= 0) this.sites.bubble[ls] = B.id[last];
    }
    B.remove(b);
  }

  /** Gaszellen um c (c zuerst, dann die Nachbarn in der Reihe und darüber), bis ihr Volumen das der Blase fasst; Gewichte nach Gasvolumen in cells/wts. */
  private gasCellsAround(c: number, V: number): number {
    const g = this.e.grid;
    const { nx, ny } = g;
    const vg = this.e.gas.vgas;
    const ci = c % nx;
    const cj = (c - ci) / nx;
    let k = 0;
    let total = 0;
    for (let ring = 0; ring <= 6 && (k === 0 || total < 2 * V); ring += 1) {
      for (let dj = 0; dj <= ring; dj += 1) {
        for (let di = -ring; di <= ring; di += 1) {
          if (Math.max(Math.abs(di), dj) !== ring) continue;
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
          const q = i + j * nx;
          if (g.kind[q] !== GAS || k >= this.cells.length) continue;
          const v = Math.max(1e-3 * g.vCell, vg[q]);
          this.cells[k] = q;
          this.wts[k] = v;
          total += v;
          k += 1;
        }
      }
    }
    for (let q = 0; q < k; q += 1) this.wts[q] /= total;
    return k;
  }

  private anyGasAbove(x: number): number {
    const g = this.e.grid;
    const i = Math.min(g.nx - 1, Math.max(0, Math.floor(x / g.dx)));
    for (let j = g.ny - 1; j >= 0; j -= 1) if (g.kind[i + j * g.nx] === GAS) return i + j * g.nx;
    return -1;
  }

  /**
   * α_b der Zellen neu: grid.alpha ist der Anteil, dem die Flüssigkeit schon Platz gemacht hat (Zellart, V_gas und
   * Driftausgleich sehen nur ihn); er folgt der Spur der Blasen um höchstens ALPHA_RATE·Δt je Schritt. Seine Änderung
   * ist eine Quelle der Divergenz der Flüssigkeit.
   */
  private updateAlpha(dt: number): void {
    const e = this.e;
    const g = e.grid;
    const B = this.B;
    const target = this.alphaTarget;
    target.fill(0);
    const inv = 1 / g.vCell;
    for (let b = 0; b < B.count; b += 1) {
      const k = footprint(B.x[b], B.y[b], B.r[b], B.V[b], g.depth, g.dx, g.nx, g.ny, this.cells, this.wts);
      for (let q = 0; q < k; q += 1) target[this.cells[q]] += this.wts[q] * B.V[b] * inv;
    }
    const alpha = g.alpha;
    const src = e.liquid.volSrc;
    const cap = ALPHA_RATE * dt;
    for (let c = 0; c < g.n; c += 1) {
      const d = target[c] - alpha[c];
      if (d === 0) continue;
      if (d > cap) { src[c] += (cap * g.vCell) / dt; alpha[c] += cap; }
      else if (d < -cap) { src[c] -= (cap * g.vCell) / dt; alpha[c] -= cap; }
      else { src[c] += (d * g.vCell) / dt; alpha[c] = target[c]; }
    }
  }

  /* -- Prüfstand und Inspektor ----------------------------------------------------------------------- */

  /**
   * Eine Blase setzen (Prüfstand): Mitte, Tiefe, Radius, Anteil Luft (0: reiner
   * Dampf, gesättigt; 1: reine Luft). Die Masse kommt von aussen (als Eingriff
   * gebucht).
   */
  spawn(x: number, y: number, z: number, r: number, airFraction: number): number {
    const e = this.e;
    const B = this.B;
    const b = B.add(x, y, z);
    if (b < 0) return -1;
    const pl = this.pressure(x, y);
    const c = e.grid.cellAt(x, y);
    const Tl = c >= 0 && e.phase.Tl[c] > 0 ? e.phase.Tl[c] : e.ambientT;
    const pb = pl + (2 * sigmaLiq(c >= 0 ? e.phase.host[c] : 0, Tl)) / r;
    const V = (4 / 3) * Math.PI * r * r * r;
    const o = b * SPECIES_SLOTS;
    if (airFraction <= 0) {
      const Tb = tSat(pb);
      B.m[o + H2O] = rhoVapourSatFast(Tb) * V;
    } else {
      const n = (pb * V) / (8.314462618 * Tl);
      B.m[o + N2] = n * 0.79 * MOLAR[N2];
      B.m[o + O2] = n * 0.21 * MOLAR[O2];
    }
    B.r[b] = r;
    this.solve(b, Tl);
    B.H[b] = bubbleEnthalpy(B.m, o, B.Tb[b], hGas);
    e.ledger.water += B.m[o + H2O];
    e.ledger.air += B.m[o + N2] + B.m[o + O2];
    e.ledger.energy += B.H[b];
    this.motion.ux0[b] = 0;
    this.motion.uy0[b] = 0;
    return b;
  }

  describe(b: number): ProbeInfo['bubble'] {
    const B = this.B;
    if (b < 0 || b >= B.count) return null;
    const o = b * SPECIES_SLOTS;
    const f = b * FORCE_SLOTS;
    return {
      id: B.id[b],
      r: B.r[b],
      T: B.Tb[b],
      pb: B.pb[b],
      pv: B.pv[b],
      Tsat: tSat(B.pb[b]),
      mv: B.m[o + H2O],
      ma: B.m[o + N2] + B.m[o + O2],
      vx: B.vx[b],
      vy: B.vy[b],
      dmdt: B.dmdt[b],
      attached: B.site[b] >= 0,
      force: Array.from(B.force.subarray(f, f + FORCE_SLOTS))
    };
  }

  /** Die Flüssigkeitsgeschwindigkeit, die die Blase zuletzt gesehen hat (für die Schlupfgeschwindigkeit). */
  liquidVelocity(b: number): [number, number] {
    return [this.motion.ux0[b], this.motion.uy0[b]];
  }

  get solidKind(): number { return SOLID; }
}
