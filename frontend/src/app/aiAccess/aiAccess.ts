/**
 * DOSTĘP DLA AI (0126) — ein ausdrücklicher Link, über den ein Assistent
 * (ChatGPT, Claude …) die Bibliothek, das Skryptorium und die Bazy wiedzy
 * EINES Bereichs liest. Nur lesen, nichts sonst (keine Rozmowy, Formulare,
 * Kalender). Der Dienst: `backend/Api/Library/AiAccess*.cs`.
 *
 * <b>Die Schlüssel.</b>
 * <code>
 *   Geheimnis T   würfelt der Dienst (Kernel.Token) — steht im Link, gespeichert nur als Hash
 *   C             32 Zufallsbytes aus diesem Browser: der Schlüssel der Abschriften
 *   C unter HKDF(T, "recreatio:v1:ai-access:<kennung>")   → der Dienst öffnet sie nur mit dem Link
 *   C unter dem Schlüssel des Bereichs                   → wer dort schreibt, frischt auf
 *   T unter dem Schlüssel des Bereichs                   → wer prowadzi, kopiert den Link wieder
 *   je Behälter eine Abschrift (aiSnapshot.ts), gzip, unter C
 * </code>
 * Kein Schlüssel des Bereichs verlässt den Browser; der Dienst sieht Inhalte
 * nur, solange eine Anfrage den Link trägt — das ist der Zweck des Links.
 *
 * <b>Frisch bleibt es von selbst.</b> Nach jedem Schreiben in einem Behälter
 * (`libraryStore.ts` → `libraryWritten`) sieht dieser Browser, wenn Ruhe ist,
 * nach, ob ein Link ihn abschreibt und die Abschrift älter ist als der
 * Behälter — dann baut er sie neu. Ebenso beim Öffnen der Karte „Dostęp".
 */

import { areaKeys, newestKey } from '../chat/chat';
import { aad, derive, Field, fromBase64Url, KEY_SIZE, open, openText, seal, sealText, toBase64Url } from '../core/crypto';
import { newId } from '../core/ids';
import type { Ring } from '../core/keys';
import { plural } from '../core/plural';
import { API, call, WorkspaceError } from '../core/session';
import { libraryKindOf, loadLibraries, openLibraries, type LibraryKind } from '../library/library';
import { storeOf, type LibraryStore } from '../library/libraryStore';
import type { ScopePart } from './aiSnapshot';
import { readManifest, TEXT_KIND } from '../library/sourceText';

export interface AiPart {
  readonly libraryId: string;
  readonly kind: LibraryKind;
  /** Der Stand des Behälters jetzt (der Dienst rechnet ihn, ohne Schlüssel). */
  readonly mark: string;
  /** Der Stand, aus dem die Abschrift gebaut wurde — `null`: es gibt noch keine. */
  readonly madeFrom: string | null;
  readonly madeAt: string | null;
  readonly entries: number | null;
  readonly bytes: number | null;
  readonly fresh: boolean;
}

export interface AiAccessRow {
  readonly id: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly lastUsedAt: string | null;
  readonly uses: number;
  /** Beide Schritte des Anlegens getan. */
  readonly ready: boolean;
  readonly expired: boolean;
  readonly mine: boolean;
  /** Ob der, der ihn anlegte, den Bereich noch prowadzi — sonst antwortet der Link nicht. */
  readonly creatorLeads: boolean;
  readonly works: boolean;
  /** 2026-10-24 (0128) — zeigt alle Behälter des Bereichs, auch die später angelegten. */
  readonly wholeArea?: boolean;
  readonly epoch: number | null;
  /** C unter dem Schlüssel des Bereichs — nur für die, die dort schreiben. */
  readonly keySealed: string | null;
  /** Das Geheimnis unter dem Schlüssel des Bereichs — nur für die, die ihn prowadzą. */
  readonly tokenSealed: string | null;
  readonly parts: readonly AiPart[];
}

export interface AiAccessList {
  readonly accesses: readonly AiAccessRow[];
  readonly writes: boolean;
  readonly leads: boolean;
  readonly limit: number;
  readonly days: readonly number[];
}

const enc = encodeURIComponent;
const base = (areaId: string) => `/workspace/area/${enc(areaId)}/ai-access`;

/* -- Etiketten und Schlüssel (dieselben wie im Dienst) ------------------------------------- */

const keyAad = (id: string) => aad('ai', 'access', id, Field.AiAccessKey, 1);
const wrapAad = (id: string) => aad('ai', 'access', id, Field.AiAccessWrap, 1);
const linkAad = (id: string) => aad('ai', 'access', id, Field.AiAccessLink, 1);
export const snapshotAad = (libraryId: string) => aad('ai', 'snapshot', libraryId, Field.AiSnapshot, 1);

/** Der Schlüssel aus dem Link — wie `AiAccess.LinkKey`: HKDF über die UTF-8-Bytes des Geheimnisses. */
export const linkKey = (token: string, accessId: string): Promise<Uint8Array> =>
  derive(new TextEncoder().encode(token), `recreatio:v1:ai-access:${accessId}`, KEY_SIZE);

/** Die Adresse für den Assistenten — der Dienst, nicht diese Seite (`https://api.<domena>/ai/<link>`). */
export function aiLink(token: string): string {
  const origin = /^https?:\/\//.test(API) ? API : `${window.location.origin}${API}`;
  return `${origin}/ai/${token}`;
}

/* -- Der Weg zum Dienst ---------------------------------------------------------------------- */

export const loadAiAccess = (areaId: string): Promise<AiAccessList> => call(base(areaId));

export const extendAiAccess = (areaId: string, id: string, days: number): Promise<{ expiresAt: string }> =>
  call(`${base(areaId)}/${enc(id)}`, { method: 'POST', body: JSON.stringify({ days }) });

/** Die Behälter eines Links — oder (`wholeArea`) alle des Bereichs, auch künftige. */
export const setAiParts = (areaId: string, id: string, libraries: readonly string[], wholeArea = false): Promise<unknown> =>
  call(`${base(areaId)}/${enc(id)}`, { method: 'POST', body: JSON.stringify({ libraries, wholeArea }) });

export const deleteAiAccess = (areaId: string, id: string): Promise<{ deleted: boolean }> =>
  call(`${base(areaId)}/${enc(id)}`, { method: 'DELETE' });

const uploadSnapshot = (areaId: string, accessId: string, libraryId: string, mark: string, entries: number, sealed: Uint8Array): Promise<{ madeAt: string }> =>
  call(`${base(areaId)}/${enc(accessId)}/part/${enc(libraryId)}?mark=${enc(mark)}&entries=${entries}`, { method: 'PUT', body: sealed as BodyInit });

/* -- Anlegen ----------------------------------------------------------------------------------- */

export interface CreatedAccess {
  readonly id: string;
  readonly link: string;
  readonly expiresAt: string;
  /** Wie die ersten Abschriften gerieten. */
  readonly refresh: Refreshed;
}

/** Was ein Auffrischen getan hat — und, wenn etwas misslang, warum (das erste). */
export interface Refreshed {
  readonly refreshed: number;
  readonly failed: number;
  readonly reason?: string;
}

/** In Worten, wenn etwas misslang — sonst `null`. */
export const failedWords = (r: Refreshed): string | null => r.failed === 0 ? null
  : `Nie udało się przygotować ${r.failed} ${plural(r.failed, 'odpisu', 'odpisów', 'odpisów')}${r.reason === undefined ? '' : ` (${r.reason})`}. Spróbuj „Odśwież teraz”.`;

/**
 * EINEN LINK ANLEGEN — zwei Schritte: der Dienst würfelt das Geheimnis, dieser
 * Browser würfelt C und verpackt es dreifach; dann werden die Abschriften
 * gebaut. Scheitert der zweite Schritt, ist der halbe Link wieder fort.
 */
export async function createAiAccess(
  ring: Ring, areaId: string, libraries: readonly string[], days: number, progress?: (done: number, total: number) => void, wholeArea = true
): Promise<CreatedAccess> {
  const newest = newestKey(await areaKeys(ring, areaId, true));
  if (newest === null) throw new WorkspaceError('Nie masz klucza tego obszaru.');

  const id = newId();
  const made = await call<{ id: string; token: string; expiresAt: string }>(base(areaId), {
    method: 'POST', body: JSON.stringify({ id, libraries, days, wholeArea })
  });
  try {
    const key = crypto.getRandomValues(new Uint8Array(KEY_SIZE));
    await call(`${base(areaId)}/${enc(id)}/key`, {
      method: 'PUT',
      body: JSON.stringify({
        token: made.token,
        epoch: newest.epoch,
        keySealed: toBase64Url(await seal(newest.key, keyAad(id), key)),
        tokenSealed: toBase64Url(await sealText(newest.key, linkAad(id), made.token)),
        keyWrapped: toBase64Url(await seal(await linkKey(made.token, id), wrapAad(id), key))
      })
    });
  } catch (e) {
    await deleteAiAccess(areaId, id).catch(() => undefined);
    throw e;
  }
  forgetAiWatch(areaId);
  const refresh = await refreshAiAccess(ring, areaId, { accessId: id, all: true, progress });
  return { id, link: aiLink(made.token), expiresAt: made.expiresAt, refresh };
}

/* -- Öffnen, was der Bereich hält ------------------------------------------------------------- */

async function epochKey(ring: Ring, areaId: string, epoch: number): Promise<Uint8Array | undefined> {
  return (await areaKeys(ring, areaId)).get(epoch) ?? (await areaKeys(ring, areaId, true)).get(epoch);
}

/** C eines Links — wer im Bereich schreibt, öffnet es mit dem Schlüssel des Bereichs; sonst `null`. */
export async function accessKey(ring: Ring, areaId: string, row: AiAccessRow): Promise<Uint8Array | null> {
  if (row.keySealed === null || row.epoch === null) return null;
  const key = await epochKey(ring, areaId, row.epoch);
  if (key === undefined) return null;
  try {
    return await open(key, keyAad(row.id), fromBase64Url(row.keySealed));
  } catch {
    return null;
  }
}

/** Den Link noch einmal zeigen — wer prowadzi, öffnet das versiegelte Geheimnis; sonst `null`. */
export async function aiLinkOf(ring: Ring, areaId: string, row: AiAccessRow): Promise<string | null> {
  const secret = await aiSecretOf(ring, areaId, row);
  return secret === null ? null : aiLink(secret);
}

/** Das Geheimnis eines Links selbst (für die Freigabe an einen Assistenten über OAuth, `AiConnect.tsx`). */
export async function aiSecretOf(ring: Ring, areaId: string, row: AiAccessRow): Promise<string | null> {
  if (row.tokenSealed === null || row.epoch === null) return null;
  const key = await epochKey(ring, areaId, row.epoch);
  if (key === undefined) return null;
  try {
    return await openText(key, linkAad(row.id), fromBase64Url(row.tokenSealed));
  } catch {
    return null;
  }
}

/* -- 0127: einen Assistenten über OAuth verbinden (MCP) --------------------------------------------- */

export interface ConnectRequest {
  readonly id: string;
  readonly client: string;
  readonly clientId: string | null;
  readonly redirectHost: string;
  readonly scope: string | null;
  readonly expiresAt: string;
}

export const loadConnectRequest = (id: string): Promise<ConnectRequest> => call(`/oauth/request/${enc(id)}`);

export const approveConnect = (grant: string, secrets: readonly string[]): Promise<{ redirect: string }> =>
  call('/oauth/approve', { method: 'POST', body: JSON.stringify({ grant, secrets }) });

export const denyConnect = (grant: string): Promise<{ redirect: string }> =>
  call('/oauth/deny', { method: 'POST', body: JSON.stringify({ grant }) });

/** Die Adresse des MCP-Servers (für die Anleitung in der Karte). */
export function mcpUrl(): string {
  const origin = /^https?:\/\//.test(API) ? API : `${window.location.origin}${API}`;
  return `${origin}/mcp`;
}

/**
 * Frisch abgleichen. Ein Abgleich, der schon lief, könnte VOR dem Stand
 * begonnen haben, den der Dienst gerade nannte — der zweite beginnt sicher
 * danach (und holt sonst nur, was seither kam).
 */
async function syncedAfter(store: LibraryStore): Promise<void> {
  await store.sync();
  await store.sync();
}

/** Die Behälter eines Links, offen und abgeglichen — nur die dieses Bereichs. */
async function openScope(ring: Ring, areaId: string, libraryIds: readonly string[]): Promise<ScopePart[]> {
  const rows = (await loadLibraries()).libraries.filter((r) => r.areaId === areaId && libraryIds.includes(r.libraryId));
  const opened = await openLibraries(ring, rows);
  const parts = opened.map((row) => ({ store: storeOf(ring, row), kind: libraryKindOf(row), name: row.name }));
  for (const part of parts) await syncedAfter(part.store);
  return parts;
}

/** Wie gross eine gepackte Abschrift höchstens sein darf (der Dienst nimmt 32 MB, mit Rand für ihre Hülle). */
const MAX_PACKED = 30 * 1024 * 1024;

/**
 * 2026-10-24 — DIE TEXTE EINES BEHÄLTERS ÖFFNEN: ihre Teile sind schwere Einträge (nur ihre Zeilen
 * kommen beim Abgleich) — für die Abschrift werden sie geholt. Nur eine Bibliothek hat Texte.
 */
async function withTexts(parts: readonly ScopePart[], libraryId: string): Promise<ScopePart[]> {
  const part = parts.find((p) => p.store.libraryId === libraryId);
  if (part === undefined || part.kind !== 'books' || part.texts !== undefined) return [...parts];
  const manifests = part.store.all().filter((e) => e.kind === TEXT_KIND);
  if (manifests.length === 0) return [...parts];
  const ids = manifests.flatMap((m) => readManifest(m.data).parts.map((x) => x.id));
  const opened = await part.store.heavyMany(ids);
  const byId = new Map(opened.filter((e): e is NonNullable<typeof e> => e !== null).map((e) => [e.id, e]));
  const texts = manifests.map((entry) => ({ entry, parts: readManifest(entry.data).parts.flatMap((x) => { const e = byId.get(x.id); return e === undefined ? [] : [{ id: e.id, data: e.data }]; }) }));
  return parts.map((p) => (p === part ? { ...p, texts } : p));
}

/* -- Auffrischen -------------------------------------------------------------------------------- */

/**
 * DIE ABSCHRIFTEN AUFFRISCHEN — jede, deren Behälter sich seit ihrem Bau
 * geändert hat (oder die es noch nicht gibt). `only`: nur dieser Behälter;
 * `accessId`: nur dieser Link; `all`: auch frische. Der Stand, gegen den
 * verglichen wird, kommt VOR dem Abgleich (`loadAiAccess`, dann `openScope`):
 * kam inzwischen etwas dazu, ist die Abschrift beim nächsten Mal wieder alt —
 * verloren geht nichts.
 */
export async function refreshAiAccess(
  ring: Ring, areaId: string,
  opts: { readonly only?: string; readonly accessId?: string; readonly all?: boolean; readonly progress?: (done: number, total: number) => void } = {}
): Promise<Refreshed> {
  const list = await loadAiAccess(areaId);
  if (!list.writes) return { refreshed: 0, failed: 0 };
  const jobs = list.accesses
    .filter((a) => a.ready && !a.expired && a.keySealed !== null && (opts.accessId === undefined || a.id === opts.accessId))
    .map((a) => ({ access: a, parts: a.parts.filter((p) => (opts.only === undefined || p.libraryId === opts.only) && (opts.all === true || !p.fresh)) }))
    .filter((job) => job.parts.length > 0);
  const total = jobs.reduce((sum, job) => sum + job.parts.length, 0);
  if (total === 0) return { refreshed: 0, failed: 0 };

  const { gzip, snapshotDoc } = await import('./aiSnapshot');
  const scopes = new Map<string, ScopePart[]>();
  let refreshed = 0;
  let failed = 0;
  let reason: string | undefined;
  opts.progress?.(0, total);
  for (const job of jobs) {
    const key = await accessKey(ring, areaId, job.access);
    if (key === null) { failed += job.parts.length; reason ??= 'brak klucza tego obszaru na tym urządzeniu'; continue; }
    /* Titel und Verweise nur innerhalb der Behälter DIESES Links. */
    const scopeIds = job.access.parts.map((p) => p.libraryId).sort();
    let parts = scopes.get(scopeIds.join(','));
    if (parts === undefined) { parts = await openScope(ring, areaId, scopeIds); scopes.set(scopeIds.join(','), parts); }
    for (const part of job.parts) {
      try {
        /* 2026-10-24 — mit den vollständigen Texten, die in diesem Behälter liegen; zu gross: ohne sie (die Einträge zuerst). */
        const scope = await withTexts(parts, part.libraryId);
        const madeAt = new Date().toISOString();
        let doc = snapshotDoc(scope, part.libraryId, madeAt);
        let packed = await gzip(JSON.stringify(doc));
        if (packed.length > MAX_PACKED && doc.texts !== undefined) {
          doc = snapshotDoc(scope, part.libraryId, madeAt, false);
          packed = await gzip(JSON.stringify(doc));
        }
        const sealed = await seal(key, snapshotAad(part.libraryId), packed);
        await uploadSnapshot(areaId, job.access.id, part.libraryId, part.mark, doc.entries.length, sealed);
        refreshed += 1;
      } catch (e) {
        failed += 1;
        reason ??= e instanceof Error && e.message !== '' ? e.message : undefined;
      }
      opts.progress?.(refreshed + failed, total);
    }
  }
  return { refreshed, failed, ...(reason === undefined ? {} : { reason }) };
}

/* -- Ein neuer Behälter im Bereich (0128) -------------------------------------------------------- */

/**
 * EIN BEHÄLTER WURDE ANGELEGT (`library.ts` → `createLibrary`): der Dienst hat ihn den Links
 * gegeben, die ihrem Bereich folgen; dieser Browser (er schreibt dort, sonst hätte er ihn
 * nicht anlegen dürfen) baut gleich seine erste Abschrift — leer, aber da: der Assistent sieht
 * den neuen Behälter sofort, über den Link und über MCP.
 */
export function aiCollectionAdded(ring: Ring, areaId: string, libraryId: string): void {
  forgetAiWatch(areaId);
  void refreshAiAccess(ring, areaId, { only: libraryId }).catch(() => undefined);
}

/* -- Nach dem Schreiben ------------------------------------------------------------------------- */

/** Wie lange nach dem letzten Schreiben in einem Behälter gewartet wird, bevor die Abschrift neu entsteht. */
const QUIET_MS = 45_000;
/** Wie lange die Antwort „hat dieser Bereich einen Link?" gilt. */
const WATCH_MS = 10 * 60_000;

/** Je Bereich: welche Behälter ein geltender Link abschreibt (und ob ich dort schreibe — sonst keiner). */
const watched = new Map<string, { readonly at: number; readonly copied: Promise<ReadonlySet<string>> }>();
const timers = new Map<string, number>();

/** Nach dem Anlegen oder Löschen eines Links: neu nachsehen. */
export function forgetAiWatch(areaId: string): void {
  watched.delete(areaId);
}

/**
 * EIN BEHÄLTER WURDE GESCHRIEBEN (`libraryStore.ts`): wenn Ruhe ist, einmal
 * nachsehen, ob ein Link dieses Bereichs ihn abschreibt — dann auffrischen.
 * Ein Bereich ohne Link kostet eine Frage je zehn Minuten, sonst nichts.
 */
export function libraryWritten(ring: Ring, areaId: string, libraryId: string): void {
  if (typeof window === 'undefined') return;
  const before = timers.get(libraryId);
  if (before !== undefined) window.clearTimeout(before);
  timers.set(libraryId, window.setTimeout(() => {
    timers.delete(libraryId);
    void (async () => {
      let seen = watched.get(areaId);
      if (seen === undefined || Date.now() - seen.at > WATCH_MS) {
        const copied = loadAiAccess(areaId)
          .then((l) => new Set(l.writes ? l.accesses.filter((a) => a.works).flatMap((a) => a.parts.map((p) => p.libraryId)) : []))
          .catch(() => new Set<string>());
        seen = { at: Date.now(), copied };
        watched.set(areaId, seen);
      }
      if (!(await seen.copied).has(libraryId)) return;
      await refreshAiAccess(ring, areaId, { only: libraryId }).catch(() => undefined);
    })();
  }, QUIET_MS));
}
