import { loadPyodide, type PyodideInterface } from 'pyodide';

type PythonEvaluatePayload = {
  createInputSource: string;
  referenceSource: string;
  starterSource: string;
  learnerSource: string;
  caseCount: number;
  seed: number;
};

type PythonEvaluateStatus =
  | 'passed'
  | 'wrong_output'
  | 'runtime_error'
  | 'timeout'
  | 'invalid_submission'
  | 'runner_unavailable'
  | 'sandbox_error';

type PythonEvaluateResult = {
  status: PythonEvaluateStatus;
  casesExecuted: number;
  failingInputJson: string | null;
  userOutputJson: string | null;
  errorMessage: string | null;
};

type WorkerEvaluateRequestMessage = {
  type: 'evaluate';
  requestId: string;
  payload: PythonEvaluatePayload;
};

type WorkerProgressMessage = {
  type: 'progress';
  requestId: string;
  phase: 'loading_pyodide' | 'running';
  casesExecuted: number;
  caseCount: number;
};

type WorkerResultMessage = {
  type: 'result';
  requestId: string;
  result: PythonEvaluateResult;
};

type WorkerFatalMessage = {
  type: 'fatal';
  requestId: string;
  errorMessage: string;
};

type WorkerRequestMessage = WorkerEvaluateRequestMessage;
type WorkerResponseMessage = WorkerProgressMessage | WorkerResultMessage | WorkerFatalMessage;

const PYODIDE_VERSION = '0.29.3';
const PYODIDE_CDN_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const MAX_CASE_COUNT = 200;
const DEFAULT_CASE_COUNT = 5;

let pyodidePromise: Promise<PyodideInterface> | null = null;

function postWorkerMessage(message: WorkerResponseMessage) {
  self.postMessage(message);
}

function normalizeCaseCount(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_CASE_COUNT;
  return Math.max(1, Math.min(MAX_CASE_COUNT, Math.round(value)));
}

function normalizeSeed(value: number) {
  if (!Number.isFinite(value)) return 1;
  const seed = Math.trunc(value);
  if (seed === 0) return 1;
  return seed;
}

function createDeterministicSeeds(seed: number, caseCount: number) {
  let state = (Math.abs(seed) >>> 0) || 0x9e3779b9;
  const seeds: number[] = [];
  for (let index = 0; index < caseCount; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    seeds.push(state >>> 0);
  }
  return seeds;
}

async function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodide({
      indexURL: PYODIDE_CDN_INDEX_URL
    });
  }
  return pyodidePromise;
}

function normalizeResult(result: Partial<PythonEvaluateResult>): PythonEvaluateResult {
  const status = (result.status ?? 'sandbox_error') as PythonEvaluateStatus;
  return {
    status,
    casesExecuted: Math.max(0, Math.trunc(result.casesExecuted ?? 0)),
    failingInputJson: result.failingInputJson ?? null,
    userOutputJson: result.userOutputJson ?? null,
    errorMessage: result.errorMessage ?? null
  };
}

async function evaluateWithPyodide(
  pyodide: PyodideInterface,
  requestId: string,
  payload: PythonEvaluatePayload
): Promise<PythonEvaluateResult> {
  const caseCount = normalizeCaseCount(payload.caseCount);
  const seed = normalizeSeed(payload.seed);
  const seeds = createDeterministicSeeds(seed, caseCount);

  postWorkerMessage({
    type: 'progress',
    requestId,
    phase: 'running',
    casesExecuted: 0,
    caseCount
  });

  const globals = pyodide.globals;
  globals.set('__cogita_create_input_source__', payload.createInputSource ?? '');
  globals.set('__cogita_reference_source__', payload.referenceSource ?? '');
  globals.set('__cogita_starter_source__', payload.starterSource ?? '');
  globals.set('__cogita_learner_source__', payload.learnerSource ?? '');
  globals.set('__cogita_seeds_json__', JSON.stringify(seeds));

  try {
    const resultJson = await pyodide.runPythonAsync(`
import copy
import json
import math
import re

def _safe_json(value):
    try:
        return json.dumps(value, ensure_ascii=False)
    except Exception:
        return json.dumps(repr(value), ensure_ascii=False)

def _deep_equal(left, right, tolerance):
    if isinstance(left, (int, float)) and not isinstance(left, bool) and isinstance(right, (int, float)) and not isinstance(right, bool):
        left_f = float(left)
        right_f = float(right)
        if math.isnan(left_f) and math.isnan(right_f):
            return True
        return abs(left_f - right_f) <= tolerance

    if isinstance(left, (list, tuple)) and isinstance(right, (list, tuple)):
        if len(left) != len(right):
            return False
        return all(_deep_equal(l, r, tolerance) for l, r in zip(left, right))

    if isinstance(left, dict) and isinstance(right, dict):
        if set(left.keys()) != set(right.keys()):
            return False
        return all(_deep_equal(left[key], right[key], tolerance) for key in left.keys())

    return left == right

def _result(status, cases_executed, failing_input_json=None, user_output_json=None, error_message=None):
    return json.dumps({
        "status": status,
        "casesExecuted": int(cases_executed),
        "failingInputJson": failing_input_json,
        "userOutputJson": user_output_json,
        "errorMessage": error_message,
    }, ensure_ascii=False)

create_src = (__cogita_create_input_source__ or "").strip()
reference_src = (__cogita_reference_source__ or "").strip()
learner_src = (__cogita_learner_source__ or "").strip()
_starter_src = (__cogita_starter_source__ or "").strip()
seed_values = json.loads(__cogita_seeds_json__ or "[]")
tolerance = 1e-9

if not re.search(r"^\\s*def\\s+transform\\s*\\(\\s*x\\s*\\)\\s*:", learner_src, flags=re.MULTILINE):
    _cogita_result_json = _result("invalid_submission", 0, None, None, "Submission must define function: def transform(x):")
else:
    scope = {}
    try:
        exec(create_src, scope, scope)
    except Exception as ex:
        _cogita_result_json = _result("sandbox_error", 0, None, None, f"create_input source failed: {ex.__class__.__name__}: {ex}")
    else:
        try:
            exec(reference_src, scope, scope)
        except Exception as ex:
            _cogita_result_json = _result("sandbox_error", 0, None, None, f"reference source failed: {ex.__class__.__name__}: {ex}")
        else:
            try:
                exec(learner_src, scope, scope)
            except SyntaxError as ex:
                _cogita_result_json = _result("invalid_submission", 0, None, None, f"{ex.__class__.__name__}: {ex}")
            except Exception as ex:
                _cogita_result_json = _result("invalid_submission", 0, None, None, f"{ex.__class__.__name__}: {ex}")
            else:
                create_input = scope.get("create_input")
                reference = scope.get("reference")
                transform = scope.get("transform")
                if not callable(create_input):
                    _cogita_result_json = _result("sandbox_error", 0, None, None, "Function create_input(seed) is missing.")
                elif not callable(reference):
                    _cogita_result_json = _result("sandbox_error", 0, None, None, "Function reference(x) is missing.")
                elif not callable(transform):
                    _cogita_result_json = _result("invalid_submission", 0, None, None, "Function transform(x) is missing.")
                else:
                    _cogita_result_json = None
                    for index, seed in enumerate(seed_values):
                        cases_executed = index + 1
                        try:
                            case_input = create_input(seed)
                        except Exception as ex:
                            _cogita_result_json = _result("sandbox_error", index, None, None, f"create_input failed: {ex.__class__.__name__}: {ex}")
                            break

                        failing_input_json = _safe_json(case_input)

                        try:
                            expected_output = reference(copy.deepcopy(case_input))
                        except Exception as ex:
                            _cogita_result_json = _result("sandbox_error", index, failing_input_json, None, f"reference failed: {ex.__class__.__name__}: {ex}")
                            break

                        try:
                            user_output = transform(copy.deepcopy(case_input))
                        except Exception as ex:
                            _cogita_result_json = _result("runtime_error", cases_executed, failing_input_json, None, f"{ex.__class__.__name__}: {ex}")
                            break

                        user_output_json = _safe_json(user_output)
                        if not _deep_equal(expected_output, user_output, tolerance):
                            _cogita_result_json = _result("wrong_output", cases_executed, failing_input_json, user_output_json, None)
                            break

                    if _cogita_result_json is None:
                        _cogita_result_json = _result("passed", len(seed_values), None, None, None)

_cogita_result_json
`);

    const parsed = JSON.parse(String(resultJson ?? '{}')) as Partial<PythonEvaluateResult>;
    return normalizeResult(parsed);
  } finally {
    globals.delete('__cogita_create_input_source__');
    globals.delete('__cogita_reference_source__');
    globals.delete('__cogita_starter_source__');
    globals.delete('__cogita_learner_source__');
    globals.delete('__cogita_seeds_json__');
  }
}

async function handleEvaluate(message: WorkerEvaluateRequestMessage) {
  const { requestId, payload } = message;

  try {
    postWorkerMessage({
      type: 'progress',
      requestId,
      phase: 'loading_pyodide',
      casesExecuted: 0,
      caseCount: normalizeCaseCount(payload.caseCount)
    });
    const pyodide = await getPyodide();
    const result = await evaluateWithPyodide(pyodide, requestId, payload);
    postWorkerMessage({ type: 'result', requestId, result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Python runner failed.';
    postWorkerMessage({
      type: 'fatal',
      requestId,
      errorMessage
    });
  }
}

self.addEventListener('message', (event: MessageEvent<WorkerRequestMessage>) => {
  const message = event.data;
  if (!message || typeof message !== 'object') return;
  if (message.type === 'evaluate') {
    void handleEvaluate(message);
  }
});

