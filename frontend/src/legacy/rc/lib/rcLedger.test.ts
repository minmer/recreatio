/**
 * Die Nachrechnung der Kette, geprüft.
 *
 * Diese Funktion ist der einzige Ort in der ganzen Oberfläche, an dem etwas
 * NICHT geglaubt, sondern nachgerechnet wird. Wenn sie falsch liegt, liegt sie
 * in beide Richtungen falsch, und beide sind schlimm: eine kaputte Kette für
 * heil zu erklären ist eine Lüge, eine heile für kaputt ein blinder Alarm, der
 * beim dritten Mal niemanden mehr interessiert.
 *
 * Geprüft wird deshalb an gebauten Ketten mit gebauten Schäden — genau den
 * Eingriffen, gegen die ein Protokoll überhaupt gedacht ist.
 */

import { rcAgrees, rcRecompute, type RcLedgerEntry, type RcLedgerVerdict } from './rcLedger';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

/** Eine heile Kette der Länge n. Der Hash ist erfunden, aber durchgehend. */
function chain(n: number): RcLedgerEntry[] {
  const out: RcLedgerEntry[] = [];
  for (let i = 1; i <= n; i += 1) {
    out.push({
      sequence: i,
      entryId: `e${i}`,
      previousHash: i === 1 ? '0'.repeat(64) : `h${i - 1}`,
      entryHash: `h${i}`,
      moduleId: 'decision',
      signerKeyFingerprint: 'fp',
      accountCommitment: 'c'.repeat(64),
      serverTimestamp: '2026-08-25T09:00:00Z',
      payloadCanonical: `{"kind":"decision.created","n":${i}}`
    });
  }
  return out;
}

// -- Die heile Kette ----------------------------------------------------------

ok('Eine durchgehende Kette geht auf',
  rcRecompute(chain(5)), { intact: true, firstBrokenSequence: null, reason: null, checked: 5 });

ok('Eine leere Kette geht auf — es gibt nichts, was nicht stimmt',
  rcRecompute([]), { intact: true, firstBrokenSequence: null, reason: null, checked: 0 });

ok('Ein einzelner Eintrag geht auf',
  rcRecompute(chain(1)), { intact: true, firstBrokenSequence: null, reason: null, checked: 1 });

// Die Reihenfolge der Lieferung darf egal sein: geprüft wird die Kette, nicht
// die Reihenfolge, in der jemand sie herausgibt.
ok('Verkehrt herum geliefert ändert nichts',
  rcRecompute([...chain(4)].reverse()),
  { intact: true, firstBrokenSequence: null, reason: null, checked: 4 });

// -- Die Eingriffe, gegen die es gedacht ist ---------------------------------

// Eine Zeile herausnehmen: die Nummern springen.
{
  const cut = chain(5).filter((e) => e.sequence !== 3);
  ok('Eine herausgenommene Zeile fällt auf',
    rcRecompute(cut), { intact: false, firstBrokenSequence: 4, reason: 'chain.gap', checked: 3 });
}

// Einen Inhalt austauschen und den Hash mit ihm: das nächste Glied passt nicht mehr.
{
  const tampered = chain(5);
  tampered[2] = { ...tampered[2], entryHash: 'gefaelscht' };
  ok('Ein ausgetauschter Hash bricht das nächste Glied',
    rcRecompute(tampered),
    { intact: false, firstBrokenSequence: 4, reason: 'chain.broken_link', checked: 4 });
}

// Zwei vertauschen: die Nummern stimmen nicht mehr zur Verkettung. Da sortiert
// wird, zeigt sich das an den Hashes.
{
  const swapped = chain(5);
  const a = swapped[1];
  swapped[1] = { ...swapped[2], sequence: a.sequence };
  swapped[2] = { ...a, sequence: 3 };
  ok('Zwei vertauschte Einträge fallen auf',
    rcRecompute(swapped).intact, false);
}

// Nachträglich einen einschieben, ohne die Kette neu zu rechnen.
{
  const inserted = chain(4);
  inserted.splice(2, 0, {
    ...inserted[2],
    sequence: 3,
    entryId: 'eingeschoben',
    previousHash: 'h2',
    entryHash: 'hX'
  });
  // Ab hier gibt es zwei Einträge mit Nummer 3 — die Nummern steigen nicht mehr.
  ok('Ein nachträglich eingeschobener Eintrag fällt auf',
    rcRecompute(inserted).intact, false);
}

// Der erste Eintrag zeigt auf 32 Nullbytes. Ein anderer Vorgänger dort wäre
// eine zweite Kette — aber ohne die vorige kann diese Prüfung das nicht sehen,
// und sie behauptet es auch nicht.
{
  const forked = chain(3);
  forked[0] = { ...forked[0], previousHash: 'f'.repeat(64) };
  ok('Ein fremder Anfang bricht die Verkettung hier NICHT — das ist ehrlich',
    rcRecompute(forked).intact, true);
}

// -- Die zweite Meinung -------------------------------------------------------

function verdict(over: Partial<RcLedgerVerdict> = {}): RcLedgerVerdict {
  return {
    ledgerId: 'l1',
    entries: 5,
    intact: true,
    headSequence: 5,
    headHash: 'h5',
    ...over
  } as RcLedgerVerdict;
}

ok('Beide sagen „heil" — sie sind sich einig',
  rcAgrees(rcRecompute(chain(5)), verdict()), true);

// DER Fall, für den die ganze Ansicht da ist: der Dienst behauptet, seine
// Kette sei heil, während die von ihm gelieferten Einträge das Gegenteil sagen.
{
  const cut = chain(5).filter((e) => e.sequence !== 3);
  ok('Dienst sagt heil, die Einträge sagen kaputt — Uneinigkeit',
    rcAgrees(rcRecompute(cut), verdict()), false);
}

// Und umgekehrt: er meldet einen Bruch, den die eigene Rechnung nicht sieht.
ok('Dienst meldet einen Bruch, die eigene Rechnung nicht — auch Uneinigkeit',
  rcAgrees(rcRecompute(chain(5)), verdict({ intact: false, firstBrokenSequence: 3 })), false);

// Einig über den Bruch, aber an verschiedenen Stellen: ebenfalls Uneinigkeit.
{
  const cut = chain(5).filter((e) => e.sequence !== 3);
  ok('Beide sehen einen Bruch, aber woanders — Uneinigkeit',
    rcAgrees(rcRecompute(cut), verdict({ intact: false, firstBrokenSequence: 2 })), false);
}

// Dieselbe Stelle, dasselbe Urteil: einig.
{
  const cut = chain(5).filter((e) => e.sequence !== 3);
  ok('Beide sehen denselben Bruch an derselben Stelle — einig',
    rcAgrees(rcRecompute(cut), verdict({ intact: false, firstBrokenSequence: 4 })), true);
}

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
