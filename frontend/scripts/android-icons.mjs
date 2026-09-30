/**
 * Die Bilder der Android-App aus dem einen Logo — `node scripts/android-icons.mjs`.
 *
 * Nur nötig, wenn sich das Logo ändert; das Ergebnis liegt im Verzeichnis
 * `android/app/src/main/res` und wird mit eingecheckt. Braucht `ffmpeg` im PATH.
 *
 * <code>
 *   ic_launcher_foreground   adaptives Symbol: Schrift, durchsichtig, im
 *                            sicheren Kreis (46 von 108 dp) — dient auch als
 *                            einfarbiges Symbol (Android 13, „Designsymbole")
 *   ic_launcher / _round     für Android 7, das noch keine adaptiven kennt
 *   ic_stat_recreatio        Benachrichtigung: weiss, durchsichtig
 *   splash_logo              Startbild, hell und dunkel
 * </code>
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'public', 'logo', 'android-chrome-512x512.png');
const res = join(root, 'android', 'app', 'src', 'main', 'res');

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/* Das Logo ist schwarz auf durchsichtig/weiss — erst auf Weiss, dann als Graustufe. */
const flat = '[0]format=rgba[s];color=white:s=512x512:d=1,format=rgba[w];[w][s]overlay=format=auto,format=gray';

/** Die Schrift allein, in einer Farbe, mit Deckkraft aus der Helligkeit. */
const glyph = (logo, color, canvas) =>
  `${flat},scale=${logo}:${logo}:flags=lanczos,negate[a];` +
  `color=c=${color}:s=${logo}x${logo}:d=1,format=rgba[c];[c][a]alphamerge,` +
  `pad=${canvas}:${canvas}:(ow-iw)/2:(oh-ih)/2:color=black@0`;

/** Schwarz auf Weiss, als Quadrat. */
const onWhite = (logo, canvas) =>
  `${flat},scale=${logo}:${logo}:flags=lanczos,format=rgba,pad=${canvas}:${canvas}:(ow-iw)/2:(oh-ih)/2:color=white`;

/** Dasselbe als Kreis mit weicher Kante. */
const onDisc = (logo, canvas) =>
  `${onWhite(logo, canvas)},geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*clip(W/2-hypot(X-W/2+0.5,Y-H/2+0.5)+0.5,0,1)'`;

function render(filter, out) {
  mkdirSync(dirname(out), { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-filter_complex', filter, '-frames:v', '1', out], { stdio: 'inherit' });
  console.log('✓', out.slice(root.length + 1));
}

const px = (dp, d) => Math.round(dp * d);

for (const [name, d] of Object.entries(DENSITIES)) {
  render(glyph(px(46, d), 'black', px(108, d)), join(res, `mipmap-${name}`, 'ic_launcher_foreground.png'));
  render(onWhite(px(38, d), px(48, d)), join(res, `mipmap-${name}`, 'ic_launcher.png'));
  render(onDisc(px(30, d), px(48, d)), join(res, `mipmap-${name}`, 'ic_launcher_round.png'));
  render(glyph(px(22, d), 'white', px(24, d)), join(res, `drawable-${name}`, 'ic_stat_recreatio.png'));
}

render(glyph(240, 'black', 288), join(res, 'drawable-nodpi', 'splash_logo.png'));
render(glyph(240, '0xf0ebe0', 288), join(res, 'drawable-night-nodpi', 'splash_logo.png'));
