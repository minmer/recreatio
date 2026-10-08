/**
 * Die drei Bausteine, deren Inhalt WOANDERS liegt.
 *
 * <b>Sie haben immer etwas zu zeigen</b> — auch wenn in ihrem `config` nichts
 * als eine Überschrift steht. Ein Messplan trägt seinen Inhalt in
 * `app.calendar_item`, ein Formular seine Fragen als eigene Zeilen an seiner
 * Kennung. Bliebe für sie die Regel „leer heisst unsichtbar", fielen sie genau
 * dann aus der Seite, wenn sie richtig eingerichtet sind — und niemand käme
 * darauf, warum.
 *
 * Vorher hiess diese Ausnahme `live` und stand als Merkmal im Katalog, während
 * die Regel in der Zeichnung stand. Jetzt beantwortet jeder Baustein dieselbe
 * Frage, und diese drei antworten immer ja.
 *
 * <b>Sie stehen zusammen in einer Datei</b>, weil sie sich genau das teilen und
 * sonst nichts: jeder reicht seine Gestalt an ein Bauteil weiter, das es schon
 * gibt. Drei Dateien mit je acht Zeilen wären drei Wege zu derselben Zeile.
 */

import { definePart, maybeNumber, text, type RawConfig } from '../part';
import { FormCard } from '../FormCard';
import { MassCard } from '../MassCard';
import { massSays, massView } from '../massShape';
import { SlotCard } from '../SlotCard';

/* -- Messen und Intentionen ------------------------------------------------- */

interface MassConfig {
  readonly title: string;
  readonly calendar: string;

  /**
   * <b>`null` ist nicht 7.</b> Ohne Angabe richtet sich die Zahl nach dem, was
   * in die Kachel passt — eine Vorgabe daraus zu machen füllte jede flache
   * Kachel mit sieben Tagen, die sie nicht zeigen kann.
   */
  readonly days: number | null;
}

export const massesPart = definePart<MassConfig>({
  kind: 'masses',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { title: 'Porządek mszy', calendar: '<id-kalendarza>', days: '7' },
  label: 'Msze i nabożeństwa',
  use: 'Porządek mszy z kalendarza, z intencjami.',
  box: { colSpan: 3, rowSpan: 3 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Porządek mszy' },
    { key: 'calendar', label: 'Terminarz której grupy', kind: 'calendar' },
    { key: 'days', label: 'Ile dni pokazać', kind: 'line', hint: 'Puste: ile zmieści się w kafelku' }
  ],

  read: (raw: RawConfig): MassConfig => ({
    title: text(raw, 'title'),
    calendar: text(raw, 'calendar'),
    days: maybeNumber(raw, 'days')
  }),

  hasContent: () => true,

  /* Zwölf Grössen, zwölf Antworten — welche, steht in `massShape.ts`. */
  shows: (config, size) => massSays(massView(size, config.days)),
  fullscreen: true,

  View: ({ config, ctx }) => (
    <MassCard title={config.title} calendar={config.calendar} days={config.days} size={ctx.size} />
  )
});

/* -- Ein Formular ----------------------------------------------------------- */

interface FormConfig {
  readonly title: string;
  readonly portalUnder: string;
}

export const formPart = definePart<FormConfig>({
  kind: 'form',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: {
    title: 'Zapisy na pielgrzymkę',
    portalUnder: 'parafia/pielgrzymka',
    smsTemplates: JSON.stringify([{ label: 'Przypomnienie', text: 'Jutro wyjazd o 7:00 spod kościoła.' }]),
    sentTitle: 'Dziękujemy za zapisanie!',
    sentText: 'Zbiórka w sobotę o 7:00 przed kościołem.\n\nZabierz legitymację szkolną.',
    paper: 'minor',
    paperSigner: 'czytelny podpis rodzica / opiekuna prawnego',
    /* 0086 — der Zusatz zur Adresse nach dem Absenden, und die eingeschalteten Wymagania. */
    portalAt: '#twoje-zgloszenie',
    needs: JSON.stringify([{
      id: 'minor', label: 'Niepełnoletni potrzebują pisemnej zgody rodzica',
      fields: ['<id pytania>'], added: ['<id pytania>'], items: ['<id grupy>'], nodes: ['<id węzła>'], edges: ['<id krawędzi>'],
      paper: true
    }])
  },

  /* Was der Bogen trägt, ohne dass die Seite es zeigt — eingestellt wird es in seinem Reiter „Ustawienia". */
  extra: [
    { key: 'title', shape: 'line', says: 'Nagłówek nad formularzem' },
    {
      key: 'portalUnder', shape: 'line',
      says: 'Pod którą stroną powstaje portal osoby po zgłoszeniu — ścieżka, np. "parafia/pielgrzymka" (musi być tą stroną albo leżeć pod nią)'
    },
    {
      key: 'smsTemplates', shape: 'json', says: 'Szablony wiadomości do zgłoszonych — lista',
      inside: { '[].label': 'Nazwa szablonu', '[].text': 'Treść wiadomości' }
    },
    /* 0083 — was nach dem Absenden dasteht, und ob ein Ausdruck unterschrieben werden muss. */
    { key: 'sentTitle', shape: 'line', says: 'Nagłówek po wysłaniu (zamiast „Zgłoszenie przyjęte.”)' },
    { key: 'sentText', shape: 'line', says: 'Tekst po wysłaniu — "\\n" nowa linia, pusta linia nowy akapit' },
    {
      key: 'paper', shape: 'line',
      says: 'Podpis odręczny na wydruku: "always" (zawsze), "minor" (niepełnoletni — wg daty urodzenia albo PESEL w dniu wypełnienia) albo identyfikator pytania „Zgoda / oświadczenie” lub „Tak / nie” — wtedy, gdy zaznaczone (np. zgoda rodzica, którą widzą tylko niepełnoletni)'
    },
    { key: 'paperSigner', shape: 'line', says: 'Kto podpisuje — napis pod linią podpisu na wydruku' },
    {
      key: 'portalAt', shape: 'line',
      says: 'Dopisek do adresu strony po wysłaniu (portalUnder): "#nazwa-slajdu" (otwiera ten slajd), "?s=3" (trzeci slajd), "?part=<id modułu>" albo razem "?s=2#zapisy"; zaczyna się od "?" albo "#", bez spacji; klucz osoby link dopisuje sam'
    },
    {
      key: 'needs', shape: 'json',
      says: 'Włączone wymagania formularza (zakładka „Pytania”) — lista; ich pytań nie da się usunąć, dopóki wymaganie jest włączone (przesuwać można). Włącza się je i wyłącza w module — ręcznie wpisane identyfikatory tylko blokują usuwanie',
      inside: {
        '[].id': 'Które: "minor" (niepełnoletni potrzebują pisemnej zgody rodzica), "health" (zdrowie i dieta, pomoc w nagłym wypadku), "insurance" (ubezpieczenie NNW), "rules" (zasady, wizerunek, informacja o danych)',
        '[].label': 'Nazwa wymagania — tak stoi przy zablokowanym pytaniu',
        '[].fields': 'Identyfikatory wszystkich jego pytań (także tych, które już były w formularzu) — zablokowane przed usunięciem',
        '[].added': 'Identyfikatory pytań, które samo dodało — po wyłączeniu znikają (z odpowiedziami: tylko zdjęte z formularza)',
        '[].items': 'Identyfikatory jego grup i tekstów w układzie',
        '[].nodes': 'Identyfikatory jego węzłów logiki (zablokowane)',
        '[].edges': 'Identyfikatory jego połączeń logiki (zablokowane)',
        '[].paper': 'true — ustawiło wydruk do podpisu ("paper": "minor") i po wyłączeniu go zdejmie'
      }
    }
  ],
  label: 'Formularz',
  use: 'Pytania i zgłoszenia; każdy dostaje własny adres.',
  box: { colSpan: 3, rowSpan: 3 },
  takes: true,

  /*
   * KEINE FELDER AUF DER SEITE — und das ist die Aussage.
   *
   * Überschrift, Nachrichtenvorlage und Portal gehören dem BOGEN, nicht der
   * Stelle, an der er steht: wer denselben Bogen auf zwei Seiten legt, soll
   * nicht zwei Überschriften pflegen. Eingestellt wird er dort, wo er wohnt
   * — auf seiner eigenen Seite (`FormOffice`), die ihn ohnehin führt.
   *
   * Die Seite wählt nur noch, WELCHEN sie zeigt (`PickModule`).
   */
  fields: [],

  read: (raw: RawConfig): FormConfig => ({
    title: text(raw, 'title'),
    portalUnder: text(raw, 'portalUnder')
  }),

  hasContent: () => true,

  /* Ein halbes Formular gibt es nicht: im Streifen ein Knopf, sonst das ganze. */
  strip: { title: 'Formularz', open: 'Wypełnij formularz' },
  fullscreen: true,
  shows: (_config, size) => size.height === 'strip'
    ? 'Nagłówek i przycisk — formularz rozwija się po kliknięciu.'
    : 'Cały formularz.',

  View: ({ config, ctx }) => (
    <FormCard partId={ctx.moduleId} title={config.title} portalUnder={config.portalUnder} />
  )
});

/* -- Etwas für eine Zeit nehmen (0039) ------------------------------------ */

interface SlotConfig {
  readonly title: string;

  /**
   * Das Ding — ein Priester, ein Raum, ein Haus.
   *
   * <b>Einen Kalender statt des Dings gibt es nicht mehr.</b> Vor 0039 nahm
   * dieser Baustein eine Kalenderkennung; die einzigen zwei, die je gesetzt
   * wurden, trugen `con26/27/1` und nichts — keiner fand je einen Termin.
   * Einen Rückweg für Einstellungen zu halten, die nie funktioniert haben,
   * hieße, eine zweite Frage offen zu lassen, auf die es keine gute Antwort
   * gibt: welcher Zasób, wenn zwei denselben Kalender lesen?
   */
  readonly resource: string;
}

export const slotsPart = definePart<SlotConfig>({
  kind: 'slots',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { title: 'Wybierz termin spotkania', resource: '<id-zasobu>' },

  /*
   * EIN BAUSTEIN FÜR BEIDES. Ein Treffen mit dem Priester und ein Haus in
   * Hortus Dei sind dasselbe: jemand nimmt sich einen Teil von etwas
   * Begrenztem, für eine Zeit. Welcher Fall es ist, sagt das Ding — nicht
   * dieser Baustein.
   */
  label: 'Rezerwacja',
  use: 'Termin u księdza, sala, dom — ktoś zajmuje coś na czas.',
  box: { colSpan: 3, rowSpan: 3 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Wybierz termin spotkania' },
    { key: 'resource', label: 'Co można zarezerwować', kind: 'resource' }
  ],

  read: (raw: RawConfig): SlotConfig => ({
    title: text(raw, 'title'),
    resource: text(raw, 'resource')
  }),

  hasContent: () => true,

  /*
   * Im Streifen ein Knopf; sonst die Termine — breiter nebeneinander, damit
   * eine Woche Termine nicht zu einer Spalte wird, die man hinunterscrollt.
   */
  strip: { title: 'Rezerwacja', open: 'Wybierz termin' },
  fullscreen: true,
  shows: (_config, size) =>
    size.height === 'strip' ? 'Nagłówek i przycisk — terminy rozwijają się po kliknięciu.'
    : size.width === 'wide' ? 'Terminy w dwóch kolumnach.'
    : size.width === 'full' ? 'Terminy w trzech kolumnach.'
    : 'Terminy jeden pod drugim.',

  View: ({ config }) => <SlotCard title={config.title} resource={config.resource} />
});
