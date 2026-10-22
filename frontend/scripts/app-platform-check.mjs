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
 *  18. Przejrzane je Konto (0090) und Zugang über eine Rolle (0091): der Weg von einer Rolle zu ihren Bereichen.
 *  19. Widoki (0094): Mój widok, einer je Bereich, eigene; Wege je Teil; Powiadomienia in eigener Reihenfolge; Szukaj.
 *  20. In einer Rozmowa spricht eine Person (0095): Rolle, dann Person; „Anna Nowak (Rada)"; die Rolle reist in der Hülle mit.
 *  21. Gruppen von Formularen (0096): Ordner, Unterformulare unter dem Hauptformular, was die Karten der Seiten brauchen, die Karte.
 *  22. Namen liegen nie offen (0097): die Etiketten (und dieselben im Kernel), Vor- und Nachname, versiegeln und öffnen —
 *      unter einem Bereich, für die Annahme, für den Gastgeber.
 *  23. Zadania dla osób (0098): welche Tage zählen, die Phasen, erfüllt mit genug Tagen, der Plan in Worten, im Fortschritt.
 *  24. Seite und Formular (0099): am Telefon die Folge, die für das Telefon gelegt wurde; ein Unterformular ohne Fragen
 *      ist kein Schritt.
 *  25. Zaproszenia (0099): eine Aufgabe an Terminen eines Kalenders — die Termine im Zeitraum, der Plan in Worten,
 *      będę / nie wiem / nie będę, Funktionen mit Platz, die Liste danach, wer zu allem abgesagt hat.
 *  26. Seite in Spalten (0101): jede Spalte für sich, am Ende in kürzere Spalten derselben Breite; Schritt „Wybierz termin" (0100).
 *  27. Schritt „Przeczytaj wiadomości" (0102): erledigt, solange in den gewählten Rozmowy (alle, jeden na jeden, Gruppe,
 *      Kanał; an einem Bereich oder an jedem) nichts Ungelesenes liegt — nie überfällig, niemand hakt ab.
 *  28. Die Seite des Kandydaten aus der Liste (0104): die Liste schickt das Formular mit, die Seite wählt dann den Menschen
 *      auch ohne eigenen „Wybór na stronie"; Spalten aus Unterformularen (laufender Zeitraum, sonst der jüngste Eintrag).
 *  29. Das Telefon (Ausgabe „sms"): Nummern in einer Form, die Länge einer SMS, vCard hin und zurück, Kontakte
 *      einlesen ohne Doppelte (und nie zwei Menschen in einen), das Archiv: eine Form je Nachricht, Gespräche;
 *      die eigene Nummer je Nachricht, Antworten aus dem Browser (0116), was unter einem Gespräch stehen bleibt;
 *      Pliki przez link (0117): Kennung und Schlüssel aus dem Geheimnis, die Hülle, Fotos ohne den Ort;
 *      welche Karte ein Gespräch nimmt (gewählt, Gruppe, zuletzt, das Telefon).
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
export * from '${app}registry/postal';
export { planRegistryImport, registryDescription, exportRegistry } from '${app}registry/postalJson';
export { periodStarts, remindersOf, upcomingReminders } from '${app}calendar/tasks';
export { nextDelay, whatRings, toldOf, openChatOf, DEFAULT_SETTINGS } from '${app}notify/notify';
export { viewPath } from '${app}routes';
export { lineText, pickSpeaker, unreadOf, conversationTitle, MAX_LINES } from '${app}notify/notifyRich';
export { roundOf, roundValid, shiftRound, roundLabel, roundShort, roundRange, roundsBetween, roundAhead, repeatOf } from '${app}forms/rounds';
export { quickFields, chipText, isBlank, byPerson, tallyOf, tallyText, addressOrder, cellText, roundsCsv } from '${app}forms/roundSheet';
export { filledNow, stepsFor } from '${app}steps/steps';
export { isYes, YES } from '${app}forms/form';
export { linkSecrets, aimOf } from '${app}links/linkAccess';
export { keepLinkFromAddress, linkHref, freshLink } from '${app}links/linkKeep';
export { safeLink, itemFieldAad, linkWord, putText, emptyTexts } from '${app}calendar/calendar';
export { latexEscape, textToLatex, projectToLatex, missingKeys } from '${app}library/libraryLatex';
export { openProgram, countParts } from '${app}calendar/program';
export { placeDay, treeOrder, taskMarks, marksOn, railDay } from '${app}calendar/calendarModel';
export { titleFrom } from '${app}chat/chatTopics';
export { sha256Bytes, toBase64Url, wrapKey, seal, aad, Field } from '${app}core/crypto';
export { call, carryLinks, LINKS_HEADER } from '${app}core/session';
export { Ring } from '${app}core/keys';
export { areaReader } from '${app}areas/areaRead';
export { isMass, massesOnly, othersOnly, intentionsWord, SERVICE_KINDS } from '${app}masses/mass';
export { isLiturgy, OWN_KINDS, kindWord } from '${app}calendar/agenda';
export { ITEM_KINDS } from '${app}calendar/calendar';
export { intentionsSheetHtml } from '${app}masses/sheet';
export { meetingAreas, othersWrite } from '${app}areas/audience';
export { chatMode, hasSeats, fixedPolicy } from '${app}chat/chat';
export { epochAad } from '${app}areas/area';
export { columnsOf, deskRows, pickRows, neighbours, readEntryQuery, entryQueryString, withEntryQuery, filterWords, stepKindsOf, folded, readSections, PANEL_SECTIONS, NO_FILTER } from '${app}forms/entryDesk';
export { readSubject, writeSubject, subjectKindOf, implicitSubject } from '${app}pages/pageSubject';
export { peselValid, peselBirth, birthOf, ageOn } from '${app}forms/pesel';
export { consentValue, consentGiven, consentText, shownAnswer } from '${app}forms/form';
export { evaluate } from '${app}forms/formDesign';
export { paperNeeded, sheetOf, parentalConsentOf, ageFields, PAPER_MINOR, printedByDefault } from '${app}forms/SignSheet';
export { NEEDS, readNeeds, needsJson, lockedOf, layoutWithout, logicWithout } from '${app}forms/formTemplates';
export { asked, takenOff } from '${app}forms/form';
export { splitAt, pageLink, keepFromAddress } from '${app}seats/seatKeep';
export { parsePath, pageSteps, ROOT_STEP } from '${app}routes';
export { splitTrail } from '${app}workspace/Workspace';
export { slideInAddress, anchorInAddress, slideByAnchor, addressWithSlide } from '${app}pages/slides/slides';
export { ownAddress, atProblem } from '${app}seats/Portal';
export { entering, deckAt, pinnedPosition, motionOf, enterStyle, frameAt, mixColor, colorsAt, colorsOf, calmer } from '${app}pages/slides/slideMotion';
export { readSlideValue, slideJson, remapStage } from '${app}pages/slides/slides';
export { DIGEST_PATH } from '${app}notify/notify';
export { walkBundle, mergeAreaKeys, rememberSeatAreaKeys, seatAreaKey } from '${app}roles/roleBundle';
export { reachWords, draftProblem } from '${app}roles/commonRole';
export { seatRoleAad, openSeatRoles, memberStateOf } from '${app}roles/memberRole';
export { ruleOf, keyHolders, issuerOf, planWork, SUBMITTER_LEVELS, SUBMITTER_WORDS } from '${app}forms/virtualAreas';
export { aadText, open, fromBase64Url } from '${app}core/crypto';
export { scopeOf, withInside, AREA_PARTS, PART_DEFS, partDef } from '${app}workspace/workspaceViews';
export { leadsNoPage } from '${app}workspace/desk';
export { readAlerts, alertsJson, moveAlert, toggleAlert, shownKinds, alertItems, alertCount, ALERT_KINDS } from '${app}workspace/alerts';
export { fold, searchHits } from '${app}shell/search';
export { slugOf } from '${app}workspace/Starters';
export { personsHolding, speakersOf, chooseSpeaker, isMine, messageAuthor, authorText, speakerText, speakerKey, throughRole } from '${app}chat/chatAuthor';
export { sealMessage, openMessage } from '${app}chat/chat';
export { formSections, moveInGroup, logicDependencies, formMapModel, memberRolesOf } from '${app}forms/formGroups';
export {
  moduleNameAad, groupNameAad, seatNameAad, seatOwnNameAad, claimHolderAad, claimAskAad, hostWrapAad,
  personName, nameText, sealName, openWith, sealForIntake, openFromIntake, sealForPublic, openForPrivate
} from '${app}core/names';
export { hostPair, askNameFor, openAskNames } from '${app}core/holderNames';
export { taskDays, taskDay, phaseOf, progressOf as taskProgress, planText, weekdayBit, nextDay, reportsUntil, chipText as taskChip } from '${app}steps/candidateTasks';
export { byReadingOrder } from '${app}pages/layout';
export { respondedTo, doneDays } from '${app}steps/candidateTasks';
export { pack } from '${app}core/masonry';
export { chatMatches, chatTargetText, unreadIn } from '${app}steps/steps';
export { newMessages } from '${app}seats/seatUnread';
export { datesOf, declinedAll, attendanceOn, dutyRoom, termsText } from '${app}steps/candidateTasks';
export { phoneKey, phoneShown, samePhone, smsParts } from '${app}phone/numbers';
export { parseVCards, formatVCards } from '${app}phone/vcard';
export { tidyContact, sameContact, planImport, contactMatches, nameIndex, phoneKeysOf } from '${app}phone/contactStore';
export { canonical, fromNative, archiveThreads, conversationKey, outlineOf, conversationsOf, choiceIncludes, lineFinder } from '${app}phone/smsArchive';
export { readMessage, pendingOf } from '${app}phone/outbox';
export { aheadWhen, localInput } from '${app}phone/smsShared';
export { shareKeys, guidText, shareLink, secretOf, packShare, unpackShare, sealShare, openShare, withoutPlace, shownAs, sizeText, cleanName } from '${app}phone/share';
export { ROUTES } from '${app}routes';
export { chooseLine, ruledNumber, readRules, lineKeyOf, findLine, lineText as simLineText } from '${app}phone/lines';
export { readSettings, settingsText } from '${app}phone/archiveSettings';
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
        field('given', 'line', 'Imię', 0, { identityRole: 'given_name' }), field('born', 'date', 'Data urodzenia', 1, { identityRole: 'born' }),
        field('guardian', 'line', 'Rodzic', 2), field('cp', 'consent', 'Zgoda na udział', 3, { help: 'Dzisiejszy tekst.' }),
        field('img', 'consent', 'Wizerunek', 4, { help: 'Zgoda na wizerunek.' })
      ],
      design: { ...design, layout: [{ type: 'field', id: 'given' }, ...design.layout, { type: 'field', id: 'cp' }, { type: 'field', id: 'img' }, { type: 'text', id: 't', text: 'Klauzula.' }] },
      account: null
    };
    const sheet = m.sheetOf(open, new Map([['given', 'Ola'], ['born', '2012-05-01'], ['guardian', 'Anna'], ['cp', 'tak: Tekst z dnia zgody.']]));
    assert.deepEqual(sheet.blocks.map((b) => [b.title, b.rows.map((r) => `${r.label}=${r.value}`)]),
      [['Uczestnik', ['Imię i nazwisko=Ola']], ['Rodzic / opiekun prawny', ['Rodzic=Anna']]], 'the name and the parent — not the age');
    assert.deepEqual(sheet.statements.map((st) => [st.label, st.given, st.text]),
      [['Zgoda na udział', true, 'Tekst z dnia zgody.'], ['Wizerunek', false, 'Zgoda na wizerunek.']], 'the wording of the day of consent, not today’s');
    assert.deepEqual(sheet.notes, ['Klauzula.']);
    const adult = m.sheetOf(open, new Map([['given', 'Jan'], ['born', '1990-01-01'], ['guardian', 'x']]));
    assert.ok(!adult.blocks.some((b) => b.rows.some((r) => r.label === 'Rodzic')), 'what the logic hid is not printed');
    assert.deepEqual(sheet.signed, [], 'nothing to sign without a statement');
    ok('sign sheet: the form’s order, visible answers only, dates in Polish, consents with their own wording');

    /* 0087 — wie „Zapisy Rocket 2026": aufs Blatt nur der Name, die Eltern, ihre Telefone und das Formale. */
    {
      const rocket = [
        field('g', 'line', 'Imię', 0, { identityRole: 'given_name' }), field('s', 'line', 'Nazwisko', 1, { identityRole: 'surname' }),
        field('ph', 'phone', 'Twój telefon', 2, { identityRole: 'phone' }), field('school', 'line', 'Szkoła i klasa', 3),
        field('why', 'text', 'Co najbardziej interesuje Cię w fizyce lub inżynierii?', 4),
        field('pn', 'line', 'Imię i nazwisko rodzica / opiekuna prawnego', 5), field('pp', 'phone', 'Telefon rodzica / opiekuna', 6),
        field('confirm', 'checkbox', 'Potwierdzam, że przekażę podpisaną zgodę rodzica / opiekuna na udział w warsztatach.', 7),
        field('safe', 'checkbox', 'Zobowiązuję się przestrzegać zasad bezpieczeństwa obowiązujących podczas testów i startów.', 8),
        field('born', 'date', 'Data urodzenia', 9, { identityRole: 'born' }),
        field('cp', 'consent', 'Zgoda rodzica na udział', 10, { help: 'Jako rodzic albo opiekun prawny wyrażam zgodę na udział mojego dziecka.' }),
        field('img', 'consent', 'Wizerunek', 11, { help: 'Zgoda na publikację wizerunku.' })
      ];
      const form = (layout) => ({ form: { title: 'Rocket', controller: null, after: null }, fields: rocket, design: { version: 1, layout, nodes: [], edges: [] }, account: null });
      const plain = rocket.map((q) => ({ type: 'field', id: q.fieldId }));
      const answers = new Map([['g', 'Julian'], ['s', 'Mirek'], ['ph', '+48 790 294 459'], ['school', 'XIII LO 1D'], ['why', 'Piękno świata'],
        ['pn', 'Jarosław Mirek'], ['pp', '+48 668 350 103'], ['confirm', 'tak'], ['safe', 'tak'], ['born', '2011-01-01'], ['img', 'tak: Zgoda na publikację wizerunku.']]);
      const sheet = m.sheetOf(form([...plain, { type: 'text', id: 'rodo', text: 'Dane wykorzystamy do przygotowania zgody.' }]), answers);
      assert.deepEqual(sheet.blocks.map((b) => [b.title, b.rows.map((r) => `${r.label}=${r.value}`)]), [
        ['Uczestnik', ['Imię i nazwisko=Julian Mirek']],
        ['Rodzic / opiekun prawny', ['Imię i nazwisko rodzica / opiekuna prawnego=Jarosław Mirek', 'Telefon rodzica / opiekuna=+48 668 350 103']]
      ], 'name, parent, parent\'s phone — no age, no school, no own phone, no interests');
      assert.deepEqual(sheet.statements.map((st) => [st.given, st.label]), [
        [true, 'Potwierdzam, że przekażę podpisaną zgodę rodzica / opiekuna na udział w warsztatach.'],
        [true, 'Zobowiązuję się przestrzegać zasad bezpieczeństwa obowiązujących podczas testów i startów.'],
        [true, 'Wizerunek']
      ], 'the declarations and consents stay');
      assert.deepEqual(sheet.signed, ['Zgoda rodzica na udział.\nJako rodzic albo opiekun prawny wyrażam zgodę na udział mojego dziecka.'],
        'the parents\' consent is what is signed — not „NIE" because the child ticked nothing');
      assert.deepEqual(sheet.notes, ['Dane wykorzystamy do przygotowania zgody.'], 'the formal notes stay');
      /* Je Frage umstellbar: die Schule dazu, den Namen weg. */
      const tuned = m.sheetOf(form(plain.map((it) => (it.id === 'school' ? { ...it, print: true } : it.id === 's' ? { ...it, print: false } : it))), answers);
      assert.deepEqual(tuned.blocks[0].rows.map((r) => `${r.label}=${r.value}`), ['Imię i nazwisko=Julian', 'Szkoła i klasa=XIII LO 1D'], 'per question: on or off the sheet');
      assert.equal(m.printedByDefault({ kind: 'checkbox', label: 'Jest coś w stanie zdrowia, o czym powinniśmy wiedzieć', identityRole: 'none' }), false, 'a yes/no that is data, not a declaration');
      ok('sign sheet (0087): only the participant\'s name, the parents and their phones, and the formal parts; adjustable per question');
    }

    /* 0087 — die Zustimmung der Eltern als Erklärung zum Unterschreiben: kein Kästchen, auf dem Blatt über der Linie. */
    {
      const need = m.NEEDS.find((t) => t.id === 'minor');
      const qs = need.questions.map((q, i) => field(q.id, q.kind, q.label, i, { identityRole: q.identity ?? 'none' }));
      const form = { form: { title: 'Rakieta', controller: null, after: null }, fields: qs, design: { version: 1, layout: need.layout, nodes: need.nodes, edges: need.edges }, account: null };
      assert.ok(!need.questions.some((q) => q.kind === 'consent' || q.kind === 'checkbox'), 'minors: nothing to tick');
      const child = m.sheetOf(form, new Map([['given', 'Kuba'], ['surname', 'Mały'], ['born', '2012-03-04'], ['guardian', 'Ewa Mała'], ['guardianPhone', '+48 600 700 800']]));
      assert.equal(child.signed.length, 1, 'a child: the approval is on the sheet, to be signed');
      assert.ok(child.signed[0].startsWith('Zgoda rodzica / opiekuna prawnego na udział.') && child.signed[0].includes('wyrażam zgodę'));
      assert.ok(!child.notes.some((n) => n.includes('wyrażam zgodę')), 'not as small print');
      const grown = m.sheetOf(form, new Map([['given', 'Jan'], ['surname', 'Duży'], ['born', '1990-01-01']]));
      assert.deepEqual(grown.signed, [], 'an adult: no parental approval');
      const outcome = m.evaluate({ version: 1, layout: need.layout, nodes: need.nodes, edges: need.edges }, { born: '2012-03-04' });
      assert.ok([...outcome.required].every((id) => id === 'guardian' || id === 'guardianPhone'), 'required for a child: the parent and the phone, no tick');
      ok('minors: the parental approval is read in the form and signed on the printed sheet — no checkbox to force');
    }

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
    assert.ok(minor.required.has('guardian') && minor.required.has('guardianPhone') && !grown.required.has('guardian'), 'required for a child only');
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

    /* 2026-10-16 — ohne Altbestand: jedes Wort, das kein Teil ist, ist eine Seite. */
    assert.equal(m.parsePath('#/cogita').page, 'cogita', 'a root that was never listed is a page');
    assert.equal(m.parsePath('#/cogita/kursy/historia').page, 'cogita/kursy/historia', 'the whole path belongs to the page');
    assert.equal(m.parsePath('#/nowa-strona').page, 'nowa-strona', 'a new root needs no new build');
    assert.equal(m.parsePath('#/workspace/pages').page, null, 'the parts stay parts');
    assert.equal(m.parsePath('#/widget/abc/parish').page, null);
    assert.deepEqual(m.parsePath('#/nowa-strona/portal/TOK/KEY').seat, { token: 'TOK', key: 'KEY' }, 'a seat under any page');
    assert.equal(m.parsePath('#/nowa-strona/portal/TOK/KEY').page, 'nowa-strona');
    assert.equal('stray' in m.parsePath('#/cokolwiek'), false, 'nothing is a stray word any more');
    ok('routing without the legacy switch: every word that is not a part is a page of the register');

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

  /* -- 17. Aufgaben bleiben sichtbar, bis sie erledigt oder ausgelassen sind (0088) ------------------- */
  {
    const now = new Date(2026, 9, 9, 12, 0);
    const day = (d, h = 9) => new Date(2026, 9, d, h, 0);
    const occ = (at, minutes = 30, decided = null) => ({
      at: at.toISOString(), endsAt: new Date(at.getTime() + minutes * 60_000).toISOString(),
      doneAt: decided === 'done' ? at.toISOString() : null, doneBy: null,
      skippedAt: decided === 'skipped' ? at.toISOString() : null, skippedBy: null
    });
    const task = (id, extra) => ({
      taskId: id, areaId: 'a', ownerRoleId: 'r', kind: 'window', timeZone: 'Europe/Warsaw', startsAt: day(1).toISOString(),
      windowMinutes: 30, everyMinutes: null, repeatKind: 'none', repeatEvery: 1, repeatWeekdays: null, repeatUntil: null, repeatCount: null,
      epoch: 1, titleSealed: '', notesSealed: null, createdAt: day(1).toISOString(), occurrences: [], lastDoneAt: null, lastDoneBy: null,
      dueAt: null, skippedAt: null, title: id, notes: null, ...extra
    });
    const week = { from: new Date(2026, 9, 5), to: new Date(2026, 9, 12) };
    const tasks = [
      /* vor zwei Monaten, nie erledigt — kam als „overdue" */
      task('old', { overdue: [occ(new Date(2026, 7, 3, 9, 0))], overdueMore: 4 }),
      /* Montag dieser Woche, liegen geblieben */
      task('monday', { occurrences: [occ(day(5))] }),
      /* Dienstag, erledigt — bleibt an seinem Tag */
      task('tuesday', { occurrences: [occ(day(6), 30, 'done')] }),
      /* Mittwoch, ausgelassen */
      task('wednesday', { occurrences: [occ(day(7), 30, 'skipped')] }),
      /* heute später */
      task('later', { occurrences: [occ(day(9, 18))] }),
      /* „co pewien czas", seit zehn Tagen fällig */
      task('water', { kind: 'after', everyMinutes: 3 * 1440, dueAt: new Date(2026, 8, 29, 9, 0).toISOString() })
    ];
    const marks = m.taskMarks(tasks, now, week);
    const on = (d) => m.marksOn(marks, d).map((x) => x.task.taskId).sort();
    assert.deepEqual(on(new Date(2026, 9, 9)), ['later', 'monday', 'old', 'water'], 'today: what is later today, and everything left open — however old');
    assert.deepEqual(on(new Date(2026, 9, 5)), [], 'Monday no longer holds what moved to today');
    assert.deepEqual(on(new Date(2026, 9, 6)), ['tuesday'], 'done stays on its day');
    assert.deepEqual(on(new Date(2026, 9, 7)), ['wednesday'], 'skipped stays on its day');
    const old = marks.find((x) => x.task.taskId === 'old');
    assert.ok(old.carried && old.state === 'missed', 'carried, still missed');
    assert.ok(!m.railDay(marks, new Date(2026, 9, 9)).some((r) => r.mark.carried), 'what is carried has no hour on today\'s rail');
    assert.ok(!m.railDay(marks, new Date(2026, 9, 5)).some((r) => r.mark.task.taskId === 'monday'), 'nor on its old day');

    /* In eine vergangene Woche geblättert (heute nicht im Bild): dort steht es an seinem Tag. */
    const back = m.taskMarks(tasks, now, { from: new Date(2026, 8, 28), to: new Date(2026, 9, 5) });
    assert.deepEqual(m.marksOn(back, new Date(2026, 8, 28)).map((x) => x.task.taskId), [], 'nothing of those tasks happened that week');
    const lastWeek = m.taskMarks([task('fri', { occurrences: [occ(new Date(2026, 9, 2, 9, 0))] })], now, { from: new Date(2026, 8, 28), to: new Date(2026, 9, 5) });
    assert.deepEqual(m.marksOn(lastWeek, new Date(2026, 9, 2)).map((x) => x.task.taskId), ['fri'], 'browsing back: on its own day');
    ok('tasks (0088): what is neither done nor skipped stays in view on today — however long ago; done and skipped stay on their day');
  }

  /* -- 18. Przejrzane je Konto (0090), Zugang über eine Rolle (0091) ---------------------------------- */
  {
    /* 0090 — der Browser fragt ohne `since`: neu ist, was das KONTO nicht gesehen hat. */
    assert.equal(m.DIGEST_PATH, '/workspace/notifications', 'the account decides what is new');

    /*
     * 0091 — der Weg: Linkrolle L hält Rolle T, T hält U; T hat Rada (Epoche 1, 2), U hat Oaza.
     * Von L aus geht alles auf; von T aus nur T und U; eine kaputte Hülle nimmt den anderen nichts.
     */
    const pairOf = async () => {
      const pair = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
      return { spki: new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)), pkcs8: new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey)) };
    };
    const [L, T, U] = [await pairOf(), await pairOf(), await pairOf()];
    const key = (n) => new Uint8Array(32).fill(n);
    const roleKeys = { L: key(1), T: key(2), U: key(3) };
    const wrapSealed = async (id, pair) => m.toBase64Url(await m.seal(roleKeys[id], m.aad('kernel', 'role', id, m.Field.RoleWrapPrivate, 1), pair.pkcs8));
    const grantFor = async (holder, id) => ({ holderRoleId: holder, roleId: id, sealedBlob: m.toBase64Url(await m.wrapKey({ L, T, U }[holder].spki, m.aad('kernel', 'role_grant', id, m.Field.RoleWrapPrivate, 1), roleKeys[id])) });
    const epochFor = async (holder, areaId, epoch, k) => ({ roleId: holder, areaId, epoch, sealedBlob: m.toBase64Url(await m.wrapKey({ L, T, U }[holder].spki, m.epochAad(areaId, epoch), k)) });
    const bundle = {
      roles: [
        { roleId: 'L', kind: 'role', wrapPrivateSealed: await wrapSealed('L', L), rights: [] },
        { roleId: 'T', kind: 'group', wrapPrivateSealed: await wrapSealed('T', T), rights: [{ areaId: 'rada', capability: 'write' }] },
        { roleId: 'U', kind: 'group', wrapPrivateSealed: await wrapSealed('U', U), rights: [{ areaId: 'oaza', capability: 'read' }] }
      ],
      roleGrants: [await grantFor('L', 'T'), await grantFor('T', 'U'), { holderRoleId: 'L', roleId: 'X', sealedBlob: 'AAAA' }],
      epochGrants: [await epochFor('T', 'rada', 1, key(11)), await epochFor('T', 'rada', 2, key(12)), await epochFor('U', 'oaza', 1, key(21)),
        { roleId: 'T', areaId: 'zle', epoch: 1, sealedBlob: 'AAAA' }],
      areas: [{ areaId: 'rada', name: 'Rada', calendars: [] }, { areaId: 'oaza', name: 'Oaza', calendars: [] }]
    };
    const fromLink = await m.walkBundle(new Map([['L', roleKeys.L]]), bundle);
    assert.deepEqual([...fromLink.roleKeys.keys()].sort(), ['L', 'T', 'U'], 'from the link role: the role it holds, and what that holds');
    assert.deepEqual(fromLink.areaKeys.get('rada')?.get(2), key(12), 'every epoch of the role');
    assert.deepEqual(fromLink.areaKeys.get('oaza')?.get(1), key(21), 'and the areas of the role it holds');
    assert.ok(!fromLink.areaKeys.has('zle'), 'a broken envelope is skipped, the others stay');
    const fromRole = await m.walkBundle(new Map([['T', roleKeys.T]]), bundle);
    assert.ok(!fromRole.roleKeys.has('L') && fromRole.roleKeys.has('U'), 'from a role: only downwards — never up to who holds it');
    assert.equal((await m.walkBundle(new Map([['T', key(99)]]), bundle)).areaKeys.size, 0, 'a wrong start key opens nothing');
    assert.equal((await m.walkBundle(new Map([['T', roleKeys.T]]), null)).areaKeys.size, 0, 'no bundle (an old service): nothing, no error');

    /* Ein Platz (Mensch ohne Konto): der Rollenschlüssel unter seinem Platzschlüssel — je Platz UND Rolle ein Etikett. */
    const seatKey = key(42);
    const sealedForSeat = m.toBase64Url(await m.seal(seatKey, m.seatRoleAad('seat-1', 'T'), roleKeys.T));
    assert.notEqual(m.aadText(m.seatRoleAad('seat-1', 'T')), m.aadText(m.seatRoleAad('seat-2', 'T')), 'another seat, another label');
    await assert.rejects(m.open(seatKey, m.seatRoleAad('seat-2', 'T'), m.fromBase64Url(sealedForSeat)), 'an envelope cannot be moved to another seat');
    const seat = await m.openSeatRoles('seat-1', seatKey, { held: [{ roleId: 'T', keySealed: sealedForSeat }, { roleId: 'W', keySealed: null }], bundle });
    assert.deepEqual(seat.areaKeys.get('rada')?.get(1), key(11), 'the seat reads the role\'s areas');
    assert.deepEqual(seat.areas.map((a) => a.name).sort(), ['Oaza', 'Rada']);
    assert.equal(seat.waiting, 1, 'a role whose key has not come yet is counted, not an error');
    assert.deepEqual(m.seatAreaKey('oaza', 1), key(21), 'and remembered in this tab — a calendar on a page finds them like a link\'s');
    assert.equal((await m.openSeatRoles('seat-9', seatKey, { held: [{ roleId: 'T', keySealed: sealedForSeat }], bundle })).areaKeys.size, 0, 'with the label of another seat: nothing');

    /* Wie eine Rolle sich vorstellt, und was einer neuen fehlt. */
    assert.equal(m.reachWords([{ areaId: 'r', name: 'Rada', capability: 'write' }, { areaId: 'o', name: 'Oaza', capability: 'read' }]), 'Rada — pisze · Oaza — czyta');
    assert.equal(m.reachWords([]), 'jeszcze bez obszarów');
    assert.ok(m.draftProblem({ name: ' ', areas: [{ areaId: 'r', capability: 'read' }] }) !== null, 'a new role needs a name');
    assert.ok(m.draftProblem({ name: 'Rada', areas: [] }) !== null, 'and at least one area');
    assert.equal(m.draftProblem({ name: 'Rada', areas: [{ areaId: 'r', capability: 'read' }] }), null);
    ok('roles (0090/0091): a browser without its own mark lets the account decide; from a link or a seat the way to the role\'s areas opens — only downwards, per seat and role, broken envelopes skipped');
  }

  /* -- 19. Die Teile von Teraz und des Bereichs, Powiadomienia, Szukaj (0094, 2026-10-16) ------------- */
  {
    const areas = [
      { areaId: 'p', name: 'Parafia', parentAreaId: null },
      { areaId: 's', name: 'Schola', parentAreaId: 'p' },
      { areaId: 'm', name: 'Moje', parentAreaId: null, personal: true },
      { areaId: 'x', name: 'Młodsza schola', parentAreaId: 's' }
    ];
    /* Ein Bereich zeigt sich und alles darin — nie den eigenen, privaten mit. */
    assert.deepEqual([...m.withInside(areas, ['p'])].sort(), ['p', 's', 'x'], 'a parish shows its schola and the younger schola');
    assert.deepEqual([...m.withInside(areas, ['s'])].sort(), ['s', 'x']);
    assert.equal(m.scopeOf({ id: 'mine', name: 'Teraz', kind: 'mine', areaIds: [], parts: [] }, areas), null, 'Teraz: every area');
    assert.deepEqual([...m.scopeOf({ id: 'area:s', name: 'Schola', kind: 'area', areaIds: ['s'], parts: m.AREA_PARTS }, areas)].sort(), ['s', 'x']);

    /* Jeder Teil hat einen Namen; der Überblick eines Bereichs nimmt nur bekannte. */
    for (const def of m.PART_DEFS) assert.ok(def.label.trim() !== '' && def.says.trim() !== '', `named: ${def.kind}`);
    for (const part of m.AREA_PARTS) assert.ok(m.partDef(part.kind) !== undefined, `known: ${part.kind}`);
    assert.ok(m.AREA_PARTS.some((one) => one.kind === 'people'), 'the overview of an area shows its people');

    /* Powiadomienia: Reihenfolge, aus, neue Arten an ihrer Stelle. */
    const defaults = m.readAlerts('');
    assert.deepEqual(defaults.order, m.ALERT_KINDS.map((k) => k.kind));
    assert.deepEqual(m.readAlerts(JSON.stringify({ order: ['forms', 'chats', 'tasks', 'today', 'links'] })).order, defaults.order,
      'kinds that came later (bookings, steps) join at their place');
    const mine = m.readAlerts(JSON.stringify({ order: ['links', 'forms', 'chats', 'chats', 'bogus', 'tasks', 'today'], off: ['today', 'bogus'] }));
    assert.deepEqual(mine.order, ['links', 'forms', 'chats', 'bookings', 'steps', 'tasks', 'today', 'learn'], 'own order kept, doubles and unknowns dropped, new kinds behind their neighbour');
    assert.deepEqual(mine.off, ['today']);
    assert.deepEqual(m.readAlerts(m.alertsJson(mine)), mine, 'read back');
    assert.equal(m.moveAlert(defaults, 'forms', -1), defaults, 'at the top it stays');
    assert.deepEqual(m.moveAlert(defaults, 'chats', -1).order.slice(0, 2), ['chats', 'forms']);
    const quiet = m.toggleAlert(m.toggleAlert(defaults, 'chats', false), 'chats', false);
    assert.deepEqual(quiet.off, ['chats'], 'off once');
    assert.deepEqual(m.toggleAlert(quiet, 'chats', true).off, []);
    assert.ok(!m.shownKinds(quiet).includes('chats'));

    const digest = {
      now: '2026-10-10T08:00:00Z', since: '2026-10-09T08:00:00Z', total: 0, nextPollSeconds: 60,
      chats: { unread: 5, loud: 5, list: [
        { chatId: 'c1', areaName: 'Schola', kind: 'area', unread: 3, lastMessageAt: null, seatName: null, quiet: false, areaId: 's' },
        { chatId: 'c2', areaName: 'Parafia', kind: 'area', unread: 0, lastMessageAt: null, seatName: null, quiet: false, areaId: 'p' },
        { chatId: 'c3', areaName: 'Moje', kind: 'self', unread: 2, lastMessageAt: null, seatName: null, quiet: true, areaId: 'm' }
      ] },
      registrations: { count: 4, list: [{ moduleId: 'f1', name: 'Zapisy', count: 4, lastAt: '2026-10-10T07:00:00Z', areaId: 'x' }] },
      links: 2, tasks: 3,
      bookings: { count: 1, list: [{ resourceId: 'r1', name: 'Sala', areaId: 'p', count: 1 }] },
      steps: { count: 2, list: [{ moduleId: 'f1', name: 'Zapisy', areaId: 'x', count: 2 }] }
    };
    const today = [{ key: 't1', title: 'Próba', at: '2026-10-10T16:00:00Z', areaId: 's', href: '#/workspace/calendar' }];
    const all = m.alertItems(digest, today, defaults, null);
    assert.deepEqual([...new Set(all.map((a) => a.kind))], ['forms', 'chats', 'bookings', 'steps', 'tasks', 'today', 'links'], 'in the default order');
    assert.ok(!all.some((a) => a.key === 'cc2'), 'a read chat is not waiting');
    assert.ok(all.find((a) => a.key === 'cc3').label.includes('wyciszona'), 'a muted chat says so');
    assert.deepEqual(all.find((a) => a.kind === 'forms').seen, { form: 'f1' }, 'a form can be ticked as seen');
    const reordered = m.alertItems(digest, today, m.toggleAlert(m.moveAlert(m.moveAlert(defaults, 'chats', -1), 'links', -1), 'today', false), null);
    assert.deepEqual([...new Set(reordered.map((a) => a.kind))], ['chats', 'forms', 'bookings', 'steps', 'tasks', 'links'], 'the own order, without what is off');
    const inSchola = m.alertItems(digest, today, defaults, new Set(['s', 'x']));
    assert.deepEqual(inSchola.map((a) => a.key), ['ff1', 'cc1', 'sf1', 'tt1'], 'in an area view: only its areas, and no account-wide tasks or links');
    assert.equal(m.alertCount(digest, defaults), 5 + 4 + 2 + 1 + 2, 'the bell counts what is new — not tasks or today');
    assert.equal(m.alertCount(digest, m.toggleAlert(defaults, 'chats', false)), 4 + 2 + 1 + 2, 'what is off does not count');
    assert.equal(m.alertCount({ ...digest, bookings: undefined, steps: undefined }, defaults), 11, 'an older service without bookings and steps');

    /* Szukaj: ohne Polnisch tippen; was mit dem Getippten beginnt, zuerst. */
    assert.equal(m.fold('Zgłoszenia KOLĘDA Łódź'), 'zgloszenia koleda lodz');
    const entries = [
      { id: 'a', label: 'Młodsza schola', kind: 'Obszar', href: '#a' },
      { id: 'b', label: 'Schola', kind: 'Obszar', href: '#b' },
      { id: 'c', label: 'Kartoteka i kolęda', kind: 'Część warsztatu', href: '#c' },
      { id: 'd', label: 'Zapisy', kind: 'Formularz', href: '#d', hint: 'Parafia' },
      { id: 'e', label: 'Parafia', kind: 'Obszar', href: '#e' }
    ];
    assert.deepEqual(m.searchHits('sch', entries).map((e) => e.id), ['b', 'a'], 'beginning first');
    assert.deepEqual(m.searchHits('koleda', entries).map((e) => e.id), ['c'], 'without diacritics');
    assert.deepEqual(m.searchHits('mlodsza sch', entries).map((e) => e.id), ['a'], 'every word must be there');
    assert.deepEqual(m.searchHits('parafia', entries).map((e) => e.id), ['e', 'd'], 'the name before the hint');
    assert.deepEqual(m.searchHits('formularz zap', entries).map((e) => e.id), ['d'], 'the kind is searched too');
    assert.deepEqual(m.searchHits('   ', entries), [], 'nothing typed: nothing found');

    assert.equal(m.slugOf('Rekolekcje 2027 — Łódź!'), 'rekolekcje-2027-lodz');
    assert.equal(m.slugOf('!!!'), 'wydarzenie', 'nothing left: a word that works');
    ok('views (0094): my view, one per area and own views — a part\'s way saved in its view, tolerant reading, JSON both ways; every tool simple first; alerts in the own order (new kinds at their place, off not counted, area views only their areas); search without diacritics');
  }

  /* -- 20. In einer Rozmowa spricht eine Person (0095) ------------------------------------------------ */
  {
    /*
     * Das Konto: Anna (Person) und ihr Kind Ola (Person, von Anna gehalten); Anna hält „Rada", Ola hält „Schola",
     * beide halten „Rodzice". Eine abgelaufene Kante zählt nicht.
     */
    const graph = {
      roles: [
        { id: 'anna', kind: 'person' }, { id: 'ola', kind: 'person' },
        { id: 'rada', kind: 'group' }, { id: 'schola', kind: 'group' }, { id: 'rodzice', kind: 'role' }, { id: 'stara', kind: 'role' }
      ],
      edges: [
        { fromRoleId: 'anna', toRoleId: 'ola', edgeKind: 'holds' },
        { fromRoleId: 'anna', toRoleId: 'rada', edgeKind: 'holds' },
        { fromRoleId: 'ola', toRoleId: 'schola', edgeKind: 'holds' },
        { fromRoleId: 'anna', toRoleId: 'rodzice', edgeKind: 'holds' },
        { fromRoleId: 'ola', toRoleId: 'rodzice', edgeKind: 'holds' },
        { fromRoleId: 'anna', toRoleId: 'stara', edgeKind: 'holds', expiresAt: '2020-01-01T00:00:00Z' },
        { fromRoleId: 'rada', toRoleId: 'schola', edgeKind: 'read' }
      ]
    };
    assert.deepEqual(m.personsHolding(graph, 'anna'), ['anna'], 'a person speaks for herself');
    assert.deepEqual(m.personsHolding(graph, 'rada'), ['anna'], 'Rada: the person holding it');
    assert.deepEqual(m.personsHolding(graph, 'schola').sort(), ['anna', 'ola'], 'held through a held person counts (Anna holds Ola, Ola holds Schola) — a read edge does not');
    assert.deepEqual(m.personsHolding(graph, 'rodzice').sort(), ['anna', 'ola']);
    assert.deepEqual(m.personsHolding(graph, 'stara'), [], 'an expired edge holds nothing');

    const all = () => true;
    const list = m.speakersOf(['rada', 'anna', 'rodzice', 'nie-moja'], graph, (id) => id !== 'nie-moja');
    assert.deepEqual(list.map(m.speakerKey), ['anna|anna', 'rada|anna', 'rodzice|anna', 'rodzice|ola'], 'herself first; then role by role, each with its persons; what cannot be signed is left out');
    assert.equal(m.speakersOf(['stara'], graph, all).length, 0, 'a writer role no person holds: nobody can speak — a person is needed');

    assert.equal(m.speakerKey(m.chooseSpeaker(list, 'rodzice|ola')), 'rodzice|ola', 'the remembered choice');
    assert.equal(m.speakerKey(m.chooseSpeaker(list, 'rodzice')), 'rodzice|anna', 'an old choice (role only) takes its first person');
    assert.equal(m.speakerKey(m.chooseSpeaker(list, '', 'ola')), 'rodzice|ola', 'the person chosen on the page');
    assert.equal(m.speakerKey(m.chooseSpeaker(list, 'gone|x')), 'anna|anna', 'otherwise the first — herself');
    assert.equal(m.chooseSpeaker([], 'x'), null);

    const message = (over) => ({ messageId: 'm1', authorRoleId: 'rada', authorSeatId: null, epoch: 1, bodySealed: '', createdAt: '', deletedAt: null, ...over });
    const holds = (id) => ['anna', 'ola', 'rada', 'rodzice'].includes(id);
    assert.ok(m.isMine(message({ authorPersonId: 'anna' }), holds), 'my role, my person: mine');
    assert.ok(!m.isMine(message({ authorPersonId: 'jan' }), holds), 'my role but another person of the group: not mine');
    assert.ok(m.isMine(message({}), holds), 'an older message without person: by the role, as before');

    const names = new Map([['anna', 'Anna Nowak'], ['rada', 'Rada parafialna'], ['jan', 'Jan Kowalski']]);
    const look = { name: (id) => names.get(id), seat: (id) => (id === 's1' ? { name: 'Ewa Lis', via: 'Rodzice' } : undefined) };
    assert.equal(m.authorText(m.messageAuthor(message({ authorPersonId: 'jan' }), { text: '', name: 'J.K.', via: null }, look)), 'Jan Kowalski (Rada parafialna)', 'a person through a role: the person, the role in parentheses');
    assert.equal(m.authorText(m.messageAuthor(message({ authorRoleId: 'anna', authorPersonId: 'anna' }), null, look)), 'Anna Nowak', 'a person as herself: no parentheses');
    assert.equal(m.authorText(m.messageAuthor(message({ authorPersonId: 'x' }), { text: '', name: 'Piotr Zieliński', via: 'Rada' }, { name: () => undefined })),
      'Piotr Zieliński (Rada)', 'without the names of the area (a seat reads): what the message says');
    assert.equal(m.authorText(m.messageAuthor(message({}), null, look)), 'Rada parafialna', 'an older message without person: the role, as before');
    assert.equal(m.authorText(m.messageAuthor(message({ authorRoleId: null, authorSeatId: 's1' }), null, look)), 'Ewa Lis (Rodzice)', 'a person from a link: the link in parentheses');
    assert.equal(m.authorText(m.messageAuthor(message({ authorRoleId: null, authorSeatId: 's2' }), { text: '', name: 'Ola z formularza', via: null }, look)), 'Ola z formularza', 'a person from a form: her name');
    assert.equal(m.speakerText({ roleId: 'rada', personId: 'anna' }, (id) => names.get(id)), 'Anna Nowak (Rada parafialna)');
    assert.equal(m.speakerText({ roleId: 'anna', personId: 'anna' }, (id) => names.get(id)), 'Anna Nowak');

    /* The role travels sealed in the message — read back by whoever holds the chat key. */
    const key = new Uint8Array(32).fill(7);
    const keys = new Map([[1, key]]);
    const sealed = await m.sealMessage(keys, 'rada', 'Dzień dobry', 'Anna Nowak', { via: 'Rada parafialna' });
    const back = await m.openMessage(keys, { messageId: sealed.messageId, authorRoleId: 'rada', authorSeatId: null, epoch: 1,
      bodySealed: m.toBase64Url(sealed.sealedBody), createdAt: '', deletedAt: null });
    assert.equal(back.name, 'Anna Nowak');
    assert.equal(back.via, 'Rada parafialna', 'the role in the sealed body');
    const plain = await m.sealMessage(keys, 'anna', 'Hej', 'Anna Nowak');
    const plainBack = await m.openMessage(keys, { messageId: plain.messageId, authorRoleId: 'anna', authorSeatId: null, epoch: 1,
      bodySealed: m.toBase64Url(plain.sealedBody), createdAt: '', deletedAt: null });
    assert.equal(plainBack.via, null, 'as herself: no role in the body');

    /* Unread: a message of a group-mate through the same role is someone else's. */
    const msgs = [
      { messageId: 'a', authorRoleId: 'rada', authorPersonId: 'jan', authorSeatId: null, epoch: 1, bodySealed: '', createdAt: '2026-10-11T10:00:00Z', deletedAt: null },
      { messageId: 'b', authorRoleId: 'rada', authorPersonId: 'anna', authorSeatId: null, epoch: 1, bodySealed: '', createdAt: '2026-10-11T10:01:00Z', deletedAt: null }
    ];
    assert.deepEqual(m.unreadOf(msgs, null, holds, 2).map((x) => x.messageId), ['a'], 'a group-mate writing through Rada is news for me; my own is not');
    ok('one person speaks (0095): role then person, held through held persons, herself first; „Anna Nowak (Rada)" also without area names; a group-mate is not me; the role travels sealed');
  }

  /* -- 21. Gruppen von Formularen (0096) ---------------------------------------------------------- */
  {
    const group = (groupId, name) => ({ groupId, name, createdAt: '', mine: true, manages: true });
    const form = (moduleId, name, over = {}) => ({
      moduleId, name, kind: 'form', extendsId: null, audience: 'public', repeat: 'once', groupId: null, groupPosition: null,
      pages: [], config: '{}', memberRoleId: null, entries: 0, closed: false, ...over
    });
    const groups = [group('g1', 'Bierzmowanie'), group('g0', 'Archiwum')];
    const modules = [
      form('zap', 'Zapisy do bierzmowania', { groupId: 'g1', groupPosition: 0, pages: ['p/signin'], config: JSON.stringify({ portalUnder: 'p/candidate' }), memberRoleId: 'r1', entries: 84 }),
      form('z1', '1. Zadania', { extendsId: 'zap', audience: 'person', pages: ['p/candidate'] }),
      form('z2', '2. Zadania', { extendsId: 'zap', audience: 'person', groupId: 'g1' }),
      form('z3', '3. Zadania', { extendsId: 'zap', audience: 'person', groupId: 'nieznana' }),
      form('z4', 'Stare zadania', { extendsId: 'zap', audience: 'person', groupId: 'g0' }),
      form('inne', 'Odwiedziny chorych'),
      form('notes', 'Notatki', { extendsId: 'inne', audience: 'office', repeat: 'month' }),
      form('sierota', 'Bez głównego', { extendsId: 'niewidoczny', audience: 'person' }),
      { ...form('txt', 'Tekst powitania'), kind: 'text' }
    ];
    const sections = m.formSections(modules, groups);
    const shape = sections.map((sec) => [sec.group?.groupId ?? null, sec.items.map((i) => [i.form.moduleId, i.subs.map((x) => x.moduleId)])]);
    assert.deepEqual(shape, [
      ['g0', [['z4', []]]],
      ['g1', [['zap', ['z1', 'z2', 'z3']]]],
      [null, [['sierota', []], ['inne', ['notes']]]]
    ], 'groups by name; a sub-form under its main form unless it sits in another group; an unknown group counts as none; one without a visible main form stands alone; only forms');
    assert.deepEqual(m.formSections([], [group('g9', 'Pusta')]).map((sec) => [sec.group?.groupId, sec.items.length]), [['g9', 0]], 'an empty group still shows');
    assert.deepEqual(m.moveInGroup(['a', 'b', 'c'], 'c', -1), ['a', 'c', 'b']);
    assert.deepEqual(m.moveInGroup(['a', 'b', 'c'], 'a', -1), ['a', 'b', 'c'], 'at the edge it stays');

    /* What the maps of the pages need from forms. */
    const node = (id, kind, over = {}) => ({ id, kind, x: 0, y: 0, ...over });
    const needs = m.logicDependencies([{
      path: 'p/candidate',
      parts: [{ id: 'part-z2', moduleId: 'z2', kind: 'form' }, { id: 'part-t', moduleId: 'txt', kind: 'text' }],
      logic: {
        version: 1,
        nodes: [
          node('n1', 'registered', { formId: 'z1' }), node('g', 'and'), node('n0', 'link'),
          node('show-z2', 'part', { partId: 'part-z2' }),
          node('n3', 'answer', { formId: 'zap', fieldId: 'f1', op: 'filled' }), node('show-t', 'part', { partId: 'part-t' }),
          node('s1', 'step', { label: 'Rozmowa z księdzem' })
        ],
        edges: [
          { id: 'e1', from: 'n1', to: 'g', port: 'in' }, { id: 'e2', from: 'n0', to: 'g', port: 'in' }, { id: 'e3', from: 'g', to: 'show-z2', port: 'show' },
          { id: 'e4', from: 'n3', to: 'show-t', port: 'show' }, { id: 'e5', from: 'n1', to: 's1', port: 'done' }
        ]
      }
    }, { path: 'p/bez-mapy', parts: [], logic: null }]);
    const said = needs.map((n) => `${n.from}>${n.moduleId ?? 'step:' + n.step}:${n.condition}`).sort();
    assert.deepEqual(said, ['z1>step:Rozmowa z księdzem:wysłany', 'z1>z2:wysłany', 'zap>txt:odpowiedź'], 'through gates back to the inputs that name a form');

    /* The map. */
    const identity = new Map([['zap', ['given_name', 'surname', 'phone']], ['inne', ['none']]]);
    const map = m.formMapModel({ sections, identity, needs, moduleName: (id) => modules.find((x) => x.moduleId === id)?.name ?? null, roleName: () => 'Kandydaci' });
    const byId = new Map(map.nodes.map((n) => [n.id, n]));
    const has = (from, to, kind, label) => map.edges.some((e) => e.from === from && e.to === to && e.kind === kind && (label === undefined || e.label.includes(label)));
    assert.ok(byId.get('group:g1')?.kind === 'group' && byId.get('form:zap')?.parent === 'group:g1', 'a group is a box; its forms stand inside');
    const zap = byId.get('form:zap');
    assert.ok(zap.lines.includes('po wysłaniu: link osoby') && zap.lines.some((l) => l.includes('Imię, Nazwisko')) && zap.lines.some((l) => l.startsWith('Telefon')), 'where the link starts, and which answers it needs');
    assert.ok(byId.get('form:inne').warnings.some((w) => w.includes('Imię i Nazwisko')), 'a main form without a name: said');
    assert.ok(has('in:p/signin', 'form:zap', 'stands', 'zapisy'), 'the page with the form');
    assert.ok(has('form:zap', 'out:p/candidate', 'link', 'link osoby otwiera'), 'where the link of the person opens');
    assert.ok(has('form:zap', 'form:z1', 'extends', 'uzupełnia przez swój link') && has('form:inne', 'form:notes', 'extends', 'notatki koordynatora'));
    assert.ok(has('form:zap', 'form:z4', 'extends'), 'a sub-form in another group: the edge across the boxes');
    assert.ok(has('form:zap', 'role:r1', 'role') && byId.get('role:r1')?.label === 'Kandydaci');
    assert.ok(has('form:z1', 'out:p/candidate', 'filled', 'wypełniane na'), 'where a sub-form is filled');
    assert.ok(has('form:z1', 'form:z2', 'logic', 'pokazany, gdy wysłany'), 'one form needs another one sent');
    assert.ok(has('form:zap', 'out:p/candidate', 'logic', '„Tekst powitania" widać, gdy odpowiedź'));
    assert.ok(has('form:z1', 'out:p/candidate', 'logic', 'krok „Rozmowa z księdzem"'));
    assert.ok(!map.nodes.some((n) => n.id === 'form:txt'), 'only forms are forms on this map');
    const focus = m.formMapModel({ sections, identity, needs, moduleName: () => null, roleName: () => null, focus: 'z2' });
    const ids = new Set(focus.nodes.map((n) => n.id));
    assert.ok(ids.has('form:zap') && ids.has('form:z1') && ids.has('form:z4') && ids.has('group:g0') && !ids.has('form:inne') && !ids.has('form:notes'),
      'one family: the main form, its sub-forms, and the groups they stand in — nothing else');
    ok('form groups (0096): folders by name with their forms in order, sub-forms under their main form; what page maps need from forms; the map: link, answers, sub-forms, roles, dependencies, one family');
  }

  /* -- 22. Namen liegen nie offen (0097) ---------------------------------------------------------- */
  {
    /* Die Etiketten — und JEDES Etikett des Browsers steht auch im Kernel (Aad.cs): sonst ginge eine Hülle nur auf einer Seite auf. */
    assert.equal(m.aadText(m.moduleNameAad('m1')), 'module:name:m1:module_name:1');
    assert.equal(m.aadText(m.groupNameAad('g1')), 'form_group:name:g1:form_group_name:1');
    assert.equal(m.aadText(m.seatNameAad('s1')), 'seat:name:s1:seat_name:1');
    assert.equal(m.aadText(m.seatOwnNameAad('s1')), 'seat:own_name:s1:seat_own_name:1');
    assert.equal(m.aadText(m.claimHolderAad('c1')), 'claim:holder_name:c1:claim_holder_name:1');
    assert.equal(m.aadText(m.claimAskAad('c1')), 'claim:ask_name:c1:claim_ask_name:1');
    assert.equal(m.aadText(m.hostWrapAad('c1')), 'claim:host_wrap:c1:claim_host_wrap:1');
    const kernel = await readFile(join(process.cwd(), '..', 'backend', 'Kernel', 'Aad.cs'), 'utf8');
    const missing = Object.values(m.Field).filter((label) => !kernel.includes(`=> "${label}"`));
    assert.deepEqual(missing, [], 'every browser label is in the kernel');

    /* Vor- und Nachname — beide, ohne Steuerzeichen und doppelte Leerzeichen (0095 im Dienst, seit 0097 hier). */
    assert.equal(m.personName('  Anna ', ' Nowak-Kowalska '), 'Anna Nowak-Kowalska');
    assert.equal(m.personName('Anna', '  '), null);
    assert.equal(m.personName('', 'Nowak'), null);
    assert.equal(m.personName('Anna\u0000\u0007', 'Maria  Nowak'), 'Anna Maria Nowak');
    assert.equal(m.personName('a'.repeat(81), 'Nowak'), null);
    assert.equal(m.nameText('  Zapisy   do  bierzmowania '), 'Zapisy do bierzmowania');
    assert.equal(m.nameText('x'.repeat(250)).length, 200);

    /* Unter einem Schlüssel: geht auf, mit dem falschen Etikett nicht, und kein Klartext in der Hülle. */
    const key = new Uint8Array(32).map((_, i) => i + 1);
    const sealed = await m.sealName(key, m.moduleNameAad('m1'), ' Zapisy do bierzmowania ');
    assert.equal(await m.openWith(key, m.moduleNameAad('m1'), sealed), 'Zapisy do bierzmowania');
    assert.equal(await m.openWith(key, m.moduleNameAad('m2'), sealed), null, 'bound to its form');
    assert.equal(await m.openWith(key, m.seatNameAad('m1'), sealed), null, 'a form name is not a person name');
    assert.ok(!Buffer.from(m.fromBase64Url(sealed)).toString('utf8').includes('Zapisy'), 'no plaintext in the envelope');

    /* Für die Annahme (RSA): wer ohne Bereichsschlüssel einen Termin nimmt. */
    const rsa = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
    const spki = new Uint8Array(await crypto.subtle.exportKey('spki', rsa.publicKey));
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', rsa.privateKey));
    const forOffice = await m.sealForIntake(spki, m.claimHolderAad('c1'), 'Jan Kowalski');
    assert.equal(await m.openFromIntake(pkcs8, m.claimHolderAad('c1'), forOffice.sealed, forOffice.wrapped), 'Jan Kowalski');
    assert.equal(await m.openFromIntake(pkcs8, m.claimHolderAad('c2'), forOffice.sealed, forOffice.wrapped), null);

    /* Für den Gastgeber (P-256): sein Paar am Anspruch, die Bitte auf seinen Schlüssel — nur er öffnet sie. */
    const holderKey = new Uint8Array(32).map((_, i) => 200 - i);
    const host = await m.hostPair('host1', holderKey);
    const asked = await m.askNameFor('ask1', host.hostWrapPublic, ' Ewa  Lis ');
    const names = await m.openAskNames('host1', host.hostWrapPrivateSealed, holderKey, [
      { claimId: 'ask1', nameSealed: asked.askNameSealed },
      { claimId: 'none', nameSealed: null }
    ]);
    assert.equal(names.get('ask1'), 'Ewa Lis');
    assert.equal(names.has('none'), false, 'without a sealed name: no name');
    const stranger = await m.openAskNames('host1', host.hostWrapPrivateSealed, new Uint8Array(32), [{ claimId: 'ask1', nameSealed: asked.askNameSealed }]);
    assert.equal(stranger.size, 0, 'only the host opens it');
    assert.deepEqual(await m.askNameFor('ask2', null, 'Ewa Lis'), {}, 'no host key: no name for the host');
    ok('names never lie open (0097): labels (and the same in the kernel), name and surname, sealing and opening — under an area, for the intake, for the host');
  }

  /* -- 23. Zadania dla osób (0098) ----------------------------------------------------------------- */
  {
    const plan = (over = {}) => ({
      startsOn: '2026-10-01', endsOn: '2026-10-31', schedule: 'daily', weekdays: null, atMinute: 18 * 60, minutes: 30,
      needed: null, showFrom: null, reportUntil: null, ...over
    });
    const rosary = plan({ needed: 5 });
    const fridays = plan({ schedule: 'weekly', weekdays: 16, atMinute: 19 * 60 + 30, minutes: null });
    const film = plan({ schedule: 'any', atMinute: null, minutes: 120, showFrom: '2026-09-25', reportUntil: '2026-11-15' });

    assert.equal(m.weekdayBit('2026-10-12'), 1, 'Monday');
    assert.equal(m.weekdayBit('2026-10-16'), 16, 'Friday');
    assert.equal(m.taskDays(rosary).length, 31, 'every day of October');
    assert.deepEqual(m.taskDays(fridays), ['2026-10-02', '2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30'], 'the Fridays of October');
    assert.deepEqual(m.taskDays(fridays, '2026-10-12'), ['2026-10-02', '2026-10-09'], 'up to a day');
    assert.equal(m.nextDay(fridays, '2026-10-11'), '2026-10-16', 'the next Friday');
    assert.equal(m.nextDay(fridays, '2026-10-31'), null, 'none left');

    assert.equal(m.phaseOf(film, '2026-09-20'), 'hidden');
    assert.equal(m.phaseOf(film, '2026-09-26'), 'upcoming', 'shown before it starts');
    assert.equal(m.phaseOf(rosary, '2026-09-26'), 'hidden', 'without „widoczne od": from its start');
    assert.equal(m.phaseOf(rosary, '2026-10-15'), 'active');
    assert.equal(m.reportsUntil(rosary), '2026-11-07', 'a week after its end');
    assert.equal(m.phaseOf(rosary, '2026-11-05'), 'reporting');
    assert.equal(m.phaseOf(rosary, '2026-11-08'), 'over');
    assert.equal(m.phaseOf(film, '2026-11-12'), 'reporting', 'until its own „zaznaczać do"');

    const days = (...d) => ({ stepId: 's', answer: 'accepted', days: d });
    assert.deepEqual(m.taskProgress(rosary, days('2026-10-01', '2026-10-02', '2026-10-03')), { answer: 'accepted', done: 3, needed: 5, fulfilled: false });
    assert.equal(m.taskProgress(rosary, days('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05')).fulfilled, true, 'five days: done');
    assert.equal(m.taskProgress(fridays, days('2026-10-03')).done, 0, 'a Saturday does not count for a Friday task');
    assert.equal(m.taskProgress(film, undefined).answer, null);

    assert.equal(m.planText(rosary), '1–31 października · codziennie · 18:00, 30 min');
    assert.equal(m.planText(fridays), '1–31 października · w piątki · 19:30');
    assert.equal(m.planText(film), '1–31 października · w dowolnym dniu · 2 godz.');
    assert.equal(m.taskChip('2026-10-16'), 'pt 16.10');

    /* Im Fortschritt: eine Aufgabe ist ein Schritt; vor „widoczne od" sieht der Mensch sie nicht; nach dem Ende ohne Tage überfällig. */
    const step = (stepId, task) => ({
      stepId, position: 0, areaId: 'a', epoch: 1, labelSealed: '', helpSealed: null, doneBy: 'person', visibleToPerson: true,
      dueAt: null, kind: 'task', task, label: stepId, help: null
    });
    const at = (day) => new Date(day + 'T12:00:00');
    const states = (now, tasks, forPerson = true) => m.stepsFor({
      hasSeat: false, confirmedAt: null, extensions: [], filled: new Map(), marks: [], forPerson, now: at(now),
      steps: [step('rosary', rosary), step('film', plan({ showFrom: '2026-10-10', startsOn: '2026-10-20', schedule: 'any' }))], tasks
    });
    assert.deepEqual(states('2026-10-05', []).map((s) => s.key), ['task:rosary'], 'the film is not shown yet');
    assert.deepEqual(states('2026-10-05', [], false).map((s) => s.key), ['task:rosary', 'task:film'], 'the office sees both');
    const five = [{ stepId: 'rosary', answer: 'accepted', days: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'] }];
    assert.equal(states('2026-10-06', five)[0].status, 'done');
    assert.equal(states('2026-11-02', [])[0].status, 'overdue', 'over, without days');
    assert.equal(states('2026-11-02', [{ stepId: 'rosary', answer: 'refused', days: [] }])[0].status, 'todo', 'refused is a decision, not overdue');
    assert.equal(states('2026-10-12', [])[0].task.phase, 'active');
    ok('tasks for people (0098): which days count, phases from „widoczne od" to „zaznaczać do", done with enough days, the plan in words, in the progress');
  }

  /* -- 24. Seite und Formular (0099) --------------------------------------------------------------- */
  {
    /* Die Seite der Firmung, wie sie liegt: am Schreibtisch zwei Spalten, am Telefon eine eigene Folge. */
    const frame = (row, col, colSpan, rowSpan = 3) => ({ position: { row, col }, size: { colSpan, rowSpan } });
    const part = (id, desktop, mobile) => ({ id, layout: { desktop, ...(mobile === undefined ? {} : { mobile }) } });
    const page = [
      part('ask', frame(4, 1, 3), frame(7, 1, 2, 1)),
      part('slots', frame(4, 4, 3), frame(5, 1, 2, 1)),
      part('text', frame(1, 1, 2), frame(1, 1, 2, 1)),
      part('steps', frame(1, 3, 4), frame(2, 1, 2)),
      part('form', frame(7, 4, 3), frame(6, 1, 2, 1)),
      part('chat', frame(7, 1, 3), frame(8, 1, 2, 1)),
      part('old', frame(10, 1, 6))
    ];
    const ids = (list) => list.map((p) => p.id);
    assert.deepEqual(ids(m.byReadingOrder(page)), ['text', 'steps', 'ask', 'slots', 'chat', 'form', 'old'], 'the desk: row by row');
    assert.deepEqual(ids(m.byReadingOrder(page, 'mobile')), ['text', 'steps', 'slots', 'form', 'ask', 'chat', 'old'],
      'the phone: as laid out for the phone (one without its own phone frame keeps its desk row)');

    const ext = (moduleId, questions) => ({ moduleId, name: moduleId, audience: 'person', questions });
    const keys = m.stepsFor({
      hasSeat: true, confirmedAt: null, filled: new Map(), steps: [], marks: [],
      extensions: [ext('empty', 0), ext('full', 3), ext('old-service', undefined)]
    }).map((s) => s.key);
    assert.deepEqual(keys, ['confirm', 'ext:full', 'ext:old-service'], 'a sub-form without questions is no step');
    ok('page and form (0099): the phone in its own order, a sub-form without questions is no step');
  }

  /* -- 25. Zaproszenia (0099) ---------------------------------------------------------------------- */
  {
    const at = (day, hour) => new Date(`${day}T${hour}:00`).toISOString();
    const date = (day, from = '19:00', to = '20:30') => ({ day, startsAt: at(day, from), endsAt: at(day, to) });
    const series = {
      startsOn: '2026-10-01', endsOn: '2026-12-31', schedule: 'item', weekdays: null, atMinute: null, minutes: null,
      needed: 2, showFrom: null, reportUntil: null, itemId: 'i', presence: true,
      dates: [date('2026-10-04'), date('2026-10-11'), date('2026-10-18'), date('2027-01-03')]
    };
    const feast = { ...series, startsOn: '2026-10-18', endsOn: '2026-10-18', needed: null, dates: [date('2026-10-18', '10:00', '12:00')] };

    assert.deepEqual(m.datesOf(series).map((d) => d.day), ['2026-10-04', '2026-10-11', '2026-10-18'], 'only the dates inside the period');
    assert.deepEqual(m.taskDays(series, '2026-10-12'), ['2026-10-04', '2026-10-11'], 'the dates up to a day');
    assert.equal(m.planText(feast), 'niedziela, 18 października · 10:00–12:00');
    assert.equal(m.phaseOf(feast, '2026-10-02'), 'upcoming', 'an invitation stands there at once — one says before whether one comes');
    assert.equal(m.phaseOf({ ...feast, showFrom: '2026-10-10' }, '2026-10-02'), 'hidden', '… unless „widoczne od" says later');
    assert.equal(m.planText(series), '3 terminy · 4–18 października · 19:00–20:30');
    assert.equal(m.planText({ ...series, dates: [] }), 'brak terminów w tym okresie (termin zmieniony albo usunięty z kalendarza)');
    assert.deepEqual([1, 2, 4, 5, 12, 22, 25].map(m.termsText),
      ['1 termin', '2 terminy', '4 terminy', '5 terminów', '12 terminów', '22 terminy', '25 terminów']);

    /* Nachher: da gewesen (ein Tag), nicht da, entschuldigt — oder nichts. */
    const state = { stepId: 's', answer: null, days: ['2026-10-04'], presence: [
      { day: '2026-10-11', answer: 'no', dutyId: null, absence: 'excused' },
      { day: '2026-10-18', answer: 'yes', dutyId: 'd1', absence: null }
    ] };
    assert.equal(m.attendanceOn(state, '2026-10-04'), 'present');
    assert.equal(m.attendanceOn(state, '2026-10-11'), 'excused');
    assert.equal(m.attendanceOn(state, '2026-10-18'), null);

    /* Zu allem abgesagt (oder entschuldigt): nicht überfällig. Ohne Fragen vorher: nie. */
    const no = (day) => ({ day, answer: 'no', dutyId: null, absence: null });
    assert.equal(m.declinedAll(series, { stepId: 's', answer: null, days: [], presence: ['2026-10-04', '2026-10-11', '2026-10-18'].map(no) }), true);
    assert.equal(m.declinedAll(series, state), false, 'was there once');
    assert.equal(m.declinedAll({ ...series, presence: false }, { stepId: 's', answer: null, days: [], presence: ['2026-10-04'].map(no) }), false);

    /* Eine Funktion mit Platz — und ohne Grenze. */
    assert.deepEqual(m.dutyRoom(2, 1), { free: 1, full: false });
    assert.deepEqual(m.dutyRoom(1, 1), { free: 0, full: true });
    assert.deepEqual(m.dutyRoom(null, 7), { free: null, full: false });

    /* Ohne Zahl zählt die ANTWORT (2026-10-11): sich dazu stellen, nicht wie oft man da war. */
    const stance = { startsOn: '2026-10-01', endsOn: '2026-10-31', schedule: 'any', weekdays: null, atMinute: null, minutes: null,
      needed: null, showFrom: null, reportUntil: null };
    assert.equal(m.taskProgress(stance, undefined).fulfilled, false, 'no answer yet');
    assert.equal(m.respondedTo(stance, { stepId: 's', answer: 'refused', days: [] }, '2026-10-12'), false, '0101: the old decision for the whole no longer counts');
    assert.equal(m.respondedTo(stance, { stepId: 's', answer: null, days: [], presence: [no('2026-10-05')] }, '2026-10-12'), true, 'once, any day: one day said is enough');
    assert.equal(m.taskProgress(stance, { stepId: 's', answer: 'accepted', days: [] }).needed, null);
    const answered = (...said) => ({ stepId: 's', answer: null, days: [], presence: said });
    const yes = (day) => ({ day, answer: 'yes', dutyId: null, absence: null });
    const maybe = (day) => ({ day, answer: 'maybe', dutyId: null, absence: null });
    const ask = { ...series, needed: null };
    assert.equal(m.taskProgress(ask, answered(yes('2026-10-04'), no('2026-10-11'), maybe('2026-10-18'))).fulfilled, false, '„jeszcze nie wiem" is not yet an answer');
    assert.equal(m.taskProgress(ask, answered(yes('2026-10-04'), no('2026-10-11'), yes('2026-10-18'))).fulfilled, true, 'every date answered');

    /* 0100 — der Kalender: je Tag tak / nie / jeszcze nie wiem. Ein „tak" an einem vergangenen Tag ist getan; bei Terminen mit Fragen vorher nicht. */
    const october = { ...stance, schedule: 'daily' };
    const daily = (...said) => ({ stepId: 's', answer: null, days: [], presence: said });
    assert.deepEqual(m.doneDays(october, daily(yes('2026-10-02'), no('2026-10-03'), yes('2026-10-20')), '2026-10-10'), ['2026-10-02'], 'a past „tak" counts, a coming one not yet');
    assert.deepEqual(m.doneDays(ask, answered(yes('2026-10-04')), '2026-10-10'), [], 'with asking before „tak" means „będę", not „byłem"');
    assert.equal(m.respondedTo(october, daily(yes('2026-10-01'), no('2026-10-02'), maybe('2026-10-03')), '2026-10-03'), false, 'every day so far — „nie wiem" is not yet an answer');
    assert.equal(m.respondedTo(october, daily(yes('2026-10-01'), no('2026-10-02'), yes('2026-10-03')), '2026-10-03'), true, 'every day so far answered; the coming ones do not hold it up');
    assert.equal(m.respondedTo(october, daily(), '2026-09-20'), false, 'nothing said yet');
    assert.equal(m.respondedTo(october, daily(yes('2026-10-05')), '2026-09-20'), false, 'before the first day nothing is fulfilled yet');

    /* Im Fortschritt: erfüllt mit genug Anwesenheit; nach dem Ende ohne sie überfällig — ausser abgesagt. */
    const step = { stepId: 's', position: 0, areaId: 'a', epoch: 1, labelSealed: '', helpSealed: null, doneBy: 'office', visibleToPerson: true,
      dueAt: null, kind: 'task', task: series, label: 'Spotkanie', help: null, duties: [{ dutyId: 'd1', label: 'Krzyż', capacity: 1 }] };
    const states = (now, tasks) => m.stepsFor({
      hasSeat: false, confirmedAt: null, extensions: [], filled: new Map(), marks: [], forPerson: true, now: new Date(`${now}T12:00:00`),
      steps: [step], tasks
    });
    const two = { stepId: 's', answer: null, days: ['2026-10-04', '2026-10-11'], presence: [] };
    assert.equal(states('2026-10-12', [two])[0].status, 'done', 'two of two');
    assert.equal(states('2027-01-20', [])[0].status, 'overdue', 'over, never there');
    assert.equal(states('2027-01-20', [{ stepId: 's', answer: null, days: [], presence: ['2026-10-04', '2026-10-11', '2026-10-18'].map(no) }])[0].status, 'todo', 'said no to all');
    assert.equal(states('2026-10-12', [two])[0].task.doneBy, 'office', 'the office keeps the list');
    assert.equal(states('2026-10-12', [two])[0].task.duties[0].label, 'Krzyż');
    ok('invitations (0099): a task on calendar dates — the dates in the period, the plan in words, the list after, functions with room, who said no to all');
  }

  /* -- 26. Seite in Spalten (0101), Schritt „Wybierz termin" (0100) --------------------------------- */
  {
    const at = (r, id) => r.placed.find((p) => p.id === id);
    /* Links lang, rechts zwei kurze: der zweite kurze steht unter dem ersten, nicht unter dem langen. */
    const two = m.pack([
      { id: 'long', col: 1, span: 3, height: 600 },
      { id: 'a', col: 4, span: 3, height: 100 },
      { id: 'b', col: 4, span: 3, height: 100 }
    ], 6, 16);
    assert.equal(at(two, 'b').top, 116, 'each column for itself');
    assert.equal(two.height, 600);

    /* Unter dem langen einer mehr: er wandert rechts hinauf (dieselbe Breite). */
    const tail = m.pack([
      { id: 'long', col: 1, span: 3, height: 600 },
      { id: 'a', col: 4, span: 3, height: 100 },
      { id: 'last', col: 1, span: 3, height: 100 }
    ], 6, 16);
    assert.deepEqual([at(tail, 'last').col, at(tail, 'last').top], [4, 116], 'the last one moves to the column that ended earlier');

    /* Breit passt nicht in schmal: ein Baustein über alle Spalten bleibt, wo er ist. */
    const wide = m.pack([
      { id: 'long', col: 1, span: 3, height: 600 },
      { id: 'a', col: 4, span: 3, height: 100 },
      { id: 'all', col: 1, span: 6, height: 50 }
    ], 6, 16);
    assert.deepEqual([at(wide, 'all').col, at(wide, 'all').top], [1, 616]);

    /* Kein Wechsel für ein paar Pixel. */
    const close = m.pack([
      { id: 'x', col: 1, span: 3, height: 120 },
      { id: 'y', col: 4, span: 3, height: 100 },
      { id: 'z', col: 1, span: 3, height: 100 }
    ], 6, 16);
    assert.equal(at(close, 'z').col, 1, 'twenty pixels are not worth a move');

    /* 0100 — „Wybierz termin": erledigt mit einem Termin des Platzes; niemand hakt ab. */
    const booking = { stepId: 'b', position: 0, areaId: 'a', epoch: 1, labelSealed: '', helpSealed: null, doneBy: 'person', visibleToPerson: true,
      dueAt: null, kind: 'booking', booking: { resourceId: 'r', resourceName: 'Spotkanie' }, label: 'Wybierz termin', help: null };
    const states = (marks) => m.stepsFor({ hasSeat: false, confirmedAt: null, extensions: [], filled: new Map(), steps: [booking], marks });
    assert.equal(states([])[0].status, 'todo');
    assert.equal(states([])[0].source, 'auto', 'nobody ticks it');
    const chosen = { status: 'pending', startsAt: '2026-10-15T08:00:00Z', endsAt: '2026-10-15T09:00:00Z' };
    const done = states([{ stepId: 'b', doneAt: '2026-10-12T10:00:00Z', byPerson: true, booking: chosen }])[0];
    assert.equal(done.status, 'done');
    assert.deepEqual(done.booking, { resourceName: 'Spotkanie', chosen });
    ok('page in columns (0101) and „Wybierz termin" (0100): each column for itself, the tail into shorter columns of the same width, a booking finishes its step');
  }

  /* -- 27. Schritt „Przeczytaj wiadomości" (0102) ------------------------------------------------------ */
  {
    /* Seine Rozmowy, wie `/seat/…/chats` sie meldet: zwei mit den Prowadzący, die Gruppe, ein Kanał. */
    const rows = [
      { chatId: 's1', kind: 'seat', areaId: 'A', unread: 2 },
      { chatId: 's2', kind: 'seat', areaId: 'B', unread: 0 },
      { chatId: 'g', kind: 'area', areaId: 'A', unread: 1 },
      { chatId: 'k', kind: 'channel', areaId: 'K', unread: 4 }
    ];
    assert.equal(m.unreadIn({ kind: 'all', areaId: null }, rows), 7, 'all of them');
    assert.equal(m.unreadIn({ kind: 'seat', areaId: null }, rows), 2, 'one-to-one, at any area');
    assert.equal(m.unreadIn({ kind: 'seat', areaId: 'B' }, rows), 0, 'one-to-one at one area');
    assert.equal(m.unreadIn({ kind: 'area', areaId: 'A' }, rows), 1, 'the group together');
    assert.equal(m.unreadIn({ kind: 'channel', areaId: 'K' }, rows), 4, 'the channel');
    assert.equal(m.unreadIn({ kind: 'all', areaId: 'A' }, rows), 3, 'everything at one area');
    assert.ok(!m.chatMatches({ kind: 'channel', areaId: null }, rows[0]));

    assert.equal(m.chatTargetText({ kind: 'channel', areaId: 'K', areaName: 'Bierzmowanie' }), 'w kanale „Bierzmowanie"');
    assert.equal(m.chatTargetText({ kind: 'seat', areaId: null, areaName: null }), 'w rozmowach z prowadzącymi');
    assert.equal(m.chatTargetText({ kind: 'all', areaId: null, areaName: null }), 'we wszystkich rozmowach');
    assert.deepEqual([1, 2, 5, 12, 22, 25].map(m.newMessages),
      ['1 nowa wiadomość', '2 nowe wiadomości', '5 nowych wiadomości', '12 nowych wiadomości', '22 nowe wiadomości', '25 nowych wiadomości']);

    /* Der Haken des Dienstes: da — erledigt; weg (Neues kam) — offen, aber nie überfällig, auch mit vergangener Frist. */
    const read = { stepId: 'r', position: 0, areaId: 'a', epoch: 1, labelSealed: '', helpSealed: null, doneBy: 'person', visibleToPerson: true,
      dueAt: '2020-01-01T00:00:00Z', kind: 'chat', chat: { kind: 'channel', areaId: 'K', areaName: 'Bierzmowanie' }, label: 'Przeczytaj', help: null };
    const states = (marks) => m.stepsFor({ hasSeat: false, confirmedAt: null, extensions: [], filled: new Map(), steps: [read], marks });
    assert.equal(states([])[0].status, 'todo', 'something unread: open, not overdue');
    assert.equal(states([])[0].source, 'auto', 'nobody ticks it');
    assert.deepEqual(states([])[0].chat, read.chat);
    assert.equal(states([{ stepId: 'r', doneAt: '2026-10-12T10:00:00Z', byPerson: true, chat: { unread: 0 } }])[0].status, 'done');
    ok('„Przeczytaj wiadomości" (0102): done while nothing is unread in the chosen chats — all, one-to-one, together, channel, at one area or any; never overdue');
  }

  /* -- 28. Die Seite des Kandydaten aus der Liste, Spalten aus Unterformularen (0104) ----------------------- */
  {
    const query = { id: 'r1', filter: m.NO_FILTER, from: 'parafia/koordynator', form: 'F' };
    const text = m.entryQueryString(query);
    assert.ok(text.includes('formularz=F'), 'the list sends the form along');
    assert.deepEqual(m.readEntryQuery('#/parafia/kandydat' + text), query);
    assert.deepEqual(m.implicitSubject('#/parafia/kandydat' + text), { kind: 'entry', form: 'F', list: 'parafia/koordynator' },
      'a page without its own choice chooses the person from the address');
    assert.equal(m.implicitSubject('#/parafia/kandydat?miejsce=t.k'), null, 'the candidate with his own link: no choice, nothing changes');
    assert.equal(m.implicitSubject('#/parafia/kandydat?wpis=r1'), null, 'without the form there is no choice');

    const field = (fieldId, label, extra = {}) => ({ fieldId, label, kind: 'line', identityRole: 'none', ...extra });
    const desk = {
      form: { fields: [field('g', 'Imię', { identityRole: 'given_name' }), field('p', 'Parafia'), field('t', 'Telefon', { kind: 'phone' })] },
      info: { extensions: [{ moduleId: 'C', name: 'Cele' }, { moduleId: 'N', name: 'Notatki' }] },
      extData: new Map([
        ['C', { fields: [field('aim', 'Moje cele')], registrations: [
          { registrationId: 'c1', baseId: 'r1', withdrawnAt: null, round: '', submittedAt: '2026-10-01T10:00:00Z' }
        ], opened: new Map([['c1', new Map([['aim', 'Ewangelia']])]]) }],
        ['N', { fields: [field('note', 'Notatka')], registrations: [
          { registrationId: 'n1', baseId: 'r1', withdrawnAt: null, round: '2026-09', submittedAt: '2026-09-02T10:00:00Z' },
          { registrationId: 'n2', baseId: 'r1', withdrawnAt: null, round: '2026-10', submittedAt: '2026-10-02T10:00:00Z' }
        ], opened: new Map([['n1', new Map([['note', 'stara']])], ['n2', new Map([['note', 'nowa']])]]) }]
      ])
    };
    const row = { s: { registrationId: 'r1' }, values: new Map([['g', 'Jan'], ['p', 'św. Jana']]) };
    const all = m.columnsOf(desk, '*');
    assert.deepEqual(all.map((c) => [c.id, c.from]), [['p', null], ['aim', 'Cele'], ['note', 'Notatki']],
      'all: the form\'s answers (without name and phone), then the sub-forms\'');
    assert.deepEqual(all.map((c) => c.value(row)), ['św. Jana', 'Ewangelia', 'nowa'], 'a repeating sub-form: its latest period');
    assert.deepEqual(m.columnsOf(desk, 'note,p').map((c) => c.id), ['note', 'p'], 'chosen ones in their order, sub-form questions too');
    assert.deepEqual(m.columnsOf(desk, ''), []);
    ok('the candidate page from the list (0104): the list sends the form, the page chooses the person; sub-form answers as columns');
  }

  /* -- 29. Das Telefon (Ausgabe „sms", 2026-10-17): Nummern, vCard, Kontakte einlesen, das Archiv ------------- */
  {
    for (const same of ['600 100 200', '+48600100200', '0048 600-100-200', '48600100200']) {
      assert.equal(m.phoneKey(same), '+48600100200', `one number: ${same}`);
    }
    assert.ok(m.samePhone('600100200', '+48 600 100 200'));
    assert.ok(!m.samePhone('', ''), 'nothing is not the same as nothing');
    assert.equal(m.phoneKey('mBank'), 'mbank', 'a sender name stays a name');
    assert.equal(m.phoneKey('8080'), '8080', 'a short code stays a short code');
    assert.equal(m.phoneShown('600100200'), '+48 600 100 200');
    assert.equal(m.phoneShown('+49 151 23456789'), '+49 151 23456789', 'another country: untouched');

    assert.deepEqual(m.smsParts(''), { parts: 0, left: 160, unicode: false });
    assert.deepEqual(m.smsParts('a'.repeat(160)), { parts: 1, left: 0, unicode: false });
    assert.deepEqual(m.smsParts('a'.repeat(161)), { parts: 2, left: 145, unicode: false }, 'split: 153 each');
    assert.deepEqual(m.smsParts('€'.repeat(80)), { parts: 1, left: 0, unicode: false }, '€ takes two places in GSM-7');
    assert.deepEqual(m.smsParts('Zażółć'), { parts: 1, left: 64, unicode: true }, 'a Polish letter: 70 per SMS');
    assert.deepEqual(m.smsParts('ą'.repeat(71)), { parts: 2, left: 63, unicode: true }, 'split: 67 each');
    ok('phone numbers: one form to compare (+48…), sender names and short codes kept; SMS length in GSM-7 and UCS-2');

    const vcf = [
      'BEGIN:VCARD', 'VERSION:2.1',
      'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Nowak;Anna;;;',
      'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Anna Nowak =C5=BC=',
      'ona',
      'TEL;CELL;PREF:600 100 200',
      'TEL;HOME:+48 12 345 67 89',
      'TEL;CELL:600-100-200',
      'END:VCARD',
      'BEGIN:VCARD', 'VERSION:3.0',
      'FN:Jan Kowalski',
      'N:Kowalski;Jan;Maria;;',
      'item1.TEL;type=WORK:+48 500 600 700',
      'EMAIL;TYPE=INTERNET:jan@example.org',
      'ORG:Parafia;Rada',
      'BDAY:--0504',
      'CATEGORIES:Rodzina,myContacts',
      'NOTE:pierwsza\\ndruga linia\\, z przecinkiem',
      'END:VCARD',
      'BEGIN:VCARD', 'VERSION:4.0', 'TEL;VALUE=uri;TYPE=cell:tel:+48700800900', 'END:VCARD'
    ].join('\r\n');
    const cards = m.parseVCards(vcf);
    assert.equal(cards.length, 3, 'a card with only a number is still a card');
    assert.equal(cards[0].name, 'Anna Nowak żona', 'QUOTED-PRINTABLE with a soft line break');
    assert.deepEqual(cards[0].phones, [{ number: '600 100 200', label: 'komórka' }, { number: '+48 12 345 67 89', label: 'dom' }],
      'the same number twice is one number');
    assert.deepEqual([cards[1].given, cards[1].family, cards[1].org, cards[1].birthday, cards[1].groups],
      ['Jan Maria', 'Kowalski', 'Parafia, Rada', '--05-04', ['Rodzina']], 'Google: groups without "My Contacts", a birthday without a year');
    assert.equal(cards[1].note, 'pierwsza\ndruga linia, z przecinkiem');
    assert.deepEqual(cards[1].phones, [{ number: '+48 500 600 700', label: 'praca' }], 'an item group in front of the property');
    assert.deepEqual([cards[2].name, cards[2].phones[0].number], ['+48700800900', '+48700800900'], 'vCard 4: tel: URI');
    const again = m.parseVCards(m.formatVCards(cards));
    assert.deepEqual(again, cards, 'written and read again: the same cards');
    const long = { ...cards[1], note: 'ż'.repeat(120) };
    assert.ok(m.formatVCards([long]).split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75), 'lines folded at 75 bytes');
    assert.equal(m.parseVCards(m.formatVCards([long]))[0].note, long.note, 'folded between characters, not inside one');
    ok('vCard: 2.1 with QUOTED-PRINTABLE, 3.0 from Google, 4.0; written as 3.0 and read back unchanged');

    const contact = (id, data, version = 1) => ({ ...m.tidyContact({ given: null, family: null, org: null, title: null, emails: [], note: null, birthday: null, groups: [], source: null, ...data }), id, version, updatedAt: '2026-10-17T10:00:00Z' });
    const tidy = m.tidyContact({ name: '  ', given: 'Ewa', family: 'Lis', org: '', title: null, phones: [{ number: '600100200', label: '' }, { number: '+48 600 100 200', label: 'dom' }],
      emails: [{ address: 'E@x.pl', label: null }, { address: 'e@X.pl', label: null }], note: ' ', birthday: null, groups: [' A ', 'A', ''], source: null });
    assert.deepEqual([tidy.name, tidy.org, tidy.phones, tidy.emails.length, tidy.note, tidy.groups],
      ['Ewa Lis', null, [{ number: '+48 600 100 200', label: null }], 1, null, ['A']], 'tidied: a name from its parts, one number, one address, no empty group');

    const anna = contact('a', { name: 'Anna Nowak', phones: [{ number: '600100200', label: 'komórka' }], source: { kind: 'phone', key: 'K1' } });
    const jan = contact('j', { name: 'Jan Kowalski', phones: [{ number: '12 345 67 89', label: 'dom' }], source: { kind: 'web', key: null } });
    const fromPhone = (name, numbers, key, extra = {}) => m.tidyContact({ name, given: null, family: null, org: null, title: null, emails: [], note: null, birthday: null, groups: [],
      phones: numbers.map((number) => ({ number, label: null })), source: { kind: 'phone', key }, ...extra });

    let plan = m.planImport([fromPhone('Anna Nowak', ['600100200'], 'K1')], [anna, jan]);
    assert.deepEqual([plan.added, plan.updated, plan.unchanged, plan.work.length], [0, 0, 1, 0], 'read again: nothing to write');
    plan = m.planImport([fromPhone('Anna (chór)', ['600100200', '700800900'], 'K1')], [anna, jan]);
    assert.deepEqual([plan.updated, plan.work[0].id, plan.work[0].data.name, plan.work[0].data.phones.length], [1, 'a', 'Anna Nowak', 2],
      'the same key: completed — the name given here stays');
    plan = m.planImport([fromPhone('Jan Kowalski', ['+48 12 345 67 89'], 'K2')], [anna, jan]);
    assert.deepEqual([plan.updated, plan.work[0].id, plan.work[0].data.source.key], [1, 'j', 'K2'], 'the same name and number: the phone\'s key is taken over');
    plan = m.planImport([fromPhone('Dom Kowalskich', ['12 345 67 89'], 'K3')], [anna, jan]);
    assert.deepEqual([plan.added, plan.updated], [1, 0], 'a shared number alone is not the same person');
    plan = m.planImport([fromPhone('Ewa', ['500600700'], 'K4'), fromPhone('Ewa', ['500 600 700'], 'K5', { emails: [{ address: 'ewa@x.pl', label: null }] })], []);
    assert.deepEqual([plan.added, plan.work.length, plan.work[0].data.emails.length], [1, 1, 1], 'known twice by the phone: made once, completed');
    plan = m.planImport([fromPhone('Anna Nowak', ['600100200'], 'K1', { groups: ['Chór'] }), fromPhone('Anna Nowak', ['600100200'], 'K1', { note: 'alt' })], [anna]);
    assert.deepEqual([plan.updated, plan.work.length, plan.work[0].data.groups, plan.work[0].data.note], [1, 1, ['Chór'], 'alt'], 'two arrivals for one contact: one write with both');

    const ewa = contact('e', { name: 'Ewa Lis', phones: [{ number: '500600700', label: null }], source: { kind: 'phone', key: 'raw:1' } });
    plan = m.planImport([fromPhone('Ewa', ['500600700'], 'raw:1,raw:9')], [ewa]);
    assert.deepEqual([plan.updated, plan.work[0].data.name, plan.work[0].data.source.key], [1, 'Ewa Lis', 'raw:1,raw:9'],
      'the phone joined a raw contact to her: found by one of the keys, both kept — the name here stays');
    plan = m.planImport([fromPhone('Ewa (Signal)', ['500600700'], 'raw:9')], [{ ...ewa, source: { kind: 'phone', key: 'raw:1,raw:9' } }]);
    assert.deepEqual([plan.added, plan.updated, plan.unchanged], [0, 0, 1], 'any one key finds her');
    assert.deepEqual(m.phoneKeysOf([anna, jan, { ...ewa, source: { kind: 'phone', key: 'raw:1,raw:9' } }]), ['K1', 'raw:1', 'raw:9'], 'the keys handed to „Przenieś"');

    assert.ok(m.contactMatches(anna, '600 1') && m.contactMatches(anna, 'nowak') && m.contactMatches(jan, '123456') && !m.contactMatches(jan, 'anna'));
    assert.ok(m.sameContact(anna, { ...anna, source: null }), 'where it came from does not count');
    assert.equal(m.nameIndex([anna, jan]).get('+48123456789')?.id, 'j', 'a number leads to its contact');
    ok('contacts: tidied, read in again without doubles (phone key, else name and number — never a shared number alone), found by name or digits');

    const native = (over) => ({ id: '1', kind: 'sms', threadId: 't', box: 'in', date: 1700000000000, sentAt: null, address: '600100200', peers: ['600100200'],
      body: 'Hej', subject: null, read: true, status: 'none', subId: null, parts: [], pending: false, ...over });
    const inbound = m.fromNative(native({}));
    assert.deepEqual([inbound.box, inbound.from, inbound.peers], ['in', '+48600100200', ['+48600100200']]);
    assert.equal(m.fromNative(native({ box: 'outbox' })).box, 'pending');
    assert.equal(m.fromNative(native({ box: 'out', status: 'failed' })).box, 'failed');
    assert.equal(m.canonical(m.fromNative(native({ box: 'out' }))), m.canonical(m.fromNative(native({ box: 'out', status: 'failed' }))),
      'the print follows the direction, not the state');
    assert.notEqual(m.canonical(inbound), m.canonical(m.fromNative(native({ box: 'out' }))));
    assert.equal(m.canonical(m.fromNative(native({ peers: ['+48 700 800 900', '600100200'] }))), m.canonical(m.fromNative(native({ peers: ['600 100 200', '700800900'] }))),
      'the same people in another order and spelling');
    const threads = m.archiveThreads([
      { ...inbound, key: 'a' }, { ...inbound, at: 1700000000500, key: 'b' },
      { ...m.fromNative(native({ peers: ['700800900'], address: '700800900' })), at: 1700000000100, key: 'c' }
    ]);
    assert.deepEqual(threads.map((t) => [t.key, t.messages.length]), [['+48600100200', 2], ['+48700800900', 1]], 'one thread per circle, the newest first');
    ok('SMS archive: one form per message (direction, time, people, text), threads by the people in them');

    /* 0115: by conversation — the same key on every phone, outlines merged across phones and batches. */
    assert.equal(m.conversationKey(['700800900', '600 100 200', '+48600100200']), '+48600100200,+48700800900', 'one key for the same people, however written');
    assert.equal(m.conversationKey(['mBank']), 'mbank');
    const msg = (at, body, box = 'in', parts = []) => ({ ...inbound, key: String(at), at, body, box, parts });
    const outline = m.outlineOf('+48600100200', [msg(300, 'trzecia', 'out'), msg(100, 'pierwsza'), msg(200, 'druga')]);
    assert.deepEqual([outline.count, outline.first, outline.last, outline.lastBody, outline.lastBox], [3, 100, 300, 'trzecia', 'out'], 'an outline: how many, from when to when, the last');
    const merged = m.conversationsOf([
      { batchId: 'old-phone', outline: { ...outline, first: 10, last: 50, lastBody: 'stara', count: 40 } },
      { batchId: 'new-phone', outline },
      { batchId: 'other', outline: m.outlineOf('+48700800900', [msg(400, 'inna')]) }
    ]);
    assert.deepEqual(merged.map((c) => [c.key, c.batches.join('+'), c.count, c.first, c.last, c.lastBody]), [
      ['+48700800900', 'other', 1, 400, 400, 'inna'],
      ['+48600100200', 'old-phone+new-phone', 43, 10, 300, 'trzecia']
    ], 'two phones, one conversation: from the oldest to the newest, the newest last message; newest conversation first');
    assert.ok(m.choiceIncludes({ mode: 'all', chosen: [] }, 'x') && m.choiceIncludes({ mode: 'chosen', chosen: ['x'] }, 'x')
      && !m.choiceIncludes({ mode: 'chosen', chosen: ['x'] }, 'y'), 'all, or the chosen ones');
    const settings = m.readSettings(m.settingsText({ roleId: 'R', areaId: 'A', areas: { R: 'A' }, mode: 'chosen', chosen: ['k', 'k', 'l'] }));
    assert.deepEqual([settings.roleId, settings.areaId, settings.areas.R, settings.mode, settings.chosen], ['R', 'A', 'A', 'chosen', ['k', 'l']]);
    assert.deepEqual(m.readSettings('not json'), { roleId: null, areaId: null, areas: {}, mode: 'all', chosen: [] }, 'unreadable: everything, the own person');
    ok('SMS archive by conversation (0115): one key on every phone, outlines merged across phones, all or chosen conversations, settings read tolerantly');

    /* 2026-10-18 / 0116: the own number per message, replies written in the browser, sending later. */
    const finder = m.lineFinder([{ subId: 3, number: '600 100 200' }, { subId: 4, number: null }]);
    assert.deepEqual([finder(3), finder(4), finder(null)], ['+48600100200', '+48600100200', '+48600100200'], 'one known number: that one, whatever the card');
    const twoLines = m.lineFinder([{ subId: 3, number: '600100200' }, { subId: 4, number: '700800900' }]);
    assert.deepEqual([twoLines(4), twoLines(9), twoLines(null)], ['+48700800900', null, null], 'two numbers: only the card decides');
    assert.equal(m.fromNative(native({ subId: 3 }), finder).line, '+48600100200');
    assert.equal(m.fromNative(native({})).line, null, 'without the phone\'s numbers: none');
    const lined = m.outlineOf('+48600100200', [{ ...msg(100, 'a'), line: '+48700800900' }, { ...msg(200, 'b'), line: null }]);
    assert.equal(lined.lastLine, '+48700800900', 'the newest message that knows its number');
    const lineMerged = m.conversationsOf([
      { batchId: 'old', outline: { ...lined, last: 100, lastLine: '+48700800900' } },
      { batchId: 'new', outline: { ...lined, last: 500, lastLine: null } },
      { batchId: 'newest', outline: { ...lined, last: 900, lastLine: '+48500400300' } }
    ]);
    assert.equal(lineMerged[0].lastLine, '+48500400300', 'the newest known number wins');
    assert.equal(m.conversationsOf([
      { batchId: 'old', outline: { ...lined, last: 100, lastLine: '+48700800900' } },
      { batchId: 'new', outline: { ...lined, last: 500, lastLine: null } }
    ])[0].lastLine, '+48700800900', 'a newer batch without a number keeps the known one');

    assert.deepEqual(m.readMessage(JSON.stringify({ v: 1, to: ['+48600100200', ''], body: 'Hej', line: '+48700800900', sendAt: 5, conversation: 'k', createdAt: 1 })),
      { to: ['+48600100200'], body: 'Hej', line: '+48700800900', sendAt: 5, conversation: 'k', createdAt: 1 });
    assert.equal(m.readMessage('{"to":[],"body":"x","line":"1"}'), null, 'nobody to send to');
    assert.equal(m.readMessage('{"to":["1"],"body":"  ","line":"1"}'), null, 'nothing to send');
    assert.equal(m.readMessage('{"to":["1"],"body":"x"}'), null, 'no number to send from');
    assert.equal(m.readMessage('not json'), null);
    assert.equal(m.readMessage('{"to":["1"],"body":"x","line":"1","sendAt":"soon"}').sendAt, null, 'an unreadable time: now');

    const entry = (id, state, over = {}, message = {}) => ({
      id, state, device: null, error: null, createdAt: '', takenAt: null, doneAt: null, cancelledAt: null, closedAt: null, ...over,
      message: { to: ['+48600100200'], body: 'Odpowiedź', line: '+48700800900', sendAt: null, conversation: '+48600100200', createdAt: 1000, ...message }
    });
    const outboxed = [
      entry('w', 'waiting'),
      entry('t', 'taken', { takenAt: 'x' }, { body: 'jutro', sendAt: 9e15 }),
      entry('s', 'sent', {}, { body: 'wysłana' }),
      entry('s2', 'sent', {}, { body: 'już w archiwum' }),
      entry('f', 'failed', {}, { body: 'nie poszła' }),
      entry('f2', 'failed', {}, { body: 'ponowiona' }),
      entry('f3', 'waiting', {}, { body: 'ponowiona', createdAt: 2000 }),
      entry('c', 'cancelled', {}, { body: 'odwołana, zanim telefon ją wziął' }),
      entry('c2', 'cancelled', { takenAt: 'x' }, { body: 'odwołana u telefonu' }),
      entry('c3', 'cancelled', { takenAt: 'x', closedAt: 'y' }, { body: 'potwierdzona' }),
      entry('o', 'waiting', {}, { conversation: '+48500400300' }),
      { ...entry('n', 'waiting'), message: null }
    ];
    const archivedHere = [{ box: 'out', body: 'już w archiwum', at: 1500 }, { box: 'in', body: 'wysłana', at: 1500 }];
    assert.deepEqual(m.pendingOf(outboxed, '+48600100200', archivedHere).map((e) => e.id), ['w', 't', 's', 'f', 'f3', 'c2'],
      'waiting, taken, sent until archived (not an incoming one with the same text), failed until sent again, cancelled until the phone confirms');

    const nowDay = new Date();
    assert.equal(m.aheadWhen(new Date(nowDay.getFullYear(), nowDay.getMonth(), nowDay.getDate(), 12, 0).getTime()), 'dziś 12:00');
    assert.equal(m.aheadWhen(new Date(nowDay.getFullYear(), nowDay.getMonth(), nowDay.getDate() + 1, 7, 30).getTime()), 'jutro 07:30');
    assert.equal(m.localInput(new Date(2026, 9, 18, 18, 5).getTime()), '2026-10-18T18:05', 'a datetime-local value in local time');
    ok('SMS outbox (0116): the own number per message and conversation, a reply read tolerantly, what stays under a conversation, when it goes');

    /* 0117 — Pliki przez link. */
    const { hkdfSync } = await import('node:crypto');
    const secret = Uint8Array.from({ length: 16 }, (_, i) => i * 7 + 3);
    const keys = await m.shareKeys(secret);
    const hkdf = (info, n) => new Uint8Array(hkdfSync('sha256', secret, new Uint8Array(32), info, n));
    assert.equal(keys.id, m.guidText(hkdf('recreatio share id v1', 16)), 'the id is plain HKDF-SHA-256 of the secret');
    assert.deepEqual([...keys.key], [...hkdf('recreatio share key v1', 32)], 'the key too — under another label');
    assert.match(keys.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, 'the id in the form the service reads');
    assert.notEqual(keys.id.replace(/-/g, ''), Buffer.from(keys.key.slice(0, 16)).toString('hex'), 'the id does not give the key away');
    const link = m.shareLink(secret);
    assert.match(link, /^https:\/\/recreatio\.pl\/#\/plik\/[A-Za-z0-9_-]{22}$/);
    assert.ok(link.length <= 50, `a short link (${link.length} characters) — it goes into an SMS`);
    assert.deepEqual([...m.secretOf(link.slice(link.lastIndexOf('/') + 1))], [...secret], 'the secret back from the address');
    assert.ok(m.secretOf('short') === null && m.secretOf('x'.repeat(23)) === null && m.secretOf('a+b/'.repeat(5) + 'xy') === null, 'only 22 base64url characters');

    assert.equal(m.cleanName('C:\\fotki/../zdjęcie\u0007 z wakacji.jpg'), 'zdjęcie z wakacji.jpg', 'no path, no control characters');
    const head = { name: 'Łódź – zdjęcie.jpg', type: 'image/jpeg', size: 5 };
    const packed = m.packShare(head, new Uint8Array([1, 2, 3, 4, 5]));
    const unpacked = m.unpackShare(packed);
    assert.deepEqual([unpacked.head, [...unpacked.bytes]], [head, [1, 2, 3, 4, 5]], 'head and file in one, unicode name kept');
    const sealedShare = await m.sealShare(secret, head, new Uint8Array([9, 8, 7]));
    assert.equal(sealedShare.id, keys.id);
    const opened = await m.openShare(secret, sealedShare.sealed);
    assert.deepEqual([opened.head.name, [...opened.bytes]], [head.name, [9, 8, 7]], 'sealed and opened with the link alone');
    const other = Uint8Array.from(secret, (b, i) => (i === 0 ? b ^ 1 : b));
    await assert.rejects(m.openShare(other, sealedShare.sealed), 'another secret does not open it');

    /* A photo without its place: EXIF (with GPS), XMP and IPTC go, the turn stays, the picture data is untouched. */
    const seg = (marker, body) => [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];
    const ascii = (text) => [...text].map((c) => c.charCodeAt(0));
    const exif = seg(0xe1, [...ascii('Exif\0\0'),
      0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,                       // TIFF little-endian, IFD0 at 8
      0x02, 0x00,                                                           // two entries
      0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, // Orientation = 6
      0x25, 0x88, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x26, 0x00, 0x00, 0x00, // GPSInfo pointer
      0x00, 0x00, 0x00, 0x00, ...ascii('GPS 52.2297N 21.0122E')]);
    const app0 = seg(0xe0, [...ascii('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    const xmp = seg(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/\0'), ...ascii('<gps>here</gps>')]);
    const iptc = seg(0xed, ascii('Photoshop 3.0\0city'));
    const dqt = seg(0xdb, [0, ...Array.from({ length: 64 }, (_, i) => i + 1)]);
    const scan = [0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd9];
    const photo = new Uint8Array([0xff, 0xd8, ...app0, ...exif, ...xmp, ...iptc, ...dqt, ...scan]);
    const bare = m.withoutPlace(photo);
    const text = Buffer.from(bare).toString('latin1');
    assert.ok(!text.includes('GPS') && !text.includes('<gps>') && !text.includes('city'), 'no place left in the file');
    assert.deepEqual([...bare.slice(0, 2 + app0.length)], [0xff, 0xd8, ...app0], 'SOI and JFIF first');
    const turn = bare.slice(2 + app0.length, 2 + app0.length + 36);
    assert.deepEqual([turn[0], turn[1], ...turn.slice(4, 10)], [0xff, 0xe1, ...ascii('Exif\0\0')], 'a new EXIF block…');
    assert.equal(turn[29], 6, '…that says only how it is turned');
    assert.deepEqual([...bare.slice(bare.length - dqt.length - scan.length)], [...dqt, ...scan], 'tables and picture data byte for byte');
    const plain = new Uint8Array([0xff, 0xd8, ...app0, ...dqt, ...scan]);
    assert.equal(m.withoutPlace(plain), plain, 'a JPEG without such blocks stays as it is');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    assert.equal(m.withoutPlace(png), png, 'not a JPEG: untouched');
    const broken = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x40, 0x00]);
    assert.equal(m.withoutPlace(broken), broken, 'a block longer than the file: left as it is, no error');

    assert.deepEqual(['image/jpeg', 'video/mp4', 'audio/mpeg', 'application/pdf', 'image/svg+xml', 'text/html', 'application/zip'].map(m.shownAs),
      ['image', 'video', 'audio', 'pdf', null, null, null], 'shown in the browser only what cannot run as a page (no SVG, no HTML)');
    assert.deepEqual([m.sizeText(300 * 1024), m.sizeText(3.25 * 1024 * 1024)], ['300 KB', '3,3 MB']);

    /* The route words are the reserved slugs (a page called "plik" would never be seen). */
    const claim = await readFile(join(process.cwd(), '../backend/Api/Pages/Slug.Claim.cs'), 'utf8');
    const parts = /Parts = new\(StringComparer\.Ordinal\) \{([^}]*)\}/.exec(claim)?.[1].split(',').map((p) => p.trim().replace(/"/g, '')).filter(Boolean).sort();
    assert.deepEqual(parts, Object.keys(m.ROUTES).sort(), 'Slug.IsReserved knows every route word of the browser');
    ok('Pliki przez link (0117): id and key from the link secret (HKDF), sealed and opened with the link alone, photos without their place, only safe types shown, route word reserved');

    /* 2026-10-19 — two SIMs: one number for everyone, the other for a group. */
    const orange = { subId: 1, slot: 0, name: 'Orange', number: null, known: false };
    const alt = { subId: 2, slot: 1, name: 'Alternatywa', number: '+48 505 548 677', known: false };
    const sims = [orange, alt];
    assert.deepEqual([m.lineKeyOf(orange), m.lineKeyOf(alt)], ['sim:0', '+48505548677'], 'a card by its number — or by its slot, when nobody knows the number');
    assert.equal(m.findLine(sims, '+48505548677'), alt);
    assert.equal(m.simLineText(orange), 'Orange · numer nieznany');
    assert.deepEqual(m.readRules('{"Praca":"+48505548677","zle":5,"":"x"}'), { Praca: '+48505548677' }, 'rules read tolerantly');
    assert.deepEqual(m.readRules('nonsense'), {});
    const index = new Map([['+48600100200', { groups: ['Praca'] }], ['+48700800900', { groups: ['Rodzina'] }]]);
    const pick = (peers, more = {}) => m.chooseLine({ peers, lines: sims, contacts: index, groupRules: { Praca: '+48505548677' }, threadRules: {}, defaultSub: 1, ...more });
    const byGroup = pick(['600 100 200']);
    assert.deepEqual([byGroup.line?.subId, byGroup.why, byGroup.group], [2, 'group', 'Praca'], 'a member of the group: the group\'s number');
    assert.deepEqual([pick(['700800900']).line?.subId, pick(['700800900']).why], [1, 'default'], 'anyone else: the phone\'s SMS card');
    assert.deepEqual([pick(['700800900'], { lastSub: 2 }).line?.subId, pick(['700800900'], { lastSub: 2 }).why], [2, 'last'], 'no rule: where the last message came in');
    const chosen = pick(['600100200'], { threadRules: { '+48600100200': 'sim:0' }, lastSub: 2 });
    assert.deepEqual([chosen.line?.subId, chosen.why], [1, 'thread'], 'the choice in the conversation\'s head wins over the group');
    assert.equal(pick(['600100200'], { groupRules: { Praca: '+48111222333' } }).why, 'default', 'a rule for a number this phone does not have: ignored');
    /* The browser has no cards: the same rules, as numbers — the reply goes to the phone with that number. */
    const web = (peers, more = {}) => m.ruledNumber({ peers, contacts: index, groupRules: { Praca: '+48505548677' }, threadRules: {}, ...more });
    assert.deepEqual(web(['600100200']), { number: '+48505548677', why: 'group', group: 'Praca' }, 'the browser: a member of the group gets the group\'s number');
    assert.equal(web(['700800900']), null, 'the browser: no rule — the conversation\'s last number stays');
    assert.deepEqual(web(['600100200'], { threadRules: { '+48600100200': '+48501502503' } }), { number: '+48501502503', why: 'thread', group: null }, 'the browser: the conversation\'s choice first');
    assert.deepEqual(web(['600100200'], { threadRules: { '+48600100200': 'sim:0' } }), { number: '+48505548677', why: 'group', group: 'Praca' }, 'the browser: a card without a number is the phone\'s business');
    ok('two SIMs: the conversation\'s choice, then a group\'s own number, then where the last message came in, then the phone\'s card; the browser follows the same rules by number');
  }

  /* -- 0120: several roles per form, virtual areas ------------------------------------------ */
  {
    /* A service from before 0120 answers with one role in flat fields — the client reads it as a list of one. */
    const old = m.memberStateOf({ moduleId: 'f', seats: 4, roleId: 'r1', holdsRole: true, areas: [], members: 3, sealed: 2, waiting: [] });
    assert.deepEqual(old.roles.map((r) => [r.roleId, r.holdsRole, r.members, r.sealed]), [['r1', true, 3, 2]], 'old answer: one role');
    assert.deepEqual(m.memberStateOf({ moduleId: 'f', seats: 0, roleId: null }).roles, [], 'old answer without a role: none');
    const both = m.memberStateOf({ moduleId: 'f', seats: 4, roles: [{ roleId: 'r1', holdsRole: true, areas: [], members: 4, sealed: 4, waiting: [] }, { roleId: 'r2', holdsRole: false, areas: [], members: 1, sealed: 0, waiting: [] }], roleId: 'r1' });
    assert.deepEqual(both.roles.map((r) => r.roleId), ['r1', 'r2'], 'new answer: the list wins over the flat fields');

    assert.deepEqual(m.memberRolesOf({ memberRoleId: 'r1' }), ['r1'], 'no list: the single role of 0091');
    assert.deepEqual(m.memberRolesOf({ memberRoleId: 'r1', memberRoleIds: ['r1', 'r2'] }), ['r1', 'r2'], 'the list wins');
    assert.deepEqual(m.memberRolesOf({ memberRoleId: null, memberRoleIds: [] }), [], 'an empty list is no role');

    const form = (moduleId, more = {}) => ({ moduleId, name: moduleId, kind: 'form', extendsId: null, audience: 'public', pages: [], config: null, memberRoleId: null, entries: 0, closed: false, ...more });
    const map = m.formMapModel({ sections: [{ group: null, items: [{ form: form('zap', { memberRoleId: 'r1', memberRoleIds: ['r1', 'r2'] }), subs: [] }] }], identity: new Map(), needs: [], roleName: (id) => `rola ${id}`, moduleName: () => null });
    assert.deepEqual(map.edges.filter((e) => e.kind === 'role').map((e) => e.to).sort(), ['role:r1', 'role:r2'], 'the map: one edge per role');

    /* The rule of a virtual area: one certificate per role and level; keys only for roles that look in. */
    const members = [
      { roleId: 'lead', kind: 'person', wrapPublicKey: 'k1', capabilities: ['admin', 'certify'] },
      { roleId: 'kat', kind: 'role', wrapPublicKey: 'k2', capabilities: ['write'] },
      { roleId: 'gate', kind: 'role', wrapPublicKey: 'k3', capabilities: ['certify'] }
    ];
    assert.deepEqual(m.ruleOf(members), [
      { roleId: 'lead', capability: 'admin' }, { roleId: 'lead', capability: 'certify' },
      { roleId: 'kat', capability: 'write' }, { roleId: 'gate', capability: 'certify' }
    ], 'every certificate of the virtual area is one the mini area carries');
    assert.deepEqual(m.keyHolders(members).map((r) => r.roleId), ['lead', 'kat'], 'certify alone gets no key: it lets in, it does not look in');
    assert.equal(m.issuerOf({ issuers: ['gate', 'lead'] }, { maySign: (id) => id === 'lead' }), 'lead', 'the issuer: one that may issue AND whose sign key this ring holds');
    assert.equal(m.issuerOf({ issuers: ['gate'] }, { maySign: () => false }), null, 'nobody here can sign: no issuer');
    assert.deepEqual(m.planWork({ missing: [{}, {}], behind: [{}] }), { create: 2, mirror: 1 });
    assert.deepEqual(m.SUBMITTER_LEVELS, ['write', 'read', 'none'], 'the person: writes first (the usual case), sees nothing last');
    assert.ok(m.SUBMITTER_LEVELS.every((l) => typeof m.SUBMITTER_WORDS[l] === 'string'), 'every level has words');
    ok('0120: several roles per form (old answers read as one), one map edge per role; the rule of a virtual area as certificates, keys and an issuer');
  }
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
