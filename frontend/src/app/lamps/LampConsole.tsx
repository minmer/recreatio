/**
 * WAS DER SENDER TUT — ob das Telefon senden kann (Bluetooth, Erlaubnis), die
 * Konsole des letzten Versuchs mit „Stop", das Protokoll davor, und was ein
 * „nadano" bedeutet und was nicht.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { rich, useT } from '../core/i18n';
import { toast } from '../ui/dialogs';
import { idText, spaced } from './adv';
import { LampRadio, type LampSupport } from './native';
import { attemptsNow, markResponded, stopTransmission, subscribeAttempts, type Attempt, type AttemptState } from './transmit';

/** Was das Telefon kann — neu gefragt, wenn man aus den Einstellungen zurückkommt. */
export function useLampSupport(native: boolean): { readonly support: LampSupport | null; readonly refresh: () => void } {
  const [support, setSupport] = useState<LampSupport | null>(null);
  const refresh = useCallback(() => {
    if (native) void LampRadio.support().then(setSupport).catch(() => setSupport(null));
  }, [native]);
  useEffect(() => {
    refresh();
    const again = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [refresh]);
  return { support, refresh };
}

export const useAttempts = (): readonly Attempt[] => useSyncExternalStore(subscribeAttempts, attemptsNow);

/** Was fehlt, damit gesendet werden kann — mit dem einen Handgriff, der hilft. */
export function SupportPanel({ native, support, refresh, scan = false, quiet = false }: {
  native: boolean;
  support: LampSupport | null;
  refresh: () => void;
  /** Für „Odczyt z pilota": dann zählt die Erlaubnis zum Hören. */
  scan?: boolean;
  /** Nur, was fehlt — kein „gotowy", wenn alles da ist. */
  quiet?: boolean;
}) {
  const t = useT();
  if (!native) {
    return <p className="wk-note">{t('lamps.support.webOnly')}</p>;
  }
  if (support === null) return null;

  const settings = () => { void LampRadio.openSettings().catch(() => toast(t('lamps.support.settingsFailed'))); };
  const allow = () => {
    void (scan ? LampRadio.requestScanPermission() : LampRadio.requestPermission())
      .then(({ granted }) => { if (!granted) toast(t('lamps.support.denied')); refresh(); })
      .catch(() => refresh());
  };

  if (!support.bluetooth) return <p className="wk-error">{t('lamps.support.noBluetooth')}</p>;
  if (!support.enabled) {
    return (
      <section className="lp-setup" aria-label={t('lamps.support.bluetooth')}>
        <p>{t('lamps.support.off')}</p>
        <div className="wk-actions"><button type="button" className="wk-btn" onClick={settings}>{t('lamps.support.settings')}</button></div>
      </section>
    );
  }
  if (!scan && !support.advertiser) return <p className="wk-error">{t('lamps.support.noAdvertiser')}</p>;
  if (scan && !support.scanner) return <p className="wk-error">{t('lamps.support.noScanner')}</p>;
  if (scan && support.locationNeeded && !support.locationOn) {
    return <p className="wk-note">{t('lamps.support.location')}</p>;
  }
  const permission = scan ? support.scanPermission : support.permission;
  if (permission !== 'granted') {
    return (
      <section className="lp-setup" aria-label={t('lamps.support.consent')}>
        <p>{t(scan ? 'lamps.support.askScan' : 'lamps.support.askSend')}</p>
        <div className="wk-actions"><button type="button" className="wk-btn" onClick={allow}>{t('lamps.support.allow')}</button></div>
      </section>
    );
  }
  if (quiet) return null;
  return (
    <p className="wk-working">
      {t(scan ? 'lamps.support.scannerReady' : 'lamps.support.advertiserReady', { sdk: support.sdk })}
      {!scan && <> · {t(support.multiple ? 'lamps.support.multiple' : 'lamps.support.single')}</>}
    </p>
  );
}

/* -- Die Konsole -------------------------------------------------------------------------------- */

/* Texte: lamps.state.<Zustand>. */
const STATE_TAG: Readonly<Record<AttemptState, { readonly tone: string }>> = {
  queued: { tone: '' },
  sending: { tone: 'wk-tag-new' },
  sent: { tone: 'wk-tag-open' },
  failed: { tone: 'lp-tag-bad' },
  stopped: { tone: 'wk-tag-warn' }
};

const clock = (at: number): string => {
  const d = new Date(at);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};

/**
 * DIE LEISTE OBEN: was gerade hinausgeht, wie viele Drücke noch warten, „Stop" — und
 * wenn nichts hinausgeht, eben das. Sie steht IMMER da und ist immer gleich hoch (eine
 * Zeile), damit die Knöpfe darunter beim Senden nicht springen (user 2026-10-26).
 */
export function LampQueueBar({ native }: { native: boolean }) {
  const t = useT();
  const attempts = useAttempts();
  if (!native) return null;
  const now = attempts.find((a) => a.state === 'sending') ?? null;
  const waiting = attempts.filter((a) => a.state === 'queued').length;
  const busy = now !== null || waiting > 0;
  return (
    <div className={`lp-queue${busy ? ' is-busy' : ''}`} role="status" aria-live="polite">
      <span className="lp-queue-dot" aria-hidden="true" />
      <span className="lp-queue-text">
        {now !== null ? rich(t('lamps.queue.sending', { lamp: now.lamp, signal: now.signal }), { b: (s) => <strong>{s}</strong> }) : waiting > 0 ? t('lamps.queue.pause') : t('lamps.queue.idle')}
        {waiting > 0 && <> · {t('lamps.queue.waiting', { count: waiting })}</>}
      </span>
      <button type="button" className="wk-btn wk-btn-small wk-btn-danger lp-queue-stop" disabled={!busy} aria-hidden={!busy}
        tabIndex={busy ? 0 : -1} onClick={() => void stopTransmission(LampRadio)}>{t('lamps.queue.stop')}</button>
    </div>
  );
}

export function LampConsole({ native }: { native: boolean }) {
  const t = useT();
  const attempts = useAttempts();
  if (attempts.length === 0) return null;
  /* Vorn steht, was gerade hinausgeht — sonst der letzte fertige Versuch; was wartet, darunter. */
  const latest = attempts.find((a) => a.state === 'sending') ?? attempts.find((a) => a.state !== 'queued') ?? attempts[0];
  const waiting = attempts.filter((a) => a.state === 'queued' && a.id !== latest.id).reverse();
  const older = attempts.filter((a) => a.id !== latest.id && a.state !== 'queued');
  const sending = attempts.some((a) => a.state === 'sending' || a.state === 'queued');

  return (
    <section className="wk-box lp-console" aria-label={t('lamps.console.title')}>
      <div className="wk-box-head">
        <h2 className="wk-box-title">{t('lamps.console.title')}</h2>
        {native && (
          <button type="button" className="wk-btn wk-btn-small wk-btn-danger lp-stop" disabled={!sending}
            onClick={() => void stopTransmission(LampRadio)}>
            {t('lamps.queue.stop')}
          </button>
        )}
      </div>
      <div className="wk-box-body">
        <AttemptView attempt={latest} open />
        {waiting.length > 0 && (
          <p className="lp-said">{t('lamps.console.queued', { list: waiting.map((a) => `${a.lamp} → ${a.signal}`).join(', ') })}</p>
        )}
        {older.length > 0 && (
          <details className="lp-older">
            <summary>{t('lamps.console.older', { count: older.length })}</summary>
            {older.map((a) => <AttemptView key={a.id} attempt={a} open={false} />)}
          </details>
        )}
      </div>
    </section>
  );
}

function AttemptView({ attempt, open }: { attempt: Attempt; open: boolean }) {
  const t = useT();
  const tag = STATE_TAG[attempt.state];
  const results = attempt.result?.frames ?? [];

  return (
    <details className="lp-attempt" open={open}>
      <summary>
        <span className="lp-time">{clock(attempt.at)}</span>
        <span className="lp-attempt-name">{attempt.lamp} → <strong>{attempt.signal}</strong></span>
        <span className={`wk-tag ${tag.tone}`}>{t(`lamps.state.${attempt.state}`)}</span>
      </summary>
      {attempt.message !== null && <p className={attempt.state === 'failed' ? 'wk-error' : 'lp-said'}>{attempt.message}</p>}
      {attempt.state === 'sent' && <p className="wk-working">{t('lamps.console.unchecked')}</p>}

      <dl className="lp-dl">
        {attempt.frames.map((f, i) => {
          const r = results[i];
          return (
            <div key={i} className="lp-dl-row">
              <dt>{attempt.frames.length === 1 ? t('lamps.console.packet') : t('lamps.console.frame', { n: i + 1 })}</dt>
              <dd>
                <span className="lp-hex">{spaced(f.hex)}</span>
                <span className="lp-facts">
                  {f.size} B{f.manufacturerId !== null && <> · {t('lamps.console.maker', { id: idText(f.manufacturerId) })}</>} · {t('lamps.console.asked', { ms: f.durationMs, every: f.intervalMs })}
                  {f.gapMs > 0 && i < attempt.frames.length - 1 && <> · {t('lamps.console.gap', { ms: f.gapMs })}</>}
                </span>
                {r !== undefined && (
                  <span className="lp-facts">
                    {r.startMs !== undefined ? t('lamps.console.startAfter', { ms: r.startMs }) : t('lamps.console.noStart')}
                    {r.startedAt !== undefined && <> {t('lamps.console.at', { time: clock(r.startedAt) })}</>}
                    {r.heldMs !== undefined && <> · {t('lamps.console.held', { ms: r.heldMs })}</>}
                    {r.code !== 'ok' && <> · {r.code}</>}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
        {attempt.detail !== null && (
          <div className="lp-dl-row"><dt>{t('lamps.console.androidSays')}</dt><dd className="lp-hex">{attempt.detail}</dd></div>
        )}
      </dl>
      {attempt.timing.length > 0 && (
        <ul className="lp-timing">
          {attempt.timing.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}

      {attempt.state === 'sent' && (
        <div className="lp-responded" role="group" aria-label={t('lamps.console.respondedAsk')}>
          <span>{t('lamps.console.responded')}</span>
          <button type="button" className="wk-btn wk-btn-small wk-btn-quiet" aria-pressed={attempt.responded === true}
            onClick={() => markResponded(attempt.id, attempt.responded === true ? null : true)}>{t('common.yes')}</button>
          <button type="button" className="wk-btn wk-btn-small wk-btn-quiet" aria-pressed={attempt.responded === false}
            onClick={() => markResponded(attempt.id, attempt.responded === false ? null : false)}>{t('common.no')}</button>
        </div>
      )}
    </details>
  );
}

/** Was „nadano" heisst — und was das Telefon nicht kann. */
export function LampLimits() {
  const t = useT();
  const B = { b: (s: string) => <strong>{s}</strong> };
  return (
    <details className="lp-limits">
      <summary>{t('lamps.limits.title')}</summary>
      <ul>
        <li>{rich(t('lamps.limits.sent'), B)}</li>
        <li>{rich(t('lamps.limits.noAddress'), B)}</li>
        <li>{rich(t('lamps.limits.noSpoof'), B)}</li>
        <li>{rich(t('lamps.limits.replay'), B)}</li>
        <li>{rich(t('lamps.limits.timing'), B)}</li>
        <li>{rich(t('lamps.limits.makerOnly'), B)}</li>
      </ul>
      <p className="wk-working">{t('lamps.limits.power')}</p>
    </details>
  );
}
