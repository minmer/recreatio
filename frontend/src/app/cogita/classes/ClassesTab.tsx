/**
 * 2026-11-22 — „KLASY" IN DER NAUKA EINER BAZA. 2026-11-24: der Inhalt ist die Konsole der Lehrerin (`TeacherConsole.tsx`,
 * dieselbe wie im Baustein „Nauczyciel — moje klasy" einer Seite); hier nur die Wege dahinter — eine Stunde planen
 * (`…/klasy/<klasse>/plan…`) und eine Einheit über mehrere Stunden (`…/klasy/<klasse>/jednostki`).
 */

import { lazy, Suspense } from 'react';

import { Loading } from '../../ui/Loading';
import { TeacherConsole, type ConsoleSlots } from './TeacherConsole';

const LessonPlanner = lazy(() => import('../lesson/LessonPlanner').then((m) => ({ default: m.LessonPlanner })));
const UnitStart = lazy(() => import('../unit/UnitStart').then((m) => ({ default: m.UnitStart })));

export function ClassesTab({ trail = [], slots }: { trail?: readonly string[]; slots?: ConsoleSlots }) {
  if (trail[0] !== undefined && trail[1] === 'jednostki') {
    return <Suspense fallback={<Loading />}><UnitStart classAreaId={trail[0]} /></Suspense>;
  }
  if (trail[0] !== undefined && trail[1] === 'plan') {
    return <Suspense fallback={<Loading />}><LessonPlanner classAreaId={trail[0]} trail={trail.slice(2)} /></Suspense>;
  }
  return <TeacherConsole slots={slots} />;
}
