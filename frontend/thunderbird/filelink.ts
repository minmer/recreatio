/**
 * DER DODATEK „recreatio.pl — Pliki przez link" (0125) — was er tut, ohne
 * Thunderbird: den Kod połączenia lesen, sich beim Dienst ausweisen, eine Datei
 * versiegeln und hinauflegen, die eigenen Links zurückziehen. `background.ts`
 * hängt das an Thunderbird, `settings.ts` zeigt es.
 *
 * <b>Dieselben Bytes wie die App</b>: Hülle, Etikett und Link kommen aus
 * `src/app/phone/shareSeal.ts`, gebündelt — ein Link aus der Post geht im Browser
 * genau so auf wie einer aus einer SMS, und „Pliki przez link" zeigt beide.
 *
 * <b>Kein Konto, kein Passwort</b>: der Dodatek hält nur das Połączenie (Geheimnis
 * und Schlüssel der Etiketten). Damit legt er Dateien in den Bereich und zieht die
 * eigenen zurück — lesen kann er dort nichts.
 */

import { fromBase64Url, toBase64Url } from '../src/app/core/crypto';
import { newSecret, readPairing, sealLabel, sealShare, SHARE_DAYS, SHARE_MAX, shareHeadOf, shareLink } from '../src/app/phone/shareSeal';
import type { CloudFileTemplateInfo } from './messenger';

/** Wohin sich dieser Bau verbinden darf — setzt `scripts/thunderbird-xpi.mjs` (dieselbe Liste steht in den Rechten des Manifests). */
declare const RC_SERVICES: readonly string[];

export const SERVICES: readonly string[] = RC_SERVICES;

/** Wie lange neue Links gelten, wenn nichts gewählt ist. */
export const DEFAULT_DAYS = 30;

export const daysOf = (value: unknown): number =>
  typeof value === 'number' && (SHARE_DAYS as readonly number[]).includes(value) ? value : DEFAULT_DAYS;

/** Was zu einem Konto in Thunderbird gespeichert ist. */
export interface Connection {
  /** Wo der Dienst liegt. */
  readonly api: string;
  /** Die Kennung des Połączenie (zeigen, nicht ausweisen). */
  readonly id: string;
  /** Das Geheimnis — `Authorization: Bearer …`. */
  readonly token: string;
  /** Der Schlüssel der Etiketten, base64url. */
  readonly key: string;
  /** Wie es auf recreatio.pl heisst. */
  readonly name: string;
  /** Wie lange neue Links gelten. */
  readonly days: number;
}

/** Was der Dienst über das Połączenie sagt — und wie viel Platz bleibt. */
export interface Usage {
  readonly maxFile: number;
  readonly held: number;
  readonly maxHeld: number;
  readonly today: number;
  readonly maxToday: number;
}

/** Ein angelegter Link. */
export interface Shared {
  readonly id: string;
  readonly url: string;
  readonly expiresAt: string;
}

/** Der Dienst sagt nein (mit seinem Wort) — oder ist nicht zu erreichen (`status` 0). */
export class ServiceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ServiceError';
  }
}

export const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

/** Was im Speicher liegt, nur wenn es ganz da ist — sonst `null` (dann ist das Konto nicht verbunden). */
export function readConnection(raw: unknown): Connection | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.api !== 'string' || !SERVICES.includes(o.api)) return null;
  if (typeof o.id !== 'string' || typeof o.token !== 'string' || typeof o.key !== 'string' || typeof o.name !== 'string') return null;
  try {
    if (fromBase64Url(o.key).length !== 32) return null;
  } catch {
    return null;
  }
  return { api: o.api, id: o.id, token: o.token, key: o.key, name: o.name, days: daysOf(o.days) };
}

/** Aus dem eingefügten Kod ein Połączenie — oder der Satz, der sagt, was nicht stimmt. */
export function connectionFrom(code: string, days: number): Connection | { readonly error: string } {
  const p = readPairing(code);
  if (p === null) {
    return { error: 'To nie jest kod połączenia z recreatio.pl. Skopiuj go jeszcze raz w całości (Pliki przez link → Połącz Thunderbirda).' };
  }
  if (!SERVICES.includes(p.api)) {
    return { error: `Ten kod jest dla innej usługi (${p.api}). Ten dodatek łączy się tylko z ${SERVICES.join(', ')}.` };
  }
  return { api: p.api, id: p.id, token: p.token, key: toBase64Url(p.key), name: p.name, days: daysOf(days) };
}

/** Ein Aufruf beim Dienst, mit dem Geheimnis statt einer Sitzung; Fehler mit dem Wort des Dienstes. */
async function ask(conn: Connection, path: string, init: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${conn.api}${path}`, {
      ...init,
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/json', Authorization: `Bearer ${conn.token}`, ...(init.headers as Record<string, string> | undefined) }
    });
  } catch (e) {
    if (isAbort(e)) throw e;
    throw new ServiceError('Brak połączenia z recreatio.pl — sprawdź internet i spróbuj ponownie.', 0);
  }
  const said = await response.json().catch(() => null) as { error?: unknown } | null;
  if (!response.ok) {
    const error = said !== null && typeof said === 'object' && typeof said.error === 'string' ? said.error : null;
    throw new ServiceError(
      error ?? (response.status >= 500 ? 'Usługa recreatio.pl nie odpowiada — spróbuj za chwilę.' : `Usługa recreatio.pl odmówiła (${response.status}).`),
      response.status
    );
  }
  return said;
}

/** Ob das Połączenie gilt — und wie viel der Bereich gerade teilt. */
export async function usage(conn: Connection): Promise<Usage> {
  const o = await ask(conn, '/share-device') as Partial<Usage> | null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return { maxFile: n(o?.maxFile) || SHARE_MAX, held: n(o?.held), maxHeld: n(o?.maxHeld), today: n(o?.today), maxToday: n(o?.maxToday) };
}

/**
 * EINE DATEI ALS LINK: versiegeln (ein JPEG ohne seine Angaben, wie aus einer SMS),
 * das Etikett unter dem Schlüssel des Połączenie, hinauf — der Link zurück.
 */
export async function putFile(conn: Connection, file: Blob, name: string, signal?: AbortSignal): Promise<Shared> {
  if (file.size > SHARE_MAX) throw new ServiceError('Plik przez link może mieć najwyżej 25 MB.', 413);
  const { head, bytes } = shareHeadOf(name, file.type, new Uint8Array(await file.arrayBuffer()));
  signal?.throwIfAborted();

  const secret = newSecret();
  const { id, sealed } = await sealShare(secret, head, bytes);
  const label = await sealLabel(fromBase64Url(conn.key), id, { ...head, secret: toBase64Url(secret), to: [], via: 'thunderbird' });
  const said = await ask(conn, `/share-device/share/${id}?days=${conn.days}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream', 'X-Share-Label': toBase64Url(label) },
    body: new Blob([sealed as BlobPart], { type: 'application/octet-stream' }),
    signal
  }) as { expiresAt?: unknown } | null;
  return { id, url: shareLink(secret), expiresAt: typeof said?.expiresAt === 'string' ? said.expiresAt : '' };
}

/** Einen eigenen Link zurückziehen — die Datei ist sofort fort. */
export async function dropFile(conn: Connection, shareId: string): Promise<boolean> {
  const said = await ask(conn, `/share-device/share/${encodeURIComponent(shareId)}`, { method: 'DELETE' }) as { deleted?: unknown } | null;
  return said?.deleted === true;
}

/** Sich selbst trennen: das Geheimnis gilt danach nirgends mehr. */
export async function leave(conn: Connection): Promise<void> {
  await ask(conn, '/share-device', { method: 'DELETE' });
}

/** Was Thunderbird unter den Link in die Nachricht schreibt: der Dienst und bis wann der Link gilt. */
export function templateOf(expiresAt: string): CloudFileTemplateInfo {
  const at = Date.parse(expiresAt);
  return {
    service_name: 'recreatio.pl',
    service_url: 'https://recreatio.pl',
    ...(Number.isFinite(at) ? { download_expiry_date: { timestamp: Math.round(at), format: { day: 'numeric', month: 'long', year: 'numeric' } } } : {})
  };
}

/** „3,2 MB", „240 KB", „2 GB". */
export function bytesText(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(bytes > 0 ? 1 : 0, Math.round(bytes / 1024)).toLocaleString('pl-PL')} KB`;
}
