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

import { keyLines, pretty, type JsonNode } from '../core/jsonTree';
import { planImport, sameContact, tidyContact, type Contact, type ContactData, type ContactEmail, type ContactPhone } from './contactStore';

export const CONTACTS_FORMAT = 'recreatio/contacts';
export const CONTACTS_VERSION = 1;

/** Höchstens so viele Kontakte je Dokument — mehr ist eine Sicherung, kein Import zum Durchsehen. */
const MAX_CONTACTS = 5000;

const TOP_KEYS: Readonly<Record<string, string>> = {
  format: `"${CONTACTS_FORMAT}"`,
  version: `${CONTACTS_VERSION}`,
  contacts: 'lista kontaktów (niżej)'
};

const CONTACT_KEYS: Readonly<Record<string, string>> = {
  id: 'tylko przy poprawianiu wyeksportowanych kontaktów: ich "id" — wtedy kontakt jest zmieniany w miejscu; bez "id" kontakt jest szukany (to samo imię i nazwisko i wspólny numer) albo dodawany',
  name: 'jak kontakt jest podpisany (wymagane, chyba że są "given" albo "family" — wtedy powstaje z nich)',
  given: 'imię',
  family: 'nazwisko',
  org: 'firma, parafia, instytucja',
  title: 'funkcja albo stanowisko',
  phones: 'numery: ["+48 600 100 200"] albo [{ "number": "+48 600 100 200", "label": "komórka" }]; etykiety: komórka, dom, praca, główny (albo własna)',
  emails: 'adresy e-mail: ["anna@example.pl"] albo [{ "address": "anna@example.pl", "label": "praca" }]',
  note: 'notatka',
  birthday: 'data urodzenia "RRRR-MM-DD" (albo "--MM-DD", gdy bez roku)',
  groups: 'grupy, np. ["Rada parafialna", "Schola"] — po nich filtruje się listę; grupa może mieć własny numer do SMS'
};

const SAMPLE = {
  format: CONTACTS_FORMAT,
  version: CONTACTS_VERSION,
  contacts: [
    { name: 'Anna Kowalska', given: 'Anna', family: 'Kowalska', phones: [{ number: '+48 600 100 200', label: 'komórka' }], emails: ['anna.kowalska@example.pl'], groups: ['Schola'], birthday: '1987-05-14' },
    { name: 'ks. Marek Nowak', org: 'Parafia św. Jana', title: 'wikariusz', phones: ['+48 22 123 45 67'], note: 'dyżur w kancelarii we wtorki' }
  ]
};

export const CONTACTS_JSON: JsonNode = {
  key: 'contacts',
  title: `Kontakty jako JSON ("${CONTACTS_FORMAT}", wersja ${CONTACTS_VERSION})`,
  short: 'Kontakty',
  text: () => `Co robi import (Kontakty → „Więcej” → „Import i eksport (JSON)”):
- Kontakt z "id" z eksportu jest zmieniany w miejscu — tylko pola, które są w dokumencie; reszta zostaje.
- Kontakt bez "id" jest szukany wśród istniejących: ten sam podpis (imię i nazwisko) i wspólny numer — wtedy jest uzupełniany (nowe numery, adresy, grupy dochodzą; to, co już było, zostaje). Inaczej powstaje nowy.
- Niczego nie usuwa. Przed zapisem widać listę zmian i ostrzeżenia.
- Wszystko jest pieczętowane w tej przeglądarce — usługa widzi tylko, że kontakty są. W wydaniu „sms” telefon dostaje ich kopię przy następnym zapisie.
- Do telefonów i Google służy dalej vCard („Wczytaj vCard”, „Zapisz … jako vCard”); JSON jest do poprawek ręcznych i przez AI.
Zwróć JEDEN obiekt JSON, bez komentarzy, najwyżej ${MAX_CONTACTS} kontaktów.

Dokument:
${keyLines(TOP_KEYS)}

Kontakt (wpis w "contacts"):
${keyLines(CONTACT_KEYS)}

Przykład:
${pretty(SAMPLE)}`,
  samples: () => [{ label: 'Dwa kontakty', doc: () => SAMPLE }]
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
  if (!Array.isArray(v)) { warnings.push(`${where}: "phones" to nie lista — pominięte.`); return []; }
  const out: ContactPhone[] = [];
  for (const one of v) {
    if (typeof one === 'string' && one.trim() !== '') out.push({ number: one.trim(), label: null });
    else if (isObject(one) && textOf(one.number) !== null) out.push({ number: textOf(one.number)!, label: textOf(one.label) });
    else warnings.push(`${where}: nieczytelny numer ${JSON.stringify(one).slice(0, 60)} — pominięty.`);
  }
  return out;
}

function readEmails(v: unknown, where: string, warnings: string[]): ContactEmail[] {
  if (!Array.isArray(v)) { warnings.push(`${where}: "emails" to nie lista — pominięte.`); return []; }
  const out: ContactEmail[] = [];
  for (const one of v) {
    const address = typeof one === 'string' ? textOf(one) : isObject(one) ? textOf(one.address) : null;
    if (address !== null && address.includes('@')) out.push({ address, label: isObject(one) ? textOf(one.label) : null });
    else warnings.push(`${where}: nieczytelny adres ${JSON.stringify(one).slice(0, 60)} — pominięty.`);
  }
  return out;
}

function readContact(raw: unknown, at: number, warnings: string[]): Incoming | null {
  const where = `Kontakt ${at + 1}`;
  if (!isObject(raw)) { warnings.push(`${where}: to nie obiekt — pominięty.`); return null; }
  for (const key of Object.keys(raw)) if (!(key in CONTACT_KEYS)) warnings.push(`${where}: nieznany klucz "${key}" — pominięty.`);
  const given: { -readonly [K in keyof ContactData]?: ContactData[K] } = {};
  for (const key of ['name', 'given', 'family', 'org', 'title', 'note'] as const) {
    if (!(key in raw)) continue;
    if (raw[key] !== null && typeof raw[key] !== 'string') { warnings.push(`${where}: "${key}" to nie tekst — pominięte.`); continue; }
    given[key] = textOf(raw[key]) as never;
  }
  if ('birthday' in raw) {
    const b = textOf(raw.birthday);
    if (b !== null && !BIRTHDAY.test(b)) warnings.push(`${where}: data urodzenia „${b}” nie ma postaci RRRR-MM-DD — pominięta.`);
    else given.birthday = b;
  }
  if ('phones' in raw) given.phones = readPhones(raw.phones, where, warnings);
  if ('emails' in raw) given.emails = readEmails(raw.emails, where, warnings);
  if ('groups' in raw) {
    if (Array.isArray(raw.groups)) given.groups = raw.groups.filter((g): g is string => typeof g === 'string' && g.trim() !== '').map((g) => g.trim());
    else warnings.push(`${where}: "groups" to nie lista — pominięte.`);
  }
  const id = textOf(raw.id);
  const label = textOf(given.name) ?? ([given.given, given.family].filter(Boolean).join(' ') || null);
  if (id === null && label === null) { warnings.push(`${where}: bez "name" (ani imienia i nazwiska) — pominięty.`); return null; }
  return { id, given, label: label ?? '(bez zmiany podpisu)' };
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
  if (!isObject(doc)) return { error: 'To nie jest dokument JSON (obiekt).' };
  if (doc.format !== undefined && doc.format !== CONTACTS_FORMAT) return { error: `To nie są kontakty: "format" to "${String(doc.format)}", a powinien być "${CONTACTS_FORMAT}".` };
  if (!Array.isArray(doc.contacts)) return { error: 'Brak listy "contacts".' };
  const warnings: string[] = [];
  for (const key of Object.keys(doc)) if (!(key in TOP_KEYS)) warnings.push(`Nieznany klucz "${key}" — pominięty.`);
  if (doc.contacts.length > MAX_CONTACTS) warnings.push(`Dokument ma ${doc.contacts.length} kontaktów — wzięto pierwsze ${MAX_CONTACTS}.`);

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
        warnings.push(`Kontakt „${one.label}”: nie ma kontaktu o tym "id" — zostanie dodany jako nowy.`);
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
    lines.push(`Zmiana: „${c.name}”`);
  }
  for (const w of merged.work) {
    if (w.id === null) { added.push({ id: null, data: w.data, version: 0 }); lines.push(`Nowy: „${w.data.name}”`); continue; }
    if (!work.has(w.id)) lines.push(`Uzupełniony: „${w.data.name}”`);
    work.set(w.id, { id: w.id, data: w.data, version: byId.get(w.id)?.version ?? w.version });
  }
  const unchanged = same + merged.unchanged;
  if (work.size === 0 && added.length === 0) lines.push('Bez zmian — wszystko jest już w kontaktach.');
  else if (unchanged > 0) lines.push(`Bez zmian: ${unchanged}.`);
  return { lines, warnings, work: [...work.values(), ...added] };
}
