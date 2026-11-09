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

import { fmtDate, t, useT, type T } from '../../core/i18n';

import { ItemLink } from '../../calendar/ItemLink';
import { hiddenOf } from '../HideField';
import { text, type PartContext, type RawConfig } from '../part';
import { field, option, texts, textPart, withTexts } from './partTexts';
import { countParts, loadProgram, openProgram, type ProgramNode } from '../../calendar/program';
import { keysFor } from '../../core/ringOf';
import { whoIsThere } from '../../core/session';
import { Loading } from '../../ui/Loading';

/**
 * 2026-10-25 — WAS DIE KACHEL ZEIGT, ausser den Punkten mit ihren Zeiten (die
 * stehen immer): Wunsch des Nutzers — auf der Seite des Ereignisses selbst
 * führte der Knopf des Termins („Informacje i zapisy") nur wieder hierher.
 */
const PROGRAM_BITS = [
  option('whole', texts({ label: 'moduleData.program.bitWhole' })),
  option('notes', texts({ label: 'moduleData.program.bitNotes' })),
  option('link', texts({ label: 'moduleData.program.bitLink' })),
  option('places', texts({ label: 'moduleData.program.bitPlaces' })),
  option('pointNotes', texts({ label: 'moduleData.program.bitPointNotes' })),
  option('pointLinks', texts({ label: 'moduleData.program.bitPointLinks' }))
];

type ProgramBit = 'whole' | 'notes' | 'link' | 'places' | 'pointNotes' | 'pointLinks';

interface ProgramConfig {
  readonly title: string;
  readonly calendar: string;
  readonly item: string;
  /** Was weggelassen ist — leer: alles. */
  readonly hidden: ReadonlySet<string>;
}

const shown = (config: ProgramConfig, bit: ProgramBit): boolean => !config.hidden.has(bit);

/** Was an den Punkten steht — die Zeit und der Name immer. */
interface PointBits {
  readonly places: boolean;
  readonly notes: boolean;
  readonly links: boolean;
}

function when(t: T, node: ProgramNode, withDay: boolean): string {
  const day = (at: Date) => fmtDate(at, { weekday: 'long', day: 'numeric', month: 'long' }, t.lang);
  const hour = (at: Date) => fmtDate(at, { hour: '2-digit', minute: '2-digit' }, t.lang);
  if (node.allDay) return withDay ? day(node.start) : t('moduleData.program.allDay');
  const same = node.start.toDateString() === node.end.toDateString();
  const span = same ? `${hour(node.start)}–${hour(node.end)}` : `${hour(node.start)} – ${day(node.end)} ${hour(node.end)}`;
  return withDay ? `${day(node.start)}, ${span}` : span;
}

function Points({ nodes, deep, parentDay, bits }: { nodes: readonly ProgramNode[]; deep: boolean; parentDay: string | null; bits: PointBits }) {
  const t = useT();
  if (nodes.length === 0) return null;
  return (
    <ol className="wk-program-list">
      {nodes.map((node) => {
        const showDay = node.start.toDateString() !== parentDay;
        return (
          <li key={node.itemId} className={node.cancelled ? 'is-cancelled' : undefined}>
            <span className="wk-program-when">{when(t, node, showDay)}</span>
            <span className="wk-program-what">
              <strong>{node.title}</strong>
              {node.cancelled && <span className="wk-tag">{t('moduleDataEvents.cancelled')}</span>}
              {bits.places && node.location !== null && <span className="wk-program-where">{node.location}</span>}
              {bits.notes && deep && node.notes !== null && <span className="wk-program-notes">{node.notes}</span>}
              {bits.links && node.link !== null && <ItemLink url={node.link} label={node.linkLabel} compact />}
            </span>
            {deep && <Points nodes={node.children} deep={deep} parentDay={node.start.toDateString()} bits={bits} />}
            {!deep && node.children.length > 0 && <span className="wk-hint">{t('moduleData.program.pointsShort', { count: node.children.length })}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function ProgramView({ config, ctx }: { config: ProgramConfig; ctx: PartContext }) {
  const t = useT();
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

  const head = <h2 className="wk-card-title">{config.title !== '' ? config.title : node?.title ?? t('moduleData.program.title')}</h2>;
  if (node === undefined) return <>{head}<Loading label={t('moduleData.program.loading')} /></>;
  if (node === null) return <>{head}<p className="wk-card-muted">{t('moduleData.program.none')}</p></>;

  const strip = ctx.size.height === 'strip' && ctx.whole !== true;
  const deep = ctx.whole === true || ctx.size.height === 'tall';
  const parts = countParts(node);

  if (strip) {
    return (
      <p className="wk-program-strip">
        <strong>{config.title !== '' ? config.title : node.title}</strong>
        {shown(config, 'whole') && <> · {when(t, node, true)}</>} · {t('moduleData.plan.points', { count: parts })}
      </p>
    );
  }

  const bits: PointBits = { places: shown(config, 'places'), notes: shown(config, 'pointNotes'), links: shown(config, 'pointLinks') };

  return (
    <div className="wk-program">
      {head}
      {shown(config, 'whole') && (
        <p className="wk-program-head">
          {config.title !== '' && config.title !== node.title && <strong>{node.title} · </strong>}
          {when(t, node, true)}
          {node.location !== null && <> · {node.location}</>}
        </p>
      )}
      {shown(config, 'notes') && deep && node.notes !== null && <p className="wk-program-notes">{node.notes}</p>}
      {shown(config, 'link') && node.link !== null && <p><ItemLink url={node.link} label={node.linkLabel} /></p>}
      {parts === 0 ? <p className="wk-card-muted">{t('moduleData.program.notReady')}</p>
        : <Points nodes={node.children} deep={deep} parentDay={node.start.toDateString()} bits={bits} />}
    </div>
  );
}

export const programPart = textPart<ProgramConfig>(texts({ label: 'moduleData.program.label', use: 'moduleData.program.use' }), {
  kind: 'program',
  example: withTexts({ hide: 'link,notes' }, texts({ title: 'moduleData.program.exTitle', calendar: 'moduleData.masses.exCalendar', item: 'moduleData.program.exItem' })),
  box: { colSpan: 3, rowSpan: 4 },

  fields: [
    field({ key: 'title', kind: 'line' }, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleData.program.titleHint' })),
    field({ key: 'calendar', kind: 'calendar' }, texts({ label: 'moduleData.program.calendar' })),
    field({ key: 'item', kind: 'calendarItem', of: 'calendar' }, texts({ label: 'moduleData.program.item' })),
    /* 2026-10-25 — Häkchen: was ausser den Punkten dasteht (gespeichert: was wegbleibt). */
    field({ key: 'hide', kind: 'hide', options: PROGRAM_BITS }, texts({ label: 'moduleData.program.hide' }))
  ],

  read: (raw: RawConfig): ProgramConfig => ({
    title: text(raw, 'title'), calendar: text(raw, 'calendar'), item: text(raw, 'item'), hidden: hiddenOf(text(raw, 'hide'))
  }),

  hasContent: (config) => config.item !== '',
  missing: (config) => config.calendar === '' ? t('moduleData.program.missingCalendar')
    : config.item === '' ? t('moduleData.program.missingItem')
    : null,

  fullscreen: true,
  shows: (config, size) => {
    const left = PROGRAM_BITS.filter((one) => config.hidden.has(one.value)).map((one) => one.label.toLowerCase());
    const without = left.length === 0 ? '' : t('moduleData.program.without', { list: left.join(', ') });
    return (size.height === 'strip'
      ? (shown(config, 'whole') ? t('moduleData.program.showsStripDate') : t('moduleData.program.showsStrip'))
      : size.height === 'tall'
        ? t('moduleData.program.showsTall')
        : t('moduleData.program.showsBlock')) + (size.height === 'strip' ? '' : without);
  },

  View: ProgramView
});
