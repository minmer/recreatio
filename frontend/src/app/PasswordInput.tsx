/**
 * EIN PASSWORTFELD MIT AUGE — sehen, was man getippt hat.
 *
 * Auf dem Telefon vertippt man sich leicht, und das Passwort ist hier mehr
 * als ein Zugang: aus ihm wird der Schlüssel gerechnet (Argon2), also kostet
 * jeder Fehlversuch Sekunden. Ein Blick spart sie.
 *
 * Sichtbar wird es nur auf Wunsch und nur in diesem Feld. Beim Absenden wird
 * es wieder verdeckt, BEVOR der Browser hinsieht: ein Passwortspeicher erkennt
 * ein Passwort am Feld `type="password"` — als Textfeld abgeschickt, böte er
 * nicht an, es zu speichern.
 */

import { useEffect, useRef, useState } from 'react';

export function PasswordInput({ value, onChange, autoComplete, placeholder, autoFocus, disabled }: {
  value: string;
  onChange: (next: string) => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const field = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const form = field.current?.form;
    if (form == null) return undefined;
    const hide = () => {
      if (field.current !== null) field.current.type = 'password';
      setShown(false);
    };
    form.addEventListener('submit', hide, true);
    return () => form.removeEventListener('submit', hide, true);
  }, []);

  return (
    <span className="wk-password">
      <input
        ref={field}
        type={shown ? 'text' : 'password'}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        /* Sichtbar ist es ein Textfeld — das Telefon soll trotzdem nichts gross schreiben oder „verbessern". */
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="wk-password-eye"
        aria-label={shown ? 'Ukryj hasło' : 'Pokaż hasło'}
        aria-pressed={shown}
        title={shown ? 'Ukryj hasło' : 'Pokaż hasło'}
        disabled={disabled}
        onClick={() => setShown(!shown)}
      >
        {shown ? <EyeShut /> : <EyeOpen />}
      </button>
    </span>
  );
}

function EyeOpen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeShut() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.9 3.8" />
      <path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.8-1.3" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
