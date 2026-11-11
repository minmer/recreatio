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
 *
 * 2026-11-04 (Prompt 13) — ABSTECHER (`detour`, `detour.ts`): eine Karte mit der anderen Erzählung, was dort wartet, „Wejdź" und
 * „Dalej bez tego" (schon ukończona: „już znasz", „Przypomnij" / „Dalej"); darin folgen Titel, Ścieżka und Zähler der inneren,
 * darüber die Leiste „Etap 1 › Dom w Becchi" mit „Wróć do: …" jederzeit (zurück an den Abstecher, nicht als ukończona
 * gemerkt). Die Stelle der eigenen Erzählung merkt sich die offenen Abstecher (`inside`), die der inneren steht unter ihr selbst
 * — wer neu lädt, steht wieder darin.
 */

import { lazy, Suspense, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';

import { AnswerInput, CardFace, CardPrompt, givenText, Verdict, type CardStats } from './CardFace';
import type { Outcome } from './check';
import { questionCard } from './cards';
import { type Card } from './cardBasics';
import { appLang, LangScope, rich, useT } from '../core/i18n';
import {
  chaptersLeft, detourRefused, follow, goalsReached, linesNow, markSaid, optionsOf, readFlow, resolveFlow, reviewOf, STEP_LABEL,
  type Flow, type FlowState, type LookType, type PlayContext
} from './flow';
import { detourOf, detoursIn, detourState, openDetours, requiredOpen, type DetourConfig } from './detour';
import { DetourCard, summaryField } from './DetourCard';
import { branchesOf, type BranchContext } from './pathBranches';
import type { EntriesOfStep } from './flowPath';
import { branchIds, branchParts, branchWork, chapterOfSteps, stepWorkOf, storyMarks, storyPath, type WorkOfStep } from './storyPath';
import { chaptersKept, flowFactsOf, mergeGoals } from './flowFacts';
import type { GraphNode } from './graph';
import { PathMap, type PathNext } from './PathMap';
import { mergeWords, type PathMarks } from './pathLayout';
import { positionFor, renamer, type FlowPosition, type Learner } from './learn';
import { ask } from '../ui/dialogs';
import { askedCardOf, cardKnow, cardsInFlow, flowKnowness, isKnown, pickSpacer, questionsLeft, skipStep, type MarksOf } from './flowAsk';
import { baseLang, words, type Lang } from './lang';
import { cardsAbout } from './prerequisites';
import { conditionText, holds, readCondition, type Facts, type FlowFacts } from './logic';
import { publicEntity, type PublicEntity } from './publish';
import { slideText } from './slideText';
import type { MediaRef } from './schema';
import type { CogitaLibrary } from './store';
import { CogitaContext, Markup, MediaView, originPath } from './ui';
import { CrossCrumbs, CrossDetourStep, CrossRun, WorldsSection } from './WorldLinks';
import { crossOf } from './worlds';
import { readPlan } from './revision';
import { ReviewStep } from './ReviewStep';
import { slideDrawingText, WithSlideDrawing } from './SlideDrawing';
import { reviewCards } from './reviewRound';
import { RevisionRun, type RunSource } from './RevisionRun';
import { backDepths, backTo, decideBy, detourIn, enterAt, insideOf, resumeInside, startRun, stepRun, type RunStep, type StoryFinished, type StoryRun } from './runningStory';
import { directStartLock, OPEN_LOCK, storyAround } from './storyLock';
import { storyWork } from './storyNext';
import { StoryNextChoices } from './StoryNextChoices';
import { StoryRoute } from './StoryRoute';
import { isSlideEntity, slideQuestionIds } from './slideLib';
import { slideWords } from './slideWords';
import { Loading } from '../ui/Loading';
import { TexText } from '../ui/tex/Tex';
import './story.css';

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
  const W = words(content.lang ?? appLang());
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
    /* 2026-11-05 (Prompt 23, D4) — ein Przegląd in einem Schritt: so viele Fragen, wie er prüft (die der Erzählung). */
    if (node.type === 'review') {
      const rc = reviewOf(flow, node);
      const asked = rc === null ? [] : reviewCards(flow, rc, content.card, (r) => content.flow(content.flowRef?.(r) ?? r), node.id);
      return { slides: 0, questions: asked.length, shown: [], asked: [...new Set(asked.flatMap((c) => (c.about ?? []).length > 0 ? [...c.about!] : [c.entity ?? c.question]))] };
    }
    return base(node);
  };
  return storyPath(flow, work, label, options);
}

/** 2026-11-10 — ohne den Weg des Lernenden: derselbe Plan der Erzählung, nichts gegangen, nichts „jetzt". */
const plainMarks = (m: PathMarks): PathMarks => ({
  ...m, state: m.state.map(() => 'available' as const), due: m.due.map(() => false), current: -1, lit: m.lit.map(() => false), taken: m.taken.map(() => false),
  forks: new Map(), skipped: undefined, done: 0
});
/* 2026-11-04 (Prompt 13) — aus „Co dalej" nach ihrem Überblick geöffnet: ein Abstecher, der später kommt — ohne die Sperre davor (in diesem Tab). */
const FREE = 'cg-story-free:';
const isFree = (flow: string): boolean => { try { return sessionStorage.getItem(FREE + flow) === '1'; } catch { return false; } };
const keepFree = (flow: string): void => { try { sessionStorage.setItem(FREE + flow, '1'); } catch { /* ohne Speicher: mit Sperre */ } };

type FlowPlayerProps = Parameters<typeof FlowPlayerIn>[0];

/** 2026-11-05 — der Spieler spricht die Sprache der Baza (`content.lang`). */
export function FlowPlayer(props: FlowPlayerProps) {
  return <LangScope lang={props.content.lang ?? null}><FlowPlayerIn {...props} /></LangScope>;
}

function FlowPlayerIn({ flow: given, content, learner, onClose, jumpTo, onAnswer, presentationAs = 'play', gate = true, backLabel, endToClose = false }: {
  flow: Flow;
  content: FlowContent;
  learner: Learner | null;
  onClose?: () => void;
  /** 2026-11-05 (Prompt 18) — wohin „‹ …" oben links zurückführt: „Mapa", „Strona", „Nauka" (sonst „Wróć"). */
  backLabel?: string;
  /**
   * 2026-10-22 (Schritt 12) — ein Storyboard: hier spielen (Nauka) oder nur
   * hinführen (`link` — ein Baustein auf einer Seite: die Präsentation IST eine Seite).
   */
  presentationAs?: 'play' | 'link';
  /** Ein Schritt, der von aussen geöffnet wird (ein Auslöser im Spiel [J6]). */
  jumpTo?: { readonly step: string; readonly at: number; readonly exit?: string } | null;
  /** Jede Antwort auch nach aussen (eine Sitzung mit Code sammelt sie für den Gastgeber). */
  onAnswer?: (step: string, card: Card, correctness: number, given: unknown) => void;
  /** 2026-11-03 (Prompt 5) — vor einer Erzählung ihre Sperre prüfen (aus nur in einer Sitzung, die der Gastgeber führt). */
  gate?: boolean;
  /**
   * 2026-11-10 (Eigentümer: „läuft eine Navigation, wird diese Seite übersprungen") — am Ende keine Seite „Wie es weitergeht":
   * gleich zurück (`onClose`); den nächsten Schritt sagt der Weg auf der Karte.
   */
  endToClose?: boolean;
}) {
  const flow = useMemo(() => resolveFlow(given, content.flow), [given, content]);
  /* Ein Ablauf beim Namen: der gegebene selbst (vielleicht ungespeichert), sonst der der Baza. */
  const flowOf = (id: string): Flow | undefined => (id === flow.id ? flow : content.flow(content.flowRef?.(id) ?? id));
  const cg = useContext(CogitaContext);
  const t = useT();
  const W = words(content.lang ?? t.lang);

  /*
    2026-11-04 (Prompt 10) — DIE KENNTNIS AUS DER GANZEN GESCHICHTE: alle Antworten des Lernenden auf diese Karte (aus jeder
    Erzählung, jeder Powtórka, jedem Üben — mit den Zusammenführungen der Baza), gleich nach jeder Antwort neu. Eine Frage
    zählt mit IHRER Karte (der, die ihr Schritt fragt), nicht mit dem Mittel über alles, was über sie ist; was keine Karte
    hat, hält nichts auf. Vorher konnte „Już umie?" so nie wahr werden, und der Przegląd lief im Kreis.
  */
  /* 2026-11-04 (Prompt 15) — mit den Abständen des Lernenden. */
  const marksOf: MarksOf | null = learner === null ? null : Object.assign((card: Card) => learner.marks(card.key, card.fingerprint, content.rename), { spacing: learner.spacing });
  /* 2026-11-10 — „Statistik dieser Karte" an jeder Frage der Erzählung. */
  const statsOf = (card: Card): CardStats | null => (learner === null ? null : { marks: () => learner.marks(card.key, card.fingerprint, content.rename), spacing: learner.spacing });
  const ownCard = (id: string): Card | null => { const c = content.card(id); return c !== null && (c.question === id || c.entity === id || c.key === id) ? c : null; };
  /* 2026-11-04 (Prompt 11) — in diesem Lauf zu Ende erzählt: die Bedingung „Przebieg" sieht es sofort. */
  const doneHere = useRef(new Set<string>());
  /*
    2026-11-05 (Prompt 24) — EIN ABSTECHER IN EINE ANDERE WELT läuft hier, mit ihrem Inhalt und ihrem Lernenden (`CrossRun`);
    zurück (ukończona) geht der Schritt mit „done" weiter. Der Weg über die Welten: der rufende (`CrossCrumbs`) und dieser.
  */
  const [crossRun, setCrossRun] = useState<{ readonly world: CogitaLibrary; readonly name: string; readonly flowId: string; readonly step: string } | null>(null);
  const crossTrail = useContext(CrossCrumbs);
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
    answeredAt: (id) => {
      if (learner === null) return null;
      const card = content.card(id);
      const marks = card === null ? [] : learner.marks(card.key, card.fingerprint);
      return marks.length === 0 ? null : marks[marks.length - 1].at;
    },
    visited: new Set(s.visited),
    now: new Date(),
    flow: flowFacts
  });
  /* Die Regel des Spielers: was der Lernende kann, wird nicht gefragt (still, über „dobrze"). */
  const ctx: PlayContext = { facts, flows: flowOf, members: content.members, skip: (node) => skipStep(node, content.card, marksOf) };

  /* 2026-11-04 (Prompt 13) — die Stelle eines Ablaufs, auch nach dem Neu-Einspielen (über seinen bleibenden Namen). */
  const posOf = (id: string) => (learner === null ? undefined : positionFor(learner.progress.positions, flowOf(id) ?? { id }));
  /*
    2026-11-03 (G) — wer wiederkommt, steht, wo er war — mit den Kapiteln, die er schon durch hat. 2026-11-04 (Prompt 13):
    und in den Abstechern, die offen waren (`inside` — jede innere Erzählung mit ihren eigenen besuchten Schritten).
  */
  const openRun = (target: Flow, kept: FlowPosition | undefined, values: Readonly<Record<string, number>>): StoryRun => {
    const r = startRun(target, { values, at: kept?.step ?? null, chapters: chaptersOf(kept?.chapters), visited: kept?.visited ?? [] }, ctx);
    return kept?.inside === undefined || kept.inside.length === 0 ? r : resumeInside(r, kept.inside, flowOf, ctx, posOf);
  };
  const [run, setRun] = useState<StoryRun>(() => openRun(flow, posOf(flow.id), learner?.progress.values ?? {}));
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

  /*
    2026-11-05 (Prompt 18) — „WSTECZ": jeder gezeigte Schritt dieses Laufs wird gemerkt, wie er war (der Lauf, die Antwort, die
    Wahl). Zurück heisst nur ANSEHEN: der Schritt steht gesperrt da (eine Frage mit der gegebenen Antwort und dem Urteil), der
    Lauf selbst bleibt, wo er ist — Fortschritt, Zähler und Ziele ändern sich nie; „Dalej" führt bis dorthin zurück. Der laufende
    Schritt bleibt dabei unsichtbar stehen (eine halb beantwortete Frage verliert nichts).
  */
  const [past, setPast] = useState<readonly PastStep[]>([]);
  const [backBy, setBackBy] = useState(0);
  const lastAnswer = useRef<PastStep['answer'] | null>(null);
  const remember = (exit?: string) => {
    const r = runRef.current;
    const node = r.state.step === null ? undefined : flowOf(r.state.flow)?.graph.nodes.find((n) => n.id === r.state.step);
    if (node === undefined || !SHOWN_STEPS.has(node.type)) return;
    const answer = node.type === 'question' ? lastAnswer.current : null;
    lastAnswer.current = null;
    setPast((p) => [...p, { run: r, ...(answer == null ? {} : { answer }), ...(exit === undefined ? {} : { exit }) }].slice(-200));
  };
  const forgetPast = () => { setPast([]); setBackBy(0); lastAnswer.current = null; };
  /*
    Tastatur: → / Enter / Leertaste = Dalej, ← = Wstecz — nicht in Feldern; Enter und Leertaste nicht auf einem Knopf (der
    tut es selbst). Nur, solange dieser Spieler zu sehen ist. Wischen nach links / rechts tut dasselbe.
  */
  const keys = useRef<{ next: (() => void) | null; back: (() => void) | null }>({ next: null, back: null });
  const touchAt = useRef<{ x: number; y: number } | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (t !== null && (t.isContentEditable || t.closest('input, textarea, select, .cg-story-mapview, .cg-story-menu, [role="dialog"]') !== null)) return;
      const onControl = t !== null && t.closest('button, a, summary') !== null;
      const act = e.key === 'ArrowRight' || ((e.key === 'Enter' || e.key === ' ') && !onControl) ? keys.current.next : e.key === 'ArrowLeft' ? keys.current.back : null;
      if (act === null || stage.current === null || !stage.current.isConnected || stage.current.offsetParent === null) return;
      e.preventDefault();
      act();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  /*
    2026-11-05 — SCROLLEN: ein neuer Schritt (weiter, Wstecz, das Ende) beginnt oben — liegt der Kopf des Spielers über dem
    Fenster (man hat in einem langen Slajd nach unten gelesen) oder weit darunter, gleitet die Seite zu ihm; steht er schon
    im Bild, bewegt sich nichts.
  */
  const endRef = useRef<HTMLElement | null>(null);
  const stepSig = `${run.state.flow}:${run.state.step ?? ''}:${run.state.ended ? 'e' : ''}:${backBy}`;
  const firstSig = useRef(stepSig);
  useEffect(() => {
    if (firstSig.current === stepSig) return;
    firstSig.current = '';
    const el = stage.current ?? endRef.current;
    if (el === null) return;
    const top = el.getBoundingClientRect().top;
    if (top >= 0 && top <= window.innerHeight * 0.5) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    el.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }, [stepSig]);
  /* Jedes Zeichnen sagt neu, was die Tasten tun (Ende, Sperre: nichts). */
  keys.current = { next: null, back: null };

  /** Eine Erzählung ist eben zu Ende gegangen (ein Weg in ihr, eine Übergabe): gemerkt als ukończona, mit ihren Zielen. */
  const keepFinished = (list: readonly StoryFinished[], after: FlowState) => {
    for (const f of list) {
      doneHere.current.add(f.flow);
      if (learner === null) continue;
      const story = flowOf(f.flow);
      const had = posOf(f.flow);
      const reached = story === undefined ? [] : goalsReached(story, facts({ ...after, visited: f.visited }));
      void learner.keepPosition({
        flow: f.flow, step: f.step, visited: f.visited, at: Date.now(), done: true, ...(story?.ref === undefined ? {} : { ref: story.ref }),
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

  /*
    2026-11-04 (Prompt 13) — DER LERNENDE KOMMT NACH (der Spieler war schon da, sein Fortschritt noch nicht): solange hier
    noch nichts getan wurde, dorthin, wo er war — sonst schrieb der Spieler den Anfang über die gemerkte Stelle.
  */
  const moved = useRef(false);
  const seenLearner = useRef(learner);
  useEffect(() => {
    if (seenLearner.current === learner) return;
    seenLearner.current = learner;
    if (learner === null || moved.current) return;
    const kept = posOf(flow.id);
    if (kept === undefined) return;
    commit({ run: openRun(flow, kept, learner.progress.values), finished: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learner]);

  /* Ein anderer Ablauf von aussen (ohne neuen Spieler): er beginnt, wo der Lernende in ihm war. */
  const startedWith = useRef(flow.id);
  useEffect(() => {
    if (startedWith.current === flow.id) return;
    startedWith.current = flow.id;
    const kept = posOf(flow.id);
    commit({ run: openRun(flow, kept, learner?.progress.values ?? {}), finished: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.id]);

  useEffect(() => {
    if (jumpTo == null || !flow.graph.nodes.some((n) => n.id === jumpTo.step)) return;
    moved.current = true;
    forgetPast();
    const s = runRef.current.state;
    const mine = s.flow === flow.id && s.stack.length === 0;
    const entered: StoryRun = { root: flow.id, outer: [], state: enterAt(flow, { ...s, flow: flow.id, stack: [], chapter: null, queue: undefined, visited: mine ? s.visited : [] }, jumpTo.step, ctx) };
    /* 2026-11-09 (Weltkarte, Umsteigeort) — an einer Wahl gleich den Ausgang nehmen, den der Lernende auf der Karte gewählt hat. */
    const exit = jumpTo.exit;
    const atFork = exit !== undefined && entered.state.step === jumpTo.step && flow.graph.edges.some((e) => e.from === jumpTo.step && e.out === exit);
    commit({ run: atFork ? stepRun(entered, flowOf, exit, ctx).run : entered, finished: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo?.at, jumpTo?.step, jumpTo?.exit, flow]);

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
  /* 2026-11-04 (Prompt 13) — ist die Erzählung eines Abstechers ukończona (gemerkt oder eben in diesem Lauf)? */
  const innerDone = (ref: string): boolean => { const f = flowOf(ref); return f !== undefined && (doneHere.current.has(f.id) || posOf(f.id)?.done === true); };
  /* Ein Pflicht-Abstecher, an dem er vorbeikam, ohne seine Erzählung: das Ende zählt noch nicht. */
  const requiredLeft = state.ended && state.stack.length === 0 ? requiredOpen(running, state.visited, innerDone) : [];
  const inside = insideOf(run, flowOf);
  const insideKey = inside === null ? '' : JSON.stringify(inside);
  useEffect(() => {
    if (learner === null || state.step === null) return undefined;
    /* Nichts getan und schon gemerkt, wo er ist: nichts zu schreiben (ein blosses Öffnen überschreibt nie). */
    const kept = posOf(running.id);
    if (!moved.current && kept !== undefined && kept.step === state.step && state.stack.length === 0) return undefined;
    if (keepTimer.current !== null) window.clearTimeout(keepTimer.current);
    const done = state.ended && state.stack.length === 0 && requiredLeft.length === 0;
    keepTimer.current = window.setTimeout(() => {
      /* 2026-11-04 (Prompt 13) — im Abstecher: auch die eigene Erzählung merkt sich, wo sie wartet und worin er steht. */
      if (inside !== null) void learner.keepPosition({ flow: root.id, step: inside.step, visited: inside.visited, at: Date.now(), inside: inside.inside, ...(root.ref === undefined ? {} : { ref: root.ref }) }).catch(() => undefined);
      const had = posOf(running.id);
      void learner.keepPosition({
        flow: running.id, step: state.step ?? '', visited: state.visited, at: Date.now(), ...(running.ref === undefined ? {} : { ref: running.ref }),
        chapters: chaptersKept(state.chapters),
        ...(done || had?.done === true ? { done: true } : {}),
        ...(reachedNow.length > 0 || (had?.goals?.length ?? 0) > 0 ? { goals: mergeGoals(had?.goals, reachedNow) } : {})
      }).catch(() => undefined);
      if (JSON.stringify(state.values) !== JSON.stringify(learner.progress.values)) void learner.keepValues(state.values).catch(() => undefined);
    }, done ? 0 : 200);
    return () => { if (keepTimer.current !== null) window.clearTimeout(keepTimer.current); };
  }, [learner, running.id, state.step, state.visited, state.values, state.ended, state.chapters, goalsKey, insideKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (exit?: string) => {
    moved.current = true;
    remember(exit);
    setBackBy(0);
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

  /* Von vorn: die laufende Erzählung (eine gerufene: in ihr, die rufende wartet weiter). */
  const restart = () => {
    moved.current = true;
    setNotice(null);
    forgetPast();
    const s = runRef.current.state;
    if (s.stack.length === 0) { commit({ run: startRun(running, { values: learner?.progress.values ?? s.values }, ctx), finished: [] }); return; }
    commit({ run: { ...runRef.current, state: enterAt(running, { ...s, visited: [], chapters: {}, chapter: null }, running.start, ctx) }, finished: [] });
  };
  /* 2026-11-04 (Prompt 13) — „Wróć do …": zurück an den Abstecher (die verlassene Erzählung bleibt, wie sie war — nicht ukończona). */
  const goBack = (depth: number) => {
    moved.current = true;
    setNotice(null);
    forgetPast();
    setAnsweredOn(null);
    setVisit((v) => v + 1);
    commit({ run: backTo(runRef.current, flowOf, depth), finished: [] });
  };
  /* „Wejdź" (dort, wo er in ihr war) / „Przypomnij" (von vorn). */
  const enterDetour = (inner: Flow, fresh: boolean) => {
    moved.current = true;
    /* Die Karte des Abstechers bleibt hinter dem ersten Schritt darin: „Wstecz" führt aus ihm zurück in die rufende Erzählung. */
    remember('enter');
    setBackBy(0);
    setNotice(null);
    setAnsweredOn(null);
    setVisit((v) => v + 1);
    commit(detourIn(runRef.current, flowOf, ctx, fresh ? null : posOf(inner.id) ?? null));
  };
  const depths = backDepths(run, flowOf);
  /* 2026-11-04 (Prompt 13) — ausdrücklich vergessen (nach Rückfrage): nur das nimmt „ukończona" und Ziele weg. */
  const forget = () => {
    if (learner === null) return;
    const who = learner;
    void ask({ title: W.forgetAsk(running.name), confirm: W.forgetStory, danger: true }).then((yes) => {
      if (!yes) return;
      doneHere.current.delete(running.id);
      void who.keepPosition({ flow: running.id, step: running.start ?? '', visited: [], at: Date.now(), reset: true }).catch(() => undefined);
      restart();
    });
  };
  /*
    2026-11-03 (Prompt 5) — DER PRZEGLĄD: welche Ziele erreicht sind (gemerkt und jetzt), und „Powtórz przegląd" — zum
    Schritt, an dem er beginnt (`review`), ohne ihn an den Anfang.
  */
  const goalsHeld = mergeGoals(posOf(running.id)?.goals, reachedNow);
  const reviewOpen = running.goals.length > 0 && !running.goals.every((g) => goalsHeld.includes(g.id));
  const reviewStep = running.review !== undefined && running.graph.nodes.some((n) => n.id === running.review) ? running.review : running.start;
  const toReview = () => {
    if (reviewStep === null) { restart(); return; }
    setAnsweredOn(null);
    forgetPast();
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
  /* 2026-11-04 (Prompt 13) — ein Abstecher, an dem er vorbei ist, ohne seine Erzählung: ausgelassen (zählt als durch). */
  const visitedNow = new Set(state.visited);
  const skippedStep = (s: string): boolean => { const n = stepNode.get(s); const d = n === undefined ? null : detourOf(n); return d !== null && detourState(s, visitedNow, state.step, d.flow !== '' && innerDone(d.flow)) === 'skipped'; };
  const pathNow = storyMarks(sp, { visited: state.visited, ended: state.ended, step: state.step, ...(knowNow === undefined ? {} : { know: knowNow }), ...(knownStep === undefined ? {} : { knownStep }), chapters: state.chapters, skipped: skippedStep });
  /*
    2026-11-06 — IN EINEM INNEREN WEG EINES SECHSECKS (ein `subflow` des Ablaufs mit `unit`): oben zählt das Sechseck weiter („3 z 6"),
    nicht der Abschnitt für sich („0 z 1") — der Abschnitt ist ein Teil des Sechsecks (`mountain.ts`).
  */
  const hexFrame = state.stack.length > 0 ? state.stack[0] : null;
  const hexFlow = hexFrame === null ? undefined : flowOf(hexFrame.flow);
  const inHexSegment = hexFlow !== undefined && hexFlow.unit !== undefined && hexFlow.graph.nodes.some((n) => n.id === hexFrame!.step && n.type === 'subflow');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hexSp = useMemo(() => (inHexSegment ? storyPathOf(hexFlow!, content) : null), [inHexSegment, hexFlow?.id, content]);
  const hexNow = hexSp === null || hexFrame === null ? null : storyMarks(hexSp, { visited: run.outer[0] ?? [], step: hexFrame.step, ...(knowNow === undefined ? {} : { know: knowNow }) });
  /* Was in der Erzählung eines Abstechers wartet („7 slajdów · 16 pytań") — einmal je Erzählung. */
  const workMemo = useMemo(() => new Map<string, string>(), [content]);
  const innerWork = (f: Flow): string => {
    let w = workMemo.get(f.id);
    if (w === undefined) { const s = storyWork(storyPathOf(f, content)); w = f.presentation !== undefined ? W.story : W.workShort(s.slides, s.questions); workMemo.set(f.id, w); }
    return w;
  };
  /* Ein Knoten der Ścieżka, der ein Abstecher ist: sein Schritt und seine Erzählung. */
  const detourAt = (id: string): { readonly step: string; readonly inner: Flow; readonly config: DetourConfig } | null => {
    const part = sp.parts[sp.model.index.get(id) ?? -1];
    if (part?.kind !== 'detour' || part.steps.length === 0) return null;
    const n = stepNode.get(part.steps[0]);
    const d = n === undefined ? null : detourOf(n);
    const inner = d === null || d.flow === '' ? undefined : flowOf(d.flow);
    return inner === undefined ? null : { step: part.steps[0], inner, config: d! };
  };
  /* 2026-11-05 (Prompt 23, B4/A8) — die Karte eines Abstechers (im Schritt und im Fenster seines Zweiges), mit dem Satz seiner Einheit. */
  const unitSummary = (f: Flow): string => (f.unit === undefined ? '' : summaryField(content.entity(f.unit)?.fields));
  const detourCardOf = (d: DetourConfig, inner: Flow) => {
    const known = innerDone(inner.id);
    const kept = posOf(inner.id);
    return {
      name: inner.name, label: d.label, summary: unitSummary(inner), work: innerWork(inner), optional: d.optional, known,
      started: !known && kept !== undefined && (kept.visited.length > 1 || (kept.inside?.length ?? 0) > 0),
      refused: detourRefused(state, inner.id, flowOf), W, onEnter: (fresh: boolean) => enterDetour(inner, fresh), flowId: inner.id
    };
  };
  /* 2026-11-05 (Prompt 23, B2–B5) — was die Zweige der Ścieżka zeigen (`pathBranches.ts`). */
  const branchCtx: BranchContext = { flowOf, position: posOf, done: innerDone, card: content.card, marks: marksOf, summary: unitSummary, words: W };
  const branchMap = branchesOf(sp, running, branchCtx, { visited: state.visited, step: state.step });
  /*
    2026-11-05 (Prompt 23, B6) — IM ABSTECHER: die Ścieżka der rufenden Erzählung, „TERAZ" auf ihrem Zweig, und wo die Linie
    weitergeht, wenn er zurückkommt („tu wrócisz"); darunter die eigene Ścieżka der inneren Erzählung.
  */
  const callerFrame = state.stack.length > 0 && depths.length > 0 ? state.stack[state.stack.length - 1] : null;
  const caller = callerFrame === null ? undefined : flowOf(callerFrame.flow);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const callerSp = useMemo(() => (caller === undefined ? null : storyPathOf(caller, content)), [caller?.id, content]);
  const callerVisited = run.outer[run.outer.length - 1] ?? [];
  const callerMarks = callerSp === null || callerFrame === null ? null : storyMarks(callerSp, { visited: callerVisited, step: callerFrame.step, ...(knowNow === undefined ? {} : { know: knowNow }) });
  const callerBranches = callerSp === null || caller === undefined || callerFrame === null ? null : branchesOf(callerSp, caller, branchCtx, { visited: callerVisited, step: callerFrame.step });
  const callerReturn = (() => {
    if (callerSp === null || callerFrame === null || callerFrame.step === null) return null;
    const v = callerSp.partOfStep.get(callerFrame.step);
    const b = v === undefined ? undefined : callerSp.model.nodes[v]?.branch;
    return b === undefined || b.rejoin === null ? null : callerSp.model.nodes[b.rejoin].id;
  })();
  /* 2026-11-05 (Prompt 23, B7) — in „Co dalej“: wo der Abstecher abzweigt („po slajdzie 2“). */
  const whereOfStep = (step: string): string => { const v = sp.partOfStep.get(step); return v === undefined ? '' : branchMap.get(sp.model.nodes[v]?.id ?? '')?.where ?? ''; };
  const [hovered, setHovered] = useState<ReadonlySet<string> | null>(null);
  /* Im Kapitel bleibt seine Spur hervorgehoben. */
  const inChapter = state.chapter === null ? null : branchIds(sp, state.chapter.hub, `c${state.chapter.index}`);
  const lightOf = (step: string, exit: string) => ({
    onPointerEnter: () => setHovered(branchIds(sp, step, exit)),
    onPointerLeave: () => setHovered(null),
    onFocus: () => setHovered(branchIds(sp, step, exit)),
    onBlur: () => setHovered(null)
  });
  /*
    2026-11-10 (Eigentümer: „der Plan einer Erzählung nur im Vollbild auf Wunsch, nie als ständiges Feld daneben; im Vollbild lässt
    sich der Weg ausschalten") — DER PLAN ALS EIGENE ANSICHT: im Menü „⋯" geöffnet, Esc oder „Schliessen" zurück.
  */
  const [mapOpen, setMapOpen] = useState(false);
  const [routeShown, setRouteShown] = useState(true);
  useEffect(() => {
    if (!mapOpen) return undefined;
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) setMapOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [mapOpen]);
  /*
    2026-11-03 (Prompt 5) — DIE SPERRE VOR EINER ERZÄHLUNG (`storyLock.ts`, die Logik des Krajobraz): fehlt vor ihrer Einheit
    noch etwas, steht ein Bildschirm davor — was fehlt, in der Reihenfolge des Weges, mit Links und „Ucz się", dazu „Ustaw
    jako cel"; sind nur Karten der Kette schwach, „Najpierw powtórz (N)" mit genau diesen Karten, danach weiter zur
    Erzählung. Wer in der Baza schreibt, darf sie trotzdem ansehen („Podgląd mimo to"). Geprüft wird die eigene Erzählung
    des Laufs (nicht eine, die ein Weg in ihr ruft).
  */
  const [unlocked, setUnlocked] = useState(() => isFree(flow.id));
  const [lockRun, setLockRun] = useState<{ readonly key: string; readonly source: RunSource; readonly weak: boolean } | null>(null);
  const [lockTick, setLockTick] = useState(0);
  const [routeTarget, setRouteTarget] = useState<{ readonly id: string; readonly aim: boolean } | null>(null);
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
    const after = state.stack.length > 0 ? null : { flow: running, taught: [...new Set(sp.parts.flatMap((p) => [...p.shown, ...p.asked]))] }; // i18n-ignore
    return storyAround(cg.lib, content.cards, learner, lockUnit, after);
  }, [cg, cg?.lib.revision, content.cards, learner, progressNow, lockUnit, lockTick, running, sp, state.stack.length, state.ended]); // eslint-disable-line react-hooks/exhaustive-deps
  const lock = around.lock;
  /*
    2026-11-04 (Prompt 13) — DIREKT GEÖFFNET (nicht als Abstecher aus ihrem Überblick): verlangt ihre Einheit die Einheit einer
    anderen Erzählung, die er noch nicht zu Ende erzählt hat, sagt der Spieler es („Najpierw: Etap 1").
  */
  const directFirst = useMemo(() => (lockUnit === null || cg === null || learner === null ? null : directStartLock(cg.lib, learner.progress.positions, root)),
    [lockUnit, cg, cg?.lib.revision, learner, progressNow, root]); // eslint-disable-line react-hooks/exhaustive-deps
  const jumpToStep = (step: string | null) => {
    if (step === null) return;
    const ch = chapterAt.get(step);
    setAnsweredOn(null);
    forgetPast();
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
    forgetPast();
    setUnlocked(isFree(next.id));
    setLockTick((n) => n + 1);
    const kept = posOf(next.id);
    commit({ run: kept?.done === true ? startRun(next, { values: runRef.current.state.values, chapters: chaptersOf(kept.chapters) }, ctx) : openRun(next, kept, runRef.current.state.values), finished: [] });
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
    const kept = story === undefined ? undefined : posOf(story.id);
    const started = kept !== undefined && kept.done !== true && (kept.visited.length > 1 || (kept.inside?.length ?? 0) > 0);
    return {
      id, label: story?.name ?? name(id), kind, ready, work, ...(note === undefined ? {} : { note }), ...(started ? { state: 'started' as const } : {}),
      why: [missing.length > 0 ? W.needsFirst(names(missing)) : '', due.length > 0 ? W.dueFirst(names(due)) : ''].filter(Boolean),
      action: ready
        ? { label: started ? W.nextContinue : kind === 'story' ? W.startStory : W.learn, run: () => { if (story !== undefined) startStory(story); else startTopic(id); } }
        : { label: W.nextRoute, run: () => setRouteTarget({ id, aim: false }) },
      ...(!ready && learner !== null ? { goalAction: { label: W.setGoal, run: () => setRouteTarget({ id, aim: true }) } } : {})
    };
  };
  /*
    2026-11-04 (Prompt 13) — „CO DALEJ" BEGINNT MIT DEN OFFENEN FREIWILLIGEN ABSTECHERN dieser Erzählung (ausgelassen oder nie
    erreicht, ihre Erzählung nicht ukończona) — geöffnet wie aus dem Überblick (ohne die Sperre davor), dann die anderen.
  */
  const startFree = (f: Flow) => { keepFree(f.id); startStory(f); };
  const detourNext: PathNext[] = ahead === null ? [] : openDetours(running, innerDone, (r) => flowOf(r)?.id ?? null).flatMap((d): PathNext[] => {
    const f = flowOf(d.target);
    if (f === undefined || f.id === running.id) return [];
    const kept = posOf(f.id);
    const started = kept !== undefined && (kept.visited.length > 1 || (kept.inside?.length ?? 0) > 0);
    return [{ id: `detour:${f.id}`, label: f.name, kind: 'story', optional: true, ready: true, ...(started ? { state: 'started' as const } : {}),
      work: innerWork(f), note: [W.detourNote, whereOfStep(d.step)].filter(Boolean).join(' · '),
      action: { label: started ? W.nextContinue : W.startStory, run: () => startFree(f) } }];
  });
  const nextItems: PathNext[] | undefined = ahead === null ? undefined : (() => {
    const inDetours = new Set(detourNext.map((x) => x.id.slice('detour:'.length)));
    const list = ahead.next.map((n) => nextStep(n.id, n.kind, n.ready, n.missing, n.due)).filter((x) => { const f = nextWork.get(x.id)?.flow; return f === undefined || !inDetours.has(f.id); });
    if (!ahead.next.some((n) => n.ready) && detourNext.length === 0) {
      if (ahead.nearest !== null) list.unshift(nextStep(ahead.nearest.id, ahead.nearest.kind, true, [], [], W.nearest));
      else if (onClose !== undefined) list.unshift({ id: '~map', label: W.backToMap, kind: 'map', ready: true, action: { label: W.backToMap, run: onClose } });
    }
    /*
      2026-11-05 — DANACH, WAS SCHON GETAN IST (vom Nutzer: „sehen, welche weiteren Geschichten ich schon gemacht habe"): die
      ukończone Abstecher dieser Erzählung und die schon gelernten Nachfolger — grün mit ✓, zum Wiederholen.
    */
    const doneDetours: PathNext[] = [];
    for (const d of detoursIn(running)) {
      const f = d.optional && innerDone(d.flow) ? flowOf(d.flow) : undefined;
      if (f === undefined || f.id === running.id || doneDetours.some((x) => x.id === `detour:${f.id}`)) continue;
      doneDetours.push({ id: `detour:${f.id}`, label: f.name, kind: 'story', optional: true, ready: true, state: 'done', work: innerWork(f), note: W.detourNote, action: { label: W.detourRemind, run: () => startFree(f) } });
    }
    const doneNext: PathNext[] = (ahead.done ?? []).flatMap((id): PathNext[] => {
      const f = ahead.stories.get(id);
      const story = f === undefined ? undefined : flowOf(f.id) ?? f;
      if (story !== undefined && doneDetours.some((x) => x.id === `detour:${story.id}`)) return [];
      return [{ id: `done:${id}`, label: story?.name ?? name(id), kind: story !== undefined ? 'story' : 'topic', ready: true, state: 'done',
        work: story !== undefined ? innerWork(story) : W.questions(cardsAbout(content.cards ?? [], id).length),
        action: { label: W.detourRemind, run: () => { if (story !== undefined) startStory(story); else startTopic(id); } } }];
    });
    return [...detourNext, ...list, ...doneDetours, ...doneNext];
  })();

  const withPath = (story: ReactNode): ReactNode => (pathModelNow.nodes.length < 2 || !mapOpen ? story : (
    <>
      {story}
      <div className="cg-story-mapview" role="dialog" aria-modal="true" aria-label={`${W.pathTitle}: ${running.name}`} data-story-path="" data-story-running={running.id}>
        <div className="cg-story-mapbar">
          <strong>{W.pathTitle}: {running.name}</strong>
          <label className="cg-story-maproute"><input type="checkbox" checked={routeShown} onChange={(e) => setRouteShown(e.target.checked)} data-story-map-route="" /> {W.routeShown}</label>
          <button type="button" className="wk-btn wk-btn-line is-small" onClick={() => setMapOpen(false)} data-story-map-close="">{W.close}</button>
        </div>
        {/* Im Abstecher: wo er liegt (ein Tippen: zurück), und der Plan der rufenden Erzählung mit „tu wrócisz". */}
        {depths.length > 0 && trail.length > 0 && (
          <button type="button" className="cg-story-path-inside" onClick={() => { setMapOpen(false); goBack(depths[0]); }} data-story-path-inside={trail[trail.length - 1].id}>{W.insidePath(trail[trail.length - 1].name)}</button>
        )}
        {caller !== undefined && callerSp !== null && callerMarks !== null && callerSp.model.nodes.length > 1 && (
          <div className="cg-story-path-caller" data-story-path-caller={caller.id}>
            <PathMap key={`caller:${caller.id}`} model={callerSp.model} marks={routeShown ? callerMarks : plainMarks(callerMarks)} size="small" words={W} title={`${W.pathTitle}: ${caller.name}`}
              branches={(id) => (routeShown ? callerBranches?.get(id) ?? null : null)} returnAt={routeShown ? callerReturn : null} />
          </div>
        )}
        <PathMap key={running.id} model={pathModelNow} marks={routeShown ? pathNow : plainMarks(pathNow)} size="full" words={W} noWhole
          branches={(id) => (routeShown ? branchMap.get(id) ?? null : null)}
          actions={(id) => {
            const x = detourAt(id);
            if (x === null) return null;
            /* Die Karte des Abstechers; „Dalej bez tego" nur, wo der Lernende gerade an ihm steht. */
            return <DetourCard {...detourCardOf(x.config, x.inner)} onEnter={(fresh) => { setMapOpen(false); jumpToStep(x.step); enterDetour(x.inner, fresh); }} {...(state.step === x.step ? { onExit: (e: 'done' | 'skip') => { setMapOpen(false); go(e); } } : {})} />;
          }}
          highlight={routeShown ? hovered ?? inChapter : null} {...(nextItems === undefined || !routeShown ? {} : { next: nextItems })}
          onPick={(id) => { const part = sp.parts[sp.model.index.get(id) ?? -1]; if (part !== undefined && part.kind !== 'end') { setMapOpen(false); jumpToStep(part.kind === 'start' ? running.start : part.first); } }} />
      </div>
    </>
  ));

  /* Was ein Lese-Schritt zeigt (Bild, Eintrag) — derselbe für den laufenden und für einen, zu dem „Wstecz" zurückgeht. */
  const showBody = (node: GraphNode, stItem: string | undefined): ReactNode => {
    const k = node.config;
    const id = typeof k.of === 'string' ? k.of : typeof k.explain === 'string' ? k.explain : stItem ?? '';
    const media = typeof k.media === 'object' && k.media !== null ? k.media as MediaRef : null;
    const shownEntity = id === '' ? null : content.entity(node.type === 'expand' && typeof k.explain === 'string' ? k.explain : id);
    /* 2026-11-05 (Prompt 23, D1) — ein Rysunek neben dem Text der Folie ("drawing" im Schritt oder ein Feld des Eintrags). */
    const drawingText = node.type === 'show' ? slideDrawingText(k.drawing, shownEntity) : null;
    return (
      <WithSlideDrawing text={drawingText} identity={`${running.id}:${node.id}`} broken={W.slideDrawingBroken}>
        {node.type === 'opening' && <p className="cg-muted">{k.mode === 'discovery' ? t('cogitaLearnPath.flow.guess') : t('cogitaLearnPath.flow.recall')}</p>}
        {media !== null && <MediaView media={media} />}
        {id !== '' && <EntityView entity={shownEntity} />}
      </WithSlideDrawing>
    );
  };
  /*
    2026-11-05 (Prompt 18) — EIN SCHRITT VON FRÜHER, nur zum Ansehen: eine Frage mit der gegebenen Antwort und dem Urteil (nie
    wieder gefragt, nichts gezählt), eine Wahl mit der gewählten Möglichkeit, ein Abstecher mit dem, was er tat.
  */
  const pastBody = (node: GraphNode, entry: PastStep, stItem: string | undefined): ReactNode => {
    const k = node.config;
    switch (node.type) {
      case 'show':
      case 'expand':
      case 'opening':
        return showBody(node, stItem);
      case 'question': {
        const card = entry.answer?.card ?? askedCardOf(node, content.card);
        if (card === null) return null;
        const a = entry.answer;
        /* Wahl, Prawda/Fałsz, Reihenfolge, Paare zeichnen die gegebene Antwort selbst (gesperrt, mit Marken); sonst als Satz. */
        const drawn = a !== undefined && (card.answer.form === 'one' || card.answer.form === 'truefalse' || card.answer.form === 'order' || card.answer.form === 'match');
        const said = a === undefined || drawn ? '' : givenText(card, a.given);
        return (
          <section className="cg-face is-past" data-card={card.key} data-flow-past-answer={a === undefined ? '' : a.outcome.correct ? 'right' : 'wrong'}>
            <CardPrompt parts={card.prompt} />
            {drawn && <AnswerInput card={card} autoFocus={false} lang={W.lang} reveal={{ outcome: a.outcome, given: a.given }} onSubmit={() => undefined} />}
            {said !== '' && <p className="cg-flow-past-given"><span className="cg-muted">{W.yourAnswer}:</span> {said}</p>}
            {a !== undefined && <Verdict card={card} outcome={a.outcome} given={a.given} showGiven={false} marked {...(cg === null ? {} : { lib: cg.lib })} />}
          </section>
        );
      }
      case 'choice':
      case 'chapters': {
        const list = node.type === 'choice' ? (Array.isArray(k.options) ? k.options : []) : (Array.isArray(k.chapters) ? k.chapters : []);
        const prefix = node.type === 'choice' ? 'o' : 'c';
        return (
          <div className="cg-choices cg-choice-list" data-flow-past-choice={entry.exit ?? ''}>
            {list.map((o, i) => {
              const exit = `${prefix}${i}`;
              const raw = typeof o === 'object' && o !== null ? (o as { label?: unknown; title?: unknown }) : null;
              const label = (typeof raw?.label === 'string' ? raw.label : typeof raw?.title === 'string' ? raw.title : typeof o === 'string' ? o : '') || `${i + 1}`;
              const chosen = entry.exit === exit;
              return (
                <button key={exit} type="button" className={`cg-option cg-choice-item${chosen ? ' is-chosen' : ''}`} disabled>
                  <TexText text={label} />
                  {chosen && <span className="cg-muted">{W.chosenHere}</span>}
                </button>
              );
            })}
          </div>
        );
      }
      case 'detour': {
        const d = detourOf(node);
        const inner = d === null || d.flow === '' ? undefined : flowOf(d.flow);
        return (
          <div className="cg-detour" data-flow-past-detour={entry.exit ?? ''}>
            {inner !== undefined && <p className="cg-detour-name"><TexText text={inner.name} /></p>}
            <p className="cg-muted">{entry.exit === 'enter' || entry.exit === 'done' ? W.detourEntered : W.detourSkipped}</p>
          </div>
        );
      }
      case 'line':
        return <Bubble who={typeof k.character === 'string' ? content.entity(k.character) : null} text={typeof k.of === 'string' ? content.entity(k.of) : null} mood={typeof k.mood === 'string' ? k.mood : null} />;
      default:
        return null;
    }
  };

  if (routeTarget !== null && cg !== null && learner !== null) {
    return <StoryRoute key={routeTarget.id} target={routeTarget.id} startAsGoal={routeTarget.aim} lib={cg.lib} cards={content.cards ?? []} learner={learner} W={W} label={name}
      onClose={() => { setRouteTarget(null); setLockTick((n) => n + 1); }}
      onOpen={(id, story) => { setRouteTarget(null); if (story !== undefined) startStory(flowOf(story.id) ?? story); else startTopic(id); }}
      renderStory={(story, back) => <FlowPlayer flow={flowOf(story.id) ?? story} content={content} learner={learner} onClose={back} backLabel={W.nextRoute} onAnswer={onAnswer} />} />;
  }

  if (topicRun !== null && cg !== null) {
    const back = () => setTopicRun(null);
    return <RevisionRun key={topicRun.key} lib={cg.lib} learner={learner} source={topicRun.source} onClose={back} onDone={back}
      closing={{ openTopic: (id) => { const story = ahead?.stories.get(id); setTopicRun(null); if (story !== undefined) startStory(story); else startTopic(id); }, back, label: name }} />;
  }

  if ((lock.missing.length > 0 || lock.weak.length > 0 || directFirst !== null) && cg !== null) {
    /* Nach „Najpierw powtórz" weiter zur Erzählung (wie im Krajobraz); nach „Ucz się" an einem fehlenden Eintrag neu geprüft. */
    const back = () => { const weak = lockRun?.weak === true; setLockRun(null); if (weak) setUnlocked(true); else setLockTick((n) => n + 1); };
    if (lockRun !== null) return <RevisionRun key={lockRun.key} lib={cg.lib} learner={learner} source={lockRun.source} onClose={back} onDone={back} />;
    const all = content.cards ?? [];
    const runOf = (title: string, list: readonly Card[], weak: boolean) => {
      if (list.length === 0) return;
      setLockRun({ key: `lock:${Date.now()}`, weak, source: { plan: readPlan(list, { mode: 'temporal', order: 'general', pick: 'next', stackSize: 20, endWhenDone: true }), cards: all, title } });
    };
    const inWorkspace = typeof window !== 'undefined' && window.location.hash.startsWith('#/workspace');
    const missing = lock.missing.length > 0 || directFirst !== null;
    return (
      <section className="cg-flow cg-flow-locked" data-flow-locked={lock.missing.length > 0 ? 'missing' : directFirst !== null ? 'story' : 'weak'}>
        <div className="cg-flow-step">
          <h2><TexText text={root.name} /></h2>
          {directFirst !== null && <p className="wk-note" data-flow-story-first={directFirst.length}>{W.storyFirst(directFirst.map((x) => `„${x}”`).join(', '))}</p>}
          {missing ? (
            <>
              <p>{rich(t('cogitaLearnPath.flow.locked'), { b: (s) => <strong>{s}</strong> })}</p>
              <ol className="cg-flow-missing" data-flow-missing={lock.missing.length}>
                {lock.missing.map((id) => {
                  const origin = cg.lib.origin(id);
                  const own = cardsAbout(all, id);
                  return (
                    <li key={id} data-flow-missing-item={id}>
                      {inWorkspace && origin !== undefined ? <a className="cg-ref" href={originPath(origin, id, 'wpisy')}><TexText text={name(id)} /></a> : <TexText text={name(id)} />}
                      {learner !== null && own.length > 0 && <> · <button type="button" className="wk-link-btn" onClick={() => runOf(name(id), own, false)} data-flow-missing-learn={id}>{W.learn}</button></>}
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <>
              <p>{t('cogitaLearnPath.flow.weak', { count: lock.weak.length })}</p>
              <div className="wk-actions">
                <button type="button" className="wk-btn" onClick={() => runOf(t('cogitaLearnPath.flow.reviewFirstTitle', { name: root.name }), lock.weak, true)} data-flow-review-first={lock.weak.length}>{t('cogitaLearnPath.flow.reviewFirst', { n: lock.weak.length })}</button>
              </div>
            </>
          )}
          {learner !== null && root.unit !== undefined && <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn-line" onClick={() => setRouteTarget({ id: root.unit!, aim: false })}>{W.nextRoute}</button>
            <button type="button" className="wk-btn" title={W.nextGoalHint} onClick={() => setRouteTarget({ id: root.unit!, aim: true })} data-flow-goal="">{W.setGoal}</button>
          </div>}
          <div className="wk-actions">
            {cg.writes && <button type="button" className="wk-link-btn" onClick={() => setUnlocked(true)} data-flow-preview="">{t('cogitaLearnPath.flow.previewAnyway')}</button>}
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
            <p className="cg-muted">{t('cogitaLearnPath.flow.isPresentation')}</p>
            <div className="wk-actions"><a className="wk-btn" href={`#/${root.presentation}`}>{t('cogitaLearnPath.flow.openPresentation')}</a></div>
          </div>
        </section>
      );
    }
    return (
      <Suspense fallback={<Loading />}>
        <PresentationInNauka key={root.id} name={root.name} path={root.presentation} learner={learner} onClose={onClose} content={content} unit={root.unit ?? null}
          startAt={jumpTo == null || root.id !== flow.id ? null : { scene: jumpTo.step, at: jumpTo.at }} />
      </Suspense>
    );
  }

  if ((state.ended || current === undefined) && endToClose && onClose !== undefined) {
    return <EndToClose onClose={onClose} />;
  }
  if (state.ended || current === undefined) {
    /*
      2026-11-04 (Prompt 11) — DAS ENDE: was nach dieser Erzählung kommt — EIN grosser Knopf zum naheliegenden Nächsten (das
      erste, was jetzt möglich ist; sonst das nächste Feld der Karte; sonst zurück zur Karte), die anderen klein, was noch
      nicht geht mit dem Grund. Ist der Przegląd offen, bleibt „Powtórz przegląd" der grosse Knopf.
    */
    const choices = nextItems ?? [];
    return withPath(
      <section ref={endRef} className={`cg-flow cg-flow-${look}`} data-flow-ended={running.id} data-flow-running={running.id} data-flow-step={state.step ?? ''} data-flow-visited={state.visited.length} data-flow-depth={state.stack.length} data-flow-kept-done={posOf(running.id)?.done === true ? '1' : '0'} data-flow-kept-goals={posOf(running.id)?.goals?.length ?? 0}>
        {/*
          2026-11-05 — DAS ENDE wie jeder Schritt: oben „‹ Mapa" (gross) und „⋯" (Od początku, Zapomnij postęp — nur dort);
          darunter, was danach kommt, als EINE Liste untereinander: zuerst das Naheliegende, zuletzt „Od początku".
        */}
        <StoryHead W={W} back={onClose === undefined ? null : { label: backLabel ?? W.back, run: onClose }} crumbs={[{ label: running.name, id: running.id }, { label: W.storyEnd }]}
          menu={{ fromStart: restart, ...(learner === null ? {} : { forget }) }} />
        <div className="cg-flow-step">
          <h2 className="cg-flow-step-title" data-flow-title={running.id}>{W.storyEnd} — <TexText text={running.name} /></h2>
          {running.goals.length > 1 && <Goals flow={running} reached={goalsHeld} />}
          {requiredLeft.length > 0 && (
            <p className="wk-note" data-flow-required-left={requiredLeft.length}>
              {W.requiredLeft(requiredLeft.map((s) => { const n = stepNode.get(s); const d = n === undefined ? null : detourOf(n); return `„${(d === null ? undefined : flowOf(d.flow))?.name ?? s}”`; }).join(', '))}
              {' '}<button type="button" className="wk-link-btn" onClick={() => jumpToStep(requiredLeft[0])} data-flow-required-go="">{W.detourEnter}</button>
            </p>
          )}
          {running.goals.length > 0 && (
            <p className={reviewOpen ? 'wk-note' : 'cg-flow-end-passed'} data-flow-review={reviewOpen ? 'open' : 'passed'}>
              {reviewOpen ? W.reviewNotPassed : `✓ ${W.reviewPassed}`}
            </p>
          )}
          <StoryNextChoices choices={choices} W={W} reviewOpen={reviewOpen} onReview={toReview} onRestart={restart} />
        </div>
      </section>
    );
  }

  const c = current.config;
  /* 2026-11-05 (Prompt 23, A7a) — der Titel des Schrittes; ohne ihn bei einer Folie (Feld „blocks“) ihr eigener (ihr Name, z. B. „tytul“). */
  /* 2026-11-11 — auch eine Folie mit einem Wzór tekstu (`reading`) oder mit Textfeldern: ihr Name steht als Titel, einmal. */
  const slideTitle = (current.type === 'show' || current.type === 'expand') && typeof c.of === 'string' && c.of !== '' ? (() => { const e = content.entity(content.resolve?.(c.of as string) ?? (c.of as string)); return e !== null && slideText(e, cg?.lib ?? null) !== null ? e.label : null; })() : null;
  const title = typeof c.title === 'string' && c.title !== '' ? c.title : slideTitle;
  const item = state.item === undefined ? null : content.entity(state.item);
  /* 2026-11-05 — wer erzählt, steht nicht mehr da (der Eigentümer: „remove completely"); die Erzähler wirken nur noch in Präsentationen. */

  /* 2026-11-05 (Prompt 18) — „Dalej" steht unten in der Leiste (`next` merkt, was er tut); die Tastatur nimmt dasselbe. */
  let nextAct: (() => void) | null = null;
  let keyNext: (() => void) | null = null;
  const next = (act: () => void): null => { nextAct = act; return null; };

  const body = (() => {
    switch (current.type) {
      case 'show':
      case 'expand':
      case 'opening': {
        next(() => go('next'));
        return showBody(current, state.item);
      }
      case 'question': {
        const card = askedCardOf(current, content.card);
        if (card === null) return <><p className="wk-hint">{t('cogitaLearnPath.flow.noQuestion')}</p>{next(() => go('right'))}</>;
        const left = questionsLeft(running, current.id, content.card, marksOf).left;
        /* Dieselbe Frage wie eben, nach einer falschen Antwort: erst ein Przerywnik (eine gekonnte), dann sie wieder. */
        /* Nur beim Wiederkommen — nicht, solange die Rückmeldung zur eben falschen Antwort steht. */
        const back = answeredOn === null || answeredOn.step === `spacer:${current.id}`;
        const spacer = back && marksOf !== null && lastAsked !== null && lastAsked.key === card.key && lastAsked.wrong && spacerDone !== card.key
          ? pickSpacer(card, cardsInFlow(running, content.card), content.cards ?? [], marksOf) : null;
        const shown = spacer ?? card;
        const afterAnswer = () => {
          if (spacer !== null) { setSpacerDone(card.key); setAnsweredOn(null); return; }
          setSpacerDone(null);
          go(answeredOn?.correct === false ? 'wrong' : 'right');
        };
        /* Beantwortet: „Dalej" der Karte selbst; die Tastatur (→) tut dasselbe. */
        if (answeredOn !== null) keyNext = afterAnswer;
        return (
          <>
            <AskHead W={W} left={left} done={askedHere} card={shown} spacer={spacer !== null} marks={marksOf} topic={(id) => content.label?.(id) ?? content.entity(id)?.label ?? id} story={running.name} />
            <CardFace key={`${shown.key}:${spacer !== null ? 's' : 'q'}:${visit}`} card={shown} lang={W.lang} {...(cg === null ? {} : { lib: cg.lib })} stats={statsOf(shown)}
              onAnswered={(outcome, given) => {
                /* Ein Przerywnik ändert den Plan nur, wenn er falsch beantwortet wird. */
                if (spacer !== null) { if (!outcome.correct) learner?.record(shown, outcome.correctness, { via: running.id }); setAnsweredOn({ step: `spacer:${current.id}`, correct: outcome.correct }); return; }
                /* 2026-11-01 — mit der Antwort: Podpowiedzi und gezogene Werte (wie in einer Powtórka). */
                learner?.record(card, outcome.correctness, { via: running.id, ...(outcome.hints === undefined ? {} : { hints: outcome.hints }), ...(card.params === undefined ? {} : { params: card.params }) });
                onAnswer?.(current.id, card, outcome.correctness, given);
                /* 2026-11-05 (Prompt 18) — für „Wstecz": diese Antwort, wie sie war (gezeigt, nie wieder gefragt). */
                lastAnswer.current = { card, outcome, given };
                setAnsweredOn({ step: current.id, correct: outcome.correct });
                setAskedHere((n) => n + 1);
                setLastAsked({ key: card.key, wrong: !outcome.correct });
              }}
              onNext={afterAnswer} />
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
              const label = (typeof o === 'object' && o !== null && typeof (o as { label?: unknown }).label === 'string' ? (o as { label: string }).label : typeof o === 'string' ? o : '') || t('cogitaLearnPath.flow.option', { n: i + 1 });
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
                      {cond.type === 'not' && cond.items?.length === 1 ? t('cogitaLearnPath.flow.closedBecause', { why: conditionText(cond.items[0], name) }) : t('cogitaLearnPath.flow.closedUntil', { when: conditionText(cond, name) })}
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
            <p className="cg-muted" data-flow-merge={`${done}/${all}`}>{left.length > 0 ? t('cogitaLearnPath.flow.mergedNext', { merged: mergeWords(done, all, t.lang) }) : t('cogitaLearnPath.flow.merged', { merged: mergeWords(done, all, t.lang) })}</p>
            {left.length === 0 ? next(() => go('done')) : (
              <div className="cg-choices cg-choice-list">
                {(Array.isArray(c.chapters) ? c.chapters : []).map((one, i) => {
                  const exit = `c${i}`;
                  const chapterTitle = (typeof one === 'object' && one !== null && typeof (one as { title?: unknown }).title === 'string' ? (one as { title: string }).title : typeof one === 'string' ? one : '') || t('cogitaLearnPath.flow.chapter', { n: i + 1 });
                  const isLeft = left.some((x) => x.exit === exit);
                  const workWords = workOf(exit);
                  return (
                    <button key={exit} type="button" className={`cg-option cg-choice-item${isLeft ? '' : ' is-done'}`} disabled={!isLeft} onClick={() => go(exit)} {...lightOf(current.id, exit)} data-flow-option={exit} data-flow-option-done={isLeft ? '0' : '1'}>
                      <TexText text={chapterTitle} />
                      <span className="cg-muted">{isLeft ? workWords : W.done}</span>
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
            {next(() => go('next'))}
          </>
        );
      }
      /* Automatische Schritte hält der Spieler nie an (`enterAt`); steht er doch auf einem (alte Stelle): weiter, wie er ausgeht. */
      case 'condition':
        return next(() => go(holds(readCondition(c.condition), facts(state)) ? 'yes' : 'no'));
      case 'set':
        return next(() => go('next'));
      /* 2026-11-05 (Prompt 23, D4) — der Przegląd in einem Schritt: die noch nicht gekonnten Fragen der Erzählung, dann das Ergebnis. */
      case 'review': {
        const rc = reviewOf(running, current)!;
        return (
          <ReviewStep key={`${current.id}:${visit}`} cards={reviewCards(running, rc, content.card, flowOf, current.id)} known={(card) => marksOf !== null && isKnown(card, marksOf)} threshold={rc.threshold} W={W} stats={statsOf}
            onAnswer={(card, outcome, given) => {
              learner?.record(card, outcome.correctness, { via: running.id, ...(outcome.hints === undefined ? {} : { hints: outcome.hints }), ...(card.params === undefined ? {} : { params: card.params }) });
              onAnswer?.(current.id, card, outcome.correctness, given);
            }}
            onDone={(passed) => go(passed ? 'passed' : 'notyet')} />
        );
      }
      /*
        2026-11-04 (Prompt 13) — EIN ABSTECHER: die andere Erzählung beim Namen, was dort wartet, „Wejdź" und „Dalej bez tego";
        schon ukończona — „już znasz", „Przypomnij" und „Dalej"; Pflicht ("optional": false) — nur „Wejdź".
      */
      case 'detour': {
        const d = detourOf(current)!;
        const inner = d.flow === '' ? undefined : flowOf(d.flow);
        const on = (exit: 'done' | 'skip') => go(exit);
        const cross = crossOf(d.flow);
        if (cross !== null) {
          const step = state.step ?? '';
          return <CrossDetourStep key={step} cross={cross} label={d.label} holder={learner?.holder ?? null} W={W} next={next} onExit={on} onEnter={(world, name, flowId) => setCrossRun({ world, name, flowId, step })} />;
        }
        if (inner === undefined) return <><p className="wk-note" data-flow-detour-missing="">{W.detourMissing}</p>{next(() => on(d.optional ? 'skip' : 'done'))}</>;
        /* 2026-11-05 (Prompt 23, B4/A8) — dieselbe Karte wie im Fenster eines Zweiges der Ścieżka (`DetourCard`), mit dem Satz ihrer Einheit. */
        return <DetourCard {...detourCardOf(d, inner)} next={next} onExit={on} autoFocus />;
      }
      /* 2026-10-22 (Schritt 12) — eine Szene einer Präsentation in einem gewöhnlichen Ablauf: ihr Name und der Weg zu ihr. */
      case 'scene': {
        const page = typeof c.page === 'string' ? c.page.replace(/^#?\/?/, '') : '';
        return (
          <>
            <p className="cg-muted">{t('cogitaLearnPath.flow.scene')}</p>
            {page !== '' && <a className="wk-link" href={`#/${page}`} target="_blank" rel="noopener">{t('cogitaLearnPath.flow.openPresentation')}</a>}
            {next(() => go('next'))}
          </>
        );
      }
      default:
        return <><p className="cg-muted">{STEP_LABEL[current.type as keyof typeof STEP_LABEL] ?? current.type}</p>{next(() => go('next'))}</>;
    }
  })();

  /*
    2026-11-05 (Prompt 18) — EINE KOPFZEILE: links zurück (dorthin, woher er kam — im Abstecher in die rufende Erzählung), in der
    Mitte, wo er ist (Erzählung › Schritt; rufende Erzählungen führen zurück), rechts „⋯" mit „Od początku" und „Zapomnij postęp".
    Darunter der Fortschritt — dieselbe Zählung wie die Ścieżka daneben (`pathNow`), im Przegląd die des Przegląd.
  */
  const lookClass = `cg-flow cg-flow-${look === 'slides' || look === 'scenes' ? 'slides' : look === 'flashcards' ? 'cards' : 'reading'}`;
  const inDetour = depths.length > 0 && trail.length > 0;
  const backTarget = inDetour
    ? { label: trail[trail.length - 1].name, run: () => goBack(depths[0]), detour: trail[trail.length - 1].id }
    : onClose === undefined ? null : { label: backLabel ?? W.back, run: onClose };
  const crumbsOf = (r: StoryRun, stepTitle: string | null, live: boolean): StoryCrumb[] => {
    const outer = r.state.stack.map((x) => flowOf(x.flow)).filter((f): f is Flow => f !== undefined);
    const can = live ? depths : [];
    const story = flowOf(r.state.flow);
    return [
      ...outer.map((f, i) => ({ label: f.name, ...(can.includes(i) ? { run: () => goBack(i) } : {}) })),
      ...(story === undefined ? [] : [{ label: story.name, id: story.id }]),
      ...(stepTitle === null ? [] : [{ label: stepTitle }])
    ];
  };
  /* 2026-11-05 (Prompt 23, A3) — eine Folie mit Fragen: im ⋯ „Pytania do tego slajdu (N)“ — eine kurze Powtórka mit genau diesen Karten. */
  const slideHere = (() => {
    if (cg === null || (current.type !== 'show' && current.type !== 'expand')) return null;
    const raw = typeof current.config.of === 'string' ? current.config.of : '';
    const id = raw === '' ? null : content.resolve?.(raw) ?? raw;
    if (id === null || !isSlideEntity(cg.lib, id)) return null;
    const qs = new Set(slideQuestionIds(cg.lib, id));
    const list = (content.cards ?? []).filter((x) => qs.has(x.question));
    if (list.length === 0) return null;
    const SW = slideWords(W.lang);
    return { label: SW.slideQuestions(qs.size), run: () => setTopicRun({ key: `slide:${id}:${Date.now()}`, source: { plan: readPlan(list, { mode: 'temporal', order: 'general', pick: 'next', stackSize: Math.min(20, list.length), endWhenDone: true }), cards: content.cards ?? [], title: SW.practiseTitle(name(id)) } }) };
  })();
  const menu = { fromStart: restart, ...(learner === null ? {} : { forget }), ...(slideHere === null ? {} : { slide: slideHere }), ...(pathModelNow.nodes.length < 2 ? {} : { map: () => setMapOpen(true) }) };
  const partNow = state.step === null ? undefined : sp.parts[sp.partOfStep.get(state.step) ?? -1];
  const progress = (() => {
    if (partNow?.kind === 'review') {
      const cards = [...new Map(partNow.steps.map((s) => stepNode.get(s)).filter((n): n is GraphNode => n !== undefined)
        .map((n) => askedCardOf(n, content.card)).filter((x): x is Card => x !== null).map((x) => [x.key, x] as const)).values()];
      if (cards.length > 0) {
        const known = marksOf === null ? 0 : cards.filter((x) => isKnown(x, marksOf)).length;
        const mark = running.goals.length === 0 ? '' : ` · ${reviewOpen ? W.reviewOpenMark : W.reviewPassedMark}`;
        return { label: `${W.reviewProgress(known, cards.length)}${mark}`, share: known / cards.length, review: true }; // i18n-ignore
      }
    }
    const count = hexNow ?? pathNow;
    return { label: W.progressOf(count.done, count.total), share: count.total === 0 ? 0 : count.done / count.total, review: false };
  })();
  const head = (crumbs: readonly StoryCrumb[]) => (
    <StoryHead W={W} back={backTarget} crumbs={crumbs} menu={menu}
      {...(pathNow.total > 0 || progress.review ? { progress } : {})} />
  );

  /* „Wstecz" und „Dalej" — auch für Tastatur und Wischen (`keys`). */
  const canBack = past.length > backBy;
  const stepBack = () => setBackBy((b) => Math.min(past.length, b + 1));
  const stepForward = () => setBackBy((b) => Math.max(0, b - 1));
  keys.current = backBy > 0 ? { next: stepForward, back: canBack ? stepBack : null } : { next: nextAct ?? keyNext, back: canBack ? stepBack : null };
  const controls = (forward: (() => void) | null) => (canBack || forward !== null) && (
    <div className="cg-flow-controls" data-flow-controls="">
      {canBack && <button type="button" className="wk-btn wk-btn-line cg-flow-back" onClick={stepBack} data-flow-back="">‹ {W.stepBack}</button>}
      {forward !== null && <button type="button" className="wk-btn cg-flow-forward" onClick={forward} autoFocus data-flow-go="">{W.goOn} ›</button>}
    </div>
  );
  const touch = {
    onTouchStart: (e: ReactTouchEvent) => { touchAt.current = e.touches.length === 1 && !noSwipe(e.target) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; },
    onTouchEnd: (e: ReactTouchEvent) => {
      const s = touchAt.current;
      touchAt.current = null;
      if (s === null) return;
      const dx = e.changedTouches[0].clientX - s.x;
      const dy = e.changedTouches[0].clientY - s.y;
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6 || String(window.getSelection() ?? '') !== '') return;
      (dx < 0 ? keys.current.next : keys.current.back)?.();
    }
  };

  const shownPast = backBy > 0 ? past[past.length - backBy] : undefined;
  if (crossRun !== null) {
    const here = crossTrail.length > 0 ? crossTrail : [cg?.name ?? '', running.name].filter((x) => x !== '');
    return (
      <CrossRun world={crossRun.world} name={crossRun.name} flowId={crossRun.flowId} holder={learner?.holder ?? null} crumbs={here}
        onBack={(done) => { const at = crossRun.step; setCrossRun(null); if (done && runRef.current.state.step === at) go('done'); }}
        player={(p) => {
          const inner = contentOfLibrary(p.world, p.cards);
          const f = inner.flow(p.flowId);
          return f === undefined ? <p className="wk-note">{W.detourMissing}</p>
            : <FlowPlayer key={f.id} flow={f} content={inner} learner={p.learner} onClose={p.onClose} backLabel={p.backLabel} />;
        }} />
    );
  }
  return withPath(
    <div ref={stage} className="cg-story-stage" {...touch}>
      {shownPast !== undefined && (() => {
        const r = shownPast.run;
        const pFlow = flowOf(r.state.flow);
        const node = r.state.step === null ? undefined : pFlow?.graph.nodes.find((n) => n.id === r.state.step);
        const pTitle = node !== undefined && typeof node.config.title === 'string' && node.config.title !== '' ? node.config.title : null;
        return (
          <section className={`${lookClass} is-past`} data-flow-past={backBy} data-flow-step={r.state.step ?? ''}>
            {head(crumbsOf(r, pTitle, false))}
            <div className="cg-flow-step">
              {pTitle !== null && <h2 className="cg-flow-step-title"><TexText text={pTitle} /></h2>}
              <p className="cg-flow-past-note">{W.pastStep}</p>
              {node === undefined ? null : pastBody(node, shownPast, r.state.item)}
              {controls(stepForward)}
            </div>
          </section>
        );
      })()}
      <section className={`${lookClass}${shownPast !== undefined ? ' is-behind' : ''}`} data-flow-running={running.id} data-flow-step={state.step ?? ''} data-flow-visited={state.visited.length} data-flow-depth={state.stack.length} data-flow-kept-done={posOf(running.id)?.done === true ? '1' : '0'} data-flow-kept-goals={posOf(running.id)?.goals?.length ?? 0}
        data-flow-trail={trail.length} {...(inDetour ? { 'data-flow-back-detour': trail[trail.length - 1].id } : {})}>
        {head(crumbsOf(run, title, true))}
        {notice !== null && <p className="cg-muted" role="status" data-flow-returned="">{notice}</p>}
        {lines.length > 0 && (
          <div className="cg-bubbles">
            {lines.map((l) => <Bubble key={`${l.character}:${l.of}`} who={content.entity(l.character)} text={content.entity(l.of)} mood={null} />)}
          </div>
        )}
        <div className={`cg-flow-step${c.open === 'inline' ? ' cg-flow-inline' : ''}`}>
          {title !== null && <h2 className="cg-flow-step-title" data-flow-title={running.id}><TexText text={title} /></h2>}
          {item !== null && <p className="cg-muted"><TexText text={item.label} /></p>}
          {body}
          {controls(nextAct)}
        </div>
      </section>
    </div>
  );
}

/** 2026-11-05 (Prompt 18) — die Schritte, die „Wstecz" zeigen kann (die automatischen kommen nie vor). */
const SHOWN_STEPS: ReadonlySet<string> = new Set(['show', 'expand', 'opening', 'question', 'choice', 'chapters', 'line', 'detour', 'scene']);

/** Ein gezeigter Schritt, wie er war: der Lauf in diesem Moment, die gegebene Antwort, der gewählte Ausgang. */
interface PastStep {
  readonly run: StoryRun;
  readonly answer?: { readonly card: Card; readonly outcome: Outcome; readonly given: unknown };
  readonly exit?: string;
}

/** Wischen nicht in Feldern, beim Ordnen, auf der Ścieżka und nicht im Kopf. */
const noSwipe = (t: EventTarget | null): boolean => t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"], .cg-answer, .cg-story-mapview, .cg-story-head, [draggable="true"]') !== null;

interface StoryCrumb { readonly label: string; readonly id?: string; readonly run?: () => void }

/**
 * 2026-11-05 (Prompt 18) — DIE KOPFZEILE DES SPIELERS: „‹ Mapa" (woher er kam), die Brotkrumen (lange Namen gekürzt, ganz im
 * Hinweis), „⋯" mit „Od początku" und „Zapomnij postęp" (fragt nach); darunter der Fortschritt „4 z 14".
 */
/** Das Ende ohne eigene Seite: einmal zurück (nachdem der Stand gespeichert ist — ein Augenblick). */
function EndToClose({ onClose }: { onClose: () => void }) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => { const id = window.setTimeout(() => ref.current(), 150); return () => window.clearTimeout(id); }, []);
  return null;
}

function StoryHead({ W, back, crumbs, menu, progress }: {
  W: ReturnType<typeof words>;
  back: { readonly label: string; readonly run: () => void; readonly detour?: string } | null;
  crumbs: readonly StoryCrumb[];
  menu: { readonly fromStart: () => void; readonly forget?: () => void; readonly slide?: { readonly label: string; readonly run: () => void }; readonly map?: () => void };
  progress?: { readonly label: string; readonly share: number; readonly review: boolean };
}) {
  const box = useRef<HTMLDetailsElement | null>(null);
  const close = () => { if (box.current !== null) box.current.open = false; };
  return (
    <header className="cg-story-head">
      <div className="cg-story-headline">
        {back !== null && (
          <button type="button" className="wk-btn wk-btn-line cg-story-back" onClick={back.run} title={back.label}
            {...(back.detour === undefined ? { 'data-flow-close': '' } : { 'data-flow-back-to': back.detour })}>‹ <span>{back.label}</span></button>
        )}
        <nav className="cg-story-crumbs" aria-label={W.crumbs} data-flow-crumbs={crumbs.length}>
          <ol>
            {crumbs.map((x, i) => (
              <li key={i} title={x.label} {...(i === crumbs.length - 1 ? { 'aria-current': 'page' as const } : {})} {...(x.id === undefined ? {} : { 'data-flow-story': x.id })}>
                {x.run !== undefined ? <button type="button" className="wk-link-btn" onClick={x.run} data-flow-crumb={i}><TexText text={x.label} /></button> : <TexText text={x.label} />}
              </li>
            ))}
          </ol>
        </nav>
        <details ref={box} className="cg-story-menu" data-flow-menu="">
          <summary aria-label={W.moreTools} title={W.moreTools}>⋯</summary>
          <div className="cg-story-menu-body">
            {menu.map !== undefined && <button type="button" className="wk-link-btn" onClick={() => { close(); menu.map!(); }} data-flow-story-map="">{W.storyMap}</button>}
            {menu.slide !== undefined && <button type="button" className="wk-link-btn" onClick={() => { close(); menu.slide!.run(); }} data-flow-slide-questions="">{menu.slide.label}</button>}
            <button type="button" className="wk-link-btn" onClick={() => { close(); menu.fromStart(); }} data-flow-restart="">{W.fromStart}</button>
            {menu.forget !== undefined && <button type="button" className="wk-link-btn is-danger" onClick={() => { close(); menu.forget!(); }} data-flow-forget="">{W.forgetStory}</button>}
          </div>
        </details>
      </div>
      {progress !== undefined && (
        <div className={`cg-story-progress${progress.review ? ' is-review' : ''}`} data-flow-progress={progress.label}>
          <span className="cg-story-bar" aria-hidden><i ref={(el) => { if (el !== null) el.style.width = `${Math.round(Math.max(0, Math.min(1, progress.share)) * 100)}%`; }} /></span>
          <span className="cg-story-count">{progress.label}</span>
        </div>
      )}
    </header>
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


function Goals({ flow, reached }: { flow: Flow; reached: readonly string[] }) {
  return (
    <div className="cg-goals">
      {flow.goals.map((g) => <span key={g.id} className={`cg-tag${reached.includes(g.id) ? ' is-ok' : ''}`}>{reached.includes(g.id) ? '✓ ' : ''}<TexText text={g.title} /></span>)}
    </div>
  );
}

/** Ein Eintrag im Ablauf: eine Aussage ganz, andere mit ihren Feldern und Bildern. */
export function EntityView({ entity }: { entity: PublicEntity | null }) {
  const cg = useContext(CogitaContext);
  if (entity === null) return <p className="wk-hint">(tego wpisu tu nie ma)</p>;
  /*
    2026-11-05 (Prompt 24) — am Ende einer Folie (und eines Eintrags): die Karten „W innych światach" aus ihren Feldern
    (freiwillig — nur, wenn der Autor sie gesetzt hat; Links im Text stehen im Text).
  */
  const worlds = <WorldsSection data={cg?.lib.entry(entity.id)?.data} compact />;
  /*
    2026-10-22 — eine Aussage (ihre Bausteine als Zapis): ganz. 2026-11-11 (Eigentümer: „eine Folie zeigt ihren Text, nicht ihre
    Felder") — ebenso ein Eintrag mit Wzór tekstu (`reading`) oder mit Textfeldern: nur der Text, ohne Beschriftungen, ohne den
    Titel (er steht darüber) und ohne Verweisfelder (`slideText.ts`).
  */
  const text = slideText(entity, cg?.lib ?? null);
  if (text !== null) {
    return (
      <>
        {!text.blocks && entity.media.slice(0, 3).map((m) => <MediaView key={m.file} media={m} />)}
        <Markup text={text.text} />
        {worlds}
      </>
    );
  }
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
      {worlds}
    </div>
  );
}

function Bubble({ who, text, mood }: { who: PublicEntity | null; text: PublicEntity | null; mood: string | null }) {
  const portrait = who?.media.find((m) => m.type === 'image');
  const line = text?.fields.find((f) => f.key === 'text' || f.type === 'blocks')?.text ?? text?.label ?? '';
  const t = useT();
  return (
    <div className="cg-bubble">
      <span className="cg-bubble-face" title={who?.label ?? ''}>
        {portrait !== undefined ? <MediaView media={portrait} /> : (who?.label ?? '?').slice(0, 1)}
      </span>
      <span className="cg-bubble-text">
        <strong><TexText text={who?.label ?? t('cogitaLearnPath.flow.character')} />{mood !== null && mood !== '' ? <span className="cg-muted"> ({mood})</span> : null}</strong>
        <Markup text={line} />
      </span>
    </div>
  );
}
