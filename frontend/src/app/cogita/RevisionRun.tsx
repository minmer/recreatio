/**
 * COGITA — EINE WIEDERHOLUNG LAUFEN LASSEN (COGITA.md §6, §7).
 *
 * Der Graph der Wiederholung wählt die Karten und den Weg (zufällig, einmal
 * alle, Stufen, nach der Kenntnis); der Lauf fragt sie nacheinander, hält jede
 * Antwort fest (versiegelt, an den Speicherbereich) und sagt am Ende, wann
 * die nächste fällig ist. Ohne Netz läuft er aus der Abschrift des Geräts.
 */

import { useContext, useEffect, useMemo, useRef, useState } from 'react';

import { answerText, CardFace, givenText } from './CardFace';
import type { Card } from './cardBasics';
import type { Outcome } from './check';
import { TopicIntro } from './EntityReading';
import { readGraph } from './graph';
import { LEVEL_LABEL, type Dependency } from './knowness';
import { renamer, sendReport, type Learner } from './learn';
import { answerIndex } from './measures';
import { later } from '../ui/later';
import { toBase64Url } from '../core/crypto';
import { answersFor, keepOffline, needsFiles, type OfflineRevision } from './offline';
import type { Who } from '../core/session';
import { answer, levelsOf, planOf, progress, start, waiting, whyDetail, whyText, type Plan, type Session } from './revision';
import { conditionText } from './logic';
import type { CogitaLibrary } from './store';
import { Bar, CogitaContext, entityName } from './ui';

/* 2026-10-31 — die Statystyki am Ende einer Powtórka: erst geladen, wenn man sie aufklappt. */
const RunStats = later(() => import('./KnowCharts').then((m) => m.KnowledgeStats));

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
  const result = await planOf(readGraph(entry.data.graph), lib.revisionContext(cards, (key) => learner?.marks(key, fp.get(key), rename) ?? [], now));
  const plan = result.plan === null || learner === null ? result.plan : { ...result.plan, cards: result.plan.cards.filter((c) => !learner.progress.suspended.has(c.key)) };
  return { plan, problems: result.problems, cards };
}

export function RevisionRun({ lib, source, learner, onClose, keep = false, via, onAnswer }: {
  lib: CogitaLibrary | null;
  source: RunSource;
  learner: Learner | null;
  onClose?: () => void;
  /** Darf das Gerät eine Abschrift für die Zeit ohne Netz behalten (`kept`)? */
  keep?: boolean;
  /** Wohin die Antworten gehören (eine Sitzung, ein Ablauf) — sonst die Wiederholung. */
  via?: string;
  /** 0109 — jede Antwort auch nach aussen (eine Sitzung im eigenen Tempo zeigt sie dem Gastgeber). */
  onAnswer?: (card: Card, correctness: number, given: unknown) => void;
}) {
  const ctx = useContext(CogitaContext);
  const [round, setRound] = useState(0);
  const seed = useMemo(() => `${Date.now().toString(36)}:${round}`, [round]);
  const [state, setState] = useState<{ session: Session; all: readonly Card[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [stats, setStats] = useState({ answered: 0, correct: 0 });
  const [due, setDue] = useState<{ next: number | null; count: number } | null>(null);
  /* Die nächste Stelle des Laufs — erst nach „Dalej", damit das Urteil stehen bleibt. */
  const [pending, setPending] = useState<Session | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /* 2026-10-31 — die Antwort auf die Karte, die gerade dasteht (für „Zgłoś problem”), und das offene Zgłoszenie. */
  const [last, setLast] = useState<{ readonly outcome: Outcome; readonly given: unknown } | null>(null);
  const [flag, setFlag] = useState<string | null>(null);
  /* 2026-10-31 — die Themen, die dieser Lauf schon vorgestellt hat („Nowy temat” nur vor der ersten Frage). */
  const [introduced, setIntroduced] = useState<ReadonlySet<string>>(new Set());
  /* Gerechnet, wenn die Karte kommt — nach der Antwort hat das Thema Antworten, und die Vorstellung bliebe doch stehen. */
  const intro = useRef<{ at: string; ids: readonly string[] }>({ at: '', ids: [] });
  const saved = useRef(false);
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

  useEffect(() => {
    let alive = true;
    setState(null);
    setFailed(null);
    setStats({ answered: 0, correct: 0 });
    setDue(null);
    void (async () => {
      try {
        let plan = source.plan ?? null;
        let all: readonly Card[] = source.cards ?? [];
        if (plan === null && lib !== null && source.revisionId !== undefined) {
          const made = await planFor(lib, source.revisionId, learner, seed);
          if (made.plan === null) { if (alive) setFailed(made.problems.join(' ') || 'Powtórka nie dała planu.'); return; }
          plan = made.plan;
          all = made.cards;
          const keeper = ctx?.who ?? null;
          if (keep && !saved.current && learner !== null && keeper !== null && learner.holder.kind === 'role') {
            saved.current = true;
            const { cards: _cards, ...config } = plan;
            /*
             * 2026-10-27 — für die Zeit ohne Netz: die Karten ohne Dateien (die öffnen sich nur online), der Schlüssel der
             * Annahme (sonst liest der Kurs die Antworten nie) und was schon beantwortet ist (sonst hielte ein „Filtr
             * znajomości" ohne Netz alles zurück; seine Bedingungen liegen im Plan). 2026-10-28 — und wer lernt (die Person mit ihrem öffentlichen
             * Schlüssel): ohne Netz und ohne offenen Schlüsselbund wird für sie versiegelt.
             */
            const cards = plan.cards.filter((c) => !needsFiles(c));
            const copy: OfflineRevision = {
              libraryId: lib.libraryId, revisionId: source.revisionId, name: source.title ?? 'Powtórka', plan: config as Record<string, unknown>,
              cards, deps: lib.dependencies(),
              target: learner.target === null ? null : { areaId: learner.target.areaId, intake: learner.target.intake === null ? null : toBase64Url(learner.target.intake) },
              holder: { roleId: learner.holder.roleId, wrapPublicKey: toBase64Url(learner.holder.wrapPublicKey) },
              answers: answersFor(cards, learner.progress.answers.values(), rename),
              savedAt: Date.now()
            };
            keptCopy.current = { copy, who: keeper };
            void keepOffline(copy, keeper).catch(() => false);
          }
        }
        if (plan === null) { if (alive) setFailed('Nie ma czego powtarzać.'); return; }
        if (plan.cards.length === 0) { if (alive) setFailed('W tej powtórce nie ma jeszcze żadnej karty.'); return; }
        const fp = new Map(all.map((c) => [c.key, c.fingerprint]));
        const session = start({
          plan, all: all.length > 0 ? all : plan.cards, deps: source.deps ?? lib?.dependencies() ?? [], now: Date.now(), seed,
          marks: (key) => learner?.marks(key, fp.get(key), rename) ?? []
        });
        if (alive) setState({ session, all: all.length > 0 ? all : plan.cards });
      } catch (e) {
        if (alive) setFailed(e instanceof Error ? e.message : 'Nie udało się przygotować powtórki.');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib?.libraryId, source.revisionId, source.plan, round]);

  const finished = state !== null && state.session.current === null;
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

  if (failed !== null) return <div className="cg"><p className="wk-error">{failed}</p>{onClose !== undefined && <button type="button" className="wk-btn" onClick={onClose}>Wróć</button>}</div>;
  if (state === null) return <p className="wk-lede">Przygotowywanie kart…</p>;

  const session = state.session;
  const card = session.current === null ? undefined : state.all.find((c) => c.key === session.current) ?? session.plan.cards.find((c) => c.key === session.current);
  const p = progress(session);

  if (session.current === null || card === undefined) {
    const levels = levelsOf(session.plan, (key) => learner?.marks(key, undefined, rename) ?? [], Date.now());
    /* 2026-10-30 — was noch wartet, weil seine Bedingung (noch) nicht gilt: was zuerst sitzen muss, und andere Bedingungen. */
    const held = waiting(session, Date.now());
    return (
      <section className="cg-face">
        <h2>Koniec powtórki</h2>
        <p>Odpowiedzi: {stats.answered}, dobrze: {stats.correct}{stats.answered > 0 ? ` (${Math.round((stats.correct / stats.answered) * 100)}%)` : ''}.</p>
        <p className="cg-muted">{(['known', 'learning', 'unseen'] as const).map((l) => `${LEVEL_LABEL[l]}: ${levels[l]}`).join(' · ')}</p>
        {due !== null && <p className="cg-muted">{due.next === null ? 'Nic nie czeka.' : `Następna powtórka: ${new Date(due.next).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}.`}</p>}
        {held.cards > 0 && (
          <p className="wk-note" data-held-back={held.cards}>
            {held.cards} {held.cards === 1 ? 'karta czeka' : 'kart czeka'}{held.needs.length > 0
              ? ` na to, co trzeba znać wcześniej${lib !== null ? ` — najpierw: ${held.needs.slice(0, 4).map((id) => entityName(lib, id)).join(', ')}` : ''}`
              : ''}{held.conditions.length > 0 ? `${held.needs.length > 0 ? '; ' : ' — '}warunek: ${held.conditions.slice(0, 2).map((c) => conditionText(c, (id) => (lib === null ? id : entityName(lib, id)))).join('; ')}` : ''}. Wejdą same, gdy warunek zacznie obowiązywać.
          </p>
        )}
        {learner !== null && learner.waiting > 0 && <p className="wk-note">{learner.waiting} pakietów odpowiedzi czeka na internet — wyślą się same.</p>}
        {learner === null && <p className="wk-hint">Bez konta postępy zostają w tej przeglądarce.</p>}
        <div className="wk-actions">
          <button type="button" className="wk-btn" onClick={() => setRound((n) => n + 1)}>Jeszcze raz</button>
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
  const promptText = (card.answer.form === 'gap' ? card.answer.shown : card.prompt.map((x) => x.text).join(' ')).replace(/\s+/g, ' ').trim().slice(0, 500);
  const sendFlag = (text: string) => {
    if (lib === null) return;
    setFlag(null);
    void sendReport(lib.libraryId, lib.areaId, 'flags', {
      card: card.key, question: card.question, text: text.trim().slice(0, 1000),
      prompt: promptText, given: last === null ? '' : givenText(card, last.given).slice(0, 500), expected: answerText(card).slice(0, 500),
      correctness: last === null ? null : last.outcome.correctness
    }, ctx?.seat)
      .then((ok) => setNote(ok ? 'Dziękujemy — autorzy dostaną zgłoszenie z tą kartą i Twoją odpowiedzią (bez Twojego imienia).' : 'Ta baza wiedzy nie przyjmuje jeszcze zgłoszeń.'), () => setNote('Nie udało się wysłać zgłoszenia.'));
  };
  return (
    <div className="cg">
      <div className="cg-run-head">
        <strong>{source.title ?? 'Powtórka'}</strong>
        <span className="cg-row">
          {share !== null && <Bar value={share} label="Postęp powtórki" />}
          <span className="cg-muted">{p.total === null ? `${p.answered} odpowiedzi` : `${p.answered} z ${p.total}`}</span>
          {onClose !== undefined && <button type="button" className="wk-link-btn" onClick={() => { void learner?.flush(); onClose(); }}>Zakończ</button>}
        </span>
      </div>
      <CardFace
        /* 2026-10-30 — jede Frage neu: kommt dieselbe Karte gleich wieder (allein im Stapel), steht sonst noch die alte Antwort da. */
        key={`${card.key}#${session.step}`}
        card={card}
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
          setLast({ outcome, given });
          learner?.record(card, outcome.correctness, { given: typeof given === 'string' ? given : JSON.stringify(given), ms, via: via ?? source.revisionId });
          const had = tally.current.get(card.key) ?? { asked: 0, wrong: 0 };
          tally.current.set(card.key, { asked: had.asked + 1, wrong: had.wrong + (outcome.correct ? 0 : 1) });
          onAnswer?.(card, outcome.correctness, given);
          setStats((s) => ({ answered: s.answered + 1, correct: s.correct + (outcome.correct ? 1 : 0) }));
          setPending(answer(session, outcome.correctness, Date.now()).session);
        }}
        onNext={() => {
          if (pending !== null) setState((was) => (was === null ? was : { ...was, session: pending }));
          setPending(null); setNote(null); setLast(null); setFlag(null);
          if (fresh.length > 0) setIntroduced((was) => new Set([...was, ...fresh]));
        }}
        foot={(
          <div className="cg-card-foot">
            <div className="cg-row-between">
              {/* 2026-10-30 — jede Wahl erklärbar: warum gerade diese Karte; 2026-10-31 kurz, das Ganze als Hinweis. */}
              <span className="cg-muted cg-why" data-why={session.why?.reason ?? ''} title={session.why === null ? undefined : whyDetail(session.why, now)}>{card.answer.form === 'flash' ? 'Oceń się sam. ' : ''}{session.why === null ? '' : whyText(session.why, now)}</span>
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
          </div>
        )}
      />
    </div>
  );
}
