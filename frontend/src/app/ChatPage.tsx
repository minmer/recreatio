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
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { areaPath, dropFromArea, loadAreas, loadMembers, type AreaRow } from './area';
import { AreaOptions } from './AreaOptions';
import { Segment } from './Areas';
import {
  addToChat, areaKeys, deleteMessage, loadChat, loadChats, loadMessages, looksLikeCode, markRead,
  openMessage, openNames, roleCard, sendMessage, setMemberName, startAreaChat, startOwnChat,
  type ChatDetail, type ChatRow, type Invitee, type SealedMessage
} from './chat';
import type { Ring, SealedRole } from './keys';
import { keysFor } from './ringOf';
import { myRoleNames } from './roleNames';
import { viewPath } from './routes';
import { WorkspaceError, type Who } from './session';

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

const when = (at: string) => {
  const d = new Date(at);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

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

export function ChatView({ who, trail }: { who: Who; trail: readonly string[] }) {
  const me = useMe(who);
  const at = trail[0];

  if (me === undefined) return <p className="wk-lede">Wczytywanie…</p>;
  if (me === null) {
    return <p className="wk-note">Bez hasła w tej karcie rozmowy są zamknięte — zaloguj się ponownie albo odblokuj klucz.</p>;
  }

  if (at === 'nowa') return <NewChat me={me} />;
  if (at !== undefined) return <ChatRoom key={at} me={me} chatId={at} />;
  return <ChatList me={me} />;
}

/* -- Die Liste --------------------------------------------------------------------- */

/** Wie ein Chat in der Liste heisst: zu zweit der Name der anderen Seite, sonst der Bereich. */
function useTitles(me: Me, chats: readonly ChatRow[], areas: readonly AreaRow[]): ReadonlyMap<string, string> {
  const [titles, setTitles] = useState<ReadonlyMap<string, string>>(new Map());
  const key = chats.map((c) => c.chatId).join(',') + '|' + areas.length;

  useEffect(() => {
    let alive = true;
    void (async () => {
      const out = new Map<string, string>();
      for (const chat of chats) {
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

function ChatList({ me }: { me: Me }) {
  const [chats, setChats] = useState<readonly ChatRow[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const areas = useAreas();

  const look = useCallback(async () => {
    try {
      setChats((await loadChats()).chats);
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać rozmów.');
    }
  }, []);

  useEffect(() => {
    void look();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void look(); }, 20_000);
    return () => window.clearInterval(timer);
  }, [look]);

  const titles = useTitles(me, chats ?? [], areas);

  return (
    <>
      <h1 className="wk-h1">Rozmowy</h1>
      <p className="wk-lede">
        Każda rozmowa należy do obszaru: kto ma dostęp do obszaru, jest w rozmowie. Treść szyfruje Twoja
        przeglądarka — serwer jej nie czyta.
      </p>

      <div className="wk-actions">
        <a className="wk-btn" href={viewPath('chat', 'nowa')}>Nowa rozmowa</a>
      </div>

      {failed !== null && <p className="wk-error">{failed}</p>}

      {chats === null ? (
        <p className="wk-hint">Wczytywanie…</p>
      ) : chats.length === 0 ? (
        <p className="wk-empty">Nie masz jeszcze żadnej rozmowy.</p>
      ) : (
        <ul className="wk-chat-list">
          {chats.map((chat) => (
            <li key={chat.chatId}>
              <a className="wk-chat-row" href={viewPath('chat', chat.chatId)}>
                <span className="wk-chat-row-main">
                  <strong>{titles.get(chat.chatId) ?? chat.areaName}</strong>
                  <span className="wk-row-side">
                    {chat.kind === 'direct' ? 'we dwoje' : chat.kind === 'group' ? `grupa · ${chat.members.length} os.` : `obszar · ${chat.members.length} os.`}
                  </span>
                </span>
                <span className="wk-chat-row-side">
                  {chat.lastMessageAt !== null && <span className="wk-row-side">{when(chat.lastMessageAt)}</span>}
                  {chat.unread > 0 && <span className="wk-chat-unread" aria-label={`${chat.unread} nowych`}>{chat.unread}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <MyCodes me={me} />
    </>
  );
}

/**
 * MÓJ KOD DO ROZMÓW — Kennung meiner Person (oder Rolle). Wer ihn bekommt,
 * kann mich in eine Rozmowa nehmen: der Dienst gibt dazu nur meinen
 * öffentlichen Schlüssel heraus.
 */
function MyCodes({ me }: { me: Me }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const shown = me.roles.filter((r) => all || r.kind === 'person');

  const copy = async (id: string) => {
    try { await navigator.clipboard.writeText(id); setCopied(id); } catch { /* steht ja da */ }
  };

  return (
    <section className="wk-panel wk-chat-codes">
      <h2 className="wk-h2">Twój kod do rozmów</h2>
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
      go(await startAreaChat(areaId, writer.roleId));
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
      kind: mode, title, invitees
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

interface Shown {
  readonly message: SealedMessage;
  readonly text: string | null;
}

function ChatRoom({ me, chatId }: { me: Me; chatId: string }) {
  const areas = useAreas();
  const [chat, setChat] = useState<ChatDetail | null | undefined>(undefined);
  const [keys, setKeys] = useState<ReadonlyMap<number, Uint8Array>>(new Map());
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [shown, setShown] = useState<readonly Shown[]>([]);
  const [more, setMore] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const log = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);

  /* Der Chat, seine Schlüssel, die Namen darin. */
  const lookChat = useCallback(async (freshKeys = false) => {
    try {
      const found = await loadChat(chatId);
      const held = await areaKeys(me.ring, found.areaId, freshKeys);
      setChat(found);
      setKeys(held);
      setNames(await openNames(held, found.areaId, found.names));
      return { found, held };
    } catch (e) {
      setChat(null);
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się otworzyć rozmowy.');
      return null;
    }
  }, [chatId, me.ring]);

  const open = async (held: ReadonlyMap<number, Uint8Array>, messages: readonly SealedMessage[]) =>
    Promise.all(messages.map(async (message) => ({ message, text: await openMessage(held, message) })));

  /* Das erste Bild: der Chat und die letzten Nachrichten. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const got = await lookChat();
      if (got === null || !alive) return;
      const { messages } = await loadMessages(chatId);
      const opened = await open(got.held, messages);
      if (!alive) return;
      setShown(opened);
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

  /* NACHLADEN — alle paar Sekunden, solange die Karte sichtbar ist. */
  const last = shown.length === 0 ? null : shown[shown.length - 1].message.createdAt;
  useEffect(() => {
    if (chat == null) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void (async () => {
        try {
          const { messages } = await loadMessages(chatId, last === null ? {} : { after: last });
          if (messages.length === 0) return;
          let held = keys;
          if (messages.some((m) => !held.has(m.epoch))) held = (await lookChat(true))?.held ?? held;
          const opened = await open(held, messages);
          setShown((was) => [...was, ...opened.filter((o) => !was.some((w) => w.message.messageId === o.message.messageId))]);
          void markRead(chatId).catch(() => undefined);
        } catch {
          // Beim nächsten Mal wieder.
        }
      })();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [chat, chatId, last, keys, lookChat]);

  /* Unten bleiben, wenn man unten war. */
  useEffect(() => {
    const el = log.current;
    if (el !== null && stick.current) el.scrollTop = el.scrollHeight;
  }, [shown]);

  const earlier = async () => {
    const first = shown[0]?.message.createdAt;
    if (first === undefined) return;
    const { messages } = await loadMessages(chatId, { before: first });
    const opened = await open(keys, messages);
    stick.current = false;
    setShown((was) => [...opened, ...was]);
    setMore(messages.length >= 60);
  };

  if (chat === undefined) return <p className="wk-lede">Wczytywanie…</p>;
  if (chat === null) {
    return (
      <>
        <p><a className="wk-link" href={viewPath('chat')}>← Rozmowy</a></p>
        <p className="wk-error">{failed ?? 'Takiej rozmowy nie ma.'}</p>
      </>
    );
  }

  const other = chat.kind === 'direct' ? chat.members.find((m) => !me.ring.has(m.roleId)) : undefined;
  const title = other !== undefined ? nameOf(other.roleId, other.kind, names, me.names) : titleOfArea(areas, chat.areaId, chat.areaName);
  const kindOf = (roleId: string) => chat.members.find((m) => m.roleId === roleId)?.kind;

  return (
    <div className="wk-chat-room">
      <div className="wk-chat-head">
        <a className="wk-link" href={viewPath('chat')}>← Rozmowy</a>
        <h1 className="wk-h1">{title}</h1>
        <button type="button" className="wk-link-btn" onClick={() => setSettings(!settings)}>
          {settings ? 'Zamknij ustawienia' : `Uczestnicy (${chat.members.length}) i ustawienia`}
        </button>
      </div>

      {settings && (
        <ChatSettings me={me} chat={chat} names={names} keys={keys} onChanged={() => void lookChat(true)} />
      )}

      {failed !== null && <p className="wk-error">{failed}</p>}

      <div
        className="wk-chat-log"
        ref={log}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {more && shown.length > 0 && (
          <button type="button" className="wk-link-btn wk-chat-earlier" onClick={() => void earlier()}>
            Wczytaj wcześniejsze
          </button>
        )}
        {shown.length === 0 && <p className="wk-empty">Jeszcze nikt nic nie napisał.</p>}

        {shown.map(({ message, text }, i) => {
          const mine = me.ring.has(message.authorRoleId);
          const prev = shown[i - 1]?.message;
          const same = prev !== undefined && prev.authorRoleId === message.authorRoleId
            && new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
          const mayDelete = message.deletedAt === null && (mine || (chat.certifiers.length > 0 && chat.kind !== 'direct'));

          return (
            <div key={message.messageId} className={`wk-msg${mine ? ' is-mine' : ''}${same ? ' is-follow' : ''}`}>
              {!same && (
                <p className="wk-msg-author">
                  {nameOf(message.authorRoleId, kindOf(message.authorRoleId), names, me.names)}
                  <span className="wk-msg-time"> · {when(message.createdAt)}</span>
                </p>
              )}
              <div className="wk-msg-body">
                {message.deletedAt !== null
                  ? <em className="wk-row-side">wiadomość usunięta</em>
                  : text === null
                    ? <em className="wk-row-side">Nie do odczytania — brak klucza tej epoki obszaru.</em>
                    : text}
                {mayDelete && (
                  <button type="button" className="wk-chip-x wk-msg-drop" aria-label="Usuń wiadomość" title="Usuń wiadomość"
                    onClick={() => {
                      if (!window.confirm('Usunąć tę wiadomość? Zobaczą, że była, ale nie jej treść.')) return;
                      void deleteMessage(message.messageId).then(() => setShown((was) => was.map((w) =>
                        w.message.messageId === message.messageId
                          ? { message: { ...w.message, deletedAt: new Date().toISOString(), bodySealed: null }, text: null }
                          : w)));
                    }}>
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Composer
        me={me}
        chat={chat}
        keys={keys}
        onSent={(message, text) => {
          stick.current = true;
          setShown((was) => [...was, { message, text }]);
        }}
      />
    </div>
  );
}

/** Schreiben — als eine meiner Rollen, die hier schreiben darf. */
function Composer({ me, chat, keys, onSent }: {
  me: Me;
  chat: ChatDetail;
  keys: ReadonlyMap<number, Uint8Array>;
  onSent: (message: SealedMessage, text: string) => void;
}) {
  const speakers = useMemo(() => chat.writers.filter((id) => me.ring.maySign(id)), [chat.writers, me.ring]);
  const [as, setAs] = useState(speakers.find((id) => me.roles.find((r) => r.id === id)?.kind === 'person') ?? speakers[0] ?? '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  if (speakers.length === 0) {
    return <p className="wk-hint wk-chat-compose">W tej rozmowie tylko czytasz.</p>;
  }

  const send = async () => {
    const body = text.trim();
    if (body === '' || busy) return;
    setBusy(true);
    setFailed(null);
    try {
      const done = await sendMessage(me.ring, chat.chatId, keys, as, body);
      onSent({
        messageId: done.messageId, authorRoleId: as, epoch: Math.max(...keys.keys()),
        bodySealed: '', createdAt: done.createdAt, deletedAt: null
      }, body);
      setText('');
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wysłać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wk-chat-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      {speakers.length > 1 && (
        <label className="wk-inline">
          <span className="wk-hint">Jako</span>
          <select value={as} onChange={(e) => setAs(e.target.value)} aria-label="Piszesz jako">
            {speakers.map((id) => <option key={id} value={id}>{me.names.get(id) ?? shortId(id)}</option>)}
          </select>
        </label>
      )}
      <div className="wk-chat-compose-row">
        <textarea
          value={text}
          rows={2}
          placeholder="Napisz wiadomość… (Enter wysyła, Shift+Enter — nowa linia)"
          aria-label="Wiadomość"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
        />
        <button type="submit" className="wk-btn" disabled={busy || text.trim() === ''}>
          {busy ? 'Wysyłanie…' : 'Wyślij'}
        </button>
      </div>
      {failed !== null && <p className="wk-error">{failed}</p>}
    </form>
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
    <section className="wk-panel wk-chat-settings">
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

      {issuer !== null && chat.kind !== 'direct' && (
        <form className="wk-form" onSubmit={(e) => {
          e.preventDefault();
          void run('Dodawanie…', async () => {
            for (const one of adding) await addToChat(me.ring, chat, one, issuer);
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
