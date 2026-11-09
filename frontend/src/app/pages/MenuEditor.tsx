/**
 * DAS MENÜ EINER SEITE BAUEN (0054) — über dem Editor der Seite.
 *
 * Ein Baum bis drei Ebenen tief: Einträge anlegen, darunter einrücken
 * (→) oder herausnehmen (←), verschieben (↑ ↓). Jeder Eintrag sagt, wohin er
 * führt, und zeigt es gleich daneben ausgerechnet — ein relativer Pfad ist
 * sonst eine Vermutung.
 *
 * <b>Hat die Seite kein eigenes Menü, hat sie keines</b> (0058: geerbt wird
 * nicht). Hat die Seite darüber eines, steht es hier als Vorschlag — samt dem
 * Weg, es zu übernehmen und abzuwandeln.
 *
 * <b>Oder sie HOLT sich eines (0056).</b> „Das Menü der Pfarrei gilt auch
 * hier" — dann steht dieselbe Leiste auf beiden Seiten, und wer einen
 * Eintrag hinzufügt, fügt ihn für beide hinzu. Das ist nicht dasselbe wie
 * „von oben": es geht quer durch das Register, zwischen Seiten, die nichts
 * übereinander wissen müssen.
 *
 * <b>Drei Zustände, und die Seite ist immer genau in einem:</b> eigenes Menü,
 * geholtes Menü, keines (dann gilt das von oben). Deshalb steht oben, WOHER
 * das Menü kommt, bevor darunter steht, was darin ist.
 */

import { useCallback, useEffect, useState } from 'react';

import { adoptMenuOf, hrefOf, loadMenu, saveMenu } from './menu';
import { joinPath, menuImageOf } from './menuPath';
import { type MenuItem } from './page';
import { ImagePicker } from './PageFiles';
import { imageUrl } from './slides/slideLook';
import { WorkspaceError } from '../core/session';
import { askText, toast } from '../ui/dialogs';
import { Loading } from '../ui/Loading';
import { rich, useT } from '../core/i18n';

interface Draft {
  readonly id: number;
  readonly label: string;
  readonly kind: MenuItem['kind'];
  readonly target: string;
  readonly children: readonly Draft[];
  /** 2026-10-21 — ein Bild statt des Namens (leer: keines). */
  readonly image: string;
}

const MAX_DEPTH = 3;
let counter = 0;
const nextId = () => ++counter;

const toDraft = (items: readonly MenuItem[]): Draft[] =>
  items.map((one) => ({ id: nextId(), label: one.label, kind: one.kind, target: one.target, children: toDraft(one.children), image: one.image ?? '' }));

const toItems = (drafts: readonly Draft[]): MenuItem[] =>
  drafts.map((one) => ({
    label: one.label.trim(), kind: one.kind, target: one.target.trim(), children: toItems(one.children),
    ...(one.image.trim() === '' ? {} : { image: one.image.trim() })
  }));

const blank = (): Draft => ({ id: nextId(), label: '', kind: 'rel', target: '', children: [], image: '' });

/**
 * Ein Menü von oben ÜBERNEHMEN: seine relativen Ziele galten von DORT aus —
 * hier kopiert, werden sie zu festen Pfaden, sonst zeigten sie auf einmal woanders hin.
 */
const absolutise = (items: readonly MenuItem[], from: string): MenuItem[] =>
  items.map((one) => ({
    ...one,
    kind: one.kind === 'rel' ? 'abs' : one.kind,
    target: one.kind === 'rel' ? joinPath(from, one.target) : one.target,
    children: absolutise(one.children, from)
  }));

/*
 * 2026-10-20 — DIE HAUPTSEITE hat den leeren Pfad: gezeigt als „recreatio.pl/", gewählt als „/"
 * (ein leeres "uses" hiesse für den Dienst: den Verweis lösen; „/" macht er selbst zu „").
 */
const shownPath = (path: string): string => (path === '' ? 'recreatio.pl/' : path);
const pickPath = (path: string): string => (path === '' ? '/' : path);

/* -- Den Baum umbauen: jede Änderung gibt einen neuen Baum zurück ------------------------ */

type Path = readonly number[];

function update(list: readonly Draft[], path: Path, change: (siblings: Draft[], at: number) => Draft[]): Draft[] {
  if (path.length === 1) return change([...list], path[0]);
  return list.map((one, i) => (i === path[0] ? { ...one, children: update(one.children, path.slice(1), change) } : one));
}

const at = (list: readonly Draft[], path: Path): Draft | undefined =>
  path.length === 1 ? list[path[0]] : at(list[path[0]]?.children ?? [], path.slice(1));

const depthOf = (draft: Draft): number => 1 + Math.max(0, ...draft.children.map(depthOf));

const KINDS: readonly { value: MenuItem['kind']; label: string; hint: string }[] = [
  { value: 'rel', label: 'pagesMenu.kind.rel', hint: 'pagesMenu.hint.rel' },
  { value: 'abs', label: 'pagesMenu.kind.abs', hint: 'pagesMenu.hint.abs' },
  { value: 'url', label: 'pagesMenu.kind.url', hint: 'pagesMenu.hint.url' },
  { value: 'none', label: 'pagesMenu.kind.none', hint: '' }
];

export function MenuEditor({ path }: { path: string }) {
  const t = useT();
  const [items, setItems] = useState<Draft[] | null>(null);
  const [own, setOwn] = useState(false);
  const [uses, setUses] = useState<{ from: string; items: readonly MenuItem[] | null } | null>(null);
  const [usable, setUsable] = useState<readonly { path: string; items: number }[]>([]);
  const [inherited, setInherited] = useState<{ from: string; items: readonly MenuItem[] } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  /* 2026-10-21 — bei welchem Eintrag die Auswahl des Bildes offen ist. */
  const [picking, setPicking] = useState<number | null>(null);

  const look = useCallback(async () => {
    try {
      const found = await loadMenu(path);
      setOwn(found.items !== null);
      setItems(toDraft(found.items ?? []));
      setUses(found.uses);
      setUsable(found.usable);
      setInherited(found.inherited);
      setDirty(false);
      setFailed(null);
    } catch (e) {
      setItems([]);
      setFailed(e instanceof WorkspaceError ? e.message : t('pagesMenu.loadFailed'));
    }
  }, [path]);

  useEffect(() => { void look(); }, [look]);

  if (items === null) return <Loading label={t('pagesMenu.loading')} />;

  const change = (next: Draft[]) => { setItems(next); setDirty(true); };

  const save = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await saveMenu(path, toItems(items));
      await look();
      toast(t('pagesMenu.saved'), { kind: 'ok' });
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('pagesMenu.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  /* Das Menü einer anderen Seite hier gelten lassen — ein Verweis, keine Kopie. */
  const take = async (from: string) => {
    setBusy(true);
    setFailed(null);
    try {
      await adoptMenuOf(path, from);
      await look();
      toast(t('pagesMenu.saved'), { kind: 'ok' });
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('pagesMenu.takeFailed'));
    } finally {
      setBusy(false);
    }
  };

  /* Den Verweis lösen: die Seite hat wieder keines — und dann auch keine Leiste (0058: geerbt wird nicht). */
  const release = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await saveMenu(path, []);
      await look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('pagesMenu.releaseFailed'));
    } finally {
      setBusy(false);
    }
  };

  const row = (draft: Draft, where: Path, depth: number) => {
    const set = (patch: Partial<Draft>) =>
      change(update(items, where, (list, i) => { list[i] = { ...list[i], ...patch }; return list; }));
    const index = where[where.length - 1];
    const siblings = where.length === 1 ? items : at(items, where.slice(0, -1))!.children;
    const href = draft.kind === 'none' ? null : hrefOf({ ...draft, children: [] }, path);
    const kind = KINDS.find((k) => k.value === draft.kind)!;
    const image = menuImageOf(draft.image);

    return (
      <li key={draft.id} className="wk-menued-item">
        <div className="wk-menued-row" style={{ paddingLeft: `${(depth - 1) * 1.5}rem` }}>
          {/* 2026-10-21 — ein Logo statt des Namens: das Bildchen öffnet die Auswahl. */}
          <button type="button" className={`wk-menued-btn wk-menued-logo${image === null ? '' : ' is-set'}`}
            aria-label={t(image === null ? 'pagesMenu.imageInstead' : 'pagesMenu.imageChange')} aria-expanded={picking === draft.id}
            title={t(image === null ? 'pagesMenu.imageInstead' : 'pagesMenu.imageChangeTitle')}
            onClick={() => setPicking(picking === draft.id ? null : draft.id)}>
            {image === null ? '▣' : <img src={imageUrl(image)} alt="" />}
          </button>
          <input className="wk-menued-label" value={draft.label} placeholder={t(image === null ? 'pagesMenu.name' : 'pagesMenu.nameImage')} aria-label={t('pagesMenu.nameAria')} maxLength={80}
            onChange={(e) => set({ label: e.target.value })} />
          <select value={draft.kind} aria-label={t('pagesMenu.targetKind')} onChange={(e) => set({ kind: e.target.value as MenuItem['kind'] })}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{t(k.label)}</option>)}
          </select>
          {draft.kind !== 'none' && (
            <input className="wk-menued-target" value={draft.target} placeholder={kind.hint === '' ? '' : t(kind.hint)} aria-label={t('pagesMenu.target')} maxLength={400}
              onChange={(e) => set({ target: e.target.value })} />
          )}
          <span className="wk-menued-tools">
            <button type="button" className="wk-menued-btn" aria-label={t('pagesMenu.up')} disabled={index === 0}
              onClick={() => change(update(items, where, (list, i) => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; return list; }))}>↑</button>
            <button type="button" className="wk-menued-btn" aria-label={t('pagesMenu.down')} disabled={index === siblings.length - 1}
              onClick={() => change(update(items, where, (list, i) => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; return list; }))}>↓</button>
            <button type="button" className="wk-menued-btn" aria-label={t('pagesMenu.indent')}
              disabled={index === 0 || depth + depthOf(draft) - 1 >= MAX_DEPTH}
              onClick={() => change(update(items, where, (list, i) => {
                const [moved] = list.splice(i, 1);
                list[i - 1] = { ...list[i - 1], children: [...list[i - 1].children, moved] };
                return list;
              }))}>→</button>
            <button type="button" className="wk-menued-btn" aria-label={t('pagesMenu.outdent')} disabled={where.length === 1}
              onClick={() => {
                const parentPath = where.slice(0, -1);
                let moved: Draft | null = null;
                let next = update(items, where, (list, i) => { [moved] = list.splice(i, 1); return list; });
                next = update(next, parentPath, (list, i) => { list.splice(i + 1, 0, moved!); return list; });
                change(next);
              }}>←</button>
            <button type="button" className="wk-menued-btn" aria-label={t('pagesMenu.addChild')} disabled={depth >= MAX_DEPTH}
              onClick={() => set({ children: [...draft.children, blank()] })}>+</button>
            <button type="button" className="wk-menued-btn wk-danger" aria-label={t('pagesMenu.removeItem')}
              onClick={() => change(update(items, where, (list, i) => { list.splice(i, 1); return list; }))}>×</button>
          </span>
          {href !== null && draft.target.trim() !== '' && (
            <span className="wk-menued-preview">→ <code>{href}</code></span>
          )}
        </div>

        {picking === draft.id && (
          <div className={`wk-menued-image is-depth-${depth}`}>
            <ImagePicker path={path} value={draft.image} busy={busy} onPick={(url) => set({ image: url })} />
            <label className="se-inline">
              <span>{t('pagesMenu.imageAddress')}</span>
              <input value={draft.image} maxLength={400} placeholder={t('pagesMenu.imagePlaceholder')} aria-invalid={draft.image.trim() !== '' && image === null}
                onChange={(e) => set({ image: e.target.value })} />
            </label>
            <div className="wk-actions">
              {draft.image !== '' && <button type="button" className="wk-link-btn" onClick={() => set({ image: '' })}>{t('pagesMenu.noImage')}</button>}
              <button type="button" className="wk-link-btn" onClick={() => setPicking(null)}>{t('pagesMenu.done')}</button>
            </div>
          </div>
        )}

        {draft.children.length > 0 && (
          <ul className="wk-menued-list">
            {draft.children.map((child, i) => row(child, [...where, i], depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section className="wk-menued">
      {uses !== null ? (
        <div className="wk-menued-source">
          <p className="wk-note">
            {rich(uses.items === null
              ? t('pagesMenu.fromGone', { page: shownPath(uses.from) })
              : t('pagesMenu.fromPage', { page: shownPath(uses.from), count: uses.items.length }), { code: (s, k) => <code key={k}>{s}</code> })}
          </p>

          {uses.items !== null && (
            <p className="wk-hint">
              {uses.items.map((one) => one.label).join(' · ')}
            </p>
          )}

          <div className="wk-actions">
            {uses.items !== null && (
              <button type="button" className="wk-link-btn" disabled={busy}
                onClick={() => change(toDraft(absolutise(uses.items!, uses.from)))}>
                {t('pagesMenu.copyHere')}
              </button>
            )}
            <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={() => void release()}>
              {t('pagesMenu.release')}
            </button>
          </div>
        </div>
      ) : !own && items.length === 0 ? (
        <div className="wk-menued-source">
          <p className="wk-hint">{t('pagesMenu.none')}</p>

          {/* 0058 — die Seite darüber hat eines: als Vorschlag, nicht von selbst. */}
          {inherited !== null && (
            <div className="wk-actions">
              <button type="button" className="wk-btn wk-btn-quiet" disabled={busy} onClick={() => void take(pickPath(inherited.from))}>
                {t('pagesMenu.useParent', { page: shownPath(inherited.from) })}
              </button>
              <span className="wk-hint">{t('pagesMenu.useParentHint', { count: inherited.items.length })}</span>
            </div>
          )}

          {/* Ein Menü, das es schon gibt, statt eines zweiten daneben. */}
          {usable.length > 0 && (
            <label className="wk-field">
              <span>{t('pagesMenu.takeOther')}</span>
              <select value="" disabled={busy} onChange={(e) => { if (e.target.value !== '') void take(e.target.value); }}>
                <option value="">{t('pages.pick.choose')}</option>
                {usable.map((one) => (
                  <option key={one.path} value={pickPath(one.path)}>{t('pagesMenu.pageOption', { page: shownPath(one.path), count: one.items })}</option>
                ))}
              </select>
              <span className="wk-hint">{t('pagesMenu.takeOtherHint')}</span>
            </label>
          )}
        </div>
      ) : (
        /*
           Ein eigenes Menü: hier steht, dass es sich teilen lässt. Sonst wüsste
           niemand davon — die Auswahl steht auf der ANDEREN Seite, und wer
           dieses Menü gebaut hat, kommt dort nie vorbei.
        */
        <p className="wk-hint">{t('pagesMenu.shareable')}</p>
      )}

      {items.length > 0 && <ul className="wk-menued-list">{items.map((one, i) => row(one, [i], 1))}</ul>}

      <p className="wk-hint">{rich(t('pagesMenu.pathsHint', { path }), { code: (s, k) => <code key={k}>{s}</code> })}</p>

      {failed !== null && <p className="wk-error">{failed}</p>}

      <div className="wk-actions">
        <button type="button" className="wk-btn wk-btn-quiet" onClick={() => change([...items, blank()])}>{t('pagesMenu.addItem')}</button>
        {!own && inherited !== null && items.length === 0 && (
          <button type="button" className="wk-link-btn" onClick={() => change(toDraft(absolutise(inherited.items, inherited.from)))}>
            {t('pagesMenu.copyParent')}
          </button>
        )}
        <button type="button" className="wk-btn" disabled={busy || !dirty} onClick={() => void save()}>
          {busy ? t('pages.editor.saving') : t('pagesMenu.save')}
        </button>
        {own && (
          <button type="button" className="wk-link-btn wk-danger" disabled={busy}
            onClick={async () => { if (await askText(t('pagesMenu.removeAsk'))) { setItems([]); setDirty(true); void saveMenu(path, []).then(look); } }}>
            {t('pagesMenu.remove')}
          </button>
        )}
      </div>
    </section>
  );
}

export default MenuEditor;
