/**
 * „Terminy" — die Termine eines Kalenders, die man sich nehmen kann, und wer sich auf sie gesetzt hat.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadAreas } from '../areas/area';
import { type OfficeClaim, type ResourceRow, loadClaims, loadResources, officeAdd, officeClose, officeRemove, updateResource } from '../bookings/resource';
import { type CalendarRow, setOccurrence } from '../calendar/calendar';
import { fmtDate, rich, t, useT } from '../core/i18n';
import { WorkspaceError } from '../core/session';
import { viewPath } from '../routes';
import { loadSeats } from '../seats/seat';
import { askText } from '../ui/dialogs';
import { type OfficeMass, loadOffice } from './mass';
import { WINDOW_DAYS } from './officeDays';

/* -- Termine, die man sich nehmen kann ------------------------------------- */

/**
 * Die Termine eines Kalenders — und wer sich auf sie gesetzt hat.
 *
 * <b>Warum sie nicht bei den Messen stehen.</b> Eine Messe traegt Intentionen,
 * ein Termin traegt Menschen. Das sind zwei verschiedene Vorgaenge mit
 * verschiedenen Handgriffen, und sie in eine Liste zu zwingen hiesse, an jeder
 * Zeile erst zu pruefen, was sie eigentlich ist. Darum eine eigene Liste —
 * derselbe Kalender, dasselbe Fenster, andere Arbeit.
 *
 * <b>Freigegeben wird je VORKOMMEN.</b> „Samstags 10:00" ist eine Reihe;
 * angeboten wird der 14. November. Ein Eintrag ohne Freigabe steht hier
 * trotzdem — sonst muesste man raten, welche Termine es ueberhaupt gibt.
 */
export function Appointments({ calendar, from }: { calendar: CalendarRow; from: string }) {
  const t = useT();
  const [items, setItems] = useState<readonly OfficeMass[]>([]);
  const [resource, setResource] = useState<ResourceRow | null | undefined>(undefined);
  const [claims, setClaims] = useState<readonly OfficeClaim[]>([]);
  const [failed, setFailed] = useState<string | null>(null);

  /** Welche Termine geschlossen sind (0049) — „Termin|Beginn" → wer. */
  const [closed, setClosed] = useState<ReadonlyMap<string, 'office' | 'host'>>(new Map());

  /** Welcher Termin gerade entfernt wird — „Klucz Termin|Beginn". */
  const [removing, setRemoving] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const start = new Date(`${from}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + WINDOW_DAYS);

      const [plan, all] = await Promise.all([
        loadOffice(calendar.calendarId, start, end, ['appointment']),
        loadResources().catch(() => ({ resources: [] as readonly ResourceRow[] }))
      ]);

      const mine = all.resources.find((r) => r.calendarId === calendar.calendarId) ?? null;

      setItems(plan.masses);
      setResource(mine);
      const office = mine === null ? null : await loadClaims(mine.resourceId).catch(() => null);
      setClaims(office?.claims ?? []);
      setClosed(new Map((office?.closed ?? []).map((one) => [termKey(one.itemId, one.occurrenceAt), one.closedBy])));
      setFailed(null);
    } catch (e) {
      setItems([]);
      setFailed(e instanceof WorkspaceError ? e.message : t('masses.terms.loadFailed'));
    }
  }, [calendar.calendarId, from]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  /**
   * EINEN TERMIN ENTFERNEN — dieses eine Vorkommen.
   *
   * <b>Abgesagt, nicht gelöscht.</b> Der Termin fällt aus der Reihe (eine
   * Ausnahme am Kalendereintrag): bei einem einmaligen ist er damit fort, bei
   * einer Reihe fällt nur dieser Tag. Wer darauf sass, wird ausgetragen — das
   * sagt die Frage vorher, mit Namen.
   */
  const remove = async (one: OfficeMass, names: readonly string[]) => {
    const when = stamp(one.startsAt);
    const ask = names.length === 0
      ? t('masses.terms.removeAsk', { when })
      : t('masses.terms.removeAskPeople', { when, names: names.join(', ') });
    if (!(await askText(ask))) return;

    const key = `${one.itemId}|${one.occurrenceAt}`;
    setRemoving(key);
    setFailed(null);
    setRemoved(null);

    try {
      await setOccurrence(one.itemId, one.occurrenceAt, { cancelled: true });
      setRemoved(names.length > 0 ? t('masses.terms.removedPeople', { when, names: names.join(', ') }) : t('masses.terms.removed', { when }));
      await load();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('masses.terms.removeFailed'));
    } finally {
      setRemoving(null);
    }
  };

  /* -- 0049: dopisać, wypisać, zamknąć -------------------------------------------- */

  const [adding, setAdding] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const officeAct = async (what: string, todo: () => Promise<string | null>) => {
    setWorking(what);
    setFailed(null);
    setRemoved(null);

    try {
      const said = await todo();
      if (said !== null) setRemoved(said);
      await load();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('common.failed'));
    } finally {
      setWorking(null);
    }
  };

  /** Jemanden eintragen — mit Link (ein Platz) oder nur mit Namen; auch über die Plätze hinaus. */
  const seat = (one: OfficeMass, who: { seatId?: string; name?: string }) => {
    if (resource == null) return;
    void officeAct(t('masses.terms.adding'), async () => {
      const done = await officeAdd(resource, { itemId: one.itemId, occurrenceAt: one.occurrenceAt }, who);
      setAdding(null);
      const params = { name: who.name ?? t('masses.terms.somebody'), when: stamp(one.startsAt), taken: done.taken, capacity: done.capacity };
      return done.over ? t('masses.terms.addedOver', params) : t('masses.terms.added', params);
    });
  };

  /** Jemanden austragen. */
  const unseat = async (c: OfficeClaim) => {
    if (!(await askText(t(c.hosting ? 'masses.terms.unseatAskHost' : 'masses.terms.unseatAsk', { name: nameOf(c) })))) return;
    void officeAct(t('masses.terms.unseating'), async () => {
      await officeRemove(c.claimId);
      return t('masses.terms.unseated', { name: nameOf(c) });
    });
  };

  /** Schliessen — auch mit freien Plätzen — oder wieder öffnen. */
  const closeTerm = (one: OfficeMass, close: boolean) => {
    if (resource == null) return;
    void officeAct(close ? t('masses.terms.closing') : t('masses.terms.opening'), async () => {
      await officeClose(resource.resourceId, { itemId: one.itemId, occurrenceAt: one.occurrenceAt }, close);
      return t(close ? 'masses.terms.closedDone' : 'masses.terms.openedDone', { when: stamp(one.startsAt) });
    });
  };

  /* Wer auf welchem Termin sitzt — je Vorkommen, am ursprünglichen Beginn. */
  const on = (one: OfficeMass) => claims.filter((c) => c.itemId === one.itemId
    && c.occurrenceAt !== null && new Date(c.occurrenceAt).getTime() === new Date(one.occurrenceAt).getTime()
    && (c.status === 'confirmed' || c.status === 'pending'));

  return (
    <>
      <h4 className="wk-h2">{t('masses.terms.title')}</h4>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {removed !== null && <p className="wk-done">{removed}</p>}
      {working !== null && <p className="wk-hint" role="status">{working}</p>}

      {/*
        WER SICH WORAUF GESETZT HAT, steht bei den Rezerwacje (0039) — und jetzt
        auch hier, je Termin (0045): wer, wer davon Gastgeber ist, und bis wann
        er allein einlädt. Die Regeln des Zasób stehen darüber und lassen sich
        hier ändern — genau dort, wo man sieht, was sie bewirken.
      */}
      {resource === undefined ? null : resource === null ? (
        <p className="wk-hint">
          {rich(t('masses.terms.noResource'), { link: (s) => <a className="wk-link" href={viewPath('bookings', 'new')}>{s}</a> })}
        </p>
      ) : (
        <SlotRules row={resource} onSaved={(row) => setResource(row)} />
      )}

      {items.length === 0 ? (
        <p className="wk-empty">{t('masses.terms.empty')}</p>
      ) : (
        <ul className="wk-list">
          {items.map((one) => {
            const when = new Date(one.startsAt);
            const here = on(one);
            const host = here.find((c) => c.hosting);
            const counted = here.filter((c) => c.status === 'confirmed' || c.awaits === 'office').length;
            const closedBy = closed.get(termKey(one.itemId, one.occurrenceAt)) ?? null;

            return (
              <li className="wk-row wk-appt" key={`${one.itemId}:${one.occurrenceAt}`}>
                <span>
                  <strong>
                    {fmtDate(when, { weekday: 'short', day: 'numeric', month: 'long' }, t.lang)}
                    {', '}
                    {when.toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' })}
                  </strong>
                  {one.title !== null && <> — {one.title}</>}

                  {resource != null && (
                    <span className="wk-row-side">
                      {' · '}{t('masses.terms.taken', { taken: counted, capacity: resource.capacity })}
                      {counted > resource.capacity && ` · ${t('masses.terms.overLimit')}`}
                    </span>
                  )}

                  {closedBy !== null && (
                    <span className="wk-tag"> {closedBy === 'office' ? t('masses.terms.closedByOffice') : t('masses.terms.closedByHost')}</span>
                  )}

                  {/*
                    WER SIEDZI NA TERMINIE — a przy każdym ×, żeby go wypisać
                    (0049). Kancelaria może wypisać każdego, także gospodarza:
                    wtedy wolne miejsca należą do wszystkich.
                  */}
                  {here.length > 0 && (
                    <span className="wk-slot-people">
                      {here.map((c) => (
                        <span className={c.hosting ? 'wk-tag wk-tag-open' : 'wk-tag'} key={c.claimId}>
                          {nameOf(c)}
                          {c.hosting && ` · ${c.hostPending === true ? t('masses.terms.firstDecides') : t('masses.terms.host')}`}
                          {c.byOffice === true && ` · ${c.withLink === true ? t('masses.terms.addedTag') : t('masses.terms.addedNoLink')}`}
                          {c.status === 'pending' && ` · ${c.awaits === 'host' ? t('masses.terms.asksHost') : t('masses.terms.waits')}`}
                          <button
                            type="button" className="wk-chip-x" disabled={working !== null}
                            aria-label={t('masses.terms.unseatNamed', { name: nameOf(c) })} title={t('masses.terms.unseat')}
                            onClick={() => unseat(c)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </span>
                  )}

                  {adding === termKey(one.itemId, one.occurrenceAt) && resource != null && (
                    <AddPerson
                      full={counted >= resource.capacity}
                      busy={working !== null}
                      onAdd={(who) => seat(one, who)}
                      onCancel={() => setAdding(null)}
                    />
                  )}

                  {host !== undefined && host.inviteUntil !== null && (
                    <span className="wk-hint wk-slot-host">
                      {host.hostPending === true
                        ? t('masses.terms.hostPending', { name: nameOf(host), until: stamp(host.inviteUntil) })
                        : new Date(host.inviteUntil).getTime() > Date.now()
                        ? t('masses.terms.hostInviting', { name: nameOf(host), until: stamp(host.inviteUntil), min: resource?.minPersons ?? 2 })
                        : counted >= (resource?.minPersons ?? 2)
                          ? t('masses.terms.hostDoneFull', { until: stamp(host.inviteUntil) })
                          : t('masses.terms.hostDoneOpen', { until: stamp(host.inviteUntil) })}
                    </span>
                  )}
                </span>

                {resource != null && (
                  <span className="wk-appt-actions">
                    <button
                      type="button" className="wk-link-btn" disabled={working !== null}
                      onClick={() => setAdding(adding === termKey(one.itemId, one.occurrenceAt) ? null : termKey(one.itemId, one.occurrenceAt))}
                    >
                      {t('masses.terms.addPerson')}
                    </button>
                    <button
                      type="button" className="wk-link-btn" disabled={working !== null}
                      title={closedBy === null ? t('masses.terms.closeTitle') : t('masses.terms.openTitle')}
                      onClick={() => closeTerm(one, closedBy === null)}
                    >
                      {closedBy === null ? t('common.close') : t('common.open')}
                    </button>
                  </span>
                )}

                <button
                  type="button"
                  className="wk-link-btn wk-danger"
                  disabled={removing !== null}
                  title={here.length > 0 ? t('masses.terms.removeTitlePeople') : t('masses.terms.removeTitle')}
                  onClick={() => void remove(one, here.map((c) => c.name ?? t('masses.terms.noName')))}
                >
                  {removing === `${one.itemId}|${one.occurrenceAt}` ? t('masses.terms.removing') : t('common.remove')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/**
 * WER DA SITZT — der Name, sonst wenigstens, wann er sich angemeldet hat.
 *
 * Ein Platz ohne Namen (eine frühe Anmeldung, deren Namensfragen es so nicht
 * mehr gibt) stand bisher als „bez nazwy" da, und die Kanzlei konnte ihn
 * nirgends wiederfinden. Mit der Zeit der Anmeldung findet sie ihn unter
 * „Osoby".
 */
const nameOf = (c: OfficeClaim): string =>
  c.name ?? (c.registeredAt != null ? t('masses.terms.noNameSince', { when: stamp(c.registeredAt) }) : t('masses.terms.noName'));

/** Die Kennung eines Termins — Eintrag und ursprünglicher Beginn, am Zeitpunkt verglichen. */
const termKey = (itemId: string, occurrenceAt: string) => `${itemId}|${new Date(occurrenceAt).getTime()}`;

interface Pickable { readonly seatId: string; readonly name: string }

/**
 * Alle Menschen mit Link, die diese Kanzlei sieht — für „Dopisz osobę". Eine
 * Minute lang gemerkt: wer mehrere Termine hintereinander füllt, wartet nicht
 * jedes Mal auf alle Bereiche.
 */
let pickable: { at: number; seats: Promise<readonly Pickable[]> } | null = null;

function loadPickable(): Promise<readonly Pickable[]> {
  if (pickable !== null && Date.now() - pickable.at < 60_000) return pickable.seats;

  const seats = (async () => {
    const out = new Map<string, Pickable>();
    for (const area of (await loadAreas()).areas) {
      try {
        for (const one of (await loadSeats(area.areaId)).seats) {
          if (one.revokedAt !== null || one.status !== 'active' || (one.recipientName ?? '').trim() === '') continue;
          out.set(one.seatId, { seatId: one.seatId, name: one.recipientName!.trim() });
        }
      } catch {
        // Diesen Bereich lese ich nicht.
      }
    }
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
  })();

  pickable = { at: Date.now(), seats };
  seats.catch(() => { pickable = null; });
  return seats;
}

/**
 * „DOPISZ OSOBĘ" (0049) — ktoś z linkiem (widzi wtedy termin u siebie) albo
 * samo imię i nazwisko, dla kogoś bez linku. Także ponad limit miejsc.
 */
function AddPerson({ full, busy, onAdd, onCancel }: {
  full: boolean;
  busy: boolean;
  onAdd: (who: { seatId?: string; name?: string }) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [text, setText] = useState('');
  const [all, setAll] = useState<readonly Pickable[] | null>(null);

  useEffect(() => {
    let alive = true;
    void loadPickable().then((found) => { if (alive) setAll(found); }).catch(() => { if (alive) setAll([]); });
    return () => { alive = false; };
  }, []);

  const wanted = text.trim().toLocaleLowerCase(t.locale);
  const hits = all === null || wanted === '' ? [] : all.filter((one) => one.name.toLocaleLowerCase(t.locale).includes(wanted)).slice(0, 8);

  return (
    <span className="wk-appt-add">
      {full && <span className="wk-hint">{t('masses.terms.full')}</span>}
      <span className="wk-inline">
        <input
          value={text} autoFocus placeholder={t('masses.terms.searchPlaceholder')}
          aria-label={t('masses.terms.whoToAdd')} onChange={(e) => setText(e.target.value)}
        />
        <button type="button" className="wk-link-btn" onClick={onCancel}>{t('common.cancel')}</button>
      </span>

      {all === null && <span className="wk-hint">{t('masses.terms.loadingPeople')}</span>}

      {hits.length > 0 && (
        <span className="wk-appt-hits">
          {hits.map((one) => (
            <button key={one.seatId} type="button" className="wk-appt-hit" disabled={busy}
              onClick={() => onAdd({ seatId: one.seatId })}>
              + {one.name}
            </button>
          ))}
        </span>
      )}

      {wanted !== '' && (
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onAdd({ name: text.trim() })}>
          {t('masses.terms.addWithoutLink', { name: text.trim() })}
        </button>
      )}
    </span>
  );
}

/** Ein Zeitpunkt, kurz: „26 września, 19:00". */
const stamp = (at: string) => {
  const d = new Date(at);
  return `${fmtDate(d, { day: 'numeric', month: 'long' })}, ${fmtDate(d, { hour: '2-digit', minute: '2-digit' })}`;
};

/**
 * DIE REGELN DER TERMINE (0045) — hier, wo man sie wirken sieht.
 *
 * <code>
 *   osób na termin         wie viele auf EINEN Termin passen      (capacity)
 *   terminów na osobę      wie viele Termine EINER halten darf    (per_person, 0 = frei)
 *   godzin gospodarza      so lange lädt der Erste allein ein      (invite_hours, 0 = nie)
 * </code>
 *
 * Dieselben Zahlen wie in „Rezerwacje › Zasady"; dort steht das Ganze, hier
 * das, was man beim Planen der Termine braucht.
 */
function SlotRules({ row, onSaved }: { row: ResourceRow; onSaved: (row: ResourceRow) => void }) {
  const t = useT();
  const [capacity, setCapacity] = useState(String(row.capacity));
  const [perPerson, setPerPerson] = useState(String(row.perPerson));
  const [hours, setHours] = useState(String(row.inviteHours));
  const [minimum, setMinimum] = useState(String(row.minPersons));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setCapacity(String(row.capacity));
    setPerPerson(String(row.perPerson));
    setHours(String(row.inviteHours));
    setMinimum(String(row.minPersons));
  }, [row.resourceId, row.capacity, row.perPerson, row.inviteHours, row.minPersons]);

  const changed = capacity !== String(row.capacity) || perPerson !== String(row.perPerson)
    || hours !== String(row.inviteHours) || minimum !== String(row.minPersons);

  const save = async () => {
    setBusy(true);
    setFailed(null);
    setDone(false);

    try {
      onSaved(await updateResource(row.resourceId, {
        capacity: Number(capacity), perPerson: Number(perPerson), inviteHours: Number(hours),
        minPersons: Number(minimum)
      }));
      setDone(true);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('masses.entry.genericSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wk-slot-rules" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <p className="wk-hint">
        {rich(t('masses.rules.resource', { name: row.name }), { link: (s) => <a className="wk-link" href={viewPath('bookings', row.resourceId)}>{s}</a> })}
      </p>

      <div className="wk-actions">
        <label className="wk-field wk-field-num">
          <span>{t('masses.rules.capacity')}</span>
          <input type="number" min={1} value={capacity} disabled={busy} onChange={(e) => setCapacity(e.target.value)} />
        </label>
        <label className="wk-field wk-field-num">
          <span>{t('masses.rules.perPerson')}</span>
          <input type="number" min={0} value={perPerson} disabled={busy} onChange={(e) => setPerPerson(e.target.value)} />
        </label>
        <label className="wk-field wk-field-num">
          <span>{t('masses.rules.hours')}</span>
          <input type="number" min={0} value={hours} disabled={busy} onChange={(e) => setHours(e.target.value)} />
        </label>
        <label className="wk-field wk-field-num">
          <span>{t('masses.rules.minimum')}</span>
          <input type="number" min={1} value={minimum} disabled={busy} onChange={(e) => setMinimum(e.target.value)} />
        </label>
        {changed && <button type="submit" className="wk-btn" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>}
        {done && !changed && <span className="wk-row-side">{t('masses.entry.saved')}</span>}
      </div>

      <p className="wk-hint">
        {Number(perPerson) === 0 ? t('masses.rules.perPersonFree')
          : t('masses.rules.perPersonLimit', { count: perPerson })}
        {' '}
        {Number(hours) === 0 ? t('masses.rules.noHost')
          : t('masses.rules.host', { hours })}
        {' '}
        {Number(hours) > 0 && t('masses.rules.afterHost', { min: minimum })}
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}
    </form>
  );
}
