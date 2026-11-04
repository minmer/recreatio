/**
 * 2026-10-31 — STATYSTYKI ZNAJOMOŚCI ALS DIAGRAMME (die Zahlen: `knowStats.ts`). Für den Lernenden (Nauka → Postępy,
 * das Ende einer Powtórka — auch auf einer Seite, für die mit dem Link) und für die Lehrerin (alle zusammen und jeder
 * für sich).
 *
 * Gezeichnet von Hand (SVG, gemessene Breite — die Schrift bleibt auf dem Telefon lesbar): ein Diagramm ist EIN
 * Tabulatorhalt, die Pfeiltasten gehen Tag für Tag, Zeiger und Fokus zeigen denselben Hinweis; unter jedem steht seine
 * Tabelle. Farben (geprüft gegen beide Flächen, `cogita.css` `.cg-stats`): eine Reihe blau, die Stufen der Kenntnis eine
 * Rampe von hell nach dunkel (dunkel = sitzt), „jeszcze nie" grau.
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

import type { Card } from './cardBasics';
import { BAND_LABEL, BAND_SAYS, BANDS, cardHistory, classStats, HISTORY_FLOOR, knowStats, type Band, type GroupStat, type HardCard, type KnowStats } from './knowStats';
import { DEFAULT_SPACING, FORGOTTEN, KNOWN, LEVEL_LABEL, levelOfKnowness, type Mark, type Spacing } from './knowness';
import { spacingFor } from './spacing';
import type { AnswerRecord } from './learn';
import { spanText } from './measures';
import { QUESTION_TYPES } from './questionTypes';
import { plainOf } from './schema';
import type { CogitaLibrary } from './store';
import { clipTex } from './texClip';
import { entityName, entityNameTex, percent } from './ui';
import { hasTex } from '../core/tex';
import { TexText } from '../ui/tex/Tex';

/* -- Bausteine ---------------------------------------------------------------------------------------------- */

/** Die Breite eines Elements — gemessen in einem Effekt, beim Drehen und Ziehen neu. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(el);
    return () => watch?.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Eine glatte obere Grenze für die Achse: 1, 2, 5 × 10ⁿ. */
function niceMax(v: number): number {
  if (v <= 1) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

const DATE = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'numeric' });
const DAY_NAME = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' });

export type TipLine = readonly [value: string, label: string];

/**
 * Der Hinweis über einem Punkt — der Wert vorn, die Bezeichnung dahinter. Wo er steht, sagen zwei CSS-Variablen, gesetzt
 * vor dem Zeichnen (kein Sprung im ersten Bild); am Rand rückt er nach innen.
 */
function Tip({ x, y, width, lines }: { x: number; y: number; width: number; lines: readonly TipLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const side = x < width * 0.3 ? ' is-left' : x > width * 0.7 ? ' is-right' : '';
  useLayoutEffect(() => {
    ref.current?.style.setProperty('--tip-x', `${Math.round(x)}px`);
    ref.current?.style.setProperty('--tip-y', `${Math.round(y)}px`);
  }, [x, y]);
  return (
    <div ref={ref} className={`cg-viz-tip${side}`} role="status" data-viz-tip="">
      {lines.map(([value, label], i) => <span key={i} className="cg-viz-tip-line"><strong>{value}</strong> {label}</span>)}
    </div>
  );
}

/** Eine Figur: Titel, ein Satz dazu, das Diagramm — und seine Tabelle (dieselben Werte, ohne Zeiger). */
export function Figure({ title, says, table, children, id }: { title: string; says?: string; table?: ReactNode; children: ReactNode; id: string }) {
  return (
    <figure className="cg-viz" data-viz={id}>
      <figcaption className="cg-viz-head">
        <strong>{title}</strong>
        {says !== undefined && <span className="cg-muted">{says}</span>}
      </figcaption>
      {children}
      {table !== undefined && (
        <details className="cg-viz-table">
          <summary>Tabela</summary>
          {table}
        </details>
      )}
    </figure>
  );
}

/** Ein Punkt über die Zeit: Bezeichnung auf der Achse, Wert, und was der Hinweis sagt. */
export interface Point {
  readonly key: string;
  readonly axis: string;
  readonly value: number;
  readonly tip: readonly TipLine[];
}

const PLOT_H = 140;
const AXIS_H = 22;
const PAD_L = 34;
const PAD_R = 10;
const PAD_T = 10;

/** Pfeiltasten: Punkt für Punkt; Pos1/Ende; Esc schliesst. */
function stepKey(e: KeyboardEvent, at: number | null, n: number): number | null | undefined {
  if (n === 0) return undefined;
  if (e.key === 'ArrowRight') return at === null ? n - 1 : Math.min(n - 1, at + 1);
  if (e.key === 'ArrowLeft') return at === null ? n - 1 : Math.max(0, at - 1);
  if (e.key === 'Home') return 0;
  if (e.key === 'End') return n - 1;
  if (e.key === 'Escape') return null;
  return undefined;
}

/** Welche Achsenbeschriftungen Platz haben: jede k-te, die letzte immer. */
const everyNth = (n: number, plotW: number, room = 46): number => Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / room))));

/** Die Achse links: 0, die Mitte, oben — glatte Zahlen, feine Linien. */
function YAxis({ top, width, y }: { top: number; width: number; y: (v: number) => number }) {
  const ticks = top >= 2 ? [0, Math.round(top / 2), top] : [0, top];
  return (
    <g aria-hidden>
      {ticks.map((t) => (
        <g key={t}>
          <line className={t === 0 ? 'cg-viz-axis' : 'cg-viz-grid'} x1={PAD_L} x2={width - PAD_R} y1={y(t)} y2={y(t)} />
          <text className="cg-viz-tick" x={PAD_L - 6} y={y(t) + 4} textAnchor="end">{t}</text>
        </g>
      ))}
    </g>
  );
}

/**
 * SÄULEN — eine Reihe über Tage (Antworten je Tag, was fällig wird). 2026-11-02: `rule` — eine Bezugslinie (das
 * Tagesziel), beschriftet; `pulse` — ändert sich die Zahl, wächst die hervorgehobene Säule neu (live, `LiveStats.tsx`).
 */
export function Columns({ points, name, emphasize, rule, pulse }: { points: readonly Point[]; name: string; emphasize?: number; rule?: { readonly value: number; readonly label: string }; pulse?: number }) {
  const [ref, width] = useWidth();
  const [hover, setAt] = useState<number | null>(null);
  const n = points.length;
  /* Ein anderer Zeitraum hat weniger Punkte: ein Zeiger dahinter zeigt nichts. */
  const at = hover !== null && hover < n ? hover : null;
  const plotW = Math.max(0, width - PAD_L - PAD_R);
  const band = n === 0 ? 0 : plotW / n;
  const barW = Math.max(2, Math.min(24, band * 0.7));
  const top = niceMax(Math.max(1, rule?.value ?? 0, ...points.map((p) => p.value)));
  const y = (v: number) => PAD_T + (PLOT_H - PAD_T) * (1 - v / top);
  const nth = everyNth(n, plotW);
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const left = e.currentTarget.getBoundingClientRect().left;
    setAt(Math.max(0, Math.min(n - 1, Math.floor((e.clientX - left - PAD_L) / Math.max(1, band)))));
  };
  const cx = (i: number) => PAD_L + band * (i + 0.5);
  const r = 4;
  return (
    <div className="cg-viz-plot" ref={ref}>
      {width > 0 && (
        <svg width={width} height={PLOT_H + AXIS_H} role="img" aria-label={name} tabIndex={0} className="cg-viz-svg"
          onPointerMove={pick} onPointerLeave={() => setAt(null)} onBlur={() => setAt(null)}
          onKeyDown={(e) => { const next = stepKey(e, at, n); if (next !== undefined) { e.preventDefault(); setAt(next); } }}>
          <YAxis top={top} width={width} y={y} />
          {at !== null && <rect className="cg-viz-hover" x={PAD_L + band * at} y={PAD_T} width={band} height={PLOT_H - PAD_T} />}
          {points.map((p, i) => {
            if (p.value <= 0) return null;
            const x = cx(i) - barW / 2;
            const yTop = y(p.value);
            const h = PLOT_H - yTop;
            const rr = Math.min(r, h, barW / 2);
            const live = i === emphasize && pulse !== undefined && pulse > 0;
            return <path key={live ? `${p.key}:${pulse}` : p.key} className={`cg-viz-bar${i === emphasize ? ' is-now' : ''}${i === at ? ' is-at' : ''}${live ? ' is-pulse' : ''}`}
              d={`M${x},${PLOT_H} V${yTop + rr} Q${x},${yTop} ${x + rr},${yTop} H${x + barW - rr} Q${x + barW},${yTop} ${x + barW},${yTop + rr} V${PLOT_H} Z`} />;
          })}
          {rule !== undefined && rule.value > 0 && (
            <g aria-hidden data-viz-rule={rule.value}>
              <line className="cg-viz-rule" x1={PAD_L} x2={width - PAD_R} y1={y(rule.value)} y2={y(rule.value)} />
              <text className="cg-viz-rule-text" x={width - PAD_R} y={y(rule.value) - 4} textAnchor="end">{rule.label}</text>
            </g>
          )}
          {points.map((p, i) => ((i % nth === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= nth)
            ? <text key={p.key} className="cg-viz-tick" x={cx(i)} y={PLOT_H + 15} textAnchor="middle">{p.axis}</text> : null))}
        </svg>
      )}
      {at !== null && points[at] !== undefined && <Tip x={cx(at)} y={y(points[at]!.value)} width={width} lines={points[at]!.tip} />}
    </div>
  );
}

/** LINIE — eine Reihe über Tage (wie viele Karten sitzen), mit Fläche, Fadenkreuz und dem letzten Wert am Ende. 2026-11-02: `pulse` — der letzte Punkt leuchtet auf, wenn er neu ist. */
export function Line({ points, name, max, pulse }: { points: readonly Point[]; name: string; max: number; pulse?: number }) {
  const [ref, width] = useWidth();
  const [hover, setAt] = useState<number | null>(null);
  const n = points.length;
  const at = hover !== null && hover < n ? hover : null;
  const plotW = Math.max(0, width - PAD_L - PAD_R - 28);
  const top = niceMax(Math.max(1, max));
  const y = (v: number) => PAD_T + (PLOT_H - PAD_T) * (1 - v / top);
  const x = (i: number) => PAD_L + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const nth = everyNth(n, plotW);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const area = n === 0 ? '' : `M${x(0)},${PLOT_H} ${points.map((p, i) => `L${x(i)},${y(p.value)}`).join(' ')} L${x(n - 1)},${PLOT_H} Z`;
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const left = e.currentTarget.getBoundingClientRect().left;
    const px = e.clientX - left - PAD_L;
    setAt(n <= 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round((px / Math.max(1, plotW)) * (n - 1)))));
  };
  const last = points[n - 1];
  return (
    <div className="cg-viz-plot" ref={ref}>
      {width > 0 && n > 0 && (
        <svg width={width} height={PLOT_H + AXIS_H} role="img" aria-label={name} tabIndex={0} className="cg-viz-svg"
          onPointerMove={pick} onPointerLeave={() => setAt(null)} onBlur={() => setAt(null)}
          onKeyDown={(e) => { const next = stepKey(e, at, n); if (next !== undefined) { e.preventDefault(); setAt(next); } }}>
          <YAxis top={top} width={width - 28} y={y} />
          <path className="cg-viz-area" d={area} />
          <path className="cg-viz-line" d={line} />
          {at !== null && <line className="cg-viz-cross" x1={x(at)} x2={x(at)} y1={PAD_T} y2={PLOT_H} />}
          {at !== null && <circle className="cg-viz-dot" cx={x(at)} cy={y(points[at]!.value)} r={4} />}
          {last !== undefined && <circle key={pulse ?? 0} className={`cg-viz-dot${pulse !== undefined && pulse > 0 ? ' is-pulse' : ''}`} cx={x(n - 1)} cy={y(last.value)} r={4} />}
          {last !== undefined && <text className="cg-viz-end" x={x(n - 1) + 8} y={y(last.value) + 4}>{last.value}</text>}
          {points.map((p, i) => ((i % nth === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= nth)
            ? <text key={p.key} className="cg-viz-tick" x={x(i)} y={PLOT_H + 15} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{p.axis}</text> : null))}
        </svg>
      )}
      {at !== null && points[at] !== undefined && <Tip x={x(at)} y={y(points[at]!.value)} width={width} lines={points[at]!.tip} />}
    </div>
  );
}

/** WAAGRECHTE BALKEN — Kategorien (Themen, Rodzaje pytań), der Wert an der Spitze; eine Reihe, eine Farbe. */
function HBars({ rows, name }: { rows: readonly { key: string; label: string; value: number; text: string; title?: string; tex?: string }[]; name: string }) {
  return (
    <ul className="cg-hbars" aria-label={name}>
      {rows.map((r) => (
        <li key={r.key} className="cg-hbar" data-hbar={r.key}>
          {/* 2026-11-01 — `tex`: der Name mit seinen Wzory (der Hinweis bleibt eine Zeile ohne LaTeX). */}
          <span className="cg-hbar-label" title={r.title ?? r.label}>{r.tex === undefined ? r.label : <TexText text={r.tex} />}</span>
          <svg className="cg-hbar-track" width="100%" height={12} aria-hidden>
            <rect className="cg-hbar-back" x={0} y={2} width="100%" height={8} rx={4} />
            {r.value > 0 && <rect className="cg-hbar-fill" x={0} y={2} width={`${Math.max(1.5, Math.min(100, r.value * 100))}%`} height={8} rx={4} />}
          </svg>
          <span className="cg-hbar-value">{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** EIN GESTAPELTER BALKEN — wo die Karten stehen, Stufe für Stufe (2 px Luft zwischen den Teilen). */
function BandBar({ bands, total, name, slim = false }: { bands: Readonly<Record<Band, number>>; total: number; name: string; slim?: boolean }) {
  const [ref, width] = useWidth();
  /* Wie ein Fortschrittsbalken: was sitzt, links — „jeszcze nie" bleibt rechts übrig (dieselbe Reihenfolge wie die Legende). */
  const shown = [...BANDS].reverse().filter((b) => bands[b] > 0);
  const gaps = Math.max(0, shown.length - 1) * 2;
  const usable = Math.max(0, width - gaps);
  let x = 0;
  const h = slim ? 10 : 16;
  const clip = `cg-band-${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  return (
    <div className="cg-viz-plot" ref={ref}>
      {width > 0 && total > 0 && (
        <svg width={width} height={h} role="img" aria-label={`${name}: ${BANDS.map((b) => `${BAND_LABEL[b]} ${bands[b]}`).join(', ')}`} className="cg-viz-svg">
          <defs><clipPath id={clip}><rect x={0} y={0} width={width} height={h} rx={4} /></clipPath></defs>
          <g clipPath={`url(#${clip})`}>
            {shown.map((b) => {
              const w = (usable * bands[b]) / total;
              const rect = <rect key={b} className={`cg-band is-${b}`} x={x} y={0} width={Math.max(1, w)} height={h}><title>{`${BAND_LABEL[b]}: ${bands[b]} (${percent(bands[b] / total)})`}</title></rect>;
              x += w + 2;
              return rect;
            })}
          </g>
        </svg>
      )}
    </div>
  );
}

function BandLegend({ bands, total }: { bands: Readonly<Record<Band, number>>; total: number }) {
  return (
    <ul className="cg-viz-legend">
      {[...BANDS].reverse().map((b) => (
        <li key={b} data-band={b} title={BAND_SAYS[b]}>
          <svg width={12} height={12} aria-hidden><rect className={`cg-band is-${b}`} x={0} y={0} width={12} height={12} rx={3} /></svg>
          <span>{BAND_LABEL[b]}</span> <strong>{bands[b]}</strong> <span className="cg-muted">{total === 0 ? '' : percent(bands[b] / total)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Kleine Zahlen oben: der Wert gross, was er ist darüber, eine Zeile darunter. */
export function Tiles({ tiles }: { tiles: readonly { key: string; label: string; value: string; sub?: string }[] }) {
  return (
    <div className="cg-tiles">
      {tiles.map((t) => (
        <div key={t.key} className="cg-tile" data-tile={t.key}>
          <span className="cg-tile-label">{t.label}</span>
          <span className="cg-tile-value">{t.value}</span>
          {t.sub !== undefined && <span className="cg-tile-sub">{t.sub}</span>}
        </div>
      ))}
    </div>
  );
}

/** Der Zeitraum über allen Diagrammen — eine Reihe, alle zeigen denselben. */
function Range({ days, onDays }: { days: number; onDays: (d: number) => void }) {
  return (
    <div className="cg-chips" role="radiogroup" aria-label="Okres">
      {[7, 30, 90].map((d) => (
        <button key={d} type="button" role="radio" aria-checked={d === days} className={`cg-chip${d === days ? ' is-on' : ''}`} data-range={d} onClick={() => onDays(d)}>
          {d} dni
        </button>
      ))}
    </div>
  );
}

/* -- Was eine Karte und ein Rodzaj pytania heissen ---------------------------------------------------------- */

const FORM_LABEL = new Map<string, string>(QUESTION_TYPES.map((t) => [t.form, t.label]));
const formLabel = (form: string): string => FORM_LABEL.get(form) ?? ({ flash: 'Fiszka', text: 'Wpisz odpowiedź', choice: 'Wybór' } as Record<string, string>)[form] ?? form;

/** 2026-11-01 — was eine Karte fragt, als eine Zeile MIT Wzory (für `TexText`; wie `cardLine` in AnswerLog.tsx). */
function cardWords(lib: CogitaLibrary, card: Card): string {
  const prompt = card.prompt.map((p) => (hasTex(p.text) ? plainOf(p.text, 'inline') : p.text.split('$').join('\\$'))).join(' ').replace(/\s+/g, ' ').trim();
  const base = prompt !== '' ? prompt : card.entity !== undefined ? entityNameTex(lib, card.entity) : card.question;
  return clipTex(card.label === undefined ? base : `${base}: ${card.label}`, 140);
}

const pct = (v: number | null): string => (v === null ? '—' : percent(v));

function HardList({ lib, hard }: { lib: CogitaLibrary; hard: readonly HardCard[] }) {
  if (hard.length === 0) return <p className="cg-muted">Nie ma pytań, które sprawiają kłopot.</p>;
  return (
    <ol className="cg-hard" data-hardest={hard.length}>
      {hard.map((h) => (
        <li key={h.card.key}>
          <span className="cg-hard-q"><TexText text={cardWords(lib, h.card)} /></span>
          <span className="cg-muted">dobrze {percent(h.accuracy)} · {h.answers} odp. · źle {h.wrong}</span>
        </li>
      ))}
    </ol>
  );
}

/* -- Für den Lernenden ---------------------------------------------------------------------------------------- */

const dayTip = (day: number): string => DAY_NAME.format(new Date(day));

/**
 * STATYSTYKI EINES LERNENDEN über `cards` — Kacheln, wo die Karten stehen, wie viele saßen Tag für Tag, Antworten je
 * Tag, was fällig wird, Themen und Rodzaje pytań (das Schwächste zuerst), die schwersten Fragen.
 */
export function KnowledgeStats({ lib, cards, answers, spacing }: {
  lib: CogitaLibrary;
  cards: readonly Card[];
  answers: (card: Card) => readonly AnswerRecord[];
  /** 2026-11-04 (Prompt 15) — die Abstände dieses Lernenden (`spacingFor`); fehlt es: die der Baza. */
  spacing?: Spacing;
}) {
  const [days, setDays] = useState(30);
  const sp = spacing ?? spacingFor(lib, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const s = useMemo(() => knowStats(cards, answers, Date.now(), { days, spacing: sp }), [cards, answers, days, sp.first, sp.growth]);
  return (
    <section className="cg-stats" data-know-stats={s.cards}>
      <div className="cg-stats-filters">
        <Range days={days} onDays={setDays} />
        <span className="cg-muted">Znajomość karty: świeżo po dobrej odpowiedzi „pewnie”, do terminu powtórki „umiem”, potem „do powtórki”, a gdy długo nie powtarzasz — „zapomniane”.</span>
      </div>
      <OwnTiles s={s} />
      <Figure id="bands" title="Gdzie są moje karty" says={`${s.cards} kart`}
        table={<BandTable bands={s.bands} total={s.cards} />}>
        <BandBar bands={s.bands} total={s.cards} name="Gdzie są karty" />
        <BandLegend bands={s.bands} total={s.cards} />
      </Figure>
      {s.answers === 0 ? <p className="cg-muted" data-stats-empty="">Jeszcze nie ma odpowiedzi — wykresy dnia pojawią się po pierwszej powtórce.</p> : (
        <div className="cg-stats-grid">
          <Figure id="known" title="Ile kart umiem — dzień po dniu" says={`koniec każdego dnia, ostatnie ${days} dni`}
            table={<DayTable rows={s.days} />}>
            <Line name="Ile kart umiem, dzień po dniu" max={s.cards}
              points={s.days.map((d) => ({ key: String(d.day), axis: DATE.format(new Date(d.day)), value: d.known, tip: [[String(d.known), `umiem — ${dayTip(d.day)}`], [percent(d.share), 'średnia znajomość']] }))} />
          </Figure>
          <Figure id="activity" title="Odpowiedzi dziennie" says={`dzisiaj: ${s.days[s.days.length - 1]?.answers ?? 0}`}
            table={<DayTable rows={s.days} />}>
            <Columns name="Odpowiedzi dziennie" emphasize={s.days.length - 1}
              points={s.days.map((d) => ({ key: String(d.day), axis: DATE.format(new Date(d.day)), value: d.answers, tip: [[String(d.answers), `odpowiedzi — ${dayTip(d.day)}`], [d.answers === 0 ? '—' : percent(d.right / d.answers), 'dobrze']] }))} />
          </Figure>
          <Figure id="forecast" title="Do powtórki w najbliższych dniach" says={`dzisiaj ${s.forecast[0]?.due ?? 0}${s.fresh > 0 ? ` · nowych czeka ${s.fresh}` : ''}`}
            table={<ForecastTable rows={s.forecast} />}>
            <Columns name="Do powtórki w najbliższych dniach" emphasize={0}
              points={s.forecast.map((f, i) => ({ key: String(f.day), axis: i === 0 ? 'dziś' : DATE.format(new Date(f.day)), value: f.due, tip: [[String(f.due), `do powtórki — ${i === 0 ? 'dziś (z zaległymi)' : dayTip(f.day)}`]] }))} />
          </Figure>
          <TopicFigure lib={lib} topics={s.topics} />
          {s.forms.filter((f) => f.answers > 0).length > 1 && (
            <Figure id="forms" title="Rodzaje pytań — jak mi idzie" says="średnia poprawność odpowiedzi"
              table={<GroupTable rows={s.forms} name={formLabel} />}>
              <HBars name="Rodzaje pytań" rows={s.forms.filter((f) => f.answers > 0).map((f) => ({ key: f.id, label: formLabel(f.id), value: f.accuracy ?? 0, text: `${pct(f.accuracy)} · ${f.answers} odp.` }))} />
            </Figure>
          )}
          <Figure id="hardest" title="Najtrudniejsze pytania" says="najmniej dobrych odpowiedzi">
            <HardList lib={lib} hard={s.hardest} />
          </Figure>
        </div>
      )}
    </section>
  );
}

function OwnTiles({ s }: { s: KnowStats }) {
  return (
    <Tiles tiles={[
      { key: 'known', label: 'Umiem', value: `${s.known} z ${s.cards}`, sub: `średnia znajomość ${percent(s.share)}` },
      { key: 'answers', label: 'Odpowiedzi', value: String(s.answers), sub: s.accuracy === null ? 'jeszcze żadnej' : `dobrze ${percent(s.accuracy)}` },
      { key: 'streak', label: 'Dni z rzędu', value: String(s.streak), sub: `${s.activeDays} ${s.activeDays === 1 ? 'dzień' : 'dni'} nauki` },
      { key: 'time', label: 'Czas nauki', value: s.msTotal === 0 ? '—' : spanText(s.msTotal), sub: s.lastAt === null ? undefined : `ostatnio ${new Date(s.lastAt).toLocaleDateString('pl-PL')}` },
      { key: 'due', label: 'Na dziś', value: String(s.forecast[0]?.due ?? 0), sub: 'kart do powtórki' }
    ]} />
  );
}

function TopicFigure({ lib, topics }: { lib: CogitaLibrary; topics: readonly GroupStat[] }) {
  const [all, setAll] = useState(false);
  if (topics.length < 2) return null;
  const shown = all ? topics : topics.slice(0, 10);
  return (
    <Figure id="topics" title="Tematy — najsłabsze najpierw" says="średnia znajomość kart tematu"
      table={<GroupTable rows={topics} name={(id) => <TexText text={entityNameTex(lib, id)} />} />}>
      <HBars name="Tematy" rows={shown.map((t) => ({ key: t.id, label: entityName(lib, t.id), tex: entityNameTex(lib, t.id), value: t.share, text: t.answered === 0 ? `jeszcze nie · ${t.cards} kart` : `${percent(t.share)} · umiem ${t.known} z ${t.cards}` }))} />
      {topics.length > 10 && <button type="button" className="wk-link-btn" onClick={() => setAll((x) => !x)}>{all ? 'Pokaż 10 najsłabszych' : `Pokaż wszystkie (${topics.length})`}</button>}
    </Figure>
  );
}

/* -- Tabellen: dieselben Werte ohne Zeiger ---------------------------------------------------------------------- */

function BandTable({ bands, total }: { bands: Readonly<Record<Band, number>>; total: number }) {
  return (
    <table className="cg-table"><thead><tr><th>Stan</th><th>Co to znaczy</th><th>Karty</th><th>Udział</th></tr></thead>
      <tbody>{[...BANDS].reverse().map((b) => <tr key={b}><td>{BAND_LABEL[b]}</td><td>{BAND_SAYS[b]}</td><td>{bands[b]}</td><td>{total === 0 ? '—' : percent(bands[b] / total)}</td></tr>)}</tbody>
    </table>
  );
}

function DayTable({ rows }: { rows: KnowStats['days'] }) {
  return (
    <table className="cg-table"><thead><tr><th>Dzień</th><th>Odpowiedzi</th><th>Dobrze</th><th>Umiem (koniec dnia)</th><th>Średnia znajomość</th></tr></thead>
      <tbody>{[...rows].reverse().map((d) => <tr key={d.day}><td>{dayTip(d.day)}</td><td>{d.answers}</td><td>{d.answers === 0 ? '—' : `${d.right} (${percent(d.right / d.answers)})`}</td><td>{d.known}</td><td>{percent(d.share)}</td></tr>)}</tbody>
    </table>
  );
}

function ForecastTable({ rows }: { rows: KnowStats['forecast'] }) {
  return (
    <table className="cg-table"><thead><tr><th>Dzień</th><th>Do powtórki</th></tr></thead>
      <tbody>{rows.map((f, i) => <tr key={f.day}><td>{i === 0 ? 'dziś (z zaległymi)' : dayTip(f.day)}</td><td>{f.due}</td></tr>)}</tbody>
    </table>
  );
}

function GroupTable({ rows, name }: { rows: readonly GroupStat[]; name: (id: string) => ReactNode }) {
  return (
    <table className="cg-table"><thead><tr><th>Nazwa</th><th>Karty</th><th>Z odpowiedzią</th><th>Umiem</th><th>Znajomość</th><th>Odpowiedzi</th><th>Dobrze</th></tr></thead>
      <tbody>{rows.map((g) => <tr key={g.id}><td>{name(g.id)}</td><td>{g.cards}</td><td>{g.answered}</td><td>{g.known}</td><td>{percent(g.share)}</td><td>{g.answers}</td><td>{pct(g.accuracy)}</td></tr>)}</tbody>
    </table>
  );
}

/* -- Für die Lehrerin --------------------------------------------------------------------------------------------- */

/** Die Stufe einer Zelle der Karte „Tematy × uczący się": fünf Schritte derselben Rampe. */
const heatStep = (share: number): number => Math.min(5, 1 + Math.floor(share * 5));

/**
 * ALLE UCZĄCY SIĘ ZUSAMMEN — Kacheln, jeder als ein gestapelter Balken, Tematy × uczący się als Karte (wo hakt es bei
 * wem), Antworten aller je Tag, die Fragen, die allen am schwersten fallen.
 */
export function ClassKnowledge({ lib, cards, learners }: {
  lib: CogitaLibrary;
  cards: readonly Card[];
  learners: readonly { readonly id: string; readonly name: string; readonly answers: (card: Card) => readonly AnswerRecord[]; readonly spacing?: Spacing }[];
}) {
  const [days, setDays] = useState(30);
  const { each, all } = useMemo(() => classStats(cards, learners, Date.now(), { days }), [cards, learners, days]);
  const ordered = [...learners].sort((a, b) => (each.get(b.id)?.share ?? 0) - (each.get(a.id)?.share ?? 0));
  const topics = all.topics.slice(0, 16);
  return (
    <section className="cg-stats" data-class-stats={learners.length}>
      <div className="cg-stats-filters"><Range days={days} onDays={setDays} /></div>
      <Tiles tiles={[
        { key: 'learners', label: 'Uczący się', value: String(all.learners), sub: `aktywni w 7 dni: ${all.active}` },
        { key: 'share', label: 'Średnia znajomość', value: percent(all.share), sub: 'kart, u wszystkich' },
        { key: 'answers', label: 'Odpowiedzi', value: String(all.answers), sub: all.accuracy === null ? undefined : `dobrze ${percent(all.accuracy)}` }
      ]} />
      <Figure id="class-bands" title="Uczący się — gdzie są ich karty" says="najlepiej znający najpierw"
        table={(
          <table className="cg-table"><thead><tr><th>Uczący się</th>{[...BANDS].reverse().map((b) => <th key={b}>{BAND_LABEL[b]}</th>)}<th>Średnia</th></tr></thead>
            <tbody>{ordered.map((l) => { const s = each.get(l.id)!; return <tr key={l.id}><td>{l.name}</td>{[...BANDS].reverse().map((b) => <td key={b}>{s.bands[b]}</td>)}<td>{percent(s.share)}</td></tr>; })}</tbody>
          </table>
        )}>
        <ul className="cg-class-bands">
          {ordered.map((l) => {
            const s = each.get(l.id)!;
            return (
              <li key={l.id} data-class-learner={l.id}>
                <span className="cg-hbar-label" title={l.name}>{l.name}</span>
                <BandBar bands={s.bands} total={s.cards} name={l.name} slim />
                <span className="cg-hbar-value">{percent(s.share)}</span>
              </li>
            );
          })}
        </ul>
        <BandLegend bands={sumBands([...each.values()])} total={[...each.values()].reduce((sum, s) => sum + s.cards, 0)} />
      </Figure>
      {topics.length > 0 && (
        <Figure id="class-topics" title="Tematy × uczący się" says="średnia znajomość kart tematu; najsłabsze tematy z lewej">
          <div className="cg-table-wrap">
            <table className="cg-heat" data-heat={`${ordered.length}x${topics.length}`}>
              <thead><tr><th scope="col">Uczący się</th>{topics.map((t) => <th key={t} scope="col" title={entityName(lib, t)}><span><TexText text={entityNameTex(lib, t)} /></span></th>)}</tr></thead>
              <tbody>
                {ordered.map((l) => (
                  <tr key={l.id}>
                    <th scope="row">{l.name}</th>
                    {topics.map((t) => {
                      const v = all.grid.get(t)?.get(l.id) ?? null;
                      return <td key={t} className={v === null ? 'is-none' : `is-h${heatStep(v)}`} title={`${l.name} — ${entityName(lib, t)}: ${v === null ? 'jeszcze nie' : percent(v)}`}>{v === null ? '—' : Math.round(v * 100)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="cg-viz-legend" aria-label="Skala">
            {[1, 2, 3, 4, 5].map((h) => <li key={h}><span className={`cg-heat-key is-h${h}`} aria-hidden />{`${(h - 1) * 20}–${h * 20}%`}</li>)}
            <li><span className="cg-heat-key is-none" aria-hidden />jeszcze nie</li>
          </ul>
          {all.topics.length > topics.length && <span className="cg-muted">Pokazano 16 najsłabszych tematów z {all.topics.length}.</span>}
        </Figure>
      )}
      {all.answers > 0 && (
        <div className="cg-stats-grid">
          <Figure id="class-activity" title="Odpowiedzi wszystkich dziennie" says={`ostatnie ${days} dni`}
            table={(
              <table className="cg-table"><thead><tr><th>Dzień</th><th>Odpowiedzi</th><th>Dobrze</th></tr></thead>
                <tbody>{[...all.days].reverse().map((d) => <tr key={d.day}><td>{dayTip(d.day)}</td><td>{d.answers}</td><td>{d.answers === 0 ? '—' : percent(d.right / d.answers)}</td></tr>)}</tbody>
              </table>
            )}>
            <Columns name="Odpowiedzi wszystkich dziennie" emphasize={all.days.length - 1}
              points={all.days.map((d) => ({ key: String(d.day), axis: DATE.format(new Date(d.day)), value: d.answers, tip: [[String(d.answers), `odpowiedzi — ${dayTip(d.day)}`], [d.answers === 0 ? '—' : percent(d.right / d.answers), 'dobrze']] }))} />
          </Figure>
          <Figure id="class-hardest" title="Najtrudniejsze pytania dla wszystkich" says="najmniej dobrych odpowiedzi">
            <HardList lib={lib} hard={all.hardest} />
          </Figure>
        </div>
      )}
    </section>
  );
}

function sumBands(list: readonly KnowStats[]): Record<Band, number> {
  const out: Record<Band, number> = { unseen: 0, weak: 0, fading: 0, known: 0, solid: 0 };
  for (const s of list) for (const b of BANDS) out[b] += s.bands[b];
  return out;
}

/* -- 2026-11-01 — DIE KENNTNIS EINER KARTE ÜBER DIE ZEIT (nach jeder Antwort im Lauf) --------------------------- */

const HISTORY_RANGES = [
  { key: '1', days: 1, label: 'dzień' },
  { key: '7', days: 7, label: '7 dni' },
  { key: '30', days: 30, label: '30 dni' },
  { key: '90', days: 90, label: '90 dni' },
  { key: '365', days: 365, label: 'rok' },
  { key: 'all', days: null, label: 'od początku' }
] as const;
type HistoryRange = (typeof HISTORY_RANGES)[number]['key'];
const RANGE_KEY = 'cg-card-history-range';
const H_DAY = 86_400_000;

function storedRange(): HistoryRange | null {
  try {
    const v = window.localStorage.getItem(RANGE_KEY);
    return HISTORY_RANGES.some((r) => r.key === v) ? (v as HistoryRange) : null;
  } catch { return null; }
}

/** Wie viel Kenntnis — über 100 % auch (frisch nach einer guten Antwort bis 316 %). */
const kText = (k: number): string => (k < 0.005 ? '0%' : `${Math.round(k * 100)}%`);

const H_PLOT = 150;
const H_PAD_L = 40;
const H_PAD_R = 12;
const H_TOP = Math.log10(4);
const H_LOW = Math.log10(HISTORY_FLOOR);

const TIME = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });
const MONTH_YEAR = new Intl.DateTimeFormat('pl-PL', { month: 'numeric', year: 'numeric' });
const WHEN = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/**
 * WIE SICH DIE KENNTNIS DIESER KARTE ENTWICKELT HAT — nach jeder Antwort im Lauf. Die Achse ist logarithmisch: 10 %
 * (darunter: nieznane) und 100 % (die Pora powtórki) liegen beide gut sichtbar, und das immer langsamere Sinken bleibt
 * lesbar. Jeder Punkt ist der Wert gleich nach einer Antwort; gestrichelt, wie es ohne Antwort weiterginge.
 */
export function CardHistoryChart({ marks, now: given, spacing = DEFAULT_SPACING }: { marks: readonly Mark[]; now?: number; spacing?: Spacing }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `marks`: eine neue Antwort ist ein neues Jetzt
  const now = useMemo(() => given ?? Date.now(), [given, marks]);
  const first = useMemo(() => marks.reduce<number | null>((m, x) => (Number.isFinite(x.at) && (m === null || x.at < m) ? x.at : m), null), [marks]);
  /* Ohne eigene Wahl: der kleinste Zeitraum, der alle Antworten zeigt. */
  const auto: HistoryRange = first === null ? '7' : HISTORY_RANGES.find((r) => r.days !== null && now - r.days * H_DAY <= first)?.key ?? 'all';
  const [chosen, setChosen] = useState<HistoryRange | null>(storedRange);
  const range = chosen ?? auto;
  const choose = (r: HistoryRange) => {
    setChosen(r);
    try { window.localStorage.setItem(RANGE_KEY, r); } catch { /* nur eine Bequemlichkeit */ }
  };
  const days = HISTORY_RANGES.find((r) => r.key === range)?.days ?? null;
  const from = days !== null ? now - days * H_DAY : Math.min(now - 3_600_000, (first ?? now) - Math.max(60_000, (now - (first ?? now)) * 0.04));
  const until = now + (now - from) * 0.25;
  const h = useMemo(() => cardHistory(marks, from, now, until, spacing), [marks, from, now, until, spacing]);

  const [ref, width] = useWidth();
  const [hover, setAt] = useState<number | null>(null);
  const n = h.answers.length;
  const at = hover !== null && hover < n ? hover : null;
  const plotW = Math.max(0, width - H_PAD_L - H_PAD_R);
  const span = until - from;
  const x = (t: number) => H_PAD_L + (plotW * (t - from)) / Math.max(1, span);
  const y = (k: number) => PAD_T + ((H_PLOT - PAD_T) * (H_TOP - Math.log10(Math.max(HISTORY_FLOOR, Math.min(4, k))))) / (H_TOP - H_LOW);
  const path = (pts: readonly { at: number; k: number }[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.at).toFixed(1)},${y(p.k).toFixed(1)}`).join(' ');
  const tickText = (t: number) => (span <= 2.5 * H_DAY ? TIME.format(new Date(t)) : span <= 500 * H_DAY ? DATE.format(new Date(t)) : MONTH_YEAR.format(new Date(t)));
  /* Die Daten unter der Achse: vom Anfang des Zeitraums bis „teraz” (das hat seine eigene Beschriftung). */
  const tickCount = plotW < 260 ? 1 : 3;
  const ticks: number[] = plotW <= 0 ? [] : Array.from({ length: tickCount }, (_, i) => from + ((now - from) * i) / tickCount);
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (n === 0) return;
    const t = from + ((e.clientX - e.currentTarget.getBoundingClientRect().left - H_PAD_L) / Math.max(1, plotW)) * span;
    let best = 0;
    h.answers.forEach((a, i) => { if (Math.abs(a.at - t) < Math.abs(h.answers[best]!.at - t)) best = i; });
    setAt(best);
  };
  const level = h.total === 0 ? 'unseen' : levelOfKnowness(h.k);
  const says = [
    `teraz ${kText(h.k)} — ${LEVEL_LABEL[level]}`,
    h.dueAt !== null ? `powtórka za ${spanText(h.dueAt - now)}` : h.forgottenAt !== null ? `zapomniana za ${spanText(h.forgottenAt - now)}` : null
  ].filter((s): s is string => s !== null).join(' · ');
  const answer = at === null ? null : h.answers[at]!;
  const bands = [
    { key: 'known', top: 4, bottom: KNOWN, label: LEVEL_LABEL.known },
    { key: 'fading', top: KNOWN, bottom: FORGOTTEN, label: LEVEL_LABEL.learning },
    { key: 'unseen', top: FORGOTTEN, bottom: HISTORY_FLOOR, label: LEVEL_LABEL.unseen }
  ] as const;
  return (
    <Figure id="card-history" title="Znajomość tej karty" says={says}
      table={(
        <table className="cg-table">
          <thead><tr><th>Kiedy</th><th>Odpowiedź</th><th>Znajomość przed</th><th>po</th></tr></thead>
          <tbody>
            {[...h.answers].reverse().map((a, i) => (
              <tr key={`${a.at}-${i}`}><td>{WHEN.format(new Date(a.at))}</td><td>{percent(a.correctness)}</td><td>{a.before === null ? '—' : kText(a.before)}</td><td>{kText(a.after)}</td></tr>
            ))}
          </tbody>
        </table>
      )}>
      <div className="cg-chips cg-hist-ranges" role="radiogroup" aria-label="Okres">
        {HISTORY_RANGES.map((r) => (
          <button key={r.key} type="button" role="radio" aria-checked={r.key === range} className={`cg-chip${r.key === range ? ' is-on' : ''}`} data-history-range={r.key} onClick={() => choose(r.key)}>{r.label}</button>
        ))}
      </div>
      <div className="cg-viz-plot" ref={ref} data-history-answers={n}>
        {width > 0 && (
          <svg width={width} height={H_PLOT + AXIS_H} role="img" tabIndex={0} className="cg-viz-svg cg-hist"
            aria-label={`Znajomość tej karty: ${says}; ${n} odpowiedzi w tym okresie`}
            onPointerMove={pick} onPointerLeave={() => setAt(null)} onBlur={() => setAt(null)}
            onKeyDown={(e) => { const next = stepKey(e, at, n); if (next !== undefined) { e.preventDefault(); setAt(next); } }}>
            {bands.map((b) => (
              <g key={b.key} aria-hidden>
                <rect className={`cg-hist-band is-${b.key}`} x={H_PAD_L} width={plotW} y={y(b.top)} height={Math.max(0, y(b.bottom) - y(b.top))} />
                <text className="cg-hist-band-name" x={H_PAD_L + 4} y={y(b.bottom) - 4}>{b.label}</text>
              </g>
            ))}
            {[KNOWN, FORGOTTEN].map((k) => (
              <g key={k} aria-hidden>
                <line className={`cg-hist-limit${k === KNOWN ? ' is-known' : ''}`} x1={H_PAD_L} x2={H_PAD_L + plotW} y1={y(k)} y2={y(k)} />
                <text className="cg-viz-tick" x={H_PAD_L - 6} y={y(k) + 4} textAnchor="end">{kText(k)}</text>
              </g>
            ))}
            <text className="cg-viz-tick" x={H_PAD_L - 6} y={y(HISTORY_FLOOR) + 4} textAnchor="end" aria-hidden>0</text>
            <line className="cg-hist-now" x1={x(now)} x2={x(now)} y1={PAD_T} y2={H_PLOT} aria-hidden />
            {h.future.length > 1 && <path className="cg-hist-future" d={path(h.future)} />}
            {h.past.length > 1 && <path className="cg-viz-line" d={path(h.past)} />}
            {answer !== null && <line className="cg-viz-cross" x1={x(answer.at)} x2={x(answer.at)} y1={PAD_T} y2={H_PLOT} />}
            {h.answers.map((a, i) => (
              <circle key={`${a.at}-${i}`} className={`cg-hist-dot is-${a.grade}${i === at ? ' is-at' : ''}`} cx={x(a.at)} cy={y(a.after)} r={i === at ? 5 : 3.5} data-history-dot={a.grade} />
            ))}
            {h.total > 0 && (
              <text className="cg-viz-end" x={x(now) + 6} y={Math.max(PAD_T + 10, y(h.k) - 8)} data-history-now={Math.round(h.k * 100)}>{kText(h.k)}</text>
            )}
            {ticks.map((t, i) => <text key={t} className="cg-viz-tick" x={x(t)} y={H_PLOT + 15} textAnchor={i === 0 ? 'start' : 'middle'}>{tickText(t)}</text>)}
            <text className="cg-viz-tick" x={x(now)} y={H_PLOT + 15} textAnchor="middle">teraz</text>
          </svg>
        )}
        {answer !== null && (
          <Tip x={x(answer.at)} y={y(answer.after)} width={width} lines={[
            [WHEN.format(new Date(answer.at)), ''],
            [percent(answer.correctness), answer.grade === 'correct' ? 'dobrze' : answer.grade === 'partly' ? 'częściowo' : 'źle'],
            [`${answer.before === null ? 'pierwsza' : kText(answer.before)} → ${kText(answer.after)}`, 'znajomość']
          ]} />
        )}
      </div>
      {h.total > n && <span className="cg-muted cg-hist-note">{n === 0 ? 'W tym okresie bez odpowiedzi' : `W tym okresie ${n} z ${h.total} odpowiedzi`} — dłuższy okres pokaże wcześniejsze.</span>}
    </Figure>
  );
}
