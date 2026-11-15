/**
 * DIE STRUKTUR (2026-11-15) — der Baum eines Werks in Lesereihenfolge: Titel, Ebene, Rolle, Stand, Wörter gegen Ziel,
 * was dem Konzept noch fehlt (Zweck, Rolle, Kernsatz, Ziel) und wie viele Befunde an einem Knoten stehen. Darüber,
 * wie weit das Konzept je Ebene ist. Ein gewählter Knoten öffnet sich daneben (`NodePanel`); die Knöpfe darüber
 * legen an, verschieben, teilen, vereinen und löschen — gespeichert wird sofort.
 */

import { useState } from 'react';

import { useT } from '../../core/i18n';
import { WorkspaceError } from '../../core/session';
import { NODE_STATUS } from '../../library/libraryKinds';
import type { SaveInput } from '../../library/libraryStore';
import { viewPath } from '../../routes';
import { ask, toast } from '../../ui/dialogs';
import type { Finding } from './workChecks';
import {
  allNodes, linear, mergeNodes, moveNode, newNode, outlineToNodes, pathOf, progressOf, roleOf, splitNode, subtree, targetOf, wordsOf,
  type WorkNode
} from './workModel';
import { NodePanel } from './NodePanel';
import { ALL_PATHS, PathPick, type WorkCtx } from './WorkView';

interface Row {
  readonly node: WorkNode;
  readonly number?: string;
}

export function WorkTree({ ctx, selected }: { ctx: WorkCtx; selected: string | null }) {
  const t = useT();
  const { model } = ctx.work;
  const { store } = ctx;
  const [busy, setBusy] = useState(false);
  const rows: Row[] = ctx.path === ALL_PATHS
    ? allNodes(model).map((node) => ({ node }))
    : linear(model, pathOf(model, ctx.path)).map((p) => ({ node: p.node, number: p.number }));
  const findings: readonly Finding[] = ctx.path === ALL_PATHS ? ctx.work.reports.flatMap((r) => r.findings) : ctx.work.report(ctx.path)?.findings ?? [];
  const chosen = selected === null ? undefined : model.nodes.get(selected);
  const editable = !ctx.readOnly && !model.fromOutline;
  const entryOf = (id: string) => store.get(id);

  const run = async (todo: () => Promise<unknown>) => {
    setBusy(true);
    try { await todo(); } catch (e) { toast(e instanceof WorkspaceError ? e.message : t('workUi.tree.saveFailed'), { kind: 'error' }); } finally { setBusy(false); }
  };
  const go = (id: string) => { window.location.hash = ctx.href('struktura', id); };
  const saveAll = (inputs: readonly SaveInput[]) => store.saveAll(inputs);
  const parentOf = (n: WorkNode) => (n.parent === null ? null : model.nodes.get(n.parent) ?? null);
  const siblingsOf = (n: WorkNode) => { const p = parentOf(n); return p === null ? model.roots : p.children; };

  const add = (child: boolean) => void run(async () => {
    const parent = chosen === undefined ? null : child ? chosen : parentOf(chosen);
    const after = chosen === undefined ? null : child ? chosen.children[chosen.children.length - 1] ?? null : chosen;
    const made = newNode(model, parent, after, { title: t('workUi.tree.newTitle') });
    await store.save(made);
    go(made.id!);
  });
  const move = (to: 'up' | 'down' | 'in' | 'out') => void run(async () => {
    if (chosen === undefined) return;
    const entry = entryOf(chosen.id);
    if (entry === undefined) return;
    const sibs = siblingsOf(chosen);
    const i = sibs.findIndex((s) => s.id === chosen.id);
    const parent = parentOf(chosen);
    let input: SaveInput | null = null;
    if (to === 'up' && i > 0) input = moveNode(model, chosen, parent, sibs[i - 2] ?? null, entry);
    if (to === 'down' && i + 1 < sibs.length) input = moveNode(model, chosen, parent, sibs[i + 1], entry);
    if (to === 'in' && i > 0) { const into = sibs[i - 1]; input = moveNode(model, chosen, into, into.children[into.children.length - 1] ?? null, entry); }
    if (to === 'out' && parent !== null) input = moveNode(model, chosen, parentOf(parent), parent, entry);
    if (input !== null) await store.save(input);
  });
  const split = () => void run(async () => {
    if (chosen === undefined) return;
    const parent = parentOf(chosen);
    if (parent === null) return;
    const i = parent.children.findIndex((c) => c.id === chosen.id);
    const made = splitNode(model, parent, i + 1, `${parent.title} (${t('workUi.tree.continued')})`, entryOf);
    await saveAll(made);
    go(made[0].id!);
  });
  const merge = () => void run(async () => {
    if (chosen === undefined) return;
    const sibs = siblingsOf(chosen);
    const next = sibs[sibs.findIndex((s) => s.id === chosen.id) + 1];
    if (next === undefined) return;
    const yes = await ask({ title: t('workUi.tree.mergeAsk', { keep: chosen.title || t('work.untitled'), drop: next.title || t('work.untitled') }), body: t('workUi.tree.mergeBody', { keep: chosen.title || t('work.untitled') }), confirm: t('workUi.tree.merge'), danger: true });
    if (!yes) return;
    const plan = mergeNodes(chosen, next, entryOf);
    if (plan === null) return;
    await saveAll(plan.save);
    await store.remove(plan.remove);
  });
  const remove = () => void run(async () => {
    if (chosen === undefined) return;
    const all = subtree(chosen);
    const yes = await ask({
      title: t('workUi.tree.deleteAsk', { title: chosen.title || t('work.untitled') }),
      body: t('workUi.tree.deleteBody', { count: all.length }),
      list: all.slice(1, 12).map((n) => n.title || t('work.untitled')),
      confirm: t('common.delete'), danger: true
    });
    if (!yes) return;
    await store.removeMany(all.map((n) => n.id));
    window.location.hash = ctx.href('struktura');
  });
  const convert = () => void run(async () => {
    await saveAll(outlineToNodes(ctx.project, store));
    toast(t('workUi.tree.converted'));
  });

  const levels = progressOf(model, store);
  const sibs = chosen === undefined ? [] : siblingsOf(chosen);
  const index = chosen === undefined ? -1 : sibs.findIndex((s) => s.id === chosen.id);

  return (
    <div className="work-structure">
      <div className="work-toolbar">
        <PathPick ctx={ctx} />
        {model.fromOutline && (
          <div className="wk-note work-convert">
            <span>{t('workUi.tree.fromOutline')}</span>
            {!ctx.readOnly && <button type="button" className="wk-btn wk-btn-small" disabled={busy} onClick={convert}>{t('workUi.tree.convert')}</button>}
          </div>
        )}
      </div>

      {levels.length > 0 && (
        <table className="work-progress">
          <caption>{t('workUi.progress.caption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('workUi.progress.level')}</th>
              <th scope="col">{t('workUi.progress.nodes')}</th>
              <th scope="col">{t('workUi.progress.noPurpose')}</th>
              <th scope="col">{t('workUi.progress.noRole')}</th>
              <th scope="col">{t('workUi.progress.noSynopsis')}</th>
              <th scope="col">{t('workUi.progress.noTarget')}</th>
              <th scope="col">{t('workUi.progress.words')}</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((l) => (
              <tr key={l.depth}>
                <th scope="row">{l.name === '' ? t('workUi.progress.depth', { depth: l.depth + 1 }) : l.name}</th>
                <td>{l.nodes}</td>
                <td className={l.noPurpose > 0 ? 'is-open' : ''}>{l.noPurpose}</td>
                <td className={l.noRole > 0 ? 'is-open' : ''}>{l.noRole}</td>
                <td className={l.noSynopsis > 0 ? 'is-open' : ''}>{l.noSynopsis}</td>
                <td className={l.noTarget > 0 ? 'is-open' : ''}>{l.noTarget}</td>
                <td>{l.target > 0 ? t('workUi.progress.wordsOf', { words: l.words, target: l.target }) : l.words}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editable && (
        <div className="wk-actions work-node-actions" role="toolbar" aria-label={t('workUi.tree.actions')}>
          <button type="button" className="wk-btn wk-btn-small" disabled={busy} onClick={() => add(false)}>{chosen === undefined ? t('workUi.tree.addTop') : t('workUi.tree.addSibling')}</button>
          {chosen !== undefined && <button type="button" className="wk-btn wk-btn-small wk-btn-line" disabled={busy} onClick={() => add(true)}>{t('workUi.tree.addChild')}</button>}
          {chosen !== undefined && (
            <>
              <button type="button" className="wk-link-btn" disabled={busy || index <= 0} onClick={() => move('up')} title={t('workUi.tree.up')} aria-label={t('workUi.tree.up')}>↑</button>
              <button type="button" className="wk-link-btn" disabled={busy || index + 1 >= sibs.length} onClick={() => move('down')} title={t('workUi.tree.down')} aria-label={t('workUi.tree.down')}>↓</button>
              <button type="button" className="wk-link-btn" disabled={busy || index <= 0} onClick={() => move('in')} title={t('workUi.tree.indent')} aria-label={t('workUi.tree.indent')}>→</button>
              <button type="button" className="wk-link-btn" disabled={busy || chosen.parent === null} onClick={() => move('out')} title={t('workUi.tree.outdent')} aria-label={t('workUi.tree.outdent')}>←</button>
              <button type="button" className="wk-link-btn" disabled={busy || chosen.parent === null || index + 1 >= sibs.length} onClick={split}>{t('workUi.tree.split')}</button>
              <button type="button" className="wk-link-btn" disabled={busy || index + 1 >= sibs.length} onClick={merge}>{t('workUi.tree.mergeNext')}</button>
              <button type="button" className="wk-link-btn wk-danger" disabled={busy} onClick={remove}>{t('common.delete')}</button>
            </>
          )}
        </div>
      )}

      <div className={chosen === undefined ? 'work-split' : 'work-split has-panel'}>
        {rows.length === 0 ? <p className="wk-empty">{t('workUi.tree.empty')}</p> : (
          <ol className="work-tree">
            {rows.map(({ node, number }) => <TreeRow key={node.id} ctx={ctx} node={node} number={number} findings={findings} on={node.id === selected} />)}
          </ol>
        )}
        {chosen !== undefined && !chosen.virtual && <NodePanel key={chosen.id} ctx={ctx} node={chosen} />}
      </div>
    </div>
  );
}

function TreeRow({ ctx, node, number, findings, on }: { ctx: WorkCtx; node: WorkNode; number?: string; findings: readonly Finding[]; on: boolean }) {
  const t = useT();
  const { model } = ctx.work;
  const parent = node.parent === null ? undefined : model.nodes.get(node.parent);
  const dim = parent === undefined || parent.split === '' ? undefined : model.dimensions.find((d) => d.key === parent.split);
  const variant = dim === undefined ? null : node.variant === '' ? t('workUi.tree.core') : dim.values.find((v) => v.key === node.variant)?.name ?? node.variant;
  const level = model.levels[node.depth]?.name ?? '';
  const role = roleOf(model, node.role);
  const status = NODE_STATUS.find((s) => s.value === node.status);
  const target = targetOf(node);
  const words = wordsOf(node, ctx.store);
  const mine = findings.filter((f) => f.node === node.id);
  const must = mine.filter((f) => f.weight === 'must').length;
  const should = mine.filter((f) => f.weight === 'should').length;
  const missing = [
    node.purpose === '' ? [t('workUi.tree.letterPurpose'), t('workUi.tree.missingPurpose')] : null,
    node.role === '' ? [t('workUi.tree.letterRole'), t('workUi.tree.missingRole')] : null,
    node.synopsis === '' ? [t('workUi.tree.letterSynopsis'), t('workUi.tree.missingSynopsis')] : null,
    target === null && node.children.length === 0 ? [t('workUi.tree.letterTarget'), t('workUi.tree.missingTarget')] : null
  ].filter((x): x is string[] => x !== null);
  const href = node.virtual ? (node.text === null ? undefined : viewPath('scriptorium', ctx.library.libraryId, node.text)) : ctx.href('struktura', node.id);

  return (
    <li className={`work-row is-d${Math.min(node.depth, 7)}${on ? ' is-on' : ''}`}>
      <a className="work-row-main" href={href} aria-current={on ? 'true' : undefined}>
        {number !== undefined && <span className="work-num">{number}</span>}
        <span className="work-row-title">{node.title || t('work.untitled')}</span>
        {level !== '' && <span className="work-level">{level}</span>}
        {variant !== null && <span className={node.variant === '' ? 'work-variant is-core' : 'work-variant'}>{dim!.name}: {variant}</span>}
        {node.split !== '' && <span className="work-variant is-split">{t('workUi.tree.splitBy', { dimension: model.dimensions.find((d) => d.key === node.split)?.name ?? node.split })}</span>}
      </a>
      <span className="work-row-meta">
        {role !== undefined && <span className={`work-role is-${role.brings}`}>{role.label}</span>}
        {status !== undefined && <span className={`work-status is-${status.value}`}>{status.label}</span>}
        <span className="work-words">{target === null ? (words > 0 ? t('workUi.tree.words', { count: words }) : '') : t('workUi.tree.wordsOf', { words, target })}</span>
        {!node.virtual && missing.map(([letter, title]) => <abbr key={title} className="work-missing" title={title}>{letter}</abbr>)}
        {must > 0 && <span className="work-count is-must" title={t('workUi.checks.must')}>{must}</span>}
        {should > 0 && <span className="work-count is-should" title={t('workUi.checks.should')}>{should}</span>}
      </span>
    </li>
  );
}
