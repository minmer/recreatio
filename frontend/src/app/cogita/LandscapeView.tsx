/**
 * 2026-11-03 — DER KRAJOBRAZ (Widok im Modus `landscape`, auf einer Seite `krajobraz`): die eigene Landschaft des
 * Wissens. Gerechnet in `landscape.ts` (im Worker, `landscapeClient.ts`); gesammelt aus der Baza in `landscapeData.ts`.
 *
 * <code>
 *   Bild      ein Halbkreis vor dem Lernenden (unten in der Mitte), halbschräg (30°/60°) auf einem Sechseckraster:
 *             das Tal (gelernt, je verblasster desto höher), der Ring (jetzt zu lernen), die Berge (n fehlende
 *             Schritte, gestapelte Kacheln, ab 7 mit Zahl); das Fach nur als Farbe, nie als Rand; jedes Feld trägt
 *             sein Zeichen (● ◑ ○ ▲n), nie nur Farbe
 *   Klick     ein Feld: lesen, Fragen (die Tafel der Mapa postępów), lernen (`RevisionRun`, mit „Nowy temat"),
 *             wiederholen (nie gesperrt), der Weg eines Berges, „Ustaw jako cel"; ein Bereich: hineinzoomen
 *   Sperre    ein Ring-Feld, vor dem schon gefragte Karten verblasst oder falsch sind: „najpierw powtórz te N kart" —
 *             eine Lektion genau mit ihnen (das Allgemeine zuerst, endet, wenn alles sitzt), dann gleich das Neue
 *   Ziel      gesucht oder angeklickt, gemerkt je Lernendem (versiegelt wie der Fortschritt, ohne Konto im Browser):
 *             sein Weg über alle Bereiche (auch „3 kroki drogi w środku"), der nächste Schritt auf dem Ring
 *   Tasten    Tab zum Bild, Pfeile von Feld zu Feld, Enter wählt, Esc schliesst; dazu eine Liste für Vorleser
 * </code>
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

import type { Card } from './cardBasics';
import { gaugeFromMarks } from './knowing';
import { shareOf } from './knowness';
import { BAND_CODE, LS_BAND_LABEL, LS_BAND_MARK, LS_BUDGET, type LsBand, type LsField, type LsInput, type LsLayout, type LsRun, type LsState } from './landscape';
import { landscapeClient, type LandscapeClient } from './landscapeClient';
import { landscapeInput, landscapeState, lockCards } from './landscapeData';
import { renamer, type Learner } from './learn';
import { answerIndex } from './measures';
import { practiseGraph, practiseIds, tileOf } from './quilt';
import { QuiltPanel } from './QuiltView';
import { planOf, readPlan, type Plan } from './revision';
import { RevisionRun, type RunSource } from './RevisionRun';
import type { RewardRules } from './rewards';
import type { Graph } from './graph';
import { entityNameTex, percent, useCtx } from './ui';
import { needsKnowing, viewList, withKnowing, type ViewDoc } from './views';
import { TexText } from '../ui/tex/Tex';
import './landscape.css';

/* -- Die Zeichnung ------------------------------------------------------------------------------------------------ */

/** Halbschräg: der Boden um 60° gekippt — Tiefe gestaucht. */
const FORE = 0.52;
/** Ab so vielen Kacheln wird ein Berg nicht höher; die Zahl sagt den Rest. */
const CAP = 7;
/** Halber Abstand zweier Nachbarn bis zur Ecke (flache Oberseite), etwas kleiner — Fugen zwischen den Kacheln. */
const CORNER = (1 / Math.sqrt(3)) * 0.93;
const CORNERS = [0, 60, 120, 180, 240, 300].map((a) => [Math.cos((a * Math.PI) / 180) * CORNER, Math.sin((a * Math.PI) / 180) * CORNER] as const);

interface Geo {
  /** Pixel je Bodeneinheit (waagrecht). */
  readonly u: number;
  /** Pixel je Kachel in der Höhe. */
  readonly t: number;
  readonly width: number;
  readonly height: number;
  /** Wo der Lernende steht (Bildschirm). */
  readonly ox: number;
  readonly oy: number;
}

/** Die Höhe einer Kachel-Säule: Talgrund versenkt, Ring eine Platte, ein Berg n Kacheln (gedeckelt). */
function stackOf(f: Pick<LsField, 'band' | 'height'>): { readonly base: number; readonly top: number } {
  if (f.band === 'known' || f.band === 'due') return { base: f.height * 0.55, top: f.height * 0.55 };
  if (f.band === 'ring') return { base: 0, top: 0.32 };
  return { base: 0, top: 0.32 + Math.min(CAP, Math.max(1, f.height)) * 0.62 };
}

const pts = (list: readonly (readonly [number, number])[]): string => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Eine Kachel-Säule in eigenen Koordinaten (0,0 = Mitte am Boden): oben die Fläche, vorn drei Seiten. */
function prism(geo: Geo, base: number, top: number): { readonly top: string; readonly sides: readonly string[]; readonly rim: string } {
  const at = (i: number, z: number): [number, number] => [CORNERS[i][0] * geo.u, -CORNERS[i][1] * geo.u * FORE - z * geo.t];
  const topFace = pts([0, 1, 2, 3, 4, 5].map((i) => at(i, top)));
  /* Vorn (zum Lernenden): die Kanten unten — 180°→240°, 240°→300°, 300°→0°. */
  const sides = top > base + 1e-6 ? [[3, 4], [4, 5], [5, 0]].map(([a, b]) => pts([at(a, base), at(b, base), at(b, top), at(a, top)])) : [];
  const rim = pts([0, 1, 2, 3, 4, 5].map((i) => at(i, 0)));
  return { top: topFace, sides, rim };
}

/** Die Stelle eines Bodenpunkts auf dem Bildschirm. */
const screenOf = (geo: Geo, x: number, y: number): [number, number] => [geo.ox + x * geo.u, geo.oy - y * geo.u * FORE];

/* -- Daten ------------------------------------------------------------------------------------------------------- */

/** Die Gestalt aus dem Motor — der Graph nur, wenn er neu ist; der Stand nach jeder Antwort; veraltetes verworfen. */
function useLandscape(client: LandscapeClient | null, input: LsInput, state: LsState, options: { budget: number; focus: readonly string[]; goal: string | null; narrow: boolean }): { run: LsRun | null; failed: string | null } {
  const [run, setRun] = useState<LsRun | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /* Was DIESER Motor schon hat — ein neuer (StrictMode, ein neuer Worker) bekommt Graph und Stand noch einmal. */
  const sent = useRef<{ client: LandscapeClient | null; input: LsInput | null; state: LsState | null }>({ client: null, input: null, state: null });
  const seq = useRef(0);
  const focusKey = options.focus.join('|');
  useEffect(() => {
    if (client === null) return;
    const my = ++seq.current;
    const same = sent.current.client === client;
    const freshInput = same && sent.current.input === input ? undefined : input;
    const freshState = same && sent.current.state === state && freshInput === undefined ? undefined : state;
    sent.current = { client, input, state };
    client.run({ ...(freshInput === undefined ? {} : { input: freshInput }), ...(freshState === undefined ? {} : { state: freshState }), options: { budget: options.budget, focus: options.focus, goal: options.goal, narrow: options.narrow } })
      .then((r) => { if (my === seq.current) { setRun(r); setFailed(null); } }, (e: unknown) => { if (my === seq.current) setFailed(e instanceof Error ? e.message : String(e)); });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- der Fokus als Text
  }, [client, input, state, options.budget, focusKey, options.goal, options.narrow]);
  return { run, failed };
}

/** Wer weniger Bewegung will, bekommt keine. */
const still = (): boolean => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/* -- Die Ansicht ------------------------------------------------------------------------------------------------ */

export interface LandscapeProps {
  readonly view: ViewDoc;
  /** Alle Karten der Baza (die Kenntnis eines Eintrags rechnet über alle seine Karten). */
  readonly cards: readonly Card[];
  /** Wer hier lernt (das Konto, die Person der Seite, dieser Browser) — ohne: nur zum Ansehen. */
  readonly learner: Learner | null;
  readonly onOpen?: (id: string) => void;
  /** Klein (ein Baustein als Block): weniger Felder, ohne Liste. */
  readonly compact?: boolean;
  /** Punkte und Serie im Lauf (die Regel des Ortes). */
  readonly rewards?: RewardRules | null;
  /** Die Suche des Widoku — Treffer zum Zeigen und als Ziel. */
  readonly query?: string;
  /** Unter welchem Namen das Ziel gemerkt wird (der Widok). */
  readonly viewKey: string;
  /** Was unter einem kleinen Bild steht (der Weg zum Ganzen). */
  readonly more?: ReactNode;
}

type Running = { readonly key: string; readonly source: RunSource; readonly then?: () => void };

export function LandscapeView({ view, cards, learner, onOpen, compact = false, rewards = null, query = '', viewKey, more }: LandscapeProps) {
  const { lib } = useCtx();
  const rename = useMemo(() => renamer(lib.merges()), [lib]);
  const fp = useMemo(() => new Map(cards.map((c) => [c.key, c.fingerprint] as const)), [cards]);
  const [running, setRunning] = useState<Running | null>(null);
  const progress = learner?.progress;
  /* Während eines Laufs hier drin ruht die Rechnung (sonst bei jeder Antwort die ganze Kenntnis neu) — danach einmal. */
  const live = running === null ? progress : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- neu mit jedem Stand des Lernenden (nicht während eines Laufs)
  const gauge = useMemo(() => gaugeFromMarks(cards, (key) => learner?.marks(key, fp.get(key), rename) ?? [], lib.dependencies(), Date.now(), lib.prerequisites()), [cards, learner, live, fp, rename, lib, lib.revision]);
  /* Der Widok ohne seine Suche (sie zeigt Treffer, sie schneidet nicht); mit der Kenntnis nur, wenn er sie braucht. */
  const wants = needsKnowing(view);
  const plain = useMemo(() => ({ ...view, query: '' }), [view]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => viewList(wants ? withKnowing(lib, gauge) : lib, plain), [lib, lib.revision, plain, wants, wants ? gauge : null]);
  const listKey = useMemo(() => list.map((e) => e.id).join('|'), [list]);
  const groupKey = JSON.stringify(view.group);
  /* Die Eingänge ändern sich mit der Baza und dem Widok — nicht mit jeder Antwort (wer Karten hat, sagen die Karten). */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const input = useMemo(() => landscapeInput({ select: lib.selectContext(), deps: lib.dependencies(), label: (e) => lib.label(e) }, list, view.group, gauge), [lib, lib.revision, listKey, groupKey, cards]);
  const state = useMemo(() => landscapeState(input, gauge), [input, gauge]);
  const index = useMemo(() => new Map(input.ids.map((id, i) => [id, i] as const)), [input]);
  /* Der Motor lebt mit der Ansicht: im Effekt gebaut und beendet — auch zweimal (StrictMode) richtig. */
  const [client, setClient] = useState<LandscapeClient | null>(null);
  useEffect(() => {
    const made = landscapeClient();
    setClient(made);
    return () => { made.dispose(); setClient((was) => (was === made ? null : was)); };
  }, []);
  const [boxRef, boxWidth] = useWidth();

  const [focus, setFocus] = useState<readonly string[]>([]);
  useEffect(() => { setFocus([]); }, [groupKey, listKey]);
  const goalKey = `landscape:${viewKey}`;
  const [localGoal, setLocalGoal] = useState<string | null>(null);
  const kept = progress?.positions.get(goalKey)?.step ?? null;
  const goal = learner === null ? localGoal : kept === null || kept === '' ? null : kept;
  const setGoal = (id: string | null) => {
    if (learner === null) { setLocalGoal(id); return; }
    void learner.keepPosition({ flow: goalKey, step: id ?? '', visited: [], at: Date.now() }).catch(() => undefined);
  };
  /* Schmal (ein Telefon): weniger einzelne Felder — sonst würden die Sechsecke zu klein. */
  const wanted = view.landscape?.budget ?? LS_BUDGET;
  const budget = Math.min(wanted, compact ? 24 : 400, boxWidth > 0 && boxWidth < 480 ? 22 : boxWidth > 0 && boxWidth < 760 ? 40 : 400);
  const { run, failed } = useLandscape(client, input, state, { budget, focus, goal, narrow: boxWidth > 0 && boxWidth < 560 });

  const [chosen, setChosen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [said, setSaid] = useState('');
  const answers = useMemo(() => (learner === null ? () => [] : answerIndex(learner.progress, rename)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [learner, progress, rename]);

  const labelOf = (id: string): string => { const e = lib.entity(id); return e === undefined ? id : lib.label(e); };
  const bandOf = (id: string): LsBand | null => { const i = index.get(id); return i === undefined || run === null ? null : BAND_CODE[run.layout.bands[i]] ?? null; };
  const heightOf = (id: string): number => { const i = index.get(id); return i === undefined || run === null ? Number.NaN : run.layout.heights[i]; };
  const lockedOf = (id: string): boolean => { const i = index.get(id); return i !== undefined && run !== null && run.layout.locked[i] === 1; };

  /* -- Lernen ------------------------------------------------------------------------------------------- */

  const planFrom = async (graph: Graph): Promise<Plan | null> => {
    const ctx = lib.revisionContext(cards, (key) => learner?.marks(key, fp.get(key), rename) ?? [], Date.now());
    const made = await planOf(graph, ctx);
    if (made.plan === null) { setNote(made.problems[0] ?? 'Z tego wpisu nie powstają karty do nauki.'); return null; }
    const plan = { ...made.plan, cards: made.plan.cards.filter((c) => !(learner?.progress.suspended.has(c.key) ?? false)) };
    if (plan.cards.length === 0) { setNote('Do tego wpisu nie ma jeszcze pytań.'); return null; }
    return plan;
  };
  const learnEntry = (id: string, endWhenDone = true) => {
    setNote(null);
    void (async () => {
      const plan = await planFrom(practiseGraph(practiseIds(cards, id), endWhenDone));
      if (plan !== null) setRunning({ key: `learn:${id}:${Date.now()}`, source: { plan, cards, title: labelOf(id) } });
    })();
  };
  const reviewFirst = (id: string) => {
    setNote(null);
    const groups = lockCards(gauge, lib.prerequisites(), id, cards);
    const list = groups.flatMap((g) => g.cards).filter((c) => !(learner?.progress.suspended.has(c.key) ?? false));
    if (list.length === 0) { learnEntry(id); return; }
    const plan = readPlan(list, { mode: 'temporal', order: 'general', pick: 'next', stackSize: 20, endWhenDone: true });
    setRunning({ key: `review:${id}:${Date.now()}`, source: { plan, cards, title: `Najpierw powtórka: ${labelOf(id)}` }, then: () => learnEntry(id) });
  };

  /* Immer in einer Hülle, deren Breite gemessen wird (das Budget hängt an ihr) — auch beim Warten und im Lauf. */
  const host = (body: ReactNode) => <div ref={boxRef} className="cg-ls-host">{body}</div>;
  if (running !== null) {
    return host(
      <div className="cg-ls-run" data-landscape-run={running.key.split(':')[0]}>
        <RevisionRun key={running.key} lib={lib} learner={learner} source={running.source} rewards={rewards}
          onClose={() => setRunning(null)} {...(running.then === undefined ? {} : { onDone: running.then })} />
      </div>
    );
  }
  if (failed !== null) return host(<p className="wk-error" data-landscape-failed="">Krajobraz: {failed}</p>);
  if (run === null || client === null || boxWidth === 0) return host(<p className="cg-muted" data-landscape-wait="">Liczenie krajobrazu…</p>);
  const layout = run.layout;
  if (layout.total === 0 && layout.fields.length === 0) {
    return host(<p className="cg-muted" data-landscape-empty="">W tym widoku nie ma wpisów z pytaniami — krajobraz pokazuje to, czego można się uczyć.</p>);
  }

  const field = chosen === null ? undefined : layout.fields.find((f) => f.key === chosen);
  const entryChosen = chosen !== null && (field === undefined || field.kind === 'entry') && lib.entity(chosen) !== undefined ? chosen : null;
  const choose = (f: LsField) => {
    setNote(null);
    if (f.kind === 'area') {
      if (f.value !== undefined && f.value !== '' && !f.value.startsWith('#')) { setFocus([f.value]); setChosen(null); setSaid(`Pokazano: ${f.label}`); return; }
      setChosen(f.key);
      return;
    }
    setChosen(chosen === f.key ? null : f.key);
  };

  return host(
    <div className={`cg-ls${compact ? ' is-compact' : ''}`} data-landscape={layout.fields.length} data-landscape-ring={layout.counts.ring}
      data-landscape-ms={`${run.ms.graph.toFixed(1)}/${run.ms.heights.toFixed(1)}/${run.ms.layout.toFixed(1)}`} data-landscape-worker={client.inWorker ? '1' : '0'}>
      <TopBar layout={layout} focus={focus} onFocus={setFocus} goalLabel={layout.goal === null ? null : labelOf(layout.goal.id)} nextLabel={(id) => labelOf(id)}
        onClearGoal={() => setGoal(null)} onShowGoal={() => { if (layout.goal !== null) setChosen(layout.goal.id); }} />
      {query.trim() !== '' && (
        <SearchHits query={query} ids={input.ids} bandOf={bandOf} heightOf={heightOf} label={labelOf} goal={goal}
          onShow={(id) => setChosen(id)} onGoal={(id) => { setGoal(id); setSaid(`Cel: ${labelOf(id)}`); }} />
      )}
      {layout.notes.map((n) => <p key={n} className="cg-muted cg-ls-note">{n}</p>)}
      <LandscapeMap layout={layout} chosen={chosen} onChoose={choose} compact={compact} width={boxWidth} />
      {more}
      <p className="cg-sr" aria-live="polite">{said}</p>
      {field !== undefined && field.kind === 'area' && (field.value === '' || (field.value ?? '').startsWith('#')) && (
        <AreaPanel field={field} label={labelOf} bandOf={bandOf} onPick={(id) => setChosen(id)} onClose={() => setChosen(null)} />
      )}
      {entryChosen !== null && (
        <EntryPanel id={entryChosen} band={bandOf(entryChosen)} height={heightOf(entryChosen)} locked={lockedOf(entryChosen)} goal={goal === entryChosen}
          canLearn={learner !== null} gauge={gauge} cards={cards} answers={answers} client={client} label={labelOf} bandOf={bandOf} note={note}
          onLearn={() => learnEntry(entryChosen)} onReview={(band) => learnEntry(entryChosen, band !== 'known')} onReviewFirst={() => reviewFirst(entryChosen)}
          onGoal={(on) => { setGoal(on ? entryChosen : null); setSaid(on ? `Cel: ${labelOf(entryChosen)}` : 'Cel usunięty'); }}
          onClose={() => setChosen(null)} {...(onOpen === undefined ? {} : { onOpen })} />
      )}
      {!compact && <FieldList layout={layout} onChoose={choose} />}
    </div>
  );
}

/* -- Oben: wo man ist, die Bereiche, das Ziel --------------------------------------------------------------------- */

function TopBar({ layout, focus, onFocus, goalLabel, nextLabel, onClearGoal, onShowGoal }: {
  layout: LsLayout;
  focus: readonly string[];
  onFocus: (focus: readonly string[]) => void;
  goalLabel: string | null;
  nextLabel: (id: string) => string;
  onClearGoal: () => void;
  onShowGoal: () => void;
}) {
  const c = layout.counts;
  const mixed = new Set(focus);
  return (
    <div className="cg-ls-top">
      <nav className="cg-ls-crumbs" aria-label="Gdzie jesteś w krajobrazie">
        <button type="button" className="wk-link-btn" disabled={layout.path.length === 0 && focus.length === 0} onClick={() => onFocus([])} data-landscape-up="">Całość</button>
        {layout.path.map((p, i) => (
          <span key={p.value} className="cg-ls-crumb">
            <span aria-hidden>›</span>
            {i === layout.path.length - 1 ? <strong>{p.label}</strong> : <button type="button" className="wk-link-btn" onClick={() => onFocus([p.value])}>{p.label}</button>}
          </span>
        ))}
      </nav>
      <p className="cg-ls-sum" data-landscape-counts={`${c.known}/${c.due}/${c.ring}/${c.mountain}`}>
        <span><span aria-hidden>{LS_BAND_MARK.ring}</span> do nauki teraz <strong>{c.ring}</strong></span>
        <span><span aria-hidden>{LS_BAND_MARK.due}</span> do powtórki <strong>{c.due}</strong></span>
        <span><span aria-hidden>{LS_BAND_MARK.known}</span> umiem <strong>{c.known}</strong></span>
        <span><span aria-hidden>{LS_BAND_MARK.mountain}</span> za górami <strong>{c.mountain}</strong></span>
      </p>
      {layout.sectors.length > 1 && (
        <ul className="cg-ls-areas" aria-label="Obszary">
          {layout.sectors.map((s) => (
            <li key={s.value || '-'} className={`cg-ls-area is-s${s.subject >= 0 && s.subject < 8 ? s.subject : 'x'}`}>
              <span className="cg-ls-swatch" aria-hidden />
              {s.deeper || (s.value !== '' && !s.value.startsWith('#')) ? (
                <button type="button" className="wk-link-btn" onClick={() => onFocus([s.value])} data-landscape-area={s.value} title={`Przybliż: ${s.label}`}>{s.label}</button>
              ) : <span>{s.label}</span>}
              <span className="cg-muted"> {s.count}</span>
              {s.value !== '' && !s.value.startsWith('#') && (
                <button type="button" className={`cg-ls-mix${mixed.has(s.value) ? ' is-on' : ''}`} aria-pressed={mixed.has(s.value)} data-landscape-mix={s.value}
                  title={mixed.has(s.value) ? 'Usuń z połączonego widoku' : 'Połącz z innymi obszarami'}
                  onClick={() => onFocus(mixed.has(s.value) ? focus.filter((x) => x !== s.value) : [...focus.filter((x) => layout.sectors.some((y) => y.value === x)), s.value])}>{mixed.has(s.value) ? '−' : '+'}</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {layout.goal !== null && goalLabel !== null && (
        <p className="cg-ls-goal" data-landscape-goal={layout.goal.id} data-landscape-goal-steps={layout.goal.steps}>
          <span className="cg-ls-flag" aria-hidden>⚑</span>
          <span>Cel: <strong>{goalLabel}</strong> — {layout.goal.steps === 0 ? (layout.goal.open ? 'możesz zacząć od razu' : 'osiągnięty') : `brakuje ${layout.goal.steps} ${layout.goal.steps === 1 ? 'kroku' : 'kroków'}`}
            {layout.goal.next.length > 0 && layout.goal.steps > 0 && <> · następny krok: <strong>{nextLabel(layout.goal.next[0])}</strong></>}</span>
          <button type="button" className="wk-link-btn" onClick={onShowGoal}>Pokaż</button>
          <button type="button" className="wk-link-btn" onClick={onClearGoal} data-landscape-goal-clear="">Usuń cel</button>
        </p>
      )}
    </div>
  );
}

/* -- Das Bild ---------------------------------------------------------------------------------------------------- */

function useWidth(): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const measure = () => setWidth(Math.floor(el.clientWidth));
    measure();
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    watch?.observe(el);
    return () => watch?.disconnect();
  }, []);
  return [ref, width];
}

/** Die Grösse des Bildes: der Halbkreis passt ganz in die Breite (auch auf dem Telefon); die Höhe folgt. */
function geometryOf(layout: LsLayout, width: number): Geo {
  let maxX = 3.5;
  let maxY = 3.5;
  let tallest = 1;
  for (const f of layout.fields) {
    maxX = Math.max(maxX, Math.abs(f.x) + 0.9);
    maxY = Math.max(maxY, f.y + 1.1);
    tallest = Math.max(tallest, stackOf(f).top);
  }
  /* Platz für die Namen der Bereiche am Rand. */
  const u = Math.max(8, Math.min(48, (width - 20) / (2 * (maxX + 0.6))));
  const t = u * 0.4;
  const top = tallest * t + 30;
  const height = Math.ceil(top + (maxY + 0.8) * u * FORE + u * 1.4 + 6);
  return { u, t, width, height, ox: width / 2, oy: height - u * 1.1 };
}

/** Wie breit ein Name in der kleinen Schrift ungefähr ist (Pixel). */
const textWidth = (text: string): number => text.length * 6.4 + 6;

/**
 * WELCHE FELDER EINEN NAMEN BEKOMMEN: gewählt, Ziel, nächster Schritt, dann der Ring — nur so viele, wie ohne
 * Überdeckung passen (gierig, in dieser Reihenfolge). Der Rest sagt seinen Namen beim Zeigen und in der Liste.
 */
function labelsOf(layout: LsLayout, geo: Geo, chosen: string | null): Map<string, string> {
  const max = geo.width < 480 ? 14 : 22;
  const short = (s: string) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
  const order = [...layout.fields].filter((f) => f.kind === 'entry').sort((a, b) => {
    const rank = (f: LsField) => (f.key === chosen ? 0 : f.goal ? 1 : f.next ? 2 : f.band === 'ring' ? 3 : 9);
    return rank(a) - rank(b) || a.angle - b.angle;
  }).filter((f) => f.key === chosen || f.goal || f.next || f.band === 'ring');
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const out = new Map<string, string>();
  for (const f of order) {
    const text = short(f.label);
    const [sx, sy] = screenOf(geo, f.x, f.y);
    const w = textWidth(text);
    const box = { x0: sx - w / 2, x1: sx + w / 2, y0: sy + geo.u * 0.5 - 6, y1: sy + geo.u * 0.5 + 8 };
    if (box.x0 < 2 || box.x1 > geo.width - 2) continue;
    if (boxes.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1)) continue;
    boxes.push(box);
    out.set(f.key, text);
    if (out.size >= (geo.width < 480 ? 6 : 18)) break;
  }
  return out;
}

function LandscapeMap({ layout, chosen, onChoose, compact, width }: { layout: LsLayout; chosen: string | null; onChoose: (f: LsField) => void; compact: boolean; width: number }) {
  const geo = useMemo(() => geometryOf(layout, width), [layout, width]);
  const svg = useRef<SVGSVGElement>(null);
  const title = `cg-ls-${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  /* Weit hinten zuerst (die nahen Säulen decken die fernen). */
  const drawn = useMemo(() => [...layout.fields].sort((a, b) => b.y - a.y || a.x - b.x), [layout]);
  const names = useMemo(() => labelsOf(layout, geo, chosen), [layout, geo, chosen]);
  const motion = useMemo(() => !still(), []);
  const move = (e: KeyboardEvent<SVGSVGElement>) => {
    const el = (e.target as Element).closest('[data-ls-field]');
    if (el === null) return;
    const key = el.getAttribute('data-ls-field');
    const at = layout.fields.find((f) => f.key === key);
    if (at === undefined) return;
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const d = dirs[e.key];
    let next: LsField | undefined;
    if (d !== undefined) {
      let best = Number.POSITIVE_INFINITY;
      for (const f of layout.fields) {
        if (f.key === at.key) continue;
        const dx = f.x - at.x;
        const dy = f.y - at.y;
        const along = dx * d[0] + dy * d[1];
        if (along <= 0.05) continue;
        const across = Math.abs(dx * d[1] - dy * d[0]);
        const score = along + across * 2.2;
        if (score < best) { best = score; next = f; }
      }
    } else if (e.key === 'Home') next = layout.fields[0];
    else if (e.key === 'End') next = layout.fields[layout.fields.length - 1];
    else return;
    e.preventDefault();
    if (next !== undefined) svg.current?.querySelector<SVGGElement>(`[data-ls-field="${CSS.escape(next.key)}"]`)?.focus();
  };
  return (
    <div className={`cg-ls-map${compact ? ' is-compact' : ''}`}>
      {/* 2026-11-03 — mit viewBox und 100 % Breite: die gemessene Breite darf den Kasten nie offen halten (auf dem Telefon wuchs sonst die ganze Seite). */}
      <svg ref={svg} className="cg-ls-svg" width={geo.width} height={geo.height} viewBox={`0 0 ${Math.max(1, geo.width)} ${Math.max(1, geo.height)}`} role="group" aria-labelledby={title} onKeyDown={move} data-landscape-svg="">
        <title id={title}>Krajobraz wiedzy: przed Tobą pierścień tego, czego możesz się uczyć teraz; dalej góry — tym wyższe, im więcej kroków brakuje; przy Tobie dolina tego, co już umiesz.</title>
        <Ground layout={layout} geo={geo} />
        {drawn.map((f) => <Field key={f.key} field={f} geo={geo} on={chosen === f.key} onChoose={onChoose} motion={motion} />)}
        <Me geo={geo} />
        {/* Die Namen über allem (sonst deckte eine nahe Säule den Namen einer fernen); sie gleiten mit ihrem Feld. */}
        <g className="cg-ls-names" aria-hidden>
          {drawn.filter((f) => names.has(f.key)).map((f) => <Name key={f.key} field={f} geo={geo} text={names.get(f.key)!} motion={motion} />)}
        </g>
      </svg>
    </div>
  );
}

/** Der Boden: der Halbkreis, der Ring als Linie, die Namen der Bereiche am Rand — dort, wo ihre Felder stehen. */
function Ground({ layout, geo }: { layout: LsLayout; geo: Geo }) {
  const outer = Math.max(layout.ring + 1.6, ...layout.fields.map((f) => Math.hypot(f.x, f.y) + 0.8));
  const [lx, ly] = screenOf(geo, -outer, 0);
  const [rx] = screenOf(geo, outer, 0);
  const ry = outer * geo.u * FORE;
  const ringR = layout.ring * geo.u;
  /* Wo die Felder eines Bereichs im Mittel stehen (nach dem Auseinanderrücken), sonst die Mitte seines Bogens. */
  const sums = new Map<number, { s: number; n: number }>();
  for (const f of layout.fields) {
    if (f.area < 0 || f.edge) continue;
    const got = sums.get(f.area) ?? { s: 0, n: 0 };
    got.s += f.angle; got.n += 1;
    sums.set(f.area, got);
  }
  /* Namen am Rand dürfen sich nur nicht decken — auf verschiedener Höhe des Bogens passen auch nahe nebeneinander. */
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  return (
    <g className="cg-ls-ground" aria-hidden>
      <path className="cg-ls-floor" d={`M${lx.toFixed(1)},${ly.toFixed(1)} A${(outer * geo.u).toFixed(1)},${ry.toFixed(1)} 0 0 1 ${rx.toFixed(1)},${ly.toFixed(1)} Z`} />
      <path className="cg-ls-ringline" d={`M${(geo.ox - ringR).toFixed(1)},${geo.oy.toFixed(1)} A${ringR.toFixed(1)},${(ringR * FORE).toFixed(1)} 0 0 1 ${(geo.ox + ringR).toFixed(1)},${geo.oy.toFixed(1)}`} />
      {layout.sectors.map((s, i) => {
        const got = sums.get(i);
        const deg = got === undefined ? (s.from + s.to) / 2 : got.s / got.n;
        const mid = deg * (Math.PI / 180);
        const [x, y] = screenOf(geo, -Math.cos(mid) * (outer + 0.25), Math.sin(mid) * (outer + 0.25));
        const max = geo.width < 480 ? 12 : 22;
        const text = s.label.length > max ? `${s.label.slice(0, max - 1)}…` : s.label;
        const w = textWidth(text);
        const anchor = deg < 25 ? 'start' : deg > 155 ? 'end' : 'middle';
        const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
        const ty = Math.max(12, y - 4);
        const box = { x0: Math.max(2, Math.min(geo.width - w - 2, x0)), x1: 0, y0: ty - 11, y1: ty + 3 };
        box.x1 = box.x0 + w;
        if (placed.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1)) return null;
        placed.push(box);
        return <text key={`l${s.value}`} className={`cg-ls-sector is-s${s.subject >= 0 && s.subject < 8 ? s.subject : 'x'}`} x={box.x0} y={ty} textAnchor="start">{text}</text>;
      })}
    </g>
  );
}

function Me({ geo }: { geo: Geo }) {
  return (
    <g className="cg-ls-me" aria-hidden transform={`translate(${geo.ox.toFixed(1)},${geo.oy.toFixed(1)})`}>
      <ellipse cx={0} cy={0} rx={geo.u * 0.42} ry={geo.u * 0.42 * FORE} />
      <circle cx={0} cy={-geo.u * 0.62} r={geo.u * 0.16} />
      <path d={`M${-geo.u * 0.2},${-geo.u * 0.05} Q0,${-geo.u * 0.55} ${geo.u * 0.2},${-geo.u * 0.05} Z`} />
      <text y={geo.u * 0.55 + 6} textAnchor="middle">Ty</text>
    </g>
  );
}

/** Wie ein Feld sich ansagt: Name, Band, Höhe, Sperre, Ziel. */
function fieldWords(f: LsField): string {
  const what = f.kind === 'area' ? `${f.label}: ${f.count} wpisów${f.ring > 0 ? `, do nauki teraz ${f.ring}` : ''}${f.due > 0 ? `, do powtórki ${f.due}` : ''}${f.edge ? ' (poza widokiem — przybliż)' : ' — przybliż'}`
    : `${f.label}: ${LS_BAND_LABEL[f.band]}${f.band === 'mountain' ? `, brakuje ${f.missing} ${f.missing === 1 ? 'kroku' : 'kroków'}` : ''}${f.locked ? ', najpierw powtórka' : ''}`;
  return `${what}${f.goal ? ' · cel' : ''}${f.next ? ' · następny krok do celu' : ''}${f.route > 0 && f.kind === 'area' ? ` · ${f.route} kroków drogi w środku` : f.route > 0 ? ' · na drodze do celu' : ''}`;
}

/** Ein Name unter seinem Feld — in der obersten Lage. */
function Name({ field: f, geo, text, motion }: { field: LsField; geo: Geo; text: string; motion: boolean }) {
  const ref = useRef<SVGTextElement>(null);
  const [sx, sy] = screenOf(geo, f.x, f.y);
  useLayoutEffect(() => {
    ref.current?.style.setProperty('--ls-x', `${sx.toFixed(1)}px`);
    ref.current?.style.setProperty('--ls-y', `${sy.toFixed(1)}px`);
  }, [sx, sy]);
  return <text ref={ref} className={`cg-ls-label${motion ? '' : ' is-still'}`} x={0} y={geo.u * 0.5 + 6} textAnchor="middle">{text}</text>;
}

function Field({ field: f, geo, on, onChoose, motion }: { field: LsField; geo: Geo; on: boolean; onChoose: (f: LsField) => void; motion: boolean }) {
  const ref = useRef<SVGGElement>(null);
  const [sx, sy] = screenOf(geo, f.x, f.y);
  useLayoutEffect(() => {
    ref.current?.style.setProperty('--ls-x', `${sx.toFixed(1)}px`);
    ref.current?.style.setProperty('--ls-y', `${sy.toFixed(1)}px`);
  }, [sx, sy]);
  /* Ein Bereich: niedriger als ein Berg (seine Höhe sagt die Entfernung), gestrichelt umrandet, mit seiner Zahl. */
  const stack = f.kind === 'area' && f.band === 'mountain' ? { base: 0, top: 0.32 + Math.min(3, Math.max(1, f.height)) * 0.36 } : stackOf(f);
  const shape = prism(geo, stack.base, stack.top);
  const topY = -stack.top * geo.t;
  const tall = f.kind === 'entry' && f.band === 'mountain' && f.height > CAP;
  const fog = f.band === 'mountain' ? Math.min(3, Math.floor(Math.log2(1 + f.height))) : 0;
  const subject = f.subject >= 0 && f.subject < 8 ? f.subject : 'x';
  const mark = f.kind === 'area' ? String(f.count) : f.band === 'mountain' ? `▲${f.height}` : LS_BAND_MARK[f.band];
  const words = fieldWords(f);
  return (
    <g ref={ref} className={`cg-ls-field is-${f.band} is-s${subject} is-fog${fog}${f.kind === 'area' ? ' is-area' : ''}${f.edge ? ' is-edge' : ''}${on ? ' is-on' : ''}${f.route > 0 ? ' is-route' : ''}${f.next ? ' is-next' : ''}${f.goal ? ' is-goal' : ''}${f.locked ? ' is-locked' : ''}${motion ? '' : ' is-still'}${geo.u < 20 ? ' is-small' : ''}`}
      data-ls-field={f.key} data-ls-band={f.band} data-ls-height={Number.isFinite(f.height) ? Number(f.height.toFixed(3)) : ''} tabIndex={0} role="button" aria-pressed={on} aria-label={words}
      onClick={() => onChoose(f)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChoose(f); } }}>
      <title>{words}</title>
      {(f.band === 'known' || f.band === 'due') && <polygon className="cg-ls-pit" points={shape.rim} />}
      {shape.sides.map((s, i) => <polygon key={i} className={`cg-ls-side is-${['l', 'f', 'r'][i]}`} points={s} />)}
      <polygon className="cg-ls-top" points={shape.top} />
      {f.kind === 'area' && <polygon className="cg-ls-area-ring" points={shape.top} />}
      {tall && <path className="cg-ls-break" d={`M${-geo.u * 0.28},${topY + geo.t * 1.6} l${geo.u * 0.18},${-geo.t * 0.5} l${geo.u * 0.2},${geo.t * 0.5} l${geo.u * 0.18},${-geo.t * 0.5}`} />}
      {(geo.u >= 15 || f.kind === 'area') && <text className="cg-ls-mark" x={0} y={topY + 4} textAnchor="middle">{mark}</text>}
      {f.locked && <path className="cg-ls-lock" d={`M${geo.u * 0.18},${topY - geo.u * 0.34} h${geo.u * 0.24} v${geo.u * 0.2} h${-geo.u * 0.24} z M${geo.u * 0.22},${topY - geo.u * 0.34} v${-geo.u * 0.08} a${geo.u * 0.08},${geo.u * 0.08} 0 0 1 ${geo.u * 0.16},0 v${geo.u * 0.08}`} />}
      {f.goal && <path className="cg-ls-goalflag" d={`M${-geo.u * 0.05},${topY - 2} v${-geo.u * 0.7} l${geo.u * 0.36},${geo.u * 0.14} l${-geo.u * 0.36},${geo.u * 0.14}`} />}
      {f.next && !f.goal && <circle className="cg-ls-nextdot" cx={geo.u * 0.34} cy={topY - geo.u * 0.18} r={geo.u * 0.1} />}
    </g>
  );
}

/* -- Tafeln --------------------------------------------------------------------------------------------------------- */

function EntryPanel({ id, band, height, locked, goal, canLearn, gauge, cards, answers, client, label, bandOf, note, onLearn, onReview, onReviewFirst, onGoal, onClose, onOpen }: {
  id: string;
  band: LsBand | null;
  height: number;
  locked: boolean;
  goal: boolean;
  canLearn: boolean;
  gauge: ReturnType<typeof gaugeFromMarks>;
  cards: readonly Card[];
  answers: Parameters<typeof QuiltPanel>[0]['answers'];
  client: LandscapeClient;
  label: (id: string) => string;
  bandOf: (id: string) => LsBand | null;
  note: string | null;
  onLearn: () => void;
  onReview: (band: LsBand) => void;
  onReviewFirst: () => void;
  onGoal: (on: boolean) => void;
  onClose: () => void;
  onOpen?: (id: string) => void;
}) {
  const { lib } = useCtx();
  const [route, setRoute] = useState<{ readonly steps: readonly (readonly string[])[]; readonly next: readonly string[] } | null>(null);
  useEffect(() => {
    let alive = true;
    setRoute(null);
    if (band === 'mountain') void client.route(id).then((r) => { if (alive) setRoute(r); }, () => undefined);
    return () => { alive = false; };
  }, [client, id, band]);
  const lock = useMemo(() => (locked ? lockCards(gauge, lib.prerequisites(), id, cards) : []), [locked, gauge, lib, id, cards]);
  const lockCount = lock.reduce((s, g) => s + g.cards.length, 0);
  const tile = tileOf(gauge, id);
  return (
    <div className="cg-ls-detail" data-landscape-panel={id} data-landscape-panel-band={band ?? ''}>
      <section className="cg-ls-actions" aria-label="Co możesz z tym zrobić">
        <p className="cg-ls-state">
          <span className="cg-ls-badge" aria-hidden>{band === null ? '·' : band === 'mountain' ? '▲' : LS_BAND_MARK[band]}</span>
          {band === null ? 'Ten wpis nie ma pytań — nie stoi w krajobrazie.'
            : band === 'mountain' ? `Za górami: brakuje ${Math.round(height)} ${Math.round(height) === 1 ? 'kroku' : 'kroków'}.`
              : band === 'ring' ? (locked ? 'Możesz się tego uczyć — najpierw powtórka.' : 'Możesz się tego uczyć teraz.')
                : band === 'due' ? `Umiesz — do powtórki (${percent(shareOf(gauge.totals.get(id) ?? 0))}).` : 'Umiesz.'}
        </p>
        {band === 'ring' && locked && (
          <div className="cg-ls-lockbox" data-landscape-lock={lockCount}>
            <p>Możesz się tego uczyć, ale najpierw powtórz te {lockCount} {lockCount === 1 ? 'kartę' : lockCount < 5 ? 'karty' : 'kart'} — z tego, na czym to stoi:</p>
            <ul className="cg-plain-list">
              {lock.map((g) => <li key={g.entry}><TexText text={entityNameTex(lib, g.entry)} /> <span className="cg-muted">— {g.cards.length} {g.cards.length === 1 ? 'karta' : g.cards.length < 5 ? 'karty' : 'kart'}</span></li>)}
            </ul>
            {canLearn && <button type="button" className="wk-btn" onClick={onReviewFirst} data-landscape-review-first="">Powtórz ({lockCount}), potem ucz się tego</button>}
          </div>
        )}
        <div className="wk-actions">
          {band === 'ring' && !locked && canLearn && <button type="button" className="wk-btn" onClick={onLearn} data-landscape-learn="">Ucz się tego</button>}
          {(band === 'known' || band === 'due') && canLearn && <button type="button" className={band === 'due' ? 'wk-btn' : 'wk-btn wk-btn-line'} onClick={() => onReview(band)} data-landscape-review="">Powtórz</button>}
          {(band === 'ring' || band === 'mountain') && <button type="button" className="wk-btn wk-btn-line" onClick={() => onGoal(!goal)} data-landscape-set-goal="">{goal ? 'Usuń cel' : 'Ustaw jako cel'}</button>}
          {onOpen !== undefined && <button type="button" className="wk-link-btn" onClick={() => onOpen(id)}>Otwórz wpis</button>}
          <button type="button" className="wk-link-btn" onClick={onClose} data-landscape-close="">Zamknij</button>
        </div>
        {!canLearn && <p className="cg-muted">Uczyć się możesz, gdy ten widok wie, kto się uczy (zalogowanie, osoba strony albo ta przeglądarka).</p>}
        {note !== null && <p className="wk-note" role="status">{note}</p>}
        {band === 'mountain' && route !== null && (
          <div className="cg-ls-route" data-landscape-route={route.steps.length}>
            <h4>Droga — od podstaw</h4>
            <ol>
              {route.steps.map((step, i) => (
                <li key={i} className={step.some((x) => route.next.includes(x)) ? 'is-next' : undefined}>
                  {step.map((x, j) => <span key={x}>{j > 0 ? ' + ' : ''}<span aria-hidden>{bandOf(x) === 'ring' ? LS_BAND_MARK.ring : '▲'} </span><TexText text={entityNameTex(lib, x)} /></span>)}
                  {step.some((x) => route.next.includes(x)) && <span className="cg-muted"> — następny krok</span>}
                </li>
              ))}
              <li className="cg-ls-route-goal"><strong><TexText text={entityNameTex(lib, id)} /></strong></li>
            </ol>
            <p className="cg-muted">{label(id)}: {route.steps.length} {route.steps.length === 1 ? 'krok' : 'kroków'} przed nim.</p>
          </div>
        )}
      </section>
      <QuiltPanel tile={tile} cards={cards} answers={answers} onClose={onClose} note={null} {...(onOpen === undefined ? {} : { onOpen })} />
    </div>
  );
}

/** Ein Bereich ohne Wert zum Hineinzoomen (aus der Nähe im Graphen, „bez wartości"): seine Einträge. */
function AreaPanel({ field, label, bandOf, onPick, onClose }: { field: LsField; label: (id: string) => string; bandOf: (id: string) => LsBand | null; onPick: (id: string) => void; onClose: () => void }) {
  const ids = field.ids ?? [];
  return (
    <section className="cg-ls-detail cg-ls-areapanel" data-landscape-areapanel={field.key}>
      <div className="cg-row-between"><h4>{field.label} <span className="cg-muted">({ids.length})</span></h4><button type="button" className="wk-link-btn" onClick={onClose}>Zamknij</button></div>
      <ul className="cg-ls-hits">
        {ids.slice(0, 40).map((id) => { const b = bandOf(id); return <li key={id}><button type="button" className="cg-ref" onClick={() => onPick(id)}><span aria-hidden>{b === null ? '·' : LS_BAND_MARK[b]} </span>{label(id)}</button> <span className="cg-muted">{b === null ? '' : LS_BAND_LABEL[b]}</span></li>; })}
      </ul>
      {ids.length > 40 && <p className="cg-muted">i {ids.length - 40} więcej — wyszukaj, żeby znaleźć konkretny.</p>}
    </section>
  );
}

/** Treffer der Suche: zeigen — oder als Ziel. */
function SearchHits({ query, ids, bandOf, heightOf, label, goal, onShow, onGoal }: {
  query: string; ids: readonly string[]; bandOf: (id: string) => LsBand | null; heightOf: (id: string) => number; label: (id: string) => string; goal: string | null;
  onShow: (id: string) => void; onGoal: (id: string) => void;
}) {
  const { lib } = useCtx();
  const hits = useMemo(() => {
    const known = new Set(ids);
    const words = query.trim().toLowerCase();
    const found = lib.search(query).filter((e) => known.has(e.id)).map((e) => e.id);
    const more = words === '' ? [] : ids.filter((id) => !found.includes(id) && label(id).toLowerCase().includes(words));
    return [...found, ...more].filter((id) => bandOf(id) !== null).slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, ids, lib, lib.revision]);
  if (hits.length === 0) return <p className="cg-muted" data-landscape-hits="0">Nic takiego w tym krajobrazie.</p>;
  return (
    <ul className="cg-ls-hits" data-landscape-hits={hits.length} aria-label="Wyniki wyszukiwania">
      {hits.map((id) => {
        const b = bandOf(id);
        const h = heightOf(id);
        return (
          <li key={id}>
            <span aria-hidden>{b === null ? '·' : b === 'mountain' ? '▲' : LS_BAND_MARK[b]} </span>
            <button type="button" className="cg-ref" onClick={() => onShow(id)} data-landscape-hit={id}><TexText text={entityNameTex(lib, id)} /></button>
            <span className="cg-muted"> {b === null ? '' : b === 'mountain' ? `brakuje ${Math.round(h)}` : LS_BAND_LABEL[b]}</span>
            {(b === 'ring' || b === 'mountain') && goal !== id && <button type="button" className="wk-link-btn" onClick={() => onGoal(id)} data-landscape-hit-goal={id}>Ustaw jako cel</button>}
            {goal === id && <span className="cg-muted"> · cel</span>}
          </li>
        );
      })}
    </ul>
  );
}

/** Dieselben Felder als Liste — für Vorleser, und für wer lieber liest als schaut. */
function FieldList({ layout, onChoose }: { layout: LsLayout; onChoose: (f: LsField) => void }) {
  const groups: { band: LsBand; title: string }[] = [
    { band: 'ring', title: 'Do nauki teraz (pierścień)' }, { band: 'due', title: 'Do powtórki (dolina)' },
    { band: 'mountain', title: 'Za górami (tyle kroków brakuje)' }, { band: 'known', title: 'Umiem' }
  ];
  return (
    <details className="cg-ls-list" data-landscape-list="">
      <summary>Krajobraz jako lista ({layout.fields.length} pól)</summary>
      {groups.map((g) => {
        const of = layout.fields.filter((f) => f.band === g.band).sort((a, b) => (g.band === 'mountain' ? a.height - b.height : 0) || a.angle - b.angle);
        if (of.length === 0) return null;
        return (
          <section key={g.band}>
            <h5>{g.title} <span className="cg-muted">({of.length})</span></h5>
            <ul>
              {of.map((f) => <li key={f.key}><button type="button" className="cg-ref" onClick={() => onChoose(f)}>{fieldWords(f)}</button></li>)}
            </ul>
          </section>
        );
      })}
    </details>
  );
}
