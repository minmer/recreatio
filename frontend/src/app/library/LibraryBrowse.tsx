/**
 * DAS ARCHIV AUF EINER SEITE (0064 „Archiwum tekstów"; 2026-10-21 für viele
 * Kazania) — ohne Konto, aus dem, was veröffentlicht ist.
 *
 * <code>
 *   Streifen          der neueste Text
 *   Block             die letzten Texte, mit Datum und kurzem Inhalt
 *   hoch, Vollbild    das ganze Archiv: Suche, je Aspekt ein Filter, und drei Ansichten —
 *                     Lista (nach Jahren), Tabela (je Aspekt eine Spalte), Drzewo (die
 *                     Themen eines Aspekts als Baum, mit Zahlen); ein Klick öffnet den
 *                     Text mit Plan, Wygłoszenia und Quellen (`WritingCard`)
 * </code>
 *
 * <b>Die Ordnung steht in der Bibliothek, nicht im Baustein.</b> Welche Achsen
 * es gibt (Aspekte), welche Werte, in welcher Reihenfolge — das sind Themen
 * der Bibliothek. Der Baustein wählt nur, mit welcher Ansicht er beginnt. So
 * bleibt die Seite einfach, auch wenn es tausend Predigten werden: gesucht,
 * gefiltert und gezählt wird im Dienst (`browsePublished`), Seite für Seite.
 */

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';

import { plural } from '../core/plural';
import type { PartSize } from '../pages/part';
import { Loading } from '../ui/Loading';
import { Segment } from '../ui/Segment';
import { LAYOUTS, layoutOf, layoutWord, type Layout } from './archiveLayout';
import {
  archiveRow, choose, facetKey, hashParam, orderOf, PROJECTS, setHashParams, yearOf,
  type ArchiveRow, type Order
} from './browse';
import { browsePublished, loadPublishedAll, summaryOf } from './library';
import { WritingCard } from './LibraryPublic';
import { dateWords } from './LibraryText';
import { facetsOf, topicNodeOfSummary, topicTree, type Facet, type TopicNode, type TopicTree } from './topics';

const PAGE = 30;

/** Wie das Archiv geordnet ist — nach dem letzten Halten (Datum) oder nach dem Titel. */
const ORDERS: readonly { readonly value: Order; readonly label: string }[] = [
  { value: '-sort', label: 'najnowsze' },
  { value: 'sort', label: 'najstarsze' },
  { value: 'key', label: 'tytuł A–Z' },
  { value: '-key', label: 'tytuł Z–A' }
];

export function WritingsCard({ library, title, project, topic, layout, size, whole = false, prefix }: {
  library: string;
  title: string;
  project: string;
  topic: string;
  /** Womit das Archiv beginnt: „lista", „tabela", „drzewo". */
  layout: string;
  size: PartSize;
  whole?: boolean;
  prefix: string;
}) {
  const big = whole || size.height === 'tall';
  const top = useRef<HTMLDivElement | null>(null);
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

  return (
    <div ref={top} className="lib-archive-wrap">
      {big
        ? <Browser library={library} title={title} project={project} topic={topic} initial={layoutOf(layout)} onOpen={pick} />
        : <Recent library={library} title={title} project={project} topic={topic} size={size} onOpen={pick} />}
    </div>
  );
}

/* -- Klein: die letzten Texte ------------------------------------------------------------------- */

const metaOf = (row: ArchiveRow): string =>
  [row.date === '' ? '' : dateWords(row.date), row.occasion, row.held > 1 ? `wygłoszony ${row.held}×` : '', row.recorded ? 'z nagraniem' : '']
    .filter(Boolean).join(' · ');

function Recent({ library, title, project, topic, size, onOpen }: {
  library: string;
  title: string;
  project: string;
  topic: string;
  size: PartSize;
  onOpen: (id: string) => void;
}) {
  const take = size.height === 'strip' ? 1 : size.width === 'narrow' ? 4 : 6;
  const [rows, setRows] = useState<readonly ArchiveRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const groups = [[project], [topic]];

  useEffect(() => {
    if (library === '') return undefined;
    let alive = true;
    setRows(null);
    void browsePublished(library, { kind: 'text', groups: [[project], [topic]], order: '-sort', take }).then(
      (r) => { if (alive) { setRows(r.items.map(archiveRow)); setTotal(r.total); setFailed(false); } },
      () => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [library, project, topic, take]);

  const more = async () => {
    const r = await browsePublished(library, { kind: 'text', groups, order: '-sort', take, skip: rows?.length ?? 0 });
    setRows([...(rows ?? []), ...r.items.map(archiveRow)]);
  };

  return (
    <div className="lib-archive">
      {title !== '' && <h2 className="wk-card-title">{title}</h2>}
      {failed && <p className="wk-card-text">Nie udało się wczytać tekstów.</p>}
      {rows === null && !failed && <Loading label="Wczytywanie…" />}
      {rows !== null && rows.length === 0 && <p className="wk-card-text">Nie ma jeszcze opublikowanych tekstów.</p>}
      {rows !== null && rows.length > 0 && (
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
      {rows !== null && rows.length < total && size.height !== 'strip' && (
        <button type="button" className="wk-link-btn" onClick={() => void more()}>Więcej ({total - rows.length})</button>
      )}
    </div>
  );
}

/* -- Gross: das ganze Archiv --------------------------------------------------------------------- */

interface Shape {
  readonly tree: TopicTree;
  readonly projects: readonly { readonly id: string; readonly title: string }[];
}

interface Found {
  readonly rows: readonly ArchiveRow[];
  readonly total: number;
  /** Die Zahlen je Achse: für eine Achse mit gewähltem Wert ohne ihren eigenen Filter gezählt. */
  readonly counts: ReadonlyMap<string, ReadonlyMap<string, number>> | null;
  readonly exact: boolean;
}

const projectNode = (p: { id: string; title: string }): TopicNode => ({ id: p.id, name: p.title, parent: null, aspect: false, order: null });

function Browser({ library, title, project, topic, initial, onOpen }: {
  library: string;
  title: string;
  project: string;
  topic: string;
  initial: Layout;
  onOpen: (id: string) => void;
}) {
  const [layout, setLayout] = useState<Layout>(() => { const word = hashParam('tu'); return word === null ? initial : layoutOf(word); });
  const [query, setQuery] = useState(() => hashParam('tq') ?? '');
  const [chosen, setChosen] = useState<readonly string[]>(() => (hashParam('tf') ?? '').split(',').filter((id) => /^[0-9a-f-]{36}$/i.test(id)));
  const [order, setOrder] = useState<Order>(() => orderOf(hashParam('to')) ?? '-sort');
  const [shape, setShape] = useState<Shape | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  /* Themen und Projekte — einmal je Bibliothek: daraus die Achsen. */
  useEffect(() => {
    if (library === '') return undefined;
    let alive = true;
    void Promise.all([loadPublishedAll(library, { kind: 'topic', order: 'sort' }), loadPublishedAll(library, { kind: 'project', order: 'sort' }, 400)]).then(
      ([topics, projects]) => {
        if (!alive) return;
        setShape({
          tree: topicTree(topics.map((item) => topicNodeOfSummary(item.entryId, summaryOf(item)))),
          projects: projects.map((item) => ({ id: item.entryId, title: String(summaryOf(item).title ?? '').trim() || 'Projekt' }))
        });
      },
      () => { if (alive) setShape({ tree: topicTree([]), projects: [] }); });
    return () => { alive = false; };
  }, [library]);

  const projectIds = useMemo(() => new Set(shape?.projects.map((p) => p.id) ?? []), [shape]);
  const keyOf = useMemo(() => (id: string) => facetKey(id, shape?.tree ?? null, projectIds), [shape, projectIds]);
  const facets = useMemo<Facet[]>(() => {
    if (shape === null) return [];
    const out = facetsOf(shape.tree);
    if (shape.projects.length > 0) out.push({ id: PROJECTS, name: 'Cykl', values: shape.projects.map((p) => ({ node: projectNode(p), depth: 0 })) });
    return out;
  }, [shape]);

  /* Die Ergebnisse — neu bei jedem Filter, jeder Reihenfolge, der Suche nach einer kurzen Pause. */
  const fixed = useMemo(() => [[project], [topic]], [project, topic]);
  useEffect(() => {
    if (library === '' || shape === null) return undefined;
    let alive = true;
    const timer = window.setTimeout(() => void (async () => {
      try {
        const main = await browsePublished(library, { kind: 'text', groups: [...fixed, ...chosen.map((id) => [id])], q: query, order, take: PAGE, counts: true });
        const counts = new Map<string, ReadonlyMap<string, number>>();
        if (main.counts !== null) {
          /* Eine Achse mit gewähltem Wert zählt ohne ihren eigenen Filter — sonst sähe man ihre anderen Werte nicht. */
          const own = [...new Set(chosen.map(keyOf))];
          for (const facet of facets) if (!own.includes(facet.id)) counts.set(facet.id, main.counts);
          await Promise.all(own.map(async (facet) => {
            const other = chosen.filter((id) => keyOf(id) !== facet);
            const r = await browsePublished(library, { kind: 'text', groups: [...fixed, ...other.map((id) => [id])], q: query, take: 1, counts: true });
            if (r.counts !== null) counts.set(facet, r.counts);
          }));
        }
        if (alive) { setFound({ rows: main.items.map(archiveRow), total: main.total, counts: main.counts === null ? null : counts, exact: main.exact }); setFailed(false); }
      } catch {
        if (alive) setFailed(true);
      }
    })(), query === '' ? 0 : 300);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [library, shape, fixed, chosen, query, order, keyOf, facets]);

  /* Der Zustand in der Adresse — ein gefiltertes Archiv lässt sich weitergeben. */
  useEffect(() => {
    setHashParams({ tu: layout === initial ? null : layoutWord(layout), tq: query.trim() === '' ? null : query.trim(), tf: chosen.length === 0 ? null : chosen.join(','), to: order === '-sort' ? null : order });
  }, [layout, query, chosen, order, initial]);

  const more = async () => {
    if (found === null) return;
    setBusy(true);
    try {
      const r = await browsePublished(library, { kind: 'text', groups: [...fixed, ...chosen.map((id) => [id])], q: query, order, take: PAGE, skip: found.rows.length });
      setFound({ ...found, rows: [...found.rows, ...r.items.map(archiveRow)] });
    } finally {
      setBusy(false);
    }
  };

  /* Ohne Zahlen (ein älterer Dienst) greift nur ein Filter — dann ersetzt eine Wahl die andere. */
  const single = found !== null && found.counts === null;
  const pick = (id: string) => setChosen((was) => choose(was, id, keyOf, single));
  const countOf = (facet: string, id: string): number | null => (found?.counts == null ? null : found.counts.get(facet)?.get(id) ?? 0);
  const nameOf = (id: string): string => shape?.tree.nodes.get(id)?.name ?? shape?.projects.find((p) => p.id === id)?.title ?? '…';
  const facetName = (id: string): string => facets.find((f) => f.id === keyOf(id))?.name ?? '';

  if (shape === null) return <><Head title={title} /><Loading label="Wczytywanie…" /></>;

  const rows = found?.rows ?? [];
  const searching = query.trim() !== '' || chosen.length > 0;
  const results = (
    <>
      {failed && <p className="wk-card-text">Nie udało się wczytać tekstów.</p>}
      {found === null && !failed && <Loading label="Wczytywanie…" />}
      {found !== null && (
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
      )}
      {found !== null && rows.length === 0 && (
        <p className="wk-card-text">{searching ? 'Nic nie pasuje — zmień filtry albo wyszukiwanie.' : 'Nie ma jeszcze opublikowanych tekstów.'}</p>
      )}
      {rows.length > 0 && (layout === 'table'
        ? <Table rows={rows} facets={facets} keyOf={keyOf} order={order} onOrder={setOrder} onOpen={onOpen} onPick={pick} />
        : <Rows rows={rows} order={order} onOpen={onOpen} onPick={pick} />)}
      {found !== null && rows.length < found.total && (
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void more()}>Więcej ({found.total - rows.length})</button>
      )}
    </>
  );

  return (
    <div className={`lib-archive lib-browse is-${layout}`}>
      <Head title={title} />
      <div className="lib-browse-bar">
        <input className="lib-archive-search" type="search" value={query} placeholder="Szukaj w tekstach…" aria-label="Szukaj w tekstach" onChange={(e) => setQuery(e.target.value)} />
        <Segment now={layout} options={LAYOUTS} busy={false} onPick={setLayout} />
      </div>

      {layout !== 'tree' && facets.length > 0 && (
        <div className="lib-filters">
          {facets.map((facet) => {
            const value = chosen.find((id) => keyOf(id) === facet.id) ?? '';
            return (
              <label key={facet.id || 'tematy'} className="lib-filter">
                <span>{facet.name}</span>
                <select value={value} onChange={(e) => {
                  const next = e.target.value;
                  setChosen((was) => (next === '' ? was.filter((id) => keyOf(id) !== facet.id) : choose(was.filter((id) => keyOf(id) !== facet.id), next, keyOf, single)));
                }}>
                  <option value="">wszystkie</option>
                  {facet.values.filter((v) => { const n = countOf(facet.id, v.node.id); return n === null || n > 0 || v.node.id === value; }).map((v) => {
                    const n = countOf(facet.id, v.node.id);
                    return <option key={v.node.id} value={v.node.id}>{'\u00a0\u00a0'.repeat(v.depth)}{v.node.name}{n === null ? '' : ` (${n})`}</option>;
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
          <TreeNav shape={shape} facets={facets} chosen={chosen} keyOf={keyOf} countOf={countOf} onPick={pick} />
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
            {(row.topics.length > 0 || row.project !== null) && (
              <p className="lib-topics">
                {row.project !== null && <button type="button" className="lib-chip" onClick={() => onPick(row.project!.id)}>{row.project.title}</button>}
                {row.topics.map((t) => <button key={t.id} type="button" className="lib-chip" onClick={() => onPick(t.id)}>{t.name}</button>)}
              </p>
            )}
          </li>
        ];
      })}
    </ul>
  );
}

/* -- Tabela ----------------------------------------------------------------------------------------- */

function Table({ rows, facets, keyOf, order, onOrder, onOpen, onPick }: {
  rows: readonly ArchiveRow[];
  facets: readonly Facet[];
  keyOf: (id: string) => string;
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
            {columns.map((f) => <th key={f.id || 'tematy'} scope="col">{f.name}</th>)}
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
                const values = f.id === PROJECTS ? (row.project === null ? [] : [{ id: row.project.id, name: row.project.title }]) : row.topics.filter((t) => keyOf(t.id) === f.id);
                return (
                  <td key={f.id || 'tematy'} data-label={f.name}>
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

function TreeNav({ shape, facets, chosen, keyOf, countOf, onPick }: {
  shape: Shape;
  facets: readonly Facet[];
  chosen: readonly string[];
  keyOf: (id: string) => string;
  countOf: (facet: string, id: string) => number | null;
  onPick: (id: string) => void;
}) {
  const [facetId, setFacetId] = useState(() => (chosen.length > 0 ? keyOf(chosen[chosen.length - 1]) : facets[0]?.id ?? ''));
  const facet = facets.find((f) => f.id === facetId) ?? facets[0];
  /* Offen: der Weg zum Gewählten. */
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(chosen.flatMap((id) => shape.tree.ancestors(id).map((a) => a.id))));
  if (facet === undefined) return <nav className="lib-tree" aria-label="Drzewo tematów"><p className="wk-card-text">Ta biblioteka nie ma jeszcze tematów.</p></nav>;

  const childrenOf = (id: string | null): readonly TopicNode[] => {
    if (facet.id === PROJECTS) return id === null ? shape.projects.map(projectNode) : [];
    if (facet.id === '') return id === null ? shape.tree.roots.filter((r) => !r.aspect && shape.tree.aspectOf(r.id) === null) : shape.tree.children(id).filter((c) => !c.aspect);
    return shape.tree.children(id ?? facet.id);
  };
  const holds = (id: string): boolean => chosen.some((c) => c === id || shape.tree.ancestors(c).some((a) => a.id === id));

  const node = (n: TopicNode, depth: number): ReactElement | null => {
    const count = countOf(facet.id, n.id);
    if (count === 0 && !holds(n.id)) return null;
    const kids = depth < 12 ? childrenOf(n.id) : [];
    const isOpen = open.has(n.id);
    const on = chosen.includes(n.id);
    return (
      <li key={n.id} role="treeitem" aria-expanded={kids.length > 0 ? isOpen : undefined} aria-selected={on}>
        <span className={`lib-node${on ? ' is-on' : ''}`}>
          {kids.length > 0
            ? <button type="button" className="lib-twist" aria-label={isOpen ? `Zwiń: ${n.name}` : `Rozwiń: ${n.name}`}
                onClick={() => setOpen((was) => { const next = new Set(was); if (next.has(n.id)) next.delete(n.id); else next.add(n.id); return next; })}>{isOpen ? '▾' : '▸'}</button>
            : <span className="lib-twist" aria-hidden="true" />}
          <button type="button" className="lib-node-name" aria-pressed={on} onClick={() => onPick(n.id)}>{n.name}</button>
          {count !== null && <span className="lib-node-count">{count}</span>}
        </span>
        {isOpen && kids.length > 0 && <ul role="group">{kids.map((k) => node(k, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <nav className="lib-tree" aria-label="Drzewo tematów">
      {facets.length > 1 && (
        <div className="lib-tree-tabs" role="group" aria-label="Według czego">
          {facets.map((f) => (
            <button key={f.id || 'tematy'} type="button" className={f.id === facet.id ? 'lib-chip is-on' : 'lib-chip'} aria-pressed={f.id === facet.id} onClick={() => setFacetId(f.id)}>{f.name}</button>
          ))}
        </div>
      )}
      <ul className="lib-tree-list" role="tree" aria-label={facet.name}>{childrenOf(null).map((n) => node(n, 0))}</ul>
    </nav>
  );
}
