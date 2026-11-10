/**
 * 2026-11-09 — DAS JSON-FACH DER LITURGIA, wie bei jedem Teil (`ui/JsonPanel.tsx`): Export, Import mit der Liste der
 * Änderungen und daneben die Beschreibung (`LITURGY_JSON`). Was den Import anhält, steht rot unter dem Plan — wie in
 * der Durchsicht von Cogita. Für die ganze Sammlung (Reiter „Import / eksport") oder eine Encja (ihre Seite).
 */
import { useMemo } from 'react';

import { useT } from '../../core/i18n';
import { WorkspaceError } from '../../core/session';
import { JsonPanel, type JsonPreview } from '../../ui/JsonPanel';
import type { OpenLibrary } from '../library';
import type { LibraryStore } from '../libraryStore';
import { effectiveEntities } from './defaults';
import { exportLiturgy, LITURGY_JSON, planLiturgyImport, problemLine, type LiturgyPlan } from './liturgyJson';
import { commitImport } from './persistence';
import { entitiesOf } from './resources';
import type { LitEntity } from './schema';

const fileName = (name: string): string => `${name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'liturgia'}.json`; // i18n-ignore — file name fallback

export function LiturgyJsonPanel({ store, library, revision, entity, open = false }: {
  store: LibraryStore;
  library: OpenLibrary;
  /** Der Stand der Sammlung — ein neuer plant neu. */
  revision: number;
  /** Nur diese Encja exportieren (ihre Seite); importiert wird jedes Dokument. */
  entity?: LitEntity;
  open?: boolean;
}) {
  const t = useT();
  /* Derselbe Plan für Vorschau und Gründe, je Dokument einmal (das Fach liest bei jedem Zeichnen neu). */
  const plans = useMemo(() => new WeakMap<object, LiturgyPlan | { error: string }>(), [store, revision]);
  const planOf = (doc: unknown): LiturgyPlan | { error: string } => {
    const make = () => { const own = entitiesOf(store.all()); return planLiturgyImport(doc, effectiveEntities(own), own); };
    if (typeof doc !== 'object' || doc === null) return make();
    const had = plans.get(doc);
    if (had !== undefined) return had;
    const made = make();
    plans.set(doc, made);
    return made;
  };

  return (
    <JsonPanel
      summary={entity === undefined ? t('liturgy.json.summary') : t('liturgy.json.summaryOne')}
      lead={entity === undefined ? t('liturgy.json.lead') : t('liturgy.json.leadOne')}
      fileName={fileName(entity?.id ?? library.name)}
      exportDoc={() => exportLiturgy(library.name, entity === undefined ? entitiesOf(store.all()) : [entity])}
      format={LITURGY_JSON}
      preview={(doc): JsonPreview | { error: string } => {
        const plan = planOf(doc);
        return 'error' in plan ? plan : { lines: plan.lines, warnings: plan.warnings };
      }}
      options={(doc) => {
        const plan = planOf(doc);
        if ('error' in plan || plan.problems.length === 0) return null;
        return (
          <div className="wk-error" role="alert" data-liturgy-blocked={plan.problems.length}>
            <p>{t('liturgy.json.problemsHead')}</p>
            <ul>
              {plan.problems.slice(0, 30).map((p, i) => <li key={i}>{problemLine(p)}</li>)}
              {plan.problems.length > 30 && <li>{t('liturgy.json.moreProblems', { count: plan.problems.length - 30 })}</li>}
            </ul>
          </div>
        );
      }}
      importLabel={t('liturgy.json.import')}
      onImport={async (doc, stage) => {
        if (!library.writes) throw new WorkspaceError(t('liturgy.readOnly'));
        stage(t('common.saving'));
        const done = await commitImport(store, doc, library.areaPublic === true);
        /* Wie nach jedem Import: die Abschrift für AI gleich neu, nicht erst nach der Ruhe. */
        if (done.saved > 0) void store.refreshAiNow().catch(() => undefined);
        /* Wie bei jedem Import: wie viele, je Art der Änderung; darunter die Zeilen des Plans ohne seine Vorschau-Zählung. */
        if (done.saved === 0) return { lines: [t('liturgy.json.line.nothing')], warnings: done.warnings };
        const counts = { created: done.create.length, updated: done.update.length, removed: done.remove.length, reset: done.reset.length };
        const count = counts.created + counts.updated + counts.removed + counts.reset;
        return { lines: [t('liturgy.json.done', { count, ...counts }), ...done.lines.slice(1)], warnings: done.warnings };
      }}
      open={open}
    />
  );
}
