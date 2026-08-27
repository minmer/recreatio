import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getEventRoster,
  getEventRosterColumns,
  setEventRosterMark,
  type EventRosterColumn,
  type EventRosterRow,
  type EventRosterTable
} from '../../../lib/api';
import {
  asBool,
  asOptionalText,
  asRecord,
  asStringList,
  asText,
  definePart,
  mapEntries
} from './contracts';
import { AreaRow, CheckRow, Fieldset, LinesRow, ListEditor, SelectRow, TextRow } from './editorKit';
import {
  FILTER_OPS,
  compareRows,
  dialablePhone,
  formatCell,
  isEmail,
  matchesFilters,
  matchesQuery,
  parseQuery,
  readOp,
  renderTemplate,
  smsHref,
  toCsv,
  type FilterOp,
  type RosterFilter
} from './rosterQuery';

/**
 * Who signed up, as one table.
 *
 * The same person arrives twice — once through the sign-up form, once through
 * the participant card behind their individual link — and until now those were
 * two lists to read side by side. Here they are one row: the form answers, the
 * card, the link's own assignments ("Grupa: 3") and the plain facts about the
 * submission, in the columns the organizer picked.
 *
 * Three decisions carry this part, and each of them is visible in the builder:
 *
 *   1. **A column is off, hidden or visible — and "off" is a server word.**
 *      A column switched off is not sent to the browser at all; a hidden one is
 *      sent but folded away, so the reader can call it up for one person or
 *      switch it on for everybody. Hiding data in the markup would be a curtain,
 *      not a wall, and this part shows other people's data.
 *
 *   2. **The page decides who reads it.** The slide can go anywhere, but on a
 *      public page it is public. The builder says so where the choice is made
 *      rather than in a manual.
 *
 *   3. **A preset is a view, not a saved search.** One click switches filter,
 *      order and columns together — "Bez karty", "Grupa 2", "Alfabetycznie" —
 *      because on the day nobody assembles a query. The count on the button is
 *      the number of people that click would leave standing.
 */

type ColumnState = 'off' | 'hidden' | 'visible';

type RosterColumnConfig = {
  key: string;
  /** Empty means: keep the name the column came with. */
  label: string;
  state: ColumnState;
};

type RosterPreset = {
  label: string;
  filters: RosterFilter[];
  sortKey: string;
  sortDescending: boolean;
  /** Empty means: leave the columns as they are. */
  columns: string[];
};

/** A message prepared once, sent from the row of whoever it is about. */
type SmsTemplate = { label: string; text: string };

type ExtraKind = 'check' | 'text' | 'number' | 'choice';

/**
 * A column nobody filled in from the outside: attendance, a bus number, a note
 * that the money arrived. Written on the list itself, kept apart from the
 * registration and the card — those are what the participant said.
 *
 * `code` is fixed at creation and never follows the name: the values written so
 * far hang from it, and renaming a column must not orphan them.
 */
type RosterExtra = { code: string; label: string; kind: ExtraKind; options: string[] };

const EXTRA_KINDS: Array<{ value: ExtraKind; label: string }> = [
  { value: 'check', label: 'Odhaczenie (tak / nie)' },
  { value: 'text', label: 'Krótki tekst' },
  { value: 'number', label: 'Liczba' },
  { value: 'choice', label: 'Wybór z listy' }
];

function readExtraKind(value: unknown): ExtraKind {
  return value === 'check' || value === 'number' || value === 'choice' ? value : 'text';
}

type RosterConfig = {
  /** registered — people who sent the form; everyone — those with a link too. */
  source: 'registered' | 'everyone';
  columns: RosterColumnConfig[];
  presets: RosterPreset[];
  smsTemplates: SmsTemplate[];
  /** Columns filled in on the list itself. */
  extras: RosterExtra[];
  /** admin — only the organizer writes them; readers — anyone with a link to this page. */
  whoMayFill: 'admin' | 'readers';
  searchHint: string | null;
  emptyText: string | null;
  /** The live count on each preset button. */
  showCounts: boolean;
};


const STATE_LABELS: Record<ColumnState, string> = {
  off: 'wyłączona',
  hidden: 'ukryta',
  visible: 'widoczna'
};

function readState(value: unknown): ColumnState {
  return value === 'visible' || value === 'hidden' ? value : 'off';
}


// ── The part ─────────────────────────────────────────────────────────────────

export const rosterPart = definePart<RosterConfig>({
  kind: 'roster',
  label: 'Lista uczestników',
  description:
    'Zgłoszenia, karty i przydziały w jednej tabeli — z wyszukiwaniem i przyciskami, ' +
    'które przełączają widok. Zwykle na stronie wewnętrznej.',

  defaultConfig: () => ({
    source: 'registered',
    columns: [
      { key: 'person.name', label: '', state: 'visible' },
      { key: 'person.contact', label: '', state: 'visible' },
      { key: 'person.submitted', label: '', state: 'hidden' }
    ],
    presets: [],
    smsTemplates: [],
    extras: [],
    whoMayFill: 'admin',
    searchHint: null,
    emptyText: null,
    showCounts: true
  }),

  example: () => ({
    source: 'registered',
    columns: [
      { key: 'person.name', label: 'Uczestnik', state: 'visible' },
      { key: 'person.contact', label: 'Telefon', state: 'visible' },
      { key: 'person.card', label: 'Karta', state: 'visible' },
      { key: 'person.submitted', label: '', state: 'hidden' }
    ],
    presets: [
      {
        label: 'Bez karty',
        filters: [{ key: 'person.card', op: 'is', value: 'nie' }],
        sortKey: 'person.name',
        sortDescending: false,
        columns: []
      }
    ],
    extras: [{ code: 'obecnosc', label: 'Obecność', kind: 'check', options: [] }],
    whoMayFill: 'admin',
    smsTemplates: [
      {
        label: 'Przypomnienie',
        text: 'Cześć {imie}! Jutro {wydarzenie}. Twoja grupa: {Grupa}. Do zobaczenia!'
      }
    ],
    searchHint: 'Szukaj nazwiska, telefonu, grupy…',
    emptyText: 'Nikt się jeszcze nie zapisał.',
    showCounts: true
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      source: record.source === 'everyone' ? 'everyone' : 'registered',
      columns: mapEntries(record.columns, (entry) => {
        const key = asText(entry.key).trim();
        if (key.length === 0) return null;
        return { key, label: asText(entry.label).trim(), state: readState(entry.state) };
      }),
      presets: mapEntries(record.presets, (entry) => {
        const label = asText(entry.label).trim();
        if (label.length === 0) return null;
        return {
          label,
          filters: mapEntries(entry.filters, (filter) => {
            const key = asText(filter.key).trim();
            if (key.length === 0) return null;
            return { key, op: readOp(filter.op), value: asText(filter.value) };
          }),
          sortKey: asText(entry.sortKey).trim(),
          sortDescending: asBool(entry.sortDescending),
          columns: asStringList(entry.columns)
        };
      }),
      extras: mapEntries(record.extras, (entry) => {
        const code = asText(entry.code).trim();
        if (code.length === 0 || code.length > 40) return null;
        return {
          code,
          label: asText(entry.label).trim() || code,
          kind: readExtraKind(entry.kind),
          options: asStringList(entry.options)
        };
      }),
      whoMayFill: record.whoMayFill === 'readers' ? 'readers' : 'admin',
      smsTemplates: mapEntries(record.smsTemplates, (entry) => {
        // Nothing is dropped here, for the same reason as everywhere else in
        // the builder: the entry is added blank and the config is re-parsed
        // before a word can be typed into it.
        return { label: asText(entry.label).trim() || 'SMS', text: asText(entry.text) };
      }),
      searchHint: asOptionalText(record.searchHint),
      emptyText: asOptionalText(record.emptyText),
      showCounts: asBool(record.showCounts, true)
    };
  },

  Renderer: ({ config, ctx }) => (
    <RosterTable
      config={config}
      slug={ctx.siteSlug}
      partId={ctx.part.id}
      token={ctx.accessToken}
      eventTitle={ctx.siteTitle}
    />
  ),

  Editor: ({ config, onChange, ctx }) => (
    <RosterEditor config={config} onChange={onChange} siteId={ctx.siteId} pageKind={ctx.pageKind} />
  )
});

// ── Renderer ─────────────────────────────────────────────────────────────────

/**
 * Hands the browser a file.
 *
 * The BOM is not decoration: without it Excel reads the bytes as its own code
 * page, and every name with ł, ą or ż arrives mangled — the one thing that makes
 * an export useless for the purpose it was asked for.
 */
function downloadCsv(slug: string, columns: ReadonlyArray<{ key: string; label: string }>, rows: readonly EventRosterRow[]) {
  const blob = new Blob(['﻿' + toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0, 10);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug}-lista-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // The object URL holds the whole file in memory until it is let go.
  URL.revokeObjectURL(url);
}


function RosterTable({
  config,
  slug,
  partId,
  token,
  eventTitle
}: {
  config: RosterConfig;
  slug: string;
  partId: string;
  token: string | null;
  /** For {wydarzenie} in a prepared message. */
  eventTitle: string;
}) {
  const [table, setTable] = useState<EventRosterTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: string; descending: boolean } | null>(null);
  const [shown, setShown] = useState<string[]>([]);
  /** "rowKey:code" while one mark is on its way to the server. */
  const [busyKey, setBusyKey] = useState<string | null>(null);
  /** The message being written under the list, or null while none is. */
  const [smsText, setSmsText] = useState<string | null>(null);

  /**
   * Which numbers have already been handed to the phone, as "rowKey|number".
   *
   * It lives exactly as long as this view does — nothing is stored. The mark is
   * a working note for one pass down the list ("that one is done"), not a record
   * of anything: the phone never tells the page whether the message actually
   * went, so keeping it beyond the view would be claiming more than is known.
   */
  const [sent, setSent] = useState<ReadonlySet<string>>(() => new Set());

  /** Rows ticked for the export, by row key. Nothing ticked means "everything on screen". */
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());

  const togglePicked = (rowKey: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (!next.delete(rowKey)) next.add(rowKey);
      return next;
    });

  const markSent = (key: string) =>
    setSent((current) => (current.has(key) ? current : new Set(current).add(key)));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getEventRoster(slug, partId, token);
      setTable(response);
      setError(null);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać listy.');
    } finally {
      setLoading(false);
    }
  }, [slug, partId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Which columns start on screen: the ones the organizer marked visible, in the
  // order they put them in. The rest are here, one click away.
  //
  // Keyed on the joined text rather than on the array: the config is parsed
  // afresh on every render, so a dependency on the array itself would hand the
  // effect below a new value each time and reset the reader's column choice
  // between keystrokes.
  const visibleKey = config.columns
    .filter((column) => column.state === 'visible')
    .map((column) => column.key)
    .join('|');

  const visibleByDefault = useMemo(() => (visibleKey.length > 0 ? visibleKey.split('|') : []), [visibleKey]);

  useEffect(() => {
    setShown(visibleByDefault);
  }, [visibleByDefault]);

  const columns = table?.columns ?? [];
  const rows = useMemo(() => table?.rows ?? [], [table]);
  const byKey = useMemo(() => new Map(columns.map((column) => [column.key, column])), [columns]);

  const terms = useMemo(() => parseQuery(query.trim()), [query]);
  const searched = useMemo(
    () => (terms.length === 0 ? rows : rows.filter((row) => matchesQuery(row, columns, terms))),
    [rows, columns, terms]
  );

  const preset = activePreset === null ? null : config.presets[activePreset] ?? null;

  const filtered = useMemo(
    () => (preset === null ? searched : searched.filter((row) => matchesFilters(row, preset.filters))),
    [searched, preset]
  );

  const ordered = useMemo(() => {
    if (sort === null) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => (sort.descending ? -1 : 1) * compareRows(a, b, sort.key));
    return copy;
  }, [filtered, sort]);

  const applyPreset = (index: number) => {
    if (activePreset === index) {
      // Clicking the active view again is how you get back to everybody.
      setActivePreset(null);
      setSort(null);
      setShown(visibleByDefault);
      return;
    }

    const chosen = config.presets[index];
    if (chosen === undefined) return;

    setActivePreset(index);
    setSort(chosen.sortKey.length > 0 ? { key: chosen.sortKey, descending: chosen.sortDescending } : null);
    if (chosen.columns.length > 0) setShown(chosen.columns);
  };

  // A column switched back on returns to its place rather than to the end: the
  // order of the table is the organizer's, and the reader is only choosing which
  // of those columns to look at.
  const rankOf = (key: string) => {
    const place = config.columns.findIndex((column) => column.key === key);
    return place === -1 ? config.columns.length : place;
  };

  const toggleColumn = (key: string) =>
    setShown((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key].sort((left, right) => rankOf(left) - rankOf(right))
    );

  const sortBy = (key: string) =>
    setSort((current) =>
      current !== null && current.key === key ? { key, descending: !current.descending } : { key, descending: false }
    );

  /** One cell of the table, changed in place, so search and counts follow along. */
  const patchRow = (rowKey: string, columnKey: string, value: string | null) =>
    setTable((current) =>
      current === null
        ? current
        : {
            ...current,
            rows: current.rows.map((entry) =>
              entry.key === rowKey ? { ...entry, values: { ...entry.values, [columnKey]: value } } : entry
            )
          }
    );

  /**
   * Ticking somebody off shows at once and is sent behind it. If the server
   * refuses — a link that no longer opens this page, a column since deleted —
   * the tick goes back where it was and says so. A mark that silently did not
   * save is worse than one that never appeared: the list would be read as if
   * the person had been counted.
   */
  const writeMark = async (rowKey: string, code: string, next: string | null) => {
    const columnKey = `extra:${code}`;
    const before = table?.rows.find((entry) => entry.key === rowKey)?.values[columnKey] ?? null;

    setBusyKey(`${rowKey}:${code}`);
    patchRow(rowKey, columnKey, next);

    try {
      const saved = await setEventRosterMark(slug, partId, rowKey, code, next, token);
      patchRow(rowKey, columnKey, saved.value);
      setError(null);
    } catch (writeError: unknown) {
      patchRow(rowKey, columnKey, before);
      setError(writeError instanceof Error ? writeError.message : 'Nie udało się zapisać.');
    } finally {
      setBusyKey(null);
    }
  };

  if (loading && table === null) return <p className="ev-note">Ładowanie listy…</p>;
  if (error !== null) return <p className="ev-error">{error}</p>;
  if (table === null) return null;

  if (table.isUnconfigured) {
    return (
      <p className="ev-note">
        Ta lista nie ma jeszcze wybranych kolumn — otwórz część w edytorze i zaznacz, co ma pokazywać.
      </p>
    );
  }

  if (rows.length === 0) {
    return <p className="ev-note">{config.emptyText ?? 'Nikt się jeszcze nie zapisał.'}</p>;
  }

  // Only the columns that came back can be shown: a column deleted from the
  // event since the slide was built is simply not there any more.
  const head = shown.map((key) => byKey.get(key)).filter((column): column is EventRosterColumn => column !== undefined);

  // What the file will hold: the ticked rows, or — when nothing is ticked —
  // everything the search and the active view have left on screen. Ticking
  // nothing is the common case, and it should mean the obvious thing.
  const exported = picked.size > 0 ? ordered.filter((row) => picked.has(row.key)) : ordered;

  // Whose name a message greets. The name column if it is on the table at all,
  // otherwise the first one — a roster always leads with who the row is about.
  const nameKey = byKey.has('person.name') ? 'person.name' : columns[0]?.key ?? '';

  // Which cells this reader may write. The server decides — it sent mayFill —
  // and the browser only draws what that answer allows.
  const writable = new Map<string, RosterExtra>(
    table.mayFill ? config.extras.map((extra) => [`extra:${extra.code}`, extra]) : []
  );

  return (
    <div className="ev-roster">
      <div className="ev-roster-tools">
        <input
          className="ev-roster-search"
          type="search"
          value={query}
          placeholder={config.searchHint ?? 'Szukaj…'}
          aria-label="Szukaj na liście"
          onChange={(event) => setQuery(event.target.value)}
        />

        {config.presets.length > 0 ? (
          <div className="ev-roster-presets">
            {config.presets.map((entry, index) => {
              const count = config.showCounts
                ? searched.filter((row) => matchesFilters(row, entry.filters)).length
                : null;
              return (
                <button
                  key={`${entry.label}-${index}`}
                  type="button"
                  className={`ev-roster-preset ${activePreset === index ? 'is-on' : ''}`}
                  aria-pressed={activePreset === index}
                  onClick={() => applyPreset(index)}
                >
                  {entry.label}
                  {count !== null ? <span className="ev-roster-badge">{count}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {columns.length > head.length ? (
          <details className="ev-roster-picker">
            <summary>Kolumny</summary>
            <div className="ev-roster-picker-body">
              {columns.map((column) => (
                <label key={column.key} className="eve-check">
                  <input
                    type="checkbox"
                    checked={shown.includes(column.key)}
                    onChange={() => toggleColumn(column.key)}
                  />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      <p className="ev-roster-count">
        {ordered.length === rows.length
          ? `${rows.length} ${rows.length === 1 ? 'osoba' : 'osób'}`
          : `${ordered.length} z ${rows.length}`}
      </p>

      {/* A table with no columns is not a table. It happens when every column is
          set to hidden, or when the reader unticks the last one — either way the
          way out is the same picker, so it stays on screen above. */}
      {head.length === 0 ? (
        <p className="ev-note">Żadna kolumna nie jest włączona — wybierz coś w „Kolumny”.</p>
      ) : (
      <div className="ev-roster-scroll">
        <table className="ev-roster-table">
          <thead>
            <tr>
              {!table.isOrganizer ? null : (
                <th scope="col" className="ev-roster-pick-cell">
                  <input
                    type="checkbox"
                    className="ev-roster-check"
                    // Ticked only when every row on screen is: a half-picked
                    // list must not look like a whole one.
                    checked={ordered.length > 0 && ordered.every((row) => picked.has(row.key))}
                    aria-label="Zaznacz wszystkie na ekranie"
                    onChange={(event) =>
                      setPicked(
                        event.target.checked
                          ? new Set([...picked, ...ordered.map((row) => row.key)])
                          : new Set([...picked].filter((key) => !ordered.some((row) => row.key === key)))
                      )
                    }
                  />
                </th>
              )}
              {head.map((column) => (
                <th key={column.key} scope="col">
                  <button type="button" className="ev-roster-sort" onClick={() => sortBy(column.key)}>
                    {column.label}
                    {sort !== null && sort.key === column.key ? (
                      <span aria-hidden="true">{sort.descending ? ' ↓' : ' ↑'}</span>
                    ) : null}
                  </button>
                </th>
              ))}
              <th scope="col" className="ev-roster-more-head">
                <span className="ev-visually-hidden">Szczegóły</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => (
              <RosterRow
                key={row.key}
                row={row}
                head={head}
                columns={columns}
                picked={
                  table.isOrganizer
                    ? { on: picked.has(row.key), toggle: () => togglePicked(row.key) }
                    : null
                }
                sms={
                  smsText === null
                    ? null
                    : {
                        body: renderTemplate(smsText, row, columns, { eventTitle, nameKey }),
                        isSent: (phone) => sent.has(`${row.key}|${phone}`),
                        markSent: (phone) => markSent(`${row.key}|${phone}`)
                      }
                }
                writable={writable}
                busyKey={busyKey}
                onWrite={(code, next) => void writeMark(row.key, code, next)}
                isOpen={openRow === row.key}
                onToggle={() => setOpenRow(openRow === row.key ? null : row.key)}
              />
            ))}
          </tbody>
        </table>
      </div>
      )}

      {ordered.length === 0 ? <p className="ev-note">Nikt nie pasuje do tego wyszukiwania.</p> : null}

      {/* The organizer's own way out of the browser. Nothing is asked of the
          server: the file is written from exactly what the table was allowed to
          fetch, so the export can never hold a column the slide switched off. */}
      {!table.isOrganizer ? null : (
        <div className="ev-roster-export">
          <button
            type="button"
            className="ev-ghost"
            disabled={exported.length === 0}
            onClick={() => downloadCsv(slug, head, exported)}
          >
            Pobierz CSV ({exported.length})
          </button>
          <span className="ev-roster-count">
            {picked.size > 0 ? 'Zaznaczone wiersze' : 'Wszystko, co widać na ekranie'} · kolumny jak w tabeli
          </span>
          {picked.size > 0 ? (
            <button type="button" className="ev-roster-more" onClick={() => setPicked(new Set())}>
              Odznacz
            </button>
          ) : null}
          <p className="ev-roster-count">
            Plik zawiera dane osobowe uczestników — trzymaj go tak jak papierową listę.
          </p>
        </div>
      )}

      {/* The message lives under the list, not in a row: it is written once and
          then sent to as many people as need it. */}
      <div className="ev-roster-sms-bar">
        <button
          type="button"
          className={`ev-roster-preset ${smsText === null ? '' : 'is-on'}`}
          aria-expanded={smsText !== null}
          onClick={() => {
            setSmsText(smsText === null ? config.smsTemplates[0]?.text ?? '' : null);
            setSent(new Set());
          }}
        >
          {smsText === null ? 'Napisz SMS' : 'Zakończ pisanie'}
        </button>

        {smsText === null ? null : (
          <SmsPanel
            text={smsText}
            templates={config.smsTemplates}
            columns={columns}
            preview={
              ordered[0] === undefined
                ? null
                : renderTemplate(smsText, ordered[0], columns, { eventTitle, nameKey })
            }
            onText={setSmsText}
            sentCount={sent.size}
            onForget={() => setSent(new Set())}
          />
        )}
      </div>
    </div>
  );
}

/**
 * One person. The row carries the chosen columns; everything else that came back
 * — the hidden columns — waits under the row, for this one person, so looking up
 * a phone number does not mean widening the table for everybody.
 */
/**
 * One of the organizer's own columns, for one person — the only cell on this
 * table that can be written.
 *
 * It saves the moment it is set, because the moment is the point: a name is
 * ticked off while the person stands there, and a list with a "save" button at
 * the bottom is a list that gets half saved. Typed columns save when the field
 * is left, so a number is not written down digit by digit.
 */
function MarkCell({
  extra,
  value,
  busy,
  onWrite
}: {
  extra: RosterExtra;
  value: string | null | undefined;
  busy: boolean;
  onWrite: (next: string | null) => void;
}) {
  const stored = (value ?? '').trim();
  const [draft, setDraft] = useState(stored);
  const [editing, setEditing] = useState(false);

  // While somebody types, the field is theirs; otherwise it follows the table,
  // which may have been corrected by whoever else has the list open.
  useEffect(() => {
    if (!editing) setDraft(stored);
  }, [stored, editing]);

  if (extra.kind === 'check') {
    return (
      <input
        type="checkbox"
        className="ev-roster-check"
        checked={stored === 'tak'}
        disabled={busy}
        aria-label={extra.label}
        onChange={(event) => onWrite(event.target.checked ? 'tak' : null)}
      />
    );
  }

  if (extra.kind === 'choice') {
    return (
      <select
        className="ev-roster-mark"
        value={stored}
        disabled={busy}
        aria-label={extra.label}
        onChange={(event) => onWrite(event.target.value || null)}
      >
        <option value="" />
        {extra.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className="ev-roster-mark"
      type={extra.kind === 'number' ? 'number' : 'text'}
      value={draft}
      disabled={busy}
      aria-label={extra.label}
      onFocus={() => setEditing(true)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft.trim() !== stored) onWrite(draft.trim() || null);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

/**
 * What one number can do while a message is being written under the table:
 * carry it, and remember that it did.
 */
type CellSms = {
  /** The message, already filled in for the person whose row this is. */
  body: string;
  isSent: (phone: string) => boolean;
  markSent: (phone: string) => void;
};

/**
 * A cell. A number that a phone could dial becomes a call, an address becomes a
 * mail — on the day, the list is read on a phone, and a number one has to
 * memorize and retype is a number one gets wrong. Tapping the number IS the
 * call; there is no second button for it.
 *
 * While a message is being written, every number carries an SMS beside it —
 * which is the whole gesture: pick the message once, then walk down the list
 * tapping whoever needs it, with the ones already tapped marked off.
 */
function Cell({ value, sms }: { value: string | null | undefined; sms?: CellSms | null }) {
  const text = formatCell(value);
  if (text.length === 0) return null;

  const phone = dialablePhone(value);
  if (phone !== null) {
    const done = sms !== null && sms !== undefined && sms.isSent(phone);
    return (
      <span className="ev-roster-phone">
        <a className="ev-roster-tel" href={`tel:${phone}`}>
          {text}
        </a>
        {sms === null || sms === undefined ? null : (
          <a
            className={`ev-roster-sms-go ${done ? 'is-sent' : ''}`}
            href={smsHref(phone, sms.body)}
            aria-label={done ? `SMS na ${phone} — już otwarty w tej sesji` : `SMS na ${phone}`}
            onClick={() => sms.markSent(phone)}
          >
            {/* The tick, not only the colour: walking down a list of forty, the
                one thing that must not depend on how a screen renders blue is
                which names are already done. */}
            SMS{done ? ' ✓' : ''}
          </a>
        )}
      </span>
    );
  }

  if (isEmail(value)) {
    return (
      <a className="ev-roster-tel" href={`mailto:${(value ?? '').trim()}`}>
        {text}
      </a>
    );
  }

  return <>{text}</>;
}

function RosterRow({
  row,
  head,
  columns,
  sms,
  picked,
  writable,
  busyKey,
  onWrite,
  isOpen,
  onToggle
}: {
  row: EventRosterRow;
  head: EventRosterColumn[];
  columns: EventRosterColumn[];
  /** The message being written under the table, filled in for this person — null when none is. */
  sms: CellSms | null;
  /** Null unless this reader is the organizer, who alone exports the list. */
  picked: { on: boolean; toggle: () => void } | null;
  /** The organizer's own columns, by column key — empty when this reader may only read. */
  writable: Map<string, RosterExtra>;
  busyKey: string | null;
  onWrite: (code: string, next: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {

  // A folded-away column with nothing in it is not worth a line — unless it is
  // one of the organizer's own, where the empty cell is the thing to fill in.
  const rest = columns.filter(
    (column) =>
      !head.some((shownColumn) => shownColumn.key === column.key) &&
      (Boolean(row.values[column.key]) || writable.has(column.key))
  );

  return (
    <>
      <tr className={isOpen ? 'is-open' : undefined}>
        {picked === null ? null : (
          <td className="ev-roster-pick-cell">
            <input
              type="checkbox"
              className="ev-roster-check"
              checked={picked.on}
              aria-label="Weź do pliku"
              onChange={picked.toggle}
            />
          </td>
        )}
        {head.map((column) => {
          const extra = writable.get(column.key);
          return (
            <td key={column.key} className={extra === undefined ? undefined : 'ev-roster-mark-cell'}>
              {extra === undefined ? (
                <Cell value={row.values[column.key]} sms={sms} />
              ) : (
                <MarkCell
                  extra={extra}
                  value={row.values[column.key]}
                  busy={busyKey === `${row.key}:${extra.code}`}
                  onWrite={(next) => onWrite(extra.code, next)}
                />
              )}
            </td>
          );
        })}
        <td className="ev-roster-more-cell">
          {rest.length > 0 ? (
            <button type="button" className="ev-roster-more" aria-expanded={isOpen} onClick={onToggle}>
              {isOpen ? 'Mniej' : 'Więcej'}
            </button>
          ) : null}
        </td>
      </tr>

      {isOpen ? (
        <tr className="ev-roster-detail">
          <td colSpan={head.length + (picked === null ? 1 : 2)}>
            <dl>
              {rest.map((column) => {
                const extra = writable.get(column.key);
                return (
                  <div key={column.key}>
                    <dt>{column.label}</dt>
                    <dd>
                      {extra === undefined ? (
                        <Cell value={row.values[column.key]} sms={sms} />
                      ) : (
                        <MarkCell
                          extra={extra}
                          value={row.values[column.key]}
                          busy={busyKey === `${row.key}:${extra.code}`}
                          onWrite={(next) => onWrite(extra.code, next)}
                        />
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </td>
        </tr>
      ) : null}
    </>
  );
}

/**
 * The message, written once for everybody, under the list.
 *
 * The order of the gesture is the whole design: pick the wording first, then
 * walk down the list tapping SMS beside whoever needs it. A form per person
 * meant opening and closing the same message twenty times to send twenty
 * near-identical texts.
 *
 * So the text here keeps its placeholders — {imie}, {Grupa} — and every row
 * fills them in for itself the moment it is tapped. The fields on offer insert
 * the placeholder rather than a value: at this point no particular person is
 * meant yet.
 */
function SmsPanel({
  text,
  templates,
  columns,
  preview,
  onText,
  sentCount,
  onForget
}: {
  text: string;
  templates: SmsTemplate[];
  columns: EventRosterColumn[];
  /** The first person on the list, so the wording can be read as it will arrive. */
  preview: string | null;
  onText: (next: string) => void;
  /** How many numbers have been opened during this pass. */
  sentCount: number;
  onForget: () => void;
}) {
  const insert = (token: string) => onText(`${text}${token}`);

  return (
    <div className="ev-roster-sms">
      {templates.length > 0 ? (
        <div className="ev-roster-chips">
          {templates.map((template, index) => (
            <button
              key={`${template.label}-${index}`}
              type="button"
              className="ev-roster-chip"
              onClick={() => onText(template.text)}
            >
              {template.label}
            </button>
          ))}
        </div>
      ) : null}

      <textarea
        className="ev-roster-sms-text"
        rows={3}
        value={text}
        aria-label="Treść wiadomości"
        placeholder="Napisz wiadomość albo wybierz gotową…"
        onChange={(event) => onText(event.target.value)}
      />

      <div className="ev-roster-chips">
        {['{imie}', '{osoba}', '{wydarzenie}'].map((token) => (
          <button key={token} type="button" className="ev-roster-chip is-field" onClick={() => insert(token)}>
            + {token}
          </button>
        ))}
        {columns.map((column) => (
          <button
            key={column.key}
            type="button"
            className="ev-roster-chip is-field"
            onClick={() => insert(`{${column.label}}`)}
          >
            + {column.label}
          </button>
        ))}
      </div>

      {preview === null || preview.length === 0 ? null : (
        <p className="ev-roster-preview">
          <span>Dla pierwszej osoby na liście:</span> {preview}
        </p>
      )}

      <p className="ev-roster-count">
        Kliknij <strong>SMS</strong> przy numerze — dane osoby wstawią się same. Wysyła Twój telefon.
        {sentCount > 0 ? (
          <>
            {' '}Otwarte w tym przejściu: <strong>{sentCount}</strong>.{' '}
            <button type="button" className="ev-roster-more" onClick={onForget}>
              Wyczyść oznaczenia
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}

// ── Editor ───────────────────────────────────────────────────────────────────

function RosterEditor({
  config,
  onChange,
  siteId,
  pageKind
}: {
  config: RosterConfig;
  onChange: (next: RosterConfig) => void;
  siteId: string;
  pageKind: 'public' | 'internal';
}) {
  const [universe, setUniverse] = useState<EventRosterColumn[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getEventRosterColumns(siteId)
      .then((columns) => {
        if (active) setUniverse(columns);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Nie udało się pobrać listy kolumn.');
        }
      });
    return () => {
      active = false;
    };
  }, [siteId]);

  // What the event carries, plus the columns this slide adds itself — the
  // picker above has to offer both, and the universe endpoint knows nothing
  // about a column that lives in this part's own config.
  const known = useMemo(() => {
    const map = new Map((universe ?? []).map((column) => [column.key, column]));
    for (const extra of config.extras) {
      map.set(`extra:${extra.code}`, {
        key: `extra:${extra.code}`,
        label: extra.label,
        group: 'Wypełniane na liście',
        filled: 0
      });
    }
    return map;
  }, [universe, config.extras]);

  const chosen = config.columns.filter((column) => column.state !== 'off');
  const chosenKeys = new Set(config.columns.map((column) => column.key));

  const nameOf = (key: string) => {
    const picked = config.columns.find((column) => column.key === key);
    if (picked && picked.label.length > 0) return picked.label;
    return known.get(key)?.label ?? key;
  };

  const setColumn = (key: string, patch: Partial<RosterColumnConfig>) =>
    onChange({
      ...config,
      columns: config.columns.map((column) => (column.key === key ? { ...column, ...patch } : column))
    });

  const addColumn = (key: string) =>
    onChange({
      ...config,
      columns: chosenKeys.has(key)
        ? config.columns.map((column) => (column.key === key ? { ...column, state: 'visible' } : column))
        : [...config.columns, { key, label: '', state: 'visible' }]
    });

  const removeColumn = (key: string) =>
    onChange({ ...config, columns: config.columns.filter((column) => column.key !== key) });

  const moveColumn = (key: string, direction: -1 | 1) => {
    const index = config.columns.findIndex((column) => column.key === key);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= config.columns.length) return;
    const copy = [...config.columns];
    const [moved] = copy.splice(index, 1);
    copy.splice(target, 0, moved);
    onChange({ ...config, columns: copy });
  };

  const groups = useMemo(() => {
    const result = new Map<string, EventRosterColumn[]>();
    for (const column of universe ?? []) {
      const list = result.get(column.group) ?? [];
      list.push(column);
      result.set(column.group, list);
    }
    return [...result.entries()];
  }, [universe]);

  const columnOptions = [
    { value: '', label: '— bez sortowania —' },
    ...chosen.map((column) => ({ value: column.key, label: nameOf(column.key) }))
  ];

  return (
    <>
      {/* The placement is the permission, so it is said where the columns are
          picked — not in a note somebody reads afterwards. */}
      {pageKind === 'public' ? (
        <p className="eve-warn">
          Ta strona jest publiczna: każdy, kto otworzy wydarzenie, zobaczy tę listę i wszystkie kolumny
          oznaczone jako widoczne albo ukryte. Listę z danymi uczestników zwykle umieszcza się na stronie
          wewnętrznej, dostępnej tylko przez link osobisty.
        </p>
      ) : null}

      <SelectRow<RosterConfig['source']>
        label="Kto trafia na listę"
        value={config.source}
        options={[
          { value: 'registered', label: 'Osoby, które wysłały formularz' },
          { value: 'everyone', label: 'Także osoby z linkiem, bez zgłoszenia' }
        ]}
        onChange={(source) => onChange({ ...config, source })}
      />

      <Fieldset legend="Kolumny">
        <p className="eve-hint">
          <strong>Widoczna</strong> — kolumna tabeli. <strong>Ukryta</strong> — pobierana, ale schowana pod
          „Więcej” przy osobie; czytelnik może ją włączyć. <strong>Wyłączona</strong> — nie opuszcza serwera.
        </p>

        {error !== null ? <p className="eve-error">{error}</p> : null}
        {universe === null && error === null ? <p className="eve-hint">Wczytywanie kolumn…</p> : null}

        {config.columns.length === 0 ? (
          <p className="eve-hint">Nie wybrano jeszcze żadnej kolumny.</p>
        ) : (
          <div className="eve-list">
            {config.columns.map((column, index) => {
              const source = known.get(column.key);
              return (
                <article className="eve-item" key={column.key}>
                  <header>
                    <strong>{source?.label ?? column.key}</strong>
                    <div className="eve-item-tools">
                      <button
                        type="button"
                        onClick={() => moveColumn(column.key, -1)}
                        disabled={index === 0}
                        aria-label="Wyżej"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColumn(column.key, 1)}
                        disabled={index === config.columns.length - 1}
                        aria-label="Niżej"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="eve-remove"
                        onClick={() => removeColumn(column.key)}
                        aria-label="Usuń"
                      >
                        ×
                      </button>
                    </div>
                  </header>
                  <div className="eve-item-body">
                    {/* A column nobody filled in is worth knowing about before it
                        goes on the table. */}
                    <p className="eve-hint">
                      {source === undefined
                        ? 'Tej kolumny już nie ma w wydarzeniu — usuń ją z listy.'
                        : `${source.group} · wypełniona u ${source.filled} ${
                            source.filled === 1 ? 'osoby' : 'osób'
                          }`}
                    </p>
                    <SelectRow<ColumnState>
                      label="Stan"
                      value={column.state}
                      options={(['visible', 'hidden', 'off'] as ColumnState[]).map((state) => ({
                        value: state,
                        label: STATE_LABELS[state]
                      }))}
                      onChange={(state) => setColumn(column.key, { state })}
                    />
                    <TextRow
                      label="Nagłówek"
                      value={column.label}
                      placeholder={source?.label ?? ''}
                      hint="Puste — zostaje nazwa z wydarzenia."
                      onChange={(label) => setColumn(column.key, { label })}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {groups.map(([group, entries]) => {
          const free = entries.filter((column) => !chosenKeys.has(column.key));
          if (free.length === 0) return null;
          return (
            <div className="eve-item-body" key={group}>
              <p className="eve-hint">{group}</p>
              <div className="eve-chiprow">
                {free.map((column) => (
                  <button
                    type="button"
                    className="eve-add"
                    key={column.key}
                    onClick={() => addColumn(column.key)}
                  >
                    + {column.label} ({column.filled})
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </Fieldset>

      <ListEditor<RosterPreset>
        legend="Przyciski (gotowe widoki)"
        items={config.presets}
        onChange={(presets) => onChange({ ...config, presets })}
        addLabel="Dodaj przycisk"
        blank={() => ({ label: 'Nowy widok', filters: [], sortKey: '', sortDescending: false, columns: [] })}
        titleOf={(preset) => preset.label || 'Bez nazwy'}
        renderItem={(preset, update) => (
          <>
            <TextRow label="Napis na przycisku" value={preset.label} onChange={(label) => update({ ...preset, label })} />

            <SelectRow
              label="Sortuj według"
              value={preset.sortKey}
              options={columnOptions}
              onChange={(sortKey) => update({ ...preset, sortKey })}
            />
            {preset.sortKey.length > 0 ? (
              <CheckRow
                label="Od największych / najpóźniejszych"
                checked={preset.sortDescending}
                onChange={(sortDescending) => update({ ...preset, sortDescending })}
              />
            ) : null}

            <PresetFilters
              filters={preset.filters}
              columns={chosen}
              nameOf={nameOf}
              onChange={(filters) => update({ ...preset, filters })}
            />

            <fieldset className="eve-group">
              <legend>Kolumny w tym widoku</legend>
              <p className="eve-hint">Nic nie zaznaczone — przycisk nie zmienia kolumn.</p>
              {chosen.map((column) => (
                <CheckRow
                  key={column.key}
                  label={nameOf(column.key)}
                  checked={preset.columns.includes(column.key)}
                  onChange={(on) =>
                    update({
                      ...preset,
                      columns: on
                        ? [...preset.columns, column.key]
                        : preset.columns.filter((entry) => entry !== column.key)
                    })
                  }
                />
              ))}
            </fieldset>
          </>
        )}
      />

      <Fieldset legend="Kolumny wypełniane na liście">
        <p className="eve-hint">
          Kolumny, których nikt nie przysyła z zewnątrz: obecność, numer autokaru, adnotacja o wpłacie.
          Dopisujesz je przy osobie wprost w tabeli. Nowa kolumna od razu trafia na listę kolumn powyżej —
          tam ustawiasz, czy jest widoczna.
        </p>

        {config.whoMayFill === 'readers' && pageKind === 'public' ? (
          <p className="eve-warn">
            Na stronie publicznej serwer nie pozwoli nikomu poza organizatorem nic wpisać — lista, którą
            odhaczy dowolna osoba z internetu, nie jest listą obecności. Przenieś część na stronę wewnętrzną.
          </p>
        ) : null}

        <SelectRow<RosterConfig['whoMayFill']>
          label="Kto wypełnia"
          value={config.whoMayFill}
          options={[
            { value: 'admin', label: 'Tylko organizator' },
            { value: 'readers', label: 'Także osoby z linkiem do tej strony' }
          ]}
          onChange={(whoMayFill) => onChange({ ...config, whoMayFill })}
        />

        <ListEditor<RosterExtra>
          legend="Kolumny"
          items={config.extras}
          addLabel="Dodaj kolumnę"
          titleOf={(extra) => extra.label || extra.code}
          blank={() => {
            // The code is minted once and never follows the name: what has been
            // written so far hangs from it.
            const used = new Set(config.extras.map((extra) => extra.code));
            let index = config.extras.length + 1;
            while (used.has(`pole-${index}`)) index += 1;
            return { code: `pole-${index}`, label: 'Nowa kolumna', kind: 'check', options: [] };
          }}
          onChange={(extras) => {
            // A new column joins the table at once; a deleted one leaves it,
            // rather than lingering as a column the server no longer knows.
            const gone = config.extras
              .filter((extra) => !extras.some((entry) => entry.code === extra.code))
              .map((extra) => `extra:${extra.code}`);

            const added = extras
              .filter((extra) => !config.extras.some((entry) => entry.code === extra.code))
              .map((extra) => ({ key: `extra:${extra.code}`, label: '', state: 'visible' as ColumnState }));

            onChange({
              ...config,
              extras,
              columns: [...config.columns.filter((column) => !gone.includes(column.key)), ...added]
            });
          }}
          renderItem={(extra, update) => (
            <>
              <TextRow label="Nazwa" value={extra.label} onChange={(label) => update({ ...extra, label })} />
              <SelectRow<ExtraKind>
                label="Co się wpisuje"
                value={extra.kind}
                options={EXTRA_KINDS}
                onChange={(kind) => update({ ...extra, kind })}
              />
              {extra.kind === 'choice' ? (
                <LinesRow
                  label="Opcje"
                  values={extra.options}
                  onChange={(options) => update({ ...extra, options })}
                />
              ) : null}
              <p className="eve-hint">kod: {extra.code} — nie zmienia się przy zmianie nazwy.</p>
            </>
          )}
        />
      </Fieldset>

      <ListEditor<SmsTemplate>
        legend="Gotowe SMS-y"
        items={config.smsTemplates}
        onChange={(smsTemplates) => onChange({ ...config, smsTemplates })}
        addLabel="Dodaj wiadomość"
        blank={() => ({ label: 'Nowa wiadomość', text: '' })}
        titleOf={(template) => template.label || 'Bez nazwy'}
        renderItem={(template, update) => (
          <>
            <TextRow
              label="Nazwa"
              value={template.label}
              hint="Napis na przycisku przy osobie."
              onChange={(label) => update({ ...template, label })}
            />
            <AreaRow
              label="Treść"
              rows={3}
              value={template.text}
              hint="W nawiasach klamrowych wstawiasz dane osoby — kliknij poniżej, żeby dopisać."
              onChange={(text) => update({ ...template, text })}
            />

            {/* The vocabulary of the access panel's SMS, plus every column this
                table carries — written the way the organizer reads it. */}
            <div className="eve-chiprow">
              {['imie', 'osoba', 'wydarzenie'].map((token) => (
                <button
                  key={token}
                  type="button"
                  className="eve-add"
                  onClick={() => update({ ...template, text: `${template.text}{${token}}` })}
                >
                  + {'{' + token + '}'}
                </button>
              ))}
              {chosen.map((column) => (
                <button
                  key={column.key}
                  type="button"
                  className="eve-add"
                  onClick={() =>
                    update({ ...template, text: `${template.text}{${nameOf(column.key)}}` })
                  }
                >
                  + {nameOf(column.key)}
                </button>
              ))}
            </div>
          </>
        )}
      />

      <CheckRow
        label="Pokazuj liczbę osób na przyciskach"
        checked={config.showCounts}
        onChange={(showCounts) => onChange({ ...config, showCounts })}
      />

      <TextRow
        label="Podpowiedź w polu szukania"
        value={config.searchHint ?? ''}
        placeholder="Szukaj…"
        onChange={(searchHint) => onChange({ ...config, searchHint: searchHint || null })}
      />

      <AreaRow
        label="Tekst, gdy nikogo jeszcze nie ma"
        rows={2}
        value={config.emptyText ?? ''}
        onChange={(emptyText) => onChange({ ...config, emptyText: emptyText || null })}
      />
    </>
  );
}

/** The conditions behind one button, edited as rows rather than as a query. */
function PresetFilters({
  filters,
  columns,
  nameOf,
  onChange
}: {
  filters: RosterFilter[];
  columns: RosterColumnConfig[];
  nameOf: (key: string) => string;
  onChange: (next: RosterFilter[]) => void;
}) {
  const options = columns.map((column) => ({ value: column.key, label: nameOf(column.key) }));

  const patch = (index: number, next: RosterFilter) =>
    onChange(filters.map((filter, entry) => (entry === index ? next : filter)));

  return (
    <fieldset className="eve-group">
      <legend>Warunki</legend>
      <p className="eve-hint">Wszystkie warunki muszą być spełnione naraz.</p>

      {filters.map((filter, index) => (
        <div className="eve-item-body" key={index}>
          <SelectRow
            label="Kolumna"
            value={filter.key}
            options={options.length > 0 ? options : [{ value: filter.key, label: filter.key }]}
            onChange={(key) => patch(index, { ...filter, key })}
          />
          <SelectRow<FilterOp>
            label="Warunek"
            value={filter.op}
            options={FILTER_OPS}
            onChange={(op) => patch(index, { ...filter, op })}
          />
          {filter.op === 'contains' || filter.op === 'is' ? (
            <TextRow label="Wartość" value={filter.value} onChange={(value) => patch(index, { ...filter, value })} />
          ) : null}
          <button
            type="button"
            className="eve-remove"
            onClick={() => onChange(filters.filter((_, entry) => entry !== index))}
          >
            × Usuń warunek
          </button>
        </div>
      ))}

      <button
        type="button"
        className="eve-add"
        disabled={columns.length === 0}
        onClick={() =>
          onChange([...filters, { key: columns[0]?.key ?? '', op: 'contains', value: '' }])
        }
      >
        + Dodaj warunek
      </button>
    </fieldset>
  );
}
