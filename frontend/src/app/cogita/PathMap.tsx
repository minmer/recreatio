/**
 * 2026-11-03 (F) — DIE ŚCIEŻKA ALS KARTE, gezeichnet (`pathMap.ts` rechnet): Sechsecke von unten (Anfang) nach oben,
 * verbunden durch Wege, die sich gabeln und wieder zusammenkommen — in derselben Sprache wie der Krajobraz: gelernt
 * (versenkt, ✓), jetzt dran (hervorgehoben), frei (erhaben, leuchtend), gesperrt (blass, Schloss), zu wiederholen
 * (Zeichen). Ein Weg leuchtet, sobald sein Anfang gelernt ist — wer einen Schritt beendet, sieht den nächsten Weg
 * aufleuchten. Folgt immer der Stelle, an der der Lernende ist.
 *
 * Ein Baustein für überall: neben einer Erzählung (klein, zusammenklappbar), in Nauka → Ścieżka und als Baustein
 * „Ścieżka" einer Seite (gross), und gross, wenn man im Krajobraz ein Feld einer Einheit öffnet. Was ein Knoten
 * anbietet, sagt der Gastgeber (`actions`); ein Tippen kann auch gleich etwas tun (`onPick`: in der Erzählung dorthin).
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

import { mergeWords, type PathMarks, type PathModel, type PathState } from './pathLayout';
import './pathMap.css';

export interface PathMapProps {
  readonly model: PathModel;
  readonly marks: PathMarks;
  /** Eine Spur hervorheben (die Möglichkeit einer Wahl der Erzählung, über der der Zeiger steht). */
  readonly highlight?: ReadonlySet<string> | null;
  /** Was ein Knoten im Fenster über ihm anbietet (lernen, in der Erzählung dorthin). */
  readonly actions?: (id: string, state: PathState) => ReactNode;
  /** Ein Tippen tut gleich etwas (ohne Fenster) — nur bei freien und gelernten Knoten. */
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
}

const HEX = (r: number): string => [-90, -30, 30, 90, 150, 210].map((a) => `${(Math.cos((a * Math.PI) / 180) * r).toFixed(1)},${(Math.sin((a * Math.PI) / 180) * r).toFixed(1)}`).join(' ');

/** Wie breit ein Text ist (gemessen, sonst geschätzt). */
let canvas: CanvasRenderingContext2D | null | undefined;
function measure(text: string, px: number): number {
  if (canvas === undefined) canvas = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (canvas === null) return text.length * px * 0.55;
  canvas.font = `${px}px system-ui, sans-serif`;
  return canvas.measureText(text).width;
}
/** Ein Name in höchstens zwei Zeilen dieser Breite (gekürzt mit …). */
function lines(text: string, width: number, px: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line === '' ? w : `${line} ${w}`;
    if (measure(next, px) <= width || line === '') { line = next; continue; }
    out.push(line);
    line = w;
    if (out.length === 2) break;
  }
  if (out.length < 2 && line !== '') out.push(line);
  const used = out.join(' ').split(/\s+/).length;
  if (used < words.length || out.some((l) => measure(l, px) > width)) {
    let last = out[out.length - 1] ?? '';
    while (last.length > 1 && measure(`${last}…`, px) > width) last = last.slice(0, -1);
    out[out.length - 1] = `${last.replace(/\s+$/, '')}…`;
  }
  return out.slice(0, 2);
}

/** Was jede Karte zuletzt zeigte (gelernt, leuchtend) — für das Aufleuchten nach der Rückkehr. */
const SEEN = new Map<string, { readonly lit: ReadonlySet<string>; readonly done: ReadonlySet<string>; readonly glow?: { readonly lit: ReadonlySet<string>; readonly done: ReadonlySet<string>; readonly until: number } }>();

export const PATH_STATE_WORDS: Readonly<Record<PathState, string>> = { done: 'umiem', available: 'gotowe do nauki', locked: 'najpierw to, co przed nim' };

export function PathMap({ model, marks, highlight = null, actions, onPick, name, detail, size = 'full', title, collapsible = false, open: openIn, onOpen }: PathMapProps) {
  const full = size === 'full';
  const R = full ? 21 : 15;
  const CW = full ? 104 : 46;
  const RH = full ? 96 : 58;
  const FONT = 12;
  const padX = full ? CW / 2 : R + 10;
  const padTop = R + (full ? 26 : 18);
  const padBottom = R + (full ? 36 : 10);
  const width = Math.max(1, (model.x1 - model.x0) * CW + 2 * padX - CW);
  const height = Math.max(1, Math.max(0, model.levels - 1) * RH + padTop + padBottom);
  const at = useMemo(() => model.nodes.map((nd) => ({ x: padX + (nd.x - model.x0 - 0.5) * CW, y: height - padBottom - nd.level * RH })), [model, padX, CW, RH, height, padBottom]);
  const [openOwn, setOpenOwn] = useState(true);
  const open = openIn ?? openOwn;
  const setOpen = (v: boolean) => { setOpenOwn(v); onOpen?.(v); };
  const [chosen, setChosen] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const timers = useRef<{ open: number | null; close: number | null }>({ open: null, close: null });
  const clear = () => { for (const k of ['open', 'close'] as const) if (timers.current[k] !== null) { window.clearTimeout(timers.current[k]!); timers.current[k] = null; } };
  useEffect(() => clear, []);
  const scroller = useRef<HTMLDivElement>(null);

  /*
    Was eben aufgeleuchtet ist (ein Weg, ein Knoten): kurz bewegt. Gemerkt je Karte über das Leben der Zeichnung hinaus —
    wer aus einer Lektion zurückkommt, sieht den Weg aufleuchten, den er eben frei gemacht hat; beim allerersten Bild nichts.
  */
  const memory = useMemo(() => model.nodes.map((nd) => nd.id).join('|'), [model]);
  const seen = useRef<{ lit: ReadonlySet<string>; done: ReadonlySet<string> } | null>(SEEN.get(memory) ?? null);
  const litKey = (i: number) => `${model.nodes[model.edges[i][0]].id}>${model.nodes[model.edges[i][1]].id}`;
  const litNow = useMemo(() => {
    const lit = new Set<string>();
    const done = new Set<string>();
    model.edges.forEach((_, i) => { if (marks.lit[i]) lit.add(litKey(i)); });
    model.nodes.forEach((nd, v) => { if (marks.state[v] === 'done') done.add(nd.id); });
    return { lit, done, key: `${[...lit].sort().join(',')}|${[...done].sort().join(',')}` };
  }, [model, marks]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Was neu ist, leuchtet eine Weile (die Bewegung braucht ihre Zeit), auch wenn die Karte inzwischen neu gezeichnet wird. */
  /* Auch über ein Neuzeichnen hinweg (die Karten werden neu gezählt): was noch leuchten soll, steht im Gedächtnis der Karte. */
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
  const fresh = { out: glow };

  /* Immer dort, wo der Lernende ist: der Knoten „jetzt dran" ins Bild (das erste Mal sofort). */
  const followed = useRef(false);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el === null || marks.current < 0 || !open) return;
    const p = at[marks.current];
    if (p === undefined) return;
    const left = Math.max(0, p.x - el.clientWidth / 2);
    const top = Math.max(0, p.y - el.clientHeight / 2);
    el.scrollTo({ left, top, behavior: followed.current ? 'smooth' : 'instant' });
    followed.current = true;
  }, [marks.current, at, open]);

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
  const pick = (id: string) => {
    const v = model.index.get(id);
    if (v === undefined) return;
    if (actions === undefined && onPick !== undefined) {
      if (marks.state[v] !== 'locked' || v === marks.current) onPick(id);
      return;
    }
    setChosen(chosen === id ? null : id);
  };
  const key = (e: KeyboardEvent<SVGSVGElement>) => {
    const id = nodeOf(e.target);
    if (id === null) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); }
  };

  const summary = `${marks.done} z ${model.nodes.length}`;
  const currentLabel = marks.current >= 0 ? model.nodes[marks.current].label : null;
  const head = (title !== undefined || collapsible) && (
    <div className="cg-pm-head">
      {collapsible ? (
        <button type="button" className="cg-pm-toggle" aria-expanded={open} onClick={() => setOpen(!open)} data-path-toggle="">
          <span aria-hidden>{open ? '▾' : '▸'}</span> {title ?? 'Ścieżka'}
        </button>
      ) : <strong>{title}</strong>}
      <span className="cg-muted" data-path-summary={summary}>{summary}{currentLabel !== null && !full ? <> · teraz: {currentLabel}</> : null}</span>
    </div>
  );
  if (model.nodes.length === 0) return null;

  const hl = highlight !== null && highlight.size > 0 ? highlight : null;
  const pop = shown === null ? undefined : model.index.get(shown);
  const popAt = pop === undefined ? null : at[pop];
  const merge = pop === undefined ? undefined : marks.merges.get(pop);

  return (
    <section className={`cg-pm${full ? ' is-full' : ' is-small'}${open ? '' : ' is-closed'}`} data-path-map={model.nodes.length} data-path-source={model.source}>
      {head}
      {open && (
        <div ref={scroller} className="cg-pm-scroll">
          <svg className="cg-pm-svg" width={width} height={height} viewBox={`0 0 ${width.toFixed(0)} ${height.toFixed(0)}`} role="group"
            aria-label={`Ścieżka: ${summary} przerobione${currentLabel === null ? '' : `, teraz: ${currentLabel}`}`}
            onPointerOver={enter} onPointerOut={leave} onClick={(e) => { const id = nodeOf(e.target); if (id !== null) pick(id); }} onKeyDown={key}>
            <g className="cg-pm-ways" aria-hidden>
              {model.edges.map(([p, c], i) => {
                const a = at[p];
                const b = at[c];
                const mid = (a.y + b.y) / 2;
                const k = litKey(i);
                const dim = hl !== null && !(hl.has(model.nodes[p].id) && hl.has(model.nodes[c].id));
                return (
                  <path key={k} className={`cg-pm-way${marks.lit[i] ? ' is-lit' : ''}${fresh.out.lit.has(k) ? ' is-new' : ''}${dim ? ' is-dim' : ''}`} pathLength={1}
                    d={`M${a.x.toFixed(1)},${(a.y - R).toFixed(1)} C${a.x.toFixed(1)},${mid.toFixed(1)} ${b.x.toFixed(1)},${mid.toFixed(1)} ${b.x.toFixed(1)},${(b.y + R).toFixed(1)}`}
                    data-path-way={k} data-path-lit={marks.lit[i] ? '1' : '0'} />
                );
              })}
            </g>
            <g className="cg-pm-nodes">
              {model.nodes.map((nd, v) => {
                const p = at[v];
                const state = marks.state[v];
                const current = v === marks.current;
                const m = marks.merges.get(v);
                const dim = hl !== null && !hl.has(nd.id);
                const words = `${nd.label}: ${current ? 'teraz · ' : ''}${PATH_STATE_WORDS[state]}${marks.due[v] ? ' · do powtórki' : ''}${m !== undefined && state !== 'done' ? ` · ${mergeWords(m.done, m.total)}` : ''}`;
                return (
                  <g key={nd.id} className={`cg-pm-node is-${state}${current ? ' is-current' : ''}${marks.due[v] ? ' is-due' : ''}${fresh.out.done.has(nd.id) ? ' is-new' : ''}${dim ? ' is-dim' : ''}${hl?.has(nd.id) === true ? ' is-hl' : ''}${shown === nd.id ? ' is-on' : ''}`}
                    transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`} data-path-node={nd.id} data-path-state={state} data-path-current={current ? '1' : '0'}
                    data-path-level={nd.level} data-path-x={nd.x} tabIndex={0} role="button" aria-label={words} aria-pressed={chosen === nd.id}>
                    {current && <polygon className="cg-pm-halo" points={HEX(R + 6)} />}
                    <polygon className="cg-pm-hex" points={HEX(R)} />
                    {state === 'done' && <path className="cg-pm-check" d={`M${-R * 0.38},0 l${R * 0.28},${R * 0.3} l${R * 0.5},${-R * 0.58}`} />}
                    {state === 'locked' && <path className="cg-pm-lock" d={`M${-R * 0.34},${-R * 0.05} h${R * 0.68} v${R * 0.52} h${-R * 0.68} z M${-R * 0.2},${-R * 0.05} v${-R * 0.2} a${R * 0.2},${R * 0.2} 0 0 1 ${R * 0.4},0 v${R * 0.2}`} />}
                    {state === 'available' && <circle className="cg-pm-dot" r={R * 0.22} />}
                    {marks.due[v] && <circle className="cg-pm-due" cx={R * 0.62} cy={-R * 0.62} r={Math.max(3, R * 0.2)} />}
                    {m !== undefined && state !== 'done' && <text className="cg-pm-merge" y={-R - 8} textAnchor="middle" data-path-merge={`${m.done}/${m.total}`}>{mergeWords(m.done, m.total)}</text>}
                    {full && lines(nd.label, CW - 10, FONT).map((line, i) => <text key={i} className="cg-pm-label" y={R + 15 + i * 14} textAnchor="middle">{line}</text>)}
                  </g>
                );
              })}
            </g>
          </svg>
          {pop !== undefined && popAt !== null && (
            <PathPop at={popAt} below={popAt.y < 150} r={R}
              onPointerEnter={() => clear()} onPointerLeave={(e) => { if (e.pointerType === 'mouse' && chosen === null) { clear(); timers.current.close = window.setTimeout(() => setHover(null), 260); } }}>
              <p className="cg-pm-pop-title"><strong>{name?.(model.nodes[pop].id) ?? model.nodes[pop].label}</strong></p>
              <p className="cg-pm-pop-state" data-path-pop-state={marks.state[pop]}>
                {pop === marks.current ? 'teraz · ' : ''}{PATH_STATE_WORDS[marks.state[pop]]}{marks.due[pop] ? ' · do powtórki' : ''}
              </p>
              {merge !== undefined && <p className="cg-muted" data-path-pop-merge="">Tu schodzą się ścieżki: {mergeWords(merge.done, merge.total)} przerobione.</p>}
              {marks.state[pop] === 'locked' && (
                <p className="cg-muted">Najpierw: {model.nodes[pop].needs.filter((p) => marks.state[p] !== 'done').map((p) => model.nodes[p].label).slice(0, 3).join(', ')}</p>
              )}
              {detail?.(model.nodes[pop].id) != null && <p className="cg-muted">{detail(model.nodes[pop].id)}</p>}
              {actions?.(model.nodes[pop].id, marks.state[pop])}
            </PathPop>
          )}
        </div>
      )}
    </section>
  );
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
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    el.style.left = `${at.x.toFixed(0)}px`;
    el.style.top = `${(below ? at.y + r + 10 : at.y - r - 10).toFixed(0)}px`;
  }, [at.x, at.y, below, r]);
  return (
    <div ref={ref} className={`cg-pm-pop${below ? ' is-below' : ''}`} role="dialog" data-path-pop="" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      {children}
    </div>
  );
}
