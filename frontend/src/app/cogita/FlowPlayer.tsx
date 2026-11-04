/**
 * COGITA — EINEN ABLAUF SPIELEN (COGITA.md §8, §9): Schritt für Schritt, im
 * Aussehen des Ablaufs (Lesen, Slajdy, Szenen, Gespräch in Blasen, Karteikarten,
 * Karte), mit den Gestalten, die sprechen, wenn ihre Bedingung gilt, und den
 * Werten, die der Lernende mitnimmt. Wo er steht, bleibt über Geräte hinweg
 * [G14].
 *
 * Derselbe Spieler zeigt einen Ablauf im Arbeitsbereich und auf einer Seite —
 * dort aus der Baza, so wie ihr Bereich sie dem Leser zeigt (2026-10-22,
 * Schritt 8; keine Abschriften mehr). Der Inhalt kommt über `FlowContent`.
 *
 * 2026-10-22 (Schritt 12, COGITA.md §8 „One narrative"): ein Ablauf, der auf
 * eine Präsentation zeigt (`presentation`), spielt sie selbst — durch ihren
 * eigenen Motor, mit dem Lernenden der Baza (`PresentationInNauka`). Erzähler
 * (`narrators`) wählen sich nach den Werten und stehen über jedem Schritt.
 *
 * 2026-11-04 (Prompt 11) — ALLES FOLGT DER ERZÄHLUNG, DIE WIRKLICH LÄUFT (`runningStory.ts`): geht ein Weg in eine andere
 * Erzählung (Unterablauf, Übergabe) oder beginnt der Lernende nach „Koniec" die nächste, wechseln Titel, Ścieżka, „TERAZ",
 * die Zähler und die Zeile über der Frage zugleich; die Stelle wird für die laufende gemerkt; ein „Koniec" in einer gerufenen
 * Erzählung führt in die rufende zurück. Nach dem Ende: was danach kommt (`storyNext.ts`) — auf der Ścieżka über dem Ende
 * und hier als Knöpfe; die Ścieżka daneben so breit, wie der Lernende will.
 */

import { lazy, Suspense, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { CardFace } from './CardFace';
import { questionCard } from './cards';
import { type Card } from './cardBasics';
import {
  chaptersLeft, follow, goalsReached, linesNow, markSaid, narratorNow, optionsOf, readFlow, resolveFlow, STEP_LABEL,
  type Flow, type FlowState, type LookType, type PlayContext
} from './flow';
import type { EntriesOfStep } from './flowPath';
import { branchIds, branchParts, branchWork, chapterOfSteps, stepWorkOf, storyMarks, storyPath, type WorkOfStep } from './storyPath';
import { chaptersKept, flowFactsOf, mergeGoals } from './flowFacts';
import type { GraphNode } from './graph';
import { PathMap, type PathNext } from './PathMap';
import { mergeWords } from './pathLayout';
import { renamer, type Learner } from './learn';
import { askedCardOf, cardKnow, cardsInFlow, flowKnowness, isKnown, pickSpacer, questionsLeft, skipStep, type MarksOf } from './flowAsk';
import { baseLang, words, type Lang } from './lang';
import { cardsAbout } from './prerequisites';
import { conditionText, holds, readCondition, type Facts, type FlowFacts } from './logic';
import { publicEntity, type PublicEntity } from './publish';
import type { MediaRef } from './schema';
import type { CogitaLibrary } from './store';
import { CogitaContext, Markup, MediaView, originPath } from './ui';
import { readPlan } from './revision';
import { RevisionRun, type RunSource } from './RevisionRun';
import { decideBy, enterAt, startRun, stepRun, type RunStep, type StoryFinished, type StoryRun } from './runningStory';
import { OPEN_LOCK, storyAround } from './storyLock';
import { storyWork } from './storyNext';
import { readView } from './views';
import { Loading } from '../ui/Loading';
import { TexText } from '../ui/tex/Tex';

/* 2026-10-22 (Schritt 12) — erst geladen, wenn jemand ein Storyboard spielt (es bringt die Bausteine der Seiten mit). */
const PresentationInNauka = lazy(() => import('../pages/presentation/PresentationInNauka'));

/** Woher der Inhalt eines Ablaufs kommt — die Baza wiedzy (2026-10-22, Schritt 8: auch auf einer Seite; keine Abschriften mehr). */
export interface FlowContent {
  readonly entity: (id: string) => PublicEntity | null;
  readonly card: (id: string) => Card | null;
  readonly flow: (id: string) => Flow | undefined;
  readonly members: (collectionOrKind: string) => readonly string[];
  /** Karten eines Eintrags — für seine Kenntnis (2026-11-03: seine eigenen und die Pytania über ihn, „O czym"). */
  readonly cardsOf: (id: string) => readonly Card[];
  /** 2026-11-03 (F) — was direkt vor einem Eintrag zu können ist (die eine Reihenfolge des Lernens) und sein Name. */
  readonly needsOf?: (id: string) => readonly string[];
  readonly label?: (id: string) => string;
  /** 2026-11-03 (G) — ein Eintrag aus Kennung oder @name, und alle Karten der Baza (die Ścieżka einer Präsentation). */
  readonly resolve?: (ref: string) => string | null;
  readonly cards?: readonly Card[];
  /** 2026-11-04 (Prompt 10) — die Zusammenführungen der Baza: alte Antworten zählen für die neue Karte. */
  readonly rename?: (key: string) => string;
  /** 2026-11-04 — die Sprache der Baza (`lang.ts`). */
  readonly lang?: Lang;
  /** 2026-11-04 (Prompt 11) — ein Ablauf aus Kennung oder @name (die Bedingung „Przebieg" nennt ihn so). */
  readonly flowRef?: (ref: string) => string | null;
  /** 2026-11-04 (Prompt 11) — ist dieser Eintrag eine Frage (ihr Text ist nie ein Name auf der Ścieżka)? */
  readonly isQuestion?: (id: string) => boolean;
}

export function contentOfLibrary(lib: CogitaLibrary, cards: readonly Card[]): FlowContent {
  const find = (id: string) => {
    const e = lib.docs('flow').find((one) => one.id === id);
    return e === undefined ? undefined : resolveFlow(readFlow(e.id, e.data), (x) => { const f = lib.docs('flow').find((one) => one.id === x); return f === undefined ? undefined : readFlow(f.id, f.data); });
  };
  return {
    entity: (id) => { const e = lib.entity(id); return e === undefined ? null : publicEntity(lib, e); },
    card: (id) => {
      const e = lib.entity(id);
      if (e !== undefined && e.kinds.includes('question')) return questionCard(e, 'flow');
      return cards.find((c) => c.key === id || c.question === id) ?? null;
    },
    flow: find,
    members: (x) => [...(lib.members(x) ?? new Set(lib.ofKind(x).map((e) => e.id)))],
    /* 2026-11-03 (F/G) — wie überall in Cogita: was einen Eintrag prüft, sind seine Karten und die Pytania über ihn. */
    cardsOf: (id) => cardsAbout(cards, id),
    needsOf: (id) => lib.prerequisites().needs.get(id) ?? [],
    label: (id) => { const e = lib.entity(id); return e === undefined ? id : lib.label(e); },
    resolve: (ref) => { const r = ref.trim(); if (r.startsWith('@')) return lib.byImportRef(r.slice(1))?.id ?? null; return lib.entity(r) !== undefined ? r : null; },
    cards,
    rename: renamer(lib.merges()),
    lang: baseLang(lib),
    flowRef: (ref) => { const r = ref.trim(); if (r.startsWith('@')) return lib.byImportRef(r.slice(1), 'flow')?.id ?? null; return lib.docs('flow').some((d) => d.id === r) ? r : null; },
    isQuestion: (id) => lib.entity(id)?.kinds.includes('question') === true
  };
}

/** 2026-11-03 (F) — was ein Schritt zeigt oder fragt: ein Eintrag; eine Frage — worüber sie ist (sonst sie selbst). */
export const stepEntries = (content: Pick<FlowContent, 'card'>): EntriesOfStep => (n: GraphNode) => {
  const c = n.config;
  switch (n.type) {
    case 'show':
    case 'expand':
    case 'opening': {
      const id = typeof c.of === 'string' ? c.of : '';
      return id === '' ? [] : [id];
    }
    case 'question': {
      const id = typeof c.of === 'string' && c.of !== '' ? c.of : typeof c.card === 'string' ? c.card : '';
      const card = id === '' ? null : content.card(id);
      if (card === null) return [];
      return (card.about ?? []).length > 0 ? [...card.about!] : [card.entity ?? card.question];
    }
    default:
      return [];
  }
};

/**
 * 2026-11-04 (Prompt 11) — WIE DIE ŚCIEŻKA EINER ERZÄHLUNG HEISST UND ZÄHLT, für jeden Gastgeber gleich: Teile in der Sprache
 * der Baza, ein Unterablauf nach seiner Erzählung (mit allem, was sie bringt), eine Frage nach ihrem Thema.
 */
export function storyPathOf(flow: Flow, content: FlowContent, decide?: (node: GraphNode) => string | null) {
  const W = words(content.lang ?? 'pl');
  const label = content.label ?? ((id: string) => content.entity(id)?.label ?? id);
  const base = stepWorkOf(stepEntries(content));
  const topicName = (ref: string): string | null => {
    const about = content.card(ref)?.about?.[0];
    if (about === undefined || content.isQuestion === undefined || content.isQuestion(about)) return null;
    const name = label(about);
    return name === about ? null : name;
  };
  const options = { words: W.partNames, flowName: (id: string) => content.flow(content.flowRef?.(id) ?? id)?.name ?? null, topicName, ...(decide === undefined ? {} : { decide }) };
  const inner = new Map<string, { slides: number; questions: number } | null>();
  const work: WorkOfStep = (node) => {
    if (node.type === 'subflow' || node.type === 'each') {
      const ref = typeof node.config.flow === 'string' ? node.config.flow : '';
      if (!inner.has(ref)) {
        const f = ref === '' ? undefined : content.flow(content.flowRef?.(ref) ?? ref);
        inner.set(ref, f === undefined || f.id === flow.id ? null : storyWork(storyPath(f, base, label, { words: W.partNames })));
      }
      const w = inner.get(ref);
      if (w != null) return { slides: Math.max(1, w.slides), questions: w.questions, shown: [], asked: [] };
    }
    return base(node);
  };
  return storyPath(flow, work, label, options);
}

const PATH_OPEN = 'cg-story-path-open:';
const readOpen = (flow: string): boolean => { try { return sessionStorage.getItem(PATH_OPEN + flow) !== '0'; } catch { return true; } };
const keepOpen = (flow: string, open: boolean): void => { try { sessionStorage.setItem(PATH_OPEN + flow, open ? '1' : '0'); } catch { /* ohne Speicher: offen */ } };
/* 2026-11-04 (Prompt 11) — wie breit die Ścieżka neben einer Erzählung steht (je Browser, für alle Erzählungen). */
const PATH_WIDE = 'cg-story-path-wide';
const readWide = (): number => { try { const v = localStorage.getItem(PATH_WIDE); return v === '0' ? 0 : v === '2' ? 2 : 1; } catch { return 1; } };
const keepWide = (v: number): void => { try { localStorage.setItem(PATH_WIDE, String(v)); } catch { /* ohne Speicher: mittel */ } };

export function FlowPlayer({ flow: given, content, learner, onClose, jumpTo, onAnswer, presentationAs = 'play', gate = true }: {
  flow: Flow;
  content: FlowContent;
  learner: Learner | null;
  onClose?: () => void;
  /**
   * 2026-10-22 (Schritt 12) — ein Storyboard: hier spielen (Nauka) oder nur
   * hinführen (`link` — ein Baustein auf einer Seite: die Präsentation IST eine Seite).
   */
  presentationAs?: 'play' | 'link';
  /** Ein Schritt, der von aussen geöffnet wird (ein Auslöser im Spiel [J6]). */
  jumpTo?: { readonly step: string; readonly at: number } | null;
  /** Jede Antwort auch nach aussen (eine Sitzung mit Code sammelt sie für den Gastgeber). */
  onAnswer?: (step: string, card: Card, correctness: number, given: unknown) => void;
  /** 2026-11-03 (Prompt 5) — vor einer Erzählung ihre Sperre prüfen (aus nur in einer Sitzung, die der Gastgeber führt). */
  gate?: boolean;
}) {
  const flow = useMemo(() => resolveFlow(given, content.flow), [given, content]);
  /* Ein Ablauf beim Namen: der gegebene selbst (vielleicht ungespeichert), sonst der der Baza. */
  const flowOf = (id: string): Flow | undefined => (id === flow.id ? flow : content.flow(content.flowRef?.(id) ?? id));
  const cg = useContext(CogitaContext);
  const W = words(content.lang ?? 'pl');

  /*
    2026-11-04 (Prompt 10) — DIE KENNTNIS AUS DER GANZEN GESCHICHTE: alle Antworten des Lernenden auf diese Karte (aus jeder
    Erzählung, jeder Powtórka, jedem Üben — mit den Zusammenführungen der Baza), gleich nach jeder Antwort neu. Eine Frage
    zählt mit IHRER Karte (der, die ihr Schritt fragt), nicht mit dem Mittel über alles, was über sie ist; was keine Karte
    hat, hält nichts auf. Vorher konnte „Już umie?" so nie wahr werden, und der Przegląd lief im Kreis.
  */
  const marksOf: MarksOf | null = learner === null ? null : (card) => learner.marks(card.key, card.fingerprint, content.rename);
  const ownCard = (id: string): Card | null => { const c = content.card(id); return c !== null && (c.question === id || c.entity === id || c.key === id) ? c : null; };
  /* 2026-11-04 (Prompt 11) — in diesem Lauf zu Ende erzählt: die Bedingung „Przebieg" sieht es sofort. */
  const doneHere = useRef(new Set<string>());
  const flowFacts = (ref: string): FlowFacts | undefined => {
    const target = flowOf(ref);
    if (target === undefined) return undefined;
    const kept = learner === null ? undefined : flowFactsOf(learner.progress.positions, [{ id: target.id, ...(target.presentation === undefined ? {} : { presentation: target.presentation }) }]).get(target.id);
    return doneHere.current.has(target.id) ? { started: true, done: true, goals: kept?.goals ?? [] } : kept;
  };
  const facts = (s: FlowState): Facts => ({
    values: s.values,
    knowness: (id) => (marksOf === null ? 0 : flowKnowness(id, ownCard(id), content.cardsOf(id), marksOf)),
    answered: (id) => {
      if (learner === null) return null;
      const card = content.card(id);
      if (card === null) return null;
      const marks = learner.marks(card.key, card.fingerprint);
      return marks.length === 0 ? null : marks[marks.length - 1].correctness;
    },
    visited: new Set(s.visited),
    now: new Date(),
    flow: flowFacts
  });
  /* Die Regel des Spielers: was der Lernende kann, wird nicht gefragt (still, über „dobrze"). */
  const ctx: PlayContext = { facts, flows: flowOf, members: content.members, skip: (node) => skipStep(node, content.card, marksOf) };

  const saved = learner?.progress.positions.get(flow.id);
  /* 2026-11-03 (G) — wer wiederkommt, steht, wo er war — mit den Kapiteln, die er schon durch hat. */
  const [run, setRun] = useState<StoryRun>(() => startRun(flow, { values: learner?.progress.values ?? {}, at: saved?.step ?? null, chapters: chaptersOf(saved?.chapters) }, ctx));
  const runRef = useRef(run);
  const state = run.state;
  const running = flowOf(state.flow) ?? flow;
  const root = flowOf(run.root) ?? flow;
  const trail = state.stack.map((x) => flowOf(x.flow)).filter((f): f is Flow => f !== undefined);
  const current = state.step === null ? undefined : running.graph.nodes.find((n) => n.id === state.step);
  const [answeredOn, setAnsweredOn] = useState<{ step: string; correct: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const keepTimer = useRef<number | null>(null);
  const look: LookType = running.look;

  /** Eine Erzählung ist eben zu Ende gegangen (ein Weg in ihr, eine Übergabe): gemerkt als ukończona, mit ihren Zielen. */
  const keepFinished = (list: readonly StoryFinished[], after: FlowState) => {
    for (const f of list) {
      doneHere.current.add(f.flow);
      if (learner === null) continue;
      const story = flowOf(f.flow);
      const had = learner.progress.positions.get(f.flow);
      const reached = story === undefined ? [] : goalsReached(story, facts({ ...after, visited: f.visited }));
      void learner.keepPosition({
        flow: f.flow, step: f.step, visited: f.visited, at: Date.now(), done: true,
        ...(reached.length > 0 || (had?.goals?.length ?? 0) > 0 ? { goals: mergeGoals(had?.goals, reached) } : {})
      }).catch(() => undefined);
    }
  };
  const commit = (step: RunStep) => {
    runRef.current = step.run;
    setRun(step.run);
    if (step.finished.length > 0) keepFinished(step.finished, step.run.state);
  };
  const W_returned = W.returned;

  /* Wie viele Fragen diese Erzählung schon gestellt hat (für den Balken); was eben gefragt wurde (für den Przerywnik). */
  const [askedHere, setAskedHere] = useState(0);
  /* Jeder Schritt weiter ist ein neuer Besuch: dieselbe Frage wieder ist eine neue Karte (nicht die alte Rückmeldung). */
  const [visit, setVisit] = useState(0);
  const [lastAsked, setLastAsked] = useState<{ readonly key: string; readonly wrong: boolean } | null>(null);
  const [spacerDone, setSpacerDone] = useState<string | null>(null);
  /* Eine neue Erzählung: ihr eigener Zähler. */
  useEffect(() => { setAskedHere(0); setLastAsked(null); setSpacerDone(null); }, [running.id]);

  /* Ein anderer Ablauf von aussen (ohne neuen Spieler): er beginnt, wo der Lernende in ihm war. */
  const startedWith = useRef(flow.id);
  useEffect(() => {
    if (startedWith.current === flow.id) return;
    startedWith.current = flow.id;
    const kept = learner?.progress.positions.get(flow.id);
    commit({ run: startRun(flow, { values: learner?.progress.values ?? {}, at: kept?.step ?? null, chapters: chaptersOf(kept?.chapters) }, ctx), finished: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.id]);

  useEffect(() => {
    if (jumpTo == null || !flow.graph.nodes.some((n) => n.id === jumpTo.step)) return;
    const s = runRef.current.state;
    const mine = s.flow === flow.id && s.stack.length === 0;
    commit({ run: { root: flow.id, outer: [], state: enterAt(flow, { ...s, flow: flow.id, stack: [], chapter: null, queue: undefined, visited: mine ? s.visited : [] }, jumpTo.step, ctx) }, finished: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo?.at, jumpTo?.step, flow]);

  /* 2026-11-04 (Prompt 10) — steht der Lernende (Anfang, gemerkte Stelle, Sprung) auf einer Frage, die er kann: still weiter. */
  useEffect(() => {
    if (current !== undefined && current.type === 'question' && skipStep(current, content.card, marksOf)) commit(stepRun(runRef.current, flowOf, 'right', ctx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.flow]);

  /* Unterabläufe, Übergaben und „dla każdego" gehen von selbst hinein. */
  useEffect(() => {
    if (current !== undefined && (current.type === 'subflow' || current.type === 'each' || current.type === 'handoff')) commit(stepRun(runRef.current, flowOf, undefined, ctx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.flow]);

  /*
    Wo er steht, bleibt — kurz nach jedem Schritt, nicht bei jedem Klick, für die Erzählung, die läuft. 2026-11-03 (G): mit
    den Kapiteln, die durch sind, ob er ein Ende erreicht hat (bleibt, auch wenn er von vorn beginnt) und den erreichten
    Zielen — die Bedingung „Przebieg" liest es in Widoki, Powtórki und im Krajobraz.
  */
  const reachedNow = goalsReached(running, facts(state));
  const goalsKey = reachedNow.join('|');
  useEffect(() => {
    if (learner === null || state.step === null) return undefined;
    if (keepTimer.current !== null) window.clearTimeout(keepTimer.current);
    const done = state.ended && state.stack.length === 0;
    keepTimer.current = window.setTimeout(() => {
      const had = learner.progress.positions.get(running.id);
      void learner.keepPosition({
        flow: running.id, step: state.step ?? '', visited: state.visited, at: Date.now(),
        chapters: chaptersKept(state.chapters),
        ...(done || had?.done === true ? { done: true } : {}),
        ...(reachedNow.length > 0 || (had?.goals?.length ?? 0) > 0 ? { goals: mergeGoals(had?.goals, reachedNow) } : {})
      }).catch(() => undefined);
      if (JSON.stringify(state.values) !== JSON.stringify(learner.progress.values)) void learner.keepValues(state.values).catch(() => undefined);
    }, done ? 0 : 1200);
    return () => { if (keepTimer.current !== null) window.clearTimeout(keepTimer.current); };
  }, [learner, running.id, state.step, state.visited, state.values, state.ended, state.chapters, goalsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (exit?: string) => {
    setAnsweredOn(null);
    setVisit((v) => v + 1);
    const was = runRef.current.state.flow;
    const step = stepRun(runRef.current, flowOf, exit, ctx);
    const after = flowOf(step.run.state.flow) ?? flow;
    const said = markSaid(step.run.state, linesNow(after, step.run.state, facts(step.run.state)));
    /* Zurück aus einer gerufenen Erzählung: ein Satz, wohin es weitergeht. */
    const back = step.finished.find((f) => f.flow === was && was !== step.run.state.flow);
    setNotice(back === undefined ? null : W_returned(flowOf(back.flow)?.name ?? '', after.name));
    commit({ ...step, run: { ...step.run, state: said } });
  };
  const lines = linesNow(running, state, facts(state));
  const reached = reachedNow;

  /* Von vorn: die laufende Erzählung (eine gerufene: in ihr, die rufende wartet weiter). */
  const restart = () => {
    setNotice(null);
    const s = runRef.current.state;
    if (s.stack.length === 0) { commit({ run: startRun(running, { values: learner?.progress.values ?? s.values }, ctx), finished: [] }); return; }
    commit({ run: { ...runRef.current, state: enterAt(running, { ...s, visited: [], chapters: {}, chapter: null }, running.start, ctx) }, finished: [] });
  };
  /*
    2026-11-03 (Prompt 5) — DER PRZEGLĄD: welche Ziele erreicht sind (gemerkt und jetzt), und „Powtórz przegląd" — zum
    Schritt, an dem er beginnt (`review`), ohne ihn an den Anfang.
  */
  const goalsHeld = mergeGoals(learner?.progress.positions.get(running.id)?.goals, reachedNow);
  const reviewOpen = running.goals.length > 0 && !running.goals.every((g) => goalsHeld.includes(g.id));
  const reviewStep = running.review !== undefined && running.graph.nodes.some((n) => n.id === running.review) ? running.review : running.start;
  const toReview = () => {
    if (reviewStep === null) { restart(); return; }
    setAnsweredOn(null);
    const s = runRef.current.state;
    commit({ run: { ...runRef.current, state: enterAt(running, { ...s, chapter: null }, reviewStep, ctx) }, finished: [] });
  };

  /*
    2026-11-04 — DIE KARTE AUS DEN TEILEN DER ERZÄHLUNG (`storyPath.ts`): Lesen, Fragen, Przegląd, Gabeln, Anfang und Ende —
    jetzt dran ist der Teil des Schrittes; über einer Möglichkeit leuchtet ihre Spur; ein zweites Tippen springt dorthin.
    2026-11-04 (Prompt 11) — die der laufenden Erzählung; ein Warunek, der jetzt schon entschieden ist, zeigt nur seinen Weg.
  */
  const decide = learner === null ? undefined : decideBy(facts(state));
  const decideKey = decide === undefined ? '' : running.graph.nodes.filter((n) => n.type === 'condition').map((n) => decide(n) ?? '?').join('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sp = useMemo(() => storyPathOf(running, content, decide), [running, content, decideKey]);
  const pathModelNow = sp.model;
  const chapterAt = useMemo(() => chapterOfSteps(sp), [sp]);
  const knowNow = learner === null ? undefined : (id: string) => {
    if (content.cardsOf(id).length === 0) return { learned: true, due: false };
    const k = facts(state).knowness(id);
    return { learned: k >= 0.1 - 1e-12, due: k >= 0.1 - 1e-12 && k < 1 };
  };
  /* 2026-11-04 (Prompt 10) — gezählt wird, was wirklich gefragt wird: eine gekonnte Frage wird übersprungen. */
  const stepNode = useMemo(() => new Map(running.graph.nodes.map((n) => [n.id, n] as const)), [running]);
  const knownStep = marksOf === null ? undefined : (s: string): boolean => { const n = stepNode.get(s); return n !== undefined && skipStep(n, content.card, marksOf); };
  const pathNow = storyMarks(sp, { visited: state.visited, ended: state.ended, step: state.step, ...(knowNow === undefined ? {} : { know: knowNow }), ...(knownStep === undefined ? {} : { knownStep }), chapters: state.chapters });
  const [hovered, setHovered] = useState<ReadonlySet<string> | null>(null);
  /* Im Kapitel bleibt seine Spur hervorgehoben. */
  const inChapter = state.chapter === null ? null : branchIds(sp, state.chapter.hub, `c${state.chapter.index}`);
  const lightOf = (step: string, exit: string) => ({
    onPointerEnter: () => setHovered(branchIds(sp, step, exit)),
    onPointerLeave: () => setHovered(null),
    onFocus: () => setHovered(branchIds(sp, step, exit)),
    onBlur: () => setHovered(null)
  });
  const [pathOpen, setPathOpen] = useState(() => readOpen(flow.id));
  const [pathWide, setPathWide] = useState(readWide);
  /*
    2026-11-03 (Prompt 5) — DIE SPERRE VOR EINER ERZÄHLUNG (`storyLock.ts`, die Logik des Krajobraz): fehlt vor ihrer Einheit
    noch etwas, steht ein Bildschirm davor — was fehlt, in der Reihenfolge des Weges, mit Links und „Ucz się", dazu „Ustaw
    jako cel"; sind nur Karten der Kette schwach, „Najpierw powtórz (N)" mit genau diesen Karten, danach weiter zur
    Erzählung. Wer in der Baza schreibt, darf sie trotzdem ansehen („Podgląd mimo to"). Geprüft wird die eigene Erzählung
    des Laufs (nicht eine, die ein Weg in ihr ruft).
  */
  const [unlocked, setUnlocked] = useState(false);
  const [lockRun, setLockRun] = useState<{ readonly key: string; readonly source: RunSource; readonly weak: boolean } | null>(null);
  const [lockTick, setLockTick] = useState(0);
  const [goalSet, setGoalSet] = useState(false);
  /* 2026-11-04 (Prompt 11) — ein Thema nach „Koniec": eine Powtórka hier, danach zurück zum Ende. */
  const [topicRun, setTopicRun] = useState<{ readonly key: string; readonly source: RunSource } | null>(null);
  const progressNow = learner?.progress;
  /*
    2026-11-04 (Prompt 11) — die Sperre und was danach kommt mit EINER Rechnung der Kenntnis (neu nach jeder Antwort): die
    Sperre für die eigene Erzählung des Laufs, die Nachfolger nur für sie (eine gerufene führt zurück in die rufende).
  */
  const lockUnit = !gate || unlocked || learner === null || root.unit === undefined || cg === null || content.cards === undefined || cg.lib.entity(root.unit) === undefined ? null : root.unit;
  const around = useMemo(() => {
    if (cg === null || content.cards === undefined || learner === null) return { lock: OPEN_LOCK, next: null };
    const after = state.stack.length > 0 ? null : { flow: running, taught: [...new Set(sp.parts.flatMap((p) => [...p.shown, ...p.asked]))] };
    return storyAround(cg.lib, content.cards, learner, lockUnit, after);
  }, [cg, cg?.lib.revision, content.cards, learner, progressNow, lockUnit, lockTick, running, sp, state.stack.length, state.ended]); // eslint-disable-line react-hooks/exhaustive-deps
  const lock = around.lock;
  const jumpToStep = (step: string | null) => {
    if (step === null) return;
    const ch = chapterAt.get(step);
    setAnsweredOn(null);
    setHovered(null);
    setNotice(null);
    const s = runRef.current.state;
    const base: FlowState = { ...s, ended: false, chapter: ch === undefined ? null : { hub: ch.hub, index: Number(ch.exit.slice(1)), start: follow(running, ch.hub, ch.exit) ?? step } };
    commit({ run: { ...runRef.current, state: enterAt(running, base, step, ctx) }, finished: [] });
  };

  /*
    2026-11-04 (Prompt 11) — WAS NACH DIESER ERZÄHLUNG KOMMT (`storyNext.ts`): ihre Nachfolger in der Reihenfolge des Lernens,
    wählbar nur, was jetzt möglich ist; sonst das nächste lernbare Feld, sonst zurück zur Karte. Nur für die eigene
    Erzählung des Laufs (eine gerufene führt zurück in die rufende).
  */
  const name = (id: string) => content.label?.(id) ?? content.entity(id)?.label ?? id;
  const ahead = around.next;
  const startStory = (next: Flow) => {
    /*
      Nennt die Adresse die Erzählung, die eben zu Ende ging („…/przebiegi/<id>/graj“), nennt sie nun die neue: neu laden,
      zurück und ein Link zeigen dann dasselbe wie der Spieler (der Gastgeber öffnet sie über die Adresse).
    */
    const hash = typeof window === 'undefined' ? '' : window.location.hash;
    const named = `/przebiegi/${run.root}/graj`;
    if (hash.includes(named) && next.id !== run.root) { window.location.hash = hash.replace(named, `/przebiegi/${next.id}/graj`); return; }
    setNotice(null);
    setAnsweredOn(null);
    setUnlocked(false);
    setLockTick((n) => n + 1);
    const kept = learner?.progress.positions.get(next.id);
    commit({ run: startRun(next, { values: runRef.current.state.values, at: kept?.done === true ? null : kept?.step ?? null, chapters: chaptersOf(kept?.chapters) }, ctx), finished: [] });
  };
  const startTopic = (id: string) => {
    const all = content.cards ?? [];
    const list = cardsAbout(all, id);
    if (list.length === 0) return;
    setTopicRun({ key: `next:${id}:${Date.now()}`, source: { plan: readPlan(list, { mode: 'temporal', order: 'general', pick: 'next', stackSize: 20, endWhenDone: true }), cards: all, title: name(id) } });
  };
  /* Was bei jedem Nachfolger wartet (eine Erzählung: ihre Bilder und Fragen; ein Thema: seine Fragen) — einmal je Stand. */
  const nextWork = useMemo(() => {
    const out = new Map<string, { readonly flow?: Flow; readonly work: string }>();
    if (ahead === null) return out;
    for (const n of [...ahead.next, ...(ahead.nearest === null ? [] : [ahead.nearest])]) {
      const found = n.kind === 'story' ? ahead.stories.get(n.id) : undefined;
      const story = found === undefined ? undefined : flowOf(found.id) ?? found;
      const work = story !== undefined && story.presentation === undefined ? (() => { const w = storyWork(storyPathOf(story, content)); return W.workShort(w.slides, w.questions); })()
        : n.kind === 'story' ? W.story : W.questions(cardsAbout(content.cards ?? [], n.id).length);
      out.set(n.id, { ...(story === undefined ? {} : { flow: story }), work });
    }
    return out;
  }, [ahead, content]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextStep = (id: string, kind: 'story' | 'topic', ready: boolean, missing: readonly string[], due: readonly string[], note?: string): PathNext => {
    const story = nextWork.get(id)?.flow;
    const work = nextWork.get(id)?.work ?? '';
    const names = (list: readonly string[]) => list.map((x) => (x === running.unit ? running.name : name(x))).slice(0, 4).join(', ');
    return {
      id, label: story?.name ?? name(id), kind, ready, work, ...(note === undefined ? {} : { note }),
      why: [missing.length > 0 ? W.needsFirst(names(missing)) : '', due.length > 0 ? W.dueFirst(names(due)) : ''].filter(Boolean),
      ...(ready ? { action: { label: kind === 'story' ? W.startStory : W.learn, run: () => { if (story !== undefined) startStory(story); else startTopic(id); } } } : {})
    };
  };
  const nextItems: PathNext[] | undefined = ahead === null ? undefined : (() => {
    const list = ahead.next.map((n) => nextStep(n.id, n.kind, n.ready, n.missing, n.due));
    if (!ahead.next.some((n) => n.ready)) {
      if (ahead.nearest !== null) list.unshift(nextStep(ahead.nearest.id, ahead.nearest.kind, true, [], [], W.nearest));
      else if (onClose !== undefined) list.unshift({ id: '~map', label: W.backToMap, kind: 'map', ready: true, action: { label: W.backToMap, run: onClose } });
    }
    return list;
  })();

  const withPath = (story: ReactNode): ReactNode => (pathModelNow.nodes.length < 2 ? story : (
    <div className="cg-story-path" data-story-path="" data-story-running={running.id}>
      <div className={`cg-story-path-grid has-path${pathOpen ? '' : ' is-closed'} is-w${pathWide}`}>
        {story}
        <div className="cg-story-path-side">
          <PathMap model={pathModelNow} marks={pathNow} size="small" words={W} collapsible open={pathOpen} title={`${W.pathTitle}: ${running.name}`}
            onOpen={(v) => { setPathOpen(v); keepOpen(flow.id, v); }} highlight={hovered ?? inChapter} {...(nextItems === undefined ? {} : { next: nextItems })}
            tools={(
              <span className="cg-pm-tools cg-story-path-width" role="group" aria-label={W.pathTitle}>
                <button type="button" className="cg-pm-tool is-text" disabled={pathWide === 0} onClick={() => { const v = Math.max(0, pathWide - 1); setPathWide(v); keepWide(v); }} data-story-path-narrow="">{W.narrow}</button>
                <button type="button" className="cg-pm-tool is-text" disabled={pathWide === 2} onClick={() => { const v = Math.min(2, pathWide + 1); setPathWide(v); keepWide(v); }} data-story-path-wide="">{W.widen}</button>
              </span>
            )}
            onPick={(id) => { const part = sp.parts[sp.model.index.get(id) ?? -1]; if (part !== undefined && part.kind !== 'end') jumpToStep(part.kind === 'start' ? running.start : part.first); }} />
        </div>
      </div>
    </div>
  ));
  /* 2026-10-22 (Schritt 12) — wer gerade erzählt: der erste Erzähler, dessen Bedingung gilt. */
  const narratorOf = (f: Facts): PublicEntity | null => {
    const one = narratorNow(running, f);
    return one === null ? null : content.entity(one.character);
  };

  if (topicRun !== null && cg !== null) {
    const back = () => setTopicRun(null);
    return <RevisionRun key={topicRun.key} lib={cg.lib} learner={learner} source={topicRun.source} onClose={back} onDone={back}
      closing={{ openTopic: (id) => { const story = ahead?.stories.get(id); setTopicRun(null); if (story !== undefined) startStory(story); else startTopic(id); }, back, label: name }} />;
  }

  if ((lock.missing.length > 0 || lock.weak.length > 0) && cg !== null) {
    /* Nach „Najpierw powtórz" weiter zur Erzählung (wie im Krajobraz); nach „Ucz się" an einem fehlenden Eintrag neu geprüft. */
    const back = () => { const weak = lockRun?.weak === true; setLockRun(null); if (weak) setUnlocked(true); else setLockTick((n) => n + 1); };
    if (lockRun !== null) return <RevisionRun key={lockRun.key} lib={cg.lib} learner={learner} source={lockRun.source} onClose={back} onDone={back} />;
    const all = content.cards ?? [];
    const runOf = (title: string, list: readonly Card[], weak: boolean) => {
      if (list.length === 0) return;
      setLockRun({ key: `lock:${Date.now()}`, weak, source: { plan: readPlan(list, { mode: 'temporal', order: 'general', pick: 'next', stackSize: 20, endWhenDone: true }), cards: all, title } });
    };
    const inWorkspace = typeof window !== 'undefined' && window.location.hash.startsWith('#/workspace');
    const landscapes = cg.lib.docs('view').filter((d) => readView(d.data).mode === 'landscape');
    const setGoal = () => {
      if (learner === null || root.unit === undefined) return;
      for (const v of landscapes) void learner.keepPosition({ flow: `landscape:${v.id}`, step: root.unit, visited: [], at: Date.now() }).catch(() => undefined);
      setGoalSet(true);
    };
    const missing = lock.missing.length > 0;
    return (
      <section className="cg-flow cg-flow-locked" data-flow-locked={missing ? 'missing' : 'weak'}>
        <div className="cg-flow-step">
          <h2><TexText text={root.name} /></h2>
          {missing ? (
            <>
              <p><strong>Ta opowieść jest jeszcze zamknięta.</strong> Otworzy się, gdy poznasz to, co trzeba znać przed nią — od podstaw:</p>
              <ol className="cg-flow-missing" data-flow-missing={lock.missing.length}>
                {lock.missing.map((id) => {
                  const origin = cg.lib.origin(id);
                  const own = cardsAbout(all, id);
                  return (
                    <li key={id} data-flow-missing-item={id}>
                      {inWorkspace && origin !== undefined ? <a className="cg-ref" href={originPath(origin, id, 'wpisy')}><TexText text={name(id)} /></a> : <TexText text={name(id)} />}
                      {learner !== null && own.length > 0 && <> · <button type="button" className="wk-link-btn" onClick={() => runOf(name(id), own, false)} data-flow-missing-learn={id}>Ucz się</button></>}
                    </li>
                  );
                })}
              </ol>
              {learner !== null && landscapes.length > 0 && (
                <div className="wk-actions">
                  <button type="button" className="wk-btn" onClick={setGoal} disabled={goalSet} data-flow-goal="">{goalSet ? 'Cel ustawiony' : 'Ustaw jako cel'}</button>
                </div>
              )}
              {goalSet && <p className="cg-muted" role="status">W krajobrazie ta lekcja jest teraz Twoim celem — z ponumerowaną drogą do niej.</p>}
            </>
          ) : (
            <>
              <p>Wszystko, czego ta opowieść wymaga, już poznałeś — ale {lock.weak.length === 1 ? 'jedną kartę' : `${lock.weak.length} kart`} z tego warto najpierw powtórzyć.</p>
              <div className="wk-actions">
                <button type="button" className="wk-btn" onClick={() => runOf(`Najpierw powtórka: ${root.name}`, lock.weak, true)} data-flow-review-first={lock.weak.length}>Najpierw powtórz ({lock.weak.length})</button>
              </div>
            </>
          )}
          <div className="wk-actions">
            {cg.writes && <button type="button" className="wk-link-btn" onClick={() => setUnlocked(true)} data-flow-preview="">Podgląd mimo to</button>}
            {onClose !== undefined && <button type="button" className="wk-link-btn" onClick={onClose}>{W.back}</button>}
          </div>
        </div>
      </section>
    );
  }

  /* 2026-10-22 (Schritt 12) — ein Storyboard: die Präsentation spielt selbst; der Ablauf bringt den Lernenden und die Erzähler mit. */
  if (root.presentation !== undefined) {
    if (presentationAs === 'link') {
      return (
        <section className="cg-flow">
          <div className="cg-flow-step">
            <h2><TexText text={root.name} /></h2>
            <p className="cg-muted">Ten przebieg jest prezentacją.</p>
            <div className="wk-actions"><a className="wk-btn" href={`#/${root.presentation}`}>Otwórz prezentację</a></div>
          </div>
        </section>
      );
    }
    return (
      <Suspense fallback={<Loading />}>
        <PresentationInNauka key={root.id} name={root.name} path={root.presentation} learner={learner} onClose={onClose} content={content} unit={root.unit ?? null}
          startAt={jumpTo == null || root.id !== flow.id ? null : { scene: jumpTo.step, at: jumpTo.at }}
          narrator={root.narrators.length === 0 ? undefined : (f) => <Narrator who={(() => { const one = narratorNow(root, f); return one === null ? null : content.entity(one.character); })()} says={null} />} />
      </Suspense>
    );
  }

  if (state.ended || current === undefined) {
    /*
      2026-11-04 (Prompt 11) — DAS ENDE: was nach dieser Erzählung kommt — EIN grosser Knopf zum naheliegenden Nächsten (das
      erste, was jetzt möglich ist; sonst das nächste Feld der Karte; sonst zurück zur Karte), die anderen klein, was noch
      nicht geht mit dem Grund. Ist der Przegląd offen, bleibt „Powtórz przegląd" der grosse Knopf.
    */
    const choices = nextItems ?? [];
    const first = choices.find((x) => x.ready && x.action !== undefined);
    const others = choices.filter((x) => x !== first && x.ready && x.action !== undefined);
    const waiting = choices.filter((x) => !x.ready);
    return withPath(
      <section className={`cg-flow cg-flow-${look}`} data-flow-ended={running.id}>
        <div className="cg-flow-step">
          <h2 data-flow-title={running.id}>{W.storyEnd} — <TexText text={running.name} /></h2>
          {running.goals.length > 0 && <Goals flow={running} reached={goalsHeld} />}
          {running.goals.length > 0 && (
            <p className={reviewOpen ? 'wk-note' : 'cg-muted'} data-flow-review={reviewOpen ? 'open' : 'passed'}>
              {reviewOpen ? W.reviewNotPassed : W.reviewPassed}
            </p>
          )}
          {choices.length > 0 && (
            <div className="cg-flow-next" data-flow-next={choices.length}>
              <p className="cg-run-closing-h">{W.whatNext}</p>
              <div className="wk-actions">
                {reviewOpen && <button type="button" className="wk-btn" onClick={toReview} data-flow-review-again="">{W.reviewAgain}</button>}
                {first !== undefined && (
                  <button type="button" className={reviewOpen ? 'wk-btn wk-btn-line' : 'wk-btn cg-run-next'} onClick={first.action!.run} data-flow-next-go={first.id} data-flow-next-kind={first.kind}>
                    {first.kind === 'map' ? first.label : W.nextGo(first.label)}{first.work !== undefined && first.kind !== 'map' ? <span className="cg-flow-next-work"> · {first.work}</span> : null}
                  </button>
                )}
                {others.map((x) => <button key={x.id} type="button" className="wk-btn wk-btn-line" onClick={x.action!.run} data-flow-next-other={x.id}>{x.label}</button>)}
              </div>
              {waiting.length > 0 && (
                <ul className="cg-flow-next-wait" data-flow-next-wait={waiting.length}>
                  {waiting.map((x) => <li key={x.id} data-flow-next-wait-item={x.id}><strong>{x.label}</strong> <span className="cg-muted">· {x.work} · {(x.why ?? []).join(' · ')}</span></li>)}
                </ul>
              )}
            </div>
          )}
          <div className="wk-actions">
            {reviewOpen && choices.length === 0 && <button type="button" className="wk-btn" onClick={toReview} data-flow-review-again="">{W.reviewAgain}</button>}
            <button type="button" className={reviewOpen || first !== undefined ? 'wk-btn wk-btn-line' : 'wk-btn'} onClick={restart}>{W.fromStart}</button>
            {onClose !== undefined && <button type="button" className="wk-link-btn" onClick={onClose}>{W.back}</button>}
          </div>
        </div>
      </section>
    );
  }

  const c = current.config;
  const title = typeof c.title === 'string' && c.title !== '' ? c.title : null;
  const item = state.item === undefined ? null : content.entity(state.item);
  /* Mit einem Erzähler sagt er den Titel des Schritts an (er steht dann nicht noch einmal darunter). */
  const teller = narratorOf(facts(state));

  const body = (() => {
    switch (current.type) {
      case 'show':
      case 'expand':
      case 'opening': {
        const id = typeof c.of === 'string' ? c.of : typeof c.explain === 'string' ? c.explain : state.item ?? '';
        const media = typeof c.media === 'object' && c.media !== null ? c.media as MediaRef : null;
        return (
          <>
            {current.type === 'opening' && <p className="cg-muted">{c.mode === 'discovery' ? 'Zanim przeczytasz — jak myślisz?' : 'Przypomnij sobie:'}</p>}
            {media !== null && <MediaView media={media} />}
            {id !== '' && <EntityView entity={content.entity(current.type === 'expand' && typeof c.explain === 'string' ? c.explain : id)} />}
            <Next label={W.goOn} onNext={() => go('next')} />
          </>
        );
      }
      case 'question': {
        const card = askedCardOf(current, content.card);
        if (card === null) return <><p className="wk-hint">Tego pytania tu nie ma.</p><Next label={W.goOn} onNext={() => go('right')} /></>;
        const left = questionsLeft(running, current.id, content.card, marksOf).left;
        /* Dieselbe Frage wie eben, nach einer falschen Antwort: erst ein Przerywnik (eine gekonnte), dann sie wieder. */
        /* Nur beim Wiederkommen — nicht, solange die Rückmeldung zur eben falschen Antwort steht. */
        const back = answeredOn === null || answeredOn.step === `spacer:${current.id}`;
        const spacer = back && marksOf !== null && lastAsked !== null && lastAsked.key === card.key && lastAsked.wrong && spacerDone !== card.key
          ? pickSpacer(card, cardsInFlow(running, content.card), content.cards ?? [], marksOf) : null;
        const shown = spacer ?? card;
        return (
          <>
            <AskHead W={W} left={left} done={askedHere} card={shown} spacer={spacer !== null} marks={marksOf} topic={(id) => content.label?.(id) ?? content.entity(id)?.label ?? id} story={running.name} />
            <CardFace key={`${shown.key}:${spacer !== null ? 's' : 'q'}:${visit}`} card={shown}
              onAnswered={(outcome, given) => {
                /* Ein Przerywnik ändert den Plan nur, wenn er falsch beantwortet wird. */
                if (spacer !== null) { if (!outcome.correct) learner?.record(shown, outcome.correctness, { via: running.id }); setAnsweredOn({ step: `spacer:${current.id}`, correct: outcome.correct }); return; }
                /* 2026-11-01 — mit der Antwort: Podpowiedzi und gezogene Werte (wie in einer Powtórka). */
                learner?.record(card, outcome.correctness, { via: running.id, ...(outcome.hints === undefined ? {} : { hints: outcome.hints }), ...(card.params === undefined ? {} : { params: card.params }) });
                onAnswer?.(current.id, card, outcome.correctness, given);
                setAnsweredOn({ step: current.id, correct: outcome.correct });
                setAskedHere((n) => n + 1);
                setLastAsked({ key: card.key, wrong: !outcome.correct });
              }}
              onNext={() => {
                if (spacer !== null) { setSpacerDone(card.key); setAnsweredOn(null); return; }
                setSpacerDone(null);
                go(answeredOn?.correct === false ? 'wrong' : 'right');
              }} />
          </>
        );
      }
      case 'choice': {
        /*
          2026-11-04 — DIE WAHL: jede Möglichkeit beim Namen und mit dem, was hinter ihr wartet („3 slajdy do przeczytania ·
          5 pytań do odpowiedzi"); eine, deren Bedingung nicht gilt, steht gesperrt da und sagt, was sie öffnet. Die App
          wählt nie selbst.
        */
        const open = new Set(optionsOf(current, facts(state)).map((o) => o.exit));
        const list = Array.isArray(c.options) ? c.options : [];
        const fork = sp.parts[sp.partOfStep.get(current.id) ?? -1]?.fork;
        return (
          <div className="cg-choices cg-choice-list" data-flow-choice={list.length}>
            <p className="cg-muted">{W.chooseRoad(list.length)}</p>
            {list.map((o, i) => {
              const exit = `o${i}`;
              const label = (typeof o === 'object' && o !== null && typeof (o as { label?: unknown }).label === 'string' ? (o as { label: string }).label : typeof o === 'string' ? o : '') || `możliwość ${i + 1}`;
              const branch = fork?.branches.find((x) => x.exit === exit);
              const work = branch === undefined ? null : branchWork(sp, branch, knownStep);
              const wordsOf = work === null || work.parts === 0 ? '' : W.part({ kind: 'read', slides: work.slides, questions: work.questions }, work.ask);
              /* 2026-11-04 (Prompt 9) — ein Weg, der schon zu Ende gegangen ist, sagt es (er bleibt wählbar). */
              const parts = branch === undefined ? [] : branchParts(sp, branch.to);
              const walked = parts.length > 0 && parts.every((v) => pathNow.state[v] === 'done');
              const cond = typeof o === 'object' && o !== null ? readCondition((o as { condition?: unknown }).condition) : null;
              const locked = !open.has(exit);
              return (
                <button key={exit} type="button" className="cg-option cg-choice-item" disabled={locked} onClick={() => go(exit)} {...lightOf(current.id, exit)} data-flow-option={exit} data-flow-option-locked={locked ? '1' : '0'}>
                  <TexText text={label} />
                  {wordsOf !== '' && <span className="cg-muted" data-flow-option-work="">{wordsOf}</span>}
                  {walked && <span className="cg-muted" data-flow-option-done="">{W.done}</span>}
                  {locked && cond !== null && !holds(cond, facts(state)) && (
                    <span className="cg-muted" data-flow-option-why="">
                      {cond.type === 'not' && cond.items?.length === 1 ? `Zamknięte, bo: ${conditionText(cond.items[0], name)}` : `Zamknięte — otworzy się, gdy: ${conditionText(cond, name)}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        );
      }
      case 'chapters': {
        /*
          2026-11-03 (F) — eine Gabel, die zusammenkommt: was durch ist — in dieser Erzählung oder auf der Karte (jeder Schritt
          seiner Spur gelernt): Erzählung und Karte sagen dasselbe —, und die Spuren, die noch offen sind; sind alle durch, weiter.
        */
        const all = Array.isArray(c.chapters) ? c.chapters.length : 0;
        const fork = sp.parts[sp.partOfStep.get(current.id) ?? -1]?.fork;
        const learnedPath = (exit: string): boolean => {
          const b = fork?.branches.find((x) => x.exit === exit);
          const list = b === undefined ? [] : branchParts(sp, b.to);
          return list.length > 0 && list.every((v) => pathNow.state[v] === 'done');
        };
        const workOf = (exit: string): string => { const b = fork?.branches.find((x) => x.exit === exit); if (b === undefined) return ''; const w = branchWork(sp, b, knownStep); return W.part({ kind: 'read', slides: w.slides, questions: w.questions }, w.ask); };
        const left = chaptersLeft(current, state).filter((ch) => !learnedPath(ch.exit));
        const done = all - left.length;
        return (
          <>
            <p className="cg-muted" data-flow-merge={`${done}/${all}`}>Ukończono {mergeWords(done, all)}{left.length > 0 ? ' — wybierz następną (wszystkie, w dowolnej kolejności):' : '.'}</p>
            {left.length === 0 ? <Next label={W.goOn} onNext={() => go('done')} /> : (
              <div className="cg-choices cg-choice-list">
                {(Array.isArray(c.chapters) ? c.chapters : []).map((one, i) => {
                  const exit = `c${i}`;
                  const chapterTitle = (typeof one === 'object' && one !== null && typeof (one as { title?: unknown }).title === 'string' ? (one as { title: string }).title : typeof one === 'string' ? one : '') || `Rozdział ${i + 1}`;
                  const isLeft = left.some((x) => x.exit === exit);
                  const workWords = workOf(exit);
                  return (
                    <button key={exit} type="button" className={`cg-option cg-choice-item${isLeft ? '' : ' is-done'}`} disabled={!isLeft} onClick={() => go(exit)} {...lightOf(current.id, exit)} data-flow-option={exit} data-flow-option-done={isLeft ? '0' : '1'}>
                      <TexText text={chapterTitle} />
                      <span className="cg-muted">{isLeft ? workWords : 'ukończone'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        );
      }
      case 'line': {
        const who = typeof c.character === 'string' ? content.entity(c.character) : null;
        const said = typeof c.of === 'string' ? content.entity(c.of) : null;
        return (
          <>
            <Bubble who={who} text={said} mood={typeof c.mood === 'string' ? c.mood : null} />
            <Next label={W.goOn} onNext={() => go('next')} />
          </>
        );
      }
      /* Automatische Schritte hält der Spieler nie an (`enterAt`); steht er doch auf einem (alte Stelle): weiter, wie er ausgeht. */
      case 'condition':
        return <Next label={W.goOn} onNext={() => go(holds(readCondition(c.condition), facts(state)) ? 'yes' : 'no')} />;
      case 'set':
        return <Next label={W.goOn} onNext={() => go('next')} />;
      /* 2026-10-22 (Schritt 12) — eine Szene einer Präsentation in einem gewöhnlichen Ablauf: ihr Name und der Weg zu ihr. */
      case 'scene': {
        const page = typeof c.page === 'string' ? c.page.replace(/^#?\/?/, '') : '';
        return (
          <>
            <p className="cg-muted">Scena prezentacji</p>
            {page !== '' && <a className="wk-link" href={`#/${page}`} target="_blank" rel="noopener">Otwórz prezentację</a>}
            <Next label={W.goOn} onNext={() => go('next')} />
          </>
        );
      }
      default:
        return <><p className="cg-muted">{STEP_LABEL[current.type as keyof typeof STEP_LABEL] ?? current.type}</p><Next label={W.goOn} onNext={() => go('next')} /></>;
    }
  })();

  return withPath(
    <section className={`cg-flow cg-flow-${look === 'slides' || look === 'scenes' ? 'slides' : look === 'flashcards' ? 'cards' : 'reading'}`} data-flow-running={running.id}>
      <div className="cg-row-between">
        <span className="cg-flow-title">
          {trail.length > 0 && <span className="cg-muted cg-flow-trail" data-flow-trail={trail.length}>{W.inStory(trail.map((f) => f.name).join(' › '))}</span>}
          <strong data-flow-title={running.id}><TexText text={running.name} /></strong>
        </span>
        <span className="cg-row">
          {running.goals.length > 0 && <span className="cg-muted">{W.goal}: {reached.length}/{running.goals.length}</span>}
          <button type="button" className="wk-link-btn" onClick={restart}>{W.fromStart}</button>
          {onClose !== undefined && <button type="button" className="wk-link-btn" onClick={onClose}>{W.close}</button>}
        </span>
      </div>
      {notice !== null && <p className="cg-muted" role="status" data-flow-returned="">{notice}</p>}
      {lines.length > 0 && (
        <div className="cg-bubbles">
          {lines.map((l) => <Bubble key={`${l.character}:${l.of}`} who={content.entity(l.character)} text={content.entity(l.of)} mood={null} />)}
        </div>
      )}
      {teller !== null && <Narrator who={teller} says={title} />}
      <div className={`cg-flow-step${c.open === 'inline' ? ' cg-flow-inline' : ''}`}>
        {title !== null && teller === null && <h2><TexText text={title} /></h2>}
        {item !== null && <p className="cg-muted"><TexText text={item.label} /></p>}
        {body}
      </div>
    </section>
  );
}

/** Die gemerkten Kapitel (`<auswahl>:<index>`) als Stand. */
function chaptersOf(kept: readonly string[] | undefined): FlowState['chapters'] | undefined {
  if (kept === undefined || kept.length === 0) return undefined;
  const chapters: Record<string, number[]> = {};
  for (const one of kept) {
    const at = one.lastIndexOf(':');
    const i = Number(one.slice(at + 1));
    if (at <= 0 || !Number.isInteger(i) || i < 0) continue;
    (chapters[one.slice(0, at)] ??= []).push(i);
  }
  return chapters;
}

/**
 * 2026-11-04 (Prompt 10) — ÜBER JEDER FRAGE: wie viele noch kommen (nur die, die wirklich gefragt werden), ein dünner Balken,
 * und eine leise Zeile — woher die Frage kommt (Thema, Erzählung) und warum sie jetzt kommt; ein Tippen zeigt mehr.
 */
export function AskHead({ W, left, done, card, spacer, marks, topic, story }: {
  W: ReturnType<typeof words>;
  left: number;
  done: number;
  card: Card;
  spacer: boolean;
  marks: MarksOf | null;
  topic: (id: string) => string;
  story?: string;
}) {
  const [more, setMore] = useState(false);
  const history = marks === null ? [] : marks(card);
  const k = marks === null ? 0 : cardKnow(card, marks);
  const pct = Math.round(Math.min(1, k) * 100);
  const last = history[history.length - 1];
  const why = spacer ? W.whySpacer : history.length === 0 ? W.whyNew : last !== undefined && last.correctness < 0.999 && Date.now() - last.at < 30 * 60_000 ? W.whyMissed
    : marks !== null && isKnown(card, marks) ? W.whyKnown(pct) : k < 0.1 ? W.whyForgotten : W.whyDue(pct);
  const about = (card.about ?? []).filter(Boolean);
  const where = [about.length > 0 ? `${W.topicIs}: ${topic(about[0])}` : '', story !== undefined && story !== '' ? `${W.storyIs}: ${story}` : ''].filter(Boolean).join(' · ');
  const total = Math.max(1, done + left);
  return (
    <div className="cg-askhead" data-ask-left={left} data-ask-spacer={spacer ? '1' : '0'}>
      <div className="cg-askhead-row">
        <strong data-ask-counter="">{W.left(left)}</strong>
        <span className="cg-askhead-bar" aria-hidden><i data-ask-share={(done / total).toFixed(2)} ref={(el) => { if (el !== null) el.style.width = `${Math.round((done / total) * 100)}%`; }} /></span>
      </div>
      <button type="button" className="cg-askhead-why" onClick={() => setMore(!more)} aria-expanded={more} data-ask-why={spacer ? 'spacer' : ''} data-ask-story={story ?? ''}>
        {where !== '' ? `${where} · ` : ''}{why}
      </button>
      {more && (
        <p className="cg-muted" data-ask-more="">
          {W.lastAnswers}: {history.slice(-5).map((m) => (m.correctness >= 0.999 ? '✓' : m.correctness >= 0.5 ? '½' : '✗')).join(' ') || '—'}
        </p>
      )}
    </div>
  );
}

/** 2026-10-22 (Schritt 12) — wer erzählt: sein Bild, sein Name und was er ansagt (der Titel des Schritts). */
function Narrator({ who, says }: { who: PublicEntity | null; says: string | null }) {
  if (who === null) return null;
  const portrait = who.media.find((m) => m.type === 'image');
  return (
    <div className="cg-bubble cg-narrator" data-narrator={who.id}>
      <span className="cg-bubble-face" title={who.label}>{portrait !== undefined ? <MediaView media={portrait} /> : who.label.slice(0, 1)}</span>
      <span className="cg-bubble-text">
        <strong><TexText text={who.label} /></strong>
        <span><TexText text={says ?? 'opowiada'} /></span>
      </span>
    </div>
  );
}

function Next({ onNext, label }: { onNext: () => void; label: string }) {
  return <div className="wk-actions"><button type="button" className="wk-btn" onClick={onNext} autoFocus>{label}</button></div>;
}

function Goals({ flow, reached }: { flow: Flow; reached: readonly string[] }) {
  return (
    <div className="cg-goals">
      {flow.goals.map((g) => <span key={g.id} className={`cg-tag${reached.includes(g.id) ? ' is-ok' : ''}`}>{reached.includes(g.id) ? '✓ ' : ''}<TexText text={g.title} /></span>)}
    </div>
  );
}

/** Ein Eintrag im Ablauf: eine Aussage ganz, andere mit ihren Feldern und Bildern. */
export function EntityView({ entity }: { entity: PublicEntity | null }) {
  if (entity === null) return <p className="wk-hint">(tego wpisu tu nie ma)</p>;
  /* 2026-10-22 — eine Aussage (ihre Bausteine als Zapis): ganz. 2026-10-23: jeder Eintrag mit Feld blocks. */
  const text = entity.fields.find((f) => f.type === 'blocks');
  if (text !== undefined) return <Markup text={text.text} />;
  return (
    <div className="cg">
      <h3><TexText text={entity.label} /></h3>
      {entity.media.slice(0, 3).map((m) => <MediaView key={m.file} media={m} />)}
      {entity.fields.filter((f) => f.text !== '').slice(0, 12).map((f) => (
        <div key={f.key}>
          <span className="cg-muted">{f.label}: </span>
          {f.type === 'markup' ? <Markup text={f.text} /> : <span><TexText text={f.text} /></span>}
        </div>
      ))}
    </div>
  );
}

function Bubble({ who, text, mood }: { who: PublicEntity | null; text: PublicEntity | null; mood: string | null }) {
  const portrait = who?.media.find((m) => m.type === 'image');
  const line = text?.fields.find((f) => f.key === 'text' || f.type === 'blocks')?.text ?? text?.label ?? '';
  return (
    <div className="cg-bubble">
      <span className="cg-bubble-face" title={who?.label ?? ''}>
        {portrait !== undefined ? <MediaView media={portrait} /> : (who?.label ?? '?').slice(0, 1)}
      </span>
      <span className="cg-bubble-text">
        <strong><TexText text={who?.label ?? 'Postać'} />{mood !== null && mood !== '' ? <span className="cg-muted"> ({mood})</span> : null}</strong>
        <Markup text={line} />
      </span>
    </div>
  );
}
