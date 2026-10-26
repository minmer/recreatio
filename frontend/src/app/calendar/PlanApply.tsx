/**
 * 2026-10-26 — EINEN PLAN ANWENDEN (0132, D9–D12): ein Kalender, ein Plan, ein
 * Zeitraum — die Vorschau zeigt jeden Tag mit seinen Messen (Titel, Werte,
 * feste Einträge), und welche schon angelegt sind („już jest": derselbe Plan,
 * dieselbe Stunde, derselbe Tag — `plan_origin`, O3). Dann legt DIESER Browser
 * die neuen als einzelne Termine an: mit dem Schema des Plans, seinen Werten,
 * und den Einträgen „z reguły". Danach haben sie nichts mehr mit dem Plan zu
 * tun (D11 C): wer etwas ändern will, ändert die Termine — einzeln oder
 * mehrere zugleich.
 */

import { useState } from 'react';

import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { Modal } from '../ui/Modal';
import { loadAgenda, saveEvent } from './agenda';
import type { CalendarRow } from './calendar';
import { calendarLabel } from './calendarLabel';
import { useCalendarDocs } from './calendarDocs';
import type { AreaRow } from '../areas/area';
import type { PlannedDay } from './flow/flowModel';
import { planRange } from './flow/flowRun';
import { addRecord } from './records';
import { colourClass, schemeOf, shownFields } from './scheme';
import { draftValues, saveDayValues } from './schemeValues';
import { areaKeys, newestKey } from '../chat/chat';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plusDays = (key: string, n: number) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() + n); return iso(d); };
const dayName = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' });

export function PlanApply({ me, areas, calendars, calendarId: firstCalendar, planId: firstPlan, onClose, onDone }: {
  me: Me;
  areas: readonly AreaRow[];
  /** Kalender, in denen ich schreibe. */
  calendars: readonly CalendarRow[];
  calendarId?: string;
  planId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [calendarId, setCalendarId] = useState(firstCalendar ?? calendars[0]?.calendarId ?? '');
  const calendar = calendars.find((c) => c.calendarId === calendarId);
  const docs = useCalendarDocs(me.ring, calendarId || null);
  const [planId, setPlanId] = useState(firstPlan ?? '');
  const plan = docs?.plans.find((p) => p.docId === planId) ?? (firstPlan === undefined ? docs?.plans[0] : undefined);
  const tomorrow = plusDays(iso(new Date()), 1);
  const [from, setFrom] = useState(tomorrow);
  const [to, setTo] = useState('');
  const until = to !== '' ? to : plusDays(from, (plan?.def.weeks ?? 8) * 7 - 1);

  const [preview, setPreview] = useState<{ days: readonly PlannedDay[]; planned: ReadonlySet<string> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const originOf = (date: string, slot: string) => `${plan!.docId}|${slot}|${date}`;
  /* Das Farbfeld des Schemas — in der Vorschau als Plättchen. */
  const colourKey = schemeOf(docs?.schemes ?? [], plan?.def.schemeId ?? null).def.fields.find((f) => f.type === 'colour')?.key;

  const show = async () => {
    if (plan === undefined || calendar === undefined) return;
    setBusy(true);
    setFailed(null);
    setDone(null);
    try {
      const days = planRange(plan.def, from, until);
      /* Was dieser Plan in dem Zeitraum schon angelegt hat. */
      const agenda = await loadAgenda(new Date(`${from}T00:00:00`), new Date(`${plusDays(until, 1)}T00:00:00`));
      const planned = new Set(agenda.occurrences
        .filter((o) => o.calendarId === calendar.calendarId && typeof o.planOrigin === 'string' && o.planOrigin.startsWith(`${plan.docId}|`))
        .map((o) => o.planOrigin!));
      setPreview({ days, planned });
    } catch (e) {
      setFailed(e instanceof WorkspaceError || e instanceof Error ? e.message : 'Nie udało się policzyć planu.');
    } finally {
      setBusy(false);
    }
  };

  const fresh = preview === null ? [] : preview.days.flatMap((d) => d.masses.filter((m) => !preview.planned.has(originOf(d.date, m.slot.key))).map((m) => ({ day: d, mass: m })));

  const create = async () => {
    if (plan === undefined || calendar === undefined || preview === null) return;
    setBusy(true);
    setFailed(null);
    const scheme = schemeOf(docs?.schemes ?? [], plan.def.schemeId ?? null);
    const kind = plan.def.kind ?? scheme.def.kind ?? 'mass';
    const itemFields = shownFields(scheme.def, kind, 'item');
    const dayFields = shownFields(scheme.def, kind, 'day');
    const seenBy = calendar.visibilityAreaId ?? calendar.areaId;
    let made = 0;
    let records = 0;
    const problems: string[] = [];
    try {
      const newest = newestKey(await areaKeys(me.ring, seenBy, true));
      if (newest === null) throw new WorkspaceError('Nie masz klucza obszaru, który widzi ten kalendarz.');
      for (const [i, { day, mass }] of fresh.entries()) {
        setStage(`Tworzenie ${i + 1} z ${fresh.length}…`);
        try {
          const id = await saveEvent(me.ring, {
            kind, title: mass.title, location: '', notes: '', areaId: seenBy, ownerRoleId: me.person.id,
            date: day.date, time: mass.slot.time, minutes: mass.slot.minutes, allDay: false,
            repeat: 'none', every: 1, weekdays: 0, until: null, count: null,
            calendarId: calendar.calendarId,
            schemeId: plan.def.schemeId ?? null,
            values: draftValues(itemFields, mass.values),
            publicTitle: scheme.def.publicTitle,
            planOrigin: originOf(day.date, mass.slot.key)
          });
          made += 1;
          const dayValues = draftValues(dayFields, mass.values);
          if (dayValues.length > 0 || mass.records.length > 0) {
            /* Das Vorkommen, wie der Dienst es rechnet (in der Zone des Kalenders). */
            const agenda = await loadAgenda(new Date(`${day.date}T00:00:00`), new Date(`${plusDays(day.date, 1)}T00:00:00`));
            const at = agenda.occurrences.find((o) => o.itemId === id)?.occurrenceAt;
            if (at === undefined) { problems.push(`${day.date} ${mass.slot.time}: nie znaleziono utworzonego terminu.`); continue; }
            if (dayValues.length > 0) await saveDayValues(id, at, newest, seenBy, dayValues);
            for (const r of mass.records) {
              await addRecord(me.ring, id, calendar.areaId, {
                occurrenceAt: at, listKey: r.list, mode: r.mode ?? null, textPublic: r.text, origin: 'rule', status: 'accepted'
              });
              records += 1;
            }
          }
        } catch (e) {
          problems.push(`${day.date} ${mass.slot.time}: ${e instanceof WorkspaceError ? e.message : 'nie udało się.'}`);
        }
      }
      setDone(`Utworzono ${made} ${made === 1 ? 'termin' : 'terminów'}${records > 0 ? `, wpisów z reguły: ${records}` : ''}.${problems.length > 0 ? ` Problemy: ${problems.slice(0, 5).join(' · ')}${problems.length > 5 ? ` … i ${problems.length - 5} więcej` : ''}` : ''}`);
      setPreview(null);
      onDone();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się utworzyć terminów.');
    } finally {
      setStage(null);
      setBusy(false);
    }
  };

  return (
    <Modal title="Zaplanuj terminy" onClose={onClose} wide>
      <div className="wk-plan">
        <div className="wk-sch-head">
          <label className="wk-field">
            <span>Kalendarz</span>
            <select value={calendarId} disabled={busy} onChange={(e) => { setCalendarId(e.target.value); setPlanId(''); setPreview(null); }}>
              {calendars.map((c) => <option key={c.calendarId} value={c.calendarId}>{calendarLabel(areas, c)}</option>)}
            </select>
          </label>
          <label className="wk-field">
            <span>Plan</span>
            <select value={plan?.docId ?? ''} disabled={busy || docs === null} onChange={(e) => { setPlanId(e.target.value); setPreview(null); }}>
              {docs === null && <option value="">…</option>}
              {docs !== null && docs.plans.length === 0 && <option value="">— ten kalendarz nie ma planów —</option>}
              {(docs?.plans ?? []).map((p) => <option key={p.docId} value={p.docId}>{p.def.name}</option>)}
            </select>
          </label>
          <label className="wk-field">
            <span>Od</span>
            <input type="date" value={from} disabled={busy} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} />
          </label>
          <label className="wk-field">
            <span>Do</span>
            <input type="date" value={until} min={from} disabled={busy} onChange={(e) => { setTo(e.target.value); setPreview(null); }} />
          </label>
        </div>

        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || plan === undefined || from === ''} onClick={() => void show()}>Pokaż, co powstanie</button>
          {preview !== null && (
            <button type="button" className="wk-btn" disabled={busy || fresh.length === 0} onClick={() => void create()}>
              {stage ?? (fresh.length === 0 ? 'Wszystko już zaplanowane' : `Utwórz ${fresh.length} ${fresh.length === 1 ? 'termin' : 'terminów'}`)}
            </button>
          )}
        </div>

        {failed !== null && <p className="wk-error">{failed}</p>}
        {done !== null && <p className="wk-note" role="status">{done}</p>}

        {preview !== null && (
          <ol className="wk-plan-days">
            {preview.days.map((d) => (
              <li key={d.date} className={`wk-plan-day${d.ctx.sunday || d.ctx.festive ? ' is-festive' : ''}`}>
                <div className="wk-plan-dayhead">
                  <span className="wk-plan-date">{dayName(d.date)}</span>
                  <span className={`wk-lc${colourClass(d.ctx.colour) === null ? ' is-none' : ` ${colourClass(d.ctx.colour)}`}`} aria-hidden="true" />
                  <span className="wk-plan-cel">{d.ctx.celebration?.name ?? (d.ctx.sunday ? d.ctx.sundayName : '')}</span>
                </div>
                {d.masses.length === 0 ? <span className="wk-row-side">bez terminów</span> : (
                  <ul className="wk-plan-masses">
                    {d.masses.map((m) => {
                      const there = preview.planned.has(originOf(d.date, m.slot.key));
                      return (
                        <li key={m.slot.key} className={there ? 'is-there' : undefined}>
                          <strong>{m.slot.time}</strong> {m.title}
                          {colourKey !== undefined && m.values[colourKey] !== undefined && (
                            <span className={`wk-lc ${colourClass(m.values[colourKey]) ?? 'is-none'}`} role="img" aria-label={`kolor ${m.values[colourKey]}`} />
                          )}
                          {m.records.map((r) => <span key={`${r.list}-${r.text}`} className="wk-row-side"> · {r.text}</span>)}
                          {there && <span className="wk-row-side"> · już jest</span>}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {d.problems.map((p) => <p key={p} className="wk-warn">{p}</p>)}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
}

export default PlanApply;
