import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';
import {
  addChatParticipants,
  createChatConversation,
  createChatInviteLink,
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

const JOIN_CONVERSATION_KEY = 'chatJoinConversationId';

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
  const [createScopeId, setCreateScopeId] = useState('');
  const [createChatType, setCreateChatType] = useState<'group' | 'direct' | 'public-board'>('group');
  const [createParticipantSubjects, setCreateParticipantSubjects] = useState('');
  const [createSelectedRoleIds, setCreateSelectedRoleIds] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [messageVisibility, setMessageVisibility] = useState<'internal' | 'public'>('internal');
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [participantSubjectType, setParticipantSubjectType] = useState<'role' | 'user'>('role');
  const [participantSubjectId, setParticipantSubjectId] = useState('');
  const [participantCanWrite, setParticipantCanWrite] = useState(true);
  const [participantCanManage, setParticipantCanManage] = useState(false);
  const [participantCanRespondPublic, setParticipantCanRespondPublic] = useState(true);
  const [participantIncludeHistory, setParticipantIncludeHistory] = useState(true);
  const scopeFilter = 'all' as const;
  const [availableRoles, setAvailableRoles] = useState<RoleResponse[]>([]);
  const [senderRoleId, setSenderRoleId] = useState('');
  const lastReadSentRef = useRef<number>(0);
  const lastSequenceRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-select a conversation after joining via invite link
  useEffect(() => {
    const pendingId = sessionStorage.getItem(JOIN_CONVERSATION_KEY);
    if (pendingId) {
      sessionStorage.removeItem(JOIN_CONVERSATION_KEY);
      setSelectedConversationId(pendingId);
    }
  }, []);

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 4500);
    return () => window.clearTimeout(timer);
  }, [status]);

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
      const subjectTargets = availableRoles.length > 0
        ? createSelectedRoleIds.map((id) => ({ subjectType: 'role' as const, subjectId: id }))
        : parseSubjectTargets(createParticipantSubjects);
      const participants = subjectTargets.map((target) => ({
        subjectType: target.subjectType,
        subjectId: target.subjectId,
        canRead: true,
        canWrite: true,
        canManage: false,
        canRespondPublic: true
      }));

      const detail = await createChatConversation({
        chatType: createChatType,
        scopeType: 'global',
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
      setCreateSelectedRoleIds([]);
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

  const handleCreateInviteLink = async () => {
    if (!selectedConversationId) return;
    try {
      const response = await createChatInviteLink(selectedConversationId, {});
      const url = `${window.location.origin}/#/chat/invite/${encodeURIComponent(response.code)}`;
      setInviteLink(url);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setStatus('Invite link created and copied to clipboard.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to create invite link.');
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
          </div>

          <form className="chat-create-form" onSubmit={handleCreateConversation}>
            <h2>New conversation</h2>
            <input value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} placeholder="Title" />
            <input
              value={createDescription}
              onChange={(event) => setCreateDescription(event.target.value)}
              placeholder="Description (optional)"
            />
            <select value={createChatType} onChange={(event) => setCreateChatType(event.target.value as typeof createChatType)}>
              <option value="group">Group</option>
              <option value="direct">Direct message</option>
              <option value="public-board">Public Q&amp;A board</option>
            </select>
            {availableRoles.length > 0 ? (
              <div className="chat-field-row">
                <label className="chat-field-label">Add participants</label>
                <select
                  multiple
                  className="chat-role-select"
                  value={createSelectedRoleIds}
                  onChange={(event) => {
                    const selected = Array.from(event.target.selectedOptions, (opt) => opt.value);
                    setCreateSelectedRoleIds(selected);
                  }}
                >
                  {availableRoles.map((role) => (
                    <option key={role.roleId} value={role.roleId}>
                      {getRoleNick(role)}
                    </option>
                  ))}
                </select>
                <span className="chat-field-hint">Hold Ctrl / Cmd to select multiple</span>
              </div>
            ) : (
              <textarea
                value={createParticipantSubjects}
                onChange={(event) => setCreateParticipantSubjects(event.target.value)}
                placeholder="Add participants later via the conversation settings"
              />
            )}
            <button type="submit" className="cta">Create</button>
          </form>

          <div className="chat-list">
            {loadingList && <div className="chat-note">Loading chats...</div>}
            {!loadingList && conversations.length === 0 && (
              <div className="chat-note">No conversations yet — create one above to get started.</div>
            )}
            {!loadingList && conversations.length > 0 && visibleConversations.length === 0 && (
              <div className="chat-note">No conversations match this filter.</div>
            )}
            {visibleConversations.map((conversation) => (
              <button
                key={conversation.conversationId}
                type="button"
                className={`chat-item ${selectedConversationId === conversation.conversationId ? 'active' : ''}`}
                onClick={() => {
                  setSelectedConversationId(conversation.conversationId);
                  setPublicLink(null);
                  setInviteLink(null);
                }}
              >
                <strong>{conversation.title}</strong>
                {conversation.scopeId && <span>{conversation.scopeId}</span>}
                <span>{conversation.unreadCount > 0 ? `${conversation.unreadCount} unread` : ''}</span>
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
                    {selectedConversation.summary.chatType === 'group' ? 'Group chat'
                      : selectedConversation.summary.chatType === 'direct' ? 'Direct message'
                      : 'Public Q&A board'}
                    {selectedConversation.summary.scopeId ? ` · ${selectedConversation.summary.scopeId}` : ''}
                  </p>
                </div>
                <div className="chat-thread-actions">
                  {selectedConversation.summary.canManage && (
                    <button type="button" className="ghost" onClick={handleCreateInviteLink}>
                      Share invite link
                    </button>
                  )}
                  {selectedConversation.summary.isPublic && selectedConversation.summary.canManage && (
                    <button type="button" className="ghost" onClick={handleCreatePublicLink}>Create public link</button>
                  )}
                </div>
              </header>

              {(inviteLink || publicLink) && (
                <div className="chat-thread-links">
                  {inviteLink && (
                    <div className="chat-invite-link-box">
                      <span className="chat-invite-link-label">Invite link — anyone with this link can read and join:</span>
                      <a href={inviteLink} target="_blank" rel="noopener noreferrer" className="chat-invite-link-url">{inviteLink}</a>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => navigator.clipboard.writeText(inviteLink).then(() => setStatus('Invite link copied.')).catch(() => undefined)}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                  {publicLink && (
                    <div className="chat-public-link">
                      <span>Public board link:</span>
                      <a href={publicLink}>{publicLink}</a>
                    </div>
                  )}
                </div>
              )}

              <div className="chat-messages" role="log" aria-live="polite">
                {messages.length === 0 && <div className="chat-note">No messages yet. Say hello!</div>}
                {messages.map((message) => (
                  <article key={message.messageId} className={`chat-message ${message.visibility === 'public' ? 'public' : ''}`}>
                    <header>
                      <strong>{message.senderDisplay}</strong>
                      {message.messageType !== 'text' && <span className="chat-message-type">{message.messageType}</span>}
                      <time>{formatDateTime(message.createdUtc)}</time>
                    </header>
                    <p>{message.text}</p>
                  </article>
                ))}
                <div ref={messagesEndRef} />
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
                      <option value="">— as my account —</option>
                      {availableRoles.map((role) => (
                        <option key={role.roleId} value={role.roleId}>
                          {getRoleNick(role)}
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedConversation.summary.isPublic && canSendPublic && (
                    <select value={messageVisibility} onChange={(event) => setMessageVisibility(event.target.value as 'internal' | 'public')}>
                      <option value="internal">Members only</option>
                      <option value="public">Post publicly</option>
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
                      onChange={(event) => {
                        setParticipantSubjectType(event.target.value as 'role' | 'user');
                        setParticipantSubjectId('');
                      }}
                    >
                      <option value="role">role</option>
                      <option value="user">user</option>
                    </select>
                    {participantSubjectType === 'role' && availableRoles.length > 0 ? (
                      <select
                        value={participantSubjectId}
                        onChange={(event) => setParticipantSubjectId(event.target.value)}
                      >
                        <option value="">— select role —</option>
                        {availableRoles.map((role) => (
                          <option key={role.roleId} value={role.roleId}>
                            {getRoleNick(role)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={participantSubjectId}
                        onChange={(event) => setParticipantSubjectId(event.target.value)}
                        placeholder={participantSubjectType === 'role' ? 'Role ID' : 'User ID'}
                      />
                    )}
                    <label>
                      <input type="checkbox" checked={participantCanWrite} onChange={(event) => setParticipantCanWrite(event.target.checked)} />
                      Can write
                    </label>
                    <label>
                      <input type="checkbox" checked={participantCanManage} onChange={(event) => setParticipantCanManage(event.target.checked)} />
                      Can manage
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={participantCanRespondPublic}
                        onChange={(event) => setParticipantCanRespondPublic(event.target.checked)}
                      />
                      Can answer publicly
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={participantIncludeHistory}
                        onChange={(event) => setParticipantIncludeHistory(event.target.checked)}
                      />
                      Include history
                    </label>
                    <button type="submit" className="ghost">Add participant</button>
                  </form>

                  <ul>
                    {selectedConversation.participants.map((participant) => (
                      <li key={participant.participantId}>
                        <span>
                          {participant.displayLabel
                            ?? `${participant.subjectType === 'role' ? 'Role' : 'User'} ${participant.subjectId.slice(0, 8)}…`}
                          {participant.removedUtc ? ' (removed)' : ''}
                        </span>
                        <span className="chat-participant-perms">
                          {participant.canManage ? 'manage' : participant.canWrite ? 'write' : 'read only'}
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
