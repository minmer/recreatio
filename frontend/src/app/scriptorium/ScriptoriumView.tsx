/**
 * DAS SKRYPTORIUM IM WARSZTAT (2026-10-23, 0124) — die eigenen Texte, ihre
 * Wygłoszenia, Projekte und Rodzaje tekstów. Daneben steht die Bibliothek
 * (Quellen), aus der zitiert wird, und Nauka, auf deren Einträge ein Text
 * zeigen kann; umgekehrt zeigt nichts hierher.
 *
 * <code>
 *   #/workspace/scriptorium                        die Skryptoria (je Bereich höchstens eines)
 *   #/workspace/scriptorium/&lt;id&gt;                   eines, mit seinen Reitern
 *   #/workspace/scriptorium/&lt;id&gt;/wyglaszenia       ein Reiter
 *   #/workspace/scriptorium/&lt;id&gt;/&lt;eintrag&gt;         ein Eintrag, ganz
 *   #/workspace/scriptorium/&lt;id&gt;/nowy/&lt;art&gt;[/&lt;vorgabe&gt;]   ein neuer
 * </code>
 *
 * Wer liest, entscheidet allein der Bereich: Mitglieder, und ist er
 * öffentlich, jeder. Ein Text wird öffentlich, indem er in das Skryptorium
 * eines öffentlichen Bereichs zieht (seine Kennung bleibt).
 */

import { useEffect, useMemo, useState } from 'react';

import { loadAreas, type AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { ensurePrivateArea } from '../calendar/agenda';
import { useMe, type Me } from '../core/me';
import { WorkspaceError, type Who } from '../core/session';
import { useCrumbs } from '../shell/crumbTrail';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import { Loading } from '../ui/Loading';
import { viewPath } from '../routes';
import { count } from '../pages/event/kit';
import {
  createLibrary, deleteLibrary, isUuid, libraryKindOf, loadLibraries, openLibraries, renameLibrary, settleLibrary, type OpenLibrary
} from '../library/library';
import { audienceWords } from '../library/LibraryAreaBox';
import { PickBar, PickBox, usePicked } from '../library/EntryPick';
import { ids, isWritingKind, kindOf, num, str, TEXT_STATUS, textTypeName, wordCount, WRITING_KINDS, type LibEntry } from '../library/libraryKinds';
import { storeOf, useLibraryStore, type Entry, type LibraryStore } from '../library/libraryStore';
import { OldEntries, oldEntriesOf } from '../library/OldEntries';
import { SettleBox } from '../library/LibraryView';
import { scriptoriumFormat } from './format';
import { useLens } from './lens';
import { deliveriesOf } from './sermon';
import { WritingEditor } from './WritingEditor';

/** Die Reiter — Wort in der Adresse, Art. */
const TABS = [
  { slug: 'teksty', kind: 'text' },
  { slug: 'wyglaszenia', kind: 'delivery' },
  { slug: 'projekty', kind: 'project' },
  { slug: 'rodzaje', kind: 'texttype' }
] as const;

export function ScriptoriumView({ who, trail }: { who: Who; trail: readonly string[] }) {
  const me = useMe(who);
  if (me === undefined) return <Loading label="Wczytywanie…" />;
  if (me === null) return <p className="wk-note">Bez klucza w tej karcie skryptorium jest zamknięte — zaloguj się ponownie albo odblokuj klucz.</p>;
  return <Scriptoria me={me} who={who} trail={trail} />;
}

function Scriptoria({ me, who, trail }: { me: Me; who: Who; trail: readonly string[] }) {
  const [rows, setRows] = useState<readonly OpenLibrary[] | null>(null);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  /* 2026-10-25 — eine fertige Quelle zeichnet nur neu; `tick` lädt die Liste neu (nach Anlegen und Einstellungen). */
  const [, setSynced] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [listed, found] = await Promise.all([loadLibraries(), loadAreas()]);
        const opened = await openLibraries(me.ring, listed.libraries);
        if (!alive) return;
        setRows(opened);
        setAreas(found.areas);
        setFailed(null);
        /* Die anderen Skryptoria und die Bibliotheken im Hintergrund — Zitate, Schlüssel und Rückverweise gehen durch sie hindurch; die Bazy wiedzy für Słowa und Widoki im Text. */
        for (const one of opened) void storeOf(me.ring, one).sync().then(() => { if (alive && libraryKindOf(one) !== 'writing') setSynced((n) => n + 1); }, () => undefined);
      } catch (e) {
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać skryptoriów.');
      }
    })();
    return () => { alive = false; };
  }, [me.ring, tick]);

  const scriptoria = useMemo(() => (rows ?? []).filter((one) => libraryKindOf(one) === 'writing'), [rows]);
  const id = trail[0];
  const current = scriptoria.find((one) => one.libraryId === id) ?? null;

  useCrumbs(current === null ? [] : [{
    label: current.name,
    href: viewPath('scriptorium', current.libraryId),
    beside: scriptoria.filter((one) => one.libraryId !== current.libraryId).map((one) => ({ label: one.name, href: viewPath('scriptorium', one.libraryId) }))
  }]);

  if (failed !== null) return <p className="wk-error">{failed}</p>;
  if (rows === null) return <Loading label="Wczytywanie…" />;

  if (id !== undefined) {
    const other = rows.find((one) => one.libraryId === id);
    if (current === null && other !== undefined) {
      return libraryKindOf(other) === 'knowledge'
        ? <p className="wk-note">To jest baza wiedzy — jest w Wiedzy. <a href={viewPath('knowledge', id)}>Otwórz ją</a></p>
        : <p className="wk-note">To jest biblioteka (źródła). <a href={viewPath('library', id)}>Otwórz ją</a></p>;
    }
    if (current === null) return <p className="wk-empty">Tego skryptorium nie ma albo nie masz do niego klucza. <a href={viewPath('scriptorium')}>Wszystkie skryptoria</a></p>;
    return <ScriptoriumHome me={me} who={who} library={current} areas={areas} trail={trail.slice(1)} onChanged={() => setTick((n) => n + 1)} />;
  }
  return <ScriptoriumList me={me} scriptoria={scriptoria} areas={areas} onChanged={() => setTick((n) => n + 1)} />;
}

/* -- Die Skryptoria ------------------------------------------------------------------------------ */

function ScriptoriumList({ me, scriptoria, areas, onChanged }: { me: Me; scriptoria: readonly OpenLibrary[]; areas: readonly AreaRow[]; onChanged: () => void }) {
  const taken = new Set(scriptoria.map((one) => one.areaId));
  const writable = areas.filter((a) => (a.myLevel === 'write' || a.myLevel === 'admin') && a.heldEpochs > 0 && !taken.has(a.areaId));
  const personal = areas.find((a) => a.personal === true);
  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState(personal !== undefined && !taken.has(personal.areaId) ? '' : writable.find((a) => a.personal !== true)?.areaId ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const privateFree = personal === undefined || !taken.has(personal.areaId);
  const chosen = areas.find((a) => a.areaId === areaId);

  const create = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const area = areaId === '' ? await ensurePrivateArea(me.ring, me.person, areas) : areaId;
      const made = await createLibrary(me.ring, area, name.trim() === '' ? 'Skryptorium' : name, 'writing');
      onChanged();
      window.location.hash = viewPath('scriptorium', made);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się założyć skryptorium.');
    } finally {
      setBusy(false);
    }
  };
  const areaName = (one: string) => areas.find((a) => a.areaId === one)?.personal === true ? 'tylko Ty' : areas.find((a) => a.areaId === one)?.name ?? 'obszar';

  return (
    <>
      <h1 className="wk-h1">Skryptorium</h1>
      <p className="wk-lede">
        Miejsce pisania: kazania, konferencje, rozważania i rozdziały — z planem, treścią i przypisami — ich wygłoszenia (co powiedziano, co pominięto)
        i projekty (książka, cykl). Teksty cytują źródła z Biblioteki i mogą wskazywać wpisy z Nauki — np. tajemnicę różańca, o której jest kazanie.
        Własne rodzaje tekstów (np. „Kazanie maryjne”) dodają tekstom pola. Każdy obszar ma co najwyżej jedno skryptorium: czytają i uzupełniają je
        wszyscy z kluczem obszaru, a gdy obszar jest publiczny — czyta każdy. Tekst staje się publiczny, gdy przeniesiesz go do skryptorium obszaru publicznego.
      </p>

      {scriptoria.length > 0 && (
        <ul className="lib-libraries">
          {scriptoria.map((one) => (
            <li key={one.libraryId}>
              <a className="lib-library" href={viewPath('scriptorium', one.libraryId)}>
                <span className="lib-library-name">{one.name}</span>
                <span className="lib-library-meta">{count(one.entries, 'wpis', 'wpisy', 'wpisów')} · {areaName(one.areaId)} · widzą: {audienceWords(one)}{one.writes ? '' : ' · tylko do czytania'}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {(privateFree || writable.length > 0) && (
        <form className="wk-form lib-new" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <h2 className="wk-h2">{scriptoria.length === 0 ? 'Załóż skryptorium' : 'Nowe skryptorium'}</h2>
          <label className="wk-field">
            <span>Nazwa</span>
            <input value={name} placeholder="np. Kazania i konferencje" onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="wk-field">
            <span>Kto je widzi</span>
            <AreaPick
              label="Kto je widzi" value={areaId} onChange={setAreaId} areas={areas} only={writable.filter((a) => a.personal !== true)}
              extras={privateFree ? [{ value: '', label: personal === undefined ? 'Tylko ja (utworzy się prywatny obszar)' : 'Tylko ja' }] : []}
            />
          </label>
          {chosen?.publicLevel !== undefined && chosen.publicLevel !== 'none' && <p className="wk-warn">Obszar „{chosen.name}” jest publiczny: wszystko w tym skryptorium przeczyta każdy, także bez konta.</p>}
          {failed !== null && <p className="wk-error">{failed}</p>}
          <div className="wk-actions"><button type="submit" className="wk-btn" disabled={busy || (areaId === '' && !privateFree)}>{busy ? 'Zakładanie…' : 'Załóż'}</button></div>
        </form>
      )}
    </>
  );
}

/* -- Ein Skryptorium -------------------------------------------------------------------------- */

function ScriptoriumHome({ me, who, library, areas, trail, onChanged }: {
  me: Me;
  who: Who;
  library: OpenLibrary;
  areas: readonly AreaRow[];
  trail: readonly string[];
  onChanged: () => void;
}) {
  const { store, failed } = useLibraryStore(me.ring, library);
  const first = trail[0] ?? 'teksty';

  if (store === null) return null;
  if (failed !== null && !store.loaded) return <p className="wk-error">{failed}</p>;
  if (!store.loaded) return <p className="wk-lede">Otwieranie skryptorium…</p>;

  if (isUuid(first)) return <WritingEditor me={me} who={who} store={store} library={library} entryId={first} kind={store.get(first)?.kind ?? null} />;
  if (first === 'nowy' && isWritingKind(trail[1] ?? '')) {
    return <WritingEditor me={me} who={who} store={store} library={library} entryId={null} kind={trail[1]!} preset={presetFrom(trail[2])} />;
  }

  const tab = first === 'ustawienia' || first === 'json' || first === 'stare' ? first : (TABS.find((t) => t.slug === first)?.slug ?? 'teksty');
  const old = oldEntriesOf(store, isWritingKind).length;
  const here = (...rest: string[]) => viewPath('scriptorium', library.libraryId, ...rest);

  return (
    <>
      <h1 className="wk-h1">{library.name}</h1>
      {store.unreadable > 0 && <p className="wk-note">Zapieczętowane kluczem, którego nie masz: {count(store.unreadable, 'wpis', 'wpisy', 'wpisów')}.</p>}
      <nav className="wk-tabs lib-tabs" aria-label="Działy skryptorium">
        {TABS.map((t) => (
          <a key={t.slug} className={t.slug === tab ? 'wk-tab wk-tab-on' : 'wk-tab'} href={here(t.slug)}>
            {kindOf(t.kind)!.plural} <span className="lib-count">{store.ofKind(t.kind).length}</span>
          </a>
        ))}
        <a className={tab === 'json' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={here('json')}>Import / eksport</a>
        <a className={tab === 'ustawienia' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={here('ustawienia')}>Ustawienia</a>
        {(old > 0 || tab === 'stare') && <a className={tab === 'stare' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={here('stare')}>Stare wpisy <span className="lib-count">{old}</span></a>}
      </nav>
      <div className="wk-panel">
        {tab === 'ustawienia' ? <Settings me={me} store={store} library={library} areas={areas} onChanged={onChanged} />
          : tab === 'json' ? <ScriptoriumJson me={me} store={store} library={library} />
          : tab === 'stare' ? <OldEntries store={store} known={isWritingKind} writes={library.writes} where="Źródła (dzieła, cytaty, osoby) są w Bibliotece, komentarze to rodzaj w Nauce." />
          : <KindList store={store} library={library} kind={TABS.find((t) => t.slug === tab)!.kind} />}
      </div>
    </>
  );
}

/** `nowy/text/project=<id>&textType=<id>` — ein neuer Eintrag mit schon gewählten Feldern. */
function presetFrom(part: string | undefined): Record<string, unknown> {
  if (part === undefined) return {};
  const out: Record<string, unknown> = {};
  for (const pair of part.split('&')) {
    const [k, v] = pair.split('=');
    if (k !== undefined && v !== undefined && /^[a-z]+$/i.test(k)) out[k] = decodeURIComponent(v);
  }
  return out;
}

/** Was in einer Liste unter dem Titel steht. */
function metaOf(entry: Entry, store: LibraryStore): string {
  const d = entry.data;
  switch (entry.kind) {
    case 'text': {
      const held = deliveriesOf(entry, store).length;
      return [textTypeName(d, store), str(d, 'date'), TEXT_STATUS.find((s) => s.value === str(d, 'status'))?.label ?? '', count(wordCount(str(d, 'body')), 'słowo', 'słowa', 'słów'), held > 0 ? `wygłoszony ${held}×` : '', entry.key === undefined ? '' : `[@${entry.key}]`].filter(Boolean).join(' · ');
    }
    case 'delivery': return [str(d, 'occasion'), str(d, 'place'), str(d, 'duration')].filter(Boolean).join(' · ');
    case 'project': {
      const texts = store.ofKind('text').filter((t) => ids(t.data, 'project').includes(entry.id));
      const words = texts.reduce((n, t) => n + wordCount(str(t.data, 'body')), 0);
      const target = num(d, 'targetWords');
      return [count(texts.length, 'tekst', 'teksty', 'tekstów'), `${count(words, 'słowo', 'słowa', 'słów')}${target !== null && target > 0 ? ` z ${target}` : ''}`].join(' · ');
    }
    case 'texttype': {
      const fields = Array.isArray(d.fields) ? d.fields.length : 0;
      const texts = store.readable().filter((t) => t.kind === 'text' && ids(t.data, 'textType').includes(entry.id)).length;
      return [count(fields, 'pole', 'pola', 'pól'), count(texts, 'tekst', 'teksty', 'tekstów'), entry.key === undefined ? '' : `@${entry.key}`].filter(Boolean).join(' · ');
    }
    default: return '';
  }
}

function KindList({ store, library, kind }: { store: LibraryStore; library: OpenLibrary; kind: string }) {
  const def = kindOf(kind)!;
  const [query, setQuery] = useState('');
  /* Texte nach Rodzaj: „" alle, „-" ohne Rodzaj, sonst die Kennung. */
  const [type, setType] = useState('');
  const { picked, toggle, set } = usePicked();
  const types = store.ofKind('texttype');
  let list: Entry[] = query.trim() === '' ? store.ofKind(kind) : store.ownSearch(query, [kind]);
  if (kind === 'text' && type !== '') list = list.filter((t) => (type === '-' ? ids(t.data, 'textType').length === 0 : ids(t.data, 'textType').includes(type)));
  list = [...list].sort((a, b) => def.sort(b, store).localeCompare(def.sort(a, store), 'pl') * (kind === 'text' || kind === 'delivery' ? 1 : -1));
  const add = viewPath('scriptorium', library.libraryId, 'nowy', kind, kind === 'text' && type !== '' && type !== '-' ? `textType=${type}` : '');

  return (
    <>
      <div className="lib-toolbar">
        <input type="search" value={query} placeholder={`Szukaj: ${def.plural.toLowerCase()}`} onChange={(e) => setQuery(e.target.value)} aria-label={`Szukaj: ${def.plural}`} />
        {kind === 'text' && types.length > 0 && (
          <select value={type} aria-label="Rodzaj tekstu" onChange={(e) => setType(e.target.value)}>
            <option value="">wszystkie rodzaje</option>
            <option value="-">bez rodzaju</option>
            {types.map((t) => <option key={t.id} value={t.id}>{store.title(t)}</option>)}
          </select>
        )}
        {library.writes && <a className="wk-btn" href={add}>+ {def.label}</a>}
      </div>
      {list.length === 0 ? <p className="wk-empty">{store.ofKind(kind).length === 0 ? 'Nie ma jeszcze żadnego wpisu tego rodzaju.' : 'Nic nie pasuje.'}</p> : (
        <ul className="lib-list">
          {list.map((entry) => (
            <li key={entry.id} className={library.writes ? 'has-pick' : undefined}>
              {library.writes && <PickBox checked={picked.has(entry.id)} label={store.title(entry)} onToggle={() => toggle(entry.id)} />}
              <a className="lib-row" href={viewPath('scriptorium', library.libraryId, entry.id)}>
                <span className="lib-row-title">{store.title(entry)}</span>
                <span className="lib-row-meta">{metaOf(entry, store)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <PickBar store={store} picked={picked} all={list.map((e) => e.id)} onPicked={set} writes={library.writes} />
    </>
  );
}

/* -- JSON --------------------------------------------------------------------------------------- */

function ScriptoriumJson({ me, store, library }: { me: Me; store: LibraryStore; library: OpenLibrary }) {
  const [kinds, setKinds] = useState<readonly string[]>(WRITING_KINDS.map((k) => k.kind));
  const lens = useLens(me, store);
  const format = scriptoriumFormat(store, library.name, lens);
  const preview = (doc: unknown): JsonPreview | { error: string } => {
    const planned = format.plan(doc);
    return 'error' in planned ? planned : { lines: planned.lines, warnings: planned.warnings };
  };
  return (
    <>
      <fieldset className="lib-kinds">
        <legend>Co eksportować</legend>
        {WRITING_KINDS.map((k) => (
          <label key={k.kind} className="pe-check">
            <input type="checkbox" checked={kinds.includes(k.kind)} onChange={(e) => setKinds(e.target.checked ? [...kinds, k.kind] : kinds.filter((x) => x !== k.kind))} />
            <span>{k.plural} ({store.ofKind(k.kind).length})</span>
          </label>
        ))}
      </fieldset>
      <JsonPanel
        summary="JSON skryptorium — eksport i import"
        lead={<>Teksty, wygłoszenia, projekty i rodzaje tekstów jako jeden dokument — kopia zapasowa, przeniesienie, praca z AI. Import zmienia istniejące wpisy w miejscu i dodaje nowe; niczego nie usuwa.</>}
        fileName={`skryptorium-${library.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`}
        exportDoc={() => format.exportDoc(store.all().filter((e) => kinds.includes(e.kind) && isWritingKind(e.kind)))}
        description={format.describe}
        preview={preview}
        importLabel="Importuj i zapisz"
        onImport={async (doc, stage) => {
          if (!library.writes) throw new WorkspaceError('W tym skryptorium możesz tylko czytać.');
          const planned = format.plan(doc);
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

/* -- Einstellungen ------------------------------------------------------------------------------- */

function Settings({ me, store, library, areas, onChanged }: { me: Me; store: LibraryStore; library: OpenLibrary; areas: readonly AreaRow[]; onChanged: () => void }) {
  const [name, setName] = useState(library.name);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const area = areas.find((a) => a.areaId === library.areaId);
  const act = async (todo: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try { await todo(); onChanged(); } catch (e) { setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.'); } finally { setBusy(false); }
  };
  const texts = (entries: readonly LibEntry[]) => entries.filter((e) => e.kind === 'text').length;

  return (
    <>
      <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void act(() => renameLibrary(me.ring, library, name)); }}>
        <label className="wk-field"><span>Nazwa</span><input value={name} disabled={!library.writes} onChange={(e) => setName(e.target.value)} /></label>
        {library.writes && <div className="wk-actions"><button type="submit" className="wk-btn" disabled={busy || name.trim() === ''}>Zapisz nazwę</button></div>}
      </form>

      <section className="wk-form">
        <h2 className="wk-h2">Kto widzi</h2>
        <p>Obszar: {area?.personal === true ? 'tylko Ty' : area?.name ?? 'nieznany'}. Widzą: {audienceWords(library)}{library.writes ? '' : ' (Ty możesz tylko czytać)'}. Żeby tekst stał się publiczny (albo przestał), przenieś go do skryptorium innego obszaru — przy tekście, w ramce „Kto widzi”.</p>
        <SettleBox store={store} library={library} busy={busy} understood={understood} onUnderstood={setUnderstood} onSettle={() => void act(() => settleLibrary(library.libraryId))} />
      </section>

      {library.writes && (
        <section className="wk-form lib-danger">
          <h2 className="wk-h2">Usuń skryptorium</h2>
          <p>Usuwa wszystkie wpisy ({store.all().length}, w tym {count(texts(store.all()), 'tekst', 'teksty', 'tekstów')}); strony, które je pokazywały, napiszą, że tekstu już nie ma. Tego nie da się cofnąć. Najpierw zrób eksport (Import / eksport).</p>
          <label className="wk-field"><span>Wpisz nazwę skryptorium, żeby potwierdzić</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
          <div className="wk-actions">
            <button type="button" className="wk-btn lib-btn-danger" disabled={busy || confirm.trim() !== library.name.trim()}
              onClick={() => void act(async () => { await deleteLibrary(library.libraryId); window.location.hash = viewPath('scriptorium'); })}>
              Usuń na zawsze
            </button>
          </div>
        </section>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </>
  );
}
