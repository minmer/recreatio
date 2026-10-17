/**
 * OBRAZ Z WARSTW (0107) — ein Bild aus übereinanderliegenden Ebenen, jede mit
 * eigener Bewegung: das Zeichen von Cogita (20 Ebenen — zwölf Blasen, die
 * schweben, sechs Buchstaben, die sich nacheinander setzen, und „REcreatio").
 *
 * <b>Die erste Ebene gibt die Grösse</b>; alle anderen liegen genau darauf
 * (gleich grosse Bilder mit durchsichtigem Grund, wie die PNG des Altbestands).
 * `z` ordnet sie, `shadow` gibt einer Ebene ihren Schatten (CSS
 * `drop-shadow`), `motion` ihre Bewegung — aus dem Wörterbuch (`motion.ts`):
 * `assemble` mit wachsender Verzögerung setzt die Buchstaben, `float` mit je
 * eigenem Ausschlag lässt die Blasen schweben.
 *
 * <b>Auf der Bühne der Slajdy</b> (0084) wandert das Zeichen von Slajd zu
 * Slajd; seine Ebenen bewegen sich dabei weiter, und die Buchstaben setzen
 * sich einmal — beim ersten Erscheinen.
 *
 * <b>Je Grösse:</b> im Streifen klein und still; sonst ganz, bewegt.
 */

import { ImagePicker } from '../PageFiles';
import { MotionBox } from '../motion/MotionBox';
import { MotionField } from '../motion/MotionField';
import { MOTION_NAMES, motionsJson, readMotions, type MotionUse } from '../motion/motion';
import { definePart, text, type EditorProps, type RawConfig } from '../part';
import { textLink } from '../presentation/presentation';
import { imageUrl } from '../slides/slideLook';

interface Ply {
  readonly url: string;
  readonly z: number;
  readonly shadow: string | null;
  readonly motion: readonly MotionUse[];
}

interface Config {
  readonly alt: string;
  readonly link: string | null;
  readonly layers: readonly Ply[];
}

/** Ein Schatten wie im Altbestand: „0 26px 60px rgba(8, 20, 38, 0.6)" — Zahlen, Pixel und eine Farbe, sonst nichts. */
const SHADOW = /^-?\d+(\.\d+)?(px)?\s+-?\d+(\.\d+)?(px)?\s+\d+(\.\d+)?(px)?\s+(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%]+\))$/i;

export const readPlies = (value: unknown): Ply[] => {
  const list = Array.isArray(value) ? value : [];
  const out: Ply[] = [];
  for (const raw of list.slice(0, 40)) {
    const one = typeof raw === 'string' ? { url: raw } : (typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {});
    const url = typeof one.url === 'string' ? one.url.trim() : '';
    if (url === '') continue;
    const shadow = typeof one.shadow === 'string' && SHADOW.test(one.shadow.trim()) ? one.shadow.trim() : null;
    out.push({
      url,
      z: typeof one.z === 'number' && Number.isFinite(one.z) ? Math.round(Math.max(-10, Math.min(10, one.z))) : 0,
      shadow,
      motion: readMotions(one.motion)
    });
  }
  return out;
};

const plyJson = (ply: Ply): Record<string, unknown> => {
  const motion = motionsJson(ply.motion);
  return { url: ply.url, ...(ply.z === 0 ? {} : { z: ply.z }), ...(ply.shadow === null ? {} : { shadow: ply.shadow }), ...(motion === undefined ? {} : { motion }) };
};

const read = (raw: RawConfig): Config => {
  let layers: Ply[] = [];
  try { layers = readPlies(JSON.parse(text(raw, 'layers') || '[]') as unknown); } catch { layers = []; }
  return { alt: text(raw, 'alt'), link: textLink(text(raw, 'link')), layers };
};

function LayersView({ config, still }: { config: Config; still: boolean }) {
  const picture = (
    <div className={`wk-layers${still ? ' is-still' : ''}`} role="img" aria-label={config.alt || undefined}>
      {config.layers.map((ply, index) => (
        <div key={index} className={`wk-layers-ply${index === 0 ? ' is-base' : ''}`} style={{ zIndex: ply.z }}>
          <MotionBox motions={still ? [] : ply.motion} className="wk-layers-move">
            <img src={imageUrl(ply.url)} alt="" draggable={false} decoding="async"
              style={ply.shadow === null ? undefined : { filter: `drop-shadow(${ply.shadow})` }} />
          </MotionBox>
        </div>
      ))}
    </div>
  );
  if (config.link === null) return picture;
  const outside = /^https?:/i.test(config.link);
  return <a className="wk-layers-link" href={config.link} {...(outside ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{picture}</a>;
}

/** Die Ebenen bearbeiten: Bild, Reihenfolge, Schatten, Bewegung. */
function LayersEditor({ raw, onSet, ctx, busy }: EditorProps) {
  const config = read(raw);
  const save = (layers: readonly Ply[]) => onSet({ layers: JSON.stringify(layers.map(plyJson)) });
  const update = (index: number, next: Ply) => save(config.layers.map((one, i) => (i === index ? next : one)));
  return (
    <div className="wk-layers-edit">
      <p className="wk-hint">Pierwsza warstwa wyznacza rozmiar; następne leżą dokładnie na niej (obrazy tej samej wielkości z przezroczystym tłem).</p>
      <ol className="wk-layers-list">
        {config.layers.map((ply, index) => (
          <li key={index}>
            <div className="wk-layers-row">
              <img src={imageUrl(ply.url)} alt="" className="wk-layers-thumb" />
              <input value={ply.url} disabled={busy} aria-label="Adres obrazu" onChange={(e) => update(index, { ...ply, url: e.target.value })} />
              <label className="se-inline"><span>z</span>
                <input type="number" min={-10} max={10} value={ply.z} disabled={busy} onChange={(e) => update(index, { ...ply, z: Number(e.target.value) || 0 })} />
              </label>
              <button type="button" className="se-drop" aria-label="Usuń warstwę" disabled={busy}
                onClick={() => save(config.layers.filter((_, i) => i !== index))}>×</button>
            </div>
            <label className="se-inline">
              <span>Cień</span>
              <input value={ply.shadow ?? ''} disabled={busy} placeholder="0 26px 60px rgba(8, 20, 38, 0.6)"
                onChange={(e) => update(index, { ...ply, shadow: SHADOW.test(e.target.value.trim()) ? e.target.value.trim() : null })} />
            </label>
            <MotionField value={ply.motion} busy={busy} onChange={(motion) => update(index, { ...ply, motion })} />
          </li>
        ))}
      </ol>
      {ctx.path !== null && (
        <ImagePicker path={ctx.path} value="" busy={busy} onPick={(url) => save([...config.layers, { url, z: 0, shadow: null, motion: [] }])} />
      )}
    </div>
  );
}

const LOGO = (n: number) => `/cogita/logo/Cogita${String(n).padStart(2, '0')}.png`;

export const layersPart = definePart<Config>({
  kind: 'layers',
  label: 'Obraz z warstw',
  use: 'Znak albo ilustracja z kilku nałożonych warstw, każda z własnym ruchem — np. logo, którego litery się składają, a bańki unoszą.',
  box: { colSpan: 3, rowSpan: 3 },

  example: {
    alt: 'Cogita',
    link: '#/cogita',
    layers: JSON.stringify([
      { url: LOGO(0), z: 1, shadow: '0 26px 60px rgba(8, 20, 38, 0.6)', motion: { name: 'float', x: 4, y: 6, duration: 3800 } },
      { url: LOGO(12), z: 2, motion: { name: 'assemble', delay: 0 } },
      { url: LOGO(13), z: 2, motion: { name: 'assemble', delay: 90 } }
    ])
  },
  fields: [
    { key: 'alt', label: 'Opis obrazu', kind: 'line', hint: 'dla czytników ekranu, np. „Cogita”' },
    { key: 'link', label: 'Link', kind: 'line', hint: 'pusty — bez linku; #/strona albo https://…' }
  ],
  extra: [
    {
      key: 'layers', shape: 'json', says: 'Warstwy od pierwszej (wyznacza rozmiar) — lista; każda: { "url", "z", "shadow", "motion" }',
      inside: {
        '[].url': 'Adres obrazu (np. "/cogita/logo/Cogita00.png") albo "page-image:<id>" — obraz strony',
        '[].z': 'Kolejność nakładania: wyżej — z przodu (−10…10; pominięte — 0)',
        '[].shadow': 'Cień warstwy: "przesunięcie-x przesunięcie-y rozmycie kolor", np. "0 26px 60px rgba(8, 20, 38, 0.6)" (pominięty — bez cienia)',
        '[].motion': 'Ruch warstwy (opis niżej: Ruch) — np. { "name": "float", "x": 4, "y": 6 } albo { "name": "assemble", "delay": 90 }; lista do trzech',
        '[].motion.name': `Nazwa ruchu ze słownika: ${MOTION_NAMES.map((name) => `"${name}"`).join(', ')}`,
        '[].motion.x': 'Regulacja ruchu (tu: wychylenie w bok, px) — każdy ruch ma swoje, opis niżej',
        '[].motion.y': 'Regulacja ruchu (tu: wychylenie w pionie, px)',
        '[].motion.duration': 'Czas jednego przebiegu w ms (pominięty — jak w słowniku)',
        '[].motion.delay': 'Opóźnienie w ms — przy kolejnych literach rośnie (0, 90, 180 …)'
      }
    }
  ],

  read,
  hasContent: (c) => c.layers.length > 0,
  shows: (c, size) => size.height === 'strip'
    ? `${c.layers.length} warstw, małe i nieruchome.`
    : `${c.layers.length} warstw, każda ze swoim ruchem.`,
  Editor: LayersEditor,
  View: ({ config, ctx }) => <LayersView config={config} still={ctx.size.height === 'strip'} />
});
