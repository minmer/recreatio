/**
 * Platzhalter ohne Wert.
 *
 * <b>Warum es diesen Lauf gibt.</b> Ein `@now` im SQL, zu dem kein
 * `AddWithValue("@now", …)` gehoert, ist keine Warnung und kein falsches
 * Ergebnis: die Anfrage stirbt mit „Must declare the scalar variable" — als
 * 500 beim Benutzer, im Betrieb, beim ersten Aufruf. Genau das ist beim
 * Anlegen einer Veranstaltungssammlung passiert, und gefunden wurde es aus
 * einem Fehlerprotokoll.
 *
 * Der Uebersetzer kann das nicht sehen: fuer ihn ist das SQL eine
 * Zeichenkette. Also sieht es dieser Lauf.
 *
 * <b>Grob und je Datei.</b> Ein Platzhalter gilt als gebunden, wenn IRGENDWO
 * in derselben Datei `"@name"` in Anfuehrungszeichen steht. Das laesst
 * theoretisch etwas durch — gebunden in der falschen Anfrage —, findet aber
 * den Fall, um den es geht: vergessen. Genauer zu sein hiesse, C# zu zerlegen,
 * und ein Werkzeug, das man nicht in zehn Minuten liest, pflegt niemand.
 *
 * Aufruf:  node scripts/rc-sql-params.mjs [ordner]
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2] ?? '../backend/Rc.Api';

/*
 * `@@ROWCOUNT`, `@@IDENTITY` und Verwandte sind T-SQL-GLOBALE und keine
 * Platzhalter. Ohne diesen Blick zurueck (`(?<!@)`) meldete der erste Lauf sie
 * alle — vier Fehlalarme —, und ein Werkzeug, das Fehlalarme liefert, schaltet
 * man nach dem zweiten Mal ab.
 */
const PLACEHOLDER = /(?<!@)@([A-Za-z_][A-Za-z0-9_]*)/g;

/**
 * Ein Platzhalter in Anfuehrungszeichen — so, und nur so, wird gebunden.
 *
 * Deckt auch die Hilfsfunktionen ab (`Seal(cmd, "@name", …)`): entscheidend
 * ist der Name in Anfuehrungszeichen, nicht welcher Aufruf drumherum steht.
 * Die erste Fassung suchte nach `.Parameters.` in derselben Zeile und meldete
 * jede Hilfsfunktion als Fehler.
 */
const BOUND = /"@([A-Za-z_][A-Za-z0-9_]*)"/g;

/** Die dreifach zitierten Rohzeichenketten, in denen das SQL steht. */
const RAW = /"""([\s\S]*?)"""/g;

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'bin' || entry.name === 'obj') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (entry.name.endsWith('.cs')) yield path;
  }
}

let problems = 0;
let scanned = 0;

for (const path of files(ROOT)) {
  const source = readFileSync(path, 'utf8');

  const bound = new Set();
  for (const [, name] of source.matchAll(BOUND)) bound.add(name);

  /* Je Name die erste Fundstelle — zwanzigmal derselbe Name hilft niemandem. */
  const used = new Map();
  for (const [, sql] of source.matchAll(RAW)) {
    for (const [, name] of sql.matchAll(PLACEHOLDER)) {
      if (!used.has(name)) used.set(name, sql.trim().split('\n')[0].trim().slice(0, 60));
    }
  }

  scanned++;

  for (const [name, where] of used) {
    if (bound.has(name)) continue;
    problems++;
    console.error(
      `${path}\n    @${name} steht im SQL, wird aber nirgends gebunden.\n    bei: ${where}\n`);
  }
}

console.log(`${scanned} Dateien durchgesehen, ${problems} ungebundene Platzhalter.`);
if (problems > 0) process.exitCode = 1;
