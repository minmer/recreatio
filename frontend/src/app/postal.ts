/**
 * ADRESY (0071) — eine Adresse aus Teilen, das Verzeichnis eines Gebiets,
 * die Haushalte darin (Kolęda).
 *
 * <code>
 *   postcode   31-147            Kod pocztowy
 *   post       Kraków            Poczta
 *   locality   Zawoja            Miejscowość (Stadt oder Dorf)
 *   district   Grzegórzki        Dzielnica / osiedle
 *   street     Długa             Ulica (ohne „ul.")
 *   house      5A                Numer domu
 *   unit       3                 Numer mieszkania
 * </code>
 *
 * <b>Jeder Teil steht für sich.</b> Fehlt einer, fehlt nur er; verglichen
 * wird über die NORMALISIERTEN Teile (`norm`) — dieselbe Funktion wie im
 * Dienst (`Postal.Norm`), geprüft mit derselben Tabelle
 * (`app-platform-check.mjs`, `PostalChecks.cs`).
 *
 * <b>Ohne Ort gilt der Ort der Post</b> (`complete`): „ul. Długa 5, 31-147
 * Kraków" liegt in Kraków.
 *
 * <b>Die Menschen</b> (ein Haushalt: Familie, Personen, Kontakt, Kolęda Jahr
 * für Jahr) liegen als EIN Dokument versiegelt unter dem Schlüssel des
 * Bereichs; der Dienst sieht nur, DASS an einem Ort ein Haushalt ist.
 */

import { areaKeys, newestKey } from './chat';
import { aad, Field, fromBase64Url, openText, sealText, toBase64Url } from './crypto';
import { newId } from './ids';
import type { Ring } from './keys';
import { call, WorkspaceError } from './session';

export type PartKind = 'postcode' | 'post' | 'locality' | 'district' | 'street';

export interface Address {
  readonly postcode: string;
  readonly post: string;
  readonly locality: string;
  readonly district: string;
  readonly street: string;
  readonly house: string;
  readonly unit: string;
}

export const EMPTY_ADDRESS: Address = { postcode: '', post: '', locality: '', district: '', street: '', house: '', unit: '' };

export const PART_LABEL: Record<keyof Address, string> = {
  postcode: 'Kod pocztowy',
  post: 'Poczta',
  locality: 'Miejscowość',
  district: 'Dzielnica / osiedle',
  street: 'Ulica',
  house: 'Nr domu',
  unit: 'Nr mieszkania'
};

/* -- Normalisieren (wie Postal.Norm im Dienst) ---------------------------------------------- */

const STREET_PREFIX = /^(ul\.?|ulica|al\.?|aleja|aleje|pl\.?|plac|os\.?|osiedle|skwer|rondo|bulw\.?|bulwar)\s+/i;
const PLAIN_STREET_PREFIX = /^(ul\.?|ulica)\s+/i;
const collapse = (text: string | null | undefined) => (text ?? '').trim().replace(/\s+/g, ' ');

/** Die normalisierte Form eines Teils — klein, ohne Diakritika, ohne Satzzeichen; Straße ohne Vorsatz; Postleitzahl „NN-NNN". */
export function norm(kind: PartKind | 'house' | 'unit', text: string | null | undefined): string {
  let raw = collapse(text);
  if (raw === '') return '';

  if (kind === 'postcode') {
    const m = /^(\d{2})-?(\d{3})$/.exec(raw.replace(/ /g, ''));
    return m === null ? '' : `${m[1]}-${m[2]}`;
  }
  if (kind === 'street') raw = raw.replace(STREET_PREFIX, '');
  if (kind === 'house' || kind === 'unit') return raw.replace(/ /g, '').toUpperCase();

  const folded = raw.toLowerCase().replace(/ł/g, 'l').normalize('NFD');
  let out = '';
  for (const ch of folded) {
    if (/\p{Mn}/u.test(ch)) continue;
    out += /[\p{L}\p{N}]/u.test(ch) ? ch : ' ';
  }
  return out.replace(/ +/g, ' ').trim();
}

/** Wie ein Teil angezeigt wird: wie getippt; „ul." fällt weg (die Straße ist die Regel). */
export function display(kind: PartKind | 'house' | 'unit', text: string | null | undefined): string {
  let raw = collapse(text);
  if (kind === 'postcode') return norm('postcode', raw) || raw;
  if (kind === 'street') raw = raw.replace(PLAIN_STREET_PREFIX, '');
  if (kind === 'house' || kind === 'unit') return raw.replace(/ /g, '').toUpperCase();
  return raw.slice(0, 200);
}

/** Ohne Ort: der Ort der Post. */
export const complete = (a: Address): Address =>
  a.locality.trim() === '' && a.post.trim() !== '' ? { ...a, locality: a.post } : a;

/** Die ganze Adresse normalisiert — wie `Postal.Key`; dieselbe Adresse gibt es im Gebiet nur einmal. */
export function keyOf(a: Address): string {
  const c = complete(a);
  return [norm('postcode', c.postcode), norm('post', c.post), norm('locality', c.locality), norm('district', c.district),
    norm('street', c.street), norm('house', c.house), norm('unit', c.unit)].join('|');
}

export const isEmpty = (a: Address): boolean => keyOf(a).replace(/\|/g, '') === '';

/* -- Lesen und Schreiben einer Adresse als Zeile -------------------------------------------- */

/** Ist ein Name eher ein Straßen-Vorsatz-Wort? Dann gehört der Abschnitt zur Straße. */
const looksLikeStreet = (text: string) => STREET_PREFIX.test(`${text.trim()} `) || /^(ul|al|pl|os)\.\S/i.test(text.trim());

/**
 * HAUSNUMMER UND WOHNUNG am Ende eines Abschnitts: „5", „5A", „5/3", „5 m. 3",
 * „5 lok. 3", „12a m 4". Gibt den Rest davor zurück.
 */
function splitNumber(segment: string): { rest: string; house: string; unit: string } | null {
  const m = /^(.*?)[\s,]+(\d+[A-Za-z]?(?:[-–]\d+[A-Za-z]?)?)(?:\s*(?:\/|m\.?|lok\.?|mieszk\.?)\s*(\d+[A-Za-z]?))?$/i.exec(segment.trim());
  if (m === null) return null;
  return { rest: m[1].trim(), house: m[2].toUpperCase(), unit: (m[3] ?? '').toUpperCase() };
}

/**
 * EINE ADRESSE AUS EINER ZEILE — wie Menschen sie schreiben:
 *
 * <code>
 *   ul. Długa 5/3, 31-147 Kraków
 *   31-147 Kraków, Długa 5 m. 3
 *   Zawoja 1234, 34-222 Zawoja
 *   Wola Radziszowska 12, 32-052 Radziszów
 *   os. Kalinowe 4/12, Nowa Huta, Kraków
 *   ul. Długa 5, Kraków-Podgórze, 30-001 Kraków
 * </code>
 *
 * <b>Vom Kleinen zum Grossen</b>: unter mehreren Namen ohne Nummer ist der
 * LETZTE der Ort, die davor der Ortsteil — so schreibt man es, und so schreibt
 * es `formatAddress` zurück. „Kraków-Podgórze" gilt nur dann als Ort mit
 * Ortsteil, wenn die Post „Kraków" heisst; sonst ist „Bielsko-Biała" ein Ort.
 *
 * Was sich nicht zuordnen lässt, bleibt leer — die Felder zeigen es, und der
 * Mensch berichtigt. Lieber ein leeres Feld als ein falsch gefülltes.
 */
export function parseAddress(text: string): Address {
  const out = { ...EMPTY_ADDRESS };
  const segments = collapse(text).split(/\s*[,;\n]\s*/).filter((s) => s !== '');
  const rest: string[] = [];

  for (const segment of segments) {
    const pc = /(^|\s)(\d{2})-?(\d{3})(\s|$)/.exec(segment);
    if (pc !== null && out.postcode === '') {
      out.postcode = `${pc[2]}-${pc[3]}`;
      const post = segment.replace(pc[0], ' ').trim();
      if (post !== '') out.post = post;
      continue;
    }
    rest.push(segment);
  }

  const plain: string[] = [];

  for (const segment of rest) {
    const numbered = splitNumber(segment);
    if (numbered !== null && out.house === '') {
      out.house = numbered.house;
      out.unit = numbered.unit;
      const name = numbered.rest;
      if (name === '') continue;
      /*
       * Ein Dorf ohne Straßen: „Zawoja 1234, 34-222 Zawoja" — der Name ist der
       * der Post. Heisst er anders („Wola Radziszowska 12, 32-052 Radziszów"),
       * lässt es sich nicht unterscheiden von einer Straße ohne „ul."; dann
       * gilt die Straße, und das Feld zeigt es zum Berichtigen.
       */
      const sameAsPost = norm('locality', name) === norm('locality', out.post);
      if (!looksLikeStreet(name) && sameAsPost) {
        out.locality = name;
      } else {
        out.street = display('street', name);
      }
      continue;
    }

    /* Ein Ort mit Ortsteil: „Kraków-Podgórze, 30-001 Kraków" — nur, wenn die Post den Ort nennt. */
    const hyphen = /^(.+?)\s*-\s*(\p{Lu}.+)$/u.exec(segment);
    if (out.locality === '' && hyphen !== null && out.post !== '' && norm('locality', hyphen[1]) === norm('locality', out.post)) {
      out.locality = hyphen[1].trim();
      out.district = hyphen[2].trim();
      continue;
    }

    if (looksLikeStreet(segment) && out.street === '') { out.street = display('street', segment); continue; }
    plain.push(segment);
  }

  /* Vom Kleinen zum Grossen: der letzte Name ist der Ort, der davor der Ortsteil. */
  if (plain.length > 0 && out.locality === '') out.locality = plain.pop()!;
  if (plain.length > 0 && out.district === '') out.district = plain.pop()!;

  return out;
}

/**
 * Die Adresse als eine Zeile, wie man sie auf einen Umschlag schreibt — vom
 * Kleinen zum Grossen: Straße und Nummer, Ortsteil, Ort (wenn er nicht der
 * der Post ist), Postleitzahl und Post. `parseAddress` liest sie zurück.
 */
export function formatAddress(a: Address): string {
  const c = complete(a);
  const number = c.house === '' ? '' : c.unit === '' ? c.house : `${c.house}/${c.unit}`;
  const village = c.street === '' && c.locality !== '' && number !== '';
  const streetLine = c.street !== ''
    ? `${/^(al|pl|os|aleja|aleje|plac|osiedle|rondo|skwer|bulwar)\b/i.test(c.street) ? '' : 'ul. '}${c.street}${number === '' ? '' : ` ${number}`}`
    : village ? `${c.locality} ${number}` : number;
  const sameAsPost = c.post !== '' && norm('locality', c.locality) === norm('locality', c.post);
  /* Der Ort fällt nur weg, wenn die Post ihn schon nennt — mit Ortsteil bleibt er, sonst hiesse der Ortsteil wie ein Ort. */
  const place = village || (sameAsPost && c.district === '') ? '' : c.locality;
  const postLine = [c.postcode, c.post].filter((s) => s !== '').join(' ');
  return [streetLine, c.district, place, postLine].filter((s) => s.trim() !== '').join(', ');
}

/** Hausnummern natürlich sortiert: 2, 2A, 10, 10/3. */
export function houseOrder(a: string, b: string): number {
  const pa = /^(\d+)(.*)$/.exec(a);
  const pb = /^(\d+)(.*)$/.exec(b);
  if (pa !== null && pb !== null) {
    const d = Number(pa[1]) - Number(pb[1]);
    return d !== 0 ? d : pa[2].localeCompare(pb[2], 'pl');
  }
  return a.localeCompare(b, 'pl', { numeric: true });
}

/* -- Der Dienst ------------------------------------------------------------------------------ */

export interface PartRow {
  readonly partId: string;
  readonly kind: PartKind;
  readonly name: string;
  readonly norm?: string;
  readonly parentId: string | null;
}

/** Vorschläge — ohne Konto; Namen, keine Menschen. */
export const suggestParts = (kind: PartKind, q: string, parent?: string | null): Promise<{ parts: readonly PartRow[] }> =>
  call(`/addresses/parts?kind=${kind}&q=${encodeURIComponent(q)}${parent ? `&parent=${encodeURIComponent(parent)}` : ''}&limit=10`);

export interface PlaceRow {
  readonly placeId: string;
  readonly postcodeId: string | null;
  readonly postId: string | null;
  readonly localityId: string | null;
  readonly districtId: string | null;
  readonly streetId: string | null;
  readonly house: string | null;
  readonly unit: string | null;
  readonly key: string;
  readonly updatedAt: string;
  readonly deleted: boolean;
}

export interface HouseholdRow {
  readonly householdId: string;
  readonly placeId: string | null;
  readonly epoch: number;
  readonly docSealed: string | null;
  readonly version: number;
  readonly updatedAt: string;
  readonly deleted: boolean;
}

export interface Registry {
  readonly areaId: string;
  readonly asOf: string;
  readonly mayWrite: boolean;
  readonly parts: readonly PartRow[];
  readonly places: readonly PlaceRow[];
  readonly households: readonly HouseholdRow[];
}

export const loadRegistry = (areaId: string, since?: string): Promise<Registry> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/addresses${since === undefined ? '' : `?since=${encodeURIComponent(since)}`}`);

export const savePlaces = (areaId: string, places: readonly (Address & { placeId?: string })[]): Promise<{ places: readonly { placeId: string; key: string; merged: boolean }[] }> =>
  call(`/workspace/area/${encodeURIComponent(areaId)}/addresses`, {
    method: 'POST',
    body: JSON.stringify({ places: places.map((p) => ({ ...complete(p), placeId: p.placeId ?? null })) })
  });

export const deletePlace = (placeId: string): Promise<{ deleted: boolean }> =>
  call(`/workspace/address/${encodeURIComponent(placeId)}/delete`, { method: 'POST' });

/* -- Haushalte ------------------------------------------------------------------------------- */

export type VisitStatus = 'planned' | 'visited' | 'declined' | 'absent';

export const VISIT_LABEL: Record<VisitStatus, string> = {
  planned: 'zaplanowana',
  visited: 'przyjęta',
  declined: 'odmowa',
  absent: 'nieobecni'
};

export interface Visit {
  readonly status: VisitStatus;
  readonly date?: string;
  readonly priest?: string;
  readonly note?: string;
}

export interface HouseholdDoc {
  readonly family: string;
  readonly people: readonly { readonly name: string; readonly born?: string; readonly note?: string }[];
  readonly phone: string;
  readonly email: string;
  readonly notes: string;
  readonly tags: readonly string[];
  /** Kolęda Jahr für Jahr — „2026" → Besuch. */
  readonly kolenda: Readonly<Record<string, Visit>>;
}

export const EMPTY_HOUSEHOLD: HouseholdDoc = { family: '', people: [], phone: '', email: '', notes: '', tags: [], kolenda: {} };

export interface Household extends HouseholdDoc {
  readonly householdId: string;
  readonly placeId: string | null;
  readonly version: number;
}

const householdAad = (id: string) => aad('postal', 'household', id, Field.Household, 1);

/** Ein Dokument lesen — duldsam: was fehlt, ist leer. */
export function readHousehold(value: unknown): HouseholdDoc {
  if (typeof value !== 'object' || value === null) return EMPTY_HOUSEHOLD;
  const v = value as Record<string, unknown>;
  const s = (x: unknown) => (typeof x === 'string' ? x : '');
  const kolenda: Record<string, Visit> = {};
  if (typeof v.kolenda === 'object' && v.kolenda !== null) {
    for (const [year, visit] of Object.entries(v.kolenda as Record<string, unknown>)) {
      if (!/^\d{4}$/.test(year) || typeof visit !== 'object' || visit === null) continue;
      const w = visit as Record<string, unknown>;
      const status = s(w.status);
      if (!(status in VISIT_LABEL)) continue;
      kolenda[year] = {
        status: status as VisitStatus,
        ...(s(w.date) !== '' ? { date: s(w.date) } : {}),
        ...(s(w.priest) !== '' ? { priest: s(w.priest) } : {}),
        ...(s(w.note) !== '' ? { note: s(w.note) } : {})
      };
    }
  }
  return {
    family: s(v.family),
    people: Array.isArray(v.people) ? v.people.filter((p) => typeof p === 'object' && p !== null)
      .map((p) => { const q = p as Record<string, unknown>; return { name: s(q.name), ...(s(q.born) !== '' ? { born: s(q.born) } : {}), ...(s(q.note) !== '' ? { note: s(q.note) } : {}) }; })
      .filter((p) => p.name !== '') : [],
    phone: s(v.phone),
    email: s(v.email),
    notes: s(v.notes),
    tags: Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === 'string' && t.trim() !== '') : [],
    kolenda
  };
}

export async function openHouseholds(ring: Ring, areaId: string, rows: readonly HouseholdRow[]): Promise<Household[]> {
  const keys = await areaKeys(ring, areaId);
  const out: Household[] = [];
  for (const row of rows) {
    if (row.deleted || row.docSealed === null) continue;
    const key = keys.get(row.epoch);
    let doc = EMPTY_HOUSEHOLD;
    if (key !== undefined) {
      try { doc = readHousehold(JSON.parse(await openText(key, householdAad(row.householdId), fromBase64Url(row.docSealed)))); } catch { /* unlesbar: leer */ }
    }
    out.push({ ...doc, householdId: row.householdId, placeId: row.placeId, version: row.version });
  }
  return out;
}

/** Speichern — neu (ohne `householdId`) oder geändert (mit der Fassung, von der man ausging). */
export async function saveHousehold(
  ring: Ring, areaId: string, doc: HouseholdDoc, placeId: string | null, existing?: { householdId: string; version: number }
): Promise<{ householdId: string; version: number }> {
  const newest = newestKey(await areaKeys(ring, areaId, true));
  if (newest === null) throw new WorkspaceError('Nie masz klucza tego obszaru.');
  const id = existing?.householdId ?? newId();
  const sealed = await sealText(newest.key, householdAad(id), JSON.stringify(readHousehold(doc)));
  const done = await call<{ householdId: string; version: number }>(`/workspace/household/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ areaId, placeId, epoch: newest.epoch, docSealed: toBase64Url(sealed), version: existing?.version ?? null })
  });
  return done;
}

export const deleteHousehold = (householdId: string): Promise<{ deleted: boolean }> =>
  call(`/workspace/household/${encodeURIComponent(householdId)}/delete`, { method: 'POST' });

/* -- Ein Ort, mit seinen Teilen geöffnet ------------------------------------------------------ */

export interface Place extends Address {
  readonly placeId: string;
  readonly key: string;
  readonly streetId: string | null;
  readonly localityId: string | null;
  readonly districtId: string | null;
}

export function placesOf(registry: Pick<Registry, 'parts' | 'places'>): Place[] {
  const parts = new Map(registry.parts.map((p) => [p.partId, p.name]));
  const name = (id: string | null) => (id === null ? '' : parts.get(id) ?? '');
  return registry.places.filter((p) => !p.deleted).map((p) => ({
    placeId: p.placeId, key: p.key, streetId: p.streetId, localityId: p.localityId, districtId: p.districtId,
    postcode: name(p.postcodeId), post: name(p.postId), locality: name(p.localityId), district: name(p.districtId),
    street: name(p.streetId), house: p.house ?? '', unit: p.unit ?? ''
  }));
}

/** Nach Ort, Straße, Hausnummer, Wohnung — die Reihenfolge eines Kolęda-Wegs. */
export function placeOrder(a: Address, b: Address): number {
  return a.locality.localeCompare(b.locality, 'pl')
    || a.street.localeCompare(b.street, 'pl')
    || houseOrder(a.house, b.house)
    || houseOrder(a.unit, b.unit);
}
