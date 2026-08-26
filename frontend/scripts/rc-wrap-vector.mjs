/**
 * Ergänzt `backend/rc-wrap-vector.json` um eine Hülle, die der BROWSER-Code
 * erzeugt hat.
 *
 * Kopf und Label auf beiden Seiten gleich zu rechnen ist ein starkes Indiz,
 * aber kein Beweis: die Anordnung im OAEP-Klartext könnte trotzdem abweichen,
 * und das fiele erst auf, wenn eine echte Anmeldung nicht mehr aufgeht.
 *
 * Also wird hier einmal mit `wrapKey` aus `rcCrypto.ts` verpackt und das
 * Ergebnis abgelegt. Die Kernel-Prüfreihe packt es aus und vergleicht mit dem
 * bekannten Geheimnis — ein echter Rundlauf über die Sprachgrenze, in einer
 * Datei, die beide Seiten lesen.
 *
 *   npm run rc:vector
 */

import { build } from 'esbuild';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const asPath = (url) => new URL(url, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const VECTOR = asPath('../../backend/rc-wrap-vector.json');
const LIB = asPath('../src/rc/lib/');

const vector = JSON.parse(await readFile(VECTOR, 'utf8'));

// Ein festes Geheimnis, damit der Rundlauf eine bekannte Antwort hat. Nicht
// zufällig: die Prüfung soll sagen können, WAS herauskommen muss.
const secretHex = vector.secretHex ?? '00'.repeat(0) + Array.from({ length: 32 },
  (_, i) => (i * 7 + 3).toString(16).padStart(2, '0')).join('');

const out = await mkdtemp(join(tmpdir(), 'rc-vector-'));
const entry = join(out, 'gen.ts');

await writeFile(entry, `
import { wrapKey, rcAad, RcField } from ${JSON.stringify(LIB + 'rcCrypto')};

const spki = Uint8Array.from(atob(${JSON.stringify(vector.spkiBase64)}), (c) => c.charCodeAt(0));
const secret = Uint8Array.from(${JSON.stringify(secretHex)}.match(/../g).map((h) => parseInt(h, 16)));

const [m, o, id, , v] = ${JSON.stringify(vector.aadText)}.split(':');
const blob = await wrapKey(spki, rcAad(m, o, id, RcField.EventAnswer, Number(v)), secret);

process.stdout.write(Buffer.from(blob).toString('base64'));
`, 'utf8');

try {
  await build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    outfile: join(out, 'gen.mjs'),
    absWorkingDir: asPath('..'),
    define: { 'import.meta.env': '{}' },
    logLevel: 'warning'
  });

  // Die erzeugte Datei schreibt auf stdout; hier wird sie geladen und das
  // Geschriebene abgefangen.
  const chunks = [];
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => { chunks.push(chunk); return true; };

  await import(pathToFileURL(join(out, 'gen.mjs')).href);

  process.stdout.write = write;

  vector.secretHex = secretHex;
  vector.wrappedByBrowserBase64 = chunks.join('');

  await writeFile(VECTOR, JSON.stringify(vector, null, 2) + '\n', 'utf8');
  console.log(`rc-wrap-vector.json ergänzt (${vector.wrappedByBrowserBase64.length} Zeichen Hülle)`);
} finally {
  await rm(out, { recursive: true, force: true });
}
