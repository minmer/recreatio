/**
 * 2026-11-05 (Prompt 23, C) — DIE WORTE DES SELBSTTESTS („Sprawdź, co wiesz“): Kernfragen, Lücken, die Übersicht je Thema am
 * Ende eines Laufs „każda raz“, der Filter „Luki“ auf der Karte. Dieselben drei Sprachen wie `lang.ts` (die Baza sagt welche).
 */

import { wordsT, type Lang } from './lang';


export function selfCheckWords(lang: Lang) {
  const t = wordsT(lang);
  const topics = (n: number) => t('cogitaLearn.count.topics', { count: n });
  return {
    /** Das Zeichen auf einer Kernfrage. */
    core: t('cogitaLearn.selfCheck.core'),
    coreHint: t('cogitaLearn.selfCheck.coreHint'),
    /** Der Knopf über der Karte. */
    check: t('cogitaLearn.selfCheck.check'),
    checkHere: (name: string) => t('cogitaLearn.selfCheck.checkHere', { name }),
    checkTitle: (name: string) => t('cogitaLearn.selfCheck.checkTitle', { name }),
    checkNone: t('cogitaLearn.selfCheck.checkNone'),
    /** Der Filter danach. */
    gaps: t('cogitaLearn.selfCheck.gaps'),
    gapsNone: t('cogitaLearn.selfCheck.gapsNone'),
    gapsFirst: t('cogitaLearn.selfCheck.gapsFirst'),
    fill: t('cogitaLearn.selfCheck.fill'),
    fillN: (n: number) => t('cogitaLearn.selfCheck.fillN', { n }),
    fillTitle: (name: string) => t('cogitaLearn.selfCheck.fillTitle', { name }),
    /** Die Übersicht je Thema. */
    summaryTitle: t('cogitaLearn.selfCheck.summaryTitle'),
    summaryLine: (known: number, gaps: number) => t('cogitaLearn.selfCheck.summaryLine', { known: topics(known), gaps: topics(gaps) }),
    known: t('cogitaLearn.selfCheck.known'),
    gap: t('cogitaLearn.selfCheck.gap'),
    openTopic: t('cogitaLearn.selfCheck.openTopic'),
    seeInStory: t('cogitaLearn.selfCheck.seeInStory'),
    gapsAll: t('cogitaLearn.selfCheck.gapsAll'),
    /** Eine Erzählung, deren Fragen alle sitzen. */
    storyKnown: t('cogitaLearn.selfCheck.storyKnown')
  };
}

export type SelfCheckWords = ReturnType<typeof selfCheckWords>;
