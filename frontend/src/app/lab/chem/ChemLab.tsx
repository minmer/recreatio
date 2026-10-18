/**
 * 2026-10-18 — DAS LABORATORIUM CHEMICZNE, gezeichnet und bedient: die
 * Piaskownica (`chemWorld.ts`) auf einer Leinwand — Dinge ziehen (ein Glas
 * nimmt seinen Inhalt mit), über die Öffnung eines anderen halten (es neigt
 * sich, der Inhalt fliesst wirklich hinüber), Reagenzien aus dem Regal,
 * Werkzeuge in der Hand (Streichholz, Span, Draht, Glasstab, Stopfen,
 * Papier, Thermometer, Sonde), neue Dinge auf den Tisch (Piaskownica), die
 * Wärmeansicht, die Schritte eines Versuchs mit „Pokaż”, Protokoll,
 * Schreiber, Lupe, Speichern und JSON.
 *
 * <b>Der Motor ist Code, der Versuch ist ein Dokument</b> (`chemSetup.ts`):
 * was wo steht. Die Zeit läuft von selbst (Chemie wartet nicht); Pauza hält sie an.
 */

import { useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';

import { LabFrame, LabFull, LabSection, LabTool, labNum } from '../LabFrame';
import { Recorder, drawRecorder, type Series } from '../labGraph';
import { seeded } from '../labRandom';
import { Camera, Loop, attachGestures, fitCanvas } from '../labView';
import { reagentOf } from './chemData';
import { CELL } from './chemGrid';
import { Micro, sampleOf, type Sample } from './chemMicro';
import { Equipment, HandBar, Inspector, Log, Shelf, StepsPanel, Tools, type Hand } from './chemPanel';
import { CHEM_PRESETS, SANDBOX_CHEM } from './chemPresets';
import {
  TOOLS, answerIndex, buildWorld, drawChem, perform, quantity, readChemScene, sceneOfWorld, shelfOf, useTool,
  type Action, type GraphOf, type ToolKey
} from './chemSetup';
import { THING_NAME, inside, mouthOf, wickOf, type Thing } from './chemThings';
import { Field, drawWorld, readChemPalette, type ChemPalette } from './chemView';
import type { Summary, World } from './chemWorld';

export interface ChemConfig {
  readonly title: string;
  readonly text: readonly string[];
  readonly mode: 'sandbox' | 'experiment';
  readonly scene: unknown;
}

/** Tempo: bis 300× — der Zeitraffer für Lösen, Diffusion und Abkühlen (fünf Minuten in einer Sekunde). */
const SPEEDS = [1, 2, 5, 10, 20, 60, 300] as const;
const COLORS = ['#c0392b', '#2f6fae', '#2f8a4c', '#8a5ad0', '#e67e22', '#7a5a2e'];
const UNITS: Record<GraphOf, string> = { T: '°C', pH: '', p: 'kPa' };
const QLABEL: Record<GraphOf, string> = { T: 'T', pH: 'pH', p: 'p' };
const storeKey = (title: string) => `lab-chem2:${title.slice(0, 60)}`;
const TILT = 1.9;

/** Giessen aus einem Schritt: hinfahren, neigen, warten, bis genug hinüber ist, zurück. */
interface PourAnim { from: Thing; to: Thing; ml: number; start: number; t: number; phase: 0 | 1 | 2 | 3 | 4; hx: number; hy: number; side: number }

/** Ein Glas, das gerade über einem anderen gehalten wird (es neigt sich weich). */
interface Hold { t: Thing; target: Thing | null; side: number; hx: number; hy: number; poured: boolean }

/** Wo ein Glas stehen muss, um in ein anderes zu giessen (aufrecht, Rand neben der Öffnung des Ziels). */
function pourPose(from: Thing, to: Thing, side: number): [number, number] {
  const fw = from.prof?.width ?? 2;
  const tw = to.prof?.width ?? 2;
  const top = to.y + (to.prof?.top ?? 0);
  return [to.x - side * (tw / 2 + fw / 2 - 0.6), top + 1.2];
}

export function ChemLab({ config, whole = false, seed = null }: { config: ChemConfig; whole?: boolean; seed?: string | null }) {
  const sandbox = config.mode === 'sandbox';
  const [doc, setDoc] = useState<unknown>(() => config.scene ?? SANDBOX_CHEM);
  const configKey = JSON.stringify(config.scene ?? null);
  useEffect(() => { setDoc(config.scene ?? SANDBOX_CHEM); }, [configKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const scene = useMemo(() => readChemScene(doc), [doc]);
  const [drawKey, setDrawKey] = useState(0);
  const drawn = useMemo(() => drawChem(scene, seed === null ? null : `${seed}:${drawKey}`), [scene, drawKey, seed]);
  const [resetKey, setResetKey] = useState(0);
  const world = useMemo(() => buildWorld(scene, drawn, seed === null ? Math.random : seeded(`${seed}:${resetKey}`)), [scene, drawn, resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(scene.speed);
  const [heat, setHeat] = useState(scene.show.heat);
  const [hand, setHand] = useState<Hand>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [stepAt, setStepAt] = useState(0);
  const [showing, setShowing] = useState(false);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [json, setJson] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [view, setView] = useState<{ sum: Summary | null; sample: Sample | null }>({ sum: null, sample: null });
  const full = useContext(LabFull);

  useEffect(() => { setHand(null); setPick(null); setJson(null); setHeat(scene.show.heat); }, [scene]);
  useEffect(() => { setStepAt(0); setShowing(false); setPicked({}); setSpeed(scene.speed); setRunning(true); }, [world]); // eslint-disable-line react-hooks/exhaustive-deps

  const stage = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const side = useRef<HTMLElement | null>(null);
  const graphCanvas = useRef<HTMLCanvasElement | null>(null);
  const microCanvas = useRef<HTMLCanvasElement | null>(null);
  const camRef = useRef<{ doc: unknown; cam: Camera } | null>(null);
  const loopRef = useRef<Loop | null>(null);
  const micro = useMemo(() => new Micro(), []);
  const field = useMemo(() => (typeof document === 'undefined' ? null : new Field(world.g)), [world]);
  const anim = useRef<PourAnim | null>(null);
  const readouts = useRef<HTMLElement[]>([]);
  const live = useRef({ running, speed, hand, pick, full, heat, probe: null as null | { x: number; y: number }, target: null as string | null, sample: null as Sample | null });
  live.current = { ...live.current, running, speed, hand, pick, full, heat, sample: view.sample };

  const selected = pick === null ? null : world.thing(pick) ?? null;
  const graph = scene.graph ?? (selected === null ? null : selected.kind === 'thermometer' ? { things: [selected.id], of: ['T'] as GraphOf[] } : selected.prof !== null ? { things: [selected.id], of: ['T', 'pH'] as GraphOf[] } : null);
  const graphKey = graph === null ? '' : `${graph.things.join()}|${graph.of.join()}`;
  const recorder = useMemo(() => {
    if (graph === null) return null;
    const series: Series[] = [];
    graph.things.forEach((id) => graph.of.forEach((q) => {
      const t = world.thing(id);
      series.push({ label: `${QLABEL[q]}${graph.things.length > 1 ? ` ${t?.label || id}` : ''}`, unit: UNITS[q], color: COLORS[series.length % COLORS.length] });
    }));
    return new Recorder(series, 1800);
  }, [graphKey, world]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Der Schreiber wechselt mit der Wahl — die Bühne liest ihn aus einem Ref (sie neu zu bauen, risse eine Geste mitten durch). */
  const graphRef = useRef<{ graph: typeof graph; recorder: Recorder | null }>({ graph, recorder });
  graphRef.current = { graph, recorder };

  useLayoutEffect(() => { readouts.current = [...(side.current?.querySelectorAll<HTMLElement>('[data-q]') ?? [])]; });

  /* -- Die Bühne -------------------------------------------------------------------------------- */
  useEffect(() => {
    const el = canvas.current;
    const box = stage.current;
    if (el === null || box === null || field === null) return undefined;
    const ctx = el.getContext('2d');
    if (ctx === null) return undefined;
    const fit = (cam: Camera) => { const v = scene.view ?? world.bounds(); cam.fit(v[0], v[1], v[2], v[3], 12); };
    if (camRef.current === null || camRef.current.doc !== doc) {
      const cam = new Camera();
      cam.min = 2;
      cam.max = 400;
      camRef.current = { doc, cam };
      const r = box.getBoundingClientRect();
      cam.w = Math.max(50, r.width); cam.h = Math.max(50, r.height);
      fit(cam);
    }
    const cam = camRef.current.cam;
    let pal: ChemPalette = readChemPalette(box);
    let dpr = fitCanvas(el, cam.w, cam.h);
    let clock = 0;
    let uiClock = 0;
    let drag: { t: Thing; off: [number, number]; x0: number; y0: number; moved: boolean } | null = null;
    let hold: Hold | null = null;
    let probing = false;

    const draw = () => {
      const s = live.current;
      drawWorld(ctx, { world, cam, dpr, pal, time: clock, pick: s.pick, target: s.target, heat: s.heat, values: scene.show.values, probe: s.probe }, field);
      writeReadouts(world, s.pick, readouts.current);
      const gc = graphCanvas.current;
      const rec = graphRef.current.recorder;
      if (gc !== null && rec !== null) {
        const r = gc.getBoundingClientRect();
        const gd = fitCanvas(gc, r.width, r.height);
        const g2 = gc.getContext('2d');
        if (g2 !== null) { g2.setTransform(gd, 0, 0, gd, 0, 0); drawRecorder(g2, rec, r.width, r.height, pal.ink, pal.muted, `600 11px ${pal.font}`); }
      }
      const mc = microCanvas.current;
      if (mc !== null && s.sample !== null) {
        const r = mc.getBoundingClientRect();
        const md = fitCanvas(mc, r.width, r.height);
        const m2 = mc.getContext('2d');
        if (m2 !== null) { m2.setTransform(md, 0, 0, md, 0, 0); micro.draw(m2, r.width, r.height, s.sample, pal.dark); }
      }
    };

    const tick = (dt: number): boolean | number => {
      const s = live.current;
      clock += dt;
      const moving = stepAnim(dt) || stepHold();
      let act = 0;
      if (s.running) {
        act = world.frame(dt, s.speed);
        const { recorder: rec, graph: gr } = graphRef.current;
        if (rec !== null && gr !== null) {
          const values: number[] = [];
          for (const id of gr.things) for (const q of gr.of) values.push(quantity(world, id, q));
          rec.add(world.time, values);
        }
      }
      if (microCanvas.current !== null && s.sample !== null && s.pick !== null) micro.sync(s.pick, s.sample, dt);
      uiClock += dt;
      if (uiClock > 0.35) {
        uiClock = 0;
        const t = s.pick === null ? undefined : world.thing(s.pick);
        if (t !== undefined && t.prof !== null) { const sum = world.summary(t, true); setView({ sum, sample: sampleOf(sum) }); } else setView((v) => (v.sum === null ? v : { sum: null, sample: null }));
        bump();
      }
      if (act === 2 || drag !== null || moving || anim.current !== null || probing) return true;
      if (act === 1 && s.running) return 120;
      return false;
    };

    /* Ein gehaltenes Glas über einer Öffnung neigt sich (und giesst); weg davon richtet es sich auf. */
    const stepHold = (): boolean => {
      const h = hold;
      if (h === null) return false;
      const want = h.target === null ? 0 : -h.side * TILT;
      const now = h.t.angle;
      if (Math.abs(want - now) < 1e-3) return h.target !== null;
      const next = now + Math.sign(want - now) * Math.min(Math.abs(want - now), 0.12);
      if (world.tilt(h.t, next)) h.poured = h.poured || h.target !== null;
      return true;
    };

    /* „Pokaż” giesst: hinfahren, neigen, giessen, aufrichten, zurück. */
    const stepAnim = (dt: number): boolean => {
      const a = anim.current;
      if (a === null) return false;
      a.t += dt;
      const [tx, ty] = pourPose(a.from, a.to, a.side);
      /* Erst hoch (über alle Ränder), dann hinüber — und zurück erst hinüber, dann hinunter. */
      const go = (x: number, y: number, upFirst: boolean) => {
        const dy = y - a.from.y;
        const dx = x - a.from.x;
        if (upFirst ? Math.abs(dy) > CELL * 0.5 : Math.abs(dx) < CELL * 0.5) world.move(a.from, a.from.x, a.from.y + Math.sign(dy) * Math.min(Math.abs(dy), 0.8));
        else world.move(a.from, a.from.x + Math.sign(dx) * Math.min(Math.abs(dx), 0.8), a.from.y);
      };
      if (a.phase === 0) {
        go(tx, ty, true);
        if (Math.abs(a.from.x - tx) < CELL && Math.abs(a.from.y - ty) < CELL) { a.phase = 1; a.t = 0; }
        if (a.t > 8) { a.phase = 4; a.t = 0; }
      } else if (a.phase === 1) {
        const want = -a.side * TILT;
        const next = a.from.angle + Math.sign(want - a.from.angle) * Math.min(Math.abs(want - a.from.angle), 0.1);
        world.tilt(a.from, next);
        if (Math.abs(a.from.angle - want) < 1e-3 || a.t > 3) { a.phase = 2; a.t = 0; }
      } else if (a.phase === 2) {
        /* Flüssigkeit: bis genug hinüber ist. Ein schweres Gas (kein Wasser im Glas): eine Weile halten, bis es ausgeflossen ist. */
        const left = world.summary(a.from, false).ml;
        const gas = a.start < 0.2;
        if (gas ? a.t > Math.min(12, Math.max(4, a.ml)) : a.start - left >= a.ml - 0.3 || left < 0.2 || a.t > 25) { a.phase = 3; a.t = 0; }
      } else if (a.phase === 3) {
        const next = a.from.angle - Math.sign(a.from.angle) * Math.min(Math.abs(a.from.angle), 0.15);
        world.tilt(a.from, Math.abs(next) < 0.02 ? 0 : next);
        if (Math.abs(a.from.angle) < 1e-3) { a.phase = 4; a.t = 0; }
      } else {
        go(a.hx, a.hy, false);
        if ((Math.abs(a.from.x - a.hx) < CELL && Math.abs(a.from.y - a.hy) < CELL) || a.t > 8) { world.drop(a.from); anim.current = null; }
      }
      return true;
    };

    const loop = new Loop(tick, draw);
    loopRef.current = loop;

    /* -- Gesten --------------------------------------------------------------------------------- */
    const say = (text: string) => { setSaid(text); window.setTimeout(() => setSaid((x) => (x === text ? null : x)), 2600); };
    const containerAt = (x: number, y: number): Thing | null => {
      let best: Thing | null = null;
      for (const t of world.things) if (t.prof !== null && (inside(t, x, y) || (Math.abs(x - mouthOf(t)[0]) < t.prof.width / 2 && y > t.y && y < t.y + t.prof.top + 3))) if (best === null || (best.prof !== null && t.prof.full < best.prof.full)) best = t;
      return best;
    };

    const down = (sx: number, sy: number): boolean => {
      const s = live.current;
      const x = cam.toWorldX(sx);
      const y = cam.toWorldY(sy);
      const t = world.at(x, y);
      loop.wake();
      const h = s.hand;
      if (h?.kind === 'reagent') {
        const target = containerAt(x, y);
        world.add(h.id, h.amount, target, target === null ? [x, Math.max(0.2, y)] : null);
        if (target !== null) setPick(target.id);
        bump();
        return true;
      }
      if (h?.kind === 'thing') {
        const made = world.place(h.thing, `${h.thing}-${world.things.length + 1}-${Math.round(clock * 10)}`, { x, y: Math.max(0, y), size: h.size || undefined, ...(h.of === undefined ? {} : { of: h.of }) });
        if (!made.held) world.drop(made);
        setPick(made.id);
        setHand(null);
        bump();
        return true;
      }
      if (h?.kind === 'tool') return useHand(h.tool, t, x, y);
      if (t !== null) {
        setPick(t.id);
        if (!sandbox && !scene.allow.move) return true;
        drag = { t, off: [x - t.x, y - t.y], x0: t.x, y0: t.y, moved: false };
        el.classList.add('is-grabbing');
        return true;
      }
      return false;
    };

    const useHand = (tool: ToolKey, t: Thing | null, x: number, y: number): boolean => {
      switch (tool) {
        case 'match':
          if (t?.kind === 'burner') world.burner(t, true);
          else if (t?.kind === 'candle') world.ignite(...wickOf(t));
          else world.ignite(x, y);
          bump();
          return true;
        case 'splint': case 'glow': {
          const sp = world.splint(x, Math.max(1, y), tool === 'glow');
          drag = { t: sp, off: [0, 0], x0: sp.x, y0: sp.y, moved: true };
          setPick(sp.id);
          setHand(null);
          return true;
        }
        case 'loop': {
          const lp = world.things.find((u) => u.kind === 'loop') ?? world.place('loop', `drucik-${world.things.length + 1}`, { x, y: Math.max(1, y), held: true });
          world.move(lp, x, Math.max(1, y));
          drag = { t: lp, off: [0, 0], x0: lp.x, y0: lp.y, moved: true };
          setPick(lp.id);
          setHand(null);
          return true;
        }
        case 'probe': live.current.probe = { x, y }; probing = true; return true;
        case 'thermometer': {
          const c = containerAt(x, y);
          if (c !== null) useTool(world, 'thermometer', c); else world.place('thermometer', `termometr-${world.things.length + 1}`, { x, y: Math.max(0, y), held: true });
          bump();
          return true;
        }
        default: {
          const target = t ?? containerAt(x, y);
          if (target === null) return false;
          if (tool === 'paper') {
            const ph = world.phAt(x, y);
            say(ph === null ? 'Papierek pozostaje suchy — dotknij cieczy.' : `Papierek: pH ≈ ${Math.round(ph)} (${ph < 6.5 ? 'kwasowy' : ph > 7.5 ? 'zasadowy' : 'obojętny'}).`);
          }
          useTool(world, tool, target);
          if (tool === 'delete') setPick(null);
          bump();
          return true;
        }
      }
    };

    const move = (sx: number, sy: number) => {
      const x = cam.toWorldX(sx);
      const y = cam.toWorldY(sy);
      if (probing) { live.current.probe = { x, y }; loop.wake(); return; }
      if (drag === null) return;
      const d = drag;
      d.moved = true;
      const t = d.t;
      /* Über der Öffnung eines anderen Glases: dort halten und giessen. */
      if (t.prof !== null && t.kind !== 'burette') {
        let target: Thing | null = null;
        for (const u of world.things) {
          if (u === t || u.prof === null || world.carried(t).includes(u)) continue;
          const [mx, my] = mouthOf(u);
          if (Math.abs(x - mx) < u.prof.width / 2 + t.prof.width / 2 + 1.5 && y > my - 1 && y < my + t.prof.top + 6) { target = u; break; }
        }
        if (target !== null) {
          const s2 = target.x >= x ? 1 : -1;
          if (hold === null || hold.target !== target) {
            if (Math.abs(t.angle) < 1e-3) { const [px, py] = pourPose(t, target, s2); world.move(t, px, py); }
            hold = { t, target, side: s2, hx: d.x0, hy: d.y0, poured: hold?.poured ?? false };
          }
          live.current.target = target.id;
          loop.wake();
          return;
        }
        if (hold !== null) { hold.target = null; live.current.target = null; if (Math.abs(t.angle) > 1e-3) { loop.wake(); return; } }
      }
      world.moveNear(t, x - d.off[0], Math.max(0, y - d.off[1]));
      loop.wake();
    };

    const up = (sx: number, sy: number, _e: PointerEvent, tap: boolean) => {
      const x = cam.toWorldX(sx);
      const y = cam.toWorldY(sy);
      if (drag !== null) {
        const t = drag.t;
        if (hold !== null) {
          if (Math.abs(t.angle) > 1e-3) world.tilt(t, 0);
          if (hold.poured) world.move(t, hold.hx, hold.hy);
          hold = null;
          live.current.target = null;
        }
        if (tap && !drag.moved) {
          if (t.kind === 'burner') world.burner(t, !t.on);
          else if (t.kind === 'burette') world.tap(t, t.on ? 0 : t.flow);
          else if (t.kind === 'hotplate') t.on = !t.on;
        }
        if (!t.held) world.drop(t);
        bump();
      }
      if (probing) probing = false;
      if (tap && drag === null && live.current.hand === null && world.at(x, y) === null) setPick(null);
      drag = null;
      el.classList.remove('is-grabbing');
      loop.wake();
    };

    const detach = attachGestures(el, {
      down: (sx, sy) => down(sx, sy),
      move: (sx, sy) => move(sx, sy),
      up: (sx, sy, e, tap) => up(sx, sy, e, tap),
      pan: (dx, dy) => { cam.pan(dx, dy); loop.wake(); },
      zoom: (sx, sy, f) => { cam.zoomAt(sx, sy, f); loop.wake(); },
      scrolls: () => !live.current.full,
      grabs: (sx, sy) => live.current.hand !== null || world.at(cam.toWorldX(sx), cam.toWorldY(sy)) !== null
    });
    const hover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || drag !== null) return;
      const h = live.current.hand;
      if (h?.kind !== 'reagent' && h?.kind !== 'tool') return;
      const r = el.getBoundingClientRect();
      const c = containerAt(cam.toWorldX(e.clientX - r.left), cam.toWorldY(e.clientY - r.top));
      if ((c?.id ?? null) !== live.current.target) { live.current.target = c?.id ?? null; loop.wake(); }
    };
    const leave = () => { if (drag === null) { live.current.target = null; loop.wake(); } };
    el.addEventListener('pointermove', hover);
    el.addEventListener('pointerleave', leave);

    const resize = () => {
      const r = box.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const was = [cam.w, cam.h];
      cam.w = r.width; cam.h = r.height;
      if (was[0] > 10 && was[1] > 10 && (Math.abs(r.width - was[0]) > was[0] * 0.25 || Math.abs(r.height - was[1]) > was[1] * 0.25)) fit(cam);
      else if (was[0] > 10 && was[1] > 10) cam.scale *= Math.min(r.width / was[0], r.height / was[1]) ** 0.5;
      dpr = fitCanvas(el, cam.w, cam.h);
      loop.wake();
    };
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    sizes?.observe(box);
    const seen = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => loop.show(entries.some((e) => e.isIntersecting)));
    seen?.observe(box);
    const theme = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onTheme = () => { pal = readChemPalette(box); loop.wake(); };
    theme?.addEventListener?.('change', onTheme);
    resize();
    loop.wake();
    return () => {
      detach();
      el.removeEventListener('pointermove', hover);
      el.removeEventListener('pointerleave', leave);
      sizes?.disconnect();
      seen?.disconnect();
      theme?.removeEventListener?.('change', onTheme);
      loop.dispose();
      loopRef.current = null;
    };
  }, [world, doc, scene, field]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Was die Bedienung ändert, will gezeichnet werden. */
  useEffect(() => {
    if (hand?.kind !== 'tool' || hand.tool !== 'probe') live.current.probe = null;
    loopRef.current?.wake();
  }, [running, speed, hand, pick, heat, world]);

  /* -- „Pokaż": die Schritte nacheinander ------------------------------------------------------------ */
  const doAction = (a: Action) => {
    if (a.kind === 'speed') { setSpeed(a.value); return; }
    if (a.kind === 'pour') {
      const from = world.thing(a.from);
      const to = world.thing(a.to);
      if (from !== undefined && to !== undefined && anim.current === null) {
        anim.current = { from, to, ml: a.ml, start: world.summary(from, false).ml, t: 0, phase: 0, hx: from.x, hy: from.y, side: to.x >= from.x ? 1 : -1 };
      }
      return;
    }
    perform(world, a, drawn, false);
  };
  const act = (i: number) => {
    const step = scene.steps[i];
    if (step === undefined) return;
    setRunning(true);
    for (const a of step.do) doAction(a);
    bump();
    loopRef.current?.wake();
  };
  useEffect(() => {
    if (!showing) return undefined;
    if (stepAt >= scene.steps.length) { setShowing(false); return undefined; }
    const step = scene.steps[stepAt];
    if (step.ask !== null && picked[stepAt] === undefined) { setShowing(false); return undefined; }
    act(stepAt);
    const timer = window.setTimeout(() => setStepAt((n) => n + 1), Math.max(0.8, step.wait) * 1000);
    return () => window.clearTimeout(timer);
  }, [showing, stepAt]); // eslint-disable-line react-hooks/exhaustive-deps

  /* -- Was die Bedienung braucht ----------------------------------------------------------------- */
  const shelf = useMemo(() => shelfOf(scene), [scene]);
  const tools: readonly ToolKey[] = sandbox ? TOOLS : scene.tools ?? TOOLS.filter((t) => t !== 'delete' && t !== 'empty');
  const edit = sandbox || scene.allow.things;
  const reset = () => { setResetKey((k) => k + 1); setSaid(null); anim.current = null; };
  const pickReagent = (id: string) => {
    const r = reagentOf(id);
    if (r === undefined) return;
    setHand(hand?.kind === 'reagent' && hand.id === id ? null : { kind: 'reagent', id, amount: r.amounts[Math.min(1, r.amounts.length - 1)] });
  };
  const fitView = () => { const cam = camRef.current?.cam; if (cam !== undefined) { const v = scene.view ?? world.bounds(); cam.fit(v[0], v[1], v[2], v[3], 12); loopRef.current?.wake(); } };
  const names = (id: string) => { const t = world.thing(id); return t === undefined ? id : t.label || THING_NAME[t.kind]; };
  const closed = selected !== null && world.things.some((u) => u.kind === 'stopper' && u.onto === selected.id);

  const bar = (
    <>
      <LabTool icon={running ? 'pause' : 'play'} label={running ? 'Pauza' : 'Wznów'} text={running ? 'Pauza' : 'Wznów'} on={!running} onClick={() => setRunning((r) => !r)} />
      <LabTool icon="history" label="Od nowa" onClick={reset} />
      <button type="button" className="lab-tool" title="Tempo czasu" aria-label={`Tempo ${speed}×`} onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length])}>{String(speed).replace('.', ',')}×</button>
      <button type="button" className={`lab-tool has-text${heat ? ' is-on' : ''}`} aria-pressed={heat} title="Widok ciepła: kolory pokazują temperaturę" onClick={() => setHeat((h) => !h)}><span>Ciepło</span></button>
      {scene.vars.length > 0 && <LabTool icon="shuffle" label="Nowe losowanie" onClick={() => setDrawKey((k) => k + 1)} />}
      <LabTool icon="search" label="Dopasuj widok" onClick={fitView} />
    </>
  );

  return (
    <LabFrame
      whole={whole}
      title={config.title || (sandbox ? 'Laboratorium chemiczne' : 'Doświadczenie')}
      chips={<span className="lab-chip">{sandbox ? 'piaskownica' : 'doświadczenie'}</span>}
      bar={bar}
      note={said !== null ? <p className="lab-note" role="status">{said}</p> : null}
      stage={<div ref={stage} className="lab-canvas-box"><canvas ref={canvas} aria-label={`${config.title || 'Laboratorium chemiczne'} — stół laboratoryjny; przeciągaj naczynia, przytrzymaj naczynie nad innym, żeby przelać, weź odczynnik i dotknij naczynia`} /></div>}
      side={(
        <section ref={side} className="lab-side-in">
          {config.text.length > 0 && <LabSection title="Opis">{config.text.map((t, i) => <p key={i} className="lab-text">{t}</p>)}</LabSection>}
          <StepsPanel steps={scene.steps} at={stepAt} showing={showing} picked={picked}
            right={(i) => { const s = scene.steps[i]; return s?.ask === null || s?.ask === undefined ? -1 : answerIndex(s.ask, drawn); }}
            onShow={() => setShowing(true)}
            onNext={() => { act(stepAt); setStepAt((n) => n + 1); }}
            onAnswer={(i, k) => setPicked((p) => ({ ...p, [i]: k }))} />
          <HandBar hand={hand} onAmount={(a) => hand?.kind === 'reagent' && setHand({ ...hand, amount: a })} onDrop={() => setHand(null)} />
          {selected !== null && (
            <Inspector t={selected} sum={view.sum} sample={view.sample} show={scene.show} edit={edit} micro={microCanvas} closed={closed}
              onAct={{
                act: (what) => {
                  if (what === 'toggle') {
                    if (selected.kind === 'burner') world.burner(selected, !selected.on);
                    else if (selected.kind === 'burette') world.tap(selected, selected.on ? 0 : selected.flow);
                    else if (selected.kind === 'hotplate') { selected.on = !selected.on; world.poke(); }
                  } else if (what === 'stirrer') {
                    selected.stir = !selected.stir;
                    world.poke();
                  } else if (what === 'light') {
                    if (selected.on) selected.on = false; else world.ignite(...wickOf(selected));
                  } else if (what === 'delete') { world.remove(selected); setPick(null); } else useTool(world, what, selected);
                  bump();
                  loopRef.current?.wake();
                },
                set: (what, value) => {
                  if (what === 'air') selected.air = value;
                  else if (what === 'gas') selected.flow = value;
                  else if (what === 'power') selected.air = value;
                  else if (what === 'rate') selected.flow = value;
                  world.poke();
                  bump();
                  loopRef.current?.wake();
                }
              }} />
          )}
          <LabSection title="Na stole">
            <div className="lab-chips">
              {world.things.filter((t) => t.kind !== 'stopper').map((t) => (
                <button key={t.id} type="button" className={`lab-chip-btn${t.id === pick ? ' is-on' : ''}`} aria-pressed={t.id === pick}
                  onClick={() => {
                    if (hand?.kind === 'reagent' && t.prof !== null) world.add(hand.id, hand.amount, t);
                    else if (hand?.kind === 'tool' && ['stir', 'stopper', 'paper', 'empty', 'delete', 'thermometer', 'match'].includes(hand.tool)) useTool(world, hand.tool, t);
                    setPick(hand?.kind === 'tool' && hand.tool === 'delete' ? null : t.id);
                    bump();
                    loopRef.current?.wake();
                  }}>
                  {t.label || THING_NAME[t.kind]}
                </button>
              ))}
            </div>
          </LabSection>
          {(scene.allow.shelf || sandbox) && shelf.length > 0 && <LabSection title="Odczynniki"><Shelf ids={shelf} hand={hand} onPick={pickReagent} /></LabSection>}
          {tools.length > 0 && <LabSection title="Narzędzia"><Tools tools={tools} hand={hand} onPick={(t) => setHand(hand?.kind === 'tool' && hand.tool === t ? null : { kind: 'tool', tool: t })} /></LabSection>}
          {edit && <LabSection title="Sprzęt" open={sandbox}><Equipment hand={hand} onPick={(kind, size, of) => setHand({ kind: 'thing', thing: kind, size, ...(of === undefined ? {} : { of }) })} /></LabSection>}
          <LabSection title="Obserwacje"><Log events={world.log} equations={scene.show.equations} names={names} /></LabSection>
          {recorder !== null && (
            <LabSection title="Wykres">
              <canvas ref={graphCanvas} className="lab-graph" aria-label="Wykres wartości w czasie" />
            </LabSection>
          )}
          {sandbox && (
            <LabSection title="Doświadczenia i zapis" open={false}>
              <label className="lab-field">
                Wczytaj doświadczenie
                <select value="" onChange={(e) => { const p = CHEM_PRESETS.find((x) => x.key === e.currentTarget.value); if (p !== undefined) { setDoc(p.scene); setSaid(p.summary); } }}>
                  <option value="">— wybierz —</option>
                  {CHEM_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}
                </select>
              </label>
              <div className="lab-row">
                <button type="button" className="wk-btn wk-btn-line" onClick={() => {
                  try { localStorage.setItem(storeKey(config.title), JSON.stringify(sceneOfWorld(world, scene))); setSaid('Zapisano stół w tej przeglądarce.'); } catch { setSaid('Przeglądarka nie pozwala zapisać.'); }
                }}>Zapisz</button>
                <button type="button" className="wk-btn wk-btn-line" onClick={() => {
                  let saved: string | null = null;
                  try { saved = localStorage.getItem(storeKey(config.title)); } catch { saved = null; }
                  if (saved === null) { setSaid('Nie ma zapisanego stołu.'); return; }
                  try { setDoc(JSON.parse(saved) as unknown); setSaid('Wczytano zapisany stół.'); } catch { setSaid('Zapis jest uszkodzony.'); }
                }}>Wczytaj</button>
                <button type="button" className="wk-btn wk-btn-line" aria-expanded={json !== null} onClick={() => setJson(json === null ? JSON.stringify(sceneOfWorld(world, scene), null, 1) : null)}>JSON</button>
              </div>
              {json !== null && (
                <>
                  <p className="lab-muted">Ten JSON to scena — wklej go w edytorze modułu jako „scene”, a stół zostanie na stronie.</p>
                  <textarea className="lab-json" value={json} rows={8} readOnly onFocus={(e) => e.currentTarget.select()} />
                </>
              )}
            </LabSection>
          )}
        </section>
      )}
    />
  );
}

/** Die Werte des Gewählten in die Bedienung (in jedem Bild). */
function writeReadouts(world: World, pick: string | null, els: readonly HTMLElement[]): void {
  if (els.length === 0 || pick === null) return;
  const t = world.thing(pick);
  if (t === undefined) return;
  const s = t.prof !== null ? world.summary(t, false) : null;
  for (const el of els) {
    const q = el.dataset.q;
    let text = '';
    if (q === 'T') text = t.kind === 'thermometer' ? labNum(t.readout, 1, '°C') : s !== null ? labNum(s.T - 273.15, 1, '°C') : '—';
    else if (q === 'pH') { const v = s !== null && s.ml > 0.3 && !t.hidden ? quantity(world, t.id, 'pH') : Number.NaN; text = Number.isFinite(v) ? labNum(v, 2) : '—'; }
    else if (q === 'p') text = s !== null ? labNum(s.P, 1, 'kPa') : '—';
    else if (q === 'V') text = s !== null ? labNum(s.ml, 1, 'cm³') : '—';
    if (el.textContent !== text) el.textContent = text;
  }
}

export default ChemLab;
