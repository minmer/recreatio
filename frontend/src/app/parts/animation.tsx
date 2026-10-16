/**
 * ANIMACJA (0107, 0108) — eine Zeichnung mit Bewegung, für jede Seite: Flächen,
 * Linien, Punkte, Texte, Bilder, Gruppen und wiederverwendbare Teile, und an
 * jedem Teil Bewegungen aus demselben Wörterbuch wie überall (`motion.ts`):
 * move, size, turn, fade, draw, color, reveal, keys — und die Vorlagen.
 *
 * <b>Nichts darin ist ein fertiges Bild.</b> Die Bilder des Pokaz von Cogita
 * (Mapa wiedzy, Karty, Runda, Postęp, Tarcza) sind Zeichnungen in diesem
 * Format — erzeugt aus den Rechnungen des Altbestands
 * (`scripts/cogita-home.mjs`); wer etwas anderes bewegen will, schreibt seine
 * eigene (oder lässt sie schreiben und importiert sie).
 *
 * <b>Wann sie läuft:</b> in einer Szene, auf einem Slajd — sobald er erreicht
 * ist (alle Teile zugleich, von vorn, wenn man wiederkommt); auf einer Seite —
 * sobald sie im Bild ist; still bei „weniger Bewegung".
 *
 * <b>Je Grösse:</b> im Streifen klein und still; als Block und hoch ganz,
 * bewegt, so breit wie der Baustein (höchstens `max` rem).
 */

import { useMemo, useState, type CSSProperties } from 'react';

import { motionCount, readDrawing, shapeCount, SHAPE_TYPES } from '../drawing';
import { DrawingView } from '../DrawingView';
import { MOTION_NAMES } from '../motion';
import { definePart, type EditorProps, type RawConfig } from '../part';

interface Config {
  readonly raw: RawConfig;
}

const read = (raw: RawConfig): Config => ({ raw });

/** Was eine Zeichnung ist: ihre Teile, ihre Bewegungen. */
const sum = (raw: RawConfig): string => {
  const d = readDrawing(raw);
  return `${shapeCount(d)} elementów, ${motionCount(d)} ruchów`;
};

function AnimationView({ raw, strip }: { raw: RawConfig; strip: boolean }) {
  const identity = `${raw.size ?? ''}|${raw.symbols ?? ''}|${raw.elements ?? ''}|${raw.alt ?? ''}|${raw.max ?? ''}`;
  const drawing = useMemo(() => readDrawing(raw), [identity]); // eslint-disable-line react-hooks/exhaustive-deps
  if (drawing.elements.length === 0) return <p className="wk-card-muted">Rysunek jest pusty.</p>;
  return (
    <div className={`an${strip ? ' is-strip' : ''}`} style={drawing.max === null ? undefined : { '--an-max': `${drawing.max}rem` } as CSSProperties}>
      <DrawingView drawing={drawing} identity={identity} still={strip} />
    </div>
  );
}

const parsed = (text: string | undefined, fallback: unknown): unknown => {
  try { return text === undefined || text.trim() === '' ? fallback : JSON.parse(text) as unknown; } catch { return fallback; }
};

/** Der Rysunek als JSON — so schreibt man ihn (oder lässt ihn schreiben); geprüft, bevor er übernommen wird. */
function AnimationEditor({ raw, onSet, busy }: EditorProps) {
  const [text, setText] = useState(() => JSON.stringify({
    size: parsed(raw.size, [200, 120]), symbols: parsed(raw.symbols, []), elements: parsed(raw.elements, [])
  }, null, 2));
  const [said, setSaid] = useState<string | null>(null);
  const apply = () => {
    try {
      const value = JSON.parse(text) as Record<string, unknown>;
      const next = {
        size: JSON.stringify(value.size ?? [200, 120]),
        symbols: JSON.stringify(value.symbols ?? []),
        elements: JSON.stringify(value.elements ?? [])
      };
      onSet(next);
      setSaid(`Przyjęto: ${sum(next)}.`);
    } catch (e) {
      setSaid(`To nie jest poprawny JSON: ${e instanceof Error ? e.message : ''}`);
    }
  };
  return (
    <div className="an-edit">
      <label className="se-inline">
        <span>Opis (dla czytników ekranu)</span>
        <input value={raw.alt ?? ''} disabled={busy} maxLength={200} onChange={(e) => onSet({ alt: e.target.value })} />
      </label>
      <label className="se-inline">
        <span>Najwyżej (rem)</span>
        <input type="number" min={2} max={200} value={raw.max ?? ''} placeholder="cała szerokość" disabled={busy}
          onChange={(e) => onSet({ max: e.target.value.trim() === '' ? '' : String(Number(e.target.value)) })} />
      </label>
      <p className="wk-hint">
        Rysunek: „size” (szerokość i wysokość w jednostkach rysunku), „symbols” (części do wielokrotnego użycia), „elements”
        (rect, circle, ellipse, line, path, text, image, group, use) — każdy może mieć ruch „motion”. Pełny opis — przy imporcie
        JSON strony. Teraz: {sum(raw)}.
      </p>
      <textarea className="an-edit-json" rows={14} value={text} spellCheck={false} disabled={busy} aria-label="Rysunek JSON" onChange={(e) => setText(e.target.value)} />
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={apply}>Przyjmij rysunek</button>
        {said !== null && <span className="wk-hint" role="status">{said}</span>}
      </div>
    </div>
  );
}

/* -- Die Beschreibung der Teile — für jede Stelle, an der ein Teil stehen kann ---------------- */

const SHAPE_KEYS: Readonly<Record<string, string>> = {
  type: `Rodzaj: ${SHAPE_TYPES.map((t) => `"${t}"`).join(', ')} — "group" zbiera "children", "use" wstawia część z "symbols"`,
  x: 'Położenie w jednostkach rysunku: rect, image — lewy górny róg; circle, ellipse — środek; text — punkt zaczepienia; line — początek; group, use — przesunięcie',
  y: 'Jak "x", w pionie',
  w: 'Szerokość (rect, image, ellipse)',
  h: 'Wysokość (rect, image, ellipse)',
  r: 'circle — promień; rect — zaokrąglenie rogów',
  x2: 'line — koniec, w poziomie',
  y2: 'line — koniec, w pionie',
  d: 'path — ścieżka SVG ("M10 10 L50 40 Z" …)',
  text: 'text — napis',
  size: 'text — wielkość pisma',
  weight: 'text — grubość pisma (400, 600 …)',
  anchor: 'text — gdzie stoi punkt: "start", "middle" (zwykle), "end"',
  url: 'image — adres obrazu ("/…", "https://…", "page-image:<id>")',
  use: 'use — nazwa części z "symbols"',
  fill: 'Wypełnienie: kolor ("#rrggbb", "rgba(…)", "accent", "muted/35" …), "none", albo poświata "radial(rgba(120, 190, 255, 0.25), transparent 70%)"',
  stroke: 'Kolor linii (obrysu)',
  width: 'Grubość linii',
  cap: 'Zakończenie linii: "round" (zwykle), "butt", "square"',
  opacity: 'Krycie 0–1',
  blur: 'Rozmycie (px)',
  glow: 'Poświata/cień: "x y rozmycie kolor", np. "0 0 10px rgba(160, 220, 255, 0.75)"',
  origin: 'Wokół czego obraca się i rośnie: "center" (zwykle), "25% 75%" (część elementu), "170 225" (jednostki rysunku)',
  scale: 'group, use — stała skala',
  rotate: 'group, use — stały obrót (stopnie)',
  children: 'group — elementy w środku (te same klucze)',
  shift: 'group, use — o tyle ms później ruszają się elementy w środku (np. kolejne karty po 120 ms)',
  motion: 'Ruch elementu (opis: Ruch) — obiekt albo lista do trzech'
};

const MOTION_KEYS: Readonly<Record<string, string>> = {
  name: `Słowo ruchu: ${MOTION_NAMES.map((n) => `"${n}"`).join(', ')}`,
  duration: 'Czas jednego przebiegu (ms)',
  delay: 'Opóźnienie (ms; w pętli może być ujemne)',
  repeat: '"once", "loop", "alternate" albo liczba',
  ease: '"linear", "ease", "in", "out", "inOut", "step" albo "cubic-bezier(…)"',
  unit: '"px" (jednostki rysunku) albo "%"',
  from: 'Skąd (liczba, punkt [x, y] albo kolor)',
  to: 'Dokąd (liczba, punkt [x, y] albo kolor)',
  path: 'move — droga: lista punktów [x, y]',
  times: 'move — kiedy w którym punkcie (0–1)',
  keys: 'keys — klatki',
  length: 'draw poza rysunkiem — długość kreski'
};

const KEY_KEYS: Readonly<Record<string, string>> = {
  at: 'Kiedy (0–1 czasu ruchu)',
  x: 'Przesunięcie w poziomie', y: 'Przesunięcie w pionie',
  scale: 'Wielkość (1 — jak jest)', sx: 'Wielkość w poziomie', sy: 'Wielkość w pionie',
  rotate: 'Obrót (stopnie)', opacity: 'Krycie 0–1', blur: 'Rozmycie (px)',
  draw: 'Ile linii narysowane (0–1)', color: 'Kolor wypełnienia albo napisu', stroke: 'Kolor linii',
  glow: 'Poświata "x y rozmycie kolor"', reveal: 'Ile widać od lewej (0–1)', clip: 'Wycinek "inset(góra prawa dół lewa)"',
  ease: 'Przejście do następnej klatki'
};

/** Jeder Schlüssel an jeder Stelle, an der ein Teil steht: `elements[]`, `elements[].children[]` … */
function shapeDocs(prefix: string, depth = 0): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, says] of Object.entries(SHAPE_KEYS)) out[`${prefix}.${key}`] = says;
  for (const [key, says] of Object.entries(MOTION_KEYS)) {
    out[`${prefix}.motion.${key}`] = says;
    out[`${prefix}.motion[].${key}`] = says;
  }
  for (const [key, says] of Object.entries(KEY_KEYS)) {
    out[`${prefix}.motion.keys[].${key}`] = says;
    out[`${prefix}.motion[].keys[].${key}`] = says;
  }
  if (depth < 2) Object.assign(out, shapeDocs(`${prefix}.children[]`, depth + 1));
  return out;
}

const relative = (docs: Record<string, string>, base: string): Record<string, string> =>
  Object.fromEntries(Object.entries(docs).map(([k, v]) => [k.slice(base.length), v]));

/** Ein kleines Beispiel: eine Linie, die sich zeichnet, eine Kropka auf einem Weg, ein pulsujący pierścień, ein Napis, der aufsteigt. */
const EXAMPLE = {
  alt: 'Kropka w drodze',
  size: [200, 120],
  max: 20,
  symbols: [{ name: 'kropka', shapes: [{ type: 'circle', x: 0, y: 0, r: 6, fill: 'accent', glow: '0 0 8px accent/60' }] }],
  elements: [
    { type: 'line', x: 20, y: 100, x2: 180, y2: 20, stroke: 'muted/50', width: 2, motion: { name: 'draw', duration: 1200 } },
    { type: 'use', use: 'kropka', x: 20, y: 100, motion: { name: 'move', path: [[0, 0], [80, -40], [160, -80]], duration: 2400, repeat: 'loop', ease: 'inOut' } },
    {
      type: 'group', x: 100, y: 60,
      children: [{ type: 'circle', x: 0, y: 0, r: 14, fill: 'none', stroke: 'accent', width: 2 }],
      motion: { name: 'keys', duration: 1800, repeat: 'loop', keys: [{ at: 0, scale: 0.6, opacity: 0 }, { at: 0.5, scale: 1, opacity: 1 }, { at: 1, scale: 1.2, opacity: 0 }] }
    },
    { type: 'text', x: 100, y: 112, text: 'w drodze', size: 9, fill: 'ink/70', motion: { name: 'rise', delay: 400 } }
  ]
};

export const animationPart = definePart<Config>({
  kind: 'animation',
  label: 'Animacja',
  use: 'Rysunek, który się rusza: kształty, linie, kropki, napisy i obrazy — każdy z ruchem (przesuwa się, rośnie, obraca, rysuje, zmienia kolor). Np. obrazy pokazu Cogita.',
  box: { colSpan: 3, rowSpan: 3 },

  example: Object.fromEntries(Object.entries(EXAMPLE).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])),
  fields: [],
  extra: [
    { key: 'alt', shape: 'line', says: 'Opis rysunku dla czytników ekranu (pusty — rysunek tylko ozdobny)' },
    { key: 'size', shape: 'json', says: 'Wielkość rysunku w jego jednostkach: [szerokość, wysokość] — rysunek rośnie i maleje jako całość z modułem' },
    { key: 'max', shape: 'json', says: 'Najwyżej tyle szerokości w rem (liczba); pominięte — cała szerokość modułu' },
    {
      key: 'symbols', shape: 'json', says: 'Części do wielokrotnego użycia: [{ "name": "fiszka", "shapes": [elementy] }] — wstawia je element { "type": "use", "use": "fiszka" }',
      inside: { '[].name': 'Nazwa części', '[].shapes': 'Elementy części (jak w "elements")', ...relative(shapeDocs('symbols[].shapes[]'), 'symbols') }
    },
    {
      key: 'elements', shape: 'json', says: 'Elementy rysunku, od tyłu do przodu — każdy z położeniem, wyglądem i ruchem ("motion")',
      inside: relative(shapeDocs('elements[]'), 'elements')
    }
  ],

  read,
  hasContent: (c) => readDrawing(c.raw).elements.length > 0,
  missing: (c) => (readDrawing(c.raw).elements.length === 0 ? 'Rysunek nie ma jeszcze żadnego elementu.' : null),
  shows: (c, size) => size.height === 'strip'
    ? `Rysunek (${sum(c.raw)}) — mały, nieruchomy.`
    : `Rysunek (${sum(c.raw)}) w ruchu, na całą szerokość modułu.`,
  Editor: AnimationEditor,
  View: ({ config, ctx }) => <AnimationView raw={config.raw} strip={ctx.size.height === 'strip'} />
});
