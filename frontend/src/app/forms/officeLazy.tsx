/**
 * DIE KANZLEI AUF EINER SEITE, NACHGELADEN (2026-10-17).
 *
 * Die Bausteine einer Seite (`parts/entries.tsx`, `parts/seat.tsx`) zeigen der
 * Kanzlei die Tafel eines Menschen und das Schreiben an seinen Platz — beides
 * aus `FormOffice`. Statisch geholt, lud JEDE öffentliche Seite die ganze
 * Kanzlei mit (Formular-Editor, Logik, Karten). Hier kommen die beiden erst,
 * wenn sie gezeigt werden.
 */

import { lazy, Suspense, type ComponentProps } from 'react';

import type { EntryDeskPanel as Desk } from './FormPeople';
import type { WriteToSeat as Write } from './FormLinks';
import { Loading } from '../ui/Loading';

const DeskLater = lazy(() => import('./FormPeople').then((m) => ({ default: m.EntryDeskPanel })));
const WriteLater = lazy(() => import('./FormLinks').then((m) => ({ default: m.WriteToSeat })));

export function EntryDeskPanel(props: ComponentProps<typeof Desk>) {
  return <Suspense fallback={<Loading lines={2} />}><DeskLater {...props} /></Suspense>;
}

export function WriteToSeat(props: ComponentProps<typeof Write>) {
  return <Suspense fallback={null}><WriteLater {...props} /></Suspense>;
}
