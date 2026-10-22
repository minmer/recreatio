/**
 * LAMPY (2026-10-18) — die eigenen Lampen und ihre Knöpfe; ein Druck sendet den
 * Sygnał als BLE-Werbung vom Telefon (Ausgabe „sms", `LampPlugin`). Man darf
 * weiterdrücken, während gesendet wird: jeder Druck kommt nach dem vorigen dran.
 *
 * <code>
 *   #/workspace/lamps               die Knöpfe (oben), die Timer, die Konsole; unten Neues
 *   #/workspace/lamps/nowe          ein neues Gerät
 *   #/workspace/lamps/pilot         vom Pilot lernen (?lampa=<kennung> wählt das Gerät vor)
 *   #/workspace/lamps/timer/<id>    ein Timer (timer/nowy: ein neuer)
 *   #/workspace/lamps/<kennung>     ein Gerät und seine Sygnały bearbeiten
 * </code>
 *
 * Gespeichert im eigenen Bereich (0118, `lampStore.ts`) — nach einer
 * Neuinstallation und im Browser ist alles wieder da; senden kann nur das Telefon.
 * Ändert sich auf dem Telefon ein Gerät oder ein Timer, bekommt das Telefon gleich
 * den neuen Plan der Timer (`timers.ts`). Ein kurzer Druck sendet den ganzen Sygnał,
 * ein gehaltener so lange, wie er gedrückt ist (`SendKey`); der Regler darunter
 * (`pace.ts`, die Pause) gilt nur für die Knöpfe — jeder Timer hat seine eigenen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { plural } from '../core/plural';
import { useRemembered } from '../core/prefs';
import { WorkspaceError, type Who } from '../core/session';
import { useCrumbs } from '../shell/crumbTrail';
import { viewPath } from '../routes';
import { toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { openPhone, type PhoneCtx } from '../phone/phoneContext';
import { LampEdit } from './LampEdit';
import { LampLearn } from './LampLearn';
import { LampConsole, LampLimits, LampQueueBar, SupportPanel, useLampSupport } from './LampConsole';
import {
  lampOrder, lampSaveProblem, lampTitle, loadLamps, NEW_LAMP, NEW_TIMER, PILOT, pilotPath, saveTimer, TIMER, timerOrder,
  type Lamp, type LampSignal, type LampTimer
} from './lampStore';
import { LampRadio, lampHere, type LampSupport, type TimerStatus } from './native';
import { PaceControl } from './PaceControl';
import { buttonPace, PACE_PREF, paceText, readPace, type Pace } from './pace';
import { SendKey } from './SendKey';
import { TimerEdit } from './TimerEdit';
import { TimerList } from './TimerList';
import { syncTimers } from './timers';
import { setPace, transmit, type Hold } from './transmit';
import './lamps.css';

interface Home {
  readonly lamps: readonly Lamp[];
  readonly timers: readonly LampTimer[];
}

const upsert = <T extends { readonly id: string }>(list: readonly T[], one: T): T[] => [...list.filter((x) => x.id !== one.id), one];

export function LampsApp({ who, trail }: { who: Who; trail: readonly string[] }) {
  const native = lampHere();
  const [ctx, setCtx] = useState<PhoneCtx | null>(null);
  const [home, setHome] = useState<Home | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [timerStatus, setTimerStatus] = useState<TimerStatus | null>(null);
  const [planProblems, setPlanProblems] = useState<readonly string[]>([]);
  const { support, refresh } = useLampSupport(native);
  /* Der jüngste Stand — damit zwei schnelle Änderungen nacheinander nicht vom selben alten ausgehen. */
  const latest = useRef<Home | null>(null);

  /* Das Tempo der Knöpfe (die Pause), gemerkt am Konto — gilt sofort für jeden Druck, nicht für die Timer. Wie lange: das Halten. */
  const [paceStored, storePace] = useRemembered(PACE_PREF, '');
  const pace = buttonPace(readPace(paceStored));
  useEffect(() => { setPace(buttonPace(readPace(paceStored))); }, [paceStored]);

  /** Auf dem Telefon: den Plan der Timer neu ablegen (und den Wecker stellen). */
  const sync = useCallback(async (now: Home, options: { enable?: boolean; firstTimer?: boolean } = {}) => {
    if (!native) return;
    try {
      const { status, problems } = await syncTimers(LampRadio, now.lamps, now.timers, options);
      setTimerStatus(status);
      setPlanProblems(problems);
    } catch {
      // Eine ältere Fassung der App kennt die Timer noch nicht — dann eben ohne.
    }
  }, [native]);

  const change = useCallback((make: (was: Home) => Home, options: { enable?: boolean; firstTimer?: boolean } = {}) => {
    const was = latest.current;
    if (was === null) return;
    const now = make(was);
    latest.current = now;
    setHome(now);
    void sync(now, options);
  }, [sync]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const opened = await openPhone(who);
        const loaded = await loadLamps(opened);
        if (!alive) return;
        latest.current = loaded;
        setCtx(opened);
        setHome(loaded);
        void sync(loaded);
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać urządzeń.');
      }
    })();
    return () => { alive = false; };
  }, [who, sync]);

  const lampSaved = useCallback((lamp: Lamp) => change((h) => ({ ...h, lamps: upsert(h.lamps, lamp).sort(lampOrder) })), [change]);
  const lampRemoved = useCallback((id: string) => change((h) => ({ ...h, lamps: h.lamps.filter((l) => l.id !== id) })), [change]);
  const timerSaved = useCallback((timer: LampTimer) =>
    change((h) => ({ ...h, timers: upsert(h.timers, timer).sort(timerOrder) }), { firstTimer: true }), [change]);
  const timerRemoved = useCallback((id: string) => change((h) => ({ ...h, timers: h.timers.filter((t) => t.id !== id) })), [change]);

  const step = trail[0];
  if (failed !== null) return <p className="wk-error">{failed}</p>;
  if (ctx === null || home === null) return <Loading label="Wczytywanie urządzeń…" />;

  if (step === PILOT) {
    return <LampLearn ctx={ctx} lamps={home.lamps} native={native} support={support} refresh={refresh} onSaved={lampSaved} />;
  }
  if (step === TIMER) {
    const id = trail[1] ?? NEW_TIMER;
    const had = id === NEW_TIMER ? null : home.timers.find((t) => t.id === id) ?? null;
    if (id !== NEW_TIMER && had === null) return <p className="wk-empty">Takiego timera nie ma.</p>;
    return (
      <TimerEdit key={id} ctx={ctx} timer={had} lamps={home.lamps} native={native}
        onSaved={(timer) => { timerSaved(timer); window.location.hash = viewPath('lamps'); }}
        onRemoved={(gone) => { timerRemoved(gone); window.location.hash = viewPath('lamps'); }} />
    );
  }
  if (step !== undefined) {
    const had = step === NEW_LAMP ? null : home.lamps.find((l) => l.id === step) ?? null;
    if (step !== NEW_LAMP && had === null) return <p className="wk-empty">Takiego urządzenia nie ma.</p>;
    return (
      <LampEdit key={step} ctx={ctx} lamp={had} native={native}
        onSaved={(lamp, then) => {
          lampSaved(lamp);
          if (then === 'list') window.location.hash = viewPath('lamps');
          if (then === 'open') window.location.hash = viewPath('lamps', lamp.id);
        }}
        onRemoved={(id) => {
          lampRemoved(id);
          window.location.hash = viewPath('lamps');
        }} />
    );
  }

  return (
    <LampList ctx={ctx} home={home} native={native} support={support} refresh={refresh}
      timerStatus={timerStatus} planProblems={planProblems}
      pace={pace} onPace={(next) => { setPace(buttonPace(next)); storePace(paceText(buttonPace(next))); }}
      onTimerSaved={timerSaved}
      onPhone={(on) => change((h) => h, { enable: on })} />
  );
}

export default LampsApp;

/* -- Die Lampen mit ihren Knöpfen -------------------------------------------------------------- */

function LampList({ ctx, home, native, support, refresh, timerStatus, planProblems, pace, onPace, onTimerSaved, onPhone }: {
  ctx: PhoneCtx;
  home: Home;
  native: boolean;
  support: LampSupport | null;
  refresh: () => void;
  timerStatus: TimerStatus | null;
  planProblems: readonly string[];
  pace: Pace;
  onPace: (next: Pace) => void;
  onTimerSaved: (timer: LampTimer) => void;
  onPhone: (on: boolean) => void;
}) {
  useCrumbs([]);
  const [busy, setBusy] = useState(false);
  const { lamps, timers } = home;

  /* Auch während gesendet wird: der Druck kommt in die Warteschlange und geht nach dem vorigen hinaus. */
  const send = (lamp: Lamp, signal: LampSignal, hold: Hold | null) => {
    void transmit(LampRadio, lamp, signal, null, hold).then((a) => {
      if (a.code === 'no-permission' || a.code === 'bluetooth-off' || a.code === 'no-advertiser') refresh();
    });
  };

  const setEnabled = async (timer: LampTimer, enabled: boolean) => {
    setBusy(true);
    try {
      onTimerSaved(await saveTimer(ctx, timer.id, { ...timer, enabled }, timer.version));
    } catch (e) {
      toast(lampSaveProblem(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Lampy" meta={`${lamps.length} ${plural(lamps.length, 'urządzenie', 'urządzenia', 'urządzeń')}`} />

      <SupportPanel native={native} support={support} refresh={refresh} quiet />
      <LampQueueBar native={native} />

      {lamps.length === 0
        ? <p className="wk-empty">Nie ma jeszcze urządzeń — dodaj lampę na dole strony i wklej jej sygnały albo odczytaj je z pilota.</p>
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
                  {lamp.room !== null && <p className="lp-card-meta">{lamp.room}</p>}
                  <div className="lp-pad">
                    {lamp.signals.map((s) => (
                      <SendKey key={s.id} className="wk-btn lp-key" disabled={!native} onSend={(hold) => send(lamp, s, hold)}>
                        {s.label}
                      </SendKey>
                    ))}
                    {lamp.signals.length === 0 && <a className="wk-btn wk-btn-quiet lp-key" href={viewPath('lamps', lamp.id)}><Icon name="plus" />Sygnał</a>}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

      <PaceControl pace={pace} onChange={onPace} title="Tempo przycisków" between="między ramkami i naciśnięciami" limit={false}
        note="Krótkie naciśnięcie wysyła cały sygnał, tak jak zapisano. Przytrzymanie nadaje tak długo, jak trzymasz (najwyżej 30 s). Dotyczy tylko przycisków (i prób nadania); każdy timer ma własne suwaki." />

      <TimerList lamps={lamps} timers={timers} native={native} status={timerStatus} busy={busy}
        onEnabled={(t, enabled) => void setEnabled(t, enabled)} onPhone={onPhone} />
      {planProblems.length > 0 && (
        <ul className="lp-problems">
          {planProblems.map((p) => <li key={p} className="wk-error">Nie trafi do timera: {p}</li>)}
        </ul>
      )}

      <LampConsole native={native} />

      <div className="wk-actions lp-bottom">
        <a className="wk-btn wk-btn-quiet" href={viewPath('lamps', NEW_LAMP)}><Icon name="plus" />Urządzenie</a>
        <a className="wk-btn wk-btn-quiet" href={pilotPath()}><Icon name="radio" />Odczyt z pilota</a>
      </div>

      <LampLimits />
    </>
  );
}
