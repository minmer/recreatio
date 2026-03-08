import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';
import {
  addChatParticipants,
  createChatConversation,
  createChatPublicLink,
  getChatConversation,
  getChatMessages,
  getRoles,
  listChatConversations,
  markChatConversationRead,
  pollChatMessages,
  removeChatParticipant,
  sendChatMessage,
  type ChatDetail,
  type ChatMessage,
  type ChatSummary,
  type RoleResponse
} from '../../lib/api';

function formatDateTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(parsed);
}

function mergeMessages(existing: ChatMessage[], next: ChatMessage[]) {
  const bySequence = new Map<number, ChatMessage>();
  for (const message of existing) {
    bySequence.set(message.sequence, message);
  }
  for (const message of next) {
    bySequence.set(message.sequence, message);
  }
  return Array.from(bySequence.values()).sort((a, b) => a.sequence - b.sequence);
}

function parseSubjectTargets(value: string): Array<{ subjectType: 'role' | 'user'; subjectId: string }> {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => {
      const [prefix, maybeId] = item.includes(':') ? item.split(':', 2) : ['role', item];
      const subjectType: 'role' | 'user' = prefix.trim().toLowerCase() === 'user' ? 'user' : 'role';
      const subjectId = (maybeId ?? '').trim();
      return { subjectType, subjectId };
    })
    .filter((item) => item.subjectId.length > 0);
}

function getRoleNick(role: RoleResponse) {
  const nickField = role.fields.find((field) => field.fieldType.toLowerCase() === 'nick' && field.plainValue?.trim());
  if (nickField?.plainValue) {
    return nickField.plainValue.trim();
  }
  return role.roleId;
}

export function ChatPage({
  copy,
  onAuthAction,
  authLabel,
  showProfileMenu,
  onProfileNavigate,
  onToggleSecureMode,
  onLogout,
  secureMode,
  onNavigate,
  language,
  onLanguageChange
}: {
  copy: Copy;
  onAuthAction: () => void;
  authLabel: string;
  showProfileMenu: boolean;
  onProfileNavigate: () => void;
  onToggleSecureMode: () => void;
  onLogout: () => void;
  secureMode: boolean;
  onNavigate: (route: RouteKey) => void;
  language: 'pl' | 'en' | 'de';
  onLanguageChange: (language: 'pl' | 'en' | 'de') => void;
}) {
  const [conversations, setConversations] = useState<ChatSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ChatDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createScopeType, setCreateScopeType] = useState<'global' | 'parish' | 'event' | 'limanowa' | 'cogita'>('global');
  const [createScopeId, setCreateScopeId] = useState('');
  const [createChatType, setCreateChatType] = useState<'group' | 'direct' | 'public-board'>('group');
  const [createParticipantSubjects, setCreateParticipantSubjects] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [messageVisibility, setMessageVisibility] = useState<'internal' | 'public'>('internal');
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [participantSubjectType, setParticipantSubjectType] = useState<'role' | 'user'>('role');
  const [participantSubjectId, setParticipantSubjectId] = useState('');
  const [participantCanWrite, setParticipantCanWrite] = useState(true);
  const [participantCanManage, setParticipantCanManage] = useState(false);
  const [participantCanRespondPublic, setParticipantCanRespondPublic] = useState(true);
  const [participantIncludeHistory, setParticipantIncludeHistory] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'parish' | 'event' | 'limanowa' | 'cogita'>('all');
  const [availableRoles, setAvailableRoles] = useState<RoleResponse[]>([]);
  const [senderRoleId, setSenderRoleId] = useState('');
  const lastReadSentRef = useRef<number>(0);
  const lastSequenceRef = useRef<number>(0);

  const selectedSummary = useMemo(
    () => conversations.find((item) => item.conversationId === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const visibleConversations = useMemo(() => {
    if (scopeFilter === 'all') return conversations;
    return conversations.filter((item) => item.scopeType === scopeFilter);
  }, [conversations, scopeFilter]);

  const loadConversations = useCallback(async () => {
    if (!showProfileMenu) return;
    setLoadingList(true);
    try {
      const list = await listChatConversations();
      setConversations(list);
      if (list.length > 0 && !selectedConversationId) {
        setSelectedConversationId(list[0].conversationId);
      }
      if (selectedConversationId && !list.some((item) => item.conversationId === selectedConversationId)) {
        setSelectedConversationId(list[0]?.conversationId ?? null);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load chats.');
    } finally {
      setLoadingList(false);
    }
  }, [selectedConversationId, showProfileMenu]);

  const loadConversation = useCallback(async () => {
    if (!showProfileMenu || !selectedConversationId) {
      setSelectedConversation(null);
      setMessages([]);
      return;
    }

    setLoadingConversation(true);
    try {
      const detail = await getChatConversation(selectedConversationId);
      setSelectedConversation(detail);
      const bundle = await getChatMessages({ conversationId: selectedConversationId, take: 120 });
      setMessages(bundle.messages);
      lastSequenceRef.current = bundle.lastSequence;
      lastReadSentRef.current = Math.max(lastReadSentRef.current, bundle.lastSequence);
      if (bundle.lastSequence > 0) {
        void markChatConversationRead(selectedConversationId, bundle.lastSequence).catch(() => undefined);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load conversation.');
    } finally {
      setLoadingConversation(false);
    }
  }, [selectedConversationId, showProfileMenu]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!showProfileMenu) return;
    let active = true;
    const tick = async () => {
      if (!active) return;
      try {
        const list = await listChatConversations();
        if (!active) return;
        setConversations(list);
      } catch {
        // ignore periodic refresh errors
      }
      if (!active) return;
      const delay = document.hidden ? 45000 : 20000;
      window.setTimeout(tick, delay);
    };
    const timer = window.setTimeout(tick, 20000);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [showProfileMenu]);

  useEffect(() => {
    if (!showProfileMenu) {
      setAvailableRoles([]);
      setSenderRoleId('');
      return;
    }

    let active = true;
    const loadRoles = async () => {
      try {
        const roles = await getRoles();
        if (!active) return;
        setAvailableRoles(roles);
      } catch {
        if (!active) return;
        setAvailableRoles([]);
      }
    };
    void loadRoles();
    return () => {
      active = false;
    };
  }, [showProfileMenu]);

  useEffect(() => {
    if (!showProfileMenu || !selectedConversationId || !selectedConversation?.summary.canRead) return;
    let active = true;
    const poll = async () => {
      while (active) {
        const afterSequence = lastSequenceRef.current;
        try {
          const response = await pollChatMessages({
            conversationId: selectedConversationId,
            afterSequence,
            waitSeconds: document.hidden ? 25 : 8,
            take: 120
          });
          if (!active) return;
          if (response.messages.length > 0) {
            lastSequenceRef.current = Math.max(lastSequenceRef.current, response.lastSequence);
            setMessages((current) => mergeMessages(current, response.messages));
            if (response.lastSequence > lastReadSentRef.current) {
              lastReadSentRef.current = response.lastSequence;
              void markChatConversationRead(selectedConversationId, response.lastSequence).catch(() => undefined);
            }
          }
        } catch {
          await new Promise((resolve) => window.setTimeout(resolve, 1800));
        }
      }
    };
    void poll();
    return () => {
      active = false;
    };
  }, [selectedConversation?.summary.canRead, selectedConversationId, showProfileMenu]);

  useEffect(() => {
    lastSequenceRef.current = messages.length > 0 ? messages[messages.length - 1].sequence : 0;
  }, [messages]);

  useEffect(() => {
    if (!selectedConversation?.summary.isPublic && messageVisibility === 'public') {
      setMessageVisibility('internal');
    }
  }, [messageVisibility, selectedConversation?.summary.isPublic]);

  const handleCreateConversation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createTitle.trim()) {
      setStatus('Conversation title is required.');
      return;
    }

    try {
      setStatus('Creating conversation...');
      const participants = parseSubjectTargets(createParticipantSubjects).map((target) => ({
        subjectType: target.subjectType,
        subjectId: target.subjectId,
        canRead: true,
        canWrite: true,
        canManage: false,
        canRespondPublic: true
      }));

      const detail = await createChatConversation({
        chatType: createChatType,
        scopeType: createScopeType,
        scopeId: createScopeId.trim() || null,
        title: createTitle.trim(),
        description: createDescription.trim() || null,
        isPublic: createChatType === 'public-board',
        publicReadEnabled: createChatType === 'public-board',
        publicQuestionEnabled: createChatType === 'public-board',
        participants
      });

      setCreateTitle('');
      setCreateDescription('');
      setCreateScopeId('');
      setCreateParticipantSubjects('');
      setStatus('Conversation created.');
      setSelectedConversationId(detail.summary.conversationId);
      await loadConversations();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to create conversation.');
    }
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedConversationId) return;
    if (!newMessage.trim()) return;

    try {
      const message = await sendChatMessage(selectedConversationId, {
        text: newMessage.trim(),
        visibility: messageVisibility,
        messageType: messageVisibility === 'public' ? 'answer' : 'text',
        senderRoleId: senderRoleId || undefined
      });
      lastSequenceRef.current = Math.max(lastSequenceRef.current, message.sequence);
      setMessages((current) => mergeMessages(current, [message]));
      setNewMessage('');
      if (message.sequence > lastReadSentRef.current) {
        lastReadSentRef.current = message.sequence;
        void markChatConversationRead(selectedConversationId, message.sequence).catch(() => undefined);
      }
      void loadConversations();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to send message.');
    }
  };

  const handleAddParticipant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedConversationId) return;
    if (!participantSubjectId.trim()) return;

    try {
      await addChatParticipants(selectedConversationId, {
        includeHistory: participantIncludeHistory,
        participants: [
          {
            subjectType: participantSubjectType,
            subjectId: participantSubjectId.trim(),
            canRead: true,
            canWrite: participantCanWrite,
            canManage: participantCanManage,
            canRespondPublic: participantCanRespondPublic
          }
        ]
      });
      setParticipantSubjectId('');
      setParticipantCanWrite(true);
      setParticipantCanManage(false);
      setParticipantCanRespondPublic(true);
      setParticipantIncludeHistory(true);
      setStatus(
        participantIncludeHistory
          ? 'Participant added with full history and keys rotated.'
          : 'Participant added from current point (no prior history visible).'
      );
      await loadConversation();
      await loadConversations();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to add participant.');
    }
  };

  const handleRemoveParticipant = async (participantId: string) => {
    if (!selectedConversationId) return;
    try {
      await removeChatParticipant(selectedConversationId, participantId);
      setStatus('Participant removed and keys rotated.');
      await loadConversation();
      await loadConversations();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to remove participant.');
    }
  };

  const handleCreatePublicLink = async () => {
    if (!selectedConversationId) return;
    try {
      const response = await createChatPublicLink(selectedConversationId, {});
      const url = `${window.location.origin}/#/chat/public/${encodeURIComponent(response.code)}`;
      setPublicLink(url);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setStatus('Public link created and copied to clipboard.');
      await loadConversations();
      await loadConversation();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to create public link.');
    }
  };

  const canSendInternal = selectedConversation?.summary.canWrite ?? false;
  const canSendPublic = (selectedConversation?.summary.canWrite || selectedConversation?.summary.canRespondPublic) ?? false;

  if (!showProfileMenu) {
    return (
      <div className="chat-page chat-page-guest">
        <header className="chat-header">
          <a href="/#/section-1" className="chat-brand" onClick={() => onNavigate('home')}>
            REcreatio
          </a>
          <div className="chat-header-actions">
            <LanguageSelect value={language} onChange={onLanguageChange} />
            <AuthAction
              copy={copy}
              label={authLabel}
              isAuthenticated={showProfileMenu}
              secureMode={secureMode}
              onLogin={onAuthAction}
              onProfileNavigate={onProfileNavigate}
              onToggleSecureMode={onToggleSecureMode}
              onLogout={onLogout}
              variant="ghost"
            />
          </div>
        </header>
        <main className="chat-guest-main">
          <h1>{copy.chat.title}</h1>
          <p>{copy.chat.subtitle}</p>
          <button type="button" className="cta" onClick={onAuthAction}>{copy.chat.loginCta}</button>
        </main>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <a href="/#/section-1" className="chat-brand" onClick={() => onNavigate('home')}>
          REcreatio
        </a>
        <nav className="chat-top-nav">
          <a href="/#/parish">{copy.nav.parish}</a>
          <a href="/#/event">{copy.nav.events}</a>
          <a href="/#/limanowa">{copy.nav.limanowa}</a>
          <a href="/#/cogita">{copy.nav.cogita}</a>
        </nav>
        <div className="chat-header-actions">
          <LanguageSelect value={language} onChange={onLanguageChange} />
          <AuthAction
            copy={copy}
            label={authLabel}
            isAuthenticated={showProfileMenu}
            secureMode={secureMode}
            onLogin={onAuthAction}
            onProfileNavigate={onProfileNavigate}
            onToggleSecureMode={onToggleSecureMode}
            onLogout={onLogout}
            variant="ghost"
          />
        </div>
      </header>

      <main className="chat-main">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-head">
            <h1>{copy.chat.title}</h1>
            <select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value as typeof scopeFilter)}
            >
              <option value="all">All scopes</option>
              <option value="global">Global</option>
              <option value="parish">Parish</option>
              <option value="event">Event</option>
              <option value="limanowa">Limanowa</option>
              <option value="cogita">Cogita</option>
            </select>
          </div>

          <form className="chat-create-form" onSubmit={handleCreateConversation}>
            <h2>New conversation</h2>
            <input value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} placeholder="Title" />
            <input
              value={createDescription}
              onChange={(event) => setCreateDescription(event.target.value)}
              placeholder="Description (optional)"
            />
            <div className="chat-create-row">
              <select value={createScopeType} onChange={(event) => setCreateScopeType(event.target.value as typeof createScopeType)}>
                <option value="global">global</option>
                <option value="parish">parish</option>
                <option value="event">event</option>
                <option value="limanowa">limanowa</option>
                <option value="cogita">cogita</option>
              </select>
              <select value={createChatType} onChange={(event) => setCreateChatType(event.target.value as typeof createChatType)}>
                <option value="group">group</option>
                <option value="direct">direct</option>
                <option value="public-board">public-board</option>
              </select>
            </div>
            <input
              value={createScopeId}
              onChange={(event) => setCreateScopeId(event.target.value)}
              placeholder="Scope id (slug/id, optional)"
            />
            <textarea
              value={createParticipantSubjects}
              onChange={(event) => setCreateParticipantSubjects(event.target.value)}
              placeholder="Participants: role:<id>, user:<id> (comma separated, optional)"
            />
            <button type="submit" className="cta">Create</button>
          </form>

          <div className="chat-list">
            {loadingList && <div className="chat-note">Loading chats...</div>}
            {!loadingList && visibleConversations.length === 0 && <div className="chat-note">No conversations yet.</div>}
            {visibleConversations.map((conversation) => (
              <button
                key={conversation.conversationId}
                type="button"
                className={`chat-item ${selectedConversationId === conversation.conversationId ? 'active' : ''}`}
                onClick={() => {
                  setSelectedConversationId(conversation.conversationId);
                  setPublicLink(null);
                }}
              >
                <strong>{conversation.title}</strong>
                <span>{conversation.scopeType}{conversation.scopeId ? ` / ${conversation.scopeId}` : ''}</span>
                <span>{conversation.unreadCount > 0 ? `${conversation.unreadCount} unread` : 'up to date'}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="chat-thread">
          {!selectedConversationId && <div className="chat-note">Choose a conversation.</div>}
          {selectedConversationId && loadingConversation && <div className="chat-note">Loading conversation...</div>}
          {selectedConversation && (
            <>
              <header className="chat-thread-head">
                <div>
                  <h2>{selectedConversation.summary.title}</h2>
                  <p>
                    {selectedConversation.summary.scopeType}
                    {selectedConversation.summary.scopeId ? ` / ${selectedConversation.summary.scopeId}` : ''}
                    {' · '}
                    {selectedConversation.summary.chatType}
                    {selectedConversation.summary.isPublic ? ' · public-enabled' : ''}
                  </p>
                </div>
                {selectedConversation.summary.isPublic && selectedConversation.summary.canManage && (
                  <button type="button" className="ghost" onClick={handleCreatePublicLink}>Create public link</button>
                )}
              </header>

              {publicLink && (
                <div className="chat-public-link">
                  <a href={publicLink}>{publicLink}</a>
                </div>
              )}

              <div className="chat-messages" role="log" aria-live="polite">
                {messages.length === 0 && <div className="chat-note">No messages yet.</div>}
                {messages.map((message) => (
                  <article key={message.messageId} className={`chat-message ${message.visibility === 'public' ? 'public' : ''}`}>
                    <header>
                      <strong>{message.senderDisplay}</strong>
                      <span>{message.messageType}</span>
                      <time>{formatDateTime(message.createdUtc)}</time>
                    </header>
                    <p>{message.text}</p>
                  </article>
                ))}
              </div>

              <form className="chat-send-form" onSubmit={handleSendMessage}>
                <textarea
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  placeholder="Write a message..."
                  rows={3}
                />
                <div className="chat-send-actions">
                  {availableRoles.length > 0 && (
                    <select value={senderRoleId} onChange={(event) => setSenderRoleId(event.target.value)}>
                      <option value="">send as account</option>
                      {availableRoles.map((role) => (
                        <option key={role.roleId} value={role.roleId}>
                          role: {getRoleNick(role)}
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedConversation.summary.isPublic && canSendPublic && (
                    <select value={messageVisibility} onChange={(event) => setMessageVisibility(event.target.value as 'internal' | 'public')}>
                      <option value="internal">internal</option>
                      <option value="public">public</option>
                    </select>
                  )}
                  <button
                    type="submit"
                    className="cta"
                    disabled={messageVisibility === 'public' ? !canSendPublic : !canSendInternal}
                  >
                    Send
                  </button>
                </div>
              </form>

              {selectedConversation.summary.canManage && (
                <section className="chat-participants">
                  <h3>Participants</h3>
                  <form onSubmit={handleAddParticipant} className="chat-participant-form">
                    <select
                      value={participantSubjectType}
                      onChange={(event) => setParticipantSubjectType(event.target.value as 'role' | 'user')}
                    >
                      <option value="role">role</option>
                      <option value="user">user</option>
                    </select>
                    <input
                      value={participantSubjectId}
                      onChange={(event) => setParticipantSubjectId(event.target.value)}
                      placeholder={participantSubjectType === 'role' ? 'Role ID' : 'User ID'}
                    />
                    <label>
                      <input type="checkbox" checked={participantCanWrite} onChange={(event) => setParticipantCanWrite(event.target.checked)} />
                      write
                    </label>
                    <label>
                      <input type="checkbox" checked={participantCanManage} onChange={(event) => setParticipantCanManage(event.target.checked)} />
                      manage
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={participantCanRespondPublic}
                        onChange={(event) => setParticipantCanRespondPublic(event.target.checked)}
                      />
                      public-answer
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={participantIncludeHistory}
                        onChange={(event) => setParticipantIncludeHistory(event.target.checked)}
                      />
                      include-history
                    </label>
                    <button type="submit" className="ghost">Add participant</button>
                  </form>

                  <ul>
                    {selectedConversation.participants.map((participant) => (
                      <li key={participant.participantId}>
                        <span>{participant.subjectType}: {participant.subjectId}</span>
                        <span>
                          {participant.canManage ? 'manage' : participant.canWrite ? 'write' : 'read'}
                          {participant.canRespondPublic ? ' +public' : ''}
                        </span>
                        {!participant.removedUtc && (
                          <button type="button" className="ghost" onClick={() => handleRemoveParticipant(participant.participantId)}>
                            Remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </section>
      </main>

      <footer className="chat-footer">
        <span>{copy.footer.headline}</span>
        {selectedSummary && <span>Updated: {formatDateTime(selectedSummary.updatedUtc)}</span>}
      </footer>

      {status && <div className="chat-status">{status}</div>}
    </div>
  );
}
