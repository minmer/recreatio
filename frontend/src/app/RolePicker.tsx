/**
 * ROLLEN BENENNEN UND WÄHLEN — für die Rozmowy (wen hineinnehmen) und für
 * „Napisz do nas" (wer antwortet, 0081): wen ich schon kenne (aus meinen
 * Rozmowy, mit dem Namen, den er dort trägt) und wen ich mit seinem „kod do
 * rozmów" finde.
 */

import { useEffect, useState } from 'react';

import { areaKeys, looksLikeCode, openNames, roleCard, type ChatRow, type Invitee } from './chat';
import type { Ring } from './keys';
import { WorkspaceError } from './session';

interface Me {
  readonly ring: Ring;
  readonly names: ReadonlyMap<string, string>;
}

export const KIND: Record<string, string> = { person: 'osoba', role: 'rola', group: 'grupa', account: 'konto' };

export const shortId = (id: string) => id.slice(0, 8);

/** Wie ein Mitglied heisst: sein Name in diesem Bereich, sonst meiner für meine Rollen, sonst Art und Kennung. */
export const nameOf = (roleId: string, kind: string | undefined, names: ReadonlyMap<string, string>, mine: ReadonlyMap<string, string>) =>
  names.get(roleId) ?? mine.get(roleId) ?? `${KIND[kind ?? 'person'] ?? 'osoba'} · ${shortId(roleId)}`;

/** Wen ich schon kenne — aus meinen Rozmowy, mit dem Namen, den sie dort tragen. Ohne Schlüssel (`null`): niemanden. */
export function useKnown(me: Pick<Me, 'ring' | 'names'> | null, chats: readonly ChatRow[]): readonly Invitee[] {
  const [known, setKnown] = useState<readonly Invitee[]>([]);
  const key = `${me === null ? '-' : '+'}${chats.map((c) => c.chatId).join(',')}`;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const out = new Map<string, Invitee>();
      if (me === null) { if (alive) setKnown([]); return; }
      for (const chat of chats) {
        let names = new Map<string, string>();
        try { names = await openNames(await areaKeys(me.ring, chat.areaId), chat.areaId, chat.names); } catch { /* ohne Namen */ }
        for (const m of chat.members) {
          if (me.ring.has(m.roleId) || out.has(m.roleId) || m.kind === 'account') continue;
          out.set(m.roleId, { roleId: m.roleId, kind: m.kind, wrapPublicKey: m.wrapPublicKey, name: nameOf(m.roleId, m.kind, names, me.names) });
        }
      }
      if (alive) setKnown([...out.values()].sort((a, b) => a.name.localeCompare(b.name, 'pl')));
    })();
    return () => { alive = false; };
  }, [key]);

  return known;
}

/**
 * WEN HINEINNEHMEN — jemand, den ich schon aus einer Rozmowa kenne, oder
 * jemand mit seinem Kod do rozmów (und dem Namen, unter dem er hier steht).
 */
export function InviteePicker({ known, chosen, single, busy, onChange }: {
  known: readonly Invitee[];
  chosen: readonly Invitee[];
  single: boolean;
  busy: boolean;
  onChange: (next: readonly Invitee[]) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [looking, setLooking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const add = (one: Invitee) => {
    if (chosen.some((c) => c.roleId === one.roleId)) return;
    onChange(single ? [one] : [...chosen, one]);
  };

  const byCode = async () => {
    setFailed(null);
    if (!looksLikeCode(code)) { setFailed('To nie wygląda na kod do rozmów — skopiuj go w całości.'); return; }
    if (name.trim() === '') { setFailed('Wpisz, jak ta osoba ma się tu nazywać.'); return; }
    setLooking(true);
    try {
      const card = await roleCard(code);
      add({ roleId: card.roleId, kind: card.kind, wrapPublicKey: card.wrapPublicKey, name: name.trim() });
      setCode('');
      setName('');
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się znaleźć tego kodu.');
    } finally {
      setLooking(false);
    }
  };

  const rest = known.filter((k) => !chosen.some((c) => c.roleId === k.roleId));

  return (
    <div className="wk-field wk-chat-pick">
      <span>{single ? 'Z kim' : 'Kto jeszcze'}</span>

      {chosen.length > 0 && (
        <span className="wk-slot-people">
          {chosen.map((c) => (
            <span key={c.roleId} className="wk-tag">
              {c.name}
              <button type="button" className="wk-chip-x" aria-label={`Usuń: ${c.name}`} disabled={busy}
                onClick={() => onChange(chosen.filter((x) => x.roleId !== c.roleId))}>×</button>
            </span>
          ))}
        </span>
      )}

      {rest.length > 0 && (!single || chosen.length === 0) && (
        <span className="wk-appt-hits">
          {rest.map((k) => (
            <button key={k.roleId} type="button" className="wk-appt-hit" disabled={busy} onClick={() => add(k)}>
              + {k.name}
            </button>
          ))}
        </span>
      )}

      {(!single || chosen.length === 0) && (
        <span className="wk-chat-bycode">
          <input value={code} placeholder="Kod do rozmów (np. 01a0…)" aria-label="Kod do rozmów"
            onChange={(e) => setCode(e.target.value)} />
          <input value={name} placeholder="Jak się nazywa" aria-label="Nazwa tej osoby"
            onChange={(e) => setName(e.target.value)} />
          <button type="button" className="wk-link-btn" disabled={busy || looking} onClick={() => void byCode()}>
            {looking ? 'Szukanie…' : 'Dodaj po kodzie'}
          </button>
        </span>
      )}

      {failed !== null && <span className="wk-error">{failed}</span>}
      <span className="wk-hint">
        Kod do rozmów ma każda osoba i rola — znajdzie go u siebie w „Rozmowach". Nazwę, którą tu wpiszesz,
        zobaczą tylko uczestnicy rozmowy.
      </span>
    </div>
  );
}
