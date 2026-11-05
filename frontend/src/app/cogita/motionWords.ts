/**
 * 2026-11-05 (Prompt 17) — DIE WORTE DER BEWEGUNG UND DER MELDUNGEN (zu `lang.ts`: dieselben drei Sprachen, die Baza sagt
 * welche): die Meldungen am Rand („Cel dnia osiągnięty!", „Poziom 5: Mistrz"), „Utrwalone", „5 z rzędu", das Ende eines
 * Laufs, „Pokaż zmiany" auf der Karte, die Wahl „Animacje".
 */

import { wordsT, type Lang } from './lang';


export function motionWords(lang: Lang) {
  const t = wordsT(lang);
  return {
    lang,
    /* Meldungen */
    goalReached: t('cogitaLearn.motion.goalReached'),
    streakDay: (n: number) => (n <= 1 ? t('cogitaLearn.motion.streakStart') : t('cogitaLearn.motion.streakDays', { n })),
    level: (n: number, name: string) => t('cogitaLearn.motion.level', { n, name }),
    levelUp: t('cogitaLearn.motion.levelUp'),
    badge: t('cogitaLearn.motion.badge'),
    badges: (n: number) => t('cogitaLearn.motion.badges', { n }),
    region: (name: string) => t('cogitaLearn.motion.region', { name }),
    points: (n: number) => t('cogitaLearn.motion.points', { n }),
    openBadges: t('cogitaLearn.motion.openBadges'),
    dismiss: t('cogitaLearn.motion.dismiss'),
    /* Antworten */
    known: t('cogitaLearn.motion.known'),
    inRow: (n: number) => t('cogitaLearn.motion.inRow', { n }),
    /* Das Ende eines Laufs */
    summaryTitle: t('cogitaLearn.motion.summaryTitle'),
    cardsDone: (n: number) => t('cogitaLearn.count.cards', { count: n }),
    rightOf: (k: number, n: number) => t('cogitaLearn.motion.rightOf', { k, n }),
    pointsEarned: t('cogitaLearn.motion.pointsEarned'),
    topicsLearned: (n: number) => t('cogitaLearn.motion.topicsLearned', { n }),
    reviewsDone: (n: number) => t('cogitaLearn.motion.reviewsDone', { n }),
    goalToday: (k: number, n: number) => t('cogitaLearn.motion.goalToday', { k, n }),
    backToMap: t('cogitaLearn.motion.backToMap'),
    labelCards: t('cogitaLearn.motion.labelCards'),
    labelRight: t('cogitaLearn.motion.labelRight'),
    labelTopics: t('cogitaLearn.motion.labelTopics'),
    labelReviews: t('cogitaLearn.motion.labelReviews'),
    labelGoal: t('cogitaLearn.motion.labelGoal'),
    /* Die Karte */
    replay: t('cogitaLearn.motion.replay'),
    changes: (n: number) => t('cogitaLearn.motion.changes', { count: n }),
    skipHint: t('cogitaLearn.motion.skipHint'),
    /* Die Wahl auf dem Gerät */
    motion: t('cogitaLearn.motion.motion'),
    motionAuto: t('cogitaLearn.motion.motionAuto'),
    motionFull: t('cogitaLearn.motion.motionFull'),
    motionReduced: t('cogitaLearn.motion.motionReduced'),
    motionOff: t('cogitaLearn.motion.motionOff'),
    motionSays: t('cogitaLearn.motion.motionSays')
  };
}

export type MotionWords = ReturnType<typeof motionWords>;
