/**
 * Den Schlüssel anlegen, mit dem die App unterschrieben wird — EINMAL.
 * `npm run android:keystore`
 *
 * <b>Er lässt sich nicht ersetzen.</b> Ein Telefon nimmt eine neue Fassung nur
 * an, wenn sie mit demselben Schlüssel unterschrieben ist wie die installierte.
 * Wer ihn verliert, kann die App nur noch deinstallieren und neu installieren;
 * wer ihn kopiert, kann eine App ausliefern, die das Telefon für diese hält.
 * Deshalb:
 *
 *   - er liegt ausserhalb des Repositorys: ~/.recreatio/android/
 *   - das Passwort steht daneben (signing.properties), zufällig erzeugt
 *   - beides gehört in eine Sicherung, getrennt von diesem Rechner
 *
 * Für Google Play dient derselbe Schlüssel später als Upload-Schlüssel.
 */

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { findJava, signingFile, tool } from './android-tools.mjs';

const properties = signingFile();
const dir = dirname(properties);
const store = 'recreatio-release.p12';
const alias = 'recreatio';

if (existsSync(properties) || existsSync(join(dir, store))) {
  console.error(`Es gibt schon einen Schlüssel in ${dir}.`);
  console.error('Er wird nicht überschrieben — mit einem neuen liesse sich die installierte App nicht mehr aktualisieren.');
  process.exit(1);
}

mkdirSync(dir, { recursive: true });

/* PKCS12: ein Passwort für Speicher und Schlüssel. Hex: nichts, was keytool (ein führendes -) oder eine .properties-Datei missdeutet. */
const password = randomBytes(24).toString('hex');

const java = findJava();
const run = spawnSync(tool(java, 'keytool'), [
  '-genkeypair',
  '-storetype', 'PKCS12',
  '-keystore', join(dir, store),
  '-storepass', password,
  '-keypass', password,
  '-alias', alias,
  '-keyalg', 'RSA',
  '-keysize', '4096',
  '-sigalg', 'SHA256withRSA',
  /* 30 Jahre: Google Play verlangt Gültigkeit über den 22. Oktober 2033 hinaus. */
  '-validity', String(30 * 365),
  '-dname', 'CN=REcreatio, O=REcreatio, C=PL'
], { stdio: 'inherit' });

if (run.status !== 0) {
  console.error('keytool ist gescheitert.');
  process.exit(1);
}

writeFileSync(properties, [
  '# Die Unterschrift der Android-App. NICHT ins Repository, aber in eine Sicherung.',
  `storeFile=${store}`,
  `storePassword=${password}`,
  `keyAlias=${alias}`,
  `keyPassword=${password}`,
  ''
].join('\n'));

console.log(`\nAngelegt: ${join(dir, store)}`);
console.log(`           ${properties}`);
console.log('Beide Dateien jetzt sichern — ohne sie gibt es keine Aktualisierung der App.');
