/**
 * Sieben und Sortieren im Katalog.
 *
 * <b>Was hier still danebengeht.</b> Ein Katalog, der falsch siebt, sieht nicht
 * kaputt aus — er zeigt WENIGER. Niemand bemerkt, dass die Pilgerfahrt fehlt;
 * man haelt die kuerzere Liste fuer die ganze. Deshalb steht jede dieser Regeln
 * hier mit einem Fall, an dem sie ohne Pruefung unbemerkt bliebe.
 */

import {
  rcCatalogue, rcCategoriesOf, rcInitials, rcPlacesIn, rcPlacesOf, rcWhen,
  RC_CATALOGUE_ALL, type RcCatalogueEvent
} from './rcCatalogue';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

const event = (over: Partial<RcCatalogueEvent> & { slug: string; title: string }): RcCatalogueEvent => ({
  eventId: over.slug, areaId: 'a', lifecycle: 'published', isPublic: true,
  startsUtc: null, endsUtc: null, pages: 1, parts: 0, registrations: 0,
  summary: null, category: null, audience: null, placesJson: null,
  thumbnailUrl: null, dateLabel: null,
  ...over
} as RcCatalogueEvent);

/** 2026-08-28 12:00 UTC — der Tag aus dem Bildschirmfoto. */
const AUG_28 = Date.UTC(2026, 7, 28, 12);
const AUG_29 = Date.UTC(2026, 7, 29, 12);
const SEP_10 = Date.UTC(2026, 8, 10, 12);

const rower = event({
  slug: 'rowerowa26', title: 'Rowerowa Częstochowa',
  summary: 'Pielgrzymka rowerowa z Krakowa do Częstochowy',
  category: 'Pielgrzymka rowerowa',
  placesJson: '["Kraków","Częstochowa"]',
  startsUtc: new Date(AUG_28).toISOString(),
  endsUtc: new Date(AUG_29).toISOString()
});

const warsztaty = event({
  slug: 'warsztaty', title: 'Warsztaty muzyczne',
  category: 'Warsztaty muzyczne',
  placesJson: '["Mistrzejowice"]',
  startsUtc: new Date(SEP_10).toISOString()
});

const kiedys = event({ slug: 'kiedys', title: 'Adwent' });

const all = [rower, warsztaty, kiedys];
const slugs = (found: readonly RcCatalogueEvent[]) => found.map((one) => one.slug);

// -- Ohne Filter kommt alles --------------------------------------------------

ok('Alles, nach Termin', slugs(rcCatalogue(all, RC_CATALOGUE_ALL, AUG_28)),
  ['rowerowa26', 'warsztaty', 'kiedys']);

/*
 * Ohne Datum ans ENDE, in BEIDEN Richtungen. „Irgendwann" ist weder das
 * frueheste noch das spaeteste; oben gezeigt draengte es Konkretes nach unten.
 */
ok('Ohne Datum bleibt hinten, auch rueckwaerts',
  slugs(rcCatalogue(all, { ...RC_CATALOGUE_ALL, sort: 'latest' }, AUG_28)),
  ['warsztaty', 'rowerowa26', 'kiedys']);

ok('Nach Titel', slugs(rcCatalogue(all, { ...RC_CATALOGUE_ALL, sort: 'title' }, AUG_28)),
  ['kiedys', 'rowerowa26', 'warsztaty']);

// -- „Nadchodzące" ------------------------------------------------------------

/*
 * DAS ENDE ZAEHLT, NICHT DER ANFANG.
 *
 * Eine zweitaegige Fahrt, die gestern begonnen hat, laeuft heute noch. Sie
 * herauszuwerfen hiesse, sie genau denen zu verbergen, die gerade unterwegs
 * sind — und niemand von ihnen wuerde vermuten, dass sie im Katalog fehlt.
 */
ok('Laufende Fahrt bleibt bevorstehend',
  slugs(rcCatalogue([rower], { ...RC_CATALOGUE_ALL, upcomingOnly: true }, AUG_29)),
  ['rowerowa26']);

ok('Vergangene faellt weg',
  slugs(rcCatalogue([rower], { ...RC_CATALOGUE_ALL, upcomingOnly: true }, SEP_10)),
  []);

ok('Ohne Datum gilt als bevorstehend',
  slugs(rcCatalogue([kiedys], { ...RC_CATALOGUE_ALL, upcomingOnly: true }, SEP_10)),
  ['kiedys']);

// -- Suche --------------------------------------------------------------------

ok('Titel', slugs(rcCatalogue(all, { ...RC_CATALOGUE_ALL, text: 'rowerowa' }, AUG_28)),
  ['rowerowa26']);

/* Wer „czestochowa" ohne Zeichen tippt, meint „Częstochowa". */
ok('Ohne diakritische Zeichen',
  slugs(rcCatalogue(all, { ...RC_CATALOGUE_ALL, text: 'czestochowa' }, AUG_28)),
  ['rowerowa26']);

ok('Mit diakritischen Zeichen',
  slugs(rcCatalogue(all, { ...RC_CATALOGUE_ALL, text: 'Częstochowa' }, AUG_28)),
  ['rowerowa26']);

ok('Ort zaehlt mit',
  slugs(rcCatalogue(all, { ...RC_CATALOGUE_ALL, text: 'mistrzejowice' }, AUG_28)),
  ['warsztaty']);

/*
 * Jedes WORT muss vorkommen, nicht die Zeichenfolge. Wer „rower krakow" tippt,
 * meint beides — nicht diese Reihenfolge.
 */
ok('Zwei Woerter, beliebige Reihenfolge',
  slugs(rcCatalogue(all, { ...RC_CATALOGUE_ALL, text: 'krakow rower' }, AUG_28)),
  ['rowerowa26']);

ok('Ein Wort trifft nicht', slugs(rcCatalogue(all, { ...RC_CATALOGUE_ALL, text: 'rower morze' }, AUG_28)), []);
ok('Leere Suche siebt nicht', slugs(rcCatalogue(all, { ...RC_CATALOGUE_ALL, text: '   ' }, AUG_28)).length, 3);

// -- Art und Ort --------------------------------------------------------------

ok('Nach Art',
  slugs(rcCatalogue(all, { ...RC_CATALOGUE_ALL, category: 'Warsztaty muzyczne' }, AUG_28)),
  ['warsztaty']);

ok('Nach Ort',
  slugs(rcCatalogue(all, { ...RC_CATALOGUE_ALL, place: 'Kraków' }, AUG_28)),
  ['rowerowa26']);

ok('Art und Ort zusammen',
  slugs(rcCatalogue(all, { ...RC_CATALOGUE_ALL, category: 'Warsztaty muzyczne', place: 'Kraków' }, AUG_28)),
  []);

// -- Die Filterlisten bauen sich aus den Daten --------------------------------

ok('Arten', rcCategoriesOf(all), ['Pielgrzymka rowerowa', 'Warsztaty muzyczne']);
ok('Orte', rcPlacesIn(all), ['Częstochowa', 'Kraków', 'Mistrzejowice']);

// -- Kaputte Ortsangabe kostet die Orte, nicht die Zeile -----------------------

const kaputt = event({ slug: 'x', title: 'X', placesJson: '{nicht' });
ok('Kaputtes JSON', rcPlacesOf(kaputt), []);
ok('Und die Zeile bleibt', slugs(rcCatalogue([kaputt], RC_CATALOGUE_ALL, AUG_28)), ['x']);
ok('Liste mit Unfug darin', rcPlacesOf(event({ slug: 'y', title: 'Y', placesJson: '["Kraków",7,""]' })),
  ['Kraków']);

// -- Der Zeitraum in einer Zeile ----------------------------------------------

ok('Zwei Tage im selben Monat', rcWhen(rower), '28–29 sierpnia 2026');
ok('Ein Tag', rcWhen(warsztaty), '10 września 2026');
ok('Ohne Datum', rcWhen(kiedys), null);

/* Eine eigene Aufschrift schlaegt die Daten: sie sagt oft mehr. */
ok('Eigene Aufschrift gewinnt',
  rcWhen(event({ slug: 'z', title: 'Z', dateLabel: 'Adwent 2026', startsUtc: new Date(AUG_28).toISOString() })),
  'Adwent 2026');

// -- Die Kachel ohne Bild -----------------------------------------------------

ok('Zwei Woerter', rcInitials('Rowerowa Częstochowa'), 'RC');
ok('Ein Wort', rcInitials('Adwent'), 'AD');
ok('Leer', rcInitials('   '), '??');

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
