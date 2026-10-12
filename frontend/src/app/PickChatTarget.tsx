/**
 * 0102 — IN WELCHEN ROZMOWY der Mensch lesen soll („Przeczytaj wiadomości").
 *
 * <b>Die drei Zugänge</b> (`audience.ts`) und alle zusammen: jede seiner
 * Rozmowy; die mit den Prowadzący (jeden na jeden); die seiner Gruppe
 * (razem); der Kanał. Jeweils an jedem Bereich oder an einem — gewählt aus
 * den Rozmowy, die die Kanzlei selbst hat. Was die Person davon tatsächlich
 * hat, rechnet der Dienst an ihrem Platz aus.
 *
 * <b>Was schon drinsteht und hier nicht vorkommt</b> (ein Bereich, den dieses
 * Konto nicht sieht), bleibt gewählt und sagt das.
 */

import { useEffect, useState } from 'react';

import { loadChats, type ChatRow } from './chat';
import type { ChatTargetKind } from './steps';

export interface ChatTargetDraft {
  readonly kind: ChatTargetKind;
  /** Leer: an jedem Bereich. */
  readonly areaId: string;
}

const keyOf = (target: ChatTargetDraft) => `${target.kind}:${target.areaId}`;
const fromKey = (key: string): ChatTargetDraft => {
  const [kind, areaId = ''] = key.split(':');
  return { kind: (['all', 'seat', 'area', 'channel'].includes(kind) ? kind : 'all') as ChatTargetKind, areaId };
};

export function PickChatTarget({ value, onPick }: {
  value: ChatTargetDraft | undefined;
  onPick: (target: ChatTargetDraft) => void;
}) {
  const [rows, setRows] = useState<readonly ChatRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadChats()
      .then(({ chats }) => { if (alive) setRows(chats); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  const chosen = value ?? { kind: 'all', areaId: '' };
  const areas = (kind: ChatRow['kind']) => {
    const seen = new Map<string, string>();
    for (const row of rows ?? []) if (row.kind === kind && !seen.has(row.areaId)) seen.set(row.areaId, row.areaName);
    return [...seen].sort((a, b) => a[1].localeCompare(b[1], 'pl'));
  };
  const channels = areas('channel');
  const groups = areas('area');
  const meetings = areas('seat');
  const known = chosen.areaId === '' || rows === null
    || [...channels, ...groups, ...meetings].some(([areaId]) => areaId === chosen.areaId);

  return (
    <select value={keyOf(chosen)} data-pick-chat-target="" onChange={(e) => onPick(fromKey(e.target.value))}>
      <option value="all:">wszystkie rozmowy osoby</option>
      <option value="seat:">rozmowy z prowadzącymi (jeden na jeden)</option>
      <option value="area:">rozmowy grup (razem)</option>
      <option value="channel:">kanały</option>
      {!known && <option value={keyOf(chosen)}>wybrana wcześniej (obszar spoza Twojej listy)</option>}
      {channels.length > 0 && (
        <optgroup label="Kanał">
          {channels.map(([areaId, name]) => <option key={areaId} value={`channel:${areaId}`}>Kanał „{name}"</option>)}
        </optgroup>
      )}
      {groups.length > 0 && (
        <optgroup label="Rozmowa grupy">
          {groups.map(([areaId, name]) => <option key={areaId} value={`area:${areaId}`}>Rozmowa grupy „{name}"</option>)}
        </optgroup>
      )}
      {meetings.length > 0 && (
        <optgroup label="Z prowadzącymi">
          {meetings.map(([areaId, name]) => <option key={areaId} value={`seat:${areaId}`}>Z prowadzącymi „{name}"</option>)}
        </optgroup>
      )}
    </select>
  );
}
