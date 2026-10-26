/**
 * 0133 — „PYTANIA WIDAĆ W OBSZARZE …": unter welchem Bereich die Fragen eines
 * Formulars liegen (`questionsArea.ts`). Der Normalfall eines Wydarzenie: der
 * jawne Bereich, in dem es veröffentlicht ist — die Antworten bleiben im
 * Bereich des Formulars. Verlegen darf, wer beide Bereiche führt.
 */

import { useEffect, useState } from 'react';

import type { AreaRow } from '../areas/area';
import { AreaPick } from '../areas/AreaPick';
import type { Ring } from '../core/keys';
import { questionsAreaOf, type ModuleRow } from '../modules/module';
import { moveQuestions } from './questionsArea';

export function QuestionsAreaSettings({ module, areas, ring, busy, onAct }: {
  module: ModuleRow;
  areas: readonly AreaRow[];
  ring: Ring | null;
  busy: boolean;
  onAct: (what: string, todo: () => Promise<unknown>) => Promise<void> | void;
}) {
  const own = module.areaId;
  const now = questionsAreaOf(module);
  const [picked, setPicked] = useState(now ?? '');
  useEffect(() => { setPicked(now ?? ''); }, [now]);

  if (own === null || now === null) return null;

  /* Zur Wahl: der eigene Bereich und jeder, den ich führe (der Dienst verlangt: beide führen). */
  const led = areas.filter((a) => a.myLevel === 'admin' && a.personal !== true && a.ownChat == null);
  const ownRow = areas.find((a) => a.areaId === own);
  const choices = ownRow === undefined || led.some((a) => a.areaId === own) ? led : [ownRow, ...led];

  const name = (areaId: string) => areas.find((a) => a.areaId === areaId)?.name ?? 'obszar';
  const isPublic = (areaId: string) => areas.find((a) => a.areaId === areaId)?.publicLevel !== 'none';
  const ownLeads = led.some((a) => a.areaId === own);

  return (
    <section className="wk-field wk-questions-area" aria-label="Gdzie widać pytania">
      <span>Pytania widać w obszarze</span>
      <p className="wk-questions-area-now">
        „{name(now)}” — {isPublic(now) ? 'jawny: pytania przeczyta każdy, kto otworzy stronę' : 'niejawny: pytania przeczyta tylko ten, kto czyta ten obszar'}.
        {now !== own && <> Odpowiedzi trafiają do obszaru formularza „{name(own)}”.</>}
      </p>
      {ownLeads && (
        <div className="wk-questions-area-pick">
          <AreaPick label="Pytania widać w obszarze" areas={areas} only={choices} value={picked} onChange={setPicked} disabled={busy || ring === null} />
          <button
            type="button" className="wk-btn wk-btn-small" disabled={busy || ring === null || picked === '' || picked === now}
            onClick={() => void onAct('Przepieczętowywanie pytań…', () => moveQuestions(ring!, module.moduleId, picked === own ? null : picked))}
          >
            Przenieś pytania
          </button>
        </div>
      )}
      <p className="wk-questions-area-why">
        Odpowiedzi zawsze zostają w obszarze formularza. Pytania przenosi do innego obszaru tylko ten, kto prowadzi oba obszary.
      </p>
    </section>
  );
}
