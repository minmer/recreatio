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
 *   Wege      (C) beim Zeigen (nur das) oder Wählen leuchten die Wege „wymaga" vom Feld hinab bis zum Ring und ins Tal,
 *             und wohin es führt; alles andere tritt zurück; EIN Graph auf dem Raster (`landscapeDraw.ts`); der Weg
 *             eines gewählten Berges: seine Schritte, die nächsten drei und das Ziel mit Zahl statt der Höhe
 *   Karte     (D) erst die WAHL öffnet die Karte eines Feldes (Klick, Tippen, Enter), fest im Fenster an ihm — darüber,
 *             darunter oder daneben, immer ganz zu sehen; am Telefon ein Blatt: Name, Fortschritt, der Stand in Worten,
 *             EIN Knopf (Zacznij, Powtórz, Ustaw jako cel), „Otwórz wpis"; darunter rollend der ganze Weg, „Co dalej",
 *             „W środku"; Esc oder ein Klick daneben schliesst sie
 *   Farbe     je weisser, desto weniger gewusst und erreichbar; kein Zeichen über einem anderen (`placeLabels`)
 *   Bleibt    (A) Zoom, gewähltes Feld und Bildlauf über Reiter, Zurück/Vor und Neuladen (`useKept`)
 *   Tasten    Tab zum Bild, Pfeile von Feld zu Feld, Enter wählt, Esc schliesst; dazu eine Liste für Vorleser
 * </code>
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import type { Card } from './cardBasics';
import { gaugeFromMarks, withFlows } from './knowing';
import { learnerFlows, reviewStart, STORY_BUTTON, storyStage, type StoryStage } from './flowFacts';
import { BAND_CODE, LS_FORE, LS_SHRINK, LS_TILE, type LsBand, type LsBands, type LsField, type LsInput, type LsLand, type LsLayout, type LsRun, type LsState } from './landscape';
import { landscapeClient, type LandscapeClient } from './landscapeClient';
import { landscapeInput, landscapeState, lockCards } from './landscapeData';
import { cellEdges, hexRoutes, segmentKey } from './landscapeDraw';
import { answeredCards, renamer, type Learner } from './learn';
import { authorOrder, gaugeKnow, pathOfEntries, unitMembers } from './PathLearn';
import { nestLayout, nestSubtree, readNest } from './landscapeNest';
import { cardsAbout } from './prerequisites';
import { cardKnowness } from './knowing';
import { readFlow, resolveFlow, type Flow } from './flow';
import { contentOfLibrary, FlowPlayer, stepEntries } from './FlowPlayer';
import { stepWorkOf, storyMarks, storyPath as storyPathOf } from './storyPath';
import { viewPath } from '../routes';
import { PathMap } from './PathMap';
import { countsAsStep, pathMarks } from './pathLayout';
import { practiseGraph, practiseIds } from './quilt';
import { planOf, readPlan, type Plan } from './revision';
import { RevisionRun, type RunSource } from './RevisionRun';
import type { RewardRules } from './rewards';
import type { Graph } from './graph';
import { entityNameTex, useCtx } from './ui';
import { needsKnowing, viewList, withKnowing, type ViewDoc } from './views';
import { TexText } from '../ui/tex/Tex';
import { baseLang, words, type Words } from './lang';
import { skipStep } from './flowAsk';
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
function geometryOf(layout: LsLayout, width: number, compact: boolean, room = 640): Geo {
  const cam = layout.camera;
  const spanX = Math.max(3, cam.x1 - cam.x0 + 2 * CORNER);
  /* 2026-11-03 — eine Ebene mit wenigen Feldern (verschachtelt) darf größer stehen. */
  const few = layout.land.length <= 12;
  const u = Math.max(5, Math.min(compact ? (few ? 40 : 30) : few ? 92 : layout.path.length > 0 ? 46 : 58, (width - 12) / spanX));
  /*
    2026-11-04 — JEDER SCHRITT GLEICH HOCH, OHNE DECKEL: die höchste Säule bestimmt, wie hoch ein Schritt sein darf, damit
    die ganze Karte in den Raum passt (`room`) — verkleinert wird die Schrittweite, nie ein Berg gestaucht.
  */
  let tall = 1;
  for (const c of layout.land) if (c.field !== null) tall = Math.max(tall, c.lift);
  const flatPart = Math.max(1, cam.y1 - cam.y0) * u * LS_FORE + 2 * FACE_HALF * u + 80;
  const t = Math.min(u * LS_TILE, Math.max(1.2, (room - flatPart) / tall));
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

/**
 * 2026-11-04 — DIE WORTE DER BAZA (`lang.ts`): gesetzt am Anfang jeder Zeichnung des Krajobraz — alles darunter (die Liste, die
 * Seitenleiste, die Legende) zeichnet im selben Durchgang und spricht dieselbe Sprache.
 */
let W: Words = words('pl');
const steps = (n: number): string => W.steps(n);

/** 2026-11-03 (Prompt 5) — wo der Lernende in einer Erzählung steht, in Worten. */
const STORY_WORDS: Readonly<Record<StoryStage, string>> = {
  new: '', started: 'w drodze', review: 'ukończona — przegląd jeszcze niezdany', passed: 'ukończona'
};

/** Der Stand eines Feldes in Worten (D): gotowe do nauki, 2 kroki dalej, do powtórki, umiesz. */
function stateWords(f: Pick<LsField, 'band' | 'missing' | 'locked'>): string {
  if (f.band === 'ring') return f.locked ? `${W.ready} — ${W.reviewFirstState}` : W.ready;
  if (f.band === 'mountain') return W.away(Math.max(1, f.missing));
  if (f.band === 'due') return W.due;
  return W.youKnow;
}

/** 2026-11-03 — der Stand einer Gruppe (eines Knotens) in Worten. */
function groupWords(f: LsField): string {
  if (f.band === 'known') return `${W.known} — 100 %`;
  if (f.band === 'due') return `${W.known} · ${f.due} ${W.due}`;
  if (f.band === 'ring') return f.locked ? W.reviewFirstState : `${f.ring} ${W.ready}${f.due > 0 ? ` · ${f.due} ${W.due}` : ''}`;
  return W.away(Math.max(1, f.missing));
}

/** Wie ein Feld sich ansagt (Vorleser, Liste). */
function fieldWords(f: LsField): string {
  if (f.kind === 'area') {
    const parts = [
      f.ring > 0 ? `${f.ring} ${W.ready}` : '', f.due > 0 ? `${f.due} ${W.due}` : '', f.known > 0 ? `${f.known} ${W.known}` : '',
      f.mountain > 0 ? `${f.mountain} ${W.behind} (${W.away(Math.max(1, f.missing))})` : ''
    ].filter(Boolean).join(', ');
    return `${f.label} · ${f.count}: ${parts}${f.goal ? ` · ${W.goal}` : ''}`;
  }
  return `${f.label}: ${stateWords(f)}${f.goal ? ` · ${W.goal}` : ''}${f.next ? ` · ${W.nextStep}` : ''}`;
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

/** Was hier drin läuft: eine Powtórka (RevisionRun) — oder 2026-11-03 (Prompt 5) eine Erzählung im Spieler (an ihrer Stelle oder am Przegląd). */
type Running =
  | { readonly key: string; readonly source: RunSource; readonly then?: () => void; readonly story?: undefined; readonly origin?: string }
  | { readonly key: string; readonly story: Flow; readonly jump: { readonly step: string; readonly at: number } | null; readonly source?: undefined };


export function LandscapeView({ view, cards, learner, onOpen, compact = false, rewards = null, query = '', viewKey, more, urlScope, busy = false }: LandscapeProps) {
  const { lib } = useCtx();
  W = words(baseLang(lib));
  /* 2026-11-04 (Prompt 9) — die Seitenleiste (breit) und was sie ausser dem gewählten Feld zeigt. */
  const [sideEl, setSideEl] = useState<HTMLElement | null>(null);
  const [showReady, setShowReady] = useState(false);
  const [goalDone, setGoalDone] = useState<string | null>(null);
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
  /*
    2026-11-03 — DER VERSCHACHTELTE KRAJOBRAZ (`"landscape": {"nest": "pole"}`): die Knoten aus den Daten; jede Ebene eine
    Karte (`landscapeNest.ts`). Ohne `nest` wie bisher — doch nichts mehr zusammengefasst.
  */
  const nestField = view.landscape?.nest ?? null;
  const nestSort = view.landscape?.nestSort ?? 'nr';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tree = useMemo(() => (nestField === null ? null : readNest(lib, list.map((e) => e.id), nestField, nestSort)), [lib, lib.revision, listKey, nestField, nestSort]);
  const groupKey = JSON.stringify(view.group);
  /* Die Eingänge ändern sich mit der Baza und dem Widok — nicht mit jeder Antwort (wer Karten hat, sagen die Karten). */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  /*
    2026-11-03 (G) — ERZÄHLUNGEN ALS FELDER: ein Ablauf mit „unit" ist diese Einheit — sie steht im Krajobraz, auch ohne
    eigene Karten, und ist sie zu Ende, liegt ihr Feld im Tal.
  */
  const stories = useMemo(() => lib.docs('flow').map((d) => ({ doc: d, flow: readFlow(d.id, d.data) })).filter((x) => x.flow.unit !== undefined), [lib, lib.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const storyOf = (id: string) => stories.find((x) => x.flow.unit === id)?.flow;
  /*
    2026-11-03 (Prompt 5) — ERST DER BESTANDENE PRZEGLĄD SENKT: ein Ablauf mit Zielen senkt seine Einheit, wenn er zu Ende ist
    und jedes Ziel erreicht hat; ohne Ziele wie bisher, wenn er zu Ende ist.
  */
  const lowered = useMemo(() => new Set(stories.filter((x) => storyStage(x.flow, flows.get(x.flow.id)) === 'passed').map((x) => x.flow.unit!)), [stories, flows]);
  const stageOf = (flow: Flow): StoryStage => storyStage(flow, flows.get(flow.id));
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
  const [localSteps, setLocalSteps] = useState<readonly string[]>([]);
  /* 2026-11-04 (Prompt 9, 4a) — der Weg zum Ziel bleibt gemerkt (über Sitzungen), damit Erledigtes abgehakt stehen bleibt. */
  const goalSteps: readonly string[] = learner === null ? localSteps : progress?.positions.get(goalKey)?.visited ?? [];
  const setGoal = (id: string | null) => {
    const keepIt = (steps: readonly string[]) => {
      if (learner === null) { setLocalGoal(id); setLocalSteps(steps); return; }
      void learner.keepPosition({ flow: goalKey, step: id ?? '', visited: [...steps], at: Date.now() }).catch(() => undefined);
    };
    if (id === null || client === null) { keepIt([]); return; }
    void client.route(id).then((r) => keepIt([...(r?.steps.flat() ?? []), id]), () => keepIt([id]));
  };
  /* Wie viele Felder einzeln: das Budget des Widoku — auf einem Telefon weniger (die Karte bleibt dieselbe, sie wird nur kleiner). */
  /* 2026-11-03 — jedes Feld einzeln: das Budget fasst nichts mehr zusammen (was zusammengehört, sagen die Knoten). */
  const budget = 1_000_000;
  const fresh = useLandscape(client, input, state, { budget, focus: tree === null ? focus : [], goal, narrow: false, bands: view.landscape?.bands });
  /* Bis das neue Bild da ist, das letzte (kein „Liczenie…", das die Seite zusammenfallen lässt). */
  useEffect(() => { if (fresh.run !== null) keep.mem.run = fresh.run; }, [fresh.run, keep.mem]);
  const run = fresh.run ?? keep.mem.run;
  const order = useMemo(() => authorOrder(lib), [lib, lib.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const nestFocus = focus[0] ?? null;
  const shownLayout = useMemo(() => (run === null ? null : tree === null ? run.layout : nestLayout(input, run.layout, state, tree, nestFocus, order)), [run, tree, input, state, nestFocus, order]);
  const failed = fresh.failed;
  useEffect(() => {
    if (goal === null || run === null) return;
    const i = index.get(goal);
    const b = i === undefined ? null : BAND_CODE[run.layout.bands[i]] ?? null;
    if (b === 'known' || b === 'due') { setGoalDone(goal); setGoal(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, run]);

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
  /* 2026-11-04 — ein Teil einer Erzählung lernen: die Karten über alles, wonach er fragt. */
  const learnParts = (title: string, ids: readonly string[], endWhenDone = true) => {
    setNote(null);
    void (async () => {
      const plan = await planFrom(practiseGraph([...new Set(ids.flatMap((x) => practiseIds(cards, x)))], endWhenDone));
      if (plan !== null) setRunning({ key: `learn:${title}:${Date.now()}`, source: { plan, cards, title } });
    })();
  };
  const learnEntry = (id: string, endWhenDone = true) => {
    setNote(null);
    void (async () => {
      const plan = await planFrom(practiseGraph(practiseIds(cards, id), endWhenDone));
      if (plan !== null) setRunning({ key: `learn:${id}:${Date.now()}`, source: { plan, cards, title: labelOf(id) } });
    })();
  };
  const reviewFirst = (id: string, after?: () => void) => {
    setNote(null);
    const groups = lockCards(gauge, lib.prerequisites(), id, cards);
    const list = groups.flatMap((g) => g.cards).filter((c) => !(learner?.progress.suspended.has(c.key) ?? false));
    const next = after ?? (() => learnEntry(id));
    if (list.length === 0) { next(); return; }
    const plan = readPlan(list, { mode: 'temporal', order: 'general', pick: 'next', stackSize: 20, endWhenDone: true });
    setRunning({ key: `review:${id}:${Date.now()}`, source: { plan, cards, title: `${W.reviewFirstWhat}: ${labelOf(id)}` }, then: next, origin: id });
  };
  const lockCount = (id: string): number => lockCards(gauge, lib.prerequisites(), id, cards).reduce((s, g) => s + g.cards.length, 0);
  const lockNames = (id: string): string[] => lockCards(gauge, lib.prerequisites(), id, cards).map((g) => g.entry);
  /* 2026-11-04 (Prompt 9) — das Ende einer Powtórka hier: das Thema öffnen, die anderen Themen, zurück zur Karte (das Feld bleibt gewählt). */
  const openTopic = (id: string) => { const flow = storyOf(id); if (flow !== undefined && !gauge.testing.has(id)) { setRunning(null); window.setTimeout(() => openStory(flow, false), 0); return; } learnEntry(id); };
  const closingFor = (origin: string | null) => ({
    origin, goal: goalSteps.length > 0 ? goalSteps : null, label: labelOf, openTopic,
    others: () => { setRunning(null); setShowReady(true); }, back: () => setRunning(null)
  });

  /* Immer in einer Hülle, deren Breite gemessen wird (das Budget hängt an ihr) — auch beim Warten und im Lauf. */
  const host = (body: ReactNode) => <div ref={boxRef} className="cg-ls-host">{body}</div>;
  if (running !== null) {
    /* 2026-11-03 (Prompt 5) — eine Erzählung im Spieler, hier drin: an der Stelle, an der der Lernende war, oder am Przegląd. */
    if (running.story !== undefined) {
      return host(
        <div className="cg-ls-run" data-landscape-run="story" data-landscape-run-flow={running.story.id}>
          <FlowPlayer key={running.key} flow={running.story} content={contentOfLibrary(lib, cards)} learner={learner} onClose={() => setRunning(null)} jumpTo={running.jump} />
        </div>
      );
    }
    return host(
      <div className="cg-ls-run" data-landscape-run={running.key.split(':')[0]}>
        <RevisionRun key={running.key} lib={lib} learner={learner} source={running.source} rewards={rewards} closing={closingFor(running.origin ?? null)}
          onClose={() => setRunning(null)} {...(running.then === undefined ? {} : { onDone: running.then })} />
      </div>
    );
  }
  /*
    2026-11-03 (Prompt 5) — EINE EINHEIT, DIE EINE ERZÄHLUNG IST (ein Ablauf zeigt auf sie, eigene Karten hat sie keine): ihr
    Knopf öffnet den Spieler — „Powtórz przegląd" am Teil des Przeglądu (`review`; ohne ihn am Anfang).
  */
  const storyUnit = (id: string): Flow | undefined => (gauge.testing.has(id) ? undefined : storyOf(id));
  const openStory = (flow: Flow, review: boolean) => {
    const find = (x: string) => { const d = lib.docs('flow').find((one) => one.id === x); return d === undefined ? undefined : readFlow(d.id, d.data); };
    const full = resolveFlow(flow, find);
    const at = review ? reviewStart(full) : null;
    setRunning({ key: `story:${full.id}:${Date.now()}`, story: full, jump: at === null ? null : { step: at, at: Date.now() } });
  };
  /* 2026-11-03 (F) — wie viele Teile eine Einheit hat (ihre Ścieżka), und sie gross statt der Karte. */
  const askable = (id: string) => gauge.askable.has(id);
  /* 2026-11-03 (G) — eine Einheit, die eine Erzählung ist: ihre Ścieżka ist die der Erzählung (jetzt dran: wo er in ihr steht). */
  const storyPath = (id: string) => {
    const flow = storyOf(id);
    /* Eine Präsentation trägt ihre Szenen in der Seite: dann die Teile der Einheit (ihre Fragen zeigen dieselben Einträge). */
    if (flow === undefined || flow.graph.nodes.length === 0) return null;
    /* 2026-11-04 — die Teile der Erzählung (Lesen, Fragen, Przegląd, Gabeln), ihr Stand aus der gemerkten Stelle. */
    const content = contentOfLibrary(lib, cards);
    const sp = storyPathOf(flow, stepWorkOf(stepEntries(content)), labelOf);
    const kept = learner?.progress.positions.get(flow.id);
    const known = gaugeKnow(gauge);
    /* 2026-11-04 (Prompt 10) — was die Erzählung wirklich fragen würde (gekonnte Fragen übersprungen). */
    const nodeOf = new Map(flow.graph.nodes.map((n) => [n.id, n] as const));
    const marks = storyMarks(sp, {
      visited: kept?.visited ?? [], step: kept?.step ?? null, ended: flows.get(flow.id)?.done === true,
      ...(learner === null ? {} : {
        know: (x: string) => (content.cardsOf(x).length === 0 ? { learned: true, due: false } : known(x)),
        knownStep: (s: string) => { const n = nodeOf.get(s); return n !== undefined && skipStep(n, content.card, (c) => learner.marks(c.key, c.fingerprint, content.rename)); }
      })
    });
    return { flow, sp, model: sp.model, marks };
  };
  const unitSize = (id: string): number => { const s = storyPath(id); return s !== null ? s.model.nodes.filter(countsAsStep).length : unitMembers(lib, id, cards, askable).length; };
  if (keep.unit !== null) {
    const story = storyPath(keep.unit);
    const told = storyOf(keep.unit);
    const members = story !== null ? story.model.nodes.filter(countsAsStep).map((n) => n.id) : unitMembers(lib, keep.unit, cards, askable);
    const model = story !== null ? story.model : pathOfEntries(members.map((id) => ({ id, label: labelOf(id) })), lib.prerequisites());
    return host(
      <div className="cg-ls-unit" data-landscape-unit-open={keep.unit}>
        <div className="cg-row-between">
          <button type="button" className="wk-link-btn" onClick={() => keep.setUnit(null)} data-landscape-unit-back="">‹ Krajobraz</button>
          <strong><TexText text={entityNameTex(lib, keep.unit)} /></strong>
        </div>
        {told !== undefined && (
          <p className="cg-muted" data-landscape-unit-story={told.id} data-landscape-unit-done={flows.get(told.id)?.done === true ? '1' : '0'}>
            Opowieść: <strong><TexText text={told.name} /></strong>{STORY_WORDS[stageOf(told)] === '' ? '' : ` — ${STORY_WORDS[stageOf(told)]}`}
            {urlScope === '' && <> · <a className="wk-link" href={viewPath('learn', lib.libraryId, 'przebiegi', told.id, 'graj')} data-landscape-unit-play="">{flows.has(told.id) ? 'Wróć do opowieści' : 'Zacznij opowieść'}</a></>}
          </p>
        )}
        {members.length === 0 ? <p className="cg-muted">Ta jednostka nie ma jeszcze części z pytaniami.</p> : (
          story !== null ? (
            <PathMap model={story.model} marks={story.marks} size="full" words={W} title={`${W.pathTitle}: ${W.story}`} name={(id) => <TexText text={story.model.nodes[story.model.index.get(id) ?? -1]?.label ?? id} />}
              onPick={(id) => { const part = story.sp.parts[story.model.index.get(id) ?? -1]; if (part !== undefined && part.first !== null) setRunning({ key: `story:${story.flow.id}:${Date.now()}`, story: story.flow, jump: { step: part.first, at: Date.now() } }); }}
              actions={(id, state) => {
                const part = story.sp.parts[story.model.index.get(id) ?? -1];
                if (part === undefined || part.kind === 'start' || part.kind === 'end' || part.kind === 'fork') return null;
                const asked = part.asked.filter((x) => cardsAbout(cards, x).length > 0);
                return (
                  <div className="wk-actions">
                    {learner !== null && asked.length > 0 && <button type="button" className="wk-btn" onClick={() => learnParts(part.label, asked, state !== 'done')} data-path-learn={id}>{state === 'done' ? 'Powtórz' : 'Ucz się'}</button>}
                  </div>
                );
              }} />
          ) : (
          <PathMap model={model} marks={pathMarks(model, gaugeKnow(gauge), null)} size="full" words={W} name={(id) => <TexText text={entityNameTex(lib, id)} />}
            actions={(id, state) => (
              <div className="wk-actions">
                {learner !== null && <button type="button" className="wk-btn" onClick={() => learnEntry(id, state !== 'done')} data-path-learn={id}>{state === 'done' ? 'Powtórz' : 'Ucz się'}</button>}
                {onOpen !== undefined && <button type="button" className="wk-link-btn" onClick={() => onOpen(id)}>Otwórz wpis</button>}
              </div>
            )} />
          )
        )}
      </div>
    );
  }
  if (failed !== null) return host(<p className="wk-error" data-landscape-failed="">Krajobraz: {failed}</p>);
  if (run === null || boxWidth === 0) return host(<p className="cg-muted" data-landscape-wait="">Liczenie krajobrazu…</p>);
  const layout = shownLayout ?? run.layout;
  /* 2026-11-03 — die Einträge im ganzen Teilbaum eines Knotens; „Powtórz" (was darin zu wiederholen ist) und „Ustaw jako cel" (das Nächste darin). */
  const groupIds = (f: LsField): string[] => (tree === null || f.value === undefined ? [...(f.ids ?? [])] : nestSubtree(tree, f.value, list.map((e) => e.id)));
  const reviewGroup = (f: LsField) => {
    setNote(null);
    const keys = new Set<string>();
    const due = groupIds(f).flatMap((id) => cardsAbout(cards, id)).filter((c) => { if (keys.has(c.key)) return false; keys.add(c.key); return gauge.states.has(c.key) && cardKnowness(gauge, c.key) < 1 && !(learner?.progress.suspended.has(c.key) ?? false); });
    if (due.length === 0) { setNote('Nic tu teraz nie czeka na powtórkę.'); return; }
    setRunning({ key: `review:${f.key}:${Date.now()}`, source: { plan: readPlan(due, { mode: 'temporal', order: 'general', pick: 'next', stackSize: 20, endWhenDone: true }), cards, title: `Powtórka: ${f.label}` } });
  };
  const goalOfGroup = (f: LsField) => {
    let best: string | null = null;
    let low = Number.POSITIVE_INFINITY;
    for (const id of groupIds(f)) { if (bandOf(id) !== 'mountain') continue; const h = heightOf(id); if (h < low) { low = h; best = id; } }
    if (best !== null) { setGoal(best); setSaid(`Cel: ${labelOf(best)}`); }
  };
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
  /* 2026-11-03 (Prompt 3) — aus Liste, Suche und Ziel: das Feld wählen und ins Bild holen (seine Karte steht an ihm). */
  const showField = (key: string) => {
    setChosen(key);
    window.requestAnimationFrame(() => { const el = document.querySelector(`[data-ls-field="${CSS.escape(key)}"]`); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
  };

  const wide = !compact && boxWidth >= 860;
  const mapWidth = wide ? Math.max(320, boxWidth - 352) : boxWidth;
  const fieldKey = (id: string) => layout.fields.find((x) => x.id === id || (x.ids ?? []).includes(id))?.key ?? id;
  const kindWords = (id: string) => (storyUnit(id) !== undefined ? W.story : W.questions(cardsAbout(cards, id).length));
  const goalList = goal !== null && goalSteps.length > 0 ? (
    <section className="cg-ls-goalpanel" data-landscape-goal-list={goalSteps.length}>
      <p className="cg-ls-qh">{W.goalRoute}</p>
      {layout.goal !== null && <p className="cg-muted">{W.goalRouteNote(goalSteps.filter((x) => bandOf(x) !== 'known' && bandOf(x) !== 'due').length, layout.goal.steps)}</p>}
      <ol className="cg-ls-qlist is-scroll cg-ls-goalsteps">
        {goalSteps.map((id, k) => {
          const b = bandOf(id);
          const isDone = b === 'known' || b === 'due';
          const isNext = !isDone && (layout.goal?.next.includes(id) ?? false);
          return (
            <li key={id} className={isDone ? 'is-done' : isNext ? 'is-next' : ''} data-landscape-goal-item={id} data-landscape-goal-state={isDone ? 'done' : isNext ? 'next' : b ?? ''}>
              <span className="cg-ls-goaltick" aria-hidden>{isDone ? '✓' : k + 1}</span>
              <button type="button" className="cg-ref" onClick={() => showField(fieldKey(id))}><TexText text={entityNameTex(lib, id)} /></button>
              <span className="cg-muted"> · {isDone ? W.known : b === null ? '' : stateWords({ band: b, missing: Math.round(heightOf(id)), locked: false })} · {kindWords(id)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  ) : null;
  const readyList = showReady ? (
    <section className="cg-ls-goalpanel" data-landscape-ready-list="">
      <div className="cg-row-between"><p className="cg-ls-qh">{W.readyList}</p><button type="button" className="cg-ls-qclose" aria-label={W.close} onClick={() => setShowReady(false)}>×</button></div>
      <ul className="cg-ls-qlist is-scroll">
        {layout.fields.filter((x) => x.band === 'ring' && x.kind === 'entry').slice(0, 40).map((x) => <li key={x.key}><button type="button" className="cg-ref" onClick={() => showField(x.key)}><TexText text={entityNameTex(lib, x.id!)} /></button></li>)}
      </ul>
    </section>
  ) : null;
  return host(
    <div className={`cg-ls${compact ? ' is-compact' : ''}${wide ? ' has-side' : ''}`} data-landscape={layout.fields.length} data-landscape-ring={layout.counts.ring}
      data-landscape-ms={`${run.ms.graph.toFixed(1)}/${run.ms.heights.toFixed(1)}/${run.ms.layout.toFixed(1)}`} data-landscape-worker={client?.inWorker === true ? '1' : '0'}>
      {/* 2026-11-03 — es wird neu gerechnet: das Bild bleibt stehen, nur ein kleines Zeichen sagt es. */}
      {(busy || fresh.pending) && <p className="cg-ls-busy" role="status" data-landscape-busy="">liczenie…</p>}
      <TopBar layout={layout} focus={focus} onFocus={setFocus} nested={tree !== null} goalLabel={layout.goal === null ? null : labelOf(layout.goal.id)} nextLabel={(id) => labelOf(id)}
        onClearGoal={() => setGoal(null)} onShowGoal={() => { if (layout.goal !== null) showField(layout.goal.id); }} />
      {query.trim() !== '' && (
        <SearchHits query={query} ids={input.ids} bandOf={bandOf} heightOf={heightOf} label={labelOf} goal={goal}
          onShow={(id) => showField(id)} onGoal={(id) => { setGoal(id); setSaid(`Cel: ${labelOf(id)}`); }} />
      )}
      {layout.notes.map((n) => <p key={n} className="cg-muted cg-ls-note">{n}</p>)}
      {goalDone !== null && <p className="wk-note" role="status" data-landscape-goal-done={goalDone}>{W.goalDone(labelOf(goalDone))} <button type="button" className="cg-ls-qclose" aria-label={W.close} onClick={() => setGoalDone(null)}>×</button></p>}
      <div className="cg-ls-body">
      <div className="cg-ls-main">
      <LandscapeMap layout={layout} ids={input.ids} chosen={chosen} onChoose={(f) => setChosen(f.key)} onClose={() => setChosen(null)}
        panel={wide ? sideEl : null} goalRoute={goal !== null && goalSteps.length > 0 ? goalSteps.filter((x) => bandOf(x) !== 'known' && bandOf(x) !== 'due') : null}
        compact={compact} width={mapWidth} client={client}
        onZoom={(value) => setFocus([value])}
        quest={(f, paths) => (
          <Quest field={f} goal={goal} canLearn={learner !== null} note={note} label={labelOf} lockCount={lockCount} lockNames={lockNames} paths={paths} unitSize={unitSize} onUnit={(id) => keep.setUnit(id)}
            story={(() => { const flow = f.kind === 'entry' ? storyUnit(f.id!) : f.value !== undefined ? storyUnit(f.value) : undefined; return flow === undefined ? null : { stage: stageOf(flow), open: (review: boolean) => openStory(flow, review) }; })()}
            onGroupReview={() => reviewGroup(f)} onGroupGoal={() => goalOfGroup(f)}
            onLearn={(id) => learnEntry(id)} onReview={(id, band) => learnEntry(id, band !== 'known')}
            onReviewFirst={(id) => { const flow = storyUnit(id); reviewFirst(id, flow === undefined ? undefined : () => openStory(flow, false)); }}
            onGoal={(id, on) => { setGoal(on ? id : null); setSaid(on ? W.goalSet(labelOf(id)) : W.goalCleared); }}
            onZoom={() => zoom(f)} canZoom={opens(f)} {...(onOpen === undefined ? {} : { onOpen })} />
        )} />
      <Legend goal={goal !== null} ghost />
      </div>
      {wide && (
        <aside className="cg-ls-side" aria-label={W.goal} data-landscape-side="">
          {chosen === null && <p className="cg-muted cg-ls-side-hint">{W.chooseField}</p>}
          <div ref={setSideEl} className="cg-ls-side-pick" />
          {goalList}
          {readyList}
        </aside>
      )}
      </div>
      {!wide && goalList}
      {!wide && readyList}
      {more}
      <p className="cg-sr" aria-live="polite">{said}</p>
      {!compact && <FieldList layout={layout} onChoose={(f) => showField(f.key)} />}
    </div>
  );
}

/* -- Oben: wo man ist, die Bereiche, das Ziel --------------------------------------------------------------------- */

function TopBar({ layout, focus, onFocus, nested = false, goalLabel, nextLabel, onClearGoal, onShowGoal }: {
  layout: LsLayout;
  /** 2026-11-03 — verschachtelt: die Bereiche sind Knoten (ein Klick tritt ein), nichts zum Verbinden. */
  nested?: boolean;
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
      <nav className="cg-ls-crumbs" aria-label={W.whereAmI}>
        <button type="button" className="wk-link-btn" disabled={layout.path.length === 0 && focus.length === 0} onClick={() => onFocus([])} data-landscape-up="">{W.whole}</button>
        {layout.path.map((p, i) => (
          <span key={p.value} className="cg-ls-crumb">
            <span aria-hidden>›</span>
            {i === layout.path.length - 1 ? <strong>{p.label}</strong> : <button type="button" className="wk-link-btn" onClick={() => onFocus([p.value])}>{p.label}</button>}
          </span>
        ))}
      </nav>
      <p className="cg-ls-sum" data-landscape-counts={`${c.known}/${c.due}/${c.ring}/${c.mountain}`}>
        <span>{W.ready} <strong>{c.ring}</strong></span>
        <span>{W.due} <strong>{c.due}</strong></span>
        <span>{W.known} <strong>{c.known}</strong></span>
        <span>{W.behind} <strong>{c.mountain}</strong></span>
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
              {!nested && s.value !== '' && !s.value.startsWith('#') && (
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
          <span>{W.goal}: <strong>{goalLabel}</strong> — {layout.goal.steps === 0 ? (layout.goal.open ? W.goalNow : W.goalReached) : W.goalMissing(layout.goal.steps)}
            {layout.goal.next.length > 0 && layout.goal.steps > 0 && <> · {W.nextStep}: <strong>{nextLabel(layout.goal.next[0])}</strong></>}</span>
          <button type="button" className="wk-link-btn" onClick={onShowGoal}>{W.show}</button>
          <button type="button" className="wk-link-btn" onClick={onClearGoal} data-landscape-goal-clear="">{W.clearGoal}</button>
        </p>
      )}
    </div>
  );
}

/* -- Das Bild ---------------------------------------------------------------------------------------------------- */

/** Die Kante eines Gebiets: die Seiten seiner Zellen, an denen eine fremde liegt — auf ihren Flächen. */
function outlineOf(layout: LsLayout, geo: Geo, cells: readonly number[], rot = 0): string {
  const inside = new Set(cells.map((i) => `${layout.land[i].q},${layout.land[i].r}`));
  const parts: string[] = [];
  for (const i of cells) {
    const c = layout.land[i];
    const [cx, cy] = screenOf(geo, c.x, c.y, c.lift);
    for (let k = 0; k < 6; k += 1) {
      const [dq, dr] = EDGE_NB[k];
      if (inside.has(`${c.q + dq},${c.r + dr}`)) continue;
      parts.push(sideOf(geo, cx, cy, (k + rot) % 6));
    }
  }
  return parts.join('');
}

/** Die Nachbarn je Seite (flache Oberseite): Ecke k → k+1 liegt gegenüber dem Nachbarn in dieser Richtung. */
const EDGE_NB: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
const sideOf = (geo: Geo, cx: number, cy: number, k: number): string => {
  const a = CORNERS[k];
  const b = CORNERS[(k + 1) % 6];
  return `M${(cx + a[0] * geo.u).toFixed(1)},${(cy - a[1] * geo.u * LS_FORE).toFixed(1)}L${(cx + b[0] * geo.u).toFixed(1)},${(cy - b[1] * geo.u * LS_FORE).toFixed(1)}`;
};

/** Wie weit eine Zelle steht (für die Schattierung der Berge: Stufe 1–5). */
const shade = (c: LsLand): number => (c.band === 'mountain' ? Math.min(5, 1 + Math.floor(Math.log2(1 + c.steps))) : 0);

/** 2026-11-03 — wie viel eines Knotens sitzt, in fünf Stufen (die Farbe einer Gruppe, die noch nicht im Tal liegt). */
const shareStep = (c: LsLand): number => (c.group === true && c.band !== 'known' && c.band !== 'due' ? Math.min(4, Math.floor((c.share ?? 0) * 5)) : 0);

/** Wie breit das Fenster ist (die Karte eines Feldes wird darunter zum Blatt am unteren Rand). */
const viewportWidth = (fallback: number): number => (typeof window === 'undefined' ? fallback : window.innerWidth);
const SHEET_BELOW = 640;

type QuestTools = { readonly route: readonly (readonly string[])[] | null; readonly onHover: (id: string | null) => void; readonly close: () => void };

/** 2026-11-03 — DAS ZEICHEN „DO POWTÓRKI": ein Pfeil im Kreis (zu wiederholen), Mitte (cx, cy), Halbmesser r. */
function repeatPath(cx: number, cy: number, r: number): string {
  const at = (deg: number) => [cx + Math.cos((deg * Math.PI) / 180) * r, cy - Math.sin((deg * Math.PI) / 180) * r] as const;
  const [x0, y0] = at(60);
  const [x1, y1] = at(330);
  const h = r * 0.75;
  return `M${x0.toFixed(1)},${y0.toFixed(1)}A${r.toFixed(1)},${r.toFixed(1)} 0 1 0 ${x1.toFixed(1)},${y1.toFixed(1)}`
    + `M${(x0 - h * 0.15).toFixed(1)},${(y0 - h).toFixed(1)}L${x0.toFixed(1)},${y0.toFixed(1)}L${(x0 - h).toFixed(1)},${(y0 + h * 0.15).toFixed(1)}`;
}

/**
 * 2026-11-04 — „ERST WIEDERHOLEN, DANN WEITER" statt eines Schlosses (ein Schloss sagt „verboten"; das Feld wartet nur auf
 * eine Powtórka): der Pfeil im Kreis — wiederholen — mit einem Pfeil nach oben in der Mitte — dann weiter. Das Zeichen
 * „do powtórki" ist der Pfeil im Kreis allein. Mitte (0, 0), Halbmesser r.
 */
const firstPath = (r: number): string => `${repeatPath(0, 0, r)}M0,${(r * 0.5).toFixed(1)}V${(-r * 0.5).toFixed(1)}M${(-r * 0.32).toFixed(1)},${(-r * 0.18).toFixed(1)}L0,${(-r * 0.5).toFixed(1)}L${(r * 0.32).toFixed(1)},${(-r * 0.18).toFixed(1)}`;

/** 2026-11-04 — die Karte um k·60° gedreht (um den Lernenden): dieselben Zellen, ein anderer Blickwinkel. */
function turned(layout: LsLayout, k: number): LsLayout {
  if (k % 6 === 0) return layout;
  const a = (k * Math.PI) / 3;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const rot = <T extends { readonly x: number; readonly y: number }>(o: T): T => ({ ...o, x: o.x * ca - o.y * sa, y: o.x * sa + o.y * ca });
  const c = layout.camera;
  const corners = [[c.x0, c.y0], [c.x1, c.y0], [c.x0, c.y1], [c.x1, c.y1]].map(([x, y]) => rot({ x, y }));
  return {
    ...layout, land: layout.land.map(rot), fields: layout.fields.map(rot),
    camera: { x0: Math.min(...corners.map((p) => p.x), -1), x1: Math.max(...corners.map((p) => p.x), 1), y0: Math.min(...corners.map((p) => p.y), -0.6), y1: Math.max(...corners.map((p) => p.y), 1) }
  };
}

/**
 * 2026-11-03 — DIE LEGENDE, immer zu sehen: Farbe, Höhe und die zwei Zeichen, je eine Zeile — mehr steht auf der Karte nicht.
 */
function Legend({ goal, ghost }: { goal: boolean; ghost: boolean }) {
  return (
    <ul className="cg-ls-legend" data-landscape-legend="">
      <li><span className="cg-ls-legend-tones" aria-hidden><i /><i /><i /><i /></span>{W.legendColour}</li>
      <li data-landscape-legend-height=""><svg className="cg-ls-legend-icon" viewBox="-12 -8 24 16" aria-hidden><path d="M-11,6 L-5,6 L-5,2 L1,2 L1,-2 L7,-2 L7,-6 L11,-6" /></svg>{W.legendHeight}</li>
      <li data-landscape-legend-mark="repeat"><svg className="cg-ls-legend-icon is-mark" viewBox="-8 -8 16 16" aria-hidden><path className="cg-ls-mark" d={repeatPath(0, 0, 5)} /></svg>{W.legendDue}</li>
      <li data-landscape-legend-mark="first"><svg className="cg-ls-legend-icon is-mark" viewBox="-8 -8 16 16" aria-hidden><path className="cg-ls-mark" d={firstPath(5.5)} /></svg>{W.legendFirst}</li>
      {goal && <li data-landscape-legend-mark="goal"><svg className="cg-ls-legend-icon" viewBox="-12 -8 24 16" aria-hidden><path className="cg-ls-goalline" d="M-10,5 L-2,-1 L6,3 L10,-5" /><circle className="cg-ls-goalstep" cx={-2} cy={-1} r={2.4} /></svg>{W.legendGoal}</li>}
      {ghost && <li data-landscape-legend-mark="ghost"><svg className="cg-ls-legend-icon" viewBox="-12 -8 24 16" aria-hidden><polygon className="cg-ls-ghost" points="-8,0 -4,-5 4,-5 8,0 4,5 -4,5" /></svg>{W.legendSeeThrough}</li>}
    </ul>
  );
}

/** Der Name eines gezeigten Feldes (kein Text auf der Karte: nur hier und in seiner Karte) — gesetzt über eine Referenz. */
function HoverTip({ x, y, text }: { x: number; y: number; text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
  }, [x, y]);
  return <div ref={ref} className="cg-ls-tip" role="tooltip" data-landscape-tip="">{text}</div>;
}

function LandscapeMap({ layout: flatLayout, ids, chosen, onChoose, onClose, compact, width, client, onZoom, quest, panel = null, goalRoute = null }: {
  layout: LsLayout;
  /** 2026-11-04 — wohin die Einzelheiten des gewählten Feldes kommen (die Seitenleiste); `null`: das Blatt am unteren Rand. */
  panel?: HTMLElement | null;
  /** 2026-11-04 — der Weg zum Ziel (seine Schritte in der Reihenfolge des Lernens), als EINE Linie gezeichnet. */
  goalRoute?: readonly string[] | null;
  ids: readonly string[];
  chosen: string | null;
  onChoose: (f: LsField) => void;
  onClose: () => void;
  compact: boolean;
  width: number;
  client: LandscapeClient | null;
  onZoom: (value: string) => void;
  quest: (f: LsField, tools: QuestTools) => ReactNode;
}) {
  /* 2026-11-04 — die Karte in 60°-Schritten drehen (ein anderer Blick, wenn hohe Säulen etwas verdecken). */
  const [rot, setRot] = useState(0);
  const layout = useMemo(() => turned(flatLayout, rot), [flatLayout, rot]);
  const room = typeof window === 'undefined' ? 640 : Math.round(window.innerHeight * (compact ? 0.45 : 0.72));
  const geo = useMemo(() => geometryOf(layout, width, compact, room), [layout, width, compact, room]);
  const svg = useRef<SVGSVGElement>(null);
  const byKey = useMemo(() => new Map(layout.fields.map((f) => [f.key, f] as const)), [layout]);
  const indexOf = useMemo(() => new Map(ids.map((id, i) => [id, i] as const)), [ids]);
  const motion = useMemo(() => !still(), []);
  const zoomed = layout.path.length > 0;
  /*
    ZEIGEN UND WÄHLEN: Zeigen (Maus, Tastatur) hebt das Feld hervor und zeigt seine Verbindungen — nichts wird blasser;
    seine Karte öffnet erst die Wahl (Klick, Tippen, Enter, die Adresse). Was eine Liste in der Karte zeigt (`peek`), zeigt
    seine Wege.
  */
  const [hover, setHover] = useState<string | null>(null);
  const [peek, setPeek] = useState<string | null>(null);
  const timers = useRef<{ open: number | null; close: number | null }>({ open: null, close: null });
  const clear = () => { for (const k of ['open', 'close'] as const) if (timers.current[k] !== null) { window.clearTimeout(timers.current[k]!); timers.current[k] = null; } };
  useEffect(() => clear, []);
  const picked = chosen !== null ? byKey.get(chosen) : undefined;
  const hovered = hover !== null ? byKey.get(hover) : undefined;
  const focusField = hovered ?? picked;
  /* Der Weg eines gewählten Berges (hervorgehoben auf der Karte, die Liste in seiner Karte). */
  const [route, setRoute] = useState<{ readonly id: string; readonly steps: readonly (readonly string[])[] } | null>(null);
  useEffect(() => {
    let alive = true;
    if (picked === undefined || picked.kind !== 'entry' || picked.band !== 'mountain' || client === null) { setRoute(null); return undefined; }
    const id = picked.id!;
    void client.route(id).then((r) => { if (alive && r !== null) setRoute({ id, steps: r.steps }); }, () => undefined);
    return () => { alive = false; };
  }, [picked?.key, picked?.band, client]); // eslint-disable-line react-hooks/exhaustive-deps
  /* 2026-11-04 — der Weg eines Berges ist jetzt eine geordnete Linie (`lineIds`), nicht mehr der Graph auf dem Raster. */
  const routeOn = false as boolean;
  /*
    2026-11-04 — DER WEG ALS EINE LINIE: die Schritte in der Reihenfolge des Lernens (Voraussetzungen zuerst), innerhalb einer
    Stufe der nächste zum vorigen zuerst — so läuft die Linie ohne unnötige Kreuzungen durch die nummerierten Schritte. Für
    das Ziel immer, für einen gewählten Berg (Vorschau seines Weges) solange er gewählt ist.
  */
  const lineIds = useMemo((): string[] | null => {
    const levels: (readonly string[])[] | null = route !== null && picked !== undefined && route.id === picked.id ? [...route.steps, [route.id]]
      : goalRoute !== null && goalRoute.length > 0 ? goalRoute.map((id) => [id]) : null;
    if (levels === null) return null;
    const pos = (id: string) => { const v = indexOf.get(id); const i = v === undefined ? -1 : layout.cellOf[v]; return i === undefined || i < 0 ? null : layout.land[i]; };
    const out: string[] = [];
    let at: { x: number; y: number } = { x: 0, y: 0 };
    for (const level of levels) {
      const rest = level.filter((id) => pos(id) !== null);
      while (rest.length > 0) {
        let best = 0;
        let d = Number.POSITIVE_INFINITY;
        rest.forEach((id, k) => { const c = pos(id)!; const dd = (c.x - at.x) ** 2 + (c.y - at.y) ** 2; if (dd < d) { d = dd; best = k; } });
        const [id] = rest.splice(best, 1);
        out.push(id);
        at = pos(id)!;
      }
    }
    return out;
  }, [route, picked?.id, goalRoute, layout, indexOf]); // eslint-disable-line react-hooks/exhaustive-deps
  const pathTarget = peek ?? (focusField?.kind === 'entry' ? focusField.id! : null);
  const paths = useMemo(() => { const v = pathTarget === null ? undefined : indexOf.get(pathTarget); return v === undefined ? null : pathsOf(layout, v); }, [pathTarget, layout, indexOf]);
  const stepCount = route?.steps.length ?? 0;
  const routeNodes = useMemo(() => {
    const m = new Set<number>();
    if (!routeOn || route === null) return m;
    for (const step of route.steps) for (const id of step) { const v = indexOf.get(id); if (v !== undefined) m.add(v); }
    const goal = indexOf.get(route.id);
    if (goal !== undefined) m.add(goal);
    return m;
  }, [routeOn, route, indexOf]);

  /* Die Mitte einer Zelle auf dem Schirm, wie sie gezeichnet ist (die Umgebung im Zoom flach). */
  const centre = (i: number): [number, number] => { const c = layout.land[i]; return screenOf(geo, c.x, c.y, zoomed && !c.inScope ? 0 : c.lift); };
  /* DIE WEGE ALS EIN GRAPH AUF DEM RASTER (Prompt 3): jede Kante zwischen zwei Feldern einmal, über benachbarte Zellen. */
  const drawn = useMemo(() => {
    if (paths === null || (lineIds !== null && picked !== undefined && picked.band === 'mountain' && hovered === undefined)) return null;
    const cellOfNode = (v: number) => layout.cellOf[v] ?? -1;
    const nodes: ReadonlySet<number> = routeOn ? routeNodes : paths.nodes;
    const down = cellEdges(paths.down.filter(([a, b]) => !routeOn || (nodes.has(a) && nodes.has(b))).map(([a, b]) => [cellOfNode(a), cellOfNode(b)] as const));
    const up = routeOn ? [] : cellEdges(paths.up.map(([a, b]) => [cellOfNode(a), cellOfNode(b)] as const));
    const own = new Set([...nodes].map(cellOfNode).filter((i) => i >= 0));
    const cost = (i: number) => { const c = layout.land[i]; return (own.has(i) ? 1 : c.field === null ? 1.25 : 3.5) + (zoomed && !c.inScope ? 1.5 : 0) + (zoomed && !inCamera(layout, c) ? 8 : 0); };
    const all = hexRoutes(layout.land, [...down, ...up], cost);
    const downKeys = new Set<string>();
    for (const p of all.paths.slice(0, down.length)) if (p !== null) for (let i = 1; i < p.length; i += 1) downKeys.add(segmentKey(p[i - 1], p[i]));
    return {
      own,
      down: all.segments.filter(([a, b]) => downKeys.has(segmentKey(a, b))),
      up: all.segments.filter(([a, b]) => !downKeys.has(segmentKey(a, b))),
      edges: down.length + up.length
    };
  }, [paths, routeOn, routeNodes, layout, zoomed, lineIds, picked?.band, hovered]); // eslint-disable-line react-hooks/exhaustive-deps
  const segPath = (segs: readonly (readonly [number, number])[]): string => segs.map(([a, b]) => { const p = centre(a); const q = centre(b); return `M${p[0].toFixed(1)},${p[1].toFixed(1)}L${q[0].toFixed(1)},${q[1].toFixed(1)}`; }).join('');

  const me = useMemo(() => {
    const [x, y] = screenOf(geo, 0, 0, layout.me.lift);
    return { x, y };
  }, [geo, layout.me.lift]);
  const s = FACE_HALF * geo.u;

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
    if (hover === null) timers.current.open = window.setTimeout(() => setHover(f.key), 80); else setHover(f.key);
  };
  const leave = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clear();
    timers.current.close = window.setTimeout(() => setHover(null), 120);
  };
  const click = (e: { target: EventTarget | null }) => {
    const f = ownerOf(e.target);
    if (f === undefined) return;
    onChoose(f);
  };
  useEffect(() => {
    if (chosen === null) return undefined;
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { setPeek(null); onClose(); } };
    const outside = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.('.cg-ls-quest') || t?.closest?.('.cg-ls-side') || t?.closest?.('[data-ls-owner],[data-ls-field]') || t?.closest?.('.cg-ls-rotate')) return;
      setPeek(null);
      onClose();
    };
    window.addEventListener('keydown', esc);
    window.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', esc); window.removeEventListener('pointerdown', outside); };
  }, [chosen, onClose]);
  /* Eine andere Wahl: was die Liste der alten zeigte, gilt nicht mehr. */
  useEffect(() => { setPeek(null); }, [chosen]);

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
  /* Die Tastatur zeigt wie die Maus: das Feld im Fokus wird hervorgehoben und zeigt seine Verbindungen. */
  const focusIn = (e: { target: EventTarget | null }) => { const f = ownerOf(e.target); if (f !== undefined) { clear(); setHover(f.key); } };
  const focusOut = () => { clear(); setHover(null); };

  /*
    2026-11-04 — NICHTS WICHTIGES HINTER BERGEN: ein Feld, an dem der Lernende handeln kann (jetzt lernbar, zu wiederholen,
    gewählt, der nächste Schritt zum Ziel), dessen Fläche von Säulen davor verdeckt ist, zeigt seine Fläche als Umriss durch
    sie hindurch (und bleibt antippbar: die Felder liegen über dem Land). Ist es gewählt oder gezeigt, werden genau die
    Säulen davor zu Umrissen (Röntgen) — nichts sonst wird blasser.
  */
  const occlusion = useMemo(() => {
    const hidden = new Map<string, number[]>();
    const half = CORNER * geo.u;
    const faceHalf = FACE_HALF * geo.u;
    const nextIds = new Set(layout.goal?.next ?? []);
    for (const fl of layout.fields) {
      const important = fl.band === 'ring' || fl.due > 0 || fl.key === chosen || (fl.id !== undefined && nextIds.has(fl.id)) || fl.key === hover;
      if (!important) continue;
      const own = new Set(fl.cells);
      const fc = layout.land[fl.cells[0]];
      if (fc === undefined) continue;
      const [fx, fy] = screenOf(geo, fc.x, fc.y, fc.lift);
      const front: number[] = [];
      layout.land.forEach((c, j) => {
        if (own.has(j) || c.field === null || c.y >= fc.y - 1e-6) return;
        const [cx] = screenOf(geo, c.x, c.y, 0);
        if (Math.abs(cx - fx) > half * 1.6) return;
        const topY = screenOf(geo, c.x, c.y, c.lift)[1] - faceHalf;
        const bottomY = screenOf(geo, c.x, c.y, FLOOR)[1] + faceHalf;
        const overlap = Math.min(fy + faceHalf, bottomY) - Math.max(fy - faceHalf, topY);
        if (overlap > faceHalf * 0.5) front.push(j);
      });
      if (front.length > 0) hidden.set(fl.key, front);
    }
    return hidden;
  }, [layout, geo, chosen, hover]);
  const xray = new Set([...(occlusion.get(hover ?? '') ?? []), ...(occlusion.get(chosen ?? '') ?? [])]);
  /* Hervorgehoben (nie wird etwas anderes blasser): das gezeigte Feld, und ist ein Weg zu sehen, seine Felder. */
  const hoverCells = new Set(hovered?.cells ?? []);
  const routeCells = new Set(routeOn ? [...routeNodes].map((v) => layout.cellOf[v]).filter((i) => i >= 0) : []);
  /* Die Karte des gewählten Feldes: an ihm, ganz im Fenster (darüber, darunter oder daneben); im schmalen Fenster ein Blatt unten. */
  const anchor = picked === undefined ? null : screenOf(geo, picked.x, picked.y, picked.lift);
  const sheet = viewportWidth(width) < SHEET_BELOW;
  const tipAt = hovered === undefined || hovered.key === chosen ? null : screenOf(geo, hovered.x, hovered.y, hovered.lift);
  /* Die anderen Bereiche im Zoom (ohne Knoten): am Rand, in ihrer Richtung. */
  const focusAngle = layout.sectors.length === 0 ? 90 : layout.sectors.reduce((sum, x) => sum + (x.from + x.to) / 2, 0) / layout.sectors.length;
  const leftRims = layout.outside.filter((o) => o.angle < focusAngle).sort((a, b) => b.angle - a.angle);
  const rightRims = layout.outside.filter((o) => o.angle >= focusAngle).sort((a, b) => a.angle - b.angle);

  return (
    <div className={`cg-ls-map${compact ? ' is-compact' : ''}`}>
      <svg ref={svg} className="cg-ls-svg" width={geo.width} height={geo.height} viewBox={`0 0 ${Math.max(1, geo.width)} ${Math.max(1, geo.height)}`} role="group"
        aria-label="Krajobraz wiedzy: obok Ciebie dolina tego, co umiesz; równina — to, czego możesz się uczyć teraz; góry — tym wyższe, im więcej kroków brakuje. Im głębszy kolor, tym lepiej znane."
        onKeyDown={move} onPointerOver={enter} onPointerOut={leave} onClick={click} onFocus={focusIn} onBlur={focusOut} data-landscape-svg="">
        {/* Das Land: jede Zelle ein Eintrag oder ein Knoten (keine leeren Zellen), von hinten nach vorn; die Höhe ist der Stand. */}
        <g className="cg-ls-land">
          {layout.land.map((c, i) => [c, i] as const).sort((a, b) => b[0].y - a[0].y || a[0].x - b[0].x).map(([c, i]) => {
            if (c.field === null || (zoomed && !inCamera(layout, c))) return null;
            const flat = zoomed && !c.inScope;
            const shape = prism(geo, c.x, c.y, c.lift, flat);
            const subject = c.subject >= 0 && c.subject < 8 ? c.subject : 'x';
            const k = shareStep(c);
            return (
              <g key={`${c.q},${c.r}`} className={`cg-ls-cell is-${c.band ?? 'mountain'} is-s${subject} is-h${shade(c)}${c.group === true ? ' is-group' : ''}${k > 0 ? ` is-k${k}` : ''}${c.inScope ? '' : ' is-out'}${hoverCells.has(i) ? ' is-hover' : ''}${routeCells.has(i) ? ' is-route' : ''}${xray.has(i) ? ' is-xray' : ''}${motion ? '' : ' is-still'}`}
                data-ls-cell={`${c.q},${c.r}`} data-ls-ci={i} data-ls-owner={c.field} data-ls-lift={Number(c.lift.toFixed(3))}>
                {shape.sides.map((side, j) => <polygon key={j} className={`cg-ls-side is-${['l', 'f', 'r'][j]}`} points={side} />)}
                <polygon className="cg-ls-face" points={shape.top} />
              </g>
            );
          })}
        </g>
        {/* Das gewählte Feld: seine Kante deutlich, über allem; das gezeigte etwas leiser. */}
        {/* Verdeckte wichtige Felder: ihre Fläche als Umriss durch die Säulen davor. */}
        <g className="cg-ls-ghosts" aria-hidden data-ls-hidden={occlusion.size}>
          {[...occlusion.keys()].map((key) => { const fl = byKey.get(key); if (fl === undefined) return null; const c = layout.land[fl.cells[0]]; return <polygon key={key} className="cg-ls-ghost" points={prism(geo, c.x, c.y, c.lift).top} data-ls-ghost={key} />; })}
        </g>
        {hovered !== undefined && hovered.key !== chosen && <path className="cg-ls-outline is-hover" aria-hidden d={outlineOf(layout, geo, hovered.cells, rot)} />}
        {picked !== undefined && <path className="cg-ls-outline is-on" aria-hidden d={outlineOf(layout, geo, picked.cells, rot)} data-ls-chosen-outline={picked.key} />}
        {/* Der Weg zum Ziel (oder des gewählten Berges): eine Linie durch die Schritte, der nächste hervorgehoben. */}
        {lineIds !== null && lineIds.length > 0 && (() => {
          const pts2 = lineIds.map((id) => { const v = indexOf.get(id); const i = v === undefined ? -1 : layout.cellOf[v]; return i >= 0 ? centre(i) : null; }).filter((p): p is [number, number] => p !== null);
          const nextSet = new Set(layout.goal?.next ?? []);
          return (
            <g className="cg-ls-goalroute" aria-hidden data-ls-goal-line={lineIds.length}>
              <path className="cg-ls-goalline" d={`M${pts2.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L')}`} />
              {lineIds.map((id, k) => { const p = pts2[k]; if (p === undefined) return null; const isNext = nextSet.has(id); return <circle key={id} className={`cg-ls-goalstep${isNext ? ' is-next' : ''}`} cx={p[0]} cy={p[1]} r={isNext ? 5 : 3} data-ls-goal-step={k + 1} />; })}
            </g>
          );
        })()}
        {/* Die Wege (C): EIN Graph — hinab bis zum Ring und ins Tal (ein Berg: sein Weg), und wohin es führt. */}
        {drawn !== null && (
          <g className="cg-ls-paths" aria-hidden data-ls-paths={drawn.edges} data-ls-segs={drawn.down.length + drawn.up.length}
            data-ls-seg-keys={[...drawn.down, ...drawn.up].map(([a, b]) => `${a}:${b}`).join('|')} data-ls-route={routeOn ? stepCount : 0}>
            {drawn.up.length > 0 && <path className="cg-ls-lead" d={segPath(drawn.up)} />}
            {drawn.down.length > 0 && <path className="cg-ls-path" d={segPath(drawn.down)} />}
          </g>
        )}
        {/*
          Die Felder: das Ziel für Klick, Tastatur und Vorleser — und nur zwei Zeichen, beide „hier handeln": der Pfeil im
          Kreis (do powtórki) und das Schloss (najpierw powtórz). Ein Knoten trägt dazu seinen Ring (gewusste / alle Karten).
        */}
        <g className="cg-ls-marks">
          {[...layout.fields].sort((a, b) => b.y - a.y || a.x - b.x).map((f) => {
            const [x, y] = screenOf(geo, f.x, f.y, f.lift);
            const ring = f.kind === 'area' && f.progress !== undefined && f.progress.total > 0;
            const r = Math.max(4, s * 0.92);
            const share = ring ? f.progress!.known / f.progress!.total : 0;
            const c = CORNER * geo.u;
            return (
              <g key={f.key} className={`cg-ls-field is-${f.band}${f.kind === 'area' ? ' is-area' : ''}${chosen === f.key ? ' is-on' : ''}${f.locked ? ' is-locked' : ''}${layout.land[f.cells[0]]?.inScope === false ? ' is-out' : ''}`}
                transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`} data-ls-field={f.key} data-ls-band={f.band} data-ls-q={f.q} data-ls-r={f.r} data-ls-row={f.row} data-ls-area={f.area}
                data-ls-height={Number.isFinite(f.height) ? Number(f.height.toFixed(3)) : ''} data-ls-lift={Number(f.lift.toFixed(3))} data-ls-count={f.count}
                data-ls-due={f.due > 0 ? '1' : '0'} {...(ring ? { 'data-ls-progress': `${f.progress!.known}/${f.progress!.total}` } : {})}
                tabIndex={0} role="button" aria-pressed={chosen === f.key} aria-label={fieldWords(f)}>
                <polygon className="cg-ls-hit" points={pts(CORNERS.map(([cx, cy]) => [cx * geo.u, -cy * geo.u * LS_FORE] as [number, number]))} />
                {ring && (
                  <g className="cg-ls-progress">
                    <circle className="cg-ls-progress-bg" r={r} />
                    <circle className="cg-ls-progress-on" r={r} strokeDasharray={`${(2 * Math.PI * r * share).toFixed(1)} ${(2 * Math.PI * r).toFixed(1)}`} transform="rotate(-90)" />
                  </g>
                )}
                {/* 2026-11-04 — die Zeichen: in der Mitte der Fläche, alle gleich (ein schwarzer Umriss auf der Farbe des Feldes). */}
                {f.locked && <path className="cg-ls-mark" d={firstPath(Math.max(3, s * 0.55))} data-ls-marker="first" />}
                {f.due > 0 && !f.locked && <path className="cg-ls-mark" d={repeatPath(0, 0, Math.max(3, s * 0.55))} data-ls-marker="repeat" />}
                {lineIds !== null && f.id !== undefined && chosen === f.key && lineIds.includes(f.id) && (
                  <g className="cg-ls-stepno" data-ls-step-number={lineIds.indexOf(f.id) + 1}><circle cx={c * 0.9} cy={-s * 1.1} r={Math.max(7, s * 0.5)} /><text x={c * 0.9} y={-s * 1.1 + 3.5} textAnchor="middle">{lineIds.indexOf(f.id) + 1}</text></g>
                )}
              </g>
            );
          })}
        </g>
        <g className="cg-ls-me" aria-hidden data-ls-me="" data-ls-lift={Number(layout.me.lift.toFixed(3))}>
          {(() => { const shape = prism(geo, 0, 0, layout.me.lift); return <polygon className="cg-ls-me-face" points={shape.top} />; })()}
          <circle cx={me.x} cy={me.y - s * 0.38} r={s * 0.3} />
          <path d={`M${(me.x - s * 0.62).toFixed(1)},${(me.y + s * 0.62).toFixed(1)} Q${me.x.toFixed(1)},${(me.y - s * 0.25).toFixed(1)} ${(me.x + s * 0.62).toFixed(1)},${(me.y + s * 0.62).toFixed(1)} Z`} />
        </g>
      </svg>
      {leftRims.length > 0 && <div className="cg-ls-rims is-left">{leftRims.map((o) => <Rim key={o.value} rim={o} side="left" onZoom={onZoom} />)}</div>}
      {rightRims.length > 0 && <div className="cg-ls-rims is-right">{rightRims.map((o) => <Rim key={o.value} rim={o} side="right" onZoom={onZoom} />)}</div>}
      <button type="button" className="cg-ls-rotate" onClick={() => setRot((r) => (r + 1) % 6)} aria-label={W.rotate} title={W.rotate} data-landscape-rotate={rot}>⟳ 60°</button>
      {tipAt !== null && hovered !== undefined && <HoverTip x={tipAt[0]} y={tipAt[1] - s - 6} text={`${hovered.label}${lineIds !== null && hovered.id !== undefined && lineIds.includes(hovered.id) ? ` · ${lineIds.indexOf(hovered.id) + 1}/${lineIds.length}` : ''}`} />}
      {picked !== undefined && panel !== null && createPortal(
        <div className="cg-ls-quest is-side" role="region" aria-label={picked.label} data-landscape-quest={picked.key}>{quest(picked, { route: route !== null && route.id === picked.id ? route.steps : null, onHover: setPeek, close: onClose })}</div>,
        panel
      )}
      {picked !== undefined && anchor !== null && panel === null && (
        <QuestBox svg={svg} geoWidth={geo.width} geoHeight={geo.height} at={{ x: anchor[0], y: anchor[1], half: s + 4, halfW: CORNER * geo.u + 4 }} sheet={sheet || true} label={picked.label} questKey={picked.key}
          avoid={[...routeCells].map(centre)} avoidLine={drawn === null ? [] : [...drawn.down, ...drawn.up].flatMap(([a, b]) => { const p = centre(a); const q = centre(b); return [p, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as [number, number]]; })}>
          {quest(picked, { route: route !== null && route.id === picked.id ? route.steps : null, onHover: setPeek, close: onClose })}
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

/**
 * DIE KARTE EINES FELDES (D; 2026-11-03, Prompt 3): oben, was immer zu sehen bleibt — Name, Fortschritt, Stand, der Knopf;
 * darunter, was rollt — was darin liegt, der ganze Weg (jeder Schritt, das Ziel zuletzt), was danach kommt.
 */
function Quest({ field: f, goal, canLearn, note, label, lockCount, lockNames = () => [], paths, onLearn, onReview, onReviewFirst, onGoal, onZoom, canZoom, onOpen, unitSize, onUnit, story = null, onGroupReview, onGroupGoal }: {
  field: LsField;
  /** 2026-11-03 — eine Gruppe (Knoten): was darin zu wiederholen ist, und das Nächste darin als Ziel. */
  onGroupReview?: () => void;
  onGroupGoal?: () => void;
  /** 2026-11-03 (Prompt 5) — die Einheit ist eine Erzählung: wo der Lernende in ihr steht, und sie öffnen (am Przegląd oder an seiner Stelle). */
  story?: { readonly stage: StoryStage; readonly open: (review: boolean) => void } | null;
  /** 2026-11-03 (F) — wie viele Teile eine Einheit hat; öffnen zeigt ihre Ścieżka gross. */
  unitSize: (id: string) => number;
  onUnit: (id: string) => void;
  goal: string | null;
  canLearn: boolean;
  note: string | null;
  label: (id: string) => string;
  lockCount: (id: string) => number;
  /** 2026-11-04 — was vor diesem Feld erst wiederholt werden muss (die Einträge mit schwachen Karten), beim Namen. */
  lockNames?: (id: string) => readonly string[];
  paths: QuestTools;
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
  const head = (title: ReactNode, rest: ReactNode) => (
    <div className="cg-ls-qhead" data-landscape-quest-head="">
      <div className="cg-ls-qtop">
        <p className="cg-ls-qtitle">{title}</p>
        <button type="button" className="cg-ls-qclose" aria-label={W.close} onClick={paths.close} data-landscape-quest-close="">×</button>
      </div>
      {rest}
    </div>
  );
  if (f.kind === 'area') {
    const inside = f.ids ?? [];
    return (
      <div className="cg-ls-q">
        {head(<><strong>{f.label}</strong> <span className="cg-muted">· {f.count}</span></>, (
          <>
            <div className="cg-ls-qrow">
              {f.progress !== undefined && <ProgressRing known={f.progress.known} total={f.progress.total} />}
              <p className="cg-ls-qstate">
                {f.ring > 0 && <span>{f.ring} {W.ready}</span>}
                {f.due > 0 && <span>{f.due} {W.due}</span>}
                {f.known > 0 && <span>{f.known} {W.known}</span>}
                {f.mountain > 0 && <span>{f.mountain} {W.behind}</span>}
              </p>
            </div>
            <p className="cg-muted" data-landscape-group-state={f.band}>{groupWords(f)}</p>
            {(() => {
              /* EIN Knopf: eine Erzählung — ihr Knopf; ein Berg — das Nächste darin als Ziel; im Tal mit Fälligem — Powtórz; sonst Wejdź. */
              const enter = canZoom ? <button type="button" className="wk-btn" onClick={onZoom} data-landscape-zoom="">{W.enter}</button> : null;
              const enterLink = canZoom ? <button type="button" className="wk-link-btn" onClick={onZoom} data-landscape-zoom="">{W.enter}</button> : null;
              const primary = canLearn && story !== null
                ? <button type="button" className="wk-btn" onClick={() => story.open(story.stage === 'review')} data-landscape-story={story.stage}>{STORY_BUTTON[story.stage]}</button>
                : f.band === 'mountain' && onGroupGoal !== undefined
                  ? <button type="button" className="wk-btn" onClick={onGroupGoal} data-landscape-set-goal="">{W.setGoal}</button>
                  : canLearn && f.due > 0 && (f.band === 'due' || f.band === 'known') && onGroupReview !== undefined
                    ? <button type="button" className="wk-btn" onClick={onGroupReview} data-landscape-review="">{W.review}</button>
                    : null;
              return <div className="wk-actions">{primary ?? enter}{primary !== null && enterLink}</div>;
            })()}
            {note !== null && <p className="wk-note" role="status">{note}</p>}
          </>
        ))}
        {inside.length > 0 && (
          <div className="cg-ls-qbody">
            <p className="cg-ls-qh">{W.inside(inside.length)}</p>
            <ul className="cg-ls-qlist is-scroll" data-landscape-inside={inside.length}>{inside.map(item)}</ul>
          </div>
        )}
      </div>
    );
  }
  const id = f.id!;
  const locks = f.locked ? lockCount(id) : 0;
  const parts = unitSize(id);
  const way = f.band === 'mountain' && paths.route !== null && paths.route.length > 0 ? paths.route : null;
  const unlocks = f.unlocks ?? [];
  return (
    <div className="cg-ls-q">
      {head(<strong><TexText text={entityNameTex(lib, id)} /></strong>, (
        <>
          <div className="cg-ls-qrow">
            {f.progress !== undefined && <ProgressRing known={f.progress.known} total={f.progress.total} />}
            <p className="cg-ls-qstate" data-landscape-state={f.band}>{story !== null && story.stage === 'review' ? `Opowieść ${STORY_WORDS.review}` : stateWords(f)}{f.band === 'mountain' && (f.topics ?? 0) > f.missing ? <span className="cg-muted"> · {W.topics(f.topics ?? 0)}</span> : null}</p>
          </div>
          {story !== null && <p className="cg-muted" data-landscape-story-stage={story.stage}>{story.stage === 'review' ? 'Wróć do przeglądu na końcu opowieści — pole opadnie, gdy go zdasz.' : STORY_WORDS[story.stage] === '' ? 'Opowieść' : `Opowieść — ${STORY_WORDS[story.stage]}`}</p>}
          <div className="wk-actions">
            {canLearn && story !== null && f.band !== 'mountain' && !(f.band === 'ring' && f.locked) && <button type="button" className="wk-btn" onClick={() => story.open(story.stage === 'review')} data-landscape-story={story.stage}>{STORY_BUTTON[story.stage]}</button>}
            {canLearn && story === null && f.band === 'ring' && !f.locked && <button type="button" className="wk-btn" onClick={() => onLearn(id)} data-landscape-learn="">{W.start}</button>}
            {canLearn && f.band === 'ring' && f.locked && <button type="button" className="wk-btn" onClick={() => onReviewFirst(id)} data-landscape-review-first="">{W.reviewFirst(locks)}</button>}
            {canLearn && story === null && (f.band === 'due' || f.band === 'known') && <button type="button" className={f.band === 'due' ? 'wk-btn' : 'wk-btn wk-btn-line'} onClick={() => onReview(id, f.band)} data-landscape-review="">{W.review}</button>}
            {f.band === 'mountain' && <button type="button" className="wk-btn" onClick={() => onGoal(id, goal !== id)} data-landscape-set-goal="">{goal === id ? W.clearGoal : W.setGoal}</button>}
            {canLearn && story !== null && f.band === 'mountain' && <button type="button" className="wk-link-btn" onClick={() => story.open(false)} data-landscape-story="locked">Otwórz opowieść</button>}
            {onOpen !== undefined && <button type="button" className="wk-link-btn cg-ls-qopen" onClick={() => onOpen(id)} data-landscape-open="">{W.openEntry}</button>}
            {parts > 1 && <button type="button" className="wk-link-btn" onClick={() => onUnit(id)} data-landscape-unit={id}>{W.showPath(parts)}</button>}
          </div>
          {!canLearn && f.band !== 'mountain' && <p className="cg-muted">{W.canLearnNote}</p>}
          {f.locked && lockNames(id).length > 0 && (
            <div data-landscape-review-first-list="">
              <p className="cg-ls-qh">{W.reviewFirstWhat}</p>
              <ul className="cg-ls-qlist is-scroll">{lockNames(id).map(item)}</ul>
            </div>
          )}
          {note !== null && <p className="wk-note" role="status">{note}</p>}
        </>
      ))}
      {(way !== null || unlocks.length > 0) && (
        <div className="cg-ls-qbody">
          {way !== null && (
            <div className="cg-ls-route" data-landscape-route={way.length}>
              <p className="cg-ls-qh">{W.goalRoute} ({steps(way.length)})</p>
              <ol className="cg-ls-qlist is-scroll">
                {way.map((step, i) => <li key={i} data-landscape-route-step={i + 1}>{step.map((x, j) => <span key={x}>{j > 0 ? ' + ' : ''}<TexText text={entityNameTex(lib, x)} /></span>)}</li>)}
                <li className="cg-ls-qgoal" data-landscape-route-step={way.length + 1}><strong><TexText text={entityNameTex(lib, id)} /></strong> — {W.goal}</li>
              </ol>
            </div>
          )}
          {unlocks.length > 0 && (
            <>
              <p className="cg-ls-qh">{W.unlocks}</p>
              <ul className="cg-ls-qlist is-scroll" data-landscape-unlocks={unlocks.length}>{unlocks.map(item)}</ul>
            </>
          )}
        </div>
      )}
      {f.band === 'mountain' && f.unlocks === undefined && label(id) === '' && null}
    </div>
  );
}

/** Dieselben Felder als Liste — für Vorleser, und für wer lieber liest als schaut. */
function FieldList({ layout, onChoose }: { layout: LsLayout; onChoose: (f: LsField) => void }) {
  const groups: { band: LsBand; title: string }[] = [
    { band: 'ring', title: W.listBands[0] }, { band: 'due', title: W.listBands[1] },
    { band: 'mountain', title: W.listBands[2] }, { band: 'known', title: W.listBands[3] }
  ];
  return (
    <details className="cg-ls-list" data-landscape-list="">
      <summary>{W.asList(layout.fields.length)}</summary>
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

/**
 * 2026-11-03 (Prompt 3) — DIE KARTE EINES FELDES IM FENSTER: an der Seite des Dokuments (nie vom Bild des Krajobraz
 * beschnitten), fest im Fenster; darüber, wenn oben Platz ist, sonst darunter, sonst daneben — und immer ganz im
 * Fenster (8 px Rand). Rollt die Seite, geht sie mit; ist das Feld nicht mehr zu sehen, wartet sie unsichtbar. Im
 * schmalen Fenster ein Blatt am unteren Rand. Gesetzt über eine Referenz (keine Stile im JSX).
 */
function QuestBox({ svg, geoWidth, geoHeight, at, sheet, label, questKey, children, avoid = [], avoidLine = [] }: {
  svg: RefObject<SVGSVGElement>;
  geoWidth: number;
  geoHeight: number;
  /** Die Mitte des Feldes im Bild und wie weit es nach oben/unten und zur Seite reicht (Pixel des Bildes). */
  at: { readonly x: number; readonly y: number; readonly half: number; readonly halfW: number };
  /** Was die Karte möglichst nicht deckt: die Zahlen und Punkte des Weges (Pixel des Bildes). */
  avoid?: readonly (readonly [number, number])[];
  /** Punkte der Linien des Weges — weniger wichtig als die Zahlen, aber lieber frei. */
  avoidLine?: readonly (readonly [number, number])[];
  sheet: boolean;
  label: string;
  questKey: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /* Für welche Wahl die Seite schon gerollt hat (das Blatt am Telefon). */
  const lifted = useRef<string | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    let frame = 0;
    const place = () => {
      frame = 0;
      const box = svg.current?.getBoundingClientRect();
      if (sheet || box === undefined) {
        el.style.left = '';
        el.style.top = '';
        el.classList.remove('is-away');
        el.dataset.side = 'sheet';
        /*
          Am Telefon bleibt das Feld über dem Blatt zu sehen: unter der Seite so viel Platz wie das Blatt hoch ist (sonst
          liesse sich ein Feld unten nicht darüber rollen), und einmal je Wahl rollt die Seite es darüber.
        */
        if (sheet) document.body.style.setProperty('padding-bottom', `${Math.ceil(el.offsetHeight)}px`);
        if (sheet && box !== undefined && lifted.current !== questKey) {
          lifted.current = questKey;
          const fy = box.top + (at.y + at.half) * (box.height / Math.max(1, geoHeight));
          const room = window.innerHeight - el.offsetHeight - 12;
          if (fy > room) window.scrollBy({ top: fy - room, behavior: 'smooth' });
        }
        return;
      }
      const kx = box.width / Math.max(1, geoWidth);
      const ky = box.height / Math.max(1, geoHeight);
      const ax = box.left + at.x * kx;
      const ay = box.top + at.y * ky;
      const half = at.half * ky;
      const halfW = at.halfW * kx;
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const M = 8;
      const GAP = 6;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      el.classList.toggle('is-away', ay + half < 0 || ay - half > vh || ax + halfW < 0 || ax - halfW > vw);
      const clampX = (x: number) => Math.max(M, Math.min(vw - M - w, x));
      const clampY = (y: number) => Math.max(M, Math.min(vh - M - h, y));
      /*
        Darüber, darunter, rechts, links — was ganz ins Fenster passt und das Feld frei lässt; davon, was die wenigsten
        Zahlen und Punkte des Weges deckt (bei Gleichstand in dieser Reihenfolge). Passt nichts ganz: die Seite mit dem
        meisten Platz, ins Fenster gerückt.
      */
      const marks = avoid.map(([x, y]) => [box.left + x * kx, box.top + y * ky] as const);
      const line = avoidLine.map(([x, y]) => [box.left + x * kx, box.top + y * ky] as const);
      const options = [
        { side: 'above', left: clampX(ax - w / 2), top: ay - half - GAP - h },
        { side: 'below', left: clampX(ax - w / 2), top: ay + half + GAP },
        { side: 'right', left: ax + halfW + GAP, top: clampY(ay - h / 2) },
        { side: 'left', left: ax - halfW - GAP - w, top: clampY(ay - h / 2) }
      ];
      const fits = (o: { left: number; top: number }) => o.left >= M - 0.5 && o.top >= M - 0.5 && o.left + w <= vw - M + 0.5 && o.top + h <= vh - M + 0.5;
      const covers = (o: { left: number; top: number }, x: number, y: number, pad: number) => x >= o.left - pad && x <= o.left + w + pad && y >= o.top - pad && y <= o.top + h + pad;
      let best: { side: string; left: number; top: number } | null = null;
      let bestScore = Number.POSITIVE_INFINITY;
      for (const [k, o] of options.entries()) {
        if (!fits(o) || covers(o, ax, ay, 0)) continue;
        const score = marks.filter(([x, y]) => covers(o, x, y, 6)).length * 10 + line.filter(([x, y]) => covers(o, x, y, 2)).length + k * 0.1;
        if (score < bestScore) { bestScore = score; best = o; }
      }
      let left: number;
      let top: number;
      let side: string;
      if (best !== null) ({ left, top, side } = best);
      else {
        const roomRight = vw - M - (ax + halfW + GAP);
        const roomLeft = ax - halfW - GAP - M;
        side = roomRight >= w || roomRight >= roomLeft ? 'right' : 'left';
        left = side === 'right' ? Math.min(ax + halfW + GAP, vw - M - w) : Math.max(M, ax - halfW - GAP - w);
        top = clampY(ay - h / 2);
      }
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
      el.dataset.side = side;
    };
    place();
    const soon = () => { if (frame === 0) frame = window.requestAnimationFrame(place); };
    window.addEventListener('scroll', soon, true);
    window.addEventListener('resize', soon);
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(soon);
    watch?.observe(el);
    return () => {
      if (sheet) document.body.style.removeProperty('padding-bottom');
      window.removeEventListener('scroll', soon, true);
      window.removeEventListener('resize', soon);
      watch?.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- die Punkte als Text
  }, [at.x, at.y, at.half, at.halfW, sheet, geoWidth, geoHeight, svg, questKey, avoid.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join('|'), avoidLine.length]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div ref={ref} className={`cg-ls-quest${sheet ? ' is-sheet' : ''}`} role="dialog" aria-label={label} data-landscape-quest={questKey}>{children}</div>,
    document.body
  );
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
            <button type="button" className="cg-ref" onClick={() => onShow(id)} data-landscape-hit={id}><TexText text={entityNameTex(lib, id)} /></button>
            <span className="cg-muted"> {b === null ? '' : b === 'mountain' ? W.away(Math.max(1, Math.round(h))) : b === 'ring' ? W.ready : b === 'due' ? W.due : W.known}</span>
            {(b === 'ring' || b === 'mountain') && goal !== id && <button type="button" className="wk-link-btn" onClick={() => onGoal(id)} data-landscape-hit-goal={id}>{W.setGoal}</button>}
            {goal === id && <span className="cg-muted"> · {W.goal}</span>}
          </li>
        );
      })}
    </ul>
  );
}

