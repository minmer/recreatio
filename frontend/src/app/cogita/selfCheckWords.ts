/**
 * 2026-11-05 (Prompt 23, C) — DIE WORTE DES SELBSTTESTS („Sprawdź, co wiesz“): Kernfragen, Lücken, die Übersicht je Thema am
 * Ende eines Laufs „każda raz“, der Filter „Luki“ auf der Karte. Dieselben drei Sprachen wie `lang.ts` (die Baza sagt welche).
 */

import type { Lang } from './lang';

const plPlural = (n: number, one: string, few: string, many: string): string => {
  if (n === 1) return one;
  const t = n % 10;
  const h = n % 100;
  return t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
};

export function selfCheckWords(lang: Lang) {
  const L = <T>(pl: T, de: T, en: T): T => (lang === 'de' ? de : lang === 'en' ? en : pl);
  const topics = (n: number) => L(`${n} ${plPlural(n, 'temat', 'tematy', 'tematów')}`, `${n} ${n === 1 ? 'Thema' : 'Themen'}`, `${n} ${n === 1 ? 'topic' : 'topics'}`);
  return {
    /** Das Zeichen auf einer Kernfrage. */
    core: L('kluczowe', 'Kernfrage', 'key question'),
    coreHint: L('Pytanie kluczowe tematu: po nim widać, czy temat już umiesz', 'Kernfrage des Themas: an ihr sieht man, ob du das Thema schon kannst', 'The topic’s key question: it shows whether you already know the topic'),
    /** Der Knopf über der Karte. */
    check: L('Sprawdź, co wiesz', 'Prüfe, was du weißt', 'Check what you know'),
    checkHere: (name: string) => L(`Sprawdź, co wiesz: ${name}`, `Prüfe, was du weißt: ${name}`, `Check what you know: ${name}`),
    checkTitle: (name: string) => L(`Sprawdź, co wiesz — ${name}`, `Prüfe, was du weißt — ${name}`, `Check what you know — ${name}`),
    checkNone: L('Tu nie ma pytań do sprawdzenia.', 'Hier gibt es keine Fragen zum Prüfen.', 'There are no questions to check here.'),
    /** Der Filter danach. */
    gaps: L('Luki', 'Lücken', 'Gaps'),
    gapsNone: L('Bez luk — wszystkie sprawdzone tematy umiesz', 'Keine Lücken — alle geprüften Themen kannst du', 'No gaps — you know every checked topic'),
    gapsFirst: L('Najpierw „Sprawdź, co wiesz” — potem tu widać luki', 'Erst „Prüfe, was du weißt“ — dann stehen hier die Lücken', 'First “Check what you know” — then the gaps show here'),
    fill: L('Uzupełnij luki', 'Lücken schließen', 'Fill the gaps'),
    fillN: (n: number) => L(`Uzupełnij luki (${n})`, `Lücken schließen (${n})`, `Fill the gaps (${n})`),
    fillTitle: (name: string) => L(`Uzupełnij luki — ${name}`, `Lücken schließen — ${name}`, `Fill the gaps — ${name}`),
    /** Die Übersicht je Thema. */
    summaryTitle: L('Twoje tematy', 'Deine Themen', 'Your topics'),
    summaryLine: (known: number, gaps: number) => L(`Umiesz ${topics(known)} · luki: ${topics(gaps)}`, `Du kannst ${topics(known)} · Lücken: ${topics(gaps)}`, `You know ${topics(known)} · gaps: ${topics(gaps)}`),
    known: L('umiesz', 'kannst du', 'known'),
    gap: L('luka', 'Lücke', 'gap'),
    openTopic: L('Temat', 'Thema', 'Topic'),
    seeInStory: L('Zobacz w opowieści', 'In der Geschichte öffnen', 'See in the story'),
    gapsAll: L('Pokaż wszystkie', 'Alle zeigen', 'Show all'),
    /** Eine Erzählung, deren Fragen alle sitzen. */
    storyKnown: L('wszystkie pytania tej opowieści umiesz — zaliczona', 'alle Fragen dieser Geschichte kannst du — bestanden', 'you know every question of this story — passed')
  };
}

export type SelfCheckWords = ReturnType<typeof selfCheckWords>;
