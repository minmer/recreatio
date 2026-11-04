/**
 * 2026-11-04 — DIE SPRACHE DER NAUKA FOLGT DER BAZA: eine Baza auf Deutsch (LAAG) spricht Deutsch, eine auf Polnisch
 * (Bosko) Polnisch. Die Sprache steht in den Ustawienia (`language`); fehlt sie, wird sie aus den eigenen Worten der Baza
 * erkannt (Namen der Rodzaje und der Einträge). Übersetzt sind die Bildschirme des Lernens auf der Karte: Krajobraz,
 * seine Seitenleiste, die Ścieżka und das Ende einer Powtórka — der Rest der Anwendung bleibt polnisch.
 */

import { forkWords, partWords, type PartKind, type PathFork } from './pathLayout';
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
    /* 2026-11-04 (Prompt 10) — wie viele Fragen noch, woher die Frage kommt und warum sie jetzt kommt */
    left: (n: number) => L(`Zostało ${p3(lang, n, ['pytanie', 'pytania', 'pytań'], ['Frage', 'Fragen'], ['question', 'questions'])}`, `Noch ${n} ${n === 1 ? 'Frage' : 'Fragen'}`, `${n} ${n === 1 ? 'question' : 'questions'} left`),
    topicIs: L('Temat', 'Thema', 'Topic'),
    storyIs: L('Opowieść', 'Geschichte', 'Story'),
    whyNew: L('nowe', 'neu', 'new'),
    whyDue: (pct: number) => L(`do powtórki (${pct} %)`, `zu wiederholen (${pct} %)`, `due for review (${pct} %)`),
    whyMissed: L('pomyłka przed chwilą', 'eben falsch beantwortet', 'just answered wrong'),
    whyForgotten: L('zapomniane', 'vergessen', 'forgotten'),
    whySpacer: L('przerywnik — coś, co już umiesz, zanim wróci tamto pytanie', 'Zwischenfrage — etwas, das du kannst, bevor die andere Frage wiederkommt', 'spacer — something you know before that question comes back'),
    whyAhead: L('ćwiczenie na zapas (już umiesz)', 'Üben auf Vorrat (kannst du schon)', 'practising ahead (you know it)'),
    whyKnown: (pct: number) => L(`umiesz (${pct} %)`, `kannst du (${pct} %)`, `known (${pct} %)`),
    lastAnswers: L('Ostatnie odpowiedzi', 'Letzte Antworten', 'Last answers'),
    dueAt: L('Następna powtórka', 'Nächste Wiederholung', 'Next review'),
    asked: (ask: number, all: number) => L(`${ask} z ${p3(lang, all, ['pytania', 'pytań', 'pytań'], ['Fragen', 'Fragen'], ['questions', 'questions'])} do odpowiedzi`, `${ask} von ${all} Fragen zu beantworten`, `${ask} of ${all} questions to answer`),
    allKnown: L('wszystkie pytania już umiesz — tylko do przeczytania', 'alle Fragen kannst du schon — nur zum Lesen', 'you know all its questions — reading only'),
    /** 2026-11-04 — was in einem Teil der Ścieżka wartet (`ask`: wie viele seiner Fragen wirklich gefragt werden). */
    part: (nd: { readonly kind?: PartKind; readonly slides?: number; readonly questions?: number }, ask?: number): string => {
      if (lang === 'pl') return partWords(nd, ask);
      const s = nd.slides ?? 0;
      const q = nd.questions ?? 0;
      const slides = s > 0 ? L('', `${s} ${s === 1 ? 'Folie' : 'Folien'} zum Lesen`, `${s} ${s === 1 ? 'slide' : 'slides'} to read`) : '';
      const qs = q === 0 ? '' : ask === undefined || ask >= q ? L('', `${q} ${q === 1 ? 'Frage' : 'Fragen'} zu beantworten`, `${q} ${q === 1 ? 'question' : 'questions'} to answer`)
        : ask === 0 ? L('', 'alle Fragen kannst du schon — nur zum Lesen', 'you know all its questions — reading only') : L('', `${ask} von ${q} Fragen zu beantworten`, `${ask} of ${q} questions to answer`);
      switch (nd.kind) {
        case 'start': return L('', 'Anfang des Weges', 'Start of the path');
        case 'end': return L('', 'Ende des Weges', 'End of the path');
        case 'fork': return L('', 'Hier wählst du den Weg', 'Here you choose the road');
        case 'review': {
          if (q > 0 && ask === 0) return L('', 'Durchsicht — alle Fragen kannst du schon', 'Review — you know all its questions');
          const n = ask === undefined || ask >= q ? `${q}` : L('', `${ask} von ${q}`, `${ask} of ${q}`);
          return L('', `Durchsicht${q > 0 ? `: ${n} ${q === 1 ? 'Frage' : 'Fragen'}` : ''} — bis alles sitzt`, `Review${q > 0 ? `: ${n} ${q === 1 ? 'question' : 'questions'}` : ''} — until all is known`);
        }
        default: return [slides, qs].filter(Boolean).join(' · ');
      }
    },
    /** Was eine Gabel zählt. */
    fork: (f: PathFork): string => (lang === 'pl' ? forkWords(f)
      : f.mode === 'choose' ? (f.done === 0 ? L('', `wähle 1 von ${f.total}`, `choose 1 of ${f.total}`) : L('', `gewählt ${f.done} von ${f.total}`, `chosen ${f.done} of ${f.total}`) + ((f.finished ?? 0) > 0 ? L('', ` · ${f.finished} erledigt`, ` · ${f.finished} done`) : ''))
      : L('', `${f.done} von ${f.total} Wegen erledigt`, `${f.done} of ${f.total} roads done`)),
    forkAll: L(' — wszystkie, w dowolnej kolejności', ' — alle, in beliebiger Reihenfolge', ' — all of them, in any order'),
    forkOne: L(' — wybierasz jedną drogę', ' — du wählst einen Weg', ' — you choose one road'),
    dueMark: L('do powtórki', 'zu wiederholen', 'due for review'),
    /* 2026-11-04 (Prompt 11) — die Ścieżka: was der Zähler zählt, automatische Teile, Wege zurück, was danach kommt */
    summary: (done: number, total: number, noun: 'parts' | 'topics' = 'parts'): string => (noun === 'topics'
      ? L(`ukończono ${done} z ${p3(lang, total, ['tematu', 'tematów', 'tematów'], ['Thema', 'Themen'], ['topic', 'topics'])}`, `${done} von ${total} ${total === 1 ? 'Thema' : 'Themen'} erledigt`, `${done} of ${total} ${total === 1 ? 'topic' : 'topics'} done`)
      : L(`ukończono ${done} z ${total}`, `${done} von ${total} erledigt`, `${done} of ${total} done`)),
    pathAria: (summary: string, now: string | null): string => L(`Ścieżka: ${summary}${now === null ? '' : `, teraz: ${now}`}`, `Weg: ${summary}${now === null ? '' : `, jetzt: ${now}`}`, `Path: ${summary}${now === null ? '' : `, now: ${now}`}`),
    partNames: {
      start: L('Początek', 'Anfang', 'Start'), end: L('Koniec', 'Ende', 'End'), review: L('Przegląd', 'Durchsicht', 'Review'), choice: L('Wybór', 'Wahl', 'Choice'),
      chapters: L('Rozdziały', 'Kapitel', 'Chapters'), questions: L('Pytania', 'Fragen', 'Questions'),
      questionsOf: (x: string) => L(`Pytania — ${x}`, `Fragen — ${x}`, `Questions — ${x}`), choiceOn: (x: string) => L(`Wybór: ${x}`, `Wahl: ${x}`, `Choice: ${x}`),
      step: (type: string): string | undefined => ({
        show: L('Slajd', 'Folie', 'Slide'), question: L('Pytanie', 'Frage', 'Question'), line: L('Postać mówi', 'Eine Figur spricht', 'A character speaks'),
        subflow: L('Inna opowieść', 'Andere Geschichte', 'Another story'), each: L('Dla każdego', 'Für jeden', 'For each'), expand: L('Wyjaśnienie', 'Erklärung', 'Explanation'),
        opening: L('Otwarcie', 'Einstieg', 'Opening'), scene: L('Scena', 'Szene', 'Scene')
      } as Record<string, string>)[type]
    },
    autoKind: L('automatycznie — aplikacja wybiera', 'automatisch — die App wählt', 'automatic — the app picks'),
    autoWhy: L('Ten krok wybiera aplikacja sama, według tego, co już umiesz — to nie jest twój wybór.', 'Diesen Schritt wählt die App selbst, nach dem, was du schon kannst — das ist keine Wahl für dich.', 'The app picks this step itself, by what you already know — it is not your choice.'),
    autoOneOf: (a: string, b: string): string => (a !== '' && b !== '' ? L(`Jedno z dwojga: ${a} albo ${b}.`, `Eins von beiden: ${a} oder ${b}.`, `One of the two: ${a} or ${b}.`)
      : L(`${a || b} — albo nic, jeśli już to umiesz.`, `${a || b} — oder nichts, wenn du es schon kannst.`, `${a || b} — or nothing if you already know it.`)),
    loopKind: L('droga wraca do wyboru', 'Weg zurück zur Wahl', 'road back to the choice'),
    loopWhy: L('Ta droga wraca potem do wyboru — możesz wybrać jeszcze raz.', 'Dieser Weg führt danach zurück zur Wahl — du kannst noch einmal wählen.', 'This road leads back to the choice — you can choose again.'),
    optionalKind: L('droga niewybrana', 'nicht gewählter Weg', 'road not taken'),
    optionalWhy: L('Tej drogi nie wybrano — nie liczy się do ukończenia.', 'Dieser Weg wurde nicht gewählt — er zählt nicht.', 'This road was not taken — it does not count.'),
    legend: L('Legenda', 'Legende', 'Legend'),
    whatNext: L('Co dalej', 'Wie es weitergeht', 'What comes next'),
    nearest: L('Najbliższe pole na mapie', 'Nächstes Feld auf der Karte', 'Nearest field on the map'),
    nextReady: L('możesz zacząć teraz', 'du kannst jetzt beginnen', 'you can start now'),
    nextNotYet: L('jeszcze nie teraz', 'noch nicht', 'not yet'),
    needsFirst: (names: string): string => L(`Najpierw poznaj: ${names}`, `Zuerst lernen: ${names}`, `Learn first: ${names}`),
    dueFirst: (names: string): string => L(`Najpierw powtórz: ${names}`, `Zuerst wiederholen: ${names}`, `Review first: ${names}`),
    startStory: L('Zacznij opowieść', 'Geschichte beginnen', 'Start the story'),
    learn: L('Ucz się', 'Lernen', 'Learn'),
    nextGo: (name: string): string => L(`Dalej: ${name}`, `Weiter: ${name}`, `Next: ${name}`),
    workShort: (slides: number, questions: number): string => [slides > 0 ? p3(lang, slides, ['slajd', 'slajdy', 'slajdów'], ['Folie', 'Folien'], ['slide', 'slides']) : '', questions > 0 ? p3(lang, questions, ['pytanie', 'pytania', 'pytań'], ['Frage', 'Fragen'], ['question', 'questions']) : ''].filter(Boolean).join(' · '),
    inStory: (name: string): string => L(`w opowieści: ${name}`, `in der Geschichte: ${name}`, `in the story: ${name}`),
    returned: (inner: string, outer: string): string => L(`Ukończono „${inner}" — dalej: „${outer}".`, `„${inner}" erledigt — weiter mit „${outer}".`, `“${inner}” done — back to “${outer}”.`),
    storyEnd: L('Koniec', 'Ende', 'End'),
    reviewNotPassed: L('Opowieść ukończona — przegląd jeszcze niezdany.', 'Geschichte beendet — die Durchsicht ist noch nicht bestanden.', 'Story finished — the review is not passed yet.'),
    reviewPassed: L('Przegląd zdany — opowieść zaliczona.', 'Durchsicht bestanden — Geschichte geschafft.', 'Review passed — story complete.'),
    reviewAgain: L('Powtórz przegląd', 'Durchsicht wiederholen', 'Repeat the review'),
    fromStart: L('Od początku', 'Von vorn', 'From the start'),
    /* 2026-11-04 (Prompt 13) — das einzige, was „ukończona" und erreichte Ziele wegnimmt */
    forgetStory: L('Zapomnij postęp', 'Fortschritt vergessen', 'Forget progress'),
    forgetAsk: (name: string) => L(`Zapomnieć cały postęp w opowieści „${name}”? Ukończenie i osiągnięte cele znikną (odpowiedzi na pytania zostają).`, `Den ganzen Fortschritt in „${name}“ vergessen? Abschluss und erreichte Ziele verschwinden (die Antworten bleiben).`, `Forget all progress in “${name}”? Completion and reached goals are removed (answers stay).`),
    learnWithBasics: L('Ucz się z podstawami', 'Mit den Grundlagen lernen', 'Learn with the basics'),
    goOn: L('Dalej', 'Weiter', 'Next'),
    storyButton: {
      new: L('Zacznij opowieść', 'Geschichte beginnen', 'Start the story'), started: L('Kontynuuj opowieść', 'Geschichte fortsetzen', 'Continue the story'),
      review: L('Powtórz przegląd', 'Durchsicht wiederholen', 'Repeat the review'), passed: L('Otwórz opowieść', 'Geschichte öffnen', 'Open the story')
    },
    widen: L('Szerzej', 'Breiter', 'Wider'),
    narrow: L('Węziej', 'Schmaler', 'Narrower'),
    chooseRoad: (n: number): string => L(n === 1 ? 'Wybierz drogę (jedna możliwość):' : `Wybierz drogę (1 z ${n}):`, n === 1 ? 'Wähle den Weg (eine Möglichkeit):' : `Wähle den Weg (1 von ${n}):`, n === 1 ? 'Choose the road (one option):' : `Choose the road (1 of ${n}):`),
    kinds: L(
      { start: 'początek', end: 'koniec', read: 'slajdy do przeczytania', learn: 'pytania do odpowiedzi', mixed: 'slajdy i pytania', review: 'przegląd — aż wszystko umiesz', fork: 'wybór drogi' },
      { start: 'Anfang', end: 'Ende', read: 'Folien zum Lesen', learn: 'Fragen zum Beantworten', mixed: 'Folien und Fragen', review: 'Durchsicht — bis alles sitzt', fork: 'Wahl des Weges' },
      { start: 'start', end: 'end', read: 'slides to read', learn: 'questions to answer', mixed: 'slides and questions', review: 'review — until all is known', fork: 'choice of road' }
    )
  };
}
export type Words = ReturnType<typeof words>;
