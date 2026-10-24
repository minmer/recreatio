import { useId, type ReactNode } from 'react';

import type { NavEntry } from './WorkspaceFrame';

/** The same Studium hierarchy in the sidebar and the phone menu. */
export function StudiumItems({ entries, renderItems }: {
  entries: readonly NavEntry[];
  renderItems: (entries: readonly NavEntry[]) => ReactNode;
}) {
  const labelId = useId();
  const cogita = entries.filter((one) => one.place === 'knowledge' || one.place === 'learn');

  return (
    <>
      {renderItems(entries.filter((one) => one.place === 'library'))}
      {cogita.length > 0 && (
        <li className="wk-nav-group">
          <p className="wk-nav-group-label" id={labelId}>Cogita</p>
          <ul className="wk-nav wk-nav-children" aria-labelledby={labelId}>
            {renderItems(cogita)}
          </ul>
        </li>
      )}
      {renderItems(entries.filter((one) => one.place === 'scriptorium'))}
    </>
  );
}
