/**
 * 2026-11-01 — EINE FRAGE IN CODE, nachgemessen (COGITA.md §5, Lemma 2.6): Beispiele vor den verdeckten Fällen, je Fall
 * Eingabe, erwartet, bekommen, Fehler mit Zeile, `print`; hängende Fälle und Neustarts.
 *
 * Der Python-Code des Arbeiters (`pythonCode.ts`) läuft hier wirklich — in Pyodide unter Node (das Paket liegt in
 * node_modules). Hängende Fälle spielt eine Attrappe nach: eine echte Endlosschleife hielte Node an.
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-lemma-code-'));
await build({
  entryPoints: { python: 'src/app/cogita/python.ts', pythonCode: 'src/app/cogita/pythonCode.ts' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: workspace,
  logLevel: 'error'
});
const load = (n) => import(pathToFileURL(join(workspace, `${n}.js`)).href);
const P = await load('python');
const C = await load('pythonCode');

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const truth = (name, ok, detail) => {
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}${detail === undefined ? '' : `\n  ${JSON.stringify(detail)}`}`); }
};

/* ── Rein ─────────────────────────────────────────────────────────────── */

check('compactJson: wie Python', P.compactJson([3, [1, 2], { a: 1, 'b c': 'x' }, null, true, 1.5]), '[3, [1, 2], {"a": 1, "b c": "x"}, null, true, 1.5]');
check('compactJson: gekürzt', P.compactJson('x'.repeat(10), 6), '"xxxx…');
/* Die Samen wie bisher im Arbeiter (dieselbe Folge — derselbe Same gibt dieselben Fälle). */
const oldSeeds = (seed, count) => {
  let state = (Math.abs(Math.trunc(seed)) >>> 0) || 0x9e3779b9;
  const out = [];
  for (let i = 0; i < count; i += 1) { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; out.push(state >>> 0); }
  return out;
};
check('caseSeeds: dieselbe Folge wie bisher', P.caseSeeds(4242, 6), oldSeeds(4242, 6));
check('caseSeeds: Same 0', P.caseSeeds(0, 3), oldSeeds(0, 3));
check('caseCount: Beispiele + verdeckte', P.caseCount({ createInput: 'def create_input(s): return s', reference: 'def reference(x): return x', cases: 4, tests: [{ input: 1, output: 1 }] }), 5);
check('caseCount: nur Beispiele (ohne reference)', P.caseCount({ createInput: 'x', reference: '  ', cases: 4, tests: [{ input: 1, output: 1 }, { input: 2, output: 2 }] }), 2);
check('codeStatus: alles gut', P.codeStatus([{ ok: true }, { ok: true }]), 'passed');
check('codeStatus: Zeit vor Fehler', P.codeStatus([{ ok: false, error: 'x' }, { ok: false, timeout: true, error: 't' }]), 'timeout');
check('codeStatus: Frage vor Zeit', P.codeStatus([{ ok: false, sandbox: true }, { ok: false, timeout: true }]), 'sandbox');
check('codeStatus: falsch', P.codeStatus([{ ok: true }, { ok: false, error: null }]), 'wrong');

/* ── Echtes Python (Pyodide in Node) ──────────────────────────────────── */

const { loadPyodide } = await import('pyodide');
const py = await loadPyodide();
await py.runPythonAsync(C.PY_HELPERS);
await py.runPythonAsync(C.PY_RUN);
const fn = (name) => py.globals.get(name);
const f = { load: fn('_load'), example: fn('_example'), make: fn('_make'), hidden: fn('_hidden'), run: fn('_run_template') };
const parsed = (out) => JSON.parse(String(out));
/** Der Weg zu Python ohne Arbeiter: dieselben Nachrichten, ohne Fristen. */
const asked = [];
const real = {
  async ask(m) {
    asked.push(m.type);
    try {
      switch (m.type) {
        case 'ready': return { id: '', ok: true, result: { ready: true } };
        case 'load': return { id: '', ok: true, result: parsed(f.load(m.createInput, m.reference, m.learner)) };
        case 'example': return { id: '', ok: true, result: parsed(f.example(m.input, m.expected)) };
        case 'make': return { id: '', ok: true, result: parsed(f.make(m.seed)) };
        case 'hidden': return { id: '', ok: true, result: parsed(f.hidden()) };
        default: return { id: '', ok: false, error: 'unknown' };
      }
    } catch (e) {
      return { id: '', ok: false, error: String(e) };
    }
  }
};
const run = (job, onStep) => P.runCode({ createInput: '', reference: '', cases: 5, seed: 7, tests: [], ...job }, onStep, real);

const SORT_TESTS = [{ input: [3, 1, 2], output: [1, 2, 3], note: 'rosnąco' }, { input: [], output: [] }, { input: [5, 5, 1], output: [1, 5, 5] }];

{
  const steps = [];
  const r = await run({ learner: 'def transform(x):\n    return sorted(x)\n', tests: SORT_TESTS }, (s) => steps.push(`${s.phase}:${s.done}/${s.total}`));
  check('Beispiele: alle bestanden', [r.status, r.passed, r.total], ['passed', 3, 3]);
  check('Beispiele: Eingabe, erwartet, bekommen (JSON wie Python)', [r.results[0].kind, r.results[0].n, r.results[0].input, r.results[0].expected, r.results[0].got, r.results[0].note], ['example', 1, '[3, 1, 2]', '[1, 2, 3]', '[1, 2, 3]', 'rosnąco']);
  check('Beispiele: der Lauf sagt, wo er steht', steps, ['loading:0/3', 'case:0/3', 'case:1/3', 'case:2/3', 'case:3/3']);
}
{
  const r = await run({ learner: 'def transform(x):\n    print("dl", len(x))\n    return list(reversed(sorted(x)))\n', tests: SORT_TESTS });
  check('falsch: Status und Anteil', [r.status, r.passed, r.total], ['wrong', 1, 3]);
  check('falsch: was kam', r.results[0].got, '[3, 2, 1]');
  check('print: je Fall gefangen', [r.results[0].printed, r.results[1].printed], ['dl 3\n', 'dl 0\n']);
}
{
  const r = await run({ learner: 'def transform(x):\n    a = 1\n    return x[0] / (a - 1)\n', tests: SORT_TESTS });
  check('Fehler: Status', [r.status, r.passed], ['runtime', 0]);
  check('Fehler: mit Zeile im eigenen Code', r.results[0].error, 'ZeroDivisionError: division by zero (linia 3)');
  check('Fehler: leere Liste', r.results[1].error, 'IndexError: list index out of range (linia 3)');
  check('Fehler: kein Ergebnis', r.results[0].got, null);
}
{
  const r = await run({ learner: 'def transform(x):\n    return sorted(x\n', tests: SORT_TESTS });
  check('Syntaxfehler: nichts läuft', [r.status, r.passed, r.total, r.results.length], ['invalid', 0, 3, 0]);
  truth('Syntaxfehler: mit Zeile', /^SyntaxError: .+\(linia 2\)$/.test(r.error ?? ''), r.error);
}
{
  const r = await run({ learner: 'def sortuj(x):\n    return sorted(x)\n', tests: SORT_TESTS });
  check('ohne transform: klar gesagt', [r.status, r.error], ['invalid', 'Trzeba zdefiniować funkcję: def transform(x):']);
}
{
  const r = await run({ learner: 'def transform(x):\n    return (x["a"], {1: "b"})\n', tests: [{ input: { a: 2 }, output: [2, { 1: 'b' }] }] });
  check('JSON wie JSON: Tupel = Liste, Schlüssel 1 = "1"', [r.status, r.passed], ['passed', 1]);
}
{
  const r = await run({ learner: 'def transform(x):\n    return 0.1 + 0.2\n', tests: [{ input: 0, output: 0.3 }] });
  check('Zahlen: mit Toleranz', r.status, 'passed');
}
{
  const r = await run({ learner: 'def transform(x):\n    return x\nif __name__ == "__main__":\n    raise SystemExit("nie dla testów")\n', tests: [{ input: 1, output: 1 }] });
  check('`if __name__ == "__main__"` läuft beim Prüfen nicht', r.status, 'passed');
}
const HIDDEN = { createInput: 'import random\ndef create_input(seed):\n    r = random.Random(seed)\n    return [r.randint(0, 99) for _ in range(5)]\n', reference: 'def reference(x):\n    return sorted(x)\n' };
{
  asked.length = 0;
  const r = await run({ ...HIDDEN, cases: 4, learner: 'def transform(x):\n    return sorted(x)\n', tests: SORT_TESTS });
  check('verdeckte Fälle nach den Beispielen: alle bestanden', [r.status, r.passed, r.total], ['passed', 7, 7]);
  check('Reihenfolge: Beispiele, dann verdeckte', r.results.map((x) => `${x.kind}${x.n}`), ['example1', 'example2', 'example3', 'hidden1', 'hidden2', 'hidden3', 'hidden4']);
  truth('verdeckt: die Eingabe steht da', /^\[\d+(, \d+){4}\]$/.test(r.results[3].input), r.results[3].input);
  check('verdeckt: erst die Daten, dann transform (zwei Nachrichten je Fall)', asked.filter((t) => t === 'make' || t === 'hidden').length, 8);
  const again = await run({ ...HIDDEN, cases: 4, learner: 'def transform(x):\n    return sorted(x)\n' });
  check('derselbe Same: dieselben verdeckten Fälle', again.results.map((x) => x.input), r.results.slice(3).map((x) => x.input));
}
{
  const r = await run({ ...HIDDEN, cases: 3, learner: 'def transform(x):\n    return x\n', tests: [] });
  check('nur verdeckte (wie bisher): falsch', [r.status, r.total], ['wrong', 3]);
}
{
  /* Immer absteigend — `return x` ist nie richtig, ausser der Lernende ersetzte reference. */
  const r = await run({ createInput: 'def create_input(seed):\n    return [seed % 5 + 3, seed % 5 + 2, seed % 5 + 1]\n', reference: HIDDEN.reference, cases: 3, learner: 'def reference(x):\n    return x\ndef transform(x):\n    return x\n' });
  check('der eigene Code ersetzt reference nicht (eigener Bereich)', [r.passed, r.total], [0, 3]);
}
{
  const r = await run({ createInput: HIDDEN.createInput, reference: 'def reference(x):\n    return x[10]\n', cases: 3, learner: 'def transform(x):\n    return x\n', tests: [{ input: 1, output: 1 }] });
  check('Fehler der Frage: Beispiel zählt, verdeckte sind der Frage zuzuschreiben', [r.status, r.passed, r.total, r.results.map((x) => (x.ok ? 'ok' : x.skipped ? 'skip' : x.sandbox ? 'sandbox' : 'bad'))], ['sandbox', 1, 4, ['ok', 'sandbox', 'skip', 'skip']]);
  truth('Fehler der Frage: gesagt mit dem Fehler', (r.results[1].error ?? '').startsWith('Błąd w pytaniu (create_input/reference): IndexError'), r.results[1].error);
}
{
  const r = await run({ createInput: 'def create_input(seed:\n    return 1\n', reference: HIDDEN.reference, cases: 2, learner: 'def transform(x):\n    return x\n', tests: [{ input: 2, output: 2 }] });
  check('Frage lässt sich nicht ausführen: verdeckte übersprungen, Beispiel läuft', [r.status, r.passed, r.total, r.results.map((x) => x.skipped === true)], ['sandbox', 1, 3, [false, true, true]]);
}
{
  const out = parsed(f.run('def run(a, b):\n    return a + b\n', JSON.stringify([2, 3])));
  check('Baustein „Python" der Vorlage: run(*wejścia) bleibt', out, 5);
}

/* ── Fristen und Neustarts (Attrappe: ein echter hängender Fall hielte Node an) ── */

/** Eine Attrappe: `plan` sagt je Nachricht, was sie tut — 'ok', 'wrong', 'hang', 'crash' oder eine Funktion. */
function fake(script) {
  const log = [];
  let n = 0;
  return {
    log,
    async ask(m, ms) {
      log.push(`${m.type}@${ms}`);
      const what = script(m, n);
      if (m.type === 'example' || m.type === 'hidden') n += 1;
      if (what === 'hang') return { id: '', ok: false, error: 'Python liczył za długo.', timeout: true };
      if (what === 'crash') return { id: '', ok: false, error: 'Python przestał działać.' };
      if (what === 'down') return { id: '', ok: false, error: 'Failed to fetch' };
      if (m.type === 'ready') return { id: '', ok: true, result: { ready: true } };
      if (m.type === 'load') return { id: '', ok: true, result: { status: 'ready', questionError: null } };
      if (m.type === 'make') return { id: '', ok: true, result: { ok: true, input: `[${m.seed % 10}]`, expected: '[1]' } };
      return { id: '', ok: true, result: { ok: what !== 'wrong', input: '[1]', expected: '[1]', got: what === 'wrong' ? '[2]' : '[1]', error: null, printed: null } };
    }
  };
}
const TESTS3 = [{ input: [1], output: [1] }, { input: [2], output: [2] }, { input: [3], output: [3] }];
{
  const line = fake((m, n) => (m.type === 'example' && n === 1 ? 'hang' : 'ok'));
  const r = await P.runCode({ createInput: '', reference: '', learner: 'x', cases: 5, seed: 1, tests: TESTS3 }, undefined, line);
  check('ein hängender Fall: przekroczony czas, die anderen laufen weiter', [r.status, r.passed, r.total, r.results.map((x) => (x.timeout ? 'T' : x.ok ? 'ok' : 'x'))], ['timeout', 2, 3, ['ok', 'T', 'ok']]);
  check('ein hängender Fall: Python neu, Code neu — dann weiter', line.log, ['ready@90000', 'load@3400', 'example@2400', 'example@2400', 'ready@90000', 'load@3400', 'example@2400']);
  check('ein hängender Fall: gesagt', r.results[1].error, 'Przekroczony czas (2 s na przypadek).');
}
{
  const line = fake((m) => (m.type === 'example' ? 'hang' : 'ok'));
  const r = await P.runCode({ createInput: '', reference: '', learner: 'x', cases: 5, seed: 1, tests: [...TESTS3, { input: [4], output: [4] }] }, undefined, line);
  check('zwei hängende Fälle: der Rest läuft nicht', r.results.map((x) => (x.timeout ? 'T' : x.skipped ? 'S' : x.ok ? 'ok' : 'x')), ['T', 'T', 'S', 'S']);
  check('zwei hängende Fälle: nach dem zweiten kein Neustart', line.log.filter((x) => x.startsWith('ready')).length, 2);
  check('zwei hängende Fälle: Status', [r.status, r.passed, r.total], ['timeout', 0, 4]);
}
{
  const line = fake((m) => (m.type === 'ready' ? 'down' : 'ok'));
  const r = await P.runCode({ createInput: '', reference: '', learner: 'x', cases: 5, seed: 1, tests: TESTS3 }, undefined, line);
  check('Python lädt nicht: nichts geprüft (die Antwort zählt nicht)', [r.status, r.passed, r.results.length], ['unavailable', 0, 0]);
}
{
  const line = fake((m) => (m.type === 'load' ? 'hang' : 'ok'));
  const r = await P.runCode({ createInput: '', reference: '', learner: 'x', cases: 5, seed: 1, tests: TESTS3 }, undefined, line);
  check('Schleife ausserhalb von transform: przekroczony czas beim Start', [r.status, r.passed, r.total], ['timeout', 0, 3]);
}
{
  const line = fake((m, n) => (m.type === 'hidden' && n === 3 ? 'crash' : 'ok'));
  const r = await P.runCode({ createInput: 'c', reference: 'r', learner: 'x', cases: 3, seed: 9, tests: TESTS3.slice(0, 1) }, undefined, line);
  check('ein abgestürzter Fall: Fehler, Neustart, weiter', [r.results.map((x) => (x.ok ? 'ok' : 'x')), r.results[3].error], [['ok', 'ok', 'ok', 'x'], 'Python przestał działać.']);
  check('verdeckt hängt in der Frage (create_input): die übrigen verdeckten laufen nicht', (await P.runCode({ createInput: 'c', reference: 'r', learner: 'x', cases: 3, seed: 9, tests: [] }, undefined, fake((m) => (m.type === 'make' ? 'hang' : 'ok')))).results.map((x) => (x.sandbox ? (x.skipped ? 'S' : 'Q') : 'x')), ['Q', 'S', 'S']);
}
{
  const r = await P.runCode({ createInput: '', reference: '', learner: 'x', cases: 5, seed: 1, tests: [] }, undefined, fake(() => 'ok'));
  check('nichts zu prüfen: gesagt, keine Note', [r.status, r.total], ['sandbox', 0]);
}

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
