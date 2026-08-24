/**
 * Der einzige Weg zur neuen API.
 *
 * Drei Dinge macht diese Datei, die sonst jeder Aufrufer einzeln machen müsste
 * — und einer davon würde es vergessen:
 *
 *   1. Den Schutzwert (CSRF) besorgen und mitschicken. Der Server verlangt ihn
 *      als Standardverhalten, auch bei der Anmeldung.
 *   2. Das Öffnungsstück im eigenen Kopf `X-Rc-Unlock` mitschicken — getrennt
 *      vom Anmeldenachweis (3.9, Schicht 2).
 *   3. Fehler in die Form aus 15.7 bringen, damit der Aufrufer auf `code`
 *      prüfen kann und nicht auf einen Meldungstext.
 *
 * Alles läuft über `credentials: 'include'`: die API liegt auf einem anderen
 * Ursprung als diese Seite.
 */

const RC_BASE = (import.meta.env.VITE_RC_API_BASE as string | undefined) ?? '/rc';

/** 15.7 — Der Klient entscheidet anhand von `code`, nie anhand von `message`. */
export interface RcApiError {
  readonly code: string;
  readonly message: string;
  readonly traceId?: string;
  readonly details?: Readonly<Record<string, string>>;
}

export class RcRequestError extends Error {
  constructor(
    readonly status: number,
    readonly error: RcApiError
  ) {
    super(error.message);
    this.name = 'RcRequestError';
  }

  get code(): string {
    return this.error.code;
  }
}

let csrfToken: string | null = null;

/**
 * Das Öffnungsstück lebt im `sessionStorage`, nicht im `localStorage`: es soll
 * mit dem Schließen des Tabs verschwinden. Und nicht im Speicher einer
 * Variablen allein, weil ein Neuladen der Seite sonst einen erneuten
 * Argon2id-Lauf erzwingt — bei 64 MiB auf einem Telefon ist das kein Detail.
 */
const UNLOCK_KEY = 'rc.unlock';

export function rcSetUnlockPiece(piece: string | null): void {
  if (piece === null) sessionStorage.removeItem(UNLOCK_KEY);
  else sessionStorage.setItem(UNLOCK_KEY, piece);
}

export function rcUnlockPiece(): string | null {
  return sessionStorage.getItem(UNLOCK_KEY);
}

export async function rcCsrf(force = false): Promise<string> {
  if (csrfToken !== null && !force) return csrfToken;

  const response = await fetch(`${RC_BASE}/csrf`, { method: 'POST', credentials: 'include' });
  if (!response.ok) throw await toError(response);

  const body = (await response.json()) as { token: string };
  csrfToken = body.token;
  return csrfToken;
}

export interface RcFetchOptions {
  readonly method?: string;
  readonly body?: unknown;
  /** Für Aufrufe, die verschlüsselte Inhalte berühren (3.9). */
  readonly withUnlock?: boolean;
  readonly signal?: AbortSignal;
}

export async function rcFetch<T>(path: string, options: RcFetchOptions = {}): Promise<T> {
  const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');
  const headers: Record<string, string> = {};

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers['X-Rc-Csrf'] = await rcCsrf();
  }

  if (options.withUnlock) {
    const piece = rcUnlockPiece();
    if (piece !== null) headers['X-Rc-Unlock'] = piece;
  }

  const response = await fetch(`${RC_BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal
  });

  // Der Schutzwert läuft nach zwölf Stunden ab. Ein offener Tab über Nacht ist
  // der Normalfall, nicht die Ausnahme — also einmal nachholen statt den
  // Menschen mit einer Fehlermeldung zum Neuladen zu schicken.
  if (response.status === 403 && method !== 'GET') {
    const failure = await toError(response);
    if (failure.code === 'auth.csrf_missing') {
      headers['X-Rc-Csrf'] = await rcCsrf(true);
      const retry = await fetch(`${RC_BASE}${path}`, {
        method,
        credentials: 'include',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal
      });
      if (!retry.ok) throw await toError(retry);
      return (await retry.json()) as T;
    }
    throw failure;
  }

  if (!response.ok) throw await toError(response);
  return (await response.json()) as T;
}

async function toError(response: Response): Promise<RcRequestError> {
  let error: RcApiError = {
    code: 'client.unreadable_error',
    message: `Der Server antwortete mit ${response.status}.`
  };

  try {
    const body = (await response.json()) as Partial<RcApiError>;
    if (typeof body.code === 'string' && typeof body.message === 'string') {
      error = body as RcApiError;
    }
  } catch {
    // Eine Antwort ohne lesbaren Körper ist selbst ein Befund, aber kein Grund,
    // hier eine zweite Ausnahme zu werfen.
  }

  return new RcRequestError(response.status, error);
}
