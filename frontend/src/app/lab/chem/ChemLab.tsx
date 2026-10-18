/**
 * 2026-10-18 — DAS LABORATORIUM CHEMICZNE, gezeichnet und bedient: der Tisch
 * (Leinwand, Kamera, Gesten), die Zeit (Pauza, Od nowa, Tempo), das Regal
 * (nehmen, Menge wählen, auf ein Gefäss tippen), die Werkzeuge, Glas
 * verschieben und — über ein anderes gezogen — ausgiessen, auf den Dreifuss
 * stellen, die Schritte eines Versuchs mit „Pokaż” (auch eine Frage vorab),
 * Protokoll, Schreiber, Lupe, Piaskownica mit Speichern und JSON.
 *
 * <b>Der Motor ist Code, der Versuch ist ein Dokument</b> (`chemScene.ts`).
 * Die Zeit läuft von selbst (Chemie wartet nicht); Pauza hält sie an.
 */

import { useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';

import { LabFrame, LabFull, LabSection, LabTool, labNum } from '../LabFrame';
import { Recorder, drawRecorder, type Series } from '../labGraph';
import { num } from '../labRandom';
import { Camera, Loop, attachGestures, fitCanvas } from '../labView';
import { reagentOf, type VesselKind } from './chemData';
import { drawLab } from './chemDraw';
import { burnerAt, vesselAt } from './chemGeom';
import { readChemPalette, type ChemPalette } from './chemKit';
import { Effects } from './chemFx';
import { SEAT, type Lab, type ToolKey } from './chemBench';
import { Micro } from './chemMicro';
import { BurnerPanel, Equipment, HandBar, Inspector, Log, Shelf, StepsPanel, Tools, type Hand } from './chemPanel';
import { CHEM_PRESETS, SANDBOX_CHEM } from './chemPresets';
import { TOOLS, answerIndex, boundsOf, buildLab, drawChem, readChemScene, reagentIn, sceneOfLab, shelfOf, type Action, type GraphOf } from './chemScene';
import { Vessel } from './chemVessel';

export interface ChemConfig {
  readonly title: string;
  readonly text: readonly string[];
  readonly mode: 'sandbox' | 'experiment';
  readonly scene: unknown;
}

const SPEEDS = [1, 2, 5, 10, 25] as const;
const COLORS = ['#c0392b', '#2f6fae', '#2f8a4c', '#8a5ad0', '#e67e22', '#7a5a2e'];
const UNITS: Record<GraphOf, string> = { T: '°C', pH: '', p: 'kPa', gas: 'cm³' };
const storeKey = (title: string) => `lab-chem:${title.slice(0, 60)}`;

/** Ein Wert eines Gefässes für den Schreiber. */
function quantity(v: Vessel, q: GraphOf, lab: Lab): number {
  switch (q) {
    case 'T': return v.T - 273.15;
    case 'pH': return v.wet() ? v.spec.pH : Number.NaN;
    case 'p': return v.pressure(lab.room.p);
    case 'gas': return v.kind === 'syringe' ? (v.syringeMl < 0.6 ? 0 : v.syringeMl) : v.gasMl();
  }
}

interface PourAnim { from: Vessel; to: Vessel; ml: number; t: number; phase: 0 | 1 | 2 | 3; hx: number; hy: number; left: number }

export function ChemLab({ config, whole = false, seed = null }: { config: ChemConfig; whole?: boolean; seed?: string | null }) {
  const sandbox = config.mode === 'sandbox';
  const [doc, setDoc] = useState<unknown>(() => config.scene ?? SANDBOX_CHEM);
  const configKey = JSON.stringify(config.scene ?? null);
  useEffect(() => { setDoc(config.scene ?? SANDBOX_CHEM); }, [configKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const scene = useMemo(() => readChemScene(doc), [doc]);
  const [drawKey, setDrawKey] = useState(0);
  const drawn = useMemo(() => drawChem(scene, seed === null ? null : `${seed}:${drawKey}`), [scene, drawKey, seed]);
  const [resetKey, setResetKey] = useState(0);
  const lab = useMemo(() => buildLab(scene, drawn), [scene, drawn, resetKey]);

  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(scene.speed);
  const [hand, setHand] = useState<Hand>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [stepAt, setStepAt] = useState(0);
  const [showing, setShowing] = useState(false);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [json, setJson] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const full = useContext(LabFull);

  useEffect(() => { setHand(null); setPick(null); setJson(null); }, [scene]);
  useEffect(() => { setStepAt(0); setShowing(false); setPicked({}); setSpeed(scene.speed); setRunning(true); }, [lab]); // eslint-disable-line react-hooks/exhaustive-deps

  const stage = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const side = useRef<HTMLElement | null>(null);
  const graphCanvas = useRef<HTMLCanvasElement | null>(null);
  const microCanvas = useRef<HTMLCanvasElement | null>(null);
  const camRef = useRef<{ doc: unknown; cam: Camera } | null>(null);
  const loopRef = useRef<Loop | null>(null);
  const fx = useMemo(() => new Effects(typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 320 : 700), []);
  const micro = useMemo(() => new Micro(), []);
  const anim = useRef<PourAnim | null>(null);
  const readouts = useRef<HTMLElement[]>([]);
  const live = useRef({ running, speed, hand, pick, full, pointer: null as null | { x: number; y: number }, probe: null as null | { x: number; y: number }, linkFrom: null as string | null, target: null as string | null });
  live.current = { ...live.current, running, speed, hand, pick, full };

  const selected = pick === null ? null : lab.vessel(pick) ?? null;
  const selBurner = pick === null ? null : lab.burners.find((b) => b.id === pick) ?? null;
  const graph = scene.graph ?? (selected === null ? null : { vessels: [selected.id], of: (selected.kind === 'syringe' ? ['gas'] : selected.wet() ? ['T', 'pH'] : ['T']) as GraphOf[] });
  const graphKey = graph === null ? '' : `${graph.vessels.join()}|${graph.of.join()}`;
  const recorder = useMemo(() => {
    if (graph === null) return null;
    const series: Series[] = [];
    graph.vessels.forEach((id) => graph.of.forEach((q) => {
      const v = lab.vessel(id);
      series.push({ label: `${q}${graph.vessels.length > 1 ? ` ${v?.label ?? id}` : ''}`, unit: UNITS[q], color: COLORS[series.length % COLORS.length] });
    }));
    return new Recorder(series, 1800);
  }, [graphKey, lab]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Der Schreiber wechselt mit der Wahl — die Bühne liest ihn aus einem Ref (sie neu zu bauen, risse eine Geste mitten durch). */
  const graphRef = useRef<{ graph: typeof graph; recorder: Recorder | null }>({ graph, recorder });
  graphRef.current = { graph, recorder };

  useLayoutEffect(() => { readouts.current = [...(side.current?.querySelectorAll<HTMLElement>('[data-q]') ?? [])]; });

  /* -- Die Bühne -------------------------------------------------------------------------------- */
  useEffect(() => {
    const el = canvas.current;
    const box = stage.current;
    if (el === null || box === null) return undefined;
    const ctx = el.getContext('2d');
    if (ctx === null) return undefined;
    const fit = (cam: Camera) => { const v = scene.view ?? boundsOf(lab); cam.fit(v[0], v[1], v[2], v[3], 12); };
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
    let dragging = false;

    const draw = () => {
      const s = live.current;
      drawLab(ctx, {
        lab, cam, dpr, pal, fx, time: clock, pick: s.pick, target: s.target, values: scene.show.values, linkFrom: s.linkFrom,
        pointer: s.pointer, holding: s.hand?.kind === 'tool' && (s.hand.tool === 'spoon' || s.hand.tool === 'loop') ? s.hand.tool : null, probe: s.probe
      });
      writeReadouts(lab, s.pick, readouts.current);
      const gc = graphCanvas.current;
      const recorder = graphRef.current.recorder;
      if (gc !== null && recorder !== null) {
        const r = gc.getBoundingClientRect();
        const gd = fitCanvas(gc, r.width, r.height);
        const g2 = gc.getContext('2d');
        if (g2 !== null) { g2.setTransform(gd, 0, 0, gd, 0, 0); drawRecorder(g2, recorder, r.width, r.height, pal.ink, pal.muted, `600 11px ${pal.font}`); }
      }
      const mc = microCanvas.current;
      const sel = s.pick === null ? undefined : lab.vessel(s.pick);
      if (mc !== null && sel !== undefined) {
        const r = mc.getBoundingClientRect();
        const md = fitCanvas(mc, r.width, r.height);
        const m2 = mc.getContext('2d');
        if (m2 !== null) { m2.setTransform(md, 0, 0, md, 0, 0); micro.draw(m2, r.width, r.height, sel, pal.dark); }
      }
    };

    const tick = (dt: number): boolean | number => {
      const s = live.current;
      clock += dt;
      const moving = stepAnim(dt) || easeTilt(dt);
      let act = 0;
      if (s.running) {
        act = lab.frame(dt, s.speed);
        fx.emit(lab, dt, s.speed);
        const { recorder, graph } = graphRef.current;
        if (recorder !== null && graph !== null) {
          const values: number[] = [];
          for (const id of graph.vessels) for (const q of graph.of) { const v = lab.vessel(id); values.push(v === undefined ? Number.NaN : quantity(v, q, lab)); }
          recorder.add(lab.time, values);
        }
      }
      fx.update(lab, dt);
      const sel = s.pick === null ? undefined : lab.vessel(s.pick);
      if (sel !== undefined && microCanvas.current !== null) micro.sync(sel, dt);
      uiClock += dt;
      if (uiClock > 0.35) { uiClock = 0; bump(); }
      if (act === 2 || fx.busy || dragging || moving || anim.current !== null || (microCanvas.current !== null && sel !== undefined)) return true;
      if (act === 1 && s.running) return 160;
      return false;
    };

    /* Die Neigung beim Ausgiessen folgt dem Ziel weich; gegossen wird, sobald das Glas schräg genug ist (auch wenn der Finger still hält). */
    const tilt = new Map<Vessel, number>();
    let pourTo: Vessel | null = null;
    const easeTilt = (dt: number): boolean => {
      let busy = false;
      if (held !== null && anim.current === null) {
        lab.pouring = pourTo !== null && Math.abs(held.angle) > 1.1 ? { from: held.id, to: pourTo.id, rate: held.kind === 'tube' ? 4 : 12 } : null;
      }
      for (const v of lab.vessels) {
        const want = tilt.get(v) ?? 0;
        if (Math.abs(v.angle - want) < 1e-3) { v.angle = want; continue; }
        v.angle += (want - v.angle) * Math.min(1, dt * 9);
        busy = true;
      }
      return busy;
    };

    /* „Pokaż” giesst: hinfahren, neigen, giessen, zurück. */
    const stepAnim = (dt: number): boolean => {
      const a = anim.current;
      if (a === null) return false;
      a.t += dt;
      const side = a.to.x >= a.hx ? 1 : -1;
      const tx = a.to.x - side * (a.from.shape.R + 0.6);
      const ty = a.to.y + a.to.shape.H + 1.2;
      const ease = (k: number) => k * k * (3 - 2 * k);
      if (a.phase === 0) {
        const k = ease(Math.min(1, a.t / 0.7));
        a.from.x = a.hx + (tx - a.hx) * k;
        a.from.y = a.hy + (ty - a.hy) * k;
        if (a.t >= 0.7) { a.phase = 1; a.t = 0; }
      } else if (a.phase === 1) {
        tilt.set(a.from, -side * 1.95);
        if (a.t >= 0.5) { a.phase = 2; a.t = 0; lab.pouring = { from: a.from.id, to: a.to.id, rate: a.from.kind === 'tube' ? 4 : 15 }; }
      } else if (a.phase === 2) {
        a.left -= dt * live.current.speed * (lab.pouring?.rate ?? 15);
        if (a.left <= 0 || (a.from.liquidMl() < 0.02 && a.from.gasTotal() <= 0)) { a.phase = 3; a.t = 0; lab.pouring = null; tilt.set(a.from, 0); }
      } else {
        const k = ease(Math.min(1, a.t / 0.7));
        a.from.x = tx + (a.hx - tx) * k;
        a.from.y = ty + (a.hy - ty) * k;
        if (a.t >= 0.7) { a.from.x = a.hx; a.from.y = a.hy; anim.current = null; }
      }
      return true;
    };

    const loop = new Loop(tick, draw);
    loopRef.current = loop;

    /* -- Gesten --------------------------------------------------------------------------------- */
    let mode: null | 'vessel' | 'burner' | 'probe' = null;
    let held: Vessel | null = null;
    let heldBurner: (typeof lab.burners)[number] | null = null;
    let off = [0, 0];
    let tapBurette = false;

    const say = (text: string) => { setSaid(text); window.setTimeout(() => setSaid((x) => (x === text ? null : x)), 2600); };

    const down = (sx: number, sy: number): boolean => {
      const s = live.current;
      const x = cam.toWorldX(sx);
      const y = cam.toWorldY(sy);
      const v = vesselAt(lab, x, y);
      const b = v === null ? burnerAt(lab, x, y) : null;
      loop.wake();
      const h = s.hand;
      if (h?.kind === 'reagent') {
        if (v === null) return false;
        if (v.kind === 'syringe') { say('Do strzykawki gazowej nie dodaje się odczynników.'); return true; }
        lab.add(v, h.id, h.amount);
        setPick(v.id);
        bump();
        return true;
      }
      if (h?.kind === 'vessel') {
        placeNew(h.type, h.size, x);
        setHand(null);
        return true;
      }
      if (h?.kind === 'tool') {
        const tool = h.tool;
        if (tool === 'probe') { live.current.probe = { x, y }; mode = 'probe'; dragging = true; return true; }
        if (tool === 'tube') {
          if (v === null) return false;
          if (live.current.linkFrom === null) { live.current.linkFrom = v.id; say('Teraz dotknij drugiego naczynia (tam popłynie gaz).'); }
          else {
            const from = lab.vessel(live.current.linkFrom);
            if (from !== undefined && from !== v) { lab.connect(from, v); say('Rurka połączona — pierwsze naczynie zamknięto korkiem.'); }
            live.current.linkFrom = null;
          }
          bump();
          return true;
        }
        if (tool === 'delete') {
          if (v !== null) { removeVessel(v); return true; }
          if (b !== null) { lab.burners.splice(lab.burners.indexOf(b), 1); for (const w of lab.vessels) if (w.y > 0.5 && Math.abs(w.x - b.x) < 3) w.y = 0; bump(); return true; }
          return false;
        }
        if (b !== null) {
          const text = tool === 'match' ? (b.on = true, null) : lab.useBurner(b, tool === 'loop' || tool === 'spoon' ? tool : null);
          if (text !== null) say(text);
          setPick(b.id);
          bump();
          return true;
        }
        if (v === null) return false;
        lab.use(tool, v);
        setPick(v.id);
        bump();
        return true;
      }
      if (v !== null) {
        setPick(v.id);
        tapBurette = v.kind === 'burette';
        if (!scene.allow.move && !sandbox) return true;
        held = v; off = [x - v.x, y - v.y]; mode = 'vessel'; dragging = true;
        el.classList.add('is-grabbing');
        return true;
      }
      if (b !== null) {
        setPick(b.id);
        if (scene.allow.burner || sandbox) { heldBurner = b; off = [x - b.x, 0]; mode = 'burner'; dragging = true; }
        return true;
      }
      return false;
    };

    const move = (sx: number, sy: number) => {
      const x = cam.toWorldX(sx);
      const y = cam.toWorldY(sy);
      if (mode === 'probe') { live.current.probe = { x, y }; loop.wake(); return; }
      if (mode === 'burner' && heldBurner !== null) {
        const nx = x - off[0];
        for (const w of lab.vessels) if (w.y > 0.5 && Math.abs(w.x - heldBurner.x) < 3) w.x = nx;
        heldBurner.x = nx;
        loop.wake();
        return;
      }
      if (mode !== 'vessel' || held === null) return;
      tapBurette = false;
      held.x = x - off[0];
      held.y = Math.max(0, y - off[1]);
      /* Über einem anderen Gefäss: ausrichten, neigen, giessen. */
      let target: Vessel | null = null;
      for (const w of lab.vessels) {
        if (w === held || w.kind === 'syringe' || w.kind === 'burette') continue;
        const rim = w.y + w.shape.H;
        if (held.y > rim - 1.5 && held.y < rim + 14 && Math.abs(held.x - w.x) < w.shape.halfWidth(w.shape.H) + held.shape.R + 3) { target = w; break; }
      }
      live.current.target = target?.id ?? null;
      if (target !== null && held.kind !== 'burette' && held.kind !== 'syringe') {
        const side = target.x >= held.x ? 1 : -1;
        held.x = target.x - side * (held.shape.R + 0.6);
        held.y = Math.max(held.y, target.y + target.shape.H + 1.2);
        tilt.set(held, -side * 1.95);
        pourTo = target;
      } else {
        tilt.set(held, 0);
        pourTo = null;
        lab.pouring = null;
      }
      loop.wake();
    };

    const up = (sx: number, sy: number, _e: PointerEvent, tap: boolean) => {
      if (mode === 'vessel' && held !== null) {
        const v = held;
        tilt.set(v, 0);
        pourTo = null;
        lab.pouring = null;
        live.current.target = null;
        if (tap && tapBurette) { lab.drip(v, v.drip > 0 ? 0 : 0.5); bump(); }
        else settleOnBench(v);
      }
      if (mode === 'burner' && heldBurner !== null && tap) { lab.useBurner(heldBurner, null); bump(); }
      if (mode === 'probe') { /* die Sonde bleibt stehen, bis das Werkzeug wechselt */ }
      if (tap && mode === null) {
        const x = cam.toWorldX(sx);
        const y = cam.toWorldY(sy);
        if (vesselAt(lab, x, y) === null && burnerAt(lab, x, y) === null && live.current.hand === null) setPick(null);
      }
      mode = null;
      held = null;
      heldBurner = null;
      dragging = false;
      el.classList.remove('is-grabbing');
      loop.wake();
    };

    /** Nach dem Loslassen: auf den Dreifuss, unter die Bürette oder auf den Tisch (ohne Überlappen). */
    const settleOnBench = (v: Vessel) => {
      if (v.kind === 'burette') {
        const under = lab.vessels.find((w) => w !== v && w.kind !== 'syringe' && w.kind !== 'burette' && Math.abs(w.x - v.x) < w.shape.R + 2);
        v.over = under?.id ?? null;
        if (under !== undefined) { v.x = under.x; v.y = under.y + under.shape.H + 3; } else v.y = Math.max(10, v.y);
        return;
      }
      const burner = lab.burners.find((b) => Math.abs(b.x - v.x) < 5 && v.y > 5 && !lab.vessels.some((w) => w !== v && Math.abs(w.y - SEAT) < 0.5 && Math.abs(w.x - b.x) < 3));
      if (burner !== undefined && v.kind !== 'syringe') { v.x = burner.x; v.y = SEAT; }
      else { v.y = 0; free(v); }
      for (const b of lab.vessels) if (b.kind === 'burette' && b.over === v.id) { b.x = v.x; b.y = v.y + v.shape.H + 3; }
    };

    const free = (v: Vessel) => {
      const span = (w: Vessel) => (w.kind === 'syringe' ? w.shape.H / 2 + 2 : w.shape.R + 0.8);
      for (let k = 0; k < 40; k += 1) {
        const hit = lab.vessels.find((w) => w !== v && w.y < 0.5 && w.kind !== 'syringe' && v.kind !== 'syringe' && Math.abs(w.x - v.x) < span(w) + span(v));
        if (hit === undefined) return;
        v.x = hit.x + Math.sign(v.x - hit.x || 1) * (span(hit) + span(v) + 0.1);
      }
    };

    const placeNew = (type: VesselKind | 'burner', size: number, x: number) => {
      if (type === 'burner') {
        lab.burners.push({ id: `p${lab.burners.length + 1}${Math.round(Math.random() * 99)}`, x, on: false, air: true, tint: null, tintLeft: 0 });
        bump();
        return;
      }
      let n = lab.vessels.length + 1;
      while (lab.vessels.some((w) => w.id === `n${n}`)) n += 1;
      const v = new Vessel(`n${n}`, type, size, x, lab.room.T, '');
      lab.vessels.push(v);
      lab.settle(v);
      settleOnBench(v);
      setPick(v.id);
      bump();
    };

    const removeVessel = (v: Vessel) => {
      lab.vessels.splice(lab.vessels.indexOf(v), 1);
      for (let i = lab.links.length - 1; i >= 0; i -= 1) if (lab.links[i].from === v.id || lab.links[i].to === v.id) lab.links.splice(i, 1);
      for (const b of lab.vessels) if (b.over === v.id) b.over = null;
      setPick(null);
      bump();
    };

    const detach = attachGestures(el, {
      down: (sx, sy) => down(sx, sy),
      move: (sx, sy) => move(sx, sy),
      up: (sx, sy, e, tap) => up(sx, sy, e, tap),
      pan: (dx, dy) => { cam.pan(dx, dy); loop.wake(); },
      zoom: (sx, sy, f) => { cam.zoomAt(sx, sy, f); loop.wake(); },
      scrolls: () => !live.current.full,
      grabs: (sx, sy) => live.current.hand !== null || vesselAt(lab, cam.toWorldX(sx), cam.toWorldY(sy)) !== null || burnerAt(lab, cam.toWorldX(sx), cam.toWorldY(sy)) !== null
    });
    const hover = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      live.current.pointer = { x: cam.toWorldX(e.clientX - r.left), y: cam.toWorldY(e.clientY - r.top) };
      const h = live.current.hand;
      if (h?.kind === 'reagent' || h?.kind === 'tool') {
        const v = vesselAt(lab, live.current.pointer.x, live.current.pointer.y);
        live.current.target = v?.id ?? null;
        loop.wake();
      }
    };
    const leave = () => { live.current.pointer = null; if (mode === null) live.current.target = null; loop.wake(); };
    el.addEventListener('pointermove', hover);
    el.addEventListener('pointerleave', leave);

    const resize = () => {
      const r = box.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const was = [cam.w, cam.h];
      cam.w = r.width; cam.h = r.height;
      /* Viel grösser oder kleiner (Vollbild, Drehen des Telefons): alles neu einpassen; sonst bleibt die Mitte. */
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
      lab.pouring = null;
    };
  }, [lab, doc, scene]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Was die Bedienung ändert, will gezeichnet werden. */
  useEffect(() => {
    if (hand?.kind !== 'tool' || hand.tool !== 'probe') live.current.probe = null;
    if (hand?.kind !== 'tool' || hand.tool !== 'tube') live.current.linkFrom = null;
    loopRef.current?.wake();
  }, [running, speed, hand, pick, lab]);

  /* -- „Pokaż": die Schritte nacheinander ------------------------------------------------------------ */
  const doAction = (a: Action) => {
    switch (a.kind) {
      case 'add': {
        const v = lab.vessel(a.to);
        const id = reagentIn(a.reagent, drawn);
        if (v !== undefined && id !== null) lab.add(v, id, num(a.amount, drawn, reagentOf(id)?.amounts[0] ?? 1));
        break;
      }
      case 'pour': {
        const from = lab.vessel(a.from);
        const to = lab.vessel(a.to);
        if (from !== undefined && to !== undefined && anim.current === null) anim.current = { from, to, ml: a.ml, t: 0, phase: 0, hx: from.x, hy: from.y, left: a.ml };
        break;
      }
      case 'burner': { const b = lab.burners.find((x) => x.id === a.id); if (b !== undefined) b.on = a.on; break; }
      case 'use': { const v = lab.vessel(a.at); if (v !== undefined) lab.use(a.tool, v); break; }
      case 'flame': { const b = lab.burners.find((x) => x.id === a.burner); if (b !== undefined) lab.useBurner(b, a.with); break; }
      case 'link': { const f = lab.vessel(a.from); const t = lab.vessel(a.to); if (f !== undefined && t !== undefined) lab.connect(f, t); break; }
      case 'seat': {
        const v = lab.vessel(a.at);
        if (v === undefined) break;
        const b = a.burner === null ? undefined : lab.burners.find((x) => x.id === a.burner);
        if (b !== undefined) { v.x = b.x; v.y = SEAT; } else if (v.y > 0.5) {
          v.y = 0;
          v.x += 13;
          for (let k = 0; k < 30 && lab.vessels.some((w) => w !== v && w.y < 0.5 && Math.abs(w.x - v.x) < w.shape.R + v.shape.R + 1); k += 1) v.x += 3;
        }
        break;
      }
      case 'drip': { const v = lab.vessel(a.at); if (v !== undefined) lab.drip(v, a.rate); break; }
      case 'speed': setSpeed(a.value); break;
    }
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
  const tools: readonly ToolKey[] = sandbox ? TOOLS : scene.tools ?? TOOLS.filter((t) => t !== 'delete');
  const edit = sandbox || scene.allow.vessels;
  const reset = () => { setResetKey((k) => k + 1); setSaid(null); anim.current = null; fx.list.length = 0; };
  const pickReagent = (id: string) => {
    const r = reagentOf(id);
    if (r === undefined) return;
    setHand(hand?.kind === 'reagent' && hand.id === id ? null : { kind: 'reagent', id, amount: r.amounts[Math.min(1, r.amounts.length - 1)] });
  };
  const fitView = () => { const cam = camRef.current?.cam; if (cam !== undefined) { const v = scene.view ?? boundsOf(lab); cam.fit(v[0], v[1], v[2], v[3], 12); loopRef.current?.wake(); } };

  const bar = (
    <>
      <LabTool icon={running ? 'pause' : 'play'} label={running ? 'Pauza' : 'Wznów'} text={running ? 'Pauza' : 'Wznów'} on={!running} onClick={() => setRunning((r) => !r)} />
      <LabTool icon="history" label="Od nowa" onClick={reset} />
      <button type="button" className="lab-tool" title="Tempo czasu" aria-label={`Tempo ${speed}×`} onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length])}>{String(speed).replace('.', ',')}×</button>
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
      stage={<div ref={stage} className="lab-canvas-box"><canvas ref={canvas} aria-label={`${config.title || 'Laboratorium chemiczne'} — stół laboratoryjny; weź odczynnik i dotknij naczynia, przeciągnij naczynie nad inne, żeby przelać`} /></div>}
      side={(
        <section ref={side} className="lab-side-in">
          {config.text.length > 0 && <LabSection title="Opis">{config.text.map((t, i) => <p key={i} className="lab-text">{t}</p>)}</LabSection>}
          <StepsPanel steps={scene.steps} at={stepAt} showing={showing} picked={picked}
            right={(i) => { const s = scene.steps[i]; return s?.ask === null || s?.ask === undefined ? -1 : answerIndex(s.ask, drawn); }}
            onShow={() => setShowing(true)}
            onNext={() => { act(stepAt); setStepAt((n) => n + 1); }}
            onAnswer={(i, k) => setPicked((p) => ({ ...p, [i]: k }))} />
          <HandBar hand={hand} lab={lab} onAmount={(a) => hand?.kind === 'reagent' && setHand({ ...hand, amount: a })} onDrop={() => setHand(null)} />
          {selected !== null && (
            <Inspector v={selected} lab={lab} show={scene.show} edit={edit} micro={microCanvas}
              onAct={{
                toggle: (what) => {
                  if (what === 'stopper') lab.use('stopper', selected);
                  else if (what === 'gauge') lab.use('gauge', selected);
                  else if (what === 'stir') lab.use('stir', selected);
                  else if (what === 'empty') lab.use('empty', selected);
                  else if (what === 'drip') lab.drip(selected, selected.drip > 0 ? 0 : 0.5);
                  else if (what === 'burner') { const b = lab.burnerOf(selected); if (b !== null) b.on = !b.on; }
                  else if (what === 'delete') {
                    lab.vessels.splice(lab.vessels.indexOf(selected), 1);
                    for (let i = lab.links.length - 1; i >= 0; i -= 1) if (lab.links[i].from === selected.id || lab.links[i].to === selected.id) lab.links.splice(i, 1);
                    setPick(null);
                  }
                  bump();
                  loopRef.current?.wake();
                },
                rate: (r) => { selected.drip = r; bump(); }
              }} />
          )}
          {selBurner !== null && (
            <BurnerPanel on={selBurner.on} air={selBurner.air} onToggle={() => { selBurner.on = !selBurner.on; bump(); loopRef.current?.wake(); }} onAir={() => { selBurner.air = !selBurner.air; bump(); loopRef.current?.wake(); }} />
          )}
          <LabSection title="Naczynia">
            <div className="lab-chips">
              {lab.vessels.map((v) => (
                <button key={v.id} type="button" className={`lab-chip-btn${v.id === pick ? ' is-on' : ''}`} aria-pressed={v.id === pick}
                  onClick={() => {
                    if (hand?.kind === 'reagent' && v.kind !== 'syringe') lab.add(v, hand.id, hand.amount);
                    else if (hand?.kind === 'tool' && hand.tool !== 'tube' && hand.tool !== 'probe' && hand.tool !== 'delete') lab.use(hand.tool, v);
                    setPick(v.id);
                    bump();
                    loopRef.current?.wake();
                  }}>
                  {v.label || v.type.name}
                </button>
              ))}
            </div>
          </LabSection>
          {(scene.allow.shelf || sandbox) && shelf.length > 0 && <LabSection title="Odczynniki"><Shelf ids={shelf} hand={hand} onPick={pickReagent} /></LabSection>}
          {tools.length > 0 && <LabSection title="Narzędzia"><Tools tools={tools} hand={hand} onPick={(t) => setHand(hand?.kind === 'tool' && hand.tool === t ? null : { kind: 'tool', tool: t })} /></LabSection>}
          {edit && <LabSection title="Sprzęt" open={sandbox}><Equipment hand={hand} onPick={(type, size) => setHand({ kind: 'vessel', type, size })} /></LabSection>}
          <LabSection title="Obserwacje"><Log events={lab.log} equations={scene.show.equations} /></LabSection>
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
                  try { localStorage.setItem(storeKey(config.title), JSON.stringify(sceneOfLab(lab, scene))); setSaid('Zapisano stół w tej przeglądarce.'); } catch { setSaid('Przeglądarka nie pozwala zapisać.'); }
                }}>Zapisz</button>
                <button type="button" className="wk-btn wk-btn-line" onClick={() => {
                  let text: string | null = null;
                  try { text = localStorage.getItem(storeKey(config.title)); } catch { text = null; }
                  if (text === null) { setSaid('Nie ma zapisanego stołu.'); return; }
                  try { setDoc(JSON.parse(text) as unknown); setSaid('Wczytano zapisany stół.'); } catch { setSaid('Zapis jest uszkodzony.'); }
                }}>Wczytaj</button>
                <button type="button" className="wk-btn wk-btn-line" aria-expanded={json !== null} onClick={() => setJson(json === null ? JSON.stringify(sceneOfLab(lab, scene), null, 1) : null)}>JSON</button>
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
function writeReadouts(lab: Lab, pick: string | null, els: readonly HTMLElement[]): void {
  if (els.length === 0 || pick === null) return;
  const v = lab.vessel(pick);
  if (v === undefined) return;
  for (const el of els) {
    const q = el.dataset.q;
    let text = '';
    if (q === 'T') text = labNum(v.T - 273.15, 1, '°C');
    else if (q === 'pH') text = v.wet() && !v.hidden ? labNum(v.spec.pH, 2) : '—';
    else if (q === 'p') text = labNum(v.pressure(lab.room.p), 1, 'kPa');
    else if (q === 'V') text = labNum(v.liquidMl(), 1, 'cm³');
    else if (q === 'gas') text = labNum(v.syringeMl < 0.6 ? 0 : v.syringeMl, 1, 'cm³');
    if (el.textContent !== text) el.textContent = text;
  }
}

export default ChemLab;
