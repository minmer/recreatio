/**
 * 2026-11-09 — DIE WELTKARTE ALS GESTALT EINES WIDOKU (Entscheidung 2: `landscape.style: "world"` in der Hülle des Krajobraz;
 * das Sechseck bleibt die Vorgabe). Hier kommt alles zusammen: das Modell aus der Baza (`wmInput` → `readWorld` → `linesOf`),
 * der Stand des Lernenden (`stateOf`, Stufen aus seinen Durchgängen), die Gestalt (im Worker, gemerkt; Schreibende legen die
 * Lage ab), die Farben (Thema der Säulen, eigene Palette der Linien) und der Zeichner. Daneben die Felder (`WorldPanels.tsx`:
 * Ort, Abschnitt, Umsteigeort, Haus, Navigation) — und was sie auslösen, läuft hier an Stelle der Karte: eine Erzählung am
 * Anfang eines Abschnitts (an einer Wahl gleich im gewählten Zweig), Karten direkt lernen oder wiederholen, ein Durchgang.
 * Die Navigation („Prowadź mnie tutaj") lebt nur in dieser Sitzung (`wmNav.ts`).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { tFor } from '../../core/i18n';
import { useDark } from '../../core/theme';
import type { Card } from '../cardBasics';
import { readFlow, resolveFlow, type Flow } from '../flow';
import { cardOfQuestion, flowQuestionsKnown, learnerFlows, storyStage } from '../flowFacts';
import { contentOfLibrary, FlowPlayer } from '../FlowPlayer';
import { cardKnowness, itemKnowness } from '../knowing';
import { KNOWN } from '../knowness';
import { baseLang, words } from '../lang';
import { holderKey, positionFor, renamer, type Learner } from '../learn';
import type { Facts } from '../logic';
import { landscapeClient } from '../landscapeClient';
import { keepShown, pointsSince, readShown, shortId, shownKey, type ShownState } from '../landscapeShown';
import { landscapeWords } from '../landscapeWords';
import { keepMapMeasures } from '../mapMeasures';
import { motionWords } from '../motionWords';
import type { RegionTree } from '../regions';
import { readPlan } from '../revision';
import { RevisionRun, type RunSource } from '../RevisionRun';
import { awardsOf, cleanDays, freshAwards, rewardsFor, type RewardRules } from '../rewards';
import { RewardBoard, useRewards } from '../RewardViews';
import { fillCards, gapTopics, selfCheckCards } from '../selfCheck';
import { selfCheckWords } from '../selfCheckWords';
import { stackFor } from '../spacing';
import { learnerGauge } from '../storyLock';
import { useCtx } from '../ui';
import type { ViewDoc } from '../views';
import { useWorlds, WorldsSection } from '../WorldLinks';
import { FlagIcon } from '../WorldMap';
import { holdStore } from '../worldPlay';
import { crossRefsIn, resolveCross } from '../worlds';
import { OwnWorldSettings, PillarSlider } from './WorldLevels';
import { AuthorList, HomePanel, NavPanel, PlacePanel, SectionPanel, type PanelActions, type PanelCtx } from './WorldPanels';
import { WorldPillars, type PillarsHandle, type PlayEvent } from './WorldPillars';
import { WorldRun } from './WorldRun';
import { authorIssues } from './wmAuthors';
import { colourKeys, placeKindsOf, regionGraphOf } from './wmExport';
import { lineColours, oklch, type Rgb } from './wmColors';
import { geometryInputOf, type Geometry } from './wmGeometry';
import { geometryFor } from './wmGeometryClient';
import { readWorld } from './wmGraph';
import { worldInputOf } from './wmInput';
import { linesOf, outerStep } from './wmLines';
import { followPlan, keepNav, keptNav, navMarks, type NavSession, type Timetable } from './wmNav';
import { plan as planRoute, type PlanStep } from './wmPlan';
import { effectiveWorldFor, reportDueFor } from './wmReview';
import { levelsByPlace, type LevelRule } from './wmRuns';
import { sceneOf } from './wmScene';
import { reviewable, stateOf, type LearnerInput } from './wmState';
import { useServerRuns } from './useServerRuns';
import { layoutPass } from './wmStore';
import { HOME } from './wmTypes';
import { diffPlaces, keepMode, keptMode, litPlaces, packPlace, shownOfPlace, WORLD_MODES, type WorldMode, type WorldPlayback } from './wmViews';
import './worldmap.css';

/* Wie im Krajobraz: was der Zähler der Punkte über der Karte nicht zeigt (gross / klein). */
const POINTS_HIDDEN: ReadonlySet<string> = new Set(['streak', 'goal', 'feed']);
const POINTS_HIDDEN_SMALL: ReadonlySet<string> = new Set(['streak', 'goal', 'feed', 'level', 'badges']);
/* „Pokaż zmiany" bleibt so lange nach der Rückkehr. */
const REPLAY_MS = 20_000;

/** Die Farben der Themen: wie im Krajobraz die acht des Bereichs, reihum (hell und dunkel). */
const TOPIC = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
} as const;
const NONE = { light: '#8d8a82', dark: '#6f6b62' } as const;
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Was an Stelle der Karte läuft: eine Erzählung, Karten (lernen, wiederholen) oder ein Durchgang. */
type Running =
  | { readonly kind: 'story'; readonly key: string; readonly flow: Flow; readonly jump: { readonly step: string; readonly at: number; readonly exit?: string } | null }
  | { readonly kind: 'cards'; readonly key: string; readonly source: RunSource }
  | { readonly kind: 'run'; readonly key: string; readonly place: string };

type Chosen = { readonly kind: 'place' | 'section' | 'home'; readonly id: string };

export interface WorldLandscapeProps {
  readonly view: ViewDoc;
  readonly cards: readonly Card[];
  readonly learner: Learner | null;
  readonly onOpen?: (id: string) => void;
  readonly compact?: boolean;
  readonly viewKey: string;
  readonly more?: ReactNode;
  /** Die Regeln der Nagrody, wo die Läufe hier Punkte zeigen (wie im Krajobraz): der Zähler und die Punkte beim Abspielen. */
  readonly rewards?: RewardRules | null;
}

/** Wie oft „jetzt" neu gilt, solange die Karte offen ist. */
const CLOCK_MS = 10 * 60 * 1000;

export function WorldLandscape({ view, cards, learner, onOpen, compact = false, viewKey, more, rewards = null }: WorldLandscapeProps) {
  const { lib, writes, name: baseName } = useCtx();
  const lang = baseLang(lib);
  const t = tFor(lang);
  const dark = useDark();

  /* -- Das Modell (einmal je Stand der Baza) ------------------------------------------------------------------------- */
  const placeKinds = useMemo(() => placeKindsOf(view), [view]);
  const input = useMemo(() => worldInputOf(lib, cards, { placeKinds }), [lib, lib.revision, cards, placeKinds]); // eslint-disable-line react-hooks/exhaustive-deps
  const world = useMemo(() => readWorld(input), [input]);
  const lines = useMemo(() => linesOf(world, input.flows), [world, input]);
  const flowById = useMemo(() => new Map(input.flows.map((f) => [f.id, f] as const)), [input]);

  /* -- Der Lernende ---------------------------------------------------------------------------------------------------- */
  /* Jede Änderung seines Stands (eine Antwort, ein Durchgang, eine eigene Einstellung, ein anderer Tab) zeichnet neu. */
  const [, setLearnTick] = useState(0);
  useEffect(() => (learner === null ? undefined : learner.subscribe(() => setLearnTick((n) => n + 1))), [learner]);
  const progress = learner?.progress;
  const gauge = useMemo(() => (learner === null ? null : learnerGauge(lib, cards, learner)), [lib, lib.revision, cards, learner, progress]); // eslint-disable-line react-hooks/exhaustive-deps
  /* PR A — bis der Dienst Durchgänge speichert, gelten 0 Stufen (`wmFeatures.ts`); kommt seine Antwort, zeichnet es neu. */
  useServerRuns();
  const eff = effectiveWorldFor(lib, learner);
  const rulesKey = JSON.stringify(eff.rules);
  const rules = useMemo((): readonly LevelRule[] => eff.rules, [rulesKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [pillarLive, setPillarLive] = useState<number | null>(null);
  const pillarWidth = pillarLive ?? eff.pillarWidth;
  const [heightScale, setHeightScale] = useState(1);
  const levels = useMemo(() => levelsByPlace(progress?.runs.values() ?? [], rules, eff.levels), [progress, eff.levels, rules]);
  const flowFacts = useMemo(() => learnerFlows(lib, progress?.positions), [lib, lib.revision, progress]); // eslint-disable-line react-hooks/exhaustive-deps
  const cardOfQ = useMemo(() => cardOfQuestion(cards), [cards]);
  /* Step 3 · 10 — „jetzt" bewegt sich: wenn der Tab wieder sichtbar wird und alle CLOCK_MS (Karten werden mit der Zeit fällig). */
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') setClock(Date.now()); };
    document.addEventListener('visibilitychange', tick);
    const id = window.setInterval(tick, CLOCK_MS);
    return () => { document.removeEventListener('visibilitychange', tick); window.clearInterval(id); };
  }, []);
  const learnerInput = useMemo((): LearnerInput => {
    const know = (k: string) => (gauge === null ? 0 : cardKnowness(gauge, k));
    const now = clock;
    const facts: Facts = {
      values: progress?.values ?? {}, knowness: (id) => (gauge === null ? 0 : itemKnowness(gauge, id)),
      answered: (id) => { const m = learner?.marks(id) ?? []; return m.length === 0 ? null : m[m.length - 1].correctness; },
      visited: new Set(), now: new Date(now), flow: (id) => flowFacts.get(id)
    };
    return {
      now, facts, knowness: know,
      progress: (flow) => {
        const f = flowById.get(flow);
        const p = f === undefined ? progress?.positions.get(flow) : positionFor(progress?.positions, f);
        return p === undefined ? undefined : { visited: new Set(p.visited), done: p.done === true };
      },
      storyPassed: (flow) => {
        const f = flowById.get(flow);
        return f !== undefined && storyStage(f, flowFacts.get(flow), flowQuestionsKnown(f, cardOfQ, (key) => know(key) >= KNOWN)) === 'passed';
      },
      level: (place) => levels.get(place)?.level ?? 0,
      perfect: (place) => levels.get(place)?.perfect === true,
      /* Step 3 · 1 — ausgesetzte Karten zählen nirgends (sonst sperrte eine einzige ihren Ort für immer). */
      suspended: (card) => progress?.suspended.has(card) === true
    };
  }, [gauge, progress, learner, flowFacts, flowById, cardOfQ, levels, clock]);
  const state = useMemo(() => stateOf(world, lines, learnerInput, { levels: eff.levels, knownShare: eff.knownShare }), [world, lines, learnerInput, eff.levels, eff.knownShare]);

  /* -- Wie im Krajobraz (Step-1-Bericht §3: behalten): Ansichten, Luki, Portale, das Ziel ------------------------------------ */
  const T = useMemo(() => landscapeWords(lang), [lang]);
  const W = useMemo(() => words(lang), [lang]);
  const SC = useMemo(() => selfCheckWords(lang), [lang]);
  const MW = useMemo(() => motionWords(lang), [lang]);
  const memo = `${lib.libraryId}:${viewKey}:${learner === null ? 'me' : holderKey(learner.holder)}`;
  /* Die Ansicht, gemerkt mit dem Blick (dieser Browser). */
  const [mode, setModeNow] = useState<WorldMode>(() => keptMode(memo));
  const setMode = (m: WorldMode) => { setModeNow(m); keepMode(memo, m); };
  /* Luki: Orte, deren Kernfrage beantwortet ist und jetzt nicht gewusst wird (`selfCheck.ts`). */
  const gapsNow = useMemo(() => gapTopics(cards, (key) => gauge?.states.get(key) ?? null, Date.now(), new Set(world.places.keys())), [cards, gauge, world]);
  const shownMode: WorldMode = learner === null && mode === 'gaps' ? 'all' : mode;
  const lit = useMemo(() => litPlaces(shownMode, state, gapsNow.gaps), [shownMode, state, gapsNow]);
  /* Portale: Verweise in andere Welten je Ort — gezählt, was der Betrachter dort lesen kann (wer hier schreibt: alle). */
  const portalRefs = useMemo(() => new Map([...world.places.keys()].flatMap((id) => { const r = crossRefsIn(lib.entry(id)?.data, { markup: false }); return r.length === 0 ? [] : [[id, r] as const]; })), [world, lib, lib.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const portalWorlds = useWorlds([...portalRefs.values()].flat().map((r) => r.handle));
  const portals = useMemo(() => new Map([...portalRefs]
    .map(([id, refs]) => [id, refs.filter((r) => { const w = portalWorlds.get(r.handle); return writes || (w?.lib != null && resolveCross(w.lib, r.ref) !== null); }).length] as const)
    .filter(([, n]) => n > 0)), [portalRefs, portalWorlds, writes]);
  /* Das Ziel („Ustaw jako cel"): derselbe Platz wie im Krajobraz (`landscape:<widok>`, die Schritte = die Reihenfolge der Eroberung). */
  const goalKey = `landscape:${viewKey}`;
  const [localGoal, setLocalGoal] = useState<string | null>(null);
  const keptGoal = progress?.positions.get(goalKey)?.step ?? null;
  const goalRaw = learner === null ? localGoal : keptGoal === null || keptGoal === '' ? null : keptGoal;
  const goal = goalRaw !== null && world.places.has(goalRaw) ? goalRaw : null;
  const setGoal = (id: string | null) => {
    if (learner === null) { setLocalGoal(id); return; }
    void learner.keepPosition({ flow: goalKey, step: id ?? '', visited: id === null ? [] : state.conquestOrder(id), at: Date.now() }).catch(() => undefined);
  };
  const [goalDone, setGoalDone] = useState<string | null>(null);
  useEffect(() => {
    if (goal !== null && state.places.get(goal)?.conquered === true) { setGoalDone(goal); setGoal(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, state]);

  /* -- Farben ------------------------------------------------------------------------------------------------------------ */
  /* Ohne Knoten des Widoku: die Gebiete aus den Voraussetzungen (im Worker des Krajobraz, einmal je Welt). */
  const [regions, setRegions] = useState<RegionTree | null>(null);
  const [regionsDone, setRegionsDone] = useState(view.landscape?.nest !== undefined);
  useEffect(() => {
    if (view.landscape?.nest !== undefined) { setRegionsDone(true); return undefined; }
    setRegionsDone(false);
    let alive = true;
    const client = landscapeClient();
    const graph = regionGraphOf(world);
    void client.regions({ key: `wm:${graph.ids.length}:${graph.ids[0] ?? ''}`, graph, lang }).then((tree) => { if (alive) { setRegions(tree); setRegionsDone(true); } }, () => { if (alive) setRegionsDone(true); });
    return () => { alive = false; client.dispose(); };
  }, [world, view, lang]);
  const keys = useMemo(() => colourKeys(lib, world, view, regions), [lib, world, view, regions]);
  const placeColour = useMemo(() => {
    const order: string[] = [];
    for (const id of world.order) { const k = keys.get(id) ?? id; if (!order.includes(k)) order.push(k); }
    const pal = dark ? TOPIC.dark : TOPIC.light;
    const index = new Map(order.map((k, i) => [k, i] as const));
    /* Wie im Krajobraz (spec §4.2 „wie heute"): die acht Farben reihum über die obersten Gebiete; grau nur ohne Gebiet. */
    return (id: string): Rgb => { const i = index.get(keys.get(id) ?? id); return hex(i === undefined ? (dark ? NONE.dark : NONE.light) : pal[i % pal.length]); };
  }, [world, keys, dark]);
  const colours = useMemo(() => lineColours(lines, dark ? 'dark' : 'light'), [lines, dark]);

  /* -- Die Gestalt: im Worker, gemerkt; Schreibende legen die Lage ab ------------------------------------------------- */
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [geometryRuns, setGeometryRuns] = useState(0);
  const [relay, setRelay] = useState(0);
  useEffect(() => {
    /* Erst, wenn die Farben feststehen (Orte ohne Verbindung stehen am Rand bei ihresgleichen). */
    if (!regionsDone) return undefined;
    let alive = true;
    /* Step 3 · 8 — die Neulage gilt für diese eine Rechnung: gelegt und gespeichert, gilt wieder die gespeicherte Lage. */
    const asked = relay;
    void layoutPass(lib, { full: asked > 0, save: writes }, (previous, full) =>
      geometryFor(geometryInputOf(world, lines, { ...(previous === undefined ? {} : { previous }), ...(full ? { mode: 'full' as const } : {}), color: (id) => keys.get(id) }))
    ).then(({ geometry: g, saved }) => {
      if (alive) { setGeometry(g); setGeometryRuns((n) => n + 1); }
      void saved.then((done) => { if (done) setRelay((r) => (r === asked ? 0 : r)); });
    });
    return () => { alive = false; };
  }, [world, lines, keys, relay, regionsDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const scene = useMemo(() => (geometry === null ? null : sceneOf(world, lines, state, geometry, { placeColour, lineColour: colours, fallback: oklch(0.5, 0.05, 250) })), [world, lines, state, geometry, placeColour, colours]);

  /* -- Namen ------------------------------------------------------------------------------------------------------------- */
  const nameOf = useCallback((id: string): string => {
    if (id === HOME) return t('cogitaWorld.map.start');
    return world.places.get(id)?.label ?? world.blocks.get(id)?.label ?? world.entries.get(id)?.label ?? lines.lines.get(id)?.name ?? flowById.get(id)?.name ?? id;
  }, [world, lines, flowById, t]);

  /* -- Navigation in dieser Sitzung (spec §8) ------------------------------------------------------------------------------ */
  const scope = `${lib.libraryId}:${viewKey}`;
  const [nav, setNav] = useState<NavSession | null>(() => keptNav(scope));
  useEffect(() => { keepNav(scope, nav); }, [scope, nav]);
  const navPlan = useMemo(() => (nav === null || !world.places.has(nav.target) ? null
    : planRoute(state, nav.target, { choices: nav.choices })), [nav, state, world]);
  /* Der Fahrplan merkt, was erledigt ist (eine gewählte Abzweigung ist es nicht). */
  const ttRef = useRef<{ tt: Timetable | null; nav: NavSession | null }>({ tt: null, nav: null });
  const tt = useMemo((): Timetable | null => {
    if (navPlan === null) { ttRef.current = { tt: null, nav }; return null; }
    const prev = ttRef.current;
    const next = followPlan(prev.tt, navPlan, prev.nav !== nav);
    ttRef.current = { tt: next, nav };
    return next;
  }, [navPlan, nav]);
  const marks = useMemo(() => (tt === null ? null : navMarks(tt, lines)), [tt, lines]);

  /* -- Was die Felder auslösen ------------------------------------------------------------------------------------------- */
  const [running, setRunning] = useState<Running | null>(null);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [mine, setMine] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const pillars = useRef<PillarsHandle | null>(null);
  const cardByKey = useMemo(() => new Map(cards.map((c) => [c.key, c] as const)), [cards]);
  const cardsOf = (keysOf: readonly string[]): Card[] => keysOf.map((k) => cardByKey.get(k)).filter((c): c is Card => c !== undefined && !(progress?.suspended.has(c.key) ?? false));
  const startCards = (keysOf: readonly string[], title: string, review: boolean) => {
    /* Eine Wiederholung nur mit Karten, die wiederholt werden dürfen (Korrektur 5); Lernen ist keine Wiederholung. */
    const list = review ? cardsOf(keysOf).filter((c) => reviewable(c.key, state)) : cardsOf(keysOf);
    if (list.length === 0) { setNote(t('cogitaWorld.panel.nothing')); return; }
    setNote(null);
    const plan = readPlan(list, { mode: 'temporal', order: 'general', pick: 'next', stackSize: stackFor(lib, learner), endWhenDone: true });
    setRunning({ kind: 'cards', key: `${review ? 'review' : 'learn'}:${Date.now()}`, source: { plan, cards, title, ...(review ? { review: true } : {}) } });
  };
  const findFlow = (id: string): Flow | undefined => { const d = lib.docs('flow').find((one) => one.id === id); return d === undefined ? undefined : readFlow(d.id, d.data); };
  /* Einen Abschnitt fahren: die Erzählung an seinem Anfang — an einer Wahl gleich im Zweig (`jumpTo.exit`). */
  const travel = (sectionId: string) => {
    const s = lines.sections.get(sectionId);
    if (s === undefined) return;
    const given = flowById.get(s.line) ?? findFlow(s.line);
    if (given === undefined) return;
    const full = resolveFlow(given, findFlow);
    const raw = s.start ?? (s.steps[0] !== undefined ? { step: s.steps[0] } : null);
    const step = raw === null ? null : outerStep(raw.step);
    const exit = raw !== null && step === raw.step ? raw.exit : undefined;
    setNote(null);
    setRunning({ kind: 'story', key: `story:${full.id}:${Date.now()}`, flow: full, jump: step === null ? null : { step, at: Date.now(), ...(exit === undefined ? {} : { exit }) } });
  };
  const lead = (target: string, via?: string) => {
    const choices = new Map<string, string>(nav !== null && nav.target === target ? nav.choices : []);
    if (via !== undefined) for (const k of lines.sections.get(via)?.introduces ?? []) for (const p of world.cardPlaces.get(k) ?? []) choices.set(p, via);
    setNav({ target, choices });
  };
  const act: PanelActions = {
    travel,
    learn: (keysOf, title) => startCards(keysOf, title, false),
    review: (keysOf, title) => startCards(keysOf, title, true),
    run: (place) => { setNote(null); setRunning({ kind: 'run', key: `run:${place}:${Date.now()}`, place }); },
    lead,
    show: (kind, id) => { setChosen({ kind, id }); if (kind === 'place') pillars.current?.focus(id); },
    ...(onOpen === undefined ? {} : { open: onOpen })
  };
  const go = (step: PlanStep) => {
    if (step.kind === 'travel') {
      const st = state.sections.get(step.section);
      const s = lines.sections.get(step.section);
      if (st !== undefined && !st.ticket.met) { startCards([...st.ticket.missing.new, ...st.ticket.missing.review], s === undefined ? '' : nameOf(s.to), false); return; }
      travel(step.section);
      return;
    }
    if (step.kind === 'learn' || step.kind === 'know') { startCards(step.cards, nameOf(step.place), false); return; }
    if (step.kind === 'run') act.run(step.place);
  };
  const panel: PanelCtx = { state, t, canLearn: learner !== null, colours, nameOf, act };
  const issues = useMemo(() => (writes ? authorIssues(world, lines, geometry, regions, world.order) : []), [writes, world, lines, geometry, regions]);

  /* -- „Sprawdź, co wiesz" und „Uzupełnij luki" (wie im Krajobraz, `selfCheck.ts`): jede Kernfrage der Orte genau einmal ------- */
  const placeIds = useMemo(() => new Set(world.places.keys()), [world]);
  const runOnce = (title: string, list: readonly Card[]) => {
    const free = list.filter((c) => !(progress?.suspended.has(c.key) ?? false));
    if (free.length === 0) { setNote(SC.checkNone); return; }
    setNote(null);
    setRunning({ kind: 'cards', key: `check:${Date.now()}`, source: { plan: readPlan(free, { mode: 'once', order: 'general', pick: 'next' }), cards, title } });
  };
  const checkAll = () => { setMode('gaps'); runOnce(SC.checkTitle(baseName), selfCheckCards(cards, placeIds)); };
  const fillGaps = gapsNow.gaps.size === 0 ? null : () => runOnce(SC.fillTitle(baseName), fillCards(cards, gapsNow.gaps, gapsNow.checked, Date.now().toString(36)));
  /* Die Liste aller Orte (für die Tastatur): erst beim Öffnen gebaut. */
  const [listOpen, setListOpen] = useState(false);

  /*
    -- Was sich seit dem letzten Zeigen änderte (wie im Krajobraz, `landscapeShown.ts`; je Lernendem, Baza und Widok) -------------
    Kommt der Lernende zurück (nach einer Erzählung, Karten, einem Durchgang, dem Laden), spielt die Karte den Unterschied ab —
    mit den Punkten, die seither kamen (nur mit Nagrody); ändert sich etwas, während sie zu sehen ist: dasselbe ohne Punkte. Beim
    ersten Mal steigen die Säulen nur auf. Gezeichnet in `WorldPillars` (Zeitplan: `wmViews.ts`).
  */
  const mapShown = running === null && scene !== null;
  const back = useRef(true);
  if (!mapShown) back.current = true;
  const shownStore = shownKey(lib.libraryId, `world:${viewKey}`, learner === null ? 'me' : holderKey(learner.holder));
  const shownMem = useRef<{ key: string; state: ShownState | null } | null>(null);
  if (shownMem.current === null || shownMem.current.key !== shownStore) { shownMem.current = { key: shownStore, state: readShown(shownStore) }; back.current = true; }
  const shownNow = useMemo(() => new Map([...state.places].map(([id, ps]) => [id, shownOfPlace(ps)] as const)), [state]);
  const pointsRules = useMemo(() => rewards ?? rewardsFor(lib.docs('reward'), null, lib.settings().rewards ?? null).rules, [rewards, lib, lib.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  /*
    Step 3 · 3 — haben sich die Stufen seit der letzten Meldung dieses Lernenden geändert (die Baza, ein anderes Gerät, eine
    neue Weltkarte), zählt der Dienst die fälligen Karten neu — sonst stünde bis zur nächsten Wiederholung die alte Zahl.
  */
  const dueKey = JSON.stringify([eff.levels, eff.rules]);
  useEffect(() => {
    if (learner === null) return;
    const mark = `cg-wm2-due:${lib.libraryId}:${holderKey(learner.holder)}`;
    let was: string | null = null;
    try { was = localStorage.getItem(mark); } catch { /* ohne Speicher: jedes Mal */ }
    if (was === dueKey) return;
    try { localStorage.setItem(mark, dueKey); } catch { /* ohne Speicher */ }
    void lib.cards().then((r) => reportDueFor(lib, r.cards, learner, rename), () => undefined);
  }, [learner, lib, dueKey, rename]);
  const rw = useRewards(learner, pointsRules, { rename });
  const events = rw.state?.events ?? null;
  const orderIndex = useMemo(() => new Map(world.order.map((id, i) => [id, i] as const)), [world]);
  const playSeq = useRef(0);
  const playback = useMemo((): WorldPlayback | null => {
    if (!mapShown || learner === null) return null;
    const was = shownMem.current?.state ?? null;
    if (was === null) {
      playSeq.current += 1;
      return { id: playSeq.current, kind: 'first', before: new Map(), conquered: [], levelled: [], reviewed: [], opened: [], lowered: [], moved: [], fresh: [...shownNow.keys()], points: new Map(), rest: 0 };
    }
    const kind: WorldPlayback['kind'] = back.current ? 'return' : 'live';
    const { any, ...d } = diffPlaces(was.topics, shownNow, shortId);
    /* Punkte nur, wo sie zählen (die Läufe hier zeigen sie): je Ort über die Karte der Antwort, der Rest als eine Summe. */
    const placeIndex = (k: string): number | undefined => { const p = world.cardPlaces.get(k)?.[0] ?? (rename === undefined ? undefined : world.cardPlaces.get(rename(k))?.[0]); return p === undefined ? undefined : orderIndex.get(p); };
    const pts = kind === 'return' && rewards !== null && events !== null ? pointsSince(events, was.at, placeIndex) : null;
    const points = new Map<string, number>();
    for (const [i, n] of pts?.byTopic ?? []) { const id = world.order[i]; if (id !== undefined) points.set(id, n); }
    const rest = pts?.rest ?? 0;
    if (!any && points.size === 0 && rest === 0) return null;
    playSeq.current += 1;
    return { id: playSeq.current, kind, ...d, points, rest };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- der gemerkte Stand ändert sich nur nach dem Zeigen (unten)
  }, [mapShown, shownNow, events, learner]);
  /* Gezeigt ist gezeigt: der Stand von jetzt wird der letzte (gleich gespeichert — auch wenn er gleich weitergeht). */
  useEffect(() => {
    if (!mapShown || learner === null) return;
    const now: ShownState = { v: 1, at: Date.now(), topics: Object.fromEntries([...shownNow].map(([id, s]) => [shortId(id), packPlace(s)])), pieces: [] };
    shownMem.current = { key: shownStore, state: now };
    back.current = false;
    keepShown(shownStore, now);
  }, [mapShown, shownNow, shownStore, learner]);
  /* Das zuletzt errechnete Abspielen bleibt, bis die Karte es nimmt (sie beginnt erst, wenn sie ihre Farben kennt). */
  const lastPlay = useRef<WorldPlayback | null>(null);
  if (!mapShown) lastPlay.current = null;
  else if (playback !== null) lastPlay.current = playback;
  /* Die Punkte in der Luft: so viel tiefer steht der Zähler oben, bis sie ankommen (ein kleiner Speicher, wie im Krajobraz). */
  const held = useMemo(() => holdStore(), []);
  const pb0 = lastPlay.current;
  if (pb0 !== null && pb0.id !== held.forId()) held.prime(pb0.id, pb0.kind === 'return' ? [...pb0.points.values()].reduce((s, n) => s + n, 0) + pb0.rest : 0);
  const [won, setWon] = useState<{ readonly names: readonly string[]; readonly points: number } | null>(null);
  const [replayUntil, setReplayUntil] = useState(0);
  const onPlayback = (e: PlayEvent) => {
    if (e.kind === 'start') { held.prime(e.id, 0); held.set(e.points); return; }
    if (e.kind === 'points') { held.set(held.get() - e.n); return; }
    if (e.kind === 'end') { held.set(0); if (lastPlay.current?.kind === 'return') setReplayUntil(Date.now() + REPLAY_MS); return; }
    const pts = e.places.reduce((s, id) => s + (lastPlay.current?.points.get(id) ?? 0), 0);
    setWon({ names: e.places.map((id) => world.places.get(id)?.label ?? id), points: pts });
  };
  useEffect(() => {
    if (replayUntil === 0) return undefined;
    const id = window.setTimeout(() => setReplayUntil(0), Math.max(0, replayUntil - Date.now()));
    return () => window.clearTimeout(id);
  }, [replayUntil]);
  /*
    Die Masse der Karte für die Abzeichen der Erkundung (wie im Krajobraz, `mapMeasures.ts`): eroberte Farbflächen, der Anteil
    eroberter Orte, Tage ohne Überfälliges. Ein eben erreichtes Abzeichen bekommt sein Datum beim Lernenden.
  */
  const fpOf = useMemo(() => new Map(cards.map((c) => [c.key, c.fingerprint] as const)), [cards]);
  useEffect(() => {
    if (!mapShown || learner === null) return undefined;
    const id = window.setTimeout(() => {
      const areas = new Map<string, boolean>();
      let conquered = 0;
      for (const [pid, ps] of state.places) { const k = keys.get(pid) ?? pid; areas.set(k, (areas.get(k) ?? true) && ps.conquered); if (ps.conquered) conquered += 1; }
      const m = {
        regions: [...areas.values()].filter(Boolean).length,
        map: state.places.size === 0 ? 0 : Math.floor((100 * conquered) / state.places.size),
        clean: cleanDays(cards, (key) => learner.marks(key, fpOf.get(key), rename), Date.now(), learner.spacing)
      };
      keepMapMeasures(lib.libraryId, learner.holder, m);
      if (rewards === null) return;
      const add = freshAwards(rewards, m, awardsOf(learner.progress.values), Date.now());
      if (Object.keys(add).length > 0) void learner.keepAwards(add).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapShown, state, learner, rewards]);

  /* -- Zeigen: die Blase, der Weg, die Navigation ---------------------------------------------------------------------- */
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const routeTo = useMemo(() => (hover === null ? null : state.routeTo(hover.id)), [hover, state]);
  const chosenRoute = chosen?.kind === 'section' ? [chosen.id] : null;
  const route = routeTo ?? chosenRoute ?? marks?.next ?? null;
  const faint = marks === null ? null : routeTo !== null || chosenRoute !== null ? [...marks.next, ...marks.later] : marks.later;
  const bubble = (() => {
    if (hover === null || scene === null) return null;
    const p = scene.byId.get(hover.id);
    if (p === undefined) return null;
    const sum = routeTo === null ? null : state.summary(routeTo);
    return (
      <div className="cg-wm-bubble" ref={(el) => { if (el !== null) { el.style.left = `${hover.x}px`; el.style.top = `${hover.y}px`; } }} role="status" data-world-bubble={p.id}>
        <strong>{p.label}</strong>
        <span>{p.conquered ? t('cogitaWorld.map.conquered') : t('cogitaWorld.map.cardsToGo', { count: p.missing })}</span>
        {sum === null ? <span className="cg-muted">{t('cogitaWorld.map.noRoute')}</span>
          : <span className="cg-muted">{t('cogitaWorld.map.fromHome')} {t('cogitaWorld.map.sections', { count: sum.sections })} · {t('cogitaWorld.map.fresh', { count: sum.fresh })} · {t('cogitaWorld.map.review', { count: sum.review })}</span>}
        {!p.conquered && <span className="cg-muted">{t('cogitaWorld.map.leadHint')}</span>}
      </div>
    );
  })();

  const host = (body: ReactNode) => (
    <div className={`cg-ls cg-wm-host${compact ? ' is-compact' : ''}`} data-world-view={viewKey} data-world-places={world.places.size} data-world-lines={lines.lines.size}
      data-world-geometry={geometry === null ? 'pending' : geometry.version} data-world-geometry-runs={geometryRuns} data-world-levels={eff.levels} data-world-nav={nav?.target ?? ''}>
      {body}
      {more}
    </div>
  );

  if (world.places.size === 0) return <p className="cg-muted" data-world-empty="">{t('cogitaWorld.map.empty')}</p>;

  if (running !== null) {
    const back = () => setRunning(null);
    if (running.kind === 'story') {
      /* Die Karte hat die Fahrkarte geprüft: der Spieler sperrt nicht noch einmal (an Umsteigeorten steigt man mitten ein). */
      return host(
        <div className="cg-ls-run" data-world-running="story" data-world-running-flow={running.flow.id}>
          <FlowPlayer key={running.key} flow={running.flow} content={contentOfLibrary(lib, cards)} learner={learner} onClose={back} backLabel={t('cogitaWorld.panel.mapShort')} jumpTo={running.jump} gate={false} />
        </div>
      );
    }
    if (running.kind === 'run' && learner !== null) {
      const p = world.places.get(running.place);
      return host(
        <div className="cg-ls-run" data-world-running="run">
          <WorldRun lib={lib} learner={learner} place={running.place} name={p?.label ?? running.place} cards={cardsOf(state.places.get(running.place)?.cards ?? p?.cards ?? [])} onClose={back} />
        </div>
      );
    }
    if (running.kind === 'cards') {
      return host(
        <div className="cg-ls-run" data-world-running={running.key.split(':')[0]}>
          <p className="cg-ls-back"><button type="button" className="wk-link-btn" onClick={back} data-world-back="">‹ {t('cogitaWorld.panel.backToMap')}</button></p>
          <RevisionRun key={running.key} lib={lib} learner={learner} source={running.source} onClose={back} backToMap={back} />
        </div>
      );
    }
  }

  const hasSide = tt !== null || chosen !== null || note !== null;
  const modes = WORLD_MODES.filter((m) => m !== 'gaps' || learner !== null);
  const goalSteps = goal === null ? 0 : state.conquestOrder(goal).length;
  const wonNames = won === null ? '' : won.names.slice(0, 2).join(', ') + (won.names.length > 2 ? ` +${won.names.length - 2}` : '');
  return host(
    <div className={`cg-wm-body${hasSide ? ' has-side' : ''}`}>
      <div className="cg-wm-main">
        {/* Wie im Krajobraz: was die Karte zeigt (gemerkt mit dem Blick), „Sprawdź, co wiesz", der Zähler der Punkte. */}
        <div className="cg-wm-top">
          <div className="cg-wm-modes" role="group" aria-label={T.modeLabel} data-world-modes={shownMode}>
            {modes.map((m) => (
              <button key={m} type="button" className={`cg-wm-mode${shownMode === m ? ' is-on' : ''}`} aria-pressed={shownMode === m} onClick={() => setMode(m)} data-world-mode={m}>
                {m === 'all' ? T.modeAll : m === 'known' ? T.modeKnown : m === 'discover' ? T.modeDiscover : m === 'due' ? T.modeDue : SC.gaps}{m === 'gaps' && gapsNow.gaps.size > 0 ? ` (${gapsNow.gaps.size})` : ''}
              </button>
            ))}
            {learner !== null && <button type="button" className="cg-wm-mode is-check" onClick={checkAll} data-world-selfcheck="">{SC.check}</button>}
          </div>
          {learner !== null && rewards !== null && <RewardBoard learner={learner} rules={rewards} rename={rename} shape="strip" hidden={compact ? POINTS_HIDDEN_SMALL : POINTS_HIDDEN} live={false} hold={held} />}
        </div>
        {won !== null && (
          <p className="wk-note cg-ls-conquered" role="status" data-world-won={won.names.join('|')} data-world-won-points={won.points}>
            <FlagIcon /> {t('cogitaWorld.map.conqueredNow', { names: wonNames })}{won.points > 0 ? ` · ${MW.points(won.points)}` : ''}
            <button type="button" className="cg-ls-qclose" aria-label={W.close} onClick={() => setWon(null)}>×</button>
          </p>
        )}
        {goalDone !== null && <p className="wk-note" role="status" data-world-goal-done={goalDone}>{W.goalDone(nameOf(goalDone))} <button type="button" className="cg-ls-qclose" aria-label={W.close} onClick={() => setGoalDone(null)}>×</button></p>}
        {goal !== null && (
          <p className="cg-ls-goal" data-world-goal={goal} data-world-goal-steps={goalSteps}>
            <span>{W.goal}: <strong>{nameOf(goal)}</strong> — {T.toGoal(goalSteps)}</span>
            <button type="button" className="wk-link-btn" onClick={() => act.show('place', goal)} data-world-goal-show="">{W.show}</button>
            <button type="button" className="wk-link-btn" onClick={() => setGoal(null)} data-world-goal-clear="">{W.clearGoal}</button>
          </p>
        )}
        <div className="cg-wm-mapwrap">
          {scene === null
            ? <p className="cg-ls-busy" role="status" data-world-computing="">{t('cogitaWorld.map.computing')}</p>
            : <WorldPillars ref={pillars} scene={scene} pillarWidth={pillarWidth} heightScale={heightScale} t={t} compact={compact}
              memoryKey={scope}
              route={route} faint={faint} chosen={chosen?.kind === 'place' ? chosen.id : null}
              marks={marks === null ? null : { start: marks.start, target: marks.target, forks: marks.forks }}
              lit={lit} portals={portals} goal={goal} playback={lastPlay.current} onPlayback={onPlayback}
              onHover={(id, at) => setHover(id === null || at === null ? null : { id, x: at.x, y: at.y })}
              onPick={(id) => setChosen(id === null ? null : { kind: 'place', id })}
              onPickLane={(id) => setChosen({ kind: 'section', id })}
              onPickHome={() => setChosen({ kind: 'home', id: HOME })}
              onLead={(id) => { lead(id); setChosen({ kind: 'place', id }); }} />}
          {bubble}
          {shownMode === 'due' && lit !== null && lit.size === 0 && <div className="cg-wm-note" role="status" data-world-note="due">{T.nothingDue}</div>}
          {shownMode === 'discover' && lit !== null && lit.size === 0 && <div className="cg-wm-note" role="status" data-world-note="discover">{T.nothingReady}</div>}
          {shownMode === 'gaps' && (
            <div className="cg-wm-note is-gaps" role="status" data-world-note="gaps" data-world-gaps={gapsNow.gaps.size}>
              {gapsNow.checked.size === 0 ? SC.gapsFirst : gapsNow.gaps.size === 0 ? SC.gapsNone : null}
              {fillGaps !== null && <button type="button" className="wk-btn is-small" onClick={fillGaps} data-world-fill="">{SC.fill}</button>}
            </div>
          )}
          {replayUntil > 0 && lastPlay.current !== null && (
            <button type="button" className="cg-wm-replay" onClick={() => pillars.current?.replay()} data-world-replay="">
              <svg viewBox="-8 -8 16 16" aria-hidden><path d="M5.2,-2.6 A6,6 0 1 0 6,1.4 M5.2,-2.6 L1.6,-3.2 M5.2,-2.6 L5.8,0.8" /></svg>{MW.replay}
            </button>
          )}
        </div>
        <div className="cg-wm-sliders">
          <label className="wk-field cg-world-pillar">
            <span>{t('cogitaWorld.map.height', { pct: Math.round(heightScale * 100) })}</span>
            <input type="range" min={0} max={100} step={1} value={Math.round(heightScale * 100)} onChange={(e) => setHeightScale(Number(e.target.value) / 100)} data-world-height="" />
          </label>
          <PillarSlider value={pillarWidth} t={t} onLive={setPillarLive} onCommit={(w) => { setPillarLive(w); if (learner !== null) void learner.keepPillar(w).catch(() => undefined); }} />
          {/* Entscheidung 11 — nur Schreibende: die ganze Lage neu (sonst bleiben alte Orte stehen). */}
          {writes && <button type="button" className="wk-link-btn" onClick={() => setRelay((n) => n + 1)} data-world-relay="">{t('cogitaWorld.map.relay')}</button>}
        </div>
        {/* Alle Orte als Liste (für die Tastatur; in der Ansicht nur die farbigen): ein Ort wählt sich wie mit der Maus. */}
        <details className="cg-wm-list" onToggle={(e) => setListOpen(e.currentTarget.open)} data-world-list={world.places.size}>
          <summary>{t('cogitaWorld.map.places', { count: world.places.size })}</summary>
          {listOpen && (
            <ol className="cg-wm-rows">
              {world.order.filter((id) => lit === null || lit.has(id)).map((id) => {
                const ps = state.places.get(id);
                return (
                  <li key={id} className="cg-wm-row" data-world-list-place={id}>
                    <button type="button" className="cg-ref" onClick={() => act.show('place', id)}>{nameOf(id)}</button>
                    <span className="cg-wm-meta">{ps?.conquered === true ? t('cogitaWorld.map.conquered') : t('cogitaWorld.map.cardsToGo', { count: ps?.missing ?? 0 })}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </details>
        {writes && <AuthorList issues={issues} nameOf={nameOf} t={t} />}
      </div>
      {hasSide && (
        <div className="cg-wm-side" data-world-side="">
          {note !== null && <p className="wk-note" role="status" data-world-note="">{note}</p>}
          {tt !== null && (
            <NavPanel tt={tt} ctx={panel} rules={rules} onGo={go} onEnd={() => setNav(null)}
              onChoose={(place, section) => setNav((n) => (n === null ? n : { target: n.target, choices: new Map([...n.choices, [place, section]]) }))} />
          )}
          {chosen?.kind === 'place' && (
            <PlacePanel id={chosen.id} ctx={panel} levels={levels} rules={rules} onClose={() => setChosen(null)} onSettings={() => setMine((v) => !v)}
              settings={mine ? <OwnWorldSettings lib={lib} learner={learner} onPillarLive={setPillarLive} /> : null}
              goal={{ isGoal: goal === chosen.id, set: () => setGoal(chosen.id), clear: () => setGoal(null) }}
              worlds={<WorldsSection data={lib.entry(chosen.id)?.data} compact />} />
          )}
          {chosen?.kind === 'section' && <SectionPanel id={chosen.id} ctx={panel} onClose={() => setChosen(null)} />}
          {chosen?.kind === 'home' && <HomePanel ctx={panel} onClose={() => setChosen(null)} />}
        </div>
      )}
    </div>
  );
}
