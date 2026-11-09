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

import { useT } from '../../core/i18n';

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
import { reviewScopeFor } from '../../cogita/worldmap/wmReview';
import { reviewable } from '../../cogita/worldmap/wmState';
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
const StatsButton = ({ onOpen, line = false }: { onOpen: () => void; line?: boolean }) => {
  const t = useT();
  return <button type="button" className={line ? 'wk-link-btn' : 'wk-btn wk-btn-line'} onClick={onOpen} data-module-stats-open="">{t('moduleDataCogita.v.myStats')}</button>;
};

/** Was die Seite sagt, solange die Baza wiedzy geöffnet wird — oder wenn dieser Leser sie nicht lesen darf. */
function Closed({ title, lib }: { title: string; lib: CogitaLibrary | null | undefined }) {
  const t = useT();
  return (
    <>
      <Head title={title} />
      {lib === undefined ? <Loading /> : <p className="wk-card-muted">{t('moduleDataCogita.v.closed')}</p>}
    </>
  );
}

/**
 * 2026-11-01 — FÜR DIE LEHRERIN, auf der Seite selbst: wer den Bereich führt, in den dieser Baustein die Antworten
 * schickt, kommt von hier zu ihnen (Nauka → Postępy dieses Bereichs: jeder Uczący się mit seinen Antworten).
 */
function TeacherLink({ library, area }: { library: string; area: string | null }) {
  const t = useT();
  const who = useWho();
  const leads = useAsync(area === null || library === '' || who == null ? null
    : () => loadAreas().then((r) => r.areas.some((a) => a.areaId.toLowerCase() === area.toLowerCase() && (a.myLevel === 'admin' || a.myLevel === 'write'))), [area, library, who]);
  if (leads !== true || area === null) return null;
  return (
    <p className="wk-card-muted">
      <a className="wk-link" href={viewPath('learn', library, 'postepy', area)} data-teacher-answers="">{t('moduleDataCogita.v.teacherAnswers')}</a>
    </p>
  );
}

/**
 * 2026-10-22 (Schritt 8) — eine Powtórka der Baza wiedzy selbst (keine
 * Abschrift mehr): ihre Karten rechnet der Browser aus den Einträgen, so wie
 * im Arbeitsbereich. Wer sie liest, sagt der Bereich der Baza.
 */
export function RevisionView({ config, ctx }: { config: RevisionConfig; ctx: PartContext }) {
  const t = useT();
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
  const title = current === null ? config.title || name || t('moduleDataCogita.v.revision') : name || t('moduleDataCogita.v.revision');
  const planned = useAsync(lib == null || doc === undefined ? null : () => planFor(lib, doc.id, null, 'page'), [lib, lib?.revision, doc?.id]);
  /* 2026-11-02 — Punkte und Serie im Lauf: die genannte Regel, sonst die eines Bausteins „Punkty i seria" der Seite. */
  const rewards = useRunRules(lib, config.rewards);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rename = useMemo(() => (lib == null ? undefined : renamer(lib.merges())), [lib, lib?.revision]);
  if (lib == null || cg === null) return <Closed title={title} lib={lib} />;
  if (doc === undefined) return <><Head title={title} /><p className="wk-card-muted">{t('moduleDataCogita.v.noRevision')}</p></>;

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
  /* 2026-11-05 (Durchsicht) — die Bänder mit den Abständen dieses Lernenden (sonst „nieznane“ bei „Raz i gotowe“). */
  const levels = learner === null || plan === null ? null : levelsOf(plan, (key) => learner.marks(key), Date.now(), learner.spacing);
  return (
    <>
      <Head title={title} />
      <p className="wk-card-muted">{planned === undefined ? t('moduleDataCogita.v.counting') : t('moduleDataCogita.v.cards', { count: total })}{levels !== null && levels.known + levels.learning > 0 ? t('moduleDataCogita.v.levels', { known: LEVEL_LABEL.known, nKnown: levels.known, learning: LEVEL_LABEL.learning, nLearning: levels.learning }) : ''}</p>
      {levels !== null && levels.known > 0 && <Bar value={levels.known / Math.max(1, total)} label={t('moduleDataCogita.v.howMuchKnown')} />}
      {/* 2026-11-02 — eigens genannte Nagrody: die Zeile schon vor dem Start. */}
      {config.rewards !== '' && rewards !== null && learner !== null && <RewardBoard learner={learner} rules={rewards} {...(rename === undefined ? {} : { rename })} shape="compact" hidden={NO_FEED} />}
      {who.as === 'local' && who.link !== null && <IntroduceToLearn link={who.link} onDone={who.introduced} />}
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={!who.ready} onClick={() => setView('run')}>{levels !== null && levels.known + levels.learning > 0 ? t('moduleDataCogita.v.repeat') : t('moduleDataCogita.s.start')}</button>
        {who.ready && <StatsButton onOpen={() => setView('stats')} />}
      </div>
      <LearnerLine learner={who} lib={lib} />
      <TeacherLink library={lib.libraryId} area={answersArea(config.answers, doc.data.storageAreaId, lib.settings().storageAreaId)} />
    </>
  );
}

/** Ein Przebieg der Baza wiedzy selbst — Schritte, Fragen und Dateien aus ihren Einträgen. */
export function FlowView({ config, ctx }: { config: FlowConfig; ctx: PartContext }) {
  const t = useT();
  const { lib, ctx: cg } = usePageBase(config.library);
  const who = usePageLearner(lib, answersArea(config.answers));
  const learner = who.learner;
  const [view, setView] = useState<'play' | 'stats' | null>(null);
  const cards = useAsync(lib == null ? null : () => lib.cards('flow').then((r) => r.cards), [lib, lib?.revision]);
  const content = useMemo(() => (lib == null || cards == null ? null : contentOfLibrary(lib, cards)), [lib, cards]);
  const flow = useMemo(() => (content === null ? undefined : content.flow(config.flow)), [content, config.flow]);
  const title = config.title || flow?.name || t('moduleDataCogita.v.flow');
  if (lib == null || cg === null) return <Closed title={title} lib={lib} />;
  if (content === null) return <><Head title={title} /><Loading /></>;
  if (flow === undefined) return <><Head title={title} /><p className="wk-card-muted">{t('moduleDataCogita.v.noFlow')}</p></>;

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
        <FlowPlayer key={who.as ?? ''} flow={flow} content={content} learner={learner} onClose={isTall(ctx) ? undefined : () => setView(null)} backLabel={t('moduleDataCogita.v.page')} presentationAs="link" />
      </CogitaContext.Provider>
    );
  }
  const saved = positionFor(learner?.progress.positions, flow) ?? null;
  const questions = flow.graph.nodes.filter((n) => n.type === 'question').length;
  return (
    <>
      <Head title={title} />
      <p className="wk-card-muted">{LOOK_LABEL[flow.look]} · {t('moduleDataCogita.v.steps', { count: flow.graph.nodes.length })}{questions > 0 ? ` · ${t('moduleDataCogita.v.questions', { count: questions })}` : ''}</p>
      {flow.goals.length > 0 && ctx.size.width !== 'narrow' && <p className="wk-card-muted">{t('moduleDataCogita.v.goals', { goals: flow.goals.map((g) => g.title).join(' · ') })}</p>}
      {who.as === 'local' && who.link !== null && <IntroduceToLearn link={who.link} onDone={who.introduced} />}
      <div className="wk-actions">
        <button type="button" className="wk-btn" disabled={!who.ready} onClick={() => setView('play')}>{saved !== null ? t('moduleDataCogita.v.resume') : t('moduleDataCogita.s.start')}</button>
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
  const t = useT();
  const [ticket] = useState<Ticket | null>(ticketHere);
  const [joined, setJoined] = useState<Joined | null>(null);
  const [code, setCode] = useState('');
  const { busy, failed, run } = useBusy();
  const learner = useLocalLearner(joined?.session.libraryId ?? '');
  const title = config.title || t('moduleDataCogita.live.label');

  useEffect(() => {
    if (ticket === null) return;
    void run(async () => {
      const cred: Credentials = { join: ticket.join };
      const { session } = await loadSession(ticket.sessionId, cred);
      const keys = new Map<number, Uint8Array>();
      if (ticket.key !== null && ticket.epoch !== null) keys.set(ticket.epoch, ticket.key);
      const named = ticket.key === null ? null : await openTitle(ticket.key, session).catch(() => null);
      setJoined({ session, cred, keys, title: named ?? t('moduleDataCogita.v.session') });
    });
    // Einmal, mit dem Zugang aus der Adresse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket]);

  const byCode = () => run(async () => {
    const { session, join } = await joinByCode(code);
    setJoined({ session, cred: { join }, keys: new Map(), title: t('moduleDataCogita.v.sessionCode', { code: session.joinCode ?? code.trim().toUpperCase() }) });
  });

  if (joined !== null) {
    if (ctx.size.height === 'strip' && ctx.whole !== true && ctx.openWhole !== undefined) {
      return (
        <>
          <Head title={joined.title} />
          <button type="button" className="wk-btn wk-card-open" onClick={ctx.openWhole}>{t('moduleDataCogita.v.openSession')}</button>
        </>
      );
    }
    if (joined.session.state === 'finished' || joined.session.state === 'closed') return <><Head title={joined.title} /><p className="wk-card-muted">{t('moduleDataCogita.v.sessionOver')}</p></>;
    return (
      <SessionPlay session={joined.session} title={joined.title} cred={joined.cred} keys={joined.keys}
        participant={participantId(joined.session.sessionId)} name={null} learner={learner} />
    );
  }

  const strip = ctx.size.height === 'strip' && ctx.whole !== true;
  return (
    <>
      {!strip && <Head title={title} />}
      {ticket !== null && failed === null ? <p className="wk-card-muted">{t('moduleDataCogita.v.sessionOpening')}</p> : (
        <form className={strip ? 'cg-row' : 'wk-form'} onSubmit={(e) => { e.preventDefault(); void byCode(); }}>
          <label className={strip ? 'cg-row' : 'wk-field'}>
            <span>{strip ? title : t('moduleDataCogita.v.codeLabel')}</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} autoComplete="off" inputMode="text"
              className="cg-code-input" aria-label={t('moduleDataCogita.v.code')} placeholder={t('moduleDataCogita.v.codePlaceholder')} />
          </label>
          <button type="submit" className="wk-btn" disabled={busy || code.trim().length < 4}>{t('moduleDataCogita.v.join')}</button>
        </form>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {isTall(ctx) && <p className="wk-card-muted">{t('moduleDataCogita.v.liveNote')}</p>}
    </>
  );
}

/** Ein Eintrag als Karte — aus der Baza wiedzy selbst (Schritt 8), mit seinen Feldern und Bildern. */
export function EntityCardView({ config, ctx }: { config: EntityConfig; ctx: PartContext }) {
  const t = useT();
  /* 0109 — ohne eigenen Eintrag: der, den die Seite oben gewählt hat („Wpis z bazy wiedzy"). */
  const subject = useEntitySubject();
  const library = config.library !== '' ? config.library : subject?.library ?? '';
  const entry = config.entry !== '' ? config.entry : subject !== null && subject.library === library ? subject.chosen ?? '' : '';
  const { lib, ctx: cg } = usePageBase(library);
  if (entry === '' && subject !== null) return <><Head title={config.title || t('moduleDataCogita.v.entry')} /><p className="wk-card-muted">{t('moduleDataCogita.v.pickEntryTop')}</p></>;
  if (entry === '' || library === '') return <><Head title={config.title || t('moduleDataCogita.v.entry')} /><p className="wk-card-muted">{t('moduleDataCogita.v.pickEntry')}</p></>;
  if (lib == null || cg === null) return <Closed title={config.title || t('moduleDataCogita.v.entry')} lib={lib} />;
  const entity = lib.entity(entry);
  if (entity === undefined) return <><Head title={config.title || t('moduleDataCogita.v.entry')} /><p className="wk-card-muted">{t('moduleDataCogita.v.noEntry')}</p></>;
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
  const t = useT();
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
      .sort((a, b) => a.label.localeCompare(b.label, t.locale));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, lib?.revision, config.kind, t]);
  const title = config.title || t('moduleDataCogita.v.entries');
  if (lib == null || cg === null || rows === null) return <Closed title={title} lib={lib} />;
  if (ctx.size.height === 'strip' && ctx.whole !== true) {
    return (
      <p className="cg-row">
        <strong>{title}</strong><span className="wk-card-muted">{t('moduleDataCogita.v.entriesCount', { count: rows.length })}</span>
        {ctx.openWhole !== undefined && <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>{t('moduleDataCogita.v.see')}</button>}
      </p>
    );
  }
  if (!isTall(ctx)) {
    return (
      <>
        <Head title={title} />
        <ul className="cg-plain-list">{rows.slice(0, 8).map((r) => <li key={r.id}>{r.label}</li>)}</ul>
        {rows.length > 8 && <p className="wk-card-muted">{t('moduleDataCogita.v.andMore', { count: rows.length - 8 })}{ctx.openWhole !== undefined ? ' — ' : ''}{ctx.openWhole !== undefined && <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>{t('moduleDataCogita.v.wholeTable')}</button>}</p>}
      </>
    );
  }
  const columns = config.columns.length > 0 ? config.columns : [...new Set(rows.flatMap((r) => [...r.cells.keys()]))].slice(0, 4);
  const folded = (s: string) => s.toLocaleLowerCase(t.locale).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const words = folded(query).split(/\s+/).filter(Boolean);
  const shown = words.length === 0 ? rows : rows.filter((r) => words.every((w) => folded(`${r.label} ${[...r.cells.values()].join(' ')}`).includes(w)));
  return (
    <CogitaContext.Provider value={cg}>
      <Head title={title} />
      <input type="search" className="cg-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('moduleDataCogita.v.searchTablePh')} aria-label={t('moduleDataCogita.v.searchTable')} />
      <div className="cg-table-wrap">
        <table className="cg-table">
          <thead><tr><th>{t('common.name')}</th>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
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
      {shown.length === 0 && <p className="wk-card-muted">{t('moduleDataCogita.v.noMatch')}</p>}
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
  const t = useT();
  return (
    <div className="wk-card-text">
      <Head title={config.title || t('moduleDataCogita.topics.label')} />
      <p className="wk-card-muted">{t('moduleDataCogita.v.topicsGone')}</p>
    </div>
  );
}

/** Die Karte des Wissens einer Powtórka — aus den Einträgen der Baza selbst, im eigenen Nebel. */
export function KnowledgeMapView({ config, ctx }: { config: MapConfig; ctx: PartContext }) {
  const t = useT();
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
    return { plan: readPlan(of, { mode: 'once', order: 'random' }), cards: of, deps, title: e === undefined ? t('moduleDataCogita.v.revision') : lib.labelTex(e) };
  }, [learning, lib, cards, deps, t]);

  const title = config.title || t('moduleDataCogita.map.label');
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
        <Bar value={known / Math.max(1, graph.ids.length)} label={t('moduleDataCogita.v.howMuchKnown')} />
        <span className="wk-card-muted">{t('moduleDataCogita.v.xOfY', { x: known, y: graph.ids.length })}</span>
        {ctx.openWhole !== undefined && <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>{t('moduleDataCogita.v.map')}</button>}
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
      <p className="wk-card-muted">{t('moduleDataCogita.v.mapLegend', { x: known, y: graph.ids.length })}</p>
      <FogMap tall={tall} edges={graph.edges} place={graph.place} onOpen={setChosen}
        nodes={graph.ids.map((id) => {
          const state = fog.get(id) ?? 'fog';
          const e = lib.entity(id);
          /* 2026-11-01 — die Karte setzt Wzory im Etikett (`labelTex`); der Hinweis bleibt eine Zeile ohne LaTeX. */
          const label = e === undefined ? '?' : lib.labelTex(e);
          const plain = e === undefined ? '?' : lib.label(e);
          return { id, label, state, title: state === 'fog' ? t('moduleDataCogita.v.inFog') : `${plain} · ${Math.round(shareOf(knowness(id)) * 100)}%` };
        })} />
      {entity !== undefined && chosen !== null && (
        <div className="cg-card">
          <EntityView entity={tall ? publicEntity(lib, entity) : { ...publicEntity(lib, entity), media: [], fields: publicEntity(lib, entity).fields.slice(0, 2) }} />
          {cardsOf(chosen).length > 0 && <button type="button" className="wk-btn" onClick={() => setLearning(chosen)}>{t('moduleDataCogita.v.learnThis', { count: cardsOf(chosen).length })}</button>}
        </div>
      )}
    </CogitaContext.Provider>
  );
}

function SeatLearn({ seat, config, tall }: { seat: SeatView; config: SeatLearnConfig; tall: boolean }) {
  const t = useT();
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

  if (lib === undefined) return <p className="wk-card-muted">{t('moduleDataCogita.v.baseOpening')}</p>;
  if (lib === null || ctx === null) return <p className="wk-card-muted">{t('moduleDataCogita.v.baseNotFromLink')}</p>;
  const revisions = lib.docs('revision').filter((r) => config.revision === '' || r.id === config.revision);
  /* 2026-11-01 — auch die nächste Lektion (`next`), die nicht unter den Powtórki dieses Bausteins steht. */
  const nameOf = (id: string) => {
    const doc = lib.docs('revision').find((r) => r.id === id);
    return typeof doc?.data.name === 'string' ? doc.data.name : t('moduleDataCogita.v.revision');
  };

  if (stats) {
    return (
      <CogitaContext.Provider value={ctx}>
        <ModuleStats lib={lib} learner={learner} cards={(config.revision === '' ? cards : scoped) ?? null} title={config.title || name || t('moduleDataCogita.seat.exTitle')} onBack={() => setStats(false)} />
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
  /* 2026-11-09 (Weltkarte, Korrektur 5) — mit Stufen zählen nur Karten eroberter Orte. */
  const scope = reviewScopeFor(lib, cards, learner);
  const due = cards == null || learner === null ? null : cards.filter((c: Card) => {
    if (learner.progress.suspended.has(c.key) || !reviewable(c.key, scope)) return false;
    const marks = learner.marks(c.key, c.fingerprint);
    const at = marks.length === 0 ? null : dueAt(marks, learner.spacing);
    return at !== null && at <= now;
  }).length;
  const levels = cards == null || learner === null ? null : levelsOf(readPlan(cards, {}), (key) => learner.marks(key), now, learner.spacing);
  return (
    <CogitaContext.Provider value={ctx}>
      <p className="wk-card-muted">{name}{due !== null ? t('moduleDataCogita.v.dueNow', { count: due }) : ''}</p>
      {tall && levels !== null && cards != null && cards.length > 0 && (
        <>
          <Bar value={levels.known / Math.max(1, cards.length)} label={t('moduleDataCogita.v.howMuchKnown')} />
          <p className="wk-card-muted">{(['known', 'learning', 'unseen'] as const).map((l) => `${LEVEL_LABEL[l]}: ${levels[l]}`).join(' · ')}</p>
        </>
      )}
      {/* 2026-11-01 (2.11) — wer über den Link lernt, hat keine Nauka: das Tagesziel steht hier (nur mit „Serie dni nauki"). */}
      {/* 2026-11-02 — mit eigens genannten Nagrody deren Zeile statt des Tagesziels. */}
      {config.rewards !== '' && rewards !== null && learner !== null ? <RewardBoard learner={learner} rules={rewards} {...(rename === undefined ? {} : { rename })} shape={tall ? 'block' : 'compact'} hidden={NO_FEED} />
        : tall && <DailyGoal lib={lib} learner={learner} compact />}
      {revisions.length === 0 ? <p className="wk-card-muted">{t('moduleDataCogita.v.noRevisions')}</p> : (
        <div className="wk-actions">
          {revisions.map((r) => <button key={r.id} type="button" className="wk-btn" disabled={learner === null} onClick={() => setRunning(r.id)}>{nameOf(r.id)}</button>)}
          {learner !== null && <StatsButton onOpen={() => setStats(true)} />}
        </div>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
      {learner !== null && learner.waiting > 0 && <p className="wk-card-muted">{t('moduleDataCogita.v.waiting', { count: learner.waiting })}</p>}
    </CogitaContext.Provider>
  );
}

/** Hinter einem persönlichen Link: der Platz (oder die Wahl oben auf der Seite), dann sein Lernen. */
export function SeatLearnView({ config, ctx }: { config: SeatLearnConfig; ctx: PartContext }) {
  const t = useT();
  return (
    <>
      <OnSeat title={config.title} fallback={t('moduleDataCogita.seat.exTitle')} empty={t('moduleDataCogita.v.seatEmpty')}>
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
  const t = useT();
  const { lib, ctx: cg } = usePageBase(config.library);
  const who = usePageLearner(lib);
  const rules = usePlaceRules(lib, config.rewards);
  usePlaceRewards(lib?.libraryId ?? null, lib == null ? null : rules);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rename = useMemo(() => (lib == null ? undefined : renamer(lib.merges())), [lib, lib?.revision]);
  const scope = useScope(lib, config.revision, rename);
  const title = config.title || t('moduleDataCogita.rewards.exTitle');
  if (lib == null || cg === null) return <Closed title={title} lib={lib} />;
  const strip = ctx.size.height === 'strip' && ctx.whole !== true;
  const shape = strip ? 'strip' : isTall(ctx) ? 'full' : 'block';
  return (
    <CogitaContext.Provider value={cg}>
      {!strip && <Head title={title} />}
      {!who.ready || scope.loading ? <Loading lines={2} />
        : who.learner === null ? <p className="wk-card-muted">{t('moduleDataCogita.v.pointsLater')}</p>
          : <RewardBoard learner={who.learner} rules={rules} {...(rename === undefined ? {} : { rename })} {...(scope.keys === undefined ? {} : { keys: scope.keys })} hidden={config.hidden} shape={shape} />}
      {shape === 'full' && who.as === 'local' && <p className="wk-card-muted">{t('moduleDataCogita.v.pointsLocal')}</p>}
    </CogitaContext.Provider>
  );
}

/** STATYSTYKI NA ŻYWO — Zahlen und Diagramme des Lernens dieser Person, die mit jeder Antwort wachsen (`LiveStats.tsx`). */
export function LiveStatsView({ config, ctx }: { config: LiveStatsConfig; ctx: PartContext }) {
  const t = useT();
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
  const title = config.title || t('moduleDataCogita.stats.exTitle');
  if (lib == null || cg === null) return <Closed title={title} lib={lib} />;
  const strip = ctx.size.height === 'strip' && ctx.whole !== true;
  return (
    <CogitaContext.Provider value={cg}>
      {!strip && <Head title={title} />}
      {!who.ready || scope.loading ? <Loading lines={2} />
        : who.learner === null ? <p className="wk-card-muted">{t('moduleDataCogita.v.statsLater')}</p>
          : <LiveStats lib={lib} learner={who.learner} rules={rules} cards={config.revision !== '' ? scope.cards : all ?? null}
            {...(rename === undefined ? {} : { rename })} {...(scope.keys === undefined ? {} : { keys: scope.keys })} hidden={config.hidden} shape={strip ? 'strip' : tall ? 'full' : 'block'} />}
    </CogitaContext.Provider>
  );
}
