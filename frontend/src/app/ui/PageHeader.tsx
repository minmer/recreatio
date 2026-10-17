/**
 * DER KOPF EINER SEITE — Titel, eine Zeile Angaben, rechts die Handgriffe.
 *
 * Jede Ansicht baute ihren eigenen Kopf: Titel, eine Reihe „RODZAJ / NA
 * STRONACH", Auswahlfelder, ein Satz darüber. Hier gibt es EINEN: der Titel
 * (mit einem Plättchen daneben, wenn etwas vom Normalfall abweicht), darunter
 * eine Zeile, rechts höchstens ein Hauptknopf, Nebenknöpfe und „⋯".
 *
 * Der Weg darüber (`Crumbs`) steht im Rahmen, nicht hier.
 */

import type { ReactNode } from 'react';

export function PageHeader({ title, badge, meta, actions, level = 1 }: {
  title: ReactNode;
  /** Ein Plättchen neben dem Titel: „Zapisy otwarte". */
  badge?: ReactNode;
  /** Eine Zeile darunter: „Parafia św. Kazimierza · na 2 stronach · 48 zgłoszeń". */
  meta?: ReactNode;
  actions?: ReactNode;
  level?: 1 | 2;
}) {
  const Title = level === 1 ? 'h1' : 'h2';
  return (
    <header className="ui-head">
      <div className="ui-head-text">
        <div className="ui-head-title">
          <Title className={level === 1 ? 'wk-h1' : 'wk-h2'} style={level === 2 ? { margin: 0 } : undefined}>{title}</Title>
          {badge}
        </div>
        {meta !== undefined && meta !== null && meta !== false && <p className="ui-head-meta">{meta}</p>}
      </div>
      {actions !== undefined && actions !== null && actions !== false && <div className="ui-head-actions">{actions}</div>}
    </header>
  );
}

export default PageHeader;
