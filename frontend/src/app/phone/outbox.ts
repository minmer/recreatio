/**
 * WAS DAS TELEFON SENDEN SOLL (0116) — im Browser geschrieben (eine Antwort auf eine
 * archivierte SMS, oder eine Nachricht für später), gesendet vom Telefon, das die
 * Nummer der Rozmowa hat.
 *
 * <code>
 *   queueReply   (Browser) ablegen — versiegelt im Bereich des Archivs: an wen, was,
 *                wann, von welcher eigenen Nummer
 *   loadOutbox   (beide) was wartet, was ein Telefon übernahm, was gesendet ist
 *   cancelReply  (Browser) absagen, solange nicht gesendet
 *   runOutbox    (Telefon) übernehmen, was zu den eigenen Nummern passt, und planen
 *                (`ScheduledSms` sendet zur Zeit, auch ohne Netz); Ausgänge melden;
 *                Absagen umsetzen
 * </code>
 *
 * Das Telefon erfährt davon über den Wecker (FCM) und sonst beim Fragen im Takt
 * (`/notify/digest` zählt, was wartet) — und solange die App offen ist, jede Minute.
 */

import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from '../core/crypto';
import { newId } from '../core/ids';
import { call, WorkspaceError, type Who } from '../core/session';
import { archiveSettings } from './archiveSettings';
import type { PhoneSource } from './native';
import { phoneKey, samePhone } from './numbers';
import { openArea, type PhoneCtx } from './phoneContext';

/** Was das Telefon senden soll — versiegelt. */
export interface OutboxMessage {
  readonly to: readonly string[];
  readonly body: string;
  /** Die eigene Nummer, von der es hinausgeht (nach `phoneKey`) — nur ein Telefon mit ihr nimmt es. */
  readonly line: string;
  /** Millisekunden; `null`: sofort. */
  readonly sendAt: number | null;
  /** Das Gespräch im Archiv (`conversationKey`). */
  readonly conversation: string;
  readonly createdAt: number;
}

export type OutboxState = 'waiting' | 'taken' | 'sent' | 'failed' | 'cancelled';

export interface OutboxEntry {
  readonly id: string;
  readonly state: OutboxState;
  /** Wie sich das Telefon nennt, das sie übernahm. */
  readonly device: string | null;
  readonly error: string | null;
  readonly createdAt: string;
  readonly takenAt: string | null;
  readonly doneAt: string | null;
  readonly cancelledAt: string | null;
  readonly closedAt: string | null;
  /** Geöffnet — `null`: geht nicht auf (fremde Epoche). */
  readonly message: OutboxMessage | null;
}

interface OutboxRow extends Omit<OutboxEntry, 'message'> {
  readonly epoch: number;
  readonly sealed: string;
}

const outboxAad = (id: string) => aad('phone', 'outbox', id, Field.PhoneOutbox, 1);
const base = (areaId: string) => `/workspace/phone/${encodeURIComponent(areaId)}/outbox`;

/** Tolerant gelesen; was nicht passt, ist keine Nachricht. */
export function readMessage(json: string): OutboxMessage | null {
  try {
    const o = JSON.parse(json) as Partial<OutboxMessage>;
    const to = Array.isArray(o.to) ? o.to.filter((t): t is string => typeof t === 'string' && t.trim() !== '') : [];
    if (to.length === 0 || typeof o.body !== 'string' || o.body.trim() === '' || typeof o.line !== 'string' || o.line === '') return null;
    return {
      to,
      body: o.body,
      line: o.line,
      sendAt: typeof o.sendAt === 'number' && Number.isFinite(o.sendAt) ? o.sendAt : null,
      conversation: typeof o.conversation === 'string' ? o.conversation : '',
      createdAt: typeof o.createdAt === 'number' ? o.createdAt : 0
    };
  } catch {
    return null;
  }
}

/** Eine Antwort (oder eine Nachricht für später) für das Telefon ablegen. */
export async function queueReply(ctx: PhoneCtx, message: Omit<OutboxMessage, 'createdAt'>): Promise<string> {
  const id = newId();
  const body: OutboxMessage = { ...message, line: phoneKey(message.line), createdAt: Date.now() };
  const sealed = await sealText(ctx.newest.key, outboxAad(id), JSON.stringify({ v: 1, ...body }));
  await call(base(ctx.areaId), { method: 'POST', body: JSON.stringify({ id, epoch: ctx.newest.epoch, sealed: toBase64Url(sealed) }) });
  return id;
}

/** Was im Archiv dieses Bereichs auf ein Telefon wartet, übernommen ist oder in der letzten Woche erledigt wurde. */
export async function loadOutbox(ctx: PhoneCtx): Promise<OutboxEntry[]> {
  const { entries } = await call<{ entries: readonly OutboxRow[] }>(base(ctx.areaId));
  const out: OutboxEntry[] = [];
  for (const row of entries) {
    const key = ctx.keys.get(row.epoch);
    let message: OutboxMessage | null = null;
    if (key !== undefined) {
      try { message = readMessage(await openText(key, outboxAad(row.id), fromBase64Url(row.sealed))); } catch { message = null; }
    }
    const { epoch: _epoch, sealed: _sealed, ...rest } = row;
    out.push({ ...rest, message });
  }
  return out;
}

export const cancelReply = (ctx: PhoneCtx, id: string): Promise<unknown> =>
  call(`${base(ctx.areaId)}/${encodeURIComponent(id)}/cancel`, { method: 'POST' });

/**
 * Was unter einem Gespräch noch steht: was wartet oder übernommen ist; was gesendet ist,
 * bis das Telefon es archiviert hat (eine eigene mit demselben Text, nicht vor dem
 * Ablegen); was nicht gesendet wurde, bis es noch einmal geschickt ist; was abgesagt
 * wurde, bis das übernehmende Telefon es bestätigt.
 */
export function pendingOf(
  entries: readonly OutboxEntry[], conversation: string,
  archived: readonly { readonly box: string; readonly body: string; readonly at: number }[]
): OutboxEntry[] {
  return entries.filter((e) => {
    const m = e.message;
    if (m === null || m.conversation !== conversation) return false;
    switch (e.state) {
      case 'cancelled': return e.takenAt !== null && e.closedAt === null;
      case 'sent': return !archived.some((a) => a.box !== 'in' && a.body === m.body && a.at >= m.createdAt - 60_000);
      case 'failed': return !entries.some((o) => o.id !== e.id && o.message?.conversation === conversation && o.message.body === m.body
        && o.message.createdAt > m.createdAt);
      default: return true;
    }
  });
}

/* -- Auf dem Telefon ---------------------------------------------------------------------------- */

/** Ein Schritt beim Dienst; 409 (ein anderes Telefon war schneller, schon abgesagt) ist kein Fehler, sondern `false`. */
async function step(areaId: string, id: string, what: 'take' | 'done' | 'close', body: unknown = {}): Promise<boolean> {
  try {
    await call(`${base(areaId)}/${encodeURIComponent(id)}/${what}`, { method: 'POST', body: JSON.stringify(body) });
    return true;
  } catch (e) {
    if (e instanceof WorkspaceError && e.verdict !== null && e.verdict !== undefined) return false;
    throw e;
  }
}

/**
 * DAS TELEFON SIEHT NACH. In jedem Bereich, in den es archiviert (und archiviert hat):
 * was wartet und zu einer eigenen Nummer passt, übernimmt es und plant es (sofort oder
 * zur Zeit). Was gesendet (oder nicht) ist, meldet es; was abgesagt wurde, nimmt es zurück.
 */
export async function runOutbox(who: Who, source: PhoneSource): Promise<{ taken: number; reported: number; cancelled: number }> {
  let taken = 0;
  let reported = 0;
  let cancelled = 0;

  /* 1. Ausgänge melden. */
  const { entries: local } = await source.scheduled();
  for (const e of local) {
    if (e.outboxId === undefined || e.outboxArea === undefined || (e.state !== 'sent' && e.state !== 'failed')) continue;
    await step(e.outboxArea, e.outboxId, 'done', { ok: e.state === 'sent', error: e.error ?? null });
    await source.forgetScheduled({ id: e.id });
    reported++;
  }

  /* 2. Übernehmen und Absagen — in den Bereichen des Archivs (auch früherer Rollen). */
  const settings = await archiveSettings();
  const areas = [...new Set([settings.areaId, ...Object.values(settings.areas)].filter((a): a is string => typeof a === 'string' && a !== ''))];
  if (areas.length === 0) return { taken, reported, cancelled };
  const { lines } = await source.lines();
  const mine = lines.filter((l) => l.number !== null);
  const here = new Map(local.map((e) => [e.id, e]));
  let device: string | null = null;

  for (const areaId of areas) {
    let ctx: PhoneCtx;
    try { ctx = await openArea(who, areaId); } catch { continue; }
    for (const entry of await loadOutbox(ctx)) {
      if (entry.state === 'waiting' && entry.message !== null) {
        const message = entry.message;
        const line = mine.find((l) => samePhone(l.number, message.line));
        if (line === undefined) continue;
        device ??= (await source.device()).device;
        if (!await step(areaId, entry.id, 'take', { device })) continue;
        await source.schedule({
          id: entry.id, to: message.to, body: message.body, sendAt: message.sendAt ?? Date.now(), subId: line.subId,
          outboxArea: areaId, outboxId: entry.id
        });
        taken++;
      } else if (entry.state === 'cancelled' && entry.takenAt !== null && entry.closedAt === null) {
        const mineToo = here.get(entry.id);
        /* Ein anderes Telefon hat sie übernommen — dessen Sache. */
        if (mineToo === undefined) continue;
        if (mineToo.state === 'scheduled') {
          await source.unschedule({ id: entry.id });
          await source.forgetScheduled({ id: entry.id });
          await step(areaId, entry.id, 'close');
          cancelled++;
        }
        /* Schon hinaus: dann zählt der Ausgang (Schritt 1 meldet ihn, „gesendet" gilt auch nach dem Absagen). */
      }
    }
  }
  return { taken, reported, cancelled };
}
