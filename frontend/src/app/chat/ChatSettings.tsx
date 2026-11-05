/**
 * Die Einstellungen einer Rozmowy: wer darin ist, wer schreibt, und die Menschen mit Link.
 */

import { useEffect, useState } from 'react';

import { dropFromArea } from '../areas/area';
import { othersWrite } from '../areas/audience';
import { AudienceForms } from '../areas/AudienceForms';
import { WorkspaceError } from '../core/session';
import { InviteePicker, KIND, nameOf, useKnown } from '../roles/RolePicker';
import { viewPath } from '../routes';
import { askText } from '../ui/dialogs';
import { type ChatDetail, type ChatRow, type Invitee, addToChat, chatMode, loadChats, setMemberName } from './chat';
import type { Me } from './chatShared';
import { useT } from '../core/i18n';

/* -- Einstellungen ----------------------------------------------------------------- */

const LEVEL: Record<string, string> = { admin: 'chat.settings.level.admin', write: 'chat.settings.level.write', read: 'chat.settings.level.read', certify: 'chat.settings.level.certify' };

export function ChatSettings({ me, chat, names, keys, onChanged }: {
  me: Me;
  chat: ChatDetail;
  names: ReadonlyMap<string, string>;
  keys: ReadonlyMap<number, Uint8Array>;
  onChanged: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [adding, setAdding] = useState<readonly Invitee[]>([]);
  const [chats, setChats] = useState<readonly ChatRow[]>([]);
  const myWriter = chat.writers[0] ?? null;
  const [myName, setMyName] = useState(myWriter === null ? '' : names.get(myWriter) ?? me.names.get(myWriter) ?? '');

  useEffect(() => { void loadChats().then((found) => setChats(found.chats)).catch(() => undefined); }, []);
  const known = useKnown(me, chats).filter((k) => !chat.members.some((m) => m.roleId === k.roleId));

  const issuer = chat.certifiers.find((id) => me.ring.maySign(id)) ?? null;

  const run = async (what: string, todo: () => Promise<string>) => {
    setBusy(what);
    setFailed(null);
    setDone(null);
    try {
      setDone(await todo());
      onChanged();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('common.failed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="wk-chat-settings">
      <p className="wk-hint">
        {chat.kind === 'area'
          ? t('chat.settings.aboutArea')
          : chat.kind === 'channel'
            ? t('chat.settings.aboutChannel')
          : chat.kind === 'seat'
            ? t('chat.settings.aboutSeat')
          : t('chat.settings.aboutOwn')}
        {' '}<a className="wk-link" href={viewPath('areas', chat.areaId)}>{t('chat.settings.area')}</a>
      </p>

      <h2 className="wk-h2">{t('chat.settings.members')}</h2>
      <ul className="wk-list">
        {chat.members.map((m) => {
          const mine = me.ring.has(m.roleId);
          return (
            <li key={m.roleId} className="wk-row">
              <span>
                <strong>{nameOf(m.roleId, m.kind, names, me.names)}</strong>
                <span className="wk-row-side"> · {KIND[m.kind] ?? m.kind} · {m.capabilities.map((c) => (LEVEL[c] !== undefined ? t(LEVEL[c]) : c)).join(', ')}{mine ? ` · ${t('chat.askSetup.isYou')}` : ''}</span>
              </span>
              {issuer !== null && !mine && chat.kind !== 'direct' && (
                <button type="button" className="wk-link-btn wk-danger" disabled={busy !== null}
                  onClick={async () => {
                    if (!(await askText(t('chat.settings.removeAsk', { name: nameOf(m.roleId, m.kind, names, me.names) })))) return;
                    void run(t('chat.askSetup.removing'), async () => (await dropFromArea(chat.areaId, m.roleId)).note);
                  }}>
                  {t('common.remove')}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* 0080 — die Formulare dieses Zugangs: wer sie ausgefüllt hat, ist dabei (`AudienceForms`, für jedes Ding dasselbe). */}
      {(chat.kind === 'area' || chat.kind === 'channel') && chat.forms !== undefined && (
        <AudienceForms kind="chat" subjectId={chat.chatId} mode={chat.kind === 'channel' ? 'channel' : 'together'} forms={chat.forms}
          byRoleId={chat.members.find((m) => me.ring.has(m.roleId) && (m.capabilities.includes('write') || m.capabilities.includes('admin')))?.roleId ?? null}
          what={chat.kind === 'channel' ? t('chat.settings.thisChannel') : t('chat.settings.thisChat')} onChanged={onChanged} />
      )}
      {(chat.kind === 'area' || chat.kind === 'channel') && <LinkPeople chat={chat} />}

      {issuer !== null && chat.kind !== 'direct' && (
        <form className="wk-form" onSubmit={(e) => {
          e.preventDefault();
          void run(t('chat.askSetup.adding'), async () => {
            for (const one of adding) await addToChat(me.ring, chat, one, issuer, chat.kind === 'channel' || chat.postingPolicy === 'writers' ? 'read' : 'write');
            const said = t('chat.settings.added', { names: adding.map((a) => a.name).join(', ') });
            setAdding([]);
            return said;
          });
        }}>
          <InviteePicker known={known} chosen={adding} single={false} busy={busy !== null} onChange={setAdding} />
          {adding.length > 0 && (
            <div className="wk-actions">
              <button type="submit" className="wk-btn" disabled={busy !== null}>{t('chat.settings.add')}</button>
            </div>
          )}
        </form>
      )}

      {myWriter !== null && (
        <form className="wk-form" onSubmit={(e) => {
          e.preventDefault();
          void run(t('common.saving'), async () => {
            await setMemberName(chat.areaId, keys, myWriter, myName, myWriter);
            return t('chat.settings.nameSaved');
          });
        }}>
          <label className="wk-field">
            <span>{t('chat.settings.myName')}</span>
            <input value={myName} onChange={(e) => setMyName(e.target.value)} />
            <span className="wk-hint">{t('chat.settings.myNameHint')}</span>
          </label>
          <div className="wk-actions">
            <button type="submit" className="wk-btn wk-btn-quiet" disabled={busy !== null || myName.trim() === ''}>{t('common.save')}</button>
          </div>
        </form>
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}
      {done !== null && <p className="wk-done">{done}</p>}
      {busy !== null && <p className="wk-hint" role="status">{busy}</p>}
    </section>
  );
}

/**
 * DIE MENSCHEN MIT LINK — wer über ein Formular in den Bereich kam und damit
 * in dieser Rozmowa mitschreibt (0053). Hinzugefügt wird hier niemand: wer
 * einen Link zu diesem Bereich hat, ist dabei; wer ihn nicht mehr haben soll,
 * dem nimmt die Kanzlei den Link.
 */
function LinkPeople({ chat }: { chat: ChatDetail }) {
  const t = useT();
  const mode = chatMode(chat.kind);
  const writes = mode !== null && othersWrite(mode);
  if (chat.seats.length === 0) {
    return (
      <p className="wk-hint">
        {t(writes ? 'chat.settings.noSeatsWrite' : 'chat.settings.noSeatsRead')}
      </p>
    );
  }

  const state = (one: ChatDetail['seats'][number]) =>
    one.wrapPublicKey === null ? t('chat.settings.seatNotOpened')
    : one.epochs.includes(chat.currentEpoch) ? t('chat.settings.seatHasAccess')
    : t('chat.settings.seatWaiting');

  return (
    <>
      <h2 className="wk-h2">{t('chat.settings.seats', { count: chat.seats.length })}</h2>
      <p className="wk-hint">
        {t(writes ? 'chat.settings.seatsHintWrite' : 'chat.settings.seatsHintRead')}
      </p>
      <ul className="wk-list">
        {chat.seats.map((one, i) => (
          <li key={one.seatId} className="wk-row">
            <span>
              <strong>{one.name ?? t('chat.settings.seatN', { n: i + 1 })}</strong>
              <span className="wk-row-side"> · {state(one)}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
