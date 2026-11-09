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
import { baseLang } from '../lang';
import { positionFor, type Learner } from '../learn';
import type { Facts } from '../logic';
import { landscapeClient } from '../landscapeClient';
import type { RegionTree } from '../regions';
import { readPlan } from '../revision';
import { RevisionRun, type RunSource } from '../RevisionRun';
import { stackFor } from '../spacing';
import { learnerGauge } from '../storyLock';
import { useCtx } from '../ui';
import type { ViewDoc } from '../views';
import { OwnWorldSettings, PillarSlider } from './WorldLevels';
import { AuthorList, HomePanel, NavPanel, PlacePanel, SectionPanel, type PanelActions, type PanelCtx } from './WorldPanels';
import { WorldPillars, type PillarsHandle } from './WorldPillars';
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
import { effectiveWorldFor } from './wmReview';
import { levelsByPlace, type LevelRule } from './wmRuns';
import { sceneOf } from './wmScene';
import { reviewable, stateOf, type LearnerInput } from './wmState';
import { useServerRuns } from './useServerRuns';
import { keepLayout, storedLayout } from './wmStore';
import { HOME } from './wmTypes';
import './worldmap.css';

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
}

export function WorldLandscape({ view, cards, learner, onOpen, compact = false, viewKey, more }: WorldLandscapeProps) {
  const { lib, writes } = useCtx();
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
  const learnerInput = useMemo((): LearnerInput => {
    const know = (k: string) => (gauge === null ? 0 : cardKnowness(gauge, k));
    const now = Date.now();
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
      level: (place) => levels.get(place)?.level ?? 0
    };
  }, [gauge, progress, learner, flowFacts, flowById, cardOfQ, levels]);
  const state = useMemo(() => stateOf(world, lines, learnerInput, { levels: eff.levels, knownShare: eff.knownShare }), [world, lines, learnerInput, eff.levels, eff.knownShare]);

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
    const stored = relay > 0 ? undefined : storedLayout(lib)?.positions;
    const gi = geometryInputOf(world, lines, { ...(stored === undefined ? {} : { previous: stored }), ...(relay > 0 ? { mode: 'full' as const } : {}), color: (id) => keys.get(id) });
    void geometryFor(gi).then((g) => {
      if (!alive) return;
      setGeometry(g);
      setGeometryRuns((n) => n + 1);
      if (writes) void keepLayout(lib, g).catch(() => false);
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
    : planRoute(state, nav.target, { choices: nav.choices, gaps: rules.map((r) => r.gapDays), reachedAt: (p, l) => levels.get(p)?.reachedAt[l - 1] })), [nav, state, rules, levels, world]);
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
          <WorldRun lib={lib} learner={learner} place={running.place} name={p?.label ?? running.place} cards={cardsOf(p?.cards ?? [])} onClose={back} />
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
  return host(
    <div className={`cg-wm-body${hasSide ? ' has-side' : ''}`}>
      <div className="cg-wm-main">
        {scene === null
          ? <p className="cg-ls-busy" role="status" data-world-computing="">{t('cogitaWorld.map.computing')}</p>
          : <WorldPillars ref={pillars} scene={scene} pillarWidth={pillarWidth} heightScale={heightScale} t={t} compact={compact}
            memoryKey={scope}
            route={route} faint={faint} chosen={chosen?.kind === 'place' ? chosen.id : null}
            marks={marks === null ? null : { start: marks.start, target: marks.target, forks: marks.forks }}
            onHover={(id, at) => setHover(id === null || at === null ? null : { id, x: at.x, y: at.y })}
            onPick={(id) => setChosen(id === null ? null : { kind: 'place', id })}
            onPickLane={(id) => setChosen({ kind: 'section', id })}
            onPickHome={() => setChosen({ kind: 'home', id: HOME })} />}
        {bubble}
        <div className="cg-wm-sliders">
          <label className="wk-field cg-world-pillar">
            <span>{t('cogitaWorld.map.height', { pct: Math.round(heightScale * 100) })}</span>
            <input type="range" min={0} max={100} step={1} value={Math.round(heightScale * 100)} onChange={(e) => setHeightScale(Number(e.target.value) / 100)} data-world-height="" />
          </label>
          <PillarSlider value={pillarWidth} t={t} onLive={setPillarLive} onCommit={(w) => { setPillarLive(w); if (learner !== null) void learner.keepPillar(w).catch(() => undefined); }} />
          {/* Entscheidung 11 — nur Schreibende: die ganze Lage neu (sonst bleiben alte Orte stehen). */}
          {writes && <button type="button" className="wk-link-btn" onClick={() => setRelay((n) => n + 1)} data-world-relay="">{t('cogitaWorld.map.relay')}</button>}
        </div>
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
              settings={mine ? <OwnWorldSettings lib={lib} learner={learner} onPillarLive={setPillarLive} /> : null} />
          )}
          {chosen?.kind === 'section' && <SectionPanel id={chosen.id} ctx={panel} onClose={() => setChosen(null)} />}
          {chosen?.kind === 'home' && <HomePanel ctx={panel} onClose={() => setChosen(null)} />}
        </div>
      )}
    </div>
  );
}
