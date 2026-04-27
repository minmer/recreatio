import { useCallback, useEffect, useRef, useState } from 'react';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';
import {
  getChatInviteConversation,
  getRoles,
  joinChatViaInvite,
  pollChatInviteConversation,
  type ChatMessage,
  type ChatPublicConversation,
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
  for (const message of existing) bySequence.set(message.sequence, message);
  for (const message of next) bySequence.set(message.sequence, message);
  return Array.from(bySequence.values()).sort((a, b) => a.sequence - b.sequence);
}

function getRoleNick(role: RoleResponse) {
  const nickField = role.fields.find((f) => f.fieldType.toLowerCase() === 'nick' && f.plainValue?.trim());
  return nickField?.plainValue?.trim() ?? role.roleId;
}

export function ChatInvitePage({
  copy,
  code,
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
  code: string;
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
  const [conversation, setConversation] = useState<ChatPublicConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const lastSequenceRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Track whether conversation data has been loaded to avoid re-setting it from the poll loop
  const conversationLoadedRef = useRef(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await getChatInviteConversation({ code, take: 120 });
      conversationLoadedRef.current = true;
      setConversation(response);
      setMessages(response.messages.messages);
      lastSequenceRef.current = response.messages.lastSequence;
    } catch {
      setLoadError('This invite link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  // Poll for new messages — depends only on `code`, not on `conversation` state
  useEffect(() => {
    let active = true;
    const run = async () => {
      while (active) {
        const lastSequence = lastSequenceRef.current;
        try {
          const response = await pollChatInviteConversation({
            code,
            afterSequence: lastSequence,
            waitSeconds: document.hidden ? 25 : 10,
            take: 120
          });
          if (!active) return;
          if (response.messages.messages.length > 0) {
            lastSequenceRef.current = Math.max(lastSequenceRef.current, response.messages.lastSequence);
            setMessages((current) => mergeMessages(current, response.messages.messages));
          }
          // Fallback: set conversation from poll if initial load failed silently
          if (!conversationLoadedRef.current) {
            conversationLoadedRef.current = true;
            setConversation(response);
          }
        } catch {
          await new Promise((resolve) => window.setTimeout(resolve, 1800));
        }
      }
    };
    void run();
    return () => { active = false; };
  }, [code]); // only restart poll when code changes

  useEffect(() => {
    lastSequenceRef.current = messages.length > 0 ? messages[messages.length - 1].sequence : 0;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!actionStatus) return;
    const timer = window.setTimeout(() => setActionStatus(null), 4500);
    return () => window.clearTimeout(timer);
  }, [actionStatus]);

  // Load roles when user is authenticated
  useEffect(() => {
    if (!showProfileMenu) {
      setRoles([]);
      setSelectedRoleId('');
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const list = await getRoles();
        if (!active) return;
        setRoles(list);
        if (list.length > 0) setSelectedRoleId(list[0].roleId);
      } catch {
        // roles stay empty — user will join as their account
      }
    };
    void load();
    return () => { active = false; };
  }, [showProfileMenu]);

  const handleJoin = async () => {
    if (joining || joined) return;
    setJoining(true);
    setActionStatus(null);
    try {
      const result = await joinChatViaInvite({
        code,
        roleId: selectedRoleId || undefined
      });
      setJoined(true);
      sessionStorage.setItem(JOIN_CONVERSATION_KEY, result.conversationId);
      window.setTimeout(() => onNavigate('chat'), 700);
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : 'Failed to join conversation. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  // --- Render: invalid / expired link ---
  if (!loading && loadError) {
    return (
      <div className="chat-page chat-invite-page">
        <header className="chat-header">
          <a href="/#/section-1" className="chat-brand" onClick={() => onNavigate('home')}>REcreatio</a>
          <div className="chat-header-actions">
            <LanguageSelect value={language} onChange={onLanguageChange} />
            <AuthAction
              copy={copy} label={authLabel} isAuthenticated={showProfileMenu}
              secureMode={secureMode} onLogin={onAuthAction}
              onProfileNavigate={onProfileNavigate} onToggleSecureMode={onToggleSecureMode}
              onLogout={onLogout} variant="ghost"
            />
          </div>
        </header>
        <main className="chat-invite-main">
          <div className="chat-invite-error">
            <h1>Link unavailable</h1>
            <p>{loadError}</p>
            <p>Ask the conversation owner to share a new invite link.</p>
            <button type="button" className="cta" onClick={() => onNavigate('home')}>Go to homepage</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="chat-page chat-invite-page">
      <header className="chat-header">
        <a href="/#/section-1" className="chat-brand" onClick={() => onNavigate('home')}>REcreatio</a>
        <div className="chat-header-actions">
          <LanguageSelect value={language} onChange={onLanguageChange} />
          <AuthAction
            copy={copy} label={authLabel} isAuthenticated={showProfileMenu}
            secureMode={secureMode} onLogin={onAuthAction}
            onProfileNavigate={onProfileNavigate} onToggleSecureMode={onToggleSecureMode}
            onLogout={onLogout} variant="ghost"
          />
        </div>
      </header>

      <main className="chat-invite-main">
        <section className="chat-invite-head">
          {loading
            ? <h1 className="chat-invite-loading">Loading conversation…</h1>
            : <h1>{conversation?.title ?? 'Conversation'}</h1>
          }
          {conversation && !loading && (
            <p className="chat-invite-scope">
              {conversation.scopeType === 'global' ? 'General' : conversation.scopeType}
              {conversation.scopeId ? ` · ${conversation.scopeId}` : ''}
              {' · '}You are viewing this conversation via an invite link.
            </p>
          )}
        </section>

        {/* Action banner — sign in or join */}
        {!loading && !showProfileMenu && (
          <div className="chat-invite-banner">
            <p>You can read this conversation without an account. To write messages and become a member, sign in first.</p>
            <button type="button" className="cta" onClick={onAuthAction}>
              Sign in to join and write
            </button>
          </div>
        )}

        {!loading && showProfileMenu && !joined && (
          <div className="chat-invite-banner chat-invite-banner--auth">
            <p>You are signed in. Click below to join this conversation — you will then be able to read and write.</p>
            {roles.length > 0 && (
              <div className="chat-field-row">
                <label className="chat-field-label" htmlFor="invite-role-select">Join as</label>
                <select
                  id="invite-role-select"
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="chat-invite-role-select"
                >
                  <option value="">— my account —</option>
                  {roles.map((role) => (
                    <option key={role.roleId} value={role.roleId}>{getRoleNick(role)}</option>
                  ))}
                </select>
              </div>
            )}
            <button type="button" className="cta" onClick={handleJoin} disabled={joining}>
              {joining ? 'Joining…' : 'Join conversation'}
            </button>
            {actionStatus && <p className="chat-invite-action-error">{actionStatus}</p>}
          </div>
        )}

        {!loading && showProfileMenu && joined && (
          <div className="chat-invite-banner chat-invite-banner--joined">
            <p>You joined! Opening the conversation…</p>
          </div>
        )}

        {/* Message history */}
        <section className="chat-messages" role="log" aria-live="polite">
          {loading && <div className="chat-note">Loading messages…</div>}
          {!loading && messages.length === 0 && (
            <div className="chat-note">No messages yet in this conversation.</div>
          )}
          {messages.map((message) => (
            <article key={message.messageId} className="chat-message">
              <header>
                <strong>{message.senderDisplay}</strong>
                {message.messageType !== 'text' && (
                  <span className="chat-message-type">{message.messageType}</span>
                )}
                <time>{formatDateTime(message.createdUtc)}</time>
              </header>
              <p>{message.text}</p>
            </article>
          ))}
          <div ref={messagesEndRef} />
        </section>
      </main>
    </div>
  );
}
