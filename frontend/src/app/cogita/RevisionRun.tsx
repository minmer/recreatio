/**
 * COGITA — EINE WIEDERHOLUNG LAUFEN LASSEN (COGITA.md §6, §7).
 *
 * Der Graph der Wiederholung wählt die Karten und den Weg (zufällig, einmal
 * alle, Stufen, nach der Kenntnis); der Lauf fragt sie nacheinander, hält jede
 * Antwort fest (versiegelt, an den Speicherbereich) und sagt am Ende, wann
 * die nächste fällig ist. Ohne Netz läuft er aus der Abschrift des Geräts.
 */

import { RunClosing, type Closing } from './RunClosing';
import { baseLang, words } from './lang';
import { Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { answerText, CardFace, givenText, storedGiven } from './CardFace';
import type { Card } from './cardBasics';
import { answerEvidence, redrawCard } from './cards';
import type { Outcome } from './check';
import { TopicIntro } from './EntityReading';
import { readGraph } from './graph';
import { learnerFlows } from './flowFacts';
import { LEVEL_LABEL, type Dependency } from './knowness';
import { spacingFor } from './spacing';
import { renamer, sendReport, type Learner } from './learn';
import { answerIndex } from './measures';
import { later } from '../ui/later';
import { toBase64Url } from '../core/crypto';
import { answersFor, keepOffline, needsFiles, offlineList, type OfflineRevision } from './offline';
import { AWAY_HERE } from '../core/away';
import { keepsKey, type Who } from '../core/session';
import { toast } from '../ui/dialogs';
import { answer, lessonProgress, levelsOf, planOf, practicePlan, progress, readPlan, start, waiting, whyDetail, whyText, type Plan, type Session } from './revision';
import { cardsAbout } from './prerequisites';
import { conditionText } from './logic';
import type { CogitaLibrary } from './store';
import { Bar, CogitaContext, entityNameTex } from './ui';
import { TexText } from '../ui/tex/Tex';
import { DailyGoal } from './DailyGoal';
import { LessonSummary, MissedCards } from './LessonEnd';
import { EMPTY_LOG, logAnswer, logSummary, logTick, nextLesson, type Missed, type RunLog } from './lessons';
import { DEFAULT_REWARDS, type RewardRules } from './rewards';
import { RewardBoard, RewardHud, RewardIcon } from './RewardViews';
import { freshlyKnown } from './knownNow';
import { motionWords } from './motionWords';
import { celebrateKnown } from './rewardBus';
import { SessionSummary } from './SessionSummary';

/* 2026-10-31 — die Statystyki am Ende einer Powtórka: erst geladen, wenn man sie aufklappt. */
const RunStats = later(() => import('./KnowCharts').then((m) => m.KnowledgeStats));
/* 2026-11-01 — nach jeder Antwort: wie sich die Kenntnis DIESER Karte entwickelt hat (dieselbe Datei, erst nach der ersten Antwort geladen). */
const CardHistory = later(() => import('./KnowCharts').then((m) => m.CardHistoryChart));

export interface RunSource {
  /** Aus der Bibliothek: die Wiederholung (ihr Graph wählt). */
  readonly revisionId?: string;
  /** Schon gewählt (eine öffentliche Wiederholung, die Abschrift ohne Netz). */
  readonly plan?: Plan;
  readonly cards?: readonly Card[];
  readonly deps?: readonly Dependency[];
  readonly title?: string;
}

/** Den Plan einer Wiederholung der Bibliothek rechnen — mit dem Fortschritt dieses Lernenden. */
export async function planFor(lib: CogitaLibrary, revisionId: string, learner: Learner | null, seed: string, now = Date.now()): Promise<{ plan: Plan | null; problems: string[]; cards: Card[] }> {
  const entry = lib.docs('revision').find((e) => e.id === revisionId);
  if (entry === undefined) return { plan: null, problems: ['Nie ma takiej powtórki.'], cards: [] };
  const { cards } = await lib.cards(seed);
  const rename = renamer(lib.merges());
  const fp = new Map(cards.map((c) => [c.key, c.fingerprint]));
  const result = await planOf(readGraph(entry.data.graph), lib.revisionContext(cards, (key) => learner?.marks(key, fp.get(key), rename) ?? [], now, learnerFlows(lib, learner?.progress.positions), spacingFor(lib, learner)));
  const plan = result.plan === null || learner === null ? result.plan : { ...result.plan, cards: result.plan.cards.filter((c) => !learner.progress.suspended.has(c.key)) };
  return { plan, problems: result.problems, cards };
}

export function RevisionRun({ lib, source: outer, learner, onClose, keep = false, via, onAnswer, onOpenRevision, lesson = false, rewards = null, onDone, closing, backToMap }: {
  lib: CogitaLibrary | null;
  source: RunSource;
  learner: Learner | null;
  onClose?: () => void;
  /**
   * Die Powtórka ist für die Zeit ohne Netz markiert („Trzymaj na urządzeniach bez internetu") — dann behält das
   * Gerät eine Abschrift, wenn das Konto seinen Schlüssel hier behält (`kept`); sonst sagt der Lauf, warum nicht.
   */
  keep?: boolean;
  /** Wohin die Antworten gehören (eine Sitzung, ein Ablauf) — sonst die Wiederholung. */
  via?: string;
  /** 0109 — jede Antwort auch nach aussen (eine Sitzung im eigenen Tempo zeigt sie dem Gastgeber). */
  onAnswer?: (card: Card, correctness: number, given: unknown) => void;
  /**
   * 2026-11-01 — „Następna lekcja": die Powtórka, die diese nennt (`next`), öffnen — der Baustein einer Seite stellt sich
   * auf sie um, die Nauka geht zu ihrer Adresse. Fehlt es: im Arbeitsbereich zur Adresse der Powtórka, sonst läuft sie
   * hier weiter.
   */
  onOpenRevision?: (revisionId: string, title: string) => void;
  /** 2026-11-01 — den Fortschritt „x z y kart" auch bei Stufen zeigen (das Üben am Ende einer Lektion). */
  lesson?: boolean;
  /**
   * 2026-11-02 — NAGRODY IM LAUF (`rewards.ts`): über den Karten Punkte, Serie und Tagesziel, nach jeder Antwort „+10";
   * am Ende die ganze Tafel. Welche Regel, sagt der Ort (der Baustein, die Ustawienia der Baza); `null`: keine.
   */
  rewards?: RewardRules | null;
  /**
   * 2026-11-03 — DIE FORTSETZUNG: endet der Lauf von selbst (nicht mit „Zakończ"), geht der Aufrufer gleich weiter —
   * der Krajobraz: erst die Wiederholung der Kette, dann direkt das Neue.
   */
  onDone?: () => void;
  /**
   * 2026-11-04 (Prompt 9) — DAS ENDE EINER POWTÓRKA: was der Gastgeber nach ihr anbietet (der Krajobraz: das Thema, das sie
   * verlangt hat, der nächste Schritt zum Ziel, die Karte). Ohne: was diese Powtórka freigeschaltet hat, zum Üben hier.
   */
  closing?: Closing;
  /** 2026-11-05 (Prompt 17) — zurück zur Landschaft (sie spielt dort ab, was sich änderte): „Wróć do mapy” am Ende. */
  backToMap?: () => void;
}) {
  const ctx = useContext(CogitaContext);
  /*
   * 2026-11-01 — DIE NÄCHSTE LEKTION AN ORT UND STELLE: ohne `onOpenRevision` und ausserhalb des Arbeitsbereichs (eine
   * Seite, ein Link) läuft sie in diesem Lauf weiter. Kommt von aussen eine andere Quelle, gilt wieder sie.
   */
  const [chain, setChain] = useState<{ readonly revisionId: string; readonly title: string } | null>(null);
  useEffect(() => { setChain(null); }, [outer.revisionId, outer.plan]);
  const source: RunSource = chain === null ? outer : { revisionId: chain.revisionId, title: chain.title, ...(outer.deps === undefined ? {} : { deps: outer.deps }) };
  /* Die Abschrift ohne Netz: was der Aufrufer für seine Powtórka sagt — für eine weitere Lektion, was die Baza sagt. */
  const keepThis = chain === null ? keep : ctx?.who != null && lib !== null && lib.settings().offline.includes(chain.revisionId);
  /* 2026-11-01 — was dieser Lauf über sich weiss (Zeit, erste Antworten, was nicht sass) und das Üben danach. */
  const [log, setLog] = useState<RunLog>(EMPTY_LOG);
  const [practice, setPractice] = useState<{ readonly plan: Plan; readonly title: string } | null>(null);
  const [round, setRound] = useState(0);
  const seed = useMemo(() => `${Date.now().toString(36)}:${round}`, [round]);
  const [state, setState] = useState<{ session: Session; all: readonly Card[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [stats, setStats] = useState({ answered: 0, correct: 0 });
  /* 2026-11-05 (Prompt 17) — gute Antworten hintereinander in diesem Lauf („5 z rzędu”) und wann er begann (das Ende rechnet ab dort). */
  const [inRow, setInRow] = useState(0);
  const startedAt = useRef(Date.now());
  const MW = motionWords(lib === null ? 'pl' : baseLang(lib));
  const [due, setDue] = useState<{ next: number | null; count: number } | null>(null);
  /* Die nächste Stelle des Laufs — erst nach „Dalej", damit das Urteil stehen bleibt. */
  const [pending, setPending] = useState<Session | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /* 2026-11-01 — „Zakończ”: das Ende des Laufs (Zusammenfassung, Statystyki), auch mitten im Stapel. */
  const [stopped, setStopped] = useState(false);
  /* 2026-11-04 (Prompt 9) — „Ćwicz dalej": nach dem Ende weiter, mit dem, was man am schwächsten kann („na zapas"). */
  const [onward, setOnward] = useState(false);
  const [handing, setHanding] = useState(false);
  const askedKeys = useRef(new Set<string>());
  const W = words(lib === null ? 'pl' : baseLang(lib));
  /* 2026-10-31 — die Antwort auf die Karte, die gerade dasteht (für „Zgłoś problem”), und das offene Zgłoszenie. */
  const [last, setLast] = useState<{ readonly outcome: Outcome; readonly given: unknown } | null>(null);
  const [flag, setFlag] = useState<string | null>(null);
  /* 2026-10-31 — die Themen, die dieser Lauf schon vorgestellt hat („Nowy temat” nur vor der ersten Frage). */
  const [introduced, setIntroduced] = useState<ReadonlySet<string>>(new Set());
  /* Gerechnet, wenn die Karte kommt — nach der Antwort hat das Thema Antworten, und die Vorstellung bliebe doch stehen. */
  const intro = useRef<{ at: string; ids: readonly string[] }>({ at: '', ids: [] });
  /* 2026-11-01 — eine Frage mit Parametern: bei jedem Zeigen neue Zahlen (`redrawCard`), gemerkt für dieses Zeigen. */
  const drawn = useRef<{ at: string; card: Card } | null>(null);
  /*
   * 2026-11-03 — AUCH EIN SZABLON MIT ZUFALL (Generator): kommt seine Karte in diesem Lauf wieder, entsteht eine neue
   * Fassung (`lib.redrawn`, asynchron — vor „Dalej” gerechnet); beim ersten Zeigen gilt die des Plans. Je Stelle gemerkt.
   */
  const instances = useRef(new Map<string, Card>());
  /* Je Karte die zuletzt gefragte Fassung (mit ihren Werten). */
  const askedLast = useRef(new Map<string, Card>());
  const shownKeys = useRef(new Set<string>());
  /* Für welche Powtórka die Abschrift schon gemacht ist (eine weitere Lektion im selben Lauf bekommt ihre eigene). */
  const saved = useRef<string | null>(null);
  /*
   * 2026-10-28 — die Abschrift für die Zeit ohne Netz, wie sie abgelegt wurde: am Ende des Laufs (und beim
   * Verlassen) kommt auch hinein, was JETZT beantwortet wurde — sonst finge die erste Runde ohne Netz bei dem an,
   * was vor diesem Lauf galt.
   */
  const keptCopy = useRef<{ copy: OfflineRevision; who: Who } | null>(null);
  const learnerNow = useRef(learner);
  learnerNow.current = learner;
  const renameNow = useRef<((key: string) => string) | undefined>(undefined);
  const refreshKept = () => {
    const had = keptCopy.current;
    const who = learnerNow.current;
    if (had === null || who === null) return;
    void keepOffline({ ...had.copy, answers: answersFor(had.copy.cards, who.progress.answers.values(), renameNow.current), savedAt: Date.now() }, had.who).catch(() => false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- liest nur Refs
  useEffect(() => () => refreshKept(), []);
  /* Wie oft jede Karte kam und wie oft falsch — am Ende ohne Namen an die Autoren [Q8]. */
  const tally = useRef(new Map<string, { asked: number; wrong: number }>());
  const rename = useMemo(() => (lib === null ? undefined : renamer(lib.merges())), [lib]);
  renameNow.current = rename;

  /*
   * 2026-10-31 — DER LERNENDE KOMMT OFT NACH DEM LAUF: `useLearner` lädt erst seine Antworten, und eine Powtórka mit
   * eigenem Bereich für Antworten bekommt ihren Lernenden erst beim Öffnen. Bis dahin plante der Lauf ohne den
   * Fortschritt, nahm keine Antwort an — und die Abschrift für die Zeit ohne Netz entstand nie (Nauka bez internetu:
   * „Nic"). Kommt er, bevor etwas beantwortet ist, plant der Lauf neu, mit ihm; war schon geantwortet, bleibt der Lauf,
   * und nur die Abschrift kommt jetzt.
   */
  const [arrived, setArrived] = useState(learner !== null);
  useEffect(() => { if (learner !== null) setArrived(true); }, [learner]);
  const answeredHere = useRef(0);
  const planned = useRef<{ readonly plan: Plan; readonly withLearner: boolean } | null>(null);
  /** Wie es um die Abschrift steht — gesagt am Ende des Laufs (in der App; im Browser hilft sie nur dem offenen Tab). */
  const [kept, setKept] = useState<'saved' | 'no-key' | 'failed' | null>(null);

  /**
   * DIE ABSCHRIFT FÜR DIE ZEIT OHNE NETZ — sobald Plan UND Lernender da sind. 2026-10-27: die Karten ohne Dateien (die
   * öffnen sich nur online), der Schlüssel der Annahme (sonst liest der Kurs die Antworten nie) und was schon
   * beantwortet ist (sonst hielte ein „Filtr znajomości" ohne Netz alles zurück; seine Bedingungen liegen im Plan).
   * 2026-10-28 — und wer lernt (die Person mit ihrem öffentlichen Schlüssel): ohne Netz und ohne offenen
   * Schlüsselbund wird für sie versiegelt.
   */
  const keepCopy = (plan: Plan, made: Learner): void => {
    const keeper = ctx?.who ?? null;
    if (!keepThis || saved.current === (source.revisionId ?? null) || lib === null || source.revisionId === undefined || keeper === null || made.holder.kind !== 'role') return;
    saved.current = source.revisionId;
    if (!keepsKey(keeper)) {
      if (AWAY_HERE) {
        setKept('no-key');
        toast('Ta powtórka jest do nauki bez internetu, ale na tym urządzeniu klucz nie jest zachowany — ustaw „Klucz zachowany na tym urządzeniu” (Konto → Bezpieczeństwo i klucze) i otwórz ją jeszcze raz.');
      }
      return;
    }
    const { cards: _cards, ...config } = plan;
    const cards = plan.cards.filter((c) => !needsFiles(c));
    const copy: OfflineRevision = {
      libraryId: lib.libraryId, revisionId: source.revisionId, name: source.title ?? 'Powtórka', plan: config as Record<string, unknown>,
      cards, deps: lib.dependencies(),
      target: made.target === null ? null : { areaId: made.target.areaId, intake: made.target.intake === null ? null : toBase64Url(made.target.intake) },
      holder: { roleId: made.holder.roleId, wrapPublicKey: toBase64Url(made.holder.wrapPublicKey) },
      answers: answersFor(cards, made.progress.answers.values(), rename),
      savedAt: Date.now()
    };
    keptCopy.current = { copy, who: keeper };
    const libraryId = lib.libraryId;
    const revisionId = source.revisionId;
    void (async () => {
      const before = await offlineList(keeper.accountId).catch(() => []);
      const ok = await keepOffline(copy, keeper).catch(() => false);
      if (!AWAY_HERE) return;
      setKept(ok ? 'saved' : 'failed');
      if (!ok) toast('Nie udało się zapisać tej powtórki na tym urządzeniu do nauki bez internetu.');
      else if (!before.some((r) => r.libraryId === libraryId && r.revisionId === revisionId)) {
        toast('Zapisano na tym urządzeniu — tę powtórkę przejdziesz też bez internetu (Nauka → Bez internetu na tym urządzeniu).');
      }
    })();
  };

  useEffect(() => {
    /* Der Lernende kam, als schon geantwortet wurde: der Lauf bleibt, wie er ist — nur die Abschrift entsteht jetzt. */
    const was = planned.current;
    if (was !== null && !was.withLearner && learner !== null && answeredHere.current > 0) {
      planned.current = { ...was, withLearner: true };
      keepCopy(was.plan, learner);
      return undefined;
    }
    let alive = true;
    planned.current = null;
    answeredHere.current = 0;
    setState(null);
    setFailed(null);
    setStats({ answered: 0, correct: 0 });
    setInRow(0);
    startedAt.current = Date.now();
    setDue(null);
    setStopped(false);
    setLog(EMPTY_LOG);
    setPractice(null);
    void (async () => {
      try {
        let plan = source.plan ?? null;
        let all: readonly Card[] = source.cards ?? [];
        if (plan === null && lib !== null && source.revisionId !== undefined) {
          const made = await planFor(lib, source.revisionId, learner, seed);
          if (!alive) return;
          if (made.plan === null) { setFailed(made.problems.join(' ') || 'Powtórka nie dała planu.'); return; }
          plan = made.plan;
          all = made.cards;
          planned.current = { plan, withLearner: learner !== null };
          if (learner !== null) keepCopy(plan, learner);
        }
        if (plan === null) { if (alive) setFailed('Nie ma czego powtarzać.'); return; }
        if (plan.cards.length === 0) { if (alive) setFailed('W tej powtórce nie ma jeszcze żadnej karty.'); return; }
        const fp = new Map(all.map((c) => [c.key, c.fingerprint]));
        const session = start({
          plan, all: all.length > 0 ? all : plan.cards, deps: source.deps ?? lib?.dependencies() ?? [], now: Date.now(), seed,
          marks: (key) => learner?.marks(key, fp.get(key), rename) ?? [],
          /* 2026-11-04 (Prompt 15) — die Abstände, die für diesen Lernenden gelten: jeder Schritt im Lauf rechnet mit ihnen. */
          spacing: spacingFor(lib, learner)
        });
        if (alive) {
          setState({ session, all: all.length > 0 ? all : plan.cards });
          /* Die erste Karte ist da: von hier an zählt die Zeit. */
          setLog(logTick(EMPTY_LOG, Date.now()));
        }
      } catch (e) {
        if (alive) setFailed(e instanceof Error ? e.message : 'Nie udało się przygotować powtórki.');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `arrived`: einmal, wenn der Lernende da ist (oben)
  }, [lib?.libraryId, source.revisionId, source.plan, round, arrived]);

  /* 2026-11-01 — ein Lauf nach den Bändern endet oft nicht von selbst („na zapas”): „Zakończ” zeigt dasselbe Ende. */
  /*
    2026-11-04 (Prompt 9) — EINE POWTÓRKA HAT EIN ENDE: sobald alles, was fällig oder unbekannt war, zugleich gekonnt ist (ab
    100 %) — dieselbe Regel wie der Przegląd einer Erzählung —, ist sie zu Ende; was sie dann „na zapas" nähme, kommt nur
    nach „Ćwicz dalej".
  */
  const complete = state !== null && state.session.current !== null && state.session.why?.reason === 'ahead' && !onward;
  const ownEnd = state !== null && !stopped && (state.session.current === null || complete);
  const finished = state !== null && (state.session.current === null || stopped || complete);
  /* 2026-11-03 — von selbst zu Ende: einmal weitergeben (`onDone`); nach „Zakończ" nicht. */
  const doneFor = useRef<object | null>(null);
  /*
    2026-11-05 (Durchsicht) — der Zeitgeber hängt nicht mehr am Effekt: eine neue `onDone`-Funktion des Elternteils (bei
    jedem Rendern) räumte ihn ab, und der Lauf blieb auf „handing" stehen. Jetzt gilt die letzte `onDone`, und nur das
    Verlassen räumt ab.
  */
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const hasDone = onDone !== undefined;
  const doneTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(doneTimer.current), []);
  useEffect(() => {
    if (!hasDone || state === null || !ownEnd || doneFor.current === state) return;
    doneFor.current = state;
    void learner?.flush().catch(() => undefined);
    /* 2026-11-04 — kurz sagen, dass sie zu Ende ist, dann gleich weiter zum Thema, das sie verlangt hat (nicht zur Karte). */
    setHanding(true);
    window.clearTimeout(doneTimer.current);
    doneTimer.current = window.setTimeout(() => onDoneRef.current?.(), 1300);
  }, [state, ownEnd, hasDone, learner]);
  useEffect(() => {
    if (!finished || learner === null || state === null) return;
    void (async () => {
      await learner.flush().catch(() => undefined);
      refreshKept();
      setDue(await learner.reportDue(state.all, rename).catch(() => null));
    })();
  }, [finished, learner, state, rename]);

  /*
   * 0109 — DIE ZAHLEN DES LAUFS, OHNE NAMEN: je Karte gefragt und falsch, an
   * die Annahme der Bibliothek. Die Autoren sehen in „Do zrobienia", welche
   * Karte die meisten stolpern lässt — nicht, wer. Ohne Bibliothek (eine
   * öffentliche Seite) gibt es keinen Weg dorthin.
   */
  useEffect(() => {
    if (!finished || lib === null || tally.current.size === 0) return;
    const cards: Record<string, { asked: number; wrong: number }> = {};
    for (const [key, v] of tally.current) cards[key] = v;
    tally.current = new Map();
    void sendReport(lib.libraryId, lib.areaId, 'counts', { cards }, ctx?.seat).catch(() => undefined);
  }, [finished, lib, ctx?.seat]);

  /**
   * 2026-11-01 — „NASTĘPNA LEKCJA" öffnen: der Aufrufer weiss wie (ein Baustein stellt sich um, die Nauka geht zur
   * Adresse); sonst im Arbeitsbereich zur Adresse der Powtórka; sonst (eine Seite, ein Link) läuft sie hier weiter.
   */
  const openRevision = (id: string, name: string) => {
    refreshKept();
    if (onOpenRevision !== undefined) { onOpenRevision(id, name); return; }
    const to = ctx?.href('nauka', id) ?? '#';
    if (to !== '#' && typeof window !== 'undefined' && window.location.hash.startsWith('#/workspace')) { window.location.hash = to; return; }
    setChain({ revisionId: id, title: name });
  };

  if (failed !== null) return <div className="cg"><p className="wk-error">{failed}</p>{onClose !== undefined && <button type="button" className="wk-btn" onClick={onClose}>Wróć</button>}</div>;
  if (state === null) return <p className="wk-lede">Przygotowywanie kart…</p>;

  /* 2026-11-01 — „Ćwicz te jeszcze raz": genau diese Karten, bis jede sitzt; „Wróć" führt zurück zum Ende dieses Laufs. */
  if (practice !== null) {
    return (
      <RevisionRun lib={lib} learner={learner} source={{ plan: practice.plan, cards: state.all, ...(source.deps === undefined ? {} : { deps: source.deps }), title: practice.title }}
        via={via ?? source.revisionId} onAnswer={onAnswer} onClose={onClose ?? (() => setPractice(null))} lesson rewards={rewards} {...(closing === undefined ? {} : { closing })} />
    );
  }

  const session = state.session;
  const card = session.current === null ? undefined : state.all.find((c) => c.key === session.current) ?? session.plan.cards.find((c) => c.key === session.current);
  const p = progress(session);
  /* 2026-11-01 — eine Lektion (endet von selbst, wenn nichts mehr wartet) zeigt „x z y kart"; Stufen nur beim Üben. */
  const lessonNow = session.plan.mode === 'temporal' || lesson ? lessonProgress(session, Date.now()) : null;

  if (handing && state !== null) {
    return (
      <section className="cg-face" data-run-end="handing" role="status">
        <h2>{W.runDone(askedKeys.current.size)}</h2>
        {closing?.origin != null && <p className="cg-muted">{W.nowOpening(closing.label(closing.origin))}</p>}
      </section>
    );
  }
  if (session.current === null || card === undefined || stopped || complete) {
    const levels = levelsOf(session.plan, (key) => learner?.marks(key, undefined, rename) ?? [], Date.now(), spacingFor(lib, learner));
    /* 2026-10-30 — was noch wartet, weil seine Bedingung (noch) nicht gilt: was zuerst sitzen muss, und andere Bedingungen. */
    const held = waiting(session, Date.now());
    /* 2026-11-01 — was nicht sass (falsch, oder nur mit Podpowiedź), in der Folge, in der es geschah. */
    const missed = [...log.missed.entries()]
      .map(([key, why]) => ({ card: askedLast.current.get(key) ?? state.all.find((c) => c.key === key) ?? session.plan.cards.find((c) => c.key === key), why }))
      .filter((x): x is { card: Card; why: Missed } => x.card !== undefined);
    const summary = logSummary(log);
    /* In einer Sitzung entscheidet die Leitung, was als Nächstes kommt — dort keine „Następna lekcja". */
    const next = lib === null || source.revisionId === undefined || onAnswer !== undefined ? null : nextLesson(lib.docs('revision'), source.revisionId);
    return (
      <section className="cg-face" data-run-end={ownEnd ? 'complete' : 'stopped'}>
        <h2 data-run-end-title="">{ownEnd ? W.runDone(askedKeys.current.size) : W.runStopped}</h2>
        {/* 2026-11-05 (Prompt 17) — das Ende in einer Karte: Karten, richtig, Punkte, Themen, Wiederholungen, Tagesziel — und zur Karte. */}
        {stats.answered > 0 && (
          <SessionSummary learner={learner} cards={state.all} asked={[...askedKeys.current]} startedAt={startedAt.current} answered={stats.answered} correct={stats.correct}
            rewards={rewards} rename={rename} spacing={spacingFor(lib, learner)} onBackToMap={backToMap ?? null} MW={MW} />
        )}
        {ownEnd && lib !== null && (
          <RunClosing lib={lib} learner={learner} cards={state.all} asked={[...askedKeys.current]} closing={closing} W={W}
            onPractise={(id) => setPractice({ plan: readPlan(cardsAbout(state.all, id), { mode: 'temporal', order: 'general', pick: 'next', stackSize: 20, endWhenDone: true }), title: lib.label(lib.entity(id)!) })}
            onOnward={complete ? () => setOnward(true) : null} onBack={onClose ?? null} />
        )}
        <p>Odpowiedzi: {stats.answered}, dobrze: {stats.correct}{stats.answered > 0 ? ` (${Math.round((stats.correct / stats.answered) * 100)}%)` : ''}.</p>
        <LessonSummary answers={log.answers} cards={summary.cards} firstTry={summary.firstTry} activeMs={log.activeMs} done={lessonNow} />
        <p className="cg-muted">{(['known', 'learning', 'unseen'] as const).map((l) => `${LEVEL_LABEL[l]}: ${levels[l]}`).join(' · ')}</p>
        {due !== null && <p className="cg-muted">{due.next === null ? 'Nic nie czeka.' : `Następna powtórka: ${new Date(due.next).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}.`}</p>}
        {held.cards > 0 && (
          <p className="wk-note" data-held-back={held.cards}>
            {held.cards} {held.cards === 1 ? 'karta czeka' : 'kart czeka'}
            {/* 2026-11-01 — die Namen mit ihren Wzory (`entityNameTex`). */}
            {held.needs.length > 0 && <> na to, co trzeba znać wcześniej{lib !== null && <> — najpierw: {held.needs.slice(0, 4).map((id, i) => <Fragment key={id}>{i > 0 && ', '}<TexText text={entityNameTex(lib, id)} /></Fragment>)}</>}</>}
            {held.conditions.length > 0 && <>{held.needs.length > 0 ? '; ' : ' — '}warunek: <TexText text={held.conditions.slice(0, 2).map((c) => conditionText(c, (id) => (lib === null ? id : entityNameTex(lib, id)))).join('; ')} /></>}
            . Wejdą same, gdy warunek zacznie obowiązywać.
          </p>
        )}
        {learner !== null && learner.waiting > 0 && <p className="wk-note">{learner.waiting} pakietów odpowiedzi czeka na internet — wyślą się same.</p>}
        {kept === 'saved' && <p className="cg-muted" data-offline-kept="saved">Ta powtórka jest na tym urządzeniu także bez internetu — w stanie z teraz.</p>}
        {kept === 'no-key' && <p className="wk-note" data-offline-kept="no-key">Bez internetu jej tu nie ma: klucz nie jest zachowany na tym urządzeniu (Konto → Bezpieczeństwo i klucze).</p>}
        {kept === 'failed' && <p className="wk-note" data-offline-kept="failed">Nie udało się zapisać tej powtórki na tym urządzeniu do nauki bez internetu.</p>}
        {learner === null && <p className="wk-hint">Bez konta postępy zostają w tej przeglądarce.</p>}
        <MissedCards lib={lib} missed={missed}
          onPractice={() => setPractice({ plan: practicePlan(missed.map((m) => m.card)), title: `Ćwiczenie: ${source.title ?? 'Powtórka'}` })} />
        {/* 2026-11-01 — die Powtórka nennt die nächste (`next`): dorthin, in der Nauka, auf der Seite, über den Link. */}
        {next !== null && (
          <div className="cg-lesson-next" data-lesson-next={next.id}>
            <span className="cg-muted">Następna lekcja</span>
            <strong><TexText text={next.name} /></strong>
            <button type="button" className="wk-btn" data-lesson-next-open="" onClick={() => openRevision(next.id, next.name)}>Następna lekcja</button>
          </div>
        )}
        {/* 2026-11-01 (2.11) — nur mit „Serie dni nauki" in den Ustawienia der Baza; 2026-11-02 mit Nagrody statt dessen die Tafel. */}
        {rewards !== null && learner !== null ? <RewardBoard learner={learner} rules={rewards} rename={rename} shape="block" live={false} />
          : lib !== null && <DailyGoal lib={lib} learner={learner} compact />}
        <div className="wk-actions">
          <button type="button" className={next === null ? 'wk-btn' : 'wk-btn wk-btn-line'} onClick={() => setRound((n) => n + 1)}>Jeszcze raz</button>
          {onClose !== undefined && <button type="button" className="wk-link-btn" onClick={onClose}>Wróć</button>}
        </div>
        {/* 2026-10-31 — was ich in dieser Powtórka kann, als Diagramme (auch auf einer Seite, für die mit dem Link). */}
        {learner !== null && lib !== null && (
          <details className="cg-run-stats" data-run-stats="">
            <summary>Statystyki — co umiem w tej powtórce</summary>
            <RunStats lib={lib} cards={state.all} answers={answerIndex(learner.progress, rename)} />
          </details>
        )}
      </section>
    );
  }

  const share = p.total === null ? null : p.answered / Math.max(1, p.total);
  /*
   * 2026-10-31 — EIN NEUES THEMA KOMMT NICHT AUS DEM NICHTS: vor der ersten Frage über ein Thema („O czym”), das dieser
   * Lernende noch nie hatte (keine Karte darüber beantwortet) und das dieser Lauf noch nicht vorgestellt hat, steht es
   * da — Titel, Streszczenie, der Text zum Aufklappen. Nur bei „O czym”: eine Karte aus einem Szablon fragt oft nach
   * dem Namen des Eintrags selbst, sein Titel verriete die Antwort. Darum zählen als „schon gehabt” auch nur Fragen
   * über das Thema: kam zuerst eine Karte „Który to temat?”, steht das Thema vor seiner ersten Frage trotzdem da.
   */
  const now = Date.now();
  const at = `${card.key}#${session.step}`;
  if (intro.current.at !== at) {
    intro.current = {
      at,
      ids: lib === null ? [] : (card.about ?? []).filter((id) => id !== card.entity && !introduced.has(id) && lib.entity(id) !== undefined
        && state.all.filter((c) => (c.about ?? []).includes(id)).every((c) => (learner?.marks(c.key, c.fingerprint, rename).length ?? 0) === 0))
    };
  }
  const fresh = intro.current.ids;
  /* 2026-11-03 — ein Pytanie mit Generator: neu gezogen mit der Baza (`genWorld` — auch Einträge); ein Szablon: siehe `instances`. */
  const redraws = card.template === undefined && (card.params !== undefined || card.seed !== undefined);
  if (redraws && lib !== null && drawn.current?.at !== at) drawn.current = { at, card: redrawCard(card, card.entity === undefined ? undefined : lib.entity(card.entity), `${seed}#${session.step}`, lib.genWorld()) };
  const asked: Card = instances.current.get(at) ?? (redraws && drawn.current?.at === at ? drawn.current.card : card);
  const promptText = (asked.answer.form === 'gap' ? asked.answer.shown : asked.prompt.map((x) => x.text).join(' ')).replace(/\s+/g, ' ').trim().slice(0, 500);
  const sendFlag = (text: string) => {
    if (lib === null) return;
    setFlag(null);
    void sendReport(lib.libraryId, lib.areaId, 'flags', {
      card: card.key, question: card.question, text: text.trim().slice(0, 1000),
      prompt: promptText, given: last === null ? '' : givenText(asked, last.given).slice(0, 500), expected: answerText(asked).slice(0, 500),
      correctness: last === null ? null : last.outcome.correctness
    }, ctx?.seat)
      .then((ok) => setNote(ok ? 'Dziękujemy — autorzy dostaną zgłoszenie z tą kartą i Twoją odpowiedzią (bez Twojego imienia).' : 'Ta baza wiedzy nie przyjmuje jeszcze zgłoszeń.'), () => setNote('Nie udało się wysłać zgłoszenia.'));
  };
  return (
    <div className="cg">
      {rewards !== null && learner !== null && <RewardHud learner={learner} rules={rewards} rename={rename} />}
      <div className="cg-run-head">
        <strong><TexText text={source.title ?? 'Powtórka'} /></strong>
        <span className="cg-row">
          {/* 2026-11-01 — eine Lektion: wie viele Karten erledigt sind, von allen, die jetzt dazugehören (`lessonProgress`). */}
          {lessonNow !== null ? (
            <span className="cg-lesson-progress" data-lesson-progress={`${lessonNow.done}/${lessonNow.total}`} data-ask-left={Math.max(0, lessonNow.total - lessonNow.done)}>
              <Bar value={lessonNow.total === 0 ? 1 : lessonNow.done / lessonNow.total} label={W.left(Math.max(0, lessonNow.total - lessonNow.done))} />
              <strong data-ask-counter="">{onward ? W.whyAhead : W.left(Math.max(0, lessonNow.total - lessonNow.done))}</strong>
            </span>
          ) : (
            <>
              {share !== null && <Bar value={share} label="Postęp powtórki" />}
              <span className="cg-muted">{p.total === null ? `${p.answered} odpowiedzi` : `${p.answered} z ${p.total}`}</span>
            </>
          )}
          {/* 2026-11-05 (Prompt 17) — ab drei guten hintereinander ein leiser Zähler; bei 5, 10, 20 leuchtet er kurz. */}
          {inRow >= 3 && <span key={inRow} className={`cg-run-streak${inRow === 5 || inRow === 10 || inRow === 20 ? ' is-glow' : ''}`} data-run-streak={inRow}><RewardIcon name="flame" />{MW.inRow(inRow)}</span>}
          <button type="button" className="wk-link-btn" data-run-stop="" onClick={() => { void learner?.flush(); setLog((l) => logTick(l, Date.now())); setStopped(true); }}>Zakończ</button>
        </span>
      </div>
      <CardFace
        /* 2026-10-30 — jede Frage neu: kommt dieselbe Karte gleich wieder (allein im Stapel), steht sonst noch die alte Antwort da. */
        key={`${card.key}#${session.step}`}
        card={asked}
        rule={session.plan.rule}
        lib={lib ?? undefined}
        head={lib === null || fresh.length === 0 ? undefined : (
          /* 2026-10-31 — kurz, damit die Frage im Blick bleibt; mehrere Themen auf einmal je zwei Zeilen. Aufgeklappter Text wird nicht vorgelesen (aria-live der Karte). */
          <section className="cg-topic-intro" data-topic-intro={fresh.join(' ')} data-many={fresh.length > 1 ? '' : undefined} aria-label="Nowy temat" aria-live="off">
            <span className="cg-topic-tag">{fresh.length > 1 ? 'Nowe tematy' : 'Nowy temat'}</span>
            {fresh.map((id) => { const e = lib.entity(id); return e === undefined ? null : <TopicIntro key={id} lib={lib} entity={e} />; })}
          </section>
        )}
        onAnswered={(outcome, given, ms) => {
          answeredHere.current += 1;
          setLast({ outcome, given });
          /*
           * 2026-11-01 — KARTEN ARBEITEN ZUSAMMEN (`answerEvidence`): was die Antwort über einen Fakt sagt, zählt für jede
           * Karte, die ihn fragt — jedes gezeigte Paar einer langen Liste für seine Karte, zwei Vorlagen mit demselben
           * `asks` füreinander. Die gefragte Karte zählt mit dem, was über IHREN Fakt gesagt wurde.
           */
          const evidence = answerEvidence(asked, given, outcome, state.all);
          const others = evidence.slice(1);
          const q = evidence[0].correctness;
          const from = via ?? source.revisionId;
          /* 2026-11-01 — mit der Antwort: wie viele Podpowiedzi, welche Zahlen gezogen waren. */
          /* 2026-11-03 — und mit welchem Samen: dieselbe Aufgabe lässt sich wieder erzeugen (Postępy, Ćwicz te jeszcze raz). */
          askedKeys.current.add(card.key);
          /* 2026-11-04 (Prompt 10) — ein Przerywnik: richtig — nichts wird gespeichert (der Plan der Karte bleibt). */
          const spacerRight = session.why?.reason === 'spacer' && q >= session.plan.minCorrectness - 1e-9;
          if (spacerRight) { askedKeys.current.delete(card.key); setPending(answer(session, q, Date.now()).session); return; }
          const main = learner?.record(asked, q, { given: storedGiven(asked, given), ms, via: from, ...(outcome.hints === undefined ? {} : { hints: outcome.hints }), ...(asked.params === undefined ? {} : { params: asked.params }), ...(asked.seed === undefined ? {} : { seed: asked.seed }) });
          /* 2026-11-02 — mitgezählt mit dieser Antwort (`lead`): Punkte für „eine Antwort" gibt es nur einmal (`rewards.ts`). */
          for (const p of others) learner?.record(p.card, p.correctness, { ...(p.given === '' ? {} : { given: p.given }), via: from, ...(main === undefined ? {} : { lead: main.answer.id }) });
          /* 2026-11-03 — „Do poćwiczenia” am Ende zeigt die Fassung, nach der gefragt wurde (nicht die des Plans). */
          askedLast.current.set(card.key, asked);
          const had = tally.current.get(card.key) ?? { asked: 0, wrong: 0 };
          tally.current.set(card.key, { asked: had.asked + 1, wrong: had.wrong + (outcome.correct ? 0 : 1) });
          onAnswer?.(card, outcome.correctness, given);
          setStats((s) => ({ answered: s.answered + 1, correct: s.correct + (outcome.correct ? 1 : 0) }));
          setInRow((n) => (outcome.correct ? n + 1 : 0));
          /* 2026-11-05 (Prompt 17) — eben utrwalona (wie „utrwalona karta” der Punkte): die Karte zeigt es einmal. */
          if (learner !== null && outcome.correct && freshlyKnown(learner.marks(asked.key, asked.fingerprint, rename), (rewards ?? DEFAULT_REWARDS).known.days)) celebrateKnown(asked.key);
          /* 2026-11-01 — für das Ende: die erste Antwort je Karte, was nicht sass, die Zeit. */
          setLog((l) => logAnswer(l, card.key, outcome, Date.now()));
          setPending(answer(session, q, Date.now(), others.map((p) => ({ key: p.card.key, correctness: p.correctness }))).session);
        }}
        onNext={() => {
          const advance = () => {
            if (pending !== null) setState((was) => (was === null ? was : { ...was, session: pending }));
            setPending(null); setNote(null); setLast(null); setFlag(null);
            setLog((l) => logTick(l, Date.now()));
            if (fresh.length > 0) setIntroduced((was) => new Set([...was, ...fresh]));
          };
          /* 2026-11-03 — kommt als Nächstes eine Karte eines Szablon mit Zufall wieder: erst ihre neue Fassung, dann weiter. */
          shownKeys.current.add(card.key);
          const nextKey = pending?.current ?? null;
          const nextCard = pending === null || nextKey === null ? undefined : state.all.find((c) => c.key === nextKey) ?? pending.plan.cards.find((c) => c.key === nextKey);
          if (lib !== null && pending !== null && nextCard !== undefined && nextCard.template !== undefined && nextCard.varies && shownKeys.current.has(nextCard.key)) {
            const nextAt = `${nextCard.key}#${pending.step}`;
            void lib.redrawn(nextCard, `${seed}#${pending.step}`).then((fresh2) => { instances.current.set(nextAt, fresh2); advance(); }, advance);
            return;
          }
          advance();
        }}
        foot={(
          <div className="cg-card-foot">
            <div className="cg-row-between">
              {/* 2026-10-30 — jede Wahl erklärbar: warum gerade diese Karte; 2026-10-31 kurz, das Ganze als Hinweis. */}
              <span className="cg-muted cg-why" data-why={session.why?.reason ?? ''} title={session.why === null ? undefined : whyDetail(session.why, now)}>{card.answer.form === 'flash' ? 'Oceń się sam. ' : ''}{(() => { const id = (card.about ?? [])[0]; const e = id === undefined || lib === null ? undefined : lib.entity(id); return e === undefined || lib === null ? '' : `${W.topicIs}: ${lib.label(e)} · `; })()}{session.why === null ? '' : whyText(session.why, now)}</span>
              <span className="cg-row">
                {learner !== null && <button type="button" className="wk-link-btn" onClick={() => { void learner.suspend(card.key, true); setNote('Ta karta nie będzie już pytana (możesz to cofnąć w Postępach).'); }}>Nie pytaj o to</button>}
                {lib !== null && <button type="button" className="wk-link-btn" aria-expanded={flag !== null} data-flag-open="" onClick={() => setFlag((was) => (was === null ? '' : null))}>Zgłoś problem</button>}
              </span>
            </div>
            {flag !== null && (
              <form className="cg-flag" data-flag-form="" onSubmit={(e) => { e.preventDefault(); if (flag.trim() !== '') sendFlag(flag); }}>
                <label className="wk-field">
                  <span>Co jest nie tak z tą kartą? Autorzy zobaczą kartę, pytanie i Twoją odpowiedź — bez Twojego imienia.</span>
                  <textarea rows={3} value={flag} autoFocus maxLength={1000} onChange={(e) => setFlag(e.target.value)} />
                </label>
                <div className="cg-row">
                  <button type="submit" className="wk-btn" disabled={flag.trim() === ''}>Wyślij</button>
                  <button type="button" className="wk-link-btn" onClick={() => setFlag(null)}>Anuluj</button>
                </div>
              </form>
            )}
            {note !== null && <p className="wk-note" role="status" data-flag-note="">{note}</p>}
            {/* 2026-11-01 — nach der Antwort: die Kenntnis dieser Karte über die Zeit, mit der eben gegebenen Antwort. */}
            {last !== null && learner !== null && (<div className="cg-card-history" data-card-history=""><CardHistory marks={learner.marks(card.key, card.fingerprint, rename)} spacing={spacingFor(lib, learner)} /></div>)}
          </div>
        )}
      />
    </div>
  );
}
