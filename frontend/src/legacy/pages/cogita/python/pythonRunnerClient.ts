export type BrowserPythonEvaluateRequest = {
  createInputSource: string;
  referenceSource: string;
  starterSource: string;
  learnerSource: string;
  caseCount: number;
  seed: number;
};

export type BrowserPythonEvaluateStatus =
  | 'passed'
  | 'wrong_output'
  | 'runtime_error'
  | 'timeout'
  | 'invalid_submission'
  | 'runner_unavailable'
  | 'sandbox_error';

export type BrowserPythonEvaluateResult = {
  status: BrowserPythonEvaluateStatus;
  casesExecuted: number;
  failingInputJson?: string | null;
  userOutputJson?: string | null;
  errorMessage?: string | null;
};

export type BrowserPythonProgress = {
  phase: 'loading_pyodide' | 'running';
  casesExecuted: number;
  caseCount: number;
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
  result: BrowserPythonEvaluateResult;
};

type WorkerFatalMessage = {
  type: 'fatal';
  requestId: string;
  errorMessage: string;
};

type WorkerMessage = WorkerProgressMessage | WorkerResultMessage | WorkerFatalMessage;

type WorkerRequest = {
  type: 'evaluate';
  requestId: string;
  payload: BrowserPythonEvaluateRequest;
};

type EvaluateOptions = {
  timeoutMs?: number;
  onProgress?: (progress: BrowserPythonProgress) => void;
};

type PendingRequest = {
  resolve: (value: BrowserPythonEvaluateResult) => void;
  onProgress?: (progress: BrowserPythonProgress) => void;
  timeoutHandle: number;
};

const DEFAULT_TIMEOUT_MS = 15000;

function buildTimeoutResult(message: string): BrowserPythonEvaluateResult {
  return {
    status: 'timeout',
    casesExecuted: 0,
    errorMessage: message,
    failingInputJson: null,
    userOutputJson: null
  };
}

function normalizeResult(result: BrowserPythonEvaluateResult): BrowserPythonEvaluateResult {
  return {
    status: result.status ?? 'sandbox_error',
    casesExecuted: Math.max(0, Math.trunc(result.casesExecuted ?? 0)),
    failingInputJson: result.failingInputJson ?? null,
    userOutputJson: result.userOutputJson ?? null,
    errorMessage: result.errorMessage ?? null
  };
}

function createWorkerInstance() {
  return new Worker(new URL('./pythonRunner.worker.ts', import.meta.url), {
    type: 'module'
  });
}

export class BrowserPythonRunnerClient {
  private worker: Worker | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private sequence = 0;

  evaluate(request: BrowserPythonEvaluateRequest, options?: EvaluateOptions): Promise<BrowserPythonEvaluateResult> {
    const timeoutMs = Math.max(1000, options?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const worker = this.ensureWorker();
    const requestId = `${Date.now().toString(36)}-${(this.sequence += 1).toString(36)}`;

    return new Promise<BrowserPythonEvaluateResult>((resolve) => {
      const timeoutHandle = window.setTimeout(() => {
        this.pending.delete(requestId);
        this.resetWorker();
        resolve(buildTimeoutResult('Python evaluation timed out.'));
      }, timeoutMs);

      this.pending.set(requestId, {
        resolve,
        onProgress: options?.onProgress,
        timeoutHandle
      });

      const message: WorkerRequest = {
        type: 'evaluate',
        requestId,
        payload: request
      };
      worker.postMessage(message);
    });
  }

  dispose() {
    this.resolveAll({
      status: 'runner_unavailable',
      casesExecuted: 0,
      errorMessage: 'Python runner stopped.',
      failingInputJson: null,
      userOutputJson: null
    });
    this.resetWorker();
  }

  private ensureWorker() {
    if (this.worker) {
      return this.worker;
    }

    const worker = createWorkerInstance();
    worker.addEventListener('message', this.handleWorkerMessage as EventListener);
    worker.addEventListener('error', this.handleWorkerError as EventListener);
    this.worker = worker;
    return worker;
  }

  private handleWorkerMessage = (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    const pending = this.pending.get(message.requestId);
    if (!pending) return;

    if (message.type === 'progress') {
      pending.onProgress?.({
        phase: message.phase,
        casesExecuted: Math.max(0, Math.trunc(message.casesExecuted ?? 0)),
        caseCount: Math.max(1, Math.trunc(message.caseCount ?? 1))
      });
      return;
    }

    window.clearTimeout(pending.timeoutHandle);
    this.pending.delete(message.requestId);

    if (message.type === 'result') {
      pending.resolve(normalizeResult(message.result));
      return;
    }

    pending.resolve({
      status: 'sandbox_error',
      casesExecuted: 0,
      failingInputJson: null,
      userOutputJson: null,
      errorMessage: message.errorMessage || 'Python runner failed.'
    });
  };

  private handleWorkerError = () => {
    this.resolveAll({
      status: 'runner_unavailable',
      casesExecuted: 0,
      failingInputJson: null,
      userOutputJson: null,
      errorMessage: 'Python worker crashed.'
    });
    this.resetWorker();
  };

  private resolveAll(result: BrowserPythonEvaluateResult) {
    this.pending.forEach((entry) => {
      window.clearTimeout(entry.timeoutHandle);
      entry.resolve(result);
    });
    this.pending.clear();
  }

  private resetWorker() {
    if (!this.worker) return;
    this.worker.removeEventListener('message', this.handleWorkerMessage as EventListener);
    this.worker.removeEventListener('error', this.handleWorkerError as EventListener);
    this.worker.terminate();
    this.worker = null;
  }
}

