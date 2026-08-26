import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getEventRoster,
  getEventRosterColumns,
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
import { AreaRow, CheckRow, Fieldset, ListEditor, SelectRow, TextRow } from './editorKit';
import {
  FILTER_OPS,
  compareRows,
  dialablePhone,
  formatCell,
  isEmail,
  matchesFilters,
  matchesQuery,
  parseQuery,
  phoneForRow,
  readOp,
  renderTemplate,
  smsHref,
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

type RosterConfig = {
  /** registered — people who sent the form; everyone — those with a link too. */
  source: 'registered' | 'everyone';
  columns: RosterColumnConfig[];
  presets: RosterPreset[];
  /** Which column holds the number to ring. Empty — the first that reads as one. */
  phoneKey: string;
  smsTemplates: SmsTemplate[];
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
    phoneKey: '',
    smsTemplates: [],
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
    phoneKey: 'person.contact',
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
      phoneKey: asText(record.phoneKey).trim(),
      smsTemplates: mapEntries(record.smsTemplates, (entry) => {
        const text = asText(entry.text).trim();
        if (text.length === 0) return null;
        return { label: asText(entry.label).trim() || 'SMS', text };
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

  // Whose name a message greets. The name column if it is on the table at all,
  // otherwise the first one — a roster always leads with who the row is about.
  const nameKey = byKey.has('person.name') ? 'person.name' : columns[0]?.key ?? '';

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
                phone={phoneForRow(row, columns, config.phoneKey)}
                templates={config.smsTemplates}
                eventTitle={eventTitle}
                nameKey={nameKey}
                isOpen={openRow === row.key}
                onToggle={() => setOpenRow(openRow === row.key ? null : row.key)}
              />
            ))}
          </tbody>
        </table>
      </div>
      )}

      {ordered.length === 0 ? <p className="ev-note">Nikt nie pasuje do tego wyszukiwania.</p> : null}
    </div>
  );
}

/**
 * One person. The row carries the chosen columns; everything else that came back
 * — the hidden columns — waits under the row, for this one person, so looking up
 * a phone number does not mean widening the table for everybody.
 */
/**
 * A cell. A number that a phone could dial becomes a call, an address becomes a
 * mail — on the day, the list is read on a phone, and a number one has to
 * memorize and retype is a number one gets wrong.
 */
function Cell({ value }: { value: string | null | undefined }) {
  const text = formatCell(value);
  if (text.length === 0) return null;

  const phone = dialablePhone(value);
  if (phone !== null) {
    return (
      <a className="ev-roster-tel" href={`tel:${phone}`}>
        {text}
      </a>
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
  phone,
  templates,
  eventTitle,
  nameKey,
  isOpen,
  onToggle
}: {
  row: EventRosterRow;
  head: EventRosterColumn[];
  columns: EventRosterColumn[];
  phone: string | null;
  templates: SmsTemplate[];
  eventTitle: string;
  nameKey: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [writing, setWriting] = useState(false);

  const rest = columns.filter(
    (column) => !head.some((shownColumn) => shownColumn.key === column.key) && row.values[column.key]
  );

  return (
    <>
      <tr className={isOpen || writing ? 'is-open' : undefined}>
        {head.map((column) => (
          <td key={column.key}>
            <Cell value={row.values[column.key]} />
          </td>
        ))}
        <td className="ev-roster-more-cell">
          {phone !== null ? (
            <>
              <a className="ev-roster-act" href={`tel:${phone}`} aria-label={`Zadzwoń: ${phone}`}>
                Zadzwoń
              </a>
              <button
                type="button"
                className="ev-roster-act"
                aria-expanded={writing}
                onClick={() => setWriting((current) => !current)}
              >
                SMS
              </button>
            </>
          ) : null}
          {rest.length > 0 ? (
            <button type="button" className="ev-roster-more" aria-expanded={isOpen} onClick={onToggle}>
              {isOpen ? 'Mniej' : 'Więcej'}
            </button>
          ) : null}
        </td>
      </tr>

      {isOpen ? (
        <tr className="ev-roster-detail">
          <td colSpan={head.length + 1}>
            <dl>
              {rest.map((column) => (
                <div key={column.key}>
                  <dt>{column.label}</dt>
                  <dd>
                    <Cell value={row.values[column.key]} />
                  </dd>
                </div>
              ))}
            </dl>
          </td>
        </tr>
      ) : null}

      {writing && phone !== null ? (
        <tr className="ev-roster-detail">
          <td colSpan={head.length + 1}>
            <SmsComposer
              row={row}
              columns={columns}
              phone={phone}
              templates={templates}
              eventTitle={eventTitle}
              nameKey={nameKey}
              onClose={() => setWriting(false)}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

/**
 * The message, for this one person, before it leaves for the phone's own SMS
 * app.
 *
 * A prepared message is filled in from the row — the group, the meeting point,
 * the first name — and then stays editable, because the one thing a template
 * never covers is the reason you are writing today. The fields on offer append
 * the value rather than the placeholder: at this point the person is known, so
 * `{Grupa}` would be a step backwards.
 */
function SmsComposer({
  row,
  columns,
  phone,
  templates,
  eventTitle,
  nameKey,
  onClose
}: {
  row: EventRosterRow;
  columns: EventRosterColumn[];
  phone: string;
  templates: SmsTemplate[];
  eventTitle: string;
  nameKey: string;
  onClose: () => void;
}) {
  const fill = useCallback(
    (template: SmsTemplate) => renderTemplate(template.text, row, columns, { eventTitle, nameKey }),
    [row, columns, eventTitle, nameKey]
  );

  const [text, setText] = useState(() => (templates[0] ? fill(templates[0]) : ''));
  const [copied, setCopied] = useState(false);

  const filled = columns.filter((column) => (row.values[column.key] ?? '').trim().length > 0);

  const append = (piece: string) => setText((current) => (current.length === 0 ? piece : `${current} ${piece}`));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="ev-roster-sms">
      <div className="ev-roster-sms-head">
        <strong>SMS na {phone}</strong>
        <button type="button" className="ev-roster-more" onClick={onClose}>
          Zamknij
        </button>
      </div>

      {templates.length > 0 ? (
        <div className="ev-roster-chips">
          {templates.map((template, index) => (
            <button
              key={`${template.label}-${index}`}
              type="button"
              className="ev-roster-chip"
              onClick={() => setText(fill(template))}
            >
              {template.label}
            </button>
          ))}
        </div>
      ) : null}

      <textarea
        className="ev-roster-sms-text"
        rows={4}
        value={text}
        aria-label="Treść wiadomości"
        onChange={(event) => setText(event.target.value)}
      />

      <div className="ev-roster-chips">
        {filled.map((column) => (
          <button
            key={column.key}
            type="button"
            className="ev-roster-chip is-field"
            title={`Dopisz: ${formatCell(row.values[column.key])}`}
            onClick={() => append(formatCell(row.values[column.key]))}
          >
            + {column.label}
          </button>
        ))}
      </div>

      <div className="ev-roster-sms-actions">
        {/* The phone's own SMS app takes it from here: the number and the text
            arrive filled in, and the sending stays where the SIM card is. */}
        <a className="ev-cta" href={smsHref(phone, text)}>
          Otwórz SMS
        </a>
        <button type="button" className="ev-ghost" onClick={() => void copy()}>
          {copied ? 'Skopiowano' : 'Kopiuj treść'}
        </button>
        <span className="ev-roster-count">{text.length} znaków</span>
      </div>
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

  const known = useMemo(() => new Map((universe ?? []).map((column) => [column.key, column])), [universe]);

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

      <SelectRow
        label="Numer do dzwonienia i SMS-ów"
        value={config.phoneKey}
        options={[{ value: '', label: '— pierwsza kolumna, która wygląda na telefon —' }, ...columnOptions.slice(1)]}
        onChange={(phoneKey) => onChange({ ...config, phoneKey })}
      />

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
