/**
 * COGITA — EINE WIEDERHOLUNG LAUFEN LASSEN (COGITA.md §6, §7).
 *
 * Der Graph der Wiederholung wählt die Karten und den Weg (zufällig, einmal
 * alle, Stufen, nach der Kenntnis); der Lauf fragt sie nacheinander, hält jede
 * Antwort fest (versiegelt, an den Speicherbereich) und sagt am Ende, wann
 * die nächste fällig ist. Ohne Netz läuft er aus der Abschrift des Geräts.
 */

import { useContext, useEffect, useMemo, useRef, useState } from 'react';

import { CardFace } from './CardFace';
import type { Card } from './cards';
import { readGraph } from './graph';
import { LEVEL_LABEL, type Dependency } from './knowness';
import { renamer, sendReport, type Learner } from './learn';
import { keepOffline } from './offline';
import { answer, levelsOf, planOf, progress, start, type Plan, type Session } from './revision';
import type { CogitaLibrary } from './store';
import { Bar, CogitaContext } from './ui';

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
  const result = await planOf(readGraph(entry.data.graph), {
    cards,
    kindsOf: (id) => lib.entity(id)?.kinds ?? [],
    collection: (id) => lib.members(id),
    topic: (id, depth) => lib.topicTree(id, depth),
    marks: (key) => learner?.marks(key, fp.get(key), rename) ?? [],
    now
  });
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
  const saved = useRef(false);
  /* Wie oft jede Karte kam und wie oft falsch — am Ende ohne Namen an die Autoren [Q8]. */
  const tally = useRef(new Map<string, { asked: number; wrong: number }>());
  const rename = useMemo(() => (lib === null ? undefined : renamer(lib.merges())), [lib]);

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
          if (keep && !saved.current && learner !== null) {
            saved.current = true;
            const { cards: _cards, ...config } = plan;
            void keepOffline({
              libraryId: lib.libraryId, revisionId: source.revisionId, name: source.title ?? 'Powtórka', plan: config as Record<string, unknown>,
              cards: plan.cards, deps: lib.dependencies(), target: learner.target === null ? null : { areaId: learner.target.areaId, intake: null }, savedAt: Date.now()
            }, true);
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
    return (
      <section className="cg-face">
        <h2>Koniec powtórki</h2>
        <p>Odpowiedzi: {stats.answered}, dobrze: {stats.correct}{stats.answered > 0 ? ` (${Math.round((stats.correct / stats.answered) * 100)}%)` : ''}.</p>
        <p className="cg-muted">{(['known', 'learning', 'unseen'] as const).map((l) => `${LEVEL_LABEL[l]}: ${levels[l]}`).join(' · ')}</p>
        {due !== null && <p className="cg-muted">{due.next === null ? 'Nic nie czeka.' : `Następna powtórka: ${new Date(due.next).toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })}.`}</p>}
        {learner !== null && learner.waiting > 0 && <p className="wk-note">{learner.waiting} pakietów odpowiedzi czeka na internet — wyślą się same.</p>}
        {learner === null && <p className="wk-hint">Bez konta postępy zostają w tej przeglądarce.</p>}
        <div className="wk-actions">
          <button type="button" className="wk-btn" onClick={() => setRound((n) => n + 1)}>Jeszcze raz</button>
          {onClose !== undefined && <button type="button" className="wk-link-btn" onClick={onClose}>Wróć</button>}
        </div>
      </section>
    );
  }

  const share = p.total === null ? null : p.answered / Math.max(1, p.total);
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
        card={card}
        rule={session.plan.rule}
        lib={lib ?? undefined}
        onAnswered={(outcome, given, ms) => {
          learner?.record(card, outcome.correctness, { given: typeof given === 'string' ? given : JSON.stringify(given), ms, via: via ?? source.revisionId });
          const had = tally.current.get(card.key) ?? { asked: 0, wrong: 0 };
          tally.current.set(card.key, { asked: had.asked + 1, wrong: had.wrong + (outcome.correct ? 0 : 1) });
          onAnswer?.(card, outcome.correctness, given);
          setStats((s) => ({ answered: s.answered + 1, correct: s.correct + (outcome.correct ? 1 : 0) }));
          setPending(answer(session, outcome.correctness, Date.now()).session);
        }}
        onNext={() => { if (pending !== null) setState((was) => (was === null ? was : { ...was, session: pending })); setPending(null); setNote(null); }}
        foot={(
          <div className="cg-row-between">
            <span className="cg-muted">{card.answer.form === 'flash' ? 'Oceń się sam.' : ''}</span>
            <span className="cg-row">
              {learner !== null && <button type="button" className="wk-link-btn" onClick={() => { void learner.suspend(card.key, true); setNote('Ta karta nie będzie już pytana (możesz to cofnąć w Postępach).'); }}>Nie pytaj o to</button>}
              {lib !== null && <button type="button" className="wk-link-btn" onClick={() => {
                const text = window.prompt('Co jest nie tak z tą kartą? (autorzy zobaczą to bez Twojego imienia)');
                if (text === null || text.trim() === '') return;
                void sendReport(lib.libraryId, lib.areaId, 'flags', { card: card.key, question: card.question, text: text.trim().slice(0, 1000) }, ctx?.seat)
                  .then((ok) => setNote(ok ? 'Dziękujemy — autorzy dostaną zgłoszenie.' : 'Ta baza wiedzy nie przyjmuje jeszcze zgłoszeń.'), () => setNote('Nie udało się wysłać zgłoszenia.'));
              }}>Zgłoś błąd</button>}
            </span>
            {note !== null && <span className="wk-hint">{note}</span>}
          </div>
        )}
      />
    </div>
  );
}
