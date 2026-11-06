/**
 * 2026-11-06 — DER ENTWURF EINER SEITE, bearbeitet (Editor der Seite, Art „page"): Farben, Titel, Band, Text und
 * Breite, Bausteine — links die Regler, rechts die Seite im Kleinen. Gespeichert mit dem Aussehen (`look.style`).
 */

import { useState } from 'react';

import { useT } from '../core/i18n';
import { appearance, useDark, type SchemeId } from '../core/theme';
import { Range, SchemePick, Seg } from '../account/AppearancePage';
import { PageStylePreview } from './PageStyleView';
import {
  ALIGNS, CARD_LOOKS, COLOR_KEYS, FONTS, readPageStyle,
  type BandStyle, type ColorKey, type FontId, type ModuleTitleStyle, type PageColors, type PageStyle, type TitleStyle
} from './pageStyle';

/** Eine Farbe, die auch „nicht gesetzt" sein kann. */
function ColorField({ label, value, fallback, busy, onChange }: {
  label: string;
  value: string | undefined;
  fallback: string;
  busy: boolean;
  onChange: (next: string | undefined) => void;
}) {
  const t = useT();
  const empty = value === undefined;
  return (
    <span className={empty ? 'pg-color is-empty' : 'pg-color'}>
      <input type="color" value={value ?? fallback} disabled={busy} aria-label={label} onChange={(e) => onChange(e.target.value)} />
      <span className="pg-color-label">
        {label}
        <small>{empty ? t('appearance.page.notSet') : value}</small>
      </span>
      {!empty && (
        <button type="button" className="wk-btn wk-btn-quiet wk-btn-small" disabled={busy} onClick={() => onChange(undefined)}
          aria-label={t('appearance.page.clearColor', { name: label })} title={t('appearance.page.clearColor', { name: label })}>
          ×
        </button>
      )}
    </span>
  );
}

/** Wie eine Adresse aussieht — kein Text, ein Muster. */
const URL_HINT = 'https://… / page-image:…'; // i18n-ignore

const MODE_CHOICES = ['visitor', 'light', 'dark', 'auto'] as const;
type ModePick = (typeof MODE_CHOICES)[number];

const FALLBACK: Record<ColorKey, string> = {
  ground: '#f7f5f1', surface: '#ffffff', ink: '#1a1815', muted: '#5b554c', accent: '#7a5a2e', line: '#dcd7cd'
};

export function PageStyleEditor({ value, title, lead, busy, onChange }: {
  value: PageStyle | undefined;
  title: string;
  lead: string;
  busy: boolean;
  onChange: (next: PageStyle | undefined) => void;
}) {
  const t = useT();
  const style: PageStyle = value ?? {};
  const deviceDark = useDark();
  const [darkPreview, setDarkPreview] = useState<boolean | null>(null);

  /* Was der Editor ändert, geht durch dasselbe Lesen wie ein Import: leere Schlüssel fallen weg, Grenzen gelten. */
  const set = (patch: Partial<PageStyle>) => onChange(readPageStyle({ ...style, ...patch }));
  const setTitle = (patch: Partial<TitleStyle>) => set({ title: { ...style.title, ...patch } });
  const setBand = (patch: Partial<BandStyle>) => set({ band: { ...style.band, ...patch } });
  const setModuleTitle = (patch: Partial<ModuleTitleStyle>) => set({ moduleTitle: { ...style.moduleTitle, ...patch } });
  const setColors = (key: 'colors' | 'night', color: ColorKey, next: string | undefined) =>
    set({ [key]: { ...style[key], [color]: next } as PageColors });

  const modePick: ModePick = style.mode ?? 'visitor';
  const fixed = style.mode === 'light' || style.mode === 'dark';
  const dark = fixed ? style.mode === 'dark' : darkPreview ?? deviceDark;
  const mine = appearance();

  const fontSelect = (label: string, font: FontId | undefined, pick: (next: FontId | undefined) => void) => (
    <label className="wk-field">
      <span>{label}</span>
      <select className="wk-input" value={font ?? ''} disabled={busy} onChange={(e) => pick(e.target.value === '' ? undefined : e.target.value as FontId)}>
        <option value="">{t('appearance.page.fontDefault')}</option>
        {FONTS.map((one) => <option key={one} value={one}>{t(`appearance.font.${one}`)}</option>)}
      </select>
    </label>
  );

  const colorSet = (key: 'colors' | 'night') => (
    <div className="pg-colors">
      {COLOR_KEYS.map((color) => (
        <ColorField key={color} label={t(`appearance.color.${color}`)} value={style[key]?.[color]} fallback={FALLBACK[color]} busy={busy}
          onChange={(next) => setColors(key, color, next)} />
      ))}
    </div>
  );

  return (
    <details className="wk-fold pg-editor" open={value !== undefined}>
      <summary>{t('appearance.page.title')}</summary>
      <div className="pg-editor-body">
        <div>
          <p className="wk-lede">{t('appearance.page.lead')}</p>

          {/* -- Farben -- */}
          <section className="pg-editor-group" aria-labelledby="pg-colors">
            <h4 id="pg-colors">{t('appearance.page.colors')}</h4>
            <SchemePick value={style.scheme ?? null} hue={style.hue ?? mine.hue} tint={mine.tint} dark={dark} disabled={busy}
              none={t('appearance.page.schemeNone')}
              onChange={(scheme: SchemeId | null) => set({ scheme: scheme ?? undefined, hue: scheme === 'own' ? style.hue ?? mine.hue : undefined })} />
            {style.scheme === 'own' && (
              <Range label={t('appearance.scheme.hue')} className="ap-hue" value={style.hue ?? mine.hue} min={0} max={360} step={1}
                shown={`${style.hue ?? mine.hue}°`} disabled={busy} onChange={(hue) => set({ hue })} />
            )}
            <div className="wk-field">
              <span>{t('appearance.page.mode')}</span>
              <Seg value={modePick} options={MODE_CHOICES} label={t('appearance.page.mode')} disabled={busy}
                labelOf={(one) => t(`appearance.page.modeOf.${one}`)}
                onChange={(next) => set({ mode: next === 'visitor' ? undefined : next })} />
            </div>
            <h4>{fixed ? t('appearance.page.ownColors') : t('appearance.page.dayColors')}</h4>
            {colorSet('colors')}
            {!fixed && (
              <>
                <h4>{t('appearance.page.nightColors')}</h4>
                {colorSet('night')}
              </>
            )}
          </section>

          {/* -- Titel -- */}
          <section className="pg-editor-group" aria-labelledby="pg-title">
            <h4 id="pg-title">{t('appearance.page.titleGroup')}</h4>
            <Range label={t('appearance.page.titleSize')} value={style.title?.size ?? 1.75} min={1} max={7} step={0.125} disabled={busy}
              shown={style.title?.size === undefined ? t('appearance.page.byDefault') : `${style.title.size} rem`} onChange={(size) => setTitle({ size })} />
            <label className="wk-field">
              <span>{t('appearance.page.titleWeight')}</span>
              <select className="wk-input" value={style.title?.weight ?? ''} disabled={busy}
                onChange={(e) => setTitle({ weight: e.target.value === '' ? undefined : Number(e.target.value) })}>
                <option value="">{t('appearance.page.byDefault')}</option>
                {[300, 400, 500, 600, 700, 800, 900].map((w) => <option key={w} value={w}>{t(`appearance.weight.w${w}`)}</option>)}
              </select>
            </label>
            <div className="wk-field">
              <span>{t('appearance.page.titleAlign')}</span>
              <Seg value={style.title?.align ?? 'start'} options={ALIGNS} label={t('appearance.page.titleAlign')} disabled={busy}
                labelOf={(one) => t(`appearance.align.${one}`)} onChange={(align) => setTitle({ align: align === 'start' ? undefined : align })} />
            </div>
            {fontSelect(t('appearance.page.titleFont'), style.title?.font, (font) => setTitle({ font }))}
            <Range label={t('appearance.page.titleSpacing')} value={style.title?.spacing ?? -0.01} min={-0.05} max={0.4} step={0.01} disabled={busy}
              shown={style.title?.spacing === undefined ? t('appearance.page.byDefault') : `${style.title.spacing} em`} onChange={(spacing) => setTitle({ spacing })} />
            <label className="wk-check">
              <input type="checkbox" checked={style.title?.upper === true} disabled={busy} onChange={(e) => setTitle({ upper: e.target.checked ? true : undefined })} />
              <span>{t('appearance.page.titleUpper')}</span>
            </label>
            <ColorField label={t('appearance.page.titleColor')} value={style.title?.color} fallback="#1a1815" busy={busy} onChange={(color) => setTitle({ color })} />
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy || style.title === undefined} onClick={() => set({ title: undefined })}>
              {t('appearance.page.resetGroup')}
            </button>
          </section>

          {/* -- Band hinter dem Titel -- */}
          <section className="pg-editor-group" aria-labelledby="pg-band">
            <h4 id="pg-band">{t('appearance.page.band')}</h4>
            <Range label={t('appearance.page.bandHeight')} value={style.band?.height ?? 0} min={0} max={48} step={1} disabled={busy}
              shown={(style.band?.height ?? 0) === 0 ? t('appearance.page.bandNone') : `${style.band!.height} rem`} onChange={(height) => setBand({ height })} />
            <div className="pg-colors">
              <ColorField label={t('appearance.page.bandColor')} value={style.band?.color} fallback="#e8e2d6" busy={busy} onChange={(color) => setBand({ color })} />
              <ColorField label={t('appearance.page.bandTo')} value={style.band?.to} fallback="#c9b89a" busy={busy} onChange={(to) => setBand({ to })} />
              <ColorField label={t('appearance.page.bandInk')} value={style.band?.ink} fallback="#1a1815" busy={busy} onChange={(ink) => setBand({ ink })} />
            </div>
            {style.band?.to !== undefined && (
              <Range label={t('appearance.page.bandAngle')} value={style.band.angle ?? 135} min={0} max={360} step={5} disabled={busy}
                shown={`${style.band.angle ?? 135}°`} onChange={(angle) => setBand({ angle })} />
            )}
            <label className="wk-field">
              <span>{t('appearance.page.bandImage')}</span>
              <input className="wk-input" value={style.band?.image ?? ''} disabled={busy} placeholder={URL_HINT}
                onChange={(e) => setBand({ image: e.target.value.trim() === '' ? undefined : e.target.value.trim() })} />
            </label>
            {style.band?.image !== undefined && (
              <Range label={t('appearance.page.bandShade')} value={style.band.shade ?? 0} min={0} max={0.8} step={0.05} disabled={busy}
                shown={`${Math.round((style.band.shade ?? 0) * 100)} %`} onChange={(shade) => setBand({ shade })} />
            )}
            <div className="wk-field">
              <span>{t('appearance.page.bandValign')}</span>
              <Seg value={style.band?.valign ?? 'center'} options={ALIGNS} label={t('appearance.page.bandValign')} disabled={busy}
                labelOf={(one) => t(`appearance.valign.${one}`)} onChange={(valign) => setBand({ valign: valign === 'center' ? undefined : valign })} />
            </div>
            <label className="wk-check">
              <input type="checkbox" checked={style.band?.full !== false} disabled={busy} onChange={(e) => setBand({ full: e.target.checked ? undefined : false })} />
              <span>{t('appearance.page.bandFull')}</span>
            </label>
            <button type="button" className="wk-btn wk-btn-line wk-btn-small" disabled={busy || style.band === undefined} onClick={() => set({ band: undefined })}>
              {t('appearance.page.resetGroup')}
            </button>
          </section>

          {/* -- Text und Breite -- */}
          <section className="pg-editor-group" aria-labelledby="pg-text">
            <h4 id="pg-text">{t('appearance.page.textGroup')}</h4>
            {fontSelect(t('appearance.page.font'), style.font, (font) => set({ font }))}
            <Range label={t('appearance.page.textSize')} value={style.text ?? 1} min={0.85} max={1.4} step={0.05} disabled={busy}
              shown={style.text === undefined ? t('appearance.page.byDefault') : `${Math.round(style.text * 100)} %`} onChange={(text) => set({ text })} />
            <Range label={t('appearance.page.width')} value={style.width ?? 160} min={30} max={160} step={2} disabled={busy}
              shown={style.width === undefined || style.width >= 160 ? t('appearance.page.widthFull') : `${style.width} rem`}
              onChange={(width) => set({ width: width >= 160 ? undefined : width })} />
            <label className="wk-field">
              <span>{t('appearance.page.groundImage')}</span>
              <input className="wk-input" value={style.groundImage ?? ''} disabled={busy} placeholder={URL_HINT}
                onChange={(e) => set({ groundImage: e.target.value.trim() === '' ? undefined : e.target.value.trim() })} />
            </label>
          </section>

          {/* -- Bausteine -- */}
          <section className="pg-editor-group" aria-labelledby="pg-modules">
            <h4 id="pg-modules">{t('appearance.page.modules')}</h4>
            <div className="wk-field">
              <span>{t('appearance.page.cards')}</span>
              <Seg value={style.cards ?? 'card'} options={CARD_LOOKS} label={t('appearance.page.cards')} disabled={busy}
                labelOf={(one) => t(`appearance.cards.${one}`)} onChange={(cards) => set({ cards: cards === 'card' ? undefined : cards })} />
            </div>
            <Range label={t('appearance.page.corners')} value={style.corners ?? 4} min={0} max={40} step={1} disabled={busy}
              shown={style.corners === undefined ? t('appearance.page.byDefault') : `${style.corners} px`} onChange={(corners) => set({ corners })} />
            <Range label={t('appearance.page.gap')} value={style.gap ?? 1} min={0} max={4} step={0.25} disabled={busy}
              shown={style.gap === undefined ? t('appearance.page.byDefault') : `${style.gap} rem`} onChange={(gap) => set({ gap })} />
            <Range label={t('appearance.page.moduleTitleSize')} value={style.moduleTitle?.size ?? 1} min={0.7} max={3} step={0.05} disabled={busy}
              shown={style.moduleTitle?.size === undefined ? t('appearance.page.byDefault') : `${style.moduleTitle.size} rem`}
              onChange={(size) => setModuleTitle({ size })} />
            <ColorField label={t('appearance.page.moduleTitleColor')} value={style.moduleTitle?.color} fallback="#1a1815" busy={busy}
              onChange={(color) => setModuleTitle({ color })} />
          </section>

          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-line" disabled={busy || value === undefined} onClick={() => onChange(undefined)}>
              {t('appearance.page.resetAll')}
            </button>
          </div>
        </div>

        <div className="pg-editor-side">
          {!fixed && (
            <Seg value={dark ? 'dark' : 'light'} options={['light', 'dark'] as const} label={t('appearance.page.previewMode')}
              labelOf={(one) => t(`appearance.mode.${one}`)} onChange={(one) => setDarkPreview(one === 'dark')} />
          )}
          <PageStylePreview style={style} title={title} lead={lead} dark={dark} />
        </div>
      </div>
    </details>
  );
}
