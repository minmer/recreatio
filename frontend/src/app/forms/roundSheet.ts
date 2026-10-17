/**
 * DIE LISTE EINER WIEDERKEHRENDEN ERWEITERUNG (0077) — was sich rechnen lässt,
 * ohne Dienst und ohne Seite.
 *
 * Eine Zeile je Mensch des erweiterten Formulars, eine Spalte je Zeitraum, in
 * jeder Zelle höchstens eine Einsendung der Erweiterung. Hier steht, was die
 * Ansicht (`ExtensionSheet.tsx`) daraus macht: welche Fragen sich in der Zeile
 * antippen lassen, die Summen eines Zeitraums und des Jahres, die Reihenfolge
 * nach Adresse (der Weg), die Tabelle zum Herunterladen.
 *
 * Für die Kranken („Komunia, Spowiedź, Namaszczenie" je Monat) so gut wie für
 * die Anwesenheit bei Treffen oder einen Beitrag — die Liste weiss nicht,
 * wovon sie handelt.
 */

import { isYes, type OpenField } from './form';
import { parseAddress, placeOrder } from './postal';
import { roundLabel, type Repeat } from './rounds';

/** Eine Einsendung der Erweiterung, aufgemacht: für wen, für wann, was darin steht. */
export interface RoundRecord {
  readonly registrationId: string;
  readonly baseId: string;
  readonly round: string;
  readonly values: ReadonlyMap<string, string>;
}

/** Mehr Plättchen passen nicht in eine Zeile am Telefon. */
export const MAX_QUICK = 6;

/** Die Fragen, die sich in der Zeile antippen lassen: „Tak / nie", lesbar — und von der Kanzlei zu schreiben (0093: nicht, was nur der Mensch schreibt). */
export const quickFields = (fields: readonly OpenField[]): OpenField[] =>
  fields.filter((f) => f.kind === 'checkbox' && f.label !== null && f.personOnly !== true).slice(0, MAX_QUICK);

/** Die Beschriftung eines Plättchens — die Frage, gekürzt, wenn sie lang ist. */
export function chipText(label: string): string {
  const text = label.trim().replace(/[?:]+$/, '');
  return text.length <= 14 ? text : `${text.slice(0, 13).trimEnd()}…`;
}

/** Steht in der Einsendung überhaupt etwas? Eine, in der alles abgewählt wurde, ist keine. */
export const isBlank = (values: ReadonlyMap<string, string> | undefined): boolean =>
  values === undefined || [...values.values()].every((v) => v.trim() === '');

/** Mensch → Zeitraum → Einsendung. */
export function byPerson(records: readonly RoundRecord[]): Map<string, Map<string, RoundRecord>> {
  const out = new Map<string, Map<string, RoundRecord>>();
  for (const one of records) {
    let mine = out.get(one.baseId);
    if (mine === undefined) { mine = new Map(); out.set(one.baseId, mine); }
    mine.set(one.round, one);
  }
  return out;
}

export interface Tally {
  /** Wie viele Einsendungen (in denen etwas steht). */
  readonly records: number;
  /** Je „Tak / nie"-Frage: wie oft „tak". */
  readonly yes: ReadonlyMap<string, number>;
  /** Je Zahlen-Frage: die Summe. */
  readonly sums: ReadonlyMap<string, number>;
  /** Je Auswahl-Frage: wie oft welche Möglichkeit. */
  readonly choices: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

/** Die Summen über eine Menge von Einsendungen — eines Zeitraums, oder eines Jahres. */
export function tallyOf(fields: readonly OpenField[], records: readonly RoundRecord[]): Tally {
  const yes = new Map<string, number>();
  const sums = new Map<string, number>();
  const choices = new Map<string, Map<string, number>>();
  let count = 0;

  for (const one of records) {
    if (isBlank(one.values)) continue;
    count += 1;

    for (const f of fields) {
      const value = (one.values.get(f.fieldId) ?? '').trim();
      if (value === '') continue;

      if (f.kind === 'checkbox') {
        if (isYes(value)) yes.set(f.fieldId, (yes.get(f.fieldId) ?? 0) + 1);
      } else if (f.kind === 'number') {
        const n = Number(value.replace(',', '.'));
        if (Number.isFinite(n)) sums.set(f.fieldId, (sums.get(f.fieldId) ?? 0) + n);
      } else if (f.kind === 'choice') {
        const mine = choices.get(f.fieldId) ?? new Map<string, number>();
        mine.set(value, (mine.get(value) ?? 0) + 1);
        choices.set(f.fieldId, mine);
      }
    }
  }

  return { records: count, yes, sums, choices };
}

/** Die Summen als ein Satz: „Komunia 12 · Spowiedź 5 · Ofiara 120". Leer, wenn es nichts zu zählen gibt. */
export function tallyText(fields: readonly OpenField[], tally: Tally): string {
  const parts: string[] = [];
  for (const f of fields) {
    if (f.label === null) continue;
    if (f.kind === 'checkbox') parts.push(`${f.label} ${tally.yes.get(f.fieldId) ?? 0}`);
    else if (f.kind === 'number' && tally.sums.has(f.fieldId)) parts.push(`${f.label} ${Math.round((tally.sums.get(f.fieldId) ?? 0) * 100) / 100}`);
    else if (f.kind === 'choice') {
      const mine = tally.choices.get(f.fieldId);
      if (mine !== undefined && mine.size > 0) parts.push(`${f.label}: ${[...mine].map(([k, n]) => `${k} ${n}`).join(', ')}`);
    }
  }
  return parts.join(' · ');
}

/** Die Reihenfolge des Weges: Ort, Strasse, Hausnummer (natürlich: 2 vor 10) — wie im Verzeichnis. */
export const addressOrder = (a: string, b: string): number => {
  if (a.trim() === '' || b.trim() === '') return a.trim() === '' ? (b.trim() === '' ? 0 : 1) : -1;
  return placeOrder(parseAddress(a), parseAddress(b));
};

/** Was in einer Zelle des Verlaufs steht: die Anfangsbuchstaben der angekreuzten Fragen — „K S", oder „•". */
export function cellText(quick: readonly OpenField[], record: RoundRecord | undefined): string {
  if (record === undefined || isBlank(record.values)) return '';
  const letters = quick.filter((f) => isYes(record.values.get(f.fieldId))).map((f) => (f.label ?? '?').trim().charAt(0).toUpperCase());
  return letters.length > 0 ? letters.join(' ') : '•';
}

const csvCell = (text: string): string => (/[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);

/**
 * DIE TABELLE ZUM HERUNTERLADEN: je Einsendung eine Zeile — Mensch, Zeitraum,
 * jede Frage. Mit Strichpunkt getrennt und BOM davor, wie Excel in Polen sie
 * erwartet. Ab dann ist sie eine offene Datei auf diesem Rechner.
 */
export function roundsCsv(
  repeat: Repeat, fields: readonly OpenField[],
  people: readonly { readonly baseId: string; readonly name: string }[], records: readonly RoundRecord[]
): string {
  const nameOf = new Map(people.map((p) => [p.baseId, p.name]));
  const shown = fields.filter((f) => f.label !== null);
  const lines = [['Osoba', 'Okres', 'Okres (klucz)', ...shown.map((f) => f.label ?? '')].map(csvCell).join(';')];

  const sorted = [...records].filter((r) => nameOf.has(r.baseId) && !isBlank(r.values))
    .sort((a, b) => a.round.localeCompare(b.round) || (nameOf.get(a.baseId) ?? '').localeCompare(nameOf.get(b.baseId) ?? '', 'pl'));

  for (const one of sorted) {
    lines.push([
      nameOf.get(one.baseId) ?? '', roundLabel(repeat, one.round), one.round,
      ...shown.map((f) => {
        const value = one.values.get(f.fieldId) ?? '';
        return f.kind === 'checkbox' ? (isYes(value) ? 'tak' : '') : value;
      })
    ].map(csvCell).join(';'));
  }

  return `﻿${lines.join('\r\n')}\r\n`;
}
