/**
 * 2026-10-29 — EINE ROZMOWA ALS JSON (`chat/chatJson.ts`), nachgemessen: jeder Schlüssel der Beispiele ist
 * beschrieben (und nichts beschrieben, das es nicht gibt); ein unveränderter Export ändert nichts und behält jede
 * Kennung; ohne "id" wird angelegt — Themen neu, Nachrichten NUR als die Person, die importiert, und nie rückdatiert;
 * Fremdes, Kaputtes und Unerlaubtes gibt Warnungen statt Abstürze; die Marke „Z importu" reist versiegelt mit (auch
 * durch eine Bearbeitung); die Beschreibung steht ohne die App.
 *
 *   node scripts/app-json-chat-check.mjs
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

globalThis.crypto ??= webcrypto;
/* Wie in app-chat-check: ein BroadcastChannel des Schlüsselbunds hielte den Lauf sonst am Leben. */
const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;

const out = await mkdtemp(join(tmpdir(), 'app-json-chat-'));
await build({
  entryPoints: { chatJson: 'src/app/chat/chatJson.ts', tree: 'src/app/core/jsonTree.ts', chat: 'src/app/chat/chat.ts', dialog: 'src/app/chat/ChatJsonDialog.tsx' },
  bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error', jsx: 'automatic',
  loader: { '.css': 'empty' },
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }
});

let passed = 0;
const ok = (label) => { passed += 1; console.log(`ok   ${label}`); };
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Jeder Schlüssel eines Dokuments als Pfad: `messages`, `messages[].attachments[].name` (wie app-json-check). */
function pathsOf(value, prefix = '', paths = new Set()) {
  for (const [key, one] of Object.entries(value)) {
    const path = `${prefix}${key}`;
    paths.add(path);
    if (isPlain(one)) pathsOf(one, `${path}.`, paths);
    else if (Array.isArray(one)) for (const item of one) if (isPlain(item)) pathsOf(item, `${path}[].`, paths);
  }
  return paths;
}

try {
  const m = await import(pathToFileURL(join(out, 'chatJson.js')).href);
  const tree = await import(pathToFileURL(join(out, 'tree.js')).href);
  const chat = await import(pathToFileURL(join(out, 'chat.js')).href);

  const input = m.chatExampleInput();
  const ids = input.items.map((i) => i.message.messageId);
  const [T_TRANSPORT, T_NOCLEGI] = input.topics.map((t) => t.topicId);
  const now = new Date('2026-10-29T10:05:00.000Z');
  const contextOf = (over = {}) => m.importContext({
    chatId: input.chat.chatId, kind: input.chat.kind, now,
    writes: true, moderates: true, me: ['Jan Kowalski'],
    topics: input.topics, topicMayChange: () => true,
    items: input.items, look: input.look, mayFile: () => true, marks: input.marks,
    from: input.items[0].message.createdAt, complete: true, scheduled: [],
    ...over
  });
  const ctx = contextOf();
  const plain = (doc) => JSON.parse(JSON.stringify(doc));

  /* -- 1. Die Beschreibung: ohne die App, immer dieselbe, jeder Schlüssel ------------------------------------ */
  const text = tree.describe(m.CHAT_JSON);
  assert.equal(m.chatDescription(), text, 'chatDescription() is the tree');
  assert.equal(tree.describe(m.CHAT_JSON), text, 'the description is the same every time (no clock in it)');
  assert.ok(text.startsWith(`# Rozmowa jako JSON ("${m.CHAT_FORMAT}", wersja ${m.CHAT_VERSION})`), 'it names its format');
  const sections = tree.sectionsOf(m.CHAT_JSON).map((s) => s.node.key);
  assert.deepEqual(sections, ['chat', 'chat.usage', 'chat.topic', 'chat.message', 'chat.new', 'chat.linked', 'chat.example'], 'one section each, once');
  const local = (path) => path.replace(/^(?:chat\.|me\.|range\.|topics\[\]\.|messages\[\]\.|linked\[\]\.)/, '');
  for (const path of Object.keys(m.CHAT_PATHS)) assert.ok(text.includes(`"${local(path)}" — `), `the description explains ${path}`);
  for (const [path, says] of Object.entries(m.CHAT_PATHS)) assert.ok(typeof says === 'string' && says.trim().length > 3, `${path} has a real sentence`);
  for (const word of ['nigdy', 'w czyimś imieniu', 'wstecz', '"sendAt"', 'Z importu', 'nie usuwa']) assert.ok(text.includes(word), `the description says plainly: ${word}`);
  ok(`description without the app: ${sections.length} sections, ${Object.keys(m.CHAT_PATHS).length} keys explained, what is never imported said plainly`);

  /* -- 2. Jeder Schlüssel der Beispiele ist beschrieben — und nichts beschrieben, das in keinem steht ------------- */
  const example = plain(m.chatExample());
  const samples = tree.samplesOf(m.CHAT_JSON);
  assert.equal(samples.length, 2, 'two samples to insert');
  const docs = [example, ...samples.map((s) => plain(s.doc()))];
  const seen = new Set();
  for (const doc of docs) for (const path of pathsOf(doc)) { seen.add(path); assert.ok(m.CHAT_PATHS[path] !== undefined, `"${path}" is in an example but not described`); }
  const tops = new Set([...seen].map((p) => p.split(/[.[]/)[0]));
  for (const key of Object.keys(m.CHAT_PATHS)) assert.ok(tops.has(key.split(/[.[]/)[0]), `"${key}" is described but in no example`);
  ok(`every key of the export example and the ${samples.length} samples is described (${seen.size} paths)`);

  /* -- 3. Der Export: wie die Rozmowa es zeigt ------------------------------------------------------------- */
  assert.equal(example.format, m.CHAT_FORMAT);
  assert.deepEqual(example.messages.map((x) => x.id), ids, 'every message keeps its id, oldest first');
  assert.deepEqual(example.topics.map((t) => [t.id, t.key, t.closed]), [[T_TRANSPORT, 'transport', false], [T_NOCLEGI, 'noclegi', true]], 'topics with id, key and state');
  const [m1, m2, m3, m4, m5] = example.messages;
  assert.deepEqual(m1.reactions, [{ emoji: '👍', count: 2, mine: true }], 'reactions counted, mine marked');
  assert.equal(m1.topic, '@transport', 'a topic as "@key"');
  assert.deepEqual([m2.author, m2.mine, m2.replyTo, m2.quote, m2.pinned, m2.starred], ['Jan Kowalski', true, ids[0], input.items[0].opened.text, true, true]);
  assert.deepEqual(m2.attachments, [{ name: 'oferta-autokar.pdf', type: 'application/pdf', size: 182340 }], 'attachments by name, type and size — never the key');
  assert.ok(!JSON.stringify(example).includes('"key":"AAAA'), 'no file key leaves the app');
  assert.deepEqual([m3.author, m3.edited], ['Maria Wiśniewska (Rada)', '2026-10-03T08:12:00.000Z'], 'a person through a role: „Imię Nazwisko (Rola)"');
  assert.deepEqual([m4.deleted, m4.deletedBy, 'text' in m4], ['2026-10-04T12:05:00.000Z', 'author', false], 'a deleted message: when and by whom, no text');
  assert.deepEqual([m5.author, m5.link, 'topic' in m5], ['Ewa Lis (Rodzice)', true, false], 'a person from a link');
  assert.deepEqual(example.linked, [{ kind: 'task', title: 'Wpłacić zaliczkę za autokar', topic: '@transport', message: ids[1], at: '2026-11-15T09:00:00.000Z', state: 'zaplanowane' }]);
  const one = plain(m.exportChat({ ...input, topicId: T_NOCLEGI, limited: true }));
  assert.deepEqual([one.messages.map((x) => x.id), one.range.topic, one.range.limited], [[ids[2]], '@noclegi', true], 'one topic, and the limit said');
  const later = plain(m.exportChat({ ...input, from: new Date('2026-10-03T00:00:00.000Z') }));
  assert.deepEqual(later.messages.map((x) => x.id), ids.slice(2), 'a range from a day on');
  assert.deepEqual([...m.topicKeys([{ topicId: 'a', title: 'Łódź — wyjazd' }, { topicId: 'b', title: 'Lodz wyjazd' }]).values()], ['lodz-wyjazd', 'lodz-wyjazd-2'], 'keys from names, unique');
  ok('export: ids, authors as shown, replies, edits, deletions, link persons, attachments without keys, reactions, pins, topics, linked tasks, range and topic filter');

  /* -- 4. Export → Import ohne Änderung: nichts zu tun, keine Warnung -------------------------------------- */
  const same = m.planChatImport(example, ctx);
  assert.ok(!('error' in same), 'the export imports');
  assert.deepEqual([same.newTopics.length, same.topicChanges.length, same.moves.length, same.marks.length, same.posts.length], [0, 0, 0, 0, 0], 'an unchanged document plans no change');
  assert.deepEqual(same.warnings, [], `and says nothing: ${same.warnings.join(' | ')}`);
  assert.deepEqual(same.lines, ['Nic do zmiany — dokument zgadza się z rozmową.']);
  /* Ein Assistent ordnet Schlüssel um und schreibt Zeiten anders — derselbe Inhalt bleibt derselbe. */
  const shuffled = plain(example);
  shuffled.messages[1].attachments = [{ size: 182340, type: 'application/pdf', name: 'oferta-autokar.pdf' }];
  shuffled.messages[0].at = '2026-10-02T19:05:00+02:00';
  shuffled.messages[0].attachments = [];
  shuffled.messages[0].quote = '';
  assert.deepEqual(m.planChatImport(shuffled, ctx).warnings, [], 'key order, time zone and empty values do not count as changes');
  /* Gekürzt — ohne "topics", ohne Kopf: "@klucz" trifft über den Schlüssel, den der Export dem Namen gibt. */
  const trimmed = { messages: example.messages.map((x) => ({ id: x.id, ...(x.topic !== undefined ? { topic: x.topic } : {}) })) };
  const short = m.planChatImport(trimmed, ctx);
  assert.deepEqual([short.moves.length, short.warnings], [0, []], 'a trimmed document still means the same topics');
  ok('export → import of an unchanged document: no change, no warning, every id kept');

  /* -- 5. Geändert: Themen, Ordnung, Merkzeichen; ohne "id" neu ---------------------------------------------- */
  const changed = plain(example);
  changed.topics[0].title = 'Transport i dojazd';
  changed.topics[1].closed = false;
  changed.topics.push({ key: 'koszty', title: 'Koszty' });
  changed.messages[0].topic = '@koszty';
  changed.messages[2].topic = null;
  changed.messages[1].pinned = false;
  changed.messages[4].starred = true;
  changed.messages[0].text = 'Zupełnie inna treść';
  changed.messages.push({ topic: '@koszty', text: 'Podsumowanie kosztów: autokar 6200 zł.', replyTo: ids[1], quote: 'fałszywy cytat' });
  changed.messages.push({ text: 'Przypomnienie o zaliczce', sendAt: '2026-11-02T09:00:00+01:00', silent: true, author: 'Jan Kowalski' });
  const plan = m.planChatImport(changed, ctx);
  assert.deepEqual(plan.newTopics, [{ ref: '#1', title: 'Koszty', closed: false }], 'a topic without id: new');
  assert.deepEqual(plan.topicChanges, [{ topicId: T_TRANSPORT, was: 'Transport', title: 'Transport i dojazd' }, { topicId: T_NOCLEGI, was: 'Noclegi', closed: false }], 'with id: renamed, reopened in place');
  assert.deepEqual(plan.moves, [{ messageId: ids[0], to: { kind: 'new', ref: '#1' } }, { messageId: ids[2], to: { kind: 'none' } }], 'filed into the new topic, and out of one');
  assert.deepEqual(plan.marks, [{ messageId: ids[1], kind: 'pin', on: false }, { messageId: ids[4], kind: 'star', on: true }]);
  assert.equal(plan.posts.length, 2, 'two new messages');
  assert.deepEqual(plan.posts[0], { text: 'Podsumowanie kosztów: autokar 6200 zł.', to: { kind: 'new', ref: '#1' }, replyTo: ids[1], replyText: input.items[1].opened.text, sendAt: null, silent: false },
    'a reply quotes the real message, never the document');
  assert.deepEqual([plan.posts[1].sendAt, plan.posts[1].silent], ['2026-11-02T08:00:00.000Z', true], 'scheduled, silent; "author" = the importing person is fine');
  assert.ok(plan.warnings.some((w) => w.includes('"text"') && w.includes('nie zmienia treści')), 'a changed text is reported and left');
  assert.ok(plan.warnings.some((w) => w.includes('"quote" pominięte')), 'the quote of a new message is not taken');
  assert.equal(plan.warnings.length, 2, `nothing else: ${plan.warnings.join(' | ')}`);
  assert.ok(plan.lines.some((l) => l.startsWith('Nowa wiadomość jako Jan Kowalski') && l.includes('„Z importu”') && l.includes('w temacie „Koszty”')), 'the preview says who writes and that it is marked');
  ok('changes: new topic, rename, reopen, filing (also into a new topic), unpin, star; new messages as the importing person with a real quote, scheduled and silent');

  /* -- 6. Nie: fremder Name, rückdatiert, fremde Rozmowa, ohne Recht ------------------------------------------- */
  const only = (messages, c = ctx) => m.planChatImport({ format: m.CHAT_FORMAT, version: 1, messages }, c);
  const someoneElse = only([{ text: 'Zgadzam się na wszystko', author: 'Anna Nowak' }]);
  assert.equal(someoneElse.posts.length, 0, 'never in someone else\'s name');
  assert.ok(someoneElse.warnings[0].includes('nigdy w czyimś imieniu'));
  const backdated = only([{ text: 'Było postanowione', at: '2026-10-01T10:00:00Z' }]);
  assert.equal(backdated.posts.length, 0, 'never backdated');
  assert.ok(backdated.warnings[0].includes('nie pisze wstecz'));
  const lostIds = plain(example);
  for (const msg of lostIds.messages) delete msg.id;
  const lost = m.planChatImport(lostIds, ctx);
  assert.equal(lost.posts.length, 0, 'an export that lost its ids is not re-posted as mine');
  /* Und ohne "at" auch: fremde bleiben fremd ("author"), die eigene ist schon da. */
  for (const msg of lostIds.messages) delete msg.at;
  const stripped = m.planChatImport(lostIds, ctx);
  assert.equal(stripped.posts.length, 0, 'not even without "at": others by "author", mine because it is already there');
  assert.ok(stripped.warnings.some((w) => w.includes('już jest w rozmowie')) && stripped.warnings.filter((w) => w.includes('nigdy w czyimś imieniu')).length === 3,
    `each said: ${stripped.warnings.join(' | ')}`);
  const foreign = plain(example);
  foreign.chat.id = '0192f0a0-7c1e-7000-8000-00000000ffff';
  const empty = contextOf({ topics: [], items: [], marks: [] });
  const fromElsewhere = m.planChatImport(foreign, empty);
  assert.deepEqual([fromElsewhere.moves.length, fromElsewhere.marks.length, fromElsewhere.posts.length, fromElsewhere.newTopics.map((t) => t.title)], [0, 0, 0, ['Transport', 'Noclegi']],
    'from another conversation: its messages never come over, its topics come as new');
  assert.ok(fromElsewhere.warnings[0].includes('z innej rozmowy') && fromElsewhere.warnings[0].includes('pominięto 5'));
  assert.equal(m.neededFrom(foreign, input.chat.chatId), null, 'and nothing older is loaded for it');
  const reader = m.planChatImport(example, contextOf({ writes: false, moderates: false }));
  assert.deepEqual(reader, { error: m.READ_ONLY_IMPORT }, 'who only reads gets the export alone');
  const writer = contextOf({ moderates: false, mayFile: (msg) => msg.authorRoleId === input.items[1].message.authorRoleId, topicMayChange: () => false });
  const tidy = plain(example);
  tidy.messages[1].pinned = false;
  tidy.messages[0].topic = null;
  tidy.messages[1].topic = null;
  tidy.topics[0].title = 'Inaczej';
  const asWriter = m.planChatImport(tidy, writer);
  assert.deepEqual([asWriter.marks.length, asWriter.topicChanges.length, asWriter.moves.map((x) => x.messageId)], [0, 0, [ids[1]]], 'a writer files only own messages, no pins, no foreign topics');
  assert.ok(['przypina', 'przenosi ją jej autor', 'ten, kto go założył'].every((w) => asWriter.warnings.some((x) => x.includes(w))), `each refusal said: ${asWriter.warnings.join(' | ')}`);
  const moderator = m.planChatImport({ messages: [{ text: 'x' }], topics: [{ title: 'Nowy' }] }, contextOf({ writes: false }));
  assert.deepEqual([moderator.posts.length, moderator.newTopics.length], [0, 0], 'a moderator who does not write orders, but adds nothing');
  assert.ok(moderator.warnings.some((w) => w.includes('nie piszesz')));
  const notes = m.planChatImport({ topics: [{ title: 'Temat' }] }, contextOf({ kind: 'self' }));
  assert.ok(notes.newTopics.length === 0 && notes.warnings[0].includes('Notatkach'), 'no topics in Notatki');
  ok('never: someone else\'s name, a past date, re-posting an export, another conversation; rights: readers export only, writers file their own, pins for moderators');

  /* -- 7. Nicht doppelt, nicht zu viel, nicht zu lang, nicht in die Vergangenheit ---------------------------- */
  const imported = { message: { ...input.items[1].message, messageId: '0192f0a0-7c1e-7000-8000-0000000001ff', createdAt: '2026-10-20T10:00:00.000Z', topicId: null },
    opened: { text: 'Podsumowanie: jedziemy!', name: 'Jan Kowalski', imported: true } };
  const twice = only([{ text: 'Podsumowanie:  jedziemy!' }], contextOf({ items: [...input.items, imported] }));
  assert.ok(twice.posts.length === 0 && twice.warnings[0].includes('już jest w rozmowie'), 'what came from an import does not come twice');
  const theirs = only([{ text: input.items[0].opened.text }]);
  assert.equal(theirs.posts.length, 1, 'the same words as someone else are my own new message (marked) — only my own text counts as already there');
  const waiting = only([{ text: 'Przypomnienie', sendAt: '2026-11-02T09:00:00+01:00' }], contextOf({ scheduled: [{ text: 'Przypomnienie', sendAt: '2026-11-02T08:00:00.000Z' }] }));
  assert.ok(waiting.posts.length === 0 && waiting.warnings[0].includes('czeka'), 'nor what already waits');
  const weekly = only([1, 2, 3].map((n) => ({ text: 'Próba w czwartek o 19:00', sendAt: `2026-11-0${n + 1}T09:00:00+01:00` })));
  assert.equal(weekly.posts.length, 3, 'the same reminder on different days is three messages');
  const many = only(Array.from({ length: m.MAX_POSTS + 5 }, (_, i) => ({ text: `Wiadomość ${i}` })));
  assert.ok(many.posts.length === m.MAX_POSTS && many.warnings.some((w) => w.includes('pominięto 5')), 'at most MAX_POSTS');
  const long = only([{ text: 'ą'.repeat(m.MAX_TEXT_BYTES) }]);
  assert.ok(long.posts.length === 0 && long.warnings[0].includes('za długa'), 'too long (bytes, not letters)');
  const tall = only([{ text: `a${'\n'.repeat(9000)}b` }]);
  assert.ok(tall.posts.length === 0 && tall.warnings[0].includes('za długa'), 'measured as it stands in the sealed envelope (a line break is two bytes there)');
  const past = only([{ text: 'a', sendAt: '2026-10-29T10:06:00Z' }, { text: 'b', sendAt: 'jutro rano' }, { text: 'c', sendAt: '2028-01-01T00:00:00Z' }]);
  assert.equal(past.posts.length, 0, 'sendAt too close, unreadable, or too far: skipped');
  assert.equal(past.warnings.length, 3);
  const titled = m.planChatImport({ topics: [{ title: 'transport' }, { key: 'k', title: 'Nowy' }, { key: 'k2', title: 'NOWY' }], messages: [{ text: 'x', topic: '@k2' }] }, ctx);
  assert.deepEqual([titled.newTopics.map((t) => t.title), titled.posts[0].to], [['Nowy'], { kind: 'new', ref: '#1' }], 'a known or repeated name is the same topic, not a second one');
  ok('not twice (imported or waiting), at most 30, at most 16 000 bytes, only the future within a year, no duplicate topics by name');

  /* -- 8. Kaputtes: Warnungen, keine Abstürze ------------------------------------------------------------------ */
  const garbage = [
    null, 7, 'x', [], {}, { format: 'recreatio/page' }, { format: m.CHAT_FORMAT, version: 9, topics: 'x', messages: 5, odd: true },
    { topics: [null, 1, 'a', { title: 5 }, { id: 7 }, { key: 'zła spacja', title: 'A' }, { title: 'B', closed: 'tak' }, { id: T_TRANSPORT, title: '' }, { id: T_TRANSPORT }, { title: 'x'.repeat(300) }] },
    { messages: [null, 1, { id: 5 }, { id: '' }, { text: 5 }, { text: 'ok', sendAt: 'jutro' }, { text: 'ok2', topic: 7 }, { text: 'ok3', topic: '@brak' }, { text: 'ok4', replyTo: 9 },
      { id: ids[0], pinned: 'tak', starred: 2, topic: {}, reactions: 'x', extra: 1 }, { id: ids[0] }, { id: 'nie-ma' }, { text: 'x', silent: 'tak', attachments: [{ name: 'a.pdf' }], hello: 1 },
      { deleted: '2026-10-01T00:00:00Z', author: 'Anna Nowak' }, { text: 'ok5', topic: T_NOCLEGI, replyTo: ids[3] }] },
    { chat: 'x', me: 5, range: [], topics: [{ key: '@Dobry', title: 'Dobry' }], messages: [{ text: 'w temacie', topic: '@DOBRY' }] }
  ];
  for (const bad of garbage) {
    let result;
    assert.doesNotThrow(() => { result = m.planChatImport(bad, ctx); }, `no crash on ${JSON.stringify(bad)?.slice(0, 60)}`);
    assert.ok('error' in result || (Array.isArray(result.lines) && Array.isArray(result.warnings)), 'an error or a plan');
    assert.doesNotThrow(() => m.neededFrom(bad, input.chat.chatId));
  }
  for (const bad of [null, 7, 'x', [], { format: 'recreatio/page' }]) assert.ok('error' in m.planChatImport(bad, ctx), `refused: ${JSON.stringify(bad)}`);
  assert.deepEqual(m.planChatImport({}, ctx).lines, ['Nic do zmiany — dokument zgadza się z rozmową.'], 'an empty object is nothing to do');
  const messy = m.planChatImport(garbage[8], ctx);
  assert.deepEqual(messy.posts.map((p) => [p.text, p.to, p.replyTo]), [['ok', { kind: 'none' }, null], ['ok2', { kind: 'none' }, null], ['ok3', { kind: 'none' }, null], ['ok4', { kind: 'none' }, null], ['x', { kind: 'none' }, null], ['ok5', { kind: 'topic', topicId: T_NOCLEGI }, null]].filter(([t]) => t !== 'ok'),
    'what is readable goes, the rest is said: a bad sendAt skips, a bad topic or reply drops only the topic or quote');
  for (const part of ['to nie obiekt', 'nieczytelne "id"', 'bez treści', 'nie data ISO', '"topic" to nie tekst', 'kluczem "brak"', '"replyTo" nie wskazuje', '"pinned" to true albo false', '"starred" to true albo false', 'reakcji import nie zmienia', 'nieznany klucz "extra"', 'drugi raz', 'nie ma wiadomości o tym "id"', '"silent" to true albo false', 'plików nie ma w JSON', 'nieznany klucz "hello"', 'usuniętej albo nieczytelnej', 'jest usunięta albo nieczytelna']) {
    assert.ok(messy.warnings.some((w) => w.includes(part)), `warns: ${part} — ${messy.warnings.join(' | ')}`);
  }
  const topicsMessy = m.planChatImport(garbage[7], ctx);
  for (const part of ['to nie obiekt', '"title" to nie tekst', 'bez nazwy', 'może mieć tylko litery', '"closed" to true albo false', 'pusta nazwa', 'drugi raz', 'skrócona']) {
    assert.ok(topicsMessy.warnings.some((w) => w.includes(part)), `warns: ${part} — ${topicsMessy.warnings.join(' | ')}`);
  }
  const head = m.planChatImport(garbage[6], ctx);
  assert.ok(['Wersja 9', '"topics" to nie lista', '"messages" to nie lista', 'Nieznany klucz "odd"'].every((w) => head.warnings.some((x) => x.includes(w))), head.warnings.join(' | '));
  const inherited = m.planChatImport(JSON.parse('{"constructor":1,"topics":[{"title":"A","toString":2}],"messages":[{"id":"' + ids[0] + '","__proto__":{"x":1}}]}'), ctx);
  assert.ok(['"constructor"', '"toString"'].every((w) => inherited.warnings.some((x) => x.includes(w))), `inherited names are unknown keys too: ${inherited.warnings.join(' | ')}`);
  const caseless = m.planChatImport(garbage[9], ctx);
  assert.deepEqual(caseless.posts[0].to, { kind: 'new', ref: '#1' }, '"@key" ignores case and a leading @ in "key"');
  ok('broken documents: errors for non-documents and other formats, warnings for every bad value — never a crash');

  /* -- 9. Was nachgeladen werden muss --------------------------------------------------------------------------- */
  assert.equal(m.neededFrom(example, input.chat.chatId), Date.parse('2026-10-02T17:05:00.000Z'), 'as far back as the oldest message with an id');
  assert.equal(m.neededFrom(m.chatTopicsSample(), input.chat.chatId), null, 'new messages need nothing older');
  const older = m.planChatImport(example, contextOf({ items: input.items.slice(2), from: input.items[2].message.createdAt, complete: false }));
  assert.ok(older.warnings.filter((w) => w.includes('starsza niż wczytane')).length === 2, 'beyond what is loaded: said, not invented');
  ok('loading: the oldest referenced message decides how far back; beyond the limit it is said');

  /* -- 10. Die Beispiele zum Einsetzen importieren ohne ein Wort ------------------------------------------------ */
  const fresh = contextOf({ topics: [], items: [], marks: [], now: new Date() });
  for (const sample of samples) {
    const p = m.planChatImport(plain(sample.doc()), fresh);
    assert.ok(!('error' in p) && p.warnings.length === 0 && p.posts.length > 0, `sample „${sample.label}” imports cleanly: ${p.warnings?.join(' | ')}`);
  }
  const reminder = m.chatReminderSample(new Date(2026, 9, 29, 22, 30));
  assert.equal(new Date(reminder.messages[0].sendAt).getTime(), new Date(2026, 9, 30, 9, 0).getTime(), 'the reminder goes tomorrow at 9:00');
  ok('samples insert and import cleanly (the reminder is always in the future)');

  /* -- 11. Die Marke „Z importu" in der versiegelten Hülle ------------------------------------------------------ */
  const keys = new Map([[1, webcrypto.getRandomValues(new Uint8Array(32))]]);
  const author = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const sealedAs = async (sealed) => ({ messageId: sealed.messageId, authorRoleId: author, authorSeatId: null, epoch: 1, bodySealed: Buffer.from(sealed.sealedBody).toString('base64url'), createdAt: now.toISOString(), deletedAt: null });
  const marked = await chat.sealMessage(keys, author, 'Podsumowanie', 'Jan Kowalski', { imported: true });
  const openedMarked = await chat.openMessage(keys, await sealedAs(marked));
  assert.deepEqual([openedMarked.text, openedMarked.imported], ['Podsumowanie', true], 'sealed with the mark, opened with it');
  const byHand = await chat.openMessage(keys, await sealedAs(await chat.sealMessage(keys, author, 'Ręcznie', 'Jan Kowalski')));
  assert.equal('imported' in byHand, false, 'a message by hand carries no mark (its envelope is as before)');
  const edit = await chat.sealVersion(keys, marked.messageId, author, 'Poprawione', 'Jan Kowalski', openedMarked);
  const edited = await chat.openMessage(keys, { ...(await sealedAs(marked)), bodySealed: Buffer.from(edit.sealedBody).toString('base64url') });
  assert.deepEqual([edited.text, edited.imported], ['Poprawione', true], 'an edit keeps the mark');
  const exportedMark = m.messageOut({ message: (await sealedAs(marked)), opened: openedMarked }, { author: () => 'Jan Kowalski', mine: () => true }, [], new Map());
  assert.equal(exportedMark.imported, true, 'and the export says it');
  ok('the mark „Z importu" is sealed in the envelope, survives an edit, is absent on messages by hand, and is exported');

  /* -- 12. Laden für Export und Import: Seiten von hinten, gegen einen nachgebauten Dienst ------------------------ */
  const dialog = await import(pathToFileURL(join(out, 'dialog.js')).href);
  const base = Date.parse('2026-01-01T00:00:00.000Z');
  const serve = (total) => Array.from({ length: total }, (_, i) => ({
    messageId: `m-${String(i).padStart(5, '0')}`, authorRoleId: 'r', authorSeatId: null, epoch: 1, bodySealed: null,
    createdAt: new Date(base + i * 60_000).toISOString(), deletedAt: null
  }));
  let all = serve(450);
  let calls = 0;
  const realFetch = globalThis.fetch;
  /* Wie der Dienst (`ReadMessagesAsync`): die neuesten `limit` vor `before`/`beforeId`, die älteste zuerst. */
  globalThis.fetch = async (url) => {
    calls += 1;
    const asked = new URL(String(url), 'http://dienst');
    const limit = Number(asked.searchParams.get('limit') ?? 60);
    const before = asked.searchParams.get('before');
    const beforeId = asked.searchParams.get('beforeId');
    const list = before === null ? all : all.filter((x) => x.createdAt < before || (x.createdAt === before && x.messageId < beforeId));
    return new Response(JSON.stringify({ messages: list.slice(Math.max(0, list.length - limit)) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const whole = await dialog.loadBack('c', new Map(), null);
    assert.deepEqual([whole.items.length, calls, whole.complete, whole.limited, whole.from], [450, 3, true, false, all[0].createdAt], 'to the beginning in pages of 200');
    assert.ok(whole.items.every((x, i) => x.message.messageId === all[i].messageId), 'oldest first, nothing twice, nothing missing');
    calls = 0;
    const until = Date.parse(all[300].createdAt);
    const recent = await dialog.loadBack('c', new Map(), until);
    assert.deepEqual([recent.items.length, calls, recent.complete, recent.limited], [200, 1, false, false], 'only as far back as asked');
    assert.equal(dialog.covers(recent, until), true);
    assert.equal(dialog.covers(recent, Date.parse(all[100].createdAt)), false, 'older needs a new load');
    assert.equal(dialog.covers(recent, null), true);
    all = serve(m.MAX_EXPORT + 300);
    calls = 0;
    const huge = await dialog.loadBack('c', new Map(), null);
    assert.deepEqual([huge.items.length, huge.complete, huge.limited, huge.items[huge.items.length - 1].message.messageId], [m.MAX_EXPORT, false, true, all[all.length - 1].messageId], 'at most MAX_EXPORT, the newest, and the limit said');
    assert.equal(dialog.covers(huge, base), true, 'beyond the limit there is nothing more to load');
  } finally {
    globalThis.fetch = realFetch;
  }
  ok(`loading: pages of 200 from the newest back, as far as asked, at most ${m.MAX_EXPORT} (and then said) — against a service that answers like ReadMessagesAsync`);
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(out, { recursive: true, force: true });
}
console.log(`\n${passed} passed`);
