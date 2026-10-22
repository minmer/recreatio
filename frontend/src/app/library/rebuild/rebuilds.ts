/**
 * Die Umbauten in ihrer Reihenfolge (die Schritte des Implementierungsplans,
 * `documentation/IMPLEMENTATION-LOG.md`). Eine Seite je Umbau auf „Porządki".
 */

import type { Rebuild } from './rebuild';
import { refsToIds } from './refsToIds';

export const REBUILDS: readonly Rebuild[] = [refsToIds];
