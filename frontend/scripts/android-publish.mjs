/**
 * AN GOOGLE PLAY SCHICKEN — `npm run android:publish`.
 *
 * <code>
 *   npm run android:publish                          das neueste AAB (android-out/latest.json)
 *                                                    in die Spur „internal", als Entwurf
 *   … -- --track=production --status=completed       in die Produktion, gleich ausrollen
 *   … -- --listing                                   dazu Texte und Bilder aus android/play/listings
 *   … -- --listing-only                              nur Texte und Bilder, kein AAB
 *   … -- --no-review                                 Änderungen nicht gleich zur Prüfung schicken
 *   … -- --dry-run                                   nur sagen, was geschähe
 * </code>
 *
 * <b>Der Schlüssel</b> ist ein Dienstkonto der Google Play Developer API (JSON),
 * abgelegt unter ~/.recreatio/android/play-service-account.json (oder
 * $RECREATIO_PLAY_KEY) — NIE im Repository. Wie man es anlegt: android/play/PLAY_CONSOLE.md.
 *
 * <b>Die allererste Fassung</b> lädt man in der Play Console von Hand hoch:
 * vorher kennt Google den Paketnamen nicht, und die Schnittstelle kann keine
 * App anlegen. Danach macht es dieses Skript (und deploy-app.bat).
 *
 * Ohne Abhängigkeiten: das Token entsteht hier (JWT, RS256, node:crypto), die
 * Aufrufe sind die „Edits" der Android Publisher API v3 — öffnen, hochladen,
 * Spur setzen, festschreiben. Scheitert etwas dazwischen, wird der Edit verworfen.
 */

import { createSign } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE = 'pl.recreatio.app';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const play = join(root, 'android', 'play');
const out = join(root, 'android-out');

const arg = (name, fallback) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found === undefined ? fallback : found.slice(name.length + 3);
};
const flag = (name) => process.argv.includes(`--${name}`);

const track = arg('track', 'internal');
const status = arg('status', 'draft');
const listingOnly = flag('listing-only');
const withListing = flag('listing') || listingOnly;
const dryRun = flag('dry-run');
const noReview = flag('no-review');

if (!['draft', 'completed', 'halted'].includes(status)) {
  console.error(`--status=${status}: erlaubt sind draft, completed, halted.`);
  process.exit(1);
}

/* -- Was hochgeladen wird ---------------------------------------------------- */

const latestFile = join(out, 'latest.json');
let latest = null;
if (!listingOnly) {
  if (!existsSync(latestFile)) {
    console.error('Kein android-out/latest.json — zuerst bauen: npm run android:release');
    process.exit(1);
  }
  latest = JSON.parse(readFileSync(latestFile, 'utf8'));
  if (latest.aab === null) {
    console.error('Der letzte Bau hat kein AAB — npm run android:release baut beides.');
    process.exit(1);
  }
}

const readText = (file) => (existsSync(file) ? readFileSync(file, 'utf8').trim() : null);

/** Texte und Bilder je Sprache, wie sie in android/play/listings liegen. */
function listings() {
  const dir = join(play, 'listings');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((language) => {
    const base = join(dir, language);
    const images = join(base, 'images');
    const shots = join(images, 'phoneScreenshots');
    return {
      language,
      title: readText(join(base, 'title.txt')),
      shortDescription: readText(join(base, 'short-description.txt')),
      fullDescription: readText(join(base, 'full-description.txt')),
      icon: existsSync(join(images, 'icon.png')) ? join(images, 'icon.png') : null,
      featureGraphic: existsSync(join(images, 'featureGraphic.png')) ? join(images, 'featureGraphic.png') : null,
      phoneScreenshots: existsSync(shots) ? readdirSync(shots).filter((f) => f.endsWith('.png')).sort().map((f) => join(shots, f)) : []
    };
  });
}

/** Was neu ist — je Sprache höchstens 500 Zeichen (Vorgabe von Play). */
function releaseNotes() {
  const dir = join(play, 'release-notes');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.txt')).map((f) => ({
    language: f.slice(0, -4),
    text: readFileSync(join(dir, f), 'utf8').trim().slice(0, 500)
  })).filter((n) => n.text !== '');
}

const pages = withListing ? listings() : [];
const notes = releaseNotes();

console.log(`Paket     ${PACKAGE}`);
if (latest !== null) console.log(`AAB       ${latest.aab} — ${latest.versionName} (${latest.versionCode})\nSpur      ${track}, ${status}`);
for (const page of pages) {
  console.log(`Eintrag   ${page.language}: ${page.title ?? '—'} · Symbol ${page.icon ? 'ja' : 'nein'} · Grafik ${page.featureGraphic ? 'ja' : 'nein'} · Bilder ${page.phoneScreenshots.length}`);
}

if (dryRun) {
  console.log('\n--dry-run: nichts hochgeladen.');
  process.exit(0);
}

/* -- Anmelden: ein Dienstkonto, ein JWT, ein Token --------------------------- */

const keyFile = process.env.RECREATIO_PLAY_KEY ?? join(homedir(), '.recreatio', 'android', 'play-service-account.json');
if (!existsSync(keyFile)) {
  console.error(`Kein Dienstkonto unter ${keyFile} — siehe android/play/PLAY_CONSOLE.md, Abschnitt „Automatisch hochladen".`);
  process.exit(1);
}
const account = JSON.parse(readFileSync(keyFile, 'utf8'));

const API_ROOT = (process.env.PLAY_API_ROOT ?? 'https://androidpublisher.googleapis.com').replace(/\/+$/, '');
const api = `${API_ROOT}/androidpublisher/v3/applications/${PACKAGE}`;
const upload = `${API_ROOT}/upload/androidpublisher/v3/applications/${PACKAGE}`;

const b64url = (data) => Buffer.from(data).toString('base64url');

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = account.token_uri ?? 'https://oauth2.googleapis.com/token';
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({
    iss: account.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600
  }))}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key);
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${b64url(signature)}`
    })
  });
  const said = await res.json().catch(() => ({}));
  if (!res.ok || typeof said.access_token !== 'string') {
    throw new Error(`Anmeldung bei Google gescheitert (${res.status}): ${JSON.stringify(said)}`);
  }
  return said.access_token;
}

const bearer = await token();

async function request(method, url, { json, bytes, type } = {}) {
  const headers = { Authorization: `Bearer ${bearer}` };
  let body;
  if (json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (bytes !== undefined) { headers['Content-Type'] = type ?? 'application/octet-stream'; body = bytes; }
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let said = null;
  try { said = text === '' ? null : JSON.parse(text); } catch { said = text; }
  if (!res.ok) {
    const message = said?.error?.message ?? text;
    throw new Error(`${method} ${url.replace(API_ROOT, '')} → ${res.status}: ${message}`);
  }
  return said;
}

/**
 * Das AAB (rund 45 MB) in einer „resumable" Sitzung: erst die Sitzung öffnen,
 * dann die Bytes in einem Zug. Das einfache Hochladen ist bei Google für kleine
 * Dateien gedacht und bricht bei langsamer Leitung ab.
 */
async function resumable(url, bytes) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      'X-Upload-Content-Type': 'application/octet-stream',
      'X-Upload-Content-Length': String(bytes.length)
    }
  });
  const session = res.headers.get('location');
  if (!res.ok || session === null) {
    throw new Error(`Hochladen nicht begonnen (${res.status}): ${await res.text()}`);
  }
  return request('PUT', session, { bytes });
}

/* -- Der Edit ------------------------------------------------------------------ */

const edit = (await request('POST', `${api}/edits`, { json: {} })).id;
console.log(`\nEdit      ${edit}`);

try {
  for (const page of pages) {
    if (page.title !== null || page.shortDescription !== null || page.fullDescription !== null) {
      await request('PUT', `${api}/edits/${edit}/listings/${page.language}`, {
        json: {
          language: page.language,
          ...(page.title !== null ? { title: page.title } : {}),
          ...(page.shortDescription !== null ? { shortDescription: page.shortDescription } : {}),
          ...(page.fullDescription !== null ? { fullDescription: page.fullDescription } : {})
        }
      });
      console.log(`✓ Texte ${page.language}`);
    }

    const images = [
      ['icon', page.icon === null ? [] : [page.icon]],
      ['featureGraphic', page.featureGraphic === null ? [] : [page.featureGraphic]],
      ['phoneScreenshots', page.phoneScreenshots]
    ];
    for (const [kind, files] of images) {
      if (files.length === 0) continue;
      /* Ersetzen, nicht anhäufen: erst alle weg, dann in der Reihenfolge der Dateinamen. */
      await request('DELETE', `${api}/edits/${edit}/listings/${page.language}/${kind}`);
      for (const file of files) {
        await request('POST', `${upload}/edits/${edit}/listings/${page.language}/${kind}?uploadType=media`,
          { bytes: readFileSync(file), type: 'image/png' });
      }
      console.log(`✓ ${kind} ${page.language} (${files.length})`);
    }
  }

  if (latest !== null) {
    const sent = await resumable(`${upload}/edits/${edit}/bundles?uploadType=resumable`, readFileSync(join(out, latest.aab)));
    console.log(`✓ AAB hochgeladen — versionCode ${sent.versionCode}`);

    await request('PUT', `${api}/edits/${edit}/tracks/${track}`, {
      json: {
        track,
        releases: [{
          name: latest.versionName,
          versionCodes: [String(sent.versionCode)],
          status,
          ...(notes.length > 0 ? { releaseNotes: notes } : {})
        }]
      }
    });
    console.log(`✓ Spur ${track}: ${status}`);
  }

  await request('POST', `${api}/edits/${edit}:commit${noReview ? '?changesNotSentForReview=true' : ''}`);
  console.log('✓ festgeschrieben');
} catch (error) {
  await request('DELETE', `${api}/edits/${edit}`).catch(() => undefined);
  console.error(`\n${error.message}\nDer Edit ist verworfen; in der Play Console hat sich nichts geändert.`);
  process.exit(1);
}
