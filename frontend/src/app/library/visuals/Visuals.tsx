/**
 * 2026-11-16 — GRAFIKEN ZEICHNEN (gelesen in `../visual.ts`). Ein eigenes Bündel, geladen, sobald ein Text eine Grafik trägt
 * (`../VisualBlock.tsx`).
 *
 * <b>Wie ein Diagramm hier aussieht</b> (dataviz, geprüft mit `validate_palette.js` gegen beide Flächen #ffffff / #1f1c16):
 * die acht Reihenfarben in fester Reihenfolge (nie im Kreis; Punkte höchstens drei), dünne Marken (Linien 2 px, Punkte 8 px,
 * Säulen mit 4 px runden Enden an der Null), 2 px Fläche zwischen aneinanderliegenden Flächen, eine Achse (nie zwei), leise
 * Gitter. Jede Grafik ist EIN Tabulatorhalt: Zeiger und Pfeiltasten zeigen denselben Hinweis. Ab zwei Reihen steht immer
 * eine Legende, bis vier Linien tragen dazu ihren Namen am Ende. Text trägt nie die Farbe einer Reihe. Unter jedem Diagramm
 * seine Tabelle („Dane") — so ist keine Information nur in der Farbe (drei helle Farben liegen unter 3:1 auf Weiss).
 *
 * Ein Schema und ein Baum: Kästen (Zapis, auch Wzory) in Schichten, die Kanten nach dem Messen gezeichnet. Eine Zeitleiste:
 * eine senkrechte Linie mit den Daten. Breite gemessen (ResizeObserver) — auf dem Telefon bleibt die Schrift lesbar; was nicht
 * passt, rollt in seinem Kasten seitwärts, nie die Seite.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

import { useT } from '../../core/i18n';
import { texPlain } from '../../core/tex';
import { compile, isExprError, toNum } from '../../pages/motion/expr';
import { readVisual, type ChartVisual, type DiagramVisual, type PlotVisual, type TimelineVisual } from '../visual';
import './visuals.css';

export type LabelOf = (text: string) => ReactNode;

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

/** Eine Zeile ohne Zapis — für Text im SVG (dort gibt es keine Wzory): `$x^2$` wird „x²"-artig lesbar. */
const plain = (text: string): string => text.replace(/\$\$?([^$]+)\$\$?/g, (_m, tex: string) => texPlain(tex)).replace(/\*\*?|\[\[(?:[^|\]]*\|)?|\|@[^\]]*\]\]|\]\]/g, '');

/** Glatte Achsenteilung: Schritte 1, 2, 5 × 10ⁿ, etwa `count` Striche, der Bereich nach aussen gerundet. */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (!(hi > lo)) { hi = lo + 1; }
  const raw = (hi - lo) / Math.max(1, count);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  const start = Math.floor(lo / step + 1e-9) * step;
  const end = Math.ceil(hi / step - 1e-9) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step * 1e-6 && out.length < 40; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

function useNumber() {
  const t = useT();
  return useMemo(() => {
    const f = new Intl.NumberFormat(t.lang, { maximumFractionDigits: 2 });
    return (v: number) => f.format(v);
  }, [t.lang]);
}

/** Pfeiltasten: Punkt für Punkt; Pos1/Ende; Esc schliesst. */
function stepKey(e: KeyboardEvent, at: number | null, n: number): number | null | undefined {
  if (n === 0) return undefined;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') return at === null ? 0 : Math.min(n - 1, at + 1);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') return at === null ? n - 1 : Math.max(0, at - 1);
  if (e.key === 'Home') return 0;
  if (e.key === 'End') return n - 1;
  if (e.key === 'Escape') return null;
  return undefined;
}

/** Der Hinweis über einem Punkt (Ort über zwei CSS-Variablen, vor dem Zeichnen gesetzt — kein Sprung). */
function Tip({ x, y, width, title, lines }: { x: number; y: number; width: number; title: ReactNode; lines: readonly { key: string; slot: number | null; value: string; name: ReactNode }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const side = x < width * 0.3 ? ' is-left' : x > width * 0.7 ? ' is-right' : '';
  useLayoutEffect(() => {
    ref.current?.style.setProperty('--tip-x', `${Math.round(x)}px`);
    ref.current?.style.setProperty('--tip-y', `${Math.round(y)}px`);
  }, [x, y]);
  return (
    <div ref={ref} className={`vz-tip${side}`} role="status" data-visual-tip="">
      <span className="vz-tip-title">{title}</span>
      {lines.map((l) => (
        <span key={l.key} className="vz-tip-line">
          {l.slot !== null && <Swatch slot={l.slot} />}
          <strong>{l.value}</strong> <span>{l.name}</span>
        </span>
      ))}
    </div>
  );
}

const Swatch = ({ slot, line = false }: { slot: number; line?: boolean }) => (
  <svg className="vz-swatch" width={12} height={12} aria-hidden>
    {line ? <line className={`vz-stroke-${slot}`} x1={1} x2={11} y1={6} y2={6} /> : <rect className={`vz-fill-${slot}`} x={0} y={0} width={12} height={12} rx={3} />}
  </svg>
);

function Legend({ names, label, line = false }: { names: readonly string[]; label: LabelOf; line?: boolean }) {
  if (names.length < 2) return null;
  return (
    <ul className="vz-legend" data-visual-legend={names.length}>
      {names.map((n, i) => <li key={i}><Swatch slot={(i % 8) + 1} line={line} /><span>{label(n)}</span></li>)}
    </ul>
  );
}

/** Die Figur: Titel, Grafik, Quelle — und, wo es Zahlen gibt, ihre Tabelle (dieselben Werte, ohne Zeiger). */
function Figure({ kind, title, source, table, label, children }: { kind: string; title: string; source: string; table?: ReactNode; label: LabelOf; children: ReactNode }) {
  const t = useT();
  return (
    <figure className={`vz vz-is-${kind}`} data-visual={kind}>
      {title !== '' && <figcaption className="vz-title">{label(title)}</figcaption>}
      {children}
      {source !== '' && <p className="vz-source">{t('visuals.sourceWord')} {label(source)}</p>}
      {table !== undefined && (
        <details className="vz-data" data-visual-data="">
          <summary>{t('visuals.data')}</summary>
          <div className="lib-table-wrap">{table}</div>
        </details>
      )}
    </figure>
  );
}

/* -- Diagramme aus Tabellen ---------------------------------------------------------------------------------- */

const PLOT_H = 200;
const AXIS_H = 26;
const PAD_T = 12;
const PAD_R = 12;
const GAP = 2;

/** Ein Rechteck mit runden Enden nur an der Spitze (weg von der Null) — für Säulen und gestapelte Teile. */
function barPath(x: number, w: number, y0: number, y1: number, round: boolean): string {
  const up = y1 < y0;
  const h = Math.abs(y1 - y0);
  const r = round ? Math.min(4, w / 2, h) : 0;
  if (h <= 0) return '';
  if (up) return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`;
  return `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 - r} V${y0} Z`;
}

function DataTable({ v, label, fmt, share }: { v: ChartVisual; label: LabelOf; fmt: (n: number) => string; share?: boolean }) {
  return (
    <table className="lib-table vz-table">
      <thead><tr><th>{label(v.x)}</th>{v.series.map((s, i) => <th key={i}>{label(s)}</th>)}</tr></thead>
      <tbody>
        {v.rows.map((r, i) => {
          const sum = r.values.reduce<number>((a, b) => a + Math.max(0, b ?? 0), 0);
          return (
            <tr key={i}>
              <th scope="row">{label(r.label)}</th>
              {r.values.map((x, j) => <td key={j} className="vz-num">{x === null ? '–' : `${fmt(x)}${v.unit === '' ? '' : ` ${v.unit}`}${share === true && sum > 0 ? ` (${fmt((100 * Math.max(0, x)) / sum)} %)` : ''}`}</td>)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Chart({ v, label }: { v: ChartVisual; label: LabelOf }) {
  const t = useT();
  const fmt = useNumber();
  const [ref, width] = useWidth();
  const [hover, setAt] = useState<number | null>(null);
  const valueText = (x: number | null) => (x === null ? '–' : `${fmt(x)}${v.unit === '' ? '' : ` ${v.unit}`}`);
  const n = v.rows.length;
  const at = hover !== null && hover < n ? hover : null;
  const S = v.series.length;
  const name = v.title === '' ? t(`visuals.chartName.${v.type}`) : plain(v.title);

  if (v.type === 'hbar' || v.type === 'share') return <Figure kind={`chart-${v.type}`} title={v.title} source={v.source} label={label} table={<DataTable v={v} label={label} fmt={fmt} share={v.type === 'share'} />}>
    <Legend names={v.series} label={label} />
    {v.type === 'hbar' ? <HBars v={v} label={label} valueText={valueText} /> : <ShareBars v={v} label={label} fmt={fmt} />}
  </Figure>;

  /* Senkrecht: Säulen, gestapelt, Linie, Punkte. Die Werte als Achse (eine), von 0 aus — Linien und Punkte dürfen frei. */
  const all = v.rows.flatMap((r) => r.values.filter((x): x is number => x !== null));
  const stackedTop = v.type === 'stacked' ? Math.max(0, ...v.rows.map((r) => r.values.reduce<number>((a, b) => a + Math.max(0, b ?? 0), 0))) : 0;
  const free = v.type === 'line' || v.type === 'scatter';
  const lo0 = Math.min(...all, free ? Infinity : 0);
  const hi0 = v.type === 'stacked' ? stackedTop : Math.max(...all, free ? -Infinity : 0);
  const ticks = niceTicks(Number.isFinite(lo0) ? lo0 : 0, Number.isFinite(hi0) ? hi0 : 1, 4);
  const lo = ticks[0]!;
  const hi = ticks[ticks.length - 1]!;
  const padL = Math.min(64, 14 + 7 * Math.max(...ticks.map((x) => fmt(x).length)));
  /* Bis vier Linien tragen ihren Namen am Ende — dafür rechts Platz. */
  const ends = v.type === 'line' && S <= 4;
  const padR = ends ? Math.min(120, 16 + 7 * Math.max(...v.series.map((s) => plain(s).length))) : PAD_R;
  const plotW = Math.max(0, width - padL - padR);
  const y = (x: number) => PAD_T + (PLOT_H - PAD_T) * (1 - (x - lo) / (hi - lo || 1));
  const numericX = (v.type === 'line' || v.type === 'scatter') && v.rows.every((r) => r.at !== null) && n > 1;
  const xs = numericX ? v.rows.map((r) => r.at!) : [];
  const xLo = numericX ? Math.min(...xs) : 0;
  const xHi = numericX ? Math.max(...xs) : 1;
  const band = n === 0 ? 0 : plotW / n;
  const cx = (i: number) => (numericX ? padL + (plotW * (v.rows[i]!.at! - xLo)) / (xHi - xLo || 1) : padL + band * (i + 0.5));
  const nth = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 56))));
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    if (numericX) { let best = 0; for (let i = 1; i < n; i += 1) if (Math.abs(cx(i) - px) < Math.abs(cx(best) - px)) best = i; setAt(best); }
    else setAt(Math.max(0, Math.min(n - 1, Math.floor((px - padL) / Math.max(1, band)))));
  };
  const zero = y(Math.max(lo, Math.min(hi, 0)));
  const group = Math.min(band * 0.78, 18 * S + GAP * (S - 1));
  const barW = Math.max(2, (group - GAP * (S - 1)) / S);
  const tipY = at === null ? 0 : v.type === 'stacked'
    ? y(v.rows[at]!.values.reduce<number>((a, b) => a + Math.max(0, b ?? 0), 0))
    : y(Math.max(...v.rows[at]!.values.map((x) => x ?? lo)));

  return (
    <Figure kind={`chart-${v.type}`} title={v.title} source={v.source} label={label} table={<DataTable v={v} label={label} fmt={fmt} />}>
      <Legend names={v.series} label={label} line={v.type === 'line'} />
      {v.y !== '' && <p className="vz-yname">{label(v.y)}</p>}
      <div className="vz-plot" ref={ref}>
        {width > 0 && (
          <svg width={width} height={PLOT_H + AXIS_H + (v.x !== '' && numericX ? 14 : 0)} role="img" aria-label={name} tabIndex={0} className="vz-svg"
            onPointerMove={pick} onPointerLeave={() => setAt(null)} onBlur={() => setAt(null)}
            onKeyDown={(e) => { const next = stepKey(e, at, n); if (next !== undefined) { e.preventDefault(); setAt(next); } }}>
            {ticks.map((tv) => (
              <g key={tv} aria-hidden>
                <line className={tv === 0 ? 'vz-axis' : 'vz-grid'} x1={padL} x2={width - padR} y1={y(tv)} y2={y(tv)} />
                <text className="vz-tick" x={padL - 6} y={y(tv) + 4} textAnchor="end">{fmt(tv)}</text>
              </g>
            ))}
            {at !== null && !numericX && <rect className="vz-hover" x={padL + band * at} y={PAD_T} width={band} height={PLOT_H - PAD_T} />}
            {at !== null && numericX && <line className="vz-cross" x1={cx(at)} x2={cx(at)} y1={PAD_T} y2={PLOT_H} />}
            {v.type === 'bar' && v.rows.map((r, i) => r.values.map((x, j) => (x === null ? null : (
              <path key={`${i}:${j}`} className={`vz-fill-${(j % 8) + 1}${i === at ? ' is-at' : ''}`}
                d={barPath(cx(i) - group / 2 + j * (barW + GAP), barW, zero, y(x), true)} />
            ))))}
            {v.type === 'stacked' && v.rows.map((r, i) => {
              let base = 0;
              const top = r.values.reduce<number>((k, x, j) => (x !== null && x > 0 ? j : k), -1);
              return r.values.map((x, j) => {
                if (x === null || x <= 0) return null;
                const y0 = y(base) - (base > 0 ? GAP / 2 : 0);
                base += x;
                const y1 = y(base) + (j === top ? 0 : GAP / 2);
                return <path key={`${i}:${j}`} className={`vz-fill-${(j % 8) + 1}${i === at ? ' is-at' : ''}`} d={barPath(cx(i) - Math.min(band * 0.6, 36) / 2, Math.min(band * 0.6, 36), y0, y1, j === top)} />;
              });
            })}
            {v.type === 'line' && v.series.map((s, j) => {
              /* Eine Lücke (leer) unterbricht die Linie. */
              let d = '';
              let pen = false;
              v.rows.forEach((r, i) => { const x = r.values[j]; if (x === null || x === undefined) { pen = false; return; } d += `${pen ? 'L' : 'M'}${cx(i)},${y(x)} `; pen = true; });
              return <path key={s + j} className={`vz-line vz-stroke-${(j % 8) + 1}`} d={d} />;
            })}
            {(v.type === 'scatter' || (v.type === 'line' && n <= 24)) && v.series.map((s, j) => v.rows.map((r, i) => {
              const x = r.values[j];
              if (x === null || x === undefined) return null;
              return <circle key={`${s}:${i}`} className={`vz-dot vz-fill-${(j % 8) + 1}${i === at ? ' is-at' : ''}${v.type === 'line' ? ' is-small' : ''}`} cx={cx(i)} cy={y(x)} r={v.type === 'line' && i !== at ? 2.5 : 4} />;
            }))}
            {ends && v.series.map((s, j) => {
              const last = [...v.rows.keys()].reverse().find((i) => v.rows[i]!.values[j] !== null);
              return last === undefined ? null : <text key={s + j} className="vz-end" x={cx(last) + 8} y={y(v.rows[last]!.values[j]!) + 4}>{plain(s)}</text>;
            })}
            {v.rows.map((r, i) => ((i % nth === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= nth)
              ? <text key={i} className="vz-tick" x={cx(i)} y={PLOT_H + 16} textAnchor={numericX && i === 0 ? 'start' : numericX && i === n - 1 ? 'end' : 'middle'}>{plain(r.label)}</text> : null))}
            {numericX && v.x !== '' && <text className="vz-axis-name" x={width - padR} y={PLOT_H + AXIS_H + 10} textAnchor="end">{plain(v.x)}</text>}
          </svg>
        )}
        {at !== null && v.rows[at] !== undefined && (
          <Tip x={cx(at)} y={tipY} width={width} title={label(v.rows[at]!.label)}
            lines={v.series.map((s, j) => ({ key: String(j), slot: S > 1 ? (j % 8) + 1 : null, value: valueText(v.rows[at]!.values[j] ?? null), name: label(s) }))} />
        )}
      </div>
    </Figure>
  );
}

/** Waagrecht: lange Namen links (mit ihren Wzory), die Balken daneben, der Wert an der Spitze. */
function HBars({ v, label, valueText }: { v: ChartVisual; label: LabelOf; valueText: (x: number | null) => string }) {
  const max = Math.max(0, ...v.rows.flatMap((r) => r.values.map((x) => x ?? 0)));
  const min = Math.min(0, ...v.rows.flatMap((r) => r.values.map((x) => x ?? 0)));
  const span = max - min || 1;
  const z = (-min / span) * 100;
  return (
    <ul className="vz-hbars" aria-label={plain(v.title)}>
      {v.rows.map((r, i) => (
        <li key={i} className="vz-hbar" data-visual-row={i}>
          <span className="vz-hbar-label">{label(r.label)}</span>
          <span className="vz-hbar-tracks">
            {r.values.map((x, j) => (
              <span key={j} className="vz-hbar-one" title={`${plain(v.series[j] ?? '')}: ${valueText(x)}`}>
                <svg className="vz-hbar-track" width="100%" height={10} aria-hidden>
                  {x !== null && x !== 0 && <rect className={`vz-fill-${(j % 8) + 1}`} x={`${x >= 0 ? z : z + (x / span) * 100}%`} y={1} width={`${Math.max(0.6, (Math.abs(x) / span) * 100)}%`} height={8} rx={4} />}
                </svg>
                <span className="vz-hbar-value">{valueText(x)}</span>
              </span>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Anteile: je Zeile ein Balken, der 100 % ist; die Teile mit 2 px Luft. Statt eines Kreises — Längen liest man genauer. */
function ShareBars({ v, label, fmt }: { v: ChartVisual; label: LabelOf; fmt: (n: number) => string }) {
  const [ref, width] = useWidth();
  return (
    <div ref={ref} className="vz-shares-host">
    <ul className="vz-shares">
      {v.rows.map((r, i) => {
        const parts = r.values.map((x) => Math.max(0, x ?? 0));
        const sum = parts.reduce((a, b) => a + b, 0);
        const shown = parts.filter((p) => p > 0).length;
        const usable = Math.max(0, width - GAP * Math.max(0, shown - 1));
        let x = 0;
        return (
          <li key={i} className="vz-share" data-visual-row={i}>
            {(v.rows.length > 1 || r.label !== '') && <span className="vz-share-label">{label(r.label)}</span>}
            {width > 0 && sum > 0 && (
              <svg width={width} height={18} role="img" aria-label={`${plain(r.label)}: ${v.series.map((s, j) => `${plain(s)} ${fmt((100 * parts[j]!) / sum)} %`).join(', ')}`}>
                {parts.map((p, j) => {
                  if (p <= 0) return null;
                  const w = (usable * p) / sum;
                  const rect = <rect key={j} className={`vz-fill-${(j % 8) + 1}`} x={x} y={0} width={Math.max(1, w)} height={18} rx={j === 0 || x + w >= usable - 0.5 ? 4 : 0}><title>{`${plain(v.series[j] ?? '')}: ${fmt((100 * p) / sum)} %`}</title></rect>;
                  x += w + GAP;
                  return rect;
                })}
              </svg>
            )}
          </li>
        );
      })}
    </ul>
    </div>
  );
}

/* -- Funktionen ---------------------------------------------------------------------------------------------- */

const SAMPLES = 240;

function Plot({ v, label }: { v: PlotVisual; label: LabelOf }) {
  const t = useT();
  const fmt = useNumber();
  const [ref, width] = useWidth();
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [x0, x1] = v.xRange;
  const compiled = useMemo(() => v.functions.map((f) => compile(f.expr, (name) => name === 'x')), [v.functions]);
  const errors = compiled.map((c, i) => (isExprError(c) ? t('visuals.warn.badExpr', { f: v.functions[i]!.label, error: c.error }) : null)).filter((e): e is string => e !== null);
  /* Die Werte je Funktion (NaN: nicht definiert — dort bricht die Linie). */
  const samples = useMemo(() => compiled.map((c) => {
    if (isExprError(c)) return null;
    const out: [number, number][] = [];
    for (let k = 0; k <= SAMPLES; k += 1) {
      const x = x0 + ((x1 - x0) * k) / SAMPLES;
      const yv = toNum(c.run({ x }));
      out.push([x, Number.isFinite(yv) ? yv : NaN]);
    }
    return out;
  }), [compiled, x0, x1]);
  const ys = samples.flatMap((s) => (s ?? []).map((p) => p[1]).filter(Number.isFinite)).concat(v.points.map((p) => p.y));
  /* Ohne eigenen Bereich: was die Funktionen zeigen, ohne die Ausreisser (Polstellen) — das 2.–98. Perzentil. */
  const sorted = [...ys].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))] ?? 0;
  const auto: [number, number] = sorted.length === 0 ? [-1, 1] : [Math.min(q(0.02), 0), Math.max(q(0.98), 0)];
  const [ya, yb] = v.yRange ?? (auto[0] === auto[1] ? [auto[0] - 1, auto[1] + 1] : auto);
  const yTicks = niceTicks(ya, yb, 5);
  const xTicks = niceTicks(x0, x1, Math.max(3, Math.min(10, Math.floor(width / 70))));
  const lo = v.yRange === null ? yTicks[0]! : ya;
  const hi = v.yRange === null ? yTicks[yTicks.length - 1]! : yb;
  const padL = Math.min(56, 14 + 7 * Math.max(...yTicks.map((x) => fmt(x).length)));
  const H = Math.round(Math.max(180, Math.min(340, width * 0.62)));
  const plotW = Math.max(0, width - padL - PAD_R);
  const X = (x: number) => padL + (plotW * (x - x0)) / (x1 - x0);
  const Y = (y: number) => PAD_T + (H - PAD_T) * (1 - (y - lo) / (hi - lo || 1));
  const paths = samples.map((s) => {
    if (s === null) return '';
    let d = '';
    let pen = false;
    let prev: number | null = null;
    for (const [x, yv] of s) {
      /* Ein Sprung über den halben Bildbereich zwischen zwei Nachbarn ist eine Polstelle: dort nicht verbinden. */
      if (!Number.isFinite(yv) || (prev !== null && Math.abs(yv - prev) > (hi - lo) * 0.5)) { pen = false; prev = Number.isFinite(yv) ? yv : null; if (!Number.isFinite(yv)) continue; }
      const py = Math.max(-H, Math.min(2 * H, Y(yv)));
      d += `${pen ? 'L' : 'M'}${X(x).toFixed(1)},${py.toFixed(1)} `;
      pen = true;
      prev = yv;
    }
    return d;
  });
  const clip = `vz-clip-${useMemo(() => Math.random().toString(36).slice(2, 8), [])}`;
  const valueAt = (i: number, x: number): number | null => {
    const c = compiled[i];
    if (c === undefined || isExprError(c)) return null;
    const yv = toNum(c.run({ x }));
    return Number.isFinite(yv) ? yv : null;
  };
  const stepX = (x1 - x0) / 40;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { setHoverX(null); return; }
    const d = e.key === 'ArrowRight' ? stepX : e.key === 'ArrowLeft' ? -stepX : 0;
    if (d === 0) return;
    e.preventDefault();
    setHoverX((h) => Math.max(x0, Math.min(x1, (h ?? (x0 + x1) / 2) + d)));
  };
  const name = v.title === '' ? v.functions.map((f) => f.label).join(', ') : plain(v.title);
  const tableXs = xTicks.filter((x) => x >= x0 - 1e-9 && x <= x1 + 1e-9);
  return (
    <Figure kind="plot" title={v.title} source={v.source} label={label} table={v.functions.length === 0 ? undefined : (
      <table className="lib-table vz-table">
        <thead><tr><th>{label(v.x)}</th>{v.functions.map((f, i) => <th key={i}>{<span className="vz-fn">{f.label}</span>}</th>)}</tr></thead>
        <tbody>{tableXs.map((x) => <tr key={x}><th scope="row">{fmt(x)}</th>{v.functions.map((_f, i) => { const yv = valueAt(i, x); return <td key={i} className="vz-num">{yv === null ? '–' : fmt(yv)}</td>; })}</tr>)}</tbody>
      </table>
    )}>
      {v.functions.length > 1 && (
        <ul className="vz-legend" data-visual-legend={v.functions.length}>
          {v.functions.map((f, i) => <li key={i}><Swatch slot={(i % 8) + 1} line /><span>{<span className="vz-fn">{f.label}</span>}</span></li>)}
        </ul>
      )}
      {v.y !== '' && <p className="vz-yname">{label(v.y)}</p>}
      <div className="vz-plot" ref={ref}>
        {width > 0 && (
          <svg width={width} height={H + AXIS_H} role="img" aria-label={name} tabIndex={0} className="vz-svg"
            onPointerMove={(e) => { const px = e.clientX - e.currentTarget.getBoundingClientRect().left; setHoverX(Math.max(x0, Math.min(x1, x0 + ((px - padL) / Math.max(1, plotW)) * (x1 - x0)))); }}
            onPointerLeave={() => setHoverX(null)} onBlur={() => setHoverX(null)} onKeyDown={onKey}>
            <defs><clipPath id={clip}><rect x={padL} y={PAD_T} width={plotW} height={H - PAD_T} /></clipPath></defs>
            {yTicks.filter((v2) => v2 >= lo - 1e-9 && v2 <= hi + 1e-9).map((tv) => (
              <g key={`y${tv}`} aria-hidden>
                <line className={tv === 0 ? 'vz-axis' : 'vz-grid'} x1={padL} x2={width - PAD_R} y1={Y(tv)} y2={Y(tv)} />
                <text className="vz-tick" x={padL - 6} y={Y(tv) + 4} textAnchor="end">{fmt(tv)}</text>
              </g>
            ))}
            {tableXs.map((tv) => (
              <g key={`x${tv}`} aria-hidden>
                <line className={tv === 0 ? 'vz-axis' : 'vz-grid'} x1={X(tv)} x2={X(tv)} y1={PAD_T} y2={H} />
                <text className="vz-tick" x={X(tv)} y={H + 16} textAnchor="middle">{fmt(tv)}</text>
              </g>
            ))}
            <text className="vz-axis-name" x={width - PAD_R} y={H + AXIS_H - 1} textAnchor="end">{plain(v.x)}</text>
            <g clipPath={`url(#${clip})`}>
              {paths.map((d, i) => (d === '' ? null : <path key={i} className={`vz-line vz-stroke-${(i % 8) + 1}`} d={d} />))}
              {hoverX !== null && <line className="vz-cross" x1={X(hoverX)} x2={X(hoverX)} y1={PAD_T} y2={H} />}
              {hoverX !== null && v.functions.map((_f, i) => { const yv = valueAt(i, hoverX); return yv === null ? null : <circle key={i} className={`vz-dot vz-fill-${(i % 8) + 1}`} cx={X(hoverX)} cy={Y(yv)} r={4} />; })}
              {v.points.map((p, i) => <circle key={`p${i}`} className="vz-dot vz-point" cx={X(p.x)} cy={Y(p.y)} r={4.5} />)}
            </g>
            {v.points.map((p, i) => (p.label === '' ? null : <text key={`pl${i}`} className="vz-point-label" x={X(p.x) > width * 0.6 ? X(p.x) - 7 : X(p.x) + 7} y={Y(p.y) - 7} textAnchor={X(p.x) > width * 0.6 ? "end" : "start"}>{plain(p.label)}</text>))}
          </svg>
        )}
        {hoverX !== null && v.functions.length > 0 && (
          <Tip x={X(hoverX)} y={PAD_T + 8} width={width} title={<>{plain(v.x)} = {fmt(hoverX)}</>}
            lines={v.functions.map((f, i) => ({ key: String(i), slot: v.functions.length > 1 ? (i % 8) + 1 : null, value: (() => { const yv = valueAt(i, hoverX); return yv === null ? '–' : fmt(yv); })(), name: <span className="vz-fn">{f.label}</span> }))} />
        )}
      </div>
      {errors.length > 0 && <Warnings list={errors} />}
    </Figure>
  );
}

/* -- Schema und Baum ----------------------------------------------------------------------------------------- */

/**
 * SCHICHTEN: jeder Knoten eine Schicht tiefer als seine tiefste Quelle (Kreise werden an der Rückkante gebrochen), in der
 * Schicht nach dem Mittel seiner Nachbarn sortiert (vier Durchgänge hin und her) — so kreuzen sich wenige Kanten.
 */
export function layers(v: Pick<DiagramVisual, 'nodes' | 'edges'>): string[][] {
  const ids = v.nodes.map((n) => n.id);
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  const inn = new Map<string, string[]>(ids.map((id) => [id, []]));
  /* Rückkanten (Kreise) finden: Tiefensuche in der Reihenfolge der Knoten. */
  const state = new Map<string, 0 | 1 | 2>();
  const back = new Set<number>();
  const adj = new Map<string, { to: string; k: number }[]>(ids.map((id) => [id, []]));
  v.edges.forEach((e, k) => { if (e.from !== e.to) adj.get(e.from)?.push({ to: e.to, k }); });
  const visit = (id: string) => {
    state.set(id, 1);
    for (const { to, k } of adj.get(id) ?? []) {
      const s = state.get(to) ?? 0;
      if (s === 1) back.add(k); else if (s === 0) visit(to);
    }
    state.set(id, 2);
  };
  for (const id of ids) if ((state.get(id) ?? 0) === 0) visit(id);
  v.edges.forEach((e, k) => {
    if (e.from === e.to || back.has(k)) return;
    out.get(e.from)?.push(e.to);
    inn.get(e.to)?.push(e.from);
  });
  const rank = new Map<string, number>();
  const rankOf = (id: string, guard = 0): number => {
    const had = rank.get(id);
    if (had !== undefined) return had;
    const r = guard > ids.length ? 0 : Math.max(-1, ...(inn.get(id) ?? []).map((p) => rankOf(p, guard + 1))) + 1;
    rank.set(id, r);
    return r;
  };
  for (const id of ids) rankOf(id);
  const rows: string[][] = [];
  for (const id of ids) { const r = rank.get(id) ?? 0; (rows[r] ??= []).push(id); }
  const pos = new Map<string, number>();
  const place = () => rows.forEach((row) => row.forEach((id, i) => pos.set(id, i)));
  place();
  const mean = (list: readonly string[], own: number) => (list.length === 0 ? own : list.reduce((a, id) => a + (pos.get(id) ?? 0), 0) / list.length);
  for (let pass = 0; pass < 4; pass += 1) {
    const down = pass % 2 === 0;
    const order = down ? rows.keys() : [...rows.keys()].reverse();
    for (const r of order) {
      const row = rows[r];
      if (row === undefined) continue;
      row.sort((a, b) => mean(down ? inn.get(a) ?? [] : out.get(a) ?? [], pos.get(a) ?? 0) - mean(down ? inn.get(b) ?? [] : out.get(b) ?? [], pos.get(b) ?? 0));
      row.forEach((id, i) => pos.set(id, i));
    }
  }
  return rows.filter((row) => row !== undefined);
}

interface Box { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

function Diagram({ v, label }: { v: DiagramVisual; label: LabelOf }) {
  const rows = useMemo(() => layers(v), [v]);
  const byId = useMemo(() => new Map(v.nodes.map((n) => [n.id, n] as const)), [v]);
  const host = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<Map<string, Box> | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  /* Erst die Kästen (mit Zapis, auch Wzory) im Fluss, dann gemessen — die Kanten folgen den gemessenen Kästen. */
  useLayoutEffect(() => {
    const el = host.current;
    if (el === null) return undefined;
    const measure = () => {
      const base = el.getBoundingClientRect();
      const next = new Map<string, Box>();
      el.querySelectorAll<HTMLElement>('[data-visual-node]').forEach((n) => {
        const r = n.getBoundingClientRect();
        next.set(n.dataset.visualNode ?? '', { x: r.left - base.left + el.scrollLeft, y: r.top - base.top, w: r.width, h: r.height });
      });
      setBoxes(next);
      setSize({ w: el.scrollWidth, h: el.scrollHeight });
    };
    measure();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(el);
    /* Wzory werden später gesetzt (KaTeX lädt nach): dann ändert sich die Grösse eines Kastens. */
    el.querySelectorAll('[data-visual-node]').forEach((n) => watch?.observe(n));
    return () => watch?.disconnect();
  }, [rows]);
  const right = v.direction === 'right';
  const edgePath = (a: Box, b: Box): string => {
    if (right) {
      const sx = a.x + a.w, sy = a.y + a.h / 2, tx = b.x, ty = b.y + b.h / 2;
      if (tx <= sx) return `M${a.x + a.w / 2},${a.y + a.h} C${a.x + a.w / 2},${a.y + a.h + 30} ${b.x + b.w / 2},${b.y + b.h + 30} ${b.x + b.w / 2},${b.y + b.h}`;
      const m = (sx + tx) / 2;
      return `M${sx},${sy} C${m},${sy} ${m},${ty} ${tx},${ty}`;
    }
    const sx = a.x + a.w / 2, sy = a.y + a.h, tx = b.x + b.w / 2, ty = b.y;
    if (ty <= sy) return `M${a.x + a.w},${a.y + a.h / 2} C${a.x + a.w + 40},${a.y + a.h / 2} ${b.x + b.w + 40},${b.y + b.h / 2} ${b.x + b.w},${b.y + b.h / 2}`;
    const m = (sy + ty) / 2;
    return `M${sx},${sy} C${sx},${m} ${tx},${m} ${tx},${ty}`;
  };
  const mid = (a: Box, b: Box) => (right ? { x: (a.x + a.w + b.x) / 2, y: (a.y + a.h / 2 + b.y + b.h / 2) / 2 } : { x: (a.x + a.w / 2 + b.x + b.w / 2) / 2, y: (a.y + a.h + b.y) / 2 });
  const marker = `vz-arrow-${useMemo(() => Math.random().toString(36).slice(2, 8), [])}`;
  return (
    <Figure kind={v.tree ? 'tree' : 'diagram'} title={v.title} source={v.source} label={label}>
      <div className={`vz-diagram${right ? ' is-right' : ''}`} ref={host} role="img" aria-label={[plain(v.title), ...v.edges.map((e) => `${plain(byId.get(e.from)?.label ?? '')} → ${plain(byId.get(e.to)?.label ?? '')}`)].filter((x) => x !== '').join('; ')}>
        {boxes !== null && (
          <svg className="vz-edges" width={size.w} height={size.h} aria-hidden>
            <defs>
              <marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path className="vz-arrow" d="M0,0 L10,5 L0,10 z" />
              </marker>
            </defs>
            {v.edges.map((e, k) => {
              const a = boxes.get(e.from), b = boxes.get(e.to);
              if (a === undefined || b === undefined || e.from === e.to) return null;
              const arrow = e.style === 'arrow' || e.style === 'dashed' || e.style === 'both';
              return <path key={k} className={`vz-edge${e.style === 'dashed' ? ' is-dashed' : ''}`} d={edgePath(a, b)}
                markerEnd={arrow ? `url(#${marker})` : undefined} markerStart={e.style === 'both' ? `url(#${marker})` : undefined} />;
            })}
            {v.edges.map((e, k) => {
              const a = boxes.get(e.from), b = boxes.get(e.to);
              if (a === undefined || b === undefined || e.label === '') return null;
              const p = mid(a, b);
              return <text key={`l${k}`} className="vz-edge-label" x={p.x} y={p.y + 4} textAnchor="middle">{plain(e.label)}</text>;
            })}
          </svg>
        )}
        {rows.map((row, r) => (
          <div key={r} className="vz-layer" data-visual-layer={r}>
            {row.map((id) => <div key={id} className="vz-node" data-visual-node={id}>{label(byId.get(id)?.label ?? id)}</div>)}
          </div>
        ))}
      </div>
    </Figure>
  );
}

/* -- Zeitleiste --------------------------------------------------------------------------------------------- */

function Timeline({ v, label }: { v: TimelineVisual; label: LabelOf }) {
  return (
    <Figure kind="timeline" title={v.title} source={v.source} label={label}>
      <ol className="vz-timeline">
        {v.items.map((item, i) => (
          <li key={i} className="vz-moment" data-visual-moment={i}>
            <span className="vz-when">{label(item.when)}</span>
            <span className="vz-what">{label(item.what)}</span>
          </li>
        ))}
      </ol>
    </Figure>
  );
}

/* -- Ganz ---------------------------------------------------------------------------------------------------- */

function Warnings({ list }: { list: readonly string[] }) {
  const t = useT();
  return (
    <details className="vz-warn" data-visual-warn={list.length}>
      <summary>{t('visuals.warnings', { count: list.length })}</summary>
      <ul>{list.map((w, i) => <li key={i}>{w}</li>)}</ul>
    </details>
  );
}

/** Eine Grafik aus einem Zaun — gezeichnet, was stimmt; was nicht, darunter als Warnung; nichts zu zeichnen: der Text des Zauns. */
export default function Visual({ lang, info, body, label }: { lang: string; info: string; body: string; label: LabelOf }) {
  const t = useT();
  const read = useMemo(() => readVisual(lang, info, body), [lang, info, body, t.lang]);
  const v = read.visual;
  return (
    <div className="vz-host" data-visual-kind={v?.kind ?? 'none'}>
      {v === null ? (
        <div className="vz-broken">
          <p className="vz-broken-head">{t('visuals.cannotDraw')}</p>
          <pre className="lib-code"><code>{body}</code></pre>
        </div>
      ) : v.kind === 'chart' ? <Chart v={v} label={label} />
        : v.kind === 'plot' ? <Plot v={v} label={label} />
        : v.kind === 'timeline' ? <Timeline v={v} label={label} />
        : <Diagram v={v} label={label} />}
      {read.warnings.length > 0 && <Warnings list={read.warnings} />}
    </div>
  );
}

