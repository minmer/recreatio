/**
 * DAS WERK IM BROWSER (2026-11-15) — einmal gerechnet je Stand des Skryptorium und der Linse: Modell, Wissen,
 * Vorkommen, Regeln, Vorlagen und der Bericht der Prüfung je Weg. Alle Reiter des Werks lesen hier.
 */

import { useMemo } from 'react';

import type { LibEntry } from '../../library/libraryKinds';
import type { LibraryStore } from '../../library/libraryStore';
import type { ScriptoriumLens } from '../lens';
import { checkWork, templatesOf, type CheckReport } from './workChecks';
import { EMPTY_KNOWLEDGE, knowledgeFrom, type WorkKnowledge } from './workKnowledge';
import { entitiesOf, occurrencesOf, type Occurrence } from './workMarks';
import { pathsOf, readWork, type WorkModel, type WorkPath } from './workModel';
import { rulesOf, type WorkRule } from './workRules';
import type { UnitTemplate } from './workTemplates';

export interface Work {
  readonly model: WorkModel;
  readonly knowledge: WorkKnowledge;
  readonly occurrences: readonly Occurrence[];
  readonly rules: readonly WorkRule[];
  readonly templates: ReadonlyMap<string, UnitTemplate>;
  readonly reports: readonly CheckReport[];
  readonly paths: readonly WorkPath[];
  /** Der Bericht eines Weges (oder des ersten). */
  readonly report: (path: string | undefined) => CheckReport | undefined;
}

/** `project`: der Eintrag, wie er gerade im Formular steht (Einstellungen wirken sofort). */
export function useWork(store: LibraryStore, project: LibEntry, lens: ScriptoriumLens | null): Work {
  const revision = store.revision;
  const lensRevision = lens?.revision ?? -1;
  const model = useMemo(() => readWork(project, store),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, store, revision]);
  const knowledge = useMemo(() => (lens === null ? EMPTY_KNOWLEDGE : knowledgeFrom(lens, model.bases, entitiesOf(occurrencesOf(model, store)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [model, lens, lensRevision]);
  const occurrences = useMemo(() => occurrencesOf(model, store, knowledge), [model, store, knowledge]);
  const rules = useMemo(() => rulesOf(model, store), [model, store]);
  const templates = useMemo(() => templatesOf(store),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, revision]);
  const reports = useMemo(() => checkWork({ model, look: store, knowledge, occurrences, rules }), [model, store, knowledge, occurrences, rules]);
  const paths = useMemo(() => pathsOf(model), [model]);
  return {
    model, knowledge, occurrences, rules, templates, reports, paths,
    report: (key) => reports.find((r) => r.path.key === key) ?? reports[0]
  };
}
