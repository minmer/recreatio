/**
 * Wo JDK und Android-SDK auf diesem Rechner liegen — für die Android-Skripte.
 *
 * Zuerst gilt, was gesetzt ist (`JAVA_HOME`, `ANDROID_HOME`); sonst die
 * üblichen Orte von Android Studio und Visual Studio. Gebaut wird mit JDK 21
 * (Capacitor 8) gegen Android 36.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const exe = (name) => (process.platform === 'win32' ? `${name}.exe` : name);

export const tool = (home, name) => join(home, 'bin', exe(name));

/** Die Hauptversion eines JDK, oder 0. `java -version` schreibt auf stderr. */
function javaMajor(home) {
  const java = tool(home, 'java');
  if (!existsSync(java)) return 0;
  const run = spawnSync(java, ['-version'], { encoding: 'utf8' });
  return Number((`${run.stderr ?? ''}${run.stdout ?? ''}`.match(/version "(\d+)/) ?? [])[1] ?? 0);
}

/** Unterordner, deren Name mit `prefix` beginnt — die neuesten zuerst. */
function children(dir, prefix) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.startsWith(prefix)).sort().reverse().map((name) => join(dir, name));
}

export function findJava() {
  const candidates = [
    process.env.JAVA_HOME,
    ...children('C:/Program Files/Android/openjdk', 'jdk-'),
    'C:/Program Files/Android/Android Studio/jbr',
    ...children('C:/Program Files/Microsoft', 'jdk-'),
    ...children('C:/Program Files/Eclipse Adoptium', 'jdk-'),
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    '/usr/lib/jvm/java-21-openjdk',
    '/usr/lib/jvm/java-21-openjdk-amd64'
  ].filter(Boolean);

  const found = candidates.find((home) => javaMajor(home) >= 21);
  if (found === undefined) {
    throw new Error('Kein JDK 21 gefunden. Android Studio installieren oder JAVA_HOME auf ein JDK 21 setzen.');
  }
  return found;
}

export function findSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    'C:/Program Files (x86)/Android/android-sdk',
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    join(homedir(), 'Android', 'Sdk'),
    join(homedir(), 'Library', 'Android', 'sdk')
  ].filter(Boolean);

  const found = candidates.find((sdk) => existsSync(join(sdk, 'platforms', 'android-36')));
  if (found === undefined) {
    throw new Error('Kein Android-SDK mit „platforms;android-36" gefunden. Im SDK Manager nachinstallieren oder ANDROID_HOME setzen.');
  }
  return found;
}

/** Die neuesten Build-Tools (apksigner, zipalign) im SDK. */
export function buildTools(sdk) {
  const found = children(join(sdk, 'build-tools'), '');
  if (found.length === 0) throw new Error('Keine Build-Tools im Android-SDK.');
  return found[0];
}

/** Wo die Unterschrift liegt — ausserhalb des Verzeichnisses. */
export const signingFile = () => process.env.RECREATIO_SIGNING ?? join(homedir(), '.recreatio', 'android', 'signing.properties');
