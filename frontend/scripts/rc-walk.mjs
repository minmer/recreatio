/**
 * Die Oberfläche gegen den laufenden Dienst nachgegangen.
 *
 * Kein Browser — aber auch keine Nachbildung: gebündelt und ausgeführt wird
 * der ECHTE Browser-Code, `rcAuth.ts` und `rcChat.ts`, mitsamt `rcFetch`,
 * Argon2id und den Base64url-Helfern. Ein zweites Mal von Hand
 * hingeschriebene Aufrufe hätten genau den Fehler, den sie finden sollen: sie
 * laufen mit der Zeit vom Ernstfall weg. Der erste Anlauf hier rief
 * `/auth/salt` als GET auf, weil ich es so in Erinnerung hatte — der Dienst
 * antwortete mit 405, und der Client hatte die ganze Zeit recht gehabt.
 *
 * Was Node nicht mitbringt, wird davorgesetzt: ein Keksglas, weil `fetch`
 * ohne Browser keine Sitzung hält, und ein `sessionStorage`, weil das
 * Öffnungsstück dort liegt.
 *
 *   dotnet run --project ../backend/Rc.Host      (in einem anderen Fenster)
 *   npm run rc:walk
 */

import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = process.env.RC_WALK_BASE ?? 'http://localhost:5292';

/** `/C:/…` aus einer file-URL zurück in einen Pfad, mit dem esbuild etwas anfängt. */
const asPath = (url) => new URL(url, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// -- Vorprüfung: läuft der Dienst überhaupt? ---------------------------------
// Ohne das schlägt jede einzelne Zeile fehl, und die Ausgabe erklärt nichts.

try {
  const health = await fetch(`${BASE}/rc/health`);
  const body = await health.json();
  if (body.healthy !== true) {
    console.error('Der Dienst antwortet, ist aber nicht gesund:');
    for (const c of body.checks ?? []) if (!c.passed) console.error(`  ${c.name}: ${c.detail}`);
    process.exit(1);
  }
} catch {
  console.error(`Kein Dienst unter ${BASE}.`);
  console.error('  dotnet run --project ../backend/Rc.Host');
  process.exit(1);
}

// -- Die Umgebung, die der Browser sonst stellt ------------------------------

const SHIM = `
// Ein Keksglas. \`fetch\` unter Node kennt keine Sitzung, und ohne Sitzung ist
// jeder geschützte Aufruf ein 401 — was wie ein Fehler in der Oberfläche
// aussähe und keiner wäre.
const jar = new Map();
const inner = globalThis.fetch;

globalThis.fetch = async (url, init = {}) => {
  const headers = new Headers(init.headers ?? {});
  if (jar.size > 0) headers.set('Cookie', [...jar].map(([k, v]) => k + '=' + v).join('; '));

  // Nur PFADE bekommen den Ursprung davor. Ein \`blob:\`- oder \`data:\`-Verweis
  // ist bereits vollständig; ihm den Ursprung voranzustellen macht daraus eine
  // Adresse, die es nirgends gibt.
  const target = String(url);
  const absolute = target.startsWith('/') ? ${JSON.stringify(BASE)} + target : target;
  const response = await inner(absolute, { ...init, headers });

  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';');
    const i = pair.indexOf('=');
    const name = pair.slice(0, i).trim();
    const value = pair.slice(i + 1).trim();
    // Ein gelöschtes Cookie ist kein leeres Cookie: fliegt es raus, muss es
    // auch aus dem Glas — sonst überlebt eine widerrufene Sitzung die Prüfung.
    if (value === '') jar.delete(name); else jar.set(name, value);
  }
  return response;
};

const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
  clear: () => void store.clear()
};
`;

// -- Die Prüfreihe selbst ----------------------------------------------------
//
// Die Einstiegsdatei liegt im Temp-Verzeichnis, und esbuild löst relative
// Importe relativ zu IHR auf — nicht zum Arbeitsverzeichnis. Also absolut.

const LIB = asPath('../src/rc/lib/');

const WALK = `
import { rcRegister, rcUnlock, rcMe, rcLock } from ${JSON.stringify(LIB + 'rcAuth')};
import {
  rcRoles, rcAreas, rcCreateArea, rcMembers, rcFeed, rcPost, rcHide, rcMarkRead,
  rcMessageState, rcEpochBreaks
} from ${JSON.stringify(LIB + 'rcChat')};
import { RcRequestError } from ${JSON.stringify(LIB + 'rcApi')};
import {
  rcTopics, rcCreateTopic, rcCloseTopic, rcLabelTopic,
  rcPolls, rcCreatePoll, rcVote, rcClosePoll, rcTallyHidden, rcTallyRows,
  rcAttachments, rcUpload, rcAttachmentUrl, rcDeleteAttachment,
  rcReact, RC_REACTION_AGREE, RC_REACTION_OBJECT
} from ${JSON.stringify(LIB + 'rcThreads')};
import {
  rcLedgerEntries, rcLedgerHead, rcLedgerVerdict, rcRecompute, rcAgrees,
  rcDecisions, rcCreateDecision, rcTransition
} from ${JSON.stringify(LIB + 'rcLedger')};

let passed = 0;
const failures = [];

function ok(name, condition, detail) {
  if (condition) { passed++; console.log('  OK   ' + name); }
  else {
    failures.push(name + (detail ? '\\n         ' + detail : ''));
    console.log('  FEHL ' + name);
  }
}

const stamp = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
const user = 'walk_' + stamp;
const pass = 'ein-hinreichend-langes-passwort-1';

// -- Anmelden ---------------------------------------------------------------

await rcRegister(user, pass);
ok('3.x   Anlegen geht ohne Einladung', true);

// Sperren und neu entsperren: der Weg, den jeder zweite Besuch nimmt.
await rcLock();
ok('3.9   Sperren nimmt den Bund', (await rcMe()).keysHeld === false);

await rcUnlock(user, pass, 'rc-walk');
const me = await rcMe();
ok('3.9   Entsperren gibt ihn zurueck', me.signedIn === true && me.keysHeld === true);

// -- Was RcChat beim Aufbau tut ---------------------------------------------

const { roles } = await rcRoles();
const person = roles.find((r) => r.kind === 'person');
ok('rcRoles() liefert eine persoenliche Rolle als Vorgabe', person !== undefined,
  JSON.stringify(roles).slice(0, 200));
ok('Sie traegt hasKey, worauf der Verfasser-Waehler hoert', typeof person?.hasKey === 'boolean');

ok('rcAreas() antwortet, und ein frisches Konto sieht nichts',
  (await rcAreas()).areas.length === 0);

const created = await rcCreateArea(person.roleId, 'Erster Bereich');
ok('rcCreateArea() legt an', typeof created.areaId === 'string');

const areaId = created.areaId;
const mine = (await rcAreas()).areas.find((a) => a.areaId === areaId);

ok('Der Bereich steht in der Liste', mine !== undefined);
ok('9.13  Der Titel geht wieder auf', mine?.title === 'Erster Bereich', JSON.stringify(mine));
ok('canWrite steht da, wie die Oberflaeche es liest', mine?.canWrite === true);
ok('Kein Vermerk fehlender Geschichte im eigenen Bereich',
  mine !== undefined && mine.readableEpochs === mine.currentEpoch, JSON.stringify(mine));

ok('rcMembers() antwortet', Array.isArray((await rcMembers(areaId)).members));
ok('rcFeed() antwortet auf einen leeren Bereich', (await rcFeed(areaId)).messages.length === 0);

// -- Schreiben und lesen -----------------------------------------------------

const posted = await rcPost(areaId, person.roleId, 'Hallo, Welt.');
ok('rcPost() schreibt', typeof posted.messageId === 'string');

await rcPost(areaId, person.roleId, 'Und das zu Protokoll.', true);
ok('7.8   Zu Protokoll nimmt der Dienst an', true);

const feed = await rcFeed(areaId);
const first = feed.messages.find((m) => m.messageId === posted.messageId);

ok('Der Beitrag kommt lesbar zurueck', first?.body === 'Hallo, Welt.', JSON.stringify(first));
ok('rcMessageState haelt ihn fuer Text', rcMessageState(first).kind === 'text');
ok('Alle Felder, die RcMessageRow liest, sind da',
  typeof first?.epoch === 'number' && typeof first?.version === 'number'
  && typeof first?.postedUtc === 'string' && typeof first?.authorRoleId === 'string',
  JSON.stringify(first));
ok('postedUtc laesst sich als Zeit lesen', !Number.isNaN(new Date(first.postedUtc).getTime()),
  String(first?.postedUtc));
ok('Eine Epoche allein zieht keinen Strich', rcEpochBreaks(feed.messages).size === 0);

// -- Lesestand und Zuruecknehmen ---------------------------------------------

await rcMarkRead(areaId, person.roleId);
ok('9.9   rcMarkRead() setzt den Lesestand', true);

await rcHide(posted.messageId, true);
const after = await rcFeed(areaId);
const stone = after.messages.find((m) => m.messageId === posted.messageId);

ok('15.9  Das Zurueckgenommene faellt NICHT aus der Liste', stone !== undefined);
ok('9.17  rcMessageState erkennt den Grabstein',
  stone !== undefined && rcMessageState(stone).kind === 'withdrawn', JSON.stringify(stone));

// -- 9.3 Themen -------------------------------------------------------------

const second = await rcPost(areaId, person.roleId, 'Und noch etwas dazu.');
const topic = await rcCreateTopic(areaId, 'Was zusammengehoert', [posted.messageId, second.messageId]);
ok('9.3   rcCreateTopic() legt ein Thema aus markierten Beitraegen an',
  typeof topic.topicId === 'string');

{
  const list = (await rcTopics(areaId)).topics;
  const one = list.find((x) => x.topicId === topic.topicId);
  ok('9.3   Das Thema steht in der Liste', one !== undefined);
  ok('9.3   Der Titel geht wieder auf', one?.title === 'Was zusammengehoert', JSON.stringify(one));
  ok('9.3   Es haelt beide Beitraege', one?.messageCount === 2, JSON.stringify(one));
  ok('9.3   Es ist offen', one?.closed === false);
}

await rcLabelTopic(topic.topicId, [3, 7]);
ok('9.3   rcLabelTopic() setzt Merkmale',
  (await rcTopics(areaId)).topics.find((x) => x.topicId === topic.topicId)
    ?.labels.slice().sort((a, b) => a - b).join(',') === '3,7');

await rcCloseTopic(topic.topicId);
ok('9.3.2 rcCloseTopic() schliesst',
  (await rcTopics(areaId)).topics.find((x) => x.topicId === topic.topicId)?.closed === true);

await rcCloseTopic(topic.topicId, true);
ok('9.3.2 Und dieselbe Tuer geht wieder auf',
  (await rcTopics(areaId)).topics.find((x) => x.topicId === topic.topicId)?.closed === false);

// -- 9.5 Fragen -------------------------------------------------------------

const open = await rcCreatePoll(areaId, 'Wann treffen wir uns?', 'single', 'immediate');
await rcVote(open.pollId, person.roleId, 'Dienstag');

{
  const one = (await rcPolls(areaId)).polls.find((x) => x.pollId === open.pollId);
  ok('9.5   rcCreatePoll() und rcVote() gehen durch', one !== undefined);
  ok('9.5   Die Frage geht wieder auf', one?.question === 'Wann treffen wir uns?', JSON.stringify(one));
  ok('9.5   Bei „sofort" steht die Auszaehlung da', rcTallyHidden(one) === false);
  ok('9.5   Und sie nennt die Antwort',
    rcTallyRows(one).some(([a, n]) => a === 'Dienstag' && n === 1),
    JSON.stringify(rcTallyRows(one)));
  ok('9.5   Die eigene Antwort kommt zurueck', one?.yourChoice === 'Dienstag', JSON.stringify(one));
}

// Umentscheiden: die letzte Stimme je Rolle zaehlt, aber die alte bleibt in
// der Kette stehen — deshalb steigt die Zahl der Stimmen, nicht die Auszaehlung.
await rcVote(open.pollId, person.roleId, 'Mittwoch');
{
  const one = (await rcPolls(areaId)).polls.find((x) => x.pollId === open.pollId);
  ok('9.5   Umentscheiden zaehlt die letzte Stimme', one?.yourChoice === 'Mittwoch');
  ok('9.5   Und die alte Antwort ist aus der Auszaehlung raus',
    rcTallyRows(one).every(([a]) => a !== 'Dienstag'), JSON.stringify(rcTallyRows(one)));
}

// DER Punkt von on_close: der Server gibt vorher NICHTS heraus, auch nicht an
// den, der gefragt hat. Eine Regel, die der Klient durchsetzt, ist keine Regel.
const sealed = await rcCreatePoll(areaId, 'Wie stehst du dazu?', 'single', 'on_close');
await rcVote(sealed.pollId, person.roleId, 'Dafuer');

{
  const one = (await rcPolls(areaId)).polls.find((x) => x.pollId === sealed.pollId);
  ok('9.5   Bei „erst beim Schliessen" haelt der Server die Auszaehlung zurueck',
    rcTallyHidden(one) === true && rcTallyRows(one).length === 0,
    JSON.stringify(one));
  ok('9.5   Auch dem Fragesteller gegenueber',
    one?.tally === null || one?.tally === undefined, JSON.stringify(one?.tally));
  ok('9.5   Dass ueberhaupt gestimmt wurde, verschweigt er nicht',
    one?.voteCount === 1, JSON.stringify(one));
}

await rcClosePoll(sealed.pollId);
{
  const one = (await rcPolls(areaId)).polls.find((x) => x.pollId === sealed.pollId);
  ok('9.5   Nach dem Schliessen liegt sie offen',
    rcTallyHidden(one) === false && rcTallyRows(one).some(([a, n]) => a === 'Dafuer' && n === 1),
    JSON.stringify(rcTallyRows(one)));
}

// -- 9.8 Stellungnahmen -----------------------------------------------------

await rcReact(second.messageId, person.roleId, RC_REACTION_AGREE);
{
  const m = (await rcFeed(areaId, 50, person.roleId)).messages
    .find((x) => x.messageId === second.messageId);
  ok('9.8   Der Verlauf traegt die eigene Haltung', m?.yourReaction === RC_REACTION_AGREE,
    JSON.stringify(m?.yourReaction));
  ok('9.8   Und die Auszaehlung', m?.reactions?.['1'] === 1, JSON.stringify(m?.reactions));
  ok('15.9  Was nicht vorkommt, steht nicht drin',
    Object.keys(m?.reactions ?? {}).length === 1, JSON.stringify(m?.reactions));
}

await rcReact(second.messageId, person.roleId, RC_REACTION_OBJECT);
{
  const m = (await rcFeed(areaId, 50, person.roleId)).messages
    .find((x) => x.messageId === second.messageId);
  ok('9.8   Umentscheiden haeuft nicht an',
    m?.yourReaction === RC_REACTION_OBJECT && m?.reactions?.['1'] === undefined,
    JSON.stringify(m?.reactions));
}

await rcReact(second.messageId, person.roleId, null);
{
  const m = (await rcFeed(areaId, 50, person.roleId)).messages
    .find((x) => x.messageId === second.messageId);
  ok('9.8   Und sie laesst sich ganz zuruecknehmen',
    (m?.yourReaction ?? null) === null && Object.keys(m?.reactions ?? {}).length === 0,
    JSON.stringify(m));
}

// -- 9.10 Anhaenge ----------------------------------------------------------

{
  const before = (await rcFeed(areaId, 50, person.roleId)).messages
    .find((x) => x.messageId === second.messageId);
  ok('9.10  Ohne Anhang zaehlt der Verlauf null', before?.attachmentCount === 0);
}

const file = new File([new Uint8Array([80, 68, 70, 45, 1, 2, 3])], 'protokoll.bin',
  { type: 'application/octet-stream' });

const uploaded = await rcUpload(second.messageId, file);
ok('9.10  rcUpload() nimmt eine Datei an', typeof uploaded.attachmentId === 'string',
  JSON.stringify(uploaded));

{
  const list = (await rcAttachments(second.messageId)).attachments;
  ok('9.10  Sie steht in der Liste', list.length === 1);
  ok('9.10  Der Dateiname geht wieder auf', list[0]?.fileName === 'protokoll.bin',
    JSON.stringify(list[0]));
  ok('9.10  Die Groesse stimmt', list[0]?.sizeBytes === 7, JSON.stringify(list[0]));

  const m = (await rcFeed(areaId, 50, person.roleId)).messages
    .find((x) => x.messageId === second.messageId);
  ok('9.10  Der Verlauf zaehlt sie mit, ohne dass jemand nachfragen muss',
    m?.attachmentCount === 1, JSON.stringify(m?.attachmentCount));
}

// Der Inhalt kommt entschluesselt zurueck — Byte fuer Byte derselbe.
{
  const url = await rcAttachmentUrl(uploaded.attachmentId);
  const back = new Uint8Array(await (await fetch(url)).arrayBuffer());
  URL.revokeObjectURL(url);
  ok('9.10  Der Inhalt kommt Byte fuer Byte zurueck',
    back.length === 7 && back[0] === 80 && back[6] === 3,
    Array.from(back).join(','));
}

await rcDeleteAttachment(uploaded.attachmentId);
ok('9.10  Und laesst sich wieder entfernen',
  (await rcAttachments(second.messageId)).attachments.length === 0);

// -- Kapitel 11: Beschluesse ------------------------------------------------

const proposal = await rcCreateDecision(areaId, person.roleId,
  'Der Rat beschliesst, das Protokoll oeffentlich nachrechenbar zu machen.');

ok('11.x  rcCreateDecision() schlaegt vor', typeof proposal.decisionId === 'string',
  JSON.stringify(proposal));

{
  const one = (await rcDecisions(areaId)).decisions.find((d) => d.decisionId === proposal.decisionId);
  ok('11.x  Der Beschluss steht in der Liste', one !== undefined);
  ok('11.x  Er beginnt bei „vorgeschlagen"', one?.state === 'proposed', JSON.stringify(one?.state));
  ok('11.x  Der Text geht wieder auf',
    one?.body?.startsWith('Der Rat beschliesst') === true, JSON.stringify(one?.body));

  // Die Tafel kommt vom Dienst, nicht aus der Oberflaeche. Schriebe die
  // Oberflaeche sie ab, boete sie irgendwann Wege an, die abgewiesen werden.
  ok('11.x  Die Sicht nennt die offenen Wege',
    one?.allowedNext?.slice().sort().join(',') === 'open,rejected',
    JSON.stringify(one?.allowedNext));
}

await rcTransition(proposal.decisionId, person.roleId, 'open', 'Zur Beratung freigegeben.');
await rcTransition(proposal.decisionId, person.roleId, 'accepted', 'Einstimmig angenommen.');

{
  const one = (await rcDecisions(areaId)).decisions.find((d) => d.decisionId === proposal.decisionId);
  ok('11.x  Der vorgesehene Weg wird gegangen', one?.state === 'accepted');
  ok('11.x  Der Weg dahin steht mit Begruendungen da',
    one?.history?.length === 2 && one.history[1].reason === 'Einstimmig angenommen.',
    JSON.stringify(one?.history));
  ok('11.x  Von „angenommen" fuehrt nur ein Weg weiter',
    one?.allowedNext?.join(',') === 'reopened', JSON.stringify(one?.allowedNext));
}

// Ein uebersprungener Zustand wird abgewiesen — und die Oberflaeche haette ihn
// gar nicht erst angeboten, weil er nicht in allowedNext stand.
try {
  await rcTransition(proposal.decisionId, person.roleId, 'open', 'Abgekuerzt.');
  ok('11.x  Ein uebersprungener Zustand wird abgewiesen', false, 'Der Aufruf ging durch.');
} catch (e) {
  ok('11.x  Ein uebersprungener Zustand wird abgewiesen', e instanceof RcRequestError,
    String(e));
}

// -- Kapitel 7: die Kette, im Browser nachgerechnet -------------------------

const ledgerId = mine.ledgerId;
ok('7.4   Der Bereich nennt seine Kette', typeof ledgerId === 'string' && ledgerId.length > 0,
  String(ledgerId));

const chain = (await rcLedgerEntries(ledgerId)).entries;

ok('7.4   Die Kette hat Eintraege', chain.length >= 3, String(chain.length));
ok('22.6  Der erste Eintrag zeigt auf 32 Nullen',
  chain[0]?.previousHash === '0'.repeat(64), String(chain[0]?.previousHash));
// Der erste Eintrag dieser Kette ist die zu Protokoll gegebene NACHRICHT, denn
// sie kam vor dem Beschluss. Welche Sorte wo steht, haengt an der Reihenfolge
// der Handlungen — die Pruefung sucht deshalb den Eintrag, statt eine Stelle
// zu raten. Eine Pruefung, die an einer Position haengt, prueft die
// Reihenfolge der Pruefung und nicht die Sache.
ok('7.8   Der zu Protokoll gegebene Beitrag steht in der Kette',
  chain.some((e) => e.payloadCanonical.includes('"kind":"message.posted"')),
  chain.map((e) => e.payloadCanonical.slice(0, 60)).join(" | "));

ok('24.3  Ausgeliefert werden die gespeicherten kanonischen Bytes',
  chain.some((e) => e.payloadCanonical.includes('"kind":"decision.created"'))
  && chain.some((e) => e.payloadCanonical.includes('"kind":"decision.transition"')),
  chain.map((e) => e.payloadCanonical.slice(0, 60)).join(" | "));

// RFC 8785: die Schluessel stehen sortiert. Das ist keine Kosmetik — genau
// darauf beruht, dass zwei Seiten denselben Hash errechnen.
ok('24.3  Die kanonische Form hat sortierte Schluessel',
  chain.every((e) => {
    const keys = Object.keys(JSON.parse(e.payloadCanonical));
    return keys.join(",") === [...keys].sort().join(",");
  }));

// DER Punkt: der Browser rechnet selbst nach, statt dem Dienst zu glauben.
const own = rcRecompute(chain);
ok('7.5   Der Browser rechnet die Kette selbst nach — und sie geht auf',
  own.intact === true && own.checked === chain.length, JSON.stringify(own));

const theirs = await rcLedgerVerdict(ledgerId);
ok('7.5   Der Dienst sagt dasselbe ueber seine Kette',
  theirs.intact === true, JSON.stringify(theirs));
ok('7.5   Beide Antworten stimmen ueberein', rcAgrees(own, theirs) === true,
  JSON.stringify({ own, theirs }));

// Und die eigene Rechnung ist nicht blind: kippt man ein Glied, faellt es auf.
{
  const tampered = chain.map((e, i) => (i === 1 ? { ...e, entryHash: 'gefaelscht' } : e));
  const check = rcRecompute(tampered);
  ok('7.5   Ein gekipptes Glied faellt der eigenen Rechnung auf',
    check.intact === false && check.reason === 'chain.broken_link', JSON.stringify(check));

  // Und dann sind sich beide UNEINIG — genau der Fall, fuer den die Ansicht da ist.
  ok('7.5   Bei Abweichung sind sich beide uneinig', rcAgrees(check, theirs) === false);
}

// 7.4.1 — Der Kopf ist ohne Konto abrufbar. Ein Zeuge, den der Betreiber erst
// zulassen muss, ist kein Zeuge.
{
  const head = await rcLedgerHead(ledgerId);
  ok('7.4.1 Der Kettenkopf nennt Nummer und Hash',
    typeof head.sequence === 'number' && typeof head.hash === 'string' && head.hash.length === 64,
    JSON.stringify(head));
  ok('7.4   Der Kopf stimmt mit dem letzten Eintrag ueberein',
    head.hash === chain[chain.length - 1]?.entryHash
    && head.sequence === chain[chain.length - 1]?.sequence,
    JSON.stringify({ head, last: chain[chain.length - 1]?.sequence }));
}

// -- Ohne Schluessel geht nichts ---------------------------------------------

await rcLock();
try {
  await rcFeed(areaId);
  ok('3.9   Gesperrt gibt der Dienst keinen Verlauf heraus', false, 'Der Aufruf ging durch.');
} catch (e) {
  ok('3.9   Gesperrt gibt der Dienst keinen Verlauf heraus',
    e instanceof RcRequestError && e.code === 'session.unlock_required',
    e instanceof RcRequestError ? e.code : String(e));
}

// -- Ergebnis ----------------------------------------------------------------

console.log('');
if (failures.length > 0) {
  console.log(failures.map((f) => '  ' + f).join('\\n'));
  console.log('');
  throw new Error(passed + ' bestanden, ' + failures.length + ' fehlgeschlagen');
}
console.log(passed + ' bestanden, 0 fehlgeschlagen');
`;

// -- Bündeln und laufen lassen -----------------------------------------------

const out = await mkdtemp(join(tmpdir(), 'rc-walk-'));
const entry = join(out, 'walk.ts');
await writeFile(entry, SHIM + WALK, 'utf8');

let failed = false;

try {
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    outfile: join(out, 'walk.mjs'),
    absWorkingDir: asPath('..'),
    define: { 'import.meta.env': '{}' },
    logLevel: 'warning'
  });

  await import(pathToFileURL(join(out, 'walk.mjs')).href);
} catch (e) {
  failed = true;
  console.error(e instanceof Error ? e.message : e);
} finally {
  await rm(out, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
