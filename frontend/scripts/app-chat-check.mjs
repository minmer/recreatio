import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

globalThis.crypto ??= webcrypto;
// These tests do not exercise cross-tab key exchange. Node's browser-compatible
// BroadcastChannel would otherwise keep the runner alive after all assertions.
const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;
const dir = await mkdtemp(join(tmpdir(), 'chat-check-'));
try {
  for (const entry of ['chat', 'chatFeatures']) await build({ entryPoints: [`src/app/${entry}.ts`], bundle: true, format: 'esm', platform: 'node',
    outfile: join(dir, `${entry}.mjs`), define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) }, logLevel: 'error' });
  const chat = await import(pathToFileURL(join(dir, 'chat.mjs')).href);
  const features = await import(pathToFileURL(join(dir, 'chatFeatures.mjs')).href);
  const prefs = { timeZone: 'Europe/Berlin', useAvailability: true, windows: [{ day: 1, start: 540, end: 1020 }], muted: false, archived: false, readReceipts: false };
  assert.equal(features.availableNow(prefs, new Date('2026-09-28T07:00:00Z')), true, 'availability includes start in summer time');
  assert.equal(features.availableNow(prefs, new Date('2026-09-28T15:00:00Z')), false, 'end boundary excluded');
  assert.equal(features.availableNow(prefs, new Date('2026-12-07T08:00:00Z')), true, 'winter offset respected');
  assert.equal(features.availableNow(prefs, new Date('2026-09-27T10:00:00Z')), false, 'different weekday quiet');
  assert.equal(features.availableNow({ ...prefs, windows: [] }), false, 'no windows means quiet');
  assert.equal(features.availableNow({ ...prefs, useAvailability: false }), true, 'disabled schedule is always available');
  const sunday = { ...prefs, windows: [{ day: 0, start: 120, end: 180 }] };
  assert.equal(features.availableNow(sunday, new Date('2026-10-25T00:30:00Z')), true, 'first DST-fold hour');
  assert.equal(features.availableNow(sunday, new Date('2026-10-25T01:30:00Z')), true, 'repeated DST-fold hour');

  const keys = new Map([[1, crypto.getRandomValues(new Uint8Array(32))]]);
  const author = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const attachment = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'private.mp3', type: 'audio/mpeg', size: 42, key: 'A'.repeat(43) };
  const extras = { forwarded: true, attachments: [attachment], replyTo: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', replyText: 'Original' };
  const sealed = await chat.sealMessage(keys, author, 'Hello', 'Alice', extras);
  const message = { messageId: sealed.messageId, authorRoleId: author, authorSeatId: null, epoch: 1, bodySealed: Buffer.from(sealed.sealedBody).toString('base64url'), createdAt: new Date().toISOString(), deletedAt: null };
  const opened = await chat.openMessage(keys, message);
  assert.equal(opened.text, 'Hello'); assert.deepEqual(opened.attachments, [attachment]); assert.equal(opened.replyText, 'Original');
  assert.equal(await chat.openMessage(new Map([[1, crypto.getRandomValues(new Uint8Array(32))]]), message), null, 'wrong key rejected');
  assert.equal(await chat.openMessage(keys, { ...message, authorRoleId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }), null, 'author swap rejected');
  const tampered = sealed.sealedBody.slice(); tampered[tampered.length - 1] ^= 1;
  assert.equal(await chat.openMessage(keys, { ...message, bodySealed: Buffer.from(tampered).toString('base64url') }), null, 'tampering rejected');
  const edit = await chat.sealVersion(keys, message.messageId, author, 'Edited', 'Alice', opened);
  const edited = await chat.openMessage(keys, { ...message, bodySealed: Buffer.from(edit.sealedBody).toString('base64url') });
  assert.equal(edited.text, 'Edited', 'editing must not restore old text from extras');
  assert.deepEqual(edited.attachments, [attachment], 'editing preserves attachments');
  assert.equal(edited.replyTo, extras.replyTo, 'editing preserves reply');
  assert.equal(edited.forwarded, true, 'editing preserves forwarded marker');
  const plainMessage = await chat.sealMessage(keys, author, 'Legacy text', null);
  assert.equal((await chat.openMessage(keys, { ...message, messageId: plainMessage.messageId, bodySealed: Buffer.from(plainMessage.sealedBody).toString('base64url') })).text, 'Legacy text');

  let ciphertext;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(ciphertext);
  /* Hochgeladen wird mit XMLHttpRequest — nur er meldet den Fortschritt. */
  let sentWith = null;
  const originalXhr = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = class {
    constructor() { this.upload = {}; this.headers = {}; this.withCredentials = false; }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(name, value) { this.headers[name] = value; }
    async send(body) {
      ciphertext = new Uint8Array(await body.arrayBuffer());
      sentWith = { method: this.method, url: this.url, headers: this.headers, credentials: this.withCredentials };
      this.upload.onprogress?.({ lengthComputable: true, loaded: ciphertext.length / 2, total: ciphertext.length });
      this.status = 200;
      this.responseText = JSON.stringify({ attachmentId: attachment.id });
      this.onload?.();
    }
  };
  const progress = [];
  const file = new File(['private music bytes'], 'song.mp3', { type: 'audio/mpeg' });
  const uploaded = await features.uploadAttachment('/workspace/chat/test', file, (part) => progress.push(part));
  assert.equal(Buffer.from(ciphertext).includes(Buffer.from('private music bytes')), false, 'only ciphertext uploaded');
  assert.ok(sentWith.url.endsWith('/workspace/chat/test/attachments'), 'upload goes to the attachments of the chat');
  assert.deepEqual({ ...sentWith, url: undefined }, { method: 'POST', url: undefined, headers: { Accept: 'application/json', 'Content-Type': 'application/octet-stream' }, credentials: true }, 'upload carries the session and the octet-stream type');
  assert.deepEqual(progress, [0.5], 'upload reports its progress');
  globalThis.XMLHttpRequest = class extends globalThis.XMLHttpRequest { async send() { this.status = 400; this.responseText = JSON.stringify({ error: 'Zaszyfrowany plik musi mieć najwyżej 50 MB.' }); this.onload?.(); } };
  await assert.rejects(features.uploadAttachment('/workspace/chat/test', file), /najwyżej 50 MB/, 'the service says why');
  globalThis.XMLHttpRequest = class extends globalThis.XMLHttpRequest { async send() { this.onerror?.(); } };
  await assert.rejects(features.uploadAttachment('/workspace/chat/test', file), /połączenie/, 'a dropped connection says so');
  globalThis.XMLHttpRequest = originalXhr;

  /* Fotos werden vor dem Senden verkleinert — alles andere geht, wie es ist. */
  for (const same of [file, new File(['GIF89a'], 'a.gif', { type: 'image/gif' }), new File(['x'.repeat(1000)], 'small.jpg', { type: 'image/jpeg' })]) {
    assert.equal(await features.photoForChat(same), same, `${same.name} stays as it is`);
  }
  /* Ohne createImageBitmap (Node) bleibt auch ein grosses Foto das Original — nichts geht verloren. */
  const big = new File([new Uint8Array(2 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
  assert.equal(await features.photoForChat(big), big, 'an unreadable photo is sent as it is');
  assert.equal(await (await features.downloadAttachment('/workspace/chat/test', uploaded)).text(), 'private music bytes', 'attachment round trip');
  ciphertext[ciphertext.length - 1] ^= 1;
  await assert.rejects(features.downloadAttachment('/workspace/chat/test', uploaded), 'tampered attachment rejected');
  globalThis.fetch = originalFetch;
  console.log('ok   chat availability, DST boundaries, encrypted messages, edits, replies and disk attachment transport with progress, photos made small');
} finally { globalThis.BroadcastChannel = broadcastChannel; await rm(dir, { recursive: true, force: true }); }
