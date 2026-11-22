/**
 * 2026-11-22 (A3) — MELDUNGEN EINES IMPORTS, GLEICHE ZUSAMMEN (`core/messageGroups.ts`): eine Zeile je Art von Meldung, mit
 * „×N", und die einzelnen zum Aufklappen. Eine Meldung, die nur einmal kommt, steht wie bisher als Zeile da.
 */

import type { ReactNode } from 'react';

import { groupMessages } from '../core/messageGroups';
import { useT } from '../core/i18n';

export function MessageList({ lines, className, render }: {
  lines: readonly string[];
  /** Die Klasse der Liste (`wk-json-warn`, nichts für Fehler in `wk-error`). */
  className?: string;
  /** Wie eine Meldung gezeichnet wird (Formeln: `TexText`) — ohne: als Text. */
  render?: (line: string) => ReactNode;
}) {
  const t = useT();
  const show = render ?? ((line: string) => line);
  const groups = groupMessages(lines);
  if (groups.length === 0) return null;
  return (
    <ul className={className} data-message-groups={groups.length}>
      {groups.map((g, i) => (g.count === 1
        ? <li key={i}>{show(g.text)}</li>
        : g.examples.length === 1
          ? <li key={i} className="wk-msg-group" data-message-count={g.count}>{show(g.text)} <strong className="wk-msg-count">{t('ui.json.times', { count: g.count })}</strong></li>
          : (
          <li key={i} className="wk-msg-group" data-message-count={g.count}>
            <details>
              <summary>{show(g.text)} <strong className="wk-msg-count">{t('ui.json.times', { count: g.count })}</strong></summary>
              <ul>{g.examples.map((line, j) => <li key={j}>{show(line)}</li>)}</ul>
            </details>
          </li>
        )))}
    </ul>
  );
}
