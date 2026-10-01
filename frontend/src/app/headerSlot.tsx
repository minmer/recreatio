/**
 * EIN PLATZ IN DER KOPFLEISTE — für das, was eine Seite dort zeigen will.
 *
 * Die Kopfleiste zeichnet `App.tsx` (die Marke, der Weg, wer angemeldet ist);
 * WAS eine Seite dort zusätzlich braucht, weiss nur die Seite: ihr Menü. Statt
 * das Menü nach oben durchzureichen, hält die Kopfleiste einen leeren Platz
 * bereit, und die Seite zeichnet hinein (`createPortal`).
 *
 * Ohne Kopfleiste darüber (im Editor, in einer Vorschau) steht es an Ort und
 * Stelle — dieselbe Komponente, nur ohne Umweg.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const HeaderSlotContext = createContext<HTMLElement | null>(null);

/** In die Kopfleiste zeichnen — oder hier, wenn es keine gibt. */
export function InHeader({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSlotContext);
  return slot === null ? <>{children}</> : createPortal(children, slot);
}
