/**
 * 2026-11-01 — EINE FRAGE IN CODE (Python): vorher die Beispiele, dann das Feld für `transform(x)`, nach dem Prüfen
 * jeder Fall in einer Tabelle.
 *
 * <code>
 *   vorher    die sichtbaren Beispiele der Frage (`tests`): transform(Eingabe) → Ergebnis, mit ihrer Anmerkung;
 *             darunter, was geprüft wird (so viele Beispiele, so viele verdeckte Fälle, je 2 s)
 *   prüfen    Python lädt (beim ersten Mal ≈ 10 MB), dann Fall für Fall (`runCode`, `python.ts`) — die Zeile am Knopf
 *             sagt, welcher gerade rechnet; lässt sich Python nicht starten, zählt nichts und es geht noch einmal
 *   danach    je Fall: Eingabe, erwartet, bekommen, ✓/✗ mit Wort (nie Farbe allein), ein Fehler mit seiner Zeile, was
 *             `print` schrieb; „przekroczony czas", wenn einer hing
 * </code>
 *
 * Die gegebene Antwort ist `{ passed, total, status, error, results }` — `checkCode` zählt `passed / total`;
 * gespeichert wird sie ohne `results` (`storedCodeGiven`).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

import type { Card } from './cardBasics';
import { plural } from '../core/plural';
import { TexText } from '../ui/tex/Tex';
import { CASE_MS, caseCount, compactJson, hasHidden, runCode, type CodeCase, type CodeStep } from './python';
import { Markup } from './ui';
import './code.css';

export type { CodeCase } from './python';

/** Die Antwort, wie `CodeAnswer` sie gibt (und `CodeResult` sie zeigt). */
export interface CodeGiven {
  readonly passed: number;
  readonly total: number;
  readonly status: string;
  readonly error: string | null;
  readonly results?: readonly CodeCase[];
}

const clip = (text: string, n: number): string => (text.length <= n ? text : `${text.slice(0, n - 1)}…`);

/** Was am Knopf steht, während Python arbeitet. */
const stepText = (step: CodeStep): string => (step.phase === 'loading'
  ? 'Uruchamianie Pythona… (za pierwszym razem pobiera się ok. 10 MB)'
  : `Sprawdzanie: przypadek ${Math.min(step.done + 1, step.total)} z ${step.total}…`);

export function CodeAnswer({ card, locked, onSubmit, next }: {
  card: Card;
  locked: boolean;
  onSubmit: (given: unknown) => void;
  /** „Dalej" an der Stelle von „Sprawdź kod", nach der Prüfung. */
  next: ReactNode | null;
}) {
  const a = card.answer;
  const [code, setCode] = useState(a.form === 'code' ? a.starter : '');
  const [step, setStep] = useState<CodeStep | null>(null);
  /* Python liess sich nicht starten — gesagt, nichts gezählt; es geht noch einmal. */
  const [problem, setProblem] = useState<string | null>(null);
  const alive = useRef(true);
  /* Auch nach einem zweiten Einhängen (StrictMode) wieder lebendig — sonst käme das Ergebnis nie an. */
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  if (a.form !== 'code') return null;

  const tests = a.tests ?? [];
  const hidden = hasHidden(a) ? caseCount({ ...a, tests: [] }) : 0;
  const running = step !== null;
  const planId = `cg-code-plan-${card.key.replace(/[^A-Za-z0-9]/g, '').slice(-24)}`;

  const check = () => {
    if (running || locked) return;
    setProblem(null);
    setStep({ phase: 'loading', done: 0, total: tests.length + hidden });
    void runCode({ createInput: a.createInput, reference: a.reference, learner: code, cases: a.cases, seed: Date.now() % 100000, tests }, (s) => { if (alive.current) setStep(s); })
      .then((run) => {
        if (!alive.current) return;
        if (run.status === 'unavailable') { setProblem(run.error ?? 'Nie udało się uruchomić Pythona.'); return; }
        const given: CodeGiven = { passed: run.passed, total: run.total, status: run.status, error: run.error === null ? null : clip(run.error, 200), results: run.results };
        onSubmit(given);
      }, (e: unknown) => { if (alive.current) setProblem(e instanceof Error ? e.message : 'Nie udało się uruchomić Pythona.'); })
      .finally(() => { if (alive.current) setStep(null); });
  };

  return (
    <div className="cg-code-answer" data-code-answer="">
      {a.task !== '' && <Markup text={a.task} />}
      {tests.length > 0 && (
        <div className="cg-code-examples" data-code-examples={tests.length}>
          <span className="cg-code-examples-head">{tests.length === 1 ? 'Przykład' : 'Przykłady'} — tak ma działać <code>transform(x)</code>:</span>
          <ul>
            {tests.map((t, i) => (
              <li key={i} className="cg-code-example" data-code-example={i + 1}>
                <code className="cg-code-call">transform({compactJson(t.input)})</code>
                <span className="cg-code-arrow" aria-hidden>→</span><span className="cg-sr">zwraca</span>
                <code className="cg-code-value">{compactJson(t.output)}</code>
                {t.note !== undefined && t.note !== '' && <span className="cg-code-note"><TexText text={t.note} /></span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <textarea className="cg-code" spellCheck={false} value={code} disabled={locked || running} onChange={(e) => setCode(e.target.value)}
        aria-label="Kod: funkcja transform(x)" aria-describedby={planId} autoCapitalize="off" autoComplete="off" />
      <p className="cg-code-plan" id={planId}>
        {tests.length + hidden === 0 ? 'To pytanie nie ma jeszcze nic do sprawdzenia.' : (
          <>
            Sprawdzenie: {[
              tests.length > 0 ? `${tests.length} ${plural(tests.length, 'przykład', 'przykłady', 'przykładów')}` : '',
              hidden > 0 ? `${hidden} ${plural(hidden, 'ukryty przypadek', 'ukryte przypadki', 'ukrytych przypadków')}` : ''
            ].filter(Boolean).join(' i ')} — na każdy {CASE_MS / 1000} s. Funkcja <code>transform(x)</code> dostaje jedno wejście i zwraca wynik.
          </>
        )}
      </p>
      {next ?? (
        <button key="check" type="button" className="wk-btn" disabled={locked || running} aria-busy={running || undefined} data-code-check="" onClick={check}>
          {step === null ? 'Sprawdź kod' : stepText(step)}
        </button>
      )}
      <span className="cg-sr" aria-live="polite">{step === null ? '' : stepText(step)}</span>
      {problem !== null && <p className="wk-error" role="alert" data-code-problem="">{problem}</p>}
    </div>
  );
}

/* -- Nach der Prüfung --------------------------------------------------------------------------------------------- */

const isCase = (v: unknown): v is CodeCase => {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (r.kind === 'example' || r.kind === 'hidden') && typeof r.n === 'number' && typeof r.input === 'string' && typeof r.expected === 'string'
    && (typeof r.got === 'string' || r.got === null) && typeof r.ok === 'boolean';
};

/** Die gegebene Antwort, wie sie ankam — `null`: keine Antwort in Code. */
export function readCodeGiven(given: unknown): CodeGiven | null {
  if (typeof given !== 'object' || given === null) return null;
  const g = given as Record<string, unknown>;
  if (typeof g.passed !== 'number' || typeof g.total !== 'number') return null;
  return {
    passed: g.passed,
    total: g.total,
    status: typeof g.status === 'string' ? g.status : '',
    error: typeof g.error === 'string' && g.error !== '' ? g.error : null,
    ...(Array.isArray(g.results) ? { results: g.results.filter(isCase) } : {})
  };
}

/** Wie ein Fall ausging, als Zeichen UND Wort. */
function verdictOf(r: CodeCase): { readonly glyph: string; readonly text: string; readonly state: string } {
  if (r.ok) return { glyph: '✓', text: 'dobrze', state: 'is-right' };
  if (r.skipped === true) return { glyph: '–', text: r.sandbox === true ? 'pominięty (błąd pytania)' : 'nie uruchomiono', state: 'is-skipped' };
  if (r.sandbox === true) return { glyph: '✗', text: 'błąd pytania', state: 'is-skipped' };
  if (r.timeout === true) return { glyph: '✗', text: 'przekroczony czas', state: 'is-wrong' };
  if (r.error != null) return { glyph: '✗', text: 'błąd', state: 'is-wrong' };
  return { glyph: '✗', text: 'źle', state: 'is-wrong' };
}

function CaseRows({ r }: { r: CodeCase }) {
  const v = verdictOf(r);
  const more = (r.note !== undefined && r.note !== '') || (r.error != null && r.error !== '') || (r.printed != null && r.printed !== '');
  return (
    <>
      <tr className={`cg-code-case ${v.state}`} data-code-case={`${r.kind}-${r.n}`} data-code-ok={r.ok ? 'true' : 'false'}>
        <th scope="row">{r.kind === 'example' ? `Przykład ${r.n}` : `Ukryty ${r.n}`}</th>
        <td><code>{r.input}</code></td>
        <td><code>{r.expected}</code></td>
        <td>{r.got === null ? <span className="cg-muted">—</span> : <code className={r.ok ? undefined : 'cg-struck'}>{r.got}</code>}</td>
        <td className="cg-code-verdict"><span className="cg-code-glyph" aria-hidden>{v.glyph}</span> {v.text}</td>
      </tr>
      {more && (
        <tr className={`cg-code-more ${v.state}`}>
          <td colSpan={5}>
            <div className="cg-code-more-body">
              {r.note !== undefined && r.note !== '' && <span className="cg-code-note"><TexText text={r.note} /></span>}
              {r.error != null && r.error !== '' && <span className="cg-code-detail"><span className="cg-code-label">{r.skipped === true ? 'Dlaczego:' : 'Błąd:'}</span><pre>{r.error}</pre></span>}
              {r.printed != null && r.printed !== '' && <span className="cg-code-detail"><span className="cg-code-label">Wypisane przez print:</span><pre>{r.printed}</pre></span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Nach der Prüfung: wie viele Fälle bestanden, und jeder Fall für sich (Eingabe, erwartet, bekommen, Fehler, print). */
export function CodeResult({ given }: { card: Card; given: unknown }) {
  const g = readCodeGiven(given);
  if (g === null) return null;
  const results = g.results ?? [];
  const examples = results.filter((r) => r.kind === 'example');
  const hidden = results.filter((r) => r.kind === 'hidden');
  const count = (list: readonly CodeCase[]) => `${list.filter((r) => r.ok).length} z ${list.length}`;
  return (
    <div className="cg-code-result" data-code-result={g.status} data-code-passed={g.passed} data-code-total={g.total}>
      {g.total > 0 && (
        <span className="cg-code-sum">
          {g.passed} z {g.total} {plural(g.total, 'przypadku', 'przypadków', 'przypadków')} dobrze
          {examples.length > 0 && hidden.length > 0 ? ` (przykłady: ${count(examples)}, ukryte: ${count(hidden)})` : ''}
        </span>
      )}
      {g.error !== null && (
        <span className="cg-code-detail">
          <span className="cg-code-label">{g.status === 'invalid' ? 'Kod się nie uruchomił:' : g.status === 'timeout' ? 'Za długo:' : 'Uwaga:'}</span>
          <pre className="cg-code-error">{g.error}</pre>
        </span>
      )}
      {results.length > 0 && (
        <div className="cg-code-cases-wrap">
          <table className="cg-code-cases" data-code-cases={results.length}>
            <caption className="cg-sr">Wyniki sprawdzenia, przypadek po przypadku</caption>
            <thead>
              <tr><th scope="col">Przypadek</th><th scope="col">Wejście</th><th scope="col">Oczekiwane</th><th scope="col">Twój wynik</th><th scope="col">Wynik</th></tr>
            </thead>
            <tbody>
              {results.map((r) => <CaseRows key={`${r.kind}-${r.n}`} r={r} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Was von einer Antwort in Code gespeichert wird: ohne die Fälle (die sind nur zum Anschauen). */
export function storedCodeGiven(given: unknown): unknown {
  if (typeof given !== 'object' || given === null) return given;
  const { results: _results, ...rest } = given as Record<string, unknown>;
  return rest;
}
