/**
 * EIN GERÄT BEARBEITEN — Name, Nummer, Raum, Notizen und seine Sygnały: je
 * Sygnał der Text auf dem Knopf und eine oder mehrere Ramki (Paket in Hex,
 * wie lange, Pause danach). Unter jedem Paket steht, was Android daraus macht;
 * „Wyślij próbnie" sendet, was hier steht, auch ungespeichert.
 */

import { useState } from 'react';

import { useT } from '../core/i18n';
import type { PhoneCtx } from '../phone/phoneContext';
import { viewPath } from '../routes';
import { useCrumbs } from '../shell/crumbTrail';
import { ask, toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { MenuButton } from '../ui/Menu';
import { PageHeader } from '../ui/PageHeader';
import { normalizeHex } from './adv';
import { FrameView } from './FrameView';
import { LampConsole, useAttempts } from './LampConsole';
import {
  copyOf, DURATION_MAX, DURATION_MIN, emptyFrame, emptyLamp, emptySignal, FRAMES_MAX, GAP_MAX, lampProblems, lampSaveProblem,
  lampTitle, pilotPath, removeItem, saveLamp, SIGNALS_MAX, signalProblem, type Lamp, type LampData, type LampFrame, type LampSignal
} from './lampStore';
import { LampRadio } from './native';
import { SendKey } from './SendKey';
import { transmit } from './transmit';

export type AfterSave = 'list' | 'open' | 'stay';

const HEX_SAMPLE = '0x1EFF0000…'; // i18n-ignore
const numberOf = (text: string): number => (text.trim() === '' ? NaN : Number(text));
const shown = (n: number): string | number => (Number.isFinite(n) ? n : '');

export function LampEdit({ ctx, lamp, native, onSaved, onRemoved }: {
  ctx: PhoneCtx;
  lamp: Lamp | null;
  native: boolean;
  onSaved: (lamp: Lamp, then: AfterSave) => void;
  onRemoved: (id: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<LampData>(() => lamp ?? emptyLamp());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const sending = useAttempts().some((a) => a.state === 'sending');
  useCrumbs([{ label: lamp === null ? t('lamps.newDevice') : lampTitle(lamp), href: null }]);

  const set = (patch: Partial<LampData>) => setDraft((d) => ({ ...d, ...patch }));
  const setSignals = (make: (list: readonly LampSignal[]) => readonly LampSignal[]) => setDraft((d) => ({ ...d, signals: make(d.signals) }));
  const setSignal = (i: number, patch: Partial<LampSignal>) => setSignals((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setFrames = (i: number, make: (frames: readonly LampFrame[]) => readonly LampFrame[]) =>
    setSignals((list) => list.map((s, j) => (j === i ? { ...s, frames: make(s.frames) } : s)));
  const setFrame = (i: number, k: number, patch: Partial<LampFrame>) => setFrames(i, (frames) => frames.map((f, m) => (m === k ? { ...f, ...patch } : f)));
  const move = (i: number, by: -1 | 1) => setSignals((list) => {
    const next = [...list];
    const [one] = next.splice(i, 1);
    next.splice(i + by, 0, one);
    return next;
  });

  const problems = lampProblems(draft);

  const save = async (then: AfterSave) => {
    setTried(true);
    if (problems.length > 0) return;
    setBusy(true);
    setFailed(null);
    try {
      const done = await saveLamp(ctx, lamp?.id ?? null, draft, lamp?.version ?? 0);
      if (then === 'stay') toast(t('lamps.edit.saved'));
      onSaved(done, then);
    } catch (e) {
      setFailed(lampSaveProblem(e));
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async () => {
    if (problems.length > 0) { setTried(true); return; }
    setBusy(true);
    try {
      const copy = await saveLamp(ctx, null, copyOf(draft), 0);
      toast(t('lamps.edit.copySaved', { name: lampTitle(copy) }));
      onSaved(copy, 'open');
    } catch (e) {
      setFailed(lampSaveProblem(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (lamp === null) return;
    if (!await ask({ title: t('lamps.edit.removeAsk', { name: lampTitle(lamp) }), body: t('lamps.edit.removeBody'), confirm: t('common.delete'), danger: true })) return;
    setBusy(true);
    try {
      await removeItem(ctx, lamp.id);
      onRemoved(lamp.id);
    } catch (e) {
      setFailed(lampSaveProblem(e));
      setBusy(false);
    }
  };

  /* Beim Verlassen des Feldes: Hex in eine Form (Leerzeichen, 0x, Zeilen fallen weg), wenn es lesbar ist. */
  const tidyHex = (i: number, k: number, hex: string) => {
    const read = normalizeHex(hex);
    if (read.problem === null && read.hex !== hex) setFrame(i, k, { hex: read.hex });
  };

  return (
    <form className="lp-edit" onSubmit={(e) => { e.preventDefault(); void save('list'); }}>
      <PageHeader title={lamp === null ? t('lamps.newDevice') : lampTitle(lamp)} actions={lamp !== null && (
        <MenuButton label={t('lamps.edit.more')} items={[
          { label: t('lamps.edit.duplicate'), icon: 'copy', onSelect: () => void duplicate() },
          { label: t('lamps.edit.readPilot'), icon: 'radio', onSelect: () => { window.location.hash = pilotPath(lamp.id); } },
          { label: t('lamps.edit.remove'), icon: 'trash', onSelect: () => void remove() }
        ]} />
      )} />

      <div className="lp-pair">
        <label className="wk-field">
          <span>{t('lamps.edit.name')}</span>
          <input value={draft.name} autoComplete="off" placeholder={t('lamps.edit.namePh')} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="wk-field">
          <span>{t('lamps.deviceNumber')}</span>
          <input value={draft.number ?? ''} autoComplete="off" placeholder={t('lamps.edit.numberPh')} onChange={(e) => set({ number: e.target.value })} />
        </label>
      </div>
      <div className="lp-pair">
        <label className="wk-field">
          <span>{t('lamps.edit.room')}</span>
          <input value={draft.room ?? ''} autoComplete="off" placeholder={t('lamps.edit.roomPh')} onChange={(e) => set({ room: e.target.value })} />
        </label>
        <label className="wk-field">
          <span>{t('lamps.edit.protocolNote')}</span>
          <input value={draft.note ?? ''} autoComplete="off" placeholder={t('lamps.edit.protocolNotePh')} onChange={(e) => set({ note: e.target.value })} />
        </label>
      </div>
      <p className="wk-note">{t('lamps.edit.nameHint')}</p>

      <h2 className="wk-h2">{t('lamps.edit.signals')}</h2>
      {draft.signals.length === 0 && <p className="wk-empty">{t('lamps.edit.noSignals')}</p>}
      {draft.signals.map((s, i) => {
        const many = s.frames.length > 1;
        const problem = signalProblem(s);
        return (
          <fieldset key={s.id} className="wk-box lp-signal">
            <legend className="lp-legend">{s.label.trim() || t('lamps.signalN', { n: i + 1 })}</legend>
            <div className="lp-signal-head">
              <label className="wk-field">
                <span>{t('lamps.buttonLabel')}</span>
                <input value={s.label} autoComplete="off" placeholder={t('lamps.buttonLabelPh')} onChange={(e) => setSignal(i, { label: e.target.value })} />
              </label>
              <span className="lp-tools">
                <button type="button" className="wk-icon-btn" aria-label={t('lamps.up')} disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" /></button>
                <button type="button" className="wk-icon-btn" aria-label={t('lamps.down')} disabled={i === draft.signals.length - 1} onClick={() => move(i, 1)}><Icon name="down" /></button>
                <button type="button" className="wk-icon-btn" aria-label={t('lamps.edit.removeSignal', { name: s.label })} onClick={() => setSignals((list) => list.filter((_, j) => j !== i))}><Icon name="trash" /></button>
              </span>
            </div>

            {s.frames.map((f, k) => (
              <div key={k} className="lp-frame">
                <label className="wk-field">
                  <span>{many ? t('lamps.edit.frameHex', { n: k + 1 }) : t('lamps.edit.packetHex')}</span>
                  <textarea className="lp-hex-input" rows={2} value={f.hex} spellCheck={false} autoCapitalize="characters" autoComplete="off"
                    placeholder={HEX_SAMPLE} onChange={(e) => setFrame(i, k, { hex: e.target.value })} onBlur={() => tidyHex(i, k, f.hex)} />
                </label>
                <div className="lp-pair">
                  <label className="wk-field">
                    <span>{t('lamps.edit.duration')}</span>
                    <input type="number" inputMode="numeric" min={DURATION_MIN} max={DURATION_MAX} step={50} value={shown(f.durationMs)}
                      onChange={(e) => setFrame(i, k, { durationMs: numberOf(e.target.value) })} />
                  </label>
                  {many && k < s.frames.length - 1 && (
                    <label className="wk-field">
                      <span>{t('lamps.edit.gap')}</span>
                      <input type="number" inputMode="numeric" min={0} max={GAP_MAX} step={50} value={shown(f.gapMs)}
                        onChange={(e) => setFrame(i, k, { gapMs: numberOf(e.target.value) })} />
                    </label>
                  )}
                </div>
                <FrameView hex={f.hex} />
                {many && (
                  <button type="button" className="wk-link-btn wk-danger-link" onClick={() => setFrames(i, (frames) => frames.filter((_, m) => m !== k))}>{t('lamps.edit.removeFrame', { n: k + 1 })}</button>
                )}
              </div>
            ))}

            <label className="wk-field">
              <span>{t('lamps.edit.note')}</span>
              <input value={s.note ?? ''} autoComplete="off" onChange={(e) => setSignal(i, { note: e.target.value })} />
            </label>
            {tried && problem !== null && <p className="wk-error">{problem}</p>}
            <div className="wk-actions">
              <button type="button" className="wk-link-btn" disabled={s.frames.length >= FRAMES_MAX}
                onClick={() => setFrames(i, (frames) => [...frames, emptyFrame()])}>{t('lamps.edit.addFrame')}</button>
              {native && (
                <SendKey className="wk-btn wk-btn-small wk-btn-quiet" disabled={sending || problem !== null}
                  title={t('lamps.holdTip')}
                  onSend={(hold) => void transmit(LampRadio, draft, s, null, hold)}>
                  <Icon name="radio" />{t('lamps.trySend')}
                </SendKey>
              )}
            </div>
          </fieldset>
        );
      })}
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={draft.signals.length >= SIGNALS_MAX}
          onClick={() => setSignals((list) => [...list, emptySignal()])}><Icon name="plus" />{t('lamps.signal')}</button>
        {lamp !== null && <a className="wk-btn wk-btn-quiet" href={pilotPath(lamp.id)}><Icon name="radio" />{t('lamps.edit.fromPilot')}</a>}
      </div>

      <LampConsole native={native} />

      {tried && problems.length > 0 && (
        <ul className="lp-problems">
          {problems.map((p) => <li key={p} className="wk-error">{p}</li>)}
        </ul>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</button>
        {lamp !== null && <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={() => void save('stay')}>{t('lamps.edit.saveStay')}</button>}
        <a className="wk-btn wk-btn-quiet" href={viewPath('lamps')}>{t('common.cancel')}</a>
      </div>
    </form>
  );
}
