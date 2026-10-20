/**
 * LABORATORIUM 2D (v2) — DIE BENCHMARK-SZENE (Prompt v2: „keep one benchmark
 * scene and log its timing per stage at every milestone“): die Zlewka mit
 * Kamyczki auf der Heizplatte, Wasser bei 98 °C (das Voreinstellungs-Szenario
 * „wrzenie“: siedet sofort), kopflos in Node. Gibt je Stufe die Millisekunden
 * je Schritt aus, dazu die CG-Iterationen (Flüssigkeit/Gas/Wärme), die
 * Teilschritte des Gastransports und die Zeit je 60-Hz-Bild (zwei Schritte
 * zu 1/120 s). Die Zahlen gehören in documentation/lab2d/MILESTONES.md.
 *
 *   node scripts/lab2d-bench.mjs                      high und medium, 300 Schritte Anlauf, 300 gemessen
 *   node scripts/lab2d-bench.mjs very-high 120 200    eine Stufe, Anlauf, Messung
 *
 * Auf einem ruhigen Rechner messen (keine Tests nebenher).
 */

import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'lab2d-bench-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export { Engine } from '${app}lab/lab2d/engine/engine';
export { LAB2D_PRESETS } from '${app}lab/lab2d/presets';
export { STAGES } from '${app}lab/lab2d/engine/stages';
`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: join(workspace, 'entry.mjs'), loader: { '.json': 'json' }, logLevel: 'error' });

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const qualities = process.argv[2] !== undefined ? [process.argv[2]] : ['high', 'medium'];
  const warm = Number(process.argv[3] ?? 300);
  const steps = Number(process.argv[4] ?? 300);
  const preset = m.LAB2D_PRESETS.find((p) => p.key === 'wrzenie');
  for (const quality of qualities) {
    const e = new m.Engine({ ...preset.scene, quality });
    for (let k = 0; k < warm; k += 1) e.step();
    const sum = new Float64Array(m.STAGES.length);
    let total = 0;
    const it = [0, 0, 0];
    let sub = 0;
    let bubbles = 0;
    for (let k = 0; k < steps; k += 1) {
      e.step();
      for (let s = 0; s < m.STAGES.length; s += 1) sum[s] += e.timings[s];
      total += e.stepMs;
      const st = e.stats();
      it[0] += st.liquid.iterations;
      it[1] += st.gas.iterations;
      it[2] += st.heat.iterations;
      sub += st.gasSubsteps;
      bubbles += st.bubbles;
    }
    const s = e.stats();
    const per = (x) => (x / steps).toFixed(2);
    console.log(`${quality}: ${s.nx}×${s.ny} cells (Δx ${(s.dx * 1000).toFixed(0)} mm), ${s.particles} particles, ${per(bubbles)} bubbles on average, t = ${s.time.toFixed(2)} s`);
    console.log(`  ${m.STAGES.map((name, k) => `${name} ${per(sum[k])}`).join(' · ')}`);
    console.log(`  step ${per(total)} ms · 60 Hz frame (2 steps) ${(2 * total / steps).toFixed(2)} ms · real time ×${(1000 / 120 / (total / steps)).toFixed(2)} · CG ${per(it[0])}/${per(it[1])}/${per(it[2])} · gas substeps ${per(sub)} · capped ${s.capped}`);
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}
