/**
 * Prüfreihe für die Browserseite.
 *
 * Dieselben Testvektoren, die `Rc.Kernel.Tests` auf dem Server nachrechnet
 * (Anhang C 21.9, Anhang D 22.5). Client und Server müssen bitgenau
 * übereinstimmen; laufen sie auseinander, entstehen Daten, die niemand mehr
 * öffnet — und zwar lautlos, bis jemand eine alte Nachricht aufruft.
 *
 * Läuft in der Oberfläche unter /#/new. Kein Testrahmen von außen, damit die
 * Prüfung auch im ausgelieferten Stand möglich bleibt: Wer wissen will, ob
 * seine Fassung stimmt, klickt und sieht es.
 */

import {
  RcAlg, RcField, aadText, buildHeader, derive, deriveRoleReadKey, fromHex, keyId,
  nextVersion, open, openText, rcAad, readHeader, RcDecryptError, sealWithNonce, toHex
} from './rcCrypto';
import { rcCanonicalize, rcCanonicalHash, rcIsVersion7, rcNewId, rcParseId, rcTimestampHint } from './rcFormat';
import { rcDerivePasswordKey } from './rcAuth';

export interface RcTestResult {
  readonly name: string;
  readonly passed: boolean;
  readonly expected?: string;
  readonly actual?: string;
}

export interface RcTestReport {
  readonly results: readonly RcTestResult[];
  readonly passed: number;
  readonly failed: number;
  readonly durationMs: number;
}

const MASTER_KEY = fromHex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
const EPOCH_KEY = fromHex('a0a1a2a3a4a5a6a7a8a9aaabacadaeafa0a1a2a3a4a5a6a7a8a9aaabacadaeaf');
const ROLE_ID = '01937d4e-8f2a-7c31-9b05-2f6a1e8c4d77';

export async function runRcSelfTest(): Promise<RcTestReport> {
  const started = performance.now();
  const results: RcTestResult[] = [];

  const eq = (name: string, actual: string, expected: string) =>
    results.push({ name, passed: actual === expected, expected, actual });

  const ok = async (name: string, fn: () => boolean | Promise<boolean>) => {
    try {
      results.push({ name, passed: await fn() });
    } catch (e) {
      results.push({ name, passed: false, actual: e instanceof Error ? e.message : String(e) });
    }
  };

  // --- Anhang C: Ableitung -------------------------------------------------

  const roleReadKey = await deriveRoleReadKey(MASTER_KEY, ROLE_ID);
  eq('TV-1  RoleReadKey', toHex(roleReadKey),
    '0d73186dc9209c184f70dcace671052920e5aa888b68381be27c10fa570645d6');

  eq('TV-2  KeyId (symmetrisch)', toHex(await keyId(roleReadKey)),
    '71c0ce10a2cd8cd62e722970c823b33d');

  const epochKeyId = await keyId(EPOCH_KEY);
  eq('TV-3  KeyId des EpochKey', toHex(epochKeyId), '0abee07b44f9704ea3a023596d74ee51');

  // --- Anhang C: versiegelte Hülle -----------------------------------------

  const aad = rcAad('chat', 'message', ROLE_ID, RcField.MessageBody, 1);
  eq('TV-4  AAD-Zeichenkette', aadText(aad),
    'chat:message:01937d4e-8f2a-7c31-9b05-2f6a1e8c4d77:body:1');

  eq('TV-4  Kopf', toHex(buildHeader(RcAlg.AesGcm256, epochKeyId)),
    '524301010abee07b44f9704ea3a023596d74ee51');

  const blob = await sealWithNonce(
    EPOCH_KEY, aad, new TextEncoder().encode('Guten Morgen.'), fromHex('000102030405060708090a0b'));

  eq('TV-4  Gesamtlänge', String(blob.length), '61');
  eq('TV-4  BLOB', toHex(blob),
    '524301010abee07b44f9704ea3a023596d74ee51' +
    '000102030405060708090a0b' +
    '77cdd1c31cfb6ba7274d8212a7' +
    '08ff048ced9fcb5dda6338a2a44bc6a5');

  eq('TV-4  Rückweg', await openText(EPOCH_KEY, aad, blob), 'Guten Morgen.');

  // --- Negativproben. Sie MÜSSEN scheitern. --------------------------------

  await ok('TV-5  AAD :body:2 scheitert', async () => {
    try { await open(EPOCH_KEY, nextVersion(aad), blob); return false; }
    catch (e) { return e instanceof RcDecryptError && e.code === 'crypto.aad_mismatch'; }
  });

  await ok('TV-6  verfälschte AlgId scheitert', async () => {
    const t = blob.slice(); t[3] = 0x02;
    try { await open(EPOCH_KEY, aad, t); return false; }
    catch (e) { return e instanceof RcDecryptError && e.code === 'crypto.unknown_algorithm'; }
  });

  // Der eigentliche Beweis: der Kopf liegt in der AAD. Nur dann scheitert eine
  // Veränderung, die readHeader passieren lässt.
  await ok('TV-6b verfälschter Kopf scheitert (Kopf ist in der AAD)', async () => {
    const t = blob.slice(); t[19] ^= 0x01;
    try { await open(EPOCH_KEY, aad, t); return false; }
    catch (e) { return e instanceof RcDecryptError && e.code === 'crypto.aad_mismatch'; }
  });

  // Der Angriff, den 3.13 abstellt: Geheimtext ins Nachbarfeld schieben.
  await ok('3.13  Geheimtext im falschen Feld scheitert', async () => {
    const donor = rcAad('parish', 'donation', ROLE_ID, RcField.ParishDonorName, 1);
    const amount = rcAad('parish', 'donation', ROLE_ID, RcField.ParishDonationAmount, 1);
    const sealedDonor = await sealWithNonce(
      EPOCH_KEY, donor, new TextEncoder().encode('Maria Kowalska'), fromHex('0b0a09080706050403020100'));
    try { await open(EPOCH_KEY, amount, sealedDonor); return false; }
    catch (e) { return e instanceof RcDecryptError && e.code === 'crypto.aad_mismatch'; }
  });

  await ok('21.3  Fremdes Magic wird abgelehnt', () => {
    const t = blob.slice(); t[0] = 0x00;
    try { readHeader(t); return false; }
    catch (e) { return e instanceof RcDecryptError && e.code === 'crypto.malformed'; }
  });

  // --- Anhang D: kanonische Serialisierung ---------------------------------

  eq('TV-7  Sortierung',
    rcCanonicalize({ b: 1, a: 2, A: 3, 'ä': 4, z: 5, Z: 6, '10': 7, '2': 8 }),
    '{"10":7,"2":8,"A":3,"Z":6,"a":2,"b":1,"z":5,"ä":4}');

  eq('TV-8  UTF-8-Bytes',
    toHex(new TextEncoder().encode(rcCanonicalize({
      text: 'Zeile1\nZeile2\t"zitiert"\\ende',
      umlaut: 'Grüße, Świętosław'
    }))),
    '7b2274657874223a225a65696c65315c6e5a65696c65325c745c227a6974696572745c22' +
    '5c5c656e6465222c22756d6c617574223a224772c3bcc39f652c20c59a7769c499746f73' +
    'c5826177227d');

  const entry1 = {
    accountCommitment: '9f2d1a4c7b8e0356a1c4d9f2b7e50318c6a9d4f7b2e58c1a3d6f9b2e5c8a1d4f',
    entryId: '01937d51-0c40-7f18-a2e6-4b91c7d3e550',
    keyVersion: 1,
    ledgerId: '01937d4e-8f2a-7c31-9b05-2f6a1e8c4d77',
    moduleId: 'chat',
    payload: {
      action: 'decision.accepted',
      decisionId: '01937d50-1b22-7a04-8c13-9e2f5a7b6c88',
      titleHash: '3b7c1e9a2d5f8041b6c3e7a9d2f5081c4b7e0a3d6f9c2e5b8a1d4f7c0e3a6b9d'
    },
    previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
    sequence: 1,
    signerKeyFingerprint: '71c0ce10a2cd8cd62e722970c823b33d',
    subjectId: '01937d4f-3a11-7b92-8d47-5c0e2a9f1b63',
    tenantId: '01937d4d-2e08-7c55-9a31-6b4f8d0c7e29',
    timestamp: '2026-08-24T09:15:42Z',
    transactionId: '01937d51-0c40-7f18-a2e6-4b91c7d3e551'
  };

  eq('TV-9  Länge', String(new TextEncoder().encode(rcCanonicalize(entry1)).length), '736');
  eq('TV-9  SHA-256', toHex(await rcCanonicalHash(entry1)),
    'ac183864c2e3756955e859b6bbcc0c1c58722700c36eb35596f0614a7ca1e1fb');

  // TV-10 — dieselben Felder, umgekehrt übergeben. MUSS byteweise gleich sein.
  const reversed: Record<string, unknown> = {};
  for (const k of Object.keys(entry1).reverse()) reversed[k] = (entry1 as Record<string, unknown>)[k];
  eq('TV-10 Reihenfolgeunabhängig', toHex(await rcCanonicalHash(reversed as never)),
    'ac183864c2e3756955e859b6bbcc0c1c58722700c36eb35596f0614a7ca1e1fb');

  eq('TV-11 Verkettung', toHex(await rcCanonicalHash({
    ...entry1,
    sequence: 2,
    previousHash: 'ac183864c2e3756955e859b6bbcc0c1c58722700c36eb35596f0614a7ca1e1fb',
    entryId: '01937d51-0c40-7f18-a2e6-4b91c7d3e552',
    payload: { action: 'message.posted', messageId: '01937d52-4f66-7d10-b8a2-3c7e9d1f5a04' },
    transactionId: '01937d51-0c40-7f18-a2e6-4b91c7d3e553',
    timestamp: '2026-08-24T09:16:03Z'
  })), 'f5a8e0fe244ee33b2e3f3c0e8053abf7ba3a1995d7f2dc85ac1781a1d06c6729');

  await ok('22.3  Gleitkomma wird abgelehnt', () => {
    try { rcCanonicalize({ betrag: 12.5 }); return false; } catch { return true; }
  });

  // --- Anhang E: ID-Format --------------------------------------------------

  await ok('23.1  Erzeugte ID ist UUIDv7', () => rcIsVersion7(rcNewId()));
  await ok('23.1  Zeitstempel plausibel', () => {
    const ts = rcTimestampHint(rcNewId());
    return ts !== null && Math.abs(Date.now() - ts.getTime()) < 10_000;
  });
  await ok('23.1  Sortierbarkeit', () => {
    const a = rcNewId(new Date(1_700_000_000_000));
    const b = rcNewId(new Date(1_700_000_000_001));
    return a < b;
  });
  await ok('23.4  Großbuchstaben werden abgelehnt', () => {
    try { rcParseId('01937D4E-8F2A-7C31-9B05-2F6A1E8C4D77'); return false; } catch { return true; }
  });

  // --- 3.13: Pflichtparameter ----------------------------------------------

  await ok('3.13  Version 0 wird abgelehnt', () => {
    try { rcAad('chat', 'message', ROLE_ID, RcField.MessageBody, 0); return false; } catch { return true; }
  });
  await ok('3.13  Doppelpunkt im Modulnamen wird abgelehnt', () => {
    try { rcAad('ch:at', 'message', ROLE_ID, RcField.MessageBody, 1); return false; } catch { return true; }
  });

  // --- 3.15: Kostenmessung, kein Test --------------------------------------
  // BEFUND 31: Eine Anmeldung kostet zwei Argon2id-Läufe zu je 64 MiB. WebCrypto
  // kennt kein Argon2; es braucht eine WASM-Bibliothek. Bis sie eingebunden ist,
  // wird hier nur die HKDF-Dauer gemessen — sie ist die untere Schranke und
  // zeigt, dass die Ableitungskette selbst nicht das Problem ist.
  const t0 = performance.now();
  for (let i = 0; i < 50; i++) await derive(MASTER_KEY, `recreatio:v1:role-read:${ROLE_ID}`, 32);
  const perDerive = (performance.now() - t0) / 50;
  results.push({
    name: `3.7   HKDF-Ableitung ${perDerive.toFixed(2)} ms (50 Läufe gemittelt)`,
    passed: perDerive < 20
  });

  // --- 21.8: Argon2id, derselbe Vektor wie im Kernel -----------------------
  //
  // Hier hash-wasm, dort Konscious. Zwei Umsetzungen desselben Verfahrens.
  // Laufen sie um ein Bit auseinander, kann sich niemand mehr anmelden — und
  // zwar erst nach der Auslieferung, ohne sichtbaren Fehler, weil ein falscher
  // Schlüssel von einem falschen Passwort nicht zu unterscheiden ist.
  //
  // Der Lauf dauert absichtlich rund eine Sekunde. Er steht am Ende, damit die
  // schnellen Prüfungen vorher schon sichtbar sind.
  const argonStarted = performance.now();
  const passwordKey = await rcDerivePasswordKey(
    'correct horse battery staple',
    fromHex('726372656174696f2d74762d31322d21')
  );
  const argonMs = performance.now() - argonStarted;

  eq('TV-12 Argon2id 64 MiB, t=3, p=1, 32 Byte', toHex(passwordKey),
    '8d653504132471c8cf62ff8f2baeb64467b075d3de7badd53e55620f4edc6d4f');

  // Zu schnell ist hier ein Mangel, kein Vorzug: unter 100 ms stimmen die
  // Parameter nicht, und dann ist das Passwort billiger zu raten als gedacht.
  results.push({
    name: `21.1  Argon2id ${Math.round(argonMs)} ms auf diesem Gerät`,
    passed: argonMs > 100
  });

  return {
    results,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    durationMs: performance.now() - started
  };
}
