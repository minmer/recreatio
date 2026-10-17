/**
 * EINE AUSWAHL AUS EINEM BAUM — für jede Stelle, an der man einen Bereich (oder
 * sonst etwas Verschachteltes) wählt.
 *
 * <b>Warum kein `<select>`.</b> Eine Liste kennt keine Tiefe: jede Zeile trug
 * ihren ganzen Weg („Parafia › Bierzmowanie › Kandydaci"), dieselben Anfänge
 * standen untereinander, und bei vierzig Bereichen las man nur noch Wege.
 *
 * <b>Hier steht der Baum, wie er ist</b>: eingerückt, mit Linien, zu- und
 * aufklappbar; ein Knoten, der selbst nicht zur Wahl steht, steht trotzdem da
 * — als Weg zu denen darunter. Ein kleiner Baum ist ganz offen, ein grosser
 * nur bis zur Wahl; die Suche (ohne Akzente: „grzegorzki") zeigt Treffer mit
 * ihrem Weg. Oben stehen feste Zeilen („Tylko ja", „— bez obszaru —") und, wenn
 * es sie gibt, die zuletzt gewählten.
 *
 * <code>
 *   TreePick   ein Wert: ein Feld, das den Weg zeigt, und ein Fenster daran
 *   TreeList   mehrere Werte (Kästchen) oder eingebettet — dieselbe Liste
 * </code>
 *
 * Tastatur: ↑ ↓ wandern, → öffnet (oder geht hinein), ← schliesst (oder geht
 * hinauf), Enter wählt, Esc schliesst; Tippen sucht.
 */

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Icon } from './icons';
import { usePortal } from './Modal';

/* -- Was hineinkommt ------------------------------------------------------------- */

export interface TreeNode {
  readonly id: string;
  /** Der Knoten darüber — `null` (oder einer, den es hier nicht gibt): ganz oben. */
  readonly parentId: string | null;
  readonly label: string;
  /** Steht er zur Wahl? Sonst nur als Weg zu denen darunter (und ohne solche gar nicht). */
  readonly selectable?: boolean;
  /** Ein kurzer Zusatz hinter dem Namen („kanał już jest"). */
  readonly note?: string | null;
  /** Wo er unter seinen Geschwistern steht: kleiner zuerst, gleich nach dem Alphabet (fehlt: 0). */
  readonly order?: number;
  /** Anfangs zu, auch in einem kleinen Baum — ein Ordner, der viel Gleichartiges sammelt („Rozmowy"). Liegt die Wahl darin, ist er offen. */
  readonly closed?: boolean;
}

/** Eine feste Zeile über dem Baum: „Tylko ja", „— bez obszaru —". */
export interface TreeExtra {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
  readonly disabled?: boolean;
}

/* -- Der Baum, gerechnet ----------------------------------------------------------- */

const collator = new Intl.Collator('pl', { sensitivity: 'base', numeric: true });

const fold = (text: string): string =>
  text.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '');

interface Shaped {
  readonly byId: ReadonlyMap<string, TreeNode>;
  readonly children: ReadonlyMap<string | null, readonly TreeNode[]>;
  /** Wie viele wählbare Knoten unter (und mit) einem Knoten stehen. */
  readonly offered: ReadonlyMap<string, number>;
  /** Wie viele Zeilen dastehen, solange die Ordner (`closed`) zu sind — daran misst sich „kleiner Baum". */
  readonly plain: number;
}

function shape(nodes: readonly TreeNode[]): Shaped {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parentOf = (n: TreeNode) => (n.parentId !== null && byId.has(n.parentId) && n.parentId !== n.id ? n.parentId : null);

  const children = new Map<string | null, TreeNode[]>();
  for (const n of nodes) {
    const p = parentOf(n);
    children.set(p, [...(children.get(p) ?? []), n]);
  }
  /* Nach dem Alphabet — wie man sucht, nicht wie es angelegt wurde; was eine Ordnung trägt, davor oder danach. */
  for (const list of children.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || collator.compare(a.label, b.label));

  /* Was nichts Wählbares trägt, fällt weg — ein Ast ohne Ziel ist nur Lärm. Gegen Kreise: jeder Knoten einmal. */
  const offered = new Map<string, number>();
  let plain = 0;
  const count = (n: TreeNode, seen: Set<string>, folded: boolean): number => {
    if (seen.has(n.id)) return 0;
    seen.add(n.id);
    const below = (children.get(n.id) ?? []).reduce((sum, c) => sum + count(c, seen, folded || n.closed === true), 0);
    const total = below + (n.selectable === false ? 0 : 1);
    offered.set(n.id, total);
    if (total > 0 && !folded) plain++;
    return total;
  };
  const seen = new Set<string>();
  for (const root of children.get(null) ?? []) count(root, seen, false);

  return { byId, children, offered, plain };
}

/** Der Weg von oben bis zu diesem Knoten. */
export function pathOf(nodes: readonly TreeNode[] | ReadonlyMap<string, TreeNode>, id: string): readonly TreeNode[] {
  const byId = nodes instanceof Map ? nodes : new Map((nodes as readonly TreeNode[]).map((n) => [n.id, n]));
  const out: TreeNode[] = [];
  const seen = new Set<string>();
  let at: string | null = id;
  while (at !== null && !seen.has(at)) {
    seen.add(at);
    const here: TreeNode | undefined = byId.get(at);
    if (here === undefined) break;
    out.unshift(here);
    at = here.parentId;
  }
  return out;
}

interface Row {
  readonly node: TreeNode;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly open: boolean;
  /** Wo die Linien links weiterlaufen (je Ebene: geht darunter noch ein Geschwister?). */
  readonly rails: readonly boolean[];
  readonly last: boolean;
}

/* -- Die Liste ------------------------------------------------------------------------ */

export function TreeList({ nodes, selected, onPick, multiple = false, extras = [], recent = [], search, autoFocusSearch = false, onClose, label, emptyText = 'Nic tu nie ma.', inline = false }: {
  nodes: readonly TreeNode[];
  /** Was gewählt ist — bei `multiple` mehrere. */
  selected: readonly string[];
  onPick: (value: string) => void;
  multiple?: boolean;
  extras?: readonly TreeExtra[];
  /** Zuletzt gewählte (ihre Kennungen) — als eigene Zeilen über dem Baum. */
  recent?: readonly string[];
  /** Mit Suche? Von selbst ab etwa zwölf Zeilen. */
  search?: boolean;
  autoFocusSearch?: boolean;
  /** Esc und Tab — nur im Fenster von `TreePick`. */
  onClose?: () => void;
  label: string;
  emptyText?: string;
  /** Eingebettet in die Seite (mit Rahmen und eigener Höhe) statt im Fenster von `TreePick`. */
  inline?: boolean;
}) {
  const id = useId();
  const tree = useMemo(() => shape(nodes), [nodes]);
  const visibleCount = useMemo(() => [...tree.offered.values()].filter((n) => n > 0).length, [tree]);

  /* Offen: ein kleiner Baum ganz (ohne seine Ordner), ein grosser bis zur Wahl (und die Wurzeln, wenn es wenige sind). */
  const [open, setOpen] = useState<ReadonlySet<string>>(() => {
    const toChoice = new Set<string>();
    for (const value of selected) for (const step of pathOf(tree.byId, value).slice(0, -1)) toChoice.add(step.id);
    const out = new Set(toChoice);
    if (tree.plain <= 24) {
      for (const n of nodes) if (n.closed !== true) out.add(n.id);
      return out;
    }
    const roots = (tree.children.get(null) ?? []).filter((r) => (tree.offered.get(r.id) ?? 0) > 0 && r.closed !== true);
    if (roots.length <= 3) for (const r of roots) out.add(r.id);
    return out;
  });
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const withSearch = search ?? visibleCount + extras.length > 12;

  /* Erst im nächsten Takt: das Fenster hängt sein Portal erst nach diesem Effekt ein, und etwas Abgehängtes nimmt keinen Fokus. */
  useEffect(() => {
    if (!autoFocusSearch) return undefined;
    const t = setTimeout(() => (withSearch ? searchRef.current : listRef.current)?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(t);
  }, [autoFocusSearch, withSearch]);

  /* Die Zeilen, wie sie dastehen: gesucht (Treffer mit Weg, alles offen) oder geklappt. */
  const rows = useMemo((): readonly Row[] => {
    const q = fold(query.trim());
    const keep = new Set<string>();
    if (q !== '') {
      for (const n of nodes) {
        if ((tree.offered.get(n.id) ?? 0) === 0 || !fold(n.label).includes(q)) continue;
        for (const step of pathOf(tree.byId, n.id)) keep.add(step.id);
      }
    }

    const out: Row[] = [];
    const walk = (parent: string | null, depth: number, rails: readonly boolean[]) => {
      const kids = (tree.children.get(parent) ?? []).filter((c) => (tree.offered.get(c.id) ?? 0) > 0 && (q === '' || keep.has(c.id)));
      kids.forEach((node, i) => {
        const last = i === kids.length - 1;
        const below = (tree.children.get(node.id) ?? []).some((c) => (tree.offered.get(c.id) ?? 0) > 0 && (q === '' || keep.has(c.id)));
        const isOpen = q !== '' || open.has(node.id);
        out.push({ node, depth, hasChildren: below, open: isOpen, rails, last });
        if (below && isOpen) walk(node.id, depth + 1, [...rails, !last]);
      });
    };
    walk(null, 0, []);
    return out;
  }, [nodes, tree, open, query]);

  const q = fold(query.trim());
  const shownExtras = q === '' ? extras : extras.filter((e) => fold(e.label).includes(q));
  const shownRecent = q === '' ? recent.filter((r) => tree.byId.has(r) && tree.byId.get(r)?.selectable !== false) : [];

  /* Alle Zeilen, die man mit den Pfeilen erreicht — in der Reihenfolge, in der sie dastehen. */
  const keys = [
    ...shownExtras.filter((e) => e.disabled !== true).map((e) => `x:${e.value}`),
    ...shownRecent.map((r) => `r:${r}`),
    ...rows.map((r) => `t:${r.node.id}`)
  ];
  const activeKey = active !== null && keys.includes(active) ? active : null;

  useEffect(() => {
    if (activeKey === null) return;
    listRef.current?.querySelector(`[data-key="${CSS.escape(activeKey)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeKey]);

  /* Beim Öffnen steht der Zeiger auf der Wahl. */
  useEffect(() => {
    const first = selected[0];
    if (first === undefined) return;
    setActive(extras.some((e) => e.value === first) ? `x:${first}` : `t:${first}`);
    const row = listRef.current?.querySelector(`[data-key="${CSS.escape(`t:${first}`)}"]`);
    row?.scrollIntoView({ block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Beim Suchen steht der Zeiger auf dem ersten wählbaren Treffer — Enter nimmt ihn. */
  useEffect(() => {
    const qq = fold(query.trim());
    if (qq === '') return;
    const hit = rows.find((r) => r.node.selectable !== false && fold(r.node.label).includes(qq));
    const extra = extras.find((e) => e.disabled !== true && fold(e.label).includes(qq));
    setActive(hit !== undefined ? `t:${hit.node.id}` : extra !== undefined ? `x:${extra.value}` : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const valueOf = (key: string) => key.slice(2);
  const rowOf = (key: string) => (key.startsWith('t:') ? rows.find((r) => r.node.id === valueOf(key)) : undefined);
  const toggle = (nodeId: string, to?: boolean) => setOpen((was) => {
    const next = new Set(was);
    if (to ?? !next.has(nodeId)) next.add(nodeId); else next.delete(nodeId);
    return next;
  });

  const onKey = (e: KeyboardEvent) => {
    const i = activeKey === null ? -1 : keys.indexOf(activeKey);
    const go = (k: string | undefined) => { if (k !== undefined) { e.preventDefault(); setActive(k); } };
    switch (e.key) {
      case 'ArrowDown': go(keys[Math.min(keys.length - 1, i + 1)]); break;
      case 'ArrowUp': go(keys[Math.max(0, i - 1)]); break;
      case 'Home': if (e.target !== searchRef.current) go(keys[0]); break;
      case 'End': if (e.target !== searchRef.current) go(keys[keys.length - 1]); break;
      case 'ArrowRight': {
        const row = activeKey === null ? undefined : rowOf(activeKey);
        if (row === undefined || !row.hasChildren || (e.target === searchRef.current && query !== '')) break;
        e.preventDefault();
        if (!row.open) toggle(row.node.id, true);
        else go(keys[i + 1]);
        break;
      }
      case 'ArrowLeft': {
        const row = activeKey === null ? undefined : rowOf(activeKey);
        if (row === undefined || (e.target === searchRef.current && query !== '')) break;
        e.preventDefault();
        if (row.hasChildren && row.open && query === '') toggle(row.node.id, false);
        else if (row.node.parentId !== null && tree.byId.has(row.node.parentId)) setActive(`t:${row.node.parentId}`);
        break;
      }
      case 'Enter': {
        if (activeKey === null) break;
        e.preventDefault();
        const row = rowOf(activeKey);
        if (row !== undefined && row.node.selectable === false) { toggle(row.node.id); break; }
        onPick(valueOf(activeKey));
        break;
      }
      case ' ': {
        if (!multiple || activeKey === null || e.target === searchRef.current) break;
        e.preventDefault();
        if (rowOf(activeKey)?.node.selectable !== false) onPick(valueOf(activeKey));
        break;
      }
      case 'Escape': if (onClose !== undefined) { e.preventDefault(); e.stopPropagation(); onClose(); } break;
      case 'Tab': onClose?.(); break;
      default:
        /* Tippen sucht — auch, wenn der Fokus gerade auf der Liste liegt. */
        if (withSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.target !== searchRef.current) {
          searchRef.current?.focus();
        }
    }
  };

  const mark = (text: string): ReactNode => {
    if (q === '') return text;
    const at = fold(text).indexOf(q);
    if (at < 0) return text;
    return <>{text.slice(0, at)}<mark>{text.slice(at, at + q.length)}</mark>{text.slice(at + q.length)}</>;
  };

  const isOn = (value: string) => selected.includes(value);
  const optionId = (key: string) => `${id}-${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  return (
    <div className={`ui-tree${inline ? ' is-inline' : ''}`} onKeyDown={onKey}>
      {withSearch && (
        <div className="ui-tree-search">
          <Icon name="search" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder="Szukaj…"
            aria-label={`Szukaj: ${label}`}
            aria-controls={`${id}-list`}
            aria-activedescendant={activeKey === null ? undefined : optionId(activeKey)}
            onChange={(e) => { setQuery(e.target.value); setActive(null); }}
          />
        </div>
      )}

      <div
        ref={listRef}
        id={`${id}-list`}
        className="ui-tree-list"
        role="tree"
        aria-label={label}
        aria-multiselectable={multiple || undefined}
        tabIndex={withSearch ? -1 : 0}
        aria-activedescendant={withSearch || activeKey === null ? undefined : optionId(activeKey)}
      >
        {shownExtras.map((extra) => {
          const key = `x:${extra.value}`;
          return (
            <div
              key={key} id={optionId(key)} data-key={key} role="treeitem" aria-level={1} aria-selected={isOn(extra.value)}
              aria-disabled={extra.disabled || undefined}
              className={`ui-tree-row is-extra${isOn(extra.value) ? ' is-on' : ''}${activeKey === key ? ' is-active' : ''}${extra.disabled === true ? ' is-off' : ''}`}
              onMouseEnter={() => extra.disabled !== true && setActive(key)}
              onClick={() => { if (extra.disabled !== true) onPick(extra.value); }}
            >
              <span className="ui-tree-mark" aria-hidden="true">{multiple ? <span className={`ui-tree-box${isOn(extra.value) ? ' is-on' : ''}`}>{isOn(extra.value) && <Icon name="check" />}</span> : isOn(extra.value) && <Icon name="check" />}</span>
              <span className="ui-tree-label">{mark(extra.label)}{extra.hint !== undefined && <small className="ui-tree-note">{extra.hint}</small>}</span>
            </div>
          );
        })}

        {shownRecent.length > 0 && <div className="ui-tree-section" role="presentation">Ostatnio</div>}
        {shownRecent.map((value) => {
          const key = `r:${value}`;
          const path = pathOf(tree.byId, value);
          return (
            <div
              key={key} id={optionId(key)} data-key={key} role="treeitem" aria-level={1} aria-selected={isOn(value)}
              className={`ui-tree-row is-extra${isOn(value) ? ' is-on' : ''}${activeKey === key ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(key)}
              onClick={() => onPick(value)}
            >
              <span className="ui-tree-mark" aria-hidden="true">{isOn(value) && <Icon name="check" />}</span>
              <span className="ui-tree-label">
                {path.length > 1 && <span className="ui-tree-trail">{path.slice(0, -1).map((p) => p.label).join(' › ')} › </span>}
                {path[path.length - 1]?.label}
              </span>
            </div>
          );
        })}

        {(shownExtras.length > 0 || shownRecent.length > 0) && rows.length > 0 && <div className="ui-tree-gap" role="presentation" />}

        {rows.map((row) => {
          const key = `t:${row.node.id}`;
          const pickable = row.node.selectable !== false;
          const hidden = (tree.offered.get(row.node.id) ?? 0) - (pickable ? 1 : 0);
          return (
            <div key={key} role="none">
              <div
                id={optionId(key)} data-key={key} role="treeitem"
                aria-level={row.depth + 1}
                aria-expanded={row.hasChildren ? row.open : undefined}
                aria-selected={pickable ? isOn(row.node.id) : undefined}
                aria-disabled={!pickable || undefined}
                className={`ui-tree-row${isOn(row.node.id) ? ' is-on' : ''}${activeKey === key ? ' is-active' : ''}${pickable ? '' : ' is-way'}`}
                onMouseEnter={() => setActive(key)}
                onClick={() => (pickable ? onPick(row.node.id) : toggle(row.node.id))}
              >
                <span className="ui-tree-rails" aria-hidden="true">
                  {row.rails.map((more, i) => <span key={i} className={`ui-tree-rail${more ? ' is-line' : ''}`} />)}
                  {row.depth > 0 && <span className={`ui-tree-rail is-joint${row.last ? ' is-last' : ''}`} />}
                </span>
                {row.hasChildren && query.trim() === '' ? (
                  <button
                    type="button" tabIndex={-1} className={`ui-tree-twist${row.open ? ' is-open' : ''}`}
                    aria-label={row.open ? `Zwiń: ${row.node.label}` : `Rozwiń: ${row.node.label}`}
                    onClick={(e) => { e.stopPropagation(); toggle(row.node.id); }}
                  ><Icon name="next" /></button>
                ) : <span className="ui-tree-twist is-leaf" aria-hidden="true" />}
                <span className="ui-tree-mark" aria-hidden="true">
                  {pickable && (multiple ? <span className={`ui-tree-box${isOn(row.node.id) ? ' is-on' : ''}`}>{isOn(row.node.id) && <Icon name="check" />}</span> : isOn(row.node.id) && <Icon name="check" />)}
                </span>
                <span className="ui-tree-label">
                  {mark(row.node.label)}
                  {row.node.note != null && row.node.note !== '' && <small className="ui-tree-note">{row.node.note}</small>}
                </span>
                {row.hasChildren && !row.open && hidden > 0 && <span className="ui-tree-count" title={`${hidden} w środku`}>{hidden}</span>}
              </div>
            </div>
          );
        })}

        {rows.length === 0 && shownExtras.length === 0 && shownRecent.length === 0 && (
          <p className="ui-tree-empty">{q === '' ? emptyText : 'Nic nie pasuje.'}</p>
        )}
      </div>
    </div>
  );
}

/* -- Ein Wert, in einem Feld ------------------------------------------------------------ */

export function TreePick({ nodes, value, onChange, extras = [], recent, placeholder = '— wybierz —', label, disabled = false, emptyText, className, id }: {
  nodes: readonly TreeNode[];
  value: string;
  onChange: (value: string) => void;
  extras?: readonly TreeExtra[];
  recent?: readonly string[];
  placeholder?: string;
  /** Wie die Wahl heisst — vorgelesen, und über der Suche. */
  label: string;
  disabled?: boolean;
  emptyText?: string;
  className?: string;
  id?: string;
}) {
  const [shown, setShown] = useState<DOMRect | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);

  const extra = extras.find((e) => e.value === value);
  const path = extra === undefined && value !== '' ? pathOf(nodes, value) : [];

  const close = (refocus = true) => {
    setShown(null);
    if (refocus) button.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        className={`ui-pick${className === undefined ? '' : ` ${className}`}`}
        disabled={disabled}
        aria-haspopup="tree"
        aria-expanded={shown !== null}
        title={path.length > 0 ? path.map((p) => p.label).join(' › ') : undefined}
        onClick={(e) => setShown((was) => (was === null ? e.currentTarget.getBoundingClientRect() : null))}
        onKeyDown={(e) => {
          if (shown === null && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setShown(e.currentTarget.getBoundingClientRect());
          }
        }}
      >
        <span className="ui-pick-value">
          {extra !== undefined ? extra.label
            : path.length === 0 ? <span className="ui-pick-placeholder">{value === '' ? placeholder : 'inny obszar'}</span>
            : (
              <>
                {path.length > 1 && (
                  <span className="ui-pick-trail">
                    {(path.length > 3 ? [path[0].label, '…', path[path.length - 2].label] : path.slice(0, -1).map((p) => p.label)).join(' › ')} ›{' '}
                  </span>
                )}
                <span className="ui-pick-name">{path[path.length - 1].label}</span>
              </>
            )}
        </span>
        <Icon name="chevron" className="ui-pick-arrow" />
      </button>

      {shown !== null && (
        <TreePop anchor={shown} from={button.current} onClose={close} label={label}>
          <TreeList
            nodes={nodes}
            selected={value === '' && extra === undefined ? [] : [value]}
            extras={extras}
            recent={recent}
            label={label}
            emptyText={emptyText}
            autoFocusSearch
            onClose={() => close()}
            onPick={(picked) => { onChange(picked); close(); }}
          />
        </TreePop>
      )}
    </>
  );
}

/** Das Fenster an der Auswahl — darunter (oder darüber, wenn unten kein Platz ist); auf dem Telefon von unten. */
function TreePop({ anchor, from, onClose, label, children }: { anchor: DOMRect; from: Element | null; onClose: (refocus?: boolean) => void; label: string; children: ReactNode }) {
  const host = usePortal();
  const box = useRef<HTMLDivElement | null>(null);
  const [spot, setSpot] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number } | null>(null);
  const sheet = typeof window !== 'undefined' && window.innerWidth < 600;

  /*
     Nach dem Einhängen gemessen (usePortal hängt im Effekt davor ein) — bis dahin unsichtbar.
     Darüber steht es mit seiner UNTERKANTE an der Auswahl: klappt darin ein Ordner auf, wächst es nach oben, nicht über das Feld.
  */
  useEffect(() => {
    if (sheet) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const m = 8;
    const width = Math.min(Math.max(anchor.width, 320), vw - 2 * m);
    const below = vh - anchor.bottom - m - 4;
    const above = anchor.top - m - 4;
    const up = below < 280 && above > below;
    setSpot({
      left: Math.max(m, Math.min(anchor.left, vw - width - m)),
      ...(up ? { bottom: vh - anchor.top + 4 } : { top: anchor.bottom + 4 }),
      width,
      maxHeight: Math.min(440, up ? above : below)
    });
  }, [anchor, sheet]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      const target = e.target as Node;
      if (box.current?.contains(target) || from?.contains(target)) return;
      onClose(false);
    };
    const wide = window.innerWidth;
    const resized = () => { if (window.innerWidth !== wide) onClose(false); };
    document.addEventListener('pointerdown', down, true);
    window.addEventListener('resize', resized);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      window.removeEventListener('resize', resized);
    };
  }, [from, onClose]);

  if (host === null) return null;

  if (sheet) {
    return createPortal(
      <div className="ui-pick-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div ref={box} className="ui-pick-pop is-sheet" role="dialog" aria-modal="true" aria-label={label}>
          <div className="ui-pick-sheet-head">
            <strong>{label}</strong>
            <button type="button" className="wk-modal-x" aria-label="Zamknij" onClick={() => onClose()}>×</button>
          </div>
          {children}
        </div>
      </div>,
      host
    );
  }

  return createPortal(
    <div
      ref={box}
      className="ui-pick-pop"
      role="dialog"
      aria-label={label}
      style={{ left: spot?.left ?? 0, top: spot === null ? 0 : spot.top, bottom: spot?.bottom, width: spot?.width, maxHeight: spot?.maxHeight, visibility: spot === null ? 'hidden' : 'visible' }}
    >
      {children}
    </div>,
    host
  );
}

export default TreePick;
