/**
 * 0102 — „PRZECZYTAJ WIADOMOŚCI" BEIM MENSCHEN — eine schmale Zeile wie eine
 * Aufgabe: links ○ oder ✓, der Name, daneben blass, wo die Wiadomości
 * liegen, rechts wie viel Neues, und „Czytaj": dorthin, wo die Rozmowa auf
 * dieser Seite steht — zugeklappt klappt sie auf.
 *
 * Der Stand kommt aus seiner Liste der Rozmowy (`useSeatChatRows`, dieselbe
 * Rechnung wie beim Dienst) und ist damit gleich nach dem Lesen grün; ohne
 * sie gilt der Haken, den der Dienst gemeldet hat.
 */

import { useEffect, useState } from 'react';

import type { SeatView } from './seatContext';
import { newMessages, useSeatChatRows } from './seatUnread';
import { chatTargetText, unreadIn, type ChatTargetKind, type StepState } from './steps';

/** Wo auf dieser Seite seine Rozmowy stehen — die passende Art zuerst. */
function chatCard(kind: ChatTargetKind): HTMLElement | null {
  const order = kind === 'seat' ? ['seat-ask', 'seat-chat', 'chat'] : ['seat-chat', 'chat', 'seat-ask'];
  for (const one of order) {
    const card = document.querySelector<HTMLElement>(`.wk-card-${one}`);
    if (card !== null) return card;
  }
  return null;
}

/** Zur Rozmowa auf dieser Seite — und aufklappen, wenn sie als Streifen dasteht. */
function openChatCard(kind: ChatTargetKind): void {
  const card = chatCard(kind);
  if (card === null) return;
  card.querySelector<HTMLButtonElement>('.wk-card-open')?.click();
  window.setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
}

/** Der Stand eines Schritts „Przeczytaj wiadomości" — live aus seinen Rozmowy, sonst der gemeldete. */
export function chatStepStatus(step: StepState, rows: Parameters<typeof unreadIn>[1] | undefined): StepState['status'] {
  if (step.chat === undefined || rows === undefined) return step.status;
  return unreadIn(step.chat, rows) === 0 ? 'done' : 'todo';
}

export function ChatStep({ seat, step }: { seat: SeatView; step: StepState }) {
  const rows = useSeatChatRows([seat.token]);
  const target = step.chat ?? { kind: 'all' as const, areaId: null, areaName: null };
  const unread = rows === undefined ? null : unreadIn(target, rows);
  const done = chatStepStatus(step, rows) === 'done';

  /* Ob die Rozmowa auf dieser Seite steht — erst nach dem Zeichnen zu sehen (sie kann nach dieser Zeile kommen). */
  const [here, setHere] = useState(false);
  useEffect(() => { setHere(chatCard(target.kind) !== null); });

  const where = chatTargetText(target);
  return (
    <div className={`wk-ptask wk-pread is-${done ? 'fulfilled' : 'open'}`} data-chat-step={step.stepId ?? ''} data-unread={unread ?? ''}
      title={step.help ?? undefined}>
      <div className="wk-ptask-row">
        <span className={`wk-ptask-dot${done ? ' is-ok' : ''}`} aria-hidden="true">
          {done && (
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          )}
        </span>
        <span className="wk-ptask-name">
          <strong className="wk-ptask-title">{step.label}</strong>
          <span className="wk-ptask-plan">{where.charAt(0).toUpperCase() + where.slice(1)}</span>
        </span>
        <span className={`wk-ptask-status is-${done ? 'fulfilled' : unread !== null && unread > 0 ? 'unread' : 'open'}`}>
          {done ? '✓ na bieżąco' : unread === null || unread === 0 ? 'do przeczytania' : newMessages(unread)}
        </span>
        {here && !done && (
          <button type="button" className="wk-btn wk-btn-small" data-chat-step-open="" onClick={() => openChatCard(target.kind)}>
            Czytaj
          </button>
        )}
      </div>
    </div>
  );
}
