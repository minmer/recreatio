/**
 * LABOR 2D (v2) — DAS LABOR IM GANZEN BILDSCHIRM (seit 2026-10-24): oben
 * Titel und Phase, links die Werkzeuge, in der Mitte die Bühne, rechts nur bei
 * Bedarf das Feld des Gewählten, unten die Zeit. Nichts rollt; Einstellungen,
 * Beschreibung und Backen öffnen sich erst auf Wunsch.
 *
 * Zwei Phasen: Vorbereiten (Zeit 0 — alles lässt sich bauen und einstellen),
 * dann Rechnen. Ändern geht nur in der Pause: ein Werkzeug, das die Szene
 * ändert, hält die Rechnung an. „Od nowa“ kehrt zum Aufbau zurück, wie er beim
 * Start war. Bei „ask“ hält das Labor bei einem heftigen Zustand an und fragt,
 * wie weiter gerechnet wird (extremes.ts).
 *
 * Die Engine läuft im Arbeiter (host.ts, engine.worker.ts); in React stehen
 * nur Einstellungen und die Kennzahlen, die der Arbeiter fünfmal je Sekunde
 * schickt. Die Leinwand entsteht im Effekt selbst (nicht im JSX): eine
 * Leinwand lässt sich nur einmal an einen Arbeiter übergeben, und React ruft
 * Effekte im StrictMode zweimal auf.
 */

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { BakePanel, PlayerBar, type BakeProgress } from './ClipControls';
import type { ClipEngine, ClipInfo } from './clip/clip';
import type { ProbeInfo } from './engine/engine';
import type { ExtremeEvent } from './engine/extremes';
import { GRAIN_D } from './engine/grains';
import type { ObjectPatch } from './engine/objects';
import type { BakeOptions, ChartSample, HostStats } from './engine/protocol';
import { CELL, QUALITIES, isQuality, readScene, writeScene, type ExtremeMode, type Quality } from './engine/scene';
import type { Region } from './engine/shapes';
import { LabHost } from './host';
import { t } from './i18n';
import type { Lab2DConfig } from './Lab2D';
import { ObjectPanel } from './ObjectPanel';
import { newObjectOp } from './objectKinds';
import { BubblePanel, Charts, forcesOf, Hud, Inspector, Legend, type Level } from './panels';
import type { Overlay } from './render/frame';
import type { Walls } from './render/glRenderer';
import type { View } from './render/view';
import { BakeDialog, ExtremeDialog, InfoSheet } from './shell/Dialogs';
import { SettingsSheet, type Ambient } from './shell/SettingsSheet';
import { SidePanel, type SideTab } from './shell/SidePanel';
import { TimeBar } from './shell/TimeBar';
import { EDIT_TOOLS, MATERIALS, ToolOptions, ToolRail, WALL_MATERIALS, type Tool, type ToolSettings } from './shell/ToolRail';
import { TopBar, type Phase } from './shell/TopBar';

const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4, 8, 16];
const T0 = 273.15;
const G0 = 9.80665;
/** Molmassen (kg/mol) für die Umrechnung Volumen- ↔ Massenanteil des Sauerstoffs (IUPAC; wie materials.json). */
const M_N2 = 0.0280134;
const M_O2 = 0.0319988;
const o2Volume = (yO2: number): number => (yO2 / M_O2) / (yO2 / M_O2 + (1 - yO2) / M_N2);
const o2Mass = (xO2: number): number => (xO2 * M_O2) / (xO2 * M_O2 + (1 - xO2) * M_N2);

/* In diesem Browser gemerkt: die Stufe (wer einmal eine niedrigere gewählt hat, bekommt sie wieder), die Stufe der Texte, wie zuletzt gebacken wurde. */
const QUALITY_KEY = 'recreatio.lab2d.quality';
const LEVEL_KEY = 'recreatio.lab2d.level';
const BAKE_KEY = 'recreatio.lab2d.bake';
const load = (key: string): string | null => { try { return window.localStorage.getItem(key); } catch { return null; } };
const store = (key: string, value: string): void => { try { window.localStorage.setItem(key, value); } catch { /* ohne Speicher gilt die Wahl nur jetzt */ } };
const savedQuality = (): Quality | null => { const v = load(QUALITY_KEY); return isQuality(v) ? v : null; };
const savedLevel = (): Level => (load(LEVEL_KEY) === 'secondary' ? 'secondary' : 'primary');
/** Wie zuletzt gebacken wurde: Bilder je Sekunde, Schlüsselbilder, wer rechnet (Vorgabe seit 2026-10-25: die Grafikkarte). */
function savedBake(): { fps: number; keyEvery: number; engine: ClipEngine } {
  try {
    const v = JSON.parse(load(BAKE_KEY) ?? '{}') as { fps?: unknown; keyEvery?: unknown; engine?: unknown };
    return { fps: typeof v.fps === 'number' ? v.fps : 30, keyEvery: typeof v.keyEvery === 'number' ? v.keyEvery : 5, engine: v.engine === 'cpu' ? 'cpu' : 'gpu' };
  } catch { return { fps: 30, keyEvery: 5, engine: 'gpu' }; }
}
function withQuality(raw: unknown, q: Quality): unknown {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>), quality: q } : { quality: q };
}
function ambientOf(scene: unknown): Ambient {
  const a = readScene(scene).scene.ambient;
  return { p: a.p / 1000, T: a.T - T0, rh: a.rh, g: a.g / G0, o2: o2Volume(a.air.O2) };
}
const isObject = (o: Record<string, unknown>): boolean => o.op === 'body' || o.op === 'beaker' || o.op === 'hotplate';

/** Kann dieser Browser WebGPU (der beschleunigte Weg)? Ob die Karte mitspielt, sagt erst der Arbeiter. */
const HAS_WEBGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

export function LabApp({ config, createWorker, createAccelWorker, onClose }: {
  config: Lab2DConfig;
  createWorker: () => Worker;
  createAccelWorker: () => Worker;
  /** Die eigene Ebene schliessen (fehlt im ganzen Fenster der Seite: dort schliesst deren Leiste). */
  onClose?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<LabHost | null>(null);
  const drag = useRef<{ start: [number, number]; startPx: [number, number]; last: [number, number]; at: number; target: string | null } | null>(null);
  const samplesRef = useRef<ChartSample[]>([]);
  const opsRef = useRef<Record<string, unknown>[]>([]);
  /** Der Aufbau beim Start der Rechnung — „Od nowa“ kehrt dorthin zurück. */
  const setupRef = useRef<unknown>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [stats, setStats] = useState<HostStats | null>(null);
  const [samples, setSamples] = useState<readonly ChartSample[]>([]);
  const [paused, setPaused] = useState(true);
  const [speedAt, setSpeedAt] = useState(3);
  const [hud, setHud] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [toolOpts, setToolOpts] = useState(true);
  const [ts, setTs] = useState<ToolSettings>({ addKind: 'ice', material: 'water', wallMaterial: 'glass', brushMm: 8, tempC: 20, saltPct: 10 });
  const [selected, setSelected] = useState<string | null>(null);
  const [ops, setOps] = useState<readonly Record<string, unknown>[]>([]);
  const [quality, setQuality] = useState<Quality>(() => savedQuality() ?? readScene(config.scene).scene.quality);
  const [level, setLevel] = useState<Level>(savedLevel);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [info, setInfo] = useState<ProbeInfo | null | undefined>(undefined);
  const [line, setLine] = useState<readonly [number, number, number, number] | null>(null);
  const [lagging, setLagging] = useState<number | null>(null);
  const [view, setView] = useState<{ view: View; walls: Walls } | null>(null);
  const [ambient, setAmbientState] = useState<Ambient>(() => ambientOf(config.scene));
  const [particles, setParticles] = useState(false);
  /* Der beschleunigte Weg (WebGPU): ein anderer Arbeiter; die Szene wandert beim Umschalten mit (nextScene). */
  const [accel, setAccel] = useState(false);
  const nextScene = useRef<unknown>(null);
  /* B (seit 2026-10-25): ein Schlüsselbild, ab dem der nächste Arbeiter live weitergeht (Nachweis von der GPU); was nach dem Wechsel aus dem beschleunigten Weg zu tun ist. */
  const resumeRef = useRef<Uint8Array | null>(null);
  const pendingRef = useRef<'bake' | 'play' | null>(null);
  const bakeNoteRef = useRef<string | undefined>(undefined);
  const [clip, setClip] = useState<ClipInfo | null>(null);
  const [bake, setBake] = useState<BakeProgress | null>(null);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [scenarioAt, setScenarioAt] = useState(0);
  const [extreme, setExtreme] = useState<ExtremeEvent | null>(null);
  const [sheet, setSheet] = useState<'settings' | 'info' | null>(null);
  const [bakeOpen, setBakeOpen] = useState(false);
  const [sideTab, setSideTab] = useState<SideTab | null>(null);
  const [chartsOn, setChartsOn] = useState(false);
  const scenarios = useMemo(() => [{ title: config.title, text: config.text, scene: config.scene }, ...(config.scenarios ?? [])], [config.title, config.text, config.scene, config.scenarios]);
  const scenario = scenarios[Math.min(scenarioAt, scenarios.length - 1)] ?? scenarios[0];
  /* Für die Ereignisse des Arbeiters (ohne veraltete Werte). */
  const startRef = useRef(config.start);
  startRef.current = config.start;
  const secondsRef = useRef(config.seconds ?? 30);
  secondsRef.current = config.seconds !== undefined && config.seconds > 0 ? config.seconds : 30;
  const scenarioRef = useRef(0);
  const autoRef = useRef(-1);
  const clipRef = useRef<ClipInfo | null>(null);
  clipRef.current = clip;
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const speedRef = useRef(SPEEDS[speedAt]);
  speedRef.current = SPEEDS[speedAt];
  /* Ein neu gestarteter Arbeiter bekommt die Einstellungen der Oberfläche: sonst rechnete er, während die Leiste „Pause“ zeigt. */
  const settingsRef = useRef({ paused, overlay, particles });
  settingsRef.current = { paused, overlay, particles };
  const lagRef = useRef(0);

  const host = (): LabHost | null => hostRef.current;
  const refreshOps = (h: LabHost): Promise<readonly Record<string, unknown>[]> => h.serialize().then((s) => {
    const list = Array.isArray(s?.ops) ? (s?.ops as Record<string, unknown>[]) : [];
    opsRef.current = list;
    setOps(list);
    return list;
  });
  /** Einen Gegenstand wählen (null: keinen) — sein Umriss und sein Feld kommen mit den Kennzahlen. */
  const choose = (id: string | null): void => {
    setSelected(id);
    hostRef.current?.selectObject(id);
    if (id !== null) setSideTab('object');
  };

  useEffect(() => {
    const box = boxRef.current;
    if (box === null) return undefined;
    const canvas = document.createElement('canvas');
    canvas.className = 'l2d-canvas';
    box.prepend(canvas);
    setError(null);
    samplesRef.current = [];
    const dark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
    const startScene = nextScene.current ?? withQuality(config.scene, qualityRef.current);
    nextScene.current = null;
    const resume = resumeRef.current ?? undefined;
    resumeRef.current = null;
    const h = new LabHost(canvas, accel ? createAccelWorker : createWorker, {
      onReady: () => {
        setReady(true);
        void refreshOps(h);
        const s = settingsRef.current;
        if (speedRef.current !== 1) h.setSpeed(speedRef.current);
        if (s.overlay !== 'none') h.overlay(s.overlay);
        if (s.particles) h.particles(true);
        if (s.paused) h.pause(true);
        /* Aus dem beschleunigten Weg gekommen, um zu backen oder abzuspielen (dort bevorzugt der Nachweis von der GPU). */
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending === 'bake') setBakeOpen(true);
        else if (pending === 'play') h.clipOpen(true, 'gpu');
      },
      onStats: (s) => {
        setStats(s);
        if (s.samples.length > 0) {
          const all = samplesRef.current;
          all.push(...s.samples);
          if (all.length > 600) all.splice(0, all.length - 600);
          setSamples([...all]);
        }
        const want = speedRef.current;
        if (s.paused || want > 1 || s.simRate >= 0.97 * want) { lagRef.current = 0; setLagging(null); return; }
        if (s.simRate < 0.9 * want) lagRef.current += 1;
        if (lagRef.current >= 15) setLagging(s.simRate);
      },
      onView: (v, w) => setView({ view: v, walls: w }),
      onRefused: () => setNote(t('refused')),
      onError: setError,
      onClip: (c) => {
        setClip(c);
        /* Der Baustein will, dass beim Öffnen gebacken wird: einmal je Szenariusz — ein schon gebackener Nachweis spielt gleich ab. */
        if (startRef.current === 'bake' && autoRef.current !== scenarioRef.current) {
          autoRef.current = scenarioRef.current;
          if (c !== null) h.clipOpen(true);
          else { const s = savedBake(); h.bake({ seconds: secondsRef.current, ...s, engine: HAS_WEBGPU ? s.engine : 'cpu', quality: qualityRef.current, extremes: 'normalize' }); }
        }
      },
      onBake: (m) => {
        setBake(m.state === 'done' || m.state === 'failed' ? null : { state: m.state, t: m.t, seconds: m.seconds, rate: m.rate, message: m.message, engine: m.engine, note: m.note });
        if (m.state === 'failed') setNote(m.message === 'engine' ? t('clipEngine') : m.message === 'short' ? t('bakeShort') : `${t('bakeFailed')}${m.message ? ` (${m.message})` : ''}`);
        /* Warum die CPU backt (oder die Karte aufgab) — einmal je Backen. */
        if (m.state === 'preparing') bakeNoteRef.current = undefined;
        if (m.note !== undefined && m.note !== bakeNoteRef.current) {
          bakeNoteRef.current = m.note;
          setNote(t(m.note === 'cpu-only' ? 'bakeCpuOnly' : m.note === 'no-webgpu' ? 'bakeNoWebgpu' : m.note === 'gpu-lost' ? 'bakeGpuLost' : 'bakeGpuFailed'));
        }
        if (m.state === 'done' || m.state === 'failed') bakeNoteRef.current = undefined;
      },
      onResume: (scene, snapshot) => {
        /* „Na żywo“ aus einem Nachweis von der GPU: im beschleunigten Weg weiter, ab seinem Schlüsselbild (mit der Auflösung des Nachweises). */
        nextScene.current = scene;
        resumeRef.current = snapshot;
        setupRef.current = null;
        setQuality(readScene(scene).scene.quality);
        lagRef.current = 0;
        setLagging(null);
        setStats(null);
        setAccel(true);
      },
      onLive: (time) => {
        setBake(null);
        setPaused(true);
        const kept = (clipRef.current?.samples ?? []).filter((x) => x.t <= time + 1e-9);
        samplesRef.current = [...kept];
        setSamples([...kept]);
      },
      onExtreme: (ev) => { setExtreme(ev); setPaused(true); },
      onGpu: (ok, _adapter, message, scene) => {
        if (ok) return;
        if (resume !== undefined) {
          /* Live weiter aus einem Nachweis von der GPU, aber der beschleunigte Weg ging nicht: dasselbe Schlüsselbild auf der CPU. */
          nextScene.current = startScene;
          resumeRef.current = resume;
          setNote(`${t('accelFailed')}${message ? ` (${message})` : ''}`);
          setAccel(false);
          return;
        }
        /* WebGPU fehlt, die Karte gibt auf oder die Szene enthält, was der beschleunigte Weg noch nicht kann: zurück zur CPU — mit der Szene, die er zurückgibt (samt Handgriffen). */
        const q = savedQuality() ?? readScene(config.scene).scene.quality;
        nextScene.current = withQuality(scene ?? startScene, q);
        setQuality(q);
        setNote(message === 'cpu-only' ? t('accelNoOther') : `${t('accelFailed')}${message ? ` (${message})` : ''}`);
        setAccel(false);
      }
    });
    hostRef.current = h;
    const r = box.getBoundingClientRect();
    void h.start(startScene, r.width, r.height, window.devicePixelRatio || 1, dark, settingsRef.current.paused || resume !== undefined, resume);
    const ro = new ResizeObserver(() => {
      const q = box.getBoundingClientRect();
      h.resize(q.width, q.height, window.devicePixelRatio || 1);
    });
    ro.observe(box);
    return () => {
      ro.disconnect();
      h.dispose();
      canvas.remove();
      hostRef.current = null;
      setReady(false);
    };
  }, [config.scene, createWorker, createAccelWorker, accel]);

  useEffect(() => {
    if (note === null) return undefined;
    const id = window.setTimeout(() => setNote(null), 4500);
    return () => window.clearTimeout(id);
  }, [note]);

  /* Die Stufe folgt der Engine (nach dem Backen mit einer anderen Auflösung, nach dem Laden einer Datei). */
  const engineQuality = stats?.engine.quality;
  useEffect(() => { if (engineQuality !== undefined && !accel) setQuality(engineQuality); }, [engineQuality, accel]);

  /* -- Phasen ------------------------------------------------------------------------------------------ */

  const clipStats = stats?.clip ?? null;
  const mode = clipStats?.mode ?? 'live';
  const time = stats?.engine.time ?? 0;
  const phase: Phase = bake !== null || mode === 'baking' ? 'baking' : mode === 'playback' ? 'clip' : time === 0 && paused ? 'prepare' : 'simulate';
  const live = phase === 'prepare' || phase === 'simulate';
  const running = live && !paused;
  const atStart = phase === 'prepare';
  const extremesMode: ExtremeMode = stats?.engine.extremes.mode ?? readScene(config.scene).scene.extremes;

  const pauseForEdit = (): void => {
    if (!running) return;
    setPaused(true);
    host()?.pause(true);
    setNote(t('pausedForEdit'));
  };
  const togglePlay = (): void => {
    if (!live) return;
    const h = host();
    const next = !paused;
    /* Der Start hält den Aufbau fest (die Nachrichten kommen der Reihe nach an: erst der Aufbau, dann die Rechnung). */
    if (!next && atStart && h !== null) void h.serialize().then((s) => { if (s !== null) setupRef.current = s; });
    setPaused(next);
    h?.pause(next);
    if (!next && EDIT_TOOLS.includes(tool)) setTool('select');
  };
  const pickTool = (k: Tool): void => {
    if (!live) { setNote(t('clipTools')); return; }
    if (EDIT_TOOLS.includes(k)) pauseForEdit();
    if (k === tool) { setToolOpts(!toolOpts); return; }
    setTool(k);
    setToolOpts(true);
  };

  /* -- Die Bühne ----------------------------------------------------------------------------------------- */

  const local = (e: ReactPointerEvent<HTMLDivElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const brushAt = (x: number, y: number): void => {
    const h = host();
    if (h === null) return;
    const region: Region = { circle: [x, y, ts.brushMm / 1000] };
    if (tool === 'erase') { h.apply({ op: 'erase', region }); return; }
    const m = MATERIALS.find((k) => k.key === ts.material) ?? MATERIALS[0];
    if (m.solid !== null) h.addSolid(region, m.solid, T0 + ts.tempC);
    else if (m.grains !== undefined) h.apply({ op: 'grains', region, material: m.grains, d: GRAIN_D, T: T0 + ts.tempC });
    else if (m.liquid !== undefined && m.solute !== undefined) h.addLiquid(region, { [m.liquid]: 1 - ts.saltPct / 100, [m.solute]: ts.saltPct / 100 }, T0 + ts.tempC);
    else if (m.liquid !== undefined) h.addLiquid(region, { [m.liquid]: 1 }, T0 + ts.tempC);
    else h.apply({ op: 'fill', region, phase: 'gas', T: T0 + ts.tempC, composition: { N2: 0.7676, O2: 0.2324 } });
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const h = host();
    if (h === null || !ready) return;
    /* Bei der Wiedergabe und beim Backen gehört das Bild dem Nachweis. */
    if (!live) { setNote(t('clipTools')); return; }
    if (EDIT_TOOLS.includes(tool)) pauseForEdit();
    /* Schmal: das Feld des Werkzeugs weicht, sobald man in die Kiste greift (ein Klick auf das Werkzeug holt es zurück). */
    if (e.currentTarget.clientWidth < 640) setToolOpts(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    const px = local(e);
    const w = h.toWorld(px[0], px[1]);
    const d = { start: w, startPx: px, last: w, at: performance.now(), target: null as string | null };
    drag.current = d;
    if (tool === 'paint' || tool === 'erase') brushAt(w[0], w[1]);
    else if (tool === 'inspect') {
      void h.query(w[0], w[1]).then((q) => {
        setInfo(q);
        h.select(q?.bubble?.id ?? null);
        setSideTab(q?.bubble !== undefined && q?.bubble !== null ? 'bubble' : 'inspect');
      });
      drag.current = null;
    } else if (tool === 'wall' || tool === 'add') {
      setLine([px[0], px[1], px[0], px[1]]);
      /* Ein Klick auf einen Gegenstand wählt ihn, statt einen neuen in ihn zu setzen. */
      if (tool === 'add') void h.query(w[0], w[1]).then((q) => { if ((q?.body?.id ?? '') !== '') d.target = q?.body?.id ?? null; });
    } else if (tool === 'select') {
      /* Den Gegenstand unter dem Zeiger wählen (daneben: keinen); zieht man ihn, rückt er beim Loslassen dorthin. */
      void h.query(w[0], w[1]).then((q) => {
        const id = q?.body?.id ?? '';
        choose(id !== '' ? id : null);
        if (id !== '') d.target = id;
      });
      setLine([px[0], px[1], px[0], px[1]]);
    }
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    const h = host();
    if (d === null || h === null) return;
    const px = local(e);
    const w = h.toWorld(px[0], px[1]);
    if (tool === 'wall' || tool === 'add' || tool === 'select') {
      /* Ein Gegenstand, der wirklich gezogen wird, ändert die Szene: die Rechnung hält an. */
      if (tool === 'select' && d.target !== null && Math.hypot(px[0] - d.startPx[0], px[1] - d.startPx[1]) > 4) pauseForEdit();
      setLine([d.startPx[0], d.startPx[1], px[0], px[1]]);
      return;
    }
    const moved = Math.hypot(w[0] - d.last[0], w[1] - d.last[1]);
    const now = performance.now();
    if (moved < ts.brushMm / 3000 && now - d.at < 60) return;
    d.last = w;
    d.at = now;
    brushAt(w[0], w[1]);
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    const h = host();
    drag.current = null;
    setLine(null);
    if (d === null || h === null) return;
    const px = local(e);
    const [x, y] = h.toWorld(px[0], px[1]);
    const cell = stats?.engine.dx ?? 0.002;
    if (tool === 'wall') {
      if (Math.hypot(x - d.start[0], y - d.start[1]) < cell) return;
      const m = WALL_MATERIALS.find((k) => k.key === ts.wallMaterial) ?? WALL_MATERIALS[0];
      h.addSolid({ line: [d.start[0], d.start[1], x, y], width: Math.max(2 * cell, 0.004) }, m.solid ?? 'glass', T0 + ts.tempC);
    } else if (tool === 'add') {
      /* Ein Klick: übliche Grösse; ein gezogenes Rechteck: Lage und Grösse. Der neue Gegenstand ist gleich gewählt, das Werkzeug wird „Wybierz“. */
      const dragged = Math.abs(x - d.start[0]) >= cell && Math.abs(y - d.start[1]) >= cell;
      if (!dragged && d.target !== null) { choose(d.target); setTool('select'); return; }
      h.apply(newObjectOp(ts.addKind, d.start, [x, y], dragged, opsRef.current));
      setTool('select');
      void refreshOps(h).then((list) => {
        const last = [...list].reverse().find(isObject);
        if (typeof last?.id === 'string') choose(last.id);
      });
    } else if (tool === 'select' && d.target !== null) {
      /* Genau (auf 0,1 mm), nicht unter den Boden. */
      const ov = stats?.object ?? null;
      let floor = 0;
      if (ov !== null && ov.id === d.target) { floor = Infinity; for (let k = 1; k < ov.outline.length; k += 2) floor = Math.min(floor, ov.outline[k]); }
      const dx = Math.round((x - d.start[0]) * 1e4) / 1e4;
      const dy = Math.max(-Math.floor(Math.max(0, floor) * 1e4) / 1e4, Math.round((y - d.start[1]) * 1e4) / 1e4);
      if (Math.hypot(dx, dy) < 0.5 * cell) return;
      h.apply({ op: 'move', region: null, id: d.target, dx, dy });
      window.setTimeout(() => { void refreshOps(h); }, 50);
    }
  };

  /* -- Gegenstände, Szene, Einstellungen ------------------------------------------------------------------- */

  /* „Przypięty“ und die Heizung sofort, der Aufbau nur am Anfang (dann entsteht die Szene neu). */
  const patchObject = (patch: ObjectPatch): void => {
    const h = host();
    if (h === null || selected === null) return;
    void h.editObject(selected, patch).then((r) => {
      if (r?.warning?.startsWith('refused') === true) setNote(t('objAtStart'));
      if (r?.rebuilt === true) { samplesRef.current = []; setSamples([]); }
      void refreshOps(h);
    });
  };
  const removeObject = (): void => {
    const h = host();
    if (h === null || selected === null) return;
    pauseForEdit();
    h.apply({ op: 'remove', id: selected });
    choose(null);
    window.setTimeout(() => { void refreshOps(h); }, 50);
  };
  /* Neu laden beginnt ruhend am Anfang (das Labor startet nie von selbst). */
  const reload = (scene: unknown): void => {
    choose(null);
    setInfo(undefined);
    samplesRef.current = [];
    setSamples([]);
    setPaused(true);
    const h = host();
    h?.pause(true);
    h?.load(withQuality(scene, quality));
    if (h !== null) window.setTimeout(() => { void refreshOps(h); }, 100);
  };
  const restart = (): void => reload(setupRef.current ?? scenario.scene);
  const scenarioStart = (): void => { setupRef.current = null; reload(scenario.scene); setSheet(null); };
  const pickScenario = (i: number): void => {
    const next = scenarios[i];
    if (next === undefined) return;
    setScenarioAt(i);
    scenarioRef.current = i;
    setupRef.current = null;
    reload(next.scene);
  };
  const emptyBox = (): void => { const base = readScene(config.scene).scene; setupRef.current = null; reload(writeScene({ ...base, ops: [] })); setSheet(null); };
  const cycleSpeed = (): void => { const next = (speedAt + 1) % SPEEDS.length; setSpeedAt(next); host()?.setSpeed(SPEEDS[next]); };
  const changeQuality = (q: Quality): void => { setQuality(q); if (!accel) store(QUALITY_KEY, q); lagRef.current = 0; setLagging(null); samplesRef.current = []; setSamples([]); host()?.setQuality(q); };
  const changeLevel = (l: Level): void => { setLevel(l); store(LEVEL_KEY, l); };
  const changeOverlay = (o: Overlay): void => { setOverlay(o); host()?.overlay(o); };
  const changeAmbient = (next: Ambient): void => {
    setAmbientState(next);
    const yO2 = o2Mass(next.o2);
    host()?.setAmbient(next.p * 1000, T0 + next.T, next.rh, next.g * G0, { N2: 1 - yO2, O2: yO2 });
  };
  const changeParticles = (on: boolean): void => { setParticles(on); host()?.particles(on); };
  const answerExtreme = (m: 'compute' | 'normalize'): void => { host()?.setExtremes(m); setExtreme(null); setPaused(false); host()?.pause(false); };
  /*
   * Umschalten zwischen dem normalen und dem beschleunigten Weg: die jetzige Szene (Aufbau samt Handgriffen) geht mit; beschleunigt mit 1 mm.
   * then (B, seit 2026-10-25): aus dem beschleunigten Weg zum Backen oder Abspielen — die Szene behält ihre Auflösung (so findet sich ihr
   * Nachweis), danach öffnet sich das Fenster bzw. spielt der Nachweis von der GPU.
   */
  const toggleAccel = (then: 'bake' | 'play' | null = null): void => {
    const h = host();
    const next = !accel;
    const q: Quality = next ? 'very-high' : savedQuality() ?? readScene(config.scene).scene.quality;
    pendingRef.current = next ? null : then;
    const go = (scene: unknown): void => {
      const own = !next && then !== null ? readScene(scene).scene.quality : q;
      nextScene.current = withQuality(scene, own);
      setupRef.current = null;
      setQuality(own);
      lagRef.current = 0;
      setLagging(null);
      samplesRef.current = [];
      setSamples([]);
      setStats(null);
      setAccel(next);
    };
    if (h === null) { go(config.scene); return; }
    /* Antwortet der Arbeiter nicht (eine hängende Grafikkarte), wechselt der Schalter trotzdem — mit der Szene ohne die Handgriffe. */
    const late = new Promise<null>((resolve) => { window.setTimeout(() => resolve(null), 3000); });
    void Promise.race([h.serialize(), late]).then((s) => go(s ?? config.scene));
  };
  /* Backen beginnt beim Aufbau vom Start (nicht bei der Zeit, die gerade läuft). */
  const startBake = (o: BakeOptions): void => {
    setBakeOpen(false);
    store(BAKE_KEY, JSON.stringify({ fps: o.fps, keyEvery: o.keyEvery, engine: o.engine ?? savedBake().engine }));
    const h = host();
    if (h === null) return;
    lagRef.current = 0;
    setLagging(null);
    setPaused(true);
    h.pause(true);
    if (phase === 'simulate' && setupRef.current !== null) h.load(setupRef.current);
    /* Ohne WebGPU auf dieser Seite backt die CPU ohne Hinweis (die Wahl war nicht zu sehen; gemerkt bleibt sie). */
    h.bake({ ...o, engine: HAS_WEBGPU ? o.engine : 'cpu' });
  };
  /* Szenen als Dateien: Speichern lädt ein JSON herunter (mit dem Samen), Laden liest eins ein. */
  const save = (): void => {
    void host()?.serialize().then((s) => {
      if (s === null) return;
      const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'laboratorium-2d.json';
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNote(t('saved'));
    });
  };
  const loadFile = (file: File): void => {
    void file.text().then((text) => {
      try { setupRef.current = null; reload(JSON.parse(text) as unknown); setSheet(null); } catch (err) { setNote(err instanceof Error ? err.message : String(err)); }
    });
  };

  /* -- Das Feld rechts ------------------------------------------------------------------------------------- */

  const bubble = stats?.bubble ?? null;
  const objectView = stats?.object ?? null;
  const selectedOp = selected === null ? null : ops.find((o) => o.id === selected && isObject(o)) ?? null;
  const tabs: SideTab[] = [];
  if (selectedOp !== null) tabs.push('object');
  if (info !== undefined) tabs.push('inspect');
  if (bubble !== null) tabs.push('bubble');
  if (chartsOn) tabs.push('charts');
  const tab: SideTab | null = sideTab !== null && tabs.includes(sideTab) ? sideTab : tabs[0] ?? null;
  const closeSide = (): void => { choose(null); setInfo(undefined); host()?.select(null); setChartsOn(false); setSideTab(null); };
  const toggleCharts = (): void => { const on = !chartsOn; setChartsOn(on); setSideTab(on ? 'charts' : null); };
  /* Bei der Wiedergabe zeigen die Schreiber den Nachweis bis zum gezeigten Bild. */
  const shownSamples = mode === 'playback' && clip !== null && clipStats !== null ? clip.samples.filter((x) => x.t <= clipStats.t + 1e-9) : samples;

  /* Tastatur: Esc schliesst, was offen ist (dann die eigene Ebene), die Leertaste startet und hält an. Im Einfangen, damit das Fenster der Seite nicht mitschliesst. */
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keyRef.current = (e: KeyboardEvent): void => {
    const el = e.target as HTMLElement | null;
    const typing = el !== null && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    if (e.key === 'Escape') {
      const handled = bakeOpen ? (setBakeOpen(false), true) : sheet !== null ? (setSheet(null), true) : tab !== null ? (closeSide(), true) : false;
      if (handled) { e.stopPropagation(); e.preventDefault(); } else if (onClose !== undefined) { e.preventDefault(); onClose(); }
    } else if (e.key === ' ' && !typing && el?.tagName !== 'BUTTON' && extreme === null && !bakeOpen) { e.preventDefault(); togglePlay(); }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => keyRef.current(e);
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);

  /* -- Zeichnen über der Bühne ------------------------------------------------------------------------------ */

  /* Pfeile der Kräfte an der gewählten Blase (Bildschirmkoordinaten, auf die grösste Kraft normiert). */
  let arrows: { key: string; x1: number; y1: number; x2: number; y2: number; label: string }[] = [];
  const h0 = hostRef.current;
  if (bubble !== null && (bubble.fate === null || bubble.fate === 'merged') && h0 !== null && view !== null) {
    const [bx, by] = h0.toScreen(bubble.x, bubble.y);
    const forces = forcesOf(bubble);
    const big = Math.max(1e-30, ...forces.map((f) => Math.hypot(f.x, f.y)));
    arrows = forces.filter((f) => Math.hypot(f.x, f.y) > 1e-4 * big).map((f) => {
      const len = 70 * Math.sqrt(Math.hypot(f.x, f.y) / big);
      const a = Math.atan2(f.y, f.x);
      return { key: f.key, x1: bx, y1: by, x2: bx + len * Math.cos(a), y2: by - len * Math.sin(a), label: t(f.key) };
    });
  }
  const outline: string[] = [];
  if (objectView !== null && h0 !== null && view !== null && objectView.id === selected) {
    const pts = objectView.outline;
    const moving = line !== null && tool === 'select';
    const sx = moving ? line[2] - line[0] : 0;
    const sy = moving ? line[3] - line[1] : 0;
    for (let k = 0; k + 7 < pts.length; k += 8) {
      const corners: string[] = [];
      for (let c = 0; c < 8; c += 2) { const [px, py] = h0.toScreen(pts[k + c], pts[k + c + 1]); corners.push(`${px + sx},${py + sy}`); }
      outline.push(corners.join(' '));
    }
  }

  const cpuOnly = stats?.engine.cpuOnly ?? false;
  /* Das Fenster des Backens ist offen: die Grafikkarte schon vorbereiten (ihre Kerne übersetzen Sekunden lang; B). */
  useEffect(() => { if (bakeOpen && ready && !accel && HAS_WEBGPU && !cpuOnly) hostRef.current?.bakePrepare(); }, [bakeOpen, ready, accel, cpuOnly]);
  const lower: Quality | undefined = QUALITIES[QUALITIES.indexOf(quality) + 1];
  const cells = (q: Quality): number => {
    const e = stats?.engine;
    const w = e !== undefined ? e.nx * e.dx : 0.2;
    const hh = e !== undefined ? e.ny * e.dx : 0.15;
    return Math.round(w / CELL[q]) * Math.round(hh / CELL[q]);
  };
  const title = (scenarios.length > 1 ? scenario.title : config.title) || t('title');

  return (
    <div className={`l2d-app${tab !== null ? ' has-side' : ''}`}>
      <TopBar title={title} task={scenario.text[0] ?? ''} scenarios={scenarios.map((s) => s.title)} scenarioAt={scenarioAt} onScenario={pickScenario}
        phase={phase} onInfo={() => setSheet(sheet === 'info' ? null : 'info')} onSettings={() => setSheet(sheet === 'settings' ? null : 'settings')} onClose={onClose} />
      <ToolRail tool={tool} onTool={pickTool} locked={running} off={!live} />
      <div className="l2d-stage">
        <div ref={boxRef} className={`l2d-box is-${tool}${mode === 'playback' ? ' is-clip' : ''}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <svg className="l2d-overlay" aria-hidden="true">
            <defs>
              <marker id="l2d-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" className="l2d-arrowhead" /></marker>
            </defs>
            {outline.map((p, k) => <polygon key={k} className="l2d-selected" points={p} />)}
            {line !== null && tool === 'add' && <rect className="l2d-preview l2d-preview-box" x={Math.min(line[0], line[2])} y={Math.min(line[1], line[3])} width={Math.abs(line[2] - line[0])} height={Math.abs(line[3] - line[1])} />}
            {line !== null && tool === 'wall' && <line className="l2d-preview" x1={line[0]} y1={line[1]} x2={line[2]} y2={line[3]} />}
            {arrows.map((a) => (
              <g key={a.key} className={`l2d-force l2d-force-${a.key}`}>
                <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} markerEnd="url(#l2d-head)" />
                <text x={a.x2 + 4} y={a.y2}>{a.label}</text>
              </g>
            ))}
          </svg>
          {hud && stats !== null && <Hud stats={stats} />}
          {overlay !== 'none' && stats !== null && <Legend overlay={overlay} scale={stats.overlayScale} />}
          {note !== null && <div className="l2d-note" role="status">{note}</div>}
          {(!ready || error !== null) && <div className="l2d-status">{error ?? t('loading')}</div>}
        </div>
        {toolOpts && live && <ToolOptions tool={tool} s={ts} onChange={(p) => setTs({ ...ts, ...p })} onClose={() => setToolOpts(false)} />}
        {sheet === 'settings' && (
          <SettingsSheet quality={quality} onQuality={changeQuality} extremes={extremesMode} onExtremes={(m) => host()?.setExtremes(m)}
            accel={accel} accelBlocked={!live ? t('clipAccel') : cpuOnly ? t('accelNoOther') : null} showAccel={HAS_WEBGPU || accel} onAccel={() => toggleAccel()}
            ambient={ambient} onAmbient={changeAmbient} walls={view?.walls ?? null} onSide={(s, wall) => host()?.setBoundary(s, wall ? 'wall' : 'open')}
            particles={particles} particlesBlocked={mode === 'playback'} onParticles={changeParticles} level={level} onLevel={changeLevel} hud={hud} onHud={setHud}
            onSave={save} onLoadFile={loadFile} onEmpty={emptyBox} onScenarioStart={scenarioStart} busy={!live} onClose={() => setSheet(null)} />
        )}
        {sheet === 'info' && <InfoSheet title={title} text={scenario.text} level={level} onClose={() => setSheet(null)} />}
      </div>
      {tab !== null && (
        <SidePanel tabs={tabs} tab={tab} onTab={setSideTab} onClose={closeSide}>
          {tab === 'object' && selectedOp !== null && (
            <ObjectPanel op={selectedOp} view={objectView !== null && objectView.id === selected ? objectView : null} atStart={atStart} onPatch={patchObject} onRemove={removeObject} />
          )}
          {tab === 'inspect' && (info === null || info === undefined ? <p className="lab-muted">{t('nothingHere')}</p> : <Inspector info={info} level={level} />)}
          {tab === 'bubble' && <BubblePanel b={bubble} level={level} />}
          {tab === 'charts' && <Charts samples={shownSamples} level={level} />}
        </SidePanel>
      )}
      {phase === 'baking' && bake !== null ? (
        <footer className="l2d-time is-wide"><BakePanel progress={bake} onStop={() => host()?.stopBake()} /></footer>
      ) : phase === 'clip' && clipStats !== null ? (
        <footer className="l2d-time is-wide">
          <PlayerBar clip={clip} stats={clipStats} speed={playSpeed} onPlay={(p) => host()?.clipPlay(p)} onSeek={(x) => host()?.clipSeek(x)}
            onSpeed={(s) => { setPlaySpeed(s); host()?.setSpeed(s); }} onLoop={(on) => host()?.clipLoop(on)} onLive={() => host()?.clipLive(HAS_WEBGPU)}
            onClose={() => { host()?.clipClose(); setPaused(true); }} onDelete={() => host()?.clipDelete()} onEngine={(e) => host()?.clipEngine(e)} />
        </footer>
      ) : (
        <TimeBar phase={phase} paused={paused} time={time} speed={SPEEDS[speedAt]} onPlay={togglePlay} onStep={() => host()?.step()} onSpeed={cycleSpeed} onRestart={restart}
          overlay={overlay} onOverlay={changeOverlay} chartsOn={chartsOn} onCharts={toggleCharts} canBake={ready} accel={accel} onBake={() => (accel ? toggleAccel('bake') : setBakeOpen(true))}
          clip={clip} onPlayClip={() => (accel ? toggleAccel('play') : host()?.clipOpen(true))} lagging={lagging} onLower={lower !== undefined ? () => changeQuality(lower) : undefined} />
      )}
      {bakeOpen && (
        <BakeDialog initial={{ seconds: secondsRef.current, ...savedBake(), quality, extremes: extremesMode === 'compute' ? 'compute' : 'normalize' }} cells={cells}
          gpu={!HAS_WEBGPU ? 'none' : cpuOnly ? 'cpu-only' : 'yes'} onBake={startBake} onCancel={() => setBakeOpen(false)} />
      )}
      {extreme !== null && <ExtremeDialog event={extreme} onChoose={answerExtreme} />}
    </div>
  );
}
