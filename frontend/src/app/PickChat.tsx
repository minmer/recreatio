/**
 * EINE ROZMOWA WÄHLEN — die einer Gruppe, mit ihrem Namen.
 *
 * <b>Nur Gruppengespräche.</b> Zu zweit (`direct`) ist ein Chat zwischen zwei
 * Menschen; er auf eine Seite zu legen hiesse, ihn Dritten hinzustellen — und
 * lesen könnte ihn dort ohnehin nur einer der beiden. Die Liste zeigt ihn
 * deshalb gar nicht erst.
 *
 * <b>Die Auswahl ist die des Einrichtenden.</b> Er sieht hier seine eigenen
 * Rozmowy; wer die Seite später besucht, sieht die gewählte nur, wenn er
 * selbst dazugehört — das entscheidet der Bereich, nicht diese Liste.
 */

import { useEffect, useState } from 'react';

import { areaPath, loadAreas, type AreaRow } from './area';
import { loadChats, type ChatRow } from './chat';

export function PickChat({ value, busy, onPick }: {
  value: string;
  busy: boolean;
  onPick: (chatId: string) => void;
}) {
  const [rows, setRows] = useState<readonly ChatRow[] | null>(null);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);

  useEffect(() => {
    let alive = true;
    void Promise.all([loadChats().catch(() => ({ chats: [] as readonly ChatRow[] })), loadAreas().catch(() => ({ areas: [] as readonly AreaRow[] }))])
      .then(([found, where]) => {
        if (!alive) return;
        setRows(found.chats.filter((one) => one.kind !== 'direct'));
        setAreas(where.areas);
      });
    return () => { alive = false; };
  }, []);

  if (rows === null) return <p className="wk-hint">Wczytywanie rozmów…</p>;

  const known = value === '' || rows.some((r) => r.chatId === value);
  const nameOf = (chat: ChatRow) =>
    areas.some((a) => a.areaId === chat.areaId) ? areaPath(areas, chat.areaId).full : chat.areaName;

  return (
    <>
      <select value={known ? value : ''} disabled={busy} onChange={(e) => onPick(e.target.value)}>
        <option value="">— wybierz rozmowę —</option>
        {rows.map((r) => <option key={r.chatId} value={r.chatId}>{nameOf(r)}</option>)}
      </select>

      {rows.length === 0 && (
        <span className="wk-hint">
          Nie masz jeszcze żadnej rozmowy grupowej. Załóż ją w „Rozmowy" — potem wróć tutaj i wybierz.
        </span>
      )}

      {!known && (
        <span className="wk-blocker">
          Teraz stoi tu „{value}" — to nie jest żadna z Twoich rozmów. Wybierz właściwą.
        </span>
      )}
    </>
  );
}

export default PickChat;
