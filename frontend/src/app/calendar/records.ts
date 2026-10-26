/**
 * 2026-10-26 — EINTRÄGE AN EINEM VORKOMMEN (0132, `app.occurrence_record`):
 * Intentionen, Anmeldungen, Dienste — jede Liste eines Schemas.
 *
 * <b>Der Dienst kennt keine Regel</b> (das Schema ist versiegelt). Ob ein
 * Eintrag dazukommen darf, sagt der Ablauf der Liste (`flow/flowRun.ts`,
 * `runRule`) HIER im Browser — für die Kanzlei vor dem Speichern und beim
 * Annehmen eines wartenden. Wer nicht im Kalender schreibt, trägt nur ein, was
 * offen ist, und sein Eintrag wartet auf die Kanzlei.
 *
 * <b>Die versiegelten Felder</b> liegen unter dem Schlüssel des eigenen
 * Bereichs des Kalenders (wie Ofiarodawca und Ofiara bisher). Ihr Etikett nennt
 * Eintrag und Feld — ausser bei `intencje` / `giver`, `offering`: dort bleibt es
 * das der Messintention, damit „Msze i nabożeństwa" sie weiter öffnet.
 */

import { areaKeys, newestKey } from '../chat/chat';
import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from '../core/crypto';
import { newId } from '../core/ids';
import type { Ring } from '../core/keys';
import { call, WorkspaceError } from '../core/session';
import type { RuleCtx, RuleResult, Weekday } from './flow/flowModel';
import type { RecordList } from './scheme';
import type { DraftValue, OpenValue } from './schemeValues';

export type RecordStatus = 'waiting' | 'accepted' | 'declined' | 'cancelled' | 'celebrated';
export type RecordOrigin = 'office' | 'outside' | 'rule' | 'legacy';

export const STATUS_LABEL: Record<RecordStatus, string> = {
  waiting: 'czeka', accepted: 'przyjęty', declined: 'odrzucony', cancelled: 'wycofany', celebrated: 'odbyty'
};

/** Bei Intentionen heisst „odbyty" „odprawiona". */
export const statusWord = (list: string, status: RecordStatus): string =>
  list === 'intencje' ? ({ accepted: 'przyjęta', celebrated: 'odprawiona', cancelled: 'wycofana', declined: 'odrzucona', waiting: 'czeka' } as const)[status] : STATUS_LABEL[status];

export interface RecordValueRow {
  readonly field: string;
  readonly areaId: string | null;
  readonly epoch: number | null;
  readonly sealed: string | null;
  readonly value: string | null;
}

export interface RecordRow {
  readonly recordId: string;
  readonly itemId: string;
  readonly occurrenceAt: string;
  readonly listKey: string;
  readonly mode: string | null;
  readonly ordinal: number;
  readonly status: RecordStatus;
  readonly textPublic: string | null;
  readonly roleId: string | null;
  readonly origin: RecordOrigin;
  readonly createdByRoleId: string | null;
  readonly mine: boolean;
  readonly values: readonly RecordValueRow[];
}

export interface OpenRecord extends Omit<RecordRow, 'values'> {
  readonly values: ReadonlyMap<string, OpenValue>;
}

/** Zählt: angenommen oder odbyty. */
export const isLive = (status: string): boolean => status === 'accepted' || status === 'celebrated';

export function recordAad(listKey: string, recordId: string, field: string) {
  if (listKey === 'intencje' && field === 'giver') return aad('mass', 'intention', recordId, Field.MassIntentionGiver, 1);
  if (listKey === 'intencje' && field === 'offering') return aad('mass', 'intention', recordId, Field.MassIntentionOffering, 1);
  return aad('calendar', 'record', `${recordId}.${field}`, Field.RecordValue, 1);
}

const window_ = (from: Date, to: Date) => `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;

export const loadRecords = (itemId: string, from: Date, to: Date): Promise<{ records: readonly RecordRow[] }> =>
  call(`/workspace/item/${encodeURIComponent(itemId)}/records?${window_(from, to)}`);

export const loadCalendarRecords = (calendarId: string, from: Date, to: Date, list?: string): Promise<{ records: readonly RecordRow[] }> =>
  call(`/workspace/calendar/${encodeURIComponent(calendarId)}/records?${window_(from, to)}${list ? `&list=${encodeURIComponent(list)}` : ''}`);

/** Die Einträge EINES Vorkommens, geöffnet. */
export async function recordsAt(ring: Ring, itemId: string, occurrenceAt: string): Promise<OpenRecord[]> {
  const at = new Date(occurrenceAt);
  const { records } = await loadRecords(itemId, new Date(at.getTime() - 60_000), new Date(at.getTime() + 60_000));
  return openRecords(ring, records.filter((r) => Date.parse(r.occurrenceAt) === at.getTime()));
}

export async function openRecords(ring: Ring, rows: readonly RecordRow[]): Promise<OpenRecord[]> {
  const out: OpenRecord[] = [];
  for (const row of rows) {
    const values = new Map<string, OpenValue>();
    for (const v of row.values) {
      if (v.sealed === null) {
        if (v.value !== null) values.set(v.field, { text: v.value, label: null, public: true });
        continue;
      }
      try {
        if (v.areaId === null || v.epoch === null) continue;
        const key = (await areaKeys(ring, v.areaId)).get(v.epoch);
        if (key === undefined) continue;
        values.set(v.field, { text: await openText(key, recordAad(row.listKey, row.recordId, v.field), fromBase64Url(v.sealed)), label: null, public: false });
      } catch {
        /* Nicht lesbar — dann eben ohne. */
      }
    }
    out.push({ ...row, values });
  }
  return out;
}

/** Werte eines Eintrags fürs Speichern: offene offen, die anderen versiegelt (nur, wer im Kalender schreibt). */
async function sealRecordValues(
  ring: Ring, areaId: string | null, listKey: string, recordId: string, values: readonly DraftValue[]
): Promise<{ field: string; areaId?: string; epoch?: number; sealed?: string; value?: string }[]> {
  const out: { field: string; areaId?: string; epoch?: number; sealed?: string; value?: string }[] = [];
  const hidden = values.filter((v) => v.publicLabel === undefined && v.text.trim() !== '');
  let newest: { key: Uint8Array; epoch: number } | null = null;
  if (hidden.length > 0) {
    if (areaId === null) throw new WorkspaceError('Z zewnątrz można podać tylko jawne pola.');
    newest = newestKey(await areaKeys(ring, areaId, true));
    if (newest === null) throw new WorkspaceError('Nie masz klucza tego obszaru — nie da się tu zapisać.');
  }
  for (const v of values) {
    const text = v.text.trim();
    if (v.publicLabel !== undefined) {
      out.push(text === '' ? { field: v.key } : { field: v.key, value: text.slice(0, 400) });
      continue;
    }
    if (text === '') { out.push({ field: v.key }); continue; }
    out.push({
      field: v.key, areaId: areaId!, epoch: newest!.epoch,
      sealed: toBase64Url(await sealText(newest!.key, recordAad(listKey, recordId, v.key), text))
    });
  }
  return out;
}

export interface RecordInput {
  readonly occurrenceAt: string;
  readonly listKey: string;
  readonly mode?: string | null;
  readonly textPublic?: string | null;
  readonly roleId?: string | null;
  readonly status?: 'accepted' | 'waiting';
  readonly origin?: 'office' | 'rule';
  readonly ordinal?: number;
  readonly values?: readonly DraftValue[];
}

/**
 * Einen Eintrag anlegen. `sealArea`: der eigene Bereich des Kalenders, unter
 * dem versiegelt wird — `null` für jemanden, der dort nicht schreibt (dann nur
 * offene Felder, und der Eintrag wartet).
 */
export async function addRecord(ring: Ring, itemId: string, sealArea: string | null, input: RecordInput): Promise<{ recordId: string; ordinal: number; status: RecordStatus }> {
  const recordId = newId();
  const values = await sealRecordValues(ring, sealArea, input.listKey, recordId, (input.values ?? []).filter((v) => v.text.trim() !== ''));
  return call(`/workspace/item/${encodeURIComponent(itemId)}/record`, {
    method: 'POST',
    body: JSON.stringify({
      recordId, occurrenceAt: input.occurrenceAt, listKey: input.listKey, mode: input.mode ?? null,
      ordinal: input.ordinal ?? null, status: input.status ?? 'accepted', textPublic: input.textPublic?.trim() || null,
      roleId: input.roleId ?? null, origin: input.origin ?? 'office', values
    })
  });
}

export interface RecordPatch {
  readonly status?: RecordStatus;
  readonly mode?: string | null;
  readonly ordinal?: number;
  readonly textPublic?: string;
  /** `""`: niemand mehr. */
  readonly roleId?: string;
  readonly values?: readonly DraftValue[];
  readonly move?: { readonly itemId: string; readonly occurrenceAt: string };
}

export async function updateRecord(ring: Ring, record: Pick<RecordRow, 'recordId' | 'listKey'>, sealArea: string | null, patch: RecordPatch): Promise<{ recordId: string; updated: boolean }> {
  const values = patch.values === undefined ? undefined : await sealRecordValues(ring, sealArea, record.listKey, record.recordId, patch.values);
  return call(`/workspace/record/${encodeURIComponent(record.recordId)}`, {
    method: 'POST',
    body: JSON.stringify({
      status: patch.status ?? null, mode: patch.mode ?? null,
      ordinal: patch.ordinal ?? null, textPublic: patch.textPublic ?? null, roleId: patch.roleId ?? null,
      values: values ?? null, itemId: patch.move?.itemId ?? null, occurrenceAt: patch.move?.occurrenceAt ?? null
    })
  });
}

export const deleteRecord = (recordId: string): Promise<{ recordId: string; deleted: boolean }> =>
  call(`/workspace/record/${encodeURIComponent(recordId)}/delete`, { method: 'POST' });

/* -- Die Regel einer Liste ------------------------------------------------------------------- */

const weekdayOf = (d: Date): Weekday => (((d.getDay() + 6) % 7) + 1) as Weekday;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Montag 0:00 der Woche eines Tages, und der Montag danach. */
export function weekOf(at: Date): { from: Date; to: Date } {
  const from = new Date(at);
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from, to };
}

/**
 * Darf dieser Eintrag dazukommen (oder angenommen werden)? Liest die Einträge
 * der Liste in derselben Woche dieses Kalenders — für Regeln wie „höchstens
 * zwei Msze z intencjami zbiorowymi w tygodniu".
 */
export async function checkRule(
  list: RecordList, args: {
    readonly calendarId: string; readonly itemId: string; readonly occurrenceAt: string; readonly start: Date;
    readonly actor: 'office' | 'outside'; readonly mode?: string | null; readonly values: Readonly<Record<string, string>>;
    /** Beim Annehmen: der Eintrag selbst zählt nicht mit. */
    readonly except?: string;
  }
): Promise<RuleResult> {
  if (list.rule === undefined || list.rule === null || list.rule.nodes.length === 0) {
    return { verdict: args.actor === 'office' ? 'allow' : 'wait' };
  }
  const week = weekOf(args.start);
  let rows: readonly RecordRow[] = [];
  try {
    rows = (await loadCalendarRecords(args.calendarId, week.from, week.to, list.key)).records;
  } catch {
    rows = [];
  }
  const here = `${args.itemId}|${Date.parse(args.occurrenceAt)}`;
  const others = rows.filter((r) => r.recordId !== args.except && r.listKey === list.key);
  const ctx: RuleCtx = {
    actor: args.actor,
    date: dayKey(args.start),
    weekday: weekdayOf(args.start),
    record: { mode: args.mode ?? undefined, values: args.values },
    occurrence: others.filter((r) => `${r.itemId}|${Date.parse(r.occurrenceAt)}` === here).map((r) => ({ mode: r.mode ?? undefined, status: r.status })),
    week: others.map((r) => ({ mode: r.mode ?? undefined, status: r.status, occurrence: `${r.itemId}|${Date.parse(r.occurrenceAt)}` })),
    here
  };
  /* Der Ablauf erst, wenn eine Regel da ist — der Dialog eines Termins lädt ihn sonst nicht. */
  const { runRule } = await import('./flow/flowRun');
  return runRule(list.rule, ctx);
}
