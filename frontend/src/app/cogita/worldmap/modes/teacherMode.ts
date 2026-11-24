/**
 * MODUS „PROWADZĘ" (2026-11-22, Part B — `lesson/MapClassTools.tsx`): wer eine Klasse leiten darf, bekommt im Menü den Teil der Klasse
 * (Prowadzę / Uczę się), über Türmen, Pfaden und Gabelungen „Prowadź tutaj" / „Zadaj" (vor den Knöpfen des Lernenden) und die Zadania
 * als Schicht. Der Lernende sieht an Türmen mit einer offenen Zadanie ein Zeichen (`tasks`) — nicht, solange er selbst leitet.
 */

import { useMapClassTools, type MapTarget } from '../../lesson/MapClassTools';
import type { AssignFacts } from '../../lesson/lessonTally';
import type { Learner } from '../../learn';
import type { CogitaLibrary } from '../../store';
import type { Me } from '../../../core/me';
import type { MapMode } from '../mapMode';
import type { Lines } from '../wmTypes';

/** Was die Klasse an einem Ding lernt: der Turm, Pfad oder die Gabelung mit den Erzählungen, die dorthin führen. */
export function classTargetOf(lib: CogitaLibrary, lines: Lines, nameOf: (id: string) => string, kind: string, id: string): MapTarget | null {
  const flowOf = (line: string, start?: { readonly step: string; readonly exit?: string }) => ({
    flow: line, name: lines.lines.get(line)?.name ?? line, lesson: lib.docs('flow').some((e) => e.id === line && e.data.lesson === true), ...(start === undefined ? {} : { start })
  });
  if (kind === 'place') {
    const via = [...lines.lines.values()].filter((l) => l.unit === id || l.sections.some((s) => lines.sections.get(s)?.to === id)).map((l) => flowOf(l.id));
    return { kind: 'place', id, name: nameOf(id), flows: via };
  }
  if (kind === 'section') {
    const sec = lines.sections.get(id);
    return sec === undefined ? null : { kind: 'section', id, name: nameOf(sec.to), flows: [flowOf(sec.line, sec.start)] };
  }
  if (kind === 'junction') {
    const j = lines.junctions.get(id);
    return j === undefined ? null : { kind: 'junction', id, name: nameOf(id), flows: [flowOf(j.line, j.step === undefined ? undefined : { step: j.step })] };
  }
  return null;
}

export function useTeacherMode(input: {
  readonly lib: CogitaLibrary;
  readonly me: Me | null;
  readonly learner: Learner | null;
  readonly lines: Lines;
  readonly nameOf: (id: string) => string;
  readonly href: (...tail: readonly string[]) => string;
  readonly onShow: (kind: 'place' | 'section', id: string) => void;
  readonly facts: AssignFacts;
}): MapMode {
  const { lib, me, learner, lines, nameOf, href, onShow, facts } = input;
  const cls = useMapClassTools({ lib, me, learner, nameOf, href, onShow, facts });
  return {
    id: 'teacher',
    active: true,
    draw: { tasks: cls.teaching ? null : cls.marked },
    buttons: (thing, own) => cls.buttons(classTargetOf(lib, lines, nameOf, thing.kind, thing.id), own),
    overlay: cls.overlay,
    menu: { classBody: cls.menuBody, teaching: cls.teaching }
  };
}
