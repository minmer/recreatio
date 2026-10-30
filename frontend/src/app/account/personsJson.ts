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
import { plural } from '../core/plural';
import { FIELD_LABEL, PERSON_FIELDS, type PersonField } from './person';

export const PERSONS_FORMAT = 'recreatio/persons';
export const PERSONS_VERSION = 1;

/** Wie lang ein Wert höchstens sein darf — je Feld (die Anschrift ist eine Zeile, aber eine lange). */
export const MAX_LENGTH: Readonly<Record<PersonField, number>> = {
  given_name: 100, surname: 100, nickname: 100, phone: 40, born: 10, address: 300, email: 200
};

/* -- Die Sätze ----------------------------------------------------------------------------------------- */

const TOP_KEYS: Readonly<Record<string, string>> = {
  format: `"${PERSONS_FORMAT}"`,
  version: `${PERSONS_VERSION} — wersja formatu`,
  persons: 'osoby tego konta (niżej) — zwykle jedna: Ty'
};

const FIELD_SAYS: Readonly<Record<PersonField, string>> = {
  given_name: `${FIELD_LABEL.given_name} (do ${MAX_LENGTH.given_name} znaków)`,
  surname: `${FIELD_LABEL.surname} (do ${MAX_LENGTH.surname} znaków)`,
  phone: `${FIELD_LABEL.phone}: cyfry, spacje, "+", "-", "(", ")" — co najmniej 6 cyfr (do ${MAX_LENGTH.phone} znaków)`,
  born: `${FIELD_LABEL.born}: "RRRR-MM-DD" (także "DD.MM.RRRR" — zapisze się jako "RRRR-MM-DD"); formularze wpisują ją w pole daty`,
  address: `${FIELD_LABEL.address} w jednej linii, np. "ul. Długa 5/3, 31-147 Kraków" (do ${MAX_LENGTH.address} znaków)`,
  email: `${FIELD_LABEL.email}: jeden adres "nazwa@domena.pl" (do ${MAX_LENGTH.email} znaków)`,
  nickname: `${FIELD_LABEL.nickname} — jak wołają na Ciebie (do ${MAX_LENGTH.nickname} znaków)`
};

const PERSON_KEYS: Readonly<Record<string, string>> = {
  id: 'identyfikator osoby z eksportu (wymagany) — po nim import wie, czyje dane zmienia; tylko osoby tego konta',
  name: 'tylko informacja z eksportu: nazwa osoby (rola) — import jej nie zmienia',
  ...FIELD_SAYS,
  shared: 'tylko informacja z eksportu: komu udostępniono które pole, np. {"phone": ["Parafia św. Józefa"]} — udostępnia się i wycofuje w „Moje dane”'
};

/** Jeder Schlüssel als Pfad (`persons[].phone`) mit seinem Satz — für die Prüfung. */
export const PERSONS_KEYS: Readonly<Record<string, string>> = {
  ...TOP_KEYS,
  ...Object.fromEntries(Object.entries(PERSON_KEYS).map(([k, v]) => [`persons[].${k}`, v])),
  /* In "shared" heissen die Schlüssel wie die Felder — jedes kann dort stehen. */
  ...Object.fromEntries(PERSON_FIELDS.map((field) => [`persons[].shared.${field}`, `komu udostępniono pole „${FIELD_LABEL[field]}” — nazwy obszarów`]))
};

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
    address: 'ul. Długa 5/3, 31-147 Kraków',
    email: 'anna.kowalska@example.pl',
    nickname: '',
    shared: { phone: ['Parafia św. Józefa'] }
  }]
};

/*
 * 2026-10-30 — WAS DIE APP MIT DEN ANGABEN TUT: versiegelt an der Rolle der Person (`person.ts`); der Name aus
 * Vor- und Nachname, sonst dem Rufnamen (`calledFrom`) — in den eigenen Rollen und unter neuen Nachrichten; ein
 * Bereich liest nur seine Abschrift (`namesInArea`); ein Bogen schreibt die genormten Fragen ab (`useFormCard`).
 */
export const PERSONS_USAGE_JSON: JsonNode = {
  key: 'persons.usage',
  title: 'Jak aplikacja używa tych danych',
  text: () => `- Dane leżą przy roli osoby, każde pole osobno, zapieczętowane jej kluczem: otwiera je tylko ten, kto ma klucz tej osoby (zwykle tylko Ty). Usługa wie tylko, które pola są wypełnione.
- Imię i nazwisko (a gdy ich brak — przezwisko) to nazwa osoby w aplikacji: tak nazywają ją Twoje role i listy, i tak podpisane są wiadomości, które wysyłasz w rozmowach.
- Obszar dostaje pole tylko wtedy, gdy mu je udostępnisz („Moje dane”): kopia jest zapieczętowana kluczem obszaru i czyta ją każdy, kto ma do niego dostęp — np. lista osób obszaru bierze z niej imię i nazwisko.
- Formularz wypełniany za tę osobę sam wpisuje odpowiedzi na pytania o imię, nazwisko, telefon, datę urodzenia, adres, e-mail i przezwisko. Zgłoszeń już wysłanych import nie zmienia.
- Udostępnienie cofa się w „Moje dane” („Kto to dostał”): obszar traci kopię, ale tego, co ktoś już przeczytał, nie da się cofnąć.`
};

export const PERSONS_JSON: JsonNode = {
  key: 'persons',
  title: `Moje dane jako JSON ("${PERSONS_FORMAT}", wersja ${PERSONS_VERSION})`,
  short: 'Moje dane',
  text: () => `Dane osób, które prowadzi to konto: imię, nazwisko, telefon, data urodzenia, adres, e-mail, przezwisko (Konto, #/workspace/account → pod „Moje dane” → „Moje dane jako JSON”). Każde pole jest zapieczętowane w przeglądarce osobno — kluczem osoby — i udostępniane osobno.
Co robi import:
- Najpierw pokazuje plan zmian; zapisuje dopiero po „Importuj”.
- Zmienia tylko pola osób tego konta, wskazanych przez "id" z eksportu. Osoby bez "id" albo z cudzym "id" pomija (ostrzeżenie) — nie zakłada osób ani kont i nigdy nie zmienia danych kogoś innego.
- Pole z nową wartością zapisuje; ta sama wartość — bez zmian. Zmiana odświeża też kopie w obszarach, którym to pole już udostępniono (plan je wymienia); nowym obszarom niczego nie udostępnia.
- Pusty tekst ("") i null nie usuwają: pole zostaje, jakie było (usuwa się je w „Moje dane”, razem z udostępnieniami).
- Wartość w złym kształcie (np. data, e-mail, telefon) — ostrzeżenie, pole pominięte.
Zwróć JEDEN obiekt JSON, bez komentarzy.

Dokument:
${keyLines(TOP_KEYS)}

Osoba (wpis w "persons"):
${keyLines(PERSON_KEYS)}

Przykład:
${pretty(SAMPLE)}`,
  inside: () => [PERSONS_USAGE_JSON],
  samples: () => [{ label: 'Moje dane (jedna osoba)', doc: () => SAMPLE }]
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
    return day === null ? { problem: 'to nie data "RRRR-MM-DD" (od 1900 do dziś)' } : { value: day };
  }
  if (text.length > MAX_LENGTH[field]) return { problem: `dłuższe niż ${MAX_LENGTH[field]} znaków` };
  if (field === 'phone' && (!/^[+()\d\s./-]+$/.test(text) || (text.match(/\d/g) ?? []).length < 6)) return { problem: 'to nie numer telefonu (cyfry, spacje, + - ( ), co najmniej 6 cyfr)' };
  if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return { problem: 'to nie adres e-mail' };
  if (/[\u0000-\u001f]/.test(text)) return { problem: 'zawiera znaki sterujące' };
  return { value: text };
}

export function planPersons(doc: unknown, persons: readonly PersonState[], today = new Date()): PersonsPlan | { error: string } {
  if (!isObject(doc)) return { error: 'To nie jest dokument z danymi osób (oczekiwano obiektu JSON).' };
  if (doc.format !== undefined && doc.format !== PERSONS_FORMAT) return { error: `Inny format: "${String(doc.format)}" — oczekiwano "${PERSONS_FORMAT}".` };
  if (!Array.isArray(doc.persons)) return { error: 'Brakuje listy "persons".' };

  const warnings: string[] = [];
  if (doc.version !== undefined && doc.version !== PERSONS_VERSION) warnings.push(`Wersja ${String(doc.version)} — znam wersję ${PERSONS_VERSION}; czytam to, co rozpoznaję.`);
  for (const key of Object.keys(doc)) if (!described(TOP_KEYS, key)) warnings.push(`Nieznany klucz "${key}" — pominięty.`);

  const mine = new Map(persons.map((p) => [p.roleId, p]));
  const seen = new Set<string>();
  const changes: PersonChange[] = [];
  let same = 0;

  doc.persons.forEach((raw, i) => {
    const where = `Osoba ${i + 1}`;
    if (!isObject(raw)) { warnings.push(`${where}: to nie obiekt — pominięta.`); return; }
    if (typeof raw.id !== 'string' || raw.id.trim() === '') { warnings.push(`${where}: bez "id" — import nie zakłada osób (osobę zakłada się w „Role”). Pominięta.`); return; }
    const person = mine.get(raw.id.trim());
    if (person === undefined) { warnings.push(`${where}: to nie jest osoba tego konta — pominięta (cudzych danych import nie zmienia).`); return; }
    if (seen.has(person.roleId)) { warnings.push(`${where}: ta sama osoba drugi raz — pominięta.`); return; }
    seen.add(person.roleId);
    const who = person.name ?? (typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : where);

    for (const key of Object.keys(raw)) if (!described(PERSON_KEYS, key)) warnings.push(`${who}: nieznany klucz "${key}" — pominięty.`);
    for (const field of PERSON_FIELDS) {
      if (!(field in raw)) continue;
      const given = raw[field];
      const was = person.values.get(field) ?? null;
      if (given === null || (typeof given === 'string' && given.trim() === '')) {
        if (was !== null) warnings.push(`${who}: „${FIELD_LABEL[field]}” puste — pustą wartością pola się nie usuwa (zostaje „${was}”; usuwa się je w „Moje dane”).`);
        continue;
      }
      if (typeof given !== 'string' && typeof given !== 'number') { warnings.push(`${who}: „${FIELD_LABEL[field]}” to nie tekst — pominięte.`); continue; }
      const read = valueOf(field, String(given), today);
      if ('problem' in read) {
        /* Was schon so dasteht (aus „Moje dane", frei getippt), ist keine Änderung — darüber wird nicht gewarnt. */
        if (String(given).trim() !== was) warnings.push(`${who}: „${FIELD_LABEL[field]}” — ${read.problem}; pominięte.`);
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
    lines.push(`${list[0].person}: ${list.map((c) => `${FIELD_LABEL[c.field]} ${c.was === null ? '(nowe)' : `„${c.was}” →`} „${c.value}”`).join('; ')}`);
    const refreshed = new Set<string>();
    for (const c of list) for (const r of mine.get(c.roleId)!.releases) if (r.field === c.field) refreshed.add(`${r.areaName} (${FIELD_LABEL[c.field].toLowerCase()})`);
    if (refreshed.size > 0) lines.push(`Zmiana odświeży też kopie udostępnione: ${[...refreshed].join(', ')}`);
  }
  if (same > 0) lines.push(`Bez zmian: ${same} ${plural(same, 'pole', 'pola', 'pól')}`);
  if (changes.length === 0) lines.push('Nic do zmiany.');
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
    stage(`Zapisywanie ${i + 1} z ${plan.changes.length}…`);
    try {
      const done = await set(c.roleId, c.field, c.value);
      saved += 1;
      done.refreshed.forEach((one) => refreshed.add(one));
      done.couldNot.forEach((one) => couldNot.add(one));
    } catch (e) {
      warnings.push(`${c.person}: „${FIELD_LABEL[c.field]}” — ${e instanceof Error && e.message !== '' ? e.message : 'nie udało się zapisać'}`);
    }
  }
  const lines = [`Zapisane pola: ${saved}`];
  if (refreshed.size > 0) lines.push(`Odświeżone kopie w: ${[...refreshed].join(', ')}`);
  if (couldNot.size > 0) warnings.push(`Nie udało się odświeżyć kopii w: ${[...couldNot].join(', ')} — udostępnij tam pole ponownie w „Moje dane”.`);
  return { lines, warnings };
}
