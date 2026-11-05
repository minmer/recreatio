/**
 * LABOR 2D (v2) — DIE FENSTER (seit 2026-10-24): wie gebacken wird (wer
 * rechnet — seit 2026-10-25 auch die Grafikkarte —, Länge, Schritt der
 * Aufnahme, Wiedereinstiegspunkte, Auflösung, heftige Zustände),
 * die Frage bei einem heftigen Zustand und die Beschreibung (Aufgabe und
 * Modell).
 */

import { useState, type ReactNode } from 'react';

import { useT } from '../../../core/i18n';
import { Icon } from '../../../ui/icons';
import { BAKE_FPS, BAKE_KEYS, type ClipEngine } from '../clip/clip';
import type { ExtremeEvent } from '../engine/extremes';
import type { BakeOptions } from '../engine/protocol';
import type { Quality } from '../engine/scene';
import { num } from '../i18n';
import { About, type Level } from '../panels';

/** Wie lange gebacken werden kann (Sekunden Simulationszeit). */
export const BAKE_SECONDS: readonly number[] = [10, 30, 60, 120, 300];
const QUALITY: readonly { readonly q: Quality; readonly mm: number }[] = [{ q: 'very-high', mm: 1 }, { q: 'high', mm: 2 }, { q: 'medium', mm: 3 }];
/**
 * Was ein Nachweis kostet, gemessen (MILESTONES.md, B und „GPU baking“): Bytes je Zelle und Bild (CPU 1,55 bei 2 mm;
 * GPU 0,8–1,2), je Zelle und Schlüsselbild (CPU 110–130 bei 2 mm; GPU 76–90 bei 2 mm, 70 bei 1 mm), und wie schnell
 * gebacken wird (Simulations- je echte Sekunde, Wrzenie auf dem Bezugsrechner; die eingebaute Grafikkarte: 1,25× bei
 * 2 mm, 0,37× bei 1 mm; CPU 0,13–0,21× und 0,039×; 3 mm geschätzt).
 */
const FRAME_BYTES: Readonly<Record<ClipEngine, number>> = { cpu: 1.9, gpu: 1.2 };
const KEY_BYTES = (engine: ClipEngine, q: Quality): number => (engine === 'gpu' ? (q === 'very-high' ? 72 : 90) : q === 'very-high' ? 100 : 130);
const RATE: Readonly<Record<ClipEngine, Readonly<Record<Quality, number>>>> = {
  cpu: { 'very-high': 0.039, high: 0.15, medium: 0.35 },
  gpu: { 'very-high': 0.37, high: 1.25, medium: 1.5 }
};
/** Der Speicher der Nachweise fasst 600 MB (store.ts); ab hier warnt das Fenster. */
const STORE_MB = 600;
const NEAR_MB = 450;

/** Klicks in ein Fenster malen nicht in die Kiste. */
const keep = (e: { stopPropagation: () => void }): void => e.stopPropagation();

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  const t = useT();
  return (
    <div className="l2d-dialog-back" onPointerDown={keep}>
      <section className="l2d-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header className="l2d-dialog-head">
          <h2>{title}</h2>
          {onClose !== undefined && <button type="button" className="l2d-icon" onClick={onClose} aria-label={t('lab2d.cancel')} title={t('lab2d.cancel')}><Icon name="x" /></button>}
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
 * Backen: was man wählt und was es ungefähr kostet (Grösse und Dauer aus der Zahl der Zellen, oben). cells(q): Zellen
 * der Kiste bei der Auflösung q; gpu: die Grafikkarte kann backen ('yes', dann die Wahl „Licz na“), die Szene braucht
 * die CPU ('cpu-only': ein Hinweis) oder es gibt kein WebGPU ('none').
 */
export function BakeDialog({ initial, cells, gpu, onBake, onCancel }: {
  initial: BakeOptions;
  cells: (q: Quality) => number;
  gpu: 'yes' | 'cpu-only' | 'none';
  onBake: (o: BakeOptions) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [o, setO] = useState<BakeOptions>(initial);
  const frames = Math.round(o.seconds * o.fps) + 1;
  const keys = Math.floor((frames - 1) / (o.keyEvery * o.fps)) + 1;
  const n = cells(o.quality);
  const engine: ClipEngine = gpu === 'yes' && o.engine === 'gpu' ? 'gpu' : 'cpu';
  const mb = (frames * n * FRAME_BYTES[engine] + keys * n * KEY_BYTES(engine, o.quality)) / 1e6;
  const wall = o.seconds / RATE[engine][o.quality];
  const time = wall < 90 ? `${num(Math.max(5, Math.round(wall / 5) * 5), 0)} s` : `${num(wall / 60, wall < 600 ? 1 : 0)} min`;
  return (
    <Dialog title={t('lab2d.bakeDialog')} onClose={onCancel}>
      <p className="l2d-dialog-lead">{t('lab2d.bakeLead')}</p>
      {gpu === 'yes' && (
        <>
          <Choice label={t('lab2d.bakeEngine')} value={o.engine ?? 'cpu'} onChange={(v) => setO({ ...o, engine: v })}
            options={[{ value: 'cpu', text: t('lab2d.bakeCpu') }, { value: 'gpu', text: t('lab2d.bakeGpu') }]} />
          <p className="l2d-note-line">{t(`lab2d.${engine === 'gpu' ? 'bakeGpuNote' : 'bakeCpuNote'}`)}</p>
        </>
      )}
      {gpu === 'cpu-only' && <p className="l2d-note-line">{t('lab2d.bakeCpuOnly')}</p>}
      <Choice label={t('lab2d.bakeLength')} value={o.seconds} onChange={(v) => setO({ ...o, seconds: v })}
        options={BAKE_SECONDS.map((s) => ({ value: s, text: s < 60 ? `${s} s` : `${s / 60} min` }))} />
      <Choice label={t('lab2d.bakeFps')} value={o.fps} onChange={(v) => setO({ ...o, fps: v })}
        options={BAKE_FPS.map((f) => ({ value: f, text: t('lab2d.bakeEvery', { ms: num(1000 / f, 0) }), sub: `${f}/s` }))} />
      <Choice label={t('lab2d.bakeKeys')} value={o.keyEvery} onChange={(v) => setO({ ...o, keyEvery: v })}
        options={BAKE_KEYS.map((k) => ({ value: k, text: t('lab2d.bakeKeyEvery', { s: String(k) }) }))} />
      <Choice label={t('lab2d.quality')} value={o.quality} onChange={(v) => setO({ ...o, quality: v })}
        options={QUALITY.map((x) => ({ value: x.q, text: t('lab2d.cellMm', { mm: x.mm }) }))} />
      <Choice label={t('lab2d.extremes')} value={o.extremes} onChange={(v) => setO({ ...o, extremes: v })}
        options={[{ value: 'compute', text: t('lab2d.extCompute') }, { value: 'normalize', text: t('lab2d.extNormalize') }]} />
      <p className="l2d-note-line">{t(`lab2d.${o.extremes === 'compute' ? 'extComputeNote' : 'extNormalizeNote'}`)}</p>
      <p className="l2d-estimate">{t('lab2d.bakeEstimate', { f: String(frames), k: String(keys), mb: num(mb, mb < 10 ? 1 : 0) })} · {t('lab2d.bakeTime', { t: time })}</p>
      {mb >= NEAR_MB && <p className="l2d-warn-line" role="alert">{t(`lab2d.${mb > STORE_MB ? 'bakeOverCap' : 'bakeNearCap'}`)}</p>}
      <footer className="l2d-dialog-foot">
        <button type="button" className="l2d-btn is-quiet" onClick={onCancel}>{t('lab2d.cancel')}</button>
        <button type="button" className="l2d-btn is-primary" onClick={() => onBake(o)}><Icon name="clock" />{t('lab2d.bake')}</button>
      </footer>
    </Dialog>
  );
}

/** Die Frage bei einem heftigen Zustand („ask“): die Rechnung ruht, bis man wählt. */
export function ExtremeDialog({ event, onChoose }: { event: ExtremeEvent; onChoose: (m: 'compute' | 'normalize') => void }) {
  const t = useT();
  const bubble = event.kind === 'bubble';
  const body = bubble ? t('lab2d.extBodyBubble', { r: num(event.value * 1000, 1) }) : t('lab2d.extBodySpeed', { v: num(event.value, 1) });
  return (
    <Dialog title={t(`lab2d.${bubble ? 'extTitleBubble' : 'extTitleSpeed'}`)}>
      <p className="l2d-dialog-lead">{body} {t('lab2d.extAskWhat')}</p>
      <div className="l2d-dialog-options">
        <button type="button" className="l2d-option" onClick={() => onChoose('compute')}>
          <strong>{t('lab2d.extCompute')}</strong><span>{t('lab2d.extComputeNote')}</span>
        </button>
        <button type="button" className="l2d-option" onClick={() => onChoose('normalize')}>
          <strong>{t('lab2d.extNormalize')}</strong><span>{t('lab2d.extNormalizeNote')}</span>
        </button>
      </div>
      <p className="l2d-note-line">{t('lab2d.extLater')}</p>
    </Dialog>
  );
}

/** Die Beschreibung: die Aufgabe des Szenariusz und was das Modell vereinfacht. */
export function InfoSheet({ title, text, level, onClose }: { title: string; text: readonly string[]; level: Level; onClose: () => void }) {
  const t = useT();
  return (
    <section className="l2d-sheet is-info" aria-label={title} onPointerDown={keep}>
      <header className="l2d-sheet-head">
        <h2>{title}</h2>
        <button type="button" className="l2d-icon" onClick={onClose} aria-label={t('lab2d.closePanel')} title={t('lab2d.closePanel')}><Icon name="x" /></button>
      </header>
      <div className="l2d-sheet-body">
        {text.length > 0 && <div className="l2d-task-text">{text.map((p, k) => <p key={k}>{p}</p>)}</div>}
        <section className="l2d-group">
          <h3>{t('lab2d.about')}</h3>
          <About level={level} />
        </section>
      </div>
    </section>
  );
}
