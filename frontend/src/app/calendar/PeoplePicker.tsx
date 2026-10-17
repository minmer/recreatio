/**
 * WER DA SEIN MUSS (0058) — bei einem Termin die Menschen seiner Gruppe
 * anheften: der Pfarrer, der diese Messe feiert; die Katechetin, die dieses
 * Treffen leitet. So unterscheidet der Kalender „meine" Messen von denen der
 * Pfarrei.
 *
 * <b>Namen, wie die Gruppe sie kennt</b> — versiegelt unter ihrem Schlüssel
 * (0052), sonst die meiner eigenen Rollen, sonst die halbe Kennung.
 */

import { useEffect, useState } from 'react';

import { loadMembers } from './area';
import { DUTY_LABEL, type Duty } from './calendar';
import { areaKeys, loadAreaNames, openNames } from './chat';
import type { Me } from './me';

export interface Pinned {
  readonly roleId: string;
  readonly duty: Duty;
}

export interface Candidate {
  readonly roleId: string;
  readonly name: string;
}

const short = (id: string) => `osoba ${id.slice(0, 8)}`;

/** Die Menschen einer Gruppe, mit Namen — zum Anheften und zum Anzeigen. */
export function useAreaPeople(me: Me, areaId: string | null): readonly Candidate[] | null {
  const [found, setFound] = useState<{ areaId: string; people: readonly Candidate[] } | null>(null);

  useEffect(() => {
    if (areaId === null) return undefined;
    let alive = true;
    void (async () => {
      try {
        const [{ members }, sealed] = await Promise.all([loadMembers(areaId), loadAreaNames(areaId).catch(() => ({ names: [] }))]);
        let names = new Map<string, string>();
        try { names = await openNames(await areaKeys(me.ring, areaId), areaId, sealed.names); } catch { /* ohne Namen */ }
        const people = members
          .filter((m) => m.kind === 'person' || m.kind === 'role')
          .map((m) => ({ roleId: m.roleId, name: names.get(m.roleId) ?? me.names.get(m.roleId) ?? short(m.roleId) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
        if (alive) setFound({ areaId, people });
      } catch {
        if (alive) setFound({ areaId, people: [] });
      }
    })();
    return () => { alive = false; };
  }, [me, areaId]);

  return areaId === null ? [] : found?.areaId === areaId ? found.people : null;
}

/** Wie jemand heisst, der angeheftet ist — auch wenn er nicht (mehr) in der Liste steht. */
export const nameOfPinned = (me: Me, people: readonly Candidate[] | null, roleId: string): string =>
  people?.find((p) => p.roleId === roleId)?.name ?? me.names.get(roleId) ?? short(roleId);

export function PeoplePicker({ me, candidates, value, onChange, defaultDuty }: {
  me: Me;
  candidates: readonly Candidate[] | null;
  value: readonly Pinned[];
  onChange: (next: readonly Pinned[]) => void;
  defaultDuty: Duty;
}) {
  const free = (candidates ?? []).filter((c) => !value.some((v) => v.roleId === c.roleId));

  return (
    <div className="wk-people-pick">
      {value.length > 0 && (
        <ul className="wk-people-pinned">
          {value.map((one) => (
            <li key={one.roleId} className="wk-people-chip">
              <strong>{nameOfPinned(me, candidates, one.roleId)}</strong>
              <select value={one.duty} aria-label="Rola przy terminie"
                onChange={(e) => onChange(value.map((v) => v.roleId === one.roleId ? { ...v, duty: e.target.value as Duty } : v))}>
                {(Object.keys(DUTY_LABEL) as Duty[]).map((d) => <option key={d} value={d}>{DUTY_LABEL[d]}</option>)}
              </select>
              <button type="button" className="wk-chip-x" aria-label="Usuń z terminu"
                onClick={() => onChange(value.filter((v) => v.roleId !== one.roleId))}>×</button>
            </li>
          ))}
        </ul>
      )}

      {candidates === null ? (
        <span className="wk-hint">Wczytywanie osób z grupy…</span>
      ) : free.length === 0 ? (
        value.length === 0 && <span className="wk-hint">W tej grupie nie ma jeszcze innych osób.</span>
      ) : (
        <select value="" aria-label="Dodaj osobę" onChange={(e) => {
          if (e.target.value === '') return;
          onChange([...value, { roleId: e.target.value, duty: defaultDuty }]);
        }}>
          <option value="">+ dodaj osobę…</option>
          {free.map((c) => <option key={c.roleId} value={c.roleId}>{c.name}</option>)}
        </select>
      )}
    </div>
  );
}

export default PeoplePicker;
