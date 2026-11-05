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
import { useT, type T } from '../core/i18n';
import { useMe, type Me } from '../core/me';
import { WorkspaceError, type Who } from '../core/session';
import { useCrumbs } from '../shell/crumbTrail';
import { JsonPanel, type JsonPreview } from '../ui/JsonPanel';
import { Loading } from '../ui/Loading';
import { viewPath } from '../routes';
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
  const t = useT();
  const me = useMe(who);
  if (me === undefined) return <Loading label={t('common.loading')} />;
  if (me === null) return <p className="wk-note">{t('scriptorium.view.noKey')}</p>;
  return <Scriptoria me={me} who={who} trail={trail} />;
}

function Scriptoria({ me, who, trail }: { me: Me; who: Who; trail: readonly string[] }) {
  const t = useT();
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
        if (alive) setFailed(e instanceof WorkspaceError ? e.message : t('scriptorium.view.loadFailed'));
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  if (rows === null) return <Loading label={t('common.loading')} />;

  if (id !== undefined) {
    const other = rows.find((one) => one.libraryId === id);
    if (current === null && other !== undefined) {
      return libraryKindOf(other) === 'knowledge'
        ? <p className="wk-note">{t('scriptorium.view.isKnowledge')} <a href={viewPath('knowledge', id)}>{t('scriptorium.view.openIt')}</a></p>
        : <p className="wk-note">{t('scriptorium.view.isLibrary')} <a href={viewPath('library', id)}>{t('scriptorium.view.openIt')}</a></p>;
    }
    if (current === null) return <p className="wk-empty">{t('scriptorium.view.missing')} <a href={viewPath('scriptorium')}>{t('scriptorium.view.all')}</a></p>;
    return <ScriptoriumHome me={me} who={who} library={current} areas={areas} trail={trail.slice(1)} onChanged={() => setTick((n) => n + 1)} />;
  }
  return <ScriptoriumList me={me} scriptoria={scriptoria} areas={areas} onChanged={() => setTick((n) => n + 1)} />;
}

/* -- Die Skryptoria ------------------------------------------------------------------------------ */

function ScriptoriumList({ me, scriptoria, areas, onChanged }: { me: Me; scriptoria: readonly OpenLibrary[]; areas: readonly AreaRow[]; onChanged: () => void }) {
  const t = useT();
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
      const made = await createLibrary(me.ring, area, name.trim() === '' ? t('scriptorium.view.defaultName') : name, 'writing');
      onChanged();
      window.location.hash = viewPath('scriptorium', made);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('scriptorium.view.createFailed'));
    } finally {
      setBusy(false);
    }
  };
  const areaName = (one: string) => areas.find((a) => a.areaId === one)?.personal === true ? t('scriptorium.view.onlyYou') : areas.find((a) => a.areaId === one)?.name ?? t('scriptorium.view.area');

  return (
    <>
      <h1 className="wk-h1">{t('scriptorium.view.title')}</h1>
      <p className="wk-lede">
        {t('scriptorium.view.lede')}
      </p>

      {scriptoria.length > 0 && (
        <ul className="lib-libraries">
          {scriptoria.map((one) => (
            <li key={one.libraryId}>
              <a className="lib-library" href={viewPath('scriptorium', one.libraryId)}>
                <span className="lib-library-name">{one.name}</span>
                <span className="lib-library-meta">{t('scriptorium.view.rowMeta', { entries: t('scriptorium.count.entries', { count: one.entries }), area: areaName(one.areaId), audience: audienceWords(one) })}{one.writes ? '' : t('scriptorium.view.readOnlySuffix')}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {(privateFree || writable.length > 0) && (
        <form className="wk-form lib-new" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <h2 className="wk-h2">{scriptoria.length === 0 ? t('scriptorium.view.createFirst') : t('scriptorium.view.createAnother')}</h2>
          <label className="wk-field">
            <span>{t('common.name')}</span>
            <input value={name} placeholder={t('scriptorium.view.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="wk-field">
            <span>{t('scriptorium.view.whoSees')}</span>
            <AreaPick
              label={t('scriptorium.view.whoSees')} value={areaId} onChange={setAreaId} areas={areas} only={writable.filter((a) => a.personal !== true)}
              extras={privateFree ? [{ value: '', label: personal === undefined ? t('scriptorium.view.onlyMeNew') : t('scriptorium.view.onlyMe') }] : []}
            />
          </label>
          {chosen?.publicLevel !== undefined && chosen.publicLevel !== 'none' && <p className="wk-warn">{t('scriptorium.view.publicWarn', { name: chosen.name })}</p>}
          {failed !== null && <p className="wk-error">{failed}</p>}
          <div className="wk-actions"><button type="submit" className="wk-btn" disabled={busy || (areaId === '' && !privateFree)}>{busy ? t('scriptorium.view.creating') : t('scriptorium.view.create')}</button></div>
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
  const t = useT();
  const { store, failed } = useLibraryStore(me.ring, library);
  const first = trail[0] ?? 'teksty';

  if (store === null) return null;
  if (failed !== null && !store.loaded) return <p className="wk-error">{failed}</p>;
  if (!store.loaded) return <p className="wk-lede">{t('scriptorium.view.opening')}</p>;

  if (isUuid(first)) return <WritingEditor me={me} who={who} store={store} library={library} entryId={first} kind={store.get(first)?.kind ?? null} />;
  if (first === 'nowy' && isWritingKind(trail[1] ?? '')) {
    return <WritingEditor me={me} who={who} store={store} library={library} entryId={null} kind={trail[1]!} preset={presetFrom(trail[2])} />;
  }

  const tab = first === 'ustawienia' || first === 'json' || first === 'stare' ? first : (TABS.find((one) => one.slug === first)?.slug ?? 'teksty');
  const old = oldEntriesOf(store, isWritingKind).length;
  const here = (...rest: string[]) => viewPath('scriptorium', library.libraryId, ...rest);

  return (
    <>
      <h1 className="wk-h1">{library.name}</h1>
      {store.unreadable > 0 && <p className="wk-note">{t('scriptorium.view.unreadable', { entries: t('scriptorium.count.entries', { count: store.unreadable }) })}</p>}
      <nav className="wk-tabs lib-tabs" aria-label={t('scriptorium.view.tabs')}>
        {TABS.map((one) => (
          <a key={one.slug} className={one.slug === tab ? 'wk-tab wk-tab-on' : 'wk-tab'} href={here(one.slug)}>
            {kindOf(one.kind)!.plural} <span className="lib-count">{store.ofKind(one.kind).length}</span>
          </a>
        ))}
        <a className={tab === 'json' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={here('json')}>{t('scriptorium.view.tabJson')}</a>
        <a className={tab === 'ustawienia' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={here('ustawienia')}>{t('common.settings')}</a>
        {(old > 0 || tab === 'stare') && <a className={tab === 'stare' ? 'wk-tab wk-tab-on' : 'wk-tab'} href={here('stare')}>{t('scriptorium.view.tabOld')} <span className="lib-count">{old}</span></a>}
      </nav>
      <div className="wk-panel">
        {tab === 'ustawienia' ? <Settings me={me} store={store} library={library} areas={areas} onChanged={onChanged} />
          : tab === 'json' ? <ScriptoriumJson me={me} store={store} library={library} />
          : tab === 'stare' ? <OldEntries store={store} known={isWritingKind} writes={library.writes} where={t('scriptorium.view.oldWhere')} />
          : <KindList store={store} library={library} kind={TABS.find((one) => one.slug === tab)!.kind} />}
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
function metaOf(entry: Entry, store: LibraryStore, t: T): string {
  const d = entry.data;
  switch (entry.kind) {
    case 'text': {
      const held = deliveriesOf(entry, store).length;
      return [textTypeName(d, store), str(d, 'date'), TEXT_STATUS.find((s) => s.value === str(d, 'status'))?.label ?? '', t('scriptorium.count.words', { count: wordCount(str(d, 'body')) }), held > 0 ? t('scriptorium.heldTimes', { count: held }) : '', entry.key === undefined ? '' : `[@${entry.key}]`].filter(Boolean).join(' · ');
    }
    case 'delivery': return [str(d, 'occasion'), str(d, 'place'), str(d, 'duration')].filter(Boolean).join(' · ');
    case 'project': {
      const texts = store.ofKind('text').filter((one) => ids(one.data, 'project').includes(entry.id));
      const words = texts.reduce((n, one) => n + wordCount(str(one.data, 'body')), 0);
      const target = num(d, 'targetWords');
      return [t('scriptorium.count.texts', { count: texts.length }), target !== null && target > 0 ? t('scriptorium.count.wordsOf', { count: words, target }) : t('scriptorium.count.words', { count: words })].join(' · ');
    }
    case 'texttype': {
      const fields = Array.isArray(d.fields) ? d.fields.length : 0;
      const texts = store.readable().filter((one) => one.kind === 'text' && ids(one.data, 'textType').includes(entry.id)).length;
      return [t('scriptorium.count.fields', { count: fields }), t('scriptorium.count.texts', { count: texts }), entry.key === undefined ? '' : `@${entry.key}`].filter(Boolean).join(' · ');
    }
    default: return '';
  }
}

function KindList({ store, library, kind }: { store: LibraryStore; library: OpenLibrary; kind: string }) {
  const t = useT();
  const def = kindOf(kind)!;
  const [query, setQuery] = useState('');
  /* Texte nach Rodzaj: „" alle, „-" ohne Rodzaj, sonst die Kennung. */
  const [type, setType] = useState('');
  const { picked, toggle, set } = usePicked();
  const types = store.ofKind('texttype');
  let list: Entry[] = query.trim() === '' ? store.ofKind(kind) : store.ownSearch(query, [kind]);
  if (kind === 'text' && type !== '') list = list.filter((one) => (type === '-' ? ids(one.data, 'textType').length === 0 : ids(one.data, 'textType').includes(type)));
  list = [...list].sort((a, b) => def.sort(b, store).localeCompare(def.sort(a, store), t.locale) * (kind === 'text' || kind === 'delivery' ? 1 : -1));
  const add = viewPath('scriptorium', library.libraryId, 'nowy', kind, kind === 'text' && type !== '' && type !== '-' ? `textType=${type}` : '');

  return (
    <>
      <div className="lib-toolbar">
        <input type="search" value={query} placeholder={t('scriptorium.view.searchKind', { kind: def.plural.toLowerCase() })} onChange={(e) => setQuery(e.target.value)} aria-label={t('scriptorium.view.searchKind', { kind: def.plural })} />
        {kind === 'text' && types.length > 0 && (
          <select value={type} aria-label={t('scriptorium.view.textType')} onChange={(e) => setType(e.target.value)}>
            <option value="">{t('scriptorium.view.allTypes')}</option>
            <option value="-">{t('scriptorium.view.noType')}</option>
            {types.map((one) => <option key={one.id} value={one.id}>{store.title(one)}</option>)}
          </select>
        )}
        {library.writes && <a className="wk-btn" href={add}>+ {def.label}</a>}
      </div>
      {list.length === 0 ? <p className="wk-empty">{store.ofKind(kind).length === 0 ? t('scriptorium.view.noneOfKind') : t('scriptorium.view.noMatch')}</p> : (
        <ul className="lib-list">
          {list.map((entry) => (
            <li key={entry.id} className={library.writes ? 'has-pick' : undefined}>
              {library.writes && <PickBox checked={picked.has(entry.id)} label={store.title(entry)} onToggle={() => toggle(entry.id)} />}
              <a className="lib-row" href={viewPath('scriptorium', library.libraryId, entry.id)}>
                <span className="lib-row-title">{store.title(entry)}</span>
                <span className="lib-row-meta">{metaOf(entry, store, t)}</span>
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
  const t = useT();
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
        <legend>{t('scriptorium.view.json.what')}</legend>
        {WRITING_KINDS.map((k) => (
          <label key={k.kind} className="pe-check">
            <input type="checkbox" checked={kinds.includes(k.kind)} onChange={(e) => setKinds(e.target.checked ? [...kinds, k.kind] : kinds.filter((x) => x !== k.kind))} />
            <span>{k.plural} ({store.ofKind(k.kind).length})</span>
          </label>
        ))}
      </fieldset>
      <JsonPanel
        summary={t('scriptorium.view.json.summary')}
        lead={t('scriptorium.view.json.lead')}
        fileName={`skryptorium-${library.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`}
        exportDoc={() => format.exportDoc(store.all().filter((e) => kinds.includes(e.kind) && isWritingKind(e.kind)))}
        description={format.describe}
        preview={preview}
        importLabel={t('scriptorium.view.json.import')}
        onImport={async (doc, stage) => {
          if (!library.writes) throw new WorkspaceError(t('scriptorium.view.json.readOnly'));
          const planned = format.plan(doc);
          if ('error' in planned) throw new WorkspaceError(planned.error);
          const warnings = [...planned.warnings];
          let done = 0;
          for (const draft of planned.drafts) {
            stage(t('scriptorium.view.json.saving', { n: done + 1, total: planned.drafts.length }));
            try {
              await store.save({ id: draft.id, kind: draft.kind, ...(draft.key === undefined ? {} : { key: draft.key }), data: draft.data });
              done += 1;
            } catch (e) {
              warnings.push(t('scriptorium.view.json.saveWarning', { kind: kindOf(draft.kind)?.label ?? '', name: String(draft.data.title ?? draft.data.name ?? draft.key ?? ''), reason: e instanceof WorkspaceError ? e.message : t('scriptorium.view.json.saveFailed') }));
            }
          }
          return { lines: [t('scriptorium.view.json.saved', { n: done, total: planned.drafts.length }), ...planned.lines], warnings };
        }}
      />
    </>
  );
}

/* -- Einstellungen ------------------------------------------------------------------------------- */

function Settings({ me, store, library, areas, onChanged }: { me: Me; store: LibraryStore; library: OpenLibrary; areas: readonly AreaRow[]; onChanged: () => void }) {
  const t = useT();
  const [name, setName] = useState(library.name);
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const area = areas.find((a) => a.areaId === library.areaId);
  const act = async (todo: () => Promise<unknown>) => {
    setBusy(true);
    setFailed(null);
    try { await todo(); onChanged(); } catch (e) { setFailed(e instanceof WorkspaceError ? e.message : t('common.failed')); } finally { setBusy(false); }
  };
  const texts = (entries: readonly LibEntry[]) => entries.filter((e) => e.kind === 'text').length;

  return (
    <>
      <form className="wk-form" onSubmit={(e) => { e.preventDefault(); void act(() => renameLibrary(me.ring, library, name)); }}>
        <label className="wk-field"><span>{t('common.name')}</span><input value={name} disabled={!library.writes} onChange={(e) => setName(e.target.value)} /></label>
        {library.writes && <div className="wk-actions"><button type="submit" className="wk-btn" disabled={busy || name.trim() === ''}>{t('scriptorium.view.settings.saveName')}</button></div>}
      </form>

      <section className="wk-form">
        <h2 className="wk-h2">{t('scriptorium.view.settings.whoSees')}</h2>
        <p>{t(library.writes ? 'scriptorium.view.settings.audience' : 'scriptorium.view.settings.audienceReadOnly', { area: area?.personal === true ? t('scriptorium.view.onlyYou') : area?.name ?? t('scriptorium.view.settings.unknownArea'), audience: audienceWords(library) })}</p>
        <SettleBox store={store} library={library} busy={busy} understood={understood} onUnderstood={setUnderstood} onSettle={() => void act(() => settleLibrary(library.libraryId))} />
      </section>

      {library.writes && (
        <section className="wk-form lib-danger">
          <h2 className="wk-h2">{t('scriptorium.view.settings.delete')}</h2>
          <p>{t('scriptorium.view.settings.deleteLead', { all: store.all().length, texts: t('scriptorium.count.texts', { count: texts(store.all()) }) })}</p>
          <label className="wk-field"><span>{t('scriptorium.view.settings.deleteConfirm')}</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
          <div className="wk-actions">
            <button type="button" className="wk-btn lib-btn-danger" disabled={busy || confirm.trim() !== library.name.trim()}
              onClick={() => void act(async () => { await deleteLibrary(library.libraryId); window.location.hash = viewPath('scriptorium'); })}>
              {t('scriptorium.view.settings.deleteForever')}
            </button>
          </div>
        </section>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </>
  );
}
