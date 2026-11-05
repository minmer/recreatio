/**
 * 2026-10-29 — DIE EIGENEN ANGABEN ALS JSON ("recreatio/persons", Fassung 1): Vorname, Nachname, Telefon,
 * Geburtstag, Anschrift, E-Mail, Rufname der Personen, die das Konto selbst hält (`personsOf`, 0040).
 *
 * <b>Nur die eigenen, nur ändern.</b> Ein Eintrag braucht die Kennung einer dieser Personen; ohne sie, oder mit
 * einer fremden, geschieht nichts — eine Person entsteht mit zwei RSA-Paaren unter „Role", nicht aus einem
 * Dokument, und eine fremde Rolle ist nicht meine Angabe (der Dienst sagte ohnehin 403).
 *
 * <b>Versiegelt wie immer</b>: jedes Feld geht durch `setValue` (`person.ts`) — unter dem Rollenschlüssel, mit
 * seinem eigenen Etikett —, und dieselbe Stelle zieht die Abschriften in den Bereichen nach, denen das Feld schon
 * gegeben wurde. Der Plan nennt sie vorher.
 *
 * <b>Gelöscht wird nicht.</b> Löschen nimmt auch jede Freigabe zurück (`forgetValue`) — das bleibt ein Klick in
 * „Moje dane", mit dem Blick auf „Kto to dostał", und kein leeres Feld in einem Dokument.
 */

import { describe, keyLines, pretty, type JsonNode } from '../core/jsonTree';
import { t } from '../core/i18n';
import { FIELD_LABEL, PERSON_FIELDS, type PersonField } from './person';

export const PERSONS_FORMAT = 'recreatio/persons';
export const PERSONS_VERSION = 1;

/** Wie lang ein Wert höchstens sein darf — je Feld (die Anschrift ist eine Zeile, aber eine lange). */
export const MAX_LENGTH: Readonly<Record<PersonField, number>> = {
  given_name: 100, surname: 100, nickname: 100, phone: 40, born: 10, address: 300, email: 200
};

/* -- Die Sätze ----------------------------------------------------------------------------------------- */

/** Sätze, die erst beim Lesen übersetzt werden (Sprache der Anwendung zu diesem Zeitpunkt). */
const lazy = (entries: Readonly<Record<string, () => string>>): Readonly<Record<string, string>> => {
  const out: Record<string, string> = {};
  for (const [k, read] of Object.entries(entries)) Object.defineProperty(out, k, { get: read, enumerable: true });
  return out;
};

const TOP_KEYS: Readonly<Record<string, string>> = lazy({
  format: () => `"${PERSONS_FORMAT}"`,
  version: () => t('account.json.key.version', { version: PERSONS_VERSION }),
  persons: () => t('account.json.key.persons')
});

const FIELD_SAYS: Readonly<Record<string, () => string>> = Object.fromEntries(PERSON_FIELDS.map((field) => [
  field, () => t(`account.json.field.${field}`, { label: FIELD_LABEL[field], max: MAX_LENGTH[field] })
]));

const PERSON_KEYS: Readonly<Record<string, string>> = lazy({
  id: () => t('account.json.key.id'),
  name: () => t('account.json.key.name'),
  ...FIELD_SAYS,
  shared: () => t('account.json.key.shared')
});

/** Jeder Schlüssel als Pfad (`persons[].phone`) mit seinem Satz — für die Prüfung. */
export const PERSONS_KEYS: Readonly<Record<string, string>> = lazy({
  ...Object.fromEntries(Object.keys(TOP_KEYS).map((k) => [k, () => TOP_KEYS[k]])),
  ...Object.fromEntries(Object.keys(PERSON_KEYS).map((k) => [`persons[].${k}`, () => PERSON_KEYS[k]])),
  /* In "shared" heissen die Schlüssel wie die Felder — jedes kann dort stehen. */
  ...Object.fromEntries(PERSON_FIELDS.map((field) => [`persons[].shared.${field}`, () => t('account.json.key.sharedField', { label: FIELD_LABEL[field] })]))
});

const SAMPLE = {
  format: PERSONS_FORMAT,
  version: PERSONS_VERSION,
  persons: [{
    id: '0190a0a0-0000-7000-8000-0000000000b1',
    name: 'Anna',
    given_name: 'Anna',
    surname: 'Kowalska',
    phone: '+48 600 100 200',
    born: '1987-05-14',
    address: 'ul. Długa 5/3, 31-147 Kraków', // i18n-ignore
    email: 'anna.kowalska@example.pl',
    nickname: '',
    shared: { phone: ['Parafia św. Józefa'] } // i18n-ignore
  }]
};

/*
 * 2026-10-30 — WAS DIE APP MIT DEN ANGABEN TUT: versiegelt an der Rolle der Person (`person.ts`); der Name aus
 * Vor- und Nachname, sonst dem Rufnamen (`calledFrom`) — in den eigenen Rollen und unter neuen Nachrichten; ein
 * Bereich liest nur seine Abschrift (`namesInArea`); ein Bogen schreibt die genormten Fragen ab (`useFormCard`).
 */
export const PERSONS_USAGE_JSON: JsonNode = {
  key: 'persons.usage',
  get title() { return t('account.json.usageTitle'); },
  text: () => t('account.json.usage')
};

export const PERSONS_JSON: JsonNode = {
  key: 'persons',
  get title() { return t('account.json.title', { format: PERSONS_FORMAT, version: PERSONS_VERSION }); },
  get short() { return t('account.page.myData'); },
  text: () => t('account.json.text', { top: keyLines(TOP_KEYS), person: keyLines(PERSON_KEYS), sample: pretty(SAMPLE) }),
  inside: () => [PERSONS_USAGE_JSON],
  samples: () => [{ label: t('account.json.sampleLabel'), doc: () => SAMPLE }]
};

/** Die Beschreibung als Text — ohne Zusammenhang aufrufbar (MCP, `import-formats.mjs`). */
export const personsDescription = (): string => describe(PERSONS_JSON);

/* -- Export -------------------------------------------------------------------------------------------- */

/** Eine Person des Kontos, offen: ihre Angaben und wem welches Feld gegeben wurde. */
export interface PersonState {
  readonly roleId: string;
  readonly name: string | null;
  readonly values: ReadonlyMap<PersonField, string>;
  readonly releases: readonly { readonly field: PersonField; readonly areaName: string }[];
}

export function exportPersons(persons: readonly PersonState[]): Record<string, unknown> {
  return {
    format: PERSONS_FORMAT,
    version: PERSONS_VERSION,
    persons: persons.map((p) => {
      const shared: Record<string, string[]> = {};
      for (const r of p.releases) (shared[r.field] ??= []).push(r.areaName);
      return {
        id: p.roleId,
        ...(p.name === null ? {} : { name: p.name }),
        ...Object.fromEntries(PERSON_FIELDS.map((field) => [field, p.values.get(field) ?? ''])),
        ...(Object.keys(shared).length === 0 ? {} : { shared })
      };
    })
  };
}

/* -- Plan ---------------------------------------------------------------------------------------------- */

export interface PersonChange {
  readonly roleId: string;
  readonly person: string;
  readonly field: PersonField;
  readonly value: string;
  readonly was: string | null;
}

export interface PersonsPlan {
  readonly changes: readonly PersonChange[];
  readonly lines: readonly string[];
  readonly warnings: readonly string[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const described = (keys: Readonly<Record<string, string>>, key: string): boolean => Object.prototype.hasOwnProperty.call(keys, key);

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const PL_DAY = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;

/** Ein Tag, den es gibt (kein 30. Februar), zwischen 1900 und heute — als "RRRR-MM-DD". */
function dayOf(text: string, today: Date): string | null {
  const iso = ISO_DAY.exec(text);
  const pl = PL_DAY.exec(text);
  const [y, m, d] = iso !== null ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : pl !== null ? [Number(pl[3]), Number(pl[2]), Number(pl[1])] : [0, 0, 0];
  if (y < 1900) return null;
  const at = new Date(Date.UTC(y, m - 1, d));
  if (at.getUTCFullYear() !== y || at.getUTCMonth() !== m - 1 || at.getUTCDate() !== d) return null;
  if (at.getTime() > Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Ein Wert in seiner Gestalt — oder warum nicht. */
function valueOf(field: PersonField, raw: string, today: Date): { value: string } | { problem: string } {
  const text = field === 'address' ? raw.replace(/\s*[\r\n]+\s*/g, ', ').trim() : raw.trim();
  if (field === 'born') {
    const day = dayOf(text, today);
    return day === null ? { problem: t('account.json.problem.date') } : { value: day };
  }
  if (text.length > MAX_LENGTH[field]) return { problem: t('account.json.problem.long', { max: MAX_LENGTH[field] }) };
  if (field === 'phone' && (!/^[+()\d\s./-]+$/.test(text) || (text.match(/\d/g) ?? []).length < 6)) return { problem: t('account.json.problem.phone') };
  if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return { problem: t('account.json.problem.email') };
  if (/[\u0000-\u001f]/.test(text)) return { problem: t('account.json.problem.control') };
  return { value: text };
}

export function planPersons(doc: unknown, persons: readonly PersonState[], today = new Date()): PersonsPlan | { error: string } {
  if (!isObject(doc)) return { error: t('account.json.plan.notDoc') };
  if (doc.format !== undefined && doc.format !== PERSONS_FORMAT) return { error: t('account.json.plan.otherFormat', { format: String(doc.format), expected: PERSONS_FORMAT }) };
  if (!Array.isArray(doc.persons)) return { error: t('account.json.plan.noPersons') };

  const warnings: string[] = [];
  if (doc.version !== undefined && doc.version !== PERSONS_VERSION) warnings.push(t('account.json.plan.version', { version: String(doc.version), known: PERSONS_VERSION }));
  for (const key of Object.keys(doc)) if (!described(TOP_KEYS, key)) warnings.push(t('account.json.plan.unknownKey', { key }));

  const mine = new Map(persons.map((p) => [p.roleId, p]));
  const seen = new Set<string>();
  const changes: PersonChange[] = [];
  let same = 0;

  doc.persons.forEach((raw, i) => {
    const where = t('account.json.plan.person', { n: i + 1 });
    if (!isObject(raw)) { warnings.push(t('account.json.plan.notObject', { who: where })); return; }
    if (typeof raw.id !== 'string' || raw.id.trim() === '') { warnings.push(t('account.json.plan.noId', { who: where })); return; }
    const person = mine.get(raw.id.trim());
    if (person === undefined) { warnings.push(t('account.json.plan.notMine', { who: where })); return; }
    if (seen.has(person.roleId)) { warnings.push(t('account.json.plan.twice', { who: where })); return; }
    seen.add(person.roleId);
    const who = person.name ?? (typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : where);

    for (const key of Object.keys(raw)) if (!described(PERSON_KEYS, key)) warnings.push(t('account.json.plan.personUnknownKey', { who, key }));
    for (const field of PERSON_FIELDS) {
      if (!(field in raw)) continue;
      const given = raw[field];
      const was = person.values.get(field) ?? null;
      if (given === null || (typeof given === 'string' && given.trim() === '')) {
        if (was !== null) warnings.push(t('account.json.plan.emptyKeeps', { who, label: FIELD_LABEL[field], was }));
        continue;
      }
      if (typeof given !== 'string' && typeof given !== 'number') { warnings.push(t('account.json.plan.notText', { who, label: FIELD_LABEL[field] })); continue; }
      const read = valueOf(field, String(given), today);
      if ('problem' in read) {
        /* Was schon so dasteht (aus „Moje dane", frei getippt), ist keine Änderung — darüber wird nicht gewarnt. */
        if (String(given).trim() !== was) warnings.push(t('account.json.plan.problem', { who, label: FIELD_LABEL[field], problem: read.problem }));
        else same += 1;
        continue;
      }
      if (read.value === was || String(given).trim() === was) { same += 1; continue; }
      changes.push({ roleId: person.roleId, person: who, field, value: read.value, was });
    }
  });

  const lines: string[] = [];
  const byPerson = new Map<string, PersonChange[]>();
  for (const c of changes) byPerson.set(c.roleId, [...(byPerson.get(c.roleId) ?? []), c]);
  for (const list of byPerson.values()) {
    lines.push(`${list[0].person}: ${list.map((c) => (c.was === null
      ? t('account.json.plan.changeNew', { label: FIELD_LABEL[c.field], value: c.value })
      : t('account.json.plan.change', { label: FIELD_LABEL[c.field], was: c.was, value: c.value }))).join('; ')}`);
    const refreshed = new Set<string>();
    for (const c of list) for (const r of mine.get(c.roleId)!.releases) if (r.field === c.field) refreshed.add(`${r.areaName} (${FIELD_LABEL[c.field].toLowerCase()})`);
    if (refreshed.size > 0) lines.push(t('account.json.plan.refreshes', { list: [...refreshed].join(', ') }));
  }
  if (same > 0) lines.push(t('account.json.plan.same', { count: same }));
  if (changes.length === 0) lines.push(t('account.json.plan.nothing'));
  return { changes, lines, warnings };
}

/* -- Ausführen ------------------------------------------------------------------------------------------ */

/** `setValue` aus `person.ts` — versiegelt und zieht die Abschriften nach; hereingereicht, damit der Plan prüfbar bleibt. */
export type SetPersonValue = (roleId: string, field: PersonField, value: string) => Promise<{ readonly refreshed: readonly string[]; readonly couldNot: readonly string[] }>;

export async function applyPersons(plan: PersonsPlan, set: SetPersonValue, stage: (what: string) => void): Promise<{ lines: string[]; warnings: string[] }> {
  const warnings: string[] = [];
  const refreshed = new Set<string>();
  const couldNot = new Set<string>();
  let saved = 0;
  for (const [i, c] of plan.changes.entries()) {
    stage(t('account.json.apply.saving', { n: i + 1, total: plan.changes.length }));
    try {
      const done = await set(c.roleId, c.field, c.value);
      saved += 1;
      done.refreshed.forEach((one) => refreshed.add(one));
      done.couldNot.forEach((one) => couldNot.add(one));
    } catch (e) {
      warnings.push(t('account.json.apply.failed', { who: c.person, label: FIELD_LABEL[c.field], why: e instanceof Error && e.message !== '' ? e.message : t('account.json.apply.saveFailed') }));
    }
  }
  const lines = [t('account.json.apply.saved', { count: saved })];
  if (refreshed.size > 0) lines.push(t('account.json.apply.refreshed', { list: [...refreshed].join(', ') }));
  if (couldNot.size > 0) warnings.push(t('account.json.apply.notRefreshed', { list: [...couldNot].join(', ') }));
  return { lines, warnings };
}
