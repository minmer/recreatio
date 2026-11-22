/**
 * 2026-11-22 (I3/I4, `modes.ts`) — ALLEIN ODER IN DER STUNDE, IM EDITOR: je Schritt mit Inhalt (Folie, Frage, Abstecher …),
 * wann er gespielt wird („use": beides, nur allein, nur in einer Stunde — gewinnt über den Wert des Eintrags), und je Frage, ob
 * sie eine Vorhersage ist (`"predict": true` — sie zählt nie). Was die beiden Modi davon spielen, sagt die Zeile darunter.
 */

import { useT } from '../core/i18n';
import type { Graph, GraphNode } from './graph';
import { countedGraph, isPredict, PLAY_MODES, readUse, skipExitOf, stepEntryOf, stepUse, STEP_USES, type StepUse } from './modes';
import type { CogitaLibrary } from './store';

export function ModeEditor({ graph, start, lib, writes, onChange }: { graph: Graph; start: string | null; lib: CogitaLibrary; writes: boolean; onChange: (g: Graph) => void }) {
  const t = useT();
  const steps = graph.nodes.filter((n) => skipExitOf(n) !== null);
  if (steps.length === 0) return null;
  const useOf = (id: string) => lib.entity(id)?.data.use;
  const patch = (node: GraphNode, change: (c: Record<string, unknown>) => Record<string, unknown>) =>
    onChange({ nodes: graph.nodes.map((n) => (n.id === node.id ? { ...n, config: change({ ...n.config }) } : n)), edges: graph.edges });
  const nameOf = (n: GraphNode): string => {
    if (typeof n.config.title === 'string' && n.config.title !== '') return n.config.title;
    const of = stepEntryOf(n);
    const e = of === null ? undefined : lib.entity(of);
    return e === undefined ? n.id : lib.label(e).slice(0, 80);
  };
  const marked = steps.filter((n) => readUse(n.config.use) !== null || isPredict(n) || readUse(useOf(stepEntryOf(n) ?? '')) !== null).length;
  /* Was jeder Modus davon zählt (ohne Vorhersagen — sie zählen nie). */
  const left = PLAY_MODES.map((m) => ({ mode: m, n: countedGraph(graph, start, { mode: m, useOf }).graph.nodes.filter((n) => skipExitOf(n) !== null).length }));
  return (
    <details className="cg-adaptive" data-mode-editor={steps.length}>
      <summary>{t('cogitaEditFlow.modes.title')} {marked > 0 ? t('cogitaEditFlow.modes.count', { count: marked }) : ''}</summary>
      <p className="cg-muted">{t('cogitaEditFlow.modes.hint')}</p>
      <p className="cg-muted" data-mode-left="">{left.map((l) => t('cogitaEditFlow.modes.left', { mode: t(`cogitaData.logic.mode.${l.mode}`), count: l.n })).join(' · ')}</p>
      <ul className="cg-adaptive-list">
        {steps.map((n) => {
          const own = readUse(n.config.use);
          const entry = stepEntryOf(n);
          const fromEntry = entry === null ? null : readUse(useOf(entry));
          const effective: StepUse = stepUse(n, useOf);
          return (
            <li key={n.id} data-mode-step={n.id}>
              <strong>{nameOf(n)}</strong>
              <div className="cg-row">
                <label className="wk-field"><span>{t('cogitaEditFlow.modes.use')}</span>
                  <select value={own ?? ''} disabled={!writes} data-mode-use={n.id}
                    onChange={(e) => patch(n, (c) => { if (e.target.value === '') delete c.use; else c.use = e.target.value; return c; })}>
                    <option value="">{t('cogitaEditFlow.modes.fromEntry', { use: t(`cogitaEditFlow.modes.useOf.${fromEntry ?? 'both'}`) })}</option>
                    {STEP_USES.map((u) => <option key={u} value={u}>{t(`cogitaEditFlow.modes.useOf.${u}`)}</option>)}
                  </select>
                </label>
                {n.type === 'question' && (
                  <label className="wk-check">
                    <input type="checkbox" disabled={!writes} checked={isPredict(n)} data-mode-predict={n.id}
                      onChange={(e) => patch(n, (c) => { if (e.target.checked) c.predict = true; else delete c.predict; return c; })} />
                    <span>{t('cogitaEditFlow.modes.predict')}</span>
                  </label>
                )}
              </div>
              {effective !== 'both' && <span className="cg-muted" data-mode-effective={effective}>{t(`cogitaEditFlow.modes.plays.${effective}`)}</span>}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
