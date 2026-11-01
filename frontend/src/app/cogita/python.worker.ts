/**
 * COGITA — PYTHON IM BROWSER (Pyodide), in einem eigenen Arbeiter [F12, D10].
 *
 * <code>
 *   ready      Pyodide laden (rund 10 MB beim ersten Mal) und die Helfer vorbereiten — ohne Frist für einen Fall
 *   load       den Code des Lernenden (und den der Frage) ausführen: transform(x), create_input(seed), reference(x)
 *   example    ein sichtbares Beispiel prüfen: transform(input) gegen output
 *   make       einen verdeckten Fall vorbereiten: create_input(seed), reference(x)
 *   hidden     den vorbereiteten Fall prüfen: transform(x)
 *   run        der Baustein „Python" einer Kartenvorlage: run(*wejścia) gibt einen Wert
 * </code>
 *
 * 2026-11-01 — JEDER FALL EINE NACHRICHT: der Hauptfaden misst jeden Fall für sich (`python.ts`) und beendet den
 * Arbeiter, wenn einer hängt. Der Python-Code steht in `pythonCode.ts`. Der Dienst führt keinen Code von Lernenden aus.
 */

import { loadPyodide, type PyodideInterface } from 'pyodide';

import { PY_HELPERS, PY_RUN } from './pythonCode';

const PYODIDE_VERSION = '0.29.3';
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

type Request =
  | { type: 'ready'; id: string }
  | { type: 'load'; id: string; createInput: string; reference: string; learner: string }
  | { type: 'example'; id: string; input: string; expected: string }
  | { type: 'make'; id: string; seed: number }
  | { type: 'hidden'; id: string }
  | { type: 'run'; id: string; code: string; args: unknown[] };

let pyodide: Promise<PyodideInterface> | null = null;
/* Ging das Laden schief (kein Netz), versucht es die nächste Nachricht neu — kein für immer gescheitertes Versprechen. */
const ready = (): Promise<PyodideInterface> => (pyodide ??= loadPyodide({ indexURL: INDEX_URL }).catch((e: unknown) => { pyodide = null; throw e; }));

type Fn = (...args: unknown[]) => unknown;
let fns: { readonly load: Fn; readonly example: Fn; readonly make: Fn; readonly hidden: Fn; readonly run: Fn } | null = null;

/** Die Helfer einmal ausführen und ihre Funktionen behalten (nicht je Nachricht neu aus `globals` holen). */
async function prepared(py: PyodideInterface): Promise<NonNullable<typeof fns>> {
  if (fns !== null) return fns;
  await py.runPythonAsync(PY_HELPERS);
  await py.runPythonAsync(PY_RUN);
  const get = (name: string) => py.globals.get(name) as Fn;
  fns = { load: get('_load'), example: get('_example'), make: get('_make'), hidden: get('_hidden'), run: get('_run_template') };
  return fns;
}

const parsed = (out: unknown): unknown => JSON.parse(String(out)) as unknown;

self.addEventListener('message', (event: MessageEvent<Request>) => {
  const message = event.data;
  if (typeof message !== 'object' || message === null) return;
  void (async () => {
    try {
      const f = await prepared(await ready());
      let result: unknown;
      switch (message.type) {
        case 'ready': result = { ready: true }; break;
        case 'load': result = parsed(f.load(message.createInput ?? '', message.reference ?? '', message.learner ?? '')); break;
        case 'example': result = parsed(f.example(message.input ?? 'null', message.expected ?? 'null')); break;
        case 'make': result = parsed(f.make(Math.trunc(Number(message.seed) || 0) >>> 0)); break;
        case 'hidden': result = parsed(f.hidden()); break;
        case 'run': result = parsed(f.run(message.code ?? '', JSON.stringify(message.args ?? []))); break;
        default: throw new Error('Nieznane polecenie dla Pythona.');
      }
      self.postMessage({ id: message.id, ok: true, result });
    } catch (e) {
      self.postMessage({ id: message.id, ok: false, error: e instanceof Error ? e.message : 'Python się nie powiódł.' });
    }
  })();
});
