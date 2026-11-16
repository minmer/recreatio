/**
 * DAS WERK FÜR EINE KI (2026-11-15) — die Lage eines Projekts als ein lesbares Dokument: das Regelbuch mit den
 * Gründen, der Baum mit Zweck, Rolle, Ziel und Dimensionen, die Vorlagen, das Wissen des Werks (mit Phasen und
 * Verweisen auf den Text), das Register aller Vorkommen und der Bericht der Prüfung — je Weg.
 *
 * Gebaut im Browser aus DEMSELBEN Code, den die App zeigt (`workModel`, `workMarks`, `workChecks`, `workContext`),
 * und so in die Abschrift des Skryptorium gelegt (`aiAccess/aiSnapshot.ts`, `works`). Der Dienst liest daraus
 * `get_work_briefing`, `get_work_context` und `get_work_checks` (AiMcp.Works.cs) — er rechnet keine Prüfung selbst,
 * er filtert nur, was hier gerechnet ist: die Befunde sind dieselben wie in der App.
 */

import { str, type LibEntry } from '../../library/libraryKinds';
import { checkWork, templatesOf, type Finding } from './workChecks';
import { contextAt } from './workContext';
import { EMPTY_KNOWLEDGE, type WorkKnowledge } from './workKnowledge';
import { occurrencesOf, type MarkLook } from './workMarks';
import { rulesAt, rulesOf } from './workRules';
import { templateSig } from './workTemplates';
import { allNodes, levelOf, openNotes, readWork, roleOf, wordsOf, type WorkModel } from './workModel';

export const WORK_BRIEF_VERSION = 1;

export interface WorkBriefPath {
  readonly key: string;
  readonly name: string;
  readonly choose: Readonly<Record<string, string>>;
  /** Die Knoten in Lesereihenfolge, mit ihrer Nummer auf diesem Weg. */
  readonly order: readonly string[];
  readonly numbers: readonly string[];
  /** Wo jeder Eintrag zuerst eingeführt wird (Kennung des Knotens). */
  readonly firstIntro: Readonly<Record<string, string>>;
  readonly findings: readonly Finding[];
  /** Regeln, die auf diesem Weg an JEDER Stelle gelten. */
  readonly rulesEverywhere: readonly string[];
  /** Je Knoten: weitere Regeln, die hier gelten; Phasen, die hier gelten; was er einführen soll. */
  readonly context: Readonly<Record<string, { readonly rules?: readonly string[]; readonly phases?: readonly string[]; readonly deliver?: readonly string[] }>>;
}

export interface WorkBrief {
  readonly v: typeof WORK_BRIEF_VERSION;
  readonly project: string;
  readonly key?: string;
  readonly title: string;
  readonly projectType: string;
  readonly description: string;
  readonly lang: string;
  readonly levels: readonly { readonly depth: number; readonly name: string; readonly latex: string }[];
  readonly dimensions: WorkModel['dimensions'];
  readonly roles: readonly { readonly value: string; readonly label: string; readonly brings: string }[];
  readonly bases: readonly string[];
  readonly fromOutline: boolean;
  /** 2026-11-16 — wie weit der Autor die Struktur durchgesehen hat. */
  readonly review: { readonly nodes: number; readonly accepted: number; readonly revise: number; readonly remove: number; readonly unreviewed: number; readonly openNotes: number };
  readonly rules: readonly Record<string, unknown>[];
  readonly templates: readonly Record<string, unknown>[];
  readonly nodes: readonly Record<string, unknown>[];
  readonly knowledge: readonly Record<string, unknown>[];
  readonly paths: readonly WorkBriefPath[];
}

const put = (out: Record<string, unknown>, key: string, value: unknown) => {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return;
  out[key] = value;
};

/** DAS WERK EINES PROJEKTS für die Abschrift. `knowledge`: nur, was dieser Link lesen darf. */
export function workBrief(project: LibEntry, look: MarkLook, knowledge: WorkKnowledge = EMPTY_KNOWLEDGE): WorkBrief {
  const model = readWork(project, look);
  const occurrences = occurrencesOf(model, look, knowledge);
  const rules = rulesOf(model, look);
  const reports = checkWork({ model, look, knowledge, occurrences, rules });
  const templates = templatesOf(look);
  const usedTemplates = new Set(allNodes(model).map((n) => n.template).filter((x): x is string => x !== null));
  for (const r of rules) if (r.template !== null) usedTemplates.add(r.template);

  const nodes = allNodes(model).map((n) => {
    const out: Record<string, unknown> = { id: n.id };
    put(out, 'key', n.key);
    put(out, 'parent', n.parent);
    out.order = n.order;
    out.depth = n.depth;
    put(out, 'level', levelOf(model, n.depth).name);
    put(out, 'title', n.title);
    put(out, 'purpose', n.purpose);
    put(out, 'synopsis', n.synopsis);
    put(out, 'role', n.role);
    put(out, 'roleLabel', roleOf(model, n.role)?.label);
    put(out, 'brings', n.brings);
    put(out, 'targetWords', n.targetWords);
    put(out, 'targetMinutes', n.targetMinutes);
    put(out, 'status', n.status);
    out.words = wordsOf(n, look);
    put(out, 'text', n.text);
    put(out, 'split', n.split);
    put(out, 'variant', n.variant);
    put(out, 'skip', n.skip);
    put(out, 'template', n.template);
    put(out, 'notes', n.notes);
    /* 2026-11-16 — was der Autor zu diesem Knoten sagt: angenommen / überarbeiten / streichen, und das Gespräch. */
    put(out, 'review', n.review);
    put(out, 'thread', n.thread.map((x) => ({ ...x, ...(x.para === undefined ? {} : { para: x.para + 1 }) })));
    put(out, 'marks', occurrences.filter((o) => o.node === n.id && o.where !== 'implicit').map((o) => ({ entity: o.entity, role: o.role, where: o.where, ...(o.point === undefined ? {} : { point: o.point }), ...(o.para === undefined ? {} : { para: o.para }) })));
    put(out, 'usesUnmarked', [...new Set(occurrences.filter((o) => o.node === n.id && o.where === 'implicit').map((o) => o.entity))]);
    return out;
  });

  const shown = new Set(occurrences.map((o) => o.entity));
  for (const e of knowledge.all()) shown.add(e.id);
  const knowledgeOut = [...shown].map((id) => knowledge.get(id)).filter((e) => e !== undefined && e.phaseOf === undefined).map((e) => {
    const out: Record<string, unknown> = { id: e!.id, label: e!.label, kind: e!.kind };
    put(out, 'base', e!.base);
    put(out, 'definition', e!.definition);
    put(out, 'usage', e!.usage);
    put(out, 'preferred', e!.preferred);
    put(out, 'forbidden', e!.forbidden);
    put(out, 'forms', e!.forms);
    put(out, 'description', e!.description);
    put(out, 'requires', e!.requires);
    put(out, 'relations', e!.relations);
    put(out, 'phases', knowledge.phasesOf(e!.id).map((p) => {
      const ph: Record<string, unknown> = { id: p.id, label: p.label };
      put(ph, 'from', p.from);
      put(ph, 'until', p.until);
      put(ph, 'storyFrom', p.storyFrom);
      put(ph, 'storyUntil', p.storyUntil);
      put(ph, 'description', p.description);
      return ph;
    }));
    return out;
  });

  const paths: WorkBriefPath[] = reports.map((report) => {
    const placed = report.register.placed;
    const firstIntro: Record<string, string> = {};
    for (const [entity, reg] of report.register.byEntity) if (reg.firstIntro !== null) firstIntro[entity] = placed[reg.firstIntro].node.id;
    const at = placed.map((p) => rulesAt(model, rules, p, report.path, new Set((report.register.atNode.get(p.node.id) ?? []).map((o) => o.entity))).map((r) => r.id));
    const everywhere = rules.map((r) => r.id).filter((id) => at.length > 0 && at.every((list) => list.includes(id)));
    const context: Record<string, { rules?: string[]; phases?: string[]; deliver?: string[] }> = {};
    placed.forEach((p, i) => {
      const ctx = contextAt(model, report.register, p.node, look, knowledge, rules, []);
      const extra = at[i].filter((id) => !everywhere.includes(id));
      const one: { rules?: string[]; phases?: string[]; deliver?: string[] } = {};
      if (extra.length > 0) one.rules = extra;
      if (ctx.phases.length > 0) one.phases = ctx.phases.map((ph) => ph.phase);
      const deliver = (report.register.atNode.get(p.node.id) ?? []).filter((o) => o.role === 'intro').map((o) => o.entity);
      if (deliver.length > 0) one.deliver = [...new Set(deliver)];
      if (Object.keys(one).length > 0) context[p.node.id] = one;
    });
    return {
      key: report.path.key, name: report.path.name, choose: report.path.choose,
      order: placed.map((p) => p.node.id), numbers: placed.map((p) => p.number),
      firstIntro, findings: report.findings, rulesEverywhere: everywhere, context
    };
  });

  const d = project.data;
  return {
    v: WORK_BRIEF_VERSION,
    project: project.id,
    ...(project.key === undefined ? {} : { key: project.key }),
    title: str(d, 'title'),
    projectType: str(d, 'projectType'),
    description: str(d, 'description'),
    lang: model.lang,
    levels: model.levels.map((l, depth) => ({ depth, name: l.name, latex: l.latex })),
    dimensions: model.dimensions,
    roles: model.roles.map((r) => ({ value: r.value, label: r.label, brings: r.brings })),
    bases: model.bases,
    fromOutline: model.fromOutline,
    review: reviewSummary(model),
    rules: rules.map((r) => {
      const out: Record<string, unknown> = { id: r.id, scope: r.project === null ? 'rulebook' : 'project', rule: r.rule, weight: r.weight };
      for (const k of ['key', 'why', 'node', 'role', 'template', 'dimension', 'value', 'entity', 'good', 'bad', 'check', 'param'] as const) put(out, k, r[k]);
      return out;
    }),
    templates: [...usedTemplates].map((id) => templates.get(id)).filter((x) => x !== undefined).map((tpl) => ({
      id: tpl!.id, name: tpl!.name, description: tpl!.description, role: tpl!.role, targetWords: tpl!.targetWords, targetMinutes: tpl!.targetMinutes,
      parts: tpl!.parts, sig: templateSig(tpl!)
    })),
    nodes,
    knowledge: knowledgeOut,
    paths
  };
}

/** Alle Werke eines Skryptorium (Projekte mit Knoten oder Gliederung). */
export function workBriefs(projects: readonly LibEntry[], look: MarkLook, knowledgeFor: (bases: readonly string[], extra: readonly string[]) => WorkKnowledge): WorkBrief[] {
  return projects.filter((p) => p.kind === 'project').map((p) => {
    const model = readWork(p, look);
    if (model.nodes.size === 0) return null;
    const named = [...new Set(occurrencesOf(model, look).map((o) => o.entity))];
    return workBrief(p, look, knowledgeFor(model.bases, named));
  }).filter((b): b is WorkBrief => b !== null);
}

/** 2026-11-16 — die Durchsicht in Zahlen. */
export function reviewSummary(model: WorkModel): WorkBrief['review'] {
  const all = allNodes(model);
  return {
    nodes: all.length,
    accepted: all.filter((n) => n.review === 'accepted').length,
    revise: all.filter((n) => n.review === 'revise').length,
    remove: all.filter((n) => n.review === 'remove').length,
    unreviewed: all.filter((n) => n.review === '').length,
    openNotes: all.reduce((k, n) => k + openNotes(n).length, 0)
  };
}
