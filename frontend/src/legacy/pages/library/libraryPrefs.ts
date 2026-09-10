import { useCallback, useEffect, useState } from 'react';

// The citation style is a reading preference, not library data: it changes how a
// reference is written, never where the quote sits. Keeping it in localStorage
// avoids a settings table and a migration for what is one string per browser.

const STYLE_KEY = 'recreatio.library.citationStyle';

/** Matches the registry's fallback on the server. */
export const DEFAULT_CITATION_STYLE = 'polish';

export function readStoredStyle(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_CITATION_STYLE;
  return localStorage.getItem(STYLE_KEY) ?? DEFAULT_CITATION_STYLE;
}

export function useCitationStyle(): [string, (style: string) => void] {
  const [style, setStyle] = useState(readStoredStyle);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STYLE_KEY, style);
  }, [style]);

  const update = useCallback((next: string) => setStyle(next), []);
  return [style, update];
}

/** Writes text to the clipboard, reporting whether it landed. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea approach below.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
