/**
 * RÜCKFRAGE UND MELDUNG — statt `window.confirm()` und statt Sätzen, die
 * irgendwo im Bild erscheinen (2026-10-16).
 *
 * <code>
 *   if (!(await ask({ title: 'Usunąć formularz „Bierzmowanie"?', body: '48 zgłoszeń…', confirm: 'Usuń', danger: true }))) return;
 *   toast('Zapisano.');
 * </code>
 *
 * <b>Warum nicht `confirm()`.</b> Der Browser zeichnet ihn selbst — in jedem
 * anders, ohne Fettdruck für das, was verschwindet, und im eingebetteten
 * Fenster mancher Apps gar nicht. Die Rückfrage hier nennt das Ding und was
 * mit ihm geht, und der gefährliche Knopf ist rot.
 *
 * Die Wirte (`UiHosts`) stehen einmal im Rahmen (`App.tsx`). Ohne sie — in
 * einem Lauf ohne Bild — fällt `ask` auf `confirm()` zurück, `toast` auf nichts.
 */

import { useEffect, useState, type ReactNode } from 'react';

import { Modal } from '../Modal';
import { Icon } from './icons';

/* -- Rückfrage ---------------------------------------------------------------------- */

export interface Ask {
  readonly title: string;
  readonly body?: ReactNode;
  /** Was mit verschwindet — als Liste unter dem Satz. */
  readonly list?: readonly string[];
  /** Der Knopf, der es tut: „Usuń", „Wycofaj link". Ohne Angabe: „Tak". */
  readonly confirm?: string;
  readonly cancel?: string;
  /** Rot, und nicht der Knopf, auf dem der Fokus liegt. */
  readonly danger?: boolean;
}

type Pending = Ask & { readonly done: (yes: boolean) => void };

let showAsk: ((ask: Pending) => void) | null = null;

/** Fragt nach — `true`, wenn bestätigt. */
export function ask(question: Ask): Promise<boolean> {
  if (showAsk === null) {
    const text = typeof question.body === 'string' ? `${question.title}\n\n${question.body}` : question.title;
    return Promise.resolve(window.confirm(text));
  }
  return new Promise((resolve) => showAsk!({ ...question, done: resolve }));
}

/*
 * Der Knopf heisst wie die Handlung — „Usuń", nicht „OK" —, und rot ist er,
 * wo etwas verschwindet. Die Frage selbst bleibt, wie sie war.
 */
const VERBS: readonly (readonly [RegExp, string, boolean])[] = [
  [/^Usunąć/, 'Usuń', true], [/^Wycofać/, 'Wycofaj', true], [/^Odwołać/, 'Odwołaj', true], [/^Wypisać/, 'Wypisz', true],
  [/^Zdjąć/, 'Zdejmij', true], [/^Odłączyć/, 'Odłącz', true], [/^Zarchiwizować/, 'Zarchiwizuj', false],
  [/^Zakończyć/, 'Zakończ', false], [/^Dodać/, 'Dodaj', false], [/^Dołączyć/, 'Dołącz', false],
  [/^Połączyć/, 'Połącz', false], [/^Wystawić/, 'Wystaw', false]
];

/**
 * Eine Frage, wie sie früher an `confirm()` ging, als Rückfrage: bis zum ersten
 * „?" der Titel, danach die Erklärung; der Knopf nach dem Verb.
 */
export function askText(text: string): Promise<boolean> {
  const cut = text.indexOf('?');
  const title = (cut >= 0 ? text.slice(0, cut + 1) : text).trim();
  const body = cut >= 0 ? text.slice(cut + 1).trim() : '';
  const verb = VERBS.find(([re]) => re.test(title));
  return ask({ title, body: body === '' ? undefined : body, confirm: verb?.[1] ?? 'Tak', danger: verb?.[2] ?? false });
}

function AskHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    showAsk = (next) => setPending((was) => {
      was?.done(false);
      return next;
    });
    return () => { showAsk = null; };
  }, []);

  if (pending === null) return null;

  const answer = (yes: boolean) => {
    pending.done(yes);
    setPending(null);
  };

  return (
    <Modal title={pending.title} onClose={() => answer(false)}>
      <div className="ui-ask">
        {pending.body !== undefined && (typeof pending.body === 'string' ? <p className="ui-ask-body">{pending.body}</p> : pending.body)}
        {pending.list !== undefined && pending.list.length > 0 && (
          <ul className="ui-ask-list">{pending.list.map((one) => <li key={one}>{one}</li>)}</ul>
        )}
        <div className="wk-actions">
          {/* Der sichere Knopf zuerst — auf ihm liegt der Fokus (Modal: erster Knopf). */}
          <button type="button" className="wk-btn wk-btn-quiet" onClick={() => answer(false)}>{pending.cancel ?? 'Anuluj'}</button>
          <button type="button" className={pending.danger === true ? 'wk-btn wk-btn-danger' : 'wk-btn'} data-ask-yes="" onClick={() => answer(true)}>
            {pending.confirm ?? 'Tak'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* -- Meldung ------------------------------------------------------------------------ */

export interface ToastOptions {
  readonly kind?: 'ok' | 'error';
  /** Ein Handgriff in der Meldung: „Cofnij". */
  readonly action?: { readonly label: string; readonly run: () => void };
  /** Wie lange sie steht (ms). */
  readonly ms?: number;
}

interface Shown { readonly id: number; readonly text: string; readonly options: ToastOptions }

let showToast: ((toast: Shown) => void) | null = null;
let nextId = 1;

/** Sagt kurz, dass etwas geschehen ist — unten, ohne das Bild zu verschieben. */
export function toast(text: string, options: ToastOptions = {}): void {
  showToast?.({ id: nextId++, text, options });
}

function ToastHost() {
  const [shown, setShown] = useState<readonly Shown[]>([]);

  useEffect(() => {
    showToast = (one) => setShown((was) => [...was.slice(-2), one]);
    return () => { showToast = null; };
  }, []);

  useEffect(() => {
    if (shown.length === 0) return undefined;
    const first = shown[0];
    const gone = window.setTimeout(
      () => setShown((was) => was.filter((one) => one.id !== first.id)),
      first.options.ms ?? (first.options.action !== undefined ? 7000 : 3500)
    );
    return () => window.clearTimeout(gone);
  }, [shown]);

  if (shown.length === 0) return null;

  return (
    <div className="ui-toasts" aria-live="polite">
      {shown.map((one) => (
        <div key={one.id} className={one.options.kind === 'error' ? 'ui-toast is-error' : 'ui-toast'} role="status">
          <Icon name={one.options.kind === 'error' ? 'alert' : 'check'} />
          <span className="ui-toast-text">{one.text}</span>
          {one.options.action !== undefined && (
            <button type="button" className="ui-toast-act" onClick={() => {
              one.options.action!.run();
              setShown((was) => was.filter((x) => x.id !== one.id));
            }}>{one.options.action.label}</button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Die Wirte — einmal im Rahmen. */
export function UiHosts() {
  return (
    <>
      <AskHost />
      <ToastHost />
    </>
  );
}
