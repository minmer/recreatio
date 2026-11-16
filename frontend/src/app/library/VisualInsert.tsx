/**
 * 2026-11-16 — „WSTAW GRAFIKĘ": ein kleines, richtiges Beispiel jeder Art an der Schreibmarke (oder am Ende) — man ändert
 * es, statt die Schreibweise auswendig zu wissen. Für jedes Feld mit Zapis (die Vorschau darunter zeigt die Grafik gleich).
 */

import type { RefObject } from 'react';

import { useT } from '../core/i18n';
import { visualTemplate, VISUAL_KINDS, type VisualKind } from './visual';

/** Der Text mit dem Block an der Stelle `at` — als eigener Absatz (Leerzeilen davor und danach). */
export function insertBlock(text: string, block: string, at?: number | null): { text: string; caret: number } {
  const pos = at === null || at === undefined || at < 0 || at > text.length ? text.length : at;
  const before = text.slice(0, pos).replace(/[ \t]+$/, '');
  const after = text.slice(pos).replace(/^[ \t]+/, '');
  const lead = before === '' ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const tail = after === '' ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const next = `${before}${lead}${block}${tail}${after}`;
  return { text: next, caret: before.length + lead.length + block.length };
}

export function VisualInsert({ value, onChange, area }: { value: string; onChange: (next: string) => void; area?: RefObject<HTMLTextAreaElement | null> }) {
  const t = useT();
  const kinds: readonly (VisualKind | 'table')[] = [...VISUAL_KINDS, 'table'];
  return (
    <select className="lib-visual-insert" value="" aria-label={t('visuals.insert.button')} title={t('visuals.insert.help')} data-visual-insert=""
      onChange={(e) => {
        const kind = e.target.value as VisualKind | 'table' | '';
        if (kind === '') return;
        const el = area?.current ?? null;
        const { text, caret } = insertBlock(value, visualTemplate(kind), el === null ? null : el.selectionStart);
        onChange(text);
        if (el !== null) requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
      }}>
      <option value="">{t('visuals.insert.button')}</option>
      {kinds.map((k) => <option key={k} value={k}>{t(`visuals.insert.${k}`)}</option>)}
    </select>
  );
}
