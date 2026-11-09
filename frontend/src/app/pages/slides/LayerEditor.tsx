/**
 * Die Ebenen eines Slajds und das Deck: jede Ebene mit Art, Mischung, Deckkraft und Bühne.
 */

import { MotionField } from '../motion/MotionField';
import { ImagePicker } from '../PageFiles';
import { BLENDS, type Blend, type DeckLook, type DeckNav, LAYER_KINDS, type Layer, type LayerKind, type Theme, blankLayer, defaultLayers } from './slideLook';
import { ColorField, StageNumber } from './SlideSettings';
import { useT } from '../../core/i18n';

/* -- 0107: die Folge als Ganzes, wer neben wem, der Aufbau ------------------------------ */

const NAV_LABEL: Record<DeckNav, string> = { labels: 'pagesSlides.layer.nav.labels', dots: 'pagesSlides.layer.nav.dots', none: 'pagesSlides.layer.nav.none' };

/** Was für alle Slajdy gilt: das gemeinsame Tuch, die Leiste, der Titelslajd, die Breite der Bühne. */
export function DeckEditor({ path, theme, deck, busy, onChange }: {
  path: string;
  theme: Theme;
  deck: DeckLook;
  busy: boolean;
  onChange: (next: DeckLook) => void;
}) {
  const t = useT();
  return (
    <details className="wk-fold se-deck">
      <summary>{deck.backdrop.length > 0 || deck.nav !== 'labels' || !deck.titleSlide || deck.width !== null ? t('${K}deckSet') : t('${K}deck')}</summary>
      <label className="se-inline">
        <span>{t('pagesSlides.layer.bar')}</span>
        <select value={deck.nav} disabled={busy} onChange={(e) => onChange({ ...deck, nav: e.target.value as DeckNav })}>
          {(['labels', 'dots', 'none'] as const).map((one) => <option key={one} value={one}>{t(NAV_LABEL[one])}</option>)}
        </select>
      </label>
      <label className="wk-check">
        <input type="checkbox" checked={!deck.titleSlide} disabled={busy} onChange={(e) => onChange({ ...deck, titleSlide: !e.target.checked })} />
        <span>{t('pagesSlides.layer.noTitleSlide')}</span>
      </label>
      <label className="se-inline">
        <span>{t('pagesSlides.layer.stageWidth')}</span>
        <input type="number" min={20} max={240} value={deck.width ?? ''} placeholder={t('pagesSlides.layer.wholeWindow')} disabled={busy}
          onChange={(e) => onChange({ ...deck, width: e.target.value.trim() === '' ? null : Math.min(240, Math.max(20, Number(e.target.value))) })} />
      </label>
      <p className="wk-hint">{t('pagesSlides.layer.stageWidthHint')}</p>
      <details className="wk-fold">
        <summary>{deck.backdrop.length > 0 ? t('${K}backdropN', { n: deck.backdrop.length }) : t('${K}backdrop')}</summary>
        <p className="wk-hint">{t('pagesSlides.layer.backdropHint')}</p>
        <LayerEditor path={path} theme={theme} label="" layers={deck.backdrop} busy={busy} blank onChange={(backdrop) => onChange({ ...deck, backdrop })} />
      </details>
    </details>
  );
}

/* -- Die Schichten ---------------------------------------------------------------- */

const KIND_LABEL: Record<LayerKind, string> = {
  gradient: 'pagesSlides.layer.kind.gradient', image: 'pagesSlides.layer.kind.image', bigtext: 'pagesSlides.layer.kind.bigtext',
  /* 0107 — die Luft des Pokaz von Cogita. */
  glow: 'pagesSlides.layer.kind.glow', vignette: 'pagesSlides.layer.kind.vignette', haze: 'pagesSlides.layer.kind.haze', mesh: 'pagesSlides.layer.kind.mesh', waves: 'pagesSlides.layer.kind.waves'
};

const BLEND_LABEL: Record<Blend, string> = {
  normal: 'pagesSlides.layer.blend.normal', multiply: 'pagesSlides.layer.blend.multiply', screen: 'pagesSlides.layer.blend.screen', overlay: 'pagesSlides.layer.blend.overlay', 'soft-light': 'pagesSlides.layer.blend.softLight'
};

/**
 * Die Schichten hinter einem Slajd (Altbestand: LayerEditor) — gespeichert von hinten nach vorn, gezeigt von vorn (oben) nach hinten (unten).
 * Leer heisst: das Tuch des Themas — es passt sich an hell und dunkel an.
 */
export function LayerEditor({ path, theme, label, layers, busy, onChange, blank = false }: {
  path: string;
  theme: Theme;
  label: string;
  layers: readonly Layer[];
  busy: boolean;
  onChange: (next: readonly Layer[]) => void;
  /** 0107 — leer heisst leer (das gemeinsame Tuch): kein „Tło domyślne". */
  blank?: boolean;
}) {
  const t = useT();
  if (layers.length === 0 && !blank) {
    return (
      <div className="se-layers">
        <p className="wk-hint">{t('pagesSlides.layer.defaultHint')}</p>
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy}
          onClick={() => onChange(defaultLayers(label, theme))}>
          {t('pagesSlides.layer.customize')}
        </button>
      </div>
    );
  }

  const update = (index: number, next: Layer) => onChange(layers.map((one, i) => (i === index ? next : one)));
  const shift = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= layers.length) return;
    const next = [...layers];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };

  return (
    <div className="se-layers">
      <p className="wk-hint">{t('pagesSlides.layer.layersHint')}</p>
      {/* 2026-10-24 — gezeigt von vorn nach hinten; gespeichert bleibt von hinten nach vorn (JSON, alte Seiten). */}
      {layers.map((layer, index) => ({ layer, index })).reverse().map(({ layer, index }) => (
        <fieldset key={index} className="se-layer">
          <legend>
            {layers.length - index}. {t(KIND_LABEL[layer.kind])}
            <span className="se-tools">
              <button type="button" aria-label={t('pagesSlides.layer.upAria')} title={t('pagesSlides.layer.up')} disabled={busy || index === layers.length - 1} onClick={() => shift(index, 1)}>↑</button>
              <button type="button" aria-label={t('pagesSlides.layer.downAria')} title={t('pagesSlides.layer.down')} disabled={busy || index === 0} onClick={() => shift(index, -1)}>↓</button>
              <button type="button" aria-label={t('pagesSlides.layer.remove')} className="se-drop" disabled={busy}
                onClick={() => onChange(layers.filter((_, i) => i !== index))}>×</button>
            </span>
          </legend>

          <label className="se-inline">
            <span>{t('pagesSlides.layer.kindLabel')}</span>
            <select value={layer.kind} disabled={busy}
              onChange={(e) => update(index, { ...blankLayer(e.target.value as LayerKind, theme), speed: layer.speed } as Layer)}>
              {LAYER_KINDS.map((k) => <option key={k} value={k}>{t(KIND_LABEL[k])}</option>)}
            </select>
          </label>

          <Slider label={t(layer.kind === 'bigtext' ? 'pagesSlides.layer.travel' : 'pagesSlides.layer.speed')} value={layer.speed} busy={busy}
            hint={layer.kind === 'bigtext' ? t('pagesSlides.layer.travelHint') : undefined}
            onChange={(speed) => update(index, { ...layer, speed })} />

          {layer.kind === 'gradient' && (
            <>
              <label className="se-inline">
                <span>{t('pagesSlides.layer.angle')}</span>
                <input type="number" min={0} max={360} value={layer.angle} disabled={busy}
                  onChange={(e) => update(index, { ...layer, angle: Number(e.target.value) || 0 })} />
              </label>
              <ColorField label={t('pagesSlides.layer.from')} value={layer.from} busy={busy} onChange={(from) => update(index, { ...layer, from })} />
              <ColorField label={t('pagesSlides.layer.via')} value={layer.via ?? ''} busy={busy} allowEmpty
                onChange={(via) => update(index, { ...layer, via: via.trim() === '' ? null : via })} />
              <ColorField label={t('pagesSlides.layer.to')} value={layer.to} busy={busy} onChange={(to) => update(index, { ...layer, to })} />
            </>
          )}

          {layer.kind === 'image' && (
            <>
              <ImagePicker path={path} value={layer.url} busy={busy} onPick={(url) => update(index, { ...layer, url })} />
              <label className="se-inline">
                <span>{t('pagesSlides.layer.address')}</span>
                <input value={layer.url} disabled={busy} placeholder={t('pagesSlides.layer.addressPlaceholder')}
                  onChange={(e) => update(index, { ...layer, url: e.target.value })} />
              </label>
              <Slider label={t('pagesSlides.set.opacity')} value={layer.opacity} busy={busy} onChange={(opacity) => update(index, { ...layer, opacity })} />
              <label className="se-inline">
                <span>{t('pagesSlides.layer.blendLabel')}</span>
                <select value={layer.blend} disabled={busy} onChange={(e) => update(index, { ...layer, blend: e.target.value as Blend })}>
                  {BLENDS.map((b) => <option key={b} value={b}>{t(BLEND_LABEL[b])}</option>)}
                </select>
              </label>
              <label className="se-inline">
                <span>{t('pagesSlides.layer.position')}</span>
                <input value={layer.position} disabled={busy} placeholder={'center, top, 50% 30%'}
                  onChange={(e) => update(index, { ...layer, position: e.target.value })} />
              </label>
            </>
          )}

          {layer.kind === 'bigtext' && (
            <>
              <label className="wk-field">
                <span>{t('pagesSlides.layer.lines')}</span>
                <textarea rows={3} value={layer.lines.join('\n')} disabled={busy}
                  onChange={(e) => update(index, { ...layer, lines: e.target.value.split('\n').slice(0, 3) })} />
              </label>
              <Slider label={t('pagesSlides.set.opacity')} value={layer.opacity} busy={busy} onChange={(opacity) => update(index, { ...layer, opacity })} />
              <ColorField label={t('pagesSlides.layer.color')} value={layer.color ?? ''} busy={busy} allowEmpty
                onChange={(color) => update(index, { ...layer, color: color.trim() === '' ? null : color })} />
            </>
          )}

          {layer.kind === 'glow' && (
            <>
              <ColorField label={t('pagesSlides.layer.color')} value={layer.color} busy={busy} onChange={(color) => update(index, { ...layer, color })} />
              <StageNumber label="x %" value={layer.x} min={0} max={100} step={1} busy={busy} onChange={(x) => update(index, { ...layer, x })} />
              <StageNumber label="y %" value={layer.y} min={0} max={100} step={1} busy={busy} onChange={(y) => update(index, { ...layer, y })} />
              <StageNumber label={t('pagesSlides.layer.reach')} value={layer.size} min={5} max={200} step={1} busy={busy} onChange={(size) => update(index, { ...layer, size })} />
              <Slider label={t('pagesSlides.set.opacity')} value={layer.opacity} busy={busy} onChange={(opacity) => update(index, { ...layer, opacity })} />
            </>
          )}

          {layer.kind === 'vignette' && (
            <>
              <Slider label={t('pagesSlides.layer.strength')} value={layer.strength} busy={busy} onChange={(strength) => update(index, { ...layer, strength })} />
              <StageNumber label={t('pagesSlides.layer.fromPct')} value={layer.reach} min={0} max={99} step={1} busy={busy} onChange={(reach) => update(index, { ...layer, reach })} />
            </>
          )}

          {layer.kind === 'haze' && (
            <>
              <ColorField label={t('pagesSlides.layer.light')} value={layer.color} busy={busy} onChange={(color) => update(index, { ...layer, color })} />
              <ColorField label={t('pagesSlides.layer.shade')} value={layer.depth} busy={busy} onChange={(depth) => update(index, { ...layer, depth })} />
              <Slider label={t('pagesSlides.set.opacity')} value={layer.opacity} busy={busy} onChange={(opacity) => update(index, { ...layer, opacity })} />
              <MotionField value={layer.motion} busy={busy} kinds="loop" onChange={(motion) => update(index, { ...layer, motion })} />
            </>
          )}

          {layer.kind === 'mesh' && (
            <>
              <ColorField label={t('pagesSlides.layer.threads')} value={layer.color} busy={busy} onChange={(color) => update(index, { ...layer, color })} />
              <ColorField label={t('pagesSlides.layer.glow')} value={layer.glow} busy={busy} onChange={(glow) => update(index, { ...layer, glow })} />
              <StageNumber label={t('pagesSlides.layer.layers')} value={layer.count} min={1} max={8} step={1} busy={busy} onChange={(count) => update(index, { ...layer, count })} />
              <StageNumber label={t('pagesSlides.layer.waveHeight')} value={layer.center} min={0} max={1} step={0.01} busy={busy} onChange={(center) => update(index, { ...layer, center })} />
              <StageNumber label={t('pagesSlides.layer.seed')} value={layer.seed} min={0} max={9999} step={1} busy={busy} onChange={(seed) => update(index, { ...layer, seed })} />
              <MotionField value={layer.motion} busy={busy} kinds="loop" onChange={(motion) => update(index, { ...layer, motion })} />
            </>
          )}

          {layer.kind === 'waves' && (
            <>
              <StageNumber label={t('pagesSlides.layer.bands')} value={layer.count} min={1} max={12} step={1} busy={busy} onChange={(count) => update(index, { ...layer, count })} />
              <StageNumber label={t('pagesSlides.layer.hue')} value={layer.hue} min={0} max={360} step={1} busy={busy} onChange={(hue) => update(index, { ...layer, hue })} />
              <StageNumber label={t('pagesSlides.layer.seed')} value={layer.seed} min={0} max={9999} step={1} busy={busy} onChange={(seed) => update(index, { ...layer, seed })} />
              <MotionField value={layer.motion} busy={busy} kinds="loop" onChange={(motion) => update(index, { ...layer, motion })} />
            </>
          )}
        </fieldset>
      ))}

      <div className="wk-actions">
        {LAYER_KINDS.map((k) => (
          <button key={k} type="button" className="wk-link-btn" disabled={busy || layers.length >= 8}
            onClick={() => onChange([...layers, blankLayer(k, theme)])}>
            + {t(KIND_LABEL[k])}
          </button>
        ))}
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => onChange([])}>{blank ? t('pagesSlides.layer.noBackdrop') : t('pagesSlides.layer.default')}</button>
      </div>
    </div>
  );
}

export function Slider({ label, value, busy, hint, onChange }: {
  label: string;
  value: number;
  busy: boolean;
  hint?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="se-inline" title={hint}>
      <span>{label}</span>
      <input type="range" min={0} max={1} step={0.01} value={value} disabled={busy}
        onChange={(e) => onChange(Number(e.target.value))} />
      <output>{value.toFixed(2)}</output>
    </label>
  );
}
