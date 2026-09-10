/**
 * Die Regeln der Pfarrgruppen.
 *
 * <b>Zwei Dinge gehen hier still daneben, und beide kosten fremde Arbeit.</b>
 *
 *   1. Eine versiegelte Notiz, die wie eine leere aussieht. Wer darauf
 *      speichert, ueberschreibt etwas, das er nie gesehen hat — und niemand
 *      erfaehrt, was dort stand.
 *
 *   2. Ein Pfarrverwalter, der in „meine Gruppen" saemtliche Gruppen der
 *      Pfarrei findet. Er gehoert zu keiner; er darf sie nur alle oeffnen.
 *      Beides zusammenzuwerfen macht die Unterscheidung wertlos, auf die es
 *      ankommt.
 */

import {
  rcGroupBlocker, rcGroupSlug, rcGroupStance, rcMemberCount, rcNoteState,
  rcPublicInfoMissing, rcSortGroups, type RcGroup
} from './rcGroups';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

// -- Die Adresse --------------------------------------------------------------

ok('Aus einem Namen wird eine Adresse', rcGroupSlug('Ministranci'), 'ministranci');
ok('Polnische Zeichen fallen weg', rcGroupSlug('Wspólnota Żywego Różańca'), 'wsp-lnota-ywego-r-a-ca');
ok('Randstriche bleiben nicht stehen', rcGroupSlug('  Schola  '), 'schola');
ok('Mehrere Trennzeichen werden eines', rcGroupSlug('Oaza — Ruch Światło'), 'oaza-ruch-wiat-o');
ok('Leer bleibt leer', rcGroupSlug('   '), '');

// -- Warum der Knopf grau ist -------------------------------------------------
//
// Ein Knopf, der nicht geht und nicht sagt warum, sieht aus wie ein kaputtes
// Programm. Genau das ist beim Veranstaltungskreator passiert.

ok('Nichts eingetragen', rcGroupBlocker('', '', []), 'Wpisz nazwę i adres.');
ok('Nur der Name fehlt', rcGroupBlocker('', 'schola', []), 'Wpisz nazwę.');
ok('Nur die Adresse fehlt', rcGroupBlocker('Schola', '', []), 'Wpisz adres (slug).');

ok('Grossbuchstaben in der Adresse',
  rcGroupBlocker('Schola', 'Schola', []), 'Adres: małe litery, cyfry i myślniki.');

/*
 * DAS WORT, DAS EINE HANDLUNG IST.
 *
 * Eine Gruppe namens „new" waere unter `…/community/new` nicht erreichbar —
 * dort steht der Knopf „neue Gruppe". Sie entstuende, sie stuende in der
 * Liste, und sie ginge nicht auf.
 */
ok('Reserviertes Wort', rcGroupBlocker('Nowa', 'new', []),
  '„new" w adresie oznacza działanie, nie nazwę.');

ok('Adresse vergeben', rcGroupBlocker('Schola', 'schola', ['schola', 'oaza']),
  'Ten adres jest już zajęty w tej parafii.');

ok('Alles in Ordnung', rcGroupBlocker('Schola', 'schola', ['oaza']), null);

/* Nur Leerzeichen ist kein Name. */
ok('Leerzeichen zaehlen nicht als Name', rcGroupBlocker('   ', 'schola', []), 'Wpisz nazwę.');

// -- Die interne Notiz --------------------------------------------------------

/*
 * DIE ZEILE, DIE HIER DEN GANZEN PUNKT TRAEGT.
 *
 * Der Dienst schreibt leere Felder GAR NICHT (`RcResults` laesst sie weg).
 * Eine Gruppe ohne Notiz kommt also ohne `note` UND ohne `noteUnreadable` an —
 * nicht mit `null`. Wer auf `!== null` prueft, bekommt fuer `undefined` ein Ja
 * und erklaert jede Gruppe fuer versiegelt.
 *
 * Genau dieser Fehler hat einmal den ganzen Terminplan „zapieczętowane"
 * anzeigen lassen. Deshalb steht der Erfolgsfall hier so, wie er WIRKLICH
 * ankommt: ohne die Felder.
 */
const asSent = JSON.parse(JSON.stringify({
  groupId: 'g1', slug: 'schola', name: 'Schola'
  /* kein `note`, kein `noteUnreadable` */
})) as { note?: string | null; noteUnreadable?: string | null };

ok('Ohne Notiz ist nicht versiegelt', rcNoteState(asSent), { kind: 'none' });

ok('Eine Notiz kommt durch',
  rcNoteState({ note: 'Klucz do zakrystii ma pani K.' }),
  { kind: 'text', text: 'Klucz do zakrystii ma pani K.' });

ok('Ausdruecklich null ist keine Notiz',
  rcNoteState({ note: null, noteUnreadable: null }), { kind: 'none' });

/*
 * DER FALL, DER NICHT WIE „LEER" AUSSEHEN DARF.
 *
 * Hier steht etwas, und der Leser bekommt es nicht auf. Das Formular darf ihn
 * darauf NICHT schreiben lassen.
 */
ok('Ohne Schluessel versiegelt',
  rcNoteState({ noteUnreadable: 'crypto.missing_epoch' }),
  { kind: 'sealed', reason: 'crypto.missing_epoch' });

ok('Versiegelt schlaegt Text',
  rcNoteState({ note: null, noteUnreadable: 'crypto.aad_mismatch' }),
  { kind: 'sealed', reason: 'crypto.aad_mismatch' });

// -- Wer was darf -------------------------------------------------------------

ok('Ein Mitglied',
  rcGroupStance({ mine: true, mayAdmin: false }),
  { member: true, admin: false, leading: false, inside: true, mayHandOver: false, mayInvite: false });

/*
 * DER PFARRVERWALTER GEHOERT ZU KEINER GRUPPE.
 *
 * Er kann jede oeffnen und jede aendern — aber „meine Gruppen" sind seine
 * nicht. Wuerde `member` aus `mayAdmin` folgen, stuenden bei ihm alle zwoelf
 * Gruppen der Pfarrei unter „moje wspólnoty", und die Ueberschrift waere eine
 * Luege.
 */
ok('Der Verwalter ist kein Mitglied',
  rcGroupStance({ mine: false, mayAdmin: true }),
  { member: false, admin: true, leading: false, inside: true, mayHandOver: true, mayInvite: true });

ok('Ein Fremder bleibt draussen',
  rcGroupStance({ mine: false, mayAdmin: false }),
  { member: false, admin: false, leading: false, inside: false, mayHandOver: false, mayInvite: false });

/*
 * DAS AMT IST NICHT DIE BERECHTIGUNG (rc_0037).
 *
 * Der Pfarrverwalter DARF jede Gruppe aendern und FUEHRT keine. Faellt
 * `leading` mit `admin` zusammen, stehen in seinem „prowadzę" zwanzig
 * fremde Gruppen — und die Ueberschrift ist eine Luege.
 */
ok('Verwalten ist nicht fuehren',
  rcGroupStance({ mine: false, mayAdmin: true, leading: false }).leading, false);

ok('Wer das Amt haelt, fuehrt',
  rcGroupStance({ mine: true, mayAdmin: true, leading: true }).leading, true);

/*
 * `leading` FEHLT in der Antwort, wenn es falsch ist — der Dienst schreibt
 * leere Felder nicht. `undefined` muss hier `false` heissen und nicht
 * „wahr, weil gesetzt".
 */
ok('Fehlendes Feld heisst: fuehrst du nicht',
  rcGroupStance({ mine: true, mayAdmin: false }).leading, false);

/*
 * EINLADEN KANN NUR DER VERWALTER.
 *
 * Der Link traegt den Schluessel der Mitgliedsrolle. Wer ihn weitergibt,
 * vergibt Zugang zu allem, was seit der Epoche geschrieben wurde — koennte das
 * jedes Mitglied, entschiede ueber die Zusammensetzung niemand mehr.
 */
ok('Ein Mitglied laedt nicht ein',
  rcGroupStance({ mine: true, mayAdmin: false }).mayInvite, false);

// -- Was fuer die Pfarrseite noch fehlt ---------------------------------------
//
// Eine Gruppe ist in einer halben Minute angelegt: Name, Adresse, fertig.
// Anriss und Treffzeit sind freiwillig — und bleiben deshalb leer. Im
// Schaukasten haengt dann ein Name, und wer eine Gruppe sucht, erfaehrt
// nichts.

ok('Frisch angelegt fehlt beides',
  rcPublicInfoMissing({ isPublic: true }), ['opis', 'godziny spotkań']);

ok('Nur der Anriss fehlt',
  rcPublicInfoMissing({ summary: null, meets: 'soboty 10:00', isPublic: true }), ['opis']);

ok('Nur die Zeit fehlt',
  rcPublicInfoMissing({ summary: 'Dla chłopców', meets: '', isPublic: true }),
  ['godziny spotkań']);

ok('Vollstaendig',
  rcPublicInfoMissing({ summary: 'Dla chłopców', meets: 'soboty 10:00', isPublic: true }), []);

/* Leerzeichen sind kein Anriss. */
ok('Nur Leerzeichen zaehlt nicht',
  rcPublicInfoMissing({ summary: '   ', meets: '  ', isPublic: true }),
  ['opis', 'godziny spotkań']);

/*
 * WER NICHT AUSHAENGT, DEM FEHLT NICHTS.
 *
 * Eine Gruppe von der Seite zu nehmen ist eine Entscheidung. Sie danach
 * anzumahnen, sie sei unvollstaendig, ist ein Vorwurf fuer etwas, das
 * jemand absichtlich getan hat.
 */
ok('Nicht auf der Seite: nichts zu ergaenzen',
  rcPublicInfoMissing({ isPublic: false }), []);

// -- Die Liste ----------------------------------------------------------------

const group = (over: Partial<RcGroup> & { slug: string }): RcGroup => ({
  groupId: over.slug,
  name: over.slug,
  summary: null,
  meets: null,
  isPublic: true,
  lifecycle: 'active',
  areaId: 'a',
  calendarId: 'c',
  memberRoleId: 'r',
  leaderRoleId: 'l',
  members: 3,
  mine: false,
  mayAdmin: false,
  leading: false,
  ...over
} as RcGroup);

const sorted = rcSortGroups([
  group({ slug: 'schola', mine: true }),
  group({ slug: 'oaza' }),
  group({ slug: 'dawna', lifecycle: 'archived', mine: true }),
  group({ slug: 'ministranci', mine: true })
]);

ok('Meine', sorted.mine.map((g) => g.slug), ['schola', 'ministranci']);
ok('Andere', sorted.others.map((g) => g.slug), ['oaza']);

/*
 * EINE ARCHIVIERTE GRUPPE VERSCHWINDET NICHT — sie steht nur unten. Wer sie
 * sucht, sucht sie genau deshalb, weil er sich an sie erinnert.
 */
ok('Archiviert steht fuer sich', sorted.archived.map((g) => g.slug), ['dawna']);
ok('Und nicht bei „meine"', sorted.mine.some((g) => g.slug === 'dawna'), false);

ok('Leere Liste', rcSortGroups([]), { mine: [], others: [], archived: [] });

// -- Die Zahl der Mitglieder --------------------------------------------------
//
// Polnisch zaehlt in drei Formen. „3 osób" ist falsch und faellt jedem auf,
// der es liest — an einer Stelle, an der es um Sorgfalt gehen soll.

ok('Eine', rcMemberCount(1), '1 osoba');
ok('Zwei', rcMemberCount(2), '2 osoby');
ok('Vier', rcMemberCount(4), '4 osoby');
ok('Fuenf', rcMemberCount(5), '5 osób');
ok('Zwoelf bleibt osób', rcMemberCount(12), '12 osób');
ok('Dreiundzwanzig', rcMemberCount(23), '23 osoby');
ok('Fuenfundzwanzig', rcMemberCount(25), '25 osób');
ok('Hundertzwei', rcMemberCount(102), '102 osoby');
ok('Keine', rcMemberCount(0), '0 osób');

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
