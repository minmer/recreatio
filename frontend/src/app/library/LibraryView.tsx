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
 * die Mapa, Import / eksport, Ustawienia). Texte schreibt man im Skryptorium,
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
import { ids, isLibraryKind, kindOf, LIBRARY_KINDS, quoteOrder, str, type LibEntry } from './libraryKinds';
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

/* 2026-10-24 — der Czytnik eines Textes kommt erst, wenn einer gelesen wird. */
const SourceReader = later(() => import('./SourceReader').then((m) => m.SourceReader));

/** Die Reiter einer Bibliothek — Wort in der Adresse, Art (2026-10-23: nur Quellen). */
export const TABS = [
  { slug: 'zrodla', kind: 'work' },
  { slug: 'cytaty', kind: 'quote' },
  { slug: 'osoby', kind: 'person' }
] as const;

const tabOfKind = (kind: string) => TABS.find((t) => t.kind === kind)?.slug ?? 'zrodla';

export function LibraryView({ who, trail }: { who: Who; trail: readonly string[] }) {
  const me = useMe(who);
  if (me === undefined) return <Loading label="Wczytywanie…" />;
  if (me === null) return <p className="wk-note">Bez klucza w tej karcie biblioteka jest zamknięta — zaloguj się ponownie albo odblokuj klucz.</p>;
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

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [rows, found] = await Promise.all([loadLibraries(), loadAreas()]);
        const opened = await openLibraries(me.ring, rows.libraries);
        if (!alive) return;
        const books = opened.filter((one) => libraryKindOf(one) === 'books');
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
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać bibliotek.');
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
  if (libraries === null) return <Loading label="Wczytywanie…" />;

  if (libraryId !== undefined) {
    if (current === null && knowledge.has(libraryId)) return <p className="wk-note">To jest baza wiedzy — jest w Wiedzy. <a href={viewPath('knowledge', libraryId)}>Otwórz ją</a></p>;
    if (current === null && writing.has(libraryId)) return <p className="wk-note">To jest skryptorium — teksty, wygłoszenia i projekty. <a href={viewPath('scriptorium', libraryId)}>Otwórz je</a></p>;
    if (current === null) return <p className="wk-empty">Tej biblioteki nie ma albo nie masz do niej klucza. <a href={viewPath('library')}>Wszystkie biblioteki</a></p>;
    return <LibraryHome me={me} library={current} libraries={libraries} areas={areas} trail={trail.slice(1)} onChanged={() => setTick((n) => n + 1)} />;
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
  const [areaId, setAreaId] = useState(personal?.areaId ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const area = areaId === '' ? await ensurePrivateArea(me.ring, me.person, areas) : areaId;
      const id = await createLibrary(me.ring, area, name.trim() === '' ? 'Moja biblioteka' : name);
      onChanged();
      window.location.hash = viewPath('library', id);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się założyć biblioteki.');
    } finally {
      setBusy(false);
    }
  };

  const areaName = (id: string) => areas.find((a) => a.areaId === id)?.personal === true ? 'tylko Ty' : areas.find((a) => a.areaId === id)?.name ?? 'obszar';

  return (
    <>
      <h1 className="wk-h1">Biblioteka</h1>
      <p className="wk-lede">
        Źródła, cytaty i ich autorzy — jedno miejsce dla każdego odwołania. Teksty piszesz w Skryptorium, a wiedzę
        (komentarze, postacie, miejsca, wydarzenia) układasz w Wiedzy; jedno i drugie cytuje stąd.
        Wszystko jest szyfrowane w przeglądarce. Każdy obszar ma swoją bibliotekę: widzą ją członkowie obszaru, a gdy obszar jest publiczny — wszyscy.
        Pracujesz ze wszystkimi naraz: odwołania i wyszukiwanie sięgają do każdej biblioteki, którą widzisz.
      </p>

      {libraries.length > 0 && (
        <ul className="lib-libraries">
          {libraries.map((one) => (
            <li key={one.libraryId}>
              <a className="lib-library" href={viewPath('library', one.libraryId)}>
                <span className="lib-library-name">{one.name}</span>
                <span className="lib-library-meta">{one.entries} wpisów · {areaName(one.areaId)} · widzą: {audienceWords(one)}{one.writes ? '' : ' · tylko do czytania'}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <form className="wk-form lib-new" onSubmit={(e) => { e.preventDefault(); void create(); }}>
        <h2 className="wk-h2">{libraries.length === 0 ? 'Załóż bibliotekę' : 'Nowa biblioteka'}</h2>
        <label className="wk-field">
          <span>Nazwa</span>
          <input value={name} placeholder="np. Kazania i źródła" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="wk-field">
          <span>Kto ją widzi</span>
          <AreaPick
            label="Kto ją widzi" value={areaId} onChange={setAreaId} areas={areas} only={writable.filter((a) => a.personal !== true)}
            extras={[{ value: '', label: personal === undefined ? 'Tylko ja (utworzy się prywatny obszar)' : 'Tylko ja' }]}
          />
        </label>
        <p className="wk-hint">Wspólną bibliotekę czytają i uzupełniają wszyscy, którzy mają klucz obszaru. Każdy obszar ma jedną bibliotekę.</p>
        {failed !== null && <p className="wk-error">{failed}</p>}
        <div className="wk-actions"><button type="submit" className="wk-btn" disabled={busy}>{busy ? 'Zakładanie…' : 'Załóż'}</button></div>
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
  const first = trail[0] ?? 'zrodla';

  if (store === null) return null;
  if (failed !== null && !store.loaded) return <p className="wk-error">{failed}</p>;
  if (!store.loaded) return <p className="wk-lede">Otwieranie biblioteki…</p>;

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
      {store.unreadable > 0 && <p className="wk-note">{store.unreadable} wpisów jest zapieczętowanych kluczem, którego nie masz.</p>}
      <SearchAll store={store} library={library} />
      <nav className="wk-tabs lib-tabs" aria-label="Działy biblioteki">
        {TABS.map((t) => (
          <a key={t.slug} className={t.slug === tab ? 'wk-tab wk-tab-on' : 'wk-tab'} href={viewPath('library', library.libraryId, t.slug)}>
            {kindOf(t.kind)!.plural} <span className="lib-count">{store.ofKind(t.kind).length}</span>
          </a>
        ))}
        <a className={tab === 'mapa' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={viewPath('library', library.libraryId, 'mapa')}>Mapa</a>
        <a className={tab === 'json' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={viewPath('library', library.libraryId, 'json')}>Import / eksport</a>
        <a className={tab === 'ustawienia' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={viewPath('library', library.libraryId, 'ustawienia')}>Ustawienia</a>
        {(old > 0 || tab === 'stare') && <a className={tab === 'stare' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={viewPath('library', library.libraryId, 'stare')}>Stare wpisy <span className="lib-count">{old}</span></a>}
      </nav>
      <div className="wk-panel">
        {tab === 'ustawienia' ? <Settings me={me} store={store} library={library} areas={areas} onChanged={onChanged} />
          : tab === 'json' ? <LibraryJson store={store} library={library} />
          : tab === 'mapa' ? <LibraryMap store={store} libraryId={library.libraryId} />
          : tab === 'stare' ? <OldEntries store={store} known={known} writes={library.writes} where="Teksty, wygłoszenia i projekty są teraz w Skryptorium, komentarze to rodzaj w Wiedzy." />
          : <KindList store={store} library={library} kind={TABS.find((t) => t.slug === tab)!.kind} sources={{ libraries, storeFor: (row) => storeOf(me.ring, row) }} />}
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
  /* 2026-10-22 — eine Stelle der Schrift („Dz 1:14", „Psalm 23"): dazu, was auf sie zeigt. */
  const spans = useMemo(() => (/\d/.test(query) ? parseBible(query) : []), [query]);
  const found = useMemo(() => (query.trim().length < 2 ? [] : store.search(query).slice(0, 12)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, store, store.revision]);
  return (
    <div className="lib-search">
      <div className="lib-search-bar">
        <input type="search" value={query} placeholder="Szukaj w całej bibliotece — tytuł, autor, fragment cytatu, ISBN, numer…" onChange={(e) => setQuery(e.target.value)} aria-label="Szukaj w bibliotece" />
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
      {query.trim().length >= 2 && found.length === 0 && spans.length === 0 && <p className="wk-hint">Nic nie znaleziono.</p>}
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
      const authors = ids(d, 'authors').map((id) => store.get(id)).filter((p): p is Entry => p !== undefined).map((p) => store.title(p));
      return [authors.join(', '), store.title(entry), str(d, 'year')].filter(Boolean).join(' · ');
    }
    default: return store.title(entry);
  }
}

function KindList({ store, library, kind, sources }: { store: LibraryStore; library: OpenLibrary; kind: string; sources?: SourceTargets }) {
  const def = kindOf(kind)!;
  const [query, setQuery] = useState('');
  /* 2026-10-22 — auch die anderen lesbaren Bibliotheken (jede Zeile sagt, in welcher sie liegt). */
  const [everywhere, setEverywhere] = useState(false);
  const peers = store.peers();
  const here = (e: Entry) => everywhere || e.libraryId === store.libraryId;

  const all = everywhere ? store.readable().filter((e) => e.kind === kind) : store.ofKind(kind);

  let list = query.trim() === '' ? all : store.search(query, [kind]).filter(here);
  /* 2026-10-22 — Zitate nach Werk und Stelle (die Schrift nach dem Kanon), nicht nach dem Wortlaut ihrer Herkunft. */
  const sortKey = (e: Entry) => (kind === 'quote' ? quoteOrder(e, store) : lineOf(e, store).toLowerCase());
  list = [...list].sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'pl'));

  const add = viewPath('library', library.libraryId, 'nowy', kind);
  /* 2026-10-23 — zaznaczyć wiele i usunąć (tylko własne wpisy tej biblioteki). */
  const { picked, toggle, set } = usePicked();

  return (
    <>
      <div className="lib-toolbar">
        <input type="search" value={query} placeholder={`Szukaj: ${def.plural.toLowerCase()}`} onChange={(e) => setQuery(e.target.value)} aria-label={`Szukaj: ${def.plural}`} />
        {peers.length > 0 && (
          <label className="pe-check">
            <input type="checkbox" checked={everywhere} onChange={(e) => setEverywhere(e.target.checked)} />
            <span>też z innych bibliotek ({peers.length})</span>
          </label>
        )}
        {library.writes && <a className="wk-btn" href={add}>+ {def.label}</a>}
        {/* 2026-10-24 — ein Werk mit seinem ganzen Text aus einem Dokument (`SourceBox.tsx`, `sourceImport.ts`). */}
        {kind === 'work' && <WorkWithTextButton store={store} library={library} targets={sources} />}
      </div>
      <p className="wk-hint">{def.says}</p>

      {list.length === 0 ? (
        <p className="wk-empty">{all.length === 0 ? `Nie ma jeszcze żadnego wpisu tego rodzaju.` : 'Nic nie pasuje.'}</p>
      ) : (
        <ul className="lib-list">
          {list.map((entry) => (
            <li key={entry.id} className={library.writes ? 'has-pick' : undefined}>
              {library.writes && (entry.libraryId === store.libraryId ? <PickBox checked={picked.has(entry.id)} label={store.title(entry)} onToggle={() => toggle(entry.id)} /> : <span />)}
              <a className="lib-row" href={viewPath('library', entry.libraryId, entry.id)}>
                <span className="lib-row-title">
                  {kind === 'quote' ? <q>{store.title(entry)}</q> : store.title(entry)}
                  {entry.libraryId !== store.libraryId && <span className="lib-badge is-implicit">{openedLibraryNames().get(entry.libraryId) ?? 'inna biblioteka'}</span>}
                </span>
                <span className="lib-row-meta">{metaOf(entry, store)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <LibraryJson key={kind} store={store} library={library} only={kind} />
      <PickBar store={store} picked={picked} all={list.filter((e) => e.libraryId === store.libraryId).map((e) => e.id)} onPicked={set} writes={library.writes} />
    </>
  );
}

function metaOf(entry: Entry, store: LibraryStore): string {
  const d = entry.data;
  switch (entry.kind) {
    case 'quote': return originOf(entry, store);
    case 'work': {
      const quotes = store.backlinks(entry.id).filter((e) => e.kind === 'quote').length;
      const number = str(d, 'libraryNumber');
      return [number === '' ? '' : `nr ${number}`, lineOf(entry, store).replace(`${store.title(entry)} · `, ''), quotes > 0 ? `${quotes} cytatów` : '', entry.key === undefined ? '' : `[@${entry.key}]`].filter(Boolean).join(' · ');
    }
    case 'person': return [str(d, 'years'), `${store.backlinks(entry.id).filter((e) => e.kind === 'work').length} źródeł`].filter(Boolean).join(' · ');
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

  const act = async (todo: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try { await todo(); onChanged(); } catch (e) { setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.'); } finally { setBusy(false); }
  };

  return (
    <>
      <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void act(() => renameLibrary(me.ring, library, name)); }}>
        <label className="wk-field"><span>Nazwa</span><input value={name} disabled={!library.writes} onChange={(e) => setName(e.target.value)} /></label>
        <p className="wk-hint">Obszar: {area?.personal === true ? 'tylko Ty' : area?.name ?? 'nieznany'} — kto ma jego klucz, czyta tę bibliotekę{library.writes ? '' : '. Ty możesz ją tylko czytać'}.</p>
        {library.writes && <div className="wk-actions"><button type="submit" className="wk-btn" disabled={busy || name.trim() === ''}>Zapisz nazwę</button></div>}
      </form>

      <section className="wk-form">
        <h2 className="wk-h2">Kto widzi</h2>
        <p>Widzą: {audienceWords(library)}. Żeby wpis stał się publiczny (albo przestał), przenieś go do biblioteki innego obszaru — przy wpisie, w ramce „Kto widzi”.</p>
        {/* 2026-10-23 — statt Porządki: wer schreibt, bestätigt die Regel des Bereichs (vorher liest ein öffentlicher Bereich nichts offen). */}
        <SettleBox store={store} library={library} busy={busy} understood={understood} onUnderstood={setUnderstood} onSettle={() => void act(() => settleLibrary(library.libraryId))} />
        {library.writes && published.length > 0 && (
          <div className="wk-note">
            <p>{published.length} wpisów ma jeszcze stare, osobno opublikowane kopie (sprzed 22.10.2026). Nikt ich już nie czyta; można je wycofać.</p>
            <div className="wk-actions"><button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={() => void act(() => store.withdraw(published.map((e) => e.id)))}>Wycofaj stare kopie</button></div>
          </div>
        )}
      </section>

      {library.writes && (
        <section className="wk-form lib-danger">
          <h2 className="wk-h2">Usuń bibliotekę</h2>
          <p className="wk-hint">Usuwa wszystkie wpisy; strony, które je pokazywały, napiszą, że tekstu już nie ma. Tego nie da się cofnąć. Najpierw zrób eksport (Import / eksport).</p>
          <label className="wk-field"><span>Wpisz nazwę biblioteki, żeby potwierdzić</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
          <div className="wk-actions">
            <button type="button" className="wk-btn lib-btn-danger" disabled={busy || confirm.trim() !== library.name.trim()}
              onClick={() => void act(async () => { await deleteLibrary(library.libraryId); window.location.hash = viewPath('library'); })}>
              Usuń na zawsze
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
  if (!library.writes || library.areaRuleAt != null) return null;
  return (
    <div className="wk-note" data-settle="">
      <p>
        Ten zbiór powstał przed zasadą „widzi go ten, kto widzi obszar”, więc dziś nikt spoza obszaru go nie czyta.
        {library.areaPublic === true
          ? ` Obszar jest publiczny: po potwierdzeniu wszystkie wpisy (${store.all().length}) zobaczy każdy, także bez konta.`
          : ' Obszar nie jest publiczny: po potwierdzeniu nic się nie zmieni dla nikogo spoza obszaru.'}
      </p>
      <label className="pe-check"><input type="checkbox" checked={understood} onChange={(e) => onUnderstood(e.target.checked)} /><span>Rozumiem, kto będzie to widział</span></label>
      <div className="wk-actions"><button type="button" className="wk-btn" disabled={busy || !understood} onClick={onSettle}>Potwierdź widoczność według obszaru</button></div>
    </div>
  );
}

/* -- JSON ------------------------------------------------------------------------------------------ */

/** `only`: unter einer Liste — nur diese Art (mit dem, worauf sie zeigt, beim Import). */
function LibraryJson({ store, library, only }: { store: LibraryStore; library: OpenLibrary; only?: string }) {
  const [kinds, setKinds] = useState<readonly string[]>(only === undefined ? LIBRARY_KINDS.map((k) => k.kind) : [only]);
  const onlyDef = only === undefined ? undefined : kindOf(only);

  const preview = (doc: unknown): JsonPreview | { error: string } => {
    const planned = planLibraryImport(doc, store);
    return 'error' in planned ? planned : { lines: planned.lines, warnings: planned.warnings };
  };

  return (
    <>
      {only === undefined && <fieldset className="lib-kinds">
        <legend>Co eksportować</legend>
        {LIBRARY_KINDS.map((k) => (
          <label key={k.kind} className="pe-check">
            <input type="checkbox" checked={kinds.includes(k.kind)} onChange={(e) => setKinds(e.target.checked ? [...kinds, k.kind] : kinds.filter((x) => x !== k.kind))} />
            <span>{k.plural} ({store.ofKind(k.kind).length})</span>
          </label>
        ))}
      </fieldset>}
      <JsonPanel
        summary={onlyDef === undefined ? 'JSON biblioteki — eksport i import' : `Import / eksport JSON: ${onlyDef.plural.toLowerCase()}`}
        lead={onlyDef === undefined
          ? <>Wszystkie wpisy (albo wybrane rodzaje) jako jeden dokument — kopia zapasowa, przeniesienie, praca z AI. Import zmienia istniejące wpisy w miejscu i dodaje nowe; niczego nie usuwa.</>
          : <>{onlyDef.plural} jako JSON — np. kilka książek naraz przygotowanych przez AI. Import przyjmuje też osoby i źródła, na które wskazują; istniejące wpisy zmienia w miejscu, niczego nie usuwa.</>}
        fileName={`biblioteka-${library.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}${only === undefined ? '' : `-${only}`}.json`}
        exportDoc={() => exportLibrary(library.name, store.all().filter((e) => kinds.includes(e.kind) && isLibraryKind(e.kind)), store)}
        description={libraryDescription}
        preview={preview}
        importLabel="Importuj i zapisz"
        onImport={async (doc, stage) => {
          if (!library.writes) throw new WorkspaceError('W tej bibliotece możesz tylko czytać.');
          const planned = planLibraryImport(doc, store);
          if ('error' in planned) throw new WorkspaceError(planned.error);
          const warnings = [...planned.warnings];
          let done = 0;
          for (const draft of planned.drafts) {
            stage(`Zapisywanie ${done + 1} z ${planned.drafts.length}…`);
            try {
              await store.save({ id: draft.id, kind: draft.kind, ...(draft.key === undefined ? {} : { key: draft.key }), data: draft.data });
              done += 1;
            } catch (e) {
              warnings.push(`${kindOf(draft.kind)?.label} „${String(draft.data.title ?? draft.data.name ?? draft.key ?? '')}”: ${e instanceof WorkspaceError ? e.message : 'nie udało się zapisać'}.`);
            }
          }
          return { lines: [`Zapisano ${done} z ${planned.drafts.length}.`, ...planned.lines], warnings };
        }}
      />
    </>
  );
}
export { tabOfKind };
