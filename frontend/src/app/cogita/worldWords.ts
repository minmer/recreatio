/**
 * 2026-11-05 (Prompt 24) — DIE WORTE DER VERBINDUNGEN ZWISCHEN BAZY („Inne światy", `worlds.ts`, `WorldLinks.tsx`) in den drei
 * Sprachen von `lang.ts`; die Baza sagt welche.
 */

import { wordsT, type Lang } from './lang';

export function worldWords(lang: Lang) {
  const t = wordsT(lang);
  return {
    lang,
    section: t('cogitaLearn.world.section'),
    sectionNote: t('cogitaLearn.world.sectionNote'),
    inWorld: (name: string) => t('cogitaLearn.world.inWorld', { name }),
    deeper: (name: string) => t('cogitaLearn.world.deeper', { name }),
    open: t('cogitaLearn.world.open'),
    openIn: (name: string) => t('cogitaLearn.world.openIn', { name }),
    enter: t('cogitaLearn.world.enter'),
    story: t('cogitaLearn.world.story'),
    entry: t('cogitaLearn.world.entry'),
    view: t('cogitaLearn.world.view'),
    stateNew: t('cogitaLearn.world.stateNew'),
    stateStarted: t('cogitaLearn.world.stateStarted'),
    stateDone: t('cogitaLearn.world.stateDone'),
    stateKnown: (pct: number) => t('cogitaLearn.world.stateKnown', { pct }),
    stateKnownAll: t('cogitaLearn.world.stateKnownAll'),
    stateThere: t('cogitaLearn.world.stateThere'),
    loading: t('cogitaLearn.world.loading'),
    unavailable: t('cogitaLearn.world.unavailable'),
    unavailableNote: t('cogitaLearn.world.unavailableNote'),
    broken: t('cogitaLearn.world.broken'),
    brokenNote: (ref: string, world: string) => t('cogitaLearn.world.brokenNote', { world, ref }),
    unknownWorld: (handle: string) => t('cogitaLearn.world.unknownWorld', { handle }),
    back: (name: string) => t('cogitaLearn.world.back', { name }),
    returnNote: t('cogitaLearn.world.returnNote'),
    skip: t('cogitaLearn.world.skip'),
    next: t('cogitaLearn.world.next'),
    again: t('cogitaLearn.world.again'),
    known: t('cogitaLearn.world.known'),
    portals: (n: number) => t('cogitaLearn.world.portals', { n }),
    portal: t('cogitaLearn.world.portal'),
    /* Editor */
    pick: t('cogitaLearn.world.pick'),
    pickTitle: t('cogitaLearn.world.pickTitle'),
    pickBase: t('cogitaLearn.world.pickBase'),
    pickSearch: t('cogitaLearn.world.pickSearch'),
    pickNone: t('cogitaLearn.world.pickNone'),
    pickNoBases: t('cogitaLearn.world.pickNoBases'),
    pickUse: t('cogitaLearn.world.pickUse'),
    pickCancel: t('cogitaLearn.world.pickCancel'),
    pickOffer: t('cogitaLearn.world.pickOffer'),
    pickCopy: t('cogitaLearn.world.pickCopy'),
    copied: t('cogitaLearn.world.copied'),
    /* Ustawienia */
    settingsTitle: t('cogitaLearn.world.settingsTitle'),
    settingsHandle: t('cogitaLearn.world.settingsHandle'),
    settingsHandleNote: t('cogitaLearn.world.settingsHandleNote'),
    settingsWorlds: t('cogitaLearn.world.settingsWorlds'),
    settingsNoWorlds: t('cogitaLearn.world.settingsNoWorlds'),
    settingsRemove: t('cogitaLearn.world.settingsRemove'),
    settingsSave: t('cogitaLearn.world.settingsSave'),
    /* Do zrobienia */
    todoTitle: (n: number) => t('cogitaLearn.world.todoTitle', { n }),
    todoIn: t('cogitaLearn.world.todoIn'),
    todoUnreadable: (world: string) => t('cogitaLearn.world.todoUnreadable', { world }),
    todoChecking: t('cogitaLearn.world.todoChecking')
  };
}

export type WorldWords = ReturnType<typeof worldWords>;
