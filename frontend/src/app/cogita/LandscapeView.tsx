/**
 * 2026-11-03 — DER KRAJOBRAZ (Widok im Modus `landscape`, auf einer Seite `krajobraz`): die eigene Landschaft des
 * Wissens. Gerechnet in `landscape.ts` (im Worker, `landscapeClient.ts`); gesammelt aus der Baza in `landscapeData.ts`.
 *
 * <code>
 *   Karte     (E) EINE feste Karte: jeder Eintrag hat seine Zelle (aus der Struktur, nie aus dem Fortschritt); ein
 *             zusammenhängendes Sechseckraster, Kante an Kante, halbschräg; der Fortschritt ändert nur die Höhen: das
 *             Gelernte sinkt ins Tal, was jetzt zu lernen ist, liegt eben, was noch nicht erreichbar ist, steht als Berg
 *             (Höhe und Schatten); „do powtórki" ist ein Zeichen auf dem Feld. Zoom ist eine Kamera auf dieselbe Karte;
 *             die anderen Bereiche stehen am Rand in ihrer Richtung.
 *   Felder    das Budget entscheidet, welche festen Gebiete zu EINEM Feld verschmelzen („○ 12", „▲ 45" — dieselben
 *             Zeichen wie einzeln); ein Feld mit vielen Karten trägt einen Ring des Fortschritts (eine Einheit)
 *   Wege      (C) beim Zeigen oder Wählen leuchten die Wege „wymaga" vom Feld hinab bis zum Ring und ins Tal, und wohin
 *             es führt; alles andere tritt zurück; der Weg zu einem Berg ist derselbe Weg, nummeriert
 *   Karte     (D) die Karte eines Feldes steht ÜBER ihm (Zeigen mit der Maus, Tippen am Telefon): Name, Fortschritt,
 *             der Stand in Worten, EIN Knopf (Zacznij, Powtórz, Ustaw jako cel), „Otwórz wpis", „Co dalej"; Esc oder ein
 *             Klick daneben schliesst sie
 *   Bleibt    (A) Zoom, gewähltes Feld und Bildlauf über Reiter, Zurück/Vor und Neuladen (`useKept`)
 *   Tasten    Tab zum Bild, Pfeile von Feld zu Feld, Enter wählt, Esc schliesst; dazu eine Liste für Vorleser
 * </code>
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';

import type { Card } from './cardBasics';
import { gaugeFromMarks, withFlows } from './knowing';
import { learnerFlows } from './flowFacts';
import { BAND_CODE, LS_BAND_LABEL, LS_BAND_MARK, LS_BUDGET, LS_FORE, LS_SHRINK, LS_TILE, type LsBand, type LsBands, type LsField, type LsInput, type LsLand, type LsLayout, type LsRun, type LsState } from './landscape';
import { landscapeClient, type LandscapeClient } from './landscapeClient';
import { landscapeInput, landscapeState, lockCards } from './landscapeData';
import { answeredCards, renamer, type Learner } from './learn';
import { gaugeKnow, pathOfEntries, unitMembers } from './PathLearn';
import { readFlow } from './flow';
import { contentOfLibrary, stepEntries } from './FlowPlayer';
import { flowCurrent, flowPath, flowPathModel } from './flowPath';
import { viewPath } from '../routes';
import { PathMap } from './PathMap';
import { pathMarks } from './pathLayout';
import { practiseGraph, practiseIds } from './quilt';
import { planOf, readPlan, type Plan } from './revision';
import { RevisionRun, type RunSource } from './RevisionRun';
import type { RewardRules } from './rewards';
import type { Graph } from './graph';
import { entityNameTex, useCtx } from './ui';
import { needsKnowing, viewList, withKnowing, type ViewDoc } from './views';
import { TexText } from '../ui/tex/Tex';
import './landscape.css';

/* -- Die Zeichnung ------------------------------------------------------------------------------------------------ */

/** Von der Mitte bis zur Ecke einer Kachel (flache Oberseite) — Kante an Kante (E). */
const CORNER = LS_SHRINK / Math.sqrt(3);
const CORNERS = [0, 60, 120, 180, 240, 300].map((a) => [Math.cos((a * Math.PI) / 180) * CORNER, Math.sin((a * Math.PI) / 180) * CORNER] as const);
/** Die halbe Höhe einer Fläche auf dem Schirm (Einheiten). */
const FACE_HALF = Math.sin(Math.PI / 3) * CORNER * LS_FORE;
/** Bis wohin jede Säule hinab reicht (Kacheln) — wo die Zelle davor tiefer liegt, sieht man ihre Wand. */
const FLOOR = -1.25;

interface Geo {
  /** Pixel je Bodeneinheit (waagrecht) und je Kachel in der Höhe. */
  readonly u: number;
  readonly t: number;
  readonly width: number;
  readonly height: number;
  /** Wo die Kamera links und oben beginnt (Bodeneinheiten) und wo das auf dem Schirm liegt. */
  readonly cx0: number;
  readonly cy1: number;
  readonly ox: number;
  readonly oy: number;
}

interface Box {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

const hits = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const pts = (list: readonly (readonly [number, number])[]): string => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Ein Bodenpunkt (gehoben um `lift` Kacheln) auf dem Schirm. */
const screenOf = (geo: Geo, x: number, y: number, lift = 0): [number, number] => [geo.ox + (x - geo.cx0) * geo.u, geo.oy + (geo.cy1 - y) * geo.u * LS_FORE - lift * geo.t];

/** Eine Säule auf dem Schirm: oben die Fläche, vorn drei Seiten bis zum Boden der Karte (flach: nur die Fläche). */
function prism(geo: Geo, x: number, y: number, lift: number, flat = false): { readonly top: string; readonly sides: readonly string[] } {
  const [cx, cy] = screenOf(geo, x, y, 0);
  const at = (i: number, z: number): [number, number] => [cx + CORNERS[i][0] * geo.u, cy - CORNERS[i][1] * geo.u * LS_FORE - z * geo.t];
  const top = pts([0, 1, 2, 3, 4, 5].map((i) => at(i, flat ? 0 : lift)));
  /* Vorn (zum Lernenden): die Kanten unten — 180°→240°, 240°→300°, 300°→0°. */
  const sides = !flat && lift > FLOOR + 1e-6 ? [[3, 4], [4, 5], [5, 0]].map(([a, b]) => pts([at(a, FLOOR), at(b, FLOOR), at(b, lift), at(a, lift)])) : [];
  return { top, sides };
}

/** Im Zoom: liegt eine Zelle in der Kamera (eine Zelle Rand)? Die Umgebung ist flach (keine Säulen, die den Fokus decken). */
const inCamera = (layout: LsLayout, c: LsLand): boolean => {
  const cam = layout.camera;
  return c.x >= cam.x0 - 1 && c.x <= cam.x1 + 1 && c.y >= cam.y0 - 1 && c.y <= cam.y1 + 1.5;
};

/** Die Grösse des Bildes: die Kamera (das ganze Land, im Zoom der Fokus) passt in die Breite; die Höhe folgt. */
function geometryOf(layout: LsLayout, width: number, compact: boolean): Geo {
  const cam = layout.camera;
  const spanX = Math.max(3, cam.x1 - cam.x0 + 2 * CORNER);
  const u = Math.max(5, Math.min(compact ? 30 : layout.path.length > 0 ? 46 : 58, (width - 12) / spanX));
  const t = u * LS_TILE;
  /* Über dem Land: die höchste Säule am oberen Rand und darüber Platz für die Namen der Bereiche. */
  let above = FACE_HALF * u;
  const zoomed = layout.path.length > 0;
  for (const c of layout.land) {
    if (c.y < cam.y1 - 3 || c.x < cam.x0 - 1 || c.x > cam.x1 + 1 || (zoomed && (!c.inScope || !inCamera(layout, c)))) continue;
    above = Math.max(above, (c.y - cam.y1) * u * LS_FORE + Math.max(0, c.lift) * t + FACE_HALF * u);
  }
  above += (width < 480 ? 2 : 2) * 16 + 8;
  const body = Math.max(1, cam.y1 - cam.y0) * u * LS_FORE;
  const below = FACE_HALF * u + Math.abs(FLOOR) * t + 24;
  const ox = (width - (cam.x1 - cam.x0) * u) / 2;
  return { u, t, width, height: Math.ceil(above + body + below), cx0: cam.x0, cy1: cam.y1, ox, oy: above };
}

/* -- Worte -------------------------------------------------------------------------------------------------------- */

const steps = (n: number): string => `${n} ${n === 1 ? 'krok' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'kroki' : 'kroków'}`;

/** Der Stand eines Feldes in Worten (D): gotowe do nauki, 2 kroki dalej, do powtórki, umiesz. */
function stateWords(f: Pick<LsField, 'band' | 'missing' | 'locked'>): string {
  if (f.band === 'ring') return f.locked ? 'gotowe do nauki — najpierw powtórka' : 'gotowe do nauki';
  if (f.band === 'mountain') return `${steps(Math.max(1, f.missing))} dalej`;
  if (f.band === 'due') return 'do powtórki';
  return 'umiesz';
}

/** Das Zeichen eines Feldes: einzeln ● ◑ ○ ▲n, ein Feld „+N" sein Band mit seiner Zahl („○ 12", „▲ 45"; das Tal zählt Gelerntes und zu Wiederholendes). */
function markOf(f: LsField): string {
  if (f.kind === 'area') {
    const n = f.band === 'ring' ? f.ring : f.band === 'due' ? f.due : f.band === 'mountain' ? f.mountain : f.known + f.due;
    return `${LS_BAND_MARK[f.band]} ${n}`;
  }
  return f.band === 'mountain' ? `▲${Math.max(1, f.missing)}` : LS_BAND_MARK[f.band];
}

/** Wie ein Feld sich ansagt (Vorleser, Liste). */
function fieldWords(f: LsField): string {
  if (f.kind === 'area') {
    const parts = [
      f.ring > 0 ? `${f.ring} gotowe do nauki` : '', f.due > 0 ? `${f.due} do powtórki` : '', f.known > 0 ? `${f.known} umiem` : '',
      f.mountain > 0 ? `${f.mountain} za górami (najbliższy ${steps(Math.max(1, f.missing))} dalej)` : ''
    ].filter(Boolean).join(', ');
    return `${f.label} · ${f.count}: ${parts}${f.goal ? ' · cel w środku' : ''}${f.route > 0 ? ` · ${f.route} kroków drogi w środku` : ''}`;
  }
  return `${f.label}: ${stateWords(f)}${f.goal ? ' · cel' : ''}${f.next ? ' · następny krok do celu' : ''}${f.route > 0 ? ' · na drodze do celu' : ''}`;
}

/* -- Wege (C) ------------------------------------------------------------------------------------------------------ */

interface Paths {
  /** Die Wege hinab (Eintrag, Voraussetzung) bis zum Ring und ins Tal. */
  readonly down: readonly (readonly [number, number])[];
  /** Wohin es führt (Folgender, Eintrag) — zwei Stufen. */
  readonly up: readonly (readonly [number, number])[];
  readonly nodes: ReadonlySet<number>;
}

/** Die Wege eines Eintrags (Index wie `LsInput.ids`) über die Voraussetzungen der Karte (`layout.links`). */
function pathsOf(layout: LsLayout, v: number): Paths {
  const parents = new Map<number, number[]>();
  const children = new Map<number, number[]>();
  for (let i = 0; i < layout.links.length; i += 2) {
    const c = layout.links[i];
    const p = layout.links[i + 1];
    parents.set(c, [...(parents.get(c) ?? []), p]);
    children.set(p, [...(children.get(p) ?? []), c]);
  }
  const band = (x: number) => BAND_CODE[layout.bands[x]];
  const down: [number, number][] = [];
  const nodes = new Set<number>([v]);
  const seen = new Set<number>([v]);
  /* Hinab: durch Berge und den Ring; das Gelernte (Tal) ist das Ende des Weges. */
  for (const stack = [v]; stack.length > 0;) {
    const x = stack.pop()!;
    if (band(x) === 'known' || band(x) === 'due') continue;
    for (const p of parents.get(x) ?? []) {
      down.push([x, p]);
      nodes.add(p);
      if (!seen.has(p)) { seen.add(p); stack.push(p); }
    }
  }
  const up: [number, number][] = [];
  let layer = [v];
  for (let level = 0; level < 2; level += 1) {
    const next: number[] = [];
    for (const x of layer) for (const c of children.get(x) ?? []) { up.push([c, x]); if (!nodes.has(c)) { nodes.add(c); next.push(c); } }
    layer = next;
  }
  return { down, up, nodes };
}

/* -- Daten ------------------------------------------------------------------------------------------------------- */

interface Asked {
  readonly budget: number;
  readonly focus: readonly string[];
  readonly goal: string | null;
  readonly narrow: boolean;
  readonly bands: Partial<LsBands> | undefined;
}

/** Die Gestalt aus dem Motor — der Graph nur, wenn er neu ist; der Stand nach jeder Antwort; veraltetes verworfen. */
function useLandscape(client: LandscapeClient | null, input: LsInput, state: LsState, options: Asked): { run: LsRun | null; failed: string | null; pending: boolean } {
  const [run, setRun] = useState<LsRun | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /* 2026-11-03 — eine neuere Frage ist unterwegs (das letzte Bild steht noch). */
  const [pending, setPending] = useState(false);
  /* Was DIESER Motor schon hat — ein neuer (StrictMode, ein neuer Worker) bekommt Graph und Stand noch einmal. */
  const sent = useRef<{ client: LandscapeClient | null; input: LsInput | null; state: LsState | null }>({ client: null, input: null, state: null });
  const seq = useRef(0);
  const focusKey = options.focus.join('|');
  const bandsKey = JSON.stringify(options.bands ?? null);
  useEffect(() => {
    if (client === null) return;
    const my = ++seq.current;
    const same = sent.current.client === client;
    const freshInput = same && sent.current.input === input ? undefined : input;
    const freshState = same && sent.current.state === state && freshInput === undefined ? undefined : state;
    sent.current = { client, input, state };
    setPending(true);
    client.run({ ...(freshInput === undefined ? {} : { input: freshInput }), ...(freshState === undefined ? {} : { state: freshState }), options: { budget: options.budget, focus: options.focus, goal: options.goal, narrow: options.narrow, ...(options.bands === undefined ? {} : { bands: options.bands }) } })
      .then((r) => { if (my === seq.current) { setRun(r); setFailed(null); setPending(false); } }, (e: unknown) => { if (my === seq.current) { setFailed(e instanceof Error ? e.message : String(e)); setPending(false); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- der Fokus und die Anteile als Text
  }, [client, input, state, options.budget, focusKey, options.goal, options.narrow, bandsKey]);
  return { run, failed, pending };
}

/* -- 2026-11-03: was ein Krajobraz behält — über Reiter, Zurück/Vor und Neuladen ------------------------------- */

/**
 * DAS GEDÄCHTNIS EINES KRAJOBRAZ je Baza und Widok (über das Leben des Bildes hinaus): das letzte Bild (sofort wieder da,
 * während neu gerechnet wird), Zoom, das gewählte Feld, die offene Tafel, die Breite und wo die Seite stand. Zoom und
 * gewähltes Feld stehen dazu in der Adresse (`obszar`, `pole` — auf einer Seite mit dem Zakres des Bausteins): ein
 * Neuladen, Zurück und Vor und ein geteilter Link zeigen dieselbe Stelle.
 */
interface Memory {
  run: LsRun | null;
  focus: readonly string[];
  chosen: string | null;
  listed: string | null;
  width: number;
  scroll: number | null;
  /** 2026-11-03 (F) — die offene Einheit (ihre Ścieżka gross) und wo die Seite vorher stand. */
  unit: string | null;
  unitScroll: number | null;
}

const memories = new Map<string, Memory>();
const memoryOf = (key: string): Memory => {
  let m = memories.get(key);
  if (m === undefined) {
    m = { run: null, focus: [], chosen: null, listed: null, width: 0, scroll: null, unit: null, unitScroll: null };
    try { const raw = sessionStorage.getItem(`cg-ls-scroll:${key}`); if (raw !== null && Number.isFinite(Number(raw))) m.scroll = Number(raw); } catch { /* ohne Speicher des Tabs */ }
    memories.set(key, m);
  }
  return m;
};

const urlNames = (scope: string) => ({ focus: `${scope}obszar`, chosen: `${scope}pole`, unit: `${scope}sciezka` });
const hashParams = (): { base: string; params: URLSearchParams } => {
  const hash = typeof window === 'undefined' ? '' : window.location.hash;
  const at = hash.indexOf('?');
  return { base: at < 0 ? hash : hash.slice(0, at), params: new URLSearchParams(at < 0 ? '' : hash.slice(at + 1)) };
};

/** Zoom, Wahl und offene Einheit aus der Adresse — `null`: sie nennt nichts davon. */
function readKept(scope: string): { focus: readonly string[]; chosen: string | null; unit: string | null } | null {
  const { params } = hashParams();
  const names = urlNames(scope);
  const f = params.get(names.focus);
  const c = params.get(names.chosen);
  const u = params.get(names.unit);
  if ((f === null || f === '') && (c === null || c === '') && (u === null || u === '')) return null;
  const focus = f === null || f === '' ? [] : f.split(',').map((x) => { try { return decodeURIComponent(x); } catch { return x; } }).filter((x) => x !== '');
  return { focus, chosen: c === null || c === '' ? null : c, unit: u === null || u === '' ? null : u };
}

/** Zoom und Wahl in die Adresse: ein Zoom als Schritt der Geschichte (Zurück zoomt hinaus), eine Wahl ersetzend. */
function writeKept(scope: string, focus: readonly string[], chosen: string | null, step: boolean, unit: string | null = null): void {
  if (typeof window === 'undefined') return;
  const { base, params } = hashParams();
  const names = urlNames(scope);
  if (focus.length === 0) params.delete(names.focus); else params.set(names.focus, focus.map((x) => encodeURIComponent(x)).join(','));
  if (chosen === null) params.delete(names.chosen); else params.set(names.chosen, chosen);
  if (unit === null) params.delete(names.unit); else params.set(names.unit, unit);
  const query = params.toString();
  const next = `${base}${query === '' ? '' : `?${query}`}`;
  if (next === window.location.hash) return;
  const url = `${window.location.pathname}${window.location.search}${next}`;
  if (step) window.history.pushState(window.history.state, '', url); else window.history.replaceState(window.history.state, '', url);
}

/**
 * ZOOM, WAHL, TAFEL UND BILDLAUF, die bleiben. `scope`: `null` — nichts in der Adresse (ein kleiner Baustein); `''`
 * — `obszar`/`pole`; sonst der Zakres eines Bausteins (`ab12cd.obszar`).
 */
function useKept(key: string, scope: string | null) {
  const mem = memoryOf(key);
  const start = useMemo(() => (scope === null ? null : readKept(scope)), [scope]);
  const [focus, setFocusNow] = useState<readonly string[]>(() => start?.focus ?? mem.focus);
  const [chosen, setChosenNow] = useState<string | null>(() => (start !== null ? start.chosen : mem.chosen));
  const [listed, setListedNow] = useState<string | null>(() => (start !== null ? null : mem.listed));
  const [unit, setUnitNow] = useState<string | null>(() => (start !== null ? start.unit : mem.unit));
  /* Was das Gedächtnis kannte, steht danach auch in der Adresse (ein Neuladen findet es). */
  useEffect(() => {
    if (scope !== null && start === null && (mem.focus.length > 0 || mem.chosen !== null || mem.unit !== null)) writeKept(scope, mem.focus, mem.chosen, false, mem.unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Zurück und Vor: die Adresse sagt, was gilt. */
  useEffect(() => {
    if (scope === null) return undefined;
    const again = () => {
      const now = readKept(scope);
      setFocusNow(now?.focus ?? []);
      setChosenNow(now?.chosen ?? null);
      mem.focus = now?.focus ?? [];
      mem.chosen = now?.chosen ?? null;
      /* Zurück aus einer Einheit: der Krajobraz steht wieder, wo er stand. */
      const was = mem.unit;
      mem.unit = now?.unit ?? null;
      setUnitNow(mem.unit);
      if (was !== null && mem.unit === null) backFromUnit();
    };
    window.addEventListener('popstate', again);
    return () => window.removeEventListener('popstate', again);
  }, [scope, mem]);
  const setFocus = (next: readonly string[]) => {
    setFocusNow(next);
    mem.focus = next;
    if (scope !== null) writeKept(scope, next, null, true);
    setChosenNow(null);
    mem.chosen = null;
  };
  const setChosen = (next: string | null) => {
    setChosenNow(next);
    mem.chosen = next;
    if (scope !== null) writeKept(scope, mem.focus, next, false, mem.unit);
  };
  const setListed = (next: string | null) => { setListedNow(next); mem.listed = next; };
  /* 2026-11-03 (F) — eine Einheit öffnen (ihre Ścieżka gross; ein Schritt der Geschichte: Zurück kehrt in den Krajobraz zurück). */
  const backFromUnit = () => {
    if (mem.unitScroll !== null) mem.scroll = mem.unitScroll;
    mem.unitScroll = null;
    window.requestAnimationFrame(() => restoreScroll());
  };
  const setUnit = (next: string | null) => {
    if (next !== null && mem.unit === null) mem.unitScroll = window.scrollY;
    const was = mem.unit;
    mem.unit = next;
    setUnitNow(next);
    if (scope !== null) writeKept(scope, mem.focus, mem.chosen, next !== null, next);
    if (next === null && was !== null) backFromUnit();
  };
  /* Wo die Seite steht — beim Verlassen schon gemerkt (ein kürzerer Reiter danach setzt den Bildlauf zurück, bevor wir es erfahren). */
  const gone = useRef(false);
  /* Solange der alte Bildlauf zurückgeholt wird, zählt er nicht als neuer (die Seite wächst noch, er bliebe zu kurz stehen). */
  const restoring = useRef(false);
  useLayoutEffect(() => { gone.current = false; return () => { gone.current = true; }; }, []);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (gone.current || restoring.current || frame !== 0 || mem.unit !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (gone.current || restoring.current || mem.unit !== null) return;
        mem.scroll = window.scrollY;
        try { sessionStorage.setItem(`cg-ls-scroll:${key}`, String(Math.round(window.scrollY))); } catch { /* ohne Speicher des Tabs */ }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (frame !== 0) window.cancelAnimationFrame(frame); };
  }, [key, mem]);
  /**
   * DEN BILDLAUF ZURÜCKHOLEN — sofort (ohne das weiche Scrollen der Seite) und so lange, bis die Seite hoch genug ist
   * (Bild und Tafel kommen einen Augenblick später), höchstens anderthalb Sekunden; scrollt der Nutzer selbst, gilt das.
   */
  const restoreScroll = () => {
    const y = mem.scroll;
    if (y === null || y <= 0 || typeof window === 'undefined') return;
    restoring.current = true;
    const until = performance.now() + 1500;
    const stop = () => { restoring.current = false; for (const e of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) window.removeEventListener(e, stop); };
    for (const e of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) window.addEventListener(e, stop, { passive: true });
    const step = () => {
      if (!restoring.current || gone.current) return;
      if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
      if (Math.abs(window.scrollY - y) <= 1 && document.documentElement.scrollHeight >= y + window.innerHeight - 1 && performance.now() > until - 1200) { stop(); return; }
      if (performance.now() < until) window.requestAnimationFrame(step); else stop();
    };
    step();
  };
  return { mem, focus, setFocus, chosen, setChosen, listed, setListed, unit, setUnit, restoreScroll };
}

/** Wer weniger Bewegung will, bekommt keine. */
const still = (): boolean => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;


/* -- Die Ansicht ------------------------------------------------------------------------------------------------ */

export interface LandscapeProps {
  readonly view: ViewDoc;
  /** Alle Karten der Baza (die Kenntnis eines Eintrags rechnet über alle seine Karten). */
  readonly cards: readonly Card[];
  /** Wer hier lernt (das Konto, die Person der Seite, dieser Browser) — ohne: nur zum Ansehen. */
  readonly learner: Learner | null;
  readonly onOpen?: (id: string) => void;
  /** Klein (ein Baustein als Block): weniger Felder, ohne Liste. */
  readonly compact?: boolean;
  /** Punkte und Serie im Lauf (die Regel des Ortes). */
  readonly rewards?: RewardRules | null;
  /** Die Suche des Widoku — Treffer zum Zeigen und als Ziel. */
  readonly query?: string;
  /** Unter welchem Namen das Ziel gemerkt wird (der Widok). */
  readonly viewKey: string;
  /** Was unter einem kleinen Bild steht (der Weg zum Ganzen). */
  readonly more?: ReactNode;
  /**
   * 2026-11-03 — wo Zoom und gewähltes Feld in der Adresse stehen: `''` — `obszar`, `pole`; ein Zakres — `<zakres>.obszar`;
   * fehlt es: nirgends (ein kleiner Baustein).
   */
  readonly urlScope?: string;
  /** 2026-11-03 — draussen wird neu gerechnet (die Karten): das Bild bleibt, ein kleines Zeichen sagt es. */
  readonly busy?: boolean;
}

type Running = { readonly key: string; readonly source: RunSource; readonly then?: () => void };


export function LandscapeView({ view, cards, learner, onOpen, compact = false, rewards = null, query = '', viewKey, more, urlScope, busy = false }: LandscapeProps) {
  const { lib } = useCtx();
  /* 2026-11-03 — was bleibt (`useKept`): je Baza, Widok und Grösse. */
  const keep = useKept(`${lib.libraryId}:${viewKey}:${compact ? 'small' : 'big'}`, urlScope ?? null);
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  const fp = useMemo(() => new Map(cards.map((c) => [c.key, c.fingerprint] as const)), [cards]);
  const [running, setRunning] = useState<Running | null>(null);
  const progress = learner?.progress;
  /* Während eines Laufs hier drin ruht die Rechnung (sonst bei jeder Antwort die ganze Kenntnis neu) — danach einmal. */
  const live = running === null ? progress : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- neu mit jedem Stand des Lernenden (nicht während eines Laufs)
  /* 2026-11-03 (G) — mit dem, was über die Erzählungen bekannt ist (die Bedingung „Przebieg" in den Schritten des Widoku). */
  const flows = useMemo(() => learnerFlows(lib, learner?.progress.positions), [lib, lib.revision, learner, live]); // eslint-disable-line react-hooks/exhaustive-deps
  /* 2026-11-03 (G) — dazu, was auf Seiten beantwortet wurde und für Einträge dieser Baza zählt („about"). */
  const gauge = useMemo(() => withFlows(gaugeFromMarks([...cards, ...(learner === null ? [] : answeredCards(learner.progress, new Set(fp.keys())))], (key) => learner?.marks(key, fp.get(key), rename) ?? [], lib.dependencies(), Date.now(), lib.prerequisites()), flows), [cards, learner, live, fp, rename, lib, lib.revision, flows]);
  /* Der Widok ohne seine Suche (sie zeigt Treffer, sie schneidet nicht); mit der Kenntnis nur, wenn er sie braucht. */
  const wants = needsKnowing(view);
  const plain = useMemo(() => ({ ...view, query: '' }), [view]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => viewList(wants ? withKnowing(lib, gauge) : lib, plain), [lib, lib.revision, plain, wants, wants ? gauge : null]);
  const listKey = useMemo(() => list.map((e) => e.id).join('|'), [list]);
  const groupKey = JSON.stringify(view.group);
  /* Die Eingänge ändern sich mit der Baza und dem Widok — nicht mit jeder Antwort (wer Karten hat, sagen die Karten). */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  /*
    2026-11-03 (G) — ERZÄHLUNGEN ALS FELDER: ein Ablauf mit „unit" ist diese Einheit — sie steht im Krajobraz, auch ohne
    eigene Karten, und ist sie zu Ende, liegt ihr Feld im Tal.
  */
  const stories = useMemo(() => lib.docs('flow').map((d) => ({ doc: d, flow: readFlow(d.id, d.data) })).filter((x) => x.flow.unit !== undefined), [lib, lib.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const storyOf = (id: string) => stories.find((x) => x.flow.unit === id)?.flow;
  const lowered = useMemo(() => new Set(stories.filter((x) => flows.get(x.flow.id)?.done === true).map((x) => x.flow.unit!)), [stories, flows]);
  const shownAskable = useMemo(() => (stories.length === 0 ? gauge : { ...gauge, askable: new Set([...gauge.askable, ...stories.map((x) => x.flow.unit!)]) }), [gauge, stories]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const input = useMemo(() => landscapeInput({ select: lib.selectContext(), deps: lib.dependencies(), label: (e) => lib.label(e) }, list, view.group, shownAskable), [lib, lib.revision, listKey, groupKey, cards, stories]);
  const state = useMemo(() => landscapeState(input, gauge, lowered), [input, gauge, lowered]);
  const index = useMemo(() => new Map(input.ids.map((id, i) => [id, i] as const)), [input]);
  /* Der Motor lebt mit der Ansicht: im Effekt gebaut und beendet — auch zweimal (StrictMode) richtig. */
  const [client, setClient] = useState<LandscapeClient | null>(null);
  useEffect(() => {
    const made = landscapeClient();
    setClient(made);
    return () => { made.dispose(); setClient((was) => (was === made ? null : was)); };
  }, []);
  const [boxRef, boxWidth] = useWidth(keep.mem.width);
  useEffect(() => { if (boxWidth > 0) keep.mem.width = boxWidth; }, [boxWidth, keep.mem]);

  const { focus, setFocus } = keep;
  /* Eine andere Gruppierung: der Zoom gilt nicht mehr. */
  const groupSeen = useRef(groupKey);
  useEffect(() => { if (groupSeen.current !== groupKey) { groupSeen.current = groupKey; setFocus([]); } }, [groupKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const goalKey = `landscape:${viewKey}`;
  const [localGoal, setLocalGoal] = useState<string | null>(null);
  const kept = progress?.positions.get(goalKey)?.step ?? null;
  const goal = learner === null ? localGoal : kept === null || kept === '' ? null : kept;
  const setGoal = (id: string | null) => {
    if (learner === null) { setLocalGoal(id); return; }
    void learner.keepPosition({ flow: goalKey, step: id ?? '', visited: [], at: Date.now() }).catch(() => undefined);
  };
  /* Wie viele Felder einzeln: das Budget des Widoku — auf einem Telefon weniger (die Karte bleibt dieselbe, sie wird nur kleiner). */
  const wanted = view.landscape?.budget ?? LS_BUDGET;
  const budget = Math.min(wanted, compact ? 24 : 400, boxWidth > 0 && boxWidth < 480 ? 22 : boxWidth > 0 && boxWidth < 760 ? 40 : 400);
  const fresh = useLandscape(client, input, state, { budget, focus, goal, narrow: false, bands: view.landscape?.bands });
  /* Bis das neue Bild da ist, das letzte (kein „Liczenie…", das die Seite zusammenfallen lässt). */
  useEffect(() => { if (fresh.run !== null) keep.mem.run = fresh.run; }, [fresh.run, keep.mem]);
  const run = fresh.run ?? keep.mem.run;
  const failed = fresh.failed;

  const { chosen, setChosen } = keep;
  /* Wo die Seite stand, als man ging — einmal, sobald das Bild wieder steht. */
  const scrolled = useRef(false);
  useLayoutEffect(() => {
    if (scrolled.current || run === null || boxWidth === 0) return;
    scrolled.current = true;
    keep.restoreScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, boxWidth]);
  const [note, setNote] = useState<string | null>(null);
  const [said, setSaid] = useState('');

  const labelOf = (id: string): string => { const e = lib.entity(id); return e === undefined ? id : lib.label(e); };
  const bandOf = (id: string): LsBand | null => { const i = index.get(id); return i === undefined || run === null ? null : BAND_CODE[run.layout.bands[i]] ?? null; };
  const heightOf = (id: string): number => { const i = index.get(id); return i === undefined || run === null ? Number.NaN : run.layout.heights[i]; };

  /* -- Lernen ------------------------------------------------------------------------------------------- */

  const planFrom = async (graph: Graph): Promise<Plan | null> => {
    const ctx = lib.revisionContext(cards, (key) => learner?.marks(key, fp.get(key), rename) ?? [], Date.now(), flows);
    const made = await planOf(graph, ctx);
    if (made.plan === null) { setNote(made.problems[0] ?? 'Z tego wpisu nie powstają karty do nauki.'); return null; }
    const plan = { ...made.plan, cards: made.plan.cards.filter((c) => !(learner?.progress.suspended.has(c.key) ?? false)) };
    if (plan.cards.length === 0) { setNote('Do tego wpisu nie ma jeszcze pytań.'); return null; }
    return plan;
  };
  const learnEntry = (id: string, endWhenDone = true) => {
    setNote(null);
    void (async () => {
      const plan = await planFrom(practiseGraph(practiseIds(cards, id), endWhenDone));
      if (plan !== null) setRunning({ key: `learn:${id}:${Date.now()}`, source: { plan, cards, title: labelOf(id) } });
    })();
  };
  const reviewFirst = (id: string) => {
    setNote(null);
    const groups = lockCards(gauge, lib.prerequisites(), id, cards);
    const list = groups.flatMap((g) => g.cards).filter((c) => !(learner?.progress.suspended.has(c.key) ?? false));
    if (list.length === 0) { learnEntry(id); return; }
    const plan = readPlan(list, { mode: 'temporal', order: 'general', pick: 'next', stackSize: 20, endWhenDone: true });
    setRunning({ key: `review:${id}:${Date.now()}`, source: { plan, cards, title: `Najpierw powtórka: ${labelOf(id)}` }, then: () => learnEntry(id) });
  };
  const lockCount = (id: string): number => lockCards(gauge, lib.prerequisites(), id, cards).reduce((s, g) => s + g.cards.length, 0);

  /* Immer in einer Hülle, deren Breite gemessen wird (das Budget hängt an ihr) — auch beim Warten und im Lauf. */
  const host = (body: ReactNode) => <div ref={boxRef} className="cg-ls-host">{body}</div>;
  if (running !== null) {
    return host(
      <div className="cg-ls-run" data-landscape-run={running.key.split(':')[0]}>
        <RevisionRun key={running.key} lib={lib} learner={learner} source={running.source} rewards={rewards}
          onClose={() => setRunning(null)} {...(running.then === undefined ? {} : { onDone: running.then })} />
      </div>
    );
  }
  /* 2026-11-03 (F) — wie viele Teile eine Einheit hat (ihre Ścieżka), und sie gross statt der Karte. */
  const askable = (id: string) => gauge.askable.has(id);
  /* 2026-11-03 (G) — eine Einheit, die eine Erzählung ist: ihre Ścieżka ist die der Erzählung (jetzt dran: wo er in ihr steht). */
  const storyPath = (id: string) => {
    const flow = storyOf(id);
    /* Eine Präsentation trägt ihre Szenen in der Seite: dann die Teile der Einheit (ihre Fragen zeigen dieselben Einträge). */
    if (flow === undefined || flow.graph.nodes.length === 0) return null;
    const content = contentOfLibrary(lib, cards);
    const fp = flowPath(flow, stepEntries(content), labelOf);
    const kept = learner?.progress.positions.get(flow.id);
    return { flow, model: flowPathModel(fp, (x) => lib.prerequisites().needs.get(x) ?? []), current: kept === undefined ? null : flowCurrent(fp, { step: kept.step, visited: kept.visited }) };
  };
  const unitSize = (id: string): number => storyPath(id)?.model.nodes.length ?? unitMembers(lib, id, cards, askable).length;
  if (keep.unit !== null) {
    const story = storyPath(keep.unit);
    const told = storyOf(keep.unit);
    const members = story !== null ? story.model.nodes.map((n) => n.id) : unitMembers(lib, keep.unit, cards, askable);
    const model = story !== null ? story.model : pathOfEntries(members.map((id) => ({ id, label: labelOf(id) })), lib.prerequisites());
    return host(
      <div className="cg-ls-unit" data-landscape-unit-open={keep.unit}>
        <div className="cg-row-between">
          <button type="button" className="wk-link-btn" onClick={() => keep.setUnit(null)} data-landscape-unit-back="">‹ Krajobraz</button>
          <strong><TexText text={entityNameTex(lib, keep.unit)} /></strong>
        </div>
        {told !== undefined && (
          <p className="cg-muted" data-landscape-unit-story={told.id} data-landscape-unit-done={flows.get(told.id)?.done === true ? '1' : '0'}>
            Opowieść: <strong><TexText text={told.name} /></strong>{flows.get(told.id)?.done === true ? ' — ukończona' : flows.has(told.id) ? ' — w drodze' : ''}
            {urlScope === '' && <> · <a className="wk-link" href={viewPath('learn', lib.libraryId, 'przebiegi', told.id, 'graj')} data-landscape-unit-play="">{flows.has(told.id) ? 'Wróć do opowieści' : 'Zacznij opowieść'}</a></>}
          </p>
        )}
        {members.length === 0 ? <p className="cg-muted">Ta jednostka nie ma jeszcze części z pytaniami.</p> : (
          <PathMap model={model} marks={pathMarks(model, gaugeKnow(gauge), story?.current ?? null)} size="full" title={story !== null ? 'Ścieżka opowieści' : 'Ścieżka jednostki'} name={(id) => <TexText text={entityNameTex(lib, id)} />}
            actions={(id, state) => (
              <div className="wk-actions">
                {learner !== null && <button type="button" className="wk-btn" onClick={() => learnEntry(id, state !== 'done')} data-path-learn={id}>{state === 'done' ? 'Powtórz' : 'Ucz się'}</button>}
                {onOpen !== undefined && <button type="button" className="wk-link-btn" onClick={() => onOpen(id)}>Otwórz wpis</button>}
              </div>
            )} />
        )}
      </div>
    );
  }
  if (failed !== null) return host(<p className="wk-error" data-landscape-failed="">Krajobraz: {failed}</p>);
  if (run === null || boxWidth === 0) return host(<p className="cg-muted" data-landscape-wait="">Liczenie krajobrazu…</p>);
  const layout = run.layout;
  if (layout.total === 0 && layout.fields.length === 0) {
    return host(<p className="cg-muted" data-landscape-empty="">W tym widoku nie ma wpisów z pytaniami — krajobraz pokazuje to, czego można się uczyć.</p>);
  }

  /* Ein Feld „+N" öffnet seinen Bereich (Zoom auf seine festen Zellen), wenn er nicht schon das ganze Bild ist. */
  const opens = (f: LsField): boolean => {
    const v = f.value ?? '';
    if (v === '' || v.startsWith('#')) return false;
    const here = layout.path.length > 0 ? layout.path[layout.path.length - 1].value : '';
    return v !== here;
  };
  const zoom = (f: LsField) => { if (!opens(f)) return; setFocus([f.value!]); setSaid(`Pokazano: ${f.label}`); };

  return host(
    <div className={`cg-ls${compact ? ' is-compact' : ''}`} data-landscape={layout.fields.length} data-landscape-ring={layout.counts.ring}
      data-landscape-ms={`${run.ms.graph.toFixed(1)}/${run.ms.heights.toFixed(1)}/${run.ms.layout.toFixed(1)}`} data-landscape-worker={client?.inWorker === true ? '1' : '0'}>
      {/* 2026-11-03 — es wird neu gerechnet: das Bild bleibt stehen, nur ein kleines Zeichen sagt es. */}
      {(busy || fresh.pending) && <p className="cg-ls-busy" role="status" data-landscape-busy="">liczenie…</p>}
      <TopBar layout={layout} focus={focus} onFocus={setFocus} goalLabel={layout.goal === null ? null : labelOf(layout.goal.id)} nextLabel={(id) => labelOf(id)}
        onClearGoal={() => setGoal(null)} onShowGoal={() => { if (layout.goal !== null) setChosen(layout.goal.id); }} />
      {query.trim() !== '' && (
        <SearchHits query={query} ids={input.ids} bandOf={bandOf} heightOf={heightOf} label={labelOf} goal={goal}
          onShow={(id) => setChosen(id)} onGoal={(id) => { setGoal(id); setSaid(`Cel: ${labelOf(id)}`); }} />
      )}
      {layout.notes.map((n) => <p key={n} className="cg-muted cg-ls-note">{n}</p>)}
      <LandscapeMap layout={layout} ids={input.ids} chosen={chosen} onChoose={(f) => setChosen(chosen === f.key ? null : f.key)} onClose={() => setChosen(null)}
        compact={compact} width={boxWidth} client={client}
        onZoom={(value) => setFocus([value])}
        quest={(f, paths) => (
          <Quest field={f} goal={goal} canLearn={learner !== null} note={note} label={labelOf} lockCount={lockCount} paths={paths} unitSize={unitSize} onUnit={(id) => keep.setUnit(id)}
            onLearn={(id) => learnEntry(id)} onReview={(id, band) => learnEntry(id, band !== 'known')} onReviewFirst={(id) => reviewFirst(id)}
            onGoal={(id, on) => { setGoal(on ? id : null); setSaid(on ? `Cel: ${labelOf(id)}` : 'Cel usunięty'); }}
            onZoom={() => zoom(f)} canZoom={opens(f)} {...(onOpen === undefined ? {} : { onOpen })} />
        )} />
      {more}
      <p className="cg-sr" aria-live="polite">{said}</p>
      {!compact && <FieldList layout={layout} onChoose={(f) => setChosen(f.key)} />}
    </div>
  );
}

/* -- Oben: wo man ist, die Bereiche, das Ziel --------------------------------------------------------------------- */

function TopBar({ layout, focus, onFocus, goalLabel, nextLabel, onClearGoal, onShowGoal }: {
  layout: LsLayout;
  focus: readonly string[];
  onFocus: (focus: readonly string[]) => void;
  goalLabel: string | null;
  nextLabel: (id: string) => string;
  onClearGoal: () => void;
  onShowGoal: () => void;
}) {
  const c = layout.counts;
  const mixed = new Set(focus);
  return (
    <div className="cg-ls-top">
      <nav className="cg-ls-crumbs" aria-label="Gdzie jesteś w krajobrazie">
        <button type="button" className="wk-link-btn" disabled={layout.path.length === 0 && focus.length === 0} onClick={() => onFocus([])} data-landscape-up="">Całość</button>
        {layout.path.map((p, i) => (
          <span key={p.value} className="cg-ls-crumb">
            <span aria-hidden>›</span>
            {i === layout.path.length - 1 ? <strong>{p.label}</strong> : <button type="button" className="wk-link-btn" onClick={() => onFocus([p.value])}>{p.label}</button>}
          </span>
        ))}
      </nav>
      <p className="cg-ls-sum" data-landscape-counts={`${c.known}/${c.due}/${c.ring}/${c.mountain}`}>
        <span><span aria-hidden>{LS_BAND_MARK.ring}</span> gotowe do nauki <strong>{c.ring}</strong></span>
        <span><span aria-hidden>{LS_BAND_MARK.due}</span> do powtórki <strong>{c.due}</strong></span>
        <span><span aria-hidden>{LS_BAND_MARK.known}</span> umiem <strong>{c.known}</strong></span>
        <span><span aria-hidden>{LS_BAND_MARK.mountain}</span> za górami <strong>{c.mountain}</strong></span>
      </p>
      {layout.sectors.length > 1 && (
        <ul className="cg-ls-areas" aria-label="Obszary">
          {layout.sectors.map((s) => (
            <li key={s.value || '-'} className={`cg-ls-area is-s${s.subject >= 0 && s.subject < 8 ? s.subject : 'x'}`}>
              <span className="cg-ls-swatch" aria-hidden />
              {s.value !== '' && !s.value.startsWith('#') ? (
                <button type="button" className="wk-link-btn" onClick={() => onFocus([s.value])} data-landscape-area={s.value}>{s.label}</button>
              ) : <span>{s.label}</span>}
              <span className="cg-muted"> {s.count}</span>
              {s.value !== '' && !s.value.startsWith('#') && (
                <button type="button" className={`cg-ls-mix${mixed.has(s.value) ? ' is-on' : ''}`} aria-pressed={mixed.has(s.value)} data-landscape-mix={s.value}
                  aria-label={mixed.has(s.value) ? `Usuń z połączonego widoku: ${s.label}` : `Połącz z innymi obszarami: ${s.label}`} title={mixed.has(s.value) ? 'Usuń z połączonego widoku' : 'Połącz z innymi obszarami'}
                  onClick={() => onFocus(mixed.has(s.value) ? focus.filter((x) => x !== s.value) : [...focus.filter((x) => layout.sectors.some((y) => y.value === x)), s.value])}>{mixed.has(s.value) ? '−' : '+'}</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {layout.goal !== null && goalLabel !== null && (
        <p className="cg-ls-goal" data-landscape-goal={layout.goal.id} data-landscape-goal-steps={layout.goal.steps}>
          <span className="cg-ls-flag" aria-hidden>⚑</span>
          <span>Cel: <strong>{goalLabel}</strong> — {layout.goal.steps === 0 ? (layout.goal.open ? 'możesz zacząć od razu' : 'osiągnięty') : `brakuje ${steps(layout.goal.steps)}`}
            {layout.goal.next.length > 0 && layout.goal.steps > 0 && <> · następny krok: <strong>{nextLabel(layout.goal.next[0])}</strong></>}</span>
          <button type="button" className="wk-link-btn" onClick={onShowGoal}>Pokaż</button>
          <button type="button" className="wk-link-btn" onClick={onClearGoal} data-landscape-goal-clear="">Usuń cel</button>
        </p>
      )}
    </div>
  );
}

/* -- Das Bild ---------------------------------------------------------------------------------------------------- */

interface Placed {
  readonly key: string;
  readonly text: string;
  /** Mitte waagrecht, Grundlinie. */
  readonly x: number;
  readonly y: number;
  readonly box: Box;
}

/** Die Schriften des Bildes aus zwei unsichtbaren Proben (einmal, nach dem ersten Zeichnen). */
function useFonts(svg: RefObject<SVGSVGElement>): { label: Font; sector: Font } {
  const [fonts, setFonts] = useState<{ label: Font; sector: Font }>({ label: FALLBACK_FONT, sector: FALLBACK_FONT });
  useLayoutEffect(() => {
    const read = (sel: string): Font => {
      const el = svg.current?.querySelector(sel);
      if (el === null || el === undefined || typeof getComputedStyle === 'undefined') return FALLBACK_FONT;
      const cs = getComputedStyle(el);
      const px = Number.parseFloat(cs.fontSize) || 12;
      return { css: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, px };
    };
    const label = read('[data-ls-probe="label"]');
    const sector = read('[data-ls-probe="sector"]');
    setFonts((was) => (was.label.css === label.css && was.sector.css === sector.css ? was : { label, sector }));
  }, [svg]);
  return fonts;
}

/**
 * DIE NAMEN DER BEREICHE am äusseren Rand ihres Landes, in ihrer Reihenfolge: über dem Ende des Bogens, so tief wie
 * möglich; passt einer nicht, gekürzt oder eine Zeile höher — nie über einem anderen Namen.
 */
function areaLabelsOf(layout: LsLayout, geo: Geo, font: Font): Placed[] {
  const max = geo.width < 480 ? 14 : geo.width < 900 ? 22 : 30;
  const asc = font.px * 1.05;
  const desc = font.px * 0.4;
  const placed: Placed[] = [];
  for (const s of layout.sectors) {
    if (s.label === '') continue;
    const mid = (s.from + s.to) / 2;
    /* Der äusserste Punkt des Landes in diesem Bogen. */
    let reach = 2.5;
    let topLift = 0;
    for (const c of layout.land) {
      const a = (Math.atan2(c.y, -c.x) * 180) / Math.PI;
      if (a < s.from || a > s.to) continue;
      const rho = Math.hypot(c.x, c.y);
      if (rho > reach) { reach = rho; }
      topLift = Math.max(topLift, c.lift);
    }
    const rad = (mid * Math.PI) / 180;
    const [ax, ay] = screenOf(geo, -Math.cos(rad) * (reach + 0.6), Math.sin(rad) * (reach + 0.6), Math.max(0, topLift));
    let done = false;
    for (const text of shortened(s.label, max)) {
      const w = textWidth(text, font) + 8;
      for (let up = 0; up <= 3 * asc && !done; up += asc * 0.5) {
        const x0 = Math.max(2, Math.min(geo.width - w - 2, ax - w / 2));
        const y = Math.max(asc + 1, ay - 4 - up);
        const box = { x0, x1: x0 + w, y0: y - asc, y1: y + desc };
        if (placed.some((p) => hits(p.box, box))) continue;
        placed.push({ key: s.value, text, x: x0 + w / 2, y, box });
        done = true;
      }
      if (done) break;
    }
  }
  return placed;
}

/** Welche Felder einen Namen tragen: das Ziel, der nächste Schritt, dann was jetzt zu lernen ist — wo er nichts deckt. */
function labelsOf(layout: LsLayout, geo: Geo, font: Font, taken: readonly Box[], zoomed: boolean): Placed[] {
  /* Im Ganzen nur Ziel und nächster Schritt und ein paar, die jetzt zu lernen sind; im Zoom mehr (die Zellen sind grösser). */
  const rank = (f: LsField) => (f.goal ? 0 : f.next ? 1 : f.band === 'ring' && f.kind === 'entry' ? 2 : zoomed && f.band === 'due' && f.kind === 'entry' ? 3 : 9);
  const order = layout.fields.filter((f) => rank(f) < 9 && layout.land[f.cells[0]]?.inScope !== false).sort((a, b) => rank(a) - rank(b) || a.angle - b.angle);
  const max = geo.width < 480 ? 16 : 24;
  const limit = zoomed ? (geo.width < 480 ? 6 : 14) : geo.width < 480 ? 2 : geo.width < 900 ? 5 : 8;
  const out: Placed[] = [];
  /* Die Zeichen aller Felder sind belegt: ein Name deckt nie das Zeichen eines anderen Feldes. */
  const marks: Box[] = layout.fields.map((f) => {
    const [cx, cy] = screenOf(geo, f.x, f.y, f.lift);
    const w = CORNER * geo.u * 0.9;
    return { x0: cx - w, x1: cx + w, y0: cy - FACE_HALF * geo.u, y1: cy + FACE_HALF * geo.u };
  });
  const used: Box[] = [...taken, ...marks];
  for (const f of order) {
    if (out.length >= limit) break;
    const [cx, cy] = screenOf(geo, f.x, f.y, f.lift);
    let done = false;
    for (const text of shortened(f.label, max)) {
      const w = textWidth(text, font) + 4;
      for (const y of [cy + FACE_HALF * geo.u + font.px * 1.05, cy - FACE_HALF * geo.u - 3]) {
        const x0 = Math.max(2, Math.min(geo.width - w - 2, cx - w / 2));
        const box = { x0, x1: x0 + w, y0: y - font.px * 1.05, y1: y + font.px * 0.4 };
        if (box.y0 < 1 || box.y1 > geo.height - 1 || used.some((b) => hits(b, box))) continue;
        out.push({ key: f.key, text, x: x0 + w / 2, y, box });
        used.push(box);
        done = true;
        break;
      }
      if (done) break;
    }
  }
  return out;
}

/** Die Kante eines Gebiets: die Seiten seiner Zellen, an denen eine fremde liegt — auf ihren Flächen. */
function outlineOf(layout: LsLayout, geo: Geo, cells: readonly number[]): string {
  const inside = new Set(cells.map((i) => `${layout.land[i].q},${layout.land[i].r}`));
  /* Die Nachbarn je Seite (flache Oberseite): Ecke i → i+1 liegt gegenüber dem Nachbarn in dieser Richtung. */
  const NB: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  const parts: string[] = [];
  for (const i of cells) {
    const c = layout.land[i];
    const [cx, cy] = screenOf(geo, c.x, c.y, c.lift);
    for (let k = 0; k < 6; k += 1) {
      const [dq, dr] = NB[k];
      if (inside.has(`${c.q + dq},${c.r + dr}`)) continue;
      const a = CORNERS[k];
      const b = CORNERS[(k + 1) % 6];
      parts.push(`M${(cx + a[0] * geo.u).toFixed(1)},${(cy - a[1] * geo.u * LS_FORE).toFixed(1)}L${(cx + b[0] * geo.u).toFixed(1)},${(cy - b[1] * geo.u * LS_FORE).toFixed(1)}`);
    }
  }
  return parts.join('');
}

/** Wie weit eine Zelle steht (für die Schattierung der Berge: Stufe 1–5). */
const shade = (c: LsLand): number => (c.band === 'mountain' ? Math.min(5, 1 + Math.floor(Math.log2(1 + c.steps))) : 0);

function LandscapeMap({ layout, ids, chosen, onChoose, onClose, compact, width, client, onZoom, quest }: {
  layout: LsLayout;
  ids: readonly string[];
  chosen: string | null;
  onChoose: (f: LsField) => void;
  onClose: () => void;
  compact: boolean;
  width: number;
  client: LandscapeClient | null;
  onZoom: (value: string) => void;
  quest: (f: LsField, paths: { readonly route: readonly (readonly string[])[] | null; readonly onHover: (id: string | null) => void }) => ReactNode;
}) {
  const geo = useMemo(() => geometryOf(layout, width, compact), [layout, width, compact]);
  const svg = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const fonts = useFonts(svg);
  const byKey = useMemo(() => new Map(layout.fields.map((f) => [f.key, f] as const)), [layout]);
  const indexOf = useMemo(() => new Map(ids.map((id, i) => [id, i] as const)), [ids]);
  const motion = useMemo(() => !still(), []);
  /* Gezeigt (Maus, mit kurzer Absicht), gewählt (Klick, Tippen, Adresse), und was eine Liste in der Karte zeigt. */
  const [hover, setHover] = useState<string | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const timers = useRef<{ open: number | null; close: number | null }>({ open: null, close: null });
  const clear = () => { for (const k of ['open', 'close'] as const) if (timers.current[k] !== null) { window.clearTimeout(timers.current[k]!); timers.current[k] = null; } };
  useEffect(() => clear, []);
  const shown = (chosen !== null ? byKey.get(chosen) : undefined) ?? (hover !== null ? byKey.get(hover) : undefined);
  /* Der Weg eines Berges (nummeriert auf der Karte, dieselbe Liste in der Karte des Feldes). */
  const [route, setRoute] = useState<{ readonly id: string; readonly steps: readonly (readonly string[])[] } | null>(null);
  useEffect(() => {
    let alive = true;
    if (shown === undefined || shown.kind !== 'entry' || shown.band !== 'mountain' || client === null) { setRoute(null); return undefined; }
    const id = shown.id!;
    void client.route(id).then((r) => { if (alive && r !== null) setRoute({ id, steps: r.steps }); }, () => undefined);
    return () => { alive = false; };
  }, [shown?.key, shown?.band, client]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Welcher Eintrag seine Wege zeigt: was die Liste zeigt, sonst das Feld der Karte. */
  const pathTarget = peek ?? (shown?.kind === 'entry' ? shown.id! : null);
  const paths = useMemo(() => { const v = pathTarget === null ? undefined : indexOf.get(pathTarget); return v === undefined ? null : pathsOf(layout, v); }, [pathTarget, layout, indexOf]);
  const routeSteps = useMemo(() => {
    const m = new Map<number, number>();
    if (route === null || shown?.id !== route.id) return m;
    route.steps.forEach((step, i) => { for (const id of step) { const v = indexOf.get(id); if (v !== undefined) m.set(v, i + 1); } });
    return m;
  }, [route, shown?.id, indexOf]);

  const me = useMemo(() => {
    const [x, y] = screenOf(geo, 0, 0, layout.me.lift);
    return { x, y };
  }, [geo, layout.me.lift]);
  const areaNames = useMemo(() => areaLabelsOf(layout, geo, fonts.sector), [layout, geo, fonts.sector]);
  const meBox: Box = { x0: me.x - 14, x1: me.x + 14, y0: me.y + FACE_HALF * geo.u, y1: me.y + FACE_HALF * geo.u + fonts.label.px * 1.6 };
  const zoomed = layout.path.length > 0;
  const names = useMemo(() => labelsOf(layout, geo, fonts.label, [...areaNames.map((p) => p.box), meBox], zoomed), [layout, geo, fonts.label, areaNames, zoomed]); // eslint-disable-line react-hooks/exhaustive-deps
  const markPx = Math.max(7, Math.min(14, Math.round(FACE_HALF * 2 * geo.u * 0.9)));
  useLayoutEffect(() => { svg.current?.style.setProperty('--ls-mark', `${markPx}px`); }, [markPx]);

  /* Zeigen und Wählen über die Zellen (eine Hand voll Handler für alle). */
  const ownerOf = (target: EventTarget | null): LsField | undefined => {
    const el = (target as Element | null)?.closest?.('[data-ls-owner],[data-ls-field]');
    const key = el?.getAttribute('data-ls-owner') ?? el?.getAttribute('data-ls-field') ?? null;
    return key === null ? undefined : byKey.get(key);
  };
  const enter = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const f = ownerOf(e.target);
    if (f === undefined) return;
    clear();
    if (hover === null) timers.current.open = window.setTimeout(() => setHover(f.key), 120); else setHover(f.key);
  };
  const leave = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clear();
    timers.current.close = window.setTimeout(() => setHover(null), 260);
  };
  const click = (e: { target: EventTarget | null }) => {
    const f = ownerOf(e.target);
    if (f === undefined) return;
    onChoose(f);
  };
  useEffect(() => {
    if (chosen === null && hover === null) return undefined;
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { setHover(null); onClose(); } };
    const outside = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.('.cg-ls-quest') || t?.closest?.('[data-ls-owner],[data-ls-field]')) return;
      setHover(null);
      onClose();
    };
    window.addEventListener('keydown', esc);
    window.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', esc); window.removeEventListener('pointerdown', outside); };
  }, [chosen, hover, onClose]);

  const move = (e: KeyboardEvent<SVGSVGElement>) => {
    const el = (e.target as Element).closest('[data-ls-field]');
    if (el === null) return;
    const at = byKey.get(el.getAttribute('data-ls-field') ?? '');
    if (at === undefined) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChoose(at); return; }
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const d = dirs[e.key];
    let next: LsField | undefined;
    if (d !== undefined) {
      let best = Number.POSITIVE_INFINITY;
      for (const f of layout.fields) {
        if (f.key === at.key) continue;
        const dx = f.x - at.x;
        const dy = f.y - at.y;
        const along = dx * d[0] + dy * d[1];
        if (along <= 0.05) continue;
        const across = Math.abs(dx * d[1] - dy * d[0]);
        const score = along + across * 2.2;
        if (score < best) { best = score; next = f; }
      }
    } else if (e.key === 'Home') next = layout.fields[0];
    else if (e.key === 'End') next = layout.fields[layout.fields.length - 1];
    else return;
    e.preventDefault();
    if (next !== undefined) svg.current?.querySelector<SVGGElement>(`[data-ls-field="${CSS.escape(next.key)}"]`)?.focus();
  };

  const lit = paths?.nodes ?? null;
  const groupCells = shown !== undefined && shown.kind === 'area' ? new Set(shown.cells) : null;
  const dimmed = (i: number, c: LsLand): boolean => (lit !== null ? c.node < 0 || !lit.has(c.node) : groupCells !== null ? !groupCells.has(i) : false);
  const centreOf = (v: number): [number, number] | null => {
    const i = layout.cellOf[v];
    if (i < 0) return null;
    const c = layout.land[i];
    return screenOf(geo, c.x, c.y, c.lift);
  };
  const edge = (a: number, b: number): string | null => {
    const p = centreOf(a);
    const q = centreOf(b);
    if (p === null || q === null) return null;
    const mx = (p[0] + q[0]) / 2;
    const my = Math.min(p[1], q[1]) - Math.abs(p[0] - q[0]) * 0.08 - 4;
    return `M${p[0].toFixed(1)},${p[1].toFixed(1)}Q${mx.toFixed(1)},${my.toFixed(1)} ${q[0].toFixed(1)},${q[1].toFixed(1)}`;
  };
  /* Die Karte eines Feldes steht über ihm (oder darunter, wenn oben kein Platz ist); am Telefon unten im Bild. */
  const anchor = shown === undefined ? null : screenOf(geo, shown.x, shown.y, shown.lift);
  const below = anchor !== null && anchor[1] < 230;
  const sheet = width < 520;
  /* Die anderen Bereiche im Zoom: am Rand, in ihrer Richtung. */
  /* Links, was links des Fokus liegt (die nächsten oben), rechts, was rechts liegt. */
  const focusAngle = layout.sectors.length === 0 ? 90 : layout.sectors.reduce((s, x) => s + (x.from + x.to) / 2, 0) / layout.sectors.length;
  const leftRims = layout.outside.filter((o) => o.angle < focusAngle).sort((a, b) => b.angle - a.angle);
  const rightRims = layout.outside.filter((o) => o.angle >= focusAngle).sort((a, b) => a.angle - b.angle);

  return (
    <div ref={box} className={`cg-ls-map${compact ? ' is-compact' : ''}`}>
      <svg ref={svg} className="cg-ls-svg" width={geo.width} height={geo.height} viewBox={`0 0 ${Math.max(1, geo.width)} ${Math.max(1, geo.height)}`} role="group"
        aria-label="Krajobraz wiedzy: obok Ciebie dolina tego, co umiesz; równina — to, czego możesz się uczyć teraz; góry — tym wyższe, im więcej kroków brakuje."
        onKeyDown={move} onPointerOver={enter} onPointerOut={leave} onClick={click} data-landscape-svg=""
        data-ls-arcs={layout.sectors.map((s) => `${s.from.toFixed(2)},${s.to.toFixed(2)}`).join('|')}>
        <text className="cg-ls-label" data-ls-probe="label" visibility="hidden" x={0} y={-10}>Ag</text>
        <text className="cg-ls-sector" data-ls-probe="sector" visibility="hidden" x={0} y={-10}>Ag</text>
        {/* Das Land: jede Zelle eine Säule, von hinten nach vorn; die Höhe ist der Stand, der Platz bleibt. */}
        <g className={`cg-ls-land${lit !== null || groupCells !== null ? ' is-lit' : ''}`}>
          {layout.land.map((c, i) => {
            if (zoomed && !inCamera(layout, c)) return null;
            const shape = prism(geo, c.x, c.y, c.lift, zoomed && !c.inScope);
            const subject = c.subject >= 0 && c.subject < 8 ? c.subject : 'x';
            return (
              <g key={`${c.q},${c.r}`} className={`cg-ls-cell is-${c.band ?? `ground${c.tone === null ? '' : ` is-tone-${c.tone}`}`} is-s${subject} is-h${shade(c)}${c.inScope ? '' : ' is-out'}${dimmed(i, c) ? ' is-dim' : ''}${motion ? '' : ' is-still'}`}
                data-ls-cell={`${c.q},${c.r}`} {...(c.field === null ? {} : { 'data-ls-owner': c.field })} data-ls-lift={Number(c.lift.toFixed(3))}>
                {shape.sides.map((side, k) => <polygon key={k} className={`cg-ls-side is-${['l', 'f', 'r'][k]}`} points={side} />)}
                <polygon className="cg-ls-face" points={shape.top} />
              </g>
            );
          })}
        </g>
        {/* Die Gebiete, die ein Feld sind: ihre Kante (durchgehend, nie gestrichelt). */}
        <g className="cg-ls-outlines" aria-hidden>
          {layout.fields.filter((f) => f.kind === 'area' && f.cells.length > 1).map((f) => (
            <path key={f.key} className={`cg-ls-outline is-s${f.subject >= 0 && f.subject < 8 ? f.subject : 'x'}${shown?.key === f.key ? ' is-on' : ''}`} d={outlineOf(layout, geo, f.cells)} />
          ))}
          {shown !== undefined && shown.kind === 'entry' && <path className="cg-ls-outline is-on" d={outlineOf(layout, geo, shown.cells)} />}
        </g>
        {/* Die Wege (C): hinab bis zum Ring und ins Tal, und wohin es führt. */}
        {paths !== null && (
          <g className="cg-ls-paths" aria-hidden data-ls-paths={paths.down.length}>
            {paths.up.map(([a, b]) => { const d = edge(a, b); return d === null ? null : <path key={`u${a}-${b}`} className="cg-ls-lead" d={d} />; })}
            {paths.down.map(([a, b]) => { const d = edge(a, b); return d === null ? null : <path key={`d${a}-${b}`} className="cg-ls-path" d={d} />; })}
          </g>
        )}
        {/* Die Zeichen der Felder (über allem Land, damit nichts sie deckt) — und die Ziele für Tastatur und Vorleser. */}
        <g className="cg-ls-marks">
          {layout.fields.map((f) => {
            const [x, y] = screenOf(geo, f.x, f.y, f.lift);
            const s = FACE_HALF * geo.u;
            const words = fieldWords(f);
            const fits = f.kind === 'area' || markPx <= s * 2.4;
            const ring = f.progress !== undefined && f.progress.total > 1;
            const r = Math.max(4, s * 0.92);
            const share = ring ? f.progress!.known / f.progress!.total : 0;
            return (
              <g key={f.key} className={`cg-ls-field is-${f.band}${f.kind === 'area' ? ' is-area' : ''}${shown?.key === f.key ? ' is-on' : ''}${f.goal ? ' is-goal' : ''}${f.next ? ' is-next' : ''}${f.locked ? ' is-locked' : ''}${layout.land[f.cells[0]]?.inScope === false ? ' is-out' : ''}`}
                transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} data-ls-field={f.key} data-ls-band={f.band} data-ls-q={f.q} data-ls-r={f.r} data-ls-row={f.row} data-ls-area={f.area}
                data-ls-height={Number.isFinite(f.height) ? Number(f.height.toFixed(3)) : ''} data-ls-lift={Number(f.lift.toFixed(3))} data-ls-count={f.count}
                tabIndex={0} role="button" aria-pressed={chosen === f.key} aria-label={words}>
                <polygon className="cg-ls-hit" points={pts(CORNERS.map(([cx, cy]) => [cx * geo.u, -cy * geo.u * LS_FORE] as [number, number]))} />
                {ring && (
                  <g className="cg-ls-progress" data-ls-progress={`${f.progress!.known}/${f.progress!.total}`}>
                    <circle className="cg-ls-progress-bg" r={r} />
                    <circle className="cg-ls-progress-on" r={r} strokeDasharray={`${(2 * Math.PI * r * share).toFixed(1)} ${(2 * Math.PI * r).toFixed(1)}`} transform="rotate(-90)" />
                  </g>
                )}
                {f.locked
                  ? <path className="cg-ls-lock" d={`M${-s * 0.42},${-s * 0.1} h${s * 0.84} v${s * 0.66} h${-s * 0.84} z M${-s * 0.24},${-s * 0.1} v${-s * 0.22} a${s * 0.24},${s * 0.24} 0 0 1 ${s * 0.48},0 v${s * 0.22}`} />
                  : fits && <text className={`cg-ls-mark${f.kind === 'area' ? ' is-count' : ''}`} y={markPx * 0.36} textAnchor="middle">{markOf(f)}</text>}
                {f.due > 0 && f.kind === 'entry' && <circle className="cg-ls-duedot" cx={CORNER * geo.u * 0.55} cy={-s * 0.45} r={Math.max(1.6, s * 0.24)} />}
                {f.goal && <path className="cg-ls-goalflag" d={`M${-CORNER * geo.u * 0.62},${s * 0.55} v${-s * 1.1} l${s * 0.6},${s * 0.25} l${-s * 0.6},${s * 0.25}`} />}
                {f.next && !f.goal && <circle className="cg-ls-nextdot" cx={CORNER * geo.u * 0.62} cy={0} r={Math.max(1.5, s * 0.3)} />}
              </g>
            );
          })}
          {/* Der Weg eines Berges: seine Schritte, nummeriert, auf ihren Feldern. */}
          {[...routeSteps].map(([v, n]) => { const p = centreOf(v); return p === null ? null : <text key={`n${v}`} className="cg-ls-step" x={p[0]} y={p[1] - FACE_HALF * geo.u - 2} textAnchor="middle" data-ls-step={n}>{n}</text>; })}
        </g>
        <g className="cg-ls-me" aria-hidden data-ls-me="" data-ls-lift={Number(layout.me.lift.toFixed(3))}>
          {(() => { const shape = prism(geo, 0, 0, layout.me.lift); return <polygon className="cg-ls-me-face" points={shape.top} />; })()}
          <circle cx={me.x} cy={me.y - FACE_HALF * geo.u * 0.38} r={FACE_HALF * geo.u * 0.3} />
          <path d={`M${(me.x - FACE_HALF * geo.u * 0.62).toFixed(1)},${(me.y + FACE_HALF * geo.u * 0.62).toFixed(1)} Q${me.x.toFixed(1)},${(me.y - FACE_HALF * geo.u * 0.25).toFixed(1)} ${(me.x + FACE_HALF * geo.u * 0.62).toFixed(1)},${(me.y + FACE_HALF * geo.u * 0.62).toFixed(1)} Z`} />
          <text x={me.x} y={meBox.y1 - 4} textAnchor="middle" data-ls-me-label="">Ty</text>
        </g>
        <g className="cg-ls-areanames" aria-hidden>
          {areaNames.map((p) => {
            const i = layout.sectors.findIndex((s) => s.value === p.key);
            const s = layout.sectors[i];
            return <text key={`a${p.key}`} className={`cg-ls-sector is-s${s !== undefined && s.subject >= 0 && s.subject < 8 ? s.subject : 'x'}`} x={p.x} y={p.y} textAnchor="middle" data-ls-area-label={p.key} data-ls-area-index={i}>{p.text}</text>;
          })}
        </g>
        <g className="cg-ls-names" aria-hidden>
          {names.map((p) => <text key={p.key} className="cg-ls-label" x={p.x} y={p.y} textAnchor="middle" data-ls-label={p.key}>{p.text}</text>)}
        </g>
      </svg>
      {leftRims.length > 0 && <div className="cg-ls-rims is-left">{leftRims.map((o) => <Rim key={o.value} rim={o} side="left" onZoom={onZoom} />)}</div>}
      {rightRims.length > 0 && <div className="cg-ls-rims is-right">{rightRims.map((o) => <Rim key={o.value} rim={o} side="right" onZoom={onZoom} />)}</div>}
      {shown !== undefined && anchor !== null && (
        <QuestBox className={`cg-ls-quest${sheet ? ' is-sheet' : below ? ' is-below' : ''}`} label={shown.label} questKey={shown.key}
          at={sheet ? null : { left: Math.max(8, Math.min(geo.width - 8, anchor[0])), top: below ? anchor[1] + FACE_HALF * geo.u + 10 : anchor[1] - FACE_HALF * geo.u - 10 }}
          onPointerEnter={() => clear()} onPointerLeave={(e) => { if (e.pointerType === 'mouse' && chosen === null) { clear(); timers.current.close = window.setTimeout(() => setHover(null), 260); } }}>
          {quest(shown, { route: route !== null && route.id === shown.id ? route.steps : null, onHover: setPeek })}
        </QuestBox>
      )}
    </div>
  );
}

/* -- Die Karte eines Feldes (D) ------------------------------------------------------------------------------------ */

function ProgressRing({ known, total }: { known: number; total: number }) {
  const r = 15;
  const share = total === 0 ? 0 : known / total;
  return (
    <svg className="cg-ls-qring" width={40} height={40} viewBox="-20 -20 40 40" aria-hidden>
      <circle className="cg-ls-progress-bg" r={r} />
      <circle className="cg-ls-progress-on" r={r} strokeDasharray={`${(2 * Math.PI * r * share).toFixed(1)} ${(2 * Math.PI * r).toFixed(1)}`} transform="rotate(-90)" />
      <text y={4} textAnchor="middle" fontSize={10}>{Math.round(share * 100)}%</text>
    </svg>
  );
}

function Quest({ field: f, goal, canLearn, note, label, lockCount, paths, onLearn, onReview, onReviewFirst, onGoal, onZoom, canZoom, onOpen, unitSize, onUnit }: {
  field: LsField;
  /** 2026-11-03 (F) — wie viele Teile eine Einheit hat; öffnen zeigt ihre Ścieżka gross. */
  unitSize: (id: string) => number;
  onUnit: (id: string) => void;
  goal: string | null;
  canLearn: boolean;
  note: string | null;
  label: (id: string) => string;
  lockCount: (id: string) => number;
  paths: { readonly route: readonly (readonly string[])[] | null; readonly onHover: (id: string | null) => void };
  onLearn: (id: string) => void;
  onReview: (id: string, band: LsBand) => void;
  onReviewFirst: (id: string) => void;
  onGoal: (id: string, on: boolean) => void;
  onZoom: () => void;
  canZoom: boolean;
  onOpen?: (id: string) => void;
}) {
  const { lib } = useCtx();
  const item = (id: string) => (
    <li key={id}>
      <button type="button" className="cg-ref" onPointerEnter={() => paths.onHover(id)} onPointerLeave={() => paths.onHover(null)} onFocus={() => paths.onHover(id)} onBlur={() => paths.onHover(null)}
        data-landscape-next-item={id}><TexText text={entityNameTex(lib, id)} /></button>
    </li>
  );
  if (f.kind === 'area') {
    return (
      <div className="cg-ls-q">
        <p className="cg-ls-qtitle"><strong>{f.label}</strong> <span className="cg-muted">· {f.count}</span></p>
        <div className="cg-ls-qrow">
          {f.progress !== undefined && <ProgressRing known={f.progress.known} total={f.progress.total} />}
          <p className="cg-ls-qstate">
            {f.ring > 0 && <span>{LS_BAND_MARK.ring} {f.ring} gotowe do nauki</span>}
            {f.due > 0 && <span>{LS_BAND_MARK.due} {f.due} do powtórki</span>}
            {f.known > 0 && <span>{LS_BAND_MARK.known} {f.known} umiem</span>}
            {f.mountain > 0 && <span>{LS_BAND_MARK.mountain} {f.mountain} za górami</span>}
          </p>
        </div>
        <div className="wk-actions">
          {canZoom && <button type="button" className="wk-btn" onClick={onZoom} data-landscape-zoom="">Przybliż</button>}
        </div>
        <p className="cg-ls-qh">W środku</p>
        <ul className="cg-ls-qlist">{(f.ids ?? []).slice(0, 8).map(item)}</ul>
        {(f.ids?.length ?? 0) > 8 && <p className="cg-muted">i {(f.ids?.length ?? 0) - 8} więcej — przybliż, żeby zobaczyć wszystkie.</p>}
      </div>
    );
  }
  const id = f.id!;
  const locks = f.locked ? lockCount(id) : 0;
  const parts = unitSize(id);
  return (
    <div className="cg-ls-q">
      <p className="cg-ls-qtitle"><strong><TexText text={entityNameTex(lib, id)} /></strong></p>
      <div className="cg-ls-qrow">
        {f.progress !== undefined && <ProgressRing known={f.progress.known} total={f.progress.total} />}
        <p className="cg-ls-qstate" data-landscape-state={f.band}><span aria-hidden>{markOf(f)} </span>{stateWords(f)}</p>
      </div>
      <div className="wk-actions">
        {canLearn && f.band === 'ring' && !f.locked && <button type="button" className="wk-btn" onClick={() => onLearn(id)} data-landscape-learn="">Zacznij</button>}
        {canLearn && f.band === 'ring' && f.locked && <button type="button" className="wk-btn" onClick={() => onReviewFirst(id)} data-landscape-review-first="">Najpierw powtórz ({locks})</button>}
        {canLearn && (f.band === 'due' || f.band === 'known') && <button type="button" className={f.band === 'due' ? 'wk-btn' : 'wk-btn wk-btn-line'} onClick={() => onReview(id, f.band)} data-landscape-review="">Powtórz</button>}
        {f.band === 'mountain' && <button type="button" className="wk-btn" onClick={() => onGoal(id, goal !== id)} data-landscape-set-goal="">{goal === id ? 'Usuń cel' : 'Ustaw jako cel'}</button>}
        {onOpen !== undefined && <button type="button" className="wk-link-btn cg-ls-qopen" onClick={() => onOpen(id)} data-landscape-open="">Otwórz wpis</button>}
        {parts > 1 && <button type="button" className="wk-link-btn" onClick={() => onUnit(id)} data-landscape-unit={id}>Pokaż ścieżkę ({parts})</button>}
      </div>
      {!canLearn && f.band !== 'mountain' && <p className="cg-muted">Uczyć się możesz, gdy ten widok wie, kto się uczy (zalogowanie, osoba strony albo ta przeglądarka).</p>}
      {note !== null && <p className="wk-note" role="status">{note}</p>}
      {f.band === 'mountain' && paths.route !== null && paths.route.length > 0 && (
        <div className="cg-ls-route" data-landscape-route={paths.route.length}>
          <p className="cg-ls-qh">Droga — od podstaw (na mapie: 1…{paths.route.length})</p>
          <ol className="cg-ls-qlist">{paths.route.slice(0, 6).map((step, i) => <li key={i}>{step.map((x, j) => <span key={x}>{j > 0 ? ' + ' : ''}<TexText text={entityNameTex(lib, x)} /></span>)}</li>)}</ol>
          {paths.route.length > 6 && <p className="cg-muted">i {paths.route.length - 6} dalszych kroków.</p>}
        </div>
      )}
      {(f.unlocks?.length ?? 0) > 0 && (
        <>
          <p className="cg-ls-qh">Co dalej</p>
          <ul className="cg-ls-qlist" data-landscape-unlocks={f.unlocks!.length}>{f.unlocks!.slice(0, 6).map(item)}</ul>
        </>
      )}
      {f.band === 'mountain' && f.unlocks === undefined && label(id) === '' && null}
    </div>
  );
}

/** Dieselben Felder als Liste — für Vorleser, und für wer lieber liest als schaut. */
function FieldList({ layout, onChoose }: { layout: LsLayout; onChoose: (f: LsField) => void }) {
  const groups: { band: LsBand; title: string }[] = [
    { band: 'ring', title: 'Gotowe do nauki' }, { band: 'due', title: 'Do powtórki' },
    { band: 'mountain', title: 'Za górami (tyle kroków brakuje)' }, { band: 'known', title: 'Umiem' }
  ];
  return (
    <details className="cg-ls-list" data-landscape-list="">
      <summary>Krajobraz jako lista ({layout.fields.length} pól)</summary>
      {groups.map((g) => {
        const of = layout.fields.filter((f) => f.band === g.band).sort((a, b) => (g.band === 'mountain' ? a.missing - b.missing : 0) || a.angle - b.angle);
        if (of.length === 0) return null;
        return (
          <section key={g.band}>
            <h5>{g.title} <span className="cg-muted">({of.length})</span></h5>
            <ul>
              {of.map((f) => <li key={f.key}><button type="button" className="cg-ref" onClick={() => onChoose(f)}>{fieldWords(f)}</button></li>)}
            </ul>
          </section>
        );
      })}
    </details>
  );
}


/** Ein Name am Rand des Zooms (ein anderer Bereich, in seiner Richtung) — ein Knopf, der dorthin zoomt. */
function Rim({ rim, side, onZoom }: { rim: { readonly value: string; readonly label: string; readonly subject: number }; side: 'left' | 'right'; onZoom: (value: string) => void }) {
  return (
    <button type="button" className={`cg-ls-rim is-${side} is-s${rim.subject >= 0 && rim.subject < 8 ? rim.subject : 'x'}`} data-landscape-rim={rim.value} onClick={() => onZoom(rim.value)} aria-label={`Przybliż: ${rim.label}`}>
      {side === 'left' ? '‹ ' : ''}{rim.label}{side === 'right' ? ' ›' : ''}
    </button>
  );
}

/** Die Karte eines Feldes über ihm — gesetzt über eine Referenz (keine Stile im JSX). */
function QuestBox({ className, label, questKey, at, children, onPointerEnter, onPointerLeave }: {
  className: string; label: string; questKey: string; at: { readonly left: number; readonly top: number } | null; children: ReactNode;
  onPointerEnter: () => void; onPointerLeave: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    el.style.left = at === null ? '' : `${at.left.toFixed(0)}px`;
    el.style.top = at === null ? '' : `${at.top.toFixed(0)}px`;
  }, [at?.left, at?.top]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} className={className} role="dialog" aria-label={label} data-landscape-quest={questKey} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>{children}</div>;
}

/* -- Masse und Schrift --------------------------------------------------------------------------------------------- */


function useWidth(initial = 0): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  /* 2026-11-03 — die Breite vom letzten Mal: das Bild steht sofort (gemessen wird gleich danach). */
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(el);
    return () => watch?.disconnect();
  }, []);
  return [ref, width];
}


/** Eine Schrift, wie sie im Bild steht — gemessen (Leinwand), sonst geschätzt. */
interface Font {
  readonly css: string;
  readonly px: number;
}

const FALLBACK_FONT: Font = { css: '', px: 12 };
let measureCanvas: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string, font: Font): number {
  if (measureCanvas === undefined) measureCanvas = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (measureCanvas !== null && font.css !== '') {
    measureCanvas.font = font.css;
    return measureCanvas.measureText(text).width;
  }
  return text.length * font.px * 0.58;
}

/** Kürzungen eines Namens: ganz (bis `max`), dann kürzer mit „…" — nie unter ein paar Zeichen. */
function shortened(label: string, max: number): string[] {
  const out: string[] = [];
  for (const n of [max, 22, 16, 12, 9, 6]) {
    if (n > max) continue;
    const t = label.length > n ? `${label.slice(0, n - 1).trimEnd()}…` : label;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}


/** Treffer der Suche: zeigen — oder als Ziel. */
function SearchHits({ query, ids, bandOf, heightOf, label, goal, onShow, onGoal }: {
  query: string; ids: readonly string[]; bandOf: (id: string) => LsBand | null; heightOf: (id: string) => number; label: (id: string) => string; goal: string | null;
  onShow: (id: string) => void; onGoal: (id: string) => void;
}) {
  const { lib } = useCtx();
  const hits = useMemo(() => {
    const known = new Set(ids);
    const words = query.trim().toLowerCase();
    const found = lib.search(query).filter((e) => known.has(e.id)).map((e) => e.id);
    const more = words === '' ? [] : ids.filter((id) => !found.includes(id) && label(id).toLowerCase().includes(words));
    return [...found, ...more].filter((id) => bandOf(id) !== null).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, ids, lib, lib.revision]);
  if (hits.length === 0) return <p className="cg-muted" data-landscape-hits="0">Nic takiego w tym krajobrazie.</p>;
  return (
    <ul className="cg-ls-hits" data-landscape-hits={hits.length} aria-label="Wyniki wyszukiwania">
      {hits.map((id) => {
        const b = bandOf(id);
        const h = heightOf(id);
        return (
          <li key={id}>
            <span aria-hidden>{b === null ? '·' : b === 'mountain' ? '▲' : LS_BAND_MARK[b]} </span>
            <button type="button" className="cg-ref" onClick={() => onShow(id)} data-landscape-hit={id}><TexText text={entityNameTex(lib, id)} /></button>
            <span className="cg-muted"> {b === null ? '' : b === 'mountain' ? `brakuje ${Math.round(h)}` : LS_BAND_LABEL[b]}</span>
            {(b === 'ring' || b === 'mountain') && goal !== id && <button type="button" className="wk-link-btn" onClick={() => onGoal(id)} data-landscape-hit-goal={id}>Ustaw jako cel</button>}
            {goal === id && <span className="cg-muted"> · cel</span>}
          </li>
        );
      })}
    </ul>
  );
}

