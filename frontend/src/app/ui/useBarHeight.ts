/**
 * WIE HOCH DIE KOPFLEISTE IST (`[data-app-head]`) — für Ansichten, die das Fenster
 * darunter füllen (Rozmowy, ein SMS-Gespräch) oder unter ihr kleben (die Suche der SMS).
 * Gemessen, nicht angenommen: am Telefon kommt der Rand der Statusleiste dazu.
 */

import { useEffect, useState } from 'react';

export function useBarHeight(): number {
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
