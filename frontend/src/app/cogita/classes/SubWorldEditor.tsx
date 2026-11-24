/**
 * 2026-11-24 — DIE TEILWELT EINER KLASSE WÄHLEN (`subWorld.ts`): die ganze Welt oder nur einen Teil — Tags (mit Untertags) und
 * einzelne Türme, dazu (Vorgabe) alles, was sie voraussetzen. Die Zahl „N z M wież" steht sofort da; Speichern legt den Widok
 * „<Klasse> — świat" in der Baza an (oder ersetzt ihn), „Cały świat" nimmt ihn weg. Die Klassenseite zeigt ihn den Schülern.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { useT } from '../../core/i18n';
import { viewPath } from '../../routes';
import { handOffSelect } from '../worldmap/ClassSelect';
import { Loading } from '../../ui/Loading';
import { useAsync, useBusy, useCtx } from '../ui';
import type { LandscapeOnly } from '../views';
import { readView } from '../views';
import { readWorld } from '../worldmap/wmGraph';
import { placeKindsOf, worldInputOf } from '../worldmap/wmInput';
import { worldTags } from '../worldmap/wmTags';
import type { ClassOf } from './classModel';
import { baseWorldViewOf, classOnly, onlyEmpty, setClassView, subWorldPlaces } from './subWorld';
import './classes.css';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function SubWorldEditor({ klass }: { klass: ClassOf }) {
  const t = useT();
  const { lib, writes } = useCtx();
  const cards = useAsync(() => lib.cards().then((r) => r.cards), [lib, lib.revision]);
  const baseView = useMemo(() => {
    const id = baseWorldViewOf(lib);
    const doc = id === null ? undefined : lib.docs('view').find((d) => d.id === id);
    return doc === undefined ? null : readView(doc.data);
  }, [lib, lib.revision]); // eslint-disable-line react-hooks/exhaustive-deps
  const world = useMemo(() => (cards == null ? null : readWorld(worldInputOf(lib, cards, { placeKinds: baseView === null ? [] : placeKindsOf(baseView) }))), [lib, cards, baseView]);
  const net = useMemo(() => (world === null ? null : worldTags(world)), [world]);

  const saved = useMemo(() => classOnly(lib, klass.areaId), [lib, lib.revision, klass.areaId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [whole, setWhole] = useState(saved === null);
  const [tags, setTags] = useState<ReadonlySet<string>>(new Set(saved?.tags ?? []));
  const [places, setPlaces] = useState<ReadonlySet<string>>(new Set(saved?.places ?? []));
  const [withBase, setWithBase] = useState(saved?.withBase ?? true);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const { busy, failed, run } = useBusy();
  /* Ein anderer Stand kam (etwa nach dem Speichern): die Wahl daraus. */
  const savedKey = JSON.stringify(saved);
  useEffect(() => {
    setWhole(saved === null);
    setTags(new Set(saved?.tags ?? []));
    setPlaces(new Set(saved?.places ?? []));
    setWithBase(saved?.withBase ?? true);
  }, [savedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 2026-11-24 — was auf der Karte ausgeblendet ist (Türme, Erzählungen, Abschnitte, Wegweiser), bleibt beim Speichern der Liste. */
  const hides = saved === null ? {} : {
    ...(saved.hidePlaces === undefined ? {} : { hidePlaces: saved.hidePlaces }), ...(saved.hideFlows === undefined ? {} : { hideFlows: saved.hideFlows }),
    ...(saved.hideSections === undefined ? {} : { hideSections: saved.hideSections }), ...(saved.hideSigns === undefined ? {} : { hideSigns: saved.hideSigns })
  };
  const raw: LandscapeOnly = { tags: [...tags], places: [...places], withBase, ...hides };
  const only: LandscapeOnly | null = whole || onlyEmpty(raw) ? null : raw;
  const hideCount = { places: saved?.hidePlaces?.length ?? 0, parts: (saved?.hideSections?.length ?? 0) + (saved?.hideFlows?.length ?? 0), signs: saved?.hideSigns?.length ?? 0 };
  /* Auf der Karte wählen: die Weltkarte der Baza öffnet sich gleich im Wahl-Modus für diese Klasse. */
  const onMap = () => {
    const id = baseWorldViewOf(lib);
    if (id === null) return;
    handOffSelect(lib.libraryId, klass);
    window.location.hash = viewPath('knowledge', lib.libraryId, 'wpisy', 'widok', id);
  };
  const shown = useMemo(() => (world === null || net === null ? null : subWorldPlaces(world, net, only)), [world, net, JSON.stringify(only)]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Was über einen Tag hineinkommt (und nicht nur als Voraussetzung). */
  const byTag = useMemo(() => (world === null || net === null || only === null ? null : subWorldPlaces(world, net, { tags: only.tags, places: [], withBase: false })), [world, net, JSON.stringify(only)]); // eslint-disable-line react-hooks/exhaustive-deps

  if (cards === undefined || world === null || net === null) return <Loading label={t('cogitaSubWorld.loading')} />;
  const total = world.places.size;
  const count = shown === null ? total : shown.size;
  const toggle = (set: ReadonlySet<string>, id: string, put: (s: ReadonlySet<string>) => void) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); put(n); setNote(null); };

  /* Türme nach ihrem ersten Tag (sonst „bez tagu"), gefiltert nach der Suche, in der Ordnung der Welt. */
  const q = fold(query.trim());
  const nameOf = (id: string) => world.places.get(id)?.label ?? id;
  const groups = new Map<string, string[]>();
  for (const id of world.order) {
    if (q !== '' && !fold(nameOf(id)).includes(q)) continue;
    const tag = net.towerTags(id)[0] ?? '';
    groups.set(tag, [...(groups.get(tag) ?? []), id]);
  }
  const tagTree = (ids: readonly string[], depth: number): ReactNode => ids.length === 0 ? null : (
    <ul className="cl-sw-tags" role={depth === 0 ? 'tree' : 'group'}>
      {ids.map((id) => {
        const tag = net.tags.get(id);
        if (tag === undefined) return null;
        const n = [...net.below(id)].filter((x) => world.places.has(x)).length;
        return (
          <li key={id} role="treeitem" aria-selected={tags.has(id)}>
            <label className="wk-check"><input type="checkbox" checked={tags.has(id)} disabled={whole} onChange={() => toggle(tags, id, setTags)} data-subworld-tag={id} />
              <span>{tag.label} <span className="cg-muted">({t('cogitaSubWorld.towersN', { count: n })})</span></span></label>
            {depth < 4 && tagTree(tag.children, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  const save = () => run(async () => {
    if (!whole && only === null) { setNote(t('cogitaSubWorld.pickSomething')); return; }
    await setClassView(lib, klass, only, t('cogitaSubWorld.viewName', { name: klass.name }));
    setNote(only === null ? t('cogitaSubWorld.savedWhole') : t('cogitaSubWorld.saved', { count, total }));
  });

  return (
    <section className="cl-sw" data-subworld={klass.areaId} data-subworld-count={count} data-subworld-total={total}>
      <p className="wk-lede">{t('cogitaSubWorld.lead')}</p>
      <div className="cl-sw-choice" role="radiogroup" aria-label={t('cogitaSubWorld.what')}>
        <label className="wk-check"><input type="radio" name={`sw-${klass.areaId}`} checked={whole} onChange={() => { setWhole(true); setNote(null); }} data-subworld-whole="" /><span>{t('cogitaSubWorld.whole')}</span></label>
        <label className="wk-check"><input type="radio" name={`sw-${klass.areaId}`} checked={!whole} onChange={() => { setWhole(false); setNote(null); }} data-subworld-part="" /><span>{t('cogitaSubWorld.part')}</span></label>
      </div>
      <p className="cl-sw-count" role="status" data-subworld-shown={count}><strong>{t('cogitaSubWorld.count', { count, total })}</strong></p>
      {writes && baseWorldViewOf(lib) !== null && (
        <p><button type="button" className="wk-btn wk-btn-line" onClick={onMap} data-subworld-on-map="">{t('cogitaClassMap.onMap')}</button> <span className="cg-muted">{t('cogitaClassMap.onMapSays')}</span></p>
      )}
      {(hideCount.places + hideCount.parts + hideCount.signs) > 0 && !whole && (
        <p className="cg-muted" data-subworld-hides="">{t('cogitaClassMap.editorHides', hideCount)}</p>
      )}
      {!whole && (
        <>
          <label className="wk-check"><input type="checkbox" checked={withBase} onChange={(e) => { setWithBase(e.currentTarget.checked); setNote(null); }} data-subworld-base="" /><span>{t('cogitaSubWorld.withBase')}</span></label>
          <p className="cg-muted">{t('cogitaSubWorld.withBaseSays')}</p>
          {net.tags.size > 0 && (
            <fieldset className="cl-sw-set">
              <legend>{t('cogitaSubWorld.tags')}</legend>
              {tagTree(net.roots, 0)}
            </fieldset>
          )}
          <fieldset className="cl-sw-set">
            <legend>{t('cogitaSubWorld.towers')}</legend>
            <input type="search" className="cl-sw-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('cogitaSubWorld.search')} aria-label={t('cogitaSubWorld.search')} data-subworld-search="" />
            {[...groups.entries()].map(([tag, ids]) => (
              <div key={tag} className="cl-sw-group">
                <p className="cl-sw-grouphead">{tag === '' ? t('cogitaSubWorld.noTag') : net.tags.get(tag)?.label ?? tag}</p>
                <ul className="cl-sw-towers">
                  {ids.map((id) => {
                    const via = places.has(id) || shown?.has(id) !== true ? null : byTag?.has(id) === true ? t('cogitaSubWorld.byTopic') : t('cogitaSubWorld.included');
                    return (
                      <li key={id}>
                        <label className="wk-check"><input type="checkbox" checked={places.has(id)} onChange={() => toggle(places, id, setPlaces)} data-subworld-place={id} />
                          <span>{nameOf(id)}{via !== null && <span className="cg-muted"> · {via}</span>}</span></label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </fieldset>
        </>
      )}
      {writes ? (
        <div className="wk-actions">
          <button type="button" className="wk-btn" disabled={busy} onClick={() => void save()} data-subworld-save="">{t('cogitaSubWorld.save')}</button>
        </div>
      ) : <p className="cg-muted">{t('cogitaSubWorld.readOnly')}</p>}
      {note !== null && <p className="wk-note" role="status" data-subworld-note="">{note}</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}
