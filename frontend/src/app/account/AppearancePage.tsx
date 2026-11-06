/**
 * 2026-11-06 — WYGLĄD / AUSSEHEN / APPEARANCE (`#/workspace/account/wyglad`): wie der Arbeitsplatz auf diesem Gerät
 * aussieht — hell, dunkel oder wie das Gerät, eine Farbfamilie (oder ein eigener Farbton), Kontrast, Schriftgrösse,
 * Ecken. `core/theme.ts` wendet es an; eine Seite mit eigenem Entwurf behält ihre Farben.
 */

import { useState, type CSSProperties } from 'react';

import { useT } from '../core/i18n';
import {
  appearance, CONTRASTS, CORNERS, DEFAULT_APPEARANCE, MODES, SCHEMES, schemeVars, setAppearance, TEXT_SIZES, useDark,
  type Appearance, type SchemeId
} from '../core/theme';
import { useCrumbs } from '../shell/crumbTrail';
import { PageHeader } from '../ui/PageHeader';

/** Die Adresse der Seite (Menü des Kontos, Suche). */
export const APPEARANCE = 'wyglad';

/** Knöpfe nebeneinander, einer gewählt. */
export function Seg<T extends string>({ value, options, label, labelOf, onChange, disabled = false }: {
  value: T;
  options: readonly T[];
  label: string;
  labelOf: (one: T) => string;
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="wk-seg" role="group" aria-label={label}>
      {options.map((one) => (
        <button key={one} type="button" aria-pressed={value === one} disabled={disabled}
          className={value === one ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} onClick={() => onChange(one)}>
          {labelOf(one)}
        </button>
      ))}
    </div>
  );
}

/**
 * Die Farbfamilien als Muster — jedes in seinen eigenen Farben (`data-scheme` am Muster), im Modus, der gerade gilt.
 * `none` (die Seite): ein erstes Feld „wie beim Besucher".
 */
export function SchemePick({ value, hue, tint, dark, onChange, none, disabled = false }: {
  value: SchemeId | null;
  hue: number;
  tint: number;
  dark: boolean;
  onChange: (next: SchemeId | null) => void;
  none?: string;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <div className="ap-schemes" role="radiogroup" aria-label={t('appearance.scheme.label')}>
      {none !== undefined && (
        <button type="button" role="radio" aria-checked={value === null} className="ap-swatch" disabled={disabled} onClick={() => onChange(null)}>
          <span className="ap-swatch-none">{none}</span>
          <span className="ap-swatch-name">{t('appearance.scheme.visitor')}</span>
        </button>
      )}
      {SCHEMES.map((id) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className="ap-swatch" disabled={disabled}
          data-scheme={id} data-mode={dark ? 'dark' : 'light'} style={schemeVars(id, hue, tint) as CSSProperties}
          onClick={() => onChange(id)}>
          <span className="ap-swatch-card" aria-hidden="true">
            <span className="ap-swatch-line" />
            <span className="ap-swatch-line is-muted" />
            <span className="ap-swatch-dots"><span className="ap-swatch-dot" /><span className="ap-swatch-dot is-soft" /></span>
          </span>
          <span className="ap-swatch-name">{t(`appearance.scheme.${id}`)}</span>
        </button>
      ))}
    </div>
  );
}

/** Ein Schieber mit seinem Wert daneben. */
export function Range({ label, value, min, max, step, shown, onChange, className, disabled = false }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  shown: string;
  onChange: (next: number) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className="wk-field">
      <span>{label}</span>
      <span className={`ap-range${className === undefined ? '' : ` ${className}`}`}>
        <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} aria-valuetext={shown}
          onChange={(e) => onChange(Number(e.target.value))} />
        <span className="ap-range-value">{shown}</span>
      </span>
    </label>
  );
}

export function AppearancePage() {
  const t = useT();
  useCrumbs([{ label: t('appearance.title'), href: null }]);
  const [look, setLook] = useState<Appearance>(appearance);
  const dark = useDark();

  const change = (next: Partial<Appearance>) => {
    const merged = { ...look, ...next };
    setLook(merged);
    setAppearance(merged);
  };

  return (
    <div className="wk-narrow ui-page">
      <PageHeader title={t('appearance.title')} />
      <p className="wk-lede">{t('appearance.lead')}</p>

      <section aria-labelledby="ap-mode">
        <h2 className="wk-h2" id="ap-mode">{t('appearance.mode.label')}</h2>
        <Seg value={look.mode} options={MODES} label={t('appearance.mode.label')} labelOf={(one) => t(`appearance.mode.${one}`)}
          onChange={(mode) => change({ mode })} />
      </section>

      <section aria-labelledby="ap-scheme">
        <h2 className="wk-h2" id="ap-scheme">{t('appearance.scheme.label')}</h2>
        <SchemePick value={look.scheme} hue={look.hue} tint={look.tint} dark={dark}
          onChange={(scheme) => change({ scheme: scheme ?? 'sand' })} />
        {look.scheme === 'own' && (
          <>
            <Range label={t('appearance.scheme.hue')} className="ap-hue" value={look.hue} min={0} max={360} step={1}
              shown={`${look.hue}°`} onChange={(hue) => change({ hue })} />
            <Range label={t('appearance.scheme.tint')} value={look.tint} min={0} max={2} step={0.1}
              shown={look.tint === 0 ? t('appearance.scheme.tintNone') : `×${look.tint.toFixed(1)}`} onChange={(tint) => change({ tint })} />
          </>
        )}
      </section>

      <section aria-labelledby="ap-more">
        <h2 className="wk-h2" id="ap-more">{t('appearance.details')}</h2>
        <div className="wk-field">
          <span>{t('appearance.contrast.label')}</span>
          <Seg value={look.contrast} options={CONTRASTS} label={t('appearance.contrast.label')} labelOf={(one) => t(`appearance.contrast.${one}`)}
            onChange={(contrast) => change({ contrast })} />
        </div>
        <div className="wk-field">
          <span>{t('appearance.text.label')}</span>
          <Seg value={look.text} options={TEXT_SIZES} label={t('appearance.text.label')} labelOf={(one) => t(`appearance.text.${one}`)}
            onChange={(text) => change({ text })} />
        </div>
        <div className="wk-field">
          <span>{t('appearance.corners.label')}</span>
          <Seg value={look.corners} options={CORNERS} label={t('appearance.corners.label')} labelOf={(one) => t(`appearance.corners.${one}`)}
            onChange={(corners) => change({ corners })} />
        </div>
      </section>

      <section aria-labelledby="ap-sample">
        <h2 className="wk-h2" id="ap-sample">{t('appearance.sample.title')}</h2>
        <div className="ap-sample">
          <strong>{t('appearance.sample.heading')}</strong>
          <span>{t('appearance.sample.text')}</span>
          <span className="wk-card-muted">{t('appearance.sample.muted')}</span>
          <span className="ap-sample-row">
            <button type="button" className="wk-btn">{t('appearance.sample.primary')}</button>
            <button type="button" className="wk-btn wk-btn-line">{t('appearance.sample.button')}</button>
            <a className="wk-link" href="#/workspace/account/wyglad">{t('appearance.sample.link')}</a>
          </span>
        </div>
      </section>

      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-line" disabled={JSON.stringify(look) === JSON.stringify(DEFAULT_APPEARANCE)}
          onClick={() => change(DEFAULT_APPEARANCE)}>
          {t('appearance.reset')}
        </button>
      </div>
    </div>
  );
}
