/**
 * PRACOWNIE (2026-10-18) — `fixtures/lab-chemia.json` und `fixtures/lab-fizyka.json`:
 * je eine Seite (Format jeder Seite, "recreatio/page") mit den Laboren als
 * Bausteinen — die fertigen Versuche (`lab/chem/chemPresets.ts`,
 * `lab/physics/physPresets.ts`) als Doświadczenia, dazu eine Piaskownica.
 *
 * Importiert auf einer Seite (Edytuj stronę → Importuj JSON) steht danach eine
 * ganze Pracownia: jeder Baustein mit Text für die Schüler, Schritten und
 * „Pokaż”. Die Szenen sind dieselben Dokumente, die der Editor einsetzt.
 *
 * Bevor geschrieben wird, prüft das Skript jede Szene: sie baut eine Welt,
 * und die Schritte (bzw. ein paar Sekunden Physik) laufen ohne Fehler und ohne
 * NaN; und beide Seiten importieren sich (wie „Importuj JSON”) ohne Warnung.
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
export { CHEM_PRESETS, SANDBOX_CHEM } from '${app}lab/chem/chemPresets';
export { readChemScene, buildLab, drawChem } from '${app}lab/chem/chemScene';
export { STEP as CSTEP } from '${app}lab/chem/chemBench';
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

  /* Jede Szene einmal laufen lassen (mit ihren Schritten): keine Ausnahme, keine NaN. */
  for (const p of m.CHEM_PRESETS) {
    const scene = m.readChemScene(p.scene);
    const lab = m.buildLab(scene, m.drawChem(scene, 'check'));
    for (const step of scene.steps) {
      for (const a of step.do) {
        const v = lab.vessel(a.to ?? a.at ?? a.from ?? '');
        if (a.kind === 'add' && v !== undefined && typeof a.reagent === 'string' && !a.reagent.includes('{')) lab.add(v, a.reagent, typeof a.amount === 'number' ? a.amount : 1);
        if (a.kind === 'burner') { const b = lab.burners.find((x) => x.id === a.id); if (b) b.on = a.on; }
      }
      for (let i = 0; i < Math.round(Math.min(20, step.wait + 2) / m.CSTEP); i += 1) lab.step(m.CSTEP);
    }
    for (const v of lab.vessels) assert.ok(Number.isFinite(v.T) && Number.isFinite(v.spec.pH) && Number.isFinite(v.gasTotal()), `${p.key}: ${v.id} stays finite`);
  }
  for (const p of m.PHYS_PRESETS) {
    const scene = m.readPhysScene(p.scene);
    const world = m.buildWorld(scene, m.drawScene(scene, 'check'));
    for (let i = 0; i < Math.round(3 / m.PSTEP); i += 1) world.step(m.PSTEP);
    for (const b of world.bodies) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), `${p.key}: ${b.id} stays finite`);
  }

  const text = (id, title, body) => ({ id, kind: 'text', size: { colSpan: 6, rowSpan: 2 }, config: { title, body } });
  const lab = (kind, key, p) => ({
    id: `${kind}-${key}`,
    kind,
    size: { colSpan: 6, rowSpan: 5 },
    config: { title: p.title, text: [...p.text], mode: 'experiment', scene: p.scene }
  });
  const sandbox = (kind, title, intro, scene) => ({ id: `${kind}-piaskownica`, kind, size: { colSpan: 6, rowSpan: 5 }, config: { title, text: intro, mode: 'sandbox', scene } });
  const theme = (accent) => ({ mode: 'light', accent, ink: '#13212b', ground: '#f6f8f7', muted: '#5b6b74' });

  const chem = {
    format: 'recreatio/page',
    version: 1,
    path: 'pracownia-chemiczna',
    title: 'Pracownia chemiczna',
    lead: 'Doświadczenia szkolne w laboratorium 2D: weź odczynnik z półki i dotknij naczynia, przeciągnij naczynie nad inne, żeby przelać, postaw je na trójnogu nad palnikiem. „Pokaż” przeprowadza doświadczenie krok po kroku.',
    mode: 'page',
    theme: theme('#2f7d5b'),
    modules: [
      text('chem-wstep', 'Jak pracować w laboratorium', [
        'Każde doświadczenie ma opis, kroki i przycisk „Pokaż”. Czasem przed krokiem pada pytanie — najpierw przewiduj, potem patrz.',
        '## Co widać',
        'Pod naczyniami: temperatura, pH i ciśnienie. Dotknij naczynia, żeby zobaczyć skład gazu i roztworu, a pod lupą — cząsteczki i jony.',
        '## Obserwacje',
        'Wszystko, co się dzieje (gaz, osad, zmiana barwy, ciepło), trafia do obserwacji razem z równaniem reakcji.'
      ].join('\n')),
      ...m.CHEM_PRESETS.map((p) => lab('chemistry', p.key, p)),
      sandbox('chemistry', 'Piaskownica chemiczna', ['Wszystkie odczynniki, naczynia i narzędzia — sprawdzaj własne pomysły.', 'Gotowe doświadczenia wczytasz w sekcji „Doświadczenia i zapis”.'], m.SANDBOX_CHEM)
    ]
  };
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
      ...m.PHYS_PRESETS.map((p) => lab('physics', p.key, p)),
      sandbox('physics', 'Piaskownica fizyczna', ['Dodawaj ciała, łącz je linami, prętami i sprężynami, nalewaj ciecze.'], m.SANDBOX_SCENE)
    ]
  };

  /* Beide Seiten importieren sich wie mit „Importuj JSON” — ohne Warnung, jeder Baustein mit seinem Platz. */
  for (const page of [chem, phys]) {
    const doc = JSON.parse(JSON.stringify(page));
    const now = { path: page.path, title: '', lead: '', mode: 'page', look: { theme: page.theme, cover: [] }, parts: [], logic: null, menu: null };
    const plan = m.planImport(doc, now, { ...m.DEFAULT_IMPORT, replace: true });
    assert.ok(!('error' in plan), `${page.path}: imports (${plan.error ?? ''})`);
    assert.deepEqual(plan.warnings, [], `${page.path}: no warnings`);
    assert.equal(plan.parts.length, page.modules.length, `${page.path}: every module arrives`);
  }
  console.log('ok   both pages import without warnings');

  const out = (name) => join(process.cwd(), 'scripts', 'fixtures', name);
  await writeFile(out('lab-chemia.json'), `${JSON.stringify(chem, null, 1)}\n`, 'utf8');
  await writeFile(out('lab-fizyka.json'), `${JSON.stringify(phys, null, 1)}\n`, 'utf8');
  console.log(`ok   ${m.CHEM_PRESETS.length} chemistry and ${m.PHYS_PRESETS.length} physics experiments run without errors`);
  console.log('written: scripts/fixtures/lab-chemia.json, scripts/fixtures/lab-fizyka.json');
} finally {
  await rm(workspace, { recursive: true, force: true });
}
