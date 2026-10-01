/**
 * DIE BIBLIOTHEK IM WARSZTAT (0064).
 *
 * <code>
 *   #/workspace/library                       die Bibliotheken
 *   #/workspace/library/&lt;id&gt;                  eine, mit ihren Reitern (Teksty, …)
 *   #/workspace/library/&lt;id&gt;/cytaty           ein Reiter
 *   #/workspace/library/&lt;id&gt;/&lt;eintrag&gt;        ein Eintrag, ganz
 *   #/workspace/library/&lt;id&gt;/nowy/&lt;art&gt;      ein neuer
 * </code>
 *
 * Jeder Schritt ist eine Adresse — wie bei den Bausteinen: ein Zitat, das
 * man gerade bearbeitet, lässt sich als Link weitergeben (an jemanden, der
 * die Bibliothek auch lesen darf).
 */

import { useEffect, useMemo, useState } from 'react';

import { loadAreas, type AreaRow } from './area';
import { ensurePrivateArea } from './agenda';
import { AreaOptions } from './AreaOptions';
import { useCrumbs, type Crumb } from './crumbTrail';
import { JsonPanel, type JsonPreview } from './JsonPanel';
import {
  createLibrary, deleteLibrary, isUuid, loadLibraries, openLibraries, renameLibrary, type OpenLibrary
} from './library';
import { originOf } from './libraryCite';
import { LibraryEditor } from './LibraryEditor';
import { exportLibrary, libraryDescription, planLibraryImport } from './libraryJson';
import { ids, KINDS, kindOf, str, TEXT_STATUS, TEXT_TYPES, wordCount, type LibEntry } from './libraryKinds';
import { useLibraryStore, type Entry, type LibraryStore } from './libraryStore';
import { useMe, type Me } from './me';
import { viewPath } from './routes';
import { WorkspaceError, type Who } from './session';

/** Die Reiter einer Bibliothek — Wort in der Adresse, Art, Name. */
export const TABS = [
  { slug: 'teksty', kind: 'text' },
  { slug: 'projekty', kind: 'project' },
  { slug: 'cytaty', kind: 'quote' },
  { slug: 'zrodla', kind: 'work' },
  { slug: 'osoby', kind: 'person' },
  { slug: 'tematy', kind: 'topic' }
] as const;

const tabOfKind = (kind: string) => TABS.find((t) => t.kind === kind)?.slug ?? 'teksty';

export function LibraryView({ who, trail }: { who: Who; trail: readonly string[] }) {
  const me = useMe(who);
  if (me === undefined) return <p className="wk-lede">Wczytywanie…</p>;
  if (me === null) return <p className="wk-note">Bez klucza w tej karcie biblioteka jest zamknięta — zaloguj się ponownie albo odblokuj klucz.</p>;
  return <Libraries me={me} trail={trail} />;
}

function Libraries({ me, trail }: { me: Me; trail: readonly string[] }) {
  const [libraries, setLibraries] = useState<readonly OpenLibrary[] | null>(null);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [rows, found] = await Promise.all([loadLibraries(), loadAreas()]);
        const opened = await openLibraries(me.ring, rows.libraries);
        if (!alive) return;
        setLibraries(opened);
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
  if (libraries === null) return <p className="wk-lede">Wczytywanie…</p>;

  if (libraryId !== undefined) {
    if (current === null) return <p className="wk-empty">Tej biblioteki nie ma albo nie masz do niej klucza. <a href={viewPath('library')}>Wszystkie biblioteki</a></p>;
    return <LibraryHome me={me} library={current} areas={areas} trail={trail.slice(1)} onChanged={() => setTick((n) => n + 1)} />;
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
        Źródła, cytaty, autorzy, tematy i Twoje teksty — kazania, rozważania, rozdziały książek — w jednym miejscu.
        Wszystko jest szyfrowane w przeglądarce; publiczne staje się tylko to, co opublikujesz, razem ze źródłami, które przywołuje.
      </p>

      {libraries.length > 0 && (
        <ul className="lib-libraries">
          {libraries.map((one) => (
            <li key={one.libraryId}>
              <a className="lib-library" href={viewPath('library', one.libraryId)}>
                <span className="lib-library-name">{one.name}</span>
                <span className="lib-library-meta">{one.entries} wpisów · {one.published} publicznych · {areaName(one.areaId)}{one.writes ? '' : ' · tylko do czytania'}</span>
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
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">{personal === undefined ? 'Tylko ja (utworzy się prywatny obszar)' : 'Tylko ja'}</option>
            <AreaOptions areas={areas} only={writable.filter((a) => a.personal !== true)} />
          </select>
        </label>
        <p className="wk-hint">Wspólną bibliotekę czytają i uzupełniają wszyscy, którzy mają klucz obszaru.</p>
        {failed !== null && <p className="wk-error">{failed}</p>}
        <div className="wk-actions"><button type="submit" className="wk-btn" disabled={busy}>{busy ? 'Zakładanie…' : 'Załóż'}</button></div>
      </form>
    </>
  );
}

/* -- Eine Bibliothek -------------------------------------------------------------------------- */

function LibraryHome({ me, library, areas, trail, onChanged }: {
  me: Me;
  library: OpenLibrary;
  areas: readonly AreaRow[];
  trail: readonly string[];
  onChanged: () => void;
}) {
  const { store, failed } = useLibraryStore(me.ring, library);
  const first = trail[0] ?? 'teksty';

  if (store === null) return null;
  if (failed !== null && !store.loaded) return <p className="wk-error">{failed}</p>;
  if (!store.loaded) return <p className="wk-lede">Otwieranie biblioteki…</p>;

  /* Ein Eintrag — oder ein neuer. */
  if (isUuid(first)) {
    return <LibraryEditor store={store} library={library} entryId={first} kind={store.get(first)?.kind ?? null} />;
  }
  if (first === 'nowy' && kindOf(trail[1] ?? '') !== undefined) {
    return <LibraryEditor store={store} library={library} entryId={null} kind={trail[1]!} preset={presetFrom(trail[2])} />;
  }

  const tab = first === 'ustawienia' || first === 'json' ? first : (TABS.find((t) => t.slug === first)?.slug ?? 'teksty');

  return (
    <>
      <h1 className="wk-h1">{library.name}</h1>
      {store.unreadable > 0 && <p className="wk-note">{store.unreadable} wpisów jest zapieczętowanych kluczem, którego nie masz.</p>}
      <SearchAll store={store} />
      <nav className="wk-tabs lib-tabs" aria-label="Działy biblioteki">
        {TABS.map((t) => (
          <a key={t.slug} className={t.slug === tab ? 'wk-tab wk-tab-on' : 'wk-tab'} href={viewPath('library', library.libraryId, t.slug)}>
            {kindOf(t.kind)!.plural} <span className="lib-count">{store.ofKind(t.kind).length}</span>
          </a>
        ))}
        <a className={tab === 'json' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={viewPath('library', library.libraryId, 'json')}>Import / eksport</a>
        <a className={tab === 'ustawienia' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={viewPath('library', library.libraryId, 'ustawienia')}>Ustawienia</a>
      </nav>
      <div className="wk-panel">
        {tab === 'ustawienia' ? <Settings me={me} library={library} areas={areas} onChanged={onChanged} />
          : tab === 'json' ? <LibraryJson store={store} library={library} />
          : <KindList store={store} library={library} kind={TABS.find((t) => t.slug === tab)!.kind} />}
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
function SearchAll({ store }: { store: LibraryStore }) {
  const [query, setQuery] = useState('');
  const found = useMemo(() => (query.trim().length < 2 ? [] : store.search(query).slice(0, 12)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, store, store.revision]);
  return (
    <div className="lib-search">
      <input type="search" value={query} placeholder="Szukaj w całej bibliotece — tytuł, autor, fragment cytatu, temat…" onChange={(e) => setQuery(e.target.value)} aria-label="Szukaj w bibliotece" />
      {found.length > 0 && (
        <ul className="lib-search-hits">
          {found.map((entry) => (
            <li key={entry.id}>
              <a href={viewPath('library', store.libraryId, entry.id)}>
                <span className="lib-option-kind">{kindOf(entry.kind)?.label}</span> {lineOf(entry, store)}
              </a>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length >= 2 && found.length === 0 && <p className="wk-hint">Nic nie znaleziono.</p>}
    </div>
  );
}

const statusLabel = (value: string) => TEXT_STATUS.find((s) => s.value === value)?.label ?? '';
const typeLabel = (value: string) => TEXT_TYPES.find((s) => s.value === value)?.label ?? '';

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

function PublicBadge({ entry }: { entry: Entry }) {
  if (entry.publishedAs === 'explicit') return <span className="lib-badge is-public">publiczny</span>;
  if (entry.publishedAs === 'implicit') return <span className="lib-badge is-implicit">publiczny jako źródło</span>;
  return null;
}

function KindList({ store, library, kind }: { store: LibraryStore; library: OpenLibrary; kind: string }) {
  const def = kindOf(kind)!;
  const [topic, setTopic] = useState('');
  const [project, setProject] = useState('');
  const [query, setQuery] = useState('');

  const all = store.ofKind(kind);
  const topics = store.ofKind('topic').sort((a, b) => store.title(a).localeCompare(store.title(b), 'pl'));
  const projects = store.ofKind('project');

  let list = query.trim() === '' ? all : store.search(query, [kind]);
  if (topic !== '') list = list.filter((e) => ids(e.data, 'topics').includes(topic) || (kind === 'topic' && ids(e.data, 'parent').includes(topic)));
  if (project !== '' && kind === 'text') list = list.filter((e) => ids(e.data, 'project').includes(project));

  list = [...list].sort((a, b) => kind === 'text'
    ? (str(b.data, 'date') || b.updatedAt).localeCompare(str(a.data, 'date') || a.updatedAt)
    : (store.title(a)).localeCompare(store.title(b), 'pl'));
  if (kind === 'work' || kind === 'quote' || kind === 'person') {
    const sortKey = (e: Entry) => (kind === 'quote' ? originOf(e, store) : lineOf(e, store)).toLowerCase();
    list.sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'pl'));
  }

  const add = viewPath('library', library.libraryId, 'nowy', kind);

  return (
    <>
      <div className="lib-toolbar">
        <input type="search" value={query} placeholder={`Szukaj: ${def.plural.toLowerCase()}`} onChange={(e) => setQuery(e.target.value)} aria-label={`Szukaj: ${def.plural}`} />
        {kind !== 'person' && topics.length > 0 && (
          <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Temat">
            <option value="">wszystkie tematy</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{store.title(t)}</option>)}
          </select>
        )}
        {kind === 'text' && projects.length > 0 && (
          <select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Projekt">
            <option value="">wszystkie projekty</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{store.title(p)}</option>)}
          </select>
        )}
        {library.writes && <a className="wk-btn" href={add}>+ {def.label}</a>}
      </div>
      <p className="wk-hint">{def.says}</p>

      {list.length === 0 ? (
        <p className="wk-empty">{all.length === 0 ? `Nie ma jeszcze żadnego wpisu tego rodzaju.` : 'Nic nie pasuje.'}</p>
      ) : (
        <ul className="lib-list">
          {list.map((entry) => (
            <li key={entry.id}>
              <a className="lib-row" href={viewPath('library', library.libraryId, entry.id)}>
                <span className="lib-row-title">
                  {kind === 'quote' ? <q>{store.title(entry)}</q> : store.title(entry)}
                  <PublicBadge entry={entry} />
                </span>
                <span className="lib-row-meta">{metaOf(entry, store)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function metaOf(entry: Entry, store: LibraryStore): string {
  const d = entry.data;
  switch (entry.kind) {
    case 'text': return [typeLabel(str(d, 'textType')), str(d, 'date'), str(d, 'occasion'), statusLabel(str(d, 'status')), `${wordCount(str(d, 'body'))} słów`]
      .filter(Boolean).join(' · ');
    case 'quote': return [originOf(entry, store), ...ids(d, 'topics').map((id) => store.get(id)).filter((t): t is Entry => t !== undefined).map((t) => `#${store.title(t)}`)].join(' · ');
    case 'work': {
      const quotes = store.backlinks(entry.id).filter((e) => e.kind === 'quote').length;
      return [lineOf(entry, store).replace(`${store.title(entry)} · `, ''), quotes > 0 ? `${quotes} cytatów` : '', entry.key === undefined ? '' : `[@${entry.key}]`].filter(Boolean).join(' · ');
    }
    case 'person': return [str(d, 'years'), `${store.backlinks(entry.id).filter((e) => e.kind === 'work').length} źródeł`].filter(Boolean).join(' · ');
    case 'topic': return `${store.backlinks(entry.id).length} wpisów`;
    case 'project': {
      const texts = store.ofKind('text').filter((t) => ids(t.data, 'project').includes(entry.id));
      const words = texts.reduce((n, t) => n + wordCount(str(t.data, 'body')), 0);
      return `${texts.length} tekstów · ${words} słów`;
    }
    default: return '';
  }
}

/* -- Einstellungen ---------------------------------------------------------------------------- */

function Settings({ me, library, areas, onChanged }: { me: Me; library: OpenLibrary; areas: readonly AreaRow[]; onChanged: () => void }) {
  const [name, setName] = useState(library.name);
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

      {library.writes && (
        <section className="wk-form lib-danger">
          <h2 className="wk-h2">Usuń bibliotekę</h2>
          <p className="wk-hint">Usuwa wszystkie wpisy — także opublikowane; strony, które je pokazywały, napiszą, że tekstu już nie ma. Tego nie da się cofnąć. Najpierw zrób eksport (Import / eksport).</p>
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

/* -- JSON ------------------------------------------------------------------------------------------ */

function LibraryJson({ store, library }: { store: LibraryStore; library: OpenLibrary }) {
  const [kinds, setKinds] = useState<readonly string[]>(KINDS.map((k) => k.kind));

  const preview = (doc: unknown): JsonPreview | { error: string } => {
    const planned = planLibraryImport(doc, store);
    return 'error' in planned ? planned : { lines: planned.lines, warnings: planned.warnings };
  };

  return (
    <>
      <fieldset className="lib-kinds">
        <legend>Co eksportować</legend>
        {KINDS.map((k) => (
          <label key={k.kind} className="pe-check">
            <input type="checkbox" checked={kinds.includes(k.kind)} onChange={(e) => setKinds(e.target.checked ? [...kinds, k.kind] : kinds.filter((x) => x !== k.kind))} />
            <span>{k.plural} ({store.ofKind(k.kind).length})</span>
          </label>
        ))}
      </fieldset>
      <JsonPanel
        summary="JSON biblioteki — eksport i import"
        lead={<>Wszystkie wpisy (albo wybrane rodzaje) jako jeden dokument — kopia zapasowa, przeniesienie, praca z AI. Import zmienia istniejące wpisy w miejscu i dodaje nowe; niczego nie usuwa.</>}
        fileName={`biblioteka-${library.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`}
        exportDoc={() => exportLibrary(library.name, store.all().filter((e) => kinds.includes(e.kind)))}
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
          const refreshed = planned.drafts.filter((d) => store.get(d.id)?.publishedAs != null).map((d) => d.id);
          if (refreshed.length > 0) {
            stage('Aktualizowanie publikacji…');
            await store.refresh(refreshed);
          }
          return { lines: [`Zapisano ${done} z ${planned.drafts.length}.`, ...planned.lines, ...(refreshed.length > 0 ? [`Zaktualizowano publikację: ${refreshed.length}.`] : [])], warnings };
        }}
      />
    </>
  );
}

export const libraryCrumb = (library: OpenLibrary): Crumb => ({ label: library.name, href: viewPath('library', library.libraryId) });
export { tabOfKind };
