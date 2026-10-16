/**
 * ANIMACJA (0107) — ein bewegtes Bild aus dem Pokaz von Cogita, als Baustein
 * für jede Seite: Drzewo wiedzy, Karty, Runda, Postęp, Znak.
 *
 * <b>Die Bilder selbst</b> stehen in `animationScenes.tsx` (Herkunft, Zeitpläne,
 * Zufall mit Samen), ihre Keyframes als `an-*` in `app.css`. Hier: was man
 * einstellt — welche Szene, Farben, wie schnell, wie gross —, und WANN sie
 * läuft: auf einem Slajd, sobald er zu sehen ist (und von vorn, wenn man
 * wiederkommt), auf einer Seite, sobald sie im Bild ist; still bei „weniger
 * Bewegung" im System.
 *
 * <b>Neben einem Text</b> steht sie mit `slide.with` (0107): auf dessen Slajd,
 * rechts von ihm, auf dem Telefon darüber — wie im Pokaz.
 *
 * <b>Je Grösse:</b> im Streifen ein kleines, stehendes Bild; als Block und hoch
 * das ganze, bewegt — so breit, wie es der Baustein ist (höchstens `max`).
 */

import { useContext, useEffect, useRef, useState, type CSSProperties } from 'react';

import { CardsScene, DrawScene, ICONS, MAP_LEVELS, MapScene, ProgressScene, RoundScene, safePath } from '../animationScenes';
import { usePhase, useReducedMotion } from '../MotionBox';
import { definePart, text, type EditorProps, type RawConfig } from '../part';
import { ShowDark } from '../showContext';
import { usePrefersDark } from '../SlideDeck';

export const SCENES = ['map', 'cards', 'round', 'progress', 'draw'] as const;
export type Scene = (typeof SCENES)[number];

/**
 * DIE SZENEN: Name, was sie zeigt, ihre Grösse im Altbestand (Breite in px,
 * Seitenverhältnis) und der Samen, mit dem sie dort aussah.
 */
export const SCENE_DEFS: Readonly<Record<Scene, { readonly label: string; readonly says: string; readonly width: number; readonly aspect: number; readonly seed: number; readonly legacy: string }>> = {
  map: {
    label: 'Drzewo wiedzy', says: 'węzły wiedzy w poziomach; wędrowiec idzie dalej tylko tam, gdzie stoją podstawy — gdy jakiejś brakuje, miga na czerwono i wraca po nią',
    width: 440, aspect: 420 / 320, seed: 11, legacy: 'CogitaIntroSlides: createLearningTree (ziarno 11), krok 900 ms, pauza 220 ms, błąd 900 ms'
  },
  cards: {
    label: 'Karty', says: 'siedem fiszek wpada rzuconych, układa się w siatkę, cztery idą na stos — co 10 s inny stos',
    width: 560, aspect: 560 / 440, seed: 17, legacy: 'cogita-card-flow, cogita-card-opacity, cogita-tag-filter (10 s, co 0,12 s następna karta)'
  },
  round: {
    label: 'Runda', says: 'pięć kart i sześciu graczy: karta unosi się, odpowiedzi lecą do niej, wyniki wracają (+ / −) — co 10 s nowa runda',
    width: 520, aspect: 520 / 390, seed: 5, legacy: 'round-card-lift, round-flow, round-return, round-result, round-ring, round-player-breathe, round-link-fade (8,6 s)'
  },
  progress: {
    label: 'Postęp', says: 'własna linia rośnie krok po kroku, pasmo grupy, dwie inne osoby, krąg porównania, potem cały wykres',
    width: 560, aspect: 560 / 380, seed: 3, legacy: 'chart-seg-1…6, chart-dot-step, chart-peer-*, chart-orbit-*, chart-loop-fade, chart-clip-reveal (24 s)'
  },
  draw: {
    label: 'Znak', says: 'znak rysuje się kreską (ruch "draw"), za nim pulsuje poświata (ruch "glow")',
    width: 180, aspect: 180 / 220, seed: 1, legacy: 'cogita-shield-draw (1,8 s), cogita-shield-glow (2,2 s)'
  }
};

/** Die Farben des Altbestands — hell auf dunklem Blau. */
export const LEGACY_COLORS = { color: '#aae6ff', soft: '#8cc8ff', good: '#78e6aa', bad: '#ff7878' } as const;

interface Config {
  readonly scene: Scene;
  readonly seed: number;
  readonly speed: number;
  readonly color: string;
  readonly soft: string;
  readonly good: string;
  readonly bad: string;
  /** Höchstens so breit (rem) — `null`: die Breite des Altbestands. */
  readonly max: number | null;
  readonly levels: readonly number[];
  readonly icon: string;
  readonly path: string | null;
  readonly viewBox: string;
  readonly glow: boolean;
}

const numberOf = (raw: RawConfig, key: string): number | null => {
  const n = Number.parseFloat(text(raw, key));
  return Number.isFinite(n) ? n : null;
};

const read = (raw: RawConfig): Config => {
  const scene = text(raw, 'scene') as Scene;
  const chosen: Scene = SCENES.includes(scene) ? scene : 'map';
  const levels = (() => {
    try {
      const parsed = JSON.parse(text(raw, 'levels') || 'null') as unknown;
      const list = Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)).map((n) => Math.max(1, Math.min(12, Math.round(n)))) : [];
      return list.length >= 2 && list.length <= 10 ? list : MAP_LEVELS;
    } catch { return MAP_LEVELS; }
  })();
  const viewBox = text(raw, 'viewBox');
  const max = numberOf(raw, 'max');
  return {
    scene: chosen,
    seed: Math.round(Math.max(0, Math.min(1_000_000, numberOf(raw, 'seed') ?? SCENE_DEFS[chosen].seed))),
    speed: Math.max(0.1, Math.min(5, numberOf(raw, 'speed') ?? 1)),
    color: text(raw, 'color').slice(0, 60) || 'accent',
    soft: text(raw, 'soft').slice(0, 60) || 'muted',
    good: text(raw, 'good').slice(0, 60) || 'ok',
    bad: text(raw, 'bad').slice(0, 60) || 'danger',
    max: max === null ? null : Math.max(4, Math.min(120, max)),
    levels,
    icon: ICONS[text(raw, 'icon')] === undefined ? 'shield' : text(raw, 'icon'),
    path: safePath(text(raw, 'path')),
    viewBox: /^-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+$/.test(viewBox) ? viewBox : '0 0 120 140',
    glow: text(raw, 'glow') !== 'nie' && text(raw, 'glow') !== 'false' && text(raw, 'glow') !== '0'
  };
};

/**
 * Eine Farbe einer Animacja: `#rrggbb`, `rgba(…)`, ein Paar `hell|dunkel`, oder
 * ein Name — `accent`, `ink`, `ground`, `muted` (das Thema; auf Slajdy gehen
 * sie mit), `ok`, `danger` (gut, schlecht).
 */
export function paintOf(value: string, dark: boolean): string {
  const pair = value.split('|').map((one) => one.trim());
  const chosen = pair.length === 2 ? (dark ? pair[1] : pair[0]) : value.trim();
  if (['accent', 'ink', 'ground', 'muted'].includes(chosen)) return `var(--wk-${chosen})`;
  if (chosen === 'ok') return 'var(--wk-ok, #3fb468)';
  if (chosen === 'danger') return 'var(--wk-danger, #e05252)';
  return /[;{}<>]/.test(chosen) ? 'currentColor' : chosen;
}

function AnimationView({ config, strip }: { config: Config; strip: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const phase = usePhase(ref);
  const reduced = useReducedMotion();
  const device = usePrefersDark();
  const dark = useContext(ShowDark) ?? device;
  const still = reduced || strip;
  const playing = phase !== 'away' && !still;

  /* Von vorn, wann immer sie wieder ins Bild kommt — wie der Pokaz beim Betreten eines Slajds. */
  const [run, setRun] = useState(0);
  const was = useRef(phase);
  useEffect(() => {
    if (was.current === 'away' && phase !== 'away') setRun((r) => r + 1);
    was.current = phase;
  }, [phase]);

  const def = SCENE_DEFS[config.scene];
  const vars = {
    '--an-c': paintOf(config.color, dark),
    '--an-soft': paintOf(config.soft, dark),
    '--an-good': paintOf(config.good, dark),
    '--an-bad': paintOf(config.bad, dark),
    '--an-speed': config.speed,
    '--an-base': def.width / 16,
    '--an-aspect': def.aspect,
    '--an-max': `${config.max ?? def.width / 16}rem`
  } as CSSProperties;

  return (
    <div ref={ref} className={`an an-${config.scene}${playing ? '' : ' is-paused'}${still ? ' is-still' : ''}${strip ? ' is-strip' : ''}`}
      style={vars} role="img" aria-label={def.label}>
      <div className="an-box" key={still ? 'still' : run}>
        {config.scene === 'map' && <MapScene seed={config.seed} levels={config.levels} speed={config.speed} playing={playing} run={run} />}
        {config.scene === 'cards' && <CardsScene seed={config.seed} speed={config.speed} playing={playing} />}
        {config.scene === 'round' && <RoundScene seed={config.seed} speed={config.speed} playing={playing} />}
        {config.scene === 'progress' && <ProgressScene seed={config.seed} />}
        {config.scene === 'draw' && <DrawScene icon={config.icon} path={config.path} viewBox={config.viewBox} glow={config.glow} speed={config.speed} still={still} />}
      </div>
    </div>
  );
}

function AnimationEditor({ raw, onSet, busy }: EditorProps) {
  const config = read(raw);
  const field = (key: string, label: string, hint: string, placeholder = '') => (
    <label className="se-inline" title={hint}>
      <span>{label}</span>
      <input value={raw[key] ?? ''} placeholder={placeholder} disabled={busy} maxLength={80} onChange={(e) => onSet({ [key]: e.target.value })} />
    </label>
  );
  return (
    <div className="an-edit">
      <label className="se-inline">
        <span>Obraz</span>
        <select value={config.scene} disabled={busy} onChange={(e) => onSet({ scene: e.target.value })}>
          {SCENES.map((one) => <option key={one} value={one}>{SCENE_DEFS[one].label}</option>)}
        </select>
      </label>
      <p className="wk-hint">{SCENE_DEFS[config.scene].says}.</p>
      {config.scene === 'draw' && (
        <label className="se-inline">
          <span>Znak</span>
          <select value={config.icon} disabled={busy} onChange={(e) => onSet({ icon: e.target.value })}>
            {Object.entries(ICONS).map(([key, icon]) => <option key={key} value={key}>{icon.label}</option>)}
          </select>
        </label>
      )}
      {config.scene === 'map' && field('levels', 'Poziomy', 'Ile węzłów na każdym poziomie, od dołu — np. [1,4,6,6,5,4,4]', '[1,4,6,6,5,4,4]')}
      {field('color', 'Kolor', 'np. #aae6ff, accent, ink, para „jasny|ciemny”', 'accent')}
      {field('soft', 'Kolor drugi', 'linie, tło kart', 'muted')}
      {config.scene === 'round' && field('good', 'Dobrze', 'kolor dobrej odpowiedzi', 'ok')}
      {(config.scene === 'round' || config.scene === 'map') && field('bad', 'Źle', 'kolor błędu', 'danger')}
      {field('speed', 'Tempo', '1 — jak w pokazie Cogita; 2 — dwa razy szybciej', '1')}
      {config.scene !== 'draw' && field('seed', 'Ziarno', 'Inna liczba — inny układ (ten sam za każdym razem)', String(SCENE_DEFS[config.scene].seed))}
      {field('max', 'Najwyżej (rem)', 'Największa szerokość', String(SCENE_DEFS[config.scene].width / 16))}
    </div>
  );
}

export const animationPart = definePart<Config>({
  kind: 'animation',
  label: 'Animacja',
  use: 'Ruchomy obraz z pokazu Cogita: drzewo wiedzy, karty, runda, postęp, rysowany znak — obok tekstu na slajdzie albo na stronie.',
  box: { colSpan: 3, rowSpan: 3 },

  example: { scene: 'cards', seed: '17', speed: '1', color: '#aae6ff', soft: '#8cc8ff', good: 'ok', bad: 'danger', max: '35', levels: '[1,4,6,6,5,4,4]', icon: 'shield', path: 'M60 14v112M30 48h60', viewBox: '0 0 120 140', glow: 'tak' },
  fields: [],
  extra: [
    { key: 'scene', shape: 'line', says: `Który obraz: ${SCENES.map((one) => `"${one}" (${SCENE_DEFS[one].label.toLowerCase()}: ${SCENE_DEFS[one].says})`).join('; ')}` },
    { key: 'seed', shape: 'json', says: 'Ziarno losowości (liczba): inna liczba — inny układ węzłów, rzutów kart, graczy, wykresu; ta sama — ten sam obraz za każdym razem. Pominięte — jak w pokazie Cogita' },
    { key: 'speed', shape: 'json', says: 'Tempo (liczba): 1 — jak w pokazie Cogita, 2 — dwa razy szybciej, 0.5 — wolniej' },
    { key: 'color', shape: 'line', says: 'Kolor główny: "#rrggbb", "rgba(…)", para "jasny|ciemny" albo nazwa: "accent", "ink", "ground", "muted" (pominięty — "accent")' },
    { key: 'soft', shape: 'line', says: 'Kolor drugi (linie, tło kart) — jak "color" (pominięty — "muted")' },
    { key: 'good', shape: 'line', says: 'Kolor dobrej odpowiedzi (runda) — jak "color" albo "ok"' },
    { key: 'bad', shape: 'line', says: 'Kolor błędu (runda, brak podstaw na mapie) — jak "color" albo "danger"' },
    { key: 'max', shape: 'json', says: 'Najwyżej tyle szerokości w rem (liczba); pominięte — rozmiar z pokazu Cogita' },
    { key: 'levels', shape: 'json', says: 'Tylko "map": ile węzłów na każdym poziomie, od dołu — lista liczb (2–10 poziomów), np. [1,4,6,6,5,4,4]' },
    { key: 'icon', shape: 'line', says: `Tylko "draw": który znak — ${Object.entries(ICONS).map(([key, icon]) => `"${key}" (${icon.label.toLowerCase()})`).join(', ')}` },
    { key: 'path', shape: 'line', says: 'Tylko "draw": własny rysunek — ścieżka SVG ("M60 10l42 16 …"); zastępuje "icon"' },
    { key: 'viewBox', shape: 'line', says: 'Tylko "draw" z "path": układ współrzędnych rysunku, np. "0 0 120 140"' },
    { key: 'glow', shape: 'line', says: 'Tylko "draw": "tak" (poświata za znakiem) albo "nie"' }
  ],

  read,
  hasContent: () => true,
  shows: (c, size) => size.height === 'strip'
    ? `${SCENE_DEFS[c.scene].label} — mały, nieruchomy obraz.`
    : `${SCENE_DEFS[c.scene].label} w ruchu, na całą szerokość modułu${size.height === 'tall' ? ' (wysoki — większy)' : ''}.`,
  Editor: AnimationEditor,
  View: ({ config, ctx }) => <AnimationView config={config} strip={ctx.size.height === 'strip'} />
});
