/**
 * DAS ARCHIV AUF EINER SEITE (0064 „Archiwum tekstów"; 2026-10-21 für viele
 * Kazania).
 *
 * <code>
 *   Streifen          der neueste Text
 *   Block             die letzten Texte, mit Datum und kurzem Inhalt
 *   hoch, Vollbild    das ganze Archiv: Suche, je Achse ein Filter, und drei Ansichten —
 *                     Lista (nach Jahren), Tabela (je Achse eine Spalte), Drzewo (die
 *                     Werte einer Achse, mit Zahlen); ein Klick öffnet den Text mit
 *                     Plan, Wygłoszenia und Quellen (`WritingCard`)
 * </code>
 *
 * <b>Die Ordnung steht in den Rodzajach tekstów, nicht im Baustein</b>
 * (2026-10-23, Schritt 5 — vorher: Themen mit Aspekten): jedes Verweisfeld
 * eines Rodzaj tekstu ist eine Achse („Tajemnica", „Obszar"), seine Werte sind
 * die Einträge in Nauka, auf die die Texte zeigen. Entschieden: das Archiv
 * bleibt ein eigener Baustein (ein Besucher braucht keine Baza wiedzy dafür);
 * Tabelle und Macierz über Nauka gibt der Baustein „Widok". Der Baustein wählt
 * nur, mit welcher Ansicht er beginnt.
 *
 * 2026-10-22 — wer was sieht, sagt der Bereich der Bibliothek: die Seite
 * öffnet sie (`libraryOpen.ts`) und sucht, filtert, zählt hier
 * (`browseLocal`) — es gibt keine veröffentlichten Kurzfassungen mehr.
 */

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';

import { plural } from '../core/plural';
import type { PartSize } from '../pages/part';
import { Loading } from '../ui/Loading';
import { Segment } from '../ui/Segment';
import { LAYOUTS, layoutOf, layoutWord, type Layout } from './archiveLayout';
import {
  archiveRow, browseLocal, choose, facetKey, facetsOf, hashParam, orderOf, PROJECTS, setHashParams, yearOf,
  type ArchiveRow, type Facet, type Order
} from './archive';
import { usePageLibrary } from '../library/libraryOpen';
import type { LibraryStore } from '../library/libraryStore';
import { WritingCard } from './WritingCard';
import { dateWords } from './TextArticle';
import { str } from '../library/libraryKinds';

const PAGE = 30;

/** Wie das Archiv geordnet ist — nach dem letzten Halten (Datum) oder nach dem Titel. */
const ORDERS: readonly { readonly value: Order; readonly label: string }[] = [
  { value: '-sort', label: 'najnowsze' },
  { value: 'sort', label: 'najstarsze' },
  { value: 'key', label: 'tytuł A–Z' },
  { value: '-key', label: 'tytuł Z–A' }
];

export function WritingsCard({ library, title, project, layout, size, whole = false, prefix }: {
  library: string;
  title: string;
  project: string;
  /** Womit das Archiv beginnt: „lista", „tabela", „drzewo". */
  layout: string;
  size: PartSize;
  whole?: boolean;
  prefix: string;
}) {
  const big = whole || size.height === 'tall';
  const top = useRef<HTMLDivElement | null>(null);
  const { store, revision, state } = usePageLibrary(library === '' ? null : library);
  const [open, setOpen] = useState<{ text: string; delivery: string | null } | null>(() => {
    const text = hashParam('t');
    return text === null ? null : { text, delivery: hashParam('tw') };
  });

  const pick = (id: string | null) => {
    setOpen(id === null ? null : { text: id, delivery: null });
    setHashParams({ t: id, tw: null });
    window.requestAnimationFrame(() => {
      const el = top.current;
      if (el !== null && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  if (open !== null) {
    return (
      <div className="lib-archive-one" ref={top}>
        <button type="button" className="wk-link-btn" onClick={() => pick(null)}>← Wszystkie teksty</button>
        <WritingCard
          library={library} entryId={open.text} size={size} whole prefix={prefix} delivery={open.delivery}
          onDelivery={(delivery) => { setOpen({ text: open.text, delivery }); setHashParams({ tw: delivery }); }}
        />
      </div>
    );
  }

  if (state === 'loading') return <div ref={top} className="lib-archive-wrap"><Head title={title} /><Loading label="Wczytywanie…" /></div>;
  if (store === null) return <div ref={top} className="lib-archive-wrap"><Head title={title} /><p className="wk-card-text">Tego skryptorium nie widzisz — jego obszar nie jest publiczny.</p></div>;

  return (
    <div ref={top} className="lib-archive-wrap">
      {big
        ? <Browser store={store} revision={revision} title={title} project={project} initial={layoutOf(layout)} onOpen={pick} />
        : <Recent store={store} revision={revision} title={title} project={project} size={size} onOpen={pick} />}
    </div>
  );
}

/** Die Texte dieses Skryptorium als Zeilen, ihre Achsen (Felder der Rodzaje tekstów, Projekte) — neu, wenn sich etwas ändert. */
function useArchive(store: LibraryStore, revision: number): { rows: readonly ArchiveRow[]; facets: readonly Facet[]; projects: readonly { id: string; title: string }[] } {
  return useMemo(() => {
    const rows = store.ofKind('text').map((t) => archiveRow(t, store));
    const projects = store.ofKind('project').map((p) => ({ id: p.id, title: str(p.data, 'title') || 'Projekt' })).sort((a, b) => a.title.localeCompare(b.title, 'pl'));
    return { rows, projects, facets: facetsOf(rows, projects) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, revision]);
}

/* -- Klein: die letzten Texte ------------------------------------------------------------------- */

const metaOf = (row: ArchiveRow): string =>
  [row.date === '' ? '' : dateWords(row.date), row.occasion, row.held > 1 ? `wygłoszony ${row.held}×` : '', row.recorded ? 'z nagraniem' : '']
    .filter(Boolean).join(' · ');

function Recent({ store, revision, title, project, size, onOpen }: {
  store: LibraryStore;
  revision: number;
  title: string;
  project: string;
  size: PartSize;
  onOpen: (id: string) => void;
}) {
  const take = size.height === 'strip' ? 1 : size.width === 'narrow' ? 4 : 6;
  const [shown, setShown] = useState(take);
  useEffect(() => { setShown(take); }, [take]);
  const archive = useArchive(store, revision);
  const found = useMemo(() => browseLocal(archive.rows, { groups: [[project]], matching: null, order: '-sort' }).rows, [archive, project]);
  const rows = found.slice(0, shown);

  return (
    <div className="lib-archive">
      {title !== '' && <h2 className="wk-card-title">{title}</h2>}
      {rows.length === 0 && <p className="wk-card-text">Nie ma jeszcze tekstów.</p>}
      {rows.length > 0 && (
        <ul className="lib-archive-list">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" className="lib-archive-item" onClick={() => onOpen(row.id)}>
                <span className="lib-archive-title">{row.title}</span>
                <span className="lib-meta">{metaOf(row)}</span>
                {size.height !== 'strip' && size.width !== 'narrow' && row.summary !== '' && <span className="lib-archive-lead">{row.summary}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {rows.length < found.length && size.height !== 'strip' && (
        <button type="button" className="wk-link-btn" onClick={() => setShown((n) => n + take)}>Więcej ({found.length - rows.length})</button>
      )}
    </div>
  );
}

/* -- Gross: das ganze Archiv --------------------------------------------------------------------- */

function Browser({ store, revision, title, project, initial, onOpen }: {
  store: LibraryStore;
  revision: number;
  title: string;
  project: string;
  initial: Layout;
  onOpen: (id: string) => void;
}) {
  const [layout, setLayout] = useState<Layout>(() => { const word = hashParam('tu'); return word === null ? initial : layoutOf(word); });
  const [query, setQuery] = useState(() => hashParam('tq') ?? '');
  const [chosen, setChosen] = useState<readonly string[]>(() => (hashParam('tf') ?? '').split(',').filter((id) => /^[0-9a-f-]{36}$/i.test(id)));
  const [order, setOrder] = useState<Order>(() => orderOf(hashParam('to')) ?? '-sort');
  const [shown, setShown] = useState(PAGE);
  useEffect(() => { setShown(PAGE); }, [query, chosen, order]);

  const archive = useArchive(store, revision);
  const facets = archive.facets;
  const projectIds = useMemo(() => new Set(archive.projects.map((p) => p.id)), [archive]);
  const keyOf = useMemo(() => (id: string) => facetKey(id, facets, projectIds), [facets, projectIds]);

  /* Gesucht, gefiltert und gezählt hier; eine Achse mit gewähltem Wert zählt ohne ihren eigenen Filter — sonst sähe man ihre anderen Werte nicht. */
  const matching = useMemo(() => (query.trim() === '' ? null : new Set(store.ownSearch(query, ['text']).map((e) => e.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, store, revision]);
  const fixed = useMemo(() => [[project]], [project]);
  const found = useMemo(() => {
    const main = browseLocal(archive.rows, { groups: [...fixed, ...chosen.map((id) => [id])], matching, order });
    const counts = new Map<string, ReadonlyMap<string, number>>();
    const own = [...new Set(chosen.map(keyOf))];
    for (const facet of facets) if (!own.includes(facet.id)) counts.set(facet.id, main.counts);
    for (const facet of own) {
      const other = chosen.filter((id) => keyOf(id) !== facet);
      counts.set(facet, browseLocal(archive.rows, { groups: [...fixed, ...other.map((id) => [id])], matching, order }).counts);
    }
    return { rows: main.rows, total: main.rows.length, counts };
  }, [archive, fixed, chosen, matching, order, keyOf, facets]);

  /* Der Zustand in der Adresse — ein gefiltertes Archiv lässt sich weitergeben. */
  useEffect(() => {
    setHashParams({ tu: layout === initial ? null : layoutWord(layout), tq: query.trim() === '' ? null : query.trim(), tf: chosen.length === 0 ? null : chosen.join(','), to: order === '-sort' ? null : order });
  }, [layout, query, chosen, order, initial]);

  const pick = (id: string) => setChosen((was) => choose(was, id, keyOf, false));
  const countOf = (facet: string, id: string): number | null => found.counts.get(facet)?.get(id) ?? 0;
  const nameOf = (id: string): string => facets.flatMap((f) => f.values).find((v) => v.id === id)?.name ?? '…';
  const facetName = (id: string): string => facets.find((f) => f.id === keyOf(id))?.name ?? '';

  const rows = found.rows.slice(0, shown);
  const searching = query.trim() !== '' || chosen.length > 0;
  const results = (
    <>
      <div className="lib-results-bar">
        <p className="lib-results" role="status">
          {found.total} {plural(found.total, 'tekst', 'teksty', 'tekstów')}{query.trim() === '' ? '' : ` — „${query.trim()}”`}
        </p>
        <label className="lib-order">
          <span>Kolejność</span>
          <select value={order} onChange={(e) => setOrder(orderOf(e.target.value) ?? '-sort')}>
            {ORDERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      {rows.length === 0 && (
        <p className="wk-card-text">{searching ? 'Nic nie pasuje — zmień filtry albo wyszukiwanie.' : 'Nie ma jeszcze tekstów.'}</p>
      )}
      {rows.length > 0 && (layout === 'table'
        ? <Table rows={rows} facets={facets} order={order} onOrder={setOrder} onOpen={onOpen} onPick={pick} />
        : <Rows rows={rows} order={order} onOpen={onOpen} onPick={pick} />)}
      {rows.length < found.total && (
        <button type="button" className="wk-link-btn" onClick={() => setShown((n) => n + PAGE)}>Więcej ({found.total - rows.length})</button>
      )}
    </>
  );

  return (
    <div className={`lib-archive lib-browse is-${layout}`}>
      <Head title={title} />
      <div className="lib-browse-bar">
        <input className="lib-archive-search" type="search" value={query} placeholder="Szukaj w tekstach…" aria-label="Szukaj w tekstach" onChange={(e) => setQuery(e.target.value)} />
        {/* 2026-10-22 (Schritt 10) — die Tabela ist ausgemustert (Baustein „Widok"); wer sie eingestellt hat, behält sie bis zur Umstellung. */}
        <Segment now={layout} options={initial === 'table' || layout === 'table' ? LAYOUTS : LAYOUTS.filter((l) => l.value !== 'table')} busy={false} onPick={setLayout} />
      </div>

      {layout !== 'tree' && facets.length > 0 && (
        <div className="lib-filters">
          {facets.map((facet) => {
            const value = chosen.find((id) => keyOf(id) === facet.id) ?? '';
            return (
              <label key={facet.id} className="lib-filter">
                <span>{facet.name}</span>
                <select value={value} onChange={(e) => {
                  const next = e.target.value;
                  setChosen((was) => (next === '' ? was.filter((id) => keyOf(id) !== facet.id) : choose(was.filter((id) => keyOf(id) !== facet.id), next, keyOf, false)));
                }}>
                  <option value="">wszystkie</option>
                  {facet.values.filter((v) => { const n = countOf(facet.id, v.id); return n === null || n > 0 || v.id === value; }).map((v) => {
                    const n = countOf(facet.id, v.id);
                    return <option key={v.id} value={v.id}>{v.name}{n === null ? '' : ` (${n})`}</option>;
                  })}
                </select>
              </label>
            );
          })}
        </div>
      )}

      {chosen.length > 0 && (
        <p className="lib-chosen">
          {chosen.map((id) => (
            <span key={id} className="lib-chip is-on">
              {facetName(id) !== '' && <span className="lib-chip-aspect">{facetName(id)}:</span>}{nameOf(id)}
              <button type="button" className="lib-chip-x" aria-label={`Bez filtra: ${nameOf(id)}`} onClick={() => setChosen((was) => was.filter((one) => one !== id))}>×</button>
            </span>
          ))}
          <button type="button" className="wk-link-btn" onClick={() => setChosen([])}>Wyczyść filtry</button>
        </p>
      )}

      {layout === 'tree' ? (
        <div className="lib-tree-layout">
          <TreeNav facets={facets} chosen={chosen} keyOf={keyOf} countOf={countOf} onPick={pick} />
          <div className="lib-tree-results">{results}</div>
        </div>
      ) : results}
    </div>
  );
}

const Head = ({ title }: { title: string }) => (title === '' ? null : <h2 className="wk-card-title">{title}</h2>);

/* -- Lista ------------------------------------------------------------------------------------------ */

function Rows({ rows, order, onOpen, onPick }: { rows: readonly ArchiveRow[]; order: Order; onOpen: (id: string) => void; onPick: (id: string) => void }) {
  const byDate = order === 'sort' || order === '-sort';
  let year = '';
  return (
    <ul className="lib-archive-list">
      {rows.flatMap((row) => {
        const y = byDate ? yearOf(row.date) : '';
        const head = y !== '' && y !== year ? [<li key={`y-${y}-${row.id}`} className="lib-year">{y}</li>] : [];
        if (y !== '') year = y;
        return [
          ...head,
          <li key={row.id} className="lib-archive-entry">
            <button type="button" className="lib-archive-item" onClick={() => onOpen(row.id)}>
              <span className="lib-archive-title">{row.title}</span>
              {metaOf(row) !== '' && <span className="lib-meta">{metaOf(row)}</span>}
              {row.summary !== '' && <span className="lib-archive-lead">{row.summary}</span>}
            </button>
            {(row.marks.length > 0 || row.project !== null) && (
              <p className="lib-topics">
                {row.project !== null && <button type="button" className="lib-chip" onClick={() => onPick(row.project!.id)}>{row.project.title}</button>}
                {row.marks.map((m) => <button key={`${m.facet}:${m.id}`} type="button" className="lib-chip" title={m.facetName} onClick={() => onPick(m.id)}>{m.name}</button>)}
              </p>
            )}
          </li>
        ];
      })}
    </ul>
  );
}

/* -- Tabela ----------------------------------------------------------------------------------------- */

function Table({ rows, facets, order, onOrder, onOpen, onPick }: {
  rows: readonly ArchiveRow[];
  facets: readonly Facet[];
  order: Order;
  onOrder: (order: Order) => void;
  onOpen: (id: string) => void;
  onPick: (id: string) => void;
}) {
  const columns = facets.slice(0, 6);
  const sorted = (by: 'sort' | 'key') => (order === by ? 'ascending' : order === `-${by}` ? 'descending' : 'none');
  const arrow = (by: 'sort' | 'key') => (order === by ? ' ↑' : order === `-${by}` ? ' ↓' : '');
  return (
    <div className="lib-table-wrap">
      <table className="lib-table">
        <thead>
          <tr>
            <th scope="col" aria-sort={sorted('key')}><button type="button" onClick={() => onOrder(order === 'key' ? '-key' : 'key')}>Tytuł{arrow('key')}</button></th>
            <th scope="col" aria-sort={sorted('sort')}><button type="button" onClick={() => onOrder(order === '-sort' ? 'sort' : '-sort')}>Kiedy{arrow('sort')}</button></th>
            {columns.map((f) => <th key={f.id} scope="col">{f.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <button type="button" className="lib-table-title" onClick={() => onOpen(row.id)}>{row.title}</button>
                {row.plan.length > 0 && <span className="lib-table-sub">{row.plan.slice(0, 3).join(' · ')}</span>}
              </td>
              <td className="lib-table-date" data-label="Kiedy">
                {row.date === '' ? '' : dateWords(row.date)}
                {(row.occasion !== '' || row.held > 1) && <span className="lib-table-sub">{[row.occasion, row.held > 1 ? `${row.held}×` : ''].filter(Boolean).join(' · ')}</span>}
              </td>
              {columns.map((f) => {
                const values = f.id === PROJECTS ? (row.project === null ? [] : [{ id: row.project.id, name: row.project.title }]) : row.marks.filter((m) => m.facet === f.id);
                return (
                  <td key={f.id} data-label={f.name}>
                    {values.map((v) => <button key={v.id} type="button" className="lib-cell-chip" onClick={() => onPick(v.id)}>{v.name}</button>)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -- Drzewo ----------------------------------------------------------------------------------------- */

function TreeNav({ facets, chosen, keyOf, countOf, onPick }: {
  facets: readonly Facet[];
  chosen: readonly string[];
  keyOf: (id: string) => string;
  countOf: (facet: string, id: string) => number | null;
  onPick: (id: string) => void;
}) {
  const [facetId, setFacetId] = useState(() => (chosen.length > 0 ? keyOf(chosen[chosen.length - 1]) : facets[0]?.id ?? ''));
  const facet = facets.find((f) => f.id === facetId) ?? facets[0];
  if (facet === undefined) return <nav className="lib-tree" aria-label="Według czego"><p className="wk-card-text">Teksty nie mają jeszcze pól, według których można je przeglądać (rodzaj tekstu z polem-odwołaniem).</p></nav>;

  const node = (v: { id: string; name: string }): ReactElement | null => {
    const count = countOf(facet.id, v.id);
    const on = chosen.includes(v.id);
    if (count === 0 && !on) return null;
    return (
      <li key={v.id} role="treeitem" aria-selected={on}>
        <span className={`lib-node${on ? ' is-on' : ''}`}>
          <span className="lib-twist" aria-hidden="true" />
          <button type="button" className="lib-node-name" aria-pressed={on} onClick={() => onPick(v.id)}>{v.name}</button>
          {count !== null && <span className="lib-node-count">{count}</span>}
        </span>
      </li>
    );
  };

  return (
    <nav className="lib-tree" aria-label="Według czego">
      {facets.length > 1 && (
        <div className="lib-tree-tabs" role="group" aria-label="Według czego">
          {facets.map((f) => (
            <button key={f.id} type="button" className={f.id === facet.id ? 'lib-chip is-on' : 'lib-chip'} aria-pressed={f.id === facet.id} onClick={() => setFacetId(f.id)}>{f.name}</button>
          ))}
        </div>
      )}
      <ul className="lib-tree-list" role="tree" aria-label={facet.name}>{facet.values.map(node)}</ul>
    </nav>
  );
}
