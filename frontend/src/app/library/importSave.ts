/**
 * 2026-11-16 — EIN IMPORT SPEICHERT IN EINEM ZAPIS (Bibliothek, Skryptorium). Ein Werk hat schnell tausend Knoten:
 * eine Anfrage je Eintrag und ein Neuzeichnen je Eintrag dauerten Stunden. Erst alles in einer Transaktion
 * (`saveAll`); geht das nicht (zu gross, ein neuerer Stand irgendwo), dann mehrere zugleich (`saveMany`) — und der
 * Grund steht in den Warnungen. Der Fortschritt wird nur alle paar Dutzend Einträge gemeldet (jede Meldung zeichnet neu).
 */

import { t } from '../core/i18n';
import { WorkspaceError } from '../core/session';
import type { LibraryStore, SaveInput } from './libraryStore';

const EVERY = 50;

export async function saveImport(store: LibraryStore, inputs: readonly SaveInput[], stage: (what: string) => void, saving: (n: number, total: number) => string):
  Promise<{ done: number; failed: { id: string; error: string }[]; warnings: string[] }> {
  const say = (n: number, total: number) => { if (n === total || n % EVERY === 0) stage(saving(n, total)); };
  try {
    await store.saveAll(inputs, say);
    return { done: inputs.length, failed: [], warnings: [] };
  } catch (e) {
    const reason = e instanceof WorkspaceError || e instanceof Error ? e.message : '';
    const result = await store.saveMany(inputs, say);
    return { done: result.saved.length, failed: result.failed, warnings: [t('libraryData.store.batchFallback', { reason })] };
  }
}
