/**
 * 0129–0131 — PFLICHTEN, nachgemessen, ohne Browser und ohne Dienst.
 *
 *   1. Die Zusage (controller-attachment) und der Schritt des Betreibers (takedown):
 *      dieselben kanonischen Bytes wie der Kernel (Vektoren aus Kernel.Tests).
 *   2. Unterschreiben und nachprüfen; die Kette: Hash, Verbindung, Unterschrift — und
 *      dass ein geänderter Schritt auffällt.
 *   3. Eine Meldung versiegelt für den Betreiber: sie geht nur mit seinem Schlüssel und
 *      nur unter ihrer eigenen Kennung auf; der Widerspruch hat eigene Etiketten.
 *   4. Was ein Fall zulässt (dieselben Regeln wie der Dienst).
 *   5. Die Klausel in Worten — mit Administrator, ohne, unter einer Seite.
 *   6. Sprawy in der Glocke.
 *   7. Der Haupttermin eines neuen Wydarzenie.
 *   8. 0133 — das Dokument eines Bereichs („recreatio/area"): lesen, Adressen, Schlüssel,
 *      Verweise hin und zurück, feste Stellen über zwei Importe, „nur für Osoby obszaru",
 *      der Plan (Veröffentlichen, fremde Seiten, ein zweiter Import), die Beschreibung,
 *      der Auftrag für die KI.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-duty-'));
const entry = join(workspace, 'entry.ts');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export { attachmentCanon, takedownCanon, takedownHash, GENESIS_HASH } from '${app}core/dutyRecords';
export { serialize } from '${app}core/canonical';
export { signCanonical, toBase64Url, fromBase64Url, newWrapPair } from '${app}core/crypto';
export { sealForOperator, openForOperator, actionsFor, checkLedger } from '${app}reports/reports';
export { clauseLines, clauseText } from '${app}areas/clause';
export { OPERATOR } from '${app}operator';
export { alertItems, alertCount, readAlerts } from '${app}workspace/alerts';
export { reportPath, isReportKind, REPORT_KINDS } from '${app}reports/reportPath';
export { TERMS_VERSION } from '${app}areas/controllers';
export { mainTermOf, leadOf } from '${app}events/mainTerm';
export * from '${app}areas/areaJson';
export { AREA_JSON, areaExample, groupExample, areaPrompt, areaDescription, areaDescriptionShort, kindsUsed } from '${app}areas/areaJsonText';
export { itemWhen } from '${app}areas/profileItem';
export { keepAudience } from '${app}pages/pageImportRun';
export {
  parseLessonList, parseClassNames, lessonsOf, classesOf, withClasses, isProgram, programsOfClass, realizationsOf, stateOf, cellOf,
  progressOf, progressLine, journalRows, distribute, schoolYear, firstWeekday, weekdayBit, lessonSlots, lessonMessage, dayOf
} from '${app}areas/school';
export { sectionsOf, samplesOf } from '${app}core/jsonTree';
`);

const out = join(workspace, 'bundle.mjs');
await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', outfile: out, logLevel: 'error',
  nodePaths: [join(process.cwd(), 'node_modules')],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' }
});

const ok = (what) => console.log(`  ok  ${what}`);
const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;

try {
  const m = await import(pathToFileURL(out).href);

  /* 1 — dieselben Bytes wie Kernel.Tests ("duty") */
  {
    const at = Math.floor(Date.parse('2026-10-25T10:00:00Z') / 1000);
    const attachment = m.serialize(m.attachmentCanon({
      attachmentId: '01937D51-0C40-7F18-A2E6-4B91C7D3E550', controllerId: '01937d4f-3a11-7b92-8d47-5c0e2a9f1b63',
      areaId: '01937d4d-2e08-7c55-9a31-6b4f8d0c7e29', homeAreaId: '01937d4e-8f2a-7c31-9b05-2f6a1e8c4d77',
      signerRoleId: '01937d51-0c40-7f18-a2e6-4b91c7d3e551', signedAt: at
    }));
    assert.equal(attachment, '{"areaId":"01937d4d-2e08-7c55-9a31-6b4f8d0c7e29","attachmentId":"01937d51-0c40-7f18-a2e6-4b91c7d3e550","controllerId":"01937d4f-3a11-7b92-8d47-5c0e2a9f1b63","homeAreaId":"01937d4e-8f2a-7c31-9b05-2f6a1e8c4d77","kind":"controller-attachment","signedAt":1792922400,"signerRoleId":"01937d51-0c40-7f18-a2e6-4b91c7d3e551"}',
      'the attachment: the Kernel bytes (ids written small, whatever came in)');

    const step = {
      sequence: 1, previousHash: m.GENESIS_HASH, entryId: '01937d51-0c40-7f18-a2e6-4b91c7d3e552', reportId: '01937d51-0c40-7f18-a2e6-4b91c7d3e553',
      itemKind: 'part', itemId: '01937d4f-3a11-7b92-8d47-5c0e2a9f1b63', itemAt: null, action: 'block',
      signerRoleId: '01937d51-0c40-7f18-a2e6-4b91c7d3e551', signedAt: at
    };
    assert.equal(m.serialize(m.takedownCanon(step)), `{"action":"block","entryId":"01937d51-0c40-7f18-a2e6-4b91c7d3e552","itemAt":null,"itemId":"01937d4f-3a11-7b92-8d47-5c0e2a9f1b63","itemKind":"part","kind":"takedown","previousHash":"${'0'.repeat(64)}","reportId":"01937d51-0c40-7f18-a2e6-4b91c7d3e553","sequence":1,"signedAt":1792922400,"signerRoleId":"01937d51-0c40-7f18-a2e6-4b91c7d3e551"}`,
      'the takedown step: the Kernel bytes, genesis = 32 zero bytes');
    ok('the two signed records: the same canonical bytes as Kernel/DutyRecords.cs');
  }

  /* 2 — unterschreiben, prüfen, die Kette */
  {
    const pair = await crypto.subtle.generateKey(
      { name: 'RSA-PSS', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
    const spki = m.toBase64Url(new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)));
    const role = '01937d51-0c40-7f18-a2e6-4b91c7d3e551';

    const chain = [];
    let head = m.GENESIS_HASH;
    for (let i = 1; i <= 3; i += 1) {
      const facts = {
        sequence: i, previousHash: head, entryId: crypto.randomUUID(), reportId: crypto.randomUUID(), itemKind: 'message',
        itemId: crypto.randomUUID(), itemAt: null, action: i === 3 ? 'delete' : 'block', signerRoleId: role, signedAt: 1792922400 + i
      };
      const signature = m.toBase64Url(await m.signCanonical(pkcs8, m.takedownCanon(facts)));
      const entryHash = await m.takedownHash(facts);
      chain.push({ ...facts, entryHash, signature, recordedAt: '' });
      head = entryHash;
    }
    assert.deepEqual(await m.checkLedger([...chain].reverse(), spki), { checked: 3, broken: null }, 'a whole chain holds (any order in)');

    const forged = chain.map((e, i) => (i === 1 ? { ...e, action: 'restore' } : e));
    assert.match((await m.checkLedger(forged, spki)).broken, /Wpis 2: skrót/, 'a changed step: its hash no longer matches');
    const cut = [chain[0], chain[2]];
    assert.match((await m.checkLedger(cut, spki)).broken, /nie wisi/, 'a missing step breaks the link');
    const resigned = chain.map((e, i) => (i === 2 ? { ...e, signature: chain[1].signature } : e));
    assert.match((await m.checkLedger(resigned, spki)).broken, /podpis/, 'a signature of another step does not fit');
    ok('the chain: every hash, every link and every signature checked in the browser');
  }

  /* 3 — versiegelt für den Betreiber */
  {
    const operator = await m.newWrapPair();
    const other = await m.newWrapPair();
    const id = crypto.randomUUID();
    const letter = { v: 1, reportId: id, text: 'Moje zdjęcie bez zgody', secret: 'S'.repeat(43) };
    const box = await m.sealForOperator(m.toBase64Url(operator.publicKey), 'report', id, letter);
    assert.deepEqual(await m.openForOperator(operator.privateKey, 'report', id, box.sealed, box.sealedKey), letter, 'the operator opens it');
    await assert.rejects(m.openForOperator(other.privateKey, 'report', id, box.sealed, box.sealedKey), 'nobody else does');
    await assert.rejects(m.openForOperator(operator.privateKey, 'report', crypto.randomUUID(), box.sealed, box.sealedKey), 'not under another report id');
    await assert.rejects(m.openForOperator(operator.privateKey, 'objection', id, box.sealed, box.sealedKey), 'a report is no objection');
    assert.ok(!box.sealed.includes('zdj') && !atob(box.sealed.replace(/-/g, '+').replace(/_/g, '/')).includes('zgody'), 'no plaintext in the envelope');
    ok('a report: sealed for the operator role only, bound to its id and kind');
  }

  /* 4 — was ein Fall zulässt */
  {
    const row = (state, deleteFrom = null) => ({ state, deleteFrom });
    const now = new Date('2026-11-01T00:00:00Z');
    assert.deepEqual(m.actionsFor(row('received'), now), ['block', 'reject']);
    assert.deepEqual(m.actionsFor(row('blocked', '2026-11-05T00:00:00Z'), now), ['restore'], 'within 14 days: no deleting for good');
    assert.deepEqual(m.actionsFor(row('blocked', '2026-10-30T00:00:00Z'), now), ['restore', 'delete'], 'after 14 days: delete allowed');
    assert.deepEqual(m.actionsFor(row('objected', '2026-11-05T00:00:00Z'), now), ['restore', 'delete'], 'after an objection the operator decides at once');
    assert.deepEqual(m.actionsFor(row('restored'), now), ['block']);
    for (const done of ['deleted', 'rejected']) assert.deepEqual(m.actionsFor(row(done), now), [], `${done}: nothing left to decide`);
    ok('a case: block/reject, restore, delete for good only after 14 days or an objection');
  }

  /* 5 — die Klausel */
  {
    const c = { name: 'Parafia św. Jana', address: 'ul. Dobra 1, 30-001 Kraków', email: 'parafia@example.pl', phone: '+48 12 000 00 00',
      dpo: { name: 'Jan Nowak', contact: 'iod@example.pl' }, authority: 'kiod' };
    const l = m.clauseLines(c, 'collect');
    assert.equal(l.who, 'Administrator danych: Parafia św. Jana, ul. Dobra 1, 30-001 Kraków, e-mail: parafia@example.pl, tel. +48 12 000 00 00.');
    assert.equal(l.dpo, 'Inspektor ochrony danych: Jan Nowak, iod@example.pl.');
    assert.equal(l.complaint, 'Skargę możesz złożyć do Kościelnego Inspektora Ochrony Danych.');
    assert.ok(l.operator.includes(m.OPERATOR.name) && l.operator.includes(m.OPERATOR.email), 'the operator is named');
    assert.equal(l.nobody, null);
    const none = m.clauseLines(null, 'collect');
    assert.equal(none.who, null);
    assert.match(none.nobody, /nic tu nie zbieramy/);
    assert.equal(m.clauseLines({ name: 'Szkoła', address: null, email: null }, 'page').who, 'Za treść odpowiada: Szkoła.', 'under a page: who answers for its content');
    assert.equal(m.clauseLines({ name: 'Szkoła', address: null, email: null, authority: 'uodo' }, 'page').complaint, null, 'no complaint line under a page');
    assert.match(m.clauseText(c, 'collect'), /^Administrator danych: .*Kościelnego.*Serwis technicznie prowadzi/);
    assert.equal(m.reportPath('part', 'abc'), '#/zglos/part/abc');
    assert.ok(m.isReportKind('message') && !m.isReportKind('stan'));

    /* Beide Seiten kennen dieselben Arten und dieselbe Fassung der Bedingungen. */
    const items = await readFile(join(process.cwd(), '../backend/Api/Reports/Reports.Items.cs'), 'utf8');
    const kinds = /Kinds = \[([^\]]*)\]/.exec(items)?.[1].split(',').map((k) => k.trim().replace(/"/g, '')).filter(Boolean);
    assert.deepEqual(kinds, [...m.REPORT_KINDS], 'Reports.Kinds and REPORT_KINDS name the same kinds');
    const controllers = await readFile(join(process.cwd(), '../backend/Api/Areas/Controllers.cs'), 'utf8');
    assert.equal(/TermsVersion = "([^"]+)"/.exec(controllers)?.[1], m.TERMS_VERSION, 'the browser accepts the terms the service asks for');
    ok('the clause: who, how to reach them, the DPO, where to complain, the operator; nobody says so');
  }

  /* 6 — Sprawy in der Glocke */
  {
    const settings = m.readAlerts('');
    const digest = {
      now: '', since: '', linksSince: '', total: 0, nextPollSeconds: 60,
      chats: { unread: 0, loud: 0, list: [] }, registrations: { count: 0, list: [] }, links: 0, tasks: 0, roles: { waiting: [] },
      bookings: { count: 0, list: [] }, steps: { count: 0, list: [] }, learn: { count: 0, list: [] },
      duties: {
        count: 3,
        controllers: {
          asks: [{ attachmentId: 'x1', areaName: 'Schola', controllerName: 'Parafia', homeAreaId: 'home' }],
          offers: [{ attachmentId: 'x2', areaId: 'grupa', areaName: 'Grupa', controllerName: 'Parafia' }],
          decided: [], nobody: [{ areaId: 'lost', areaName: 'Oaza' }], missing: []
        },
        reports: { count: 1, isOperator: true },
        takedowns: [{ id: 't1', itemKind: 'part', itemId: 'p', state: 'blocked', reason: 'other', since: '2026-10-25T00:00:00Z', path: 'parafia', objectedAt: null, objectUntil: '2026-11-08T00:00:00Z', reportId: 'r' }],
        listings: []
      }
    };
    const items = m.alertItems(digest, [], settings, null).filter((a) => a.kind === 'duties');
    assert.deepEqual(items.map((a) => a.key), ['dax1', 'dox2', 'dnlost', 'dr', 'dtt1']);
    assert.equal(items[0].href, '#/workspace/areas/home/ustawienia', 'an ask is signed in the settings of the home area');
    assert.equal(items[3].href, '#/workspace/sprawy');
    assert.equal(m.alertCount(digest, settings), 3, 'the bell counts what waits for a decision');
    const inGrupa = m.alertItems(digest, [], settings, new Set(['grupa'])).filter((a) => a.kind === 'duties');
    assert.deepEqual(inGrupa.map((a) => a.key), ['dox2'], 'an area view: only its own; reports and takedowns are account-wide');
    ok('Sprawy in the bell: data controller asks lead to the area settings, the rest to Sprawy');
  }

  /* 7 — der Haupttermin eines neuen Wydarzenie und sein Satz auf der Karte */
  {
    const evening = m.mainTermOf({ date: '2026-11-14', time: '18:00', endDate: '', endTime: '' });
    assert.deepEqual(evening, { date: '2026-11-14', time: '18:00', minutes: 120, allDay: false }, 'no end: two hours');
    const lead = m.leadOf(evening, ' Kaplica ');
    assert.ok(lead.includes('18:00–20:00') && lead.endsWith(' · Kaplica'), lead);
    const camp = m.mainTermOf({ date: '2026-07-01', time: '', endDate: '2026-07-10', endTime: '' });
    assert.deepEqual(camp, { date: '2026-07-01', time: '00:00', minutes: 10 * 1440, allDay: true }, 'no time: whole days to the end');
    assert.ok(/ – /.test(m.leadOf(camp, '')) && !m.leadOf(camp, '').includes(':'), m.leadOf(camp, ''));
    assert.equal(m.mainTermOf({ date: '', time: '18:00', endDate: '', endTime: '' }), null, 'no day: no main appointment');
    assert.equal(m.leadOf(null, ''), null);
    ok('a new event: its main appointment from four fields, and when/where as the page lead');
  }

  /* 8 — 0133: das Dokument eines Bereichs („recreatio/area") */
  {
    const A = '01937d4d-2e08-7c55-9a31-6b4f8d0c7e29';
    const P = '01937d4e-8f2a-7c31-9b05-2f6a1e8c4d77';
    const STRANGER = '01937d4f-3a11-7b92-8d47-5c0e2a9f1b63';
    const CAL = '01937d50-0000-7000-8000-000000000001';
    const ITEM = '01937d50-0000-7000-8000-000000000002';
    const ITEM2 = '01937d50-0000-7000-8000-000000000003';
    const FORM = '01937d50-0000-7000-8000-000000000004';
    const FORM2 = '01937d50-0000-7000-8000-000000000005';
    const ROLE = '01937d50-0000-7000-8000-000000000006';
    const ROLE2 = '01937d50-0000-7000-8000-000000000007';
    const OTHER = '01937d50-0000-7000-8000-000000000008';
    let counter = 0;
    const fakeId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
    const pageOptions = { replace: false, copyModules: false, legacyPage: 0, takeTheme: true };

    /* Lesen: beide Beispiele ohne ein Wort, Fehler nur ohne Dokument eines Bereichs. */
    const ex = m.readAreaDocument(m.areaExample());
    assert.ok(!('error' in ex), 'the event example reads');
    assert.deepEqual(ex.warnings, [], 'the event example reads without a word');
    assert.equal(ex.doc.kind, 'event');
    assert.deepEqual(ex.doc.pages.map((p) => [p.key, p.path, p.main, p.after]), [['main', '', true, false], ['po', 'po', false, true]]);
    assert.deepEqual(ex.doc.roles.map((r) => [r.key, r.level, r.link !== null]), [['organizatorzy', 'admin', false], ['pomocnicy', 'write', true], ['uczestnicy', 'read', false]]);
    assert.equal(ex.doc.itemExtras.get('main')?.main, true, 'the main appointment');
    assert.equal(ex.doc.appointments.total, 4, 'the main appointment and its three points');
    assert.deepEqual(ex.doc.subforms.map((s) => [s.key, s.of]), [['zgody', 'main/zapisy']], '"of": "@form:…" is read as the form reference');
    assert.deepEqual(ex.doc.chats, [{ kind: 'area', forms: ['main/zapisy'] }, { kind: 'channel', forms: [] }]);
    const gx = m.readAreaDocument(m.groupExample());
    assert.ok(!('error' in gx) && gx.warnings.length === 0, `the group example reads without a word: ${'warnings' in gx ? gx.warnings.join(' | ') : gx.error}`);
    assert.equal(gx.doc.appointments.items[0].repeat, 'weekly');
    assert.ok('error' in m.readAreaDocument({ format: 'recreatio/page', modules: [] }), 'a page document is not an area document');
    assert.ok('error' in m.readAreaDocument({ title: 'x' }), 'without "format" it is not one');
    assert.ok('error' in m.readAreaDocument([]), 'nor a list');

    const loose = m.readAreaDocument({
      format: m.AREA_FORMAT, version: 1, kind: 'event', extra: 1,
      roles: [{ key: 'a', name: 'A', level: 'boss' }, { key: 'a', name: 'B' }, { key: 'b c', name: 'C' }],
      appointments: [{ title: 'Bez klucza', start: '2026-01-10T10:00', calendar: 'inny' }, { key: 'm2', main: true, title: 'Seria', start: '2026-01-11T10:00', repeat: 'weekly' }],
      pages: [{ key: 'main', path: '', main: true, after: true, page: { modules: [] } }, { key: 'zla', path: 'Zła Ścieżka', page: {} }],
      chats: ['area', 'party']
    });
    assert.ok(!('error' in loose));
    assert.deepEqual(loose.doc.roles.map((r) => [r.key, r.level]), [['a', 'read']], 'a bad level reads as "read"; repeats and bad keys fall away');
    assert.equal(loose.doc.appointments.items[0].key, 'termin-1', 'an appointment without "key" gets one');
    assert.equal(loose.doc.itemExtras.get('m2')?.main, false, 'a repeating appointment is never the main one');
    assert.deepEqual(loose.doc.pages.map((p) => [p.key, p.main, p.after]), [['main', true, false]], 'main wins over after; a bad path falls away');
    for (const said of ['"extra"', 'termin-1', '"calendar"', 'bez powtórzeń', 'po wydarzeniu', 'Zła Ścieżka', 'party']) {
      assert.ok(loose.warnings.some((w) => w.includes(said)), `a word about ${said}: ${loose.warnings.join(' | ')}`);
    }

    /* Adressen und Schlüssel. */
    assert.equal(m.resolvePath('parafia/rek', ''), 'parafia/rek');
    assert.equal(m.resolvePath('parafia/rek', 'zapisy'), 'parafia/rek/zapisy');
    assert.equal(m.resolvePath('parafia/rek', '/inna/strona'), 'inna/strona', 'a leading "/" means exactly this address');
    assert.equal(m.resolvePath('', 'zapisy'), null, 'without a main address nothing relative resolves');
    assert.equal(m.relativePath('parafia/rek', 'parafia/rek/zapisy'), 'zapisy');
    assert.equal(m.relativePath('parafia/rek', 'parafia/rek'), '');
    assert.equal(m.relativePath('parafia/rek', 'inna'), '/inna');
    assert.equal(m.pathProblem('parafia/rek-2026'), null);
    assert.ok(m.pathProblem('workspace/x') !== null && m.pathProblem('a/portal/b') !== null && m.pathProblem('Ąę') !== null && m.pathProblem('') !== null);
    assert.equal(m.keyFrom('Rada parafialna — Łódź'), 'rada-parafialna-lodz');
    assert.equal(m.freeKey('x', new Set(['x', 'x-2'])), 'x-3');
    ok('area document: reading (both examples clean, tolerant with a word), addresses, keys');

    /* Verweise: nur ganze Werte, hin und zurück. */
    const ids = {
      areaId: A, calendarId: CAL, items: new Map([['main', ITEM], ['dzien1', ITEM2]]), forms: new Map([['main/zapisy', FORM]]),
      pages: new Map([['main', 'parafia/rek'], ['po', 'parafia/rek/po']]), roles: new Map([['uczestnicy', ROLE]])
    };
    const missing = new Set();
    const swapped = m.resolveTokens({ a: '@area', b: 'Napisz do @area', c: '@form:main/zapisy', d: ['@role:uczestnicy', `${P},@area`], e: '@page:po', f: '@form:nie' }, ids, missing);
    assert.deepEqual(swapped, { a: A, b: 'Napisz do @area', c: FORM, d: [ROLE, `${P},${A}`], e: 'parafia/rek/po', f: '@form:nie' });
    assert.deepEqual([...missing], ['@form:nie'], 'what leads nowhere is reported and stays');
    const program = m.resolveCalendarFields({ kind: 'program', config: { title: 'P', calendar: '', item: '@main' } }, ids, missing);
    assert.deepEqual(program.config, { title: 'P', calendar: CAL, item: ITEM }, 'a programme gets the item and the calendar of the area');
    assert.equal(m.resolveCalendarFields({ kind: 'calendar', config: { calendars: '@kalendarz' } }, ids, missing).config.calendars, CAL);
    assert.deepEqual(m.resolveRoleRefs({ memberRoles: ['@uczestnicy', '@role:uczestnicy', ROLE2] }, ids, missing).memberRoles, [ROLE, ROLE, ROLE2]);
    const back = {
      areaId: A, calendars: new Set([CAL]), items: new Map([[ITEM, 'main']]), forms: new Map([[FORM, 'main/zapisy']]),
      pages: new Map([['parafia/rek/po', 'po']]), roles: new Map([[ROLE, 'uczestnicy']])
    };
    assert.deepEqual(m.tokenizeValues({ x: A, y: `${A},${ROLE}`, z: 'tekst', f: FORM, u: OTHER }, back), { x: '@area', y: '@area,@role:uczestnicy', z: 'tekst', f: '@form:main/zapisy', u: OTHER });
    const out = m.tokenizeCalendarFields({ kind: 'program', config: { title: 'P', calendar: CAL, item: ITEM } }, back);
    assert.deepEqual(out.config, { title: 'P', calendar: '', item: '@main' }, 'export: the item by its key, the calendar of the area falls away');
    assert.deepEqual(m.resolveCalendarFields(out, ids, new Set()).config, { title: 'P', calendar: CAL, item: ITEM }, 'and import brings both back');
    assert.equal(m.tokenizePaths({ menu: [{ label: 'Po', kind: 'abs', target: 'parafia/rek/po', children: [] }] }, back).menu[0].target, '@page:po');
    ok('area document: "@area", "@form:", "@page:", "@role:", "@termin", "@kalendarz" — whole values only, export → import gives the same ids');

    /* Feste Stellen über zwei Importe — und nichts aus einem fremden Bereich. */
    const main = ex.doc.pages[0];
    const prep1 = m.preparePage({
      page: main, now: m.blankPage('parafia/rek'), book: m.keyBook([]), ids,
      formModules: new Map([['main/zapisy', { moduleId: FORM, isNew: true }]]), newId: fakeId,
      cardImage: 'page-image:@plakat', fallbackTitle: 'Rekolekcje'
    });
    assert.equal(prep1.synthetic.size, 5, 'five new places, each with a fixed id');
    assert.deepEqual(prep1.entries.map((e) => [e.key, e.isNew]), [['wizytowka', true], ['zdjecie', true], ['program', true], ['zapisy', true], ['napisz', true]]);
    assert.deepEqual(prep1.entries[4].ask, { answer: ['organizatorzy'], forms: ['main/zapisy'] }, '"Napisz do nas": who answers, whose people write');
    assert.ok(!('answer' in prep1.doc.modules[4]) && !('forms' in prep1.doc.modules[4]), 'the page import does not get them (the area import sets them up)');
    {
      const said = [];
      assert.deepEqual(m.readAsk({ answer: ['@role:organizatorzy', 'x y'], forms: 'main/zapisy' }, 'T', said), { answer: ['organizatorzy'], forms: [] });
      assert.equal(said.length, 2, said.join(' | '));
      assert.deepEqual(m.readAsk({}, 'T', []), { answer: [], forms: null }, 'nothing said: the defaults');
    }
    assert.equal(prep1.entries[3].form?.moduleId, FORM, 'the form shows the module made for it in this area');
    assert.equal(prep1.doc._cardImage, 'page-image:@plakat', 'the card asks for its file with this page');
    assert.equal(prep1.missing.size, 0, `no reference leads nowhere: ${[...prep1.missing].join(', ')}`);
    const docModules = prep1.doc.modules;
    assert.deepEqual(docModules.map((e) => e.id), prep1.entries.map((e) => e.partId), 'entries carry the fixed ids');
    assert.equal(docModules[0].config.area, A, '"@area" became the area');
    assert.deepEqual([docModules[2].config.item, docModules[2].config.calendar], [ITEM, CAL]);
    assert.deepEqual(docModules[3].memberRoles, [ROLE]);
    const plan1 = m.planPrepared(prep1, pageOptions, new Set(['plakat']));
    assert.ok(!('error' in plan1), 'the page plans');
    assert.deepEqual(plan1.warnings, [], `the page plans without a word: ${plan1.warnings.join(' | ')}`);
    const first = m.adjustPagePlan(plan1, prep1, A, false, []);
    assert.deepEqual(first.parts.map((p) => p.id), prep1.entries.map((e) => e.partId), 'saved with exactly those ids');
    assert.ok(first.parts.every((p) => p.layout.desktop !== undefined && p.layout.mobile !== undefined), 'every new place has a place on the grid');
    assert.equal(first.parts[3].moduleId, FORM);
    assert.ok(first.lines.some((l) => l.startsWith('Moduły: zmienione w miejscu — 0, nowe — 5')), first.lines.join(' | '));

    const book = m.keyBook([
      ...prep1.entries.map((e) => ({ kind: 'page', key: e.ref, refId: e.partId, refText: null, updatedAt: '' })),
      { kind: 'form', key: 'main/zapisy', refId: FORM, refText: null, updatedAt: '' }
    ]);
    const now2 = { ...m.blankPage('parafia/rek'), title: 'Rekolekcje adwentowe 2026', lead: 'Trzy wieczory ze słowem, ciszą i wspólnotą.', parts: first.parts };
    const prep2 = m.preparePage({
      page: main, now: now2, book, ids, formModules: new Map([['main/zapisy', { moduleId: FORM, isNew: false }]]), newId: fakeId,
      cardImage: 'page-image:@plakat', fallbackTitle: 'Rekolekcje'
    });
    assert.equal(prep2.synthetic.size, 0, 'a second import makes no new place');
    assert.deepEqual(prep2.entries.map((e) => e.partId), prep1.entries.map((e) => e.partId), 'the same places by their keys');
    const plan2 = m.planPrepared(prep2, pageOptions, new Set(['plakat']));
    const second = m.adjustPagePlan(plan2, prep2, A, false, now2.parts);
    assert.deepEqual(second.parts.map((p) => [p.id, p.moduleId]), first.parts.map((p) => [p.id, p.moduleId]), 'same ids, same modules');
    assert.deepEqual(second.parts.map((p) => p.layout), first.parts.map((p) => p.layout), 'and the same places on the grid');
    assert.ok(second.lines.some((l) => l.startsWith('Moduły: zmienione w miejscu — 5, nowe — 0')), second.lines.join(' | '));

    const after = m.preparePage({ page: ex.doc.pages[1], now: m.blankPage('parafia/rek/po'), book: m.keyBook([]), ids, formModules: new Map(), newId: fakeId });
    const afterPlan = m.adjustPagePlan(m.planPrepared(after, pageOptions, new Set()), after, A, false, []);
    assert.deepEqual(afterPlan.parts.map((p) => p.audienceAreaId ?? null), [null, A], '"members": true — only for the people of the area');
    const kept = m.keepAudience({ ...afterPlan, parts: [{ id: 'p1', moduleId: null, kind: 'text', layout: {}, config: {} }, { id: 'p2', moduleId: null, kind: 'text', layout: {}, config: {}, audienceAreaId: null }] },
      [{ id: 'p1', moduleId: null, kind: 'text', layout: {}, config: {}, audienceAreaId: A }, { id: 'p2', moduleId: null, kind: 'text', layout: {}, config: {}, audienceAreaId: A }]);
    assert.deepEqual(kept.parts.map((p) => p.audienceAreaId ?? null), [A, null], 'a page import keeps "only for the area" unless the import says otherwise');

    const foreign = m.preparePage({
      page: { key: 'obcy', path: 'obcy', main: false, after: false, page: { modules: [
        { id: 'f', kind: 'form', module: OTHER, name: 'Obcy', questions: [{ id: 'q', kind: 'line', label: 'Imię', answersTo: STRANGER }] }
      ] } },
      now: m.blankPage('parafia/rek/obcy'), book: m.keyBook([]), ids, formModules: new Map([['obcy/f', { moduleId: FORM2, isNew: true }]]), newId: fakeId
    });
    assert.equal(foreign.doc.modules[0].module, undefined, '"module" from another area falls away');
    assert.equal(foreign.entries[0].form?.moduleId, FORM2, 'the form gets its own module here');
    assert.equal(foreign.doc.modules[0].questions[0].answersTo, undefined, 'answers always go to this area');
    assert.ok(foreign.warnings.some((w) => w.includes('"module"')) && foreign.warnings.some((w) => w.includes('answersTo')), foreign.warnings.join(' | '));
    const positional = m.entryKeysOf({ key: 'p', path: 'p', main: false, after: false, page: { modules: [{ kind: 'text' }, { kind: 'text' }, { kind: 'text', id: 'text-2' }, { kind: 'form' }] } }, [], m.keyBook([]));
    assert.deepEqual(positional.keys, ['text-1', 'text-2-2', 'text-2', 'form-1'], 'own names first, then by kind and order');
    assert.ok(positional.warnings.some((w) => w.includes('formularz bez "id"')));
    ok('area document: fixed places over two imports (same ids, modules, grid), "members", kept audience, nothing from another area, names by kind');

    /* Der Plan. */
    const controller = { id: 'c', version: 1, name: 'Parafia', address: null, email: null, phone: null, dpo: null, authority: null, homeAreaId: P, fromAreaId: P };
    const profileState = (over = {}) => ({ areaId: A, profile: null, admin: true, controller, public: false, publishPublic: true, openForms: [], ...over });
    const area = (areaId, name, parentAreaId, publicLevel, myLevel) => ({
      areaId, name, currentEpoch: 1, heldEpochs: 1, publishedEpochs: publicLevel === 'none' ? 0 : 1, parentAreaId, publicLevel, seatLevel: 'own', myLevel, mayCertify: myLevel === 'admin'
    });
    const areas = [area(A, 'Rekolekcje 2026', P, 'none', 'admin'), area(P, 'Wydarzenia', null, 'read', 'admin'), area(STRANGER, 'Obcy', null, 'read', 'read')];
    const card = (path) => ({ path, roleId: 'r', claimedAt: '', aliasOf: null, host: null, title: null, accessAreaIds: [] });
    const stateOf = (over = {}) => ({
      areaId: A, areaName: 'Rekolekcje 2026', profile: profileState(), book: m.keyBook([]), areas, desk: [card('parafia')], modules: [],
      holds: () => false, pages: new Map(), ...over
    });
    const opts = (over = {}) => ({ base: 'parafia/rekolekcje-2026', publishAreaId: null, replaceModules: false, replaceQuestions: false, adoptPages: false, ...over });

    const plan = m.planArea(ex.doc, stateOf(), opts());
    assert.equal(plan.blocked, null);
    assert.equal(plan.publishAreaId, P, '"auto": the nearest public area above that I lead');
    assert.deepEqual(plan.warnings, [], plan.warnings.join(' | '));
    assert.deepEqual(plan.items.map((i) => [i.importKey, i.parentKey, i.visibilityAreaId === P, i.main]),
      [['main', null, true, true], ['main/1', 'main', true, false], ['main/2', 'main', true, false], ['main/3', 'main', true, false]]);
    assert.deepEqual(plan.pages.map((p) => [p.doc.key, p.path, p.problem]), [['main', 'parafia/rekolekcje-2026', null], ['po', 'parafia/rekolekcje-2026/po', null]]);
    assert.deepEqual(plan.steps.map((s) => s.key), ['profile', 'roles', 'appointments', 'subforms', 'chats', 'card']);
    assert.ok(m.planLines(plan.steps)[0].startsWith('1. Profil — '));

    assert.match(m.planArea(ex.doc, stateOf({ profile: profileState({ admin: false }) }), opts()).blocked ?? '', /prowadzi/);
    assert.match(m.planArea(ex.doc, stateOf(), opts({ base: '' })).blocked ?? '', /adres strony głównej/);
    const kindless = m.readAreaDocument({ format: m.AREA_FORMAT, version: 1 });
    assert.match(m.planArea(kindless.doc, stateOf(), opts()).blocked ?? '', /"kind"/);
    assert.ok(m.planArea(ex.doc, stateOf({ profile: profileState({ controller: null }) }), opts()).warnings.some((w) => w.includes('administratora danych')));

    const taken = m.planArea(ex.doc, stateOf({ desk: [card('parafia'), card('parafia/rekolekcje-2026')] }), opts());
    assert.ok(taken.pages[0].foreign && /nie jest stroną tego obszaru/.test(taken.pages[0].problem ?? ''), 'a page that exists and is not of this area is left alone');
    assert.equal(m.planArea(ex.doc, stateOf({ desk: [card('parafia'), card('parafia/rekolekcje-2026')] }), opts({ adoptPages: true })).pages[0].problem, null, '…unless the importer allows it');
    const ownedMain = { kind: 'event', publishAreaId: P, card: null, imageId: null, category: null, main: { slugId: 's', path: 'parafia/rekolekcje-2026' }, after: null, itemId: null, item: null, archiveMode: 'auto', archivedAt: null, ended: false, createdAt: '' };
    assert.equal(m.planArea(ex.doc, stateOf({ desk: [card('parafia'), card('parafia/rekolekcje-2026')], profile: profileState({ profile: ownedMain }) }), opts()).pages[0].problem, null, 'the main page of the profile is its own');
    assert.match(m.planArea(ex.doc, stateOf(), opts({ base: 'rekolekcje' })).pages[0].problem ?? '', /najwyższego poziomu/);
    const elsewhere = m.planArea(ex.doc, stateOf(), opts({ publishAreaId: STRANGER }));
    assert.equal(elsewhere.publishAreaId, A, 'publishing in an area I do not lead stays in the area');
    assert.ok(elsewhere.warnings.some((w) => w.includes('prowadzi oba obszary')));

    const again = m.planArea(ex.doc, stateOf({
      book: m.keyBook([
        { kind: 'role', key: 'organizatorzy', refId: ROLE, refText: null, updatedAt: '' },
        { kind: 'link', key: 'pomocnicy', refId: OTHER, refText: null, updatedAt: '' },
        { kind: 'appointment', key: 'main', refId: ITEM, refText: null, updatedAt: '' },
        { kind: 'appointment', key: 'main/4', refId: ITEM2, refText: null, updatedAt: '' }
      ]),
      holds: (id) => id === ROLE
    }), opts());
    assert.equal(again.roles[0].roleId, ROLE, 'a role made by an earlier import stays');
    assert.equal(again.roles[1].linkMade, true, 'a link is made once');
    assert.equal(again.items[0].itemId, ITEM, 'the appointment is changed in place');
    assert.deepEqual(again.dropItems.map((k) => k.key), ['main/4'], 'a point the programme no longer has goes');

    /* Was der Reiter der Art schon angelegt hat: die gleichnamige Rolle, der Haupttermin des Profils. */
    const madeByTab = m.planArea(ex.doc, stateOf({
      roleNames: new Map([[ROLE2, 'Uczestnicy: Rekolekcje 2026'], [OTHER, 'Inna rola']]),
      profile: profileState({ profile: { ...ownedMain, itemId: ITEM } })
    }), opts());
    assert.deepEqual(madeByTab.roles.map((r) => [r.doc.key, r.roleId, r.adopted === true]), [['organizatorzy', null, false], ['pomocnicy', null, false], ['uczestnicy', ROLE2, true]],
      'a role without a key: the one of the area with that name ("Uczestnicy: …")');
    assert.deepEqual([madeByTab.items[0].itemId, madeByTab.items[0].adopted], [ITEM, true], 'the main appointment of the profile is changed, not made twice');
    assert.ok(madeByTab.items.slice(1).every((i) => i.itemId === null && i.adopted !== true), 'its points are matched by place while importing');
    const keyedElsewhere = m.planArea(ex.doc, stateOf({
      book: m.keyBook([{ kind: 'appointment', key: 'inny', refId: ITEM, refText: null, updatedAt: '' }]),
      profile: profileState({ profile: { ...ownedMain, itemId: ITEM } })
    }), opts());
    assert.equal(keyedElsewhere.items[0].itemId, null, 'not when another key already has it');

    const fresh = m.suggestBase(ex.doc, stateOf());
    assert.equal(fresh, 'parafia/rekolekcje-2026', 'the suggested address when it is free');
    assert.equal(m.suggestBase(ex.doc, stateOf({ desk: [card('parafia'), card('parafia/rekolekcje-2026')] })), 'parafia/rekolekcje-2026-2', 'next to it when it is taken');
    const claimedEmpty = new Map([['parafia/rekolekcje-2026', { state: 'page', editable: true, now: m.blankPage('parafia/rekolekcje-2026') }]]);
    assert.equal(m.suggestBase(ex.doc, stateOf({ desk: [card('parafia'), card('parafia/rekolekcje-2026')], pages: claimedEmpty })), 'parafia/rekolekcje-2026', 'the address claimed for it, still empty');
    const emptyPlan = m.planArea(ex.doc, stateOf({ desk: [card('parafia'), card('parafia/rekolekcje-2026')], pages: claimedEmpty }), opts());
    assert.deepEqual([emptyPlan.pages[0].problem, emptyPlan.pages[0].foreign], [null, false], 'an empty page claimed before the import is filled');
    assert.equal(m.suggestBase(ex.doc, stateOf({ profile: profileState({ profile: { ...ownedMain, main: { slugId: 's', path: 'parafia/moje' } } }) })), 'parafia/moje', 'the main page the area already has');

    const shown = m.previewIds(plan, stateOf(), null, fakeId);
    const view = m.previewPage({
      planned: plan.pages[0], state: stateOf(), ids: shown.ids, formModules: shown.formModules, options: opts(),
      cardImage: 'page-image:@plakat', fallbackTitle: 'Rekolekcje', chosen: new Set(), newId: fakeId, publishAreaId: plan.publishAreaId
    });
    assert.ok(view.lines[0].includes('nowa') && view.lines.some((l) => l.includes('Formularz „Zapisy na rekolekcje” (nowy): pytania w „Wydarzenia”')), view.lines.join(' | '));
    ok('area document: the plan — publishing area, steps, blocked without lead/address/kind, foreign and top-level pages, a second import, suggested address, page preview');

    /* Die Beschreibung und der Auftrag. */
    const keys = m.sectionsOf(m.AREA_JSON).map((s) => s.node.key);
    for (const key of ['area', 'area.keys', 'area.refs', 'area.roles', 'area.appointments', 'area.pages', 'page', 'page.module', 'kinds', 'area.subforms', 'area.example']) {
      assert.ok(keys.includes(key), `the description has "${key}"`);
    }
    assert.equal(new Set(keys).size, keys.length, 'each section once');
    assert.deepEqual(m.samplesOf(m.AREA_JSON).map((s) => s.label), ['wydarzenie: rekolekcje z zapisami i stroną po nich', 'grupa: schola z próbami'], 'only area documents to insert (no page samples)');
    const text = m.areaDescription();
    assert.ok(text.includes('"recreatio/area"') && text.includes('@form:strona/moduł') && text.includes('"recreatio/page"'));
    const prompt = m.areaPrompt({ areaName: 'Rekolekcje 2027', kind: 'event', template: { name: 'Rekolekcje 2026', doc: m.areaExample() }, current: null });
    for (const said of ['Rekolekcje 2027', '„Rekolekcje 2026”', '=== OPIS FORMATU ===', '=== WZÓR', 'danych osobowych', '"key": "organizatorzy"']) {
      assert.ok(prompt.includes(said), `the prompt says ${said}`);
    }
    const short = m.areaDescriptionShort([m.areaExample()]);
    assert.ok(short.text.length < text.length / 2, `the prompt's description is much shorter (${short.text.length} of ${text.length})`);
    for (const said of ['"recreatio/area"', 'Napisz do nas', '@form:strona/moduł']) assert.ok(short.text.includes(said), `the short one still says ${said}`);
    assert.ok(short.left.includes('"animation"') && !short.left.includes('"seat-ask"'), short.left.join(', '));
    assert.ok(!m.areaDescriptionShort([{ pages: [{ page: { modules: [{ kind: 'animation' }] } }] }]).left.includes('"animation"'), 'a kind the template uses stays');
    assert.ok(prompt.includes('skrócony') && !m.areaPrompt({ areaName: 'X', kind: 'event', template: null, current: null, full: true }).includes('skrócony'), 'the full prompt has everything');
    ok('area document: description tree (page format inside, area samples only), prompt with the template, shorter for the AI');

    /* Der Haupttermin aus Beginn und Ende (profileItem). */
    assert.deepEqual(m.itemWhen('2026-11-14T18:00', '2026-11-16T14:00'), { date: '2026-11-14', time: '18:00', minutes: 2 * 1440 - 240, allDay: false });
    assert.deepEqual(m.itemWhen('2026-07-01', '2026-07-10'), { date: '2026-07-01', time: '00:00', minutes: 10 * 1440, allDay: true });
    assert.deepEqual(m.itemWhen('2026-11-14T18:00', null), { date: '2026-11-14', time: '18:00', minutes: 120, allDay: false });
    assert.equal(m.itemWhen('kiedyś', null), null);
    ok('itemWhen: days and times to one appointment');

    {
    /* == 9. 0134 — Schule und Klassen: ein Programm, seine Verwirklichung je Klasse ============== */
    assert.deepEqual(m.parseLessonList('# Dział I\n1. Stworzenie świata\n2) Adam i Ewa\n\nDział II:\n- Abraham\n   \n'),
      [{ heading: 'Dział I' }, { title: 'Stworzenie świata' }, { title: 'Adam i Ewa' }, { heading: 'Dział II' }, { title: 'Abraham' }], 'a typed list: headings and lessons, numbering gone');
    assert.deepEqual(m.parseClassNames('1a, 1b; 2a\n1A\n  '), ['1a', '1b', '2a'], 'class names: commas, semicolons, lines, no doubles');

    const T1 = '01937d50-0000-7000-8000-0000000000a1';
    const T2 = '01937d50-0000-7000-8000-0000000000a2';
    const T3 = '01937d50-0000-7000-8000-0000000000a3';
    const T4 = '01937d50-0000-7000-8000-0000000000a4';
    const C1 = '01937d50-0000-7000-8000-0000000000c1';
    const C2 = '01937d50-0000-7000-8000-0000000000c2';
    const texts = new Map([T1, T2, T3, T4].map((id, i) => [id, { id, kind: 'text', data: { title: `Lekcja ${i + 1}` } }]));
    const look = { get: (id) => texts.get(id), byKey: () => undefined };
    const program = { id: 'p', kind: 'project', data: { projectType: 'program', title: 'Religia 4', outline: [{ heading: 'Dział I' }, { text: T1 }, { text: T2 }, { heading: 'Dział II' }, { text: T3 }, { text: 'gone' }, { text: T4 }] } };
    const lessons = m.lessonsOf(program, look);
    assert.deepEqual(lessons.map((l) => [l.number, l.title, l.heading]), [[1, 'Lekcja 1', 'Dział I'], [2, 'Lekcja 2', 'Dział I'], [3, 'Lekcja 3', 'Dział II'], [4, 'Lekcja 4', 'Dział II']], 'lessons in outline order, under their heading; what cannot be opened falls away');
    const assigned = { ...program, data: m.withClasses(program.data, [C1, C1.toUpperCase(), C2]) };
    assert.deepEqual(m.classesOf(assigned), [C1, C2], 'classes of a program, once each');
    assert.ok(m.isProgram(assigned) && !m.isProgram({ id: 'x', kind: 'project', data: { projectType: 'book' } }), 'a program is marked or names classes');
    assert.deepEqual(m.programsOfClass([assigned, program], C2).map((p) => p.id), ['p']);

    const delivery = (id, text, date, state, area, extra = {}) => ({ id, kind: 'delivery', updatedAt: `2026-10-01T00:00:0${id.length % 10}`, data: { texts: text === null ? [] : [text], date, ...(state === null ? {} : { state }), ...(area === null ? {} : { classArea: area }), ...extra } });
    const entries = [
      delivery('d1', T1, '2026-10-06', 'done', C1, { summary: 'Rozmowa o stworzeniu', homework: 'Rdz 1' }),
      delivery('d2', T2, '2026-10-13', 'skipped', C1),
      delivery('d3', T3, '2026-10-27', 'planned', C1),
      delivery('d4', T1, '2026-10-07', null, C2),
      delivery('d5', T1, '2026-08-02', null, null),
      { id: 't', kind: 'text', data: { title: 'x' } }
    ];
    const c1 = m.realizationsOf(entries, C1);
    assert.deepEqual(c1.map((r) => [r.id, r.state]), [['d1', 'done'], ['d2', 'skipped'], ['d3', 'planned']], 'a class: its lessons by day; a sermon without a class is no lesson');
    assert.equal(m.realizationsOf(entries, C2)[0].state, 'done', 'no state said: held');
    assert.equal(m.realizationsOf(entries).length, 4, 'all classes');
    assert.equal(m.stateOf({}), 'done');
    assert.equal(m.cellOf([c1[2], c1[0]])?.id, 'd1', 'held wins over planned');
    assert.equal(m.cellOf([{ ...c1[2], date: '2026-11-03' }, c1[2]])?.date, '2026-10-27', 'the earliest planned');
    assert.equal(m.cellOf([c1[1]])?.state, 'skipped');
    assert.equal(m.cellOf([]), null);
    const progress = m.progressOf(lessons, c1);
    assert.deepEqual(progress, { total: 4, done: 1, partial: 0, planned: 1 });
    assert.match(m.progressLine(progress), /Zrealizowane 1 z 4.*zaplanowane 1/);

    const slot = (date, time, cancelled = false) => ({ itemId: 'L', date, startsAt: `${date}T${time}:00`, endsAt: `${date}T${time}:45`, occurrenceAt: `${date}T${time}:00`, cancelled });
    const slots = [slot('2026-10-06', '08:00'), slot('2026-10-06', '09:00'), slot('2026-10-20', '08:00'), slot('2026-10-27', '08:00'), slot('2026-11-03', '08:00', true), slot('2026-11-10', '08:00'), slot('2026-11-17', '08:00')];
    const rows = m.journalRows(slots.slice(0, 3), c1.slice(0, 2));
    assert.deepEqual(rows.map((r) => [r.date, r.slot !== null, r.realization?.id ?? null]),
      [['2026-10-06', true, 'd1'], ['2026-10-06', true, null], ['2026-10-13', false, 'd2'], ['2026-10-20', true, null]], 'the journal: each date with its slots and what happened, a realization without a slot too');
    const plan = m.distribute(lessons, c1, slots, '2026-10-26');
    assert.deepEqual(plan, [{ textId: T2, date: '2026-11-10' }, { textId: T4, date: '2026-11-17' }],
      'spread: the skipped lesson comes again, the planned and held ones not; free slots from today, a taken and a cancelled one skipped');
    assert.deepEqual(m.distribute(lessons, [], [], '2026-10-26'), [], 'no slots — nothing to spread');

    assert.deepEqual(m.schoolYear(new Date(2026, 9, 26)), { from: '2026-09-01', until: '2027-06-25' }, 'the school year: 1 September to the last Friday of June');
    assert.deepEqual(m.schoolYear(new Date(2027, 2, 10)), { from: '2026-09-01', until: '2027-06-25' });
    assert.equal(m.firstWeekday('2026-09-01', 2), '2026-09-01', 'a Tuesday from a Tuesday');
    assert.equal(m.firstWeekday('2026-09-01', 1), '2026-09-07', 'the first Monday after');
    assert.equal(m.firstWeekday('2026-09-01', 7), '2026-09-06', 'the first Sunday after');
    assert.deepEqual([m.weekdayBit(1), m.weekdayBit(3), m.weekdayBit(7)], [1, 4, 64]);
    const occ = (itemId, at, status = 'planned') => ({ itemId, startsAt: at, endsAt: at, occurrenceAt: at, status });
    const found = m.lessonSlots([occ('B', '2026-10-27T08:00:00'), occ('A', '2026-10-20T08:00:00'), occ('A', '2026-10-27T08:00:00', 'cancelled')], new Set(['a']));
    assert.deepEqual(found.map((x) => [x.itemId, x.date, x.cancelled]), [['A', '2026-10-20', false], ['A', '2026-10-27', true]], 'slots: only the lesson series, in order, cancelled marked');
    const said = m.lessonMessage({ date: '2026-10-27', title: 'Stworzenie świata', summary: 'Rozmowa w grupach.', homework: 'Przeczytaj Rdz 1' });
    assert.ok(said.startsWith('Lekcja, wtorek') && said.includes('Stworzenie świata') && said.endsWith('Zadanie: Przeczytaj Rdz 1'), said);
    ok('school (0134): lesson and class lists, a program\'s lessons and classes, realizations per class, matrix cell, progress, journal rows, spreading over free slots, school year and weekdays, the message to a class');
    }
  }
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
