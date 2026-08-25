/**
 * Die Entscheidungen rund um Einladungen, ohne Browser geprüft.
 *
 * Zwei davon tragen echte Folgen: ob ein Link noch brauchbar ist (sonst steht
 * ein Knopf da, der zuverlässig mit einer Absage endet), und ob das Geheimnis
 * beim Zerlegen der Adresse heil bleibt (sonst ist der Link kaputt, und der
 * lässt sich nicht wiederherstellen).
 */

import {
  rcInviteLink, rcInviteOpened, rcInviteSpent, rcSecretFromHash, type RcInvitation
} from './rcInvite';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

const NOW = new Date('2026-08-25T12:00:00Z');

function invite(over: Partial<RcInvitation> = {}): RcInvitation {
  return {
    invitationId: '0190a1b2-0000-7000-8000-000000000001',
    roleId: '0190a1b2-0000-7000-8000-0000000000aa',
    purpose: 'AreaInvitation',
    expiresUtc: '2026-09-25T12:00:00Z',
    useCount: 0,
    ...over
  } as RcInvitation;
}

// -- Ist der Link noch brauchbar? --------------------------------------------

ok('Frisch und ungenutzt ist brauchbar',
  rcInviteSpent(invite(), NOW), false);

ok('Abgelaufen ist verbraucht',
  rcInviteSpent(invite({ expiresUtc: '2026-08-24T12:00:00Z' }), NOW), true);

// Genau auf die Sekunde abgelaufen zählt als abgelaufen. Ein Link, der in der
// Oberfläche noch brauchbar aussieht und beim Klick abgewiesen wird, ist die
// unangenehmere Hälfte des Zweifelsfalls.
ok('Genau abgelaufen zählt als abgelaufen',
  rcInviteSpent(invite({ expiresUtc: NOW.toISOString() }), NOW), true);

ok('Ohne Höchstzahl bleibt er brauchbar, auch nach vielen Einlösungen',
  rcInviteSpent(invite({ useCount: 99, maxUses: null }), NOW), false);

ok('Einmal-Link nach der ersten Einlösung ist verbraucht',
  rcInviteSpent(invite({ useCount: 1, maxUses: 1 }), NOW), true);

ok('Einmal-Link vor der Einlösung ist brauchbar',
  rcInviteSpent(invite({ useCount: 0, maxUses: 1 }), NOW), false);

ok('Mehr Einlösungen als erlaubt zählt ebenfalls als verbraucht',
  rcInviteSpent(invite({ useCount: 5, maxUses: 3 }), NOW), true);

// Abgelaufen schlägt Restnutzungen: die Zeit ist um, egal wie viele noch offen wären.
ok('Abgelaufen schlägt offene Restnutzungen',
  rcInviteSpent(invite({ expiresUtc: '2026-08-01T00:00:00Z', useCount: 0, maxUses: 10 }), NOW), true);

// -- 10.3: schon geöffnet? ----------------------------------------------------

ok('Ungeöffnet ist ungeöffnet', rcInviteOpened(invite()), false);
ok('Ein Zeitpunkt heisst geöffnet',
  rcInviteOpened(invite({ firstOpenedUtc: '2026-08-20T08:00:00Z' })), true);

// -- Der Link und das Fragment ------------------------------------------------

// Das Geheimnis steht HINTER der Raute. Was dort steht, schickt der Browser
// nicht an den Server — stünde es im Pfad, läge es in jedem Zugriffsprotokoll
// auf dem Weg.
ok('Der Link trägt das Geheimnis im Fragment',
  rcInviteLink('abc123', 'https://example.org/'), 'https://example.org/#/new/invite/abc123');

ok('Und es kommt unverändert wieder heraus',
  rcSecretFromHash(rcInviteLink('abc123', 'https://example.org/')), 'abc123');

// Base64url enthält `-` und `_`; beides muss die Reise überstehen.
{
  const secret = 'aB-_9xYz-lange_kennung';
  ok('Base64url übersteht Hin- und Rückweg',
    rcSecretFromHash(rcInviteLink(secret, 'https://example.org/')), secret);
}

// Und Zeichen, die kodiert werden müssen, ebenso.
{
  const secret = 'a+b/c=d';
  const link = rcInviteLink(secret, 'https://example.org/');
  ok('Zeichen, die kodiert werden, kommen entkodiert zurück',
    rcSecretFromHash(link), secret);
  ok('Und stehen im Link wirklich kodiert da', link.includes('+'), false);
}

ok('Ohne Einladung im Fragment kommt nichts heraus',
  rcSecretFromHash('#/new'), null);

ok('Eine leere Adresse ergibt nichts',
  rcSecretFromHash(''), null);

// Ein angehängter Zusatz gehört nicht zum Geheimnis.
ok('Was nach dem Geheimnis kommt, gehört nicht dazu',
  rcSecretFromHash('#/new/invite/abc123/weiter'), 'abc123');

ok('Auch eine Abfrage dahinter nicht',
  rcSecretFromHash('#/new/invite/abc123?x=1'), 'abc123');

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
