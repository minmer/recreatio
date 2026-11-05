/**
 * 2026-11-04 (Prompt 11) — DIE WORTE DES KRAJOBRAZ DER GEBIETE (zu `lang.ts`: dieselben drei Sprachen, die Baza sagt
 * welche). Zwei Zahlen, überall mit denselben Worten:
 * <code>
 *   Stufen   die längste Kette noch fehlender Themen bis hierher, dieses mit — so hoch steht das Feld (Tal 0, jetzt
 *            lernbar 1); ein Gebiet: so viele Stufen, bis darin etwas beginnen kann
 *   Themen   wie viele Themen bis hierher noch zu lernen sind, dieses mit — so lang ist die Liste Schritt für Schritt
 * </code>
 */

import { wordsT, type Lang } from './lang';


export function landscapeWords(lang: Lang) {
  const t = wordsT(lang);
  const stufen = (n: number) => t('cogitaLearn.landscape.count.levels', { count: n });
  const themen = (n: number) => t('cogitaLearn.count.topics', { count: n });
  const gebiete = (n: number) => t('cogitaLearn.landscape.count.regions', { count: n });
  /* 2026-11-05 (Weg) — die Schritte des Weges zu einem Thema (je Schritt eine Stufe höher). */
  const kroki = (n: number) => t('cogitaLearn.count.steps', { count: n });
  return {
    stufen,
    themen,
    gebiete,
    /** „6 Stufen · 10 Themen" — die beiden Zahlen eines Feldes. */
    numbers: (s: number, t: number) => `${stufen(s)} · ${themen(t)}`,
    toGoal: (n: number) => t('cogitaLearn.landscape.toGoal', { topics: themen(n) }),
    toHere: (n: number) => t('cogitaLearn.landscape.toHere', { topics: themen(n) }),
    inRegion: (n: number) => t('cogitaLearn.landscape.inRegion', { topics: themen(n) }),
    inSection: (n: number) => t('cogitaLearn.landscape.inSection', { topics: themen(n) }),
    openOf: (open: number, all: number) => t('cogitaLearn.landscape.openOf', { open, all }),
    more: (n: number) => t('cogitaLearn.landscape.more', { n }),
    region: t('cogitaLearn.landscape.region'),
    topic: t('cogitaLearn.landscape.topic'),
    regionOf: (n: number) => t('cogitaLearn.landscape.regionOf', { topics: themen(n) }),
    /* Der eine Satz über der Karte (8e) */
    nextIs: t('cogitaLearn.landscape.nextIs'),
    nextReady: t('cogitaLearn.landscape.nextReady'),
    nextFirst: t('cogitaLearn.landscape.nextFirst'),
    nextAway: (n: number) => t('cogitaLearn.landscape.nextAway', { levels: stufen(n) }),
    dueCards: (n: number) => t('cogitaLearn.landscape.dueCards', { count: n }),
    nothingNext: t('cogitaLearn.landscape.nothingNext'),
    goIn: t('cogitaLearn.landscape.goIn'),
    learnIt: (name: string) => t('cogitaLearn.landscape.learnIt', { name }),
    reviewDue: (n: number) => t('cogitaLearn.landscape.reviewDue', { n }),
    /* Die Knöpfe der Karte */
    toMe: t('cogitaLearn.landscape.toMe'),
    wholeMap: t('cogitaLearn.landscape.wholeMap'),
    zoomIn: t('cogitaLearn.landscape.zoomIn'),
    zoomOut: t('cogitaLearn.landscape.zoomOut'),
    up: t('cogitaLearn.landscape.up'),
    rotate: t('cogitaLearn.landscape.rotate'),
    /* 2026-11-04 (Prompt 12) — was ein Klick tut (Hinweis beim Zeigen), was als Nächstes geht */
    hintZoom: t('cogitaLearn.landscape.hintZoom'),
    hintSelect: t('cogitaLearn.landscape.hintSelect'),
    hintStart: t('cogitaLearn.landscape.hintStart'),
    nextHere: t('cogitaLearn.landscape.nextHere'),
    nextList: (n: number) => t('cogitaLearn.landscape.nextList', { topics: themen(n) }),
    /* 2026-11-04 (Prompt 13) — die eine Landschaft: das eigene Land, die Kamera, das kurze Panel eines Themas */
    summary: (land: number, won: number, regions: number, ready: number, due: number) => t('cogitaLearn.landscape.summary', { topics: themen(land), won, count: regions, ready, due }),
    stReady: t('cogitaLearn.landscape.stReady'),
    stLocked: (n: number) => t('cogitaLearn.landscape.stLocked', { count: n }),
    stMissing: (n: number) => t('cogitaLearn.landscape.stMissing', { count: n }),
    stDue: (n: number) => t('cogitaLearn.landscape.stDue', { count: n }),
    stKnown: t('cogitaLearn.landscape.stKnown'),
    rowReady: t('cogitaLearn.landscape.rowReady'),
    rowLocked: t('cogitaLearn.landscape.rowLocked'),
    rowMissing: (n: number) => t('cogitaLearn.landscape.rowMissing', { n }),
    needFirst: t('cogitaLearn.landscape.needFirst'),
    learnNow: t('cogitaLearn.landscape.learnNow'),
    leadMe: t('cogitaLearn.landscape.leadMe'),
    startIt: t('cogitaLearn.landscape.startIt'),
    reviewIt: t('cogitaLearn.landscape.reviewIt'),
    opensNext: (n: number) => t('cogitaLearn.landscape.opensNext', { topics: themen(n) }),
    storyLine: (parts: number, done: number) => t('cogitaLearn.landscape.storyLine', { count: parts, done }),
    showPath: t('cogitaLearn.landscape.showPath'),
    regionLine: (name: string, n: number, k: number) => t('cogitaLearn.landscape.regionLine', { name, topics: themen(n), k, n }),
    moreN: (n: number) => t('cogitaLearn.landscape.moreN', { n }),
    ownerTools: t('cogitaLearn.landscape.ownerTools'),
    viewAngle: (rot: number, tilt: number) => t('cogitaLearn.landscape.viewAngle', { rot, tilt }),
    tilt: t('cogitaLearn.landscape.tilt'),
    tiltHint: t('cogitaLearn.landscape.tiltHint'),
    resetView: t('cogitaLearn.landscape.resetView'),
    /* 2026-11-04 (Prompt 15) — Neigung mit Zeichen, drei Ansichten der Karte, der Ring in der Kachel */
    tiltSide: t('cogitaLearn.landscape.tiltSide'),
    tiltAbove: t('cogitaLearn.landscape.tiltAbove'),
    tiltHint2: t('cogitaLearn.landscape.tiltHint2'),
    modeLabel: t('cogitaLearn.landscape.modeLabel'),
    modeAll: t('cogitaLearn.landscape.modeAll'),
    modeKnown: t('cogitaLearn.landscape.modeKnown'),
    modeDue: t('cogitaLearn.landscape.modeDue'),
    /* 2026-11-04 (Prompt 16) — das Haus, „Do odkrycia", nichts fällig, die Höhe der Säulen */
    modeDiscover: t('cogitaLearn.landscape.modeDiscover'),
    nothingDue: t('cogitaLearn.landscape.nothingDue'),
    nothingReady: t('cogitaLearn.landscape.nothingReady'),
    homeLabel: (name: string) => t('cogitaLearn.landscape.homeLabel', { name }),
    heightLabel: t('cogitaLearn.landscape.heightLabel'),
    heightLow: t('cogitaLearn.landscape.heightLow'),
    heightMid: t('cogitaLearn.landscape.heightMid'),
    heightHigh: t('cogitaLearn.landscape.heightHigh'),
    legendTileRing: t('cogitaLearn.landscape.legendTileRing'),
    legendLand: t('cogitaLearn.landscape.legendLand'),
    legendRegion: t('cogitaLearn.landscape.legendRegion'),
    legendNeeds: t('cogitaLearn.landscape.legendNeeds'),
    /* 2026-11-05 (Weg) — die springenden Punkte: der Weg zum gewählten Thema in Schritten (`worldWay.ts`). */
    wayStep: (k: number, n: number) => t('cogitaLearn.landscape.wayStep', { k, n }),
    wayStart: t('cogitaLearn.landscape.wayStart'),
    wayShow: (n: number) => t('cogitaLearn.landscape.wayShow', { steps: kroki(n) }),
    wayInfo: (n: number) => t('cogitaLearn.landscape.wayInfo', { steps: kroki(n) }),
    wayLabel: (n: number) => t('cogitaLearn.landscape.wayLabel', { steps: kroki(n) }),
    waySkip: t('cogitaLearn.landscape.waySkip'),
    legendWay: t('cogitaLearn.landscape.legendWay'),
    legendOpens: t('cogitaLearn.landscape.legendOpens'),
    /* 2026-11-05 — über einem Lauf (Powtórka, Erzählung) aus dem Krajobraz: zurück zur Karte; die Antworten bleiben. */
    backToMap: t('cogitaLearn.landscape.backToMap'),
    mapShort: t('cogitaLearn.landscape.mapShort'),
    /* 2026-11-05 — von einem begonnenen Feld zurücktreten: die Figur geht (die Antworten bleiben). */
    resignPiece: t('cogitaLearn.landscape.resignPiece'),
    resignGoal: t('cogitaLearn.landscape.resignGoal'),
    /* 2026-11-04 (Prompt 14) — Spielfiguren, Fahne, die beiden Umrisse, was in einer Kachel steht */
    pieceLabel: (name: string) => t('cogitaLearn.landscape.pieceLabel', { name }),
    piecesHere: (n: number, region: string) => t('cogitaLearn.landscape.piecesHere', { n, region }),
    goalFlagLabel: (name: string) => t('cogitaLearn.landscape.goalFlagLabel', { name }),
    legendPiece: t('cogitaLearn.landscape.legendPiece'),
    legendGoalPiece: t('cogitaLearn.landscape.legendGoalPiece'),
    legendLandLine: t('cogitaLearn.landscape.legendLandLine'),
    legendReadyLine: t('cogitaLearn.landscape.legendReadyLine'),
    todoMissing: (n: number) => t('cogitaLearn.landscape.todoMissing', { n }),
    todoDue: (n: number) => t('cogitaLearn.landscape.todoDue', { n }),
    todoReady: t('cogitaLearn.landscape.todoReady'),
    todoKnown: t('cogitaLearn.landscape.todoKnown'),
    cardsLine: (k: number, n: number) => t('cogitaLearn.landscape.cardsLine', { k, n }),
    legendArea: t('cogitaLearn.landscape.legendArea'),
    legend: t('cogitaLearn.landscape.legend'),
    mapLabel: t('cogitaLearn.landscape.mapLabel'),
    /* Legende */
    legendColour: t('cogitaLearn.landscape.legendColour'),
    legendHeight: t('cogitaLearn.landscape.legendHeight'),
    legendGlow: t('cogitaLearn.landscape.legendGlow'),
    legendHaze: t('cogitaLearn.landscape.legendHaze'),
    legendDue: t('cogitaLearn.landscape.legendDue'),
    legendFirst: t('cogitaLearn.landscape.legendFirst'),
    legendRoute: t('cogitaLearn.landscape.legendRoute'),
    legendBadge: t('cogitaLearn.landscape.legendBadge'),
    legendRing: t('cogitaLearn.landscape.legendRing'),
    legendFlag: t('cogitaLearn.landscape.legendFlag'),
    legendGate: t('cogitaLearn.landscape.legendGate'),
    legendHome: t('cogitaLearn.landscape.legendHome'),
    legendCut: t('cogitaLearn.landscape.legendCut'),
    /* Gebiete */
    conquered: (name: string) => t('cogitaLearn.landscape.conquered', { name }),
    tally: (k: number, n: number) => t('cogitaLearn.landscape.tally', { k, count: n }),
    opens: t('cogitaLearn.landscape.opens'),
    comesFrom: t('cogitaLearn.landscape.comesFrom'),
    home: t('cogitaLearn.landscape.home'),
    gate: (name: string) => t('cogitaLearn.landscape.gate', { name }),
    rename: t('cogitaLearn.landscape.rename'),
    moveTo: t('cogitaLearn.landscape.moveTo'),
    save: t('cogitaLearn.landscape.save'),
    cancel: t('cogitaLearn.landscape.cancel'),
    around: (label: string) => t('cogitaLearn.landscape.around', { label }),
    otherTopics: (name: string) => t('cogitaLearn.landscape.otherTopics', { name }),
    /* Der Weg */
    showRoute: t('cogitaLearn.landscape.showRoute'),
    hideRoute: t('cogitaLearn.landscape.hideRoute'),
    routeHead: (n: number) => t('cogitaLearn.landscape.routeHead', { topics: themen(n) }),
    routeHere: (n: number) => t('cogitaLearn.landscape.routeHere', { topics: themen(n) }),
    questionsIn: t('cogitaLearn.landscape.questionsIn'),
    storyHere: t('cogitaLearn.landscape.storyHere'),
    routeTitle: t('cogitaLearn.landscape.routeTitle'),
    /* Erzählungen und was sonst noch gesagt wird */
    storyStage: (stage: 'new' | 'started' | 'review' | 'passed') => ({
      new: '', started: t('cogitaLearn.landscape.storyStage.started'), review: t('cogitaLearn.landscape.storyStage.review'), passed: t('cogitaLearn.landscape.storyStage.passed')
    })[stage],
    storyButton: (stage: 'new' | 'started' | 'review' | 'passed') => ({
      new: t('cogitaLearn.words.storyButton.new'), started: t('cogitaLearn.words.storyButton.started'),
      review: t('cogitaLearn.words.storyButton.review'), passed: t('cogitaLearn.words.storyButton.passed')
    })[stage],
    storyBack: t('cogitaLearn.landscape.storyBack'),
    noCards: t('cogitaLearn.landscape.noCards'),
    noQuestions: t('cogitaLearn.landscape.noQuestions'),
    nothingFound: t('cogitaLearn.landscape.nothingFound'),
    hits: t('cogitaLearn.landscape.hits'),
    failed: t('cogitaLearn.landscape.failed'),
    knownOf: (k: number, n: number) => t('cogitaLearn.landscape.knownOf', { k, n }),
    sectionTitle: t('cogitaLearn.landscape.sectionTitle')
  };
}
export type LandscapeWords = ReturnType<typeof landscapeWords>;
