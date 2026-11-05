/**
 * 2026-11-05 (Prompt 23, A1–A6) — DIE WORTE ZWISCHEN FRAGEN UND FOLIEN (zu `lang.ts`: dieselben drei Sprachen; die Baza sagt
 * welche): Folien unter der Erklärung, „Zobacz w opowieści“, die Fragen zu einer Folie, die Landschaft der Fragen, der Lint
 * des Imports.
 */

import type { Lang } from './lang';

const plPlural = (n: number, one: string, few: string, many: string): string => {
  if (n === 1) return one;
  const t = n % 10;
  const h = n % 100;
  return t >= 2 && t <= 4 && (h < 12 || h > 14) ? few : many;
};

export function slideWords(lang: Lang) {
  const L = <T>(pl: T, de: T, en: T): T => (lang === 'de' ? de : lang === 'en' ? en : pl);
  const pytania = (n: number) => L(`${n} ${plPlural(n, 'pytanie', 'pytania', 'pytań')}`, `${n} ${n === 1 ? 'Frage' : 'Fragen'}`, `${n} ${n === 1 ? 'question' : 'questions'}`);
  return {
    lang,
    pytania,
    /* A2 — eine Folie in ihrer Erzählung, nur zum Ansehen */
    openInStory: L('Zobacz w opowieści', 'In der Geschichte öffnen', 'See in the story'),
    openStory: L('Otwórz opowieść', 'Geschichte öffnen', 'Open the story'),
    preview: L('Podgląd', 'Vorschau', 'Preview'),
    previewNote: L('Podgląd — nic się nie zapisuje: ani postęp, ani odpowiedzi.', 'Vorschau — nichts wird gespeichert: kein Fortschritt, keine Antworten.', 'Preview — nothing is saved: no progress, no answers.'),
    back: L('‹ Wróć', '‹ Zurück', '‹ Back'),
    noStory: L('Ten slajd nie stoi w żadnej opowieści.', 'Diese Folie steht in keiner Geschichte.', 'This slide is in no story.'),
    loading: L('Proszę czekać…', 'Wird geladen…', 'Loading…'),
    slide: L('Slajd', 'Folie', 'Slide'),
    /* A3 — die Fragen zu einer Folie */
    slideQuestions: (n: number) => L(`Pytania do tego slajdu (${n})`, `Fragen zu dieser Folie (${n})`, `Questions on this slide (${n})`),
    practise: L('Ćwicz', 'Üben', 'Practise'),
    practiseTitle: (name: string) => L(`Pytania do slajdu: ${name}`, `Fragen zur Folie: ${name}`, `Questions on the slide: ${name}`),
    noQuestions: L('Do tego slajdu nie ma pytań.', 'Zu dieser Folie gibt es keine Fragen.', 'There are no questions on this slide.'),
    /* A5 — eine Frage über die ganze Erzählung */
    storyPart: L('Część opowieści', 'Teil der Geschichte', 'Part of the story'),
    wholeStory: L('Cała opowieść', 'Die ganze Geschichte', 'The whole story'),
    /* A4 — die Landschaft der Fragen neben der der Erzählungen */
    tabStories: L('Opowieści', 'Geschichten', 'Stories'),
    tabQuestions: L('Pytania', 'Fragen', 'Questions'),
    tabsLabel: L('Co pokazuje mapa', 'Was die Karte zeigt', 'What the map shows'),
    groupOf: (n: number, known: number) => L(`${pytania(n)} · ${known} umiesz`, `${pytania(n)} · ${known} kannst du`, `${pytania(n)} · ${known} known`),
    inStory: (name: string) => L(`w opowieści: ${name}`, `in der Geschichte: ${name}`, `in the story: ${name}`),
    showStory: L('Pokaż opowieść na mapie', 'Geschichte auf der Karte zeigen', 'Show the story on the map'),
    /* 2026-11-05 (Prompt 23, E) — die Erzählung als Zweig auf der Ścieżka ihres Überblicks. */
    showBranch: (name: string) => L(`Pokaż na ścieżce: ${name}`, `Auf dem Weg zeigen: ${name}`, `Show on the path: ${name}`),
    noGroups: L('Pytania tej bazy nie wskazują slajdów opowieści.', 'Die Fragen dieser Baza nennen keine Folien einer Geschichte.', 'The questions of this base point to no story slides.'),
    groupState: (band: string) => L(
      band === 'known' ? 'umiesz' : band === 'due' ? 'do powtórki' : band === 'ring' ? 'możesz zacząć' : 'najpierw wcześniejsze slajdy',
      band === 'known' ? 'kannst du' : band === 'due' ? 'zu wiederholen' : band === 'ring' ? 'kannst du beginnen' : 'erst die Folien davor',
      band === 'known' ? 'known' : band === 'due' ? 'to review' : band === 'ring' ? 'you can start' : 'the slides before first'),
    /* A6 — der Lint im Import */
    lintQuoteLabel: (who: string) => L(`${who}: stary zapis cytatu „Cytat (…):” — napisz cytat jako akapit „> …” z ostatnim wierszem „> — Autor”.`, `${who}: alte Schreibweise „Cytat (…):” — schreib das Zitat als Absatz „> …” mit der letzten Zeile „> — Autor”.`, `${who}: old quotation label „Cytat (…):” — write the quote as a „> …” paragraph whose last line is „> — Author”.`),
    lintNotes: (who: string) => L(`${who}: ręcznie napisana lista „Przypisy” — przypisy pisz jako [^1] w tekście i [^1]: … na końcu (lista powstaje sama).`, `${who}: handgeschriebene Liste „Przypisy”/„Fußnoten” — schreib Fußnoten als [^1] im Text und [^1]: … am Ende (die Liste entsteht von selbst).`, `${who}: hand-written „Przypisy” list — write footnotes as [^1] in the text and [^1]: … at the end (the list is made automatically).`),
    lintClick: (who: string) => L(`${who}: „kliknij dalej” — przycisk „Dalej” jest zawsze; usuń to zdanie.`, `${who}: „kliknij dalej”/„klicke weiter” — „Weiter” steht immer da; streich den Satz.`, `${who}: „kliknij dalej” (click next) — the „Next” button is always there; remove the sentence.`),
    lintQuoteBy: (who: string) => L(`${who}: akapit cytatu („> …”) bez wiersza „> — Autor” — dopisz, kto mówi.`, `${who}: Zitat-Absatz („> …”) ohne Zeile „> — Autor” — ergänze, wer spricht.`, `${who}: quotation paragraph („> …”) without a „> — Author” line — add who says it.`),
    lintCitePrompt: (who: string) => L(`${who}: cytowanie [@…] w treści pytania — uczący się zobaczyłby klucz; przenieś źródło do wyjaśnienia.`, `${who}: Zitierschlüssel [@…] in der Frage — Lernende sähen den Schlüssel; die Quelle gehört in die Erklärung.`, `${who}: citation [@…] in a question prompt — learners would see the key; move the source to the explanation.`)
  };
}

export type SlideWords = ReturnType<typeof slideWords>;
