/**
 * 2026-10-24 — DER CZYTNIK: der Text eines Werks, zum Lesen und Zitieren.
 *
 * <code>
 *   #/workspace/library/&lt;bibliothek&gt;/&lt;werk&gt;/tekst                der Anfang
 *   #/workspace/library/&lt;bibliothek&gt;/&lt;werk&gt;/tekst/&lt;stelle&gt;       genau dort („J 21,15-17", „nr 24", „s. 45")
 * </code>
 *
 * Links das Verzeichnis der Teile, in der Mitte der Teil — Stellen am Rand, Seitenwechsel im
 * Fluss, Fussnoten mit Sprung. Oben: zu einer Stelle springen, im ganzen Text suchen (die Teile
 * werden dafür geholt), eine andere Ausgabe daneben stellen (ausgerichtet an den Stellen der
 * Struktur — Verse, Nummern, Paragraphen sind in jeder Ausgabe dieselben). Wer Text markiert,
 * bekommt „Dodaj cytat" mit genau dieser Stelle.
 *
 * Gelesen wird nur, was dieser Leser lesen darf: die Texte kommen aus den Bibliotheken, die er
 * offen hat, und ein Teil wird mit dem Schlüssel seines Bereichs geöffnet.
 */

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { Loading } from '../ui/Loading';
import { viewPath } from '../routes';
import { containerPath, type OpenLibrary } from './library';
import { kindOf, type LibEntry } from './libraryKinds';
import { loadedStores, type Entry, type LibraryStore } from './libraryStore';
import { overlap, parsePlace, type Span } from './locations';
import { SourceBlockView } from './SourceBlocks';
import { finderOf, openPart } from './sourceFind';
import {
  alignEditions, editionsOf, findBlocks, pageRangeLabel, placeInManifest, placeOptions, readPart, searchParts, selectionLocator, textsOfWork,
  type ManifestPart, type PartData, type SourceBlock, type TextHit, type TextManifest, type WorkText
} from './sourceText';

export function SourceReader({ store, library, workId, at, writable }: {
  store: LibraryStore;
  library: OpenLibrary;
  workId: string;
  /** Die Stelle aus der Adresse. */
  at: string;
  /** Bibliotheken, in die ein Zitat gehen kann. */
  writable: readonly OpenLibrary[];
}) {
  const work = store.get(workId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const texts = useMemo(() => textsOfWork(finderOf(store), workId), [store, store.revision, workId]);
  const [textId, setTextId] = useState<string | null>(null);
  const text = texts.find((t) => t.entry.id === textId) ?? texts[0];

  if (work === undefined) return <p className="wk-empty">Tego dzieła nie ma (albo nie masz do niego dostępu). <a href={viewPath('library', library.libraryId)}>Wróć do biblioteki</a></p>;
  const title = kindOf('work')!.title(work.data, store);
  const back = containerPath((work as Entry).libraryId ?? library.libraryId, work.id);
  if (text === undefined) {
    return (
      <div className="src-reader">
        <a className="wk-link" href={back}>← {title}</a>
        <p className="wk-empty">To dzieło nie ma jeszcze tekstu, który możesz czytać. Dodasz go na stronie dzieła („Tekst źródła”).</p>
      </div>
    );
  }
  return (
    <div className="src-reader">
      <header className="src-head">
        <a className="wk-link" href={back}>← {title}</a>
        <h1 className="wk-h1">{title}</h1>
        {texts.length > 1 && (
          <label className="wk-field">
            <span>Tekst</span>
            <select value={text.entry.id} onChange={(e) => setTextId(e.target.value)}>
              {texts.map((t, i) => <option key={t.entry.id} value={t.entry.id}>Tekst {i + 1} — {t.manifest.parts.length} części</option>)}
            </select>
          </label>
        )}
        {text.manifest.edition.note !== undefined && <p className="lib-row-meta">{text.manifest.edition.note}</p>}
      </header>
      <Reading key={text.entry.id} store={store} library={library} work={work} text={text} at={at} writable={writable} />
    </div>
  );
}

function Reading({ store, library, work, text, at, writable }: {
  store: LibraryStore;
  library: OpenLibrary;
  work: LibEntry;
  text: WorkText;
  at: string;
  writable: readonly OpenLibrary[];
}) {
  const { manifest } = text;
  const textLibrary = (text.entry as Entry).libraryId ?? library.libraryId;
  const here = (locator?: string) => viewPath('library', textLibrary, work.id, 'tekst', ...(locator === undefined || locator === '' ? [] : [locator]));
  const atPlace = useMemo(() => (at === '' ? null : placeInManifest(manifest, at)), [manifest, at]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  useEffect(() => { setChosen(null); setFocus(null); }, [at]);
  const part = manifest.parts.find((p) => p.id === chosen) ?? atPlace?.part ?? manifest.parts[0];

  const [data, setData] = useState<PartData | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (part === undefined) { setData(null); return undefined; }
    setData(undefined);
    void openPart(store, part.id).then((entry) => { if (alive) setData(entry === null ? null : readPart(entry.data)); });
    return () => { alive = false; };
  }, [store, part?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const hits = useMemo(() => {
    if (data === null || data === undefined) return new Set<number>();
    if (focus !== null) return new Set([focus]);
    if (at === '' || chosen !== null) return new Set<number>();
    return new Set(findBlocks(data.blocks, parsePlace(at, manifest.scheme, placeOptions(manifest.edition)), manifest.scheme, manifest.edition));
  }, [data, at, chosen, focus, manifest]);

  /* Zur ersten getroffenen Stelle rollen, sobald der Teil da ist. */
  const prefix = `src-${part?.id ?? 'x'}-`;
  useEffect(() => {
    const first = [...hits].sort((a, b) => a - b)[0];
    if (first === undefined) return;
    document.getElementById(`${prefix}b-${first}`)?.scrollIntoView({ block: 'center' });
  }, [hits, prefix]);

  const [go, setGo] = useState(at);
  const submitGo = (e: FormEvent) => { e.preventDefault(); window.location.hash = here(go.trim()); };

  /* -- Daneben: eine andere Ausgabe ------------------------------------------------------- */
  const editions = useMemo(() => editionsOf(store, work).map((e) => ({ work: e, texts: textsOfWork(finderOf(store), e.id) })).filter((e) => e.texts.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, store.revision, work]);
  const [besideId, setBesideId] = useState('');
  const beside = editions.find((e) => e.work.id === besideId);

  if (part === undefined) return <p className="wk-empty">Ten tekst nie ma jeszcze żadnej części.</p>;
  return (
    <div className="src-layout">
      <nav className="src-toc" aria-label="Części tekstu">
        <h2 className="lib-box-h">Części</h2>
        <ol>
          {manifest.parts.map((p) => (
            <li key={p.id}>
              <button type="button" className={p.id === part.id ? 'src-toc-item is-on' : 'src-toc-item'} aria-current={p.id === part.id ? 'true' : undefined}
                onClick={() => { setChosen(p.id); setFocus(null); }}>
                <span>{p.label}</span>
                <span className="src-toc-meta">{[p.first !== undefined ? `${p.first}${p.last !== undefined && p.last !== p.first ? ` – ${p.last}` : ''}` : '', pageRangeLabel(p.pages)].filter((x) => x !== '').join(' · ')}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="src-main">
        <div className="src-tools">
          <form className="src-go" onSubmit={submitGo}>
            <input value={go} onChange={(e) => setGo(e.target.value)} placeholder={manifest.scheme === 'bible' ? 'J 21,15' : manifest.scheme === 'pages' ? 's. 45' : 'miejsce'} aria-label="Przejdź do miejsca" />
            <button type="submit" className="wk-btn wk-btn-quiet">Przejdź</button>
          </form>
          <TextSearch store={store} manifest={manifest} onPick={(hit) => { setChosen(hit.part.id); setFocus(hit.index); }} />
          {editions.length > 0 && (
            <label className="src-beside">
              <span>Obok</span>
              <select value={besideId} onChange={(e) => setBesideId(e.target.value)}>
                <option value="">— inne wydanie —</option>
                {editions.map((e) => <option key={e.work.id} value={e.work.id}>{kindOf('work')!.title(e.work.data, store)}</option>)}
              </select>
            </label>
          )}
        </div>
        {atPlace !== null && atPlace.status !== 'found' && chosen === null && <p className="wk-note">„{at}”: {atPlace.why}</p>}
        {atPlace !== null && atPlace.status === 'found' && atPlace.why !== '' && chosen === null && <p className="wk-note">{atPlace.why}</p>}
        <h2 className="src-part-h">{part.label}</h2>
        {data === undefined ? <Loading lines={4} label="Otwieranie tekstu…" />
          : data === null ? <p className="wk-empty">Tej części nie da się teraz otworzyć.</p>
          : beside === undefined
            ? <Picked store={store} work={work} manifest={manifest} blocks={data.blocks} writable={writable}>
              <div className="src-flow">{data.blocks.map((b, i) => <SourceBlockView key={i} block={b} index={i} prefix={prefix} hit={hits.has(i)} />)}</div>
            </Picked>
            : <Parallel store={store} work={work} manifest={manifest} part={part} blocks={data.blocks} prefix={prefix} hits={hits} other={beside.texts[0]!} writable={writable} />}
      </div>
    </div>
  );
}

/* -- Suchen im ganzen Text --------------------------------------------------------------------- */

function TextSearch({ store, manifest, onPick }: { store: LibraryStore; manifest: TextManifest; onPick: (hit: TextHit) => void }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<{ busy: string | null; hits: TextHit[] | null }>({ busy: null, hits: null });
  const run = async (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setState({ busy: 'Otwieranie tekstu…', hits: null });
    const loaded: { part: ManifestPart; data: PartData }[] = [];
    let done = 0;
    for (const p of manifest.parts) {
      const entry = await openPart(store, p.id);
      done += 1;
      if (manifest.parts.length > 3) setState({ busy: `Otwieranie części ${done} z ${manifest.parts.length}…`, hits: null });
      if (entry !== null) loaded.push({ part: p, data: readPart(entry.data) });
    }
    setState({ busy: null, hits: searchParts(loaded, query) });
  };
  return (
    <div className="src-search">
      <form className="src-go" onSubmit={(e) => void run(e)}>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj w tekście" aria-label="Szukaj w całym tekście" />
        <button type="submit" className="wk-btn wk-btn-quiet" disabled={state.busy !== null}>Szukaj</button>
      </form>
      {state.busy !== null && <Loading lines={1} label={state.busy} />}
      {state.hits !== null && (state.hits.length === 0 ? <p className="wk-empty">Nie znaleziono.</p> : (
        <ul className="lib-search-hits src-hits">
          {state.hits.map((hit) => (
            <li key={`${hit.part.id}-${hit.index}`}>
              <button type="button" className="src-hit" onClick={() => { onPick(hit); setState({ busy: null, hits: null }); }}>
                <span className="lib-option-kind">{hit.loc || hit.part.label}</span> {hit.snippet}
              </button>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

/* -- Eine Auswahl wird ein Zitat -------------------------------------------------------------- */

interface Pick { readonly text: string; readonly locator: string }

function Picked({ store, work, manifest, blocks, writable, children }: {
  store: LibraryStore;
  work: LibEntry;
  manifest: TextManifest;
  blocks: readonly SourceBlock[];
  writable: readonly OpenLibrary[];
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState<Pick | null>(null);
  const [copied, setCopied] = useState(false);
  const indexOf = (node: Node | null): number | null => {
    const el = node === null ? null : (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement);
    const block = el?.closest('[data-block]');
    if (block === null || block === undefined || !box.current?.contains(block)) return null;
    return Number(block.getAttribute('data-block'));
  };
  const onUp = () => {
    const sel = window.getSelection();
    if (sel === null || sel.isCollapsed) { setPick(null); return; }
    const a = indexOf(sel.anchorNode);
    const b = indexOf(sel.focusNode);
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    /* Nur aus diesem Text (die Spalte daneben ist eine andere Ausgabe, mit eigenen Stellen). */
    if (a === null || b === null || a < 0 || b < 0 || text === '') { setPick(null); return; }
    setCopied(false);
    setPick({ text, locator: selectionLocator(blocks, a, b, manifest.scheme, manifest.edition) });
  };
  /* Das Zitat kommt in die Bibliothek des Werks, wenn man dort schreibt — sonst in eine andere, in die man schreibt. */
  const home = store.homeOf(work.id)?.libraryId ?? loadedStores().find((s) => s.own(work.id) !== undefined)?.libraryId;
  const into = writable.find((l) => l.libraryId === home) ?? writable[0];
  const preset = pick === null ? '' : `work=${encodeURIComponent(work.id)}&locator=${encodeURIComponent(pick.locator)}&text=${encodeURIComponent(pick.text)}`;
  return (
    <div ref={box} onMouseUp={onUp} onKeyUp={onUp} onTouchEnd={onUp}>
      {children}
      {pick !== null && (
        <div className="src-pick" role="region" aria-label="Zaznaczony fragment">
          <span className="src-pick-text">„{pick.text.length > 90 ? `${pick.text.slice(0, 89)}…` : pick.text}”{pick.locator === '' ? '' : `, ${pick.locator}`}</span>
          {into !== undefined && <a className="wk-btn" href={viewPath('library', into.libraryId, 'nowy', 'quote', preset)}>Dodaj cytat</a>}
          <button type="button" className="wk-btn wk-btn-quiet" onClick={() => {
            void navigator.clipboard.writeText(`„${pick.text}” (${kindOf('work')!.title(work.data, store)}${pick.locator === '' ? '' : `, ${pick.locator}`})`).then(() => setCopied(true), () => setCopied(false));
          }}>{copied ? 'Skopiowano' : 'Kopiuj z miejscem'}</button>
          <button type="button" className="wk-link-btn" onClick={() => { window.getSelection()?.removeAllRanges(); setPick(null); }}>Zamknij</button>
        </div>
      )}
    </div>
  );
}

/* -- Zwei Ausgaben nebeneinander ------------------------------------------------------------- */

function rangeOf(p: ManifestPart, manifest: TextManifest): Span | null {
  if (p.first === undefined) return null;
  const opts = placeOptions(manifest.edition);
  const a = parsePlace(p.first, manifest.scheme, opts).spans[0];
  const b = parsePlace(p.last ?? p.first, manifest.scheme, opts).spans.slice(-1)[0];
  return a === undefined || b === undefined ? null : { from: a.from, to: b.to };
}

function Parallel({ store, work, manifest, part, blocks, prefix, hits, other, writable }: {
  store: LibraryStore;
  work: LibEntry;
  manifest: TextManifest;
  part: ManifestPart;
  blocks: readonly SourceBlock[];
  prefix: string;
  hits: ReadonlySet<number>;
  other: WorkText;
  writable: readonly OpenLibrary[];
}) {
  const [theirs, setTheirs] = useState<SourceBlock[] | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const mine = rangeOf(part, manifest);
    const wanted = other.manifest.parts.filter((p) => {
      const r = rangeOf(p, other.manifest);
      return mine !== null && r !== null && overlap(mine, r);
    });
    if (wanted.length === 0) { setTheirs(null); return undefined; }
    setTheirs(undefined);
    void Promise.all(wanted.map((p) => openPart(store, p.id))).then((entries) => {
      if (alive) setTheirs(entries.filter((e): e is LibEntry => e !== null).flatMap((e) => readPart(e.data).blocks as SourceBlock[]));
    });
    return () => { alive = false; };
  }, [store, part, manifest, other]);

  if (theirs === undefined) return <Loading lines={4} label="Otwieranie drugiego wydania…" />;
  if (theirs === null) return <p className="wk-empty">Drugie wydanie nie ma tej części (albo nie ma w niej miejsc tej struktury — strony się nie przenoszą).</p>;

  /* Zeilen an den Stellen der Struktur (`alignEditions`): jeder Block mit eigener Stelle beginnt eine. */
  const { rows, rest } = alignEditions(blocks, theirs, manifest, other.manifest);
  const otherPrefix = `${prefix}o-`;
  return (
    <Picked store={store} work={work} manifest={manifest} blocks={blocks} writable={writable}>
      <div className="src-parallel">
        {rows.map((row, r) => (
          <div key={r} className="src-row">
            <div className="src-col">{row.mine.map((i) => <SourceBlockView key={i} block={blocks[i]!} index={i} prefix={prefix} hit={hits.has(i)} />)}</div>
            <div className="src-col is-other">{row.theirs.map((j) => <SourceBlockView key={j} block={theirs[j]!} index={-1 - j} prefix={otherPrefix} />)}</div>
          </div>
        ))}
        {rest.length > 0 && (
          <div className="src-row">
            <div className="src-col" />
            <div className="src-col is-other">{rest.map((j) => <SourceBlockView key={j} block={theirs[j]!} index={-1 - j} prefix={otherPrefix} />)}</div>
          </div>
        )}
      </div>
    </Picked>
  );
}
