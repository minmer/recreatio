/**
 * 2026-11-05 (Weg) — DER WEG ZU EINEM THEMA, IN SCHRITTEN: die Punkte, die auf der Karte von dem, was jetzt lernbar ist,
 * bis zum gewählten Thema springen (`WorldMap`, die Leinwand `cg-wm-way`). Ohne Leinwand, damit es sich prüfen lässt
 * (`scripts/app-way-check.mjs`).
 * <code>
 *   Weg       das Thema und alles noch nicht Gekonnte davor — auch hinter gekonnten Themen (fehlt etwas vor einem
 *             gekonnten, fehlt es trotzdem: so zählt es auch die Höhe der Säulen)
 *   Schritt   0: jetzt lernbar (dort erscheinen die Punkte); sonst eins mehr als der späteste Schritt davor — die längste
 *             Kette des Fehlenden, also genau die Stufe der Säule über dem Lernbaren. Braucht ein Thema mehrere, kommen
 *             ihre Punkte IM SELBEN Schritt an (es ist erst dran, wenn das Letzte davor gelernt ist); ein früher fertiger
 *             wartet so lange auf seinem Feld und hüpft im Takt mit.
 *   Sprung    von einem Thema zu jedem auf dem Weg, das es (direkt oder über Gekonntes hinweg) braucht — im Schritt des
 *             Ankommenden; braucht es mehrere, teilt sich der Punkt
 *   Kreise    Themen, die einander brauchen, sind ein Schritt (sie werden zusammen gelernt; zwischen ihnen springt nichts,
 *             von jedem springt ein Punkt weiter; wohin kein eigener Sprung führt, erscheint der Punkt beim Landen der anderen)
 *   Takt      erst erscheinen die Punkte, dann je Schritt ein Sprung (zusammen höchstens etwa 5 s), am Ende leuchtet das
 *             Ziel; „ograniczone": je Schritt blenden die Punkte nur ein; „wyłączone": nur der gezeichnete Weg
 * </code>
 */

import type { MotionLevel } from '../ui/motion';

export interface WayHop {
  readonly from: number;
  readonly to: number;
  /** Der Schritt, in dem der Punkt ankommt (der Schritt von `to`). */
  readonly beat: number;
}

export interface WayPlan {
  readonly target: number;
  /** In welchem Schritt das Ziel erreicht wird (mindestens 1 — ist es jetzt lernbar, gibt es keinen Weg). */
  readonly beats: number;
  /** Die Themen des Weges mit ihrem Schritt, die Anfänge zuerst. */
  readonly tiles: readonly number[];
  readonly tileBeat: readonly number[];
  readonly hops: readonly WayHop[];
  /** Je Schritt die Themen, die in ihm erreicht werden (0: wo die Punkte erscheinen). */
  readonly byBeat: readonly (readonly number[])[];
  /**
   * Themen eines Kreises, zu denen selbst kein Sprung führt (nur zu einem anderen Thema des Kreises): ihr Punkt erscheint,
   * wenn die Punkte bei den anderen landen.
   */
  readonly joins: readonly number[];
}

export interface WayInput {
  readonly target: number;
  /** Je Thema die Themen, die es direkt braucht (`TopicGraph.needs`). */
  readonly needs: readonly (readonly number[])[];
  /** Je Thema die Themen, die es direkt braucht, umgekehrt (was es öffnet). */
  readonly opens: readonly (readonly number[])[];
  /** Noch zu lernen (jetzt lernbar oder ein Berg) — nur solche liegen auf dem Weg. */
  readonly open: (t: number) => boolean;
}

/** Der Weg zu `target`, oder `null` (gekonnt, jetzt lernbar, nicht auf der Karte). */
export function wayPlan(o: WayInput): WayPlan | null {
  const n = o.needs.length;
  const goal = o.target;
  if (!(goal >= 0 && goal < n) || !o.open(goal)) return null;
  const ok = (x: number) => Number.isInteger(x) && x >= 0 && x < n;
  /* 1. Alles davor (ohne Rekursion: lange Ketten in 5 000 Themen). */
  const inA = new Uint8Array(n);
  inA[goal] = 1;
  const before: number[] = [goal];
  for (let i = 0; i < before.length; i += 1) {
    for (const p of o.needs[before[i]] ?? []) {
      if (!ok(p) || inA[p] === 1) continue;
      inA[p] = 1;
      before.push(p);
    }
  }
  /* 2. Was davon noch offen ist: der Weg. */
  const isR = new Uint8Array(n);
  const R: number[] = [];
  for (const v of before) if (o.open(v)) { isR[v] = 1; R.push(v); }
  /* 3. Unter Offenem (von dort über „öffnet" erreichbar): nur dort lohnt es, über Gekonntes hinweg nach oben zu suchen —
        ein ganz gekonntes Fundament wird nie durchlaufen. */
  const below = new Uint8Array(n);
  const front: number[] = [];
  const down = (v: number) => { for (const c of o.opens[v] ?? []) if (ok(c) && inA[c] === 1 && below[c] === 0) { below[c] = 1; front.push(c); } };
  for (const v of R) down(v);
  for (let i = 0; i < front.length; i += 1) down(front[i]);
  /* 4. Je Thema des Weges die nächsten offenen davor. */
  const m = R.length;
  const ri = new Int32Array(n).fill(-1);
  R.forEach((v, i) => { ri[v] = i; });
  const stamp = new Int32Array(n).fill(-1);
  const adj: number[][] = new Array(m);
  for (let i = 0; i < m; i += 1) {
    const u = R[i];
    const out: number[] = [];
    const stack = [...(o.needs[u] ?? [])];
    stamp[u] = i;
    while (stack.length > 0) {
      const p = stack.pop()!;
      if (!ok(p) || stamp[p] === i || inA[p] === 0) continue;
      stamp[p] = i;
      if (isR[p] === 1) { out.push(ri[p]); continue; }
      if (below[p] === 0) continue;
      for (const g of o.needs[p] ?? []) if (ok(g) && stamp[g] !== i) stack.push(g);
    }
    adj[i] = out;
  }
  /* 5. Kreise zusammen (Tarjan, ohne Rekursion): die Teile kommen in der Folge „Grundlagen zuerst". */
  const index = new Int32Array(m).fill(-1);
  const low = new Int32Array(m);
  const onStack = new Uint8Array(m);
  const comp = new Int32Array(m).fill(-1);
  const S: number[] = [];
  const parts: number[][] = [];
  let next = 0;
  for (let s = 0; s < m; s += 1) {
    if (index[s] >= 0) continue;
    index[s] = next; low[s] = next; next += 1; S.push(s); onStack[s] = 1;
    const work: [number, number][] = [[s, 0]];
    while (work.length > 0) {
      const top = work[work.length - 1];
      const v = top[0];
      if (top[1] < adj[v].length) {
        const w = adj[v][top[1]];
        top[1] += 1;
        if (index[w] < 0) { index[w] = next; low[w] = next; next += 1; S.push(w); onStack[w] = 1; work.push([w, 0]); }
        else if (onStack[w] === 1) low[v] = Math.min(low[v], index[w]);
        continue;
      }
      work.pop();
      if (work.length > 0) { const u = work[work.length - 1][0]; low[u] = Math.min(low[u], low[v]); }
      if (low[v] !== index[v]) continue;
      const members: number[] = [];
      let w = -1;
      do { w = S.pop()!; onStack[w] = 0; comp[w] = parts.length; members.push(w); } while (w !== v);
      parts.push(members);
    }
  }
  /* 6. Der Schritt je Teil: eins mehr als der späteste davor. */
  const level = new Int32Array(parts.length);
  parts.forEach((members, c) => {
    let best = -1;
    for (const v of members) for (const w of adj[v]) if (comp[w] !== c) best = Math.max(best, level[comp[w]]);
    level[c] = best + 1;
  });
  const beats = level[comp[ri[goal]]];
  if (beats <= 0) return null;
  /*
    7. Die Sprünge, nie innerhalb eines Kreises: braucht ein Thema eines aus einem Kreis, braucht es den ganzen Kreis (er wird
       zusammen gelernt) — von jedem seiner Themen springt ein Punkt (so bleibt kein Punkt liegen).
  */
  const hops: WayHop[] = [];
  const had = new Set<number>();
  for (let i = 0; i < m; i += 1) {
    for (const w of adj[i]) {
      if (comp[w] === comp[i]) continue;
      for (const x of parts[comp[w]]) {
        const key = R[x] * n + R[i];
        if (had.has(key)) continue;
        had.add(key);
        hops.push({ from: R[x], to: R[i], beat: level[comp[i]] });
      }
    }
  }
  hops.sort((a, b) => a.beat - b.beat || a.to - b.to || a.from - b.from);
  const reached = new Set(hops.map((h) => h.to));
  const joins = R.filter((v, i) => level[comp[i]] > 0 && !reached.has(v));
  const byBeat: number[][] = Array.from({ length: beats + 1 }, () => []);
  for (let i = 0; i < m; i += 1) { const b = level[comp[i]]; if (b <= beats) byBeat[b].push(R[i]); }
  for (const list of byBeat) list.sort((a, b) => a - b);
  const tiles = byBeat.flat();
  const tileBeat = byBeat.flatMap((list, b) => list.map(() => b));
  return { target: goal, beats, tiles, tileBeat, hops, byBeat, joins };
}

/* -- Der Takt -------------------------------------------------------------------------------------------------------- */

export interface WayTimes {
  /** So lange erscheinen die Punkte auf den Anfängen (vor dem ersten Schritt). */
  readonly pop: number;
  /** Ein Schritt. */
  readonly beat: number;
  /** Ein Sprung (im Schritt; danach sitzt der Punkt, bis der nächste Schritt beginnt). */
  readonly jump: number;
  /** Nach dem letzten Schritt: das Ziel leuchtet. */
  readonly arrive: number;
  /** Danach vergehen die Punkte (der gezeichnete Weg bleibt). */
  readonly fade: number;
  readonly end: number;
}

export const WAY_POP_MS = 420;
export const WAY_ARRIVE_MS = 700;
export const WAY_FADE_MS = 420;

/** Wann was läuft: je Schritt 280–600 ms, alle Schritte zusammen höchstens etwa 4,8 s (bei sehr vielen kürzer je Schritt). */
export function wayTimes(beats: number, motion: MotionLevel): WayTimes {
  if (motion === 'off' || beats <= 0) return { pop: 0, beat: 0, jump: 0, arrive: 0, fade: 0, end: 0 };
  const beat = Math.round(Math.max(motion === 'reduced' ? 240 : 280, Math.min(motion === 'reduced' ? 520 : 600, 4800 / beats)));
  const pop = motion === 'reduced' ? 300 : WAY_POP_MS;
  const jump = motion === 'reduced' ? 0 : Math.round(beat * 0.68);
  const arrive = motion === 'reduced' ? 420 : WAY_ARRIVE_MS;
  return { pop, beat, jump, arrive, fade: WAY_FADE_MS, end: pop + beats * beat + arrive + WAY_FADE_MS };
}

/** Wann der Schritt `k` beginnt (k ≥ 1; der Schritt 0 ist das Erscheinen ab 0). */
export const beatStart = (w: WayTimes, k: number): number => (k <= 0 ? 0 : w.pop + (k - 1) * w.beat);

/** Welcher Schritt zur Zeit `tau` läuft: 0 beim Erscheinen, 1 … `beats`, danach `beats + 1` (das Ziel leuchtet). */
export function beatAt(w: WayTimes, beats: number, tau: number): number {
  if (tau < w.pop) return 0;
  if (w.beat <= 0) return beats + 1;
  return Math.min(beats + 1, Math.floor((tau - w.pop) / w.beat) + 1);
}

/** Wann ein Sprung landet (ms ab dem Anfang) — für alle Sprünge zu einem Thema dieselbe Zeit. */
export const landsAt = (w: WayTimes, hop: WayHop): number => beatStart(w, hop.beat) + w.jump;

/**
 * Je Thema des Weges, bis zu welchem Schritt ein Punkt darauf bleibt (der letzte Sprung von dort; das Ziel: bis zum Ende)
 * und in welchen Schritten er auf der Stelle hüpft (er wartet: der nächste Sprung von dort kommt später).
 */
export function wayWaits(plan: WayPlan): { readonly last: ReadonlyMap<number, number>; readonly waiting: readonly (readonly number[])[]; readonly arriving: ReadonlyMap<number, number> } {
  const last = new Map<number, number>();
  const arriving = new Map<number, number>();
  for (const h of plan.hops) {
    last.set(h.from, Math.max(last.get(h.from) ?? -1, h.beat));
    arriving.set(h.to, (arriving.get(h.to) ?? 0) + 1);
  }
  last.set(plan.target, plan.beats + 1);
  const waiting: number[][] = Array.from({ length: plan.beats + 2 }, () => []);
  plan.tiles.forEach((t, i) => {
    const from = plan.tileBeat[i];
    const until = last.get(t) ?? -1;
    for (let k = from + 1; k < until && k <= plan.beats; k += 1) waiting[k].push(t);
  });
  return { last, waiting, arriving };
}
