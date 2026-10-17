/**
 * DIE KONTAKTE — im eigenen Bereich, jeder als EINE Hülle (0114,
 * `/workspace/phone/<bereich>/contacts`). Der Dienst sieht nur, dass es sie gibt.
 *
 * <code>
 *   aus dem Telefon      einlesen (`importContacts`): neue dazu, bekannte ergänzt
 *   aus einer vCard      dasselbe (Google, ein anderes Telefon)
 *   ins Telefon          `toPhone`: die Kontakte ins Adressbuch des Telefons
 *                        (Konto „REcreatio") — dort findet sie der Anruf
 * </code>
 *
 * Bearbeitet wird hier, im Netz; das Telefon ist eine Abschrift für schnelles
 * Nachschlagen und bekommt Änderungen beim nächsten Abgleich.
 */

import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from '../core/crypto';
import { newId } from '../core/ids';
import { call, WorkspaceError } from '../core/session';
import type { PhoneBookContact, PhoneSource, WrittenContact } from './native';
import { phoneKey, phoneShown } from './numbers';
import type { PhoneCtx } from './phoneContext';
import type { CardData } from './vcard';

export interface ContactPhone {
  readonly number: string;
  readonly label: string | null;
}

export interface ContactEmail {
  readonly address: string;
  readonly label: string | null;
}

/** Woher ein Kontakt kam — `key`: der Schlüssel des Telefons (Lookup-Key), damit ein zweites Einlesen ihn wiederfindet. */
export interface ContactSource {
  readonly kind: 'phone' | 'vcard' | 'web';
  readonly key: string | null;
}

export interface ContactData extends CardData {
  readonly phones: readonly ContactPhone[];
  readonly emails: readonly ContactEmail[];
  readonly source: ContactSource | null;
}

export interface Contact extends ContactData {
  readonly id: string;
  readonly version: number;
  readonly updatedAt: string;
}

interface ContactRow {
  readonly contactId: string;
  readonly epoch: number;
  readonly sealed: string | null;
  readonly version: number;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

const contactAad = (id: string) => aad('phone', 'contact', id, Field.PhoneContact, 1);
const base = (ctx: PhoneCtx) => `/workspace/phone/${encodeURIComponent(ctx.areaId)}`;

export const PHONE_LABELS = ['komórka', 'dom', 'praca', 'główny'] as const;

const text = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
};

/** Aufgeräumt: Leeres weg, Nummern in der gewohnten Form, keine doppelten. */
export function tidyContact(d: ContactData): ContactData {
  const phones: ContactPhone[] = [];
  for (const p of d.phones) {
    const number = text(p.number);
    if (number === null || phones.some((x) => phoneKey(x.number) === phoneKey(number))) continue;
    phones.push({ number: phoneShown(number), label: text(p.label) });
  }
  const emails: ContactEmail[] = [];
  for (const e of d.emails) {
    const address = text(e.address);
    if (address === null || emails.some((x) => x.address.toLowerCase() === address.toLowerCase())) continue;
    emails.push({ address, label: text(e.label) });
  }
  const groups = [...new Set(d.groups.map((g) => g.trim()).filter((g) => g !== ''))];
  const given = text(d.given);
  const family = text(d.family);
  const name = text(d.name) ?? text([given, family].filter(Boolean).join(' ')) ?? phones[0]?.number ?? emails[0]?.address ?? 'Bez nazwy';
  return {
    name, given, family, org: text(d.org), title: text(d.title), phones, emails,
    note: text(d.note), birthday: text(d.birthday), groups, source: d.source
  };
}

/** Was in die Hülle kommt — ohne Kennung und Fassung (die stehen neben ihr). */
const sealedJson = (d: ContactData): string => JSON.stringify({ v: 1, ...tidyContact(d) });

function readData(json: string): ContactData {
  const o = JSON.parse(json) as Record<string, unknown>;
  const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const source = o.source !== null && typeof o.source === 'object' ? o.source as Record<string, unknown> : null;
  return tidyContact({
    name: String(o.name ?? ''),
    given: text(o.given), family: text(o.family), org: text(o.org), title: text(o.title),
    phones: list<ContactPhone>(o.phones).map((p) => ({ number: String(p?.number ?? ''), label: text(p?.label) })),
    emails: list<ContactEmail>(o.emails).map((e) => ({ address: String(e?.address ?? ''), label: text(e?.label) })),
    note: text(o.note), birthday: text(o.birthday),
    groups: list<string>(o.groups).map(String),
    source: source === null ? null : { kind: source.kind === 'phone' || source.kind === 'vcard' ? source.kind : 'web', key: text(source.key) }
  });
}

/** Gleich, soweit es zählt (die Herkunft zählt nicht). */
export const sameContact = (a: ContactData, b: ContactData): boolean =>
  JSON.stringify({ ...tidyContact(a), source: null }) === JSON.stringify({ ...tidyContact(b), source: null });

const collator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true });

/** Alle Kontakte, geöffnet, nach dem Namen. */
export async function loadContacts(ctx: PhoneCtx): Promise<Contact[]> {
  const { contacts } = await call<{ now: string; contacts: readonly ContactRow[] }>(`${base(ctx)}/contacts`);
  const out: Contact[] = [];
  for (const row of contacts) {
    if (row.sealed === null) continue;
    const key = ctx.keys.get(row.epoch);
    if (key === undefined) continue;
    try {
      const data = readData(await openText(key, contactAad(row.contactId), fromBase64Url(row.sealed)));
      out.push({ ...data, id: row.contactId, version: row.version, updatedAt: row.updatedAt });
    } catch {
      // Eine Hülle, die nicht aufgeht, hält die anderen nicht auf.
    }
  }
  return out.sort((a, b) => collator.compare(a.name, b.name));
}

/** Einen Kontakt speichern — neu (`id` null) oder geändert (auf dem Stand `version`). */
export async function saveContact(ctx: PhoneCtx, id: string | null, data: ContactData, version: number): Promise<Contact> {
  const contactId = id ?? newId();
  const tidy = tidyContact(data);
  const sealed = toBase64Url(await sealText(ctx.newest.key, contactAad(contactId), sealedJson(tidy)));
  const saved = await call<{ version: number; updatedAt: string }>(`${base(ctx)}/contact/${encodeURIComponent(contactId)}`, {
    method: 'PUT', body: JSON.stringify({ epoch: ctx.newest.epoch, sealed, version })
  });
  return { ...tidy, id: contactId, version: saved.version, updatedAt: saved.updatedAt };
}

export const removeContact = (ctx: PhoneCtx, id: string): Promise<{ deleted: boolean }> =>
  call(`${base(ctx)}/contact/${encodeURIComponent(id)}`, { method: 'DELETE' });

/** Viele auf einmal — in Paketen zu 200 (das Einlesen aus dem Telefon). */
export async function saveContactsMany(
  ctx: PhoneCtx, list: readonly { readonly id: string | null; readonly data: ContactData; readonly version: number }[],
  onProgress?: (done: number) => void
): Promise<{ saved: number; failed: number }> {
  let saved = 0;
  let failed = 0;
  for (let at = 0; at < list.length; at += 200) {
    const chunk = list.slice(at, at + 200);
    const contacts = [];
    for (const one of chunk) {
      const contactId = one.id ?? newId();
      contacts.push({
        contactId, epoch: ctx.newest.epoch, version: one.version,
        sealed: toBase64Url(await sealText(ctx.newest.key, contactAad(contactId), sealedJson(one.data)))
      });
    }
    const { results } = await call<{ results: readonly { error: string | null }[] }>(`${base(ctx)}/contacts`, {
      method: 'POST', body: JSON.stringify({ contacts })
    });
    for (const r of results) if (r.error === null || r.error === undefined) saved++; else failed++;
    onProgress?.(Math.min(list.length, at + chunk.length));
  }
  return { saved, failed };
}

/* -- Aus dem Telefon, aus einer vCard ------------------------------------------------------- */

export const fromPhoneBook = (p: PhoneBookContact): ContactData => tidyContact({
  name: p.name, given: p.given, family: p.family, org: p.org, title: p.title,
  phones: p.phones, emails: p.emails, note: p.note, birthday: p.birthday, groups: p.groups,
  source: { kind: 'phone', key: p.lookupKey }
});

export const fromCard = (c: CardData): ContactData => tidyContact({ ...c, source: { kind: 'vcard', key: null } });

const nameKey = (name: string) => name.toLocaleLowerCase('pl').replace(/\s+/g, ' ').trim();

/** Zwei Stände desselben Menschen zusammen — was neu ist, kommt dazu; was schon da war, bleibt. Der Schlüssel des Telefons wird übernommen, wenn es noch keinen gab. */
function merged(had: ContactData, incoming: ContactData): ContactData {
  return tidyContact({
    name: had.name,
    given: had.given ?? incoming.given,
    family: had.family ?? incoming.family,
    org: had.org ?? incoming.org,
    title: had.title ?? incoming.title,
    phones: [...had.phones, ...incoming.phones],
    emails: [...had.emails, ...incoming.emails],
    note: had.note ?? incoming.note,
    birthday: had.birthday ?? incoming.birthday,
    groups: [...had.groups, ...incoming.groups],
    source: had.source?.key ? had.source : incoming.source?.key ? incoming.source : had.source ?? incoming.source
  });
}

export interface ImportPlan {
  readonly work: readonly { readonly id: string | null; readonly data: ContactData; readonly version: number }[];
  readonly added: number;
  readonly updated: number;
  readonly unchanged: number;
}

/**
 * EINLESEN: wer schon da ist (gleicher Schlüssel des Telefons, oder gleicher
 * Name mit einer gemeinsamen Nummer), wird ergänzt; wer neu ist, kommt dazu.
 * Gelöscht wird nichts — was im Netz steht, bleibt.
 */
export async function importContacts(
  ctx: PhoneCtx, incoming: readonly ContactData[], existing: readonly Contact[], onProgress?: (done: number, total: number) => void
): Promise<{ added: number; updated: number; unchanged: number; failed: number }> {
  const { work, added, updated, unchanged } = planImport(incoming, existing);
  const { failed } = await saveContactsMany(ctx, work, (done) => onProgress?.(done, work.length));
  return { added, updated, unchanged, failed };
}

/**
 * Was ein Einlesen schreiben würde — ohne zu schreiben.
 *
 * <b>Eine gemeinsame Nummer allein genügt nicht:</b> das Festnetz einer Familie
 * gehört mehreren. Zwei verschiedene Menschen in einen zu legen wäre schlimmer
 * als einer doppelt — den löscht man mit einem Griff.
 *
 * Wer in DIESEM Lauf neu ist, wird wie ein bekannter behandelt: kennt das
 * Telefon jemanden zweimal, entsteht er nur einmal.
 */
export function planImport(incoming: readonly ContactData[], existing: readonly Contact[]): ImportPlan {
  interface Slot { data: ContactData; readonly id: string | null; readonly version: number; readonly before: ContactData | null }
  const slots: Slot[] = existing.map((c) => ({ data: c, id: c.id, version: c.version, before: c }));
  const byKey = new Map<string, Slot>();
  const byPhone = new Map<string, Slot[]>();
  const remember = (slot: Slot) => {
    if (slot.data.source?.key) byKey.set(slot.data.source.key, slot);
    for (const p of slot.data.phones) {
      const k = phoneKey(p.number);
      const known = byPhone.get(k) ?? [];
      if (k !== '' && !known.includes(slot)) byPhone.set(k, [...known, slot]);
    }
  };
  slots.forEach(remember);

  let unchanged = 0;
  for (const data of incoming) {
    let slot = data.source?.key ? byKey.get(data.source.key) : undefined;
    if (slot === undefined) {
      const name = nameKey(data.name);
      for (const p of data.phones) {
        slot = (byPhone.get(phoneKey(p.number)) ?? []).find((s) => nameKey(s.data.name) === name);
        if (slot !== undefined) break;
      }
    }
    if (slot === undefined) {
      const fresh: Slot = { data, id: null, version: 0, before: null };
      slots.push(fresh);
      remember(fresh);
      continue;
    }
    const next = merged(slot.data, data);
    if (sameContact(next, slot.data) && (next.source?.key ?? null) === (slot.data.source?.key ?? null)) { unchanged++; continue; }
    slot.data = next;
    remember(slot);
  }

  const work: { id: string | null; data: ContactData; version: number }[] = [];
  let added = 0;
  let updated = 0;
  for (const s of slots) {
    if (s.before === null) { work.push({ id: null, data: s.data, version: 0 }); added++; }
    else if (s.data !== s.before) { work.push({ id: s.id, data: s.data, version: s.version }); updated++; }
  }
  return { work, added, updated, unchanged };
}

/* -- Ins Telefon ----------------------------------------------------------------------------- */

export const toWritten = (c: Contact): WrittenContact => ({
  id: c.id, version: c.version, name: c.name, given: c.given, family: c.family, org: c.org, title: c.title,
  phones: c.phones, emails: c.emails, note: c.note, birthday: c.birthday
});

/** Alle Kontakte ins Adressbuch des Telefons (Konto „REcreatio"); geschrieben wird nur, was sich geändert hat. */
export async function toPhone(ctx: PhoneCtx, source: PhoneSource, list?: readonly Contact[]): Promise<{ added: number; updated: number; removed: number; total: number }> {
  const contacts = list ?? await loadContacts(ctx);
  return source.writeContacts({ contacts: contacts.map(toWritten) });
}

/** Passt ein Kontakt zur Suche? Name, Nummer (ohne Leerzeichen), Organisation, Gruppen, E-Mail. */
export function contactMatches(c: ContactData, query: string): boolean {
  const q = query.trim().toLocaleLowerCase('pl');
  if (q === '') return true;
  const digits = q.replace(/[^\d+]/g, '');
  if (digits.length >= 3 && c.phones.some((p) => phoneKey(p.number).includes(digits) || p.number.replace(/\D/g, '').includes(digits.replace(/\D/g, '')))) return true;
  return [c.name, c.org ?? '', c.title ?? '', ...c.groups, ...c.emails.map((e) => e.address)]
    .some((field) => field.toLocaleLowerCase('pl').includes(q));
}

/** Wer zu einer Nummer gehört — für die Gespräche im Archiv (im Browser ohne das Adressbuch des Telefons). */
export function nameIndex(contacts: readonly Contact[]): Map<string, Contact> {
  const out = new Map<string, Contact>();
  for (const c of contacts) for (const p of c.phones) {
    const k = phoneKey(p.number);
    if (k !== '' && !out.has(k)) out.set(k, c);
  }
  return out;
}

export function emptyContact(): ContactData {
  return { name: '', given: null, family: null, org: null, title: null, phones: [{ number: '', label: 'komórka' }], emails: [], note: null, birthday: null, groups: [], source: { kind: 'web', key: null } };
}

/** Ein verständlicher Fehler beim Speichern („stale": jemand anderes war schneller). */
export function saveProblem(e: unknown): string {
  if (e instanceof WorkspaceError) return e.verdict === 'stale' ? 'Ktoś zmienił ten kontakt w międzyczasie — wczytaj go ponownie.' : e.message;
  return 'Nie udało się zapisać kontaktu.';
}
