/**
 * DIE ANSICHT DES BAUSTEINS „WIDOK" (`view.tsx`) — erst geladen, wenn eine
 * Seite ihn zeigt. Liest die Baza so, wie dieser Leser sie lesen darf
 * (`cogita/pageBase.ts`), rechnet den Widok wie „Wpisy" (`cogita/views.ts`)
 * und hält seinen Zustand unter seinem Zakres in der Adresse (`partQuery.ts`).
 */

import { useMemo } from 'react';

import type { PartContext } from '../part';
import { scopeOf, useScope } from '../partQuery';
import { useEntitySubject } from '../../cogita/entitySubject';
import { EntityView } from '../../cogita/FlowPlayer';
import { usePageBase } from '../../cogita/pageBase';
import { publicEntity } from '../../cogita/publish';
import { fieldsOf, fieldText, type Entity } from '../../cogita/schema';
import type { CogitaLibrary } from '../../cogita/store';
import { CogitaContext } from '../../cogita/ui';
import { readView, viewColumns, viewGroups, viewList } from '../../cogita/views';
import { Loading } from '../../ui/Loading';
import type { ViewConfig } from './view';

const isTall = (ctx: PartContext): boolean => ctx.whole === true || ctx.size.height === 'tall';
const fold = (s: string): string => s.toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Tabela oder Drzewo — was die Seite sagt, sonst was der Widok gespeichert hat (die Płótno zeigt eine Seite als Tabela). */
export function modeOf(asked: string, saved: string): 'table' | 'tree' {
  const word = asked.trim().toLowerCase();
  if (word === 'drzewo' || word === 'tree') return 'tree';
  if (word === 'tabela' || word === 'table') return 'table';
  return saved === 'tree' ? 'tree' : 'table';
}

function OneEntity({ lib, entry }: { lib: CogitaLibrary; entry: string }) {
  const entity = lib.entity(entry);
  if (entity === undefined) return null;
  return <div className="cg-card"><EntityView entity={publicEntity(lib, entity)} /></div>;
}

export function ViewView({ config, ctx }: { config: ViewConfig; ctx: PartContext }) {
  const { lib, ctx: cg } = usePageBase(config.library);
  const [state, setState] = useScope(scopeOf(ctx.moduleId));
  /* Wählt die Seite oben einen Eintrag dieser Baza, wählt ein Klick dort — sonst klappt er hier auf. */
  const subject = useEntitySubject();
  const doc = lib == null ? undefined : lib.docs('view').find((e) => e.id === config.view);
  const saved = useMemo(() => readView(doc?.data), [doc]);
  const list = useMemo(() => (lib == null || doc === undefined ? [] : viewList(lib, saved)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lib, lib?.revision, saved]);
  const title = config.title || saved.name || 'Widok';

  if (lib === undefined) return <><h2 className="wk-card-title">{title}</h2><Loading /></>;
  if (lib === null || cg === null) return <><h2 className="wk-card-title">{title}</h2><p className="wk-card-muted">Tej bazy wiedzy nie możesz tu czytać — nie jest publiczna albo nie masz do niej dostępu.</p></>;
  if (doc === undefined) return <><h2 className="wk-card-title">{title}</h2><p className="wk-card-muted">Tego widoku nie ma w bazie wiedzy.</p></>;

  const open = (id: string) => {
    if (subject !== null && subject.library === config.library) { subject.choose(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else setState({ e: state.e === id ? null : id });
  };

  if (ctx.size.height === 'strip' && ctx.whole !== true) {
    return (
      <p className="cg-row">
        <strong>{title}</strong><span className="wk-card-muted">{list.length} wpisów</span>
        {ctx.openWhole !== undefined && <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>Zobacz</button>}
      </p>
    );
  }
  if (!isTall(ctx)) {
    return (
      <CogitaContext.Provider value={cg}>
        <h2 className="wk-card-title">{title}</h2>
        <ul className="cg-plain-list">{list.slice(0, 8).map((e) => <li key={e.id}><button type="button" className="cg-ref" onClick={() => open(e.id)}>{lib.label(e)}</button></li>)}</ul>
        {list.length > 8 && <p className="wk-card-muted">i {list.length - 8} więcej{ctx.openWhole !== undefined ? ' — ' : ''}{ctx.openWhole !== undefined && <button type="button" className="wk-link-btn" onClick={ctx.openWhole}>cały widok</button>}</p>}
        {state.e !== undefined && <OneEntity lib={lib} entry={state.e} />}
      </CogitaContext.Provider>
    );
  }

  const mode = modeOf(state.u ?? config.mode, saved.mode);
  const words = fold(state.q ?? '').split(/\s+/).filter(Boolean);
  const textOf = (e: Entity) => `${lib.label(e)} ${fieldsOf(e, lib.look).map((f) => fieldText(e, f, lib.look)).join(' ')}`;
  const shown = words.length === 0 ? list : list.filter((e) => { const t = fold(textOf(e)); return words.every((w) => t.includes(w)); });
  const sortKey = state.s ?? '';
  const columns = viewColumns(lib, saved, list);
  const sorted = sortKey === '' ? shown : [...shown].sort((a, b) => {
    const key = sortKey.replace(/^-/, '');
    const cell = (e: Entity) => { if (key === '_label') return lib.label(e); const f = fieldsOf(e, lib.look).find((x) => x.key === key); return f === undefined ? '' : fieldText(e, f, lib.look); };
    return cell(a).localeCompare(cell(b), 'pl', { numeric: true }) * (sortKey.startsWith('-') ? -1 : 1);
  });
  const sortBy = (key: string) => setState({ s: sortKey === key ? `-${key}` : sortKey === `-${key}` ? null : key });
  const arrow = (key: string) => (sortKey === key ? ' ▲' : sortKey === `-${key}` ? ' ▼' : '');

  return (
    <CogitaContext.Provider value={cg}>
      <h2 className="wk-card-title">{title}</h2>
      <div className="cg-row">
        <input type="search" className="cg-search" value={state.q ?? ''} onChange={(e) => setState({ q: e.target.value })} placeholder="Szukaj w widoku…" aria-label={`Szukaj: ${title}`} />
        <span className="cg-subtabs">
          <button type="button" className={mode === 'table' ? 'is-on' : ''} onClick={() => setState({ u: 'tabela' })}>Tabela</button>
          <button type="button" className={mode === 'tree' ? 'is-on' : ''} onClick={() => setState({ u: 'drzewo' })}>Drzewo</button>
        </span>
        <span className="wk-card-muted">{shown.length === list.length ? `${list.length} wpisów` : `${shown.length} z ${list.length}`}</span>
      </div>
      {mode === 'table' ? (
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
                  {columns.map((c) => {
                    const f = fieldsOf(e, lib.look).find((x) => x.key === c.key);
                    return <td key={c.key}>{f === undefined ? '' : fieldText(e, f, lib.look).slice(0, 160)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="cg-tree">
          {viewGroups(lib, saved, sorted).map((g) => (
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
      {shown.length === 0 && <p className="wk-card-muted">Nic nie pasuje.</p>}
      {state.e !== undefined && <OneEntity lib={lib} entry={state.e} />}
    </CogitaContext.Provider>
  );
}
