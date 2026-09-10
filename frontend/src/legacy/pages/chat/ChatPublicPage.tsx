import { useCallback, useEffect, useRef, useState } from 'react';
import type { Copy } from '../../content/types';
import type { RouteKey } from '../../types/navigation';
import { LanguageSelect } from '../../components/LanguageSelect';
import { AuthAction } from '../../components/AuthAction';
import {
  askPublicChatQuestion,
  getPublicChatConversation,
  pollPublicChatConversation,
  type ChatMessage,
  type ChatPublicConversation
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

export function ChatPublicPage({
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
  const [questionText, setQuestionText] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const lastSequenceRef = useRef<number>(0);

  const loadInitial = useCallback(async () => {
    try {
      const response = await getPublicChatConversation({ code, take: 120 });
      setConversation(response);
      setMessages(response.messages.messages);
      lastSequenceRef.current = response.messages.lastSequence;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load public chat.');
    }
  }, [code]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      while (active) {
        const lastSequence = lastSequenceRef.current;
        try {
          const response = await pollPublicChatConversation({
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
          if (!conversation) {
            setConversation(response);
          }
        } catch {
          await new Promise((resolve) => window.setTimeout(resolve, 1800));
        }
      }
    };
    void run();

    return () => {
      active = false;
    };
  }, [code, conversation]);

  useEffect(() => {
    lastSequenceRef.current = messages.length > 0 ? messages[messages.length - 1].sequence : 0;
  }, [messages]);

  const handleAsk = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!questionText.trim()) return;

    try {
      const message = await askPublicChatQuestion({
        code,
        text: questionText.trim(),
        displayName: displayName.trim() || undefined
      });
      lastSequenceRef.current = Math.max(lastSequenceRef.current, message.sequence);
      setMessages((current) => mergeMessages(current, [message]));
      setQuestionText('');
      setStatus('Question submitted.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to submit question.');
    }
  };

  return (
    <div className="chat-page chat-page-public">
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

      <main className="chat-public-main">
        <section className="chat-public-head">
          <h1>{conversation?.title ?? 'Public chat'}</h1>
          <p>
            {conversation?.scopeType}
            {conversation?.scopeId ? ` / ${conversation.scopeId}` : ''}
          </p>
        </section>

        <section className="chat-messages" role="log" aria-live="polite">
          {messages.length === 0 && <div className="chat-note">No public questions yet.</div>}
          {messages.map((message) => (
            <article key={message.messageId} className="chat-message public">
              <header>
                <strong>{message.senderDisplay}</strong>
                <span>{message.messageType}</span>
                <time>{formatDateTime(message.createdUtc)}</time>
              </header>
              <p>{message.text}</p>
            </article>
          ))}
        </section>

        <form className="chat-send-form" onSubmit={handleAsk}>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name (optional)"
          />
          <textarea
            value={questionText}
            onChange={(event) => setQuestionText(event.target.value)}
            placeholder="Ask a public question..."
            rows={3}
          />
          <div className="chat-send-actions">
            <button type="submit" className="cta">Ask question</button>
          </div>
        </form>
      </main>

      {status && <div className="chat-status">{status}</div>}
    </div>
  );
}
