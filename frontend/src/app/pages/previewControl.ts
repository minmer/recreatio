/**
 * 2026-10-27 — DIE VORSCHAU FÜR ASSISTENTEN (`preview/`, der MCP-Dienst
 * `recreatio-preview`) stellt Folge und Bühne einer Seite auf eine genaue
 * Stelle, um sie abzubilden: einen Slajd, die Mitte eines Wechsels, einen
 * Schritt einer Szene. Dafür hält sie hier die Steuerung beider.
 *
 * <b>Ausserhalb der Vorschau ist der Kontext leer</b> — Folge und Bühne nehmen
 * dann ihre eigene Steuerung, und nichts ändert sich.
 */

import { createContext, type MutableRefObject } from 'react';

import type { DriveControl } from './presentation/usePresentationDrive';
import type { DeckControl } from './slides/SlideDeck';

export interface PreviewControl {
  readonly deck: MutableRefObject<DeckControl | null>;
  readonly show: MutableRefObject<DriveControl | null>;
}

export const PreviewControlContext = createContext<PreviewControl | null>(null);
