/**
 * LABORATORIUM FIZYKI (2026-10-18) — ein Baustein mit einem fest
 * eingebauten Motor für Physik in 2D (`lab/physics/`): Körper aus echten
 * Stoffen, Stösse, Reibung, Gelenke, Seile, Stangen, Federn, Rollen —
 * und Flüssigkeiten mit Druck, Auftrieb, Löchern und verbundenen Gefässen.
 *
 * <b>Der Motor ist Code, der Versuch ist gespeichert</b>: die Szene (`scene`,
 * JSON) sagt, was in der Welt steht, was man sieht, was man darf, ein Ziel
 * und die Schritte; gezogene Werte machen ihn jedes Mal etwas anders. Als
 * Piaskownica (`mode: "sandbox"`) darf man alles und lädt fertige Versuche;
 * als Doświadczenie zeigt er genau seine Szene, mit „Pokaż”.
 *
 * <b>Je Grösse</b>: im Streifen eine Karte mit Titel und Knopf (das Labor
 * öffnet sich im ganzen Fenster); als Block und hoch das Labor selbst, mit
 * eigenem Knopf für den ganzen Bildschirm.
 */

import { t, useT } from '../../core/i18n';
import { definePart, lines, text, type RawConfig } from '../part';
import { later } from '../../ui/later';
import { LabEditor } from '../../lab/LabEditor';
import type { PhysConfig } from '../../lab/physics/PhysicsLab';
import { aboutOf, useStoryGoal } from '../presentation/storyCard';

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
  mode: text(raw, 'mode') === 'sandbox' ? 'sandbox' : 'experiment',
  scene: parse(raw.scene ?? ''),
  raw
});

/**
 * 2026-11-03 (G) — DAS LABOR IN EINER ERZÄHLUNG: erreicht es sein Ziel ("goal" der Szene), zählt das wie eine richtige
 * Antwort — auf der Frage der Baza ("question") oder der eigenen Karte des Ziels, die für "about" mitzählt.
 */
function GoalLab({ config, whole, moduleId }: { config: Config; whole: boolean; moduleId: string }) {
  const t = useT();
  const onGoal = useStoryGoal(config.raw.question ?? '', aboutOf(config.raw.about), moduleId, config.title || t('moduleContent.physics.title'));
  return <Lab config={{ title: config.title, text: config.text, mode: config.mode, scene: config.scene }} whole={whole} {...(onGoal === undefined ? {} : { onGoal })} />;
}

/** Das Labor — erst geladen, wenn es gezeigt wird (eine öffentliche Seite lädt den Motor nicht mit). */
const Lab = later(() => import('../../lab/physics/PhysicsLab').then((m) => m.PhysicsLab));
/** Die fertigen Versuche (für den Editor). */
const presets = () => import('../../lab/physics/physPresets').then((m) => m.PHYS_PRESETS);

function Preview({ title, text: body, mode, scene }: { title: string; text: readonly string[]; mode: 'sandbox' | 'experiment'; scene: unknown }) {
  const config: PhysConfig = { title, text: body, mode, scene };
  return <Lab config={config} />;
}

/** Die Szene einer leeren Piaskownica (für den Editor, solange nichts eingestellt ist). */
const SANDBOX = { world: { gravity: 9.81, air: 1 }, bodies: [], show: { values: true } };

const SCENE_DOCS: Readonly<Record<string, string>> = {
  '.world': 'moduleContent.physics.scene.world',
  '.world.gravity': 'moduleContent.physics.scene.worldGravity',
  '.world.air': 'moduleContent.physics.scene.worldAir',
  '.world.depth': 'moduleContent.physics.scene.worldDepth',
  '.world.ground': 'moduleContent.physics.scene.worldGround',
  '.world.speed': 'moduleContent.physics.scene.worldSpeed',
  '.vars': 'moduleContent.physics.scene.vars',
  '.vars[].name': 'moduleContent.physics.scene.varsName',
  '.vars[].from': 'moduleContent.physics.scene.varsFrom',
  '.vars[].to': 'moduleContent.physics.scene.varsTo',
  '.vars[].step': 'moduleContent.physics.scene.varsStep',
  '.vars[].pick': 'moduleContent.physics.scene.varsPick',
  '.bodies': 'moduleContent.physics.scene.bodies',
  '.bodies[].id': 'moduleContent.physics.scene.bodiesId',
  '.bodies[].label': 'moduleContent.physics.scene.bodiesLabel',
  '.bodies[].shape': 'moduleContent.physics.scene.bodiesShape',
  '.bodies[].x': 'moduleContent.physics.scene.bodiesX',
  '.bodies[].y': 'moduleContent.physics.scene.bodiesY',
  '.bodies[].r': 'moduleContent.physics.scene.bodiesR',
  '.bodies[].w': 'moduleContent.physics.scene.bodiesW',
  '.bodies[].h': 'moduleContent.physics.scene.bodiesH',
  '.bodies[].points': 'moduleContent.physics.scene.bodiesPoints',
  '.bodies[].angle': 'moduleContent.physics.scene.bodiesAngle',
  '.bodies[].material': 'moduleContent.physics.scene.bodiesMaterial',
  '.bodies[].density': 'moduleContent.physics.scene.bodiesDensity',
  '.bodies[].friction': 'moduleContent.physics.scene.bodiesFriction',
  '.bodies[].bounce': 'moduleContent.physics.scene.bodiesBounce',
  '.bodies[].static': 'moduleContent.physics.scene.bodiesStatic',
  '.bodies[].vx': 'moduleContent.physics.scene.bodiesVx',
  '.bodies[].vy': 'moduleContent.physics.scene.bodiesVy',
  '.bodies[].spin': 'moduleContent.physics.scene.bodiesSpin',
  '.bodies[].drag': 'moduleContent.physics.scene.bodiesDrag',
  '.bodies[].trace': 'moduleContent.physics.scene.bodiesTrace',
  '.bodies[].color': 'moduleContent.physics.scene.bodiesColor',
  '.joints': 'moduleContent.physics.scene.joints',
  '.joints[].type': 'moduleContent.physics.scene.jointsType',
  '.joints[].a': 'moduleContent.physics.scene.jointsA',
  '.joints[].b': 'moduleContent.physics.scene.jointsB',
  '.joints[].at': 'moduleContent.physics.scene.jointsAt',
  '.joints[].on': 'moduleContent.physics.scene.jointsOn',
  '.joints[].onB': 'moduleContent.physics.scene.jointsOnB',
  '.joints[].at2': 'moduleContent.physics.scene.jointsAt2',
  '.joints[].length': 'moduleContent.physics.scene.jointsLength',
  '.joints[].k': 'moduleContent.physics.scene.jointsK',
  '.joints[].damping': 'moduleContent.physics.scene.jointsDamping',
  '.joints[].speed': 'moduleContent.physics.scene.jointsSpeed',
  '.joints[].torque': 'moduleContent.physics.scene.jointsTorque',
  '.fluids': 'moduleContent.physics.scene.fluids',
  '.fluids[].id': 'moduleContent.physics.scene.fluidsId',
  '.fluids[].x': 'moduleContent.physics.scene.fluidsX',
  '.fluids[].y': 'moduleContent.physics.scene.fluidsY',
  '.fluids[].w': 'moduleContent.physics.scene.fluidsW',
  '.fluids[].h': 'moduleContent.physics.scene.fluidsH',
  '.fluids[].wall': 'moduleContent.physics.scene.fluidsWall',
  '.fluids[].layers': 'moduleContent.physics.scene.fluidsLayers',
  '.fluids[].layers[].liquid': 'moduleContent.physics.scene.fluidsLayersLiquid',
  '.fluids[].layers[].height': 'moduleContent.physics.scene.fluidsLayersHeight',
  '.fluids[].holes': 'moduleContent.physics.scene.fluidsHoles',
  '.fluids[].holes[].side': 'moduleContent.physics.scene.fluidsHolesSide',
  '.fluids[].holes[].at': 'moduleContent.physics.scene.fluidsHolesAt',
  '.fluids[].holes[].size': 'moduleContent.physics.scene.fluidsHolesSize',
  '.fluids[].holes[].open': 'moduleContent.physics.scene.fluidsHolesOpen',
  '.pipes': 'moduleContent.physics.scene.pipes',
  '.pipes[].a': 'moduleContent.physics.scene.pipesA',
  '.pipes[].b': 'moduleContent.physics.scene.pipesB',
  '.pipes[].y': 'moduleContent.physics.scene.pipesY',
  '.pipes[].size': 'moduleContent.physics.scene.pipesSize',
  '.pipes[].open': 'moduleContent.physics.scene.pipesOpen',
  '.show': 'moduleContent.physics.scene.show',
  '.show.vectors': 'moduleContent.physics.scene.showVectors',
  '.show.trace': 'moduleContent.physics.scene.showTrace',
  '.show.grid': 'moduleContent.physics.scene.showGrid',
  '.show.pressure': 'moduleContent.physics.scene.showPressure',
  '.show.values': 'moduleContent.physics.scene.showValues',
  '.graph': 'moduleContent.physics.scene.graph',
  '.graph.body': 'moduleContent.physics.scene.graphBody',
  '.graph.of': 'moduleContent.physics.scene.graphOf',
  '.allow': 'moduleContent.physics.scene.allow',
  '.allow.add': 'moduleContent.physics.scene.allowAdd',
  '.allow.palette': 'moduleContent.physics.scene.allowPalette',
  '.allow.tools': 'moduleContent.physics.scene.allowTools',
  '.allow.edit': 'moduleContent.physics.scene.allowEdit',
  '.allow.drag': 'moduleContent.physics.scene.allowDrag',
  '.controls': 'moduleContent.physics.scene.controls',
  '.goal': 'moduleContent.physics.scene.goal',
  '.goal.body': 'moduleContent.physics.scene.goalBody',
  '.goal.area': 'moduleContent.physics.scene.goalArea',
  '.goal.for': 'moduleContent.physics.scene.goalFor',
  '.goal.say': 'moduleContent.physics.scene.goalSay',
  '.steps': 'moduleContent.physics.scene.steps',
  '.steps[].say': 'moduleContent.physics.scene.stepsSay',
  '.steps[].do': 'moduleContent.physics.scene.stepsDo',
  '.steps[].do.open': 'moduleContent.physics.scene.stepsDoOpen',
  '.steps[].do.hole': 'moduleContent.physics.scene.stepsDoHole',
  '.steps[].do.push': 'moduleContent.physics.scene.stepsDoPush',
  '.steps[].do.vx': 'moduleContent.physics.scene.stepsDoVx',
  '.steps[].do.vy': 'moduleContent.physics.scene.stepsDoVy',
  '.steps[].wait': 'moduleContent.physics.scene.stepsWait',
  '.view': 'moduleContent.physics.scene.view'
};

/* Das Beispiel: Schwimmen (aus den fertigen Versuchen — dieselben Dokumente). */
const EXAMPLE_SCENE = {
  world: { gravity: 9.81, air: 0.3 },
  fluids: [{ id: 'woda', x: 0.5, y: 0, w: 4, h: 1.6, layers: [{ liquid: 'water', height: 1 }], holes: [{ side: 'right', at: 0.2, size: 0.03, open: false }] }],
  bodies: [
    { id: 'korek', label: 'korek', shape: 'box', w: 0.4, h: 0.3, x: 1.2, y: 2.2, material: 'cork' },
    { id: 'lod', label: 'lód', shape: 'box', w: 0.4, h: 0.3, x: 2.4, y: 2.2, material: 'ice' }, // i18n-ignore
    { id: 'stal', label: 'stal', shape: 'circle', r: 0.15, x: 3.6, y: 2.2, material: 'steel' }
  ],
  show: { vectors: ['g', 'lift'], values: true, pressure: true },
  allow: { add: false, tools: ['probe', 'ruler'] },
  view: [0, -0.3, 5.2, 2.8],
  steps: [{ say: 'Wrzuć klocki do wody.', do: 'play', wait: 4 }, { say: 'Otwórz otwór w ściance.', do: { open: 'woda', hole: 0 }, wait: 3 }] // i18n-ignore
};

export const physicsPart = definePart<Config>({
  kind: 'physics',
  label: 'moduleContent.physics.label',
  use: 'moduleContent.physics.use',
  box: { colSpan: 6, rowSpan: 5 },
  fields: [],
  read,
  hasContent: () => true,
  missing: () => null,
  shows: (c, size) => size.height === 'strip'
    ? t('moduleContent.physics.showsStrip', { title: c.title || t('moduleContent.physics.title') })
    : t(c.mode === 'sandbox' ? 'moduleContent.physics.showsSandbox' : 'moduleContent.physics.showsExperiment', { title: c.title || t('moduleContent.physics.title') }),
  fullscreen: true,
  Editor: function PhysicsEditor(props) {
    const t = useT();
    return (
      <LabEditor {...props} presets={presets} sandbox={SANDBOX} what={t('moduleContent.physics.what')} Preview={Preview}
        prompt={() => import('../../lab/physics/physText').then((m) => m.physPrompt())} />
    );
  },
  View: function PhysicsView({ config, ctx }) {
    const t = useT();
    if (ctx.size.height === 'strip' && ctx.whole !== true) {
      return (
        <div className="lab-card">
          <strong>{config.title || t('moduleContent.physics.title')}</strong>
          {config.text[0] !== undefined && <p className="wk-card-muted">{config.text[0]}</p>}
          {ctx.openWhole !== undefined && <button type="button" className="wk-btn" onClick={ctx.openWhole}>{t('moduleContent.physics.open')}</button>}
        </div>
      );
    }
    return <GoalLab config={config} whole={ctx.whole === true} moduleId={ctx.moduleId} />;
  },
  example: {
    title: 'Pływanie ciał', // i18n-ignore
    text: 'Które ciała pływają, a które toną?\nUruchom i porównaj, jak głęboko zanurzają się korek i lód.', // i18n-ignore
    mode: 'experiment',
    scene: JSON.stringify(EXAMPLE_SCENE),
    question: '<puste albo @kurs/pytanie z bazy opowieści>', // i18n-ignore
    about: '@kurs/plywanie'
  },
  extra: [
    { key: 'title', shape: 'line', says: 'moduleContent.physics.key.title' },
    { key: 'text', shape: 'lines', says: 'moduleContent.physics.key.text' },
    { key: 'mode', shape: 'line', says: 'moduleContent.physics.key.mode' },
    { key: 'scene', shape: 'json', says: 'moduleContent.physics.key.scene', inside: SCENE_DOCS },
    { key: 'question', shape: 'line', says: 'moduleContent.physics.key.question' },
    { key: 'about', shape: 'lines', says: 'moduleContent.physics.key.about' }
  ]
});

