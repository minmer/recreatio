/**
 * DIE ANSICHT DES BAUSTEINS „WIDOK" (`view.tsx`) — erst geladen, wenn eine
 * Seite ihn zeigt. Liest die Baza so, wie dieser Leser sie lesen darf
 * (`cogita/pageBase.ts`), rechnet den Widok wie „Wpisy" (`cogita/views.ts`)
 * und hält seinen Zustand unter seinem Zakres in der Adresse (`partQuery.ts`).
 *
 * 2026-10-22 (Schritt 10) — <b>innere Ansichten mit einem Weg in der
 * Adresse</b>: ein Feld der Macierz (`c=<zeile>~<spalte>`) öffnet seine
 * Einträge, ein Eintrag (`e=`) sich selbst — ein Komentarz mit seinen
 * Bausteinen, ein Kazanie ganz (mit Plan und Wygłoszenia, `d=`), alles andere
 * als Karte. Darüber ein Brotkrumen zurück. „Ucz się tego" fragt die Karten des
 * Gezeigten, ohne Konto (Fortschritt im Browser). Und die Mapa (aus „Mapa
 * wiedzy"): die Einträge im Nebel des Lernens.
 */

import { useMemo, useState } from 'react';

import type { PartContext } from '../part';
import { scopeOf, useScope } from '../partQuery';
import type { Card } from '../../cogita/cardBasics';
import { useEntitySubject } from '../../cogita/entitySubject';
import { EntityView } from '../../cogita/FlowPlayer';
import { fogOf, ringsOf } from '../../cogita/game';
import { average, knownessOf, shareOf } from '../../cogita/knowness';
import { FogMap } from '../../cogita/FogMap';
import { MatrixGrid } from '../../cogita/MatrixGrid';
import { usePageBase } from '../../cogita/pageBase';
import { useLocalLearner } from '../../cogita/PublicRun';
import { publicEntity } from '../../cogita/publish';
import { readPlan } from '../../cogita/revision';
import { RevisionRun } from '../../cogita/RevisionRun';
import { fieldsOf, type Entity } from '../../cogita/schema';
import type { CogitaLibrary } from '../../cogita/store';
import { Bar, CogitaContext, useAsync } from '../../cogita/ui';
import { cellKey, cellText, needsKnowing, readView, viewColumns, viewGroups, viewList, viewMatrix, withKnowing, type ListMode } from '../../cogita/views';
import { gaugeFromMarks } from '../../cogita/knowing';
import { usePageLearner } from '../../cogita/pageLearner';
import { StatementCard } from '../../library/markupView';
import { blocksField } from '../../cogita/statements';
import { later } from '../../ui/later';
import { Loading } from '../../ui/Loading';
import type { ViewConfig } from './view';

const WritingCard = later(() => import('../../scriptorium/WritingCard').then((m) => m.WritingCard));

const isTall = (ctx: PartContext): boolean => ctx.whole === true || ctx.size.height === 'tall';
const fold = (s: string): string => s.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[̀-ͯ]/g, '');

/* 2026-10-24 — die Struktura (outline) zeigt eine Seite als Tabela, wie das Płótno. */
type PageMode = Exclude<ListMode, 'canvas' | 'outline'>;

/** Wie der Baustein zeigt — was die Seite sagt (oder der Besucher wählt), sonst was der Widok gespeichert hat; eine Płótno als Tabela. */
export function modeOf(asked: string, saved: string): PageMode {
  const word = asked.trim().toLowerCase();
  if (word === 'drzewo' || word === 'tree') return 'tree';
  if (word === 'tabela' || word === 'table') return 'table';
  if (word === 'macierz' || word === 'matrix') return 'matrix';
  if (word === 'mapa' || word === 'map') return 'map';
  return saved === 'tree' || saved === 'matrix' || saved === 'map' ? saved : 'table';
}

const MODE_WORD: Record<PageMode, string> = { table: 'tabela', tree: 'drzewo', matrix: 'macierz', map: 'mapa' };
const MODE_LABEL: Record<PageMode, string> = { table: 'Tabela', tree: 'Drzewo', matrix: 'Macierz', map: 'Mapa' };

/** Ein Eintrag, aufgeklappt: eine Aussage mit ihren Bausteinen, ein Kazanie ganz, alles andere als Karte. */
function EntryCard({ lib, id, ctx, scope, delivery, onDelivery }: {
  lib: CogitaLibrary; id: string; ctx: PartContext; scope: string; delivery: string | null; onDelivery: (d: string | null) => void;
}) {
  const entry = lib.entry(id);
  const entity = lib.entity(id);
  if (entry === undefined || entity === undefined) return <p className="wk-card-muted">Tego wpisu tu nie ma.</p>;
  if (blocksField(entity, lib.look) !== undefined) return <div className="cg-card"><StatementCard entry={entry} look={lib.markupLook} prefix={`v${scope}-`} about /></div>;
  const home = lib.origin(id);
  /* 2026-10-23 — ein Kazanie liegt im Skryptorium (früher in der Bibliothek). */
  if (entry.kind === 'text' && home !== undefined && (home.kind === 'writing' || home.kind === 'books')) {
    return <WritingCard library={home.libraryId} entryId={id} size={ctx.size} whole prefix={`v${scope}-`} delivery={delivery} onDelivery={onDelivery} />;
  }
  return <div className="cg-card"><EntityView entity={publicEntity(lib, entity)} /></div>;
}

/** „Ucz się tego": die Karten dieser Einträge, nach dem, was dieser Browser schon kann. */
function LearnThis({ lib, ids, title, onClose }: { lib: CogitaLibrary; ids: readonly string[]; title: string; onClose: () => void }) {
  const learner = useLocalLearner(lib.libraryId);
  const all = useAsync(() => lib.cards('page').then((r) => r.cards), [lib, lib.revision]);
  const source = useMemo(() => {
    if (all == null) return null;
    const wanted = new Set(ids);
    const of = all.filter((c) => wanted.has(c.entity ?? c.question));
    return { plan: readPlan(of, { mode: 'temporal', stackSize: 20 }), cards: of, deps: lib.dependencies(), title };
  }, [all, ids, lib, title]);
  if (source === null) return <Loading />;
  if (source.cards.length === 0) return <p className="wk-card-muted">Z tych wpisów nie powstają karty do nauki. <button type="button" className="wk-link-btn" onClick={onClose}>Wróć</button></p>;
  return <RevisionRun lib={lib} learner={learner} source={source} onClose={onClose} />;
}

/** Die Mapa (aus „Mapa wiedzy"): die Einträge des Widoku, verbunden durch Voraussetzungen, im Nebel des Lernens. */
function MapOf({ lib, list, tall, onOpen, onLearn }: { lib: CogitaLibrary; list: readonly Entity[]; tall: boolean; onOpen: (id: string) => void; onLearn: (ids: readonly string[], title: string) => void }) {
  const learner = useLocalLearner(lib.libraryId);
  const all = useAsync(() => lib.cards('page').then((r) => r.cards), [lib, lib.revision]);
  const deps = useMemo(() => lib.dependencies(), [lib, lib.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const graph = useMemo(() => {
    const ids = list.slice(0, 200).map((e) => e.id);
    const inside = new Set(ids);
    const edges = deps.filter((d) => inside.has(d.parent) && inside.has(d.child)).map((d) => ({ from: d.parent, to: d.child }));
    return { ids, edges, place: ringsOf(ids, edges) };
  }, [list, deps]);
  if (all == null) return <Loading />;
  const now = Date.now();
  const cardsOf = (id: string): Card[] => all.filter((c) => (c.entity ?? c.question) === id);
  const knowness = (id: string) => { const of = cardsOf(id); return of.length === 0 || learner === null ? 0 : average(of.map((c) => knownessOf(learner.marks(c.key, c.fingerprint), now))); };
  const seen = (id: string) => learner !== null && cardsOf(id).some((c) => learner.marks(c.key, c.fingerprint).length > 0);
  const fog = fogOf(graph.ids.map((id) => ({ id })), graph.edges, knowness, seen);
  const known = graph.ids.filter((id) => fog.get(id) === 'known').length;
  return (
    <>
      <p className="wk-card-muted">{known} z {graph.ids.length} umiesz · przerywana obwódka — możesz tam wejść; mgła — jeszcze nieodkryte.</p>
      <Bar value={known / Math.max(1, graph.ids.length)} label="Ile już umiesz" />
      <FogMap tall={tall} edges={graph.edges} place={graph.place} onOpen={onOpen}
        nodes={graph.ids.map((id) => {
          const state = fog.get(id) ?? 'fog';
          const e = lib.entity(id);
          const label = e === undefined ? '?' : lib.label(e);
          return { id, label, state, title: state === 'fog' ? 'Jeszcze w mgle' : `${label} · ${Math.round(shareOf(knowness(id)) * 100)}%` };
        })} />
      {graph.ids.length > 0 && <button type="button" className="wk-link-btn" onClick={() => onLearn(graph.ids, 'Mapa')}>Ucz się tego</button>}
    </>
  );
}

export function ViewView({ config, ctx }: { config: ViewConfig; ctx: PartContext }) {
  const { lib, ctx: cg } = usePageBase(config.library);
  const scope = scopeOf(ctx.moduleId);
  const [state, setState] = useScope(scope);
  const [learning, setLearning] = useState<{ ids: readonly string[]; title: string } | null>(null);
  /* Wählt die Seite oben einen Eintrag dieser Baza, wählt ein Klick dort — sonst öffnet er sich hier (mit Weg in der Adresse). */
  const subject = useEntitySubject();
  const doc = lib == null ? undefined : lib.docs('view').find((e) => e.id === config.view);
  const saved = useMemo(() => readView(doc?.data), [doc]);
  /*
    2026-10-30 — DIE KENNTNIS DES BESUCHERS, wenn der Widok sie braucht (Filtr znajomości, Spalten daraus): gelernt
    als die Person der Seite (`pageLearner.tsx`) — angemeldet man selbst, sonst dieser Browser.
  */
  const wants = needsKnowing(saved);
  const visitor = usePageLearner(wants ? lib : null);
  const knowCards = useAsync(wants && lib != null ? () => lib.cards('page').then((r) => r.cards) : null, [wants, lib, lib?.revision]);
  const knowing = useMemo(() => {
    if (!wants || lib == null || knowCards == null) return null;
    const fp = new Map(knowCards.map((c) => [c.key, c.fingerprint]));
    return gaugeFromMarks(knowCards, (key) => visitor.learner?.marks(key, fp.get(key)) ?? [], lib.dependencies(), Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wants, lib, knowCards, visitor.learner, visitor.learner?.progress]);
  const vlib = useMemo(() => (lib == null ? lib : withKnowing(lib, knowing)), [lib, knowing]);
  const list = useMemo(() => (vlib == null || doc === undefined ? [] : viewList(vlib, saved)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vlib, lib?.revision, saved]);
  const mode = modeOf(state.u ?? config.mode, saved.mode);
  const matrix = useMemo(() => (vlib == null || mode !== 'matrix' ? null : viewMatrix(vlib, saved.matrix === null ? { ...saved, matrix: { rows: saved.group ?? { by: 'kind' }, cols: { by: 'kind' } } } : saved, list)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vlib, list, mode, saved]);
  const title = config.title || saved.name || 'Widok';

  if (lib === undefined) return <><h2 className="wk-card-title">{title}</h2><Loading /></>;
  if (lib === null || cg === null) return <><h2 className="wk-card-title">{title}</h2><p className="wk-card-muted">Tej bazy wiedzy nie możesz tu czytać — nie jest publiczna albo nie masz do niej dostępu.</p></>;
  if (doc === undefined) return <><h2 className="wk-card-title">{title}</h2><p className="wk-card-muted">Tego widoku nie ma w bazie wiedzy.</p></>;

  const open = (id: string) => {
    if (subject !== null && subject.library === config.library) { subject.choose(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else setState({ e: state.e === id ? null : id, d: null });
  };

  if (ctx.size.height === 'strip' && ctx.whole !== true) {
    return (
      <p className="cg-row">
        <strong>{title}</strong><span className="wk-card-muted">{list.length} wpisów</span>
        {ctx.openWhole !== undefined && <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>Zobacz</button>}
      </p>
    );
  }
  if (learning !== null) {
    return (
      <CogitaContext.Provider value={cg}>
        <LearnThis lib={lib} ids={learning.ids} title={learning.title} onClose={() => setLearning(null)} />
      </CogitaContext.Provider>
    );
  }
  if (!isTall(ctx)) {
    return (
      <CogitaContext.Provider value={cg}>
        <h2 className="wk-card-title">{title}</h2>
        {/* 2026-10-23 (Schritt 5) — was der Widok nach Tematy tat: ein Hinweis statt einer stillen Lücke. */}
        {saved.retired.length > 0 && <p className="wk-card-muted">{saved.retired.join(' ')}</p>}
        <ul className="cg-plain-list">{list.slice(0, 8).map((e) => <li key={e.id}><button type="button" className="cg-ref" onClick={() => open(e.id)}>{lib.label(e)}</button></li>)}</ul>
        {list.length > 8 && <p className="wk-card-muted">i {list.length - 8} więcej{ctx.openWhole !== undefined ? ' — ' : ''}{ctx.openWhole !== undefined && <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>cały widok</button>}</p>}
        {state.e !== undefined && <EntryCard lib={lib} id={state.e} ctx={ctx} scope={scope} delivery={state.d ?? null} onDelivery={(d) => setState({ d })} />}
      </CogitaContext.Provider>
    );
  }

  const words = fold(state.q ?? '').split(/\s+/).filter(Boolean);
  const textOf = (e: Entity) => `${lib.label(e)} ${fieldsOf(e, lib.look).map((f) => cellText(lib, e, f.key)).join(' ')}`;
  const shown = words.length === 0 ? list : list.filter((e) => { const t = fold(textOf(e)); return words.every((w) => t.includes(w)); });
  const sortKey = state.s ?? '';
  const shownLib = vlib ?? lib;
  const columns = viewColumns(shownLib, saved, list);
  const sorted = sortKey === '' ? shown : [...shown].sort((a, b) => cellText(shownLib, a, sortKey.replace(/^-/, '')).localeCompare(cellText(shownLib, b, sortKey.replace(/^-/, '')), 'pl', { numeric: true }) * (sortKey.startsWith('-') ? -1 : 1));
  const sortBy = (key: string) => setState({ s: sortKey === key ? `-${key}` : sortKey === `-${key}` ? null : key });
  const arrow = (key: string) => (sortKey === key ? ' ▲' : sortKey === `-${key}` ? ' ▼' : '');

  /* Der Weg: Widok › Feld › Eintrag. */
  const [row, col] = (state.c ?? '').split('~');
  const cellOpen = matrix !== null && state.c !== undefined ? { row: matrix.rows.find((g) => g.key === row), col: matrix.cols.find((g) => g.key === col) } : null;
  const cellIds = matrix !== null && cellOpen?.row !== undefined && cellOpen.col !== undefined ? matrix.cell(row, col) : null;
  const cellWords = cellOpen?.row !== undefined && cellOpen.col !== undefined ? `${cellOpen.row.label} × ${cellOpen.col.label}` : '';
  const openEntity = state.e === undefined ? undefined : lib.entity(state.e);
  const shownIds = cellIds ?? sorted.map((e) => e.id);

  return (
    <CogitaContext.Provider value={cg}>
      <h2 className="wk-card-title">{title}</h2>
      {saved.retired.length > 0 && <p className="wk-card-muted">{saved.retired.join(' ')}</p>}
      {(cellIds !== null || openEntity !== undefined) && (
        <nav className="cg-crumbs cg-muted" aria-label="Ścieżka w widoku">
          <button type="button" className="wk-link-btn" onClick={() => setState({ c: null, e: null, d: null })}>{title}</button>
          {cellIds !== null && <span>› <button type="button" className="wk-link-btn" onClick={() => setState({ e: null, d: null })}>{cellWords}</button></span>}
          {openEntity !== undefined && <span>› {lib.label(openEntity)}</span>}
        </nav>
      )}
      <div className="cg-row">
        <input type="search" className="cg-search" value={state.q ?? ''} onChange={(e) => setState({ q: e.target.value })} placeholder="Szukaj w widoku…" aria-label={`Szukaj: ${title}`} />
        <span className="cg-subtabs">
          {(['table', 'tree', 'matrix', 'map'] as const).filter((m) => m !== 'matrix' || saved.matrix !== null || mode === 'matrix').map((m) => (
            <button key={m} type="button" className={mode === m ? 'is-on' : ''} onClick={() => setState({ u: MODE_WORD[m], c: null })}>{MODE_LABEL[m]}</button>
          ))}
        </span>
        <span className="wk-card-muted">{shown.length === list.length ? `${list.length} wpisów` : `${shown.length} z ${list.length}`}</span>
        {shownIds.length > 0 && <button type="button" className="wk-link-btn" onClick={() => setLearning({ ids: shownIds, title: cellIds !== null ? cellWords : title })}>Ucz się tego</button>}
      </div>
      {mode === 'table' && (
        <div className="cg-table-wrap">
          <table className="cg-table">
            <thead>
              <tr>
                <th><button type="button" onClick={() => sortBy('_label')}>Nazwa{arrow('_label')}</button></th>
                {columns.map((c) => <th key={c.key}><button type="button" onClick={() => sortBy(c.key)}>{c.label}{arrow(c.key)}</button></th>)}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 500).map((e) => (
                <tr key={e.id} className={state.e === e.id ? 'is-on' : undefined}>
                  <td><button type="button" className="cg-ref" onClick={() => open(e.id)}>{lib.label(e)}</button></td>
                  {columns.map((c) => <td key={c.key}>{cellText(shownLib, e, c.key).slice(0, 160)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mode === 'tree' && (
        <ul className="cg-tree">
          {viewGroups(shownLib, saved, sorted).map((g) => (
            <li key={g.key || '#reszta'}>
              <details open={g.ids.length < 30}>
                <summary><strong>{g.label}</strong> <span className="cg-muted">({g.ids.length})</span></summary>
                <ul className="cg-tree">
                  {g.ids.slice(0, 500).map((id) => {
                    const e = lib.entity(id);
                    return e === undefined ? null : <li key={id}><button type="button" className="cg-ref" onClick={() => open(id)}>{lib.label(e)}</button></li>;
                  })}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      )}
      {mode === 'matrix' && matrix !== null && (
        <>
          <MatrixGrid matrix={words.length === 0 ? matrix : { ...matrix, cell: (r, c) => matrix.cell(r, c).filter((id) => shown.some((e) => e.id === id)) }}
            chosen={state.c ?? null} onCell={(r, c) => setState({ c: state.c === cellKey(r, c) ? null : cellKey(r, c), e: null, d: null })} />
          {cellIds !== null && (
            <section className="cg-card" aria-label={cellWords}>
              <h3>{cellWords} <span className="cg-muted">({cellIds.length})</span></h3>
              <ul className="cg-plain-list">
                {cellIds.map((id) => { const e = lib.entity(id); return e === undefined ? null : <li key={id}><button type="button" className="cg-ref" aria-pressed={state.e === id} onClick={() => open(id)}>{lib.label(e)}</button> <span className="cg-muted">{e.kinds.map((k) => lib.kind(k)?.name ?? k).join(', ')}</span></li>; })}
              </ul>
            </section>
          )}
        </>
      )}
      {mode === 'map' && <MapOf lib={lib} list={sorted} tall={isTall(ctx)} onOpen={open} onLearn={(ids, t) => setLearning({ ids, title: t })} />}
      {shown.length === 0 && <p className="wk-card-muted">Nic nie pasuje.</p>}
      {state.e !== undefined && <EntryCard lib={lib} id={state.e} ctx={ctx} scope={scope} delivery={state.d ?? null} onDelivery={(d) => setState({ d })} />}
    </CogitaContext.Provider>
  );
}
