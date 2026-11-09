/**
 * 2026-10-29 — KONTAKTE ALS JSON ("recreatio/contacts", Fassung 1): dasselbe Adressbuch wie in der vCard
 * (`vcard.ts` — sie bleibt für Telefone, Google, Outlook), aber in der Gestalt aller JSON-Importe der App: mit
 * Kennungen, Vorschau und einer Beschreibung, die auch ein Assistent liest (MCP, `get_import_format`).
 *
 * <code>
 *   mit "id" (aus dem Export)   der Kontakt wird AN ORT UND STELLE geändert — nur die Felder, die das Dokument nennt
 *   ohne "id"                    gesucht wie beim Einlesen einer vCard (`planImport`: gleicher Name und eine
 *                                gemeinsame Nummer) und ergänzt — sonst neu
 * </code>
 *
 * Gelöscht wird nichts. Versiegelt wird wie bei jedem Speichern (`saveContactsMany`): der Dienst sieht nur, DASS es
 * Kontakte gibt.
 */

import { t } from '../core/i18n';
import { keyLines, pretty, type JsonNode } from '../core/jsonTree';
import { planImport, sameContact, tidyContact, type Contact, type ContactData, type ContactEmail, type ContactPhone } from './contactStore';

export const CONTACTS_FORMAT = 'recreatio/contacts';
export const CONTACTS_VERSION = 1;

/** Höchstens so viele Kontakte je Dokument — mehr ist eine Sicherung, kein Import zum Durchsehen. */
const MAX_CONTACTS = 5000;

/** Eine Tabelle, deren Sätze erst beim Lesen geholt werden (in der Sprache der Anwendung) — die Schlüssel bleiben. */
function lazy(table: Readonly<Record<string, () => string>>): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, text] of Object.entries(table)) Object.defineProperty(out, key, { get: text, enumerable: true });
  return out;
}

const TOP_KEYS: Readonly<Record<string, string>> = lazy({
  format: () => `"${CONTACTS_FORMAT}"`,
  version: () => `${CONTACTS_VERSION}`,
  contacts: () => t('phoneContacts.json.keys.contacts')
});

const CONTACT_KEYS: Readonly<Record<string, string>> = lazy({
  id: () => t('phoneContacts.json.keys.id'),
  name: () => t('phoneContacts.json.keys.name'),
  given: () => t('phoneContacts.json.keys.given'),
  family: () => t('phoneContacts.json.keys.family'),
  org: () => t('phoneContacts.json.keys.org'),
  title: () => t('phoneContacts.json.keys.title'),
  phones: () => t('phoneContacts.json.keys.phones'),
  emails: () => t('phoneContacts.json.keys.emails'),
  note: () => t('phoneContacts.json.keys.note'),
  birthday: () => t('phoneContacts.json.keys.birthday'),
  groups: () => t('phoneContacts.json.keys.groups')
});

const sample = () => ({
  format: CONTACTS_FORMAT,
  version: CONTACTS_VERSION,
  contacts: [
    { name: 'Anna Kowalska', given: 'Anna', family: 'Kowalska', phones: [{ number: '+48 600 100 200', label: 'komórka' }], emails: ['anna.kowalska@example.pl'], groups: ['Schola'], birthday: '1987-05-14' }, // i18n-ignore
    { name: 'ks. Marek Nowak', org: t('phoneContacts.json.sample.org'), title: t('phoneContacts.json.sample.title'), phones: ['+48 22 123 45 67'], note: t('phoneContacts.json.sample.note') }
  ]
});

/*
 * 2026-10-30 — WAS DIE APP MIT DEN KONTAKTEN TUT: nur der Telefonteil liest sie (Kontakty, SMS, Archiv,
 * „Numery i grupy"); im Telefon die Abschrift im Konto „REcreatio" (`PhoneContacts.java`), deren Name gewinnt
 * (`ContactIndex.java`); eine Gruppe trägt ihre Nummer über ihren Namen (`lines.ts`, `sms.groupLines`).
 */
export const CONTACTS_USAGE_JSON: JsonNode = {
  key: 'contacts.usage',
  get title() { return t('phoneContacts.json.usage.title'); },
  text: () => t('phoneContacts.json.usage.text')
};

export const CONTACTS_JSON: JsonNode = {
  key: 'contacts',
  get title() { return t('phoneContacts.json.title', { format: CONTACTS_FORMAT, version: CONTACTS_VERSION }); },
  get short() { return t('phoneContacts.json.short'); },
  text: () => `${t('phoneContacts.json.intro', { max: MAX_CONTACTS })}

${t('phoneContacts.json.doc')}
${keyLines(TOP_KEYS)}

${t('phoneContacts.json.contact')}
${keyLines(CONTACT_KEYS)}

${t('phoneContacts.json.example')}
${pretty(sample())}`,
  inside: () => [CONTACTS_USAGE_JSON],
  samples: () => [{ get label() { return t('phoneContacts.json.sampleLabel'); }, doc: sample }]
};

/** Die Schlüssel, die die Beschreibung erklärt — für die Prüfung. */
export const CONTACT_JSON_KEYS: readonly string[] = Object.keys(CONTACT_KEYS);

/* -- Export -------------------------------------------------------------------------------------- */

const stripNulls = (o: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)));

export function exportContactsJson(list: readonly Contact[]): Record<string, unknown> {
  return {
    format: CONTACTS_FORMAT,
    version: CONTACTS_VERSION,
    contacts: list.map((c) => stripNulls({
      id: c.id, name: c.name, given: c.given, family: c.family, org: c.org, title: c.title,
      phones: c.phones.map((p) => (p.label === null ? { number: p.number } : { number: p.number, label: p.label })),
      emails: c.emails.map((e) => (e.label === null ? { address: e.address } : { address: e.address, label: e.label })),
      note: c.note, birthday: c.birthday, groups: [...c.groups]
    }))
  };
}

/* -- Lesen und planen ---------------------------------------------------------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const textOf = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const BIRTHDAY = /^(?:\d{4}|-)-\d{2}-\d{2}$/;

/** Ein Kontakt des Dokuments: die Felder, die er NENNT (für die Änderung in place), und was daraus ganz wird. */
interface Incoming {
  readonly id: string | null;
  readonly given: Partial<ContactData>;
  readonly label: string;
}

function readPhones(v: unknown, where: string, warnings: string[]): ContactPhone[] {
  if (!Array.isArray(v)) { warnings.push(t('phoneContacts.json.warn.phonesNotList', { where })); return []; }
  const out: ContactPhone[] = [];
  for (const one of v) {
    if (typeof one === 'string' && one.trim() !== '') out.push({ number: one.trim(), label: null });
    else if (isObject(one) && textOf(one.number) !== null) out.push({ number: textOf(one.number)!, label: textOf(one.label) });
    else warnings.push(t('phoneContacts.json.warn.badNumber', { where, value: JSON.stringify(one).slice(0, 60) }));
  }
  return out;
}

function readEmails(v: unknown, where: string, warnings: string[]): ContactEmail[] {
  if (!Array.isArray(v)) { warnings.push(t('phoneContacts.json.warn.emailsNotList', { where })); return []; }
  const out: ContactEmail[] = [];
  for (const one of v) {
    const address = typeof one === 'string' ? textOf(one) : isObject(one) ? textOf(one.address) : null;
    if (address !== null && address.includes('@')) out.push({ address, label: isObject(one) ? textOf(one.label) : null });
    else warnings.push(t('phoneContacts.json.warn.badEmail', { where, value: JSON.stringify(one).slice(0, 60) }));
  }
  return out;
}

function readContact(raw: unknown, at: number, warnings: string[]): Incoming | null {
  const where = t('phoneContacts.json.at', { n: at + 1 });
  if (!isObject(raw)) { warnings.push(t('phoneContacts.json.warn.notObject', { where })); return null; }
  for (const key of Object.keys(raw)) if (!(key in CONTACT_KEYS)) warnings.push(t('phoneContacts.json.warn.unknownKey', { where, key }));
  const given: { -readonly [K in keyof ContactData]?: ContactData[K] } = {};
  for (const key of ['name', 'given', 'family', 'org', 'title', 'note'] as const) {
    if (!(key in raw)) continue;
    if (raw[key] !== null && typeof raw[key] !== 'string') { warnings.push(t('phoneContacts.json.warn.notText', { where, key })); continue; }
    given[key] = textOf(raw[key]) as never;
  }
  if ('birthday' in raw) {
    const b = textOf(raw.birthday);
    if (b !== null && !BIRTHDAY.test(b)) warnings.push(t('phoneContacts.json.warn.birthday', { where, value: b }));
    else given.birthday = b;
  }
  if ('phones' in raw) given.phones = readPhones(raw.phones, where, warnings);
  if ('emails' in raw) given.emails = readEmails(raw.emails, where, warnings);
  if ('groups' in raw) {
    if (Array.isArray(raw.groups)) given.groups = raw.groups.filter((g): g is string => typeof g === 'string' && g.trim() !== '').map((g) => g.trim());
    else warnings.push(t('phoneContacts.json.warn.groupsNotList', { where }));
  }
  const id = textOf(raw.id);
  const label = textOf(given.name) ?? ([given.given, given.family].filter(Boolean).join(' ') || null);
  if (id === null && label === null) { warnings.push(t('phoneContacts.json.warn.noName', { where })); return null; }
  return { id, given, label: label ?? t('phoneContacts.json.sameLabel') };
}

/** Ein neuer Kontakt aus dem, was das Dokument nennt. */
const whole = (g: Partial<ContactData>): ContactData => tidyContact({
  name: g.name ?? '', given: g.given ?? null, family: g.family ?? null, org: g.org ?? null, title: g.title ?? null,
  phones: g.phones ?? [], emails: g.emails ?? [], note: g.note ?? null, birthday: g.birthday ?? null, groups: g.groups ?? [], source: null
});

export interface ContactsJsonPlan {
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
  /** Was zu speichern ist — wie `planImport` es liefert (`saveContactsMany`). */
  readonly work: readonly { readonly id: string | null; readonly data: ContactData; readonly version: number }[];
}

export function planContactsJson(doc: unknown, existing: readonly Contact[]): ContactsJsonPlan | { error: string } {
  if (!isObject(doc)) return { error: t('phoneContacts.json.err.notObject') };
  if (doc.format !== undefined && doc.format !== CONTACTS_FORMAT) return { error: t('phoneContacts.json.err.format', { got: String(doc.format), format: CONTACTS_FORMAT }) };
  if (!Array.isArray(doc.contacts)) return { error: t('phoneContacts.json.err.noList') };
  const warnings: string[] = [];
  for (const key of Object.keys(doc)) if (!(key in TOP_KEYS)) warnings.push(t('phoneContacts.json.warn.unknownTop', { key }));
  if (doc.contacts.length > MAX_CONTACTS) warnings.push(t('phoneContacts.json.warn.tooMany', { count: doc.contacts.length, max: MAX_CONTACTS }));

  const byId = new Map(existing.map((c) => [c.id, c]));
  const changed = new Map<string, Contact>();
  const fresh: ContactData[] = [];
  const lines: string[] = [];
  let same = 0;
  doc.contacts.slice(0, MAX_CONTACTS).forEach((raw, at) => {
    const one = readContact(raw, at, warnings);
    if (one === null) return;
    if (one.id !== null) {
      const had = changed.get(one.id) ?? byId.get(one.id);
      if (had === undefined) {
        warnings.push(t('phoneContacts.json.warn.noSuchId', { name: one.label }));
        fresh.push(whole(one.given));
        return;
      }
      const next: Contact = { ...had, ...tidyContact({ ...had, ...one.given }) };
      if (sameContact(next, had)) same += 1;
      else changed.set(had.id, next);
      return;
    }
    fresh.push(whole(one.given));
  });

  /* Ohne Kennung: gesucht und ergänzt wie beim Einlesen einer vCard — auf dem schon geänderten Stand. */
  const current = existing.map((c) => changed.get(c.id) ?? c);
  const merged = planImport(fresh, current);
  const work = new Map<string, { id: string | null; data: ContactData; version: number }>();
  const added: { id: null; data: ContactData; version: number }[] = [];
  for (const [id, c] of changed) {
    work.set(id, { id, data: c, version: byId.get(id)!.version });
    lines.push(t('phoneContacts.json.line.changed', { name: c.name }));
  }
  for (const w of merged.work) {
    if (w.id === null) { added.push({ id: null, data: w.data, version: 0 }); lines.push(t('phoneContacts.json.line.new', { name: w.data.name })); continue; }
    if (!work.has(w.id)) lines.push(t('phoneContacts.json.line.completed', { name: w.data.name }));
    work.set(w.id, { id: w.id, data: w.data, version: byId.get(w.id)?.version ?? w.version });
  }
  const unchanged = same + merged.unchanged;
  if (work.size === 0 && added.length === 0) lines.push(t('phoneContacts.json.line.nothing'));
  else if (unchanged > 0) lines.push(t('phoneContacts.json.line.unchanged', { count: unchanged }));
  return { lines, warnings, work: [...work.values(), ...added] };
}
