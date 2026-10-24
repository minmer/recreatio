/**
 * LABOR 2D (v2) — DIE FENSTER (seit 2026-10-24): wie gebacken wird (Länge,
 * Schritt der Aufnahme, Wiedereinstiegspunkte, Auflösung, heftige Zustände),
 * die Frage bei einem heftigen Zustand und die Beschreibung (Aufgabe und
 * Modell).
 */

import { useState, type ReactNode } from 'react';

import { Icon } from '../../../ui/icons';
import { BAKE_FPS, BAKE_KEYS } from '../clip/clip';
import type { ExtremeEvent } from '../engine/extremes';
import type { BakeOptions } from '../engine/protocol';
import type { Quality } from '../engine/scene';
import { num, t } from '../i18n';
import { About, type Level } from '../panels';

/** Wie lange gebacken werden kann (Sekunden Simulationszeit). */
export const BAKE_SECONDS: readonly number[] = [10, 30, 60, 120, 300];
const QUALITY: readonly { readonly q: Quality; readonly mm: number }[] = [{ q: 'very-high', mm: 1 }, { q: 'high', mm: 2 }, { q: 'medium', mm: 3 }];

/** Klicks in ein Fenster malen nicht in die Kiste. */
const keep = (e: { stopPropagation: () => void }): void => e.stopPropagation();

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  return (
    <div className="l2d-dialog-back" onPointerDown={keep}>
      <section className="l2d-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header className="l2d-dialog-head">
          <h2>{title}</h2>
          {onClose !== undefined && <button type="button" className="l2d-icon" onClick={onClose} aria-label={t('cancel')} title={t('cancel')}><Icon name="x" /></button>}
        </header>
        {children}
      </section>
    </div>
  );
}

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly { readonly value: T; readonly text: string; readonly sub?: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="l2d-choice">
      <legend>{label}</legend>
      <div className="l2d-seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
            {o.text}{o.sub !== undefined && <small>{o.sub}</small>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Backen: was man wählt und was es ungefähr kostet. Die Grösse schätzt die Zahl der Zellen (je Bild etwa 1,9 Byte je
 * Zelle, je Schlüsselbild etwa 44 — gemessen an der Prüfung 31); cells(q): Zellen der Kiste bei der Auflösung q.
 */
export function BakeDialog({ initial, cells, onBake, onCancel }: {
  initial: BakeOptions;
  cells: (q: Quality) => number;
  onBake: (o: BakeOptions) => void;
  onCancel: () => void;
}) {
  const [o, setO] = useState<BakeOptions>(initial);
  const frames = Math.round(o.seconds * o.fps) + 1;
  const keys = Math.floor((frames - 1) / (o.keyEvery * o.fps)) + 1;
  const n = cells(o.quality);
  const mb = (frames * n * 1.9 + keys * n * 44) / 1e6;
  return (
    <Dialog title={t('bakeDialog')} onClose={onCancel}>
      <p className="l2d-dialog-lead">{t('bakeLead')}</p>
      <Choice label={t('bakeLength')} value={o.seconds} onChange={(v) => setO({ ...o, seconds: v })}
        options={BAKE_SECONDS.map((s) => ({ value: s, text: s < 60 ? `${s} s` : `${s / 60} min` }))} />
      <Choice label={t('bakeFps')} value={o.fps} onChange={(v) => setO({ ...o, fps: v })}
        options={BAKE_FPS.map((f) => ({ value: f, text: t('bakeEvery').replace('{ms}', num(1000 / f, 0)), sub: `${f}/s` }))} />
      <Choice label={t('bakeKeys')} value={o.keyEvery} onChange={(v) => setO({ ...o, keyEvery: v })}
        options={BAKE_KEYS.map((k) => ({ value: k, text: t('bakeKeyEvery').replace('{s}', String(k)) }))} />
      <Choice label={t('quality')} value={o.quality} onChange={(v) => setO({ ...o, quality: v })}
        options={QUALITY.map((x) => ({ value: x.q, text: `${x.mm} mm` }))} />
      <Choice label={t('extremes')} value={o.extremes} onChange={(v) => setO({ ...o, extremes: v })}
        options={[{ value: 'compute', text: t('extCompute') }, { value: 'normalize', text: t('extNormalize') }]} />
      <p className="l2d-note-line">{t(o.extremes === 'compute' ? 'extComputeNote' : 'extNormalizeNote')}</p>
      <p className="l2d-estimate">{t('bakeEstimate').replace('{f}', String(frames)).replace('{k}', String(keys)).replace('{mb}', num(mb, mb < 10 ? 1 : 0))}</p>
      <footer className="l2d-dialog-foot">
        <button type="button" className="l2d-btn is-quiet" onClick={onCancel}>{t('cancel')}</button>
        <button type="button" className="l2d-btn is-primary" onClick={() => onBake(o)}><Icon name="clock" />{t('bake')}</button>
      </footer>
    </Dialog>
  );
}

/** Die Frage bei einem heftigen Zustand („ask“): die Rechnung ruht, bis man wählt. */
export function ExtremeDialog({ event, onChoose }: { event: ExtremeEvent; onChoose: (m: 'compute' | 'normalize') => void }) {
  const bubble = event.kind === 'bubble';
  const body = bubble ? t('extBodyBubble').replace('{r}', num(event.value * 1000, 1)) : t('extBodySpeed').replace('{v}', num(event.value, 1));
  return (
    <Dialog title={t(bubble ? 'extTitleBubble' : 'extTitleSpeed')}>
      <p className="l2d-dialog-lead">{body} {t('extAskWhat')}</p>
      <div className="l2d-dialog-options">
        <button type="button" className="l2d-option" onClick={() => onChoose('compute')}>
          <strong>{t('extCompute')}</strong><span>{t('extComputeNote')}</span>
        </button>
        <button type="button" className="l2d-option" onClick={() => onChoose('normalize')}>
          <strong>{t('extNormalize')}</strong><span>{t('extNormalizeNote')}</span>
        </button>
      </div>
      <p className="l2d-note-line">{t('extLater')}</p>
    </Dialog>
  );
}

/** Die Beschreibung: die Aufgabe des Szenariusz und was das Modell vereinfacht. */
export function InfoSheet({ title, text, level, onClose }: { title: string; text: readonly string[]; level: Level; onClose: () => void }) {
  return (
    <section className="l2d-sheet is-info" aria-label={title} onPointerDown={keep}>
      <header className="l2d-sheet-head">
        <h2>{title}</h2>
        <button type="button" className="l2d-icon" onClick={onClose} aria-label={t('closePanel')} title={t('closePanel')}><Icon name="x" /></button>
      </header>
      <div className="l2d-sheet-body">
        {text.length > 0 && <div className="l2d-task-text">{text.map((p, k) => <p key={k}>{p}</p>)}</div>}
        <section className="l2d-group">
          <h3>{t('about')}</h3>
          <About level={level} />
        </section>
      </div>
    </section>
  );
}
