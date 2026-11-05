/**
 * Jemanden in einen Bereich holen: eine Person, eine Gruppe, eine Rolle — mit welcher Stufe.
 */

import { useEffect, useState } from 'react';

import { areaKeys, looksLikeCode, roleCard, setMemberName } from '../chat/chat';
import type { Ring, SealedRole } from '../core/keys';
import { WorkspaceError } from '../core/session';
import type { Called } from '../roles/called';
import { type RoleGraphData, createRole, loadRoles } from '../roles/roles';
import { useT } from '../core/i18n';
import { Segment } from '../ui/Segment';
import { type AreaRow, type Member, joinArea } from './area';
import { KIND_NAME } from './areaWords';

/* -- Eine Rolle dazunehmen -------------------------------------------------- */

type Level = 'read' | 'write' | 'admin';

/**
 * Eine Rolle in DIESEN Bereich — eine neue oder eine, die ich schon habe.
 *
 * <b>Jeder Bereich hat seine eigenen Rollen.</b> Die übliche Bewegung ist
 * deshalb nicht „such dir aus dem Graphen etwas", sondern „leg hier an, was
 * dieser Bereich braucht" — Katecheci, Animatorzy, Rada. Die neue Rolle hält
 * die eigene Person; wer sie später übernimmt, bekommt sie im Rollengraphen.
 *
 * <b>Unterschrieben von der Rolle, die hier hineinlässt</b> — nicht von
 * irgendeiner meiner Rollen. Das Zertifikat nennt, wer die Tür aufgemacht
 * hat, und das soll dieselbe Rolle sein, die dazu befugt ist.
 */
export function AddRole({ area, ring, graph, self, members, names, busy, onAct }: {
  area: AreaRow;
  ring: Ring;
  graph: RoleGraphData;
  self: SealedRole | null;
  members: readonly Member[];
  names: ReadonlyMap<string, Called>;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<'new' | 'mine' | 'code'>('new');
  const [code, setCode] = useState('');
  const [codeName, setCodeName] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'role' | 'group'>('role');
  const [pick, setPick] = useState('');
  const [level, setLevel] = useState<Level>('write');
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    let alive = true;
    void ring.names().then((read) => { if (alive) setLabels(read); });
    return () => { alive = false; };
  }, [ring]);

  const present = new Set(members.map((m) => m.roleId));
  const candidates = graph.roles.filter((r) => !r.isPersonal && ring.has(r.id) && !present.has(r.id));
  const chosen = candidates.find((r) => r.id === pick) ?? candidates[0] ?? null;

  /* Wer hier hineinlässt: `certify`, oder `admin`, das es einschliesst. */
  const issuer = members.find((m) =>
    (m.capabilities.includes('admin') || m.capabilities.includes('certify')) && ring.maySign(m.roleId))?.roleId ?? null;

  const blocker =
    issuer === null ? t('areas.addRole.noIssuer')
    : from === 'new' && self === null ? t('areas.noPerson')
    : from === 'new' && name.trim() === '' ? t('areas.addRole.nameIt')
    : from === 'mine' && chosen === null ? t('areas.addRole.allHere')
    : from === 'code' && !looksLikeCode(code) ? t('areas.addRole.pasteCode')
    : from === 'code' && codeName.trim() === '' ? t('areas.addRole.nameCode')
    : null;

  if (!open) {
    return (
      <button type="button" className="wk-tree-add" disabled={busy} onClick={() => setOpen(true)}>
        <span aria-hidden="true">+</span> {t('areas.addRole.title')}
      </button>
    );
  }

  const add = async () => {
    if (blocker !== null || issuer === null) return;

    let done = false;

    await onAct(from === 'new' ? t('areas.addRole.computing') : t('areas.adding'), async () => {
      /*
       * KTOŚ Z INNEGO KONTA — po jego kodzie do rozmów (0052). Dostaje klucz
       * obszaru i zaświadczenie jak każda rola, a nazwa, pod którą go
       * wpisujesz, zostaje zapieczętowana kluczem obszaru.
       */
      if (from === 'code') {
        const card = await roleCard(code);
        if (present.has(card.roleId)) throw new WorkspaceError(t('areas.addRole.already'));
        await joinArea(ring, area.areaId, { id: card.roleId, kind: card.kind, wrapPublicKey: card.wrapPublicKey }, issuer, level);
        await setMemberName(area.areaId, await areaKeys(ring, area.areaId, true), card.roleId, codeName, issuer).catch(() => undefined);
        setCode('');
        setCodeName('');
        done = true;
        return;
      }

      let role: SealedRole;

      if (from === 'new') {
        if (self === null) return;
        const { id } = await createRole(ring, self, { kind, name });
        const made = (await loadRoles()).roles.find((r) => r.id === id);
        if (made === undefined) throw new WorkspaceError(t('areas.addRole.notYetVisible'));
        role = made;
      } else {
        if (chosen === null) return;
        role = chosen;
      }

      await joinArea(ring, area.areaId, role, issuer, level);
      done = true;
    });

    if (done) {
      setName('');
      setPick('');
      setOpen(false);
    }
  };

  const who = (id: string) => names.get(id)?.name ?? labels.get(id) ?? t('areas.noName');

  return (
    <form className="wk-form wk-add-role" onSubmit={(e) => { e.preventDefault(); void add(); }}>
      <h3 className="wk-h2">{t('areas.addRole.title')}</h3>

      <Segment
        now={from}
        options={[
          { value: 'new' as const, label: t('areas.addRole.fromNew') },
          { value: 'mine' as const, label: t('areas.addRole.fromMine') },
          { value: 'code' as const, label: t('areas.addRole.fromCode') }
        ]}
        busy={busy}
        onPick={setFrom}
      />

      {from === 'new' ? (
        <>
          <label className="wk-field">
            <span>{t('common.name')}</span>
            <input value={name} placeholder={t('areas.addRole.namePlaceholder')} autoComplete="off"
              onChange={(e) => setName(e.target.value)} />
          </label>

          <div className="wk-field">
            <span>{t('areas.addRole.kind')}</span>
            <Segment
              now={kind}
              options={[
                { value: 'role' as const, label: t('areas.addRole.kindRole') },
                { value: 'group' as const, label: t('areas.addRole.kindGroup') }
              ]}
              busy={busy}
              onPick={setKind}
            />
          </div>

          {self !== null && (
            <p className="wk-hint">{t('areas.addRole.heldBy', { name: who(self.id) })}</p>
          )}
        </>
      ) : from === 'code' ? (
        <>
          <label className="wk-field">
            <span>{t('areas.addRole.code')}</span>
            <input value={code} placeholder={t('areas.addRole.codePlaceholder')} autoComplete="off" onChange={(e) => setCode(e.target.value)} />
            <span className="wk-hint">{t('areas.addRole.codeHint')}</span>
          </label>
          <label className="wk-field">
            <span>{t('areas.addRole.codeName')}</span>
            <input value={codeName} placeholder={t('areas.addRole.codeNamePlaceholder')} autoComplete="off" onChange={(e) => setCodeName(e.target.value)} />
            <span className="wk-hint">{t('areas.addRole.codeNameHint')}</span>
          </label>
        </>
      ) : candidates.length > 0 ? (
        <label className="wk-field">
          <span>{t('areas.addRole.role')}</span>
          <select value={chosen?.id ?? ''} onChange={(e) => setPick(e.target.value)}>
            {candidates.map((r) => (
              <option key={r.id} value={r.id}>{who(r.id)} · {KIND_NAME[r.kind]}</option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="wk-field">
        <span>{t('areas.addRole.level')}</span>
        <Segment
          now={level}
          options={[
            { value: 'read' as const, label: t('areas.addRole.levelRead') },
            { value: 'write' as const, label: t('areas.addRole.levelWrite') },
            { value: 'admin' as const, label: t('areas.addRole.levelAdmin') }
          ]}
          busy={busy}
          onPick={setLevel}
        />
        {level === 'admin' && <span className="wk-hint">{t('areas.addRole.adminHint')}</span>}
      </div>

      {blocker !== null && !busy && <p className="wk-blocker">{blocker}</p>}

      <div className="wk-actions">
        <button type="submit" className="wk-btn" disabled={busy || blocker !== null}>{t('common.add')}</button>
        <button type="button" className="wk-link-btn" disabled={busy} onClick={() => setOpen(false)}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}
