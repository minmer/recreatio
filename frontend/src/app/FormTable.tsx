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
 *
 * <b>0086 — und zum SCHREIBEN.</b> „Edytuj w tabeli" macht jede Zelle einer
 * gestellten Frage zu einem Eingabefeld, und „Dodaj wiersz" setzt jemanden
 * auf die Liste — die Kanzlei trägt eine Liste vom Papier ab, oder rückt
 * zwanzig Antworten auf einmal gerade. Gespeichert wird wie jede Berichtigung
 * der Kanzlei: neu versiegelt, für das Amt und für den Menschen. Die Spalten
 * der vom Formular genommenen Fragen stehen mit ihren Antworten da — lesen ja,
 * schreiben nein: gefragt wird danach nicht mehr.
 */

import { useMemo, useState } from 'react';

import { consentGiven, consentValue, isYes, shownAnswer, YES, type Answer, type OpenField, type Submission } from './form';
import { saveBlob } from './platform';
import { WorkspaceError } from './session';

/** Wie viele verschiedene Antworten eine Frage höchstens haben darf, um einen Filter zu bekommen. */
const FILTERABLE = 8;

/** Der Schlüssel für „leer" in einem Filter — kein Wert, den jemand tippen kann. */
const EMPTY = '\u0000';

interface Column {
  readonly key: string;
  readonly label: string;
  readonly numeric: boolean;
  readonly choice: boolean;

  /** 0086 — die Frage hinter der Spalte, wenn sie gestellt wird: nur dann lässt sich die Zelle schreiben. */
  readonly field: OpenField | null;

  /** 0093 — schreibt nur der Mensch: die Kanzlei liest die Zelle, schreibt sie nie. */
  readonly locked?: boolean;
}

interface Row {
  readonly id: string;
  readonly at: string;
  readonly hidden: boolean;
  readonly withdrawn: boolean;
  readonly values: ReadonlyMap<string, string>;
}

type Sort = { readonly key: string; readonly dir: 1 | -1 };

/** 0086 — was an EINER Einsendung geändert wurde. */
export interface TableChange {
  readonly registrationId: string;
  readonly answers: readonly Answer[];
}

/** Keine vom Formular genommenen Fragen — eine feste Liste, damit die Rechnungen unten nicht bei jedem Zeichnen neu laufen. */
const NONE: readonly OpenField[] = [];

export function FormTable({ fields, removed = NONE, submissions, opened, fileName, onSave, canAdd = false }: {
  fields: readonly OpenField[];

  /** 0086 — die vom Formular genommenen Fragen: ihre Spalten stehen mit Beschriftung da, zum Lesen. */
  removed?: readonly OpenField[];
  submissions: readonly Submission[];
  opened: ReadonlyMap<string, ReadonlyMap<string, string>>;

  /** Wie die heruntergeladene Datei heisst — der Name des Formulars. */
  fileName: string;

  /**
   * 0086 — die geänderten Zellen und die neuen Zeilen speichern. Fehlt es, ist
   * die Tabelle nur zum Lesen. Zurück kommt eine Auskunft (oder `null`).
   */
  onSave?: (changes: readonly TableChange[], added: readonly (readonly Answer[])[]) => Promise<string | null>;

  /** Neue Zeilen — nur bei einem gewöhnlichen Formular (eine Erweiterung gehört zu einer Einsendung). */
  canAdd?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ReadonlyMap<string, string>>(new Map());
  const [sort, setSort] = useState<Sort>({ key: 'at', dir: -1 });

  /* -- 0086: Schreiben ------------------------------------------------------------- */
  const [editing, setEditing] = useState(false);
  /** Einsendung → Frage → neuer Wert (nur, was angefasst wurde). */
  const [draft, setDraft] = useState<ReadonlyMap<string, ReadonlyMap<string, string>>>(new Map());
  /** Die neuen Zeilen — je eine Frage → Wert. */
  const [fresh, setFresh] = useState<readonly Readonly<Record<string, string>>[]>([]);
  const [saving, setSaving] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /** Der gespeicherte Wert einer Zelle — roh, wie er aufging (eine Zustimmung mit ihrem Wortlaut). */
  const rawOf = (registrationId: string, fieldId: string) => opened.get(registrationId)?.get(fieldId) ?? '';

  /* 0083 — eine Zustimmung steht als „tak" in der Tabelle (und in der CSV); ihr Wortlaut bleibt in der Antwort und auf dem Ausdruck. */
  const consents = useMemo(() => new Set([...fields, ...removed].filter((f) => f.kind === 'consent').map((f) => f.fieldId)), [fields, removed]);

  const rows: readonly Row[] = useMemo(() => submissions.map((s) => {
    const values = opened.get(s.registrationId) ?? new Map<string, string>();
    return {
      id: s.registrationId,
      at: s.submittedAt,
      hidden: s.hidden,
      withdrawn: s.withdrawnAt !== null,
      values: consents.size === 0 ? values
        : new Map([...values].map(([key, v]) => [key, consents.has(key) ? shownAnswer('consent', v) : v]))
    };
  }), [submissions, opened, consents]);

  /*
   * DIE SPALTEN: die Fragen von heute in ihrer Reihenfolge — und dahinter jede
   * Antwort, deren Frage inzwischen gelöscht ist. Eine Spalte, die fehlt,
   * wäre ein Wert, der stillschweigend nicht mehr vorkommt.
   */
  const columns: readonly Column[] = useMemo(() => {
    const known = new Set([...fields, ...removed].map((f) => f.fieldId));
    const orphans = new Set<string>();
    for (const row of rows) for (const id of row.values.keys()) if (!known.has(id)) orphans.add(id);

    /* 0086 — eine vom Formular genommene Frage nur, wenn jemand auf sie geantwortet hat. */
    const answered = new Set<string>();
    for (const row of rows) for (const [id, v] of row.values) if (v.trim() !== '') answered.add(id);

    return [
      { key: 'at', label: 'Wysłano', numeric: false, choice: false, field: null },
      ...fields.map((f) => ({
        key: f.fieldId,
        label: f.label ?? 'zapieczętowane pytanie',
        numeric: f.kind === 'number',
        choice: f.kind === 'choice',
        field: f.label === null ? null : f,
        locked: f.personOnly === true
      })),
      ...removed.filter((f) => answered.has(f.fieldId)).map((f) => ({
        key: f.fieldId,
        label: `${f.label ?? 'zapieczętowane pytanie'} (zdjęte z formularza)`,
        numeric: f.kind === 'number',
        choice: f.kind === 'choice',
        field: null
      })),
      ...[...orphans].map((id) => ({
        key: id, label: `pytanie usunięte (${id.slice(0, 8)})`, numeric: false, choice: false, field: null
      }))
    ];
  }, [fields, removed, rows]);

  const writable = columns.filter((c) => c.field !== null);

  /** Was in einer Zelle steht, während geschrieben wird — der Entwurf, sonst das Gespeicherte. */
  const draftOf = (registrationId: string, fieldId: string) => draft.get(registrationId)?.get(fieldId) ?? rawOf(registrationId, fieldId);

  const setCell = (registrationId: string, fieldId: string, value: string) => setDraft((was) => {
    const next = new Map(was);
    const row = new Map(next.get(registrationId) ?? new Map<string, string>());
    if (value.trim() === rawOf(registrationId, fieldId).trim()) row.delete(fieldId); else row.set(fieldId, value);
    if (row.size === 0) next.delete(registrationId); else next.set(registrationId, row);
    return next;
  });

  const changes: readonly TableChange[] = [...draft].map(([registrationId, cells]) => ({
    registrationId,
    answers: [...cells].map(([fieldId, value]) => ({ fieldId, value }))
  })).filter((one) => one.answers.length > 0);

  const added: readonly (readonly Answer[])[] = fresh
    .map((one) => Object.entries(one).filter(([, v]) => v.trim() !== '').map(([fieldId, value]) => ({ fieldId, value })))
    .filter((one) => one.length > 0);

  const touched = changes.reduce((n, one) => n + one.answers.length, 0) + added.length;

  const stop = () => { setEditing(false); setDraft(new Map()); setFresh([]); setFailed(null); };

  const save = async () => {
    if (onSave === undefined || touched === 0) return;
    setSaving(true);
    setFailed(null);
    setSaid(null);
    try {
      /* Was gespeichert wurde, sagt der Aufrufer (über der Tabelle — sie entsteht beim Neulesen neu); `null`: schon gesagt. */
      setSaid(await onSave(changes, added));
      stop();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać tabeli.');
    } finally {
      setSaving(false);
    }
  };

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

  if (rows.length === 0 && (onSave === undefined || !canAdd)) return <p className="wk-empty">Nie ma jeszcze żadnego zgłoszenia.</p>;

  return (
    <div className={editing ? 'wk-entries is-editing' : 'wk-entries'}>
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
          type="button" className="wk-link-btn" disabled={shown.length === 0 || editing}
          onClick={() => download(fileName, columns, shown, cell)}
        >
          Pobierz CSV ({shown.length})
        </button>
        {onSave !== undefined && !editing && (
          <button
            type="button" className="wk-btn wk-btn-quiet" disabled={writable.length === 0}
            onClick={() => { setEditing(true); setSaid(null); setFailed(null); if (rows.length === 0 && canAdd) setFresh([{}]); }}
          >
            Edytuj w tabeli
          </button>
        )}
      </div>
      <p className="wk-hint">
        Plik CSV zawiera odszyfrowane odpowiedzi — na tym komputerze nic ich już nie chroni.
      </p>

      {/* 0086 — DAS SCHREIBEN: was geändert ist, wie viele neue Zeilen, und die Knöpfe. */}
      {editing && (
        <div className="wk-table-edit" role="group" aria-label="Edycja tabeli">
          <span className="wk-hint">
            Zmień odpowiedzi w komórkach{canAdd ? ' albo dopisz nowe osoby' : ''} i zapisz. Kolumn pytań zdjętych z
            formularza nie da się zmieniać. Zmiana numeru telefonu kasuje jego potwierdzenie.
          </span>
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={saving || touched === 0} onClick={() => void save()}>
              {saving ? 'Zapisywanie…' : `Zapisz zmiany (${touched})`}
            </button>
            {canAdd && (
              <button type="button" className="wk-link-btn" disabled={saving} onClick={() => setFresh((was) => [{}, ...was])}>
                + Dodaj wiersz
              </button>
            )}
            <button type="button" className="wk-link-btn" disabled={saving} onClick={stop}>Odrzuć zmiany</button>
          </div>
        </div>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {said !== null && <p className="wk-done" role="status">{said}</p>}

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
                    {editing && c.locked === true && <span className="wk-hint" title="Tę odpowiedź wpisuje i poprawia tylko sama osoba"> (tylko osoba)</span>}
                    <span aria-hidden="true">{sort.key === c.key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 0086 — die neuen Zeilen oben, solange geschrieben wird. */}
            {editing && fresh.map((one, at) => (
              <tr key={`new-${at}`} className="wk-row-new">
                {columns.map((c) => (
                  <td key={c.key}>
                    {c.key === 'at' ? (
                      <span className="wk-tag">nowy</span>
                    ) : c.field !== null && c.locked !== true ? (
                      <CellInput
                        field={c.field} value={one[c.key] ?? ''} original="" cell={`new${at}|${c.key}`}
                        onChange={(value) => setFresh((was) => was.map((r, i) => (i === at ? { ...r, [c.key]: value } : r)))}
                      />
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
            {shown.map((row) => (
              <tr key={row.id} className={row.hidden || row.withdrawn ? 'wk-row-muted' : draft.has(row.id) ? 'wk-row-changed' : undefined}>
                {columns.map((c, i) => (
                  <td key={c.key} className={c.numeric ? 'wk-num' : undefined}>
                    {editing && c.field !== null && c.locked !== true && !row.withdrawn ? (
                      <CellInput
                        field={c.field} value={draftOf(row.id, c.key)} original={rawOf(row.id, c.key)} cell={`${row.id}|${c.key}`}
                        onChange={(value) => setCell(row.id, c.key, value)}
                      />
                    ) : cell(row, c.key)}
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
 * 0086 — EINE ZELLE ZUM SCHREIBEN, nach der Art ihrer Frage. Eine Zustimmung
 * bleibt bei ihrem Wortlaut: wer sie nur stehen lässt, ändert nichts; wer sie
 * neu ankreuzt, trägt den heutigen Text der Frage ein.
 */
function CellInput({ field, value, original, cell, onChange }: {
  field: OpenField;
  value: string;
  original: string;
  /** `Einsendung|Frage` — damit sich die Zelle finden lässt. */
  cell: string;
  onChange: (value: string) => void;
}) {
  const label = field.label ?? 'pytanie';

  switch (field.kind) {
    case 'checkbox':
      return <input type="checkbox" data-cell={cell} aria-label={label} checked={isYes(value)} onChange={(e) => onChange(e.target.checked ? YES : '')} />;
    case 'consent':
      return (
        <input
          type="checkbox" data-cell={cell} aria-label={label} checked={consentGiven(value)}
          onChange={(e) => onChange(!e.target.checked ? '' : consentGiven(original) ? original : consentValue(field.help ?? field.label ?? ''))}
        />
      );
    case 'choice': {
      const options = value !== '' && !field.options.includes(value) ? [...field.options, value] : field.options;
      return (
        <select data-cell={cell} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    case 'date':
      return <input type="date" data-cell={cell} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />;
    case 'text':
      return <textarea data-cell={cell} aria-label={label} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />;
    default:
      return (
        <input
          type={field.kind === 'email' ? 'email' : field.kind === 'phone' ? 'tel' : 'text'}
          inputMode={field.kind === 'number' || field.kind === 'pesel' ? 'numeric' : undefined}
          data-cell={cell} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}
        />
      );
  }
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

  const base = name.trim().toLocaleLowerCase('pl')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'zgloszenia';

  /* In der App fragt das System, wohin; im Browser lädt es herunter wie immer. */
  void saveBlob(blob, `${base}-${new Date().toISOString().slice(0, 10)}.csv`).catch(() => undefined);
}

export default FormTable;
