/**
 * Die Feldnamen des Steckbriefs.
 *
 * <b>Warum das geprüft werden muss.</b> `RC_PERSON_FIELDS` sind Zeichenketten,
 * die der Server gegen eine Aufzählung parst (`Enum.TryParse<RcField>`, ohne
 * `ignoreCase`). Ein Tippfehler oder eine umbenannte Aufzählung fällt beim
 * Übersetzen NICHT auf — TypeScript kennt die C#-Aufzählung nicht. Er fällt
 * beim Anlegen einer Angabe auf, mit „Dieses Feld gibt es nicht", und im
 * schlimmeren Fall gar nicht: ein Name, den es auf beiden Seiten gibt, aber
 * mit anderer Bedeutung, verschlüsselt gegen ein anderes Etikett (3.13) — und
 * der Geheimtext geht Monate später nicht mehr auf, ohne erkennbare Ursache.
 *
 * Deshalb wird hier gegen die QUELLE geprüft und nicht gegen eine Kopie: die
 * C#-Datei selbst wird gelesen. Eine zweite Liste zum Abgleichen wäre nur eine
 * dritte Stelle, an der derselbe Tippfehler stehen kann.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RC_PERSON_FIELDS, RC_PERSON_CLASS, rcIsPersonField } from './rcPerson';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

// -- Jeder Name steht wirklich in der Aufzählung des Servers -------------------

/*
 * Der Pfad haengt am Arbeitsverzeichnis und NICHT an `import.meta.url`: der
 * Laeufer uebersetzt jede Pruefdatei in ein Temporaerverzeichnis und fuehrt sie
 * dort aus. Relativ zur uebersetzten Datei liegt das Vorhaben nirgends.
 * `npm run` startet immer im Paketordner, also ist der Ort verlaesslich.
 */
const repo = (...parts: string[]) => resolve(process.cwd(), '..', ...parts);

const aad = readFileSync(repo('backend/Rc.Kernel/RcAad.cs'), 'utf8');

/*
 * Der Rumpf der Aufzählung, nicht die ganze Datei: weiter unten steht die
 * Tabelle der Etiketten, und dort kommt jeder Name ein zweites Mal vor. Ein
 * Suchmuster über die ganze Datei fände deshalb auch einen Namen, der aus der
 * Aufzählung entfernt, in der Tabelle aber vergessen wurde — und genau der
 * Fall soll auffallen.
 */
const start = aad.indexOf('public enum RcField');
const body = aad.slice(start, aad.indexOf('}', start));

for (const field of RC_PERSON_FIELDS) {
  ok(
    `„${field}" steht in RcField`,
    new RegExp(`^\\s*${field},`, 'm').test(body),
    true
  );
}

// -- Und jeder hat sein EIGENES Etikett ---------------------------------------

/*
 * Der ganze Zweck der einzelnen Verschlüsselung hängt daran. Trügen zwei
 * Angaben dasselbe Etikett, ginge der Geheimtext der einen am Platz der
 * anderen auf — und „gib ihm nur die Telefonnummer" wäre nicht mehr wahr.
 */
const labels = RC_PERSON_FIELDS.map((field) => {
  const hit = new RegExp(`RcField\\.${field}\\s*=>\\s*"([^"]+)"`).exec(aad);
  return hit === null ? null : hit[1];
});

ok('Jedes Feld hat ein Etikett', labels.includes(null), false);
ok('Alle Etiketten sind verschieden', new Set(labels).size, labels.length);

// -- Die Klasse ---------------------------------------------------------------

/*
 * `personal` ist protokollpflichtig UND freigebbar. Beides wird gebraucht:
 * ohne Protokoll bliebe unbeantwortet, wer gelesen hat; ohne Freigabe wäre
 * die Seite sinnlos. `secret` kennt keine Freigabe, `special` verlangt bei
 * jedem Blick einen Zweck — beides wäre hier falsch, nicht strenger.
 */
ok('Die Klasse ist personal', RC_PERSON_CLASS, 'personal');

const items = readFileSync(repo('backend/Rc.Api/RcDataItems.cs'), 'utf8');
ok(
  'personal wird protokolliert',
  /RequiresLog\(string dataClass\) =>\s*\n?\s*dataClass is ClassPersonal/.test(items),
  true
);
ok(
  'personal darf freigegeben werden',
  /AllowsSharing\(string dataClass\) => dataClass is not ClassSecret/.test(items),
  true
);

// -- Die Wache ----------------------------------------------------------------

ok('Ein Steckbrieffeld wird erkannt', rcIsPersonField('PersonPhone'), true);
ok('Ein fremdes Feld nicht', rcIsPersonField('MessageBody'), false);
ok('Und ein erfundenes auch nicht', rcIsPersonField('PersonEmail'), false);

/*
 * Vier und nicht mehr. Wächst die Liste, ist das eine Entscheidung und keine
 * Nebenwirkung: jedes weitere Feld ist eine weitere personenbezogene Angabe,
 * die begründet, protokolliert und gelöscht werden können muss.
 */
ok('Es sind vier Angaben', RC_PERSON_FIELDS.length, 4);

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
