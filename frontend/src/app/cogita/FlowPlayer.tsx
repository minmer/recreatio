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
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { CardFace } from './CardFace';
import { questionCard } from './cards';
import { type Card } from './cardBasics';
import {
  advance, chaptersLeft, follow, goalsReached, linesNow, markSaid, narratorNow, optionsOf, readFlow, resolveFlow, startFlow, STEP_LABEL,
  type Flow, type FlowState, type LookType, type PlayContext
} from './flow';
import { flowCurrent, flowPath, flowPathModel, flowShown, type EntriesOfStep } from './flowPath';
import { chaptersKept, mergeGoals, withChapters } from './flowFacts';
import type { GraphNode } from './graph';
import { PathMap } from './PathMap';
import { branchOf, mergeWords, pathMarks } from './pathLayout';
import type { Learner } from './learn';
import { knownessOf, average } from './knowness';
import { cardsAbout } from './prerequisites';
import type { Facts } from './logic';
import { publicEntity, type PublicEntity } from './publish';
import type { MediaRef } from './schema';
import type { CogitaLibrary } from './store';
import { Markup, MediaView } from './ui';
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
    cards
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

const PATH_OPEN = 'cg-story-path-open:';
const readOpen = (flow: string): boolean => { try { return sessionStorage.getItem(PATH_OPEN + flow) !== '0'; } catch { return true; } };
const keepOpen = (flow: string, open: boolean): void => { try { sessionStorage.setItem(PATH_OPEN + flow, open ? '1' : '0'); } catch { /* ohne Speicher: offen */ } };

export function FlowPlayer({ flow: given, content, learner, onClose, jumpTo, onAnswer, presentationAs = 'play' }: {
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
}) {
  const flow = useMemo(() => resolveFlow(given, content.flow), [given, content]);
  const saved = learner?.progress.positions.get(flow.id);
  /* 2026-11-03 (G) — wer wiederkommt, steht, wo er war — mit den Kapiteln, die er schon durch hat. */
  const [state, setState] = useState<FlowState>(() => withChapters(startFlow(flow, learner?.progress.values ?? {}, saved?.step ?? null), saved?.chapters));
  const [answeredOn, setAnsweredOn] = useState<{ step: string; correct: boolean } | null>(null);
  const keepTimer = useRef<number | null>(null);
  const look: LookType = flow.look;
  const current = state.step === null ? undefined : (content.flow(state.flow) ?? flow).graph.nodes.find((n) => n.id === state.step);
  const currentFlow = content.flow(state.flow) ?? flow;

  const facts = (s: FlowState): Facts => ({
    values: s.values,
    knowness: (id) => {
      const cards = content.cardsOf(id);
      if (cards.length === 0 || learner === null) return 0;
      return average(cards.map((c) => knownessOf(learner.marks(c.key, c.fingerprint), Date.now())));
    },
    answered: (id) => {
      if (learner === null) return null;
      const card = content.card(id);
      if (card === null) return null;
      const marks = learner.marks(card.key, card.fingerprint);
      return marks.length === 0 ? null : marks[marks.length - 1].correctness;
    },
    visited: new Set(s.visited),
    now: new Date()
  });
  const ctx: PlayContext = { facts, flows: content.flow, members: content.members };

  useEffect(() => {
    if (jumpTo == null || !flow.graph.nodes.some((n) => n.id === jumpTo.step)) return;
    setState((s) => ({ ...s, flow: flow.id, step: jumpTo.step, ended: false, visited: s.visited.includes(jumpTo.step) ? s.visited : [...s.visited, jumpTo.step] }));
  }, [jumpTo?.at, jumpTo?.step, flow]);

  /* Unterabläufe, Übergaben und „dla każdego" gehen von selbst hinein. */
  useEffect(() => {
    if (current !== undefined && (current.type === 'subflow' || current.type === 'each' || current.type === 'handoff')) {
      setState((s) => advance(currentFlow, s, undefined, ctx));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.flow]);

  /*
    Wo er steht, bleibt — kurz nach jedem Schritt, nicht bei jedem Klick. 2026-11-03 (G): mit den Kapiteln, die durch
    sind, ob er ein Ende erreicht hat (bleibt, auch wenn er von vorn beginnt) und den erreichten Zielen — die Bedingung
    „Przebieg" liest es in Widoki, Powtórki und im Krajobraz.
  */
  const reachedNow = goalsReached(flow, facts(state));
  const goalsKey = reachedNow.join('|');
  useEffect(() => {
    if (learner === null || state.step === null) return undefined;
    if (keepTimer.current !== null) window.clearTimeout(keepTimer.current);
    const done = state.ended;
    keepTimer.current = window.setTimeout(() => {
      const had = learner.progress.positions.get(flow.id);
      void learner.keepPosition({
        flow: flow.id, step: state.step ?? '', visited: state.visited, at: Date.now(),
        chapters: chaptersKept(state.chapters),
        ...(done || had?.done === true ? { done: true } : {}),
        ...(reachedNow.length > 0 || (had?.goals?.length ?? 0) > 0 ? { goals: mergeGoals(had?.goals, reachedNow) } : {})
      }).catch(() => undefined);
      if (JSON.stringify(state.values) !== JSON.stringify(learner.progress.values)) void learner.keepValues(state.values).catch(() => undefined);
    }, done ? 0 : 1200);
    return () => { if (keepTimer.current !== null) window.clearTimeout(keepTimer.current); };
  }, [learner, flow.id, state.step, state.visited, state.values, state.ended, state.chapters, goalsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (exit?: string) => {
    setAnsweredOn(null);
    setState((s) => {
      const next = advance(currentFlow, s, exit, ctx);
      const lines = linesNow(flow, next, facts(next));
      return markSaid(next, lines);
    });
  };
  const lines = linesNow(flow, state, facts(state));
  const reached = reachedNow;

  const restart = () => setState(startFlow(flow, learner?.progress.values ?? {}));

  /*
    2026-11-03 (F) — DIE KARTE NEBEN DER ERZÄHLUNG: ihre Einträge in der Reihenfolge des Lernens (wo sie nichts sagt, in
    der der Erzählung); jetzt dran ist der Eintrag des Schrittes; über einer Möglichkeit leuchtet ihre Spur; ein freier
    Knoten bringt die Erzählung zu dem Schritt, der ihn zeigt; an Kapiteln „2 z 3 ścieżek".
  */
  const fp = useMemo(() => flowPath(flow, stepEntries(content), content.label ?? ((id) => content.entity(id)?.label ?? id)), [flow, content]);
  const pathModelNow = useMemo(() => flowPathModel(fp, content.needsOf ?? (() => [])), [fp, content]);
  const shownNow = flowShown(fp, state.visited);
  const pathNow = pathMarks(pathModelNow, (id) => {
    const cards = content.cardsOf(id);
    if (cards.length === 0 || learner === null) return { learned: shownNow.has(id), due: false };
    const k = facts(state).knowness(id);
    return { learned: k >= 0.1 - 1e-12, due: k >= 0.1 - 1e-12 && k < 1 };
  }, flowCurrent(fp, state));
  const [hovered, setHovered] = useState<ReadonlySet<string> | null>(null);
  /* Im Kapitel bleibt seine Spur hervorgehoben. */
  const inChapter = state.chapter === null ? null : branchOf(pathModelNow, fp.exits.get(state.chapter.hub)?.get(`c${state.chapter.index}`) ?? []);
  const lightOf = (step: string, exit: string) => ({
    onPointerEnter: () => setHovered(branchOf(pathModelNow, fp.exits.get(step)?.get(exit) ?? [])),
    onPointerLeave: () => setHovered(null),
    onFocus: () => setHovered(branchOf(pathModelNow, fp.exits.get(step)?.get(exit) ?? [])),
    onBlur: () => setHovered(null)
  });
  const [pathOpen, setPathOpen] = useState(() => readOpen(flow.id));
  const jumpToEntry = (entry: string) => {
    const step = fp.stepOf.get(entry);
    if (step === undefined) return;
    const ch = fp.chapterOf.get(step);
    setAnsweredOn(null);
    setHovered(null);
    setState((s) => ({
      ...s, flow: flow.id, step, ended: false, stack: [],
      visited: s.visited.includes(step) ? s.visited : [...s.visited, step],
      chapter: ch === undefined ? null : { hub: ch.hub, index: Number(ch.exit.slice(1)), start: follow(flow, ch.hub, ch.exit) ?? step }
    }));
  };
  const withPath = (story: ReactNode): ReactNode => (pathModelNow.nodes.length < 2 ? story : (
    <div className={`cg-story-path has-path${pathOpen ? '' : ' is-closed'}`} data-story-path="">
      {story}
      <PathMap model={pathModelNow} marks={pathNow} size="small" title="Ścieżka" collapsible open={pathOpen}
        onOpen={(v) => { setPathOpen(v); keepOpen(flow.id, v); }} highlight={hovered ?? inChapter}
        onPick={(id) => { if (fp.stepOf.has(id)) jumpToEntry(id); }} />
    </div>
  ));
  /* 2026-10-22 (Schritt 12) — wer gerade erzählt: der erste Erzähler, dessen Bedingung gilt. */
  const narratorOf = (f: Facts): PublicEntity | null => {
    const one = narratorNow(flow, f);
    return one === null ? null : content.entity(one.character);
  };

  /* 2026-10-22 (Schritt 12) — ein Storyboard: die Präsentation spielt selbst; der Ablauf bringt den Lernenden und die Erzähler mit. */
  if (flow.presentation !== undefined) {
    if (presentationAs === 'link') {
      return (
        <section className="cg-flow">
          <div className="cg-flow-step">
            <h2><TexText text={flow.name} /></h2>
            <p className="cg-muted">Ten przebieg jest prezentacją.</p>
            <div className="wk-actions"><a className="wk-btn" href={`#/${flow.presentation}`}>Otwórz prezentację</a></div>
          </div>
        </section>
      );
    }
    return (
      <Suspense fallback={<Loading />}>
        <PresentationInNauka name={flow.name} path={flow.presentation} learner={learner} onClose={onClose} content={content} unit={flow.unit ?? null}
          narrator={flow.narrators.length === 0 ? undefined : (f) => <Narrator who={narratorOf(f)} says={null} />} />
      </Suspense>
    );
  }

  if (state.ended || current === undefined) {
    return withPath(
      <section className={`cg-flow cg-flow-${look}`}>
        <div className="cg-flow-step">
          <h2>Koniec — <TexText text={flow.name} /></h2>
          {flow.goals.length > 0 && <Goals flow={flow} reached={reached} />}
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={restart}>Od początku</button>
            {onClose !== undefined && <button type="button" className="wk-link-btn" onClick={onClose}>Wróć</button>}
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
            <Next onNext={() => go('next')} />
          </>
        );
      }
      case 'question': {
        const card = content.card(typeof c.of === 'string' && c.of !== '' ? c.of : typeof c.card === 'string' ? c.card : '');
        if (card === null) return <><p className="wk-hint">Tego pytania tu nie ma.</p><Next onNext={() => go('right')} /></>;
        return (
          <CardFace card={card}
            onAnswered={(outcome, given) => {
              /* 2026-11-01 — mit der Antwort: Podpowiedzi und gezogene Werte (wie in einer Powtórka). */
              learner?.record(card, outcome.correctness, { via: flow.id, ...(outcome.hints === undefined ? {} : { hints: outcome.hints }), ...(card.params === undefined ? {} : { params: card.params }) });
              onAnswer?.(current.id, card, outcome.correctness, given);
              setAnsweredOn({ step: current.id, correct: outcome.correct });
            }}
            onNext={() => go(answeredOn?.correct === false ? 'wrong' : 'right')} />
        );
      }
      case 'choice':
        return (
          <div className="cg-choices">
            {optionsOf(current, facts(state)).map((o) => <button key={o.exit} type="button" className="cg-option" onClick={() => go(o.exit)} {...lightOf(current.id, o.exit)} data-flow-option={o.exit}><TexText text={o.label} /></button>)}
          </div>
        );
      case 'chapters': {
        /*
          2026-11-03 (F) — eine Gabel, die zusammenkommt: was durch ist — in dieser Erzählung oder auf der Karte (jeder Schritt
          seiner Spur gelernt): Erzählung und Karte sagen dasselbe —, und die Spuren, die noch offen sind; sind alle durch, weiter.
        */
        const all = Array.isArray(c.chapters) ? c.chapters.length : 0;
        const per = fp.exits.get(current.id);
        const learnedPath = (exit: string): boolean => {
          const branch = branchOf(pathModelNow, per?.get(exit) ?? []);
          return branch.size > 0 && [...branch].every((id) => pathNow.state[pathModelNow.index.get(id) ?? -1] === 'done');
        };
        const left = chaptersLeft(current, state).filter((ch) => !learnedPath(ch.exit));
        const done = all - left.length;
        return (
          <>
            {all > 1 && done > 0 && <p className="cg-muted" data-flow-merge={`${done}/${all}`}>{mergeWords(done, all)} przerobione{left.length > 0 ? ' — zostały:' : ''}</p>}
            {left.length === 0 ? <Next onNext={() => go('done')} /> : (
              <div className="cg-choices">
                {left.map((ch) => <button key={ch.exit} type="button" className="cg-option" onClick={() => go(ch.exit)} {...lightOf(current.id, ch.exit)} data-flow-option={ch.exit}><TexText text={ch.title} /></button>)}
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
            <Next onNext={() => go('next')} />
          </>
        );
      }
      case 'condition':
      case 'set':
        return <Next onNext={() => go('next')} />;
      /* 2026-10-22 (Schritt 12) — eine Szene einer Präsentation in einem gewöhnlichen Ablauf: ihr Name und der Weg zu ihr. */
      case 'scene': {
        const page = typeof c.page === 'string' ? c.page.replace(/^#?\/?/, '') : '';
        return (
          <>
            <p className="cg-muted">Scena prezentacji</p>
            {page !== '' && <a className="wk-link" href={`#/${page}`} target="_blank" rel="noopener">Otwórz prezentację</a>}
            <Next onNext={() => go('next')} />
          </>
        );
      }
      default:
        return <><p className="cg-muted">{STEP_LABEL[current.type as keyof typeof STEP_LABEL] ?? current.type}</p><Next onNext={() => go('next')} /></>;
    }
  })();

  return withPath(
    <section className={`cg-flow cg-flow-${look === 'slides' || look === 'scenes' ? 'slides' : look === 'flashcards' ? 'cards' : 'reading'}`}>
      <div className="cg-row-between">
        <strong><TexText text={flow.name} /></strong>
        <span className="cg-row">
          {flow.goals.length > 0 && <span className="cg-muted">Cele: {reached.length}/{flow.goals.length}</span>}
          <button type="button" className="wk-link-btn" onClick={restart}>od początku</button>
          {onClose !== undefined && <button type="button" className="wk-link-btn" onClick={onClose}>zamknij</button>}
        </span>
      </div>
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

function Next({ onNext }: { onNext: () => void }) {
  return <div className="wk-actions"><button type="button" className="wk-btn" onClick={onNext} autoFocus>Dalej</button></div>;
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
