/**
 * 2026-11-01 — DIE KARTE DES FORTSCHRITTS („Mapa postępów", Widok im Modus `quilt`; Lemma): je Eintrag eine Kachel in
 * der Farbe dessen, wie gut man ihn kann, in den Gruppen des Widoku (Ideen unter ihrer Lektion, Lektionen unter ihrem
 * Kapitel). Gerechnet in `quilt.ts`.
 *
 * <code>
 *   Kachel      ein Knopf: das Zeichen der Stufe (○ ◔ ◑ ●) und der Name mit seinen Wzory — nie nur die Farbe;
 *               Pfeile gehen von Kachel zu Kachel (auch hinauf und hinunter), Pos1/Ende zur ersten, letzten
 *   Tafel       ein Klick: was zu lesen ist („Nowy temat" ohne Titel), die Fragen mit der letzten Antwort und ihrem Tag,
 *               „Ćwicz to" (eine Powtórka auf Zeit, `practiseGraph`), „Otwórz w źródle", „Otwórz wpis"
 *   Klasse      für die Lehrerin: dieselbe Karte je Uczący się, und alle zusammen — eine Kachel sagt, wie viele den
 *               Eintrag können („3/5"), die Tafel wer wo steht; dazu je Frage, wo die Klasse scheitert
 * </code>
 *
 * Farben (`quilt.css`): drei Schritte der geprüften blauen Rampe von `.cg-stats` (dataviz `validate_palette.js
 * --ordinal`, hell gegen #ffffff, dunkel gegen #1f1c16 — alle Prüfungen bestanden), „nowe" grau mit gestrichelter
 * Kante; die Klasse vier Schritte derselben Rampe. Schrift auf jeder Farbe mit ≥ 4,5:1.
 */

import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import type { Card } from './cardBasics';
import { TopicIntro, SourceOpen } from './EntityReading';
import { gaugeFromMarks, type Gauge } from './knowing';
import { shareOf } from './knowness';
import { answerIndex } from './measures';
import { renamer, type AnswerRecord, type Learner } from './learn';
import { cardsAbout } from './prerequisites';
import {
  bandCounts, CLASS_STEP_LABEL, classStep, classTiles, distinctTiles, practiseGraph, practiseIds, QUILT_BANDS, QUILT_LABEL, QUILT_MARK, QUILT_SAYS,
  questionClassStats, quiltBand, quiltGroups, sortQuestions, type ClassTile, type QuestionClassStat, type QuestionSort, type QuiltBand, type QuiltGroup, type QuiltTile
} from './quilt';
import { planOf, type Plan } from './revision';
import { RevisionRun } from './RevisionRun';
import type { Group } from './selection';
import type { Entity } from './schema';
import { cardLine, shownGiven } from './AnswerLog';
import { entityNameTex, percent, useCtx } from './ui';
import { groupTitle, readView, viewGroups, viewList, withKnowing, type ViewDoc } from './views';
import { TexText } from '../ui/tex/Tex';
import './quilt.css';

/** Die Antworten einer Person je Karte (`answerIndex`). */
export type AnswersOf = (card: Card) => readonly AnswerRecord[];

/** Was die Kenntnis aus Antworten macht: je Karte ihre Marken. */
function gaugeOf(cards: readonly Card[], answers: AnswersOf, deps: Parameters<typeof gaugeFromMarks>[2], now: number): Gauge {
  const byKey = new Map(cards.map((c) => [c.key, c] as const));
  return gaugeFromMarks(cards, (key) => { const c = byKey.get(key); return c === undefined ? [] : answers(c).map((a) => ({ at: a.at, correctness: a.correctness })); }, deps, now);
}

/** Sanft rollen — ausser wer weniger Bewegung will. */
const smooth = (): ScrollBehavior => (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/* -- Kacheln mit Pfeilen ------------------------------------------------------------------------------------------- */

/** Pfeile von Kachel zu Kachel: ←/→ der Reihe nach, ↑/↓ die nächste darüber/darunter, Pos1/Ende die erste, letzte. */
function moveFocus(e: KeyboardEvent<HTMLElement>, root: HTMLElement | null): void {
  const el = e.target as HTMLElement;
  if (root === null || el.dataset.quiltTile === undefined) return;
  const tiles = [...root.querySelectorAll<HTMLElement>('[data-quilt-tile]')];
  const i = tiles.indexOf(el);
  let to: HTMLElement | undefined;
  if (e.key === 'ArrowRight') to = tiles[i + 1];
  else if (e.key === 'ArrowLeft') to = tiles[i - 1];
  else if (e.key === 'Home') to = tiles[0];
  else if (e.key === 'End') to = tiles[tiles.length - 1];
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const down = e.key === 'ArrowDown';
    let best: { el: HTMLElement; dy: number; dx: number } | null = null;
    for (const t of tiles) {
      if (t === el) continue;
      const q = t.getBoundingClientRect();
      if (down ? q.top < r.bottom - 2 : q.bottom > r.top + 2) continue;
      const dy = down ? q.top - r.bottom : r.top - q.bottom;
      const dx = Math.abs(q.left + q.width / 2 - cx);
      if (best === null || dy < best.dy - 2 || (Math.abs(dy - best.dy) <= 2 && dx < best.dx)) best = { el: t, dy, dx };
    }
    to = best?.el;
  } else return;
  e.preventDefault();
  to?.focus();
}

/** Die Legende: Zeichen, Farbe und Wort jeder Stufe — mit der Zahl. */
function Legend({ counts }: { counts: Readonly<Record<QuiltBand, number>> }) {
  return (
    <ul className="cg-quilt-legend" aria-label="Legenda">
      {QUILT_BANDS.map((b) => (
        <li key={b} title={QUILT_SAYS[b]}>
          <span className={`cg-quilt-swatch is-${b}`} aria-hidden>{QUILT_MARK[b]}</span>
          {QUILT_LABEL[b]} <span className="cg-muted">{counts[b]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Die Überschrift einer Gruppe — mit der Überschrift darüber (dem Kapitel), wenn sie wechselt. */
function GroupHead({ group, before, count }: { group: QuiltGroup; before: QuiltGroup | undefined; count: ReactNode }) {
  const { lib } = useCtx();
  const vlib = lib;
  return (
    <>
      {group.head !== undefined && group.head.key !== before?.head?.key && (
        <h4 className="cg-quilt-head" data-quilt-head={group.head.key}><TexText text={groupTitle(vlib, group.head)} /></h4>
      )}
      {group.label !== '' && (
        <h5 className="cg-quilt-group-title">
          <TexText text={groupTitle(vlib, group)} />
          <span className="cg-muted cg-quilt-count">{count}</span>
        </h5>
      )}
    </>
  );
}

/* -- Für den Lernenden (und die Lehrerin je Uczący się) ----------------------------------------------------------- */

export function QuiltView({ view, cards, answers, learner = null, list, onOpen, compact = false, more }: {
  view: ViewDoc;
  /** Alle Karten der Baza (die Kenntnis eines Eintrags rechnet über alle seine Karten). */
  cards: readonly Card[];
  /** Die Antworten dessen, dessen Karte es ist. */
  answers: AnswersOf;
  /** Wer selbst lernt: dann „Ćwicz to" (die Lehrerin sieht die Karte eines anderen ohne). */
  learner?: Learner | null;
  /** Die Einträge, schon gewählt (Wpisy rechnet sie selbst) — sonst aus dem Widok. */
  list?: readonly Entity[];
  onOpen?: (id: string) => void;
  /** Klein (ein Baustein als Block): ohne Legende, höchstens 60 Kacheln. */
  compact?: boolean;
  /** Was unter einer abgeschnittenen Karte steht (der Weg zum Ganzen). */
  more?: ReactNode;
}) {
  const { lib } = useCtx();
  const answered = useMemo(() => cards.reduce((n, c) => n + answers(c).length, 0), [cards, answers]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gauge = useMemo(() => gaugeOf(cards, answers, lib.dependencies(), Date.now()), [cards, answers, answered, lib, lib.revision]);
  const vlib = useMemo(() => withKnowing(lib, gauge), [lib, gauge]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entities = useMemo(() => list ?? viewList(vlib, view), [list, vlib, view, lib.revision]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => quiltGroups(entities.map((e) => e.id), view.group === null ? null : viewGroups(vlib, view, entities), gauge), [entities, vlib, gauge, JSON.stringify(view.group)]);
  const [chosen, setChosen] = useState<{ id: string; group: string } | null>(null);
  const [practise, setPractise] = useState<{ plan: Plan; title: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const tiles = useMemo(() => distinctTiles(groups), [groups]);
  const counts = useMemo(() => bandCounts(tiles), [tiles]);

  if (practise !== null) {
    return <RevisionRun lib={lib} learner={learner} source={{ plan: practise.plan, cards, title: practise.title }} onClose={() => setPractise(null)} />;
  }
  if (tiles.length === 0) return <p className="cg-muted" data-quilt-empty="">W tym widoku nie ma wpisów.</p>;

  const practiseNow = (tile: QuiltTile) => {
    if (learner === null) return;
    setNote(null);
    void (async () => {
      const fp = new Map(cards.map((c) => [c.key, c.fingerprint] as const));
      const rename = renamer(lib.merges());
      const ctx = lib.revisionContext(cards, (key) => learner.marks(key, fp.get(key), rename), Date.now());
      const made = await planOf(practiseGraph(practiseIds(cards, tile.id), tile.band !== 'known'), ctx);
      const plan = made.plan === null ? null : { ...made.plan, cards: made.plan.cards.filter((c) => !learner.progress.suspended.has(c.key)) };
      if (plan === null || plan.cards.length === 0) { setNote(made.problems[0] ?? 'Do tego wpisu nie ma jeszcze pytań.'); return; }
      const e = lib.entity(tile.id);
      setPractise({ plan, title: `Ćwiczenie: ${e === undefined ? 'wpis' : lib.label(e)}` });
    })();
  };

  let shown = 0;
  const limit = compact ? 60 : Number.POSITIVE_INFINITY;
  return (
    <div className="cg-quilt" ref={root} onKeyDown={(e) => moveFocus(e, root.current)} data-quilt={tiles.length} data-quilt-known={counts.known}>
      <div className="cg-quilt-top">
        <span className="cg-quilt-sum" data-quilt-sum="">{counts.known === tiles.length ? `Umiesz wszystko (${tiles.length})` : `Umiesz ${counts.known} z ${tiles.length}`}</span>
        {!compact && <Legend counts={counts} />}
      </div>
      {groups.map((group, gi) => {
        if (shown >= limit) return null;
        const room = Math.max(0, limit - shown);
        const own = group.tiles.slice(0, room);
        shown += own.length;
        const k = group.tiles.filter((t) => t.band === 'known').length;
        return (
          <section key={`${group.key}#${gi}`} className="cg-quilt-group" data-quilt-group={group.key}>
            <GroupHead group={group} before={groups[gi - 1]} count={`${k}/${group.tiles.length}`} />
            <div className={`cg-quilt-tiles${compact ? ' is-compact' : ''}`} role="list">
              {own.map((t) => (
                <div key={t.id} role="listitem" className="cg-quilt-cell">
                  <Tile tile={t} on={chosen?.id === t.id} onChoose={() => setChosen(chosen?.id === t.id ? null : { id: t.id, group: `${group.key}#${gi}` })} />
                </div>
              ))}
            </div>
            {chosen !== null && chosen.group === `${group.key}#${gi}` && group.tiles.some((t) => t.id === chosen.id) && (
              <QuiltPanel tile={group.tiles.find((t) => t.id === chosen.id)!} cards={cards} answers={answers} onOpen={onOpen}
                onClose={() => { const id = chosen.id; setChosen(null); window.requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-quilt-tile="${CSS.escape(id)}"]`)?.focus()); }}
                {...(learner === null ? {} : { onPractise: practiseNow })} note={note} />
            )}
          </section>
        );
      })}
      {shown < tiles.length && <p className="cg-muted">Pokazano {shown} z {tiles.length} wpisów{more !== undefined ? ' — ' : '.'}{more}</p>}
    </div>
  );
}

function Tile({ tile, on, onChoose }: { tile: QuiltTile; on: boolean; onChoose: () => void }) {
  const { lib } = useCtx();
  const e = lib.entity(tile.id);
  const plain = e === undefined ? tile.id.slice(-6) : lib.label(e);
  const known = tile.answered > 0 || tile.knowness > 0 ? ` · ${percent(shareOf(tile.knowness))}` : '';
  return (
    <button type="button" className={`cg-quilt-tile is-${tile.band}${tile.cards === 0 ? ' is-bare' : ''}${on ? ' is-on' : ''}`} aria-pressed={on}
      data-quilt-tile={tile.id} data-band={tile.band} aria-label={`${plain}: ${QUILT_LABEL[tile.band]}${known}${tile.cards === 0 ? ' · bez pytań' : ''}`}
      title={`${plain} — ${QUILT_LABEL[tile.band]}${known}`} onClick={onChoose}>
      <span className="cg-quilt-mark" aria-hidden>{QUILT_MARK[tile.band]}</span>
      <span className="cg-quilt-label"><TexText text={e === undefined ? plain : lib.labelTex(e)} /></span>
    </button>
  );
}

/** Die letzte Antwort einer Frage, als Zeichen und Wort. */
function lastMark(list: readonly AnswerRecord[]): { readonly glyph: string; readonly word: string; readonly state: string } {
  const last = list[list.length - 1];
  if (last === undefined) return { glyph: '—', word: 'jeszcze nie', state: 'is-none' };
  if (last.correctness >= 0.999) return { glyph: '✓', word: 'dobrze', state: 'is-right' };
  if (last.correctness >= 0.5) return { glyph: '½', word: 'częściowo', state: 'is-near' };
  return { glyph: '✗', word: 'źle', state: 'is-wrong' };
}

/** DIE TAFEL EINER KACHEL: lesen, die Fragen mit der letzten Antwort, üben, im Buch nachschlagen. */
function QuiltPanel({ tile, cards, answers, onClose, onPractise, onOpen, note }: {
  tile: QuiltTile;
  cards: readonly Card[];
  answers: AnswersOf;
  onClose: () => void;
  onPractise?: (tile: QuiltTile) => void;
  onOpen?: (id: string) => void;
  note: string | null;
}) {
  const { lib } = useCtx();
  const entity = lib.entity(tile.id);
  const about = useMemo(() => cardsAbout(cards, tile.id), [cards, tile.id]);
  const headId = `cg-quilt-${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus({ preventScroll: true }); panel.current?.scrollIntoView({ block: 'nearest', behavior: smooth() }); }, [tile.id]);
  const name = (id: string) => entityNameTex(lib, id);
  return (
    <section ref={panel} className="cg-quilt-panel" data-quilt-panel={tile.id} aria-labelledby={headId} tabIndex={-1}>
      <div className="cg-quilt-panel-head">
        <h4 id={headId} className="cg-quilt-panel-title"><TexText text={entity === undefined ? tile.id : lib.labelTex(entity)} /></h4>
        <span className={`cg-quilt-badge is-${tile.band}`} data-quilt-badge={tile.band}>
          <span aria-hidden>{QUILT_MARK[tile.band]}</span> {QUILT_LABEL[tile.band]}{tile.answered > 0 || tile.knowness > 0 ? ` · ${percent(shareOf(tile.knowness))}` : ''}
        </span>
        <button type="button" className="wk-link-btn" onClick={onClose} data-quilt-close="">Zamknij</button>
      </div>
      {entity !== undefined && <TopicIntro lib={lib} entity={entity} noTitle noSource />}
      <div className="cg-quilt-actions">
        {onPractise !== undefined && about.length > 0 && <button type="button" className="wk-btn" data-quilt-practise="" onClick={() => onPractise(tile)}>Ćwicz to</button>}
        {entity !== undefined && <SourceOpen lib={lib} entity={entity} />}
        {onOpen !== undefined && <button type="button" className="wk-link-btn" onClick={() => onOpen(tile.id)}>Otwórz wpis</button>}
      </div>
      {note !== null && <p className="wk-note" role="status">{note}</p>}
      <h5 className="cg-quilt-sub">Pytania <span className="cg-muted">({about.length})</span></h5>
      {about.length === 0 ? <p className="cg-muted">Do tego wpisu nie ma jeszcze pytań.</p> : (
        <ul className="cg-quilt-questions" data-quilt-questions={about.length}>
          {about.slice(0, 60).map((card) => {
            const list = answers(card);
            const m = lastMark(list);
            const last = list[list.length - 1];
            return (
              <li key={card.key} className={m.state} data-quilt-question={card.key}>
                <span className="cg-quilt-result" aria-label={m.word}>{m.glyph}</span>
                <span className="cg-quilt-q"><TexText text={cardLine(card, name)} /></span>
                <span className="cg-muted cg-quilt-when">
                  {last === undefined ? 'jeszcze nie' : `${m.word} · ${new Date(last.at).toLocaleDateString('pl-PL')} · ${list.length} ${list.length === 1 ? 'odpowiedź' : 'odp.'}`}
                  {last !== undefined && (last.hints ?? 0) > 0 ? ` · podpowiedzi: ${last.hints}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* -- Die Karten einer Baza: welche Widoki Mapy postępów sind ---------------------------------------------------- */

/** Die Widoki der Baza im Modus `quilt` — in der Reihenfolge ihrer Namen. */
export function useQuiltViews(): { readonly id: string; readonly view: ViewDoc }[] {
  const { lib } = useCtx();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => lib.docs('view').map((e) => ({ id: e.id, view: readView(e.data) })).filter((x) => x.view.mode === 'quilt')
    .sort((a, b) => a.view.name.localeCompare(b.view.name, 'pl', { numeric: true })), [lib, lib.revision]);
}

/** Welcher Widok gezeigt wird — gemerkt in diesem Browser (eine Bequemlichkeit). */
function useChosenView(views: readonly { readonly id: string }[]): [string | null, (id: string) => void] {
  const { lib } = useCtx();
  const key = `cg-quilt-view:${lib.libraryId}`;
  const [id, setId] = useState<string | null>(() => { try { return window.localStorage.getItem(key); } catch { return null; } });
  const shown = views.find((v) => v.id === id)?.id ?? views[0]?.id ?? null;
  const set = (next: string) => { setId(next); try { window.localStorage.setItem(key, next); } catch { /* ohne Speicher */ } };
  return [shown, set];
}

function ViewChooser({ views, value, onChange }: { views: readonly { readonly id: string; readonly view: ViewDoc }[]; value: string; onChange: (id: string) => void }) {
  if (views.length < 2) return null;
  return (
    <label className="wk-field cg-quilt-choose">
      <span>Mapa</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} data-quilt-view="">
        {views.map((v) => <option key={v.id} value={v.id}>{v.view.name}</option>)}
      </select>
    </label>
  );
}

/**
 * DIE MAPY POSTĘPÓW EINER BAZA für eine Person (Nauka → Postępy; die Lehrerin je Uczący się): die Widoki im Modus
 * `quilt`, einer gewählt. Ohne solchen Widok nichts — eine Baza ohne sieht aus wie bisher.
 */
export function QuiltMaps({ cards, answers, learner = null, onOpen }: { cards: readonly Card[]; answers: AnswersOf; learner?: Learner | null; onOpen?: (id: string) => void }) {
  const views = useQuiltViews();
  const [chosen, choose] = useChosenView(views);
  const one = views.find((v) => v.id === chosen);
  if (one === undefined) return null;
  return (
    <div className="cg" data-quilt-maps={views.length}>
      <ViewChooser views={views} value={one.id} onChange={choose} />
      <QuiltView key={one.id} view={one.view} cards={cards} answers={answers} learner={learner} {...(onOpen === undefined ? {} : { onOpen })} />
    </div>
  );
}

/**
 * FÜR DEN REITER „UCZ SIĘ" (Nauka einer Baza): die Mapa postępów des eigenen Lernenden — ohne Widok im Modus „Mapa
 * postępów" nichts. Ein Baustein zum Einsetzen: `<LearnQuilt cards={cards} learner={learner} />`.
 */
export function LearnQuilt({ cards, learner }: { cards: readonly Card[] | null; learner: Learner | null }) {
  const { lib } = useCtx();
  const views = useQuiltViews();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const answers = useMemo<AnswersOf>(() => (learner === null ? () => [] : answerIndex(learner.progress, renamer(lib.merges()))), [learner, learner?.progress, lib]);
  if (views.length === 0 || cards === null) return null;
  return (
    <section className="cg-card" data-learn-quilt="">
      <h3>Mapa postępów</h3>
      <QuiltMaps cards={cards} answers={answers} learner={learner} />
    </section>
  );
}

/* -- Für die Lehrerin: alle zusammen -------------------------------------------------------------------------------- */

export interface ClassLearner {
  readonly id: string;
  readonly name: string;
  readonly answers: AnswersOf;
}

/**
 * DIE KLASSE AUF DER KARTE: je Eintrag, wie viele Uczący się ihn können — die Farbe in vier Schritten nach dem Anteil,
 * die Zahl darauf („3/5"), „—" ohne Antwort. Ein Klick: wer wo steht, und je Frage zu diesem Eintrag, wie es der
 * Klasse ging.
 */
export function ClassQuilt({ view, cards, learners }: { view: ViewDoc; cards: readonly Card[]; learners: readonly ClassLearner[] }) {
  const { lib } = useCtx();
  const gauges = useMemo(() => { const now = Date.now(); return learners.map((l) => ({ l, g: gaugeOf(cards, l.answers, lib.dependencies(), now) })); }, [learners, cards, lib]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entities = useMemo(() => viewList(lib, view), [lib, view, lib.revision]);
  const groups: readonly { key: string; label: string; head?: Group['head']; ids: readonly string[] }[] = useMemo(() => {
    const ids = entities.map((e) => e.id);
    if (view.group === null) return [{ key: '', label: '', ids }];
    const inView = new Set(ids);
    return viewGroups(lib, view, entities).map((g) => ({ ...g, ids: g.ids.filter((id) => inView.has(id)) })).filter((g) => g.ids.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, lib, JSON.stringify(view.group)]);
  const tiles = useMemo(() => classTiles(entities.map((e) => e.id), gauges.map((x) => x.g)), [entities, gauges]);
  const [chosen, setChosen] = useState<{ id: string; group: string } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  if (entities.length === 0) return <p className="cg-muted">W tym widoku nie ma wpisów.</p>;
  const all = [...tiles.values()];
  const everybody = all.filter((t) => t.learners > 0 && t.known === t.learners).length;
  return (
    <div className="cg-quilt is-class" ref={root} onKeyDown={(e) => moveFocus(e, root.current)} data-class-quilt={learners.length}>
      <div className="cg-quilt-top">
        <span className="cg-quilt-sum">Wszyscy umieją {everybody} z {all.length} · uczących się: {learners.length}</span>
        <ul className="cg-quilt-legend" aria-label="Legenda">
          {([1, 2, 3, 4] as const).map((s) => <li key={s}><span className={`cg-quilt-swatch is-c${s}`} aria-hidden />{CLASS_STEP_LABEL[s]}</li>)}
          <li><span className="cg-quilt-swatch is-c0" aria-hidden>—</span>nikt jeszcze nie odpowiadał</li>
        </ul>
      </div>
      {groups.map((group, gi) => {
        const qg: QuiltGroup = { key: group.key, label: group.label, ...(group.head === undefined ? {} : { head: group.head }), tiles: [] };
        const before = gi === 0 ? undefined : { key: groups[gi - 1]!.key, label: groups[gi - 1]!.label, ...(groups[gi - 1]!.head === undefined ? {} : { head: groups[gi - 1]!.head }), tiles: [] };
        const own = group.ids.map((id) => tiles.get(id)!).filter((t) => t !== undefined);
        const k = own.filter((t) => t.learners > 0 && t.known === t.learners).length;
        const at = `${group.key}#${gi}`;
        return (
          <section key={at} className="cg-quilt-group" data-quilt-group={group.key}>
            <GroupHead group={qg} before={before} count={`${k}/${own.length}`} />
            <div className="cg-quilt-tiles" role="list">
              {own.map((t) => (
                <div key={t.id} role="listitem" className="cg-quilt-cell">
                  <ClassTileButton tile={t} on={chosen?.id === t.id} onChoose={() => setChosen(chosen?.id === t.id ? null : { id: t.id, group: at })} />
                </div>
              ))}
            </div>
            {chosen !== null && chosen.group === at && tiles.has(chosen.id) && (
              <ClassPanel tile={tiles.get(chosen.id)!} cards={cards} gauges={gauges} learners={learners}
                onClose={() => { const id = chosen.id; setChosen(null); window.requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-quilt-tile="${CSS.escape(id)}"]`)?.focus()); }} />
            )}
          </section>
        );
      })}
    </div>
  );
}

function ClassTileButton({ tile, on, onChoose }: { tile: ClassTile; on: boolean; onChoose: () => void }) {
  const { lib } = useCtx();
  const e = lib.entity(tile.id);
  const plain = e === undefined ? tile.id.slice(-6) : lib.label(e);
  const step = classStep(tile);
  const words = tile.answered === 0 ? 'nikt jeszcze nie odpowiadał' : `umie ${tile.known} z ${tile.learners}`;
  return (
    <button type="button" className={`cg-quilt-tile is-c${step}${on ? ' is-on' : ''}`} aria-pressed={on} data-quilt-tile={tile.id} data-class-step={step}
      aria-label={`${plain}: ${words}`} title={`${plain} — ${words}`} onClick={onChoose}>
      <span className="cg-quilt-mark is-count" aria-hidden>{tile.answered === 0 ? '—' : `${tile.known}/${tile.learners}`}</span>
      <span className="cg-quilt-label"><TexText text={e === undefined ? plain : lib.labelTex(e)} /></span>
    </button>
  );
}

/** Die Tafel einer Kachel der Klasse: wer wo steht, und die Fragen dazu mit den Zahlen der Klasse. */
function ClassPanel({ tile, cards, gauges, learners, onClose }: {
  tile: ClassTile;
  cards: readonly Card[];
  gauges: readonly { readonly l: ClassLearner; readonly g: Gauge }[];
  learners: readonly ClassLearner[];
  onClose: () => void;
}) {
  const { lib } = useCtx();
  const entity = lib.entity(tile.id);
  const about = useMemo(() => cardsAbout(cards, tile.id), [cards, tile.id]);
  const stats = useMemo(() => sortQuestions(questionClassStats(about, learners, shownGiven), 'success'), [about, learners]);
  const headId = `cg-quilt-${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus({ preventScroll: true }); panel.current?.scrollIntoView({ block: 'nearest', behavior: smooth() }); }, [tile.id]);
  const by = QUILT_BANDS.slice().reverse().map((b) => ({ b, who: gauges.filter((x) => quiltBand(x.g, tile.id) === b).map((x) => x.l.name) }));
  return (
    <section ref={panel} className="cg-quilt-panel" data-quilt-panel={tile.id} aria-labelledby={headId} tabIndex={-1}>
      <div className="cg-quilt-panel-head">
        <h4 id={headId} className="cg-quilt-panel-title"><TexText text={entity === undefined ? tile.id : lib.labelTex(entity)} /></h4>
        <span className="cg-muted">umie {tile.known} z {tile.learners}{tile.learners > 0 ? ` (${percent(tile.share)})` : ''}</span>
        <button type="button" className="wk-link-btn" onClick={onClose} data-quilt-close="">Zamknij</button>
      </div>
      <ul className="cg-quilt-who" data-quilt-who="">
        {by.filter((x) => x.who.length > 0).map(({ b, who }) => (
          <li key={b}><span className={`cg-quilt-badge is-${b}`}><span aria-hidden>{QUILT_MARK[b]}</span> {QUILT_LABEL[b]} ({who.length})</span> {who.join(', ')}</li>
        ))}
      </ul>
      <h5 className="cg-quilt-sub">Pytania <span className="cg-muted">({about.length})</span></h5>
      {stats.length === 0 ? <p className="cg-muted">{about.length === 0 ? 'Do tego wpisu nie ma pytań.' : 'Nikt jeszcze nie odpowiadał na te pytania.'}</p> : <QuestionRows stats={stats} />}
    </section>
  );
}

/* -- Je Frage: wo die Klasse scheitert ----------------------------------------------------------------------------- */

const pctOr = (v: number | null): string => (v === null ? '—' : percent(v));
const num1 = (v: number | null): string => (v === null ? '—' : v.toFixed(1).replace('.', ','));

const COLUMNS: readonly { readonly by: QuestionSort | null; readonly label: string; readonly says?: string }[] = [
  { by: null, label: 'Pytanie' },
  { by: 'learners', label: 'Uczący się', says: 'ilu odpowiadało' },
  { by: 'success', label: 'Skuteczność', says: 'odpowiedzi całkiem dobre (bez podpowiedzi)' },
  { by: 'first', label: 'Za pierwszym razem', says: 'ilu odpowiedziało dobrze od razu' },
  { by: 'attempts', label: 'Średnio prób', says: 'odpowiedzi na osobę' },
  { by: 'hints', label: 'Podpowiedzi', says: 'odsłonięte podpowiedzi razem (w ilu odpowiedziach)' },
  { by: null, label: 'Najczęstsza zła odpowiedź' }
];

function QuestionRows({ stats }: { stats: readonly QuestionClassStat[] }) {
  const { lib } = useCtx();
  const name = (id: string) => entityNameTex(lib, id);
  return (
    <div className="cg-table-wrap">
      <table className="cg-table cg-stats-table" data-class-questions={stats.length}>
        <thead><tr>{COLUMNS.map((c) => <th key={c.label} scope="col" title={c.says}>{c.label}</th>)}</tr></thead>
        <tbody>
          {stats.slice(0, 300).map((s) => <QuestionRow key={s.card.key} s={s} name={name} />)}
        </tbody>
      </table>
    </div>
  );
}

function QuestionRow({ s, name }: { s: QuestionClassStat; name: (id: string) => string }) {
  return (
    <tr className={s.success === null ? 'is-unseen' : s.success >= 0.9 ? 'is-known' : 'is-learning'} data-class-question={s.card.key}>
      <td className="cg-stats-q"><TexText text={cardLine(s.card, name)} /></td>
      <td>{s.learners}</td>
      <td>{pctOr(s.success)} <span className="cg-muted">({s.right}/{s.answers})</span></td>
      <td>{pctOr(s.firstRight)}</td>
      <td>{num1(s.attempts)}</td>
      <td>{s.hints === 0 ? '—' : `${s.hints} (${s.hinted})`}</td>
      <td className="cg-stats-q">{s.wrong === null ? '—' : <><TexText text={s.wrong.text} /> <span className="cg-muted">×{s.wrong.count}</span></>}</td>
    </tr>
  );
}

/**
 * JE FRAGE ÜBER ALLE UCZĄCY SIĘ — sortierbar (ein Klick auf die Spalte; noch einmal: umgekehrt): wo die Klasse
 * scheitert (Skuteczność, das Schwächste zuerst), wo es viele Versuche braucht, wo man nach Podpowiedzi greift, und die
 * häufigste falsche Antwort.
 */
export function ClassQuestions({ cards, learners }: { cards: readonly Card[]; learners: readonly ClassLearner[] }) {
  const { lib } = useCtx();
  const stats = useMemo(() => questionClassStats(cards, learners, shownGiven), [cards, learners]);
  const [sort, setSort] = useState<{ by: QuestionSort; dir: 1 | -1 }>({ by: 'success', dir: 1 });
  const sorted = useMemo(() => sortQuestions(stats, sort.by, sort.dir), [stats, sort]);
  const name = (id: string) => entityNameTex(lib, id);
  if (stats.length === 0) return <p className="cg-muted">Nikt jeszcze nie odpowiadał w tym zakresie.</p>;
  return (
    <div className="cg-table-wrap">
      <table className="cg-table cg-stats-table" data-class-questions={stats.length}>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.label} scope="col" title={c.says} aria-sort={c.by !== null && c.by === sort.by ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                {c.by === null ? c.label : (
                  <button type="button" data-sort={c.by} onClick={() => setSort((was) => ({ by: c.by!, dir: was.by === c.by ? (was.dir === 1 ? -1 : 1) : 1 }))}>
                    {c.label}{c.by === sort.by ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 300).map((s) => <QuestionRow key={s.card.key} s={s} name={name} />)}
        </tbody>
      </table>
      {sorted.length > 300 && <span className="cg-muted">Pokazano 300 z {sorted.length}.</span>}
      <span className="cg-muted">Skuteczność liczy tylko odpowiedzi całkiem dobre — dobra odpowiedź z podpowiedzią się do niej nie wlicza.</span>
    </div>
  );
}

/**
 * DIE MAPY DER KLASSE (Postępy uczących się): ein Widok im Modus `quilt` gewählt — alle zusammen, und darunter, wenn
 * eine Person gewählt ist, ihre Karte.
 */
export function ClassMaps({ cards, learners }: { cards: readonly Card[]; learners: readonly ClassLearner[] }) {
  const views = useQuiltViews();
  const [chosen, choose] = useChosenView(views);
  const [person, setPerson] = useState<string>('');
  const one = views.find((v) => v.id === chosen);
  if (one === undefined) return null;
  const who = learners.find((l) => l.id === person);
  return (
    <div className="cg" data-class-maps={views.length}>
      <div className="cg-row">
        <ViewChooser views={views} value={one.id} onChange={choose} />
        <label className="wk-field cg-quilt-choose">
          <span>Kto</span>
          <select value={person} onChange={(e) => setPerson(e.target.value)} data-quilt-person="">
            <option value="">wszyscy razem</option>
            {learners.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      </div>
      {who === undefined
        ? <ClassQuilt key={one.id} view={one.view} cards={cards} learners={learners} />
        : <Fragment key={`${one.id}:${who.id}`}><p className="cg-muted">Mapa: {who.name}</p><QuiltView view={one.view} cards={cards} answers={who.answers} /></Fragment>}
    </div>
  );
}
