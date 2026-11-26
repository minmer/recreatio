/**
 * 2026-11-22 (Änderungspaket C2) — DER TAG-FILTER DES LERNENDEN auf der Weltkarte: ein Tag wählen (ein oberer zeigt alle Türme unter
 * sich, über alle Ebenen), dann mit einem Untertag verfeinern. Je Tag: erobert / alle Türme unter ihm. Zuerst nur Tags, unter denen
 * etwas erreichbar ist; „Alle Tags zeigen" zeigt den Rest. Das Netz ist kein Baum: ein Untertag steht unter jedem seiner oberen.
 * Der Filter der Autoren (der Widok) bleibt, wie er ist — dieser wählt nur, was gezeichnet wird.
 *
 * 2026-11-26 (Eigentümer: „in ein kleines Hamburger-Menü") — auf der Karte steht er im Menü (☰, `MapMenu.tsx`), nicht mehr über
 * ihr: dort der Weg (Alle › oberer › gewählter), die Vorschläge zum Verfeinern und der Baum zum Aufklappen, alles in einer Spalte.
 */

import { useState } from 'react';

import type { T } from '../../core/i18n';
import type { TagNetwork } from '../tags';

export interface TagSlicePickerProps {
  readonly net: TagNetwork;
  /** Der Weg vom oberen Tag zum gewählten (leer: alles). */
  readonly path: readonly string[];
  /** Tags, unter denen etwas erreichbar ist. */
  readonly reachable: ReadonlySet<string>;
  readonly count: (tag: string) => { readonly done: number; readonly total: number };
  readonly onPath: (path: readonly string[]) => void;
  readonly t: T;
  /** 2026-11-26 — im Menü der Karte: kein eigener Knopf, der Weg immer sichtbar, der Baum klappt in der Spalte auf. */
  readonly inMenu?: boolean;
}

/** Wie tief der Baum des Wählers höchstens zeigt (das Netz ist ohne Kreise; das ist nur eine Bremse). */
const MAX_DEPTH = 8;

export function TagSlicePicker({ net, path, reachable, count, onPath, t, inMenu = false }: TagSlicePickerProps) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  if (net.tags.size === 0) return null;
  const shown = (id: string) => all || reachable.has(id) || path.includes(id);
  const current = path[path.length - 1] ?? null;
  const nameOf = (id: string) => net.tags.get(id)?.label ?? id;
  const counted = (id: string) => { const c = count(id); return t('cogitaWorld.tags.count', { done: c.done, total: c.total }); };
  const counter = (id: string) => { const c = count(id); return t('cogitaWorld.tags.countTitle', { done: c.done, total: c.total }); };
  /* Verfeinern: die Untertags des gewählten (ohne Wahl: die oberen Tags). */
  const next = (current === null ? net.roots : net.tags.get(current)?.children ?? []).filter(shown);
  const hidden = (current === null ? net.roots : net.tags.get(current)?.children ?? []).length - next.length;
  const choose = (p: readonly string[]) => { onPath(p); setOpen(false); };

  const branch = (ids: readonly string[], above: readonly string[], depth: number) => (
    <ul className="cg-wm-tagtree" role={depth === 0 ? 'tree' : 'group'} aria-label={depth === 0 ? t('cogitaWorld.tags.tree') : undefined}>
      {ids.filter(shown).map((id) => {
        const p = [...above, id];
        const kids = depth < MAX_DEPTH ? (net.tags.get(id)?.children ?? []).filter(shown) : [];
        const on = p.join('|') === path.join('|');
        return (
          <li key={id} role="treeitem" aria-selected={on} aria-expanded={kids.length > 0 ? true : undefined} data-world-tag-node={id}>
            <button type="button" className={`cg-wm-tagpick${on ? ' is-on' : ''}${reachable.has(id) ? '' : ' is-far'}`} onClick={() => choose(p)} title={counter(id)} data-world-tag-choose={id}>
              <span>{nameOf(id)}</span> <span className="cg-wm-tagn">{counted(id)}</span>
            </button>
            {kids.length > 0 && branch(kids, p, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  const tree = (
    <div className={`cg-wm-tagpanel${inMenu ? ' is-inline' : ''}`} data-world-tag-panel="">
      {branch(net.roots, [], 0)}
      <label className="pe-check">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} data-world-tag-all="" />
        <span>{t('cogitaWorld.tags.showAll')}</span>
      </label>
    </div>
  );
  const chips = next.length > 0 && (
    <div className="cg-wm-tagchips" role="group" aria-label={current === null ? t('cogitaWorld.tags.start') : t('cogitaWorld.tags.refine')} data-world-tag-chips={next.length}>
      <span className="cg-wm-meta">{current === null ? t('cogitaWorld.tags.start') : t('cogitaWorld.tags.refine')}</span>
      {next.map((id) => (
        <button key={id} type="button" className="cg-wm-tagchip" onClick={() => onPath([...path, id])} title={counter(id)} data-world-tag-chip={id}>
          {nameOf(id)} <span className="cg-wm-tagn">{counted(id)}</span>
        </button>
      ))}
      {hidden > 0 && !all && <button type="button" className="wk-link-btn" onClick={() => setAll(true)} data-world-tag-more="">{t('cogitaWorld.tags.more', { count: hidden })}</button>}
    </div>
  );

  if (inMenu) {
    return (
      <div className="cg-wm-tagbar is-menu" role="group" aria-label={t('cogitaWorld.tags.label')} data-world-tagbar={current ?? ''} data-world-tag-path={path.join('|')}>
        <nav className="cg-wm-tagcrumbs" aria-label={t('cogitaWorld.tags.crumbs')}>
          {path.length === 0
            ? <strong data-world-tag-crumb="">{t('cogitaWorld.tags.all')}</strong>
            : <button type="button" className="wk-link-btn" onClick={() => onPath([])} data-world-tag-crumb="">{t('cogitaWorld.tags.all')}</button>}
          {path.map((id, i) => (
            <span key={`${id}:${i}`}>
              <span className="cg-wm-tagsep" aria-hidden="true">›</span>
              {i === path.length - 1
                ? <strong data-world-tag-crumb={id}>{nameOf(id)} <span className="cg-wm-tagn">{counted(id)}</span></strong>
                : <button type="button" className="wk-link-btn" onClick={() => onPath(path.slice(0, i + 1))} data-world-tag-crumb={id}>{nameOf(id)}</button>}
            </span>
          ))}
        </nav>
        {chips}
        <button type="button" className="wk-link-btn cg-wm-tagtreeopen" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-world-tag-open="">
          {t('cogitaWorld.tags.tree')} {open ? '▴' : '▾'}
        </button>
        {open && tree}
      </div>
    );
  }

  return (
    <div className="cg-wm-tagbar" role="group" aria-label={t('cogitaWorld.tags.label')} data-world-tagbar={current ?? ''} data-world-tag-path={path.join('|')}>
      <button type="button" className={`cg-wm-mode cg-wm-tagopen${current !== null ? ' is-on' : ''}`} aria-expanded={open} onClick={() => setOpen((v) => !v)} data-world-tag-open="">
        {t('cogitaWorld.tags.label')}: {current === null ? t('cogitaWorld.tags.all') : nameOf(current)} ▾
      </button>
      {path.length > 0 && (
        <nav className="cg-wm-tagcrumbs" aria-label={t('cogitaWorld.tags.crumbs')}>
          <button type="button" className="wk-link-btn" onClick={() => onPath([])} data-world-tag-crumb="">{t('cogitaWorld.tags.all')}</button>
          {path.map((id, i) => (
            <span key={`${id}:${i}`}>
              <span className="cg-wm-tagsep" aria-hidden="true">›</span>
              {i === path.length - 1
                ? <strong data-world-tag-crumb={id}>{nameOf(id)} <span className="cg-wm-tagn">{counted(id)}</span></strong>
                : <button type="button" className="wk-link-btn" onClick={() => onPath(path.slice(0, i + 1))} data-world-tag-crumb={id}>{nameOf(id)}</button>}
            </span>
          ))}
        </nav>
      )}
      {chips}
      {open && tree}
    </div>
  );
}
