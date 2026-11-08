/**
 * 2026-11-03 (F), neu 2026-11-04 — DIE ŚCIEŻKA ALS KARTE (`pathLayout.ts` rechnet, `storyPath.ts` liefert die Teile einer
 * Erzählung): immer von unten (Anfang) nach oben (Ende), wie ein Berg — Durchgangenes unten, Gesperrtes oben.
 * <code>
 *   Grösse         nach dem Rahmen, nicht nach dem Fenster: so breit wie er (eingepasst), nie kleiner als lesbar — passt
 *                  sie nicht, rollt sie im Rahmen (und „Pełny ekran"); „+" / „−" / „Dopasuj" (alles im Bild)
 *   jetzt dran     grösser, kräftig umrandet; sein Name und die Zähler der Gabeln stehen NEBEN der Karte (eine Spalte
 *                  rechts, mit einer Linie zum Knoten) — kein Wort deckt je einen Knoten
 *   Art            ein Zeichen im Sechseck: Lesen, Fragen, beides, Przegląd; Gabeln als Raute, Anfang und Ende als Kreis;
 *                  ein automatischer Teil mit seinem Zeichen; ein nicht gewählter Weg blass
 *   Wege zurück    ein kurzer Bogen mit Pfeil in die Gabel: eine Schleife, kein Ende
 *   Stand          durch (satt), frei (hell, umrandet), gesperrt (blass, gestrichelt), zu wiederholen (Punkt)
 *   danach         (`next`) über dem Ende: was nach dieser Erzählung kommt — wählbar nur, was jetzt möglich ist
 *   Namen          beim Zeigen oder Tippen ein Fenster (über allem, nie abgeschnitten: es bleibt im Rahmen und im Bild)
 *   Legende        jedes Zeichen, das auf dieser Karte vorkommt — nichts sonst; bei wenig Platz hinter „Legenda"
 * </code>
 * Ein Baustein für überall: neben einer Erzählung, in Nauka → Ścieżka, als Baustein „Ścieżka" und im Krajobraz.
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { texPlain } from '../core/tex';
import { TexText } from '../ui/tex/Tex';
import { words as wordsIn, type Words } from './lang';
import type { PartKind, PathMarks, PathModel, PathState } from './pathLayout';
import './pathMap.css';

/** 2026-11-05 (Prompt 23, D5) — ein Name mit Wzory als Zeile Text (im SVG zeichnet kein KaTeX). */
const plainOf = (text: string): string => text.replace(/\$\$?([^$]+)\$\$?/g, (_, t: string) => texPlain(t));
/** Gekürzt mit „…" (der ganze Name steht im Fenster beim Tippen). */
const cut = (text: string, chars: number): string => (text.length <= chars ? text : `${text.slice(0, Math.max(1, chars - 1)).trimEnd()}…`);

/** 2026-11-04 (Prompt 11) — was nach dem Ende kommt (ein Knoten in der Reihe über „Koniec"). */
export interface PathNext {
  readonly id: string;
  readonly label: string;
  /** Eine Erzählung, ein Thema — oder die Karte (das nächste Feld, „Wróć do mapy"). */
  readonly kind: 'story' | 'topic' | 'map';
  /** Can start immediately; a locked destination may instead offer its prerequisite route. */
  readonly ready: boolean;
  /** Was dort wartet („4 slajdy · 6 pytań"). */
  readonly work?: string;
  /** Warum noch nicht (was fehlt, was zuerst zu wiederholen ist — beim Namen). */
  readonly why?: readonly string[];
  /** Ein Satz darüber (z. B. „Najbliższe pole na mapie"). */
  readonly note?: string;
  readonly action?: { readonly label: string; readonly run: () => void };
  readonly goalAction?: { readonly label: string; readonly run: () => void };
  /** 2026-11-05 — wie weit der Lernende dort schon ist: zu Ende („ukończone", grün mit ✓) oder begonnen. */
  readonly state?: 'done' | 'started';
  /** An optional detour, separate from the next stages of learning. */
  readonly optional?: boolean;
}

/**
 * 2026-11-05 (Prompt 23, B2–B5) — WAS EIN ZWEIG (ein Abstecher) ÜBER SEINE ERZÄHLUNG WEISS: ihr Name, wie weit der Lernende
 * darin ist, ihre Fragen, wo er abzweigt, und ihre eigenen Abstecher (zugeklappt, „Rozwiń").
 */
export interface PathBranch {
  readonly name: string;
  readonly state: 'new' | 'skipped' | 'progress' | 'done';
  /** Durch und alle Teile ihrer Erzählung (für „3/8"). */
  readonly done?: number;
  readonly total?: number;
  readonly questions?: number;
  readonly known?: number;
  /** „po slajdzie 2". */
  readonly where?: string;
  /** Ihr Satz („streszczenie" ihrer Einheit). */
  readonly summary?: string;
  /** Ihre eigenen Abstecher (eine Ebene tiefer). */
  readonly sub?: readonly { readonly id: string; readonly name: string; readonly state: PathBranch['state'] }[];
}

export interface PathMapProps {
  /** 2026-11-05 (Prompt 23, B) — je Abstecher, was sein Zweig zeigt (ohne: ein schlichter Zweig). */
  readonly branches?: (id: string) => PathBranch | null;
  /** 2026-11-05 (Prompt 23, B6) — im Abstecher: der Knoten, zu dem der Lernende zurückkehrt („tu wrócisz"). */
  readonly returnAt?: string | null;
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
  /** 2026-11-04 (Prompt 11) — was der Zähler zählt: Teile einer Erzählung (Vorgabe) oder Themen eines Weges. */
  readonly noun?: 'parts' | 'topics';
  /** 2026-11-04 (Prompt 11) — was nach dem Ende kommt (eine Reihe über ihm). */
  readonly next?: readonly PathNext[];
  /** 2026-11-04 (Prompt 11) — Knöpfe des Gastgebers im Kopf (breiter / schmaler neben einer Erzählung). */
  readonly tools?: ReactNode;
}

const HEX = (r: number): string => [-90, -30, 30, 90, 150, 210].map((a) => `${(Math.cos((a * Math.PI) / 180) * r).toFixed(1)},${(Math.sin((a * Math.PI) / 180) * r).toFixed(1)}`).join(' ');
const DIAMOND = (r: number): string => `0,${(-r).toFixed(1)} ${r.toFixed(1)},0 0,${r.toFixed(1)} ${(-r).toFixed(1)},0`;

/** Das Zeichen einer Art, in einem Kreis vom Radius `r` um 0. */
function kindIcon(kind: PartKind | 'auto' | 'map' | undefined, r: number): string {
  const f = (v: number) => (v * r).toFixed(1);
  switch (kind) {
    case 'read': return `M${f(-0.42)},${f(-0.3)} h${f(0.84)} M${f(-0.42)},0 h${f(0.84)} M${f(-0.42)},${f(0.3)} h${f(0.56)}`;
    case 'learn': return `M${f(-0.26)},${f(-0.22)} a${f(0.27)},${f(0.27)} 0 1 1 ${f(0.4)},${f(0.24)} q${f(-0.14)},${f(0.08)} ${f(-0.14)},${f(0.22)} M${f(0)},${f(0.44)} v${f(0.02)}`;
    case 'mixed': return `M${f(-0.5)},${f(-0.22)} h${f(0.4)} M${f(-0.5)},${f(0.02)} h${f(0.4)} M${f(-0.5)},${f(0.26)} h${f(0.28)} M${f(0.08)},${f(-0.16)} a${f(0.2)},${f(0.2)} 0 1 1 ${f(0.3)},${f(0.18)} q${f(-0.1)},${f(0.06)} ${f(-0.1)},${f(0.16)} M${f(0.28)},${f(0.36)} v${f(0.02)}`;
    case 'review': return `M${f(0.38)},${f(-0.06)} a${f(0.38)},${f(0.38)} 0 1 1 ${f(-0.12)},${f(-0.3)} M${f(0.3)},${f(-0.5)} l${f(0)},${f(0.22)} l${f(-0.22)},${f(0)}`;
    case 'fork': return `M0,${f(0.46)} V${f(0.02)} L${f(-0.32)},${f(-0.36)} M0,${f(0.02)} L${f(0.32)},${f(-0.36)}`;
    case 'start': return `M${f(-0.16)},${f(-0.3)} L${f(0.3)},0 L${f(-0.16)},${f(0.3)} Z`;
    case 'end': return `M${f(-0.26)},${f(0.42)} V${f(-0.4)} M${f(-0.26)},${f(-0.4)} h${f(0.52)} l${f(-0.12)},${f(0.18)} l${f(0.12)},${f(0.18)} h${f(-0.52)}`;
    /* Zwei Pfeile, die sich teilen: die App wählt selbst. */
    case 'auto': return `M${f(-0.55)},${f(-0.25)} h${f(0.95)} m${f(-0.3)},${f(-0.25)} l${f(0.3)},${f(0.25)} l${f(-0.3)},${f(0.25)} M${f(0.55)},${f(0.3)} h${f(-0.95)} m${f(0.3)},${f(-0.25)} l${f(-0.3)},${f(0.25)} l${f(0.3)},${f(0.25)}`;
    /* 2026-11-04 (Prompt 13) — ein Abstecher: ein Pfeil hinunter in ein kleines Sechseck, ein Pfeil wieder hinauf. */
    case 'detour': {
      const hex = [-90, -30, 30, 90, 150, 210].map((a, i) => `${i === 0 ? 'M' : 'L'}${f(Math.cos((a * Math.PI) / 180) * 0.2)},${f(0.26 + Math.sin((a * Math.PI) / 180) * 0.2)}`).join(' ');
      return `M${f(-0.34)},${f(-0.48)} V${f(0.02)} M${f(-0.46)},${f(-0.1)} L${f(-0.34)},${f(0.02)} L${f(-0.22)},${f(-0.1)} M${f(0.34)},${f(0.02)} V${f(-0.48)} M${f(0.22)},${f(-0.36)} L${f(0.34)},${f(-0.48)} L${f(0.46)},${f(-0.36)} ${hex} Z`;
    }
    case 'map': return `M${f(-0.5)},${f(-0.3)} l${f(0.33)},${f(-0.14)} l${f(0.34)},${f(0.14)} l${f(0.33)},${f(-0.14)} v${f(0.74)} l${f(-0.33)},${f(0.14)} l${f(-0.34)},${f(-0.14)} l${f(-0.33)},${f(0.14)} Z M${f(-0.17)},${f(-0.44)} v${f(0.74)} M${f(0.17)},${f(-0.3)} v${f(0.74)}`;
    default: return '';
  }
}

/** Was jede Karte zuletzt zeigte (gelernt, leuchtend) — für das Aufleuchten nach der Rückkehr. */
const SEEN = new Map<string, { readonly lit: ReadonlySet<string>; readonly done: ReadonlySet<string>; readonly glow?: { readonly lit: ReadonlySet<string>; readonly done: ReadonlySet<string>; readonly until: number } }>();

export const PATH_STATE_WORDS: Readonly<Record<PathState, string>> = { done: 'ukończone', available: 'otwarte — możesz zacząć', locked: 'zamknięte — najpierw to, co niżej' };

/** Eine Seite des Fensters über einem Knoten (eine Kennung der Karte oder ein Knoten der Reihe danach). */
const NEXT = 'next:';

export function PathMap({ model, marks, highlight = null, actions, onPick, name, detail, size = 'full', title: titleIn, collapsible = false, open: openIn, onOpen, words: wordsGiven, noun = 'parts', next, tools, branches, returnAt = null }: PathMapProps) {
  const T = wordsGiven ?? wordsIn('pl');
  const title = titleIn ?? (wordsGiven === undefined ? undefined : T.pathTitle);
  const stateWords: Readonly<Record<PathState, string>> = { done: T.done, available: T.open, locked: T.locked };
  /* 2026-11-04 (Prompt 10) — ein Teil, dessen Fragen alle gekonnt sind, ist nur zum Lesen (sein Zeichen auch). */
  const kindShown = (v: number): PartKind | undefined => {
    const k = model.nodes[v].kind;
    return (k === 'learn' || k === 'mixed') && marks.ask?.[v] === 0 ? 'read' : k;
  };
  const optional = (v: number) => marks.optional?.[v] === true;
  /* 2026-11-05 (Prompt 23, B2) — was ein Zweig sagt (vom Gastgeber; sonst aus dem Stand der Karte). */
  const branchOf = (v: number): PathBranch | null => (model.nodes[v]?.branch === undefined ? null : branches?.(model.nodes[v].id) ?? null);
  const branchState = (v: number): PathBranch['state'] => branchOf(v)?.state ?? (marks.skipped?.[v] === true ? 'skipped' : marks.state[v] === 'done' ? 'done' : 'new');
  /* 2026-11-05 (Prompt 23, B5) — aufgeklappte Zweige: ihre eigenen Abstecher als kleine Zweige daneben. */
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(() => new Set());
  const full = size === 'full';
  const R = full ? 20 : 15;
  const CW = full ? 84 : 60;
  const RH = full ? 72 : 54;
  const pad = R * 1.6 + 10;
  /*
    2026-11-05 (Prompt 23, B1/B8) — DIE ZWEIGE: neben ihrem Anker, aussen ihr Name. Schmal (Telefon, kleiner Rahmen) rücken
    sie näher an die Linie und der Name wird kürzer — die Karte passt, ohne seitlich zu rollen.
  */
  const [roomW, setRoomW] = useState(0);
  const narrowB = roomW > 0 && roomW < 480;
  const nodeX = (v: number): number => {
    const nd = model.nodes[v];
    const b = nd.branch;
    if (b === undefined || !narrowB) return nd.x;
    return model.nodes[b.anchor].x + b.side * (0.95 + 0.8 * Math.floor(b.slot / 2));
  };
  /* Platz für den Namen in der Breite der Karte (er darf darüber hinaus bis an den Rand der Fläche). */
  /* Links braucht der Name eigenen Platz; rechts reicht er in die Spalte der Namen, wo dort nichts steht. */
  const labelLeft = narrowB ? 0.95 : 1.25;
  const labelRight = 0.35;
  const extent = useMemo(() => {
    if (!model.nodes.some((nd) => nd.branch !== undefined)) return { x0: model.x0, x1: model.x1 };
    let lo = Infinity; let hi = -Infinity;
    model.nodes.forEach((nd, v) => {
      const x = nodeX(v);
      lo = Math.min(lo, x - 0.5 - (nd.branch?.side === -1 ? labelLeft : 0));
      hi = Math.max(hi, x + 0.5 + (nd.branch?.side === 1 ? labelRight : 0));
    });
    for (const r of model.routes) for (const [x] of r) { lo = Math.min(lo, x - 0.5); hi = Math.max(hi, x + 0.5); }
    return { x0: lo, x1: hi };
  }, [model, narrowB]); // eslint-disable-line react-hooks/exhaustive-deps
  const W = Math.max(1, (extent.x1 - extent.x0 - 1) * CW + 2 * pad);
  const H = Math.max(1, Math.max(0, model.levels - 1) * RH + 2 * pad);
  const [openOwn, setOpenOwn] = useState(true);
  const open = openIn ?? openOwn;
  const setOpen = (v: boolean) => { setOpenOwn(v); onOpen?.(v); };
  const [chosen, setChosen] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const [whole, setWhole] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const timers = useRef<{ open: number | null; close: number | null }>({ open: null, close: null });
  const clear = () => { for (const k of ['open', 'close'] as const) if (timers.current[k] !== null) { window.clearTimeout(timers.current[k]!); timers.current[k] = null; } };
  useEffect(() => clear, []);
  const section = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  /* Die Fläche der Zeichnung: so gross wie das SVG — Namen und Zähler stehen in ihren Koordinaten. */
  const plane = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  /* Wie viel Platz da ist: die Breite des Rahmens; die Höhe nur, wenn der Rahmen eine hat (CSS max-height, sonst rollt die Seite). */
  const [room, setRoom] = useState<{ w: number; h: number }>({ w: 0, h: Infinity });
  useLayoutEffect(() => {
    const el = frame.current;
    const sc = scroller.current;
    if (el === null) return undefined;
    const measure = () => {
      const mh = sc === null ? Number.NaN : Number.parseFloat(getComputedStyle(sc).maxHeight);
      const h = Number.isFinite(mh) ? mh : Infinity;
      /* 2026-11-05 (Prompt 23, B8) — die Breite innen (ohne die Leiste zum Rollen nach unten): sonst rollte die Karte um ihre Breite seitwärts. */
      const w = sc !== null && sc.clientWidth > 0 ? Math.min(el.clientWidth, sc.clientWidth + 2) : el.clientWidth;
      setRoom((was) => (was.w === w && was.h === h ? was : { w, h }));
      setRoomW(w);
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    if (sc !== null) ro?.observe(sc);
    return () => ro?.disconnect();
  }, [whole, full, open]);
  const labels = marks.current >= 0 || marks.forks.size > 0;
  const avail = Math.max(1, room.w - 2);
  /* Lesbar: ein Sechseck nie kleiner als 13–14 px im Halbmesser. */
  const minS = (full ? 14 : 13) / R;
  /* 2026-11-05 (Prompt 23, B8) — schmal mit Zweigen: die Spalte der Namen etwas schmaler (sie bricht um), damit nichts seitwärts rollt. */
  const colMin = narrowB && model.nodes.some((nd) => nd.branch !== undefined) ? 84 : 112;
  const fitW = room.w <= 0 ? 1 : Math.max(0.05, (avail - (labels ? colMin : 0)) / W);
  const base = Math.min(1, Math.max(minS, fitW));
  const fitAll = Math.min(fitW, Number.isFinite(room.h) ? Math.max(0.05, (room.h - 8) / H) : Infinity);
  const canFit = fitAll < base - 1e-3;
  const steps = Math.max(1, Math.ceil(Math.log2(1.5 / base)) + 1);
  const zMin = canFit ? -1 : 0;
  const s = zoom < 0 ? fitAll : Math.min(1.5, base * 2 ** Math.min(zoom, steps - 1));
  const gW = W * s;
  const gH = H * s;
  const labelCol = labels ? Math.max(colMin, Math.min(208, avail - gW)) : 0;
  const cW = Math.max(avail, gW + labelCol);
  /* Die Karte mittig im Platz links der Spalte der Namen. */
  const ox = Math.max(0, (cW - labelCol - gW) / 2);
  const toPx = (x: number, L: number) => ({ x: ox + (pad + (x - extent.x0 - 0.5) * CW) * s, y: (H - pad - L * RH) * s });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const at = useMemo(() => model.nodes.map((nd, v) => toPx(nodeX(v), nd.level)), [model, pad, CW, RH, H, s, ox, extent, narrowB]);
  const r = R * s;
  const labelX = ox + gW - pad * s + r * 1.35 + 10;
  const labelW = Math.max(colMin < 112 ? 60 : 96, cW - labelX - 4);
  useLayoutEffect(() => {
    const c = canvas.current;
    /* 2026-11-05 — mindestens so breit wie die Karte; „Co dalej" darüber darf sie breiter machen (eine Fläche, ein Ziehen). */
    if (c !== null) { c.style.width = ''; c.style.minWidth = `${Math.ceil(cW)}px`; }
    const p = plane.current;
    if (p !== null) { p.style.width = `${Math.ceil(cW)}px`; p.style.height = `${Math.ceil(gH)}px`; }
  }, [cW, gH, open, whole]);

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

  const centered = useRef(false);
  /* „Jetzt dran" ins Bild, wenn die Karte im Rahmen rollt (vergrössert oder höher als er). */
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el === null || marks.current < 0 || !open) return;
    const p = at[marks.current];
    if (p === undefined) return;
    const top = (canvas.current?.offsetHeight ?? 0) - gH + p.y;
    /* 2026-11-05 — die Karte steht mittig unter „Co dalej" (das sie breiter machen kann): x in der ganzen Fläche. */
    const x = (plane.current?.offsetLeft ?? 0) + p.x;
    const outY = el.scrollHeight > el.clientHeight + 1 && (top < el.scrollTop + 24 || top > el.scrollTop + el.clientHeight - 24);
    const outX = el.scrollWidth > el.clientWidth + 1 && (x < el.scrollLeft + 16 || x > el.scrollLeft + el.clientWidth - 16);
    const first = !centered.current && el.scrollWidth > el.clientWidth + 1;
    centered.current = true;
    if (outY || outX || first || zoom !== 0) el.scrollTo({ left: Math.max(0, x - el.clientWidth / 2), top: Math.max(0, top - el.clientHeight / 2) });
  }, [zoom, marks.current, open, s, model, next?.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (t?.closest?.('.cg-pm-pop') || t?.closest?.('[data-path-node]') || t?.closest?.('[data-path-next-item]')) return;
      setChosen(null);
      setHover(null);
    };
    window.addEventListener('keydown', esc);
    window.addEventListener('pointerdown', outside);
    return () => { window.removeEventListener('keydown', esc); window.removeEventListener('pointerdown', outside); };
  }, [shown]);

  /* Ziehen zum Verschieben (wenn die Karte im Rahmen rollt). */
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    if (el === null || (el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1) || e.pointerType !== 'mouse' || (e.target as Element).closest('[data-path-node], [data-path-next-item], .cg-pm-pop')) return;
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
  const stepsNow = useRef({ steps, zMin });
  stepsNow.current = { steps, zMin };
  /* Ctrl + Rad: vergrössern (ein eigener Hörer — React hört das Rad nur passiv). */
  useEffect(() => {
    const el = scroller.current;
    if (el === null) return undefined;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => Math.max(stepsNow.current.zMin, Math.min(stepsNow.current.steps - 1, z + (e.deltaY < 0 ? 1 : -1))));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [open, whole]);

  /* Die Namen neben der Karte: untereinander, nie übereinander (gemessen nach dem Zeichnen). */
  useLayoutEffect(() => {
    const el = plane.current;
    if (el === null) return;
    const list = [...el.querySelectorAll<HTMLElement>('[data-path-label]')].map((x) => ({ x, y: Number(x.dataset.pathLabel), h: x.offsetHeight })).sort((a, b) => a.y - b.y);
    let bottom = -Infinity;
    for (const it of list) {
      const top = Math.max(it.y - it.h / 2, bottom + 4, 0);
      it.x.style.top = `${Math.round(top)}px`;
      bottom = top + it.h;
    }
  });

  const nodeOf = (target: EventTarget | null): string | null => {
    const el = (target as Element | null)?.closest?.('[data-path-node], [data-path-next-item]');
    if (el == null) return null;
    const own = el.getAttribute('data-path-node');
    return own ?? `${NEXT}${el.getAttribute('data-path-next-item') ?? ''}`;
  };
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
    if (id.startsWith(NEXT)) { setChosen(chosen === id ? null : id); return; }
    const v = model.index.get(id);
    if (v === undefined) return;
    if (chosen === id) {
      if (onPick !== undefined && (marks.state[v] !== 'locked' || v === marks.current) && !optional(v)) { onPick(id); setChosen(null); setHover(null); return; }
      setChosen(null);
      return;
    }
    setChosen(id);
  };
  const key = (e: KeyboardEvent<HTMLElement | SVGSVGElement>) => {
    const id = nodeOf(e.target);
    if (id === null) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); }
  };

  const story = model.nodes.some((nd) => nd.kind !== undefined);
  const summary = T.summary(marks.done, marks.total, noun);
  const currentNode = marks.current >= 0 ? model.nodes[marks.current] : undefined;
  const currentLabel = currentNode?.label ?? null;
  const zoomBar = (
    <span className="cg-pm-tools" role="group" aria-label={T.pathTitle}>
      <button type="button" className="cg-pm-tool" onClick={() => setZoom((z) => Math.max(zMin, z - 1))} disabled={zoom <= zMin} aria-label={T.zoomOut} data-path-zoom="out">−</button>
      <button type="button" className="cg-pm-tool" onClick={() => setZoom((z) => Math.min(steps - 1, z + 1))} disabled={zoom >= steps - 1} aria-label={T.zoomIn} data-path-zoom="in">+</button>
      <button type="button" className="cg-pm-tool is-text" onClick={() => setZoom(canFit ? -1 : 0)} disabled={canFit ? zoom === -1 : zoom === 0} data-path-zoom="fit">{T.fit}</button>
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
      <span className="cg-muted" data-path-summary={`${marks.done} z ${marks.total}`} data-path-summary-text={summary}>
        {summary}{currentLabel !== null && !open ? <> · {T.now}: {currentLabel}</> : null}
      </span>
      {open && !whole && tools}
      {open && zoomBar}
    </div>
  );
  if (model.nodes.length === 0) return null;

  const hl = highlight !== null && highlight.size > 0 ? highlight : null;
  const nextItem = shown !== null && shown.startsWith(NEXT) ? next?.find((x) => x.id === shown.slice(NEXT.length)) : undefined;
  const pop = shown === null || shown.startsWith(NEXT) ? undefined : model.index.get(shown);
  const popFork = pop === undefined ? undefined : marks.forks.get(pop);
  const loopsOut = new Set((model.loops ?? []).map(([a]) => a));
  const shapeOf = (kind: PartKind | undefined, rr: number) => (kind === 'fork' ? <polygon className="cg-pm-hex" points={DIAMOND(rr * 1.05)} />
    : kind === 'start' || kind === 'end' ? <circle className="cg-pm-hex" r={rr * 0.86} />
    : <polygon className="cg-pm-hex" points={HEX(rr)} />);
  const words = (v: number): string => {
    const nd = model.nodes[v];
    const f = marks.forks.get(v);
    return [nd.label, v === marks.current ? T.now : '', nd.kind === undefined ? '' : T.part(nd, marks.ask?.[v]), nd.auto === true ? T.autoKind : '', optional(v) ? T.optionalKind : stateWords[marks.state[v]], marks.due[v] ? T.dueMark : '', f === undefined ? '' : T.fork(f)].filter(Boolean).join(' · ');
  };
  const nowAt = currentNode === undefined ? null : at[marks.current];
  /* Die Zeile von einem Knoten zur Spalte der Namen (unter den Knoten gezeichnet). */
  const leader = (v: number, cls: string) => {
    const p = at[v];
    const rr = v === marks.current ? r * 1.3 : r;
    return <line key={`${cls}${v}`} className={`cg-pm-leader ${cls}`} x1={(p.x + rr).toFixed(1)} y1={p.y.toFixed(1)} x2={(labelX - 3).toFixed(1)} y2={p.y.toFixed(1)} />;
  };
  /* Über dem Ende (oder dem obersten Knoten): die Linie zur Reihe dessen, was danach kommt. */
  const topNode = (() => {
    const end = model.nodes.findIndex((nd) => nd.kind === 'end');
    if (end >= 0) return end;
    let best = -1;
    model.nodes.forEach((nd, v) => { if (best < 0 || nd.level > model.nodes[best].level) best = v; });
    return best;
  })();

  /*
    2026-11-05 (Prompt 23, B1–B5) — EIN ZWEIG: ein grösseres Sechseck neben der Linie, aussen sein Name (gekürzt, ganz im
    Fenster) und darunter seine Fragen; nicht betreten blass und gestrichelt, ausgelassen dünn („pominięte"), begonnen halb
    gefüllt mit „3/8", ukończony gefüllt mit Haken. Aufgeklappt („Rozwiń"): die Abstecher seiner Erzählung als kleine
    Zweige des Zweiges.
  */
  const branchNode = (v: number) => {
    const nd = model.nodes[v];
    const b = nd.branch!;
    const p = at[v];
    const current = v === marks.current;
    const rr = current ? r * 1.3 : r * 1.12;
    const info = branchOf(v);
    const bs = branchState(v);
    const side = b.side;
    const nameText = plainOf(info?.name ?? nd.label);
    /* So viel Platz bis zum Rand der Fläche (rechts: bis zur Spalte der Namen). */
    /* Wie weit ein Name der Spalte rechts nach oben und unten reicht (bis drei Zeilen; schmal grösser). */
    const reach = narrowB ? 56 : 34;
    const busy = (marks.current >= 0 && marks.current !== v && Math.abs(at[marks.current].y - p.y) < reach) || [...marks.forks.keys()].some((f) => Math.abs(at[f].y - p.y) < reach);
    const room = side === 1 ? (labels && busy ? labelX - 8 : cW - 4) - (p.x + rr + 5) : p.x - rr - 9;
    const chars = Math.floor(room / (full ? 6.6 : 5.9));
    const subs = info?.sub ?? [];
    const open = unfolded.has(nd.id) && subs.length > 0;
    const counter = bs === 'progress' && info?.done !== undefined && info.total !== undefined && info.total > 0 ? `${info.done}/${info.total}` : null;
    const q = info?.questions !== undefined && info.questions > 0 ? T.branchQuestions(info.questions, info.known ?? 0) : '';
    return (
      <g key={nd.id} className={`cg-pm-node is-branch is-b-${bs}${current ? ' is-current' : ''}${hl?.has(nd.id) === true ? ' is-hl' : ''}${shown === nd.id ? ' is-on' : ''}`}
        transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`} data-path-node={nd.id} data-path-branch={bs} data-path-state={bs === 'skipped' ? 'skipped' : marks.state[v]} data-path-current={current ? '1' : '0'}
        data-path-kind="detour" data-path-side={side} data-path-anchor={model.nodes[b.anchor].id} {...(counter === null ? {} : { 'data-path-branch-count': counter })} {...(open ? { 'data-path-unfolded': subs.length } : {})}
        tabIndex={0} role="button" aria-label={[nameText, current ? T.now : '', T.branchLegend, info?.where ?? '', bs === 'new' ? T.branchNew : bs === 'skipped' ? T.branchSkipped : bs === 'progress' ? T.branchProgress(info?.done ?? 0, info?.total ?? 0) : T.branchDone, q].filter(Boolean).join(' · ')} aria-pressed={chosen === nd.id}>
        <circle className="cg-pm-hit" r={Math.max(rr * 1.15, 13)} />
        {current && <polygon className="cg-pm-halo" points={HEX(rr + Math.max(3, 5 * s))} />}
        {bs === 'progress' && <clipPath id={`${uid}-b${v}`}><rect x={-rr} y={0} width={rr * 2} height={rr} /></clipPath>}
        <polygon className="cg-pm-hex" points={HEX(rr)} />
        {bs === 'progress' && <polygon className="cg-pm-hex-fill" points={HEX(rr)} clipPath={`url(#${uid}-b${v})`} />}
        {bs === 'done' ? <path className="cg-pm-icon is-check" d={`M${(-rr * 0.38).toFixed(1)},0 L${(-rr * 0.1).toFixed(1)},${(rr * 0.3).toFixed(1)} L${(rr * 0.42).toFixed(1)},${(-rr * 0.32).toFixed(1)}`} />
          : counter !== null ? <text className="cg-pm-branch-count" textAnchor="middle" dominantBaseline="central">{counter}</text>
          : <path className="cg-pm-icon" d={kindIcon('detour', rr)} />}
        {chars >= 3 && (
          /* Aufgeklappt stehen dort die kleinen Zweige: der Name rückt unter das Sechseck. */
          <text className="cg-pm-branch-name" x={open ? 0 : (side * (rr + 5)).toFixed(1)} y={open ? (rr + 10).toFixed(1) : q !== '' && full ? -3 : 0} textAnchor={open ? 'middle' : side === 1 ? 'start' : 'end'} dominantBaseline="central">
            {cut(nameText, chars)}
            {q !== '' && full && !open && <tspan className="cg-pm-branch-q" x={(side * (rr + 5)).toFixed(1)} dy="1.25em">{cut(q, chars + 4)}</tspan>}
          </text>
        )}
        {open && subs.map((sb, k) => {
          const span = Math.min(RH * s * 0.36, (RH * s * 1.1) / Math.max(1, subs.length - 1));
          const dy = (k - (subs.length - 1) / 2) * span;
          const dx = side * (rr * 1.25 + Math.min(CW * s * 0.55, 34));
          const sr = Math.max(6, rr * 0.5);
          return (
            <g key={sb.id} className={`cg-pm-sub is-b-${sb.state}`} data-path-sub={sb.id} data-path-sub-state={sb.state}>
              <path className={`cg-pm-way is-arm is-arm-${sb.state}`} d={`M${(side * rr * 0.9).toFixed(1)},0 C${(dx * 0.5).toFixed(1)},0 ${(dx * 0.5).toFixed(1)},${dy.toFixed(1)} ${(dx - side * sr).toFixed(1)},${dy.toFixed(1)}`} />
              <polygon className="cg-pm-hex" points={HEX(sr)} transform={`translate(${dx.toFixed(1)},${dy.toFixed(1)})`} />
              {sb.state === 'done' && <path className="cg-pm-icon is-check" transform={`translate(${dx.toFixed(1)},${dy.toFixed(1)})`} d={`M${(-sr * 0.38).toFixed(1)},0 L${(-sr * 0.1).toFixed(1)},${(sr * 0.3).toFixed(1)} L${(sr * 0.42).toFixed(1)},${(-sr * 0.32).toFixed(1)}`} />}
              <text className="cg-pm-sub-name" x={(dx + side * (sr + 4)).toFixed(1)} y={dy.toFixed(1)} textAnchor={side === 1 ? 'start' : 'end'} dominantBaseline="central">{cut(plainOf(sb.name), Math.max(4, Math.floor(chars * 0.7)))}<title>{plainOf(sb.name)}</title></text>
            </g>
          );
        })}
      </g>
    );
  };
  const returnV = returnAt === null ? -1 : model.index.get(returnAt) ?? -1;

  /* Die Legende: genau die Zeichen, die auf dieser Karte vorkommen. */
  const kinds = new Set(model.nodes.map((nd) => nd.kind).filter((k): k is PartKind => k !== undefined));
  const states = new Set(marks.state.filter((_, v) => !optional(v)));
  const legendItems = (
    <ul className="cg-pm-legend" data-path-legend="">
      {(['start', 'read', 'learn', 'mixed', 'review', 'fork', 'detour', 'end'] as const).filter((k) => kinds.has(k)).map((k) => (
        <li key={k} data-path-legend-kind={k}>
          <svg className="cg-pm-legend-icon" viewBox="-12 -12 24 24" aria-hidden>{shapeOf(k, 10)}<path className="cg-pm-icon" d={kindIcon(k, 10)} /></svg>{k === 'detour' && model.nodes.some((nd) => nd.branch !== undefined) ? T.branchLegend : T.kinds[k]}
        </li>
      ))}
      {model.nodes.some((nd) => nd.auto === true) && (
        <li data-path-legend-kind="auto"><svg className="cg-pm-legend-icon" viewBox="-12 -12 24 24" aria-hidden><circle className="cg-pm-auto" r={9} /><path className="cg-pm-auto-icon" d={kindIcon('auto', 9)} /></svg>{T.autoKind}</li>
      )}
      {(model.loops ?? []).length > 0 && (
        <li data-path-legend-kind="loop"><svg className="cg-pm-legend-icon" viewBox="-12 -12 24 24" aria-hidden><path className="cg-pm-loop" d="M6,-9 C-12,-9 -12,9 6,9" markerEnd={`url(#${uid}-arrow)`} /></svg>{T.loopKind}</li>
      )}
      {states.has('done') && <li data-path-legend-state="done"><svg className="cg-pm-legend-icon is-done" viewBox="-12 -12 24 24" aria-hidden>{shapeOf(story ? 'read' : undefined, 10)}</svg>{T.done}</li>}
      {states.has('available') && <li data-path-legend-state="available"><svg className="cg-pm-legend-icon is-available" viewBox="-12 -12 24 24" aria-hidden>{shapeOf(story ? 'read' : undefined, 10)}</svg>{T.open.split(' — ')[0]}</li>}
      {states.has('locked') && <li data-path-legend-state="locked"><svg className="cg-pm-legend-icon is-locked" viewBox="-12 -12 24 24" aria-hidden>{shapeOf(story ? 'read' : undefined, 10)}</svg>{T.locked.split(' — ')[0]}</li>}
      {(marks.skipped ?? []).some(Boolean) && <li data-path-legend-state="skipped"><svg className="cg-pm-legend-icon is-skipped" viewBox="-12 -12 24 24" aria-hidden>{shapeOf('detour', 10)}<path className="cg-pm-icon" d={kindIcon('detour', 10)} /></svg>{T.skippedKind}</li>}
      {model.nodes.some((_, v) => optional(v)) && <li data-path-legend-state="optional"><svg className="cg-pm-legend-icon is-optional" viewBox="-12 -12 24 24" aria-hidden>{shapeOf(story ? 'read' : undefined, 10)}</svg>{T.optionalKind}</li>}
      {marks.current >= 0 && <li data-path-legend-state="current"><svg className="cg-pm-legend-icon is-current" viewBox="-12 -12 24 24" aria-hidden><polygon className="cg-pm-halo" points={HEX(10)} /></svg>{T.now}</li>}
      {/* 2026-11-05 (Prompt 23, Nachtrag) — was danach kommt: violette Punkte über dem Ende. */}
      {next !== undefined && next.length > 0 && <li data-path-legend-state="next"><svg className="cg-pm-legend-icon cg-pm-next-icon" viewBox="-12 -12 24 24" aria-hidden><polygon className="cg-pm-hex" points={HEX(10)} /></svg>{T.nextLegend}</li>}
      {marks.due.some(Boolean) && <li data-path-legend-state="due"><svg className="cg-pm-legend-icon" viewBox="-12 -12 24 24" aria-hidden><circle className="cg-pm-due" r={5} /></svg>{T.dueMark}</li>}
    </ul>
  );
  /* Wenig Platz: die Legende hinter einem Knopf. */
  const foldLegend = room.w > 0 && room.w < 380 && !whole;
  const legend = foldLegend ? (
    <div className="cg-pm-legend-box">
      <button type="button" className="cg-pm-tool is-text" aria-expanded={legendOpen} onClick={() => setLegendOpen(!legendOpen)} data-path-legend-toggle="">{T.legend}</button>
      {legendOpen && legendItems}
    </div>
  ) : legendItems;

  const nextRow = next !== undefined && next.length > 0 && (
    <div className="cg-pm-next" data-path-next={next.length} role="group" aria-label={T.whatNext}>
      <div className="cg-pm-next-list">
        {next.map((it) => (
          <button key={it.id} type="button" className={`cg-pm-next-item${it.state === 'done' ? ' is-done' : it.ready ? ' is-ready' : ' is-wait'}${it.state === 'started' ? ' is-started' : ''}${it.kind === 'map' ? ' is-map' : ''}${shown === `${NEXT}${it.id}` ? ' is-on' : ''}`}
            data-path-next-item={it.id} data-path-next-ready={it.ready ? '1' : '0'} data-path-next-kind={it.kind} data-path-next-state={it.state ?? 'new'} aria-pressed={chosen === `${NEXT}${it.id}`} title={[plainOf(it.label), it.note, it.work].filter(Boolean).join(' · ')}
            onClick={() => pick(`${NEXT}${it.id}`)} onPointerEnter={enter} onPointerLeave={leave}>
            <svg className="cg-pm-next-icon" viewBox="-12 -12 24 24" aria-hidden>
              {it.kind === 'map' ? <circle className="cg-pm-hex" r={10} /> : <polygon className="cg-pm-hex" points={HEX(10.5)} />}
              <path className="cg-pm-icon" d={kindIcon(it.kind === 'map' ? 'map' : it.kind === 'story' ? 'read' : 'learn', 10)} />
              {!it.ready && it.state !== 'done' && <circle className="cg-pm-due" cx={7} cy={-7} r={3.5} />}
              {it.state === 'done' && <g className="cg-pm-next-check" transform="translate(7,-7)"><circle r={4.6} /><path d="M-2.2,0.1 L-0.6,1.8 L2.4,-1.6" /></g>}
            </svg>
            <span className="cg-pm-next-text">
              <span className="cg-pm-next-status">{it.state === 'done' ? `✓ ${T.nextDone}` : !it.ready ? T.nextNotYet : it.state === 'started' ? T.nextStarted : T.nextReady}</span>
              <span className="cg-pm-next-name"><TexText text={it.label} /></span>
              {it.work && <span className="cg-pm-next-kind">{it.work}</span>}
              {it.optional && <span className="cg-pm-next-kind">{T.nextOptional}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const anchorOf = (id: string) => () => section.current?.querySelector(id.startsWith(NEXT) ? `[data-path-next-item="${CSS.escape(id.slice(NEXT.length))}"]` : `[data-path-node="${CSS.escape(id)}"]`) ?? null;
  const popHandlers = {
    onPointerEnter: () => clear(),
    onPointerLeave: (e: ReactPointerEvent) => { if (e.pointerType === 'mouse' && chosen === null) { clear(); timers.current.close = window.setTimeout(() => setHover(null), 260); } }
  };

  const body = (
    <section ref={section} className={`cg-pm${full ? ' is-full' : ' is-small'}${open ? '' : ' is-closed'}${whole ? ' is-whole' : ''}`} data-path-map={model.nodes.length} data-path-source={model.source}
      data-path-fit={fitAll.toFixed(3)} data-path-scale={s.toFixed(3)} data-path-zoomed={zoom === 0 ? '0' : '1'} {...(whole ? { role: 'dialog', 'aria-label': title ?? T.pathTitle } : {})}>
      {head}
      {open && next !== undefined && next.length > 0 && <div className="cg-pm-next-heading">
        <span className="cg-pm-next-h">{T.whatNext}</span>
        <span className="cg-pm-next-hint">{T.nextMapHint}</span>
      </div>}
      {open && (
        <div ref={frame} className="cg-pm-frame">
          <div ref={scroller} className={`cg-pm-scroll${zoom !== 0 ? ' is-zoomed' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <div ref={canvas} className="cg-pm-canvas">
              {nextRow}
              <div ref={plane} className="cg-pm-plane">
                <svg className="cg-pm-svg" width={Math.ceil(cW)} height={Math.ceil(gH)} viewBox={`0 0 ${Math.ceil(cW)} ${Math.ceil(gH)}`} role="group"
                  aria-label={T.pathAria(summary, currentLabel)}
                  onPointerOver={enter} onPointerOut={leave} onClick={(e) => { if (drag.current?.moved) return; const id = nodeOf(e.target); if (id !== null) pick(id); }} onKeyDown={key}>
                  <defs>
                    <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                      <path className="cg-pm-loop-head" d="M0,0 L10,5 L0,10 z" />
                    </marker>
                  </defs>
                  <g className="cg-pm-ways" aria-hidden>
                    {model.edges.map(([p, c], i) => {
                      /* 2026-11-05 (Prompt 23, B1) — ein Arm eines Zweiges: von der Seite des Ankers hinaus, zurück zur Linie. */
                      const arm = model.nodes[p].branch !== undefined ? p : model.nodes[c].branch !== undefined ? c : -1;
                      const pts = arm >= 0 ? [at[p], at[c]] : (model.routes[i] ?? [[model.nodes[p].x, model.nodes[p].level], [model.nodes[c].x, model.nodes[c].level]]).map(([x, L]) => toPx(x, L));
                      const k = wayKey(i);
                      if (arm >= 0) {
                        const a = at[p]; const b = at[c];
                        const out = arm === c;
                        const ra = (p === marks.current ? r * 1.3 : r) * (out ? 0.95 : 1.12);
                        const rb = (c === marks.current ? r * 1.3 : r) * (out ? 1.12 : 0.95);
                        const side = model.nodes[arm].branch!.side;
                        /* Hinaus: von der Seite des Ankers waagrecht los, im Bogen zum Zweig; zurück: vom Zweig hinauf in die Linie. */
                        const d = out
                          ? `M${(a.x + side * ra * 0.86).toFixed(1)},${(a.y - ra * 0.3).toFixed(1)} C${(b.x - side * rb * 1.2).toFixed(1)},${(a.y - ra * 0.3).toFixed(1)} ${b.x.toFixed(1)},${(b.y + rb * 2).toFixed(1)} ${b.x.toFixed(1)},${(b.y + rb * 0.9).toFixed(1)}`
                          : `M${a.x.toFixed(1)},${(a.y - ra * 0.9).toFixed(1)} C${a.x.toFixed(1)},${(b.y + rb * 1.6).toFixed(1)} ${(b.x + side * rb * 1.4).toFixed(1)},${(b.y + rb * 0.4).toFixed(1)} ${(b.x + side * rb * 0.86).toFixed(1)},${(b.y + rb * 0.3).toFixed(1)}`;
                        const bs = branchState(arm);
                        return <path key={k} className={`cg-pm-way is-arm is-arm-${bs}${marks.lit[i] ? ' is-lit' : ''}${hl !== null && hl.has(model.nodes[arm].id) ? ' is-hl' : ''}`} pathLength={1} d={d} data-path-way={k} data-path-arm={bs} />;
                      }
                      let d = `M${pts[0].x.toFixed(1)},${(pts[0].y - r * 0.9).toFixed(1)}`;
                      for (let j = 1; j < pts.length; j += 1) {
                        const a = j === 1 ? { x: pts[0].x, y: pts[0].y - r * 0.9 } : pts[j - 1];
                        const b = j === pts.length - 1 ? { x: pts[j].x, y: pts[j].y + r * 0.9 } : pts[j];
                        const mid = (a.y + b.y) / 2;
                        d += ` C${a.x.toFixed(1)},${mid.toFixed(1)} ${b.x.toFixed(1)},${mid.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
                      }
                      const on = hl !== null && hl.has(model.nodes[p].id) && hl.has(model.nodes[c].id);
                      const faded = optional(p) || optional(c);
                      return (
                        <path key={k} className={`cg-pm-way${marks.lit[i] && !faded ? ' is-lit' : ''}${marks.taken[i] ? ' is-taken' : ''}${glow.lit.has(k) ? ' is-new' : ''}${on ? ' is-hl' : ''}${faded ? ' is-optional' : ''}`} pathLength={1} d={d}
                          data-path-way={k} data-path-lit={marks.lit[i] ? '1' : '0'} data-path-taken={marks.taken[i] ? '1' : '0'} />
                      );
                    })}
                    {/* 2026-11-04 (Prompt 11) — die Wege zurück: ein Bogen an der Seite in die Gabel, mit Pfeil. */}
                    {(model.loops ?? []).map(([a, b]) => {
                      const p = at[a];
                      const q = at[b];
                      const { side, gap } = loopSide(model, a, b);
                      const ra = (a === marks.current ? r * 1.3 : r) * 0.92;
                      const rb = r * 1.12;
                      const bulge = Math.max(8, Math.min(CW * 0.42, CW * 0.45 * gap, pad) * s);
                      const sx = p.x + side * ra;
                      const ex = q.x + side * rb;
                      return (
                        <path key={`loop${a}>${b}`} className={`cg-pm-loop${optional(a) ? ' is-optional' : ''}`} markerEnd={`url(#${uid}-arrow)`}
                          d={`M${sx.toFixed(1)},${p.y.toFixed(1)} C${(sx + side * bulge).toFixed(1)},${p.y.toFixed(1)} ${(ex + side * bulge).toFixed(1)},${q.y.toFixed(1)} ${ex.toFixed(1)},${q.y.toFixed(1)}`}
                          data-path-loop={`${model.nodes[a].id}>${model.nodes[b].id}`} />
                      );
                    })}
                    {next !== undefined && next.length > 0 && topNode >= 0 && (
                      <line className="cg-pm-next-way" x1={at[topNode].x.toFixed(1)} y1={(at[topNode].y - r).toFixed(1)} x2={at[topNode].x.toFixed(1)} y2="0" />
                    )}
                    {nowAt !== null && leader(marks.current, 'is-now')}
                    {[...marks.forks.keys()].filter((v) => v !== marks.current).map((v) => leader(v, 'is-fork'))}
                  </g>
                  <g className="cg-pm-nodes">
                    {model.nodes.map((nd, v) => {
                      const p = at[v];
                      const state = marks.state[v];
                      const current = v === marks.current;
                      const opt = optional(v);
                      if (nd.branch !== undefined) return branchNode(v);
                      const rr = current ? r * 1.3 : r;
                      return (
                        <g key={nd.id} className={`cg-pm-node is-${opt ? 'optional' : state}${nd.kind === undefined ? '' : ` is-${nd.kind}`}${current ? ' is-current' : ''}${marks.due[v] ? ' is-due' : ''}${glow.done.has(nd.id) ? ' is-new' : ''}${hl?.has(nd.id) === true ? ' is-hl' : ''}${shown === nd.id ? ' is-on' : ''}${nd.auto === true ? ' is-auto' : ''}${marks.skipped?.[v] === true ? ' is-skipped' : ''}`}
                          transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`} data-path-node={nd.id} data-path-state={opt ? 'optional' : marks.skipped?.[v] === true ? 'skipped' : state} data-path-current={current ? '1' : '0'}
                          data-path-kind={nd.kind ?? 'entry'} data-path-level={nd.level} data-path-x={nd.x} {...(nd.auto === true ? { 'data-path-auto': '1' } : {})} {...(loopsOut.has(v) ? { 'data-path-loops': '1' } : {})}
                          tabIndex={0} role="button" aria-label={words(v)} aria-pressed={chosen === nd.id}>
                          <circle className="cg-pm-hit" r={Math.max(rr * 1.1, 12)} />
                          {current && <polygon className="cg-pm-halo" points={HEX(rr + Math.max(3, 5 * s))} />}
                          {shapeOf(nd.kind, rr)}
                          {nd.kind !== undefined && <path className="cg-pm-icon" d={kindIcon(kindShown(v), rr)} />}
                          {nd.auto === true && (
                            <g transform={`translate(${(rr * 0.72).toFixed(1)},${(rr * 0.66).toFixed(1)})`}>
                              <circle className="cg-pm-auto" r={Math.max(5.5, rr * 0.4)} />
                              <path className="cg-pm-auto-icon" d={kindIcon('auto', Math.max(5.5, rr * 0.4))} />
                            </g>
                          )}
                          {marks.due[v] && <circle className="cg-pm-due" cx={rr * 0.66} cy={-rr * 0.66} r={Math.max(3, rr * 0.22)} />}
                        </g>
                      );
                    })}
                    {/* 2026-11-05 (Prompt 23, B6) — im Abstecher: wo die Linie weitergeht, wenn er zurückkommt. */}
                    {returnV >= 0 && (
                      <g className="cg-pm-return" transform={`translate(${at[returnV].x.toFixed(1)},${at[returnV].y.toFixed(1)})`} data-path-return={model.nodes[returnV].id}>
                        <polygon className="cg-pm-return-ring" points={HEX(r * 1.28)} />
                        <text x={(-r * 1.45).toFixed(1)} y={0} textAnchor="end" dominantBaseline="central">{T.branchReturn}</text>
                      </g>
                    )}
                  </g>
                </svg>
                {nowAt !== null && currentNode !== undefined && (
                  <Label x={labelX} y={nowAt.y} width={labelW} className="cg-pm-now" data="now">
                    <span className="cg-pm-now-tag">{T.now}</span> {currentNode.branch !== undefined ? <TexText text={branchOf(marks.current)?.name ?? currentNode.label} /> : name?.(currentNode.id) ?? <TexText text={currentNode.label} />}
                    {marks.forks.has(marks.current) ? <span className="cg-pm-now-fork"> · {T.fork(marks.forks.get(marks.current)!)}</span> : null}
                  </Label>
                )}
                {[...marks.forks].filter(([v]) => v !== marks.current).map(([v, f]) => (
                  <Label key={v} x={labelX} y={at[v].y} width={labelW} className={`cg-pm-fork is-${marks.state[v]}`} data={`${f.done}/${f.total}`} fork>{T.fork(f)}</Label>
                ))}
              </div>
            </div>
          </div>
          {legend}
        </div>
      )}
      {pop !== undefined && open && (
        <PathPop anchor={anchorOf(model.nodes[pop].id)} bounds={() => section.current?.getBoundingClientRect() ?? null} {...popHandlers}>
          {model.nodes[pop].branch !== undefined ? (() => {
            /* 2026-11-05 (Prompt 23, B4) — ein Zweig: der Name ganz, wo er abzweigt, sein Stand, seine Fragen, „Rozwiń", die Karte des Abstechers. */
            const id = model.nodes[pop].id;
            const info = branchOf(pop);
            const bs = branchState(pop);
            const subs = info?.sub ?? [];
            return (
              <div data-path-pop-branch={bs}>
                <p className="cg-muted">{T.branchLegend}{info?.where === undefined ? '' : ` · ${info.where}`}</p>
                <p className="cg-pm-pop-title"><strong><TexText text={info?.name ?? model.nodes[pop].label} /></strong></p>
                {info?.summary !== undefined && info.summary !== '' && <p data-path-pop-summary="">{info.summary}</p>}
                <p className="cg-pm-pop-state" data-path-pop-state={bs}>{pop === marks.current ? `${T.now} · ` : ''}{bs === 'new' ? T.branchNew : bs === 'skipped' ? T.branchSkipped : bs === 'progress' ? T.branchProgress(info?.done ?? 0, info?.total ?? 0) : T.branchDone}</p>
                {info?.questions !== undefined && info.questions > 0 && <p className="cg-muted" data-path-pop-questions="">{T.branchQuestions(info.questions, info.known ?? 0)}</p>}
                {subs.length > 0 && (
                  <p><button type="button" className="wk-link-btn" aria-expanded={unfolded.has(id)} data-path-unfold={id}
                    onClick={() => setUnfolded((was) => { const nx = new Set(was); if (nx.has(id)) nx.delete(id); else nx.add(id); return nx; })}>{unfolded.has(id) ? T.branchFold : T.branchUnfold(subs.length)}</button></p>
                )}
                {actions?.(id, marks.state[pop])}
              </div>
            );
          })() : (<>
          <p className="cg-pm-pop-title"><strong>{name?.(model.nodes[pop].id) ?? <TexText text={model.nodes[pop].label} />}</strong></p>
          {model.nodes[pop].kind !== undefined && <p data-path-pop-kind={model.nodes[pop].kind} {...(marks.ask === undefined ? {} : { 'data-path-pop-ask': marks.ask[pop] })}>{T.part(model.nodes[pop], marks.ask?.[pop])}</p>}
          {model.nodes[pop].auto === true && <p className="cg-muted" data-path-pop-auto="">{T.autoWhy}</p>}
          <p className="cg-pm-pop-state" data-path-pop-state={optional(pop) ? 'optional' : marks.skipped?.[pop] === true ? 'skipped' : marks.state[pop]}>
            {pop === marks.current ? `${T.now} · ` : ''}{optional(pop) ? T.optionalWhy : marks.skipped?.[pop] === true ? T.detourSkipped : stateWords[marks.state[pop]]}{marks.due[pop] ? ` · ${T.dueMark}` : ''}
          </p>
          {loopsOut.has(pop) && <p className="cg-muted" data-path-pop-loop="">{T.loopWhy}</p>}
          {popFork !== undefined && <p className="cg-muted" data-path-pop-fork="">{T.fork(popFork)}{popFork.mode === 'all' ? T.forkAll : T.forkOne}</p>}
          {marks.state[pop] === 'locked' && !optional(pop) && (
            <p className="cg-muted">{T.firstNeeds}: {model.nodes[pop].needs.filter((q) => marks.state[q] !== 'done').map((q) => plainOf(model.nodes[q].label)).slice(0, 3).join(', ')}</p>
          )}
          {detail?.(model.nodes[pop].id) != null && <p className="cg-muted">{detail(model.nodes[pop].id)}</p>}
          {actions?.(model.nodes[pop].id, marks.state[pop])}
          {onPick !== undefined && chosen === model.nodes[pop].id && (marks.state[pop] !== 'locked' || pop === marks.current) && !optional(pop) && <p className="cg-muted">{T.tapAgain}</p>}
          </>)}
        </PathPop>
      )}
      {nextItem !== undefined && open && (
        <PathPop anchor={anchorOf(`${NEXT}${nextItem.id}`)} bounds={() => section.current?.getBoundingClientRect() ?? null} {...popHandlers}>
          <p className="cg-pm-pop-title"><strong><TexText text={nextItem.label} /></strong></p>
          {nextItem.note !== undefined && <p className="cg-muted">{nextItem.note}</p>}
          {nextItem.work !== undefined && nextItem.work !== '' && <p data-path-pop-work="">{nextItem.work}</p>}
          <p className="cg-pm-pop-state" data-path-pop-next={nextItem.ready ? 'ready' : 'wait'}>{nextItem.state === 'done' ? `✓ ${T.nextDone}` : !nextItem.ready ? T.nextNotYet : nextItem.state === 'started' ? T.detourStarted : T.nextReady}</p>
          {(nextItem.why ?? []).map((w) => <p key={w} className="cg-muted" data-path-pop-why="">{w}</p>)}
          {(nextItem.action !== undefined || nextItem.goalAction !== undefined) && (
            <div className="wk-actions">
              {nextItem.action !== undefined && <button type="button" className={`wk-btn${nextItem.goalAction === undefined ? '' : ' wk-btn-line'}`} onClick={() => { const run = nextItem.action!.run; setChosen(null); setHover(null); run(); }} data-path-next-start={nextItem.id}>{nextItem.action.label}</button>}
              {nextItem.goalAction !== undefined && <button type="button" className="wk-btn" title={T.nextGoalHint} onClick={() => { const run = nextItem.goalAction!.run; setChosen(null); setHover(null); run(); }} data-path-next-goal={nextItem.id}>{nextItem.goalAction.label}</button>}
            </div>
          )}
        </PathPop>
      )}
    </section>
  );
  /* Ganz: über allem, ausserhalb jedes Rahmens (eine Seite, eine Bühne, ein Raster mit eigener Grösse). */
  return whole && typeof document !== 'undefined' ? createPortal(body, document.body) : body;
}

/**
 * Auf welcher Seite ein Weg zurück läuft: aussen, wo sein Knoten neben der Gabel steht; steht er über ihr, auf der Seite, auf
 * der zwischen den beiden Stufen weniger steht (Knoten, Punkte langer Wege) — so kreuzt er nichts.
 */
function loopSide(model: PathModel, a: number, b: number): { readonly side: 1 | -1; readonly gap: number } {
  const from = model.nodes[a];
  const to = model.nodes[b];
  const lo = Math.min(from.level, to.level);
  const hi = Math.max(from.level, to.level);
  const points: (readonly [number, number])[] = [...model.nodes.map((nd) => [nd.x, nd.level] as const), ...model.routes.flatMap((r) => r.slice(1, -1))];
  const near = (dir: 1 | -1) => points.filter(([x, L]) => L > lo && L <= hi && dir * (x - from.x) > 0.1 && dir * (x - from.x) <= 1.05).map(([x]) => Math.abs(x - from.x));
  /* Wie viel Platz bis zum Nächsten auf dieser Seite (in Spalten; 1: frei). */
  const gapOf = (dir: 1 | -1) => Math.min(1, ...near(dir));
  if (Math.abs(from.x - to.x) > 0.25) { const side = from.x > to.x ? 1 : -1; return { side, gap: gapOf(side) }; }
  /* Näheres wiegt schwerer: ein Punkt eines langen Weges eine halbe Spalte daneben mehr als ein Knoten eine ganze. */
  const weight = (dir: 1 | -1) => near(dir).reduce((sum, d) => sum + 1 / d, 0);
  const left = weight(-1);
  const right = weight(1);
  const side: 1 | -1 = Math.abs(left - right) > 1e-9 ? (left < right ? -1 : 1) : from.x <= (model.x0 + model.x1) / 2 ? -1 : 1;
  return { side, gap: gapOf(side) };
}

/** Ein Name oder Zähler in der Spalte rechts der Karte (seine Höhe gleicht der Effekt oben aus). */
function Label({ x, y, width, className, data, fork = false, children }: { x: number; y: number; width: number; className: string; data: string; fork?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    el.style.left = `${Math.round(x)}px`;
    el.style.maxWidth = `${Math.round(width)}px`;
  }, [x, width]);
  return (
    <div ref={ref} className={className} data-path-label={Math.round(y)} {...(fork ? { 'data-path-fork': data } : { 'data-path-now': '' })} aria-hidden>
      {children}
    </div>
  );
}

/**
 * Das Fenster über einem Knoten: über allem (an `document.body`), fest im Bild — über dem Knoten, sonst darunter; seitlich
 * im Rahmen der Karte, wenn er breit genug ist, sonst im Bild. Neu gesetzt bei jedem Rollen und jeder Grössenänderung.
 */
function PathPop({ anchor, bounds, children, onPointerEnter, onPointerLeave }: {
  anchor: () => Element | null;
  bounds: () => DOMRect | null;
  children: ReactNode;
  onPointerEnter: () => void;
  onPointerLeave: (e: ReactPointerEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const place = useRef<() => void>(() => undefined);
  place.current = () => {
    const el = ref.current;
    const a = anchor();
    if (el === null || a === null) return;
    const box = a.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    const panel = bounds();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const m = 8;
    let lo = m;
    let hi = vw - m - w;
    if (panel !== null && panel.width >= w + 2 * m) { lo = Math.max(lo, panel.left + m); hi = Math.min(hi, panel.right - m - w); }
    const left = Math.min(Math.max(box.left + box.width / 2 - w / 2, lo), Math.max(lo, hi));
    const above = box.top - h - 10 >= m;
    const below = box.bottom + h + 10 <= vh - m;
    const top = above ? box.top - h - 10 : below ? box.bottom + 10 : Math.max(m, Math.min(vh - h - m, box.bottom + 10));
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
    el.dataset.side = above ? 'above' : 'below';
  };
  useLayoutEffect(() => { place.current(); });
  useEffect(() => {
    const again = () => place.current();
    window.addEventListener('scroll', again, true);
    window.addEventListener('resize', again);
    const ro = typeof ResizeObserver === 'undefined' || ref.current === null ? null : new ResizeObserver(again);
    if (ref.current !== null) ro?.observe(ref.current);
    return () => { window.removeEventListener('scroll', again, true); window.removeEventListener('resize', again); ro?.disconnect(); };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div ref={ref} className="cg-pm-pop" role="dialog" data-path-pop="" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      {children}
    </div>,
    document.body
  );
}
