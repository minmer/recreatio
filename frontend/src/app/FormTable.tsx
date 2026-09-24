/**
 * Die Einsendungen als TABELLE — jede Zeile eine Einsendung, jede Spalte eine
 * Frage.
 *
 * <b>Wozu neben der Liste der Menschen.</b> Die Liste („Osoby") ist zum
 * Handeln: anrufen, einen Link schicken, eine Nummer bestätigen. Diese hier ist
 * zum LESEN: wer hat „nocleg: tak" angekreuzt, wie viele aus der Pfarrei X,
 * wer hat noch kein Geburtsdatum angegeben. Das beantwortet keine Liste von
 * Karten — dafür braucht es Spalten, Sortieren und Filtern.
 *
 * <b>Alles geschieht hier, im Browser.</b> Der Dienst hat die Antworten nie
 * lesen können und kann deshalb weder suchen noch sortieren noch eine CSV
 * bauen. Die Tabelle rechnet auf dem, was eben aufgemacht wurde — und die
 * CSV, die man herunterlädt, ist ab dann eine offene Datei auf diesem Rechner.
 * Das steht dabei.
 *
 * <b>Filter entstehen aus den Daten.</b> Eine Auswahlfrage bekommt immer
 * einen; jede andere nur, wenn sich ihre Antworten WIEDERHOLEN und es wenige
 * sind („tak / nie", die Pfarrei). Namen und Nummern wiederholen sich nicht —
 * dort hilft das Suchfeld, und ein Filter mit einer Zeile je Mensch wäre
 * bloss die Liste noch einmal.
 */

import { useMemo, useState } from 'react';

import type { OpenField, Submission } from './form';

/** Wie viele verschiedene Antworten eine Frage höchstens haben darf, um einen Filter zu bekommen. */
const FILTERABLE = 8;

/** Der Schlüssel für „leer" in einem Filter — kein Wert, den jemand tippen kann. */
const EMPTY = '\u0000';

interface Column {
  readonly key: string;
  readonly label: string;
  readonly numeric: boolean;
  readonly choice: boolean;
}

interface Row {
  readonly id: string;
  readonly at: string;
  readonly hidden: boolean;
  readonly withdrawn: boolean;
  readonly values: ReadonlyMap<string, string>;
}

type Sort = { readonly key: string; readonly dir: 1 | -1 };

export function FormTable({ fields, submissions, opened, fileName }: {
  fields: readonly OpenField[];
  submissions: readonly Submission[];
  opened: ReadonlyMap<string, ReadonlyMap<string, string>>;

  /** Wie die heruntergeladene Datei heisst — der Name des Formulars. */
  fileName: string;
}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ReadonlyMap<string, string>>(new Map());
  const [sort, setSort] = useState<Sort>({ key: 'at', dir: -1 });

  const rows: readonly Row[] = useMemo(() => submissions.map((s) => ({
    id: s.registrationId,
    at: s.submittedAt,
    hidden: s.hidden,
    withdrawn: s.withdrawnAt !== null,
    values: opened.get(s.registrationId) ?? new Map<string, string>()
  })), [submissions, opened]);

  /*
   * DIE SPALTEN: die Fragen von heute in ihrer Reihenfolge — und dahinter jede
   * Antwort, deren Frage inzwischen gelöscht ist. Eine Spalte, die fehlt,
   * wäre ein Wert, der stillschweigend nicht mehr vorkommt.
   */
  const columns: readonly Column[] = useMemo(() => {
    const known = new Set(fields.map((f) => f.fieldId));
    const orphans = new Set<string>();
    for (const row of rows) for (const id of row.values.keys()) if (!known.has(id)) orphans.add(id);

    return [
      { key: 'at', label: 'Wysłano', numeric: false, choice: false },
      ...fields.map((f) => ({
        key: f.fieldId,
        label: f.label ?? 'zapieczętowane pytanie',
        numeric: f.kind === 'number',
        choice: f.kind === 'choice'
      })),
      ...[...orphans].map((id) => ({
        key: id, label: `pytanie usunięte (${id.slice(0, 8)})`, numeric: false, choice: false
      }))
    ];
  }, [fields, rows]);

  const cell = (row: Row, key: string): string =>
    key === 'at' ? new Date(row.at).toLocaleString('pl-PL') : row.values.get(key) ?? '';

  /* Welche Fragen einen Filter bekommen — und welche Antworten darin stehen. */
  const choices = useMemo(() => columns
    .filter((c) => c.key !== 'at')
    .map((c) => {
      const seen = new Set<string>();
      let answered = 0;
      let blank = false;

      for (const row of rows) {
        const v = (row.values.get(c.key) ?? '').trim();
        if (v === '') blank = true; else { seen.add(v); answered += 1; }
      }

      /* Eine Auswahl immer; sonst nur, wenn sich Antworten wiederholen. */
      const worth = seen.size >= 1 && (c.choice
        || (seen.size <= FILTERABLE && seen.size < answered));

      return { column: c, values: [...seen].sort((a, b) => a.localeCompare(b, 'pl')), blank, worth };
    })
    .filter((one) => one.worth), [columns, rows]);

  const shown = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('pl');

    const kept = rows.filter((row) => {
      for (const [key, wanted] of filters) {
        const v = (row.values.get(key) ?? '').trim();
        if (wanted === EMPTY ? v !== '' : v !== wanted) return false;
      }

      if (needle === '') return true;
      return [...row.values.values()].some((v) => v.toLocaleLowerCase('pl').includes(needle));
    });

    const column = columns.find((c) => c.key === sort.key);

    return [...kept].sort((a, b) => {
      if (sort.key === 'at') return sort.dir * a.at.localeCompare(b.at);

      const x = a.values.get(sort.key) ?? '';
      const y = b.values.get(sort.key) ?? '';

      /* Leere Zellen immer ans Ende — gleich, in welche Richtung sortiert wird. */
      if (x === '' || y === '') return x === y ? 0 : x === '' ? 1 : -1;

      if (column?.numeric) {
        const nx = Number(x.replace(',', '.'));
        const ny = Number(y.replace(',', '.'));
        if (!Number.isNaN(nx) && !Number.isNaN(ny)) return sort.dir * (nx - ny);
      }

      return sort.dir * x.localeCompare(y, 'pl', { numeric: true });
    });
  }, [rows, filters, search, sort, columns]);

  const pickSort = (key: string) =>
    setSort((was) => (was.key === key ? { key, dir: was.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const setFilter = (key: string, value: string) => setFilters((was) => {
    const next = new Map(was);
    if (value === '') next.delete(key); else next.set(key, value);
    return next;
  });

  if (rows.length === 0) return <p className="wk-empty">Nie ma jeszcze żadnego zgłoszenia.</p>;

  return (
    <div className="wk-entries">
      <div className="wk-entries-bar">
        <label className="wk-field">
          <span>Szukaj w odpowiedziach</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="imię, numer, parafia…" />
        </label>

        {choices.map(({ column, values, blank }) => (
          <label className="wk-field" key={column.key}>
            <span>{column.label}</span>
            <select value={filters.get(column.key) ?? ''} onChange={(e) => setFilter(column.key, e.target.value)}>
              <option value="">wszystkie</option>
              {values.map((v) => <option key={v} value={v}>{v}</option>)}
              {blank && <option value={EMPTY}>— bez odpowiedzi —</option>}
            </select>
          </label>
        ))}
      </div>

      <div className="wk-actions">
        <span className="wk-hint">
          {shown.length === rows.length ? `${rows.length} zgłoszeń` : `${shown.length} z ${rows.length} zgłoszeń`}
        </span>
        <button
          type="button" className="wk-link-btn" disabled={shown.length === 0}
          onClick={() => download(fileName, columns, shown, cell)}
        >
          Pobierz CSV ({shown.length})
        </button>
      </div>
      <p className="wk-hint">
        Plik CSV zawiera odszyfrowane odpowiedzi — na tym komputerze nic ich już nie chroni.
      </p>

      <div className="wk-table-wrap">
        <table className="wk-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                >
                  <button type="button" className="wk-th-sort" onClick={() => pickSort(c.key)}>
                    {c.label}
                    <span aria-hidden="true">{sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id} className={row.hidden || row.withdrawn ? 'wk-row-muted' : undefined}>
                {columns.map((c, i) => (
                  <td key={c.key} className={c.numeric ? 'wk-num' : undefined}>
                    {cell(row, c.key)}
                    {i === 0 && row.hidden && <span className="wk-tag">ukryte</span>}
                    {i === 0 && row.withdrawn && <span className="wk-tag">wycofane</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Die gezeigten Zeilen als CSV — so, wie sie gerade dastehen.
 *
 * <b>Semikolon und BOM</b>, weil das die Datei ist, die ein polnisches Excel
 * ohne Nachfrage richtig öffnet: mit Komma liefe jede Zeile in EINE Spalte,
 * ohne BOM würden aus „Grzegórzki" Zeichensalat.
 */
function download(
  name: string,
  columns: readonly Column[],
  rows: readonly Row[],
  cell: (row: Row, key: string) => string
): void {
  const quote = (v: string) => (/[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

  const lines = [
    columns.map((c) => quote(c.label)).join(';'),
    ...rows.map((row) => columns.map((c) => quote(cell(row, c.key))).join(';'))
  ];

  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const base = name.trim().toLocaleLowerCase('pl')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'zgloszenia';

  const a = document.createElement('a');
  a.href = url;
  a.download = `${base}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default FormTable;
