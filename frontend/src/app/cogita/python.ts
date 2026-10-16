/**
 * COGITA — DER WEG ZUM PYTHON-ARBEITER (`python.worker.ts`).
 *
 * Ein Arbeiter je Tab, erst beim ersten Gebrauch. Hängt er (eine Schleife ohne
 * Ende im Code eines Lernenden), wird er nach der Frist beendet und beim
 * nächsten Mal neu gestartet.
 */

type Reply = { id: string; ok: true; result: unknown } | { id: string; ok: false; error: string };

export interface CodeVerdict {
  readonly status: 'passed' | 'wrong' | 'runtime' | 'invalid' | 'sandbox' | 'timeout' | 'unavailable';
  readonly passed: number;
  readonly total: number;
  readonly failingInput?: string | null;
  readonly output?: string | null;
  readonly error?: string | null;
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
  made.addEventListener('error', () => reset('Python przestał działać.'));
  worker = made;
  return made;
}

function reset(error: string): void {
  for (const [id, one] of waiting) { window.clearTimeout(one.timer); one.resolve({ id, ok: false, error }); }
  waiting.clear();
  worker?.terminate();
  worker = null;
}

function ask(message: Record<string, unknown>, timeoutMs: number): Promise<Reply> {
  if (typeof Worker === 'undefined' || typeof window === 'undefined') return Promise.resolve({ id: '', ok: false, error: 'Python nie jest tu dostępny.' });
  const id = `${Date.now().toString(36)}-${(sequence += 1).toString(36)}`;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => { reset('Python liczył za długo.'); }, timeoutMs);
    waiting.set(id, { resolve, timer });
    ensure().postMessage({ ...message, id });
  });
}

/** Der Baustein „Python" einer Vorlage: `run(*wejścia)`. Wirft mit der Meldung des Codes. */
export async function runPython(code: string, args: readonly unknown[]): Promise<unknown> {
  const reply = await ask({ type: 'run', code, args }, 20_000);
  if (!reply.ok) throw new Error(reply.error);
  return reply.result;
}

/** Eine Antwort in Code prüfen — auf `cases` Fällen, deterministisch mit `seed`. */
export async function evaluateCode(input: { createInput: string; reference: string; learner: string; cases: number; seed: number }): Promise<CodeVerdict> {
  const reply = await ask({ type: 'evaluate', ...input }, 30_000);
  if (!reply.ok) return { status: reply.error.includes('długo') ? 'timeout' : 'unavailable', passed: 0, total: input.cases, error: reply.error };
  const r = reply.result as Partial<CodeVerdict>;
  return {
    status: (r.status ?? 'sandbox') as CodeVerdict['status'],
    passed: typeof r.passed === 'number' ? r.passed : 0,
    total: typeof r.total === 'number' ? r.total : input.cases,
    failingInput: r.failingInput ?? null,
    output: r.output ?? null,
    error: r.error ?? null
  };
}
