/**
 * 2026-11-09 — DIE WELTKARTE ALS GESTALT EINES WIDOKU (Entscheidung 2: `landscape.style: "world"` in der Hülle des Krajobraz;
 * das Sechseck bleibt die Vorgabe). Hier kommt alles zusammen: das Modell aus der Baza (`wmInput` → `readWorld` → `linesOf`),
 * der Stand des Lernenden (`stateOf`, Stufen aus seinen Durchgängen), die Gestalt (im Worker, gemerkt; Schreibende legen die
 * Lage ab), die Farben (Thema der Säulen, eigene Palette der Linien) und der Zeichner. Die Felder daneben (Ort, Abschnitt,
 * Umsteigeort, Navigation) bringt `WorldPanels.tsx`.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { tFor } from '../../core/i18n';
import { useDark } from '../../core/theme';
import type { Card } from '../cardBasics';
import { cardOfQuestion, flowQuestionsKnown, learnerFlows, storyStage } from '../flowFacts';
import { cardKnowness, itemKnowness } from '../knowing';
import { KNOWN } from '../knowness';
import { baseLang } from '../lang';
import { positionFor, type Learner } from '../learn';
import type { Facts } from '../logic';
import { landscapeClient } from '../landscapeClient';
import { readNest } from '../landscapeNest';
import type { RegionTree } from '../regions';
import type { CogitaLibrary } from '../store';
import { learnerGauge } from '../storyLock';
import { useCtx } from '../ui';
import type { ViewDoc } from '../views';
import { PillarSlider } from './WorldLevels';
import { WorldPillars, type PillarsHandle } from './WorldPillars';
import { lineColours, oklch, type Rgb } from './wmColors';
import { geometryInputOf, type Geometry } from './wmGeometry';
import { geometryFor } from './wmGeometryClient';
import { readWorld } from './wmGraph';
import { worldInputOf } from './wmInput';
import { linesOf } from './wmLines';
import { effectiveWorldFor } from './wmReview';
import { levelsByPlace } from './wmRuns';
import { sceneOf } from './wmScene';
import { stateOf, type LearnerInput } from './wmState';
import { keepLayout, storedLayout } from './wmStore';
import type { World } from './wmTypes';
import './worldmap.css';

/** Die Farben der Themen: wie im Krajobraz die acht des Bereichs, sonst grau (hell und dunkel). */
const TOPIC = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
} as const;
const NONE = { light: '#8d8a82', dark: '#6f6b62' } as const;
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/**
 * Wozu ein Ort farblich gehört (wie im Krajobraz): der oberste Knoten des Widoku (`nest`), sonst sein oberstes Gebiet
 * (`regions.ts`, aus den Voraussetzungen gerechnet), sonst seine Grundlage ganz unten.
 */
function colourKeys(lib: CogitaLibrary, world: World, view: ViewDoc, regions: RegionTree | null): Map<string, string> {
  const out = new Map<string, string>();
  const nestField = view.landscape?.nest;
  if (nestField !== undefined) {
    const tree = readNest(lib, world.order, nestField, view.landscape?.nestSort ?? 'nr');
    for (const id of world.order) {
      let at = tree.home.get(id) ?? null;
      let guard = 0;
      while (at !== null && guard < 32) { const parent = tree.nodes.get(at)?.parent ?? null; if (parent === null) break; at = parent; guard += 1; }
      if (at !== null) out.set(id, at);
    }
  }
  if (regions !== null) for (const id of world.order) { const top = regions.assignment[id]?.[0]; if (top !== undefined && !out.has(id)) out.set(id, top); }
  for (const id of world.order) {
    if (out.has(id)) continue;
    const roots = [...world.base(id)].filter((b) => world.places.get(b)?.depth === 0);
    out.set(id, roots.sort()[0] ?? id);
  }
  return out;
}

export interface WorldLandscapeProps {
  readonly view: ViewDoc;
  readonly cards: readonly Card[];
  readonly learner: Learner | null;
  readonly onOpen?: (id: string) => void;
  readonly compact?: boolean;
  readonly viewKey: string;
  readonly more?: ReactNode;
}

export function WorldLandscape({ view, cards, learner, compact = false, viewKey, more }: WorldLandscapeProps) {
  const { lib, writes } = useCtx();
  const lang = baseLang(lib);
  const t = tFor(lang);
  const dark = useDark();

  /* -- Das Modell (einmal je Stand der Baza) ------------------------------------------------------------------------- */
  const placeKinds = useMemo(() => (view.steps ?? []).filter((s) => s.type === 'source.kind').map((s) => String((s.config as Record<string, unknown>).kind ?? '')).filter((k) => k !== ''), [view]);
  const input = useMemo(() => worldInputOf(lib, cards, { placeKinds }), [lib, lib.revision, cards, placeKinds]); // eslint-disable-line react-hooks/exhaustive-deps
  const world = useMemo(() => readWorld(input), [input]);
  const lines = useMemo(() => linesOf(world, input.flows), [world, input]);
  const flowById = useMemo(() => new Map(input.flows.map((f) => [f.id, f] as const)), [input]);

  /* -- Der Lernende ---------------------------------------------------------------------------------------------------- */
  const progress = learner?.progress;
  const gauge = useMemo(() => (learner === null ? null : learnerGauge(lib, cards, learner)), [lib, lib.revision, cards, learner, progress]); // eslint-disable-line react-hooks/exhaustive-deps
  const eff = effectiveWorldFor(lib, learner);
  const [pillarLive, setPillarLive] = useState<number | null>(null);
  const pillarWidth = pillarLive ?? eff.pillarWidth;
  const [heightScale, setHeightScale] = useState(1);
  const levels = useMemo(() => levelsByPlace(progress?.runs.values() ?? [], eff.rules, eff.levels), [progress, eff.levels, JSON.stringify(eff.rules)]); // eslint-disable-line react-hooks/exhaustive-deps
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
    const ids = world.order;
    const index = new Map(ids.map((id, i) => [id, i] as const));
    const graph = { ids, labels: ids.map((id) => world.places.get(id)!.label), needs: ids.map((id) => world.places.get(id)!.needs.map((n) => index.get(n)!).filter((i) => i !== undefined)) };
    void client.regions({ key: `wm:${ids.length}:${ids[0] ?? ''}`, graph, lang }).then((tree) => { if (alive) { setRegions(tree); setRegionsDone(true); } }, () => { if (alive) setRegionsDone(true); });
    return () => { alive = false; client.dispose(); };
  }, [world, view, lang]);
  const keys = useMemo(() => colourKeys(lib, world, view, regions), [lib, world, view, regions]);
  const placeColour = useMemo(() => {
    const order: string[] = [];
    for (const id of world.order) { const k = keys.get(id) ?? id; if (!order.includes(k)) order.push(k); }
    const pal = dark ? TOPIC.dark : TOPIC.light;
    const index = new Map(order.map((k, i) => [k, i] as const));
    return (id: string): Rgb => { const i = index.get(keys.get(id) ?? id) ?? 99; return hex(i < pal.length ? pal[i] : dark ? NONE.dark : NONE.light); };
  }, [world, keys, dark]);
  const colours = useMemo(() => lineColours(lines, dark ? 'dark' : 'light'), [lines, dark]);

  /* -- Die Gestalt: im Worker, gemerkt; Schreibende legen die Lage ab ------------------------------------------------- */
  const [geometry, setGeometry] = useState<Geometry | null>(null);
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
      if (writes) void keepLayout(lib, g).catch(() => false);
    });
    return () => { alive = false; };
  }, [world, lines, keys, relay, regionsDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const scene = useMemo(() => (geometry === null ? null : sceneOf(world, lines, state, geometry, { placeColour, lineColour: colours, fallback: oklch(0.5, 0.05, 250) })), [world, lines, state, geometry, placeColour, colours]);

  /* -- Zeigen, Blase, Wahl ---------------------------------------------------------------------------------------------- */
  const pillars = useRef<PillarsHandle | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [chosen, setChosen] = useState<{ kind: 'place' | 'section' | 'home'; id: string } | null>(null);
  const routeTo = useMemo(() => (hover === null ? null : state.routeTo(hover.id)), [hover, state]);
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

  if (world.places.size === 0) return <p className="cg-muted" data-world-empty="">{t('cogitaWorld.map.empty')}</p>;
  return (
    <div className={`cg-ls cg-wm-host${compact ? ' is-compact' : ''}`} data-world-view={viewKey} data-world-places={world.places.size} data-world-lines={lines.lines.size}
      data-world-geometry={geometry === null ? 'pending' : geometry.version} data-world-levels={eff.levels}>
      <div className="cg-wm-body">
        <div className="cg-wm-main">
          {scene === null
            ? <p className="cg-ls-busy" role="status" data-world-computing="">{t('cogitaWorld.map.computing')}</p>
            : <WorldPillars ref={pillars} scene={scene} pillarWidth={pillarWidth} heightScale={heightScale} t={t} compact={compact}
              memoryKey={`${lib.libraryId}:${viewKey}`}
              route={routeTo} chosen={chosen?.kind === 'place' ? chosen.id : null}
              onHover={(id, at) => setHover(id === null || at === null ? null : { id, x: at.x, y: at.y })}
              onPick={(id) => setChosen(id === null ? null : { kind: 'place', id })}
              onPickLane={(id) => setChosen({ kind: 'section', id })}
              onPickHome={() => setChosen({ kind: 'home', id: '~home' })} />}
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
        </div>
      </div>
      {more}
    </div>
  );
}
