/**
 * DIE APK — `npm run android:apk`.
 *
 * <code>
 *   npm run android:apk              unterschrieben, zum Installieren (GrapheneOS & Co.)
 *   npm run android:apk -- --debug   zum Prüfen: WebView per chrome://inspect erreichbar
 * </code>
 *
 * Baut die Seite (vite), legt sie in das Android-Projekt (cap sync), baut mit
 * Gradle und legt das Ergebnis unter `android-out/` ab — mit dem Fingerabdruck
 * der Unterschrift, den man beim ersten Installieren vergleichen kann.
 *
 * Die Unterschrift kommt aus ~/.recreatio/android (`npm run android:keystore`).
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTools, findJava, findSdk, signingFile, tool } from './android-tools.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const android = join(root, 'android');
const debug = process.argv.includes('--debug');
const windows = process.platform === 'win32';

function step(title, command, args, options = {}) {
  console.log(`\n== ${title}`);
  /* Eine Befehlszeile statt Argumentliste: npm, npx und gradlew sind unter Windows Skripte und brauchen die Shell. Alle Teile sind fest; Pfade werden gequotet. */
  const line = [command.includes(' ') ? `"${command}"` : command, ...args].join(' ');
  const run = spawnSync(line, { stdio: 'inherit', shell: true, ...options });
  if (run.status !== 0) {
    console.error(`\n${title}: gescheitert.`);
    process.exit(run.status ?? 1);
  }
}

if (!debug && !existsSync(signingFile())) {
  console.error(`Keine Unterschrift unter ${signingFile()}.`);
  console.error('Einmal anlegen: npm run android:keystore');
  process.exit(1);
}

const java = findJava();
const sdk = findSdk();
console.log(`JDK  ${java}\nSDK  ${sdk}`);

/* Gradle sucht das SDK in local.properties — Doppelpunkt und Backslash müssen dort maskiert sein. */
writeFileSync(join(android, 'local.properties'), `sdk.dir=${sdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:')}\n`);

const env = { ...process.env, JAVA_HOME: java, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };

step('Seite bauen', 'npm', ['run', 'build', '--', '--logLevel', 'warn'], { cwd: root });
step('In das Android-Projekt legen', 'npx', ['cap', 'sync', 'android'], { cwd: root });
step(`Gradle (${debug ? 'debug' : 'release'})`, join(android, windows ? 'gradlew.bat' : 'gradlew'),
  [debug ? 'assembleDebug' : 'assembleRelease', '--console=plain'], { cwd: android, env });

const variant = debug ? 'debug' : 'release';
const outDir = join(android, 'app', 'build', 'outputs', 'apk', variant);
const meta = JSON.parse(readFileSync(join(outDir, 'output-metadata.json'), 'utf8'));
const element = meta.elements[0];
const built = join(outDir, element.outputFile);

if (!debug && element.outputFile.includes('unsigned')) {
  console.error('Die APK ist nicht unterschrieben — stimmt signing.properties?');
  process.exit(1);
}

const target = join(root, 'android-out', `recreatio-${element.versionName}${debug ? '-debug' : ''}.apk`);
mkdirSync(dirname(target), { recursive: true });
copyFileSync(built, target);

console.log('\n== Unterschrift');
/* Das Jar direkt, nicht apksigner.bat: ein Pfad mit Leerzeichen (Program Files) überlebt die Shell nicht. */
const apksigner = join(buildTools(sdk), 'lib', 'apksigner.jar');
const verify = spawnSync(tool(java, 'java'), ['-jar', apksigner, 'verify', '--print-certs', target], { encoding: 'utf8', env });
if (verify.status !== 0) {
  console.error(verify.stderr || verify.stdout);
  process.exit(1);
}
const certificate = (verify.stdout.match(/SHA-256 digest: ([0-9a-f]+)/) ?? [])[1] ?? '?';

const digest = createHash('sha256').update(readFileSync(target)).digest('hex');

console.log(`
APK              ${target}
Fassung          ${element.versionName} (${element.versionCode})
Zertifikat       SHA-256 ${certificate.match(/../g)?.join(':').toUpperCase() ?? certificate}
Datei            SHA-256 ${digest}
`);
