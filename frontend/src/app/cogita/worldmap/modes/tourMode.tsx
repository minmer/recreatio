/**
 * MODUS „RUNDGANG" (2026-11-14, Eigentümer — `WorldTour.tsx`): auf dieser Karte, mit erfundenem Fortschritt. Er zeichnet ein eigenes Bild
 * (`scene`) aus einem erfundenen Stand — alles andere (Weg, Ziel, Punkte, das Gemerkte) rechnet weiter mit dem echten Stand. Er ist
 * ausschliessend: Klicks zählen nur auf das Gezeigte (`hit`), kein Überfahren, kein Seitenfeld, kein Abspielen, kein Vollbild aus dem
 * Menü, und aus dem Menü beginnt nichts anderes. Die Kamera gleitet zu jedem Teil; beim ersten Mal (je Baza und Widok auf diesem Gerät)
 * beginnt er von selbst.
 *
 * Zwei Teile: `useTour` (der Stand des Rundgangs — er braucht die Karte, aber keine Knöpfe) und `tourMode` (was er der Karte gibt — dafür
 * die echten Knöpfe der Türme, im Rundgang ohne Wirkung).
 */

import { useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from 'react';

import type { T } from '../../../core/i18n';
import type { MapMode, MapTowerActions } from '../mapMode';
import { keepTourSeen, TourCard, tourInput, tourSeen, tourSteps, tourWanted, type TourAction, type TourStep } from '../WorldTour';
import type { PanelCtx } from '../WorldPanels';
import type { PillarsHandle, TowerButton } from '../WorldPillars';
import { NextView } from '../WorldWay';
import { nodeFocus, routeFocus, type RouteFocus } from '../wmFocus';
import { oklch, type lineColours, type Rgb } from '../wmColors';
import type { Geometry } from '../wmGeometry';
import { plan as planRoute, type Plan, type PlanStep } from '../wmPlan';
import type { LevelRule } from '../wmRuns';
import { sceneOf, type Scene } from '../wmScene';
import { stateOf, type WorldState } from '../wmState';
import { HOME, type Lines, type World } from '../wmTypes';
import { stepKey } from '../wmNav';

export interface Tour {
  readonly on: boolean;
  readonly at: number | null;
  readonly list: readonly TourStep[];
  readonly step: TourStep | undefined;
  /** Der erfundene Stand (die Knöpfe zeigen ihn); `null` ausserhalb. */
  readonly state: WorldState | null;
  readonly scene: Scene | null;
  readonly done: boolean;
  readonly picked: boolean;
  readonly way: boolean;
  readonly demoPlan: Plan | null;
  readonly focus: RouteFocus | null;
  readonly demoSkipped: ReadonlySet<string>;
  readonly setDemoSkipped: (f: (was: ReadonlySet<string>) => ReadonlySet<string>) => void;
  readonly setAt: (at: number | null) => void;
  readonly setDone: (done: boolean) => void;
  readonly setPicked: (picked: boolean) => void;
  /** Ein Klick auf etwas: war es das Gezeigte? */
  readonly hit: (kind: TourAction, id: string) => boolean;
  readonly start: () => void;
  readonly stop: () => void;
  /** Für `tourMode`: Kenntnis, Stufen und die Abhängigkeiten (Bögen). */
  readonly levels: number;
  readonly lines: Lines;
  readonly seenScope: string;
}

export function useTour(input: {
  readonly state: WorldState;
  readonly world: World;
  readonly lines: Lines;
  readonly levels: number;
  readonly knownShare: number;
  readonly openAt: number | null;
  readonly clock: number;
  readonly geometry: Geometry | null;
  readonly placeColour: (id: string) => Rgb;
  readonly colours: ReturnType<typeof lineColours>;
  /** Der erste Wegweiser (aus dem letzten Bild — die Wegweiser werden nach dem Rundgang gerechnet). */
  readonly signKey: MutableRefObject<string | null>;
  readonly pillars: MutableRefObject<PillarsHandle | null>;
  /** Je Baza und Widok: schon gesehen? */
  readonly scope: string;
  /** Von selbst beginnen: wenn die Karte steht und nichts anderes sie hat. `wake`: wann das neu geprüft wird. */
  readonly autoStart: { readonly ready: boolean; readonly blocked: boolean; readonly wake: readonly unknown[] };
}): Tour {
  const { state, world, lines, levels, knownShare, openAt, clock, geometry, placeColour, colours, signKey, pillars, scope } = input;
  const [tour, setTour] = useState<number | null>(null);
  const list = useMemo(() => (tour === null ? [] : tourSteps(state, lines, world, levels, signKey.current)), [tour === null, world, lines]); // eslint-disable-line react-hooks/exhaustive-deps
  const step = tour === null ? undefined : list[tour];
  const tourState = useMemo(() => (step === undefined ? null : stateOf(world, lines, tourInput(world, lines, step.sim, clock), { levels, knownShare, openAt })),
    [step, world, lines, clock, levels, knownShare, openAt]);
  const scene = useMemo(() => (tourState === null || geometry === null ? null : sceneOf(world, lines, tourState, geometry, { placeColour, lineColour: colours, fallback: oklch(0.5, 0.05, 250) })),
    [tourState, geometry, world, lines, placeColour, colours]);
  const on = step !== undefined;
  /* 2026-11-14 — der Rundgang wartet auf den Klick auf das Gezeigte (je Schritt neu). */
  const [done, setDone] = useState(false);
  /* 2026-11-21 — „Odkryj" im Rundgang: erst den Turm anklicken (seine Knöpfe erscheinen), dann „Odkryj". */
  const [picked, setPicked] = useState(false);
  useEffect(() => { setDone(false); setPicked(false); }, [tour]);
  /* Die Leiste zum Ausprobieren: übersprungene (nur im Rundgang). */
  const [demoSkipped, setDemoSkipped] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => { setDemoSkipped(new Set()); }, [tour]);
  /* Der Weg zum gewählten Turm: erst nach „Odkryj" (oder in einem Schritt ohne diese Aufgabe) gezeichnet, mit seiner Leiste. */
  const way = step?.explore !== undefined && (step.action?.kind !== 'explore' || done);
  const demoPlan = useMemo(() => (step?.demo === undefined || (step.explore !== undefined && !way) ? null : planRoute(tourState ?? state, step.demo)), [step, way, tourState, state]);
  const focus = useMemo(() => (way && demoPlan !== null && tourState !== null ? routeFocus(demoPlan, tourState, lines) : null), [way, demoPlan, tourState, lines]);
  const hit = (kind: TourAction, id: string): boolean => {
    const want = step?.action;
    if (want === undefined || done) return false;
    if (want.kind === 'explore') {
      if (kind === 'place' && id === want.id) { setPicked(true); return true; }
      if (kind !== 'explore' || !picked) return false;
    }
    const ok = want.kind === kind && (want.id === id || kind === 'step' || (kind === 'section' && (step?.route ?? []).includes(id)));
    if (ok) setDone(true);
    return ok;
  };
  /* Die Kamera gleitet zu seinem Teil. */
  useEffect(() => {
    if (step === undefined) return;
    const f = step.focus;
    if (f.kind === 'all') pillars.current?.fit(); else if (f.kind === 'place' && step.zoom !== undefined) pillars.current?.lookAt(f.id, step.zoom); else pillars.current?.glide(f.kind, f.id);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Nach „Odkryj" im Rundgang: die ganze Karte mit dem ganzen Weg. */
  useEffect(() => { if (way && step?.action?.kind === 'explore') pillars.current?.fit(); }, [way]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Beim ersten Mal von selbst (nicht, solange eine Einladung, ein anderer Modus oder ein Teil die Karte hat). */
  const { ready, blocked, wake } = input.autoStart;
  useEffect(() => {
    if (tour !== null || !ready || blocked || !tourWanted() || tourSeen(scope)) return;
    keepTourSeen(scope);
    setTour(0);
  }, [...wake, scope]); // eslint-disable-line react-hooks/exhaustive-deps -- einmal, sobald die Karte steht
  return {
    on, at: tour, list, step, state: tourState, scene, done, picked, way, demoPlan, focus, demoSkipped,
    setDemoSkipped: (f) => setDemoSkipped(f), setAt: setTour, setDone, setPicked, hit,
    start: () => setTour(0), stop: () => setTour(null), levels, lines, seenScope: scope
  };
}

/** Was der Rundgang der Karte gibt. `buttons`: die echten Knöpfe eines Dings (mit dem erfundenen Stand). */
export function tourMode(tour: Tour, ctx: {
  readonly t: T;
  readonly panel: PanelCtx;
  readonly rules: readonly LevelRule[];
  /** Einen Schritt der Leiste auf der Karte zeigen. */
  readonly showStep: (s: PlanStep) => void;
  readonly buttons: (kind: string, id: string) => TowerButton[];
}): MapMode {
  const step = tour.step;
  if (step === undefined) return { id: 'tour', active: false };
  const { t } = ctx;
  const demo = tour.demoPlan;
  const under: ReactNode = demo === null || step.demo === undefined ? null : (
    <div className="cg-wm-waycard" data-world-tour-demo="">
      <NextView tt={{ target: step.demo, done: [], upcoming: demo.steps.filter((x) => !tour.demoSkipped.has(stepKey(x))), cards: demo.cards, route: demo.route }}
        order={demo.steps} skipped={tour.demoSkipped} ctx={ctx.panel} rules={ctx.rules} just={new Set()} card
        onShow={(x) => { ctx.showStep(x); tour.hit('step', stepKey(x)); }} onGo={() => undefined} onMap={() => undefined} onEnd={() => undefined}
        onSkip={(x) => tour.setDemoSkipped((was) => new Set([...was, stepKey(x)]))} onRestore={(x) => tour.setDemoSkipped((was) => { const n = new Set(was); n.delete(stepKey(x)); return n; })} />
    </div>
  );
  const towerActions = ((): MapTowerActions | null => {
    const ac = step.action;
    if (ac === undefined || ac.kind === 'step') return null;
    const kind = ac.kind === 'section' ? 'section' as const : ac.kind === 'sign' ? 'sign' as const : 'place' as const;
    if (ac.kind === 'explore') {
      /* Der Weg ist gezeichnet: keine Knöpfe über ihm. Sonst: ein Pfeil auf den Turm, dann seine Knöpfe — „Odkryj" pulsiert und wirkt. */
      if (tour.done) return null;
      if (!tour.picked) return { place: ac.id, kind, buttons: [{ key: 'tap', label: '▼', arrow: true, title: t('cogitaWorld.tour.tapHere'), onClick: () => tour.setPicked(true), data: { 'world-tour-tap': ac.id } }] };
      const go = { pulse: true, onClick: () => { tour.hit('explore', ac.id); }, data: { 'world-tour-explore': ac.id } };
      const real = ctx.buttons('place', ac.id).filter((b) => b.key !== 'tour');
      const has = real.some((b) => b.key === 'explore');
      return { place: ac.id, kind, buttons: [...(has ? [] : [{ key: 'explore', label: t('cogitaWorld.panel.explore'), ...go }]), ...real.map((b) => (b.key === 'explore' ? { ...b, ...go } : { ...b, onClick: () => undefined }))] };
    }
    /* Vor dem Klick ein Pfeil auf das, was zu klicken ist; danach die Knöpfe, die dort wirklich stehen (im Rundgang ohne Wirkung). */
    if (!tour.done) return { place: ac.id, kind, buttons: [{ key: 'tap', label: '▼', arrow: true, title: t('cogitaWorld.tour.tapHere'), onClick: () => tour.setDone(true), data: { 'world-tour-tap': ac.id } }] };
    return { place: ac.id, kind, buttons: ctx.buttons(ac.kind, ac.id).filter((b) => b.key !== 'tour').map((b) => ({ ...b, onClick: () => undefined })) };
  })();
  return {
    id: 'tour',
    active: true,
    exclusive: true,
    draw: {
      ...(tour.scene === null ? {} : { scene: tour.scene }),
      route: step.route ?? (tour.focus === null ? null : [...tour.focus.remaining]),
      faint: null,
      chosen: step.chosen ?? null,
      focus: tour.focus ?? (step.node === undefined || tour.state === null ? null : nodeFocus(tour.state, tour.lines, step.node)),
      marks: null,
      lit: step.lit === undefined ? null : new Set(step.lit),
      goal: null,
      tasks: null,
      chosenSign: step.sign ?? null,
      under,
      towerActions,
      startAction: null
    },
    pick: {
      place: (id) => { if (id !== null) tour.hit('place', id); },
      section: (id) => { tour.hit('section', id); },
      home: () => { tour.hit('home', HOME); },
      junction: (id) => { tour.hit('junction', id); },
      sign: (key) => { tour.hit('sign', key); },
      lead: (id) => { if (step.action?.kind === 'explore' && step.action.id === id && !tour.done) tour.setDone(true); }
    },
    menu: { classes: [], live: null },
    menuLocked: true,
    suppress: { hover: true, side: true, playback: true, full: true },
    onMap: tour.at === null ? null : (
      <TourCard steps={tour.list} at={tour.at} levels={tour.levels} t={t} onAt={tour.setAt} onClose={() => { keepTourSeen(tour.seenScope); tour.stop(); }} done={tour.done} onDone={() => tour.setDone(true)} />
    )
  };
}
