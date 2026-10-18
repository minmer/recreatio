/**
 * WAS DER SENDER TUT — ob das Telefon senden kann (Bluetooth, Erlaubnis), die
 * Konsole des letzten Versuchs mit „Stop", das Protokoll davor, und was ein
 * „nadano" bedeutet und was nicht.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

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
  if (!native) {
    return <p className="wk-note">Sygnały nadaje i odczytuje telefon z aplikacją REcreatio (wydanie sms). Tutaj możesz ustawiać urządzenia i sygnały.</p>;
  }
  if (support === null) return null;

  const settings = () => { void LampRadio.openSettings().catch(() => toast('Nie udało się otworzyć ustawień Bluetooth.')); };
  const allow = () => {
    void (scan ? LampRadio.requestScanPermission() : LampRadio.requestPermission())
      .then(({ granted }) => { if (!granted) toast('Bez zgody „Urządzenia w pobliżu" to nie zadziała — można ją dać w ustawieniach aplikacji.'); refresh(); })
      .catch(() => refresh());
  };

  if (!support.bluetooth) return <p className="wk-error">Ten telefon nie ma Bluetooth.</p>;
  if (!support.enabled) {
    return (
      <section className="lp-setup" aria-label="Bluetooth">
        <p>Bluetooth jest wyłączony.</p>
        <div className="wk-actions"><button type="button" className="wk-btn" onClick={settings}>Ustawienia Bluetooth</button></div>
      </section>
    );
  }
  if (!scan && !support.advertiser) return <p className="wk-error">Ten telefon nie potrafi nadawać reklam BLE (Android nie daje nadajnika).</p>;
  if (scan && !support.scanner) return <p className="wk-error">Android nie daje skanera BLE.</p>;
  if (scan && support.locationNeeded && !support.locationOn) {
    return <p className="wk-note">Na tym Androidzie (11 i starszy) odczyt z pilota wymaga włączonej lokalizacji.</p>;
  }
  const permission = scan ? support.scanPermission : support.permission;
  if (permission !== 'granted') {
    return (
      <section className="lp-setup" aria-label="Zgoda">
        <p>{scan ? 'Aby słyszeć pilota' : 'Aby nadawać'}, Android zapyta o zgodę „Urządzenia w pobliżu".</p>
        <div className="wk-actions"><button type="button" className="wk-btn" onClick={allow}>Zezwól</button></div>
      </section>
    );
  }
  if (quiet) return null;
  return (
    <p className="wk-working">
      {scan ? 'Skaner BLE gotowy' : 'Nadajnik BLE gotowy'} · Android API {support.sdk}
      {!scan && <> · {support.multiple ? 'kilka reklam naraz' : 'jedna reklama naraz'}</>}
    </p>
  );
}

/* -- Die Konsole -------------------------------------------------------------------------------- */

const STATE_TAG: Readonly<Record<AttemptState, { readonly text: string; readonly tone: string }>> = {
  queued: { text: 'Czeka', tone: '' },
  sending: { text: 'Nadawanie…', tone: 'wk-tag-new' },
  sent: { text: 'Reklama nadana', tone: 'wk-tag-open' },
  failed: { text: 'Nie nadano', tone: 'lp-tag-bad' },
  stopped: { text: 'Przerwano', tone: 'wk-tag-warn' }
};

const clock = (at: number): string => {
  const d = new Date(at);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};

/**
 * DIE LEISTE OBEN, solange gesendet wird oder etwas wartet: was gerade hinausgeht,
 * wie viele Drücke noch warten, „Stop". Klebt oben — die Knöpfe bleiben darunter.
 */
export function LampQueueBar({ native }: { native: boolean }) {
  const attempts = useAttempts();
  const now = attempts.find((a) => a.state === 'sending') ?? null;
  const waiting = attempts.filter((a) => a.state === 'queued').length;
  if (!native || (now === null && waiting === 0)) return null;
  return (
    <div className="lp-queue" role="status" aria-live="polite">
      <span className="lp-queue-text">
        {now !== null ? <>Nadawanie: {now.lamp} → <strong>{now.signal}</strong></> : 'Za chwilę…'}
        {waiting > 0 && <> · w kolejce {waiting}</>}
      </span>
      <button type="button" className="wk-btn wk-btn-small wk-btn-danger" onClick={() => void stopTransmission(LampRadio)}>Stop</button>
    </div>
  );
}

export function LampConsole({ native }: { native: boolean }) {
  const attempts = useAttempts();
  if (attempts.length === 0) return null;
  /* Vorn steht, was gerade hinausgeht — sonst der letzte fertige Versuch; was wartet, darunter. */
  const latest = attempts.find((a) => a.state === 'sending') ?? attempts.find((a) => a.state !== 'queued') ?? attempts[0];
  const waiting = attempts.filter((a) => a.state === 'queued' && a.id !== latest.id).reverse();
  const older = attempts.filter((a) => a.id !== latest.id && a.state !== 'queued');
  const sending = attempts.some((a) => a.state === 'sending' || a.state === 'queued');

  return (
    <section className="wk-box lp-console" aria-label="Konsola nadawania">
      <div className="wk-box-head">
        <h2 className="wk-box-title">Konsola nadawania</h2>
        {native && (
          <button type="button" className="wk-btn wk-btn-small wk-btn-danger lp-stop" disabled={!sending}
            onClick={() => void stopTransmission(LampRadio)}>
            Stop
          </button>
        )}
      </div>
      <div className="wk-box-body">
        <AttemptView attempt={latest} open />
        {waiting.length > 0 && (
          <p className="lp-said">W kolejce: {waiting.map((a) => `${a.lamp} → ${a.signal}`).join(', ')}</p>
        )}
        {older.length > 0 && (
          <details className="lp-older">
            <summary>Wcześniejsze próby ({older.length})</summary>
            {older.map((a) => <AttemptView key={a.id} attempt={a} open={false} />)}
          </details>
        )}
      </div>
    </section>
  );
}

function AttemptView({ attempt, open }: { attempt: Attempt; open: boolean }) {
  const tag = STATE_TAG[attempt.state];
  const results = attempt.result?.frames ?? [];

  return (
    <details className="lp-attempt" open={open}>
      <summary>
        <span className="lp-time">{clock(attempt.at)}</span>
        <span className="lp-attempt-name">{attempt.lamp} → <strong>{attempt.signal}</strong></span>
        <span className={`wk-tag ${tag.tone}`}>{tag.text}</span>
      </summary>
      {attempt.message !== null && <p className={attempt.state === 'failed' ? 'wk-error' : 'lp-said'}>{attempt.message}</p>}
      {attempt.state === 'sent' && <p className="wk-working">Reakcja lampy niesprawdzona — telefon wie tylko, że Android nadawał.</p>}

      <dl className="lp-dl">
        {attempt.frames.map((f, i) => {
          const r = results[i];
          return (
            <div key={i} className="lp-dl-row">
              <dt>{attempt.frames.length === 1 ? 'Pakiet' : `Ramka ${i + 1}`}</dt>
              <dd>
                <span className="lp-hex">{spaced(f.hex)}</span>
                <span className="lp-facts">
                  {f.size} B{f.manufacturerId !== null && <> · producent {idText(f.manufacturerId)}</>} · żądano {f.durationMs} ms
                  {f.gapMs > 0 && i < attempt.frames.length - 1 && <> · przerwa {f.gapMs} ms</>}
                </span>
                {r !== undefined && (
                  <span className="lp-facts">
                    Android: {r.startMs !== undefined ? `start po ${r.startMs} ms` : 'bez startu'}
                    {r.startedAt !== undefined && <> o {clock(r.startedAt)}</>}
                    {r.heldMs !== undefined && <> · nadawano {r.heldMs} ms · zatrzymano</>}
                    {r.code !== 'ok' && <> · {r.code}</>}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
        {attempt.detail !== null && (
          <div className="lp-dl-row"><dt>Android mówi</dt><dd className="lp-hex">{attempt.detail}</dd></div>
        )}
      </dl>
      {attempt.timing.length > 0 && (
        <ul className="lp-timing">
          {attempt.timing.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}

      {attempt.state === 'sent' && (
        <div className="lp-responded" role="group" aria-label="Czy lampa zareagowała?">
          <span>Lampa zareagowała?</span>
          <button type="button" className="wk-btn wk-btn-small wk-btn-quiet" aria-pressed={attempt.responded === true}
            onClick={() => markResponded(attempt.id, attempt.responded === true ? null : true)}>Tak</button>
          <button type="button" className="wk-btn wk-btn-small wk-btn-quiet" aria-pressed={attempt.responded === false}
            onClick={() => markResponded(attempt.id, attempt.responded === false ? null : false)}>Nie</button>
        </div>
      )}
    </details>
  );
}

/** Was „nadano" heisst — und was das Telefon nicht kann. */
export function LampLimits() {
  return (
    <details className="lp-limits">
      <summary>Co znaczy „nadano" — i czego telefon nie potrafi</summary>
      <ul>
        <li><strong>Nadano ≠ lampa zadziałała.</strong> Android potwierdza tylko, że reklama BLE wystartowała i została zatrzymana. Czy lampa ją usłyszała, sprawdzasz Ty (przyciski „Tak/Nie" w konsoli).</li>
        <li><strong>Wybór urządzenia nie adresuje lampy.</strong> Reklama BLE trafia do wszystkich w zasięgu. Którą lampę włączy, decydują bajty w pakiecie (identyfikator, licznik — zależnie od producenta), nie nazwa ani numer tutaj.</li>
        <li><strong>Adres pilota nie zostanie podrobiony.</strong> Telefon nadaje ze swojego (losowego) adresu; zwykła aplikacja nie może go zmienić. Jeśli lampa sprawdza adres nadawcy, sam pakiet nie wystarczy.</li>
        <li><strong>Zabezpieczenie przed powtórzeniem.</strong> Jeśli pilot zmienia licznik lub kod przy każdym naciśnięciu, nagrany pakiet może zostać odrzucony.</li>
        <li><strong>Czasy są przybliżone.</strong> Odstępy między pakietami ustala Android (przy niskim opóźnieniu ok. 100 ms); start i przejście między ramkami trwają dziesiątki milisekund. Odstępy rzędu kilku ms jak w pilocie nie są możliwe — konsola pokazuje, ile naprawdę trwało.</li>
        <li><strong>Nadawane bez zmian są tylko dane producenta (0xFF).</strong> Inne struktury (nazwa, flagi, UUID) Android układa po swojemu — takie pakiety są odrzucane z opisem, a nie zmieniane po cichu.</li>
      </ul>
      <p className="wk-working">Telefon nadaje z mocą „wysoka", bez możliwości połączenia; 31 bajtów to granica reklamy legacy.</p>
    </details>
  );
}
