/**
 * ODCZYT Z PILOTA (2026-10-18) — das Telefon hört zu, man drückt auf dem Pilot,
 * und hier steht sofort, was er sendet: der stärkste Absender (der Pilot liegt
 * am Telefon), sein letztes Paket aufgeschlüsselt, die Läufe gleicher Pakete und
 * das Muster darin (`learn.ts`). Die gewählten Läufe werden ein Sygnał eines
 * Geräts — eines vorhandenen oder eines neuen.
 *
 * Ohne den Sender (im Browser) bleibt der Weg über einen Mitschnitt aus nRF Connect.
 */

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { PluginListenerHandle } from '@capacitor/core';

import { useT, type T } from '../core/i18n';
import { newId } from '../core/ids';
import type { PhoneCtx } from '../phone/phoneContext';
import { viewPath } from '../routes';
import { useCrumbs } from '../shell/crumbTrail';
import { toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { PageHeader } from '../ui/PageHeader';
import { spaced } from './adv';
import { FrameView } from './FrameView';
import { LampConsole, SupportPanel, useAttempts } from './LampConsole';
import { Capture, framesFrom, intervalOf, packetOf, parseNrfLog, patternOf, runsOf, scanText, type Packet, type Pattern, type Run } from './learn';
import { emptyLamp, lampSaveProblem, lampTitle, saveLamp, signalProblem, type Lamp, type LampSignal } from './lampStore';
import { LampRadio, type LampSupport, type NativePacket, type ScanCode } from './native';
import { SendKey } from './SendKey';
import { transmit } from './transmit';

/** So lange hört das Telefon höchstens am Stück (Akku; Android drosselt zu häufiges Neustarten). */
const LISTEN_MS = 60_000;
const NEW_TARGET = '+';
const SHOWN_RUNS = 60;

/* Texte: lamps.learn.rssi.<Schlüssel>. */
const RSSI_CHOICES: readonly { readonly value: number; readonly label: string }[] = [
  { value: -127, label: 'all' },
  { value: -80, label: 'm80' },
  { value: -60, label: 'm60' }
];

const span = (ms: number, t: T): string => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toLocaleString(t.locale, { maximumFractionDigits: 1 })} s`);

const scanSaid = (code: ScanCode, detail: string | null): string => `${scanText(code)}${detail !== null ? ` (${detail})` : ''}`;

function patternText(pattern: Pattern, runs: readonly Run[], t: T): string | null {
  const distinct = new Set(runs.map((r) => r.hex)).size;
  if (pattern.kind === 'none') return null;
  if (pattern.kind === 'single') {
    const r = pattern.runs[0];
    const every = intervalOf(r);
    return every !== null
      ? t('lamps.learn.singleEvery', { count: r.count, span: span(r.lastAt - r.firstAt, t), every })
      : t('lamps.learn.single', { count: r.count, span: span(r.lastAt - r.firstAt, t) });
  }
  if (pattern.kind === 'cycle') {
    return t('lamps.learn.cycle', { count: pattern.runs.length, repeats: pattern.repeats });
  }
  return t('lamps.learn.noCycle', { count: distinct, repeats: pattern.repeats });
}

export function LampLearn({ ctx, lamps, native, support, refresh, onSaved }: {
  ctx: PhoneCtx;
  lamps: readonly Lamp[];
  native: boolean;
  support: LampSupport | null;
  refresh: () => void;
  onSaved: (lamp: Lamp) => void;
}) {
  const t = useT();
  useCrumbs([{ label: t('lamps.learn.title'), href: null }]);
  const capture = useRef(new Capture()).current;
  const [tick, setTick] = useState(0);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [minRssi, setMinRssi] = useState(-80);
  /** `null`: immer der Stärkste. */
  const [chosen, setChosen] = useState<string | null>(null);
  /** `null`: das Muster vorgewählt. */
  const [picked, setPicked] = useState<ReadonlySet<number> | null>(null);
  const [target, setTarget] = useState<string>(() => {
    const wanted = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('lampa');
    return wanted !== null && lamps.some((l) => l.id === wanted) ? wanted : lamps[0]?.id ?? NEW_TARGET;
  });
  const sending = useAttempts().some((a) => a.state === 'sending');

  /* Was das Telefon hört, kommt gebündelt (alle 250 ms) — dann einmal neu zeichnen. */
  useEffect(() => {
    if (!native) return;
    const handles: Promise<PluginListenerHandle>[] = [
      LampRadio.addListener('lampScan', (e: { packets: NativePacket[] }) => {
        capture.add(e.packets.map(packetOf).filter((p): p is Packet => p !== null));
        setTick((n) => n + 1);
      }),
      LampRadio.addListener('lampScanEnd', (e: { code: ScanCode; detail: string | null }) => {
        setListening(false);
        setStatus(scanSaid(e.code, e.detail));
        setTick((n) => n + 1);
      })
    ];
    return () => {
      void LampRadio.stopScan().catch(() => undefined);
      for (const h of handles) void h.then((one) => one.remove()).catch(() => undefined);
    };
  }, [native, capture]);

  const fresh = () => {
    capture.clear();
    setChosen(null);
    setPicked(null);
    setTick((n) => n + 1);
  };

  const listen = async () => {
    setStatus(null);
    try {
      const s = await LampRadio.support();
      if (!s.bluetooth) { setStatus(scanText('no-bluetooth')); return; }
      if (!s.enabled) { setStatus(scanText('bluetooth-off')); refresh(); return; }
      if (s.scanPermission !== 'granted') {
        const { granted } = await LampRadio.requestScanPermission();
        refresh();
        if (!granted) { setStatus(scanText('no-permission')); return; }
      }
      fresh();
      const started = await LampRadio.startScan({ minRssi, maxMs: LISTEN_MS });
      if (started.code !== 'ok') { setStatus(scanSaid(started.code, started.detail)); return; }
      setListening(true);
      setStatus(t('lamps.learn.listening'));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : scanText('error'));
    }
  };

  const sources = useMemo(() => capture.sources(), [capture, tick]);
  const source = (chosen === null ? null : sources.find((s) => s.address === chosen)) ?? sources[0] ?? null;
  const runs = useMemo(() => (source === null ? [] : runsOf(capture.packetsOf(source.address))), [capture, source, tick]);
  const pattern = useMemo(() => patternOf(runs), [runs]);
  const selected = picked ?? new Set(pattern.at);
  const chosenRuns = runs.filter((_, i) => selected.has(i));

  const toggle = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i); else next.add(i);
    setPicked(next);
  };

  return (
    <>
      <PageHeader title={t('lamps.learn.title')} meta={t('lamps.learn.meta')} actions={(
        <a className="wk-btn wk-btn-quiet" href={viewPath('lamps')}>{t('common.done')}</a>
      )} />

      <SupportPanel native={native} support={support} refresh={refresh} scan />

      {native && (
        <section className="wk-box lp-listen" aria-label={t('lamps.learn.listen')}>
          <div className="wk-box-body">
            <div className="lp-listen-row">
              {listening
                ? <button type="button" className="wk-btn wk-btn-danger" onClick={() => void LampRadio.stopScan()}><Icon name="pause" />{t('lamps.learn.stop')}</button>
                : <button type="button" className="wk-btn" onClick={() => void listen()}><Icon name="radio" />{t('lamps.learn.start')}</button>}
              <label className="lp-inline">
                <span>{t('lamps.learn.range')}</span>
                <select value={minRssi} disabled={listening} onChange={(e) => setMinRssi(Number(e.target.value))}>
                  {RSSI_CHOICES.map((c) => <option key={c.value} value={c.value}>{t(`lamps.learn.rssi.${c.label}`)}</option>)}
                </select>
              </label>
              <span className="lp-count">{t('lamps.learn.packets', { count: capture.size })} · {t('lamps.learn.senders', { count: sources.length })}</span>
            </div>
            {status !== null && <p className={listening ? 'lp-said' : 'wk-working'} aria-live="polite">{status}</p>}
          </div>
        </section>
      )}

      <LogImport onPackets={(packets, skipped) => {
        fresh();
        capture.add(packets);
        setTick((n) => n + 1);
        setStatus(skipped > 0
          ? t('lamps.learn.loadedSkipped', { loaded: t('lamps.learn.packets', { count: packets.length }), skipped: t('lamps.learn.lines', { count: skipped }) })
          : t('lamps.learn.loaded', { loaded: t('lamps.learn.packets', { count: packets.length }) }));
      }} />

      {source !== null && (
        <>
          <section className="wk-box lp-live" aria-label={t('lamps.learn.strongest')}>
            <div className="wk-box-head">
              <h2 className="wk-box-title">{chosen === null ? t('lamps.learn.strongest') : t('lamps.learn.chosen')}</h2>
              <span className="wk-tag">{source.strength} dBm</span>
            </div>
            <div className="wk-box-body">
              <p className="lp-card-meta">
                <span className="lp-hex">{source.address}</span>{source.name !== null && <> · {source.name}</>}
                {' · '}{t('lamps.learn.packets', { count: source.count })} · {t('lamps.learn.kinds', { count: source.distinct })} · {t('lamps.learn.now', { rssi: source.lastRssi })}
              </p>
              <p className="lp-hex lp-big">{spaced(source.lastHex)}</p>
              <FrameView hex={source.lastHex} />
            </div>
          </section>

          {sources.length > 1 && (
            <details className="lp-sources">
              <summary>{t('lamps.learn.others', { count: sources.length - 1 })}</summary>
              <ul className="lp-source-list">
                <li>
                  <label className="lp-inline">
                    <input type="radio" name="lp-source" checked={chosen === null} onChange={() => { setChosen(null); setPicked(null); }} />
                    <span>{t('lamps.learn.alwaysStrongest')}</span>
                  </label>
                </li>
                {sources.slice(0, 12).map((s) => (
                  <li key={s.address}>
                    <label className="lp-inline">
                      <input type="radio" name="lp-source" checked={chosen === s.address} onChange={() => { setChosen(s.address); setPicked(null); }} />
                      <span>
                        <span className="lp-hex">{s.address}</span>{s.name !== null && <> {s.name}</>} · {s.strength} dBm · {s.count}×
                        <span className="lp-facts lp-hex">{spaced(s.lastHex).slice(0, 47)}{s.lastHex.length > 32 ? '…' : ''}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <section className="wk-box lp-runs" aria-label={t('lamps.learn.pattern')}>
            <div className="wk-box-head"><h2 className="wk-box-title">{t('lamps.learn.patternTitle')}</h2></div>
            <div className="wk-box-body">
              {patternText(pattern, runs, t) !== null && <p className="lp-said">{patternText(pattern, runs, t)}</p>}
              <p className="wk-working">{t('lamps.learn.picked')}</p>
              <ol className="lp-run-list">
                {runs.slice(0, SHOWN_RUNS).map((r, i) => (
                  <li key={`${i}-${r.firstAt}`}>
                    <label className="lp-run">
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
                      <span className="lp-run-text">
                        <span className="lp-facts">
                          +{span(Math.max(0, r.firstAt - runs[0].firstAt), t)} · {r.count}× · {span(r.lastAt - r.firstAt, t)} · {r.peakRssi} dBm
                        </span>
                        <span className="lp-hex">{spaced(r.hex)}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ol>
              {runs.length > SHOWN_RUNS && <p className="wk-working">{t('lamps.learn.moreRuns', { count: runs.length - SHOWN_RUNS })}</p>}
            </div>
          </section>

          <SaveLearned ctx={ctx} lamps={lamps} native={native} sending={sending} runs={chosenRuns} source={source.address}
            target={target} setTarget={setTarget}
            onSaved={(lamp) => { onSaved(lamp); fresh(); setStatus(t('lamps.learn.savedNext')); }} />
        </>
      )}

      {source === null && !listening && (
        <p className="wk-empty">{native ? t('lamps.learn.emptyNative') : t('lamps.learn.emptyWeb')}</p>
      )}

      <LampConsole native={native} />
    </>
  );
}

export default LampLearn;

/* -- Ein Mitschnitt aus nRF Connect ------------------------------------------------------------ */

function LogImport({ onPackets }: { onPackets: (packets: Packet[], skipped: number) => void }) {
  const t = useT();
  const [text, setText] = useState('');
  const file = useRef<HTMLInputElement | null>(null);

  const read = (value: string) => {
    const { packets, skipped } = parseNrfLog(value);
    if (packets.length === 0) { toast(t('lamps.learn.logNothing')); return; }
    onPackets(packets, skipped);
  };

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const one = e.target.files?.[0];
    e.target.value = '';
    if (one !== undefined) void one.text().then((value) => { setText(value); read(value); });
  };

  return (
    <details className="lp-log">
      <summary>{t('lamps.learn.logTitle')}</summary>
      <label className="wk-field">
        <span>{t('lamps.learn.logLines')}</span>
        <textarea className="lp-hex-input" rows={5} value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} />
      </label>
      <input ref={file} type="file" accept=".txt,.log,text/plain" hidden onChange={pick} />
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={text.trim() === ''} onClick={() => read(text)}>{t('lamps.learn.findPattern')}</button>
        <button type="button" className="wk-btn wk-btn-quiet" onClick={() => file.current?.click()}><Icon name="upload" />{t('lamps.learn.txtFile')}</button>
      </div>
    </details>
  );
}

/* -- Als Sygnał speichern ------------------------------------------------------------------------ */

function SaveLearned({ ctx, lamps, native, sending, runs, source, target, setTarget, onSaved }: {
  ctx: PhoneCtx;
  lamps: readonly Lamp[];
  native: boolean;
  sending: boolean;
  runs: readonly Run[];
  source: string;
  /** Das Gerät — es bleibt für den nächsten Knopf gewählt. */
  target: string;
  setTarget: (id: string) => void;
  onSaved: (lamp: Lamp) => void;
}) {
  const t = useT();
  const [label, setLabel] = useState('');
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const draft: LampSignal = useMemo(() => ({
    id: 'learned',
    label,
    note: t('lamps.learn.note', { source, when: new Date().toLocaleString(t.locale) }),
    frames: framesFrom(runs)
  }), [label, source, runs, t]);
  const problem = runs.length === 0 ? t('lamps.learn.pickOne') : signalProblem(draft);
  const lamp = lamps.find((l) => l.id === target) ?? null;

  const save = async () => {
    if (problem !== null) { setFailed(problem); return; }
    if (lamp === null && name.trim() === '' && number.trim() === '') { setFailed(t('lamps.learn.needName')); return; }
    setBusy(true);
    setFailed(null);
    try {
      const signal = { ...draft, id: newId(), label: label.trim() };
      const saved = lamp === null
        ? await saveLamp(ctx, null, { ...emptyLamp(), name, number: number.trim() === '' ? null : number, signals: [signal] }, 0)
        : await saveLamp(ctx, lamp.id, { ...lamp, signals: [...lamp.signals, signal] }, lamp.version);
      toast(t('lamps.learn.savedIn', { signal: signal.label, lamp: lampTitle(saved) }));
      setTarget(saved.id);
      setLabel('');
      onSaved(saved);
    } catch (e) {
      setFailed(lampSaveProblem(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="wk-box lp-save" aria-label={t('lamps.learn.saveAs')}>
      <div className="wk-box-head"><h2 className="wk-box-title">{t('lamps.learn.saveAs')}</h2></div>
      <div className="wk-box-body">
        <div className="lp-pair">
          <label className="wk-field">
            <span>{t('lamps.device')}</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {lamps.map((l) => <option key={l.id} value={l.id}>{lampTitle(l)}</option>)}
              <option value={NEW_TARGET}>{t('lamps.learn.newDeviceOption')}</option>
            </select>
          </label>
          <label className="wk-field">
            <span>{t('lamps.buttonLabel')}</span>
            <input value={label} autoComplete="off" placeholder={t('lamps.buttonLabelPh')} onChange={(e) => setLabel(e.target.value)} />
          </label>
        </div>
        {lamp === null && (
          <div className="lp-pair">
            <label className="wk-field"><span>{t('lamps.learn.newName')}</span><input value={name} autoComplete="off" placeholder={t('lamps.learn.newNamePh')} onChange={(e) => setName(e.target.value)} /></label>
            <label className="wk-field"><span>{t('lamps.deviceNumber')}</span><input value={number} autoComplete="off" placeholder={t('lamps.learn.newNumberPh')} onChange={(e) => setNumber(e.target.value)} /></label>
          </div>
        )}
        <p className="wk-working">
          {draft.frames.length === 1
            ? t('lamps.learn.oneFrame', { ms: draft.frames[0].durationMs })
            : t('lamps.learn.frames', { count: draft.frames.length, list: draft.frames.map((f) => `${f.durationMs} ms`).join(', ') })}
        </p>
        {failed !== null && <p className="wk-error">{failed}</p>}
        {failed === null && problem !== null && label.trim() !== '' && <p className="wk-error">{problem}</p>}
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy} onClick={() => void save()}>{busy ? t('common.saving') : t('lamps.learn.saveSignal')}</button>
          {native && (
            <SendKey className="wk-btn wk-btn-quiet" disabled={sending || runs.length === 0 || signalProblem({ ...draft, label: draft.label.trim() || t('lamps.learn.trial') }) !== null}
              title={t('lamps.holdTip')}
              onSend={(hold) => void transmit(LampRadio, { name: t('lamps.learn.trialLamp'), number: null }, { ...draft, label: label.trim() || t('lamps.learn.trial') }, null, hold)}>
              <Icon name="send" />{t('lamps.trySend')}
            </SendKey>
          )}
        </div>
      </div>
    </section>
  );
}
