/**
 * 2026-11-03 — DER KRAJOBRAZ (Widok im Modus `landscape`, auf einer Seite `krajobraz`): die eigene Landschaft des
 * Wissens. Gesammelt aus der Baza in `landscapeData.ts`, gerechnet im Worker (`landscapeClient.ts`).
 *
 * 2026-11-04 (Prompt 11) — GEBIETE IN GEBIETEN:
 * <code>
 *   Welt      eine Rangordnung von Gebieten aus den Verbindungen (`regions.ts`; im verschachtelten Krajobraz die Knoten
 *             des Besitzers); jede Ebene zeigt eine Handvoll Säulen — Gebiete oder Themen, nie gemischt; ein Tippen auf
 *             ein Gebiet öffnet seine Karte, die Brotkrumen und „−" führen hinauf, Tore am Rand hinaus
 *   Öffnen    dort, wo der nächste Schritt des Lernenden liegt („Zu mir"); „Ganze Karte" zeigt die oberste Ebene
 *   Satz      über der Karte in Worten, was als Nächstes dran ist, mit zwei Knöpfen (lernen, wiederholen)
 *   Zahlen    überall dieselben zwei: Stufen (die Höhe) und Themen (die Länge der Liste, Schritt für Schritt)
 *   Weg       erst nach „Weg zeigen" oder für ein Ziel: EINE Linie in der Reihenfolge der Liste (ein langer nur die
 *             nächsten fünf und das Ziel); die Ścieżka daneben zeigt dieselben Themen
 *   Fortschritt  ein Gebiet, in dem alles gelernt ist, ist erobert (warm, Fahne, einmal gesagt); oben gezählt
 * </code>
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { Card } from './cardBasics';
import { cardKnowness, factsOf, gaugeFromMarks, withFlows, type Gauge } from './knowing';
import { learnerFlows, reviewStart, storyStage, type StoryStage } from './flowFacts';
import { BAND_CODE, liftOf, type LsBand, type LsInput, type LsStand, type LsState } from './landscape';
import { landscapeClient, type LandscapeClient } from './landscapeClient';
import { landscapeInput, landscapeState, lockCards } from './landscapeData';
import { answeredCards, holderKey, positionFor, renamer, type Learner } from './learn';
import { gaugeKnow, pathOfEntries, unitMembers } from './PathLearn';
import { readNest } from './landscapeNest';
import { cardEntities, cardsAbout, questionIds } from './prerequisites';
import { readFlow, resolveFlow, type Flow } from './flow';
import { contentOfLibrary, FlowPlayer, storyPathOf } from './FlowPlayer';
import { decideBy } from './runningStory';
import { directStartLock } from './storyLock';
import { storyMarks } from './storyPath';
import { viewPath } from '../routes';
import { PathMap } from './PathMap';
import { countsAsStep, pathMarks } from './pathLayout';
import { practiseGraph, practiseIds } from './quilt';
import { planOf, readPlan, type Plan } from './revision';
import { RevisionRun, type RunSource } from './RevisionRun';
import type { RewardRules } from './rewards';
import type { Graph } from './graph';
import { entityNameTex, useCtx } from './ui';
import { needsKnowing, readLandscape, viewList, withKnowing, type LandscapeRegionEdits, type ViewDoc } from './views';
import { TexText } from '../ui/tex/Tex';
import { baseLang, words, type Words } from './lang';
import { skipStep } from './flowAsk';
import { spacingFor } from './spacing';
import { landscapeWords, type LandscapeWords } from './landscapeWords';
import { globalDepth, nestAsRegions, topicGraphOf, type TopicGraph } from './levelMap';
import { stepFor } from './worldView';
import { worldLayout, type WorldLayout } from './worldLayout';
import { FlagIcon, GoalFlagIcon, PieceIcon, WorldMap, type WorldCommand, type WorldPiece, type WorldTopic } from './WorldMap';
import type { RegionTree } from './regions';
import './landscape.css';

/* -- Worte -------------------------------------------------------------------------------------------------------- */

/** Die Worte der Baza — gesetzt am Anfang jeder Zeichnung; alles darunter zeichnet im selben Durchgang. */
let W: Words = words('pl');
let T: LandscapeWords = landscapeWords('pl');


/* -- Daten ------------------------------------------------------------------------------------------------------- */

/** Der Stand je Knoten aus dem Motor — der Graph nur, wenn er neu ist; der Stand nach jeder Antwort; veraltetes verworfen. */
function useStand(client: LandscapeClient | null, input: LsInput, state: LsState): { stand: LsStand | null; exact: boolean; failed: string | null; pending: boolean } {
  /* 2026-11-05 (Durchsicht) — mit dem, wofür er gerechnet wurde: Entscheidungen (Ziel erreicht, erobert) nur mit dem Stand von JETZT. */
  const [stand, setStand] = useState<{ readonly stand: LsStand; readonly input: LsInput; readonly state: LsState } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const sent = useRef<{ client: LandscapeClient | null; input: LsInput | null; state: LsState | null }>({ client: null, input: null, state: null });
  const seq = useRef(0);
  useEffect(() => {
    if (client === null) return;
    const my = ++seq.current;
    const same = sent.current.client === client;
    const freshInput = same && sent.current.input === input ? undefined : input;
    const freshState = same && sent.current.state === state && freshInput === undefined ? undefined : state;
    sent.current = { client, input, state };
    setPending(true);
    client.stand({ ...(freshInput === undefined ? {} : { input: freshInput }), ...(freshState === undefined ? {} : { state: freshState }) })
      .then((r) => { if (my === seq.current) { setStand({ stand: r, input, state }); setFailed(null); setPending(false); } }, (e: unknown) => { if (my === seq.current) { setFailed(e instanceof Error ? e.message : String(e)); setPending(false); } });
  }, [client, input, state]);
  return { stand: stand?.stand ?? null, exact: stand !== null && stand.input === input && stand.state === state, failed, pending };
}

/** Ein kurzer Fingerabdruck der Themen und ihrer Kanten (dieselben: dieselben Gebiete, ohne neu zu rechnen). */
function graphKey(tg: TopicGraph): string {
  let h = 5381;
  const add = (s: string) => { for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0; };
  tg.graph.ids.forEach((id, t) => { add(id); add(':'); for (const p of tg.graph.needs[t] ?? []) add(`${p},`); add(';'); });
  return `${tg.graph.ids.length}:${h >>> 0}`;
}

/** Die Namen des Besitzers finden ihr Gebiet wieder: dieselbe Kennung, sonst das mit den meisten gleichen Themen (mindestens die Hälfte). */
function withOwnerNames(tree: RegionTree, tg: TopicGraph, edits: LandscapeRegionEdits | undefined): RegionTree {
  const names = edits?.names;
  if (names === undefined || Object.keys(names).length === 0) return tree;
  const regions = new Map(tree.regions);
  const index = new Map(tg.graph.ids.map((id, i) => [id, i] as const));
  for (const [key, v] of Object.entries(names)) {
    let target = regions.has(key) ? key : null;
    if (target === null && v.topics.length > 0) {
      const want = new Set(v.topics.map((id) => index.get(id)).filter((x): x is number => x !== undefined));
      let best = 0;
      for (const r of regions.values()) {
        let both = 0;
        for (const t of r.topics) if (want.has(t)) both += 1;
        const j = both / Math.max(1, want.size + r.topics.length - both);
        if (j > best) { best = j; target = r.key; }
      }
      if (best < 0.5) target = null;
    }
    if (target !== null) { const r = regions.get(target)!; regions.set(target, { ...r, name: v.name, named: 'owner' }); }
  }
  return { ...tree, regions };
}

/* -- 2026-11-03: was ein Krajobraz behält — über Reiter, Zurück/Vor und Neuladen ------------------------------- */

interface Memory {
  stand: LsStand | null;
  focus: readonly string[];
  chosen: string | null;
  width: number;
  scroll: number | null;
  unit: string | null;
  unitScroll: number | null;
}

const memories = new Map<string, Memory>();
const memoryOf = (key: string): Memory => {
  let m = memories.get(key);
  if (m === undefined) {
    m = { stand: null, focus: [], chosen: null, width: 0, scroll: null, unit: null, unitScroll: null };
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

/** Das offene Gebiet, die Wahl und die offene Einheit aus der Adresse — `null`: sie nennt nichts davon. */
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

/** In die Adresse: ein anderes Gebiet als Schritt der Geschichte (Zurück geht hinauf), eine Wahl ersetzend. */
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

/** OFFENES GEBIET, WAHL, EINHEIT UND BILDLAUF, die bleiben. `scope`: `null` — nichts in der Adresse; `''` — `obszar`/`pole`. */
function useKept(key: string, scope: string | null) {
  const mem = memoryOf(key);
  const start = useMemo(() => (scope === null ? null : readKept(scope)), [scope]);
  const [focus, setFocusNow] = useState<readonly string[]>(() => start?.focus ?? mem.focus);
  const [chosen, setChosenNow] = useState<string | null>(() => (start !== null ? start.chosen : mem.chosen));
  const [unit, setUnitNow] = useState<string | null>(() => (start !== null ? start.unit : mem.unit));
  /* Hat die Adresse nichts genannt, steht danach drin, was das Gedächtnis kannte. */
  const [started] = useState(() => start !== null || mem.focus.length > 0 || mem.chosen !== null);
  useEffect(() => {
    if (scope !== null && start === null && (mem.focus.length > 0 || mem.chosen !== null || mem.unit !== null)) writeKept(scope, mem.focus, mem.chosen, false, mem.unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (scope === null) return undefined;
    const again = () => {
      const now = readKept(scope);
      setFocusNow(now?.focus ?? []);
      setChosenNow(now?.chosen ?? null);
      mem.focus = now?.focus ?? [];
      mem.chosen = now?.chosen ?? null;
      const was = mem.unit;
      mem.unit = now?.unit ?? null;
      setUnitNow(mem.unit);
      if (was !== null && mem.unit === null) backFromUnit();
    };
    window.addEventListener('popstate', again);
    return () => window.removeEventListener('popstate', again);
  }, [scope, mem]); // eslint-disable-line react-hooks/exhaustive-deps
  const setFocus = (next: readonly string[], chosenToo: string | null = null, step = true) => {
    setFocusNow(next);
    mem.focus = next;
    setChosenNow(chosenToo);
    mem.chosen = chosenToo;
    if (scope !== null) writeKept(scope, next, chosenToo, step);
  };
  const setChosen = (next: string | null) => {
    setChosenNow(next);
    mem.chosen = next;
    if (scope !== null) writeKept(scope, mem.focus, next, false, mem.unit);
  };
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
  const gone = useRef(false);
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
  return { mem, focus, setFocus, chosen, setChosen, unit, setUnit, restoreScroll, started };
}

/* -- Die Ansicht ------------------------------------------------------------------------------------------------ */

export interface LandscapeProps {
  readonly view: ViewDoc;
  /** Alle Karten der Baza (die Kenntnis eines Eintrags rechnet über alle seine Karten). */
  readonly cards: readonly Card[];
  /** Wer hier lernt (das Konto, die Person der Seite, dieser Browser) — ohne: nur zum Ansehen. */
  readonly learner: Learner | null;
  readonly onOpen?: (id: string) => void;
  /** Klein (ein Baustein als Block): kleinere Karte, ohne Liste. */
  readonly compact?: boolean;
  /** Punkte und Serie im Lauf (die Regel des Ortes). */
  readonly rewards?: RewardRules | null;
  /** Die Suche des Widoku — Treffer zum Zeigen und als Ziel. */
  readonly query?: string;
  /** Unter welchem Namen das Ziel gemerkt wird (der Widok). */
  readonly viewKey: string;
  /** Was unter einem kleinen Bild steht (der Weg zum Ganzen). */
  readonly more?: ReactNode;
  /** Wo das offene Gebiet und die Wahl in der Adresse stehen: `''` — `obszar`, `pole`; ein Zakres; fehlt es: nirgends. */
  readonly urlScope?: string;
  /** Draussen wird neu gerechnet (die Karten): das Bild bleibt, ein kleines Zeichen sagt es. */
  readonly busy?: boolean;
}

/** Was hier drin läuft: eine Powtórka (RevisionRun) — oder eine Erzählung im Spieler. */
type Running =
  | { readonly key: string; readonly source: RunSource; readonly then?: () => void; readonly story?: undefined; readonly origin?: string }
  | { readonly key: string; readonly story: Flow; readonly jump: { readonly step: string; readonly at: number } | null; readonly source?: undefined };

interface TopicInfo {
  readonly band: LsBand | null;
  readonly steps: number;
  readonly locked: boolean;
  readonly known: number;
  readonly total: number;
  /** 2026-11-04 (Prompt 15, 4b) — die mittlere Kenntnis seiner Karten (0–1): der Ring. */
  readonly mean: number;
}

export function LandscapeView({ view, cards, learner, onOpen, compact = false, rewards = null, query = '', viewKey, more, urlScope, busy = false }: LandscapeProps) {
  const { lib, writes, name: baseName } = useCtx();
  const lang = baseLang(lib);
  W = words(lang);
  T = landscapeWords(lang);
  const [goalDone, setGoalDone] = useState<string | null>(null);
  const keep = useKept(`${lib.libraryId}:${viewKey}:${compact ? 'small' : 'big'}`, urlScope ?? null);
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  const fp = useMemo(() => new Map(cards.map((c) => [c.key, c.fingerprint] as const)), [cards]);
  const [running, setRunning] = useState<Running | null>(null);
  const progress = learner?.progress;
  /* Während eines Laufs hier drin ruht die Rechnung — danach einmal. */
  const live = running === null ? progress : null;
  const flows = useMemo(() => learnerFlows(lib, learner?.progress.positions), [lib, lib.revision, learner, live]); // eslint-disable-line react-hooks/exhaustive-deps
  const gauge = useMemo(() => withFlows(gaugeFromMarks([...cards, ...(learner === null ? [] : answeredCards(learner.progress, new Set(fp.keys())))], (key) => learner?.marks(key, fp.get(key), rename) ?? [], lib.dependencies(), Date.now(), lib.prerequisites(), spacingFor(lib, learner)), flows), [cards, learner, live, fp, rename, lib, lib.revision, flows]); // eslint-disable-line react-hooks/exhaustive-deps
  const wants = needsKnowing(view);
  const plain = useMemo(() => ({ ...view, query: '' }), [view]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => viewList(wants ? withKnowing(lib, gauge) : lib, plain), [lib, lib.revision, plain, wants, wants ? gauge : null]);
  const listKey = useMemo(() => list.map((e) => e.id).join('|'), [list]);
  const nestField = view.landscape?.nest ?? null;
  const nestSort = view.landscape?.nestSort ?? 'nr';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nest = useMemo(() => (nestField === null ? null : readNest(lib, list.map((e) => e.id), nestField, nestSort)), [lib, lib.revision, listKey, nestField, nestSort]);
  const groupKey = JSON.stringify(view.group);
  /* 2026-11-03 (G) — ERZÄHLUNGEN ALS FELDER: ein Ablauf mit „unit" ist diese Einheit (auch ohne eigene Karten). */
  const stories = useMemo(() => lib.docs('flow').map((d) => ({ doc: d, flow: readFlow(d.id, d.data) })).filter((x) => x.flow.unit !== undefined), [lib, lib.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const storyOf = (id: string) => stories.find((x) => x.flow.unit === id)?.flow;
  const lowered = useMemo(() => new Set(stories.filter((x) => storyStage(x.flow, flows.get(x.flow.id)) === 'passed').map((x) => x.flow.unit!)), [stories, flows]);
  const stageOf = (flow: Flow): StoryStage => storyStage(flow, flows.get(flow.id));
  const shownAskable = useMemo(() => (stories.length === 0 ? gauge : { ...gauge, askable: new Set([...gauge.askable, ...stories.map((x) => x.flow.unit!)]) }), [gauge, stories]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const input = useMemo(() => landscapeInput({ select: lib.selectContext(), deps: lib.dependencies(), label: (e) => lib.label(e) }, list, view.group, shownAskable), [lib, lib.revision, listKey, groupKey, cards, stories]);
  const reviewable = useMemo(() => new Set(fp.keys()), [fp]);
  const state = useMemo(() => landscapeState(input, gauge, lowered, reviewable), [input, gauge, lowered, reviewable]);
  const asks = useMemo(() => questionIds(cards), [cards]);
  /* 2026-11-04 (Prompt 11) — die Themen (nie Pytania) und ihre Kanten: daraus die Gebiete. */
  const tg = useMemo(() => topicGraphOf(input, (id) => asks.has(id)), [input, asks]);
  const topicIndex = useMemo(() => new Map(tg.graph.ids.map((id, t) => [id, t] as const)), [tg]);
  const [client, setClient] = useState<LandscapeClient | null>(null);
  useEffect(() => {
    const made = landscapeClient();
    setClient(made);
    return () => { made.dispose(); setClient((was) => (was === made ? null : was)); };
  }, []);
  const [boxRef, boxWidth] = useWidth(keep.mem.width);
  /* 2026-11-05 (Durchsicht) — die Breite der Spalte der Karte, gemessen (die Seitenleiste wächst mit der Schrift der Seite). */
  const [mainRef, mainWidth] = useWidth(0);
  useEffect(() => { if (boxWidth > 0) keep.mem.width = boxWidth; }, [boxWidth, keep.mem]);

  /* Der Stand je Knoten (im Worker); bis er da ist, der letzte. */
  const fresh = useStand(client, input, state);
  useEffect(() => { if (fresh.stand !== null) keep.mem.stand = fresh.stand; }, [fresh.stand, keep.mem]);
  const stand = fresh.stand ?? keep.mem.stand;
  const standFits = stand !== null && stand.band.length === input.ids.length;
  /* Der Stand genau dieser Themen und dieses Lernenden (nicht der gemerkte von vorhin). */
  const standNow = fresh.exact && standFits;

  /* Die Gebiete: aus den Verbindungen (im Worker, einmal je Baza), oder aus den Daten (`nest`). Was der Besitzer geändert hat,
     steht im gespeicherten Widok (gleich nach dem Speichern, auch wenn der Gastgeber noch seine Abschrift zeigt). */
  const savedView = lib.docs('view').find((d) => d.id === viewKey);
  const editsNow = (savedView === undefined ? null : readLandscape((savedView.data as Record<string, unknown>).landscape)?.regions) ?? view.landscape?.regions;
  const editsJson = JSON.stringify(editsNow ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dieselben Wünsche: dasselbe Objekt (sonst rechnete jede Zeichnung neu)
  const edits = useMemo(() => editsNow, [editsJson]);
  const movesKey = JSON.stringify(edits?.moves ?? null);
  const [computed, setComputed] = useState<{ key: string; tree: RegionTree; world: WorldLayout } | null>(null);
  const [regionsFailed, setRegionsFailed] = useState<string | null>(null);
  const treeKey = `${graphKey(tg)}:${movesKey}:${lang}`;
  /*
    Damit die Gebiete bleiben, wenn sich die Baza ändert (Schlüssel, Namen, Plätze, das Gefühl, wo man ist): die letzte
    Zuordnung dieses Browsers geht mit (`previous`) — ohne die verschobenen Themen (sie folgen den Wünschen des Besitzers).
  */
  const regionsMemKey = `cg-ls-regions:${lib.libraryId}:${viewKey}`;
  /*
    2026-11-04 (Prompt 16; vom Nutzer, ersetzt Prompt 15) — DIE KARTE WIRD BEI JEDEM LADEN NEU GERECHNET, aus der Struktur
    allein (keine gespeicherten Plätze: sonst blieben alte Plätze stehen und neue Themen kämen an den Rand). Während der
    Benutzung rechnet nichts neu — der Worker behält das Ergebnis, solange sich die Struktur nicht ändert.
  */
  useEffect(() => {
    if (client === null || nest !== null) return undefined;
    let alive = true;
    let previous: Record<string, readonly string[]> | undefined;
    try {
      const raw = localStorage.getItem(regionsMemKey);
      if (raw !== null) {
        const kept = JSON.parse(raw) as { moves?: Record<string, string>; assignment?: Record<string, string[]> };
        if (kept.assignment !== undefined) {
          const moved = new Set([...Object.keys(kept.moves ?? {}), ...Object.keys(edits?.moves ?? {})]);
          previous = Object.fromEntries(Object.entries(kept.assignment).filter(([id]) => !moved.has(id)));
        }
      }
    } catch { /* ohne Speicher: neu gerechnet, aus der Struktur allein */ }
    /* 2026-11-04 (Prompt 13) — dazu die eine Landschaft (feste Plätze aller Themen), im Worker. */
    void client.world({ key: treeKey, graph: tg.graph, lang, ...(edits?.moves === undefined ? {} : { overrides: { moves: edits.moves } }), ...(previous === undefined ? {} : { previous }) })
      .then(({ tree, world: made }) => {
        if (!alive) return;
        setComputed({ key: treeKey, tree, world: made });
        setRegionsFailed(null);
        try { localStorage.setItem(regionsMemKey, JSON.stringify({ moves: edits?.moves ?? {}, assignment: tree.assignment })); } catch { /* zu gross oder ohne Speicher */ }
      }, (e: unknown) => { if (alive) setRegionsFailed(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [client, treeKey, nest]); // eslint-disable-line react-hooks/exhaustive-deps
  const tree = useMemo((): RegionTree | null => {
    if (nest !== null) return nestAsRegions(nest, tg, T.otherTopics, T.wholeMap);
    /* 2026-11-05 (Durchsicht) — nur die Gebiete DIESER Themen (nach einer Änderung der Baza wartet das Bild auf die neuen). */
    if (computed === null || computed.key !== treeKey) return null;
    return withOwnerNames(computed.tree, tg, edits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nest, tg, computed, edits, lang, treeKey]);

  /* 2026-11-04 (Prompt 13) — DIE EINE LANDSCHAFT: feste Plätze (aus dem Worker; ein verschachtelter Krajobraz hier gerechnet). */
  const world = useMemo((): WorldLayout | null => {
    if (tree === null) return null;
    if (nest !== null) { try { return worldLayout(tree, tg); } catch { return null; } }
    return computed !== null && computed.key === treeKey ? computed.world : null;
  }, [tree, nest, tg, computed, treeKey]);

  const goalKey = `landscape:${viewKey}`;
  const [localGoal, setLocalGoal] = useState<string | null>(null);
  const keptGoal = progress?.positions.get(goalKey)?.step ?? null;
  const goal = learner === null ? localGoal : keptGoal === null || keptGoal === '' ? null : keptGoal;
  const [localSteps, setLocalSteps] = useState<readonly string[]>([]);
  const goalSteps: readonly string[] = learner === null ? localSteps : progress?.positions.get(goalKey)?.visited ?? [];
  const setGoal = (id: string | null) => {
    const keepIt = (steps: readonly string[]) => {
      if (learner === null) { setLocalGoal(id); setLocalSteps(steps); return; }
      void learner.keepPosition({ flow: goalKey, step: id ?? '', visited: [...steps], at: Date.now() }).catch(() => undefined);
    };
    if (id === null || client === null) { keepIt([]); return; }
    void client.route(id).then((r) => keepIt([...(r?.steps.flat() ?? []).filter((x) => !asks.has(x)), id]), () => keepIt([id]));
  };
  /* 2026-11-05 (Durchsicht) — ein Ziel ohne Weg („Ustaw jako cel" in einer Erzählung speichert keinen): den Weg einmal holen. */
  const routedGoal = useRef<string | null>(null);
  useEffect(() => {
    if (goal === null || goalSteps.length > 0 || client === null || routedGoal.current === goal) return;
    routedGoal.current = goal;
    setGoal(goal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, goalSteps.length, client]);

  const labelOf = (id: string): string => { const e = lib.entity(id); return e === undefined ? id : lib.label(e); };
  const inputIndex = useMemo(() => new Map(input.ids.map((id, i) => [id, i] as const)), [input]);
  const infoOfNode = (v: number | undefined): TopicInfo => {
    if (v === undefined || !standFits || stand === null) return { band: null, steps: 0, locked: false, known: 0, total: 0, mean: 0 };
    const band = BAND_CODE[stand.band[v]] ?? null;
    return { band, steps: band === null ? 0 : liftOf(band, stand.missing[v]), locked: stand.locked[v] === 1, known: Number(state.cardsKnown?.[v] ?? 0), total: Number(state.cardsTotal?.[v] ?? 0), mean: Number(state.cardsMean?.[v] ?? 0) };
  };
  const infoOf = (t: number): TopicInfo => infoOfNode(tg.node[t]);
  const infoById = (id: string): TopicInfo => infoOfNode(inputIndex.get(id));
  const bandOf = (id: string): LsBand | null => infoById(id).band;
  useEffect(() => {
    if (goal === null || !standNow) return;
    /* 2026-11-05 (Durchsicht) — ein Ziel, das es in diesem Widok nicht mehr gibt, ist kein Ziel mehr. */
    if (!inputIndex.has(goal)) { setGoal(null); return; }
    const b = bandOf(goal);
    if (b === 'known' || b === 'due') { setGoalDone(goal); setGoal(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, stand]);

  /* Die Tiefe jedes Themas im Graphen der Themen (für „als Nächstes": die Grundlagen zuerst). */
  const depthOfTopic = useMemo(() => {
    const n = tg.graph.ids.length;
    const d = new Int32Array(n).fill(-1);
    const busyMark = new Uint8Array(n);
    const of = (t: number): number => {
      if (d[t] >= 0) return d[t];
      if (busyMark[t] === 1) return 0;
      busyMark[t] = 1;
      let x = 0;
      for (const p of tg.graph.needs[t] ?? []) x = Math.max(x, of(p) + 1);
      busyMark[t] = 0;
      d[t] = x;
      return x;
    };
    for (let t = 0; t < n; t += 1) of(t);
    return d;
  }, [tg]);
  /* DER NÄCHSTE SCHRITT: auf dem Weg zum Ziel das erste Bereite, sonst das Bereite mit den wenigsten Grundlagen davor. */
  const next = useMemo((): { t: number; first: boolean } | null => {
    if (!standFits) return null;
    for (const id of goal !== null ? goalSteps : []) {
      const t = topicIndex.get(id);
      if (t === undefined) continue;
      const i = infoOf(t);
      if (i.band === 'ring' && !i.locked) return { t, first: false };
    }
    let best = -1;
    let locked = -1;
    const better = (a: number, b: number) => b < 0 || depthOfTopic[a] < depthOfTopic[b] || (depthOfTopic[a] === depthOfTopic[b] && (tg.graph.rank?.[a] ?? a) < (tg.graph.rank?.[b] ?? b));
    for (let t = 0; t < tg.graph.ids.length; t += 1) {
      const i = infoOf(t);
      if (i.band !== 'ring') continue;
      if (!i.locked) { if (better(t, best)) best = t; } else if (better(t, locked)) locked = t;
    }
    if (best >= 0) return { t: best, first: false };
    if (locked >= 0) return { t: locked, first: true };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand, tg, goal, goalSteps, depthOfTopic]);
  /* Was fällig ist (Karten der Themen dieses Widoku). */
  const dueCards = useMemo(() => {
    const topics = new Set(tg.graph.ids);
    const keys = new Set<string>();
    const out: Card[] = [];
    for (const c of cards) {
      if (keys.has(c.key) || !gauge.states.has(c.key) || cardKnowness(gauge, c.key) >= 1 || (learner?.progress.suspended.has(c.key) ?? false)) continue;
      if (!cardEntities(c).some((e) => topics.has(e))) continue;
      keys.add(c.key);
      out.push(c);
    }
    return out;
  }, [cards, gauge, tg, learner]);

  /*
    2026-11-04 (Prompt 13) — WAS DAS BILD GERADE FÜLLT (die Brotkrumen folgen dem Zoom) und was gezeigt werden soll (ein
    Gebiet, ein Thema, „Ganze Karte").
  */
  const [viewChain, setViewChain] = useState<readonly string[]>([]);
  const [flashT, setFlashT] = useState<number | null>(null);
  useEffect(() => { if (flashT === null) return undefined; const id = window.setTimeout(() => setFlashT(null), 1600); return () => window.clearTimeout(id); }, [flashT]);

  /* Die Farbe: der Abschnitt (die ersten acht, in der Reihenfolge des Autors); ein Gebiet: der häufigste darin. */
  const colourOf = useMemo(() => {
    const order = tg.graph.ids.map((_, t) => t).sort((a, b) => (tg.graph.rank?.[a] ?? a) - (tg.graph.rank?.[b] ?? b));
    /* Mehr als acht Abschnitte: die Farbe der obersten Gruppe darüber (die Fächer, nicht ihre Bereiche). */
    const first = new Set(order.map((t) => tg.graph.names?.[t]?.[0]).filter((x): x is string => x !== undefined));
    const nameAt = (t: number): string | undefined => { const chain = tg.graph.names?.[t] ?? []; return first.size <= 8 ? chain[0] : chain[chain.length - 1]; };
    const map = new Map<string, number>();
    for (const t of order) { const s = nameAt(t); if (s !== undefined && !map.has(s)) map.set(s, map.size < 8 ? map.size : -1); }
    return (topics: readonly number[]): number => {
      const count = new Map<number, number>();
      for (const t of topics) { const s = nameAt(t); const c = s === undefined ? -1 : map.get(s) ?? -1; count.set(c, (count.get(c) ?? 0) + 1); }
      let best = -1;
      let most = 0;
      for (const [c, n] of count) if (n > most || (n === most && c < best)) { most = n; best = c; }
      return best;
    };
  }, [tg]);

  /* Der Weg (eine Liste von Themen in der Reihenfolge des Lernens, das Ziel zuletzt) — für das gewählte Thema oder das Ziel. */
  const { chosen, setChosen } = keep;
  const [routeOf, setRouteOf] = useState<{ id: string; list: string[] } | null>(null);
  const [routeShown, setRouteShown] = useState<string | null>(null);
  const chosenId = chosen !== null && topicIndex.has(chosen) ? chosen : null;
  useEffect(() => {
    let alive = true;
    if (chosenId === null || client === null || !standFits) { setRouteOf(null); return undefined; }
    const i = infoById(chosenId);
    if (i.band === 'known' || i.band === 'due') { setRouteOf({ id: chosenId, list: [] }); return undefined; }
    void client.route(chosenId).then((r) => { if (alive) setRouteOf({ id: chosenId, list: [...(r?.steps.flat() ?? []).filter((x) => !asks.has(x)), chosenId] }); }, () => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenId, client, stand]);
  /* 2026-11-04 (Prompt 12) — ein gewähltes Thema zeigt seinen Weg gleich (auf der Karte und daneben). */
  useEffect(() => { setRouteShown(chosenId); }, [chosenId]);
  const goalOpen = goalSteps.filter((x) => { const b = bandOf(x); return b !== 'known' && b !== 'due'; });
  /*
    2026-11-04 (Prompt 14, 1) — DIE SPIELFIGUREN, gemerkt mit dem Fortschritt des Lernenden (eine Stelle `pieces:<widok>`: die
    Themen, die er zu lernen begann — so auch nach dem Neuladen und auf einem anderen Gerät). Eine Figur entsteht nur durch
    sein Tun (ein Thema zum Lernen öffnen) und geht, wenn das Thema gekonnt ist.
  */
  const piecesKey = `pieces:${viewKey}`;
  const [localPieces, setLocalPieces] = useState<readonly string[]>([]);
  const storedPieces: readonly string[] = learner === null ? localPieces : progress?.positions.get(piecesKey)?.visited ?? [];
  const addPiece = (id: string) => {
    if (!topicIndex.has(id)) return;
    const list = [...storedPieces.filter((x) => x !== id && bandOf(x) !== 'known' && bandOf(x) !== 'due'), id].slice(-40);
    if (learner === null) { setLocalPieces(list); return; }
    void learner.keepPosition({ flow: piecesKey, step: '', visited: list, at: Date.now() }).catch(() => undefined);
  };
  /*
    2026-11-05 — VON EINEM BEGONNENEN FELD ZURÜCKTRETEN: die Figur geht von dort (nur die Figur — die Antworten bleiben, und
    wer das Thema wieder öffnet, stellt sie wieder hin).
  */
  const removePiece = (id: string) => {
    const list = storedPieces.filter((x) => x !== id);
    if (list.length === storedPieces.length) return;
    if (learner === null) { setLocalPieces(list); return; }
    void learner.keepPosition({ flow: piecesKey, step: '', visited: list, at: Date.now() }).catch(() => undefined);
  };

  /* Erobertes: einmal gesagt, wenn es neu ist. */
  const [won, setWon] = useState<string | null>(null);
  const wonKey = `cg-ls-won:${lib.libraryId}:${viewKey}:${learner === null ? 'me' : holderKey(learner.holder)}`;

  const [note, setNote] = useState<string | null>(null);
  const [said, setSaid] = useState('');
  const [command, setCommand] = useState<WorldCommand | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  /* -- Lernen ------------------------------------------------------------------------------------------- */
  const planFrom = async (graph: Graph): Promise<Plan | null> => {
    const ctx = lib.revisionContext(cards, (key) => learner?.marks(key, fp.get(key), rename) ?? [], Date.now(), flows, spacingFor(lib, learner));
    const made = await planOf(graph, ctx);
    if (made.plan === null) { setNote(made.problems[0] ?? T.noCards); return null; }
    const plan = { ...made.plan, cards: made.plan.cards.filter((c) => !(learner?.progress.suspended.has(c.key) ?? false)) };
    if (plan.cards.length === 0) { setNote(T.noQuestions); return null; }
    return plan;
  };
  const learnParts = (title: string, ids: readonly string[], endWhenDone = true) => {
    setNote(null);
    void (async () => {
      const plan = await planFrom(practiseGraph([...new Set(ids.flatMap((x) => practiseIds(cards, x)))], endWhenDone));
      if (plan !== null) setRunning({ key: `learn:${title}:${Date.now()}`, source: { plan, cards, title } });
    })();
  };
  const learnEntry = (id: string, endWhenDone = true) => {
    setNote(null);
    addPiece(id);
    void (async () => {
      const plan = await planFrom(practiseGraph(practiseIds(cards, id), endWhenDone));
      if (plan !== null) setRunning({ key: `learn:${id}:${Date.now()}`, source: { plan, cards, title: labelOf(id) } });
    })();
  };
  const reviewCards = (title: string, list: readonly Card[]) => {
    setNote(null);
    if (list.length === 0) { setNote(T.nothingNext); return; }
    setRunning({ key: `review:${title}:${Date.now()}`, source: { plan: readPlan(list, { mode: 'temporal', order: 'general', pick: 'next', stackSize: 20, endWhenDone: true }), cards, title } });
  };
  const reviewFirst = (id: string, after?: () => void) => {
    setNote(null);
    addPiece(id);
    const groups = lockCards(gauge, lib.prerequisites(), id, cards);
    const list = groups.flatMap((g) => g.cards).filter((c) => !(learner?.progress.suspended.has(c.key) ?? false));
    const nextUp = after ?? (() => learnEntry(id));
    if (list.length === 0) { nextUp(); return; }
    const plan = readPlan(list, { mode: 'temporal', order: 'general', pick: 'next', stackSize: 20, endWhenDone: true });
    setRunning({ key: `review:${id}:${Date.now()}`, source: { plan, cards, title: `${W.reviewFirstWhat}: ${labelOf(id)}` }, then: nextUp, origin: id });
  };
  const lockCount = (id: string): number => lockCards(gauge, lib.prerequisites(), id, cards).reduce((s, g) => s + g.cards.length, 0);
  const storyUnit = (id: string): Flow | undefined => (gauge.testing.has(id) ? undefined : storyOf(id));
  const openStory = (flow: Flow, review: boolean) => {
    const find = (x: string) => { const d = lib.docs('flow').find((one) => one.id === x); return d === undefined ? undefined : readFlow(d.id, d.data); };
    const full = resolveFlow(flow, find);
    const at = review ? reviewStart(full) : null;
    if (flow.unit !== undefined) addPiece(flow.unit);
    setRunning({ key: `story:${full.id}:${Date.now()}`, story: full, jump: at === null ? null : { step: at, at: Date.now() } });
  };
  const openTopic = (id: string) => { const flow = storyOf(id); if (flow !== undefined && !gauge.testing.has(id)) { setRunning(null); window.setTimeout(() => openStory(flow, false), 0); return; } learnEntry(id); };
  const closingFor = (origin: string | null) => ({
    origin, goal: goalSteps.length > 0 ? goalSteps : null, label: labelOf, openTopic,
    others: () => setRunning(null), back: () => setRunning(null)
  });
  /* Ein Thema zeigen: die Karte gleitet zu ihm, es leuchtet kurz auf (gewählt bleibt, was gewählt war). */
  const showTopic = (id: string) => {
    const t = topicIndex.get(id);
    if (t === undefined) return;
    setFlashT(t);
    setCommand({ kind: 'topic', key: String(t), at: Date.now() });
  };
  const selectTopic = (id: string) => { setChosen(id); showTopic(id); };

  /* Die Namen und Wünsche des Besitzers speichern (im Widok: sie gelten für jeden, der ihn sieht). */
  const viewDoc = lib.docs('view').find((d) => d.id === viewKey);
  const saveEdits = (patch: (was: LandscapeRegionEdits) => LandscapeRegionEdits) => {
    if (viewDoc === undefined) return;
    const data = viewDoc.data as Record<string, unknown>;
    const ls = (typeof data.landscape === 'object' && data.landscape !== null ? data.landscape : {}) as Record<string, unknown>;
    const was = (edits ?? {}) as LandscapeRegionEdits;
    void lib.saveDoc('view', { ...data, landscape: { ...ls, regions: patch(was) } }, viewDoc.id).catch((e: unknown) => setNote(e instanceof Error ? e.message : String(e)));
  };

  /* -- 2026-11-04 (Prompt 13): was jedes Thema auf der einen Karte zeigt ---------------------------------- */
  /* Die Farbe eines Themas: die seines obersten Gebiets (benachbarte Gebiete verschieden); ohne Gebiete: sein Abschnitt. */
  const topSubject = useMemo(() => { const m = new Map<string, number>(); (world?.top ?? []).forEach((k, i) => m.set(k, i % 8)); return m; }, [world]);
  /* Was ein Thema öffnet (die Kanten umgekehrt). */
  const opensOf = useMemo(() => { const out: number[][] = tg.graph.ids.map(() => []); tg.graph.needs.forEach((list, u) => { for (const p of list) out[p]?.push(u); }); return out; }, [tg]);
  /* Wie viele Karten je Thema fällig sind (was in der Kachel steht). */
  const dueBy = useMemo(() => { const m = new Map<string, number>(); for (const c of dueCards) for (const e of cardEntities(c)) m.set(e, (m.get(e) ?? 0) + 1); return m; }, [dueCards]);
  /* 2026-11-04 (Prompt 14, 6) — die Stufe nach der Baza: ihre längste Kette (eine flache Baza bekommt höhere Stufen). */
  const step = useMemo(() => { const d = globalDepth(tg); let most = 0; for (let i = 0; i < d.length; i += 1) most = Math.max(most, d[i]); return stepFor(most + 1); }, [tg]);
  const worldTopics = useMemo((): WorldTopic[] => tg.graph.ids.map((id, t) => {
    const info = infoOf(t);
    const band = info.band ?? 'mountain';
    const topKey = world?.chain[t]?.[0];
    const todo = band === 'known' ? T.todoKnown : band === 'due' ? T.todoDue(Math.max(1, dueBy.get(id) ?? 1)) : band === 'ring' ? (info.locked ? T.nextFirst : T.todoReady) : T.todoMissing(Math.max(1, info.steps - 1));
    return { id, label: tg.graph.labels[t], steps: info.steps, band, subject: topKey !== undefined ? topSubject.get(topKey) ?? -1 : colourOf([t]), glow: band === 'ring' && !info.locked,
      /* 2026-11-04 (Prompt 15, 4b) — der Ring: die mittlere Kenntnis seiner Karten (keine Zeichen auf den Feldern mehr). */
      share: info.total === 0 ? (band === 'known' || band === 'due' ? 1 : 0) : info.mean, todo,
      due: band === 'due' || (dueBy.get(id) ?? 0) > 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tg, stand, state, world, topSubject, colourOf, dueBy, lang, opensOf]);
  /* Je Gebiet: wie viel darin gekonnt ist und was jetzt geht. */
  const regionStats = useMemo(() => {
    const m = new Map<string, { all: number; known: number; ready: number }>();
    for (const r of world?.regions.values() ?? []) {
      let known = 0; let ready = 0;
      for (const x of r.topics) { const b = worldTopics[x]?.band; if (b === 'known' || b === 'due') known += 1; else if (b === 'ring') ready += 1; }
      m.set(r.key, { all: r.topics.length, known, ready });
    }
    return m;
  }, [world, worldTopics]);
  const conquered = useMemo(() => new Set([...regionStats].filter(([, s]) => s.all > 0 && s.known === s.all).map(([k]) => k)), [regionStats]);
  /* Erobert: neu seit dem letzten Mal? (die obersten Gebiete) */
  const wonNow = (world?.top ?? []).filter((k) => conquered.has(k)).sort().join('|');
  useEffect(() => {
    if (!standNow || world === null) return;
    let had: string[] = [];
    let first = false;
    try { const raw = localStorage.getItem(wonKey); if (raw === null) first = true; else had = JSON.parse(raw) as string[]; } catch { first = true; }
    const now = world.top.filter((k) => conquered.has(k));
    const fresh2 = now.filter((k) => !had.includes(k));
    if (fresh2.length > 0 && !first) setWon(tree?.regions.get(fresh2[0])?.name ?? null);
    try { localStorage.setItem(wonKey, JSON.stringify([...new Set([...had, ...now])].slice(-400))); } catch { /* ohne Speicher */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wonNow, standNow]);
  const chosenT = chosenId === null ? null : topicIndex.get(chosenId) ?? null;
  /* 2026-11-05 (Durchsicht) — dieselben Objekte, solange sich nichts ändert (sonst zeichnete die Karte bei jedem Rendern neu). */
  const links = useMemo(() => (chosenT === null ? null : { needs: tg.graph.needs[chosenT] ?? [], opens: opensOf[chosenT] ?? [] }), [chosenT, tg, opensOf]);
  /* Der Weg auf der Karte: zum gewählten Thema, sonst zum Ziel. */
  const routeIds: readonly string[] | null = routeShown !== null && routeOf !== null && routeOf.id === routeShown ? routeOf.list.filter((x) => { const b = bandOf(x); return b !== 'known' && b !== 'due'; })
    : goal !== null && goalOpen.length > 0 ? goalOpen : null;
  const routeKey = routeIds === null ? null : routeIds.join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const routeT = useMemo(() => (routeIds === null ? null : routeIds.map((x) => topicIndex.get(x)).filter((x): x is number => x !== undefined)), [routeKey, topicIndex]);
  const regionName = useMemo(() => (key: string) => tree?.regions.get(key)?.name ?? key, [tree]);

  /* Immer in einer Hülle, deren Breite gemessen wird. */
  const host = (body: ReactNode) => <div ref={boxRef} className="cg-ls-host">{body}</div>;
  if (running !== null) {
    /* 2026-11-05 — über einer Powtórka: zurück zur Karte; eine Erzählung hat es in ihrer Kopfzeile („‹ Mapa", Prompt 18). */
    const back = <p className="cg-ls-back"><button type="button" className="wk-link-btn" onClick={() => setRunning(null)} data-landscape-back="">{T.backToMap}</button></p>;
    if (running.story !== undefined) {
      return host(
        <div className="cg-ls-run" data-landscape-run="story" data-landscape-run-flow={running.story.id}>
          <FlowPlayer key={running.key} flow={running.story} content={contentOfLibrary(lib, cards)} learner={learner} onClose={() => setRunning(null)} backLabel={T.mapShort} jumpTo={running.jump} />
        </div>
      );
    }
    return host(
      <div className="cg-ls-run" data-landscape-run={running.key.split(':')[0]}>
        {back}
        <RevisionRun key={running.key} lib={lib} learner={learner} source={running.source} rewards={rewards} closing={closingFor(running.origin ?? null)}
          onClose={() => setRunning(null)} {...(running.then === undefined ? {} : { onDone: running.then })} />
      </div>
    );
  }
  /* Eine Einheit, die eine Erzählung ist: ihre Ścieżka ist die der Erzählung. */
  const storyPath = (id: string) => {
    const flow = storyOf(id);
    if (flow === undefined || flow.graph.nodes.length === 0) return null;
    const content = contentOfLibrary(lib, cards);
    /* 2026-11-04 (Prompt 11) — wie im Spieler: ein Warunek, der für diesen Lernenden entschieden ist, zeigt nur seinen Weg. */
    const decide = learner === null ? undefined : decideBy({ ...factsOf(gauge, () => []), flow: (ref: string) => flows.get(content.flowRef?.(ref) ?? ref) });
    const sp = storyPathOf(flow, content, decide);
    const kept = positionFor(learner?.progress.positions, flow);
    const known = gaugeKnow(gauge);
    const nodeOf = new Map(flow.graph.nodes.map((n) => [n.id, n] as const));
    const marks = storyMarks(sp, {
      visited: kept?.visited ?? [], step: kept?.step ?? null, ended: flows.get(flow.id)?.done === true,
      ...(learner === null ? {} : {
        know: (x: string) => (content.cardsOf(x).length === 0 ? { learned: true, due: false } : known(x)),
        knownStep: (s: string) => { const n = nodeOf.get(s); return n !== undefined && skipStep(n, content.card, Object.assign((c: Card) => learner.marks(c.key, c.fingerprint, content.rename), { spacing: spacingFor(lib, learner) })); }
      })
    });
    return { flow, sp, model: sp.model, marks };
  };
  const askable = (id: string) => gauge.askable.has(id) && !asks.has(id);
  const unitTopics = (id: string): string[] => unitMembers(lib, id, cards, askable);
  if (keep.unit !== null) {
    const story = storyPath(keep.unit);
    const told = storyOf(keep.unit);
    const members = story !== null ? story.model.nodes.filter(countsAsStep).map((n) => n.id) : unitTopics(keep.unit);
    const model = story !== null ? story.model : pathOfEntries(members.map((id) => ({ id, label: labelOf(id) })), lib.prerequisites());
    return host(
      <div className="cg-ls-unit" data-landscape-unit-open={keep.unit}>
        <div className="cg-row-between">
          <button type="button" className="wk-link-btn" onClick={() => keep.setUnit(null)} data-landscape-unit-back="">‹ {W.backToMap}</button>
          <strong><TexText text={entityNameTex(lib, keep.unit)} /></strong>
        </div>
        {told !== undefined && (
          <p className="cg-muted" data-landscape-unit-story={told.id} data-landscape-unit-done={flows.get(told.id)?.done === true ? '1' : '0'}>
            {T.storyHere} <strong><TexText text={told.name} /></strong>{T.storyStage(stageOf(told)) === '' ? '' : ` — ${T.storyStage(stageOf(told))}`}
            {urlScope === '' && <> · <a className="wk-link" href={viewPath('learn', lib.libraryId, 'przebiegi', told.id, 'graj')} data-landscape-unit-play="">{flows.has(told.id) ? T.storyBack : T.storyButton('new')}</a></>}
          </p>
        )}
        {story === null && <p className="cg-muted" data-landscape-unit-count={members.length}>{T.inSection(members.length)}</p>}
        {members.length === 0 ? <p className="cg-muted">{W.empty}</p> : (
          story !== null ? (
            <PathMap model={story.model} marks={story.marks} size="full" words={W} title={`${W.pathTitle}: ${W.story}`} name={(id) => <TexText text={story.model.nodes[story.model.index.get(id) ?? -1]?.label ?? id} />}
              onPick={(id) => { const part = story.sp.parts[story.model.index.get(id) ?? -1]; if (part !== undefined && part.first !== null) setRunning({ key: `story:${story.flow.id}:${Date.now()}`, story: story.flow, jump: { step: part.first, at: Date.now() } }); }}
              actions={(id, st) => {
                const part = story.sp.parts[story.model.index.get(id) ?? -1];
                if (part === undefined || part.kind === 'start' || part.kind === 'end' || part.kind === 'fork') return null;
                const askedHere = part.asked.filter((x) => cardsAbout(cards, x).length > 0);
                return <div className="wk-actions">{learner !== null && askedHere.length > 0 && <button type="button" className="wk-btn" onClick={() => learnParts(part.label, askedHere, st !== 'done')} data-path-learn={id}>{st === 'done' ? W.review : W.start}</button>}</div>;
              }} />
          ) : (
            <PathMap model={model} marks={pathMarks(model, gaugeKnow(gauge), null)} size="full" words={W} noun="topics" title={T.sectionTitle} name={(id) => <TexText text={entityNameTex(lib, id)} />}
              actions={(id, st) => (
                <div className="wk-actions">
                  {learner !== null && <button type="button" className="wk-btn" onClick={() => learnEntry(id, st !== 'done')} data-path-learn={id}>{st === 'done' ? W.review : W.start}</button>}
                  {onOpen !== undefined && <button type="button" className="wk-link-btn" onClick={() => onOpen(id)}>{W.openEntry}</button>}
                </div>
              )} />
          )
        )}
      </div>
    );
  }
  const failed = fresh.failed ?? regionsFailed;
  if (failed !== null) return host(<p className="wk-error" data-landscape-failed="">{T.failed}: {failed}</p>);
  if (tree === null || !standFits || boxWidth === 0) return host(<p className="cg-muted" data-landscape-wait="">{W.wait}</p>);
  if (tg.graph.ids.length === 0) return host(<p className="cg-muted" data-landscape-empty="">{W.empty}</p>);

  /* -- Navigation: eine Karte, die Brotkrumen folgen dem Zoom ----------------------------------------------- */
  const here = viewChain.length === 0 ? null : tree.regions.get(viewChain[viewChain.length - 1]) ?? null;
  const zoomTo = (key: string | null) => { setCommand(key === null ? { kind: 'fit', at: Date.now() } : { kind: 'region', key, at: Date.now() }); };
  const toMe = () => { if (next === null) { zoomTo(null); return; } showTopic(tg.graph.ids[next.t]); };
  const whole = () => zoomTo(null);
  const startTopic = (id: string) => {
    const i = infoById(id);
    const flow = storyUnit(id);
    if (i.band === 'ring' && i.locked) { reviewFirst(id, flow === undefined ? undefined : () => openStory(flow, false)); return; }
    if (flow !== undefined && i.band !== 'mountain') { openStory(flow, stageOf(flow) === 'review'); return; }
    if (i.band === 'ring') learnEntry(id);
    else if (i.band === 'due' || i.band === 'known') learnEntry(id, i.band !== 'known');
  };
  /*
    2026-11-05 — DER WEG DORTHIN, sofort (Doppelklick auf einen Berg, „Prowadź mnie tutaj"): das Thema wird das Ziel, und das
    erste Thema seines Weges, das jetzt lernbar ist, beginnt (gesperrt: erst wiederholen). `list`: der schon bekannte Weg.
  */
  const leadTo = (id: string, list?: readonly string[]) => {
    setGoal(id);
    setSaid(W.goalSet(labelOf(id)));
    if (learner === null) return;
    const go = (steps: readonly string[]) => {
      const first = steps.find((x) => x !== id && bandOf(x) === 'ring');
      if (first === undefined) return;
      /* 2026-11-05 (Durchsicht) — wie „Zacznij“: eine Erzählung öffnet sich als Erzählung, nicht als Karten. */
      startTopic(first);
    };
    if (list !== undefined) { go(list); return; }
    if (client === null) return;
    void client.route(id).then((r) => go((r?.steps.flat() ?? []).filter((x) => !asks.has(x))), () => undefined);
  };
  /* Ein Thema auf der Karte: gewählt; noch einmal auf das gewählte — beginnen, wenn es geht. */
  const pick = (t: number) => {
    const id = tg.graph.ids[t];
    if (chosenId === id) { if (learner !== null && infoOf(t).band !== 'mountain') startTopic(id); return; }
    setChosen(id);
  };

  /* -- Die Zeile über der Karte: zuerst das eigene Land ----------------------------------------------------- */
  const wide = !compact && boxWidth >= 860;
  const mapWidth = mainWidth > 0 ? Math.max(280, Math.floor(mainWidth)) : wide ? Math.max(320, boxWidth - 352) : boxWidth;
  const nextName = next === null ? null : tg.graph.labels[next.t];
  const landCount = worldTopics.filter((x) => x.band === 'known' || x.band === 'due').length;
  const readyCount = worldTopics.filter((x) => x.band === 'ring').length;
  const tops = world?.top ?? [];
  const wonCount = tops.filter((k) => conquered.has(k)).length;
  const nextLine = (
    <div className="cg-ls-next" data-landscape-next={next === null ? '' : tg.graph.ids[next.t]} data-landscape-due={dueCards.length} data-landscape-land={landCount}>
      <p data-landscape-summary="">{T.summary(landCount, wonCount, tops.length, readyCount, dueCards.length)}</p>
      <div className="wk-actions">
        {next !== null && learner !== null && (next.first
          ? <button type="button" className="wk-btn" onClick={() => reviewFirst(tg.graph.ids[next.t])} data-landscape-next-go="first">{W.reviewFirst(lockCount(tg.graph.ids[next.t]))}</button>
          : <button type="button" className="wk-btn" onClick={() => { const id = tg.graph.ids[next.t]; const flow = storyUnit(id); if (flow !== undefined) openStory(flow, false); else learnEntry(id); }} data-landscape-next-go="learn">{T.learnIt(nextName ?? '')}</button>)}
        {dueCards.length > 0 && learner !== null && <button type="button" className="wk-btn wk-btn-line" onClick={() => reviewCards(T.dueCards(dueCards.length), dueCards)} data-landscape-review-due={dueCards.length}>{T.reviewDue(dueCards.length)}</button>}
      </div>
    </div>
  );

  /* -- Das kurze Panel eines Themas ----------------------------------------------------------------------- */
  const chosenInfo = chosenId === null ? null : infoById(chosenId);
  const topicPanel = chosenId !== null && chosenT !== null && chosenInfo !== null ? (() => {
    const list = routeOf !== null && routeOf.id === chosenId ? routeOf.list : null;
    /* Was noch fehlt, in der Reihenfolge des Lernens — was jetzt geht zuerst. */
    const missingAll = list === null ? [] : list.filter((x) => x !== chosenId && bandOf(x) !== 'known' && bandOf(x) !== 'due');
    const missing = [...missingAll.filter((x) => bandOf(x) === 'ring'), ...missingAll.filter((x) => bandOf(x) !== 'ring')];
    const flow = storyUnit(chosenId);
    const story = flow === undefined ? null : (() => {
      const sp = storyPath(chosenId);
      const first = directStartLock(lib, learner?.progress.positions, flow);
      if (sp === null) return { parts: 0, done: 0, stage: stageOf(flow), first };
      const counted = sp.model.nodes.filter(countsAsStep);
      return { parts: counted.length, done: counted.filter((nd) => sp.marks.state[sp.model.index.get(nd.id) ?? -1] === 'done').length, stage: stageOf(flow), first };
    })();
    const leaf = world?.chain[chosenT]?.[world.chain[chosenT].length - 1];
    const leafRegion = leaf === undefined ? undefined : tree.regions.get(leaf);
    const leafStats = leaf === undefined ? undefined : regionStats.get(leaf);
    const dueHereN = dueCards.filter((c) => cardEntities(c).includes(chosenId)).length;
    return (
      <TopicPanel key={chosenId} id={chosenId} info={chosenInfo} missing={missing} missingKnown={list !== null} opens={opensOf[chosenT].map((u) => tg.graph.ids[u])} story={story} dueCount={dueHereN}
        region={leafRegion === undefined || leafStats === undefined ? null : { name: leafRegion.name, all: leafStats.all, known: leafStats.known, key: leafRegion.key }}
        canLearn={learner !== null} note={note} lockCount={lockCount} bandOf={bandOf} stepsOf={(x) => infoById(x).steps}
        onLearnNow={(x) => startTopic(x)}
        onStart={() => startTopic(chosenId)}
        onLead={() => leadTo(chosenId, missing)}
        /* 2026-11-05 — zurücktreten: trägt das Feld die Figur des Ziels, wird das Ziel aufgegeben; sonst geht die eigene Figur. */
        resign={goal !== null && goalOpen[0] === chosenId ? { kind: 'goal', onResign: () => { setGoal(null); removePiece(chosenId); } }
          : storedPieces.includes(chosenId) && chosenInfo.band !== 'known' && chosenInfo.band !== 'due' ? { kind: 'piece', onResign: () => removePiece(chosenId) } : null}
        onShow={showTopic} onPath={() => keep.setUnit(chosenId)} onClose={() => setChosen(null)} onRegion={(k) => zoomTo(k)}
        owner={writes && viewDoc !== undefined ? {
          ...(onOpen === undefined ? {} : { open: () => onOpen(chosenId) }),
          ...(nest === null && tree.levels > 0 ? {
            move: {
              options: [...tree.regions.values()].filter((r) => r.level === 1).map((r) => ({ key: r.key, name: r.name })).sort((a, b) => a.name.localeCompare(b.name, lang)),
              current: tree.leafOf[chosenT] ?? null,
              onMove: (key: string) => saveEdits((was) => ({ ...was, moves: { ...(was.moves ?? {}), [chosenId]: key } }))
            }
          } : {}),
          ...(leafRegion !== undefined && nest === null ? { rename: { name: leafRegion.name, onSave: (name: string) => saveEdits((was) => ({ ...was, names: { ...(was.names ?? {}), [leafRegion.key]: { name, topics: leafRegion.topics.map((x) => tg.graph.ids[x]) } } })) } } : {})
        } : null} />
    );
  })() : null;

  /* -- Das Gebiet, das das Bild füllt (oder die ganze Karte) ------------------------------------------------- */
  const hereTopics = here === null ? tg.graph.ids.map((_, x) => x) : here.topics;
  const hereStats = here === null ? { all: hereTopics.length, known: landCount } : regionStats.get(here.key) ?? { all: hereTopics.length, known: 0 };
  /* „Als Nächstes" im Gebiet: JEDES jetzt lernbare Thema (erst die freien, dann „erst wiederholen"). */
  const readyHere = hereTopics.filter((x) => infoOf(x).band === 'ring')
    .sort((a, b) => Number(infoOf(a).locked) - Number(infoOf(b).locked) || depthOfTopic[a] - depthOfTopic[b] || (tg.graph.rank?.[a] ?? a) - (tg.graph.rank?.[b] ?? b));
  const dueHere = here === null ? dueCards : dueCards.filter((c) => cardEntities(c).some((e) => { const x = topicIndex.get(e); return x !== undefined && here.topics.includes(x); }));
  const regionPanel = (
    <section className="cg-ls-region" data-landscape-region={here?.key ?? ''}>
      <div className="cg-row-between">
        <p className="cg-ls-qtitle"><strong>{here === null ? (baseName || T.wholeMap) : here.name}</strong>{here !== null && conquered.has(here.key) && <> <FlagIcon /></>}</p>
        {writes && viewDoc !== undefined && here !== null && nest === null && editing !== here.key && <button type="button" className="wk-link-btn" onClick={() => setEditing(here.key)} data-landscape-rename="">{T.rename}</button>}
      </div>
      {editing !== null && here !== null && editing === here.key && (
        <RenameBox name={here.name} onSave={(name) => { saveEdits((was) => ({ ...was, names: { ...(was.names ?? {}), [here.key]: { name, topics: here.topics.map((x) => tg.graph.ids[x]) } } })); setEditing(null); }} onCancel={() => setEditing(null)} />
      )}
      <p className="cg-muted cg-ls-numbers" data-landscape-region-topics={hereStats.all}>{T.knownOf(hereStats.known, hereStats.all)}</p>
      {readyHere.length > 0 && (
        <div data-landscape-ready-list={readyHere.length}>
          <p className="cg-ls-qh">{T.nextHere} — {T.nextList(readyHere.length)}</p>
          <ul className="cg-ls-qlist is-scroll">
            {readyHere.slice(0, 10).map((x) => {
              const id = tg.graph.ids[x];
              return (
                <li key={id}>
                  <button type="button" className="cg-ref" onClick={() => selectTopic(id)} data-landscape-ready={id}><TexText text={entityNameTex(lib, id)} /></button>
                  {infoOf(x).locked && <span className="cg-muted"> · {T.nextFirst}</span>}
                </li>
              );
            })}
          </ul>
          {readyHere.length > 10 && <p className="cg-muted">{T.moreN(readyHere.length - 10)}</p>}
        </div>
      )}
      {dueHere.length > 0 && learner !== null && <div className="wk-actions"><button type="button" className="wk-btn wk-btn-line" onClick={() => reviewCards(W.review + ": " + (here?.name ?? baseName), dueHere)} data-landscape-region-review={dueHere.length}>{T.reviewDue(dueHere.length)}</button></div>}
    </section>
  );
  /* Die Figuren auf der Karte: die begonnenen Themen (bis sie gekonnt sind) und eine auf dem Weg zum Ziel (das nächste zu lernende). */
  /* 2026-11-05 (Durchsicht) — der erste offene Schritt, der auf DIESER Karte liegt (ein gefilterter Widok zeigt nicht alle). */
  const goalOnMap = goal === null ? undefined : goalOpen.find((x) => topicIndex.has(x));
  const goalPieceT = goalOnMap === undefined ? null : topicIndex.get(goalOnMap) ?? null;
  const mapPieces: WorldPiece[] = [
    ...storedPieces.map((id) => topicIndex.get(id)).filter((x): x is number => x !== undefined && x !== goalPieceT && worldTopics[x]?.band !== 'known' && worldTopics[x]?.band !== 'due').map((x) => ({ t: x, kind: 'single' as const })),
    ...(goalPieceT === null ? [] : [{ t: goalPieceT, kind: 'goal' as const }])
  ];
  /* Die Legende sagt nur, was gerade gilt. */
  const legend = () => (
    <Legend show={{ land: landCount > 0, glow: readyCount > 0, flag: conquered.size > 0, links: links !== null, piece: mapPieces.some((p) => p.kind === 'single'), goal: goal !== null }} folded={compact || !wide} />
  );

  return host(
    <div className={`cg-ls${compact ? ' is-compact' : ''}${wide ? ' has-side' : ''}`} data-landscape={tg.graph.ids.length} data-landscape-levels={tree.levels} data-landscape-level={viewChain.length}
      data-landscape-ring={readyCount} data-landscape-worker={client?.inWorker === true ? '1' : '0'} data-landscape-ms={stand?.ms.toFixed(1) ?? ''} data-landscape-world-ms={world?.ms.toFixed(0) ?? ''}>
      {(busy || fresh.pending) && <p className="cg-ls-busy" role="status" data-landscape-busy="">{W.computing}</p>}
      <div className="cg-ls-head">
        <div className="cg-ls-headrow">
          <nav className="cg-ls-crumbs" aria-label={W.whereAmI} data-landscape-crumbs={viewChain.length}>
            <button type="button" className="wk-link-btn" disabled={viewChain.length === 0} onClick={whole} data-landscape-up="">{T.wholeMap}</button>
            {viewChain.map((key, i) => (
              <span key={key} className="cg-ls-crumb">
                <span aria-hidden>›</span>
                {i === viewChain.length - 1 ? <strong>{tree.regions.get(key)?.name ?? key}</strong> : <button type="button" className="wk-link-btn" onClick={() => zoomTo(key)}>{tree.regions.get(key)?.name ?? key}</button>}
              </span>
            ))}
          </nav>
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-line" onClick={toMe} data-landscape-me="">{T.toMe}</button>
            <button type="button" className="wk-btn wk-btn-line" onClick={whole} data-landscape-whole="">{T.wholeMap}</button>
          </div>
        </div>
        {nextLine}
        {won !== null && <p className="wk-note cg-ls-conquered" role="status" data-landscape-won={won}>{T.conquered(won)} <button type="button" className="cg-ls-qclose" aria-label={W.close} onClick={() => setWon(null)}>×</button></p>}
        {goalDone !== null && <p className="wk-note" role="status" data-landscape-goal-done={goalDone}>{W.goalDone(labelOf(goalDone))} <button type="button" className="cg-ls-qclose" aria-label={W.close} onClick={() => setGoalDone(null)}>×</button></p>}
        {goal !== null && (
          <p className="cg-ls-goal" data-landscape-goal={goal} data-landscape-goal-steps={goalOpen.length}>
            <span>{W.goal}: <strong><TexText text={entityNameTex(lib, goal)} /></strong> — {T.toGoal(goalOpen.length)}</span>
            <button type="button" className="wk-link-btn" onClick={() => selectTopic(goal)}>{W.show}</button>
            <button type="button" className="wk-link-btn" onClick={() => setGoal(null)} data-landscape-goal-clear="">{W.clearGoal}</button>
          </p>
        )}
      </div>
      {query.trim() !== '' && <SearchHits query={query} ids={tg.graph.ids} bandOf={bandOf} label={labelOf} goal={goal} onShow={selectTopic} onGoal={(id) => { setGoal(id); setSaid(W.goalSet(labelOf(id))); }} />}
      <div className="cg-ls-body">
        <div ref={mainRef} className="cg-ls-main">
          {world !== null && (
            <WorldMap world={world} topics={worldTopics} regionName={regionName} conquered={conquered} chosen={chosenT} flash={flashT} home={next?.t ?? null} links={links} route={routeT}
              width={mapWidth} compact={compact} T={T} memoryKey={`${lib.libraryId}:${viewKey}:${learner === null ? 'me' : holderKey(learner.holder)}`} command={command}
              onPickTopic={pick} onView={setViewChain} onBackground={() => setChosen(null)} legend={legend}
              step={step} pieces={mapPieces} goalFlag={goal === null ? null : topicIndex.get(goal) ?? null}
              onPiece={(x) => { const id = tg.graph.ids[x]; const flow = storyUnit(id); if (flow !== undefined) openStory(flow, false); else learnEntry(id); }}
              onFlag={() => { if (goal !== null) selectTopic(goal); }}
              /* 2026-11-05 — Doppelklick: auf einen Berg — der Weg dorthin beginnt; sonst das Thema selbst. */
              onStart={(x) => { const id = tg.graph.ids[x]; setChosen(id); if (learner === null) return; if (infoById(id).band === 'mountain') leadTo(id); else startTopic(id); }} />
          )}
          {!wide && topicPanel !== null && chosenId !== null && <SheetBox label={labelOf(chosenId)} questKey={chosenId}>{topicPanel}</SheetBox>}
          {!wide && regionPanel}
        </div>
        {wide && (
          <aside className="cg-ls-side" aria-label={W.goal} data-landscape-side="">
            {topicPanel !== null && <div className="cg-ls-quest is-side" role="region" aria-label={chosenId === null ? '' : labelOf(chosenId)} data-landscape-quest={chosenId ?? ''}>{topicPanel}</div>}
            {regionPanel}
          </aside>
        )}
      </div>
      {more}
      <p className="cg-sr" aria-live="polite">{said}</p>
      {!compact && <TopicList topics={worldTopics} onChoose={(x) => selectTopic(tg.graph.ids[x])} />}
    </div>
  );
}

/* -- Die Legende: nur, was gerade gilt; im Engen zu „Legende" gefaltet ------------------------------------------ */

function Legend({ show, folded }: { folded: boolean; show: Readonly<Record<'land' | 'glow' | 'flag' | 'links' | 'piece' | 'goal', boolean>> }) {
  const [open, setOpen] = useState(!folded);
  useEffect(() => { setOpen(!folded); }, [folded]);
  const body = (
    <ul className="cg-ls-legend" data-landscape-legend="">
      <li><span className="cg-ls-legend-tones" aria-hidden><i /><i /><i /><i /></span>{T.legendRegion}</li>
      {show.land && <li data-landscape-legend-mark="land"><span className="cg-ls-legend-line is-land" aria-hidden />{T.legendLandLine}</li>}
      <li data-landscape-legend-height=""><svg className="cg-ls-legend-icon" viewBox="-12 -8 24 16" aria-hidden><path d="M-11,6 L-5,6 L-5,2 L1,2 L1,-2 L7,-2 L7,-6 L11,-6" /></svg>{T.legendHeight}</li>
      {show.glow && <li data-landscape-legend-mark="glow"><span className="cg-ls-legend-line is-ready" aria-hidden />{T.legendReadyLine}</li>}
      {show.piece && <li data-landscape-legend-mark="piece"><svg className="cg-ls-legend-icon" viewBox="-12 -16 24 18" aria-hidden><PieceIcon kind="single" h={15} /></svg>{T.legendPiece}</li>}
      {show.goal && <li data-landscape-legend-mark="goal"><svg className="cg-ls-legend-icon" viewBox="-12 -16 24 18" aria-hidden><g transform="translate(-5,0)"><PieceIcon kind="goal" h={15} /></g><g transform="translate(5,0)"><GoalFlagIcon h={14} /></g></svg>{T.legendGoalPiece}</li>}
      <li data-landscape-legend-mark="ring"><svg className="cg-ls-legend-icon" viewBox="-10 -10 20 20" aria-hidden><path className="cg-ls-legend-ringrest" d="M0,-8 L6.9,-4 L6.9,4 L0,8 L-6.9,4 L-6.9,-4 Z" /><path className="cg-ls-legend-ringdone" d="M0,-8 L6.9,-4 L6.9,4 L0,8" /><circle className="cg-ls-legend-ringdue" cx={0} cy={-8} r={2} /></svg>{T.legendTileRing}</li>
      {show.flag && <li data-landscape-legend-mark="flag"><FlagIcon size={14} />{T.legendFlag}</li>}
      {show.links && <li data-landscape-legend-mark="links"><svg className="cg-ls-legend-icon" viewBox="-12 -8 24 16" aria-hidden><path className="cg-ls-legend-needs" d="M-10,4 Q-4,-6 2,2" /><path className="cg-ls-legend-opens" d="M2,2 Q6,-4 11,-2" /></svg>{T.legendNeeds} · {T.legendOpens}</li>}
    </ul>
  );
  if (!folded) return <div className="cg-ls-legendbox">{body}</div>;
  return (
    <div className="cg-ls-legendbox">
      <button type="button" className="wk-link-btn" aria-expanded={open} onClick={() => setOpen(!open)} data-landscape-legend-toggle="">{T.legend}</button>
      {open && body}
    </div>
  );
}

/* -- Das gewählte Thema: kurz und zum Handeln ------------------------------------------------------------------- */

function TopicPanel({ id, info, missing, missingKnown, opens, story, dueCount, region, canLearn, note, lockCount, bandOf, stepsOf, onLearnNow, onStart, onLead, onShow, onPath, onClose, onRegion, owner, resign }: {
  id: string;
  /** 2026-11-05 — steht hier eine Figur: zurücktreten (`piece`: die eigene geht; `goal`: auch das Ziel wird aufgegeben). */
  resign: { readonly kind: 'piece' | 'goal'; readonly onResign: () => void } | null;
  info: TopicInfo;
  /** Was noch fehlt (in der Reihenfolge des Lernens, was jetzt geht zuerst). */
  missing: readonly string[];
  /** Der Weg ist gerechnet (sonst steht die Liste noch aus). */
  missingKnown: boolean;
  opens: readonly string[];
  story: { readonly parts: number; readonly done: number; readonly stage: StoryStage; readonly first: readonly string[] | null } | null;
  dueCount: number;
  region: { readonly key: string; readonly name: string; readonly all: number; readonly known: number } | null;
  canLearn: boolean;
  note: string | null;
  lockCount: (id: string) => number;
  bandOf: (id: string) => LsBand | null;
  stepsOf: (id: string) => number;
  onLearnNow: (id: string) => void;
  onStart: () => void;
  onLead: () => void;
  onShow: (id: string) => void;
  onPath: () => void;
  onClose: () => void;
  onRegion: (key: string) => void;
  owner: { readonly open?: () => void; readonly move?: { readonly options: readonly { readonly key: string; readonly name: string }[]; readonly current: string | null; readonly onMove: (key: string) => void }; readonly rename?: { readonly name: string; readonly onSave: (name: string) => void } } | null;
}) {
  const { lib } = useCtx();
  const [renaming, setRenaming] = useState(false);
  const band = info.band ?? 'mountain';
  /* Der Stand in einem Satz. */
  const sentence = band === 'known' ? T.stKnown : band === 'due' ? T.stDue(Math.max(1, dueCount)) : band === 'ring' ? (info.locked ? T.stLocked(lockCount(id)) : T.stReady) : T.stMissing(Math.max(1, missing.length));
  const rowState = (x: string) => { const b = bandOf(x); return b === 'ring' ? T.rowReady : T.rowMissing(Math.max(1, stepsOf(x) - 1)); };
  return (
    <div className="cg-ls-q" data-landscape-topic={id}>
      <div className="cg-ls-qtop">
        <p className="cg-ls-qtitle"><strong><TexText text={entityNameTex(lib, id)} /></strong></p>
        {owner !== null && (
          <details className="cg-ls-more" data-landscape-owner="">
            <summary aria-label={T.ownerTools} title={T.ownerTools}>⋯</summary>
            <div className="cg-ls-more-body">
              {owner.open !== undefined && <button type="button" className="wk-link-btn" onClick={owner.open} data-landscape-open="">{W.openEntry}</button>}
              {owner.rename !== undefined && (renaming
                ? <RenameBox name={owner.rename.name} onSave={(name) => { owner.rename!.onSave(name); setRenaming(false); }} onCancel={() => setRenaming(false)} />
                : <button type="button" className="wk-link-btn" onClick={() => setRenaming(true)} data-landscape-rename-region="">{T.rename}: {owner.rename.name}</button>)}
              {owner.move !== undefined && owner.move.options.length > 1 && (
                <label className="wk-field" data-landscape-move="">
                  <span>{T.moveTo}</span>
                  <select value={owner.move.current ?? ''} onChange={(e) => { if (e.target.value !== '') owner.move!.onMove(e.target.value); }}>
                    {owner.move.options.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
                  </select>
                </label>
              )}
            </div>
          </details>
        )}
        <button type="button" className="cg-ls-qclose" aria-label={W.close} onClick={onClose} data-landscape-quest-close="">×</button>
      </div>
      <p className="cg-ls-qstate" data-landscape-state={band}>{sentence}</p>
      {band === 'mountain' && missingKnown && missing.length > 0 && (
        <div data-landscape-missing={missing.length}>
          <p className="cg-ls-qh">{T.needFirst}</p>
          <ul className="cg-ls-need">
            {missing.slice(0, 5).map((x) => (
              <li key={x} className={bandOf(x) === 'ring' ? 'is-ready' : ''} data-landscape-missing-item={x}>
                <button type="button" className="cg-ref" onClick={() => onShow(x)}><TexText text={entityNameTex(lib, x)} /></button>
                <span className="cg-muted">{rowState(x)}</span>
                {canLearn && bandOf(x) === 'ring' && <button type="button" className="wk-btn wk-btn-line is-small" onClick={() => onLearnNow(x)} data-landscape-learn-now={x}>{T.learnNow}</button>}
              </li>
            ))}
          </ul>
          {missing.length > 5 && <p className="cg-muted">{T.moreN(missing.length - 5)}</p>}
        </div>
      )}
      {canLearn && (
        <div className="wk-actions">
          {band === 'mountain' && <button type="button" className="wk-btn" onClick={onLead} data-landscape-lead="">{T.leadMe}</button>}
          {band === 'ring' && <button type="button" className="wk-btn" onClick={onStart} data-landscape-learn="">{info.locked ? W.reviewFirst(lockCount(id)) : story !== null ? T.storyButton(story.stage) : T.startIt}</button>}
          {(band === 'due' || band === 'known') && <button type="button" className={band === 'due' ? 'wk-btn' : 'wk-btn wk-btn-line'} onClick={onStart} data-landscape-review="">{story !== null && band === 'known' ? T.storyButton(story.stage) : T.reviewIt}</button>}
          {resign !== null && <button type="button" className="wk-link-btn" onClick={resign.onResign} data-landscape-resign={resign.kind}>{resign.kind === 'goal' ? T.resignGoal : T.resignPiece}</button>}
        </div>
      )}
      {!canLearn && band !== 'mountain' && <p className="cg-muted">{W.canLearnNote}</p>}
      {note !== null && <p className="wk-note" role="status">{note}</p>}
      {opens.length > 0 && (
        <details className="cg-ls-opens" data-landscape-unlocks={opens.length}>
          <summary>{T.opensNext(opens.length)}</summary>
          <ul className="cg-ls-qlist is-scroll">{opens.map((x) => <li key={x}><button type="button" className="cg-ref" onClick={() => onShow(x)}><TexText text={entityNameTex(lib, x)} /></button></li>)}</ul>
        </details>
      )}
      {story !== null && (
        <p className="cg-muted cg-ls-storyline" data-landscape-story={story.stage}>{T.storyLine(story.parts, story.done)} · <button type="button" className="wk-link-btn" onClick={onPath} data-landscape-show-path="">{T.showPath}</button>{story.first !== null && story.first.length > 0 && <> · <span data-landscape-story-first="">{W.storyFirst(story.first.map((n) => `„${n}”`).join(', '))}</span></>}</p>
      )}
      {region !== null && <p className="cg-muted cg-ls-regionline"><button type="button" className="wk-link-btn" onClick={() => onRegion(region.key)} data-landscape-topic-region={region.key}>{T.regionLine(region.name, region.all, region.known)}</button></p>}
    </div>
  );
}

function RenameBox({ name, onSave, onCancel }: { name: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(name);
  return (
    <form className="cg-ls-rename" onSubmit={(e) => { e.preventDefault(); if (value.trim() !== '') onSave(value.trim()); }} data-landscape-rename-box="">
      <input value={value} onChange={(e) => setValue(e.target.value)} aria-label={T.rename} />
      <button type="submit" className="wk-btn">{T.save}</button>
      <button type="button" className="wk-link-btn" onClick={onCancel}>{T.cancel}</button>
    </form>
  );
}

/** Dieselben Themen als Liste — für Vorleser, und für wer lieber liest als schaut. */
function TopicList({ topics, onChoose }: { topics: readonly WorldTopic[]; onChoose: (t: number) => void }) {
  const groups: { band: LsBand; title: string }[] = [
    { band: 'ring', title: W.listBands[0] }, { band: 'due', title: W.listBands[1] },
    { band: 'mountain', title: W.listBands[2] }, { band: 'known', title: W.listBands[3] }
  ];
  /* 2026-11-05 (Durchsicht) — die Liste erst, wenn sie offen ist (5 000 Themen sortiert man nicht bei jeder Zeichnung). */
  const [open, setOpen] = useState(false);
  const sorted = useMemo(() => {
    if (!open) return null;
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' });
    return groups.map((g) => topics.map((x, i) => ({ x, i })).filter(({ x }) => x.band === g.band).sort((a, b) => a.x.steps - b.x.steps || collator.compare(a.x.label, b.x.label)).slice(0, 400));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, topics]);
  return (
    <details className="cg-ls-list" data-landscape-list="" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>{W.asList(topics.length)}</summary>
      {sorted !== null && groups.map((g, k) => {
        const of = sorted[k] ?? [];
        if (of.length === 0) return null;
        return (
          <section key={g.band}>
            <h5>{g.title} <span className="cg-muted">({of.length})</span></h5>
            <ul>{of.map(({ x, i }) => <li key={x.id}><button type="button" className="cg-ref" onClick={() => onChoose(i)}>{x.label}</button></li>)}</ul>
          </section>
        );
      })}
    </details>
  );
}

/** Am Telefon: die Einzelheiten des gewählten Themas als Blatt am unteren Rand (höchstens die halbe Höhe). */
function SheetBox({ label, questKey, children }: { label: string; questKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    document.body.style.setProperty('padding-bottom', `${Math.ceil(el.offsetHeight)}px`);
    return () => { document.body.style.removeProperty('padding-bottom'); };
  }, [questKey]);
  /* Im Baum der Ansicht (dieselbe Schrift, dieselben Farben) — fest am unteren Rand. */
  return <div ref={ref} className="cg-ls-quest is-sheet" role="dialog" aria-label={label} data-landscape-quest={questKey}>{children}</div>;
}

/* -- Masse ---------------------------------------------------------------------------------------------------- */

function useWidth(initial = 0): [(el: HTMLDivElement | null) => void, number] {
  /* 2026-11-05 (Durchsicht) — über das Element selbst: erscheint es später (erst „Wczytywanie“), wird es dann gemessen. */
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    if (el === null) return undefined;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(el);
    return () => watch?.disconnect();
  }, [el]);
  return [setEl, width];
}

/** Treffer der Suche: zeigen — oder als Ziel. */
function SearchHits({ query, ids, bandOf, label, goal, onShow, onGoal }: {
  query: string; ids: readonly string[]; bandOf: (id: string) => LsBand | null; label: (id: string) => string; goal: string | null;
  onShow: (id: string) => void; onGoal: (id: string) => void;
}) {
  const { lib } = useCtx();
  const hits = useMemo(() => {
    const known = new Set(ids);
    const term = query.trim().toLowerCase();
    const found = lib.search(query).filter((e) => known.has(e.id)).map((e) => e.id);
    const more = term === '' ? [] : ids.filter((id) => !found.includes(id) && label(id).toLowerCase().includes(term));
    return [...found, ...more].filter((id) => bandOf(id) !== null).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, ids, lib, lib.revision]);
  if (hits.length === 0) return <p className="cg-muted" data-landscape-hits="0">{T.nothingFound}</p>;
  return (
    <ul className="cg-ls-hits" data-landscape-hits={hits.length} aria-label={T.hits}>
      {hits.map((id) => {
        const b = bandOf(id);
        return (
          <li key={id}>
            <button type="button" className="cg-ref" onClick={() => onShow(id)} data-landscape-hit={id}><TexText text={entityNameTex(lib, id)} /></button>
            <span className="cg-muted"> {b === null ? '' : b === 'mountain' ? W.behind : b === 'ring' ? W.ready : b === 'due' ? W.due : W.known}</span>
            {(b === 'ring' || b === 'mountain') && goal !== id && <button type="button" className="wk-link-btn" onClick={() => onGoal(id)} data-landscape-hit-goal={id}>{W.setGoal}</button>}
            {goal === id && <span className="cg-muted"> · {W.goal}</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** Für Prüfungen: die Kenntnis eines Lernenden über die Karten der Baza (wie oben gerechnet). */
export type LandscapeGauge = Gauge;
