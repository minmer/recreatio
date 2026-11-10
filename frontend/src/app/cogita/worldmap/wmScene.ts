/**
 * 2026-11-09 — WAS DIE WELTKARTE ZEICHNET (spec §4), fertig gerechnet für den Zeichner (`WorldPillars.tsx`): Säulen mit Farbe,
 * Sättigung, Höhe, Stufen und Punkt; Blöcke als Scheiben; das Haus; je Abschnitt eine Spur auf seinem Gleis — parallel zu
 * den anderen Linien desselben Gleises, immer in derselben Reihenfolge, 5 Einheiten auseinander. Eine Spur endet am VOLLEN
 * Rand (dort endet das Gleis); das gerade Stück bis zum gezeichneten Rand setzt der Zeichner (die Breite der Säulen ändert
 * nichts hier, §4.7). Rein.
 */

import type { LockSymbol } from './wmConditions';
import type { Rgb } from './wmColors';
import type { LineColour } from './wmColors';
import type { Geometry } from './wmGeometry';
import { HOME_ID } from './wmGeometry';
import type { WorldState } from './wmState';
import { laneOffset, offsetPoints } from './wmTracks';
import type { Lines, Section, World } from './wmTypes';

export interface ScenePlace {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  /** Der volle Radius. */
  readonly r: number;
  readonly block?: string;
  /** Die Farbe des Themas (ungemischt). */
  readonly color: Rgb;
  readonly sat: 'never' | 'partly' | 'full';
  /** Was bis hierher fehlt (Karten) — die Höhe. */
  readonly missing: number;
  readonly total: number;
  readonly conquered: boolean;
  readonly levels: number;
  readonly level: number;
  readonly dot: 'green' | 'yellow' | 'orange' | null;
  readonly station: boolean;
  /** „Mistrzowsko" — ein Stern auf der Säule. */
  readonly perfect: boolean;
  /** Wie die Karten des Ortes sitzen (gekonnt, im Lernen, verblasst/neu) — der Ring eines eroberten Ortes. */
  readonly knowledge: { readonly known: number; readonly learning: number; readonly faded: number };
}

/**
 * 2026-11-09 (Eigentümer) — WAS EIN WEG JETZT FÜR DICH IST. Kräftig nur, was die Kenntnis weiterbringt (`grow`: offen, und er
 * bringt Karten, die noch nicht sitzen). Alles andere leise, und jedes anders: `travelled` (schon gefahren), `idle` (offen,
 * bringt nichts Neues), `locked` (noch nicht erreichbar).
 * 2026-11-10 — offen heisst auch: er beginnt am Haus oder an einem eroberten Turm. Ein Weg von einem nicht eroberten Turm ist
 * `locked` (Zeichen: der Ort), auch wenn die Kenntnis für ihn reicht.
 */
export type LaneState = 'grow' | 'travelled' | 'idle' | 'locked';

export interface SceneLane {
  readonly section: string;
  readonly line: string;
  readonly branch: string;
  /** Die Orte an beiden Enden (oder das Haus). */
  readonly fromId: string;
  readonly toId: string;
  /** Punkte in Weltkoordinaten, von `from` nach `to`, schon versetzt. */
  readonly points: readonly number[];
  /** Die Mitten der Säulen an beiden Enden (für das gerade Stück bis zum gezeichneten Rand). */
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  /** Die vollen Radien der Säulen an beiden Enden (0: das Haus). */
  readonly fromR: number;
  readonly toR: number;
  readonly fromHome: boolean;
  readonly color: Rgb;
  readonly deep: boolean;
  readonly state: LaneState;
  readonly symbol: LockSymbol | null;
  /** 2026-11-10 — der Name des Pfades (der Erzählung): steht an ihm auf der Karte, mit Folien und Art. */
  readonly name: string;
  readonly slides: number;
  /** Die Art: Hauptpfad, Abzweig (eine Wahl), Vertiefung (ein Abstecher hin) oder Rückweg. */
  readonly kind: 'main' | 'branch' | 'deepening' | 'back';
  /** 2026-11-10 — die Schritte des Abschnitts als Zeichen auf dem Pfad: Folie oder Frage, und ob schon gesehen. */
  readonly marks: readonly ('slide' | 'question')[];
  readonly seen: readonly boolean[];
  /** 2026-11-10 — der vereinfachte innere Weg: der Abschnitt beginnt an einer Wahl (Gabel) / endet mit dem Przegląd (↻). */
  readonly forkStart: boolean;
  readonly review: boolean;
  /**
   * 2026-11-10 — DIESELBEN KARTEN, ANDERS VERPACKT: so viele weitere Verpackungen laufen neben dem Pfad (eine kleine Schleife),
   * zwischen den Anteilen `from`…`to` seiner Länge (dort, wo die Verpackungen verschieden sind). Null: keine.
   */
  readonly variants: { readonly more: number; readonly from: number; readonly to: number } | null;
}

/** 2026-11-10 — ein Knoten zwischen Türmen auf der Karte: eine Gabelung (k Wege) oder ein Tor (wo verlangte Türme zusammenkommen). */
export interface SceneJunction {
  readonly id: string;
  readonly kind: 'fork' | 'gate';
  readonly line: string;
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly color: Rgb;
  /** Die Folien (und Fragen) zwischen dem Turm und der Gabelung. */
  readonly before: { readonly slides: number; readonly questions: number };
  /** Je Weg, der hier abfährt: wohin und wie viele Folien/Fragen. */
  readonly ways: readonly { readonly section: string; readonly to: string; readonly slides: number; readonly questions: number }[];
  /** Offen: man kann ihn erreichen (die Spur zu ihm ist offen). */
  readonly open: boolean;
}

/**
 * 2026-11-10 (Eigentümer: „Tore werden gezeichnet") — EINE SPUR VON EINEM VERLANGTEN TURM ZU SEINEM TOR: zu einer Gabelung, einem
 * Tor-Knoten oder zum gesperrten Turm selbst. `met`: der verlangte Turm ist erobert.
 */
export interface SceneLink {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
  readonly ra: number;
  readonly rb: number;
  readonly met: boolean;
  readonly kind: 'gate' | 'requires';
}

/** 2026-11-10 — ein Abstecher als Schleife an seiner Stelle eines Pfades (Anteil `at` seiner Länge), mit den Schritten der gerufenen Erzählung. */
export interface SceneLoop {
  readonly section: string;
  readonly target: string;
  readonly at: number;
  readonly marks: readonly ('slide' | 'question')[];
  readonly color: Rgb;
}

export interface Scene {
  readonly places: readonly ScenePlace[];
  readonly byId: ReadonlyMap<string, ScenePlace>;
  readonly blocks: readonly { readonly id: string; readonly label: string; readonly x: number; readonly y: number; readonly r: number }[];
  readonly home: { readonly x: number; readonly y: number; readonly r: number } | null;
  readonly tracks: readonly { readonly key: string; readonly points: readonly number[]; readonly lanes: number }[];
  readonly lanes: readonly SceneLane[];
  readonly junctions: readonly SceneJunction[];
  readonly links: readonly SceneLink[];
  readonly loops: readonly SceneLoop[];
  /** Mitte und Halbmesser der ganzen Welt. */
  readonly extent: { readonly cx: number; readonly cy: number; readonly radius: number };
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** 2026-11-10 (Eigentümer) — der Name steht AUF der Säule, in der Mitte ihrer Oberseite (wie auf den Sechsecken), sobald dort Platz ist. */
export const NAME_MIN = 30;
export const nameOnTop = (radiusPx: number, topHalfPx: number): boolean => radiusPx * 1.8 >= NAME_MIN && topHalfPx >= 5;

export function sceneOf(world: World, lines: Lines, state: WorldState, g: Geometry, opts: { readonly placeColour: (place: string) => Rgb; readonly lineColour: ReadonlyMap<string, LineColour>; readonly fallback: Rgb }): Scene {
  const places: ScenePlace[] = [];
  for (const id of world.order) {
    const p = world.places.get(id)!;
    const pos = g.positions[id];
    if (pos === undefined) continue;
    const st = state.places.get(id);
    places.push({
      id, label: p.label, x: pos[0], y: pos[1], r: g.radii[id] ?? 28, ...(p.block === undefined ? {} : { block: p.block }),
      color: opts.placeColour(id), sat: st?.saturation ?? 'never', missing: st?.height ?? p.cards.length, total: p.cards.length,
      conquered: st?.conquered === true, levels: state.settings.levels, level: st?.level ?? 0, dot: st?.dot ?? null,
      station: lines.stations.has(id), perfect: st?.perfect === true,
      knowledge: { known: st?.known ?? 0, learning: st?.learning ?? 0, faded: st?.unseen ?? p.cards.length }
    });
  }
  const byId = new Map(places.map((p) => [p.id, p] as const));
  const blocks = [...world.blocks.values()].filter((b) => g.positions[b.id] !== undefined).map((b) => ({ id: b.id, label: b.label, x: g.positions[b.id][0], y: g.positions[b.id][1], r: g.radii[b.id] }));
  const home = g.positions[HOME_ID] === undefined ? null : { x: g.positions[HOME_ID][0], y: g.positions[HOME_ID][1], r: g.radii[HOME_ID] };

  /* Die Gleise und welche Linien auf ihnen fahren (in fester Reihenfolge: grosse vor Vertiefungen, dann nach Kennung). */
  const trackOf = new Map(g.tracks.map((t) => [pairKey(t.a, t.b), t] as const));
  const nodeOf = (id: string) => g.nodeOf[id] ?? id;
  const linesOn = new Map<string, Set<string>>();
  for (const s of lines.sections.values()) {
    if (s.from === s.to) continue;
    const k = pairKey(nodeOf(s.from), nodeOf(s.to));
    const set = linesOn.get(k) ?? new Set<string>();
    set.add(s.line);
    linesOn.set(k, set);
  }
  const order = (a: string, b: string) => {
    const da = opts.lineColour.get(a)?.deep === true ? 1 : 0, db = opts.lineColour.get(b)?.deep === true ? 1 : 0;
    return da - db || (a < b ? -1 : a > b ? 1 : 0);
  };
  const lanesOf = new Map<string, string[]>();
  for (const [k, set] of linesOn) lanesOf.set(k, [...set].sort(order));

  const centre = (id: string): readonly [number, number] => g.positions[id] ?? [0, 0];
  /* Die Abschnitte je Linie (wo ein Zweig weitergeht — sonst endet er hier). */
  const byLine = new Map<string, Section[]>();
  for (const s of lines.sections.values()) { const l = byLine.get(s.line) ?? []; l.push(s); byLine.set(s.line, l); }
  const lineSections = (line: string): readonly Section[] => byLine.get(line) ?? [];
  /*
    2026-11-10 — VERPACKUNGEN: dieselbe Strecke mehrmals (je Verpackung ein Abschnitt). Gezeichnet wird einer — der, auf dem der
    Lernende am weitesten ist —, die anderen als Schleife daneben, zwischen dem gemeinsamen Anfang und dem gemeinsamen Ende.
  */
  const groups = new Map<string, Section[]>();
  for (const s of lines.sections.values()) {
    if (s.variant === undefined || s.from === s.to) continue;
    const k = `${s.line}|${s.from}|${s.to}|${s.variant.choice}`;
    const l = groups.get(k) ?? []; l.push(s); groups.set(k, l);
  }
  const shownOf = new Map<string, string>();
  const variantsOf = new Map<string, SceneLane['variants']>();
  for (const list of groups.values()) {
    const seenCount = (s: Section) => (state.sections.get(s.id)?.seen ?? []).filter(Boolean).length;
    const rep = list.slice().sort((a, b) => seenCount(b) - seenCount(a) || (a.variant!.index - b.variant!.index))[0];
    for (const s of list) shownOf.set(s.id, rep.id);
    if (list.length < 2) continue;
    let pre = 0;
    while (list.every((s) => s.steps[pre] !== undefined && s.steps[pre] === rep.steps[pre])) pre += 1;
    let suf = 0;
    while (suf < rep.steps.length - pre && list.every((s) => s.steps.length - 1 - suf >= pre && s.steps[s.steps.length - 1 - suf] === rep.steps[rep.steps.length - 1 - suf])) suf += 1;
    const n = Math.max(1, rep.steps.length);
    variantsOf.set(rep.id, { more: list.length - 1, from: pre / (n + 1), to: Math.min(1, (n - suf + 1) / (n + 1)) });
  }
  const lanes: SceneLane[] = [];
  for (const s of lines.sections.values()) {
    if (s.from === s.to) continue;
    if ((shownOf.get(s.id) ?? s.id) !== s.id) continue;
    const a = nodeOf(s.from), b = nodeOf(s.to);
    const st = state.sections.get(s.id);
    const colour = opts.lineColour.get(s.line);
    const startClosed = st !== undefined && !st.open;
    const laneState: LaneState = st?.travelled === true ? 'travelled' : st?.ticket.met !== true || startClosed ? 'locked'
      : s.introduces.some((k) => state.band(k) !== 'known') ? 'grow' : 'idle';
    let points: number[];
    if (a === b) {
      /* Zwischen zwei Teilen desselben Blocks: gerade über die Scheibe. */
      const [fx, fy] = centre(s.from), [tx, ty] = centre(s.to);
      points = [fx, fy, tx, ty];
    } else {
      const k = pairKey(a, b);
      const t = trackOf.get(k);
      if (t === undefined) continue;
      const list = lanesOf.get(k) ?? [s.line];
      const off = laneOffset(Math.max(0, list.indexOf(s.line)), list.length);
      const shifted = off === 0 ? [...t.points] : offsetPoints(t.points, off);
      /* Die Spur in der Richtung des Abschnitts. */
      if (t.a === a) points = shifted;
      else { points = []; for (let i = shifted.length - 2; i >= 0; i -= 2) points.push(shifted[i], shifted[i + 1]); }
    }
    lanes.push({
      section: s.id, line: s.line, branch: s.branch, fromId: s.from, toId: s.to, points, from: centre(s.from), to: centre(s.to), fromHome: s.from === HOME_ID,
      fromR: s.from === HOME_ID ? 0 : g.radii[s.from] ?? 28, toR: g.radii[s.to] ?? 28,
      name: lines.lines.get(s.line)?.name ?? '', slides: s.slides,
      marks: s.steps.map((x) => (s.questions.includes(x) ? 'question' as const : 'slide' as const)), seen: st?.seen ?? [],
      forkStart: s.start?.exit !== undefined,
      review: lines.lines.get(s.line)?.review === true && s.kind !== 'return' && !lineSections(s.line).some((o) => o.id !== s.id && o.branch === s.branch && o.from === s.to),
      kind: s.kind === 'return' ? 'back' : lines.lines.get(s.line)?.deepening === true ? 'deepening' : s.branch !== s.line ? 'branch' : 'main',
      color: colour?.color ?? opts.fallback, deep: colour?.deep === true, state: laneState, symbol: laneState === 'locked' ? (st?.ticket.met !== true ? st?.ticket.symbol ?? 'knowledge' : 'place') : null,
      variants: variantsOf.get(s.id) ?? null
    });
  }
  const tracks = g.tracks.map((t) => ({ key: pairKey(t.a, t.b), points: t.points, lanes: lanesOf.get(pairKey(t.a, t.b))?.length ?? 1 }));

  /* -- 2026-11-10: Gabelungen und Tore, ihre Spuren, die verlangten Türme, die Abstecher ------------------------------------ */
  const junctions: SceneJunction[] = [];
  for (const j of lines.junctions.values()) {
    const pos = g.positions[j.id];
    if (pos === undefined) continue;
    const seen = new Set<string>();
    const ways: { section: string; to: string; slides: number; questions: number }[] = [];
    for (const id of j.out) {
      const shown = shownOf.get(id) ?? id;
      if (seen.has(shown)) continue;
      seen.add(shown);
      const s = lines.sections.get(shown);
      if (s !== undefined) ways.push({ section: s.id, to: s.to, slides: s.slides, questions: s.questions.length });
    }
    junctions.push({
      id: j.id, kind: j.kind, line: j.line, x: pos[0], y: pos[1], r: g.radii[j.id] ?? 6,
      color: opts.lineColour.get(j.line)?.color ?? opts.fallback, before: j.before, ways,
      open: j.out.some((id) => state.sections.get(id)?.open === true)
    });
  }
  const links: SceneLink[] = [];
  const at = (id: string): { p: readonly [number, number]; r: number } | null => {
    const p = g.positions[id];
    if (p === undefined) return null;
    return { p, r: id === HOME_ID ? 0 : g.radii[id] ?? 28 };
  };
  const conqueredOf = (p: string) => state.places.get(p)?.conquered === true || (world.blocks.get(p)?.parts.every((x) => state.places.get(x)?.conquered === true) ?? false);
  for (const l of lines.links) {
    const a = at(l.from), b = at(l.to);
    if (a === null || b === null) continue;
    links.push({ id: l.id, from: l.from, to: l.to, a: a.p, b: b.p, ra: a.r, rb: b.r, met: conqueredOf(l.from), kind: 'gate' });
  }
  /*
    Ein gesperrter Turm (eine seiner Voraussetzungen ist nicht erobert): von jeder seiner Voraussetzungen eine Spur zu ihm —
    ausser sie ist schon zu sehen (ein Weg von ihr hierher, oder eine Spur von ihr zu dem Knoten, von dem der Weg hierher kommt).
  */
  const into = new Map<string, Section[]>();
  for (const s of lines.sections.values()) if (s.from !== s.to) { const l = into.get(s.to) ?? []; l.push(s); into.set(s.to, l); }
  const shownBy = (need: string, place: string): boolean => (into.get(place) ?? []).some((s) => s.from === need
    || (lines.junctions.get(s.from)?.from === need) || lines.links.some((l) => l.from === need && l.to === s.from));
  for (const p of world.places.values()) {
    if (state.places.get(p.id)?.conquered === true || p.needs.every((n) => state.places.get(n)?.conquered === true)) continue;
    for (const n of p.needs) {
      if (shownBy(n, p.id)) continue;
      const a = at(n), b = at(p.id);
      if (a === null || b === null) continue;
      links.push({ id: `${n}>${p.id}`, from: n, to: p.id, a: a.p, b: b.p, ra: a.r, rb: b.r, met: state.places.get(n)?.conquered === true, kind: 'requires' });
    }
  }
  const loops: SceneLoop[] = [];
  for (const l of lines.loops) {
    const shown = shownOf.get(l.section) ?? l.section;
    const s = lines.sections.get(shown);
    if (s === undefined || s.from === s.to) continue;
    loops.push({ section: shown, target: l.target, at: Math.max(0.05, Math.min(0.95, (l.at + 0.5) / Math.max(1, s.steps.length + 1))), marks: l.marks, color: opts.lineColour.get(l.target)?.color ?? opts.lineColour.get(l.line)?.color ?? opts.fallback });
  }

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const id of Object.keys(g.positions)) { const [x, y] = g.positions[id]; const r = g.radii[id] ?? 28; x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); }
  /* Mitte und der weiteste Rand von ihr aus (enger als die halbe Diagonale: die Welt füllt das Bild). */
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let radius = 60;
  for (const id of Object.keys(g.positions)) { const [x, y] = g.positions[id]; radius = Math.max(radius, Math.hypot(x - cx, y - cy) + (g.radii[id] ?? 28)); }
  const extent = Number.isFinite(x0) ? { cx, cy, radius } : { cx: 0, cy: 0, radius: 200 };
  return { places, byId, blocks, home, tracks, lanes, junctions, links, loops, extent };
}
