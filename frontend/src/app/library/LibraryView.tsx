/**
 * DIE BIBLIOTHEK IM WARSZTAT (0064).
 *
 * <code>
 *   #/workspace/library                       die Bibliotheken
 *   #/workspace/library/&lt;id&gt;                  eine, mit ihren Reitern (Teksty, …)
 *   #/workspace/library/&lt;id&gt;/cytaty           ein Reiter
 *   #/workspace/library/&lt;id&gt;/&lt;eintrag&gt;        ein Eintrag, ganz
 *   #/workspace/library/&lt;id&gt;/nowy/&lt;art&gt;      ein neuer
 *   #/workspace/library/&lt;id&gt;/stare           Einträge alter Arten (2026-10-23), zum Löschen
 * </code>
 *
 * 2026-10-23 — DIE BIBLIOTHEK HÄLT NUR QUELLEN: Źródła, Cytaty, Osoby (dazu
 * die Mapa, Import / eksport, Ustawienia). 2026-10-26 — und Muzyka: die Werke
 * der Musik (Utwory, Nuty, Nagrania, Płyty), Werke wie die anderen, eigener Reiter. Texte schreibt man im Skryptorium,
 * Komentarze und Ordnungen sind eigene Arten in Nauka; Themen gibt es keine.
 *
 * 2026-10-22 — alle lesbaren Bibliotheken zusammen: geöffnet wird eine,
 * die anderen gleichen im Hintergrund ab; Verweise, Suche und Rückverweise
 * reichen über sie hinaus (`LibraryStore.peers`).
 *
 * Jeder Schritt ist eine Adresse — wie bei den Bausteinen: ein Zitat, das
 * man gerade bearbeitet, lässt sich als Link weitergeben (an jemanden, der
 * die Bibliothek auch lesen darf).
 */

import { useEffect, useMemo, useState } from 'react';

import { loadAreas, type AreaRow } from '../areas/area';
import { ensurePrivateArea } from '../calendar/agenda';
import { AreaPick } from '../areas/AreaPick';
import { ScanBook } from './BookLookup';
import { useCrumbs } from '../shell/crumbTrail';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import {
  createLibrary, deleteLibrary, isUuid, libraryKindOf, loadLibraries, openedLibraryNames, openLibraries, renameLibrary, settleLibrary, type OpenLibrary
} from './library';
import { originOf } from './libraryCite';
import { LibraryEditor } from './LibraryEditor';
import { PassageList } from './LibraryRelations';
import { parseBible } from './bible';
import { exportLibrary, libraryDescription, planLibraryImport } from './libraryJson';
import { ids, isLibraryKind, isMusic, kindOf, LIBRARY_KINDS, MUSIC_GROUP, quoteOrder, str, WORK_TYPES, type LibEntry } from './libraryKinds';
import { filesOf, musicPeople, tracksOf } from './music';
import { storeOf, useLibraryStore, type Entry, type LibraryStore } from './libraryStore';
import { TEXT_KINDS } from './sourceText';
import { WorkWithTextButton, type SourceTargets } from './SourceBox';
import { audienceWords } from './LibraryAreaBox';
import { useMe, type Me } from '../core/me';
import { viewPath } from '../routes';
import { LibraryMap } from './LibraryMap';
import { PickBar, PickBox, usePicked } from './EntryPick';
import { OldEntries, oldEntriesOf } from './OldEntries';
import { WorkspaceError, type Who } from '../core/session';
import { Loading } from '../ui/Loading';
import { later } from '../ui/later';
import { t as tApp, useT } from '../core/i18n';

/* 2026-10-24 — der Czytnik eines Textes kommt erst, wenn einer gelesen wird. */
const LiturgyHome = later(() => import('./liturgy/LiturgyHome').then((m) => m.LiturgyHome));
const SourceReader = later(() => import('./SourceReader').then((m) => m.SourceReader));

/** Ein Reiter: Wort in der Adresse, Art — und (2026-10-26) welche Einträge der Art er zeigt. */
interface Tab {
  readonly slug: string;
  readonly kind: string;
  readonly label?: string;
  readonly only?: (entry: LibEntry) => boolean;
}

/** Die Reiter einer Bibliothek (2026-10-23: nur Quellen; 2026-10-26: die Musik für sich). */
export const TABS: readonly Tab[] = [
  { slug: 'zrodla', kind: 'work', only: (e) => !isMusic(e.data) },
  { slug: 'muzyka', kind: 'work', get label() { return tApp('libraryKinds.group.music'); }, only: (e) => isMusic(e.data) },
  { slug: 'cytaty', kind: 'quote' },
  { slug: 'osoby', kind: 'person' }
];

const inTab = (tab: Tab) => (entry: LibEntry): boolean => tab.only === undefined || tab.only(entry);

/** Was man unter „Muzyka" anlegt — ein neues Werk mit seinem Rodzaj. */
const MUSIC_NEW = WORK_TYPES.filter((t) => t.group === MUSIC_GROUP);

const tabOfKind = (kind: string) => TABS.find((t) => t.kind === kind)?.slug ?? 'zrodla';

export function LibraryView({ who, trail }: { who: Who; trail: readonly string[] }) {
  const me = useMe(who);
  const t = useT();
  if (me === undefined) return <Loading label={t('common.loading')} />;
  if (me === null) return <p className="wk-note">{t('library.view.noKey')}</p>;
  return <Libraries me={me} trail={trail} />;
}

/**
 * 0110 — NUR DIE BIBLIOTHEKEN: Sammlungen von Büchern. Die Bazy wiedzy von
 * Cogita stehen daneben, in „Nauka" (`#/workspace/learn`) — eine Adresse
 * hierher, die eine nennt, führt dorthin.
 */
function Libraries({ me, trail }: { me: Me; trail: readonly string[] }) {
  const [libraries, setLibraries] = useState<readonly OpenLibrary[] | null>(null);
  const [knowledge, setKnowledge] = useState<ReadonlySet<string>>(new Set());
  const [writing, setWriting] = useState<ReadonlySet<string>>(new Set());
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  /* 2026-10-25 — nur neu zeichnen, wenn eine Baza wiedzy da ist; `tick` lädt alles neu (und lief so im Kreis). */
  const [, setSynced] = useState(0);
  const t = useT();

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [rows, found] = await Promise.all([loadLibraries(), loadAreas()]);
        const opened = await openLibraries(me.ring, rows.libraries);
        if (!alive) return;
        const books = opened.filter((one) => libraryKindOf(one) === 'books' || libraryKindOf(one) === 'liturgy');
        setLibraries(books);
        /* Die anderen lesbaren Bibliotheken im Hintergrund — sie sind die Nachbarn der offenen. */
        for (const one of books) void storeOf(me.ring, one).sync().catch(() => undefined);
        setKnowledge(new Set(opened.filter((one) => libraryKindOf(one) === 'knowledge').map((one) => one.libraryId)));
        setWriting(new Set(opened.filter((one) => libraryKindOf(one) === 'writing').map((one) => one.libraryId)));
        /* 2026-10-22 (Schritt 11) — und die Bazy wiedzy: worauf ein Kazanie in ihnen verweist (ein Słowo, ein Widok), findet es so. */
        for (const one of opened.filter((o) => libraryKindOf(o) === 'knowledge')) void storeOf(me.ring, one).sync().then(() => { if (alive) setSynced((n) => n + 1); }, () => undefined);
        setAreas(found.areas);
        setFailed(null);
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : t('library.view.loadFailed'));
      }
    })();
    return () => { alive = false; };
  }, [me.ring, tick]);

  const libraryId = trail[0];
  const current = libraries?.find((one) => one.libraryId === libraryId) ?? null;

  useCrumbs(current === null ? [] : [{
    label: current.name,
    href: viewPath('library', current.libraryId),
    beside: (libraries ?? []).filter((one) => one.libraryId !== current.libraryId).map((one) => ({ label: one.name, href: viewPath('library', one.libraryId) }))
  }]);

  if (failed !== null) return <p className="wk-error">{failed}</p>;
  if (libraries === null) return <Loading label={t('common.loading')} />;

  if (libraryId !== undefined) {
    if (current === null && knowledge.has(libraryId)) return <p className="wk-note">{t('library.view.isKnowledge')} <a href={viewPath('knowledge', libraryId)}>{t('library.view.openKnowledge')}</a></p>;
    if (current === null && writing.has(libraryId)) return <p className="wk-note">{t('library.view.isScriptorium')} <a href={viewPath('scriptorium', libraryId)}>{t('library.view.openScriptorium')}</a></p>;
    if (current === null) return <p className="wk-empty">{t('library.view.missing')} <a href={viewPath('library')}>{t('library.view.allLibraries')}</a></p>;
    if (libraryKindOf(current) === 'liturgy') return <LiturgyHome me={me} library={current} trail={trail.slice(1)} />;
    return <LibraryHome me={me} library={current} libraries={libraries.filter((l) => libraryKindOf(l) === 'books')} areas={areas} trail={trail.slice(1)} onChanged={() => setTick((n) => n + 1)} />;
  }

  return <LibraryList me={me} libraries={libraries} areas={areas} onChanged={() => setTick((n) => n + 1)} />;
}

/* -- Die Bibliotheken ------------------------------------------------------------------------ */

function LibraryList({ me, libraries, areas, onChanged }: {
  me: Me;
  libraries: readonly OpenLibrary[];
  areas: readonly AreaRow[];
  onChanged: () => void;
}) {
  const writable = areas.filter((a) => (a.myLevel === 'write' || a.myLevel === 'admin') && a.heldEpochs > 0);
  const personal = areas.find((a) => a.personal === true);
  const [name, setName] = useState('');
  const [collectionKind, setCollectionKind] = useState<'books' | 'liturgy'>('books');
  const [areaId, setAreaId] = useState(personal?.areaId ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const t = useT();

  const create = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const area = areaId === '' ? await ensurePrivateArea(me.ring, me.person, areas) : areaId;
      const id = await createLibrary(me.ring, area, name.trim() === '' ? t(collectionKind === 'liturgy' ? 'liturgy.name' : 'library.list.defaultName') : name, collectionKind);
      onChanged();
      window.location.hash = viewPath('library', id);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('library.list.createFailed'));
    } finally {
      setBusy(false);
    }
  };

  const areaName = (id: string) => areas.find((a) => a.areaId === id)?.personal === true ? t('library.list.onlyYou') : areas.find((a) => a.areaId === id)?.name ?? t('library.list.area');

  return (
    <>
      <h1 className="wk-h1">{t('library.list.title')}</h1>
      <p className="wk-lede">{t('library.list.lede')}</p>

      {libraries.length > 0 && (
        <ul className="lib-libraries">
          {libraries.map((one) => (
            <li key={one.libraryId}>
              <a className="lib-library" href={viewPath('library', one.libraryId)}>
                <span className="lib-library-name">{one.name}</span>
                {libraryKindOf(one) === 'liturgy' && <span className="lib-library-meta">{t('liturgy.name')}</span>}
                <span className="lib-library-meta">{t('library.list.meta', { entries: t('library.list.entries', { count: one.entries }), area: areaName(one.areaId), who: audienceWords(one) })}{one.writes ? '' : t('library.list.readOnly')}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <form className="wk-form lib-new" onSubmit={(e) => { e.preventDefault(); void create(); }}>
        <h2 className="wk-h2">{libraries.length === 0 ? t('library.list.createFirst') : t('library.list.createNew')}</h2>
        <label className="wk-field"><span>{t('liturgy.collectionType')}</span><select value={collectionKind} onChange={e => setCollectionKind(e.target.value as 'books' | 'liturgy')}><option value="books">{t('liturgy.sourcesCollection')}</option><option value="liturgy">{t('liturgy.name')}</option></select></label>
        <label className="wk-field">
          <span>{t('library.list.name')}</span>
          <input value={name} placeholder={t('library.list.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="wk-field">
          <span>{t('library.list.whoSees')}</span>
          <AreaPick
            label={t('library.list.whoSees')} value={areaId} onChange={setAreaId} areas={areas} only={writable.filter((a) => a.personal !== true)}
            extras={[{ value: '', label: personal === undefined ? t('library.list.onlyMeNew') : t('library.list.onlyMe') }]}
          />
        </label>
        <p className="wk-hint">{t('library.list.sharedHint')}</p>
        {failed !== null && <p className="wk-error">{failed}</p>}
        <div className="wk-actions"><button type="submit" className="wk-btn" disabled={busy}>{busy ? t('library.list.creating') : t('library.list.create')}</button></div>
      </form>
    </>
  );
}

/* -- Eine Bibliothek -------------------------------------------------------------------------- */

function LibraryHome({ me, library, libraries, areas, trail, onChanged }: {
  me: Me;
  library: OpenLibrary;
  /** Alle Bibliotheken des Kontos (2026-10-24: wohin ein Text, ein Zitat aus dem Czytnik geht). */
  libraries: readonly OpenLibrary[];
  areas: readonly AreaRow[];
  trail: readonly string[];
  onChanged: () => void;
}) {
  const { store, failed } = useLibraryStore(me.ring, library);
  const t = useT();
  const first = trail[0] ?? 'zrodla';

  if (store === null) return null;
  if (failed !== null && !store.loaded) return <p className="wk-error">{failed}</p>;
  if (!store.loaded) return <p className="wk-lede">{t('library.home.opening')}</p>;

  /* 2026-10-24 — der Text eines Werks im Czytnik. */
  if (isUuid(first) && trail[1] === 'tekst') {
    return <SourceReader store={store} library={library} workId={first} at={trail.slice(2).join('/')} writable={libraries.filter((l) => l.writes)} />;
  }
  /* Ein Eintrag — oder ein neuer. */
  if (isUuid(first)) {
    return <LibraryEditor store={store} library={library} entryId={first} kind={store.get(first)?.kind ?? null} sources={{ libraries, storeFor: (row) => storeOf(me.ring, row) }} />;
  }
  if (first === 'nowy' && isLibraryKind(trail[1] ?? '')) {
    return <LibraryEditor store={store} library={library} entryId={null} kind={trail[1]!} preset={presetFrom(trail[2])} />;
  }

  const tab = first === 'ustawienia' || first === 'json' || first === 'mapa' || first === 'stare' ? first : (TABS.find((t) => t.slug === first)?.slug ?? 'zrodla');
  /* 2026-10-23 — Einträge der Arten, die die Bibliothek nicht mehr hält: zum Durchsehen und Löschen. */
  /* 2026-10-24 — und die Texte der Werke (Verzeichnis und Teile): sie gehören hierher, auch ohne eigenen Reiter. */
  const known = (kind: string) => isLibraryKind(kind) || TEXT_KINDS.has(kind);
  const old = oldEntriesOf(store, known).length;

  return (
    <>
      <h1 className="wk-h1">{library.name}</h1>
      {store.unreadable > 0 && <p className="wk-note">{t('library.home.sealed', { count: store.unreadable })}</p>}
      <SearchAll store={store} library={library} />
      <nav className="wk-tabs lib-tabs" aria-label={t('library.home.sections')}>
        {TABS.map((tb) => (
          <a key={tb.slug} className={tb.slug === tab ? 'wk-tab wk-tab-on' : 'wk-tab'} href={viewPath('library', library.libraryId, tb.slug)}>
            {tb.label ?? kindOf(tb.kind)!.plural} <span className="lib-count">{store.ofKind(tb.kind).filter(inTab(tb)).length}</span>
          </a>
        ))}
        <a className={tab === 'mapa' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={viewPath('library', library.libraryId, 'mapa')}>{t('library.home.map')}</a>
        <a className={tab === 'json' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={viewPath('library', library.libraryId, 'json')}>{t('library.home.json')}</a>
        <a className={tab === 'ustawienia' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={viewPath('library', library.libraryId, 'ustawienia')}>{t('library.home.settings')}</a>
        {(old > 0 || tab === 'stare') && <a className={tab === 'stare' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={viewPath('library', library.libraryId, 'stare')}>{t('library.home.old')} <span className="lib-count">{old}</span></a>}
      </nav>
      <div className="wk-panel">
        {tab === 'ustawienia' ? <Settings me={me} store={store} library={library} areas={areas} onChanged={onChanged} />
          : tab === 'json' ? <LibraryJson store={store} library={library} />
          : tab === 'mapa' ? <LibraryMap store={store} libraryId={library.libraryId} />
          : tab === 'stare' ? <OldEntries store={store} known={known} writes={library.writes} where={t('library.home.oldWhere')} />
          : <KindList store={store} library={library} tab={TABS.find((t) => t.slug === tab)!} sources={{ libraries, storeFor: (row) => storeOf(me.ring, row) }} />}
      </div>
    </>
  );
}

/** `nowy/quote/work=<id>` — ein neues Zitat mit schon gewähltem Werk. */
function presetFrom(part: string | undefined): Record<string, unknown> {
  if (part === undefined) return {};
  const out: Record<string, unknown> = {};
  for (const pair of part.split('&')) {
    const [k, v] = pair.split('=');
    if (k !== undefined && v !== undefined && /^[a-z]+$/i.test(k)) out[k] = decodeURIComponent(v);
  }
  return out;
}

/** Suchen über alles — Ergebnisse unter dem Feld, gleich welcher Art. */
function SearchAll({ store, library }: { store: LibraryStore; library: OpenLibrary }) {
  const [query, setQuery] = useState('');
  const t = useT();
  /* 2026-10-22 — eine Stelle der Schrift („Dz 1:14", „Psalm 23"): dazu, was auf sie zeigt. */
  const spans = useMemo(() => (/\d/.test(query) ? parseBible(query) : []), [query]);
  const found = useMemo(() => (query.trim().length < 2 ? [] : store.search(query).slice(0, 12)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, store, store.revision]);
  return (
    <div className="lib-search">
      <div className="lib-search-bar">
        <input type="search" value={query} placeholder={t('library.search.placeholder')} onChange={(e) => setQuery(e.target.value)} aria-label={t('library.search.label')} />
        <ScanBook store={store} library={library} onSearch={setQuery} />
      </div>
      {found.length > 0 && (
        <ul className="lib-search-hits">
          {found.map((entry) => (
            <li key={entry.id}>
              <a href={viewPath('library', entry.libraryId, entry.id)}>
                <span className="lib-option-kind">{kindOf(entry.kind)?.label}</span> {lineOf(entry, store)}
              </a>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && found.length === 0 && spans.length === 0 && <p className="wk-hint">{t('library.search.none')}</p>}
      {spans.length > 0 && <div className="lib-search-passage"><PassageList store={store} spans={spans} /></div>}
    </div>
  );
}

/** Was in einer Liste unter dem Titel steht. */
function lineOf(entry: LibEntry, store: LibraryStore): string {
  const d = entry.data;
  switch (entry.kind) {
    case 'quote': return `„${store.title(entry)}” — ${originOf(entry, store)}`;
    case 'work': {
      /* 2026-10-26 — Musik: der Komponist (beim Nagranie ohne ihn die Ausführenden). */
      const people = isMusic(d) ? musicPeople(entry, store) : ids(d, 'authors');
      const authors = people.map((id) => store.get(id)).filter((p): p is Entry => p !== undefined).map((p) => store.title(p));
      return [authors.join(', '), store.title(entry), str(d, 'year')].filter(Boolean).join(' · ');
    }
    default: return store.title(entry);
  }
}

function KindList({ store, library, tab, sources }: { store: LibraryStore; library: OpenLibrary; tab: Tab; sources?: SourceTargets }) {
  const kind = tab.kind;
  const def = kindOf(kind)!;
  const music = tab.slug === 'muzyka';
  const [query, setQuery] = useState('');
  /* 2026-10-22 — auch die anderen lesbaren Bibliotheken (jede Zeile sagt, in welcher sie liegt). */
  const [everywhere, setEverywhere] = useState(false);
  const t = useT();
  const peers = store.peers();
  const here = (e: Entry) => everywhere || e.libraryId === store.libraryId;

  const all = (everywhere ? store.readable().filter((e) => e.kind === kind) : store.ofKind(kind)).filter(inTab(tab));

  let list = query.trim() === '' ? all : store.search(query, [kind]).filter(here).filter(inTab(tab));
  /* 2026-10-22 — Zitate nach Werk und Stelle (die Schrift nach dem Kanon), nicht nach dem Wortlaut ihrer Herkunft. */
  const sortKey = (e: Entry) => (kind === 'quote' ? quoteOrder(e, store) : lineOf(e, store).toLowerCase());
  list = [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b), t.locale));

  const add = viewPath('library', library.libraryId, 'nowy', kind);
  /* 2026-10-23 — zaznaczyć wiele i usunąć (tylko własne wpisy tej biblioteki). */
  const { picked, toggle, set } = usePicked();

  return (
    <>
      <div className="lib-toolbar">
        <input type="search" value={query} placeholder={t('library.kindList.search', { what: (tab.label ?? def.plural).toLowerCase() })} onChange={(e) => setQuery(e.target.value)} aria-label={t('library.kindList.search', { what: tab.label ?? def.plural })} />
        {peers.length > 0 && (
          <label className="pe-check">
            <input type="checkbox" checked={everywhere} onChange={(e) => setEverywhere(e.target.checked)} />
            <span>{t('library.kindList.everywhere', { n: peers.length })}</span>
          </label>
        )}
        {library.writes && !music && <a className="wk-btn" href={add}>+ {def.label}</a>}
        {/* 2026-10-26 — unter „Muzyka" ein neues Werk mit seinem Rodzaj: er entscheidet, welche Felder es hat. */}
        {library.writes && music && MUSIC_NEW.map((t) => <a key={t.value} className="wk-btn" href={viewPath('library', library.libraryId, 'nowy', 'work', `workType=${t.value}`)}>+ {t.label}</a>)}
        {/* 2026-10-24 — ein Werk mit seinem ganzen Text aus einem Dokument (`SourceBox.tsx`, `sourceImport.ts`). */}
        {kind === 'work' && !music && <WorkWithTextButton store={store} library={library} targets={sources} />}
      </div>
      <p className="wk-hint">{music ? t('library.kindList.musicHint') : def.says}</p>

      {list.length === 0 ? (
        <p className="wk-empty">{all.length === 0 ? t('library.kindList.empty') : t('library.kindList.noMatch')}</p>
      ) : (
        <ul className="lib-list">
          {list.map((entry) => (
            <li key={entry.id} className={library.writes ? 'has-pick' : undefined}>
              {library.writes && (entry.libraryId === store.libraryId ? <PickBox checked={picked.has(entry.id)} label={store.title(entry)} onToggle={() => toggle(entry.id)} /> : <span />)}
              <a className="lib-row" href={viewPath('library', entry.libraryId, entry.id)}>
                <span className="lib-row-title">
                  {kind === 'quote' ? <q>{store.title(entry)}</q> : store.title(entry)}
                  {entry.libraryId !== store.libraryId && <span className="lib-badge is-implicit">{openedLibraryNames().get(entry.libraryId) ?? t('library.kindList.otherLibrary')}</span>}
                </span>
                <span className="lib-row-meta">{metaOf(entry, store)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <LibraryJson key={tab.slug} store={store} library={library} only={kind} filter={tab.only} label={tab.label} />
      <PickBar store={store} picked={picked} all={list.filter((e) => e.libraryId === store.libraryId).map((e) => e.id)} onPicked={set} writes={library.writes} />
    </>
  );
}

function metaOf(entry: Entry, store: LibraryStore): string {
  const d = entry.data;
  switch (entry.kind) {
    case 'quote': return originOf(entry, store);
    case 'work': {
      /* 2026-10-26 — Musik: Rodzaj, Katalog, Obsada, wie viele Spuren oder Dateien, der Schlüssel. */
      if (isMusic(d)) {
        const type = WORK_TYPES.find((t) => t.value === str(d, 'workType'))?.label ?? '';
        const tracks = tracksOf(d).length;
        const files = filesOf(d).length;
        return [type, str(d, 'catalogue'), str(d, 'voicing'), tracks === 0 ? '' : tApp('library.meta.tracks', { count: tracks }), files === 0 ? '' : tApp('library.meta.files', { count: files }), entry.key === undefined ? '' : `[@${entry.key}]`].filter(Boolean).join(' · ');
      }
      const quotes = store.backlinks(entry.id).filter((e) => e.kind === 'quote').length;
      const number = str(d, 'libraryNumber');
      return [number === '' ? '' : tApp('library.meta.number', { number }), lineOf(entry, store).replace(`${store.title(entry)} · `, ''), quotes > 0 ? tApp('library.meta.quotes', { count: quotes }) : '', entry.key === undefined ? '' : `[@${entry.key}]`].filter(Boolean).join(' · ');
    }
    case 'person': return [str(d, 'years'), tApp('library.meta.sources', { count: store.backlinks(entry.id).filter((e) => e.kind === 'work').length })].filter(Boolean).join(' · ');
    default: return '';
  }
}

/* -- Einstellungen ---------------------------------------------------------------------------- */

function Settings({ me, store, library, areas, onChanged }: { me: Me; store: LibraryStore; library: OpenLibrary; areas: readonly AreaRow[]; onChanged: () => void }) {
  const [name, setName] = useState(library.name);
  const [understood, setUnderstood] = useState(false);
  const published = store.all().filter((e) => e.publishedAs !== null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const area = areas.find((a) => a.areaId === library.areaId);
  const t = useT();

  const act = async (todo: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try { await todo(); onChanged(); } catch (e) { setFailed(e instanceof WorkspaceError ? e.message : t('library.settings.failed')); } finally { setBusy(false); }
  };

  return (
    <>
      <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void act(() => renameLibrary(me.ring, library, name)); }}>
        <label className="wk-field"><span>{t('library.list.name')}</span><input value={name} disabled={!library.writes} onChange={(e) => setName(e.target.value)} /></label>
        <p className="wk-hint">{t(library.writes ? 'library.settings.area' : 'library.settings.areaReadOnly', { area: area?.personal === true ? t('library.list.onlyYou') : area?.name ?? t('library.settings.unknownArea') })}</p>
        {library.writes && <div className="wk-actions"><button type="submit" className="wk-btn" disabled={busy || name.trim() === ''}>{t('library.settings.saveName')}</button></div>}
      </form>

      <section className="wk-form">
        <h2 className="wk-h2">{t('library.settings.whoSees')}</h2>
        <p>{t('library.settings.seenBy', { who: audienceWords(library) })}</p>
        {/* 2026-10-23 — statt Porządki: wer schreibt, bestätigt die Regel des Bereichs (vorher liest ein öffentlicher Bereich nichts offen). */}
        <SettleBox store={store} library={library} busy={busy} understood={understood} onUnderstood={setUnderstood} onSettle={() => void act(() => settleLibrary(library.libraryId))} />
        {library.writes && published.length > 0 && (
          <div className="wk-note">
            <p>{t('library.settings.oldCopies', { count: published.length })}</p>
            <div className="wk-actions"><button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={() => void act(() => store.withdraw(published.map((e) => e.id)))}>{t('library.settings.withdraw')}</button></div>
          </div>
        )}
      </section>

      {library.writes && (
        <section className="wk-form lib-danger">
          <h2 className="wk-h2">{t('library.settings.delete')}</h2>
          <p className="wk-hint">{t('library.settings.deleteHint')}</p>
          <label className="wk-field"><span>{t('library.settings.deleteConfirm')}</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
          <div className="wk-actions">
            <button type="button" className="wk-btn lib-btn-danger" disabled={busy || confirm.trim() !== library.name.trim()}
              onClick={() => void act(async () => { await deleteLibrary(library.libraryId); window.location.hash = viewPath('library'); })}>
              {t('library.settings.deleteForever')}
            </button>
          </div>
        </section>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </>
  );
}

/**
 * 2026-10-23 — DIE REGEL DES BEREICHS BESTÄTIGEN (statt Porządki): eine
 * Bibliothek von vor dem 22.10. liest bis dahin niemand ausserhalb des
 * Bereichs; gesagt wird vorher, wer sie danach liest.
 */
export function SettleBox({ store, library, busy, understood, onUnderstood, onSettle }: {
  store: LibraryStore;
  library: OpenLibrary;
  busy: boolean;
  understood: boolean;
  onUnderstood: (on: boolean) => void;
  onSettle: () => void;
}) {
  const t = useT();
  if (!library.writes || library.areaRuleAt != null) return null;
  return (
    <div className="wk-note" data-settle="">
      <p>
        {t('library.settle.before')}
        {library.areaPublic === true
          ? ` ${t('library.settle.public', { n: store.all().length })}`
          : ` ${t('library.settle.notPublic')}`}
      </p>
      <label className="pe-check"><input type="checkbox" checked={understood} onChange={(e) => onUnderstood(e.target.checked)} /><span>{t('library.settle.understood')}</span></label>
      <div className="wk-actions"><button type="button" className="wk-btn" disabled={busy || !understood} onClick={onSettle}>{t('library.settle.confirm')}</button></div>
    </div>
  );
}

/* -- JSON ------------------------------------------------------------------------------------------ */

/** `only`: unter einer Liste — nur diese Art (mit dem, worauf sie zeigt, beim Import). */
function LibraryJson({ store, library, only, filter, label }: {
  store: LibraryStore;
  library: OpenLibrary;
  only?: string;
  /** 2026-10-26 — nur diese Einträge der Art (der Reiter Muzyka: die Werke der Musik). */
  filter?: (entry: LibEntry) => boolean;
  label?: string;
}) {
  const [kinds, setKinds] = useState<readonly string[]>(only === undefined ? LIBRARY_KINDS.map((k) => k.kind) : [only]);
  const onlyDef = only === undefined ? undefined : kindOf(only);
  const onlyName = (label ?? onlyDef?.plural ?? '').toLowerCase();
  const t = useT();

  const preview = (doc: unknown): JsonPreview | { error: string } => {
    const planned = planLibraryImport(doc, store);
    return 'error' in planned ? planned : { lines: planned.lines, warnings: planned.warnings };
  };

  return (
    <>
      {only === undefined && <fieldset className="lib-kinds">
        <legend>{t('library.json.what')}</legend>
        {LIBRARY_KINDS.map((k) => (
          <label key={k.kind} className="pe-check">
            <input type="checkbox" checked={kinds.includes(k.kind)} onChange={(e) => setKinds(e.target.checked ? [...kinds, k.kind] : kinds.filter((x) => x !== k.kind))} />
            <span>{k.plural} ({store.ofKind(k.kind).length})</span>
          </label>
        ))}
      </fieldset>}
      <JsonPanel
        summary={onlyDef === undefined ? t('library.json.summary') : t('library.json.summaryKind', { kind: onlyName })}
        lead={onlyDef === undefined
          ? <>{t('library.json.lead')}</>
          : <>{t('library.json.leadKind', { kind: onlyDef.plural })}</>}
        fileName={`${t('library.json.fileName')}-${library.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}${only === undefined ? '' : `-${only}`}.json`}
        exportDoc={() => exportLibrary(library.name, store.all().filter((e) => kinds.includes(e.kind) && isLibraryKind(e.kind) && (filter === undefined || filter(e))), store)}
        description={libraryDescription}
        preview={preview}
        importLabel={t('library.json.import')}
        onImport={async (doc, stage) => {
          if (!library.writes) throw new WorkspaceError(t('library.json.readOnly'));
          const planned = planLibraryImport(doc, store);
          if ('error' in planned) throw new WorkspaceError(planned.error);
          const warnings = [...planned.warnings];
          let done = 0;
          for (const draft of planned.drafts) {
            stage(t('library.json.saving', { n: done + 1, total: planned.drafts.length }));
            try {
              await store.save({ id: draft.id, kind: draft.kind, ...(draft.key === undefined ? {} : { key: draft.key }), data: draft.data });
              done += 1;
            } catch (e) {
              warnings.push(t('library.json.saveFailed', { kind: kindOf(draft.kind)?.label ?? draft.kind, title: String(draft.data.title ?? draft.data.name ?? draft.key ?? ''), error: e instanceof WorkspaceError ? e.message : t('library.json.notSaved') }));
            }
          }
          return { lines: [t('library.json.saved', { n: done, total: planned.drafts.length }), ...planned.lines], warnings };
        }}
      />
    </>
  );
}
export { tabOfKind };
