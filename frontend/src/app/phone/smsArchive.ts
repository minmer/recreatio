/**
 * DAS ARCHIV DER SMS (0114, 0115) — was die Telefone an SMS und MMS haben,
 * versiegelt im Bereich der Rolle, der das Archiv gehört (`archiveSettings.ts`),
 * in Stapeln je Gespräch. Ein Archiv vergisst nicht: was auf dem Telefon
 * gelöscht wird, bleibt hier.
 *
 * <code>
 *   archivePhone       die gewählten Gespräche DIESES Telefons, jedes ganz: ab der
 *                      Marke des Gesprächs (neu gewählt: von vorn). Jede Nachricht
 *                      bekommt einen Abdruck (HMAC, Schlüssel aus dem Bereich) —
 *                      was das Archiv kennt, auch von einem anderen Telefon, geht
 *                      nicht noch einmal hinaus. Bilder aus MMS als versiegelte
 *                      Dateien. Viele kleine Stapel eines Gesprächs: zusammengelegt.
 *   archiveIndex       die Gespräche aus den Übersichten der Stapel — ohne eine
 *                      Nachricht zu laden
 *   loadConversation   ein Gespräch: nur seine Stapel
 *   loadAll            alles (die Suche im Text)
 * </code>
 *
 * Ein Stapel ist JSON, mit gzip gepackt, dann versiegelt; daneben eine kleine
 * versiegelte Übersicht. Der Dienst sieht Stapel, ihre Grösse und die Abdrücke —
 * nicht, von wem, an wen, wann, was.
 */

import { aad, derive, Field, fromBase64Url, open, openText, seal, sealText, toBase64Url } from '../core/crypto';
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
   * Dienst auf api.recreatio.pl nicht ohne Freigabe der Köpfe.
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
  /**
   * 2026-10-18 — die EIGENE Nummer, über die die Nachricht lief (nach `phoneKey`):
   * eine Antwort aus dem Browser sendet nur ein Telefon, das diese Nummer hat.
   * `null`: unbekannt (die Karte nennt sie nicht, und niemand hat sie eingetragen).
   */
  readonly line?: string | null;
}

/** Ein Stapel, wie der Dienst ihn kennt — die Übersicht noch versiegelt. */
export interface ArchiveBatch {
  readonly batchId: string;
  readonly count: number;
  readonly size: number;
  readonly createdAt: string;
  readonly epoch: number;
  readonly summary: string | null;
}

export interface ArchiveSummary {
  readonly batches: readonly ArchiveBatch[];
  readonly messages: number;
  readonly bytes: number;
  readonly limit: number;
  readonly keys: Set<string>;
}

/** Die geöffnete Übersicht eines Stapels: welches Gespräch, wie viele, von wann bis wann, das Letzte. */
export interface BatchOutline {
  readonly conversation: string;
  readonly count: number;
  readonly first: number;
  readonly last: number;
  readonly lastBody: string;
  readonly lastBox: ArchivedMessage['box'];
  readonly lastMedia: boolean;
  /** Die eigene Nummer, über die zuletzt geschrieben wurde. */
  readonly lastLine?: string | null;
}

/** Ein Gespräch im Archiv — aus den Übersichten seiner Stapel, über alle Telefone. */
export interface ArchivedConversation {
  /** Die Nummern, nach `phoneKey`, sortiert, mit Komma — dieselbe auf jedem Telefon. */
  readonly key: string;
  readonly peers: readonly string[];
  readonly batches: readonly string[];
  /** Nachrichten in seinen Stapeln — dieselbe Nachricht von zwei Telefonen zählt hier einmal pro Stapel. */
  readonly count: number;
  readonly first: number;
  readonly last: number;
  readonly lastBody: string;
  readonly lastBox: ArchivedMessage['box'];
  readonly lastMedia: boolean;
  /** Von welcher eigenen Nummer eine Antwort hinausgeht — die zuletzt benutzte; `null`: unbekannt. */
  readonly lastLine: string | null;
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
  /** Gespräche: durchgesehen, von wie vielen gewählten. */
  readonly conversations: number;
  readonly of: number;
  readonly done: boolean;
}

/** Was in ein Archiv kommt: alle Gespräche (auch neue) oder die gewählten. */
export interface ArchiveChoice {
  readonly mode: 'all' | 'chosen';
  /** Schlüssel der Gespräche (`conversationKey`). */
  readonly chosen: readonly string[];
}

/** Eine Datei aus einer MMS geht höchstens bis zu dieser Grösse mit. */
export const MAX_MEDIA = 10 * 1024 * 1024;
const BATCH_MESSAGES = 400;
const BATCH_TEXT = 1_500_000;
/** Mehr Stapel hat ein Gespräch nicht, ohne dass ein Telefon sie zusammenlegt. */
const COMPACT_OVER = 6;

const batchAad = (id: string) => aad('phone', 'sms', id, Field.SmsArchive, 1);
const outlineAad = (id: string) => aad('phone', 'sms-summary', id, Field.SmsArchive, 1);
const fileAad = (id: string) => aad('phone', 'file', id, Field.PhoneFile, 1);
const base = (ctx: PhoneCtx) => `/workspace/phone/${encodeURIComponent(ctx.areaId)}`;

/** Das Gespräch, zu dem Nummern gehören — auf jedem Telefon dasselbe, wie sie dort auch geschrieben sind. */
export const conversationKey = (peers: readonly string[]): string =>
  [...new Set(peers.map(phoneKey).filter((p) => p !== ''))].sort().join(',');

export const choiceIncludes = (choice: ArchiveChoice, key: string): boolean =>
  choice.mode === 'all' || choice.chosen.includes(key);

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
 * Abdruck derselben Nachricht derselbe, auf jedem Telefon.
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

/** Eine Nachricht des Telefons in der Form des Archivs. `lineOf`: die eigene Nummer zu einer Karte. */
export function fromNative(n: NativeMessage, lineOf: (subId: number | null) => string | null = () => null): Omit<ArchivedMessage, 'key'> {
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
    sim: n.subId,
    line: lineOf(n.subId)
  };
}

/**
 * Die eigene Nummer zu einer Karte — aus den Karten des Telefons. Hat eine Nachricht keine
 * Karte (alt, oder vom Telefon nicht vermerkt) und gibt es nur eine Nummer, ist es diese.
 */
export function lineFinder(lines: readonly { readonly subId: number; readonly number: string | null }[]): (subId: number | null) => string | null {
  const known = lines.filter((l) => l.number !== null && phoneKey(l.number) !== '');
  return (subId) => {
    const hit = known.find((l) => l.subId === subId);
    if (hit !== undefined) return phoneKey(hit.number);
    return known.length === 1 ? phoneKey(known[0].number) : null;
  };
}

/** Die Übersicht eines Stapels aus seinen Nachrichten. */
export function outlineOf(conversation: string, messages: readonly ArchivedMessage[]): BatchOutline {
  const sorted = [...messages].sort((a, b) => a.at - b.at);
  const last = sorted[sorted.length - 1];
  return {
    conversation,
    count: messages.length,
    first: sorted[0]?.at ?? 0,
    last: last?.at ?? 0,
    lastBody: (last?.body ?? '').slice(0, 160),
    lastBox: last?.box ?? 'in',
    lastMedia: (last?.parts.length ?? 0) > 0,
    lastLine: [...sorted].reverse().find((m) => m.line != null)?.line ?? null
  };
}

/** Die Übersichten zu Gesprächen zusammen — neueste zuerst. */
export function conversationsOf(outlines: readonly { readonly batchId: string; readonly outline: BatchOutline }[]): ArchivedConversation[] {
  const by = new Map<string, ArchivedConversation>();
  for (const { batchId, outline: o } of outlines) {
    const had = by.get(o.conversation);
    if (had === undefined) {
      by.set(o.conversation, {
        key: o.conversation, peers: o.conversation === '' ? [] : o.conversation.split(','), batches: [batchId],
        count: o.count, first: o.first, last: o.last, lastBody: o.lastBody, lastBox: o.lastBox, lastMedia: o.lastMedia,
        lastLine: o.lastLine ?? null
      });
      continue;
    }
    const newer = o.last >= had.last;
    const line = o.lastLine ?? null;
    by.set(o.conversation, {
      ...had,
      batches: [...had.batches, batchId],
      count: had.count + o.count,
      first: Math.min(had.first, o.first),
      last: Math.max(had.last, o.last),
      lastBody: newer ? o.lastBody : had.lastBody,
      lastBox: newer ? o.lastBox : had.lastBox,
      lastMedia: newer ? o.lastMedia : had.lastMedia,
      lastLine: (newer && line !== null) || had.lastLine === null ? line ?? had.lastLine : had.lastLine
    });
  }
  return [...by.values()].sort((a, b) => b.last - a.last);
}

/* -- Was der Dienst hat ------------------------------------------------------------------------ */

/** `withKeys`: auch die Abdrücke (das Telefon, um nichts doppelt zu schicken) — wer nur liest, braucht sie nicht. */
export async function archiveSummary(ctx: PhoneCtx, withKeys = true): Promise<ArchiveSummary> {
  const found = await call<{ batches: readonly ArchiveBatch[]; messages: number; bytes: number; limit: number; keys: string }>(
    `${base(ctx)}/sms${withKeys ? '' : '?keys=false'}`);
  const raw = found.keys === '' ? new Uint8Array(0) : fromBase64Url(found.keys);
  const keys = new Set<string>();
  for (let at = 0; at + 16 <= raw.length; at += 16) keys.add(toBase64Url(raw.slice(at, at + 16)));
  return { batches: found.batches, messages: found.messages, bytes: found.bytes, limit: found.limit, keys };
}

/*
 * Geöffnetes bleibt im Speicher: ein Stapel ändert sich nie (zusammengelegt heisst: neue
 * Kennung, die alten fort). So kostet das Nachsehen alle halbe Minute fast nichts.
 */
const outlineSeen = new Map<string, BatchOutline>();
const batchSeen = new Map<string, readonly ArchivedMessage[]>();
let batchSeenCount = 0;
const BATCH_SEEN_MAX = 20_000;

function rememberBatch(batchId: string, messages: readonly ArchivedMessage[]): void {
  if (batchSeen.has(batchId)) return;
  batchSeen.set(batchId, messages);
  batchSeenCount += messages.length;
  for (const [old, list] of batchSeen) {
    if (batchSeenCount <= BATCH_SEEN_MAX) break;
    batchSeen.delete(old);
    batchSeenCount -= list.length;
  }
}

/** Die Übersichten geöffnet — was keine hat oder nicht aufgeht, steht ohne Gespräch da (`''`). */
async function outlinesOf(ctx: PhoneCtx, batches: readonly ArchiveBatch[]): Promise<{ batchId: string; outline: BatchOutline }[]> {
  const out: { batchId: string; outline: BatchOutline }[] = [];
  for (const b of batches) {
    const seen = outlineSeen.get(b.batchId);
    if (seen !== undefined) { out.push({ batchId: b.batchId, outline: seen }); continue; }
    const key = ctx.keys.get(b.epoch);
    let outline: BatchOutline | null = null;
    if (b.summary !== null && key !== undefined) {
      try {
        outline = JSON.parse(await openText(key, outlineAad(b.batchId), fromBase64Url(b.summary))) as BatchOutline;
        outlineSeen.set(b.batchId, outline);
      } catch {
        outline = null;
      }
    }
    out.push({ batchId: b.batchId, outline: outline ?? { conversation: '', count: b.count, first: 0, last: 0, lastBody: '', lastBox: 'in', lastMedia: false, lastLine: null } });
  }
  return out;
}

/** DIE GESPRÄCHE DES ARCHIVS — aus den Übersichten, ohne eine Nachricht zu laden. */
export async function archiveIndex(ctx: PhoneCtx): Promise<{ summary: ArchiveSummary; conversations: ArchivedConversation[] }> {
  const summary = await archiveSummary(ctx, false);
  return { summary, conversations: conversationsOf(await outlinesOf(ctx, summary.batches)) };
}

async function storeBatch(ctx: PhoneCtx, conversation: string, messages: readonly ArchivedMessage[]): Promise<string> {
  const batchId = newId();
  const packed = await gzip(new TextEncoder().encode(JSON.stringify({ v: 2, conversation, messages })));
  const sealed = await seal(ctx.newest.key, batchAad(batchId), packed);
  const outline = await sealText(ctx.newest.key, outlineAad(batchId), JSON.stringify(outlineOf(conversation, messages)));
  const keys = new Uint8Array(16 * messages.length);
  messages.forEach((m, i) => keys.set(fromBase64Url(m.key), 16 * i));
  await call(`${base(ctx)}/sms/batch`, {
    method: 'POST',
    body: JSON.stringify({
      batchId, epoch: ctx.newest.epoch, sealed: toBase64Url(sealed), keys: toBase64Url(keys), count: messages.length,
      summary: toBase64Url(outline)
    })
  });
  return batchId;
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

/* -- Stapel lesen ------------------------------------------------------------------------------- */

/** Stapel nach ihren Kennungen, geöffnet; dieselbe Nachricht (derselbe Abdruck) nur einmal, älteste zuerst. */
async function readBatches(ctx: PhoneCtx, ids: readonly string[], onProgress?: (done: number, total: number) => void): Promise<ArchivedMessage[]> {
  const byKey = new Map<string, ArchivedMessage>();
  const take = (list: readonly ArchivedMessage[]) => { for (const m of list) if (!byKey.has(m.key)) byKey.set(m.key, m); };
  const missing = ids.filter((id) => {
    const had = batchSeen.get(id);
    if (had === undefined) return true;
    take(had);
    return false;
  });
  const ready = ids.length - missing.length;
  if (missing.length === 0) onProgress?.(ids.length, ids.length);
  for (let at = 0; at < missing.length; at += 20) {
    const chunk = missing.slice(at, at + 20);
    const { batches } = await call<{ batches: readonly { batchId: string; epoch: number; sealed: string }[] }>(
      `${base(ctx)}/sms/batches?ids=${chunk.map(encodeURIComponent).join(',')}`);
    for (const b of batches) {
      const key = ctx.keys.get(b.epoch);
      if (key === undefined) continue;
      try {
        const packed = await open(key, batchAad(b.batchId), fromBase64Url(b.sealed));
        const parsed = JSON.parse(new TextDecoder().decode(await gunzip(packed))) as { messages?: ArchivedMessage[] };
        rememberBatch(b.batchId, parsed.messages ?? []);
        take(parsed.messages ?? []);
      } catch {
        // Ein Stapel, der nicht aufgeht, hält die anderen nicht auf.
      }
    }
    onProgress?.(ready + Math.min(missing.length, at + chunk.length), ids.length);
  }
  return [...byKey.values()].sort((a, b) => a.at - b.at);
}

/** EIN GESPRÄCH — nur seine Stapel. */
export const loadConversation = (ctx: PhoneCtx, conversation: ArchivedConversation): Promise<ArchivedMessage[]> =>
  readBatches(ctx, conversation.batches);

/** ALLES — für die Suche im Text. */
export async function loadAll(ctx: PhoneCtx, onProgress?: (done: number, total: number) => void): Promise<ArchivedMessage[]> {
  const summary = await archiveSummary(ctx, false);
  return readBatches(ctx, summary.batches.map((b) => b.batchId), onProgress);
}

/* -- Vom Telefon ins Archiv -------------------------------------------------------------------- */

/**
 * Bis wohin jedes Gespräch DIESES Telefons im Archiv ist (im Telefon gemerkt). Gehört
 * zu einem Bereich: wechselt das Archiv die Rolle (einen anderen Bereich), beginnt es
 * von vorn.
 */
interface PhoneState {
  readonly v: 2;
  readonly area: string;
  readonly threads: Readonly<Record<string, { readonly sms: number; readonly mms: number; readonly date: number }>>;
}

function readState(text: string, area: string): PhoneState {
  try {
    const o = JSON.parse(text) as Partial<PhoneState>;
    if (o.v === 2 && o.area === area && o.threads !== null && typeof o.threads === 'object') return { v: 2, area, threads: o.threads };
  } catch {
    // dann von vorn
  }
  return { v: 2, area, threads: {} };
}

/**
 * ARCHIVIEREN. Jedes gewählte Gespräch ganz: was seit seiner Marke dazukam —
 * ein neu gewähltes von vorn. `full`: alle Marken vergessen und alles noch einmal
 * durchsehen (geschickt wird trotzdem nur, was das Archiv nicht kennt).
 *
 * Bricht es ab (Netz, das Tageslimit für Dateien), steht die Marke des Gesprächs
 * dort, wo zuletzt alles sicher abgelegt war; der nächste Lauf macht weiter.
 */
export async function archivePhone(
  ctx: PhoneCtx, source: PhoneSource,
  options: { readonly media: boolean; readonly choice: ArchiveChoice; readonly full?: boolean; readonly onProgress?: (p: ArchiveProgress) => void }
): Promise<ArchiveProgress> {
  const summary = await archiveSummary(ctx);
  const printer = await printerOf(ctx);
  let state = options.full === true ? readState('', ctx.areaId) : readState((await source.archiveState()).state, ctx.areaId);
  const { threads } = await source.threads({ limit: 5000 });
  const chosen = threads.filter((t) => choiceIncludes(options.choice, conversationKey(t.addresses)));
  const lineOf = lineFinder((await source.lines()).lines);

  let seen = 0;
  let added = 0;
  let known = 0;
  let media = 0;
  let conversations = 0;
  const touched = new Set<string>();
  const report = (done: boolean): ArchiveProgress => ({ seen, added, known, media, conversations, of: chosen.length, done });

  for (const thread of chosen) {
    conversations++;
    const key = conversationKey(thread.addresses);
    const mark = state.threads[thread.threadId];
    if (mark !== undefined && mark.date > 0 && mark.date >= thread.date) { options.onProgress?.(report(false)); continue; }

    let at = { sms: mark?.sms ?? 0, mms: mark?.mms ?? 0 };
    let blocked = false;
    let pending: ArchivedMessage[] = [];
    let size = 0;
    const flush = async () => {
      if (pending.length === 0) return;
      await storeBatch(ctx, key, pending);
      touched.add(key);
      added += pending.length;
      pending = [];
      size = 0;
    };

    for (;;) {
      const page = await source.exportMessages({ threadId: thread.threadId, afterSms: at.sms, afterMms: at.mms, limit: 200 });
      for (const n of page.messages) {
        seen++;
        const plain = fromNative(n, lineOf);
        const print = await printOf(printer, plain);
        if (summary.keys.has(print)) { known++; continue; }

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

        summary.keys.add(print);
        pending.push({ ...plain, key: print, parts });
        size += plain.body.length + 200;
        if (pending.length >= BATCH_MESSAGES || size >= BATCH_TEXT) await flush();
      }
      await flush();
      at = { sms: page.nextSms, mms: page.nextMms };
      blocked = blocked || page.blocked === true;
      /* Nach jeder Seite gemerkt: ein Abbruch verliert höchstens, was noch nicht abgelegt war. */
      state = { ...state, threads: { ...state.threads, [thread.threadId]: { ...at, date: 0 } } };
      await source.setArchiveState({ state: JSON.stringify(state) });
      if (page.done) break;
    }

    /* Ganz durch — und nichts, das noch hinausgeht: das Gespräch ist bis zu seinem Datum im Archiv. */
    state = { ...state, threads: { ...state.threads, [thread.threadId]: { ...at, date: blocked ? 0 : thread.date } } };
    await source.setArchiveState({ state: JSON.stringify(state), at: Date.now() });
    options.onProgress?.(report(false));
  }

  if (touched.size > 0) await compactSome(ctx, touched).catch(() => undefined);
  await source.setArchiveState({ state: JSON.stringify(state), at: Date.now() });
  return report(true);
}

/**
 * ZUSAMMENLEGEN: jeder Lauf bringt einem Gespräch einen kleinen Stapel; sind es mehr als
 * sechs, werden sie einer (oder wenige grosse) — neu abgelegt, dann die alten entfernt.
 * Geht dabei etwas schief, liegt eine Nachricht höchstens zweimal da; gelesen wird sie
 * einmal (derselbe Abdruck).
 */
async function compactSome(ctx: PhoneCtx, conversations: ReadonlySet<string>): Promise<void> {
  const summary = await archiveSummary(ctx, false);
  const outlines = await outlinesOf(ctx, summary.batches);
  for (const conv of conversationsOf(outlines)) {
    if (!conversations.has(conv.key) || conv.batches.length <= COMPACT_OVER) continue;
    const messages = await readBatches(ctx, conv.batches);
    for (let at = 0; at < messages.length; at += BATCH_MESSAGES) await storeBatch(ctx, conv.key, messages.slice(at, at + BATCH_MESSAGES));
    for (const id of conv.batches) await call(`${base(ctx)}/sms/batch/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}

/* -- Die Gespräche, gezählt ------------------------------------------------------------------- */

/** Die Gespräche des Archivs — je Kreis von Gesprächspartnern eines, das jüngste zuerst (aus Nachrichten). */
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

/* -- Welche Archive ich lese ------------------------------------------------------------------- */

export interface ReadableArchive {
  readonly areaId: string;
  readonly batches: number;
  readonly messages: number;
  readonly bytes: number;
  readonly lastAt: string;
}

/** Unter den Bereichen, die ich kenne: die mit einem Archiv, das ich lesen darf (0115). */
export async function readableArchives(areaIds: readonly string[]): Promise<ReadableArchive[]> {
  const out: ReadableArchive[] = [];
  for (let at = 0; at < areaIds.length; at += 400) {
    const { archives } = await call<{ archives: readonly ReadableArchive[] }>('/workspace/phone/archives', {
      method: 'POST', body: JSON.stringify({ areas: areaIds.slice(at, at + 400) })
    });
    out.push(...archives);
  }
  return out;
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
