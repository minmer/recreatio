/**
 * 2026-11-04 — DIE SPRACHE DER NAUKA FOLGT DER BAZA: eine Baza auf Deutsch (LAAG) spricht Deutsch, eine auf Polnisch
 * (Bosko) Polnisch. Die Sprache steht in den Ustawienia (`language`); fehlt sie, wird sie aus den eigenen Worten der Baza
 * erkannt (Namen der Rodzaje und der Einträge). Übersetzt sind die Bildschirme des Lernens auf der Karte: Krajobraz,
 * seine Seitenleiste, die Ścieżka und das Ende einer Powtórka — der Rest der Anwendung bleibt polnisch.
 *
 * 2026-11-05 — Die Worte stehen in `src/locales/<sprache>/cogitaLearn.json`; `words(lang)` & Co. holen sie mit
 * `tFor(lang)`. Ohne Einstellung und ohne erkennbare Sprache spricht die Baza die Sprache der Anwendung.
 */

import { appLang, langLoaded, loadLang, localeOf, tFor, type Lang, type T } from '../core/i18n';
import { forkWords, partWords, type PartKind, type PathFork } from './pathLayout';
import type { CogitaLibrary } from './store';

export type { Lang };
export const LANGS: readonly Lang[] = ['pl', 'de', 'en'];
export const LANG_LABEL: Readonly<Record<Lang, string>> = { pl: 'polski', de: 'Deutsch', en: 'English' }; // i18n-ignore

/* Die Wörter einer Sprache, die (noch) nicht geladen ist, nachladen — bis dahin gilt der englische Rückfall. */
const want = (lang: Lang): void => { if (!langLoaded(lang)) void loadLang(lang); };

/** Das `t` der Worte einer Baza (`motionWords`, `landscapeWords` …): in ihrer Sprache, die nötigenfalls nachgeladen wird. */
export function wordsT(lang: Lang): T {
  want(lang);
  return tFor(lang);
}

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

/** Die Sprache einer Baza: aus den Ustawienia, sonst erkannt aus ihren Worten, sonst die der Anwendung. */
const DETECTED = new WeakMap<object, { revision: number; lang: Lang }>();
export function baseLang(lib: CogitaLibrary): Lang {
  const set = lib.settings().language;
  if (set === 'pl' || set === 'de' || set === 'en') return set;
  const had = DETECTED.get(lib.store);
  if (had !== undefined && had.revision === lib.revision) return had.lang;
  const texts = [...lib.kinds.filter((k) => lib.isOwn(k.id)).map((k) => k.name), ...lib.entities().slice(0, 300).map((e) => lib.label(e))];
  const lang = detectLang(texts) ?? appLang();
  DETECTED.set(lib.store, { revision: lib.revision, lang });
  return lang;
}

/** Die Worte der Lernbildschirme in einer Sprache. */
export function words(lang: Lang) {
  want(lang);
  const t = tFor(lang);
  const STEP_TYPES = ['show', 'question', 'line', 'subflow', 'detour', 'each', 'expand', 'opening', 'scene'];
  return {
    lang,
    locale: localeOf(lang),
    steps: (n: number) => t('cogitaLearn.count.steps', { count: n }),
    cards: (n: number) => t('cogitaLearn.count.cards', { count: n }),
    questions: (n: number) => t('cogitaLearn.count.questions', { count: n }),
    slides: (n: number) => t('cogitaLearn.count.slides', { count: n }),
    topics: (n: number) => t('cogitaLearn.count.topics', { count: n }),
    parts: (n: number) => t('cogitaLearn.count.parts', { count: n }),
    paths: (n: number) => t('cogitaLearn.count.paths', { count: n }),
    /* Der Krajobraz */
    whole: t('cogitaLearn.words.whole'),
    whereAmI: t('cogitaLearn.words.whereAmI'),
    ready: t('cogitaLearn.words.ready'),
    due: t('cogitaLearn.words.due'),
    known: t('cogitaLearn.words.known'),
    behind: t('cogitaLearn.words.behind'),
    away: (n: number) => t('cogitaLearn.words.away', { count: n }),
    youKnow: t('cogitaLearn.words.youKnow'),
    reviewFirstState: t('cogitaLearn.words.reviewFirstState'),
    goal: t('cogitaLearn.words.goal'),
    goalNow: t('cogitaLearn.words.goalNow'),
    goalReached: t('cogitaLearn.words.goalReached'),
    goalMissing: (n: number) => t('cogitaLearn.words.goalMissing', { count: n }),
    nextStep: t('cogitaLearn.words.nextStep'),
    show: t('cogitaLearn.words.show'),
    clearGoal: t('cogitaLearn.words.clearGoal'),
    setGoal: t('cogitaLearn.words.setGoal'),
    goalSet: (name: string) => t('cogitaLearn.words.goalSet', { name }),
    goalCleared: t('cogitaLearn.words.goalCleared'),
    goalDone: (name: string) => t('cogitaLearn.words.goalDone', { name }),
    goalRoute: t('cogitaLearn.words.goalRoute'),
    goalRouteNote: (n: number, m: number) => t('cogitaLearn.words.goalRouteNote', { topics: t('cogitaLearn.count.topics', { count: n }), steps: t('cogitaLearn.count.steps', { count: m }) }),
    nextToGoal: (name: string) => t('cogitaLearn.words.nextToGoal', { name }),
    start: t('cogitaLearn.words.start'),
    review: t('cogitaLearn.words.review'),
    reviewFirst: (n: number) => t('cogitaLearn.words.reviewFirst', { count: n }),
    reviewFirstWhat: t('cogitaLearn.words.reviewFirstWhat'),
    showPath: (n: number) => t('cogitaLearn.words.showPath', { count: n }),
    openEntry: t('cogitaLearn.words.openEntry'),
    enter: t('cogitaLearn.words.enter'),
    close: t('cogitaLearn.words.close'),
    unlocks: t('cogitaLearn.words.unlocks'),
    inside: (n: number) => t('cogitaLearn.words.inside', { n }),
    chooseField: t('cogitaLearn.words.chooseField'),
    canLearnNote: t('cogitaLearn.words.canLearnNote'),
    otherTopics: t('cogitaLearn.words.otherTopics'),
    readyList: t('cogitaLearn.words.readyList'),
    rotate: t('cogitaLearn.words.rotate'),
    computing: t('cogitaLearn.words.computing'),
    wait: t('cogitaLearn.words.wait'),
    empty: t('cogitaLearn.words.empty'),
    asList: (n: number) => t('cogitaLearn.words.asList', { n }),
    listBands: [t('cogitaLearn.words.listBands.ready'), t('cogitaLearn.words.listBands.due'), t('cogitaLearn.words.listBands.behind'), t('cogitaLearn.words.listBands.known')],
    legendColour: t('cogitaLearn.words.legendColour'),
    legendHeight: t('cogitaLearn.words.legendHeight'),
    legendDue: t('cogitaLearn.words.legendDue'),
    legendFirst: t('cogitaLearn.words.legendFirst'),
    legendGoal: t('cogitaLearn.words.legendGoal'),
    legendSeeThrough: t('cogitaLearn.words.legendSeeThrough'),
    /* Das Ende einer Powtórka */
    runDone: (n: number) => t('cogitaLearn.words.runDone', { count: n }),
    runStopped: t('cogitaLearn.words.runStopped'),
    unlocked: t('cogitaLearn.words.unlocked'),
    nothingUnlocked: t('cogitaLearn.words.nothingUnlocked'),
    story: t('cogitaLearn.words.story'),
    learnNow: (name: string) => t('cogitaLearn.words.learnNow', { name }),
    nextTopic: (name: string) => t('cogitaLearn.words.nextTopic', { name }),
    backToMap: t('cogitaLearn.words.backToMap'),
    keepPractising: t('cogitaLearn.words.keepPractising'),
    back: t('cogitaLearn.words.back'),
    nowOpening: (name: string) => t('cogitaLearn.words.nowOpening', { name }),
    /* Die Ścieżka */
    done: t('cogitaLearn.words.done'),
    open: t('cogitaLearn.words.open'),
    locked: t('cogitaLearn.words.locked'),
    now: t('cogitaLearn.words.now'),
    finished: t('cogitaLearn.words.finished'),
    zoomOut: t('cogitaLearn.words.zoomOut'),
    zoomIn: t('cogitaLearn.words.zoomIn'),
    fit: t('cogitaLearn.words.fit'),
    full: t('cogitaLearn.words.full'),
    tapAgain: t('cogitaLearn.words.tapAgain'),
    firstNeeds: t('cogitaLearn.words.firstNeeds'),
    pathTitle: t('cogitaLearn.words.pathTitle'),
    /* 2026-11-04 (Prompt 10) — wie viele Fragen noch, woher die Frage kommt und warum sie jetzt kommt */
    left: (n: number) => t('cogitaLearn.words.left', { count: n }),
    topicIs: t('cogitaLearn.words.topicIs'),
    storyIs: t('cogitaLearn.words.storyIs'),
    whyNew: t('cogitaLearn.words.whyNew'),
    whyDue: (pct: number) => t('cogitaLearn.words.whyDue', { pct }),
    whyMissed: t('cogitaLearn.words.whyMissed'),
    whyForgotten: t('cogitaLearn.words.whyForgotten'),
    whySpacer: t('cogitaLearn.words.whySpacer'),
    whyAhead: t('cogitaLearn.words.whyAhead'),
    whyKnown: (pct: number) => t('cogitaLearn.words.whyKnown', { pct }),
    lastAnswers: t('cogitaLearn.words.lastAnswers'),
    dueAt: t('cogitaLearn.words.dueAt'),
    asked: (ask: number, all: number) => t('cogitaLearn.path.askOf', { ask, count: all }),
    allKnown: t('cogitaLearn.words.allKnown'),
    /** 2026-11-04 — was in einem Teil der Ścieżka wartet (`ask`: wie viele seiner Fragen wirklich gefragt werden). */
    part: (nd: { readonly kind?: PartKind; readonly slides?: number; readonly questions?: number }, ask?: number): string => partWords(nd, ask, lang),
    /** Was eine Gabel zählt. */
    fork: (f: PathFork): string => forkWords(f, lang),
    forkAll: t('cogitaLearn.words.forkAll'),
    forkOne: t('cogitaLearn.words.forkOne'),
    dueMark: t('cogitaLearn.words.dueMark'),
    /* 2026-11-04 (Prompt 11) — die Ścieżka: was der Zähler zählt, automatische Teile, Wege zurück, was danach kommt */
    summary: (done: number, total: number, noun: 'parts' | 'topics' = 'parts'): string => (noun === 'topics'
      ? t('cogitaLearn.words.summaryTopics', { done, count: total })
      : t('cogitaLearn.words.summary', { done, total })),
    pathAria: (summary: string, now: string | null): string => (now === null ? t('cogitaLearn.words.pathAria', { summary }) : t('cogitaLearn.words.pathAriaNow', { summary, now })),
    partNames: {
      start: t('cogitaLearn.words.partNames.start'), end: t('cogitaLearn.words.partNames.end'), review: t('cogitaLearn.words.partNames.review'), choice: t('cogitaLearn.words.partNames.choice'),
      chapters: t('cogitaLearn.words.partNames.chapters'), questions: t('cogitaLearn.words.partNames.questions'),
      questionsOf: (x: string) => t('cogitaLearn.words.partNames.questionsOf', { x }), choiceOn: (x: string) => t('cogitaLearn.words.partNames.choiceOn', { x }),
      step: (type: string): string | undefined => (STEP_TYPES.includes(type) ? t(`cogitaLearn.words.partStep.${type}`) : undefined)
    },
    autoKind: t('cogitaLearn.words.autoKind'),
    autoWhy: t('cogitaLearn.words.autoWhy'),
    autoOneOf: (a: string, b: string): string => (a !== '' && b !== '' ? t('cogitaLearn.words.autoOneOf', { a, b })
      : t('cogitaLearn.words.autoOrNothing', { x: a || b })),
    loopKind: t('cogitaLearn.words.loopKind'),
    loopWhy: t('cogitaLearn.words.loopWhy'),
    optionalKind: t('cogitaLearn.words.optionalKind'),
    optionalWhy: t('cogitaLearn.words.optionalWhy'),
    legend: t('cogitaLearn.words.legend'),
    whatNext: t('cogitaLearn.words.whatNext'),
    nextChoose: t('cogitaLearn.words.nextChoose'),
    nextAvailable: t('cogitaLearn.words.nextAvailable'),
    nextOptional: t('cogitaLearn.words.nextOptional'),
    nextOptionalHint: t('cogitaLearn.words.nextOptionalHint'),
    nextLocked: t('cogitaLearn.words.nextLocked'),
    nextLockedHint: t('cogitaLearn.words.nextLockedHint'),
    nextCompleted: t('cogitaLearn.words.nextCompleted'),
    nextCompletedHint: t('cogitaLearn.words.nextCompletedHint'),
    nextContinue: t('cogitaLearn.words.nextContinue'),
    nextMapHint: t('cogitaLearn.words.nextMapHint'),
    nextRoute: t('cogitaLearn.words.nextRoute'),
    nextRouteTo: (name: string): string => t('cogitaLearn.words.nextRouteTo', { name }),
    nextRouteHint: t('cogitaLearn.words.nextRouteHint'),
    nextGoalHint: t('cogitaLearn.words.nextGoalHint'),
    nextGoalStarting: t('cogitaLearn.words.nextGoalStarting'),
    nextGoalContinue: t('cogitaLearn.words.nextGoalContinue'),
    nextGoalFailed: t('cogitaLearn.words.nextGoalFailed'),
    nextGoalUnavailable: t('cogitaLearn.words.nextGoalUnavailable'),
    nearest: t('cogitaLearn.words.nearest'),
    nextReady: t('cogitaLearn.words.nextReady'),
    nextNotYet: t('cogitaLearn.words.nextNotYet'),
    /* 2026-11-05 — in „Co dalej": was der Lernende dort schon getan hat. */
    nextDone: t('cogitaLearn.words.nextDone'),
    nextStarted: t('cogitaLearn.words.nextStarted'),
    needsFirst: (names: string): string => t('cogitaLearn.words.needsFirst', { names }),
    dueFirst: (names: string): string => t('cogitaLearn.words.dueFirst', { names }),
    startStory: t('cogitaLearn.words.startStory'),
    learn: t('cogitaLearn.words.learn'),
    nextGo: (name: string): string => t('cogitaLearn.words.nextGo', { name }),
    workShort: (slides: number, questions: number): string => [slides > 0 ? t('cogitaLearn.count.slides', { count: slides }) : '', questions > 0 ? t('cogitaLearn.count.questions', { count: questions }) : ''].filter(Boolean).join(' · '),
    inStory: (name: string): string => t('cogitaLearn.words.inStory', { name }),
    /* 2026-11-04 (Prompt 13) — Abstecher in eine andere Erzählung */
    detourAsk: (name: string): string => t('cogitaLearn.words.detourAsk', { name }),
    detourEnter: t('cogitaLearn.words.detourEnter'),
    detourSkip: t('cogitaLearn.words.detourSkip'),
    detourKnown: t('cogitaLearn.words.detourKnown'),
    detourRemind: t('cogitaLearn.words.detourRemind'),
    detourStarted: t('cogitaLearn.words.detourStarted'),
    detourRequired: t('cogitaLearn.words.detourRequired'),
    detourMissing: t('cogitaLearn.words.detourMissing'),
    detourDeep: t('cogitaLearn.words.detourDeep'),
    detourCycle: t('cogitaLearn.words.detourCycle'),
    backTo: (name: string): string => t('cogitaLearn.words.backTo', { name }),
    insidePath: (name: string): string => t('cogitaLearn.words.insidePath', { name }),
    crumbs: t('cogitaLearn.words.crumbs'),
    detourSkipped: t('cogitaLearn.words.detourSkipped'),
    skippedKind: t('cogitaLearn.words.skippedKind'),
    detourOpen: t('cogitaLearn.words.detourOpen'),
    detourNote: t('cogitaLearn.words.detourNote'),
    /* 2026-11-05 (Prompt 23, B) — Abstecher als Zweige der Ścieżka */
    branchAfter: (n: number): string => t('cogitaLearn.words.branchAfter', { n }),
    branchAtStart: t('cogitaLearn.words.branchAtStart'),
    branchNew: t('cogitaLearn.words.branchNew'),
    branchSkipped: t('cogitaLearn.words.branchSkipped'),
    branchProgress: (done: number, total: number): string => t('cogitaLearn.words.branchProgress', { done, total }),
    branchDone: t('cogitaLearn.words.branchDone'),
    branchQuestions: (n: number, known: number): string => t('cogitaLearn.words.branchQuestions', { questions: t('cogitaLearn.count.questions', { count: n }), known }),
    branchUnfold: (n: number): string => t('cogitaLearn.words.branchUnfold', { n }),
    branchFold: t('cogitaLearn.words.branchFold'),
    branchReturn: t('cogitaLearn.words.branchReturn'),
    branchLegend: t('cogitaLearn.words.branchLegend'),
    nextLegend: t('cogitaLearn.words.nextLegend'),
    storyFirst: (names: string): string => t('cogitaLearn.words.storyFirst', { names }),
    requiredLeft: (names: string): string => t('cogitaLearn.words.requiredLeft', { names }),
    returned: (inner: string, outer: string): string => t('cogitaLearn.words.returned', { inner, outer }),
    storyEnd: t('cogitaLearn.words.storyEnd'),
    reviewNotPassed: t('cogitaLearn.words.reviewNotPassed'),
    reviewPassed: t('cogitaLearn.words.reviewPassed'),
    reviewAgain: t('cogitaLearn.words.reviewAgain'),
    /* 2026-11-05 (Prompt 23, D4) — der Przegląd in einem Schritt („review") */
    reviewStepHead: t('cogitaLearn.words.reviewStepHead'),
    reviewStepOf: (k: number, n: number) => t('cogitaLearn.words.reviewStepOf', { k, n }),
    reviewStepIntro: (ask: number, total: number, pct: number) => t('cogitaLearn.words.reviewStepIntro', { ask, total, pct }),
    reviewStepNone: t('cogitaLearn.words.reviewStepNone'),
    reviewStepScore: (good: number, total: number, pct: number) => t('cogitaLearn.words.reviewStepScore', { good, total, pct }),
    reviewStepPassed: t('cogitaLearn.words.reviewStepPassed'),
    reviewStepNotYet: (pct: number) => t('cogitaLearn.words.reviewStepNotYet', { pct }),
    reviewStepStart: t('cogitaLearn.words.reviewStepStart'),
    /* 2026-11-05 (Prompt 23, D1) — ein Rysunek neben einer Folie, der nicht zu lesen ist */
    slideDrawingBroken: t('cogitaLearn.words.slideDrawingBroken'),
    fromStart: t('cogitaLearn.words.fromStart'),
    /* 2026-11-04 (Prompt 13) — das einzige, was „ukończona" und erreichte Ziele wegnimmt */
    forgetStory: t('cogitaLearn.words.forgetStory'),
    forgetAsk: (name: string) => t('cogitaLearn.words.forgetAsk', { name }),
    /* 2026-11-05 (Prompt 18) — der Kopf des Spielers: zurück, „⋯", Fortschritt, Wstecz, wer erzählt. */
    stepBack: t('cogitaLearn.words.stepBack'),
    moreTools: t('cogitaLearn.words.moreTools'),
    progressOf: (done: number, all: number) => t('cogitaLearn.words.progressOf', { done, all }),
    reviewProgress: (done: number, all: number) => t('cogitaLearn.words.reviewProgress', { done, all }),
    reviewPassedMark: t('cogitaLearn.words.reviewPassedMark'),
    reviewOpenMark: t('cogitaLearn.words.reviewOpenMark'),
    pastStep: t('cogitaLearn.words.pastStep'),
    chosenHere: t('cogitaLearn.words.chosenHere'),
    yourAnswer: t('cogitaLearn.words.yourAnswer'),
    detourEntered: t('cogitaLearn.words.detourEntered'),
    learnWithBasics: t('cogitaLearn.words.learnWithBasics'),
    goOn: t('cogitaLearn.words.goOn'),
    storyButton: {
      new: t('cogitaLearn.words.storyButton.new'), started: t('cogitaLearn.words.storyButton.started'),
      review: t('cogitaLearn.words.storyButton.review'), passed: t('cogitaLearn.words.storyButton.passed')
    },
    widen: t('cogitaLearn.words.widen'),
    /* 2026-11-10 — der Plan der Erzählung als eigene Ansicht (Menü „⋯"), mit oder ohne den eigenen Weg. */
    storyMap: t('cogitaLearn.words.storyMap'),
    /* 2026-11-11 — eine frühere Wahl neu treffen (ein weiterer Weg). */
    chooseAgain: t('cogitaLearn.words.chooseAgain'),
    routeShown: t('cogitaLearn.words.routeShown'),
    narrow: t('cogitaLearn.words.narrow'),
    chooseRoad: (n: number): string => (n === 1 ? t('cogitaLearn.words.chooseRoadOne') : t('cogitaLearn.words.chooseRoad', { n })),
    kinds: tab(['start', 'end', 'read', 'learn', 'mixed', 'review', 'fork', 'detour'] as const, (k) => t(`cogitaLearn.words.kinds.${k}`))
  };
}
export type Words = ReturnType<typeof words>;

/** Eine Tabelle von Worten mit festen Namen (die Schlüssel bleiben die alten). */
function tab<K extends string>(keys: readonly K[], text: (k: K) => string): Record<K, string> {
  return Object.fromEntries(keys.map((k) => [k, text(k)])) as Record<K, string>;
}

/**
 * 2026-11-04 (Prompt 15) — DIE WORTE DER ABSTÄNDE DER WIEDERHOLUNGEN (`spacing.ts`, `SpacingSettings.tsx`) — eigene
 * Liste, damit die der Lernbildschirme kurz bleibt.
 */
const PRESETS = ['often', 'standard', 'lighter', 'once'] as const;
const UNITS = ['minute', 'hour', 'day', 'week', 'month', 'year'] as const;
export function spacingWords(lang: Lang) {
  want(lang);
  const t = tFor(lang);
  return {
    title: t('cogitaLearn.spacing.title'),
    line: (name: string) => t('cogitaLearn.spacing.line', { name }),
    change: t('cogitaLearn.spacing.change'),
    close: t('cogitaLearn.spacing.close'),
    preset: tab(PRESETS, (k) => t(`cogitaLearn.spacing.preset.${k}`)),
    presetSays: tab(PRESETS, (k) => t(`cogitaLearn.spacing.presetSays.${k}`)),
    custom: t('cogitaLearn.spacing.custom'),
    /* 2026-11-05 — die kurze Wahl im Baustein „Krajobraz" (`SpacingChoice`). */
    ask: t('cogitaLearn.spacing.ask'),
    other: t('cogitaLearn.spacing.other'),
    /* 2026-11-05 — der Stapel: wie viele Karten eine Wiederholung zugleich hat. */
    stackAsk: t('cogitaLearn.spacing.stackAsk'),
    stackSays: (n: number) => t('cogitaLearn.spacing.stackSays', { n }),
    stackOther: t('cogitaLearn.spacing.stackOther'),
    stackAreaTitle: t('cogitaLearn.spacing.stackAreaTitle'),
    stackMayChange: t('cogitaLearn.spacing.stackMayChange'),
    stackAreaClear: t('cogitaLearn.spacing.stackAreaClear'),
    choiceSays: t('cogitaLearn.spacing.choiceSays'),
    advanced: t('cogitaLearn.spacing.advanced'),
    first: t('cogitaLearn.spacing.first'),
    firstSays: t('cogitaLearn.spacing.firstSays'),
    growth: t('cogitaLearn.spacing.growth'),
    growthSays: t('cogitaLearn.spacing.growthSays'),
    unit: tab(UNITS, (k) => t(`cogitaLearn.spacing.unit.${k}`)),
    unitOne: tab(UNITS, (k) => t(`cogitaLearn.spacing.unitOne.${k}`)),
    apply: t('cogitaLearn.spacing.apply'),
    summary: (first: string, growth: number) => t('cogitaLearn.spacing.summary', { first, growth }),
    fromArea: t('cogitaLearn.spacing.fromArea'),
    fromOwn: t('cogitaLearn.spacing.fromOwn'),
    fromDefault: t('cogitaLearn.spacing.fromDefault'),
    locked: t('cogitaLearn.spacing.locked'),
    useArea: t('cogitaLearn.spacing.useArea'),
    useDefault: t('cogitaLearn.spacing.useDefault'),
    recompute: t('cogitaLearn.spacing.recompute'),
    areaTitle: t('cogitaLearn.spacing.areaTitle'),
    areaSays: t('cogitaLearn.spacing.areaSays'),
    mayChange: t('cogitaLearn.spacing.mayChange'),
    areaNone: t('cogitaLearn.spacing.areaNone'),
    areaClear: t('cogitaLearn.spacing.areaClear')
  };
}
export type SpacingWords = ReturnType<typeof spacingWords>;

/**
 * 2026-11-05 (Prompt 17) — DIE WORTE DER SEITE „ODZNAKI I POZIOMY" (`BadgesPage.tsx`) und ihres Eingangs in den Nagrody.
 * Die Namen der Stufen und Abzeichen sind Daten der Regel; die Ereignisse sagt auf Polnisch `eventText` (`rewards.ts`) —
 * hier (`event`) nur Deutsch und Englisch, auf Polnisch `null`.
 */
const MATERIALS = ['wood', 'bronze', 'silver', 'gold', 'diamond'] as const;
const MEASURES = ['points', 'streak', 'best', 'known', 'cards', 'answers', 'correct', 'days', 'combo', 'goals', 'level', 'regions', 'map', 'clean'] as const;
export function rewardWords(lang: Lang) {
  want(lang);
  const t = tFor(lang);
  const locale = localeOf(lang);
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const num = (n: number): string => fmt.format(n);
  /* Eine Zahl mit ihrem Wort — die Form wählt die Mehrzahl der Sprache. */
  const n3 = (key: string, n: number): string => t(key, { count: n, n: num(n) });
  const days = (n: number) => n3('cogitaLearn.reward.amount.day', n);
  /** So viel von einem Mass, in Worten: „2 dni", „120 pkt", „3 utrwalone karty". */
  const amount = (m: string, n: number): string => {
    switch (m) {
      case 'points': return n3('cogitaLearn.reward.amount.points', n);
      case 'streak': case 'best': return days(n);
      case 'days': return n3('cogitaLearn.reward.amount.days', n);
      case 'clean': return t('cogitaLearn.reward.amount.clean', { days: days(n) });
      case 'known': return n3('cogitaLearn.reward.amount.known', n);
      case 'cards': return n3('cogitaLearn.reward.amount.cards', n);
      case 'answers': return n3('cogitaLearn.reward.amount.answers', n);
      case 'correct': return n3('cogitaLearn.reward.amount.correct', n);
      case 'combo': return n3('cogitaLearn.reward.amount.combo', n);
      case 'goals': return n3('cogitaLearn.reward.amount.goals', n);
      case 'level': return n3('cogitaLearn.reward.amount.level', n);
      case 'regions': return n3('cogitaLearn.reward.amount.regions', n);
      case 'map': return t('cogitaLearn.reward.amount.map', { n: num(n) });
      default: return num(n);
    }
  };
  /** Wie man ein Abzeichen ohne eigene Beschreibung bekommt — aus Mass und Schwelle. */
  const says = (m: string, n: number): string => {
    switch (m) {
      case 'points': return n3('cogitaLearn.reward.says.points', n);
      case 'streak': return t('cogitaLearn.reward.says.streak', { days: days(n) });
      case 'best': return t('cogitaLearn.reward.says.best', { days: days(n) });
      case 'cards': return n3('cogitaLearn.reward.says.cards', n);
      case 'level': return t('cogitaLearn.reward.says.level', { n: num(n) });
      case 'regions': return t('cogitaLearn.reward.says.regions', { n: num(n) });
      case 'map': return t('cogitaLearn.reward.says.map', { n: num(n) });
      case 'clean': return t('cogitaLearn.reward.says.clean', { days: days(n) });
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
      ? t('cogitaLearn.reward.leftCombo', { value: num(value), goal: num(goal) })
      : t('cogitaLearn.reward.left', { amount: amount(m, rest) })),
    title: t('cogitaLearn.reward.title'),
    titleOf: (name: string) => t('cogitaLearn.reward.titleOf', { name }),
    openSays: t('cogitaLearn.reward.openSays'),
    back: t('cogitaLearn.reward.back'),
    counting: t('cogitaLearn.reward.counting'),
    nextGoals: t('cogitaLearn.reward.nextGoals'),
    allDone: t('cogitaLearn.reward.allDone'),
    restOnMap: t('cogitaLearn.reward.restOnMap'),
    levels: t('cogitaLearn.reward.levels'),
    level: (n: number) => t('cogitaLearn.reward.level', { n }),
    levelNamed: (name: string) => t('cogitaLearn.reward.levelNamed', { name }),
    from: (n: number) => t('cogitaLearn.reward.from', { n: num(n) }),
    reached: t('cogitaLearn.reward.reached'),
    you: t('cogitaLearn.reward.you'),
    current: t('cogitaLearn.reward.current'),
    ahead: t('cogitaLearn.reward.ahead'),
    notYet: t('cogitaLearn.reward.notYet'),
    beforeFirst: t('cogitaLearn.reward.beforeFirst'),
    here: (pct: number, name: string) => t('cogitaLearn.reward.here', { pct, name }),
    hereOther: (pct: number, name: string) => t('cogitaLearn.reward.hereOther', { pct, name }),
    toNext: (n: number, name: string) => t('cogitaLearn.reward.toNext', { name, n: num(n) }),
    levelMeter: (name: string) => t('cogitaLearn.reward.levelMeter', { name }),
    brings: (name: string, frame: string) => t('cogitaLearn.reward.brings', { name, frame }),
    top: t('cogitaLearn.reward.top'),
    noLevels: t('cogitaLearn.reward.noLevels'),
    /** Die Rahmen der Stufen (`levelFrame`): als Name und als das, was eine Stufe bringt. 2026-11-05 (Odznaki): die erste aus Holz. */
    frame: MATERIALS.map((k) => t(`cogitaLearn.reward.frame.${k}`)),
    frameGives: MATERIALS.map((k) => t(`cogitaLearn.reward.frameGives.${k}`)),
    /** 2026-11-05 (Odznaki) — die Stoffe der Stufen (`BADGE_MATERIALS`): Name, und „do srebra" (Polnisch im Genitiv). */
    material: MATERIALS.map((k) => t(`cogitaLearn.reward.material.${k}`)),
    toMaterial: (m: number, left: string) => {
      const k = MATERIALS[m];
      return k === undefined ? left : t(`cogitaLearn.reward.toMaterial.${k}`, { left });
    },
    noMaterial: t('cogitaLearn.reward.noMaterial'),
    /** Beim besten Lauf guter Antworten zählt der Rekord (nicht „noch N"): „rekord 6 z 10". */
    comboLeft: (value: number, goal: number) => t('cogitaLearn.reward.comboLeft', { value: num(value), goal: num(goal) }),
    onMapShort: t('cogitaLearn.reward.onMapShort'),
    onMapShortOther: t('cogitaLearn.reward.onMapShortOther'),
    closest: t('cogitaLearn.reward.closest'),
    categories: t('cogitaLearn.reward.categories'),
    /** Die Kachel einer Kategorie: was ein Antippen tut (für Vorleser; sichtbar steht die Kategorie selbst). */
    showSteps: (name: string) => t('cogitaLearn.reward.showSteps', { name }),
    stepsOf: (k: number, n: number) => t('cogitaLearn.reward.stepsOf', { k, n }),
    later: t('cogitaLearn.reward.later'),
    levelOf: (i: number, n: number) => t('cogitaLearn.reward.levelOf', { i, n }),
    allLevels: t('cogitaLearn.reward.allLevels'),
    historyDays: (n: number) => t('cogitaLearn.reward.historyDays', { count: n }),
    /* Der Editor: der Stoff einer Stufe */
    editorTier: t('cogitaLearn.reward.editorTier'),
    editorTierAuto: (m: string) => t('cogitaLearn.reward.editorTierAuto', { m }),
    badges: t('cogitaLearn.reward.badges'),
    badgesOf: (k: number, n: number) => t('cogitaLearn.reward.badgesOf', { k, n }),
    noBadges: t('cogitaLearn.reward.noBadges'),
    /** Die Arten der Abzeichen (`BADGE_KINDS`) — 2026-11-05 (Odznaki): die Kategorien, kurz (sie stehen auf Kacheln). */
    kinds: tab(['start', 'consistency', 'accuracy', 'volume', 'goals', 'exploration'] as const, (k) => t(`cogitaLearn.reward.kinds.${k}`)),
    /** Die Masse als Überschrift einer Reihe von Stufen eines Abzeichens. */
    measure: tab(MEASURES, (k) => t(`cogitaLearn.reward.measure.${k}`)) as Readonly<Record<string, string>>,
    tiers: (k: number, n: number) => t('cogitaLearn.reward.tiers', { k, n }),
    allTiers: t('cogitaLearn.reward.allTiers'),
    earned: (date: string) => t('cogitaLearn.reward.earned', { date }),
    notStarted: t('cogitaLearn.reward.notStarted'),
    onMap: t('cogitaLearn.reward.onMap'),
    onMapOther: t('cogitaLearn.reward.onMapOther'),
    bonus: (n: number) => t('cogitaLearn.reward.bonus', { n: num(n) }),
    meter: (name: string) => t('cogitaLearn.reward.meter', { name }),
    history: t('cogitaLearn.reward.history'),
    day: t('cogitaLearn.reward.day'),
    allDays: (n: number) => t('cogitaLearn.reward.allDays', { n }),
    dayTotal: (n: number) => t('cogitaLearn.reward.dayTotal', { n: num(n) }),
    noHistory: t('cogitaLearn.reward.noHistory'),
    more: (n: number) => t('cogitaLearn.reward.more', { n }),
    /** Ein Ereignis in Worten auf Deutsch und Englisch — auf Polnisch `null` (dann `eventText`). `name`: der Stufe, des Abzeichens. */
    event: (kind: string, value: number | undefined, name: string, every: number): string | null => {
      if (lang === 'pl') return null;
      switch (kind) {
        case 'answer': return (value ?? 0) >= 0.9 ? t('cogitaLearn.reward.event.answerGood') : (value ?? 0) >= 0.25 ? t('cogitaLearn.reward.event.answerPartly') : t('cogitaLearn.reward.event.answerTry');
        case 'first': return t('cogitaLearn.reward.event.first');
        case 'fast': return t('cogitaLearn.reward.event.fast');
        case 'combo': return t('cogitaLearn.reward.event.combo', { n: value ?? every });
        case 'known': return t('cogitaLearn.reward.event.known');
        case 'goal': return t('cogitaLearn.reward.event.goal');
        case 'streak': return value === 1 ? t('cogitaLearn.reward.event.streakFirst') : t('cogitaLearn.reward.event.streak', { n: value ?? 0 });
        case 'level': return t('cogitaLearn.reward.event.level', { name });
        case 'badge': return t('cogitaLearn.reward.event.badge', { name });
        default: return null;
      }
    },
    /* Der Editor der Regel (`RewardsEditor.tsx`) */
    editorKind: t('cogitaLearn.reward.editorKind'),
    editorKindAuto: (kind: string) => t('cogitaLearn.reward.editorKindAuto', { kind }),
    editorMapNote: t('cogitaLearn.reward.editorMapNote')
  };
}
export type RewardWords = ReturnType<typeof rewardWords>;
