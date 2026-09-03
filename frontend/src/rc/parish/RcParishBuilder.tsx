/**
 * Der Bausteineditor der Pfarr-Startseite — übernommen aus
 * `pages/parish/ParishPage.tsx`.
 *
 * <b>Was er kann:</b> Bausteine aus einer Palette ins Raster ziehen, dort
 * verschieben, in der Breite und Höhe ändern und wieder entfernen — je
 * Bildschirmgrösse eine eigene Anordnung. Die Rechnerei dahinter steht in
 * `rcLayout.ts` und ist geprüft; hier stehen nur die Griffe.
 *
 * <b>Freie Zellen leuchten auf, während gezogen wird.</b> Das ist nicht Zierrat:
 * ohne diese Anzeige zieht man einen Baustein an eine Stelle, an der er nicht
 * hinpasst, und er springt zurück, ohne dass jemand weiss, warum. Mit ihr sieht
 * man vorher, wohin er darf.
 *
 * <b>Die Bildschirmgrösse ist ein Schalter und keine Fenstergrösse.</b> Wer die
 * Telefonansicht einrichten will, soll nicht sein Fenster verkleinern müssen —
 * und die Anordnung für das Telefon soll nicht verlorengehen, weil jemand am
 * Schreibtisch etwas verschoben hat.
 */

import { useCallback, useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import {
  DndContext, PointerSensor, pointerWithin, useDraggable, useDroppable,
  useSensor, useSensors, type DragEndEvent, type DragStartEvent
} from '@dnd-kit/core';

import {
  RC_BREAKPOINTS, RC_COLUMNS, RC_MAX_ROW_SPAN, RC_MIN_COL_SPAN, RC_MIN_ROW_SPAN,
  rcCanPlace, rcFirstFreeCell, rcFrameFor, rcSnapColSpan, rcSnapRowSpan,
  rcValidCells, rcWithFrame, type RcBreakpoint, type RcFrame, type RcModule
} from './rcLayout';
import { RC_MODULE_CATALOG, rcModuleLabel } from './rcModules';

/** Die Höhe einer Rasterzeile in Pixeln. */
const ROW_H = 84;
const GAP = 8;

const BREAKPOINT_LABELS: Record<RcBreakpoint, string> = {
  desktop: 'Komputer',
  tablet: 'Tablet',
  mobile: 'Telefon'
};

export function RcParishBuilder({
  modules, onChange
}: {
  modules: readonly RcModule[];
  onChange: (next: readonly RcModule[]) => void;
}) {
  const [breakpoint, setBreakpoint] = useState<RcBreakpoint>('desktop');
  const [selected, setSelected] = useState<string | null>(null);

  /** Was gerade gezogen wird — und welche Zellen es aufnehmen könnten. */
  const [drag, setDrag] = useState<{
    id: string;
    size: { colSpan: number; rowSpan: number };
    valid: Set<string>;
    rows: number;
  } | null>(null);

  const columns = RC_COLUMNS[breakpoint];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  /*
   * Wie viele Zeilen gezeichnet werden.
   *
   * Beim Ziehen bestimmt es die Rechnerei (sie legt Platz nach unten frei);
   * sonst reicht das Belegte plus zwei Zeilen Luft. Ein Raster ohne Luft
   * darunter hat keine Stelle, an die man etwas Neues ziehen könnte.
   */
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

    if (id.startsWith('palette:')) {
      const type = id.slice('palette:'.length);
      const def = RC_MODULE_CATALOG.find((m) => m.type === type);
      const size = {
        colSpan: rcSnapColSpan(def?.colSpan ?? RC_MIN_COL_SPAN, columns),
        rowSpan: rcSnapRowSpan(def?.rowSpan ?? RC_MIN_ROW_SPAN)
      };
      const { valid, rows: r } = rcValidCells(modules, size, columns, breakpoint);
      setDrag({ id, size, valid, rows: r });
      return;
    }

    const moduleId = id.slice('item:'.length);
    const module = modules.find((m) => m.id === moduleId);
    if (!module) return;

    const frame = rcFrameFor(module, breakpoint);
    // Der bewegte Baustein steht sich selbst nicht im Weg.
    const { valid, rows: r } = rcValidCells(modules, frame.size, columns, breakpoint, moduleId);
    setDrag({ id, size: frame.size, valid, rows: r });
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
       * auf einem anderen — sichtbar erst, wenn jemand das Fenster verkleinert.
       */
      const layouts: Partial<Record<RcBreakpoint, RcFrame>> = {};
      for (const bp of RC_BREAKPOINTS) {
        const cols = RC_COLUMNS[bp];
        const fitted = {
          colSpan: rcSnapColSpan(size.colSpan, cols),
          rowSpan: rcSnapRowSpan(size.rowSpan)
        };
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

  const resize = useCallback((moduleId: string, by: { cols?: number; rows?: number }) => {
    const module = modules.find((m) => m.id === moduleId);
    if (!module) return;

    const frame = rcFrameFor(module, breakpoint);
    const next = {
      position: frame.position,
      size: {
        colSpan: rcSnapColSpan(frame.size.colSpan + (by.cols ?? 0), columns),
        rowSpan: rcSnapRowSpan(Math.min(RC_MAX_ROW_SPAN, Math.max(1, frame.size.rowSpan + (by.rows ?? 0))))
      }
    };

    // Eine Grösse, die nicht passt, wird nicht gesetzt — sonst überlappte der
    // Baustein den Nachbarn, und beides sähe kaputt aus.
    if (!rcCanPlace(modules, next, columns, breakpoint, moduleId)) return;
    onChange(modules.map((m) => (m.id === moduleId ? rcWithFrame(m, breakpoint, next) : m)));
  }, [modules, columns, breakpoint, onChange]);

  const remove = useCallback((moduleId: string) => {
    onChange(modules.filter((m) => m.id !== moduleId));
    setSelected((s) => (s === moduleId ? null : s));
  }, [modules, onChange]);

  return (
    <div className="pb">
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

        <p className="pb-hint">
          Przeciągnij moduł z listy na siatkę. Każdy rozmiar ekranu ma własny układ.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragCancel={() => setDrag(null)}
        onDragEnd={onDragEnd}
      >
        <div className="pb-palette">
          {RC_MODULE_CATALOG.map((m) => (
            <Pill key={m.type} type={m.type} label={m.label} />
          ))}
        </div>

        <div
          className={`pb-grid${drag !== null ? ' is-dragging' : ''}`}
          style={{
            '--pb-cols': columns,
            '--pb-row-h': `${ROW_H}px`,
            '--pb-gap': `${GAP}px`
          } as CSSProperties}
        >
          {/* Die Zellen liegen UNTER den Bausteinen: sie sind das Ziel, nicht
              der Inhalt. Ein Baustein darüber verdeckt sie, und das ist richtig
              so — dorthin kann nichts fallen. */}
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
              onResize={(by) => resize(module.id, by)}
              onRemove={() => remove(module.id)}
            />
          ))}
        </div>
      </DndContext>

      {modules.length === 0 && (
        <p className="pb-empty">
          Strona nie ma jeszcze żadnego modułu. Przeciągnij pierwszy z listy powyżej.
        </p>
      )}
    </div>
  );
}

/* -- Die Palette ----------------------------------------------------------- */

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

/* -- Eine Rasterzelle ------------------------------------------------------ */

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

/* -- Ein Baustein im Raster ------------------------------------------------ */

function Item({
  module, frame, columns, selected, onSelect, onResize, onRemove
}: {
  module: RcModule;
  frame: RcFrame;
  columns: number;
  selected: boolean;
  onSelect: () => void;
  onResize: (by: { cols?: number; rows?: number }) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `item:${module.id}` });
  const colSpan = rcSnapColSpan(frame.size.colSpan, columns);
  const rowSpan = rcSnapRowSpan(frame.size.rowSpan);

  /*
   * Die Griffe zum Ändern der Grösse liegen INNERHALB des Bausteins, der
   * gezogen werden kann. Ohne `stopPropagation` startete jeder Griff zugleich
   * eine Verschiebung — man wollte breiter machen und hätte verschoben.
   */
  const stop = (e: PointerEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <div
      ref={setNodeRef}
      className={`pb-item${selected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}`}
      style={{ gridColumn: `${frame.position.col} / span ${colSpan}`, gridRow: `${frame.position.row} / span ${rowSpan}` }}
      onClick={onSelect}
      {...listeners}
      {...attributes}
    >
      <span className="pb-item-name">{rcModuleLabel(module.type)}</span>
      <span className="pb-item-size">{colSpan}×{rowSpan}</span>

      {selected && (
        <div className="pb-handles" onPointerDown={stop}>
          <button type="button" onPointerDown={stop} onClick={() => onResize({ cols: -1 })} aria-label="Węższy">−</button>
          <button type="button" onPointerDown={stop} onClick={() => onResize({ cols: 1 })} aria-label="Szerszy">+</button>
          <button type="button" onPointerDown={stop} onClick={() => onResize({ rows: -2 })} aria-label="Niższy">↑</button>
          <button type="button" onPointerDown={stop} onClick={() => onResize({ rows: 2 })} aria-label="Wyższy">↓</button>
          <button type="button" className="pb-drop" onPointerDown={stop} onClick={onRemove} aria-label="Usuń">×</button>
        </div>
      )}
    </div>
  );
}

/** Eine Kennung, die auch ohne `crypto.randomUUID` eindeutig genug ist. */
const newId = (type: string): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default RcParishBuilder;
