/**
 * DIE TIMER IN DER LISTE DER LAMPEN — Uhrzeit, Tage, was sie tun, wann als
 * Nächstes; ein Häkchen schaltet einen Timer aus und ein. Auf dem Telefon dazu:
 * ob DIESES Telefon die Timer ausführt, der nächste Wecker, die letzten Läufe.
 */

import { useT } from '../core/i18n';
import { Icon } from '../ui/icons';
import { timerPath, timerTitle, timeText, type Lamp, type LampTimer } from './lampStore';
import type { TimerStatus } from './native';
import { paceSummary } from './pace';
import { actionsText, daysText, nextRun, stampText, whenText } from './timers';

export function TimerList({ lamps, timers, native, status, busy, onEnabled, onPhone }: {
  lamps: readonly Lamp[];
  timers: readonly LampTimer[];
  native: boolean;
  status: TimerStatus | null;
  busy: boolean;
  onEnabled: (timer: LampTimer, enabled: boolean) => void;
  onPhone: (on: boolean) => void;
}) {
  const t = useT();
  const now = Date.now();

  return (
    <section className="wk-box lp-timers" aria-label={t('lamps.timers.title')}>
      <div className="wk-box-head">
        <h2 className="wk-box-title">{t('lamps.timers.title')}</h2>
        <a className="wk-btn wk-btn-small wk-btn-quiet lp-head-end" href={timerPath()}><Icon name="plus" />{t('lamps.timers.timer')}</a>
      </div>
      <div className="wk-box-body">
        {native && status !== null && (
          <div className="lp-phone-timers">
            <label className="lp-inline">
              <input type="checkbox" checked={status.on} disabled={busy} onChange={(e) => onPhone(e.target.checked)} />
              <span>{t('lamps.timers.thisPhone')}</span>
            </label>
            <span className="lp-facts">
              {!status.on
                ? t('lamps.timers.phoneOff')
                : status.next !== null
                  ? t('lamps.timers.nextAt', { when: whenText(status.next.at, now), names: status.next.names.join(', ') })
                  : t('lamps.timers.nothingPlanned')}
            </span>
            {status.on && !status.exact && <p className="wk-note">{t('lamps.timers.inexact')}</p>}
          </div>
        )}
        {!native && <p className="wk-working">{t('lamps.timers.webNote')}</p>}

        {timers.length === 0
          ? <p className="wk-empty">{t('lamps.timers.empty')}</p>
          : (
            <ul className="lp-timer-list">
              {timers.map((one) => {
                const next = nextRun(one, now);
                return (
                  <li key={one.id} className="lp-timer">
                    <input type="checkbox" aria-label={t('lamps.timers.enabledFor', { name: timerTitle(one) })} checked={one.enabled} disabled={busy}
                      onChange={(e) => onEnabled(one, e.target.checked)} />
                    <a className="lp-timer-link" href={timerPath(one.id)}>
                      <span className="lp-timer-time">{timeText(one.minute)}</span>
                      <span className="lp-timer-text">
                        <span className="lp-timer-name">{one.name.trim() || t('lamps.timers.timer')} · {daysText(one.days)}</span>
                        <span className="lp-facts">{actionsText(one, lamps) || t('lamps.timers.noActions')}</span>
                        {paceSummary(one.pace) !== null && <span className="lp-facts">{t('lamps.timers.pace', { pace: paceSummary(one.pace) ?? '' })}</span>}
                        <span className="lp-facts">{one.enabled ? (next !== null ? t('lamps.timers.then', { when: whenText(next, now) }) : '') : t('lamps.timers.off')}</span>
                      </span>
                      <Icon name="next" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}

        {native && status !== null && status.log.length > 0 && (
          <details className="lp-older">
            <summary>{t('lamps.timers.log', { count: status.log.length })}</summary>
            <ul className="lp-run-log">
              {status.log.map((r) => (
                <li key={`${r.at}-${r.timerId}`}>
                  <span className="lp-time">{stampText(r.at)}</span> {r.name} · {r.ok === r.total ? t('lamps.timers.sentAll', { total: r.total }) : t('lamps.timers.sentSome', { ok: r.ok, total: r.total })}
                  {r.ranAt - r.at > 120_000 && <span className="lp-facts">{t('lamps.timers.ranAt', { time: stampText(r.ranAt) })}</span>}
                  {r.failed.map((f) => <span key={f.label} className="lp-facts wk-error">{f.label}: {f.code}{f.detail !== null ? ` (${f.detail})` : ''}</span>)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
