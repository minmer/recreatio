/**
 * 2026-11-03 (F), neu 2026-11-04 — DIE ŚCIEŻKA ALS KARTE (`pathLayout.ts` rechnet, `storyPath.ts` liefert die Teile einer
 * Erzählung): immer von unten (Anfang) nach oben (Ende), wie ein Berg — Durchgangenes unten, Gesperrtes oben.
 * <code>
 *   ganz im Bild   die Karte passt in den Rahmen (verkleinert); „+" / „−" / „Dopasuj" und Ziehen für Einzelheiten,
 *                  „Pełny ekran", wenn sie sehr hoch ist; nichts wird abgeschnitten
 *   jetzt dran     grösser, kräftig umrandet, daneben sein Name — der einzige Name auf der Karte
 *   Art            ein Zeichen im Sechseck: Lesen, Fragen, beides, Przegląd; Gabeln als Raute, Anfang und Ende als Kreis
 *   Stand          durch (satt), frei (hell, umrandet), gesperrt (blass, gestrichelt), zu wiederholen (Punkt)
 *   Gabel          ihr Zähler in Worten („wybierz 1 z 3", „ukończono 2 z 3 ścieżek"); der gewählte Weg hervorgehoben
 *   Namen          beim Zeigen oder Tippen (Fenster: Name, was darin ist, Stand); ein zweites Tippen öffnet ihn
 *   Legende        jedes Zeichen, das auf dieser Karte vorkommt — nichts sonst
 * </code>
 * Ein Baustein für überall: neben einer Erzählung (klein, zusammenklappbar), in Nauka → Ścieżka, als Baustein „Ścieżka"
 * und im Krajobraz.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

import { words as wordsIn, type Words } from './lang';
import type { PartKind, PathMarks, PathModel, PathState } from './pathLayout';
import './pathMap.css';

export interface PathMapProps {
  readonly model: PathModel;
  readonly marks: PathMarks;
  /** Eine Spur hervorheben (die Möglichkeit einer Wahl der Erzählung, über der der Zeiger steht). */
  readonly highlight?: ReadonlySet<string> | null;
  /** Was ein Knoten im Fenster über ihm anbietet (lernen, in der Erzählung dorthin). */
  readonly actions?: (id: string, state: PathState) => ReactNode;
  /** Ein zweites Tippen auf denselben Knoten öffnet ihn (in der Erzählung: dorthin). */
  readonly onPick?: (id: string) => void;
  /** Wie ein Name aussieht (mit Wzory) — sonst der Name des Modells. */
  readonly name?: (id: string) => ReactNode;
  /** Ein Satz mehr im Fenster (z. B. „3 z 8 kart"). */
  readonly detail?: (id: string) => string | null;
  readonly size?: 'small' | 'full';
  readonly title?: string;
  /** Neben einer Erzählung: zusammenklappbar (der Zustand bleibt je Gastgeber). */
  readonly collapsible?: boolean;
  readonly open?: boolean;
  readonly onOpen?: (open: boolean) => void;
  /** 2026-11-04 — die Worte in der Sprache der Baza (sonst polnisch). */
  readonly words?: Words;
}

const HEX = (r: number): string => [-90, -30, 30, 90, 150, 210].map((a) => `${(Math.cos((a * Math.PI) / 180) * r).toFixed(1)},${(Math.sin((a * Math.PI) / 180) * r).toFixed(1)}`).join(' ');
const DIAMOND = (r: number): string => `0,${(-r).toFixed(1)} ${r.toFixed(1)},0 0,${r.toFixed(1)} ${(-r).toFixed(1)},0`;

/** Das Zeichen einer Art, in einem Kreis vom Radius `r` um 0. */
function kindIcon(kind: PartKind | undefined, r: number): string {
  const f = (v: number) => (v * r).toFixed(1);
  switch (kind) {
    case 'read': return `M${f(-0.42)},${f(-0.3)} h${f(0.84)} M${f(-0.42)},0 h${f(0.84)} M${f(-0.42)},${f(0.3)} h${f(0.56)}`;
    case 'learn': return `M${f(-0.26)},${f(-0.22)} a${f(0.27)},${f(0.27)} 0 1 1 ${f(0.4)},${f(0.24)} q${f(-0.14)},${f(0.08)} ${f(-0.14)},${f(0.22)} M${f(0)},${f(0.44)} v${f(0.02)}`;
    case 'mixed': return `M${f(-0.5)},${f(-0.22)} h${f(0.4)} M${f(-0.5)},${f(0.02)} h${f(0.4)} M${f(-0.5)},${f(0.26)} h${f(0.28)} M${f(0.08)},${f(-0.16)} a${f(0.2)},${f(0.2)} 0 1 1 ${f(0.3)},${f(0.18)} q${f(-0.1)},${f(0.06)} ${f(-0.1)},${f(0.16)} M${f(0.28)},${f(0.36)} v${f(0.02)}`;
    case 'review': return `M${f(0.38)},${f(-0.06)} a${f(0.38)},${f(0.38)} 0 1 1 ${f(-0.12)},${f(-0.3)} M${f(0.3)},${f(-0.5)} l${f(0)},${f(0.22)} l${f(-0.22)},${f(0)}`;
    case 'fork': return `M0,${f(0.46)} V${f(0.02)} L${f(-0.32)},${f(-0.36)} M0,${f(0.02)} L${f(0.32)},${f(-0.36)}`;
    case 'start': return `M${f(-0.16)},${f(-0.3)} L${f(0.3)},0 L${f(-0.16)},${f(0.3)} Z`;
    case 'end': return `M${f(-0.26)},${f(0.42)} V${f(-0.4)} M${f(-0.26)},${f(-0.4)} h${f(0.52)} l${f(-0.12)},${f(0.18)} l${f(0.12)},${f(0.18)} h${f(-0.52)}`;
    default: return '';
  }
}

/** Was jede Karte zuletzt zeigte (gelernt, leuchtend) — für das Aufleuchten nach der Rückkehr. */
const SEEN = new Map<string, { readonly lit: ReadonlySet<string>; readonly done: ReadonlySet<string>; readonly glow?: { readonly lit: ReadonlySet<string>; readonly done: ReadonlySet<string>; readonly until: number } }>();

export const PATH_STATE_WORDS: Readonly<Record<PathState, string>> = { done: 'ukończone', available: 'otwarte — możesz zacząć', locked: 'zamknięte — najpierw to, co niżej' };


/** Vergrössern: jede Stufe doppelt so gross wie eingepasst, bis die Karte in ihrer wirklichen Grösse steht (und eine darüber). */
const zoomSteps = (fit: number): number => Math.max(1, Math.ceil(Math.log2(1 / Math.max(fit, 1e-3))) + 1);

export function PathMap({ model, marks, highlight = null, actions, onPick, name, detail, size = 'full', title: titleIn, collapsible = false, open: openIn, onOpen, words: wordsGiven }: PathMapProps) {
  const T = wordsGiven ?? wordsIn('pl');
  const title = titleIn ?? (wordsGiven === undefined ? undefined : T.pathTitle);
  const stateWords: Readonly<Record<PathState, string>> = { done: T.done, available: T.open, locked: T.locked };
  /* 2026-11-04 (Prompt 10) — ein Teil, dessen Fragen alle gekonnt sind, ist nur zum Lesen (sein Zeichen auch). */
  const kindShown = (v: number): PartKind | undefined => {
    const k = model.nodes[v].kind;
    return (k === 'learn' || k === 'mixed') && marks.ask?.[v] === 0 ? 'read' : k;
  };
  const full = size === 'full';
  const R = full ? 20 : 15;
  const CW = full ? 84 : 60;
  const RH = full ? 72 : 54;
  const pad = R * 1.6 + 10;
  const W = Math.max(1, (model.x1 - model.x0 - 1) * CW + 2 * pad);
  const H = Math.max(1, Math.max(0, model.levels - 1) * RH + 2 * pad);
  const [openOwn, setOpenOwn] = useState(true);
  const open = openIn ?? openOwn;
  const setOpen = (v: boolean) => { setOpenOwn(v); onOpen?.(v); };
  const [chosen, setChosen] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const [whole, setWhole] = useState(false);
  const timers = useRef<{ open: number | null; close: number | null }>({ open: null, close: null });
  const clear = () => { for (const k of ['open', 'close'] as const) if (timers.current[k] !== null) { window.clearTimeout(timers.current[k]!); timers.current[k] = null; } };
  useEffect(() => clear, []);
  const scroller = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  /* Die Fläche der Zeichnung: so gross wie das SVG — Name, Zähler und Fenster stehen in ihren Koordinaten. */
  const canvas = useRef<HTMLDivElement>(null);

  /* Wie viel Platz da ist: die Breite des Rahmens, die Höhe nach Art (neben einer Erzählung weniger, ganz: das Fenster). */
  const [room, setRoom] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = frame.current;
    if (el === null) return undefined;
    const measure = () => {
      const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
      const h = whole ? Math.max(200, vh - 150) : full ? Math.round(vh * 0.7) : Math.min(Math.round(vh * 0.6), 560);
      setRoom((was) => (was.w === el.clientWidth && was.h === h ? was : { w: el.clientWidth, h }));
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); };
  }, [whole, full, open]);
  const fit = room.w <= 0 ? 1 : Math.min(1, (room.w - 2) / W, room.h / H);
  const steps = zoomSteps(fit);
  const s = Math.min(1.5, fit * 2 ** Math.min(zoom, steps - 1));
  const at = useMemo(() => model.nodes.map((nd) => ({ x: (pad + (nd.x - model.x0 - 0.5) * CW) * s, y: (H - pad - nd.level * RH) * s })), [model, pad, CW, RH, H, s]);
  /* Die Höhe des Rahmens: die ganze Karte (eingepasst), beim Vergrössern höchstens der Platz. */
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el === null) return;
    el.style.height = `${Math.ceil(Math.min(H * s, Math.max(H * fit, room.h)))}px`;
    const c = canvas.current;
    if (c !== null) { c.style.width = `${Math.ceil(W * s)}px`; c.style.height = `${Math.ceil(H * s)}px`; }
  }, [H, W, s, fit, room.h, open]);

  /* Was eben aufgeleuchtet ist (ein Weg, ein Knoten): kurz bewegt, auch nach einer Rückkehr. */
  const memory = useMemo(() => model.nodes.map((nd) => nd.id).join('|'), [model]);
  const seen = useRef<{ lit: ReadonlySet<string>; done: ReadonlySet<string> } | null>(SEEN.get(memory) ?? null);
  const wayKey = (i: number) => `${model.nodes[model.edges[i][0]].id}>${model.nodes[model.edges[i][1]].id}`;
  const litNow = useMemo(() => {
    const lit = new Set<string>();
    const done = new Set<string>();
    model.edges.forEach((_, i) => { if (marks.lit[i]) lit.add(wayKey(i)); });
    model.nodes.forEach((nd, v) => { if (marks.state[v] === 'done') done.add(nd.id); });
    return { lit, done, key: `${[...lit].sort().join(',')}|${[...done].sort().join(',')}` };
  }, [model, marks]); // eslint-disable-line react-hooks/exhaustive-deps
  const [glow, setGlow] = useState<{ readonly lit: ReadonlySet<string>; readonly done: ReadonlySet<string> }>(() => {
    const g = SEEN.get(memory)?.glow;
    return g !== undefined && g.until > Date.now() ? g : { lit: new Set(), done: new Set() };
  });
  useEffect(() => {
    const kept = SEEN.get(memory)?.glow;
    if (kept === undefined || kept.until <= Date.now()) return undefined;
    const t = window.setTimeout(() => setGlow({ lit: new Set(), done: new Set() }), kept.until - Date.now());
    return () => window.clearTimeout(t);
  }, [glow, memory]);
  useEffect(() => {
    const was = seen.current;
    seen.current = { lit: litNow.lit, done: litNow.done };
    const prior = SEEN.get(memory)?.glow;
    SEEN.set(memory, { ...seen.current, ...(prior === undefined ? {} : { glow: prior }) });
    if (SEEN.size > 40) SEEN.delete(SEEN.keys().next().value!);
    if (was === null) return;
    const lit = new Set([...litNow.lit].filter((k) => !was.lit.has(k)));
    const done = new Set([...litNow.done].filter((k) => !was.done.has(k)));
    if (lit.size === 0 && done.size === 0) return;
    const g = { lit, done, until: Date.now() + 1600 };
    SEEN.set(memory, { ...seen.current, glow: g });
    setGlow(g);
  }, [litNow.key, memory]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Vergrössert: der Knoten „jetzt dran" ins Bild. */
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el === null || marks.current < 0 || !open || zoom === 0) return;
    const p = at[marks.current];
    if (p === undefined) return;
    el.scrollTo({ left: Math.max(0, p.x - el.clientWidth / 2), top: Math.max(0, p.y - el.clientHeight / 2) });
  }, [zoom, marks.current, open]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Ganz: Escape schliesst. */
  useEffect(() => {
    if (!whole) return undefined;
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && chosen === null) setWhole(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [whole, chosen]);

  const shown = chosen ?? hover;
  useEffect(() => {
    if (shown === null) return undefined;
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { setChosen(null); setHover(null); } };
    const outside = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.('.cg-pm-pop') || t?.closest?.('[data-path-node]')) return;
      setChosen(null);
      setHover(null);
    };
    window.addEventListener('keydown', esc);
    window.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', esc); window.removeEventListener('pointerdown', outside); };
  }, [shown]);

  /* Ziehen zum Verschieben (vergrössert). */
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    if (el === null || zoom === 0 || (e.target as Element).closest('[data-path-node], .cg-pm-pop')) return;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false };
    el.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    const d = drag.current;
    if (el === null || d === null) return;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) d.moved = true;
    el.scrollLeft = d.left - (e.clientX - d.x);
    el.scrollTop = d.top - (e.clientY - d.y);
  };
  const up = () => { drag.current = null; };
  const stepsNow = useRef(steps);
  stepsNow.current = steps;
  /* Ctrl + Rad: vergrössern (ein eigener Hörer — React hört das Rad nur passiv). */
  useEffect(() => {
    const el = scroller.current;
    if (el === null) return undefined;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => Math.max(0, Math.min(stepsNow.current - 1, z + (e.deltaY < 0 ? 1 : -1))));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [open]);

  const nodeOf = (target: EventTarget | null): string | null => (target as Element | null)?.closest?.('[data-path-node]')?.getAttribute('data-path-node') ?? null;
  const enter = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const id = nodeOf(e.target);
    if (id === null) return;
    clear();
    if (hover === null) timers.current.open = window.setTimeout(() => setHover(id), 120); else setHover(id);
  };
  const leave = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clear();
    timers.current.close = window.setTimeout(() => setHover(null), 260);
  };
  /* Erstes Tippen: das Fenster (Name, Art, Stand); zweites auf denselben: öffnen. */
  const pick = (id: string) => {
    const v = model.index.get(id);
    if (v === undefined) return;
    if (chosen === id) {
      if (onPick !== undefined && (marks.state[v] !== 'locked' || v === marks.current)) { onPick(id); setChosen(null); setHover(null); return; }
      setChosen(null);
      return;
    }
    setChosen(id);
  };
  const key = (e: KeyboardEvent<SVGSVGElement>) => {
    const id = nodeOf(e.target);
    if (id === null) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); }
  };

  const story = model.nodes.some((nd) => nd.kind !== undefined);
  const summary = `${marks.done} z ${marks.total}`;
  const currentNode = marks.current >= 0 ? model.nodes[marks.current] : undefined;
  const currentLabel = currentNode?.label ?? null;
  const zoomBar = (
    <span className="cg-pm-tools" role="group" aria-label={T.pathTitle}>
      <button type="button" className="cg-pm-tool" onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} aria-label={T.zoomOut} data-path-zoom="out">−</button>
      <button type="button" className="cg-pm-tool" onClick={() => setZoom((z) => Math.min(steps - 1, z + 1))} disabled={zoom >= steps - 1} aria-label={T.zoomIn} data-path-zoom="in">+</button>
      <button type="button" className="cg-pm-tool is-text" onClick={() => setZoom(0)} disabled={zoom === 0} data-path-zoom="fit">{T.fit}</button>
      <button type="button" className="cg-pm-tool is-text" onClick={() => { setWhole(!whole); setZoom(0); }} aria-pressed={whole} data-path-whole="">{whole ? T.close : T.full}</button>
    </span>
  );
  const head = (title !== undefined || collapsible || open) && (
    <div className="cg-pm-head">
      {collapsible && !whole ? (
        <button type="button" className="cg-pm-toggle" aria-expanded={open} onClick={() => setOpen(!open)} data-path-toggle="">
          <span aria-hidden>{open ? '▾' : '▸'}</span> {title ?? T.pathTitle}
        </button>
      ) : <strong>{title ?? T.pathTitle}</strong>}
      <span className="cg-muted" data-path-summary={summary}>
        {T.finished} {summary}{currentLabel !== null && !open ? <> · {T.now}: {currentLabel}</> : null}
      </span>
      {open && zoomBar}
    </div>
  );
  if (model.nodes.length === 0) return null;

  const hl = highlight !== null && highlight.size > 0 ? highlight : null;
  const pop = shown === null ? undefined : model.index.get(shown);
  const popAt = pop === undefined ? null : at[pop];
  const popFork = pop === undefined ? undefined : marks.forks.get(pop);
  const r = R * s;
  const shapeOf = (kind: PartKind | undefined, rr: number) => (kind === 'fork' ? <polygon className="cg-pm-hex" points={DIAMOND(rr * 1.05)} />
    : kind === 'start' || kind === 'end' ? <circle className="cg-pm-hex" r={rr * 0.86} />
    : <polygon className="cg-pm-hex" points={HEX(rr)} />);
  const words = (v: number): string => {
    const nd = model.nodes[v];
    const f = marks.forks.get(v);
    return [nd.label, v === marks.current ? T.now : '', nd.kind === undefined ? '' : T.part(nd, marks.ask?.[v]), stateWords[marks.state[v]], marks.due[v] ? T.dueMark : '', f === undefined ? '' : T.fork(f)].filter(Boolean).join(' · ');
  };
  const nowAt = currentNode === undefined ? null : at[marks.current];
  /*
    Wohin ein Wort neben einem Knoten passt: die Seite, auf der in seiner Höhe nichts steht (ein Sechseck, ein Weg-Punkt);
    sonst die mit mehr Platz bis zum Rand. `span`: wie breit das Wort etwa ist.
  */
  const sideOf = (v: number, span: number): 'left' | 'right' => {
    const p = at[v];
    const busy = (dir: 1 | -1) => model.nodes.some((_, w) => w !== v && Math.abs(at[w].y - p.y) < r * 1.6 && (at[w].x - p.x) * dir > 0 && Math.abs(at[w].x - p.x) < span + r * 2);
    const right = !busy(1) && p.x + r + span < W * s;
    const left = !busy(-1) && p.x - r - span > 0;
    if (right) return 'right';
    if (left) return 'left';
    return p.x > (W * s) / 2 ? 'left' : 'right';
  };

  /* Die Legende: genau die Zeichen, die auf dieser Karte vorkommen. */
  const kinds = new Set(model.nodes.map((nd) => nd.kind).filter((k): k is PartKind => k !== undefined));
  const states = new Set(marks.state);
  const legend = (
    <ul className="cg-pm-legend" data-path-legend="">
      {(['start', 'read', 'learn', 'mixed', 'review', 'fork', 'end'] as const).filter((k) => kinds.has(k)).map((k) => (
        <li key={k} data-path-legend-kind={k}>
          <svg className="cg-pm-legend-icon" viewBox="-12 -12 24 24" aria-hidden>{shapeOf(k, 10)}<path className="cg-pm-icon" d={kindIcon(k, 10)} /></svg>{T.kinds[k]}
        </li>
      ))}
      {states.has('done') && <li data-path-legend-state="done"><svg className="cg-pm-legend-icon is-done" viewBox="-12 -12 24 24" aria-hidden>{shapeOf(story ? 'read' : undefined, 10)}</svg>{T.done}</li>}
      {states.has('available') && <li data-path-legend-state="available"><svg className="cg-pm-legend-icon is-available" viewBox="-12 -12 24 24" aria-hidden>{shapeOf(story ? 'read' : undefined, 10)}</svg>{T.open.split(' — ')[0]}</li>}
      {states.has('locked') && <li data-path-legend-state="locked"><svg className="cg-pm-legend-icon is-locked" viewBox="-12 -12 24 24" aria-hidden>{shapeOf(story ? 'read' : undefined, 10)}</svg>{T.locked.split(' — ')[0]}</li>}
      {marks.current >= 0 && <li data-path-legend-state="current"><svg className="cg-pm-legend-icon is-current" viewBox="-12 -12 24 24" aria-hidden><polygon className="cg-pm-halo" points={HEX(10)} /></svg>{T.now}</li>}
      {marks.due.some(Boolean) && <li data-path-legend-state="due"><svg className="cg-pm-legend-icon" viewBox="-12 -12 24 24" aria-hidden><circle className="cg-pm-due" r={5} /></svg>{T.dueMark}</li>}
    </ul>
  );

  return (
    <section className={`cg-pm${full ? ' is-full' : ' is-small'}${open ? '' : ' is-closed'}${whole ? ' is-whole' : ''}`} data-path-map={model.nodes.length} data-path-source={model.source}
      data-path-fit={fit.toFixed(3)} data-path-zoomed={zoom === 0 ? '0' : '1'} {...(whole ? { role: 'dialog', 'aria-label': title ?? 'Ścieżka' } : {})}>
      {head}
      {open && (
        <div ref={frame} className="cg-pm-frame">
          <div ref={scroller} className={`cg-pm-scroll${zoom > 0 ? ' is-zoomed' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <div ref={canvas} className="cg-pm-canvas">
            <svg className="cg-pm-svg" width={Math.ceil(W * s)} height={Math.ceil(H * s)} viewBox={`0 0 ${Math.ceil(W * s)} ${Math.ceil(H * s)}`} role="group"
              aria-label={`Ścieżka: ukończono ${summary}${currentLabel === null ? '' : `, teraz: ${currentLabel}`}`}
              onPointerOver={enter} onPointerOut={leave} onClick={(e) => { if (drag.current?.moved) return; const id = nodeOf(e.target); if (id !== null) pick(id); }} onKeyDown={key}>
              <g className="cg-pm-ways" aria-hidden>
                {model.edges.map(([p, c], i) => {
                  const pts = (model.routes[i] ?? [[model.nodes[p].x, model.nodes[p].level], [model.nodes[c].x, model.nodes[c].level]]).map(([x, L]) => ({ x: (pad + (x - model.x0 - 0.5) * CW) * s, y: (H - pad - L * RH) * s }));
                  const k = wayKey(i);
                  let d = `M${pts[0].x.toFixed(1)},${(pts[0].y - r * 0.9).toFixed(1)}`;
                  for (let j = 1; j < pts.length; j += 1) {
                    const a = j === 1 ? { x: pts[0].x, y: pts[0].y - r * 0.9 } : pts[j - 1];
                    const b = j === pts.length - 1 ? { x: pts[j].x, y: pts[j].y + r * 0.9 } : pts[j];
                    const mid = (a.y + b.y) / 2;
                    d += ` C${a.x.toFixed(1)},${mid.toFixed(1)} ${b.x.toFixed(1)},${mid.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
                  }
                  const on = hl !== null && hl.has(model.nodes[p].id) && hl.has(model.nodes[c].id);
                  return (
                    <path key={k} className={`cg-pm-way${marks.lit[i] ? ' is-lit' : ''}${marks.taken[i] ? ' is-taken' : ''}${glow.lit.has(k) ? ' is-new' : ''}${on ? ' is-hl' : ''}`} pathLength={1} d={d}
                      data-path-way={k} data-path-lit={marks.lit[i] ? '1' : '0'} data-path-taken={marks.taken[i] ? '1' : '0'} />
                  );
                })}
              </g>
              <g className="cg-pm-nodes">
                {model.nodes.map((nd, v) => {
                  const p = at[v];
                  const state = marks.state[v];
                  const current = v === marks.current;
                  const rr = current ? r * 1.3 : r;
                  return (
                    <g key={nd.id} className={`cg-pm-node is-${state}${nd.kind === undefined ? '' : ` is-${nd.kind}`}${current ? ' is-current' : ''}${marks.due[v] ? ' is-due' : ''}${glow.done.has(nd.id) ? ' is-new' : ''}${hl?.has(nd.id) === true ? ' is-hl' : ''}${shown === nd.id ? ' is-on' : ''}`}
                      transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`} data-path-node={nd.id} data-path-state={state} data-path-current={current ? '1' : '0'}
                      data-path-kind={nd.kind ?? 'entry'} data-path-level={nd.level} data-path-x={nd.x} tabIndex={0} role="button" aria-label={words(v)} aria-pressed={chosen === nd.id}>
                      <circle className="cg-pm-hit" r={Math.max(rr * 1.1, 12)} />
                      {current && <polygon className="cg-pm-halo" points={HEX(rr + Math.max(3, 5 * s))} />}
                      {shapeOf(nd.kind, rr)}
                      {nd.kind !== undefined && <path className="cg-pm-icon" d={kindIcon(kindShown(v), rr)} />}
                      {marks.due[v] && <circle className="cg-pm-due" cx={rr * 0.66} cy={-rr * 0.66} r={Math.max(3, rr * 0.22)} />}
                    </g>
                  );
                })}
              </g>
            </svg>
            {nowAt !== null && currentNode !== undefined && <NowLabel x={nowAt.x} y={nowAt.y} r={r * 1.3} left={sideOf(marks.current, 150) === 'left'}>{name?.(currentNode.id) ?? currentNode.label}</NowLabel>}
            {[...marks.forks].map(([v, f]) => (
              <ForkCount key={v} x={at[v].x} y={at[v].y} r={r * 1.1} left={v === marks.current ? sideOf(v, 150) !== 'left' : sideOf(v, 110) === 'left'} state={marks.state[v]} data={`${f.done}/${f.total}`}>{T.fork(f)}</ForkCount>
            ))}
            {pop !== undefined && popAt !== null && (
              <PathPop at={popAt} below={popAt.y < 160} r={r}
                onPointerEnter={() => clear()} onPointerLeave={(e) => { if (e.pointerType === 'mouse' && chosen === null) { clear(); timers.current.close = window.setTimeout(() => setHover(null), 260); } }}>
                <p className="cg-pm-pop-title"><strong>{name?.(model.nodes[pop].id) ?? model.nodes[pop].label}</strong></p>
                {model.nodes[pop].kind !== undefined && <p data-path-pop-kind={model.nodes[pop].kind} {...(marks.ask === undefined ? {} : { 'data-path-pop-ask': marks.ask[pop] })}>{T.part(model.nodes[pop], marks.ask?.[pop])}</p>}
                <p className="cg-pm-pop-state" data-path-pop-state={marks.state[pop]}>
                  {pop === marks.current ? `${T.now} · ` : ''}{stateWords[marks.state[pop]]}{marks.due[pop] ? ` · ${T.dueMark}` : ''}
                </p>
                {popFork !== undefined && <p className="cg-muted" data-path-pop-fork="">{T.fork(popFork)}{popFork.mode === 'all' ? T.forkAll : T.forkOne}</p>}
                {marks.state[pop] === 'locked' && (
                  <p className="cg-muted">{T.firstNeeds}: {model.nodes[pop].needs.filter((q) => marks.state[q] !== 'done').map((q) => model.nodes[q].label).slice(0, 3).join(', ')}</p>
                )}
                {detail?.(model.nodes[pop].id) != null && <p className="cg-muted">{detail(model.nodes[pop].id)}</p>}
                {actions?.(model.nodes[pop].id, marks.state[pop])}
                {onPick !== undefined && chosen === model.nodes[pop].id && (marks.state[pop] !== 'locked' || pop === marks.current) && <p className="cg-muted">{T.tapAgain}</p>}
              </PathPop>
            )}
            </div>
          </div>
          {legend}
        </div>
      )}
    </section>
  );
}

/** Ein Element, gesetzt über eine Referenz (keine Stile im Markup). */
function usePlace(x: number, y: number) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    el.style.left = `${x.toFixed(0)}px`;
    el.style.top = `${y.toFixed(0)}px`;
  }, [x, y]);
  return ref;
}

/**
 * Ein Wort neben einem Knoten, immer im sichtbaren Rahmen: auf der gewünschten Seite, wenn dort Platz ist, sonst auf der
 * anderen, sonst über ihm — nie über den Rand hinaus (die Seite rollt nie seitwärts).
 */
function useBeside(x: number, y: number, r: number, left: boolean, gap: number, deps: readonly unknown[] = []) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const cv = el?.parentElement;
    const sc = cv?.parentElement;
    if (el === null || cv === null || cv === undefined || sc === null || sc === undefined) return;
    const from = sc.scrollLeft - cv.offsetLeft;
    const to = from + sc.clientWidth;
    el.style.maxWidth = '';
    const want = el.scrollWidth;
    const right = to - (x + r + gap) - 4;
    const leftRoom = x - r - gap - from - 4;
    const fits = (room: number) => room >= Math.min(want, 96);
    let side: 'left' | 'right' | 'up' = left ? (fits(leftRoom) ? 'left' : fits(right) ? 'right' : 'up') : (fits(right) ? 'right' : fits(leftRoom) ? 'left' : 'up');
    if (side === 'up' && to - from < 60) side = 'right';
    if (side === 'right') { el.style.left = `${(x + r + gap).toFixed(0)}px`; el.style.top = `${y.toFixed(0)}px`; el.style.transform = 'translateY(-50%)'; el.style.maxWidth = `${Math.max(60, right).toFixed(0)}px`; }
    else if (side === 'left') { el.style.left = `${(x - r - gap).toFixed(0)}px`; el.style.top = `${y.toFixed(0)}px`; el.style.transform = 'translate(-100%, -50%)'; el.style.maxWidth = `${Math.max(60, leftRoom).toFixed(0)}px`; }
    else {
      const width = Math.min(want, to - from - 8);
      const centre = Math.min(Math.max(x, from + width / 2 + 4), to - width / 2 - 4);
      el.style.left = `${centre.toFixed(0)}px`; el.style.top = `${(y - r - gap).toFixed(0)}px`; el.style.transform = 'translate(-50%, -100%)'; el.style.maxWidth = `${width.toFixed(0)}px`;
    }
  }, [x, y, r, left, gap, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}

/** Der Name des Knotens „jetzt dran", neben ihm (auf der freien Seite). */
function NowLabel({ x, y, r, left, children }: { x: number; y: number; r: number; left: boolean; children: ReactNode }) {
  const ref = useBeside(x, y, r, left, 8);
  return <div ref={ref} className="cg-pm-now" data-path-now="" aria-hidden><span className="cg-pm-now-tag">teraz</span> {children}</div>;
}

/** Der Zähler einer Gabel, neben ihr (auf der freien Seite). */
function ForkCount({ x, y, r, left, state, data, children }: { x: number; y: number; r: number; left: boolean; state: PathState; data: string; children: ReactNode }) {
  const ref = useBeside(x, y, r, left, 6, [children]);
  return <div ref={ref} className={`cg-pm-fork is-${state}`} data-path-fork={data}>{children}</div>;
}

/** Das Fenster über einem Knoten (unter ihm, wenn oben kein Platz ist). */
function PathPop({ at, below, r, children, onPointerEnter, onPointerLeave }: {
  at: { readonly x: number; readonly y: number };
  below: boolean;
  r: number;
  children: ReactNode;
  onPointerEnter: () => void;
  onPointerLeave: (e: ReactPointerEvent) => void;
}) {
  const ref = usePlace(at.x, below ? at.y + r + 10 : at.y - r - 10);
  /* Im Rahmen halten: nie über den linken oder rechten Rand hinaus. */
  useLayoutEffect(() => {
    const el = ref.current;
    const cv = el?.parentElement;
    const sc = cv?.parentElement;
    if (el === null || cv === null || cv === undefined || sc === null || sc === undefined) return;
    /* Der sichtbare Ausschnitt in den Koordinaten der Zeichnung (sie steht mittig im Rahmen). */
    const from = sc.scrollLeft - cv.offsetLeft;
    const half = el.offsetWidth / 2;
    const left = Math.min(Math.max(at.x, from + half + 4), from + sc.clientWidth - half - 4);
    el.style.left = `${left.toFixed(0)}px`;
  }, [at.x, at.y, below]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} className={`cg-pm-pop${below ? ' is-below' : ''}`} role="dialog" data-path-pop="" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      {children}
    </div>
  );
}
