/**
 * COGITA — JSON UND DIE EIGENE KI (COGITA.md §14, [P13]): der ganze Kurs
 * hinaus und herein (mit Beschreibung), und ein Auftrag zum Kopieren — die App
 * ruft keine KI; was aus dem eigenen Chat zurückkommt, wird hier geprüft und
 * erst nach dem Blick darauf gespeichert.
 */

import { useState } from 'react';

import { JsonPanel } from '../ui/JsonPanel';
import { WorkspaceError } from '../core/session';
import { useT } from '../core/i18n';
import { aiPrompt, applyImport, courseDescription, exportCourse, exportFlow } from './json';
import { useImportReview } from './ImportReviewPanel';
import { useCtx } from './ui';

export function CogitaJson() {
  const t = useT();
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
        summary={t('cogitaData.json.courseSummary')}
        lead={t('cogitaData.json.courseLead')}
        fileName={t('cogitaData.json.courseFile', { name: file })}
        exportDoc={() => exportCourse(lib, name)}
        description={() => courseDescription(lib)}
        /* 2026-11-03 — derselbe Plan wie in der Durchsicht und beim Speichern (dieselben Kennungen für das Neue). */
        preview={(doc) => review.preview(doc)}
        options={review.options}
        importLabel={t('cogitaData.json.saveAccepted')}
        onImport={async (doc, stage) => {
          if (!writes) throw new WorkspaceError(t('cogitaData.json.readOnly'));
          return applyImport(lib, review.decide(doc), stage);
        }}
      />

      {lib.docs('flow').length > 0 && (
        <section className="cg-card">
          <h3>{t('cogitaData.json.oneFlow')}</h3>
          <div className="cg-row">
            <select value={flow} onChange={(e) => setFlow(e.target.value)}>{lib.docs('flow').map((e) => <option key={e.id} value={e.id}>{String(e.data.name ?? t('cogitaData.docKind.flow'))}</option>)}</select>
            <button type="button" className="wk-link-btn" onClick={() => {
              const doc = exportFlow(lib, flow);
              if (doc === null) return;
              const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = t('cogitaData.json.flowFile', { name: file });
              a.click();
              URL.revokeObjectURL(a.href);
            }}>{t('common.download')}</button>
          </div>
        </section>
      )}

      {writes && (
        <section className="cg-card">
          <h3>{t('cogitaData.json.aiTitle')}</h3>
          <p className="wk-hint">{t('cogitaData.json.aiHint')}</p>
          <div className="cg-row">
            <select value={what} onChange={(e) => setWhat(e.target.value as typeof what)}>
              <option value="statements">{t('cogitaData.json.what.statements')}</option>
              <option value="entities">{t('cogitaData.json.what.entities')}</option>
              <option value="questions">{t('cogitaData.json.what.questions')}</option>
              <option value="flow">{t('cogitaData.json.what.flow')}</option>
              <option value="schema">{t('cogitaData.json.what.schema')}</option>
            </select>
          </div>
          <textarea rows={6} value={source} onChange={(e) => setSource(e.target.value)} placeholder={t('cogitaData.json.sourcePlaceholder')} />
          <button type="button" className="wk-btn" disabled={source.trim() === ''} onClick={() => {
            void navigator.clipboard?.writeText(aiPrompt(lib, what, source)).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2500); });
          }}>{copied ? t('cogitaData.json.copied') : t('cogitaData.json.copyPrompt')}</button>
        </section>
      )}
    </div>
  );
}
