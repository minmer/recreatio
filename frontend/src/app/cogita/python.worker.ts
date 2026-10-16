/**
 * COGITA — PYTHON IM BROWSER (Pyodide), in einem eigenen Arbeiter [F12, D10].
 *
 * Zwei Aufgaben, aus dem Altbestand übernommen (`legacy/pages/cogita/python`):
 *
 * <code>
 *   evaluate   eine Antwort in Code prüfen: create_input(seed) erzeugt Daten,
 *              reference(x) das Richtige, transform(x) ist die Antwort — auf N Fällen
 *   run        der Baustein „Python" einer Kartenvorlage: run(*wejścia) gibt einen Wert
 * </code>
 *
 * Pyodide (rund 10 MB) wird erst geladen, wenn jemand Python braucht. Der
 * Dienst führt keinen Code von Lernenden aus.
 */

import { loadPyodide, type PyodideInterface } from 'pyodide';

const PYODIDE_VERSION = '0.29.3';
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

type Request =
  | { type: 'evaluate'; id: string; createInput: string; reference: string; learner: string; cases: number; seed: number }
  | { type: 'run'; id: string; code: string; args: unknown[] };

let pyodide: Promise<PyodideInterface> | null = null;
const ready = () => (pyodide ??= loadPyodide({ indexURL: INDEX_URL }));

function seeds(seed: number, count: number): number[] {
  let state = (Math.abs(Math.trunc(seed)) >>> 0) || 0x9e3779b9;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    out.push(state >>> 0);
  }
  return out;
}

const EVALUATE = `
import copy, json, math, re

def _eq(a, b, tol):
    if isinstance(a, (int, float)) and not isinstance(a, bool) and isinstance(b, (int, float)) and not isinstance(b, bool):
        if math.isnan(float(a)) and math.isnan(float(b)):
            return True
        return abs(float(a) - float(b)) <= tol
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(_eq(x, y, tol) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return set(a.keys()) == set(b.keys()) and all(_eq(a[k], b[k], tol) for k in a)
    return a == b

def _js(v):
    try:
        return json.dumps(v, ensure_ascii=False)
    except Exception:
        return json.dumps(repr(v), ensure_ascii=False)

def _out(status, n, given=None, got=None, error=None):
    return json.dumps({"status": status, "passed": int(n), "failingInput": given, "output": got, "error": error}, ensure_ascii=False)

def _evaluate(create_src, reference_src, learner_src, seed_values):
    if not re.search(r"^\\s*def\\s+transform\\s*\\(", learner_src, flags=re.MULTILINE):
        return _out("invalid", 0, error="Trzeba zdefiniować funkcję: def transform(x):")
    scope = {}
    try:
        exec(create_src, scope, scope)
        exec(reference_src, scope, scope)
    except Exception as ex:
        return _out("sandbox", 0, error=f"{ex.__class__.__name__}: {ex}")
    try:
        exec(learner_src, scope, scope)
    except Exception as ex:
        return _out("invalid", 0, error=f"{ex.__class__.__name__}: {ex}")
    create_input, reference, transform = scope.get("create_input"), scope.get("reference"), scope.get("transform")
    if not callable(create_input) or not callable(reference):
        return _out("sandbox", 0, error="Brakuje create_input(seed) albo reference(x).")
    if not callable(transform):
        return _out("invalid", 0, error="Brakuje funkcji transform(x).")
    for i, seed in enumerate(seed_values):
        try:
            x = create_input(seed)
            want = reference(copy.deepcopy(x))
        except Exception as ex:
            return _out("sandbox", i, error=f"{ex.__class__.__name__}: {ex}")
        try:
            got = transform(copy.deepcopy(x))
        except Exception as ex:
            return _out("runtime", i, _js(x), None, f"{ex.__class__.__name__}: {ex}")
        if not _eq(want, got, 1e-9):
            return _out("wrong", i, _js(x), _js(got))
    return _out("passed", len(seed_values))
`;

const RUN = `
import json

def _run_template(code, args_json):
    scope = {}
    exec(code, scope, scope)
    run = scope.get("run")
    if not callable(run):
        raise ValueError("Kod musi zdefiniować funkcję run(*wejścia).")
    result = run(*json.loads(args_json))
    return json.dumps(result, ensure_ascii=False, default=str)
`;

let prepared = false;

async function prepare(py: PyodideInterface): Promise<void> {
  if (prepared) return;
  await py.runPythonAsync(EVALUATE);
  await py.runPythonAsync(RUN);
  prepared = true;
}

self.addEventListener('message', (event: MessageEvent<Request>) => {
  const message = event.data;
  if (typeof message !== 'object' || message === null) return;
  void (async () => {
    try {
      const py = await ready();
      await prepare(py);
      if (message.type === 'evaluate') {
        const count = Math.max(1, Math.min(200, Math.round(message.cases || 5)));
        const fn = py.globals.get('_evaluate') as (a: string, b: string, c: string, d: unknown) => string;
        const list = py.toPy(seeds(message.seed, count));
        const out = fn(message.createInput ?? '', message.reference ?? '', message.learner ?? '', list);
        list.destroy?.();
        self.postMessage({ id: message.id, ok: true, result: { ...JSON.parse(String(out)), total: count } });
        return;
      }
      const fn = py.globals.get('_run_template') as (code: string, args: string) => string;
      const out = fn(message.code ?? '', JSON.stringify(message.args ?? []));
      self.postMessage({ id: message.id, ok: true, result: JSON.parse(String(out)) as unknown });
    } catch (e) {
      self.postMessage({ id: message.id, ok: false, error: e instanceof Error ? e.message : 'Python się nie powiódł.' });
    }
  })();
});
