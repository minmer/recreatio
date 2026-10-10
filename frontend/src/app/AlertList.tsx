/**
 * CZEKA NA CIEBIE (0094) — die Einträge, und die Liste zum Ordnen.
 *
 * <code>
 *   AlertRows            die Einträge (Glocke, Teil „Czeka na Ciebie"), ✓ wo es geht
 *   AlertSettingsEditor  welche Arten sich melden, und in welcher Reihenfolge
 * </code>
 */

import { ALERT_KINDS, alertLabel, moveAlert, toggleAlert, useAlertSettings, type AlertItem } from './alerts';
import { markFormSeen, markLinksSeen } from './notify';

export function AlertRows({ items, compact = false, onPick }: {
  items: readonly AlertItem[];
  /** Eine Zeile je Art, mit der Summe — statt jedes Eintrags. */
  compact?: boolean;
  onPick?: () => void;
}) {
  if (compact) {
    const kinds = [...new Set(items.map((one) => one.kind))];
    return (
      <ul className="wk-alert-list is-compact">
        {kinds.map((kind) => {
          const mine = items.filter((one) => one.kind === kind);
          const total = mine.reduce((n, one) => n + (one.count ?? 1), 0);
          return (
            <li key={kind}>
              <a href={mine[0].href} onClick={onPick}>
                <span className="wk-alert-what">{alertLabel(kind)}</span>
                <span className="wk-alert-n">{total}</span>
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="wk-alert-list">
      {items.map((one) => (
        <li key={one.key} data-alert={one.kind}>
          <a href={one.href} onClick={onPick}>
            <span className="wk-alert-kind">{alertLabel(one.kind)}</span>
            <span className="wk-alert-what">{one.label}</span>
            <span className="wk-alert-n">{one.detail}</span>
          </a>
          {one.seen !== undefined && (
            <button type="button" className="wk-bell-done" title="Przejrzane — nie pokazuj już jako nowe" aria-label={`${one.label}: przejrzane`}
              onClick={() => { if ('form' in one.seen!) void markFormSeen(one.seen.form); else markLinksSeen(); }}>✓</button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Welche Arten sich melden, und in welcher Reihenfolge — für das Konto. */
export function AlertSettingsEditor() {
  const [settings, setSettings] = useAlertSettings();

  return (
    <ol className="wk-alert-order" aria-label="Kolejność powiadomień">
      {settings.order.map((kind, i) => {
        const def = ALERT_KINDS.find((one) => one.kind === kind)!;
        const on = !settings.off.includes(kind);
        return (
          <li key={kind} className={on ? undefined : 'is-off'} data-alert-kind={kind}>
            <label className="wk-check">
              <input type="checkbox" checked={on} onChange={(e) => setSettings(toggleAlert(settings, kind, e.target.checked))} />
              <span><strong>{def.label}</strong><span className="wk-hint">{def.says}</span></span>
            </label>
            <span className="wk-alert-move">
              <button type="button" className="wk-icon-btn" aria-label={`${def.label}: wyżej`} disabled={i === 0}
                onClick={() => setSettings(moveAlert(settings, kind, -1))}>↑</button>
              <button type="button" className="wk-icon-btn" aria-label={`${def.label}: niżej`} disabled={i === settings.order.length - 1}
                onClick={() => setSettings(moveAlert(settings, kind, 1))}>↓</button>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default AlertRows;
