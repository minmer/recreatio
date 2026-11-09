/**
 * 2026-11-09 — KURSE FÜR DIE WELTKARTE ZUM ANSEHEN (die Vorschau `preview.html` liest sie ohne Datenbank, die Bilder im
 * Bericht documentation/world-map/STEP2_REPORT.md): aus den Testwelten (`cogita/worldmap/wmFixtures.ts`) und, wenn eine
 * Abschrift gegeben ist, aus der Gestalt einer echten Baza (nur gelesen) — je ein Widok `landscape.style: "world"`.
 *
 *   node scripts/wm-courses.mjs <ordner> [abschrift-der-baza.json]
 *
 * Schreibt `fixture.json` (Bosko-Gestalt, 50 Orte), `gen1000.json` (1 000 Orte, 40 Erzählungen) und `bosko.json` (mit Abschrift).
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('en');
import { build } from 'esbuild';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [outDir, copyPath] = process.argv.slice(2);
if (outDir === undefined) { console.error('usage: node scripts/wm-courses.mjs <dir> [copy.json]'); process.exit(2); }
const ws = await mkdtemp(join(tmpdir(), 'wm-courses-'));
await build({ entryPoints: { fx: 'src/app/cogita/worldmap/wmFixtures.ts' }, bundle: true, format: 'esm', platform: 'node', outdir: ws, logLevel: 'error', loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) } });
globalThis.BroadcastChannel = undefined;
const F = await import(pathToFileURL(join(ws, 'fx.js')).href);

/** Eine Welt (Einträge mit Verweisen, Karten, Abläufe) als Kurs `recreatio.cogita.course`. */
function courseOf(name, prefix, input, opts = {}) {
  const refOf = new Map();
  const ref = (id) => {
    if (refOf.has(id)) return refOf.get(id);
    const r = opts.refs?.get(id) ?? `@${prefix}/${String(id).replace(/[^A-Za-z0-9/_-]+/g, '-').replace(/^\/+/, '')}`;
    refOf.set(id, r);
    return r;
  };
  const flowRef = (id) => (String(id).startsWith('@') ? id : `@${prefix}/flow/${id}`);
  const kindRef = (k) => `@${prefix}/kind/${String(k).replace(/[^A-Za-z0-9_-]+/g, '-')}`;
  const questionKinds = new Set(input.questionKinds ?? ['question']);
  /* Die Arten: ein Name, dazu jedes Verweisfeld, das ihre Einträge tragen (mit seinen Rollen). */
  const fields = new Map();
  for (const e of input.entries) {
    const k = e.kinds[0];
    if (questionKinds.has(k)) continue;
    const m = fields.get(k) ?? new Map();
    for (const r of e.refs) if (!m.has(r.field)) m.set(r.field, { key: r.field, label: r.field, type: 'ref', multi: true, ...(r.prerequisite ? { prerequisite: r.prerequisite } : {}), ...(r.part ? { part: r.part } : {}), ...(r.structure ? { structure: r.structure } : {}) });
    fields.set(k, m);
  }
  const kinds = [...fields.entries()].map(([k, m]) => ({
    ref: kindRef(k), name: opts.kindNames?.get(k) ?? k, label: '{name}',
    fields: [{ key: 'name', label: 'Name', type: 'line' }, { key: 'nr', label: 'Nr', type: 'number' }, ...m.values()]
  }));
  const cardsOf = new Map(input.cards.map((c) => [c.question, c]));
  const entities = input.entries.map((e) => {
    const k = e.kinds[0];
    if (questionKinds.has(k)) {
      const c = cardsOf.get(e.id);
      return {
        ref: ref(e.id), kinds: ['question'],
        data: { form: 'one', prompt: e.label, options: ['Tak', 'Nie'], correct: [0], about: (c?.about ?? []).map(ref), ...(c?.explain?.length ? { explain: c.explain.map(ref) } : {}), ...(c?.needs?.length ? { needs: c.needs.map(ref) } : {}) }
      };
    }
    const data = { name: e.label, ...(opts.props?.get(e.id) ?? {}) };
    for (const r of e.refs) (data[r.field] ??= []).push(ref(r.to));
    return { ref: ref(e.id), kinds: [kindRef(k)], data };
  });
  /* Fragen ohne eigenen Eintrag (die erzeugten Welten): aus den Karten. */
  const seenQ = new Set(input.entries.filter((e) => questionKinds.has(e.kinds[0])).map((e) => e.id));
  for (const c of input.cards) if (!seenQ.has(c.question)) entities.push({ ref: ref(c.question), kinds: ['question'], data: { form: 'one', prompt: c.question, options: ['Tak', 'Nie'], correct: [0], about: c.about.map(ref) } });
  const mapConfig = (config) => {
    const out = { ...config };
    if (typeof out.of === 'string' && out.of !== '') out.of = ref(out.of);
    if (typeof out.flow === 'string' && out.flow !== '') out.flow = flowRef(out.flow);
    return out;
  };
  const flows = input.flows.map((f) => ({
    ref: flowRef(f.id), name: f.name, look: 'slides', ...(f.unit ? { unit: ref(f.unit) } : {}), ...(f.start ? { start: f.start } : {}), ...(f.review ? { review: f.review } : {}),
    graph: { nodes: f.graph.nodes.map((n) => ({ id: n.id, type: n.type, x: n.x, y: n.y, config: mapConfig(n.config) })), edges: f.graph.edges.map((e) => ({ id: e.id, from: e.from, out: e.out, to: e.to, in: e.in })) }
  }));
  const views = [{
    ref: `@${prefix}/view/world`, name: opts.viewName ?? 'Mapa świata', mode: 'landscape',
    ...(opts.placeKind ? { steps: [{ type: 'source.kind', config: { kind: kindRef(opts.placeKind) } }] } : {}),
    landscape: { budget: 400, style: 'world', ...(opts.nest ? { nest: opts.nest, nestSort: 'nr' } : {}) }
  }];
  return { format: 'recreatio.cogita.course', version: 1, name, kinds, entities, flows, views };
}

const fx = F.boskoWorld();
await writeFile(join(outDir, 'fixture.json'), JSON.stringify(courseOf('Świat testowy — kształt Bosko', 'wmfx', fx.input, { placeKind: 'temat' })));
await writeFile(join(outDir, 'gen1000.json'), JSON.stringify(courseOf('Świat 1000 miejsc', 'wmg', F.generatedWorld({ places: 1000, stories: 40, seed: 11 }), { placeKind: 'topic' })));
console.log('fixture.json, gen1000.json');

if (copyPath !== undefined) {
  /* Die Abschrift einer echten Baza (Kinds mit Feldern, Einträge mit Verweisen, Karten, Abläufe), nur gelesen. */
  const copy = JSON.parse(await readFile(copyPath, 'utf8'));
  const kindName = new Map(copy.kinds.map((k) => [k.id, k.name]));
  const flagOf = new Map();
  for (const k of copy.kinds) for (const f of k.fields ?? []) if (f.type === 'ref') flagOf.set(`${k.id}|${f.key}`, f);
  const entries = copy.entries.map((e) => ({
    id: e.id, kinds: e.kinds, label: e.label ?? e.id,
    refs: (e.refs ?? []).filter((r) => r.to && !r.missing).map((r) => {
      const f = flagOf.get(`${e.kinds[0]}|${r.field}`) ?? {};
      return { field: r.field, to: r.to, ...((r.prerequisite ?? f.prerequisite) ? { prerequisite: r.prerequisite ?? f.prerequisite } : {}), ...((r.part ?? f.part) ? { part: r.part ?? f.part } : {}), ...((r.structure ?? f.structure) ? { structure: r.structure ?? f.structure } : {}) };
    })
  }));
  const refs = new Map(copy.entries.filter((e) => typeof e.ref === 'string' && e.ref.startsWith('@')).map((e) => [e.id, e.ref]));
  const props = new Map(copy.entries.filter((e) => e.props).map((e) => [e.id, Object.fromEntries(Object.entries(e.props).filter(([, v]) => typeof v === 'number' || typeof v === 'string'))]));
  const flows = copy.flows.map((f) => ({ id: f.id, name: f.name, unit: f.unit, start: f.start, review: f.review, graph: f.graph }));
  const topicKind = copy.kinds.find((k) => /temat/i.test(k.name))?.id;
  const course = courseOf('Bosko (gestalt, read-only copy)', 'bosko-wm', { entries, cards: copy.cards, flows, questionKinds: ['question'] }, { refs, props, kindNames: kindName, placeKind: topicKind, nest: copy.kinds.some((k) => (k.fields ?? []).some((f) => f.key === 'obszar')) ? 'obszar' : undefined, viewName: 'Mapa świata — Bosko' });
  await writeFile(join(outDir, 'bosko.json'), JSON.stringify(course));
  console.log(`bosko.json: ${course.entities.length} entries, ${course.flows.length} flows`);
}
