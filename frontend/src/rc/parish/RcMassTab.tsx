/**
 * Zakładka „Msze" w edytorze — zakładanie mszy.
 *
 * <b>Jedna msza albo cały okres.</b> To nie są dwa różne byty: „w dni
 * powszednie o 18:00 do adwentu" to jeden wpis, który daje msze na wszystkie te
 * dni. Każdą z nich można potem osobno przesunąć albo odwołać, bo kalendarz
 * trzyma wyjątki przy wystąpieniach.
 *
 * <b>Godzina zakończenia liczy się sama.</b> Podaje się początek i długość, bo
 * tak myśli człowiek układający plan. Koniec musi jednak istnieć — kościół jest
 * zajęty do której, a nie „przez chwilę".
 */

import { useEffect, useState } from 'react';

import {
  RC_MASS_MINUTES, RC_SUNDAY_MASK, RC_WEEKDAYS_MASK, RC_WEEKDAY_BITS,
  rcAddMass, rcDefaultUntil, rcParishCalendar, rcRepeatLabel, type RcNewMass
} from './rcMassPlan';
import { rcPublicMasses, rcHour, rcDayLabel, type RcPublicMass } from './rcMass';
import { rcCancelItem, rcCancelOccurrence, rcDeleteItem } from '../lib/rcCalendar';
import { RcRequestError } from '../lib/rcApi';
import { rcPublicParish } from './rcPublicParish';
import { rcRoles } from '../lib/rcChat';

const EMPTY: RcNewMass = {
  kind: 'mass',
  date: new Date().toISOString().slice(0, 10),
  time: '18:00',
  minutes: RC_MASS_MINUTES,
  titlePublic: '',
  repeat: 'none',
  weekdays: 0,
  until: ''
};

export function RcMassTab({ slug }: { slug: string }) {
  const [draft, setDraft] = useState<RcNewMass>(EMPTY);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [preview, setPreview] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const parish = await rcPublicParish(slug);
        if (alive) setAreaId(parish.areaId ?? null);
      } catch { if (alive) setAreaId(null); }

      try {
        const roles = await rcRoles();
        // Die Messe gehoert einer Rolle. Die eigene Personenrolle ist die, die
        // jeder hat — eine eigene „Messrolle" waere eine Rolle mehr, ohne dass
        // irgendjemand sie je teilen wollte.
        if (alive) setRoleId((roles.roles ?? []).find((r) => r.kind === 'person')?.roleId ?? null);
      } catch { if (alive) setRoleId(null); }
    })();
    return () => { alive = false; };
  }, [slug]);

  const set = <K extends keyof RcNewMass>(key: K, value: RcNewMass[K]) =>
    setDraft({ ...draft, [key]: value });

  /*
   * WER EINE SERIE WAEHLT, BEKOMMT SOFORT EIN ENDE DAZU.
   *
   * Der Kalender verlangt eines — eine Wiederholung ohne Ende laesst er nicht
   * zu. Das leere Feld erst stehen zu lassen und beim Speichern abzuweisen
   * waere eine Falle: man haette alles ausgefuellt und bekaeme ein 400 fuer
   * etwas, wonach nie gefragt wurde.
   */
  const setRepeat = (repeat: RcNewMass['repeat']) =>
    setDraft({
      ...draft,
      repeat,
      until: repeat === 'none' || draft.until !== '' ? draft.until : rcDefaultUntil(draft.date)
    });

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
      setDraft({ ...EMPTY, date: draft.date, time: draft.time });
      setPreview((n) => n + 1);
    } catch {
      setError('Nie udało się założyć mszy.');
    } finally { setBusy(false); }
  };

  if (areaId === null || roleId === null) {
    return <p className="rc-note">Wczytywanie…</p>;
  }

  return (
    <div className="mt">
      <p className="rc-note">
        Msza jest wpisem kalendarza. Jeden wpis powtarzający się daje msze na
        wszystkie wybrane dni — każdą można potem osobno przesunąć albo odwołać.
        Godziny spowiedzi zakłada się w zakładce „Spowiedź".
      </p>

      <div className="mt-form">
        <label className="mo-field">
          <span>Pierwszy dzień</span>
          <input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
        </label>

        <label className="mo-field">
          <span>Godzina</span>
          <input type="time" value={draft.time} onChange={(e) => set('time', e.target.value)} />
        </label>

        <label className="mo-field">
          <span>Czas trwania (min)</span>
          <input
            type="number"
            min={5}
            max={240}
            value={draft.minutes}
            onChange={(e) => set('minutes', Number(e.target.value))}
          />
        </label>

        <label className="mo-field mo-wide">
          <span>Nazwa w gablocie — puste znaczy samą godzinę</span>
          <input
            type="text"
            value={draft.titlePublic}
            placeholder="Msza św. z udziałem dzieci"
            onChange={(e) => set('titlePublic', e.target.value)}
          />
        </label>

        <fieldset className="mt-repeat mo-wide">
          <legend>Powtarzanie</legend>

          <label>
            <input
              type="radio"
              checked={draft.repeat === 'none'}
              onChange={() => setRepeat('none')}
            />
            <span>Jedna msza</span>
          </label>

          <label>
            <input
              type="radio"
              checked={draft.repeat === 'weekly'}
              onChange={() => setRepeat('weekly')}
            />
            <span>Co tydzień</span>
          </label>

          <label>
            <input
              type="radio"
              checked={draft.repeat === 'daily'}
              onChange={() => setRepeat('daily')}
            />
            <span>Codziennie</span>
          </label>
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

            {/* Dwie kombinacje, których używa się naprawdę codziennie. */}
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
            {/* Wymagane: kalendarz nie przyjmuje serii bez końca. */}
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

      {/*
        Co się właściwie założy — zdaniem, nie polami. Kto czyta „w pn, śr, pt o
        18:00, bez końca", zauważy pomyłkę; kto patrzy na siedem przycisków,
        nie zauważy.
      */}
      <p className="mt-summary">{rcRepeatLabel(draft)}</p>

      <button
        type="button"
        className="rc-btn"
        disabled={busy || (draft.repeat !== 'none' && draft.until === '')}
        onClick={() => void save()}
      >
        {busy ? 'Zakładanie…' : 'Załóż mszę'}
      </button>

      {done !== null && <p className="rc-note">Założono: {done}</p>}
      {error !== null && <p className="ap-error">{error}</p>}

      <Upcoming slug={slug} reload={preview} roleId={roleId} />
    </div>
  );
}

/**
 * Co już stoi w planie.
 *
 * Bez tego zakładanie odbywa się na ślepo — a msza założona dwa razy wygląda w
 * gablocie jak dwie msze o tej samej godzinie.
 */
function Upcoming({ slug, reload, roleId }: { slug: string; reload: number; roleId: string | null }) {
  const [masses, setMasses] = useState<readonly RcPublicMass[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [again, setAgain] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const from = new Date();
        const to = new Date(from);
        to.setDate(to.getDate() + 14);

        const found = await rcPublicMasses(slug, from, to);
        if (alive) setMasses(found.masses ?? []);
      } catch { if (alive) setMasses([]); }
    })();
    return () => { alive = false; };
  }, [slug, reload, again]);

  if (masses.length === 0) return null;

  /*
   * ZWEI VERSCHIEDENE DINGE, ZWEI VERSCHIEDENE KNOEPFE.
   *
   * „Dieser Dienstag faellt aus" und „ab jetzt gar nicht mehr" sind nicht
   * dasselbe, und eine Oberflaeche, die beides unter „Loeschen" fuehrt, laesst
   * jemanden versehentlich ein ganzes Jahr absagen. Deshalb steht die Absage
   * eines Vorkommens bei der Zeile, die Absage der Reihe darunter.
   */
  const series = [...new Map(masses.map((m) => [m.itemId, m])).values()];

  const run = async (key: string, what: () => Promise<unknown>, said: string) => {
    setBusy(key);
    setNote(null);
    try {
      await what();
      setNote(said);
      setAgain((n) => n + 1);
    } catch (e) {
      /*
        409 heisst: an der Reihe haengt noch etwas. Das ist keine Stoerung,
        sondern die Antwort — und der Dienst sagt sie besser als wir.
      */
      setNote(e instanceof RcRequestError && e.status === 409
        ? e.error.message
        : 'Nie udało się.');
    } finally { setBusy(null); }
  };

  return (
    <section className="mt-upcoming">
      <h3 className="rc-h2">Najbliższe dwa tygodnie</h3>

      <ul className="mt-list">
        {masses.map((m) => (
          <li key={m.startsUtc} className="mt-row">
            <span>
              {rcDayLabel(m.startsUtc)} {rcHour(m.startsUtc)}–{rcHour(m.endsUtc)}
              {(m.title ?? '') === '' ? '' : ` · ${m.title}`}
            </span>

            <button
              type="button"
              className="mt-drop"
              disabled={busy !== null}
              onClick={() => void run(
                m.startsUtc,
                () => rcCancelOccurrence(m.itemId, m.startsUtc),
                'Odwołano tę jedną mszę.')}
            >
              odwołaj tę
            </button>
          </li>
        ))}
      </ul>

      <h3 className="rc-h2">Serie</h3>
      <p className="ps-muted">
        Odwołanie serii zdejmuje ją z planu, ale wpis zostaje — widać, że była.
        Usunąć naprawdę da się tylko taką, do której nikt nie przyjął jeszcze
        intencji; w łańcuchu i tak zostaje ślad, kto i co usunął.
      </p>

      <ul className="mt-list">
        {series.map((m) => (
          <li key={m.itemId} className="mt-row">
            <span>
              {rcHour(m.startsUtc)}
              {(m.title ?? '') === '' ? '' : ` · ${m.title}`}
            </span>

            <button
              type="button"
              className="mt-drop"
              disabled={busy !== null}
              onClick={() => void run(
                m.itemId,
                () => rcCancelItem(m.itemId),
                'Odwołano całą serię. Można ją przywrócić.')}
            >
              odwołaj serię
            </button>

            {/*
              Ohne Rolle kein Loeschen — die Kette kennt keinen Vorgang ohne
              Urheber. Den Knopf trotzdem anzubieten hiesse, ihn anzubieten und
              dann mit einem 400 zu antworten; besser, er ist gar nicht erst da.
            */}
            {roleId !== null && (
              <button
                type="button"
                className="mt-drop"
                disabled={busy !== null}
                onClick={() => void run(
                  m.itemId,
                  () => rcDeleteItem(m.itemId, roleId),
                  'Usunięto. W łańcuchu został ślad.')}
              >
                usuń
              </button>
            )}
          </li>
        ))}
      </ul>

      {note !== null && <p className="rc-note">{note}</p>}
    </section>
  );
}

export default RcMassTab;
