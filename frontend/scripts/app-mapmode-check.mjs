/**
 * 2026-11-24 — DIE MODI DER WELTKARTE (`src/app/cogita/worldmap/mapMode.ts`), ohne Browser: die Regeln, nach denen `composeModes`
 * die Modi (Wahl für eine Klasse, Rundgang, geführt, führend, Klasse, Schreibende, Lernender) zu EINER Karte zusammensetzt:
 *   1. Zeichnen: je Schlüssel der erste aktive Modus, der ihn setzt — auch `null`; inaktive zählen nicht;
 *   2. Klicks: der erste Modus mit Griff; ein ausschliessender schluckt, was er nicht kennt;
 *   3. Knöpfe über einem Ding: die Modi ÜBER dem zeichnenden bauen sie um (der nächste zuerst), ohne `of` niemand;
 *   4. Menü: Einträge, die einen Modus beginnen, von allen — gesperrt nur vom sperrenden; `live` vom ersten, der es setzt; der Teil der Klasse bleibt;
 *   5. Unterdrücken ODER, Kamera (vorgegeben vom ersten, gemeldet an alle), Leisten in der Reihenfolge, Wirt-Klassen und -Daten.
 *
 *   node scripts/app-mapmode-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const workspace = await mkdtemp(join(tmpdir(), 'app-mapmode-'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(join(workspace, 'entry.ts'), `export { composeModes } from '${app}cogita/worldmap/mapMode';\n`);
await build({ entryPoints: [join(workspace, 'entry.ts')], bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error', jsx: 'automatic' });
const { composeModes } = await import(pathToFileURL(join(workspace, 'entry.js')).href);

let passed = 0;
let failed = 0;
const check = (name, fn) => { try { fn(); passed += 1; console.log(`ok   ${name}`); } catch (e) { failed += 1; console.log(`FAIL ${name}: ${e.message}`); } };

const btn = (key) => ({ key, label: key, onClick: () => undefined });
try {
  check('draw: the first active mode that sets a key wins, null counts, inactive modes do not', () => {
    const c = composeModes([
      { id: 'off', active: false, draw: { route: ['x'] } },
      { id: 'top', active: true, draw: { route: null, goal: 'G' } },
      { id: 'base', active: true, draw: { route: ['a'], faint: ['b'], goal: 'H' } }
    ]);
    assert.equal(c.draw.route, null);
    assert.deepEqual(c.draw.faint, ['b']);
    assert.equal(c.draw.goal, 'G');
    assert.equal('lit' in c.draw, false);
    assert.deepEqual(c.active, ['top', 'base']);
  });
  check('pick: first handler wins; an exclusive mode swallows kinds it has no handler for', () => {
    const got = [];
    const c = composeModes([
      { id: 'sel', active: true, exclusive: true, pick: { place: (id) => got.push(`sel:${id}`) } },
      { id: 'learner', active: true, pick: { place: (id) => got.push(`l:${id}`), home: (id) => got.push(`home:${id}`), plain: () => got.push('plain') } }
    ]);
    c.pick.place('P'); c.pick.home('H'); c.pick.plain(); c.pick.lead('X');
    assert.deepEqual(got, ['sel:P']);
    const free = composeModes([{ id: 'follow', active: true }, { id: 'learner', active: true, pick: { home: (id) => got.push(`home:${id}`), plain: () => got.push('plain') } }]);
    free.pick.home('H'); free.pick.plain();
    assert.deepEqual(got, ['sel:P', 'home:H', 'plain']);
  });
  check('buttons: modes above the drawing mode rebuild them, the nearest first; without `of` nobody', () => {
    const order = [];
    const wrap = (name) => (thing, own) => { order.push(`${name}:${thing.kind}:${thing.id}`); return [btn(name), ...own]; };
    const c = composeModes([
      { id: 'a', active: true, buttons: wrap('a') },
      { id: 'teacher', active: true, buttons: wrap('teacher') },
      { id: 'learner', active: true, draw: { towerActions: { place: 'P', kind: 'place', buttons: [btn('explore')], of: { kind: 'junction', id: 'J' } } }, buttons: wrap('below') }
    ]);
    assert.deepEqual(c.draw.towerActions.buttons.map((b) => b.key), ['a', 'teacher', 'explore']);
    assert.deepEqual(order, ['teacher:junction:J', 'a:junction:J']);
    const tour = composeModes([
      { id: 'tour', active: true, draw: { towerActions: { place: 'P', buttons: [btn('tap')] } } },
      { id: 'teacher', active: true, buttons: wrap('teacher') }
    ]);
    assert.deepEqual(tour.draw.towerActions.buttons.map((b) => b.key), ['tap']);
    const none = composeModes([{ id: 'teacher', active: true, buttons: wrap('teacher') }, { id: 'sel', active: true, draw: { towerActions: null } }]);
    assert.equal(none.draw.towerActions, null);
  });
  check('menu: entries that start a mode come from all, a locking mode keeps only its own; live from the first that sets it; the class part stays', () => {
    const pick = (key) => ({ key, label: key, onPick: () => undefined });
    const modes = (lockTour) => [
      { id: 'sel', active: true, menu: { classes: [pick('1a')] } },
      { id: 'tour', active: lockTour, menu: { classes: [], live: null }, menuLocked: true },
      { id: 'host', active: true, menu: { live: { on: false, onStop: () => undefined, classes: [pick('1b')] } } },
      { id: 'teacher', active: true, menu: { classBody: 'BODY', teaching: true } }
    ];
    const open = composeModes(modes(false));
    assert.deepEqual(open.menu.classes.map((c) => c.key), ['1a']);
    assert.deepEqual(open.menu.live.classes.map((c) => c.key), ['1b']);
    assert.equal(open.menu.classBody, 'BODY');
    assert.equal(open.menu.teaching, true);
    const locked = composeModes(modes(true));
    assert.deepEqual(locked.menu.classes, []);
    assert.equal(locked.menu.live, null);
    assert.equal(locked.menu.classBody, 'BODY');
    const viewing = composeModes([{ id: 'view', active: true, menu: { live: null } }, ...modes(false)]);
    assert.equal(viewing.menu.live, null);
    assert.deepEqual(viewing.menu.classes.map((c) => c.key), ['1a']);
  });
  check('suppress OR, camera, slots in order, host class and data', () => {
    const sent = [];
    const cam = { x: 1, y: 2, z: 3 };
    const c = composeModes([
      { id: 'view', active: true, camera: { follow: null }, suppress: { tour: true, invite: true }, hostClass: 'is-follow', hostData: { 'data-world-following': '1' }, banner: 'B1' },
      { id: 'host', active: true, camera: { onCamera: (x) => sent.push(['host', x]) }, banner: 'B2', bar: null },
      { id: 'tour', active: true, suppress: { side: true }, camera: { follow: cam, onCamera: (x) => sent.push(['tour', x]) } }
    ]);
    assert.equal(c.suppress.tour && c.suppress.invite && c.suppress.side, true);
    assert.equal(c.suppress.playback || c.suppress.hover || c.suppress.full, false);
    assert.equal(c.camera.following, true);
    assert.equal(c.camera.follow, null);
    c.camera.onCamera(cam);
    assert.deepEqual(sent.map((s) => s[0]), ['host', 'tour']);
    assert.deepEqual(c.banner.map((b) => [b.key, b.props.children]), [['view', 'B1'], ['host', 'B2']]);
    assert.equal(c.bar, null);
    assert.equal(c.hostClass, 'is-follow');
    assert.deepEqual(c.hostData, { 'data-world-following': '1' });
    const free = composeModes([{ id: 'learner', active: true }]);
    assert.equal(free.camera.following, false);
    assert.equal(free.camera.onCamera, undefined);
    assert.equal(free.hostClass, '');
  });
} finally {
  await rm(workspace, { recursive: true, force: true });
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
