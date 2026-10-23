/**
 * LABOR 2D (v2) — DIE OBERFLÄCHE (React): Rahmen, Werkzeuge, Palette,
 * Inspektor, Blasenansicht, Einblendungen, Schreiber, zwei Stufen, Szenen und
 * das Entwickler-HUD um die Bühne. Die Engine läuft im Arbeiter (host.ts,
 * engine.worker.ts); in React stehen nur Einstellungen und die Kennzahlen, die
 * der Arbeiter fünfmal je Sekunde schickt — nie Feld- oder Teilchendaten.
 *
 * Die Leinwand entsteht im Effekt selbst (nicht im JSX): eine Leinwand lässt
 * sich nur einmal an einen Arbeiter übergeben, und React ruft Effekte im
 * StrictMode zweimal auf.
 *
 * Gegenstände (seit 2026-10-23): „Przedmioty“ fügt Klötze, Eiswürfel, eine
 * Zlewka oder Platte hinzu; „Wybierz“ wählt einen (sein Umriss leuchtet) und
 * verschiebt ihn, das Feld „Przedmiot“ zeigt seine Einstellungen — auch, ob er
 * angeheftet ist (ObjectPanel.tsx).
 *
 * Das Labor startet nie von selbst (B): es zeigt den Anfang und wartet auf
 * „Uruchom na żywo“ oder „Upiecz“ — ausser der Baustein sagt, dass das Backen
 * beim Öffnen beginnt (config.start = 'bake'; ein schon gebackener Nachweis
 * spielt dann gleich ab). Mehrere Szenariusze (config.scenarios) stehen oben
 * an der Seite zur Wahl.
 */

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { Icon, type IconName } from '../../ui/icons';
import { LabFrame, LabSection } from '../LabFrame';
import { BakePanel, ClipSection, PlayerBar, StartPanel, type BakeProgress } from './ClipControls';
import type { ClipInfo } from './clip/clip';
import type { ProbeInfo } from './engine/engine';
import { LIQUIDS } from './engine/materials';
import type { ObjectPatch } from './engine/objects';
import type { ChartSample, HostStats } from './engine/protocol';
import { CELL, QUALITIES, isQuality, readScene, writeScene, type Quality, type SideName } from './engine/scene';
import type { Region } from './engine/shapes';
import { LabHost } from './host';
import { num, t, type TextKey } from './i18n';
import { ObjectPanel } from './ObjectPanel';
import { KindIcon, newObjectOp, OBJECT_KINDS, type ObjectKind } from './objectKinds';
import { About, BubblePanel, Charts, forcesOf, Hud, Inspector, Legend, type Level } from './panels';
import { OVERLAYS, type Overlay } from './render/frame';
import type { Walls } from './render/glRenderer';
import type { View } from './render/view';
import { createGpuWorker, createLabWorker } from './workerFactory';

import './lab2d.css';

/** Ein Szenariusz zur Wahl: Titel, Text für die Schüler, Szene. */
export interface Lab2DScenario {
  readonly title: string;
  readonly text: readonly string[];
  readonly scene: unknown;
}

export interface Lab2DConfig {
  readonly title: string;
  readonly text: readonly string[];
  readonly scene: unknown;
  /** Beim Öffnen: nichts tun (Knöpfe) oder gleich backen ('bake'). */
  readonly start?: 'button' | 'bake';
  /** Länge eines Nachweises beim Backen (s). */
  readonly seconds?: number;
  /** Weitere Szenariusze neben der eigenen Szene. */
  readonly scenarios?: readonly Lab2DScenario[];
}

/** „add“: einen Gegenstand aus „Przedmioty“ hinzufügen (gewählt dort, nicht in der Werkzeugleiste). */
type Tool = 'select' | 'paint' | 'erase' | 'add' | 'wall' | 'inspect';

interface Material {
  readonly key: string;
  readonly label: TextKey;
  readonly solid: string | null;
  /** Eine Flüssigkeit der Datenbank (H2O, oil-rapeseed …): gemalt als Füllung mit dieser Zusammensetzung. */
  readonly liquid?: string;
  /** Ein darin gelöster Stoff (NaCl, M2b) — sein Massenanteil kommt vom Regler „Sól w solance“. */
  readonly solute?: string;
  readonly color: string;
}

const MATERIALS: readonly Material[] = [
  { key: 'water', label: 'matWater', solid: null, liquid: 'H2O', color: '#3d8fd8' },
  { key: 'oil', label: 'matOil', solid: null, liquid: 'oil-rapeseed', color: LIQUIDS[1]?.color ?? '#e3b437' },
  { key: 'brine', label: 'matBrine', solid: null, liquid: 'H2O', solute: 'NaCl', color: '#8dbbe3' },
  { key: 'air', label: 'matAir', solid: null, color: '#e6eef3' },
  { key: 'glass', label: 'matGlass', solid: 'glass', color: '#9cc3d5' },
  { key: 'steel', label: 'matSteel', solid: 'steel', color: '#7d858e' },
  { key: 'chips', label: 'matChips', solid: 'ceramic', color: '#d8ccb4' }
];


const TOOLS: readonly { readonly key: Tool; readonly label: TextKey; readonly icon: IconName; readonly hint: TextKey }[] = [
  { key: 'select', label: 'toolSelect', icon: 'shuffle', hint: 'hintSelect' },
  { key: 'paint', label: 'toolPaint', icon: 'edit', hint: 'hintPaint' },
  { key: 'erase', label: 'toolErase', icon: 'x', hint: 'hintErase' },
  { key: 'wall', label: 'toolWall', icon: 'minus', hint: 'hintWall' },
  { key: 'inspect', label: 'toolInspect', icon: 'search', hint: 'hintInspect' }
];

const OVERLAY_LABEL: Readonly<Record<Overlay, TextKey>> = {
  none: 'ovNone', temperature: 'ovTemperature', pressure: 'ovPressure', velocity: 'ovVelocity', humidity: 'ovHumidity', vapour: 'ovVapour', salt: 'ovSalt', phase: 'ovPhase'
};
const QUALITY_LABEL: Readonly<Record<Quality, TextKey>> = { 'very-high': 'qualityVeryHigh', high: 'qualityHigh', medium: 'qualityMedium' };
const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4, 8, 16];
const T0 = 273.15;
const G0 = 9.80665;
/** Molmassen (kg/mol) für die Umrechnung Volumen- ↔ Massenanteil des Sauerstoffs (IUPAC; wie materials.json). */
const M_N2 = 0.0280134;
const M_O2 = 0.0319988;
const o2Volume = (yO2: number): number => (yO2 / M_O2) / (yO2 / M_O2 + (1 - yO2) / M_N2);
const o2Mass = (xO2: number): number => (xO2 * M_O2) / (xO2 * M_O2 + (1 - xO2) * M_N2);
const PRESSURES: readonly { readonly key: TextKey; readonly kPa: number }[] = [
  { key: 'pSea', kPa: 101.325 }, { key: 'pMountain', kPa: 70 }, { key: 'pCooker', kPa: 200 }
];

/** Die Stufe dieses Geräts (wer einmal eine niedrigere gewählt hat, bekommt sie wieder). */
const QUALITY_KEY = 'recreatio.lab2d.quality';
function savedQuality(): Quality | null {
  try { const v = window.localStorage.getItem(QUALITY_KEY); return isQuality(v) ? v : null; } catch { return null; }
}
function saveQuality(q: Quality): void {
  try { window.localStorage.setItem(QUALITY_KEY, q); } catch { /* ohne Speicher gilt die Wahl nur jetzt */ }
}
const LEVEL_KEY = 'recreatio.lab2d.level';
function savedLevel(): Level {
  try { return window.localStorage.getItem(LEVEL_KEY) === 'secondary' ? 'secondary' : 'primary'; } catch { return 'primary'; }
}
function withQuality(raw: unknown, q: Quality): unknown {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>), quality: q } : { quality: q };
}

/** Kann dieser Browser WebGPU (der beschleunigte Weg)? Ob die Karte mitspielt, sagt erst der Arbeiter. */
const HAS_WEBGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;

function Swatch({ color }: { color: string }) {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill={color} stroke="currentColor" strokeOpacity="0.35" /></svg>;
}

export function Lab2D({ config, whole = false, createWorker = createLabWorker, createAccelWorker = createGpuWorker }: {
  config: Lab2DConfig;
  whole?: boolean;
  createWorker?: () => Worker;
  /** Der Arbeiter des beschleunigten Wegs (WebGPU). */
  createAccelWorker?: () => Worker;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<LabHost | null>(null);
  const drag = useRef<{ start: [number, number]; startPx: [number, number]; last: [number, number]; at: number; target: string | null } | null>(null);
  const samplesRef = useRef<ChartSample[]>([]);
  const opsRef = useRef<Record<string, unknown>[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [stats, setStats] = useState<HostStats | null>(null);
  const [samples, setSamples] = useState<readonly ChartSample[]>([]);
  const [paused, setPaused] = useState(true);
  const [speedAt, setSpeedAt] = useState(3);
  const [hud, setHud] = useState(false);
  const [tool, setTool] = useState<Tool>('paint');
  const [material, setMaterial] = useState('water');
  /* Gegenstände: welcher hinzugefügt wird, welcher gewählt ist (sein Name), die Handgriffe der Szene (für sein Feld). */
  const [addKind, setAddKind] = useState<ObjectKind>('ice');
  const [selected, setSelected] = useState<string | null>(null);
  const [ops, setOps] = useState<readonly Record<string, unknown>[]>([]);
  const [brushMm, setBrushMm] = useState(8);
  const [tempC, setTempC] = useState(20);
  /* Massenanteil des Salzes in gemalter Solanka (%). */
  const [saltPct, setSaltPct] = useState(10);
  const [quality, setQuality] = useState<Quality>(() => savedQuality() ?? readScene(config.scene).scene.quality);
  const [level, setLevel] = useState<Level>(savedLevel);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [info, setInfo] = useState<ProbeInfo | null | undefined>(undefined);
  const [line, setLine] = useState<readonly [number, number, number, number] | null>(null);
  const [lagging, setLagging] = useState<number | null>(null);
  const [view, setView] = useState<{ view: View; walls: Walls } | null>(null);
  const [ambient, setAmbientState] = useState(() => { const a = readScene(config.scene).scene.ambient; return { p: a.p / 1000, T: a.T - T0, rh: a.rh, g: a.g / G0, o2: o2Volume(a.air.O2) }; });
  const [particles, setParticles] = useState(false);
  /* Der beschleunigte Weg (WebGPU): ein anderer Arbeiter; die Szene wandert beim Umschalten mit (nextScene). */
  const [accel, setAccel] = useState(false);
  const nextScene = useRef<unknown>(null);
  /* Nachweise (B): der der jetzigen Szene, der Fortschritt beim Backen, die gewählte Länge; das gewählte Szenariusz. */
  const [clip, setClip] = useState<ClipInfo | null>(null);
  const [bake, setBake] = useState<BakeProgress | null>(null);
  const [seconds, setSeconds] = useState(() => (config.seconds !== undefined && config.seconds > 0 ? config.seconds : 30));
  const [playSpeed, setPlaySpeed] = useState(1);
  const [scenarioAt, setScenarioAt] = useState(0);
  const scenarios = useMemo(() => [{ title: config.title, text: config.text, scene: config.scene }, ...(config.scenarios ?? [])], [config.title, config.text, config.scene, config.scenarios]);
  const scenario = scenarios[Math.min(scenarioAt, scenarios.length - 1)] ?? scenarios[0];
  /* Für die Ereignisse des Arbeiters (ohne veraltete Werte): Startart, Länge, Szenariusz, für welches schon von selbst begonnen wurde, Nachweis. */
  const startRef = useRef(config.start);
  startRef.current = config.start;
  const secondsRef = useRef(seconds);
  secondsRef.current = seconds;
  const scenarioRef = useRef(0);
  const autoRef = useRef(-1);
  const clipRef = useRef<ClipInfo | null>(null);
  clipRef.current = clip;
  const qualityRef = useRef(quality);
  qualityRef.current = quality;
  const speedRef = useRef(SPEEDS[speedAt]);
  speedRef.current = SPEEDS[speedAt];
  /* Ein neu gestarteter Arbeiter (anderer Weg, neue Szene) bekommt die Einstellungen der Oberfläche: sonst rechnete er,
     während die Leiste „Pause“ zeigt, und zeichnete ohne die gewählte Einblendung. */
  const settingsRef = useRef({ paused, overlay, particles });
  settingsRef.current = { paused, overlay, particles };
  const lagRef = useRef(0);

  const refreshOps = (h: LabHost): Promise<readonly Record<string, unknown>[]> => h.serialize().then((s) => {
    const list = Array.isArray(s?.ops) ? (s?.ops as Record<string, unknown>[]) : [];
    opsRef.current = list;
    setOps(list);
    return list;
  });
  /** Einen Gegenstand wählen (null: keinen) — sein Umriss und sein Feld kommen mit den Kennzahlen. */
  const choose = (id: string | null): void => { setSelected(id); hostRef.current?.selectObject(id); };

  useEffect(() => {
    const box = boxRef.current;
    if (box === null) return undefined;
    const canvas = document.createElement('canvas');
    canvas.className = 'l2d-canvas';
    box.prepend(canvas);
    setError(null);
    samplesRef.current = [];
    const dark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
    const onStats = (s: HostStats): void => {
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
    };
    const startScene = nextScene.current ?? withQuality(config.scene, qualityRef.current);
    nextScene.current = null;
    const host = new LabHost(canvas, accel ? createAccelWorker : createWorker, {
      onReady: () => {
        setReady(true);
        void refreshOps(host);
        const s = settingsRef.current;
        if (speedRef.current !== 1) host.setSpeed(speedRef.current);
        if (s.overlay !== 'none') host.overlay(s.overlay);
        if (s.particles) host.particles(true);
        if (s.paused) host.pause(true);
      },
      onStats,
      onView: (v, w) => setView({ view: v, walls: w }),
      onRefused: () => setNote(t('refused')),
      onError: setError,
      onClip: (info) => {
        setClip(info);
        /* Der Baustein will, dass beim Öffnen gebacken wird: einmal je Szenariusz — ein schon gebackener Nachweis spielt gleich ab. */
        if (startRef.current === 'bake' && autoRef.current !== scenarioRef.current) {
          autoRef.current = scenarioRef.current;
          if (info !== null) host.clipOpen(true); else host.bake(secondsRef.current);
        }
      },
      onBake: (m) => {
        setBake(m.state === 'done' || m.state === 'failed' ? null : { state: m.state, t: m.t, seconds: m.seconds, rate: m.rate, message: m.message });
        if (m.state === 'failed') setNote(m.message === 'engine' ? t('clipEngine') : m.message === 'short' ? t('bakeShort') : `${t('bakeFailed')}${m.message ? ` (${m.message})` : ''}`);
      },
      onLive: (time) => {
        setBake(null);
        setPaused(true);
        const kept = (clipRef.current?.samples ?? []).filter((x) => x.t <= time + 1e-9);
        samplesRef.current = [...kept];
        setSamples([...kept]);
      },
      onGpu: (ok, _adapter, message, scene) => {
        if (ok) return;
        /* WebGPU fehlt, die Karte gibt auf oder die Szene enthält, was der beschleunigte Weg noch nicht kann (Öl): zurück zur CPU — mit der Szene, die er zurückgibt (samt Handgriffen), sonst der vom Start. */
        const q = savedQuality() ?? readScene(config.scene).scene.quality;
        nextScene.current = withQuality(scene ?? startScene, q);
        setQuality(q);
        setNote(message === 'other-liquid' ? t('accelNoOther') : `${t('accelFailed')}${message ? ` (${message})` : ''}`);
        setAccel(false);
      }
    });
    hostRef.current = host;
    const r = box.getBoundingClientRect();
    void host.start(startScene, r.width, r.height, window.devicePixelRatio || 1, dark, settingsRef.current.paused);
    const ro = new ResizeObserver(() => {
      const q = box.getBoundingClientRect();
      host.resize(q.width, q.height, window.devicePixelRatio || 1);
    });
    ro.observe(box);
    return () => {
      ro.disconnect();
      host.dispose();
      canvas.remove();
      hostRef.current = null;
      setReady(false);
    };
  }, [config.scene, createWorker, createAccelWorker, accel]);

  useEffect(() => {
    if (note === null) return undefined;
    const id = window.setTimeout(() => setNote(null), 5000);
    return () => window.clearTimeout(id);
  }, [note]);

  const host = (): LabHost | null => hostRef.current;
  const local = (e: ReactPointerEvent<HTMLDivElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const brushAt = (x: number, y: number): void => {
    const h = host();
    if (h === null) return;
    const region: Region = { circle: [x, y, brushMm / 1000] };
    if (tool === 'erase') { h.apply({ op: 'erase', region }); return; }
    const m = MATERIALS.find((k) => k.key === material) ?? MATERIALS[0];
    if (m.solid !== null) h.addSolid(region, m.solid, T0 + tempC);
    else if (m.liquid !== undefined && m.solute !== undefined) h.addLiquid(region, { [m.liquid]: 1 - saltPct / 100, [m.solute]: saltPct / 100 }, T0 + tempC);
    else if (m.liquid !== undefined) h.addLiquid(region, { [m.liquid]: 1 }, T0 + tempC);
    else h.apply({ op: 'fill', region, phase: 'gas', T: T0 + tempC, composition: { N2: 0.7676, O2: 0.2324 } });
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const h = host();
    if (h === null || !ready) return;
    /* Bei der Wiedergabe und beim Backen gehört das Bild dem Nachweis. */
    if (mode !== 'live' || bake !== null) { setNote(t('clipTools')); return; }
    e.currentTarget.setPointerCapture(e.pointerId);
    const px = local(e);
    const w = h.toWorld(px[0], px[1]);
    const d = { start: w, startPx: px, last: w, at: performance.now(), target: null as string | null };
    drag.current = d;
    if (tool === 'paint' || tool === 'erase') brushAt(w[0], w[1]);
    else if (tool === 'inspect') {
      void h.query(w[0], w[1]).then((q) => { setInfo(q); h.select(q?.bubble?.id ?? null); });
      drag.current = null;
    } else if (tool === 'wall' || tool === 'add') {
      setLine([px[0], px[1], px[0], px[1]]);
      /* Ein Klick auf einen Gegenstand wählt ihn, statt einen neuen in ihn zu setzen. */
      if (tool === 'add') void h.query(w[0], w[1]).then((q) => { if ((q?.body?.id ?? '') !== '') d.target = q?.body?.id ?? null; });
    }
    else if (tool === 'select') {
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
    if (tool === 'wall' || tool === 'add' || tool === 'select') { setLine([d.startPx[0], d.startPx[1], px[0], px[1]]); return; }
    const moved = Math.hypot(w[0] - d.last[0], w[1] - d.last[1]);
    const now = performance.now();
    if (moved < brushMm / 3000 && now - d.at < 60) return;
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
      const m = MATERIALS.find((k) => k.key === material);
      h.addSolid({ line: [d.start[0], d.start[1], x, y], width: Math.max(2 * cell, 0.004) }, m?.solid ?? 'glass', T0 + tempC);
    } else if (tool === 'add') {
      /* Ein Klick: übliche Grösse; ein gezogenes Rechteck: Lage und Grösse. Der neue Gegenstand ist gleich gewählt (unter dem Namen, den ihm die Engine gab). */
      const dragged = Math.abs(x - d.start[0]) >= cell && Math.abs(y - d.start[1]) >= cell;
      if (!dragged && d.target !== null) { choose(d.target); return; }
      h.apply(newObjectOp(addKind, d.start, [x, y], dragged, opsRef.current));
      void refreshOps(h).then((list) => {
        const last = [...list].reverse().find((o) => o.op === 'body' || o.op === 'beaker' || o.op === 'hotplate');
        if (typeof last?.id === 'string') choose(last.id);
      });
    } else if (tool === 'select' && d.target !== null) {
      /* Genau (auf 0,1 mm), nicht unter den Boden; liegt ein gemalter Bau im Umriss (Siedesteinchen in der Zlewka), rundet die Engine auf ganze Zellen. */
      const view = stats?.object ?? null;
      let floor = 0;
      if (view !== null && view.id === d.target) { floor = Infinity; for (let k = 1; k < view.outline.length; k += 2) floor = Math.min(floor, view.outline[k]); }
      const dx = Math.round((x - d.start[0]) * 1e4) / 1e4;
      const dy = Math.max(-Math.floor(Math.max(0, floor) * 1e4) / 1e4, Math.round((y - d.start[1]) * 1e4) / 1e4);
      if (Math.hypot(dx, dy) < 0.5 * cell) return;
      h.apply({ op: 'move', region: null, id: d.target, dx, dy });
      window.setTimeout(() => { void refreshOps(h); }, 50);
    }
  };

  /* Einstellungen des gewählten Gegenstands: „Przypięty“ und die Heizung sofort, der Aufbau nur am Anfang (dann entsteht die Szene neu). */
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
    h.apply({ op: 'remove', id: selected });
    choose(null);
    window.setTimeout(() => { void refreshOps(h); }, 50);
  };

  const togglePause = (): void => { const next = !paused; setPaused(next); host()?.pause(next); };
  const cycleSpeed = (): void => { const next = (speedAt + 1) % SPEEDS.length; setSpeedAt(next); host()?.setSpeed(SPEEDS[next]); };
  const changeQuality = (q: Quality): void => { setQuality(q); if (!accel) saveQuality(q); lagRef.current = 0; setLagging(null); samplesRef.current = []; setSamples([]); host()?.setQuality(q); };
  /* Umschalten zwischen dem normalen und dem beschleunigten Weg: die jetzige Szene (Aufbau samt Handgriffen) geht mit; beschleunigt mit 1 mm. */
  const toggleAccel = (): void => {
    const h = host();
    const next = !accel;
    const q: Quality = next ? 'very-high' : savedQuality() ?? readScene(config.scene).scene.quality;
    const go = (scene: unknown): void => {
      nextScene.current = withQuality(scene, q);
      setQuality(q);
      lagRef.current = 0;
      setLagging(null);
      samplesRef.current = [];
      setSamples([]);
      setStats(null);
      setAccel(next);
    };
    if (h === null) { go(config.scene); return; }
    /* Antwortet der Arbeiter nicht (eine hängende Grafikkarte), wechselt der Knopf trotzdem — mit der Szene ohne die Handgriffe. */
    const late = new Promise<null>((resolve) => { window.setTimeout(() => resolve(null), 3000); });
    void Promise.race([h.serialize(), late]).then((s) => go(s ?? config.scene));
  };
  const changeLevel = (l: Level): void => { setLevel(l); try { window.localStorage.setItem(LEVEL_KEY, l); } catch { /* nur jetzt */ } };
  const changeOverlay = (o: Overlay): void => { setOverlay(o); host()?.overlay(o); };
  const changeAmbient = (next: { p: number; T: number; rh: number; g: number; o2: number }): void => {
    setAmbientState(next);
    const yO2 = o2Mass(next.o2);
    host()?.setAmbient(next.p * 1000, T0 + next.T, next.rh, next.g * G0, { N2: 1 - yO2, O2: yO2 });
  };
  const changeParticles = (on: boolean): void => { setParticles(on); host()?.particles(on); };
  /* Neu laden beginnt ruhend am Anfang (das Labor startet nie von selbst). */
  const reload = (scene: unknown): void => {
    choose(null);
    samplesRef.current = [];
    setSamples([]);
    setPaused(true);
    const h = host();
    h?.pause(true);
    h?.load(withQuality(scene, quality));
    if (h !== null) window.setTimeout(() => { void refreshOps(h); }, 100);
  };
  const pickScenario = (i: number): void => {
    const next = scenarios[i];
    if (next === undefined) return;
    setScenarioAt(i);
    scenarioRef.current = i;
    setInfo(undefined);
    reload(next.scene);
  };
  /* Nachweise. */
  const startBake = (): void => { lagRef.current = 0; setLagging(null); host()?.bake(seconds); };
  const playClip = (): void => host()?.clipOpen(true);
  const goLive = (): void => host()?.clipLive();
  const changePlaySpeed = (s: number): void => { setPlaySpeed(s); host()?.setSpeed(s); };
  const emptyBox = (): void => { const base = readScene(config.scene).scene; reload(writeScene({ ...base, ops: [] })); };
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
  const fileRef = useRef<HTMLInputElement | null>(null);
  const load = (): void => fileRef.current?.click();
  const loadFile = (file: File | undefined): void => {
    if (file === undefined) return;
    void file.text().then((text) => {
      try { reload(JSON.parse(text) as unknown); } catch (err) { setNote(err instanceof Error ? err.message : String(err)); }
    });
  };

  const speed = SPEEDS[speedAt];
  const clipStats = stats?.clip ?? null;
  const mode = clipStats?.mode ?? 'live';
  const busy = mode !== 'live' || bake !== null;
  const showStart = ready && error === null && !busy && paused && (stats?.engine.time ?? 0) === 0;
  /* Bei der Wiedergabe zeigen die Schreiber den Nachweis bis zum gezeigten Bild. */
  const shownSamples = mode === 'playback' && clip !== null && clipStats !== null ? clip.samples.filter((x) => x.t <= clipStats.t + 1e-9) : samples;
  /* Andere Flüssigkeiten (Öl) und Salz kennt der beschleunigte Weg noch nicht: dann bleibt der normale Weg. */
  const otherLiquid = (stats?.engine.otherMass ?? 0) > 0 || (stats?.engine.saltMass ?? 0) > 0 || (stats?.engine.saltSolid ?? 0) > 0;
  const hint: TextKey = tool === 'add' ? 'hintAdd' : TOOLS.find((k) => k.key === tool)?.hint ?? 'hintPaint';
  const lower: Quality | undefined = QUALITIES[QUALITIES.indexOf(quality) + 1];
  const heaters = stats?.engine.heaters ?? [];
  const bubble = stats?.bubble ?? null;
  const objectView = stats?.object ?? null;
  const selectedOp = selected === null ? null : ops.find((o) => o.id === selected && (o.op === 'body' || o.op === 'beaker' || o.op === 'hotplate')) ?? null;
  const atStart = mode === 'live' && bake === null && (stats?.engine.time ?? 0) === 0;

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

  const bar = (
    <>
      {mode === 'live' && (
        <>
          <button type="button" className={`lab-tool${paused ? '' : ' is-on'}`} disabled={bake !== null} onClick={togglePause} title={paused ? t('play') : t('pause')} aria-label={paused ? t('play') : t('pause')}>
            <Icon name={paused ? 'play' : 'pause'} />
          </button>
          <button type="button" className="lab-tool" disabled={!paused || bake !== null} onClick={() => host()?.step()} title={t('step')} aria-label={t('step')}><Icon name="next" /></button>
          <button type="button" className="lab-tool" onClick={cycleSpeed} title={t('speed')} aria-label={`${t('speed')} ${speed}×`}>{num(speed, speed < 1 ? 2 : 0)}×</button>
          {!accel && <button type="button" className="lab-tool" disabled={bake !== null} onClick={startBake} title={t('bakeTitle')}><Icon name="clock" />{t('bake')}</button>}
        </>
      )}
      <button type="button" className={`lab-tool${hud ? ' is-on' : ''}`} onClick={() => setHud(!hud)} title={t('hud')} aria-label={t('hud')}>HUD</button>
      {(HAS_WEBGPU || accel) && (
        <button type="button" className={`lab-tool${accel ? ' is-on' : ''}`} onClick={toggleAccel} disabled={busy || (!accel && otherLiquid)} title={busy ? t('clipAccel') : accel ? t('accelClose') : otherLiquid ? t('accelNoOther') : t('accelTitle')} aria-pressed={accel}>
          <Icon name="bolt" />{accel ? t('accelClose') : t('accelOpen')}
        </button>
      )}
    </>
  );

  const stage = (
    <div ref={boxRef} className={`l2d-box${mode === 'playback' ? ' is-clip' : ''}${bake !== null ? ' is-baking' : ''}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
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
      {showStart && (
        <StartPanel clip={accel ? null : clip} seconds={seconds} onSeconds={setSeconds} canBake={!accel}
          onLive={togglePause} onBake={startBake} onPlay={playClip} />
      )}
      {bake !== null && <BakePanel progress={bake} onStop={() => host()?.stopBake()} />}
      {mode === 'playback' && clipStats !== null && bake === null && (
        <PlayerBar clip={clip} stats={clipStats} speed={playSpeed} onPlay={(p) => host()?.clipPlay(p)} onSeek={(x) => host()?.clipSeek(x)}
          onSpeed={changePlaySpeed} onLoop={(on) => host()?.clipLoop(on)} onLive={goLive} onClose={() => { host()?.clipClose(); setPaused(true); }} />
      )}
    </div>
  );

  const side = (
    <div className="lab-side-in">
      {scenarios.length > 1 && (
        <label className="lab-field">{t('scenario')}
          <select value={scenarioAt} disabled={bake !== null} onChange={(e) => pickScenario(Number(e.currentTarget.value))}>
            {scenarios.map((x, k) => <option key={k} value={k}>{x.title || `${t('scenario')} ${k + 1}`}</option>)}
          </select>
        </label>
      )}
      {scenario.text.map((p, k) => <p key={k} className="lab-text">{p}</p>)}
      {lagging !== null && (
        <div className="l2d-slow" role="status">
          <p>{t('slow').replace('{x}', num(lagging, 2))}</p>
          {lower !== undefined
            ? <button type="button" className="lab-tool" onClick={() => changeQuality(lower)}>{t('slowLower')}: {t(QUALITY_LABEL[lower])}</button>
            : <p className="lab-muted">{t('slowLowest')}</p>}
        </div>
      )}
      <LabSection title={t('tools')}>
        <div className="lab-palette">
          {TOOLS.map((k) => (
            <button key={k.key} type="button" className={`lab-item${tool === k.key ? ' is-on' : ''}`} onClick={() => setTool(k.key)}><Icon name={k.icon} />{t(k.label)}</button>
          ))}
        </div>
        <p className="lab-muted">{t(hint)}</p>
      </LabSection>
      {selectedOp !== null && (
        <LabSection title={t('objSection')}>
          <ObjectPanel op={selectedOp} view={objectView !== null && objectView.id === selected ? objectView : null} atStart={atStart} onPatch={patchObject} onRemove={removeObject} />
        </LabSection>
      )}
      <LabSection title={t('objects')}>
        <div className="lab-palette">
          {OBJECT_KINDS.map((k) => (
            <button key={k.key} type="button" className={`lab-item${tool === 'add' && addKind === k.key ? ' is-on' : ''}`} onClick={() => { setAddKind(k.key); setTool('add'); }}>
              <KindIcon kind={k.key} />{t(k.label)}
            </button>
          ))}
        </div>
      </LabSection>
      <LabSection title={t('materials')}>
        <div className="lab-palette">
          {MATERIALS.map((m) => (
            <button key={m.key} type="button" className={`lab-item${material === m.key ? ' is-on' : ''}`} onClick={() => { setMaterial(m.key); if (tool !== 'paint' && tool !== 'wall') setTool('paint'); }}>
              <Swatch color={m.color} />{t(m.label)}
            </button>
          ))}
        </div>
        <label className="lab-field">{t('brush')}: {brushMm} mm
          <input type="range" min={2} max={30} step={1} value={brushMm} onChange={(e) => setBrushMm(Number(e.currentTarget.value))} />
        </label>
        {material === 'brine' && (
          <label className="lab-field">{t('saltConc')}: {saltPct} %
            <input type="range" min={1} max={26} step={1} value={saltPct} onChange={(e) => setSaltPct(Number(e.currentTarget.value))} />
          </label>
        )}
        <label className="lab-field">{t('paintTemp')}: {tempC} °C
          <input type="range" min={0} max={200} step={1} value={tempC} onChange={(e) => setTempC(Number(e.currentTarget.value))} />
        </label>
      </LabSection>
      <LabSection title={t('heater')}>
        {heaters.length === 0 && <p className="lab-muted">{t('heaterNone')}</p>}
        {heaters.map((h) => (
          <div key={h.group} className="lab-section-body">
            <label className="lab-row"><input type="checkbox" checked={h.on} onChange={(e) => host()?.setHeater(h.group, h.mode, h.power, h.target, e.currentTarget.checked)} />{t('heaterOn')} · {num(h.Tmean - T0, 0)} °C · {num(h.P, 1)} W</label>
            <label className="lab-field">{t('heaterMode')}
              <select value={h.mode} onChange={(e) => host()?.setHeater(h.group, e.currentTarget.value === 'thermostat' ? 'thermostat' : 'power', h.power, h.target, h.on)}>
                <option value="power">{t('modePower')}</option>
                <option value="thermostat">{t('modeThermostat')}</option>
              </select>
            </label>
            <label className="lab-field">{t('heaterPower')}: {num(h.power, 0)} W
              <input type="range" min={0} max={150} step={1} value={h.power} onChange={(e) => host()?.setHeater(h.group, h.mode, Number(e.currentTarget.value), h.target, h.on)} />
            </label>
            {h.mode === 'thermostat' && (
              <label className="lab-field">{t('heaterTarget')}: {num(h.target - T0, 0)} °C
                <input type="range" min={30} max={400} step={1} value={Math.round(h.target - T0)} onChange={(e) => host()?.setHeater(h.group, h.mode, h.power, T0 + Number(e.currentTarget.value), h.on)} />
              </label>
            )}
          </div>
        ))}
      </LabSection>
      <LabSection title={t('view')}>
        {accel && <p className="lab-muted">{t('accelNote')}</p>}
        <label className="lab-field">{t('overlay')}
          <select value={overlay} onChange={(e) => changeOverlay(e.currentTarget.value as Overlay)}>
            {OVERLAYS.map((o) => <option key={o} value={o}>{t(OVERLAY_LABEL[o])}</option>)}
          </select>
        </label>
        <p className="lab-muted">{t('vapourNote')}</p>
        <label className="lab-row" title={mode === 'playback' ? t('clipParticles') : undefined}><input type="checkbox" checked={particles} disabled={mode === 'playback'} onChange={(e) => changeParticles(e.currentTarget.checked)} />{t('showParticles')}</label>
        <label className="lab-field">{t('level')}
          <select value={level} onChange={(e) => changeLevel(e.currentTarget.value === 'secondary' ? 'secondary' : 'primary')}>
            <option value="primary">{t('levelPrimary')}</option>
            <option value="secondary">{t('levelSecondary')}</option>
          </select>
        </label>
        <label className="lab-field">{t('quality')}
          <select value={quality} onChange={(e) => changeQuality(e.currentTarget.value as Quality)}>
            {QUALITIES.map((q) => <option key={q} value={q}>{t(QUALITY_LABEL[q])}</option>)}
          </select>
        </label>
      </LabSection>
      <LabSection title={t('room')} open={false}>
        <div className="lab-row">
          {PRESSURES.map((p) => (
            <button key={p.key} type="button" className={`lab-tool${Math.abs(ambient.p - p.kPa) < 0.5 ? ' is-on' : ''}`} onClick={() => changeAmbient({ ...ambient, p: p.kPa })}>{t(p.key)}</button>
          ))}
        </div>
        <label className="lab-field">{t('pressure')}: {num(ambient.p, 1)} kPa
          <input type="range" min={50} max={250} step={0.5} value={ambient.p} onChange={(e) => changeAmbient({ ...ambient, p: Number(e.currentTarget.value) })} />
        </label>
        <label className="lab-field">{t('roomTemp')}: {num(ambient.T, 0)} °C
          <input type="range" min={0} max={40} step={1} value={ambient.T} onChange={(e) => changeAmbient({ ...ambient, T: Number(e.currentTarget.value) })} />
        </label>
        <label className="lab-field">{t('humidity')}: {num(100 * ambient.rh, 0)} %
          <input type="range" min={0} max={1} step={0.05} value={ambient.rh} onChange={(e) => changeAmbient({ ...ambient, rh: Number(e.currentTarget.value) })} />
        </label>
        <label className="lab-field">{t('oxygen')}: {num(100 * ambient.o2, 0)} %
          <input type="range" min={0} max={0.5} step={0.01} value={ambient.o2} onChange={(e) => changeAmbient({ ...ambient, o2: Number(e.currentTarget.value) })} />
        </label>
        <p className="lab-muted">{t('oxygenNote')}</p>
        <label className="lab-field">{t('gravity')}: {num(ambient.g, 2)} g
          <input type="range" min={0.25} max={2} step={0.05} value={ambient.g} onChange={(e) => changeAmbient({ ...ambient, g: Number(e.currentTarget.value) })} />
        </label>
        <div className="lab-field">{t('sides')}
          <div className="lab-row">
            {(['left', 'right', 'bottom', 'top'] as const).map((s: SideName) => {
              const wall = view === null ? s !== 'top' : view.walls[s];
              return (
                <button key={s} type="button" className={`lab-tool${wall ? ' is-on' : ''}`} onClick={() => host()?.setBoundary(s, wall ? 'open' : 'wall')}>
                  {t(s === 'left' ? 'sideLeft' : s === 'right' ? 'sideRight' : s === 'bottom' ? 'sideBottom' : 'sideTop')}: {t(wall ? 'sideWall' : 'sideOpen')}
                </button>
              );
            })}
          </div>
        </div>
      </LabSection>
      {tool === 'inspect' && info !== undefined && (
        <LabSection title={t('inspect')}>
          {info === null ? <p className="lab-muted">{t('nothingHere')}</p> : <Inspector info={info} level={level} />}
        </LabSection>
      )}
      <LabSection title={t('bubble')} open={bubble !== null}>
        <BubblePanel b={bubble} level={level} />
      </LabSection>
      <ClipSection clip={clip} seconds={seconds} onSeconds={setSeconds} onBake={startBake} onPlay={playClip} onDelete={() => host()?.clipDelete()} busy={bake !== null} accel={accel} />
      <LabSection title={t('charts')} open={false}>
        <Charts samples={shownSamples} level={level} />
      </LabSection>
      <LabSection title={t('scene')} open={false}>
        <div className="lab-row">
          <button type="button" className="lab-tool" disabled={bake !== null} onClick={() => reload(scenario.scene)}><Icon name="refresh" />{t('restart')}</button>
          <button type="button" className="lab-tool" onClick={emptyBox}><Icon name="trash" />{t('emptyBox')}</button>
          <button type="button" className="lab-tool" onClick={save}><Icon name="download" />{t('save')}</button>
          <button type="button" className="lab-tool" onClick={load}><Icon name="upload" />{t('loadScene')}</button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="l2d-file" onChange={(e) => { loadFile(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} />
        </div>
        <p className="lab-muted">Δx = {num((CELL[quality] ?? 0.002) * 1000, 0)} mm</p>
      </LabSection>
      <details className="lab-section">
        <summary>{t('about')}</summary>
        <About level={level} />
      </details>
    </div>
  );

  return <LabFrame title={(scenarios.length > 1 ? scenario.title : config.title) || t('title')} bar={bar} stage={stage} side={side} whole={whole} />;
}
