/**
 * PRACOWNIA FIZYCZNA (2026-10-18) — `fixtures/lab-fizyka.json`: eine Seite
 * (Format jeder Seite, "recreatio/page") mit dem Labor als Bausteinen — die
 * fertigen Versuche (`lab/physics/physPresets.ts`) als Doświadczenia, dazu eine
 * Piaskownica.
 *
 * Importiert auf einer Seite (Edytuj stronę → Importuj JSON) steht danach eine
 * ganze Pracownia. Die Szenen sind dieselben Dokumente, die der Editor einsetzt.
 *
 * Bevor geschrieben wird, prüft das Skript jede Szene: sie baut eine Welt, die
 * drei Sekunden laufen ohne NaN, und die Seite importiert sich (wie „Importuj
 * JSON”) ohne Warnung.
 *
 *   node scripts/lab-examples.mjs
 */

import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'lab-examples-'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
try {
  await build({
    stdin: {
      contents: `
export { PHYS_PRESETS, SANDBOX_SCENE } from '${app}lab/physics/physPresets';
export { readPhysScene, buildWorld, drawScene } from '${app}lab/physics/physScene';
export { STEP as PSTEP } from '${app}lab/physics/physWorld';
export { planImport, DEFAULT_IMPORT } from '${app}pages/pageJson';
`,
      resolveDir: process.cwd(),
      loader: 'ts'
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: join(workspace, 'lab.mjs'),
    define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
    loader: { '.css': 'empty' },
    logLevel: 'error'
  });
  /* Wie in app-json-check: ein BroadcastChannel des Schlüsselbunds hielte den Lauf sonst am Leben. */
  globalThis.BroadcastChannel = undefined;
  const m = await import(pathToFileURL(join(workspace, 'lab.mjs')).href);

  for (const p of m.PHYS_PRESETS) {
    const scene = m.readPhysScene(p.scene);
    const world = m.buildWorld(scene, m.drawScene(scene, 'check'));
    for (let i = 0; i < Math.round(3 / m.PSTEP); i += 1) world.step(m.PSTEP);
    for (const b of world.bodies) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), `${p.key}: ${b.id} stays finite`);
  }
  console.log(`ok   ${m.PHYS_PRESETS.length} physics experiments run without errors`);

  const theme = (accent) => ({ mode: 'light', accent, ink: '#13212b', ground: '#f6f8f7', muted: '#5b6b74' });
  const text = (id, title, body, size = { colSpan: 6, rowSpan: 2 }) => ({ id, kind: 'text', size, config: { title, body } });
  const lab = (key, p) => ({
    id: `physics-${key}`,
    kind: 'physics',
    size: { colSpan: 6, rowSpan: 5 },
    config: { title: p.title, text: [...p.text], mode: 'experiment', scene: p.scene }
  });

  const phys = {
    format: 'recreatio/page',
    version: 1,
    path: 'pracownia-fizyczna',
    title: 'Pracownia fizyczna',
    lead: 'Doświadczenia szkolne w laboratorium fizyki 2D: ciała z prawdziwych materiałów, wahadła, sprężyny, bloczki, zderzenia i ciecze. Start uruchamia czas, „Pokaż” prowadzi krok po kroku.',
    mode: 'page',
    theme: theme('#1f6f8b'),
    modules: [
      text('fiz-wstep', 'Jak pracować w laboratorium', [
        'Przeciągnij ciało, żeby je przesunąć (gdy czas stoi) albo rzucić (gdy płynie). Dwa palce przybliżają, przycisk w rogu otwiera pełny ekran.',
        '## Pomiary',
        'Linijka mierzy odległości, sonda — ciśnienie w cieczy; wykres pokazuje wysokość, prędkość albo energię w czasie.'
      ].join('\n')),
      ...m.PHYS_PRESETS.map((p) => lab(p.key, p)),
      { id: 'physics-piaskownica', kind: 'physics', size: { colSpan: 6, rowSpan: 5 }, config: { title: 'Piaskownica fizyczna', text: ['Dodawaj ciała, łącz je linami, prętami i sprężynami, nalewaj ciecze.'], mode: 'sandbox', scene: m.SANDBOX_SCENE } }
    ]
  };

  /* Die Seite importiert sich wie mit „Importuj JSON” — ohne Warnung, jeder Baustein mit seinem Platz. */
  const doc = JSON.parse(JSON.stringify(phys));
  const now = { path: phys.path, title: '', lead: '', mode: 'page', look: { theme: phys.theme, cover: [] }, parts: [], logic: null, menu: null };
  const plan = m.planImport(doc, now, { ...m.DEFAULT_IMPORT, replace: true });
  assert.ok(!('error' in plan), `${phys.path}: imports (${plan.error ?? ''})`);
  assert.deepEqual(plan.warnings, [], `${phys.path}: no warnings`);
  assert.equal(plan.parts.length, phys.modules.length, `${phys.path}: every module arrives`);
  console.log('ok   the page imports without warnings');

  await writeFile(join(process.cwd(), 'scripts', 'fixtures', 'lab-fizyka.json'), `${JSON.stringify(phys, null, 1)}\n`, 'utf8');
  console.log('written: scripts/fixtures/lab-fizyka.json');
} finally {
  await rm(workspace, { recursive: true, force: true });
}
