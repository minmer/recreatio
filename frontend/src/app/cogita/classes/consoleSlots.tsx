/**
 * 2026-11-24 — WAS DIE KONSOLE DER LEHRERIN AN EIGENEN REITERN BEKOMMT, an EINER Stelle für Nauka → „Klasy" und den Baustein
 * „Nauczyciel — moje klasy": der Reiter „Świat klasy" — was die Klasse von der Welt sieht (die Teilwelt, `SubWorldEditor.tsx`).
 */

import { lazy, Suspense } from 'react';

import { Loading } from '../../ui/Loading';
import type { ConsoleSlots } from './TeacherConsole';

const SubWorldEditor = lazy(() => import('./SubWorldEditor').then((m) => ({ default: m.SubWorldEditor })));
/* 2026-11-24 — der Przegląd (Folien und Fragen zum Durchgehen), auf die Teilwelt der Klasse beschränkt. */
const Explore = lazy(() => import('../explore/Explore').then((m) => ({ default: m.Explore })));

export const consoleSlots: ConsoleSlots = {
  world: (klass) => <Suspense fallback={<Loading />}><SubWorldEditor klass={klass} /></Suspense>,
  explore: (klass) => <Suspense fallback={<Loading />}><Explore klass={klass} /></Suspense>
};
