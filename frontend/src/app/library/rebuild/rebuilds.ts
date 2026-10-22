/**
 * Die Umbauten in ihrer Reihenfolge (die Schritte des Implementierungsplans,
 * `documentation/IMPLEMENTATION-LOG.md`). Eine Seite je Umbau auf „Porządki".
 */

import type { Rebuild } from './rebuild';
import { baseVisibility } from './baseVisibility';
import { knowledgeToStatements } from './knowledgeToStatements';
import { refsToIds } from './refsToIds';
import { topicsToLibrary } from './topicsToLibrary';

export const REBUILDS: readonly Rebuild[] = [refsToIds, knowledgeToStatements, topicsToLibrary, baseVisibility];
