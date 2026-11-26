/**
 * 2026-11-24 (Eigentümer: „dieselbe Karte in verschiedenen Lagen") — DER KERN DER WELTKARTE: was jede Lage braucht und keine Lage
 * kennt. Das Modell aus der Baza (Eingang → Welt → Linien, auch die Teilwelt `landscape.only`), die Farben der Themen und Linien, die
 * Gestalt (im Worker, gemerkt; Schreibende legen sie ab) und Vollbild/Seite. Was die Karte in einer Lage zeigt und was ein Klick tut,
 * sagen die Modi (`mapMode.ts`, `modes/`); gezeichnet wird mit `WorldPillars`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Card } from '../cardBasics';
import { classWorldInput } from '../classes/subWorld';
import type { Lang } from '../lang';
import { landscapeClient } from '../landscapeClient';
import type { RegionTree } from '../regions';
import type { CogitaLibrary } from '../store';
import type { LandscapeOnly, ViewDoc } from '../views';
import { flowFitsMode, type PlayMode } from '../modes';
import { lineColours, type Rgb } from './wmColors';
import { colourKeys, placeKindsOf, regionGraphOf } from './wmExport';
import { geometryInputOf, type Geometry } from './wmGeometry';
import { geometryFor } from './wmGeometryClient';
import { readWorld } from './wmGraph';
import { worldInputOf } from './wmInput';
import { linesOf } from './wmLines';
import { layoutPass } from './wmStore';
import { worldTags } from './wmTags';
import type { Lines, World, WorldInput } from './wmTypes';

/** Die Farben der Themen: wie im Krajobraz die acht des Bereichs, reihum (hell und dunkel). */
const TOPIC = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
} as const;
const NONE = { light: '#8d8a82', dark: '#6f6b62' } as const;
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Die ganze Welt der Baza (vor jeder Teilwelt) — auch die Wahl einer Klasse braucht sie ganz. */
export function useFullWorld(lib: CogitaLibrary, view: ViewDoc, cards: readonly Card[]): { readonly input: WorldInput; readonly world: World } {
  const placeKinds = useMemo(() => placeKindsOf(view), [view]);
  const input = useMemo(() => worldInputOf(lib, cards, { placeKinds }), [lib, lib.revision, cards, placeKinds]); // eslint-disable-line react-hooks/exhaustive-deps
  const world = useMemo(() => readWorld(input), [input]);
  return { input, world };
}

/**
 * DIE WELT, DIE GEZEIGT WIRD: die Teilwelt (`landscape.only`, etwa die einer Klasse) aus einem beschnittenen Eingang noch einmal —
 * Türme ausserhalb fehlen im Modell, darum führt kein Weg, Ziel, keine Wiederholung und keine Zahl hinaus (`classes/subWorld.ts`).
 * `only` = null: die ganze Welt.
 */
export function useShownWorld(full: { readonly input: WorldInput; readonly world: World }, only: LandscapeOnly | null, mode: PlayMode = 'self'): { readonly input: WorldInput; readonly world: World; readonly lines: Lines } {
  const onlyKey = JSON.stringify(only);
  const input = useMemo(() => classWorldInput(full.input, full.world, worldTags(full.world), only) ?? full.input, [full.input, full.world, onlyKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const world = useMemo(() => (input === full.input ? full.world : readWorld(input)), [full.input, full.world, input]);
  /*
    2026-11-26 — DIE TÜRME SIND GEMEINSAM, DIE PFADE NICHT: dieselbe Welt (dieselben Türme an denselben Orten) — aber die Linien nur
    aus den Erzählungen dieses Modus (`flowFitsMode`), und jede Erzählung so, wie der Modus sie spielt (`linesOf` … mode).
  */
  const lines = useMemo(() => linesOf(world, input.flows.filter((f) => flowFitsMode(f, mode)), { mode }), [world, input, mode]);
  return { input, world, lines };
}

export interface MapLook {
  readonly regions: RegionTree | null;
  readonly keys: ReadonlyMap<string, string>;
  readonly placeColour: (id: string) => Rgb;
  readonly colours: ReturnType<typeof lineColours>;
  readonly geometry: Geometry | null;
  readonly geometryRuns: number;
  /** Die ganze Lage neu (nur Schreibende; Entscheidung 11). */
  readonly relayout: () => void;
}

/** Farben und Gestalt: die Gebiete (im Worker), die Farben reihum, die Lage (im Worker, gemerkt; Schreibende legen sie ab). */
export function useMapLook(lib: CogitaLibrary, view: ViewDoc, world: World, lines: Lines, lang: Lang, dark: boolean, writes: boolean): MapLook {
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
  return { regions, keys, placeColour, colours, geometry, geometryRuns, relayout: () => setRelay((n) => n + 1) };
}

/** Die zwei Arten: der ganze Bildschirm oder die ganze Seite im Browser. */
export type FullMode = 'screen' | 'page';

/**
 * VOLLBILD UND SEITE (2026-11-10, Eigentümer): 'screen' — der ganze Bildschirm (Fullscreen-Schnittstelle), 'page' — die ganze Seite im
 * Fenster des Browsers. Esc tritt eine Stufe zurück: Bildschirm → Seite → aus. Das ganze Dokument geht ins Vollbild, die Karte liegt
 * darüber (fest, über der Seite, unter Dialogen): so bleiben Erzählungen, Fragen und Dialoge sichtbar.
 */
export function useFullScreen(): { readonly full: FullMode | null; readonly enter: (m: FullMode) => void; readonly exit: () => void } {
  const [full, setFull] = useState<FullMode | null>(null);
  const askedFull = useRef(false);
  useEffect(() => {
    /* Der Browser verliess das Vollbild (Esc): eine Stufe zurück — die ganze Seite bleibt. */
    const sync = () => { if (document.fullscreenElement === null && askedFull.current) { askedFull.current = false; setFull((m) => (m === 'screen' ? 'page' : m)); } };
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const enter = (m: FullMode) => {
    if (m === 'page') {
      askedFull.current = false;
      if (document.fullscreenElement !== null) void document.exitFullscreen().catch(() => undefined);
      setFull('page');
      return;
    }
    setFull('screen');
    const root = document.documentElement;
    /* Ohne die Schnittstelle (manche Telefone): das ganze Fenster, ohne den Rest der Seite. */
    if (typeof root.requestFullscreen === 'function') void root.requestFullscreen().then(() => { askedFull.current = true; }, () => undefined);
  };
  const exit = () => {
    askedFull.current = false;
    setFull(null);
    if (document.fullscreenElement !== null) void document.exitFullscreen().catch(() => undefined);
  };
  /* Die ganze Seite: Esc schliesst sie (nicht in einem Feld oder Dialog); die Seite darunter rollt nicht mit. */
  useEffect(() => {
    if (full === null) return undefined;
    const html = document.documentElement;
    html.classList.add('cg-wm-locked');
    const onKey = (e: KeyboardEvent) => {
      if (full !== 'page' || e.key !== 'Escape' || e.defaultPrevented) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el !== null && el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]') !== null) return;
      askedFull.current = false;
      setFull(null);
    };
    window.addEventListener('keydown', onKey);
    return () => { html.classList.remove('cg-wm-locked'); window.removeEventListener('keydown', onKey); };
  }, [full]);
  return { full, enter, exit };
}
