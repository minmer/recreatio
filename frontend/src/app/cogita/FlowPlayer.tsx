/**
 * COGITA — EINEN ABLAUF SPIELEN (COGITA.md §8, §9): Schritt für Schritt, im
 * Aussehen des Ablaufs (Lesen, Slajdy, Szenen, Gespräch in Blasen, Karteikarten,
 * Karte), mit den Gestalten, die sprechen, wenn ihre Bedingung gilt, und den
 * Werten, die der Lernende mitnimmt. Wo er steht, bleibt über Geräte hinweg
 * [G14].
 *
 * Derselbe Spieler zeigt einen Ablauf aus der Bibliothek und einen
 * veröffentlichten (ohne Schlüssel) — der Inhalt kommt über `FlowContent`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { CardFace } from './CardFace';
import { questionCard } from './cards';
import { type Card } from './cardBasics';
import {
  advance, chaptersLeft, goalsReached, linesNow, markSaid, optionsOf, readFlow, resolveFlow, startFlow, STEP_LABEL,
  type Flow, type FlowState, type LookType, type PlayContext
} from './flow';
import type { Learner } from './learn';
import { knownessOf, average } from './knowness';
import type { Facts } from './logic';
import { publicEntity, type PublicEntity, type PublicFlow } from './publish';
import type { MediaRef } from './schema';
import type { CogitaLibrary } from './store';
import { Markup, MediaView } from './ui';

/** Woher der Inhalt eines Ablaufs kommt — die Bibliothek, oder eine veröffentlichte Abschrift. */
export interface FlowContent {
  readonly entity: (id: string) => PublicEntity | null;
  readonly card: (id: string) => Card | null;
  readonly flow: (id: string) => Flow | undefined;
  readonly members: (collectionOrKind: string) => readonly string[];
  /** Karten eines Eintrags — für seine Kenntnis. */
  readonly cardsOf: (id: string) => readonly Card[];
  /** Eine offene Datei (veröffentlicht) — sonst öffnet `MediaView` sie mit dem Schlüssel. */
  /** `library`: wo die Datei liegt (0110 — eine Quelle); fehlt: die des Ablaufs. */
  readonly fileUrl?: (fileId: string, library?: string) => string;
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
    cardsOf: (id) => cards.filter((c) => c.entity === id || c.question === id)
  };
}

export function contentOfBundle(bundle: PublicFlow, fileUrl: (fileId: string, library?: string) => string): FlowContent {
  const flows = new Map([bundle.flow, ...bundle.flows].map((raw) => {
    const f = readFlow(String(raw.id ?? ''), raw);
    return [f.id, f] as const;
  }));
  return {
    entity: (id) => bundle.entities[id] ?? null,
    card: (id) => bundle.cards.find((c) => c.question === id || c.key === id) ?? null,
    flow: (id) => flows.get(id),
    members: (x) => Object.values(bundle.entities).filter((e) => (e.kindIds ?? []).includes(x)).map((e) => e.id),
    cardsOf: (id) => bundle.cards.filter((c) => c.entity === id || c.question === id),
    fileUrl
  };
}

export function FlowPlayer({ flow: given, content, learner, onClose, jumpTo, onAnswer }: {
  flow: Flow;
  content: FlowContent;
  learner: Learner | null;
  onClose?: () => void;
  /** Ein Schritt, der von aussen geöffnet wird (ein Auslöser im Spiel [J6]). */
  jumpTo?: { readonly step: string; readonly at: number } | null;
  /** Jede Antwort auch nach aussen (eine Sitzung mit Code sammelt sie für den Gastgeber). */
  onAnswer?: (step: string, card: Card, correctness: number, given: unknown) => void;
}) {
  const flow = useMemo(() => resolveFlow(given, content.flow), [given, content]);
  const saved = learner?.progress.positions.get(flow.id);
  const [state, setState] = useState<FlowState>(() => startFlow(flow, learner?.progress.values ?? {}, saved?.step ?? null));
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

  /* Wo er steht, bleibt — kurz nach jedem Schritt, nicht bei jedem Klick. */
  useEffect(() => {
    if (learner === null || state.step === null) return undefined;
    if (keepTimer.current !== null) window.clearTimeout(keepTimer.current);
    keepTimer.current = window.setTimeout(() => {
      void learner.keepPosition({ flow: flow.id, step: state.step ?? '', visited: state.visited, at: Date.now() }).catch(() => undefined);
      if (JSON.stringify(state.values) !== JSON.stringify(learner.progress.values)) void learner.keepValues(state.values).catch(() => undefined);
    }, 1200);
    return () => { if (keepTimer.current !== null) window.clearTimeout(keepTimer.current); };
  }, [learner, flow.id, state.step, state.visited, state.values]);

  const go = (exit?: string) => {
    setAnsweredOn(null);
    setState((s) => {
      const next = advance(currentFlow, s, exit, ctx);
      const lines = linesNow(flow, next, facts(next));
      return markSaid(next, lines);
    });
  };
  const lines = linesNow(flow, state, facts(state));
  const reached = goalsReached(flow, facts(state));

  const restart = () => setState(startFlow(flow, learner?.progress.values ?? {}));

  if (state.ended || current === undefined) {
    return (
      <section className={`cg-flow cg-flow-${look}`}>
        <div className="cg-flow-step">
          <h2>Koniec — {flow.name}</h2>
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
            {media !== null && <MediaView media={media} publicUrl={content.fileUrl?.(media.file, media.library)} />}
            {id !== '' && <EntityView entity={content.entity(current.type === 'expand' && typeof c.explain === 'string' ? c.explain : id)} fileUrl={content.fileUrl} />}
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
              learner?.record(card, outcome.correctness, { via: flow.id });
              onAnswer?.(current.id, card, outcome.correctness, given);
              setAnsweredOn({ step: current.id, correct: outcome.correct });
            }}
            onNext={() => go(answeredOn?.correct === false ? 'wrong' : 'right')} />
        );
      }
      case 'choice':
        return (
          <div className="cg-choices">
            {optionsOf(current, facts(state)).map((o) => <button key={o.exit} type="button" className="cg-option" onClick={() => go(o.exit)}>{o.label}</button>)}
          </div>
        );
      case 'chapters':
        return (
          <div className="cg-choices">
            {chaptersLeft(current, state).map((ch) => <button key={ch.exit} type="button" className="cg-option" onClick={() => go(ch.exit)}>{ch.title}</button>)}
          </div>
        );
      case 'line': {
        const who = typeof c.character === 'string' ? content.entity(c.character) : null;
        const said = typeof c.of === 'string' ? content.entity(c.of) : null;
        return (
          <>
            <Bubble who={who} text={said} fileUrl={content.fileUrl} mood={typeof c.mood === 'string' ? c.mood : null} />
            <Next onNext={() => go('next')} />
          </>
        );
      }
      case 'prerequisite':
      case 'condition':
      case 'set':
        return <Next onNext={() => go('next')} />;
      default:
        return <><p className="cg-muted">{STEP_LABEL[current.type as keyof typeof STEP_LABEL] ?? current.type}</p><Next onNext={() => go('next')} /></>;
    }
  })();

  return (
    <section className={`cg-flow cg-flow-${look === 'slides' || look === 'scenes' ? 'slides' : look === 'flashcards' ? 'cards' : 'reading'}`}>
      <div className="cg-row-between">
        <strong>{flow.name}</strong>
        <span className="cg-row">
          {flow.goals.length > 0 && <span className="cg-muted">Cele: {reached.length}/{flow.goals.length}</span>}
          <button type="button" className="wk-link-btn" onClick={restart}>od początku</button>
          {onClose !== undefined && <button type="button" className="wk-link-btn" onClick={onClose}>zamknij</button>}
        </span>
      </div>
      {lines.length > 0 && (
        <div className="cg-bubbles">
          {lines.map((l) => <Bubble key={`${l.character}:${l.of}`} who={content.entity(l.character)} text={content.entity(l.of)} fileUrl={content.fileUrl} mood={null} />)}
        </div>
      )}
      <div className={`cg-flow-step${c.open === 'inline' ? ' cg-flow-inline' : ''}`}>
        {title !== null && <h2>{title}</h2>}
        {item !== null && <p className="cg-muted">{item.label}</p>}
        {body}
      </div>
    </section>
  );
}

function Next({ onNext }: { onNext: () => void }) {
  return <div className="wk-actions"><button type="button" className="wk-btn" onClick={onNext} autoFocus>Dalej</button></div>;
}

function Goals({ flow, reached }: { flow: Flow; reached: readonly string[] }) {
  return (
    <div className="cg-goals">
      {flow.goals.map((g) => <span key={g.id} className={`cg-tag${reached.includes(g.id) ? ' is-ok' : ''}`}>{reached.includes(g.id) ? '✓ ' : ''}{g.title}</span>)}
    </div>
  );
}

/** Ein Eintrag im Ablauf: Wissen ganz, andere mit ihren Feldern und Bildern. */
export function EntityView({ entity, fileUrl }: { entity: PublicEntity | null; fileUrl?: (fileId: string, library?: string) => string }) {
  if (entity === null) return <p className="wk-hint">(tego wpisu tu nie ma)</p>;
  const text = entity.fields.find((f) => f.key === 'text' && f.type === 'markup');
  if ((entity.kindIds ?? []).includes('knowledge') && text !== undefined) return <Markup text={text.text} />;
  return (
    <div className="cg">
      <h3>{entity.label}</h3>
      {entity.media.slice(0, 3).map((m) => <MediaView key={m.file} media={m} publicUrl={fileUrl?.(m.file, m.library)} />)}
      {entity.fields.filter((f) => f.text !== '').slice(0, 12).map((f) => (
        <div key={f.key}>
          <span className="cg-muted">{f.label}: </span>
          {f.type === 'markup' ? <Markup text={f.text} /> : <span>{f.text}</span>}
        </div>
      ))}
    </div>
  );
}

function Bubble({ who, text, fileUrl, mood }: { who: PublicEntity | null; text: PublicEntity | null; fileUrl?: (fileId: string, library?: string) => string; mood: string | null }) {
  const portrait = who?.media.find((m) => m.type === 'image');
  const line = text?.fields.find((f) => f.key === 'text')?.text ?? text?.label ?? '';
  return (
    <div className="cg-bubble">
      <span className="cg-bubble-face" title={who?.label ?? ''}>
        {portrait !== undefined ? <MediaView media={portrait} publicUrl={fileUrl?.(portrait.file, portrait.library)} /> : (who?.label ?? '?').slice(0, 1)}
      </span>
      <span className="cg-bubble-text">
        <strong>{who?.label ?? 'Postać'}{mood !== null && mood !== '' ? <span className="cg-muted"> ({mood})</span> : null}</strong>
        <Markup text={line} />
      </span>
    </div>
  );
}
