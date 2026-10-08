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
 *   9. Der Schlüssel zum Lesen: offengelegt, sonst aus der eigenen Zuteilung — und was es kostet.
 *  10. Als Link handeln: die Beweise im Kopf, ein Bund aus Linkrollen.
 *  11. Gottesdienst (0079): Messe, Beichte, Nabożeństwo — was eine Messe ist, was aushängt, was gedruckt wird.
 *  12. Odbiorcy (0080): die drei Zugänge — Kanał, gemeinsam, einer mit einem — und mit welchen Bereichen einer allein spricht.
 *  13. Zwei Seiten (0082): die Liste und der eine Mensch — dieselbe Reihenfolge, derselbe Filter, über die Adresse.
 *  14. Zgody (0083): PESEL, das Alter in der Logik, eine Zustimmung mit ihrem Wortlaut, Papier, das Blatt, die Wzory.
 *  15. Slajdy (0084): wie sie sich ablösen, wie der Inhalt erscheint, Farben, die mitgehen, und die Bühne.
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
export { nextDelay, whatRings, toldOf, openChatOf, DEFAULT_SETTINGS } from '${app}notify';
export { viewPath } from '${app}routes';
export { lineText, pickSpeaker, unreadOf, conversationTitle, MAX_LINES } from '${app}notifyRich';
export { roundOf, roundValid, shiftRound, roundLabel, roundShort, roundRange, roundsBetween, roundAhead, repeatOf } from '${app}rounds';
export { quickFields, chipText, isBlank, byPerson, tallyOf, tallyText, addressOrder, cellText, roundsCsv } from '${app}roundSheet';
export { filledNow, stepsFor } from '${app}steps';
export { isYes, YES } from '${app}form';
export { linkSecrets, aimOf } from '${app}linkAccess';
export { keepLinkFromAddress, linkHref, freshLink } from '${app}linkKeep';
export { safeLink, itemFieldAad, linkWord, putText, emptyTexts } from '${app}calendar';
export { latexEscape, textToLatex, projectToLatex, missingKeys } from '${app}libraryLatex';
export { openProgram, countParts } from '${app}program';
export { placeDay, treeOrder } from '${app}calendarModel';
export { titleFrom } from '${app}chatTopics';
export { sha256Bytes, toBase64Url, wrapKey, seal, aad, Field } from '${app}crypto';
export { call, carryLinks, LINKS_HEADER } from '${app}session';
export { Ring } from '${app}keys';
export { areaReader } from '${app}areaRead';
export { isMass, massesOnly, othersOnly, intentionsWord, SERVICE_KINDS } from '${app}mass';
export { isLiturgy, OWN_KINDS, kindWord } from '${app}agenda';
export { ITEM_KINDS } from '${app}calendar';
export { intentionsSheetHtml } from '${app}sheet';
export { meetingAreas, othersWrite } from '${app}audience';
export { chatMode, hasSeats, fixedPolicy } from '${app}chat';
export { epochAad } from '${app}area';
export { deskRows, pickRows, neighbours, readEntryQuery, entryQueryString, withEntryQuery, filterWords, stepKindsOf, folded, readSections, PANEL_SECTIONS, NO_FILTER } from '${app}entryDesk';
export { readSubject, writeSubject, subjectKindOf } from '${app}pageSubject';
export { peselValid, peselBirth, birthOf, ageOn } from '${app}pesel';
export { consentValue, consentGiven, consentText, shownAnswer } from '${app}form';
export { evaluate } from '${app}formDesign';
export { paperNeeded, sheetOf, parentalConsentOf, ageFields, PAPER_MINOR } from '${app}SignSheet';
export { NEEDS, readNeeds, needsJson, lockedOf, layoutWithout, logicWithout } from '${app}formTemplates';
export { asked, takenOff } from '${app}form';
export { splitAt, pageLink, keepFromAddress } from '${app}seatKeep';
export { parsePath, pageSteps, ROOT_STEP } from '${app}routes';
export { splitTrail } from '${app}Workspace';
export { slideInAddress, anchorInAddress, slideByAnchor, addressWithSlide } from '${app}slides';
export { ownAddress, atProblem } from '${app}Portal';
export { entering, deckAt, pinnedPosition, motionOf, enterStyle, frameAt, mixColor, colorsAt, colorsOf, calmer } from '${app}slideMotion';
export { readSlideValue, slideJson, remapStage } from '${app}slides';
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
  for (const [kind, input, expected] of table.display) {
    assert.equal(m.display(kind, input), expected, `display ${kind} "${input}"`);
  }
  ok(`postal: ${table.norm.length} norms, ${table.keys.length} keys and ${table.display.length} spellings agree with the service table`);

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

  /* 0082 — eine Schreibweise für jede Adresse der Datenbank (hier ohne Dienst: nur die Schreibweise). */
  const tidied = await m.normalizeAddressLines([
    'ul. długa 5/3, 31147 kraków', '31-147 Kraków, Długa 5 m. 3', 'Zawoja 1234, 34-222 Zawoja', 'Kraków ul. Długa 5', '', 'JANA PAWŁA II 12, KRAKÓW'
  ]);
  assert.equal(tidied[0].tidy, 'ul. Długa 5/3, 31-147 Kraków');
  assert.equal(tidied[0].doubt, false, 'a lower-case address is only respelled');
  assert.equal(tidied[1].tidy, 'ul. Długa 5/3, 31-147 Kraków', 'the same place, written the other way round, ends up the same');
  assert.equal(tidied[2].tidy, 'Zawoja 1234, 34-222 Zawoja', 'a village without streets stays');
  assert.equal(tidied[3].doubt, true, '„ul." in the middle of the street: the splitter was unsure — nobody takes it unseen');
  assert.equal(tidied[4].tidy, '', 'nothing stays nothing');
  assert.equal(tidied[5].tidy, 'ul. Jana Pawła II 12, Kraków');
  const again = await m.normalizeAddressLines(tidied.map((t) => t.tidy));
  again.forEach((t, i) => assert.equal(t.tidy, tidied[i].tidy, `normalizing twice changes nothing: "${tidied[i].tidy}"`));
  ok('postal (0082): one spelling for every address — respelled, reordered, unsure ones flagged, twice is once');

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

  /* 0075 — was klingelt: je Rozmowa, nie die offene, nie beim ersten Stand. */
  const chatRow = (chatId, unread, at, quiet = false) => ({ chatId, areaName: chatId, kind: 'area', unread, lastMessageAt: at, seatName: null, quiet });
  const digestOf = (list, forms = 0, links = 0) => ({
    now: '', since: '', total: 0, tasks: 0, nextPollSeconds: 60, links,
    chats: { unread: list.reduce((n, c) => n + c.unread, 0), loud: list.filter((c) => !c.quiet).reduce((n, c) => n + c.unread, 0), list },
    registrations: { count: forms, list: [] }
  });
  const S = m.DEFAULT_SETTINGS;
  const d1 = digestOf([chatRow('a', 3, '2026-10-02T10:00:00Z')]);
  assert.deepEqual(m.whatRings(null, d1, S, null), { chats: [], forms: false, links: false }, 'the first state is old news');
  const t1 = m.toldOf(d1);
  /* A gelesen (3 → 0), zugleich B neu: die Summe sinkt, B klingelt trotzdem. */
  const d2 = digestOf([chatRow('b', 1, '2026-10-02T10:05:00Z')]);
  assert.deepEqual(m.whatRings(t1, d2, S, null).chats.map((c) => c.chatId), ['b'], 'a new message rings although the total dropped');
  assert.deepEqual(m.whatRings(t1, d2, S, 'b').chats, [], 'the open chat does not ring');
  assert.deepEqual(m.whatRings(t1, d2, { ...S, chats: false }, null).chats, [], 'chats switched off');
  const d3 = digestOf([chatRow('a', 3, '2026-10-02T10:00:00Z'), chatRow('q', 2, '2026-10-02T10:06:00Z', true)]);
  assert.deepEqual(m.whatRings(t1, d3, S, null).chats, [], 'unchanged and muted chats stay silent');
  const d4 = digestOf([chatRow('a', 4, '2026-10-02T10:01:00Z'), chatRow('c', 1, '2026-10-02T10:07:00Z')], 2, 1);
  const r4 = m.whatRings(t1, d4, S, null);
  assert.deepEqual(r4.chats.map((c) => c.chatId), ['c', 'a'], 'newest first');
  assert.equal(r4.forms, true);
  assert.equal(r4.links, true);
  assert.deepEqual(m.whatRings(m.toldOf(d4), d4, S, null), { chats: [], forms: false, links: false }, 'the same state rings once');
  const chatBase = m.viewPath('chat');
  assert.equal(m.openChatOf(`${chatBase}/abc`, true), 'abc');
  assert.equal(m.openChatOf(`${chatBase}/abc?x=1`, true), 'abc');
  assert.equal(m.openChatOf(`${chatBase}/abc`, false), null, 'a hidden page shows no chat');
  assert.equal(m.openChatOf(chatBase, true), null, 'the list is not a chat');
  assert.equal(m.openChatOf(m.viewPath('tasks'), true), null);
  ok('notifications: rings per chat (a read chat does not hide a new one), never the open chat, muted ones or the first state');

  /* 0076 — was in der Meldung steht: geöffnet auf dem Gerät. */
  assert.equal(m.lineText(null), 'Wiadomość, której to urządzenie nie może otworzyć');
  assert.equal(m.lineText({ text: '  Cześć\n\nco  słychać? ', name: null }), 'Cześć co słychać?', 'whitespace folds to one line');
  const attached = (type, name = 'a') => ({ id: '00000000-0000-0000-0000-000000000000', name, type, size: 1, key: 'k'.repeat(43) });
  assert.equal(m.lineText({ text: '', name: null, attachments: [attached('image/jpeg')] }), 'Zdjęcie');
  assert.equal(m.lineText({ text: '', name: null, attachments: [attached('audio/webm'), attached('image/png')] }), 'Wiadomość głosowa (+1)');
  assert.equal(m.lineText({ text: '', name: null, attachments: [attached('application/pdf', 'plan.pdf')] }), 'Plik: plan.pdf');
  assert.equal(m.lineText({ text: 'Zobacz', name: null, attachments: [attached('image/png')] }), 'Zobacz (załączniki: 1)');
  assert.equal(m.lineText({ text: 'x', name: null, forwarded: true }), 'Przekazane: x');
  assert.equal(m.lineText({ text: 'a'.repeat(900), name: null }).length, 600, 'long messages are clipped');

  const roleKinds = { p: 'person', r: 'role', q: 'role' };
  assert.equal(m.pickSpeaker(['r', 'p'], () => true, (id) => roleKinds[id]), 'p', 'a person speaks before a role');
  assert.equal(m.pickSpeaker(['r', 'p'], (id) => id !== 'p', (id) => roleKinds[id]), 'r', 'only roles that may sign');
  assert.equal(m.pickSpeaker(['r'], () => false, (id) => roleKinds[id]), null, 'read-only: no reply field');

  const sealed = (id, at, author, deleted = false) => ({ messageId: id, authorRoleId: author, authorSeatId: null, epoch: 1, bodySealed: 'x', createdAt: at, deletedAt: deleted ? at : null });
  const msgs = [
    sealed('1', '2026-10-02T10:00:00Z', 'them'), sealed('2', '2026-10-02T10:01:00Z', 'me'),
    sealed('3', '2026-10-02T10:02:00Z', 'them'), sealed('4', '2026-10-02T10:03:00Z', 'them', true), sealed('5', '2026-10-02T10:04:00Z', 'them')
  ];
  const isMine = (id) => id === 'me';
  assert.deepEqual(m.unreadOf(msgs, '2026-10-02T10:01:30Z', isMine, 2).map((x) => x.messageId), ['3', '5'], 'after the read mark, theirs, not deleted');
  assert.deepEqual(m.unreadOf(msgs, null, isMine, 1).map((x) => x.messageId), ['5'], 'never read: the unread count from the end');
  const lots = Array.from({ length: 20 }, (_, i) => sealed(String(i), new Date(Date.UTC(2026, 9, 2, 11, i)).toISOString(), 'them'));
  assert.equal(m.unreadOf(lots, '2026-10-02T09:00:00Z', isMine, 20).length, m.MAX_LINES, 'at most MAX_LINES lines');

  const peers = new Map([['other', 'Anna']]);
  const chatShape = (kind, extra = {}) => ({ kind, members: [{ roleId: 'me' }, { roleId: 'other' }], seats: [], ...extra });
  const digestRow = { areaName: 'Oaza', seatName: null };
  assert.equal(m.conversationTitle(chatShape('direct'), digestRow, peers, isMine), 'Anna', 'direct: the other person');
  assert.equal(m.conversationTitle(chatShape('direct'), digestRow, new Map(), isMine), 'Oaza', 'direct without a readable name: the area');
  assert.equal(m.conversationTitle(chatShape('group'), digestRow, peers, isMine), 'Oaza');
  assert.equal(m.conversationTitle(chatShape('seat'), { areaName: 'Oaza', seatName: 'Jan' }, peers, isMine), 'Rozmowa z: Jan');
  assert.equal(m.conversationTitle(chatShape('self'), digestRow, peers, isMine), 'Notatki');
  ok('rich notifications: a line per message (attachments, forwarded, clipped), a person speaks first, unread after the mark, titles by kind');

  /* 0077 — der Zeitraum einer wiederkehrenden Erweiterung: dieselbe Tabelle wie Rounds.cs. */
  const rounds = JSON.parse(await readFile(join(process.cwd(), '../backend/Api.Tests/round-keys.json'), 'utf8'));
  for (const row of rounds.keys) {
    const [y, mo, d] = row.date.split('-').map(Number);
    const at = new Date(y, mo - 1, d, 12, 0, 0);
    for (const kind of ['day', 'week', 'month', 'year']) {
      assert.equal(m.roundOf(kind, at), row[kind], `${kind} of ${row.date}`);
      assert.equal(m.roundValid(kind, row[kind]), true);
    }
    assert.equal(m.roundOf('once', at), '');
  }
  for (const [kind, key, expected] of rounds.valid) assert.equal(m.roundValid(kind, key), expected, `valid ${kind} "${key}"`);
  for (const [kind, key, by, expected] of rounds.shift) assert.equal(m.shiftRound(kind, key, by), expected, `shift ${kind} ${key} by ${by}`);
  /* Spät am Abend und kurz nach Mitternacht: der Tag DIESES Ortes zählt, nicht der in UTC. */
  assert.equal(m.roundOf('day', new Date(2026, 9, 31, 23, 59)), '2026-10-31');
  assert.equal(m.roundOf('month', new Date(2026, 10, 1, 0, 1)), '2026-11');
  assert.equal(m.roundLabel('month', '2026-10'), 'październik 2026');
  assert.equal(m.roundLabel('day', '2026-10-02'), '2 października 2026 (pt)');
  assert.equal(m.roundLabel('week', '2026-W40'), 'tydzień 40 (28.09–4.10.2026)');
  assert.equal(m.roundLabel('week', '2026-W53'), 'tydzień 53 (28.12.2026–3.01.2027)');
  assert.equal(m.roundLabel('year', '2026'), '2026');
  assert.equal(m.roundShort('month', '2026-10'), 'paź');
  assert.equal(m.roundShort('week', '2026-W05'), 'T5');
  assert.deepEqual(m.roundRange('month', '2026-10'), { from: '2026-01', to: '2026-12', label: '2026' });
  assert.deepEqual(m.roundRange('day', '2024-02-10'), { from: '2024-02-01', to: '2024-02-29', label: 'luty 2024' });
  assert.deepEqual(m.roundRange('week', '2026-W40'), { from: '2026-W01', to: '2026-W53', label: '2026' });
  assert.deepEqual(m.roundRange('year', '2026'), { from: '2017', to: '2026', label: '2017–2026' });
  assert.equal(m.roundsBetween('month', '2026-01', '2026-12').length, 12);
  assert.equal(m.roundsBetween('week', '2026-W01', '2026-W53').length, 53);
  assert.deepEqual(m.roundsBetween('day', '2026-02-27', '2026-03-01'), ['2026-02-27', '2026-02-28', '2026-03-01']);
  assert.equal(m.roundAhead('month', '2026-11', new Date(2026, 9, 31, 23, 0)), true);
  assert.equal(m.roundAhead('month', '2026-10', new Date(2026, 9, 31, 23, 0)), false);
  assert.equal(m.repeatOf('month'), 'month');
  assert.equal(m.repeatOf(undefined), 'once');
  assert.equal(m.repeatOf('hourly'), 'once');
  ok('rounds: day, ISO week, month and year keys agree with the service table; labels, shifting across years, ranges');

  /* 0077 — die Liste einer wiederkehrenden Erweiterung: was sich rechnen lässt. */
  {
    const q = (fieldId, label, kind = 'checkbox', options = []) => ({ fieldId, label, kind, options, identityRole: 'none' });
    const sheetFields = [q('k', 'Komunia'), q('s', 'Spowiedź'), q('n', 'Namaszczenie chorych?'), q('u', 'Uwagi', 'text'), q('o', 'Ofiara', 'number'), q('w', 'Stan', 'choice', ['dobry', 'słaby']), q('z', null)];
    for (const yes of ['tak', 'TAK', ' t ', 'yes', 'true', '1', 'x', '✓']) assert.equal(m.isYes(yes), true, `"${yes}" is a yes`);
    for (const no of ['', 'nie', 'no', '0', 'może', undefined, null]) assert.equal(m.isYes(no), false, `"${no}" is not a yes`);
    assert.deepEqual(m.quickFields(sheetFields).map((x) => x.fieldId), ['k', 's', 'n'], 'only readable yes/no questions can be tapped');
    assert.equal(m.chipText('Komunia'), 'Komunia');
    assert.equal(m.chipText('Namaszczenie chorych?'), 'Namaszczenie…');
    assert.equal(m.isBlank(undefined), true);
    assert.equal(m.isBlank(new Map([['k', ''], ['u', '  ']])), true);
    assert.equal(m.isBlank(new Map([['k', ''], ['u', 'x']])), false);

    const rec = (registrationId, baseId, round, values) => ({ registrationId, baseId, round, values: new Map(Object.entries(values)) });
    const all = [
      rec('1', 'anna', '2026-09', { k: 'tak', s: 'tak', o: '20', w: 'dobry' }),
      rec('2', 'anna', '2026-10', { k: 'tak', n: 'tak', u: 'w szpitalu', o: '10,50', w: 'słaby' }),
      rec('3', 'jan', '2026-10', { k: 'tak', w: 'słaby' }),
      rec('4', 'jan', '2026-08', { k: '', u: '' })
    ];
    const month = m.tallyOf(sheetFields, all.filter((r) => r.round === '2026-10'));
    assert.equal(month.records, 2);
    assert.deepEqual([month.yes.get('k'), month.yes.get('s') ?? 0, month.yes.get('n')], [2, 0, 1]);
    assert.equal(month.sums.get('o'), 10.5, 'a comma is a decimal point here');
    assert.deepEqual([...month.choices.get('w')], [['słaby', 2]]);
    const year = m.tallyOf(sheetFields, all);
    assert.equal(year.records, 3, 'a record in which nothing stands does not count');
    assert.equal(year.yes.get('k'), 3);
    assert.equal(m.tallyText(sheetFields, month), 'Komunia 2 · Spowiedź 0 · Namaszczenie chorych? 1 · Ofiara 10.5 · Stan: słaby 2');
    const mine = m.byPerson(all);
    assert.equal(mine.get('anna').get('2026-10').registrationId, '2');
    assert.equal(m.cellText(m.quickFields(sheetFields), mine.get('anna').get('2026-10')), 'K N');
    assert.equal(m.cellText(m.quickFields(sheetFields), mine.get('jan').get('2026-08')), '', 'an empty record shows as nothing');
    assert.equal(m.cellText(m.quickFields(sheetFields), rec('9', 'x', '2026-10', { u: 'tylko notatka' })), '•');
    assert.ok(m.addressOrder('ul. Długa 2, 34-600 Limanowa', 'ul. Długa 10, 34-600 Limanowa') < 0, 'house 2 comes before house 10');
    assert.ok(m.addressOrder('', 'ul. Długa 1') > 0, 'people without an address go last');
    const csv = m.roundsCsv('month', sheetFields, [{ baseId: 'anna', name: 'Kowalska; Anna' }, { baseId: 'jan', name: 'Nowak Jan' }], all);
    const csvLines = csv.replace('\uFEFF', '').trim().split('\r\n');
    assert.equal(csvLines[0], 'Osoba;Okres;Okres (klucz);Komunia;Spowiedź;Namaszczenie chorych?;Uwagi;Ofiara;Stan');
    assert.equal(csvLines.length, 4, 'one line per record that says something');
    assert.equal(csvLines[1], '"Kowalska; Anna";wrzesień 2026;2026-09;tak;tak;;;20;dobry');
    assert.equal(csvLines[3], 'Nowak Jan;październik 2026;2026-10;tak;;;;;słaby');

    /* Ein Schritt für den LAUFENDEN Zeitraum. */
    const oct = new Date(2026, 9, 2, 12, 0, 0);
    assert.equal(m.filledNow('once', { round: '' }, oct), true);
    assert.equal(m.filledNow(undefined, { round: '' }, oct), true);
    assert.equal(m.filledNow('month', { round: '2026-10' }, oct), true);
    assert.equal(m.filledNow('month', { round: '2026-09' }, oct), false, 'last month does not fill this month');
    assert.equal(m.filledNow('month', undefined, oct), false);
    const stepStates = m.stepsFor({
      hasSeat: false, confirmedAt: null, steps: [], marks: [], now: oct,
      extensions: [{ moduleId: 'e', name: 'Odwiedziny', audience: 'office', repeat: 'month' }, { moduleId: 'p', name: 'Raport', audience: 'person', repeat: 'week' }],
      filled: new Map([['e', '2026-10-02T10:00:00Z']])
    });
    assert.equal(stepStates[0].label, 'Odwiedziny — październik 2026');
    assert.equal(stepStates[0].status, 'done');
    assert.equal(stepStates[1].label, 'Uzupełnij: Raport — tydzień 40 (28.09–4.10.2026)');
    assert.equal(stepStates[1].status, 'todo');
    ok('round sheet: yes/no reading, tap fields, totals per period and year, history cells, route order, CSV, steps for the running period');
  }

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

  /* -- 9. Der Schlüssel zum Lesen (`areaReader`) ------------------------------------------------ */
  /*
   * Das Formular auf der Seite kannte nur den offengelegten Schlüssel: ein Formular in einem
   * Bereich, der nicht jawny ist, blieb dort auch für den zu, der den Bereich führt. Hier steht,
   * welche Wege es gibt, in welcher Reihenfolge, und dass ein Besucher keinen davon bezahlt.
   */
  {
    const realFetch = globalThis.fetch;
    const asked = [];
    const published = new Map();
    const grants = new Map();
    let session = null;
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    globalThis.fetch = async (url) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '');
      asked.push(path);
      let hit;
      if ((hit = /^\/area\/([^/]+)\/key$/.exec(path)) !== null) {
        const open = published.get(hit[1]);
        return open === undefined ? json(404, { error: 'nie' }) : json(200, { areaId: hit[1], epoch: open.epoch, key: m.toBase64Url(open.key) });
      }
      if (path === '/session') return session === null ? json(401, { error: 'nie' }) : json(200, session);
      if ((hit = /^\/workspace\/area\/([^/]+)\/keys$/.exec(path)) !== null) return json(200, { keys: grants.get(hit[1]) ?? [] });
      return json(404, { error: 'nie' });
    };
    const times = (path) => asked.filter((one) => one === path).length;

    try {
      const openKey = new Uint8Array(32).fill(1);
      const memberKey = new Uint8Array(32).fill(2);
      published.set('open', { epoch: 2, key: openKey });

      /* Ein Besucher: der offene Schlüssel, und sonst keine Anfrage. */
      const visitor = m.areaReader();
      assert.deepEqual(await visitor.key('open', 2), openKey, 'the published key of the right epoch');
      assert.deepEqual(asked, ['/area/open/key'], 'a visitor of a public form pays one request');
      assert.equal(visitor.account(), null, 'the account was not needed');

      /* Eine andere Epoche öffnet nichts — und ein Bereich, der nicht offen ist, auch nicht. */
      assert.equal(await visitor.key('open', 1), undefined, 'a key of another epoch is no key');
      assert.equal(await visitor.key('closed', 1), undefined);
      assert.equal(visitor.account(), 'none');
      assert.equal(times('/session'), 1, 'the session is asked once, not per area');
      assert.equal(times('/area/open/key'), 1, 'and the published key once per area');

      /* Angemeldet, aber ohne Schlüsselbund in diesem Tab. */
      session = { accountId: 'a', loginId: 'x', masterKeySealed: '' };
      const locked = m.areaReader();
      assert.equal(await locked.key('closed', 1), undefined);
      assert.equal(locked.account(), 'locked', 'signed in without keys is not the same as nobody');

      /* Wer den Bereich liest: sein Schlüssel aus der Zuteilung — das, was dem Formular auf der Seite fehlte. */
      const pair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
      const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
      const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
      const grant = async (areaId, epoch, key) => ({ roleId: 'r', epoch, sealedBlob: m.toBase64Url(await m.wrapKey(spki, m.epochAad(areaId, epoch), key)) });
      grants.set('closed', [await grant('closed', 1, memberKey)]);
      grants.set('open', [await grant('open', 2, memberKey)]);
      const ring = { wrapPrivate: async () => pkcs8 };

      asked.length = 0;
      const member = m.areaReader(ring);
      assert.deepEqual(await member.key('closed', 1), memberKey, 'a member reads an area that is not public');
      assert.equal(await member.key('closed', 9), undefined, 'but only the epochs they hold');
      assert.equal(times('/workspace/area/closed/keys'), 1, 'the grants of an area are fetched once');
      assert.equal(member.account(), 'open');
      assert.deepEqual(await member.key('open', 2), openKey, 'what is published is taken as published');
      assert.equal(times('/workspace/area/open/keys'), 0, 'no RSA where the key lies open');
      assert.equal(times('/session'), 0, 'a view that brings its ring asks no session');
    } finally {
      globalThis.fetch = realFetch;
    }
    ok('reading key: published first, then the own grant; right epoch only; a visitor pays one request, signed in without keys is "locked"');
  }

  /* -- 10. Als Link handeln (`linkMe.ts`, `Caller` im Dienst) ------------------------------------ */
  /*
   * Ein Link mit Zugang ist eine Rolle. Ohne Konto handelt der Browser als sie: die Beweise reisen
   * im Kopf mit — aber erst, wenn es eingeschaltet ist, und nicht mehr nach einer Anmeldung —, und
   * ein Bund aus Linkrollen öffnet, was für die Linkrolle versiegelt wurde.
   */
  {
    const realFetch = globalThis.fetch;
    const seen = [];
    const grants = new Map();
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    globalThis.fetch = async (url, init) => {
      const path = String(url).replace(/^https?:\/\/[^/]+/, '');
      seen.push({ path, links: new Headers(init?.headers ?? {}).get(m.LINKS_HEADER) });
      const hit = /^\/workspace\/area\/([^/]+)\/keys$/.exec(path);
      if (hit !== null) return json(200, { keys: grants.get(hit[1]) ?? [] });
      return path === '/area/closed/key' ? json(404, { error: 'nie' }) : json(200, { ok: true });
    };

    try {
      await m.call('/workspace/calendars');
      assert.equal(seen.at(-1).links, null, 'a visitor without links sends no proofs');

      m.carryLinks(async () => ['proofA', 'proofB']);
      await m.call('/workspace/calendars');
      assert.equal(seen.at(-1).links, 'proofA,proofB', 'acting as links: the proofs travel in the header');
      await m.call('/workspace/item/x', { method: 'POST', body: '{}' });
      assert.equal(seen.at(-1).links, 'proofA,proofB', 'on writes too');

      m.carryLinks(async () => { throw new Error('storage gone'); });
      await m.call('/workspace/calendars');
      assert.equal(seen.at(-1).links, null, 'proofs that cannot be made never break the request');

      m.carryLinks(async () => []);
      await m.call('/workspace/calendars');
      assert.equal(seen.at(-1).links, null, 'no links, no header');

      m.carryLinks(null);
      await m.call('/workspace/calendars');
      assert.equal(seen.at(-1).links, null, 'switched off (a sign-in does this): the account acts');

      /* Der Bund aus Linkrollen: der Rollenschlüssel kommt aus dem Link, nicht aus einem Konto. */
      const pair = await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
      const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
      const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
      const roleKey = new Uint8Array(32).fill(9);
      const areaKey = new Uint8Array(32).fill(4);
      const role = {
        id: 'link-role', kind: 'role', isPersonal: false, createdAt: '', displayNameSealed: null, wrapPublicKey: '', signPublicKey: '',
        wrapPrivateSealed: m.toBase64Url(await m.seal(roleKey, m.aad('kernel', 'role', 'link-role', m.Field.RoleWrapPrivate, 1), pkcs8)),
        signPrivateSealed: null, keyLayout: 1
      };
      const ring = m.Ring.ofRoles([{ role, key: roleKey }]);
      assert.ok(ring.has('link-role') && !ring.has('someone-else'));
      assert.deepEqual(await ring.wrapPrivate('link-role'), pkcs8, 'the ring opens the wrap key of the link role');

      grants.set('closed', [{ roleId: 'link-role', epoch: 1, sealedBlob: m.toBase64Url(await m.wrapKey(spki, m.epochAad('closed', 1), areaKey)) }]);
      assert.deepEqual(await m.areaReader(ring).key('closed', 1), areaKey, 'and with it the area key sealed for the link role');

      /* `null` heisst: kein Weg über das Konto — dann wird die Sitzung gar nicht erst gefragt. */
      seen.length = 0;
      const noAccount = m.areaReader(null);
      assert.equal(await noAccount.key('closed', 1), undefined);
      assert.equal(noAccount.account(), 'none');
      assert.ok(!seen.some((one) => one.path === '/session'), 'told there is no account, the reader does not ask for one');
    } finally {
      m.carryLinks(null);
      globalThis.fetch = realFetch;
    }
    ok('acting as a link: proofs in the header only while switched on, a ring of link roles opens what is sealed for them');
  }

  /* -- 11. Gottesdienst (0079) ----------------------------------------------------------------- */
  {
    const at = (h) => `2026-10-05T${h}:00+02:00`;
    const service = (kind, h, extra = {}) => ({
      itemId: kind + h, kind, occurrenceAt: at(h), startsAt: at(h), endsAt: at(h), status: 'planned', title: null,
      calendarId: 'c', calendarTitle: 'c', areaName: 'a', timeZone: 'Europe/Warsaw', intentions: [], ...extra
    });
    const day = [
      service('mass', '07:00', { intentions: [{ ordinal: 0, text: 'Za śp. Jana', kind: 'single' }] }),
      service('devotion', '17:30', { title: 'Różaniec' }),
      service('confession', '17:00'),
      service('mass', '18:00', { status: 'cancelled', skipped: true })
    ];
    assert.deepEqual(m.massesOnly(day).map((x) => x.kind), ['mass', 'mass'], 'a devotion is not a mass (it used to be: "all but confession")');
    assert.deepEqual(m.othersOnly(day).map((x) => x.kind).sort(), ['confession', 'devotion']);
    assert.ok(m.ITEM_KINDS.includes('devotion') && m.SERVICE_KINDS.includes('devotion'), 'the devotion is a kind, like ck_item_kind (0079)');
    assert.ok(['mass', 'confession', 'devotion'].every((k) => m.isLiturgy(k) && m.OWN_KINDS.includes(k)), 'every service is edited in the calendar now');
    assert.ok(!m.isLiturgy('appointment') && !m.isLiturgy(undefined));
    assert.equal(m.kindWord('devotion'), 'Nabożeństwo');
    assert.deepEqual([1, 2, 4, 5, 12, 22, 25].map(m.intentionsWord),
      ['1 intencja', '2 intencje', '4 intencje', '5 intencji', '12 intencji', '22 intencje', '25 intencji']);

    const html = m.intentionsSheetHtml(day, new Date('2026-10-05T00:00:00+02:00'), new Date('2026-10-05T23:59:00+02:00'));
    assert.ok(html.includes('Za śp. Jana'), 'the sheet prints the intentions');
    assert.ok(!html.includes('Różaniec'), 'a devotion is not on the sheet of intentions');
    assert.ok(html.includes('msza odwołana'), 'a cancelled mass stands on the sheet, as cancelled');
    ok('services (0079): a devotion is no mass, every service is edited in the calendar, the sheet says "odwołana", Polish plural of intentions');
  }

  /* -- 12. Odbiorcy (0080) ------------------------------------------------------------------- */
  {
    assert.deepEqual(['channel', 'area', 'seat', 'group', 'direct', 'self'].map(m.chatMode), ['channel', 'together', 'one', null, null, null],
      'the chats of an area are the three accesses; own chats are none of them');
    assert.deepEqual(['channel', 'area', 'seat', 'group'].map(m.hasSeats), [true, true, true, false], 'people with a link are in the three accesses only');
    assert.deepEqual(['area', 'channel', 'self', 'group', 'seat'].map(m.fixedPolicy), [true, true, true, false, false], 'the kind decides who writes in a conversation and a channel');
    assert.deepEqual(['channel', 'together', 'one'].map(m.othersWrite), [false, true, true], 'in a channel the others listen');

    /* Parafia → Bierzmowanie → { Kandydaci, Ksiądz }; Oaza nebenan; Prywatne liest nur jemand anders. */
    const area = (areaId, parentAreaId, myLevel = 'read') => ({ areaId, parentAreaId, myLevel, name: areaId });
    const areas = [area('parafia', null, 'admin'), area('bierzmowanie', 'parafia'), area('kandydaci', 'bierzmowanie'),
      area('ksiadz', 'bierzmowanie', 'admin'), area('oaza', 'parafia'), area('obcy', 'parafia', null)];
    const near = m.meetingAreas(areas, ['parafia', 'kandydaci', 'ksiadz', 'kandydaci']);
    assert.deepEqual(near.map((a) => a.areaId), ['parafia', 'kandydaci', 'ksiadz', 'bierzmowanie'],
      "one-to-one: the form's own areas first, then everything above them, each once — never a sibling");
    assert.deepEqual(m.meetingAreas(areas, ['obcy', null, undefined, '']).map((a) => a.areaId), ['parafia'], 'an area I do not read is skipped, its parent is not');
    assert.deepEqual(m.meetingAreas(areas, ['nirgends']), [], 'an unknown area offers nothing');
    ok("audience (0080): channel, together, one; seats only in those; one-to-one with the form's areas and those above");
  }

  /* -- 13. Zwei Seiten: Lista osób und Panel osoby (0082) ------------------------------------ */
  {
    const field = (fieldId, identityRole, kind = 'line') => ({ fieldId, identityRole, kind, label: fieldId, areaId: 'a', options: [] });
    const fields = [field('imie', 'given_name'), field('nazwisko', 'surname'), field('tel', 'phone', 'phone'), field('parafia', 'none')];
    const sub = (id, at, extra = {}) => ({
      registrationId: id, submittedAt: at, seatId: 's-' + id, confirmedAt: null, hidden: false, withdrawnAt: null,
      values: [], checks: [], marks: [], extensions: [], ...extra
    });
    const registrations = [
      sub('r1', '2026-09-03', { confirmedAt: '2026-09-05', marks: [{ stepId: 'zgoda', doneAt: '2026-09-10' }] }),
      sub('r2', '2026-09-01'),
      sub('r3', '2026-09-02', { hidden: true }),
      sub('r4', '2026-09-04')
    ];
    const opened = new Map([
      ['r1', new Map([['imie', 'Łukasz'], ['nazwisko', 'Nowak'], ['tel', '600 700 800'], ['parafia', 'św. Anny']])],
      ['r2', new Map([['imie', 'Anna'], ['nazwisko', 'Kowalska'], ['tel', '601 000 111']])],
      ['r3', new Map([['imie', 'Ola'], ['nazwisko', 'Zielińska']])],
      ['r4', new Map([['imie', 'Anna'], ['nazwisko', 'Kowalska'], ['parafia', 'Grzegórzki']])]
    ]);
    const info = { steps: [{ stepId: 'zgoda', key: 'zgoda', label: 'Zgoda rodziców', help: null, dueAt: null, doneBy: 'office', areaId: 'a', epoch: 1, position: 0 }], extensions: [] };
    const rows = m.deskRows({ registrations, fields, opened }, info);
    const ids = (list) => list.map((r) => r.s.registrationId);

    assert.deepEqual(ids(rows), ['r2', 'r4', 'r1', 'r3'], 'by name (Polish order), the same name by the time it came — one order on both pages');
    assert.equal(rows[2].name, 'Łukasz Nowak');
    assert.deepEqual(rows[2].phones.map((p) => p.dial), ['+48600700800']);

    const shown = m.pickRows(rows, m.NO_FILTER);
    assert.deepEqual(ids(shown), ['r2', 'r4', 'r1'], 'the hidden one only on request');
    assert.deepEqual(ids(m.pickRows(rows, { ...m.NO_FILTER, hidden: true })), ['r2', 'r4', 'r1', 'r3']);
    assert.deepEqual(ids(m.pickRows(rows, { ...m.NO_FILTER, q: 'lukasz' })), ['r1'], 'search without diacritics');
    assert.deepEqual(ids(m.pickRows(rows, { ...m.NO_FILTER, q: '600700' })), ['r1'], 'a number found without its spaces');
    assert.deepEqual(ids(m.pickRows(rows, { ...m.NO_FILTER, q: 'grzegorzki' })), ['r4'], 'in any answer');
    assert.deepEqual(ids(m.pickRows(rows, { ...m.NO_FILTER, step: 'todo:step:zgoda' })), ['r2', 'r4'], 'who still lacks the step');
    assert.deepEqual(ids(m.pickRows(rows, { ...m.NO_FILTER, step: 'done' })), ['r1']);
    assert.deepEqual(m.stepKindsOf(rows).map(([key]) => key), ['confirm', 'step:zgoda']);
    assert.equal(m.filterWords({ q: 'kow', step: 'todo:step:zgoda', hidden: true }, m.stepKindsOf(rows)), 'brakuje: Zgoda rodziców · „kow" · z ukrytymi');

    const lacking = m.pickRows(rows, { ...m.NO_FILTER, step: 'todo:step:zgoda' });
    assert.deepEqual([m.neighbours(rows, lacking, 'r2').prev, ids([m.neighbours(rows, lacking, 'r2').next])[0], m.neighbours(rows, lacking, 'r2').at], [null, 'r4', 1],
      '◀ ▶ walk the filtered list');
    const outside = m.neighbours(rows, lacking, 'r1');
    assert.deepEqual([ids([outside.prev])[0], outside.next, outside.at], ['r4', null, 0], 'outside the filter: the neighbours it would stand between');
    assert.deepEqual(ids([m.neighbours(rows, lacking, null).next]), ['r2'], 'nobody chosen: ▶ goes to the first');

    const query = { id: 'r4', filter: { q: 'anna kow', step: 'todo:step:zgoda', hidden: false }, from: 'parafia/kandydaci' };
    const text = m.entryQueryString(query);
    assert.deepEqual(m.readEntryQuery('#/parafia/kandydat' + text), query, 'the address carries choice, filter and the list it came from');
    assert.equal(m.withEntryQuery('#/parafia/kandydat?part=x&wpis=old', { ...query, filter: m.NO_FILTER, from: null }), '#/parafia/kandydat?part=x&wpis=r4',
      'other keys stay, ours are replaced');
    assert.equal(m.withEntryQuery('#/p?wpis=r4', { id: null, filter: m.NO_FILTER, from: null }), '#/p', 'nothing to say — no question mark');

    assert.deepEqual(m.readSections(''), m.PANEL_SECTIONS, 'an empty choice of sections is all of them');
    assert.deepEqual(m.readSections('steps, nonsense,answers'), ['answers', 'steps'], 'in their own order, unknown ones dropped');

    assert.deepEqual(m.readSubject('{"kind":"entry","form":"f1"}'), { kind: 'entry', form: 'f1' });
    assert.equal(m.readSubject('{"form":"f1"}'), null, 'without a kind there is no choice');
    assert.equal(m.readSubject('nonsense'), null);
    assert.equal(m.subjectKindOf('entry').missing({ kind: 'entry' }), 'Wybierz formularz.');
    ok('two pages (0082): one order, filter by text/step/hidden, ◀ ▶ along the filtered list, the address carries it all');
  }

  /* -- 14. Zgody, ubezpieczenie (0083) --------------------------------------------------------- */
  {
    assert.equal(m.peselValid('44051401359'), true, 'a valid PESEL (1944)');
    assert.equal(m.peselValid('44051401358'), false, 'a wrong check digit');
    assert.equal(m.peselValid('4405140135'), false, 'ten digits');
    assert.equal(m.peselBirth('02270803624'), '2002-07-08', 'the month carries the century: +20 for 20xx');
    assert.equal(m.peselValid('02270803624'), true);
    assert.equal(m.peselBirth('44051401359'), '1944-05-14');
    assert.equal(m.peselBirth('00023012345'), null, 'no 30 February');
    assert.equal(m.birthOf('2012-03-04'), '2012-03-04', 'a date is a date of birth');
    assert.equal(m.birthOf('02270803624'), '2002-07-08', 'so is a valid PESEL');
    assert.equal(m.birthOf('2012-02-30'), null);
    assert.equal(m.ageOn('2008-07-10', '2026-07-09'), 17, 'the day before the birthday');
    assert.equal(m.ageOn('2008-07-10', '2026-07-10'), 18, 'on the birthday');
    ok('PESEL: check digit, century in the month, a real date; age in whole years on a given day');

    /* Die Logik: Wiek(Data urodzenia) < 18 → zeige den Elternteil. */
    const design = {
      version: 1,
      layout: [{ type: 'field', id: 'born' }, { type: 'group', id: 'g', kind: 'group', title: 'Rodzic', items: [{ type: 'field', id: 'guardian' }] }],
      nodes: [
        { id: 'a', kind: 'age', x: 0, y: 0, fieldId: 'born', value: '2026-07-10' },
        { id: 'c', kind: 'const', x: 0, y: 0, value: '18' },
        { id: 'lt', kind: 'compare', x: 0, y: 0, op: 'lt' },
        { id: 's', kind: 'show', x: 0, y: 0, target: 'g' }
      ],
      edges: [{ id: 'e1', from: 'a', to: 'lt', port: 'a' }, { id: 'e2', from: 'c', to: 'lt', port: 'b' }, { id: 'e3', from: 'lt', to: 's', port: 'in' }]
    };
    assert.ok(m.evaluate(design, {}).hidden.has('guardian'), 'no date yet: the guardian waits');
    assert.ok(!m.evaluate(design, { born: '2010-01-01' }).hidden.has('guardian'), 'a minor: the guardian is asked');
    assert.ok(m.evaluate(design, { born: '2008-07-10' }).hidden.has('guardian'), 'eighteen on the day: no guardian');
    assert.ok(!m.evaluate(design, { born: '10291412345' }).hidden.has('guardian') === m.peselValid('10291412345'), 'a PESEL counts only when valid');
    assert.equal(m.evaluate(design, { born: '2010-01-01' }).values.get('a'), '16');
    ok('logic: the age node gives whole years from a date or PESEL on the chosen day; empty is never "under 18"');

    const v = m.consentValue('  Wyrażam zgodę.  ');
    assert.equal(v, 'tak: Wyrażam zgodę.', 'a consent keeps its wording');
    assert.ok(m.consentGiven(v) && m.consentGiven('tak') && !m.consentGiven('') && !m.consentGiven('nie'));
    assert.equal(m.consentText(v), 'Wyrażam zgodę.');
    assert.equal(m.shownAnswer('consent', v), 'tak', 'in a table: just "tak"');
    assert.equal(m.shownAnswer('consent', ''), '');
    assert.equal(m.paperNeeded(null, () => v), false, 'no rule — no paper');
    assert.equal(m.paperNeeded({ title: null, text: null, paper: 'always', signer: null }, () => undefined), true);
    assert.equal(m.paperNeeded({ title: null, text: null, paper: 'cp', signer: null }, (id) => (id === 'cp' ? v : undefined)), true, 'the parental consent is ticked');
    assert.equal(m.paperNeeded({ title: null, text: null, paper: 'cp', signer: null }, () => undefined), false, 'an adult never saw it');
    ok('consent: "tak: <wording>", shown as "tak", paper when always or when the chosen consent is given');

    {
      /* „niepełnoletni": aus Geburtsdatum oder PESEL, am Tag des Ausfüllens — ohne eines davon kein Papier. */
      const minor = { title: null, text: null, paper: m.PAPER_MINOR, signer: null };
      const people = [{ fieldId: 'b', kind: 'date', identityRole: 'born' }, { fieldId: 'p', kind: 'pesel', identityRole: null }, { fieldId: 'x', kind: 'line', identityRole: null }];
      const ans = (map) => (id) => map[id];
      assert.equal(m.paperNeeded(minor, ans({ b: '2010-05-01' }), { fields: people, on: '2026-10-07' }), true, 'sixteen: paper');
      assert.equal(m.paperNeeded(minor, ans({ b: '2008-10-07' }), { fields: people, on: '2026-10-07' }), false, 'eighteen today: no paper');
      assert.equal(m.paperNeeded(minor, ans({ b: '2008-10-08' }), { fields: people, on: '2026-10-07' }), true, 'eighteen tomorrow: still paper');
      assert.equal(m.paperNeeded(minor, ans({ p: '10250112347' }), { fields: people, on: '2026-10-07' }), true, 'a PESEL of 1 May 2010: paper');
      assert.equal(m.paperNeeded(minor, ans({}), { fields: people, on: '2026-10-07' }), false, 'no birth date given: it cannot say');
      assert.equal(m.paperNeeded(minor, ans({ b: '2010-05-01' }), {}), false, 'a form that does not ask for the age: no paper');
      assert.deepEqual(m.ageFields(people).map((x) => x.fieldId), ['b', 'p'], 'birth date and PESEL tell the age');
      const ticks = [
        { fieldId: 'safe', kind: 'checkbox', label: 'Zobowiązuję się przestrzegać zasad bezpieczeństwa', help: null },
        { fieldId: 'pc', kind: 'checkbox', label: 'Potwierdzam, że przekażę podpisaną zgodę rodzica / opiekuna na udział w warsztatach.', help: null }
      ];
      assert.equal(m.parentalConsentOf(ticks)?.fieldId, 'pc', 'the parental consent of a form made before 0083 is found for the hint');
      assert.equal(m.parentalConsentOf([ticks[0], { fieldId: 'n', kind: 'line', label: 'Imię rodzica', help: null }]), null, 'a name of a parent is no consent');
      ok('paper for minors: from the birth date or PESEL on the day of filling; a parental consent without paper is found for the hint');
    }

    /* Das Blatt: Reihenfolge des Formulars, nur Sichtbares, Zustimmungen mit IHREM Wortlaut. */
    const field = (fieldId, kind, label, position, extra = {}) => ({
      fieldId, kind, label, position, help: null, options: [], areaId: 'a', epoch: 1, isRequired: false, isHalfWidth: false,
      identityRole: 'none', selfEdit: true, linkCheck: false, labelSealed: '', helpSealed: null, optionsSealed: null, ...extra
    });
    const open = {
      form: { title: 'Zgoda', controller: null, after: null },
      fields: [
        field('given', 'line', 'Imię', 0), field('born', 'date', 'Data urodzenia', 1, { identityRole: 'born' }),
        field('guardian', 'line', 'Rodzic', 2), field('cp', 'consent', 'Zgoda na udział', 3, { help: 'Dzisiejszy tekst.' }),
        field('img', 'consent', 'Wizerunek', 4, { help: 'Zgoda na wizerunek.' })
      ],
      design: { ...design, layout: [{ type: 'field', id: 'given' }, ...design.layout, { type: 'field', id: 'cp' }, { type: 'field', id: 'img' }, { type: 'text', id: 't', text: 'Klauzula.' }] },
      account: null
    };
    const sheet = m.sheetOf(open, new Map([['given', 'Ola'], ['born', '2012-05-01'], ['guardian', 'Anna'], ['cp', 'tak: Tekst z dnia zgody.']]));
    assert.deepEqual(sheet.blocks.flatMap((b) => b.rows.map((r) => `${r.label}=${r.value}`)), ['Imię=Ola', 'Data urodzenia=01.05.2012', 'Rodzic=Anna']);
    assert.deepEqual(sheet.statements.map((st) => [st.label, st.given, st.text]),
      [['Zgoda na udział', true, 'Tekst z dnia zgody.'], ['Wizerunek', false, 'Zgoda na wizerunek.']], 'the wording of the day of consent, not today’s');
    assert.deepEqual(sheet.notes, ['Klauzula.']);
    const adult = m.sheetOf(open, new Map([['given', 'Jan'], ['born', '1990-01-01'], ['guardian', 'x']]));
    assert.ok(!adult.blocks.some((b) => b.rows.some((r) => r.label === 'Rodzic')), 'what the logic hid is not printed');
    ok('sign sheet: the form’s order, visible answers only, dates in Polish, consents with their own wording');

    /* Die Wymagania (0086): jede Kennung im Aufbau und in der Logik zeigt auf etwas, das es gibt. */
    for (const t of m.NEEDS) {
      const ids = new Set(t.questions.map((q) => q.id));
      const walk = (items) => items.flatMap((i) => (i.type === 'group' ? [i.id, ...walk(i.items)] : [i.id]));
      const placed = walk(t.layout);
      for (const q of t.questions) assert.ok(placed.includes(q.id), `${t.id}: ${q.id} is placed`);
      const known = new Set([...ids, ...placed]);
      for (const n of t.nodes) {
        if (n.fieldId !== undefined) assert.ok(ids.has(n.fieldId), `${t.id}: node ${n.id} reads a question`);
        if (n.target !== undefined) assert.ok(known.has(n.target), `${t.id}: node ${n.id} targets something placed`);
      }
      const nodes = new Set(t.nodes.map((n) => n.id));
      for (const e of t.edges) assert.ok(nodes.has(e.from) && nodes.has(e.to), `${t.id}: edge ${e.id}`);
      if (t.paper !== undefined) assert.ok(['always', 'minor'].includes(t.paper) || t.questions.find((q) => q.id === t.paper)?.kind === 'consent', `${t.id}: paper is a rule the sheet knows`);
      for (const q of t.questions.filter((one) => one.kind === 'consent')) assert.ok((q.help ?? '').length > 40, `${t.id}: ${q.id} has its wording`);
      /* Was ein „Pokaż" verbergen kann, darf nicht von sich aus Pflicht sein — der Dienst prüft Pflicht ohne die Logik. */
      const groupOf = (items, inside) => items.flatMap((i) => (i.type === 'group' ? groupOf(i.items, [...inside, i.id]) : [[i.id, inside]]));
      const within = new Map(groupOf(t.layout, []));
      const hideable = new Set(t.nodes.filter((n) => n.kind === 'show').map((n) => n.target));
      for (const q of t.questions) {
        const hidden = hideable.has(q.id) || (within.get(q.id) ?? []).some((g) => hideable.has(g));
        if (hidden) assert.ok(!q.required, `${t.id}: ${q.id} can be hidden — required only through the logic`);
      }
    }
    const parent = m.NEEDS.find((t) => t.id === 'minor');
    const minor = m.evaluate({ version: 1, layout: parent.layout, nodes: parent.nodes, edges: parent.edges }, { born: '2015-01-01' });
    const grown = m.evaluate({ version: 1, layout: parent.layout, nodes: parent.nodes, edges: parent.edges }, { born: '1990-01-01' });
    assert.ok(!minor.hidden.has('gGuardian'), 'a child: guardian and parental consent');
    assert.ok(grown.hidden.has('gGuardian'), 'an adult: neither');
    assert.ok(minor.required.has('guardian') && minor.required.has('consentParticipation') && !grown.required.has('guardian'), 'required for a child only');
    assert.equal(parent.paper, m.PAPER_MINOR, 'minors: the print follows the age, not a tick');
    ok('needs: every placement and every logic reference resolves; the parental part shows for minors only, printed for minors');
  }

  /* -- 15. Slajdy: der Wechsel und die Bühne (0084) ------------------------------------------------ */
  {
    /* Drei Slajdy: 800 hoch (ein Schirm), 1600 (zwei), 800. Schirm 800. */
    const frames = [{ start: 0, height: 800 }, { start: 800, height: 1600 }, { start: 2400, height: 800 }];
    const vh = 800;
    assert.equal(m.entering(frames, 0, 0, vh), 1, 'the first slide is always there');
    assert.equal(m.entering(frames, 1, 0, vh), 0, 'the second starts below the screen');
    assert.equal(m.entering(frames, 1, 400, vh), 0.5, 'half way in');
    assert.equal(m.entering(frames, 1, 800, vh), 1);
    assert.equal(m.entering(frames, 2, 1600, vh), 0, 'while reading the long slide nothing changes');
    assert.equal(m.entering(frames, 2, 2000, vh), 0.5);
    assert.equal(m.deckAt(frames, 0, vh), 0);
    assert.equal(m.deckAt(frames, 400, vh), 0.5);
    assert.equal(m.deckAt(frames, 1200, vh), 1, 'inside the long slide the deck stands on it');
    assert.equal(m.deckAt(frames, 2400, vh), 2);
    assert.equal(m.pinnedPosition(frames[1], 400, vh), 800, 'held at its top while coming in');
    assert.equal(m.pinnedPosition(frames[1], 2000, vh), 1600, 'held at its end while going');
    ok('slides: how far a slide has come in and where the deck stands — from the track, slides of any height');

    const kinds = ['scroll', 'fade', 'reveal'];
    const still = m.motionOf(frames, 1, 1200, vh, kinds);
    assert.deepEqual([still.pin, still.opacity], [false, 1], 'at rest: nothing');
    const fadeIn = m.motionOf(frames, 1, 400, vh, kinds);
    assert.ok(fadeIn.pin && fadeIn.opacity === 0.5, 'fade: the new one stands and shows through');
    const fadeOut = m.motionOf(frames, 0, 400, vh, kinds);
    assert.ok(fadeOut.pin && fadeOut.opacity === 1, 'fade: the old one stands under it');
    const revealOut = m.motionOf(frames, 1, 2000, vh, kinds);
    const revealIn = m.motionOf(frames, 2, 2000, vh, kinds);
    assert.ok(!revealOut.pin && revealOut.above && revealIn.pin, 'reveal: the old one leaves on top, the new one waits beneath');
    assert.equal(m.calmer('zoom', true), 'fade', 'less motion: everything blends');
    assert.equal(m.calmer('scroll', true), 'scroll');
    const zoom = m.motionOf(frames, 1, 400, vh, ['scroll', 'zoom', 'scroll'], true);
    assert.equal(zoom.scale, 1, 'and nothing zooms then');
    const rise = m.enterStyle('rise', 0);
    assert.ok(rise.opacity === 0 && rise.y > 0 && m.enterStyle('rise', 1).y === 0, 'content rises into place');
    assert.deepEqual(m.enterStyle('none', 0.3), { opacity: 1, x: 0, y: 0, scale: 1 });
    ok('slides: each transition holds, blends, covers or reveals at the right edge; content appears with the slide; calmer on request');

    const places = new Map([[0, { x: 80, y: 20, w: 20, scale: 1, rotate: 0, opacity: 1 }], [2, { x: 20, y: 70, w: 40, scale: 2, rotate: 90, opacity: 0.5 }]]);
    assert.deepEqual(m.frameAt(places, 0), places.get(0));
    assert.deepEqual(m.frameAt(places, -1), places.get(0), 'before the first place it stays');
    assert.deepEqual(m.frameAt(places, 5), places.get(2), 'after the last it stays');
    const mid = m.frameAt(places, 1);
    assert.deepEqual([mid.x, mid.y, mid.w, mid.scale, mid.rotate, mid.opacity], [50, 45, 30, 1.5, 45, 0.75], 'half way: half way, across a slide without its own place');
    assert.equal(m.frameAt(new Map(), 1), null);
    ok('stage: a module travels from its place on one slide to the next, glides over slides without a place, stays before and after');

    assert.equal(m.mixColor('#000000', '#ffffff', 0.5), '#808080');
    assert.equal(m.mixColor('red', '#ffffff', 0.4), 'red', 'names switch in the middle');
    const page = { accent: '#000000', ink: '#ffffff', ground: '#101010', muted: '#888888' };
    const each = [m.colorsOf(page, null), m.colorsOf(page, { accent: '#ffffff', ink: null, ground: null, muted: null })];
    assert.equal(m.colorsAt(each, 0.5).accent, '#808080', 'colours travel with the slide');
    assert.equal(m.colorsAt(each, 0.5).ink, '#ffffff', 'what a slide does not set stays the page’s');
    ok('colours: a slide’s own colours blend into the next, the rest stays the page’s');

    const look = m.readSlideValue({ label: ' X ', layers: [], transition: 'cover', enter: 'nonsense', colors: { ink: '#ffffff', accent: '' },
      stage: { frames: { a: { x: 500, w: 1 }, '': { x: 1 } }, bare: 'yes' } });
    assert.equal(look.label, 'X');
    assert.equal(look.transition, 'cover');
    assert.equal(look.enter, 'none', 'an unknown entrance is none');
    assert.deepEqual(look.colors, { accent: null, ink: '#ffffff', ground: null, muted: null });
    assert.deepEqual(Object.keys(look.stage.frames), ['a'], 'a place without a slide falls away');
    assert.equal(look.stage.frames.a.x, 150, 'positions are bounded');
    assert.equal(look.stage.frames.a.w, 4);
    assert.equal(look.stage.bare, false, 'only true is bare');
    assert.deepEqual(m.slideJson(m.readSlideValue({ label: 'Old', layers: [] })), { label: 'Old', layers: [] }, 'an old slide stays exactly as it was');
    assert.deepEqual(Object.keys(m.remapStage(look, new Map([['a', 'z']])).stage.frames), ['z']);
    ok('slide JSON: tolerant reading, bounded places, defaults left out, old slides unchanged, places follow new ids');
  }

  /* -- 16. Wymagania, zdjęte pytania, własny adres (0086) ------------------------------------------ */
  {
    /* Was eingeschaltet ist: duldsam gelesen, gesperrt nach Namen. */
    const on = m.readNeeds(JSON.stringify([
      { id: 'minor', label: 'Niepełnoletni', fields: ['a', 'b'], added: ['b'], items: ['g1'], nodes: ['n1'], edges: ['e1'], paper: true },
      { id: 'health', fields: ['c', 7], added: [], items: [], nodes: [], edges: [] },
      { id: 'minor', fields: ['x'] },
      'nonsense'
    ]));
    assert.deepEqual(on.map((n) => n.id), ['minor', 'health'], 'one row per need, nonsense skipped');
    assert.equal(on[1].label, 'Zdrowie i dieta, pomoc w nagłym wypadku', 'a missing name comes from the need');
    assert.deepEqual(on[1].fields, ['c'], 'only ids');
    assert.equal(on[0].paper, true);
    assert.deepEqual(m.readNeeds('{"minor":{}}'), [], 'not a list: nothing on');
    assert.deepEqual(m.readNeeds('[1'), [], 'unreadable: nothing on');
    assert.equal(m.needsJson([]), '', 'none on: the key goes away');
    assert.deepEqual(m.readNeeds(m.needsJson(on)), on, 'round trip');
    const locks = m.lockedOf(on);
    assert.equal(locks.fields.get('a'), 'Niepełnoletni');
    assert.ok(locks.fields.has('c') && locks.nodes.has('n1') && locks.edges.has('e1') && !locks.fields.has('x'));
    ok('needs: tolerant list in the config, locks by question and logic, round trip');

    /* Ausschalten: die eigenen Gruppen gehen, was jemand hineingeschoben hat, rückt an ihre Stelle. */
    const layout = [
      { type: 'field', id: 'name' },
      { type: 'group', id: 'g1', kind: 'group', title: 'Rodzic', items: [{ type: 'field', id: 'b' }, { type: 'field', id: 'own' }] },
      { type: 'text', id: 't1', text: 'RODO' },
      { type: 'group', id: 'g2', kind: 'page', title: 'Krok', items: [{ type: 'field', id: 'b' }] }
    ];
    assert.deepEqual(m.layoutWithout(layout, new Set(['g1', 't1']), new Set(['b'])), [
      { type: 'field', id: 'name' },
      { type: 'field', id: 'own' },
      { type: 'group', id: 'g2', kind: 'page', title: 'Krok', items: [] }
    ], 'its groups and texts go, its questions go, a question someone moved in stays');
    const logic = m.logicWithout({
      nodes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }],
      edges: [{ id: 'e1', from: 'n1', to: 'n2' }, { id: 'e2', from: 'n2', to: 'n3' }, { id: 'e3', from: 'n3', to: 'n1' }]
    }, new Set(['n1']), new Set(['e1']));
    assert.deepEqual(logic.nodes.map((n) => n.id), ['n2', 'n3']);
    assert.deepEqual(logic.edges.map((e) => e.id), ['e2'], 'its edges and every edge on its nodes go');
    ok('needs off: layout without its groups (own questions kept), logic without its nodes and edges');

    /* Vom Formular genommen. */
    const qs = [{ fieldId: 'a', removedAt: null }, { fieldId: 'b', removedAt: '2026-10-08T10:00:00Z' }, { fieldId: 'c' }];
    assert.deepEqual(m.asked(qs).map((q) => q.fieldId), ['a', 'c']);
    assert.deepEqual(m.takenOff(qs).map((q) => q.fieldId), ['b']);
    ok('removed questions: asked vs taken off');

    /* Der Link mit dem Zusatz der Kanzlei — und wieder heraus. */
    assert.deepEqual(m.splitAt('?s=3&x=1#zapisy'), { params: ['s=3', 'x=1'], anchor: 'zapisy' });
    assert.deepEqual(m.splitAt('?miejsce=a.b&s=2'), { params: ['s=2'], anchor: '' }, 'a seat in the suffix falls away');
    assert.equal(m.pageLink('events/rocket2026', 'TOK', 'KEY'), '#/events/rocket2026?miejsce=TOK.KEY', 'without a suffix: as before');
    assert.equal(m.pageLink('events/rocket2026', 'TOK', 'KEY', '?s=3'), '#/events/rocket2026?s=3&miejsce=TOK.KEY');
    assert.equal(m.pageLink('events/rocket2026', 'TOK', 'KEY', '#twoje-zgloszenie'), '#/events/rocket2026?miejsce=TOK.KEY#twoje-zgloszenie');
    assert.equal(m.pageLink('a/b', 'T', 'K', '?s=2#x'), '#/a/b?s=2&miejsce=T.K#x');
    assert.equal(m.keepFromAddress('#/events/rocket2026?s=3&miejsce=TOK.AAAA#twoje'), '#/events/rocket2026?s=3#twoje', 'the seat leaves, the rest stays');
    assert.equal(m.keepFromAddress('#/events/rocket2026?miejsce=TOK.AAAA#twoje'), '#/events/rocket2026#twoje');
    assert.equal(m.keepFromAddress('#/events/rocket2026#twoje'), null, 'no seat: the address stays as it is');
    assert.equal(m.viewPath !== undefined, true);
    const path = m.parsePath('#/events/rocket2026#twoje');
    assert.equal(JSON.stringify(path).includes('#'), false, 'an anchor is not part of the page');
    assert.deepEqual(m.parsePath('#/events/rocket2026#twoje'), m.parsePath('#/events/rocket2026'));
    assert.deepEqual(m.parsePath('#/events/rocket2026?s=2#twoje'), m.parsePath('#/events/rocket2026'));
    ok('seat link: the office suffix (?s=, #anchor) around the seat; the seat leaves the address, the suffix stays; the path ignores it');

    /* Der Slajd aus dem Anker. */
    const slides = [{ id: 'p1', label: 'Start' }, { id: 'p2', label: 'Zapisy' }, { id: 'p3', label: 'Twoje zgłoszenie' }];
    assert.equal(m.anchorInAddress('#/events/rocket2026?s=2#Twoje-Zgloszenie'), 'twoje-zgloszenie');
    assert.equal(m.anchorInAddress('#/events/rocket2026?s=2'), '');
    assert.equal(m.slideByAnchor(slides, 'twoje-zgloszenie'), 2, 'by the name of the slide');
    assert.equal(m.slideByAnchor(slides, 'p2'), 1, 'by the id of its part');
    assert.equal(m.slideByAnchor(slides, 'nic'), null);
    assert.equal(m.slideInAddress('#/a?s=3#x'), 2, 'a number and an anchor: the number');
    assert.equal(m.addressWithSlide('#/a#twoje', 2), '#/a?s=3', 'the slide replaces the anchor');
    assert.equal(m.addressWithSlide('#/a?s=3#twoje', 0), '#/a');
    ok('slides: a slide by anchor (name or part id), the number wins, the address then follows the slide');

    /* Die eigene Adresse, wie man sie kopiert hat. */
    assert.deepEqual(m.ownAddress('https://recreatio.pl/#/events/rocket2026?s=3'), { under: 'events/rocket2026', at: '?s=3' });
    assert.deepEqual(m.ownAddress('recreatio.pl/events/rocket2026#zapisy'), { under: 'events/rocket2026', at: '#zapisy' });
    assert.deepEqual(m.ownAddress('recreatio.pl/#/Events/Rocket2026/#twoje'), { under: 'events/rocket2026', at: '#twoje' });
    assert.deepEqual(m.ownAddress('http://localhost:5173/#/zz/rakieta?s=2#x'), { under: 'zz/rakieta', at: '?s=2#x' });
    assert.deepEqual(m.ownAddress('events/rocket2026'), { under: 'events/rocket2026', at: '' });
    assert.deepEqual(m.ownAddress('#twoje'), { under: '', at: '#twoje' }, 'only a suffix: the page chosen above');
    assert.deepEqual(m.ownAddress('?s=4'), { under: '', at: '?s=4' });
    assert.equal(m.ownAddress('   '), null);
    assert.equal(m.atProblem('?s=3'), null);
    assert.equal(m.atProblem('#a#b') !== null && m.atProblem('?miejsce=x') !== null && m.atProblem('#a b') !== null && m.atProblem('s=3') !== null, true);
    ok('own address: pasted as from the address bar (with or without host, #/ or not), or only a suffix; the suffix checked like the service');

    /* recreatio.pl selbst: der leere Pfad bekommt eine Adresse im Arbeitsplatz. */
    const known = new Set(['', 'parish', 'parish/zapisy']);
    const id = '01a11cc4-718f-720e-8bef-ff0f7b6d3900';
    assert.deepEqual(m.pageSteps(''), [m.ROOT_STEP]);
    assert.deepEqual(m.pageSteps('parish/zapisy'), ['parish', 'zapisy']);
    assert.equal(m.viewPath('pages', ...m.pageSteps('')), '#/workspace/pages/~', 'the root has an editor address');
    assert.notEqual(m.viewPath('pages', ...m.pageSteps('')), m.viewPath('pages'), 'not the list of pages');
    assert.deepEqual(m.splitTrail([m.ROOT_STEP], known), { path: '', moduleId: null }, 'the root opens its editor');
    assert.deepEqual(m.splitTrail([m.ROOT_STEP, id], known), { path: '', moduleId: id }, 'a module on the root');
    assert.deepEqual(m.splitTrail([], known), { path: null, moduleId: null }, 'no trail: the list');
    assert.deepEqual(m.splitTrail(['parish', 'zapisy'], known), { path: 'parish/zapisy', moduleId: null });
    assert.deepEqual(m.splitTrail(['parish', id], known), { path: 'parish', moduleId: id });
    ok('root page: recreatio.pl itself is edited at #/workspace/pages/~ (and its modules below it)');
  }
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
