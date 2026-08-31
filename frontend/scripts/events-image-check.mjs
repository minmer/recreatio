/** The gallery's arithmetic: shrinking a photo, the zoom, the counts, the memes. */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'ev-img-'));
await build({
  entryPoints: [
    'src/pages/events/parts/imageDownscale.ts',
    'src/pages/events/parts/galleryZoom.ts',
    'src/pages/events/parts/galleryCount.ts',
    'src/pages/events/parts/memeCanvas.ts'
  ],
  bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error'
});
const q = await import(pathToFileURL(join(workspace, 'imageDownscale.js')).href);
const z = await import(pathToFileURL(join(workspace, 'galleryZoom.js')).href);
const c = await import(pathToFileURL(join(workspace, 'galleryCount.js')).href);
const m = await import(pathToFileURL(join(workspace, 'memeCanvas.js')).href);

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


// Polish counts three ways, and a gallery says its size on every visit.
check('count: one', c.photoCount(1), '1 zdjęcie');
check('count: a few', c.photoCount(3), '3 zdjęcia');
check('count: many', c.photoCount(8), '8 zdjęć');
check('count: the teens are all zdjęć', c.photoCount(13), '13 zdjęć');
check('count: twenty-two takes zdjęcia again', c.photoCount(22), '22 zdjęcia');
check('count: twenty-five does not', c.photoCount(25), '25 zdjęć');
check('count: none', c.photoCount(0), '0 zdjęć');


// ── The meme's arithmetic ────────────────────────────────────────────────────

const layout = m.memeLayout(1200, 900);
check('meme: a wide picture comes down to 1080', layout.width, 1080);
check('meme: the crop keeps its proportions', layout.imageHeight, 810);
truth('meme: the band is about a fifth of the whole', Math.abs(layout.barHeight / layout.height - 0.22) < 0.01);
truth('meme: picture plus band is the whole height', layout.imageHeight + layout.barHeight === layout.height);

const tall = m.memeLayout(600, 1200, 0.18);
truth('meme: a portrait picture is not enlarged', tall.width === 600);
truth('meme: a lower band is honoured', Math.abs(tall.barHeight / tall.height - 0.18) < 0.01);

// A ruler of our own: every character is half the font size wide.
const ruler = (text, size) => text.length * size * 0.5;

check('meme: a short caption stays on one line',
  m.wrapLines('Ale zjazd', 40, 1000, ruler).length, 1);
check('meme: a long caption breaks into lines',
  m.wrapLines('Kiedy myslisz ze to juz koniec podjazdu a za zakretem jest jeszcze jeden', 40, 400, ruler).length > 2, true);
truth('meme: no line is wider than the band',
  m.wrapLines('Kiedy myslisz ze to juz koniec podjazdu a za zakretem jest jeszcze jeden', 40, 400, ruler)
    .every((line) => ruler(line, 40) <= 400));
truth('meme: one endless word is cut rather than left hanging out',
  m.wrapLines('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 40, 200, ruler).every((line) => ruler(line, 40) <= 200));
check('meme: nothing to wrap is no lines', m.wrapLines('   ', 40, 400, ruler).length, 0);

const fit = m.fitCaption('Krotki podpis', layout, ruler);
truth('meme: the caption fits inside the band',
  fit.lines.length * fit.lineHeight <= layout.barHeight);
truth('meme: a short caption is set large', fit.fontSize > layout.barHeight * 0.3);

const long = m.fitCaption('Kiedy myslisz ze to juz koniec podjazdu a za zakretem jest jeszcze jeden i jeszcze jeden', layout, ruler);
truth('meme: a long caption is set smaller than a short one', long.fontSize < fit.fontSize);
truth('meme: even a long caption stays inside the band',
  long.lines.length * long.lineHeight <= layout.barHeight);

// The crop arrives as fractions of the picture and must never read past its edge.
check('meme: a crop becomes pixels', m.cropInPixels({ x: 0.25, y: 0.5, width: 0.5, height: 0.25 }, 1000, 800),
  { x: 250, y: 400, width: 500, height: 200 });
check('meme: a crop dragged past the corner is trimmed',
  m.cropInPixels({ x: 0.8, y: 0.8, width: 0.9, height: 0.9 }, 1000, 1000),
  { x: 800, y: 800, width: 200, height: 200 });
check('meme: a negative crop is pulled back inside',
  m.cropInPixels({ x: -0.5, y: -0.5, width: 0.5, height: 0.5 }, 1000, 1000),
  { x: 0, y: 0, width: 500, height: 500 });


process.exit(failed === 0 ? 0 : 1);
