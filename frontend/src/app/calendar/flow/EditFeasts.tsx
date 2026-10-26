/**
 * 2026-10-26 — DER KALENDER DER FESTE (Knoten „Kalendarz świąt") bearbeiten.
 *
 * Eine Zeile je Obchód: Name, wann (eine Regel, `EditDateRule`), Rang, Farbe,
 * ob der Tag die Messen des Sonntags hat, ein eigener Titel der Messe, und ob
 * er auf den nächsten Tag rückt, wenn der Tag selbst höher steht. Die Vorlage
 * bringt viele Zeilen mit — darum steht jede zu, bis man sie aufmacht, und
 * oben ist ein Suchfeld.
 */

import { useState } from 'react';

import { EditDateRule } from './EditDateRule';
import { ColourInput, ColourSwatch } from './EditSeason';
import type { DateRule, FeastRow, FeastsData } from './flowModel';
import { RANK_LABEL, RANK_SHORT, ruleSummary } from './FlowNodes';

/** Wonach „Uporządkuj" sortiert: feste Tage nach Monat und Tag, bewegliche dahinter nach ihrem Bezug. */
function order(rule: DateRule): number {
  switch (rule.r) {
    case 'fixed': return rule.month * 100 + rule.day;
    case 'sunday-after': return rule.month * 100 + rule.day + 0.5;
    case 'nth-weekday': return rule.month === undefined ? 1400 + rule.n : rule.month * 100 + Math.max(1, rule.n) * 7;
    case 'baptism': return 1500;
    case 'christmas-sunday': return 1501;
    case 'easter': return 2000 + rule.offset;
    case 'advent': return 3000 + rule.offset;
  }
}

const EMPTY_ROW: FeastRow = { name: '', when: { r: 'fixed', month: 1, day: 1 }, rank: 10, colour: 'biały' };

export function EditFeasts({ data, onChange, disabled = false }: {
  data: FeastsData; onChange: (data: FeastsData) => void; disabled?: boolean;
}) {
  const rows = data.rows ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const [filter, setFilter] = useState('');

  const put = (next: readonly FeastRow[]) => onChange({ ...data, rows: next });
  const patch = (i: number, change: Partial<FeastRow>) => put(rows.map((r, j) => (j === i ? { ...r, ...change } : r)));
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    put(next);
    setOpen(j);
  };
  const remove = (i: number) => { put(rows.filter((_, j) => j !== i)); setOpen(null); };
  const add = () => { put([...rows, EMPTY_ROW]); setOpen(rows.length); setFilter(''); };
  const sort = () => {
    const sorted = rows.map((r, i) => ({ r, i })).sort((a, b) => order(a.r.when) - order(b.r.when) || a.i - b.i).map((x) => x.r);
    put(sorted);
    setOpen(null);
  };

  const needle = filter.trim().toLowerCase();
  const shown = rows.map((row, i) => ({ row, i })).filter(({ row }) => needle === '' || row.name.toLowerCase().includes(needle));

  return (
    <div className="wk-flow-stack">
      <p className="wk-flow-note">
        Z obchodów, które przypadają danego dnia, wygrywa ten o najwyższej randze (najmniejsza liczba) — jeśli jest
        ważniejszy niż sam dzień (np. niedziela Adwentu ma rangę 2). Ustawia obchód, kolor i dzień świąteczny.
      </p>
      <div className="wk-flow-inline">
        <input type="search" value={filter} placeholder="Szukaj obchodu" aria-label="Szukaj obchodu" onChange={(e) => setFilter(e.target.value)} />
        <span className="wk-flow-unit">{needle === '' ? `${rows.length} obchodów` : `${shown.length} z ${rows.length}`}</span>
      </div>

      {rows.length === 0 && <p className="wk-empty">Tabela jest pusta — dodaj pierwszy obchód.</p>}

      <ol className="wk-flow-rows">
        {shown.map(({ row, i }) => (
          <li key={i} className={`wk-flow-row${open === i ? ' is-open' : ''}`}>
            <button type="button" className="wk-flow-rowhead" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <ColourSwatch word={row.colour} />
              <span className="wk-flow-rowname">{row.name.trim() || '(bez nazwy)'}</span>
              <span className="wk-flow-rowmeta">{ruleSummary(row.when)} · {RANK_SHORT[row.rank] ?? row.rank}{row.festive ? ' · świąteczny' : ''}</span>
            </button>
            {open === i && (
              <div className="wk-flow-rowedit">
                <label className="wk-field">
                  <span>Nazwa obchodu</span>
                  <input value={row.name} disabled={disabled} autoFocus={row.name === ''} placeholder="np. Uroczystość NMP Królowej Polski"
                    onChange={(e) => patch(i, { name: e.target.value })} />
                </label>
                <div className="wk-field">
                  <span>Kiedy</span>
                  <EditDateRule rule={row.when} disabled={disabled} label={row.name || 'Obchód'} onChange={(when) => patch(i, { when })} />
                </div>
                <label className="wk-field">
                  <span>Ranga</span>
                  <select value={row.rank} disabled={disabled} onChange={(e) => patch(i, { rank: Number(e.target.value) })}>
                    {Object.entries(RANK_LABEL).map(([n, label]) => <option key={n} value={n}>{n}. {label}</option>)}
                  </select>
                </label>
                <div className="wk-field">
                  <span>Kolor szat</span>
                  <ColourInput label="Kolor szat" value={row.colour} disabled={disabled} onChange={(colour) => patch(i, { colour })} />
                </div>
                <label className="wk-field">
                  <span>Tytuł mszy (puste: nazwa obchodu)</span>
                  <input value={row.title ?? ''} disabled={disabled} onChange={(e) => patch(i, { title: e.target.value.trim() === '' ? undefined : e.target.value })} />
                </label>
                <label className="wk-check">
                  <input type="checkbox" checked={row.festive === true} disabled={disabled} onChange={(e) => patch(i, { festive: e.target.checked || undefined })} />
                  <span>Dzień świąteczny — msze jak w niedzielę</span>
                </label>
                <label className="wk-check">
                  <input type="checkbox" checked={row.moveIfImpeded === true} disabled={disabled} onChange={(e) => patch(i, { moveIfImpeded: e.target.checked || undefined })} />
                  <span>Gdy dzień ma wyższą rangę — obchodzić następnego dnia</span>
                </label>
                {!disabled && (
                  <div className="wk-actions">
                    <button type="button" className="wk-link-btn" disabled={i === 0} aria-label="Wyżej" onClick={() => move(i, -1)}>↑ wyżej</button>
                    <button type="button" className="wk-link-btn" disabled={i === rows.length - 1} aria-label="Niżej" onClick={() => move(i, 1)}>↓ niżej</button>
                    <button type="button" className="wk-link-btn wk-danger" onClick={() => remove(i)}>Usuń obchód</button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      {!disabled && (
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-quiet" onClick={add}>+ Dodaj obchód</button>
          {rows.length > 1 && <button type="button" className="wk-link-btn" onClick={sort}>Uporządkuj według daty</button>}
        </div>
      )}
    </div>
  );
}

export default EditFeasts;
