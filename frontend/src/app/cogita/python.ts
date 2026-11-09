/**
 * COGITA — DER WEG ZUM PYTHON-ARBEITER (`python.worker.ts`).
 *
 * Ein Arbeiter je Tab, erst beim ersten Gebrauch. Hängt er (eine Schleife ohne
 * Ende im Code eines Lernenden), wird er nach der Frist beendet und beim
 * nächsten Mal neu gestartet.
 *
 * <b>2026-11-01 — EINE FRAGE IN CODE, FALL FÜR FALL</b> (`runCode`):
 * <code>
 *   1. Python laden          lange Frist (beim ersten Mal ≈ 10 MB) — zählt nicht zur Zeit eines Falls
 *   2. den Code ausführen    kurz (eine Schleife ausserhalb von transform wäre sonst ewig)
 *   3. die Beispiele         sichtbar in der Frage (`tests`): transform(input) gegen output — je 2 s
 *   4. die verdeckten Fälle  create_input(seed), reference(x), dann transform(x) — je 2 s
 * </code>
 * Hängt ein Fall, wird der Arbeiter beendet und neu gestartet; die übrigen Fälle laufen weiter — nach dem zweiten
 * hängenden Fall nicht mehr (sie stehen als „nie uruchomiono" da). Je Fall bleibt, was hinein ging, was erwartet war,
 * was kam, ein Fehler mit seiner Zeile und was `print` schrieb. Der Anteil der bestandenen Fälle ist die Note.
 */

import type { CodeTest } from './cardBasics';
import { t } from '../core/i18n';

export type Reply = { id: string; ok: true; result: unknown } | { id: string; ok: false; error: string; timeout?: boolean };

/** Wie eine Frage zu Python kommt — der Arbeiter; in Prüfungen ohne Browser eine Attrappe. */
export interface PythonLine {
  ask(message: Record<string, unknown>, timeoutMs: number): Promise<Reply>;
}

let worker: Worker | null = null;
let sequence = 0;
const waiting = new Map<string, { resolve: (r: Reply) => void; timer: number }>();

function ensure(): Worker {
  if (worker !== null) return worker;
  const made = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' });
  made.addEventListener('message', (event: MessageEvent<Reply>) => {
    const one = waiting.get(event.data?.id);
    if (one === undefined) return;
    window.clearTimeout(one.timer);
    waiting.delete(event.data.id);
    one.resolve(event.data);
  });
  made.addEventListener('error', () => reset(t('cogitaLearnLogic.python.crashed')));
  worker = made;
  return made;
}

/** Den Arbeiter beenden — wer wartet, bekommt `error`; `late`: die Frage, deren Frist ablief (`timeout`). */
function reset(error: string, late?: string): void {
  for (const [id, one] of waiting) { window.clearTimeout(one.timer); one.resolve({ id, ok: false, error, ...(id === late ? { timeout: true } : {}) }); }
  waiting.clear();
  worker?.terminate();
  worker = null;
}

function ask(message: Record<string, unknown>, timeoutMs: number): Promise<Reply> {
  if (typeof Worker === 'undefined' || typeof window === 'undefined') return Promise.resolve({ id: '', ok: false, error: t('cogitaLearnLogic.python.unavailable') });
  const id = `${Date.now().toString(36)}-${(sequence += 1).toString(36)}`;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => { reset(t('cogitaLearnLogic.python.tooLong'), id); }, timeoutMs);
    waiting.set(id, { resolve, timer });
    try {
      ensure().postMessage({ ...message, id });
    } catch (e) {
      window.clearTimeout(timer);
      waiting.delete(id);
      resolve({ id, ok: false, error: e instanceof Error ? e.message : t('cogitaLearnLogic.python.unavailable') });
    }
  });
}

/** Der Arbeiter dieses Tabs. */
export const WORKER: PythonLine = { ask };

/** Der Baustein „Python" einer Vorlage: `run(*wejścia)`. Wirft mit der Meldung des Codes. */
/*
 * 2026-11-05 — DIE WORTE AUS PYTHON: der Worker und der Python-Code kennen keine Wörterbücher; sie sagen Schlüssel
 * („cogitaLearnLogic.python.…“), hier werden sie zu Worten (auch mitten in einer Meldung mit Traceback).
 */
const KEY = /cogitaLearnLogic\.python\.\w+/g;
const words = (s: string): string => s.replace(KEY, (k) => t(k));
function spoken(reply: Reply): Reply {
  if (!reply.ok) return { ...reply, error: words(reply.error) };
  const r = reply.result;
  if (typeof r !== 'object' || r === null || Array.isArray(r)) return reply;
  return { ...reply, result: Object.fromEntries(Object.entries(r as Record<string, unknown>).map(([k, v]) => [k, typeof v === 'string' && (k === 'error' || k === 'questionError') ? words(v) : v])) };
}
const said = (line: PythonLine) => async (message: Record<string, unknown>, timeoutMs: number): Promise<Reply> => spoken(await line.ask(message, timeoutMs));

export async function runPython(code: string, args: readonly unknown[]): Promise<unknown> {
  const reply = spoken(await ask({ type: 'run', code, args }, 20_000));
  if (!reply.ok) throw new Error(reply.error);
  return reply.result;
}

/* -- Eine Frage in Code, Fall für Fall --------------------------------------------------------------------------- */

/** So lange darf ein Fall rechnen. */
export const CASE_MS = 2000;
/** Dazu die Reise der Nachricht hin und zurück. */
const CASE_MARGIN_MS = 400;
/** Python laden: beim ersten Mal ≈ 10 MB aus dem Netz. */
const START_MS = 90_000;
/** Den Code ausführen (Definitionen, und was sonst oben im Code steht). */
const LOAD_MS = 3000;
/** Nach so vielen hängenden Fällen laufen die übrigen nicht mehr. */
export const MAX_TIMEOUTS = 2;
/** Höchstens so viele verdeckte Fälle. */
const MAX_CASES = 200;

export type CodeStatus = 'passed' | 'wrong' | 'runtime' | 'invalid' | 'sandbox' | 'timeout' | 'unavailable';

/** Ein geprüfter Fall: ein sichtbares Beispiel (`example`) oder ein verdeckter Fall (`hidden`), je mit Nummer ab 1. */
export interface CodeCase {
  readonly kind: 'example' | 'hidden';
  readonly n: number;
  /** Was hinein ging, was erwartet war, was kam — als JSON-Text (gekürzt); `got` fehlt nach einem Fehler. */
  readonly input: string;
  readonly expected: string;
  readonly got: string | null;
  readonly ok: boolean;
  /** Ein Fehler beim Rechnen (mit der Zeile im Code des Lernenden) — oder warum der Fall nicht lief. */
  readonly error?: string | null;
  /** Was `print` geschrieben hat. */
  readonly printed?: string | null;
  readonly timeout?: boolean;
  /** Nicht gelaufen (nach zu vielen hängenden Fällen, nach einem Fehler der Frage). */
  readonly skipped?: boolean;
  /** Der Fehler lag an der Frage (create_input, reference), nicht am Lernenden. */
  readonly sandbox?: boolean;
  /** Die Anmerkung eines Beispiels. */
  readonly note?: string;
}

export interface CodeRun {
  readonly status: CodeStatus;
  readonly passed: number;
  readonly total: number;
  /** Was den ganzen Lauf betrifft: der Code lässt sich nicht ausführen, Python lädt nicht. */
  readonly error: string | null;
  readonly results: readonly CodeCase[];
}

export interface CodeJob {
  readonly createInput: string;
  readonly reference: string;
  readonly learner: string;
  /** Wie viele verdeckte Fälle (wenn es create_input und reference gibt). */
  readonly cases: number;
  readonly seed: number;
  readonly tests?: readonly CodeTest[];
}

/** Wo der Lauf steht: Python lädt (auch nach einem Neustart) — oder Fall `done + 1` von `total` rechnet. */
export interface CodeStep {
  readonly phase: 'loading' | 'case';
  readonly done: number;
  readonly total: number;
}

/** Gibt es verdeckte Fälle? Nur mit beidem: create_input UND reference. */
export const hasHidden = (job: Pick<CodeJob, 'createInput' | 'reference'>): boolean => job.createInput.trim() !== '' && job.reference.trim() !== '';

/** Wie viele Fälle ein Lauf hat: die Beispiele und die verdeckten. */
export const caseCount = (job: Pick<CodeJob, 'createInput' | 'reference' | 'cases' | 'tests'>): number =>
  (job.tests ?? []).length + (hasHidden(job) ? Math.max(1, Math.min(MAX_CASES, Math.round(job.cases || 5))) : 0);

/** Die Samen der verdeckten Fälle — dieselbe Folge (xorshift) wie bisher im Arbeiter. */
export function caseSeeds(seed: number, count: number): number[] {
  let state = (Math.abs(Math.trunc(seed)) >>> 0) || 0x9e3779b9;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    out.push(state);
  }
  return out;
}

/** Ein Wert als kurzes JSON, wie Python es schreibt (`[1, 2]`, `{"a": 1}`) — für die Beispiele vor dem Lauf. */
export function compactJson(value: unknown, limit = 400): string {
  const py = (v: unknown): string => {
    if (v === undefined || v === null) return 'null';
    if (Array.isArray(v)) return `[${v.map(py).join(', ')}]`;
    if (typeof v === 'object') return `{${Object.entries(v as Record<string, unknown>).map(([k, x]) => `${JSON.stringify(k)}: ${py(x)}`).join(', ')}}`;
    if (typeof v === 'number' && !Number.isFinite(v)) return Number.isNaN(v) ? 'NaN' : v > 0 ? 'Infinity' : '-Infinity';
    return JSON.stringify(v) ?? 'null';
  };
  const text = py(value);
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`; // i18n-ignore
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** Was ein Fall vom Arbeiter zurückbrachte. */
function caseFrom(base: Pick<CodeCase, 'kind' | 'n' | 'input' | 'expected' | 'note'>, raw: unknown): CodeCase {
  const r = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
  return {
    ...base,
    input: str(r.input) || base.input,
    expected: str(r.expected) || base.expected,
    got: typeof r.got === 'string' ? r.got : null,
    ok: r.ok === true,
    error: strOrNull(r.error),
    printed: strOrNull(r.printed)
  };
}

/** Welche Art von Ergebnis: alles gut — sonst der gewichtigste Grund (die Frage, die Zeit, ein Fehler, falsch). */
export function codeStatus(results: readonly CodeCase[]): CodeStatus {
  if (results.length > 0 && results.every((r) => r.ok)) return 'passed';
  if (results.some((r) => r.sandbox === true)) return 'sandbox';
  if (results.some((r) => r.timeout === true)) return 'timeout';
  if (results.some((r) => !r.ok && r.skipped !== true && r.error != null)) return 'runtime';
  return 'wrong';
}

type Opened = { readonly kind: 'ready'; readonly questionError: string | null } | { readonly kind: 'unavailable' | 'invalid' | 'timeout'; readonly error: string };

/** Python laden (lange Frist) und den Code ausführen (kurze Frist). */
async function open(job: CodeJob, line: PythonLine): Promise<Opened> {
  const ask = said(line);
  const up = await ask({ type: 'ready' }, START_MS);
  if (!up.ok) {
    return { kind: 'unavailable', error: up.timeout === true ? t('cogitaLearnLogic.python.loadTooLong') : t('cogitaLearnLogic.python.startFailed', { error: up.error ?? '' }) };
  }
  const loaded = await ask({ type: 'load', createInput: job.createInput, reference: job.reference, learner: job.learner }, LOAD_MS + CASE_MARGIN_MS);
  if (!loaded.ok) {
    return loaded.timeout === true
      ? { kind: 'timeout', error: t('cogitaLearnLogic.python.loadTimeout', { s: LOAD_MS / 1000 }) }
      : { kind: 'invalid', error: loaded.error };
  }
  const r = typeof loaded.result === 'object' && loaded.result !== null ? loaded.result as Record<string, unknown> : {};
  if (r.status === 'invalid') return { kind: 'invalid', error: str(r.error) || t('cogitaLearnLogic.python.invalid') };
  if (r.status !== 'ready') return { kind: 'unavailable', error: t('cogitaLearnLogic.python.garbled') };
  return { kind: 'ready', questionError: strOrNull(r.questionError) };
}

type Planned =
  | { readonly kind: 'example'; readonly n: number; readonly test: CodeTest }
  | { readonly kind: 'hidden'; readonly n: number; readonly seed: number };

const PER_CASE = CASE_MS + CASE_MARGIN_MS;
const timeoutText = (): string => t('cogitaLearnLogic.python.caseTimeout', { s: CASE_MS / 1000 });

/**
 * DIE ANTWORT IN CODE PRÜFEN: die sichtbaren Beispiele, dann die verdeckten Fälle — jeder mit eigener Frist. `onStep`
 * sagt, wo der Lauf steht. `unavailable`: Python liess sich nicht starten — dann ist nichts geprüft (die Antwort zählt
 * nicht). `line`: der Weg zu Python (für Prüfungen ohne Browser).
 */
export async function runCode(job: CodeJob, onStep?: (step: CodeStep) => void, line: PythonLine = WORKER): Promise<CodeRun> {
  const tests = job.tests ?? [];
  const total = caseCount(job);
  const hiddenCount = total - tests.length;
  if (total === 0) return { status: 'sandbox', passed: 0, total: 0, error: t('cogitaLearnLogic.python.nothing'), results: [] };

  onStep?.({ phase: 'loading', done: 0, total });
  const first = await open(job, line);
  if (first.kind !== 'ready') return { status: first.kind, passed: 0, total, error: first.error, results: [] };

  const plan: Planned[] = [
    ...tests.map((test, i): Planned => ({ kind: 'example', n: i + 1, test })),
    ...caseSeeds(job.seed, hiddenCount).map((seed, i): Planned => ({ kind: 'hidden', n: i + 1, seed }))
  ];
  const results: CodeCase[] = [];
  let questionError = first.questionError;
  let timeouts = 0;
  /** Warum die übrigen Fälle nicht laufen (zu viele hingen, Python startet nicht neu). */
  let stopped: string | null = null;

  /** Nach einem hängenden (oder abgestürzten) Fall: Python neu, der Code neu — sonst laufen die übrigen nicht. */
  const restart = async (done: number): Promise<void> => {
    if (done >= plan.length) return;
    onStep?.({ phase: 'loading', done, total });
    const again = await open(job, line);
    if (again.kind !== 'ready') stopped = t('cogitaLearnLogic.python.notRun', { why: again.error });
  };

  for (let at = 0; at < plan.length; at += 1) {
    const one = plan[at]!;
    const base = one.kind === 'example'
      ? { kind: one.kind, n: one.n, input: compactJson(one.test.input), expected: compactJson(one.test.output), ...(one.test.note === undefined ? {} : { note: one.test.note }) }
      : { kind: one.kind, n: one.n, input: '—', expected: '—' };
    if (stopped !== null) { results.push({ ...base, got: null, ok: false, skipped: true, error: stopped }); continue; }
    if (one.kind === 'hidden' && questionError !== null) {
      results.push({ ...base, got: null, ok: false, skipped: true, sandbox: true, error: t('cogitaLearnLogic.python.notRunQuestion', { error: questionError }) });
      continue;
    }
    onStep?.({ phase: 'case', done: at, total });

    let made = base;
    if (one.kind === 'hidden') {
      const prepared = await said(line)({ type: 'make', seed: one.seed }, PER_CASE);
      if (!prepared.ok) {
        /*
         * Die Frage selbst rechnet zu lange (oder Python brach ab): kein Fehler des Lernenden — und die übrigen verdeckten
         * Fälle laufen nicht (nach ihnen kommt nichts mehr: die Beispiele liefen zuerst, also kein Neustart).
         */
        questionError = prepared.timeout === true ? t('cogitaLearnLogic.python.questionTooLong') : prepared.error;
        results.push({ ...base, got: null, ok: false, sandbox: true, error: t('cogitaLearnLogic.python.questionError', { error: questionError ?? '' }) });
        continue;
      }
      const r = typeof prepared.result === 'object' && prepared.result !== null ? prepared.result as Record<string, unknown> : {};
      if (r.ok !== true) {
        questionError = str(r.error) || t('cogitaLearnLogic.python.questionFailed');
        results.push({ ...base, got: null, ok: false, sandbox: true, error: t('cogitaLearnLogic.python.questionError', { error: questionError ?? '' }) });
        continue;
      }
      made = { ...base, input: str(r.input) || '—', expected: str(r.expected) || '—' };
    }

    const reply = one.kind === 'example'
      ? await said(line)({ type: 'example', input: JSON.stringify(one.test.input ?? null) ?? 'null', expected: JSON.stringify(one.test.output ?? null) ?? 'null' }, PER_CASE)
      : await said(line)({ type: 'hidden' }, PER_CASE);
    if (reply.ok) { results.push(caseFrom(made, reply.result)); continue; }
    if (reply.timeout === true) {
      timeouts += 1;
      results.push({ ...made, got: null, ok: false, timeout: true, error: timeoutText() });
      if (timeouts >= MAX_TIMEOUTS) { stopped = t('cogitaLearnLogic.python.tooManyTimeouts', { n: MAX_TIMEOUTS }); continue; }
    } else {
      results.push({ ...made, got: null, ok: false, error: reply.error });
    }
    await restart(at + 1);
  }

  onStep?.({ phase: 'case', done: total, total });
  return { status: codeStatus(results), passed: results.filter((r) => r.ok).length, total, error: null, results };
}

/* -- Wie bisher -------------------------------------------------------------------------------------------------- */

export interface CodeVerdict {
  readonly status: CodeStatus;
  readonly passed: number;
  readonly total: number;
  readonly failingInput?: string | null;
  readonly output?: string | null;
  readonly error?: string | null;
}

/** Eine Antwort in Code prüfen — nur verdeckte Fälle, die Zahl und der erste falsche Fall (die frühere Gestalt). */
export async function evaluateCode(input: { createInput: string; reference: string; learner: string; cases: number; seed: number }): Promise<CodeVerdict> {
  const run = await runCode(input);
  const bad = run.results.find((r) => !r.ok);
  return {
    status: run.status,
    passed: run.passed,
    total: run.total,
    failingInput: bad?.input ?? null,
    output: bad?.got ?? null,
    error: run.error ?? bad?.error ?? null
  };
}
