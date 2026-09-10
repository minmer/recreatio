/**
 * Zakładka „Spowiedź" w edytorze — godziny i kto spowiada.
 *
 * <b>Własna zakładka, nie przełącznik przy mszach.</b> Godziny spowiedzi układa
 * się osobno i przy innej okazji niż porządek mszy: msze stoją latami, a
 * spowiedź przed świętami zmienia się co tydzień. Wciśnięcie jej w tamten
 * formularz znaczyłoby, że za każdym razem trzeba najpierw przestawić rodzaj —
 * a kto zapomni, założy mszę.
 *
 * <b>Kto spowiada, wpisuje się nazwiskiem.</b> Nie z listy ról, i nie dlatego,
 * że tak łatwiej: nazwy ról leżą zapieczętowane i otwiera je klucz TEJ roli.
 * Kancelaria trzyma swoje role, nie cudze — lista „wybierz kapłana" pokazałaby
 * identyfikatory bez nazwisk.
 *
 * <b>Stały grafik i wyjątek.</b> Bez daty: tak jest zawsze w tej serii. Z datą:
 * tylko wtedy — i wtedy ZASTĘPUJE stały grafik, bo kto wpisuje zastępstwo, chce,
 * żeby stały dyżurny tego dnia zniknął.
 */

import { useCallback, useEffect, useState } from 'react';

import {
  RC_SUNDAY_MASK, RC_WEEKDAYS_MASK, RC_WEEKDAY_BITS,
  rcAddMass, rcDefaultUntil, rcParishCalendar, rcRepeatLabel, type RcNewMass
} from './rcMassPlan';
import {
  rcConfessionsOnly, rcDayLabel, rcHour, rcPublicMasses, type RcPublicMass
} from './rcMass';
import { rcAddDuty, rcDuties, rcRemoveDuty, type RcDuty } from './rcDuty';
import { rcPublicParish } from './rcPublicParish';
import { rcRoles } from '../lib/rcChat';
import { RcRequestError } from '../lib/rcApi';

const EMPTY: RcNewMass = {
  kind: 'confession',
  date: new Date().toISOString().slice(0, 10),
  time: '17:00',
  minutes: 45,
  titlePublic: '',
  repeat: 'weekly',
  weekdays: 0,
  until: ''
};

export function RcConfessionTab({ slug }: { slug: string }) {
  const [draft, setDraft] = useState<RcNewMass>(
    () => ({ ...EMPTY, until: rcDefaultUntil(EMPTY.date) }));

  const [areaId, setAreaId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [again, setAgain] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const parish = await rcPublicParish(slug);
        if (alive) setAreaId(parish.areaId ?? null);
      } catch { if (alive) setAreaId(null); }

      try {
        const roles = await rcRoles();
        if (alive) setRoleId((roles.roles ?? []).find((r) => r.kind === 'person')?.roleId ?? null);
      } catch { if (alive) setRoleId(null); }
    })();
    return () => { alive = false; };
  }, [slug]);

  const set = <K extends keyof RcNewMass>(key: K, value: RcNewMass[K]) =>
    setDraft({ ...draft, [key]: value });

  const toggleDay = (bit: number) =>
    set('weekdays', (draft.weekdays & bit) !== 0 ? draft.weekdays & ~bit : draft.weekdays | bit);

  const save = async () => {
    if (areaId === null || roleId === null) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const calendarId = await rcParishCalendar(areaId, 'Parafia');
      await rcAddMass(calendarId, roleId, draft);
      setDone(rcRepeatLabel(draft));
      setAgain((n) => n + 1);
    } catch {
      setError('Nie udało się założyć godzin spowiedzi.');
    } finally { setBusy(false); }
  };

  if (areaId === null || roleId === null) return <p className="rc-note">Wczytywanie…</p>;

  return (
    <div className="mt">
      <p className="rc-note">
        Godziny spowiedzi są wpisami kalendarza — tak samo jak msze, tylko bez
        intencji. Jeden wpis powtarzający się daje spowiedź na wszystkie wybrane
        dni; każdą można potem osobno przesunąć albo odwołać.
      </p>

      <div className="mt-form">
        <label className="mo-field">
          <span>Pierwszy dzień</span>
          <input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
        </label>

        <label className="mo-field">
          <span>Od godziny</span>
          <input type="time" value={draft.time} onChange={(e) => set('time', e.target.value)} />
        </label>

        <label className="mo-field">
          <span>Ile minut</span>
          <input
            type="number"
            min={5}
            max={240}
            value={draft.minutes}
            onChange={(e) => set('minutes', Number(e.target.value))}
          />
        </label>

        <label className="mo-field mo-wide">
          <span>Nazwa w gablocie — puste znaczy samo „Spowiedź"</span>
          <input
            type="text"
            value={draft.titlePublic}
            placeholder="Spowiedź adwentowa"
            onChange={(e) => set('titlePublic', e.target.value)}
          />
        </label>

        <fieldset className="mt-repeat mo-wide">
          <legend>Powtarzanie</legend>

          {(['none', 'weekly', 'daily'] as const).map((one) => (
            <label key={one}>
              <input
                type="radio"
                checked={draft.repeat === one}
                onChange={() => setDraft({
                  ...draft,
                  repeat: one,
                  until: one === 'none' || draft.until !== ''
                    ? draft.until
                    : rcDefaultUntil(draft.date)
                })}
              />
              <span>{one === 'none' ? 'Raz' : one === 'weekly' ? 'Co tydzień' : 'Codziennie'}</span>
            </label>
          ))}
        </fieldset>

        {draft.repeat === 'weekly' && (
          <div className="mt-days mo-wide">
            <div className="mt-day-row">
              {RC_WEEKDAY_BITS.map((day) => (
                <button
                  key={day.bit}
                  type="button"
                  className={`mt-day${(draft.weekdays & day.bit) !== 0 ? ' is-on' : ''}`}
                  onClick={() => toggleDay(day.bit)}
                >
                  {day.label}
                </button>
              ))}
            </div>

            <div className="mt-quick">
              <button type="button" onClick={() => set('weekdays', RC_WEEKDAYS_MASK)}>
                dni powszednie
              </button>
              <button type="button" onClick={() => set('weekdays', RC_SUNDAY_MASK)}>
                niedziela
              </button>
            </div>
          </div>
        )}

        {draft.repeat !== 'none' && (
          <label className="mo-field">
            <span>Do dnia — wymagane przy serii</span>
            <input
              type="date"
              value={draft.until}
              min={draft.date}
              onChange={(e) => set('until', e.target.value)}
            />
          </label>
        )}
      </div>

      <p className="mt-summary">{rcRepeatLabel(draft)}</p>

      <button
        type="button"
        className="rc-btn"
        disabled={busy || (draft.repeat !== 'none' && draft.until === '')}
        onClick={() => void save()}
      >
        {busy ? 'Zakładanie…' : 'Załóż godziny spowiedzi'}
      </button>

      {done !== null && <p className="rc-note">Założono: {done}</p>}
      {error !== null && <p className="ap-error">{error}</p>}

      <Upcoming slug={slug} reload={again} />
    </div>
  );
}

/* -- Najbliższe godziny i ich dyżury --------------------------------------- */

function Upcoming({ slug, reload }: { slug: string; reload: number }) {
  const [times, setTimes] = useState<readonly RcPublicMass[]>([]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const from = new Date();
        const to = new Date(from);
        to.setDate(to.getDate() + 28);

        const found = await rcPublicMasses(slug, from, to);
        if (alive) setTimes(rcConfessionsOnly(found.masses ?? []));
      } catch { if (alive) setTimes([]); }
    })();
    return () => { alive = false; };
  }, [slug, reload]);

  if (times.length === 0) return null;

  /*
   * Grupowane po WPISIE, nie po dniu: dyżur wpisuje się dla serii („w soboty
   * ks. Jan") albo dla jednego dnia. Lista dni bez tego rozróżnienia kazałaby
   * wpisywać to samo nazwisko przy każdej sobocie z osobna.
   */
  const series = [...new Map(times.map((t) => [t.itemId, t])).values()];

  return (
    <section className="mt-upcoming">
      <h3 className="rc-h2">Kto spowiada</h3>
      <p className="ps-muted">
        Nazwisko wpisuje się ręcznie — nazwy ról są zaszyfrowane i kancelaria ich
        nie otworzy. Bez daty obowiązuje w całej serii; z datą tylko tego dnia i
        wtedy zastępuje stały grafik.
      </p>

      {series.map((one) => (
        <Duties
          key={one.itemId}
          item={one}
          occurrences={times.filter((t) => t.itemId === one.itemId)}
        />
      ))}
    </section>
  );
}

function Duties({
  item, occurrences
}: {
  item: RcPublicMass;
  occurrences: readonly RcPublicMass[];
}) {
  const [list, setList] = useState<readonly RcDuty[]>([]);
  const [name, setName] = useState('');
  const [when, setWhen] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const found = await rcDuties(item.itemId);
      setList(found.duties ?? []);
    } catch { setList([]); }
  }, [item.itemId]);

  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (name.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      await rcAddDuty(item.itemId, {
        name: name.trim(),
        occurrenceUtc: when === '' ? null : when,
        isPublic
      });
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof RcRequestError && e.status === 409
        ? e.error.message
        : 'Nie udało się wpisać dyżuru.');
    } finally { setBusy(false); }
  };

  const standing = list.filter((d) => d.occurrenceUtc == null);

  return (
    <article className="ps-card mo-mass">
      <header className="mo-head">
        <strong>{rcHour(item.startsUtc)}–{rcHour(item.endsUtc)}</strong>
        {(item.title ?? '') !== '' && <span className="ms-title">{item.title}</span>}
        <span className="mo-day-label">{occurrences.length} razy w tym miesiącu</span>
      </header>

      {standing.length > 0 && (
        <ul className="mo-ints">
          {standing.map((d) => (
            <li key={d.dutyId} className="mo-int">
              <span className="mo-int-text">{d.name}</span>
              <span className="mo-int-kind">zawsze</span>
              {d.isPublic && <span className="mo-int-kind">w gablocie</span>}
              <button
                type="button"
                className="ps-edit"
                onClick={() => void rcRemoveDuty(d.dutyId).then(load)}
              >
                Skreśl
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Wyjątki: tylko te dni, dla których ktoś coś wpisał. */}
      {occurrences.map((occ) => {
        const own = list.filter(
          (d) => d.occurrenceUtc != null
            && new Date(d.occurrenceUtc).getTime() === new Date(occ.startsUtc).getTime());

        if (own.length === 0) return null;

        return (
          <div key={occ.startsUtc} className="cf-day">
            <span className="ms-when">{rcDayLabel(occ.startsUtc)} — zamiast stałego</span>
            <ul className="mo-ints">
              {own.map((d) => (
                <li key={d.dutyId} className="mo-int">
                  <span className="mo-int-text">{d.name}</span>
                  {d.isPublic && <span className="mo-int-kind">w gablocie</span>}
                  <button
                    type="button"
                    className="ps-edit"
                    onClick={() => void rcRemoveDuty(d.dutyId).then(load)}
                  >
                    Skreśl
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {list.length === 0 && <p className="ps-muted">Nikt jeszcze nie wpisany.</p>}

      <div className="mo-add">
        <label className="mo-field mo-wide">
          <span>Kto spowiada</span>
          <input
            type="text"
            value={name}
            maxLength={200}
            placeholder="ks. Jan Kowalski"
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }}
          />
        </label>

        <label className="mo-field">
          <span>Kiedy</span>
          <select value={when} disabled={busy} onChange={(e) => setWhen(e.target.value)}>
            <option value="">Zawsze w tej serii</option>
            {occurrences.map((occ) => (
              <option key={occ.startsUtc} value={occ.startsUtc}>
                {rcDayLabel(occ.startsUtc)} {rcHour(occ.startsUtc)}
              </option>
            ))}
          </select>
        </label>

        <label className="mo-field">
          <span>W gablocie</span>
          <input
            type="checkbox"
            checked={isPublic}
            disabled={busy}
            onChange={(e) => setIsPublic(e.target.checked)}
          />
        </label>

        <p className="ps-muted mo-note">
          Bez zaznaczenia nazwisko zostaje w grafiku wewnętrznym. Zaznaczone —
          trafia na stronę parafii przy tej godzinie.
        </p>

        <button
          type="button"
          className="ps-signin"
          disabled={busy || name.trim() === ''}
          onClick={() => void add()}
        >
          Wpisz na dyżur
        </button>
      </div>

      {error !== null && <p className="ap-error">{error}</p>}
    </article>
  );
}

export default RcConfessionTab;
