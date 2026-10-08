/**
 * KSZTAŁT (0085) — eine Fläche: ein Kreis, ein Rechteck, eine Linie.
 *
 * <b>Gebraucht hat ihn die Präsentation</b>: der Kreis der Startseite, der in
 * der Mitte der vier Viertel aufgeht und zum Grund des letzten Bildes wächst
 * — dieselbe Fläche von Anfang bis Ende, keine zweite. Auf einer Bühne ist er
 * ein Gegenstand, der wandert und wächst; auf einer Seite ein Schmuck.
 *
 * <b>Die Farbe</b> ist eine Farbe (`#14180f`), ein Paar für hell und dunkel
 * (`#14180f|#0c0f0a`) oder einer der Namen des Themas (`accent`, `ink`,
 * `ground`, `muted`) — dann geht sie mit den Farben der Szene.
 */

import { useContext } from 'react';

import { definePart, text, type EditorProps, type RawConfig } from '../part';
import { resolveColor } from '../presentation';
import { ShowDark } from '../showContext';
import { usePrefersDark } from '../SlideDeck';

const SHAPES = ['circle', 'rect', 'rounded', 'line'] as const;
type ShapeKind = (typeof SHAPES)[number];

const SHAPE_LABEL: Record<ShapeKind, string> = {
  circle: 'Koło', rect: 'Prostokąt', rounded: 'Prostokąt zaokrąglony', line: 'Linia'
};

interface Config {
  readonly shape: ShapeKind;
  readonly fill: string;
  readonly border: string;
}

const read = (raw: RawConfig): Config => {
  const shape = text(raw, 'shape') as ShapeKind;
  return {
    shape: SHAPES.includes(shape) ? shape : 'circle',
    fill: text(raw, 'fill').slice(0, 80),
    border: text(raw, 'border').slice(0, 80)
  };
};

function ShapeView({ config }: { config: Config }) {
  const onStage = useContext(ShowDark);
  const device = usePrefersDark();
  const dark = onStage ?? device;
  const fill = resolveColor(config.fill === '' ? 'accent' : config.fill, dark) ?? 'currentColor';
  const border = config.border === '' ? null : resolveColor(config.border, dark);
  return (
    <div className={`wk-shape is-${config.shape}`} aria-hidden="true"
      style={{ background: fill, ...(border === null ? {} : { border: `2px solid ${border}` }) }} />
  );
}

function ShapeEditor({ raw, onSet, busy }: EditorProps) {
  const config = read(raw);
  return (
    <label className="se-inline">
      <span>Kształt</span>
      <select value={config.shape} disabled={busy} onChange={(e) => onSet({ shape: e.target.value })}>
        {SHAPES.map((one) => <option key={one} value={one}>{SHAPE_LABEL[one]}</option>)}
      </select>
    </label>
  );
}

export const shapePart = definePart<Config>({
  kind: 'shape',
  example: { shape: 'circle', fill: '#14180f|#0c0f0a', border: 'accent' },
  label: 'Kształt',
  use: 'Koło, prostokąt albo linia w kolorze — tło, akcent, element prezentacji.',
  box: { colSpan: 2, rowSpan: 2 },

  fields: [
    { key: 'fill', label: 'Kolor', kind: 'line', hint: '#14180f, para „jasny|ciemny” albo accent, ink, ground, muted' },
    { key: 'border', label: 'Obramowanie', kind: 'line', hint: 'kolor albo pusty' }
  ],
  extra: [
    { key: 'shape', shape: 'line', says: '"circle" — koło, "rect" — prostokąt, "rounded" — zaokrąglony, "line" — linia' }
  ],

  read,
  /* Ein Kształt ist immer etwas — auch ohne eigene Farbe (dann die des Akzents). */
  hasContent: () => true,
  shows: (c) => `${SHAPE_LABEL[c.shape]} w kolorze.`,
  Editor: ShapeEditor,
  View: ({ config }) => <ShapeView config={config} />
});
