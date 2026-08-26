/**
 * Reading the search box, matching a row, ordering the table.
 *
 * Kept apart from the component because it is the part of this slide that can
 * be wrong in a way nobody notices: a search that quietly finds nothing looks
 * exactly like an event nobody signed up for. These are plain functions over
 * plain data, so they can be exercised without a browser.
 */

import type { EventRosterColumn, EventRosterRow } from '../../../lib/api';

export type FilterOp = 'contains' | 'is' | 'filled' | 'empty';

export type RosterFilter = { key: string; op: FilterOp; value: string };

export const FILTER_OPS: Array<{ value: FilterOp; label: string }> = [
  { value: 'contains', label: 'zawiera' },
  { value: 'is', label: 'jest dokładnie' },
  { value: 'filled', label: 'jest wypełnione' },
  { value: 'empty', label: 'jest puste' }
];

export function readOp(value: unknown): FilterOp {
  return value === 'is' || value === 'filled' || value === 'empty' ? value : 'contains';
}
/**
 * Comparable text: lower case, without Polish diacritics. Searching for "zolw"
 * has to find "Żółw" — an organizer looking somebody up on a phone at a bus stop
 * does not switch keyboards first.
 */
export function fold(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      // Ł is the one Polish letter that decomposition does not touch: it is a
      // letter of its own, not an L carrying a mark. Without this line "lukasz"
      // finds every name but Łukasz — the failure nobody reports, because it
      // looks like the person simply is not on the list.
      .replace(/ł/g, 'l')
  );
}

const ISO_MOMENT = /^\d{4}-\d{2}-\d{2}T/;

/** What a cell says on screen. The server sends data, not presentation. */
export function formatCell(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim().length === 0) return '';
  if (value === 'tak') return '✓';
  if (value === 'nie') return '—';
  if (ISO_MOMENT.test(value)) {
    const moment = new Date(value);
    if (!Number.isNaN(moment.getTime())) {
      return moment.toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' });
    }
  }
  return value;
}

export type SearchTerm = { negated: boolean; scope: string | null; text: string };

/**
 * Splits the search box into terms. Quotes hold a phrase together, a leading `-`
 * excludes, and `kolumna:tekst` narrows one term to one column — so
 * `grupa:2 -kowalski` reads as "in group 2, not the Kowalskis".
 */
export function parseQuery(raw: string): SearchTerm[] {
  const tokens: string[] = [];
  let current = '';
  let quoted = false;

  for (const character of raw) {
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && /\s/.test(character)) {
      if (current.length > 0) tokens.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  if (current.length > 0) tokens.push(current);

  return tokens.map((token) => {
    const negated = token.startsWith('-') && token.length > 1;
    const body = negated ? token.slice(1) : token;
    const separator = body.indexOf(':');

    // A scope only counts when something stands on both sides. "7:40" keeps its
    // colon and is searched for as it was typed — see resolveScope.
    if (separator > 0 && separator < body.length - 1) {
      return { negated, scope: body.slice(0, separator), text: body.slice(separator + 1) };
    }
    return { negated, scope: null, text: body };
  });
}

/** The columns a `kolumna:` prefix means, or null when it names none of them. */
export function resolveScope(scope: string, columns: EventRosterColumn[]): EventRosterColumn[] | null {
  const wanted = fold(scope);
  const matched = columns.filter(
    (column) => column.key === scope || fold(column.label).startsWith(wanted)
  );
  return matched.length > 0 ? matched : null;
}

export function matchesQuery(row: EventRosterRow, columns: EventRosterColumn[], terms: SearchTerm[]): boolean {
  for (const term of terms) {
    const scoped = term.scope === null ? null : resolveScope(term.scope, columns);

    // A prefix that names no column was never a prefix: search the whole token,
    // colon and all.
    const searchIn = scoped ?? columns;
    const needle = fold(scoped === null && term.scope !== null ? `${term.scope}:${term.text}` : term.text);

    const found = searchIn.some((column) => {
      const value = row.values[column.key];
      return typeof value === 'string' && fold(value).includes(needle);
    });

    if (found === term.negated) return false;
  }
  return true;
}

export function matchesFilters(row: EventRosterRow, filters: RosterFilter[]): boolean {
  return filters.every((filter) => {
    const raw = row.values[filter.key];
    const value = typeof raw === 'string' ? raw.trim() : '';

    switch (filter.op) {
      case 'filled':
        return value.length > 0;
      case 'empty':
        return value.length === 0;
      case 'is':
        return fold(value) === fold(filter.value.trim());
      default:
        return fold(value).includes(fold(filter.value.trim()));
    }
  });
}

/** Empty cells sort last whichever way the column runs: they are not a value. */
export function compareRows(a: EventRosterRow, b: EventRosterRow, key: string): number {
  const left = (a.values[key] ?? '').trim();
  const right = (b.values[key] ?? '').trim();

  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;

  const leftNumber = Number(left.replace(',', '.'));
  const rightNumber = Number(right.replace(',', '.'));
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;

  // ISO moments sort correctly as plain text, which saves parsing them twice.
  if (ISO_MOMENT.test(left) && ISO_MOMENT.test(right)) return left < right ? -1 : left > right ? 1 : 0;

  return left.localeCompare(right, 'pl');
}

// ── Reaching the person ──────────────────────────────────────────────────────

/**
 * A number a phone can dial, or null when this is not one.
 *
 * The rule has to tell a phone number from the other long runs of digits a
 * roster carries — a PESEL above all, which is eleven digits and must never
 * become a tappable "call this person". So: anything written with a plus is a
 * number; nine bare digits are the Polish national form; ten to twelve digits
 * count only when somebody wrote them with spaces or dashes, which a PESEL is
 * not. Everything else stays plain text.
 */
export function dialablePhone(value: string | null | undefined): string | null {
  if (!value) return null;

  const text = value.trim();
  if (text.includes('@')) return null;

  // Letters mean this is a sentence that happens to contain digits.
  if (/[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(text)) return null;

  const compact = text.replace(/[\s\-().]/g, '');
  const separated = /[\s\-()]/.test(text);

  if (compact.startsWith('+')) {
    const digits = compact.slice(1);
    return /^\d{7,15}$/.test(digits) ? `+${digits}` : null;
  }

  if (!/^\d+$/.test(compact)) return null;
  if (compact.length === 9) return `+48${compact}`;
  if (compact.length >= 10 && compact.length <= 12 && separated) {
    return compact.startsWith('48') ? `+${compact}` : `+48${compact}`;
  }

  return null;
}

export function isEmail(value: string | null | undefined): boolean {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * The number to ring for one person. The organizer may name the column; without
 * that, the first column that reads as a phone wins, in the order the table is
 * built — so the contact from the sign-up comes before a guardian's number.
 */
export function phoneForRow(
  row: EventRosterRow,
  columns: EventRosterColumn[],
  preferredKey: string
): string | null {
  if (preferredKey.length > 0) return dialablePhone(row.values[preferredKey]);

  for (const column of columns) {
    const dialable = dialablePhone(row.values[column.key]);
    if (dialable !== null) return dialable;
  }
  return null;
}

/**
 * Fills a message in for one person.
 *
 * `{...}` names a column — by its key, or by the name shown at the top of it, so
 * the organizer can write `{Grupa}` and read back what they meant. Three words
 * stand for something the table has no column for: `{osoba}` the full name,
 * `{imie}` how you greet them, and `{wydarzenie}` the event.
 *
 * A placeholder that names nothing is left standing rather than blanked: the
 * organizer sees their own typo in the message instead of a hole where the
 * group number should be.
 */
export function renderTemplate(
  template: string,
  row: EventRosterRow,
  columns: EventRosterColumn[],
  extras: { eventTitle: string; nameKey: string }
): string {
  const fullName = (row.values[extras.nameKey] ?? '').trim();

  return template.replace(/\{([^{}]+)\}/g, (whole, token: string) => {
    const wanted = fold(token.trim());

    if (wanted === 'wydarzenie') return extras.eventTitle;
    if (wanted === 'osoba') return fullName;
    if (wanted === 'imie') return fullName.split(/\s+/)[0] ?? fullName;

    const column = columns.find(
      (entry) => entry.key === token.trim() || fold(entry.label) === wanted
    );
    if (column === undefined) return whole;

    return (row.values[column.key] ?? '').trim();
  });
}

/** What the SMS app is handed. The house form, as in the access panel. */
export function smsHref(phone: string, body: string): string {
  return `sms:${phone}?body=${encodeURIComponent(body)}`;
}
