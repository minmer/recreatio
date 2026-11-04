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
import { answersArea } from '../../cogita/answersTo';
import { loadAreas } from '../../areas/area';
import { useWho } from '../../core/me';
import { viewPath } from '../../routes';
import { usePageBase } from '../../cogita/pageBase';
import { useLocalLearner } from '../../cogita/PublicRun';
import { IntroduceToLearn, LearnerLine, usePageLearner } from '../../cogita/pageLearner';
import { levelsOf, readPlan } from '../../cogita/revision';
import { planFor, RevisionRun } from '../../cogita/RevisionRun';
import { seatCtx, useSeatLearner, useSeatLibrary } from '../../cogita/seatLearn';
import { SessionPlay } from '../../cogita/Sessions';
import { DailyGoal } from '../../cogita/DailyGoal';
import type { CogitaLibrary } from '../../cogita/store';
import { Bar, CogitaContext, useAsync, useBusy, type CogitaCtx } from '../../cogita/ui';
import { OnSeat } from './seat';
import type { EntityConfig, FlowConfig, LiveConfig, LiveStatsConfig, MapConfig, RevisionConfig, RewardsConfig, SeatLearnConfig, TableConfig, TopicsConfig } from './cogita';
import { Loading } from '../../ui/Loading';
import { later } from '../../ui/later';
import { FogMap } from '../../cogita/FogMap';
import { positionFor, renamer } from '../../cogita/learn';
import { DEFAULT_REWARDS, rewardsFor, type RewardRules } from '../../cogita/rewards';
import { RewardBoard } from '../../cogita/RewardViews';
import { usePageRewards, usePlaceRewards } from '../../cogita/pageRewards';

/* 2026-11-02 — die Diagramme der Statystyki na żywo: erst, wenn der Baustein steht. */
const LiveStats = later(() => import('../../cogita/LiveStats').then((m) => m.LiveStats));

/**
 * 2026-11-02 — DIE NAGRODY EINES ORTES: die genannte Regel, sonst die der Ustawienia der Baza, sonst die erste, sonst
 * die eingebaute (`rewardsFor`). Dieselbe Regel (dasselbe Objekt), solange sich die Baza nicht ändert.
 */
function usePlaceRules(lib: CogitaLibrary | null | undefined, chosen: string): RewardRules {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `lib.revision`: neu, wenn sich die Baza ändert
  return useMemo(() => (lib == null ? DEFAULT_REWARDS : rewardsFor(lib.docs('reward'), chosen, lib.settings().rewards).rules), [lib, lib?.revision, chosen]);
}

/** Im Lernbaustein: die genannte Regel — leer: die eines Bausteins „Punkty i seria" dieser Seite, sonst keine. */
function useRunRules(lib: CogitaLibrary | null | undefined, chosen: string): RewardRules | null {
  const fromPage = usePageRewards(lib?.libraryId ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const named = useMemo(() => (lib == null || chosen === '' ? null : rewardsFor(lib.docs('reward'), chosen, null).rules), [lib, lib?.revision, chosen]);
  return named ?? fromPage;
}

/** Nur die Karten einer Powtórka zählen — `undefined`: die ganze Baza (oder noch nicht gerechnet: `loading`). */
function useScope(lib: CogitaLibrary | null | undefined, revision: string, rename: ((key: string) => string) | undefined): { readonly keys: ReadonlySet<string> | undefined; readonly cards: readonly Card[] | null; readonly loading: boolean } {
  const planned = useAsync(lib == null || revision === '' ? null : () => planFor(lib, revision, null, 'page').then((r) => r.plan?.cards ?? []), [lib, lib?.revision, revision]);
  const keys = useMemo(() => (planned == null ? undefined : new Set(planned.map((c) => (rename === undefined ? c.key : rename(c.key))))), [planned, rename]);
  return { keys, cards: planned ?? null, loading: revision !== '' && planned === undefined };
}

/** Hoch oder im ganzen Fenster: das Ganze. */
const isTall = (ctx: PartContext): boolean => ctx.whole === true || ctx.size.height === 'tall';

const Head = ({ title }: { title: string }) => <h2 className="wk-card-title">{title}</h2>;

/*
 * 2026-11-01 — DIE EIGENE STATISTIK IM BAUSTEIN (`cogita/ModuleStats.tsx`): dieselben Diagramme wie in Nauka → Postępy
 * und die eigenen Antworten, für die Karten dieses Bausteins. Geladen erst, wenn jemand sie öffnet.
 */
const ModuleStats = later(() => import('../../cogita/ModuleStats').then((m) => m.ModuleStats));

/** Der Knopf dazu — im hohen Baustein über der laufenden Powtórka, sonst neben „Zacznij”. */
const StatsButton = ({ onOpen, line = false }: { onOpen: () => void; line?: boolean }) => (
  <button type="button" className={line ? 'wk-link-btn' : 'wk-btn wk-btn-line'} onClick={onOpen} data-module-stats-open="">Moje statystyki</button>
);

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
 * 2026-11-01 — FÜR DIE LEHRERIN, auf der Seite selbst: wer den Bereich führt, in den dieser Baustein die Antworten
 * schickt, kommt von hier zu ihnen (Nauka → Postępy dieses Bereichs: jeder Uczący się mit seinen Antworten).
 */
function TeacherLink({ library, area }: { library: string; area: string | null }) {
  const who = useWho();
  const leads = useAsync(area === null || library === '' || who == null ? null
    : () => loadAreas().then((r) => r.areas.some((a) => a.areaId.toLowerCase() === area.toLowerCase() && (a.myLevel === 'admin' || a.myLevel === 'write'))), [area, library, who]);
  if (leads !== true || area === null) return null;
  return (
    <p className="wk-card-muted">
      <a className="wk-link" href={viewPath('learn', library, 'postepy', area)} data-teacher-answers="">Odpowiedzi uczących się →</a>
    </p>
  );
}

/**
 * 2026-10-22 (Schritt 8) — eine Powtórka der Baza wiedzy selbst (keine
 * Abschrift mehr): ihre Karten rechnet der Browser aus den Einträgen, so wie
 * im Arbeitsbereich. Wer sie liest, sagt der Bereich der Baza.
 */
export function RevisionView({ config, ctx }: { config: RevisionConfig; ctx: PartContext }) {
  const { lib, ctx: cg } = usePageBase(config.library);
  /*
   * 2026-11-01 — „NASTĘPNA LEKCJA": der Baustein stellt sich auf die Powtórka um, die die gelaufene nennt (`next`) — mit
   * ihrem Bereich für die Antworten, ihren Karten, ihrem Namen; die Seite neu geladen, gilt wieder die eingestellte.
   */
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => { setCurrent(null); }, [config.revision]);
  const revisionId = current ?? config.revision;
  const doc = lib == null ? undefined : lib.docs('revision').find((e) => e.id === revisionId);
  /*
   * 2026-10-27 — als wer: die Person der Seite, ein Platz aus dem Link, sonst der Browser (`pageLearner.tsx`).
   * 2026-11-01 — und wohin: der Bereich, den dieser Baustein nennt, sonst die Powtórka (`answersTo.ts`).
   */
  const who = usePageLearner(lib, answersArea(config.answers, doc?.data.storageAreaId));
  const learner = who.learner;
  const [view, setView] = useState<'run' | 'stats' | null>(null);
  const name = typeof doc?.data.name === 'string' ? doc.data.name : '';
  const title = current === null ? config.title || name || 'Powtórka' : name || 'Powtórka';
  const planned = useAsync(lib == null || doc === undefined ? null : () => planFor(lib, doc.id, null, 'page'), [lib, lib?.revision, doc?.id]);
  /* 2026-11-02 — Punkte und Serie im Lauf: die genannte Regel, sonst die eines Bausteins „Punkty i seria" der Seite. */
  const rewards = useRunRules(lib, config.rewards);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rename = useMemo(() => (lib == null ? undefined : renamer(lib.merges())), [lib, lib?.revision]);
  if (lib == null || cg === null) return <Closed title={title} lib={lib} />;
  if (doc === undefined) return <><Head title={title} /><p className="wk-card-muted">Tej powtórki nie ma w bazie wiedzy.</p></>;

  if (view === 'stats') {
    return (
      <CogitaContext.Provider value={cg}>
        <ModuleStats lib={lib} learner={learner} cards={planned === undefined ? null : planned?.plan?.cards ?? []} title={title} onBack={() => setView(null)} />
      </CogitaContext.Provider>
    );
  }
  if (view === 'run' || isTall(ctx)) {
    /* Hoch läuft die Powtórka gleich — wer nur den Link hat, stellt sich darüber vor; danach lernt er neu als er selbst. */
    return (
      <CogitaContext.Provider value={cg}>
        {isTall(ctx) && who.as === 'local' && who.link !== null && <IntroduceToLearn link={who.link} onDone={who.introduced} />}
        {isTall(ctx) && who.ready && <p className="cg-module-tools"><StatsButton line onOpen={() => setView('stats')} /></p>}
        <RevisionRun key={`${who.as ?? ''}:${doc.id}`} lib={lib} learner={learner} source={{ revisionId: doc.id, title }} onClose={isTall(ctx) ? undefined : () => setView(null)}
          onOpenRevision={(id) => { setCurrent(id); setView('run'); }} rewards={rewards} />
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
      {/* 2026-11-02 — eigens genannte Nagrody: die Zeile schon vor dem Start. */}
      {config.rewards !== '' && rewards !== null && learner !== null && <RewardBoard learner={learner} rules={rewards} {...(rename === undefined ? {} : { rename })} shape="compact" hidden={NO_FEED} />}
      {who.as === 'local' && who.link !== null && <IntroduceToLearn link={who.link} onDone={who.introduced} />}
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={!who.ready} onClick={() => setView('run')}>{levels !== null && levels.known + levels.learning > 0 ? 'Powtórz' : 'Zacznij'}</button>
        {who.ready && <StatsButton onOpen={() => setView('stats')} />}
      </div>
      <LearnerLine learner={who} lib={lib} />
      <TeacherLink library={lib.libraryId} area={answersArea(config.answers, doc.data.storageAreaId, lib.settings().storageAreaId)} />
    </>
  );
}

/** Ein Przebieg der Baza wiedzy selbst — Schritte, Fragen und Dateien aus ihren Einträgen. */
export function FlowView({ config, ctx }: { config: FlowConfig; ctx: PartContext }) {
  const { lib, ctx: cg } = usePageBase(config.library);
  const who = usePageLearner(lib, answersArea(config.answers));
  const learner = who.learner;
  const [view, setView] = useState<'play' | 'stats' | null>(null);
  const cards = useAsync(lib == null ? null : () => lib.cards('flow').then((r) => r.cards), [lib, lib?.revision]);
  const content = useMemo(() => (lib == null || cards == null ? null : contentOfLibrary(lib, cards)), [lib, cards]);
  const flow = useMemo(() => (content === null ? undefined : content.flow(config.flow)), [content, config.flow]);
  const title = config.title || flow?.name || 'Przebieg';
  if (lib == null || cg === null) return <Closed title={title} lib={lib} />;
  if (content === null) return <><Head title={title} /><Loading /></>;
  if (flow === undefined) return <><Head title={title} /><p className="wk-card-muted">Tego przebiegu nie ma w bazie wiedzy.</p></>;

  if (view === 'stats') {
    return (
      <CogitaContext.Provider value={cg}>
        <ModuleStats lib={lib} learner={learner} cards={cards ?? null} title={title} onBack={() => setView(null)} />
      </CogitaContext.Provider>
    );
  }
  if (view === 'play' || isTall(ctx)) {
    return (
      <CogitaContext.Provider value={cg}>
        {!isTall(ctx) && <Head title={title} />}
        {isTall(ctx) && who.as === 'local' && who.link !== null && <IntroduceToLearn link={who.link} onDone={who.introduced} />}
        {isTall(ctx) && who.ready && <p className="cg-module-tools"><StatsButton line onOpen={() => setView('stats')} /></p>}
        <FlowPlayer key={who.as ?? ''} flow={flow} content={content} learner={learner} onClose={isTall(ctx) ? undefined : () => setView(null)} presentationAs="link" />
      </CogitaContext.Provider>
    );
  }
  const saved = positionFor(learner?.progress.positions, flow) ?? null;
  const questions = flow.graph.nodes.filter((n) => n.type === 'question').length;
  return (
    <>
      <Head title={title} />
      <p className="wk-card-muted">{LOOK_LABEL[flow.look]} · {flow.graph.nodes.length} kroków{questions > 0 ? ` · ${questions} pytań` : ''}</p>
      {flow.goals.length > 0 && ctx.size.width !== 'narrow' && <p className="wk-card-muted">Cele: {flow.goals.map((g) => g.title).join(' · ')}</p>}
      {who.as === 'local' && who.link !== null && <IntroduceToLearn link={who.link} onDone={who.introduced} />}
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={!who.ready} onClick={() => setView('play')}>{saved !== null ? 'Wróć tam, gdzie skończyłeś' : 'Zacznij'}</button>
        {who.ready && <StatsButton onOpen={() => setView('stats')} />}
      </div>
      <LearnerLine learner={who} lib={lib} />
      <TeacherLink library={lib.libraryId} area={answersArea(config.answers, lib.settings().storageAreaId)} />
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
  const learner = usePageLearner(lib, answersArea(lib?.docs('revision').find((e) => e.id === config.revision)?.data.storageAreaId)).learner;
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
    return { plan: readPlan(of, { mode: 'once', order: 'random' }), cards: of, deps, title: e === undefined ? 'Powtórka' : lib.labelTex(e) };
  }, [learning, lib, cards, deps]);

  const title = config.title || 'Mapa wiedzy';
  if (lib == null || cg === null || graph === null) return <Closed title={title} lib={lib} />;
  if (planned === undefined) return <><Head title={title} /><Loading /></>;

  const now = Date.now();
  const cardsOf = (id: string) => cards.filter((c) => c.entity === id);
  const knowness = (id: string) => {
    const of = cardsOf(id);
    return of.length === 0 || learner === null ? 0 : average(of.map((c) => knownessOf(learner.marks(c.key, c.fingerprint), now, learner.spacing)));
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
          /* 2026-11-01 — die Karte setzt Wzory im Etikett (`labelTex`); der Hinweis bleibt eine Zeile ohne LaTeX. */
          const label = e === undefined ? '?' : lib.labelTex(e);
          const plain = e === undefined ? '?' : lib.label(e);
          return { id, label, state, title: state === 'fog' ? 'Jeszcze w mgle' : `${plain} · ${Math.round(shareOf(knowness(id)) * 100)}%` };
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
  const { learner, failed } = useSeatLearner(seat, lib, answersArea(config.answers));
  const [running, setRunning] = useState<string | null>(null);
  const [stats, setStats] = useState(false);
  const cards = useAsync(lib == null ? null : () => lib.cards('learn').then((r) => r.cards), [lib, lib?.revision]);
  /* 2026-11-01 — die Statistik gilt den Karten, die dieser Baustein lernt: der einen Powtórka, sonst der ganzen Baza. */
  const scoped = useAsync(lib == null || config.revision === '' ? null : () => planFor(lib, config.revision, null, 'page').then((r) => r.plan?.cards ?? []), [lib, lib?.revision, config.revision]);
  const ctx = useMemo<CogitaCtx | null>(() => (lib == null ? null : seatCtx(lib, opened, seat.token)), [lib, opened, seat.token]);
  /* 2026-11-02 — Punkte und Serie: die genannte Regel, sonst die eines Bausteins „Punkty i seria" der Seite. */
  const rewards = useRunRules(lib, config.rewards);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rename = useMemo(() => (lib == null ? undefined : renamer(lib.merges())), [lib, lib?.revision]);

  if (lib === undefined) return <p className="wk-card-muted">Otwieranie bazy wiedzy…</p>;
  if (lib === null || ctx === null) return <p className="wk-card-muted">Ta baza wiedzy nie jest dostępna z tego linku.</p>;
  const revisions = lib.docs('revision').filter((r) => config.revision === '' || r.id === config.revision);
  /* 2026-11-01 — auch die nächste Lektion (`next`), die nicht unter den Powtórki dieses Bausteins steht. */
  const nameOf = (id: string) => {
    const doc = lib.docs('revision').find((r) => r.id === id);
    return typeof doc?.data.name === 'string' ? doc.data.name : 'Powtórka';
  };

  if (stats) {
    return (
      <CogitaContext.Provider value={ctx}>
        <ModuleStats lib={lib} learner={learner} cards={(config.revision === '' ? cards : scoped) ?? null} title={config.title || name || 'Twoja nauka'} onBack={() => setStats(false)} />
      </CogitaContext.Provider>
    );
  }
  if (running !== null) {
    return (
      <CogitaContext.Provider value={ctx}>
        <RevisionRun key={running} lib={lib} learner={learner} source={{ revisionId: running, title: nameOf(running) }} onClose={() => setRunning(null)}
          onOpenRevision={(id) => setRunning(id)} rewards={rewards} />
      </CogitaContext.Provider>
    );
  }

  const now = Date.now();
  const due = cards == null || learner === null ? null : cards.filter((c: Card) => {
    if (learner.progress.suspended.has(c.key)) return false;
    const marks = learner.marks(c.key, c.fingerprint);
    const at = marks.length === 0 ? null : dueAt(marks, learner.spacing);
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
      {/* 2026-11-01 (2.11) — wer über den Link lernt, hat keine Nauka: das Tagesziel steht hier (nur mit „Serie dni nauki"). */}
      {/* 2026-11-02 — mit eigens genannten Nagrody deren Zeile statt des Tagesziels. */}
      {config.rewards !== '' && rewards !== null && learner !== null ? <RewardBoard learner={learner} rules={rewards} {...(rename === undefined ? {} : { rename })} shape={tall ? 'block' : 'compact'} hidden={NO_FEED} />
        : tall && <DailyGoal lib={lib} learner={learner} compact />}
      {revisions.length === 0 ? <p className="wk-card-muted">W tej bazie wiedzy nie ma jeszcze powtórki.</p> : (
        <div className="wk-actions">
          {revisions.map((r) => <button key={r.id} type="button" className="wk-btn" disabled={learner === null} onClick={() => setRunning(r.id)}>{nameOf(r.id)}</button>)}
          {learner !== null && <StatsButton onOpen={() => setStats(true)} />}
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
    <>
      <OnSeat title={config.title} fallback="Twoja nauka" empty="Tu pojawi się nauka — dla osoby, która otworzy swój link.">
        {(seat) => <SeatLearn seat={seat} config={config} tall={isTall(ctx)} />}
      </OnSeat>
      {/* 2026-11-01 — wer den Bereich der Antworten führt, kommt von hier zu ihnen. */}
      <TeacherLink library={config.library} area={answersArea(config.answers)} />
    </>
  );
}

/* -- 2026-11-02: Nagrody und Statystyki na żywo ------------------------------------------------------------------------ */

const NO_FEED: ReadonlySet<string> = new Set(['feed']);

/**
 * PUNKTY I SERIA — die Tafel der Nagrody der Person, die hier lernt (dieselbe Wahl wie die Lernbausteine der Seite:
 * `usePageLearner`). Live: jede Antwort, die ein Baustein derselben Person festhält, kommt sofort an (`learn.ts`). Der
 * Baustein meldet seine Regel der Seite (`pageRewards.ts`) — die Powtórka daneben zeigt dann im Lauf dieselben Punkte.
 */
export function RewardsView({ config, ctx }: { config: RewardsConfig; ctx: PartContext }) {
  const { lib, ctx: cg } = usePageBase(config.library);
  const who = usePageLearner(lib);
  const rules = usePlaceRules(lib, config.rewards);
  usePlaceRewards(lib?.libraryId ?? null, lib == null ? null : rules);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rename = useMemo(() => (lib == null ? undefined : renamer(lib.merges())), [lib, lib?.revision]);
  const scope = useScope(lib, config.revision, rename);
  const title = config.title || 'Twoje punkty';
  if (lib == null || cg === null) return <Closed title={title} lib={lib} />;
  const strip = ctx.size.height === 'strip' && ctx.whole !== true;
  const shape = strip ? 'strip' : isTall(ctx) ? 'full' : 'block';
  return (
    <CogitaContext.Provider value={cg}>
      {!strip && <Head title={title} />}
      {!who.ready || scope.loading ? <Loading lines={2} />
        : who.learner === null ? <p className="wk-card-muted">Punkty pojawią się tutaj, gdy zaczniesz się uczyć.</p>
          : <RewardBoard learner={who.learner} rules={rules} {...(rename === undefined ? {} : { rename })} {...(scope.keys === undefined ? {} : { keys: scope.keys })} hidden={config.hidden} shape={shape} />}
      {shape === 'full' && who.as === 'local' && <p className="wk-card-muted">Bez konta punkty liczą się w tej przeglądarce.</p>}
    </CogitaContext.Provider>
  );
}

/** STATYSTYKI NA ŻYWO — Zahlen und Diagramme des Lernens dieser Person, die mit jeder Antwort wachsen (`LiveStats.tsx`). */
export function LiveStatsView({ config, ctx }: { config: LiveStatsConfig; ctx: PartContext }) {
  const { lib, ctx: cg } = usePageBase(config.library);
  const who = usePageLearner(lib);
  const rules = usePlaceRules(lib, config.rewards);
  usePlaceRewards(lib?.libraryId ?? null, lib == null ? null : rules);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rename = useMemo(() => (lib == null ? undefined : renamer(lib.merges())), [lib, lib?.revision]);
  const scope = useScope(lib, config.revision, rename);
  const tall = isTall(ctx);
  /* „Gdzie są karty" nur im Ganzen — die Karten der ganzen Baza erst dann. */
  const all = useAsync(lib == null || !tall || config.revision !== '' || config.hidden.has('knowledge') ? null : () => lib.cards('learn').then((r) => r.cards), [lib, lib?.revision, tall, config.revision, config.hidden.has('knowledge')]);
  const title = config.title || 'Na żywo';
  if (lib == null || cg === null) return <Closed title={title} lib={lib} />;
  const strip = ctx.size.height === 'strip' && ctx.whole !== true;
  return (
    <CogitaContext.Provider value={cg}>
      {!strip && <Head title={title} />}
      {!who.ready || scope.loading ? <Loading lines={2} />
        : who.learner === null ? <p className="wk-card-muted">Statystyki pojawią się tutaj, gdy zaczniesz się uczyć.</p>
          : <LiveStats lib={lib} learner={who.learner} rules={rules} cards={config.revision !== '' ? scope.cards : all ?? null}
            {...(rename === undefined ? {} : { rename })} {...(scope.keys === undefined ? {} : { keys: scope.keys })} hidden={config.hidden} shape={strip ? 'strip' : tall ? 'full' : 'block'} />}
    </CogitaContext.Provider>
  );
}
