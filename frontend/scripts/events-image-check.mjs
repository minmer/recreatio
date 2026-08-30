/** The two pure decisions in the gallery: how far a photo shrinks, and the shuffle. */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'ev-img-'));
const out = join(workspace, 'gallery.bundle.mjs');
await build({
  entryPoints: ['src/pages/events/parts/imageDownscale.ts'],
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error'
});
const q = await import(pathToFileURL(out).href);

let failed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
  else console.log(`ok   ${name}`);
};

// A 12 MP phone photo, landscape and portrait.
check('shrink: landscape 4032×3024 → 2048 long edge', q.targetSize(4032, 3024), { width: 2048, height: 1536 });
check('shrink: portrait 3024×4032 keeps its shape', q.targetSize(3024, 4032), { width: 1536, height: 2048 });
check('shrink: a panorama is bounded by its long edge', q.targetSize(8000, 1200), { width: 2048, height: 307 });
check('shrink: a small picture is left alone', q.targetSize(1200, 800), { width: 1200, height: 800 });
check('shrink: exactly at the limit is left alone', q.targetSize(2048, 1000), { width: 2048, height: 1000 });
check('shrink: never rounds a side to zero', q.targetSize(9000, 3).height, 1);
check('shrink: survives an unmeasured image', q.targetSize(0, 0), { width: 0, height: 0 });
check('shrink: the long edge is what bounds it', Math.max(...Object.values(q.targetSize(6000, 4000))), 2048);

await rm(workspace, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
