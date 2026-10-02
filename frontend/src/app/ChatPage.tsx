/**
 * ROZMOWY (0052) — die Oberfläche.
 *
 * <code>
 *   #/workspace/chat            meine Rozmowy, neueste zuerst, und mein Kod do rozmów
 *   #/workspace/chat/nowa       eine neue: für einen Bereich, zu zweit, als Gruppe
 *   #/workspace/chat/{id}       eine Rozmowa — Nachrichten, Schreiben, Einstellungen
 * </code>
 *
 * <b>Wer im Chat ist, ist im Bereich</b> — und umgekehrt. Die Einstellungen
 * hier und die Seite des Bereichs unter „Obszary" sind zwei Türen zu
 * denselben Schlüsseln und Zertifikaten (`chat.ts`).
 *
 * <b>In der Rozmowa eines Bereichs schreiben auch die Menschen mit Link</b>
 * (0053). Wer sie hier öffnet, gibt ihnen nebenbei den Chatschlüssel weiter —
 * sie selbst können niemanden darum bitten.
 *
 * <b>0062 — wie eine Chat-App.</b> Auf breitem Schirm links die Liste, rechts
 * die Rozmowa; schmal das eine oder das andere. Oben in der Liste „Notatki":
 * die Rozmowa mit sich selbst, im eigenen Bereich (`startSelfChat`).
 */

import { CommonPreferencesDialog, ForwardDialog, useChatExtras } from './ChatExtras';
import {
  Avatar, ChatHeader, ChatLog, Composer, Icon, lastEditable, listTime, plural, PopMenu, SendAs, useButtonMenu, useChatChrome,
  withDelete, withEdit, type ComposerHandle, type MenuItem, type MessageHandlers, type MessageRules, type ReplyTarget, type Shown
} from './ChatKit';
import { chatEndpoint, reportChatSeen } from './chatFeatures';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { ensurePrivateArea } from './agenda';
import { areaPath, dropFromArea, loadAreas, loadMembers, type AreaRow } from './area';
import { AreaOptions } from './AreaOptions';
import { Segment } from './Areas';
import {
  addToChat, areaKeys, authorOf, chatKeysOf, deleteMessage, deliverPending, deliverSeatKeys, editMessage, loadChat, loadChats,
  loadMessages, loadVersions, looksLikeCode, markRead, openMessage, openNames, openVersion, restoreMessage, roleCard,
  sendMessage, setMemberName, startAreaChat, startOwnChat, startSelfChat,
  type ChatDetail, type ChatRow, type Invitee, type Opened, type SealedMessage, type SealedVersion, type SendOptions
} from './chat';
import { HistoryDialog } from './MessageBits';
import { Modal } from './Modal';
import type { Ring, SealedRole } from './keys';
import { keysFor } from './ringOf';
import { useRemembered } from './prefs';
import { myRoleNames } from './roleNames';
import { viewPath } from './routes';
import { WorkspaceError, type Who } from './session';
import { loadCalendars, type CalendarRow } from './calendar';
import { createTopic, loadTopics, moveToTopic, openTopics, titleFrom, type Topic } from './chatTopics';
import { EventDialog } from './EventDialog';
import type { Me as Person } from './me';
import { TaskDialog } from './TaskDialog';
import { LinkedDialog, MoveToTopic, TopicBar } from './TopicBar';

/* -- Gemeinsam ----------------------------------------------------------------- */

interface Me {
  readonly ring: Ring;
  readonly roles: readonly SealedRole[];
  readonly names: ReadonlyMap<string, string>;
}

/** Schlüsselbund und eigene Rollen — einmal je Ansicht. */
function useMe(who: Who): Me | null | undefined {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { ring, graph } = await keysFor(who);
        if (ring === null) { if (alive) setMe(null); return; }
        const names = await myRoleNames(who).catch(() => new Map<string, string>());
        if (alive) setMe({ ring, roles: graph.roles.filter((r) => r.kind !== 'account' && ring.has(r.id)), names });
      } catch {
        if (alive) setMe(null);
      }
    })();
    return () => { alive = false; };
  }, [who]);

  return me;
}

const KIND: Record<string, string> = { person: 'osoba', role: 'rola', group: 'grupa', account: 'konto' };

const shortId = (id: string) => id.slice(0, 8);

/** Wie ein Mitglied heisst: sein Name in diesem Bereich, sonst meiner für meine Rollen, sonst Art und Kennung. */
const nameOf = (roleId: string, kind: string | undefined, names: ReadonlyMap<string, string>, mine: ReadonlyMap<string, string>) =>
  names.get(roleId) ?? mine.get(roleId) ?? `${KIND[kind ?? 'person'] ?? 'osoba'} · ${shortId(roleId)}`;

/** Die Bereiche, die ich sehe — für den Weg, in dem ein Bereich liegt. */
function useAreas(): readonly AreaRow[] {
  const [areas, setAreas] = useState<readonly AreaRow[]>([]);
  useEffect(() => {
    let alive = true;
    void loadAreas().then((found) => { if (alive) setAreas(found.areas); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return areas;
}

/**
 * Wie ein Chat eines Bereichs heisst: der GANZE Weg — „Parafia › Bierzmowanie
 * › Kandydaci", nicht bloss „Kandydaci", das es zweimal gibt.
 */
const titleOfArea = (areas: readonly AreaRow[], areaId: string, fallback: string) =>
  areas.some((a) => a.areaId === areaId) ? areaPath(areas, areaId).full : fallback;

/* -- Die Ansicht ------------------------------------------------------------------ */

/** Wie hoch der Kopf der App ist — die Rozmowa füllt, was darunter bleibt. */
function useTopOffset(): number {
  const [top, setTop] = useState(56);
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('.wk-top');
    if (bar === null) return undefined;
    const measure = () => setTop(Math.round(bar.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const watch = new ResizeObserver(measure);
    watch.observe(bar);
    return () => watch.disconnect();
  }, []);
  return top;
}

export function ChatView({ who, trail }: { who: Who; trail: readonly string[] }) {
  const me = useMe(who);
  const at = trail[0];
  const top = useTopOffset();

  if (me === undefined) return <p className="wk-lede">Wczytywanie…</p>;
  if (me === null) {
    return <p className="wk-note">Bez hasła w tej karcie rozmowy są zamknięte — zaloguj się ponownie albo odblokuj klucz.</p>;
  }

  const room = at === 'nowa' ? <div className="ch-page"><NewChat me={me} /></div>
    : at !== undefined ? <ChatRoom key={at} me={me} chatId={at} />
    : null;

  return (
    <div className={`ch-app${room !== null ? ' has-room' : ''}`} style={{ '--ch-top': `${top}px` } as CSSProperties}>
      <ChatList me={me} current={at} />
      <section className="ch-main" aria-label="Rozmowa">{room ?? <ChatWelcome me={me} />}</section>
    </div>
  );
}

/* -- Die Liste --------------------------------------------------------------------- */

/** Wie ein Chat in der Liste heisst: zu zweit der Name der anderen Seite, sonst der Bereich; mit sich selbst „Notatki". */
function useTitles(me: Me, chats: readonly ChatRow[], areas: readonly AreaRow[]): ReadonlyMap<string, string> {
  const [titles, setTitles] = useState<ReadonlyMap<string, string>>(new Map());
  const key = chats.map((c) => c.chatId).join(',') + '|' + areas.length;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const out = new Map<string, string>();
      for (const chat of chats) {
        if (chat.kind === 'self') { out.set(chat.chatId, 'Notatki'); continue; }
        /* 0069 — mit einem Menschen vom Formular: sein Name, wie die Kanzlei ihn am Platz führt. */
        if (chat.kind === 'seat') { out.set(chat.chatId, `Rozmowa z: ${chat.seatName ?? 'osobą z formularza'}`); continue; }
        if (chat.kind !== 'direct') { out.set(chat.chatId, titleOfArea(areas, chat.areaId, chat.areaName)); continue; }
        const other = chat.members.find((m) => !me.ring.has(m.roleId)) ?? chat.members.find((m) => !me.roles.some((r) => r.id === m.roleId));
        if (other === undefined) { out.set(chat.chatId, 'Rozmowa'); continue; }
        try {
          const names = await openNames(await areaKeys(me.ring, chat.areaId), chat.areaId, chat.names);
          out.set(chat.chatId, nameOf(other.roleId, other.kind, names, me.names));
        } catch {
          out.set(chat.chatId, nameOf(other.roleId, other.kind, new Map(), me.names));
        }
      }
      if (alive) setTitles(out);
    })();
    return () => { alive = false; };
    // Neu, wenn sich die Liste ändert — nicht bei jedem Zeichnen.
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
  return `obszar · ${people}${chat.seats > 0 ? ` · ${chat.seats} z linkiem` : ''}`;
};

function ChatList({ me, current }: { me: Me; current: string | undefined }) {
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
    return () => window.clearInterval(timer);
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

        {rows.map((chat) => {
          const title = titles.get(chat.chatId) ?? chat.areaName;
          const here = current === chat.chatId;
          return (
            <li key={chat.chatId}>
              <a className={`ch-item${here ? ' is-current' : ''}${chat.unread > 0 ? ' is-unread' : ''}`} href={viewPath('chat', chat.chatId)}
                aria-current={here ? 'page' : undefined}>
                <Avatar seed={seedOf(me, chat)} name={title} />
                <span className="ch-item-main">
                  <span className="ch-item-top">
                    <strong className="ch-item-title">{title}</strong>
                    {chat.lastMessageAt !== null && <time className="ch-item-time" dateTime={chat.lastMessageAt}>{listTime(chat.lastMessageAt)}</time>}
                  </span>
                  <span className="ch-item-bottom">
                    <span className="ch-item-sub">{kindText(chat)}</span>
                    {chat.preferences?.muted === true && <span className="ch-item-muted"><Icon name="bell-off" label="wyciszona" /></span>}
                    {chat.unread > 0 && <span className="ch-badge" aria-label={`${chat.unread} nowych`}>{chat.unread}</span>}
                  </span>
                </span>
              </a>
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
function ChatWelcome({ me }: { me: Me }) {
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

/* -- Neu ------------------------------------------------------------------------------ */

type Mode = 'area' | 'direct' | 'group';

/** Wen ich schon kenne — aus meinen Rozmowy, mit dem Namen, den sie dort tragen. */
function useKnown(me: Me, chats: readonly ChatRow[]): readonly Invitee[] {
  const [known, setKnown] = useState<readonly Invitee[]>([]);
  const key = chats.map((c) => c.chatId).join(',');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const out = new Map<string, Invitee>();
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

function NewChat({ me }: { me: Me }) {
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
  const withChat = new Set(chats.map((c) => c.areaId));
  const writable = areas.filter((a) => (a.myLevel === 'write' || a.myLevel === 'admin') && !withChat.has(a.areaId));

  const go = (chatId: string) => { window.location.hash = viewPath('chat', chatId); };

  const run = async (what: string, todo: () => Promise<void>) => {
    setBusy(what);
    setFailed(null);
    try { await todo(); } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally { setBusy(null); }
  };

  const create = () => void run('Zakładanie rozmowy…', async () => {
    if (mode === 'area') {
      if (areaId === '') throw new WorkspaceError('Wybierz obszar.');
      /* Welche meiner Rollen dort schreibt — sie legt den Chat an. */
      const { members } = await loadMembers(areaId);
      const writer = members.find((m) => me.ring.has(m.roleId) && (m.capabilities.includes('write') || m.capabilities.includes('admin')));
      if (writer === undefined) throw new WorkspaceError('Żadna z Twoich ról nie pisze w tym obszarze.');
      go(await startAreaChat(areaId, writer.roleId, channel));
      return;
    }

    const role = me.roles.find((r) => r.id === asRole);
    if (role === undefined) throw new WorkspaceError('Wybierz, kim jesteś w tej rozmowie.');

    if (mode === 'direct') {
      if (invitees.length !== 1) throw new WorkspaceError('Wybierz jedną osobę albo rolę.');

      /* Gibt es sie schon? Dann dorthin — jede Paarung nur einmal. */
      const pair = new Set([role.id, invitees[0].roleId]);
      const existing = chats.find((c) => c.kind === 'direct' && c.members.length === 2 && c.members.every((m) => pair.has(m.roleId)));
      if (existing !== undefined) { go(existing.chatId); return; }
    }

    go(await startOwnChat(me.ring, { role, name: me.names.get(role.id) ?? 'Ja' }, {
      kind: mode, title, invitees, channel: mode === 'group' && channel
    }));
  });

  return (
    <>
      <p><a className="wk-link" href={viewPath('chat')}>← Rozmowy</a></p>
      <h1 className="wk-h1">Nowa rozmowa</h1>

      <Segment
        now={mode}
        options={[
          { value: 'direct' as const, label: 'We dwoje' },
          { value: 'group' as const, label: 'Grupa' },
          { value: 'area' as const, label: 'Dla obszaru' }
        ]}
        busy={busy !== null}
        onPick={(next) => { setMode(next); setInvitees([]); }}
      />

      <form className="wk-form" onSubmit={(e) => { e.preventDefault(); create(); }}>
        {mode !== 'direct' && <label><input type="checkbox" checked={channel} onChange={e => setChannel(e.target.checked)} /> Kanał: publikują tylko osoby z prawem zapisu w obszarze</label>}
        {mode === 'area' ? (
          <>
            <p className="wk-hint">
              Rozmowa istniejącego obszaru: są w niej wszyscy, którzy mają do niego dostęp — i nikt więcej.
              Kogo dodasz do obszaru, ten będzie też w rozmowie.
            </p>
            <label className="wk-field">
              <span>Obszar</span>
              <select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                <option value="">— wybierz —</option>
                <AreaOptions areas={areas} only={writable} />
              </select>
            </label>
            {writable.length === 0 && <p className="wk-empty">Każdy obszar, w którym piszesz, ma już swoją rozmowę.</p>}
          </>
        ) : (
          <>
            <p className="wk-hint">
              {mode === 'direct'
                ? 'Rozmowa dwóch osób albo ról (np. Twojej osoby i kancelarii). Powstaje dla niej własny obszar z Wami dwojgiem.'
                : 'Czat grupowy dostaje własny obszar: kogo dodasz tutaj, ten jest w obszarze — i odwrotnie, kogo dodasz w obszarze, ten jest w czacie.'}
            </p>

            {mode === 'group' && (
              <label className="wk-field">
                <span>Nazwa grupy</span>
                <input value={title} placeholder="np. Rodzice klasy 3b" onChange={(e) => setTitle(e.target.value)} />
                <span className="wk-hint">Nazwa jest też nazwą obszaru — widać ją w „Obszarach".</span>
              </label>
            )}

            <label className="wk-field">
              <span>Kim jesteś w tej rozmowie</span>
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
            {mode === 'direct' ? 'Rozpocznij rozmowę' : mode === 'group' ? 'Załóż grupę' : 'Załóż rozmowę obszaru'}
          </button>
        </div>
      </form>
    </>
  );
}

/**
 * WEN HINEINNEHMEN — jemand, den ich schon aus einer Rozmowa kenne, oder
 * jemand mit seinem Kod do rozmów (und dem Namen, unter dem er hier steht).
 */
function InviteePicker({ known, chosen, single, busy, onChange }: {
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

/* -- Eine Rozmowa -------------------------------------------------------------------- */

function ChatRoom({ me, chatId }: { me: Me; chatId: string }) {
  const endpoint = chatEndpoint(chatId);
  /* 0076 — gemeldet wird über `notify.ts` (die Glocke), nicht noch einmal hier. */
  const extras = useChatExtras(endpoint, { notify: false });
  const areas = useAreas();
  const [chat, setChat] = useState<ChatDetail | null | undefined>(undefined);
  const [keys, setKeys] = useState<ReadonlyMap<number, Uint8Array>>(new Map());

  /* Die Schlüssel der NACHRICHTEN — aus denen des Bereichs abgeleitet (0053). */
  const [talk, setTalk] = useState<ReadonlyMap<number, Uint8Array>>(new Map());
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [shown, setShown] = useState<readonly Shown[] | undefined>(undefined);
  const [more, setMore] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);

  /* 0062 — worauf geantwortet, was bearbeitet, was weitergegeben wird; bis wann gelesen war. */
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const [editing, setEditing] = useState<{ message: SealedMessage; opened: Opened } | null>(null);
  const [forward, setForward] = useState<Opened | null>(null);
  const [unreadAfter, setUnreadAfter] = useState<string | null | undefined>(undefined);
  const composer = useRef<ComposerHandle | null>(null);

  /* 0058 — welche Geschichte offen ist, und bis wann Änderungen geholt sind. */
  const [history, setHistory] = useState<{
    load: () => Promise<{ versions: readonly SealedVersion[] }>;
    open: (version: SealedVersion) => Promise<Opened | null>;
  } | null>(null);
  const asOf = useRef<string | null>(null);

  /* Als wen zuletzt — dieselbe Wahl wie auf der Seite (`chat.as.<id>`); sonst die eigene Person. */
  const [picked, setAs] = useRemembered(`chat.as.${chatId}`, '');

  /*
   * 0068 — TEMATY: welche es gibt, welches gewählt ist (Filter und Ziel),
   * und was aus einer Nachricht entsteht (Aufgabe, Termin) oder wohin sie wandert.
   */
  const [topics, setTopics] = useState<readonly Topic[]>([]);
  const [topic, setTopic] = useRemembered(`chat.topic.${chatId}`, '');
  const [linked, setLinked] = useState(false);
  const [taskFrom, setTaskFrom] = useState<{ message: SealedMessage; opened: Opened } | null>(null);
  const [eventFrom, setEventFrom] = useState<{ message: SealedMessage; opened: Opened; calendars: readonly CalendarRow[] } | null>(null);
  const [moving, setMoving] = useState<SealedMessage | null>(null);

  /* Der Chat, seine Schlüssel, die Namen darin. */
  const lookChat = useCallback(async (freshKeys = false) => {
    try {
      const found = await loadChat(chatId);
      const held = await areaKeys(me.ring, found.areaId, freshKeys);
      const derived = await chatKeysOf(found.chatId, held);
      setChat(found);
      setKeys(held);
      setTalk(derived);
      setNames(await openNames(held, found.areaId, found.names));
      setUnreadAfter((was) => (was === undefined ? found.readAt : was));

      /* Wer mit Link wartet, bekommt seinen Schlüssel, sobald jemand von hier hereinschaut. */
      const by = found.writers[0];
      if (by !== undefined && found.seats.some((one) => one.wrapPublicKey !== null && !one.epochs.includes(found.currentEpoch))) {
        void deliverSeatKeys(found, held, by).catch(() => undefined);
      }
      return { found, held: derived };
    } catch (e) {
      setChat(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć rozmowy.');
      return null;
    }
  }, [chatId, me.ring]);

  const open = async (held: ReadonlyMap<number, Uint8Array>, messages: readonly SealedMessage[]) =>
    Promise.all(messages.map(async (message) => ({ message, opened: await openMessage(held, message) })));

  /* Das erste Bild: der Chat und die letzten Nachrichten. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const got = await lookChat();
      if (got === null || !alive) return;
      const { messages, asOf: at } = await loadMessages(chatId);
      const opened = await open(got.held, messages);
      if (!alive) return;
      asOf.current = at ?? null;
      setShown(opened);
      reportChatSeen(endpoint, opened[opened.length - 1]?.message.createdAt ?? null);
      setMore(messages.length >= 60);
      void markRead(chatId).catch(() => undefined);

      /*
       * SICH VORSTELLEN — einmal. Wer hier schreibt und in diesem Bereich noch
       * keinen Namen trägt, bekommt den eigenen: sonst sähen die anderen an
       * seinen Nachrichten nur eine Kennung.
       */
      for (const roleId of got.found.writers) {
        if (got.found.names.some((n) => n.roleId === roleId)) continue;
        const mine = me.names.get(roleId);
        if (mine !== undefined) void setMemberName(got.found.areaId, got.held, roleId, mine, roleId).catch(() => undefined);
      }
    })();
    return () => { alive = false; };
  }, [chatId, lookChat, me.names]);

  /*
   * 0059 — WAS SICH AN SCHON GEZEIGTEN NACHRICHTEN GEÄNDERT HAT: bearbeitet,
   * gelöscht, zurückgeholt. Sie werden an ihrer Stelle ersetzt.
   */
  const pullChanged = useCallback(async (held: ReadonlyMap<number, Uint8Array>) => {
    if (asOf.current === null) return;
    const { messages, asOf: at } = await loadMessages(chatId, { changed: asOf.current });
    if (at !== undefined) asOf.current = at;
    if (messages.length === 0) return;
    const opened = await open(held, messages);
    setShown((was) => (was ?? []).map((w) => opened.find((o) => o.message.messageId === w.message.messageId) ?? w));
  }, [chatId]);

  /* NACHLADEN — alle paar Sekunden, solange die Karte sichtbar ist. */
  const list = shown ?? [];
  const last = list.length === 0 ? null : list[list.length - 1].message.createdAt;
  const lastId = list.length > 0 ? list[list.length - 1].message.messageId : undefined;
  useEffect(() => {
    if (chat == null) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        try {
          const { messages } = await loadMessages(chatId, last === null ? {} : { after: last, afterId: lastId });
          let held = talk;
          if (messages.some((m) => !held.has(m.epoch))) held = (await lookChat(true))?.held ?? held;
          if (messages.length > 0) {
            const opened = await open(held, messages);
            setShown((was) => [...(was ?? []), ...opened.filter((o) => !(was ?? []).some((w) => w.message.messageId === o.message.messageId))]);
            void markRead(chatId).catch(() => undefined);
          }
          reportChatSeen(endpoint, messages[messages.length - 1]?.createdAt ?? last);
          await pullChanged(held);
        } catch {
          // Beim nächsten Mal wieder.
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [chat, chatId, last, lastId, talk, lookChat, pullChanged]);

  /* 0068 — die Themen: beim Öffnen, nach jeder Änderung, und alle 30 s (sie ändern sich selten). */
  const lookTopics = useCallback(async () => {
    if (talk.size === 0) return;
    try {
      const { topics: rows } = await loadTopics(endpoint);
      setTopics(await openTopics(talk, rows));
    } catch {
      // Ohne Themen bleibt die Rozmowa, wie sie war.
    }
  }, [endpoint, talk]);
  useEffect(() => {
    void lookTopics();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void lookTopics(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [lookTopics]);

  const earlier = useCallback(async () => {
    const first = shown?.[0];
    if (first === undefined) return;
    const { messages } = await loadMessages(chatId, { before: first.message.createdAt, beforeId: first.message.messageId });
    const opened = await open(talk, messages);
    setShown((was) => [...opened, ...(was ?? [])]);
    setMore(messages.length >= 60);
  }, [chatId, shown, talk]);

  const moderates = chat != null && chat.certifiers.length > 0 && chat.kind !== 'direct';
  const chrome = useChatChrome({ endpoint, extras, keys: talk, canModerate: moderates && chat?.kind !== 'self', onPolicy: () => void lookChat() });

  const speakers = useMemo(() => (chat == null ? [] : chat.writers.filter((id) => me.ring.maySign(id))
    .sort((a, b) => Number(me.roles.find((r) => r.id === b)?.kind === 'person') - Number(me.roles.find((r) => r.id === a)?.kind === 'person'))),
  [chat, me.ring, me.roles]);
  const as = speakers.includes(picked) ? picked
    : speakers.find((id) => me.roles.find((r) => r.id === id)?.kind === 'person') ?? speakers[0] ?? '';

  if (chat === undefined) return <p className="ch-empty">Wczytywanie…</p>;
  if (chat === null) {
    return (
      <div className="ch-page">
        <p><a className="wk-link" href={viewPath('chat')}>← Rozmowy</a></p>
        <p className="wk-error">{failed ?? 'Takiej rozmowy nie ma.'}</p>
      </div>
    );
  }

  const self = chat.kind === 'self';
  const other = chat.kind === 'direct' ? chat.members.find((m) => !me.ring.has(m.roleId)) : undefined;
  const seatChat = chat.kind === 'seat';
  const title = self ? 'Notatki'
    : seatChat ? `Rozmowa z: ${chat.seats[0]?.name ?? 'osobą z formularza'}`
    : other !== undefined ? nameOf(other.roleId, other.kind, names, me.names) : titleOfArea(areas, chat.areaId, chat.areaName);

  /* 0068 — das gewählte Thema, wenn es das noch gibt. */
  const currentTopic = topic !== '' && topics.some((t) => t.topicId === topic) ? topic : null;
  const person = me.roles.find((r) => r.kind === 'person') ?? null;
  const asPerson: Person | null = person === null ? null : { ring: me.ring, roles: me.roles, person, names: me.names };
  const kindOf = (roleId: string) => chat.members.find((m) => m.roleId === roleId)?.kind;
  const label = (id: string) => names.get(id) ?? me.names.get(id) ?? `rola ${shortId(id)}`;
  const mine = (message: SealedMessage) => message.authorRoleId !== null && me.ring.has(message.authorRoleId);

  /*
   * WER SCHREIBT. Eine Rolle heisst, wie der Bereich sie nennt — sonst wie sie
   * sich in der Nachricht selbst nennt. Ein Platz heisst, wie er sich nennt,
   * sonst wie die Kanzlei ihn am Platz führt. Die eigenen: „Ty" — mit Namen,
   * wenn ich hier als mehr als eine Rolle schreibe.
   */
  const authorName = (message: SealedMessage, opened: Opened | null) => {
    if (message.authorSeatId !== null) {
      return opened?.name ?? chat.seats.find((one) => one.seatId === message.authorSeatId)?.name ?? 'osoba z linkiem';
    }
    const roleId = message.authorRoleId ?? '';
    if (mine(message)) return speakers.length > 1 ? `${label(roleId)} (Ty)` : 'Ty';
    return names.get(roleId) ?? me.names.get(roleId) ?? opened?.name ?? nameOf(roleId, kindOf(roleId), names, me.names);
  };

  const rules: MessageRules = {
    mine,
    author: authorName,
    note: (message) => (message.authorSeatId !== null ? 'z linku' : null),
    /* 0058 — bearbeiten nur die eigene; zurückholen der Verfasser (wenn er selbst löschte) oder wer moderiert. */
    canEdit: (message, opened) => mine(message) && message.deletedAt === null && opened !== null && chat.writers.includes(message.authorRoleId ?? ''),
    canDelete: (message) => message.deletedAt === null && (mine(message) || moderates),
    canRestore: (message) => message.deletedAt !== null && ((mine(message) && message.deletedBy === 'author') || moderates),
    canPin: moderates,
    group: chat.kind === 'group' || chat.kind === 'area',
    receipts: !self
  };

  const on: MessageHandlers = {
    reply: (message, opened, author) => { setEditing(null); setReply({ id: message.messageId, text: opened.text, author }); },
    edit: (message, opened) => { setReply(null); setEditing({ message, opened }); },
    remove: async (message) => {
      await deleteMessage(message.messageId);
      setShown((was) => withDelete(was ?? [], message.messageId, mine(message) ? 'author' : 'moderator'));
    },
    restore: async (message) => { await restoreMessage(message.messageId); await pullChanged(talk); },
    history: (message) => setHistory({
      load: () => loadVersions(message.messageId),
      open: (version) => openVersion(talk, message.messageId, authorOf(message), version)
    }),
    forward: (opened) => setForward(opened),

    /* 0066/0070 — aus einer Nachricht: eine Aufgabe, ein Termin. 0068 — in ein Thema. */
    task: asPerson === null ? undefined : (message, opened) => setTaskFrom({ message, opened }),
    appointment: asPerson === null ? undefined : (message, opened) => {
      void loadCalendars().then(({ calendars }) => setEventFrom({ message, opened, calendars })).catch(() => undefined);
    },
    moveTopic: topics.length === 0 ? undefined : (message) => setMoving(message)
  };

  const send = async (body: string, options: SendOptions) => {
    if (as === '') throw new WorkspaceError('W tej rozmowie tylko czytasz.');
    /* Der Name reist in der Nachricht mit — für die, die die Namen des Bereichs nicht lesen (0053). */
    const name = names.get(as) ?? me.names.get(as) ?? null;
    const done = await sendMessage(me.ring, chat.chatId, talk, as, body, name, { ...options, topicId: currentTopic });
    if (options.sendAt === undefined) {
      setShown((was) => [...(was ?? []), {
        message: { messageId: done.messageId, authorRoleId: as, authorSeatId: null, epoch: done.epoch, bodySealed: '', createdAt: done.createdAt, deletedAt: null, topicId: currentTopic },
        opened: { text: body, name, ...options }
      }]);
    }
  };

  const saveEdit = async (text: string) => {
    if (editing === null) return;
    const { message, opened } = editing;
    const done = await editMessage(me.ring, message.messageId, talk, message.authorRoleId!, text, opened.name, (message.version ?? 1) + 1, opened);
    setShown((was) => withEdit(was ?? [], message.messageId, done, text));
    setEditing(null);
  };

  /* Unter dem Namen: wer gerade schreibt, sonst wer dabei ist. */
  const n = chat.members.length;
  const theirs = other === undefined ? undefined : extras.features?.receipts.find((r) => r.roleIds.includes(other.roleId))?.available;
  const subtitle = chrome.status.typing ? <span className="ch-typing">{chat.kind === 'direct' ? 'pisze…' : 'ktoś pisze…'}</span>
    : self ? 'tylko Ty · szyfrowane w przeglądarce'
    : chat.kind === 'direct' ? (theirs === true ? 'w godzinach dostępności' : theirs === false ? 'poza godzinami dostępności' : 'rozmowa we dwoje')
    : [
      `${n} ${plural(n, 'uczestnik', 'uczestnicy', 'uczestników')}`,
      chat.seats.length > 0 ? `${chat.seats.length} z linkiem` : null,
      chrome.status.channel ? 'kanał' : null,
      chrome.status.available + chrome.status.away > 0 ? `dostępnych: ${chrome.status.available}` : null
    ].filter(Boolean).join(' · ');

  const menu: MenuItem[] = [
    ...chrome.items,
    { label: 'Zadania i terminy z rozmowy', icon: 'check' as const, onSelect: () => setLinked(true) },
    ...(self ? [] : [{ label: `Uczestnicy i ustawienia`, icon: 'users' as const, onSelect: () => setSettings(true) }]),
    { label: self ? 'Mój prywatny obszar' : 'Obszar tej rozmowy', icon: 'area', onSelect: () => { window.location.hash = viewPath('areas', chat.areaId); } }
  ];

  const readOnly = speakers.length === 0 ? 'W tej rozmowie tylko czytasz.'
    : extras.features?.canWrite === false ? 'Ten kanał pozwala Ci tylko czytać.'
    : null;

  return (
    <div className="ch-room">
      <ChatHeader
        back={viewPath('chat')}
        title={title}
        avatar={<Avatar seed={self ? 'self' : other?.roleId ?? chat.chatId} name={title} icon={self ? 'bookmark' : undefined} />}
        subtitle={subtitle}
        menu={menu}
        search={extras.search}
        onSearch={extras.setSearch}
        quiet={chrome.status.quiet}
      />
      {chrome.banner}
      {failed !== null && <p className="ch-bar is-error">{failed}</p>}

      {/* 0068 — Tematy: Filter und Ziel des Schreibens. */}
      <TopicBar
        topics={topics}
        current={currentTopic}
        canCreate={speakers.length > 0 && !self}
        canManage={moderates || speakers.length > 0}
        onPick={(id) => setTopic(id ?? '')}
        onCreate={async (name) => { const id = await createTopic(endpoint, talk, name, as === '' ? null : as); await lookTopics(); setTopic(id); }}
        onChanged={() => void lookTopics()}
      />

      <ChatLog
        endpoint={endpoint}
        items={currentTopic === null || shown === undefined ? shown : shown.filter((one) => one.message.topicId === currentTopic)}
        features={extras.features}
        matches={extras.matches}
        rules={rules}
        on={on}
        more={more}
        onEarlier={earlier}
        empty={self ? 'Zapisuj tu myśli, linki i pliki dla siebie — nikt inny ich nie zobaczy.' : 'Jeszcze nikt nic nie napisał — możesz zacząć.'}
        onFiles={(files) => composer.current?.addFiles(files)}
        unreadAfter={unreadAfter ?? null}
        search={extras.search}
        filter={extras.filter}
      />

      <Composer
        ref={composer}
        endpoint={endpoint}
        readOnly={readOnly}
        placeholder={speakers.length > 1 ? `Wiadomość jako ${label(as)}` : self ? 'Notatka' : 'Wiadomość'}
        reply={reply}
        onClearReply={() => setReply(null)}
        editing={editing === null ? null : { id: editing.message.messageId, text: editing.opened.text }}
        onCancelEdit={() => setEditing(null)}
        onSaveEdit={saveEdit}
        onSend={send}
        onEditLast={() => {
          const one = lastEditable(list, rules.canEdit);
          if (one !== null && one.opened !== null) on.edit(one.message, one.opened);
        }}
        onScheduled={chrome.scheduled.refresh}
        before={chrome.chip}
        sendAs={speakers.length > 1 ? <SendAs speakers={speakers} speaker={as} nameOf={label} onPick={setAs} /> : null}
      />

      {chrome.dialogs}
      {settings && (
        <Modal title={`Uczestnicy (${chat.members.length}${chat.seats.length > 0 ? ` + ${chat.seats.length} z linkiem` : ''}) i ustawienia`} wide onClose={() => setSettings(false)}>
          <ChatSettings me={me} chat={chat} names={names} keys={keys} onChanged={() => void lookChat(true)} />
        </Modal>
      )}
      {forward !== null && <ForwardDialog endpoint={endpoint} opened={forward} ring={me.ring} onClose={() => setForward(null)} />}

      {linked && <LinkedDialog ring={me.ring} chatId={chat.chatId} topics={topics} onClose={() => setLinked(false)} />}
      {moving !== null && (
        <MoveToTopic topics={topics} current={moving.topicId ?? null} onClose={() => setMoving(null)}
          onPick={(id) => {
            const target = moving;
            setMoving(null);
            void moveToTopic(target.messageId, id)
              .then(() => { setShown((was) => (was ?? []).map((w) => w.message.messageId === target.messageId ? { ...w, message: { ...w.message, topicId: id } } : w)); void lookTopics(); })
              .catch((e: unknown) => setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się przenieść.'));
          }} />
      )}
      {taskFrom !== null && asPerson !== null && (
        <TaskDialog me={asPerson} areas={areas} task={null}
          initialTitle={titleFrom(taskFrom.opened.text)}
          initialArea={areas.some((a) => a.areaId === chat.areaId && (a.myLevel === 'write' || a.myLevel === 'admin')) ? chat.areaId : undefined}
          origin={{ chatId: chat.chatId, topicId: taskFrom.message.topicId ?? currentTopic, messageId: taskFrom.message.messageId }}
          onClose={() => setTaskFrom(null)} onSaved={() => void lookTopics()} />
      )}
      {eventFrom !== null && asPerson !== null && (
        <EventDialog me={asPerson} areas={areas} calendars={eventFrom.calendars}
          target={{
            at: 'new', allDay: false,
            start: new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 86_400_000),
            end: new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 86_400_000 + 3_600_000),
            calendarId: eventFrom.calendars.find((c) => c.areaId === chat.areaId && c.mayWrite === true)?.calendarId,
            title: titleFrom(eventFrom.opened.text),
            origin: { chatId: chat.chatId, topicId: eventFrom.message.topicId ?? currentTopic }
          }}
          onClose={() => setEventFrom(null)} onSaved={() => void lookTopics()} />
      )}
      {history !== null && <HistoryDialog load={history.load} open={history.open} onClose={() => setHistory(null)} />}
    </div>
  );
}

/* -- Einstellungen ----------------------------------------------------------------- */

const LEVEL: Record<string, string> = { admin: 'prowadzi', write: 'pisze', read: 'czyta', certify: 'wpuszcza' };

function ChatSettings({ me, chat, names, keys, onChanged }: {
  me: Me;
  chat: ChatDetail;
  names: ReadonlyMap<string, string>;
  keys: ReadonlyMap<number, Uint8Array>;
  onChanged: () => void;
}) {
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
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="wk-chat-settings">
      <p className="wk-hint">
        {chat.kind === 'area'
          ? 'To rozmowa obszaru: są w niej wszyscy, którzy mają dostęp do obszaru.'
          : 'Ta rozmowa ma własny obszar — to ci sami ludzie. Dodawać i usuwać możesz tutaj albo w „Obszarach".'}
        {' '}<a className="wk-link" href={viewPath('areas', chat.areaId)}>Obszar tej rozmowy</a>
      </p>

      <h2 className="wk-h2">Uczestnicy</h2>
      <ul className="wk-list">
        {chat.members.map((m) => {
          const mine = me.ring.has(m.roleId);
          return (
            <li key={m.roleId} className="wk-row">
              <span>
                <strong>{nameOf(m.roleId, m.kind, names, me.names)}</strong>
                <span className="wk-row-side"> · {KIND[m.kind] ?? m.kind} · {m.capabilities.map((c) => LEVEL[c] ?? c).join(', ')}{mine ? ' · to Ty' : ''}</span>
              </span>
              {issuer !== null && !mine && chat.kind !== 'direct' && (
                <button type="button" className="wk-link-btn wk-danger" disabled={busy !== null}
                  onClick={() => {
                    if (!window.confirm(`Usunąć z rozmowy (i z obszaru): ${nameOf(m.roleId, m.kind, names, me.names)}?`)) return;
                    void run('Usuwanie…', async () => (await dropFromArea(chat.areaId, m.roleId)).note);
                  }}>
                  Usuń
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {chat.kind === 'area' && <LinkPeople chat={chat} />}

      {issuer !== null && chat.kind !== 'direct' && (
        <form className="wk-form" onSubmit={(e) => {
          e.preventDefault();
          void run('Dodawanie…', async () => {
            for (const one of adding) await addToChat(me.ring, chat, one, issuer, chat.postingPolicy === 'writers' ? 'read' : 'write');
            const said = `Dodano: ${adding.map((a) => a.name).join(', ')}.`;
            setAdding([]);
            return said;
          });
        }}>
          <InviteePicker known={known} chosen={adding} single={false} busy={busy !== null} onChange={setAdding} />
          {adding.length > 0 && (
            <div className="wk-actions">
              <button type="submit" className="wk-btn" disabled={busy !== null}>Dodaj do rozmowy</button>
            </div>
          )}
        </form>
      )}

      {myWriter !== null && (
        <form className="wk-form" onSubmit={(e) => {
          e.preventDefault();
          void run('Zapisywanie…', async () => {
            await setMemberName(chat.areaId, keys, myWriter, myName, myWriter);
            return 'Zapisano Twoją nazwę w tej rozmowie.';
          });
        }}>
          <label className="wk-field">
            <span>Jak nazywasz się w tej rozmowie</span>
            <input value={myName} onChange={(e) => setMyName(e.target.value)} />
            <span className="wk-hint">Widzą ją tylko uczestnicy — jest zaszyfrowana kluczem obszaru.</span>
          </label>
          <div className="wk-actions">
            <button type="submit" className="wk-btn wk-btn-quiet" disabled={busy !== null || myName.trim() === ''}>Zapisz</button>
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
  if (chat.seats.length === 0) {
    return (
      <p className="wk-hint">
        Osoby z linkiem do tego obszaru (np. z formularza) też tu piszą — na razie nie ma żadnej.
      </p>
    );
  }

  const state = (one: ChatDetail['seats'][number]) =>
    one.wrapPublicKey === null ? 'jeszcze nie otworzyła rozmowy'
    : one.epochs.includes(chat.currentEpoch) ? 'ma dostęp'
    : 'czeka na klucz — dostanie go, gdy ktoś z uczestników zajrzy tutaj';

  return (
    <>
      <h2 className="wk-h2">Osoby z linkiem ({chat.seats.length})</h2>
      <p className="wk-hint">
        Każdy, kto ma link do tego obszaru, czyta i pisze w tej rozmowie — bez konta. Klucz do niej
        przekazuje im przeglądarka uczestnika, który zajrzy tutaj; do reszty obszaru nie dostają dostępu.
      </p>
      <ul className="wk-list">
        {chat.seats.map((one, i) => (
          <li key={one.seatId} className="wk-row">
            <span>
              <strong>{one.name ?? `Osoba z linkiem ${i + 1}`}</strong>
              <span className="wk-row-side"> · {state(one)}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* -- Die Kachel ------------------------------------------------------------------------- */

/** Auf der Startseite: wie viele Rozmowy, und wie viel Neues. */
export function ChatTileBody() {
  const [chats, setChats] = useState<readonly ChatRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    void loadChats().then((found) => { if (alive) setChats(found.chats); }).catch(() => { if (alive) setChats([]); });
    return () => { alive = false; };
  }, []);

  if (chats === null) return <p className="wk-empty">Wczytywanie…</p>;
  if (chats.length === 0) return <p className="wk-empty">Żadnej rozmowy — zacznij pierwszą.</p>;

  const unread = chats.reduce((n, c) => n + c.unread, 0);
  return (
    <p className="wk-empty">
      {chats.length} {chats.length === 1 ? 'rozmowa' : 'rozmów'}
      {unread > 0 && <> · <strong>{unread} {unread === 1 ? 'nowa wiadomość' : 'nowych wiadomości'}</strong></>}
    </p>
  );
}

export default ChatView;
