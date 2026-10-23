/**
 * PLIKI PRZEZ LINK (0117) — statt einer MMS, die der Netzbetreiber auf ein paar
 * hundert KB drückt, eine SMS mit einem Link: das Zdjęcie in voller Grösse, ein
 * Film, ein PDF, bis 25 MB.
 *
 * Hier der Weg zum Dienst: hinauf, die eigenen Links, zurückziehen, herunter.
 * Was aus dem Geheimnis folgt, die Hülle und das Etikett stehen in `shareSeal.ts`
 * — ohne Sitzung, damit der Dodatek für Thunderbird dieselben Bytes bündelt.
 *
 * 0125 — POŁĄCZENIA: Programme, die Links anlegen, ohne ein Konto anzumelden
 * (Thunderbird). Hier entstehen sie (`connectDevice` → der Kod połączenia), hier
 * werden sie gezeigt und getrennt; ihre Links stehen mit den anderen in der Liste.
 */

import { fromBase64Url, toBase64Url } from '../core/crypto';
import { newId } from '../core/ids';
import { API, call, WorkspaceError } from '../core/session';
import type { PhoneCtx } from './phoneContext';
import {
  deviceName, newDeviceKey, newSecret, openDevice, openLabel, pairingCode, sealDevice, sealLabel, sealShare, SHARE_MAX, shareHeadOf, shareLink,
  type DeviceDoc, type ShareLabel
} from './shareSeal';

export interface ShareEntry {
  readonly id: string;
  readonly size: number;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly downloads: number;
  readonly lastDownloadAt: string | null;
  /** Geöffnet — `null`: geht nicht auf (fremde Epoche, ein Połączenie ohne lesbaren Schlüssel). */
  readonly label: ShareLabel | null;
  /** 0125 — das Połączenie, das ihn anlegte (mit seinem Namen, wenn er aufgeht); `null`: aus der App. */
  readonly device: { readonly id: string; readonly name: string | null } | null;
}

/* -- Hinauf (der Absender) --------------------------------------------------------------------- */

/**
 * Hinauf mit Fortschritt — 25 MB über ein langsames Netz dauern, und ein Balken sagt
 * mehr als „Wysyłanie…". Darum hier `XMLHttpRequest` (fetch meldet beim Hochladen
 * nichts); Keks und Fehlerform wie bei `call`.
 */
function put(path: string, body: Uint8Array, headers: Readonly<Record<string, string>>, onProgress?: (done: number, total: number) => void): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${API}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded, e.total); };
    xhr.onload = () => {
      let said: unknown = null;
      try { said = JSON.parse(xhr.responseText); } catch { said = null; }
      if (xhr.status >= 200 && xhr.status < 300) { resolve(said); return; }
      const error = said !== null && typeof said === 'object' && 'error' in said ? String((said as { error: unknown }).error) : null;
      reject(new WorkspaceError(error ?? (xhr.status >= 500 ? 'Usługa nie odpowiada — spróbuj za chwilę.' : 'Nie udało się wysłać pliku.')));
    };
    xhr.onerror = () => reject(new WorkspaceError('Brak połączenia — plik nie został wysłany.'));
    xhr.send(new Blob([body as BlobPart]));
  });
}

/** EINE DATEI TEILEN: versiegeln, hinauf, den Link zurück. */
export async function shareFile(
  ctx: PhoneCtx, file: File,
  options: { readonly days: number; readonly to?: readonly string[]; readonly onProgress?: (done: number, total: number) => void }
): Promise<{ id: string; link: string; expiresAt: string }> {
  if (file.size > SHARE_MAX) throw new WorkspaceError('Plik przez link może mieć najwyżej 25 MB.');
  const { head, bytes } = shareHeadOf(file.name, file.type, new Uint8Array(await file.arrayBuffer()));

  const secret = newSecret();
  const { id, sealed } = await sealShare(secret, head, bytes);
  const label: ShareLabel = { ...head, secret: toBase64Url(secret), to: [...(options.to ?? [])] };
  const sealedLabel = await sealLabel(ctx.newest.key, id, label);
  const said = await put(
    `/workspace/phone/${encodeURIComponent(ctx.areaId)}/share/${id}?epoch=${ctx.newest.epoch}&days=${options.days}`,
    sealed, { 'X-Share-Label': toBase64Url(sealedLabel) }, options.onProgress
  ) as { expiresAt?: string } | null;
  return { id, link: shareLink(secret), expiresAt: said?.expiresAt ?? '' };
}

interface SealedDevice {
  readonly id: string;
  readonly epoch: number;
  readonly sealed: string;
}

/** Den versiegelten Teil eines Połączenie öffnen — mit der Epoche, unter der er liegt. */
async function deviceDoc(ctx: PhoneCtx, d: SealedDevice): Promise<DeviceDoc | null> {
  const key = ctx.keys.get(d.epoch);
  return key === undefined ? null : openDevice(key, d.id, fromBase64Url(d.sealed));
}

/**
 * Die eigenen Links, die noch gelten — neueste zuerst. Was ein Połączenie anlegte,
 * öffnet sich unter seinem Schlüssel; den bringt der Dienst mit (`devices`). Ein Dienst
 * vor 0125 schickt beides nicht — dann ist alles aus der App.
 */
export async function loadShares(ctx: PhoneCtx): Promise<ShareEntry[]> {
  const { shares, devices } = await call<{
    shares: readonly (Omit<ShareEntry, 'label' | 'device'> & { epoch: number; label: string; device?: string | null })[];
    devices?: readonly SealedDevice[];
  }>(`/workspace/phone/${encodeURIComponent(ctx.areaId)}/shares`);

  const docs = new Map<string, DeviceDoc | null>();
  for (const d of devices ?? []) docs.set(d.id, await deviceDoc(ctx, d));

  const out: ShareEntry[] = [];
  for (const s of shares) {
    const deviceId = s.device ?? null;
    const key = deviceId === null ? ctx.keys.get(s.epoch) : docs.get(deviceId)?.key;
    const label = key === undefined ? null : await openLabel(key, s.id, fromBase64Url(s.label));
    out.push({
      id: s.id, size: s.size, createdAt: s.createdAt, expiresAt: s.expiresAt, downloads: s.downloads, lastDownloadAt: s.lastDownloadAt, label,
      device: deviceId === null ? null : { id: deviceId, name: docs.get(deviceId)?.name ?? null }
    });
  }
  return out;
}

/** Zurückziehen: die Datei ist sofort fort. */
export const unshare = (ctx: PhoneCtx, id: string): Promise<unknown> =>
  call(`/workspace/phone/${encodeURIComponent(ctx.areaId)}/share/${encodeURIComponent(id)}`, { method: 'DELETE' });

/* -- Połączenia (0125) ------------------------------------------------------------------------- */

/** Ein Programm, das Links anlegt — so, wie es in der Liste steht. */
export interface ShareDevice {
  readonly id: string;
  /** `null`: der Name geht nicht auf (eine Epoche, die ich nicht halte). */
  readonly name: string | null;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  /** Was es gerade teilt: wie viele Links, wie viele Bytes. */
  readonly shares: number;
  readonly bytes: number;
}

/**
 * Die Adresse des Dienstes, ganz ausgeschrieben — für den Kod: Thunderbird kennt
 * keine Seite, gegen die sich `/api` auflösen liesse.
 */
const serviceUrl = (): string => new URL(API, window.location.href).href.replace(/\/+$/, '');

/** Die Połączenia des eigenen Bereichs. Ein Dienst vor 0125 kennt sie nicht — dann `null`. */
export async function loadDevices(ctx: PhoneCtx): Promise<ShareDevice[] | null> {
  let said: { devices: readonly (SealedDevice & Omit<ShareDevice, 'id' | 'name'>)[] };
  try {
    said = await call(`/workspace/phone/${encodeURIComponent(ctx.areaId)}/share-devices`);
  } catch (e) {
    if (e instanceof WorkspaceError && e.message === 'Nie udało się.') return null;
    throw e;
  }
  const out: ShareDevice[] = [];
  for (const d of said.devices) {
    const doc = await deviceDoc(ctx, d);
    out.push({ id: d.id, name: doc?.name ?? null, createdAt: d.createdAt, lastUsedAt: d.lastUsedAt, shares: d.shares, bytes: d.bytes });
  }
  return out;
}

/**
 * EIN PROGRAMM VERBINDEN: Kennung und Schlüssel der Etiketten entstehen hier, der
 * Dienst gibt das Geheimnis einmal heraus — zusammen der Kod połączenia. Er wird
 * nur jetzt gezeigt; wer ihn verliert, verbindet neu (und trennt das alte).
 */
export async function connectDevice(ctx: PhoneCtx, name: string): Promise<{ id: string; code: string }> {
  const id = newId();
  const doc: DeviceDoc = { key: newDeviceKey(), name: deviceName(name) };
  const sealed = await sealDevice(ctx.newest.key, id, doc);
  const said = await call<{ id: string; token: string }>(`/workspace/phone/${encodeURIComponent(ctx.areaId)}/share-devices`, {
    method: 'POST',
    body: JSON.stringify({ id, epoch: ctx.newest.epoch, sealed: toBase64Url(sealed) })
  });
  return { id, code: pairingCode({ api: serviceUrl(), id, token: said.token, key: doc.key, name: doc.name }) };
}

/** Trennen: das Programm weist sich ab sofort nicht mehr aus; seine Links gelten bis zu ihrem Ablauf. */
export const disconnectDevice = (ctx: PhoneCtx, id: string): Promise<unknown> =>
  call(`/workspace/phone/${encodeURIComponent(ctx.areaId)}/share-device/${encodeURIComponent(id)}`, { method: 'DELETE' });

/* -- Herunter (wer den Link hat, ohne Konto) ------------------------------------------------- */

/** Der Link gilt nicht (mehr) — mit dem Wort des Dienstes. */
export class ShareGone extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function goneOf(response: Response): Promise<ShareGone> {
  const said = await response.json().catch(() => null) as { error?: unknown } | null;
  const error = said !== null && typeof said.error === 'string' ? said.error : null;
  return new ShareGone(
    error ?? (response.status === 410 ? 'Ten link wygasł.' : response.status === 404 ? 'Tego pliku nie ma — został usunięty albo link jest niepełny.' : 'Usługa nie odpowiada — spróbuj za chwilę.'),
    response.status
  );
}

const unreachable = () => new ShareGone('Brak połączenia z recreatio.pl — spróbuj ponownie.', 0);

/** Was der Link noch ist: wie gross, bis wann. */
export async function shareInfo(id: string): Promise<{ size: number; createdAt: string; expiresAt: string }> {
  let response: Response;
  try { response = await fetch(`${API}/share/${encodeURIComponent(id)}/info`, { credentials: 'omit' }); } catch { throw unreachable(); }
  if (!response.ok) throw await goneOf(response);
  return await response.json() as { size: number; createdAt: string; expiresAt: string };
}

/** Die Hülle holen — mit Fortschritt, wenn der Browser ihn hergibt. */
export async function fetchShare(id: string, onProgress?: (done: number, total: number) => void): Promise<Uint8Array> {
  let response: Response;
  try { response = await fetch(`${API}/share/${encodeURIComponent(id)}`, { credentials: 'omit' }); } catch { throw unreachable(); }
  if (!response.ok) throw await goneOf(response);
  const total = Number(response.headers.get('Content-Length') ?? '0') || 0;
  const reader = response.body?.getReader();
  if (reader === undefined) return new Uint8Array(await response.arrayBuffer());
  const chunks: Uint8Array[] = [];
  let done = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) break;
    chunks.push(step.value);
    done += step.value.length;
    onProgress?.(done, total);
  }
  const out = new Uint8Array(done);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}
