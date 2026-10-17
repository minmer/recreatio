/**
 * DIE APP BAUEN — APK zum Installieren, AAB für Google Play; dazu in jedem Lauf
 * die Ausgabe „sms" (`recreatio-sms-<fassung>.apk`, SMS und Adressbuch, nur für
 * ein Telefon und nie in Play).
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

/*
 * APK und AAB in EINEM Lauf: dieselbe versionCode (Minuten seit 2026), sonst liegen zwei Fassungen nebeneinander.
 * 2026-10-17 — ZWEI AUSGABEN (build.gradle, `productFlavors`): `play`, die App für alle (Google Play, die APK zum
 * Installieren), und `sms`, dieselbe App mit SMS, MMS und dem Adressbuch des Telefons — nur zum Installieren von
 * Hand, nie in Play. Beide heissen `pl.recreatio.app`: auf einem Telefon liegt die eine ODER die andere.
 */
const EDITIONS = ['play', 'sms'];
const title = (word) => word[0].toUpperCase() + word.slice(1);
const tasks = [
  ...EDITIONS.map((edition) => `assemble${title(edition)}${debug ? 'Debug' : 'Release'}`),
  ...(bundle ? ['bundlePlayRelease'] : [])
];
step(`Gradle (${tasks.join(', ')})`, join(android, windows ? 'gradlew.bat' : 'gradlew'),
  [...tasks, '--console=plain'], { cwd: android, env });

const variant = debug ? 'debug' : 'release';
mkdirSync(out, { recursive: true });

/** Die APK einer Ausgabe nach android-out/ — `recreatio-<fassung>.apk`, die SMS-Ausgabe als `recreatio-sms-<fassung>.apk`. */
function copyApk(edition) {
  const apkDir = join(android, 'app', 'build', 'outputs', 'apk', edition, variant);
  const meta = JSON.parse(readFileSync(join(apkDir, 'output-metadata.json'), 'utf8'));
  const element = meta.elements[0];
  if (!debug && element.outputFile.includes('unsigned')) {
    console.error(`Die APK (${edition}) ist nicht unterschrieben — stimmt signing.properties?`);
    process.exit(1);
  }
  const name = `recreatio${edition === 'play' ? '' : `-${edition}`}-${element.versionName}${debug ? '-debug' : ''}`;
  const file = join(out, `${name}.apk`);
  copyFileSync(join(apkDir, element.outputFile), file);
  return { element, name, file };
}

const play = copyApk('play');
const sms = copyApk('sms');
const element = play.element;
const apk = play.file;

let aab = null;
if (bundle) {
  aab = join(out, `${play.name}.aab`);
  copyFileSync(join(android, 'app', 'build', 'outputs', 'bundle', 'playRelease', 'app-play-release.aab'), aab);
}

console.log('\n== Unterschrift');
/* Das Jar direkt, nicht apksigner.bat: ein Pfad mit Leerzeichen (Program Files) überlebt die Shell nicht. */
const apksigner = join(buildTools(sdk), 'lib', 'apksigner.jar');

/** Der Fingerabdruck der Unterschrift — beide Ausgaben tragen denselben, sonst ginge die eine nicht über die andere. */
function certificateOf(file) {
  const verify = spawnSync(tool(java, 'java'), ['-jar', apksigner, 'verify', '--print-certs', file], { encoding: 'utf8', env });
  if (verify.status !== 0) {
    console.error(verify.stderr || verify.stdout);
    process.exit(1);
  }
  const hex = (verify.stdout.match(/SHA-256 digest: ([0-9a-f]+)/) ?? [])[1] ?? '';
  return hex.match(/../g)?.join(':').toUpperCase() ?? '?';
}
const certificate = certificateOf(apk);
if (certificateOf(sms.file) !== certificate) {
  console.error('Die beiden Ausgaben tragen verschiedene Unterschriften.');
  process.exit(1);
}
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

if (!debug) {
  writeFileSync(join(out, 'latest.json'), JSON.stringify({
    versionName: element.versionName,
    versionCode: element.versionCode,
    apk: apk.slice(out.length + 1),
    smsApk: sms.file.slice(out.length + 1),
    aab: aab === null ? null : aab.slice(out.length + 1),
    certificate,
    builtAt: new Date().toISOString()
  }, null, 2) + '\n');
}

console.log(`
APK              ${apk}
APK (SMS)        ${sms.file}   — nur von Hand, nie in Play
${aab === null ? '' : `AAB              ${aab}\n`}Fassung          ${element.versionName} (${element.versionCode})
Zertifikat       SHA-256 ${certificate}
Datei            SHA-256 ${sha256(apk)}
Datei (SMS)      SHA-256 ${sha256(sms.file)}
`);
