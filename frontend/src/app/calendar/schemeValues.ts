/**
 * 2026-10-26 — DIE WERTE EINES TERMINS NACH SEINEM SCHEMA (0132, `app.calendar_value`).
 *
 * Ein Wert ist Text. Ein OFFENES Feld geht als Beschriftung und Wert im
 * Klartext hinaus (`label`, `value` — der Aushang liest nur das); ein anderes
 * wird hier versiegelt, unter dem jüngsten Schlüssel des Bereichs, der den
 * Termin sieht — wie Titel und Ort. Die Kennung im Etikett nennt Termin,
 * Vorkommen (oder `all` am Termin) und Feld.
 */

import { areaKeys } from '../chat/chat';
import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from '../core/crypto';
import type { Ring } from '../core/keys';
import { call } from '../core/session';
import { type SchemeField, shownValue } from './scheme';

/** Wie der Dienst einen Wert schickt. */
export interface ValueRow {
  readonly field: string;
  /** `null`: am Termin; sonst an diesem Vorkommen. */
  readonly occurrenceAt: string | null;
  readonly areaId: string | null;
  readonly epoch: number | null;
  readonly sealed: string | null;
  readonly label: string | null;
  readonly value: string | null;
}

/** Ein geöffneter Wert. `public`: er steht offen da (dann ist `text` das, was der Aushang zeigt). */
export interface OpenValue {
  readonly text: string;
  readonly label: string | null;
  readonly public: boolean;
}

/** Was ein Entwurf mitbringt: ein offener Wert hat `publicLabel` (dann ist `text` das Gezeigte). */
export interface DraftValue {
  readonly key: string;
  readonly text: string;
  readonly publicLabel?: string;
}

/** Wie ein Wert gespeichert wird (an den Dienst). */
export interface ValueInput {
  readonly field: string;
  readonly areaId?: string;
  readonly epoch?: number;
  readonly sealed?: string;
  readonly label?: string;
  readonly value?: string;
}

const occurrenceKey = (occurrenceAt: string | null): string =>
  occurrenceAt === null ? 'all' : String(Date.parse(occurrenceAt));

export const valueAad = (itemId: string, occurrenceAt: string | null, key: string) =>
  aad('calendar', 'value', `${itemId}.${occurrenceKey(occurrenceAt)}.${key}`, Field.CalendarValue, 1);

/** Die Werte eines Entwurfs versiegeln (offene bleiben offen). Leere fallen fort. */
export async function sealValues(
  key: { readonly key: Uint8Array; readonly epoch: number }, areaId: string, itemId: string,
  occurrenceAt: string | null, values: readonly DraftValue[]
): Promise<ValueInput[]> {
  const out: ValueInput[] = [];
  for (const one of values) {
    const text = one.text.trim();
    if (text === '') continue;
    if (one.publicLabel !== undefined) {
      out.push({ field: one.key, label: one.publicLabel.slice(0, 120), value: text.slice(0, 400) });
      continue;
    }
    out.push({
      field: one.key, areaId, epoch: key.epoch,
      sealed: toBase64Url(await sealText(key.key, valueAad(itemId, occurrenceAt, one.key), text))
    });
  }
  return out;
}

/** Werte öffnen — was nicht aufgeht, fehlt (und `complete` ist dann falsch). */
export async function openValues(
  ring: Ring, itemId: string, rows: readonly ValueRow[]
): Promise<{ item: Map<string, OpenValue>; day: Map<string, OpenValue>; complete: boolean }> {
  const item = new Map<string, OpenValue>();
  const day = new Map<string, OpenValue>();
  let complete = true;
  for (const row of rows) {
    const into = row.occurrenceAt === null ? item : day;
    if (row.value !== null && row.sealed === null) {
      into.set(row.field, { text: row.value, label: row.label, public: true });
      continue;
    }
    try {
      if (row.areaId === null || row.epoch === null || row.sealed === null) throw new Error('leer');
      const key = (await areaKeys(ring, row.areaId)).get(row.epoch);
      if (key === undefined) throw new Error('kein Schlüssel');
      into.set(row.field, {
        text: await openText(key, valueAad(itemId, row.occurrenceAt, row.field), fromBase64Url(row.sealed)),
        label: row.label, public: false
      });
    } catch {
      if (row.occurrenceAt === null) complete = false;
    }
  }
  return { item, day, complete };
}

/** Aus den Feldern eines Schemas und den Texten im Formular: was gespeichert wird. */
export function draftValues(fields: readonly SchemeField[], texts: Readonly<Record<string, string>>): DraftValue[] {
  return fields
    .map((f) => {
      const text = (texts[f.key] ?? '').trim();
      return f.public === true
        ? { key: f.key, text: shownValue(f, text), publicLabel: f.label }
        : { key: f.key, text };
    })
    .filter((v) => v.text !== '');
}

/**
 * Was ein Formular aus einem gespeicherten Wert zeigt. Ein offener Wert steht
 * als das Gezeigte da (eine Wahl als ihr Wort) — zurück zum Wert der Wahl.
 */
export function editText(field: SchemeField, value: OpenValue | undefined): string {
  if (value === undefined) return '';
  if (!value.public) return value.text;
  if ((field.type === 'choice' || field.type === 'colour') && field.options !== undefined) {
    return field.options.find((o) => o.label === value.text || o.value === value.text)?.value ?? value.text;
  }
  if (field.type === 'number' && field.unit) return value.text.replace(new RegExp(`\\s*${field.unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '');
  return value.text;
}

/** Die Werte eines geöffneten Termins als Entwurf — für Kopien. */
export const valuesAsDraft = (values: ReadonlyMap<string, OpenValue>): DraftValue[] =>
  [...values.entries()].map(([key, v]) => (v.public ? { key, text: v.text, publicLabel: v.label ?? key } : { key, text: v.text }));

/** Die Werte eines Vorkommens (eines Tages einer Reihe) setzen — ersetzt, was dort stand. */
export async function saveDayValues(
  itemId: string, occurrenceAt: string, key: { readonly key: Uint8Array; readonly epoch: number }, areaId: string,
  values: readonly DraftValue[]
): Promise<{ itemId: string; values: number }> {
  const sealed = await sealValues(key, areaId, itemId, occurrenceAt, values);
  return call(`/workspace/item/${encodeURIComponent(itemId)}/values`, {
    method: 'POST', body: JSON.stringify({ occurrenceAt, values: sealed })
  });
}
