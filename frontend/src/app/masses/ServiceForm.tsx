/**
 * „Nowy wpis" — einen Kalender oder einen Gottesdienst (Messe, Beichte, Nabożeństwo) anlegen.
 */

import { useEffect, useState } from 'react';

import type { AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { kindWord } from '../calendar/agenda';
import { type CalendarRow, type ItemKind, REPEAT_LABEL, type RepeatKind, addItem, createCalendar } from '../calendar/calendar';
import { WorkspaceError } from '../core/session';
import { loadRoles, selfOf } from '../roles/roles';
import { rich, useT } from '../core/i18n';
import { CONFESSION, DEVOTION, devotionNames, MASS, WEEKDAY_BITS } from './mass';
import { todayKey } from './officeDays';

/* -- Einen Kalender anlegen ------------------------------------------------ */

/**
 * Ein neuer Kalender — HIER, bei den Kalendern.
 *
 * <b>Er stand einmal beim Bereich</b>, weil ein Kalender einen Bereich
 * BRAUCHT: der Bereich entscheidet, wer ihn sieht. Das ist ein Grund, beide zu
 * verbinden, und keiner, das Formular dort zu führen — wer einen Kalender
 * anlegen will, sucht ihn bei den Kalendern.
 *
 * <b>Der Bereich wird deshalb hier gewählt.</b> Es ist die einzige Angabe, die
 * sich nicht erraten lässt: an ihr hängt, wer den Plan später lesen darf.
 */
export function NewCalendar({ areas, busy, onAct }: {
  areas: readonly AreaRow[];
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [areaId, setAreaId] = useState('');

  /* Anlegen darf, wer den Bereich führt oder beschreibt. */
  const mine = areas.filter((a) => a.myLevel === 'admin' || a.myLevel === 'write');

  if (!open) {
    return (
      <div className="wk-actions">
        <button
          type="button" className="wk-link-btn" disabled={busy}
          onClick={() => { setOpen(true); setAreaId(mine[0]?.areaId ?? ''); }}
        >
          {t('masses.newCalendar.title')}
        </button>
      </div>
    );
  }

  if (mine.length === 0) {
    return (
      <p className="wk-note">
        {t('masses.newCalendar.noArea')}
        {' '}
        <button type="button" className="wk-link-btn" onClick={() => setOpen(false)}>
          {t('common.close')}
        </button>
      </p>
    );
  }

  return (
    <form
      className="wk-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (areaId === '') return;

        /*
         * 0054 — EIN TERMINARZ JE GRUPPE. Er heisst wie sie; hat sie schon
         * einen, ist es dieser (der Dienst gibt ihn zurück, statt einen
         * zweiten anzulegen).
         */
        const name = areas.find((a) => a.areaId === areaId)?.name ?? t('masses.newCalendar.defaultTitle');
        void onAct(t('masses.newCalendar.opening'),
          () => createCalendar({ areaId, title: name, timeZone: 'Europe/Warsaw' }))
          .then(() => setOpen(false));
      }}
    >
      <h4 className="wk-h2">{t('masses.newCalendar.title')}</h4>

      <label className="wk-field">
        <span>{t('masses.newCalendar.area')}</span>
        <AreaPick label={t('masses.newCalendar.area')} value={areaId} onChange={setAreaId} areas={areas} only={mine} />
      </label>

      <p className="wk-hint">
        {t('masses.newCalendar.hint')}
      </p>

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || areaId === ''}>
          {t('masses.newCalendar.open')}
        </button>
        <button type="button" className="wk-link-btn" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

/* -- Eine Messe anlegen ---------------------------------------------------- */

/** Die Wiederholungen, die für einen Gottesdienst Sinn ergeben. */
const SERVICE_REPEATS: readonly RepeatKind[] = ['none', 'daily', 'weekly', 'monthly'];

/** Wie lange, wenn niemand es sagt — die Beichte bis zur Messe, das Nabożeństwo eine halbe Stunde. */
const MINUTES: Record<string, number> = { mass: 45, confession: 60, devotion: 30, appointment: 60 };

export function ServiceForm({ calendar, onAdded }: { calendar: CalendarRow; onAdded: (what: string) => void }) {
  const t = useT();
  const [kind, setKind] = useState<ItemKind>(MASS);
  const [date, setDate] = useState(todayKey);
  const [time, setTime] = useState('18:00');
  /* 0079 — wie lange. Bei der Beichte steht es im Aushang („do 18:45"). */
  const [minutes, setMinutes] = useState(String(calendar.durationMinutes ?? MINUTES.mass));
  const pickKind = (next: ItemKind) => { setKind(next); setMinutes(String(MINUTES[next] ?? 60)); };
  const [title, setTitle] = useState('');
  const [repeat, setRepeat] = useState<RepeatKind>('none');
  const [weekdays, setWeekdays] = useState(0);
  const [until, setUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  /*
   * Die eigene Rolle. Ein Eintrag gehört einer Rolle, nicht einem Konto: wer
   * ihn angelegt hat, bleibt lesbar, auch wenn das Konto später einer anderen
   * Person gehört.
   */
  const [roleId, setRoleId] = useState<string | null | undefined>(undefined);

  /* Die eigene PERSON, nicht das Konto: dem Konto gehört nichts (0040). */
  useEffect(() => {
    loadRoles()
      .then((graph) => setRoleId(selfOf(graph)?.id ?? null))
      .catch(() => setRoleId(null));
  }, []);

  const blocker =
    busy ? null
    : roleId === undefined ? t('masses.service.loadingRole')
    : roleId === null ? t('masses.service.noPerson')
    : date === '' || time === '' ? t('masses.service.needDate')
    /*
     * EINE REIHE MUSS EIN ENDE HABEN. Hier gesagt statt als 400 vom Dienst —
     * wer den Knopf grau sieht, soll wissen, was fehlt.
     */
    : repeat !== 'none' && until === '' ? t('masses.service.needUntil')
    : null;

  const go = async () => {
    if (roleId == null) return;

    setBusy(true);
    setFailed(null);

    try {
      await addItem(calendar.calendarId, {
        ownerRoleId: roleId,

        /*
         * Der Bereich des KALENDERS entscheidet über das Dasein des Eintrags.
         * Sichtbar wird er dadurch, dass dessen Epochenschlüssel offenliegt —
         * nicht durch einen Schalter „öffentlich". Ein anderer Bereich wäre
         * möglich, aber er gehört nicht in ein Formular, das jemand im
         * Vorbeigehen ausfüllt.
         */
        visibilityAreaId: calendar.areaId,

        kind, date, time,
        minutes: Math.min(24 * 60, Math.max(5, Number(minutes) || MINUTES[kind] || 45)),
        titlePublic: title.trim() === '' ? undefined : title.trim(),
        repeat,
        weekdays: repeat === 'weekly' ? weekdays : undefined,
        until: repeat === 'none' ? undefined : until
      });

      setTitle('');
      const what = kindWord(kind).toLowerCase();
      onAdded(repeat === 'none'
        ? t('masses.service.added', { what, date, time })
        : t('masses.service.addedSeries', { what, date, time, repeat: REPEAT_LABEL[repeat], until }));
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('masses.service.addFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="wk-form"
      onSubmit={(e) => { e.preventDefault(); if (blocker === null) void go(); }}
    >
      <h4 className="wk-h2">{t('masses.service.title')}</h4>

      <label className="wk-field">
        <span>{t('masses.service.what')}</span>
        <select
          value={kind}
          onChange={(e) => pickKind(e.target.value as ItemKind)}
        >
          <option value={MASS}>{t('masses.service.mass')}</option>
          <option value={CONFESSION}>{t('masses.service.confession')}</option>
          <option value={DEVOTION}>{t('masses.service.devotionOption')}</option>

          {/*
            DER TERMIN — das, wofür die Firmlinge herkommen.

            Er stand hier nicht, und damit gab es im ganzen Haus keinen Weg,
            einen anzulegen: der Dienst kannte `appointment` von Anfang an
            (`ck_item_kind`), das Buchen war gebaut (0029), das Modul für die
            Seite auch — nur die eine Auswahlliste bot es nicht an. Eine
            Möglichkeit, die nirgends angeboten wird, gibt es nicht.
          */}
          <option value="appointment">{t('masses.service.appointmentOption')}</option>
        </select>
      </label>

      {/*
        WAS ALS NÄCHSTES ZU TUN IST. Ein angelegter Termin nimmt noch niemanden
        auf — freigegeben wird je Vorkommen, weiter unten. Ohne diesen Satz
        legt jemand einen Termin an, sieht ihn im Plan stehen und wartet auf
        Anmeldungen, die nicht kommen können.
      */}
      {kind === 'appointment' && (
        <p className="wk-hint">
          {t('masses.service.appointmentHint')}
        </p>
      )}

      <label className="wk-field">
        <span>{t('masses.office.day')}</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <label className="wk-field">
        <span>{t('masses.service.time')}</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>

      <label className="wk-field">
        <span>{t('masses.service.minutes')}</span>
        <input type="number" min={5} max={1440} step={5} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        {kind === CONFESSION && <span className="wk-hint">{t('masses.service.confessionHint')}</span>}
      </label>

      <label className="wk-field">
        <span>{t('masses.service.name')}</span>
        <input value={title} list={kind === DEVOTION ? 'wk-mo-devotions' : undefined}
          placeholder={kind === DEVOTION ? t('masses.service.placeholderDevotion') : kind === CONFESSION ? t('masses.service.placeholderConfession') : t('masses.service.placeholderMass')} onChange={(e) => setTitle(e.target.value)} />
        {kind === DEVOTION && <datalist id="wk-mo-devotions">{devotionNames().map((n) => <option key={n} value={n} />)}</datalist>}
      </label>

      <label className="wk-field">
        <span>{t('masses.service.repeat')}</span>
        <select value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatKind)}>
          {SERVICE_REPEATS.map((one) => (
            <option key={one} value={one}>{REPEAT_LABEL[one]}</option>
          ))}
        </select>
      </label>

      {repeat === 'weekly' && (
        <div className="wk-mo-days">
          {WEEKDAY_BITS.map((day) => (
            <label key={day.bit} className="wk-mo-day">
              <input
                type="checkbox"
                checked={(weekdays & day.bit) !== 0}
                onChange={() => setWeekdays((mask) => mask ^ day.bit)}
              />
              {day.label}
            </label>
          ))}
        </div>
      )}

      {repeat !== 'none' && (
        <label className="wk-field">
          <span>{t('masses.service.until')}</span>
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </label>
      )}

      <p className="wk-hint">
        {t('masses.service.localHint')}
      </p>

      <p className="wk-hint">
        {rich(t('masses.service.areaHint', { area: calendar.areaName }), { b: (s) => <strong>{s}</strong> })}
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={blocker !== null || busy}>
          {busy ? t('masses.service.adding') : t('masses.service.add')}
        </button>
        {blocker !== null && !busy && <span className="wk-blocker">{blocker}</span>}
      </div>
    </form>
  );
}
