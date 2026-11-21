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
import { t } from '../core/i18n';
import { API, call, Unreachable, WorkspaceError } from '../core/session';
import { fetchRange, RangeOffline, RangeRefused } from '../core/rangeFetch';
import type { PhoneCtx } from './phoneContext';
import {
  cleanName, deviceName, isPieced, newDeviceKey, newSecret, openDevice, openLabel, openPiece, openPiecedHead, openShare, pairingCode, piecedHeadEnd,
  piecesFor, pieceSpan, sealDevice, sealLabel, sealPiece, sealPiecedHead, sealShare, SHARE_BIG_MAX, SHARE_MAX, SHARE_PIECE, shareHeadOf, shareKeys,
  shareLink, withoutPlace, type DeviceDoc, type ShareHead, type ShareLabel
} from './shareSeal';

/** 2026-11-21 — bis hierher in einem Stück (geht auch an einen Dienst von vorher); darüber in Stücken. */
const ONE_PIECE_UP_TO = 8 * 1024 * 1024;

/** Wie lange ein Link gilt, zum Lesen (`shareSeal.ts` bleibt ohne Texte — der Dodatek bündelt es allein). */
export const daysLabel = (days: number): string => (days === 365 ? t('phoneShare.oneYear') : t('phoneShare.days', { count: days }));

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

/** 2026-10-27 — der Absender hat das Hinauf angehalten („Przerwij"): kein Fehler, nur nichts geschehen. */
export class ShareStopped extends Error {
  constructor() {
    super(t('phoneShare.err.stopped'));
  }
}

/**
 * Hinauf mit Fortschritt — 25 MB über ein langsames Netz dauern, und ein Balken sagt
 * mehr als „Wysyłanie…". Darum hier `XMLHttpRequest` (fetch meldet beim Hochladen
 * nichts); Keks und Fehlerform wie bei `call`. `signal` hält es an: der Dienst legt
 * nur ab, was ganz ankam.
 */
function put(
  path: string, body: Uint8Array, headers: Readonly<Record<string, string>>,
  onProgress?: (done: number, total: number) => void, signal?: AbortSignal
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) { reject(new ShareStopped()); return; }
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `${API}${path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded, e.total); };
    const stop = () => xhr.abort();
    signal?.addEventListener('abort', stop, { once: true });
    xhr.onloadend = () => signal?.removeEventListener('abort', stop);
    xhr.onload = () => {
      let said: unknown = null;
      try { said = JSON.parse(xhr.responseText); } catch { said = null; }
      if (xhr.status >= 200 && xhr.status < 300) { resolve(said); return; }
      const error = said !== null && typeof said === 'object' && 'error' in said ? String((said as { error: unknown }).error) : null;
      /* 2026-11-21 — 404 ohne Grund: diesen Weg kennt der Dienst nicht (ein Dienst vor den Stücken). */
      if (xhr.status === 404 && error === null) { reject(new NoPieces()); return; }
      reject(new WorkspaceError(error ?? (xhr.status >= 500 ? t('phoneShare.err.service') : t('phoneShare.err.sendFailed'))));
    };
    xhr.onerror = () => reject(new WorkspaceError(t('phoneShare.err.offline')));
    xhr.onabort = () => reject(new ShareStopped());
    xhr.send(new Blob([body as BlobPart]));
  });
}

/** EINE DATEI TEILEN: versiegeln, hinauf, den Link zurück. */
export async function shareFile(
  ctx: PhoneCtx, file: File,
  options: {
    readonly days: number;
    readonly to?: readonly string[];
    readonly onProgress?: (done: number, total: number) => void;
    /** Anhalten — auch schon beim Lesen und Versiegeln (dann geht gar nichts hinaus). */
    readonly signal?: AbortSignal;
  }
): Promise<{ id: string; link: string; expiresAt: string }> {
  if (file.size > SHARE_BIG_MAX) throw new WorkspaceError(t('phoneShare.err.tooBig'));
  if (file.size > ONE_PIECE_UP_TO) {
    try {
      return await sharePieced(ctx, file, options);
    } catch (e) {
      if (!(e instanceof NoPieces)) throw e;
      /* Der Dienst kennt die Stücke noch nicht: bis 25 MB geht es in einem, darüber nicht. */
      if (file.size > SHARE_MAX) throw new WorkspaceError(t('phoneShare.err.tooBigHere'));
    }
  }
  return shareWhole(ctx, file, options);
}

/** Ein Dienst ohne `…/part/{n}` (vor 2026-11-21). */
class NoPieces extends Error {}

/** In EINER Hülle (Fassung 1) — bis 8 MB immer, bis 25 MB, wo der Dienst keine Stücke kennt. */
async function shareWhole(
  ctx: PhoneCtx, file: File,
  options: { readonly days: number; readonly to?: readonly string[]; readonly onProgress?: (done: number, total: number) => void; readonly signal?: AbortSignal }
): Promise<{ id: string; link: string; expiresAt: string }> {
  const halt = () => { if (options.signal?.aborted === true) throw new ShareStopped(); };
  let raw: Uint8Array;
  try {
    raw = new Uint8Array(await file.arrayBuffer());
  } catch {
    /* Ein Ordner, eine Datei, die inzwischen fort ist, eine Wolkendatei ohne Netz. */
    throw new WorkspaceError(t('phoneShare.err.unreadable'));
  }
  halt();
  const { head, bytes } = shareHeadOf(file.name, file.type, raw);

  const secret = newSecret();
  const { id, sealed } = await sealShare(secret, head, bytes);
  const label: ShareLabel = { ...head, secret: toBase64Url(secret), to: [...(options.to ?? [])] };
  const sealedLabel = await sealLabel(ctx.newest.key, id, label);
  halt();
  const said = await put(
    `/workspace/phone/${encodeURIComponent(ctx.areaId)}/share/${id}?epoch=${ctx.newest.epoch}&days=${options.days}`,
    sealed, { 'X-Share-Label': toBase64Url(sealedLabel) }, options.onProgress, options.signal
  ) as { expiresAt?: string } | null;
  return { id, link: shareLink(secret), expiresAt: said?.expiresAt ?? '' };
}

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted === true) { reject(new ShareStopped()); return; }
  const timer = setTimeout(done, ms);
  function done() { signal?.removeEventListener('abort', stop); window.removeEventListener('online', done); clearTimeout(timer); resolve(); }
  function stop() { clearTimeout(timer); window.removeEventListener('online', done); reject(new ShareStopped()); }
  signal?.addEventListener('abort', stop, { once: true });
  window.addEventListener('online', done, { once: true });
});

/**
 * EIN STÜCK HINAUF — und bei einem Aussetzer noch einmal, nur dieses: nach 1, 2, 4 …
 * bis 30 Sekunden, und sofort, sobald das Netz wieder da ist. Was der Dienst
 * ablehnt (ein 4xx mit Grund), geht nicht noch einmal.
 */
async function putPatiently(
  path: string, body: Uint8Array, headers: Readonly<Record<string, string>>,
  onProgress: (done: number) => void, signal?: AbortSignal
): Promise<unknown> {
  let last: unknown = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    if (attempt > 0) await wait(Math.min(30_000, 1000 * 2 ** (attempt - 1)), signal);
    try {
      return await put(path, body, headers, (done) => onProgress(done), signal);
    } catch (e) {
      onProgress(0);
      if (e instanceof ShareStopped) throw e;
      /* Ein Fehler des Netzes oder des Dienstes (5xx) — noch einmal; ein Nein mit Grund nicht. */
      const retry = e instanceof WorkspaceError && (e.message === t('phoneShare.err.offline') || e.message === t('phoneShare.err.service'));
      if (!retry) throw e;
      last = e;
    }
  }
  throw last instanceof Error ? last : new WorkspaceError(t('phoneShare.err.offline'));
}

/**
 * 2026-11-21 — EINE GROSSE DATEI IN STÜCKEN (`shareSeal.ts`, Fassung 2): jedes Stück
 * wird erst beim Schicken gelesen und versiegelt (nie die ganze Datei im Speicher),
 * jedes geht für sich hinauf und wird bei einem Aussetzer allein wiederholt. Am
 * Ende setzt der Dienst sie zusammen (`finish`).
 */
async function sharePieced(
  ctx: PhoneCtx, file: File,
  options: { readonly days: number; readonly to?: readonly string[]; readonly onProgress?: (done: number, total: number) => void; readonly signal?: AbortSignal }
): Promise<{ id: string; link: string; expiresAt: string }> {
  const halt = () => { if (options.signal?.aborted === true) throw new ShareStopped(); };
  const type = file.type === '' ? 'application/octet-stream' : file.type;

  /* Ein Foto ohne seinen Ort — ein JPEG dieser Grösse passt noch ganz in den Speicher. */
  let source: Blob = file;
  if (type === 'image/jpeg' && file.size <= 64 * 1024 * 1024) {
    try { source = new Blob([withoutPlace(new Uint8Array(await file.arrayBuffer())) as BlobPart], { type }); } catch { throw new WorkspaceError(t('phoneShare.err.unreadable')); }
  }
  const head: ShareHead = { name: cleanName(file.name), type, size: source.size };

  const secret = newSecret();
  const keys = await shareKeys(secret);
  const pieces = piecesFor(head.size);
  const label: ShareLabel = { ...head, secret: toBase64Url(secret), to: [...(options.to ?? [])] };
  const sealedLabel = await sealLabel(ctx.newest.key, keys.id, label);
  const base = `/workspace/phone/${encodeURIComponent(ctx.areaId)}/share/${keys.id}`;

  /* Was über die Leitung geht: der Anfang und jedes Stück mit seiner Hülle. */
  const start = await sealPiecedHead(keys, head);
  const total = start.length + head.size + pieces * 48;
  let sent = 0;
  const report = (inFlight: number) => options.onProgress?.(sent + inFlight, total);

  halt();
  await putPatiently(`${base}/part/0`, start, {}, report, options.signal);
  sent += start.length;

  for (let i = 0; i < pieces; i++) {
    halt();
    let plain: Uint8Array;
    try {
      plain = new Uint8Array(await source.slice(i * SHARE_PIECE, Math.min(head.size, (i + 1) * SHARE_PIECE)).arrayBuffer());
    } catch {
      throw new WorkspaceError(t('phoneShare.err.unreadable'));
    }
    const sealed = await sealPiece(keys, i, pieces, plain);
    await putPatiently(`${base}/part/${i + 1}`, sealed, {}, report, options.signal);
    sent += sealed.length;
    report(0);
  }

  halt();
  const said = await finishPatiently(
    `${base}/finish?epoch=${ctx.newest.epoch}&days=${options.days}&parts=${pieces + 1}`, toBase64Url(sealedLabel), options.signal
  );
  return { id: keys.id, link: shareLink(secret), expiresAt: said?.expiresAt ?? '' };
}

/** Zusammensetzen lassen — auch das darf einmal am Netz scheitern; ein zweites Mal sagt der Dienst „schon da". */
async function finishPatiently(path: string, label: string, signal?: AbortSignal): Promise<{ expiresAt?: string } | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call<{ expiresAt?: string }>(path, { method: 'POST' }, { 'X-Share-Label': label });
    } catch (e) {
      if (!(e instanceof Unreachable) || attempt >= 5) throw e;
      await wait(Math.min(30_000, 2000 * 2 ** attempt), signal);
    }
  }
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
    if (e instanceof WorkspaceError && e.message === t('core.session.failed')) return null;
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
    error ?? (response.status === 410 ? t('phoneShare.err.expired') : response.status === 404 ? t('phoneShare.err.missing') : t('phoneShare.err.service')),
    response.status
  );
}

const unreachable = () => new ShareGone(t('phoneShare.err.unreachable'), 0);

/** Was der Link noch ist: wie gross, bis wann. */
export async function shareInfo(id: string): Promise<{ size: number; createdAt: string; expiresAt: string }> {
  let response: Response;
  try { response = await fetch(`${API}/share/${encodeURIComponent(id)}/info`, { credentials: 'omit' }); } catch { throw unreachable(); }
  if (!response.ok) throw await goneOf(response);
  return await response.json() as { size: number; createdAt: string; expiresAt: string };
}

/** Die Datei geht nicht auf: falscher Link, oder unterwegs beschädigt. */
export class ShareBroken extends Error {}

/**
 * 2026-11-21 — DIE DATEI HOLEN UND ÖFFNEN, in Stücken (HTTP Range, `rangeFetch.ts`):
 * ein Aussetzer holt nur sein Stück noch einmal. Fassung 2 (in Stücken versiegelt)
 * wird Stück für Stück geöffnet; Fassung 1 (eine Hülle) erst ganz geholt, dann
 * geöffnet. Ein Dienst ohne Range gibt alles in einem — das geht auch.
 *
 * @param size wie gross die Hülle ist (`shareInfo`)
 */
export async function loadShare(
  secret: Uint8Array, size: number, onProgress?: (done: number) => void
): Promise<{ head: ShareHead; blob: Blob }> {
  const keys = await shareKeys(secret);
  const url = `${API}/share/${encodeURIComponent(keys.id)}`;
  let done = 0;
  const onBytes = (n: number) => { done += n; onProgress?.(done); };

  /* Was schon da ist: der Anfang — oder alles, wenn der Dienst kein Range kennt. */
  let have: Uint8Array = new Uint8Array(0);
  let whole = false;
  const get = async (from: number, length: number): Promise<Uint8Array> => {
    if (from + length <= have.length) return have.subarray(from, from + length);
    try {
      const step = await fetchRange(url, from, length, { credentials: 'omit', onBytes });
      if (step.whole) { have = step.bytes; whole = true; return have.subarray(from, from + length); }
      return step.bytes;
    } catch (e) {
      if (e instanceof RangeRefused) throw await goneOf(e.response);
      if (e instanceof RangeOffline) throw unreachable();
      throw e;
    }
  };

  const first = await get(0, Math.max(8, Math.min(size, 65536)));
  if (!whole) have = first;

  if (isPieced(have)) {
    const end = piecedHeadEnd(have);
    const start = end <= have.length ? have.subarray(0, end) : await get(0, end);
    let layout: Awaited<ReturnType<typeof openPiecedHead>>;
    try { layout = await openPiecedHead(keys, start); } catch { throw new ShareBroken(); }
    /* Was der erste Blick über den Kopf hinaus holte, kommt mit Stück 0 noch einmal — nicht doppelt zählen. */
    if (!whole && have.length > end) onBytes(-(have.length - end));
    const parts: BlobPart[] = [];
    for (let i = 0; i < layout.pieces; i++) {
      const span = pieceSpan(layout, i);
      const sealed = await get(span.from, span.length);
      if (sealed.length !== span.length) throw new ShareBroken();
      try { parts.push(await openPiece(keys, i, layout.pieces, sealed) as BlobPart); } catch { throw new ShareBroken(); }
    }
    return { head: layout.head, blob: new Blob(parts, { type: layout.head.type }) };
  }

  /* Fassung 1: der Rest in Stücken, dann die eine Hülle öffnen. */
  const chunks: Uint8Array[] = [have];
  let at = have.length;
  while (!whole && at < size) {
    const piece = await get(at, Math.min(4 * 1024 * 1024, size - at));
    if (piece.length === 0) break;
    chunks.push(piece);
    at += piece.length;
  }
  const sealed = whole ? have : chunks.length === 1 ? chunks[0] : (() => {
    const out = new Uint8Array(at);
    let to = 0;
    for (const c of chunks) { out.set(c, to); to += c.length; }
    return out;
  })();
  try {
    const opened = await openShare(secret, sealed);
    return { head: opened.head, blob: new Blob([opened.bytes as BlobPart], { type: opened.head.type }) };
  } catch {
    throw new ShareBroken();
  }
}
