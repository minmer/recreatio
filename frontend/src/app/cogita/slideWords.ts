/**
 * 2026-11-05 (Prompt 23, A1–A6) — DIE WORTE ZWISCHEN FRAGEN UND FOLIEN (zu `lang.ts`: dieselben drei Sprachen; die Baza sagt
 * welche): Folien unter der Erklärung, „Zobacz w opowieści“, die Fragen zu einer Folie, die Landschaft der Fragen, der Lint
 * des Imports.
 */

import { wordsT, type Lang } from './lang';


export function slideWords(lang: Lang) {
  const t = wordsT(lang);
  const pytania = (n: number) => t('cogitaLearn.count.questions', { count: n });
  return {
    lang,
    pytania,
    /* A2 — eine Folie in ihrer Erzählung, nur zum Ansehen */
    openInStory: t('cogitaLearn.slide.openInStory'),
    openStory: t('cogitaLearn.slide.openStory'),
    preview: t('cogitaLearn.slide.preview'),
    previewNote: t('cogitaLearn.slide.previewNote'),
    back: t('cogitaLearn.slide.back'),
    noStory: t('cogitaLearn.slide.noStory'),
    loading: t('cogitaLearn.slide.loading'),
    slide: t('cogitaLearn.slide.slide'),
    /* A3 — die Fragen zu einer Folie */
    slideQuestions: (n: number) => t('cogitaLearn.slide.slideQuestions', { n }),
    practise: t('cogitaLearn.slide.practise'),
    practiseTitle: (name: string) => t('cogitaLearn.slide.practiseTitle', { name }),
    noQuestions: t('cogitaLearn.slide.noQuestions'),
    /* A5 — eine Frage über die ganze Erzählung */
    storyPart: t('cogitaLearn.slide.storyPart'),
    wholeStory: t('cogitaLearn.slide.wholeStory'),
    /* A4 — die Landschaft der Fragen neben der der Erzählungen */
    tabStories: t('cogitaLearn.slide.tabStories'),
    tabQuestions: t('cogitaLearn.slide.tabQuestions'),
    tabsLabel: t('cogitaLearn.slide.tabsLabel'),
    groupOf: (n: number, known: number) => t('cogitaLearn.words.branchQuestions', { questions: pytania(n), known }),
    inStory: (name: string) => t('cogitaLearn.slide.inStory', { name }),
    showStory: t('cogitaLearn.slide.showStory'),
    /* 2026-11-05 (Prompt 23, E) — die Erzählung als Zweig auf der Ścieżka ihres Überblicks. */
    showBranch: (name: string) => t('cogitaLearn.slide.showBranch', { name }),
    noGroups: t('cogitaLearn.slide.noGroups'),
    groupState: (band: string) => t(band === 'known' ? 'cogitaLearn.slide.groupState.known' : band === 'due' ? 'cogitaLearn.slide.groupState.due' : band === 'ring' ? 'cogitaLearn.slide.groupState.ring' : 'cogitaLearn.slide.groupState.later'),
    /* A6 — der Lint im Import */
    lintQuoteLabel: (who: string) => t('cogitaLearn.slide.lintQuoteLabel', { who }),
    lintNotes: (who: string) => t('cogitaLearn.slide.lintNotes', { who }),
    lintClick: (who: string) => t('cogitaLearn.slide.lintClick', { who }),
    lintQuoteBy: (who: string) => t('cogitaLearn.slide.lintQuoteBy', { who }),
    lintCitePrompt: (who: string) => t('cogitaLearn.slide.lintCitePrompt', { who })
  };
}

export type SlideWords = ReturnType<typeof slideWords>;
