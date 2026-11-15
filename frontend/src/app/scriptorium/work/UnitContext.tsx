/**
 * DER KONTEXT EINER EINHEIT, ZUR HAND (2026-11-15) — beim Knoten in der Struktur und neben dem Editor eines Textes,
 * der zu einem Werk gehört: Zweck, Rolle, Kernsatz, die Kette darüber, die Kernsätze davor und danach, die
 * Nachbarzellen, was auf diesem Weg schon eingeführt ist, was hier einzuführen ist, die Regeln, die hier gelten, die
 * Phasen, die hier gelten, und die offenen Befunde. Dasselbe, was eine KI über `get_work_context` liest.
 */

import { useState } from 'react';

import { useT } from '../../core/i18n';
import { MARK_ROLES, type LibEntry } from '../../library/libraryKinds';
import type { LibraryStore } from '../../library/libraryStore';
import { viewPath } from '../../routes';
import { useLens, type ScriptoriumLens } from '../lens';
import { contextAt } from './workContext';
import { nodesOfText } from './workMarks';
import { pathsThrough, type WorkNode } from './workModel';
import { useWork, type Work } from './useWork';
import type { Me } from '../../core/me';
import type { OpenLibrary } from '../../library/library';

export function UnitContext({ work, store, node, pathKey, href, compact = false }: {
  work: Work;
  store: LibraryStore;
  /** Die Linse (für spätere Namen aus Nauka); der Kontext liest das Wissen des Werks. */
  lens?: ScriptoriumLens | null;
  node: WorkNode;
  pathKey: string;
  href: (...trail: string[]) => string;
  compact?: boolean;
}) {
  const t = useT();
  const through = pathsThrough(work.model, node);
  const [chosen, setChosen] = useState<string | null>(null);
  const key = chosen ?? (through.some((p) => p.key === pathKey) ? pathKey : through[0]?.key ?? pathKey);
  const report = work.report(key);
  if (report === undefined) return null;
  const ctx = contextAt(work.model, report.register, node, store, work.knowledge, work.rules, report.findings);
  const role = (r: string) => MARK_ROLES.find((m) => m.value === r)?.label ?? r;
  const link = (id: string, label: string) => <a className="wk-link" href={href('struktura', id)}>{label || t('work.untitled')}</a>;

  return (
    <section className="work-context" aria-label={t('workUi.context.title')}>
      <h3 className="lib-box-sub">{t('workUi.context.title')}</h3>
      {through.length > 1 && (
        <label className="wk-field">
          <span>{t('workUi.path.label')}</span>
          <select value={key} onChange={(e) => setChosen(e.target.value)}>
            {through.map((p) => <option key={p.key} value={p.key}>{p.name === '' ? t('workUi.path.default') : p.name}</option>)}
          </select>
        </label>
      )}
      {ctx.placed === null && <p className="wk-note">{t('workUi.context.offPath')}</p>}
      {compact && (
        <dl className="work-dl">
          {node.purpose !== '' && <><dt>{t('libraryKinds.node.fields.purpose.label')}</dt><dd>{node.purpose}</dd></>}
          {ctx.role !== '' && <><dt>{t('libraryKinds.node.fields.role.label')}</dt><dd>{ctx.role}</dd></>}
          {node.synopsis !== '' && <><dt>{t('libraryKinds.node.fields.synopsis.label')}</dt><dd>{node.synopsis}</dd></>}
          {ctx.target !== null && <><dt>{t('workUi.context.length')}</dt><dd>{t('workUi.tree.wordsOf', { words: ctx.words, target: ctx.target })}</dd></>}
        </dl>
      )}
      {ctx.chain.length > 0 && (
        <p className="work-chain">{ctx.chain.map((c, i) => <span key={c.node}>{i > 0 && ' › '}{link(c.node, c.title)}</span>)}</p>
      )}
      <dl className="work-dl">
        {ctx.previous !== null && <><dt>{t('workUi.context.previous')}</dt><dd>{link(ctx.previous.node, ctx.previous.title)}{ctx.previous.synopsis !== '' && <span className="lib-meta"> — {ctx.previous.synopsis}</span>}</dd></>}
        {ctx.next !== null && <><dt>{t('workUi.context.next')}</dt><dd>{link(ctx.next.node, ctx.next.title)}{ctx.next.synopsis !== '' && <span className="lib-meta"> — {ctx.next.synopsis}</span>}</dd></>}
        {ctx.cells.length > 0 && (
          <>
            <dt>{t('workUi.context.cells')}</dt>
            <dd>
              <ul className="work-plain">
                {ctx.cells.map((c) => {
                  const dim = work.model.dimensions.find((d) => d.key === c.dimension);
                  const value = dim?.values.find((v) => v.key === c.value)?.name ?? c.value;
                  return <li key={c.node}>{value}: {link(c.node, c.title)}{c.synopsis !== '' && <span className="lib-meta"> — {c.synopsis}</span>}</li>;
                })}
              </ul>
            </dd>
          </>
        )}
      </dl>

      <h4 className="work-h4">{t('workUi.context.deliver')}</h4>
      {ctx.deliver.length === 0 ? <p className="wk-empty">{t('workUi.context.deliverNone')}</p> : (
        <ul className="work-plain">{ctx.deliver.map((d) => <li key={`${d.entity}:${d.role}`}>{d.label} <span className="lib-meta">({role(d.role)})</span></li>)}</ul>
      )}

      <h4 className="work-h4">{t('workUi.context.introduced', { count: ctx.introduced.length })}</h4>
      {ctx.introduced.length === 0 ? <p className="wk-empty">{t('workUi.context.introducedNone')}</p> : (
        <details className="wk-fold">
          <summary>{t('workUi.context.showIntroduced')}</summary>
          <ul className="work-plain">
            {ctx.introduced.map((i) => <li key={i.entity}>{i.label}{i.kind !== '' && <span className="lib-meta"> · {i.kind}</span>} <span className="lib-meta">{t('workUi.context.introducedAt', { at: i.at || t('work.untitled') })}{i.defined ? '' : ` ${t('workUi.context.notDefined')}`}</span></li>)}
          </ul>
        </details>
      )}

      {ctx.phases.length > 0 && (
        <>
          <h4 className="work-h4">{t('workUi.context.phases')}</h4>
          <ul className="work-plain">
            {ctx.phases.map((p) => <li key={p.phase}><strong>{p.label}</strong>: {p.phaseLabel}{p.description !== '' && <span className="lib-meta"> — {p.description}</span>}</li>)}
          </ul>
        </>
      )}

      <h4 className="work-h4">{t('workUi.context.rules', { count: ctx.rules.length })}</h4>
      {ctx.rules.length === 0 ? <p className="wk-empty">{t('workUi.context.rulesNone')}</p> : (
        <ul className="work-rules-mini">
          {ctx.rules.map((r) => (
            <li key={r.id} className={`is-${r.weight}`}>
              <span>{r.rule || t('work.untitled')}</span>
              {r.why !== '' && <span className="lib-meta"> — {r.why}</span>}
            </li>
          ))}
        </ul>
      )}

      {ctx.findings.length > 0 && (
        <>
          <h4 className="work-h4">{t('workUi.context.findings', { count: ctx.findings.length })}</h4>
          <ul className="work-findings is-mini">
            {ctx.findings.map((f) => <li key={f.id} className={`is-${f.weight}`}><span>{f.message}</span> <span className="lib-meta">{f.fix}</span></li>)}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * „W DZIELE" neben dem Editor eines Textes: gehört der Text zu einem Knoten eines Werks, steht hier der Kontext
 * dieser Stelle — mit dem Weg zurück in die Struktur.
 */
export function TextWorkBox({ me, store, library, textId }: { me: Me; store: LibraryStore; library: OpenLibrary; textId: string }) {
  const nodes = nodesOfText(store, textId);
  if (nodes.length === 0) return null;
  return <TextWorkInner me={me} store={store} library={library} nodeId={nodes[0].id} />;
}

function TextWorkInner({ me, store, library, nodeId }: { me: Me; store: LibraryStore; library: OpenLibrary; nodeId: string }) {
  const t = useT();
  const lens = useLens(me, store);
  const entry = store.get(nodeId);
  const projectId = typeof entry?.data.project === 'string' ? entry.data.project : '';
  const project = store.get(projectId);
  if (project === undefined || project.kind !== 'project') return null;
  return <TextWorkBody store={store} library={library} project={project} lens={lens} nodeId={nodeId} label={t('workUi.context.inWork')} />;
}

function TextWorkBody({ store, library, project, lens, nodeId, label }: {
  store: LibraryStore; library: OpenLibrary; project: LibEntry; lens: ScriptoriumLens | null; nodeId: string; label: string;
}) {
  const t = useT();
  const work = useWork(store, project, lens);
  const node = work.model.nodes.get(nodeId);
  if (node === undefined) return null;
  const href = (...trail: string[]) => viewPath('scriptorium', library.libraryId, project.id, ...trail);
  return (
    <section className="lib-box work-text-box">
      <h2 className="lib-box-h">{label}</h2>
      <p>
        <a className="wk-link" href={href('struktura', node.id)}>{node.title || t('work.untitled')}</a>
        <span className="lib-meta"> · {String(project.data.title ?? '')}</span>
      </p>
      <UnitContext work={work} store={store} lens={lens} node={node} pathKey={work.paths[0]?.key ?? ''} href={href} compact />
    </section>
  );
}
