/**
 * DIE TIMER IN DER LISTE DER LAMPEN — Uhrzeit, Tage, was sie tun, wann als
 * Nächstes; ein Häkchen schaltet einen Timer aus und ein. Auf dem Telefon dazu:
 * ob DIESES Telefon die Timer ausführt, der nächste Wecker, die letzten Läufe.
 */

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
  const now = Date.now();

  return (
    <section className="wk-box lp-timers" aria-label="Timery">
      <div className="wk-box-head">
        <h2 className="wk-box-title">Timery</h2>
        <a className="wk-btn wk-btn-small wk-btn-quiet lp-head-end" href={timerPath()}><Icon name="plus" />Timer</a>
      </div>
      <div className="wk-box-body">
        {native && status !== null && (
          <div className="lp-phone-timers">
            <label className="lp-inline">
              <input type="checkbox" checked={status.on} disabled={busy} onChange={(e) => onPhone(e.target.checked)} />
              <span>Ten telefon wykonuje timery</span>
            </label>
            <span className="lp-facts">
              {!status.on
                ? 'Wyłączone — timery wykona telefon, na którym są włączone.'
                : status.next !== null
                  ? `Najbliżej: ${whenText(status.next.at, now)} · ${status.next.names.join(', ')}`
                  : 'Nic nie jest zaplanowane.'}
            </span>
            {status.on && !status.exact && <p className="wk-note">Android nie pozwala tu na dokładne budziki — timer może się spóźnić o kilka minut.</p>}
          </div>
        )}
        {!native && <p className="wk-working">Timery wykonuje telefon z aplikacją REcreatio (wydanie sms), na którym są włączone — także przy zamkniętej aplikacji.</p>}

        {timers.length === 0
          ? <p className="wk-empty">Brak timerów — np. o 7:00 włącz lampę w sypialni, o 23:00 wyłącz wszystkie.</p>
          : (
            <ul className="lp-timer-list">
              {timers.map((t) => {
                const next = nextRun(t, now);
                return (
                  <li key={t.id} className="lp-timer">
                    <input type="checkbox" aria-label={`Włączony: ${timerTitle(t)}`} checked={t.enabled} disabled={busy}
                      onChange={(e) => onEnabled(t, e.target.checked)} />
                    <a className="lp-timer-link" href={timerPath(t.id)}>
                      <span className="lp-timer-time">{timeText(t.minute)}</span>
                      <span className="lp-timer-text">
                        <span className="lp-timer-name">{t.name.trim() || 'Timer'} · {daysText(t.days)}</span>
                        <span className="lp-facts">{actionsText(t, lamps) || 'bez akcji'}</span>
                        {paceSummary(t.pace) !== null && <span className="lp-facts">tempo: {paceSummary(t.pace)}</span>}
                        <span className="lp-facts">{t.enabled ? (next !== null ? `następnie ${whenText(next, now)}` : '') : 'wyłączony'}</span>
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
            <summary>Ostatnie uruchomienia ({status.log.length})</summary>
            <ul className="lp-run-log">
              {status.log.map((r) => (
                <li key={`${r.at}-${r.timerId}`}>
                  <span className="lp-time">{stampText(r.at)}</span> {r.name} · {r.ok === r.total ? `nadano ${r.total}` : `nadano ${r.ok} z ${r.total}`}
                  {r.ranAt - r.at > 120_000 && <span className="lp-facts">uruchomiony o {stampText(r.ranAt)}</span>}
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
