/**
 * Die Wahl der Person.
 *
 * <b>Was hier schiefgeht, sieht man nicht.</b> Zeigt die Wahl auf die falsche
 * Person, geht trotzdem alles auf — nur eben für das andere Kind. Geprüft wird
 * deshalb vor allem, was passiert, wenn die gespeicherte Wahl NICHT mehr gilt.
 */

import {
  rcActivePerson, rcSetActivePerson, rcResolvePerson, rcOnActivePerson
} from './rcActivePerson';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

/* Ein Speicher, wie der Browser ihn hat — samt der Möglichkeit zu werfen. */
function fakeStorage(broken = false) {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => { if (broken) throw new Error('gesperrt'); return map.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (broken) throw new Error('gesperrt'); map.set(k, v); },
    removeItem: (k: string) => { if (broken) throw new Error('gesperrt'); map.delete(k); },
    _map: map
  };
}

const listeners: ((e: unknown) => void)[] = [];
(globalThis as Record<string, unknown>).window = {
  localStorage: fakeStorage(),
  addEventListener: (_: string, fn: (e: unknown) => void) => { listeners.push(fn); },
  removeEventListener: () => { /* für diese Prüfung ohne Belang */ }
};

const w = () => (globalThis as unknown as { window: { localStorage: ReturnType<typeof fakeStorage> } }).window;

const ANNA = '0192f0a1-1111-7222-8333-444455556666';
const JAN = '0192f0a1-2222-7222-8333-444455556666';
const KONTO = 'konto-1';

// -- Wählen und wiederfinden ---------------------------------------------------

ok('Ohne Wahl ist nichts gewaehlt', rcActivePerson(KONTO), null);

rcSetActivePerson(KONTO, ANNA);
ok('Was gewaehlt wurde, steht da', rcActivePerson(KONTO), ANNA);

rcSetActivePerson(KONTO, JAN);
ok('Umwaehlen ersetzt', rcActivePerson(KONTO), JAN);

rcSetActivePerson(KONTO, null);
ok('Loeschen loescht', rcActivePerson(KONTO), null);

/*
 * Zwei Menschen an einem Rechner sollen die Wahl des anderen nicht erben.
 */
rcSetActivePerson(KONTO, ANNA);
rcSetActivePerson('konto-2', JAN);
ok('Jedes Konto hat seine eigene Wahl', rcActivePerson(KONTO), ANNA);
ok('Und das andere seine', rcActivePerson('konto-2'), JAN);

/* Ein Konto ohne Kennung kann nichts merken — und darf daran nicht scheitern. */
rcSetActivePerson('', ANNA);
ok('Ohne Kontokennung wird nichts gemerkt', rcActivePerson(''), null);

// -- Was passiert, wenn die Wahl ins Leere zeigt -------------------------------

const persons = [{ roleId: ANNA }, { roleId: JAN }];

rcSetActivePerson(KONTO, JAN);
ok('Eine gueltige Wahl gilt', rcResolvePerson(KONTO, persons), JAN);

/*
 * Die gespeicherte Rolle gibt es nicht mehr — entzogen, oder der Speicher
 * stammt von einem anderen Konto. Dann gilt die erste vorhandene Person und
 * NICHT eine Auswahl, die niemanden meint.
 */
rcSetActivePerson(KONTO, 'weg-0000-0000-0000-000000000000');
ok('Eine tote Wahl faellt auf die erste zurueck', rcResolvePerson(KONTO, persons), ANNA);

rcSetActivePerson(KONTO, null);
ok('Ohne Wahl gilt die erste', rcResolvePerson(KONTO, persons), ANNA);

/* Kein Mensch, keine Wahl — und kein Absturz. */
ok('Ohne Personen bleibt es leer', rcResolvePerson(KONTO, []), null);

// -- Ein gesperrter Speicher darf die Seite nicht kosten -----------------------

/*
 * Privates Fenster, gesperrte Website-Daten, voller Speicher: alle drei werfen
 * beim Zugriff. Eine Seite, die daran zerbricht, zerbricht genau bei denen, die
 * ihre Daten am ehesten schuetzen.
 */
w().localStorage = fakeStorage(true);

ok('Lesen wirft nicht', rcActivePerson(KONTO), null);

let threw = false;
try { rcSetActivePerson(KONTO, ANNA); } catch { threw = true; }
ok('Schreiben wirft nicht', threw, false);

ok('Und die erste Person gilt weiterhin', rcResolvePerson(KONTO, persons), ANNA);

// -- Zuhören ------------------------------------------------------------------

w().localStorage = fakeStorage();

let heard = 0;
const stop = rcOnActivePerson(() => { heard += 1; });

rcSetActivePerson(KONTO, ANNA);
ok('Der eigene Tab erfaehrt es', heard, 1);

/*
 * Das `storage`-Ereignis feuert NUR in den anderen Tabs — deshalb ruft das
 * Setzen die Zuhörer im eigenen Tab selbst. Ohne das stuende hier eine
 * Person und dort eine andere.
 */
for (const fn of listeners) fn({ key: 'rc.person.konto-1' });
ok('Ein anderer Tab auch', heard, 2);

/* Fremde Schluessel gehen niemanden etwas an. */
for (const fn of listeners) fn({ key: 'etwas.anderes' });
ok('Fremde Aenderungen wecken niemanden', heard, 2);

stop();

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
