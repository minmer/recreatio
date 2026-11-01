/**
 * 2026-11-01 — LEKCJE (Lemma): was eine Powtórka zu einer Lektion macht — rein, ohne Oberfläche (geprüft in
 * `scripts/app-lemma-lessons-check.mjs`).
 *
 * <code>
 *   nextLesson   „next" einer Powtórka: die Kennung einer anderen oder ihr bleibender Name (`_ref`, mit oder ohne „@")
 *   RunLog       was ein Lauf über sich weiss: je Karte, ob die erste Antwort sass (ohne Podpowiedź), welche Karten falsch
 *                oder nur mit Podpowiedź beantwortet wurden (für „Ćwicz te jeszcze raz"), wie viele Antworten, die aktive Zeit
 *   goalState    2026-11-01 (2.11) — der Tagesziel: wie viele Karten heute, wie viele Tage hintereinander das Ziel gilt,
 *                die letzten sieben Tage
 * </code>
 *
 * <b>Die aktive Zeit</b> zählt die Abschnitte zwischen zwei Ereignissen des Laufs (die Karte kommt, die Antwort, „Dalej",
 * das Ende) — jeder höchstens `SPAN_CAP`: wer zwischendurch eine Stunde weg war, hat nicht eine Stunde gelernt.
 */

/* -- Die nächste Lektion ------------------------------------------------------------------------------------------- */

export interface DocLike {
  readonly id: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/** Ein bleibender Name ohne das „@" des JSON. */
const bare = (v: string): string => v.trim().replace(/^@/, '');

/**
 * DIE POWTÓRKA NACH DIESER: `next` nennt sie mit ihrer Kennung (nach einem Import) oder mit ihrem bleibenden Namen
 * (`_ref`, so wie ein JSON sie nennt, mit oder ohne „@"). `null`: keine, nicht zu finden — oder sie selbst.
 */
export function nextLesson(docs: readonly DocLike[], fromId: string): { readonly id: string; readonly name: string } | null {
  const from = docs.find((d) => d.id === fromId);
  const raw = typeof from?.data.next === 'string' ? from.data.next.trim() : '';
  if (raw === '') return null;
  const want = bare(raw);
  const hit = docs.find((d) => d.id === raw || d.id === want)
    ?? docs.find((d) => typeof d.data._ref === 'string' && bare(d.data._ref) === want);
  if (hit === undefined || hit.id === fromId) return null;
  const name = typeof hit.data.name === 'string' && hit.data.name.trim() !== '' ? hit.data.name.trim() : 'Powtórka';
  return { id: hit.id, name };
}

/* -- Was ein Lauf über sich weiss ------------------------------------------------------------------------------------ */

/** Ein Abschnitt zwischen zwei Ereignissen zählt höchstens so lange (drei Minuten). */
export const SPAN_CAP = 3 * 60_000;

/** Warum eine Karte zum Üben kommt: falsch beantwortet — oder richtig, aber nur mit Podpowiedź. */
export type Missed = 'wrong' | 'hint';

export interface RunLog {
  /** Je Karte: sass die ERSTE Antwort in diesem Lauf (richtig und ohne Podpowiedź)? */
  readonly first: ReadonlyMap<string, boolean>;
  /** Die Karten, die falsch oder mit Podpowiedź beantwortet wurden — in der Folge, in der es zuerst geschah. */
  readonly missed: ReadonlyMap<string, Missed>;
  readonly answers: number;
  /** Die aktive Zeit in Millisekunden. */
  readonly activeMs: number;
  /** Das letzte Ereignis — `null`: noch keines. */
  readonly last: number | null;
}

export const EMPTY_LOG: RunLog = { first: new Map(), missed: new Map(), answers: 0, activeMs: 0, last: null };

/** Ein Ereignis (die Karte ist da, „Dalej", das Ende): die Zeit seit dem letzten zählt, höchstens `cap`. */
export function logTick(log: RunLog, at: number, cap = SPAN_CAP): RunLog {
  if (log.last === null) return { ...log, last: at };
  const span = Math.max(0, Math.min(cap, at - log.last));
  return { ...log, activeMs: log.activeMs + span, last: Math.max(at, log.last) };
}

/**
 * EINE ANTWORT im Protokoll: zählt die Zeit, merkt die erste Antwort je Karte und, wo sie falsch war (oder nur mit
 * Podpowiedź richtig), die Karte zum Üben — „falsch" geht vor „mit Podpowiedź".
 */
export function logAnswer(log: RunLog, key: string, outcome: { readonly correct: boolean; readonly hints?: number }, at: number, cap = SPAN_CAP): RunLog {
  const ticked = logTick(log, at, cap);
  const hinted = (outcome.hints ?? 0) > 0;
  const first = ticked.first.has(key) ? ticked.first : new Map(ticked.first).set(key, outcome.correct && !hinted);
  let missed = ticked.missed;
  const why: Missed | null = !outcome.correct ? 'wrong' : hinted ? 'hint' : null;
  if (why !== null && missed.get(key) !== 'wrong') missed = new Map(missed).set(key, why);
  return { ...ticked, first, missed, answers: ticked.answers + 1 };
}

/** Die Zahlen am Ende: wie viele Karten gefragt, wie viele sassen beim ersten Mal. */
export function logSummary(log: RunLog): { readonly cards: number; readonly firstTry: number; readonly missed: number } {
  return { cards: log.first.size, firstTry: [...log.first.values()].filter(Boolean).length, missed: log.missed.size };
}

/** Eine Dauer, kurz und lesbar: „45 s", „7 min", „1 h 05 min". */
export function durationText(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/* -- 2026-11-01 (2.11): das Tagesziel -------------------------------------------------------------------------------- */

/** Wie viele Karten am Tag, wenn nichts gesagt ist. */
export const DEFAULT_DAILY_GOAL = 20;

/** Das Tagesziel aus den Einstellungen: eine ganze Zahl von 1 bis 500 — sonst keins. */
export function readDailyGoal(raw: unknown): number | undefined {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : Number.NaN;
  return Number.isFinite(n) && n >= 1 ? Math.min(500, Math.round(n)) : undefined;
}

/** Beginn des Tages in Ortszeit — und der Tag `n` Tage weiter (über Zeitumstellungen hinweg richtig). */
export function dayStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
export function dayAdd(start: number, n: number): number {
  const d = new Date(start);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export interface DayGoal {
  /** Beginn des Tages (Ortszeit). */
  readonly day: number;
  /** Wie viele verschiedene Karten an dem Tag beantwortet wurden. */
  readonly cards: number;
  readonly met: boolean;
}

export interface GoalState {
  readonly goal: number;
  readonly today: number;
  /** Tage hintereinander mit erreichtem Ziel, bis heute — ist heute noch nicht so weit, bis gestern. */
  readonly streak: number;
  /** Die letzten sieben Tage, der älteste zuerst, heute zuletzt. */
  readonly week: readonly DayGoal[];
}

/**
 * DAS TAGESZIEL: gezählt werden VERSCHIEDENE Karten je Tag (eine Karte dreimal am Tag ist eine; die Paare einer langen
 * Liste, die eine Antwort mitbeantwortet, sind jede für sich eine) — so heisst das Ziel „N Karten", nicht „N Klicks".
 * `rename`: zusammengeführte Einträge zählen als einer.
 */
export function goalState(answers: Iterable<{ readonly key: string; readonly at: number }>, goal: number, now: number, rename?: (key: string) => string): GoalState {
  const want = Math.max(1, Math.round(goal));
  const today = dayStart(now);
  const first = dayAdd(today, -400);
  const byDay = new Map<number, Set<string>>();
  for (const a of answers) {
    if (!Number.isFinite(a.at) || a.at < first || a.at > now + 60_000) continue;
    const day = dayStart(a.at);
    const key = rename === undefined ? a.key : rename(a.key);
    let set = byDay.get(day);
    if (set === undefined) { set = new Set(); byDay.set(day, set); }
    set.add(key);
  }
  const count = (day: number) => byDay.get(day)?.size ?? 0;
  let streak = 0;
  for (let d = count(today) >= want ? today : dayAdd(today, -1); count(d) >= want; d = dayAdd(d, -1)) streak += 1;
  const week: DayGoal[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = dayAdd(today, -i);
    week.push({ day, cards: count(day), met: count(day) >= want });
  }
  return { goal: want, today: count(today), streak, week };
}
