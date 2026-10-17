/**
 * DIE ANSICHTEN DER COGITA-BAUSTEINE (0109) — was `parts/cogita.tsx`
 * beschreibt, zeigt sich hier: Powtórka, Przebieg, Sitzung, Eintrag, Tabelle,
 * Themen, Karte des Wissens, und das Lernen eines Platzes. Ein eigenes Bündel:
 * geladen erst, wenn eine Seite einen dieser Bausteine trägt.
 */

import { useEffect, useMemo, useState } from 'react';

import { loadPublishedOne, summaryOf, type PublishedItem } from '../library';
import { kindOf } from '../libraryKinds';
import type { PartContext } from '../part';
import type { SeatView } from '../seatContext';
import type { Card } from '../cogita/cards';
import { publicFileUrl } from '../cogita/files';
import { LOOK_LABEL, readFlow, resolveFlow } from '../cogita/flow';
import { contentOfBundle, EntityView, FlowPlayer } from '../cogita/FlowPlayer';
import { fogOf, ringsOf } from '../cogita/game';
import { average, dueAt, knownessOf, LEVEL_LABEL, shareOf } from '../cogita/knowness';
import { joinByCode, loadSession, openTitle, participantId, ticketFromAddress, ticketOf, type Credentials, type SessionRow, type Ticket } from '../cogita/live';
import type { PublicEntity, PublicFlow, PublicRevision } from '../cogita/publish';
import { ENTITY_BUNDLE, FLOW_BUNDLE, publishedAll, REVISION_BUNDLE, titleOf } from '../cogita/published';
import { useEntitySubject } from '../cogita/entitySubject';
import { publicOf, revisionSource, useBundle, useLocalLearner } from '../cogita/PublicRun';
import { levelsOf, readPlan } from '../cogita/revision';
import { RevisionRun } from '../cogita/RevisionRun';
import { seatCtx, useSeatLearner, useSeatLibrary } from '../cogita/seatLearn';
import { SessionPlay } from '../cogita/Sessions';
import { Bar, CogitaContext, PublicContext, useAsync, useBusy, type CogitaCtx } from '../cogita/ui';
import { OnSeat } from './seat';
import type { EntityConfig, FlowConfig, LiveConfig, MapConfig, RevisionConfig, SeatLearnConfig, TableConfig, TopicsConfig } from './cogita';
import { Loading } from '../ui/Loading';

/** Hoch oder im ganzen Fenster: das Ganze. */
const isTall = (ctx: PartContext): boolean => ctx.whole === true || ctx.size.height === 'tall';

const Head = ({ title }: { title: string }) => <h2 className="wk-card-title">{title}</h2>;

/** Ohne Netz, ohne Bündel: ein Satz statt einer leeren Kachel. */
function Waiting({ title, found, gone }: { title: string; found: unknown; gone: string }) {
  return <><Head title={title} />{found === undefined ? <Loading /> : <p className="wk-card-muted">{gone}</p>}</>;
}

export function RevisionView({ config, ctx }: { config: RevisionConfig; ctx: PartContext }) {
  const bundle = useBundle<PublicRevision>(config.library, config.revision, REVISION_BUNDLE);
  const learner = useLocalLearner(config.library);
  const [running, setRunning] = useState(false);
  const shown = useMemo(() => (bundle == null ? null : publicOf(config.library, bundle.explain ?? {})), [bundle, config.library]);
  const source = useMemo(() => (bundle == null ? null : revisionSource(bundle)), [bundle]);
  const title = config.title || bundle?.title || 'Powtórka';
  if (bundle == null || source === null) return <Waiting title={title} found={bundle} gone="Ta powtórka nie jest (już) opublikowana." />;

  if (running || isTall(ctx)) {
    return (
      <PublicContext.Provider value={shown}>
        <RevisionRun lib={null} learner={learner} source={{ ...source, title }} onClose={isTall(ctx) ? undefined : () => setRunning(false)} />
      </PublicContext.Provider>
    );
  }
  const levels = learner === null || source.plan === undefined ? null : levelsOf(source.plan, (key) => learner.marks(key), Date.now());
  const total = bundle.cards.length;
  return (
    <>
      <Head title={title} />
      {bundle.summary !== undefined && ctx.size.width !== 'narrow' && <p>{bundle.summary}</p>}
      <p className="wk-card-muted">{total} kart{levels !== null && levels.known + levels.learning > 0 ? ` · ${LEVEL_LABEL.known}: ${levels.known} · ${LEVEL_LABEL.learning}: ${levels.learning}` : ''}</p>
      {levels !== null && levels.known > 0 && <Bar value={levels.known / Math.max(1, total)} label="Ile już umiesz" />}
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => setRunning(true)}>{levels !== null && levels.known + levels.learning > 0 ? 'Powtórz' : 'Zacznij'}</button>
      </div>
      <p className="wk-card-muted">Bez konta postępy zostają w tej przeglądarce.</p>
    </>
  );
}

export function FlowView({ config, ctx }: { config: FlowConfig; ctx: PartContext }) {
  const bundle = useBundle<PublicFlow>(config.library, config.flow, FLOW_BUNDLE);
  const learner = useLocalLearner(config.library);
  const [playing, setPlaying] = useState(false);
  const content = useMemo(() => (bundle == null ? null : contentOfBundle(bundle, (fileId, from) => publicFileUrl(from ?? config.library, fileId))), [bundle, config.library]);
  const flow = useMemo(() => (bundle == null || content === null ? null : resolveFlow(readFlow(String(bundle.flow.id ?? ''), bundle.flow), content.flow)), [bundle, content]);
  const shown = useMemo(() => (bundle == null ? null : publicOf(config.library, bundle.entities ?? {})), [bundle, config.library]);
  const title = config.title || bundle?.title || 'Przebieg';
  if (bundle == null || content === null || flow === null) return <Waiting title={title} found={bundle} gone="Ten przebieg nie jest (już) opublikowany." />;

  if (playing || isTall(ctx)) {
    return (
      <PublicContext.Provider value={shown}>
        {!isTall(ctx) && <Head title={title} />}
        <FlowPlayer flow={flow} content={content} learner={learner} onClose={isTall(ctx) ? undefined : () => setPlaying(false)} />
      </PublicContext.Provider>
    );
  }
  const saved = learner?.progress.positions.get(flow.id) ?? null;
  return (
    <>
      <Head title={title} />
      <p className="wk-card-muted">{LOOK_LABEL[flow.look]} · {flow.graph.nodes.length} kroków{bundle.cards.length > 0 ? ` · ${bundle.cards.length} pytań` : ''}</p>
      {flow.goals.length > 0 && ctx.size.width !== 'narrow' && <p className="wk-card-muted">Cele: {flow.goals.map((g) => g.title).join(' · ')}</p>}
      <div className="wk-actions">
        <button type="button" className="wk-btn" onClick={() => setPlaying(true)}>{saved !== null ? 'Wróć tam, gdzie skończyłeś' : 'Zacznij'}</button>
      </div>
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

/** Ein veröffentlichter Eintrag als Karte: das Bündel einer eigenen Art, sonst die öffentlichen Felder einer eingebauten. */
type Shown = { readonly kind: 'bundle'; readonly entity: PublicEntity } | { readonly kind: 'plain'; readonly label: string; readonly kindName: string; readonly fields: readonly { label: string; text: string }[] };

function shownOf(json: string, kind: string): Shown | null {
  let doc: { title?: unknown; data?: unknown } = {};
  try { doc = JSON.parse(json) as typeof doc; } catch { return null; }
  const data = typeof doc.data === 'object' && doc.data !== null ? doc.data as Record<string, unknown> : {};
  if (data.format === ENTITY_BUNDLE && typeof data.entity === 'object' && data.entity !== null) return { kind: 'bundle', entity: data.entity as PublicEntity };
  const def = kindOf(kind);
  const fields: { label: string; text: string }[] = [];
  for (const field of def?.fields ?? []) {
    const v = data[field.key];
    if (typeof v === 'string' && v.trim() !== '' && field.type !== 'ref' && field.type !== 'refs') fields.push({ label: field.label, text: v.length > 600 ? `${v.slice(0, 598)}…` : v });
  }
  return { kind: 'plain', label: typeof doc.title === 'string' ? doc.title : def?.label ?? 'Wpis', kindName: def?.label ?? kind, fields };
}

export function EntityCardView({ config, ctx }: { config: EntityConfig; ctx: PartContext }) {
  /* 0109 — ohne eigenen Eintrag: der, den die Seite oben gewählt hat („Wpis z biblioteki"). */
  const subject = useEntitySubject();
  const library = config.library !== '' ? config.library : subject?.library ?? '';
  const entry = config.entry !== '' ? config.entry : subject !== null && subject.library === library ? subject.chosen ?? '' : '';
  const found = useAsync(library === '' || entry === '' ? null
    : () => loadPublishedOne(library, entry).then((r) => shownOf(r.entry.json, r.entry.kind)), [library, entry]);
  const shown = useMemo(() => (found?.kind === 'bundle' ? publicOf(library, { [found.entity.id]: found.entity }) : null), [found, library]);
  if (entry === '' && subject !== null) return <><Head title={config.title || 'Wpis'} /><p className="wk-card-muted">Wybierz wpis u góry strony.</p></>;
  if (entry === '' || library === '') return <><Head title={config.title || 'Wpis'} /><p className="wk-card-muted">Wybierz wpis w ustawieniach modułu — albo ustaw na stronie „Wybór: wpis z biblioteki”.</p></>;
  if (found == null) return <Waiting title={config.title || 'Wpis'} found={found} gone="Ten wpis nie jest (już) opublikowany." />;
  const label = found.kind === 'bundle' ? found.entity.label : found.label;
  const kinds = found.kind === 'bundle' ? found.entity.kinds.join(' · ') : found.kindName;
  const head = <Head title={config.title || label} />;
  if (ctx.size.height === 'strip' && ctx.whole !== true) {
    return <p className="cg-row"><strong>{label}</strong><span className="wk-card-muted">{kinds}</span></p>;
  }
  if (found.kind === 'plain') {
    const fields = isTall(ctx) ? found.fields : found.fields.slice(0, 3);
    return (
      <>
        {head}
        <p className="wk-card-muted">{kinds}</p>
        {fields.map((f) => <p key={f.label}><span className="cg-muted">{f.label}: </span>{f.text}</p>)}
      </>
    );
  }
  const entity = found.entity;
  return (
    <PublicContext.Provider value={shown}>
      {config.title !== '' && head}
      {isTall(ctx) ? <EntityView entity={entity} fileUrl={(fileId, from) => publicFileUrl(from ?? library, fileId)} /> : (
        <EntityView entity={{ ...entity, media: entity.media.filter((m) => m.type === 'image').slice(0, 1), fields: entity.fields.slice(0, 4) }}
          fileUrl={(fileId, from) => publicFileUrl(from ?? library, fileId)} />
      )}
      <p className="wk-card-muted">{kinds}</p>
    </PublicContext.Provider>
  );
}

interface Row {
  readonly id: string;
  readonly label: string;
  readonly kinds: readonly string[];
  readonly cells: ReadonlyMap<string, string>;
}

function rowOf(item: PublishedItem): Row | null {
  const s = summaryOf(item);
  if (s.format !== ENTITY_BUNDLE) return null;
  const cells = new Map<string, string>();
  for (const one of Array.isArray(s.list) ? s.list : []) {
    const { label, text: said } = one as { label?: unknown; text?: unknown };
    if (typeof label === 'string' && typeof said === 'string' && !cells.has(label)) cells.set(label, said);
  }
  return { id: item.entryId, label: titleOf(item), kinds: Array.isArray(s.kinds) ? s.kinds.filter((k): k is string => typeof k === 'string') : [], cells };
}

export function EntityTableView({ config, ctx }: { config: TableConfig; ctx: PartContext }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  /* Wählt die Seite oben einen Eintrag dieser Bibliothek, wählt ein Klick dort — sonst klappt er hier auf. */
  const subject = useEntitySubject();
  const pick = (id: string) => {
    if (subject !== null && subject.library === config.library) { subject.choose(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else setOpen(open === id ? null : id);
  };
  const rows = useAsync(config.library === '' ? null : () => publishedAll(config.library, { kind: 'entity', order: 'sort' })
    .then((items) => items.map(rowOf).filter((r): r is Row => r !== null && (config.kind === '' || r.kinds.some((k) => k.toLowerCase() === config.kind.toLowerCase())))), [config.library, config.kind]);
  const title = config.title || 'Wpisy';
  if (rows == null) return <Waiting title={title} found={rows} gone="Nie udało się wczytać wpisów." />;
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
    <>
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
      {open !== null && <OneEntity library={config.library} entry={open} />}
    </>
  );
}

/** Ein Eintrag, aufgeklappt unter der Tabelle oder dem Thema. */
function OneEntity({ library, entry }: { library: string; entry: string }) {
  const found = useAsync(() => loadPublishedOne(library, entry).then((r) => shownOf(r.entry.json, r.entry.kind)), [library, entry]);
  if (found === undefined) return <Loading label="Wczytywanie…" />;
  if (found === null) return null;
  return (
    <div className="cg-card">
      {found.kind === 'bundle' ? <EntityView entity={found.entity} fileUrl={(fileId, from) => publicFileUrl(from ?? library, fileId)} /> : (
        <>
          <strong>{found.label}</strong>
          {found.fields.map((f) => <p key={f.label}><span className="cg-muted">{f.label}: </span>{f.text}</p>)}
        </>
      )}
    </div>
  );
}

interface TopicNode {
  readonly id: string;
  readonly name: string;
  readonly parent: string | null;
}

export function TopicExplorerView({ config, ctx }: { config: TopicsConfig; ctx: PartContext }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const topics = useAsync(config.library === '' ? null : () => publishedAll(config.library, { kind: 'topic', order: 'sort' }).then((items) => items.map((item): TopicNode => {
    const s = summaryOf(item);
    const parent = typeof s.parent === 'object' && s.parent !== null && typeof (s.parent as { id?: unknown }).id === 'string' ? (s.parent as { id: string }).id : null;
    return { id: item.entryId, name: titleOf(item), parent };
  })), [config.library]);
  const about = useAsync(chosen === null || config.library === '' ? null : () => publishedAll(config.library, { ref: chosen }, 200), [chosen, config.library]);
  const title = config.title || 'Tematy';
  if (topics == null) return <Waiting title={title} found={topics} gone="Nie udało się wczytać tematów." />;

  const known = new Set(topics.map((t) => t.id));
  const root = config.topic !== '' && known.has(config.topic) ? config.topic : null;
  const under = (id: string | null) => topics.filter((t) => (id === null ? t.parent === null || !known.has(t.parent) : t.parent === id));
  const top = under(root);
  /* Der Weg vom Anfang zum gewählten Thema — höchstens zwanzig Stufen (ein Kreis in den Daten hält hier nicht fest). */
  const path: TopicNode[] = [];
  let step = chosen === null ? undefined : topics.find((t) => t.id === chosen);
  while (step !== undefined && step.id !== root && path.length < 20) {
    path.unshift(step);
    const parent: string | null = step.parent;
    step = parent === null ? undefined : topics.find((t) => t.id === parent);
  }

  if (ctx.size.height === 'strip' && ctx.whole !== true) {
    return (
      <p className="cg-row">
        <strong>{title}</strong><span className="wk-card-muted">{topics.length} tematów</span>
        {ctx.openWhole !== undefined && <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>Przeglądaj</button>}
      </p>
    );
  }
  const chips = (list: readonly TopicNode[]) => (
    <div className="cg-chips">{list.map((t) => <button key={t.id} type="button" className={`cg-chip${chosen === t.id ? ' is-on' : ''}`} onClick={() => { setChosen(t.id); setOpen(null); }}>{t.name}</button>)}</div>
  );
  const items = (about ?? []).filter((item) => item.kind !== 'topic');
  return (
    <>
      <Head title={title} />
      {path.length > 0 && (
        <nav className="cg-row cg-muted" aria-label="Ścieżka tematu">
          <button type="button" className="wk-link-btn" onClick={() => { setChosen(null); setOpen(null); }}>Wszystkie</button>
          {path.map((t) => <span key={t.id}>› <button type="button" className="wk-link-btn" onClick={() => setChosen(t.id)}>{t.name}</button></span>)}
        </nav>
      )}
      {chips(chosen === null ? top : under(chosen))}
      {chosen !== null && under(chosen).length === 0 && <p className="wk-card-muted">Bez podtematów.</p>}
      {chosen !== null && isTall(ctx) && (
        <section>
          {about === undefined ? <Loading label="Wczytywanie…" /> : items.length === 0 ? <p className="wk-card-muted">Nic jeszcze nie jest opublikowane w tym temacie.</p> : (
            <ul className="cg-plain-list">{items.map((item) => <li key={item.entryId}><button type="button" className="cg-ref" onClick={() => setOpen(open === item.entryId ? null : item.entryId)}>{titleOf(item)}</button> <span className="cg-muted">{kindOf(item.kind)?.label ?? ''}</span></li>)}</ul>
          )}
          {open !== null && <OneEntity library={config.library} entry={open} />}
        </section>
      )}
      {chosen !== null && !isTall(ctx) && about != null && items.length > 0 && <p className="wk-card-muted">{items.length} wpisów w tym temacie{ctx.openWhole !== undefined && <> — <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>zobacz</button></>}</p>}
    </>
  );
}

export function KnowledgeMapView({ config, ctx }: { config: MapConfig; ctx: PartContext }) {
  const bundle = useBundle<PublicRevision>(config.library, config.revision, REVISION_BUNDLE);
  const learner = useLocalLearner(config.library);
  const [chosen, setChosen] = useState<string | null>(null);
  const [learning, setLearning] = useState<string | null>(null);
  const shown = useMemo(() => (bundle == null ? null : publicOf(config.library, bundle.explain ?? {})), [bundle, config.library]);

  const graph = useMemo(() => {
    if (bundle == null) return null;
    const entities = bundle.explain ?? {};
    const ids = [...new Set(bundle.cards.map((c) => c.entity).filter((id): id is string => id !== undefined && entities[id] !== undefined))].slice(0, 200);
    const inside = new Set(ids);
    const edges = (bundle.deps ?? []).filter((d) => inside.has(d.parent) && inside.has(d.child)).map((d) => ({ from: d.parent, to: d.child }));
    return { ids, edges, place: ringsOf(ids, edges) };
  }, [bundle]);

  const source = useMemo(() => {
    if (learning === null || bundle == null) return null;
    const of = bundle.cards.filter((c) => c.entity === learning);
    return { plan: readPlan(of, null, { mode: 'once', order: 'random' }), cards: of, deps: bundle.deps ?? [], title: bundle.explain?.[learning]?.label ?? 'Powtórka' };
  }, [learning, bundle]);

  const title = config.title || 'Mapa wiedzy';
  if (bundle == null || graph === null) return <Waiting title={title} found={bundle} gone="Ta powtórka nie jest (już) opublikowana." />;

  const now = Date.now();
  const cardsOf = (id: string) => bundle.cards.filter((c) => c.entity === id);
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
      <PublicContext.Provider value={shown}>
        <RevisionRun lib={null} learner={learner} source={source} onClose={() => setLearning(null)} />
      </PublicContext.Provider>
    );
  }

  const tall = isTall(ctx);
  const entity = chosen === null ? null : bundle.explain?.[chosen] ?? null;
  return (
    <PublicContext.Provider value={shown}>
      <Head title={title} />
      <p className="wk-card-muted">{known} z {graph.ids.length} umiesz · przerywana obwódka — możesz tam wejść; mgła — jeszcze nieodkryte.</p>
      <div className={`cg-explore${tall ? '' : ' is-small'}`}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {graph.edges.map((e, i) => {
            const a = graph.place.get(e.from);
            const b = graph.place.get(e.to);
            return a === undefined || b === undefined ? null : <line key={i} x1={a.x * 100} y1={a.y * 100} x2={b.x * 100} y2={b.y * 100} />;
          })}
        </svg>
        {graph.ids.map((id) => {
          const at = graph.place.get(id) ?? { x: 0.5, y: 0.5 };
          const state = fog.get(id) ?? 'fog';
          const label = bundle.explain?.[id]?.label ?? '?';
          return (
            <button key={id} type="button" className={`cg-explore-node is-${state}`} style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
              disabled={state === 'fog'} title={state === 'fog' ? 'Jeszcze w mgle' : `${label} · ${Math.round(shareOf(knowness(id)) * 100)}%`}
              onClick={() => setChosen(id)}>
              {tall ? label : label.slice(0, 14)}
            </button>
          );
        })}
      </div>
      {entity !== null && chosen !== null && (
        <div className="cg-card">
          <EntityView entity={tall ? entity : { ...entity, media: [], fields: entity.fields.slice(0, 2) }} fileUrl={(fileId, from) => publicFileUrl(from ?? config.library, fileId)} />
          {cardsOf(chosen).length > 0 && <button type="button" className="wk-btn" onClick={() => setLearning(chosen)}>Ucz się tego ({cardsOf(chosen).length} kart)</button>}
        </div>
      )}
    </PublicContext.Provider>
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
  const levels = cards == null || learner === null ? null : levelsOf(readPlan(cards, null, {}), (key) => learner.marks(key), now);
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
