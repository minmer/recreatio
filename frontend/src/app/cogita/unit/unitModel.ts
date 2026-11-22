/**
 * 2026-11-22 (Homer-Spezifikation) — EINE UNTERRICHTSEINHEIT ÜBER MEHRERE STUNDEN (Dokument `unit` der Baza, im Kurs-JSON
 * `units`). Rein: lesen, prüfen, und die Rechnungen der Klassensitzung (wo die Klasse steht, was Hausaufgabe wird, wo es nach
 * „Wznów" weitergeht, wer feststeckt, welche Fragen die Wiederholung nimmt). Kein React, kein Netz — `app-unit-check.mjs`.
 *
 * <code>
 *   unit     {name, lessons: [{title}], stages: [Stage], settings?: {stuckWrong, stuckMinutes, resumeShare}}
 *   Stage    {id, lesson (1…), title, type core|flex|close, minutes [min,max], modes ["P","V","R","I","O","Q","X"],
 *             led (die Klasse folgt dem Lehrer; Vorgabe: P/V/Q ohne I/R/X), order fixed|free, items, bonus, skipIf {stage, above}}
 *   Item     {flow, start?}            eine Erzählung (Lehrer: gemeinsam; Telefon: allein)
 *            {questions: [Frage]}      Fragen nacheinander (Lehrer: Abstimmung je Frage; Telefon: allein, zählt)
 *            {prompt, max?, anonymous?} eine offene Frage, ≤ 80 Zeichen, nie bewertet, eine Wand
 *            {poll, options, after?}   eine Meinungsumfrage (eine von N), `after`: die Kennung derselben Umfrage vorher
 *            jedes Item darf eine `id` tragen (für `after`)
 * </code>
 */

export type StageType = 'core' | 'flex' | 'close';
export type StageMode = 'P' | 'V' | 'R' | 'I' | 'O' | 'Q' | 'X';
export const STAGE_MODES: readonly StageMode[] = ['P', 'V', 'R', 'I', 'O', 'Q', 'X'];

export type UnitItem =
  | { readonly kind: 'flow'; readonly id?: string; readonly flow: string; readonly start?: { readonly step: string; readonly exit?: string } }
  | { readonly kind: 'questions'; readonly id?: string; readonly questions: readonly string[] }
  | { readonly kind: 'prompt'; readonly id?: string; readonly prompt: string; readonly max: number; readonly anonymous: boolean }
  | { readonly kind: 'poll'; readonly id?: string; readonly poll: string; readonly options: readonly string[]; readonly after?: string };

export interface UnitStage {
  readonly id: string;
  readonly lesson: number;
  readonly title: string;
  readonly type: StageType;
  readonly minutes: readonly [number, number];
  readonly modes: readonly StageMode[];
  readonly led: boolean;
  readonly order: 'fixed' | 'free';
  readonly items: readonly UnitItem[];
  readonly bonus: readonly UnitItem[];
  readonly skipIf?: { readonly stage: string; readonly above: number };
}

export interface UnitSettings {
  /** So viele falsche Antworten auf dieselbe Frage: steckt fest. */
  readonly stuckWrong: number;
  /** So viele Minuten ohne Fortschritt in einem Etap: steckt fest. */
  readonly stuckMinutes: number;
  /** „Wznów" setzt beim ersten Kern-Etap an, der für mindestens so viele der Klasse noch offen ist. */
  readonly resumeShare: number;
}

export const DEFAULT_UNIT_SETTINGS: UnitSettings = { stuckWrong: 2, stuckMinutes: 3, resumeShare: 0.5 };

export interface Unit {
  readonly id: string;
  readonly name: string;
  readonly lessons: readonly { readonly title: string }[];
  readonly stages: readonly UnitStage[];
  readonly settings: UnitSettings;
}

export const PROMPT_MAX = 80;
const ITEMS_MAX = 40;
const STAGES_MAX = 80;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Ein Item, wie es gespeichert steht — `null`: unlesbar. */
export function readItem(raw: unknown): UnitItem | null {
  if (!isObject(raw)) return null;
  const id = str(raw.id) || undefined;
  const withId = id === undefined ? {} : { id };
  if (str(raw.flow) !== '') {
    const s = isObject(raw.start) ? raw.start : null;
    const start = s !== null && str(s.step) !== '' ? { step: str(s.step), ...(str(s.exit) !== '' ? { exit: str(s.exit) } : {}) } : undefined;
    return { kind: 'flow', ...withId, flow: str(raw.flow), ...(start === undefined ? {} : { start }) };
  }
  if (Array.isArray(raw.questions)) {
    const questions = raw.questions.map(str).filter((q) => q !== '').slice(0, 30);
    return questions.length === 0 ? null : { kind: 'questions', ...withId, questions };
  }
  if (str(raw.prompt) !== '') {
    return { kind: 'prompt', ...withId, prompt: str(raw.prompt), max: Math.max(10, Math.min(PROMPT_MAX, Math.round(num(raw.max, PROMPT_MAX)))), anonymous: raw.anonymous !== false };
  }
  if (str(raw.poll) !== '') {
    const options = (Array.isArray(raw.options) ? raw.options : []).map(str).filter((o) => o !== '').slice(0, 12);
    if (options.length < 2) return null;
    return { kind: 'poll', ...withId, poll: str(raw.poll), options, ...(str(raw.after) !== '' ? { after: str(raw.after) } : {}) };
  }
  return null;
}

const ledByModes = (modes: readonly StageMode[]): boolean =>
  modes.some((m) => m === 'P' || m === 'V' || m === 'Q') && !modes.some((m) => m === 'I' || m === 'R' || m === 'X');

/** Die Einheit aus einem Dokument (fehlende Teile mit Vorgaben; Etapy ohne Kennung oder ohne Inhalt fallen weg). */
export function readUnit(id: string, data: Readonly<Record<string, unknown>>): Unit {
  const lessonsRaw = Array.isArray(data.lessons) ? data.lessons : [];
  const lessons = lessonsRaw.map((l) => ({ title: isObject(l) ? str(l.title) : str(l) }));
  const seen = new Set<string>();
  const stages: UnitStage[] = [];
  for (const raw of (Array.isArray(data.stages) ? data.stages : []).slice(0, STAGES_MAX)) {
    if (!isObject(raw)) continue;
    const sid = str(raw.id);
    if (sid === '' || seen.has(sid)) continue;
    seen.add(sid);
    const items = (Array.isArray(raw.items) ? raw.items : []).map(readItem).filter((x): x is UnitItem => x !== null).slice(0, ITEMS_MAX);
    const bonus = (Array.isArray(raw.bonus) ? raw.bonus : []).map(readItem).filter((x): x is UnitItem => x !== null).slice(0, ITEMS_MAX);
    const modes = (Array.isArray(raw.modes) ? raw.modes : []).map(str).filter((m): m is StageMode => (STAGE_MODES as readonly string[]).includes(m));
    const type: StageType = raw.type === 'flex' || raw.type === 'close' ? raw.type : 'core';
    const mins = Array.isArray(raw.minutes) ? raw.minutes.map((m) => num(m, 0)) : [];
    const lo = Math.max(0, mins[0] ?? 5);
    const hi = Math.max(lo, mins[1] ?? lo);
    const skip = isObject(raw.skipIf) && str(raw.skipIf.stage) !== '' ? { stage: str(raw.skipIf.stage), above: Math.max(0, Math.min(1, num(raw.skipIf.above, 0.8))) } : undefined;
    stages.push({
      id: sid, lesson: Math.max(1, Math.round(num(raw.lesson, 1))), title: str(raw.title) || sid, type, minutes: [lo, hi], modes,
      led: typeof raw.led === 'boolean' ? raw.led : ledByModes(modes), order: raw.order === 'free' ? 'free' : 'fixed', items, bonus,
      ...(skip === undefined ? {} : { skipIf: skip })
    });
  }
  const s = isObject(data.settings) ? data.settings : {};
  const settings: UnitSettings = {
    stuckWrong: Math.max(1, Math.round(num(s.stuckWrong, DEFAULT_UNIT_SETTINGS.stuckWrong))),
    stuckMinutes: Math.max(1, num(s.stuckMinutes, DEFAULT_UNIT_SETTINGS.stuckMinutes)),
    resumeShare: Math.max(0, Math.min(1, num(s.resumeShare, DEFAULT_UNIT_SETTINGS.resumeShare)))
  };
  const lessonCount = Math.max(lessons.length, ...stages.map((x) => x.lesson), 1);
  while (lessons.length < lessonCount) lessons.push({ title: '' });
  return { id, name: str(data.name) || str(data.title), lessons, stages, settings };
}

/** Was eine Einheit beim Einspielen verlangt — Fehler (blockieren) und Warnungen, als Schlüssel mit Werten (übersetzt anderswo). */
export interface UnitProblem { readonly key: string; readonly vars: Readonly<Record<string, string | number>>; readonly error: boolean }

export function unitProblems(data: Readonly<Record<string, unknown>>, has: { flow: (id: string) => boolean; question: (id: string) => boolean }): UnitProblem[] {
  const out: UnitProblem[] = [];
  const name = str(data.name) || str(data.title) || '—';
  const raws = Array.isArray(data.stages) ? data.stages : [];
  if (raws.length === 0) out.push({ key: 'noStages', vars: { name }, error: true });
  const ids = new Set<string>();
  const itemIds = new Set<string>();
  for (const raw of raws) {
    if (!isObject(raw)) continue;
    const sid = str(raw.id);
    if (sid === '') { out.push({ key: 'stageNoId', vars: { name }, error: true }); continue; }
    if (ids.has(sid)) out.push({ key: 'stageTwice', vars: { name, stage: sid }, error: true });
    ids.add(sid);
    const list = [...(Array.isArray(raw.items) ? raw.items : []), ...(Array.isArray(raw.bonus) ? raw.bonus : [])];
    if (!Array.isArray(raw.items) || raw.items.length === 0) out.push({ key: 'stageEmpty', vars: { name, stage: sid }, error: false });
    for (const one of list) {
      const item = readItem(one);
      if (item === null) { out.push({ key: 'itemUnread', vars: { name, stage: sid }, error: true }); continue; }
      if (item.id !== undefined) itemIds.add(item.id);
      if (item.kind === 'flow' && !has.flow(item.flow)) out.push({ key: 'itemFlow', vars: { name, stage: sid, ref: item.flow }, error: true });
      if (item.kind === 'questions') for (const q of item.questions) if (!has.question(q)) out.push({ key: 'itemQuestion', vars: { name, stage: sid, ref: q }, error: true });
      if (item.kind === 'prompt' && isObject(one) && typeof one.max === 'number' && one.max > PROMPT_MAX) out.push({ key: 'promptLong', vars: { name, stage: sid, max: PROMPT_MAX }, error: false });
    }
  }
  for (const raw of raws) {
    if (!isObject(raw)) continue;
    const sid = str(raw.id);
    if (isObject(raw.skipIf) && !ids.has(str(raw.skipIf.stage))) out.push({ key: 'skipNowhere', vars: { name, stage: sid, ref: str(raw.skipIf.stage) }, error: false });
    for (const one of Array.isArray(raw.items) ? raw.items : []) {
      const item = readItem(one);
      if (item?.kind === 'poll' && item.after !== undefined && !itemIds.has(item.after)) out.push({ key: 'pollAfter', vars: { name, stage: sid, ref: item.after }, error: false });
    }
  }
  const unit = readUnit('', data);
  for (let l = 1; l <= unit.lessons.length; l += 1) {
    const mine = unit.stages.filter((s) => s.lesson === l);
    if (mine.length === 0) continue;
    if (!mine.some((s) => s.type === 'close')) out.push({ key: 'noClose', vars: { name, lesson: l }, error: false });
    const core = mine.filter((s) => s.type === 'core').reduce((n, s) => n + s.minutes[1], 0);
    if (core > 40) out.push({ key: 'coreLong', vars: { name, lesson: l, minutes: core }, error: false });
  }
  return out;
}

/* -- Die Sitzung: was der Lehrer sagte (Ereignisse) ----------------------------------------------------------------------- */

/** Der Schlüssel eines Items: Etap und Stelle („L1.3#2"); Bonus-Items „L1.3#b0". */
export const itemKey = (stage: string, index: number, bonus = false): string => `${stage}#${bonus ? 'b' : ''}${index}`;

export type HostEvent =
  | { readonly kind: 'stage'; readonly stage: string; readonly lesson: number; readonly at: number }
  | { readonly kind: 'look'; readonly on: boolean; readonly at: number }
  | { readonly kind: 'results'; readonly stage: string; readonly item: string; readonly at: number }
  | { readonly kind: 'end'; readonly lesson: number; readonly at: number }
  | { readonly kind: 'pause'; readonly lesson: number; readonly at: number }
  | { readonly kind: 'resume'; readonly lesson: number; readonly recap: readonly string[]; readonly at: number }
  | { readonly kind: 'plan'; readonly order: readonly string[]; readonly skipped: readonly string[]; readonly added: Readonly<Record<string, readonly UnitItem[]>>; readonly extend: Readonly<Record<string, number>>; readonly at: number };

/** Die Etapy in der Reihenfolge, die der Lehrer jetzt will (umgestellt, ausgelassen, mit hinzugefügten Items, verlängert). */
export function plannedStages(unit: Unit, plan: Extract<HostEvent, { kind: 'plan' }> | null): UnitStage[] {
  if (plan === null) return [...unit.stages];
  const byId = new Map(unit.stages.map((s) => [s.id, s]));
  const ordered = [...plan.order.map((id) => byId.get(id)).filter((s): s is UnitStage => s !== undefined), ...unit.stages.filter((s) => !plan.order.includes(s.id))];
  return ordered.filter((s) => !plan.skipped.includes(s.id)).map((s) => {
    const more = plan.added[s.id] ?? [];
    const ext = plan.extend[s.id] ?? 0;
    return more.length === 0 && ext === 0 ? s : { ...s, items: [...s.items, ...more], minutes: [s.minutes[0], s.minutes[1] + ext] as const };
  });
}

/** Der Recap als Etap (gemeinsam, Fragen), wenn „Wznów" welche nennt. */
export const recapStage = (lesson: number, questions: readonly string[], title: string): UnitStage => ({
  id: `R${lesson}`, lesson, title, type: 'core', minutes: [3, 5], modes: ['V'], led: true, order: 'fixed', items: [{ kind: 'questions', questions }], bonus: []
});

export type Phase = 'lobby' | 'lesson' | 'closing' | 'between' | 'closed';

export interface UnitNow {
  readonly phase: Phase;
  /** Welche Stunde (1…); zwischen den Stunden: die zuletzt gehaltene. */
  readonly lesson: number;
  /** Der offene Etap (auch in „closing" der Abschluss). */
  readonly stage: UnitStage | null;
  readonly stageAt: number | null;
  /** Jeder Etap, der je geöffnet wurde, mit dem ersten Öffnen. */
  readonly reached: ReadonlyMap<string, number>;
  readonly look: boolean;
  readonly results: ReadonlySet<string>;
  readonly stages: readonly UnitStage[];
  readonly recap: UnitStage | null;
}

/** Wo die Sitzung steht — aus den Ereignissen des Lehrers in ihrer Reihenfolge und dem Zustand der Sitzung. */
export function unitNow(unit: Unit, events: readonly HostEvent[], state: 'lobby' | 'running' | 'paused' | 'finished' | 'closed', recapTitle = ''): UnitNow {
  let plan: Extract<HostEvent, { kind: 'plan' }> | null = null;
  let lesson = 1;
  let stageId: string | null = null;
  let stageAt: number | null = null;
  let look = false;
  let closing = false;
  let paused = false;
  let recap: UnitStage | null = null;
  const reached = new Map<string, number>();
  const results = new Set<string>();
  for (const e of events) {
    if (e.kind === 'plan') plan = e;
    else if (e.kind === 'stage') { stageId = e.stage; stageAt = e.at; lesson = e.lesson; paused = false; if (!reached.has(e.stage)) reached.set(e.stage, e.at); closing = closing && unit.stages.find((s) => s.id === e.stage)?.type === 'close'; look = false; }
    else if (e.kind === 'look') look = e.on;
    else if (e.kind === 'results') results.add(`${e.stage}|${e.item}`);
    else if (e.kind === 'end') { closing = true; lesson = e.lesson; }
    else if (e.kind === 'pause') { paused = true; closing = false; stageId = null; stageAt = null; lesson = e.lesson; look = false; }
    else if (e.kind === 'resume') { paused = false; lesson = e.lesson; recap = e.recap.length > 0 ? recapStage(e.lesson, e.recap, recapTitle) : null; }
  }
  const stages = plannedStages(unit, plan);
  const all = recap === null ? stages : [recap, ...stages];
  const stage = stageId === null ? null : all.find((s) => s.id === stageId) ?? null;
  const phase: Phase = state === 'closed' || state === 'finished' ? 'closed'
    : paused || state === 'paused' ? 'between'
    : stage === null ? 'lobby'
    : closing ? 'closing' : 'lesson';
  return { phase, lesson, stage, stageAt, reached, look: phase === 'lesson' || phase === 'closing' ? look : false, results, stages, recap };
}

/** Der Etap nach `current` in derselben Stunde (ohne Abschluss) — `null`: keiner mehr vor dem Abschluss. */
export function nextStage(stages: readonly UnitStage[], current: string | null, lesson: number): UnitStage | null {
  const mine = stages.filter((s) => s.lesson === lesson && s.type !== 'close');
  if (current === null) return mine[0] ?? null;
  const at = mine.findIndex((s) => s.id === current);
  return at < 0 ? mine[0] ?? null : mine[at + 1] ?? null;
}

export const closeStageOf = (stages: readonly UnitStage[], lesson: number): UnitStage | null =>
  stages.find((s) => s.lesson === lesson && s.type === 'close') ?? null;

/* -- Was die Schüler meldeten (Fortschritt) ------------------------------------------------------------------------------ */

export type ProgressResult = 'right' | 'wrong' | 'partial';

/** Ein Fortschritt: der Beginn eines Items, eine Antwort (ohne Text), ein Item fertig. */
export interface Progress {
  readonly participant: string;
  readonly stage: string;
  readonly item: string;
  readonly what: 'start' | 'answer' | 'done';
  readonly step?: string;
  readonly result?: ProgressResult;
  readonly tag?: string;
  /** Nur bei einer Frage `lines` (Wersy zaznaczyć): die gewählten Zeilennummern — für die Wärmekarte der Leinwand. */
  readonly lines?: readonly number[];
  /** 2026-11-22 — die Karte zu `lines` (auch `span`: [von, bis]), damit die Leinwand ihren Text zeigt. */
  readonly card?: string;
  readonly predict?: boolean;
  readonly at: number;
}

export type StudentStatus = 'none' | 'working' | 'done' | 'waiting' | 'stuck' | 'help';

export interface StudentRow {
  readonly participant: string;
  readonly items: ReadonlyMap<string, StudentStatus>;
  readonly status: StudentStatus;
  readonly lastAt: number | null;
  readonly help: boolean;
}

/** Hilfe: das jüngste Ereignis je Schüler und Etap. */
export interface HelpSignal { readonly participant: string; readonly stage: string; readonly on: boolean; readonly at: number }

/**
 * DIE ZEILEN DER KONSOLE für einen Etap: je Schüler je Item ein Stand. Feststecken: `stuckWrong` falsche Antworten auf dieselbe
 * Frage (seit der letzten richtigen), oder `stuckMinutes` ohne Fortschritt, solange er arbeitet. Fertig mit allen Items: wartet.
 */
export function studentRows(stage: UnitStage, participants: readonly string[], progress: readonly Progress[], help: readonly HelpSignal[], now: number, settings: UnitSettings): StudentRow[] {
  const keys = stage.items.map((_, i) => itemKey(stage.id, i));
  return participants.map((participant) => {
    const mine = progress.filter((p) => p.participant === participant && p.stage === stage.id).sort((a, b) => a.at - b.at);
    const items = new Map<string, StudentStatus>();
    let stuck = false;
    for (const key of keys) {
      const of = mine.filter((p) => p.item === key);
      if (of.some((p) => p.what === 'done')) { items.set(key, 'done'); continue; }
      if (of.length === 0) { items.set(key, 'none'); continue; }
      const wrongRun = new Map<string, number>();
      for (const p of of) {
        if (p.what !== 'answer' || p.predict === true) continue;
        const k = p.step ?? '';
        wrongRun.set(k, p.result === 'wrong' ? (wrongRun.get(k) ?? 0) + 1 : 0);
      }
      const last = of[of.length - 1]!.at;
      const here = [...wrongRun.values()].some((n) => n >= settings.stuckWrong) || now - last > settings.stuckMinutes * 60_000;
      if (here) stuck = true;
      items.set(key, here ? 'stuck' : 'working');
    }
    const h = help.filter((x) => x.participant === participant && x.stage === stage.id).sort((a, b) => a.at - b.at).pop();
    const helpOn = h?.on === true;
    const all = keys.length > 0 && keys.every((k) => items.get(k) === 'done');
    const any = [...items.values()].some((s) => s !== 'none');
    const status: StudentStatus = helpOn ? 'help' : all ? 'waiting' : stuck ? 'stuck' : any ? 'working' : 'none';
    return { participant, items, status, lastAt: mine.length === 0 ? null : mine[mine.length - 1]!.at, help: helpOn };
  });
}

/** Die häufigsten benannten Fehler eines Etaps (Vorhersagen zählen nicht). */
export function topTags(progress: readonly Progress[], stage: string, n = 3): { tag: string; count: number }[] {
  const count = new Map<string, number>();
  for (const p of progress) if (p.stage === stage && p.what === 'answer' && p.predict !== true && p.result !== 'right' && p.tag !== undefined && p.tag !== '') count.set(p.tag, (count.get(p.tag) ?? 0) + 1);
  return [...count.entries()].map(([tag, c]) => ({ tag, count: c })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, n);
}

/** Wer einen Etap ganz fertig hat (aus den Meldungen — und aus dem, was der Schüler selbst als fertig gespeichert hat). */
export function finishedBy(stage: UnitStage, progress: readonly Progress[]): Set<string> {
  const keys = stage.items.map((_, i) => itemKey(stage.id, i));
  const done = new Map<string, Set<string>>();
  for (const p of progress) if (p.stage === stage.id && p.what === 'done') { const s = done.get(p.participant) ?? new Set<string>(); s.add(p.item); done.set(p.participant, s); }
  return new Set([...done.entries()].filter(([, s]) => keys.every((k) => s.has(k))).map(([who]) => who));
}

/* -- Ende einer Stunde, Hausaufgaben, Wiederaufnahme ----------------------------------------------------------------------- */

/**
 * HAUSAUFGABE EINES SCHÜLERS: jeder Kern-Etap, den die Klasse erreicht hat oder der in einer schon begonnenen Stunde lag
 * (also an ihm vorbei beendet wurde), und den er nicht fertig hat — in der Reihenfolge der Einheit; Flex-Etapy ebenso, als
 * freiwillig. Abschlüsse und Recaps nie. `done`: die Items, die er fertig hat.
 */
export function homeworkOf(stages: readonly UnitStage[], lessonsHeld: number, done: ReadonlySet<string>): { core: UnitStage[]; flex: UnitStage[] } {
  const owed = stages.filter((s) => s.lesson <= lessonsHeld && s.type !== 'close' && s.items.length > 0 && !s.items.every((_, i) => done.has(itemKey(s.id, i))));
  return { core: owed.filter((s) => s.type === 'core'), flex: owed.filter((s) => s.type === 'flex') };
}

/**
 * WO „Wznów" ANSETZT: beim ersten Kern-Etap (bis zur neuen Stunde), der für mindestens `share` der Klasse noch offen ist;
 * sonst beim ersten Etap der neuen Stunde. `openShare(stage)`: der Anteil der Klasse, für den er offen ist.
 */
export function resumeTarget(stages: readonly UnitStage[], lesson: number, openShare: (s: UnitStage) => number, share: number): UnitStage | null {
  const behind = stages.filter((s) => s.lesson < lesson && s.type === 'core' && s.items.length > 0);
  const hit = behind.find((s) => openShare(s) >= share);
  if (hit !== undefined) return hit;
  return nextStage(stages, null, lesson);
}

/**
 * DIE WIEDERHOLUNG nach einer Pause: aus dem letzten Abschluss (Exit ticket) die Fragen, die die Klasse am häufigsten falsch
 * beantwortete — höchstens `n`, nur solche mit mindestens einem Fehler.
 */
export function recapQuestions(close: UnitStage | null, progress: readonly Progress[], n = 2): string[] {
  if (close === null) return [];
  const wrong = new Map<string, number>();
  const asked = new Map<string, number>();
  for (const p of progress) {
    if (p.stage !== close.id || p.what !== 'answer' || p.predict === true || p.step === undefined) continue;
    asked.set(p.step, (asked.get(p.step) ?? 0) + 1);
    if (p.result !== 'right') wrong.set(p.step, (wrong.get(p.step) ?? 0) + 1);
  }
  const inTicket = new Set(close.items.flatMap((i) => (i.kind === 'questions' ? i.questions : [])));
  return [...wrong.entries()].filter(([q, c]) => c > 0 && inTicket.has(q))
    .sort((a, b) => b[1] / (asked.get(b[0]) ?? 1) - a[1] / (asked.get(a[0]) ?? 1) || b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n).map(([q]) => q);
}

/** Wie viele Minuten der restliche Kern der Stunde noch braucht (obere Grenzen), ab dem Etap nach dem offenen. */
export function remainingCore(stages: readonly UnitStage[], lesson: number, current: string | null): number {
  const mine = stages.filter((s) => s.lesson === lesson && s.type === 'core');
  const at = current === null ? -1 : mine.findIndex((s) => s.id === current);
  return mine.slice(at + 1).reduce((n, s) => n + s.minutes[1], 0);
}

/** Im Rahmen, darüber (bernstein), oder noch unter der unteren Grenze. */
export const timeState = (stage: UnitStage, elapsedMs: number): 'early' | 'ok' | 'over' => {
  const m = elapsedMs / 60_000;
  return m > stage.minutes[1] ? 'over' : m < stage.minutes[0] ? 'early' : 'ok';
};

/** Der Bericht je Etap: wie viele fertig, Median der Zeit (Beginn → letztes Fertig), die häufigsten Fehler. */
export function stageReport(stage: UnitStage, participants: readonly string[], progress: readonly Progress[]): { finished: number; total: number; medianMinutes: number | null; tags: { tag: string; count: number }[]; open: string[] } {
  const done = finishedBy(stage, progress);
  const times: number[] = [];
  for (const who of done) {
    const mine = progress.filter((p) => p.participant === who && p.stage === stage.id);
    const first = Math.min(...mine.map((p) => p.at));
    const last = Math.max(...mine.filter((p) => p.what === 'done').map((p) => p.at));
    if (Number.isFinite(first) && Number.isFinite(last) && last >= first) times.push((last - first) / 60_000);
  }
  times.sort((a, b) => a - b);
  const median = times.length === 0 ? null : times.length % 2 === 1 ? times[(times.length - 1) / 2]! : (times[times.length / 2 - 1]! + times[times.length / 2]!) / 2;
  return { finished: done.size, total: participants.length, medianMinutes: median === null ? null : Math.round(median * 10) / 10, tags: topTags(progress, stage.id), open: participants.filter((p) => !done.has(p)) };
}

/* -- Offene Frage und Umfrage ------------------------------------------------------------------------------------------------ */

export interface PromptAnswer { readonly participant: string; readonly stage: string; readonly item: string; readonly text?: string; readonly choice?: number; readonly at: number }

/** Je Schüler die letzte Antwort auf ein Item (wer nachbessert, ersetzt). */
export function latestAnswers(answers: readonly PromptAnswer[], stage: string, item: string): PromptAnswer[] {
  const by = new Map<string, PromptAnswer>();
  for (const a of answers) if (a.stage === stage && a.item === item && (!by.has(a.participant) || by.get(a.participant)!.at <= a.at)) by.set(a.participant, a);
  return [...by.values()].sort((a, b) => a.at - b.at);
}

export function pollCounts(answers: readonly PromptAnswer[], stage: string, item: string, options: number): { counts: number[]; votes: number } {
  const list = latestAnswers(answers, stage, item).filter((a) => typeof a.choice === 'number' && a.choice >= 0 && a.choice < options);
  const counts = Array.from({ length: options }, () => 0);
  for (const a of list) counts[a.choice!] += 1;
  return { counts, votes: list.length };
}

/** Ein Wert im eigenen Fortschritt: ein Item fertig (`~unit.<sitzung>.<item>` = Zeitpunkt). */
export const doneValueKey = (sessionId: string, item: string): string => `~unit.${sessionId.replace(/-/g, '').slice(0, 12)}.${item}`;

/** Welche Items dieser Sitzung der Schüler in seinen Werten fertig hat. */
export function doneFromValues(values: Readonly<Record<string, number>>, sessionId: string): Set<string> {
  const prefix = doneValueKey(sessionId, '');
  return new Set(Object.entries(values).filter(([k, v]) => k.startsWith(prefix) && v > 0).map(([k]) => k.slice(prefix.length)));
}
