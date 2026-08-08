import { useEffect, useMemo, useState } from 'react';
import { getEvent2Catalogue, type Event2CatalogueEntry } from '../../lib/api';
import type { EventDefinition } from './eventTypes';

/**
 * One row of the overview, whatever it was built from. Hand-coded events and
 * event2 sites are normalized to this so a single filter and sort covers both.
 */
export type CatalogueRow = {
  key: string;
  title: string;
  summary: string;
  category: string | null;
  audience: string | null;
  places: string[];
  thumbnailUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  dateLabel: string;
  href: string;
  source: 'event2' | 'legacy';
};

type SortKey = 'date-asc' | 'date-desc' | 'title' | 'category';

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'date-asc', label: 'Termin: najbliższe' },
  { value: 'date-desc', label: 'Termin: najpóźniejsze' },
  { value: 'title', label: 'Nazwa A–Z' },
  { value: 'category', label: 'Grupa wydarzeń' }
];

const MONTHS = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'
];

/** "28–29.08.2026" style label derived from the real dates. */
function formatRange(startDate: string | null, endDate: string | null): string {
  if (!startDate) return '';
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return '';

  const end = endDate ? new Date(endDate) : null;
  const endValid = end !== null && !Number.isNaN(end.getTime());

  if (!endValid || start.getTime() === end.getTime()) {
    return `${start.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  }
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

function fromEvent2(entry: Event2CatalogueEntry): CatalogueRow {
  return {
    key: `event2-${entry.id}`,
    title: entry.title,
    summary: entry.summary ?? '',
    category: entry.category,
    audience: entry.audience,
    places: entry.places,
    thumbnailUrl: entry.thumbnailUrl,
    startDate: entry.startDate,
    endDate: entry.endDate,
    dateLabel: entry.dateLabel ?? formatRange(entry.startDate, entry.endDate),
    href: `/#/event/event2/site/${entry.slug}`,
    source: 'event2'
  };
}

/** The hand-coded events carry their catalogue fields inline. */
function fromLegacy(event: EventDefinition): CatalogueRow {
  const firstPage = event.pages[0];
  return {
    key: `legacy-${event.slug}`,
    title: event.title,
    summary: event.summary,
    category: event.category ?? null,
    audience: event.audience ?? null,
    places: event.places ?? (event.location ? [event.location] : []),
    thumbnailUrl: null,
    startDate: event.startDate ?? null,
    endDate: event.endDate ?? null,
    dateLabel: event.date || formatRange(event.startDate ?? null, event.endDate ?? null),
    href: event.slug === 'edk26' ? '/#/event/edk26' : `/#/event/${event.slug}/${firstPage.slug}`,
    source: 'legacy'
  };
}

function compare(a: CatalogueRow, b: CatalogueRow, sort: SortKey): number {
  if (sort === 'title') return a.title.localeCompare(b.title, 'pl');
  if (sort === 'category') {
    const byCategory = (a.category ?? 'ZZZ').localeCompare(b.category ?? 'ZZZ', 'pl');
    return byCategory !== 0 ? byCategory : a.title.localeCompare(b.title, 'pl');
  }
  // Undated events sort last in both date directions — they are not "earliest".
  if (!a.startDate && !b.startDate) return a.title.localeCompare(b.title, 'pl');
  if (!a.startDate) return 1;
  if (!b.startDate) return -1;
  const delta = a.startDate.localeCompare(b.startDate);
  return sort === 'date-desc' ? -delta : delta;
}

export function EventsCatalogue({ legacyEvents, openLabel }: { legacyEvents: EventDefinition[]; openLabel: string }) {
  const [remote, setRemote] = useState<Event2CatalogueEntry[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [place, setPlace] = useState('');
  const [sort, setSort] = useState<SortKey>('date-asc');
  const [upcomingOnly, setUpcomingOnly] = useState(false);

  useEffect(() => {
    let active = true;
    getEvent2Catalogue()
      .then((entries) => {
        if (active) setRemote(entries);
      })
      .catch(() => {
        // A catalogue that cannot be reached must not take the hand-coded
        // events down with it — the overview still lists those.
        if (active) setRemote([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(
    () => [...remote.map(fromEvent2), ...legacyEvents.map(fromLegacy)],
    [legacyEvents, remote]
  );

  const categories = useMemo(
    () => [...new Set(rows.map((row) => row.category).filter((entry): entry is string => !!entry))].sort((a, b) => a.localeCompare(b, 'pl')),
    [rows]
  );

  const placeOptions = useMemo(
    () => [...new Set(rows.flatMap((row) => row.places))].sort((a, b) => a.localeCompare(b, 'pl')),
    [rows]
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);

    return rows
      .filter((row) => {
        if (category && row.category !== category) return false;
        if (place && !row.places.includes(place)) return false;
        if (upcomingOnly && row.startDate && (row.endDate ?? row.startDate) < today) return false;
        if (needle.length === 0) return true;
        return [row.title, row.summary, row.audience ?? '', row.category ?? '', ...row.places]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => compare(a, b, sort));
  }, [category, place, query, rows, sort, upcomingOnly]);

  const filtered = query.trim().length > 0 || category !== '' || place !== '' || upcomingOnly;

  return (
    <>
      <div className="events-filters">
        <label className="events-search">
          <span className="sr-only">Szukaj wydarzenia</span>
          <input
            type="search"
            placeholder="Szukaj wydarzenia…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label>
          <span>Grupa</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Wszystkie</option>
            {categories.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Miejsce</span>
          <select value={place} onChange={(event) => setPlace(event.target.value)}>
            <option value="">Wszystkie</option>
            {placeOptions.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Sortowanie</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="events-toggle">
          <input
            type="checkbox"
            checked={upcomingOnly}
            onChange={(event) => setUpcomingOnly(event.target.checked)}
          />
          <span>Tylko nadchodzące</span>
        </label>

        {filtered ? (
          <button
            type="button"
            className="ghost events-clear"
            onClick={() => {
              setQuery('');
              setCategory('');
              setPlace('');
              setUpcomingOnly(false);
            }}
          >
            Wyczyść
          </button>
        ) : null}
      </div>

      <p className="events-count">
        {visible.length === rows.length
          ? `${rows.length} wydarzeń`
          : `${visible.length} z ${rows.length} wydarzeń`}
      </p>

      <div className="events-grid">
        {visible.map((row) => (
          <article key={row.key} className="events-card">
            {row.thumbnailUrl ? (
              <div className="events-card-thumb">
                <img src={row.thumbnailUrl} alt="" loading="lazy" />
              </div>
            ) : null}

            {row.category ? <p className="events-card-category">{row.category}</p> : null}
            <h3>{row.title}</h3>
            {row.summary ? <p>{row.summary}</p> : null}

            <dl>
              {row.dateLabel ? (
                <div>
                  <dt>Termin</dt>
                  <dd>{row.dateLabel}</dd>
                </div>
              ) : null}
              {row.places.length > 0 ? (
                <div>
                  <dt>Miejsce</dt>
                  <dd>{row.places.join(' · ')}</dd>
                </div>
              ) : null}
              {row.audience ? (
                <div>
                  <dt>Dla kogo</dt>
                  <dd>{row.audience}</dd>
                </div>
              ) : null}
            </dl>

            <a className="cta" href={row.href}>
              {openLabel}
            </a>
          </article>
        ))}
      </div>

      {visible.length === 0 ? <p className="events-empty">Żadne wydarzenie nie pasuje do tych filtrów.</p> : null}
    </>
  );
}
