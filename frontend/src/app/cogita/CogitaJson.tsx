/**
 * COGITA — JSON UND DIE EIGENE KI (COGITA.md §14, [P13]): der ganze Kurs
 * hinaus und herein (mit Beschreibung), und ein Auftrag zum Kopieren — die App
 * ruft keine KI; was aus dem eigenen Chat zurückkommt, wird hier geprüft und
 * erst nach dem Blick darauf gespeichert.
 */

import { useState } from 'react';

import { JsonPanel } from '../ui/JsonPanel';
import { WorkspaceError } from '../core/session';
import { aiPrompt, applyImport, courseDescription, exportCourse, exportFlow, planImport, structurePreview } from './json';
import { useImportReview } from './ImportReviewPanel';
import { useCtx } from './ui';

export function CogitaJson() {
  const { lib, name, writes } = useCtx();
  const [what, setWhat] = useState<'entities' | 'statements' | 'questions' | 'flow' | 'schema'>('statements');
  const [source, setSource] = useState('');
  const [copied, setCopied] = useState(false);
  const [flow, setFlow] = useState(lib.docs('flow')[0]?.id ?? '');
  const file = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  /* 2026-10-25 — jede Änderung an Bestehendem einzeln annehmen (und vorher korrigieren), Neues abwählen. */
  const review = useImportReview(lib);

  return (
    <div className="cg">
      <JsonPanel
        summary="Kurs jako JSON — eksport i import"
        lead={<>Rodzaje, wpisy (także wypowiedzi i pytania), szablony kart, powtórki, przebiegi, zbiory, wyglądy, zasady i wartości jako jeden dokument. Import dodaje nowe i zmienia istniejące w miejscu; niczego nie usuwa. Przed zapisem widać każdą zmianę: nowe są zaznaczone, a zmiany w tym, co już jest, trzeba przyjąć — każdą można też poprawić.</>}
        fileName={`kurs-${file}.json`}
        exportDoc={() => exportCourse(lib, name)}
        description={() => courseDescription(lib)}
        preview={(doc) => { const p = planImport(lib, doc); return 'error' in p ? p : { lines: [...p.lines, ...structurePreview(lib, p)], warnings: p.warnings }; }}
        options={review.options}
        importLabel="Zapisz przyjęte"
        onImport={async (doc, stage) => {
          if (!writes) throw new WorkspaceError('W tej bazie wiedzy możesz tylko czytać.');
          return applyImport(lib, review.decide(doc), stage);
        }}
      />

      {lib.docs('flow').length > 0 && (
        <section className="cg-card">
          <h3>Jeden przebieg z jego treścią</h3>
          <div className="cg-row">
            <select value={flow} onChange={(e) => setFlow(e.target.value)}>{lib.docs('flow').map((e) => <option key={e.id} value={e.id}>{String(e.data.name ?? 'Przebieg')}</option>)}</select>
            <button type="button" className="wk-link-btn" onClick={() => {
              const doc = exportFlow(lib, flow);
              if (doc === null) return;
              const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `przebieg-${file}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}>Pobierz</button>
          </div>
        </section>
      )}

      {writes && (
        <section className="cg-card">
          <h3>Przygotuj z tekstu — w swoim czacie z AI</h3>
          <p className="wk-hint">Aplikacja nie wysyła niczego do AI. Skopiuj polecenie do własnego czatu, a odpowiedź (JSON) wklej wyżej w „Import" — zobaczysz, co powstanie, zanim cokolwiek się zapisze.</p>
          <div className="cg-row">
            <select value={what} onChange={(e) => setWhat(e.target.value as typeof what)}>
              <option value="statements">wypowiedzi (teza i treść w blokach)</option>
              <option value="entities">wpisy (osoby, miejsca, dzieła…)</option>
              <option value="questions">pytania</option>
              <option value="flow">przebieg z treścią</option>
              <option value="schema">rodzaje (schemat)</option>
            </select>
          </div>
          <textarea rows={6} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Wklej tekst źródłowy (rozdział, notatki, kazanie)…" />
          <button type="button" className="wk-btn" disabled={source.trim() === ''} onClick={() => {
            void navigator.clipboard?.writeText(aiPrompt(lib, what, source)).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2500); });
          }}>{copied ? 'Skopiowano polecenie' : 'Kopiuj polecenie dla AI'}</button>
        </section>
      )}
    </div>
  );
}
