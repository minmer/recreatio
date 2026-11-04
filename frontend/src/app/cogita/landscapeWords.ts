/**
 * 2026-11-04 (Prompt 11) — DIE WORTE DES KRAJOBRAZ DER GEBIETE (zu `lang.ts`: dieselben drei Sprachen, die Baza sagt
 * welche). Zwei Zahlen, überall mit denselben Worten:
 * <code>
 *   Stufen   die längste Kette noch fehlender Themen bis hierher, dieses mit — so hoch steht das Feld (Tal 0, jetzt
 *            lernbar 1); ein Gebiet: so viele Stufen, bis darin etwas beginnen kann
 *   Themen   wie viele Themen bis hierher noch zu lernen sind, dieses mit — so lang ist die Liste Schritt für Schritt
 * </code>
 */

import type { Lang } from './lang';

const plPlural = (n: number, one: string, few: string, many: string): string => {
  if (n === 1) return one;
  const t = n % 10;
  const h = n % 100;
  return t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
};
const count = (lang: Lang, n: number, pl: readonly [string, string, string], de: readonly [string, string], en: readonly [string, string]): string =>
  `${n} ${lang === 'pl' ? plPlural(n, ...pl) : lang === 'de' ? (n === 1 ? de[0] : de[1]) : n === 1 ? en[0] : en[1]}`;

export function landscapeWords(lang: Lang) {
  const L = <T>(pl: T, de: T, en: T): T => (lang === 'de' ? de : lang === 'en' ? en : pl);
  const stufen = (n: number) => count(lang, n, ['stopień', 'stopnie', 'stopni'], ['Stufe', 'Stufen'], ['level', 'levels']);
  const themen = (n: number) => count(lang, n, ['temat', 'tematy', 'tematów'], ['Thema', 'Themen'], ['topic', 'topics']);
  const gebiete = (n: number) => count(lang, n, ['obszar', 'obszary', 'obszarów'], ['Gebiet', 'Gebiete'], ['region', 'regions']);
  return {
    stufen,
    themen,
    gebiete,
    /** „6 Stufen · 10 Themen" — die beiden Zahlen eines Feldes. */
    numbers: (s: number, t: number) => `${stufen(s)} · ${themen(t)}`,
    toGoal: (n: number) => L(`${themen(n)} do celu`, `${themen(n)} bis zum Ziel`, `${themen(n)} to the goal`),
    toHere: (n: number) => L(`${themen(n)} do tego miejsca`, `${themen(n)} bis hierher`, `${themen(n)} to get here`),
    inRegion: (n: number) => L(`${themen(n)} w tym obszarze`, `${themen(n)} in diesem Gebiet`, `${themen(n)} in this region`),
    inSection: (n: number) => L(`${themen(n)} w tym rozdziale`, `${themen(n)} in diesem Abschnitt`, `${themen(n)} in this section`),
    openOf: (open: number, all: number) => L(`${open} z ${all} jeszcze do nauki`, `${open} von ${all} noch zu lernen`, `${open} of ${all} still to learn`),
    more: (n: number) => L(`+${n} kolejnych`, `+${n} weitere`, `+${n} more`),
    region: L('obszar', 'Gebiet', 'region'),
    topic: L('temat', 'Thema', 'topic'),
    regionOf: (n: number) => L(`Obszar · ${themen(n)}`, `Gebiet · ${themen(n)}`, `Region · ${themen(n)}`),
    /* Der eine Satz über der Karte (8e) */
    nextIs: L('Dalej', 'Als Nächstes', 'Next'),
    nextReady: L('gotowe', 'bereit', 'ready'),
    nextFirst: L('najpierw powtórka', 'erst wiederholen', 'review first'),
    nextAway: (n: number) => L(`${stufen(n)} dalej`, `${stufen(n)} entfernt`, `${stufen(n)} away`),
    dueCards: (n: number) => L(`${count(lang, n, ['karta', 'karty', 'kart'], ['Karte', 'Karten'], ['card', 'cards'])} do powtórki`, `${count(lang, n, ['karta', 'karty', 'kart'], ['Karte', 'Karten'], ['card', 'cards'])} zu wiederholen`, `${count(lang, n, ['karta', 'karty', 'kart'], ['Karte', 'Karten'], ['card', 'cards'])} to review`),
    nothingNext: L('Wszystko tu umiesz.', 'Hier kannst du alles.', 'You know everything here.'),
    goIn: L('Wejdź', 'Hinein', 'Go in'),
    learnIt: (name: string) => L(`Ucz się: ${name}`, `Lernen: ${name}`, `Learn: ${name}`),
    reviewDue: (n: number) => L(`Powtórz (${n})`, `Wiederholen (${n})`, `Review (${n})`),
    /* Die Knöpfe der Karte */
    toMe: L('Do mnie', 'Zu mir', 'To me'),
    wholeMap: L('Cała mapa', 'Ganze Karte', 'Whole map'),
    zoomIn: L('Przybliż', 'Vergrößern', 'Zoom in'),
    zoomOut: L('Oddal', 'Verkleinern', 'Zoom out'),
    up: L('Wyżej', 'Hinauf', 'Up'),
    rotate: L('Obróć o 60°', 'Um 60° drehen', 'Rotate by 60°'),
    /* 2026-11-04 (Prompt 12) — was ein Klick tut (Hinweis beim Zeigen), was als Nächstes geht */
    hintZoom: L('przybliż', 'hineinzoomen', 'zoom in'),
    hintSelect: L('wybierz', 'auswählen', 'select'),
    hintStart: L('zacznij (kliknij jeszcze raz)', 'starten (noch einmal klicken)', 'start (click again)'),
    nextHere: L('Dalej tutaj', 'Als Nächstes hier', 'Next here'),
    nextList: (n: number) => L(`${themen(n)} gotowych do nauki`, `${themen(n)} jetzt lernbar`, `${themen(n)} learnable now`),
    /* 2026-11-04 (Prompt 13) — die eine Landschaft: das eigene Land, die Kamera, das kurze Panel eines Themas */
    summary: (land: number, won: number, regions: number, ready: number, due: number) => L(
      `Twój obszar: ${themen(land)} · ${won} z ${count(lang, regions, ['obszaru', 'obszarów', 'obszarów'], ['', ''], ['', ''])} zdobytych · ${ready} gotowych · ${due} do powtórki`,
      `Dein Gebiet: ${themen(land)} · ${won} von ${regions} ${regions === 1 ? 'Gebiet' : 'Gebieten'} erobert · ${ready} bereit · ${due} zu wiederholen`,
      `Your land: ${themen(land)} · ${won} of ${regions} ${regions === 1 ? 'region' : 'regions'} conquered · ${ready} ready · ${due} to review`),
    stReady: L('Gotowe — możesz zacząć', 'Bereit — du kannst anfangen', 'Ready — you can start'),
    stLocked: (n: number) => L(`Najpierw powtórka: ${count(lang, n, ['karta', 'karty', 'kart'], ['', ''], ['', ''])}`, `Erst wiederholen: ${n} ${n === 1 ? 'Karte' : 'Karten'}`, `Review first: ${n} ${n === 1 ? 'card' : 'cards'}`),
    stMissing: (n: number) => L(`Brakuje jeszcze ${n === 1 ? 'jednego tematu' : `${n} tematów`}`, `Es fehlen noch ${themen(n)}`, `${themen(n)} still missing`),
    stDue: (n: number) => L(`Do powtórki: ${count(lang, n, ['karta', 'karty', 'kart'], ['', ''], ['', ''])}`, `Zu wiederholen: ${n} ${n === 1 ? 'Karte' : 'Karten'}`, `To review: ${n} ${n === 1 ? 'card' : 'cards'}`),
    stKnown: L('Umiesz to', 'Kannst du', 'You know this'),
    rowReady: L('gotowe', 'bereit', 'ready'),
    rowLocked: L('najpierw powtórka', 'erst wiederholen', 'review first'),
    rowMissing: (n: number) => L(`brakuje ${n}`, `fehlen ${n}`, `${n} missing`),
    needFirst: L('Najpierw potrzebujesz:', 'Zuerst brauchst du:', 'First you need:'),
    learnNow: L('Ucz się teraz', 'Jetzt lernen', 'Learn now'),
    leadMe: L('Prowadź mnie tutaj', 'Führ mich hierher', 'Lead me here'),
    startIt: L('Zacznij', 'Anfangen', 'Start'),
    reviewIt: L('Powtórz', 'Wiederholen', 'Review'),
    opensNext: (n: number) => L(`Otwiera dalej: ${themen(n)}`, `Öffnet danach: ${themen(n)}`, `Opens next: ${themen(n)}`),
    storyLine: (parts: number, done: number) => L(`Opowieść: ${count(lang, parts, ['część', 'części', 'części'], ['', ''], ['', ''])} · ukończono ${done}`, `Geschichte: ${parts} ${parts === 1 ? 'Teil' : 'Teile'} · ${done} erledigt`, `Story: ${parts} ${parts === 1 ? 'part' : 'parts'} · ${done} done`),
    showPath: L('Pokaż ścieżkę', 'Weg zeigen', 'Show the path'),
    regionLine: (name: string, n: number, k: number) => L(`${name}: ${themen(n)} · ${k} z ${n} umiesz`, `${name}: ${themen(n)} · ${k} von ${n} gekonnt`, `${name}: ${themen(n)} · ${k} of ${n} known`),
    moreN: (n: number) => L(`+${n} więcej`, `+${n} weitere`, `+${n} more`),
    ownerTools: L('Więcej dla autora', 'Mehr für Autoren', 'More for authors'),
    viewAngle: (rot: number, tilt: number) => L(`obrót ${rot}° · nachylenie ${tilt}%`, `Drehung ${rot}° · Neigung ${tilt} %`, `rotation ${rot}° · tilt ${tilt}%`),
    tilt: L('Nachylenie', 'Neigung', 'Tilt'),
    tiltHint: L('Ctrl + przeciągnij: w górę/w dół nachyla, w bok obraca', 'Strg + Ziehen: hoch/runter neigt, quer dreht', 'Ctrl + drag: up/down tilts, sideways rotates'),
    resetView: L('Przywróć widok', 'Ansicht zurücksetzen', 'Reset view'),
    /* 2026-11-04 (Prompt 15) — Neigung mit Zeichen, drei Ansichten der Karte, der Ring in der Kachel */
    tiltSide: L('z boku', 'von der Seite', 'from the side'),
    tiltAbove: L('z góry', 'von oben', 'from above'),
    tiltHint2: L('Ctrl + przeciągnij: w górę — bardziej z boku, w dół — bardziej z góry; w bok obraca', 'Strg + Ziehen: hoch — flacher (zum Horizont), runter — mehr von oben; quer dreht', 'Ctrl + drag: up — flatter (towards the horizon), down — more from above; sideways rotates'),
    modeLabel: L('Co pokazuje mapa', 'Was die Karte zeigt', 'What the map shows'),
    modeAll: L('Ogólny', 'Überblick', 'Overview'),
    modeKnown: L('Co umiem', 'Was ich kann', 'What I know'),
    modeDue: L('Do powtórki', 'Zu wiederholen', 'To review'),
    legendTileRing: L('pierścień na brzegu pola: ile średnio umiesz z jego kart (od góry, zgodnie z ruchem wskazówek); kropka — coś do powtórki', 'Ring am Rand des Feldes: wie gut du seine Karten im Mittel kannst (von oben im Uhrzeigersinn); Punkt — etwas zu wiederholen', 'ring along the field edge: how well you know its cards on average (clockwise from the top); dot — something to review'),
    legendLand: L('twój obszar: to, co umiesz (ciepły kolor)', 'dein Gebiet: was du kannst (warme Farbe)', 'your land: what you know (warm colour)'),
    legendRegion: L('kolor: obszar (tematy, które do siebie należą)', 'Farbe: Gebiet (Themen, die zusammengehören)', 'colour: region (topics that belong together)'),
    legendNeeds: L('czego wymaga (ciemniej)', 'was es braucht (dunkler)', 'what it needs (darker)'),
    legendOpens: L('co otwiera (jaśniej)', 'was es öffnet (heller)', 'what it opens (lighter)'),
    /* 2026-11-04 (Prompt 14) — Spielfiguren, Fahne, die beiden Umrisse, was in einer Kachel steht */
    pieceLabel: (name: string) => L(`Pionek na: ${name} — dalej od miejsca, gdzie przerwano`, `Figur auf: ${name} — weiter, wo du aufgehört hast`, `Piece on: ${name} — continue where you stopped`),
    piecesHere: (n: number, region: string) => L(`${n} pionków w: ${region} — przybliż`, `${n} Figuren in: ${region} — hineinzoomen`, `${n} pieces in: ${region} — zoom in`),
    goalFlagLabel: (name: string) => L(`Cel: ${name} — pokaż drogę`, `Ziel: ${name} — Weg zeigen`, `Goal: ${name} — show the route`),
    legendPiece: L('pionek: temat, który zaczynasz — dotknij, by iść dalej', 'Figur: ein Thema, das du begonnen hast — antippen, um weiterzumachen', 'piece: a topic you started — tap to continue'),
    legendGoalPiece: L('pionek i flaga celu: tu idziesz po drodze do celu', 'Figur und Fahne des Ziels: hier gehst du auf dem Weg zum Ziel', 'goal piece and flag: where you walk on the route to your goal'),
    legendLandLine: L('pomarańczowoczerwony obrys: twój obszar (to, co umiesz)', 'orangeroter Umriss: dein Gebiet (was du kannst)', 'orange-red outline: your land (what you know)'),
    legendReadyLine: L('jasnożółty obrys: tematy, których możesz się uczyć teraz', 'hellgelber Umriss: Themen, die du jetzt lernen kannst', 'light-yellow outline: topics you can learn now'),
    todoMissing: (n: number) => L(`${n} brakuje`, `${n} fehlen`, `${n} missing`),
    todoDue: (n: number) => L(`${n} do powtórki`, `${n} zu wiederholen`, `${n} to review`),
    todoReady: L('gotowe', 'bereit', 'ready'),
    todoKnown: L('umiesz', 'gekonnt', 'known'),
    cardsLine: (k: number, n: number) => L(`karty: ${k} z ${n} umiesz`, `Karten: ${k} von ${n} gekonnt`, `cards: ${k} of ${n} known`),
    legendArea: L('obszar: obrys w jego kolorze, na nim jego tematy; jasna część obrysu — tyle już umiesz', 'Gebiet: Umriss in seiner Farbe, darauf seine Themen; der helle Teil des Randes — so viel kannst du', 'region: outline in its colour with its topics on it; the light part of the edge — how much you know'),
    legend: L('Legenda', 'Legende', 'Legend'),
    mapLabel: L('Krajobraz wiedzy — dolina: umiesz; jeden stopień wyżej: możesz się uczyć teraz; wyżej: tyle tematów jeszcze brakuje.', 'Landschaft des Wissens — Tal: kannst du; eine Stufe höher: jetzt lernbar; höher: so viele Themen fehlen noch.', 'Map of knowledge — valley: known; one level up: learnable now; higher: that many topics still missing.'),
    /* Legende */
    legendColour: L('Kolor: im głębszy, tym lepiej znane', 'Farbe: je kräftiger, desto besser gekonnt', 'Colour: the deeper, the better known'),
    legendHeight: L('Wysokość = stopnie: najdłuższy łańcuch tematów, których jeszcze brakuje (dolina — umiesz, jeden stopień — teraz)', 'Höhe = Stufen: die längste Kette noch fehlender Themen (Tal — kannst du, eine Stufe — jetzt)', 'Height = levels: the longest chain of topics still missing (valley — known, one level — now)'),
    legendGlow: L('jasny brzeg: możesz zacząć teraz', 'heller Rand: jetzt lernbar', 'light rim: learnable now'),
    legendHaze: L('bladsze: dalej (więcej stopni)', 'blasser: weiter weg (mehr Stufen)', 'paler: further away (more levels)'),
    legendDue: L('do powtórki', 'zu wiederholen', 'due for review'),
    legendFirst: L('najpierw powtórka, potem dalej', 'erst wiederholen, dann weiter', 'review first, then go on'),
    legendRoute: L('droga: od kroku 1 (następny) do celu', 'Weg: von Schritt 1 (als Nächstes) zum Ziel', 'route: from step 1 (next) to the goal'),
    legendBadge: L('liczba przy celu: tyle tematów do celu', 'Zahl am Ziel: so viele Themen bis dorthin', 'number at the goal: topics to get there'),
    legendRing: L('pierścień obszaru: ile z niego umiesz', 'Ring eines Gebiets: wie viel davon du kannst', 'ring of a region: how much of it you know'),
    legendFlag: L('flaga: obszar zdobyty (umiesz wszystko)', 'Fahne: Gebiet erobert (alles gekonnt)', 'flag: region conquered (all known)'),
    legendGate: L('brama: tu droga wychodzi do innego obszaru', 'Tor: hier führt ein Weg in ein anderes Gebiet', 'gate: a route leads out to another region'),
    legendHome: L('tu jesteś', 'hier bist du', 'you are here'),
    legendCut: L('skrócona kolumna (żeby widać było pole za nią)', 'gekürzte Säule (damit das Feld dahinter zu sehen ist)', 'shortened column (so the field behind shows)'),
    /* Gebiete */
    conquered: (name: string) => L(`Obszar zdobyty: ${name}`, `Gebiet erobert: ${name}`, `Region conquered: ${name}`),
    tally: (k: number, n: number) => L(`${k} z ${count(lang, n, ['obszaru', 'obszarów', 'obszarów'], ['Gebiet', 'Gebieten'], ['region', 'regions'])} zdobytych`, `${k} von ${n} ${n === 1 ? 'Gebiet' : 'Gebieten'} erobert`, `${k} of ${n} ${n === 1 ? 'region' : 'regions'} conquered`),
    opens: L('Otwiera dalej', 'Öffnet danach', 'Opens next'),
    comesFrom: L('Wymaga wcześniej', 'Braucht davor', 'Needs before'),
    home: L('Tu jesteś', 'Du bist hier', 'You are here'),
    gate: (name: string) => L(`Do obszaru: ${name}`, `Ins Gebiet: ${name}`, `To the region: ${name}`),
    rename: L('Zmień nazwę', 'Umbenennen', 'Rename'),
    moveTo: L('Przenieś do obszaru', 'In ein anderes Gebiet', 'Move to region'),
    save: L('Zapisz', 'Speichern', 'Save'),
    cancel: L('Anuluj', 'Abbrechen', 'Cancel'),
    around: (label: string) => L(`Wokół: ${label}`, `Rund um ${label}`, `Around ${label}`),
    otherTopics: (name: string) => L(`Pozostałe w: ${name}`, `Weiteres in ${name}`, `More in ${name}`),
    /* Der Weg */
    showRoute: L('Pokaż drogę', 'Weg zeigen', 'Show the way'),
    hideRoute: L('Ukryj drogę', 'Weg ausblenden', 'Hide the way'),
    routeHead: (n: number) => L(`${themen(n)} do celu — krok po kroku`, `${themen(n)} bis zum Ziel — Schritt für Schritt`, `${themen(n)} to the goal — step by step`),
    routeHere: (n: number) => L(`${themen(n)} do tego tematu — krok po kroku`, `${themen(n)} bis zu diesem Thema — Schritt für Schritt`, `${themen(n)} to this topic — step by step`),
    questionsIn: L('Pytania w tym temacie', 'Fragen in diesem Thema', 'Questions in this topic'),
    storyHere: L('Ten temat ma własną opowieść — ścieżka pokazuje jej części.', 'Dieses Thema hat eine eigene Geschichte — der Weg zeigt ihre Teile.', 'This topic has its own story — the path shows its parts.'),
    routeTitle: L('Droga do tego tematu', 'Weg zu diesem Thema', 'Route to this topic'),
    /* Erzählungen und was sonst noch gesagt wird */
    storyStage: (stage: 'new' | 'started' | 'review' | 'passed') => ({
      new: '', started: L('w drodze', 'unterwegs', 'under way'), review: L('ukończona — przegląd jeszcze niezdany', 'zu Ende — die Durchsicht steht noch aus', 'finished — the review is still open'), passed: L('ukończona', 'abgeschlossen', 'finished')
    })[stage],
    storyButton: (stage: 'new' | 'started' | 'review' | 'passed') => ({
      new: L('Zacznij opowieść', 'Geschichte beginnen', 'Start the story'), started: L('Kontynuuj opowieść', 'Geschichte fortsetzen', 'Continue the story'),
      review: L('Powtórz przegląd', 'Durchsicht wiederholen', 'Repeat the review'), passed: L('Otwórz opowieść', 'Geschichte öffnen', 'Open the story')
    })[stage],
    storyBack: L('Wróć do opowieści', 'Zurück zur Geschichte', 'Back to the story'),
    noCards: L('Z tego wpisu nie powstają karty do nauki.', 'Aus diesem Eintrag entstehen keine Lernkarten.', 'This entry makes no learning cards.'),
    noQuestions: L('Do tego wpisu nie ma jeszcze pytań.', 'Zu diesem Eintrag gibt es noch keine Fragen.', 'This entry has no questions yet.'),
    nothingFound: L('Nic takiego w tym krajobrazie.', 'Nichts davon in dieser Landschaft.', 'Nothing like that on this map.'),
    hits: L('Wyniki wyszukiwania', 'Suchergebnisse', 'Search results'),
    failed: L('Krajobraz', 'Landschaft', 'Map'),
    knownOf: (k: number, n: number) => L(`${k} z ${n} umiesz`, `${k} von ${n} gekonnt`, `${k} of ${n} known`),
    sectionTitle: L('Tematy tego obszaru', 'Themen dieses Gebiets', 'Topics of this region')
  };
}
export type LandscapeWords = ReturnType<typeof landscapeWords>;
