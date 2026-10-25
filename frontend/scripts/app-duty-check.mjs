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
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
