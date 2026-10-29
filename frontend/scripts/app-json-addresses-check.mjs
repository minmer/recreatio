/**
 * 2026-10-29 — ADRESY I DOMENY ALS JSON ("recreatio/addresses", `pages/addressesJson.ts`), nachgemessen.
 *
 *   1. Jeder Schlüssel des Beispiels ist beschrieben — keiner beschrieben, den es nicht gibt; die Beschreibung
 *      ist ohne jeden Zusammenhang aufrufbar (MCP) und nennt, was ausserhalb der App bleibt.
 *   2. Export → Import plant nichts: dieselben Aliase, dieselben Domains, keine Warnung.
 *   3. Was neu ist, entsteht (ein Alias ohne Gegenstück, eine Domain); was die App nicht kann (einen Alias
 *      umhängen, eine Domain an einen Alias), wird gesagt und nicht getan.
 *   4. Domains wandern in der richtigen Reihenfolge (erst abnehmen, dann anhängen); ein Tausch wird gesagt.
 *   5. Schiefe Werte geben Warnungen, keine Abstürze; der Import läuft weiter, wenn ein Aufruf scheitert.
 *
 *   node scripts/app-json-addresses-check.mjs
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-json-addresses-'));
const entry = join(workspace, 'entry.ts');
const app = fileURLToPath(new URL('../src/app/', import.meta.url)).replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}pages/addressesJson';
export { describe, sectionsOf, samplesOf } from '${app}core/jsonTree';
`);
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
});

/* Wie in app-json-check: ein BroadcastChannel des Schlüsselbunds hielte den Lauf sonst am Leben. */
const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Jeder Schlüssel eines Dokuments als Pfad: `aliases`, `aliases[].path`. */
function pathsOf(value, prefix = '', out = new Set()) {
  for (const [key, one] of Object.entries(value)) {
    const path = `${prefix}${key}`;
    out.add(path);
    if (isPlain(one)) pathsOf(one, `${path}.`, out);
    else if (Array.isArray(one)) for (const item of one) if (isPlain(item)) pathsOf(item, `${path}[].`, out);
  }
  return out;
}

const top = (path) => path.split(/[.[]/)[0];

function documented(label, example, keys) {
  const paths = pathsOf(example);
  for (const path of paths) assert.ok(keys[path] !== undefined, `${label}: "${path}" is in the example but not described`);
  const tops = new Set([...paths].map(top));
  for (const key of Object.keys(keys)) assert.ok(tops.has(top(key)), `${label}: "${key}" is described but not in the example`);
  for (const [key, says] of Object.entries(keys)) assert.ok(typeof says === 'string' && says.trim().length > 3, `${label}: "${key}" has a real sentence`);
}

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);

  /* -- 1: beschrieben, ohne Zusammenhang ------------------------------------------------------------- */
  const text = m.addressesDescription();
  assert.equal(typeof text, 'string');
  assert.ok(text.startsWith(`# Adresy i domeny jako JSON ("${m.ADDRESSES_FORMAT}", wersja 1)`), 'a heading with the format id');
  assert.equal(m.ADDRESSES_FORMAT, 'recreatio/addresses');
  const samples = m.samplesOf(m.ADDRESSES_JSON);
  assert.ok(samples.length >= 1, 'at least one sample to insert');
  for (const sample of samples) documented(`sample „${sample.label}”`, sample.doc(), m.ADDRESSES_KEYS);
  for (const key of Object.keys(m.ADDRESSES_KEYS)) {
    const last = key.split(/[.[\]]+/).filter(Boolean).pop();
    assert.ok(text.includes(`"${last}" — `), `the description explains "${key}"`);
  }
  const example = JSON.parse(text.slice(text.indexOf('Przykład:') + 'Przykład:'.length).trim());
  assert.deepEqual(example, samples[0].doc(), 'the example in the text is the sample');
  for (const ip of [...m.PAGES_A, ...m.PAGES_AAAA, m.PAGES_CNAME, 'Api:Origins']) assert.ok(text.includes(ip), `the description names what stays outside: ${ip}`);
  ok(`description: callable without context, every key of the sample described (${Object.keys(m.ADDRESSES_KEYS).length}), DNS/hosting/origins named`);

  /* -- 2: Export → Import ändert nichts ----------------------------------------------------------------- */
  const R1 = '0190a0a0-0000-7000-8000-000000000001';
  const R2 = '0190a0a0-0000-7000-8000-000000000002';
  const state = {
    pages: [
      { path: 'parafia', roleId: R1, aliasOf: null, host: 'parafia-sw-jozefa.pl' },
      { path: 'parafia/aktualnosci', roleId: R1, aliasOf: null, host: null },
      { path: 'cogita', roleId: R2, aliasOf: null, host: null },
      { path: 'parafia/news', roleId: R1, aliasOf: 'parafia/aktualnosci', host: null },
      { path: 'cogita/start', roleId: R2, aliasOf: 'cogita', host: null }
    ],
    roles: [{ id: R1, name: 'Kancelaria (rola)' }, { id: R2, name: 'Cogita (rola)' }]
  };
  const doc = JSON.parse(JSON.stringify(m.exportAddresses(state)));
  assert.equal(doc.format, m.ADDRESSES_FORMAT);
  assert.deepEqual(doc.pages, ['cogita', 'parafia', 'parafia/aktualnosci'], 'only the roots, sorted');
  assert.deepEqual(doc.aliases.map((a) => a.path), ['cogita/start', 'parafia/news']);
  documented('export', doc, m.ADDRESSES_KEYS);
  const same = m.planAddresses(doc, state);
  assert.ok(!('error' in same));
  assert.deepEqual([same.aliases.length, same.domains.length, same.warnings], [0, 0, []], `an export plans nothing: ${same.warnings.join(' | ')}`);
  assert.ok(same.lines.includes('Nic do zmiany.') && same.lines.some((l) => l.startsWith('Bez zmian: 2 aliasy, 1 domena')), same.lines.join(' | '));
  /* Eine Domain, die der Dienst an einem Alias hält (die Ansicht legt so etwas nicht an): exportiert, und zurück ohne ein Wort. */
  const aliasHost = { ...state, pages: state.pages.map((p) => (p.path === 'cogita/start' ? { ...p, host: 'start.pl' } : p)) };
  const oddBack = m.planAddresses(JSON.parse(JSON.stringify(m.exportAddresses(aliasHost))), aliasHost);
  assert.deepEqual([oddBack.domains.length, oddBack.warnings], [0, []], 'what stands as it is is no change, even where the view would not put it');
  ok('export → plan: nothing to change, every alias and domain recognised by its address, no warning');

  /* -- 3: Neu, und was nicht geht --------------------------------------------------------------------- */
  const fresh = m.planAddresses({
    format: m.ADDRESSES_FORMAT,
    aliases: [
      { path: 'https://recreatio.pl/parafia/ogloszenia/', target: '#/parafia/aktualnosci' },
      { path: 'cogita/kursy', target: 'cogita', role: R1 },
      { path: 'parafia/plan', target: 'parafia', role: 'not-mine' }
    ],
    domains: [{ path: 'cogita', host: 'HTTPS://Cogita.pl/start' }]
  }, state);
  assert.deepEqual(fresh.aliases.map((a) => [a.path, a.target, a.roleId]), [
    ['parafia/ogloszenia', 'parafia/aktualnosci', R1],
    ['cogita/kursy', 'cogita', R1],
    ['parafia/plan', 'parafia', R1]
  ], 'new aliases: addresses written as URLs read as paths; the role of the target unless another of mine is named');
  assert.ok(fresh.warnings.length === 1 && fresh.warnings[0].includes('not-mine'), `a foreign role is said: ${fresh.warnings.join(' | ')}`);
  assert.deepEqual(fresh.domains, [{ path: 'cogita', host: 'cogita.pl', was: null }], 'a domain written as a URL becomes its name');
  assert.ok(fresh.lines.some((l) => l.startsWith('Nowy alias: recreatio.pl/parafia/ogloszenia → recreatio.pl/parafia/aktualnosci')));
  assert.ok(fresh.lines.some((l) => l.includes('cogita.pl')) && fresh.lines.some((l) => l.includes(m.PAGES_A[0])) && fresh.lines.some((l) => l.includes('Api:Origins')),
    'the plan says what stays outside for the new domain');

  const refused = m.planAddresses({
    aliases: [
      { path: 'parafia/news', target: 'cogita' },
      { path: 'parafia', target: 'cogita' },
      { path: 'nowe', target: 'parafia' },
      { path: 'inne/news', target: 'parafia' },
      { path: 'parafia/x', target: 'parafia/news' },
      { path: 'parafia/y', target: 'nieznane' },
      { path: 'parafia/self', target: 'parafia/self' },
      { path: 'Parafia/Źle!', target: 'parafia' },
      { path: 'workspace/x', target: 'parafia' }
    ]
  }, state);
  assert.equal(refused.aliases.length, 0, 'none of these is created');
  assert.equal(refused.warnings.length, 9, `each says why: ${refused.warnings.join(' | ')}`);
  assert.ok(refused.warnings[0].includes('celu aliasu nie da się zmienić'), 'an alias is not moved — the app cannot either');
  assert.ok(refused.warnings[1].includes('to strona, nie alias'));
  assert.ok(refused.warnings[2].includes('najwyższego poziomu'), 'no new top-level word');
  assert.ok(refused.warnings[3].includes('nie prowadzisz adresu „inne”'));
  assert.ok(refused.warnings[4].includes('łańcuchów nie ma'));
  ok('new entries: aliases created with a sensible role, a domain bound; moving an alias, top-level words, foreign parents, chains and odd addresses refused with a word');

  /* -- 4: Domains — ersetzen, abnehmen, wandern, tauschen --------------------------------------------- */
  const swap = m.planAddresses({
    domains: [
      { path: 'parafia', host: 'nowa-parafia.pl' },
      { path: 'cogita', host: null },
      { path: 'parafia/news', host: 'x.pl' },
      { path: 'parafia/aktualnosci', host: 'not a host' },
      { path: 'parafia/aktualnosci', host: 'y.pl' }
    ]
  }, state);
  assert.deepEqual(swap.domains, [{ path: 'parafia', host: 'nowa-parafia.pl', was: 'parafia-sw-jozefa.pl' }], 'a replaced name; unbinding what is not bound is nothing');
  assert.ok(swap.warnings.some((w) => w.includes('nie do aliasu')) && swap.warnings.some((w) => w.includes('not a host')) && swap.warnings.some((w) => w.includes('drugi raz')), swap.warnings.join(' | '));
  assert.ok(swap.lines.some((l) => l.includes('parafia-sw-jozefa.pl → nowa-parafia.pl')));

  const blocked = m.planAddresses({ domains: [{ path: 'cogita', host: 'parafia-sw-jozefa.pl' }] }, state);
  assert.equal(blocked.domains.length, 0, 'a name another page of mine shows is not taken silently');
  assert.ok(blocked.warnings[0].includes('"host": null'), 'and the way to move it is said');

  const moved = m.planAddresses({ domains: [{ path: 'cogita', host: 'parafia-sw-jozefa.pl' }, { path: 'parafia', host: null }] }, state);
  assert.deepEqual(moved.domains.map((d) => [d.path, d.host]), [['parafia', null], ['cogita', 'parafia-sw-jozefa.pl']], 'moving: first unbind, then bind — whatever the order in the document');
  const rebound = m.planAddresses({ domains: [{ path: 'cogita', host: 'parafia-sw-jozefa.pl' }, { path: 'parafia', host: 'nowa.pl' }] }, state);
  assert.deepEqual(rebound.domains.map((d) => [d.path, d.host]), [['parafia', 'nowa.pl'], ['cogita', 'parafia-sw-jozefa.pl']], 'a page that takes a new name gives its old one first');
  const twoPages = { ...state, pages: state.pages.map((p) => (p.path === 'cogita' ? { ...p, host: 'cogita.pl' } : p)) };
  const swapped = m.planAddresses({ domains: [{ path: 'cogita', host: 'parafia-sw-jozefa.pl' }, { path: 'parafia', host: 'cogita.pl' }] }, twoPages);
  assert.equal(swapped.domains.length, 0, 'two pages swapping their names: not in one import');
  assert.equal(swapped.warnings.filter((w) => w.includes('wymieniają się')).length, 2, swapped.warnings.join(' | '));
  ok('domains: replaced in place, unbound only with null, moved after the old page lets go, swaps refused with a word');

  /* -- 5: Schiefes, und der Lauf ---------------------------------------------------------------------- */
  for (const bad of [null, 'nonsense', 42, []]) assert.ok('error' in m.planAddresses(bad, state), `not a document: ${JSON.stringify(bad)}`);
  assert.ok('error' in m.planAddresses({ format: 'recreatio/page' }, state), 'another format is refused');
  const odd = m.planAddresses({ format: m.ADDRESSES_FORMAT, version: 7, extra: 1, aliases: 'x', domains: [null, 42, { host: 'a.pl' }, { path: 'cogita' }, { path: 'cogita', host: 12 }, { path: 'parafia', host: 'a.pl', www: true }] }, state);
  assert.ok(!('error' in odd), 'odd values plan');
  assert.ok(odd.warnings.length >= 8, `each odd thing is said: ${odd.warnings.join(' | ')}`);
  assert.deepEqual(odd.domains.map((d) => d.path), ['parafia'], 'what is readable still goes');
  const empty = m.planAddresses({}, { pages: [], roles: [] });
  assert.deepEqual([empty.aliases.length, empty.domains.length, empty.lines], [0, 0, ['Nic do zmiany.']], 'an empty document on an empty account');
  const lonely = m.planAddresses({ aliases: [{ path: 'parafia/a', target: 'parafia' }] }, { pages: state.pages, roles: [] });
  assert.ok(lonely.aliases.length === 0 && lonely.warnings[0].includes('nie masz roli'), 'without a role nobody can answer for an alias');

  const calls = [];
  const done = await m.applyAddresses(moved, {
    declareAlias: async (...args) => { calls.push(['alias', ...args]); },
    bindDomain: async (...args) => { calls.push(['domain', ...args]); if (args[0] === 'cogita') throw new Error('Ta domena wskazuje już inny adres.'); }
  }, () => undefined);
  assert.deepEqual(calls, [['domain', 'parafia', null], ['domain', 'cogita', 'parafia-sw-jozefa.pl']], 'the calls in the planned order');
  assert.ok(done.warnings.length === 1 && done.warnings[0].includes('inny adres'), 'a refused call is said with the service\'s reason');
  assert.ok(done.lines.includes('Odpięte domeny: 1') && !done.lines.some((l) => l.startsWith('Poza aplikacją')), done.lines.join(' | '));
  const made = [];
  const all = await m.applyAddresses(fresh, { declareAlias: async (...a) => { made.push(a); }, bindDomain: async () => undefined }, () => undefined);
  assert.equal(made.length, 3);
  assert.ok(all.lines.includes('Założone aliasy: 3') && all.lines.includes('Podpięte domeny: 1') && all.lines.some((l) => l.startsWith('Poza aplikacją')), all.lines.join(' | '));

  /* Das Beispiel der Beschreibung, gegen ein Konto, das zu ihm passt: ohne ein Wort. */
  const sample = samples[0].doc();
  const fits = { pages: sample.pages.map((path) => ({ path, roleId: sample.roles[0].id, aliasOf: null, host: null })), roles: sample.roles };
  const planned = m.planAddresses(JSON.parse(JSON.stringify(sample)), fits);
  assert.deepEqual([planned.aliases.length, planned.domains.length, planned.warnings], [1, 1, []], `the sample plans cleanly: ${planned.warnings.join(' | ')}`);
  ok('odd documents: errors for non-documents, warnings for odd values, no crash; a failing call does not stop the rest; the sample plans cleanly');
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
