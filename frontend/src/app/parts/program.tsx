/**
 * „PROGRAM" (0070) — ein Termin mit seinen Teilen, live aus dem Kalender.
 *
 * Rekolekcje mit Konferenzen, eine Pielgrzymka mit Etappen, ein Festyn mit
 * Punkten: im Kalender sind es Termine unter einem Termin (beliebig tief);
 * hier stehen sie als Programm — Zeiten, Orte, Hinweise. Jeder sieht, was
 * er sehen darf; ändert sich ein Punkt im Kalender, ändert er sich hier.
 *
 * <b>Je Grösse:</b> im Streifen der Name und wie viele Punkte; als Block die
 * erste Ebene mit Zeiten; hoch und im Vollbild alle Ebenen mit Orten und
 * Hinweisen.
 *
 * Anders als „Plan" (0063), der seinen Inhalt selbst trägt: hier steht nur,
 * WELCHER Termin — der Inhalt kommt aus dem Kalender.
 */

import { useEffect, useState } from 'react';

import { definePart, text, type PartContext, type RawConfig } from '../part';
import { countParts, loadProgram, openProgram, type ProgramNode } from '../program';
import { keysFor } from '../ringOf';
import { whoIsThere } from '../session';

interface ProgramConfig {
  readonly title: string;
  readonly calendar: string;
  readonly item: string;
}

const day = (at: Date) => at.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
const hour = (at: Date) => at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

function when(node: ProgramNode, withDay: boolean): string {
  if (node.allDay) return withDay ? day(node.start) : 'cały dzień';
  const same = node.start.toDateString() === node.end.toDateString();
  const span = same ? `${hour(node.start)}–${hour(node.end)}` : `${hour(node.start)} – ${day(node.end)} ${hour(node.end)}`;
  return withDay ? `${day(node.start)}, ${span}` : span;
}

function Points({ nodes, deep, parentDay }: { nodes: readonly ProgramNode[]; deep: boolean; parentDay: string | null }) {
  if (nodes.length === 0) return null;
  return (
    <ol className="wk-program-list">
      {nodes.map((node) => {
        const showDay = node.start.toDateString() !== parentDay;
        return (
          <li key={node.itemId} className={node.cancelled ? 'is-cancelled' : undefined}>
            <span className="wk-program-when">{when(node, showDay)}</span>
            <span className="wk-program-what">
              <strong>{node.title}</strong>
              {node.cancelled && <span className="wk-tag">odwołane</span>}
              {node.location !== null && <span className="wk-program-where">{node.location}</span>}
              {deep && node.notes !== null && <span className="wk-program-notes">{node.notes}</span>}
            </span>
            {deep && <Points nodes={node.children} deep={deep} parentDay={node.start.toDateString()} />}
            {!deep && node.children.length > 0 && <span className="wk-hint"> · {node.children.length} pkt.</span>}
          </li>
        );
      })}
    </ol>
  );
}

function ProgramView({ config, ctx }: { config: ProgramConfig; ctx: PartContext }) {
  const [node, setNode] = useState<ProgramNode | null | undefined>(undefined);

  useEffect(() => {
    if (config.item === '') { setNode(null); return undefined; }
    let alive = true;
    void (async () => {
      try {
        const program = await loadProgram(config.item);
        const who = await whoIsThere().catch(() => null);
        const ring = who === null ? null : (await keysFor(who).catch(() => ({ ring: null }))).ring;
        const opened = await openProgram(program.items, ring);
        if (alive) setNode(opened);
      } catch {
        if (alive) setNode(null);
      }
    })();
    return () => { alive = false; };
  }, [config.item]);

  const head = <h2 className="wk-card-title">{config.title !== '' ? config.title : node?.title ?? 'Program'}</h2>;
  if (node === undefined) return <>{head}<p className="wk-card-muted">Wczytywanie programu…</p></>;
  if (node === null) return <>{head}<p className="wk-card-muted">Programu nie da się pokazać — termin jest niewidoczny albo go nie ma.</p></>;

  const strip = ctx.size.height === 'strip' && ctx.whole !== true;
  const deep = ctx.whole === true || ctx.size.height === 'tall';
  const parts = countParts(node);

  if (strip) {
    return (
      <p className="wk-program-strip">
        <strong>{config.title !== '' ? config.title : node.title}</strong> · {when(node, true)} · {parts} {parts === 1 ? 'punkt' : 'punktów'}
      </p>
    );
  }

  return (
    <div className="wk-program">
      {head}
      <p className="wk-program-head">
        {config.title !== '' && config.title !== node.title && <strong>{node.title} · </strong>}
        {when(node, true)}
        {node.location !== null && <> · {node.location}</>}
      </p>
      {deep && node.notes !== null && <p className="wk-program-notes">{node.notes}</p>}
      {parts === 0 ? <p className="wk-card-muted">Program jeszcze nie jest gotowy.</p>
        : <Points nodes={node.children} deep={deep} parentDay={node.start.toDateString()} />}
    </div>
  );
}

export const programPart = definePart<ProgramConfig>({
  kind: 'program',
  example: { title: 'Program rekolekcji', calendar: '<id-kalendarza>', item: '<id-terminu>' },
  label: 'Program wydarzenia',
  use: 'Termin z kalendarza razem z jego punktami (i podpunktami) — rekolekcje, pielgrzymka, festyn. Zmiany w kalendarzu od razu widać na stronie.',
  box: { colSpan: 3, rowSpan: 4 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'pusty: nazwa terminu' },
    { key: 'calendar', label: 'Kalendarz', kind: 'calendar' },
    { key: 'item', label: 'Termin', kind: 'calendarItem', of: 'calendar' }
  ],

  read: (raw: RawConfig): ProgramConfig => ({ title: text(raw, 'title'), calendar: text(raw, 'calendar'), item: text(raw, 'item') }),

  hasContent: (config) => config.item !== '',
  missing: (config) => config.calendar === '' ? 'Wybierz kalendarz, a potem termin — jego program pojawi się na stronie.'
    : config.item === '' ? 'Wybierz termin, którego program ma się pokazać.'
    : null,

  fullscreen: true,
  shows: (_config, size) => size.height === 'strip'
    ? 'Nazwa, data i liczba punktów w jednym wierszu.'
    : size.height === 'tall'
      ? 'Cały program: wszystkie poziomy z miejscem i uwagami.'
      : 'Punkty pierwszego poziomu z godzinami; podpunkty jako liczba.',

  View: ProgramView
});
