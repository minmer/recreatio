/**
 * LABORATORIUM CZĄSTEK (2026-10-19) — ein Baustein mit der Partikel-Engine
 * (`lab/particles/`, documentation/particles/): eine Kiste voll Luft, in die
 * man Stoffe malt und Geräte stellt; was geschieht, folgt aus lokalen Regeln
 * und der Stoffdatenbank — nichts ist vorgespielt. Meilenstein M1a: die
 * Mechanik (Flüssigkeit und Gas nach PBF, Wände, Oberflächenspannung,
 * Auftrieb); Wärme und Sieden folgen.
 *
 * <b>Alle Kerne</b>: auf einer Seite rechnet das Labor mit einem Faden; ein
 * Knopf öffnet es mit dem, was gebaut wurde, in einer eigenen Karte
 * (`lab.html`), die „cross-origin isolated“ ist und mit allen Kernen rechnet.
 *
 * <b>Die Engine ist Code, der Aufbau ist gespeichert</b>: `scene` (JSON) sagt,
 * was am Anfang wo steht — die Kiste, die Umgebung, die Seiten, der Samen und
 * die Handgriffe der Reihe nach.
 *
 * <b>Je Grösse</b>: im Streifen eine Karte mit Knopf (das Labor öffnet sich im
 * ganzen Fenster); als Block das Labor selbst, mit eigenem Vollbild-Knopf.
 */

import { t, useT } from '../../core/i18n';
import { definePart, lines, text, type RawConfig } from '../part';
import { later } from '../../ui/later';
import { LabEditor } from '../../lab/LabEditor';
import { openFullLab } from '../../lab/particles/fullLab';

interface Config {
  readonly title: string;
  readonly text: readonly string[];
  readonly mode: 'sandbox' | 'experiment';
  readonly scene: unknown;
  readonly raw: RawConfig;
}

const parse = (value: string): unknown => {
  try { return value.trim() === '' ? null : JSON.parse(value) as unknown; } catch { return null; }
};

const read = (raw: RawConfig): Config => ({
  title: text(raw, 'title'),
  text: lines(raw, 'text'),
  mode: text(raw, 'mode') === 'experiment' ? 'experiment' : 'sandbox',
  scene: parse(raw.scene ?? ''),
  raw
});

/** Das Labor — erst geladen, wenn es gezeigt wird (eine öffentliche Seite lädt die Engine nicht mit). */
const Lab = later(() => import('../../lab/particles/ParticleLab').then((m) => m.ParticleLab));
const presets = () => import('../../lab/particles/particlePresets').then((m) => m.PARTICLE_PRESETS);

function Preview({ title, text: body, scene }: { title: string; text: readonly string[]; mode: 'sandbox' | 'experiment'; scene: unknown }) {
  return <Lab config={{ title, text: body, scene }} />;
}

/** Eine leere Kiste voll Luft (für den Editor, solange nichts eingestellt ist). */
const SANDBOX = {
  format: 'recreatio/particles', version: 1, seed: 1, box: { w: 0.3, h: 0.2, depth: 0.01 },
  ambient: { p: 101.325, T: 20, g: 9.81 }, sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' }, quality: 'very-high', ops: []
};

const SCENE_DOCS: Readonly<Record<string, string>> = {
  '.format': 'moduleContent.particles.scene.format',
  '.version': 'moduleContent.particles.scene.version',
  '.seed': 'moduleContent.particles.scene.seed',
  '.box': 'moduleContent.particles.scene.box',
  '.box.w': 'moduleContent.particles.scene.boxW',
  '.box.h': 'moduleContent.particles.scene.boxH',
  '.box.depth': 'moduleContent.particles.scene.boxDepth',
  '.ambient': 'moduleContent.particles.scene.ambient',
  '.ambient.p': 'moduleContent.particles.scene.ambientP',
  '.ambient.T': 'moduleContent.particles.scene.ambientT',
  '.ambient.g': 'moduleContent.particles.scene.ambientG',
  '.ambient.air': 'moduleContent.particles.scene.ambientAir',
  '.ambient.air.N2': 'moduleContent.particles.scene.ambientAirN2',
  '.ambient.air.O2': 'moduleContent.particles.scene.ambientAirO2',
  '.sides': 'moduleContent.particles.scene.sides',
  '.sides.left': 'moduleContent.particles.scene.sidesLeft',
  '.sides.right': 'moduleContent.particles.scene.sidesRight',
  '.sides.bottom': 'moduleContent.particles.scene.sidesBottom',
  '.sides.top': 'moduleContent.particles.scene.sidesTop',
  '.quality': 'moduleContent.particles.scene.quality',
  '.ops': 'moduleContent.particles.scene.ops',
  '.ops[].op': 'moduleContent.particles.scene.opsOp',
  '.ops[].region': 'moduleContent.particles.scene.opsRegion',
  '.ops[].region.rect': 'moduleContent.particles.scene.opsRegionRect',
  '.ops[].region.circle': 'moduleContent.particles.scene.opsRegionCircle',
  '.ops[].region.poly': 'moduleContent.particles.scene.opsRegionPoly',
  '.ops[].region.line': 'moduleContent.particles.scene.opsRegionLine',
  '.ops[].region.width': 'moduleContent.particles.scene.opsRegionWidth',
  '.ops[].composition': 'moduleContent.particles.scene.opsComposition',
  '.ops[].composition.H2O': 'moduleContent.particles.scene.opsCompositionH2O',
  '.ops[].phase': 'moduleContent.particles.scene.opsPhase',
  '.ops[].T': 'moduleContent.particles.scene.opsT',
  '.ops[].material': 'moduleContent.particles.scene.opsMaterial',
  '.ops[].x': 'moduleContent.particles.scene.opsX',
  '.ops[].y': 'moduleContent.particles.scene.opsY',
  '.ops[].w': 'moduleContent.particles.scene.opsW',
  '.ops[].h': 'moduleContent.particles.scene.opsH',
  '.ops[].wall': 'moduleContent.particles.scene.opsWall',
  '.ops[].mode': 'moduleContent.particles.scene.opsMode',
  '.ops[].power': 'moduleContent.particles.scene.opsPower',
  '.ops[].target': 'moduleContent.particles.scene.opsTarget',
  '.ops[].on': 'moduleContent.particles.scene.opsOn'
};

const EXAMPLE_SCENE = {
  format: 'recreatio/particles', version: 1, seed: 7, box: { w: 0.3, h: 0.2, depth: 0.01 },
  ambient: { p: 101.325, T: 20, g: 9.81, air: { N2: 0.7676, O2: 0.2324 } },
  sides: { left: 'wall', right: 'wall', bottom: 'wall', top: 'open' }, quality: 'very-high',
  ops: [
    { op: 'hotplate', x: 0.15, y: 0, w: 0.16, h: 0.012, material: 'steel', mode: 'power', power: 50, target: 150, on: true, T: 20 },
    { op: 'beaker', x: 0.15, y: 0.012, w: 0.07, h: 0.09, wall: 0.0025, material: 'glass', T: 20 },
    { op: 'fill', region: { rect: [0.116, 0.017, 0.184, 0.067] }, composition: { H2O: 1 }, phase: 'liquid', T: 20 },
    { op: 'solid', region: { circle: [0.15, 0.019, 0.004] }, material: 'ceramic', T: 20 },
    { op: 'erase', region: { poly: [[0.02, 0.15], [0.05, 0.15], [0.035, 0.18]] } },
    { op: 'solid', region: { line: [0.24, 0.02, 0.28, 0.06], width: 0.005 }, material: 'glass', T: 20 }
  ]
};

export const particlesPart = definePart<Config>({
  kind: 'particles',
  label: 'moduleContent.particles.label',
  use: 'moduleContent.particles.use',
  box: { colSpan: 6, rowSpan: 5 },
  fields: [],
  read,
  hasContent: () => true,
  missing: () => null,
  shows: (c, size) => size.height === 'strip'
    ? t('moduleContent.particles.showsStrip', { title: c.title || t('moduleContent.particles.title') })
    : t('moduleContent.particles.showsAll', { title: c.title || t('moduleContent.particles.title') }),
  fullscreen: true,
  Editor: function ParticlesEditor(props) {
    const t = useT();
    return (
      <LabEditor {...props} presets={presets} sandbox={SANDBOX} what={t('moduleContent.particles.what')} Preview={Preview}
        prompt={() => import('../../lab/particles/particleText').then((m) => m.particlePrompt())} />
    );
  },
  View: function ParticlesView({ config, ctx }) {
    const t = useT();
    if (ctx.size.height === 'strip' && ctx.whole !== true) {
      return (
        <div className="lab-card">
          <strong>{config.title || t('moduleContent.particles.title')}</strong>
          {config.text[0] !== undefined && <p className="wk-card-muted">{config.text[0]}</p>}
          {ctx.openWhole !== undefined && <button type="button" className="wk-btn" onClick={ctx.openWhole}>{t('moduleContent.particles.open')}</button>}
        </div>
      );
    }
    const fullPower = (scene: () => Promise<Record<string, unknown> | null>): void =>
      openFullLab(async () => ({ title: config.title, text: config.text, scene: (await scene()) ?? config.scene }));
    return <Lab config={{ title: config.title, text: config.text, scene: config.scene }} whole={ctx.whole === true} fullPower={fullPower} />;
  },
  example: {
    title: 'Zlewka na płycie grzejnej', // i18n-ignore
    text: 'W zlewce jest woda, pod nią płyta grzejna.\nZbadaj cząstki wody, szkła i powietrza.', // i18n-ignore
    mode: 'sandbox',
    scene: JSON.stringify(EXAMPLE_SCENE)
  },
  extra: [
    { key: 'title', shape: 'line', says: 'moduleContent.particles.key.title' },
    { key: 'text', shape: 'lines', says: 'moduleContent.particles.key.text' },
    { key: 'mode', shape: 'line', says: 'moduleContent.particles.key.mode' },
    { key: 'scene', shape: 'json', says: 'moduleContent.particles.key.scene', inside: SCENE_DOCS }
  ]
});
