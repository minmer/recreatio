/**
 * Die Entscheidungen des Chats, ohne Browser geprüft.
 *
 * Was hier steht, ist absichtlich das Unscheinbarste am ganzen Kapitel: welche
 * von fünf Erscheinungen eine Nachricht bekommt, und wo ein Strich hingehört.
 * Beides fällt nicht auf, wenn es falsch ist — eine falsch eingeordnete
 * Nachricht sieht aus wie eine richtige, ein fehlender Strich wie ein
 * lückenloses Gespräch. Genau deshalb wird es geprüft und nicht angesehen.
 */

import { rcEpochBreaks, rcMessageState, type RcMessage } from './rcChat';

// -- Prüfgerüst ---------------------------------------------------------------

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

/** Eine vollständige Nachricht; die Prüfung überschreibt, was sie braucht. */
function msg(over: Partial<RcMessage> = {}): RcMessage {
  return {
    messageId: '0190a1b2-0000-7000-8000-000000000001',
    epoch: 1,
    authorRoleId: '0190a1b2-0000-7000-8000-0000000000aa',
    body: 'Gesagt.',
    version: 1,
    postedUtc: '2026-08-25T09:00:00Z',
    ...over
  } as RcMessage;
}

// -- 15.9: fünf Zustände, und keiner fällt durch ------------------------------

ok('Lesbarer Text ist Text',
  rcMessageState(msg()).kind, 'text');

ok('9.17 Zurückgenommen schlägt alles andere',
  rcMessageState(msg({ hiddenKind: 'author', body: null, authorRoleId: null })).kind, 'withdrawn');

ok('Von der Moderation ausgeblendet ist ein eigener Zustand',
  rcMessageState(msg({ hiddenKind: 'moderation' })).kind, 'moderated');

ok('Fehlende Epoche heisst versiegelt, nicht kaputt',
  rcMessageState(msg({ body: null, unreadable: 'crypto.missing_epoch' })).kind, 'sealed');

// Der Zweig, den ich beim ersten Schreiben übersehen hatte. Ohne ihn wären
// diese vier als leerer Absatz erschienen — also als gar nichts.
for (const reason of ['crypto.failed', 'crypto.aad_mismatch', 'crypto.wrong_key', 'crypto.malformed']) {
  ok(`${reason} ist ein Vorfall, kein Nichts`,
    rcMessageState(msg({ body: null, unreadable: reason })),
    { kind: 'broken', reason });
}

// Zurückgenommen zuerst: über einen Geheimtext, den es nicht mehr gibt, lässt
// sich nichts mehr sagen — auch kein Fehlschlag.
ok('Zurückgenommen geht vor unlesbar',
  rcMessageState(msg({ hiddenKind: 'author', body: null, unreadable: 'crypto.failed' })).kind,
  'withdrawn');

// Kein Text und kein Grund darf der Server nicht liefern. Wenn doch, wird
// daraus ein sichtbarer Vorfall und kein stiller leerer Absatz.
ok('Kein Text ohne Grund wird sichtbar gemacht',
  rcMessageState(msg({ body: null })),
  { kind: 'broken', reason: 'crypto.failed' });

// Ein leerer Text ist etwas anderes als ein fehlender. Er ist lesbar.
ok('Leerer Text ist lesbar, nicht fehlend',
  rcMessageState(msg({ body: '' })).kind, 'text');

// -- Die Epochengrenze --------------------------------------------------------

const feed: RcMessage[] = [
  msg({ messageId: 'a', epoch: 1 }),
  msg({ messageId: 'b', epoch: 1 }),
  msg({ messageId: 'c', epoch: 2 }),
  msg({ messageId: 'd', epoch: 2 }),
  msg({ messageId: 'e', epoch: 4 })
];

ok('Der Strich steht an jedem Wechsel, sonst nirgends',
  [...rcEpochBreaks(feed)], ['c', 'e']);

ok('Vor der ersten Nachricht steht kein Strich',
  rcEpochBreaks([msg({ messageId: 'a', epoch: 7 })]).size, 0);

ok('Ein leerer Verlauf hat keine Grenzen',
  rcEpochBreaks([]).size, 0);

// Ein Sprung über mehrere Epochen ist EIN Strich, nicht drei: der Leser ist
// einmal dazugekommen, nicht dreimal.
ok('Ein Sprung über mehrere Epochen ist ein Strich',
  [...rcEpochBreaks([msg({ messageId: 'a', epoch: 1 }), msg({ messageId: 'b', epoch: 9 })])],
  ['b']);

// -- Ergebnis -----------------------------------------------------------------

// Gemeldet wird durch Werfen, nicht durch `process.exit`: diese Datei soll
// nichts über ihre Umgebung wissen. Dann läuft sie unter Node, und später
// genauso in einem Browser, falls es je darauf ankommt.
if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
