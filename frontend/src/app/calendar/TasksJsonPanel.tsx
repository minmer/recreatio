/**
 * 2026-10-29 — ZADANIA ALS JSON IN DER ANSICHT „Zadania" (Więcej → „Import i
 * eksport (JSON)"): das eine Fach (`JsonPanel`) mit Export — alle Aufgaben oder
 * die einer Gruppe —, Plan und Import. Gelesen und geplant wird in
 * `tasksJson.ts`; versiegelt und gespeichert mit `saveTask`, wie im Fenster
 * einer Aufgabe. Kommt erst, wenn das Fach geöffnet wird.
 */

import { useMemo, useState } from 'react';

import { AreaPick } from '../areas/AreaPick';
import type { AreaRow } from '../areas/area';
import { groupName } from '../areas/WhoSees';
import { useT } from '../core/i18n';
import type { Me } from '../core/me';
import { WorkspaceError } from '../core/session';
import { fold } from '../shell/search';
import { JsonPanel } from '../ui/JsonPanel';
import { ensurePrivateArea } from './agenda';
import { archiveTask, saveTask, tasksChanged, type OpenTask } from './tasks';
import { draftOf, exportTasks, planTasksImport, TASKS_JSON, type TaskGroup } from './tasksJson';

/** „Wszystkie zadania" in der Wahl des Exports — keine Kennung eines Bereichs (die sind UUIDs). */
const ALL = '~all';

export function TasksJson({ me, areas, tasks, onChanged }: {
  me: Me;
  areas: readonly AreaRow[];
  /** Die Aufgaben, die ich sehe — geöffnet (`openTasks`). */
  tasks: readonly OpenTask[];
  onChanged: () => void;
}) {
  const t = useT();
  const [scope, setScope] = useState(ALL);

  /* Jede Gruppe mit Namen und Recht — „Tylko ja" darf immer, eine Gruppe, wenn ich dort schreibe. */
  const groups = useMemo((): TaskGroup[] => areas.map((a) => ({
    areaId: a.areaId,
    name: a.personal === true ? t('calendarDataTasks.onlyMe') : groupName(areas, a.areaId),
    write: a.personal === true || a.myLevel === 'write' || a.myLevel === 'admin',
    ...(a.personal === true ? { personal: true } : {}),
    ...(a.ownChat != null ? { chat: true } : {})
  })), [areas, t]);

  /* Zur Wahl stehen nur Bereiche, in denen Aufgaben liegen. */
  const withTasks = useMemo(() => areas.filter((a) => tasks.some((t) => t.areaId === a.areaId)), [areas, tasks]);
  const personal = withTasks.find((a) => a.personal === true);
  const chosen = scope === ALL ? tasks : tasks.filter((t) => t.areaId === scope);
  const scopeName = scope === ALL ? '' : fold(groups.find((g) => g.areaId === scope)?.name ?? '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const fileName = scopeName === '' ? t('calendarData.tasksPanel.fileAll') : t('calendarData.tasksPanel.fileScope', { name: scopeName });

  const plan = (doc: unknown) => planTasksImport(doc, { tasks, groups, now: new Date() });

  return (
    <>
      {withTasks.length > 0 && (
        <label className="wk-field">
          <span>{t('calendarData.tasksPanel.toExport')}</span>
          <AreaPick
            label={t('calendarData.tasksPanel.which')} areas={areas} only={withTasks} value={scope} onChange={setScope}
            extras={[{ value: ALL, label: t('calendarData.tasksPanel.all') }, ...(personal === undefined ? [] : [{ value: personal.areaId, label: t('calendarData.tasksPanel.private') }])]}
          />
        </label>
      )}

      <JsonPanel
        open
        summary={t('calendarData.tasksPanel.summary')}
        lead={<>{t('calendarData.tasksPanel.lead')}</>}
        fileName={fileName}
        exportDoc={() => exportTasks(chosen, groups)}
        format={TASKS_JSON}
        preview={(doc) => {
          const planned = plan(doc);
          return 'error' in planned ? planned : { lines: planned.lines, warnings: planned.warnings };
        }}
        importLabel={t('calendarData.tasksPanel.importLabel')}
        onImport={async (doc, stage) => {
          const planned = plan(doc);
          if ('error' in planned) throw new WorkspaceError(planned.error);
          if (planned.changes.length === 0) return { lines: planned.lines, warnings: planned.warnings };

          /* „Tylko ja" — beim ersten Mal angelegt, wie im Fenster einer Aufgabe. */
          const own = planned.changes.some((c) => c.spec !== null && c.spec.areaId === null)
            ? await ensurePrivateArea(me.ring, me.person, areas)
            : null;

          /* Eine nach der anderen; was nicht geht, wird gesagt, der Rest geht weiter. */
          const failed: string[] = [];
          let saved = 0;
          for (const [index, change] of planned.changes.entries()) {
            stage(t('calendarData.tasksPanel.saving', { n: index + 1, total: planned.changes.length }));
            try {
              if (change.action === 'remove' && change.taskId !== null) await archiveTask(change.taskId);
              else if (change.spec !== null) {
                const areaId = change.spec.areaId ?? own;
                if (areaId === null) throw new WorkspaceError(t('calendarData.tasksPanel.noPrivate'));
                await saveTask(me.ring, draftOf(change.spec, areaId, me.person.id), change.taskId ?? undefined, { quiet: true });
              }
              saved += 1;
            } catch (e) {
              failed.push(t('calendarData.tasksPanel.notSaved', { title: change.title, reason: e instanceof WorkspaceError ? e.message : t('calendarData.tasksPanel.network') }));
            }
          }

          /* Einmal neu: die Erinnerungen (NotifyBell) und die Liste. */
          tasksChanged();
          onChanged();
          if (saved === 0) throw new WorkspaceError(failed[0] ?? t('calendarData.tasksPanel.failed'));
          return { lines: planned.lines, warnings: [...planned.warnings, ...failed] };
        }}
      />
    </>
  );
}

export default TasksJson;
