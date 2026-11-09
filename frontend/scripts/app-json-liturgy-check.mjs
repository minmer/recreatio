/**
 * 2026-11-09 — DIE LITURGIA ALS JSON (`library/liturgy/liturgyJson.ts`), nachgemessen wie jedes Format der App:
 * jedes Feld ist beschrieben, ein unveränderter Export ändert nichts, eine bekannte "id" ändert an Ort und Stelle nur,
 * was sie nennt (null leert), {"id", "remove": true} löscht (oder führt zur Vorgabe zurück), was ins Leere zeigt, hält
 * an, und das erste Format wird noch gelesen.
 *
 *   node scripts/app-json-liturgy-check.mjs
 */
import { useLocale } from './i18n-node.mjs';
await useLocale('pl');
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = await mkdtemp(join(tmpdir(), 'app-json-liturgy-'));
globalThis.BroadcastChannel = undefined;
let passed = 0;
const ok = (label) => { passed += 1; console.log(`ok   ${label}`); };

try {
  await build({
    entryPoints: { liturgy: 'src/app/library/liturgy/liturgyJson.ts', defaults: 'src/app/library/liturgy/defaults.ts', schema: 'src/app/library/liturgy/schema.ts', tree: 'src/app/core/jsonTree.ts' },
    bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error', splitting: true,
    define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
  });
  const m = await import(pathToFileURL(join(out, 'liturgy.js')).href);
  const d = await import(pathToFileURL(join(out, 'defaults.js')).href);
  const s = await import(pathToFileURL(join(out, 'schema.js')).href);
  const tree = await import(pathToFileURL(join(out, 'tree.js')).href);
  const builtins = d.effectiveEntities([]);
  const plan = (doc, own = []) => m.planLiturgyImport(doc, d.effectiveEntities(own), own);
  const doc = (entities) => ({ format: 'recreatio/liturgy', version: 1, entities });

  /* -- Die Beschreibung ---------------------------------------------------------------------------- */
  const text = tree.describe(m.LITURGY_JSON);
  for (const option of s.EntitySchema.options) {
    const type = option.shape.entity_type.value;
    assert.ok(text.includes(`## "${type}" — `), `the description has a section for ${type}`);
    for (const key of Object.keys(option.shape)) if (key !== 'schema_version') assert.ok(text.includes(`"${key}" — `), `the description explains ${type}.${key}`);
  }
  for (const key of m.LITURGY_COMMON_KEYS) assert.ok(text.includes(`"${key}" — `), `the description explains ${key}`);
  for (const key of [...m.BLOCK_KEYS, ...m.RANGE_KEYS, ...m.REF_KEYS, ...m.SLOT_KEYS, ...m.CONDITION_KEYS]) assert.ok(text.includes(`"${key}" — `), `the description explains part key ${key}`);
  for (const r of m.DATE_RULES) assert.ok(text.includes(`"r": "${r}"`), `the description shows the date rule ${r}`);
  for (const a of m.RULE_ACTIONS) assert.ok(text.includes(`"type": "${a}"`), `the description shows the rule action ${a}`);
  assert.ok(!/liturgy\.(json|types)\./.test(text), 'no untranslated key in the description');
  assert.ok(text.includes('\n## Jak aplikacja używa tych danych\n'), 'the description says how the app uses the data');
  assert.ok(text.includes('"roman.template.lauds" (lauds): ') && text.includes('"roman.christmas" — '), 'the built-in ids are listed');
  const sample = m.LITURGY_JSON.samples()[0].doc();
  const fromSample = plan(sample);
  assert.deepEqual([fromSample.problems, fromSample.create.length], [[], 7], 'the sample imports into an empty collection');
  ok(`every field of the nine kinds, every part and the built-in ids are described; the sample imports (${text.length} characters)`);

  /* -- Hinaus und wieder herein -------------------------------------------------------------------- */
  const own = fromSample.create;
  const exported = JSON.parse(JSON.stringify(m.exportLiturgy('Liturgia', own)));
  assert.equal(exported.format, 'recreatio/liturgy');
  assert.ok(exported.entities.every((e) => e.schema_version === undefined && e.revision === undefined), 'the export leaves out what the app counts');
  const same = plan(exported, own);
  assert.deepEqual([same.create.length, same.update.length, same.unchanged, same.warnings.length, same.lines], [0, 0, 7, 0, ['Bez zmian — wszystko jest już w zbiorze.']]);
  ok('export → import of an unchanged collection changes nothing');

  /* -- An Ort und Stelle --------------------------------------------------------------------------- */
  const changed = plan(doc([{ id: 'sample.psalm117.text', title: 'Psalm 117 — poprawiony', source_citation: 'Nowe źródło' }, { id: 'sample.edition', translator: 'X' }]), own);
  const text117 = changed.update.find((u) => u.after.id === 'sample.psalm117.text').after;
  assert.deepEqual([changed.problems, changed.update.length, text117.title, text117.revision], [[], 2, 'Psalm 117 — poprawiony', 2]);
  assert.deepEqual(text117.structured_content, own.find((e) => e.id === 'sample.psalm117.text').structured_content, 'what the document does not name stays');
  const cleared = plan(doc([{ id: 'sample.psalm117.text', source_citation: null }]), changed.update.map((u) => u.after).concat(own.filter((e) => !changed.update.some((u) => u.after.id === e.id))));
  assert.equal(cleared.update[0].after.source_citation, undefined, 'null clears a field');
  assert.ok(plan(doc([{ id: 'sample.edition', title: null }]), own).problems.some((p) => p.code === 'schema'), 'a required field cannot be cleared');
  assert.ok(plan(doc([{ id: 'sample.edition', entity_type: 'canonical_work', work_type: 'psalm' }]), own).problems.some((p) => p.code === 'other_type'), 'an id keeps its kind');
  const odd = plan(doc([{ id: 'sample.edition', hobby: 'chór', _import: {} }]), own);
  assert.ok(odd.warnings.some((w) => w.includes('"hobby"')) && odd.warnings.some((w) => w.includes('"_import"')) && odd.unchanged === 1, 'unknown and internal fields are warned about and ignored');
  assert.ok(plan(doc([{ id: 'sample.edition', metadata: JSON.parse('{"__proto__": {"x": 1}}') }]), own).problems.some((p) => p.detail === '__proto__'), 'prototype keys stop the import');
  const approved = own.map((e) => e.id === 'sample.edition' ? { ...e, status: 'approved' } : e);
  const approvedChange = plan(doc([{ id: 'sample.edition', translator: 'Y' }]), approved);
  assert.ok(approvedChange.problems.length === 0 && approvedChange.warnings.some((w) => w.includes('zatwierdzony')), 'an approved entity may change; the preview warns');
  const builtinChange = plan(doc([{ id: 'roman.template.lauds', title: 'Jutrznia (własna)' }]), own);
  assert.deepEqual([builtinChange.problems, builtinChange.update.length, builtinChange.update[0].after.slots.length], [[], 1, builtins.find((e) => e.id === 'roman.template.lauds').slots.length], 'a built-in entity changes in place, too');
  ok('a known id changes only the fields it names; null clears; kinds, required fields and unknown keys are guarded; approved warns');

  /* -- Neu und gelöscht ---------------------------------------------------------------------------- */
  assert.ok(plan(doc([{ id: 'new.one', title: 'Bez rodzaju' }]), own).problems.some((p) => p.code === 'schema' && p.detail.startsWith('entity_type')), 'a new entity needs its kind');
  const short = plan(doc([{ entity_type: 'psalm_text', id: 'short.psalm', work_id: 'sample.psalm117', edition_id: 'sample.edition', language: 'pl-PL', verses: [{ number: 1, text: 'Krótko' }] }]), own);
  assert.equal(short.create[0].entity_type, 'text_resource', 'the psalm shorthand becomes a text');
  assert.ok(plan(doc([{ id: 'sample.antiphon', remove: true }]), own).problems.some((p) => p.code === 'missing_reference'), 'removing what is used stops the import');
  const together = plan(doc([{ id: 'sample.antiphon', remove: true }, { id: 'sample.lauds.monday', antiphon_ref: null }]), own);
  assert.deepEqual([together.problems, together.remove.map((e) => e.id), together.update.length], [[], ['sample.antiphon'], 1], 'a removal and the fix of its user in one document');
  assert.ok(together.lines.some((l) => l.includes('Usunięty: „Antyfona przykładowa”')), 'the preview names each removal');
  const nothing = plan(doc([{ id: 'no.such', remove: true }]), own);
  assert.ok(nothing.problems.length === 0 && nothing.warnings.some((w) => w.includes('no.such')), 'removing what is not there only warns');
  assert.ok(plan(doc([{ id: 'roman.christmas', remove: true }]), own).problems.some((p) => p.code === 'default_readonly'), 'a built-in entity cannot be removed');
  const override = builtinChange.update[0].after;
  const reset = plan(doc([{ id: 'roman.template.lauds', remove: true }]), [...own, override]);
  assert.deepEqual([reset.problems, reset.reset.length, reset.reset[0].after.title], [[], 1, builtins.find((e) => e.id === 'roman.template.lauds').title], 'a changed built-in returns to its default');
  assert.ok(plan(doc([{ id: 'x', remove: true }, { id: 'x', title: 'y' }]), own).problems.some((p) => p.code === 'duplicate_id'), 'one id once per document');
  ok('new entities need their kind; removals are explicit, checked against their users and named in the preview');

  /* -- Andere Dokumente ---------------------------------------------------------------------------- */
  const first = plan({ format: 'recreatio.liturgy', schema_version: '1.1', mode: 'update', provenance: 'Stary', operations: [
    { op: 'patch', id: 'sample.edition', expected_revision: 1, patch: { translator: 'Z' } }, { op: 'remove', id: 'sample.patron', expected_revision: 1 }
  ] }, own);
  assert.deepEqual([first.problems, first.update[0].after.translator, first.remove[0].id, first.provenance], [[], 'Z', 'sample.patron', 'Stary']);
  assert.ok(first.warnings.some((w) => w.includes('recreatio.liturgy')), 'the first format is read, with a warning');
  assert.ok('error' in plan({ format: 'recreatio/library', entries: [] }, own), 'another format is refused');
  assert.ok('error' in plan('tekst', own) && 'error' in plan({ foo: 1 }, own), 'what is no document is refused');
  assert.equal(plan(doc([7, {}]), own).warnings.length, 2, 'an entity that is no object, or has no id, is skipped with a warning');
  const single = plan({ entity_type: 'canonical_work', id: 'one.work', title: 'Jedno', work_type: 'hymn' }, own);
  assert.equal(single.create.length, 1, 'one entity without the document around it');
  const example = JSON.parse(await readFile(new URL('../../templates/liturgy/complete-example.json', import.meta.url), 'utf8'));
  const whole = plan(example);
  assert.deepEqual([whole.problems, new Set(whole.create.map((e) => e.entity_type)).size, whole.warnings], [[], 9, []], 'the complete example imports without warnings');
  ok('the first format, a single entity and the complete example are read; other documents are refused');
} finally {
  await rm(out, { recursive: true, force: true });
}
console.log(`\n${passed} passed`);
