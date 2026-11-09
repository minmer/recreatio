/** Date resolution is independent of texts and rendering. Particular norms are explicit imported rules. */
import { addDays, adventStart, datesOf, dayInfo, diffDays, easter, isDate, weekdayOf, yearOf, ymd } from '../../calendar/flow/liturgy';
import type { DateRule as ExistingDateRule } from '../../calendar/flow/flowModel';
import type { CalendarContext, Conditions, DateRule, Hour, LitEntity, OfType, Season } from './schema';

export const NORMS = 'https://kkbids-old.episkopat.pl/index.php?id=301';
export const GILH = 'https://liturgyoffice.org.uk/Resources/Rites/GILH.pdf';
/** Full precedence classes; labels are localized by the presentation, not used to decide priority. */
export const PRECEDENCE = Array.from({ length: 13 }, (_, i) => ({ level: i + 1, label: `liturgy.precedence.${i + 1}`, authority: `${NORMS}#59` }));
export interface Candidate {
  id: string; title: string; precedence: number; rank: string; color: string; firstVespers: boolean;
  scope: string; common?: string; from?: string; rule?: string; status: string;
}
export interface LiturgicalDay {
  date: string; civilYear: number; liturgicalYear: number; season: Season; week: number; weekday: number;
  psalterWeek: number | null; sundayCycle: 'A' | 'B' | 'C'; weekdayCycle: 'I' | 'II';
  selected: Candidate; candidates: Candidate[]; optional: Candidate[]; commemorations: Candidate[];
  commemoration?: Candidate; omitted: Candidate[]; transferred: Candidate[]; diagnostics: string[];
}
export const datesFor = (rule: DateRule, year: number): string[] => rule.r === 'date' ? (yearOf(rule.date) === year ? [rule.date] : []) : datesOf(rule as ExistingDateRule, year);
export function temporal(date: string): Omit<LiturgicalDay, 'selected' | 'candidates' | 'optional' | 'omitted' | 'transferred' | 'diagnostics' | 'commemorations'> & { base: Candidate } {
  if (!isDate(date) || yearOf(date) < 1583 || yearOf(date) > 4099) throw new Error('liturgy.errors.invalid_date');
  const y = yearOf(date), info = dayInfo(date), offset = diffDays(date, easter(y));
  const seasons = { adwent: 'advent', narodzenie: 'christmas', zwykly: 'ordinary', post: 'lent', triduum: 'triduum', wielkanoc: 'easter' } as const;
  const season: Season = offset >= -7 && offset <= -4 ? 'holy_week' : offset >= 0 && offset <= 7 ? 'easter_octave' : seasons[info.season];
  const liturgicalYear = date >= adventStart(y) ? y + 1 : y;
  // The Christmas proper supplies its psalter directions; do not guess a week from January 1.
  const psalterWeek = season === 'christmas' || season === 'triduum' ? null : ((info.week === 0 ? 4 : info.week) - 1) % 4 + 1;
  return { date, civilYear: y, liturgicalYear, season, week: info.week, weekday: info.weekday, psalterWeek,
    sundayCycle: (['C', 'A', 'B'] as const)[liturgicalYear % 3], weekdayCycle: liturgicalYear % 2 === 0 ? 'II' : 'I',
    base: { id: `day.${date}`, title: info.dayName, precedence: info.dayRank, rank: 'day', color: info.special === 'goodFriday' || info.special === 'pentecost' || info.special === 'palm' ? 'red' : ['christmas', 'easter', 'easter_octave'].includes(season) ? 'white' : season === 'ordinary' ? 'green' : 'violet', firstVespers: info.sunday, scope: 'roman', status: 'approved' }
  };
}
export interface SelectionContext { day: LiturgicalDay; calendar: CalendarContext; hour?: Hour; vespers?: 'first' | 'second'; psalmody?: 'current' | 'complementary'; afterInvitatory?: boolean }
export function matches(c: Conditions, x: SelectionContext): boolean {
  const { day: d, calendar: k } = x;
  const has = <T>(list: readonly T[] | undefined, v: T) => list === undefined || list.includes(v);
  return has(c.dates, d.date) && has(c.seasons, d.season) && has(c.weekdays, d.weekday) && has(c.weeks, d.week) && has(c.psalter_weeks, d.psalterWeek as number)
    && has(c.observances, d.selected.id) && (c.scopes === undefined || c.scopes.every(s => k.scopes.includes(s)))
    && has(c.hours, x.hour!) && has(c.sunday_cycles, d.sundayCycle) && has(c.weekday_cycles, d.weekdayCycle)
    && (c.vespers === undefined || c.vespers === x.vespers) && (c.psalmody === undefined || c.psalmody === (x.psalmody ?? 'current'))
    && (c.common === undefined || c.common === d.selected.common) && (c.edition_id === undefined || c.edition_id === k.edition_id)
    && (c.language === undefined || c.language === k.language) && (c.office_cycle === undefined || c.office_cycle === k.office_cycle)
    && (c.after_invitatory === undefined || c.after_invitatory === (x.afterInvitatory ?? false))
    && (c.te_deum === undefined || c.te_deum === teDeum(d)) && (c.from === undefined || d.date >= c.from) && (c.until === undefined || d.date <= c.until);
}
export const teDeum = (d: LiturgicalDay): boolean => d.selected.rank === 'solemnity' || d.selected.rank === 'feast' || d.season === 'easter_octave' || d.date.slice(5) >= '12-25' || d.weekday === 7 && !['lent', 'holy_week', 'triduum'].includes(d.season);
const fromObservance = (e: OfType<'calendar_observance'>): Candidate => ({ id: e.id, title: e.title, precedence: e.precedence_class, rank: e.liturgical_rank, color: e.liturgical_color, firstVespers: e.first_vespers, scope: e.calendar_scope, common: e.common_type, status: e.status });
const order = (a: Candidate, b: Candidate) => a.precedence - b.precedence || a.id.localeCompare(b.id, 'en');
const cache = new WeakMap<readonly LitEntity[], Map<string, { dates: Map<string, Candidate[]>; moved: Map<string, Candidate[]>; problems: Map<string, string[]> }>>();
function yearCandidates(year: number, k: CalendarContext, entities: readonly LitEntity[]) {
  let cached = cache.get(entities); if (!cached) { cached = new Map(); cache.set(entities, cached); }
  const key = `${year}:${JSON.stringify(k.scopes)}`;
  const old = cached.get(key); if (old) return old;
  const dates = new Map<string, Candidate[]>(), moved = new Map<string, Candidate[]>(), problems = new Map<string, string[]>();
  const add = (date: string, c: Candidate) => dates.set(date, [...(dates.get(date) ?? []), c]);
  const warn = (date: string, code: string) => problems.set(date, [...(problems.get(date) ?? []), code]);
  const all = entities.filter((e): e is OfType<'calendar_observance'> => e.entity_type === 'calendar_observance' && k.scopes.includes(e.calendar_scope));
  const replaced = new Set(all.flatMap(e => e.replaces ? [e.replaces] : []));
  const observances = all.filter(e => !replaced.has(e.id));
  const rules = entities.filter((e): e is OfType<'liturgical_rule'> => e.entity_type === 'liturgical_rule' && k.scopes.includes(e.applicable_calendar)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const low = `${year - 1}-11-01`, high = `${year + 1}-03-01`;
  const context = (date: string, c: Candidate): SelectionContext => { const { base: _, ...t } = temporal(date); return { calendar: k, day: { ...t, selected: c, candidates: [], optional: [], commemorations: [], omitted: [], transferred: [], diagnostics: [] } }; };
  for (const e of observances) for (const y of [year - 1, year, year + 1]) {
    if (y < 1583 || y > 4099) continue;
    const original = datesFor(e.date_rule, y);
    for (const date of original) {
      const c = fromObservance(e);
      const overrides = rules.filter(r => r.action.type === 'date_override' && r.action.observance_id === e.id && (r.action.year === undefined || r.action.year === y) && matches(r.conditions, context(date, c)));
      const override = overrides[0];
      if (override && overrides[1]?.priority === override.priority) warn(date, `rule_conflict:${override.id}`);
      const actual = override?.action.type === 'date_override' ? datesFor(override.action.date_rule, y) : [date];
      for (const at of actual) if (at >= low && at <= high) {
        const occurrence = { ...c, ...(at === date ? {} : { from: date }), ...(override ? { rule: override.id, status: override.status === 'approved' ? c.status : 'draft' } : {}) };
        add(at, occurrence);
        if (at !== date) moved.set(date, [...(moved.get(date) ?? []), { ...occurrence, title: `${c.title} → ${at}` }]);
      }
    }
  }
  // Resolve transfers against all natural occurrences, including those not yet visited.
  const occurrences = [...dates.entries()].flatMap(([date, list]) => list.map(c => ({ date, c }))).sort((a, b) => order(a.c, b.c) || a.date.localeCompare(b.date));
  for (const { date, c } of occurrences) {
    const blocked = temporal(date).base.precedence < c.precedence || (dates.get(date) ?? []).some(other => other !== c && other.precedence < c.precedence);
    if (!blocked || c.rank !== 'solemnity') continue;
    const options = rules.filter(r => r.action.type === 'transfer' && r.action.observance_id === c.id && matches(r.conditions, context(date, c)));
    const rule = options[0];
    if (!rule || rule.action.type !== 'transfer') { warn(date, `unresolved_transfer:${c.id}`); continue; }
    if (options[1]?.priority === rule.priority) { warn(date, `rule_conflict:${rule.id}`); continue; }
    const a = rule.action, step = a.strategy === 'next_free' ? 1 : -1;
    const earliest = a.earliest ? datesFor(a.earliest, yearOf(date))[0] : undefined;
    const latest = a.latest ? datesFor(a.latest, yearOf(date))[0] : undefined;
    let target: string | null = null;
    for (let n = 1; n <= a.max_days; n++) {
      const at = addDays(date, step * n);
      if (at < low || at > high || earliest && at < earliest || latest && at > latest) continue;
      // GNLYC 60: do not displace any day in classes 1–8. Same-priority arrivals never overwrite.
      if (temporal(at).base.precedence <= 8 || (dates.get(at) ?? []).some(other => other.precedence <= 8)) continue;
      target = at; break;
    }
    if (!target) { warn(date, `unresolved_transfer:${c.id}`); continue; }
    dates.set(date, (dates.get(date) ?? []).filter(other => other !== c));
    const shifted = { ...c, from: date, rule: rule.id, status: rule.status === 'approved' ? c.status : 'draft' };
    add(target, shifted); moved.set(date, [...(moved.get(date) ?? []), { ...shifted, title: `${c.title} → ${target}` }]);
  }
  const result = { dates, moved, problems }; if (cached.size > 12) cached.clear(); cached.set(key, result); return result;
}
export function resolveLiturgicalDay(date: string, context: CalendarContext, entities: readonly LitEntity[]): LiturgicalDay {
  const { base, ...facts } = temporal(date);
  const year = yearCandidates(facts.civilYear, context, entities);
  const list = [...(year.dates.get(date) ?? [])].sort(order), diagnostics = [...(year.problems.get(date) ?? [])];
  const commemorations = base.precedence === 9 ? list.filter(c => c.precedence >= 10 && c.precedence <= 12) : [];
  let optional = base.precedence === 13 ? list.filter(c => c.rank === 'optional' || c.precedence === 12) : [];
  let required = list.filter(c => !optional.includes(c) && !commemorations.includes(c));
  const memorials = required.filter(c => c.precedence === 10 || c.precedence === 11);
  if (base.precedence === 13 && memorials.length > 1) { optional = [...optional, ...memorials]; required = required.filter(c => !memorials.includes(c)); }
  const top = required[0];
  let selected = top && top.precedence <= base.precedence ? top : base;
  if (selected !== base && required[1]?.precedence === selected.precedence) diagnostics.push(`precedence_conflict:${selected.id}`);
  if (selected.precedence < 13) optional = [];
  let commemoration: Candidate | undefined;
  if (context.optional_observance) {
    const choice = optional.find(c => c.id === context.optional_observance);
    if (choice) selected = choice;
    else if (selected === base && commemorations.some(c => c.id === context.optional_observance)) commemoration = commemorations.find(c => c.id === context.optional_observance);
    else diagnostics.push(`invalid_optional:${context.optional_observance}`);
  }
  if (selected.status !== 'approved') diagnostics.push(`unreviewed_observance:${selected.id}`);
  const reviewed = entities.some(e => e.entity_type === 'calendar_profile' && e.status === 'approved' && e.coverage === 'reviewed' && e.reviewed_from! <= date && e.reviewed_until! >= date && e.scopes.length === context.scopes.length && e.scopes.every(s => context.scopes.includes(s)));
  if (!reviewed) diagnostics.push('calendar_partial');
  return { ...facts, selected, candidates: [base, ...list], optional, commemorations, ...(commemoration ? { commemoration } : {}),
    omitted: list.filter(c => c !== selected && !optional.includes(c) && !commemorations.includes(c)), transferred: year.moved.get(date) ?? [], diagnostics };
}
export function resolveVespers(date: string, context: CalendarContext, entities: readonly LitEntity[]): { day: LiturgicalDay; vespers: 'first' | 'second'; reason: string } {
  const today = resolveLiturgicalDay(date, context, entities), tomorrow = resolveLiturgicalDay(addDays(date, 1), { ...context, optional_observance: undefined }, entities);
  const nextFirst = tomorrow.selected.firstVespers || tomorrow.weekday === 7 && tomorrow.selected.precedence <= 6;
  // GNLYC 61: equal precedence retains the current day's Second Vespers.
  if (nextFirst && tomorrow.selected.precedence < today.selected.precedence) return { day: tomorrow, vespers: 'first', reason: `${NORMS}#61` };
  return { day: today, vespers: 'second', reason: `${NORMS}#61` };
}
export function calendarRange(from: string, until: string, context: CalendarContext, entities: readonly LitEntity[]): LiturgicalDay[] {
  const count = diffDays(until, from) + 1;
  if (!isDate(from) || !isDate(until) || count < 1 || count > 366) throw new Error('liturgy.errors.range');
  return Array.from({ length: count }, (_, i) => resolveLiturgicalDay(addDays(from, i), context, entities));
}
export const todayIn = (timeZone: string, now = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
// Re-export date helpers for consumers without exposing scheduling internals.
export { addDays, isDate, ymd, weekdayOf };
