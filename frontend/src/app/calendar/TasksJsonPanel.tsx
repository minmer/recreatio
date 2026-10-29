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
  const [scope, setScope] = useState(ALL);

  /* Jede Gruppe mit Namen und Recht — „Tylko ja" darf immer, eine Gruppe, wenn ich dort schreibe. */
  const groups = useMemo((): TaskGroup[] => areas.map((a) => ({
    areaId: a.areaId,
    name: a.personal === true ? 'Tylko ja' : groupName(areas, a.areaId),
    write: a.personal === true || a.myLevel === 'write' || a.myLevel === 'admin',
    ...(a.personal === true ? { personal: true } : {}),
    ...(a.ownChat != null ? { chat: true } : {})
  })), [areas]);

  /* Zur Wahl stehen nur Bereiche, in denen Aufgaben liegen. */
  const withTasks = useMemo(() => areas.filter((a) => tasks.some((t) => t.areaId === a.areaId)), [areas, tasks]);
  const personal = withTasks.find((a) => a.personal === true);
  const chosen = scope === ALL ? tasks : tasks.filter((t) => t.areaId === scope);
  const scopeName = scope === ALL ? '' : fold(groups.find((g) => g.areaId === scope)?.name ?? '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const fileName = `zadania${scopeName === '' ? '' : `-${scopeName}`}.json`;

  const plan = (doc: unknown) => planTasksImport(doc, { tasks, groups, now: new Date() });

  return (
    <>
      {withTasks.length > 0 && (
        <label className="wk-field">
          <span>Do eksportu</span>
          <AreaPick
            label="Które zadania" areas={areas} only={withTasks} value={scope} onChange={setScope}
            extras={[{ value: ALL, label: 'Wszystkie zadania' }, ...(personal === undefined ? [] : [{ value: personal.areaId, label: 'Tylko ja (prywatne)' }])]}
          />
        </label>
      )}

      <JsonPanel
        open
        summary="Zadania jako JSON"
        lead={<>Zadania, które widzisz, jako jeden dokument — do kopii, do poprawienia ręcznie albo przez AI. Import zmienia zadania z „id” w miejscu i dodaje nowe; usuwa tylko te z „remove”: true. Odhaczenia nie są w dokumencie i import ich nie zmienia.</>}
        fileName={fileName}
        exportDoc={() => exportTasks(chosen, groups)}
        format={TASKS_JSON}
        preview={(doc) => {
          const planned = plan(doc);
          return 'error' in planned ? planned : { lines: planned.lines, warnings: planned.warnings };
        }}
        importLabel="Importuj zadania"
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
            stage(`Zapisywanie zadań… ${index + 1}/${planned.changes.length}`);
            try {
              if (change.action === 'remove' && change.taskId !== null) await archiveTask(change.taskId);
              else if (change.spec !== null) {
                const areaId = change.spec.areaId ?? own;
                if (areaId === null) throw new WorkspaceError('Nie udało się założyć obszaru „Tylko ja”.');
                await saveTask(me.ring, draftOf(change.spec, areaId, me.person.id), change.taskId ?? undefined, { quiet: true });
              }
              saved += 1;
            } catch (e) {
              failed.push(`Nie zapisano „${change.title}”: ${e instanceof WorkspaceError ? e.message : 'błąd połączenia.'}`);
            }
          }

          /* Einmal neu: die Erinnerungen (NotifyBell) und die Liste. */
          tasksChanged();
          onChanged();
          if (saved === 0) throw new WorkspaceError(failed[0] ?? 'Import się nie udał.');
          return { lines: planned.lines, warnings: [...planned.warnings, ...failed] };
        }}
      />
    </>
  );
}

export default TasksJson;
