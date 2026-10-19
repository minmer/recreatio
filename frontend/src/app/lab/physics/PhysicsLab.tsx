/**
 * 2026-10-18 — DAS LABORATORIUM DER FIZYKA 2D, gezeichnet und bedient: die
 * Bühne (Leinwand, Kamera, Gesten), die Zeit (Start, Pause, Schritt, Od nowa,
 * Tempo), die Werkzeuge (fassen und werfen, Gelenk, Seil, Stange, Feder,
 * Linijka, Sonde, Löschen), die Piaskownica (Teile dazustellen, speichern,
 * als JSON ausgeben), ein Ziel, die Schritte eines Versuchs mit „Pokaż”,
 * Pfeile, Spuren und der Schreiber.
 *
 * <b>Der Motor ist Code, der Versuch ist ein Dokument</b> (`physScene.ts`):
 * was der Baustein speichert, wird hier zur Welt — bei jedem „Od nowa” neu,
 * mit neuen gezogenen Werten bei „Nowe losowanie”.
 *
 * <b>Anfassen</b>: läuft die Zeit, zieht ein Finger den Körper weich mit
 * (und wirft ihn beim Loslassen); steht sie, setzt er ihn dorthin. Leerer
 * Grund verschiebt die Ansicht, zwei Finger (oder Strg+Rad) zoomen.
 */

import { useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';

import { LIQUIDS } from '../fluid';
import { LabFrame, LabFull, LabSection, LabTool, labNum } from '../LabFrame';
import { Recorder, drawRecorder, type Series } from '../labGraph';
import { Camera, Loop, attachGestures, fitCanvas } from '../labView';
import { MATERIALS, type Body } from './physBody';
import { drawWorld, readPalette, Trail, type Palette } from './physDraw';
import { PinJoint, RodJoint, SpringJoint } from './physJoints';
import { place } from './physPalette';
import { BasinInspector, BodyInspector, Palette as PaletteGrid, Steps, Tools, View, WorldControls } from './physPanel';
import { PHYS_PRESETS, SANDBOX_SCENE } from './physPresets';
import { sceneOfWorld } from './physSave';
import { buildWorld, drawScene, goalArea, readPhysScene, type GraphOf, type PaletteKey, type ToolKey, type VectorKind } from './physScene';
import type { World } from './physWorld';

export interface PhysConfig {
  readonly title: string;
  readonly text: readonly string[];
  readonly mode: 'sandbox' | 'experiment';
  readonly scene: unknown;
}

type Pick = { readonly kind: 'body' | 'basin'; readonly id: string } | null;

const SPEEDS = [1, 0.5, 0.25, 2] as const;

const GRAPH_SERIES: Record<GraphOf, Series> = {
  h: { label: 'h', unit: 'm', color: '#2f6fae' },
  x: { label: 'x', unit: 'm', color: '#7a5a2e' },
  v: { label: 'v', unit: 'm/s', color: '#2f8a4c' },
  vx: { label: 'vx', unit: 'm/s', color: '#8a5ad0' },
  vy: { label: 'vy', unit: 'm/s', color: '#c0392b' },
  ek: { label: 'Ek', unit: 'J', color: '#e67e22' },
  ep: { label: 'Ep', unit: 'J', color: '#2f6fae' },
  e: { label: 'E', unit: 'J', color: '#1a1815' },
  a: { label: 'a', unit: 'm/s²', color: '#c0392b' }
};

/** Ein Wert eines Körpers für den Schreiber und die Anzeige. */
function quantity(b: Body, q: GraphOf, g: number): number {
  switch (q) {
    case 'h': return b.y;
    case 'x': return b.x;
    case 'v': return Math.hypot(b.vx, b.vy);
    case 'vx': return b.vx;
    case 'vy': return b.vy;
    case 'ek': return b.kinetic();
    case 'ep': return b.m * g * b.y;
    case 'e': return b.kinetic() + b.m * g * b.y;
    case 'a': return Math.hypot(b.fx * b.invM, b.fy * b.invM - g);
  }
}

const storeKey = (title: string) => `lab-phys:${title.slice(0, 60)}`;

export function PhysicsLab({ config, whole = false, seed = null }: { config: PhysConfig; whole?: boolean; seed?: string | null }) {
  const sandbox = config.mode === 'sandbox';
  const [doc, setDoc] = useState<unknown>(() => config.scene ?? SANDBOX_SCENE);
  const configKey = JSON.stringify(config.scene ?? null);
  useEffect(() => { setDoc(config.scene ?? SANDBOX_SCENE); }, [configKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const scene = useMemo(() => readPhysScene(doc), [doc]);
  const [drawKey, setDrawKey] = useState(0);
  const drawn = useMemo(() => drawScene(scene, seed === null ? null : `${seed}:${drawKey}`), [scene, drawKey, seed]);
  const [resetKey, setResetKey] = useState(0);
  const world = useMemo(() => buildWorld(scene, drawn), [scene, drawn, resetKey]);
  const goal = useMemo(() => goalArea(scene.goal, drawn), [scene, drawn]);

  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [tool, setTool] = useState<ToolKey | null>(null);
  const [pick, setPick] = useState<Pick>(null);
  const [vectors, setVectors] = useState<readonly VectorKind[]>(scene.show.vectors);
  const [grid, setGrid] = useState(scene.show.grid);
  const [pressure, setPressure] = useState(scene.show.pressure);
  const [values, setValues] = useState(scene.show.values);
  const [goalHit, setGoalHit] = useState(false);
  const [stepAt, setStepAt] = useState(0);
  const [showing, setShowing] = useState(false);
  const [json, setJson] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const full = useContext(LabFull);

  /* Eine neue Szene: Ansicht und Werkzeuge wie im Dokument. */
  useEffect(() => {
    setVectors(scene.show.vectors); setGrid(scene.show.grid); setPressure(scene.show.pressure); setValues(scene.show.values);
    setRunning(false); setPick(null); setTool(null); setStepAt(0); setGoalHit(false);
  }, [scene]);
  useEffect(() => { setGoalHit(false); setStepAt(0); }, [world]);

  const stage = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const side = useRef<HTMLElement | null>(null);
  const graphCanvas = useRef<HTMLCanvasElement | null>(null);
  const camRef = useRef<{ doc: unknown; cam: Camera } | null>(null);
  const trails = useRef(new Map<Body, Trail>());
  const loopRef = useRef<Loop | null>(null);
  const live = useRef({ running, speed, tool, pick, vectors, grid, pressure, values, goalHit, full, preview: null as null | { x1: number; y1: number; x2: number; y2: number; kind: string }, probe: null as null | { x: number; y: number }, ruler: null as null | { x1: number; y1: number; x2: number; y2: number } });
  live.current = { ...live.current, running, speed, tool, pick, vectors, grid, pressure, values, goalHit, full };
  const readouts = useRef<HTMLElement[]>([]);

  const graphOf = scene.graph ?? (pick?.kind === 'body' ? { body: pick.id, of: ['h', 'v'] as GraphOf[] } : null);
  const recorder = useMemo(() => (graphOf === null ? null : new Recorder(graphOf.of.map((q) => GRAPH_SERIES[q]))), [graphOf?.body, graphOf?.of.join(), world]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Der Schreiber wechselt mit der Wahl — die Bühne liest ihn aus einem Ref (sie neu zu bauen, risse das Ziehen mitten durch). */
  const graphRef = useRef({ graphOf, recorder });
  graphRef.current = { graphOf, recorder };

  /* Die Werte, die sich in jedem Bild ändern: nach jedem Bauen der Bedienung neu gesammelt. */
  useLayoutEffect(() => { readouts.current = [...(side.current?.querySelectorAll<HTMLElement>('[data-q]') ?? [])]; });

  /* -- Die Bühne -------------------------------------------------------------------------------- */
  useEffect(() => {
    const el = canvas.current;
    const box = stage.current;
    if (el === null || box === null) return undefined;
    const ctx = el.getContext('2d');
    if (ctx === null) return undefined;
    if (camRef.current === null || camRef.current.doc !== doc) {
      const cam = new Camera();
      camRef.current = { doc, cam };
      const r = box.getBoundingClientRect();
      cam.w = Math.max(50, r.width); cam.h = Math.max(50, r.height);
      const v = scene.view ?? world.bounds();
      cam.fit(v[0], v[1], v[2], v[3], 16);
    }
    const cam = camRef.current.cam;
    let pal: Palette = readPalette(box);
    let dpr = fitCanvas(el, cam.w, cam.h);
    let quietGoal = 0;
    trails.current = new Map();
    for (const b of world.bodies) if (b.trace) trails.current.set(b, new Trail());

    const draw = () => {
      const s = live.current;
      const sel = s.pick?.kind === 'body' ? world.bodies.find((b) => b.id === s.pick?.id) ?? null : null;
      drawWorld(ctx, {
        world, cam, dpr, pal, vectors: s.vectors, grid: s.grid, pressure: s.pressure, values: s.values,
        selected: sel, trails: trails.current, preview: s.preview, probe: s.probe, ruler: s.ruler, goal, goalHit: s.goalHit
      });
      writeReadouts(world, s.pick, readouts.current);
      const gc = graphCanvas.current;
      const recorder = graphRef.current.recorder;
      if (gc !== null && recorder !== null) {
        const r = gc.getBoundingClientRect();
        const gd = fitCanvas(gc, r.width, r.height);
        const g2 = gc.getContext('2d');
        if (g2 !== null) { g2.setTransform(gd, 0, 0, gd, 0, 0); drawRecorder(g2, recorder, r.width, r.height, pal.ink, pal.muted, `600 11px ${pal.font}`); }
      }
    };

    const tick = (dt: number): boolean => {
      const s = live.current;
      if (!s.running) return dragging;
      const busy = world.frame(dt, s.speed);
      for (const b of world.bodies) {
        if (!b.trace) continue;
        let t = trails.current.get(b);
        if (t === undefined) { t = new Trail(); trails.current.set(b, t); }
        t.add(world.time, b.x, b.y);
      }
      const { recorder, graphOf } = graphRef.current;
      if (recorder !== null && graphOf !== null) {
        const b = world.bodies.find((x) => x.id === graphOf.body);
        if (b !== undefined) recorder.add(world.time, graphOf.of.map((q) => quantity(b, q, world.g)));
      }
      if (goal !== null && scene.goal !== null && !s.goalHit) {
        const b = world.bodies.find((x) => x.id === scene.goal?.body);
        if (b !== undefined && b.x > goal[0] && b.x < goal[2] && b.y > goal[1] && b.y < goal[3]) {
          quietGoal += dt * s.speed;
          if (quietGoal >= scene.goal.for) setGoalHit(true);
        } else quietGoal = 0;
      }
      return busy || dragging;
    };

    const loop = new Loop(tick, draw);
    loopRef.current = loop;

    /* -- Gesten --------------------------------------------------------------------------------- */
    let dragging = false;
    let mode: null | 'grab' | 'move' | 'link' | 'ruler' | 'probe' = null;
    let held: Body | null = null;
    let off = [0, 0];
    let linkFrom: { body: Body; local: [number, number] } | null = null;
    const slop = () => 10 / cam.scale;
    const walls = () => new Map(world.basins.flatMap((b) => b.walls.map((w) => [w, b] as const)));
    const deletable = (b: Body) => !b.id.startsWith('~') && !walls().has(b);

    const down = (sx: number, sy: number): boolean => {
      const s = live.current;
      const x = cam.toWorldX(sx);
      const y = cam.toWorldY(sy);
      world.wake();
      if (s.tool === 'ruler') { live.current.ruler = { x1: x, y1: y, x2: x, y2: y }; mode = 'ruler'; dragging = true; loop.wake(); return true; }
      if (s.tool === 'probe') { live.current.probe = { x, y }; mode = 'probe'; dragging = true; loop.wake(); return true; }
      const body = world.bodyAt(x, y, slop());
      const basin = body === null ? null : walls().get(body) ?? null;
      if (s.tool === 'pin') {
        if (body !== null && !body.fixed) {
          world.join(new PinJoint(`pin${world.joints.length + 1}`, body, world.ground, body.toLocal(x, y), [x, y]));
          bump(); loop.wake();
        }
        return body !== null;
      }
      if (s.tool === 'rope' || s.tool === 'rod' || s.tool === 'link') {
        if (body === null || basin !== null) return false;
        linkFrom = { body, local: body.toLocal(x, y) };
        live.current.preview = { x1: x, y1: y, x2: x, y2: y, kind: s.tool };
        mode = 'link'; dragging = true; loop.wake();
        return true;
      }
      if (s.tool === 'delete') {
        if (body !== null && deletable(body)) { world.remove(body); setPick(null); bump(); loop.wake(); return true; }
        if (basin !== null) {
          for (const w of basin.walls) world.remove(w);
          world.basins.splice(world.basins.indexOf(basin), 1);
          for (let i = world.pipes.length - 1; i >= 0; i -= 1) if (world.pipes[i].a === basin || world.pipes[i].b === basin) world.pipes.splice(i, 1);
          setPick(null); bump(); loop.wake();
          return true;
        }
        return false;
      }
      if (body === null) {
        const inside = world.basins.find((b) => b.inside(x, y));
        if (inside !== undefined) setPick({ kind: 'basin', id: inside.id });
        return false;
      }
      if (basin !== null) { setPick({ kind: 'basin', id: basin.id }); return false; }
      setPick({ kind: 'body', id: body.id });
      const editable = sandbox || scene.allow.edit;
      if (!body.fixed && body.draggable && scene.allow.drag) {
        if (s.running) { world.grab(body, x, y); mode = 'grab'; } else { held = body; off = [x - body.x, y - body.y]; mode = 'move'; }
      } else if (body.fixed && editable && sandbox && deletable(body)) {
        held = body; off = [x - body.x, y - body.y]; mode = 'move';
      } else return true;
      dragging = true;
      el.classList.add('is-grabbing');
      loop.wake();
      return true;
    };

    const move = (sx: number, sy: number) => {
      const x = cam.toWorldX(sx);
      const y = cam.toWorldY(sy);
      if (mode === 'grab') world.drag(x, y);
      else if (mode === 'move' && held !== null) {
        held.x = x - off[0]; held.y = y - off[1];
        held.vx = 0; held.vy = 0; held.w = 0;
        held.update();
        world.wake();
        trails.current.get(held)?.clear();
      } else if (mode === 'ruler' && live.current.ruler !== null) live.current.ruler = { ...live.current.ruler, x2: x, y2: y };
      else if (mode === 'probe') live.current.probe = { x, y };
      else if (mode === 'link' && live.current.preview !== null) live.current.preview = { ...live.current.preview, x2: x, y2: y };
      loop.wake();
    };

    const up = (sx: number, sy: number, _event: PointerEvent, tap: boolean) => {
      const x = cam.toWorldX(sx);
      const y = cam.toWorldY(sy);
      if (mode === 'grab') world.release();
      if (mode === 'link' && linkFrom !== null) {
        const target = world.bodyAt(x, y, slop());
        const other = target !== null && target !== linkFrom.body && !walls().has(target) ? target : world.ground;
        const lb: [number, number] = other === world.ground ? [x, y] : other.toLocal(x, y);
        const [ax, ay] = linkFrom.body.toWorld(...linkFrom.local);
        const len = Math.max(0.05, Math.hypot(x - ax, y - ay));
        const id = `j${world.joints.length + 1}`;
        const kind = live.current.tool;
        world.join(kind === 'link' ? new SpringJoint(id, linkFrom.body, other, linkFrom.local, lb, len, 200, 1) : new RodJoint(id, linkFrom.body, other, linkFrom.local, lb, len, kind === 'rope'));
        live.current.preview = null;
        linkFrom = null;
        bump();
      }
      if (tap && mode === null && world.bodyAt(x, y, slop()) === null && !world.basins.some((b) => b.inside(x, y))) setPick(null);
      if (mode === 'move' && held !== null) { held = null; world.wake(); }
      mode = null;
      dragging = false;
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
      grabs: (sx, sy) => live.current.tool !== null || world.bodyAt(cam.toWorldX(sx), cam.toWorldY(sy), slop()) !== null
    });

    const resize = () => {
      const r = box.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const was = [cam.w, cam.h];
      cam.w = r.width; cam.h = r.height;
      /* Viel grösser oder kleiner (Vollbild, Drehen des Telefons): alles neu einpassen; sonst bleibt die Mitte. */
      if (was[0] > 10 && was[1] > 10 && (Math.abs(r.width - was[0]) > was[0] * 0.25 || Math.abs(r.height - was[1]) > was[1] * 0.25)) { const v = scene.view ?? world.bounds(); cam.fit(v[0], v[1], v[2], v[3], 16); }
      else if (was[0] > 10 && was[1] > 10) cam.scale *= Math.min(r.width / was[0], r.height / was[1]) ** 0.5;
      dpr = fitCanvas(el, cam.w, cam.h);
      loop.wake();
    };
    const sizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    sizes?.observe(box);
    const seen = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => loop.show(entries.some((e) => e.isIntersecting)));
    seen?.observe(box);
    const theme = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onTheme = () => { pal = readPalette(box); loop.wake(); };
    theme?.addEventListener?.('change', onTheme);
    resize();
    loop.wake();
    return () => {
      detach();
      sizes?.disconnect();
      seen?.disconnect();
      theme?.removeEventListener?.('change', onTheme);
      loop.dispose();
      loopRef.current = null;
    };
  }, [world, doc, scene, goal]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Was die Bedienung ändert, will gezeichnet werden. */
  useEffect(() => { world.wake(); loopRef.current?.wake(); }, [running, speed, tool, pick, vectors, grid, pressure, values, goalHit, world]);

  /* -- „Pokaż": die Schritte des Versuchs nacheinander ------------------------------------------- */
  const act = (i: number) => {
    const step = scene.steps[i];
    if (step === undefined || step.do === null) return;
    const d = step.do;
    if (d.kind === 'play') setRunning(true);
    else if (d.kind === 'pause') setRunning(false);
    else if (d.kind === 'open') {
      const hole = world.basins.find((b) => b.id === d.basin)?.holes[d.hole];
      if (hole !== undefined) { hole.open = true; setRunning(true); }
    } else if (d.kind === 'push') {
      const b = world.bodies.find((x) => x.id === d.body);
      if (b !== undefined) { b.vx = d.vx; b.vy = d.vy; setRunning(true); }
    }
    world.wake();
    bump();
  };
  useEffect(() => {
    if (!showing) return undefined;
    if (stepAt >= scene.steps.length) { setShowing(false); return undefined; }
    act(stepAt);
    const timer = window.setTimeout(() => setStepAt((n) => n + 1), (scene.steps[stepAt]?.wait ?? 3) * 1000);
    return () => window.clearTimeout(timer);
  }, [showing, stepAt]); // eslint-disable-line react-hooks/exhaustive-deps

  /* -- Was gewählt ist ------------------------------------------------------------------------- */
  const body = pick?.kind === 'body' ? world.bodies.find((b) => b.id === pick.id) ?? null : null;
  const basin = pick?.kind === 'basin' ? world.basins.find((b) => b.id === pick.id) ?? null : null;
  const edit = sandbox || scene.allow.edit && scene.allow.add;
  const palette = sandbox ? scene.allow.palette.length > 0 ? scene.allow.palette : (['ball', 'box', 'plank', 'wedge', 'ramp', 'wall', 'pendulum', 'spring', 'pulley', 'seesaw', 'basin'] as PaletteKey[]) : scene.allow.add ? scene.allow.palette : [];
  const tools = sandbox ? (['pin', 'rope', 'rod', 'link', 'ruler', 'probe', 'delete'] as ToolKey[]) : scene.allow.tools;
  const controls = sandbox ? (['air', 'gravity'] as const) : scene.controls;

  const reset = () => { setRunning(false); setResetKey((k) => k + 1); setShowing(false); setStepAt(0); setGoalHit(false); setSaid(null); };
  const addItem = (key: PaletteKey) => {
    const cam = camRef.current?.cam;
    const made = place(world, key, cam?.cx ?? 3, Math.max(0.6, (cam?.cy ?? 2) + 0.5));
    if (made.length > 0) setPick({ kind: 'body', id: made[0].id });
    bump();
  };

  const bar = (
    <>
      <LabTool icon={running ? 'pause' : 'play'} label={running ? 'Pauza' : 'Start'} text={running ? 'Pauza' : 'Start'} on={running} onClick={() => setRunning((r) => !r)} />
      {!running && <LabTool icon="next" label="Krok (1/60 s)" onClick={() => { world.wake(); world.frame(1 / 60, 1); bump(); loopRef.current?.wake(); }} />}
      <LabTool icon="history" label="Od nowa" onClick={reset} />
      <button type="button" className="lab-tool" title="Tempo" aria-label={`Tempo ${speed}×`} onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>{String(speed).replace('.', ',')}×</button>
      {scene.vars.length > 0 && <LabTool icon="shuffle" label="Nowe losowanie" onClick={() => { setDrawKey((k) => k + 1); setRunning(false); }} />}
      <LabTool icon="search" label="Dopasuj widok" onClick={() => { const cam = camRef.current?.cam; if (cam !== undefined) { const v = scene.view ?? world.bounds(); cam.fit(v[0], v[1], v[2], v[3], 16); loopRef.current?.wake(); } }} />
    </>
  );

  return (
    <LabFrame
      whole={whole}
      title={config.title || (sandbox ? 'Laboratorium fizyki' : 'Doświadczenie')}
      chips={<span className="lab-chip">{sandbox ? 'piaskownica' : 'doświadczenie'}</span>}
      bar={bar}
      note={goalHit && scene.goal !== null ? <p className="lab-note is-ok" role="status">{scene.goal.say}</p> : said !== null ? <p className="lab-note" role="status">{said}</p> : null}
      stage={<div ref={stage} className="lab-canvas-box"><canvas ref={canvas} aria-label={`${config.title || 'Laboratorium fizyki'} — scena; przeciągnij ciała, przesuń tło, dwa palce przybliżają`} /></div>}
      side={(
        <section ref={side} className="lab-side-in">
          {config.text.length > 0 && <LabSection title="Opis">{config.text.map((t, i) => <p key={i} className="lab-text">{t}</p>)}</LabSection>}
          <Steps steps={scene.steps} at={stepAt} showing={showing} onShow={() => { reset(); window.setTimeout(() => { setStepAt(0); setShowing(true); }, 60); }} onNext={() => { act(stepAt); setStepAt((n) => n + 1); }} />
          {body !== null && (
            <BodyInspector body={body} edit={edit && !running} onDelete={() => { world.remove(body); setPick(null); bump(); }}
              onChange={(p) => {
                if (p.material !== undefined) { body.material = MATERIALS[p.material] ?? body.material; body.setMass(); }
                if (p.fixed !== undefined) { body.type = p.fixed ? 'static' : 'dynamic'; body.setMass(); body.vx = 0; body.vy = 0; body.w = 0; }
                if (p.trace !== undefined) { body.trace = p.trace; if (!p.trace) trails.current.delete(body); }
                if (p.angle !== undefined) { body.a = p.angle; body.update(); }
                world.wake(); bump();
              }} />
          )}
          {basin !== null && (
            <BasinInspector basin={basin} world={world} edit={edit}
              onChange={(p) => {
                if (p.hole !== undefined) { const h = basin.holes[p.hole]; if (h !== undefined) h.open = !h.open; }
                if (p.pour !== undefined) { const l = LIQUIDS[p.pour]; if (l !== undefined) basin.add(l, 0.1 * basin.width); }
                if (p.drain === true) basin.layers.length = 0;
                world.wake(); bump();
              }} />
          )}
          {palette.length > 0 && <LabSection title="Dodaj"><PaletteGrid items={palette} onPick={addItem} /></LabSection>}
          {tools.length > 0 && <LabSection title="Narzędzia"><Tools tools={tools} active={tool} onPick={setTool} /></LabSection>}
          {recorder !== null && (
            <LabSection title={`Wykres: ${world.bodies.find((b) => b.id === graphOf?.body)?.label ?? ''}`}>
              <canvas ref={graphCanvas} className="lab-graph" aria-label="Wykres wartości w czasie" />
            </LabSection>
          )}
          <WorldControls controls={controls} gravity={world.g} air={world.air > 0}
            onGravity={(g) => { world.g = g; world.wake(); bump(); }} onAir={(on) => { world.air = on ? 1 : 0; world.wake(); bump(); }} />
          <View vectors={vectors} grid={grid} pressure={pressure} values={values} liquid={world.basins.length > 0}
            onToggle={(w) => {
              if (w === 'grid') setGrid((g) => !g);
              else if (w === 'pressure') setPressure((p) => !p);
              else if (w === 'values') setValues((v) => !v);
              else setVectors((vs) => (vs.includes(w) ? vs.filter((x) => x !== w) : [...vs, w]));
            }} />
          {sandbox && (
            <LabSection title="Doświadczenia i zapis" open={false}>
              <label className="lab-field">
                Wczytaj doświadczenie
                <select value="" onChange={(e) => { const p = PHYS_PRESETS.find((x) => x.key === e.currentTarget.value); if (p !== undefined) { setDoc(p.scene); setSaid(p.summary); } }}>
                  <option value="">— wybierz —</option>
                  {PHYS_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.title}</option>)}
                </select>
              </label>
              <div className="lab-row">
                <button type="button" className="wk-btn wk-btn-line" onClick={() => {
                  try { localStorage.setItem(storeKey(config.title), JSON.stringify(sceneOfWorld(world, scene))); setSaid('Zapisano układ w tej przeglądarce.'); } catch { setSaid('Przeglądarka nie pozwala zapisać.'); }
                }}>Zapisz</button>
                <button type="button" className="wk-btn wk-btn-line" onClick={() => {
                  let text: string | null = null;
                  try { text = localStorage.getItem(storeKey(config.title)); } catch { text = null; }
                  if (text === null) { setSaid('Nie ma zapisanego układu.'); return; }
                  try { setDoc(JSON.parse(text) as unknown); setSaid('Wczytano zapisany układ.'); } catch { setSaid('Zapis jest uszkodzony.'); }
                }}>Wczytaj</button>
                <button type="button" className="wk-btn wk-btn-line" aria-expanded={json !== null} onClick={() => setJson(json === null ? JSON.stringify(sceneOfWorld(world, scene), null, 1) : null)}>JSON</button>
              </div>
              {json !== null && (
                <>
                  <p className="lab-muted">Ten JSON to scena — wklej go w edytorze modułu jako „scene”, a doświadczenie zostanie na stronie.</p>
                  <textarea className="lab-json" value={json} rows={8} readOnly onFocus={(e) => e.currentTarget.select()} />
                </>
              )}
            </LabSection>
          )}
          {body === null && basin === null && <p className="lab-muted">{sandbox ? 'Dodaj ciała z listy, przeciągaj je, łącz narzędziami. Start uruchamia czas.' : 'Dotknij ciała albo zbiornika, żeby zobaczyć jego wartości. Start uruchamia czas.'}</p>}
        </section>
      )}
    />
  );
}

/** Die Werte des Gewählten in die Bedienung (in jedem Bild). */
function writeReadouts(world: World, pick: Pick, els: readonly HTMLElement[]): void {
  if (els.length === 0 || pick === null) return;
  const b = pick.kind === 'body' ? world.bodies.find((x) => x.id === pick.id) : undefined;
  const basin = pick.kind === 'basin' ? world.basins.find((x) => x.id === pick.id) : undefined;
  for (const el of els) {
    const q = el.dataset.q;
    let text = '';
    if (b !== undefined) {
      if (q === 'v') text = labNum(Math.hypot(b.vx, b.vy), 2, 'm/s');
      else if (q === 'h') text = labNum(b.y, 2, 'm');
      else if (q === 'ek') text = labNum(b.kinetic(), 2, 'J');
      else if (q === 'ep') text = labNum(b.m * world.g * b.y, 2, 'J');
      else if (q === 'lift') text = b.lift > 0 ? labNum(b.lift, 1, 'N') : '—';
    } else if (basin !== undefined && q === 'level') {
      text = labNum(basin.surface() - basin.y0, 3, 'm');
    }
    if (el.textContent !== text) el.textContent = text;
  }
}

export default PhysicsLab;
