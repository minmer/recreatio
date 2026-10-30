/**
 * DIE ANSICHTEN DER COGITA-BAUSTEINE (0109) — was `parts/cogita.tsx`
 * beschreibt, zeigt sich hier: Powtórka, Przebieg, Sitzung, Eintrag, Tabelle,
 * Themen, Karte des Wissens, und das Lernen eines Platzes. Ein eigenes Bündel:
 * geladen erst, wenn eine Seite einen dieser Bausteine trägt.
 *
 * 2026-10-22 (Schritt 8) — keine veröffentlichten Abschriften mehr: jeder
 * Baustein liest die Baza wiedzy selbst (`cogita/pageBase.ts`), so wie ihr
 * Bereich sie diesem Leser zeigt, und rechnet Karten, Powtórki, Przebiegi und
 * Themen im Browser.
 */

import { useEffect, useMemo, useState } from 'react';

import type { PartContext } from '../part';
import type { SeatView } from '../../seats/seatContext';
import type { Card } from '../../cogita/cardBasics';
import { LOOK_LABEL } from '../../cogita/flow';
import { contentOfLibrary, EntityView, FlowPlayer } from '../../cogita/FlowPlayer';
import { fogOf, ringsOf } from '../../cogita/game';
import { average, dueAt, knownessOf, LEVEL_LABEL, shareOf } from '../../cogita/knowness';
import { joinByCode, loadSession, openTitle, participantId, ticketFromAddress, ticketOf, type Credentials, type SessionRow, type Ticket } from '../../cogita/live';
import { publicEntity } from '../../cogita/publish';
import { useEntitySubject } from '../../cogita/entitySubject';
import { usePageBase } from '../../cogita/pageBase';
import { useLocalLearner } from '../../cogita/PublicRun';
import { IntroduceToLearn, LearnerLine, usePageLearner } from '../../cogita/pageLearner';
import { levelsOf, readPlan } from '../../cogita/revision';
import { planFor, RevisionRun } from '../../cogita/RevisionRun';
import { seatCtx, useSeatLearner, useSeatLibrary } from '../../cogita/seatLearn';
import { SessionPlay } from '../../cogita/Sessions';
import type { CogitaLibrary } from '../../cogita/store';
import { Bar, CogitaContext, useAsync, useBusy, type CogitaCtx } from '../../cogita/ui';
import { OnSeat } from './seat';
import type { EntityConfig, FlowConfig, LiveConfig, MapConfig, RevisionConfig, SeatLearnConfig, TableConfig, TopicsConfig } from './cogita';
import { Loading } from '../../ui/Loading';
import { FogMap } from '../../cogita/FogMap';

/** Hoch oder im ganzen Fenster: das Ganze. */
const isTall = (ctx: PartContext): boolean => ctx.whole === true || ctx.size.height === 'tall';

const Head = ({ title }: { title: string }) => <h2 className="wk-card-title">{title}</h2>;

/** Was die Seite sagt, solange die Baza wiedzy geöffnet wird — oder wenn dieser Leser sie nicht lesen darf. */
function Closed({ title, lib }: { title: string; lib: CogitaLibrary | null | undefined }) {
  return (
    <>
      <Head title={title} />
      {lib === undefined ? <Loading /> : <p className="wk-card-muted">Tej bazy wiedzy nie możesz tu czytać — nie jest publiczna albo nie masz do niej dostępu.</p>}
    </>
  );
}

/**
 * 2026-10-22 (Schritt 8) — eine Powtórka der Baza wiedzy selbst (keine
 * Abschrift mehr): ihre Karten rechnet der Browser aus den Einträgen, so wie
 * im Arbeitsbereich. Wer sie liest, sagt der Bereich der Baza.
 */
export function RevisionView({ config, ctx }: { config: RevisionConfig; ctx: PartContext }) {
  const { lib, ctx: cg } = usePageBase(config.library);
  /* 2026-10-27 — als wer: die Person der Seite, ein Platz aus dem Link, sonst der Browser (`pageLearner.tsx`). */
  const who = usePageLearner(lib);
  const learner = who.learner;
  const [running, setRunning] = useState(false);
  const doc = lib == null ? undefined : lib.docs('revision').find((e) => e.id === config.revision);
  const name = typeof doc?.data.name === 'string' ? doc.data.name : '';
  const title = config.title || name || 'Powtórka';
  const planned = useAsync(lib == null || doc === undefined ? null : () => planFor(lib, doc.id, null, 'page'), [lib, lib?.revision, doc?.id]);
  if (lib == null || cg === null) return <Closed title={title} lib={lib} />;
  if (doc === undefined) return <><Head title={title} /><p className="wk-card-muted">Tej powtórki nie ma w bazie wiedzy.</p></>;

  if (running || isTall(ctx)) {
    /* Hoch läuft die Powtórka gleich — wer nur den Link hat, stellt sich darüber vor; danach lernt er neu als er selbst. */
    return (
      <CogitaContext.Provider value={cg}>
        {isTall(ctx) && who.as === 'local' && who.link !== null && <IntroduceToLearn link={who.link} onDone={who.introduced} />}
        <RevisionRun key={who.as ?? ''} lib={lib} learner={learner} source={{ revisionId: doc.id, title }} onClose={isTall(ctx) ? undefined : () => setRunning(false)} />
      </CogitaContext.Provider>
    );
  }
  const plan = planned?.plan ?? null;
  const total = plan?.cards.length ?? 0;
  const levels = learner === null || plan === null ? null : levelsOf(plan, (key) => learner.marks(key), Date.now());
  return (
    <>
      <Head title={title} />
      <p className="wk-card-muted">{planned === undefined ? 'Liczenie kart…' : `${total} kart`}{levels !== null && levels.known + levels.learning > 0 ? ` · ${LEVEL_LABEL.known}: ${levels.known} · ${LEVEL_LABEL.learning}: ${levels.learning}` : ''}</p>
      {levels !== null && levels.known > 0 && <Bar value={levels.known / Math.max(1, total)} label="Ile już umiesz" />}
      {who.as === 'local' && who.link !== null && <IntroduceToLearn link={who.link} onDone={who.introduced} />}
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={!who.ready} onClick={() => setRunning(true)}>{levels !== null && levels.known + levels.learning > 0 ? 'Powtórz' : 'Zacznij'}</button>
      </div>
      <LearnerLine learner={who} lib={lib} />
    </>
  );
}

/** Ein Przebieg der Baza wiedzy selbst — Schritte, Fragen und Dateien aus ihren Einträgen. */
export function FlowView({ config, ctx }: { config: FlowConfig; ctx: PartContext }) {
  const { lib, ctx: cg } = usePageBase(config.library);
  const who = usePageLearner(lib);
  const learner = who.learner;
  const [playing, setPlaying] = useState(false);
  const cards = useAsync(lib == null ? null : () => lib.cards('flow').then((r) => r.cards), [lib, lib?.revision]);
  const content = useMemo(() => (lib == null || cards == null ? null : contentOfLibrary(lib, cards)), [lib, cards]);
  const flow = useMemo(() => (content === null ? undefined : content.flow(config.flow)), [content, config.flow]);
  const title = config.title || flow?.name || 'Przebieg';
  if (lib == null || cg === null) return <Closed title={title} lib={lib} />;
  if (content === null) return <><Head title={title} /><Loading /></>;
  if (flow === undefined) return <><Head title={title} /><p className="wk-card-muted">Tego przebiegu nie ma w bazie wiedzy.</p></>;

  if (playing || isTall(ctx)) {
    return (
      <CogitaContext.Provider value={cg}>
        {!isTall(ctx) && <Head title={title} />}
        {isTall(ctx) && who.as === 'local' && who.link !== null && <IntroduceToLearn link={who.link} onDone={who.introduced} />}
        <FlowPlayer key={who.as ?? ''} flow={flow} content={content} learner={learner} onClose={isTall(ctx) ? undefined : () => setPlaying(false)} presentationAs="link" />
      </CogitaContext.Provider>
    );
  }
  const saved = learner?.progress.positions.get(flow.id) ?? null;
  const questions = flow.graph.nodes.filter((n) => n.type === 'question').length;
  return (
    <>
      <Head title={title} />
      <p className="wk-card-muted">{LOOK_LABEL[flow.look]} · {flow.graph.nodes.length} kroków{questions > 0 ? ` · ${questions} pytań` : ''}</p>
      {flow.goals.length > 0 && ctx.size.width !== 'narrow' && <p className="wk-card-muted">Cele: {flow.goals.map((g) => g.title).join(' · ')}</p>}
      {who.as === 'local' && who.link !== null && <IntroduceToLearn link={who.link} onDone={who.introduced} />}
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={!who.ready} onClick={() => setPlaying(true)}>{saved !== null ? 'Wróć tam, gdzie skończyłeś' : 'Zacznij'}</button>
      </div>
      <LearnerLine learner={who} lib={lib} />
    </>
  );
}

/**
 * Der Zugang aus der Adresse (`?sesja=…&j=…&k=…&e=…`) — dann ohne Geheimnis
 * und Schlüssel in der Adresszeile (wie beim Platz): die Sitzung bleibt
 * stehen, der Rest liegt im Tab.
 */
function ticketHere(): Ticket | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  const at = hash.indexOf('?');
  if (at < 0) return null;
  const fresh = ticketFromAddress(hash);
  if (fresh !== null) {
    window.history.replaceState(null, '', `${hash.slice(0, at)}?sesja=${encodeURIComponent(fresh.sessionId)}`);
    return fresh;
  }
  const id = new URLSearchParams(hash.slice(at + 1)).get('sesja');
  return id === null ? null : ticketOf(id);
}

interface Joined {
  readonly session: SessionRow;
  readonly cred: Credentials;
  readonly keys: ReadonlyMap<number, Uint8Array>;
  readonly title: string;
}

export function LiveView({ config, ctx }: { config: LiveConfig; ctx: PartContext }) {
  const [ticket] = useState<Ticket | null>(ticketHere);
  const [joined, setJoined] = useState<Joined | null>(null);
  const [code, setCode] = useState('');
  const { busy, failed, run } = useBusy();
  const learner = useLocalLearner(joined?.session.libraryId ?? '');
  const title = config.title || 'Dołącz do sesji';

  useEffect(() => {
    if (ticket === null) return;
    void run(async () => {
      const cred: Credentials = { join: ticket.join };
      const { session } = await loadSession(ticket.sessionId, cred);
      const keys = new Map<number, Uint8Array>();
      if (ticket.key !== null && ticket.epoch !== null) keys.set(ticket.epoch, ticket.key);
      const named = ticket.key === null ? null : await openTitle(ticket.key, session).catch(() => null);
      setJoined({ session, cred, keys, title: named ?? 'Sesja' });
    });
    // Einmal, mit dem Zugang aus der Adresse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket]);

  const byCode = () => run(async () => {
    const { session, join } = await joinByCode(code);
    setJoined({ session, cred: { join }, keys: new Map(), title: `Sesja ${session.joinCode ?? code.trim().toUpperCase()}` });
  });

  if (joined !== null) {
    if (ctx.size.height === 'strip' && ctx.whole !== true && ctx.openWhole !== undefined) {
      return (
        <>
          <Head title={joined.title} />
          <button type="button" className="wk-btn wk-card-open" onClick={ctx.openWhole}>Otwórz sesję</button>
        </>
      );
    }
    if (joined.session.state === 'finished' || joined.session.state === 'closed') return <><Head title={joined.title} /><p className="wk-card-muted">Ta sesja już się skończyła.</p></>;
    return (
      <SessionPlay session={joined.session} title={joined.title} cred={joined.cred} keys={joined.keys}
        participant={participantId(joined.session.sessionId)} name={null} learner={learner} />
    );
  }

  const strip = ctx.size.height === 'strip' && ctx.whole !== true;
  return (
    <>
      {!strip && <Head title={title} />}
      {ticket !== null && failed === null ? <p className="wk-card-muted">Otwieranie sesji…</p> : (
        <form className={strip ? 'cg-row' : 'wk-form'} onSubmit={(e) => { e.preventDefault(); void byCode(); }}>
          <label className={strip ? 'cg-row' : 'wk-field'}>
            <span>{strip ? title : 'Kod sesji (z ekranu prowadzącego)'}</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} autoComplete="off" inputMode="text"
              className="cg-code-input" aria-label="Kod sesji" placeholder="np. K7M2QX" />
          </label>
          <button type="submit" className="wk-btn" disabled={busy || code.trim().length < 4}>Dołącz</button>
        </form>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {isTall(ctx) && <p className="wk-card-muted">Bez konta: przedstawisz się imieniem, odpowiedzi idą do prowadzącego. Link albo kod QR z ekranu otwiera sesję od razu.</p>}
    </>
  );
}

/** Ein Eintrag als Karte — aus der Baza wiedzy selbst (Schritt 8), mit seinen Feldern und Bildern. */
export function EntityCardView({ config, ctx }: { config: EntityConfig; ctx: PartContext }) {
  /* 0109 — ohne eigenen Eintrag: der, den die Seite oben gewählt hat („Wpis z bazy wiedzy"). */
  const subject = useEntitySubject();
  const library = config.library !== '' ? config.library : subject?.library ?? '';
  const entry = config.entry !== '' ? config.entry : subject !== null && subject.library === library ? subject.chosen ?? '' : '';
  const { lib, ctx: cg } = usePageBase(library);
  if (entry === '' && subject !== null) return <><Head title={config.title || 'Wpis'} /><p className="wk-card-muted">Wybierz wpis u góry strony.</p></>;
  if (entry === '' || library === '') return <><Head title={config.title || 'Wpis'} /><p className="wk-card-muted">Wybierz wpis w ustawieniach modułu — albo ustaw na stronie „Wybór: wpis z bazy wiedzy”.</p></>;
  if (lib == null || cg === null) return <Closed title={config.title || 'Wpis'} lib={lib} />;
  const entity = lib.entity(entry);
  if (entity === undefined) return <><Head title={config.title || 'Wpis'} /><p className="wk-card-muted">Tego wpisu nie ma w bazie wiedzy.</p></>;
  const shown = publicEntity(lib, entity);
  const kinds = shown.kinds.join(' · ');
  if (ctx.size.height === 'strip' && ctx.whole !== true) {
    return <p className="cg-row"><strong>{shown.label}</strong><span className="wk-card-muted">{kinds}</span></p>;
  }
  return (
    <CogitaContext.Provider value={cg}>
      {config.title !== '' && <Head title={config.title} />}
      <EntityView entity={isTall(ctx) ? shown : { ...shown, media: shown.media.filter((m) => m.type === 'image').slice(0, 1), fields: shown.fields.slice(0, 4) }} />
      <p className="wk-card-muted">{kinds}</p>
    </CogitaContext.Provider>
  );
}

interface Row {
  readonly id: string;
  readonly label: string;
  readonly kinds: readonly string[];
  readonly cells: ReadonlyMap<string, string>;
}

/** Die Einträge der Baza wiedzy als Tabelle — alle, die ihr Bereich zeigt (Schritt 8: keine Auswahl „veröffentlichter" mehr). */
export function EntityTableView({ config, ctx }: { config: TableConfig; ctx: PartContext }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  /* Wählt die Seite oben einen Eintrag dieser Bibliothek, wählt ein Klick dort — sonst klappt er hier auf. */
  const subject = useEntitySubject();
  const { lib, ctx: cg } = usePageBase(config.library);
  const pick = (id: string) => {
    if (subject !== null && subject.library === config.library) { subject.choose(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else setOpen(open === id ? null : id);
  };
  const rows = useMemo((): Row[] | null => {
    if (lib == null) return null;
    const want = config.kind.toLowerCase();
    return lib.entities()
      .filter((e) => want === '' || e.kinds.some((k) => k.toLowerCase() === want || (lib.kind(k)?.name ?? '').toLowerCase() === want))
      .map((e) => { const p = publicEntity(lib, e); return { id: e.id, label: p.label, kinds: p.kinds, cells: new Map(p.fields.map((f) => [f.label, f.text])) }; })
      .sort((a, b) => a.label.localeCompare(b.label, 'pl'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, lib?.revision, config.kind]);
  const title = config.title || 'Wpisy';
  if (lib == null || cg === null || rows === null) return <Closed title={title} lib={lib} />;
  if (ctx.size.height === 'strip' && ctx.whole !== true) {
    return (
      <p className="cg-row">
        <strong>{title}</strong><span className="wk-card-muted">{rows.length} wpisów</span>
        {ctx.openWhole !== undefined && <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>Zobacz</button>}
      </p>
    );
  }
  if (!isTall(ctx)) {
    return (
      <>
        <Head title={title} />
        <ul className="cg-plain-list">{rows.slice(0, 8).map((r) => <li key={r.id}>{r.label}</li>)}</ul>
        {rows.length > 8 && <p className="wk-card-muted">i {rows.length - 8} więcej{ctx.openWhole !== undefined ? ' — ' : ''}{ctx.openWhole !== undefined && <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>cała tabela</button>}</p>}
      </>
    );
  }
  const columns = config.columns.length > 0 ? config.columns : [...new Set(rows.flatMap((r) => [...r.cells.keys()]))].slice(0, 4);
  const folded = (s: string) => s.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const words = folded(query).split(/\s+/).filter(Boolean);
  const shown = words.length === 0 ? rows : rows.filter((r) => words.every((w) => folded(`${r.label} ${[...r.cells.values()].join(' ')}`).includes(w)));
  return (
    <CogitaContext.Provider value={cg}>
      <Head title={title} />
      <input type="search" className="cg-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj w tabeli…" aria-label="Szukaj w tabeli" />
      <div className="cg-table-wrap">
        <table className="cg-table">
          <thead><tr><th>Nazwa</th>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={open === r.id ? 'is-on' : undefined}>
                <td><button type="button" className="cg-ref" onClick={() => pick(r.id)}>{r.label}</button></td>
                {columns.map((c) => <td key={c}>{r.cells.get(c) ?? ''}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <p className="wk-card-muted">Nic nie pasuje.</p>}
      {open !== null && <OneEntity lib={lib} entry={open} />}
    </CogitaContext.Provider>
  );
}

/** Ein Eintrag, aufgeklappt unter der Tabelle oder dem Thema. */
function OneEntity({ lib, entry }: { lib: CogitaLibrary; entry: string }) {
  const entity = lib.entity(entry);
  if (entity === undefined) return null;
  return <div className="cg-card"><EntityView entity={publicEntity(lib, entity)} /></div>;
}

/**
 * 2026-10-23 (Schritt 5) — TEMATY GIBT ES NICHT MEHR: eine Seite mit dem alten
 * Baustein zeigt einen Hinweis statt eines Fehlers oder einer leeren Fläche.
 */
export function TopicExplorerView({ config }: { config: TopicsConfig; ctx: PartContext }) {
  return (
    <div className="wk-card-text">
      <Head title={config.title || 'Tematy'} />
      <p className="wk-card-muted">Tematów już nie ma — porządek dają teraz własne rodzaje (np. „Tajemnica”, „Obszar”). Ten moduł zastępuje moduł „Widok”: drzewo albo macierz według osi.</p>
    </div>
  );
}

/** Die Karte des Wissens einer Powtórka — aus den Einträgen der Baza selbst, im eigenen Nebel. */
export function KnowledgeMapView({ config, ctx }: { config: MapConfig; ctx: PartContext }) {
  const { lib, ctx: cg } = usePageBase(config.library);
  const learner = usePageLearner(lib).learner;
  const [chosen, setChosen] = useState<string | null>(null);
  const [learning, setLearning] = useState<string | null>(null);
  const planned = useAsync(lib == null || config.revision === '' ? null : () => planFor(lib, config.revision, null, 'page'), [lib, lib?.revision, config.revision]);
  const cards = useMemo(() => planned?.plan?.cards ?? [], [planned]);
  const deps = useMemo(() => (lib == null ? [] : lib.dependencies()), [lib, lib?.revision]); // eslint-disable-line react-hooks/exhaustive-deps

  const graph = useMemo(() => {
    if (lib == null) return null;
    const ids = [...new Set(cards.map((c) => c.entity).filter((id): id is string => id !== undefined && lib.entity(id) !== undefined))].slice(0, 200);
    const inside = new Set(ids);
    const edges = deps.filter((d) => inside.has(d.parent) && inside.has(d.child)).map((d) => ({ from: d.parent, to: d.child }));
    return { ids, edges, place: ringsOf(ids, edges) };
  }, [lib, cards, deps]);

  const source = useMemo(() => {
    if (learning === null || lib == null) return null;
    const of = cards.filter((c) => c.entity === learning);
    const e = lib.entity(learning);
    return { plan: readPlan(of, { mode: 'once', order: 'random' }), cards: of, deps, title: e === undefined ? 'Powtórka' : lib.label(e) };
  }, [learning, lib, cards, deps]);

  const title = config.title || 'Mapa wiedzy';
  if (lib == null || cg === null || graph === null) return <Closed title={title} lib={lib} />;
  if (planned === undefined) return <><Head title={title} /><Loading /></>;

  const now = Date.now();
  const cardsOf = (id: string) => cards.filter((c) => c.entity === id);
  const knowness = (id: string) => {
    const of = cardsOf(id);
    return of.length === 0 || learner === null ? 0 : average(of.map((c) => knownessOf(learner.marks(c.key, c.fingerprint), now)));
  };
  const seen = (id: string) => learner !== null && cardsOf(id).some((c) => learner.marks(c.key, c.fingerprint).length > 0);
  const fog = fogOf(graph.ids.map((id) => ({ id })), graph.edges, knowness, seen);
  const known = graph.ids.filter((id) => fog.get(id) === 'known').length;

  if (ctx.size.height === 'strip' && ctx.whole !== true) {
    return (
      <div className="cg-row">
        <strong>{title}</strong>
        <Bar value={known / Math.max(1, graph.ids.length)} label="Ile już umiesz" />
        <span className="wk-card-muted">{known} z {graph.ids.length}</span>
        {ctx.openWhole !== undefined && <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>Mapa</button>}
      </div>
    );
  }

  if (source !== null) {
    return (
      <CogitaContext.Provider value={cg}>
        <RevisionRun lib={lib} learner={learner} source={source} onClose={() => setLearning(null)} />
      </CogitaContext.Provider>
    );
  }

  const tall = isTall(ctx);
  const entity = chosen === null ? undefined : lib.entity(chosen);
  return (
    <CogitaContext.Provider value={cg}>
      <Head title={title} />
      <p className="wk-card-muted">{known} z {graph.ids.length} umiesz · przerywana obwódka — możesz tam wejść; mgła — jeszcze nieodkryte.</p>
      <FogMap tall={tall} edges={graph.edges} place={graph.place} onOpen={setChosen}
        nodes={graph.ids.map((id) => {
          const state = fog.get(id) ?? 'fog';
          const e = lib.entity(id);
          const label = e === undefined ? '?' : lib.label(e);
          return { id, label, state, title: state === 'fog' ? 'Jeszcze w mgle' : `${label} · ${Math.round(shareOf(knowness(id)) * 100)}%` };
        })} />
      {entity !== undefined && chosen !== null && (
        <div className="cg-card">
          <EntityView entity={tall ? publicEntity(lib, entity) : { ...publicEntity(lib, entity), media: [], fields: publicEntity(lib, entity).fields.slice(0, 2) }} />
          {cardsOf(chosen).length > 0 && <button type="button" className="wk-btn" onClick={() => setLearning(chosen)}>Ucz się tego ({cardsOf(chosen).length} kart)</button>}
        </div>
      )}
    </CogitaContext.Provider>
  );
}

function SeatLearn({ seat, config, tall }: { seat: SeatView; config: SeatLearnConfig; tall: boolean }) {
  const opened = useSeatLibrary(seat, config.library);
  const { lib, name } = opened;
  const { learner, failed } = useSeatLearner(seat, lib);
  const [running, setRunning] = useState<string | null>(null);
  const cards = useAsync(lib == null ? null : () => lib.cards('learn').then((r) => r.cards), [lib, lib?.revision]);
  const ctx = useMemo<CogitaCtx | null>(() => (lib == null ? null : seatCtx(lib, opened, seat.token)), [lib, opened, seat.token]);

  if (lib === undefined) return <p className="wk-card-muted">Otwieranie bazy wiedzy…</p>;
  if (lib === null || ctx === null) return <p className="wk-card-muted">Ta baza wiedzy nie jest dostępna z tego linku.</p>;
  const revisions = lib.docs('revision').filter((r) => config.revision === '' || r.id === config.revision);
  const nameOf = (id: string) => {
    const doc = revisions.find((r) => r.id === id);
    return typeof doc?.data.name === 'string' ? doc.data.name : 'Powtórka';
  };

  if (running !== null) {
    return (
      <CogitaContext.Provider value={ctx}>
        <RevisionRun lib={lib} learner={learner} source={{ revisionId: running, title: nameOf(running) }} onClose={() => setRunning(null)} />
      </CogitaContext.Provider>
    );
  }

  const now = Date.now();
  const due = cards == null || learner === null ? null : cards.filter((c: Card) => {
    if (learner.progress.suspended.has(c.key)) return false;
    const marks = learner.marks(c.key, c.fingerprint);
    const at = marks.length === 0 ? null : dueAt(marks);
    return at !== null && at <= now;
  }).length;
  const levels = cards == null || learner === null ? null : levelsOf(readPlan(cards, {}), (key) => learner.marks(key), now);
  return (
    <CogitaContext.Provider value={ctx}>
      <p className="wk-card-muted">{name}{due !== null ? ` · na teraz: ${due} kart` : ''}</p>
      {tall && levels !== null && cards != null && cards.length > 0 && (
        <>
          <Bar value={levels.known / Math.max(1, cards.length)} label="Ile już umiesz" />
          <p className="wk-card-muted">{(['known', 'learning', 'unseen'] as const).map((l) => `${LEVEL_LABEL[l]}: ${levels[l]}`).join(' · ')}</p>
        </>
      )}
      {revisions.length === 0 ? <p className="wk-card-muted">W tej bazie wiedzy nie ma jeszcze powtórki.</p> : (
        <div className="wk-actions">
          {revisions.map((r) => <button key={r.id} type="button" className="wk-btn" disabled={learner === null} onClick={() => setRunning(r.id)}>{nameOf(r.id)}</button>)}
        </div>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {learner !== null && learner.waiting > 0 && <p className="wk-card-muted">{learner.waiting} pakietów odpowiedzi czeka na internet.</p>}
    </CogitaContext.Provider>
  );
}

/** Hinter einem persönlichen Link: der Platz (oder die Wahl oben auf der Seite), dann sein Lernen. */
export function SeatLearnView({ config, ctx }: { config: SeatLearnConfig; ctx: PartContext }) {
  return (
    <OnSeat title={config.title} fallback="Twoja nauka" empty="Tu pojawi się nauka — dla osoby, która otworzy swój link.">
      {(seat) => <SeatLearn seat={seat} config={config} tall={isTall(ctx)} />}
    </OnSeat>
  );
}
