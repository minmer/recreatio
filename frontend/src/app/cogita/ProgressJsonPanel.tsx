/**
 * 2026-10-29 — MOJE POSTĘPY ALS JSON (`progressJson.ts`) unter „Postępy": die eigenen Antworten dieser Baza
 * hinaus — mit dem Wortlaut der Karten, damit eine Auswertung weiss, was gefragt war — und herein, nur in den
 * eigenen Fortschritt (`Learner.adopt`: ein neuer versiegelter Stapel, wie jede Antwort aus der Nauka).
 */

import { useMemo } from 'react';

import { JsonPanel } from '../ui/JsonPanel';
import { WorkspaceError } from '../core/session';
import type { Card } from './cardBasics';
import { renamer, type Learner } from './learn';
import { applyProgress, exportProgress, planProgress, PROGRESS_JSON, type ProgressContext } from './progressJson';
import { entityName, useCtx } from './ui';

export function ProgressJsonPanel({ learner, cards }: { learner: Learner; cards: readonly Card[] }) {
  const { lib, name } = useCtx();
  const rename = useMemo(() => renamer(lib.merges()), [lib]);

  /* Was eine Karte fragt, in Worten — wie in der Tabelle „Moje pytania". */
  const texts = useMemo(() => {
    const out = new Map<string, string>();
    for (const card of cards) {
      const prompt = card.prompt.map((p) => p.text).join(' ').trim();
      const base = prompt !== '' ? prompt : card.entity !== undefined ? entityName(lib, card.entity) : card.question;
      out.set(card.key, (card.label === undefined ? base : `${base}: ${card.label}`).slice(0, 200));
    }
    return out;
  }, [cards, lib]);
  const cardKeys = useMemo(() => new Set(cards.map((card) => card.key)), [cards]);

  /* Der Stand des Lernenden zur Zeit des Plans — was inzwischen beantwortet wurde, zählt mit. */
  const context = (): ProgressContext => ({
    libraryId: lib.libraryId, existing: learner.progress.answers, cardKeys, ...(rename === undefined ? {} : { rename })
  });
  const file = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'baza';

  return (
    <JsonPanel
      summary="Moje postępy jako JSON"
      lead={<>Twoje odpowiedzi w tej bazie wiedzy — karta, jak dobrze, kiedy, jak długo i co podano — do zachowania albo do analizy przez AI. Import dopisuje do Twoich postępów odpowiedzi, których jeszcze nie ma; niczego nie zmienia ani nie usuwa i nigdy nie zapisuje za kogoś innego.</>}
      fileName={`postepy-${file}.json`}
      exportDoc={() => exportProgress({
        libraryId: lib.libraryId, name, answers: learner.progress.answers.values(),
        textOf: (key) => texts.get(rename?.(key) ?? key)
      })}
      format={PROGRESS_JSON}
      preview={(doc) => planProgress(doc, context())}
      importLabel="Dopisz do moich postępów"
      onImport={async (doc, stage) => {
        const plan = planProgress(doc, context());
        if ('error' in plan) throw new WorkspaceError(plan.error);
        const done = await applyProgress(plan, learner, stage);
        return { lines: done.lines, warnings: [...plan.warnings, ...done.warnings] };
      }}
    />
  );
}

export default ProgressJsonPanel;
