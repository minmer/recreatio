/**
 * DAS ARCHIV DER SMS (0114) — was das Telefon an SMS und MMS hat, versiegelt im
 * eigenen Bereich, in Stapeln. Ein Archiv vergisst nicht: was auf dem Telefon
 * gelöscht wird, bleibt hier.
 *
 * <code>
 *   archivePhone   vom Telefon ab der Marke: jede Nachricht bekommt einen
 *                  Abdruck (HMAC, Schlüssel aus dem Bereich) — was der Dienst
 *                  schon kennt, geht nicht noch einmal hinaus; Bilder aus MMS
 *                  als versiegelte Dateien; dann die Marke weiter
 *   loadArchive    alle Stapel geöffnet (im Browser: das Archiv lesen)
 * </code>
 *
 * Ein Stapel ist JSON, mit gzip gepackt, dann versiegelt. Der Dienst sieht
 * Stapel, ihre Grösse und die Abdrücke — nicht, von wem, an wen, wann, was.
 */

import { aad, derive, Field, fromBase64Url, open, seal, toBase64Url } from '../core/crypto';
import { newId } from '../core/ids';
import { API, call } from '../core/session';
import type { NativeMessage, PhoneSource } from './native';
import { phoneKey } from './numbers';
import type { PhoneCtx } from './phoneContext';

export interface ArchivedPart {
  readonly type: string;
  readonly name: string | null;
  readonly size: number;
  /** Die versiegelte Datei — `null`: nicht mit archiviert (`skipped` sagt, warum). */
  readonly file: string | null;
  /**
   * Unter welcher Epoche die Datei versiegelt ist. Steht HIER und nicht nur im
   * Kopf `X-Epoch` der Antwort: den liest eine Seite von recreatio.pl beim
   * Dienst auf api.recreatio.pl nicht (CORS gibt keine Köpfe frei).
   */
  readonly epoch?: number | null;
  readonly skipped: 'big' | 'off' | 'error' | null;
}

export interface ArchivedMessage {
  /** Der Abdruck (16 Bytes, Base64URL) — dieselbe Nachricht hat immer denselben. */
  readonly key: string;
  readonly kind: 'sms' | 'mms';
  readonly box: 'in' | 'out' | 'failed' | 'pending';
  /** Millisekunden. */
  readonly at: number;
  readonly sentAt: number | null;
  /** Wer schrieb (eingehend). */
  readonly from: string | null;
  /** Die anderen im Gespräch, verglichen nach `phoneKey`. */
  readonly peers: readonly string[];
  readonly body: string;
  readonly subject: string | null;
  readonly parts: readonly ArchivedPart[];
  readonly sim: number | null;
}

export interface ArchiveBatch {
  readonly batchId: string;
  readonly count: number;
  readonly size: number;
  readonly createdAt: string;
}

export interface ArchiveSummary {
  readonly batches: readonly ArchiveBatch[];
  readonly messages: number;
  readonly bytes: number;
  readonly limit: number;
  readonly keys: Set<string>;
}

export interface ArchiveProgress {
  /** Gelesen vom Telefon. */
  readonly seen: number;
  /** Neu im Archiv. */
  readonly added: number;
  /** Schon im Archiv. */
  readonly known: number;
  /** Bilder und Filme, die mitgingen. */
  readonly media: number;
  readonly done: boolean;
}

/** Eine Datei aus einer MMS geht höchstens bis zu dieser Grösse mit. */
export const MAX_MEDIA = 10 * 1024 * 1024;
const BATCH_MESSAGES = 400;
const BATCH_TEXT = 1_500_000;

const batchAad = (id: string) => aad('phone', 'sms', id, Field.SmsArchive, 1);
const fileAad = (id: string) => aad('phone', 'file', id, Field.PhoneFile, 1);
const base = (ctx: PhoneCtx) => `/workspace/phone/${encodeURIComponent(ctx.areaId)}`;

/* -- Packen ------------------------------------------------------------------------------------ */

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* -- Der Abdruck ------------------------------------------------------------------------------- */

/**
 * Der Schlüssel der Abdrücke: aus der ERSTEN Epoche des Bereichs abgeleitet —
 * sie bleibt, auch wenn der Bereich neue bekommt, und so bleibt auch der
 * Abdruck derselben Nachricht derselbe.
 */
async function printerOf(ctx: PhoneCtx): Promise<CryptoKey> {
  const first = Math.min(...ctx.keys.keys());
  const raw = await derive(ctx.keys.get(first)!, `recreatio:v1:sms-archive:${ctx.areaId}`, 32);
  return crypto.subtle.importKey('raw', raw as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

/** Was eine Nachricht ausmacht — Richtung (nicht ihr Stand), Zeit, Gespräch, Text, Teile. */
export function canonical(m: Omit<ArchivedMessage, 'key'>): string {
  const direction = m.box === 'in' ? 'in' : 'out';
  return [m.kind, direction, String(m.at), [...m.peers].sort().join(','), m.body, m.parts.map((p) => `${p.type}:${p.name ?? ''}`).join(';')].join('\u001f');
}

async function printOf(printer: CryptoKey, m: Omit<ArchivedMessage, 'key'>): Promise<string> {
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', printer, new TextEncoder().encode(canonical(m))));
  return toBase64Url(mac.slice(0, 16));
}

/** Eine Nachricht des Telefons in der Form des Archivs. */
export function fromNative(n: NativeMessage): Omit<ArchivedMessage, 'key'> {
  const peers = (n.peers.length > 0 ? n.peers : n.address !== null ? [n.address] : []).map(phoneKey).filter((p) => p !== '');
  return {
    kind: n.kind,
    box: n.box === 'in' ? 'in' : n.box === 'out' ? (n.status === 'failed' ? 'failed' : 'out') : n.box === 'failed' ? 'failed' : 'pending',
    at: n.date,
    sentAt: n.sentAt,
    from: n.box === 'in' && n.address !== null ? phoneKey(n.address) : null,
    peers: [...new Set(peers)],
    body: n.body,
    subject: n.subject,
    parts: n.parts.map((p) => ({ type: p.type, name: p.name, size: p.size, file: null, skipped: null })),
    sim: n.subId
  };
}

/* -- Was der Dienst hat ------------------------------------------------------------------------ */

export async function archiveSummary(ctx: PhoneCtx): Promise<ArchiveSummary> {
  const found = await call<{ batches: readonly ArchiveBatch[]; messages: number; bytes: number; limit: number; keys: string }>(`${base(ctx)}/sms`);
  const raw = found.keys === '' ? new Uint8Array(0) : fromBase64Url(found.keys);
  const keys = new Set<string>();
  for (let at = 0; at + 16 <= raw.length; at += 16) keys.add(toBase64Url(raw.slice(at, at + 16)));
  return { batches: found.batches, messages: found.messages, bytes: found.bytes, limit: found.limit, keys };
}

async function storeBatch(ctx: PhoneCtx, messages: readonly ArchivedMessage[]): Promise<void> {
  const batchId = newId();
  const packed = await gzip(new TextEncoder().encode(JSON.stringify({ v: 1, messages })));
  const sealed = await seal(ctx.newest.key, batchAad(batchId), packed);
  const keys = new Uint8Array(16 * messages.length);
  messages.forEach((m, i) => keys.set(fromBase64Url(m.key), 16 * i));
  await call(`${base(ctx)}/sms/batch`, {
    method: 'POST',
    body: JSON.stringify({ batchId, epoch: ctx.newest.epoch, sealed: toBase64Url(sealed), keys: toBase64Url(keys), count: messages.length })
  });
}

/** Ein Bild (oder Film, Ton) einer MMS, versiegelt hinauf. */
async function storeFile(ctx: PhoneCtx, bytes: Uint8Array): Promise<{ file: string; epoch: number }> {
  const fileId = newId();
  const sealed = await seal(ctx.newest.key, fileAad(fileId), bytes);
  await call(`${base(ctx)}/file/${encodeURIComponent(fileId)}?epoch=${ctx.newest.epoch}`, {
    method: 'PUT', body: new Blob([sealed as BlobPart])
  }, { 'Content-Type': 'application/octet-stream' });
  return { file: fileId, epoch: ctx.newest.epoch };
}

const decodeBase64 = (text: string): Uint8Array => {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
};

/* -- Vom Telefon ins Archiv -------------------------------------------------------------------- */

/**
 * ARCHIVIEREN. `full`: von vorn durchsehen (nach einer Neuinstallation, oder
 * wenn auf einem anderen Telefon etwas dazukam) — doppelt wird trotzdem nichts,
 * die Abdrücke kennt der Dienst.
 *
 * Bricht es ab (Netz, das Tageslimit für Dateien), steht die Marke dort, wo
 * zuletzt alles sicher abgelegt war; der nächste Lauf macht weiter.
 */
export async function archivePhone(
  ctx: PhoneCtx, source: PhoneSource,
  options: { readonly media: boolean; readonly full?: boolean; readonly onProgress?: (p: ArchiveProgress) => void }
): Promise<ArchiveProgress> {
  const summary = await archiveSummary(ctx);
  const printer = await printerOf(ctx);
  let markers = options.full === true ? { sms: 0, mms: 0 } : await source.archiveMarkers();
  let seen = 0;
  let added = 0;
  let known = 0;
  let media = 0;
  let pending: ArchivedMessage[] = [];
  let size = 0;
  const report = (done: boolean): ArchiveProgress => ({ seen, added, known, media, done });

  const flush = async () => {
    if (pending.length === 0) return;
    await storeBatch(ctx, pending);
    added += pending.length;
    pending = [];
    size = 0;
  };

  for (;;) {
    const page = await source.exportMessages({ afterSms: markers.sms, afterMms: markers.mms, limit: 200 });
    for (const n of page.messages) {
      seen++;
      const plain = fromNative(n);
      const key = await printOf(printer, plain);
      if (summary.keys.has(key)) { known++; continue; }

      const parts: ArchivedPart[] = [];
      for (const [i, p] of n.parts.entries()) {
        const kept = plain.parts[i];
        if (!options.media) { parts.push({ ...kept, skipped: 'off' }); continue; }
        if (p.size > MAX_MEDIA) { parts.push({ ...kept, skipped: 'big' }); continue; }
        let bytes: Uint8Array;
        try {
          bytes = decodeBase64((await source.part({ partId: p.partId, maxBytes: MAX_MEDIA })).data);
        } catch {
          /* Das Telefon gibt den Teil nicht her (zu gross, fort) — die Nachricht geht ohne ihn. */
          parts.push({ ...kept, skipped: 'error' });
          continue;
        }
        /*
          Scheitert das Hinaufladen (Netz, das Tageslimit), endet der Lauf hier:
          die Marke steht noch vor dieser Seite, der nächste Lauf macht weiter,
          und was schon abgelegt ist, erkennt er an den Abdrücken.
        */
        parts.push({ ...kept, size: bytes.length, ...(await storeFile(ctx, bytes)) });
        media++;
      }

      const message: ArchivedMessage = { ...plain, key, parts };
      summary.keys.add(key);
      pending.push(message);
      size += message.body.length + 200;
      if (pending.length >= BATCH_MESSAGES || size >= BATCH_TEXT) await flush();
    }
    await flush();
    markers = { sms: page.nextSms, mms: page.nextMms };
    await source.setArchiveMarkers({ ...markers, at: Date.now() });
    options.onProgress?.(report(page.done));
    if (page.done) break;
  }
  return report(true);
}

/* -- Das Archiv lesen -------------------------------------------------------------------------- */

/** Alle Stapel holen und öffnen; dieselbe Nachricht (derselbe Abdruck) nur einmal. */
export async function loadArchive(
  ctx: PhoneCtx, onProgress?: (done: number, total: number) => void
): Promise<{ messages: ArchivedMessage[]; summary: ArchiveSummary }> {
  const summary = await archiveSummary(ctx);
  const ids = summary.batches.map((b) => b.batchId);
  const byKey = new Map<string, ArchivedMessage>();
  for (let at = 0; at < ids.length; at += 20) {
    const chunk = ids.slice(at, at + 20);
    const { batches } = await call<{ batches: readonly { batchId: string; epoch: number; sealed: string }[] }>(
      `${base(ctx)}/sms/batches?ids=${chunk.map(encodeURIComponent).join(',')}`);
    for (const b of batches) {
      const key = ctx.keys.get(b.epoch);
      if (key === undefined) continue;
      try {
        const packed = await open(key, batchAad(b.batchId), fromBase64Url(b.sealed));
        const parsed = JSON.parse(new TextDecoder().decode(await gunzip(packed))) as { messages?: ArchivedMessage[] };
        for (const m of parsed.messages ?? []) if (!byKey.has(m.key)) byKey.set(m.key, m);
      } catch {
        // Ein Stapel, der nicht aufgeht, hält die anderen nicht auf.
      }
    }
    onProgress?.(Math.min(ids.length, at + chunk.length), ids.length);
  }
  const messages = [...byKey.values()].sort((a, b) => a.at - b.at);
  return { messages, summary };
}

/** Die Gespräche des Archivs — je Kreis von Gesprächspartnern eines, das jüngste zuerst. */
export interface ArchiveThread {
  readonly key: string;
  readonly peers: readonly string[];
  readonly messages: readonly ArchivedMessage[];
  readonly last: ArchivedMessage;
}

export function archiveThreads(messages: readonly ArchivedMessage[]): ArchiveThread[] {
  const groups = new Map<string, ArchivedMessage[]>();
  for (const m of messages) {
    const key = [...m.peers].sort().join(',') || '?';
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [m]); else list.push(m);
  }
  return [...groups.entries()]
    .map(([key, list]) => ({ key, peers: list[0].peers, messages: list, last: list[list.length - 1] }))
    .sort((a, b) => b.last.at - a.last.at);
}

const files = new Map<string, Promise<string | null>>();

/** Eine Datei aus dem Archiv — als `blob:`-Adresse; einmal je Karte. `epoch`: aus dem Archiv, sonst aus dem Kopf. */
export function archivedFileUrl(ctx: PhoneCtx, fileId: string, type: string, epoch: number | null = null): Promise<string | null> {
  let found = files.get(fileId);
  if (found === undefined) {
    found = (async () => {
      const response = await fetch(`${API}${base(ctx)}/file/${encodeURIComponent(fileId)}`, { credentials: 'include' });
      if (!response.ok) return null;
      const key = ctx.keys.get(epoch ?? Number(response.headers.get('X-Epoch') ?? '0'));
      if (key === undefined) return null;
      const plain = await open(key, fileAad(fileId), new Uint8Array(await response.arrayBuffer()));
      return URL.createObjectURL(new Blob([plain as BlobPart], { type }));
    })().catch(() => null);
    files.set(fileId, found);
  }
  return found;
}
