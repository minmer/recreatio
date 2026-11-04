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

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';

import type { Card } from './cardBasics';
import { cardKnowness, factsOf, gaugeFromMarks, withFlows, type Gauge } from './knowing';
import { learnerFlows, reviewStart, storyStage, type StoryStage } from './flowFacts';
import { BAND_CODE, liftOf, type LsBand, type LsInput, type LsStand, type LsState } from './landscape';
import { landscapeClient, type LandscapeClient } from './landscapeClient';
import { landscapeInput, landscapeState, lockCards } from './landscapeData';
import { answeredCards, renamer, type Learner } from './learn';
import { gaugeKnow, pathOfEntries, unitMembers } from './PathLearn';
import { readNest } from './landscapeNest';
import { cardEntities, cardsAbout, questionIds } from './prerequisites';
import { readFlow, resolveFlow, type Flow } from './flow';
import { contentOfLibrary, FlowPlayer, storyPathOf } from './FlowPlayer';
import { decideBy } from './runningStory';
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
import { landscapeWords, type LandscapeWords } from './landscapeWords';
import { gateAnglesFor, groundOf, layoutLevel, levelItems, nestAsRegions, regionPath, topicGraphOf, type LevelItem, type LevelLayout, type TopicGraph } from './levelMap';
import { RegionMap, SignIcon, type MapCommand, type MapField, type MapGate, type MapRoute } from './RegionMap';
import type { RegionTree } from './regions';
import './landscape.css';

/* -- Worte -------------------------------------------------------------------------------------------------------- */

/** Die Worte der Baza — gesetzt am Anfang jeder Zeichnung; alles darunter zeichnet im selben Durchgang. */
let W: Words = words('pl');
let T: LandscapeWords = landscapeWords('pl');


/** Der Stand eines Themas in Worten. */
function stateWords(band: LsBand, steps: number, locked: boolean): string {
  if (band === 'ring') return locked ? `${W.ready} — ${W.reviewFirstState}` : W.ready;
  if (band === 'mountain') return T.nextAway(steps);
  if (band === 'due') return W.due;
  return W.youKnow;
}

/* -- Daten ------------------------------------------------------------------------------------------------------- */

/** Der Stand je Knoten aus dem Motor — der Graph nur, wenn er neu ist; der Stand nach jeder Antwort; veraltetes verworfen. */
function useStand(client: LandscapeClient | null, input: LsInput, state: LsState): { stand: LsStand | null; failed: string | null; pending: boolean } {
  const [stand, setStand] = useState<LsStand | null>(null);
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
      .then((r) => { if (my === seq.current) { setStand(r); setFailed(null); setPending(false); } }, (e: unknown) => { if (my === seq.current) { setFailed(e instanceof Error ? e.message : String(e)); setPending(false); } });
  }, [client, input, state]);
  return { stand, failed, pending };
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
}

export function LandscapeView({ view, cards, learner, onOpen, compact = false, rewards = null, query = '', viewKey, more, urlScope, busy = false }: LandscapeProps) {
  const { lib, writes, name: baseName } = useCtx();
  const lang = baseLang(lib);
  W = words(lang);
  T = landscapeWords(lang);
  const [sideEl, setSideEl] = useState<HTMLElement | null>(null);
  const [goalDone, setGoalDone] = useState<string | null>(null);
  const keep = useKept(`${lib.libraryId}:${viewKey}:${compact ? 'small' : 'big'}`, urlScope ?? null);
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  const fp = useMemo(() => new Map(cards.map((c) => [c.key, c.fingerprint] as const)), [cards]);
  const [running, setRunning] = useState<Running | null>(null);
  const progress = learner?.progress;
  /* Während eines Laufs hier drin ruht die Rechnung — danach einmal. */
  const live = running === null ? progress : null;
  const flows = useMemo(() => learnerFlows(lib, learner?.progress.positions), [lib, lib.revision, learner, live]); // eslint-disable-line react-hooks/exhaustive-deps
  const gauge = useMemo(() => withFlows(gaugeFromMarks([...cards, ...(learner === null ? [] : answeredCards(learner.progress, new Set(fp.keys())))], (key) => learner?.marks(key, fp.get(key), rename) ?? [], lib.dependencies(), Date.now(), lib.prerequisites()), flows), [cards, learner, live, fp, rename, lib, lib.revision, flows]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const state = useMemo(() => landscapeState(input, gauge, lowered), [input, gauge, lowered]);
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
  useEffect(() => { if (boxWidth > 0) keep.mem.width = boxWidth; }, [boxWidth, keep.mem]);

  /* Der Stand je Knoten (im Worker); bis er da ist, der letzte. */
  const fresh = useStand(client, input, state);
  useEffect(() => { if (fresh.stand !== null) keep.mem.stand = fresh.stand; }, [fresh.stand, keep.mem]);
  const stand = fresh.stand ?? keep.mem.stand;
  const standFits = stand !== null && stand.band.length === input.ids.length;

  /* Die Gebiete: aus den Verbindungen (im Worker, einmal je Baza), oder aus den Daten (`nest`). Was der Besitzer geändert hat,
     steht im gespeicherten Widok (gleich nach dem Speichern, auch wenn der Gastgeber noch seine Abschrift zeigt). */
  const savedView = lib.docs('view').find((d) => d.id === viewKey);
  const editsNow = (savedView === undefined ? null : readLandscape((savedView.data as Record<string, unknown>).landscape)?.regions) ?? view.landscape?.regions;
  const editsJson = JSON.stringify(editsNow ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- dieselben Wünsche: dasselbe Objekt (sonst rechnete jede Zeichnung neu)
  const edits = useMemo(() => editsNow, [editsJson]);
  const movesKey = JSON.stringify(edits?.moves ?? null);
  const [computed, setComputed] = useState<{ key: string; tree: RegionTree } | null>(null);
  const [regionsFailed, setRegionsFailed] = useState<string | null>(null);
  const treeKey = `${graphKey(tg)}:${movesKey}:${lang}`;
  /*
    Damit die Gebiete bleiben, wenn sich die Baza ändert (Schlüssel, Namen, Plätze, das Gefühl, wo man ist): die letzte
    Zuordnung dieses Browsers geht mit (`previous`) — ohne die verschobenen Themen (sie folgen den Wünschen des Besitzers).
  */
  const regionsMemKey = `cg-ls-regions:${lib.libraryId}:${viewKey}`;
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
    void client.regions({ key: treeKey, graph: tg.graph, lang, ...(edits?.moves === undefined ? {} : { overrides: { moves: edits.moves } }), ...(previous === undefined ? {} : { previous }) })
      .then((tree) => {
        if (!alive) return;
        setComputed({ key: treeKey, tree });
        setRegionsFailed(null);
        try { localStorage.setItem(regionsMemKey, JSON.stringify({ moves: edits?.moves ?? {}, assignment: tree.assignment })); } catch { /* zu gross oder ohne Speicher */ }
      }, (e: unknown) => { if (alive) setRegionsFailed(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [client, treeKey, nest]); // eslint-disable-line react-hooks/exhaustive-deps
  const tree = useMemo((): RegionTree | null => {
    if (nest !== null) return nestAsRegions(nest, tg, T.otherTopics, T.wholeMap);
    if (computed === null) return null;
    return withOwnerNames(computed.tree, tg, edits);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nest, tg, computed, edits, lang]);

  /* Eine Ebene (gemerkt je Baum): ihre Felder und Tore, aus der Struktur. */
  const layoutFor = useMemo(() => {
    const cache = new Map<string, LevelLayout>();
    const fn = (open: string | null): LevelLayout => {
      const k = open ?? '';
      const had = cache.get(k);
      if (had !== undefined) return had;
      const empty: LevelLayout = { open, items: [], place: [], edges: [], depth: [], gates: [], gateEdges: [], rings: 0 };
      if (tree === null) return empty;
      const items = levelItems(tree, open, tg);
      const made = layoutLevel(items, tg, tree, open, gateAnglesFor(tree, open, fn));
      cache.set(k, made);
      return made;
    };
    return fn;
  }, [tree, tg]);

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

  const labelOf = (id: string): string => { const e = lib.entity(id); return e === undefined ? id : lib.label(e); };
  const inputIndex = useMemo(() => new Map(input.ids.map((id, i) => [id, i] as const)), [input]);
  const infoOfNode = (v: number | undefined): TopicInfo => {
    if (v === undefined || !standFits || stand === null) return { band: null, steps: 0, locked: false, known: 0, total: 0 };
    const band = BAND_CODE[stand.band[v]] ?? null;
    return { band, steps: band === null ? 0 : liftOf(band, stand.missing[v]), locked: stand.locked[v] === 1, known: Number(state.cardsKnown?.[v] ?? 0), total: Number(state.cardsTotal?.[v] ?? 0) };
  };
  const infoOf = (t: number): TopicInfo => infoOfNode(tg.node[t]);
  const infoById = (id: string): TopicInfo => infoOfNode(inputIndex.get(id));
  const bandOf = (id: string): LsBand | null => infoById(id).band;
  useEffect(() => {
    if (goal === null || !standFits) return;
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

  /* Das offene Gebiet: aus der Adresse — gibt es es nicht (mehr), die oberste Ebene; beim ersten Öffnen der nächste Schritt. */
  const openRaw = keep.focus[0] ?? null;
  const open = tree !== null && openRaw !== null && tree.regions.has(openRaw) ? openRaw : null;
  /* Beim Öffnen beim nächsten Schritt — und ihm folgen (der Stand kommt nach und nach), bis der Lernende selbst geht. */
  const follow = useRef(!keep.started);
  const nav = (focus: readonly string[], chosenToo: string | null = null) => { follow.current = false; keep.setFocus(focus, chosenToo); };
  useEffect(() => {
    if (!follow.current || tree === null || !standFits || next === null) return;
    const leaf = tree.leafOf[next.t];
    if (leaf !== null && leaf !== undefined && leaf !== (keep.focus[0] ?? null)) keep.setFocus([leaf], null, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, standFits, next]);
  const layout = layoutFor(open);

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
  useEffect(() => { setRouteShown(null); }, [chosenId]);
  const goalOpen = goalSteps.filter((x) => { const b = bandOf(x); return b !== 'known' && b !== 'due'; });

  /* Erobertes: einmal gesagt, wenn es neu ist. */
  const [won, setWon] = useState<string | null>(null);
  const wonKey = `cg-ls-won:${lib.libraryId}:${viewKey}:${learner?.holder ?? 'me'}`;

  const [note, setNote] = useState<string | null>(null);
  const [said, setSaid] = useState('');
  const [command, setCommand] = useState<MapCommand | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  /* -- Lernen ------------------------------------------------------------------------------------------- */
  const planFrom = async (graph: Graph): Promise<Plan | null> => {
    const ctx = lib.revisionContext(cards, (key) => learner?.marks(key, fp.get(key), rename) ?? [], Date.now(), flows);
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
    const groups = lockCards(gauge, lib.prerequisites(), id, cards);
    const list = groups.flatMap((g) => g.cards).filter((c) => !(learner?.progress.suspended.has(c.key) ?? false));
    const nextUp = after ?? (() => learnEntry(id));
    if (list.length === 0) { nextUp(); return; }
    const plan = readPlan(list, { mode: 'temporal', order: 'general', pick: 'next', stackSize: 20, endWhenDone: true });
    setRunning({ key: `review:${id}:${Date.now()}`, source: { plan, cards, title: `${W.reviewFirstWhat}: ${labelOf(id)}` }, then: nextUp, origin: id });
  };
  const lockNames = (id: string): string[] => lockCards(gauge, lib.prerequisites(), id, cards).map((g) => g.entry);
  const lockCount = (id: string): number => lockCards(gauge, lib.prerequisites(), id, cards).reduce((s, g) => s + g.cards.length, 0);
  const storyUnit = (id: string): Flow | undefined => (gauge.testing.has(id) ? undefined : storyOf(id));
  const openStory = (flow: Flow, review: boolean) => {
    const find = (x: string) => { const d = lib.docs('flow').find((one) => one.id === x); return d === undefined ? undefined : readFlow(d.id, d.data); };
    const full = resolveFlow(flow, find);
    const at = review ? reviewStart(full) : null;
    setRunning({ key: `story:${full.id}:${Date.now()}`, story: full, jump: at === null ? null : { step: at, at: Date.now() } });
  };
  const openTopic = (id: string) => { const flow = storyOf(id); if (flow !== undefined && !gauge.testing.has(id)) { setRunning(null); window.setTimeout(() => openStory(flow, false), 0); return; } learnEntry(id); };
  const closingFor = (origin: string | null) => ({
    origin, goal: goalSteps.length > 0 ? goalSteps : null, label: labelOf, openTopic,
    others: () => setRunning(null), back: () => setRunning(null)
  });
  /* Ein Thema zeigen: in sein Gebiet, gewählt, die Karte bei ihm. */
  const showTopic = (id: string) => {
    const t = topicIndex.get(id);
    const leaf = t === undefined || tree === null ? null : tree.leafOf[t] ?? null;
    if (leaf !== null && leaf !== open) nav([leaf], id); else { follow.current = false; setChosen(id); }
    setCommand({ kind: 'focus', at: Date.now() });
  };

  /* Die Namen und Wünsche des Besitzers speichern (im Widok: sie gelten für jeden, der ihn sieht). */
  const viewDoc = lib.docs('view').find((d) => d.id === viewKey);
  const saveEdits = (patch: (was: LandscapeRegionEdits) => LandscapeRegionEdits) => {
    if (viewDoc === undefined) return;
    const data = viewDoc.data as Record<string, unknown>;
    const ls = (typeof data.landscape === 'object' && data.landscape !== null ? data.landscape : {}) as Record<string, unknown>;
    const was = (edits ?? {}) as LandscapeRegionEdits;
    void lib.saveDoc('view', { ...data, landscape: { ...ls, regions: patch(was) } }, viewDoc.id).catch((e: unknown) => setNote(e instanceof Error ? e.message : String(e)));
  };

  /* -- Die Felder der offenen Ebene ---------------------------------------------------------------------- */
  const nextItem = next === null ? -1 : layout.items.findIndex((it) => it.topics.includes(next.t));
  const goalT = goal === null ? undefined : topicIndex.get(goal);
  const aggregate = (it: LevelItem) => {
    let learned = 0; let due = 0; let ready = 0; let lockedReady = 0; let minSteps = Number.POSITIVE_INFINITY; let known = 0; let total = 0;
    for (const t of it.topics) {
      const i = infoOf(t);
      known += i.known;
      total += i.total;
      if (i.band === 'known' || i.band === 'due') { learned += 1; if (i.band === 'due') due += 1; continue; }
      if (i.band === 'ring') { if (i.locked) lockedReady += 1; else ready += 1; }
      if (i.band !== null) minSteps = Math.min(minSteps, i.steps);
    }
    const all = it.topics.length;
    const band: LsBand = learned === all ? (due > 0 ? 'due' : 'known') : ready + lockedReady > 0 ? 'ring' : 'mountain';
    return { learned, due, ready, lockedReady, steps: learned === all ? 0 : Number.isFinite(minSteps) ? minSteps : 1, band, share: total === 0 ? learned / Math.max(1, all) : known / total, all };
  };
  const fields: MapField[] = layout.items.map((it, i) => {
    const p = layout.place[i];
    const subject = colourOf(it.topics);
    if (it.kind === 'topic') {
      const t = it.topics[0];
      const info = infoOf(t);
      const band = info.band ?? 'mountain';
      const sign = band === 'ring' && info.locked ? 'first' as const : band === 'due' ? 'due' as const : null;
      return {
        key: it.key, kind: 'topic', label: it.label, title: `${it.label}: ${stateWords(band, info.steps, info.locked)}`, x: p.x, y: p.y, steps: info.steps, band, sign, subject,
        share: info.total === 0 ? (band === 'known' ? 1 : 0) : info.known / info.total, glow: band === 'ring' && !info.locked, conquered: false, home: i === nextItem,
        badge: goal === it.key && goalOpen.length > 0 ? goalOpen.length : null
      };
    }
    const a = aggregate(it);
    const sign = a.ready === 0 && a.lockedReady > 0 ? 'first' as const : a.due > 0 ? 'due' as const : null;
    /* Eine leise Vorschau der Ebene darunter: wo ihre Felder stehen und wie weit sie sind. */
    const inner = layoutFor(it.key);
    let r = 0;
    const cx = inner.place.reduce((s, q) => s + q.x, 0) / Math.max(1, inner.place.length);
    const cy = inner.place.reduce((s, q) => s + q.y, 0) / Math.max(1, inner.place.length);
    for (const q of inner.place) r = Math.max(r, Math.hypot(q.x - cx, q.y - cy));
    const preview = inner.items.length <= 24 ? inner.items.map((sub, j) => {
      const q = inner.place[j];
      const b = sub.kind === 'topic' ? infoOf(sub.topics[0]).band ?? 'mountain' : aggregate(sub).band;
      return { x: r === 0 ? 0 : (q.x - cx) / r, y: r === 0 ? 0 : -(q.y - cy) / r, band: b };
    }) : [];
    const state2 = a.learned === a.all ? T.conquered(it.label) : a.ready > 0 ? `${a.ready} ${W.ready}` : a.lockedReady > 0 ? T.nextFirst : T.nextAway(a.steps);
    return {
      key: it.key, kind: 'region', label: it.label, title: `${it.label} · ${T.themen(a.all)} · ${state2}`, x: p.x, y: p.y, steps: a.steps, band: a.band, sign, subject,
      share: a.share, glow: a.ready > 0, conquered: a.learned === a.all, home: i === nextItem, preview,
      badge: goalT !== undefined && it.topics.includes(goalT) && goalOpen.length > 0 ? goalOpen.length : null
    };
  });
  const gates: MapGate[] = layout.gates.map((g) => ({ key: g.key, label: g.label, x: g.x, y: g.y, before: g.before, after: g.after }));
  const ground = useMemo(() => groundOf(layout), [layout]);
  /* Erobert: neu seit dem letzten Mal? */
  const wonNow = fields.filter((f) => f.conquered).map((f) => f.key).sort().join('|');
  useEffect(() => {
    if (!standFits || tree === null) return;
    let had: string[] = [];
    let first = false;
    try { const raw = localStorage.getItem(wonKey); if (raw === null) first = true; else had = JSON.parse(raw) as string[]; } catch { first = true; }
    const now = fields.filter((f) => f.conquered && f.kind === 'region').map((f) => f.key);
    const fresh2 = now.filter((k) => !had.includes(k));
    if (fresh2.length > 0 && !first) setWon(fields.find((f) => f.key === fresh2[0])?.label ?? null);
    try { localStorage.setItem(wonKey, JSON.stringify([...new Set([...had, ...now])].slice(-400))); } catch { /* ohne Speicher */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wonNow, standFits]);

  /* Der Weg auf dieser Ebene: jedes Thema der Liste auf sein Feld hier (ein Gebiet nimmt alle seine), doppelte zusammen. */
  const routeIds: readonly string[] | null = routeShown !== null && routeOf !== null && routeOf.id === routeShown ? routeOf.list.filter((x) => { const b = bandOf(x); return b !== 'known' && b !== 'due'; })
    : goal !== null && goalOpen.length > 0 ? goalOpen : null;
  const mapRoute = useMemo((): MapRoute | null => {
    if (routeIds === null || routeIds.length === 0) return null;
    const owner = new Map<number, string>();
    layout.items.forEach((it) => { for (const t of it.topics) owner.set(t, it.key); });
    const keyOf = (id: string) => { const t = topicIndex.get(id); return t === undefined ? undefined : owner.get(t); };
    const long = routeIds.length > 8;
    const drawn = long ? [...routeIds.slice(0, 5), routeIds[routeIds.length - 1]] : [...routeIds];
    const keys: string[] = [];
    for (const id of drawn) { const k = keyOf(id); if (k !== undefined && keys[keys.length - 1] !== k) keys.push(k); }
    const rest = long ? [...new Set(routeIds.slice(5, -1).map(keyOf).filter((k): k is string => k !== undefined && !keys.includes(k)))] : [];
    return { keys, rest };
  }, [routeIds, layout, topicIndex]);

  /* Immer in einer Hülle, deren Breite gemessen wird. */
  const host = (body: ReactNode) => <div ref={boxRef} className="cg-ls-host">{body}</div>;
  if (running !== null) {
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
  /* Eine Einheit, die eine Erzählung ist: ihre Ścieżka ist die der Erzählung. */
  const storyPath = (id: string) => {
    const flow = storyOf(id);
    if (flow === undefined || flow.graph.nodes.length === 0) return null;
    const content = contentOfLibrary(lib, cards);
    /* 2026-11-04 (Prompt 11) — wie im Spieler: ein Warunek, der für diesen Lernenden entschieden ist, zeigt nur seinen Weg. */
    const decide = learner === null ? undefined : decideBy({ ...factsOf(gauge, () => []), flow: (ref: string) => flows.get(content.flowRef?.(ref) ?? ref) });
    const sp = storyPathOf(flow, content, decide);
    const kept = learner?.progress.positions.get(flow.id);
    const known = gaugeKnow(gauge);
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

  /* -- Navigation ---------------------------------------------------------------------------------------- */
  const path = regionPath(tree, open);
  const goUp = () => { const parent = open === null ? null : tree.regions.get(open)?.parent ?? null; nav(parent === null ? [] : [parent]); };
  const enter = (key: string) => { nav([key]); setSaid(T.goIn); };
  const choose = (key: string) => {
    const f = fields.find((x) => x.key === key);
    if (f === undefined) return;
    if (f.kind === 'region') { enter(key); return; }
    follow.current = false;
    setChosen(chosen === key ? null : key);
  };
  const toMe = () => {
    if (next === null) { setCommand({ kind: 'fit', at: Date.now() }); return; }
    const leaf = tree.leafOf[next.t] ?? null;
    if (leaf !== null && leaf !== open) nav([leaf]); else setChosen(null);
    setCommand({ kind: 'focus', at: Date.now() });
  };
  const whole = () => { if (open !== null) nav([]); else follow.current = false; setCommand({ kind: 'fit', at: Date.now() }); };

  /* -- Was die Seitenleiste zeigt ------------------------------------------------------------------------- */
  const wide = !compact && boxWidth >= 860;
  const mapWidth = wide ? Math.max(320, boxWidth - 352) : boxWidth;
  const nextName = next === null ? null : tg.graph.labels[next.t];
  const nextHere = nextItem >= 0 ? layout.items[nextItem] : null;
  const regionsHere = layout.items.filter((it) => it.kind === 'region');
  const conqueredHere = fields.filter((f) => f.kind === 'region' && f.conquered).length;
  const knownHere = fields.filter((f) => f.kind === 'topic' && (f.band === 'known' || f.band === 'due')).length;
  const nextLine = (
    <div className="cg-ls-next" data-landscape-next={next === null ? '' : tg.graph.ids[next.t]} data-landscape-due={dueCards.length}>
      <p>
        {next === null ? T.nothingNext : (
          <>
            <strong>{T.nextIs}:</strong>{' '}
            {nextHere !== null && nextHere.kind === 'region' ? <>{nextHere.label} ({T.nextReady})</> : <><TexText text={nextName ?? ''} /> ({next.first ? T.nextFirst : T.nextReady})</>}
          </>
        )}
        {dueCards.length > 0 && <span className="cg-muted"> · {T.dueCards(dueCards.length)}</span>}
      </p>
      <div className="wk-actions">
        {next !== null && learner !== null && (nextHere !== null && nextHere.kind === 'region'
          ? <button type="button" className="wk-btn" onClick={() => enter(nextHere.key)} data-landscape-next-go="">{T.goIn}: {nextHere.label}</button>
          : next.first
            ? <button type="button" className="wk-btn" onClick={() => reviewFirst(tg.graph.ids[next.t])} data-landscape-next-go="first">{W.reviewFirst(lockCount(tg.graph.ids[next.t]))}</button>
            : <button type="button" className="wk-btn" onClick={() => { const id = tg.graph.ids[next.t]; const flow = storyUnit(id); if (flow !== undefined) openStory(flow, false); else learnEntry(id); }} data-landscape-next-go="learn">{T.learnIt(nextName ?? '')}</button>)}
        {next !== null && nextHere === null && <button type="button" className="wk-btn wk-btn-line" onClick={toMe} data-landscape-to-me="">{T.toMe}</button>}
        {dueCards.length > 0 && learner !== null && <button type="button" className="wk-btn wk-btn-line" onClick={() => reviewCards(T.dueCards(dueCards.length), dueCards)} data-landscape-review-due={dueCards.length}>{T.reviewDue(dueCards.length)}</button>}
      </div>
    </div>
  );
  const chosenField = chosenId === null ? undefined : fields.find((f) => f.key === chosenId);
  const topicPanel = chosenId !== null ? (
    <TopicPanel id={chosenId} info={infoById(chosenId)} route={routeOf !== null && routeOf.id === chosenId ? routeOf.list : null} goal={goal}
      story={(() => { const flow = storyUnit(chosenId); return flow === undefined ? null : { stage: stageOf(flow), open: (review: boolean) => openStory(flow, review) }; })()}
      unitSize={unitTopics(chosenId).length} canLearn={learner !== null} note={note} lockNames={lockNames} lockCount={lockCount} bandOf={bandOf}
      unlocks={(tg.graph.ids.map((x, u) => ((tg.graph.needs[u] ?? []).includes(topicIndex.get(chosenId)!) ? x : null)).filter((x): x is string => x !== null))}
      questions={[...new Set(cards.filter((c) => c.template === undefined && (c.about ?? []).includes(chosenId)).map((c) => c.entity ?? c.question))]}
      routeShown={routeShown === chosenId} onRoute={(on) => setRouteShown(on ? chosenId : null)}
      onLearn={learnEntry} onReview={(id, band) => learnEntry(id, band !== 'known')} onReviewFirst={(id) => { const flow = storyUnit(id); reviewFirst(id, flow === undefined ? undefined : () => openStory(flow, false)); }}
      onGoal={(id, on) => { setGoal(on ? id : null); setSaid(on ? W.goalSet(labelOf(id)) : W.goalCleared); }} onUnit={(id) => keep.setUnit(id)} onShow={showTopic}
      onClose={() => setChosen(null)} {...(onOpen === undefined ? {} : { onOpen })}
      move={writes && nest === null && tree.levels > 0 ? {
        options: [...tree.regions.values()].filter((r) => r.level === 1).map((r) => ({ key: r.key, name: r.name })).sort((a, b) => a.name.localeCompare(b.name, lang)),
        current: tree.leafOf[topicIndex.get(chosenId)!] ?? null,
        onMove: (key) => saveEdits((was) => ({ ...was, moves: { ...(was.moves ?? {}), [chosenId]: key } }))
      } : null} />
  ) : null;
  const here = open === null ? null : tree.regions.get(open) ?? null;
  const parentLayout = open === null ? null : layoutFor(tree.regions.get(open)?.parent ?? null);
  const at = parentLayout === null || open === null ? -1 : parentLayout.items.findIndex((it) => it.key === open);
  const opensNext = at < 0 || parentLayout === null ? [] : parentLayout.edges.filter(([a]) => a === at).map(([, b]) => parentLayout.items[b]);
  const needsBefore = at < 0 || parentLayout === null ? [] : parentLayout.edges.filter(([, b]) => b === at).map(([a]) => parentLayout.items[a]);
  const dueHere = here === null ? [] : dueCards.filter((c) => cardEntities(c).some((e) => { const t = topicIndex.get(e); return t !== undefined && here.topics.includes(t); }));
  const regionPanel = (
    <section className="cg-ls-region" data-landscape-region={open ?? ''}>
      <div className="cg-row-between">
        <p className="cg-ls-qtitle"><strong>{here === null ? (baseName || T.wholeMap) : here.name}</strong></p>
        {writes && here !== null && nest === null && editing !== open && <button type="button" className="wk-link-btn" onClick={() => setEditing(open)} data-landscape-rename="">{T.rename}</button>}
      </div>
      {editing !== null && editing === open && here !== null && (
        <RenameBox name={here.name} onSave={(name) => { saveEdits((was) => ({ ...was, names: { ...(was.names ?? {}), [here.key]: { name, topics: here.topics.map((t) => tg.graph.ids[t]) } } })); setEditing(null); }} onCancel={() => setEditing(null)} />
      )}
      <p className="cg-muted cg-ls-numbers" data-landscape-region-topics={here?.topics.length ?? tg.graph.ids.length}>
        {T.inRegion(here?.topics.length ?? tg.graph.ids.length)}
        {regionsHere.length > 0 ? <> · <span data-landscape-tally={`${conqueredHere}/${regionsHere.length}`}>{T.tally(conqueredHere, regionsHere.length)}</span></> : <> · {T.knownOf(knownHere, layout.items.length)}</>}
      </p>
      {needsBefore.length > 0 && <p className="cg-muted"><span className="cg-ls-qh">{T.comesFrom}</span> {needsBefore.map((it) => it.label).join(' · ')}</p>}
      {opensNext.length > 0 && <p className="cg-muted" data-landscape-opens={opensNext.length}><span className="cg-ls-qh">{T.opens}</span> {opensNext.map((it) => it.label).join(' · ')}</p>}
      {dueHere.length > 0 && learner !== null && <div className="wk-actions"><button type="button" className="wk-btn wk-btn-line" onClick={() => reviewCards(`${W.review}: ${here?.name ?? ''}`, dueHere)} data-landscape-region-review={dueHere.length}>{T.reviewDue(dueHere.length)}</button></div>}
    </section>
  );
  /* Die Ścieżka des gewählten Themas: dieselben Themen wie die Liste (von unten), darüber, was es öffnet; eine eigene Erzählung: ihre. */
  const pathPanel = (() => {
    if (chosenId === null || routeShown !== chosenId) return null;
    const story = storyPath(chosenId);
    if (story !== null) {
      return (
        <section className="cg-ls-pathpanel" data-landscape-pathpanel="story">
          <p className="cg-muted">{T.storyHere}</p>
          <PathMap model={story.model} marks={story.marks} size="full" words={W} title={`${W.pathTitle}: ${W.story}`} name={(id) => <TexText text={story.model.nodes[story.model.index.get(id) ?? -1]?.label ?? id} />} />
        </section>
      );
    }
    const list = routeOf !== null && routeOf.id === chosenId ? routeOf.list : [chosenId];
    const unlocks = tg.graph.ids.filter((_, u) => (tg.graph.needs[u] ?? []).includes(topicIndex.get(chosenId)!)).slice(0, 6);
    const items = [...list, ...unlocks.filter((x) => !list.includes(x))].map((id) => ({ id, label: labelOf(id) }));
    const model = pathOfEntries(items, lib.prerequisites(), true);
    const firstOpen = list.find((x) => { const b = bandOf(x); return b === 'ring'; }) ?? null;
    return (
      <section className="cg-ls-pathpanel" data-landscape-pathpanel="route" data-landscape-path-topics={list.length}>
        <PathMap model={model} marks={pathMarks(model, gaugeKnow(gauge), firstOpen)} size="full" words={W} noun="topics" title={T.routeTitle} name={(id) => <TexText text={entityNameTex(lib, id)} />}
          actions={(id, st) => (learner !== null ? <div className="wk-actions"><button type="button" className="wk-btn" onClick={() => learnEntry(id, st !== 'done')} data-path-learn={id}>{st === 'done' ? W.review : W.start}</button></div> : null)} />
      </section>
    );
  })();
  /* Die Legende sagt nur, was gerade im Bild ist (im Nahen weniger). */
  const legend = (fore: number, visible: ReadonlySet<string>) => {
    const seen = fields.filter((f) => visible.has(f.key));
    const has = (p: (f: MapField) => boolean) => seen.some(p);
    return (
      <Legend fore={fore} show={{
        glow: has((f) => f.glow), haze: has((f) => f.steps >= 3), due: has((f) => f.sign === 'due'), first: has((f) => f.sign === 'first'), route: mapRoute !== null,
        badge: has((f) => f.badge != null), ring: has((f) => f.kind === 'region'), flag: has((f) => f.conquered), gate: gates.length > 0, home: has((f) => f.home)
      }} folded={compact || !wide} />
    );
  };

  return host(
    <div className={`cg-ls${compact ? ' is-compact' : ''}${wide ? ' has-side' : ''}`} data-landscape={fields.length} data-landscape-levels={tree.levels} data-landscape-level={path.length}
      data-landscape-ring={fields.filter((f) => f.glow).length} data-landscape-worker={client?.inWorker === true ? '1' : '0'} data-landscape-ms={stand?.ms.toFixed(1) ?? ''}>
      {(busy || fresh.pending) && <p className="cg-ls-busy" role="status" data-landscape-busy="">{W.computing}</p>}
      <div className="cg-ls-head">
        <div className="cg-ls-headrow">
          <nav className="cg-ls-crumbs" aria-label={W.whereAmI} data-landscape-crumbs={path.length}>
            <button type="button" className="wk-link-btn" disabled={open === null} onClick={() => nav([])} data-landscape-up="">{baseName || T.wholeMap}</button>
            {path.map((key, i) => (
              <span key={key} className="cg-ls-crumb">
                <span aria-hidden>›</span>
                {i === path.length - 1 ? <strong>{tree.regions.get(key)?.name ?? key}</strong> : <button type="button" className="wk-link-btn" onClick={() => nav([key])}>{tree.regions.get(key)?.name ?? key}</button>}
              </span>
            ))}
          </nav>
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-line" onClick={toMe} data-landscape-me="">{T.toMe}</button>
            <button type="button" className="wk-btn wk-btn-line" onClick={whole} data-landscape-whole="">{T.wholeMap}</button>
            {open !== null && <button type="button" className="wk-link-btn" onClick={goUp} data-landscape-goup="">{T.up}</button>}
          </div>
        </div>
        {nextLine}
        {regionsHere.length > 0 && <p className="cg-ls-tally" data-landscape-tally-top={`${conqueredHere}/${regionsHere.length}`}>{T.tally(conqueredHere, regionsHere.length)}</p>}
        {won !== null && <p className="wk-note cg-ls-conquered" role="status" data-landscape-won={won}>{T.conquered(won)} <button type="button" className="cg-ls-qclose" aria-label={W.close} onClick={() => setWon(null)}>×</button></p>}
        {goalDone !== null && <p className="wk-note" role="status" data-landscape-goal-done={goalDone}>{W.goalDone(labelOf(goalDone))} <button type="button" className="cg-ls-qclose" aria-label={W.close} onClick={() => setGoalDone(null)}>×</button></p>}
        {goal !== null && (
          <p className="cg-ls-goal" data-landscape-goal={goal} data-landscape-goal-steps={goalOpen.length}>
            <span>{W.goal}: <strong><TexText text={entityNameTex(lib, goal)} /></strong> — {T.toGoal(goalOpen.length)}</span>
            <button type="button" className="wk-link-btn" onClick={() => showTopic(goal)}>{W.show}</button>
            <button type="button" className="wk-link-btn" onClick={() => setGoal(null)} data-landscape-goal-clear="">{W.clearGoal}</button>
          </p>
        )}
      </div>
      {query.trim() !== '' && <SearchHits query={query} ids={tg.graph.ids} bandOf={bandOf} label={labelOf} goal={goal} onShow={showTopic} onGoal={(id) => { setGoal(id); setSaid(W.goalSet(labelOf(id))); }} />}
      <div className="cg-ls-body">
        <div className="cg-ls-main">
          <RegionMap levelKey={`${treeKey}:${open ?? ''}`} fields={fields} gates={gates} ground={ground} route={mapRoute} chosen={chosenId} next={nextHere?.key ?? null}
            focus={nextHere?.key ?? chosenId} width={mapWidth} compact={compact} T={T} memoryKey={`${lib.libraryId}:${viewKey}:${learner?.holder ?? 'me'}`} canUp={open !== null}
            command={command} onChoose={choose} onGate={(key) => nav([key])} onUp={goUp} onBackground={() => setChosen(null)} legend={legend} />
          {!wide && chosenField !== undefined && topicPanel !== null && (
            <SheetBox label={chosenField.label} questKey={chosenField.key}>{topicPanel}</SheetBox>
          )}
          {!wide && regionPanel}
          {!wide && pathPanel}
        </div>
        {wide && (
          <aside className="cg-ls-side" aria-label={W.goal} data-landscape-side="">
            <div ref={setSideEl} className="cg-ls-side-pick">
              {topicPanel !== null && <div className="cg-ls-quest is-side" role="region" aria-label={chosenField?.label ?? ''} data-landscape-quest={chosenId ?? ''}>{topicPanel}</div>}
            </div>
            {pathPanel}
            {regionPanel}
            {chosenId === null && <p className="cg-muted cg-ls-side-hint">{W.chooseField}</p>}
          </aside>
        )}
      </div>
      {sideEl === null ? null : null}
      {more}
      <p className="cg-sr" aria-live="polite">{said}</p>
      {!compact && <FieldList fields={fields} onChoose={choose} />}
    </div>
  );
}

/* -- Die Legende: nur, was auf der Karte ist; im Engen zu „Legende" gefaltet ----------------------------------- */

function Legend({ fore, show, folded }: { fore: number; folded: boolean; show: Readonly<Record<'glow' | 'haze' | 'due' | 'first' | 'route' | 'badge' | 'ring' | 'flag' | 'gate' | 'home', boolean>> }) {
  const [open, setOpen] = useState(!folded);
  useEffect(() => { setOpen(!folded); }, [folded]);
  const body = (
    <ul className="cg-ls-legend" data-landscape-legend="">
      <li><span className="cg-ls-legend-tones" aria-hidden><i /><i /><i /><i /></span>{T.legendColour}</li>
      <li data-landscape-legend-height=""><svg className="cg-ls-legend-icon" viewBox="-12 -8 24 16" aria-hidden><path d="M-11,6 L-5,6 L-5,2 L1,2 L1,-2 L7,-2 L7,-6 L11,-6" /></svg>{T.legendHeight}</li>
      {show.glow && <li data-landscape-legend-mark="glow"><svg className="cg-ls-legend-icon" viewBox="-12 -8 24 16" aria-hidden><polygon className="cg-ls-legend-glow" points="-8,0 -4,-5 4,-5 8,0 4,5 -4,5" /></svg>{T.legendGlow}</li>}
      {show.haze && <li data-landscape-legend-mark="haze"><span className="cg-ls-legend-tones is-haze" aria-hidden><i /><i /><i /></span>{T.legendHaze}</li>}
      {show.first && <li data-landscape-legend-mark="first"><svg className="cg-ls-legend-sign" viewBox="-10 -10 20 20" aria-hidden><SignIcon kind="first" r={8} fore={fore} /></svg>{T.legendFirst}</li>}
      {show.due && <li data-landscape-legend-mark="repeat"><svg className="cg-ls-legend-sign" viewBox="-10 -10 20 20" aria-hidden><SignIcon kind="due" r={8} fore={fore} /></svg>{T.legendDue}</li>}
      {show.route && <li data-landscape-legend-mark="route"><svg className="cg-ls-legend-icon" viewBox="-12 -8 24 16" aria-hidden><path className="cg-rm-routeline" d="M-10,5 L-2,-1 L6,3 L10,-5" /><circle className="cg-ls-legend-step" cx={-10} cy={5} r={3} /></svg>{T.legendRoute}</li>}
      {show.badge && <li data-landscape-legend-mark="badge"><svg className="cg-ls-legend-icon" viewBox="-12 -8 24 16" aria-hidden><rect className="cg-ls-legend-badge" x={-9} y={-6} width={18} height={12} rx={6} /></svg>{T.legendBadge}</li>}
      {show.ring && <li data-landscape-legend-mark="ring"><svg className="cg-ls-legend-icon" viewBox="-12 -8 24 16" aria-hidden><ellipse className="cg-rm-ring" rx={7} ry={4} /></svg>{T.legendRing}</li>}
      {show.flag && <li data-landscape-legend-mark="flag"><svg className="cg-ls-legend-icon" viewBox="-12 -8 24 16" aria-hidden><g className="cg-ls-flagmark"><path d="M-2,7 V-7 L5,-4.5 L-2,-2" /></g></svg>{T.legendFlag}</li>}
      {show.gate && <li data-landscape-legend-mark="gate"><svg className="cg-ls-legend-icon" viewBox="-12 -8 24 16" aria-hidden><polygon className="cg-rm-gate-face" points="-8,0 -4,-5 4,-5 8,0 4,5 -4,5" /><polygon className="cg-rm-gate-door" points="-4,0 -2,-2.5 2,-2.5 4,0 2,2.5 -2,2.5" /></svg>{T.legendGate}</li>}
      {show.home && <li data-landscape-legend-mark="home"><svg className="cg-ls-legend-icon" viewBox="-12 -8 24 16" aria-hidden><g className="cg-ls-meicon"><circle cx={0} cy={-3.5} r={2.2} /><path d="M-3.5,6 Q0,-2 3.5,6 Z" /></g></svg>{T.legendHome}</li>}
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

/* -- Das gewählte Thema ---------------------------------------------------------------------------------------- */

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

function TopicPanel({ id, info, route, goal, story, unitSize, canLearn, note, lockNames, lockCount, bandOf, unlocks, questions, routeShown, onRoute, onLearn, onReview, onReviewFirst, onGoal, onUnit, onShow, onClose, onOpen, move }: {
  id: string;
  info: TopicInfo;
  /** Die Themen bis hierher (dieses zuletzt) — `null`: noch unterwegs. */
  route: readonly string[] | null;
  goal: string | null;
  story: { readonly stage: StoryStage; readonly open: (review: boolean) => void } | null;
  unitSize: number;
  canLearn: boolean;
  note: string | null;
  lockNames: (id: string) => readonly string[];
  lockCount: (id: string) => number;
  bandOf: (id: string) => LsBand | null;
  unlocks: readonly string[];
  questions: readonly string[];
  routeShown: boolean;
  onRoute: (on: boolean) => void;
  onLearn: (id: string) => void;
  onReview: (id: string, band: LsBand) => void;
  onReviewFirst: (id: string) => void;
  onGoal: (id: string, on: boolean) => void;
  onUnit: (id: string) => void;
  onShow: (id: string) => void;
  onClose: () => void;
  onOpen?: (id: string) => void;
  move: { readonly options: readonly { readonly key: string; readonly name: string }[]; readonly current: string | null; readonly onMove: (key: string) => void } | null;
}) {
  const { lib } = useCtx();
  const band = info.band ?? 'mountain';
  const open = band === 'ring' || band === 'mountain';
  const list = route === null ? null : route.filter((x) => { const b = bandOf(x); return b !== 'known' && b !== 'due'; });
  const themen = list === null ? null : list.length;
  const link = (x: string) => <button type="button" className="cg-ref" onClick={() => onShow(x)} data-landscape-next-item={x}><TexText text={entityNameTex(lib, x)} /></button>;
  return (
    <div className="cg-ls-q" data-landscape-topic={id}>
      <div className="cg-ls-qhead" data-landscape-quest-head="">
        <div className="cg-ls-qtop">
          <p className="cg-ls-qtitle"><strong><TexText text={entityNameTex(lib, id)} /></strong></p>
          <button type="button" className="cg-ls-qclose" aria-label={W.close} onClick={onClose} data-landscape-quest-close="">×</button>
        </div>
        <div className="cg-ls-qrow">
          {info.total > 0 && <ProgressRing known={info.known} total={info.total} />}
          <p className="cg-ls-qstate" data-landscape-state={band}>
            {story !== null && story.stage === 'review' ? T.storyStage('review') : stateWords(band, info.steps, info.locked)}
          </p>
        </div>
        {open && <p className="cg-muted cg-ls-numbers" data-landscape-numbers={`${info.steps}/${themen ?? ''}`}>{themen === null ? T.stufen(info.steps) : T.numbers(info.steps, themen)}</p>}
        {story !== null && <p className="cg-muted" data-landscape-story-stage={story.stage}>{T.storyHere}</p>}
        <div className="wk-actions">
          {canLearn && story !== null && band !== 'mountain' && !(band === 'ring' && info.locked) && <button type="button" className="wk-btn" onClick={() => story.open(story.stage === 'review')} data-landscape-story={story.stage}>{T.storyButton(story.stage)}</button>}
          {canLearn && story === null && band === 'ring' && !info.locked && <button type="button" className="wk-btn" onClick={() => onLearn(id)} data-landscape-learn="">{W.start}</button>}
          {canLearn && band === 'ring' && info.locked && <button type="button" className="wk-btn" onClick={() => onReviewFirst(id)} data-landscape-review-first="">{W.reviewFirst(lockCount(id))}</button>}
          {canLearn && story === null && (band === 'due' || band === 'known') && <button type="button" className={band === 'due' ? 'wk-btn' : 'wk-btn wk-btn-line'} onClick={() => onReview(id, band)} data-landscape-review="">{W.review}</button>}
          {band === 'mountain' && <button type="button" className="wk-btn" onClick={() => onGoal(id, goal !== id)} data-landscape-set-goal="">{goal === id ? W.clearGoal : W.setGoal}</button>}
          {open && <button type="button" className="wk-btn wk-btn-line" onClick={() => onRoute(!routeShown)} aria-pressed={routeShown} data-landscape-show-route="">{routeShown ? T.hideRoute : T.showRoute}</button>}
          {unitSize > 1 && <button type="button" className="wk-link-btn" onClick={() => onUnit(id)} data-landscape-unit={id}>{T.inSection(unitSize)}</button>}
          {onOpen !== undefined && <button type="button" className="wk-link-btn cg-ls-qopen" onClick={() => onOpen(id)} data-landscape-open="">{W.openEntry}</button>}
        </div>
        {!canLearn && band !== 'mountain' && <p className="cg-muted">{W.canLearnNote}</p>}
        {info.locked && lockNames(id).length > 0 && (
          <div data-landscape-review-first-list="">
            <p className="cg-ls-qh">{W.reviewFirstWhat}</p>
            <ul className="cg-ls-qlist is-scroll">{lockNames(id).map((x) => <li key={x}>{link(x)}</li>)}</ul>
          </div>
        )}
        {note !== null && <p className="wk-note" role="status">{note}</p>}
      </div>
      {((list !== null && list.length > 1) || unlocks.length > 0 || questions.length > 0 || move !== null) && (
        <div className="cg-ls-qbody">
          {list !== null && list.length > 1 && (
            <div className="cg-ls-route" data-landscape-route={list.length}>
              <p className="cg-ls-qh">{goal === id ? T.routeHead(list.length) : T.routeHere(list.length)}</p>
              <ol className="cg-ls-qlist is-scroll cg-ls-goalsteps">
                {list.map((x, k) => (
                  <li key={x} className={k === 0 ? 'is-next' : ''} data-landscape-route-step={k + 1}>
                    <span className="cg-ls-goaltick" aria-hidden>{k + 1}</span>
                    {x === id ? <strong><TexText text={entityNameTex(lib, x)} /></strong> : link(x)}
                  </li>
                ))}
              </ol>
              {list.length > 8 && routeShown && <p className="cg-muted" data-landscape-route-more={list.length - 6}>{T.more(list.length - 6)}</p>}
            </div>
          )}
          {unlocks.length > 0 && (
            <>
              <p className="cg-ls-qh">{W.unlocks}</p>
              <ul className="cg-ls-qlist is-scroll" data-landscape-unlocks={unlocks.length}>{unlocks.map((x) => <li key={x}>{link(x)}</li>)}</ul>
            </>
          )}
          {questions.length > 0 && (
            <details data-landscape-questions={questions.length}>
              <summary className="cg-ls-qh">{T.questionsIn} ({questions.length})</summary>
              <ul className="cg-ls-qlist is-scroll">{questions.map((x) => <li key={x}><TexText text={entityNameTex(lib, x)} /></li>)}</ul>
            </details>
          )}
          {move !== null && move.options.length > 1 && (
            <label className="wk-field" data-landscape-move="">
              <span>{T.moveTo}</span>
              <select value={move.current ?? ''} onChange={(e) => { if (e.target.value !== '') move.onMove(e.target.value); }}>
                {move.options.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
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

/** Dieselben Felder als Liste — für Vorleser, und für wer lieber liest als schaut. */
function FieldList({ fields, onChoose }: { fields: readonly MapField[]; onChoose: (key: string) => void }) {
  const groups: { band: LsBand; title: string }[] = [
    { band: 'ring', title: W.listBands[0] }, { band: 'due', title: W.listBands[1] },
    { band: 'mountain', title: W.listBands[2] }, { band: 'known', title: W.listBands[3] }
  ];
  return (
    <details className="cg-ls-list" data-landscape-list="">
      <summary>{W.asList(fields.length)}</summary>
      {groups.map((g) => {
        const of = fields.filter((f) => f.band === g.band).sort((a, b) => a.steps - b.steps || a.label.localeCompare(b.label));
        if (of.length === 0) return null;
        return (
          <section key={g.band}>
            <h5>{g.title} <span className="cg-muted">({of.length})</span></h5>
            <ul>{of.map((f) => <li key={f.key}><button type="button" className="cg-ref" onClick={() => onChoose(f.key)}>{f.title}</button></li>)}</ul>
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

function useWidth(initial = 0): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
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
