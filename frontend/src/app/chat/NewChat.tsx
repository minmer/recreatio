/**
 * Eine neue Rozmowa: für einen Bereich, zu zweit, als Gruppe.
 */

import { useEffect, useState } from 'react';

import { type AreaRow, loadAreas, loadMembers } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import { WorkspaceError } from '../core/session';
import { InviteePicker, KIND, shortId, useKnown } from '../roles/RolePicker';
import { viewPath } from '../routes';
import { Segment } from '../ui/Segment';
import { type ChatRow, type Invitee, loadChats, startAreaChat, startOwnChat } from './chat';
import type { Me } from './chatShared';
import { useT } from '../core/i18n';

/* -- Neu ------------------------------------------------------------------------------ */

type Mode = 'area' | 'channel' | 'direct' | 'group';

export function NewChat({ me }: { me: Me }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>('direct');
  const [channel, setChannel] = useState(false);
  const [chats, setChats] = useState<readonly ChatRow[]>([]);
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  const [areaId, setAreaId] = useState('');
  const [title, setTitle] = useState('');
  const [asRole, setAsRole] = useState(me.roles.find((r) => r.kind === 'person' && me.ring.maySign(r.id))?.id ?? me.roles[0]?.id ?? '');
  const [invitees, setInvitees] = useState<readonly Invitee[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    void loadChats().then((found) => setChats(found.chats)).catch(() => setChats([]));
    void loadAreas().then((found) => setAreas(found.areas)).catch(() => setAreas([]));
  }, []);

  const known = useKnown(me, chats);
  const speakers = me.roles.filter((r) => me.ring.maySign(r.id));
  /*
   * 0080 — ein Bereich hat höchstens eine Rozmowa und einen Kanał, nebeneinander.
   * Die eigenen Bereiche einer Gruppe, eines Gesprächs zu zweit, der Notatki
   * bekommen keinen dazu — sie SIND schon eine Rozmowa.
   *
   * Ein Bereich, der DIESE Art schon hat, bleibt in der Liste und sagt es
   * („kanał już jest"); gewählt, öffnet er sie. Vorher fehlte er still — und
   * die Listen für Kanał und Rozmowa sahen grundlos verschieden aus.
   */
  const forArea = mode === 'area' || mode === 'channel';
  const own = new Set(chats.filter((c) => c.kind === 'group' || c.kind === 'direct' || c.kind === 'self').map((c) => c.areaId));
  const writable = areas.filter((a) => (a.myLevel === 'write' || a.myLevel === 'admin') && !own.has(a.areaId));
  const existing = forArea ? chats.find((c) => c.kind === mode && c.areaId === areaId) : undefined;
  const takenNote = (id: string) => chats.some((c) => c.kind === mode && c.areaId === id)
    ? (mode === 'channel' ? t('chat.new.channelExists') : t('chat.new.chatExists')) : null;

  const go = (chatId: string) => { window.location.hash = viewPath('chat', chatId); };

  const run = async (what: string, todo: () => Promise<void>) => {
    setBusy(what);
    setFailed(null);
    try { await todo(); } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('common.failed'));
    } finally { setBusy(null); }
  };

  const create = () => void run(t('chat.new.creating'), async () => {
    if (forArea) {
      if (areaId === '') throw new WorkspaceError(t('chat.new.pickArea'));
      if (existing !== undefined) { go(existing.chatId); return; }
      /* Welche meiner Rollen dort schreibt — sie legt den Chat an. */
      const { members } = await loadMembers(areaId);
      const writer = members.find((m) => me.ring.has(m.roleId) && (m.capabilities.includes('write') || m.capabilities.includes('admin')));
      if (writer === undefined) throw new WorkspaceError(t('chat.new.noWriter'));
      go(await startAreaChat(areaId, writer.roleId, mode === 'channel'));
      return;
    }

    const role = me.roles.find((r) => r.id === asRole);
    if (role === undefined) throw new WorkspaceError(t('chat.new.pickRole'));

    if (mode === 'direct') {
      if (invitees.length !== 1) throw new WorkspaceError(t('chat.new.pickOne'));

      /* Gibt es sie schon? Dann dorthin — jede Paarung nur einmal. */
      const pair = new Set([role.id, invitees[0].roleId]);
      const existing = chats.find((c) => c.kind === 'direct' && c.members.length === 2 && c.members.every((m) => pair.has(m.roleId)));
      if (existing !== undefined) { go(existing.chatId); return; }
    }

    go(await startOwnChat(me.ring, { role, name: me.names.get(role.id) ?? t('chat.new.me') }, {
      kind: mode, title, invitees, channel: mode === 'group' && channel
    }));
  });

  return (
    <>
      <p><a className="wk-link" href={viewPath('chat')}>{t('chat.new.back')}</a></p>
      <h1 className="wk-h1">{t('chat.list.newChat')}</h1>

      <Segment
        now={mode}
        options={[
          { value: 'direct' as const, label: t('chat.new.modeDirect') },
          { value: 'group' as const, label: t('chat.new.modeGroup') },
          { value: 'area' as const, label: t('chat.new.modeArea') },
          { value: 'channel' as const, label: t('chat.new.modeChannel') }
        ]}
        busy={busy !== null}
        onPick={(next) => { setMode(next); setInvitees([]); setAreaId(''); }}
      />

      <form className="wk-form" onSubmit={(e) => { e.preventDefault(); create(); }}>
        {mode === 'group' && <label><input type="checkbox" checked={channel} onChange={e => setChannel(e.target.checked)} /> {t('chat.new.groupChannel')}</label>}
        {forArea ? (
          <>
            <p className="wk-hint">
              {t(mode === 'channel' ? 'chat.new.areaHintChannel' : 'chat.new.areaHintChat')}
            </p>
            <label className="wk-field">
              <span>{t('chat.new.area')}</span>
              <AreaPick label={t('chat.new.area')} value={areaId} onChange={setAreaId} areas={areas} only={writable} note={takenNote} />
            </label>
            {writable.length === 0 && <p className="wk-empty">{t(mode === 'channel' ? 'chat.new.noAreasChannel' : 'chat.new.noAreasChat')}</p>}
          </>
        ) : (
          <>
            <p className="wk-hint">
              {mode === 'direct'
                ? t('chat.new.directHint')
                : t('chat.new.groupHint')}
            </p>

            {mode === 'group' && (
              <label className="wk-field">
                <span>{t('chat.new.groupName')}</span>
                <input value={title} placeholder={t('chat.new.groupNameHint')} onChange={(e) => setTitle(e.target.value)} />
                <span className="wk-hint">{t('chat.new.groupNameNote')}</span>
              </label>
            )}

            <label className="wk-field">
              <span>{t('chat.new.asRole')}</span>
              <select value={asRole} onChange={(e) => setAsRole(e.target.value)}>
                {speakers.map((r) => (
                  <option key={r.id} value={r.id}>{me.names.get(r.id) ?? `${KIND[r.kind]} · ${shortId(r.id)}`}</option>
                ))}
              </select>
            </label>

            <InviteePicker
              known={known.filter((k) => k.roleId !== asRole)}
              chosen={invitees}
              single={mode === 'direct'}
              busy={busy !== null}
              onChange={setInvitees}
            />
          </>
        )}

        {failed !== null && <p className="wk-error">{failed}</p>}
        {busy !== null && <p className="wk-hint" role="status">{busy}</p>}

        <div className="wk-actions">
          <button type="submit" className="wk-btn" disabled={busy !== null}>
            {mode === 'direct' ? t('chat.new.startDirect') : mode === 'group' ? t('chat.new.createGroup')
              : mode === 'channel' ? (existing !== undefined ? t('chat.new.openChannel') : t('chat.new.createChannel'))
              : existing !== undefined ? t('chat.new.openAreaChat') : t('chat.new.createAreaChat')}
          </button>
        </div>
      </form>
    </>
  );
}
