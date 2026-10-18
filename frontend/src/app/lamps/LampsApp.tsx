/**
 * LAMPY (2026-10-18) — die eigenen Lampen und ihre Knöpfe; ein Druck sendet den
 * Sygnał als BLE-Werbung vom Telefon (Ausgabe „sms", `LampPlugin`).
 *
 * <code>
 *   #/workspace/lamps            die Lampen mit ihren Knöpfen, die Konsole
 *   #/workspace/lamps/nowe       ein neues Gerät
 *   #/workspace/lamps/pilot      vom Pilot lernen (?lampa=<kennung> wählt das Gerät vor)
 *   #/workspace/lamps/<kennung>  ein Gerät und seine Sygnały bearbeiten
 * </code>
 *
 * Gespeichert im eigenen Bereich (0118, `lampStore.ts`) — nach einer
 * Neuinstallation und im Browser ist alles wieder da; senden kann nur das Telefon.
 */

import { useCallback, useEffect, useState } from 'react';

import { plural } from '../core/plural';
import { WorkspaceError, type Who } from '../core/session';
import { useCrumbs } from '../shell/crumbTrail';
import { viewPath } from '../routes';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { openPhone, type PhoneCtx } from '../phone/phoneContext';
import { LampEdit } from './LampEdit';
import { LampLearn } from './LampLearn';
import { LampConsole, LampLimits, SupportPanel, useAttempts, useLampSupport } from './LampConsole';
import { lampOrder, lampTitle, loadLamps, NEW_LAMP, PILOT, pilotPath, type Lamp, type LampSignal } from './lampStore';
import { LampRadio, lampHere, type LampSupport } from './native';
import { transmit } from './transmit';
import './lamps.css';

export function LampsApp({ who, trail }: { who: Who; trail: readonly string[] }) {
  const native = lampHere();
  const [ctx, setCtx] = useState<PhoneCtx | null>(null);
  const [lamps, setLamps] = useState<readonly Lamp[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const { support, refresh } = useLampSupport(native);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const opened = await openPhone(who);
        const list = await loadLamps(opened);
        if (!alive) return;
        setCtx(opened);
        setLamps(list);
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać urządzeń.');
      }
    })();
    return () => { alive = false; };
  }, [who]);

  const saved = useCallback((lamp: Lamp) => {
    setLamps((list) => [...(list ?? []).filter((l) => l.id !== lamp.id), lamp].sort(lampOrder));
  }, []);
  const removed = useCallback((id: string) => {
    setLamps((list) => (list ?? []).filter((l) => l.id !== id));
  }, []);

  const step = trail[0];
  if (failed !== null) return <p className="wk-error">{failed}</p>;
  if (ctx === null || lamps === null) return <Loading label="Wczytywanie urządzeń…" />;

  if (step === PILOT) {
    return <LampLearn ctx={ctx} lamps={lamps} native={native} support={support} refresh={refresh} onSaved={saved} />;
  }
  if (step !== undefined) {
    const had = step === NEW_LAMP ? null : lamps.find((l) => l.id === step) ?? null;
    if (step !== NEW_LAMP && had === null) return <p className="wk-empty">Takiego urządzenia nie ma.</p>;
    return (
      <LampEdit key={step} ctx={ctx} lamp={had} native={native}
        onSaved={(lamp, then) => {
          saved(lamp);
          if (then === 'list') window.location.hash = viewPath('lamps');
          if (then === 'open') window.location.hash = viewPath('lamps', lamp.id);
        }}
        onRemoved={(id) => {
          removed(id);
          window.location.hash = viewPath('lamps');
        }} />
    );
  }
  return <LampList lamps={lamps} native={native} support={support} refresh={refresh} />;
}

export default LampsApp;

/* -- Die Lampen mit ihren Knöpfen -------------------------------------------------------------- */

function LampList({ lamps, native, support, refresh }: {
  lamps: readonly Lamp[];
  native: boolean;
  support: LampSupport | null;
  refresh: () => void;
}) {
  useCrumbs([]);
  const attempts = useAttempts();
  const sending = attempts.some((a) => a.state === 'sending');

  const send = (lamp: Lamp, signal: LampSignal) => {
    void transmit(LampRadio, lamp, signal).then((a) => {
      if (a.code === 'no-permission' || a.code === 'bluetooth-off' || a.code === 'no-advertiser') refresh();
    });
  };

  return (
    <>
      <PageHeader title="Lampy" meta={`${lamps.length} ${plural(lamps.length, 'urządzenie', 'urządzenia', 'urządzeń')}`} actions={(
        <>
          <a className="wk-btn" href={viewPath('lamps', NEW_LAMP)}><Icon name="plus" />Urządzenie</a>
          <a className="wk-btn wk-btn-quiet" href={pilotPath()}><Icon name="radio" />Odczyt z pilota</a>
        </>
      )} />

      <SupportPanel native={native} support={support} refresh={refresh} />
      <LampConsole native={native} />

      {lamps.length === 0
        ? <p className="wk-empty">Nie ma jeszcze urządzeń — dodaj lampę i wklej jej sygnały albo odczytaj je z pilota.</p>
        : (
          <div className="lp-grid">
            {lamps.map((lamp) => (
              <section key={lamp.id} className="wk-box lp-card" aria-label={lampTitle(lamp)}>
                <div className="wk-box-head">
                  <h2 className="wk-box-title">{lamp.name.trim() || 'Bez nazwy'}</h2>
                  {lamp.number !== null && <span className="wk-tag">nr {lamp.number}</span>}
                  <a className="wk-icon-btn lp-card-edit" href={viewPath('lamps', lamp.id)} aria-label={`Edytuj: ${lampTitle(lamp)}`}><Icon name="edit" /></a>
                </div>
                <div className="wk-box-body">
                  <p className="lp-card-meta">
                    {[lamp.room, 'BLE (reklama)', `${lamp.signals.length} ${plural(lamp.signals.length, 'sygnał', 'sygnały', 'sygnałów')}`].filter(Boolean).join(' · ')}
                  </p>
                  <div className="lp-pad">
                    {lamp.signals.map((s) => (
                      <button key={s.id} type="button" className="wk-btn lp-key" disabled={!native || sending} onClick={() => send(lamp, s)}>
                        {s.label}
                      </button>
                    ))}
                    <a className="wk-btn wk-btn-quiet lp-key" href={viewPath('lamps', lamp.id)}><Icon name="plus" />Sygnał</a>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

      <LampLimits />
    </>
  );
}
