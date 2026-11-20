/**
 * 2026-11-20 — ADAPTIVE ABLÄUFE IM EDITOR (`adaptive.ts`): je Schritt „question", was er nach der Antwort tut —
 * „Dodaj pomoc po złej odpowiedzi" (Folien, eine leichtere Prüffrage, dann weiter oder noch einmal), ein zweiter Versuch,
 * „teilweise richtig", und nach welchen Fehler-Tags der Frage er verzweigt (je Tag ein Ausgang `wrong:<tag>` im Graphen).
 * Geschrieben wird die Kurzform in die Einstellung des Schrittes — der Spieler klappt sie selbst auf.
 */

import type { ReactNode } from 'react';

import { adaptiveOf, branchSummaries, type BranchSummary } from './adaptive';
import type { Graph, GraphNode } from './graph';
import { rawList } from './questionTypes';
import type { CogitaLibrary } from './store';
import { EntityPicker } from './ui';
import { useT } from '../core/i18n';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Was eine Frage verzweigt, in einer Zeile (auch für die Vorschau des Imports). */
export function branchWords(s: BranchSummary, t: (key: string, params?: Record<string, string | number>) => string): string {
  return [
    s.tags.length === 0 ? '' : t('cogitaEditFlow.adaptive.sumTags', { list: s.tags.join(', ') }),
    s.partial === null ? '' : t('cogitaEditFlow.adaptive.sumPartial', { pct: Math.round(s.partial * 100) }),
    s.retry === null ? '' : t('cogitaEditFlow.adaptive.sumRetry', { max: s.retry.max, slides: s.retry.slides }),
    s.remediation === null ? '' : t(s.remediation.then === 'retry' ? 'cogitaEditFlow.adaptive.sumRemedyRetry' : 'cogitaEditFlow.adaptive.sumRemedy', { slides: s.remediation.slides, check: s.remediation.check ? 1 : 0, byTag: s.remediation.byTag }),
    s.picks === 0 ? '' : t('cogitaEditFlow.adaptive.sumPicks', { count: s.picks }),
    s.skips === 0 ? '' : t('cogitaEditFlow.adaptive.sumSkips', { count: s.skips })
  ].filter(Boolean).join(' · ');
}

export function AdaptiveEditor({ graph, lib, writes, onChange }: { graph: Graph; lib: CogitaLibrary; writes: boolean; onChange: (g: Graph) => void }) {
  const t = useT();
  const questions = graph.nodes.filter((n) => n.type === 'question');
  if (questions.length === 0) return null;
  const sums = new Map(branchSummaries(graph).map((s) => [s.step, s] as const));
  const patch = (node: GraphNode, change: (c: Record<string, unknown>) => Record<string, unknown>) =>
    onChange({ nodes: graph.nodes.map((n) => (n.id === node.id ? { ...n, config: change({ ...n.config }) } : n)), edges: graph.edges });
  const nameOf = (id: string) => { const e = lib.entity(id); return e === undefined ? id : lib.label(e); };
  return (
    <details className="cg-adaptive" data-adaptive-editor={questions.length}>
      <summary>{t('cogitaEditFlow.adaptive.title')} {sums.size > 0 ? t('cogitaEditFlow.adaptive.count', { count: sums.size }) : ''}</summary>
      <p className="wk-hint">{t('cogitaEditFlow.adaptive.hint')}</p>
      <ul className="cg-adaptive-list">
        {questions.map((q) => {
          const of = typeof q.config.of === 'string' ? q.config.of : '';
          const title = typeof q.config.title === 'string' && q.config.title !== '' ? q.config.title : of === '' ? q.id : nameOf(of);
          const a = adaptiveOf(q.config);
          const w = isObject(q.config.onWrong) ? q.config.onWrong : null;
          const own = of === '' ? [] : [...new Set(rawList(lib.entity(of)?.data.tags).map((x) => x.trim()).filter((x) => x !== ''))];
          const sum = sums.get(q.id);
          const setWrong = (next: Record<string, unknown> | null) => patch(q, (c) => { if (next === null) delete c.onWrong; else c.onWrong = next; return c; });
          const show = Array.isArray(w?.show) ? (w!.show as unknown[]).filter((x): x is string => typeof x === 'string') : [];
          let body: ReactNode = null;
          if (w !== null) {
            body = (
              <div className="cg-adaptive-remedy" data-adaptive-remedy={q.id}>
                <span className="wk-hint">{t('cogitaEditFlow.adaptive.slides')}</span>
                {show.map((s, i) => (
                  <div key={`${s}:${i}`} className="cg-row">
                    <span>{nameOf(s)}</span>
                    {writes && <button type="button" className="wk-link-btn" onClick={() => setWrong({ ...w, show: show.filter((_x, j) => j !== i) })}>×</button>}
                  </div>
                ))}
                {writes && <EntityPicker lib={lib} value={null} allowClear={false} placeholder={t('cogitaEditFlow.adaptive.addSlide')} onPick={(id) => { if (id !== null) setWrong({ ...w, show: [...show, id] }); }} />}
                <label className="wk-field"><span>{t('cogitaEditFlow.adaptive.check')}</span>
                  <EntityPicker lib={lib} kinds={['question']} value={typeof w.check === 'string' ? w.check : null} onPick={(id) => { const { check: _c, ...rest } = w; setWrong(id === null ? rest : { ...rest, check: id }); }} />
                </label>
                <label className="wk-field"><span>{t('cogitaEditFlow.adaptive.then')}</span>
                  <select value={w.then === 'retry' ? 'retry' : 'continue'} disabled={!writes} data-adaptive-then="" onChange={(e) => setWrong({ ...w, then: e.target.value })}>
                    <option value="continue">{t('cogitaEditFlow.adaptive.thenContinue')}</option>
                    <option value="retry">{t('cogitaEditFlow.adaptive.thenRetry')}</option>
                  </select>
                </label>
                {w.then === 'retry' && (
                  <label className="wk-field"><span>{t('cogitaEditFlow.adaptive.max')}</span>
                    <input type="number" min={1} max={5} value={typeof w.max === 'number' ? w.max : 1} disabled={!writes} onChange={(e) => setWrong({ ...w, max: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} />
                  </label>
                )}
                {writes && <button type="button" className="wk-link-btn" onClick={() => setWrong(null)}>{t('cogitaEditFlow.adaptive.remove')}</button>}
              </div>
            );
          }
          return (
            <li key={q.id} data-adaptive-step={q.id}>
              <strong>{title}</strong>
              {sum !== undefined && <span className="cg-muted" data-adaptive-summary=""> — {branchWords(sum, t)}</span>}
              {w === null && writes && (
                <button type="button" className="wk-link-btn" data-adaptive-add={q.id} onClick={() => setWrong({ show: [], then: 'continue' })}>{t('cogitaEditFlow.adaptive.add')}</button>
              )}
              {body}
              <div className="cg-row">
                <label className="wk-field"><span>{t('cogitaEditFlow.adaptive.partialAt')}</span>
                  <input type="number" min={0} max={100} step={5} value={a.partialAt === null ? '' : Math.round(a.partialAt * 100)} disabled={!writes} placeholder="—"
                    onChange={(e) => patch(q, (c) => { if (e.target.value === '') delete c.partialAt; else c.partialAt = Math.max(0, Math.min(100, Number(e.target.value))) / 100; return c; })} />
                </label>
              </div>
              {own.length > 0 && (
                <fieldset className="cg-adaptive-tags">
                  <legend>{t('cogitaEditFlow.adaptive.tags')}</legend>
                  {own.map((tag) => (
                    <label key={tag} className="cg-row">
                      <input type="checkbox" disabled={!writes} checked={a.tags.includes(tag)} data-adaptive-tag={tag}
                        onChange={(e) => patch(q, (c) => { const list = e.target.checked ? [...a.tags, tag] : a.tags.filter((x) => x !== tag); if (list.length === 0) delete c.tags; else c.tags = list; return c; })} />
                      <span>{tag}</span>
                    </label>
                  ))}
                </fieldset>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
