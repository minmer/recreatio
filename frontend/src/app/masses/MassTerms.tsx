/**
 * „Terminy" — die Termine eines Kalenders, die man sich nehmen kann, und wer sich auf sie gesetzt hat.
 */

import { useCallback, useEffect, useState } from 'react';

import { loadAreas } from '../areas/area';
import { type OfficeClaim, type ResourceRow, loadClaims, loadResources, officeAdd, officeClose, officeRemove, updateResource } from '../bookings/resource';
import { type CalendarRow, setOccurrence } from '../calendar/calendar';
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
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać terminów.');
    }
  }, [calendar.calendarId, from]);

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
      ? `Usunąć termin ${when}?`
      : `Usunąć termin ${when}? Zapisane osoby (${names.join(', ')}) zostaną z niego wypisane.`;
    if (!(await askText(ask))) return;

    const key = `${one.itemId}|${one.occurrenceAt}`;
    setRemoving(key);
    setFailed(null);
    setRemoved(null);

    try {
      await setOccurrence(one.itemId, one.occurrenceAt, { cancelled: true });
      setRemoved(`Usunięto termin ${when}${names.length > 0 ? ` — wypisano: ${names.join(', ')}` : ''}.`);
      await load();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć terminu.');
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
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setWorking(null);
    }
  };

  /** Jemanden eintragen — mit Link (ein Platz) oder nur mit Namen; auch über die Plätze hinaus. */
  const seat = (one: OfficeMass, who: { seatId?: string; name?: string }) => {
    if (resource == null) return;
    void officeAct('Dopisywanie…', async () => {
      const done = await officeAdd(resource, { itemId: one.itemId, occurrenceAt: one.occurrenceAt }, who);
      setAdding(null);
      return `Dopisano: ${who.name ?? 'osobę'} — ${stamp(one.startsAt)}${done.over ? ` (ponad limit: ${done.taken} z ${done.capacity})` : ''}.`;
    });
  };

  /** Jemanden austragen. */
  const unseat = async (c: OfficeClaim) => {
    if (!(await askText(`Wypisać z terminu: ${nameOf(c)}?${c.hosting ? ' To gospodarz — wolne miejsca otworzą się dla wszystkich.' : ''}`))) return;
    void officeAct('Wypisywanie…', async () => {
      await officeRemove(c.claimId);
      return `Wypisano: ${nameOf(c)}.`;
    });
  };

  /** Schliessen — auch mit freien Plätzen — oder wieder öffnen. */
  const closeTerm = (one: OfficeMass, close: boolean) => {
    if (resource == null) return;
    void officeAct(close ? 'Zamykanie…' : 'Otwieranie…', async () => {
      await officeClose(resource.resourceId, { itemId: one.itemId, occurrenceAt: one.occurrenceAt }, close);
      return close ? `Zamknięto termin ${stamp(one.startsAt)} — nikt więcej się nie zapisze.` : `Termin ${stamp(one.startsAt)} znów przyjmuje zapisy.`;
    });
  };

  /* Wer auf welchem Termin sitzt — je Vorkommen, am ursprünglichen Beginn. */
  const on = (one: OfficeMass) => claims.filter((c) => c.itemId === one.itemId
    && c.occurrenceAt !== null && new Date(c.occurrenceAt).getTime() === new Date(one.occurrenceAt).getTime()
    && (c.status === 'confirmed' || c.status === 'pending'));

  return (
    <>
      <h4 className="wk-h2">Terminy</h4>

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
          Ten kalendarz nie należy do żadnego zasobu — jego terminów nikt nie wybierze.
          Załóż zasób w <a className="wk-link" href={viewPath('bookings', 'new')}>Rezerwacjach</a>.
        </p>
      ) : (
        <SlotRules row={resource} onSaved={(row) => setResource(row)} />
      )}

      {items.length === 0 ? (
        <p className="wk-empty">W tym oknie nie ma żadnego terminu. Załóż go powyżej jako „Termin".</p>
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
                    {when.toLocaleDateString('pl-PL',
                      { weekday: 'short', day: 'numeric', month: 'long' })}
                    {', '}
                    {when.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                  </strong>
                  {one.title !== null && <> — {one.title}</>}

                  {resource != null && (
                    <span className="wk-row-side">
                      {' · '}{counted} z {resource.capacity}
                      {counted > resource.capacity && ' · ponad limit'}
                    </span>
                  )}

                  {closedBy !== null && (
                    <span className="wk-tag"> zamknięty{closedBy === 'office' ? ' przez kancelarię' : ' przez gospodarza'}</span>
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
                          {c.hosting && (c.hostPending === true ? ' · pierwszy, decyduje' : ' · gospodarz')}
                          {c.byOffice === true && (c.withLink === true ? ' · dopisany' : ' · dopisany, bez linku')}
                          {c.status === 'pending' && (c.awaits === 'host' ? ' · prosi gospodarza' : ' · czeka')}
                          <button
                            type="button" className="wk-chip-x" disabled={working !== null}
                            aria-label={`Wypisz: ${nameOf(c)}`} title="Wypisz z terminu"
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
                        ? `${nameOf(host)} wybrał(a) ten termin jako pierwszy i do ${stamp(host.inviteUntil)} decyduje, czy zaprosi znajomych. Jeśli nie odpowie, termin otworzy się dla wszystkich.`
                        : new Date(host.inviteUntil).getTime() > Date.now()
                        ? `Gospodarz (${nameOf(host)}) sam dobiera osoby do ${stamp(host.inviteUntil)} — potem, jeśli będzie ich mniej niż ${resource?.minPersons ?? 2}, wolne miejsca otworzą się dla wszystkich. Kod zna tylko on.`
                        : counted >= (resource?.minPersons ?? 2)
                          ? `Czas gospodarza minął ${stamp(host.inviteUntil)} — grupa jest skompletowana, termin zostaje dla niej.`
                          : `Czas gospodarza minął ${stamp(host.inviteUntil)} — wolne miejsca są dla wszystkich.`}
                    </span>
                  )}
                </span>

                {resource != null && (
                  <span className="wk-appt-actions">
                    <button
                      type="button" className="wk-link-btn" disabled={working !== null}
                      onClick={() => setAdding(adding === termKey(one.itemId, one.occurrenceAt) ? null : termKey(one.itemId, one.occurrenceAt))}
                    >
                      Dopisz osobę
                    </button>
                    <button
                      type="button" className="wk-link-btn" disabled={working !== null}
                      title={closedBy === null ? 'Nikt więcej się nie zapisze — także gdy są wolne miejsca' : 'Termin znów przyjmuje zapisy'}
                      onClick={() => closeTerm(one, closedBy === null)}
                    >
                      {closedBy === null ? 'Zamknij' : 'Otwórz'}
                    </button>
                  </span>
                )}

                <button
                  type="button"
                  className="wk-link-btn wk-danger"
                  disabled={removing !== null}
                  title={here.length > 0 ? 'Zapisane osoby zostaną wypisane' : 'Termin zniknie z listy do wyboru'}
                  onClick={() => void remove(one, here.map((c) => c.name ?? 'bez nazwy'))}
                >
                  {removing === `${one.itemId}|${one.occurrenceAt}` ? 'Usuwanie…' : 'Usuń'}
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
  c.name ?? (c.registeredAt != null ? `bez nazwy (zgłoszenie z ${stamp(c.registeredAt)})` : 'bez nazwy');

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
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl'));
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
  const [text, setText] = useState('');
  const [all, setAll] = useState<readonly Pickable[] | null>(null);

  useEffect(() => {
    let alive = true;
    void loadPickable().then((found) => { if (alive) setAll(found); }).catch(() => { if (alive) setAll([]); });
    return () => { alive = false; };
  }, []);

  const wanted = text.trim().toLocaleLowerCase('pl');
  const hits = all === null || wanted === '' ? [] : all.filter((one) => one.name.toLocaleLowerCase('pl').includes(wanted)).slice(0, 8);

  return (
    <span className="wk-appt-add">
      {full && <span className="wk-hint">Termin jest pełny — dopiszesz ponad limit.</span>}
      <span className="wk-inline">
        <input
          value={text} autoFocus placeholder="Szukaj osoby albo wpisz imię i nazwisko"
          aria-label="Kogo dopisać" onChange={(e) => setText(e.target.value)}
        />
        <button type="button" className="wk-link-btn" onClick={onCancel}>Anuluj</button>
      </span>

      {all === null && <span className="wk-hint">Wczytywanie osób…</span>}

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
          Dopisz „{text.trim()}" bez linku
        </button>
      )}
    </span>
  );
}

/** Ein Zeitpunkt, kurz: „26 września, 19:00". */
const stamp = (at: string) => {
  const d = new Date(at);
  return `${d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}, ${
    d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
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
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wk-slot-rules" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <p className="wk-hint">
        Każdy termin tutaj można wybrać — to zasób{' '}
        <a className="wk-link" href={viewPath('bookings', row.resourceId)}>{row.name}</a>.
      </p>

      <div className="wk-actions">
        <label className="wk-field wk-field-num">
          <span>Osób na termin</span>
          <input type="number" min={1} value={capacity} disabled={busy} onChange={(e) => setCapacity(e.target.value)} />
        </label>
        <label className="wk-field wk-field-num">
          <span>Terminów na osobę</span>
          <input type="number" min={0} value={perPerson} disabled={busy} onChange={(e) => setPerPerson(e.target.value)} />
        </label>
        <label className="wk-field wk-field-num">
          <span>Godzin gospodarza</span>
          <input type="number" min={0} value={hours} disabled={busy} onChange={(e) => setHours(e.target.value)} />
        </label>
        <label className="wk-field wk-field-num">
          <span>Minimum osób</span>
          <input type="number" min={1} value={minimum} disabled={busy} onChange={(e) => setMinimum(e.target.value)} />
        </label>
        {changed && <button type="submit" className="wk-btn" disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz'}</button>}
        {done && !changed && <span className="wk-row-side">Zapisano.</span>}
      </div>

      <p className="wk-hint">
        {Number(perPerson) === 0 ? 'Jedna osoba może wziąć dowolnie wiele terminów.'
          : `Jedna osoba może mieć naraz ${perPerson} — potem może już tylko zamienić.`}
        {' '}
        {Number(hours) === 0 ? 'Bez gospodarza: każdy zapisuje się sam.'
          : `Pierwszy zapisany na termin przez ${hours} h sam dobiera pozostałych — swoim kodem albo zgodą na prośbę.`}
        {' '}
        {Number(hours) > 0 && `Po tym czasie termin z co najmniej ${minimum} osobami zostaje dla grupy (gospodarz może go też sam zamknąć); z mniejszą liczbą wolne miejsca otwierają się dla wszystkich.`}
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}
    </form>
  );
}
