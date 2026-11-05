/**
 * 2026-11-05 (Prompt 17) — DIE WORTE DER BEWEGUNG UND DER MELDUNGEN (zu `lang.ts`: dieselben drei Sprachen, die Baza sagt
 * welche): die Meldungen am Rand („Cel dnia osiągnięty!", „Poziom 5: Mistrz"), „Utrwalone", „5 z rzędu", das Ende eines
 * Laufs, „Pokaż zmiany" auf der Karte, die Wahl „Animacje".
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

export function motionWords(lang: Lang) {
  const L = <T>(pl: T, de: T, en: T): T => (lang === 'de' ? de : lang === 'en' ? en : pl);
  return {
    lang,
    /* Meldungen */
    goalReached: L('Cel dnia osiągnięty!', 'Tagesziel erreicht!', 'Daily goal reached!'),
    streakDay: (n: number) => (n <= 1 ? L('Seria zaczęta — 1. dzień', 'Serie begonnen — Tag 1', 'Streak started — day 1') : L(`Seria: ${n} dni z rzędu`, `Serie: ${n} Tage in Folge`, `Streak: ${n} days in a row`)),
    level: (n: number, name: string) => L(`Poziom ${n}: ${name}`, `Stufe ${n}: ${name}`, `Level ${n}: ${name}`),
    levelUp: L('Nowy poziom', 'Neue Stufe', 'New level'),
    badge: L('Nowa odznaka', 'Neues Abzeichen', 'New badge'),
    badges: (n: number) => L(`+${n} odznaki`, `+${n} Abzeichen`, `+${n} badges`),
    region: (name: string) => L(`Obszar zdobyty: ${name}`, `Gebiet erobert: ${name}`, `Region conquered: ${name}`),
    points: (n: number) => L(`+${n} pkt`, `+${n} Pkt.`, `+${n} pts`),
    openBadges: L('Odznaki i poziomy', 'Abzeichen und Stufen', 'Badges and levels'),
    dismiss: L('Zamknij', 'Schliessen', 'Close'),
    /* Antworten */
    known: L('Utrwalone', 'Gefestigt', 'Locked in'),
    inRow: (n: number) => L(`${n} z rzędu`, `${n} in Folge`, `${n} in a row`),
    /* Das Ende eines Laufs */
    summaryTitle: L('Podsumowanie', 'Zusammenfassung', 'Summary'),
    cardsDone: (n: number) => count(lang, n, ['karta', 'karty', 'kart'], ['Karte', 'Karten'], ['card', 'cards']),
    rightOf: (k: number, n: number) => L(`dobrze: ${k} z ${n}`, `richtig: ${k} von ${n}`, `right: ${k} of ${n}`),
    pointsEarned: L('punkty', 'Punkte', 'points'),
    topicsLearned: (n: number) => L(`nauczone tematy: ${n}`, `gelernte Themen: ${n}`, `topics learned: ${n}`),
    reviewsDone: (n: number) => L(`powtórki: ${n}`, `Wiederholungen: ${n}`, `reviews: ${n}`),
    goalToday: (k: number, n: number) => L(`cel dnia: ${k}/${n}`, `Tagesziel: ${k}/${n}`, `daily goal: ${k}/${n}`),
    backToMap: L('Wróć do mapy', 'Zurück zur Karte', 'Back to the map'),
    labelCards: L('karty', 'Karten', 'cards'),
    labelRight: L('dobrze', 'richtig', 'right'),
    labelTopics: L('nauczone tematy', 'gelernte Themen', 'topics learned'),
    labelReviews: L('powtórki', 'Wiederholungen', 'reviews'),
    labelGoal: L('cel dnia', 'Tagesziel', 'daily goal'),
    /* Die Karte */
    replay: L('Pokaż zmiany', 'Änderungen zeigen', 'Show changes'),
    changes: (n: number) => count(lang, n, ['zmiana', 'zmiany', 'zmian'], ['Änderung', 'Änderungen'], ['change', 'changes']),
    skipHint: L('Kliknij, aby pominąć', 'Klicken zum Überspringen', 'Click to skip'),
    /* Die Wahl auf dem Gerät */
    motion: L('Animacje', 'Animationen', 'Animations'),
    motionAuto: L('jak w systemie', 'wie im System', 'as in the system'),
    motionFull: L('pełne', 'voll', 'full'),
    motionReduced: L('ograniczone', 'reduziert', 'reduced'),
    motionOff: L('wyłączone', 'aus', 'off'),
    motionSays: L('Ograniczone: tylko płynne przejścia, nic się nie przesuwa. Wyłączone: zmiany od razu, bez animacji.', 'Reduziert: nur Überblendungen, nichts bewegt sich. Aus: Änderungen sofort, ohne Animation.', 'Reduced: fades only, nothing moves. Off: changes at once, without animation.')
  };
}

export type MotionWords = ReturnType<typeof motionWords>;
