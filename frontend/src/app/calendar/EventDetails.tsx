/**
 * Ein Termin zum Lesen: wann, wo, wer, das Programm.
 */

import { useState } from 'react';

import type { AreaRow } from '../areas/area';
import { fromLocal, groupName, localDate, localTime } from '../areas/WhoSees';
import { longDate, sameDay } from '../core/dayMath';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { Modal } from '../ui/Modal';
import { type CalendarRow, DUTY_LABEL, setPeople } from './calendar';
import { calendarLabel } from './calendarLabel';
import { type CalEvent, programOf } from './calendarModel';
import { dutyOf, peopleWord, time } from './eventWords';
import { ItemLink } from './ItemLink';
import { PeoplePicker, type Pinned, nameOfPinned, useAreaPeople } from './PeoplePicker';
import { useCalendarDocs } from './calendarDocs';
import { RecordsPanel } from './RecordsPanel';
import { schemeOf, shownLists, shownValue } from './scheme';
import { SchemeValue } from './SchemeInput';

/**
 * 0070 — DAS PROGRAMM EINES TERMINS: seine Teile (aus den geladenen
 * Terminen), in Reihenfolge — und, wenn er selbst ein Teil ist, sein Ganzes.
 *
 * 2026-10-17 — EIN NEUER PUNKT BRAUCHT NUR SEINEN NAMEN (und wann er
 * beginnt und endet — vorgeschlagen: nach dem letzten Punkt des Tages, eine
 * Stunde, höchstens bis zum Ende des Ganzen). Alles andere teilt er mit dem
 * Ganzen (`onQuickAdd`); wer mehr will, öffnet ihn danach aus der Liste.
 *
 * 2026-10-24 — nur noch die Punkte. Die Wahl „Część programu" (unter welchem
 * Termin dieser steht) ist fort: einen Termin hängt man von seinem Ganzen aus
 * ein („Podłącz istniejący termin"); ob einer ein Punkt ist, sagt der Editor
 * in einer Zeile, mit „odłącz".
 */
export function ProgramOf({ itemId, start, end, events, parentId, onQuickAdd, onOpen, onLink, onUnlink }: {
  /** Der Termin, dessen Punkte es sind (ein gespeicherter — ein neuer hat noch keine). */
  itemId: string;
  start: Date;
  /** Das Ende des Ganzen — ein neuer Punkt beginnt nicht danach. */
  end?: Date;
  events: readonly CalEvent[];
  /** Das Ganze DIESES Termins, falls er selbst ein Punkt ist — es und seine Ganzen lassen sich nicht als Punkte einhängen. */
  parentId: string | null;
  /** 2026-10-17 — einen Punkt anlegen: Name, Beginn, Dauer in Minuten; den Rest teilt er mit dem Ganzen. */
  onQuickAdd?: (title: string, at: Date, minutes: number) => Promise<void>;
  /** 2026-10-17 — einen Punkt öffnen (aus der Liste des Programms). */
  onOpen?: (part: CalEvent) => void;
  /** 0074 — einen BESTEHENDEN Termin als Punkt einhängen (sofort, ohne ihn zu öffnen). */
  onLink?: (childItemId: string) => Promise<void>;
  onUnlink?: (childItemId: string) => Promise<void>;
}) {
  const [linking, setLinking] = useState(false);
  /* Der neue Punkt, solange er eingetippt wird — `null`: zu. */
  const [draft, setDraft] = useState<{ title: string; time: string; until: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [addFailed, setAddFailed] = useState<string | null>(null);

  /* Je Termin einmal — eine Reihe steht sonst mit jedem Vorkommen da. */
  const items = new Map<string, CalEvent>();
  for (const e of events) {
    const place = programOf(e);
    if (place !== null && (e.source === 'item' || e.source === 'offer') && !items.has(place.itemId)) items.set(place.itemId, e);
  }
  const parentOf = (id: string) => (items.get(id) === undefined ? null : programOf(items.get(id)!)?.parentItemId ?? null);
  const ancestors = new Set<string>();
  for (let up = parentId, depth = 0; up !== null && depth < 10; up = parentOf(up), depth += 1) ancestors.add(up);

  const parts = [...items.values()]
    .filter((e) => programOf(e)?.parentItemId === itemId)
    .sort((a, b) => ((programOf(a)?.position ?? 1e9) - (programOf(b)?.position ?? 1e9)) || a.start.getTime() - b.start.getTime());

  /* Nach Nähe in der Zeit — wer einen Ausflug baut, sucht die Termine desselben Tages. */
  const near = (a: CalEvent, b: CalEvent) => Math.abs(a.start.getTime() - start.getTime()) - Math.abs(b.start.getTime() - start.getTime());
  const childChoices = [...items.entries()]
    .filter(([id, e]) => id !== itemId && !ancestors.has(id) && programOf(e)?.parentItemId !== itemId)
    .map(([, e]) => e).sort(near).slice(0, 60);
  /* Wo der nächste Punkt beginnt: wo der letzte dieses Tages endet — solange das im Ganzen liegt. */
  const nextAt = (): Date => {
    const last = parts.filter((p) => sameDay(p.start, start)).reduce((at, p) => Math.max(at, p.end.getTime()), start.getTime());
    return end !== undefined && last >= end.getTime() ? start : new Date(last);
  };
  /* Vorschlag fürs Ende: eine Stunde — höchstens bis zum Ende des Ganzen. */
  const endFor = (from: Date): Date => {
    const room = end === undefined ? 60 : Math.round((end.getTime() - from.getTime()) / 60_000);
    return new Date(from.getTime() + (room >= 15 ? Math.min(60, room) : 60) * 60_000);
  };
  const openDraft = () => {
    const from = nextAt();
    setDraft({ title: '', time: localTime(from), until: localTime(endFor(from)) });
  };
  /* Ein anderer Beginn nimmt das Ende mit — die Dauer bleibt. */
  const moveStart = (time: string) => {
    if (draft === null) return;
    const was = fromLocal(localDate(start), draft.time).getTime();
    const length = fromLocal(localDate(start), draft.until).getTime() - was;
    const now = fromLocal(localDate(start), time);
    setDraft({ ...draft, time, until: time === '' || length <= 0 ? draft.until : localTime(new Date(now.getTime() + length)) });
  };
  const draftMinutes = draft === null || draft.time === '' || draft.until === '' ? 0
    : Math.round((fromLocal(localDate(start), draft.until).getTime() - fromLocal(localDate(start), draft.time).getTime()) / 60_000);

  const addPart = () => {
    if (draft === null || onQuickAdd === undefined || draft.title.trim() === '' || draftMinutes <= 0) return;
    const at = fromLocal(localDate(start), draft.time);
    const minutes = draftMinutes;
    setAdding(true);
    setAddFailed(null);
    void onQuickAdd(draft.title.trim(), at, minutes)
      .then(() => setDraft(null), (e: unknown) => setAddFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się dodać punktu.'))
      .finally(() => setAdding(false));
  };

  const label = (e: CalEvent) => `${e.title} · ${e.allDay ? longDate(e.start) : `${longDate(e.start)} ${time(e.start)}`}`;

  return (
    <section className="wk-ev-program" aria-label="Program">
      {parts.length > 0 ? (
        <ol className="wk-ev-program-list">
          {parts.map((p) => (
            <li key={programOf(p)!.itemId} className="wk-ev-program-row">
              {/* Am Tag des Ganzen genügt die Uhrzeit. */}
              <span className="wk-ev-part-time">
                {p.allDay ? longDate(p.start) : sameDay(p.start, start) ? `${time(p.start)}–${time(p.end)}` : `${longDate(p.start)} ${time(p.start)}`}
              </span>
              <span className="wk-ev-program-main">
                {onOpen !== undefined
                  ? <button type="button" className="wk-link-btn wk-ev-program-title" onClick={() => onOpen(p)}>{p.title}</button>
                  : <span className="wk-ev-program-title">{p.title}</span>}
                {p.item?.location != null && p.item.location !== '' && <span className="wk-ev-program-place">{p.item.location}</span>}
              </span>
              {onUnlink !== undefined && (
                <button type="button" className="wk-link-btn wk-ev-program-unlink" disabled={linking}
                  onClick={() => { setLinking(true); void onUnlink(programOf(p)!.itemId).finally(() => setLinking(false)); }}>odłącz</button>
              )}
            </li>
          ))}
        </ol>
      ) : <p className="wk-empty">Jeszcze bez punktów programu.</p>}

      {draft !== null && (
        <div className="wk-ev-program-new">
          <input aria-label="Nazwa punktu" placeholder="Nazwa punktu, np. Obiad" value={draft.title} maxLength={200} autoFocus disabled={adding}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onKeyDown={(e) => {
              /* Enter dodaje punkt — nie zapisuje całego terminu (to pole stoi w jego formularzu). */
              if (e.key === 'Enter') { e.preventDefault(); addPart(); }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setDraft(null); }
            }} />
          <span className="wk-ev-program-span">
            <input type="time" aria-label="Początek punktu" title="Początek" step={300} value={draft.time} disabled={adding}
              onChange={(e) => moveStart(e.target.value)} />
            <span aria-hidden="true">–</span>
            <input type="time" aria-label="Koniec punktu" title="Koniec" step={300} value={draft.until} disabled={adding}
              onChange={(e) => setDraft({ ...draft, until: e.target.value })} />
          </span>
          <button type="button" className="wk-btn wk-btn-small" disabled={adding || draft.title.trim() === '' || draftMinutes <= 0} onClick={addPart}>
            {adding ? 'Dodawanie…' : 'Dodaj'}
          </button>
          <button type="button" className="wk-link-btn" disabled={adding} onClick={() => setDraft(null)}>Anuluj</button>
          {draftMinutes <= 0 && draft.time !== '' && draft.until !== '' && <p className="wk-error">Koniec musi być po początku.</p>}
          {addFailed !== null && <p className="wk-error">{addFailed}</p>}
        </div>
      )}

      <div className="wk-actions wk-ev-program-add">
        {onQuickAdd !== undefined && draft === null && (
          <button type="button" className="wk-link-btn" onClick={openDraft}>+ Nowy punkt programu</button>
        )}
        {onLink !== undefined && childChoices.length > 0 && (
          <select value="" disabled={linking} aria-label="Podłącz istniejący termin"
            onChange={(e) => {
              if (e.target.value === '') return;
              setLinking(true);
              void onLink(e.target.value).finally(() => setLinking(false));
            }}>
            <option value="">{linking ? 'Podłączanie…' : '+ Podłącz istniejący termin…'}</option>
            {childChoices.map((e) => <option key={programOf(e)!.itemId} value={programOf(e)!.itemId}>{label(e)}</option>)}
          </select>
        )}
      </div>
    </section>
  );
}

/* -- Nur ansehen (und, wer den Kalender führt: wer da sein muss) --------------------------- */

export function Details({ me, areas, calendars, event, onClose, onSaved }: {
  me: Me;
  areas: readonly AreaRow[];
  calendars: readonly CalendarRow[];
  event: CalEvent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const item = event.item;
  const occurrence = item?.occurrence;
  const calendar = occurrence === undefined ? undefined : calendars.find((c) => c.calendarId === occurrence.calendarId);
  const mayPin = calendar?.mayWrite === true && occurrence !== undefined;
  const candidates = useAreaPeople(me, mayPin || (occurrence?.people?.length ?? 0) > 0 ? occurrence!.areaId : null);

  const [editing, setEditing] = useState(false);
  const [pinned, setPinned] = useState<readonly Pinned[]>(occurrence?.people ?? []);
  const [scope, setScope] = useState<'one' | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /* 0132 — das Schema dieses Termins: seine Werte zum Lesen, seine Listen (Intentionen, Anmeldungen). */
  const docs = useCalendarDocs(me.ring, occurrence?.calendarId ?? null);
  const scheme = schemeOf(docs?.schemes ?? [], occurrence?.schemeId ?? null);
  const fields = [...scheme.def.fields];
  const shown = item === undefined ? [] : [...item.values.entries()].map(([key, value]) => {
    const field = fields.find((f) => f.key === key) ?? null;
    return { key, label: field?.label ?? value.label ?? key, field, text: field === null || value.public ? value.text : shownValue(field, value.text) };
  });
  const lists = occurrence === undefined ? [] : shownLists(scheme.def, occurrence.kind);

  const when = event.allDay
    ? longDate(event.start)
    : `${longDate(event.start)}, ${time(event.start)}–${time(event.end)}`;
  const repeating = occurrence !== undefined && occurrence.series.repeatKind !== 'none';

  const savePeople = async () => {
    if (occurrence === undefined) return;
    setBusy(true);
    setFailed(null);
    try {
      await setPeople(occurrence.itemId, pinned, repeating && scope === 'one' ? occurrence.occurrenceAt : undefined);
      onSaved();
      setEditing(false);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={event.title} onClose={onClose}>
      <p className="wk-ev-when">{when}</p>
      <p className="wk-hint">
        {calendar !== undefined ? <>Kalendarz: {calendarLabel(areas, calendar)} · </> : null}
        Widzi: {groupName(areas, event.areaId)}
      </p>
      {calendar?.description && <p className="wk-ev-rules">{calendar.description}</p>}
      {item?.location && <p><strong>Miejsce:</strong> {item.location}</p>}
      {item?.notes && <p className="wk-ev-notes">{item.notes}</p>}
      {item?.link && <p><ItemLink url={item.link} label={item.linkLabel} /></p>}

      {/* 0132 — die Werte seines Schemas (Obchód, Kolor szat …). */}
      {shown.length > 0 && (
        <dl className="wk-sc-show">
          {shown.map((one) => (
            <div key={one.key}>
              <dt>{one.label}</dt>
              <dd><SchemeValue field={one.field} text={one.text} /></dd>
            </div>
          ))}
        </dl>
      )}

      {/* 0079/0132 — was an diesem Vorkommen steht; wer darf, meldet sich (es wartet auf die Kanzlei). */}
      {item !== undefined && lists.length > 0 && (
        <RecordsPanel me={me} item={item} start={event.start} calendar={calendar} lists={lists} writer={calendar?.mayWrite === true && item.editable} onChanged={onSaved} />
      )}

      {/* 0058 — wer da sein muss. */}
      {occurrence !== undefined && (occurrence.people?.length ?? 0) > 0 && !editing && (
        <p className="wk-ev-people">
          {occurrence.people!.map((p) => (
            <span key={p.roleId} className={`wk-ev-person${me.ring.has(p.roleId) ? ' is-me' : ''}`}>
              {DUTY_LABEL[p.duty]}: <strong>{me.ring.has(p.roleId) ? 'Ty' : nameOfPinned(me, candidates, p.roleId)}</strong>
            </span>
          ))}
        </p>
      )}

      {mayPin && editing && (
        <div className="wk-ev-pin">
          {repeating && (
            <div className="wk-seg" role="group" aria-label="Dla których terminów">
              <button type="button" aria-pressed={scope === 'one'} className={scope === 'one' ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
                onClick={() => setScope('one')}>Tylko ten termin</button>
              <button type="button" aria-pressed={scope === 'all'} className={scope === 'all' ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
                onClick={() => setScope('all')}>Cała seria</button>
            </div>
          )}
          <PeoplePicker me={me} candidates={candidates} value={pinned} onChange={setPinned} defaultDuty={dutyOf(occurrence?.kind ?? '')} />
          {failed !== null && <p className="wk-error">{failed}</p>}
          <div className="wk-actions">
            <button type="button" className="wk-btn" disabled={busy} onClick={() => void savePeople()}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>
            <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={() => setEditing(false)}>Anuluj</button>
          </div>
        </div>
      )}

      {event.source === 'claim' && (
        <p className="wk-note">
          To Twoja rezerwacja ({event.claim?.status === 'confirmed' ? 'potwierdzona' : 'czeka na potwierdzenie'}).
          Zmienisz ją tam, gdzie ją zrobiłeś.
        </p>
      )}

      {item !== undefined && !item.editable && !mayPin && (
        <p className="wk-hint">Ten termin możesz tylko oglądać — w jego kalendarzu nie piszesz.</p>
      )}

      <div className="wk-actions">
        {mayPin && !editing && (
          <button type="button" className="wk-btn wk-btn-quiet" onClick={() => setEditing(true)}>
            {peopleWord(occurrence?.kind ?? '')}
          </button>
        )}
        <button type="button" className="wk-btn" onClick={onClose}>Zamknij</button>
      </div>
    </Modal>
  );
}
