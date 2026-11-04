/**
 * 2026-11-04 — DIE SPRACHE DER NAUKA FOLGT DER BAZA: eine Baza auf Deutsch (LAAG) spricht Deutsch, eine auf Polnisch
 * (Bosko) Polnisch. Die Sprache steht in den Ustawienia (`language`); fehlt sie, wird sie aus den eigenen Worten der Baza
 * erkannt (Namen der Rodzaje und der Einträge). Übersetzt sind die Bildschirme des Lernens auf der Karte: Krajobraz,
 * seine Seitenleiste, die Ścieżka und das Ende einer Powtórka — der Rest der Anwendung bleibt polnisch.
 */

import type { CogitaLibrary } from './store';

export type Lang = 'pl' | 'de' | 'en';
export const LANGS: readonly Lang[] = ['pl', 'de', 'en'];
export const LANG_LABEL: Readonly<Record<Lang, string>> = { pl: 'polski', de: 'Deutsch', en: 'English' };

/** Welche Sprache ein Text spricht (grob, aus häufigen Wörtern und Buchstaben) — `null`: unklar. */
export function detectLang(texts: readonly string[]): Lang | null {
  let pl = 0;
  let de = 0;
  let en = 0;
  for (const raw of texts) {
    const t = ` ${raw.toLowerCase()} `;
    pl += (t.match(/[ąćęłńśźż]/g)?.length ?? 0) + (t.match(/\s(i|w|z|na|się|nie|jest|do|że|oraz|czy)\s/g)?.length ?? 0) * 2;
    de += (t.match(/[äöüß]/g)?.length ?? 0) + (t.match(/\s(der|die|das|und|ist|mit|für|ein|eine|nicht|von|zu|den|dem|einer|wird)\s/g)?.length ?? 0) * 2;
    en += (t.match(/\s(the|and|of|is|with|for|a|an|to|in|on|are)\s/g)?.length ?? 0) * 2;
  }
  const best = Math.max(pl, de, en);
  if (best < 3) return null;
  return best === de ? 'de' : best === en ? 'en' : 'pl';
}

/** Die Sprache einer Baza: aus den Ustawienia, sonst erkannt aus ihren Worten, sonst polnisch. */
const DETECTED = new WeakMap<object, { revision: number; lang: Lang }>();
export function baseLang(lib: CogitaLibrary): Lang {
  const set = lib.settings().language;
  if (set === 'pl' || set === 'de' || set === 'en') return set;
  const had = DETECTED.get(lib.store);
  if (had !== undefined && had.revision === lib.revision) return had.lang;
  const texts = [...lib.kinds.filter((k) => lib.isOwn(k.id)).map((k) => k.name), ...lib.entities().slice(0, 300).map((e) => lib.label(e))];
  const lang = detectLang(texts) ?? 'pl';
  DETECTED.set(lib.store, { revision: lib.revision, lang });
  return lang;
}

/** Polnische Mehrzahl (1, 2–4, 5+). */
const plPlural = (n: number, one: string, few: string, many: string): string => {
  if (n === 1) return one;
  const t = n % 10;
  const h = n % 100;
  return t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
};
const p3 = (lang: Lang, n: number, pl: readonly [string, string, string], de: readonly [string, string], en: readonly [string, string]): string =>
  `${n} ${lang === 'pl' ? plPlural(n, ...pl) : lang === 'de' ? (n === 1 ? de[0] : de[1]) : n === 1 ? en[0] : en[1]}`;

/** Die Worte der Lernbildschirme in einer Sprache. */
export function words(lang: Lang) {
  const L = <T>(pl: T, de: T, en: T): T => (lang === 'de' ? de : lang === 'en' ? en : pl);
  return {
    lang,
    locale: L('pl-PL', 'de-DE', 'en-GB'),
    steps: (n: number) => p3(lang, n, ['krok', 'kroki', 'kroków'], ['Schritt', 'Schritte'], ['step', 'steps']),
    cards: (n: number) => p3(lang, n, ['karta', 'karty', 'kart'], ['Karte', 'Karten'], ['card', 'cards']),
    questions: (n: number) => p3(lang, n, ['pytanie', 'pytania', 'pytań'], ['Frage', 'Fragen'], ['question', 'questions']),
    slides: (n: number) => p3(lang, n, ['slajd', 'slajdy', 'slajdów'], ['Folie', 'Folien'], ['slide', 'slides']),
    topics: (n: number) => p3(lang, n, ['temat', 'tematy', 'tematów'], ['Thema', 'Themen'], ['topic', 'topics']),
    parts: (n: number) => p3(lang, n, ['część', 'części', 'części'], ['Teil', 'Teile'], ['part', 'parts']),
    paths: (n: number) => p3(lang, n, ['ścieżka', 'ścieżki', 'ścieżek'], ['Weg', 'Wege'], ['road', 'roads']),
    /* Der Krajobraz */
    whole: L('Całość', 'Ganze Karte', 'Whole map'),
    whereAmI: L('Gdzie jesteś w krajobrazie', 'Wo du in der Landschaft bist', 'Where you are on the map'),
    ready: L('gotowe do nauki', 'bereit zum Lernen', 'ready to learn'),
    due: L('do powtórki', 'zu wiederholen', 'due for review'),
    known: L('umiem', 'kann ich', 'known'),
    behind: L('za górami', 'hinter den Bergen', 'further away'),
    away: (n: number) => L(`${p3(lang, n, ['krok', 'kroki', 'kroków'], ['Schritt', 'Schritte'], ['step', 'steps'])} dalej`, `${n} ${n === 1 ? 'Schritt' : 'Schritte'} entfernt`, `${n} ${n === 1 ? 'step' : 'steps'} away`),
    youKnow: L('umiesz', 'kannst du', 'you know it'),
    reviewFirstState: L('najpierw powtórka tego, co było wcześniej', 'erst wiederholen, was davor kommt', 'review what comes before first'),
    goal: L('Cel', 'Ziel', 'Goal'),
    goalNow: L('możesz zacząć od razu', 'du kannst gleich anfangen', 'you can start right away'),
    goalReached: L('osiągnięty', 'erreicht', 'reached'),
    goalMissing: (n: number) => L(`brakuje ${p3(lang, n, ['kroku', 'kroków', 'kroków'], ['Schritt', 'Schritte'], ['step', 'steps'])}`, `es fehlen ${n} ${n === 1 ? 'Schritt' : 'Schritte'}`, `${n} ${n === 1 ? 'step' : 'steps'} to go`),
    nextStep: L('następny krok', 'nächster Schritt', 'next step'),
    show: L('Pokaż', 'Zeigen', 'Show'),
    clearGoal: L('Usuń cel', 'Ziel entfernen', 'Clear goal'),
    setGoal: L('Ustaw jako cel', 'Als Ziel setzen', 'Set as goal'),
    goalSet: (name: string) => L(`Cel: ${name}`, `Ziel: ${name}`, `Goal: ${name}`),
    goalCleared: L('Cel usunięty', 'Ziel entfernt', 'Goal cleared'),
    goalDone: (name: string) => L(`Cel osiągnięty: ${name}. Gratulacje!`, `Ziel erreicht: ${name}. Glückwunsch!`, `Goal reached: ${name}. Well done!`),
    goalRoute: L('Droga do celu — krok po kroku', 'Weg zum Ziel — Schritt für Schritt', 'Route to the goal — step by step'),
    goalRouteNote: (n: number, m: number) => L(`${p3(lang, n, ['temat', 'tematy', 'tematów'], ['Thema', 'Themen'], ['topic', 'topics'])} do poznania, ${p3(lang, m, ['krok', 'kroki', 'kroków'], ['Schritt', 'Schritte'], ['step', 'steps'])} w górę`, `${n} ${n === 1 ? 'Thema' : 'Themen'} zu lernen, ${m} ${m === 1 ? 'Schritt' : 'Schritte'} hinauf`, `${n} ${n === 1 ? 'topic' : 'topics'} to learn, ${m} ${m === 1 ? 'step' : 'steps'} up`),
    nextToGoal: (name: string) => L(`Dalej do celu: ${name}`, `Weiter zum Ziel: ${name}`, `On to the goal: ${name}`),
    start: L('Zacznij', 'Beginnen', 'Start'),
    review: L('Powtórz', 'Wiederholen', 'Review'),
    reviewFirst: (n: number) => L(`Najpierw powtórz ${p3(lang, n, ['kartę', 'karty', 'kart'], ['Karte', 'Karten'], ['card', 'cards'])}`, `Erst ${n} ${n === 1 ? 'Karte' : 'Karten'} wiederholen`, `First review ${n} ${n === 1 ? 'card' : 'cards'}`),
    reviewFirstWhat: L('Najpierw powtórz — to, co było wcześniej', 'Erst wiederholen — was davor kommt', 'Review first — what comes before'),
    showPath: (n: number) => L(`Pokaż ścieżkę (${p3(lang, n, ['część', 'części', 'części'], ['Teil', 'Teile'], ['part', 'parts'])})`, `Weg zeigen (${n} ${n === 1 ? 'Teil' : 'Teile'})`, `Show the path (${n} ${n === 1 ? 'part' : 'parts'})`),
    openEntry: L('Otwórz wpis', 'Eintrag öffnen', 'Open entry'),
    enter: L('Wejdź', 'Hinein', 'Enter'),
    close: L('Zamknij', 'Schließen', 'Close'),
    unlocks: L('Co dalej — co to odblokuje', 'Was danach kommt — was das freischaltet', 'What comes next — what this unlocks'),
    inside: (n: number) => L(`W środku (${n})`, `Darin (${n})`, `Inside (${n})`),
    chooseField: L('Wybierz pole na mapie — tu pojawią się szczegóły.', 'Wähle ein Feld auf der Karte — hier stehen dann die Einzelheiten.', 'Choose a field on the map — its details appear here.'),
    canLearnNote: L('Uczyć się możesz, gdy ten widok wie, kto się uczy (zalogowanie, osoba strony albo ta przeglądarka).', 'Lernen kannst du, wenn diese Ansicht weiß, wer lernt (Anmeldung, Person der Seite oder dieser Browser).', 'You can learn once this view knows who is learning (sign-in, the page person or this browser).'),
    otherTopics: L('Inne tematy', 'Andere Themen', 'Other topics'),
    readyList: L('Gotowe do nauki teraz', 'Jetzt bereit zum Lernen', 'Ready to learn now'),
    rotate: L('Obróć mapę o 60°', 'Karte um 60° drehen', 'Rotate the map by 60°'),
    computing: L('liczenie…', 'Berechnung…', 'computing…'),
    wait: L('Liczenie krajobrazu…', 'Landschaft wird berechnet…', 'Computing the map…'),
    empty: L('W tym widoku nie ma wpisów z pytaniami — krajobraz pokazuje to, czego można się uczyć.', 'In dieser Ansicht gibt es keine Einträge mit Fragen — die Landschaft zeigt, was man lernen kann.', 'This view has no entries with questions — the map shows what can be learned.'),
    asList: (n: number) => L(`Krajobraz jako lista (${n} pól)`, `Landschaft als Liste (${n} Felder)`, `Map as a list (${n} fields)`),
    listBands: L(['Gotowe do nauki', 'Do powtórki', 'Za górami (tyle kroków brakuje)', 'Umiem'], ['Bereit zum Lernen', 'Zu wiederholen', 'Hinter den Bergen (so viele Schritte fehlen)', 'Kann ich'], ['Ready to learn', 'Due for review', 'Further away (steps missing)', 'Known']),
    legendColour: L('Kolor: im głębszy, tym lepiej znane — najjaśniejsze jest nowe', 'Farbe: je kräftiger, desto besser gekonnt — am hellsten ist Neues', 'Colour: the deeper, the better known — the palest is new'),
    legendHeight: L('Wysokość = ile kroków jeszcze: dolina — umiesz, jeden stopień — możesz się uczyć teraz, każdy kolejny krok o stopień wyżej', 'Höhe = wie viele Schritte noch: Tal — kannst du, eine Stufe — jetzt lernbar, jeder weitere Schritt eine Stufe höher', 'Height = how many steps to go: valley — known, one level — learnable now, each further step one level higher'),
    legendDue: L('do powtórki', 'zu wiederholen', 'due for review'),
    legendFirst: L('najpierw powtórka, potem dalej (to, co było wcześniej)', 'erst wiederholen, dann weiter (was davor kommt)', 'review first, then go on (what comes before)'),
    legendGoal: L('kroki drogi do celu (numery po dotknięciu)', 'Schritte des Weges zum Ziel (Nummern beim Antippen)', 'steps on the route to the goal (numbers on tap)'),
    legendSeeThrough: L('pole za wyższymi kolumnami — widoczne przez nie', 'Feld hinter höheren Säulen — durch sie hindurch sichtbar', 'field behind taller columns — shown through them'),
    /* Das Ende einer Powtórka */
    runDone: (n: number) => L(`Powtórka zakończona: ${p3(lang, n, ['karta', 'karty', 'kart'], ['Karte', 'Karten'], ['card', 'cards'])}, wszystkie na co najmniej 100 %`, `Wiederholung beendet: ${n} ${n === 1 ? 'Karte' : 'Karten'}, alle bei mindestens 100 %`, `Review finished: ${n} ${n === 1 ? 'card' : 'cards'}, all at 100 % or more`),
    runStopped: L('Koniec powtórki', 'Ende der Wiederholung', 'End of the review'),
    unlocked: L('Ta powtórka odblokowała', 'Diese Wiederholung hat freigeschaltet', 'This review unlocked'),
    nothingUnlocked: L('Nic nowego się nie otworzyło — ale wszystko, co było do powtórki, siedzi.', 'Nichts Neues ist frei geworden — aber alles Fällige sitzt.', 'Nothing new opened up — but everything that was due now sits.'),
    story: L('opowieść', 'Geschichte', 'story'),
    learnNow: (name: string) => L(`Ucz się: ${name}`, `Lernen: ${name}`, `Learn: ${name}`),
    nextTopic: (name: string) => L(`Następny temat: ${name}`, `Nächstes Thema: ${name}`, `Next topic: ${name}`),
    backToMap: L('Wróć do mapy', 'Zurück zur Karte', 'Back to the map'),
    keepPractising: L('Ćwicz dalej', 'Weiter üben', 'Keep practising'),
    back: L('Wróć', 'Zurück', 'Back'),
    nowOpening: (name: string) => L(`Teraz: ${name}…`, `Jetzt: ${name}…`, `Now: ${name}…`),
    /* Die Ścieżka */
    done: L('ukończone', 'erledigt', 'done'),
    open: L('otwarte — możesz zacząć', 'offen — du kannst beginnen', 'open — you can start'),
    locked: L('zamknięte — najpierw to, co niżej', 'gesperrt — erst das darunter', 'locked — first what is below'),
    now: L('teraz', 'jetzt', 'now'),
    finished: L('ukończono', 'erledigt', 'done'),
    zoomOut: L('Pomniejsz', 'Verkleinern', 'Zoom out'),
    zoomIn: L('Powiększ', 'Vergrößern', 'Zoom in'),
    fit: L('Dopasuj', 'Einpassen', 'Fit'),
    full: L('Pełny ekran', 'Vollbild', 'Full screen'),
    tapAgain: L('Dotknij jeszcze raz, aby otworzyć.', 'Noch einmal antippen zum Öffnen.', 'Tap again to open.'),
    firstNeeds: L('Najpierw', 'Zuerst', 'First'),
    pathTitle: L('Ścieżka', 'Weg', 'Path'),
    kinds: L(
      { start: 'początek', end: 'koniec', read: 'slajdy do przeczytania', learn: 'pytania do odpowiedzi', mixed: 'slajdy i pytania', review: 'przegląd — aż wszystko umiesz', fork: 'wybór drogi' },
      { start: 'Anfang', end: 'Ende', read: 'Folien zum Lesen', learn: 'Fragen zum Beantworten', mixed: 'Folien und Fragen', review: 'Durchsicht — bis alles sitzt', fork: 'Wahl des Weges' },
      { start: 'start', end: 'end', read: 'slides to read', learn: 'questions to answer', mixed: 'slides and questions', review: 'review — until all is known', fork: 'choice of road' }
    )
  };
}
export type Words = ReturnType<typeof words>;
