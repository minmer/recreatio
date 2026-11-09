/**
 * 2026-10-26 — DIE ABLÄUFE LAUFEN LASSEN (Plan und Regel), ohne Dienst.
 *
 * <b>Plan</b> (`planDay`, `planRange`): für jeden Tag einmal vom Knoten `day`
 * aus — Kirchenjahr, Feste, Bedingungen — bis `slots` (die Messen des Tages)
 * oder `skip` (keine). Dann für jede Messe vom Knoten `mass` aus, mit dem, was
 * der Tag gesetzt hat, bis `end` (anlegen) oder `skip` (nicht). Endet die
 * Messe ohne `end`, wird sie mit dem Gesetzten angelegt; endet der TAG ohne
 * `slots`, gibt es an ihm keine Messe — und die Vorschau sagt, warum
 * (`problems`). Jeder Schritt steht in `trace`.
 *
 * <b>Regel</b> (`runRule`): vom Knoten `record-start` bis `allow` / `wait` /
 * `refuse`. Ohne Regel (oder ohne Ende): die Kanzlei nimmt an, von aussen
 * wartet.
 *
 * <b>Feste</b> (`feasts`): von den Zeilen, die an dem Tag gelten, gewinnt die
 * mit dem höchsten Rang (kleinste Zahl; bei Gleichstand die obere) — wenn ihr
 * Rang nicht hinter dem des Tages selbst zurückbleibt (ein Hochfest an einem
 * Adventssonntag fällt aus). Eine Zeile mit `moveIfImpeded` wandert, solange
 * sie verdrängt ist, auf den nächsten freien Tag (8. Dezember an einem
 * Adventssonntag → Montag; 25. März in der Karwoche → nach der Osteroktav).
 */

import type { PlanDef } from '../scheme';
import { t } from '../../core/i18n';
import {
  NODE_INFO,
  type Compare, type FeastRow, type FeastsData, type FlowDoc, type FlowNode, type FlowNodeType, type FlowOut, type IfData,
  type MessageData, type PlanCtx, type PlannedDay, type PlannedMass, type RecordData, type RuleCtx, type RuleResult,
  type SeasonData, type SetData, type SlotRow, type SlotsData, type Test, type Weekday
} from './flowModel';
import { addDays, dayAndMonth, dayInfo, describeDateRule, diffDays, isDate, matches, roman, WEEKDAY_NAME, yearOf, datesOf } from './liturgy';

/** Wie viele Schritte ein Weg höchstens geht — mehr ist eine Schleife. */
const MAX_STEPS = 200;

/** Wie viele Tage ein Plan auf einmal rechnet (wie das Fenster des Dienstes). */
export const MAX_PLAN_DAYS = 400;

/** Wie weit eine verdrängte Feier höchstens wandert (Karwoche und Osteroktav sind fünfzehn Tage). */
const MOVE_WINDOW = 21;

/* -- Der Graph ----------------------------------------------------------------------------- */

interface Graph {
  readonly byId: ReadonlyMap<string, FlowNode>;
  readonly outs: ReadonlyMap<string, ReadonlyMap<FlowOut, string>>;
}

const graphCache = new WeakMap<FlowDoc, Graph>();

function graphOf(doc: FlowDoc): Graph {
  const hit = graphCache.get(doc);
  if (hit !== undefined) return hit;
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const outs = new Map<string, Map<FlowOut, string>>();
  for (const edge of doc.edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue;
    const from = outs.get(edge.from) ?? new Map<FlowOut, string>();
    /* Die erste Kante je Ausgang zählt — eine zweite ist ein Fehler der Zeichnung, kein Verzweigen. */
    if (!from.has(edge.out ?? 'out')) from.set(edge.out ?? 'out', edge.to);
    outs.set(edge.from, from);
  }
  const graph = { byId, outs };
  graphCache.set(doc, graph);
  return graph;
}

/** Der erste Knoten dieser Art — der Einstieg. */
const entryOf = (doc: FlowDoc, type: FlowNodeType): FlowNode | undefined => doc.nodes.find((n) => n.type === type);

const outLabel = (out: FlowOut): string => t(`calendarApp.flow.out.${out}`);
const yesNo = (yes: boolean): string => t(yes ? 'calendarApp.flow.out.yes' : 'calendarApp.flow.out.no');

const label = (node: FlowNode) => NODE_INFO[node.type]?.label ?? node.type;

/* -- Platzhalter ------------------------------------------------------------------------------ */

const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

const polishDate = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number);
  return `${d}.${String(m).padStart(2, '0')}.${y}`;
};

/**
 * Ein Text mit Platzhaltern, ausgefüllt: {celebration} {celebrationTitle}
 * {title} {season} {seasonName} {week} {weekRoman} {sundayName} {dayName}
 * {weekday} {colour} {date} {dateWords} {time} {slot} — und jede Variable aus
 * `set`. Unbekannte bleiben stehen, damit die Vorschau den Fehler zeigt.
 */
export function fillTemplate(text: string, ctx: PlanCtx, slot?: SlotRow, title?: string): string {
  return text.replace(PLACEHOLDER, (whole, name: string) => {
    switch (name) {
      case 'celebration': return ctx.celebration?.name ?? '';
      case 'celebrationTitle': return ctx.celebration?.title ?? '';
      case 'title': return title ?? '';
      case 'season': return ctx.season;
      case 'seasonName': return ctx.seasonName;
      case 'week': return String(ctx.week);
      case 'weekRoman': return roman(ctx.week);
      case 'sundayName': return ctx.sundayName;
      case 'dayName': return ctx.vars.dayName ?? dayInfo(ctx.date).dayName;
      case 'weekday': return WEEKDAY_NAME[ctx.weekday].toLowerCase();
      case 'colour': return ctx.colour;
      case 'date': return polishDate(ctx.date);
      case 'dateWords': return dayAndMonth(ctx.date);
      case 'time': return slot?.time ?? '';
      case 'slot': return slot?.label ?? slot?.key ?? '';
      default: return Object.prototype.hasOwnProperty.call(ctx.vars, name) ? ctx.vars[name] : whole;
    }
  });
}

/* -- Bedingungen ------------------------------------------------------------------------------ */

const OP_SIGN: Record<Compare, string> = { '<': '<', '<=': '≤', '=': '=', '>=': '≥', '>': '>', '!=': '≠' };

export function compare(a: number, op: Compare, b: number): boolean {
  switch (op) {
    case '<': return a < b;
    case '<=': return a <= b;
    case '=': return a === b;
    case '>=': return a >= b;
    case '>': return a > b;
    case '!=': return a !== b;
    default: return false;
  }
}

/* Kurze Wochentage: `calendarApp.flow.dayShort.<1–7>`. */
const shortDay = (d: Weekday): string => t(`calendarApp.flow.dayShort.d${d}`);

/** „MM-DD" → „17.12". */
const monthDay = (md: string): string => {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(md.trim());
  return m === null ? md : `${Number(m[2])}.${m[1].padStart(2, '0')}`;
};

/** Eine Bedingung in Worten — für die Fläche und die Vorschau. */
export function describeTest(test: Test): string {
  switch (test.t) {
    case 'weekday': return t('calendarApp.flow.test.weekday', { list: test.days.map(shortDay).join(', ') || '—' });
    case 'slot': return t('calendarApp.flow.test.slot', { list: test.keys.join(', ') || '—' });
    case 'time':
      return test.from && test.to ? t('calendarApp.flow.test.timeBoth', { from: test.from, to: test.to })
        : test.from ? t('calendarApp.flow.test.timeFrom', { from: test.from })
          : test.to ? t('calendarApp.flow.test.timeTo', { to: test.to }) : t('calendarApp.flow.test.time');
    case 'season': return t('calendarApp.flow.test.season', { list: test.seasons.join(', ') || '—' });
    case 'week': return t('calendarApp.flow.test.week', { op: OP_SIGN[test.op], n: test.n });
    case 'rank': return t('calendarApp.flow.test.rank', { op: OP_SIGN[test.op], n: test.n });
    case 'celebration':
      return test.is === 'any' ? t('calendarApp.flow.test.celebrationAny') : test.is === 'none' ? t('calendarApp.flow.test.celebrationNone')
        : t('calendarApp.flow.test.celebrationName', { name: test.name ?? '' });
    case 'festive': return t('calendarApp.flow.test.festive');
    case 'sunday': return t('calendarApp.flow.test.sunday');
    case 'date': return t('calendarApp.flow.test.date', { rule: describeDateRule(test.rule) });
    case 'between': return t('calendarApp.flow.test.between', { from: monthDay(test.from), to: monthDay(test.to) });
    case 'var': return t(test.op === 'contains' ? 'calendarApp.flow.test.varContains' : 'calendarApp.flow.test.varIs',
      { name: test.name, op: test.op === '=' ? '=' : '≠', value: test.value });
    case 'mode': return t('calendarApp.flow.test.mode', { list: test.modes.join(', ') || '—' });
    case 'count': {
      const where = t(test.scope === 'occurrence' ? 'calendarApp.flow.test.countHere' : test.per === 'occurrence' ? 'calendarApp.flow.test.countOthers' : 'calendarApp.flow.test.countWeek');
      const what = t(test.scope === 'week' && test.per === 'occurrence' ? 'calendarApp.flow.test.countNumber' : 'calendarApp.flow.test.countEntries');
      const extra = `${test.mode ? ` (${test.mode})` : ''}${test.status === 'all' ? t('calendarApp.flow.test.countWaiting') : ''}`;
      return t('calendarApp.flow.test.count', { what, where, extra, op: OP_SIGN[test.op], n: test.n });
    }
    case 'actor': return test.is === 'office' ? t('calendarApp.flow.test.actorOffice') : t('calendarApp.flow.test.actorOutside');
    case 'field':
      return test.op === 'set' ? t('calendarApp.flow.test.fieldSet', { key: test.key }) : test.op === 'empty' ? t('calendarApp.flow.test.fieldEmpty', { key: test.key })
        : t('calendarApp.flow.test.fieldIs', { key: test.key, value: test.value ?? '' });
    default: return t('calendarApp.flow.test.unknown');
  }
}

/** „MM-DD" eines Tages, für `between`. */
const mmdd = (date: string) => date.slice(5);

const normMd = (md: string): string | null => {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(md.trim());
  return m === null ? null : `${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
};

/** Eine Bedingung des PLANS. Was nur in einer Regel gilt, ist hier falsch; was nur an einer Messe gilt, am Tag. */
export function testPlan(test: Test, ctx: PlanCtx, slot?: SlotRow): boolean {
  switch (test.t) {
    case 'weekday': return test.days.includes(ctx.weekday);
    case 'slot': return slot !== undefined && test.keys.includes(slot.key);
    case 'time':
      if (slot === undefined) return false;
      return (test.from === undefined || test.from === '' || slot.time >= test.from) && (test.to === undefined || test.to === '' || slot.time <= test.to);
    case 'season': return test.seasons.includes(ctx.season);
    case 'week': return compare(ctx.week, test.op, test.n);
    case 'rank': return compare(ctx.celebration?.rank ?? ctx.dayRank, test.op, test.n);
    case 'celebration':
      if (test.is === 'any') return ctx.celebration !== null;
      if (test.is === 'none') return ctx.celebration === null;
      return ctx.celebration !== null && (test.name ?? '').trim() !== ''
        && ctx.celebration.name.toLowerCase().includes((test.name ?? '').trim().toLowerCase());
    case 'festive': return ctx.festive;
    case 'sunday': return ctx.sunday;
    case 'date': return matches(test.rule, ctx.date);
    case 'between': {
      const from = normMd(test.from);
      const to = normMd(test.to);
      if (from === null || to === null) return false;
      const here = mmdd(ctx.date);
      /* Über den Jahreswechsel: „17.12–6.01". */
      return from <= to ? here >= from && here <= to : here >= from || here <= to;
    }
    case 'var': {
      const value = test.name === 'colour' ? ctx.colour : ctx.vars[test.name] ?? '';
      if (test.op === 'contains') return value.toLowerCase().includes(test.value.toLowerCase());
      return test.op === '=' ? value === test.value : value !== test.value;
    }
    default:
      return false;
  }
}

const LIVE = (status: string) => status === 'accepted' || status === 'celebrated';
const ALIVE = (status: string) => status !== 'cancelled' && status !== 'declined';

/** Eine Bedingung einer REGEL. */
export function testRule(test: Test, ctx: RuleCtx): boolean {
  switch (test.t) {
    case 'mode': return ctx.record.mode !== undefined && test.modes.includes(ctx.record.mode);
    case 'actor': return ctx.actor === test.is;
    case 'field': {
      const value = (ctx.record.values[test.key] ?? '').trim();
      if (test.op === 'set') return value !== '';
      if (test.op === 'empty') return value === '';
      return value === (test.value ?? '').trim();
    }
    case 'count': {
      const keep = (row: { mode?: string; status: string }) =>
        ((test.status ?? 'live') === 'live' ? LIVE(row.status) : ALIVE(row.status)) && (test.mode === undefined || test.mode === '' || row.mode === test.mode);
      let n: number;
      if (test.scope === 'occurrence') {
        n = ctx.occurrence.filter(keep).length;
      } else if (test.per === 'occurrence') {
        n = new Set(ctx.week.filter((row) => keep(row) && row.occurrence !== ctx.here).map((row) => row.occurrence)).size;
      } else {
        n = ctx.week.filter(keep).length;
      }
      return compare(n, test.op, test.n);
    }
    case 'weekday': return test.days.includes(ctx.weekday);
    case 'date': return matches(test.rule, ctx.date);
    case 'between': {
      const from = normMd(test.from);
      const to = normMd(test.to);
      if (from === null || to === null) return false;
      const here = mmdd(ctx.date);
      return from <= to ? here >= from && here <= to : here >= from || here <= to;
    }
    default:
      return false;
  }
}

/* -- Feste ------------------------------------------------------------------------------------ */

/** Je Tabelle und Jahr: an welchem Tag welche Zeilen von selbst gelten. */
const feastIndex = new WeakMap<readonly FeastRow[], Map<number, Map<string, number[]>>>();

function rowsOn(rows: readonly FeastRow[], date: string): readonly number[] {
  let years = feastIndex.get(rows);
  if (years === undefined) { years = new Map(); feastIndex.set(rows, years); }
  const year = yearOf(date);
  let days = years.get(year);
  if (days === undefined) {
    days = new Map();
    rows.forEach((row, i) => {
      let found: string[] = [];
      try { found = datesOf(row.when, year); } catch { found = []; }
      for (const d of found) days!.set(d, [...(days!.get(d) ?? []), i]);
    });
    years.set(year, days);
  }
  return days.get(date) ?? [];
}

const rankOf = (row: FeastRow) => (Number.isFinite(row.rank) ? row.rank : 13);

/**
 * Ist die Zeile `i` an diesem Tag verdrängt? Vom Tag selbst (sein Rang ist
 * höher), oder von einer anderen Zeile, die an dem Tag von selbst gilt und
 * höher steht (oder gleich hoch und weiter oben in der Tabelle).
 */
function impeded(rows: readonly FeastRow[], i: number, date: string): boolean {
  const row = rows[i];
  if (rankOf(row) > dayInfo(date).dayRank) return true;
  for (const j of rowsOn(rows, date)) {
    if (j === i || rows[j].moveIfImpeded === true) continue;
    if (rankOf(rows[j]) < rankOf(row) || (rankOf(rows[j]) === rankOf(row) && j < i)) return true;
  }
  return false;
}

/** Was an diesem Tag gefeiert wird — oder nichts. */
export function feastOn(rows: readonly FeastRow[], date: string): FeastRow | null {
  const candidates: number[] = [];
  for (const i of rowsOn(rows, date)) {
    if (!impeded(rows, i, date)) candidates.push(i);
  }
  /* Was verdrängt war und heute frei ist. */
  rows.forEach((row, i) => {
    if (row.moveIfImpeded !== true || candidates.includes(i)) return;
    if (impeded(rows, i, date)) return;
    for (let back = 1; back <= MOVE_WINDOW; back += 1) {
      const natural = addDays(date, -back);
      if (!rowsOn(rows, natural).includes(i)) continue;
      let blocked = true;
      for (let d = natural; diffDays(d, date) < 0; d = addDays(d, 1)) {
        if (!impeded(rows, i, d)) { blocked = false; break; }
      }
      if (blocked) candidates.push(i);
      break;
    }
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => rankOf(rows[a]) - rankOf(rows[b]) || a - b);
  return rows[candidates[0]];
}

/* -- Der Plan ------------------------------------------------------------------------------------ */

type MutableCtx = { -readonly [K in keyof PlanCtx]: PlanCtx[K] } & { vars: Record<string, string> };

interface MassDraft {
  title: string | null;
  values: Record<string, string>;
  records: { list: string; mode?: string; text: string }[];
}

const asSeason = (data: unknown): SeasonData => (typeof data === 'object' && data !== null ? data as SeasonData : {});

/** Der Anfang eines Tages, bevor ein Knoten etwas sagt: nur, was sich rechnen lässt. */
function startCtx(date: string): MutableCtx {
  const info = dayInfo(date);
  return {
    date,
    weekday: info.weekday,
    sunday: info.sunday,
    season: info.season,
    week: info.week,
    dayRank: info.dayRank,
    seasonName: info.seasonName,
    sundayName: info.sundayName,
    colour: '',
    celebration: null,
    festive: info.sunday,
    vars: { dayName: info.dayName }
  };
}

/** Knoten, die Tag und Messe gleichermassen kennen: Kirchenjahr, Feste, Setzen, Eintrag. */
function applyCommon(node: FlowNode, ctx: MutableCtx, draft: MassDraft, slot: SlotRow | undefined, trace: string[]): boolean {
  switch (node.type) {
    case 'season': {
      const data = asSeason(node.data);
      const info = dayInfo(ctx.date);
      const special = info.special === null ? undefined : data.special?.[info.special];
      const colour = special ?? data.colours?.[ctx.season];
      if (colour !== undefined && colour !== '') ctx.colour = colour;
      trace.push(`${label(node)}: ${ctx.seasonName}${ctx.week > 0 ? t('calendarApp.flow.trace.week', { week: ctx.week }) : ''}${ctx.colour ? t('calendarApp.flow.trace.colour', { colour: ctx.colour }) : ''}`);
      return true;
    }
    case 'feasts': {
      const rows = (node.data as unknown as FeastsData).rows ?? [];
      const row = feastOn(rows, ctx.date);
      if (row !== null && (ctx.celebration === null || rankOf(row) < ctx.celebration.rank)) {
        ctx.celebration = { name: row.name, rank: rankOf(row), colour: row.colour, festive: row.festive === true, title: row.title?.trim() || row.name };
        if (row.colour) ctx.colour = row.colour;
        if (row.festive === true) ctx.festive = true;
      }
      trace.push(`${label(node)}: ${ctx.celebration?.name ?? t('calendarApp.flow.trace.noCelebration')}`);
      return true;
    }
    case 'set': {
      const data = node.data as unknown as SetData;
      const value = fillTemplate(String(data.value ?? ''), ctx, slot, draft.title ?? undefined);
      if (data.target === 'title') draft.title = value;
      else if (data.target === 'field' && data.key) draft.values[data.key] = value;
      else if (data.target === 'var' && data.key) {
        if (data.key === 'colour') ctx.colour = value;
        else ctx.vars[data.key] = value;
      }
      trace.push(t('calendarApp.flow.trace.set', { node: label(node), key: data.target === 'title' ? t('calendarApp.flow.trace.title') : data.key ?? '?', value }));
      return true;
    }
    case 'record': {
      const data = node.data as unknown as RecordData;
      const text = fillTemplate(String(data.text ?? ''), ctx, slot, draft.title ?? undefined);
      if (data.list) draft.records.push({ list: data.list, ...(data.mode ? { mode: data.mode } : {}), text });
      trace.push(t('calendarApp.flow.trace.record', { node: label(node), list: data.list ?? '?', text }));
      return true;
    }
    default:
      return false;
  }
}

/** Die Messen des Knotens `slots` an diesem Tag. */
function slotsOf(data: SlotsData, ctx: MutableCtx): SlotRow[] {
  const valid = (row: SlotRow) => /^\d{2}:\d{2}$/.test(row.time ?? '') && typeof row.key === 'string' && row.key !== '';
  const norm = (row: SlotRow): SlotRow => ({ ...row, minutes: Number.isFinite(row.minutes) && row.minutes > 0 ? row.minutes : 60 });
  if (ctx.festive) return (data.festive ?? []).filter(valid).map(norm).sort((a, b) => a.time.localeCompare(b.time));
  return (data.weekdays ?? [])
    .filter((row) => valid(row) && (row.days === undefined || row.days.length === 0 ? ctx.weekday <= 6 : row.days.includes(ctx.weekday)))
    .map(norm)
    .sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * EIN TAG: welche Messen, und jede so, wie der Ablauf sie anlegen würde.
 * Wirft nicht — was nicht geht, steht in `problems`.
 */
export function planDay(flow: FlowDoc, date: string): PlannedDay {
  if (!isDate(date)) {
    return { date, ctx: startCtx('2000-01-01'), masses: [], problems: [t('calendarApp.flow.problem.badDate', { date })] };
  }
  const graph = graphOf(flow);
  const ctx = startCtx(date);
  const problems: string[] = [];
  const dayTrace: string[] = [];
  const dayDraft: MassDraft = { title: null, values: {}, records: [] };
  let slots: SlotRow[] = [];

  const start = entryOf(flow, 'day');
  if (start === undefined) {
    problems.push(t('calendarApp.flow.problem.noDay'));
  } else {
    let node: FlowNode | undefined = start;
    for (let steps = 0; node !== undefined; steps += 1) {
      if (steps >= MAX_STEPS) { problems.push(t('calendarApp.flow.problem.dayLoop')); slots = []; break; }
      let out: FlowOut = 'out';
      if (node.type === 'day') {
        dayTrace.push(label(node));
      } else if (applyCommon(node, ctx, dayDraft, undefined, dayTrace)) {
        /* gesetzt — weiter */
      } else if (node.type === 'if') {
        const test = (node.data as unknown as IfData).test;
        const yes = test !== undefined && testPlan(test, ctx);
        dayTrace.push(`${label(node)} (${test === undefined ? t('calendarApp.flow.trace.noTest') : describeTest(test)}) → ${yesNo(yes)}`);
        out = yes ? 'yes' : 'no';
      } else if (node.type === 'slots') {
        slots = slotsOf(node.data as unknown as SlotsData, ctx);
        dayTrace.push(`${label(node)}: ${slots.length === 0 ? t('calendarApp.flow.trace.noMass') : slots.map((s) => s.time).join(', ')}`);
        break;
      } else if (node.type === 'skip') {
        dayTrace.push(`${label(node)}`);
        slots = [];
        break;
      } else if (node.type === 'end') {
        problems.push(t('calendarApp.flow.problem.endOnDay'));
        break;
      } else {
        problems.push(t('calendarApp.flow.problem.notOnDay', { node: label(node) }));
        break;
      }
      const next = graph.outs.get(node.id)?.get(out);
      if (next === undefined) {
        problems.push(t('calendarApp.flow.problem.dayEnds', { node: label(node), out: outLabel(out) }));
        slots = [];
        break;
      }
      node = graph.byId.get(next);
    }
  }

  const masses: PlannedMass[] = [];
  for (const slot of slots) {
    const made = planMass(flow, graph, ctx, dayDraft, dayTrace, slot, problems);
    if (made !== null) masses.push(made);
  }

  return { date, ctx: { ...ctx, vars: { ...ctx.vars } }, masses, problems };
}

/** EINE MESSE des Tages: vom Knoten `mass` bis `end` (angelegt) oder `skip` (nicht). */
function planMass(
  flow: FlowDoc, graph: Graph, dayCtx: MutableCtx, dayDraft: MassDraft, dayTrace: readonly string[],
  slot: SlotRow, problems: string[]
): PlannedMass | null {
  const ctx: MutableCtx = { ...dayCtx, vars: { ...dayCtx.vars } };
  const draft: MassDraft = { title: dayDraft.title, values: { ...dayDraft.values }, records: [...dayDraft.records] };
  const trace: string[] = [...dayTrace, `— ${t('calendarApp.flow.trace.mass', { time: slot.time })}${slot.label ? ` (${slot.label})` : ''}`];

  const start = entryOf(flow, 'mass');
  let node: FlowNode | undefined = start;
  if (start === undefined) trace.push(t('calendarApp.flow.trace.noMassNode'));

  for (let steps = 0; node !== undefined; steps += 1) {
    if (steps >= MAX_STEPS) { problems.push(t('calendarApp.flow.problem.massLoop', { time: slot.time })); break; }
    let out: FlowOut = 'out';
    if (node.type === 'mass') {
      trace.push(label(node));
    } else if (applyCommon(node, ctx, draft, slot, trace)) {
      /* gesetzt — weiter */
    } else if (node.type === 'if') {
      const test = (node.data as unknown as IfData).test;
      const yes = test !== undefined && testPlan(test, ctx, slot);
      trace.push(`${label(node)} (${test === undefined ? t('calendarApp.flow.trace.noTest') : describeTest(test)}) → ${yesNo(yes)}`);
      out = yes ? 'yes' : 'no';
    } else if (node.type === 'skip') {
      trace.push(label(node));
      return null;
    } else if (node.type === 'end') {
      trace.push(label(node));
      break;
    } else {
      problems.push(t('calendarApp.flow.problem.notOnMass', { node: label(node) }));
      break;
    }
    const next = graph.outs.get(node.id)?.get(out);
    /* Ohne Fortsetzung: die Messe entsteht mit dem, was gesetzt ist. */
    if (next === undefined) break;
    node = graph.byId.get(next);
  }

  const title = draft.title !== null && draft.title.trim() !== ''
    ? draft.title
    : ctx.celebration?.title ?? (ctx.sunday ? ctx.sundayName : ctx.vars.dayName ?? ctx.seasonName);

  return { date: ctx.date, slot, title, values: draft.values, records: draft.records, trace };
}

/** Ein Plan über einen Zeitraum (höchstens `MAX_PLAN_DAYS` Tage, beide Enden eingeschlossen). */
export function planRange(plan: PlanDef, from: string, to: string): PlannedDay[] {
  if (!isDate(from) || !isDate(to) || diffDays(to, from) < 0) return [];
  const days: PlannedDay[] = [];
  for (let d = from, n = 0; diffDays(to, d) >= 0 && n < MAX_PLAN_DAYS; d = addDays(d, 1), n += 1) {
    days.push(planDay(plan.flow, d));
  }
  return days;
}

/* -- Die Regel ------------------------------------------------------------------------------------ */

/** Läuft die Regel einer Liste für einen neuen (oder anzunehmenden) Eintrag. */
export function runRule(flow: FlowDoc | null | undefined, ctx: RuleCtx): RuleResult & { trace: readonly string[] } {
  const fallback = (why: string, trace: string[]): RuleResult & { trace: readonly string[] } => ({
    verdict: ctx.actor === 'office' ? 'allow' : 'wait',
    ...(ctx.actor === 'office' ? {} : { message: t('calendarApp.flow.rule.waits') }),
    trace: [...trace, why]
  });

  if (flow === null || flow === undefined) return fallback(t('calendarApp.flow.rule.none'), []);
  const start = entryOf(flow, 'record-start');
  if (start === undefined) return fallback(t('calendarApp.flow.rule.noStart'), []);

  const graph = graphOf(flow);
  const trace: string[] = [];
  let node: FlowNode | undefined = start;
  for (let steps = 0; node !== undefined; steps += 1) {
    if (steps >= MAX_STEPS) return fallback(t('calendarApp.flow.rule.loop'), trace);
    let out: FlowOut = 'out';
    if (node.type === 'record-start') {
      trace.push(label(node));
    } else if (node.type === 'if') {
      const test = (node.data as unknown as IfData).test;
      const yes = test !== undefined && testRule(test, ctx);
      trace.push(`${label(node)} (${test === undefined ? t('calendarApp.flow.trace.noTest') : describeTest(test)}) → ${yesNo(yes)}`);
      out = yes ? 'yes' : 'no';
    } else if (node.type === 'allow' || node.type === 'wait' || node.type === 'refuse') {
      trace.push(label(node));
      const message = ((node.data as unknown as MessageData).message ?? '').trim();
      if (node.type === 'allow') return { verdict: 'allow', ...(message ? { message } : {}), trace };
      if (node.type === 'wait') return { verdict: 'wait', message: message || t('calendarApp.flow.rule.waits'), trace };
      return { verdict: 'refuse', message: message || t('calendarApp.flow.rule.refused'), trace };
    } else {
      return fallback(t('calendarApp.flow.rule.notInRule', { node: label(node) }), trace);
    }
    const next = graph.outs.get(node.id)?.get(out);
    if (next === undefined) return fallback(t('calendarApp.flow.rule.endsWithout', { node: label(node) }), trace);
    node = graph.byId.get(next);
  }
  return fallback(t('calendarApp.flow.rule.noDecision'), trace);
}
