/**
 * Die Liste der Rozmowy — neueste zuerst, „Notatki" oben —, der Willkommensgruss und „Mój kod do rozmów".
 */

import { useCallback, useEffect, useState } from 'react';

import { type AreaRow, loadAreas, loadMembers } from '../areas/area';
import { ensurePrivateArea } from '../calendar/agenda';
import { plural } from '../core/plural';
import { useRemembered } from '../core/prefs';
import { WorkspaceError } from '../core/session';
import { KIND, shortId } from '../roles/RolePicker';
import { viewPath } from '../routes';
import { Modal } from '../ui/Modal';
import { CHATS_CHANGED, type ChatRow, deliverPending, loadChats, startSelfChat } from './chat';
import { CommonPreferencesDialog } from './ChatExtras';
import { Avatar, Icon, type MenuItem, PopMenu, listTime, useButtonMenu } from './ChatKit';
import { type Me, chatTitles, useAreas } from './chatShared';

/* -- Die Liste --------------------------------------------------------------------- */

/** Wie ein Chat in der Liste heisst (`chatTitles`) — neu, wenn sich die Liste ändert, nicht bei jedem Zeichnen. */
function useTitles(me: Me, chats: readonly ChatRow[], areas: readonly AreaRow[]): ReadonlyMap<string, string> {
  const [titles, setTitles] = useState<ReadonlyMap<string, string>>(new Map());
  const key = chats.map((c) => c.chatId).join(',') + '|' + areas.length;

  useEffect(() => {
    let alive = true;
    void chatTitles(me, chats, areas).then((out) => { if (alive) setTitles(out); });
    return () => { alive = false; };
  }, [key]);

  return titles;
}

/** Zu zweit das Gesicht der anderen Seite — dieselbe Farbe wie an ihren Nachrichten. */
const seedOf = (me: Me, chat: Pick<ChatRow, 'chatId' | 'kind' | 'members'>) =>
  chat.kind === 'direct' ? chat.members.find((m) => !me.ring.has(m.roleId))?.roleId ?? chat.chatId : chat.chatId;

const titleOfSeatArea = (chat: ChatRow) => chat.areaName;

const kindText = (chat: ChatRow) => {
  const n = chat.members.length;
  const people = `${n} ${plural(n, 'osoba', 'osoby', 'osób')}`;
  if (chat.kind === 'direct') return 'rozmowa we dwoje';
  if (chat.kind === 'seat') return `osoba z formularza · ${titleOfSeatArea(chat)}`;
  if (chat.kind === 'group') return `grupa · ${people}`;
  const linked = chat.seats > 0 ? ` · ${chat.seats} z linkiem` : '';
  return `${chat.kind === 'channel' ? 'kanał' : 'obszar'} · ${people}${linked}`;
};

export function ChatList({ me, current }: { me: Me; current: string | undefined }) {
  const [archived, setArchived] = useState(false);
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<'prefs' | 'codes' | null>(null);
  const [opening, setOpening] = useState(false);
  const [chats, setChats] = useState<readonly ChatRow[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const areas = useAreas();
  const more = useButtonMenu();

  const look = useCallback(async () => {
    try {
      /*
       * Gemeldet wird hier nicht mehr (0076): `notify.ts` meldet jede Rozmowa —
       * in der App mit Inhalt und Antwortfeld. Eine Meldung von hier trüge
       * dieselbe Marke und ersetzte die mit Inhalt durch eine ohne.
       */
      const found = (await loadChats()).chats;
      setChats(found);
      setFailed(null);

      /* Wer mit Link auf seinen Schlüssel wartet, bekommt ihn jetzt — leise, im Hintergrund. */
      void deliverPending(me.ring, found);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać rozmów.');
    }
  }, [me.ring]);

  useEffect(() => {
    void look();
    const timer = window.setInterval(() => { void look(); }, 20_000);
    /* 0105 — eine Rozmowa wurde gelöscht: gleich neu, nicht erst in 20 Sekunden. */
    const changed = () => { void look(); };
    window.addEventListener(CHATS_CHANGED, changed);
    return () => { window.clearInterval(timer); window.removeEventListener(CHATS_CHANGED, changed); };
  }, [look]);

  /* Eine Rozmowa geöffnet: ihre Zahl der neuen stimmt gleich danach nicht mehr. */
  useEffect(() => {
    if (current === undefined) return undefined;
    const timer = window.setTimeout(() => { void look(); }, 1500);
    return () => window.clearTimeout(timer);
  }, [current, look]);

  const titles = useTitles(me, chats ?? [], areas);
  const self = chats?.find((c) => c.kind === 'self');
  const others = (chats ?? []).filter((c) => c.kind !== 'self');
  const inArchive = others.filter((c) => c.preferences?.archived === true);
  const needle = query.trim().toLocaleLowerCase('pl-PL');
  const fits = (title: string) => needle === '' || title.toLocaleLowerCase('pl-PL').includes(needle);
  const rows = (archived ? inArchive : others.filter((c) => c.preferences?.archived !== true))
    .filter((c) => fits(titles.get(c.chatId) ?? c.areaName));

  /*
   * 0101 — GRUPPIERT. Die Rozmowy mit Menschen aus einem Formular („Rozmowa z: …")
   * stehen je Bereich der Prowadzący unter EINER Zeile, wie ein Thema: zugeklappt
   * mit der Zahl der neuen, aufgeklappt die Menschen. Beim Suchen steht alles
   * einzeln da; die geöffnete Rozmowa klappt ihre Gruppe von selbst auf.
   */
  const [openGroups, setOpenGroups] = useRemembered('chat.groups.open', '');
  const opened = new Set(openGroups.split(',').filter((one) => one !== ''));
  const toggleGroup = (key: string) => {
    const next = new Set(opened);
    if (next.has(key)) next.delete(key); else next.add(key);
    setOpenGroups([...next].join(','));
  };
  type Entry = { readonly kind: 'chat'; readonly chat: ChatRow } | { readonly kind: 'group'; readonly key: string; readonly title: string; readonly chats: ChatRow[] };
  const entries: Entry[] = [];
  {
    const seatsByArea = new Map<string, ChatRow[]>();
    for (const chat of rows) if (chat.kind === 'seat') seatsByArea.set(chat.areaId, [...(seatsByArea.get(chat.areaId) ?? []), chat]);
    const placed = new Set<string>();
    for (const chat of rows) {
      const group = chat.kind === 'seat' && needle === '' ? seatsByArea.get(chat.areaId) ?? [] : [];
      if (group.length < 2) { entries.push({ kind: 'chat', chat }); continue; }
      if (placed.has(chat.areaId)) continue;
      placed.add(chat.areaId);
      entries.push({ kind: 'group', key: `seat:${chat.areaId}`, title: titleOfSeatArea(chat), chats: group });
    }
  }

  /* NOTATKI — beim ersten Mal entstehen der eigene Bereich (falls nötig) und die Rozmowa darin. */
  const openSelf = async () => {
    const person = me.roles.find((r) => r.kind === 'person' && me.ring.maySign(r.id));
    if (person === undefined) { setFailed('Notatki prowadzi osoba — to konto nie ma jeszcze osoby.'); return; }
    setOpening(true);
    setFailed(null);
    try {
      const areaId = await ensurePrivateArea(me.ring, person, areas.length > 0 ? areas : (await loadAreas()).areas);
      const { members } = await loadMembers(areaId);
      const owner = members.find((m) => m.kind === 'person' && me.ring.maySign(m.roleId))?.roleId ?? person.id;
      const chatId = await startSelfChat(areaId, owner);
      window.location.hash = viewPath('chat', chatId);
      void look();
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć notatek.');
    } finally {
      setOpening(false);
    }
  };

  /* Eine Rozmowa in der Liste — in einer Gruppe ohne „Rozmowa z:" und ohne den Bereich (der steht an der Gruppe). */
  const chatItem = (chat: ChatRow, nested: boolean) => {
    const full = titles.get(chat.chatId) ?? chat.areaName;
    const title = nested && chat.kind === 'seat' ? chat.seatName ?? 'osoba z formularza' : full;
    const here = current === chat.chatId;
    return (
      <a className={`ch-item${nested ? ' is-nested' : ''}${here ? ' is-current' : ''}${chat.unread > 0 ? ' is-unread' : ''}`} href={viewPath('chat', chat.chatId)}
        aria-current={here ? 'page' : undefined}>
        <Avatar seed={seedOf(me, chat)} name={title} size={nested ? 'sm' : 'md'} />
        <span className="ch-item-main">
          <span className="ch-item-top">
            <strong className="ch-item-title">{title}</strong>
            {chat.lastMessageAt !== null && <time className="ch-item-time" dateTime={chat.lastMessageAt}>{listTime(chat.lastMessageAt)}</time>}
          </span>
          {(!nested || chat.unread > 0 || chat.preferences?.muted === true) && (
            <span className="ch-item-bottom">
              {!nested && <span className="ch-item-sub">{kindText(chat)}</span>}
              {nested && <span className="ch-item-sub" />}
              {chat.preferences?.muted === true && <span className="ch-item-muted"><Icon name="bell-off" label="wyciszona" /></span>}
              {chat.unread > 0 && <span className="ch-badge" aria-label={`${chat.unread} nowych`}>{chat.unread}</span>}
            </span>
          )}
        </span>
      </a>
    );
  };

  const menu: MenuItem[] = [
    { label: 'Nowa rozmowa', icon: 'compose', onSelect: () => { window.location.hash = viewPath('chat', 'nowa'); } },
    { label: 'Notatki', icon: 'bookmark', onSelect: () => { if (self !== undefined) window.location.hash = viewPath('chat', self.chatId); else void openSelf(); } },
    { label: inArchive.length > 0 ? `Archiwum (${inArchive.length})` : 'Archiwum', icon: 'archive', checked: archived, onSelect: () => setArchived(!archived) },
    { label: 'Moja dostępność i powiadomienia', icon: 'bell', onSelect: () => setPanel('prefs') },
    { label: 'Twój kod do rozmów', icon: 'hash', onSelect: () => setPanel('codes') }
  ];

  const selfRow = (
    <>
      <Avatar seed="self" name="Notatki" icon="bookmark" />
      <span className="ch-item-main">
        <span className="ch-item-top">
          <strong className="ch-item-title">Notatki</strong>
          {self?.lastMessageAt != null && <time className="ch-item-time">{listTime(self.lastMessageAt)}</time>}
        </span>
        <span className="ch-item-bottom">
          <span className="ch-item-sub">{opening ? 'Zakładanie…' : 'Wiadomości do siebie — tylko Ty je widzisz'}</span>
          {self !== undefined && self.unread > 0 && <span className="ch-badge">{self.unread}</span>}
        </span>
      </span>
    </>
  );

  return (
    <aside className="ch-side" aria-label="Lista rozmów">
      <div className="ch-side-head">
        {archived && (
          <button type="button" className="ch-icon-btn" aria-label="Wróć do rozmów" onClick={() => setArchived(false)}><Icon name="back" /></button>
        )}
        <h1 className="ch-side-title">{archived ? 'Archiwum' : 'Rozmowy'}</h1>
        <a className="ch-icon-btn" href={viewPath('chat', 'nowa')} aria-label="Nowa rozmowa" title="Nowa rozmowa"><Icon name="compose" /></a>
        <button type="button" className="ch-icon-btn" aria-label="Więcej" title="Więcej" aria-haspopup="menu" aria-expanded={more.open !== null}
          onClick={(e) => more.toggle(e.currentTarget)}>
          <Icon name="more" />
        </button>
        {more.open !== null && <PopMenu anchor={{ rect: more.open.rect }} from={more.open.from} label="Rozmowy" items={menu} onClose={more.close} />}
      </div>

      <label className="ch-side-search">
        <Icon name="search" />
        <input type="search" value={query} placeholder="Szukaj rozmowy" aria-label="Szukaj rozmowy" onChange={(e) => setQuery(e.target.value)} />
      </label>

      {failed !== null && <p className="ch-bar is-error" role="alert">{failed}</p>}

      <ul className="ch-list">
        {!archived && fits('Notatki') && (
          <li>
            {self !== undefined ? (
              <a className={`ch-item is-self${current === self.chatId ? ' is-current' : ''}`} href={viewPath('chat', self.chatId)}
                aria-current={current === self.chatId ? 'page' : undefined}>
                {selfRow}
              </a>
            ) : (
              <button type="button" className="ch-item is-self" disabled={opening} onClick={() => void openSelf()}>{selfRow}</button>
            )}
          </li>
        )}

        {!archived && inArchive.length > 0 && needle === '' && (
          <li>
            <button type="button" className="ch-item is-archive" onClick={() => setArchived(true)}>
              <span className="ch-ava is-md is-icon is-plain" aria-hidden="true"><Icon name="archive" /></span>
              <span className="ch-item-main">
                <span className="ch-item-top"><strong className="ch-item-title">Zarchiwizowane</strong><span className="ch-item-time">{inArchive.length}</span></span>
              </span>
            </button>
          </li>
        )}

        {chats === null && <li className="ch-list-note">Wczytywanie…</li>}
        {chats !== null && rows.length === 0 && (
          <li className="ch-list-note">
            {needle !== '' ? 'Żadna rozmowa nie pasuje.' : archived ? 'Archiwum jest puste.' : 'Nie masz jeszcze żadnej rozmowy — zacznij nową.'}
          </li>
        )}

        {entries.map((entry) => {
          if (entry.kind === 'chat') return <li key={entry.chat.chatId}>{chatItem(entry.chat, false)}</li>;
          const unread = entry.chats.reduce((sum, c) => sum + c.unread, 0);
          const last = entry.chats.map((c) => c.lastMessageAt).filter((at): at is string => at !== null).sort().pop() ?? null;
          const inside = entry.chats.some((c) => c.chatId === current);
          const open = opened.has(entry.key) || inside;
          return (
            <li key={entry.key} className="ch-group">
              <button type="button" className={`ch-item is-group${unread > 0 ? ' is-unread' : ''}`} aria-expanded={open} data-chat-group={entry.key}
                onClick={() => toggleGroup(entry.key)}>
                <span className="ch-ava is-md is-icon is-plain" aria-hidden="true"><Icon name="users" /></span>
                <span className="ch-item-main">
                  <span className="ch-item-top">
                    <strong className="ch-item-title">{entry.title}</strong>
                    {last !== null && <time className="ch-item-time" dateTime={last}>{listTime(last)}</time>}
                  </span>
                  <span className="ch-item-bottom">
                    <span className="ch-item-sub">osoby z formularza · {entry.chats.length} {plural(entry.chats.length, 'rozmowa', 'rozmowy', 'rozmów')}</span>
                    {unread > 0 && <span className="ch-badge" aria-label={`${unread} nowych`}>{unread}</span>}
                    <span className={`ch-group-arrow${open ? ' is-open' : ''}`} aria-hidden="true"><Icon name="chevron" /></span>
                  </span>
                </span>
              </button>
              {open && (
                <ul className="ch-group-list">
                  {entry.chats.map((chat) => <li key={chat.chatId}>{chatItem(chat, true)}</li>)}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <p className="ch-side-foot"><Icon name="lock" /> Treść szyfruje Twoja przeglądarka — serwer jej nie czyta.</p>

      {panel === 'prefs' && <CommonPreferencesDialog onClose={() => setPanel(null)} />}
      {panel === 'codes' && (
        <Modal title="Twój kod do rozmów" onClose={() => setPanel(null)}>
          <MyCodes me={me} bare />
        </Modal>
      )}
    </aside>
  );
}

/** Rechts, solange keine Rozmowa offen ist — nur auf breitem Schirm zu sehen. */
export function ChatWelcome({ me }: { me: Me }) {
  return (
    <div className="ch-welcome">
      <span className="ch-welcome-ic"><Icon name="lock" /></span>
      <h2 className="ch-welcome-title">Wybierz rozmowę</h2>
      <p className="ch-welcome-text">
        Każda rozmowa należy do obszaru: kto ma dostęp do obszaru, jest w rozmowie. Treść szyfruje Twoja
        przeglądarka — serwer jej nie czyta.
      </p>
      <a className="wk-btn" href={viewPath('chat', 'nowa')}>Nowa rozmowa</a>
      <MyCodes me={me} />
    </div>
  );
}

/**
 * MÓJ KOD DO ROZMÓW — Kennung meiner Person (oder Rolle). Wer ihn bekommt,
 * kann mich in eine Rozmowa nehmen: der Dienst gibt dazu nur meinen
 * öffentlichen Schlüssel heraus.
 */
function MyCodes({ me, bare = false }: { me: Me; bare?: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const shown = me.roles.filter((r) => all || r.kind === 'person');

  const copy = async (id: string) => {
    try { await navigator.clipboard.writeText(id); setCopied(id); } catch { /* steht ja da */ }
  };

  return (
    <section className="wk-chat-codes">
      {!bare && <h2 className="wk-h2">Twój kod do rozmów</h2>}
      <p className="wk-hint">
        Podaj go komuś, kto chce Cię dodać do rozmowy. Kod nie otwiera niczego — pozwala tylko zaprosić.
      </p>
      <ul className="wk-list">
        {shown.map((r) => (
          <li key={r.id} className="wk-row">
            <span>
              <strong>{me.names.get(r.id) ?? `${KIND[r.kind]} · ${shortId(r.id)}`}</strong>
              {' '}<code className="wk-chat-code">{r.id}</code>
            </span>
            <button type="button" className="wk-link-btn" onClick={() => void copy(r.id)}>
              {copied === r.id ? 'Skopiowano' : 'Kopiuj'}
            </button>
          </li>
        ))}
      </ul>
      {me.roles.some((r) => r.kind !== 'person') && (
        <button type="button" className="wk-link-btn" onClick={() => setAll(!all)}>
          {all ? 'Tylko osoby' : 'Pokaż też kody moich ról (np. kancelarii)'}
        </button>
      )}
    </section>
  );
}
