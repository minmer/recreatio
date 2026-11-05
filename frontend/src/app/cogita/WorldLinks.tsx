/**
 * 2026-11-05 (Prompt 24) — VERBINDUNGEN IN ANDERE BAZY, gezeichnet (`worlds.ts`): der Abschnitt „W innych światach" mit Karten
 * (Name der Welt, Titel, ein Satz, der Stand DIESES Lernenden DORT), ein Link im Zapis ([[Wort|@@historia:@…]]), der Abstecher
 * in eine Erzählung einer anderen Baza (mit dem Weg über die Welten: „Fizyka › Newton › Historia: Rewolucja 1688") und die
 * Auswahl „Link do innego świata" für Autoren.
 * <code>
 *   Sichtbar     nur, wer die andere Baza lesen kann; sonst nichts — der Autor (writes) sieht „niedostępne" bzw. „zerwany link"
 *   Fortschritt  der Lernende DER ANDEREN Baza (`useLearner(welt, derselbe Halter)`): was dort beantwortet wird, zählt dort
 *   Reihenfolge  die andere entscheidet: ihre Erzählung läuft mit ihrer eigenen Sperre („najpierw: …"), ihre Seiten mit ihren Regeln
 *   Hier         nichts davon sperrt, öffnet oder zählt — die Karten sind Angebote
 * </code>
 */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { TexText } from '../ui/tex/Tex';
import './worlds.css';
import { CogitaContext, type CogitaCtx } from './ui';
import { cogitaPath } from './parts';
import { baseLang, type Words } from './lang';
import { DetourCard } from './DetourCard';
import { worldWords, type WorldWords } from './worldWords';
import { useLearner } from './holders';
import { gaugeFromMarks, itemKnowness } from './knowing';
import { learnerFlows } from './flowFacts';
import { renamer, type Learner } from './learn';
import { spacingFor } from './spacing';
import { KNOWN } from './knowness';
import type { Card } from './cardBasics';
import type { CogitaLibrary } from './store';
import {
  crossOf, crossRefsIn, crossText, openWorld, readableBases, refOfTarget, resolveCross, summaryOf, withWorld, handleOfLib,
  type CrossFound, type CrossRef, type CrossTarget, type WorldRef, type WorldStatus
} from './worlds';

/* -- Welten öffnen --------------------------------------------------------------------------------------------------- */

export interface WorldHere {
  readonly status: WorldStatus;
  /** Wie diese Baza die andere nennt (Name aus den Ustawienia). */
  readonly world: WorldRef | null;
  readonly lib: CogitaLibrary | null;
}

const LOADING: WorldHere = { status: 'loading', world: null, lib: null };

/** Die Welten zu diesen Namen, wie diese Baza sie kennt (ihre Ustawienia "worlds"), mit dem Konto geöffnet. */
export function useWorlds(handles: readonly string[]): ReadonlyMap<string, WorldHere> {
  const ctx = useContext(CogitaContext);
  const lib = ctx?.lib ?? null;
  const me = ctx?.me ?? null;
  const key = [...new Set(handles)].sort().join('|');
  const worldsKey = lib === null ? '' : JSON.stringify(lib.settings().worlds);
  const [map, setMap] = useState<ReadonlyMap<string, WorldHere>>(new Map());
  useEffect(() => {
    if (lib === null || key === '') { setMap(new Map()); return undefined; }
    let alive = true;
    const list = key.split('|');
    const known = lib.settings();
    void Promise.all(list.map(async (h): Promise<[string, WorldHere]> => {
      if (known.handle === h) return [h, { status: 'ok', world: { id: lib.libraryId, handle: h, name: ctx?.name ?? h }, lib }];
      const world = known.worlds.find((w) => w.handle === h) ?? null;
      if (world === null) return [h, { status: 'unknown', world: null, lib: null }];
      const opened = await openWorld(me, world.id);
      return [h, opened === null ? { status: 'unreadable', world, lib: null } : { status: 'ok', world: { ...world, name: world.name }, lib: opened }];
    })).then((pairs) => { if (alive) setMap(new Map(pairs)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, me, key, worldsKey]);
  return map;
}

/** Eine einzige Welt. */
export function useWorld(handle: string | null): WorldHere {
  const all = useWorlds(handle === null ? [] : [handle]);
  return handle === null ? LOADING : all.get(handle) ?? LOADING;
}

const wordsOf = (ctx: CogitaCtx | null): WorldWords => worldWords(ctx === null ? 'pl' : baseLang(ctx.lib));

/** Wo ein Ziel in seiner Welt steht (ihre Seite, ihre Erzählung — mit ihren Regeln). */
export function targetPath(world: CogitaLibrary, t: CrossTarget): string {
  if (t.kind === 'flow') return cogitaPath(world.libraryId, 'przebiegi', t.id, 'graj');
  if (t.kind === 'view') return cogitaPath(world.libraryId, 'wpisy', 'widok', t.id);
  return cogitaPath(world.libraryId, 'wpisy', t.id);
}

/* -- Stand des Lernenden in der anderen Welt ------------------------------------------------------------------------- */

export interface TargetState {
  readonly text: string;
  readonly done: boolean;
  readonly started: boolean;
}

/**
 * Der Lernende DERSELBEN Person in der anderen Baza (ihr Fortschritt gehört dorthin) und daraus der Stand der Ziele: eine
 * Erzählung begonnen / ukończona, ein Eintrag zu wieviel gekonnt (aus ihren Karten). Ohne Halter: nichts.
 */
export function useWorldStanding(world: CogitaLibrary | null, holder: Learner['holder'] | null, targets: readonly CrossTarget[], W: WorldWords): { readonly learner: Learner | null; readonly of: (t: CrossTarget) => TargetState | null } {
  const { learner, tick } = useLearner(world, holder);
  const wantsCards = targets.some((t) => t.kind === 'entry');
  const [cards, setCards] = useState<readonly Card[] | null>(null);
  useEffect(() => {
    if (world === null || !wantsCards || learner === null) return undefined;
    let alive = true;
    void world.cards('learn').then((r) => { if (alive) setCards(r.cards); }, () => undefined);
    return () => { alive = false; };
  }, [world, wantsCards, learner]);
  const gauge = useMemo(() => {
    if (world === null || learner === null || cards === null) return null;
    const rename = renamer(world.merges());
    const fp = new Map(cards.map((c) => [c.key, c.fingerprint] as const));
    return gaugeFromMarks(cards, (key) => learner.marks(key, fp.get(key), rename), world.dependencies(), Date.now(), world.prerequisites(), spacingFor(world, learner));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, learner, cards, tick]);
  const flows = useMemo(() => (world === null || learner === null ? null : learnerFlows(world, learner.progress.positions)), [world, learner, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const of = (t: CrossTarget): TargetState | null => {
    if (learner === null) return null;
    if (t.kind === 'flow') {
      const f = flows?.get(t.id);
      return f?.done === true ? { text: W.stateDone, done: true, started: true } : f?.started === true ? { text: W.stateStarted, done: false, started: true } : { text: W.stateNew, done: false, started: false };
    }
    if (t.kind === 'entry' && gauge !== null) {
      const k = itemKnowness(gauge, t.id);
      if (k >= KNOWN) return { text: W.stateKnownAll, done: true, started: true };
      return k > 0 ? { text: W.stateKnown(Math.round(k * 100)), done: false, started: true } : { text: W.stateNew, done: false, started: false };
    }
    return null;
  };
  return { learner, of };
}

/* -- „W innych światach" --------------------------------------------------------------------------------------------- */

interface Resolved {
  readonly ref: CrossFound;
  readonly here: WorldHere;
  readonly target: CrossTarget | null;
}

/** Die Verweise in andere Welten, aufgelöst — `null`, solange eine Welt noch öffnet. */
export function useCrossTargets(refs: readonly CrossFound[]): readonly Resolved[] | null {
  const worlds = useWorlds(refs.map((r) => r.handle));
  if (refs.some((r) => (worlds.get(r.handle) ?? LOADING).status === 'loading')) return null;
  return refs.map((ref) => {
    const here = worlds.get(ref.handle) ?? LOADING;
    return { ref, here, target: here.lib === null ? null : resolveCross(here.lib, ref.ref) };
  });
}

/**
 * DER ABSCHNITT „W innych światach" eines Eintrags (Seite, Thema in der Landschaft, Schritt eines Spielers): je Ziel eine Karte.
 * Lernende sehen nur, was sie lesen können und was es gibt; der Autor sieht dazu „niedostępne" und „zerwany link".
 */
export function WorldsSection({ data, learner, compact = false }: { data: unknown; learner?: Learner | null; compact?: boolean }) {
  const ctx = useContext(CogitaContext);
  const refs = useMemo(() => crossRefsIn(data, { markup: false }), [data]);
  const resolved = useCrossTargets(refs);
  if (ctx === null || refs.length === 0 || resolved === null) return null;
  const W = wordsOf(ctx);
  const owner = ctx.writes;
  const shown = resolved.filter((r) => r.target !== null || owner);
  if (shown.length === 0) return null;
  const holder = (learner === undefined ? ctx.learner : learner)?.holder ?? null;
  const byWorld = new Map<string, Resolved[]>();
  for (const r of shown) byWorld.set(r.ref.handle, [...(byWorld.get(r.ref.handle) ?? []), r]);
  return (
    <section className={`cg-worlds${compact ? ' is-compact' : ''}`} data-worlds="" aria-label={W.section}>
      <h3 className="cg-worlds-title">{W.section}</h3>
      {!compact && <p className="cg-muted cg-worlds-note">{W.sectionNote}</p>}
      <div className="cg-worlds-cards">
        {[...byWorld.entries()].map(([handle, list]) => <WorldGroup key={handle} list={list} holder={holder} W={W} owner={owner} />)}
      </div>
    </section>
  );
}

function WorldGroup({ list, holder, W, owner }: { list: readonly Resolved[]; holder: Learner['holder'] | null; W: WorldWords; owner: boolean }) {
  const here = list[0].here;
  const targets = useMemo(() => list.flatMap((r) => (r.target === null ? [] : [r.target])), [list]);
  const standing = useWorldStanding(here.lib, holder, targets, W);
  return (
    <>
      {list.map((r) => {
        const name = here.world?.name ?? `@${r.ref.handle}`;
        if (r.target === null || here.lib === null) {
          if (!owner) return null;
          const why = here.status === 'unknown' ? W.unknownWorld(r.ref.handle) : here.status === 'unreadable' ? W.unavailableNote : W.brokenNote(r.ref.ref, name);
          return (
            <article key={crossText(r.ref)} className="cg-world-card is-off" data-world-card={crossText(r.ref)} data-world-state={here.status === 'ok' ? 'broken' : here.status}>
              <p className="cg-world-name">{W.inWorld(name)} · <strong>{here.status === 'ok' ? W.broken : W.unavailable}</strong></p>
              <p className="cg-world-title">{r.ref.label ?? r.ref.ref}</p>
              <p className="cg-muted">{why}</p>
            </article>
          );
        }
        return <WorldCard key={crossText(r.ref)} cross={r.ref} world={here.lib} name={name} target={r.target} state={standing.of(r.target)} W={W} />;
      })}
    </>
  );
}

export function WorldCard({ cross, world, name, target, state, W, onEnter }: { cross: CrossRef; world: CogitaLibrary; name: string; target: CrossTarget; state: TargetState | null; W: WorldWords; onEnter?: () => void }) {
  const kind = target.kind === 'flow' ? W.story : target.kind === 'view' ? W.view : W.entry;
  return (
    <article className={`cg-world-card${state?.done === true ? ' is-done' : ''}`} data-world-card={crossText(cross)} data-world-state={state === null ? 'none' : state.done ? 'done' : state.started ? 'started' : 'new'}>
      <p className="cg-world-name"><span className="cg-world-portal" aria-hidden="true">◎</span> {W.inWorld(name)} · {kind}</p>
      <p className="cg-world-title"><TexText text={target.title} /></p>
      {target.summary !== '' && <p className="cg-world-summary" data-world-summary=""><TexText text={target.summary} /></p>}
      {state !== null && <p className="cg-muted cg-world-state">{state.text} · {W.stateThere}</p>}
      <div className="wk-actions">
        {onEnter !== undefined
          ? <button type="button" className="wk-btn wk-btn-line" onClick={onEnter} data-world-open="">{W.openIn(name)}</button>
          : <a className="wk-btn wk-btn-line" href={targetPath(world, target)} data-world-open="">{W.openIn(name)}</a>}
      </div>
    </article>
  );
}

/* -- Ein Link im Zapis ----------------------------------------------------------------------------------------------- */

/**
 * [[Chwalebna rewolucja|@@historia:@historia/rewolucja-1688]] — ein Link in die andere Welt (ihre Seite oder ihre Erzählung).
 * Kann der Leser sie nicht lesen oder gibt es das Ziel nicht: nur der Wortlaut; der Autor sieht dazu das Zeichen.
 */
export function CrossLink({ token, label }: { token: string; label: ReactNode }) {
  const ctx = useContext(CogitaContext);
  const cross = crossOf(token);
  const here = useWorld(cross?.handle ?? null);
  const W = wordsOf(ctx);
  const target = cross === null || here.lib === null ? null : resolveCross(here.lib, cross.ref);
  const text = label ?? target?.title ?? cross?.ref ?? token;
  if (cross === null || target === null || here.lib === null) {
    const off = here.status !== 'loading' && ctx?.writes === true;
    return <span className={`lib-own-ref is-cross${off ? ' is-off' : ''}`} data-world-link={token} data-world-link-state={here.status === 'ok' ? 'broken' : here.status} {...(off ? { title: here.status === 'ok' ? W.broken : W.unavailable } : {})}>{text}{off && <span className="cg-world-off"> ({here.status === 'ok' ? W.broken : W.unavailable})</span>}</span>;
  }
  const title = `${W.inWorld(here.world?.name ?? cross.handle)}: ${target.title}${target.summary === '' ? '' : ` — ${target.summary}`}`;
  return <a className="lib-own-ref is-cross" href={targetPath(here.lib, target)} title={title} data-world-link={token} data-world-link-state="ok">{text}<span className="cg-world-portal" aria-hidden="true"> ◎</span></a>;
}

/** Der Zeichner für `MarkupLinks.cross` (Cogita). */
export const crossRenderer = (token: string, label: ReactNode): ReactNode => <CrossLink token={token} label={label} />;

/* -- Der Abstecher in eine andere Welt ------------------------------------------------------------------------------- */

/**
 * DER SCHRITT „detour" MIT EINER ERZÄHLUNG EINER ANDEREN WELT ("flow": "@@historia:@historia/f/rewolucja"): immer freiwillig, die
 * Karte nennt die Welt („Zagłębienie w innym świecie: Historia"), ihr Satz und der Stand dort. Nicht lesbar oder nicht mehr da:
 * Lernende gehen still weiter (der Schritt ist für sie nicht da), der Autor sieht warum.
 */
export function CrossDetourStep({ cross, label, holder, W, next, onExit, onEnter }: {
  cross: CrossRef;
  label: string;
  holder: Learner['holder'] | null;
  W: Words;
  next: (run: () => void) => ReactNode;
  onExit: (exit: 'done' | 'skip') => void;
  onEnter: (world: CogitaLibrary, name: string, flowId: string) => void;
}) {
  const ctx = useContext(CogitaContext);
  const here = useWorld(cross.handle);
  const WW = wordsOf(ctx);
  const target = here.lib === null ? null : resolveCross(here.lib, cross.ref);
  const flow = target !== null && target.kind === 'flow' ? target : null;
  const targets = useMemo(() => (flow === null ? [] : [flow]), [flow?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const standing = useWorldStanding(here.lib, holder, targets, WW);
  const hidden = here.status !== 'loading' && (here.lib === null || flow === null);
  const owner = ctx?.writes === true;
  /* Für Lernende gibt es einen Abstecher ins Leere nicht: weiter, als wäre er ausgelassen. */
  useEffect(() => { if (hidden && !owner) onExit('skip'); }, [hidden, owner]); // eslint-disable-line react-hooks/exhaustive-deps
  if (here.status === 'loading') return <p className="cg-muted" data-flow-detour-world="loading">{WW.loading}</p>;
  const name = here.world?.name ?? `@${cross.handle}`;
  if (hidden || here.lib === null || flow === null) {
    if (!owner) return null;
    return (
      <div className="cg-detour is-off" data-flow-detour-world={here.status === 'ok' ? 'broken' : here.status}>
        <p className="cg-muted">{WW.deeper(name)} · <strong>{here.status === 'ok' ? WW.broken : WW.unavailable}</strong></p>
        <p className="wk-note">{here.status === 'unknown' ? WW.unknownWorld(cross.handle) : here.status === 'unreadable' ? WW.unavailableNote : WW.brokenNote(cross.ref, name)}</p>
        {next(() => onExit('skip'))}
      </div>
    );
  }
  const state = standing.of(flow);
  const world = here.lib;
  return (
    <div className="cg-detour-world" data-flow-detour-world="ok" data-flow-detour-world-name={name}>
      <DetourCard name={flow.title} label={label !== '' ? label : WW.deeper(name)} summary={flow.summary} work={[WW.inWorld(name), WW.stateThere].join(' · ')}
        optional known={state?.done === true} started={state?.started === true && state.done !== true} refused={null} W={W}
        onEnter={() => onEnter(world, name, flow.id)} onExit={onExit} next={next} autoFocus flowId={flow.id} />
      <p className="cg-muted cg-detour-world-note">{WW.returnNote}</p>
    </div>
  );
}

/** Wo man herkommt: „Fizyka › Newton" — der Abstecher hängt „Historia: Rewolucja 1688" an. */
export const CrossCrumbs = createContext<readonly string[]>([]);

export interface CrossRunProps {
  readonly world: CogitaLibrary;
  readonly name: string;
  readonly flowId: string;
  readonly holder: Learner['holder'] | null;
  readonly crumbs: readonly string[];
  readonly onBack: (done: boolean) => void;
  /** Der Spieler (aus `FlowPlayer.tsx` gereicht — sonst ein Kreis der Einfuhren). */
  readonly player: (p: { world: CogitaLibrary; flowId: string; cards: readonly Card[]; learner: Learner | null; onClose: () => void; backLabel: string }) => ReactNode;
}

/**
 * EINE ERZÄHLUNG DER ANDEREN WELT, hier gespielt: mit ihrem Inhalt, ihren Regeln (ihre Sperre „najpierw: …") und ihrem
 * Lernenden — ihr Fortschritt bleibt dort. Oben der Weg über die Welten; „‹ Wróć" (oder das Ende) führt zurück: ukończona →
 * der Abstecher hier geht mit „done" weiter, sonst steht man wieder auf seiner Karte.
 */
export function CrossRun({ world, name, flowId, holder, crumbs, onBack, player }: CrossRunProps) {
  const outer = useContext(CogitaContext);
  const { learner } = useLearner(world, holder);
  const [cards, setCards] = useState<readonly Card[] | null>(null);
  useEffect(() => {
    let alive = true;
    void world.cards('learn').then((r) => { if (alive) setCards(r.cards); }, () => { if (alive) setCards([]); });
    return () => { alive = false; };
  }, [world]);
  const W = wordsOf(outer);
  const flowName = (() => { const d = world.docs('flow').find((x) => x.id === flowId); return typeof d?.data.name === 'string' ? d.data.name : flowId; })();
  const ctx = useMemo<CogitaCtx | null>(() => (outer === null ? null : {
    ...outer, lib: world, name, writes: false, learner, sources: undefined,
    keyOf: (epoch: number) => outer.keyIn(world.areaId, epoch),
    href: (...tail: readonly string[]) => cogitaPath(world.libraryId, ...tail)
  }), [outer, world, name, learner]);
  const back = () => {
    const done = learner !== null && learnerFlows(world, learner.progress.positions).get(flowId)?.done === true;
    onBack(done);
  };
  const trail = [...crumbs, `${name}: ${flowName}`];
  return (
    <div className="cg-cross-run" data-cross-run={flowId}>
      <nav className="cg-cross-crumbs" aria-label="breadcrumb" data-cross-crumbs={trail.join(' › ')}>
        <button type="button" className="wk-link-btn" onClick={() => onBack(false)} data-cross-back="">{W.back(crumbs[crumbs.length - 1] ?? '')}</button>
        <span className="cg-cross-trail">{trail.map((c, i) => <span key={i} className={i === trail.length - 1 ? 'is-here' : ''}>{i > 0 && <span aria-hidden="true"> › </span>}<TexText text={c} /></span>)}</span>
      </nav>
      {ctx === null || cards === null ? <p className="cg-muted">{W.loading}</p> : (
        <CogitaContext.Provider value={ctx}>
          <CrossCrumbs.Provider value={trail}>
            {player({ world, flowId, cards, learner, onClose: back, backLabel: crumbs[crumbs.length - 1] ?? '' })}
          </CrossCrumbs.Provider>
        </CogitaContext.Provider>
      )}
    </div>
  );
}

/* -- „Link do innego świata" (Autoren) ------------------------------------------------------------------------------- */

export interface PickedWorld {
  /** Der Wert für das Feld / den Abstecher: "@@historia:@historia/rewolucja-1688". */
  readonly value: string;
  readonly target: CrossTarget;
  readonly world: WorldRef;
}

/**
 * DIE AUSWAHL: zuerst die Welt (die Bazy wiedzy, die dieses Konto lesen kann), dann ein Thema oder eine Erzählung — mit ihrem
 * Satz, bevor gespeichert wird. Die Welt kommt in die Ustawienia dieser Baza ("worlds"), ihr Name aus ihrem "handle" (sonst
 * aus ihrem Titel).
 */
export function WorldPicker({ only, onPick, onCancel }: { only?: 'flow' | 'entry'; onPick: (p: PickedWorld) => void; onCancel: () => void }) {
  const ctx = useContext(CogitaContext);
  const W = wordsOf(ctx);
  const [bases, setBases] = useState<readonly { libraryId: string; name: string }[] | null>(null);
  const [baseId, setBaseId] = useState('');
  const [world, setWorld] = useState<CogitaLibrary | null | 'loading'>(null);
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<CrossTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (ctx?.me == null) { setBases([]); return; }
    let alive = true;
    void readableBases(ctx.me).then((rows) => { if (alive) setBases(rows.filter((r) => r.libraryId !== ctx.lib.libraryId).map((r) => ({ libraryId: r.libraryId, name: r.name }))); }, () => { if (alive) setBases([]); });
    return () => { alive = false; };
  }, [ctx?.me, ctx?.lib.libraryId]);
  useEffect(() => {
    if (baseId === '' || ctx === null) { setWorld(null); return undefined; }
    let alive = true;
    setWorld('loading'); setChosen(null);
    void openWorld(ctx.me, baseId).then((l) => { if (alive) setWorld(l); });
    return () => { alive = false; };
  }, [baseId, ctx]);
  const found = useMemo((): CrossTarget[] => {
    if (world === null || world === 'loading') return [];
    const q = query.trim().toLocaleLowerCase();
    const out: CrossTarget[] = [];
    if (only !== 'entry') {
      for (const d of world.docs('flow')) {
        const t = resolveCross(world, d.id);
        if (t !== null && (q === '' || t.title.toLocaleLowerCase().includes(q))) out.push(t);
      }
    }
    if (only !== 'flow') {
      for (const e of (q === '' ? world.entities().slice(0, 40) : world.search(query)).slice(0, 40)) {
        if (e.kinds.includes('question')) continue;
        out.push({ kind: 'entry', id: e.id, title: world.label(e), summary: summaryOf(world, e.id) });
      }
    }
    return out.slice(0, 60);
  }, [world, query, only]);
  if (ctx === null) return null;
  const baseName = bases?.find((b) => b.libraryId === baseId)?.name ?? '';
  const valueOf = (w: CogitaLibrary, t: CrossTarget): { value: string; ref: WorldRef } => {
    const known = ctx.lib.settings().worlds.find((x) => x.id === w.libraryId);
    const ref: WorldRef = known ?? { id: w.libraryId, handle: handleOfLib(w, baseName), name: baseName };
    return { value: crossText({ handle: ref.handle, ref: refOfTarget(w, t.id) }), ref };
  };
  const use = async () => {
    if (world === null || world === 'loading' || chosen === null) return;
    setBusy(true);
    try {
      const { value, ref } = valueOf(world, chosen);
      const list = withWorld(ctx.lib.settings().worlds, ref);
      const final = list === null ? ref : list.find((x) => x.id === ref.id) ?? ref;
      if (list !== null && ctx.writes) await ctx.lib.saveSettings({ worlds: list });
      onPick({ value: final.handle === ref.handle ? value : crossText({ handle: final.handle, ref: refOfTarget(world, chosen.id) }), target: chosen, world: final });
    } finally { setBusy(false); }
  };
  return (
    <div className="cg-world-pick" role="group" aria-label={W.pickTitle} data-world-picker="">
      <p className="cg-world-pick-title"><strong>{W.pickTitle}</strong></p>
      <p className="cg-muted">{W.pickOffer}</p>
      {bases === null ? <p className="cg-muted">{W.loading}</p> : bases.length === 0 ? <p className="cg-muted">{W.pickNoBases}</p> : (
        <label className="wk-field">
          <span>{W.pickBase}</span>
          <select value={baseId} onChange={(e) => setBaseId(e.target.value)} data-world-pick-base="">
            <option value="">—</option>
            {bases.map((b) => <option key={b.libraryId} value={b.libraryId}>{b.name}</option>)}
          </select>
        </label>
      )}
      {world === 'loading' && <p className="cg-muted">{W.loading}</p>}
      {world !== null && world !== 'loading' && (
        <>
          <label className="wk-field">
            <span>{W.pickSearch}</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} data-world-pick-query="" />
          </label>
          <ul className="cg-world-pick-list">
            {found.map((t) => (
              <li key={`${t.kind}:${t.id}`}>
                <button type="button" className={`cg-world-pick-one${chosen?.id === t.id ? ' is-chosen' : ''}`} aria-pressed={chosen?.id === t.id} onClick={() => setChosen(t)} data-world-pick-one={t.id}>
                  <span className="cg-muted">{t.kind === 'flow' ? W.story : t.kind === 'view' ? W.view : W.entry}</span> <TexText text={t.title} />
                </button>
              </li>
            ))}
            {found.length === 0 && <li className="cg-muted">{W.pickNone}</li>}
          </ul>
          {chosen !== null && (
            <div className="cg-world-card is-preview" data-world-pick-preview="">
              <p className="cg-world-name">{W.inWorld(baseName)} · {chosen.kind === 'flow' ? W.story : W.entry}</p>
              <p className="cg-world-title"><TexText text={chosen.title} /></p>
              {chosen.summary !== '' && <p className="cg-world-summary"><TexText text={chosen.summary} /></p>}
              <p className="cg-muted"><code>{valueOf(world, chosen).value}</code></p>
            </div>
          )}
        </>
      )}
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={chosen === null || busy} onClick={() => { void use(); }} data-world-pick-use="">{W.pickUse}</button>
        {chosen !== null && world !== null && world !== 'loading' && (
          <button type="button" className="wk-btn wk-btn-line" onClick={() => { void navigator.clipboard?.writeText(`[[${chosen.title}|${valueOf(world, chosen).value}]]`).then(() => setCopied(true)); }} data-world-pick-copy="">{copied ? W.copied : W.pickCopy}</button>
        )}
        <button type="button" className="wk-btn wk-btn-line" onClick={onCancel}>{W.pickCancel}</button>
      </div>
    </div>
  );
}

/**
 * EIN WERT EINES FELDES „W innych światach" (Odwołanie mit "external": true) im Editor: ein Verweis in eine andere Welt als Link
 * mit „zmień" und „usuń"; sonst die gewöhnliche Auswahl (`children`) und daneben „Link do innego świata…".
 */
export function CrossRefEditor({ value, writes, external, onChange, children, only }: { value: unknown; writes: boolean; external: boolean; onChange: (next: string | undefined) => void; children: ReactNode; only?: 'flow' | 'entry' }) {
  const ctx = useContext(CogitaContext);
  const W = wordsOf(ctx);
  const [picking, setPicking] = useState(false);
  const cross = crossOf(value);
  if (picking) return <WorldPicker {...(only === undefined ? {} : { only })} onPick={(p) => { setPicking(false); onChange(p.value); }} onCancel={() => setPicking(false)} />;
  if (cross !== null) {
    return (
      <span className="cg-row" data-world-value={crossText(cross)}>
        <CrossLink token={crossText(cross)} label={null} />
        {writes && <button type="button" className="wk-link-btn" onClick={() => setPicking(true)}>{W.pick}</button>}
        {writes && <button type="button" className="wk-link-btn" onClick={() => onChange(undefined)}>{W.settingsRemove}</button>}
      </span>
    );
  }
  return (
    <span className="cg-row">
      {children}
      {writes && external && <button type="button" className="wk-link-btn" onClick={() => setPicking(true)} data-world-pick-open="">{W.pick}</button>}
    </span>
  );
}

/* -- Do zrobienia: zerwane i niedostępne ------------------------------------------------------------------------------ */

export interface BrokenLink {
  readonly from: string;
  readonly fromTitle: string;
  readonly ref: CrossFound;
  readonly why: 'unknown' | 'unreadable' | 'broken';
  readonly world: string;
}

/** Alle Verweise in andere Welten dieser Baza (Einträge und Abläufe), die ins Leere oder in eine nicht lesbare Welt zeigen. */
export function useBrokenWorldLinks(): readonly BrokenLink[] | null {
  const ctx = useContext(CogitaContext);
  const lib = ctx?.lib ?? null;
  const all = useMemo(() => {
    if (lib === null) return [];
    const out: { from: string; fromTitle: string; ref: CrossFound }[] = [];
    for (const e of lib.entities()) if (lib.isOwn(e.id)) for (const ref of crossRefsIn(lib.entry(e.id)?.data)) out.push({ from: e.id, fromTitle: lib.label(e), ref });
    for (const d of lib.docs('flow')) for (const ref of crossRefsIn(d.data)) out.push({ from: d.id, fromTitle: typeof d.data.name === 'string' ? d.data.name : d.id, ref });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, lib?.revision]);
  const worlds = useWorlds(all.map((x) => x.ref.handle));
  if (all.length === 0) return [];
  if (all.some((x) => (worlds.get(x.ref.handle) ?? LOADING).status === 'loading')) return null;
  return all.flatMap((x): BrokenLink[] => {
    const here = worlds.get(x.ref.handle) ?? LOADING;
    const world = here.world?.name ?? `@${x.ref.handle}`;
    if (here.status === 'unknown' || here.status === 'unreadable') return [{ ...x, why: here.status, world }];
    return here.lib !== null && resolveCross(here.lib, x.ref.ref) === null ? [{ ...x, why: 'broken', world }] : [];
  });
}
