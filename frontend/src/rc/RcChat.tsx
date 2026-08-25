/**
 * Kapitel 9 in der Oberfläche — Bereiche, Beiträge, Epochengrenzen.
 *
 * Drei Dinge sind hier Absicht und nicht Kosmetik:
 *
 *   1. **Unlesbares wird gezeigt, nicht weggelassen** (15.9). Eine Nachricht,
 *      die aus der Zeit vor dem eigenen Beitritt stammt, steht da — mit dem
 *      Grund. Sie stillschweigend zu unterschlagen wäre schlimmer: der Leser
 *      hätte keinen Anhaltspunkt, dass zwischen zwei Beiträgen etwas fehlt, und
 *      verstünde das Gespräch falsch.
 *
 *   2. **Der Name, unter dem man schreibt, steht sichtbar da** (3.3). Wer
 *      mehrere Rollen hält, soll nie versehentlich unter der falschen
 *      schreiben — und niemand soll später rätseln müssen, wer das war.
 *
 *   3. **„Zu Protokoll" ist eine bewusste Handlung je Beitrag** (7.8). Kein
 *      Schalter, den man einmal umlegt und vergisst: eine Kette voller
 *      Nebensätze beweist am Ende nichts, weil niemand sie mehr liest.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rcCopy, rcPlural, type RcLang } from './i18n';
import { RcRequestError } from './lib/rcApi';
import { RcAttachments, RcPolls, RcReactions, RcTopics } from './RcThreads';
import type { RcReaction } from './lib/rcThreads';
import {
  rcAreas, rcCreateArea, rcEpochBreaks, rcFeed, rcHide, rcMarkRead, rcMembers, rcMessageState,
  rcPost, rcRoles,
  type RcArea, type RcMessage, type RcRole
} from './lib/rcChat';

export function RcChat({ lang, unlocked }: { lang: RcLang; unlocked: boolean }) {
  const t = rcCopy[lang].chat;

  const [roles, setRoles] = useState<readonly RcRole[]>([]);
  const [areas, setAreas] = useState<readonly RcArea[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = useCallback((e: unknown) => {
    const auth = rcCopy[lang].auth;
    return e instanceof RcRequestError ? auth.errors[e.code] ?? auth.unknownError : auth.unknownError;
  }, [lang]);

  const load = useCallback(async () => {
    if (!unlocked) return;
    try {
      const [r, a] = await Promise.all([rcRoles(), rcAreas()]);
      setRoles(r.roles ?? []);
      setAreas(a.areas ?? []);
      setError(null);
    } catch (e) {
      setError(describe(e));
    }
  }, [unlocked, describe]);

  useEffect(() => { void load(); }, [load]);

  // Die persönliche Rolle ist der Vorgabename. Wer mehrere hält, wählt beim
  // Schreiben — aber niemand soll erst wählen müssen, um überhaupt anzufangen.
  const defaultRole = useMemo(
    () => roles.find((r) => r.kind === 'person') ?? roles[0],
    [roles]
  );

  const selectedArea = useMemo(
    () => areas.find((a) => a.areaId === selected) ?? null,
    [areas, selected]
  );

  if (!unlocked) return <p className="rc-note">{t.locked}</p>;

  return (
    <div className="rc-chat">
      <aside className="rc-chat-side">
        <h3 className="rc-chat-h">{t.areas}</h3>

        {areas.length === 0 && <p className="rc-note">{t.noAreas}</p>}

        <ul className="rc-area-list">
          {areas.map((area) => (
            <li key={area.areaId}>
              <button
                type="button"
                className="rc-area"
                aria-current={selected === area.areaId}
                onClick={() => setSelected(area.areaId)}
              >
                <span className="rc-area-title">{area.title ?? area.areaId.slice(0, 8)}</span>
                {/* Der Rand der eigenen Sicht gehört sichtbar, nicht versteckt:
                    wer weniger Epochen öffnen kann als es gibt, soll wissen,
                    dass oben etwas fehlt — sonst hält er das Bruchstück für
                    das Ganze. */}
                {area.readableEpochs < area.currentEpoch && (
                  <span className="rc-area-meta">{t.partialHistory}</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <RcNewArea
          lang={lang}
          ownerRoleId={defaultRole?.roleId}
          busy={busy}
          onCreate={async (title) => {
            if (!defaultRole) return;
            setBusy(true);
            try {
              const created = await rcCreateArea(defaultRole.roleId, title);
              await load();
              setSelected(created.areaId);
              setError(null);
            } catch (e) {
              setError(describe(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      </aside>

      <section className="rc-chat-main">
        {selectedArea === null
          ? <p className="rc-note">{t.empty}</p>
          : <RcAreaView
              key={selectedArea.areaId}
              lang={lang}
              area={selectedArea}
              roles={roles}
              onError={setError}
            />}
      </section>

      {error !== null && <p className="rc-auth-error rc-chat-error">{error}</p>}
    </div>
  );
}

// -- Ein Bereich --------------------------------------------------------------

function RcAreaView({
  lang, area, roles, onError
}: {
  lang: RcLang;
  area: RcArea;
  roles: readonly RcRole[];
  onError: (message: string) => void;
}) {
  const areaId = area.areaId;
  const t = rcCopy[lang].chat;

  const [messages, setMessages] = useState<readonly RcMessage[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'chat' | 'topics' | 'polls'>('chat');

  // Was markiert ist, wird zu einem Thema. Die Markierung lebt HIER und nicht
  // im Themen-Reiter: sie entsteht im Gespräch, und sie muss den Wechsel
  // dorthin überleben — sonst markiert man, wechselt, und alles ist weg.
  const [selection, setSelection] = useState<readonly string[]>([]);

  const bottom = useRef<HTMLDivElement>(null);

  const describe = (e: unknown) => {
    const auth = rcCopy[lang].auth;
    return e instanceof RcRequestError ? auth.errors[e.code] ?? auth.unknownError : auth.unknownError;
  };

  const writable = useMemo(() => roles.find((r) => r.hasKey) ?? roles[0], [roles]);

  const refresh = useCallback(async () => {
    try {
      const [feed, members] = await Promise.all([rcFeed(areaId, 50, writable?.roleId), rcMembers(areaId)]);
      setMessages(feed.messages ?? []);
      setMemberCount(members.members?.length ?? 0);
    } catch (e) {
      onError(describe(e));
    } finally {
      setLoading(false);
    }
  }, [areaId, onError, lang, writable]);

  useEffect(() => { void refresh(); }, [refresh]);

  // 9.9 — Den Lesestand setzen, wenn der Bereich wirklich angesehen wurde.
  // Nicht beim Laden der Liste: „gelesen" soll heissen, dass jemand hingesehen
  // hat, nicht dass ein Programm etwas geholt hat.
  useEffect(() => {
    if (loading || messages.length === 0 || !writable) return;
    void rcMarkRead(areaId, writable.roleId).catch(() => undefined);
  }, [loading, messages.length, areaId, writable]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  const breaks = useMemo(() => rcEpochBreaks(messages), [messages]);

  if (loading) return <p className="rc-note">{t.loading}</p>;

  const th = rcCopy[lang].threads;

  const toggle = (id: string) =>
    setSelection((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));

  return (
    <>
      <header className="rc-chat-top">
        <nav className="rc-tabs">
          {([
            ['chat', th.tabChat],
            ['topics', th.tabTopics],
            ['polls', th.tabPolls]
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="rc-tab"
              aria-current={tab === key}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <span className="rc-chat-count">{rcPlural(lang, t.members, memberCount)}</span>
      </header>

      {tab === 'topics' && (
        <RcTopics
          lang={lang}
          areaId={areaId}
          selection={selection}
          onClearSelection={() => setSelection([])}
          onError={onError}
        />
      )}

      {tab === 'polls' && (
        <RcPolls lang={lang} areaId={areaId} role={writable} onError={onError} />
      )}

      {tab === 'chat' && (
        <div className="rc-feed">
          {messages.length === 0 && <p className="rc-note">{t.empty}</p>}

          {messages.map((message) => (
            <div key={message.messageId}>
              {breaks.has(message.messageId) && (
                <div className="rc-epoch-break">
                  <span>{t.epochBreak}</span>
                </div>
              )}
              <RcMessageRow
                lang={lang}
                message={message}
                mine={roles.some((r) => r.roleId === message.authorRoleId)}
                role={writable}
                selected={selection.includes(message.messageId)}
                onSelect={() => toggle(message.messageId)}
                onError={onError}
                onWithdraw={async () => {
                  try {
                    await rcHide(message.messageId, true);
                    await refresh();
                  } catch (e) {
                    onError(describe(e));
                  }
                }}
              />
            </div>
          ))}
          <div ref={bottom} />
        </div>
      )}

      {tab === 'chat' && !area.canWrite && <p className="rc-note">{t.readOnly}</p>}

      {tab === 'chat' && writable && area.canWrite && (
        <RcComposer
          lang={lang}
          role={writable}
          roles={roles}
          onSend={async (text, chainBound, roleId) => {
            try {
              await rcPost(areaId, roleId, text, chainBound);
              await refresh();
            } catch (e) {
              onError(describe(e));
              throw e;
            }
          }}
        />
      )}
    </>
  );
}

// -- Eine Nachricht -----------------------------------------------------------

function RcMessageRow({
  lang, message, mine, role, selected, onSelect, onWithdraw, onError
}: {
  lang: RcLang;
  message: RcMessage;
  mine: boolean;
  role: RcRole | undefined;
  selected: boolean;
  onSelect: () => void;
  onWithdraw: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const t = rcCopy[lang].chat;

  // Fünf Zustände, fünf Darstellungen. Welcher vorliegt, entscheidet
  // `rcMessageState` — dort ist es prüfbar, hier wäre es das nicht.
  const state = rcMessageState(message);

  if (state.kind === 'withdrawn') {
    return <p className="rc-msg rc-msg-stone">{t.withdrawn}</p>;
  }

  if (state.kind === 'moderated') {
    return <p className="rc-msg rc-msg-stone">{t.hiddenByModerator}</p>;
  }

  if (state.kind === 'sealed') {
    return <p className="rc-msg rc-msg-sealed">{t.beforeYou}</p>;
  }

  // Der Grund steht im Klartext daneben, damit eine Meldung darüber
  // brauchbar ist. „Etwas ging schief" allein hilft niemandem weiter.
  if (state.kind === 'broken') {
    return (
      <p className="rc-msg rc-msg-broken">
        {t.damaged} <code>{state.reason}</code>
      </p>
    );
  }

  return (
    <article className="rc-msg" data-selected={selected}>
      <header className="rc-msg-head">
        {/* Das Kästchen ist der Anfang eines Themas: markieren, dann drüben
            benennen. Deshalb steht es hier und nicht im Themen-Reiter. */}
        <input
          type="checkbox"
          className="rc-msg-pick"
          checked={selected}
          onChange={onSelect}
        />
        <span className="rc-msg-author">{message.authorRoleId?.slice(0, 8) ?? '—'}</span>
        <time dateTime={message.postedUtc}>
          {new Date(message.postedUtc).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
        </time>
        {message.version > 1 && <span className="rc-msg-flag">v{message.version}</span>}
        {mine && (
          <button type="button" className="rc-msg-action" onClick={() => void onWithdraw()}>
            {t.withdraw}
          </button>
        )}
      </header>

      <p className="rc-msg-body">{message.body}</p>

      <RcReactions
        lang={lang}
        messageId={message.messageId}
        role={role}
        mine={(message.yourReaction ?? null) as RcReaction | null}
        tally={message.reactions}
        onError={onError}
      />

      {/* Zu sehen gibt es etwas, wenn Dateien dranhängen; zu tun, wenn der
          Beitrag einem selbst gehört (9.10). Sonst gar nichts — ein Verlauf mit
          fünfzig Beiträgen soll nicht fünfzig weitere Anfragen auslösen, die
          fünfzig leere Listen zurückbringen. */}
      {(message.attachmentCount > 0 || mine) && (
        <RcAttachments
          lang={lang}
          messageId={message.messageId}
          count={message.attachmentCount}
          mine={mine}
          onError={onError}
        />
      )}
    </article>
  );
}

// -- Schreiben ----------------------------------------------------------------

function RcComposer({
  lang, role, roles, onSend
}: {
  lang: RcLang;
  role: RcRole;
  roles: readonly RcRole[];
  onSend: (text: string, chainBound: boolean, roleId: string) => Promise<void>;
}) {
  const t = rcCopy[lang].chat;

  const [text, setText] = useState('');
  const [chainBound, setChainBound] = useState(false);
  const [roleId, setRoleId] = useState(role.roleId);
  const [sending, setSending] = useState(false);

  const usable = roles.filter((r) => r.hasKey);

  const send = async () => {
    if (text.trim().length === 0 || sending) return;
    setSending(true);
    try {
      await onSend(text, chainBound, roleId);
      setText('');

      // „Zu Protokoll" fällt nach dem Absenden zurück. Bliebe es stehen, liefe
      // die Kette voll, ohne dass es jemand beschlossen hätte.
      setChainBound(false);
    } catch {
      // Der Text bleibt stehen — er ist noch nicht abgeschickt.
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      className="rc-composer"
      onSubmit={(e) => { e.preventDefault(); void send(); }}
    >
      <label className="rc-composer-as">
        <span>{t.writingAs}</span>
        {usable.length > 1 ? (
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            {usable.map((r) => (
              <option key={r.roleId} value={r.roleId}>
                {r.displayName ?? r.roleId.slice(0, 8)}
              </option>
            ))}
          </select>
        ) : (
          <strong>{role.displayName ?? role.roleId.slice(0, 8)}</strong>
        )}
      </label>

      <textarea
        value={text}
        rows={2}
        placeholder={t.placeholder}
        disabled={sending}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
        }}
      />

      <div className="rc-composer-row">
        <label className="rc-check" title={t.toRecordWhy}>
          <input
            type="checkbox"
            checked={chainBound}
            onChange={(e) => setChainBound(e.target.checked)}
          />
          <span>{t.toRecord}</span>
        </label>

        <button type="submit" className="rc-btn" disabled={sending || text.trim().length === 0}>
          {sending ? t.sending : t.send}
        </button>
      </div>

      {chainBound && <p className="rc-note rc-composer-why">{t.toRecordWhy}</p>}
    </form>
  );
}

// -- Bereich anlegen ----------------------------------------------------------

function RcNewArea({
  lang, ownerRoleId, busy, onCreate
}: {
  lang: RcLang;
  ownerRoleId: string | undefined;
  busy: boolean;
  onCreate: (title: string) => Promise<void>;
}) {
  const t = rcCopy[lang].chat;
  const [title, setTitle] = useState('');

  if (ownerRoleId === undefined) return null;

  return (
    <form
      className="rc-new-area"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim().length === 0) return;
        void onCreate(title).then(() => setTitle(''));
      }}
    >
      <label className="rc-field">
        <span>{t.newArea}</span>
        <input
          type="text"
          value={title}
          placeholder={t.areaName}
          disabled={busy}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <button type="submit" className="rc-btn rc-btn-quiet" disabled={busy || title.trim().length === 0}>
        {t.create}
      </button>
    </form>
  );
}

export default RcChat;
