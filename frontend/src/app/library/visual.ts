/**
 * 2026-11-16 (Eigentümer: „in Cogita etwas zeigen können — richtig, als Struktur; besonders wo etwas erklärt wird, auch
 * Diagramme und andere Grafiken; in alles integriert") — GRAFIKEN IM ZAPIS.
 *
 * <b>Eine Stelle, überall.</b> Jeder Text, den der eine Leser (`libraryMarkup.ts`) liest — ein Eintrag der Baza wiedzy, die
 * Erklärung und die Hinweise einer Frage, ein Slajd, „Czytaj tekst", ein Schritt eines Przebiegu, ein Text der Bibliothek
 * oder des Skryptorium —, trägt Grafiken als umzäunte Blöcke, wie in Markdown:
 *
 * <code>
 *   ```chart Ludność (mln)          ein Diagramm aus einer Tabelle: bar · hbar · line · stacked · share · scatter
 *   type: line
 *   | Rok  | Polska | Czechy |
 *   | 1950 | 25,0   | 8,9    |
 *   ```
 *   ```plot                         Funktionen: y = …, Punkte, Bereich
 *   y = sin(x)
 *   x: -6..6
 *   ```
 *   ```diagram                      ein Schema: A -> B: Beschriftung · A -- B · A ..> B (gestrichelt)
 *   ```tree                         ein Baum aus Einrückungen
 *   ```timeline                     1815: Narodziny
 *   | a | b |                       eine Tabelle (ohne Zaun)
 * </code>
 *
 * Ein anderer Zaun (```python, ``` ) ist Code. Hier wird nur GELESEN — rein, ohne Oberfläche (geprüft in
 * `app-visual-check`); gezeichnet in `visuals/Visuals.tsx`. Was nicht stimmt, sagt eine Warnung, und gezeichnet wird, was
 * stimmt — ein Fehler leert nie den ganzen Text. Beschriftungen bleiben Zapis (Wzory `$…$`, **fett**, `[[Wort|@…]]`).
 */

import { t } from '../core/i18n';

export const VISUAL_KINDS = ['chart', 'plot', 'diagram', 'tree', 'timeline'] as const;
export type VisualKind = (typeof VISUAL_KINDS)[number];
export const isVisualKind = (lang: string): lang is VisualKind => (VISUAL_KINDS as readonly string[]).includes(lang);

/** Polnische und deutsche Namen der Zäune — wer „wykres" schreibt, meint „chart". */
const KIND_ALIASES: Readonly<Record<string, VisualKind>> = {
  wykres: 'chart', diagramm: 'chart', graph: 'chart',
  funkcja: 'plot', funktion: 'plot', wykresfunkcji: 'plot',
  schemat: 'diagram', schema: 'diagram', flow: 'diagram', flowchart: 'diagram',
  drzewo: 'tree', baum: 'tree',
  'oś-czasu': 'timeline', osczasu: 'timeline', zeitleiste: 'timeline', chronologia: 'timeline' // i18n-ignore (Schreibweisen, keine Anzeige)
};
export const visualKindOf = (lang: string): VisualKind | null => {
  const l = lang.trim().toLowerCase();
  return isVisualKind(l) ? l : KIND_ALIASES[l] ?? KIND_ALIASES[l.replace(/[\s_]/g, '')] ?? null;
};

export type ChartType = 'bar' | 'hbar' | 'line' | 'stacked' | 'share' | 'scatter';
const CHART_TYPES: Readonly<Record<string, ChartType>> = {
  bar: 'bar', bars: 'bar', column: 'bar', columns: 'bar', słupki: 'bar', kolumny: 'bar', säulen: 'bar', // i18n-ignore (Schreibweisen, keine Anzeige)
  hbar: 'hbar', horizontal: 'hbar', poziome: 'hbar', balken: 'hbar',
  line: 'line', lines: 'line', linia: 'line', linie: 'line',
  stacked: 'stacked', stack: 'stacked', stos: 'stacked', gestapelt: 'stacked',
  share: 'share', parts: 'share', udział: 'share', części: 'share', anteile: 'share', pie: 'share', kołowy: 'share', // i18n-ignore (Schreibweisen, keine Anzeige)
  scatter: 'scatter', points: 'scatter', punkty: 'scatter', punkte: 'scatter'
};

/** So viele Reihen hat ein Diagramm höchstens (die geprüfte Palette); Punkte nur drei (alle Paare müssen unterscheidbar sein). */
export const MAX_SERIES = 8;
export const MAX_SCATTER_SERIES = 3;
export const MAX_ROWS = 200;
export const MAX_FUNCTIONS = 6;
export const MAX_NODES = 80;
export const MAX_ITEMS = 120;

export interface ChartVisual {
  readonly kind: 'chart';
  readonly type: ChartType;
  readonly title: string;
  readonly x: string;
  readonly y: string;
  readonly unit: string;
  readonly source: string;
  /** Die Namen der Reihen (die Spalten nach der ersten). */
  readonly series: readonly string[];
  /** Je Zeile: ihre Bezeichnung (erste Spalte), ihre Zahl als x (wenn sie eine ist) und ein Wert je Reihe (`null`: leer). */
  readonly rows: readonly { readonly label: string; readonly at: number | null; readonly values: readonly (number | null)[] }[];
}

export interface PlotFunction { readonly label: string; readonly expr: string }
export interface PlotPoint { readonly x: number; readonly y: number; readonly label: string }
export interface PlotVisual {
  readonly kind: 'plot';
  readonly title: string;
  readonly x: string;
  readonly y: string;
  readonly source: string;
  readonly functions: readonly PlotFunction[];
  readonly points: readonly PlotPoint[];
  readonly xRange: readonly [number, number];
  readonly yRange: readonly [number, number] | null;
}

export type EdgeStyle = 'arrow' | 'line' | 'dashed' | 'both';
export interface DiagramNode { readonly id: string; readonly label: string }
export interface DiagramEdge { readonly from: string; readonly to: string; readonly label: string; readonly style: EdgeStyle }
export interface DiagramVisual {
  readonly kind: 'diagram';
  readonly tree: boolean;
  readonly title: string;
  readonly source: string;
  readonly direction: 'down' | 'right';
  readonly nodes: readonly DiagramNode[];
  readonly edges: readonly DiagramEdge[];
}

export interface TimelineVisual {
  readonly kind: 'timeline';
  readonly title: string;
  readonly source: string;
  readonly items: readonly { readonly when: string; readonly what: string }[];
}

export type Visual = ChartVisual | PlotVisual | DiagramVisual | TimelineVisual;
export interface ReadVisual { readonly visual: Visual | null; readonly warnings: readonly string[] }

/* -- Kleine Leser ----------------------------------------------------------------------------------------- */

/** Die Schlüssel der Einstellungen (englisch, wie im Leitfaden; polnische und deutsche Namen gehen auch). */
const OPTION_KEYS: Readonly<Record<string, string>> = {
  type: 'type', typ: 'type', art: 'type', rodzaj: 'type',
  title: 'title', tytuł: 'title', tytul: 'title', titel: 'title', // i18n-ignore (Schreibweisen, keine Anzeige)
  x: 'x', y: 'y',
  unit: 'unit', jednostka: 'unit', einheit: 'unit',
  source: 'source', źródło: 'source', zrodlo: 'source', quelle: 'source', // i18n-ignore (Schreibweisen, keine Anzeige)
  direction: 'direction', kierunek: 'direction', richtung: 'direction',
  point: 'point', punkt: 'point'
};

/** `klucz: wartość` — nur ein bekannter Schlüssel (sonst ist die Zeile Inhalt, z. B. `1815: Narodziny`). */
function optionOf(line: string, allowed: readonly string[]): { key: string; value: string } | null {
  const m = /^\s*([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ]+)\s*:\s*(.*)$/.exec(line);
  if (m === null) return null;
  const key = OPTION_KEYS[m[1].toLowerCase()];
  return key !== undefined && allowed.includes(key) ? { key, value: m[2].trim() } : null;
}

/**
 * Eine Zahl, wie Menschen sie schreiben: `1 234,5`, `1234.5`, `12 %`, `−3`. `comma`: das Komma trennt Dezimalen
 * (in einer Tabelle mit `|`, `;` oder Tabulator); sonst ist es kein Teil einer Zahl.
 */
export function numberOf(text: string, comma = true): number | null {
  let s = text.trim().replace(/[  \s]/g, '').replace(/[−–]/g, '-').replace(/%$/, '');
  if (s === '' || s === '-') return null;
  if (comma) {
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
  }
  if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** `-3..3`, `-3 – 3`, `0 do 10`, `[0, 10]` — ein Bereich zweier Zahlen (die kleinere zuerst). */
export function rangeOf(text: string): [number, number] | null {
  const s = text.trim().replace(/^\[|\]$/g, '');
  const m = /^(.+?)\s*(?:\.\.|…|\s[–—-]\s|;|\sdo\s|\sbis\s|\sto\s)\s*(.+)$/.exec(s) ?? /^(-?[\d.,]+)\s*[–—]\s*(-?[\d.,]+)$/.exec(s);
  if (m === null) return null;
  const a = numberOf(m[1].replace(/^\(|\)$/g, ''), false) ?? numberOf(m[1]);
  const b = numberOf(m[2].replace(/^\(|\)$/g, ''), false) ?? numberOf(m[2]);
  if (a === null || b === null || a === b) return null;
  return a < b ? [a, b] : [b, a];
}

/** Eine Zeile einer Tabelle in Zellen — nach dem Trenner, der in der Kopfzeile steht. */
function cellsOf(line: string, sep: string): string[] {
  if (sep === '|') return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  return line.split(sep).map((c) => c.trim());
}
/** `|---|:-:|--:|` — auch kurz (`:-:`); ein einzelnes `-` in jeder Zelle ist keine Trennzeile (das ist „leer"). */
const isRule = (line: string) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && /--|:-|-:/.test(line);
function separatorOf(header: string): string {
  if (header.includes('|')) return '|';
  if (header.includes('\t')) return '\t';
  if (header.includes(';')) return ';';
  return ',';
}

/* -- Diagramm --------------------------------------------------------------------------------------------- */

function readChart(info: string, lines: readonly string[], warnings: string[]): ChartVisual | null {
  const opts: Record<string, string> = { title: info };
  let i = 0;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const o = optionOf(line, ['type', 'title', 'x', 'y', 'unit', 'source']);
    if (o === null) break;
    opts[o.key] = o.value;
  }
  let type: ChartType = 'bar';
  if (opts.type !== undefined) {
    const said = CHART_TYPES[opts.type.trim().toLowerCase()];
    if (said === undefined) warnings.push(t('visuals.warn.chartType', { type: opts.type }));
    else type = said;
  }
  const data = lines.slice(i).filter((l) => l.trim() !== '' && !isRule(l));
  if (data.length < 2) { warnings.push(t('visuals.warn.noData')); return null; }
  const sep = separatorOf(data[0]);
  const comma = sep !== ',';
  const head = cellsOf(data[0], sep);
  let series = head.slice(1);
  if (series.length === 0) { warnings.push(t('visuals.warn.noSeries')); return null; }
  const cap = type === 'scatter' ? MAX_SCATTER_SERIES : MAX_SERIES;
  if (series.length > cap) { warnings.push(t('visuals.warn.tooManySeries', { count: cap })); series = series.slice(0, cap); }
  const rows: { label: string; at: number | null; values: (number | null)[] }[] = [];
  for (const [n, line] of data.slice(1).entries()) {
    if (rows.length >= MAX_ROWS) { warnings.push(t('visuals.warn.tooManyRows', { count: MAX_ROWS })); break; }
    const cells = cellsOf(line, sep);
    const values = series.map((_s, j) => {
      const raw = cells[j + 1] ?? '';
      const v = numberOf(raw, comma);
      if (v === null && raw.trim() !== '' && raw.trim() !== '-') warnings.push(t('visuals.warn.notNumber', { row: n + 2, text: raw }));
      return v;
    });
    rows.push({ label: cells[0] ?? '', at: numberOf(cells[0] ?? '', comma), values });
  }
  if (rows.length === 0 || rows.every((r) => r.values.every((v) => v === null))) { warnings.push(t('visuals.warn.noData')); return null; }
  if (type === 'scatter' && rows.some((r) => r.at === null)) { warnings.push(t('visuals.warn.scatterX')); return null; }
  if ((type === 'stacked' || type === 'share') && rows.some((r) => r.values.some((v) => v !== null && v < 0))) warnings.push(t('visuals.warn.negativeParts'));
  return { kind: 'chart', type, title: opts.title ?? '', x: opts.x ?? (head[0] ?? ''), y: opts.y ?? '', unit: opts.unit ?? '', source: opts.source ?? '', series, rows };
}

/* -- Funktionen ------------------------------------------------------------------------------------------- */

function readPlot(info: string, lines: readonly string[], warnings: string[]): PlotVisual | null {
  const opts: Record<string, string> = { title: info };
  const functions: PlotFunction[] = [];
  const points: PlotPoint[] = [];
  let xRange: [number, number] = [-5, 5];
  let yRange: [number, number] | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') continue;
    const o = optionOf(line, ['title', 'x', 'y', 'source', 'point']);
    if (o !== null) {
      if (o.key === 'x' || o.key === 'y') {
        /* `x: -3..3` ist ein Bereich; `x: czas [s]` die Beschriftung der Achse; `x: -3..3 czas [s]` beides. */
        const m = /^(\S+\s*(?:\.\.|…)\s*\S+)(?:\s+(.*))?$/.exec(o.value);
        const r = m === null ? null : rangeOf(m[1]);
        if (r !== null) {
          if (o.key === 'x') xRange = r; else yRange = r;
          if (m?.[2] !== undefined) opts[o.key] = m[2];
        } else if (/^[-\d.,\s]+(\.\.|…)/.test(o.value)) warnings.push(t('visuals.warn.badRange', { text: o.value }));
        else opts[o.key] = o.value;
        continue;
      }
      if (o.key === 'point') {
        const p = /^\(?\s*([-−\d.,]+)\s*[,;]\s*([-−\d.,]+)\s*\)?\s*(.*)$/.exec(o.value.replace(/,(?=\s*[-−\d])/, ';'));
        const x = p === null ? null : numberOf(p[1], false);
        const y = p === null ? null : numberOf(p[2], false);
        if (p === null || x === null || y === null) warnings.push(t('visuals.warn.badPoint', { text: o.value }));
        else points.push({ x, y, label: p[3].trim() });
        continue;
      }
      opts[o.key] = o.value;
      continue;
    }
    /* `y = …`, `f(x) = …`, `g(x) = … ; etykieta` — eine Funktion von x. */
    const f = /^([A-Za-zα-ω][\w']*(?:\(x\))?)\s*=\s*(.+)$/.exec(line);
    if (f !== null) {
      if (functions.length >= MAX_FUNCTIONS) { warnings.push(t('visuals.warn.tooManyFunctions', { count: MAX_FUNCTIONS })); continue; }
      functions.push({ label: f[1] === 'y' ? `y = ${f[2].trim()}` : `${f[1]} = ${f[2].trim()}`, expr: f[2].trim() });
      continue;
    }
    warnings.push(t('visuals.warn.badLine', { text: line }));
  }
  if (functions.length === 0 && points.length === 0) { warnings.push(t('visuals.warn.noFunction')); return null; }
  return { kind: 'plot', title: opts.title ?? '', x: opts.x ?? 'x', y: opts.y ?? 'y', source: opts.source ?? '', functions, points, xRange, yRange };
}

/* -- Schema und Baum -------------------------------------------------------------------------------------- */

const EDGE = /^(.+?)\s*(<->|-->|->|<-|\.\.>|\.\.|--|—>|→|↔)\s*(.+?)(?:\s*:\s*(.+))?$/;
const unquote = (s: string) => s.trim().replace(/^["„“](.*)["”]$/, '$1').trim();

function readDiagram(info: string, lines: readonly string[], warnings: string[], tree: boolean): DiagramVisual | null {
  const opts: Record<string, string> = { title: info };
  const nodes = new Map<string, DiagramNode>();
  const edges: DiagramEdge[] = [];
  const node = (text: string): string | null => {
    /* `id[Etykieta]` nennt einen Knoten einmal mit langem Text; danach genügt `id`. */
    const m = /^([^[\]]+?)\s*\[(.+)\]$/.exec(text.trim());
    const id = unquote(m === null ? text : m[1]);
    if (id === '') return null;
    const label = m === null ? id : unquote(m[2]);
    const had = nodes.get(id);
    if (had === undefined) {
      if (nodes.size >= MAX_NODES) { warnings.push(t('visuals.warn.tooManyNodes', { count: MAX_NODES })); return null; }
      nodes.set(id, { id, label });
    } else if (m !== null) nodes.set(id, { id, label });
    return id;
  };
  if (tree) {
    /* Ein Baum: jede Zeile ein Knoten, eingerückt unter den letzten weniger eingerückten (auch „- " davor). */
    const stack: { depth: number; id: string }[] = [];
    let seen = 0;
    for (const raw of lines) {
      if (raw.trim() === '') continue;
      const o = optionOf(raw, ['title', 'direction', 'source']);
      if (o !== null && stack.length === 0) { opts[o.key] = o.value; continue; }
      const depth = raw.replace(/\t/g, '  ').search(/\S/);
      const text = raw.trim().replace(/^[-*•]\s+/, '');
      seen += 1;
      /* Gleicher Wortlaut zweimal im Baum: zwei Knoten (ein Baum hat keine Kreise). */
      const label = text;
      const id = nodes.has(unquote(text)) ? `${unquote(text)}#${seen}` : unquote(text);
      if (nodes.size >= MAX_NODES) { warnings.push(t('visuals.warn.tooManyNodes', { count: MAX_NODES })); break; }
      nodes.set(id, { id, label: unquote(label) });
      while (stack.length > 0 && stack[stack.length - 1].depth >= depth) stack.pop();
      if (stack.length > 0) edges.push({ from: stack[stack.length - 1].id, to: id, label: '', style: 'line' });
      stack.push({ depth, id });
    }
  } else {
    for (const raw of lines) {
      const line = raw.trim();
      if (line === '') continue;
      const o = optionOf(line, ['title', 'direction', 'source']);
      if (o !== null) { opts[o.key] = o.value; continue; }
      /* Eine Kette `A -> B -> C` ist zwei Kanten. */
      const parts = line.split(/\s*(<->|-->|->|<-|\.\.>|\.\.|--|—>|→|↔)\s*/);
      if (parts.length >= 3) {
        const last = parts[parts.length - 1];
        const colon = /^(.+?)\s*:\s*(.+)$/.exec(last);
        const tail = parts.length === 3 && colon !== null && !/\[[^\]]*:/.test(last) ? colon[1] : last;
        const label = parts.length === 3 && colon !== null && tail === colon[1] ? colon[2].trim() : '';
        const chain = [...parts.slice(0, -1), tail];
        for (let k = 0; k + 2 < chain.length; k += 2) {
          const a = node(chain[k]);
          const b = node(chain[k + 2]);
          const op = chain[k + 1];
          if (a === null || b === null) continue;
          const style: EdgeStyle = op === '--' ? 'line' : op === '..' || op === '..>' ? 'dashed' : op === '<->' || op === '↔' ? 'both' : 'arrow';
          if (op === '<-') edges.push({ from: b, to: a, label, style });
          else edges.push({ from: a, to: b, label, style });
        }
        continue;
      }
      if (!EDGE.test(line)) { if (node(line) === null) warnings.push(t('visuals.warn.badLine', { text: line })); }
    }
  }
  if (nodes.size === 0) { warnings.push(t('visuals.warn.noNodes')); return null; }
  const dir = (opts.direction ?? '').trim().toLowerCase();
  const direction = ['right', 'prawo', 'w prawo', 'rechts', 'lr', 'horizontal', 'poziomo'].includes(dir) ? 'right' : 'down';
  if (dir !== '' && direction === 'down' && !['down', 'dół', 'w dół', 'unten', 'td', 'vertical', 'pionowo'].includes(dir)) warnings.push(t('visuals.warn.direction', { text: opts.direction ?? '' })); // i18n-ignore (Schreibweisen, keine Anzeige)
  return { kind: 'diagram', tree, title: opts.title ?? '', source: opts.source ?? '', direction, nodes: [...nodes.values()], edges };
}

/* -- Zeitleiste ------------------------------------------------------------------------------------------- */

function readTimeline(info: string, lines: readonly string[], warnings: string[]): TimelineVisual | null {
  const opts: Record<string, string> = { title: info };
  const items: { when: string; what: string }[] = [];
  for (const raw of lines) {
    const line = raw.trim().replace(/^[-*•]\s+/, '');
    if (line === '') continue;
    const o = items.length === 0 ? optionOf(line, ['title', 'source']) : null;
    if (o !== null) { opts[o.key] = o.value; continue; }
    /* `1815: Narodziny`, `1939–1945: Wojna`, `XIV w. — …`: das Datum vor dem ersten „:" oder „ — ". */
    const m = /^(.{1,60}?)\s*(?::|\s[—–]\s)\s*(.+)$/.exec(line);
    if (m === null) { warnings.push(t('visuals.warn.badLine', { text: line })); continue; }
    if (items.length >= MAX_ITEMS) { warnings.push(t('visuals.warn.tooManyItems', { count: MAX_ITEMS })); break; }
    items.push({ when: m[1].trim(), what: m[2].trim() });
  }
  if (items.length === 0) { warnings.push(t('visuals.warn.noItems')); return null; }
  return { kind: 'timeline', title: opts.title ?? '', source: opts.source ?? '', items };
}

/* -- Ganz ------------------------------------------------------------------------------------------------- */

/** Ein umzäunter Block als Grafik: `lang` die Art nach den drei Backticks, `info` der Rest der Zeile (der Titel). */
export function readVisual(lang: string, info: string, body: string): ReadVisual {
  const kind = visualKindOf(lang);
  const warnings: string[] = [];
  if (kind === null) return { visual: null, warnings: [t('visuals.warn.unknownKind', { kind: lang })] };
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const title = info.trim();
  const visual = kind === 'chart' ? readChart(title, lines, warnings)
    : kind === 'plot' ? readPlot(title, lines, warnings)
    : kind === 'timeline' ? readTimeline(title, lines, warnings)
    : readDiagram(title, lines, warnings, kind === 'tree');
  return { visual, warnings };
}

/**
 * Eine Grafik als schlichter Text — für die Suche, Auszüge, Vorlesen und alles, was keine Bilder zeigt: was sie ist, ihr
 * Titel, dann ihr Inhalt Zeile für Zeile (die Werte einer Tabelle, die Kanten eines Schemas, die Daten einer Zeitleiste).
 */
export function visualPlain(lang: string, info: string, body: string): string {
  const { visual } = readVisual(lang, info, body);
  if (visual === null) return '';
  const head = (word: string, title: string) => (title === '' ? word : `${word}: ${title}`);
  switch (visual.kind) {
    case 'chart': return [head(t('visuals.plain.chart'), visual.title), [visual.x, ...visual.series].join(' | '),
      ...visual.rows.map((r) => [r.label, ...r.values.map((v) => (v === null ? '–' : String(v)))].join(' | '))].join('\n');
    case 'plot': return [head(t('visuals.plain.plot'), visual.title), ...visual.functions.map((f) => f.label), ...visual.points.map((p) => `(${p.x}; ${p.y}) ${p.label}`.trim())].join('\n');
    case 'timeline': return [head(t('visuals.plain.timeline'), visual.title), ...visual.items.map((i) => `${i.when}: ${i.what}`)].join('\n');
    case 'diagram': {
      const label = new Map(visual.nodes.map((n) => [n.id, n.label] as const));
      const linked = new Set(visual.edges.flatMap((e) => [e.from, e.to]));
      return [head(t(visual.tree ? 'visuals.plain.tree' : 'visuals.plain.diagram'), visual.title),
        ...visual.edges.map((e) => `${label.get(e.from)} → ${label.get(e.to)}${e.label === '' ? '' : ` (${e.label})`}`),
        ...visual.nodes.filter((n) => !linked.has(n.id)).map((n) => n.label)].join('\n');
    }
  }
}

/* -- Zum Einfügen ------------------------------------------------------------------------------------------ */

/** Was der Knopf „Wstaw grafikę" einfügt — je Art ein kleines, richtiges Beispiel in der Sprache der App. */
export function visualTemplate(kind: VisualKind | 'table'): string {
  switch (kind) {
    case 'chart': return [`\`\`\`chart ${t('visuals.template.chartTitle')}`, 'type: bar', `| ${t('visuals.template.year')} | ${t('visuals.template.seriesA')} | ${t('visuals.template.seriesB')} |`, '| 2020 | 12 | 9 |', '| 2021 | 15 | 11 |', '| 2022 | 18 | 14 |', '```'].join('\n');
    case 'plot': return [`\`\`\`plot ${t('visuals.template.plotTitle')}`, 'y = x^2 / 4', 'y = sin(x)', 'x: -4..4', `point: 2, 1 ${t('visuals.template.point')}`, '```'].join('\n');
    case 'diagram': return [`\`\`\`diagram ${t('visuals.template.diagramTitle')}`, `${t('visuals.template.cause')} -> ${t('visuals.template.effect')}: ${t('visuals.template.leadsTo')}`, `${t('visuals.template.effect')} -> ${t('visuals.template.result')}`, `${t('visuals.template.cause')} ..> ${t('visuals.template.result')}`, '```'].join('\n');
    case 'tree': return [`\`\`\`tree ${t('visuals.template.treeTitle')}`, t('visuals.template.root'), `  ${t('visuals.template.branch')} 1`, `    ${t('visuals.template.leaf')} 1a`, `    ${t('visuals.template.leaf')} 1b`, `  ${t('visuals.template.branch')} 2`, '```'].join('\n');
    case 'timeline': return [`\`\`\`timeline ${t('visuals.template.timelineTitle')}`, `1815: ${t('visuals.template.eventA')}`, `1841: ${t('visuals.template.eventB')}`, `1859–1888: ${t('visuals.template.eventC')}`, '```'].join('\n');
    case 'table': return [`| ${t('visuals.template.colA')} | ${t('visuals.template.colB')} |`, '|---|---|', `| ${t('visuals.template.cellA')} | ${t('visuals.template.cellB')} |`].join('\n');
  }
}
