/**
 * Der Editor der Pfarrseite — drei Karten, ein Dokument.
 *
 * <code>
 *   Układ   was auf der Startseite steht und wie gross
 *   Menu    welche Unterseiten es gibt und wie sie hängen
 *   Treść   die Angaben, die diese Auswahl braucht
 * </code>
 *
 * <b>Die dritte Karte folgt aus den ersten beiden.</b> Wer „Kancelaria" ins
 * Menü nimmt oder „Godziny" auf die Startseite legt, braucht Öffnungszeiten —
 * und bekommt genau dieses Feld, nicht eine Liste von vierzig. Was gebraucht
 * wird, rechnet `rcNeededFields` aus.
 *
 * <b>Jede Bildschirmgrösse hat ihre eigene Breite</b>, nicht nur weniger
 * Spalten. Wer die Telefonansicht einrichtet, soll sehen, wie schmal es dort
 * wirklich ist — sechs Spalten auf einem breiten Fenster „mit weniger Spalten"
 * zu zeigen, verschweigt genau das Problem, das man lösen will.
 */

import {
  useCallback, useMemo, useRef, useState,
  type CSSProperties, type PointerEvent as ReactPointerEvent
} from 'react';
import {
  DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent
} from '@dnd-kit/core';

import {
  RC_BREAKPOINTS, RC_COLUMNS, RC_MIN_COL_SPAN, RC_MIN_ROW_SPAN,
  rcCanPlace, rcCellWidth, rcFirstFreeCell, rcFrameFor, rcGrabOffset, rcPixelSize,
  rcSnapColSpan, rcSnapRowSpan, rcValidCells, rcWithFrame,
  type RcBreakpoint, type RcFrame, type RcModule
} from './rcLayout';
import { rcCells, rcResized, type RcHandle } from './rcResize';
import { RC_MODULE_CATALOG, rcModuleLabel } from './rcModules';
import {
  RC_PAGES, rcMenuPages, rcMissingCount, rcNeededFields, rcPage,
  type RcMenuNode, type RcSite
} from './rcSite';

const ROW_H = 84;
const GAP = 8;

/**
 * Wie breit die Zeichenfläche je Bildschirmgrösse ist.
 *
 * Die Zahlen sind die üblichen Gerätebreiten und keine gewählten: ein Telefon
 * ist rund 390 Punkte breit, ein Tablet rund 820. Wer für das Telefon
 * einrichtet, arbeitet dann in derselben Enge wie der Leser.
 */
const CANVAS_W: Record<RcBreakpoint, number | null> = {
  desktop: null,
  tablet: 820,
  mobile: 390
};

const BREAKPOINT_LABELS: Record<RcBreakpoint, string> = {
  desktop: 'Komputer',
  tablet: 'Tablet',
  mobile: 'Telefon'
};

const HANDLES: readonly RcHandle[] = [
  'top-left', 'top', 'top-right',
  'left', 'right',
  'bottom-left', 'bottom', 'bottom-right'
];

type Tab = 'layout' | 'menu' | 'content';

export function RcParishBuilder({
  site, onChange
}: {
  site: RcSite;
  onChange: (next: RcSite) => void;
}) {
  const [tab, setTab] = useState<Tab>('layout');
  const missing = rcMissingCount(site);

  return (
    <div className="pb">
      <div className="pb-tabs" role="tablist">
        <Tabs tab={tab} onTab={setTab} missing={missing} />
      </div>

      {tab === 'layout' && (
        <LayoutTab
          modules={site.modules}
          onChange={(modules) => onChange({ ...site, modules })}
        />
      )}

      {tab === 'menu' && (
        <MenuTab menu={site.menu} onChange={(menu) => onChange({ ...site, menu })} />
      )}

      {tab === 'content' && (
        <ContentTab
          site={site}
          onChange={(content) => onChange({ ...site, content })}
        />
      )}
    </div>
  );
}

function Tabs({ tab, onTab, missing }: { tab: Tab; onTab: (t: Tab) => void; missing: number }) {
  const items: readonly { id: Tab; label: string }[] = [
    { id: 'layout', label: 'Układ' },
    { id: 'menu', label: 'Menu' },
    { id: 'content', label: 'Treść' }
  ];

  return (
    <>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          className={`pb-tab${tab === item.id ? ' is-active' : ''}`}
          onClick={() => onTab(item.id)}
        >
          {item.label}
          {/* Wie viel noch fehlt, steht an der Karte — sonst findet es niemand,
              weil man dort nur nachsieht, wenn man es schon weiss. */}
          {item.id === 'content' && missing > 0 && <span className="pb-badge">{missing}</span>}
        </button>
      ))}
    </>
  );
}

/* ==========================================================================
   Karte 1: der Aufbau der Startseite
   ========================================================================== */

function LayoutTab({
  modules, onChange
}: {
  modules: readonly RcModule[];
  onChange: (next: readonly RcModule[]) => void;
}) {
  const [breakpoint, setBreakpoint] = useState<RcBreakpoint>('desktop');
  const [selected, setSelected] = useState<string | null>(null);

  /*
   * Was gezogen wird — samt Beschriftung und Rastergroesse, damit die
   * Vorschau in der WIRKLICHEN Groesse erscheint.
   *
   * Ohne das zog man aus der Palette eine kleine Pille, waehrend am Ziel ein
   * Baustein ueber vier mal fuenf Zellen landete. Man sah nicht, was man legt,
   * und musste es ablegen, um es zu erfahren.
   */
  const [drag, setDrag] = useState<{
    valid: Set<string>;
    rows: number;
    label: string;
    size: { colSpan: number; rowSpan: number };
    /** Wo der Zeiger im angefassten Ding sass — siehe `rcGrabOffset`. */
    grab: { x: number; y: number };
  } | null>(null);

  /** Wie breit eine Rasterspalte gerade wirklich ist — gemessen, nicht geraten. */
  const [cellWidth, setCellWidth] = useState(0);

  const grid = useRef<HTMLDivElement>(null);
  const columns = RC_COLUMNS[breakpoint];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const rows = useMemo(() => {
    if (drag !== null) return drag.rows;
    const deepest = modules.reduce((max, m) => {
      const f = rcFrameFor(m, breakpoint);
      return Math.max(max, f.position.row + rcSnapRowSpan(f.size.rowSpan) - 1);
    }, 0);
    return Math.max(4, deepest + 2);
  }, [modules, breakpoint, drag]);

  const onDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);

    // Die Spaltenbreite haengt an der wirklichen Breite der Flaeche, und die
    // aendert sich mit dem Fenster. Deshalb bei jedem Zug neu gemessen.
    const box = grid.current;
    if (box) setCellWidth(rcCellWidth(box.clientWidth, columns, GAP));

    /*
     * WO DER ZEIGER SASS.
     *
     * Die Zeichenschicht setzt die Vorschau an die linke obere Ecke des
     * angefassten Dings; der Baustein landet aber in der Zelle UNTER DEM
     * ZEIGER. Fasst man unten rechts an, liegen beide weit auseinander.
     *
     * Faellt der Versatz nicht zu ermitteln — ein Zug ohne Zeiger, etwa ueber
     * die Tastatur —, bleibt er null. Dann sitzt die Vorschau wie bisher, und
     * das ist fuer einen Tastaturzug auch richtig.
     */
    const activator = event.activatorEvent as Partial<PointerEvent> | undefined;
    const start = event.active.rect.current.initial;

    const grab = activator?.clientX !== undefined && activator.clientY !== undefined && start
      ? rcGrabOffset({ x: activator.clientX, y: activator.clientY }, start)
      : { x: 0, y: 0 };

    if (id.startsWith('palette:')) {
      const type = id.slice('palette:'.length);
      const def = RC_MODULE_CATALOG.find((m) => m.type === type);
      const size = {
        colSpan: rcSnapColSpan(def?.colSpan ?? RC_MIN_COL_SPAN, columns),
        rowSpan: rcSnapRowSpan(def?.rowSpan ?? RC_MIN_ROW_SPAN)
      };
      setDrag({ ...rcValidCells(modules, size, columns, breakpoint), label: rcModuleLabel(type), size, grab });
      return;
    }

    const moduleId = id.slice('item:'.length);
    const module = modules.find((m) => m.id === moduleId);
    if (!module) return;

    const size = rcFrameFor(module, breakpoint).size;
    // Der bewegte Baustein steht sich selbst nicht im Weg.
    setDrag({
      ...rcValidCells(modules, size, columns, breakpoint, moduleId),
      label: rcModuleLabel(module.type),
      size,
      grab
    });
    setSelected(moduleId);
  }, [modules, columns, breakpoint]);

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const active = String(event.active.id);
    const over = event.over === null ? null : String(event.over.id);
    setDrag(null);

    if (over === null || !over.startsWith('cell:')) return;

    const [, rowText, colText] = over.split(':');
    const position = { row: Number(rowText), col: Number(colText) };

    if (active.startsWith('palette:')) {
      const type = active.slice('palette:'.length);
      const def = RC_MODULE_CATALOG.find((m) => m.type === type);
      const size = {
        colSpan: rcSnapColSpan(def?.colSpan ?? RC_MIN_COL_SPAN, columns),
        rowSpan: rcSnapRowSpan(def?.rowSpan ?? RC_MIN_ROW_SPAN)
      };
      if (!rcCanPlace(modules, { position, size }, columns, breakpoint)) return;

      /*
       * Ein neuer Baustein bekommt eine Anordnung für JEDE Bildschirmgrösse.
       * Fehlte eine, fiele er dort auf die Vorgabe zurück und läge womöglich
       * auf einem anderen — sichtbar erst, wenn jemand die Ansicht wechselt.
       */
      const layouts: Partial<Record<RcBreakpoint, RcFrame>> = {};
      for (const bp of RC_BREAKPOINTS) {
        const cols = RC_COLUMNS[bp];
        const fitted = { colSpan: rcSnapColSpan(size.colSpan, cols), rowSpan: rcSnapRowSpan(size.rowSpan) };
        layouts[bp] = bp === breakpoint
          ? { position, size: fitted }
          : { position: rcFirstFreeCell(modules, fitted, cols, bp), size: fitted };
      }

      const made: RcModule = { id: newId(type), type, layouts };
      onChange([...modules, made]);
      setSelected(made.id);
      return;
    }

    const moduleId = active.slice('item:'.length);
    const module = modules.find((m) => m.id === moduleId);
    if (!module) return;

    const frame = rcFrameFor(module, breakpoint);
    if (!rcCanPlace(modules, { position, size: frame.size }, columns, breakpoint, moduleId)) return;

    onChange(modules.map((m) =>
      m.id === moduleId ? rcWithFrame(m, breakpoint, { position, size: frame.size }) : m));
  }, [modules, columns, breakpoint, onChange]);

  /*
   * DAS ZIEHEN AN EINER KANTE.
   *
   * Es läuft an dnd-kit VORBEI und direkt über Zeigerereignisse: dnd-kit
   * verschiebt Dinge, es ändert keine Grössen, und beides in einem Griff zu
   * mischen führt dazu, dass jeder Zug an einer Kante zugleich eine
   * Verschiebung auslöst.
   *
   * `setPointerCapture` hält den Zeiger am Griff fest — sonst reisst der Zug
   * ab, sobald man den Baustein verlässt, und das passiert bei jedem
   * Vergrössern sofort.
   */
  const startResize = useCallback((
    moduleId: string,
    handle: RcHandle,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const module = modules.find((m) => m.id === moduleId);
    const box = grid.current;
    if (!module || !box) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const startFrame = rcFrameFor(module, breakpoint);

    // Die Zellbreite wird gemessen und nicht angenommen: sie hängt an der
    // wirklichen Breite der Zeichenfläche, die sich mit dem Fenster ändert.
    // Dieselbe Rechnung wie fuer die Vorschau, und aus derselben Quelle:
    // zweimal von Hand geschrieben laufen sie irgendwann auseinander, und
    // dann zieht die Kante anders, als die Vorschau angezeigt hat.
    const cellW = rcCellWidth(box.clientWidth, columns, GAP);
    const cellH = ROW_H + GAP;

    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    let latest = startFrame;

    const move = (e: PointerEvent) => {
      const next = rcResized(
        startFrame, handle,
        rcCells(e.clientX - startX, cellW),
        rcCells(e.clientY - startY, cellH),
        columns
      );
      if (next === null) return;
      if (!rcCanPlace(modules, next, columns, breakpoint, moduleId)) return;

      latest = next;
      onChange(modules.map((m) => (m.id === moduleId ? rcWithFrame(m, breakpoint, next) : m)));
    };

    const stop = () => {
      target.releasePointerCapture(event.pointerId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      void latest;
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }, [modules, columns, breakpoint, onChange]);

  const remove = useCallback((moduleId: string) => {
    onChange(modules.filter((m) => m.id !== moduleId));
    setSelected((s) => (s === moduleId ? null : s));
  }, [modules, onChange]);

  const width = CANVAS_W[breakpoint];

  return (
    <>
      <div className="pb-bar">
        <div className="pb-views" role="group" aria-label="Rozmiar ekranu">
          {RC_BREAKPOINTS.map((bp) => (
            <button
              key={bp}
              type="button"
              className={`pb-view${breakpoint === bp ? ' is-active' : ''}`}
              aria-pressed={breakpoint === bp}
              onClick={() => setBreakpoint(bp)}
            >
              {BREAKPOINT_LABELS[bp]}
              <span className="pb-view-cols">{RC_COLUMNS[bp]}</span>
            </button>
          ))}
        </div>
        <p className="pb-hint">Przeciągnij moduł na siatkę. Krawędzie zaznaczonego modułu zmieniają rozmiar.</p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragCancel={() => setDrag(null)}
        onDragEnd={onDragEnd}
      >
        <div className="pb-palette">
          {RC_MODULE_CATALOG.map((m) => <Pill key={m.type} type={m.type} label={m.label} />)}
        </div>

        {/* Die Zeichenfläche wird schmaler, nicht nur spaltenärmer. */}
        <div className="pb-canvas" style={width === null ? undefined : { maxWidth: `${width}px` }}>
          <div
            ref={grid}
            className={`pb-grid${drag !== null ? ' is-dragging' : ''}`}
            style={{
              '--pb-cols': columns,
              '--pb-row-h': `${ROW_H}px`,
              '--pb-gap': `${GAP}px`
            } as CSSProperties}
          >
            {Array.from({ length: rows }).flatMap((_, r) =>
              Array.from({ length: columns }).map((__, c) => (
                <Cell
                  key={`${r + 1}:${c + 1}`}
                  row={r + 1}
                  col={c + 1}
                  open={drag?.valid.has(`${r + 1}:${c + 1}`) ?? false}
                  active={drag !== null}
                />
              ))
            )}

            {modules.map((module) => (
              <Item
                key={module.id}
                module={module}
                frame={rcFrameFor(module, breakpoint)}
                columns={columns}
                selected={selected === module.id}
                onSelect={() => setSelected(module.id)}
                onResizeStart={(handle, e) => startResize(module.id, handle, e)}
                onRemove={() => remove(module.id)}
              />
            ))}
          </div>
        </div>

        {/*
          DIE VORSCHAU IN DER WIRKLICHEN GROESSE.

          `dropAnimation={null}`: der Baustein liegt nach dem Ablegen schon an
          seinem Platz im Raster. Eine Rueckflugbewegung zoege die Vorschau
          danach noch einmal quer ueber den Bildschirm zu einer Stelle, an der
          nichts mehr ist.
        */}
        <DragOverlay dropAnimation={null}>
          {drag !== null && (
            <div className="pb-ghost" style={ghostStyle(drag.size, cellWidth, drag.grab)}>
              <span className="pb-item-name">{drag.label}</span>
              <span className="pb-item-size">{drag.size.colSpan}×{drag.size.rowSpan}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {modules.length === 0 && (
        <p className="pb-empty">Strona nie ma jeszcze modułu. Przeciągnij pierwszy z listy powyżej.</p>
      )}
    </>
  );
}

/**
 * Die Groesse der Vorschau in Pixeln.
 *
 * Solange noch nichts gemessen wurde (`cellWidth === 0`), bleibt die Breite
 * offen: ein Kasten mit der Breite 0 waere unsichtbar, und dann saehe es aus,
 * als sei das Ziehen kaputt.
 */
function ghostStyle(
  size: { colSpan: number; rowSpan: number },
  cellWidth: number,
  grab: { x: number; y: number }
): CSSProperties {
  // Der Versatz gilt auch ohne Mass: die Vorschau soll unter dem Zeiger
  // sitzen, selbst wenn ihre Groesse noch nicht feststeht.
  const shift = `translate(${grab.x}px, ${grab.y}px)`;

  if (cellWidth <= 0) return { transform: shift };

  const { width, height } = rcPixelSize(size, cellWidth, ROW_H, GAP);
  return { width: `${width}px`, height: `${height}px`, transform: shift };
}

function Pill({ type, label }: { type: string; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${type}` });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`pb-pill${isDragging ? ' is-dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      {label}
    </button>
  );
}

function Cell({ row, col, open, active }: { row: number; col: number; open: boolean; active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${row}:${col}` });
  return (
    <div
      ref={setNodeRef}
      className={`pb-cell${active ? ' is-live' : ''}${open ? ' is-open' : ''}${isOver && open ? ' is-over' : ''}`}
      style={{ gridColumn: col, gridRow: row }}
    />
  );
}

function Item({
  module, frame, columns, selected, onSelect, onResizeStart, onRemove
}: {
  module: RcModule;
  frame: RcFrame;
  columns: number;
  selected: boolean;
  onSelect: () => void;
  onResizeStart: (handle: RcHandle, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `item:${module.id}` });
  const colSpan = rcSnapColSpan(frame.size.colSpan, columns);
  const rowSpan = rcSnapRowSpan(frame.size.rowSpan);

  return (
    <div
      ref={setNodeRef}
      className={`pb-item${selected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}`}
      style={{
        gridColumn: `${frame.position.col} / span ${colSpan}`,
        gridRow: `${frame.position.row} / span ${rowSpan}`
      }}
      onClick={onSelect}
      {...listeners}
      {...attributes}
    >
      <span className="pb-item-name">{rcModuleLabel(module.type)}</span>
      <span className="pb-item-size">{colSpan}×{rowSpan}</span>

      {selected && (
        <>
          {HANDLES.map((handle) => (
            <button
              key={handle}
              type="button"
              className={`pb-handle pb-handle-${handle}`}
              aria-label={`Zmień rozmiar: ${handle}`}
              onPointerDown={(e) => onResizeStart(handle, e)}
              onClick={(e) => e.stopPropagation()}
            />
          ))}

          <button
            type="button"
            className="pb-drop"
            aria-label="Usuń moduł"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}

/* ==========================================================================
   Karte 2: das Menü
   ========================================================================== */

/**
 * Das Menü wird aus VORHANDENEN Seiten gebaut.
 *
 * Kein freies Tippen von Adressen: ein Menüpunkt, der auf eine Seite zeigt, die
 * es nicht gibt, ist ein Verweis ins Leere — und man merkt es erst, wenn ein
 * Besucher darauf klickt. Was hier angeboten wird, existiert.
 */
function MenuTab({
  menu, onChange
}: {
  menu: readonly RcMenuNode[];
  onChange: (next: readonly RcMenuNode[]) => void;
}) {
  const used = new Set(rcMenuPages(menu));
  const groups = [...new Set(RC_PAGES.map((p) => p.group))];

  const addPage = (pageId: string, into: number | null) => {
    const page = rcPage(pageId);
    if (!page) return;

    if (into === null) {
      onChange([...menu, { label: page.label, pageId }]);
      return;
    }

    onChange(menu.map((node, i) => {
      if (i !== into) return node;
      const children = [...(node.children ?? []), { label: page.label, pageId }];
      // Ein Punkt mit Kindern zeigt selbst auf nichts mehr — sonst wäre unklar,
      // was ein Klick darauf tut.
      return { label: node.label, children };
    }));
  };

  const addGroup = () => onChange([...menu, { label: 'Nowa grupa', children: [] }]);

  const rename = (at: number, label: string) =>
    onChange(menu.map((n, i) => (i === at ? { ...n, label } : n)));

  const move = (at: number, by: -1 | 1) => {
    const to = at + by;
    if (to < 0 || to >= menu.length) return;
    const next = [...menu];
    [next[at], next[to]] = [next[to], next[at]];
    onChange(next);
  };

  const drop = (at: number) => onChange(menu.filter((_, i) => i !== at));

  const dropChild = (at: number, childAt: number) =>
    onChange(menu.map((n, i) =>
      i === at ? { ...n, children: (n.children ?? []).filter((_, j) => j !== childAt) } : n));

  return (
    <div className="pb-menu">
      <div className="pb-menu-tree">
        <h4 className="pb-h">Menu strony</h4>

        {menu.length === 0 && <p className="pb-empty">Menu jest puste. Dodaj stronę z listy obok.</p>}

        <ol className="pb-nodes">
          {menu.map((node, i) => (
            <li key={`${node.label}-${i}`} className="pb-node">
              <div className="pb-node-head">
                <input
                  type="text"
                  value={node.label}
                  aria-label="Nazwa w menu"
                  onChange={(e) => rename(i, e.target.value)}
                />
                <span className="pb-node-kind">
                  {node.children !== undefined ? 'grupa' : (rcPage(node.pageId ?? '')?.label ?? '—')}
                </span>
                <button type="button" onClick={() => move(i, -1)} aria-label="W górę" disabled={i === 0}>↑</button>
                <button type="button" onClick={() => move(i, 1)} aria-label="W dół" disabled={i === menu.length - 1}>↓</button>
                <button type="button" className="pb-drop-flat" onClick={() => drop(i)} aria-label="Usuń">×</button>
              </div>

              {node.children !== undefined && (
                <ul className="pb-children">
                  {node.children.map((child, j) => (
                    <li key={`${child.pageId}-${j}`}>
                      <span>{child.label}</span>
                      <button type="button" className="pb-drop-flat" onClick={() => dropChild(i, j)} aria-label="Usuń">×</button>
                    </li>
                  ))}
                  {node.children.length === 0 && <li className="pb-muted">Pusta grupa — dodaj stronę obok.</li>}
                </ul>
              )}
            </li>
          ))}
        </ol>

        <button type="button" className="pb-add-group" onClick={addGroup}>+ Grupa</button>
      </div>

      <div className="pb-menu-pages">
        <h4 className="pb-h">Dostępne strony</h4>

        {groups.map((group) => (
          <div key={group} className="pb-page-group">
            <span className="pb-page-group-name">{group}</span>
            {RC_PAGES.filter((p) => p.group === group).map((page) => (
              <div key={page.id} className={`pb-page${used.has(page.id) ? ' is-used' : ''}`}>
                <span>{page.label}</span>

                <button type="button" onClick={() => addPage(page.id, null)}>
                  Do menu
                </button>

                {/* In eine Gruppe, wenn es eine gibt. */}
                {menu.some((n) => n.children !== undefined) && (
                  <select
                    aria-label={`Dodaj „${page.label}" do grupy`}
                    value=""
                    onChange={(e) => {
                      const at = Number(e.target.value);
                      if (!Number.isNaN(at)) addPage(page.id, at);
                      e.currentTarget.value = '';
                    }}
                  >
                    <option value="">do grupy…</option>
                    {menu.map((n, i) => n.children !== undefined
                      ? <option key={i} value={i}>{n.label}</option>
                      : null)}
                  </select>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   Karte 3: die Angaben, die daraus folgen
   ========================================================================== */

function ContentTab({
  site, onChange
}: {
  site: RcSite;
  onChange: (next: Record<string, string>) => void;
}) {
  const needed = rcNeededFields(site);

  const set = (key: string, value: string) =>
    onChange({ ...site.content, [key]: value });

  if (needed.length === 0) {
    return (
      <p className="pb-empty">
        Nic tu jeszcze nie trzeba wypełniać. Dodaj strony do menu albo moduły na
        stronę główną — pola pojawią się same.
      </p>
    );
  }

  return (
    <div className="pb-content">
      <p className="pb-hint">
        Te pola wynikają z wybranych stron i modułów. Nie ma tu nic, czego twoja
        strona nie pokazuje.
      </p>

      {needed.map(({ page, fields }) => (
        <section className="pb-fieldset" key={page.id}>
          <h4 className="pb-h">{page.label}</h4>

          {fields.map((field) => {
            const value = site.content[field.key] ?? '';
            const empty = value.trim() === '';

            return (
              <label className={`pb-field${empty ? ' is-empty' : ''}`} key={field.key}>
                <span className="pb-field-label">
                  {field.label}
                  {empty && <em className="pb-field-todo">do uzupełnienia</em>}
                </span>

                {field.kind === 'line' ? (
                  <input
                    type="text"
                    value={value}
                    placeholder={field.hint}
                    onChange={(e) => set(field.key, e.target.value)}
                  />
                ) : (
                  <textarea
                    rows={field.kind === 'hours' ? 4 : 5}
                    value={value}
                    placeholder={field.hint}
                    onChange={(e) => set(field.key, e.target.value)}
                  />
                )}
              </label>
            );
          })}
        </section>
      ))}
    </div>
  );
}

/** Eine Kennung, die auch ohne `crypto.randomUUID` eindeutig genug ist. */
const newId = (type: string): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default RcParishBuilder;
