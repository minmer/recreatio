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

import { aboutOf, useStoryGoal } from '../presentation/storyCard';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { drawingIdentity, drawingOf, LIVE_KEYS, motionCount, needsLive, readDrawing, shapeCount, SHAPE_TYPES } from '../motion/drawing';
import { DrawingView } from '../motion/DrawingView';
import { MOTION_NAMES } from '../motion/motion';
import { ACTIONS, CONTROL_TYPES, MOODS } from '../motion/liveModel';
import type { Problem } from '../motion/liveRun';
import type { LiveExample } from '../motion/liveExamples';
import { definePart, type EditorProps, type RawConfig } from '../part';
import { t, useT, type T } from '../../core/i18n';
import { later } from '../../ui/later';

interface Config {
  readonly raw: RawConfig;
}

const read = (raw: RawConfig): Config => ({ raw });

/** Was eine Zeichnung ist: ihre Teile, ihre Bewegungen — und ob man sie anfassen kann. */
const sum = (raw: RawConfig, tt: T | typeof t = t): string => {
  const d = readDrawing(raw);
  const parts = [tt('moduleContent.animation.sum.elements', { count: shapeCount(d) }), tt('moduleContent.animation.sum.motions', { count: motionCount(d) })];
  if (d.live !== null) {
    parts.push(tt('moduleContent.animation.sum.vars', { count: d.live.vars.length }));
    if (d.live.sim !== null) parts.push(tt('moduleContent.animation.sum.sim'));
    if (d.live.rules.some((r) => r.goal)) parts.push(tt('moduleContent.animation.sum.goal'));
  }
  return parts.join(', ');
};

function AnimationView({ raw, strip, moduleId }: { raw: RawConfig; strip: boolean; moduleId: string }) {
  const t = useT();
  const identity = drawingIdentity(raw);
  /* 2026-11-03 (G) — ein Ziel des Bildes (eine Regel mit "goal": true) zählt in einer Erzählung wie eine richtige Antwort. */
  const onGoal = useStoryGoal(raw.question ?? '', aboutOf(raw.about), moduleId, raw.alt ?? t('moduleContent.animation.drawing'));
  const drawing = useMemo(() => readDrawing(raw), [identity]); // eslint-disable-line react-hooks/exhaustive-deps
  if (drawing.elements.length === 0) return <p className="wk-card-muted">{t('moduleContent.animation.empty')}</p>;
  const sized = (drawing.max === null ? undefined : { '--an-max': `${drawing.max}rem` }) as CSSProperties | undefined;
  return (
    <div className={`an${strip ? ' is-strip' : ''}`} style={sized}>
      <DrawingView drawing={drawing} identity={identity} still={strip} {...(onGoal === undefined ? {} : { onGoal })} />
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
  const t = useT();
  const [text, setText] = useState(() => JSON.stringify(docOf(raw), null, 2));
  const [said, setSaid] = useState<string | null>(null);
  const [problems, setProblems] = useState<readonly Problem[]>([]);
  const [examples, setExamples] = useState<readonly LiveExample[] | null>(null);

  const draft = useMemo(() => {
    try {
      const value = JSON.parse(text) as unknown;
      return typeof value === 'object' && value !== null && !Array.isArray(value) ? { value: value as Record<string, unknown> } : { error: t('moduleContent.animation.notObject') };
    } catch (e) {
      return { error: t('moduleContent.animation.badJson', { error: e instanceof Error ? e.message : '' }) };
    }
  }, [text, t]);
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
      vars: json('vars'), let: json('let'), sim: json('sim'), controls: json('controls'), rules: json('rules'), world: json('world'), predict: json('predict'), task: json('task'),
      panel: typeof value.panel === 'string' ? value.panel : '',
      ...(typeof value.alt === 'string' ? { alt: value.alt } : {}),
      ...(typeof value.max === 'number' ? { max: String(value.max) } : {})
    };
    onSet(next);
    setSaid(t('moduleContent.animation.accepted', { sum: sum(next, t) }));
  };

  const copyPrompt = () => {
    void import('../motion/liveText').then(async (mod) => {
      const ex = (await import('../motion/liveExamples')).LIVE_EXAMPLES[0];
      await navigator.clipboard.writeText(mod.livePrompt(ex.drawing));
      setSaid(t('moduleContent.animation.promptCopied'));
    }).catch(() => setSaid(t('moduleContent.animation.promptFailed')));
  };

  return (
    <div className="an-edit">
      <label className="se-inline">
        <span>{t('moduleContent.animation.alt')}</span>
        <input value={raw.alt ?? ''} disabled={busy} maxLength={200} onChange={(e) => onSet({ alt: e.target.value })} />
      </label>
      <label className="se-inline">
        <span>{t('moduleContent.animation.max')}</span>
        <input type="number" min={2} max={200} value={raw.max ?? ''} placeholder={t('moduleContent.animation.fullWidth')} disabled={busy}
          onChange={(e) => onSet({ max: e.target.value.trim() === '' ? '' : String(Number(e.target.value)) })} />
      </label>
      <p className="wk-hint">{t('moduleContent.animation.hint', { sum: sum(raw, t) })}</p>
      <div className="wk-actions">
        <select aria-label={t('moduleContent.animation.insertExample')} value="" disabled={busy} onFocus={loadExamples} onPointerDown={loadExamples}
          onChange={(e) => {
            const one = examples?.find((x) => x.key === e.target.value);
            if (one !== undefined) { setText(JSON.stringify(one.drawing, null, 2)); setSaid(t('moduleContent.animation.exampleLoaded', { title: one.title })); }
          }}>
          <option value="">{t('moduleContent.animation.insertPhysics')}</option>
          {(examples ?? []).map((x) => <option key={x.key} value={x.key}>{x.title} — {x.says}</option>)}
        </select>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={copyPrompt}>{t('moduleContent.animation.copyPrompt')}</button>
      </div>
      <textarea className="an-edit-json" rows={14} value={text} spellCheck={false} disabled={busy} aria-label={t('moduleContent.animation.json')} onChange={(e) => setText(e.target.value)} />
      {'error' in draft && <p className="wk-error">{draft.error}</p>}
      {drawing !== null && drawing.elements.length > 0 && (
        <div className="an-preview" aria-label={t('moduleContent.animation.preview')}>
          {live
            ? <LivePreview drawing={drawing} identity={text} />
            : <DrawingView drawing={drawing} identity={text} />}
        </div>
      )}
      {live && problems.length > 0 && (
        <ul className="an-problems" aria-label={t('moduleContent.animation.problems')}>
          {problems.slice(0, 12).map((p, i) => <li key={i}>{p.where}: {p.error}{p.source === '' ? '' : <> — <code>{p.source}</code></>}</li>)}
        </ul>
      )}
      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" disabled={busy || !('value' in draft)} onClick={apply}>{t('moduleContent.animation.apply')}</button>
        {said !== null && <span className="wk-hint" role="status">{said}</span>}
      </div>
    </div>
  );
}

/* -- Die Beschreibung der Teile — für jede Stelle, an der ein Teil stehen kann ---------------- */

const SHAPE_KEYS: Readonly<Record<string, string>> = {
  type: `moduleContent.animation.lead.type: ${SHAPE_TYPES.map((one) => `"${one}"`).join(', ')} — moduleContent.animation.shape.typeMore`,
  x: 'moduleContent.animation.shape.x',
  y: 'moduleContent.animation.shape.y',
  w: 'moduleContent.animation.shape.w',
  h: 'moduleContent.animation.shape.h',
  r: 'moduleContent.animation.shape.r',
  x2: 'moduleContent.animation.shape.x2',
  y2: 'moduleContent.animation.shape.y2',
  d: 'moduleContent.animation.shape.d',
  text: 'moduleContent.animation.shape.text',
  size: 'moduleContent.animation.shape.size',
  weight: 'moduleContent.animation.shape.weight',
  anchor: 'moduleContent.animation.shape.anchor',
  url: 'moduleContent.animation.shape.url',
  use: 'moduleContent.animation.shape.use',
  fill: 'moduleContent.animation.shape.fill',
  stroke: 'moduleContent.animation.shape.stroke',
  width: 'moduleContent.animation.shape.width',
  cap: 'moduleContent.animation.shape.cap',
  opacity: 'moduleContent.animation.shape.opacity',
  blur: 'moduleContent.animation.shape.blur',
  glow: 'moduleContent.animation.shape.glow',
  origin: 'moduleContent.animation.shape.origin',
  scale: 'moduleContent.animation.shape.scale',
  rotate: 'moduleContent.animation.shape.rotate',
  children: 'moduleContent.animation.shape.children',
  shift: 'moduleContent.animation.shape.shift',
  motion: 'moduleContent.animation.shape.motion',
  show: 'moduleContent.animation.shape.show',
  drag: 'moduleContent.animation.shape.drag',
  'drag.x': 'moduleContent.animation.shape.dragX',
  'drag.y': 'moduleContent.animation.shape.dragY',
  'drag.set': 'moduleContent.animation.shape.dragSet',
  'drag.label': 'moduleContent.animation.shape.dragLabel',
  tap: 'moduleContent.animation.shape.tap',
  'tap.set': 'moduleContent.animation.shape.tapSet',
  'tap.do': `moduleContent.animation.lead.do: ${ACTIONS.map((a) => `"${a}"`).join(', ')}`,
  'tap.go': 'moduleContent.animation.shape.tapGo',
  'tap.label': 'moduleContent.animation.shape.tapLabel',
  repeat: 'moduleContent.animation.shape.repeat',
  label: 'moduleContent.animation.shape.label',
  head: 'moduleContent.animation.shape.head',
  points: 'moduleContent.animation.shape.points',
  closed: 'moduleContent.animation.shape.closed',
  fn: 'moduleContent.animation.shape.fn',
  fx: 'moduleContent.animation.shape.fx',
  fy: 'moduleContent.animation.shape.fy',
  var: 'moduleContent.animation.shape.var',
  from: 'moduleContent.animation.shape.from',
  to: 'moduleContent.animation.shape.to',
  samples: 'moduleContent.animation.shape.samples',
  keep: 'moduleContent.animation.shape.keep',
  every: 'moduleContent.animation.shape.every',
  view: 'moduleContent.animation.shape.view',
  axes: 'moduleContent.animation.shape.axes',
  'axes.x': 'moduleContent.animation.shape.axesX',
  'axes.y': 'moduleContent.animation.shape.axesY',
  'axes.grid': 'moduleContent.animation.shape.axesGrid',
  clip: 'moduleContent.animation.shape.clip',
  camera: 'moduleContent.animation.shape.camera'
};

const MOTION_KEYS: Readonly<Record<string, string>> = {
  name: `moduleContent.animation.lead.motionName: ${MOTION_NAMES.map((n) => `"${n}"`).join(', ')}`,
  duration: 'moduleContent.animation.motion.duration',
  delay: 'moduleContent.animation.motion.delay',
  repeat: 'moduleContent.animation.motion.repeat',
  ease: 'moduleContent.animation.motion.ease',
  unit: 'moduleContent.animation.motion.unit',
  from: 'moduleContent.animation.motion.from',
  to: 'moduleContent.animation.motion.to',
  path: 'moduleContent.animation.motion.path',
  times: 'moduleContent.animation.motion.times',
  keys: 'moduleContent.animation.motion.keys',
  length: 'moduleContent.animation.motion.length',
  /* 2026-10-27 — gelesen seit 2026-10-19 (`motion.ts`), aber hier nicht beschrieben: die Vorschau für Assistenten fand es. */
  by: 'moduleContent.animation.motion.by'
};

const KEY_KEYS: Readonly<Record<string, string>> = {
  at: 'moduleContent.animation.frame.at',
  x: 'moduleContent.animation.frame.x', y: 'moduleContent.animation.frame.y',
  scale: 'moduleContent.animation.frame.scale', sx: 'moduleContent.animation.frame.sx', sy: 'moduleContent.animation.frame.sy',
  rotate: 'moduleContent.animation.frame.rotate', opacity: 'moduleContent.animation.frame.opacity', blur: 'moduleContent.animation.frame.blur',
  draw: 'moduleContent.animation.frame.draw', color: 'moduleContent.animation.frame.color', stroke: 'moduleContent.animation.frame.stroke',
  glow: 'moduleContent.animation.frame.glow', reveal: 'moduleContent.animation.frame.reveal', clip: 'moduleContent.animation.frame.clip',
  ease: 'moduleContent.animation.frame.ease'
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
  alt: 'Rzut — ustaw kąt, wybierz prędkość i trafiaj w cel', // i18n-ignore
  question: '<puste albo @kurs/pytanie z bazy opowieści>', // i18n-ignore
  about: '@kurs/rzut-ukosny',
  size: [320, 200],
  max: 32,
  panel: 'below',
  vars: [
    { name: 'kat', value: 45, min: 5, max: 85, step: 1, unit: '°', label: 'Kąt' }, // i18n-ignore
    { name: 'v0', value: 10, min: 4, max: 14, step: 0.5, unit: 'm/s', label: 'Prędkość' }, // i18n-ignore
    { name: 'cel', value: 10, min: 3, max: 19, step: 0.5, unit: 'm', label: 'Cel', random: [6, 16] } // i18n-ignore
  ],
  let: [{ name: 'zasieg', value: 'v0^2*sin(rad(2*kat))/9.81' }],
  sim: {
    state: [
      { name: 'x', value: 0, rate: 'vx' },
      { name: 'y', value: 0, rate: 'vy' },
      { name: 'vx', value: 'v0*cos(rad(kat))', rate: 0 },
      { name: 'vy', value: 'v0*sin(rad(kat))', rate: -9.81 }
    ],
    events: [{ when: 'y < 0 && vy < 0', set: { vy: 0 }, stop: true, say: 'Spadła po {fmt(t, 1)} s.', mood: 'info' }], // i18n-ignore
    until: 't > 6', dt: 0.002, speed: 1, auto: false, loop: false, max: 30
  },
  controls: [
    { type: 'slider', var: 'kat', label: 'Kąt', unit: '°', digits: 0 }, // i18n-ignore
    { type: 'choice', var: 'v0', label: 'Prędkość', options: [{ value: 8, label: 'wolno' }, { value: 10, label: 'średnio' }, { value: 13, label: 'szybko' }] }, // i18n-ignore
    { type: 'button', label: 'Rzuć', do: 'run', go: 'next' }, // i18n-ignore
    { type: 'readout', label: 'Zasięg', value: 'zasieg', unit: 'm', digits: 1 } // i18n-ignore
  ],
  rules: [{ when: 'abs(x - cel) < 0.6 && y <= 0 && t > 0', say: 'Trafione z {fmt(kat, 0)}°!', mood: 'ok', goal: true, once: true, do: 'pause' }], // i18n-ignore
  /* 2026-10-18 — erst vermuten: „Przewiduj" hält den Wurf an, „Sprawdź" lässt ihn los. */
  predict: { start: false, say: 'Ustaw kąt i prędkość tak, jak przewidujesz — potem „Sprawdź”.', check: 'Sprawdź', again: 'Popraw', hold: 'Przewiduj' }, // i18n-ignore
  /* 2026-10-18 — jedes Mal ein anderes Ziel, gleich schwer: nicht dort, wo 45° ohnehin hinwerfen, und mit „średnio" erreichbar. */
  task: { require: ['abs(zasieg - cel) > 1.5', 'cel*9.81 <= v0^2'], solve: 'kat = deg(asin(cel*9.81/v0^2))/2', new: 'Nowy cel', tries: 100 },
  /* 2026-10-18 — eine kleine Welt: Kisten am Boden, die man zieht, kopiert, wegnimmt (höchstens drei). */
  world: {
    kinds: [{
      name: 'skrzynka',
      label: 'Skrzynka', // i18n-ignore
      props: [{ name: 'pos', value: 16, min: 1, max: 19, step: 0.5, unit: 'm', label: 'Położenie', apart: 1.5, new: 'max(things, pos) - 2', when: 'isroot', quiet: false }], // i18n-ignore
      let: [{ name: 'x', value: 'pos' }, { name: 'y', value: 0.4 }, { name: 'hit', value: 6 }],
      shapes: [{ type: 'rect', x: '=x - 0.6', y: 0, w: 1.2, h: 0.8, fill: "=selected ? 'accent/60' : (can ? 'muted/50' : 'muted/25')" }],
      drag: { pos: 'px' },
      can: { edit: ['pos'], add: [], remove: true, copy: true },
      readouts: [{ label: 'Do celu', value: 'pos - cel', unit: 'm', digits: 1 }], // i18n-ignore
      children: 0,
      brief: '{pos} m',
      mark: true
    }],
    things: [{ id: 's1', kind: 'skrzynka', parent: null, pos: '=min(19, cel + 4)', lock: [] }],
    allow: { add: true, remove: true, copy: true, edit: true, drag: true, roots: ['skrzynka'] },
    limits: { things: 4, depth: 1 },
    keep: [{ when: 'nthings <= 3', say: 'Najwyżej trzy skrzynki.' }], // i18n-ignore
    save: false,
    hint: 'Skrzynkę przeciągnij; dotknij jej, żeby powielić albo usunąć.', // i18n-ignore
    list: false
  },
  symbols: [{ name: 'kropka', shapes: [{ type: 'circle', x: 0, y: 0, r: 4, fill: 'accent', glow: '0 0 6px accent/60', motion: { name: 'breathe', duration: 1600 } }] }],
  elements: [
    {
      type: 'frame', x: 30, y: 10, w: 280, h: 160, view: [0, 0, 20, 11.43], axes: { x: 'x [m]', y: 'y [m]', grid: false }, clip: true,
      children: [
        { type: 'plot', fn: 'u*tan(rad(kat)) - 9.81*u^2/(2*(v0*cos(rad(kat)))^2)', var: 'u', from: 0, to: '=zasieg*0.3', samples: 20, stroke: 'muted/70', width: 1.5, show: 't == 0' },
        { type: 'trace', fx: 'x', fy: 'y', keep: 300, every: 0.02, stroke: 'accent', width: 2 },
        { type: 'rect', x: '=cel - 0.6', y: 0, w: 1.2, h: 0.4, fill: 'ok/70', drag: { x: 'cel', label: 'Cel — przeciągnij' }, label: 'Cel' }, // i18n-ignore
        { type: 'line', x: '=cel', y: 0.4, x2: '=cel', y2: 1.6, stroke: 'ok', width: 1.5, motion: { name: 'draw', duration: 1200 } },
        { type: 'poly', points: [['=cel', 1.6], ['=cel + 0.8', 1.35], ['=cel', 1.1]], closed: true, fill: 'ok' },
        { type: 'arrow', x: 0, y: 0, x2: '=2*cos(rad(kat))', y2: '=2*sin(rad(kat))', head: 7, stroke: 'ink', width: 2, show: 't == 0' },
        { type: 'use', use: 'kropka', x: '=x', y: '=y' },
        { type: 'circle', x: '=i*2 + 1', y: -0.2, r: 1.5, fill: 'muted/40', repeat: 10 },
        { type: 'world' }
      ]
    },
    { type: 'text', x: 170, y: 194, text: 'kąt {fmt(kat, 0)}°', size: 9, fill: 'muted', motion: { name: 'rise', delay: 400 } }, // i18n-ignore
    {
      type: 'circle', x: 300, y: 20, r: 6, fill: 'none', stroke: 'accent', width: 1.5, tap: { do: 'reset', label: 'Od nowa' }, // i18n-ignore
      motion: { name: 'keys', duration: 1800, repeat: 'loop', keys: [{ at: 0, scale: 0.8, opacity: 0.5 }, { at: 0.5, scale: 1, opacity: 1 }, { at: 1, scale: 0.8, opacity: 0.5 }] }
    }
  ]
};

const LIVE_DOCS = {
  vars: {
    '[].name': 'moduleContent.animation.vars.name',
    '[].value': 'moduleContent.animation.vars.value',
    '[].min': 'moduleContent.animation.vars.min', '[].max': 'moduleContent.animation.vars.max',
    '[].step': 'moduleContent.animation.vars.step',
    '[].unit': 'moduleContent.animation.vars.unit',
    '[].label': 'moduleContent.animation.vars.label',
    '[].random': 'moduleContent.animation.vars.random'
  },
  let: { '[].name': 'moduleContent.animation.let.name', '[].value': 'moduleContent.animation.let.value' },
  sim: {
    '.state': 'moduleContent.animation.sim.state',
    '.state[].name': 'moduleContent.animation.sim.stateName',
    '.state[].value': 'moduleContent.animation.sim.stateValue',
    '.state[].rate': 'moduleContent.animation.sim.stateRate',
    '.events': 'moduleContent.animation.sim.events',
    '.events[].when': 'moduleContent.animation.sim.eventsWhen',
    '.events[].set': 'moduleContent.animation.sim.eventsSet',
    '.events[].set.vy': 'moduleContent.animation.sim.eventsSetVy',
    '.events[].stop': 'moduleContent.animation.sim.eventsStop',
    '.events[].say': 'moduleContent.animation.sim.eventsSay',
    '.events[].mood': `moduleContent.animation.lead.mood: ${MOODS.map((m) => `"${m}"`).join(', ')}`,
    '.until': 'moduleContent.animation.sim.until',
    '.dt': 'moduleContent.animation.sim.dt',
    '.speed': 'moduleContent.animation.sim.speed',
    '.auto': 'moduleContent.animation.sim.auto',
    '.loop': 'moduleContent.animation.sim.loop',
    '.max': 'moduleContent.animation.sim.max',
    '.sleep': 'moduleContent.animation.sim.sleep'
  },
  controls: {
    '[].type': `moduleContent.animation.lead.type: ${CONTROL_TYPES.map((one) => `"${one}"`).join(', ')}`,
    '[].var': 'moduleContent.animation.controls.var',
    '[].label': 'moduleContent.animation.controls.label',
    '[].unit': 'moduleContent.animation.controls.unit',
    '[].digits': 'moduleContent.animation.controls.digits',
    '[].options': 'moduleContent.animation.controls.options',
    '[].options[].value': 'moduleContent.animation.controls.optionsValue',
    '[].options[].label': 'moduleContent.animation.controls.optionsLabel',
    '[].do': `moduleContent.animation.lead.buttonDo: ${ACTIONS.map((a) => `"${a}"`).join(', ')}`,
    '[].set': 'moduleContent.animation.controls.set',
    '[].go': 'moduleContent.animation.controls.go',
    '[].value': 'moduleContent.animation.controls.value',
    '[].show': 'moduleContent.animation.controls.show'
  },
  rules: {
    '[].when': 'moduleContent.animation.rules.when',
    '[].set': 'moduleContent.animation.rules.set',
    '[].do': `moduleContent.animation.lead.do: ${ACTIONS.map((a) => `"${a}"`).join(', ')}`,
    '[].go': 'moduleContent.animation.rules.go',
    '[].say': 'moduleContent.animation.rules.say',
    '[].mood': `moduleContent.animation.lead.mood: ${MOODS.map((m) => `"${m}"`).join(', ')}`,
    '[].goal': 'moduleContent.animation.rules.goal',
    '[].once': 'moduleContent.animation.rules.once',
    '[].for': 'moduleContent.animation.rules.for'
  }
} as const;

/** 2026-10-18 — erst vermuten, dann sehen (`motion/liveModel.ts`: `predict`). */
const PREDICT_DOCS: Readonly<Record<string, string>> = {
  '.start': 'moduleContent.animation.predict.start',
  '.say': 'moduleContent.animation.predict.say',
  '.check': 'moduleContent.animation.predict.check',
  '.again': 'moduleContent.animation.predict.again',
  '.hold': 'moduleContent.animation.predict.hold'
};

/** 2026-10-18 — jedes Mal eine andere Aufgabe, gleich schwer (`motion/liveModel.ts`: `task`, `motion/liveTask.ts`). */
const TASK_DOCS: Readonly<Record<string, string>> = {
  '.require': 'moduleContent.animation.task.require',
  '.solve': 'moduleContent.animation.task.solve',
  '.new': 'moduleContent.animation.task.new',
  '.tries': 'moduleContent.animation.task.tries'
};

/**
 * 2026-10-18 — DER WELT (`motion/liveModel.ts`): Arten von Dingen, die Dinge
 * am Anfang, und was in dieser Welt erlaubt ist — die Waage, Zahnräder, ein
 * Mobile sind Dokumente in diesem Format (`motion/liveWorlds.ts`).
 */
const WORLD_DOCS: Readonly<Record<string, string>> = {
  '.kinds': 'moduleContent.animation.world.kinds',
  '.kinds[].name': 'moduleContent.animation.world.kindsName',
  '.kinds[].label': 'moduleContent.animation.world.kindsLabel',
  '.kinds[].props': 'moduleContent.animation.world.kindsProps',
  '.kinds[].props[].name': 'moduleContent.animation.world.kindsPropsName',
  '.kinds[].props[].value': 'moduleContent.animation.world.kindsPropsValue',
  '.kinds[].props[].min': 'moduleContent.animation.world.kindsPropsMin',
  '.kinds[].props[].max': 'moduleContent.animation.world.kindsPropsMax',
  '.kinds[].props[].step': 'moduleContent.animation.world.kindsPropsStep',
  '.kinds[].props[].unit': 'moduleContent.animation.world.kindsPropsUnit',
  '.kinds[].props[].label': 'moduleContent.animation.world.kindsPropsLabel',
  '.kinds[].props[].apart': 'moduleContent.animation.world.kindsPropsApart',
  '.kinds[].props[].new': 'moduleContent.animation.world.kindsPropsNew',
  '.kinds[].props[].when': 'moduleContent.animation.world.kindsPropsWhen',
  '.kinds[].props[].quiet': 'moduleContent.animation.world.kindsPropsQuiet',
  '.kinds[].let': 'moduleContent.animation.world.kindsLet',
  '.kinds[].let[].name': 'moduleContent.animation.world.kindsLetName',
  '.kinds[].let[].value': 'moduleContent.animation.world.kindsLetValue',
  '.kinds[].state': 'moduleContent.animation.world.kindsState',
  '.kinds[].state[].name': 'moduleContent.animation.world.kindsStateName',
  '.kinds[].state[].value': 'moduleContent.animation.world.kindsStateValue',
  '.kinds[].state[].rate': 'moduleContent.animation.world.kindsStateRate',
  '.kinds[].events': 'moduleContent.animation.world.kindsEvents',
  '.kinds[].events[].when': 'moduleContent.animation.world.kindsEventsWhen',
  '.kinds[].events[].set': 'moduleContent.animation.world.kindsEventsSet',
  '.kinds[].events[].say': 'moduleContent.animation.world.kindsEventsSay',
  '.kinds[].events[].mood': `moduleContent.animation.lead.mood: ${MOODS.map((m) => `"${m}"`).join(', ')}`,
  '.kinds[].shapes': 'moduleContent.animation.world.kindsShapes',
  '.kinds[].drag': 'moduleContent.animation.world.kindsDrag',
  '.kinds[].drag.pos': 'moduleContent.animation.world.kindsDragPos',
  '.kinds[].tap': 'moduleContent.animation.world.kindsTap',
  '.kinds[].can': 'moduleContent.animation.world.kindsCan',
  '.kinds[].can.edit': 'moduleContent.animation.world.kindsCanEdit',
  '.kinds[].can.add': 'moduleContent.animation.world.kindsCanAdd',
  '.kinds[].can.remove': 'moduleContent.animation.world.kindsCanRemove',
  '.kinds[].can.copy': 'moduleContent.animation.world.kindsCanCopy',
  '.kinds[].readouts': 'moduleContent.animation.world.kindsReadouts',
  '.kinds[].readouts[].label': 'moduleContent.animation.world.kindsReadoutsLabel',
  '.kinds[].readouts[].value': 'moduleContent.animation.world.kindsReadoutsValue',
  '.kinds[].readouts[].unit': 'moduleContent.animation.world.kindsReadoutsUnit',
  '.kinds[].readouts[].digits': 'moduleContent.animation.world.kindsReadoutsDigits',
  '.kinds[].readouts[].show': 'moduleContent.animation.world.kindsReadoutsShow',
  '.kinds[].children': 'moduleContent.animation.world.kindsChildren',
  '.kinds[].brief': 'moduleContent.animation.world.kindsBrief',
  '.kinds[].mark': 'moduleContent.animation.world.kindsMark',
  '.things': 'moduleContent.animation.world.things',
  '.things[].id': 'moduleContent.animation.world.thingsId',
  '.things[].kind': 'moduleContent.animation.world.thingsKind',
  '.things[].parent': 'moduleContent.animation.world.thingsParent',
  '.things[].lock': 'moduleContent.animation.world.thingsLock',
  '.things[].pos': 'moduleContent.animation.world.thingsPos',
  '.allow': 'moduleContent.animation.world.allow',
  '.allow.add': 'moduleContent.animation.world.allowAdd',
  '.allow.remove': 'moduleContent.animation.world.allowRemove',
  '.allow.copy': 'moduleContent.animation.world.allowCopy',
  '.allow.edit': 'moduleContent.animation.world.allowEdit',
  '.allow.drag': 'moduleContent.animation.world.allowDrag',
  '.allow.roots': 'moduleContent.animation.world.allowRoots',
  '.limits': 'moduleContent.animation.world.limits',
  '.limits.things': 'moduleContent.animation.world.limitsThings',
  '.limits.depth': 'moduleContent.animation.world.limitsDepth',
  '.keep': 'moduleContent.animation.world.keep',
  '.keep[].when': 'moduleContent.animation.world.keepWhen',
  '.keep[].say': 'moduleContent.animation.world.keepSay',
  '.save': 'moduleContent.animation.world.save',
  '.hint': 'moduleContent.animation.world.hint',
  '.list': 'moduleContent.animation.world.list'
};

export const animationPart = definePart<Config>({
  kind: 'animation',
  label: 'moduleContent.animation.label',
  use: 'moduleContent.animation.use',
  box: { colSpan: 3, rowSpan: 3 },

  example: Object.fromEntries(Object.entries(EXAMPLE).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])),
  fields: [],
  extra: [
    { key: 'alt', shape: 'line', says: 'moduleContent.animation.key.alt' },
    { key: 'question', shape: 'line', says: 'moduleContent.animation.key.question' },
    { key: 'about', shape: 'lines', says: 'moduleContent.animation.key.about' },
    { key: 'size', shape: 'json', says: 'moduleContent.animation.key.size' },
    { key: 'max', shape: 'json', says: 'moduleContent.animation.key.max' },
    { key: 'panel', shape: 'line', says: 'moduleContent.animation.key.panel' },
    { key: 'vars', shape: 'json', says: 'moduleContent.animation.key.vars', inside: LIVE_DOCS.vars },
    { key: 'let', shape: 'json', says: 'moduleContent.animation.key.let', inside: LIVE_DOCS.let },
    { key: 'sim', shape: 'json', says: 'moduleContent.animation.key.sim', inside: LIVE_DOCS.sim },
    { key: 'controls', shape: 'json', says: 'moduleContent.animation.key.controls', inside: LIVE_DOCS.controls },
    { key: 'rules', shape: 'json', says: 'moduleContent.animation.key.rules', inside: LIVE_DOCS.rules },
    {
      key: 'predict', shape: 'json',
      says: 'moduleContent.animation.key.predict',
      inside: PREDICT_DOCS
    },
    {
      key: 'task', shape: 'json',
      says: 'moduleContent.animation.key.task',
      inside: TASK_DOCS
    },
    {
      key: 'world', shape: 'json',
      says: 'moduleContent.animation.key.world',
      inside: { ...WORLD_DOCS, ...relative(shapeDocs('world.kinds[].shapes[]'), 'world') }
    },
    {
      key: 'symbols', shape: 'json', says: 'moduleContent.animation.key.symbols',
      inside: { '[].name': 'moduleContent.animation.key.symbolName', '[].shapes': 'moduleContent.animation.key.symbolShapes', ...relative(shapeDocs('symbols[].shapes[]'), 'symbols') }
    },
    {
      key: 'elements', shape: 'json', says: 'moduleContent.animation.key.elements',
      inside: relative(shapeDocs('elements[]'), 'elements')
    }
  ],

  read,
  hasContent: (c) => readDrawing(c.raw).elements.length > 0,
  missing: (c) => (readDrawing(c.raw).elements.length === 0 ? t('moduleContent.animation.missing') : null),
  shows: (c, size) => size.height === 'strip'
    ? t('moduleContent.animation.showsStrip', { sum: sum(c.raw) })
    : t(readDrawing(c.raw).live === null ? 'moduleContent.animation.showsMoving' : 'moduleContent.animation.showsLive', { sum: sum(c.raw) }),
  Editor: AnimationEditor,
  View: ({ config, ctx }) => <AnimationView raw={config.raw} strip={ctx.size.height === 'strip'} moduleId={ctx.moduleId} />
});
