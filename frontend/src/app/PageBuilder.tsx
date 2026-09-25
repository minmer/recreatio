/**
 * Der Seiteneditor — Bausteine legen, schieben, in der Grösse ändern.
 *
 * <b>Jede Bildschirmgrösse hat ihre eigene Breite</b>, nicht nur weniger
 * Spalten. Wer die Telefonansicht einrichtet, soll sehen, wie schmal es dort
 * wirklich ist: sechs Spalten auf einem breiten Fenster „mit weniger Spalten"
 * zu zeigen verschweigt genau das Problem, das man lösen will.
 *
 * <b>Das Ziel folgt dem BAUSTEIN, nicht dem Zeiger.</b> Wer einen Baustein an
 * der rechten unteren Ecke anfasst, legt ihn trotzdem dorthin, wo der Baustein
 * liegt — wie ein Blatt Papier. Die eingebaute Zeigerprüfung von dnd-kit fragt
 * nach dem Zeiger; deshalb steht hier eine eigene (`hitAt`).
 *
 * <b>Das Ziehen an einer Kante läuft an dnd-kit vorbei</b>, direkt über
 * Zeigerereignisse: dnd-kit verschiebt Dinge, es ändert keine Grössen, und
 * beides in einem Griff zu mischen löst bei jedem Zug an einer Kante zugleich
 * eine Verschiebung aus.
 */

import {
  useCallback, useMemo, useRef, useState,
  type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode
} from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent
} from '@dnd-kit/core';

import { newId } from './ids';
import {
  BREAKPOINTS, byReadingOrder, canPlace, cellWidth, cells, COLUMNS, firstFreeCell, frameFor, hitAt,
  MIN_COL_SPAN, MIN_ROW_SPAN, pixelSize, resized, snapColSpan, snapRowSpan, validCells, withFrame,
  type Breakpoint, type Frame, type Handle, type Layout
} from './layout';
import { PARTS, partLabel, partOf } from './parts/registry';
import { PickModule } from './PickModule';
import { PickForm, PickQuestions, pickedForm } from './FormPick';
import { PickResource } from './PickResource';
import type { DraftPart } from './page';

const ROW_H = 84;
const GAP = 8;

/** Die üblichen Gerätebreiten, nicht gewählte: ein Telefon ist rund 390 Punkte breit. */
const CANVAS_W: Record<Breakpoint, number | null> = { desktop: null, tablet: 820, mobile: 390 };

const BREAKPOINT_LABEL: Record<Breakpoint, string> = {
  desktop: 'Komputer', tablet: 'Tablet', mobile: 'Telefon'
};

const HANDLES: readonly Handle[] = [
  'top-left', 'top', 'top-right', 'left', 'right', 'bottom-left', 'bottom', 'bottom-right'
];

export function PageBuilder({ parts, onChange: report, busy, onOpenModule }: {
  parts: readonly DraftPart[];
  onChange: (next: readonly DraftPart[]) => void;
  busy: boolean;

  /**
   * Einen Baustein AUFSCHLAGEN — dorthin, wo man seine Fragen stellt.
   *
   * Der Rastereditor weiss nicht, wo das ist; er sagt nur, WELCHEN. Wohin
   * es führt, entscheidet die Seite, die ihn einhängt — sonst müsste er
   * Adressen kennen, und das ist nicht seine Aufgabe.
   *
   * <b>Die Anordnung geht MIT.</b> Wer gerade einen Bogen angelegt hat, hat
   * eine Änderung im Bild, die noch nirgends steht — genau die, die sagt,
   * welchen Baustein diese Stelle zeigt. Sie aus dem Zustand zu lesen wäre
   * ein Wettlauf: React hat ihn noch nicht gesetzt, wenn dieser Aufruf
   * geschieht. Also reicht der Editor sie weiter.
   */
  onOpenModule: (moduleId: string, parts: readonly DraftPart[]) => void;
}) {
  /**
   * JEDE Änderung geht durch die Leserichtung.
   *
   * <b>Die Stelle im Raster ist die Ordnung</b>, und die Liste muss das
   * mitmachen — gespeichert wird die Listenstelle, nicht die Kachelmitte
   * (`slug_part.position`). Hinge die Liste weiter an der Reihenfolge des
   * Hinzufügens, erzählte das Bild eine Anordnung und der Dienst eine andere,
   * sobald jemand einen neuen Baustein ÜBER einen älteren setzt.
   *
   * Hier und nicht an den fünf Aufrufstellen: eine davon würde vergessen, und
   * zwar die, die man am seltensten benutzt.
   */
  const onChange = useCallback(
    (next: readonly DraftPart[]) => report(byReadingOrder(next)),
    [report]);

  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');
  const [selected, setSelected] = useState<string | null>(null);
  const [cell, setCell] = useState(0);

  const [drag, setDrag] = useState<{
    valid: Set<string>;
    rows: number;
    label: string;
    size: { colSpan: number; rowSpan: number };
  } | null>(null);

  const grid = useRef<HTMLDivElement>(null);
  const columns = COLUMNS[breakpoint];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byCorner: CollisionDetection = useCallback(({ droppableContainers, collisionRect }) => {
    const hit = hitAt(
      { x: collisionRect.left, y: collisionRect.top },
      droppableContainers
        .filter((c) => c.rect.current !== null)
        .map((c) => ({ id: String(c.id), rect: c.rect.current! }))
    );

    if (hit === null) return [];
    const found = droppableContainers.find((c) => String(c.id) === hit);
    return found === undefined ? [] : [{ id: found.id }];
  }, []);

  const rows = useMemo(() => {
    if (drag !== null) return drag.rows;

    const deepest = parts.reduce((max, part) => {
      const frame = frameFor(part, breakpoint);
      return Math.max(max, frame.position.row + snapRowSpan(frame.size.rowSpan) - 1);
    }, 0);

    return Math.max(4, deepest + 2);
  }, [parts, breakpoint]);

  const onDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);

    // Die Spaltenbreite hängt an der wirklichen Breite der Fläche, und die
    // ändert sich mit dem Fenster. Deshalb bei jedem Zug neu gemessen.
    const box = grid.current;
    if (box !== null) setCell(cellWidth(box.clientWidth, columns, GAP));

    if (id.startsWith('palette:')) {
      const kind = id.slice('palette:'.length);
      const def = partOf(kind);
      const size = {
        colSpan: snapColSpan(def?.box.colSpan ?? MIN_COL_SPAN, columns),
        rowSpan: snapRowSpan(def?.box.rowSpan ?? MIN_ROW_SPAN)
      };

      setDrag({ ...validCells(parts, size, columns, breakpoint), label: partLabel(kind), size });
      return;
    }

    const partId = id.slice('item:'.length);
    const part = parts.find((p) => p.id === partId);
    if (part === undefined) return;

    const size = frameFor(part, breakpoint).size;

    // Der bewegte Baustein steht sich selbst nicht im Weg.
    setDrag({
      ...validCells(parts, size, columns, breakpoint, partId),
      label: partLabel(part.kind),
      size
    });
    setSelected(partId);
  }, [parts, columns, breakpoint]);

  const onDragEnd = useCallback((event: DragEndEvent) => {
    const active = String(event.active.id);
    const over = event.over === null ? null : String(event.over.id);
    setDrag(null);

    if (over === null || !over.startsWith('cell:')) return;

    const [, rowText, colText] = over.split(':');
    const position = { row: Number(rowText), col: Number(colText) };

    if (active.startsWith('palette:')) {
      const kind = active.slice('palette:'.length);
      const def = partOf(kind);
      const size = {
        colSpan: snapColSpan(def?.box.colSpan ?? MIN_COL_SPAN, columns),
        rowSpan: snapRowSpan(def?.box.rowSpan ?? MIN_ROW_SPAN)
      };

      if (!canPlace(parts, { position, size }, columns, breakpoint)) return;

      /*
       * Ein neuer Baustein bekommt eine Anordnung für JEDE Bildschirmgrösse.
       * Fehlte eine, fiele er dort auf die Vorgabe zurück und läge womöglich
       * auf einem anderen — sichtbar erst, wenn jemand die Ansicht wechselt.
       */
      const layout: Layout = {};
      for (const bp of BREAKPOINTS) {
        const cols = COLUMNS[bp];
        const fitted = { colSpan: snapColSpan(size.colSpan, cols), rowSpan: snapRowSpan(size.rowSpan) };

        layout[bp] = bp === breakpoint
          ? { position, size: fitted }
          : { position: firstFreeCell(parts, fitted, cols, bp), size: fitted };
      }

      const made: DraftPart = { id: newId(), moduleId: null, kind, layout, config: {} };
      onChange([...parts, made]);
      setSelected(made.id);
      return;
    }

    const partId = active.slice('item:'.length);
    const part = parts.find((p) => p.id === partId);
    if (part === undefined) return;

    const frame = frameFor(part, breakpoint);
    if (!canPlace(parts, { position, size: frame.size }, columns, breakpoint, partId)) return;

    onChange(parts.map((p) =>
      p.id === partId ? withFrame(p, breakpoint, { position, size: frame.size }) : p));
  }, [parts, columns, breakpoint, onChange]);

  /**
   * `setPointerCapture` hält den Zeiger am Griff fest — sonst reisst der Zug
   * ab, sobald man den Baustein verlässt, und das geschieht beim Vergrössern
   * sofort.
   */
  const startResize = useCallback((
    partId: string, handle: Handle, event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const part = parts.find((p) => p.id === partId);
    const box = grid.current;
    if (part === undefined || box === null) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const startFrame = frameFor(part, breakpoint);

    // Gemessen, nicht angenommen — dieselbe Rechnung wie für die Vorschau und
    // aus derselben Quelle.
    const cellW = cellWidth(box.clientWidth, columns, GAP);
    const cellH = ROW_H + GAP;

    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    const move = (e: PointerEvent) => {
      const next = resized(
        startFrame, handle,
        cells(e.clientX - startX, cellW),
        cells(e.clientY - startY, cellH),
        columns
      );

      if (next === null) return;
      if (!canPlace(parts, next, columns, breakpoint, partId)) return;

      onChange(parts.map((p) => (p.id === partId ? withFrame(p, breakpoint, next) : p)));
    };

    const stop = () => {
      target.releasePointerCapture(event.pointerId);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }, [parts, columns, breakpoint, onChange]);

  const remove = (partId: string) => {
    onChange(parts.filter((p) => p.id !== partId));
    setSelected((s) => (s === partId ? null : s));
  };

  /* Mehrere Schlüssel auf einmal — ein anderes Formular wählen setzt auch die Auswahl seiner Fragen zurück. */
  const setConfigMany = (partId: string, patch: Record<string, string>) =>
    onChange(parts.map((p) => (p.id === partId ? { ...p, config: { ...p.config, ...patch } } : p)));

  /* WELCHEN Baustein diese Stelle zeigt. Der Inhalt zieht damit mit: er
     hängt am Baustein, nicht an der Stelle. */
  const withModule = (partId: string, moduleId: string): readonly DraftPart[] =>
    parts.map((p) => (p.id === partId ? { ...p, moduleId } : p));

  const setModule = (partId: string, moduleId: string) =>
    onChange(withModule(partId, moduleId));

  const width = CANVAS_W[breakpoint];
  const chosen = parts.find((p) => p.id === selected) ?? null;

  return (
    <div className="pb">
      <div className="pb-bar">
        <div className="pb-views" role="group" aria-label="Rozmiar ekranu">
          {BREAKPOINTS.map((bp) => (
            <button
              key={bp}
              type="button"
              className={`pb-view${breakpoint === bp ? ' is-active' : ''}`}
              aria-pressed={breakpoint === bp}
              onClick={() => setBreakpoint(bp)}
            >
              {BREAKPOINT_LABEL[bp]}
              <span className="pb-view-cols">{COLUMNS[bp]}</span>
            </button>
          ))}
        </div>

        <p className="pb-hint">
          Przeciągnij moduł na siatkę. Krawędzie zaznaczonego modułu zmieniają rozmiar.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={byCorner}
        onDragStart={onDragStart}
        onDragCancel={() => setDrag(null)}
        onDragEnd={onDragEnd}
      >
        <div className="pb-palette">
          {PARTS.map((one) => (
            <Pill key={one.kind} kind={one.kind} label={one.label} use={one.use} />
          ))}
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

            {parts.map((part) => (
              <Item
                key={part.id}
                part={part}
                frame={frameFor(part, breakpoint)}
                columns={columns}
                selected={selected === part.id}
                onSelect={() => setSelected(part.id)}
                onResizeStart={(handle, e) => startResize(part.id, handle, e)}
                onRemove={() => remove(part.id)}
              />
            ))}
          </div>
        </div>

        {/*
          `dropAnimation={null}`: der Baustein liegt nach dem Ablegen schon an
          seinem Platz. Eine Rückflugbewegung zöge die Vorschau danach noch
          einmal quer über den Bildschirm zu einer Stelle, an der nichts ist.
        */}
        <DragOverlay dropAnimation={null}>
          {drag !== null && (
            <div className="pb-ghost" style={ghostStyle(drag.size, cell)}>
              <span className="pb-item-name">{drag.label}</span>
              <span className="pb-item-size">{drag.size.colSpan}×{drag.size.rowSpan}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {parts.length === 0 && (
        <p className="pb-empty">Strona nie ma jeszcze modułu. Przeciągnij pierwszy z listy powyżej.</p>
      )}

      {/*
        EIN BOGEN WIRD GEWÄHLT, NICHT HIER GESTELLT.

        Seine Fragen gehören ihm und nicht der Seite, auf der er steht: wer
        denselben Bogen zweimal auslegt, soll EINEN Satz Fragen haben und
        EINEN Satz Antworten. Alles andere trägt seinen Inhalt selbst und
        wird deshalb weiterhin hier gefüllt.
      */}
      {chosen !== null && (
        chosen.kind === 'form' ? (
          <PickModule
            kind={chosen.kind}
            chosen={chosen.moduleId}
            busy={busy}
            onPick={(moduleId) => setModule(chosen.id, moduleId)}
            onMade={(moduleId) => {
              const next = withModule(chosen.id, moduleId);
              onChange(next);
              onOpenModule(moduleId, next);
            }}
          />
        ) : (
          <Fields
            part={chosen}
            busy={busy}
            onSet={(patch) => setConfigMany(chosen.id, patch)}
          />
        )
      )}
    </div>
  );
}

function ghostStyle(size: { colSpan: number; rowSpan: number }, cell: number): CSSProperties {
  if (cell <= 0) return {};
  const { width, height } = pixelSize(size, cell, ROW_H, GAP);
  return { width: `${width}px`, height: `${height}px` };
}

/**
 * Ein Baustein in der Ablage — mit dem Satz, WOZU er da ist.
 *
 * <b>Der Name allein genügte nicht.</b> „Formularz" sagt, was es ist, und
 * nicht, wann man es nimmt; wer elf Namen nebeneinander sieht, rät. Der Satz
 * steht am Baustein selbst (`use`), nicht in dieser Liste — sonst hätte die
 * nächste Liste ihn wieder nicht.
 */
function Pill({ kind, label, use }: { kind: string; label: string; use: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${kind}` });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`pb-pill${isDragging ? ' is-dragging' : ''}`}
      title={use}
      {...listeners}
      {...attributes}
    >
      <span className="pb-pill-name">{label}</span>
      <span className="pb-pill-use">{use}</span>
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

function Item({ part, frame, columns, selected, onSelect, onResizeStart, onRemove }: {
  part: DraftPart;
  frame: Frame;
  columns: number;
  selected: boolean;
  onSelect: () => void;
  onResizeStart: (handle: Handle, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `item:${part.id}` });
  const colSpan = snapColSpan(frame.size.colSpan, columns);
  const rowSpan = snapRowSpan(frame.size.rowSpan);

  /*
   * UNFERTIG heisst: nichts eingetragen — oder es fehlt, was die Art verlangt
   * (`missing`), etwa bei „Zgłoszenie osoby" das Formular.
   */
  const empty = Object.values(part.config).every((v) => v.trim() === '')
    || (partOf(part.kind)?.missing(part.config) ?? null) !== null;

  return (
    <div
      ref={setNodeRef}
      className={`pb-item${selected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}${empty ? ' is-todo' : ''}`}
      style={{
        gridColumn: `${frame.position.col} / span ${colSpan}`,
        gridRow: `${frame.position.row} / span ${rowSpan}`
      }}
      onClick={onSelect}
      {...listeners}
      {...attributes}
    >
      <span className="pb-item-name">{partLabel(part.kind)}</span>
      <span className="pb-item-size">{colSpan}×{rowSpan}</span>
      {empty && <span className="pb-item-todo">do uzupełnienia</span>}

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

function Fields({ part, busy, onSet }: {
  part: DraftPart;
  busy: boolean;
  onSet: (patch: Record<string, string>) => void;
}) {
  const def = partOf(part.kind);

  if (def === undefined) {
    return (
      <p className="pb-empty">
        Moduł „{part.kind}" nie jest znany tej wersji — zostaje nietknięty.
      </p>
    );
  }

  return (
    <section className="pb-fields">
      <h4 className="pb-h">{def.label}</h4>
      <p className="wk-hint">{def.use}</p>

      {def.missing(part.config) !== null && <p className="wk-blocker">{def.missing(part.config)}</p>}

      {def.fields.map((field) => {
        const value = part.config[field.key] ?? '';
        const empty = value.trim() === '';

        return (
          /* Eine Auswahl mit mehreren Knöpfen darin ist kein <label>: ein Klick daneben träfe den ersten. */
          <Wrap as={field.kind === 'questions' || field.kind === 'form' ? 'div' : 'label'} className={`wk-field${empty ? ' is-empty' : ''}`} key={field.key}>
            <span>{field.label}</span>

            {field.kind === 'resource' ? (
              <PickResource value={value} busy={busy} onPick={(id) => onSet({ [field.key]: id })} />
            ) : field.kind === 'form' ? (
              <PickForm value={value} busy={busy} onPick={(id) => onSet(pickedForm(def, field.key, id))} />
            ) : field.kind === 'questions' ? (
              <PickQuestions
                formId={part.config[field.of ?? ''] ?? ''}
                value={value}
                busy={busy}
                onPick={(next) => onSet({ [field.key]: next })}
              />
            ) : field.kind === 'line' ? (
              <input
                value={value}
                placeholder={field.hint}
                disabled={busy}
                onChange={(e) => onSet({ [field.key]: e.target.value })}
              />
            ) : (
              <textarea
                rows={4}
                value={value}
                placeholder={field.hint}
                disabled={busy}
                onChange={(e) => onSet({ [field.key]: e.target.value })}
              />
            )}
          </Wrap>
        );
      })}
    </section>
  );
}

/** Ein Feld — als `<label>`, wo es EIN Eingabeelement umschliesst, sonst als `<div>`. */
function Wrap({ as, className, children }: { as: 'label' | 'div'; className: string; children: ReactNode }) {
  return as === 'label' ? <label className={className}>{children}</label> : <div className={className}>{children}</div>;
}

export default PageBuilder;
