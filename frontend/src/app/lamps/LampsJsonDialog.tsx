/**
 * LAMPY JAKO JSON — der Dialog (2026-10-29): Export, Import mit der Liste der Änderungen und die Beschreibung
 * daneben (`lampsJson.ts`). Eigenes Bündel, erst beim Öffnen geladen: `JsonPanel` bringt den Leser der Seiten mit,
 * und die Knöpfe der Lampen sollen auf dem Telefon nicht darauf warten.
 *
 * Geschrieben wird über dieselben Aufrufe wie von Hand; was gespeichert ist, geht an `onImported` — auch nach
 * einem Fehler mittendrin, damit die Seite und der Plan der Timer im Telefon es kennen.
 */

import { WorkspaceError } from '../core/session';
import type { PhoneCtx } from '../phone/phoneContext';
import { JsonPanel } from '../ui/JsonPanel';
import { Modal } from '../ui/Modal';
import { lampSaveProblem, removeItem, saveLamp, saveTimer } from './lampStore';
import { applyLampsPlan, exportLamps, LAMPS_JSON, planLampsImport, type LampsApplied, type LampsNow } from './lampsJson';
import type { Pace } from './pace';

const two = (n: number) => String(n).padStart(2, '0');

export default function LampsJsonDialog({ ctx, now, onPace, onImported, onClose }: {
  ctx: PhoneCtx;
  now: LampsNow;
  /** Der Regler der Knöpfe — wie von Hand gestellt (am Konto gemerkt). */
  onPace: (next: Pace) => void;
  onImported: (done: LampsApplied) => void;
  onClose: () => void;
}) {
  const today = new Date();
  return (
    <Modal title="Lampy — import i eksport (JSON)" wide onClose={onClose}>
      <JsonPanel
        open
        summary="Lampy jako JSON"
        lead={<>Urządzenia z sygnałami, timery i tempo przycisków — kopia zapasowa, przeniesienie na inne konto albo timery przygotowane przez AI. Co ma „id” z eksportu, zmienia się w miejscu; co go nie ma, powstaje. Usuwa tylko „remove”: true.</>}
        fileName={`lampy-${today.getFullYear()}-${two(today.getMonth() + 1)}-${two(today.getDate())}.json`}
        exportDoc={() => exportLamps(now)}
        format={LAMPS_JSON}
        preview={(doc) => {
          const plan = planLampsImport(doc, now);
          return 'error' in plan ? plan : { lines: plan.lines, warnings: plan.warnings };
        }}
        importLabel="Importuj do lamp"
        onImport={async (doc, stage) => {
          const plan = planLampsImport(doc, now);
          if ('error' in plan) throw new WorkspaceError(plan.error);
          const done = await applyLampsPlan(plan, {
            saveLamp: (id, data, version) => saveLamp(ctx, id, data, version),
            saveTimer: (id, data, version) => saveTimer(ctx, id, data, version),
            remove: (id) => removeItem(ctx, id),
            setButtons: onPace
          }, stage);
          onImported(done);
          if (done.error !== null) {
            /* Was ohne "id" schon angelegt ist, entstünde beim nächsten Versuch mit demselben Text ein zweites Mal. */
            const made = plan.lamps.filter((l) => l.existing === null && done.lamps.some((x) => x.id === l.id)).length
              + plan.timers.filter((t) => t.existing === null && done.timers.some((x) => x.id === t.id)).length;
            throw new WorkspaceError(`Zapisano ${done.done} z ${done.total} zmian, potem: ${lampSaveProblem(done.error)}${made > 0 ? ' Nowe wpisy, które już powstały, przy ponownym imporcie tego samego tekstu powstałyby drugi raz — najpierw pobierz świeży eksport.' : ''}`);
          }
          return { lines: plan.lines, warnings: plan.warnings };
        }}
      />
    </Modal>
  );
}
