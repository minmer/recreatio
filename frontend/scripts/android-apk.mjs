/**
 * DIE APP BAUEN — APK zum Installieren, AAB für Google Play.
 *
 * <code>
 *   npm run android:apk                  APK, unterschrieben (GrapheneOS & Co.)
 *   npm run android:release              APK + AAB (Play) — das, was deploy-app.bat baut
 *   npm run android:apk -- --debug       zum Prüfen: WebView per chrome://inspect erreichbar
 *   … -- --skip-web                      die Seite nicht neu bauen, `dist/` so nehmen, wie es ist
 * </code>
 *
 * Baut die Seite (vite), legt sie in das Android-Projekt (cap sync), baut mit
 * Gradle und legt das Ergebnis unter `android-out/` ab — mit dem Fingerabdruck
 * der Unterschrift, den man beim ersten Installieren vergleichen kann.
 * `android-out/latest.json` sagt `android:publish`, welches AAB das neueste ist.
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
const out = join(root, 'android-out');
const debug = process.argv.includes('--debug');
const bundle = process.argv.includes('--bundle') && !debug;
const skipWeb = process.argv.includes('--skip-web');
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

if (!skipWeb) step('Seite bauen', 'npm', ['run', 'build', '--', '--logLevel', 'warn'], { cwd: root });
step('In das Android-Projekt legen', 'npx', ['cap', 'sync', 'android'], { cwd: root });

/* APK und AAB in EINEM Lauf: dieselbe versionCode (Minuten seit 2026), sonst liegen zwei Fassungen nebeneinander. */
const tasks = debug ? ['assembleDebug'] : bundle ? ['assembleRelease', 'bundleRelease'] : ['assembleRelease'];
step(`Gradle (${tasks.join(', ')})`, join(android, windows ? 'gradlew.bat' : 'gradlew'),
  [...tasks, '--console=plain'], { cwd: android, env });

const variant = debug ? 'debug' : 'release';
const apkDir = join(android, 'app', 'build', 'outputs', 'apk', variant);
const meta = JSON.parse(readFileSync(join(apkDir, 'output-metadata.json'), 'utf8'));
const element = meta.elements[0];

if (!debug && element.outputFile.includes('unsigned')) {
  console.error('Die APK ist nicht unterschrieben — stimmt signing.properties?');
  process.exit(1);
}

const name = `recreatio-${element.versionName}${debug ? '-debug' : ''}`;
mkdirSync(out, { recursive: true });
const apk = join(out, `${name}.apk`);
copyFileSync(join(apkDir, element.outputFile), apk);

let aab = null;
if (bundle) {
  aab = join(out, `${name}.aab`);
  copyFileSync(join(android, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab'), aab);
}

console.log('\n== Unterschrift');
/* Das Jar direkt, nicht apksigner.bat: ein Pfad mit Leerzeichen (Program Files) überlebt die Shell nicht. */
const apksigner = join(buildTools(sdk), 'lib', 'apksigner.jar');
const verify = spawnSync(tool(java, 'java'), ['-jar', apksigner, 'verify', '--print-certs', apk], { encoding: 'utf8', env });
if (verify.status !== 0) {
  console.error(verify.stderr || verify.stdout);
  process.exit(1);
}
const hex = (verify.stdout.match(/SHA-256 digest: ([0-9a-f]+)/) ?? [])[1] ?? '';
const certificate = hex.match(/../g)?.join(':').toUpperCase() ?? '?';
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

if (!debug) {
  writeFileSync(join(out, 'latest.json'), JSON.stringify({
    versionName: element.versionName,
    versionCode: element.versionCode,
    apk: apk.slice(out.length + 1),
    aab: aab === null ? null : aab.slice(out.length + 1),
    certificate,
    builtAt: new Date().toISOString()
  }, null, 2) + '\n');
}

console.log(`
APK              ${apk}
${aab === null ? '' : `AAB              ${aab}\n`}Fassung          ${element.versionName} (${element.versionCode})
Zertifikat       SHA-256 ${certificate}
Datei            SHA-256 ${sha256(apk)}
`);
