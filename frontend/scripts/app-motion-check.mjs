/**
 * RUCH, RYSUNEK I POKAZ COGITA (0107, 0108) — was ohne Browser nachzumessen ist.
 *
 *   1. Das Wörterbuch: Grundwörter (move, size, turn, fade, draw, color,
 *      reveal, keys) und die Vorlagen des Altbestands; Werte aus Reglern;
 *      duldsames Lesen, knappes Schreiben.
 *   2. Die Bilder für element.animate(): eigene Eigenschaften (translate,
 *      scale, rotate), jedes Bild nennt nur, was in ihm steht (dazwischen geht
 *      ein Wert in einem Zug), Farben des Themas, Schein, Ausschnitt; `draw`
 *      teilt eine Linie so, dass auch < 0 und > 1 etwas bedeuten.
 *   3. Die Zeichnung: lesen (Arten, Grenzen, sichere Pfade und Adressen),
 *      zählen, und gezeichnet (Server-Render) — Rahmen der Bewegungen, Farbe
 *      und Zeichnen auf der Fläche, Vorlagen, Verläufe; still ohne Rahmen.
 *   4. Die Präsentation: der Wechsel „dissolve", das gemeinsame Tuch und die
 *      Breite der Bühne, Bewegungen an Bausteinen — lesen und knapp schreiben.
 *   5. Das Dokument (`fixtures/cogita-home.json`): eine Präsentation, deren
 *      Bilder nur aus allgemeinen Wörtern bestehen; importiert ohne Warnung,
 *      passt in die Grenzen, kommt unverändert wieder heraus; der Server
 *      zeichnet sieben Szenen, das Tuch, fünf Zeichnungen, das Zeichen.
 */

import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-motion-'));
const entry = join(workspace, 'entry.tsx');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}pages/motion/motion';
export { readDrawing, drawingOf, shapeCount, motionCount, safePath, safeUrl, fillValue, radialOf, DRAWING_LIMITS } from '${app}pages/motion/drawing';
export { DrawingView } from '${app}pages/motion/DrawingView';
export { sceneState, zonesOf, DISSOLVE_SCENE } from '${app}pages/presentation/presentationMotion';
export { readShow, showJson, readPiece, readPieceValue, pieceJson, NO_SHOW, SCENE_CHANGES } from '${app}pages/presentation/presentation';
export { planImport, exportPage, DEFAULT_IMPORT } from '${app}pages/pageJson';
export { pageDescription } from '${app}pages/pageJsonText';
export { partOf } from '${app}pages/parts/registry';
export { PagePresentation } from '${app}pages/presentation/PagePresentation';
export { renderToStaticMarkup } from 'react-dom/server';
export { createElement } from 'react';
`);
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  nodePaths: [join(process.cwd(), 'node_modules')],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
});

globalThis.BroadcastChannel = undefined;
const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/** Der Server kennt keine Layout-Effekte — diese eine Warnung ist hier kein Fehler. */
function quietly(render) {
  const said = console.error;
  console.error = (...args) => { if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) said(...args); };
  try { return render(); } finally { console.error = said; }
}

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);
  const use = (value) => m.readMotionUse(value);

  /* -- 1. Das Wörterbuch -------------------------------------------------------------------- */
  {
    const verbs = m.MOTIONS.filter((d) => d.verb).map((d) => d.name);
    assert.deepEqual(verbs, ['move', 'size', 'turn', 'fade', 'draw', 'color', 'reveal', 'keys'], 'the plain words');
    assert.equal(new Set(m.MOTION_NAMES).size, m.MOTIONS.length, 'names are unique');
    for (const def of m.MOTIONS) {
      assert.ok(def.label.length > 2 && def.says.length > 10 && def.duration > 0, `${def.name}: named, said, timed`);
      for (const [key, p] of Object.entries(def.params)) assert.ok(p.min <= p.value && p.value <= p.max, `${def.name}.${key}: default within its range`);
      if (def.verb) continue;
      assert.ok(def.frames.length >= 2 && def.frames[0].at === 0 && def.frames.at(-1).at === 1, `${def.name}: frames from 0 to 1`);
      for (let i = 1; i < def.frames.length; i += 1) assert.ok(def.frames[i].at > def.frames[i - 1].at, `${def.name}: frames in order`);
      assert.ok(def.legacy !== null, `${def.name}: says where it comes from`);
      const frames = m.keyframesOf(use(def.name));
      assert.equal(frames.length, def.frames.length);
      const keys = JSON.stringify(Object.keys(frames[0]).filter((k) => k !== 'easing').sort());
      for (const f of frames) assert.equal(JSON.stringify(Object.keys(f).filter((k) => k !== 'easing').sort()), keys, `${def.name}: every frame of a preset names the same properties`);
    }
    for (const name of ['rise', 'assemble', 'focus', 'float', 'breathe', 'glow', 'drift', 'sway', 'wave', 'blink']) assert.ok(m.motionDef(name) && !m.motionDef(name).verb, `the legacy preset ${name}`);

    assert.equal(m.amount('x0 - 0.6*x', { x0: 1, x: 10 }), -5);
    assert.equal(m.amount('1 + stretch', { stretch: 0.2 }), 1.2);
    assert.equal(m.amount('-shift', { shift: 1 }), -1);
    assert.equal(m.amount('y', {}), 0, 'an unknown knob counts 0');

    assert.equal(use({ name: 'nonsense' }), null);
    assert.deepEqual(m.readMotions([{ name: 'rise' }, 'float', { name: 'nope' }, 'glow', 'blink']).map((u) => u.name), ['rise', 'float', 'glow'], 'at most three, unknown dropped first');
    assert.deepEqual(m.unknownMotions([{ name: 'rise' }, 'wiggle', { name: 'shake' }]), ['wiggle', 'shake']);
    assert.equal(use({ name: 'float', x: 999 }).params.x, 200, 'knobs are clamped');
    assert.equal(use({ name: 'rise', delay: -100 }).delay, 0, 'an entrance does not start in the past');
    assert.equal(use({ name: 'sway', delay: -100000 }).delay, -100000, 'a loop may start in the middle');
    assert.deepEqual(use({ name: 'move', to: [40, -12], from: 'x' }).to, [40, -12]);
    assert.equal(use({ name: 'move', path: [[0, 0]] }).path, null, 'a way needs two points');
    assert.equal(use({ name: 'move', path: [[0, 0], [1, 1]], times: [0] }).times, null, 'times must match the way');
    assert.equal(use({ name: 'color', to: 'red;}' }).to, null, 'a colour that would end a style is refused');
    assert.equal(use({ name: 'keys', keys: [{ at: 2, x: 1 }, { at: -1, opacity: 9 }, { x: 3 }] }).keys.length, 2, 'a frame without "at" drops out');
    assert.deepEqual(use({ name: 'keys', keys: [{ at: 0.5, opacity: 9, draw: 99, clip: 'url(x)', ease: 'wobble' }] }).keys, [{ at: 0.5, opacity: 1, draw: 10 }], 'values are clamped, unknown words dropped');
    assert.deepEqual(m.motionsJson(m.readMotions({ name: 'rise', delay: 1000 })), { name: 'rise', delay: 1000 }, 'one motion: an object, compact');
    assert.deepEqual(m.motionsJson(m.readMotions(['rise', { name: 'float', x: 2 }])), [{ name: 'rise' }, { name: 'float', x: 2 }], 'several: a list');
    assert.equal(m.motionsJson([]), undefined);
    const keyed = { name: 'keys', duration: 900, repeat: 'loop', ease: 'inOut', keys: [{ at: 0, x: 1, color: 'accent/35' }, { at: 1, x: 2, glow: '0 0 8px ink' }] };
    assert.deepEqual(m.motionUseJson(use(keyed)), { ...keyed, keys: [{ at: 0, x: 1, color: 'accent/35' }, { at: 1, x: 2, glow: '0px 0px 8px ink' }] }, 'keys round-trip');
    assert.ok(m.isOnce(use('rise')) && !m.isOnce(use('float')) && m.isOnce(use({ name: 'float', repeat: 2 })) && !m.isOnce(use({ name: 'move', repeat: 'loop' })));
    const said = m.motionDescription();
    for (const def of m.MOTIONS) assert.ok(said.includes(`"${def.name}" — ${def.label}`), `the description names ${def.name}`);
    for (const key of ['"reveal" 0–1', '"clip"', '"glow"', '"stroke"', '"draw"']) assert.ok(said.includes(key), `the description explains ${key}`);
    ok(`vocabulary: ${verbs.length} plain words and ${m.MOTIONS.length - verbs.length} legacy presets; knobs, tolerant reading, compact JSON`);
  }

  /* -- 2. Die Bilder ------------------------------------------------------------------------- */
  {
    assert.deepEqual(m.keyframesOf(use({ name: 'rise', y: 10 })), [
      { offset: 0, translate: '0px 10px', opacity: 0, easing: 'ease' }, { offset: 1, translate: '0px 0px', opacity: 1 }
    ], 'cogita-text-delayed: from 10 px below, transparent');
    assert.deepEqual(m.timingOf(use('rise')), { duration: 520, delay: 220, easing: 'linear', iterations: 1, direction: 'normal', fill: 'both' }, '520 ms after 220 ms, held before and after; the easing lives in the frames');
    assert.equal(m.keyframesOf(use({ name: 'float', x: 6, y: 8 }))[1].translate, '6px 8px', 'cogita-bubble-wave');
    const sway = m.keyframesOf(use({ name: 'sway', x: 3, y: 6, stretch: 0.1 }));
    assert.deepEqual([sway[1].translate, sway[1].scale], ['3% 6%', '1 1.1'], 'cogita-mesh-layer 14 %');
    assert.deepEqual([sway[2].translate, sway[2].scale], ['-1.8% 2.4%', '1 0.9'], 'cogita-mesh-layer 29 %');
    assert.equal(m.timingOf(use('drift')).direction, 'alternate', 'cogita-depth goes back and forth');
    assert.equal(m.timingOf(use('float')).iterations, Infinity);
    assert.equal(m.timingOf(use({ name: 'turn', repeat: 3 })).iterations, 3);
    assert.equal(m.keyframesOf(use('focus'))[0].filter, 'blur(2px)', 'the slide change: blur 2 px');

    /* Die Grundwörter. */
    assert.deepEqual(m.keyframesOf(use({ name: 'move', to: [40, -12] })).map((f) => f.translate), ['0px 0px', '40px -12px']);
    const way = m.keyframesOf(use({ name: 'move', path: [[0, 0], [10, 0], [10, 10]], times: [0, 0.8, 1] }));
    assert.deepEqual(way.map((f) => [f.offset, f.translate]), [[0, '0px 0px'], [0.8, '10px 0px'], [1, '10px 10px']], 'a way through points, at its own times');
    assert.deepEqual(m.keyframesOf(use({ name: 'size', from: 1, to: [2, 0.5] })).map((f) => f.scale), ['1 1', '2 0.5']);
    const turn = m.keyframesOf(use({ name: 'turn', to: 180 }));
    assert.deepEqual([turn[0].rotate, turn[1].rotate, turn[0].easing], ['0deg', '180deg', 'linear'], 'turning is even by default');
    assert.deepEqual(m.keyframesOf(use({ name: 'fade', from: 0.2, to: 0.8 })).map((f) => f.opacity), [0.2, 0.8]);
    assert.deepEqual(m.keyframesOf(use({ name: 'reveal' })).map((f) => f.clipPath), ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'], 'revealed from the left');
    const color = m.keyframesOf(use({ name: 'color', from: '#8cc8ff', to: 'accent/35' }), 'svg');
    assert.deepEqual(color.map((f) => f.fill), ['#8cc8ff', 'color-mix(in srgb, var(--wk-accent) 35%, transparent)'], 'theme names follow the scene, /35 mixes with transparent');
    assert.equal(m.keyframesOf(use({ name: 'color', to: 'ink' }), 'html')[1].color, 'var(--wk-ink)', 'on a page it is the text colour');

    /* draw: ein Strich zehnmal so lang wie die Linie, eine Lücke viermal — 0 nichts, 1 alles, > 1 früher fertig, < 0 später dran. */
    assert.deepEqual(m.keyframesOf(use('draw')).map((f) => f.strokeDashoffset), ['10', '9']);
    assert.equal(m.dashArray(1), '10 4');
    assert.equal(m.dashOf(use('draw')), 1, 'in a drawing every line measures 1 (pathLength)');
    assert.equal(m.dashOf(use({ name: 'draw', length: 420 })), 420, 'outside a drawing: its own length');
    const visible = (draw) => {
      /* Wie viel von [0, 1] im Strich liegt (Muster 10 + 4, verschoben um 10 − draw). */
      let seen = 0;
      for (let i = 0; i < 1000; i += 1) { const p = (i + 0.5) / 1000; const q = ((p + (10 - draw)) % 14 + 14) % 14; if (q < 10) seen += 1; }
      return seen / 1000;
    };
    assert.ok(close(visible(0), 0, 0.002) && close(visible(0.25), 0.25, 0.002) && close(visible(1), 1, 0.002), 'draw is the drawn share');
    assert.ok(close(visible(1.245), 1) && close(visible(8.45), 1) && close(visible(-2), 0), 'over 1: whole; under 0: nothing');

    /* Jedes Bild nennt nur, was in ihm steht: dazwischen geht der Weg in einem Zug. */
    const flow = m.keyframesOf(use({ name: 'keys', keys: [{ at: 0, x: 0, opacity: 0 }, { at: 0.35, opacity: 1 }, { at: 0.55, x: 100, y: 20 }, { at: 1, opacity: 0 }] }));
    assert.equal(flow[1].translate, undefined, 'a frame that only fades does not stop the way');
    assert.equal(flow[2].opacity, undefined);
    assert.deepEqual([flow[0].translate, flow[0].opacity, flow[3].translate, flow[3].opacity], ['0px 0px', 0, '100px 20px', 0], 'y not named: 0; after its last frame a value stays');
    const later = m.keyframesOf(use({ name: 'keys', keys: [{ at: 0, opacity: 0 }, { at: 0.5, x: 10, color: 'ink' }, { at: 1, opacity: 1 }] }), 'svg');
    assert.deepEqual([later[0].translate, later[0].fill, later[2].translate, later[2].fill], [undefined, undefined, '10px 0px', 'var(--wk-ink)'], 'before its first frame a value is the one of the thing itself');
    assert.equal(flow[2].translate, '100px 20px', 'x and y travel together');
    const eased = m.keyframesOf(use({ name: 'keys', ease: 'inOut', keys: [{ at: 0, x: 0, ease: 'step' }, { at: 0.5, x: 1 }, { at: 1, x: 2 }] }));
    assert.deepEqual(eased.map((f) => f.easing), ['steps(1, end)', 'ease-in-out', undefined], 'each frame its own way to the next');
    const glow = m.keyframesOf(use({ name: 'keys', keys: [{ at: 0, glow: '0 0 0 accent/0' }, { at: 1, glow: '0 0 10px accent', blur: 2 }] }));
    assert.deepEqual(glow.map((f) => f.filter), [
      'blur(0px) drop-shadow(0px 0px 0px color-mix(in srgb, var(--wk-accent) 0%, transparent))', 'blur(2px) drop-shadow(0px 0px 10px var(--wk-accent))'
    ], 'a glow is a shadow in the theme colour; the filter names the same parts in every frame');
    assert.equal(m.keyframesOf(use({ name: 'keys', keys: [{ at: 0, clip: 'inset(10px 0px 0px 0px)' }, { at: 1, clip: 'inset(0px)' }] }), 'svg')[0].clipPath, 'inset(10px 0px 0px 0px) view-box', 'in a drawing a clip counts in drawing units');
    assert.deepEqual(m.keyframesOf(use({ name: 'keys', keys: [{ at: 0.4, opacity: 0.5 }] })).map((f) => f.offset), [0.4, 1], 'a single frame is a state');
    assert.ok(m.touchesPaint(use('draw')) && m.touchesPaint(use({ name: 'color', to: 'ink' })) && !m.touchesPaint(use('rise')));
    assert.equal(m.colorValue('rgba(1, 2, 3, 0.5)'), 'rgba(1, 2, 3, 0.5)');
    assert.equal(m.colorValue('url(javascript:x)'), null);
    assert.equal(m.glowValue('0 0 8px red; x'), null);
    assert.equal(m.easeValue('cubic-bezier(0.2, 0, 0, 1)'), 'cubic-bezier(0.2, 0, 0, 1)');
    ok('frames: own transform properties, each frame only what it names (a way does not stop to fade), theme colours, glow, clip in drawing units, draw < 0 and > 1');
  }

  /* -- 3. Die Zeichnung ---------------------------------------------------------------------- */
  {
    const d = m.drawingOf({
      size: [200, 100], alt: '  Kropka  ', max: 400,
      symbols: [{ name: 'k', shapes: [{ type: 'circle', r: 4, fill: 'accent' }, { type: 'rect', w: 2, h: 2 }] }, { name: 'k', shapes: [] }],
      elements: [
        { type: 'line', x: 0, y: 0, x2: 10, y2: 0, stroke: 'accent', width: 2, motion: { name: 'draw' } },
        { type: 'group', x: 5, y: 6, scale: 2, children: [{ type: 'use', use: 'k', motion: { name: 'move', to: [10, 0], repeat: 'loop' } }] },
        { type: 'ellipse', x: 50, y: 50, w: 40, h: 20, fill: 'radial(accent/40, transparent 70%)', motion: 'glow' },
        { type: 'path', d: 'M0 0"/><script>alert(1)</script>' },
        { type: 'image', url: 'javascript:alert(1)', w: 10, h: 10 },
        { type: 'image', url: '/cogita/logo/Cogita00.png', w: 10, h: 10 },
        { type: 'text', text: 'w drodze', origin: '25% 75%', motion: { name: 'keys', keys: [{ at: 0, color: 'muted' }, { at: 1, color: 'ink' }] } },
        { type: 'blob' }
      ]
    });
    assert.deepEqual([d.w, d.h, d.alt, d.max], [200, 100, 'Kropka', 200], 'size, description, a cap in rem');
    assert.equal(d.symbols.size, 1, 'a name once');
    assert.equal(d.elements.length, 7, 'an unknown kind drops out');
    assert.equal(d.elements[3].d, null, 'a path is only path letters');
    assert.equal(d.elements[4].url, null, 'no javascript: picture');
    assert.equal(d.elements[5].url, '/cogita/logo/Cogita00.png');
    assert.equal(d.elements[2].fill, 'radial(accent/40, transparent 70%)');
    assert.deepEqual(m.radialOf('radial(accent/40, transparent 70%)'), { inner: 'accent/40', outer: 'transparent', stop: 70 });
    assert.equal(m.fillValue('radial(red;}, blue)'), null);
    assert.equal(m.shapeCount(d), 10, 'a part of a symbol counts each time it is used');
    assert.equal(m.motionCount(d), 4);
    const many = m.drawingOf({ elements: Array.from({ length: 3000 }, () => ({ type: 'rect' })) });
    assert.equal(many.elements.length, m.DRAWING_LIMITS.shapes, 'at most 2500 parts');
    let deep = { type: 'rect' };
    for (let i = 0; i < 20; i += 1) deep = { type: 'group', children: [deep] };
    const nested = m.drawingOf({ elements: [deep] });
    let depth = 0;
    for (let s = nested.elements[0]; s !== undefined; s = s.children[0]) depth += 1;
    assert.ok(depth <= m.DRAWING_LIMITS.depth + 1, 'nesting has an end');
    const raw = { size: '[200,100]', elements: JSON.stringify([{ type: 'rect', w: 5, h: 5 }]), alt: 'x', max: '12' };
    assert.equal(m.readDrawing(raw).max, 12, 'stored: every key as JSON text');
    /* Eine ältere Fassung der Seite (vor 0108) speicherte die Listen beim Import als Zeilen. */
    const lines = m.readDrawing({ size: '180\n220', elements: '{"type":"rect","w":5,"h":5}\n{"type":"circle","r":3}' });
    assert.deepEqual([lines.w, lines.h, lines.elements.map((e) => e.type)], [180, 220, ['rect', 'circle']], 'a drawing an older page stored as lines still reads');
    const one = m.readDrawing({ symbols: '{"name":"k","shapes":[{"type":"circle","r":2}]}', elements: '{"type":"use","use":"k"}' });
    assert.deepEqual([one.symbols.size, one.elements.length, m.shapeCount(one)], [1, 1, 2], 'one line of one symbol, one element: a list of one');

    const html = quietly(() => m.renderToStaticMarkup(m.createElement(m.DrawingView, { drawing: d, identity: 'a' })));
    assert.ok(html.startsWith('<svg') && html.includes('viewBox="0 0 200 100"') && html.includes('aria-label="Kropka"'), 'an svg in its own space, described');
    assert.match(html, /<line[^>]*stroke-dasharray:10 4[^>]*data-mo="0"[^>]*pathLength="1"/, 'drawing lives on the line itself, measured as 1');
    assert.match(html, /<g transform="translate\(5 6\) scale\(2\)"><g><g data-mo="\d+"[^>]*><g><circle/, 'a group stands at its place; the motion frames the symbol inside');
    assert.match(html, /<text[^>]*style="fill:currentColor;/, 'a text without a fill takes the colour of the writing');
    assert.ok(html.includes('<radialGradient') && /fill:url\(#dr[^)]*-g0\)/.test(html), 'a glow fill is a gradient of the drawing');
    assert.match(html, /<text[^>]*transform-origin:25% 75%[^>]*data-mo="\d+"[^>]*>w drodze<\/text>/, 'a colour change on the text itself, around its own point');
    assert.ok(!html.includes('<script') && !html.includes('javascript:'), 'nothing unsafe is drawn');
    const still = quietly(() => m.renderToStaticMarkup(m.createElement(m.DrawingView, { drawing: d, identity: 'b', still: true })));
    assert.ok(!still.includes('data-mo') && !still.includes('stroke-dasharray'), 'still: drawn as described without motion');

    const part = m.partOf('animation');
    const example = part.json.fromJson(part.json.example);
    assert.deepEqual(part.json.toJson(example), part.json.example, 'the example round-trips');
    assert.ok(part.hasContent(example) && !part.hasContent({}), 'a drawing with parts has content, an empty one not');
    for (const key of ['elements', 'symbols', 'size', 'elements[].motion.keys[].draw', 'elements[].children[].motion[].keys[].clip', 'symbols[].shapes[].use']) {
      assert.ok(part.json.keys[key] !== undefined, `the description explains ${key}`);
    }
    assert.ok(m.motionCount(m.readDrawing(example)) >= 4, 'the example moves');
    ok('drawing: tolerant reading, limits, safe paths and pictures, symbols counted per use; rendered with motion frames, paint on the surface, gradients; still without; the part describes every key');
  }

  /* -- 4. Die Präsentation ---------------------------------------------------------------------- */
  {
    assert.ok(m.SCENE_CHANGES.includes('dissolve'));
    const zones = m.zonesOf([1, 1]);
    const into = m.sceneState(zones, 1, 0.5, ['dissolve', 'dissolve']);
    const outof = m.sceneState(zones, 0, 0.5, ['dissolve', 'dissolve']);
    assert.ok(into.visible && outof.visible, 'both on the stage while changing');
    assert.ok(into.opacity > 0 && into.opacity < 1 && outof.opacity > 0 && outof.opacity < 1, 'they cross');
    assert.ok(into.lift > 0 && into.lift < m.DISSOLVE_SCENE.lift && into.blur > 0 && into.blur < m.DISSOLVE_SCENE.blur, 'the coming one rises out of a blur');
    assert.ok(outof.lift > 0 && outof.blur > 0, 'the going one sinks into one');
    const there = m.sceneState(zones, 1, 1, ['dissolve', 'dissolve']);
    assert.deepEqual([there.opacity, there.lift, there.blur], [1, 0, 0], 'arrived: sharp, in place');

    assert.deepEqual([m.NO_SHOW.backdrop, m.NO_SHOW.width], [[], null]);
    const show = m.readShow({ width: 5, backdrop: [{ kind: 'mesh' }, { kind: 'nebula' }], scenes: [{ key: 'a', change: 'dissolve' }] });
    assert.equal(show.width, 20, 'the stage is at least 20 rem');
    assert.deepEqual(show.backdrop.map((l) => l.kind), ['mesh'], 'unknown layers drop out');
    const json = m.showJson(show);
    assert.equal(json.width, 20);
    assert.equal(json.backdrop.length, 1);
    assert.deepEqual(m.readShow(json), show, 'the show round-trips');
    assert.equal(m.showJson(m.readShow({ scenes: [{ key: 'a' }] })).backdrop, undefined, 'no backdrop, nothing written');

    const piece = m.readPieceValue({ places: { a: { x: 10 } }, motion: [{ name: 'rise', delay: 220 }, 'wiggle'] });
    assert.deepEqual(piece.motion.map((u) => u.name), ['rise']);
    assert.deepEqual(m.pieceJson(piece).motion, { name: 'rise', delay: 220 }, 'a motion on a piece, compact');
    assert.equal(m.pieceJson(m.readPieceValue({ places: { a: {} } })).motion, undefined);

    const words = m.pageDescription();
    for (const key of ['"dissolve"', '"backdrop" — ', '"width" — ', '"motion" — ruch według zegara', '"kind": "mesh"']) assert.ok(words.includes(key), `the description explains ${key}`);
    const bad = m.planImport({
      format: 'recreatio/page', version: 1, mode: 'presentation',
      show: { backdrop: [{ kind: 'nebula' }], scenes: [{ key: 'a', layers: [{ kind: 'fog' }] }] },
      modules: [{ kind: 'text', show: { places: { a: {} }, motion: 'shake' }, config: { body: 'x' } }]
    }, { path: 'zz', title: '', lead: '', mode: 'page', look: { theme: null, cover: [] }, parts: [], logic: null, menu: null }, m.DEFAULT_IMPORT);
    for (const word of ['nebula', 'fog', 'shake']) assert.ok(bad.warnings.some((w) => w.includes(word)), `"${word}" is reported: ${bad.warnings.join(' | ')}`);
    ok('presentation: dissolve (both at once — rising out of a blur, sinking into one), shared backdrop and stage width, motions on pieces; reported when unknown');
  }

  /* -- 5. Das Dokument ---------------------------------------------------------------------------- */
  {
    const fixture = JSON.parse(await readFile(join(process.cwd(), 'scripts/fixtures/cogita-home.json'), 'utf8'));
    const empty = { path: 'zz-probe/cogita', title: '', lead: '', mode: 'page', look: { theme: null, cover: [] }, parts: [], logic: null, menu: null };
    const plan = m.planImport(fixture, empty, { ...m.DEFAULT_IMPORT, replace: true });
    assert.ok(!('error' in plan), JSON.stringify(plan));
    assert.deepEqual(plan.warnings, [], 'the document imports without a single warning');
    assert.equal(plan.mode, 'presentation', 'a presentation, not slides');
    const show = m.readShow(plan.look.show);
    assert.deepEqual(show.scenes.map((sc) => sc.key), ['cogita', 'mapa-wiedzy', 'biblioteka', 'na-zywo', 'postep', 'ochrona', 'dolacz']);
    assert.ok(show.scenes.every((sc) => sc.change === 'dissolve' && sc.layers.length === 2 && sc.colors.ground !== undefined), 'every scene dissolves, with its own gradient and bloom');
    assert.deepEqual(show.backdrop.map((l) => l.kind), ['vignette', 'haze', 'mesh', 'waves'], 'the shared cloth of the legacy');
    assert.deepEqual([show.width, show.nav, show.fonts], [80, 'dots', 'cormorant']);
    assert.equal(plan.parts.length, fixture.modules.length);

    const pieces = plan.parts.map((p) => ({ part: p, piece: m.readPiece(p.layout) }));
    const logo = pieces.find((one) => one.part.kind === 'layers');
    assert.equal(Object.keys(logo.piece.places).length, 7, 'the sign travels through all seven scenes');
    const keys = new Set(show.scenes.map((sc) => sc.key));
    assert.ok(pieces.every((one) => Object.keys(one.piece.places).every((k) => keys.has(k))), 'every place is in a real scene');
    const texts = pieces.filter((one) => one.part.kind === 'hero');
    assert.equal(texts.length, 7);
    assert.deepEqual(texts.map((one) => one.piece.motion.map((u) => [u.name, u.delay])), [[], [['rise', 1000]], ...Array(5).fill([['rise', 220]])], 'the text rises when the scene is reached (on the map after the walker)');

    /* Die Bilder: nichts als allgemeine Teile und Wörter. */
    const drawings = new Map(pieces.filter((one) => one.part.kind === 'animation').map((one) => [Object.keys(one.piece.places)[0], m.readDrawing(one.part.config)]));
    assert.deepEqual([...drawings.keys()], ['mapa-wiedzy', 'biblioteka', 'na-zywo', 'postep', 'ochrona'], 'five pictures');
    const names = new Set();
    const walk = (list, d) => { for (const s of list) { for (const u of s.motion) names.add(u.name); walk(s.type === 'use' ? d.symbols.get(s.use) ?? [] : s.children, d); } };
    for (const d of drawings.values()) walk(d.elements, d);
    assert.ok([...names].every((n) => m.motionDef(n) !== undefined), `only words of the vocabulary: ${[...names].join(', ')}`);
    assert.ok(['move', 'keys', 'draw', 'fade', 'breathe', 'glow'].every((n) => names.has(n)), 'the pictures use plain words and presets');
    const map = drawings.get('mapa-wiedzy');
    const walker = map.elements.find((s) => s.motion.some((u) => u.name === 'move'));
    assert.ok(walker !== undefined && walker.motion[0].path.length > 40 && walker.motion[0].repeat === 'loop', 'the walker goes his way node by node');
    assert.ok(map.elements.some((s) => s.type === 'circle' && s.motion.some((u) => (u.keys ?? []).some((k) => /^#ff7878/.test(k.color ?? '')))), 'a missing foundation blinks red');
    const cards = drawings.get('biblioteka');
    assert.equal(cards.elements.filter((s) => s.type === 'use' && s.use === 'fiszka').length, 7, 'seven cards from one reusable card');
    assert.deepEqual(cards.elements.map((s) => s.shift), [0, 120, 240, 360, 480, 600, 720], 'a card every 0.12 s');
    assert.ok(m.shapeCount(drawings.get('na-zywo')) > 50 && drawings.get('na-zywo').elements.some((s) => s.motion.some((u) => u.name === 'breathe')), 'the round with breathing players');
    const shield = drawings.get('ochrona');
    const strokes = shield.elements[1].children.map((s) => s.motion[0]);
    assert.deepEqual(strokes.map((u) => [u.name, u.to]), [['draw', 1.245], ['draw', 8.45]], 'the shield draws itself — the tick long before the outline');
    for (const one of plan.parts) {
      const stored = JSON.stringify(one.config).length;
      assert.ok(stored <= 64000, `${one.kind}: ${stored} characters fit a module`);
      assert.ok(JSON.stringify(one.layout).length <= 8000, `${one.kind}: its layout fits`);
    }

    const again = m.exportPage({ ...empty, title: plan.title, lead: plan.lead ?? '', mode: plan.mode, look: plan.look, parts: plan.parts });
    assert.deepEqual(again.show, fixture.show, 'the show comes out as it went in');
    assert.deepEqual(again.theme, fixture.theme);
    again.modules.forEach((one, i) => {
      assert.deepEqual(one.show, fixture.modules[i].show, `${fixture.modules[i].id}: its places come out unchanged`);
      assert.deepEqual(one.config, fixture.modules[i].config, `${fixture.modules[i].id}: its content too`);
    });
    const back = m.planImport(again, { ...empty, mode: plan.mode, look: plan.look, parts: plan.parts }, { ...m.DEFAULT_IMPORT, replace: true });
    assert.deepEqual(back.warnings, []);
    assert.deepEqual(back.parts.map((p) => p.layout), plan.parts.map((p) => p.layout), 'export → import changes nothing');

    /* Die Bühne liest beim ersten Zeichnen die Adresse (#szena) und den Schirm — hier ein Fenster aus dem Nichts. */
    globalThis.window = {
      location: { hash: '', pathname: '/', search: '' }, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {}
    };
    let html = '';
    try {
      html = quietly(() => m.renderToStaticMarkup(m.createElement(m.PagePresentation, { parts: plan.parts, look: plan.look, title: 'Cogita' })));
    } finally {
      delete globalThis.window;
    }
    assert.equal((html.match(/class="pz-scene[ "]/g) ?? []).length, 7, 'seven scenes');
    assert.ok(html.includes('pz-backdrop') && (html.match(/class="pz-backdrop-scene"/g) ?? []).length === 7, 'the shared cloth with a layer per scene');
    assert.ok(html.includes('is-clear'), 'scenes are clear above it');
    assert.equal((html.match(/<svg class="dr"/g) ?? []).length, 5, 'five drawings');
    assert.ok(html.includes('pz-travel') && html.includes('wk-layers'), 'the travelling sign of twenty layers');
    assert.ok(html.includes('pz-move'), 'the texts carry their motion');
    assert.ok((html.match(/pathLength="1"/g) ?? []).length >= 20, 'every line that draws itself (in "keys" too) is measured as 1: 6 own steps, 12 of the others, the shield');
    assert.ok(html.includes('--pz-width:80rem'), 'the stage is 80 rem wide');
    assert.ok(html.includes('Wiedza żyje w rozmowie.') && html.includes('Zarejestruj się'), 'the legacy texts');
    assert.ok(!html.includes('an-map') && !html.includes('an-cards'), 'no ready-made scenes left');
    ok(`fixtures/cogita-home.json: a presentation of 7 scenes, its pictures only plain words (${[...names].join(', ')}); imports without warning, fits, comes out unchanged; the server draws scenes, cloth, five drawings, the sign`);
  }
} finally {
  await rm(workspace, { recursive: true, force: true });
}
