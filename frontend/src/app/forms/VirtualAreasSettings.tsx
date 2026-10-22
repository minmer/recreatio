/**
 * OBSZARY OSÓB (0120) — die virtuellen Bereiche eines Formulars, in seinen
 * Einstellungen.
 *
 * Je virtuellem Bereich eine Regel: wie er heisst, was die Person damit tut
 * (nicht sehen / lesen / schreiben), und welche Rollen jeden solchen Bereich
 * jeder Person erreichen — mit welcher Stufe. Dazu, wie viele Personen ihren
 * Bereich schon haben.
 *
 * <b>Angewandt wird die Regel von diesem Browser, ohne Klick</b>: beim Öffnen
 * und nach jeder Änderung legt er fehlende Bereiche an und trägt nach, was
 * eine neue Rolle braucht (`applyVirtualArea`) — so weit seine Schlüssel
 * reichen. Was er nicht kann (ein Platz, den er nicht öffnet), bleibt für einen
 * anderen Leiter, und die Zahlen sagen es.
 */

import { useCallback, useEffect, useState } from 'react';

import { dropFromArea, joinArea, loadMembers, type Member } from '../areas/area';
import type { Ring, SealedRole } from '../core/keys';
import { WorkspaceError } from '../core/session';
import { useGivableRoles } from '../roles/CommonRoleField';
import { Loading } from '../ui/Loading';
import {
  applyVirtualArea, changeVirtualArea, createVirtualArea, loadVirtualAreas, loadVirtualPlan, releaseVirtualArea,
  SUBMITTER_LEVELS, SUBMITTER_WORDS, type SubmitterLevel, type VirtualAreaRow, type VirtualAreas
} from './virtualAreas';

type Level = 'read' | 'write' | 'admin';

const LEVEL_WORDS: Readonly<Record<Level, string>> = { read: 'czyta', write: 'pisze', admin: 'prowadzi' };

/** Die stärkste Stufe eines Mitglieds, in Worten — `certify` allein heisst: lässt hinein, sieht nicht hinein. */
function levelWord(capabilities: readonly string[]): string {
  if (capabilities.includes('admin')) return LEVEL_WORDS.admin;
  if (capabilities.includes('write')) return LEVEL_WORDS.write;
  if (capabilities.includes('read')) return LEVEL_WORDS.read;
  return 'wpuszcza';
}

export function VirtualAreasSettings({ partId, ring, person }: {
  partId: string;
  ring: Ring | null;
  person: SealedRole | null;
}) {
  const [state, setState] = useState<VirtualAreas | null>(null);
  const [members, setMembers] = useState<ReadonlyMap<string, readonly Member[]>>(new Map());
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<SubmitterLevel>('write');
  const [adding, setAdding] = useState<{ areaId: string; roleId: string; level: Level } | null>(null);
  const { roles } = useGivableRoles(ring);

  useEffect(() => {
    if (ring === null) return undefined;
    let alive = true;
    void ring.names().then((read) => { if (alive) setLabels(read); });
    return () => { alive = false; };
  }, [ring]);

  /*
     Lesen — und, wo dieser Browser es kann, gleich anwenden: fehlende Bereiche
     anlegen, Nachzutragendes nachtragen. Danach noch einmal lesen, damit die
     Zahlen stimmen.
  */
  const read = useCallback(async (apply: boolean) => {
    try {
      let now = await loadVirtualAreas(partId);
      if (apply && ring !== null && now.ready) {
        let changed = false;
        for (const va of now.virtualAreas) {
          if (!va.mayCertify || va.missing + va.behind === 0) continue;
          const done = await applyVirtualArea(ring, await loadVirtualPlan(va.areaId)).catch(() => null);
          if (done !== null && done.created + done.mirrored > 0) changed = true;
        }
        if (changed) now = await loadVirtualAreas(partId);
      }
      const found = new Map<string, readonly Member[]>();
      for (const va of now.virtualAreas) {
        found.set(va.areaId, (await loadMembers(va.areaId).catch(() => ({ members: [] as readonly Member[] }))).members);
      }
      setMembers(found);
      setState(now);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać obszarów osób.');
    }
  }, [partId, ring]);

  useEffect(() => { void read(true); }, [read]);

  const act = async (what: string, todo: () => Promise<string | null | void>) => {
    setBusy(what);
    setFailed(null);
    setNote(null);
    try {
      const said = await todo();
      if (typeof said === 'string') setNote(said);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally { setBusy(null); }
  };

  const apply = (va: VirtualAreaRow) => act('Zakładanie obszarów osób…', async () => {
    if (ring === null) throw new WorkspaceError('Najpierw podaj hasło.');
    const done = await applyVirtualArea(ring, await loadVirtualPlan(va.areaId), {
      onProgress: (at, of) => setBusy(`Zakładanie obszarów osób… ${at} z ${of}`)
    });
    await read(false);
    if (done.noIssuer) return 'Obszary osób zakłada ten, kto prowadzi ten obszar.';
    const parts = [
      done.created > 0 ? `założono ${done.created}` : '',
      done.mirrored > 0 ? `uzupełniono ${done.mirrored}` : '',
      done.seatless > 0 ? `bez dostępu dla osoby: ${done.seatless} (ich linku nie otworzysz — zrobi to ktoś z kancelarii)` : ''
    ].filter((x) => x !== '');
    return parts.length === 0 ? 'Wszystko jest na miejscu.' : `Gotowe: ${parts.join(' · ')}.`;
  });

  const nameOf = (roleId: string) => labels.get(roleId) ?? roles?.find((r) => r.roleId === roleId)?.name ?? 'rola spoza Twoich';

  if (state === null) {
    return (
      <section className="wk-field wk-virtual-areas" aria-label="Obszary osób">
        <h3 className="wk-h2">Obszary osób</h3>
        {failed !== null ? <p className="wk-error">{failed}</p> : <Loading label="Wczytywanie…" />}
      </section>
    );
  }

  return (
    <section className="wk-field wk-virtual-areas" aria-label="Obszary osób">
      <h3 className="wk-h2">Obszary osób</h3>
      <p>
        Każda osoba, która wyśle formularz, dostaje własny obszar według każdej reguły poniżej — z rozmową,
        terminami i zadaniami tylko dla niej. Rola dodana do reguły widzi taki obszar każdej osoby.
      </p>

      {failed !== null && <p className="wk-error">{failed}</p>}
      {!state.ready && <p className="wk-note">Obszary osób będą dostępne po migracji 0120.</p>}

      {state.virtualAreas.map((va) => {
        const here = members.get(va.areaId) ?? [];
        const leads = va.myLevel === 'admin';
        const issuer = ring === null ? null : here.find((m) =>
          (m.capabilities.includes('admin') || m.capabilities.includes('certify')) && ring.maySign(m.roleId))?.roleId ?? null;
        const present = new Set(here.map((m) => m.roleId));
        const candidates = (roles ?? []).filter((r) => !present.has(r.roleId));
        const open = adding?.areaId === va.areaId ? adding : null;

        return (
          <div key={va.areaId} className="wk-virtual" data-virtual-area={va.areaId}>
            <p className="wk-virtual-name"><strong>{va.name}</strong></p>
            <p className="wk-virtual-counts" data-virtual-counts="">
              Obszary: {va.instances} z {state.registrations}
              {va.missing > 0 && ` · brakuje ${va.missing}`}
              {va.behind > 0 && ` · do uzupełnienia ${va.behind}`}
            </p>

            <ul className="wk-virtual-who">
              <li>
                {leads ? (
                  <label>
                    Osoba, która wysłała:{' '}
                    <select value={va.submitterLevel} disabled={busy !== null} data-virtual-submitter=""
                      onChange={(e) => {
                        const next = e.target.value as SubmitterLevel;
                        void act('Zapisywanie…', async () => {
                          await changeVirtualArea(va.areaId, { submitterLevel: next });
                          await read(true);
                          return next === 'none' ? 'Osoby nie widzą już tych obszarów.' : null;
                        });
                      }}>
                      {SUBMITTER_LEVELS.map((one) => <option key={one} value={one}>{SUBMITTER_WORDS[one]}</option>)}
                    </select>
                  </label>
                ) : SUBMITTER_WORDS[va.submitterLevel]}
              </li>
              {here.map((m) => (
                <li key={m.roleId} data-virtual-member={m.roleId}>
                  {nameOf(m.roleId)} — {levelWord(m.capabilities)}
                  {leads && here.length > 1 && (
                    <button type="button" className="wk-link-btn" disabled={busy !== null}
                      aria-label={`Usuń z reguły: ${nameOf(m.roleId)}`}
                      onClick={() => void act('Usuwanie roli…', async () => {
                        await dropFromArea(va.areaId, m.roleId);
                        await read(false);
                        return 'Ta rola nie widzi już tych obszarów (tego, co już przeczytała, nie da się cofnąć).';
                      })}>
                      usuń
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {leads && open !== null && (
              <div className="wk-virtual-add">
                <select value={open.roleId} disabled={busy !== null} aria-label="Rola"
                  onChange={(e) => setAdding({ ...open, roleId: e.target.value })}>
                  {candidates.map((r) => <option key={r.roleId} value={r.roleId}>{r.name}</option>)}
                </select>
                <select value={open.level} disabled={busy !== null} aria-label="Co może"
                  onChange={(e) => setAdding({ ...open, level: e.target.value as Level })}>
                  {(['read', 'write', 'admin'] as const).map((l) => <option key={l} value={l}>{LEVEL_WORDS[l]}</option>)}
                </select>
                <button type="button" className="wk-btn" disabled={busy !== null || open.roleId === '' || issuer === null}
                  data-virtual-add-role=""
                  onClick={() => void act('Dodawanie roli…', async () => {
                    const role = ring?.roleOf(open.roleId);
                    if (ring === null || role === undefined || issuer === null) throw new WorkspaceError('Tej roli nie możesz tu dodać.');
                    await joinArea(ring, va.areaId, role, issuer, open.level);
                    setAdding(null);
                    const done = await applyVirtualArea(ring, await loadVirtualPlan(va.areaId)).catch(() => null);
                    await read(false);
                    return done === null || done.mirrored === 0
                      ? 'Dodano. Obszary osób dostaną tę rolę, gdy ktoś z kluczami otworzy formularz.'
                      : 'Dodano — rola widzi już obszary osób.';
                  })}>
                  Dodaj
                </button>
                <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={() => setAdding(null)}>Anuluj</button>
              </div>
            )}

            <div className="wk-actions">
              {leads && open === null && candidates.length > 0 && (
                <button type="button" className="wk-link-btn" disabled={busy !== null || issuer === null}
                  onClick={() => setAdding({ areaId: va.areaId, roleId: candidates[0].roleId, level: 'write' })}>
                  + Rola
                </button>
              )}
              {va.mayCertify && va.missing + va.behind > 0 && (
                <button type="button" className="wk-btn" disabled={busy !== null || ring === null} data-virtual-apply=""
                  onClick={() => void apply(va)}>
                  Załóż brakujące ({va.missing + va.behind})
                </button>
              )}
              {leads && va.instances === 0 && (
                <button type="button" className="wk-link-btn" disabled={busy !== null}
                  onClick={() => void act('Usuwanie reguły…', async () => {
                    await releaseVirtualArea(va.areaId);
                    await read(false);
                    return 'Reguła usunięta — sam obszar został w Obszarach.';
                  })}>
                  Usuń regułę
                </button>
              )}
            </div>
          </div>
        );
      })}

      {state.ready && state.formAreaId !== null && (
        <form className="wk-virtual-new" onSubmit={(e) => {
          e.preventDefault();
          const formAreaId = state.formAreaId;
          if (formAreaId === null) return;
          void act('Zakładanie…', async () => {
            if (ring === null || person === null) throw new WorkspaceError('Najpierw podaj hasło.');
            if (name.trim() === '') throw new WorkspaceError('Nazwij obszar — tak zobaczą go prowadzący i osoba.');
            await createVirtualArea(ring, person, partId, formAreaId, name.trim(), level);
            setName('');
            await read(true);
            return 'Dodano. Teraz dodaj role, które mają widzieć obszar każdej osoby.';
          });
        }}>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={busy !== null}
            placeholder="Nowy obszar osoby, np. „Kandydat i prowadzący”" aria-label="Nazwa obszaru" data-virtual-name="" />
          <select value={level} onChange={(e) => setLevel(e.target.value as SubmitterLevel)} disabled={busy !== null} aria-label="Osoba">
            {SUBMITTER_LEVELS.map((one) => <option key={one} value={one}>{SUBMITTER_WORDS[one]}</option>)}
          </select>
          <button type="submit" className="wk-btn" disabled={busy !== null} data-virtual-create="">Dodaj obszar</button>
        </form>
      )}

      {busy !== null && <p className="wk-note" role="status">{busy}</p>}
      {note !== null && busy === null && <p className="wk-note" role="status">{note}</p>}
    </section>
  );
}

export default VirtualAreasSettings;
