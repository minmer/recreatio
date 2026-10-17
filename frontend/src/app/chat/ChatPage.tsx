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

import { useEffect, useState, type CSSProperties } from 'react';

import type { Who } from '../core/session';
import { ChatList, ChatWelcome } from './ChatList';
import { ChatRoom } from './ChatRoom';
import { useMe } from './chatShared';
import { NewChat } from './NewChat';

/* -- Die Ansicht ------------------------------------------------------------------ */

/** Wie hoch der Kopf der App ist — die Rozmowa füllt, was darunter bleibt. */
function useTopOffset(): number {
  const [top, setTop] = useState(56);
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('[data-app-head]');
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

