import { asArray, asNumber, asOptionalText, asRecord, asStringList, asText, parseJson } from '../parts/contracts';

/**
 * Background layers behind a slide, back to front. `speed` is the fraction of
 * the slide's scroll travel the layer moves through: 0 stands still, 1 moves
 * exactly with the content. The shell derives each layer's height from that, so
 * a layer always covers the viewport and can never leave a gap.
 */
export type GradientLayer = {
  kind: 'gradient';
  speed: number;
  angle: number;
  from: string;
  via: string | null;
  to: string;
};

export type ImageLayer = {
  kind: 'image';
  speed: number;
  url: string;
  opacity: number;
  blend: 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light';
  position: string;
};

export type BigTextLayer = {
  kind: 'bigtext';
  speed: number;
  lines: string[];
  opacity: number;
  color: string | null;
};

export type Layer = GradientLayer | ImageLayer | BigTextLayer;

/**
 * The further back a layer sits, the slower it moves — except for bigtext,
 * where speed is the sweep length across the viewport (1 = a whole viewport
 * height, bottom edge to top edge).
 */
export const DEFAULT_SPEED = { gradient: 0.12, image: 0.34, bigtext: 0.95 } as const;

const BLENDS: ImageLayer['blend'][] = ['normal', 'multiply', 'screen', 'overlay', 'soft-light'];

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function parseLayers(layersJson: string | null): Layer[] {
  const layers: Layer[] = [];

  for (const entry of asArray(parseJson(layersJson))) {
    const record = asRecord(entry);
    const kind = asText(record.kind);

    if (kind === 'gradient') {
      layers.push({
        kind: 'gradient',
        speed: clamp01(asNumber(record.speed, DEFAULT_SPEED.gradient)),
        angle: asNumber(record.angle, 168),
        from: asText(record.from, '#101a2a'),
        via: asOptionalText(record.via),
        to: asText(record.to, '#050a12')
      });
    } else if (kind === 'image') {
      // An empty address is a layer being written, not a broken one — dropping
      // it here made the layer vanish from the editor the moment its kind was
      // switched to image, before there was anywhere to type the address. The
      // shell paints nothing until there is a URL.
      const url = asText(record.url).trim();
      const blend = asText(record.blend, 'normal') as ImageLayer['blend'];
      layers.push({
        kind: 'image',
        speed: clamp01(asNumber(record.speed, DEFAULT_SPEED.image)),
        url,
        opacity: clamp01(asNumber(record.opacity, 0.45)),
        blend: BLENDS.includes(blend) ? blend : 'normal',
        position: asText(record.position, 'center')
      });
    } else if (kind === 'bigtext') {
      // Likewise: clearing the last line is editing, not deleting the layer.
      const lines = asStringList(record.lines).slice(0, 3);
      layers.push({
        kind: 'bigtext',
        speed: clamp01(asNumber(record.speed, DEFAULT_SPEED.bigtext)),
        lines,
        opacity: clamp01(asNumber(record.opacity, 0.1)),
        color: asOptionalText(record.color)
      });
    }
  }

  if (layers.length > 0) return layers;

  // A part with no authored layers still needs a ground, or its text sits on
  // whatever is behind it and stops being legible.
  return [
    { kind: 'gradient', speed: DEFAULT_SPEED.gradient, angle: 168, from: '#101a2a', via: null, to: '#050a12' }
  ];
}

export function defaultLayersJson(menuLabel: string): string {
  const word = menuLabel.trim().toUpperCase() || 'SEKCJA';
  return JSON.stringify(
    [
      { kind: 'gradient', speed: 0.12, angle: 168, from: '#12203a', via: null, to: '#060a12' },
      { kind: 'bigtext', speed: 0.95, lines: [word], opacity: 0.09 }
    ],
    null,
    2
  );
}

// ── Theme ────────────────────────────────────────────────────────────────────

export type Theme = { accent: string; ink: string; ground: string; muted: string };

export const DEFAULT_THEME: Theme = {
  accent: '#4c7dd6',
  ink: '#eef2f8',
  ground: '#080d15',
  muted: '#a3b2c9'
};

export function parseTheme(themeJson: string | null): Theme {
  const record = asRecord(parseJson(themeJson));
  return {
    accent: asText(record.accent, DEFAULT_THEME.accent),
    ink: asText(record.ink, DEFAULT_THEME.ink),
    ground: asText(record.ground, DEFAULT_THEME.ground),
    muted: asText(record.muted, DEFAULT_THEME.muted)
  };
}
