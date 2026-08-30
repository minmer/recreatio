/** The gallery's two pieces of arithmetic: how far a photo shrinks, and the zoom. */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'ev-img-'));
await build({
  entryPoints: ['src/pages/events/parts/imageDownscale.ts', 'src/pages/events/parts/galleryZoom.ts'],
  bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error'
});
const q = await import(pathToFileURL(join(workspace, 'imageDownscale.js')).href);
const z = await import(pathToFileURL(join(workspace, 'galleryZoom.js')).href);

let failed = 0;
const near = (a, b) => Math.abs(a - b) < 0.001;
const truth = (name, passed) => { if (passed) console.log(`ok   ${name}`); else { failed += 1; console.error(`FAIL ${name}`); } };
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
const frame = { width: 1000, height: 800 };

truth('fit is the floor: zooming out never goes below 1', z.zoomAbout({ scale: 1, x: 0, y: 0 }, 0.5, { x: 0, y: 0 }).scale === 1);
truth('zooming out returns to dead centre', JSON.stringify(z.zoomAbout({ scale: 2, x: 120, y: -40 }, 0.9, { x: 10, y: 10 })) === JSON.stringify({ scale: 1, x: 0, y: 0 }));
truth('scale is capped at 5', z.zoomAbout({ scale: 4, x: 0, y: 0 }, 12, { x: 0, y: 0 }).scale === 5);

// Zooming about the middle keeps the middle still.
const centred = z.zoomAbout({ scale: 1, x: 0, y: 0 }, 2, { x: 0, y: 0 });
truth('zooming about the centre does not shift the picture', centred.x === 0 && centred.y === 0);

// Zooming about a point keeps that point under the cursor: at scale 2 about
// (100,0), the content there must not move.
const about = z.zoomAbout({ scale: 1, x: 0, y: 0 }, 2, { x: 100, y: 0 });
truth('the pixel under the cursor stays under the cursor', near(about.x, -100));

truth('panning is bounded by how far the picture actually overhangs',
  JSON.stringify(z.clampView({ scale: 2, x: 9999, y: -9999 }, frame)) === JSON.stringify({ scale: 2, x: 500, y: -400 }));
truth('a fitted picture cannot be panned at all',
  JSON.stringify(z.clampView({ scale: 1, x: 200, y: 200 }, frame)) === JSON.stringify({ scale: 1, x: 0, y: 0 }));
truth('a modest pan inside the bounds is left alone',
  JSON.stringify(z.clampView({ scale: 2, x: 100, y: 50 }, frame)) === JSON.stringify({ scale: 2, x: 100, y: 50 }));


process.exit(failed === 0 ? 0 : 1);
