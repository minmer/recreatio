import { useEffect, useMemo, useState } from 'react';
import { getEventCatalogue, type EventCatalogueEntry } from '../../lib/api';
import type { EventDefinition } from './eventTypes';

/**
 * One row of the overview, whatever it was built from. Hand-coded events and
 * event sites are normalized to this so a single filter and sort covers both.
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
  source: 'event' | 'legacy';
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

function fromEvent(entry: EventCatalogueEntry): CatalogueRow {
  return {
    key: `event-${entry.id}`,
    title: entry.title,
    summary: entry.summary ?? '',
    category: entry.category,
    audience: entry.audience,
    places: entry.places,
    thumbnailUrl: entry.thumbnailUrl,
    startDate: entry.startDate,
    endDate: entry.endDate,
    dateLabel: entry.dateLabel ?? formatRange(entry.startDate, entry.endDate),
    href: `/#/event/${entry.slug}`,
    source: 'event'
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
    href: event.slug === 'edk26' ? '/#/event_old/edk26' : `/#/event_old/${event.slug}/${firstPage.slug}`,
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

/** Initials for a tile with no picture, so the grid keeps its rhythm. */
function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

export function EventsCatalogue({ legacyEvents }: { legacyEvents: EventDefinition[] }) {
  const [remote, setRemote] = useState<EventCatalogueEntry[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [place, setPlace] = useState('');
  const [sort, setSort] = useState<SortKey>('date-asc');
  const [upcomingOnly, setUpcomingOnly] = useState(false);

  // Which tile has its details open on a touch screen. With a pointer that can
  // hover this stays null and CSS :hover does the work.
  const [revealed, setRevealed] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getEventCatalogue()
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

  // Tapping anywhere else closes the open tile, so a touch reader is never
  // stuck with details they cannot dismiss without opening the event.
  useEffect(() => {
    if (revealed === null) return;
    const close = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest('.events-tile')) return;
      setRevealed(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [revealed]);

  const rows = useMemo(
    () => [...remote.map(fromEvent), ...legacyEvents.map(fromLegacy)],
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

  /**
   * On a touch screen the first tap opens the tile's details and the second
   * one opens the event, so the information hidden behind hover stays
   * reachable. Where the pointer can hover, a click is just a click.
   */
  const onTileClick = (event: React.MouseEvent, key: string) => {
    if (typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(hover: none)').matches) return;
    if (revealed === key) return;

    event.preventDefault();
    setRevealed(key);
  };

  return (
    <>
      <div className="events-filters">
        <input
          className="events-search"
          type="search"
          aria-label="Szukaj wydarzenia"
          placeholder="Szukaj…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <select aria-label="Grupa wydarzeń" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Wszystkie grupy</option>
          {categories.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>

        <select aria-label="Miejsce" value={place} onChange={(event) => setPlace(event.target.value)}>
          <option value="">Wszystkie miejsca</option>
          {placeOptions.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </select>

        <select aria-label="Sortowanie" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={`events-chip ${upcomingOnly ? 'is-on' : ''}`}
          aria-pressed={upcomingOnly}
          onClick={() => setUpcomingOnly((value) => !value)}
        >
          Nadchodzące
        </button>

        {filtered ? (
          <button
            type="button"
            className="events-chip events-clear"
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

        <span className="events-count">
          {visible.length === rows.length ? rows.length : `${visible.length}/${rows.length}`}
        </span>
      </div>

      <div className="events-grid">
        {visible.map((row) => (
          <a
            key={row.key}
            className={`events-tile ${revealed === row.key ? 'is-revealed' : ''}`}
            href={row.href}
            aria-label={row.title}
            onClick={(event) => onTileClick(event, row.key)}
          >
            <span className="events-tile-frame">
              {row.thumbnailUrl ? (
                <img src={row.thumbnailUrl} alt="" loading="lazy" />
              ) : (
                <span className="events-tile-mark" aria-hidden="true">
                  {initials(row.title)}
                </span>
              )}

              {/* Everything but the date lives here: shown on hover, or after
                  the first tap on a touch screen. */}
              <span className="events-tile-veil">
                {row.category ? <span className="events-tile-kicker">{row.category}</span> : null}
                <strong>{row.title}</strong>
                {row.summary ? <span className="events-tile-summary">{row.summary}</span> : null}
                {row.places.length > 0 ? (
                  <span className="events-tile-line">{row.places.join(' · ')}</span>
                ) : null}
                {row.audience ? <span className="events-tile-line">{row.audience}</span> : null}
              </span>
            </span>

            <span className="events-tile-date">{row.dateLabel || 'Termin wkrótce'}</span>
          </a>
        ))}
      </div>

      {visible.length === 0 ? <p className="events-empty">Żadne wydarzenie nie pasuje do tych filtrów.</p> : null}
    </>
  );
}
