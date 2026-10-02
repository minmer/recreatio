/**
 * DER LÄUFER (0076) — die Seite ohne Bildschirm.
 *
 * Läuft nur in der unsichtbaren WebView der App (RunnerHost.java), die sich
 * über `window.RecreatioRunner` meldet. Das Telefon gibt Aufträge herein
 * (`window.__recreatioRunner.run(json)`), der Läufer antwortet über
 * `RecreatioRunner.done(id, json)`:
 *
 * <code>
 *   check   was neu ist, geöffnet (notifyRich.gatherNews)
 *   reply   eine Antwort aus der Meldung — versiegelt, unterschrieben, gesendet
 *   read    die Rozmowa als gelesen markieren
 *   done    eine Aufgabe aus der Erinnerung als erledigt markieren
 * </code>
 *
 * Aufträge laufen nacheinander: der Schlüsselbund wird einmal gebaut und gilt
 * für alle, solange die WebView lebt (das Telefon wirft sie nach einer halben
 * Minute ohne Auftrag weg).
 */

import { doneIn, gatherNews, readIn, replyIn, type GatherOptions } from './app/notifyRich';
import { whoIsThere, WorkspaceError } from './app/session';

interface RunnerBridge {
  ready(): void;
  done(id: string, json: string): void;
}

interface Task {
  readonly id: string;
  readonly kind: 'check' | 'reply' | 'read' | 'done';
  readonly chatId?: string;
  readonly text?: string;
  readonly messageId?: string;
  readonly taskId?: string;
  readonly occurrenceAt?: string | null;
  readonly check?: GatherOptions;
}

declare global {
  interface Window {
    RecreatioRunner?: RunnerBridge;
    __recreatioRunner?: { run(json: string): void };
  }
}

async function perform(task: Task): Promise<unknown> {
  const who = await whoIsThere();
  switch (task.kind) {
    case 'check':
      if (task.check === undefined) throw new WorkspaceError('Brak zlecenia.');
      return gatherNews(who, task.check);
    case 'reply':
      return { ok: true, ...(await replyIn(who, task.chatId ?? '', task.text ?? '', task.messageId)) };
    case 'read':
      await readIn(who, task.chatId ?? '');
      return { ok: true };
    case 'done':
      await doneIn(who, task.taskId ?? '', task.occurrenceAt ?? null);
      return { ok: true };
    default:
      throw new WorkspaceError('Nieznane zlecenie.');
  }
}

const bridge = window.RecreatioRunner;
if (bridge !== undefined) {
  let chain: Promise<void> = Promise.resolve();
  window.__recreatioRunner = {
    run(json: string) {
      let task: Task;
      try { task = JSON.parse(json) as Task; } catch { return; }
      chain = chain.then(async () => {
        let out: unknown;
        try {
          out = await perform(task);
        } catch (e) {
          out = { ok: false, error: e instanceof Error ? e.message : 'Nie udało się.' };
        }
        bridge.done(task.id, JSON.stringify(out));
      });
    }
  };
  bridge.ready();
}
