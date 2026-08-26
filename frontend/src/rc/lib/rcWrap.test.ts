/**
 * Der Browser-Teil des Verpackungsvektors (21.4).
 *
 * Er liest DIESELBE Datei wie die Kernel-Prüfreihe — `backend/rc-wrap-vector.json`
 * — und rechnet dieselben Bytes nach. Zwei Kopien wären genau der Verzug, den
 * der Vektor verhindern soll: eine Seite wird angefasst, die andere nicht, und
 * beide bleiben grün.
 *
 * **Warum ausgerechnet hier ein Vektor liegt.** RSA-OAEP ist zufällig; zwei
 * Verpackungen desselben Schlüssels sehen verschieden aus. Vergleichen lässt
 * sich alles davor: die Schlüsselkennung und das Label. Genau dort säße ein
 * Formatfehler — und er fiele nicht beim Schreiben auf, sondern Wochen später,
 * wenn jemand eine Anmeldeliste öffnen will und sie nicht aufgeht.
 */

import vector from '../../../../backend/rc-wrap-vector.json';
import { RcAlg, buildHeader, keyIdFromPublicKey, rcAad, toHex, wrapKey, RcField } from './rcCrypto';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

const fromBase64 = (b64: string) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const spki = fromBase64(vector.spkiBase64);

// Die AAD wird aus ihren Teilen gebaut, nicht aus der fertigen Zeichenkette
// gelesen. Stimmen beide überein, ist auch die Zusammensetzung geprüft.
const [module, objectType, objectId, , version] = vector.aadText.split(':');
const aad = rcAad(module, objectType, objectId, RcField.EventAnswer, Number(version));

const run = async () => {
  ok('3.13  Die AAD des Vektors setzt sich genauso zusammen',
    `${aad.module}:${aad.objectType}:${aad.objectId}:${aad.field}:${aad.version}`,
    vector.aadText);

  const kid = await keyIdFromPublicKey(spki);
  ok('21.3  Die Schlüsselkennung stimmt mit dem Vektor überein',
    toHex(kid), vector.keyIdHex);

  const header = buildHeader(RcAlg.RsaOaep4096, kid);
  ok('21.3  Der Kopf stimmt mit dem Vektor überein', toHex(header), vector.headerHex);

  // Das Label ist der Teil, den OAEP nicht selbst trägt (Befund 34) und den
  // beide Seiten deshalb gleich bilden müssen. Es wird hier noch einmal von
  // Hand gerechnet — nicht aus `wrapKey` herausgeholt, denn sonst prüfte der
  // Test die Funktion gegen sich selbst.
  const aadBytes = new TextEncoder().encode(vector.aadText);
  const full = new Uint8Array(header.length + aadBytes.length);
  full.set(header, 0);
  full.set(aadBytes, header.length);

  const label = new Uint8Array(await crypto.subtle.digest('SHA-256', full));
  ok('21.4  Das Label stimmt mit dem Vektor überein', toHex(label), vector.labelHex);

  // Die Verpackung selbst: der Kopf ist vorhersagbar, der Rest nicht.
  const secret = new Uint8Array(32).fill(7);
  const wrapped = await wrapKey(spki, aad, secret);

  ok('21.3  Die Verpackung trägt den erwarteten Kopf',
    toHex(wrapped.slice(0, 20)), vector.headerHex);

  // RSA-4096 mit OAEP-SHA256 liefert 512 Byte Geheimtext. Zusammen mit dem
  // 20-Byte-Kopf sind das 532 — die Zusage aus 21.3, und sie hält nur, solange
  // Label (32) und Schlüssel (32) unter den 446 Byte bleiben, die OAEP fasst.
  ok('21.3  Die Verpackung ist 532 Byte lang', wrapped.length, 532);

  // Zweimal verpacken ergibt Verschiedenes: OAEP ist zufällig. Wäre es das
  // nicht, verriete ein gleicher Geheimtext, dass zweimal dasselbe verpackt
  // wurde — bei Anmeldungen also, dass zwei Leute dasselbe geantwortet haben.
  const again = await wrapKey(spki, aad, secret);
  ok('21.4  Zweimal verpacken ergibt verschiedene Hüllen',
    toHex(wrapped) === toHex(again), false);

  ok('21.3  Beide tragen aber denselben Kopf',
    toHex(again.slice(0, 20)), vector.headerHex);

  // Eine andere AAD ergibt ein anderes Label — und damit eine Hülle, die sich
  // am fremden Platz nicht öffnen lässt. Das ist der ganze Zweck von 3.13.
  const elsewhere = rcAad(module, objectType,
    '0190a1b2-0000-7000-8000-000000000002', RcField.EventAnswer, 1);

  const other = new Uint8Array(await crypto.subtle.digest('SHA-256',
    (() => {
      const bytes = new TextEncoder().encode(
        `${elsewhere.module}:${elsewhere.objectType}:${elsewhere.objectId}:${elsewhere.field}:${elsewhere.version}`);
      const buf = new Uint8Array(header.length + bytes.length);
      buf.set(header, 0);
      buf.set(bytes, header.length);
      return buf;
    })()));

  ok('3.13  Eine andere AAD ergibt ein anderes Label',
    toHex(other) === vector.labelHex, false);
};

await run();

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
