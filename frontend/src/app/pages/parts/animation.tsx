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
 * <b>2026-10-17 — zum Anfassen</b> (`motion/liveModel.ts`): Werte, die man
 * einstellt (`vars`), Rechnungen (`let`), eine Simulation (`sim`), Bedienung
 * (`controls`) und Regeln mit Ziel (`rules`); an den Teilen Ausdrücke, Ziehen,
 * Antippen. So erklärt eine Seite Physik, wie Brilliant es tut: erst tun,
 * dann sehen. Fertige Beispiele (`motion/liveExamples.ts`) und ein Polecenie
 * dla AI bietet der Editor an.
 *
 * <b>Wann sie läuft:</b> in einer Szene, auf einem Slajd — sobald er erreicht
 * ist (alle Teile zugleich, von vorn, wenn man wiederkommt); auf einer Seite —
 * sobald sie im Bild ist; still bei „weniger Bewegung".
 *
 * <b>Je Grösse:</b> im Streifen klein und still (ohne Bedienung); als Block und
 * hoch ganz, bewegt, so breit wie der Baustein (höchstens `max` rem).
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { drawingIdentity, drawingOf, LIVE_KEYS, motionCount, needsLive, readDrawing, shapeCount, SHAPE_TYPES } from '../motion/drawing';
import { DrawingView } from '../motion/DrawingView';
import { MOTION_NAMES } from '../motion/motion';
import { ACTIONS, CONTROL_TYPES, MOODS } from '../motion/liveModel';
import type { Problem } from '../motion/liveRun';
import type { LiveExample } from '../motion/liveExamples';
import { definePart, type EditorProps, type RawConfig } from '../part';
import { later } from '../../ui/later';

interface Config {
  readonly raw: RawConfig;
}

const read = (raw: RawConfig): Config => ({ raw });

/** Was eine Zeichnung ist: ihre Teile, ihre Bewegungen — und ob man sie anfassen kann. */
const sum = (raw: RawConfig): string => {
  const d = readDrawing(raw);
  const live = d.live === null ? '' : `, ${d.live.vars.length} do ustawienia${d.live.sim === null ? '' : ', symulacja'}${d.live.rules.some((r) => r.goal) ? ', z celem' : ''}`;
  return `${shapeCount(d)} elementów, ${motionCount(d)} ruchów${live}`;
};

function AnimationView({ raw, strip }: { raw: RawConfig; strip: boolean }) {
  const identity = drawingIdentity(raw);
  const drawing = useMemo(() => readDrawing(raw), [identity]); // eslint-disable-line react-hooks/exhaustive-deps
  if (drawing.elements.length === 0) return <p className="wk-card-muted">Rysunek jest pusty.</p>;
  const sized = (drawing.max === null ? undefined : { '--an-max': `${drawing.max}rem` }) as CSSProperties | undefined;
  return (
    <div className={`an${strip ? ' is-strip' : ''}`} style={sized}>
      <DrawingView drawing={drawing} identity={identity} still={strip} />
    </div>
  );
}

const parsed = (text: string | undefined, fallback: unknown): unknown => {
  try { return text === undefined || text.trim() === '' ? fallback : JSON.parse(text) as unknown; } catch { return fallback; }
};

/** Der Rysunek als ein Dokument — so steht er im Editor (und so schreibt ihn eine KI). */
function docOf(raw: RawConfig): Record<string, unknown> {
  const out: Record<string, unknown> = { size: parsed(raw.size, [200, 120]) };
  for (const key of LIVE_KEYS) {
    if (key === 'panel') { if ((raw.panel ?? '') !== '') out.panel = raw.panel; continue; }
    const value = parsed(raw[key], undefined);
    if (value !== undefined) out[key] = value;
  }
  out.symbols = parsed(raw.symbols, []);
  out.elements = parsed(raw.elements, []);
  return out;
}

/** Das Bild zum Anfassen samt seinen Fehlern — erst geladen, wenn der Editor eines zeigt. */
const LivePreview = later(() => import('../motion/LiveDrawing').then((m) => m.LiveDrawing), null);

/**
 * Der Rysunek als JSON — so schreibt man ihn (oder lässt ihn schreiben);
 * daneben, was er gerade zeigt, und was in seinen Ausdrücken nicht stimmt.
 * Übernommen wird erst mit „Przyjmij rysunek".
 */
function AnimationEditor({ raw, onSet, busy }: EditorProps) {
  const [text, setText] = useState(() => JSON.stringify(docOf(raw), null, 2));
  const [said, setSaid] = useState<string | null>(null);
  const [problems, setProblems] = useState<readonly Problem[]>([]);
  const [examples, setExamples] = useState<readonly LiveExample[] | null>(null);

  const draft = useMemo(() => {
    try {
      const value = JSON.parse(text) as unknown;
      return typeof value === 'object' && value !== null && !Array.isArray(value) ? { value: value as Record<string, unknown> } : { error: 'Rysunek to jeden obiekt { … }.' };
    } catch (e) {
      return { error: `To nie jest poprawny JSON: ${e instanceof Error ? e.message : ''}` };
    }
  }, [text]);
  const drawing = useMemo(() => ('value' in draft ? drawingOf(draft.value) : null), [draft]);
  const live = drawing !== null && needsLive(drawing);
  /* Was in den Ausdrücken nicht stimmt — gerechnet, ohne zu zeichnen; die Rechnung kommt erst, wenn sie gebraucht wird. */
  useEffect(() => {
    if (drawing === null || !live) { setProblems([]); return undefined; }
    let alive = true;
    void import('../motion/liveLint').then((m) => { if (alive) setProblems(m.problemsOf(drawing)); });
    return () => { alive = false; };
  }, [drawing, live]);

  const loadExamples = () => {
    if (examples === null) void import('../motion/liveExamples').then((m) => setExamples(m.LIVE_EXAMPLES));
  };

  const apply = () => {
    const value = draft.value;
    if (value === undefined) { setSaid(draft.error ?? null); return; }
    const json = (key: string, fallback?: unknown): string => {
      const one = value[key] ?? fallback;
      return one === undefined ? '' : JSON.stringify(one);
    };
    const next: RawConfig = {
      size: json('size', [200, 120]), symbols: json('symbols', []), elements: json('elements', []),
      vars: json('vars'), let: json('let'), sim: json('sim'), controls: json('controls'), rules: json('rules'),
      panel: typeof value.panel === 'string' ? value.panel : '',
      ...(typeof value.alt === 'string' ? { alt: value.alt } : {}),
      ...(typeof value.max === 'number' ? { max: String(value.max) } : {})
    };
    onSet(next);
    setSaid(`Przyjęto: ${sum(next)}.`);
  };

  const copyPrompt = () => {
    void import('../motion/liveText').then(async (t) => {
      const ex = (await import('../motion/liveExamples')).LIVE_EXAMPLES[0];
      await navigator.clipboard.writeText(t.livePrompt(ex.drawing));
      setSaid('Polecenie dla AI skopiowane — wklej je w swoim czacie, a gotowy JSON tutaj.');
    }).catch(() => setSaid('Nie udało się skopiować polecenia.'));
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
        Rysunek: „size”, „elements” (rect, circle, ellipse, line, arrow, poly, plot, trace, frame, path, text, image, group, use), „symbols”;
        do poruszania: „vars”, „let”, „sim”, „controls”, „rules” — wartości mogą być wyrażeniami „=…”. Pełny opis — przy imporcie JSON strony
        i w poleceniu dla AI. Teraz: {sum(raw)}.
      </p>
      <div className="wk-actions">
        <select aria-label="Wstaw przykład" value="" disabled={busy} onFocus={loadExamples} onPointerDown={loadExamples}
          onChange={(e) => {
            const one = examples?.find((x) => x.key === e.target.value);
            if (one !== undefined) { setText(JSON.stringify(one.drawing, null, 2)); setSaid(`Przykład „${one.title}” — sprawdź podgląd i przyjmij.`); }
          }}>
          <option value="">Wstaw przykład z fizyki…</option>
          {(examples ?? []).map((x) => <option key={x.key} value={x.key}>{x.title} — {x.says}</option>)}
        </select>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={copyPrompt}>Kopiuj polecenie dla AI</button>
      </div>
      <textarea className="an-edit-json" rows={14} value={text} spellCheck={false} disabled={busy} aria-label="Rysunek JSON" onChange={(e) => setText(e.target.value)} />
      {'error' in draft && <p className="wk-error">{draft.error}</p>}
      {drawing !== null && drawing.elements.length > 0 && (
        <div className="an-preview" aria-label="Podgląd rysunku">
          {live
            ? <LivePreview drawing={drawing} identity={text} />
            : <DrawingView drawing={drawing} identity={text} />}
        </div>
      )}
      {live && problems.length > 0 && (
        <ul className="an-problems" aria-label="Błędy w wyrażeniach">
          {problems.slice(0, 12).map((p, i) => <li key={i}>{p.where}: {p.error}{p.source === '' ? '' : <> — <code>{p.source}</code></>}</li>)}
        </ul>
      )}
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || !('value' in draft)} onClick={apply}>Przyjmij rysunek</button>
        {said !== null && <span className="wk-hint" role="status">{said}</span>}
      </div>
    </div>
  );
}

/* -- Die Beschreibung der Teile — für jede Stelle, an der ein Teil stehen kann ---------------- */

const SHAPE_KEYS: Readonly<Record<string, string>> = {
  type: `Rodzaj: ${SHAPE_TYPES.map((t) => `"${t}"`).join(', ')} — "group" zbiera "children", "use" wstawia część z "symbols", "frame" to rama ze światem (y w górę)`,
  x: 'Położenie w jednostkach rysunku (w ramie — świata): rect, image — lewy górny róg (w ramie: lewy dolny); circle, ellipse — środek; text — punkt zaczepienia; line, arrow — początek; group, use — przesunięcie; frame — lewy górny róg ramy. Liczba albo wyrażenie "=…"',
  y: 'Jak "x", w pionie',
  w: 'Szerokość (rect, image, ellipse, frame)',
  h: 'Wysokość (rect, image, ellipse, frame)',
  r: 'circle — promień; rect — zaokrąglenie rogów (zawsze w jednostkach rysunku)',
  x2: 'line, arrow — koniec, w poziomie',
  y2: 'line, arrow — koniec, w pionie',
  d: 'path — ścieżka SVG ("M10 10 L50 40 Z" …); w ramie nie jest przeliczana — tam "poly"',
  text: 'text — napis; z wartościami w {…}: "Kąt: {fmt(kat, 0)}°"',
  size: 'text — wielkość pisma',
  weight: 'text — grubość pisma (400, 600 …)',
  anchor: 'text — gdzie stoi punkt: "start", "middle" (zwykle), "end"',
  url: 'image — adres obrazu ("/…", "https://…", "page-image:<id>")',
  use: 'use — nazwa części z "symbols"',
  fill: 'Wypełnienie: kolor ("#rrggbb", "rgba(…)", "accent", "muted/35" …), "none", poświata "radial(rgba(120, 190, 255, 0.25), transparent 70%)" albo wyrażenie "=trafione ? \'ok\' : \'accent\'"',
  stroke: 'Kolor linii (obrysu) — też wyrażenie',
  width: 'Grubość linii',
  cap: 'Zakończenie linii: "round" (zwykle), "butt", "square"',
  opacity: 'Krycie 0–1',
  blur: 'Rozmycie (px) — na telefonie oszczędnie',
  glow: 'Poświata/cień: "x y rozmycie kolor", np. "0 0 10px rgba(160, 220, 255, 0.75)"',
  origin: 'Wokół czego obraca się i rośnie: "center" (zwykle), "25% 75%" (część elementu), "170 225" (jednostki rysunku)',
  scale: 'group, use — skala (też wyrażenie)',
  rotate: 'group, use — obrót w stopniach (w ramie: przeciwnie do wskazówek zegara)',
  children: 'group, frame — elementy w środku (te same klucze)',
  shift: 'group, use — o tyle ms później ruszają się elementy w środku (np. kolejne karty po 120 ms)',
  motion: 'Ruch elementu (opis: Ruch) — obiekt albo lista do trzech',
  show: 'Kiedy element widać: wyrażenie, np. "step >= 1" (drugi krok sceny) albo "sily == 1"',
  drag: 'Przeciąganie: { "x": "zmienna" } — zmienna = położenie palca; { "set": { "kat": "deg(atan2(py, px))" } } — z położenia palca (px, py); "label" — nazwa uchwytu',
  'drag.x': 'Zmienna, która dostaje położenie palca w poziomie',
  'drag.y': 'Zmienna, która dostaje położenie palca w pionie',
  'drag.set': 'Zmienne liczone z położenia palca: { "nazwa": "wyrażenie z px, py" }',
  'drag.label': 'Nazwa uchwytu dla czytników ekranu',
  tap: 'Kliknięcie: "run" / "pause" / "toggle" / "reset" albo { "set": {…}, "do": …, "go": "next", "label": … }',
  'tap.set': 'Zmienne ustawiane kliknięciem: { "nazwa": "wyrażenie" }',
  'tap.do': `Co robi z symulacją: ${ACTIONS.map((a) => `"${a}"`).join(', ')}`,
  'tap.go': 'W prezentacji: dokąd — "next", "back", klucz sceny, "link:<id>"',
  'tap.label': 'Nazwa przycisku dla czytników ekranu',
  repeat: 'Ile kopii elementu (w każdej "i" = 0, 1, … i "n" = ile) — np. cząstki, podziałka',
  label: 'Nazwa uchwytu albo przycisku (przeciąganie, kliknięcie)',
  head: 'arrow — wielkość grotu (jednostki rysunku)',
  points: 'poly — punkty [[x, y], …]: liczby albo wyrażenia "=…"',
  closed: 'poly — true: zamknięty wielokąt',
  fn: 'plot — y jako wyrażenie od "u" (np. "A*sin(2*pi*u/l)")',
  fx: 'plot — x drogi od "u"; trace — co śledzić w poziomie (np. "x")',
  fy: 'plot — y drogi od "u"; trace — co śledzić w pionie (np. "y")',
  var: 'plot — nazwa biegu krzywej (zwykle "u"; np. "i" dla zygzaka sprężyny)',
  from: 'plot — od jakiej wartości biegu (liczba albo "=…")',
  to: 'plot — do jakiej wartości biegu (liczba albo "=…")',
  samples: 'plot — z ilu punktów (do 600)',
  keep: 'trace — ile ostatnich punktów zostaje',
  every: 'trace — co ile sekund symulacji nowy punkt',
  view: 'frame — jaki fragment świata widać: [x0, y0, x1, y1] (liczby albo "=…"; y rośnie w górę)',
  axes: 'frame — osie: true albo { "x": "x [m]", "y": "y [m]", "grid": true }',
  'axes.x': 'Podpis osi poziomej',
  'axes.y': 'Podpis osi pionowej',
  'axes.grid': 'Siatka pod spodem',
  clip: 'frame — true: co wychodzi poza ramę, znika'
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

/**
 * EIN KLEINES BEISPIEL ZUM ANFASSEN: ein Wurf in einer Rama (Welt in Metern),
 * Kąt am Schieber, Prędkość zur Wahl, Rzuć als Knopf, Zasięg als Anzeige, ein
 * Ziel, das man ziehen kann, und eine Regel, die das Treffen meldet — dazu
 * eine Kropka mit Ruch wie früher.
 */
const EXAMPLE = {
  alt: 'Rzut — ustaw kąt, wybierz prędkość i trafiaj w cel',
  size: [320, 200],
  max: 32,
  panel: 'below',
  vars: [
    { name: 'kat', value: 45, min: 5, max: 85, step: 1, unit: '°', label: 'Kąt' },
    { name: 'v0', value: 10, min: 4, max: 14, step: 0.5, unit: 'm/s', label: 'Prędkość' },
    { name: 'cel', value: 10, min: 3, max: 19, step: 0.5, unit: 'm', label: 'Cel', random: [6, 16] }
  ],
  let: [{ name: 'zasieg', value: 'v0^2*sin(rad(2*kat))/9.81' }],
  sim: {
    state: [
      { name: 'x', value: 0, rate: 'vx' },
      { name: 'y', value: 0, rate: 'vy' },
      { name: 'vx', value: 'v0*cos(rad(kat))', rate: 0 },
      { name: 'vy', value: 'v0*sin(rad(kat))', rate: -9.81 }
    ],
    events: [{ when: 'y < 0 && vy < 0', set: { vy: 0 }, stop: true, say: 'Spadła po {fmt(t, 1)} s.', mood: 'info' }],
    until: 't > 6', dt: 0.002, speed: 1, auto: false, loop: false, max: 30
  },
  controls: [
    { type: 'slider', var: 'kat', label: 'Kąt', unit: '°', digits: 0 },
    { type: 'choice', var: 'v0', label: 'Prędkość', options: [{ value: 8, label: 'wolno' }, { value: 10, label: 'średnio' }, { value: 13, label: 'szybko' }] },
    { type: 'button', label: 'Rzuć', do: 'run', go: 'next' },
    { type: 'readout', label: 'Zasięg', value: 'zasieg', unit: 'm', digits: 1 }
  ],
  rules: [{ when: 'abs(x - cel) < 0.6 && y <= 0 && t > 0', say: 'Trafione z {fmt(kat, 0)}°!', mood: 'ok', goal: true, once: true, do: 'pause' }],
  symbols: [{ name: 'kropka', shapes: [{ type: 'circle', x: 0, y: 0, r: 4, fill: 'accent', glow: '0 0 6px accent/60', motion: { name: 'breathe', duration: 1600 } }] }],
  elements: [
    {
      type: 'frame', x: 30, y: 10, w: 280, h: 160, view: [0, 0, 20, 11.43], axes: { x: 'x [m]', y: 'y [m]', grid: false }, clip: true,
      children: [
        { type: 'plot', fn: 'u*tan(rad(kat)) - 9.81*u^2/(2*(v0*cos(rad(kat)))^2)', var: 'u', from: 0, to: '=zasieg*0.3', samples: 20, stroke: 'muted/70', width: 1.5, show: 't == 0' },
        { type: 'trace', fx: 'x', fy: 'y', keep: 300, every: 0.02, stroke: 'accent', width: 2 },
        { type: 'rect', x: '=cel - 0.6', y: 0, w: 1.2, h: 0.4, fill: 'ok/70', drag: { x: 'cel', label: 'Cel — przeciągnij' }, label: 'Cel' },
        { type: 'line', x: '=cel', y: 0.4, x2: '=cel', y2: 1.6, stroke: 'ok', width: 1.5, motion: { name: 'draw', duration: 1200 } },
        { type: 'poly', points: [['=cel', 1.6], ['=cel + 0.8', 1.35], ['=cel', 1.1]], closed: true, fill: 'ok' },
        { type: 'arrow', x: 0, y: 0, x2: '=2*cos(rad(kat))', y2: '=2*sin(rad(kat))', head: 7, stroke: 'ink', width: 2, show: 't == 0' },
        { type: 'use', use: 'kropka', x: '=x', y: '=y' },
        { type: 'circle', x: '=i*2 + 1', y: -0.2, r: 1.5, fill: 'muted/40', repeat: 10 }
      ]
    },
    { type: 'text', x: 170, y: 194, text: 'kąt {fmt(kat, 0)}°', size: 9, fill: 'muted', motion: { name: 'rise', delay: 400 } },
    {
      type: 'circle', x: 300, y: 20, r: 6, fill: 'none', stroke: 'accent', width: 1.5, tap: { do: 'reset', label: 'Od nowa' },
      motion: { name: 'keys', duration: 1800, repeat: 'loop', keys: [{ at: 0, scale: 0.8, opacity: 0.5 }, { at: 0.5, scale: 1, opacity: 1 }, { at: 1, scale: 0.8, opacity: 0.5 }] }
    }
  ]
};

const LIVE_DOCS = {
  vars: {
    '[].name': 'Nazwa (litery, cyfry, _; nie zaczyna się cyfrą) — używana w wyrażeniach',
    '[].value': 'Wartość na start',
    '[].min': 'Najmniej', '[].max': 'Najwięcej',
    '[].step': 'Krok suwaka i przeciągania',
    '[].unit': 'Jednostka ("°", "m/s" …)',
    '[].label': 'Podpis przy suwaku',
    '[].random': 'Przy każdym otwarciu (w Cogita: przy każdej próbie) losowa wartość z [od, do]'
  },
  let: { '[].name': 'Nazwa wartości liczonej', '[].value': 'Wyrażenie (z innych nazw)' },
  sim: {
    '.state': 'Wielkości symulacji (do 24)',
    '.state[].name': 'Nazwa wielkości (np. "y")',
    '.state[].value': 'Wartość na start (wyrażenie)',
    '.state[].rate': 'Tempo zmiany — pochodna po czasie (wyrażenie; np. "vy" dla y, "-g" dla vy)',
    '.events': 'Zdarzenia: gdy warunek STAJE SIĘ prawdziwy',
    '.events[].when': 'Warunek (np. "y < 0 && vy < 0")',
    '.events[].set': 'Nowe wartości, liczone naraz: { "vy": "-e*vy" }',
    '.events[].set.vy': 'np. nowa prędkość po odbiciu — klucz to nazwa wielkości albo zmiennej',
    '.events[].stop': 'true — symulacja się kończy',
    '.events[].say': 'Napis pod rysunkiem ({…} — liczone)',
    '.events[].mood': `Wygląd napisu: ${MOODS.map((m) => `"${m}"`).join(', ')}`,
    '.until': 'Warunek końca (np. "t > 5")',
    '.dt': 'Krok obliczeń w sekundach (0.001–0.005)',
    '.speed': 'Tempo względem zegara (1 — jak w rzeczywistości)',
    '.auto': 'true — rusza sama, gdy rysunek widać',
    '.loop': 'true — po końcu zaczyna od nowa',
    '.max': 'Najdłużej (sekundy symulacji)'
  },
  controls: {
    '[].type': `Rodzaj: ${CONTROL_TYPES.map((t) => `"${t}"`).join(', ')}`,
    '[].var': 'Zmienna, którą ustawia (slider, number, toggle, choice)',
    '[].label': 'Podpis (domyślnie podpis zmiennej)',
    '[].unit': 'Jednostka przy wartości',
    '[].digits': 'Ile miejsc po przecinku',
    '[].options': 'choice — możliwości [{ "value", "label" }]',
    '[].options[].value': 'Wartość, którą dostaje zmienna',
    '[].options[].label': 'Napis na przycisku',
    '[].do': `button — co robi z symulacją: ${ACTIONS.map((a) => `"${a}"`).join(', ')}`,
    '[].set': 'button — zmienne do ustawienia: { "nazwa": "wyrażenie" }',
    '[].go': 'button — w prezentacji: "next", "back", klucz sceny, "link:<id>"',
    '[].value': 'readout — wyrażenie do pokazania'
  },
  rules: {
    '[].when': 'Warunek — reguła działa, gdy STAJE SIĘ prawdziwy',
    '[].set': 'Zmienne albo wielkości do ustawienia: { "nazwa": "wyrażenie" }',
    '[].do': `Co robi z symulacją: ${ACTIONS.map((a) => `"${a}"`).join(', ')}`,
    '[].go': 'W prezentacji: dokąd dalej — "next", "back", klucz sceny, "link:<id>"',
    '[].say': 'Napis pod rysunkiem ({…} — liczone)',
    '[].mood': `Wygląd napisu: ${MOODS.map((m) => `"${m}"`).join(', ')}`,
    '[].goal': 'true — to jest cel zadania (w Cogita: dobra odpowiedź)',
    '[].once': 'true — tylko raz, aż do „od nowa”'
  }
} as const;

export const animationPart = definePart<Config>({
  kind: 'animation',
  label: 'Animacja',
  use: 'Rysunek, który się rusza albo który można poruszać: kształty, linie, wykresy, wektory — z ruchem, suwakami, przeciąganiem i symulacją fizyki (np. rzut, wahadło, sprężyna). Także obrazy pokazu Cogita.',
  box: { colSpan: 3, rowSpan: 3 },

  example: Object.fromEntries(Object.entries(EXAMPLE).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])),
  fields: [],
  extra: [
    { key: 'alt', shape: 'line', says: 'Opis rysunku dla czytników ekranu (pusty — rysunek tylko ozdobny)' },
    { key: 'size', shape: 'json', says: 'Wielkość rysunku w jego jednostkach: [szerokość, wysokość] — rysunek rośnie i maleje jako całość z modułem' },
    { key: 'max', shape: 'json', says: 'Najwyżej tyle szerokości w rem (liczba); pominięte — cała szerokość modułu' },
    { key: 'panel', shape: 'line', says: 'Gdzie sterowanie: "below" (pod rysunkiem, zwykle) albo "side" (obok, gdy rysunek jest szeroki; na telefonie zawsze pod)' },
    { key: 'vars', shape: 'json', says: 'Wartości do ustawiania (suwak, przełącznik, przeciąganie): [{ "name", "value", "min", "max", "step", "unit", "label", "random" }]', inside: LIVE_DOCS.vars },
    { key: 'let', shape: 'json', says: 'Wartości liczone z innych, w każdej klatce, w tej kolejności: [{ "name", "value": "wyrażenie" }]', inside: LIVE_DOCS.let },
    { key: 'sim', shape: 'json', says: 'Symulacja (równania ruchu, Runge-Kutta): { "state": [{ "name", "value", "rate" }], "events", "until", "dt", "speed", "auto", "loop", "max" }', inside: LIVE_DOCS.sim },
    { key: 'controls', shape: 'json', says: 'Sterowanie pod rysunkiem: suwaki, przełączniki, wybór, przyciski, odczyty', inside: LIVE_DOCS.controls },
    { key: 'rules', shape: 'json', says: 'Reguły: gdy warunek staje się prawdziwy — napis, cel zadania, ustawienie, start/pauza, dalej w prezentacji', inside: LIVE_DOCS.rules },
    {
      key: 'symbols', shape: 'json', says: 'Części do wielokrotnego użycia: [{ "name": "fiszka", "shapes": [elementy] }] — wstawia je element { "type": "use", "use": "fiszka" }',
      inside: { '[].name': 'Nazwa części', '[].shapes': 'Elementy części (jak w "elements")', ...relative(shapeDocs('symbols[].shapes[]'), 'symbols') }
    },
    {
      key: 'elements', shape: 'json', says: 'Elementy rysunku, od tyłu do przodu — każdy z położeniem, wyglądem, ruchem ("motion") i — do poruszania — wyrażeniami, "drag", "tap", "show", "repeat"',
      inside: relative(shapeDocs('elements[]'), 'elements')
    }
  ],

  read,
  hasContent: (c) => readDrawing(c.raw).elements.length > 0,
  missing: (c) => (readDrawing(c.raw).elements.length === 0 ? 'Rysunek nie ma jeszcze żadnego elementu.' : null),
  shows: (c, size) => size.height === 'strip'
    ? `Rysunek (${sum(c.raw)}) — mały, nieruchomy, bez sterowania.`
    : `Rysunek (${sum(c.raw)}) w ruchu, na całą szerokość modułu${readDrawing(c.raw).live === null ? '' : ', ze sterowaniem pod spodem'}.`,
  Editor: AnimationEditor,
  View: ({ config, ctx }) => <AnimationView raw={config.raw} strip={ctx.size.height === 'strip'} />
});
