/**
 * Die mitgelieferte Veranstaltung — gegen den Leser, der sie einspielen soll.
 *
 * <b>Warum das eine Pruefung ist und keine Handarbeit.</b> `rowerowa26.event.json`
 * ist eine Datei, die jemand einspielt, um mit einer fertigen Veranstaltung
 * anzufangen. Der Leser dafuer (`rcReadImport`) aendert sich weiter — kommt ein
 * Abschnitt dazu, wird ein Feld umbenannt. Wenn dabei etwas aus der Datei
 * herausfaellt, sieht man es NICHT: die Veranstaltung entsteht, sieht ganz aus,
 * und es fehlt eine Seite, ein Hintergrund oder vierzehn Formularfelder. Wer sie
 * einspielt, sucht den Fehler bei sich.
 *
 * Diese Reihe liest die echte Datei und besteht nur, wenn NICHTS uebergangen
 * wird. Sie ist damit auch die Zusicherung, dass das Dateiformat und der Leser
 * zusammengehoeren — die beiden liegen in verschiedenen Ordnern und in
 * verschiedenen Sprachen.
 */

import { readFileSync } from 'node:fs';

import { rcImportSize, rcReadImport } from './rcEventImport';

let passed = 0;
const failures: string[] = [];

function ok(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`  ${name}\n    erwartet: ${e}\n    erhalten: ${a}`);
}

/*
 * Der Laeufer startet in `frontend/`. Die Datei liegt beim Schema, weil sie zum
 * Bestand gehoert und nicht zum Browser — mitgeliefert wird sie, nicht gebaut.
 */
const SEED = '../backend/legacy/Rc.Schema/Sql/rowerowa26.event.json';

const read = rcReadImport(readFileSync(SEED, 'utf8'));

ok('Die Datei wird angenommen', read.ok, true);

if (read.ok) {
  const plan = read.plan;

  // -- NICHTS wird uebergangen ------------------------------------------------
  //
  // Die wichtigste Zeile der Reihe. Faellt sie, fehlt der eingespielten
  // Veranstaltung etwas — und zwar unsichtbar.
  ok('Nichts uebergangen', plan.skipped, []);

  // -- Der Kopf ---------------------------------------------------------------

  ok('Titel', plan.title, 'Rowerowa Częstochowa 2026');

  /*
   * DIE ADRESSE AUS DER DATEI.
   *
   * Sie entscheidet nicht — das Feld im Formular tut es —, aber sie fuellt es
   * vor. Ohne sie musste man sie abtippen, obwohl sie danebenstand, und der
   * Knopf blieb grau, ohne zu sagen warum.
   */
  ok('Adresse als Vorschlag', plan.head.slug, 'rowerowa26');
  ok('Untertitel', plan.head.subtitle, 'Pielgrzymka rowerowa z Krakowa do Częstochowy');
  ok('Art', plan.head.category, 'Pielgrzymka rowerowa');
  ok('Orte', plan.head.places, ['Kraków', 'Domaniewice', 'Częstochowa']);
  ok('Anfang', plan.head.startDate, '2026-08-28');
  ok('Ende', plan.head.endDate, '2026-08-29');

  /* Der Anriss ist NICHT der Untertitel — zwei Felder, zwei Orte, zwei Toene. */
  ok('Anriss steht getrennt', plan.head.summary !== plan.head.subtitle, true);

  ok('Aussehen kommt mit', plan.head.themeJson !== null, true);

  // -- Die Seiten -------------------------------------------------------------

  ok('Drei Seiten', plan.pages.length, 3);
  ok('Adressen', plan.pages.map((p) => p.slug), ['start', 'uczestnicy', 'prowadzacy']);

  /*
   * Die Art der Seite steht in der DATEI und wird nicht aus den Abschnitten
   * geraten. Ginge sie verloren, waeren die beiden internen Seiten oeffentlich
   * — und der Inhalt, der nur Teilnehmern gilt, laege offen.
   */
  ok('Arten', plan.pages.map((p) => p.kind), ['public', 'internal', 'internal']);

  // -- Die Abschnitte ---------------------------------------------------------

  ok('Umfang', rcImportSize(plan), { pages: 3, parts: 14, fields: 14 });

  ok('Erste Seite', plan.pages[0].parts.map((p) => p.kind),
    ['title', 'shortinfos', 'text', 'plan', 'map', 'form', 'costs', 'text', 'faq', 'contact']);

  /*
   * DIE SEITE ENTSCHEIDET UEBER DIE VERSIEGELUNG, NICHT DIE DATEI.
   *
   * Stuende in der Datei „oeffentlich" und die Seite waere intern, laege der
   * Inhalt im Klartext — und die Adresse allein genuegte zum Lesen.
   */
  ok('Oeffentliche Seite: offene Abschnitte',
    plan.pages[0].parts.every((p) => p.isPublic), true);
  ok('Interne Seite: versiegelte Abschnitte',
    plan.pages[1].parts.every((p) => !p.isPublic), true);

  // -- Die Hintergruende ------------------------------------------------------
  //
  // In der Datei stehen `config` und `layers` getrennt, weil sich das von Hand
  // besser liest; rc fuehrt die Schichten INNEN in der Einstellung. Der Leser
  // fuegt sie zusammen — geht das verloren, ist die Veranstaltung farblos, und
  // niemand kann sagen, warum.
  const withLayers = plan.pages
    .flatMap((page) => page.parts)
    .filter((part) => (part.configJson ?? '').includes('"layers"'));

  /*
   * Genau EIN Abschnitt traegt Hintergruende: der Titel. So steht es in der
   * Vorlage — die uebrigen dreizehn erben den Grund des Aussehens und tragen
   * keine eigenen Schichten.
   *
   * Diese Zahl stand hier erst auf vierzehn, weil ich sie geraten habe. Die
   * Pruefung hat es gefunden, und das ist genau ihr Zweck: eine geratene
   * Erwartung ist keine.
   */
  ok('Nur der Titel traegt Schichten', withLayers.length, 1);
  ok('Und zwar zwei', JSON.parse(withLayers[0].configJson ?? '{}').layers.length, 2);

  // -- Das Formular -----------------------------------------------------------
  //
  // Vierzehn Felder, die als eigene Zeilen entstehen. Sie sind der Teil, der am
  // leichtesten verschwindet: sie stehen NICHT in der Einstellung.
  const form = plan.pages[0].parts.find((p) => p.kind === 'form');

  ok('Das Formular ist da', form !== undefined, true);
  ok('Vierzehn Felder', form?.fields.length, 14);
  ok('Erstes Feld', form?.fields[0].label, 'Imię i nazwisko');

  /* `identityRole` sagt, woraus der Veranstalter Name und Kontakt liest. */
  ok('Name erkannt', form?.fields[0].identityRole, 'name');
  ok('Kontakt erkannt', form?.fields[1].identityRole, 'contact');

  ok('Auswahlfeld behaelt seine Antworten',
    form?.fields.find((f) => f.kind === 'select')?.options?.length, 7);

  ok('Pflichtfeld bleibt Pflicht', form?.fields[0].isRequired, true);
}

// -- Ergebnis -----------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n' + failures.join('\n\n') + '\n');
  throw new Error(`${passed} bestanden, ${failures.length} fehlgeschlagen`);
}

console.log(`${passed} bestanden, 0 fehlgeschlagen`);
