/**
 * DEN DODATEK FÜR THUNDERBIRD BAUEN (0125) — „recreatio.pl — Pliki przez link":
 * grosse Anhänge als zaszyfrowany link, dieselben Bytes wie die Pliki przez link
 * aus einer SMS (`src/app/phone/shareSeal.ts`).
 *
 * <code>
 *   npm run thunderbird:xpi
 *       thunderbird-out/recreatio-filelink-<fassung>.xpi, und dieselbe Datei als
 *       public/thunderbird/recreatio-filelink.xpi — die Seite bietet sie zum Herunterladen an
 *       (deploy-web.bat baut sie vor der Seite)
 *   npm run thunderbird:xpi -- --api http://localhost:50999 [--out <ordner>]
 *       ein Bau zum Prüfen gegen einen Dienst auf diesem Rechner: er darf zusätzlich dorthin
 *       (Recht im Manifest, Liste im Code) — nur nach thunderbird-out/ (oder --out), nie auf die Seite
 * </code>
 *
 * esbuild bündelt `thunderbird/background.ts` und `thunderbird/settings.ts`; dazu
 * kommen Manifest, Seite, Stil und die Bildchen (`thunderbird/icons`) — als ZIP mit der
 * Endung .xpi, mit festem Datum (derselbe Quelltext gibt dieselbe Datei). Thunderbird
 * verlangt keine Unterschrift: Dodatki i motywy → ⚙ → Zainstaluj dodatek z pliku.
 */

import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'thunderbird');
const PRODUCTION = 'https://api.recreatio.pl';

const argument = (name) => {
  const at = process.argv.indexOf(name);
  if (at < 0) return null;
  const value = process.argv[at + 1];
  if (value === undefined || value.startsWith('--')) { console.error(`${name} braucht einen Wert.`); process.exit(2); }
  return value;
};

/* Ein Dienst zum Prüfen: nur http(s) auf diesem Rechner oder https — dieselbe Regel wie `serviceAddress` in shareSeal.ts. */
const testApi = argument('--api');
let extra = null;
if (testApi !== null) {
  const url = new URL(testApi);
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    console.error('--api: https, oder http auf localhost / 127.0.0.1.');
    process.exit(2);
  }
  extra = { service: `${url.origin}${url.pathname.replace(/\/+$/, '')}`, permission: `${url.protocol}//${url.hostname}/*` };
}
const services = extra === null ? [PRODUCTION] : [PRODUCTION, extra.service];

const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'));
if (extra !== null && !manifest.permissions.includes(extra.permission)) manifest.permissions.push(extra.permission);

/* -- Bündeln ------------------------------------------------------------------------------------ */

const bundled = mkdtempSync(join(tmpdir(), 'rc-thunderbird-'));
try {
  await build({
    entryPoints: { background: join(source, 'background.ts'), settings: join(source, 'settings.ts') },
    bundle: true,
    format: 'iife',
    target: 'firefox128',
    outdir: bundled,
    absWorkingDir: root,
    charset: 'utf8',
    legalComments: 'none',
    define: {
      RC_SERVICES: JSON.stringify(services),
      'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' })
    },
    logLevel: 'warning'
  });

  /* -- Was in die Datei kommt -------------------------------------------------------------------- */

  /* Die Bildchen: das Logo auf weissem Feld (aus public/logo) — auf einem dunklen Thunderbird bliebe das schwarze sonst unsichtbar. */
  const files = [
    ['manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')],
    ['background.js', readFileSync(join(bundled, 'background.js'))],
    ['settings.js', readFileSync(join(bundled, 'settings.js'))],
    ['settings.html', readFileSync(join(source, 'settings.html'))],
    ['settings.css', readFileSync(join(source, 'settings.css'))],
    ...[16, 32, 48, 64, 128].map((n) => [`icons/${n}.png`, readFileSync(join(source, 'icons', `${n}.png`))])
  ];

  const xpi = zip(files);
  const out = argument('--out') ?? join(root, 'thunderbird-out');
  mkdirSync(out, { recursive: true });
  const target = join(out, `recreatio-filelink-${manifest.version}${extra === null ? '' : '-test'}.xpi`);
  writeFileSync(target, xpi);

  /* Nur der echte Bau geht auf die Seite — einer, der auch zu localhost darf, nie. */
  if (extra === null) {
    const site = join(root, 'public', 'thunderbird');
    mkdirSync(site, { recursive: true });
    copyFileSync(target, join(site, 'recreatio-filelink.xpi'));
  }

  console.log(`${target}`);
  console.log(`  ${(xpi.length / 1024).toFixed(1)} KB · sha256 ${createHash('sha256').update(xpi).digest('hex')}`);
  console.log(`  Fassung ${manifest.version} · Dienst ${services.join(', ')}`);
  if (extra === null) console.log('  auch: public/thunderbird/recreatio-filelink.xpi');
} finally {
  rmSync(bundled, { recursive: true, force: true });
}

/* -- ZIP ------------------------------------------------------------------------------------------
 *
 * Eine .xpi ist ein gewöhnliches ZIP. Ohne Abhängigkeit geschrieben: Kopf je Datei,
 * Verzeichnis, Ende. Festes Datum (1.1.2010, wie Mozillas eigene Archive) und feste
 * Reihenfolge — derselbe Quelltext gibt Byte für Byte dieselbe Datei.
 */
function zip(entries) {
  const TIME = 0;
  const DATE = ((2010 - 1980) << 9) | (1 << 5) | 1;
  const heads = [];
  const central = [];
  let offset = 0;

  for (const [name, data] of entries) {
    const packed = deflateRawSync(data, { level: 9 });
    const deflated = packed.length < data.length;
    const body = deflated ? packed : data;
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = crc32(data);

    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6);
    head.writeUInt16LE(deflated ? 8 : 0, 8);
    head.writeUInt16LE(TIME, 10);
    head.writeUInt16LE(DATE, 12);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(nameBytes.length, 26);
    head.writeUInt16LE(0, 28);
    heads.push(head, nameBytes, body);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(deflated ? 8 : 0, 10);
    entry.writeUInt16LE(TIME, 12);
    entry.writeUInt16LE(DATE, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);

    offset += head.length + nameBytes.length + body.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...heads, directory, end]);
}
