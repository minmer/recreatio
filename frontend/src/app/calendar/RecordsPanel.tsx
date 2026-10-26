/**
 * 2026-10-26 — DIE EINTRÄGE EINES VORKOMMENS (0132): je Liste des Schemas
 * (Intencje, Zapisy …) was an DIESEM Termin steht, und — wer darf — ein neuer.
 *
 * <b>Die Regel der Liste läuft hier</b> (`checkRule`): vor dem Speichern und
 * beim Annehmen eines wartenden. „Odmów" sagt warum und speichert nichts;
 * „Czeka" speichert wartend. Wer nicht im Kalender schreibt (eine Liste mit
 * `outside`), trägt nur offene Felder ein, und sein Eintrag wartet.
 *
 * Ersetzt das alte `IntentionsPanel`: die Intentionen sind die Liste
 * `intencje` des universellen Schemas. „Msze i nabożeństwa" bleibt die Kanzlei
 * mit allem Weiteren — der Link führt dorthin.
 */

import { useCallback, useEffect, useState } from 'react';

import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { dayKey } from '../masses/mass';
import { viewPath } from '../routes';
import { askText } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import type { OpenedItem } from './agenda';
import type { CalendarRow } from './calendar';
import { nameOfPinned, useAreaPeople } from './PeoplePicker';
import {
  addRecord, checkRule, deleteRecord, isLive, recordsAt, statusWord, updateRecord,
  type OpenRecord, type RecordStatus
} from './records';
import { type RecordList, type SchemeField, shownValue } from './scheme';
import { SchemeInput, SchemeValue } from './SchemeInput';
import type { DraftValue } from './schemeValues';

interface Draft {
  readonly mode: string;
  readonly text: string;
  readonly roleId: string;
  readonly values: Readonly<Record<string, string>>;
}

const EMPTY: Draft = { mode: '', text: '', roleId: '', values: {} };

const draftOfRecord = (r: OpenRecord): Draft => ({
  mode: r.mode ?? '', text: r.textPublic ?? '', roleId: r.roleId ?? '',
  values: Object.fromEntries([...r.values].map(([k, v]) => [k, v.text]))
});

const asValues = (fields: readonly SchemeField[], values: Readonly<Record<string, string>>, outside: boolean): DraftValue[] =>
  fields
    .filter((f) => !outside || f.public === true)
    .map((f) => (f.public === true
      ? { key: f.key, text: shownValue(f, values[f.key] ?? ''), publicLabel: f.label }
      : { key: f.key, text: values[f.key] ?? '' }));

export function RecordsPanel({ me, item, start, calendar, lists, writer, onChanged }: {
  me: Me;
  item: OpenedItem;
  /** Wann dieses Vorkommen wirklich ist (verlegt: eine andere Zeit als seine Adresse). */
  start: Date;
  calendar: CalendarRow | undefined;
  lists: readonly RecordList[];
  /** Schreibt im Kalender (die Kanzlei). */
  writer: boolean;
  onChanged?: () => void;
}) {
  const o = item.occurrence;
  const [records, setRecords] = useState<readonly OpenRecord[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<Record<string, Draft>>({});
  const [editing, setEditing] = useState<{ id: string; draft: Draft } | null>(null);
  const people = useAreaPeople(me, writer && lists.some((l) => l.person !== undefined) ? calendar?.areaId ?? null : null);

  const load = useCallback(async () => {
    try {
      setRecords(await recordsAt(me.ring, o.itemId, o.occurrenceAt));
    } catch (e) {
      setRecords([]);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać wpisów.');
    }
  }, [me.ring, o.itemId, o.occurrenceAt]);

  useEffect(() => { void load(); }, [load]);

  const run = async (todo: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try {
      await todo();
      await load();
      onChanged?.();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  const sealArea = writer ? calendar?.areaId ?? null : null;
  const visibleLists = lists.filter((l) => writer || l.outside === true || (records ?? []).some((r) => r.listKey === l.key));

  const add = (list: RecordList) => run(async () => {
    const draft = adding[list.key] ?? EMPTY;
    const values = asValues(list.fields, draft.values, !writer);
    const verdict = await checkRule(list, {
      calendarId: o.calendarId, itemId: o.itemId, occurrenceAt: o.occurrenceAt, start,
      actor: writer ? 'office' : 'outside', mode: draft.mode || null,
      values: Object.fromEntries(values.map((v) => [v.key, v.text]))
    });
    if (verdict.verdict === 'refuse') throw new WorkspaceError(verdict.message ?? 'Tego wpisu nie da się dodać.');
    await addRecord(me.ring, o.itemId, sealArea, {
      occurrenceAt: o.occurrenceAt, listKey: list.key, mode: draft.mode || null,
      textPublic: list.textLabel !== undefined ? draft.text : null,
      roleId: writer ? (draft.roleId || null) : (list.person !== undefined ? me.person.id : null),
      status: verdict.verdict === 'wait' || !writer ? 'waiting' : 'accepted',
      values
    });
    setAdding((was) => ({ ...was, [list.key]: EMPTY }));
  });

  const setStatus = (list: RecordList, record: OpenRecord, status: RecordStatus) => run(async () => {
    if (status === 'accepted' && record.status === 'waiting') {
      const verdict = await checkRule(list, {
        calendarId: o.calendarId, itemId: o.itemId, occurrenceAt: o.occurrenceAt, start,
        actor: 'office', mode: record.mode, except: record.recordId,
        values: Object.fromEntries([...record.values].map(([k, v]) => [k, v.text]))
      });
      if (verdict.verdict === 'refuse') throw new WorkspaceError(verdict.message ?? 'Reguła listy nie pozwala przyjąć tego wpisu.');
    }
    await updateRecord(me.ring, record, sealArea, { status });
  });

  const move = (list: RecordList, record: OpenRecord, step: -1 | 1) => run(async () => {
    const mine = (records ?? []).filter((r) => r.listKey === list.key);
    const at = mine.findIndex((r) => r.recordId === record.recordId);
    const other = mine[at + step];
    if (other === undefined) return;
    await updateRecord(me.ring, record, sealArea, { ordinal: other.ordinal === record.ordinal ? other.ordinal + step : other.ordinal });
    await updateRecord(me.ring, other, sealArea, { ordinal: record.ordinal });
  });

  const saveEdit = (list: RecordList, record: OpenRecord, draft: Draft) => run(async () => {
    await updateRecord(me.ring, record, sealArea, {
      mode: draft.mode || null,
      textPublic: list.textLabel !== undefined ? draft.text.trim() : undefined,
      roleId: list.person !== undefined ? draft.roleId : undefined,
      values: asValues(list.fields, draft.values, false)
    });
    setEditing(null);
  });

  const remove = async (record: OpenRecord) => {
    if (!(await askText('Usunąć ten wpis?'))) return;
    void run(() => deleteRecord(record.recordId));
  };

  if (visibleLists.length === 0) return null;

  return (
    <div className="wk-recs">
      {visibleLists.map((list) => {
        const mine = (records ?? []).filter((r) => r.listKey === list.key);
        const live = mine.filter((r) => isLive(r.status)).length;
        const draft = adding[list.key] ?? EMPTY;
        const fieldsHere = writer ? list.fields : list.fields.filter((f) => f.public === true);
        return (
          <section key={list.key} className="wk-rec" aria-label={list.label}>
            <h3 className="wk-rec-head">{list.label}{live > 0 && <span className="wk-row-side"> · {live}</span>}</h3>

            {records === null ? <Loading label="Wczytywanie wpisów…" /> : mine.length === 0 ? (
              <p className="wk-empty">Bez wpisów.</p>
            ) : (
              <ol className="wk-rec-list">
                {mine.map((r, i) => editing?.id === r.recordId ? (
                  <li key={r.recordId} className="wk-rec-row is-editing">
                    <RecordForm list={list} fields={list.fields} draft={editing.draft} people={people} writer busy={busy}
                      onChange={(d) => setEditing({ id: r.recordId, draft: d })}
                      onSubmit={() => void saveEdit(list, r, editing.draft)} onCancel={() => setEditing(null)} submit="Zapisz" />
                  </li>
                ) : (
                  <li key={r.recordId} className={`wk-rec-row is-${r.status}`}>
                    <div className="wk-rec-main">
                      <span className="wk-rec-text">{r.textPublic || (list.itemLabel ?? 'wpis')}</span>
                      <span className="wk-rec-meta">
                        {r.mode !== null && <span>{list.modes?.find((m) => m.value === r.mode)?.label ?? r.mode}</span>}
                        {r.roleId !== null && list.person !== undefined && <span>{list.person}: {r.roleId === me.person.id ? 'Ty' : nameOfPinned(me, people, r.roleId)}</span>}
                        {list.fields.filter((f) => r.values.has(f.key)).map((f) => (
                          <span key={f.key}>{f.label}: <SchemeValue field={f} text={shownValue(f, r.values.get(f.key)!.text)} /></span>
                        ))}
                        {r.origin === 'rule' && <span>z reguły</span>}
                        {r.status !== 'accepted' && <span className={`wk-rec-status is-${r.status}`}>{statusWord(list.key, r.status)}</span>}
                      </span>
                    </div>
                    {writer ? (
                      <div className="wk-rec-acts">
                        <button type="button" className="wk-link-btn" disabled={busy || i === 0} aria-label="Wyżej" onClick={() => void move(list, r, -1)}>↑</button>
                        <button type="button" className="wk-link-btn" disabled={busy || i === mine.length - 1} aria-label="Niżej" onClick={() => void move(list, r, 1)}>↓</button>
                        {r.status === 'waiting' && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void setStatus(list, r, 'accepted')}>Przyjmij</button>}
                        {r.status === 'waiting' && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void setStatus(list, r, 'declined')}>Odrzuć</button>}
                        {r.status === 'accepted' && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void setStatus(list, r, 'celebrated')}>{list.key === 'intencje' ? 'Odprawiona' : 'Odbyty'}</button>}
                        {(r.status === 'celebrated' || r.status === 'cancelled' || r.status === 'declined') && (
                          <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void setStatus(list, r, 'accepted')}>Przywróć</button>
                        )}
                        {r.status === 'accepted' && <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void setStatus(list, r, 'cancelled')}>Wycofaj</button>}
                        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setEditing({ id: r.recordId, draft: draftOfRecord(r) })}>Zmień</button>
                        {r.status !== 'celebrated' && <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={() => void remove(r)}>Usuń</button>}
                      </div>
                    ) : r.mine && (r.status === 'waiting' || r.status === 'accepted') ? (
                      <div className="wk-rec-acts">
                        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => updateRecord(me.ring, r, null, { status: 'cancelled' }))}>Wycofaj</button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}

            {(writer || list.outside === true) && item.occurrence.status !== 'cancelled' && (
              <RecordForm list={list} fields={fieldsHere} draft={draft} people={people} writer={writer} busy={busy}
                onChange={(d) => setAdding((was) => ({ ...was, [list.key]: d }))}
                onSubmit={() => void add(list)} submit={writer ? 'Dodaj' : 'Zgłoś'} />
            )}

            {list.key === 'intencje' && writer && calendar !== undefined && (
              <a className="wk-link wk-rec-office" href={viewPath('masses', calendar.calendarId, dayKey(start.toISOString()), o.itemId)}>
                Otwórz w „Msze i nabożeństwa”
              </a>
            )}
          </section>
        );
      })}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

function RecordForm({ list, fields, draft, people, writer, busy, onChange, onSubmit, onCancel, submit }: {
  list: RecordList;
  fields: readonly SchemeField[];
  draft: Draft;
  people: ReturnType<typeof useAreaPeople>;
  writer: boolean;
  busy: boolean;
  onChange: (next: Draft) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submit: string;
}) {
  /* Leer ist ein Eintrag ohne alles: ein gewählter Rodzaj („będę") reicht, und wer sich von aussen
     in eine Liste mit Person einträgt, ist selbst der Inhalt. */
  const empty = draft.mode === ''
    && (list.textLabel === undefined || draft.text.trim() === '')
    && (list.person === undefined || (writer && draft.roleId === ''))
    && fields.every((f) => (draft.values[f.key] ?? '').trim() === '');
  return (
    <form className="wk-rec-form" onSubmit={(e) => { e.preventDefault(); if (!empty) onSubmit(); }}>
      {list.modes !== undefined && list.modes.length > 0 && (
        <div className="wk-seg" role="group" aria-label="Rodzaj">
          {list.modes.map((m) => (
            <button key={m.value} type="button" aria-pressed={draft.mode === m.value}
              className={draft.mode === m.value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
              onClick={() => onChange({ ...draft, mode: draft.mode === m.value ? '' : m.value })}>{m.label}</button>
          ))}
        </div>
      )}
      {list.textLabel !== undefined && (
        <input value={draft.text} maxLength={400} disabled={busy} aria-label={list.textLabel} placeholder={list.textLabel}
          onChange={(e) => onChange({ ...draft, text: e.target.value })} />
      )}
      {writer && list.person !== undefined && (
        <select value={draft.roleId} disabled={busy || people === null} aria-label={list.person} onChange={(e) => onChange({ ...draft, roleId: e.target.value })}>
          <option value="">{list.person}: —</option>
          {(people ?? []).map((p) => <option key={p.roleId} value={p.roleId}>{p.name}</option>)}
        </select>
      )}
      {fields.map((f) => (
        <label key={f.key} className="wk-rec-field">
          <span>{f.label}</span>
          <SchemeInput field={f} value={draft.values[f.key] ?? ''} people={people} disabled={busy}
            onChange={(v) => onChange({ ...draft, values: { ...draft.values, [f.key]: v } })} />
        </label>
      ))}
      <div className="wk-actions">
        <button type="submit" className="wk-btn wk-btn-small" disabled={busy || empty}>{busy ? 'Zapisywanie…' : submit}</button>
        {onCancel !== undefined && <button type="button" className="wk-link-btn" disabled={busy} onClick={onCancel}>Anuluj</button>}
      </div>
    </form>
  );
}
