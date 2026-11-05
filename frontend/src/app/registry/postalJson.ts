/**
 * DIE KARTOTEKA ALS JSON (0071) — Adressen eines Gebiets mit ihren Haushalten
 * und der Kolęda; Export, Import, und die Beschreibung daneben (wie überall,
 * siehe Erinnerung „json-import-export").
 *
 * <b>Wiedererkannt wird über die Adresse</b> (die normalisierten Teile,
 * `postal.keyOf`): dieselbe Adresse ist derselbe Ort, auch wenn sie anders
 * geschrieben ist („ul. Długa 5/3" und „Dluga 5 m. 3"). Ein Haushalt an einem
 * Ort, der schon einen hat, wird ergänzt — Felder, die fehlen, bleiben.
 */

import { t } from '../core/i18n';
import {
  complete, EMPTY_ADDRESS, formatAddress, isEmpty, keyOf, parseAddress, readHousehold, VISIT_LABEL,
  type Address, type Household, type HouseholdDoc, type Place
} from './postal';

export const REGISTRY_FORMAT = 'recreatio/registry';

const ADDRESS_KEYS: readonly (keyof Address)[] = ['street', 'house', 'unit', 'locality', 'district', 'postcode', 'post'];

export interface RegistryRow {
  readonly address: Address;
  readonly household: Partial<HouseholdDoc> | null;
}

export interface PlannedRow extends RegistryRow {
  readonly placeId: string | null;
  readonly existing: Household | null;
}

/** Was eine Zeile enthält — Zeichenkette oder Teile. */
function addressOf(value: unknown): Address | null {
  if (typeof value === 'string') return value.trim() === '' ? null : parseAddress(value);
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const out: Record<string, string> = { ...EMPTY_ADDRESS };
  for (const key of ADDRESS_KEYS) if (typeof v[key] === 'string' || typeof v[key] === 'number') out[key] = String(v[key]).trim();
  const a = out as unknown as Address;
  return isEmpty(a) ? null : a;
}

/** Nur, was im JSON steht — damit ein Import ohne „phone" die Nummer nicht löscht. */
function partialHousehold(value: unknown): Partial<HouseholdDoc> | null {
  if (typeof value !== 'object' || value === null) return null;
  const read = readHousehold(value);
  const given = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ['family', 'people', 'phone', 'email', 'notes', 'tags', 'kolenda'] as const) {
    if (key in given) out[key] = read[key];
  }
  return out as Partial<HouseholdDoc>;
}

export function exportRegistry(areaName: string, places: readonly Place[], households: readonly Household[]): unknown {
  const byPlace = new Map(households.filter((h) => h.placeId !== null).map((h) => [h.placeId!, h]));
  return {
    format: REGISTRY_FORMAT,
    version: 1,
    areaName,
    addresses: places.map((p) => {
      const parts: Record<string, string> = {};
      for (const key of ADDRESS_KEYS) if (p[key] !== '') parts[key] = p[key];
      const h = byPlace.get(p.placeId);
      return {
        id: p.placeId,
        address: parts,
        ...(h === undefined ? {} : {
          household: {
            family: h.family, people: h.people, phone: h.phone, email: h.email, notes: h.notes, tags: h.tags, kolenda: h.kolenda
          }
        })
      };
    })
  };
}

/**
 * 2026-10-30 — vor dem Beispiel „Jak aplikacja używa tych danych": die Kartoteka und ihre Kolęda (`Kartoteka.tsx`),
 * lesen und schreiben nach dem Bereich (`Postal.cs`), die Familie versiegelt und im Browser gefiltert; die Teile der
 * Adresse offen und für alle (`/addresses/parts`, `PostalInput.tsx` im Formular, in der Personenkarte, beim
 * Administrator danych); der Import schreibt nur Orte und Haushalte (`savePlaces`, `saveHousehold`).
 */
export function registryDescription(): string {
  return t('registry.json.description', {
    format: REGISTRY_FORMAT,
    statuses: Object.keys(VISIT_LABEL).map((s) => `"${s}"`).join(' | '),
    /* Das Beispiel: polnische Adressen, wie die Zerlegung sie kennt (Daten). */
    sample: JSON.stringify({
      format: REGISTRY_FORMAT, version: 1, areaName: 'Parafia św. Józefa',
      addresses: [
        { address: 'ul. Długa 5/3, 31-147 Kraków', household: { family: 'Kowalscy', people: [{ name: 'Jan Kowalski' }, { name: 'Anna Kowalska' }], phone: '+48 600 000 000', tags: ['chorzy'], kolenda: { 2026: { status: 'visited', date: '2026-01-03', priest: 'ks. Adam' } } } },
        { address: { street: 'Długa', house: '7', locality: 'Kraków', postcode: '31-147' } }
      ]
    }, null, 2)
  });
}

/** Was ein Dokument ändern würde. */
export function planRegistryImport(doc: unknown, places: readonly Place[], households: readonly Household[]):
  { rows: PlannedRow[]; lines: string[]; warnings: string[] } | { error: string } {
  if (typeof doc !== 'object' || doc === null) return { error: 'To nie jest dokument kartoteki.' };
  const d = doc as Record<string, unknown>;
  if (d.format !== undefined && d.format !== REGISTRY_FORMAT) return { error: `Inny format: "${String(d.format)}" — oczekiwano "${REGISTRY_FORMAT}".` };
  const list = Array.isArray(d.addresses) ? d.addresses : Array.isArray(doc) ? doc as unknown[] : null;
  if (list === null) return { error: 'Brakuje listy "addresses".' };

  const byKey = new Map(places.map((p) => [keyOf(p), p]));
  const householdOf = new Map(households.filter((h) => h.placeId !== null).map((h) => [h.placeId!, h]));
  const rows: PlannedRow[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  let created = 0, known = 0, families = 0, updated = 0;

  list.forEach((one, i) => {
    const item = typeof one === 'string' ? { address: one } : (one as Record<string, unknown> | null);
    const address = addressOf(item?.address ?? item);
    if (address === null) { warnings.push(`Pozycja ${i + 1}: brak adresu — pominięta.`); return; }
    const key = keyOf(address);
    if (seen.has(key)) { warnings.push(`Pozycja ${i + 1}: ten sam adres drugi raz (${formatAddress(address)}) — połączona z wcześniejszą.`); }
    seen.add(key);
    const place = byKey.get(key) ?? null;
    if (place === null) created += 1; else known += 1;
    const household = partialHousehold(item?.household);
    const existing = place === null ? null : householdOf.get(place.placeId) ?? null;
    if (household !== null) { if (existing === null) families += 1; else updated += 1; }
    rows.push({ address: complete(address), household, placeId: place?.placeId ?? null, existing });
  });

  return {
    rows,
    lines: [
      `Nowe adresy: ${created}`,
      `Adresy już w kartotece: ${known}`,
      `Nowe rodziny: ${families}`,
      `Uzupełnione rodziny: ${updated}`
    ],
    warnings
  };
}
