/**
 * DER ZUSTAND EINES BAUSTEINS IN DER ADRESSE (2026-10-22, Schritt 9).
 *
 * Bis hierher schrieb jeder Baustein seine Schlüssel nackt in die Adresse
 * (`?t=`, `?tq=` …): zwei Archive auf einer Seite teilten sie. Jetzt hat jeder
 * Baustein seinen Zakres — sechs Zeichen seiner Kennung — und schreibt
 * `?<zakres>.<klucz>=…`. Zwei Widoki auf einer Seite stören einander nicht,
 * und ein Link mit dem Zustand lässt sich weitergeben.
 *
 * Ersetzt wird, nicht verlängert: kein Schritt in der Geschichte (wie
 * `setHashParams` des Archivs). Die übrigen Schlüssel bleiben, wie sie sind.
 */

import { useCallback, useEffect, useState } from 'react';

/** Der Zakres eines Bausteins: das Ende seiner Kennung (der zufällige Teil einer UUIDv7). */
export const scopeOf = (moduleId: string): string => moduleId.replace(/[^0-9a-z]/gi, '').slice(-6).toLowerCase() || 'm';

const split = (hash: string): [string, URLSearchParams] => {
  const at = hash.indexOf('?');
  return at < 0 ? [hash, new URLSearchParams()] : [hash.slice(0, at), new URLSearchParams(hash.slice(at + 1))];
};

/** Die Schlüssel eines Zakres aus einer Adresse (ohne Präfix). */
export function readScope(hash: string, scope: string): Record<string, string> {
  const out: Record<string, string> = {};
  const prefix = `${scope}.`;
  for (const [key, value] of split(hash)[1]) if (key.startsWith(prefix) && value !== '') out[key.slice(prefix.length)] = value;
  return out;
}

/** Die Adresse mit geändertem Zakres — `null` oder leer: der Schlüssel geht. */
export function withScope(hash: string, scope: string, patch: Readonly<Record<string, string | null>>): string {
  const [base, params] = split(hash);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === '') params.delete(`${scope}.${key}`);
    else params.set(`${scope}.${key}`, value);
  }
  const query = params.toString();
  return `${base}${query === '' ? '' : `?${query}`}`;
}

/** Der Zustand eines Bausteins: lesen beim Zeichnen, schreiben ersetzend; folgt Zurück und Vor. */
export function useScope(scope: string): [Readonly<Record<string, string>>, (patch: Readonly<Record<string, string | null>>) => void] {
  const [state, setState] = useState<Readonly<Record<string, string>>>(() => (typeof window === 'undefined' ? {} : readScope(window.location.hash, scope)));
  useEffect(() => {
    const again = () => setState(readScope(window.location.hash, scope));
    window.addEventListener('hashchange', again);
    return () => window.removeEventListener('hashchange', again);
  }, [scope]);
  const set = useCallback((patch: Readonly<Record<string, string | null>>) => {
    const next = withScope(window.location.hash, scope, patch);
    if (next !== window.location.hash) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${next}`);
    setState(readScope(next, scope));
  }, [scope]);
  return [state, set];
}
