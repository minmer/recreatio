/**
 * EIN TIMER — Uhrzeit, Wochentage (keiner gewählt: jeden Tag), an/aus und die
 * Aktionen: je Aktion ein Gerät und einer seiner Sygnały, nacheinander gesendet —
 * im Tempo DIESES Timers (eigene zwei Regler; die der Knöpfe gelten hier nicht).
 * „Wykonaj teraz" sendet sie gleich, über dieselbe Warteschlange wie die Knöpfe,
 * aber in seinem eigenen Tempo.
 */

import { useState } from 'react';

import { fmtDate, useT } from '../core/i18n';
import type { PhoneCtx } from '../phone/phoneContext';
import { viewPath } from '../routes';
import { useCrumbs } from '../shell/crumbTrail';
import { ask } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { MenuButton } from '../ui/Menu';
import { PageHeader } from '../ui/PageHeader';
import { LampConsole } from './LampConsole';
import {
  actionOf, ACTIONS_MAX, emptyTimer, lampSaveProblem, lampTitle, minuteOf, removeItem, saveTimer, timerProblems, timerTitle, timeText,
  type Lamp, type LampTimer, type LampTimerAction, type LampTimerData
} from './lampStore';
import { LampRadio } from './native';
import { PaceControl } from './PaceControl';
import { dayShort, nextRun, WEEKEND, whenText, WORKDAYS } from './timers';
import { transmit } from './transmit';

const DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Die erste Aktion, die es gibt: das erste Gerät mit seinem ersten Sygnał. */
const firstAction = (lamps: readonly Lamp[]): LampTimerAction | null => {
  const lamp = lamps.find((l) => l.signals.length > 0);
  return lamp === undefined ? null : { lampId: lamp.id, signalId: lamp.signals[0].id };
};

const keyOf = (a: LampTimerAction) => `${a.lampId}|${a.signalId}`;

export function TimerEdit({ ctx, timer, lamps, native, onSaved, onRemoved }: {
  ctx: PhoneCtx;
  timer: LampTimer | null;
  lamps: readonly Lamp[];
  native: boolean;
  onSaved: (timer: LampTimer) => void;
  onRemoved: (id: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<LampTimerData>(() => {
    if (timer !== null) return timer;
    const first = firstAction(lamps);
    return { ...emptyTimer(), actions: first === null ? [] : [first] };
  });
  const [timeInput, setTimeInput] = useState(() => timeText(draft.minute));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  useCrumbs([{ label: timer === null ? t('lamps.timerEdit.new') : timerTitle(timer), href: null }]);

  const set = (patch: Partial<LampTimerData>) => setDraft((d) => ({ ...d, ...patch }));
  const setActions = (make: (list: readonly LampTimerAction[]) => readonly LampTimerAction[]) => setDraft((d) => ({ ...d, actions: make(d.actions) }));
  const toggleDay = (day: number) => set({ days: draft.days.includes(day) ? draft.days.filter((d) => d !== day) : [...draft.days, day].sort((a, b) => a - b) });
  const move = (i: number, by: -1 | 1) => setActions((list) => {
    const next = [...list];
    const [one] = next.splice(i, 1);
    next.splice(i + by, 0, one);
    return next;
  });

  const problems = timerProblems(draft, lamps);
  const next = nextRun(draft, Date.now());
  const withSignals = lamps.filter((l) => l.signals.length > 0);

  const save = async () => {
    setTried(true);
    if (problems.length > 0) return;
    setBusy(true);
    setFailed(null);
    try {
      onSaved(await saveTimer(ctx, timer?.id ?? null, draft, timer?.version ?? 0));
    } catch (e) {
      setFailed(lampSaveProblem(e));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (timer === null) return;
    if (!await ask({ title: t('lamps.timerEdit.removeAsk', { name: timerTitle(timer) }), confirm: t('common.delete'), danger: true })) return;
    setBusy(true);
    try {
      await removeItem(ctx, timer.id);
      onRemoved(timer.id);
    } catch (e) {
      setFailed(lampSaveProblem(e));
      setBusy(false);
    }
  };

  /* Gleich ausprobieren: jede Aktion in die Warteschlange der Knöpfe. */
  const runNow = () => {
    for (const a of draft.actions) {
      const found = actionOf(lamps, a);
      if (found !== null) void transmit(LampRadio, found.lamp, found.signal, draft.pace);
    }
  };

  return (
    <form className="lp-edit" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <PageHeader title={timer === null ? t('lamps.timerEdit.new') : timerTitle(timer)} meta={next !== null ? t('lamps.timerEdit.next', { when: whenText(next, Date.now()) }) : draft.enabled ? undefined : t('lamps.timerEdit.off')}
        actions={timer !== null && (
          <MenuButton label={t('lamps.timerEdit.more')} items={[{ label: t('lamps.edit.remove'), icon: 'trash', onSelect: () => void remove() }]} />
        )} />

      <div className="lp-pair">
        <label className="wk-field">
          <span>{t('lamps.timerEdit.time')}</span>
          <input type="time" value={timeInput} required onChange={(e) => {
            setTimeInput(e.target.value);
            set({ minute: minuteOf(e.target.value) ?? -1 });
          }} />
        </label>
        <label className="wk-field">
          <span>{t('lamps.timerEdit.name')}</span>
          <input value={draft.name} autoComplete="off" placeholder={t('lamps.timerEdit.namePh')} onChange={(e) => set({ name: e.target.value })} />
        </label>
      </div>

      <fieldset className="wk-field lp-days">
        <legend>{draft.days.length === 0 ? t('lamps.timerEdit.daysNone') : t('lamps.timerEdit.days')}</legend>
        <div className="lp-day-row" role="group" aria-label={t('lamps.timerEdit.weekdays')}>
          {DAYS.map((d) => (
            <button key={d} type="button" className="ui-filter" aria-pressed={draft.days.includes(d)} aria-label={fmtDate(new Date(2024, 0, d), { weekday: 'long' }, t.lang)}
              onClick={() => toggleDay(d)}>{dayShort(d)}</button>
          ))}
        </div>
        <div className="wk-actions">
          <button type="button" className="wk-link-btn" onClick={() => set({ days: [] })}>{t('lamps.day.daily')}</button>
          <button type="button" className="wk-link-btn" onClick={() => set({ days: [...WORKDAYS] })}>{t('lamps.day.workdays')}</button>
          <button type="button" className="wk-link-btn" onClick={() => set({ days: [...WEEKEND] })}>{t('lamps.day.weekend')}</button>
        </div>
      </fieldset>

      <label className="lp-inline">
        <input type="checkbox" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        <span>{t('lamps.timerEdit.enabled')}</span>
      </label>

      <h2 className="wk-h2">{t('lamps.timerEdit.what')}</h2>
      {withSignals.length === 0 && <p className="wk-empty">{t('lamps.timerEdit.noSignals')}</p>}
      <ol className="lp-action-list">
        {draft.actions.map((a, i) => {
          const found = actionOf(lamps, a);
          return (
            <li key={i} className="lp-action">
              <select aria-label={t('lamps.timerEdit.actionN', { n: i + 1 })} value={keyOf(a)} onChange={(e) => {
                const [lampId, signalId] = e.target.value.split('|');
                setActions((list) => list.map((x, j) => (j === i ? { lampId, signalId } : x)));
              }}>
                {found === null && <option value={keyOf(a)}>{t('lamps.timers.signalGone')}</option>}
                {withSignals.map((l) => (
                  <optgroup key={l.id} label={lampTitle(l)}>
                    {l.signals.map((s) => <option key={s.id} value={`${l.id}|${s.id}`}>{s.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <span className="lp-tools">
                <button type="button" className="wk-icon-btn" aria-label={t('lamps.up')} disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" /></button>
                <button type="button" className="wk-icon-btn" aria-label={t('lamps.down')} disabled={i === draft.actions.length - 1} onClick={() => move(i, 1)}><Icon name="down" /></button>
                <button type="button" className="wk-icon-btn" aria-label={t('lamps.timerEdit.removeAction', { n: i + 1 })} onClick={() => setActions((list) => list.filter((_, j) => j !== i))}><Icon name="trash" /></button>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={withSignals.length === 0 || draft.actions.length >= ACTIONS_MAX}
          onClick={() => { const first = firstAction(lamps); if (first !== null) setActions((list) => [...list, first]); }}>
          <Icon name="plus" />{t('lamps.timerEdit.action')}
        </button>
        {native && (
          <button type="button" className="wk-btn wk-btn-quiet" disabled={draft.actions.every((a) => actionOf(lamps, a) === null)} onClick={runNow}>
            <Icon name="play" />{t('lamps.timerEdit.runNow')}
          </button>
        )}
      </div>
      <p className="wk-working">{t('lamps.timerEdit.actionsNote')}</p>

      <PaceControl pace={draft.pace} onChange={(pace) => set({ pace })} title={t('lamps.timerEdit.paceTitle')} between={t('lamps.timerEdit.paceBetween')}
        note={t('lamps.timerEdit.paceNote')} />

      <LampConsole native={native} />

      {tried && problems.length > 0 && (
        <ul className="lp-problems">
          {problems.map((p) => <li key={p} className="wk-error">{p}</li>)}
        </ul>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
        <a className="wk-btn wk-btn-quiet" href={viewPath('lamps')}>{t('common.cancel')}</a>
      </div>
    </form>
  );
}
