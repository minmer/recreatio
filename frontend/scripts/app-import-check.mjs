/**
 * 2026-11-03 — DER IMPORT EINES KURSES IN EINE BAZA, DIE ES SCHON GIBT (`cogita/json.ts`, `cogita/importReview.ts`).
 *
 * Der Fehler, den das nachmisst: die Vorschau und das Speichern planten dasselbe Dokument je für sich, und jedes Neue
 * bekam jedes Mal eine neue Kennung. Was die Durchsicht als angenommen vermerkt hatte, fand das Speichern nicht wieder:
 * ein neuer Rodzaj und seine Einträge fielen STILL weg, während die angenommenen Änderungen an Bestehendem (ein Feld,
 * das auf den neuen Rodzaj zeigt; die Gruppe eines Widok) auf Kennungen zeigten, die nie gespeichert wurden.
 *
 * Hier geht ein Kurs denselben Weg wie in der App (Vorschau → Durchsicht → „Przyjmij wszystkie" → „Zapisz przyjęte"):
 * ein neuer Rodzaj, neue Einträge davon, ein neues Verweisfeld eines bestehenden Rodzaj auf ihn, Werte an bestehenden
 * Einträgen und ein Widok, gruppiert nach dem neuen Rodzaj. Danach muss alles da sein, mit den Kennungen der Vorschau,
 * und derselbe Kurs ein zweites Mal sagt: nichts Neues, nichts zu ändern. Dazu: alle oder keiner (ein Zapis, den der
 * Dienst ablehnt, lässt nichts zurück), kein Verweis ins Leere (blockiert, je Element und Feld), und die Reparatur
 * dessen, was der alte Fehler hinterliess.
 *
 *   node scripts/app-import-check.mjs
 */
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-import-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export { memoryBase, MemoryStore } from '${app}cogita/memoryBase';
export { applyImport, importProblems, ImportBlocked, planImport } from '${app}cogita/json';
export { changesOf, changeSummary, decidedPlan, defaultDecisions, importSession } from '${app}cogita/importReview';
export { CogitaLibrary } from '${app}cogita/store';
export { readView } from '${app}cogita/views';
`);
await build({
  entryPoints: { entry }, bundle: true, format: 'esm', platform: 'node', outdir: workspace, logLevel: 'error',
  loader: { '.css': 'empty' }, define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});
globalThis.BroadcastChannel = undefined;
const A = await import(pathToFileURL(join(workspace, 'entry.js')).href);

let failed = 0;
let passed = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed += 1; console.log(`ok   ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`); }
};
const truth = (name, ok, detail) => check(name, ok === true ? true : { failed: true, detail }, true);

/* -- Die Baza, wie sie vor dem Import dasteht ------------------------------------------------------------------------ */

const TEMAT = {
  ref: '@kurs/temat', name: 'Temat nauki', label: '{nazwa}',
  fields: [
    { key: 'nazwa', label: 'Nazwa', type: 'line' },
    { key: 'nr', label: 'Kolejność', type: 'number' },
    { key: 'wymaga', label: 'Najpierw', type: 'ref', multi: true, to: ['@kurs/temat'], structure: 'up', prerequisite: 'up' }
  ]
};
const STAGES = [1, 2, 3].map((nr) => ({ ref: `@kurs/temat/etap-${nr}`, kinds: ['@kurs/temat'], data: { nazwa: `Etap ${nr}`, nr, ...(nr > 1 ? { wymaga: [`@kurs/temat/etap-${nr - 1}`] } : {}) } }));
const DETAILS = [1, 2, 3].map((nr) => ({ ref: `@kurs/temat/szczegol-${nr}`, kinds: ['@kurs/temat'], data: { nazwa: `Szczegół ${nr}`, wymaga: [`@kurs/temat/etap-${nr}`] } }));
const VIEW = { ref: '@kurs/widok/krajobraz', name: 'Krajobraz', mode: 'landscape', steps: [{ type: 'source.kind', config: { kind: '@kurs/temat' } }], landscape: { budget: 60 } };
const startDoc = () => ({ format: 'recreatio.cogita.course', version: 1, name: 'Kurs', kinds: [TEMAT], entities: [...STAGES, ...DETAILS], views: [VIEW] });

async function freshBase(libraryId = 'kurs-baza') {
  const made = await A.memoryBase(startDoc(), { libraryId, areaId: 'kurs-obszar' });
  if ('error' in made) throw new Error(made.error);
  return made.writer;
}
const stageIds = (lib) => STAGES.map((s) => lib.byImportRef(s.ref.slice(1), 'entity').id);

/* -- Der Kurs, der importiert wird (wie bosko-krajobraz-obszary.json: die Etapy beim „id", alles andere beim Namen) -- */

const OBSZAR = '@kurs/obszar';
function importDoc(lib) {
  return {
    format: 'recreatio.cogita.course', version: 1, name: 'Kurs — obszary',
    kinds: [
      { ref: OBSZAR, name: 'Obszar krajobrazu', label: '{nazwa}', tells: 'nr', fields: [
        { key: 'nazwa', label: 'Nazwa', type: 'line' }, { key: 'nr', label: 'Kolejność', type: 'number' },
        { key: 'nalezy', label: 'Należy do', type: 'ref', to: [OBSZAR], structure: 'up' }
      ] },
      { ...TEMAT, fields: [...TEMAT.fields, { key: 'obszar', label: 'Obszar na mapie', type: 'ref', multi: true, to: [OBSZAR] }] }
    ],
    entities: [
      ...[1, 2, 3].map((nr) => ({ ref: `${OBSZAR}/etap-${nr}`, kinds: [OBSZAR], data: { nazwa: `Obszar ${nr}`, nr } })),
      ...stageIds(lib).map((id, i) => ({ id, kinds: ['@kurs/temat'], data: { obszar: [`${OBSZAR}/etap-${i + 1}`] } }))
    ],
    views: [{ ...VIEW, group: { by: 'axis', kind: OBSZAR, via: ['obszar'], through: 'wymaga', sort: { field: 'nr' } } }]
  };
}
const again = (doc) => JSON.parse(JSON.stringify(doc));
const acceptAll = (changes) => ({ accepted: new Set(changes.map((c) => c.id)), edited: new Map() });
const temat = (lib) => lib.kind(lib.byImportRef('kurs/temat', 'kind').id);
const viewOf = (lib) => lib.docs('view').find((d) => d.data._ref === 'kurs/widok/krajobraz');

/* ===================================================================================================================
 * 1. Der Weg der App: Vorschau, Durchsicht („Przyjmij wszystkie"), Speichern — alles da, mit den Kennungen der Vorschau
 * =================================================================================================================== */
{
  const lib = await freshBase();
  const kindsBefore = lib.kinds.length;
  const doc = importDoc(lib);
  const session = A.importSession(lib, doc);
  const preview = session.plan();
  const changes = session.changes();
  const fresh = changes.filter((c) => c.isNew);
  const edits = changes.filter((c) => !c.isNew);
  check('preview: new = the kind and its 3 entries', fresh.map((c) => c.target).sort(), ['entity', 'entity', 'entity', 'kind']);
  check('preview: changes = the new field on Temat nauki, obszar on 3 stages, the view\'s grouping', edits.map((c) => c.field ?? c.target).sort(), ['group', 'kind', 'obszar', 'obszar', 'obszar']);

  const newKind = preview.kinds.find((k) => k.isNew).id;
  const newEntries = preview.entities.filter((e) => e.isNew).map((e) => e.id);
  const fieldTo = preview.kinds.find((k) => !k.isNew).def.fields.find((f) => f.key === 'obszar').to;
  const groupKind = edits.find((c) => c.field === 'group').after.kind;
  check('preview: the changes point at the new kind the preview shows', [fieldTo, groupKind], [[newKind], newKind]);

  /* Das Panel „Import JSON" plant bei jedem Zeichnen neu (die Zeilen „Co się zmieni") — dieselben Kennungen. */
  const panel = A.planImport(lib, doc);
  check('planning the same document again (another render) gives the same new ids', [panel.kinds.find((k) => k.isNew).id, panel.entities.filter((e) => e.isNew).map((e) => e.id)], [newKind, newEntries]);

  /* Der Besitzer: „Przyjmij wszystkie", dann „Zapisz przyjęte". */
  const decided = session.decide(acceptAll(changes));
  check('nothing blocks the save when everything is ticked', decided.blocked, []);
  const result = await A.applyImport(lib, decided.plan, () => undefined);
  truth('the result says it was one save', /jednym zapisie/.test(result.lines[0]), result.lines);

  check('after save: one kind more (the new one), by the id the preview showed', [lib.kinds.length - kindsBefore, lib.kind(newKind)?.name], [1, 'Obszar krajobrazu']);
  check('after save: its lasting name is registered', lib.byImportRef('kurs/obszar', 'kind')?.id, newKind);
  check('after save: 3 entries of the new kind, by the preview\'s ids', lib.ofKind(newKind).map((e) => e.id).sort(), [...newEntries].sort());
  check('after save: the entries\' lasting names are registered', [1, 2, 3].map((nr) => lib.byImportRef(`kurs/obszar/etap-${nr}`, 'entity')?.id), newEntries);
  check('after save: field obszar on Temat nauki points at the stored kind', temat(lib).fields.find((f) => f.key === 'obszar')?.to, [newKind]);
  check('after save: obszar is set on all 3 stages', stageIds(lib).map((id) => lib.entity(id).data.obszar), newEntries.map((id) => [id]));
  check('after save: the view is grouped by the stored kind', A.readView(viewOf(lib).data).group?.kind ?? viewOf(lib).data.group?.kind, newKind);

  /* Derselbe Kurs ein zweites Mal (frisch eingelesen, wie ein neues Einfügen): nichts Neues, nichts zu ändern. */
  const second = A.importSession(lib, again(doc));
  check('second identical import: 0 new and 0 changes', [second.changes().filter((c) => c.isNew).length, second.changes().filter((c) => !c.isNew).length], [0, 0]);
  check('second identical import: the kind is recognised by its lasting name (no new id)', second.plan().kinds.map((k) => [k.id === newKind || k.id === lib.byImportRef('kurs/temat', 'kind').id, k.isNew]), [[true, false], [true, false]]);
  check('second identical import: the summary says so', A.changeSummary(second.changes()), ['Nic nowego i nic do zmiany — dokument zgadza się z tym, co już jest w bazie.']);
}

/* ===================================================================================================================
 * 2. Der alte Fehler, als Plan nachgestellt: Annahmen, die auf anderen Kennungen gemacht wurden, speichern nie still weniger
 * =================================================================================================================== */
{
  const lib = await freshBase();
  const preview = A.planImport(lib, importDoc(lib));
  const decisions = acceptAll(A.changesOf(lib, preview));
  /* So plante das Speichern vorher: ein neues Objekt, neue Kennungen für alles Neue. */
  const saving = A.planImport(lib, importDoc(lib));
  const decided = A.decidedPlan(lib, saving, A.changesOf(lib, saving), decisions);
  truth('decisions made on other ids: the save is blocked and says what is missing (it used to drop the new items silently)',
    decided.blocked.length > 0 && decided.blocked.some((l) => l.includes('Obszar krajobrazu')), decided.blocked);
  const before = lib.store.all().length;
  let threw = null;
  try { await A.applyImport(lib, decided.plan, () => undefined); } catch (e) { threw = e; }
  truth('…and applying it saves nothing', threw instanceof A.ImportBlocked && lib.store.all().length === before, threw?.message);
}

/* ===================================================================================================================
 * 3. Alle oder keiner: lehnt der Dienst den Zapis ab, bleibt nichts zurück — und der Grund steht da
 * =================================================================================================================== */
{
  const lib = await freshBase();
  const doc = importDoc(lib);
  const session = A.importSession(lib, doc);
  const decided = session.decide(acceptAll(session.changes()));
  const rows = lib.store.all().map((e) => `${e.id}:${e.version}`).sort();
  lib.store.failWith = 'Nic nie zapisano: 1 wpis nie może być zapisany (x: ktoś zmienił go w międzyczasie).';
  let threw = null;
  try { await A.applyImport(lib, decided.plan, () => undefined); } catch (e) { threw = e; }
  lib.store.failWith = null;
  check('a refused save leaves every entry as it was (no new kind, no new entries, no changed ones)', lib.store.all().map((e) => `${e.id}:${e.version}`).sort(), rows);
  truth('a refused save says that nothing was saved, and why', threw !== null && threw.message.startsWith('Nic nie zapisano') && threw.message.includes('ktoś zmienił'), threw?.message);
  /* Danach geht derselbe Zapis — mit denselben Kennungen. */
  const retry = session.decide(acceptAll(session.changes()));
  await A.applyImport(lib, retry.plan, () => undefined);
  check('the same document saved after the refusal: the ids of the first preview', lib.byImportRef('kurs/obszar', 'kind')?.id, decided.plan.kinds.find((k) => k.isNew).id);
}

/* ===================================================================================================================
 * 4. Kein Verweis ins Leere: blockiert, je Element und Feld
 * =================================================================================================================== */
{
  const lib = await freshBase();
  const doc = importDoc(lib);
  const session = A.importSession(lib, doc);
  const changes = session.changes();
  const kindChange = changes.find((c) => c.isNew && c.target === 'kind');
  /* Der neue Rodzaj abgewählt, seine Einträge und alle Änderungen angenommen. */
  const noKind = session.decide({ accepted: new Set(changes.filter((c) => c !== kindChange).map((c) => c.id)), edited: new Map() });
  truth('a new kind left unticked while its entries and the field pointing at it are ticked: blocked, by item and field',
    noKind.blocked.some((l) => l.startsWith('Rodzaj „Temat nauki”, pole „Obszar na mapie” (to)') && l.includes('rodzaj „Obszar krajobrazu”'))
      && noKind.blocked.some((l) => l.startsWith('Wpis „Obszar 1”, rodzaj'))
      && noKind.blocked.some((l) => l.startsWith('Sposób wyświetlania „Krajobraz”') || l.includes('grupowanie')), noKind.blocked);
  /* Ein neuer Eintrag abgewählt, die Änderung des Etap, die auf ihn zeigt, angenommen. */
  const area1 = changes.find((c) => c.isNew && c.target === 'entity' && c.title === 'Obszar 1');
  const noArea = session.decide({ accepted: new Set(changes.filter((c) => c !== area1).map((c) => c.id)), edited: new Map() });
  check('a new entry left unticked while a stage\'s value points at it: blocked, naming the stage, the field and the entry',
    noArea.blocked, ['Wpis „Etap 1”, pole „Obszar na mapie”: wskazuje na nowy element — wpis „Obszar 1” — który nie jest zaznaczony do zapisu; zaznacz go albo odznacz to, co na niego wskazuje.']);
  /* Nur das Neue (die Änderungen nicht angenommen): geht — es zeigt auf nichts, was fehlt. */
  check('only the new items ticked (the default): nothing blocks', session.decide(null).blocked, []);

  /* Ein Rodzaj, den es nicht gibt, beim Namen oder als Kennung: blockiert, auch ohne Durchsicht. */
  const ghost = '01a00000-0000-7000-8000-00000000dead';
  const bad = { format: 'recreatio.cogita.course', version: 1, kinds: [{ ...TEMAT, fields: [...TEMAT.fields, { key: 'obszar', label: 'Obszar na mapie', type: 'ref', to: [ghost] }] }] };
  const plan = A.planImport(lib, bad);
  let threw = null;
  try { await A.applyImport(lib, plan, () => undefined); } catch (e) { threw = e; }
  truth('a field pointing at a kind that exists nowhere: the save is blocked and names the kind, the field and the id',
    threw instanceof A.ImportBlocked && threw.problems.length === 1 && threw.problems[0].startsWith('Rodzaj „Temat nauki”, pole „Obszar na mapie” (to)') && threw.problems[0].includes(ghost), threw?.message);
  check('…and nothing changed', temat(lib).fields.map((f) => f.key), ['nazwa', 'nr', 'wymaga']);
  /* Ein Wert, der auf einen Eintrag zeigt, den es nicht gibt (eine Kennung, kein Name). */
  const badValue = { format: 'recreatio.cogita.entities', version: 1, entities: [{ id: stageIds(lib)[0], kinds: ['@kurs/temat'], data: { wymaga: [ghost] } }] };
  threw = null;
  try { await A.applyImport(lib, A.planImport(lib, badValue), () => undefined); } catch (e) { threw = e; }
  truth('a value pointing at an entry that exists nowhere: blocked, naming the entry and the field', threw instanceof A.ImportBlocked && threw.problems[0]?.startsWith('Wpis „Etap 1”, pole „Najpierw”'), threw?.message);
  /* Ein Verweis ins Leere, den es schon vorher gab, in einem Feld, das der Import nicht anfasst: kein Halt, kein Rauschen. */
  const third = lib.entity(stageIds(lib)[2]);
  await lib.saveEntity({ id: third.id, kinds: third.kinds, data: { ...third.data, wymaga: [ghost] } });
  const touchOther = A.planImport(lib, { format: 'recreatio.cogita.entities', version: 1, entities: [{ id: third.id, kinds: ['@kurs/temat'], data: { nr: 30 } }] });
  const quiet = A.importProblems(lib, touchOther);
  check('an old dangling value in a field the import does not touch: neither blocked nor reported again', [quiet.blocked, quiet.kept], [[], []]);
  /* Ein Name, der nirgends aufgeht, fällt weg — und die Warnung nennt Eintrag UND Feld. */
  const lost = A.planImport(lib, { format: 'recreatio.cogita.entities', version: 1, entities: [{ id: stageIds(lib)[1], kinds: ['@kurs/temat'], data: { wymaga: ['@kurs/nie-ma'] } }] });
  truth('an @name that resolves nowhere is skipped with a warning naming the entry and the field', lost.warnings.some((w) => w.includes('pole „Najpierw (wymaga)”') && w.includes('@kurs/nie-ma')), lost.warnings);
}

/* ===================================================================================================================
 * 5. Was der alte Fehler hinterliess, repariert derselbe Import
 * =================================================================================================================== */
{
  const lib = await freshBase();
  const ghostKind = '01a19f32-bf8c-74c7-bc35-1a186e5cc242';
  /* Der Stand nach drei gescheiterten Importen: Feld obszar zeigt auf einen Rodzaj, den es nie gab; die Gruppe ohne ihn; die Etapy ohne Wert. */
  const t = temat(lib);
  await lib.saveKind({ ...t, fields: [...t.fields, { key: 'obszar', label: 'Obszar na mapie', type: 'ref', multi: true, to: [ghostKind] }] });
  const view = viewOf(lib);
  await lib.saveDoc('view', { ...view.data, group: { by: 'axis', via: ['obszar'], through: 'wymaga', sort: { field: 'nr' } } }, view.id);
  check('broken state: the field points at a kind that does not exist', temat(lib).fields.find((f) => f.key === 'obszar').to, [ghostKind]);

  const session = A.importSession(lib, importDoc(lib));
  const changes = session.changes();
  truth('the re-import lists the repair of the field and of the grouping among its changes',
    changes.some((c) => c.target === 'kind' && !c.isNew && c.afterText.includes('Obszar na mapie')) && changes.some((c) => c.field === 'group'), changes.map((c) => c.id));
  const decided = session.decide(acceptAll(changes));
  check('nothing blocks the repair', decided.blocked, []);
  await A.applyImport(lib, decided.plan, () => undefined);
  const real = lib.byImportRef('kurs/obszar', 'kind').id;
  check('after the re-import: the field points at the real kind', temat(lib).fields.find((f) => f.key === 'obszar').to, [real]);
  check('after the re-import: the view is grouped by the real kind', viewOf(lib).data.group?.kind, real);
  check('after the re-import: every stage has its area', stageIds(lib).map((id) => lib.entity(lib.entity(id).data.obszar[0])?.data.nr), [1, 2, 3]);
  check('after the re-import: no reference into nothing is left', A.importProblems(lib, A.planImport(lib, importDoc(lib))).blocked, []);
}

await rm(workspace, { recursive: true, force: true });
console.log(`\n${passed} checks pass${failed === 0 ? '.' : `, ${failed} FAIL.`}`);
process.exit(failed === 0 ? 0 : 1);
