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
        case 'detour': return L('', 'Abstecher in eine andere Geschichte — hinein oder weiter', 'A detour into another story — enter or go on');
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
        subflow: L('Inna opowieść', 'Andere Geschichte', 'Another story'), detour: L('Zagłębienie', 'Abstecher', 'Detour'), each: L('Dla każdego', 'Für jeden', 'For each'), expand: L('Wyjaśnienie', 'Erklärung', 'Explanation'),
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
    /* 2026-11-04 (Prompt 13) — Abstecher in eine andere Erzählung */
    detourAsk: (name: string): string => L(`Chcesz wiedzieć więcej? → ${name}`, `Mehr wissen? → ${name}`, `Want to know more? → ${name}`),
    detourEnter: L('Wejdź', 'Hinein', 'Enter'),
    detourSkip: L('Dalej bez tego', 'Weiter ohne', 'Go on without it'),
    detourKnown: L('już znasz', 'kennst du schon', 'you know it already'),
    detourRemind: L('Przypomnij', 'Auffrischen', 'Refresh'),
    detourStarted: L('zaczęta — wejdziesz tam, gdzie skończyłeś', 'begonnen — du kommst dorthin, wo du warst', 'started — you go back to where you were'),
    detourRequired: L('Ta opowieść jest częścią drogi — bez niej nie skończysz tej.', 'Diese Geschichte gehört zum Weg — ohne sie endet diese nicht.', 'This story is part of the road — this one does not end without it.'),
    detourMissing: L('Tej opowieści tu nie ma.', 'Diese Geschichte gibt es hier nicht.', 'This story is not here.'),
    detourDeep: L('Tu już nie wejdziesz głębiej — zagłębienia mogą iść najwyżej 3 poziomy.', 'Tiefer geht es hier nicht — höchstens 3 Abstecher ineinander.', 'You cannot go deeper here — at most 3 detours inside each other.'),
    detourCycle: L('Ta opowieść już trwa wyżej — nie wejdziesz w nią drugi raz.', 'Diese Geschichte läuft schon weiter oben — kein zweites Mal hinein.', 'This story is already running above — you cannot enter it again.'),
    backTo: (name: string): string => L(`Wróć do: ${name}`, `Zurück zu: ${name}`, `Back to: ${name}`),
    insidePath: (name: string): string => L(`wewnątrz: ${name}`, `innerhalb von: ${name}`, `inside: ${name}`),
    crumbs: L('Gdzie jesteś', 'Wo du bist', 'Where you are'),
    detourSkipped: L('pominięte — liczy się jako przerobione', 'ausgelassen — zählt als erledigt', 'skipped — counts as done'),
    skippedKind: L('pominięte zagłębienie', 'ausgelassener Abstecher', 'skipped detour'),
    detourOpen: L('Otwórz', 'Öffnen', 'Open'),
    detourNote: L('zagłębienie z tej opowieści', 'Abstecher aus dieser Geschichte', 'a detour from this story'),
    storyFirst: (names: string): string => L(`Najpierw: ${names}`, `Zuerst: ${names}`, `First: ${names}`),
    requiredLeft: (names: string): string => L(`Do końca brakuje zagłębienia: ${names}`, `Bis zum Ende fehlt der Abstecher: ${names}`, `Still needed before the end: ${names}`),
    returned: (inner: string, outer: string): string => L(`Ukończono „${inner}" — dalej: „${outer}".`, `„${inner}" erledigt — weiter mit „${outer}".`, `“${inner}” done — back to “${outer}”.`),
    storyEnd: L('Koniec', 'Ende', 'End'),
    reviewNotPassed: L('Opowieść ukończona — przegląd jeszcze niezdany.', 'Geschichte beendet — die Durchsicht ist noch nicht bestanden.', 'Story finished — the review is not passed yet.'),
    reviewPassed: L('Przegląd zdany — opowieść zaliczona.', 'Durchsicht bestanden — Geschichte geschafft.', 'Review passed — story complete.'),
    reviewAgain: L('Powtórz przegląd', 'Durchsicht wiederholen', 'Repeat the review'),
    fromStart: L('Od początku', 'Von vorn', 'From the start'),
    /* 2026-11-04 (Prompt 13) — das einzige, was „ukończona" und erreichte Ziele wegnimmt */
    forgetStory: L('Zapomnij postęp', 'Fortschritt vergessen', 'Forget progress'),
    forgetAsk: (name: string) => L(`Zapomnieć postęp w opowieści „${name}”? Znikną: Twoje miejsce w tej opowieści, jej ukończenie i zdany przegląd. Odpowiedzi na pytania zostają.`, `Den Fortschritt in „${name}“ vergessen? Weg sind: deine Stelle in dieser Geschichte, ihr Abschluss und die bestandene Durchsicht. Die Antworten auf die Fragen bleiben.`, `Forget your progress in “${name}”? Removed: your place in this story, its completion and the passed review. Answers to the questions stay.`),
    /* 2026-11-05 (Prompt 18) — der Kopf des Spielers: zurück, „⋯", Fortschritt, Wstecz, wer erzählt. */
    stepBack: L('Wstecz', 'Zurück', 'Back'),
    moreTools: L('Więcej', 'Mehr', 'More'),
    progressOf: (done: number, all: number) => L(`${done} z ${all}`, `${done} von ${all}`, `${done} of ${all}`),
    reviewProgress: (done: number, all: number) => L(`Przegląd: ${done} z ${all}`, `Durchsicht: ${done} von ${all}`, `Review: ${done} of ${all}`),
    reviewPassedMark: L('Przegląd zdany ✓', 'Durchsicht bestanden ✓', 'Review passed ✓'),
    reviewOpenMark: L('Przegląd jeszcze niezdany', 'Durchsicht noch nicht bestanden', 'Review not passed yet'),
    pastStep: L('Już za Tobą — tylko do przejrzenia.', 'Schon erledigt — nur zum Ansehen.', 'Already done — for viewing only.'),
    chosenHere: L('wybrane', 'gewählt', 'chosen'),
    yourAnswer: L('Twoja odpowiedź', 'Deine Antwort', 'Your answer'),
    detourEntered: L('Wszedłeś tutaj.', 'Du bist hineingegangen.', 'You went in here.'),
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
      { start: 'początek', end: 'koniec', read: 'slajdy do przeczytania', learn: 'pytania do odpowiedzi', mixed: 'slajdy i pytania', review: 'przegląd — aż wszystko umiesz', fork: 'wybór drogi', detour: 'zagłębienie w inną opowieść' },
      { start: 'Anfang', end: 'Ende', read: 'Folien zum Lesen', learn: 'Fragen zum Beantworten', mixed: 'Folien und Fragen', review: 'Durchsicht — bis alles sitzt', fork: 'Wahl des Weges', detour: 'Abstecher in eine andere Geschichte' },
      { start: 'start', end: 'end', read: 'slides to read', learn: 'questions to answer', mixed: 'slides and questions', review: 'review — until all is known', fork: 'choice of road', detour: 'detour into another story' }
    )
  };
}
export type Words = ReturnType<typeof words>;

/**
 * 2026-11-04 (Prompt 15) — DIE WORTE DER ABSTÄNDE DER WIEDERHOLUNGEN (`spacing.ts`, `SpacingSettings.tsx`) — eigene
 * Liste, damit die der Lernbildschirme kurz bleibt.
 */
export function spacingWords(lang: Lang) {
  const L = <T>(pl: T, de: T, en: T): T => (lang === 'de' ? de : lang === 'en' ? en : pl);
  return {
    title: L('Odstępy powtórek', 'Abstände der Wiederholungen', 'Review spacing'),
    line: (name: string) => L(`Powtórki: ${name}`, `Wiederholungen: ${name}`, `Reviews: ${name}`),
    change: L('Zmień', 'Ändern', 'Change'),
    close: L('Zamknij', 'Schliessen', 'Close'),
    preset: L(
      { often: 'Częściej', standard: 'Standard', lighter: 'Lżej', once: 'Raz i gotowe' },
      { often: 'Öfter', standard: 'Standard', lighter: 'Leichter', once: 'Einmal und fertig' },
      { often: 'More often', standard: 'Standard', lighter: 'Lighter', once: 'Once and done' }
    ),
    presetSays: L(
      { often: 'Karta wraca już po 5 minutach, potem za każdym razem dwa razy później (×2).', standard: 'Karta wraca po kwadransie, potem coraz rzadziej (×3).', lighter: 'Dłuższe odstępy: najwcześniej po dniu, potem ×5.', once: 'Raz dobrze — i praktycznie nigdy więcej (rok, potem ×1000).' },
      { often: 'Die Karte kommt schon nach 5 Minuten wieder, dann jedes Mal doppelt so spät (×2).', standard: 'Die Karte kommt nach einer Viertelstunde wieder, dann immer seltener (×3).', lighter: 'Längere Abstände: frühestens nach einem Tag, dann ×5.', once: 'Einmal richtig — und praktisch nie wieder (ein Jahr, dann ×1000).' },
      { often: 'A card comes back after just 5 minutes, then each time twice as late (×2).', standard: 'A card comes back after a quarter of an hour, then ever less often (×3).', lighter: 'Longer gaps: a day at the earliest, then ×5.', once: 'Right once — and practically never again (a year, then ×1000).' }
    ),
    custom: L('własne', 'eigene', 'custom'),
    /* 2026-11-05 — die kurze Wahl im Baustein „Krajobraz" (`SpacingChoice`). */
    ask: L('Jak często pytać', 'Wie oft fragen', 'How often to ask'),
    other: L('Inne…', 'Andere…', 'Other…'),
    /* 2026-11-05 — der Stapel: wie viele Karten eine Wiederholung zugleich hat. */
    stackAsk: L('Ile kart naraz', 'Wie viele Karten auf einmal', 'Cards at once'),
    stackSays: (n: number) => L(`W powtórce krąży ${n} kart naraz: źle odpowiedziana wraca, dobrze odpowiedziana odchodzi — dopiero wtedy dochodzi jedna nowa.`, `In einer Wiederholung sind ${n} Karten zugleich im Umlauf: eine falsch beantwortete kommt wieder, eine richtig beantwortete geht — erst dann kommt eine neue dazu.`, `A review keeps ${n} cards in play: a wrong one comes back, a right one leaves — only then is one new card added.`),
    stackOther: L('Inna liczba', 'Andere Zahl', 'Other number'),
    stackAreaTitle: L('Ile kart naraz w powtórce', 'Wie viele Karten auf einmal in einer Wiederholung', 'Cards at once in a review'),
    stackMayChange: L('Uczący się mogą to zmienić dla siebie', 'Lernende dürfen es für sich ändern', 'Learners may change it for themselves'),
    stackAreaClear: L('Usuń ustawienie obszaru (domyślnie 20)', 'Einstellung des Bereichs entfernen (Vorgabe 20)', 'Remove the area setting (default 20)'),
    choiceSays: L('Dotyczy Twojej nauki z tej bazy — wszędzie, nie tylko tutaj.', 'Gilt für dein Lernen mit dieser Baza — überall, nicht nur hier.', 'Applies to your learning from this base — everywhere, not only here.'),
    advanced: L('Zaawansowane', 'Erweitert', 'Advanced'),
    first: L('Pierwszy odstęp', 'Erster Abstand', 'First interval'),
    firstSays: L('Po tylu czasie od dobrej odpowiedzi (także po złej, a potem dobrej) karta wraca najwcześniej.', 'So lange nach einer richtigen Antwort (auch nach falsch, dann richtig) kommt die Karte frühestens wieder.', 'How long after a correct answer (also after a wrong one followed by a correct one) the card comes back at the earliest.'),
    growth: L('Mnożnik wzrostu', 'Wachstumsfaktor', 'Growth factor'),
    growthSays: L('Tyle razy dłuższy staje się każdy kolejny odstęp po następnej dobrej odpowiedzi.', 'So viel länger wird jeder nächste Abstand nach einer weiteren richtigen Antwort.', 'How much longer each next interval becomes after another correct answer.'),
    unit: L(
      { minute: 'minut', hour: 'godzin', day: 'dni', week: 'tygodni', month: 'miesięcy', year: 'lat' },
      { minute: 'Minuten', hour: 'Stunden', day: 'Tage', week: 'Wochen', month: 'Monate', year: 'Jahre' },
      { minute: 'minutes', hour: 'hours', day: 'days', week: 'weeks', month: 'months', year: 'years' }
    ),
    unitOne: L(
      { minute: 'minuta', hour: 'godzina', day: 'dzień', week: 'tydzień', month: 'miesiąc', year: 'rok' },
      { minute: 'Minute', hour: 'Stunde', day: 'Tag', week: 'Woche', month: 'Monat', year: 'Jahr' },
      { minute: 'minute', hour: 'hour', day: 'day', week: 'week', month: 'month', year: 'year' }
    ),
    apply: L('Zastosuj', 'Übernehmen', 'Apply'),
    summary: (first: string, growth: number) => L(`pierwszy odstęp ${first}, potem ×${growth}`, `erster Abstand ${first}, dann ×${growth}`, `first interval ${first}, then ×${growth}`),
    fromArea: L('ustawione dla wszystkich w tym obszarze', 'für alle in diesem Bereich eingestellt', 'set for everyone in this area'),
    fromOwn: L('Twoje ustawienie', 'deine Einstellung', 'your setting'),
    fromDefault: L('domyślne', 'Vorgabe', 'default'),
    locked: L('Prowadzący ustalił odstępy dla wszystkich — nie można ich zmienić.', 'Die Leitung hat die Abstände für alle festgelegt — sie lassen sich nicht ändern.', 'The teacher has set the spacing for everyone — it cannot be changed.'),
    useArea: L('Wróć do ustawienia obszaru', 'Zurück zur Einstellung des Bereichs', 'Back to the area setting'),
    useDefault: L('Wróć do domyślnego', 'Zurück zur Vorgabe', 'Back to the default'),
    recompute: L('Zmiana liczy od nowa terminy wszystkich kart z dotychczasowych odpowiedzi — żadna odpowiedź nie ginie.', 'Eine Änderung rechnet die Termine aller Karten aus den bisherigen Antworten neu — keine Antwort geht verloren.', 'A change recomputes the due dates of all cards from the answers so far — no answer is lost.'),
    areaTitle: L('Odstępy powtórek dla uczących się', 'Abstände der Wiederholungen für die Lernenden', 'Review spacing for learners'),
    areaSays: L('Obowiązuje każdego, kto uczy się z tej bazy, chyba że ustawi własne (jeśli pozwolisz).', 'Gilt für alle, die mit dieser Baza lernen — ausser sie stellen eigene ein (wenn du es erlaubst).', 'Applies to everyone learning from this base unless they set their own (if you allow it).'),
    mayChange: L('Uczący się mogą to zmienić dla siebie', 'Lernende dürfen es für sich ändern', 'Learners may change it for themselves'),
    areaNone: L('Bez ustawienia — domyślne (Standard).', 'Ohne Einstellung — die Vorgabe (Standard).', 'No setting — the default (Standard).'),
    areaClear: L('Usuń ustawienie obszaru', 'Einstellung des Bereichs entfernen', 'Remove the area setting')
  };
}
export type SpacingWords = ReturnType<typeof spacingWords>;

/**
 * 2026-11-05 (Prompt 17) — DIE WORTE DER SEITE „ODZNAKI I POZIOMY" (`BadgesPage.tsx`) und ihres Eingangs in den Nagrody.
 * Die Namen der Stufen und Abzeichen sind Daten der Regel; die Ereignisse sagt auf Polnisch `eventText` (`rewards.ts`) —
 * hier (`event`) nur Deutsch und Englisch, auf Polnisch `null`.
 */
export function rewardWords(lang: Lang) {
  const L = <T>(pl: T, de: T, en: T): T => (lang === 'de' ? de : lang === 'en' ? en : pl);
  const locale = L('pl-PL', 'de-DE', 'en-GB');
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const num = (n: number): string => fmt.format(n);
  /* Eine Zahl mit ihrem Wort — auf Polnisch in drei Formen (1, 2–4, 5+). */
  const n3 = (n: number, pl: readonly [string, string, string], de: readonly [string, string], en: readonly [string, string]): string =>
    `${num(n)} ${lang === 'pl' ? plPlural(n, ...pl) : lang === 'de' ? (n === 1 ? de[0] : de[1]) : n === 1 ? en[0] : en[1]}`;
  const days = (n: number) => n3(n, ['dzień', 'dni', 'dni'], ['Tag', 'Tage'], ['day', 'days']);
  /** So viel von einem Mass, in Worten: „2 dni", „120 pkt", „3 utrwalone karty". */
  const amount = (m: string, n: number): string => {
    switch (m) {
      case 'points': return L(`${num(n)} pkt`, `${num(n)} ${n === 1 ? 'Punkt' : 'Punkte'}`, `${num(n)} ${n === 1 ? 'point' : 'points'}`);
      case 'streak': case 'best': return days(n);
      case 'days': return n3(n, ['dzień nauki', 'dni nauki', 'dni nauki'], ['Lerntag', 'Lerntage'], ['day of learning', 'days of learning']);
      case 'clean': return L(`${days(n)} bez zaległości`, `${days(n)} ohne Überfälliges`, `${days(n)} with nothing overdue`);
      case 'known': return n3(n, ['utrwalona karta', 'utrwalone karty', 'utrwalonych kart'], ['gefestigte Karte', 'gefestigte Karten'], ['retained card', 'retained cards']);
      case 'cards': return n3(n, ['karta', 'karty', 'kart'], ['Karte', 'Karten'], ['card', 'cards']);
      case 'answers': return n3(n, ['odpowiedź', 'odpowiedzi', 'odpowiedzi'], ['Antwort', 'Antworten'], ['answer', 'answers']);
      case 'correct': return n3(n, ['dobra odpowiedź', 'dobre odpowiedzi', 'dobrych odpowiedzi'], ['richtige Antwort', 'richtige Antworten'], ['correct answer', 'correct answers']);
      case 'combo': return n3(n, ['dobra z rzędu', 'dobre z rzędu', 'dobrych z rzędu'], ['richtige in Folge', 'richtige in Folge'], ['correct in a row', 'correct in a row']);
      case 'goals': return n3(n, ['dzień z celem', 'dni z celem', 'dni z celem'], ['Tag mit Tagesziel', 'Tage mit Tagesziel'], ['day with the daily goal', 'days with the daily goal']);
      case 'level': return n3(n, ['poziom', 'poziomy', 'poziomów'], ['Stufe', 'Stufen'], ['level', 'levels']);
      case 'regions': return n3(n, ['obszar', 'obszary', 'obszarów'], ['Gebiet', 'Gebiete'], ['region', 'regions']);
      case 'map': return L(`${num(n)} % mapy`, `${num(n)} % der Karte`, `${num(n)} % of the map`);
      default: return num(n);
    }
  };
  /** Wie man ein Abzeichen ohne eigene Beschreibung bekommt — aus Mass und Schwelle. */
  const says = (m: string, n: number): string => {
    switch (m) {
      case 'points': return L(`Zbierz ${num(n)} pkt.`, `Sammle ${num(n)} Punkte.`, `Collect ${num(n)} points.`);
      case 'streak': return L(`Seria: ${days(n)} z rzędu.`, `Eine Serie von ${days(n)}.`, `A streak of ${days(n)}.`);
      case 'best': return L(`Najdłuższa seria: ${days(n)}.`, `Längste Serie: ${days(n)}.`, `Longest streak: ${days(n)}.`);
      case 'cards': return L(`Odpowiedz na ${n3(n, ['kartę', 'karty', 'kart'], ['', ''], ['', ''])}.`, `Beantworte ${num(n)} ${n === 1 ? 'Karte' : 'Karten'}.`, `Answer ${num(n)} ${n === 1 ? 'card' : 'cards'}.`);
      case 'level': return L(`Dojdź do poziomu ${num(n)}.`, `Erreiche Stufe ${num(n)}.`, `Reach level ${num(n)}.`);
      case 'regions': return L(`Obszary mapy, które umiesz w całości: ${num(n)}.`, `Gebiete der Karte, die du ganz kannst: ${num(n)}.`, `Map regions you know completely: ${num(n)}.`);
      case 'map': return L(`Poznaj ${num(n)} % tematów mapy.`, `Lerne ${num(n)} % der Themen der Karte.`, `Learn ${num(n)} % of the map's topics.`);
      case 'clean': return L(`${days(n)} z rzędu bez zaległości.`, `${days(n)} in Folge ohne Überfälliges.`, `${days(n)} in a row with nothing overdue.`);
      default: return `${amount(m, n)}.`;
    }
  };
  return {
    lang,
    locale,
    num,
    amount,
    says,
    /** Was noch fehlt: „jeszcze 2 dni" — beim besten Lauf guter Antworten (combo) der Rekord und das Ziel. */
    left: (m: string, rest: number, value: number, goal: number): string => (m === 'combo'
      ? L(`rekord: ${num(value)} z rzędu, cel: ${num(goal)}`, `Rekord: ${num(value)} in Folge, Ziel: ${num(goal)}`, `best: ${num(value)} in a row, goal: ${num(goal)}`)
      : L(`jeszcze ${amount(m, rest)}`, `noch ${amount(m, rest)}`, `${amount(m, rest)} to go`)),
    title: L('Odznaki i poziomy', 'Abzeichen und Stufen', 'Badges and levels'),
    titleOf: (name: string) => L(`Odznaki i poziomy — ${name}`, `Abzeichen und Stufen — ${name}`, `Badges and levels — ${name}`),
    openSays: L('wszystkie odznaki, droga przez poziomy i cała historia nagród', 'alle Abzeichen, der Weg durch die Stufen und der ganze Verlauf', 'all badges, the path through the levels and the whole history'),
    back: L('‹ Nagrody', '‹ Belohnungen', '‹ Rewards'),
    counting: L('Liczenie punktów…', 'Punkte werden gezählt…', 'Counting points…'),
    nextGoals: L('Najbliższe cele', 'Nächste Ziele', 'Next goals'),
    allDone: L('Wszystko zdobyte — gratulacje!', 'Alles erreicht — Glückwunsch!', 'Everything achieved — well done!'),
    restOnMap: L('Pozostałe odznaki liczą się na krajobrazie.', 'Die übrigen Abzeichen zählt die Landschaft.', 'The remaining badges are counted on the landscape.'),
    levels: L('Poziomy', 'Stufen', 'Levels'),
    level: (n: number) => L(`Poziom ${n}`, `Stufe ${n}`, `Level ${n}`),
    levelNamed: (name: string) => L(`Poziom „${name}”`, `Stufe „${name}“`, `Level “${name}”`),
    from: (n: number) => L(`od ${num(n)} pkt`, `ab ${num(n)} Punkten`, `from ${num(n)} points`),
    reached: L('osiągnięty', 'erreicht', 'reached'),
    you: L('Twój poziom', 'deine Stufe', 'your level'),
    current: L('obecny poziom', 'jetzige Stufe', 'current level'),
    ahead: L('przed Tobą', 'noch vor dir', 'still ahead'),
    notYet: L('jeszcze nie', 'noch nicht', 'not yet'),
    beforeFirst: L('jeszcze przed pierwszym poziomem', 'noch vor der ersten Stufe', 'before the first level'),
    here: (pct: number, name: string) => L(`Jesteś tutaj: ${pct} % drogi do „${name}”`, `Du bist hier: ${pct} % des Weges zu „${name}“`, `You are here: ${pct} % of the way to “${name}”`),
    hereOther: (pct: number, name: string) => L(`Tutaj: ${pct} % drogi do „${name}”`, `Hier: ${pct} % des Weges zu „${name}“`, `Here: ${pct} % of the way to “${name}”`),
    toNext: (n: number, name: string) => L(`do „${name}”: jeszcze ${num(n)} pkt`, `bis „${name}“: noch ${num(n)} Punkte`, `to “${name}”: ${num(n)} points to go`),
    levelMeter: (name: string) => L(`Droga do poziomu „${name}”`, `Weg zur Stufe „${name}“`, `Way to the level “${name}”`),
    brings: (name: string, frame: string) => L(`Następny poziom daje tytuł „${name}” i ${frame}.`, `Die nächste Stufe bringt den Titel „${name}“ und ${frame}.`, `The next level brings the title “${name}” and ${frame}.`),
    top: L('Najwyższy poziom — dalej już tylko punkty.', 'Die höchste Stufe — weiter geht es nur mit Punkten.', 'The top level — from here on it is just points.'),
    noLevels: L('Te zasady nie mają poziomów.', 'Diese Regeln haben keine Stufen.', 'These rules have no levels.'),
    /** Die Rahmen der Stufen (`levelFrame`): als Name und als das, was eine Stufe bringt. 2026-11-05 (Odznaki): die erste aus Holz. */
    frame: L(['drewniana ramka', 'brązowa ramka', 'srebrna ramka', 'złota ramka', 'diamentowa ramka'], ['Holzrahmen', 'Bronzerahmen', 'Silberrahmen', 'Goldrahmen', 'Diamantrahmen'], ['wooden frame', 'bronze frame', 'silver frame', 'gold frame', 'diamond frame']),
    frameGives: L(['drewnianą ramkę', 'brązową ramkę', 'srebrną ramkę', 'złotą ramkę', 'diamentową ramkę'], ['einen Holzrahmen', 'einen Bronzerahmen', 'einen Silberrahmen', 'einen Goldrahmen', 'einen Diamantrahmen'], ['a wooden frame', 'a bronze frame', 'a silver frame', 'a gold frame', 'a diamond frame']),
    /** 2026-11-05 (Odznaki) — die Stoffe der Stufen (`BADGE_MATERIALS`): Name, und „do srebra" (Polnisch im Genitiv). */
    material: L(['Drewno', 'Brąz', 'Srebro', 'Złoto', 'Diament'], ['Holz', 'Bronze', 'Silber', 'Gold', 'Diamant'], ['Wood', 'Bronze', 'Silver', 'Gold', 'Diamond']),
    toMaterial: (m: number, left: string) => L(
      `do ${['drewna', 'brązu', 'srebra', 'złota', 'diamentu'][m] ?? ''}: ${left}`,
      `bis ${['Holz', 'Bronze', 'Silber', 'Gold', 'Diamant'][m] ?? ''}: ${left}`,
      `to ${['wood', 'bronze', 'silver', 'gold', 'diamond'][m] ?? ''}: ${left}`
    ),
    noMaterial: L('jeszcze bez stopnia', 'noch keine Stufe', 'no tier yet'),
    /** Beim besten Lauf guter Antworten zählt der Rekord (nicht „noch N"): „rekord 6 z 10". */
    comboLeft: (value: number, goal: number) => L(`rekord ${num(value)} z ${num(goal)}`, `Rekord ${num(value)} von ${num(goal)}`, `best ${num(value)} of ${num(goal)}`),
    onMapShort: L('liczy krajobraz — otwórz go', 'zählt die Landschaft — öffne sie', 'counted on the landscape — open it'),
    onMapShortOther: L('liczy krajobraz uczącego się', 'zählt die Landschaft der Person', "counted on the learner's landscape"),
    closest: L('najbliżej', 'am nächsten', 'closest'),
    categories: L('Kategorie', 'Kategorien', 'Categories'),
    /** Die Kachel einer Kategorie: was ein Antippen tut (für Vorleser; sichtbar steht die Kategorie selbst). */
    showSteps: (name: string) => L(`${name}: pokaż stopnie`, `${name}: Stufen zeigen`, `${name}: show the tiers`),
    stepsOf: (k: number, n: number) => L(`${k} z ${n}`, `${k} von ${n}`, `${k} of ${n}`),
    later: L('później', 'später', 'later'),
    levelOf: (i: number, n: number) => L(`poziom ${i} z ${n}`, `Stufe ${i} von ${n}`, `level ${i} of ${n}`),
    allLevels: L('Wszystkie poziomy', 'Alle Stufen', 'All levels'),
    historyDays: (n: number) => L(`${n} ${plPlural(n, 'dzień', 'dni', 'dni')}`, `${n} ${n === 1 ? 'Tag' : 'Tage'}`, `${n} ${n === 1 ? 'day' : 'days'}`),
    /* Der Editor: der Stoff einer Stufe */
    editorTier: L('Stopień', 'Stufe', 'Tier'),
    editorTierAuto: (m: string) => L(`sam: ${m}`, `automatisch: ${m}`, `automatic: ${m}`),
    badges: L('Odznaki', 'Abzeichen', 'Badges'),
    badgesOf: (k: number, n: number) => L(`${k} z ${n} zdobytych`, `${k} von ${n} erhalten`, `${k} of ${n} earned`),
    noBadges: L('Te zasady nie mają odznak.', 'Diese Regeln haben keine Abzeichen.', 'These rules have no badges.'),
    /** Die Arten der Abzeichen (`BADGE_KINDS`) — 2026-11-05 (Odznaki): die Kategorien, kurz (sie stehen auf Kacheln). */
    kinds: L(
      { start: 'Pierwsze kroki', consistency: 'Seria', accuracy: 'Celność', volume: 'Wiedza', goals: 'Cele', exploration: 'Mapa' },
      { start: 'Erste Schritte', consistency: 'Serie', accuracy: 'Treffsicherheit', volume: 'Wissen', goals: 'Ziele', exploration: 'Erkundung' },
      { start: 'First steps', consistency: 'Streak', accuracy: 'Accuracy', volume: 'Knowledge', goals: 'Goals', exploration: 'Map' }
    ),
    /** Die Masse als Überschrift einer Reihe von Stufen eines Abzeichens. */
    measure: L<Readonly<Record<string, string>>>(
      { points: 'Punkty', streak: 'Seria dni', best: 'Najdłuższa seria', known: 'Utrwalone karty', cards: 'Różne karty', answers: 'Odpowiedzi', correct: 'Dobre odpowiedzi', days: 'Dni nauki', combo: 'Dobre z rzędu', goals: 'Dni z celem', level: 'Poziom', regions: 'Zdobyte obszary mapy', map: 'Poznana mapa', clean: 'Dni bez zaległości' },
      { points: 'Punkte', streak: 'Serie', best: 'Längste Serie', known: 'Gefestigte Karten', cards: 'Verschiedene Karten', answers: 'Antworten', correct: 'Richtige Antworten', days: 'Lerntage', combo: 'Richtige in Folge', goals: 'Tage mit Tagesziel', level: 'Stufe', regions: 'Eroberte Gebiete', map: 'Gelernte Karte', clean: 'Tage ohne Überfälliges' },
      { points: 'Points', streak: 'Streak', best: 'Longest streak', known: 'Retained cards', cards: 'Different cards', answers: 'Answers', correct: 'Correct answers', days: 'Days of learning', combo: 'Correct in a row', goals: 'Days with the daily goal', level: 'Level', regions: 'Regions conquered', map: 'Map learned', clean: 'Days with nothing overdue' }
    ),
    tiers: (k: number, n: number) => L(`${k} z ${n} stopni`, `${k} von ${n} erreicht`, `${k} of ${n} tiers`),
    allTiers: L('wszystkie stopnie zdobyte', 'alle Stufen erhalten', 'all tiers earned'),
    earned: (date: string) => L(`zdobyta ${date}`, `erhalten am ${date}`, `earned on ${date}`),
    notStarted: L('jeszcze nie zaczęta', 'noch nicht begonnen', 'not started yet'),
    onMap: L('Liczy się na krajobrazie — otwórz krajobraz tej bazy, a odznaka pojawi się tutaj.', 'Wird in der Landschaft gezählt — öffne die Landschaft dieser Baza, dann erscheint das Abzeichen hier.', "Counted on the landscape — open this base's landscape and the badge shows up here."),
    onMapOther: L('Liczy się na krajobrazie uczącego się — widać ją tutaj, gdy ją zdobędzie.', 'Wird in der Landschaft der lernenden Person gezählt — sichtbar, sobald sie es erhält.', "Counted on the learner's landscape — shown here once earned."),
    bonus: (n: number) => L(`+${num(n)} pkt`, `+${num(n)} Punkte`, `+${num(n)} points`),
    meter: (name: string) => L(`Postęp: ${name}`, `Fortschritt: ${name}`, `Progress: ${name}`),
    history: L('Historia nagród', 'Verlauf der Belohnungen', 'Reward history'),
    day: L('Dzień', 'Tag', 'Day'),
    allDays: (n: number) => L(`Wszystkie dni (${n})`, `Alle Tage (${n})`, `All days (${n})`),
    dayTotal: (n: number) => L(`razem +${num(n)} pkt`, `zusammen +${num(n)} Punkte`, `total +${num(n)} points`),
    noHistory: L('Jeszcze nic — pierwsza odpowiedź przyniesie punkty.', 'Noch nichts — die erste Antwort bringt Punkte.', 'Nothing yet — the first answer brings points.'),
    more: (n: number) => L(`Pokaż więcej (jeszcze ${n})`, `Mehr zeigen (noch ${n})`, `Show more (${n} more)`),
    /** Ein Ereignis in Worten auf Deutsch und Englisch — auf Polnisch `null` (dann `eventText`). `name`: der Stufe, des Abzeichens. */
    event: (kind: string, value: number | undefined, name: string, every: number): string | null => {
      if (lang === 'pl') return null;
      const de = lang === 'de';
      switch (kind) {
        case 'answer': return (value ?? 0) >= 0.9 ? (de ? 'richtige Antwort' : 'correct answer') : (value ?? 0) >= 0.25 ? (de ? 'teilweise richtig' : 'partly correct') : (de ? 'für den Versuch' : 'for trying');
        case 'first': return de ? 'neue Karte' : 'new card';
        case 'fast': return de ? 'schnell!' : 'fast!';
        case 'combo': return de ? `${value ?? every} richtige in Folge` : `${value ?? every} correct in a row`;
        case 'known': return de ? 'gefestigte Karte' : 'retained card';
        case 'goal': return de ? 'Tagesziel erreicht' : 'daily goal reached';
        case 'streak': return value === 1 ? (de ? 'erster Tag der Serie' : 'first day of the streak') : de ? `Serie: ${value ?? 0}. Tag in Folge` : `streak: day ${value ?? 0} in a row`;
        case 'level': return de ? `neue Stufe: ${name}` : `new level: ${name}`;
        case 'badge': return de ? `Abzeichen: ${name}` : `badge: ${name}`;
        default: return null;
      }
    },
    /* Der Editor der Regel (`RewardsEditor.tsx`) */
    editorKind: L('Rodzaj', 'Art', 'Kind'),
    editorKindAuto: (kind: string) => L(`samo: ${kind}`, `automatisch: ${kind}`, `automatic: ${kind}`),
    editorMapNote: L('Tę miarę liczy krajobraz: odznaka przychodzi, gdy uczący się go otworzy, a data jej zdobycia zostaje zapisana.', 'Dieses Mass zählt die Landschaft: das Abzeichen kommt, wenn die lernende Person sie öffnet, und sein Datum wird gespeichert.', 'The landscape counts this measure: the badge comes when the learner opens it, and the date is saved.')
  };
}
export type RewardWords = ReturnType<typeof rewardWords>;
