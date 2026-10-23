/**
 * RODZAJE TEKSTÓW (2026-10-23) — die eigenen Rodzaje des Skryptorium.
 *
 * Ein Rodzaj tekstu ist ein Eintrag der Art `texttype`: ein Name, eine
 * Beschreibung und die Felder, die jeder Text dieses Rodzaju zusätzlich hat.
 * Die Felder sind Felder wie die eines Rodzaj in Nauka (`FieldDef`) — derselbe
 * Editor (`cogita/KindForm.tsx`), dieselbe Gestalt der Werte (ein Verweis ist
 * eine Kennung, mit Stelle `{ value, locator }`, mehrere eine Liste). So liest
 * Nauka einen Text wie einen eigenen Eintrag (Schritt 5: Widoki nach Feldern).
 *
 * <code>
 *   texttype   { name, description, fields: [FieldDef …] }
 *   text       { textType: <kennung>, title, …feste Felder…, <key>: <wert> … }
 * </code>
 *
 * Die festen Felder eines Textes (Titel, Datum, Plan, Treść …) bleiben; ihre
 * Schlüssel kann kein Rodzaj belegen (`CORE_KEYS`). Ein Text ohne Rodzaj ist
 * ein einfacher Text. Werte eines Feldes, das der Rodzaj nicht mehr hat,
 * bleiben im Text stehen (nichts geht verloren) — gezeigt werden sie nicht.
 *
 * Diese Datei ist leicht (sie liest die Felder selbst): ein Text auf einer
 * Seite zieht nicht das Schema von Nauka nach. Bearbeitet wird ein Rodzaj im
 * Skryptorium mit `cogita/schema.ts` (`TextTypeEditor.tsx`).
 */

import { ids, kindOf, str, type EntryData, type LibEntry, type Lookup } from '../library/libraryKinds';

/**
 * Was ein Rodzaj tekstu anbietet: die Typen von Nauka ohne Medien, Karte und
 * Bereich — und ohne Zapis, den hat der Text selbst (Plan, Treść, Dalsze).
 */
export const TEXT_TYPE_FIELD_TYPES = ['line', 'text', 'number', 'date', 'bool', 'choice', 'ref', 'url', 'list'] as const;
export type TypeFieldType = (typeof TEXT_TYPE_FIELD_TYPES)[number];

/** Die Schlüssel der festen Felder eines Textes — mit ihrem Namen (für die Warnung im Editor). */
export const CORE_KEYS: ReadonlyMap<string, string> = new Map(kindOf('text')!.fields.map((f) => [f.key, `stałe pole tekstu „${f.label}”`]));

/** Ein Feld eines Rodzaj tekstu, so weit ein Leser es braucht. */
export interface TypeField {
  readonly key: string;
  readonly label: string;
  readonly type: TypeFieldType;
  readonly multi: boolean;
  readonly options?: readonly { readonly value: string; readonly label: string }[];
  readonly to?: readonly string[];
  readonly locator?: boolean;
  readonly unit?: string;
  readonly says?: string;
}

export interface TextType {
  readonly id: string;
  readonly key?: string;
  readonly name: string;
  readonly description: string;
  readonly fields: readonly TypeField[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const FIELD_KEY = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;

/** Die Felder, wie sie im Eintrag stehen — nur die, die ein Rodzaj tekstu haben darf. */
export function typeFieldsOf(raw: unknown): TypeField[] {
  const out: TypeField[] = [];
  for (const one of Array.isArray(raw) ? raw : []) {
    if (!isObject(one)) continue;
    const key = typeof one.key === 'string' ? one.key : '';
    const type = (TEXT_TYPE_FIELD_TYPES as readonly string[]).includes(String(one.type)) ? one.type as TypeFieldType : null;
    if (!FIELD_KEY.test(key) || type === null || CORE_KEYS.has(key) || out.some((f) => f.key === key)) continue;
    const options = Array.isArray(one.options)
      ? one.options.flatMap((o) => (typeof o === 'string' ? [{ value: o, label: o }] : isObject(o) && typeof o.value === 'string' ? [{ value: o.value, label: typeof o.label === 'string' ? o.label : o.value }] : []))
      : undefined;
    out.push({
      key,
      label: typeof one.label === 'string' && one.label.trim() !== '' ? one.label.trim() : key,
      type,
      multi: one.multi === true,
      ...(options === undefined ? {} : { options }),
      ...(Array.isArray(one.to) ? { to: one.to.filter((t): t is string => typeof t === 'string') } : {}),
      ...(one.locator === true ? { locator: true } : {}),
      ...(typeof one.unit === 'string' && one.unit !== '' ? { unit: one.unit } : {}),
      ...(typeof one.says === 'string' && one.says !== '' ? { says: one.says } : {})
    });
  }
  return out;
}

/** Ein Rodzaj tekstu aus seinem Eintrag. */
export function readTextType(entry: Pick<LibEntry, 'id' | 'key' | 'data'>): TextType {
  return {
    id: entry.id,
    ...(entry.key === undefined ? {} : { key: entry.key }),
    name: str(entry.data, 'name').trim() || 'Rodzaj tekstu',
    description: str(entry.data, 'description'),
    fields: typeFieldsOf(entry.data.fields)
  };
}

/** Der Rodzaj eines Textes — \`null\`: ein einfacher Text (oder sein Rodzaj ist hier nicht lesbar). */
export function textTypeOf(data: EntryData, look: Pick<Lookup, 'get'>): TextType | null {
  const entry = look.get(ids(data, 'textType')[0] ?? '');
  return entry !== undefined && entry.kind === 'texttype' ? readTextType(entry) : null;
}

/** Was ein Wert des Feldes nennt — Kennungen (bei einem Verweis), sonst der Text. */
function partsOf(field: TypeField, raw: unknown): { id?: string; text: string; locator?: string }[] {
  const list = Array.isArray(raw) ? raw : [raw];
  return list.flatMap((one): { id?: string; text: string; locator?: string }[] => {
    const value = isObject(one) && 'value' in one ? one.value : one;
    const locator = isObject(one) && typeof one.locator === 'string' && one.locator.trim() !== '' ? one.locator.trim() : undefined;
    if (value === undefined || value === null || value === '') return [];
    if (field.type === 'ref') return typeof value === 'string' ? [{ id: value, text: '', ...(locator === undefined ? {} : { locator }) }] : [];
    if (field.type === 'bool') return [{ text: value === true || value === 'yes' ? 'tak' : value === false || value === 'no' ? 'nie' : String(value) }];
    if (field.type === 'choice') return [{ text: field.options?.find((o) => o.value === value)?.label ?? String(value) }];
    if (isObject(value)) return [{ text: typeof value.value === 'number' || typeof value.value === 'string' ? `${value.value}${typeof value.unit === 'string' ? ` ${value.unit}` : ''}` : '' }];
    return [{ text: `${String(value)}${field.type === 'number' && field.unit !== undefined ? ` ${field.unit}` : ''}` }];
  }).filter((p) => p.id !== undefined || p.text.trim() !== '');
}

/**
 * Die eigenen Felder eines Textes in Worten — „Tajemnica: Zwiastowanie" —,
 * für den Kopf des Textes, das Archiv und LaTeX. Ein Verweis, den der Leser
 * nicht lesen kann, sagt nichts über sein Ziel: er fällt weg.
 */
export function typeLines(data: EntryData, look: Lookup): { label: string; value: string }[] {
  const type = textTypeOf(data, look);
  if (type === null) return [];
  const out: { label: string; value: string }[] = [];
  for (const field of type.fields) {
    const parts = partsOf(field, data[field.key]).flatMap((p) => {
      if (p.id === undefined) return [p.text];
      const target = look.get(p.id);
      if (target === undefined) return [];
      const name = look.title?.(target) ?? kindOf(target.kind)?.title(target.data, look) ?? str(target.data, 'name');
      return [p.locator === undefined ? name : `${name}, ${p.locator}`];
    }).filter((t) => t.trim() !== '');
    if (parts.length > 0) out.push({ label: field.label, value: parts.join(', ') });
  }
  return out;
}

/** Die Kennungen, auf die die eigenen Felder eines Textes zeigen (Rückverweise, Erreichbarkeit). */
export function typeRefs(data: EntryData, look: Pick<Lookup, 'get'>): string[] {
  const type = textTypeOf(data, look);
  if (type === null) return [];
  return type.fields.filter((f) => f.type === 'ref').flatMap((f) => partsOf(f, data[f.key]).flatMap((p) => (p.id === undefined ? [] : [p.id])));
}
