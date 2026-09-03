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

import type { components } from './rcApiTypes';
import { RC_API_ORIGIN } from './rcOrigins';

/**
 * Wo die Plattform-API liegt.
 *
 * <b>Der Rückfall war relativ, und genau daher kam der 405.</b> `/rc` löst
 * gegen den Ursprung der Seite auf; auf recreatio.pl ist das GitHub Pages, ein
 * Dateiserver, der auf JEDES POST mit 405 antwortet. Es war also nie eine API,
 * die da geantwortet hat.
 *
 * Der Altbestand hatte dieses Problem nie, weil sein Rückfall ABSOLUT ist
 * (`src/lib/api.ts`: `?? 'https://api.recreatio.pl'`). Ohne gesetzte
 * Umgebungsvariable zeigt er trotzdem auf den richtigen Dienst — hier zeigte er
 * auf den Dateiserver.
 *
 * Relativ bleibt es nur in der ENTWICKLUNG, und dort ist es richtig: der
 * Entwicklungsserver leitet `/rc` an den lokalen Dienst weiter, damit beides
 * unter demselben Ursprung liegt und das Sitzungsplätzchen überhaupt
 * zurückkommt (siehe `vite.config.ts` und `RcCookiePolicy`).
 *
 * DOMAENENWECHSEL — der feste Name steht in `rcOrigins.ts`, zusammen mit der
 * Liste dessen, was sich mit weiteren Domänen sonst noch ändert.
 */
const RC_BASE =
  (import.meta.env.VITE_RC_API_BASE as string | undefined)
  ?? (import.meta.env.DEV ? '/rc' : `${RC_API_ORIGIN}/rc`);

/**
 * 15.6 — Die Formen kommen aus `rcApiTypes.ts`, und die Datei ist erzeugt.
 *
 * Vorher stand jede Antwortform zweimal da: einmal als Datensatz in C#, einmal
 * hier als Schnittstelle, die ich von Hand nachgebaut hatte. Benannte jemand im
 * Server ein Feld um, übersetzte dieser Teil weiter und lieferte an der Stelle
 * `undefined` — der Fehler fiel dann nicht beim Bauen auf, sondern bei einem
 * Menschen.
 *
 * `RcApi<'RcSessionStartedResponse'>` verweist dagegen auf den Server; eine
 * Umbenennung dort wird hier zum Übersetzungsfehler.
 *
 * <b>Was das NICHT leistet.</b> Es sichert die Gestalt zu, nicht die Bedeutung.
 * Dass ein Feld Geheimtext enthält, dass zum Lesen ein Epochenschlüssel gehört,
 * dass `secret` sich nicht freigeben lässt — davon weiß der Erzeuger nichts.
 * Das steht weiter von Hand hier.
 */
export type RcApi<K extends keyof components['schemas']> = components['schemas'][K];

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

/**
 * Der eine Weg nach draußen.
 *
 * Anfrage und Wiederholung wurden hier einmal getrennt gebaut — zwei fast
 * gleiche Blöcke, von denen einer beim nächsten Zusatz stillschweigend
 * zurückgeblieben wäre. Jetzt gibt es `send()` und zwei Aufrufe davon.
 */
export async function rcRaw(path: string, options: RcFetchOptions = {}): Promise<Response> {
  const isForm = options.body instanceof FormData;
  const method = options.method ?? (options.body === undefined ? 'GET' : 'POST');
  const headers: Record<string, string> = {};

  // Bei FormData setzt der Browser den Typ SELBST — mitsamt der Trennmarke,
  // die er würfelt. Wer ihn hier von Hand setzt, liefert einen Körper, den
  // keine Gegenstelle zerlegen kann.
  if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers['X-Rc-Csrf'] = await rcCsrf();
  }

  if (options.withUnlock) {
    const piece = rcUnlockPiece();
    if (piece !== null) headers['X-Rc-Unlock'] = piece;
  }

  const send = () =>
    fetch(`${RC_BASE}${path}`, {
      method,
      credentials: 'include',
      headers,
      body:
        options.body === undefined ? undefined
        : isForm ? (options.body as FormData)
        : JSON.stringify(options.body),
      signal: options.signal
    });

  const response = await send();

  // Der Schutzwert läuft nach zwölf Stunden ab. Ein offener Tab über Nacht ist
  // der Normalfall, nicht die Ausnahme — also einmal nachholen statt den
  // Menschen mit einer Fehlermeldung zum Neuladen zu schicken.
  if (response.status === 403 && method !== 'GET') {
    const failure = await toError(response);
    if (failure.code !== 'auth.csrf_missing') throw failure;

    headers['X-Rc-Csrf'] = await rcCsrf(true);
    const retry = await send();
    if (!retry.ok) throw await toError(retry);
    return retry;
  }

  if (!response.ok) {
    const failure = await toError(response);

    /*
     * EINE SITZUNG, DIE NICHT MEHR GILT, MUSS AUCH HIER ENDEN.
     *
     * Vorher fing jeder Aufrufer den Fehler ab, zeigte eine Meldung — und die
     * Anwendung hielt sich weiter für angemeldet. Man sass vor einer Werkstatt,
     * in der jeder Handgriff scheiterte, und nichts sagte, dass man draussen
     * ist. Erst Abmelden und neu Anmelden half, und darauf muss man erst
     * einmal kommen.
     *
     * Der Fall ist nicht selten: nach einem Ausrollen, das die Schutzschluessel
     * der Cookies verliert, ist JEDES vorher ausgestellte Cookie unlesbar. Der
     * Browser schickt es weiter, der Dienst kann nichts damit anfangen.
     *
     * Das gehoert HIERHER und nicht in die Aufrufer: es gibt Dutzende, und
     * einer vergisst es immer.
     */
    if (failure.status === 401 && SESSION_GONE.has(failure.code)) rcSessionGone();

    throw failure;
  }
  return response;
}

/**
 * Welche Fehler heissen „diese Sitzung gilt nicht mehr".
 *
 * NICHT jeder 401: eine fehlende Berechtigung ist etwas anderes als eine
 * abgelaufene Sitzung, und wer bei jedem `403` abgemeldet wuerde, floege aus
 * der Anwendung, weil er einmal irgendwo nicht hindurfte.
 */
const SESSION_GONE: ReadonlySet<string> = new Set([
  'session.not_signed_in',
  'session.expired',
  'session.revoked'
]);

/**
 * Wer erfahren will, dass die Sitzung fort ist.
 *
 * Ein einzelner Empfänger und keine Liste: es gibt genau eine Anwendung, und
 * eine Liste waere eine Gelegenheit, Anmeldungen zu vergessen, die niemand
 * mehr abmeldet.
 */
let onSessionGone: (() => void) | null = null;

export function rcOnSessionGone(handler: (() => void) | null): void {
  onSessionGone = handler;
}

/**
 * Aufraeumen und Bescheid geben.
 *
 * Das Öffnungsstück fliegt IMMER weg, auch wenn niemand zuhört: ein Stück ohne
 * Sitzung öffnet nichts und bleibt sonst liegen, bis der Tab zugeht.
 */
function rcSessionGone(): void {
  rcSetUnlockPiece(null);
  onSessionGone?.();
}

export async function rcFetch<T>(path: string, options: RcFetchOptions = {}): Promise<T> {
  return (await rcRaw(path, options)).json() as Promise<T>;
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
