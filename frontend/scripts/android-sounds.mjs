/**
 * Die Klänge der Android-App — `node scripts/android-sounds.mjs` (2026-10-29).
 *
 * Nur nötig, wenn sich ein Klang ändert; das Ergebnis liegt im Android-Projekt und
 * wird mit eingecheckt. Ohne Werkzeuge: die Töne werden hier gerechnet (Sinus mit
 * Obertönen, die ausklingen) und als WAV (16 Bit, mono) geschrieben.
 *
 * <code>
 *   sms_tone   die Meldung einer SMS (Ausgabe „sms", Kanal „SMS"): zwei helle,
 *              aufsteigende Glockentöne
 *   app_tone   die Meldungen der App selbst (Rozmowy, Nowości, Zadania, Timery lamp;
 *              beide Ausgaben): zwei warme, fallende Töne wie von einem Holzstab —
 *              tiefer und weicher als die SMS, auch ungesehen zu unterscheiden
 * </code>
 *
 * Android merkt sich den Klang eines Kanals beim Anlegen. Ein neuer Klang unter
 * demselben Namen gilt nur für Telefone, die den Kanal neu anlegen — wer ihn allen
 * geben will, gibt den Kanälen neue Kennungen (`SmsNotices.CHANNEL`, `Notices.CHANNEL_*`,
 * `platform.ts`) und räumt die alten fort.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RATE = 44100;

/** Teiltöne (Verhältnis, Stärke, Anteil an der Abklingzeit): eine Glocke — und ein Holzstab (Marimba: der starke vierte, unharmonisch). */
const BELL = [[1, 1, 1], [2, 0.22, 0.5], [3.01, 0.07, 0.33]];
const WOOD = [[1, 1, 1], [3.93, 0.2, 0.3], [9.4, 0.04, 0.15]];

/** Ein Ton: Grundton und Obertöne, jeder klingt mit eigener Zeit aus; weicher Anschlag. */
function bell(out, { at, freq, decay, gain = 1, partials = BELL }) {
  const start = Math.round(at * RATE);
  const attack = 0.004 * RATE;
  for (let i = start; i < out.length; i++) {
    const t = (i - start) / RATE;
    const rise = i - start < attack ? 0.5 - 0.5 * Math.cos((Math.PI * (i - start)) / attack) : 1;
    let v = 0;
    for (const [ratio, amp, life] of partials) v += amp * Math.exp(-t / (decay * life)) * Math.sin(2 * Math.PI * freq * ratio * t);
    out[i] += gain * rise * v;
  }
}

/** Auf `peak` gebracht, das Ende sanft auf null. */
function finish(out, peak) {
  let max = 0;
  for (const v of out) max = Math.max(max, Math.abs(v));
  const fade = Math.round(0.04 * RATE);
  for (let i = 0; i < out.length; i++) {
    const tail = i > out.length - fade ? (out.length - i) / fade : 1;
    out[i] = (out[i] / max) * peak * tail;
  }
  return out;
}

/** PCM, 16 Bit, mono. */
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVE', 8, 'ascii');
  head.write('fmt ', 12, 'ascii');
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36, 'ascii');
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

function write(name, flavour, samples) {
  const target = join(root, 'android', 'app', 'src', flavour, 'res', 'raw', `${name}.wav`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, wav(samples));
  console.log(`${name}: ${target}`);
}

/* Die SMS: hell, aufsteigend. Nur in der Ausgabe „sms". */
const sms = new Float64Array(Math.round(0.62 * RATE));
bell(sms, { at: 0, freq: 1318.51, decay: 0.1 });          // E6
bell(sms, { at: 0.12, freq: 1760, decay: 0.16, gain: 0.9 }); // A6
write('sms_tone', 'sms', finish(sms, 0.8));

/* Die App: warm, fallend, eine Quinte tiefer. In beiden Ausgaben. */
const app = new Float64Array(Math.round(0.7 * RATE));
bell(app, { at: 0, freq: 1174.66, decay: 0.12, partials: WOOD });              // D6
bell(app, { at: 0.14, freq: 783.99, decay: 0.2, gain: 0.95, partials: WOOD });  // G5
write('app_tone', 'main', finish(app, 0.8));
