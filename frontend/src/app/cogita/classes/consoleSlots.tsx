/**
 * 2026-11-24 — WAS DIE KONSOLE DER LEHRERIN AN EIGENEN REITERN BEKOMMT, an EINER Stelle für Nauka → „Klasy" und den Baustein
 * „Nauczyciel — moje klasy": der Reiter „Świat klasy" — was die Klasse von der Welt sieht (die Teilwelt, `SubWorldEditor.tsx`).
 */

import { lazy, Suspense } from 'react';

import { Loading } from '../../ui/Loading';
import type { ConsoleSlots } from './TeacherConsole';

const SubWorldEditor = lazy(() => import('./SubWorldEditor').then((m) => ({ default: m.SubWorldEditor })));

export const consoleSlots: ConsoleSlots = {
  world: (klass) => <Suspense fallback={<Loading />}><SubWorldEditor klass={klass} /></Suspense>
};
