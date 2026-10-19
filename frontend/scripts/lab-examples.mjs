/**
 * PRACOWNIE (2026-10-18) — `fixtures/lab-chemia.json` und `fixtures/lab-fizyka.json`:
 * je eine Seite (Format jeder Seite, "recreatio/page") mit den Laboren als
 * Bausteinen — die fertigen Versuche (`lab/chem/chemPresets.ts`,
 * `lab/physics/physPresets.ts`) als Doświadczenia, dazu eine Piaskownica.
 * Dazu die Pokazy (`lab-decks.mjs`): je Versuch eine Seite im Modus „slides” —
 * ein Slajd mit dem Ziel, je Schritt ein Slajd mit dem Labor, am Ende die
 * Erklärung (`fixtures/lab-pokaz-*.json`).
 *
 * Importiert auf einer Seite (Edytuj stronę → Importuj JSON) steht danach eine
 * ganze Pracownia bzw. ein Pokaz. Die Szenen sind dieselben Dokumente, die der
 * Editor einsetzt — sie sagen nur, was wo steht; den Rest rechnet der Motor.
 *
 * Bevor geschrieben wird, prüft das Skript jede Szene: sie baut eine Welt, die
 * Schritte laufen ohne Fehler und ohne NaN, jede Folie eines Pokazu zeigt, was
 * sie verspricht (`expect`), und alle Seiten importieren sich (wie „Importuj
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
import { CHEM_DECKS } from './lab-decks.mjs';

const workspace = await mkdtemp(join(tmpdir(), 'lab-examples-'));
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
try {
  await build({
    stdin: {
      contents: `
export { CHEM_PRESETS, SANDBOX_CHEM } from '${app}lab/chem/chemPresets';
export { readChemScene, buildWorld as buildChemWorld, drawChem, perform } from '${app}lab/chem/chemSetup';
export { AQI, NC } from '${app}lab/chem/chemAq';
export { GASI, NG, SOLI } from '${app}lab/chem/chemGrid';
export { toWorld } from '${app}lab/chem/chemThings';
export { seeded } from '${app}lab/labRandom';
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

  /**
   * Eine Szene laufen lassen wie „Pokaż”: die Welt bauen, eine Sekunde warten
   * (so sieht der Motor, was sich dann ändert — Farbe, Temperatur), jeden
   * Schritt tun und seine Zeit abwarten, jede Sekunde die Termometr ablesen.
   * Hinzugefügtes kommt wie mit der Hand oben hinein; Umgiessen geschieht
   * sofort (die Bühne würde das Glas neigen). Gibt die Welt und die Ablesungen
   * zurück; jede Temperatur bleibt endlich. Die Zeit läuft wie auf der Bühne:
   * Bilder zu 1/60 s im Tempo der Szene (`speed`, auch aus den Schritten) — im
   * Zeitraffer mit längeren Schritten. `coarse`: feste Schritte zu 1/15 s (wo
   * nur geprüft wird, dass nichts zerbricht).
   */
  const play = (label, doc, coarse = false) => {
    const scene = m.readChemScene(doc);
    const drawn = m.drawChem(scene, 'check');
    const w = m.buildChemWorld(scene, drawn, m.seeded('check'));
    const samples = [];
    const read = () => samples.push(Object.fromEntries(w.things.filter((t) => t.kind === 'thermometer').map((t) => [t.id, t.readout])));
    let speed = scene.speed;
    const second = () => {
      if (coarse) { for (let j = 0; j < 15; j += 1) w.step(1 / 15); return; }
      const end = w.time + 1;
      while (w.time < end - 1e-9) w.frame(1 / 60, speed, 1e9);
    };
    second();
    for (const s of scene.steps) {
      for (const a of s.do) { if (a.kind === 'speed') speed = a.value; m.perform(w, a, drawn, a.kind === 'pour'); }
      const seconds = Math.ceil(s.wait + 1);
      for (let k = 0; k < seconds; k += 1) {
        second();
        read();
      }
    }
    for (let i = 0; i < w.g.n; i += 1) assert.ok(Number.isFinite(w.g.T[i]), `${label}: temperatures stay finite`);
    return { w, samples };
  };

  for (const p of m.CHEM_PRESETS) play(p.key, p.scene, true);
  for (const p of m.PHYS_PRESETS) {
    const scene = m.readPhysScene(p.scene);
    const world = m.buildWorld(scene, m.drawScene(scene, 'check'));
    for (let i = 0; i < Math.round(3 / m.PSTEP); i += 1) world.step(m.PSTEP);
    for (const b of world.bodies) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), `${p.key}: ${b.id} stays finite`);
  }
  console.log(`ok   ${m.CHEM_PRESETS.length} chemistry and ${m.PHYS_PRESETS.length} physics experiments run without errors`);

  /* -- Was eine Folie zeigen muss ------------------------------------------------------------------ */
  const tempAt = (w, id, yl) => { const t = w.thing(id); return w.g.T[w.g.at(...m.toWorld(t, 0, yl))] - 273.15; };
  /** Welcher Anteil eines Stoffes in der oberen Hälfte der Flüssigkeit eines Glases ist. */
  const upper = (w, id, ion) => {
    const t = w.thing(id);
    const k = m.AQI[ion];
    const cells = t.cells.filter((i) => w.g.own[i] === t.num && w.g.lq[i] === 1);
    if (cells.length === 0) return 0;
    const ys = cells.map((i) => w.g.cy(i));
    const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
    let up = 0;
    let all = 0;
    for (const i of cells) { const x = w.g.comp[i * m.NC + k]; all += x; if (w.g.cy(i) > mid) up += x; }
    return all > 0 ? up / all : 0;
  };
  /** Eine Grösse in einem Glas: "aq:Cu+2" (gelöst, mol), "s:S" (fest, mol), "gas:NO2" (Anteil im Gas), "up:MnO4-" (Anteil oben). */
  const measure = (w, id, what) => {
    const t = w.thing(id);
    const [kind, sp] = what.split(':');
    const own = t.cells.filter((i) => w.g.own[i] === t.num);
    if (kind === 'aq') return own.reduce((a, i) => a + (w.g.lq[i] === 1 ? w.g.comp[i * m.NC + m.AQI[sp]] : 0), 0);
    if (kind === 's') return own.reduce((a, i) => a + (w.g.sp[i] === m.SOLI[sp] ? w.g.sn[i] : 0), 0);
    if (kind === 'gas') {
      let x = 0;
      let n = 0;
      for (const i of own) if (w.g.mat[i] === 0) { x += w.g.gas[i * m.NG + m.GASI[sp]]; n += w.g.gasTotal(i); }
      return n > 0 ? x / n : 0;
    }
    if (kind === 'up') return upper(w, id, sp);
    throw new Error(`unknown measure ${what}`);
  };
  const missed = (slide, w, samples) => {
    const out = [];
    for (const e of slide.expect) {
      if (e.said !== undefined && !w.log.some((x) => x.text.includes(e.said))) out.push(`no observation "${e.said}"`);
      if (e.notSaid !== undefined && w.log.some((x) => x.text.includes(e.notSaid))) out.push(`unexpected observation "${e.notSaid}"`);
      if (e.above !== undefined && !(w.thing(e.above[0]).readout > e.above[1])) out.push(`${e.above[0]} should end above ${e.above[1]} °C (${w.thing(e.above[0]).readout.toFixed(1)})`);
      if (e.below !== undefined && !(w.thing(e.below[0]).readout < e.below[1])) out.push(`${e.below[0]} should end below ${e.below[1]} °C (${w.thing(e.below[0]).readout.toFixed(1)})`);
      if (e.plateau !== undefined) {
        const [id, at, tol, min] = e.plateau;
        const n = samples.filter((s) => Math.abs(s[id] - at) <= tol).length;
        if (n < min) out.push(`${id} should stay at ${at} ± ${tol} °C for ${min} s (${n} s)`);
      }
      if (e.out !== undefined && w.thing(e.out).on) out.push(`${e.out} should have gone out`);
      if (e.warmer !== undefined) {
        const [[a, ya], [b, yb], d] = e.warmer;
        const ta = tempAt(w, a, ya);
        const tb = tempAt(w, b, yb);
        if (!(ta > tb + d)) out.push(`${a} should be ${d} K warmer than ${b} (${ta.toFixed(1)} vs ${tb.toFixed(1)} °C)`);
      }
      if (e.up !== undefined) {
        const share = upper(w, e.up[0], e.up[1]);
        if (!(share > e.up[2])) out.push(`${e.up[1]} should rise into the upper half of ${e.up[0]} (${(share * 100).toFixed(1)} % there)`);
      }
      if (e.more !== undefined) {
        const [[a, wa], [b, wb], f] = e.more;
        const va = measure(w, a, wa);
        const vb = measure(w, b, wb);
        if (!(va > vb * f)) out.push(`${a} ${wa} should be over ${f}× ${b} ${wb} (${va.toExponential(2)} vs ${vb.toExponential(2)})`);
      }
    }
    return out;
  };

  const theme = (accent) => ({ mode: 'light', accent, ink: '#13212b', ground: '#f6f8f7', muted: '#5b6b74' });
  const text = (id, title, body, size = { colSpan: 6, rowSpan: 2 }) => ({ id, kind: 'text', size, config: { title, body } });

  /* -- Pokazy: jede Folie zeigt, was sie verspricht ------------------------------------------------- */
  const failures = [];
  const decks = CHEM_DECKS.map((d) => {
    for (const s of d.slides) {
      const { w, samples } = play(`${d.path}/${s.id}`, s.scene);
      for (const f of missed(s, w, samples)) failures.push(`${d.path}/${s.id}: ${f}`);
    }
    return {
      file: d.file,
      doc: {
        format: 'recreatio/page',
        version: 1,
        path: d.path,
        title: d.title,
        lead: d.intro.lede,
        mode: 'slides',
        theme: theme(d.accent),
        cover: [],
        deck: { backdrop: [], nav: 'dots', titleSlide: false, width: 100 },
        modules: [
          {
            id: 'start', kind: 'hero', size: { colSpan: 6, rowSpan: 3 }, slide: { label: 'Start', layers: [] },
            config: { badge: d.intro.badge, badgeLook: 'kicker', size: 'title', headline: d.intro.headline, lede: d.intro.lede, paragraphs: d.intro.paragraphs, actions: [], footnote: null }
          },
          ...d.slides.map((s, k) => ({
            id: s.id, kind: 'chemistry', size: { colSpan: 6, rowSpan: 5 }, slide: { label: `${k + 1}. ${s.label}`, layers: [] },
            config: { title: s.label, text: s.text, mode: 'experiment', scene: s.scene }
          })),
          { ...text('wyjasnienie', d.outro.title, d.outro.body, { colSpan: 6, rowSpan: 4 }), slide: { label: 'Wyjaśnienie', layers: [] } }
        ]
      }
    };
  });
  assert.deepEqual(failures, [], 'every slide shows what it promises');
  console.log(`ok   ${decks.length} slide decks, ${CHEM_DECKS.reduce((a, d) => a + d.slides.length, 0)} experiment slides: each shows what it promises`);

  const lab = (kind, key, p) => ({
    id: `${kind}-${key}`,
    kind,
    size: { colSpan: 6, rowSpan: 5 },
    config: { title: p.title, text: [...p.text], mode: 'experiment', scene: p.scene }
  });
  const sandbox = (kind, title, intro, scene) => ({ id: `${kind}-piaskownica`, kind, size: { colSpan: 6, rowSpan: 5 }, config: { title, text: intro, mode: 'sandbox', scene } });

  const chem = {
    format: 'recreatio/page',
    version: 1,
    path: 'pracownia-chemiczna',
    title: 'Pracownia chemiczna',
    lead: 'Doświadczenia szkolne w prawdziwej piaskownicy 2D: rzeczy stoją tam, gdzie je postawisz, a silnik liczy resztę — ciepło płynie, metale się topią, roztwory mieszają się i reagują. Weź odczynnik z półki i dotknij naczynia, przytrzymaj naczynie nad innym, żeby przelać, postaw je na trójnogu nad palnikiem. „Pokaż” przeprowadza doświadczenie krok po kroku.',
    mode: 'page',
    theme: theme('#2f7d5b'),
    modules: [
      text('chem-wstep', 'Jak pracować w laboratorium', [
        'Każde doświadczenie ma opis, kroki i przycisk „Pokaż”. Czasem przed krokiem pada pytanie — najpierw przewiduj, potem patrz.',
        '## Co widać',
        'Pod naczyniami: temperatura, pH i ciśnienie. Dotknij naczynia, żeby zobaczyć skład gazu i roztworu, a pod lupą — cząsteczki i jony. Widok ciepła pokazuje temperaturę kolorami — widać, jak ciepło wędruje.',
        '## Obserwacje',
        'Wszystko, co się dzieje (gaz, osad, zmiana barwy, topnienie, ciepło), trafia do obserwacji razem z równaniem reakcji.'
      ].join('\n')),
      ...m.CHEM_PRESETS.map((p) => lab('chemistry', p.key, p)),
      sandbox('chemistry', 'Piaskownica chemiczna', ['Wszystkie odczynniki, naczynia i narzędzia — mieszaj roztwory, topnij metale, sprawdzaj własne pomysły.', 'Gotowe doświadczenia wczytasz w sekcji „Doświadczenia i zapis”.'], m.SANDBOX_CHEM)
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

  /* Alle Seiten importieren sich wie mit „Importuj JSON” — ohne Warnung, jeder Baustein mit seinem Platz. */
  for (const page of [chem, phys, ...decks.map((d) => d.doc)]) {
    const doc = JSON.parse(JSON.stringify(page));
    const now = { path: page.path, title: '', lead: '', mode: 'page', look: { theme: page.theme, cover: [] }, parts: [], logic: null, menu: null };
    const plan = m.planImport(doc, now, { ...m.DEFAULT_IMPORT, replace: true });
    assert.ok(!('error' in plan), `${page.path}: imports (${plan.error ?? ''})`);
    assert.deepEqual(plan.warnings, [], `${page.path}: no warnings`);
    assert.equal(plan.parts.length, page.modules.length, `${page.path}: every module arrives`);
    assert.equal(plan.mode ?? 'page', page.mode, `${page.path}: ${page.mode}`);
  }
  console.log(`ok   ${2 + decks.length} pages import without warnings`);

  const out = (name) => join(process.cwd(), 'scripts', 'fixtures', name);
  await writeFile(out('lab-chemia.json'), `${JSON.stringify(chem, null, 1)}\n`, 'utf8');
  await writeFile(out('lab-fizyka.json'), `${JSON.stringify(phys, null, 1)}\n`, 'utf8');
  for (const d of decks) await writeFile(out(d.file), `${JSON.stringify(d.doc, null, 1)}\n`, 'utf8');
  console.log(`written: scripts/fixtures/lab-chemia.json, lab-fizyka.json, ${decks.map((d) => d.file).join(', ')}`);
} finally {
  await rm(workspace, { recursive: true, force: true });
}
