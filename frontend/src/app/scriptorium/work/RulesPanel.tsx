/**
 * DAS REGELBUCH EINES WERKS (2026-11-15) — die Regeln dieses Projekts und das eigene Regelbuch (Regeln ohne Projekt,
 * die jedes Projekt dieses Skryptorium erbt): die Regel, warum, wo sie gilt, wie streng, Beispiele, ob sie von selbst
 * geprüft wird. Bearbeitet wird eine Regel wie jeder Eintrag des Skryptorium.
 */

import { useT, type T } from '../../core/i18n';
import { RULE_CHECKS } from '../../library/libraryKinds';
import { viewPath } from '../../routes';
import { entityLabel } from './EntityPick';
import type { WorkRule } from './workRules';
import type { Work } from './useWork';
import type { WorkCtx } from './WorkView';

/** Wo eine Regel gilt — in Worten. */
export function scopeWords(rule: WorkRule, work: Work, t: T, entity: (id: string) => string | null): string[] {
  const { model, templates } = work;
  const out: string[] = [];
  if (rule.node !== null) out.push(t('workUi.rules.inNode', { node: model.nodes.get(rule.node)?.title || t('work.check.someNode') }));
  if (rule.role !== '') out.push(t('workUi.rules.forRole', { role: model.roles.find((r) => r.value === rule.role)?.label ?? rule.role }));
  if (rule.template !== null) out.push(t('workUi.rules.forTemplate', { template: templates.get(rule.template)?.name || t('work.untitled') }));
  if (rule.dimension !== '') {
    const dim = model.dimensions.find((d) => d.key === rule.dimension);
    const value = rule.value === '' ? t('workUi.rules.anyValue') : dim?.values.find((v) => v.key === rule.value)?.name ?? rule.value;
    out.push(t('workUi.rules.forValue', { dimension: dim?.name ?? rule.dimension, value }));
  }
  if (rule.entity !== null) out.push(t('workUi.rules.whereEntity', { entity: entity(rule.entity) ?? t('work.check.someEntry') }));
  return out;
}

export function RulesPanel({ ctx }: { ctx: WorkCtx }) {
  const t = useT();
  const { rules } = ctx.work;
  const lib = ctx.library.libraryId;
  const groups: { key: string; title: string; lead: string; list: readonly WorkRule[] }[] = [
    { key: 'project', title: t('workUi.rules.project'), lead: t('workUi.rules.projectLead'), list: rules.filter((r) => r.project !== null) },
    { key: 'book', title: t('workUi.rules.rulebook'), lead: t('workUi.rules.rulebookLead'), list: rules.filter((r) => r.project === null) }
  ];
  return (
    <div className="work-rules">
      {!ctx.readOnly && (
        <div className="wk-actions">
          <a className="wk-btn wk-btn-small" href={viewPath('scriptorium', lib, 'nowy', 'rule', `project=${ctx.project.id}`)}>{t('workUi.rules.addProject')}</a>
          <a className="wk-btn wk-btn-small wk-btn-line" href={viewPath('scriptorium', lib, 'nowy', 'rule')}>{t('workUi.rules.addRulebook')}</a>
        </div>
      )}
      {groups.map((g) => (
        <section key={g.key} className="work-rule-group">
          <h2 className="wk-h2">{g.title} <span className="lib-count">{g.list.length}</span></h2>
          <p className="lib-meta">{g.lead}</p>
          {g.list.length === 0 ? <p className="wk-empty">{t('workUi.rules.none')}</p> : (
            <ul className="lib-list">
              {g.list.map((r) => {
                const scope = scopeWords(r, ctx.work, t, (id) => entityLabel(id, ctx.work.knowledge, ctx.lens));
                const check = RULE_CHECKS.find((c) => c.value === r.check);
                return (
                  <li key={r.id}>
                    <a className={`lib-row work-rule is-${r.weight}`} href={viewPath('scriptorium', lib, r.id)}>
                      <span className="lib-row-title">
                        <span className={`work-weight is-${r.weight}`}>{t(`libraryKinds.ruleWeights.${r.weight}`)}</span>
                        {r.rule || t('work.untitled')}
                      </span>
                      {r.why !== '' && <span className="lib-row-meta">{t('workUi.rules.why', { why: r.why })}</span>}
                      <span className="lib-row-meta">
                        {scope.length === 0 ? t('workUi.rules.everywhere') : scope.join(' · ')}
                        {check !== undefined && ` · ${t('workUi.rules.checked', { check: check.label, param: r.param })}`}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
