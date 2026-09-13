/**
 * Anhang C — Der Kernel, Browserseite.
 *
 * <b>Diese Datei MUSS bitgenau dasselbe liefern wie `backend/Kernel/Crypto.cs`.</b>
 * Weicht sie ab, entstehen Hüllen, die niemand mehr öffnet — und zwar lautlos,
 * Wochen später.
 *
 * <b>Warum der Browser das überhaupt rechnet.</b> Der Dienst hält keine
 * Schlüssel. Er kann den Namen einer Rolle weder lesen noch setzen, und er kann
 * keine Kante unterschreiben. Wer das kann, ist der, dessen Rolle es betrifft —
 * hier, auf seinem Gerät. Der Altbestand schickte dafür ein „Öffnungsstück" an
 * den Server und liess ihn rechnen; das ist genau die Abkürzung, die der Neubau
 * nicht nimmt.
 *
 * Die Kette, an deren Ende ein lesbarer Name steht:
 *
 *   PasswordKey ──► master_key_sealed ──► MasterKey
 *                                          │ HKDF(role-read:<persönliche Rolle>)
 *                                          ▼
 *                                     Rollenschlüssel
 *                                          │ öffnet wrap_private_sealed
 *                                          ▼
 *                                     RSA-Privatschlüssel
 *                                          │ packt key_grant aus
 *                                          ▼
 *                                  Schlüssel der Unterrolle ──► display_name
 */

import { serialize, type Canon } from './canonical';

export const KEY_SIZE = 32;
export const NONCE_SIZE = 12;
export const TAG_SIZE = 16;
export const HEADER_SIZE = 20;
export const FORMAT_VERSION = 0x01;
export const SALT_SIZE = 16;

/** 21.6 — Zwei Paare, und beide 4096 Bit. Der Kernel legt das fest. */
export const RSA_BITS = 4096;

/** 21.1 — RSA-PSS mit SHA-256, MGF1-SHA-256, Salzlänge 32. */
export const PSS_SALT_BYTES = 32;

export const Alg = { AesGcm256: 0x01, RsaOaep4096: 0x02 } as const;
export type AlgId = (typeof Alg)[keyof typeof Alg];

/**
 * 3.13 — Die feste Aufzählung. Dieselben Zeichenketten wie `Aad.FieldName` im
 * Kernel; ein Tippfehler hier ergibt ein stillschweigend anderes Etikett, und
 * die Hülle geht nie wieder auf.
 *
 * Nur, was der Browser wirklich anfasst. Ein Name, der hier ungenutzt steht,
 * ist eine Einladung, ihn irgendwann falsch zu benutzen.
 */
export const Field = {
  AccountMasterKey: 'masterkey',
  RoleSignPrivate: 'sign_private',
  RoleWrapPrivate: 'wrap_private',
  RoleDisplayName: 'display_name'
} as const;

export type FieldName = (typeof Field)[keyof typeof Field];

export interface Aad {
  readonly module: string;
  readonly objectType: string;
  readonly objectId: string;
  readonly field: FieldName;
  readonly version: number;
}

/** Alle fünf Werte sind Pflicht — es gibt bewusst keine bequeme Kurzform. */
export function aad(
  module: string, objectType: string, objectId: string, field: FieldName, version: number
): Aad {
  if (!module || !objectType || !objectId) throw new Error('AAD unvollständig.');
  if (module.includes(':') || objectType.includes(':')) {
    throw new Error('Doppelpunkt trennt die Teile und darf in ihnen nicht vorkommen.');
  }
  if (!Number.isInteger(version) || version < 1) throw new Error('Version beginnt bei 1.');
  return { module, objectType, objectId, field, version };
}

export const aadText = (a: Aad): string =>
  `${a.module}:${a.objectType}:${a.objectId}:${a.field}:${a.version}`;

/* -- Kleinkram -------------------------------------------------------------- */

const utf8 = new TextEncoder();

/** 21.7 — HKDF-Extract mit 32 Null-Bytes als Salz. */
const EXTRACT_SALT = new Uint8Array(32);

/** Eigener Puffer: WebCrypto nimmt keinen `SharedArrayBuffer`. */
const view = (b: Uint8Array): ArrayBuffer =>
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

export const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const fromBase64Url = (text: string): Uint8Array => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));

  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
};

export const toHex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** Ohne frühen Ausstieg: die Laufzeit soll nicht verraten, wie weit es passte. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Was beim Öffnen schiefgehen kann — mit Grund, nicht als ein „ging nicht". */
export class SealedError extends Error {}

/* -- Ableitung (21.7) ------------------------------------------------------- */

export async function derive(ikm: Uint8Array, info: string, lengthBytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', view(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: view(EXTRACT_SALT), info: view(utf8.encode(info)) },
    key,
    lengthBytes * 8
  );
  return new Uint8Array(bits);
}

/**
 * 21.6 — Der Schlüssel der PERSÖNLICHEN Rolle: abgeleitet, nirgends gespeichert.
 * Für jede andere Rolle gibt es ihn nicht abzuleiten, sondern auszupacken
 * (`key_grant`) — eine Rolle mit mehreren Haltern kann nicht aus einem einzigen
 * Wurzelschlüssel folgen.
 */
export const deriveRoleReadKey = (masterKey: Uint8Array, roleId: string) =>
  derive(masterKey, `recreatio:v1:role-read:${roleId}`, KEY_SIZE);

export const keyId = (symmetricKey: Uint8Array) =>
  derive(symmetricKey, 'recreatio:v1:keyid', 16);

/** 21.5 — Erste 16 Byte von SHA-256 über die SPKI-Form. */
export async function keyIdFromPublicKey(spki: Uint8Array): Promise<Uint8Array> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', view(spki)));
  return digest.slice(0, 16);
}

/* -- Kopf (21.3) ------------------------------------------------------------ */

export function buildHeader(alg: AlgId, kid: Uint8Array): Uint8Array {
  if (kid.length !== 16) throw new Error('KeyId muss 16 Byte lang sein.');

  const h = new Uint8Array(HEADER_SIZE);
  h[0] = 0x52; // 'R'
  h[1] = 0x43; // 'C'
  h[2] = FORMAT_VERSION;
  h[3] = alg;
  h.set(kid, 4);
  return h;
}

export interface Header { readonly alg: AlgId; readonly keyId: Uint8Array }

/** Magic und Formatversion werden geprüft, BEVOR irgendetwas anderes geschieht. */
export function readHeader(blob: Uint8Array): Header {
  if (blob.length < HEADER_SIZE) throw new SealedError('Hülle kürzer als der Kopf.');
  if (blob[0] !== 0x52 || blob[1] !== 0x43) throw new SealedError('Kein Recreatio-Blob.');
  if (blob[2] !== FORMAT_VERSION) throw new SealedError(`Formatversion ${blob[2]} ist unbekannt.`);

  const alg = blob[3] as AlgId;
  if (alg !== Alg.AesGcm256 && alg !== Alg.RsaOaep4096) {
    throw new SealedError(`AlgId 0x${blob[3].toString(16)} ist unbekannt.`);
  }
  return { alg, keyId: blob.slice(4, 20) };
}

/** 21.4 — Der Kopf ist mitauthentifiziert; sonst liesse sich die AlgId tauschen. */
const fullAad = (header: Uint8Array, a: Aad) => concat(header, utf8.encode(aadText(a)));

/* -- Versiegeln und Öffnen -------------------------------------------------- */

export async function seal(key: Uint8Array, a: Aad, plaintext: Uint8Array): Promise<Uint8Array> {
  if (key.length !== KEY_SIZE) throw new Error('Schlüssel muss 32 Byte lang sein.');

  // 21.2 — Nonce aus dem Zufallsgenerator. Kein Zähler, kein Zeitstempel:
  // zweimal derselbe Nonce unter demselben Schlüssel kostet die
  // Vertraulichkeit BEIDER Nachrichten.
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_SIZE));
  const header = buildHeader(Alg.AesGcm256, await keyId(key));

  const ck = await crypto.subtle.importKey('raw', view(key), 'AES-GCM', false, ['encrypt']);
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: view(nonce), additionalData: view(fullAad(header, a)), tagLength: TAG_SIZE * 8 },
    ck,
    view(plaintext)
  );

  return concat(header, nonce, new Uint8Array(sealed));
}

export const sealText = (key: Uint8Array, a: Aad, text: string) => seal(key, a, utf8.encode(text));

export async function open(key: Uint8Array, a: Aad, blob: Uint8Array): Promise<Uint8Array> {
  const header = readHeader(blob);
  if (header.alg !== Alg.AesGcm256) throw new SealedError('Erwartet wurde eine AES-GCM-Hülle.');
  if (blob.length < HEADER_SIZE + NONCE_SIZE + TAG_SIZE) {
    throw new SealedError(`Hülle zu kurz: ${blob.length} Byte.`);
  }

  const nonce = blob.slice(HEADER_SIZE, HEADER_SIZE + NONCE_SIZE);
  const rest = blob.slice(HEADER_SIZE + NONCE_SIZE);
  const ck = await crypto.subtle.importKey('raw', view(key), 'AES-GCM', false, ['decrypt']);

  try {
    const plain = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: view(nonce),
        additionalData: view(fullAad(blob.slice(0, HEADER_SIZE), a)),
        tagLength: TAG_SIZE * 8
      },
      ck,
      view(rest)
    );
    return new Uint8Array(plain);
  } catch {
    // Kein Klartext ins Protokoll (15.9). Die AAD ist unverschlüsselt und
    // genau die Angabe, die beim Eingrenzen hilft.
    throw new SealedError(`Integritätsprüfung fehlgeschlagen für '${aadText(a)}'.`);
  }
}

export const openText = async (key: Uint8Array, a: Aad, blob: Uint8Array): Promise<string> =>
  new TextDecoder().decode(await open(key, a, blob));

/* -- Verpacken unter einem fremden öffentlichen Schlüssel (21.4) ------------ */

/**
 * <b>Das Label steckt im Klartext</b>, weil weder .NET noch WebCrypto Zugriff
 * auf den OAEP-Label-Parameter geben (Befund 34). Der Kernel stellt es dem
 * Klartext voran und prüft es beim Auspacken in fester Zeit; diese Seite muss
 * es genauso machen — nicht weil es schöner wäre, sondern weil sonst nichts
 * aufgeht.
 */
export async function wrapKey(spki: Uint8Array, a: Aad, keyToWrap: Uint8Array): Promise<Uint8Array> {
  const header = buildHeader(Alg.RsaOaep4096, await keyIdFromPublicKey(spki));
  const label = new Uint8Array(await crypto.subtle.digest('SHA-256', view(fullAad(header, a))));

  const publicKey = await crypto.subtle.importKey(
    'spki', view(spki), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);

  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' }, publicKey, view(concat(label, keyToWrap))));

  return concat(header, ct);
}

/** Die Gegenrichtung. Fehlte im Altbestand — der Browser packte dort nie aus. */
export async function unwrapKey(pkcs8: Uint8Array, a: Aad, blob: Uint8Array): Promise<Uint8Array> {
  const header = readHeader(blob);
  if (header.alg !== Alg.RsaOaep4096) throw new SealedError('Erwartet wurde eine RSA-verpackte Hülle.');

  const privateKey = await crypto.subtle.importKey(
    'pkcs8', view(pkcs8), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);

  let payload: Uint8Array;
  try {
    payload = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' }, privateKey, view(blob.slice(HEADER_SIZE))));
  } catch {
    throw new SealedError('Verpackung liess sich nicht öffnen.');
  }

  const expected = new Uint8Array(
    await crypto.subtle.digest('SHA-256', view(fullAad(blob.slice(0, HEADER_SIZE), a))));

  if (payload.length < expected.length || !sameBytes(payload.slice(0, expected.length), expected)) {
    throw new SealedError(`Label passt nicht zur AAD '${aadText(a)}'.`);
  }

  return payload.slice(expected.length);
}

/* -- Schlüssel einer neuen Rolle (21.6) ------------------------------------- */

export interface RolePair {
  readonly signPublicKey: Uint8Array;
  readonly signPrivateKey: Uint8Array;
  readonly wrapPublicKey: Uint8Array;
  readonly wrapPrivateKey: Uint8Array;
}

/**
 * ZWEI Paare: denselben RSA-Schlüssel zum Unterschreiben und zum Verpacken zu
 * benutzen ist eine bekannte Schwäche (21.6).
 *
 * Das dauert Sekunden — auf einem Telefon auch zehn. Wer das aufruft, sagt es
 * dem Menschen davor vorher, sonst sieht die Oberfläche kaputt aus.
 */
export async function newRolePair(): Promise<RolePair> {
  const exponent = new Uint8Array([1, 0, 1]);

  const [sign, wrap] = await Promise.all([
    crypto.subtle.generateKey(
      { name: 'RSA-PSS', modulusLength: RSA_BITS, publicExponent: exponent, hash: 'SHA-256' },
      true, ['sign', 'verify']),
    crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: RSA_BITS, publicExponent: exponent, hash: 'SHA-256' },
      true, ['encrypt', 'decrypt'])
  ]);

  const [signPublicKey, signPrivateKey, wrapPublicKey, wrapPrivateKey] = await Promise.all([
    crypto.subtle.exportKey('spki', sign.publicKey),
    crypto.subtle.exportKey('pkcs8', sign.privateKey),
    crypto.subtle.exportKey('spki', wrap.publicKey),
    crypto.subtle.exportKey('pkcs8', wrap.privateKey)
  ]);

  return {
    signPublicKey: new Uint8Array(signPublicKey),
    signPrivateKey: new Uint8Array(signPrivateKey),
    wrapPublicKey: new Uint8Array(wrapPublicKey),
    wrapPrivateKey: new Uint8Array(wrapPrivateKey)
  };
}

/**
 * Eine kanonische Form unterschreiben.
 *
 * <b>Der Dienst rechnet den Hash selbst.</b> Er unterschreibt nicht — er
 * PRÜFT, mit dem öffentlichen Schlüssel, den er ohnehin hat. Deshalb steht
 * hier der ganze Beweis, dass die Kante von einem Halter kommt und nicht aus
 * einem INSERT.
 *
 * WebCrypto hasht die Nachricht selbst; der Kernel unterschreibt den fertigen
 * Hash. Gleich ist beides, solange hier die kanonischen BYTES hineingehen und
 * nicht deren Hash.
 */
export async function signCanonical(signPkcs8: Uint8Array, value: Canon): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'pkcs8', view(signPkcs8), { name: 'RSA-PSS', hash: 'SHA-256' }, false, ['sign']);

  const signature = await crypto.subtle.sign(
    { name: 'RSA-PSS', saltLength: PSS_SALT_BYTES }, key, view(utf8.encode(serialize(value))));

  return new Uint8Array(signature);
}
