/**
 * LABOR 2D (v2) — DAS FELD RECHTS (seit 2026-10-24; auf dem Telefon von
 * unten): erscheint nur, wenn es etwas zu zeigen gibt — der gewählte
 * Gegenstand mit seinen Einstellungen, was „Badaj“ an einem Punkt fand, die
 * gewählte Blase mit ihren Kräften, die Schreiber. Mehrere davon als Reiter.
 */

import type { ReactNode } from 'react';

import { Icon } from '../../../ui/icons';
import { t, type TextKey } from '../i18n';

export type SideTab = 'object' | 'inspect' | 'bubble' | 'charts';

const LABEL: Readonly<Record<SideTab, TextKey>> = { object: 'objSection', inspect: 'inspect', bubble: 'bubble', charts: 'charts' };

export function SidePanel({ tabs, tab, onTab, onClose, children }: {
  /** Die Reiter, die es gerade gibt (in dieser Reihenfolge). */
  tabs: readonly SideTab[];
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside className="l2d-side" aria-label={t(LABEL[tab])} onPointerDown={(e) => e.stopPropagation()}>
      <header className="l2d-side-head">
        <div className="l2d-tabs" role="tablist">
          {tabs.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={k === tab} className={`l2d-tab${k === tab ? ' is-on' : ''}`} onClick={() => onTab(k)}>{t(LABEL[k])}</button>
          ))}
        </div>
        <button type="button" className="l2d-icon is-small" onClick={onClose} aria-label={t('closePanel')} title={t('closePanel')}><Icon name="x" /></button>
      </header>
      <div className="l2d-side-body" role="tabpanel">{children}</div>
    </aside>
  );
}
