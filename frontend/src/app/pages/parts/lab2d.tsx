/**
 * LABORATORIUM 2D (2026-10-20) — ein Baustein mit der Lab-Engine v2
 * (`lab/lab2d/`, documentation/lab2d/): eine Kiste voll Luft, in die man Wasser
 * malt und Zlewki und Heizplatten stellt; Wärme, Konvektion, Verdunsten,
 * Sieden, Kondensieren und Nebel folgen aus lokalen Gesetzen und der
 * Stoffdatenbank (Felder auf einem eulerschen Gitter, Wasser als
 * APIC-Teilchen, Blasen als Objekte) — nichts ist vorgespielt.
 *
 * <b>Die Engine ist Code, der Aufbau ist gespeichert</b>: `scene` (JSON) sagt,
 * was am Anfang wo steht — die Kiste, die Umgebung, die Seiten, der Samen und
 * die Handgriffe der Reihe nach.
 *
 * <b>Je Grösse</b>: im Streifen eine Karte mit Knopf (das Labor öffnet sich im
 * ganzen Fenster); als Block das Labor selbst, mit eigenem Vollbild-Knopf.
 *
 * <b>Start</b> (B): das Labor rechnet nie von selbst — es wartet auf „Uruchom
 * na żywo“ oder „Upiecz“; mit `start: "bake"` beginnt das Backen beim Öffnen
 * (ein in diesem Browser schon gebackener Nachweis spielt dann gleich ab).
 * `seconds`: Länge eines Nachweises. `scenarios`: weitere Szenariusze, zwischen
 * denen die Schüler im Labor wählen.
 */

import { t, useT, type T } from '../../core/i18n';
import { definePart, lines, maybeNumber, text, type RawConfig } from '../part';
import { later } from '../../ui/later';
import { LabEditor, type LabChoice } from '../../lab/LabEditor';

interface Scenario {
  readonly title: string;
  readonly text: readonly string[];
  readonly scene: unknown;
}

interface Config {
  readonly title: string;
  readonly text: readonly string[];
  readonly mode: 'sandbox' | 'experiment';
  readonly scene: unknown;
  readonly start: 'button' | 'bake';
  readonly seconds: number;
  readonly scenarios: readonly Scenario[];
  readonly raw: RawConfig;
}

const parse = (value: string): unknown => {
  try { return value.trim() === '' ? null : JSON.parse(value) as unknown; } catch { return null; }
};

/** Die Szenariusze: eine Liste von { title, text, scene } — Unbrauchbares fällt weg. */
function scenariosOf(value: unknown): Scenario[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((x): Scenario[] => {
    if (x === null || typeof x !== 'object') return [];
    const o = x as Record<string, unknown>;
    if (o.scene === null || typeof o.scene !== 'object' || Array.isArray(o.scene)) return [];
    const body = Array.isArray(o.text) ? o.text.filter((t): t is string => typeof t === 'string') : typeof o.text === 'string' ? o.text.split('\n') : [];
    return [{ title: typeof o.title === 'string' ? o.title.trim() : '', text: body.map((t) => t.trim()).filter((t) => t !== ''), scene: o.scene }];
  });
}

const BAKE_SECONDS = [10, 30, 60, 120, 300];

const read = (raw: RawConfig): Config => ({
  title: text(raw, 'title'),
  text: lines(raw, 'text'),
  mode: text(raw, 'mode') === 'experiment' ? 'experiment' : 'sandbox',
  scene: parse(raw.scene ?? ''),
  start: text(raw, 'start') === 'bake' ? 'bake' : 'button',
  seconds: Math.max(5, Math.min(600, maybeNumber(raw, 'seconds') ?? 30)),
  scenarios: scenariosOf(parse(raw.scenarios ?? '')),
  raw
});

/** Die Auswahlfelder im Editor: wie das Labor beim Öffnen startet, wie lange ein Nachweis wird. */
const choicesOf = (t: T): readonly LabChoice[] => [
  { key: 'start', label: t('moduleContent.lab2d.choice.start'), choices: [{ value: 'button', label: t('moduleContent.lab2d.choice.startButton') }, { value: 'bake', label: t('moduleContent.lab2d.choice.startBake') }] },
  { key: 'seconds', label: t('moduleContent.lab2d.choice.seconds'), choices: BAKE_SECONDS.map((s) => ({ value: String(s), label: t('moduleContent.lab2d.choice.secondsN', { s }) })).sort((a, b) => (a.value === '30' ? -1 : b.value === '30' ? 1 : 0)) }
];

/** Das Labor — erst geladen, wenn es gezeigt wird (eine öffentliche Seite lädt die Engine nicht mit). */
const Lab = later(() => import('../../lab/lab2d/Lab2D').then((m) => m.Lab2D));
const presets = () => import('../../lab/lab2d/presets').then((m) => m.LAB2D_PRESETS);

function Preview({ title, text: body, scene }: { title: string; text: readonly string[]; mode: 'sandbox' | 'experiment'; scene: unknown }) {
  return <Lab config={{ title, text: body, scene }} />;
}

/** Eine leere Kiste voll Luft (für den Editor, solange nichts eingestellt ist). */
const SANDBOX = {
  format: 'recreatio/lab2d', version: 1, seed: 1, box: { w: 0.2, h: 0.15, depth: 0.01 },
  ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81 }, sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' }, quality: 'high', ops: []
};

const SCENE_DOCS: Readonly<Record<string, string>> = {
  '.format': 'moduleContent.lab2d.scene.format',
  '.version': 'moduleContent.lab2d.scene.version',
  '.seed': 'moduleContent.lab2d.scene.seed',
  '.box': 'moduleContent.lab2d.scene.box',
  '.box.w': 'moduleContent.lab2d.scene.boxW',
  '.box.h': 'moduleContent.lab2d.scene.boxH',
  '.box.depth': 'moduleContent.lab2d.scene.boxDepth',
  '.ambient': 'moduleContent.lab2d.scene.ambient',
  '.ambient.p': 'moduleContent.lab2d.scene.ambientP',
  '.ambient.T': 'moduleContent.lab2d.scene.ambientT',
  '.ambient.rh': 'moduleContent.lab2d.scene.ambientRh',
  '.ambient.g': 'moduleContent.lab2d.scene.ambientG',
  '.ambient.air': 'moduleContent.lab2d.scene.ambientAir',
  '.ambient.air.N2': 'moduleContent.lab2d.scene.ambientAirN2',
  '.ambient.air.O2': 'moduleContent.lab2d.scene.ambientAirO2',
  '.sides': 'moduleContent.lab2d.scene.sides',
  '.sides.left': 'moduleContent.lab2d.scene.sidesLeft',
  '.sides.right': 'moduleContent.lab2d.scene.sidesRight',
  '.sides.bottom': 'moduleContent.lab2d.scene.sidesBottom',
  '.sides.top': 'moduleContent.lab2d.scene.sidesTop',
  '.quality': 'moduleContent.lab2d.scene.quality',
  '.extremes': 'moduleContent.lab2d.scene.extremes',
  '.ops': 'moduleContent.lab2d.scene.ops',
  '.ops[].op': 'moduleContent.lab2d.scene.opsOp',
  '.ops[].id': 'moduleContent.lab2d.scene.opsId',
  '.ops[].dx': 'moduleContent.lab2d.scene.opsDx',
  '.ops[].dy': 'moduleContent.lab2d.scene.opsDy',
  '.ops[].region': 'moduleContent.lab2d.scene.opsRegion',
  '.ops[].region.rect': 'moduleContent.lab2d.scene.opsRegionRect',
  '.ops[].region.circle': 'moduleContent.lab2d.scene.opsRegionCircle',
  '.ops[].region.poly': 'moduleContent.lab2d.scene.opsRegionPoly',
  '.ops[].region.line': 'moduleContent.lab2d.scene.opsRegionLine',
  '.ops[].region.width': 'moduleContent.lab2d.scene.opsRegionWidth',
  '.ops[].composition': 'moduleContent.lab2d.scene.opsComposition',
  '.ops[].composition.H2O': 'moduleContent.lab2d.scene.opsCompositionH2O',
  '.ops[].phase': 'moduleContent.lab2d.scene.opsPhase',
  '.ops[].T': 'moduleContent.lab2d.scene.opsT',
  '.ops[].material': 'moduleContent.lab2d.scene.opsMaterial',
  '.ops[].d': 'moduleContent.lab2d.scene.opsD',
  '.ops[].pinned': 'moduleContent.lab2d.scene.opsPinned',
  '.ops[].angle': 'moduleContent.lab2d.scene.opsAngle',
  '.ops[].x': 'moduleContent.lab2d.scene.opsX',
  '.ops[].y': 'moduleContent.lab2d.scene.opsY',
  '.ops[].w': 'moduleContent.lab2d.scene.opsW',
  '.ops[].h': 'moduleContent.lab2d.scene.opsH',
  '.ops[].wall': 'moduleContent.lab2d.scene.opsWall',
  '.ops[].lid': 'moduleContent.lab2d.scene.opsLid',
  '.ops[].mode': 'moduleContent.lab2d.scene.opsMode',
  '.ops[].power': 'moduleContent.lab2d.scene.opsPower',
  '.ops[].target': 'moduleContent.lab2d.scene.opsTarget',
  '.ops[].on': 'moduleContent.lab2d.scene.opsOn'
};

/** Ein zweites Szenariusz im Beispiel: Mgła nad gorącą wodą. */
const EXAMPLE_FOG = {
  format: 'recreatio/lab2d', version: 1, seed: 1, box: { w: 0.2, h: 0.15, depth: 0.01 },
  ambient: { p: 101.325, T: 10, rh: 0.8, g: 9.81 }, sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' }, quality: 'high',
  ops: [
    { op: 'hotplate', x: 0.1, y: 0, w: 0.12, h: 0.008, material: 'steel', mode: 'power', power: 15, on: true, T: 90 },
    { op: 'beaker', x: 0.1, y: 0.008, w: 0.07, h: 0.08, wall: 0.002, material: 'glass', T: 90 },
    { op: 'fill', region: { rect: [0.067, 0.010, 0.133, 0.06] }, composition: { H2O: 1 }, phase: 'liquid', T: 90 }
  ]
};

const EXAMPLE_SCENE = {
  format: 'recreatio/lab2d', version: 1, seed: 7, box: { w: 0.2, h: 0.15, depth: 0.01 },
  ambient: { p: 101.325, T: 20, rh: 0.5, g: 9.81, air: { N2: 0.7676, O2: 0.2324 } },
  sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' }, quality: 'high',
  ops: [
    { op: 'hotplate', x: 0.1, y: 0, w: 0.12, h: 0.008, material: 'steel', mode: 'power', power: 40, target: 150, on: true, T: 20 },
    { op: 'beaker', x: 0.1, y: 0.008, w: 0.07, h: 0.08, wall: 0.002, material: 'glass', T: 20, lid: false },
    { op: 'fill', region: { rect: [0.067, 0.010, 0.133, 0.06] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 },
    { op: 'solid', region: { circle: [0.1, 0.011, 0.002] }, material: 'ceramic', T: 20 },
    { op: 'erase', region: { poly: [[0.02, 0.12], [0.05, 0.12], [0.035, 0.14]] } },
    { op: 'solid', region: { line: [0.17, 0.02, 0.19, 0.05], width: 0.004 }, material: 'glass', T: 20 }
  ]
};

export const lab2dPart = definePart<Config>({
  kind: 'lab2d',
  label: 'moduleContent.lab2d.label',
  use: 'moduleContent.lab2d.use',
  box: { colSpan: 6, rowSpan: 5 },
  fields: [],
  read,
  hasContent: () => true,
  missing: () => null,
  shows: (c, size) => size.height === 'strip'
    ? t('moduleContent.lab2d.showsStrip', { title: c.title || t('moduleContent.lab2d.title') })
    : t('moduleContent.lab2d.showsAll', { title: c.title || t('moduleContent.lab2d.title') }),
  fullscreen: true,
  Editor: function Lab2dEditor(props) {
    const t = useT();
    return (
      <LabEditor {...props} presets={presets} sandbox={SANDBOX} what={t('moduleContent.lab2d.what')} Preview={Preview} choices={choicesOf(t)} scenarios
        prompt={() => import('../../lab/lab2d/text').then((m) => m.lab2dPrompt())} />
    );
  },
  View: function Lab2dView({ config, ctx }) {
    const t = useT();
    if (ctx.size.height === 'strip' && ctx.whole !== true) {
      return (
        <div className="lab-card">
          <strong>{config.title || t('moduleContent.lab2d.title')}</strong>
          {config.text[0] !== undefined && <p className="wk-card-muted">{config.text[0]}</p>}
          {ctx.openWhole !== undefined && <button type="button" className="wk-btn" onClick={ctx.openWhole}>{t('moduleContent.lab2d.open')}</button>}
        </div>
      );
    }
    return <Lab config={{ title: config.title, text: config.text, scene: config.scene, start: config.start, seconds: config.seconds, scenarios: config.scenarios }} whole={ctx.whole === true} />;
  },
  example: {
    title: 'Zlewka na płycie grzejnej', // i18n-ignore
    text: 'W zlewce jest woda, pod nią płyta grzejna.\nObserwuj pęcherze przy dnie i wykres temperatury.', // i18n-ignore
    mode: 'sandbox',
    scene: JSON.stringify(EXAMPLE_SCENE),
    start: 'button',
    seconds: '30',
    scenarios: JSON.stringify([{ title: 'Mgła nad gorącą wodą', text: ['Gorąca woda w chłodnym pokoju — nad zlewką powstaje mgła.'], scene: EXAMPLE_FOG }]) // i18n-ignore
  },
  extra: [
    { key: 'title', shape: 'line', says: 'moduleContent.lab2d.key.title' },
    { key: 'text', shape: 'lines', says: 'moduleContent.lab2d.key.text' },
    { key: 'mode', shape: 'line', says: 'moduleContent.lab2d.key.mode' },
    { key: 'scene', shape: 'json', says: 'moduleContent.lab2d.key.scene', inside: SCENE_DOCS },
    { key: 'start', shape: 'line', says: 'moduleContent.lab2d.key.start' },
    { key: 'seconds', shape: 'line', says: 'moduleContent.lab2d.key.seconds' },
    {
      key: 'scenarios', shape: 'json', says: 'moduleContent.lab2d.key.scenarios',
      inside: {
        '[].title': 'moduleContent.lab2d.key.scenarioTitle',
        '[].text': 'moduleContent.lab2d.key.scenarioText',
        ...Object.fromEntries(Object.entries({ '': 'moduleContent.lab2d.key.scenarioScene', ...SCENE_DOCS }).map(([k, v]) => [`[].scene${k}`, v]))
      }
    }
  ]
});
