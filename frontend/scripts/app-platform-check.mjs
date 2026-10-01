/**
 * 0065–0072 — DIE NEUEN STÜCKE, nachgemessen, ohne Browser und ohne Dienst.
 *
 *   1. Adressen: dieselbe Tabelle wie der Dienst (backend/Api.Tests/postal-norms.json),
 *      eine Adresse aus einer Zeile, zurück in eine Zeile, natürliche Hausnummern.
 *   2. Kartoteka als JSON: dieselbe Adresse anders geschrieben ist derselbe Ort.
 *   3. Aufgaben: Zeiträume über die Zeitumstellung, Erinnerungen.
 *   4. Powiadomienia: die Taktung (sichtbar, Hintergrund, Akku, Fehler, ohne Netz).
 *   5. Links mit Zugang: was aus dem Geheimnis folgt, und dass der Beweis nicht der Schlüssel ist.
 *   6. LaTeX: Fussnoten mit Quellen, Zitate, Überschriften, Źródła; entschärfte Zeichen.
 *   7. Program: ein Baum aus Teilen, nach Stelle und Zeit.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-platform-'));
const entry = join(workspace, 'entry.tsx');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * from '${app}postal';
export { planRegistryImport, registryDescription, exportRegistry } from '${app}postalJson';
export { periodStarts, remindersOf, upcomingReminders } from '${app}tasks';
export { nextDelay } from '${app}notify';
export { linkSecrets, aimOf } from '${app}linkAccess';
export { keepLinkFromAddress, linkHref, freshLink } from '${app}linkKeep';
export { safeLink, itemFieldAad, linkWord, putText, emptyTexts } from '${app}calendar';
export { latexEscape, textToLatex, projectToLatex, missingKeys } from '${app}libraryLatex';
export { openProgram, countParts } from '${app}program';
export { placeDay, treeOrder } from '${app}calendarModel';
export { titleFrom } from '${app}chatTopics';
export { sha256Bytes, toBase64Url } from '${app}crypto';
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

const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const ok = (label) => console.log(`ok   ${label}`);

  /* -- 1. Adressen -------------------------------------------------------------------------- */

  const table = JSON.parse(await readFile(join(process.cwd(), '../backend/Api.Tests/postal-norms.json'), 'utf8'));
  for (const [kind, input, expected] of table.norm) {
    assert.equal(m.norm(kind, input), expected, `norm ${kind} "${input}"`);
  }
  const place = (p) => ({ postcode: p[0], post: p[1], locality: p[2], district: p[3], street: p[4], house: p[5], unit: p[6] });
  for (const [a, b, same] of table.keys) {
    assert.equal(m.keyOf(place(a)) === m.keyOf(place(b)), same, `key ${a} vs ${b}`);
  }
  ok(`postal: ${table.norm.length} norms and ${table.keys.length} keys agree with the service table`);

  const cases = [
    ['ul. Długa 5/3, 31-147 Kraków', { street: 'Długa', house: '5', unit: '3', postcode: '31-147', post: 'Kraków' }],
    ['31-147 Kraków, Długa 5 m. 3', { street: 'Długa', house: '5', unit: '3', postcode: '31-147', post: 'Kraków' }],
    ['Zawoja 1234, 34-222 Zawoja', { street: '', locality: 'Zawoja', house: '1234', postcode: '34-222', post: 'Zawoja' }],
    ['al. Jana Pawła II 12a lok. 4, 31-864 Kraków', { street: 'al. Jana Pawła II', house: '12A', unit: '4' }],
    ['os. Kalinowe 4/12, Nowa Huta, Kraków', { street: 'os. Kalinowe', house: '4', unit: '12', locality: 'Kraków', district: 'Nowa Huta' }],
    ['ul. Długa 5, Kraków-Podgórze, 30-001 Kraków', { street: 'Długa', house: '5', locality: 'Kraków', district: 'Podgórze', post: 'Kraków' }],
    ['ul. Mickiewicza 1, Bielsko-Biała', { street: 'Mickiewicza', house: '1', locality: 'Bielsko-Biała', district: '' }],
    ['Długa 7', { street: 'Długa', house: '7' }]
  ];
  for (const [line, want] of cases) {
    const got = m.parseAddress(line);
    for (const [key, value] of Object.entries(want)) assert.equal(got[key], value, `parse "${line}" → ${key}`);
  }
  ok(`postal: ${cases.length} ways of writing an address are split into parts`);

  for (const [line] of cases) {
    const once = m.parseAddress(line);
    const again = m.parseAddress(m.formatAddress(once));
    assert.equal(m.keyOf(again), m.keyOf(once), `round trip "${line}" → "${m.formatAddress(once)}"`);
  }
  assert.equal(m.formatAddress(m.parseAddress('ul. Długa 5/3, 31-147 Kraków')), 'ul. Długa 5/3, 31-147 Kraków');
  ok('postal: an address written back out reads in as the same place');

  assert.deepEqual(['10', '2A', '2', '1', '10/3'].sort(m.houseOrder), ['1', '2', '2A', '10', '10/3']);
  assert.equal(m.keyOf(m.complete({ ...m.EMPTY_ADDRESS, post: 'Kraków', street: 'Długa', house: '5' })),
    m.keyOf({ ...m.EMPTY_ADDRESS, post: 'Kraków', locality: 'Kraków', street: 'Długa', house: '5' }));
  ok('postal: house numbers sort naturally; without a locality the post town counts');

  /* -- 2. Kartoteka als JSON ------------------------------------------------------------------ */

  const known = [{ ...m.parseAddress('ul. Długa 5/3, 31-147 Kraków'), placeId: 'p1', key: '', streetId: null, localityId: null, districtId: null }];
  const families = [{ householdId: 'h1', placeId: 'p1', version: 2, family: 'Kowalscy', people: [], phone: '600', email: '', notes: '', tags: [], kolenda: {} }];
  const plan = m.planRegistryImport({
    format: 'recreatio/registry',
    addresses: [
      { address: 'Dluga 5 m. 3, 31-147 KRAKÓW', household: { phone: '700', kolenda: { 2026: { status: 'visited', date: '2026-01-03' } } } },
      { address: { street: 'Długa', house: '7', locality: 'Kraków', postcode: '31-147' }, household: { family: 'Nowakowie' } },
      { address: '' }
    ]
  }, known, families);
  assert.ok(!('error' in plan));
  assert.equal(plan.rows.length, 2);
  assert.equal(plan.rows[0].placeId, 'p1', 'the same address written differently is the same place');
  assert.equal(plan.rows[0].existing.householdId, 'h1');
  assert.deepEqual(Object.keys(plan.rows[0].household).sort(), ['kolenda', 'phone'], 'only what is given changes');
  assert.equal(plan.rows[1].placeId, null);
  assert.equal(plan.warnings.length, 1);
  assert.ok(m.registryDescription().includes('kolenda') && m.registryDescription().includes('postcode'));
  ok('registry JSON: places are recognised by their parts, households are completed, the description names every key');

  /* -- 3. Aufgaben ----------------------------------------------------------------------------- */

  const first = new Date(2026, 2, 20, 9, 0);
  const starts = m.periodStarts(first, 14 * 1440, first, new Date(2026, 4, 19, 9, 0));
  assert.equal(starts.length, 5);
  assert.ok(starts.every((d) => d.getHours() === 9 && d.getMinutes() === 0), 'whole days stay at 9:00 across DST');
  const far = m.periodStarts(first, 14 * 1440, new Date(2027, 2, 20), new Date(2027, 3, 20));
  assert.ok(far.length >= 2 && far[0] >= new Date(2027, 2, 20));
  const r = m.remindersOf(first, 3 * 1440, 7);
  assert.deepEqual(r.map((x) => x.kind), ['start', 'middle', 'end']);
  assert.equal(r[1].at.getTime() - first.getTime(), 36 * 3600_000);
  assert.equal(r[2].at.getTime() - first.getTime(), (3 * 1440 - 15) * 60_000);
  assert.equal(m.remindersOf(first, 0, 7).length, 1);
  const task = {
    kind: 'period', remind: 5, windowMinutes: 60, dueAt: null,
    occurrences: [
      { at: new Date(Date.now() + 3600_000).toISOString(), endsAt: '', doneAt: null, skippedAt: null },
      { at: new Date(Date.now() + 7200_000).toISOString(), endsAt: '', doneAt: new Date().toISOString(), skippedAt: null }
    ]
  };
  const up = m.upcomingReminders(task, new Date());
  assert.deepEqual(up.map((x) => x.kind), ['start', 'end'], 'settled occurrences do not remind; middle is off');
  ok('tasks: periods keep their hour across DST, reminders at start/middle/end, settled ones stay quiet');

  /* -- 4. Powiadomienia ----------------------------------------------------------------------- */

  const pace = (o) => m.nextDelay({ visible: true, online: true, lowBattery: false, failures: 0, hint: 60, ...o });
  assert.equal(pace({}), 60_000);
  assert.equal(pace({ hint: 120 }), 120_000);
  assert.equal(pace({ visible: false }), 300_000);
  assert.equal(pace({ visible: false, lowBattery: true }), 900_000);
  assert.equal(pace({ lowBattery: true }), 180_000);
  assert.equal(pace({ failures: 1 }), 120_000);
  assert.equal(pace({ failures: 9 }), 900_000, 'backoff stops at 15 minutes');
  assert.equal(pace({ online: false }), null, 'offline: no polling at all');
  assert.equal(pace({ hint: 5 }), 60_000, 'the service cannot make it faster than a minute');
  ok('notifications: one minute visible, five hidden, three times rarer on low battery, backoff to 15 min, nothing offline');

  /* -- 5. Links mit Zugang --------------------------------------------------------------------- */

  const token = m.toBase64Url(new Uint8Array(32).map((_, i) => i));
  const a = await m.linkSecrets(token);
  const b = await m.linkSecrets(token);
  assert.equal(a.lookup, b.lookup, 'the same link, the same lookup');
  assert.notEqual(m.toBase64Url(a.proof), m.toBase64Url(a.sealKey), 'the proof that leaves is not the key that stays');
  assert.equal(a.lookup, m.toBase64Url(await m.sha256Bytes(a.proof)));
  await assert.rejects(() => m.linkSecrets('abc'), 'a cut link is refused');
  ok('access links: proof, lookup and seal key follow from the secret; the proof is not the key');

  /* -- 6. LaTeX ------------------------------------------------------------------------------- */

  assert.equal(m.latexEscape('50% & #1 $ {a_b} ~ ^ \\'), '50\\% \\& \\#1 \\$ \\{a\\_b\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}');
  const entries = [
    { id: 'p', kind: 'person', key: 'ratzinger', data: { givenNames: 'Joseph', surname: 'Ratzinger' } },
    { id: 'w', kind: 'work', key: 'ratzinger2007', data: { workType: 'book', title: 'Jezus z Nazaretu', authors: ['p'], place: 'Kraków', year: '2007' } },
    { id: 'q', kind: 'quote', key: 'chleb', data: { text: 'Chleb & wino', work: ['w'], locator: 's. 23' } },
    { id: 't', kind: 'text', key: 'kazanie', data: { title: 'Chleb życia', body: '## Głód\nJezus mówi [@ratzinger2007, s. 23] i znowu [@ratzinger2007, s. 40].\n\n![@chleb]\n\n- jeden\n- dwa^[uwaga]', further: '' } },
    { id: 'pr', kind: 'project', key: 'ksiazka', data: { title: 'Niedziele', outline: [{ heading: 'Lipiec' }, { text: 't' }] } }
  ];
  const look = { get: (id) => entries.find((e) => e.id === id), byKey: (k) => entries.find((e) => e.key === k), all: () => entries };
  const tex = m.textToLatex(entries[3], look, { author: 'ks. Jan' });
  assert.ok(tex.includes('\\documentclass[11pt,a4paper]{article}') && tex.includes('\\usepackage[polish]{babel}'));
  assert.ok(tex.includes('\\section*{Głód}'), 'headings');
  assert.ok(/\\footnote\{J\. Ratzinger, \\emph\{Jezus z Nazaretu\}.*s\. 23\.\}/.test(tex), 'first citation in full');
  assert.ok(tex.includes('\\footnote{Tamże, s. 40.}'), 'right after: Tamże');
  assert.ok(tex.includes('\\begin{quotation}') && tex.includes('Chleb \\& wino'), 'embedded quote, escaped');
  assert.ok(tex.includes('\\begin{itemize}') && tex.includes('\\footnote{uwaga}'), 'lists and own notes');
  assert.ok(tex.includes('\\section*{Źródła}') && tex.includes('\\end{document}'), 'sources at the end');
  const book = m.projectToLatex(entries[4], look);
  assert.ok(book.includes('{book}') && book.includes('\\part*{Lipiec}') && book.includes('\\chapter*{Chleb życia}') && book.includes('\\tableofcontents'));
  assert.deepEqual(m.missingKeys({ ...entries[3], data: { body: '[@nie-ma] ![@chleb]' } }, look), ['nie-ma']);
  ok('LaTeX: full first citation, Tamże, quotes, lists, notes, sources; a project becomes a book with parts and chapters');

  /* -- 7. Program ----------------------------------------------------------------------------- */

  const row = (itemId, parentItemId, depth, position, startsAt) => ({
    itemId, parentItemId, depth, position, startsAt, endsAt: startsAt, kind: 'appointment', allDay: false, status: 'planned',
    repeatKind: 'none', titlePublic: itemId, visibilityAreaId: 'a', fields: []
  });
  const tree = await m.openProgram([
    row('root', null, 0, null, '2026-10-10T08:00:00Z'),
    row('b', 'root', 1, null, '2026-10-10T12:00:00Z'),
    row('a', 'root', 1, null, '2026-10-10T09:00:00Z'),
    row('first', 'root', 1, 0, '2026-10-10T18:00:00Z'),
    row('a1', 'a', 2, null, '2026-10-10T09:30:00Z')
  ], null);
  assert.deepEqual(tree.children.map((c) => c.itemId), ['first', 'a', 'b'], 'position first, then time');
  assert.equal(tree.children[1].children[0].itemId, 'a1');
  assert.equal(m.countParts(tree), 4);
  ok('program: parts under their whole, by position then time, any depth');

  /* 0074 — Teile stehen im Raster IN ihrem Ganzen, in Liste und Monat darunter. */
  const ev = (key, startH, endH, itemId, parentItemId = null, position = null) => ({
    key, source: 'item', title: key, start: new Date(2026, 9, 10, Math.floor(startH), (startH % 1) * 60), end: new Date(2026, 9, 10, Math.floor(endH), (endH % 1) * 60),
    allDay: false, areaId: 'a', cancelled: false, program: { itemId, parentItemId, position }
  });
  const trip = ev('Wycieczka', 10, 16.5, 'p');
  const ride = ev('Przejazd', 10, 11, 'c1', 'p');
  const game = ev('Gra', 11, 12.5, 'c2', 'p');
  const team = ev('Drużyna', 11.5, 12, 'g1', 'c2');
  const other = ev('Inny', 10, 11, 'o');
  const day = new Date(2026, 9, 10);
  const placed = Object.fromEntries(m.placeDay([trip, ride, game, team, other], day, 25).map((p) => [p.event.key, p]));
  assert.equal(placed.Wycieczka.depth, 0);
  assert.ok(placed.Wycieczka.nested && !placed.Inny.nested, 'a parent with parts carries one header line');
  assert.equal(placed.Wycieczka.columns, 2, 'the unrelated appointment still stands beside it');
  assert.equal(placed.Przejazd.depth, 1);
  assert.ok(placed.Przejazd.x > placed.Wycieczka.x && placed.Przejazd.x + placed.Przejazd.w <= placed.Wycieczka.x + placed.Wycieczka.w + 1e-9, 'a part stands inside its whole');
  assert.equal(placed.Przejazd.top, 10 * 60 + 25, 'a part starting with its whole moves below the header');
  assert.equal(placed.Gra.top, 11 * 60, 'a later part keeps its time');
  assert.equal(placed.Przejazd.columns, 1, 'parts that do not overlap share the full inner width');
  assert.equal(placed.Drużyna.depth, 2, 'a part of a part goes one deeper');
  assert.ok(placed.Drużyna.x > placed.Gra.x, '… inside its own whole');
  const list = m.treeOrder([team, game, other, ride, trip]).map((t) => `${'  '.repeat(t.depth)}${t.event.key}`);
  assert.deepEqual(list, ['Wycieczka', '  Przejazd', '  Gra', '    Drużyna', 'Inny'], 'the list shows each whole with its parts below');
  assert.equal(m.treeOrder([trip, ride, game, team])[0].parts, 3, 'the month counts all parts of a whole');
  const lonely = m.treeOrder([ride]);
  assert.equal(lonely[0].depth, 0, 'a part without its whole that day stands alone');
  ok('program in the calendar: parts inside their whole (deeper inside deeper), header kept, list as a tree, month counts');


  assert.equal(m.titleFrom('Trzeba zamówić autokar. Kto się zajmie?'), 'Trzeba zamówić autokar.');
  ok('chat: a task or appointment from a message takes its first sentence as title');

  /* -- 8. Links mit Ziel, Link eines Termins (0073) ------------------------------------------- */

  const T = m.toBase64Url(new Uint8Array(32).fill(7));
  assert.equal(m.linkHref('https://recreatio.pl/', T, null), `https://recreatio.pl/#/dolacz/${T}`, 'no aim: the join page');
  assert.equal(m.linkHref('https://recreatio.pl/', T, 'parish/x'), `https://recreatio.pl/#/parish/x?dostep=${T}`);
  assert.equal(m.linkHref('https://recreatio.pl/', T, 'parish/x?s=2'), `https://recreatio.pl/#/parish/x?s=2&dostep=${T}`, 'an aim with its own query');
  assert.equal(m.keepLinkFromAddress(`#/parish/x?s=2&dostep=${T}`), '#/parish/x?s=2', 'the secret leaves the address, the slide stays');
  assert.deepEqual(m.freshLink(), { token: T, aim: 'parish/x?s=2' }, 'and is noted as just arrived');
  assert.equal(m.keepLinkFromAddress('#/parish/x?s=2'), null, 'nothing to take');
  assert.equal(m.keepLinkFromAddress(`#/dolacz/${T}`), null, 'the join page keeps its secret in the path');
  assert.deepEqual(m.aimOf('https://recreatio.pl/#/parish/x?s=2'), { aim: 'parish/x?s=2' });
  assert.deepEqual(m.aimOf('#/workspace/calendar'), { aim: 'workspace/calendar' });
  assert.ok('error' in m.aimOf('https://evil.example/#/x'), 'not a foreign site');
  assert.deepEqual(m.aimOf(''), { aim: null });
  assert.deepEqual(m.aimOf(`#/dolacz/${T}`), { aim: null });
  ok('links with an aim: #/<aim>?dostep=T, the secret taken out of the address, aims of ours only');

  assert.deepEqual(m.safeLink('https://recreatio.pl/#/parish/x'), { href: 'https://recreatio.pl/#/parish/x', external: true });
  assert.deepEqual(m.safeLink('www.oaza.pl'), { href: 'https://www.oaza.pl', external: true });
  assert.deepEqual(m.safeLink('#/parish/x'), { href: '#/parish/x', external: false });
  assert.equal(m.safeLink('javascript:alert(1)'), null, 'no script links');
  assert.equal(m.safeLink('zapisy u księdza'), null);
  assert.equal(m.linkWord(''), 'Więcej informacji');
  assert.equal(m.linkWord('Zapisy'), 'Zapisy');
  const texts = m.emptyTexts();
  m.putText(texts, 'link', 'https://a.pl');
  m.putText(texts, 'link_label', 'Zapisy');
  assert.deepEqual([texts.link, texts.linkLabel, texts.notes], ['https://a.pl', 'Zapisy', null]);
  assert.notEqual(JSON.stringify(m.itemFieldAad('i', 'link')), JSON.stringify(m.itemFieldAad('i', 'notes')), 'a link is sealed under its own label, not as a note');
  assert.notEqual(JSON.stringify(m.itemFieldAad('i', 'link')), JSON.stringify(m.itemFieldAad('i', 'link_label')));
  ok('appointment links: https and #/ only, own seal labels, „Więcej informacji\" by default');
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
