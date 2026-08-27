/**
 * Does "+ Dodaj …" survive?
 *
 * Every builder list adds a blank entry, hands the config to JSON and reads it
 * straight back before the next render. A reader that drops incomplete entries
 * therefore eats what was just added, and the button looks dead. This walks the
 * real part registry and checks the round trip for the blank each editor makes.
 *
 * The blanks below are copied from the ListEditor calls; if one drifts, this
 * check goes quiet rather than wrong — so it is a floor, not a proof.
 */
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';


const workspace = await mkdtemp(join(tmpdir(), 'ev-add-'));
const out = join(workspace, 'registry.bundle.mjs');
await build({
  entryPoints: ['src/pages/events/parts/registry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  define: { 'import.meta.env': '{}' },
  outfile: out,
  logLevel: 'error'
});

const { PART_MODULES } = await import(pathToFileURL(out).href);

/** kind → [path to the list, the blank its editor adds]. */
const ADDS = [
  ['faq', ['items'], { question: '', answer: '' }],
  ['files', ['files'], { label: '', url: '', note: null, size: null }],
  ['gallery', ['shots'], { url: '', caption: null, alt: '' }],
  ['people', ['people'], { name: '', role: null, detail: null, photoUrl: null, contact: null, contactHref: null }],
  ['plan', ['groups'], { label: 'Nowy etap', caption: null, rows: [] }],
  ['plan', ['groups', 0, 'rows'], { time: null, title: '', detail: null }],
  ['costs', ['costItems'], { label: 'Nowy koszt', suggested: null, actual: null }],
  ['costs', ['donations'], { label: 'Darowizna', amount: null }],
  ['contact', ['channels'], { label: 'E-mail', value: '', href: null }],
  ['map', ['points'], { label: 'Punkt', lat: 50.0619, lon: 19.9369, detail: null, isStop: false }],
  ['shortinfos', ['items'], { label: 'Etykieta', value: '', detail: null }],
  ['title', ['actions'], { label: 'Przycisk', href: '#', variant: 'cta' }],
  ['roster', ['smsTemplates'], { label: 'Nowa wiadomość', text: '' }],
  ['roster', ['presets'], { label: 'Nowy widok', filters: [], sortKey: '', sortDescending: false, columns: [] }],
  ['roster', ['extras'], { code: 'pole-9', label: 'Nowa kolumna', kind: 'check', options: [] }]
];

const at = (value, path) => path.reduce((node, step) => (node ?? {})[step], value);

let failed = 0;
for (const [kind, path, blank] of ADDS) {
  const module = PART_MODULES.find((entry) => entry.kind === kind);
  if (!module) { console.error(`FAIL ${kind}: no such part`); failed += 1; continue; }

  // Start from whichever config actually holds that list.
  let config = JSON.parse(module.exampleConfigJson());
  if (!Array.isArray(at(config, path))) config = JSON.parse(module.defaultConfigJson());
  const list = at(config, path);
  if (!Array.isArray(list)) { console.error(`FAIL ${kind}.${path.join('.')}: no list there`); failed += 1; continue; }

  const before = list.length;
  list.push(blank);

  const after = at(module.readConfigJson(JSON.stringify(config)), path);
  const kept = Array.isArray(after) ? after.length : -1;

  if (kept === before + 1) {
    console.log(`ok   ${kind}: + ${path.join('.')} survives (${before} → ${kept})`);
  } else {
    console.error(`FAIL ${kind}: adding to ${path.join('.')} left ${kept}, expected ${before + 1}`);
    failed += 1;
  }
}

await rm(workspace, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
