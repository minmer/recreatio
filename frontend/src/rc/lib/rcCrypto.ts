/**
 * Anhang C — Kryptografische Konstruktion, Browserseite.
 *
 * Diese Datei MUSS bitgenau dieselben Ergebnisse liefern wie `Rc.Kernel` in
 * `backend/Rc.Kernel/RcCrypto.cs`. Die Testvektoren aus 21.9 laufen auf beiden
 * Seiten; weichen sie ab, entstehen Daten, die niemand mehr öffnet.
 *
 * Grundsatz 8 / 1.3: Die Kryptoschicht MUSS verschiebbar sein. Kein Modul darf
 * unterstellen, wo entschlüsselt wird. Deshalb liegt hier eine Schnittstelle
 * und kein direkter Aufruf von `crypto.subtle` im Anwendungscode.
 */

export const RC_KEY_SIZE = 32;
export const RC_NONCE_SIZE = 12;
export const RC_TAG_SIZE = 16;
export const RC_HEADER_SIZE = 20;
export const RC_FORMAT_VERSION = 0x01;

export enum RcAlg {
  AesGcm256 = 0x01,
  RsaOaep4096 = 0x02
}

/** 21.7 — Diese Liste ist abschließend. Eine neue Ableitung braucht eine neue
 *  Zeile hier UND in `RcCrypto.cs`. Zwei Ableitungen mit derselben Info aus
 *  demselben Schlüssel ergeben denselben Schlüssel, und das ist fast nie
 *  beabsichtigt. */
export const rcInfo = {
  roleRead: (roleId: string) => `recreatio:v1:role-read:${roleId}`,
  keyId: 'recreatio:v1:keyid',
  sharedView: (viewId: string) => `recreatio:v1:shared-view:${viewId}`,
  cacheUnwrap: (sessionId: string) => `recreatio:v1:cache-unwrap:${sessionId}`,
  accountCommitment: (saltHex: string) => `recreatio:v1:account-commitment:${saltHex}`
} as const;

const utf8 = new TextEncoder();
const EXTRACT_SALT = new Uint8Array(32); // 32 × 0x00 (21.7)

export function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Hexzeichenkette mit ungerader Länge.');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** Eigener Puffer, damit kein `SharedArrayBuffer` an WebCrypto gerät. */
function view(b: Uint8Array): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

// --- Ableitung --------------------------------------------------------------

export async function derive(ikm: Uint8Array, info: string, lengthBytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', view(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: view(EXTRACT_SALT), info: view(utf8.encode(info)) },
    key,
    lengthBytes * 8
  );
  return new Uint8Array(bits);
}

/** 21.6 — RoleReadKey aus dem Wurzelschlüssel. */
export const deriveRoleReadKey = (masterKey: Uint8Array, roleId: string) =>
  derive(masterKey, rcInfo.roleRead(roleId), RC_KEY_SIZE);

/** 21.5 — Sagt, welcher Schlüssel eine Hülle öffnet, ohne ihn zu verraten. */
export const keyId = (symmetricKey: Uint8Array) => derive(symmetricKey, rcInfo.keyId, 16);

// --- AAD (3.13) -------------------------------------------------------------

/** Die feste Aufzählung. Ein Tippfehler darf nicht zu einem stillschweigend
 *  anderen Etikett führen — deshalb kein freier String. Spiegelt `RcField`. */
export const RcField = {
  AccountMasterKey: 'masterkey',
  RoleSignPrivate: 'sign_private',
  RoleWrapPrivate: 'wrap_private',
  RoleDisplayName: 'display_name',
  MessageBody: 'body',
  TopicTitle: 'title',
  DecisionBody: 'body',
  PollQuestion: 'question',
  PollChoice: 'choice',
  DraftBody: 'draft',
  ParticipantCardData: 'card_data',
  ParticipantCardConsents: 'card_consents',
  ParticipantCardClause: 'card_clause',
  CalendarEventTitle: 'event_title',
  CalendarEventLocation: 'event_location',
  CalendarEventDescription: 'event_description',
  ParishDonorName: 'donor_name',
  ParishDonationAmount: 'amount',
  ContactPhone: 'phone',

  // Firmung — der empfindlichste Teil. Kandidaten sind Minderjaehrige, und
  // jedes Feld traegt sein eigenes Etikett: ein einziger Klumpen liesse sich
  // gegen den eines anderen Kindes tauschen, ohne dass etwas auffiele.
  // Dieselben Zeichenketten wie in RcAad.FieldName.
  CandidateName: 'candidate_name',
  CandidateBorn: 'candidate_born',
  CandidateContact: 'candidate_contact',
  CandidateSchool: 'candidate_school',

  // Das Portalgeheimnis reist an einem ANDEREN Platz als der
  // Sitzungsschluessel — beide gehoeren derselben Anmeldung und sind zwei
  // verschiedene Dinge.
  InvitationRoleKey: 'invite_key',

  // Belegung. Je Feld ein eigenes Etikett — dieselben Zeichenketten wie in
  // `RcAad.FieldName`; weicht eine ab, geht die Anfrage nie wieder auf.
  EnquiryGroupName: 'enquiry_group_name',
  EnquiryContactPerson: 'enquiry_contact_person',
  EnquiryContact: 'enquiry_contact',
  EnquiryGroupKind: 'enquiry_group_kind',
  EnquiryNote: 'enquiry_note',
  EnquiryIntakeKey: 'enquiry_intake_key',

  // Veranstaltungen. Nur die, die der Browser wirklich anfasst — die übrigen
  // bleiben serverseitig, und ein Name, der hier ungenutzt steht, ist eine
  // Einladung, ihn irgendwann falsch zu benutzen.
  EventAnswer: 'answer',
  EventIntakeKey: 'intake_key'
} as const;

export type RcFieldName = (typeof RcField)[keyof typeof RcField];

export interface RcAad {
  readonly module: string;
  readonly objectType: string;
  readonly objectId: string;
  readonly field: RcFieldName;
  readonly version: number;
}

/** Alle fünf Werte sind Pflicht. Es gibt bewusst keine Überladung ohne
 *  Feldnamen — genau eine solche Hilfsfunktion hat den Altzustand erzeugt. */
export function rcAad(
  module: string,
  objectType: string,
  objectId: string,
  field: RcFieldName,
  version: number
): RcAad {
  if (!module || !objectType || !objectId) throw new Error('AAD unvollständig.');
  if (module.includes(':') || objectType.includes(':')) {
    throw new Error('Doppelpunkt ist das Trennzeichen und darf in den Teilen nicht vorkommen.');
  }
  if (!Number.isInteger(version) || version < 1) throw new Error('Version beginnt bei 1.');
  return { module, objectType, objectId, field, version };
}

export const aadText = (a: RcAad) =>
  `${a.module}:${a.objectType}:${a.objectId}:${a.field}:${a.version}`;

/** 3.13 — Die Version steigt nur bei inhaltlicher Änderung. Sie ist kein
 *  Formatkennzeichen; dafür gibt es den Klartext-Kopf. */
export const nextVersion = (a: RcAad): RcAad => ({ ...a, version: a.version + 1 });

// --- Kopf (21.3) ------------------------------------------------------------

export function buildHeader(alg: RcAlg, kid: Uint8Array): Uint8Array {
  if (kid.length !== 16) throw new Error('KeyId muss 16 Byte lang sein.');
  const h = new Uint8Array(RC_HEADER_SIZE);
  h[0] = 0x52; // 'R'
  h[1] = 0x43; // 'C'
  h[2] = RC_FORMAT_VERSION;
  h[3] = alg;
  h.set(kid, 4);
  return h;
}

export interface RcHeader {
  version: number;
  alg: RcAlg;
  keyId: Uint8Array;
}

/** 21.3 — Magic und Formatversion werden geprüft, BEVOR irgendetwas anderes
 *  geschieht. Eine unbekannte AlgId ist ein Fehler, kein Anlass zum Raten. */
export function readHeader(blob: Uint8Array): RcHeader {
  if (blob.length < RC_HEADER_SIZE) throw new RcDecryptError('crypto.malformed', 'Hülle kürzer als der Kopf.');
  if (blob[0] !== 0x52 || blob[1] !== 0x43) {
    throw new RcDecryptError('crypto.malformed', 'Kein Recreatio-Blob (Magic fehlt).');
  }
  if (blob[2] !== RC_FORMAT_VERSION) {
    throw new RcDecryptError('crypto.unknown_format', `Formatversion ${blob[2]} ist unbekannt.`);
  }
  const alg = blob[3] as RcAlg;
  if (alg !== RcAlg.AesGcm256 && alg !== RcAlg.RsaOaep4096) {
    throw new RcDecryptError('crypto.unknown_algorithm', `AlgId 0x${blob[3].toString(16)} ist unbekannt.`);
  }
  return { version: blob[2], alg, keyId: blob.slice(4, 20) };
}

/** 21.4 — Der Kopf ist mitauthentifiziert. Ohne das ließe sich die AlgId
 *  ändern und ein Klient auf ein schwächeres Verfahren locken. */
const fullAad = (header: Uint8Array, a: RcAad) => concat(header, utf8.encode(aadText(a)));

// --- Versiegeln und Öffnen --------------------------------------------------

/** 21.2 — Nonce aus dem Zufallsgenerator des Betriebssystems. Kein Zähler,
 *  kein Zeitstempel. Ein Nonce wird niemals mit demselben Schlüssel zweimal
 *  benutzt: bei AES-GCM ist das der Verlust der Vertraulichkeit BEIDER
 *  Nachrichten. */
export async function seal(key: Uint8Array, aad: RcAad, plaintext: Uint8Array): Promise<Uint8Array> {
  return sealWithNonce(key, aad, plaintext, crypto.getRandomValues(new Uint8Array(RC_NONCE_SIZE)));
}

export const sealText = (key: Uint8Array, aad: RcAad, text: string) =>
  seal(key, aad, utf8.encode(text));

/** Nur für Testvektoren. Produktivcode nutzt `seal`. */
export async function sealWithNonce(
  key: Uint8Array,
  aad: RcAad,
  plaintext: Uint8Array,
  nonce: Uint8Array
): Promise<Uint8Array> {
  if (key.length !== RC_KEY_SIZE) throw new Error('Schlüssel muss 32 Byte lang sein.');
  if (nonce.length !== RC_NONCE_SIZE) throw new Error('Nonce muss 12 Byte lang sein.');

  const header = buildHeader(RcAlg.AesGcm256, await keyId(key));
  const ck = await crypto.subtle.importKey('raw', view(key), 'AES-GCM', false, ['encrypt']);
  // WebCrypto liefert Ciphertext und Tag zusammenhängend.
  const sealedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: view(nonce), additionalData: view(fullAad(header, aad)), tagLength: RC_TAG_SIZE * 8 },
    ck,
    view(plaintext)
  );
  return concat(header, nonce, new Uint8Array(sealedBuf));
}

export async function open(key: Uint8Array, aad: RcAad, blob: Uint8Array): Promise<Uint8Array> {
  const header = readHeader(blob);
  if (header.alg !== RcAlg.AesGcm256) {
    throw new RcDecryptError('crypto.unknown_algorithm', 'Erwartet wurde eine AES-GCM-Hülle.');
  }
  if (blob.length < RC_HEADER_SIZE + RC_NONCE_SIZE + RC_TAG_SIZE) {
    throw new RcDecryptError('crypto.malformed', `Hülle zu kurz: ${blob.length} Byte.`);
  }

  const nonce = blob.slice(RC_HEADER_SIZE, RC_HEADER_SIZE + RC_NONCE_SIZE);
  const rest = blob.slice(RC_HEADER_SIZE + RC_NONCE_SIZE);
  const ck = await crypto.subtle.importKey('raw', view(key), 'AES-GCM', false, ['decrypt']);
  try {
    const pt = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: view(nonce),
        additionalData: view(fullAad(blob.slice(0, RC_HEADER_SIZE), aad)),
        tagLength: RC_TAG_SIZE * 8
      },
      ck,
      view(rest)
    );
    return new Uint8Array(pt);
  } catch {
    // 15.9: Kein Klartext ins Protokoll. Die AAD ist unverschlüsselt und darf
    // mitgegeben werden — sie ist genau die Angabe, die bei der Eingrenzung hilft.
    throw new RcDecryptError('crypto.aad_mismatch', `Integritätsprüfung fehlgeschlagen für AAD '${aadText(aad)}'.`);
  }
}

export async function openText(key: Uint8Array, aad: RcAad, blob: Uint8Array): Promise<string> {
  return new TextDecoder().decode(await open(key, aad, blob));
}

/** 15.9 — Vier unterscheidbare Ursachen. Ein einziges `decrypt_failed` reicht
 *  nicht: der Betreiber, der die Inhalte nicht lesen darf, hätte sonst kein
 *  Mittel zur Eingrenzung. Die Kennung folgt 15.7. */
export class RcDecryptError extends Error {
  constructor(
    public readonly code:
      | 'crypto.missing_epoch'
      | 'crypto.missing_key'
      | 'crypto.aad_mismatch'
      | 'crypto.malformed'
      | 'crypto.unknown_format'
      | 'crypto.unknown_algorithm'
      | 'crypto.wrong_key',
    message: string
  ) {
    super(message);
    this.name = 'RcDecryptError';
  }
}

export const newSymmetricKey = () => crypto.getRandomValues(new Uint8Array(RC_KEY_SIZE));

// --- Verpacken unter einem öffentlichen Schlüssel (21.4) --------------------

/** 21.3 — Die ersten 16 Byte von SHA-256 über die SPKI-Form. */
export async function keyIdFromPublicKey(spkiDer: Uint8Array): Promise<Uint8Array> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', spkiDer as BufferSource));
  return digest.slice(0, 16);
}

/**
 * Einen symmetrischen Schlüssel unter einem öffentlichen RSA-Schlüssel
 * verpacken — bitgenau so, wie es der Kernel in `RcCrypto.WrapKey` tut.
 *
 * Gebraucht wird das an genau einer Stelle: wenn sich jemand OHNE Konto zu
 * einer Veranstaltung anmeldet. Er hat keinen Schlüssel, die Antworten sollen
 * trotzdem nur die Vorbereitenden lesen können, und der Server soll sie
 * ausdrücklich NICHT sehen. Also würfelt dieser Browser einen
 * Sitzungsschlüssel, versiegelt damit die Antworten und verpackt ihn hier.
 *
 * **Warum das Label im Klartext steckt.** RSA-OAEP kennt einen
 * Label-Parameter, aber weder .NET noch WebCrypto geben darauf Zugriff
 * (Befund 34). Der Kernel stellt das Label deshalb dem Klartext voran und
 * prüft es beim Auspacken in fester Zeit. Diese Seite muss es genauso machen
 * — nicht weil es schöner wäre, sondern weil sonst nichts aufgeht.
 *
 * Ein Fehler hier fällt NICHT beim Schreiben auf. Er fällt Wochen später auf,
 * wenn jemand eine Anmeldeliste öffnen will und sie nicht aufgeht. Deshalb
 * rechnen beide Seiten denselben Testvektor nach.
 */
export async function wrapKey(
  spkiDer: Uint8Array,
  aad: RcAad,
  keyToWrap: Uint8Array
): Promise<Uint8Array> {
  const kid = await keyIdFromPublicKey(spkiDer);
  const header = buildHeader(RcAlg.RsaOaep4096, kid);

  // Das Label bindet die Hülle an ihren Platz — dieselbe Zeichenkette, die bei
  // AES-GCM als AAD mitläuft.
  const label = new Uint8Array(
    await crypto.subtle.digest('SHA-256', fullAad(header, aad) as BufferSource)
  );

  const publicKey = await crypto.subtle.importKey(
    'spki',
    spkiDer as BufferSource,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );

  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      concat(label, keyToWrap) as BufferSource
    )
  );

  return concat(header, ct);
}
