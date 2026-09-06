/**
 * Der Aushang der Messintentionen.
 *
 * <b>Warum gerade das geprueft wird.</b> Das Blatt haengt seit Jahren im
 * Schaukasten, und die Leute lesen es mit einem Blick, der seine Form kennt.
 * Was daran verrutscht, faellt hier niemandem auf und dort sofort — aber erst,
 * wenn es schon haengt.
 *
 * Die zwei Regeln, die das Muster wirklich traegt: EINE Intention steht ohne
 * Nummer, MEHRERE bekommen „1)", „2)". Und der Text geht woertlich durch.
 */

import {
  rcIntentionsSheetHtml, rcSheetDay, rcSheetRange, rcSheetWeek
} from './rcPrintIntentions';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

// -- Der Zeitraum im Kopf -----------------------------------------------------

/*
 * Genau die Zeile des Musters: „31 sierpnia – 6 września 2026 roku".
 * Genitiv, das Jahr einmal am Ende.
 */
ok('Ueber den Monatswechsel',
  rcSheetRange(new Date('2026-08-31T00:00:00'), new Date('2026-09-06T00:00:00')),
  '31 sierpnia – 6 września 2026 roku');

/*
 * Im selben Monat faellt der erste Monatsname weg — „1 – 6 września" liest
 * sich besser als „1 września – 6 września", und so steht es auf dem Muster.
 */
ok('Im selben Monat nur einmal der Monat',
  rcSheetRange(new Date('2026-09-01T00:00:00'), new Date('2026-09-06T00:00:00')),
  '1 – 6 września 2026 roku');

/* Ueber den Jahreswechsel muss das erste Jahr dastehen, sonst luegt die Zeile. */
ok('Ueber den Jahreswechsel steht das erste Jahr',
  rcSheetRange(new Date('2026-12-28T00:00:00'), new Date('2027-01-03T00:00:00')),
  '28 grudnia 2026 – 3 stycznia 2027 roku');

ok('Unsinn ergibt nichts', rcSheetRange(new Date('kein datum'), new Date()), '');

// -- Die Woche laeuft von Montag bis Sonntag ----------------------------------

/*
 * Der Sonntag ist der Gipfel der Woche, nicht ihr Anfang — das Muster beginnt
 * am Montag. `getDay()` zaehlt aber ab Sonntag, und genau daran verrutscht so
 * etwas: aus dem Sonntag wuerde sonst der Beginn einer neuen Woche.
 */
ok('Mitten in der Woche', rcSheetWeek(new Date('2026-09-02T12:00:00')),
  { from: '2026-08-31', to: '2026-09-06' });

ok('Am Montag selbst', rcSheetWeek(new Date('2026-08-31T12:00:00')),
  { from: '2026-08-31', to: '2026-09-06' });

/* DER FALL, AN DEM ES BRICHT: der Sonntag gehoert zur Woche DAVOR. */
ok('Am Sonntag', rcSheetWeek(new Date('2026-09-06T12:00:00')),
  { from: '2026-08-31', to: '2026-09-06' });

// -- Die Wochentage -----------------------------------------------------------

ok('Montag', rcSheetDay('2026-08-31T05:00:00'), 'poniedziałek');
ok('Sonntag', rcSheetDay('2026-09-06T06:00:00'), 'niedziela');

// -- Das Blatt selbst ---------------------------------------------------------

const mass = (
  startsUtc: string, ...texts: string[]
) => ({
  itemId: 'i', startsUtc, endsUtc: startsUtc, title: null, location: null,
  status: 'confirmed', itemType: 'mass',
  intentions: texts.map((text, i) => ({ ordinal: i, text, kind: 'single' }))
});

const plan = [
  mass('2026-08-31T05:00:00', '† Kazimierz Uryga (1 rocz. śm.)', 'W intencji Pawła i Marty'),
  mass('2026-08-31T17:00:00', '† Stefania Zawartka'),
  mass('2026-09-01T05:00:00', '† Stanisław Czekaj')
];

const html = rcIntentionsSheetHtml(
  plan, new Date('2026-08-31T00:00:00'), new Date('2026-09-06T00:00:00'));

ok('Der Kopf steht da', html.includes('Intencje mszalne'), true);
ok('Der Zeitraum auch', html.includes('31 sierpnia – 6 września 2026 roku'), true);
ok('A4 hochkant', html.includes('size: A4 portrait'), true);

/*
 * DIE REGEL DES MUSTERS.
 *
 * Zwei Intentionen werden zu einer nummerierten Liste; EINE steht ohne Nummer.
 * „1)" bei einer einzigen ordnet nichts — es setzt nur ein Zeichen hin, das
 * niemand gebraucht hat.
 */
ok('Mehrere werden nummeriert', html.includes('<ol class="many">'), true);
ok('Eine steht ohne Nummer', html.includes('<div class="one">† Stefania Zawartka</div>'), true);
ok('Und bekommt keine Liste', html.includes('<ol class="many"><li>† Stefania Zawartka'), false);

/* Der Text geht woertlich durch — Kreuz, Klammer, Jahrestag. */
ok('Der Text bleibt, wie er getippt wurde',
  html.includes('† Kazimierz Uryga (1 rocz. śm.)'), true);

/* Jeder Tag mit seinem Namen. */
ok('Montag steht da', html.includes('poniedziałek'), true);
ok('Dienstag auch', html.includes('wtorek'), true);

/*
 * Fremder Text bleibt Text. Die Intentionen tippt ein Mensch, und ein spitzes
 * Zeichen darin waere sonst das Ende des Blattes.
 */
const risky = rcIntentionsSheetHtml(
  [mass('2026-08-31T05:00:00', '<script>alert(1)</script> & Co')],
  new Date('2026-08-31T00:00:00'), new Date('2026-09-06T00:00:00'));

ok('Kein eingeschleustes Skript', risky.includes('<script>alert(1)</script>'), false);
ok('Aber lesbar da', risky.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; Co'), true);

/* Genau EIN Skript gehoert auf die Seite: das, welches den Druck oeffnet. */
ok('Nur das eigene Skript', risky.split('<script').length - 1, 1);

/*
 * Eine Messe OHNE Intention verschwindet nicht. Die Messe findet statt, und
 * eine Uhrzeit ohne Zeile daneben ist eine Auskunft — eine fehlende Uhrzeit
 * waere eine Falschauskunft.
 */
const bare = rcIntentionsSheetHtml(
  [mass('2026-08-31T05:00:00')],
  new Date('2026-08-31T00:00:00'), new Date('2026-09-06T00:00:00'));

ok('Die Uhrzeit bleibt stehen', bare.includes('class="hour"'), true);
ok('Auch ohne Intention', bare.includes('class="mass"'), true);

/* Abgesagtes gehoert nicht in den Schaukasten. */
const cancelled = rcIntentionsSheetHtml(
  [{ ...mass('2026-08-31T05:00:00', '† Ktoś'), status: 'cancelled' }],
  new Date('2026-08-31T00:00:00'), new Date('2026-09-06T00:00:00'));

ok('Eine abgesagte Messe faellt weg', cancelled.includes('† Ktoś'), false);

// -- Zusammengelegte Intentionen ---------------------------------------------

/*
 * DIE ZWEITE SEITE.
 *
 * Bei einer zusammengelegten Messe steht auf der ersten Seite nur ein Verweis;
 * die Liste selbst kommt dahinter, mit Platz darunter. Der Platz ist der
 * eigentliche Zweck: die Kanzlei traegt die ganze Woche ueber von Hand nach,
 * bis zur Messe. Ein Blatt, das mit der letzten gedruckten Zeile endet, muss
 * nach jedem Anruf neu gedruckt werden.
 */
const withCollective = (startsUtc: string, title: string | null, ...texts: string[]) => ({
  itemId: 'i', startsUtc, endsUtc: startsUtc, title, location: null,
  status: 'confirmed', itemType: 'mass',
  intentions: texts.map((text, i) => ({ ordinal: i, text, kind: 'collective' }))
});

const novena = rcIntentionsSheetHtml(
  [
    mass('2026-09-02T05:00:00', '† Stefania, Józef'),
    withCollective('2026-09-02T16:00:00', 'Msza św. nowennowa',
      '† Jerzy Kardasz',
      'O Boże błog., zdrowie i szczęśliwy przebieg zabiegu',
      'W intencji Pawła i Marty o potrzebne łaski')
  ],
  new Date('2026-08-31T00:00:00'), new Date('2026-09-06T00:00:00'));

/* Auf der ersten Seite steht der Verweis — und NICHT die Liste. */
ok('Der Verweis steht im Tagesplan',
  novena.includes('<div class="pointer">Msza św. nowennowa</div>'), true);

ok('Die zusammengelegte Liste bekommt eine eigene Seite',
  novena.includes('class="sheet collective"'), true);

ok('Und die beginnt eine neue Seite',
  novena.includes('page-break-before: always'), true);

/* Der Text steht genau EINMAL da: hinten, nicht auch noch im Tagesplan. */
ok('Der erste Eintrag steht genau einmal',
  novena.split('† Jerzy Kardasz').length - 1, 1);

ok('Der dritte ebenso',
  novena.split('W intencji Pawła i Marty o potrzebne łaski').length - 1, 1);

/* Auf der zweiten Seite sind sie nummeriert, wie auf dem Muster. */
ok('Hinten nummeriert', novena.includes('<li>† Jerzy Kardasz</li>'), true);

/* Die einzelne Messe desselben Tages bleibt unberuehrt im Plan. */
ok('Die einzelne Intention bleibt vorn',
  novena.includes('<div class="one">† Stefania, Józef</div>'), true);

/*
 * Ohne eigenen Namen ein neutraler: dass jede zusammengelegte Messe eine
 * Novene sei, ist eine Annahme ueber eine fremde Pfarrei.
 */
const unnamed = rcIntentionsSheetHtml(
  [withCollective('2026-09-02T16:00:00', null, '† Ktoś')],
  new Date('2026-08-31T00:00:00'), new Date('2026-09-06T00:00:00'));

ok('Ohne Namen steht der neutrale', unnamed.includes('Intencje zbiorowe'), true);
ok('Und keine erfundene Novene', unnamed.includes('nowenn'), false);

/*
 * EINE MESSE KANN BEIDES TRAGEN. Dann bleiben die einzelnen vorn stehen und
 * nur die zusammengelegten wandern nach hinten — sonst verschwaende eine
 * einzelne Intention hinter einem Verweis, der sie nicht meint.
 */
const both = rcIntentionsSheetHtml(
  [{
    itemId: 'i', startsUtc: '2026-09-02T16:00:00', endsUtc: '2026-09-02T16:00:00',
    title: 'Msza św. nowennowa', location: null, status: 'confirmed', itemType: 'mass',
    intentions: [
      { ordinal: 0, text: '† Pojedyncza', kind: 'single' },
      { ordinal: 1, text: '† Zbiorowa', kind: 'collective' }
    ]
  }],
  new Date('2026-08-31T00:00:00'), new Date('2026-09-06T00:00:00'));

ok('Die einzelne steht vorn', both.includes('<div class="one">† Pojedyncza</div>'), true);
ok('Der Verweis steht daneben', both.includes('<div class="pointer">'), true);
ok('Die zusammengelegte steht hinten', both.includes('<li>† Zbiorowa</li>'), true);

/* Eine Messe OHNE zusammengelegte bekommt auch keine zweite Seite. */
ok('Kein leeres zweites Blatt', html.includes('class="sheet collective"'), false);

// -- Die Beichte gehoert nicht auf dieses Blatt ------------------------------

/*
 * DER AUSHANG HEISST „INTENCJE MSZALNE".
 *
 * Beichtzeiten sind derselbe Gebilde-Typ wie Messen — wiederkehrend,
 * oeffentlich, in der Kirche — und kommen deshalb aus derselben Abfrage. Sie
 * haben aber keine Intentionen, und auf einem Blatt der Messintentionen stuende
 * eine Beichtzeit als Zeile ohne Inhalt zwischen den Messen.
 *
 * Das faellt beim Bauen nicht auf: es sieht aus wie eine Messe, zu der noch
 * niemand etwas angenommen hat.
 */
const withConfession = rcIntentionsSheetHtml(
  [
    mass('2026-08-31T05:00:00', '† Stanisław Czekaj'),
    {
      itemId: 'c', startsUtc: '2026-08-31T16:00:00', endsUtc: '2026-08-31T16:45:00',
      title: 'Spowiedź', location: null, status: 'confirmed',
      itemType: 'confession', intentions: []
    }
  ],
  new Date('2026-08-31T00:00:00'), new Date('2026-09-06T00:00:00'));

ok('Die Messe steht auf dem Blatt',
  withConfession.includes('† Stanisław Czekaj'), true);

ok('Die Beichtzeit nicht', withConfession.includes('Spowiedź'), false);

/* Und ihre Uhrzeit auch nicht — sonst stuende dort eine leere Zeile. */
ok('Auch nicht als leere Zeile',
  withConfession.split('class="mass"').length - 1, 1);

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
