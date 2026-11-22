/**
 * 2026-11-22 — DIE KLEINE WERKSTATT: wer über den QR-Code einer Klasse ein Konto anlegt, sieht nur die Nauka
 * (`shell/LearnerShell.tsx`) — seine Klassen, die Karte, die Lekcja. Die Wahl gehört dem Konto (versiegelt, `core/prefs.ts`)
 * und steht zusätzlich auf diesem Gerät, damit beim Öffnen nicht erst die ganze Werkstatt aufblitzt. Beide Seiten können
 * wechseln: „Pełna wersja aplikacji" in der kleinen, „Widok ucznia" im Menü des Kontos der grossen.
 */

import { useEffect, useState } from 'react';

import { remembered, setValue } from '../../core/prefs';
import { readShell, SHELL_PREF, type ShellChoice } from './classModel';

const SLOT = (accountId: string) => `recreatio:shell:${accountId}`;

function onDevice(accountId: string): ShellChoice | null {
  try {
    const said = window.localStorage.getItem(SLOT(accountId));
    return said === null ? null : readShell(said);
  } catch {
    return null;
  }
}

function keepOnDevice(accountId: string, choice: ShellChoice): void {
  try { window.localStorage.setItem(SLOT(accountId), choice); } catch { /* nur das Konto merkt es */ }
}

/** Welche Werkstatt dieses Konto sieht — `undefined`: wird noch nachgesehen (nur, wenn das Gerät es nicht weiss). */
export function useShell(accountId: string): ShellChoice | undefined {
  const [choice, setChoice] = useState<ShellChoice | undefined>(() => onDevice(accountId) ?? undefined);
  useEffect(() => {
    let alive = true;
    const local = onDevice(accountId);
    setChoice(local ?? undefined);
    /* Das Konto hat das letzte Wort — auf einem neuen Gerät weiss nur es, dass hier jemand aus einer Klasse lernt. */
    void remembered(SHELL_PREF, local ?? 'full').then((said) => {
      const found = readShell(said);
      keepOnDevice(accountId, found);
      if (alive) setChoice(found);
    }, () => { if (alive) setChoice((had) => had ?? 'full'); });
    const changed = () => { const now = onDevice(accountId); if (now !== null && alive) setChoice(now); };
    window.addEventListener(SHELL_EVENT, changed);
    return () => { alive = false; window.removeEventListener(SHELL_EVENT, changed); };
  }, [accountId]);
  return choice;
}

const SHELL_EVENT = 'recreatio:shell';

/** Die Werkstatt wechseln — für dieses Konto, auf allen Geräten. */
export async function chooseShell(accountId: string, choice: ShellChoice): Promise<void> {
  keepOnDevice(accountId, choice);
  await remembered(SHELL_PREF, 'full').catch(() => 'full');
  setValue(SHELL_PREF, choice);
  window.dispatchEvent(new Event(SHELL_EVENT));
}
