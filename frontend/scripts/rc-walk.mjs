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
let jar = new Map();
let store = new Map();
const inner = globalThis.fetch;

// Zwei Konten, zwei Keksglaeser. Eine Einladung fuehrt per Bau von einem
// Menschen zu einem anderen — mit nur einem Glas liesse sich dieser Weg
// nicht nachgehen, und genau er ist das Interessante.
globalThis.__rcJars = { a: new Map(), b: new Map() };
globalThis.__rcStores = { a: new Map(), b: new Map() };

// Mitwechseln muss auch der Ablageort des Oeffnungsstuecks. Bliebe er
// gemeinsam, ueberschriebe Brunos Entsperren das von Anna, und der Wechsel
// zurueck fuehrte in eine Sitzung ohne Schluessel — was wie ein Fehler in der
// Plattform aussaehe und einer im Pruefgeruest waere.
globalThis.__rcAs = (who) => {
  jar = globalThis.__rcJars[who];
  store = globalThis.__rcStores[who];
};

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


globalThis.__rcAs("a");

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
  rcMessageState, rcEpochBreaks, rcCreateRole
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
import {
  rcCreateInvitation, rcInvitations, rcRevokeInvitation, rcPeekInvitation,
  rcRedeemInvitation, rcInviteLink, rcSecretFromHash, rcInviteSpent, rcInviteOpened,
  rcMembers as rcMembersOf, rcRemoveMember, rcAddMember
} from ${JSON.stringify(LIB + 'rcInvite')};
import {
  rcEvents, rcEvent, rcCreateEvent, rcAddPage, rcAddPart, rcAddField, rcPublishEvent,
  rcSubmitRegistration, rcSubmitAsMember, rcRegistrations, rcWithdrawRegistration,
  rcTakesRegistrations, rcAllParts, rcMissingRequired
} from ${JSON.stringify(LIB + 'rcEvents')};
import {
  rcParishes, rcCreateParish, rcAddMass, rcAddIntention, rcAddOffering,
  rcMasses, rcIntentions, rcIntentionSealed, rcMassesByDay
} from ${JSON.stringify(LIB + 'rcParish')};
import {
  rcLibraries, rcCreateLibrary, rcNodes, rcAddNode, rcAddEdge,
  rcSearchGraph, rcSearchLoaded, rcNodeLabel,
  rcSegments, rcSetSegments, rcSegmentText, rcRangeText
} from ${JSON.stringify(LIB + 'rcGraph')};
import {
  rcCalendars, rcCreateCalendar, rcAddItem, rcOccurrences,
  rcCancelOccurrence, rcMoveOccurrence, rcOccurrenceLabel, rcByDay, rcOverlaps, rcSameInstant
} from ${JSON.stringify(LIB + 'rcCalendar')};
import {
  rcConfirmationGroups, rcCreateConfirmationGroup, rcCandidates, rcAddCandidate,
  rcAddCandidateNote, rcWithdrawCandidate, rcMeetingSlots, rcAddMeetingSlot, rcBookSlot,
  rcFreeSeats, rcSlotFull, rcMissingSteps, rcCandidateLabel, rcOutstanding
} from ${JSON.stringify(LIB + 'rcConfirmation')};

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

// -- 3.12: Der Weg hinein ----------------------------------------------------
//
// Zwei echte Konten. Anna laedt ein, Bruno kommt herein.
//
// **Eingeladen wird zu einer ROLLE, nicht zu einem Bereich.** Der erste Anlauf
// hier lud zu Annas PERSOENLICHER Rolle ein — und Bruno konnte danach die
// ganze Geschichte lesen. Kein Fehler im Dienst: eine Einladung teilt die
// Rolle mitsamt allem, was an ihr haengt. Wer seine persoenliche Rolle
// verschickt, verschickt sein halbes Konto.
//
// Der richtige Weg: eine Gruppenrolle anlegen, DIESE in den Bereich aufnehmen,
// und zu ihr einladen. Dann bekommt der Neue genau das, was die Gruppe hat.

const group = await rcCreateRole(person.roleId, 'group', 'Der Rat');
ok('21.6  rcCreateRole() legt eine Gruppenrolle an', typeof group.roleId === 'string',
  JSON.stringify(group));

// Erst JETZT in den Bereich aufnehmen — die bisherigen Beitraege liegen davor
// und bleiben damit ausserhalb dessen, was die Gruppe oeffnen kann.
await rcAddMember(areaId, group.roleId, 'write', false);
ok('9.x   Die Gruppe wird aufgenommen und schneidet eine Epoche', true);

await rcPost(areaId, person.roleId, 'Nach der Aufnahme der Gruppe gesagt.');

const issued = await rcCreateInvitation(group.roleId, {
  label: 'Fuer Bruno',
  daysValid: 30,
  maxUses: 1
});

ok('3.12  rcCreateInvitation() stellt aus', typeof issued.secret === 'string' && issued.secret.length > 0);
ok('3.12  Das Geheimnis kommt EINMAL zurueck und steht nicht in der Liste',
  (await rcInvitations()).invitations.every((i) => !JSON.stringify(i).includes(issued.secret)),
  'Das Geheimnis stand in der Liste.');

{
  const one = (await rcInvitations()).invitations.find((i) => i.invitationId === issued.invitationId);
  ok('3.12  Die Einladung steht in der Liste', one !== undefined);
  ok('3.12  Mit ihrem Vermerk', one?.label === 'Fuer Bruno', JSON.stringify(one));
  ok('3.12  Noch ungenutzt', one?.useCount === 0 && rcInviteSpent(one) === false, JSON.stringify(one));
  ok('10.3  Und noch ungeoeffnet', rcInviteOpened(one) === false);
}

const link = rcInviteLink(issued.secret, 'https://example.org/');
const backOut = rcSecretFromHash(link);
ok('3.12  Der Link traegt das Geheimnis im Fragment', link.includes('#/new/invite/'));
ok('3.12  Und es kommt unveraendert wieder heraus', backOut === issued.secret,
  String(backOut).slice(0, 40) + ' vs ' + issued.secret.slice(0, 40));

// -- Bruno: ein eigenes Konto, ohne Einladung ---------------------------------

globalThis.__rcAs('b');

const brunoName = 'walk_b_' + stamp;
await rcRegister(brunoName, pass);
await rcUnlock(brunoName, pass, 'rc-walk-b');

ok('3.x   Bruno meldet sich ganz normal an — ohne Link',
  (await rcMe()).keysHeld === true);

ok('3.4   Und sieht den fremden Bereich nicht',
  (await rcAreas()).areas.every((a) => a.areaId !== areaId));

{
  const peek = await rcPeekInvitation(backOut);
  ok('3.12  Ansehen geht, ohne einzuloesen', typeof peek.purpose === 'string', JSON.stringify(peek));
  ok('3.12  Und nennt, wohinein der Link fuehrt', peek.label === 'Fuer Bruno', JSON.stringify(peek));
}

globalThis.__rcAs('a');
{
  const one = (await rcInvitations()).invitations.find((i) => i.invitationId === issued.invitationId);
  ok('10.3  Das erste Oeffnen wird festgehalten', rcInviteOpened(one) === true,
    JSON.stringify(one?.firstOpenedUtc));
}

// -- Einloesen ----------------------------------------------------------------

globalThis.__rcAs('b');
{
  const redeemed = await rcRedeemInvitation(backOut);
  ok('3.12  rcRedeemInvitation() loest ein',
    typeof redeemed.roleId === 'string' && redeemed.alreadyRedeemed === false,
    JSON.stringify(redeemed));
}

ok('3.12  Und jetzt sieht Bruno den Bereich',
  (await rcAreas()).areas.some((a) => a.areaId === areaId));

ok('3.12  Er haelt jetzt die Gruppenrolle',
  (await rcRoles()).roles.some((r) => r.roleId === group.roleId),
  JSON.stringify((await rcRoles()).roles.map((r) => r.kind)));

// DER Punkt des Epochenmodells: was vor der Aufnahme der Gruppe gesagt wurde,
// bleibt zu. Nicht weil es versteckt wird, sondern weil der Schluessel fehlt.
{
  const seen = (await rcAreas()).areas.find((a) => a.areaId === areaId);
  ok('9.x   Er sieht nicht die ganze Geschichte',
    seen.readableEpochs < seen.currentEpoch,
    JSON.stringify({ lesbar: seen.readableEpochs, gesamt: seen.currentEpoch }));

  const brunoFeed = await rcFeed(areaId, 50);
  const kinds = brunoFeed.messages.map((m) => rcMessageState(m).kind);

  ok('15.9  Das Aeltere steht da, unlesbar, mit Grund',
    kinds.includes('sealed'), JSON.stringify(kinds));
  ok('15.9  Und das Neuere ist lesbar', kinds.includes('text'), JSON.stringify(kinds));

  // Der Strich gehoert genau dorthin, wo der Sprung passiert.
  ok('9.x   Die Epochengrenze wird sichtbar', rcEpochBreaks(brunoFeed.messages).size > 0);
}

// -- Ein Einmal-Link ist danach verbraucht ------------------------------------
//
// Ein schon Eingeloester gilt als drin, solange Einloesungen uebrig sind. Ist die
// Hoechstzahl erreicht, weist der Dienst ab — auch denselben Menschen. Das ist
// richtig so: die Zahl begrenzt Einloesungen, nicht Personen.

try {
  await rcRedeemInvitation(backOut);
  ok('3.12  Ein verbrauchter Einmal-Link wird abgewiesen', false, 'Der Aufruf ging durch.');
} catch (e) {
  ok('3.12  Ein verbrauchter Einmal-Link wird abgewiesen', e instanceof RcRequestError,
    String(e));
}

globalThis.__rcAs('a');
{
  const one = (await rcInvitations()).invitations.find((i) => i.invitationId === issued.invitationId);
  ok('3.12  Und gilt als verbraucht',
    one?.useCount === 1 && rcInviteSpent(one) === true, JSON.stringify(one));
}

// -- Zurueckziehen ------------------------------------------------------------

const doomed = await rcCreateInvitation(group.roleId, { label: 'Wird zurueckgezogen', maxUses: 1 });
await rcRevokeInvitation(doomed.invitationId);

ok('3.12  Eine zurueckgezogene Einladung faellt aus der Liste',
  (await rcInvitations()).invitations.every((i) => i.invitationId !== doomed.invitationId));

globalThis.__rcAs('b');
try {
  await rcRedeemInvitation(doomed.secret);
  ok('3.12  Und laesst sich nicht mehr einloesen', false, 'Der Aufruf ging durch.');
} catch (e) {
  ok('3.12  Und laesst sich nicht mehr einloesen', e instanceof RcRequestError, String(e));
}

// -- Entfernen sperrt fuer die Zukunft, nicht rueckwirkend --------------------

globalThis.__rcAs('a');
await rcRemoveMember(areaId, group.roleId);
await rcPost(areaId, person.roleId, 'Nach dem Weggang der Gruppe gesagt.');
ok('9.x   Entfernen geht', true);

globalThis.__rcAs('b');
{
  const stillThere = (await rcAreas()).areas.find((a) => a.areaId === areaId);

  // Er sieht den Bereich weiter — er hat ja die alten Schluessel noch. Was er
  // NICHT mehr bekommt, ist das Neue. Rueckwirkend auszusperren ginge nur,
  // indem man alles neu verschluesselt, und dann waere die alte Fassung
  // trotzdem in der Welt.
  if (stillThere !== undefined) {
    const after = await rcFeed(areaId, 50);
    ok('9.x   Das nach dem Weggang Gesagte bleibt ihm zu',
      after.messages.every((m) => m.body !== 'Nach dem Weggang der Gruppe gesagt.'),
      JSON.stringify(after.messages.map((m) => rcMessageState(m).kind)));
  } else {
    ok('9.x   Wer gegangen ist, erreicht den Bereich nicht mehr', true);
  }
}

globalThis.__rcAs('a');

// -- 14.x: Veranstaltungen ---------------------------------------------------
//
// Der Bereich von oben traegt jetzt eine Veranstaltung. Der interessante Teil
// steht ganz unten: jemand OHNE Konto meldet sich an, sein Browser versiegelt
// selbst, und der Dienst kann nichts davon oeffnen.

const eventSlug = 'pfarrfest-' + stamp;
const made = await rcCreateEvent(areaId, eventSlug, 'Pfarrfest', { isPublic: true });

ok('14.x  rcCreateEvent() legt an', typeof made.eventId === 'string', JSON.stringify(made));
ok('14.x  Die Adresse wird zur Kleinschreibung gezogen', made.slug === eventSlug.toLowerCase());
ok('14.x  Sie beginnt als Entwurf', made.lifecycle === 'draft', String(made.lifecycle));

const page = await rcAddPage(made.eventId, 'anmeldung', 'Anmeldung');
ok('14.x  rcAddPage() legt eine Seite an', typeof page.pageId === 'string');

// Ein oeffentlicher Teil: Klartext, von jedem lesbar.
const intro = await rcAddPart(page.pageId, 'text', {
  isPublic: true, title: 'Herzlich willkommen', intro: 'Am zweiten Sonntag im September.'
});
ok('14.x  Ein oeffentlicher Teil entsteht', intro.isPublic === true, JSON.stringify(intro));

// Ein interner: versiegelt unter dem Epochenschluessel des Bereichs.
const notes = await rcAddPart(page.pageId, 'text', {
  isPublic: false, title: 'Interne Absprachen', intro: 'Der Grill kommt von Bruno.'
});
ok('14.x  Ein interner Teil entsteht', notes.isPublic === false, JSON.stringify(notes));

const form = await rcAddPart(page.pageId, 'form', { isPublic: true, title: 'Anmeldung' });
ok('14.x  Ein Formularteil entsteht', form.kind === 'form');

const nameField = await rcAddField(form.partId, 'text', 'Wie heisst du?', {
  isRequired: true, identityRole: 'name'
});
ok('14.x  rcAddField() legt ein Feld an', typeof nameField.fieldId === 'string');

// 12.9 — Die VORGABE ist die strengere. Wer nichts sagt, bekommt "special".
ok('12.9  Ohne Angabe gilt die strengere Klasse',
  nameField.dataClass === 'special', String(nameField.dataClass));

const dietField = await rcAddField(form.partId, 'textarea', 'Unvertraeglichkeiten?', {
  dataClass: 'special'
});

const seatField = await rcAddField(form.partId, 'select', 'Wo moechtest du sitzen?', {
  options: ['drinnen', 'draussen'], dataClass: 'normal'
});
ok('12.9  Eine ausdrueckliche Klasse wird uebernommen',
  seatField.dataClass === 'normal', String(seatField.dataClass));

// Eine Auswahl ohne Auswahlmoeglichkeiten wird abgewiesen — sonst haette man
// ein Feld, das niemand ausfuellen kann.
try {
  await rcAddField(form.partId, 'select', 'Leere Auswahl');
  ok('14.x  Eine Auswahl ohne Moeglichkeiten wird abgewiesen', false, 'ging durch');
} catch (e) {
  ok('14.x  Eine Auswahl ohne Moeglichkeiten wird abgewiesen', e instanceof RcRequestError);
}

// -- Was ein Mitglied sieht --------------------------------------------------

{
  const view = await rcEvent(eventSlug);
  const parts = rcAllParts(view);

  ok('14.x  rcEvent() liefert die Veranstaltung', view.slug === eventSlug);
  ok('14.x  Der Leser gehoert dazu', view.mayRead === true);
  ok('14.x  Er sieht beide Teile', parts.length === 3, String(parts.length));

  const internal = parts.find((x) => x.partId === notes.partId);
  ok('14.x  Der interne Teil geht fuer ihn auf',
    internal?.title === 'Interne Absprachen', JSON.stringify(internal?.title));

  const publicPart = parts.find((x) => x.partId === intro.partId);
  ok('14.x  Der oeffentliche liegt im Klartext',
    publicPart?.title === 'Herzlich willkommen', JSON.stringify(publicPart?.title));

  ok('14.x  Das Formular bringt seine Felder mit',
    parts.find((x) => x.partId === form.partId)?.fields.length === 3);

  // Noch Entwurf: nimmt nichts entgegen, und die Oberflaeche kann das SAGEN.
  ok('14.x  Ein Entwurf nimmt keine Anmeldungen entgegen',
    rcTakesRegistrations(view) === false);
}

// Ein Entwurf weist Anmeldungen ab.
try {
  await rcSubmitAsMember(form.partId, person.roleId, new Map([[nameField.fieldId, 'Anna']]));
  ok('14.x  Der Entwurf weist eine Anmeldung ab', false, 'ging durch');
} catch (e) {
  ok('14.x  Der Entwurf weist eine Anmeldung ab', e instanceof RcRequestError);
}

await rcPublishEvent(made.eventId);
ok('14.x  rcPublishEvent() veroeffentlicht', true);

// -- Was ein FREMDER sieht ---------------------------------------------------

globalThis.__rcAs('b');
{
  const view = await rcEvent(eventSlug);
  const parts = rcAllParts(view);

  ok('14.x  Ein Fremder erreicht die veroeffentlichte Seite', view.slug === eventSlug);
  ok('14.x  Aber er gehoert nicht dazu', view.mayRead === false);

  // Der interne Teil faellt fuer ihn GANZ weg — nicht als "unlesbar". Ihm zu
  // zeigen, wie viele interne Abschnitte es gibt, waere eine Auskunft ueber
  // die Vorbereitung.
  ok('3.4   Der interne Teil ist fuer ihn gar nicht da',
    parts.every((x) => x.partId !== notes.partId), JSON.stringify(parts.map((x) => x.kind)));

  ok('14.x  Das Oeffentliche sieht er', parts.some((x) => x.title === 'Herzlich willkommen'));
  ok('14.x  Und das Formular mit seinen Feldern',
    parts.find((x) => x.partId === form.partId)?.fields.length === 3);

  ok('14.x  Jetzt nimmt sie Anmeldungen entgegen', rcTakesRegistrations(view) === true);
  ok('14.x  Der Annahmeschluessel reist mit dem Formular',
    typeof view.intakePublicKey === 'string' && view.intakePublicKey.length > 100,
    String(view.intakePublicKey).slice(0, 40));

  // Pflichtangaben faengt die Oberflaeche vorher ab.
  const formPart = parts.find((x) => x.partId === form.partId);
  ok('14.x  Fehlende Pflichtangaben faellt der Oberflaeche auf',
    rcMissingRequired(formPart.fields, new Map()).length === 1);
  ok('14.x  Mit Angabe fehlt nichts',
    rcMissingRequired(formPart.fields, new Map([[nameField.fieldId, 'Bruno']])).length === 0);
}

// -- DER PUNKT: anmelden ohne Konto, versiegelt im eigenen Browser -----------

const anonId = crypto.randomUUID();
let claim = null;

{
  const view = await rcEvent(eventSlug);

  const answers = new Map([
    [nameField.fieldId, 'Christa Ohne-Konto'],
    [dietField.fieldId, 'Nussallergie'],
    [seatField.fieldId, 'draussen']
  ]);

  const sent = await rcSubmitRegistration(form.partId, anonId, view.intakePublicKey, answers);

  claim = sent.claim;
  ok('14.x  Eine Anmeldung ohne Konto geht durch', sent.registrationId === anonId,
    JSON.stringify(sent));
  ok('10.3.1 Der Beleg kommt EINMAL zurueck',
    typeof claim === 'string' && claim.length > 20, String(claim));
}

// Dieselbe Kennung ein zweites Mal wird abgewiesen — sonst liesse sich eine
// fremde Anmeldung ueberschreiben.
try {
  const view = await rcEvent(eventSlug);
  await rcSubmitRegistration(form.partId, anonId, view.intakePublicKey,
    new Map([[nameField.fieldId, 'Jemand anders']]));
  ok('14.x  Dieselbe Kennung zweimal wird abgewiesen', false, 'ging durch');
} catch (e) {
  ok('14.x  Dieselbe Kennung zweimal wird abgewiesen', e instanceof RcRequestError);
}

// -- Und die Vorbereitenden lesen sie ----------------------------------------

globalThis.__rcAs('a');
{
  const list = (await rcRegistrations(form.partId)).registrations;
  const mine = list.find((r) => r.registrationId === anonId);

  ok('14.x  Die Anmeldung steht in der Liste', mine !== undefined, String(list.length));

  // DAS ist der Beweis, dass Browser und Kernel dasselbe Format sprechen.
  ok('21.4  Was der fremde Browser versiegelt hat, geht hier auf',
    mine?.unreadable === null || mine?.unreadable === undefined,
    JSON.stringify(mine?.unreadable));

  const byLabel = new Map((mine?.answers ?? []).map((a) => [a.label, a.value]));
  ok('14.x  Der Name kommt zurueck', byLabel.get('Wie heisst du?') === 'Christa Ohne-Konto',
    JSON.stringify([...byLabel]));
  ok('14.x  Und die uebrigen Antworten auch',
    byLabel.get('Unvertraeglichkeiten?') === 'Nussallergie'
    && byLabel.get('Wo moechtest du sitzen?') === 'draussen',
    JSON.stringify([...byLabel]));

  // 12.9 — Die Klasse reist MIT der Antwort, damit beim Ansehen sichtbar ist,
  // welche Spalte eine besondere Kategorie traegt.
  const diet = (mine?.answers ?? []).find((a) => a.label === 'Unvertraeglichkeiten?');
  ok('12.9  Die Datenklasse reist mit der Antwort', diet?.dataClass === 'special',
    JSON.stringify(diet));
}

// -- Ruecknahme: die Werte sind weg, die Zeile bleibt ------------------------

{
  const before = (await rcRegistrations(form.partId)).registrations.length;

  globalThis.__rcAs('b');
  const gone = await rcWithdrawRegistration(anonId, claim);
  ok('12.3.2 Mit dem Beleg laesst sich zuruecknehmen', gone.valuesDestroyed === 3,
    JSON.stringify(gone));

  globalThis.__rcAs('a');
  const after = (await rcRegistrations(form.partId)).registrations;
  const stone = after.find((r) => r.registrationId === anonId);

  ok('12.3.2 Die Zeile bleibt stehen', after.length === before, after.length + ' vs ' + before);
  ok('12.3.2 Sie ist als zurueckgenommen vermerkt', stone?.withdrawn === true);
  ok('12.3.2 Und die Werte sind vernichtet',
    (stone?.answers ?? []).every((a) => a.value === null || a.value === undefined),
    JSON.stringify(stone?.answers));
}

// -- Ein Mitglied meldet sich an: derselbe Weg, anderer Schluessel -----------

{
  const sent = await rcSubmitAsMember(form.partId, person.roleId,
    new Map([[nameField.fieldId, 'Anna Mitglied'], [seatField.fieldId, 'drinnen']]));

  ok('14.x  Ein Mitglied meldet sich ueber den inneren Weg an',
    typeof sent.registrationId === 'string');
  ok('14.x  Und bekommt KEINEN Beleg — es hat ja ein Konto',
    sent.claim === null || sent.claim === undefined, JSON.stringify(sent.claim));

  const mine = (await rcRegistrations(form.partId)).registrations
    .find((r) => r.registrationId === sent.registrationId);

  ok('14.x  Auch sie geht wieder auf',
    (mine?.answers ?? []).some((a) => a.value === 'Anna Mitglied'),
    JSON.stringify(mine?.answers));
}

// -- Die Veranstaltung steht in der Liste ------------------------------------

ok('14.x  rcEvents() nennt die Veranstaltung',
  (await rcEvents()).events.some((e) => e.eventId === made.eventId));

// -- Pfarrei: EINE Zeile, zwei Sichtbarkeiten --------------------------------
//
// Bei den Veranstaltungen trennt die Sichtbarkeit ganze Abschnitte. Hier
// trennt sie FELDER derselben Zeile — und genau das wird nachgegangen: der
// Plan ist oeffentlich, der interne Vermerk nicht, und beide stehen
// nebeneinander.

const parishArea = (await rcCreateArea(person.roleId, 'Pfarrbuero')).areaId;
const parishSlug = 'st-martin-' + stamp;

const parish = await rcCreateParish(parishArea, parishSlug, 'Pfarrei St. Martin', 'Limanowa');
ok('14.x  rcCreateParish() legt an', typeof parish.parishId === 'string', JSON.stringify(parish));
ok('14.x  Die Adresse wird gezogen', parish.slug === parishSlug);

const sunday = new Date(Date.now() + 3 * 86400000).toISOString();
const mass = await rcAddMass(parish.parishId, sunday, 'Pfarrkirche', {
  title: 'Sonntagsmesse', durationMinutes: 60
});
ok('14.x  rcAddMass() setzt einen Termin', typeof mass.massId === 'string');

const intention = await rcAddIntention(parish.parishId, 'in einer bestimmten Absicht', {
  internalText: 'fuer die Genesung von Frau Kowalska',
  donorRef: 'Familie Kowalski',
  massId: mass.massId
});
ok('14.x  rcAddIntention() legt an', typeof intention.intentionId === 'string');

// Der Plan, wie ihn die Gemeinde sieht.
{
  const plan = await rcMasses(parishSlug);
  const one = plan.masses.find((m) => m.massId === mass.massId);

  ok('14.x  Der Plan nennt die Messe', one !== undefined, String(plan.masses.length));
  ok('14.x  Und den oeffentlichen Text der Intention',
    one?.intentions.includes('in einer bestimmten Absicht') === true,
    JSON.stringify(one?.intentions));

  // DER Punkt: der interne Vermerk und der Stifter stehen NICHT darin.
  const asText = JSON.stringify(plan);
  ok('12.9  Der Plan verraet weder den internen Text noch den Stifter',
    !asText.includes('Kowalska') && !asText.includes('Kowalski'),
    asText.slice(0, 200));

  // Nach Tagen gruppieren — nach OERTLICHEM Datum, nicht nach UTC.
  const days = rcMassesByDay(plan.masses, 'de');
  ok('14.x  Der Plan laesst sich nach Tagen gruppieren',
    days.length >= 1 && days[0][1].length >= 1, JSON.stringify(days.map(([d, m]) => [d, m.length])));
}

// Und was die Pfarrei sieht.
{
  const list = (await rcIntentions(parish.parishId)).intentions;
  const one = list.find((i) => i.intentionId === intention.intentionId);

  ok('14.x  Wer den Schluessel hat, sieht den internen Text',
    one?.internalText === 'fuer die Genesung von Frau Kowalska', JSON.stringify(one?.internalText));
  ok('14.x  Und den Stifter', one?.donorRef === 'Familie Kowalski', JSON.stringify(one?.donorRef));
  ok('14.x  Nichts daran ist unlesbar', rcIntentionSealed(one) === false,
    JSON.stringify(one?.unreadable));
}

// -- Gaben --------------------------------------------------------------------

{
  const gift = await rcAddOffering(intention.intentionId, '50,00', {
    currency: 'pln', donorRef: 'Familie Kowalski'
  });

  ok('12.9  rcAddOffering() nimmt eine Gabe an', typeof gift.offeringId === 'string');
  ok('14.x  Die Waehrung wird gross geschrieben', gift.currency === 'PLN', String(gift.currency));
}

try {
  await rcAddOffering(intention.intentionId, '10', { currency: 'EURO' });
  ok('14.x  Eine Waehrung mit vier Buchstaben wird abgewiesen', false, 'ging durch');
} catch (e) {
  ok('14.x  Eine Waehrung mit vier Buchstaben wird abgewiesen', e instanceof RcRequestError);
}

// -- Ein Fremder --------------------------------------------------------------

globalThis.__rcAs('b');
{
  // Der Plan ist oeffentlich: er kommt auch ohne Zugehoerigkeit.
  const plan = await rcMasses(parishSlug);
  ok('14.x  Der Plan ist auch fuer Fremde da', plan.masses.length >= 1);

  // Die Intentionen sind es nicht.
  try {
    await rcIntentions(parish.parishId);
    ok('3.4   Die Intentionen sind fuer Fremde nicht da', false, 'ging durch');
  } catch (e) {
    ok('3.4   Die Intentionen sind fuer Fremde nicht da', e instanceof RcRequestError);
  }

  ok('3.4   Und die Pfarrei steht nicht in seiner Liste',
    (await rcParishes()).parishes.every((x) => x.parishId !== parish.parishId));
}

globalThis.__rcAs('a');

ok('14.x  rcParishes() nennt sie dem Pfarrbuero',
  (await rcParishes()).parishes.some((x) => x.parishId === parish.parishId));

// -- Cogita: der Wissensgraph -------------------------------------------------
//
// Der Punkt steht am Ende: in einer oeffentlichen Bibliothek sucht der Server,
// in einer privaten der Browser — und der Klient weiss, welcher Fall vorliegt,
// statt eine leere Trefferliste fuer "nichts gefunden" zu halten.

const graphArea = (await rcCreateArea(person.roleId, 'Wissensarbeit')).areaId;

const openLib = await rcCreateLibrary(graphArea, 'periodensystem-' + stamp, 'Periodensystem', true);
ok('cg1.1 rcCreateLibrary() legt eine oeffentliche an',
  openLib.isPublic === true, JSON.stringify(openLib));

// §1.2 — EntityKind ist selbst ein Knoten. Neue Arten entstehen, ohne dass
// jemand eine Migration schreibt.
const kindNode = await rcAddNode(openLib.libraryId, 'entity_kind', 'Element');
ok('cg1.2 Eine Art ist selbst ein Knoten', kindNode.kind === 'entity_kind');

const hydrogen = await rcAddNode(openLib.libraryId, 'entity', 'Wasserstoff', kindNode.nodeId);
ok('cg1.3 Eine Entitaet verweist auf ihre Art', typeof hydrogen.nodeId === 'string');

const weight = await rcAddNode(openLib.libraryId, 'number', '1.008');
const edge = await rcAddEdge(openLib.libraryId, hydrogen.nodeId, weight.nodeId, 'atomicWeight',
  { state: 'approximate' });

ok('cg1.6 Eine Kante traegt ihren Zustand', edge.state === 'approximate', JSON.stringify(edge));

// §1.6 — "unbekannt" ist eine ANGABE. Das ist der Gewinn des Modells.
const discovered = await rcAddNode(openLib.libraryId, 'date', '1766');
await rcAddEdge(openLib.libraryId, hydrogen.nodeId, discovered.nodeId, 'discoveredIn',
  { state: 'disputed', note: 'Cavendish beschrieb es, benannt wurde es spaeter.' });

ok('cg1.6 "umstritten" ist ein Zustand und kein fehlender Wert', true);

// §1.3 — Ein Knoten ohne Wert ist erlaubt: eine Entitaet ist ein reiner
// Verbindungspunkt, bis das erste Feld gefuellt ist.
const empty = await rcAddNode(openLib.libraryId, 'entity', undefined, kindNode.nodeId);
{
  const all = (await rcNodes(openLib.libraryId)).nodes;
  const one = all.find((n) => n.nodeId === empty.nodeId);

  ok('cg1.3 Ein Knoten ohne Wert ist erlaubt', one !== undefined);
  ok('cg1.3 Und zeigt seine Art plus ein Stueck Kennung',
    rcNodeLabel(one, 'x').startsWith('entity '), rcNodeLabel(one, 'x'));
}

// -- Die Suche: oeffentlich -> Server -----------------------------------------

{
  const loaded = (await rcNodes(openLib.libraryId)).nodes;
  const found = await rcSearchGraph(openLib.libraryId, 'Wasser', loaded);

  ok('cg5.1 In einer oeffentlichen Bibliothek sucht der Server',
    found.where === 'server', found.where);
  ok('cg5.1 Und findet den Knoten',
    found.hits.some((h) => h.value === 'Wasserstoff'), JSON.stringify(found.hits));
}

// -- Die Suche: privat -> Browser ---------------------------------------------

const closedLib = await rcCreateLibrary(graphArea, 'notizen-' + stamp, 'Notizen', false);
ok('cg1.1 Eine private Bibliothek entsteht', closedLib.isPublic === false);

await rcAddNode(closedLib.libraryId, 'text', 'Sehr vertraulicher Gedanke');
await rcAddNode(closedLib.libraryId, 'text', 'Ein zweiter Gedanke');

{
  const loaded = (await rcNodes(closedLib.libraryId)).nodes;

  ok('cg1.1 Die versiegelten Werte gehen beim Lesen auf',
    loaded.some((n) => n.value === 'Sehr vertraulicher Gedanke'),
    JSON.stringify(loaded.map((n) => n.value)));

  const found = await rcSearchGraph(closedLib.libraryId, 'vertraulich', loaded);

  // DER Punkt: der Klient merkt, dass der Server nicht suchen konnte, und
  // sucht selbst — statt eine leere Liste fuer "nichts gefunden" zu halten.
  ok('cg5.1 In einer privaten sucht der Browser', found.where === 'browser', found.where);
  ok('cg5.1 Und findet trotzdem',
    found.hits.some((h) => h.value === 'Sehr vertraulicher Gedanke'),
    JSON.stringify(found.hits));
}

// §5.2 — Dieselbe Rangfolge auf beiden Wegen. Wer in einer privaten Bibliothek
// eine andere Reihenfolge bekaeme als in einer oeffentlichen, hielte das fuer
// einen Fehler — und haette recht.
{
  const nodes = [
    { nodeId: 'a', kind: 'text', value: 'Gedanke', unreadable: null },
    { nodeId: 'b', kind: 'text', value: 'Ein zweiter Gedanke', unreadable: null },
    { nodeId: 'c', kind: 'text', value: 'Gedankengang', unreadable: null }
  ];

  const hits = rcSearchLoaded('Gedanke', nodes);
  ok('cg5.2 Der genaue Treffer steht vorn', hits[0]?.nodeId === 'a',
    JSON.stringify(hits.map((h) => h.nodeId)));
  ok('cg5.2 Danach der kuerzere', hits[1]?.nodeId === 'c',
    JSON.stringify(hits.map((h) => h.nodeId)));
}

// Unlesbares faellt NICHT aus der Suche heraus — es hat nur nichts, worin sich
// suchen liesse.
{
  const sealed = [{ nodeId: 'x', kind: 'text', value: null, unreadable: 'crypto.missing_epoch' }];
  ok('15.9  Ein unlesbarer Knoten liefert keine Treffer und keinen Fehler',
    rcSearchLoaded('irgendwas', sealed).length === 0);
}

// -- Grenzen -------------------------------------------------------------------

globalThis.__rcAs('b');
try {
  await rcNodes(openLib.libraryId);
  ok('3.4   Ein Fremder sieht die Bibliothek nicht', false, 'ging durch');
} catch (e) {
  ok('3.4   Ein Fremder sieht die Bibliothek nicht', e instanceof RcRequestError);
}

ok('3.4   Und sie steht nicht in seiner Liste',
  (await rcLibraries()).libraries.every((l) => l.libraryId !== openLib.libraryId));

globalThis.__rcAs('a');

ok('cg1.1 rcLibraries() nennt beide',
  (await rcLibraries()).libraries.filter(
    (l) => l.libraryId === openLib.libraryId || l.libraryId === closedLib.libraryId).length === 2);

// -- cg1.6a: Ein Wert mit zwei Abschnitten -------------------------------------
//
// Ein Koenig, der 992–1000 und wieder 1002–1025 regierte, hat EINE Regierung
// mit zwei Abschnitten. Sie in zwei Kanten zu zerlegen hiesse, zwei
// Regierungen zu behaupten.

const reign = await rcAddNode(openLib.libraryId, 'range');
ok('cg1.6a Ein Bereichsknoten entsteht', typeof reign.nodeId === 'string');

{
  const set = await rcSetSegments(reign.nodeId, [
    { valueType: 'date', from: '0992', to: '1000' },
    { valueType: 'date', from: '1002', to: '1025' }
  ]);

  ok('cg1.6a rcSetSegments() nimmt zwei Abschnitte', set.segments === 2, JSON.stringify(set));
}

{
  const list = (await rcSegments(reign.nodeId)).segments;

  ok('cg1.6a Sie kommen in ihrer Reihenfolge zurueck',
    list.length === 2 && list[0].from === '0992' && list[1].from === '1002',
    JSON.stringify(list.map((x) => x.from)));

  // Zwei Abschnitte sind EIN Wert und kein Paar.
  ok('cg1.6a Und stehen als ein Wert da',
    rcRangeText(list) === '0992–1000, 1002–1025', rcRangeText(list));
}

// Setzen ERSETZT — sonst gaebe es zwischendurch eine halbe Regierung.
{
  await rcSetSegments(reign.nodeId, [{ valueType: 'date', from: '0992', to: '1025' }]);
  const list = (await rcSegments(reign.nodeId)).segments;

  ok('cg1.6a Setzen ersetzt, es haengt nicht an', list.length === 1, String(list.length));
}

// Ein offenes Ende wird gezeigt und nicht weggelassen: „ab 1002" ist eine
// Aussage, ein fehlendes Ende saehe aus wie ein vergessenes Feld.
{
  await rcSetSegments(reign.nodeId, [
    { valueType: 'date', from: '1002', fromState: 'approximate', toState: 'open' }
  ]);

  const one = (await rcSegments(reign.nodeId)).segments[0];

  ok('cg1.6a Ein offenes Ende kommt als solches zurueck',
    one.toState === 'open' && (one.to ?? null) === null, JSON.stringify(one));
  ok('cg1.6a Und die Darstellung sagt beides',
    rcSegmentText(one) === '~1002 …', rcSegmentText(one));
}

// Alle Abschnitte tragen denselben Grundtyp — ein Datum gegen eine Seitenzahl
// ergibt keine Ordnung.
try {
  await rcSetSegments(reign.nodeId, [
    { valueType: 'date', from: '0992' },
    { valueType: 'number', from: '3' }
  ]);
  ok('cg1.6a Gemischte Grundtypen werden abgewiesen', false, 'ging durch');
} catch (e) {
  ok('cg1.6a Gemischte Grundtypen werden abgewiesen', e instanceof RcRequestError);
}

// Abschnitte gehoeren an einen Bereichsknoten und sonst nirgendwohin.
try {
  await rcSetSegments(weight.nodeId, [{ valueType: 'number', from: '1' }]);
  ok('cg1.6a An einem Zahlknoten haengen keine Abschnitte', false, 'ging durch');
} catch (e) {
  ok('cg1.6a An einem Zahlknoten haengen keine Abschnitte', e instanceof RcRequestError);
}

// Ein leerer Bereich ist erlaubt: „hier gehoert ein Zeitraum hin, wir kennen
// ihn noch nicht".
{
  await rcSetSegments(reign.nodeId, []);
  ok('cg1.6a Ein Bereich ohne Abschnitte ist erlaubt',
    (await rcSegments(reign.nodeId)).segments.length === 0);
}

// -- Kalender: Zeit ist nicht Inhalt ------------------------------------------
//
// WANN jemand belegt ist, kommt im Klartext; WOMIT er belegt ist, versiegelt.
// Genau das wird hier nachgegangen — und dazu, dass die Oberflaeche die drei
// Arten von "kein Titel" auseinanderhaelt.

const calArea = (await rcCreateArea(person.roleId, 'Terminplanung')).areaId;

const calendar = await rcCreateCalendar(calArea, 'Pfarrbuero', 'Europe/Warsaw');
ok('kal   rcCreateCalendar() legt an', typeof calendar.calendarId === 'string',
  JSON.stringify(calendar));

const iso = (d, h, m = 0) => new Date(Date.UTC(2026, 2, d, h, m)).toISOString();

// Ein Termin mit oeffentlichem UND versiegeltem Teil.
const item = await rcAddItem(calendar.calendarId, person.roleId, iso(2, 8), iso(2, 9), {
  titlePublic: 'Sitzung',
  visibility: 'area',
  title: 'Gespraech mit Frau Kowalska',
  location: 'Zimmer 2',
  notes: 'Unterlagen mitbringen'
});

ok('kal   rcAddItem() legt einen Termin an', typeof item.itemId === 'string');

{
  const view = await rcOccurrences(calendar.calendarId, iso(1, 0), iso(8, 0));
  const one = view.occurrences.find((o) => o.itemId === item.itemId);

  ok('kal   Der Termin steht im Zeitraum', one !== undefined,
    JSON.stringify(view.occurrences.length));
  ok('kal   Die Zeit kommt im Klartext', rcSameInstant(one.startsUtc, iso(2, 8)), String(one?.startsUtc));
  ok('kal   Und der versiegelte Teil geht auf',
    one?.title === 'Gespraech mit Frau Kowalska' && one?.location === 'Zimmer 2',
    JSON.stringify({ t: one?.title, l: one?.location }));

  // Der entschluesselte Titel gewinnt: wer ihn hat, will ihn sehen und nicht
  // die Zusammenfassung, die fuer andere gedacht war.
  const label = rcOccurrenceLabel(one);
  ok('kal   Die Beschriftung nimmt den entschluesselten Titel',
    label.kind === 'named' && label.detailed === true, JSON.stringify(label));

  // Die Zeitzone kommt mit — wer in einer anderen anzeigt, entscheidet das
  // selbst und soll es wissen.
  ok('kal   Die Antwort nennt die Zeitzone', view.timeZone === 'Europe/Warsaw',
    String(view.timeZone));
}

// -- "Nur belegt" -------------------------------------------------------------

const busy = await rcAddItem(calendar.calendarId, person.roleId, iso(3, 10), iso(3, 11), {
  visibility: 'area', title: 'Arzttermin'
});

{
  const view = await rcOccurrences(calendar.calendarId, iso(1, 0), iso(8, 0));
  const one = view.occurrences.find((o) => o.itemId === busy.itemId);

  // Mit Schluessel: der Titel ist da. Ohne waere es 'sealed' — und ohne
  // versiegelten Teil waere es 'busy'. Drei Faelle, drei Antworten.
  ok('kal   Ohne oeffentlichen Titel steht trotzdem der eigene da',
    rcOccurrenceLabel(one).kind === 'named', JSON.stringify(rcOccurrenceLabel(one)));
}

// -- Wiederholungen -------------------------------------------------------------

const weekly = await rcAddItem(calendar.calendarId, person.roleId, iso(2, 8), iso(2, 9), {
  titlePublic: 'Wochensitzung',
  visibility: 'area',
  repeatKind: 'weekly',
  repeatEvery: 1,
  repeatCount: 4
});

{
  const view = await rcOccurrences(calendar.calendarId, iso(1, 0), new Date(Date.UTC(2026, 3, 1)).toISOString());
  const mine = view.occurrences.filter((o) => o.itemId === weekly.itemId);

  ok('kal   Eine Wochenreihe kommt ausgerechnet zurueck', mine.length === 4, String(mine.length));
  ok('kal   Die Vorkommen liegen sieben Tage auseinander',
    new Date(mine[1].startsUtc) - new Date(mine[0].startsUtc) === 7 * 86400000,
    JSON.stringify(mine.map((o) => o.startsUtc)));
}

// Eine Wiederholung ohne Ende laesst sich nicht ausrechnen, nur abschneiden.
try {
  await rcAddItem(calendar.calendarId, person.roleId, iso(2, 8), iso(2, 9),
    { repeatKind: 'daily', repeatEvery: 1 });
  ok('kal   Eine Wiederholung ohne Ende wird abgewiesen', false, 'ging durch');
} catch (e) {
  ok('kal   Eine Wiederholung ohne Ende wird abgewiesen', e instanceof RcRequestError);
}

// -- Ausnahmen: die Reihe bleibt eine Reihe ------------------------------------

await rcCancelOccurrence(weekly.itemId, iso(9, 8));
{
  const view = await rcOccurrences(calendar.calendarId, iso(1, 0), new Date(Date.UTC(2026, 3, 1)).toISOString());
  ok('kal   Ein abgesagtes Vorkommen faellt heraus',
    view.occurrences.filter((o) => o.itemId === weekly.itemId).length === 3);
}

await rcMoveOccurrence(weekly.itemId, iso(16, 8), iso(17, 13), iso(17, 14));
{
  const view = await rcOccurrences(calendar.calendarId, iso(1, 0), new Date(Date.UTC(2026, 3, 1)).toISOString());
  const moved = view.occurrences.find((o) => o.itemId === weekly.itemId && o.moved);

  ok('kal   Ein verschobenes Vorkommen kommt am neuen Platz',
    moved !== undefined && rcSameInstant(moved.startsUtc, iso(17, 13)), String(moved?.startsUtc));

  // Der urspruengliche Anfang bleibt sein NAME in der Reihe — daran haengt
  // die Ausnahme, und ohne ihn liesse sie sich nie wieder aufheben.
  ok('kal   Und behaelt seinen Platz in der Reihe',
    moved !== undefined && rcSameInstant(moved.originalStartUtc, iso(16, 8)),
    String(moved?.originalStartUtc));
}

// -- Ueberschneidungen ----------------------------------------------------------
//
// DER Grund, warum die Zeiten im Klartext liegen: ohne sie liesse sich das
// hier nicht rechnen, ohne alles herunterzuladen und zu entschluesseln.

await rcAddItem(calendar.calendarId, person.roleId, iso(2, 8, 30), iso(2, 9, 30), {
  visibility: 'area', titlePublic: 'Ueberschneidet'
});

{
  const view = await rcOccurrences(calendar.calendarId, iso(2, 0), iso(3, 0));
  const clashes = rcOverlaps(view.occurrences);

  ok('kal   Eine Ueberschneidung wird gefunden', clashes.length >= 1,
    JSON.stringify(view.occurrences.map((o) => [o.startsUtc, o.endsUtc])));
}

// -- Nach Tagen ------------------------------------------------------------------

{
  const view = await rcOccurrences(calendar.calendarId, iso(1, 0), iso(8, 0));
  const days = rcByDay(view.occurrences, 'de', view.timeZone);

  ok('kal   Die Vorkommen lassen sich nach Tagen gruppieren',
    days.length >= 2, JSON.stringify(days.map(([d, o]) => [d, o.length])));
}

// -- Privat heisst: faellt fuer andere ganz aus der Liste -------------------------

await rcAddItem(calendar.calendarId, person.roleId, iso(4, 8), iso(4, 9), {
  visibility: 'private', title: 'Nur fuer mich'
});

{
  const view = await rcOccurrences(calendar.calendarId, iso(1, 0), iso(8, 0));
  ok('kal   Der Eigentuemer sieht seinen privaten Eintrag',
    view.occurrences.some((o) => o.title === 'Nur fuer mich'));
}

globalThis.__rcAs('b');
try {
  await rcOccurrences(calendar.calendarId, iso(1, 0), iso(8, 0));
  ok('3.4   Ein Fremder sieht den Kalender gar nicht', false, 'ging durch');
} catch (e) {
  ok('3.4   Ein Fremder sieht den Kalender gar nicht', e instanceof RcRequestError);
}

globalThis.__rcAs('a');

ok('kal   rcCalendars() nennt ihn',
  (await rcCalendars()).calendars.some((c) => c.calendarId === calendar.calendarId));

// -- Firmung: der empfindlichste Teil ------------------------------------------
//
// Kandidaten sind Minderjaehrige. Alles Personenbezogene liegt versiegelt; was
// im Klartext kommt, sind die Ablaufmerker und die Zeiten — beides sagt etwas
// ueber den VORGANG und nichts ueber die Person.

const confArea = (await rcCreateArea(person.roleId, 'Firmvorbereitung')).areaId;

const cohort = await rcCreateConfirmationGroup(parish.parishId, confArea, 'Firmung 2027');
ok('frm   rcCreateConfirmationGroup() legt an', typeof cohort.groupId === 'string',
  JSON.stringify(group));

const anna = await rcAddCandidate(cohort.groupId, 'Anna Nowak', {
  born: '2012-04-17',
  contact: 'matka: 600 123 456',
  school: 'SP nr 3'
});

ok('frm   rcAddCandidate() nimmt auf', typeof anna.candidateId === 'string');

{
  const list = (await rcCandidates(cohort.groupId)).candidates;
  const one = list.find((c) => c.candidateId === anna.candidateId);

  ok('frm   Der Kandidat steht in der Liste', one !== undefined);
  ok('frm   Und geht mit Schluessel auf',
    one?.name === 'Anna Nowak' && one?.school === 'SP nr 3', JSON.stringify(one?.name));

  // Die Merker kommen im Klartext — das ist der Grund, warum sich zaehlen
  // laesst, ohne etwas zu entschluesseln.
  ok('12.9  Die Ablaufmerker kommen im Klartext',
    one?.consentGiven === false && one?.paperReceived === false,
    JSON.stringify({ c: one?.consentGiven, p: one?.paperReceived }));

  ok('frm   Was fehlt, laesst sich ohne Schluessel ausrechnen',
    rcMissingSteps(one).length === 3, JSON.stringify(rcMissingSteps(one)));

  ok('frm   Und wie viele noch etwas offen haben',
    rcOutstanding(list) >= 1, String(rcOutstanding(list)));

  ok('frm   Die Beschriftung nimmt den Namen',
    rcCandidateLabel(one, 'verschlossen') === 'Anna Nowak');
}

// -- Notizen ---------------------------------------------------------------------

await rcAddCandidateNote(anna.candidateId, person.roleId,
  'Braucht Unterstuetzung beim Auswendiglernen.', false);

{
  const one = (await rcCandidates(cohort.groupId)).candidates
    .find((c) => c.candidateId === anna.candidateId);

  ok('frm   Die Notiz steht beim Kandidaten', one?.notes?.length === 1,
    String(one?.notes?.length));
  ok('frm   Und geht auf',
    one?.notes?.[0]?.text?.includes('Auswendiglernen') === true,
    JSON.stringify(one?.notes?.[0]?.text));

  // forFamily heisst NICHT unverschluesselt — nur: auch fuer die Familie.
  ok('frm   Sie ist nicht fuer die Familie gekennzeichnet',
    one?.notes?.[0]?.forFamily === false);
}

// -- Treffen: die Kapazitaet haelt --------------------------------------------------

const slot = await rcAddMeetingSlot(cohort.groupId,
  new Date(Date.now() + 7 * 86400000).toISOString(),
  { capacity: 1, label: 'Einzelgespraech' });

ok('frm   Ein Treffen mit einem Platz entsteht', typeof slot.slotId === 'string');

const piotr = await rcAddCandidate(cohort.groupId, 'Piotr Kowalczyk');

{
  const booked = await rcBookSlot(slot.slotId, piotr.candidateId);
  ok('frm   Der erste bekommt den Platz', booked.booked === 1, JSON.stringify(booked));
}

{
  const slots = (await rcMeetingSlots(cohort.groupId)).slots;
  const one = slots.find((x) => x.slotId === slot.slotId);

  ok('frm   Der Belegungsstand kommt im Klartext',
    one?.booked === 1 && one?.capacity === 1, JSON.stringify(one));
  ok('frm   Kein freier Platz mehr', rcFreeSeats(one) === 0 && rcSlotFull(one) === true);
}

// DER Punkt: der zweite bekommt eine Absage, keinen stillen zweiten Stuhl.
try {
  await rcBookSlot(slot.slotId, anna.candidateId);
  ok('frm   Der zweite bekommt eine Absage', false, 'ging durch');
} catch (e) {
  ok('frm   Der zweite bekommt eine Absage', e instanceof RcRequestError, String(e));
}

// Zweimal derselbe ist ein zweiter Klick und kein Fehler — und er bekommt NICHT
// zu hoeren, das Treffen sei voll, obwohl er selbst darin sitzt.
{
  const again = await rcBookSlot(slot.slotId, piotr.candidateId);
  ok('frm   Zweimal derselbe erschreckt niemanden', again.booked === 1, JSON.stringify(again));
}

// -- Austritt: Felder weg, Zeile bleibt ----------------------------------------------

{
  const before = (await rcCandidates(cohort.groupId)).candidates.length;
  await rcWithdrawCandidate(piotr.candidateId);
  const after = (await rcCandidates(cohort.groupId)).candidates;

  ok('12.3  Die Zeile bleibt stehen', after.length === before, String(after.length));

  const gone = after.find((c) => c.candidateId === piotr.candidateId);
  ok('12.3  Der Zustand steht auf ausgetreten', gone?.status === 'withdrawn', String(gone?.status));
  ok('12.3  Und die Felder sind vernichtet',
    (gone?.contact ?? null) === null && (gone?.school ?? null) === null,
    JSON.stringify({ c: gone?.contact, s: gone?.school }));

  // Er zaehlt nicht mehr zu denen, die noch etwas offen haben.
  ok('frm   Ausgetretene zaehlen nicht mehr mit',
    rcOutstanding(after) === rcOutstanding(after.filter((c) => c.status === 'enrolled')));
}

// -- Grenzen --------------------------------------------------------------------------

globalThis.__rcAs('b');
try {
  await rcCandidates(cohort.groupId);
  ok('3.4   Ein Fremder sieht den Jahrgang nicht', false, 'ging durch');
} catch (e) {
  ok('3.4   Ein Fremder sieht den Jahrgang nicht', e instanceof RcRequestError);
}

ok('3.4   Und er steht nicht in seiner Liste',
  (await rcConfirmationGroups()).groups.every((g) => g.groupId !== cohort.groupId));

globalThis.__rcAs('a');

ok('frm   rcConfirmationGroups() nennt ihn',
  (await rcConfirmationGroups()).groups.some((g) => g.groupId === cohort.groupId));

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
