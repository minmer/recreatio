/**
 * ROLLE WÄHLEN — ODER EINE NEUE ANLEGEN (0091), für Links und Formulare.
 *
 * Eine Liste meiner Rollen mit dem, wozu jede führt („Rada — pisze ·
 * Ogłoszenia — czyta"), und als letzte Möglichkeit „Nowa rola": ein Name und
 * die Bereiche, gleich hier. Angelegt wird sie erst beim Absenden — wer es
 * sich anders überlegt, hinterlässt keine Rolle ohne Zweck.
 *
 * Gewählt ist, was in \`picked\` steht (Rolle → führt der Empfänger sie mit?);
 * \`NEW_ROLE\` steht für den Entwurf.
 */

import { useEffect, useMemo, useState } from 'react';

import type { AreaRow } from './area';
import { Segment } from './Areas';
import { givableRoles, reachWords, type GivableRole, type NewRoleDraft } from './commonRole';
import type { Ring } from './keys';
import { LINK_LEVELS, type LinkLevel } from './linkAccess';
import { WorkspaceError } from './session';

export const NEW_ROLE = 'new';

export const EMPTY_DRAFT: NewRoleDraft = { name: '', areas: [] };

/** Die Rollen, die ich geben kann — einmal je Bund geladen. `null`: wird geladen. */
export function useGivableRoles(ring: Ring | null): { roles: readonly GivableRole[] | null; failed: string | null } {
  const [roles, setRoles] = useState<readonly GivableRole[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (ring === null) { setRoles([]); return undefined; }
    let alive = true;
    setRoles(null);
    givableRoles(ring).then((found) => { if (alive) { setRoles(found); setFailed(null); } })
      .catch((e) => { if (alive) { setRoles([]); setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać ról.'); } });
    return () => { alive = false; };
  }, [ring]);
  return { roles, failed };
}

export function CommonRoleChoice({
  roles, failed, areas, focusAreaId, many, picked, onPicked, draft, onDraft, leadLabel, busy
}: {
  /** Aus `useGivableRoles` — der Aufrufer braucht sie meist selbst (wozu führt, was gewählt ist). */
  roles: readonly GivableRole[] | null;
  failed: string | null;
  /** Die Bereiche, die ich sehe — für eine neue Rolle die, in die ich hineinlassen darf. */
  areas: readonly AreaRow[];
  /** Im Bereich geöffnet: Rollen, die in ihn führen, zuerst; eine neue Rolle mit ihm vorgewählt. */
  focusAreaId?: string;
  /** Mehrere (ein Link) oder eine (ein Formular). */
  many: boolean;
  picked: ReadonlyMap<string, boolean>;
  onPicked: (next: ReadonlyMap<string, boolean>) => void;
  draft: NewRoleDraft;
  onDraft: (next: NewRoleDraft) => void;
  /** Wenn gesetzt: je gewählter Rolle, die ich führe, ein Haken „führt sie mit" mit diesem Text. */
  leadLabel?: string;
  busy: boolean;
}) {
  const sorted = useMemo(() => {
    if (roles === null || focusAreaId === undefined) return roles;
    const into = (r: GivableRole) => r.areas.some((a) => a.areaId === focusAreaId);
    return [...roles].sort((a, b) => Number(into(b)) - Number(into(a)));
  }, [roles, focusAreaId]);

  /* Für eine neue Rolle: nur Bereiche, in die ich hineinlassen darf — nie der eigene, private. */
  const possible = areas.filter((a) => a.mayCertify && a.personal !== true);
  const levels = useMemo(() => new Map(draft.areas.map((a) => [a.areaId, a.capability])), [draft.areas]);

  const toggle = (roleId: string, on: boolean) => {
    const next = new Map(many ? picked : []);
    if (on) next.set(roleId, picked.get(roleId) ?? false); else next.delete(roleId);
    onPicked(next);
    if (on && roleId === NEW_ROLE && draft.areas.length === 0 && focusAreaId !== undefined && possible.some((a) => a.areaId === focusAreaId)) {
      onDraft({ ...draft, areas: [{ areaId: focusAreaId, capability: 'read' }] });
    }
  };

  const creating = picked.has(NEW_ROLE);
  const leadOf = (roleId: string, leads: boolean) => leadLabel !== undefined && leads && picked.has(roleId) && (
    <label className="wk-check wk-role-lead">
      <input type="checkbox" checked={picked.get(roleId) === true} disabled={busy}
        onChange={(e) => onPicked(new Map(picked).set(roleId, e.target.checked))} />
      <span>{leadLabel}</span>
    </label>
  );

  return (
    <fieldset className="wk-role-choice" disabled={busy}>
      <legend>{many ? 'Jakie role daje' : 'Rola'}</legend>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {sorted === null ? <p className="wk-hint">Wczytywanie ról…</p> : (
        <ul>
          {sorted.map((r) => (
            <li key={r.roleId} className={picked.has(r.roleId) ? 'is-on' : undefined}>
              <label className="wk-role-option">
                <input type={many ? 'checkbox' : 'radio'} name="wk-role-choice" checked={picked.has(r.roleId)}
                  onChange={(e) => toggle(r.roleId, e.target.checked)} />
                <span>
                  <strong>{r.name}</strong>
                  {focusAreaId !== undefined && r.areas.some((a) => a.areaId === focusAreaId) && <span className="wk-tag wk-tag-open">ten obszar</span>}
                  <span className="wk-hint">{reachWords(r.areas)}</span>
                </span>
              </label>
              {leadOf(r.roleId, r.leads)}
            </li>
          ))}
          <li className={creating ? 'is-on' : undefined}>
            <label className="wk-role-option">
              <input type={many ? 'checkbox' : 'radio'} name="wk-role-choice" checked={creating} disabled={possible.length === 0}
                onChange={(e) => toggle(NEW_ROLE, e.target.checked)} />
              <span>
                <strong>+ Nowa rola</strong>
                <span className="wk-hint">{possible.length === 0 ? 'Nie prowadzisz obszaru, do którego mogłaby dawać dostęp.' : 'Nazwa i obszary — utworzy się przy zapisie.'}</span>
              </span>
            </label>
            {creating && (
              <div className="wk-role-new">
                <label className="wk-field">
                  <span>Nazwa roli</span>
                  <input value={draft.name} placeholder="np. Uczestnicy Rocket 2026" autoComplete="off" data-role-new-name=""
                    onChange={(e) => onDraft({ ...draft, name: e.target.value })} />
                </label>
                <span className="wk-hint">Daje dostęp do:</span>
                <ul className="wk-role-new-areas">
                  {possible.map((a) => {
                    const level = levels.get(a.areaId);
                    return (
                      <li key={a.areaId}>
                        <label className="wk-check">
                          <input type="checkbox" checked={level !== undefined} data-role-new-area={a.areaId} onChange={(e) => onDraft({
                            ...draft,
                            areas: e.target.checked
                              ? [...draft.areas, { areaId: a.areaId, capability: 'read' }]
                              : draft.areas.filter((x) => x.areaId !== a.areaId)
                          })} />
                          <span>{a.name}</span>
                        </label>
                        {level !== undefined && (
                          <Segment now={level} busy={busy} options={LINK_LEVELS.map((l) => ({ value: l.value, label: l.label }))}
                            onPick={(next: LinkLevel) => onDraft({ ...draft, areas: draft.areas.map((x) => (x.areaId === a.areaId ? { ...x, capability: next } : x)) })} />
                        )}
                      </li>
                    );
                  })}
                </ul>
                {leadOf(NEW_ROLE, true)}
              </div>
            )}
          </li>
        </ul>
      )}
    </fieldset>
  );
}
